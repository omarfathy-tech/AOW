import express from "express";
import { chromium } from "playwright";

const app = express();
app.use(express.json({ limit: "1mb" }));

const PORT = process.env.PORT || 3100;
const SYSTEM_CHROMIUM_PATH = process.env.CHROMIUM_PATH || "/snap/bin/chromium";

function getLaunchOptions() {
  const opts = { headless: true };

  // If browser download is skipped, use system chromium.
  if (process.env.PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD === "1") {
    opts.executablePath = SYSTEM_CHROMIUM_PATH;
  }

  // Snap chromium often needs these in server/dev environments.
  opts.args = ["--no-sandbox", "--disable-dev-shm-usage"];
  return opts;
}

function extractSlug(url) {
  const m = String(url).match(/-([a-z0-9]{4,8})(?:\/|$)/i);
  return m ? m[1].toLowerCase() : null;
}

function normalizeUrl(href) {
  if (!href) return null;
  if (href.startsWith("http")) return href;
  if (href.startsWith("/")) return `https://elmenus.com${href}`;
  return null;
}

function mapMenuPayload(payload, sourceUrl) {
  const data = payload?.data ?? payload;
  const categories = Array.isArray(data) ? data : (data?.categories || data?.menuCategories || data?.sections || []);
  return {
    sourceUrl,
    restaurantName: "Unknown",
    logoUrl: null,
    cuisineType: "OTHER",
    description: null,
    categories: (categories || []).map((cat) => {
      const items = cat?.items || cat?.menuItems || [];
      return {
        name: cat?.name || "Uncategorized",
        items: (items || []).map((item) => {
          const prices = {};
          if (Array.isArray(item?.sizes) && item.sizes.length > 0) {
            for (const s of item.sizes) {
              prices[s?.name || "Standard"] = Number(s?.price || 0);
            }
          } else if (item?.price != null) {
            prices["Standard"] = Number(item.price || 0);
          }
          return {
            name: item?.name || "Unnamed Item",
            description: item?.description || null,
            imageUrl: item?.photo || null,
            prices
          };
        })
      };
    })
  };
}

function hasItemsArray(node) {
  if (!node) return false;
  if (Array.isArray(node)) return node.some((x) => x && (Array.isArray(x.items) || Array.isArray(x.menuItems)));
  if (typeof node !== "object") return false;
  if (Array.isArray(node.items) || Array.isArray(node.menuItems)) return true;
  for (const value of Object.values(node)) {
    if (hasItemsArray(value)) return true;
  }
  return false;
}

function looksLikeMenuPayload(json) {
  if (!json || typeof json !== "object") return false;
  const data = json.data ?? json;
  if (Array.isArray(data) && hasItemsArray(data)) return true;
  if (data && typeof data === "object") {
    if (Array.isArray(data.categories) && hasItemsArray(data.categories)) return true;
    if (Array.isArray(data.menuCategories) && hasItemsArray(data.menuCategories)) return true;
    if (Array.isArray(data.sections) && hasItemsArray(data.sections)) return true;
    if (hasItemsArray(data)) return true;
  }
  return false;
}

app.post("/scrape/restaurant", async (req, res) => {
  const url = req.body?.url;
  if (!url) return res.status(400).json({ error: "url is required" });

  const browser = await chromium.launch(getLaunchOptions());
  const context = await browser.newContext();
  const page = await context.newPage();
  const slug = extractSlug(url);

  let infoPayload = null;
  let menuPayload = null;
  const networkJsonCandidates = [];
  const networkErrors = [];

  page.on("response", async (response) => {
    try {
      const responseUrl = response.url();
      const ct = response.headers()["content-type"] || "";
      if (!ct.includes("application/json")) return;
      const json = await response.json();

      if (slug && responseUrl.includes(`/restaurants/${slug}/menu`)) {
        menuPayload = json;
      } else if (slug && responseUrl.includes(`/restaurants/${slug}`)) {
        infoPayload = json;
      } else if (looksLikeMenuPayload(json)) {
        networkJsonCandidates.push({ url: responseUrl, payload: json });
        if (!menuPayload) menuPayload = json;
      }
    } catch {
      // ignore noisy response parsing errors
    }
  });

  page.on("requestfailed", (request) => {
    networkErrors.push(`${request.method()} ${request.url()} -> ${request.failure()?.errorText || "failed"}`);
  });

  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(4000);
    await page.mouse.wheel(0, 1800).catch(() => {});
    await page.waitForTimeout(1500);

    if (!menuPayload) {
      // try clicking Menu tab when present
      const menuTabEn = page.getByText("Menu", { exact: true });
      const menuTabAr = page.getByText("المنيو", { exact: false });
      if (await menuTabEn.count()) {
        await menuTabEn.first().click({ timeout: 3000 }).catch(() => {});
        await page.waitForTimeout(2500);
      } else if (await menuTabAr.count()) {
        await menuTabAr.first().click({ timeout: 3000 }).catch(() => {});
        await page.waitForTimeout(2500);
      }
    }

    if (!menuPayload && networkJsonCandidates.length > 0) {
      menuPayload = networkJsonCandidates[0].payload;
    }

    if (!menuPayload) {
      return res.status(502).json({
        error: "Could not capture menu JSON from page network calls",
        sampledNetworkErrors: networkErrors.slice(0, 6),
        sampledJsonUrls: networkJsonCandidates.slice(0, 6).map((x) => x.url)
      });
    }

    const menu = mapMenuPayload(menuPayload, url);
    const infoData = infoPayload?.data || infoPayload || {};
    menu.restaurantName = infoData?.name || (await page.title()).replace("| elmenus", "").trim() || "Unknown";
    menu.logoUrl = infoData?.logo || null;
    menu.description = infoData?.description || null;
    if (Array.isArray(infoData?.cuisine) && infoData.cuisine.length > 0) {
      menu.cuisineType = String(infoData.cuisine[0] || "OTHER").toUpperCase();
    }

    return res.json({ ok: true, menu });
  } catch (e) {
    return res.status(502).json({ error: e?.message || "scrape failed" });
  } finally {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }
});

app.get("/scrape/area", async (req, res) => {
  const area = String(req.query.area || "").trim();
  const limit = Math.max(1, Math.min(Number(req.query.limit || 20), 100));
  if (!area) return res.status(400).json({ error: "area is required" });

  const browser = await chromium.launch(getLaunchOptions());
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    const areaUrl = `https://elmenus.com/cairo/delivery/${encodeURIComponent(area)}`;
    await page.goto(areaUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(3500);

    const links = await page.$$eval("a[href]", (anchors) =>
      anchors
        .map((a) => a.getAttribute("href"))
        .filter(Boolean)
    );

    const uniq = [];
    const seen = new Set();
    for (const href of links) {
      const full = normalizeUrl(href);
      if (!full) continue;
      if (!/elmenus\.com\/cairo\/.+-[a-z0-9]{4,8}(\/)?$/i.test(full)) continue;
      if (seen.has(full)) continue;
      seen.add(full);
      uniq.push({ url: full });
      if (uniq.length >= limit) break;
    }

    return res.json({ ok: true, area, count: uniq.length, restaurants: uniq });
  } catch (e) {
    return res.status(502).json({ error: e?.message || "area scrape failed" });
  } finally {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }
});

app.get("/health", (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`[scraper-service] listening on :${PORT}`);
});
