import { useState, useEffect, useMemo, useCallback } from 'react';
import { SIZES, SIZE_COLORS } from '../constants';
import { API, getAuthHeaders } from '../api.js';
import Button from './common/Button';
import Input from './common/Input';
import Card from './common/Card';
import StatusBadge from './common/StatusBadge';
import { sendOrderToUser } from '../utils/whatsappHelper';
import { useSessions } from '../hooks/useSessions.js';
import { useToast } from '../context/ToastContext';
import RestaurantManager from './RestaurantManager';

function Countdown({ deadline }) {
  const [remaining, setRemaining] = useState('');
  const [isUrgent, setIsUrgent] = useState(false);

  useEffect(() => {
    const tick = () => {
      const diff = new Date(deadline) - new Date();
      if (diff <= 0) { setRemaining("Time's up!"); setIsUrgent(true); return; }
      const mins = Math.floor(diff / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      setRemaining(`${mins}:${secs.toString().padStart(2, '0')}`);
      setIsUrgent(mins < 10);
    };
    tick();
    const i = setInterval(tick, 1000);
    return () => clearInterval(i);
  }, [deadline]);

  return (
    <span
      aria-live="polite"
      style={{
        fontSize: '1.25rem',
        fontWeight: '800',
        color: isUrgent ? 'var(--red)' : 'var(--gold)',
        fontFamily: 'var(--font-mono)',
      }}
    >
      ⌛ {remaining}
    </span>
  );
}

export default function AdminPortal({ user }) {
  const [activeTab, setActiveTab] = useState('sessions');
  const [restaurants, setRestaurants] = useState([]);
  const { activeSessions, refreshSessions } = useSessions();
  const [dashboardSession, setDashboardSession] = useState(null);
  const [sessionHistory, setSessionHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [paidUsers, setPaidUsers] = useState({});
  const [deadlineMinutes, setDeadlineMinutes] = useState(15);
  const showToast = useToast();

  // ─── Sync dashboardSession from the activeSessions poll ───────────────────
  useEffect(() => {
    if (activeSessions.length === 0) return;
    if (dashboardSession) {
      const updated = activeSessions.find(s => s.id === dashboardSession.id);
      if (updated) setDashboardSession(updated);
    } else {
      setDashboardSession(activeSessions[0]);
    }
  }, [activeSessions]); // intentionally omit dashboardSession to avoid loop

  // ─── Per-session detail poller — THE FIX ──────────────────────────────────
  // Depend only on the session ID string, not the session object or a
  // useCallback wrapper. This prevents setDashboardSession(newObj) from
  // recreating the callback → re-firing the effect → infinite loop.
  useEffect(() => {
    if (!dashboardSession?.id) return;

    const sessionId = dashboardSession.id; // capture primitive
    let isCancelled = false;
    let timeoutId;
    let failures = 0;

    const load = () => {
      if (isCancelled) return;
      fetch(`${API}/sessions/${sessionId}`, { headers: getAuthHeaders(false) })
        .then(res => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json();
        })
        .then(data => {
          if (!isCancelled) {
            failures = 0;
            setDashboardSession(data);
          }
        })
        .catch(err => {
          if (!isCancelled) {
            failures++;
            if (!err.message.includes('Failed to fetch') && !err.message.includes('Load failed')) {
              console.error('Session fetch failed:', err);
            }
          }
        })
        .finally(() => {
          if (!isCancelled) {
            // Exponential backoff: 5s → 7.5s → 11s … capped at 30s
            const delay = Math.min(30000, 5000 * Math.pow(1.5, failures));
            timeoutId = setTimeout(load, delay);
          }
        });
    };

    load();

    return () => {
      isCancelled = true;
      clearTimeout(timeoutId);
    };
  }, [dashboardSession?.id]); // ← only the ID string

  // ─── Restaurants ──────────────────────────────────────────────────────────
  useEffect(() => {
    fetch(`${API}/restaurants`, { headers: getAuthHeaders(false) })
      .then(res => res.json())
      .then(data => setRestaurants(data))
      .catch(err => console.error(err));
  }, []);

  // ─── History ──────────────────────────────────────────────────────────────
  const fetchHistory = useCallback(() => {
    fetch(`${API}/admin/sessions/history`, { headers: getAuthHeaders(false) })
      .then(res => res.json())
      .then(data => setSessionHistory(data.content || data))
      .catch(err => console.error(err));
  }, []);

  // ─── Refresh session detail after a mutation ──────────────────────────────
  // Safe because we're not inside the polling effect — just a one-shot fetch.
  const refreshCurrentSession = useCallback((sessionId) => {
    if (!sessionId) return;
    fetch(`${API}/sessions/${sessionId}`, { headers: getAuthHeaders(false) })
      .then(res => res.json())
      .then(data => setDashboardSession(data))
      .catch(err => console.error(err));
  }, []);

  // ─── Handlers ─────────────────────────────────────────────────────────────
  const handleStartSession = async (restaurant) => {
    const now = new Date();
    try {
      const res = await fetch(`${API}/admin/sessions`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          restaurantId: restaurant.id,
          sessionName: `${restaurant.name} Lunch ${now.toLocaleDateString()}`,
          openedBy: user.username
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const newSession = await res.json();
      refreshSessions();
      setDashboardSession(newSession);
      showToast(`Session started for ${restaurant.name}`, 'success');
    } catch (err) {
      console.error(err);
      showToast('Failed to start session', 'error');
    }
  };

  const handleToggleLock = async () => {
    if (!dashboardSession) return;
    const endpoint = dashboardSession.status === 'OPEN' ? 'close' : 'reopen';
    try {
      const res = await fetch(
        `${API}/admin/sessions/${dashboardSession.id}/${endpoint}`,
        { method: 'PATCH', headers: getAuthHeaders(false) }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const updated = await res.json();
      setDashboardSession(updated);
      refreshSessions();
    } catch (err) {
      console.error(err);
      showToast('Failed to update session', 'error');
    }
  };

  const handleEvictUser = async (personName) => {
    if (!dashboardSession) return;
    try {
      const res = await fetch(
        `${API}/sessions/${dashboardSession.id}/order/${encodeURIComponent(personName)}`,
        { method: 'DELETE', headers: getAuthHeaders(false) }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const updated = await res.json();
      setDashboardSession(updated);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteSession = async () => {
    if (!dashboardSession || !window.confirm("Are you sure you want to permanently delete this session?")) return;
    try {
      const res = await fetch(`${API}/admin/sessions/${dashboardSession.id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      if (!res.ok) throw new Error("Failed to delete");
      setDashboardSession(null);
      refreshSessions();
      showToast('Session deleted', 'success');
    } catch (err) {
      console.error(err);
      showToast('Failed to delete session', 'error');
    }
  };

  const handleUpdatePayment = async (personName, payload) => {
    try {
      const res = await fetch(`${API}/admin/sessions/${dashboardSession.id}/orders/${encodeURIComponent(personName)}/payment`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setDashboardSession(await res.json());
      }
    } catch (err) { console.error(err); }
  };

  const handleSendToWhatsApp = async () => {
    if (!dashboardSession) return;

    if (dashboardSession.status === 'OPEN') {
      await fetch(`${API}/admin/sessions/${dashboardSession.id}/close`, {
        method: 'PATCH',
        headers: getAuthHeaders(false),
      });
    }

    const lines = [
      `🍽️ *OrderHub Summary* — ${dashboardSession.sessionName}`,
      '━━━━━━━━━━━━━━━━━━━━━━━━',
    ];
    const bySize = {};
    const byExtra = {};

    dashboardSession.personOrders.forEach(p => {
      p.items.forEach(i => {
        const qty = i.quantity || 1;
        if (i.option === 'إضافة') {
          byExtra[i.name] = (byExtra[i.name] || 0) + qty;
        } else {
          if (!bySize[i.size]) bySize[i.size] = {};
          const lbl =
            i.option === 'عادي' || !i.option ? i.name : `${i.name} ${i.option}`;
          bySize[i.size][lbl] = (bySize[i.size][lbl] || 0) + qty;
        }
      });
    });

    for (const size of SIZES) {
      if (!bySize[size]) continue;
      lines.push(`${size}`);
      Object.entries(bySize[size]).forEach(([lbl, count]) =>
        lines.push(`  ${count}× ${lbl}`)
      );
      lines.push(' ');
    }

    if (Object.keys(byExtra).length > 0) {
      lines.push('إضافات');
      Object.entries(byExtra).forEach(([ex, count]) =>
        lines.push(`  ${count}× ${ex}`)
      );
    }

    lines.push('\n━━━━━━━━━━━━━━━━━━━━━━━━\n');
    lines.push('👥 *Breakdown by Person*\n');

    const count = dashboardSession.personOrders.length;
    const dlvPP = count > 0 ? dashboardSession.deliveryFee / count : 0;

    dashboardSession.personOrders.forEach(p => {
      const pDiscPct = p.discountPercent || 0;
      const pFlatDisc = p.flatDiscountPerUser || 0;
      lines.push(`👤 *${p.name}*`);
      if (p.notes) lines.push(`  ✍️ ${p.notes}`);
      if (p.textOrder) {
        lines.push(`  💬 ${p.textOrder}`);
      } else {
        p.items.forEach(i => {
          const isExtra = i.option === 'إضافة';
          const optStr =
            !isExtra && i.option !== 'عادي' && i.option ? ` - ${i.option}` : '';
          const pre = isExtra ? '+' : '•';
          const qty = i.quantity || 1;
          const qtyStr = qty > 1 ? `${qty}× ` : '';
          lines.push(
            `  └ ${pre} ${qtyStr}${i.name} ${!isExtra ? `(${i.size})` : ''}${optStr} — ${(i.price * qty).toFixed(1)}ج`
          );
        });
      }
      const pBase = p.subtotal + dlvPP;
      let pAfterPct = pBase;
      if (pDiscPct > 0) pAfterPct = pBase * (1 - pDiscPct / 100);
      let pAfterFlat = pAfterPct - pFlatDisc;
      const pTotal = Math.max(0, Math.ceil(pAfterFlat));
      let costLine = `  🧾 *Subtotal:* ${p.subtotal}ج + ${dlvPP.toFixed(1)}ج delivery`;
      if (pDiscPct > 0) costLine += ` - ${pDiscPct}%`;
      if (pFlatDisc > 0) costLine += ` - ${pFlatDisc.toFixed(0)}ج`;
      costLine += ` = *${pTotal}ج*\n`;
      lines.push(costLine);
    });

    lines.push('\n💸 *Financials*');
    lines.push(`• Subtotal: ${(dashboardSession.total - dashboardSession.deliveryFee).toFixed(1)}ج`);
    lines.push(`• Delivery: ${dashboardSession.deliveryFee}ج (${dlvPP.toFixed(1)}ج/person)`);
    const anyDiscounts = dashboardSession.personOrders.some(p => (p.discountPercent || 0) > 0 || (p.flatDiscountPerUser || 0) > 0);
    if (anyDiscounts) lines.push(`• Per-user discounts applied`);
    const totalWithCeil = costSplit.reduce((sum, r) => sum + r.grandTotal, 0);
    lines.push(`💵 *Grand Total: ${totalWithCeil}ج*`);

    const encodedText = encodeURIComponent(lines.join('\n'));
    // The number requested by the user: +201040458295 (removing +)
    const phone = '201040458295';
    window.open(`whatsapp://send?phone=${phone}&text=${encodedText}`, '_blank');

    try {
      const res = await fetch(
        `${API}/admin/sessions/${dashboardSession.id}/send`,
        { method: 'PATCH', headers: getAuthHeaders(false) }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const updated = await res.json();
      setDashboardSession(updated);
      refreshSessions();

      // Send individual order messages to users
      try {
        const usersRes = await fetch(`${API}/users`, { headers: getAuthHeaders(false) });
        if (usersRes.ok) {
          const users = await usersRes.json();
          const userMap = {};
          users.forEach(u => userMap[u.username] = u);

          dashboardSession.personOrders.forEach(p => {
            const user = userMap[p.name];
            if (user && user.phone) {
              const discPct = p.discountPercent || 0;
              const flatDisc = p.flatDiscountPerUser || 0;
              const message = sendOrderToUser(p, dashboardSession.sessionName, dashboardSession.deliveryFee, dashboardSession.personOrders.length, discPct, flatDisc);
              const phone = user.phone.replace(/\+/g, '');
              const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
              window.open(url, '_blank');
            }
          });
        }
      } catch (userErr) {
        console.error('Failed to send user messages:', userErr);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleBulkApprove = async () => {
    if (!dashboardSession?.personOrders) return;
    const orderIds = dashboardSession.personOrders.map(p => p.id).filter(Boolean);
    if (orderIds.length === 0) return;
    try {
      await fetch(`${API}/orders/bulk/status`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ orderIds, status: 'ACCEPTED' }),
      });
      // One-shot refresh after mutation — does NOT go through the polling loop
      refreshCurrentSession(dashboardSession.id);
    } catch (err) {
      console.error(err);
    }
  };

  // ─── Derived state ────────────────────────────────────────────────────────
  const aggregation = useMemo(() => {
    if (!dashboardSession) return {};
    const bySize = {};
    dashboardSession.personOrders.forEach(p => {
      p.items.forEach(i => {
        if (i.option === 'إضافة') return;
        if (!bySize[i.size]) bySize[i.size] = {};
        const lbl =
          i.option === 'عادي' || !i.option ? i.name : `${i.name} ${i.option}`;
        bySize[i.size][lbl] = (bySize[i.size][lbl] || 0) + 1;
      });
    });
    return bySize;
  }, [dashboardSession]);

  const costSplit = useMemo(() => {
    if (!dashboardSession || !dashboardSession.personOrders || dashboardSession.personOrders.length === 0) return [];
    const dlvPP = dashboardSession.deliveryFee / dashboardSession.personOrders.length;
    return dashboardSession.personOrders.map(p => {
      const discPct = p.discountPercent || 0;
      const flatDisc = p.flatDiscountPerUser || 0;
      const base = p.subtotal + dlvPP;
      let afterPct = base;
      if (discPct > 0) afterPct = base * (1 - discPct / 100);
      let afterFlat = afterPct - flatDisc;
      const grandTotal = Math.max(0, Math.ceil(afterFlat));
      return {
        name: p.name,
        itemsTotal: p.subtotal,
        deliveryShare: dlvPP,
        discountPercent: discPct,
        flatDiscount: flatDisc,
        grandTotal,
        isPaid: p.isPaid || false,
        paymentMethod: p.paymentMethod || "",
        amountReceived: p.amountReceived || ""
      };
    });
  }, [dashboardSession]);

  const isSent = dashboardSession?.status === 'SENT';
  const isOpen = dashboardSession?.status === 'OPEN';

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div
      className="admin-portal"
      style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: 'var(--bg-base)' }}
    >
      {/* ── Sticky session picker ── */}
      <div
        className="glass-header"
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 100,
          background: 'var(--glass-header-bg)',
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          borderBottom: '1px solid var(--glass-header-border)',
          padding: 'var(--sp-3) 0',
          boxShadow: 'var(--glass-header-shadow)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 var(--sp-4)', marginBottom: '8px' }}>
          <h3 style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--tx-2)', fontWeight: '800', letterSpacing: '0.1em', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--green)', display: 'inline-block', boxShadow: '0 0 8px var(--green)' }} />
            Active Sessions
          </h3>
          <Button variant="ghost" size="sm" onClick={() => window.open(window.location.origin + window.location.pathname + '?adminHistory=true', '_blank')} style={{ fontSize: '0.75rem', padding: '4px 10px' }}>
            📜 View All History
          </Button>
        </div>
        <div
          style={{
            overflowX: 'auto',
            display: 'flex',
            gap: 'var(--sp-2)',
            padding: '0 var(--sp-4)',
            scrollbarWidth: 'none',
          }}
        >
          {activeSessions.length === 0 && (
            <span style={{ color: 'var(--tx-3)', fontSize: '0.9rem', padding: '10px 4px', fontWeight: '600' }}>
              No active sessions — start one below
            </span>
          )}
          {activeSessions.map(sess => {
            const isActive = dashboardSession?.id === sess.id;
            return (
              <button
                key={sess.id}
                onClick={() => { setDashboardSession(sess); setPaidUsers({}); setActiveTab('sessions'); }}
                className={isActive ? 'session-pill-active' : 'session-pill'}
                style={{
                  padding: '10px 18px',
                  borderRadius: 'var(--r-full)',
                  border: isActive ? '1px solid var(--gold)' : '1px solid var(--border-strong)',
                  background: isActive ? 'var(--gold-glow)' : 'var(--bg-elevated)',
                  color: isActive ? 'var(--gold)' : 'var(--tx-2)',
                  fontWeight: '700',
                  fontSize: '0.9rem',
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                  transition: 'all var(--dur-base)',
                  fontFamily: 'var(--font-body)',
                  boxShadow: isActive ? 'var(--shadow-gold)' : 'none',
                }}
              >
                {sess.sessionName.split(' Lunch ')[0]}
                <span style={{ 
                  marginLeft: '6px', 
                  fontSize: '0.7rem', 
                  background: isActive ? 'rgba(217,119,6,0.15)' : 'var(--bg-base)', 
                  padding: '2px 6px', 
                  borderRadius: 'var(--r-full)' 
                }}>
                  {sess.personOrders?.length || 0}
                </span>
              </button>
            );
          })}
        </div>

        {/* ── Tab switcher ── */}
        <div style={{ display: 'flex', gap: 'var(--sp-2)', padding: 'var(--sp-2) var(--sp-4) 0', marginTop: 'var(--sp-2)', borderTop: '1px solid var(--border-subtle)' }}>
          <button
            onClick={() => setActiveTab('sessions')}
            style={{
              padding: '6px 14px',
              borderRadius: 'var(--r-md)',
              border: 'none',
              background: activeTab === 'sessions' ? 'var(--gold-glow)' : 'transparent',
              color: activeTab === 'sessions' ? 'var(--gold)' : 'var(--tx-3)',
              fontWeight: '700',
              fontSize: '0.85rem',
              cursor: 'pointer',
              transition: 'all var(--dur-base)',
              fontFamily: 'var(--font-body)',
            }}
          >
            📋 Sessions
          </button>
          <button
            onClick={() => setActiveTab('management')}
            style={{
              padding: '6px 14px',
              borderRadius: 'var(--r-md)',
              border: 'none',
              background: activeTab === 'management' ? 'var(--gold-glow)' : 'transparent',
              color: activeTab === 'management' ? 'var(--gold)' : 'var(--tx-3)',
              fontWeight: '700',
              fontSize: '0.85rem',
              cursor: 'pointer',
              transition: 'all var(--dur-base)',
              fontFamily: 'var(--font-body)',
            }}
          >
            🏪 Management
          </button>
        </div>
      </div>

      <main style={{ padding: 'var(--sp-4)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-6)' }}>

        {activeTab === 'management' ? (
          <RestaurantManager />
        ) : dashboardSession ? (
          <>
            {/* ── Session header ── */}
            <Card variant="raised" style={{ padding: 'var(--sp-5)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--sp-4)', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <h1
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: '1.75rem',
                      color: 'var(--tx-1)',
                      margin: 0,
                    }}
                  >
                    {dashboardSession.sessionName}
                  </h1>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '8px', flexWrap: 'wrap' }}>
                    <StatusBadge status={dashboardSession.status} />
                    <span style={{ color: 'var(--tx-3)', fontSize: '0.85rem', fontWeight: '600' }}>
                      {dashboardSession.personOrders.length} people
                    </span>
                  </div>
                </div>
              </div>

              {isSent && (
                <div
                  style={{
                    padding: '14px',
                    background: 'var(--green-dim)',
                    color: 'var(--green)',
                    borderRadius: 'var(--r-md)',
                    textAlign: 'center',
                    fontWeight: '700',
                    fontSize: '0.95rem',
                    marginBottom: '12px',
                  }}
                >
                  ✅ Order sent to restaurant
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px' }}>
                {!isSent && (
                  <Button
                    variant="ghost"
                    onClick={handleToggleLock}
                    style={{
                      borderColor: isOpen ? 'var(--red)' : 'var(--gold)',
                      color: isOpen ? 'var(--red)' : 'var(--gold)',
                      height: '52px',
                    }}
                  >
                    {isOpen ? '🔒 Lock Session' : '🔓 Reopen'}
                  </Button>
                )}
                {!isSent && dashboardSession.personOrders.length > 0 && (
                  <Button
                    onClick={handleSendToWhatsApp}
                    style={{ background: 'var(--green)', color: 'white', border: 'none', height: '52px' }}
                  >
                    Send Summary 🚀
                  </Button>
                )}
                <Button
                  variant="ghost"
                  onClick={handleDeleteSession}
                  style={{ borderColor: 'var(--red)', color: 'var(--red)', height: '52px' }}
                >
                  🗑 Delete
                </Button>
              </div>
            </Card>

            {/* ── Live aggregation ── */}
            {Object.keys(aggregation).length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--tx-3)', fontWeight: '800', letterSpacing: '0.08em' }}>
                    📊 Kitchen view
                  </h3>
                </div>
                <div
                  style={{
                    display: 'flex',
                    gap: 'var(--sp-3)',
                    overflowX: 'auto',
                    paddingBottom: 'var(--sp-2)',
                    scrollbarWidth: 'none',
                  }}
                >
                  {SIZES.filter(s => aggregation[s]).map(size => (
                    <Card
                      key={size}
                      style={{ minWidth: '160px', flexShrink: 0, padding: 'var(--sp-4)', background: 'var(--bg-elevated)' }}
                    >
                      <div
                        style={{
                          fontWeight: '800',
                          marginBottom: '8px',
                          color: 'var(--gold)',
                          borderBottom: '1px solid var(--border-subtle)',
                          paddingBottom: '6px',
                          fontSize: '0.9rem',
                        }}
                      >
                        {size}
                      </div>
                      {Object.entries(aggregation[size]).map(([item, count]) => (
                        <div
                          key={item}
                          style={{
                            fontSize: '0.825rem',
                            color: 'var(--tx-2)',
                            marginBottom: '4px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            gap: '12px',
                          }}
                        >
                          <span>{item}</span>
                          <span style={{ fontWeight: '800', color: 'var(--tx-1)' }}>×{count}</span>
                        </div>
                      ))}
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* ── Individual orders ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--tx-3)', fontWeight: '800', letterSpacing: '0.08em' }}>
                  👤 Participants
                </h3>
                {!isSent && dashboardSession.personOrders.length > 0 && (
                  <button
                    onClick={handleBulkApprove}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--gold)',
                      fontWeight: '700',
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                      fontFamily: 'var(--font-body)',
                    }}
                  >
                    ✓ Bulk Approve
                  </button>
                )}
              </div>

              {dashboardSession.personOrders.length === 0 ? (
                <div
                  style={{
                    padding: '48px',
                    textAlign: 'center',
                    color: 'var(--tx-3)',
                    background: 'var(--bg-elevated)',
                    borderRadius: 'var(--r-lg)',
                    border: '1px dashed var(--border-default)',
                    fontSize: '0.95rem',
                  }}
                >
                  No orders yet — waiting for participants.
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
                  {dashboardSession.personOrders.map((p, idx) => (
                    <Card
                      key={idx}
                      variant="flat"
                      style={{
                        padding: 'var(--sp-4)',
                        borderLeft: `4px solid ${p.status === 'CONFIRMED' ? 'var(--green)' : 'var(--gold)'}`,
                        borderRadius: 0,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--sp-3)' }}>
                        <div style={{ fontWeight: '800', fontSize: '1rem', color: 'var(--tx-1)' }}>{p.name}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <span style={{ fontWeight: '800', color: 'var(--tx-1)' }}>{p.subtotal}ج</span>
                          {!isSent && (
                            <button
                              onClick={() => handleEvictUser(p.name)}
                              title={`Remove ${p.name}`}
                              style={{
                                background: 'var(--red-dim)',
                                color: 'var(--red)',
                                border: 'none',
                                width: '28px',
                                height: '28px',
                                borderRadius: '50%',
                                cursor: 'pointer',
                                fontSize: '14px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              ×
                            </button>
                          )}
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {p.textOrder ? (
                          <>
                            <div style={{ fontSize: '0.9rem', color: 'var(--tx-1)', whiteSpace: 'pre-wrap', lineHeight: 1.4, background: 'var(--bg-base)', padding: '8px', borderRadius: 'var(--r-sm)' }}>
                              {p.textOrder}
                            </div>
                            {!isSent && (
                              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '8px' }}>
                                <span style={{ fontSize: '0.75rem', color: 'var(--tx-3)', fontWeight: '700' }}>Price:</span>
                                <input
                                  type="number"
                                  defaultValue={p.subtotal || 0}
                                  onBlur={(e) => {
                                    const val = parseFloat(e.target.value) || 0;
                                    if (val !== p.subtotal) {
                                      handleUpdatePayment(p.name, { subtotal: val });
                                    }
                                  }}
                                  style={{
                                    width: '80px',
                                    padding: '4px 8px',
                                    borderRadius: 'var(--r-sm)',
                                    border: '1px solid var(--border-default)',
                                    background: 'var(--bg-elevated)',
                                    color: 'var(--tx-1)',
                                    fontSize: '0.85rem'
                                  }}
                                />
                                <span style={{ fontSize: '0.75rem', color: 'var(--tx-3)' }}>ج</span>
                              </div>
                            )}
                          </>
                        ) : (
                          p.items.map((i, iIdx) => (
                            <div
                              key={iIdx}
                              style={{
                                fontSize: '0.825rem',
                                color: i.option === 'إضافة' ? 'var(--green)' : 'var(--tx-2)',
                                display: 'flex',
                                justifyContent: 'space-between',
                              }}
                            >
                              <span>
                                {i.option === 'إضافة' ? `+ ${i.name}` : `• ${i.name} (${i.size})`}
                              </span>
                              <span>{i.price}ج</span>
                            </div>
                          ))
                        )}
                      </div>
                      {p.notes && (
                        <div style={{ marginTop: '10px', fontSize: '0.775rem', color: 'var(--gold)', fontStyle: 'italic' }}>
                          📝 {p.notes}
                        </div>
                      )}
                    </Card>
                  ))}
                </div>
              )}
            </div>

            {/* ── Payment summary ── */}
            {costSplit.length > 0 && (
              <Card variant="raised" style={{ padding: 'var(--sp-5)' }}>
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', marginBottom: 'var(--sp-4)', color: 'var(--tx-1)' }}>
                  💸 Settlement
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
                  {costSplit.map(row => (
                    <div
                      key={row.name}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        paddingBottom: 'var(--sp-3)',
                        borderBottom: '1px solid var(--border-subtle)',
                        flexWrap: 'wrap',
                        gap: '8px',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: '700', color: 'var(--tx-1)', fontSize: '0.95rem' }}>{row.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--tx-3)', marginTop: '2px' }}>
                          {row.itemsTotal}ج + {row.deliveryShare.toFixed(1)}ج delivery
                          {(row.discountPercent > 0 || row.flatDiscount > 0) && (
                            <>
                              {row.discountPercent > 0 && ` • -${row.discountPercent}%`}
                              {row.flatDiscount > 0 && ` • -${row.flatDiscount}ج`}
                            </>
                          )}
                        </div>
                        {(row.discountPercent > 0 || row.flatDiscount > 0) && (
                          <div style={{ fontSize: '0.7rem', color: 'var(--green)', marginTop: '2px' }}>
                            ⬇️ Discounted + Ceiled
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '260px' }}>
                        {/* Per-user discount controls */}
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '0.7rem', color: 'var(--tx-3)', fontWeight: '700' }}>Disc:</span>
                          <Button size="xs" variant={row.discountPercent === 0 ? 'secondary' : 'ghost'} onClick={() => handleUpdatePayment(row.name, { discountPercent: 0 })} style={{ padding: '2px 8px', fontSize: '0.7rem' }}>0%</Button>
                          <Button size="xs" variant={row.discountPercent === 10 ? 'secondary' : 'ghost'} onClick={() => handleUpdatePayment(row.name, { discountPercent: 10 })} style={{ padding: '2px 8px', fontSize: '0.7rem' }}>10%</Button>
                          <Button size="xs" variant={row.discountPercent === 20 ? 'secondary' : 'ghost'} onClick={() => handleUpdatePayment(row.name, { discountPercent: 20 })} style={{ padding: '2px 8px', fontSize: '0.7rem' }}>20%</Button>
                          <input
                            type="number"
                            placeholder="Comp"
                            value={row.flatDiscount || 0}
                            onChange={(e) => handleUpdatePayment(row.name, { flatDiscountPerUser: parseFloat(e.target.value) || 0 })}
                            style={{ width: '55px', padding: '2px 6px', borderRadius: 'var(--r-sm)', border: '1px solid var(--border-default)', fontSize: '0.75rem', background: 'var(--bg-elevated)', color: 'var(--tx-1)' }}
                          />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', justifyContent: 'flex-end' }}>
                          <span style={{ fontWeight: '800', color: 'var(--gold)', fontSize: '1.1rem' }}>
                            {row.grandTotal.toFixed(1)}ج
                          </span>
                          <button
                            onClick={() => handleUpdatePayment(row.name, { isPaid: !row.isPaid })}
                            style={{
                              height: '36px',
                              padding: '0 12px',
                              borderRadius: 'var(--r-md)',
                              border: '1px solid',
                              borderColor: row.isPaid ? 'var(--green)' : 'var(--border-strong)',
                              background: row.isPaid ? 'var(--green-dim)' : 'transparent',
                              color: row.isPaid ? 'var(--green)' : 'var(--tx-3)',
                              fontWeight: '700',
                              fontSize: '0.85rem',
                              cursor: 'pointer',
                              fontFamily: 'var(--font-body)',
                              transition: 'all var(--dur-base)',
                            }}
                          >
                            {row.isPaid ? '✓ Paid' : 'Unpaid'}
                          </button>
                        </div>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                          <select
                            value={row.paymentMethod}
                            onChange={(e) => handleUpdatePayment(row.name, { paymentMethod: e.target.value })}
                            style={{ padding: '4px 8px', borderRadius: 'var(--r-sm)', border: '1px solid var(--border-default)', fontSize: '0.8rem', background: 'var(--bg-elevated)', color: 'var(--tx-2)' }}
                          >
                            <option value="">Method...</option>
                            <option value="CASH">Cash</option>
                            <option value="VODAFONE">Vodafone</option>
                            <option value="INSTAPAY">Instapay</option>
                          </select>
                          {row.paymentMethod === 'CASH' && (
                            <input
                              type="number"
                              defaultValue={row.amountReceived}
                              onBlur={(e) => handleUpdatePayment(row.name, { amountReceived: parseFloat(e.target.value) || 0 })}
                              placeholder="Received (ج)"
                              style={{ width: '85px', padding: '4px 6px', borderRadius: 'var(--r-sm)', border: '1px solid var(--border-default)', fontSize: '0.8rem', background: 'var(--bg-elevated)', color: 'var(--tx-1)' }}
                            />
                          )}
                        </div>
                        {row.paymentMethod === 'CASH' && row.amountReceived > 0 && (
                          <div style={{ fontSize: '0.75rem', textAlign: 'right', color: 'var(--tx-2)', marginTop: '2px' }}>
                            Change owed: <span style={{ fontWeight: '800', color: row.amountReceived >= row.grandTotal ? 'var(--red)' : 'var(--tx-3)' }}>{(row.amountReceived - row.grandTotal).toFixed(1)}ج</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 'var(--sp-2)', fontWeight: '800', fontSize: '1.2rem' }}>
                    <span style={{ color: 'var(--tx-1)' }}>Grand Total</span>
                    <span style={{ color: 'var(--gold)' }}>{costSplit.reduce((sum, r) => sum + r.grandTotal, 0)}ج</span>
                  </div>
                </div>
              </Card>
            )}
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: '80px var(--sp-4)', color: 'var(--tx-3)' }}>
            <div style={{ fontSize: '3.5rem', marginBottom: 'var(--sp-4)' }}>📋</div>
            <p style={{ fontSize: '1.1rem' }}>Select a session above or start a new one below.</p>
          </div>
        )}

        {activeTab === 'sessions' && (
        <>
        {/* ── Start new session ── */}
        <Card variant="raised" style={{ padding: 'var(--sp-5)' }}>
          <h3
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '1.5rem',
              marginBottom: 'var(--sp-4)',
              color: 'var(--tx-1)',
            }}
          >
            New Session
          </h3>
          <div style={{ marginBottom: 'var(--sp-4)' }} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px' }}>
            {restaurants.map(rest => (
              <button
                key={rest.id}
                onClick={() => handleStartSession(rest)}
                style={{
                  padding: '16px 12px',
                  borderRadius: 'var(--r-lg)',
                  border: '1px solid var(--border-default)',
                  background: 'var(--bg-elevated)',
                  color: 'var(--tx-1)',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'border-color var(--dur-base)',
                  fontFamily: 'var(--font-body)',
                }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--gold)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border-default)')}
              >
                <span style={{ fontSize: '1.5rem' }}>
                  {rest.cuisineType === 'PITZA'
                    ? '🍕'
                    : rest.cuisineType === 'BURGER'
                      ? '🍔'
                      : rest.cuisineType === 'CHICKEN'
                        ? '🍗'
                        : '🍴'}
                </span>
                <span style={{ fontSize: '0.875rem', fontWeight: '700', textAlign: 'center' }}>{rest.name}</span>
              </button>
            ))}
          </div>
        </Card>

        {/* ── Session history ── */}
        <Card
          variant="flat"
          style={{ padding: 'var(--sp-4)', cursor: 'pointer' }}
          onClick={() => {
            setShowHistory(h => !h);
            if (!showHistory) fetchHistory();
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: '800', color: 'var(--tx-2)', fontSize: '0.9rem' }}>
              📜 Session History
            </span>
            <span style={{ color: 'var(--gold)', fontSize: '0.85rem' }}>
              {showHistory ? 'Collapse ▲' : 'View Past ▼'}
            </span>
          </div>

          {showHistory && (
            <div style={{ marginTop: 'var(--sp-4)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {sessionHistory.length === 0 ? (
                <p style={{ color: 'var(--tx-3)', fontSize: '0.85rem', fontStyle: 'italic' }}>No past sessions found.</p>
              ) : (
                sessionHistory.map(sess => (
                  <div
                    key={sess.id}
                    onClick={e => { e.stopPropagation(); setDashboardSession(sess); setPaidUsers({}); }}
                    style={{
                      padding: '12px 14px',
                      background: 'var(--bg-elevated)',
                      borderRadius: 'var(--r-md)',
                      border: '1px solid var(--border-subtle)',
                      cursor: 'pointer',
                      transition: 'border-color var(--dur-base)',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--gold)')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border-subtle)')}
                  >
                    <div style={{ fontWeight: '700', color: 'var(--tx-1)', fontSize: '0.875rem' }}>
                      {sess.sessionName}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--tx-3)', marginTop: '3px' }}>
                      {sess.status} • {sess.personOrders?.length ?? 0} orders • {sess.total}ج
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </Card>
        </>
        )}

      </main>
    </div>
  );
}