import { useState, useEffect } from 'react';
import { API } from '../api.js';
import Button from './common/Button';
import Input from './common/Input';
import Card from './common/Card';
import StatusBadge from './common/StatusBadge';

export default function LoginScreen({ onLogin }) {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionInfo, setSessionInfo] = useState(null);
  const [connectionOk, setConnectionOk] = useState(false);
  const [registerSuccess, setRegisterSuccess] = useState(false);

  useEffect(() => {
    const checkStatus = () => {
      fetch(`${API}/sessions/active/status`)
        .then(res => res.json())
        .then(data => {
          setSessionInfo(data);
          setConnectionOk(true);
        })
        .catch(() => setConnectionOk(false));
    };
    checkStatus();
    const interval = setInterval(checkStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (isLogin) {
        const res = await fetch(`${API}/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: username.trim(), password })
        });

        let data;
        try {
          data = await res.json();
        } catch (parseError) {
          const text = await res.text();
          data = { error: text || res.statusText };
        }
        
        if (!res.ok) {
          setError(data.error || "Login failed");
          setLoading(false);
          return;
        }
        
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        
        onLogin(data.user);
      } else {
        if (!fullName.trim()) {
          setError("Full name is required");
          setLoading(false);
          return;
        }
        
        if (password.length < 4) {
          setError("Password must be at least 4 characters");
          setLoading(false);
          return;
        }
        
        const res = await fetch(`${API}/auth/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            username: username.trim(), 
            password,
            fullName: fullName.trim(),
            phone: phone.trim()
          })
        });
        
        const data = await res.json();
        
        if (!res.ok) {
          setError(data.error || "Registration failed");
          setLoading(false);
          return;
        }
        
        setRegisterSuccess(true);
        setIsLogin(true);
        setUsername(data.username || username);
      }
    } catch (err) {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container" style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      padding: 'var(--sp-4)',
      background: 'var(--bg-base)'
    }}>
      <Card variant="raised" className="login-card" style={{ 
        width: '100%', 
        maxWidth: '420px', 
        padding: 0, 
        overflow: 'hidden' 
      }}>
        {/* Hero Area */}
        <div style={{
          height: '160px',
          background: 'linear-gradient(180deg, var(--gold-glow) 0%, transparent 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          borderBottom: '1px solid var(--border-subtle)'
        }}>
          <svg width="80" height="80" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM12 20C7.59 20 4 16.41 4 12C4 7.59 7.59 4 12 4C16.41 4 20 7.59 20 12C20 16.41 16.41 20 12 20Z" fill="var(--gold)" fillOpacity="0.2"/>
            <path d="M11 7H13V12.42L15.7 15.12L14.29 16.53L11 13.24V7Z" fill="var(--gold)"/>
            <path d="M7 12H9C9 10.34 10.34 9 12 9V7C9.24 7 7 9.24 7 12Z" fill="var(--gold-bright)"/>
          </svg>
          <div style={{ position: 'absolute', bottom: 'var(--sp-4)', left: 'var(--sp-6)' }}>
            <h1 style={{ 
              fontFamily: 'var(--font-display)', 
              fontSize: '2rem', 
              color: 'var(--gold)',
              margin: 0
            }}>OrderHub</h1>
          </div>
        </div>

        <div style={{ padding: 'var(--sp-6)' }}>
          {/* Segmented Pill Control */}
          <div style={{
            display: 'flex',
            background: 'var(--bg-base)',
            borderRadius: 'var(--r-full)',
            padding: '4px',
            marginBottom: 'var(--sp-6)',
            border: '1px solid var(--border-strong)'
          }}>
            <button 
              onClick={() => { setIsLogin(true); setError(""); }}
              style={{
                flex: 1,
                padding: '10px',
                borderRadius: 'var(--r-full)',
                border: 'none',
                background: isLogin ? 'var(--gold)' : 'transparent',
                color: isLogin ? 'white' : 'var(--tx-2)',
                fontWeight: '700',
                fontSize: '0.875rem',
                cursor: 'pointer',
                transition: 'all var(--dur-base) var(--ease-out)'
              }}
            >Login</button>
            <button 
              onClick={() => { setIsLogin(false); setError(""); }}
              style={{
                flex: 1,
                padding: '10px',
                borderRadius: 'var(--r-full)',
                border: 'none',
                background: !isLogin ? 'var(--gold)' : 'transparent',
                color: !isLogin ? 'white' : 'var(--tx-2)',
                fontWeight: '700',
                fontSize: '0.875rem',
                cursor: 'pointer',
                transition: 'all var(--dur-base) var(--ease-out)'
              }}
            >Register</button>
          </div>

          {/* Session Status Pill */}
          <div style={{ marginBottom: 'var(--sp-6)', textAlign: 'center' }}>
            <StatusBadge status={sessionInfo?.status === 'OPEN' ? 'OPEN' : sessionInfo?.status === 'SENT' ? 'SENT' : 'CLOSED'} />
            <div style={{ fontSize: '0.75rem', color: 'var(--tx-3)', marginTop: '4px', fontStyle: 'italic' }}>
              {sessionInfo?.status === 'OPEN' ? `${sessionInfo.participants || 0} items already in basket` : 'Next session opening soon'}
            </div>
          </div>

          {/* Messages */}
          {(error || registerSuccess) && (
            <div style={{
              padding: '12px 16px',
              background: error ? 'var(--red-dim)' : 'var(--green-dim)',
              border: `1px solid ${error ? 'var(--red-border)' : 'var(--green-border)'}`,
              borderRadius: 'var(--r-md)',
              color: error ? 'var(--red)' : 'var(--green)',
              fontSize: '0.875rem',
              marginBottom: 'var(--sp-6)'
            }}>
              {error || "Account created! You can now sign in."}
            </div>
          )}
          
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
            <Input 
              label="Username" 
              value={username}
              onChange={e => setUsername(e.target.value)}
              required
              placeholder="e.g. omar_fathy"
            />

            <Input 
              label="Password"
              type="password" 
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              placeholder="••••••••"
            />

            {!isLogin && (
              <>
                <Input 
                  label="Full Name" 
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  placeholder="Official name for orders"
                />
                <Input 
                  label="Phone Number"
                  type="tel" 
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="+20 ..."
                />
              </>
            )}
            
            <Button 
              type="submit" 
              size="lg"
              disabled={loading}
              style={{ width: '100%', marginTop: 'var(--sp-4)' }}
            >
              {loading ? 'Processing...' : (isLogin ? 'Sign In' : 'Create My Account')}
            </Button>
          </form>

          {/* Connection Health */}
          <div style={{ 
            fontSize: '0.75rem', 
            color: 'var(--tx-3)', 
            marginTop: 'var(--sp-6)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            gap: '6px' 
          }}>
            <div style={{ 
              width: '6px', 
              height: '6px', 
              borderRadius: '50%', 
              background: connectionOk ? 'var(--green)' : 'var(--red)',
              boxShadow: connectionOk ? '0 0 8px var(--green)' : 'none'
            }} />
            {connectionOk ? 'OrderHub Network Active' : 'Connecting to Server...'}
          </div>
        </div>
      </Card>
    </div>
  );
}
