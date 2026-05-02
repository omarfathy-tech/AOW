import React from 'react';

export default function Card({ 
  children, 
  className = '', 
  variant = 'raised', // flat, raised, ghost
  style = {}, 
  onClick 
}) {
  const isClickable = !!onClick;
  
  const variantStyles = {
    flat: {
      background: 'var(--bg-elevated)',
      border: 'none',
      boxShadow: 'none',
    },
    raised: {
      background: 'var(--bg-surface)',
      border: '1px solid var(--border-default)',
      boxShadow: 'var(--shadow-md)',
      backdropFilter: 'blur(12px)',
    },
    ghost: {
      background: 'transparent',
      border: '1px dashed var(--border-strong)',
      boxShadow: 'none',
    }
  };

  return (
    <div 
      className={`glass-panel ${isClickable ? 'clickable' : ''} ${className}`} 
      style={{ 
        ...variantStyles[variant],
        borderRadius: 'var(--r-lg)',
        padding: 'var(--sp-6)',
        cursor: isClickable ? 'pointer' : 'default',
        transition: 'all var(--dur-base) var(--ease-out)',
        ...style 
      }}
      onClick={onClick}
    >
      {children}
    </div>
  );
}
