import React, { useState, useEffect } from 'react';
import BottomSheet from './common/BottomSheet';
import Button from './common/Button';

export default function ItemExtrasModal({
  pendingItem,
  onConfirm
}) {
  const [split, setSplit] = useState({ both: 0, salad: 0, tahina: 0, none: 0 });

  useEffect(() => {
    if (pendingItem) setSplit({ both: 0, salad: 0, tahina: 0, none: 0 });
  }, [pendingItem?.itemName, pendingItem?.size]);

  if (!pendingItem) return null;

  const total = split.none + split.salad + split.tahina + split.both;
  const totalPrice = pendingItem.price * total;

  function updateCombo(key, delta) {
    setSplit(prev => ({ ...prev, [key]: Math.max(0, prev[key] + delta) }));
  }

  function handleConfirm() {
    const combos = [];
    if (split.none > 0) combos.push({ optionId: 'none', qty: split.none });
    if (split.salad > 0) combos.push({ optionId: 'salad', qty: split.salad });
    if (split.tahina > 0) combos.push({ optionId: 'tahina', qty: split.tahina });
    if (split.both > 0) combos.push({ optionId: 'both', qty: split.both });
    if (combos.length === 0) return;
    onConfirm(false, combos);
  }

  const combos = [
    { key: 'none', label: 'none', labelAr: 'عادي', desc: 'No extras' },
    { key: 'both', label: 'both', labelAr: 'سلطة وطحينة', desc: 'Salad + Tahini' },
    { key: 'salad', label: 'salad', labelAr: 'سلطة فقط', desc: 'Salad only' },
    { key: 'tahina', label: 'tahina', labelAr: 'طحينة فقط', desc: 'Tahini only' },
  ];

  return (
    <BottomSheet
      isOpen={!!pendingItem}
      onClose={() => onConfirm(true)}
      title="Customize Order"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-5)' }}>

        {/* Item Info Card */}
        <div style={{
          padding: 'var(--sp-4)',
          background: 'var(--bg-elevated)',
          borderRadius: 'var(--r-md)',
          border: '1px solid var(--border-strong)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', color: 'var(--tx-1)' }}>{pendingItem.itemName}</div>
            <div style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--gold)' }}>{pendingItem.price}ج</div>
          </div>
          <div style={{ color: "var(--tx-2)", fontSize: '0.85rem', fontWeight: '500' }}>Size: {pendingItem.size}</div>
        </div>

        {/* Combo Quantity Stepper */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
          <h4 style={{
            color: 'var(--tx-3)',
            fontSize: '0.75rem',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            fontWeight: '800'
          }}>
            How many of each?
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {combos.map(c => (
              <div key={c.key} style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 14px',
                background: 'var(--bg-base)',
                borderRadius: 'var(--r-md)',
                border: '1px solid var(--border-default)'
              }}>
                <div>
                  <div style={{ fontWeight: '700', fontSize: '0.95rem', color: 'var(--tx-1)' }}>{c.labelAr}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--tx-3)' }}>{c.desc}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    onClick={() => updateCombo(c.key, -1)}
                    style={{
                      width: '32px', height: '32px', borderRadius: 'var(--r-sm)',
                      border: '1px solid var(--border-strong)', background: 'var(--bg-elevated)',
                      color: 'var(--tx-1)', fontWeight: '800', fontSize: '1rem', cursor: 'pointer'
                    }}
                  >−</button>
                  <span style={{ fontWeight: '800', minWidth: '24px', textAlign: 'center', fontFamily: 'var(--font-mono)' }}>
                    {split[c.key]}
                  </span>
                  <button
                    onClick={() => updateCombo(c.key, 1)}
                    style={{
                      width: '32px', height: '32px', borderRadius: 'var(--r-sm)',
                      border: '1px solid var(--border-strong)', background: 'var(--bg-elevated)',
                      color: 'var(--tx-1)', fontWeight: '800', fontSize: '1rem', cursor: 'pointer'
                    }}
                  >+</button>
                </div>
              </div>
            ))}
          </div>
          <div style={{ textAlign: 'center', fontSize: '0.85rem', color: 'var(--tx-3)', fontWeight: '600', marginTop: '4px' }}>
            Total items: {total} • Total price: {totalPrice.toFixed(1)}ج
          </div>
        </div>

        <div style={{ marginTop: 'var(--sp-2)' }}>
          <Button size="lg" onClick={handleConfirm} disabled={total === 0} style={{ width: '100%' }}>
            Confirm & Add to Cart
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onConfirm(true)} style={{ width: '100%', marginTop: 'var(--sp-2)' }}>
            Cancel
          </Button>
        </div>
      </div>
    </BottomSheet>
  );
}
