import React from 'react';

export default function Input({ 
  value, 
  onChange, 
  placeholder, 
  label,
  type = 'text', 
  className = '', 
  required = false,
  leftIcon,
  rightIcon,
  min,
  max,
  step,
  name,
  onBlur,
  onFocus
}) {
  const [isFocused, setIsFocused] = React.useState(false);
  const hasValue = value !== undefined && value !== null && value !== '';

  return (
    <div className={`input-container ${className}`} style={{
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      width: '100%',
      gap: 'var(--sp-2)'
    }}>
      <div style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        width: '100%'
      }}>
        {leftIcon && (
          <span style={{
            position: 'absolute',
            left: 'var(--sp-4)',
            color: isFocused ? 'var(--gold)' : 'var(--tx-2)',
            transition: 'color var(--dur-base) var(--ease-out)',
            zIndex: 1
          }}>
            {leftIcon}
          </span>
        )}

        <input
          name={name}
          type={type}
          value={value}
          onChange={onChange}
          onFocus={(e) => { setIsFocused(true); onFocus && onFocus(e); }}
          onBlur={(e) => { setIsFocused(false); onBlur && onBlur(e); }}
          className="premium-input"
          placeholder={label ? "" : placeholder}
          required={required}
          min={min}
          max={max}
          step={step}
          style={{
            width: '100%',
            height: '52px',
            background: 'var(--bg-base)',
            border: `1px solid ${isFocused ? 'var(--gold)' : 'var(--border-strong)'}`,
            borderRadius: 'var(--r-md)',
            color: 'var(--tx-1)',
            padding: `0 ${rightIcon ? '44px' : '16px'} 0 ${leftIcon ? '44px' : '16px'}`,
            fontSize: '1rem',
            fontFamily: 'var(--font-body)',
            outline: 'none',
            transition: 'all var(--dur-base) var(--ease-out)',
            boxShadow: isFocused ? '0 0 0 3px rgba(212, 148, 42, 0.2)' : 'none',
          }}
        />

        {label && (
          <label style={{
            position: 'absolute',
            left: leftIcon ? '44px' : '16px',
            top: (isFocused || hasValue) ? '-10px' : '50%',
            transform: (isFocused || hasValue) ? 'translateY(0)' : 'translateY(-50%)',
            background: (isFocused || hasValue) ? 'var(--bg-base)' : 'transparent',
            padding: '0 4px',
            fontSize: (isFocused || hasValue) ? '0.75rem' : '1rem',
            fontWeight: (isFocused || hasValue) ? '700' : '400',
            color: isFocused ? 'var(--gold)' : 'var(--tx-2)',
            pointerEvents: 'none',
            transition: 'all var(--dur-base) var(--ease-out)',
            zIndex: 2,
            textTransform: (isFocused || hasValue) ? 'uppercase' : 'none',
            letterSpacing: (isFocused || hasValue) ? '0.05em' : 'normal'
          }}>
            {label}
            {required && <span style={{ color: 'var(--red)', marginLeft: '2px' }}>*</span>}
          </label>
        )}

        {rightIcon && (
          <span style={{
            position: 'absolute',
            right: 'var(--sp-4)',
            color: isFocused ? 'var(--gold)' : 'var(--tx-2)',
            transition: 'color var(--dur-base) var(--ease-out)',
            zIndex: 1
          }}>
            {rightIcon}
          </span>
        )}
      </div>
    </div>
  );
}
