import { useState, useEffect, useCallback } from 'react';
import { API, getAuthHeaders } from '../api.js';
import Button from './common/Button';
import Input from './common/Input';
import Card from './common/Card';

export default function OrderHistoryPage({ user, isAdmin = false }) {
  const [history, setHistory] = useState([]);
  const [expanded, setExpanded] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('date_desc');
  const [dateRange, setDateRange] = useState('all');
  const [loading, setLoading] = useState(true);
  const [modificationStatus, setModificationStatus] = useState({});

  const loadHistory = useCallback(async () => {
    setLoading(true);
    try {
      const endpoint = isAdmin ? `${API}/orders` : `${API}/orders/user/${user.id || user.username}`;
      const res = await fetch(endpoint, { headers: getAuthHeaders(false) });
      const data = await res.json();
      setHistory(data.content || data);
    } catch (err) {
      console.error(err);
      if (!isAdmin) {
        try {
          const res = await fetch(`${API}/orders/mine?username=${encodeURIComponent(user.username)}`, { headers: getAuthHeaders(false) });
          const data = await res.json();
          setHistory(data.content || data);
        } catch (_err) {
          console.error(_err);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [user.username, user.id, isAdmin]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const checkModificationStatus = async (orderId) => {
    try {
      const [modifyRes, cancelRes] = await Promise.all([
        fetch(`${API}/orders/${orderId}/can-modify`, { headers: getAuthHeaders(false) }),
        fetch(`${API}/orders/${orderId}/can-cancel`, { headers: getAuthHeaders(false) })
      ]);
      const modifyData = await modifyRes.json();
      const cancelData = await cancelRes.json();
      setModificationStatus(prev => ({
        ...prev,
        [orderId]: { ...modifyData, ...cancelData }
      }));
    } catch (err) {
      console.error(err);
    }
  };

  const handleModifyOrder = async (orderId, modifiedItems) => {
    try {
      const res = await fetch(`${API}/orders/${orderId}/modify`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ itemsJson: JSON.stringify(modifiedItems) })
      });
      if (res.ok) {
        alert('✅ Order modified successfully!');
        loadHistory();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to modify order');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCancelOrder = async (orderId) => {
    if (!window.confirm('Are you sure you want to cancel this order?')) return;
    try {
      const res = await fetch(`${API}/orders/${orderId}/cancel`, { 
        method: 'POST',
        headers: getAuthHeaders(false)
      });
      if (res.ok) {
        alert('✅ Order cancelled successfully!');
        loadHistory();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to cancel order');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleReorder = async (entry) => {
    try {
      const statusRes = await fetch(`${API}/sessions/active/status`, { headers: getAuthHeaders(false) });
      const statusData = await statusRes.json();
      if (statusData.status !== 'OPEN') {
        alert("No open session right now. Ask admin to open one.");
        return;
      }

      await fetch(`${API}/sessions/${statusData.sessionId}/order`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          name: user.username,
          items: entry.items,
          subtotal: entry.subtotal
        })
      });
      alert("✅ Reorder placed!");
    } catch (err) {
      console.error(err);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  const filteredHistory = history.filter(entry => {
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = !searchQuery ||
      (entry.sessionName || '').toLowerCase().includes(searchLower) ||
      (entry.items && entry.items.some(item => (item.name || '').toLowerCase().includes(searchLower)));

    const status = entry.status || entry.sessionStatus;
    const matchesStatus = statusFilter === 'ALL' || status === statusFilter;

    let matchesDate = true;
    if (dateRange !== 'all' && entry.createdAt) {
      const entryDate = new Date(entry.createdAt);
      const now = new Date();
      if (dateRange === 'today') matchesDate = entryDate.toDateString() === now.toDateString();
      else if (dateRange === 'week') matchesDate = entryDate >= new Date(now - 7 * 86400000);
      else if (dateRange === 'month') matchesDate = entryDate >= new Date(now - 30 * 86400000);
    }
    return matchesSearch && matchesStatus && matchesDate;
  }).sort((a, b) => {
    const timeA = new Date(a.createdAt || 0);
    const timeB = new Date(b.createdAt || 0);
    if (sortBy === 'date_desc') return timeB - timeA;
    if (sortBy === 'date_asc') return timeA - timeB;
    const priceA = a.subtotal || a.totalPrice || 0;
    const priceB = b.subtotal || b.totalPrice || 0;
    if (sortBy === 'amount_desc') return priceB - priceA;
    if (sortBy === 'amount_asc') return priceA - priceB;
    return 0;
  });

  const getStatusBadge = (status) => {
    const map = { PENDING: 'status-pending', ACCEPTED: 'status-accepted', PREPARING: 'status-preparing', DELIVERED: 'status-delivered', CANCELLED: 'status-cancelled', SENT: 'status-delivered', OPEN: 'status-pending', CLOSED: 'status-preparing' };
    return map[status] || 'status-pending';
  };

  return (
    <div className="portal-content">
      <Card style={{ padding: '24px' }}>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '4px' }}>
          {isAdmin ? "🏛️ Master Audit History" : "📜 My Order History"}
        </h2>
        <p style={{ color: 'var(--text-secondary)' }}>
          {isAdmin ? "Global view of all processed orders across sessions." : "Your past orders across all sessions."}
        </p>
      </Card>

      <Card style={{ padding: '20px' }}>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ flex: 1, minWidth: '200px' }}>
            <Input
              placeholder="Search orders..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: '100%' }}
            />
          </div>

          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="filter-select">
            <option value="ALL">All Statuses</option>
            {[...new Set(history.map(e => e.status || e.sessionStatus).filter(Boolean))].map(s => <option key={s} value={s}>{s}</option>)}
          </select>

          <select value={dateRange} onChange={(e) => setDateRange(e.target.value)} className="filter-select">
            <option value="all">All Time</option>
            <option value="today">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
          </select>

          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="filter-select">
            <option value="date_desc">Newest First</option>
            <option value="date_asc">Oldest First</option>
            <option value="amount_desc">Highest Amount</option>
            <option value="amount_asc">Lowest Amount</option>
          </select>

          <Button variant="secondary" onClick={() => { setSearchQuery(''); setStatusFilter('ALL'); setDateRange('all'); setSortBy('date_desc'); }}>
            Clear Filters
          </Button>
        </div>
      </Card>

      {loading ? (
        <Card style={{ padding: '60px', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-secondary)' }}>Loading orders...</p>
        </Card>
      ) : filteredHistory.length === 0 ? (
        <Card style={{ padding: '60px', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-secondary)' }}>No orders found.</p>
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {filteredHistory.map((entry, idx) => {
            const isExpanded = expanded === idx;
            const status = entry.status || entry.sessionStatus;
            const modStatus = modificationStatus[entry.id];

            return (
              <Card key={idx} style={{ padding: '0', overflow: 'hidden' }}>
                <div
                  onClick={() => { setExpanded(isExpanded ? null : idx); if (!isExpanded && entry.id) checkModificationStatus(entry.id); }}
                  style={{ padding: '20px 24px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}
                >
                  <div style={{ flex: 1, minWidth: '200px' }}>
                    <div style={{ fontWeight: '700', fontSize: '1rem' }}>{entry.sessionName || 'Session'}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>{formatDate(entry.createdAt || entry.created_at)}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span className={`status-badge ${getStatusBadge(status)}`}>{status || 'PENDING'}</span>
                    <span style={{ fontWeight: '800', color: 'var(--accent-glow)' }}>{entry.subtotal || entry.totalPrice || 0}ج</span>
                    <span style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s' }}>▼</span>
                  </div>
                </div>

                {isExpanded && (
                  <div style={{ padding: '0 24px 24px', borderTop: '1px solid var(--glass-border)', paddingTop: '20px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {entry.items?.map((item, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                          <span>{item.name} {item.size ? `(${item.size})` : ''}</span>
                          <span>{item.price}ج</span>
                        </div>
                      ))}
                    </div>

                    <div style={{ display: 'flex', gap: '12px', marginTop: '20px', flexWrap: 'wrap' }}>
                      <Button onClick={() => handleReorder(entry)}>🔄 Reorder</Button>
                      
                      {entry.id && modStatus?.canModify && (
                        <Button variant="secondary" onClick={() => {
                          const m = prompt('Enter modified JSON:', JSON.stringify(entry.items));
                          if (m) handleModifyOrder(entry.id, JSON.parse(m));
                        }}>✏️ Modify</Button>
                      )}

                      {entry.id && modStatus?.canCancel && status !== 'CANCELLED' && status !== 'DELIVERED' && (
                        <Button variant="destructive" onClick={() => handleCancelOrder(entry.id)}>❌ Cancel</Button>
                      )}
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
