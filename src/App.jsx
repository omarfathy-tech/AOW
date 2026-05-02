import { useState } from "react";
import "./App.css";

import LoginScreen from "./components/LoginScreen";
import UserPortal from "./components/UserPortal";
import AdminPortal from "./components/AdminPortal";
import OrderHistoryPage from "./components/OrderHistoryPage";
import RestaurantList from "./components/RestaurantList";
import { useAuth } from "./hooks/useAuth";
import { useAppHealth } from "./hooks/useAppHealth";
import { ToastProvider } from "./context/ToastContext";

export default function OrderHubApp() {
  const { user, loading, login, logout, isAdmin } = useAuth();
  const connectionOk = useAppHealth(user);
  
  const [view, setView] = useState("hub"); // hub, portal, history
  const [selectedRestaurant, setSelectedRestaurant] = useState(null);

  const handleLogout = async () => {
    await logout();
    setSelectedRestaurant(null);
    setView("hub");
  };

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        color: 'var(--gold)'
      }}>
        Loading OrderHub...
      </div>
    );
  }

  if (!user) {
    return <LoginScreen onLogin={login} />;
  }

  const avatarColor = user.color || 'var(--gold)';
  const initials = user.username?.slice(0, 2).toUpperCase();

  return (
    <ToastProvider>
      <div className="app-shell" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: 'var(--bg-base)' }}>
        {/* Universal Sticky Header */}
        <header style={{ 
          position: 'sticky',
          top: 0,
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          padding: 'var(--sp-3) var(--sp-4)', 
          background: 'var(--bg-base-90)',
          backdropFilter: 'blur(20px)',
          borderBottom: '1px solid var(--border-subtle)',
          zIndex: 1000,
          gap: 'var(--sp-3)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
             <h1 
               className="brand" 
               style={{ 
                 fontFamily: 'var(--font-display)',
                 fontSize: '1.25rem', 
                 cursor: 'pointer',
                 color: 'var(--gold)',
                 margin: 0
               }} 
               onClick={() => { setView("hub"); setSelectedRestaurant(null); }}
             >
               {isAdmin ? "👑 Admin Hub" : "🧺 OrderHub"}
             </h1>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
            {/* User Avatar & Logout Toggle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
              <div style={{
                width: '32px', height: '32px', borderRadius: '50%',
                background: 'var(--gold-glow)',
                border: '1px solid var(--gold)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: '800', fontSize: '0.75rem', color: 'var(--gold)'
              }}>{initials}</div>
              {!isAdmin && (
                <button 
                  onClick={() => setView(view === "history" ? "hub" : "history")}
                  style={{ 
                    background: 'none', border: 'none', color: 'var(--tx-2)',
                    fontSize: '0.85rem', fontWeight: '700', cursor: 'pointer'
                  }}
                >
                  {view === "history" ? "Menu" : "History"}
                </button>
              )}
              <button 
                onClick={handleLogout}
                style={{
                  background: 'none', border: 'none', color: 'var(--red)',
                  fontSize: '0.85rem', fontWeight: '700', cursor: 'pointer'
                }}
              >
                Exit
              </button>
            </div>
          </div>
        </header>

        {/* Global Connection Warning (Mobile Subtle) */}
        {!connectionOk && (
          <div style={{ 
            background: 'var(--red)', 
            color: 'white', 
            fontSize: '0.7rem', 
            textAlign: 'center', 
            padding: '2px 0',
            fontWeight: '800',
            letterSpacing: '0.05em'
          }}>
            RECONNECTING TO SERVER...
          </div>
        )}

        {/* Main Content */}
        <main style={{ flex: 1 }}>
          {isAdmin ? (
            <AdminPortal user={user} />
          ) : view === "history" ? (
            <OrderHistoryPage user={user} />
          ) : view === "portal" && selectedRestaurant ? (
            <UserPortal 
              user={user} 
              restaurant={selectedRestaurant} 
              onBack={() => { setView("hub"); setSelectedRestaurant(null); }} 
            />
          ) : (
            <div style={{ padding: 'var(--sp-4)' }}>
              <RestaurantList onSelect={(r) => { setSelectedRestaurant(r); setView("portal"); }} />
            </div>
          )}
        </main>
      </div>
    </ToastProvider>
  );
}
