package com.orderhub.app.services;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.orderhub.app.dto.ScrapedMenuDTO;
import com.orderhub.app.models.MenuCategory;
import com.orderhub.app.models.MenuItem;
import com.orderhub.app.models.Restaurant;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Service responsible for scraping restaurant menu data from external URLs.
 *
 * Supported platforms:
 *  - elmenus.com  → reverse-engineered internal API
 *  - menuegypt.com → HTML scraping (fallback)
 *
 * NOTE: This service uses elmenus' undocumented internal API.
 * If elmenus changes their API, update ELMENUS_API_BASE and the response
 * parsing logic in parseElmenusResponse().
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class MenuScraperService {

    // ---------------------------------------------------------------
    // elmenus internal API (discovered via browser DevTools → Network)
    // ---------------------------------------------------------------
    private static final String ELMENUS_API_BASE = "https://api.elmenus.com/api/v1";
    private static final String ELMENUS_INFO_ENDPOINT = ELMENUS_API_BASE + "/restaurants/%s";
    private static final Pattern NEXT_DATA_PATTERN = Pattern.compile(
        "<script[^>]*id=[\"']__NEXT_DATA__[\"'][^>]*>(.*?)</script>",
        Pattern.CASE_INSENSITIVE | Pattern.DOTALL
    );
    private static final Pattern TITLE_PATTERN = Pattern.compile(
        "<title>(.*?)</title>",
        Pattern.CASE_INSENSITIVE | Pattern.DOTALL
    );

    private final ElmenusApiClient elmenusApiClient;
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final HttpClient browserScraperHttpClient = HttpClient.newBuilder()
        .connectTimeout(Duration.ofSeconds(10))
        .build();

    @Value("${scraper.service.base-url:http://localhost:3100}")
    private String scraperServiceBaseUrl;

    // ---------------------------------------------------------------
    // Public API
    // ---------------------------------------------------------------

    /**
     * Main entry point. Detects the platform from the URL and delegates
     * to the appropriate scraper.
     *
     * @param menuUrl  the restaurant's menu URL (stored in Restaurant.menuUrl)
     * @return ScrapedMenuDTO ready to be merged into your Restaurant entity
     */
    public ScrapedMenuDTO scrapeMenu(String menuUrl) {
        log.info("Scraping menu from: {}", menuUrl);

        if (menuUrl == null || menuUrl.isBlank()) {
            throw new IllegalArgumentException("menuUrl must not be blank");
        }

        if (menuUrl.contains("elmenus.com")) {
            return scrapeElmenus(menuUrl);
        }

        // Add more platforms here:
        // if (menuUrl.contains("menuegypt.com")) return scrapeMenuEgypt(menuUrl);

        throw new UnsupportedOperationException(
            "No scraper available for: " + menuUrl +
            ". Supported platforms: elmenus.com"
        );
    }

    public List<String> discoverElmenusRestaurantUrls(String area, int limit) {
        if (area == null || area.isBlank()) {
            throw new IllegalArgumentException("area must not be blank");
        }
        int safeLimit = Math.max(1, Math.min(limit, 100));
        String url = String.format("%s/scrape/area?area=%s&limit=%d", scraperServiceBaseUrl, area.trim(), safeLimit);

        try {
            HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .timeout(Duration.ofSeconds(45))
                .GET()
                .build();
            HttpResponse<String> response = browserScraperHttpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                throw new RuntimeException("Browser scraper returned HTTP " + response.statusCode());
            }
            JsonNode root = objectMapper.readTree(response.body());
            List<String> urls = new ArrayList<>();
            JsonNode restaurants = root.path("restaurants");
            if (restaurants.isArray()) {
                for (JsonNode item : restaurants) {
                    String link = item.path("url").asText("");
                    if (!link.isBlank()) urls.add(link);
                }
            }
            return urls;
        } catch (Exception e) {
            throw new RuntimeException("Failed to discover area restaurants via browser scraper: " + e.getMessage(), e);
        }
    }

    /**
     * Convenience method: scrape and save directly onto an existing Restaurant entity.
     */
    public void applyScrapedMenuToRestaurant(Restaurant restaurant) {
        ScrapedMenuDTO scraped = scrapeMenu(restaurant.getMenuUrl());

        // Overwrite basic info only if not already set
        if (restaurant.getName() == null || restaurant.getName().isBlank()) {
            restaurant.setName(scraped.getRestaurantName());
        }
        if (restaurant.getLogoUrl() == null) {
            restaurant.setLogoUrl(scraped.getLogoUrl());
        }
        if (restaurant.getCuisineType() == null) {
            restaurant.setCuisineType(scraped.getCuisineType());
        }

        // Build JPA entities from the DTO
        List<MenuCategory> categories = buildCategoryEntities(scraped, restaurant);
        restaurant.setCategories(categories);

        log.info("Applied {} categories with {} total items to restaurant '{}'",
            categories.size(),
            categories.stream().mapToInt(c -> c.getItems().size()).sum(),
            restaurant.getName());
    }

    // ---------------------------------------------------------------
    // elmenus scraper
    // ---------------------------------------------------------------

    private ScrapedMenuDTO scrapeElmenus(String menuUrl) {
        ScrapedMenuDTO browserDto = tryBrowserScrape(menuUrl);
        if (browserDto != null && browserDto.getCategories() != null && !browserDto.getCategories().isEmpty()) {
            return browserDto;
        }

        String restaurantSlug = extractElmenusSlug(menuUrl);
        log.info("elmenus slug: {}", restaurantSlug);

        // 1. Fetch restaurant info (name, logo, cuisine)
        ScrapedMenuDTO dto = fetchElmenusRestaurantInfo(restaurantSlug);

        // 2. Fetch menu categories + items
        fetchElmenusMenu(menuUrl, restaurantSlug, dto);

        return dto;
    }

    private ScrapedMenuDTO tryBrowserScrape(String menuUrl) {
        try {
            String endpoint = scraperServiceBaseUrl + "/scrape/restaurant";
            String payload = objectMapper.writeValueAsString(Map.of("url", menuUrl));
            HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(endpoint))
                .timeout(Duration.ofSeconds(60))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(payload))
                .build();
            HttpResponse<String> response = browserScraperHttpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                String body = response.body();
                if (body != null && body.length() > 400) {
                    body = body.substring(0, 400) + "...";
                }
                log.warn("Browser scraper returned HTTP {} for {} body={}", response.statusCode(), menuUrl, body);
                return null;
            }
            JsonNode root = objectMapper.readTree(response.body());
            JsonNode menuNode = root.path("menu");
            if (menuNode.isMissingNode() || menuNode.isNull()) return null;
            ScrapedMenuDTO dto = objectMapper.treeToValue(menuNode, ScrapedMenuDTO.class);
            if (dto.getSourceUrl() == null || dto.getSourceUrl().isBlank()) dto.setSourceUrl(menuUrl);
            if (dto.getCuisineType() == null || dto.getCuisineType().isBlank()) dto.setCuisineType("OTHER");
            if (dto.getCategories() == null) dto.setCategories(new ArrayList<>());
            log.info("Browser scraper succeeded for {} with {} categories", menuUrl, dto.getCategories().size());
            return dto;
        } catch (Exception e) {
            log.warn("Browser scraper unavailable/failed for {}: {}", menuUrl, e.getMessage());
            return null;
        }
    }

    /**
     * Extracts the restaurant slug from an elmenus URL.
     * e.g. ".../القاهرة/ابو-مازن-woa5"  →  "woa5"
     * or   ".../القاهرة/ابو-مازن-woa5/المعادي-wqvkk"  →  "woa5"
     */
    private String extractElmenusSlug(String url) {
        // Try to match the short ID at the end of a path segment (e.g. "-woa5")
        Pattern shortIdPattern = Pattern.compile("-([a-z0-9]{4,8})(?:/|$)");
        Matcher matcher = shortIdPattern.matcher(url);

        String lastMatch = null;
        while (matcher.find()) {
            lastMatch = matcher.group(1);
        }
        if (lastMatch != null) return lastMatch;

        // Fallback: use last path segment
        String path = url.replaceAll("https?://[^/]+", "");
        String[] segments = path.split("/");
        for (int i = segments.length - 1; i >= 0; i--) {
            if (!segments[i].isBlank()) return segments[i];
        }

        throw new IllegalArgumentException("Could not extract restaurant slug from: " + url);
    }

    private ScrapedMenuDTO fetchElmenusRestaurantInfo(String slug) {
        ScrapedMenuDTO dto = new ScrapedMenuDTO();
        dto.setSourceUrl(String.format(ELMENUS_INFO_ENDPOINT, slug));
        dto.setCategories(new ArrayList<>());

        try {
            JsonNode root = elmenusApiClient.getRestaurantInfo(slug);

            // elmenus wraps data in { "data": { ... } }
            JsonNode data = root.has("data") ? root.get("data") : root;

            dto.setRestaurantName(textOrDefault(data, "name", "Unknown"));
            dto.setLogoUrl(textOrDefault(data, "logo", null));
            dto.setDescription(textOrDefault(data, "description", null));

            // Try to detect cuisine from tags / cuisine array
            if (data.has("cuisine")) {
                JsonNode cuisine = data.get("cuisine");
                if (cuisine.isArray() && cuisine.size() > 0) {
                    dto.setCuisineType(cuisine.get(0).asText("OTHER").toUpperCase());
                }
            }
            if (dto.getCuisineType() == null) {
                dto.setCuisineType("OTHER");
            }

            log.info("Fetched restaurant info: name='{}', cuisine='{}'",
                dto.getRestaurantName(), dto.getCuisineType());

        } catch (Exception e) {
            log.warn("Could not fetch restaurant info from elmenus API: {}", e.getMessage());
            dto.setRestaurantName("Unknown");
            dto.setCuisineType("OTHER");
        }

        return dto;
    }

    private void fetchElmenusMenu(String menuUrl, String slug, ScrapedMenuDTO dto) {
        try {
            JsonNode root = elmenusApiClient.getRestaurantMenu(slug);
            JsonNode data = root.has("data") ? root.get("data") : root;

            parseElmenusMenuData(data, dto);

        } catch (Exception e) {
            log.warn("Elmenus API menu fetch failed for slug '{}', trying HTML fallback: {}", slug, e.getMessage());
            try {
                fetchElmenusMenuFromHtml(menuUrl, dto);
                if (dto.getCategories() != null && !dto.getCategories().isEmpty()) {
                    log.info("HTML fallback succeeded for slug '{}': {} categories", slug, dto.getCategories().size());
                    return;
                }
            } catch (Exception fallbackError) {
                String details = fallbackError.getMessage();
                if (details == null || details.isBlank()) {
                    details = fallbackError.getClass().getSimpleName();
                }
                log.error("Failed HTML fallback for slug '{}': {}", slug, details, fallbackError);
            }
            String details = e.getMessage();
            if (details == null || details.isBlank()) details = e.getClass().getSimpleName();
            log.error("Failed to fetch elmenus menu for slug '{}': {}", slug, details, e);
            throw new RuntimeException("Menu scraping failed for slug '" + slug + "': " + details, e);
        }
    }

    private void fetchElmenusMenuFromHtml(String menuUrl, ScrapedMenuDTO dto) throws Exception {
        String html = elmenusApiClient.getRestaurantPageHtml(menuUrl);
        if (dto.getRestaurantName() == null || dto.getRestaurantName().isBlank() || "Unknown".equalsIgnoreCase(dto.getRestaurantName())) {
            dto.setRestaurantName(extractTitle(html));
        }

        Matcher m = NEXT_DATA_PATTERN.matcher(html);
        if (!m.find()) {
            throw new IllegalStateException("No __NEXT_DATA__ script found in restaurant page");
        }

        String nextDataJson = m.group(1);
        JsonNode root = objectMapper.readTree(nextDataJson);
        JsonNode bestCandidate = findBestMenuCandidate(root, 0);
        if (bestCandidate == null) {
            throw new IllegalStateException("Could not find menu categories in page JSON");
        }
        parseElmenusMenuData(bestCandidate, dto);
    }

    private JsonNode findBestMenuCandidate(JsonNode node, int depth) {
        if (node == null || node.isNull() || depth > 10) return null;

        JsonNode direct = findCategoryArray(node);
        if (direct != null && direct.isArray() && direct.size() > 0) return direct;

        if (node.isObject()) {
            Iterator<Map.Entry<String, JsonNode>> fields = node.fields();
            while (fields.hasNext()) {
                Map.Entry<String, JsonNode> entry = fields.next();
                JsonNode found = findBestMenuCandidate(entry.getValue(), depth + 1);
                if (found != null) return found;
            }
        } else if (node.isArray()) {
            for (JsonNode child : node) {
                JsonNode found = findBestMenuCandidate(child, depth + 1);
                if (found != null) return found;
            }
        }
        return null;
    }

    private String extractTitle(String html) {
        if (html == null) return "Unknown";
        Matcher matcher = TITLE_PATTERN.matcher(html);
        if (!matcher.find()) return "Unknown";
        String title = matcher.group(1)
            .replaceAll("\\s+", " ")
            .replace(" | elmenus", "")
            .replace(" | Elmenus", "")
            .trim();
        return title.isBlank() ? "Unknown" : title;
    }

    /**
     * Parses the elmenus menu JSON structure:
     * {
     *   "data": [
     *     {
     *       "name": "شاورما",
     *       "items": [
     *         { "name": "شاورما دجاج", "sizes": [ { "name": "عادي", "price": 55 } ] }
     *       ]
     *     }
     *   ]
     * }
     */
    private void parseElmenusMenuData(JsonNode data, ScrapedMenuDTO dto) {
        if (data == null || data.isNull()) {
            throw new IllegalStateException("Elmenus response has empty data payload");
        }

        JsonNode categories = findCategoryArray(data);

        if (categories == null || !categories.isArray()) {
            throw new IllegalStateException("Unexpected elmenus menu structure: categories array not found");
        }

        for (JsonNode catNode : categories) {
            ScrapedMenuDTO.CategoryDTO category = new ScrapedMenuDTO.CategoryDTO();
            category.setName(textOrDefault(catNode, "name", "Uncategorized"));
            category.setItems(new ArrayList<>());

            JsonNode items = catNode.has("items") ? catNode.get("items") : catNode.get("menuItems");
            if (items != null && items.isArray()) {
                for (JsonNode itemNode : items) {
                    ScrapedMenuDTO.ItemDTO item = parseElmenusItem(itemNode);
                    category.getItems().add(item);
                }
            }

            dto.getCategories().add(category);
            log.debug("Category '{}' → {} items", category.getName(), category.getItems().size());
        }

        log.info("Parsed {} categories from elmenus menu", dto.getCategories().size());
    }

    private JsonNode findCategoryArray(JsonNode data) {
        if (data.isArray()) return data;
        if (!data.isObject()) return null;

        // Common variants seen across provider responses
        String[] directKeys = {"categories", "menuCategories", "sections"};
        for (String key : directKeys) {
            JsonNode node = data.get(key);
            if (node != null && node.isArray()) return node;
        }

        // Nested variants, e.g. { menu: { categories: [...] } }
        JsonNode menuNode = data.get("menu");
        if (menuNode != null && menuNode.isObject()) {
            JsonNode nestedCategories = menuNode.get("categories");
            if (nestedCategories != null && nestedCategories.isArray()) return nestedCategories;
            JsonNode nestedSections = menuNode.get("sections");
            if (nestedSections != null && nestedSections.isArray()) return nestedSections;
        }

        return null;
    }

    private ScrapedMenuDTO.ItemDTO parseElmenusItem(JsonNode itemNode) {
        ScrapedMenuDTO.ItemDTO item = new ScrapedMenuDTO.ItemDTO();
        item.setName(textOrDefault(itemNode, "name", "Unnamed Item"));
        item.setDescription(textOrDefault(itemNode, "description", null));
        item.setImageUrl(textOrDefault(itemNode, "photo", null));
        item.setPrices(new LinkedHashMap<>());

        // Prices can come as:
        // A) a "sizes" array: [ { "name": "عادي", "price": 55 }, ... ]
        // B) a single "price" field
        if (itemNode.has("sizes") && itemNode.get("sizes").isArray()) {
            for (JsonNode sizeNode : itemNode.get("sizes")) {
                String sizeName = textOrDefault(sizeNode, "name", "Standard");
                double price = sizeNode.has("price") ? sizeNode.get("price").asDouble(0) : 0;
                item.getPrices().put(sizeName, price);
            }
        } else if (itemNode.has("price")) {
            item.getPrices().put("Standard", itemNode.get("price").asDouble(0));
        }

        return item;
    }

    // ---------------------------------------------------------------
    // Helper: build JPA entities from DTO
    // ---------------------------------------------------------------

    private List<MenuCategory> buildCategoryEntities(ScrapedMenuDTO dto, Restaurant restaurant) {
        List<MenuCategory> result = new ArrayList<>();

        for (ScrapedMenuDTO.CategoryDTO catDto : dto.getCategories()) {
            MenuCategory category = new MenuCategory();
            category.setName(catDto.getName());
            category.setRestaurant(restaurant);

            List<MenuItem> items = new ArrayList<>();
            for (ScrapedMenuDTO.ItemDTO itemDto : catDto.getItems()) {
                MenuItem menuItem = new MenuItem();
                menuItem.setName(itemDto.getName());
                menuItem.setPrices(itemDto.getPrices());
                menuItem.setCategory(category);
                items.add(menuItem);
            }

            category.setItems(items);
            result.add(category);
        }

        return result;
    }

    // ---------------------------------------------------------------
    // Utility
    // ---------------------------------------------------------------

    private String textOrDefault(JsonNode node, String field, String defaultValue) {
        if (node == null || !node.has(field) || node.get(field).isNull()) return defaultValue;
        String value = node.get(field).asText("").trim();
        return value.isBlank() ? defaultValue : value;
    }
}
