export const formatWhatsAppMessage = (people) => {
  const groupedByBread = {};

  people.forEach(person => {
    person.order.forEach(item => {
      const breadType = item.size || "عادي";
      if (!groupedByBread[breadType]) {
        groupedByBread[breadType] = {};
      }
      
      const optionText = item.optionId && item.optionId !== "none" ? ` ${getOptionLabel(item.optionId)}` : "";
      const itemKey = `${item.name}${optionText}`;
      groupedByBread[breadType][itemKey] = (groupedByBread[breadType][itemKey] || 0) + 1;
    });
  });

  const SIZES_ORDER = ["شامي", "فينو", "سوري", "بلدي"];
  
  let message = "";
  SIZES_ORDER.forEach(bread => {
    if (groupedByBread[bread]) {
      message += `\n\n${bread}\n`;
      Object.entries(groupedByBread[bread]).forEach(([itemName, count]) => {
        message += `  ${count}× ${itemName}\n`;
      });
    }
  });

  // Also include any other bread types not in SIZES_ORDER
  Object.entries(groupedByBread).forEach(([bread, items]) => {
    if (!SIZES_ORDER.includes(bread)) {
      message += `\n\n${bread}\n`;
      Object.entries(items).forEach(([itemName, count]) => {
        message += `  ${count}× ${itemName}\n`;
      });
    }
  });

  return message.trim();
};

const ITEM_EXTRA_OPTIONS = [
  { id: "none",  label: "عادي" },
  { id: "tahina", label: "طحينة فقط" },
  { id: "salad",  label: "سلطة فقط" },
  { id: "both",   label: "سلطة + طحينة" },
];

function getOptionLabel(optionId) {
  const opt = ITEM_EXTRA_OPTIONS.find(o => o.id === optionId);
  return opt ? opt.label : "";
}

export const sendToWhatsApp = (people) => {
  const text = formatWhatsAppMessage(people);
  const phone = "+1021389293";
  const url = `https://web.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(text)}`;
  window.open(url, "_blank");
};
