export const SIZES = ["شامي", "بلدي", "فينو", "سوري"];

export const SIZE_COLORS = {
  "شامي": { bg: "#FFF7ED", border: "#F97316", text: "#9A3412" },
  "بلدي": { bg: "#F0FDF4", border: "#22C55E", text: "#14532D" },
  "فينو": { bg: "#EFF6FF", border: "#3B82F6", text: "#1E3A8A" },
  "سوري": { bg: "#FDF4FF", border: "#A855F7", text: "#581C87" },
};

export const CATEGORY_ICONS = {
  "سندوتشات الفول":     "🫘",
  "سندوتشات البطاطس":  "🥔",
  "سندوتشات الطعمية":  "🟤",
  "سندوتشات الشرقي":   "🥗",
  "سندوتشات الأومليت": "🍳",
  "سندوتشات الحلو":    "🍯",
};

export const EXTRAS = [
  { id: "salata",    nameAr: "سلطة",          price: 8  },
  { id: "tahina",    nameAr: "طحينة",          price: 7  },
  { id: "both",      nameAr: "سلطة وطحينة",    price: 14 },
  { id: "toum",      nameAr: "توم وبصل",       price: 5  },
  { id: "lime",      nameAr: "ليمون",          price: 5  },
];

export const ITEM_EXTRA_OPTIONS = [
  { id: "none",  label: "عادي" },
  { id: "both",   label: "سلطة + طحينة" },
  { id: "salad",  label: "سلطة فقط" },
  { id: "tahina", label: "طحينة فقط" },
];

export const DELIVERY = 10;
