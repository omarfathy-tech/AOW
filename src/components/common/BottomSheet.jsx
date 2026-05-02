import React, { useEffect, useRef } from 'react';

export default function BottomSheet({ 
  isOpen, 
  onClose, 
  snapPoints = [0, 90], // [min, max] vh
  children,
  title
}) {
  const sheetRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div 
      className="bottom-sheet-wrapper"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        animation: 'fadeIn var(--dur-base) var(--ease-out)',
      }}
    >
      {/* Backdrop */}
      <div 
        onClick={onClose}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(69, 26, 3, 0.4)',
          backdropFilter: 'blur(4px)',
        }}
      />

      {/* Sheet Content */}
      <div 
        ref={sheetRef}
        className="bottom-sheet-content"
        style={{
          position: 'relative',
          width: '100%',
          maxHeight: `${snapPoints[1]}vh`,
          background: 'var(--bg-surface)',
          borderTop: '1px solid var(--border-strong)',
          borderRadius: 'var(--r-xl) var(--r-xl) 0 0',
          padding: 'var(--sp-4) var(--sp-6) env(safe-area-inset-bottom)',
          boxShadow: '0 -10px 40px rgba(0,0,0,0.5)',
          display: 'flex',
          flexDirection: 'column',
          animation: 'sheetSlideUp var(--dur-slow) var(--ease-out)',
          zIndex: 2
        }}
      >
        {/* Handle */}
        <div style={{
          width: '40px',
          height: '4px',
          background: 'var(--tx-3)',
          borderRadius: 'var(--r-full)',
          margin: '0 auto var(--sp-4)',
          cursor: 'grab'
        }} />

        {title && (
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 'var(--sp-6)'
          }}>
            <h2 style={{ 
              fontFamily: 'var(--font-display)', 
              fontSize: '1.5rem',
              color: 'var(--gold)'
            }}>{title}</h2>
            <button 
              onClick={onClose}
              style={{
                background: 'var(--bg-elevated)',
                border: 'none',
                color: 'var(--tx-2)',
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
            >✕</button>
          </div>
        )}

        <div style={{ 
          flex: 1, 
          overflowY: 'auto',
          paddingBottom: 'var(--sp-12)' // Space for bottom of content
        }}>
          {children}
        </div>
      </div>
      
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes sheetSlideUp { 
          from { transform: translateY(100%); } 
          to { transform: translateY(0); } 
        }
      `}} />
    </div>
  );
}
