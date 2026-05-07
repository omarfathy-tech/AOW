import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
  const [selectedHistorySession, setSelectedHistorySession] = useState(null);
  const [activityLog, setActivityLog] = useState([]);
  const prevOrdersRef = useRef([]);
  const mutatingRef = useRef(false);
  const [waSummary, setWaSummary] = useState(null);
  const showToast = useToast();

  // One-time init: pick first active session when list loads
  useEffect(() => {
    if (activeSessions.length > 0 && !dashboardSession) {
      setDashboardSession(activeSessions[0]);
    }
  }, [activeSessions, dashboardSession]);
  const [paymentOverrides, setPaymentOverrides] = useState({});

  const normalizeSession = useCallback((s) => ({
    ...s,
    personOrders: (s.personOrders || []).map(p => ({
      ...p,
      isPaid: p.isPaid ?? p.paid ?? false,
    }))
  }), []);

  // ─── Per-session detail poller ──────────────────────────────────
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
          if (!isCancelled && !mutatingRef.current) {
            failures = 0;
            setDashboardSession(normalizeSession(data));
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

  // ─── Activity feed ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!dashboardSession) return;
    const prev = prevOrdersRef.current;
    const curr = dashboardSession.personOrders || [];

    curr.forEach(p => {
      const wasHere = prev.find(o => o.name === p.name);
      if (!wasHere) {
        setActivityLog(log => [{ time: new Date(), text: `${p.name} joined` }, ...log].slice(0, 20));
      } else if (JSON.stringify(wasHere.items) !== JSON.stringify(p.items)) {
        setActivityLog(log => [{ time: new Date(), text: `${p.name} updated their order` }, ...log].slice(0, 20));
      }
    });

    prev.forEach(p => {
      if (!curr.find(o => o.name === p.name)) {
        setActivityLog(log => [{ time: new Date(), text: `${p.name} was removed` }, ...log].slice(0, 20));
      }
    });

    prevOrdersRef.current = curr;
  }, [dashboardSession]);

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
      .then(data => setDashboardSession(normalizeSession(data)))
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
      setActiveTab('sessions');
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
  if (!dashboardSession) return;

  setPaymentOverrides(prev => ({
    ...prev,
    [personName]: { ...(prev[personName] || {}), ...payload }
  }));

  try {
    const url = `${API}/admin/sessions/${dashboardSession.id}/orders/${encodeURIComponent(personName)}/payment`;
    const res = await fetch(url, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      const updated = await res.json();
      setDashboardSession(normalizeSession(updated));
      setPaymentOverrides(prev => {
        const next = { ...prev };
        delete next[personName];
        return next;
      });
    } else {
      const errText = await res.text();
      console.error('Payment update failed:', res.status, errText);
      setPaymentOverrides(prev => {
        const next = { ...prev };
        delete next[personName];
        return next;
      });
      refreshCurrentSession(dashboardSession.id);
    }
  } catch (err) {
    console.error('Payment update exception:', err);
    setPaymentOverrides(prev => {
      const next = { ...prev };
      delete next[personName];
      return next;
    });
    refreshCurrentSession(dashboardSession.id);
  }
};
  const buildWaSummary = () => {
    if (!dashboardSession) return '';
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
    const totalWithCeil = dashboardSession.personOrders.reduce((sum, p) => {
      const pDiscPct = p.discountPercent || 0;
      const pFlatDisc = p.flatDiscountPerUser || 0;
      const pBase = p.subtotal + dlvPP;
      let pAfterPct = pBase;
      if (pDiscPct > 0) pAfterPct = pBase * (1 - pDiscPct / 100);
      let pAfterFlat = pAfterPct - pFlatDisc;
      return sum + Math.max(0, Math.ceil(pAfterFlat));
    }, 0);
    lines.push(`💵 *Grand Total: ${totalWithCeil}ج*`);
    return lines.join('\n');
  };

  const handlePreviewSummary = () => {
    if (!dashboardSession) return;
    if (dashboardSession.status === 'OPEN') {
      fetch(`${API}/admin/sessions/${dashboardSession.id}/close`, {
        method: 'PATCH',
        headers: getAuthHeaders(false),
      });
    }
    setWaSummary(buildWaSummary());
  };

  const handleConfirmSend = async () => {
    if (!dashboardSession || !waSummary) return;
    const encodedText = encodeURIComponent(waSummary);
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
    setWaSummary(null);
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

  const handleSetDeadline = async (minutes) => {
    if (!dashboardSession) return;
    try {
      const res = await fetch(`${API}/admin/sessions/${dashboardSession.id}/deadline`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ deadlineMinutes: minutes }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const updated = await res.json();
      setDashboardSession(updated);
      showToast(`Deadline set to ${minutes} min`, 'success');
    } catch (err) {
      console.error(err);
      showToast('Failed to set deadline', 'error');
    }
  };

  const handleApproveOrder = async (orderId) => {
    if (!dashboardSession || !orderId) return;
    try {
      await fetch(`${API}/orders/bulk/status`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ orderIds: [orderId], status: 'ACCEPTED' }),
      });
      refreshCurrentSession(dashboardSession.id);
    } catch (err) {
      console.error(err);
    }
  };

  // ─── Derived state ────────────────────────────────────────────────────────
  const { aggregation, byExtra } = useMemo(() => {
    if (!dashboardSession) return { aggregation: {}, byExtra: {} };
    const bySize = {};
    const extras = {};
    dashboardSession.personOrders.forEach(p => {
      p.items.forEach(i => {
        if (i.option === 'إضافة') {
          extras[i.name] = (extras[i.name] || 0) + (i.quantity || 1);
          return;
        }
        if (!bySize[i.size]) bySize[i.size] = {};
        const lbl =
          i.option === 'عادي' || !i.option ? i.name : `${i.name} ${i.option}`;
        bySize[i.size][lbl] = (bySize[i.size][lbl] || 0) + 1;
      });
    });
    return { aggregation: bySize, byExtra: extras };
  }, [dashboardSession]);

  const costSplit = useMemo(() => {
  if (!dashboardSession?.personOrders?.length) return [];
  const dlvPP = dashboardSession.deliveryFee / dashboardSession.personOrders.length;
  return dashboardSession.personOrders.map(p => {
    const overrides = paymentOverrides[p.name] || {};   // ← merge overrides
    const merged = { ...p, ...overrides };
    const discPct = merged.discountPercent || 0;
    const flatDisc = merged.flatDiscountPerUser || 0;
    const base = merged.subtotal + dlvPP;
    let afterPct = discPct > 0 ? base * (1 - discPct / 100) : base;
    let afterFlat = afterPct - flatDisc;
    const grandTotal = Math.max(0, Math.ceil(afterFlat));
    return {
      name: merged.name,
      itemsTotal: merged.subtotal,
      deliveryShare: dlvPP,
      discountPercent: discPct,
      flatDiscount: flatDisc,
      grandTotal,
      isPaid: merged.isPaid ?? merged.paid ?? false,
      paymentMethod: merged.paymentMethod || '',
      amountReceived: merged.amountReceived || ''
    };
  });
}, [dashboardSession, paymentOverrides]);   // ← add paymentOverrides dep
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
          <Button variant="ghost" size="sm" onClick={() => { setActiveTab('history'); fetchHistory(); }} style={{ fontSize: '0.75rem', padding: '4px 10px' }}>
            📜 History
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
                  {sess.personOrders?.length || 0} • {sess.total || 0}ج
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
          <button
            onClick={() => { setActiveTab('history'); fetchHistory(); }}
            style={{
              padding: '6px 14px',
              borderRadius: 'var(--r-md)',
              border: 'none',
              background: activeTab === 'history' ? 'var(--gold-glow)' : 'transparent',
              color: activeTab === 'history' ? 'var(--gold)' : 'var(--tx-3)',
              fontWeight: '700',
              fontSize: '0.85rem',
              cursor: 'pointer',
              transition: 'all var(--dur-base)',
              fontFamily: 'var(--font-body)',
            }}
          >
            📜 History
          </button>
        </div>
      </div>

      <main style={{ padding: 'var(--sp-4)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-6)' }}>

        {activeTab === 'management' ? (
          <RestaurantManager />
        ) : activeTab === 'history' ? (
          <>
            {selectedHistorySession ? (
              <Card variant="raised" style={{ padding: 'var(--sp-5)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: 'var(--sp-4)' }}>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedHistorySession(null)}>
                    ← Back
                  </Button>
                  <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', margin: 0, color: 'var(--tx-1)' }}>
                    {selectedHistorySession.sessionName}
                  </h3>
                  <StatusBadge status={selectedHistorySession.status} />
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-4)' }}>
                  <div style={{ flex: 1, minWidth: '220px' }}>
                    <h4 style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--tx-3)', fontWeight: 800, letterSpacing: '0.08em', marginBottom: 8 }}>Orders</h4>
                    {(selectedHistorySession.personOrders || []).map((p, i) => (
                      <div key={i} style={{ padding: '8px 0', borderBottom: '1px solid var(--border-subtle)', fontSize: '0.85rem' }}>
                        <span style={{ fontWeight: 700, color: 'var(--tx-1)' }}>{p.name}</span>
                        <span style={{ color: 'var(--tx-3)', marginLeft: 8 }}>{p.subtotal}ج</span>
                        {p.textOrder && <div style={{ color: 'var(--tx-2)', marginTop: 4 }}>{p.textOrder}</div>}
                      </div>
                    ))}
                  </div>
                  <div style={{ minWidth: '200px' }}>
                    <h4 style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--tx-3)', fontWeight: 800, letterSpacing: '0.08em', marginBottom: 8 }}>Totals</h4>
                    <div style={{ fontSize: '0.9rem', color: 'var(--tx-2)' }}>
                      <div>Subtotal: <span style={{ fontWeight: 800, color: 'var(--tx-1)' }}>{(selectedHistorySession.total || 0) - (selectedHistorySession.deliveryFee || 0)}ج</span></div>
                      <div>Delivery: <span style={{ fontWeight: 800, color: 'var(--tx-1)' }}>{selectedHistorySession.deliveryFee || 0}ج</span></div>
                      <div style={{ marginTop: 8, fontSize: '1.1rem', fontWeight: 800, color: 'var(--gold)' }}>Total: {selectedHistorySession.total || 0}ج</div>
                    </div>
                  </div>
                </div>
              </Card>
            ) : (
              <Card variant="raised" style={{ padding: 'var(--sp-5)' }}>
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', marginBottom: 'var(--sp-4)', color: 'var(--tx-1)' }}>
                  📜 Session History
                </h3>
                {(() => {
                  const last7 = sessionHistory
                    .filter(s => new Date(s.createdAt) > new Date(Date.now() - 7 * 86400000))
                    .reduce((acc, s) => {
                      const day = new Date(s.createdAt).toLocaleDateString('en', { weekday: 'short' });
                      acc[day] = (acc[day] || 0) + (s.total || 0);
                      return acc;
                    }, {});
                  const maxVal = Math.max(...Object.values(last7), 1);
                  return Object.keys(last7).length > 0 ? (
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 80, marginBottom: 20 }}>
                      {Object.entries(last7).map(([day, val]) => (
                        <div key={day} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                          <div style={{ width: '100%', background: 'var(--gold)', height: `${(val / maxVal) * 60}px`, borderRadius: '4px 4px 0 0', minHeight: 4 }} />
                          <div style={{ fontSize: '0.65rem', color: 'var(--tx-3)' }}>{day}</div>
                        </div>
                      ))}
                    </div>
                  ) : null;
                })()}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {sessionHistory.length === 0 ? (
                    <p style={{ color: 'var(--tx-3)', fontSize: '0.85rem', fontStyle: 'italic' }}>No past sessions found.</p>
                  ) : (
                    sessionHistory.map(sess => (
                      <div
                        key={sess.id}
                        onClick={() => setSelectedHistorySession(sess)}
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
              </Card>
            )}
          </>
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
                    {dashboardSession.deadline && isOpen && (
                      <Countdown deadline={dashboardSession.deadline} />
                    )}
                  </div>
                </div>
              </div>

              {/* ── Stat bar ── */}
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '12px', marginBottom: '12px' }}>
                {(() => {
                  const subtotal = (dashboardSession.total || 0) - (dashboardSession.deliveryFee || 0);
                  const paidCount = costSplit.filter(r => r.isPaid).length;
                  const outstanding = costSplit.filter(r => !r.isPaid).reduce((s, r) => s + r.grandTotal, 0);
                  return [
                    { label: 'Orders', value: dashboardSession.personOrders.length, color: 'var(--tx-2)' },
                    { label: 'Subtotal', value: `${subtotal.toFixed(0)}ج`, color: 'var(--tx-1)' },
                    { label: 'Paid', value: `${paidCount}/${costSplit.length}`, color: 'var(--green)' },
                    { label: 'Outstanding', value: `${outstanding.toFixed(0)}ج`, color: outstanding > 0 ? 'var(--red)' : 'var(--green)' },
                  ].map(chip => (
                    <div key={chip.label} style={{ background: 'var(--bg-elevated)', padding: '8px 14px', borderRadius: 'var(--r-md)', border: '1px solid var(--border-subtle)' }}>
                      <div style={{ fontSize: '0.7rem', color: 'var(--tx-3)', fontWeight: 700 }}>{chip.label}</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 800, color: chip.color }}>{chip.value}</div>
                    </div>
                  ));
                })()}
              </div>

              {/* ── Deadline setter ── */}
              {isOpen && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--tx-3)', fontWeight: 700 }}>Deadline:</span>
                  {[15, 30, 45].map(m => (
                    <button key={m} onClick={() => handleSetDeadline(m)}
                      style={{ padding: '4px 10px', borderRadius: 'var(--r-sm)', border: '1px solid var(--border-default)', background: deadlineMinutes === m ? 'var(--gold-glow)' : 'var(--bg-elevated)', color: deadlineMinutes === m ? 'var(--gold)' : 'var(--tx-2)', fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
                      {m}m
                    </button>
                  ))}
                  <input type="number" min={1} max={180} value={deadlineMinutes}
                    onChange={e => setDeadlineMinutes(parseInt(e.target.value) || 15)}
                    style={{ width: '50px', padding: '4px 6px', borderRadius: 'var(--r-sm)', border: '1px solid var(--border-default)', background: 'var(--bg-elevated)', color: 'var(--tx-1)', fontSize: '0.75rem' }}
                  />
                  <Button size="xs" onClick={() => handleSetDeadline(deadlineMinutes)}>Set</Button>
                </div>
              )}

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
                {dashboardSession.personOrders.length > 0 && (
                  <Button
                    onClick={handlePreviewSummary}
                    style={{ background: isSent ? 'var(--gold)' : 'var(--green)', color: 'white', border: 'none', height: '52px' }}
                  >
                    {isSent ? `Resend to ${dashboardSession.personOrders.length} people 🚀` : `Send to ${dashboardSession.personOrders.length} people 🚀`}
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
                      style={{
                        minWidth: '160px',
                        flexShrink: 0,
                        padding: 'var(--sp-4)',
                        background: 'var(--bg-elevated)',
                        borderLeft: `4px solid ${SIZE_COLORS[size] || 'var(--gold)'}`,
                        position: 'relative',
                      }}
                    >
                      <span style={{
                        position: 'absolute', top: 8, right: 8,
                        background: SIZE_COLORS[size] || 'var(--gold)',
                        color: 'white', borderRadius: 99, fontSize: '0.7rem',
                        padding: '2px 7px', fontWeight: 800,
                      }}>
                        {Object.values(aggregation[size]).reduce((a, b) => a + b, 0)}
                      </span>
                      <div
                        style={{
                          fontWeight: '800',
                          marginBottom: '8px',
                          color: SIZE_COLORS[size] || 'var(--gold)',
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
                  {Object.keys(byExtra).length > 0 && (
                    <Card style={{
                      minWidth: '140px', flexShrink: 0, padding: 'var(--sp-4)',
                      background: 'var(--bg-elevated)', borderLeft: '4px solid var(--green)',
                    }}>
                      <div style={{
                        fontWeight: 800, marginBottom: 8, color: 'var(--green)',
                        borderBottom: '1px solid var(--border-subtle)', paddingBottom: 6,
                      }}>
                        إضافات
                      </div>
                      {Object.entries(byExtra).map(([item, count]) => (
                        <div key={item} style={{
                          fontSize: '0.825rem', display: 'flex',
                          justifyContent: 'space-between', gap: 12, marginBottom: 4,
                        }}>
                          <span style={{ color: 'var(--tx-2)' }}>{item}</span>
                          <span style={{ fontWeight: 800, color: 'var(--green)' }}>×{count}</span>
                        </div>
                      ))}
                    </Card>
                  )}
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
                  {dashboardSession.personOrders.map((originalP, idx) => {
                    const p = { ...originalP, ...(paymentOverrides[originalP.name] || {}) };
                    return (
        <Card
          key={idx}
          variant="flat"
          style={{
            padding: 'var(--sp-4)',
            borderLeft: `4px solid ${p.status === 'CONFIRMED' ? 'var(--green)' : p.status === 'PENDING' ? 'var(--gold)' : 'var(--border-default)'}`,
            borderRadius: 0,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--sp-3)' }}>
            <div style={{ fontWeight: '800', fontSize: '1rem', color: 'var(--tx-1)' }}>{p.name}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontWeight: '800', color: 'var(--tx-1)' }}>{p.subtotal}ج</span>
              {!isSent && p.status !== 'CONFIRMED' && p.id && (
                <button
                  onClick={() => handleApproveOrder(p.id)}
                  title={`Approve ${p.name}`}
                  style={{
                    background: 'var(--green-dim)',
                    color: 'var(--green)',
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
                  ✓
                </button>
              )}
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
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '8px' }}>
            <select
              value={p.paymentMethod || ''}
              onChange={(e) => handleUpdatePayment(p.name, { paymentMethod: e.target.value })}
              style={{
                fontSize: '0.75rem', padding: '4px 8px', borderRadius: 'var(--r-sm)',
                border: '1px solid var(--border-default)', background: 'var(--bg-base)',
                color: 'var(--tx-2)', fontFamily: 'var(--font-body)', cursor: 'pointer',
              }}
            >
              <option value="">💳 Method...</option>
              <option value="CASH">💵 Cash</option>
              <option value="VODAFONE">📱 Vodafone</option>
              <option value="INSTAPAY">💳 Instapay</option>
            </select>
            {p.paymentMethod === 'CASH' && (
              <input
                type="number"
                defaultValue={p.amountReceived || 0}
                onBlur={(e) => handleUpdatePayment(p.name, { amountReceived: parseFloat(e.target.value) || 0 })}
                placeholder="Received"
                style={{
                  width: '60px', padding: '4px 6px', borderRadius: 'var(--r-sm)',
                  border: '1px solid var(--border-default)', fontSize: '0.75rem',
                  background: 'var(--bg-base)', color: 'var(--tx-1)',
                }}
              />
            )}
            <button
              onClick={() => handleUpdatePayment(p.name, { isPaid: !p.isPaid })}
              style={{
                fontSize: '0.75rem', fontWeight: 800, padding: '5px 12px', borderRadius: 'var(--r-md)',
                border: '2px solid',
                borderColor: p.isPaid ? 'var(--green)' : 'var(--red)',
                background: p.isPaid ? 'var(--green-dim)' : 'var(--red-dim)',
                color: p.isPaid ? 'var(--green)' : 'var(--red)',
                cursor: 'pointer',
                fontFamily: 'var(--font-body)',
                transition: 'all var(--dur-base)',
                minWidth: '72px',
              }}
            >
              {p.isPaid ? '✓ Paid' : '✗ Unpaid'}
            </button>
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
                        width: '80px', padding: '4px 8px', borderRadius: 'var(--r-sm)',
                        border: '1px solid var(--border-default)', background: 'var(--bg-elevated)',
                        color: 'var(--tx-1)', fontSize: '0.85rem'
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
                    {i.option === 'إضافة'
                      ? `+ ${i.name}`
                      : <span>• {i.name} <span style={{ color: SIZE_COLORS[i.size] || 'var(--tx-2)', fontWeight: 700 }}>({i.size})</span></span>}
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
      );
    })}
  </div>
)}
            </div>

            {/* ── Activity feed ── */}
            <Card variant="flat" style={{ padding: 'var(--sp-4)' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                🟢 Live Activity
              </div>
              {activityLog.slice(0, 6).map((e, i) => (
                <div key={i} style={{ fontSize: '0.825rem', color: 'var(--tx-2)', padding: '4px 0', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between' }}>
                  <span>{e.text}</span>
                  <span style={{ color: 'var(--tx-3)', fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
                    {e.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                </div>
              ))}
              {activityLog.length === 0 && (
                <div style={{ color: 'var(--tx-3)', fontSize: '0.85rem', fontStyle: 'italic' }}>
                  Waiting for activity...
                </div>
              )}
            </Card>

            {/* ── Cashier / Settlement Panel ── */}
            {costSplit.length > 0 && (() => {
              const totalOwed       = costSplit.reduce((s, r) => s + r.grandTotal, 0);
              const paidRows        = costSplit.filter(r => r.isPaid);
              const unpaidRows      = costSplit.filter(r => !r.isPaid);
              const totalCollected  = paidRows.reduce((s, r) => s + r.grandTotal, 0);
              const totalOutstanding = unpaidRows.reduce((s, r) => s + r.grandTotal, 0);
              const paidPct         = totalOwed > 0 ? (totalCollected / totalOwed) * 100 : 0;
              const allSettled      = costSplit.length > 0 && unpaidRows.length === 0;

              const cashRows    = costSplit.filter(r => r.paymentMethod === 'CASH');
              const digitalRows = costSplit.filter(r => r.paymentMethod === 'INSTAPAY' || r.paymentMethod === 'VODAFONE');
              const totalCashReceived  = cashRows.reduce((s, r) => s + (r.amountReceived || 0), 0);
              const totalDigital       = digitalRows.reduce((s, r) => s + r.grandTotal, 0);
              const totalChangeBack    = cashRows.reduce((s, r) => {
                const change = (r.amountReceived || 0) - r.grandTotal;
                return change > 0 ? s + change : s;
              }, 0);
              const netCashInDrawer    = totalCashReceived - totalChangeBack;

              return (
                <Card variant="raised" style={{ padding: 'var(--sp-5)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>

                  {/* ── Header ── */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                    <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', color: 'var(--tx-1)', margin: 0 }}>
                      💸 Cashier Panel
                    </h3>
                    <span style={{ fontSize: '0.8rem', color: 'var(--tx-3)', fontWeight: 700 }}>
                      {paidRows.length}/{costSplit.length} paid
                    </span>
                  </div>

                  {/* ── All settled banner ── */}
                  {allSettled && (
                    <div style={{
                      background: 'var(--green-dim)', border: '1px solid var(--green)',
                      borderRadius: 'var(--r-md)', padding: '12px 16px',
                      display: 'flex', alignItems: 'center', gap: 10,
                      color: 'var(--green)', fontWeight: 800, fontSize: '1rem',
                    }}>
                      ✅ All settled! Everyone has paid.
                    </div>
                  )}

                  {/* ── Top summary bar ── */}
                  <div style={{
                    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
                    gap: '10px',
                  }}>
                    {[
                      { label: 'Total Order', value: `${totalOwed.toFixed(0)}ج`, color: 'var(--gold)' },
                      { label: 'Collected', value: `${totalCollected.toFixed(0)}ج`, color: 'var(--green)' },
                      { label: 'Outstanding', value: `${totalOutstanding.toFixed(0)}ج`, color: totalOutstanding > 0 ? 'var(--red)' : 'var(--tx-3)' },
                      { label: 'Paid', value: `${paidRows.length}/${costSplit.length}`, color: 'var(--tx-1)' },
                    ].map(stat => (
                      <div key={stat.label} style={{
                        background: 'var(--bg-base)', borderRadius: 'var(--r-md)',
                        padding: '10px 12px', textAlign: 'center', border: '1px solid var(--border-subtle)',
                      }}>
                        <div style={{ fontSize: '1.1rem', fontWeight: 800, color: stat.color }}>{stat.value}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--tx-3)', fontWeight: 700, marginTop: 2 }}>{stat.label}</div>
                      </div>
                    ))}
                  </div>

                  {/* ── Progress bar ── */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: '0.75rem', color: 'var(--tx-3)' }}>
                      <span>{paidPct.toFixed(0)}% collected</span>
                      <span>{totalCollected.toFixed(0)}ج of {totalOwed.toFixed(0)}ج</span>
                    </div>
                    <div style={{ height: 8, background: 'var(--bg-base)', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{
                        width: `${paidPct}%`, height: '100%', borderRadius: 99,
                        background: allSettled ? 'var(--green)' : 'linear-gradient(90deg, var(--green), var(--gold))',
                        transition: 'width 0.5s ease',
                      }} />
                    </div>
                  </div>

                  {/* ── Per-person rows ── */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {costSplit.map(row => {
                      const hasMethod = !!row.paymentMethod;
                      const borderColor = row.isPaid
                        ? 'var(--green)'
                        : hasMethod ? 'var(--gold)' : 'var(--red)';
                      const change = row.paymentMethod === 'CASH' && row.amountReceived > 0
                        ? (row.amountReceived || 0) - row.grandTotal : null;

                      return (
                        <div key={row.name} style={{
                          background: 'var(--bg-elevated)',
                          border: '1px solid var(--border-subtle)',
                          borderLeft: `4px solid ${borderColor}`,
                          borderRadius: 'var(--r-md)',
                          padding: '12px 14px',
                          display: 'flex', flexDirection: 'column', gap: 10,
                        }}>
                          {/* Row header */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                            <div>
                              <div style={{ fontWeight: 800, color: 'var(--tx-1)', fontSize: '0.95rem' }}>{row.name}</div>
                              <div style={{ fontSize: '0.72rem', color: 'var(--tx-3)', marginTop: 2 }}>
                                {row.itemsTotal}ج items + {row.deliveryShare.toFixed(1)}ج delivery
                                {row.discountPercent > 0 && ` • -${row.discountPercent}%`}
                                {row.flatDiscount > 0 && ` • -${row.flatDiscount}ج`}
                              </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <span style={{ fontWeight: 900, color: 'var(--gold)', fontSize: '1.15rem' }}>
                                {row.grandTotal.toFixed(0)}ج
                              </span>
                              {/* Paid toggle */}
                              <button
                                onClick={() => handleUpdatePayment(row.name, { isPaid: !row.isPaid })}
                                style={{
                                  height: 34, padding: '0 14px',
                                  borderRadius: 'var(--r-md)',
                                  border: `2px solid ${row.isPaid ? 'var(--green)' : 'var(--border-strong)'}`,
                                  background: row.isPaid ? 'var(--green-dim)' : 'transparent',
                                  color: row.isPaid ? 'var(--green)' : 'var(--tx-3)',
                                  fontWeight: 800, fontSize: '0.8rem',
                                  cursor: 'pointer', fontFamily: 'var(--font-body)',
                                  transition: 'all 0.15s', minWidth: 72,
                                }}
                              >
                                {row.isPaid ? '✓ Paid' : '✗ Unpaid'}
                              </button>
                            </div>
                          </div>

                          {/* Discount controls */}
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '0.7rem', color: 'var(--tx-3)', fontWeight: 700 }}>Disc:</span>
                            {[0, 10, 20].map(pct => (
                              <button key={pct}
                                onClick={() => handleUpdatePayment(row.name, { discountPercent: pct })}
                                style={{
                                  padding: '2px 9px', fontSize: '0.7rem', borderRadius: 'var(--r-sm)',
                                  border: '1px solid',
                                  borderColor: row.discountPercent === pct ? 'var(--gold)' : 'var(--border-default)',
                                  background: row.discountPercent === pct ? 'rgba(255,200,50,0.15)' : 'var(--bg-base)',
                                  color: row.discountPercent === pct ? 'var(--gold)' : 'var(--tx-3)',
                                  cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: 700,
                                }}
                              >{pct}%</button>
                            ))}
                            <input
                              type="number" placeholder="Flat ج"
                              value={row.flatDiscount || 0}
                              onChange={e => handleUpdatePayment(row.name, { flatDiscountPerUser: parseFloat(e.target.value) || 0 })}
                              style={{
                                width: 60, padding: '2px 7px', borderRadius: 'var(--r-sm)',
                                border: '1px solid var(--border-default)', fontSize: '0.75rem',
                                background: 'var(--bg-base)', color: 'var(--tx-1)', fontFamily: 'var(--font-body)',
                              }}
                            />
                          </div>

                          {/* Payment method + cash input */}
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                            <select
                              value={row.paymentMethod || ''}
                              onChange={e => handleUpdatePayment(row.name, { paymentMethod: e.target.value })}
                              style={{
                                padding: '5px 10px', borderRadius: 'var(--r-sm)',
                                border: '1px solid var(--border-default)',
                                fontSize: '0.8rem', background: 'var(--bg-base)',
                                color: 'var(--tx-2)', fontFamily: 'var(--font-body)', cursor: 'pointer',
                              }}
                            >
                              <option value="">💳 Method…</option>
                              <option value="CASH">💵 Cash</option>
                              <option value="INSTAPAY">💳 Instapay</option>
                              <option value="VODAFONE">📱 Vodafone</option>
                            </select>

                            {row.paymentMethod === 'CASH' && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <input
                                  type="number"
                                  defaultValue={row.amountReceived || ''}
                                  onBlur={e => handleUpdatePayment(row.name, { amountReceived: parseFloat(e.target.value) || 0 })}
                                  placeholder="Received ج"
                                  style={{
                                    width: 90, padding: '5px 8px', borderRadius: 'var(--r-sm)',
                                    border: '1px solid var(--border-default)', fontSize: '0.8rem',
                                    background: 'var(--bg-base)', color: 'var(--tx-1)', fontFamily: 'var(--font-body)',
                                  }}
                                />
                                {change !== null && (
                                  <span style={{
                                    fontSize: '0.78rem', fontWeight: 800,
                                    color: change < 0 ? 'var(--red)' : 'var(--green)',
                                    whiteSpace: 'nowrap',
                                  }}>
                                    {change < 0 ? `⚠ Short ${Math.abs(change).toFixed(0)}ج` : `Change: ${change.toFixed(0)}ج`}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* ── Cash drawer summary ── */}
                  {cashRows.length > 0 && (
                    <div style={{
                      background: 'var(--bg-base)', borderRadius: 'var(--r-md)',
                      border: '1px solid var(--border-subtle)', padding: '14px 16px',
                    }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
                        🗄 Cash Drawer
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10 }}>
                        {[
                          { label: 'Cash In', value: `${totalCashReceived.toFixed(0)}ج`, color: 'var(--green)' },
                          { label: 'Digital', value: `${totalDigital.toFixed(0)}ج`, color: 'var(--tx-2)' },
                          { label: 'Change Out', value: `-${totalChangeBack.toFixed(0)}ج`, color: totalChangeBack > 0 ? 'var(--red)' : 'var(--tx-3)' },
                          { label: 'Net Cash', value: `${netCashInDrawer.toFixed(0)}ج`, color: 'var(--gold)' },
                        ].map(s => (
                          <div key={s.label} style={{ textAlign: 'center' }}>
                            <div style={{ fontWeight: 800, fontSize: '1rem', color: s.color }}>{s.value}</div>
                            <div style={{ fontSize: '0.68rem', color: 'var(--tx-3)', fontWeight: 700 }}>{s.label}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ── Grand total footer ── */}
                  <div style={{
                    display: 'flex', justifyContent: 'space-between',
                    paddingTop: 'var(--sp-2)', borderTop: '1px solid var(--border-subtle)',
                    fontWeight: 800, fontSize: '1.15rem',
                  }}>
                    <span style={{ color: 'var(--tx-1)' }}>Grand Total</span>
                    <span style={{ color: 'var(--gold)' }}>{totalOwed.toFixed(0)}ج</span>
                  </div>

                </Card>
              );
            })()}

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

        {/* ── WhatsApp preview modal ── */}
        {waSummary && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'flex-end', zIndex: 200 }}
            onClick={() => setWaSummary(null)}>
            <div onClick={e => e.stopPropagation()}
              style={{ background: 'var(--bg-surface)', width: '100%', maxHeight: '70vh', overflow: 'auto', borderRadius: '20px 20px 0 0', padding: 'var(--sp-5)' }}>
              <pre style={{ whiteSpace: 'pre-wrap', fontSize: '0.8rem', color: 'var(--tx-2)', lineHeight: 1.6, marginBottom: 16, fontFamily: 'var(--font-body)' }}>
                {waSummary}
              </pre>
              <div style={{ display: 'flex', gap: 12 }}>
                <Button variant="ghost" onClick={() => setWaSummary(null)}>Cancel</Button>
                <Button style={{ background: 'var(--green)', color: 'white', border: 'none' }} onClick={handleConfirmSend}>
                  Send to WhatsApp ✓
                </Button>
              </div>
            </div>
          </div>
        )}
        </>
        )}

      </main>
    </div>
  );
}