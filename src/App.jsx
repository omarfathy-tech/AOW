import { useState, useMemo, useRef, useEffect } from "react";

// ─── MENU DATA ────────────────────────────────────────────────────────────────
const SIZES = ["شامي", "بلدي", "فينو", "سوري"];
const SIZE_COLORS = {
  شامي:  { bg: "#FFF7ED", border: "#F97316", text: "#9A3412" },
  بلدي:  { bg: "#F0FDF4", border: "#22C55E", text: "#14532D" },
  فينو:  { bg: "#EFF6FF", border: "#3B82F6", text: "#1E3A8A" },
  سوري:  { bg: "#FDF4FF", border: "#A855F7", text: "#581C87" },
};

const EXTRAS = [
  { id: "salata",    nameAr: "سلطة",          price: 8  },
  { id: "tahina",    nameAr: "طحينة",          price: 7  },
  { id: "both",      nameAr: "سلطة وطحينة",    price: 14 },
  { id: "toum",      nameAr: "توم وبصل",       price: 5  },
  { id: "lime",      nameAr: "ليمون",          price: 5  },
];

const ITEM_EXTRA_OPTIONS = [
  { id: "none",  label: "عادي" },
  { id: "tahina", label: "طحينة فقط" },
  { id: "salad",  label: "سلطة فقط" },
  { id: "both",   label: "سلطة + طحينة" },
];

const MENU = {
  "سندوتشات الفول": [
    { n: "فول",              p: { شامي:11, بلدي:13, فينو:18, سوري:21 } },
    { n: "فول نعمة",         p: { شامي:14, بلدي:16, فينو:21, سوري:25 } },
    { n: "فول مخصوص",        p: { شامي:14, بلدي:16, فينو:21, سوري:25 } },
    { n: "فول اسكندراني",    p: { شامي:14, بلدي:16, فينو:21, سوري:25 } },
    { n: "فول صلصة",         p: { شامي:14, بلدي:16, فينو:21, سوري:25 } },
    { n: "فول ذبدة",         p: { شامي:14, بلدي:16, فينو:21, سوري:25 } },
    { n: "فول زيت حار",      p: { شامي:11, بلدي:14, فينو:18, سوري:25 } },
    { n: "فول على بطاطس",    p: { شامي:18, بلدي:20, فينو:25, سوري:29 } },
    { n: "فول على بذنجان",   p: { شامي:18, بلدي:20, فينو:25, سوري:29 } },
    { n: "فول أومليت",       p: { شامي:22, بلدي:24, فينو:29, سوري:32 } },
    { n: "فول سوسيس",        p: { شامي:24, بلدي:26, فينو:31, سوري:32 } },
    { n: "فول بسطرمة",       p: { شامي:24, بلدي:26, فينو:31, سوري:32 } },
  ],
  "سندوتشات البطاطس": [
    { n: "بطاطس صوابع",            p: { شامي:16, بلدي:18, فينو:23, سوري:31 } },
    { n: "بطاطس كاتشب",             p: { شامي:19, بلدي:21, فينو:26, سوري:35 } },
    { n: "بطاطس كاتشب ومايونيز",    p: { شامي:19, بلدي:21, فينو:26, سوري:35 } },
    { n: "بطاطس على بذنجان",        p: { شامي:23, بلدي:25, فينو:30, سوري:37 } },
    { n: "بطاطس مسقعة",             p: { شامي:23, بلدي:25, فينو:30, سوري:37 } },
    { n: "بطاطس على أومليت",        p: { شامي:28, بلدي:30, فينو:35, سوري:47 } },
    { n: "بطاطس شيدر",              p: { شامي:28, بلدي:30, فينو:35, سوري:47 } },
    { n: "بطاطس رومي",              p: { شامي:28, بلدي:30, فينو:35, سوري:47 } },
    { n: "بطاطس موتزاريلا",         p: { شامي:28, بلدي:30, فينو:35, سوري:47 } },
    { n: "بطاطس سوسيس",             p: { شامي:28, بلدي:30, فينو:35, سوري:47 } },
    { n: "بطاطس بازوكا",            p: { شامي:33, بلدي:35, فينو:40, سوري:57 } },
    { n: "بطاطس ميكس لحوم",         p: { شامي:43, بلدي:45, فينو:50, سوري:72 } },
    { n: "مهروسة ذبدة",             p: { شامي:18, بلدي:20, فينو:23, سوري:31 } },
    { n: "مهروسة رومي",             p: { شامي:25, بلدي:28, فينو:32, سوري:52 } },
    { n: "مهروسة شيدر",             p: { شامي:25, بلدي:28, فينو:32, سوري:52 } },
  ],
  "سندوتشات الطعمية": [
    { n: "طعمية",               p: { شامي:11, بلدي:13, فينو:18, سوري:21 } },
    { n: "طعمية مخصوص",         p: { شامي:14, بلدي:16, فينو:21, سوري:25 } },
    { n: "طعمية محشي",          p: { شامي:16, بلدي:18, فينو:23, سوري:25 } },
    { n: "طعمية على بطاطس",     p: { شامي:18, بلدي:20, فينو:25, سوري:29 } },
    { n: "طعمية على بذنجان",    p: { شامي:18, بلدي:20, فينو:25, سوري:29 } },
    { n: "طعمية على جبنة قديمة",p: { شامي:18, بلدي:20, فينو:25, سوري:29 } },
    { n: "طعمية على جبنة قريش", p: { شامي:18, بلدي:21, فينو:25, سوري:29 } },
    { n: "طعمية عين كتكوت",     p: { شامي:21, بلدي:23, فينو:28, سوري:29 } },
    { n: "طعمية على بيض",       p: { شامي:21, بلدي:24, فينو:29, سوري:32 } },
    { n: "طعمية أومليت",        p: { شامي:22, بلدي:24, فينو:29, سوري:32 } },
    { n: "طعمية موتزاريلا",     p: { شامي:22, بلدي:24, فينو:29, سوري:32 } },
    { n: "طعمية جبنة شيدر",     p: { شامي:22, بلدي:28, فينو:32, سوري:32 } },
    { n: "طعمية لحوم",          p: { شامي:28, بلدي:30, فينو:35, سوري:47 } },
    { n: "طعمية ميكس جين",      p: { شامي:28, بلدي:30, فينو:35, سوري:47 } },
  ],
  "سندوتشات الشرقي": [
    { n: "شكشوكة",              p: { شامي:16, بلدي:18, فينو:23, سوري:25 } },
    { n: "بابا غنوج",           p: { شامي:16, بلدي:18, فينو:23, سوري:25 } },
    { n: "مسقعة",               p: { شامي:16, بلدي:18, فينو:23, سوري:25 } },
    { n: "مسقعة سجق",           p: { شامي:26, بلدي:28, فينو:33, سوري:35 } },
    { n: "ديناميت",             p: { شامي:28, بلدي:30, فينو:35, سوري:37 } },
    { n: "عجة بلدي",            p: { شامي:21, بلدي:23, فينو:28, سوري:30 } },
    { n: "عجة فرنساوي",         p: { شامي:16, بلدي:18, فينو:23, سوري:25 } },
    { n: "جبنة قريش",           p: { شامي:16, بلدي:18, فينو:23, سوري:25 } },
    { n: "جبنة قديمة",          p: { شامي:16, بلدي:18, فينو:23, سوري:25 } },
    { n: "جبنة مقلبة",          p: { شامي:28, بلدي:30, فينو:35, سوري:47 } },
    { n: "جبنة مقلبة بطاطس",    p: { شامي:33, بلدي:35, فينو:40, سوري:52 } },
    { n: "جبنة قريش رومي",      p: { شامي:26, بلدي:28, فينو:33, سوري:35 } },
    { n: "جبنة قريش بالبيض",    p: { شامي:23, بلدي:25, فينو:30, سوري:37 } },
  ],
  "سندوتشات الأومليت": [
    { n: "أومليت سادة",         p: { شامي:17, بلدي:22, فينو:27 } },
    { n: "أومليت ذبدة",         p: { شامي:20, بلدي:22, فينو:27, سوري:31 } },
    { n: "أومليت إسكندراني",    p: { شامي:20, بلدي:22, فينو:27, سوري:31 } },
    { n: "أومليت سجق",          p: { شامي:28, بلدي:30, فينو:35, سوري:42 } },
    { n: "أومليت سوسيس",        p: { شامي:28, بلدي:30, فينو:35, سوري:42 } },
    { n: "أومليت بسطرمة",       p: { شامي:28, بلدي:30, فينو:35, سوري:42 } },
    { n: "أومليت رومي",         p: { شامي:28, بلدي:30, فينو:35, سوري:42 } },
    { n: "أومليت شيدر",         p: { شامي:28, بلدي:30, فينو:35, سوري:42 } },
    { n: "أومليت موتزاريلا",    p: { شامي:28, بلدي:30, فينو:35, سوري:42 } },
    { n: "أومليت آتاتشي",       p: { شامي:33, بلدي:35, فينو:40, سوري:52 } },
    { n: "أومليت ميكس جبن",     p: { شامي:25, بلدي:27, فينو:32, سوري:42 } },
    { n: "بيض مسلوق",           p: { شامي:17, بلدي:19, فينو:24, سوري:27 } },
    { n: "بيض مسلوق ذبدة",      p: { شامي:17, بلدي:19, فينو:24, سوري:30 } },
  ],
  "سندوتشات الحلو": [
    { n: "حلاوة بالقشطة",  p: { فينو:35 } },
    { n: "مربى بالقشطة",   p: { فينو:35 } },
    { n: "جرابن",           p: { فينو:30 } },
    { n: "سكلانس",          p: { فينو:40 } },
  ],
};

const CATEGORY_ICONS = {
  "سندوتشات الفول":     "🫘",
  "سندوتشات البطاطس":  "🥔",
  "سندوتشات الطعمية":  "🟤",
  "سندوتشات الشرقي":   "🥗",
  "سندوتشات الأومليت": "🍳",
  "سندوتشات الحلو":    "🍯",
};

const DELIVERY = 10;

// ─── STYLES ──────────────────────────────────────────────────────────────────
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;900&family=Tajawal:wght@400;500;700;800&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg:        #0E0E12;
    --surface:   #18181F;
    --surface2:  #22222C;
    --surface3:  #2C2C38;
    --accent:    #E8A020;
    --accent2:   #F5C842;
    --red:       #DC2626;
    --text:      #F2F0E8;
    --text2:     #9B9890;
    --text3:     #5C5A55;
    --border:    rgba(255,255,255,0.07);
    --border2:   rgba(255,255,255,0.13);
    --radius:    14px;
    --radius-sm: 8px;
  }

  body {
    background: var(--bg);
    color: var(--text);
    font-family: 'Cairo', 'Tajawal', sans-serif;
    direction: rtl;
    min-height: 100vh;
    overflow-x: hidden;
  }

  /* scrollbar */
  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: var(--surface3); border-radius: 4px; }

  /* ── APP SHELL ── */
  .app-shell {
    display: grid;
    grid-template-columns: 320px 1fr 340px;
    grid-template-rows: 56px 1fr;
    height: 100vh;
    gap: 0;
  }

  /* ── TOPBAR ── */
  .topbar {
    grid-column: 1 / -1;
    background: var(--surface);
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 24px;
    gap: 16px;
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 10px;
    font-family: 'Tajawal', sans-serif;
    font-weight: 800;
    font-size: 20px;
    color: var(--accent);
    letter-spacing: -0.3px;
  }
  .brand-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--accent); }
  .topbar-stats {
    display: flex;
    gap: 24px;
    align-items: center;
  }
  .tstat { text-align: center; }
  .tstat-val { font-size: 17px; font-weight: 700; color: var(--accent); }
  .tstat-lbl { font-size: 11px; color: var(--text3); }

  /* ── LEFT PANEL: People ── */
  .panel-people {
    background: var(--surface);
    border-left: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .panel-header {
    padding: 16px 18px 12px;
    border-bottom: 1px solid var(--border);
    font-size: 13px;
    font-weight: 600;
    color: var(--text2);
    letter-spacing: 0.5px;
    text-transform: uppercase;
  }
  .person-input-wrap {
    padding: 14px 16px;
    border-bottom: 1px solid var(--border);
    display: flex;
    gap: 8px;
  }
  .person-input-wrap input {
    flex: 1;
    background: var(--surface2);
    border: 1px solid var(--border2);
    border-radius: var(--radius-sm);
    padding: 9px 13px;
    color: var(--text);
    font-family: 'Cairo', sans-serif;
    font-size: 14px;
    outline: none;
    transition: border-color .2s;
  }
  .person-input-wrap input:focus { border-color: var(--accent); }
  .person-input-wrap input::placeholder { color: var(--text3); }
  .btn-add-person {
    background: var(--accent);
    border: none;
    border-radius: var(--radius-sm);
    color: #0E0E12;
    font-size: 18px;
    font-weight: 700;
    width: 38px;
    cursor: pointer;
    transition: background .15s, transform .1s;
  }
  .btn-add-person:hover { background: var(--accent2); transform: scale(1.05); }

  .people-list {
    flex: 1;
    overflow-y: auto;
    padding: 10px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .person-card {
    border-radius: var(--radius-sm);
    border: 1px solid var(--border);
    padding: 10px 14px;
    cursor: pointer;
    transition: all .18s;
    background: var(--surface2);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  .person-card:hover { border-color: var(--border2); background: var(--surface3); }
  .person-card.active {
    border-color: var(--accent);
    background: rgba(232,160,32,0.1);
  }
  .person-card-left { display: flex; align-items: center; gap: 10px; }
  .person-avatar {
    width: 32px; height: 32px;
    border-radius: 50%;
    background: var(--surface3);
    display: flex; align-items: center; justify-content: center;
    font-size: 13px;
    font-weight: 700;
    color: var(--accent);
    flex-shrink: 0;
  }
  .person-card.active .person-avatar { background: rgba(232,160,32,0.2); }
  .person-name { font-size: 14px; font-weight: 600; }
  .person-meta { font-size: 11px; color: var(--text3); margin-top: 1px; }
  .person-total {
    font-size: 13px;
    font-weight: 700;
    color: var(--accent);
    white-space: nowrap;
  }
  .person-del {
    background: none; border: none; color: var(--text3);
    cursor: pointer; font-size: 16px; padding: 2px 4px;
    border-radius: 4px; line-height: 1;
    transition: color .15s, background .15s;
  }
  .person-del:hover { color: var(--red); background: rgba(220,38,38,0.1); }

  /* ── CENTER: Menu ── */
  .panel-menu {
    background: var(--bg);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    border-right: 1px solid var(--border);
    border-left: 1px solid var(--border);
  }
  .menu-topbar {
    padding: 12px 18px 10px;
    border-bottom: 1px solid var(--border);
    background: var(--surface);
  }
  .active-person-banner {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 14px;
    background: rgba(232,160,32,0.1);
    border: 1px solid rgba(232,160,32,0.25);
    border-radius: var(--radius-sm);
    margin-bottom: 10px;
    font-size: 13px;
    color: var(--accent);
    font-weight: 600;
  }
  .active-person-banner.empty {
    background: rgba(255,255,255,0.03);
    border-color: var(--border);
    color: var(--text3);
    font-weight: 400;
  }
  .cat-scroll {
    display: flex;
    gap: 10px;
    overflow-x: auto;
    padding-bottom: 8px;
    scroll-snap-type: x mandatory;
    -webkit-overflow-scrolling: touch;
  }
  .cat-scroll::-webkit-scrollbar { height: 6px; }
  .cat-scroll::-webkit-scrollbar-track { background: transparent; }
  .cat-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 999px; }
  .cat-btn {
    flex: 0 0 auto;
    min-width: 110px;
    padding: 10px 16px;
    border-radius: 999px;
    border: 1px solid rgba(255,255,255,0.12);
    background: rgba(255,255,255,0.04);
    color: var(--text2);
    font-family: 'Cairo', sans-serif;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: transform .15s, background .15s, color .15s, border-color .15s;
    white-space: nowrap;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    scroll-snap-align: start;
  }
  .cat-btn:hover {
    background: var(--surface3);
    color: var(--text);
    transform: translateY(-1px);
  }
  .cat-btn.active {
    background: var(--accent);
    border-color: var(--accent);
    color: #0E0E12;
    font-weight: 700;
    box-shadow: 0 12px 30px rgba(232,160,32,0.18);
  }
  .extra-choice-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
    margin-top: 16px;
  }
  .extra-choice-btn {
    padding: 12px 14px;
    border-radius: 14px;
    border: 1px solid var(--border2);
    background: var(--surface2);
    color: var(--text);
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: transform .15s, background .15s, border-color .15s;
  }
  .extra-choice-btn:hover {
    background: var(--surface3);
    transform: translateY(-1px);
  }
  .extra-choice-btn.active {
    background: var(--accent);
    border-color: var(--accent);
    color: #0E0E12;
  }

  .extras-bar {
    padding: 10px 18px;
    border-bottom: 1px solid var(--border);
    background: var(--surface);
    display: flex;
    gap: 6px;
    align-items: center;
    flex-wrap: wrap;
  }
  .extras-label {
    font-size: 11px;
    color: var(--text3);
    font-weight: 600;
    letter-spacing: 0.5px;
    text-transform: uppercase;
    margin-left: 4px;
    white-space: nowrap;
  }
  .extra-chip {
    padding: 5px 12px;
    border-radius: 20px;
    border: 1px solid var(--border2);
    background: var(--surface2);
    color: var(--text2);
    font-family: 'Cairo', sans-serif;
    font-size: 12px;
    cursor: pointer;
    transition: all .15s;
    white-space: nowrap;
  }
  .extra-chip:hover { background: var(--surface3); color: var(--text); }
  .extra-chip.selected {
    background: rgba(34,197,94,0.15);
    border-color: #22C55E;
    color: #86EFAC;
    font-weight: 600;
  }

  .items-scroll {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(185px, 1fr));
    gap: 10px;
    align-content: start;
  }
  .item-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 14px;
    transition: border-color .15s, background .15s;
  }
  .item-card:hover { border-color: var(--border2); background: var(--surface2); }
  .item-name {
    font-size: 14px;
    font-weight: 600;
    color: var(--text);
    margin-bottom: 10px;
    line-height: 1.4;
  }
  .size-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 5px;
  }
  .size-chip {
    padding: 5px 6px;
    border-radius: 6px;
    border: 1px solid;
    background: transparent;
    font-family: 'Cairo', sans-serif;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    text-align: center;
    transition: all .15s;
    display: flex;
    flex-direction: column;
    gap: 1px;
    line-height: 1.2;
  }
  .size-chip:hover { transform: scale(1.04); }
  .size-chip:active { transform: scale(0.97); }
  .size-chip .sz-name { font-size: 10px; opacity: 0.8; }
  .size-chip .sz-price { font-size: 12px; font-weight: 700; }

  /* ── RIGHT PANEL: Orders ── */
  .panel-orders {
    background: var(--surface);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .orders-header {
    padding: 14px 18px 12px;
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .orders-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--text2);
    letter-spacing: 0.5px;
    text-transform: uppercase;
  }
  .btn-clear {
    font-size: 11px;
    color: var(--text3);
    background: none;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: 4px 10px;
    cursor: pointer;
    font-family: 'Cairo', sans-serif;
    transition: all .15s;
  }
  .btn-clear:hover { border-color: var(--red); color: var(--red); }

  .orders-scroll {
    flex: 1;
    overflow-y: auto;
    padding: 10px;
  }
  .person-order-block {
    margin-bottom: 12px;
    border-radius: var(--radius);
    border: 1px solid var(--border);
    overflow: hidden;
  }
  .pob-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 14px;
    background: var(--surface2);
    border-bottom: 1px solid var(--border);
  }
  .pob-name {
    font-size: 14px;
    font-weight: 700;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .pob-dot {
    width: 6px; height: 6px;
    border-radius: 50%;
    background: var(--accent);
  }
  .pob-subtotal {
    font-size: 13px;
    font-weight: 700;
    color: var(--accent);
  }
  .pob-items { padding: 6px 4px; }
  .order-line {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 5px 10px;
    border-radius: 6px;
    transition: background .15s;
  }
  .order-line:hover { background: var(--surface2); }
  .ol-size {
    font-size: 11px;
    font-weight: 700;
    padding: 2px 7px;
    border-radius: 4px;
    flex-shrink: 0;
  }
  .ol-name { flex: 1; font-size: 13px; color: var(--text2); }
  .ol-price { font-size: 12px; color: var(--text3); white-space: nowrap; }
  .ol-del {
    background: none; border: none; color: var(--text3);
    cursor: pointer; font-size: 14px; padding: 1px 4px;
    border-radius: 4px; opacity: 0; transition: opacity .15s, color .15s;
  }
  .order-line:hover .ol-del { opacity: 1; }
  .ol-del:hover { color: var(--red); }

  /* Totals */
  .orders-footer {
    border-top: 1px solid var(--border);
    padding: 14px 16px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .total-row {
    display: flex;
    justify-content: space-between;
    font-size: 13px;
    color: var(--text2);
  }
  .total-row.grand {
    font-size: 17px;
    font-weight: 700;
    color: var(--text);
    padding-top: 8px;
    border-top: 1px solid var(--border);
    margin-top: 2px;
  }
  .total-row.grand span:last-child { color: var(--accent); }
  .btn-copy {
    margin-top: 4px;
    padding: 11px;
    background: var(--accent);
    border: none;
    border-radius: var(--radius-sm);
    color: #0E0E12;
    font-family: 'Cairo', sans-serif;
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
    transition: background .15s, transform .1s;
    width: 100%;
  }
  .btn-copy:hover { background: var(--accent2); }
  .btn-copy:active { transform: scale(0.98); }
  .btn-copy.copied { background: #22C55E; color: #052e16; }

  /* ── COMBINED VIEW MODAL ── */
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.75);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
    padding: 20px;
  }
  .modal {
    background: var(--surface);
    border: 1px solid var(--border2);
    border-radius: 18px;
    width: 100%;
    max-width: 560px;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .modal-header {
    padding: 18px 22px 14px;
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .modal-title {
    font-size: 17px;
    font-weight: 700;
    color: var(--text);
  }
  .modal-close {
    background: var(--surface2); border: 1px solid var(--border);
    color: var(--text2); font-size: 18px; width: 32px; height: 32px;
    border-radius: 8px; cursor: pointer; transition: all .15s;
    display: flex; align-items: center; justify-content: center;
  }
  .modal-close:hover { background: var(--surface3); color: var(--text); }
  .modal-body {
    flex: 1;
    overflow-y: auto;
    padding: 18px 22px;
  }
  .combined-section {
    margin-bottom: 20px;
  }
  .combined-size-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 10px;
  }
  .combined-size-pill {
    padding: 4px 14px;
    border-radius: 20px;
    border: 1px solid;
    font-size: 13px;
    font-weight: 700;
  }
  .combined-items { display: flex; flex-direction: column; gap: 4px; }
  .ci-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 12px;
    background: var(--surface2);
    border-radius: 8px;
    font-size: 14px;
  }
  .ci-count {
    min-width: 28px;
    height: 28px;
    background: var(--accent);
    color: #0E0E12;
    border-radius: 6px;
    display: flex; align-items: center; justify-content: center;
    font-size: 14px;
    font-weight: 800;
    flex-shrink: 0;
  }
  .ci-name { flex: 1; color: var(--text); }
  .ci-people { font-size: 11px; color: var(--text3); }
  .combined-extras { margin-top: 8px; }
  .extra-section-title {
    font-size: 12px;
    font-weight: 600;
    color: var(--text3);
    letter-spacing: 0.5px;
    text-transform: uppercase;
    margin-bottom: 8px;
  }
  .modal-footer {
    padding: 14px 22px;
    border-top: 1px solid var(--border);
    display: flex;
    gap: 8px;
  }
  .modal-footer button {
    flex: 1;
    padding: 10px;
    border-radius: var(--radius-sm);
    font-family: 'Cairo', sans-serif;
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
    transition: all .15s;
  }
  .btn-modal-copy {
    background: var(--accent);
    border: none;
    color: #0E0E12;
  }
  .btn-modal-copy:hover { background: var(--accent2); }
  .btn-modal-copy.copied { background: #22C55E; color: #052e16; }
  .btn-modal-close2 {
    background: none;
    border: 1px solid var(--border2);
    color: var(--text2);
  }
  .btn-modal-close2:hover { background: var(--surface2); color: var(--text); }

  .empty-orders {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    padding: 30px;
    color: var(--text3);
    text-align: center;
    gap: 8px;
  }
  .empty-icon { font-size: 40px; }
  .empty-text { font-size: 14px; }

  .badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 20px;
    height: 20px;
    border-radius: 10px;
    background: var(--accent);
    color: #0E0E12;
    font-size: 11px;
    font-weight: 800;
    padding: 0 5px;
  }

  @media (max-width: 900px) {
    .app-shell { grid-template-columns: 1fr; grid-template-rows: 56px auto; height: auto; }
    .panel-people, .panel-orders { display: none; }
  }
`;

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function initials(name) {
  return name.trim().slice(0, 2).toUpperCase();
}

function getOptionLabel(optionId) {
  const opt = ITEM_EXTRA_OPTIONS.find(o => o.id === optionId);
  return opt ? opt.label : "عادي";
}

function formatKitchenItemLabel(order) {
  const optionLabel = getOptionLabel(order.optionId);
  return optionLabel === "عادي" ? order.itemName : `${order.itemName} ${optionLabel}`;
}

function buildCombinedText(orders, extras) {
  const bySize = {};
  orders.forEach(o => {
    if (!bySize[o.size]) bySize[o.size] = {};
    const label = formatKitchenItemLabel(o);
    bySize[o.size][label] = (bySize[o.size][label] || 0) + 1;
  });

  const lines = ["🍴 الطلب المجمع — مطعم نعمة", "─".repeat(32)];

  for (const size of SIZES) {
    if (!bySize[size]) continue;
    lines.push(`\n${size}`);
    Object.entries(bySize[size]).forEach(([itemLabel, count]) => {
      lines.push(`  ${count}× ${itemLabel}`);
    });
  }

  if (extras.length > 0) {
    const extraCounts = {};
    extras.forEach(e => {
      extraCounts[e.name] = (extraCounts[e.name] || 0) + 1;
    });
    lines.push("\n🥗 إضافات");
    Object.entries(extraCounts).forEach(([name, count]) => {
      lines.push(`  ${count}× ${name}`);
    });
  }

  lines.push("\n" + "─".repeat(32));

  const byPerson = {};
  orders.forEach(o => {
    if (!byPerson[o.person]) byPerson[o.person] = [];
    byPerson[o.person].push(o);
  });
  const extraByPerson = {};
  extras.forEach(e => {
    if (!extraByPerson[e.person]) extraByPerson[e.person] = [];
    extraByPerson[e.person].push(e);
  });

  lines.push("\n👥 تفاصيل بالشخص");
  const allPeople = [...new Set([...Object.keys(byPerson), ...Object.keys(extraByPerson)])];
  let grandSub = 0;
  allPeople.forEach(person => {
    const items = byPerson[person] || [];
    const exs = extraByPerson[person] || [];
    const personTotal = items.reduce((s, i) => s + i.price, 0) + exs.reduce((s, e) => s + e.price, 0);
    grandSub += personTotal;
    lines.push(`\n👤 ${person}`);
    items.forEach(i => {
      const optionLabel = getOptionLabel(i.optionId);
      lines.push(`  • ${i.itemName} (${i.size}) - ${optionLabel} — ${i.price}ج`);
    });
    exs.forEach(e => lines.push(`  • ${e.name} — ${e.price}ج`));
    lines.push(`  المجموع: ${personTotal}ج`);
  });

  lines.push("\n" + "─".repeat(32));
  lines.push(`مجموع الطلبات: ${grandSub}ج`);
  lines.push(`التوصيل: ${DELIVERY}ج`);
  lines.push(`الإجمالي: ${grandSub + DELIVERY}ج`);
  return lines.join("\n");
}

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────
export default function NeamaApp() {
  const [people, setPeople] = useState([]);
  const [activePerson, setActivePerson] = useState(null);
  const [orders, setOrders] = useState([]); // {id, person, itemName, size, price}
  const [extras, setExtras] = useState([]); // {id, person, name, price}
  const [newPersonName, setNewPersonName] = useState("");
  const [currentCat, setCurrentCat] = useState(Object.keys(MENU)[0]);
  const [showModal, setShowModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [modalCopied, setModalCopied] = useState(false);
  const [pendingItem, setPendingItem] = useState(null);
  const [pendingExtraChoice, setPendingExtraChoice] = useState({ salad: false, tahina: false });
  const personInputRef = useRef(null);

  const cats = Object.keys(MENU);

  // Per-person totals
  const personTotals = useMemo(() => {
    const t = {};
    orders.forEach(o => { t[o.person] = (t[o.person] || 0) + o.price; });
    extras.forEach(e => { t[e.person] = (t[e.person] || 0) + e.price; });
    return t;
  }, [orders, extras]);

  const grandSubtotal = useMemo(() =>
    orders.reduce((s, o) => s + o.price, 0) + extras.reduce((s, e) => s + e.price, 0),
    [orders, extras]
  );

  const totalItems = orders.length + extras.length;

  // Combined grouped data for modal
  const combinedBySize = useMemo(() => {
    const res = {};
    SIZES.forEach(s => {
      const sizeOrders = orders.filter(o => o.size === s);
      if (!sizeOrders.length) return;
      const grouped = {};
      sizeOrders.forEach(o => {
        const label = formatKitchenItemLabel(o);
        if (!grouped[label]) grouped[label] = [];
        grouped[label].push(o.person);
      });
      res[s] = grouped;
    });
    return res;
  }, [orders]);

  const combinedExtras = useMemo(() => {
    const grouped = {};
    extras.forEach(e => {
      if (!grouped[e.name]) grouped[e.name] = [];
      grouped[e.name].push(e.person);
    });
    return grouped;
  }, [extras]);

  function addPerson() {
    const name = newPersonName.trim();
    if (!name || people.includes(name)) return;
    setPeople(p => [...p, name]);
    setActivePerson(name);
    setNewPersonName("");
  }

  function removePerson(name) {
    setPeople(p => p.filter(x => x !== name));
    setOrders(o => o.filter(x => x.person !== name));
    setExtras(e => e.filter(x => x.person !== name));
    if (activePerson === name) setActivePerson(null);
  }

  function addItem(itemName, size, price, optionId = "none") {
    if (!activePerson) return;
    setOrders(o => [...o, {
      id: Date.now() + Math.random(),
      person: activePerson,
      itemName,
      size,
      price,
      optionId,
    }]);
  }

  function openItemExtras(itemName, size, price) {
    if (!activePerson) return;
    setPendingItem({ itemName, size, price });
    setPendingExtraChoice({ salad: false, tahina: false });
  }

  function getPendingOptionId() {
    const { salad, tahina } = pendingExtraChoice;
    if (salad && tahina) return "both";
    if (salad) return "salad";
    if (tahina) return "tahina";
    return "none";
  }

  function confirmItemWithExtra(forceDefault = false) {
    if (!pendingItem || !activePerson) return;
    const optionId = forceDefault ? "none" : getPendingOptionId();
    addItem(pendingItem.itemName, pendingItem.size, pendingItem.price, optionId);
    setPendingItem(null);
    setPendingExtraChoice({ salad: false, tahina: false });
  }

  function removeOrder(id) {
    setOrders(o => o.filter(x => x.id !== id));
  }

  function toggleExtra(extra) {
    if (!activePerson) return;
    const existing = extras.find(e => e.person === activePerson && e.name === extra.nameAr);
    if (existing) {
      setExtras(e => e.filter(x => x.id !== existing.id));
    } else {
      setExtras(e => [...e, {
        id: Date.now() + Math.random(),
        person: activePerson, name: extra.nameAr, price: extra.price
      }]);
    }
  }

  function isExtraSelected(extraName) {
    return extras.some(e => e.person === activePerson && e.name === extraName);
  }

  function clearAll() {
    setOrders([]);
    setExtras([]);
  }

  function doCopy(text, setCopiedFn) {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopiedFn(true);
    setTimeout(() => setCopiedFn(false), 2000);
  }

  const combinedText = buildCombinedText(orders, extras);

  // Group orders by person for right panel
  const ordersByPerson = useMemo(() => {
    const res = {};
    [...orders.map(o => ({ ...o, isExtra: false })),
     ...extras.map(e => ({ ...e, itemName: e.name, isExtra: true }))
    ].forEach(o => {
      if (!res[o.person]) res[o.person] = [];
      res[o.person].push(o);
    });
    return res;
  }, [orders, extras]);

  const menuItems = MENU[currentCat] || [];

  return (
    <>
      <style>{CSS}</style>
      <div className="app-shell">

        {/* ── TOPBAR ── */}
        <div className="topbar">
          <div className="brand">
            <img src="/logo.svg" alt="AOW Logo" style={{ height: 24, marginRight: 8 }} />
            <div className="brand-dot" />
            <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text2)" }}>تجميع الطلبات</span>
          </div>
          <div className="topbar-stats">
            <div className="tstat">
              <div className="tstat-val">{people.length}</div>
              <div className="tstat-lbl">أشخاص</div>
            </div>
            <div className="tstat">
              <div className="tstat-val">{totalItems}</div>
              <div className="tstat-lbl">طلبات</div>
            </div>
            <div className="tstat">
              <div className="tstat-val">{grandSubtotal + (grandSubtotal > 0 ? DELIVERY : 0)}</div>
              <div className="tstat-lbl">إجمالي ج</div>
            </div>
            {totalItems > 0 && (
              <button
                onClick={() => setShowModal(true)}
                style={{
                  padding: "7px 16px",
                  background: "var(--accent)",
                  border: "none",
                  borderRadius: 8,
                  color: "#0E0E12",
                  fontFamily: "Cairo, sans-serif",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                عرض الطلب المجمع
              </button>
            )}
          </div>
        </div>

        {/* ── LEFT: People ── */}
        <div className="panel-people">
          <div className="panel-header">الأشخاص</div>
          <div className="person-input-wrap">
            <input
              ref={personInputRef}
              value={newPersonName}
              onChange={e => setNewPersonName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && addPerson()}
              placeholder="اسم الشخص..."
            />
            <button className="btn-add-person" onClick={addPerson}>+</button>
          </div>
          <div className="people-list">
            {people.length === 0 && (
              <div style={{ padding: "20px 10px", color: "var(--text3)", fontSize: 13, textAlign: "center" }}>
                أضف شخص للبدء
              </div>
            )}
            {people.map(name => (
              <div
                key={name}
                className={`person-card ${activePerson === name ? "active" : ""}`}
                onClick={() => setActivePerson(name)}
              >
                <div className="person-card-left">
                  <div className="person-avatar">{initials(name)}</div>
                  <div>
                    <div className="person-name">{name}</div>
                    <div className="person-meta">
                      {(ordersByPerson[name] || []).length} صنف
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  {personTotals[name] > 0 && (
                    <div className="person-total">{personTotals[name]}ج</div>
                  )}
                  <button className="person-del" onClick={e => { e.stopPropagation(); removePerson(name); }}>×</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── CENTER: Menu ── */}
        <div className="panel-menu">
          <div className="menu-topbar">
            <div className={`active-person-banner ${!activePerson ? "empty" : ""}`}>
              {activePerson
                ? <><span>طلب</span><strong>{activePerson}</strong></>
                : "اختار شخص من اليسار لتسجيل طلبه"
              }
            </div>
            <div className="cat-scroll">
              {cats.map(cat => (
                <button
                  key={cat}
                  className={`cat-btn ${currentCat === cat ? "active" : ""}`}
                  onClick={() => setCurrentCat(cat)}
                >
                  <span>{CATEGORY_ICONS[cat]}</span>
                  <span>{cat.replace("سندوتشات ", "")}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Extras bar */}
          <div className="extras-bar">
            <span className="extras-label">إضافات:</span>
            {EXTRAS.map(ex => (
              <button
                key={ex.id}
                className={`extra-chip ${isExtraSelected(ex.nameAr) ? "selected" : ""}`}
                onClick={() => toggleExtra(ex)}
                disabled={!activePerson}
                style={{ opacity: activePerson ? 1 : 0.4, cursor: activePerson ? "pointer" : "not-allowed" }}
              >
                {ex.nameAr} {ex.price}ج
              </button>
            ))}
          </div>

          <div className="items-scroll">
            {menuItems.map((item, i) => {
              const sizes = Object.entries(item.p);
              return (
                <div key={i} className="item-card">
                  <div className="item-name">{item.n}</div>
                  <div className="size-grid">
                    {sizes.map(([size, price]) => {
                      const col = SIZE_COLORS[size] || { bg: "#1e1e2a", border: "#555", text: "#aaa" };
                      return (
                        <button
                          key={size}
                          className="size-chip"
                          style={{
                            background: activePerson ? col.bg : "rgba(255,255,255,0.03)",
                            borderColor: activePerson ? col.border : "rgba(255,255,255,0.1)",
                            color: activePerson ? col.text : "var(--text3)",
                            cursor: activePerson ? "pointer" : "not-allowed",
                            opacity: activePerson ? 1 : 0.5,
                          }}
                          onClick={() => openItemExtras(item.n, size, price)}
                          disabled={!activePerson}
                        >
                          <span className="sz-name">{size}</span>
                          <span className="sz-price">{price}ج</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── RIGHT: Orders ── */}
        <div className="panel-orders">
          <div className="orders-header">
            <span className="orders-title">
              الطلبات {totalItems > 0 && <span className="badge">{totalItems}</span>}
            </span>
            {totalItems > 0 && (
              <button className="btn-clear" onClick={clearAll}>مسح الكل</button>
            )}
          </div>
          <div className="orders-scroll">
            {totalItems === 0 ? (
              <div className="empty-orders">
                <div className="empty-icon">🛒</div>
                <div className="empty-text">لا توجد طلبات بعد</div>
              </div>
            ) : (
              Object.entries(ordersByPerson).map(([person, items]) => (
                <div key={person} className="person-order-block">
                  <div className="pob-header">
                    <div className="pob-name">
                      <div className="pob-dot" />
                      {person}
                    </div>
                    <div className="pob-subtotal">{personTotals[person]}ج</div>
                  </div>
                  <div className="pob-items">
                    {items.map(item => {
                      const col = SIZE_COLORS[item.size] || {};
                      const optionLabel = item.isExtra ? null : getOptionLabel(item.optionId);
                      return (
                        <div key={item.id} className="order-line">
                          {!item.isExtra && (
                            <span
                              className="ol-size"
                              style={{
                                background: col.bg || "var(--surface3)",
                                color: col.text || "var(--text2)",
                                border: `1px solid ${col.border || "var(--border2)"}`,
                              }}
                            >
                              {item.size}
                            </span>
                          )}
                          {item.isExtra && (
                            <span
                              className="ol-size"
                              style={{ background: "rgba(34,197,94,0.1)", color: "#86EFAC", border: "1px solid #22C55E" }}
                            >
                              إضافة
                            </span>
                          )}
                          <span className="ol-name">
                            {item.itemName}
                            {!item.isExtra && ` - ${optionLabel}`}
                          </span>
                          <span className="ol-price">{item.price}ج</span>
                          <button
                            className="ol-del"
                            onClick={() => item.isExtra
                              ? setExtras(e => e.filter(x => x.id !== item.id))
                              : removeOrder(item.id)
                            }
                          >×</button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>

          {totalItems > 0 && (
            <div className="orders-footer">
              <div className="total-row">
                <span>مجموع الطلبات</span>
                <span>{grandSubtotal}ج</span>
              </div>
              <div className="total-row">
                <span>توصيل</span>
                <span>10ج</span>
              </div>
              <div className="total-row grand">
                <span>الإجمالي</span>
                <span>{grandSubtotal + DELIVERY}ج</span>
              </div>
              <button
                className={`btn-copy ${copied ? "copied" : ""}`}
                onClick={() => doCopy(combinedText, setCopied)}
              >
                {copied ? "✓ تم النسخ!" : "نسخ الطلب المجمع"}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── MODAL: Combined view ── */}
      {pendingItem && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && confirmItemWithExtra(true)}>
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">تخصيص الطلب</div>
              <button className="modal-close" onClick={() => confirmItemWithExtra(true)}>×</button>
            </div>
            <div className="modal-body">
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>{pendingItem.itemName}</div>
                  <div style={{ color: "var(--text3)", fontSize: 13 }}>الحجم: {pendingItem.size}</div>
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--accent)" }}>{pendingItem.price}ج</div>
              </div>
              <div className="extra-choice-grid">
                <button
                  type="button"
                  className={`extra-choice-btn ${pendingExtraChoice.salad ? "active" : ""}`}
                  onClick={() => setPendingExtraChoice(prev => ({ ...prev, salad: !prev.salad }))}
                >
                  سلطة
                </button>
                <button
                  type="button"
                  className={`extra-choice-btn ${pendingExtraChoice.tahina ? "active" : ""}`}
                  onClick={() => setPendingExtraChoice(prev => ({ ...prev, tahina: !prev.tahina }))}
                >
                  طحينة
                </button>
              </div>
              <div style={{ marginTop: 14, color: "var(--text3)", fontSize: 13 }}>
                اختر تحريرًا اختياريًا. إغلاق النافذة بدون اختيار سيسجّل الطلب العادي.
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-modal-copy" onClick={() => confirmItemWithExtra(false)}>إضافة</button>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">🍴 الطلب المجمع</div>
              <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            </div>
            <div className="modal-body">
              {/* By size */}
              {SIZES.filter(s => combinedBySize[s]).map(size => {
                const col = SIZE_COLORS[size];
                const grouped = combinedBySize[size];
                const itemCounts = {};
                Object.entries(grouped).forEach(([item, people]) => {
                  if (!itemCounts[item]) itemCounts[item] = { count: 0, people: [] };
                  itemCounts[item].count += people.length;
                  itemCounts[item].people.push(...people);
                });
                return (
                  <div key={size} className="combined-section">
                    <div className="combined-size-header">
                      <span
                        className="combined-size-pill"
                        style={{ background: col.bg, borderColor: col.border, color: col.text }}
                      >
                        {size}
                      </span>
                      <span style={{ fontSize: 13, color: "var(--text3)" }}>
                        {Object.values(itemCounts).reduce((s, v) => s + v.count, 0)} سندوتش
                      </span>
                    </div>
                    <div className="combined-items">
                      {Object.entries(itemCounts).map(([item, { count, people }]) => (
                        <div key={item} className="ci-row">
                          <div className="ci-count">{count}</div>
                          <div className="ci-name">{item}</div>
                          <div className="ci-people">{[...new Set(people)].join("، ")}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}

              {/* Extras */}
              {Object.keys(combinedExtras).length > 0 && (
                <div className="combined-section combined-extras">
                  <div className="extra-section-title">الإضافات</div>
                  <div className="combined-items">
                    {Object.entries(combinedExtras).map(([name, people]) => (
                      <div key={name} className="ci-row">
                        <div className="ci-count" style={{ background: "#22C55E", color: "#052e16" }}>
                          {people.length}
                        </div>
                        <div className="ci-name">{name}</div>
                        <div className="ci-people">{[...new Set(people)].join("، ")}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Per-person summary */}
              <div className="combined-section">
                <div className="extra-section-title" style={{ marginBottom: 10 }}>تفاصيل كل شخص</div>
                {[...new Set([...orders.map(o => o.person), ...extras.map(e => e.person)])].map(person => {
                  const pOrders = orders.filter(o => o.person === person);
                  const pExtras = extras.filter(e => e.person === person);
                  const total = (personTotals[person] || 0);
                  return (
                    <div key={person} style={{
                      background: "var(--surface2)", borderRadius: 10,
                      padding: "10px 14px", marginBottom: 8
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                        <span style={{ fontWeight: 700, fontSize: 14 }}>{person}</span>
                        <span style={{ color: "var(--accent)", fontWeight: 700, fontSize: 14 }}>{total}ج</span>
                      </div>
                      {pOrders.map(o => (
                        <div key={o.id} style={{ fontSize: 13, color: "var(--text2)", paddingRight: 8, marginBottom: 2 }}>
                          • {o.itemName} <span style={{ color: "var(--text3)" }}>({o.size})</span> — {o.price}ج
                        </div>
                      ))}
                      {pExtras.map(e => (
                        <div key={e.id} style={{ fontSize: 13, color: "#86EFAC", paddingRight: 8, marginBottom: 2 }}>
                          + {e.name} — {e.price}ج
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>

              {/* Totals */}
              <div style={{
                background: "var(--surface2)", borderRadius: 10,
                padding: "12px 16px", display: "flex", flexDirection: "column", gap: 6
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "var(--text2)" }}>
                  <span>مجموع الطلبات</span><span>{grandSubtotal}ج</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "var(--text2)" }}>
                  <span>التوصيل</span><span>10ج</span>
                </div>
                <div style={{
                  display: "flex", justifyContent: "space-between",
                  fontSize: 17, fontWeight: 700,
                  paddingTop: 8, marginTop: 4,
                  borderTop: "1px solid var(--border)"
                }}>
                  <span>الإجمالي</span>
                  <span style={{ color: "var(--accent)" }}>{grandSubtotal + DELIVERY}ج</span>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button
                className={`btn-modal-copy ${modalCopied ? "copied" : ""}`}
                onClick={() => doCopy(combinedText, setModalCopied)}
              >
                {modalCopied ? "✓ تم النسخ!" : "نسخ كنص"}
              </button>
              <button className="btn-modal-close2" onClick={() => setShowModal(false)}>إغلاق</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}