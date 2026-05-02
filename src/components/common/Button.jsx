import React from 'react';

export default function Button({ 
  children, 
  onClick, 
  type = 'button', 
  variant = 'primary', 
  size = 'md',
  className = '', 
  disabled = false, 
  style = {} 
}) {
  const sizeStyles = {
    sm: { padding: '8px 16px', fontSize: '0.875rem' },
    md: { padding: '14px 24px', fontSize: '1rem', minHeight: '48px' },
    lg: { padding: '18px 32px', fontSize: '1.125rem', minHeight: '56px' }
  };

  const variantStyles = {
    primary: {
      background: 'var(--gradient-brand)',
      color: 'white',
      boxShadow: 'var(--shadow-gold)',
      border: 'none',
    },
    secondary: {
      background: 'var(--bg-elevated)',
      color: 'var(--tx-1)',
      border: '1px solid var(--border-strong)',
      boxShadow: 'var(--shadow-sm)',
    },
    destructive: {
      background: 'var(--red-dim)',
      color: 'var(--red)',
      border: '1px solid var(--red-border)',
    },
    ghost: {
      background: 'transparent',
      color: 'var(--tx-2)',
      border: 'none',
    }
  };

  const baseStyle = {
    borderRadius: 'var(--r-md)',
    fontFamily: 'var(--font-body)',
    fontWeight: '600',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.6 : 1,
    transition: 'all var(--dur-base) var(--ease-out)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    outline: 'none',
    ...variantStyles[variant],
    ...sizeStyles[size],
    ...style
  };

  return (
    <button 
      type={type} 
      onClick={onClick} 
      disabled={disabled}
      className={`btn-${variant} ${className}`}
      style={baseStyle}
      onMouseEnter={e => {
        if (!disabled && variant !== 'ghost') {
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.filter = 'brightness(1.1)';
        }
      }}
      onMouseLeave={e => {
        if (!disabled) {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.filter = 'none';
        }
      }}
    >
      {children}
    </button>
  );
}
