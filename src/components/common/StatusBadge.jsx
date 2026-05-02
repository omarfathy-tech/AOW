import React from 'react';

const STATUS_CONFIG = {
  OPEN: { label: '🥣 Open', color: 'var(--gold)', bg: 'var(--gold-glow)', border: 'var(--gold-border)' },
  CLOSED: { label: '🥪 Locked', color: 'var(--tx-2)', bg: 'var(--bg-overlay)', border: 'var(--border-subtle)' },
  SENT: { label: '🚚 Sent', color: '#4D7C0F', bg: 'rgba(77, 124, 15, 0.1)', border: 'rgba(77, 124, 15, 0.3)' },
  PENDING: { label: '⏳ Pending', color: 'var(--amber)', bg: 'var(--amber-dim)', border: 'var(--amber-border)' },
  ACCEPTED: { label: '✅ Accepted', color: 'var(--green)', bg: 'var(--green-dim)', border: 'var(--green-border)' },
  PREPARING: { label: '🥘 Cooking', color: 'var(--gold)', bg: 'var(--gold-glow)', border: 'var(--gold-border)' },
  DELIVERED: { label: '✨ Delivered', color: 'var(--green)', bg: 'var(--green-dim)', border: 'var(--green-border)' },
  CANCELLED: { label: '⚠️ Cancelled', color: 'var(--red)', bg: 'var(--red-dim)', border: 'var(--red-border)' },
};

export default function StatusBadge({ status, className = '' }) {
  const config = STATUS_CONFIG[status] || { label: status, color: 'var(--tx-2)', bg: 'var(--bg-elevated)', border: 'var(--border-subtle)' };

  return (
    <span 
      className={`status-badge ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '4px 10px',
        borderRadius: 'var(--r-full)',
        fontSize: '0.75rem',
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
        color: config.color,
        backgroundColor: config.bg,
        border: `1px solid ${config.border}`,
      }}
    >
      {status === 'OPEN' && (
        <span style={{ 
          width: '6px', 
          height: '6px', 
          borderRadius: '50%', 
          backgroundColor: 'currentColor', 
          marginRight: '6px',
          boxShadow: '0 0 8px currentColor',
          animation: 'status-pulse 2s infinite'
        }} />
      )}
      {config.label}
    </span>
  );
}
