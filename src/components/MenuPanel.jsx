import React from 'react';
import { CATEGORY_ICONS, EXTRAS } from '../constants';
import Card from './common/Card';
import Button from './common/Button';

export default function MenuPanel({ 
  activePerson, 
  cats, 
  currentCat, 
  setCurrentCat, 
  menuItems, 
  onOpenItemExtras, 
  onToggleExtra, 
  isExtraSelected 
}) {
  return (
    <div className="panel-menu" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-6)' }}>
      
      {/* Category Navigation - Horizontal Scrollable Pill Bar */}
      <div style={{ 
        margin: '0 calc(var(--sp-4) * -1)', 
        padding: '0 var(--sp-4)',
        overflowX: 'auto', 
        display: 'flex', 
        gap: 'var(--sp-3)',
        msOverflowStyle: 'none',
        scrollbarWidth: 'none',
        paddingBottom: 'var(--sp-2)'
      }}>
        {cats.map(cat => {
          const isActive = currentCat === cat;
          return (
            <button
              key={cat}
              onClick={() => setCurrentCat(cat)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 20px',
                whiteSpace: 'nowrap',
                background: isActive ? 'var(--gold)' : 'var(--bg-elevated)',
                border: 'none',
                color: isActive ? 'white' : 'var(--tx-2)',
                borderRadius: 'var(--r-full)',
                cursor: 'pointer',
                fontSize: '0.9rem',
                fontWeight: '700',
                transition: 'all var(--dur-base) var(--ease-out)',
                flexShrink: 0,
                boxShadow: isActive ? 'var(--shadow-gold)' : 'none'
              }}
            >
              <span style={{ fontSize: '1.1rem' }}>{CATEGORY_ICONS[cat]}</span>
              <span>{cat.replace("سندوتشات ", "")}</span>
            </button>
          );
        })}
      </div>

      {/* Extras Row - Scrollable Chips */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
        <h4 style={{ 
          color: 'var(--tx-3)', 
          fontSize: '0.75rem', 
          textTransform: 'uppercase', 
          letterSpacing: '0.1em',
          fontWeight: '800'
        }}>
          Available Extras
        </h4>
        <div style={{ 
          display: 'flex', 
          flexWrap: 'wrap',
          gap: 'var(--sp-2)',
          paddingBottom: 'var(--sp-2)',
        }}>
          {EXTRAS.map(ex => {
            const isSelected = isExtraSelected(ex.nameAr);
            return (
              <button
                key={ex.id}
                onClick={() => onToggleExtra(ex)}
                disabled={!activePerson}
                style={{
                  padding: '8px 16px',
                  borderRadius: 'var(--r-full)',
                  border: isSelected ? '1px solid var(--gold)' : '1px solid var(--border-strong)',
                  background: isSelected ? 'var(--gold-glow)' : 'var(--bg-elevated)',
                  color: isSelected ? 'var(--gold)' : 'var(--tx-2)',
                  cursor: activePerson ? 'pointer' : 'not-allowed',
                  fontSize: '0.85rem',
                  fontWeight: '600',
                  transition: 'all var(--dur-base)',
                  whiteSpace: 'nowrap',
                  opacity: activePerson ? 1 : 0.5
                }}
              >
                {ex.nameAr} • {ex.price}ج
              </button>
            );
          })}
        </div>
      </div>

      {/* Items List - Single Column on Mobile */}
      <div className="menu-list" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
        {menuItems.map((item, i) => {
          const sizes = Object.entries(item.p || {});
          return (
            <Card key={i} variant="raised" style={{ padding: 'var(--sp-5)' }}>
              <div style={{ 
                fontFamily: 'var(--font-display)', 
                fontSize: '1.5rem', 
                fontWeight: '400', 
                color: 'var(--tx-1)',
                marginBottom: 'var(--sp-4)'
              }}>{item.n}</div>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
                {sizes.map(([size, price]) => (
                  <button
                    key={size}
                    onClick={() => onOpenItemExtras(item.n, size, price)}
                    disabled={!activePerson}
                    style={{
                      height: '52px', // Minimum target size
                      background: 'var(--bg-base)',
                      border: '1px solid var(--border-strong)',
                      color: 'var(--tx-1)',
                      borderRadius: 'var(--r-md)',
                      cursor: activePerson ? 'pointer' : 'not-allowed',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0 16px',
                      transition: 'all var(--dur-base) var(--ease-out)',
                      opacity: activePerson ? 1 : 0.5
                    }}
                    onMouseEnter={(e) => activePerson && (e.currentTarget.style.borderColor = 'var(--gold)')}
                    onMouseLeave={(e) => activePerson && (e.currentTarget.style.borderColor = 'var(--border-strong)')}
                  >
                    <span style={{ fontSize: '0.85rem', color: 'var(--tx-2)', fontWeight: '700' }}>{size}</span>
                    <span style={{ fontSize: '1rem', fontWeight: '800' }}>{price}ج</span>
                  </button>
                ))}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
