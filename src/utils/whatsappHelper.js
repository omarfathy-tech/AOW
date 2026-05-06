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
  { id: "both",   label: "سلطة + طحينة" },
  { id: "salad",  label: "سلطة فقط" },
  { id: "tahina", label: "طحينة فقط" },
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

export const sendOrderToUser = (personOrder, restaurantName, deliveryFee, personCount, discountPercent = 0, flatDiscount = 0) => {
  const lines = [
    `🧺 Your Order — ${restaurantName}`,
    `━━━━━━━━━━━━━━━`,
  ];

  if (personOrder.textOrder) {
    lines.push(`💬 ${personOrder.textOrder}`);
  } else {
    personOrder.items.forEach(i => {
      const isExtra = i.option === 'إضافة';
      const optStr = !isExtra && i.option !== 'عادي' && i.option ? ` — ${i.option}` : '';
      const qty = i.quantity || 1;
      const qtyStr = qty > 1 ? `${qty}× ` : '';
      lines.push(
        `• ${qtyStr}${i.name} ${!isExtra ? `(${i.size})` : ''}${optStr} — ${(i.price * qty).toFixed(1)}ج`
      );
    });
  }

  const dlvPP = personCount > 0 ? deliveryFee / personCount : 0;
  lines.push(``);
  lines.push(`Subtotal: ${personOrder.subtotal.toFixed(1)}ج`);
  lines.push(`Delivery share: ${dlvPP.toFixed(1)}ج`);

  const base = personOrder.subtotal + dlvPP;
  let afterPct = base;
  if (discountPercent > 0) {
    afterPct = base * (1 - discountPercent / 100);
    lines.push(`Discount: -${discountPercent}%`);
  }
  let afterFlat = afterPct - flatDiscount;
  if (flatDiscount > 0) {
    lines.push(`Compensation: -${flatDiscount.toFixed(0)}ج`);
  }
  const total = Math.max(0, Math.ceil(afterFlat));
  lines.push(`*Total: ${total}ج*`);

  if (personOrder.notes) {
    lines.push(`✍️ Notes: ${personOrder.notes}`);
  }

  return lines.join('\n');
};
