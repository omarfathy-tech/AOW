import Card from './common/Card';
import Button from './common/Button';

export default function SupportInbox({ notifications, onBack }) {
  const messages = (notifications || [])
    .filter(n => n.type === 'ORDER_DETAILS' || n.type === 'RESTAURANT_REACTION' || n.type === 'RESTAURANT_ADDED');

  return (
    <div style={{ padding: 'var(--sp-4)', maxWidth: '760px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
        <Button variant="secondary" size="sm" onClick={onBack}>←</Button>
        <h2 style={{ margin: 0, fontFamily: 'var(--font-display)', color: 'var(--tx-1)' }}>Support Inbox</h2>
      </div>

      {messages.length === 0 && (
        <Card variant="flat" style={{ padding: 'var(--sp-5)', textAlign: 'center', color: 'var(--tx-3)' }}>
          No messages yet.
        </Card>
      )}

      {messages.map((m) => (
        <Card key={m.id} variant="raised" style={{ padding: 'var(--sp-4)', borderLeft: `4px solid ${m.type === 'ORDER_DETAILS' ? 'var(--gold)' : 'var(--border-default)'}` }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--tx-3)', marginBottom: '6px', fontWeight: '700' }}>
            {m.sender || 'OrderHub'} • {m.type}
          </div>
          <div style={{ color: 'var(--tx-1)', fontWeight: '700', marginBottom: '8px' }}>{m.message}</div>
          {m.details && (
            <pre style={{ margin: 0, whiteSpace: 'pre-wrap', color: 'var(--tx-2)', background: 'var(--bg-base)', padding: '10px', borderRadius: 'var(--r-sm)', fontFamily: 'var(--font-body)' }}>
              {m.details}
            </pre>
          )}
        </Card>
      ))}
    </div>
  );
}
