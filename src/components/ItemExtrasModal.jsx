import React from 'react';
import BottomSheet from './common/BottomSheet';
import Button from './common/Button';

export default function ItemExtrasModal({ 
  pendingItem, 
  pendingExtraChoice, 
  setPendingExtraChoice, 
  onConfirm 
}) {
  if (!pendingItem) return null;

  return (
    <BottomSheet 
      isOpen={!!pendingItem} 
      onClose={() => onConfirm(true)}
      title="Customize Order"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-6)' }}>
        
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

        {/* Customization Options */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
          <h4 style={{ 
            color: 'var(--tx-3)', 
            fontSize: '0.75rem', 
            textTransform: 'uppercase', 
            letterSpacing: '0.1em',
            fontWeight: '800'
          }}>
            Traditional Toppings
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <button
              onClick={() => setPendingExtraChoice(prev => ({ ...prev, salad: !prev.salad }))}
              style={{
                height: '56px',
                borderRadius: 'var(--r-md)',
                border: '1px solid',
                borderColor: pendingExtraChoice.salad ? 'var(--gold)' : 'var(--border-strong)',
                background: pendingExtraChoice.salad ? 'var(--gold-glow)' : 'var(--bg-base)',
                color: pendingExtraChoice.salad ? 'var(--gold)' : 'var(--tx-2)',
                fontWeight: '700',
                cursor: 'pointer',
                transition: 'all var(--dur-base) var(--ease-out)',
                fontSize: '1rem'
              }}
            >
              Salad (سلطة)
            </button>
            <button
              onClick={() => setPendingExtraChoice(prev => ({ ...prev, tahina: !prev.tahina }))}
              style={{
                height: '56px',
                borderRadius: 'var(--r-md)',
                border: '1px solid',
                borderColor: pendingExtraChoice.tahina ? 'var(--gold)' : 'var(--border-strong)',
                background: pendingExtraChoice.tahina ? 'var(--gold-glow)' : 'var(--bg-base)',
                color: pendingExtraChoice.tahina ? 'var(--gold)' : 'var(--tx-2)',
                fontWeight: '700',
                cursor: 'pointer',
                transition: 'all var(--dur-base) var(--ease-out)',
                fontSize: '1rem'
              }}
            >
              Tahini (طحينة)
            </button>
          </div>
        </div>

        <div style={{ marginTop: 'var(--sp-4)' }}>
          <Button size="lg" onClick={() => onConfirm(false)} style={{ width: '100%' }}>
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
