import { useState, useEffect, useRef } from "react";
import "./App.css";

import LoginScreen from "./components/LoginScreen";
import UserPortal from "./components/UserPortal";
import AdminPortal from "./components/AdminPortal";
import OrderHistoryPage from "./components/OrderHistoryPage";
import RestaurantList from "./components/RestaurantList";
import UserProfile from "./components/UserProfile";
import SupportInbox from "./components/SupportInbox";
import { useAuth } from "./hooks/useAuth";
import { useAppHealth } from "./hooks/useAppHealth";
import { useWebSocket } from "./hooks/useWebSocket";
import { ToastProvider, useToast } from "./context/ToastContext";

/* ── Notification Bell ─────────────────────────────────────────── */
function NotificationBell({ notifications, unreadCount, onMarkAllRead, onClear, onReact }) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef(null);

  // Close panel on outside click
  useEffect(() => {
    function handle(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  function toggle() {
    if (!open && unreadCount > 0) onMarkAllRead();
    setOpen(v => !v);
  }

  function typeEmoji(type) {
    switch (type) {
      case "SESSION_STARTED":  return "🟢";
      case "SESSION_CLOSED":   return "🔴";
      case "SESSION_SENT":     return "📦";
      case "SESSION_REOPENED": return "🔓";
      case "RESTAURANT_ADDED": return "🏪";
      case "RESTAURANT_REACTION": return "🎉";
      case "ORDER_CONFIRMED":  return "✅";
      case "ORDER_UPDATED":    return "✏️";
      default:                 return "🔔";
    }
  }

  function relativeTime(id) {
    if (!id) return "";
    const ms = Date.now() - id;
    if (ms < 60000)  return "just now";
    if (ms < 3600000) return `${Math.floor(ms / 60000)}m ago`;
    return `${Math.floor(ms / 3600000)}h ago`;
  }

  return (
    <div style={{ position: "relative" }} ref={panelRef}>
      <button
        id="notification-bell-btn"
        onClick={toggle}
        title="Notifications"
        style={{
          position: "relative",
          background: open ? "var(--bg-elevated)" : "none",
          border: "1px solid " + (open ? "var(--border-strong)" : "transparent"),
          borderRadius: "var(--r-md)",
          width: "36px",
          height: "36px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          fontSize: "1.1rem",
          transition: "background 0.15s",
        }}
      >
        🔔
        {unreadCount > 0 && (
          <span style={{
            position: "absolute",
            top: "2px",
            right: "2px",
            background: "var(--red)",
            color: "white",
            borderRadius: "50%",
            width: "16px",
            height: "16px",
            fontSize: "0.6rem",
            fontWeight: "800",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            lineHeight: 1,
            animation: "badge-pop 0.3s cubic-bezier(0.16,1,0.3,1)",
          }}>
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className="notification-dropdown"
          style={{
            background: "var(--bg-elevated)",
            border: "1px solid var(--border-strong)",
            borderRadius: "var(--r-lg)",
            boxShadow: "var(--shadow-lg)",
            zIndex: 2000,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            animation: "slide-down 0.2s cubic-bezier(0.16,1,0.3,1)",
          }}
        >
          {/* Header */}
          <div style={{
            padding: "12px 16px",
            borderBottom: "1px solid var(--border-subtle)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}>
            <span style={{ fontWeight: "800", fontSize: "0.9rem", color: "var(--tx-1)" }}>
              Notifications
            </span>
            {notifications.length > 0 && (
              <button
                onClick={onClear}
                style={{ background: "none", border: "none", color: "var(--tx-3)", fontSize: "0.75rem", cursor: "pointer", fontWeight: "600" }}
              >
                Clear all
              </button>
            )}
          </div>

          {/* Items */}
          <div style={{ overflowY: "auto", flex: 1 }}>
            {notifications.length === 0 ? (
              <div style={{ padding: "32px 16px", textAlign: "center", color: "var(--tx-3)", fontSize: "0.85rem" }}>
                <div style={{ fontSize: "2rem", marginBottom: "8px" }}>🔕</div>
                No notifications yet
              </div>
            ) : (
              notifications.map((n) => (
                <div key={n.id} style={{
                  padding: "12px 16px",
                  borderBottom: "1px solid var(--border-subtle)",
                  display: "flex",
                  gap: "10px",
                  alignItems: "flex-start",
                  background: n.readAt ? "transparent" : "var(--gold-glow)",
                  transition: "background 0.3s",
                }}>
                  <span style={{ fontSize: "1.2rem", flexShrink: 0, marginTop: "1px" }}>{typeEmoji(n.type)}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "0.82rem", fontWeight: "600", color: "var(--tx-1)", lineHeight: 1.4 }}>
                      {n.message || n.type}
                    </div>
                    <div style={{ fontSize: "0.7rem", color: "var(--tx-3)", marginTop: "3px" }}>
                      {relativeTime(n.id)}
                    </div>
                    {n.type === "RESTAURANT_ADDED" && (
                      <div style={{ display: "flex", gap: "6px", marginTop: "8px" }}>
                        {["🔥", "👏", "😍"].map((emoji) => (
                          <button
                            key={emoji}
                            onClick={() => onReact?.(n, emoji)}
                            style={{
                              border: "1px solid var(--border-default)",
                              background: "var(--bg-base)",
                              borderRadius: "var(--r-full)",
                              padding: "2px 8px",
                              cursor: "pointer",
                              fontSize: "0.8rem",
                            }}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes badge-pop {
          from { transform: scale(0); }
          to   { transform: scale(1); }
        }
      `}</style>
    </div>
  );
}

/* ── Inner App (needs ToastProvider already mounted) ───────────── */
function AppInner() {
  const { user, loading, login, logout, isAdmin } = useAuth();
  const connectionOk = useAppHealth(user);
  const showToast = useToast();

  const { connected, notifications, unreadCount, markAllRead, clearNotifications, sendMessage } =
    useWebSocket(user?.id);

  const [view, setView] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("adminHistory") === "true") return "history";
    return "hub";
  });
  const [selectedRestaurant, setSelectedRestaurant] = useState(null);
  const audioCtxRef = useRef(null);

  function handleRestaurantReaction(notification, emoji) {
    const restaurantName = notification.restaurantName || notification.message?.replace("New restaurant added: ", "") || "Restaurant";
    if (!connected) {
      showToast("Realtime not connected yet", "info");
      return;
    }
    // Broadcast to all users via backend websocket mapping.
    sendMessage("/reactions/restaurant", {
      restaurantName,
      emoji,
      username: user?.username || "User"
    });
  }

  // Show a toast whenever a new notification arrives
  const prevCountRef = useRef(0);
  useEffect(() => {
    if (notifications.length > prevCountRef.current) {
      const latest = notifications[0];
      if (latest && !latest.readAt) {
        showToast(latest.message || latest.type, "notification", 4500);
        try {
          if (!audioCtxRef.current) {
            audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
          }
          const ctx = audioCtxRef.current;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sine";
          osc.frequency.value = 880;
          gain.gain.value = 0.05;
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 0.12);
        } catch (_) {
          // Ignore sound issues on restricted browsers/devices.
        }
      }
    }
    prevCountRef.current = notifications.length;
  }, [notifications, showToast]);

  function handleUpdateUser() {
    window.location.reload();
  }

  const handleLogout = async () => {
    await logout();
    setSelectedRestaurant(null);
    const url = new URL(window.location.href);
    url.searchParams.delete("adminHistory");
    window.history.replaceState({}, "", url.toString());
    setView("hub");
  };

  if (loading) {
    return (
      <div style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        height: "100vh",
        color: "var(--gold)",
      }}>
        Loading OrderHub...
      </div>
    );
  }

  if (!user) return <LoginScreen onLogin={login} />;

  const avatarColor = user.color || "var(--gold)";
  const initials = user.username?.slice(0, 2).toUpperCase();

  return (
    <div className="app-shell" style={{ display: "flex", flexDirection: "column", minHeight: "100vh", background: "var(--bg-base)" }}>
      {/* Universal Sticky Header */}
      <header style={{
        position: "sticky",
        top: 0,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "var(--sp-3) var(--sp-4)",
        background: "var(--bg-base-90)",
        backdropFilter: "blur(20px)",
        borderBottom: "1px solid var(--border-subtle)",
        zIndex: 1000,
        gap: "var(--sp-3)",
      }}>
        {/* Brand */}
        <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-3)" }}>
          <h1
            className="brand"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "1.25rem",
              cursor: "pointer",
              color: "var(--gold)",
              margin: 0,
            }}
            onClick={() => { setView("hub"); setSelectedRestaurant(null); }}
          >
            {isAdmin ? "👑 Admin Hub" : "🧺 OrderHub"}
          </h1>
        </div>

        {/* Right actions */}
        <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-2)" }}>
          {/* WS indicator (subtle dot) */}
          <div
            title={connected ? "Live — real-time updates active" : "Connecting…"}
            style={{
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              background: connected ? "var(--green)" : "var(--amber)",
              boxShadow: connected ? "0 0 6px var(--green)" : "none",
              transition: "background 0.4s",
              flexShrink: 0,
            }}
          />

          {/* Notification Bell */}
          <NotificationBell
            notifications={notifications}
            unreadCount={unreadCount}
            onMarkAllRead={markAllRead}
            onClear={clearNotifications}
            onReact={handleRestaurantReaction}
          />

          {/* Avatar */}
          <button
            id="profile-btn"
            onClick={() => setView(view === "profile" ? "hub" : "profile")}
            style={{
              width: "32px",
              height: "32px",
              borderRadius: "50%",
              background: user?.avatarUrl ? `url(${user.avatarUrl}) center/cover` : avatarColor,
              border: "1px solid var(--gold)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: "800",
              fontSize: "0.75rem",
              color: "white",
              cursor: "pointer",
              padding: 0,
              overflow: "hidden",
            }}
          >
            {!user?.avatarUrl && initials}
          </button>

          {!isAdmin && (
            <button
              id="history-btn"
              onClick={() => setView(view === "history" ? "hub" : "history")}
              style={{
                background: "none",
                border: "none",
                color: "var(--tx-2)",
                fontSize: "0.85rem",
                fontWeight: "700",
                cursor: "pointer",
              }}
            >
              {view === "history" ? "Menu" : "History"}
            </button>
          )}
          {!isAdmin && (
            <button
              onClick={() => setView(view === "inbox" ? "hub" : "inbox")}
              style={{
                background: "none",
                border: "none",
                color: "var(--tx-2)",
                fontSize: "0.85rem",
                fontWeight: "700",
                cursor: "pointer",
              }}
            >
              {view === "inbox" ? "Home" : "Inbox"}
            </button>
          )}

          <button
            id="logout-btn"
            onClick={handleLogout}
            style={{
              background: "none",
              border: "none",
              color: "var(--red)",
              fontSize: "0.85rem",
              fontWeight: "700",
              cursor: "pointer",
            }}
          >
            Exit
          </button>
        </div>
      </header>

      {/* Reconnecting Banner */}
      {!connectionOk && (
        <div style={{
          background: "var(--red)",
          color: "white",
          fontSize: "0.7rem",
          textAlign: "center",
          padding: "2px 0",
          fontWeight: "800",
          letterSpacing: "0.05em",
        }}>
          RECONNECTING TO SERVER...
        </div>
      )}

      {/* Main Content */}
      <main style={{ flex: 1 }}>
        {isAdmin ? (
          <AdminPortal user={user} />
        ) : view === "profile" ? (
          <UserProfile user={user} onBack={() => setView("hub")} onUpdate={handleUpdateUser} />
        ) : view === "history" ? (
          <OrderHistoryPage user={user} isAdmin={isAdmin} />
        ) : view === "inbox" ? (
          <SupportInbox notifications={notifications} onBack={() => setView("hub")} />
        ) : view === "portal" && selectedRestaurant ? (
          <UserPortal
            user={user}
            restaurant={selectedRestaurant}
            onBack={() => { setView("hub"); setSelectedRestaurant(null); }}
          />
        ) : (
          <div style={{ padding: "var(--sp-4)" }}>
            <RestaurantList onSelect={(r) => { setSelectedRestaurant(r); setView("portal"); }} />
          </div>
        )}
      </main>
    </div>
  );
}

/* ── Root export (wraps providers) ────────────────────────────── */
export default function OrderHubApp() {
  return (
    <ToastProvider>
      <AppInner />
    </ToastProvider>
  );
}
