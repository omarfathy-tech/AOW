import { useState } from 'react';
import Button from './common/Button';
import Card from './common/Card';
import { API, getAuthHeaders } from '../api.js';
import { useToast } from '../context/ToastContext';

export default function ChatOrder({ user, activeSession, sessionStatus }) {
  const [text, setText] = useState('');
  const [editing, setEditing] = useState(false);
  const showToast = useToast();

  const myOrder = activeSession?.personOrders?.find(p => p.name === user.username && p.textOrder);
  const hasOrder = !!myOrder;
  const canEdit = sessionStatus === 'OPEN';

  async function handleSubmit() {
    if (!text.trim() || !activeSession) return;
    try {
      const res = await fetch(`${API}/sessions/${activeSession.id}/text-order`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ text: text.trim() })
      });
      if (res.ok) {
        setText('');
        setEditing(false);
        showToast(hasOrder ? 'Order updated!' : 'Order sent!', 'success');
      } else {
        showToast('Failed to send order', 'error');
      }
    } catch (e) {
      showToast('Network error', 'error');
    }
  }

  async function handleDelete() {
    if (!activeSession) return;
    try {
      const res = await fetch(`${API}/sessions/${activeSession.id}/text-order`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      if (res.ok) {
        setText('');
        setEditing(false);
        showToast('Order deleted', 'info');
      } else {
        showToast('Failed to delete', 'error');
      }
    } catch (e) {
      showToast('Network error', 'error');
    }
  }

  function startEdit() {
    setText(myOrder?.textOrder || '');
    setEditing(true);
  }

  if (!canEdit && !hasOrder) {
    return (
      <Card variant="flat" style={{ padding: 'var(--sp-6)', textAlign: 'center', color: 'var(--tx-3)' }}>
        Ordering is closed for this session.
      </Card>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
      {hasOrder && !editing && (
        <Card variant="raised" style={{ padding: 'var(--sp-5)', borderLeft: '4px solid var(--gold)' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--tx-3)', marginBottom: '8px', fontWeight: '800' }}>
            YOUR ORDER
          </div>
          <div style={{ fontSize: '1.1rem', color: 'var(--tx-1)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
            {myOrder.textOrder}
          </div>
          {canEdit && (
            <div style={{ display: 'flex', gap: '12px', marginTop: 'var(--sp-4)' }}>
              <Button size="sm" variant="secondary" onClick={startEdit}>✏️ Edit</Button>
              <Button size="sm" variant="ghost" onClick={handleDelete} style={{ color: 'var(--red)', borderColor: 'var(--red)' }}>🗑 Delete</Button>
            </div>
          )}
        </Card>
      )}

      {(editing || (!hasOrder && canEdit)) && (
        <Card variant="raised" style={{ padding: 'var(--sp-5)' }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--tx-2)', marginBottom: 'var(--sp-3)', fontWeight: '700' }}>
            {hasOrder ? 'Edit your order' : 'Type your order'}
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="e.g. 2 chicken shawarma, no pickles, extra garlic..."
            style={{
              width: '100%',
              minHeight: '120px',
              padding: '12px',
              borderRadius: 'var(--r-md)',
              border: '1px solid var(--border-strong)',
              background: 'var(--bg-elevated)',
              color: 'var(--tx-1)',
              fontFamily: 'var(--font-body)',
              fontSize: '1rem',
              resize: 'vertical',
              outline: 'none'
            }}
          />
          <div style={{ display: 'flex', gap: '12px', marginTop: 'var(--sp-3)', justifyContent: 'flex-end' }}>
            {editing && (
              <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setText(''); }}>
                Cancel
              </Button>
            )}
            <Button size="sm" onClick={handleSubmit} disabled={!text.trim()}>
              {hasOrder ? 'Update Order' : 'Send Order'}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
