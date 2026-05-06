import { useState, useEffect } from 'react';
import { API, getAuthHeaders } from '../api.js';
import Button from './common/Button';
import Input from './common/Input';
import Card from './common/Card';
import { useToast } from '../context/ToastContext';

export default function UserProfile({ user, onBack, onUpdate }) {
  const [fullName, setFullName] = useState(user?.fullName || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || '');
  const [color, setColor] = useState(user?.color || 'var(--gold)');
  const [saving, setSaving] = useState(false);
  const showToast = useToast();

  useEffect(() => {
    if (user) {
      setFullName(user.fullName || '');
      setPhone(user.phone || '');
      setAvatarUrl(user.avatarUrl || '');
      setColor(user.color || 'var(--gold)');
    }
  }, [user]);

  const colors = [
    'var(--gold)', '#EF4444', '#F97316', '#22C55E',
    '#3B82F6', '#8B5CF6', '#EC4899', '#14B8A6'
  ];

  async function handleSave() {
    const cleaned = (phone || '').trim();
    if (cleaned && !/^\+?\d{10,15}$/.test(cleaned)) {
      showToast('Phone must be digits only, e.g. 01021389293 or +201021389293', 'error');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`${API}/users/me`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ fullName, phone: cleaned, color, avatarUrl })
      });
      if (res.ok) {
        const data = await res.json();
        showToast('Profile updated!', 'success');
        if (onUpdate) onUpdate(data.user);
      } else {
        showToast('Failed to update profile', 'error');
      }
    } catch (e) {
      showToast('Network error', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ padding: 'var(--sp-4)', maxWidth: '480px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', marginBottom: 'var(--sp-6)' }}>
        <Button variant="secondary" size="sm" onClick={onBack}>←</Button>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', margin: 0 }}>My Profile</h1>
      </div>

      <Card variant="raised" style={{ padding: 'var(--sp-6)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-5)' }}>
        {/* Avatar */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--sp-3)' }}>
          <div style={{
            width: '80px', height: '80px', borderRadius: '50%',
            background: avatarUrl ? `url(${avatarUrl}) center/cover` : color,
            border: '2px solid var(--gold)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.5rem', fontWeight: '800', color: 'white',
            overflow: 'hidden'
          }}>
            {!avatarUrl && (fullName?.slice(0, 2).toUpperCase() || user?.username?.slice(0, 2).toUpperCase())}
          </div>
          <Input
            label="Avatar URL (optional)"
            value={avatarUrl}
            onChange={(e) => setAvatarUrl(e.target.value)}
            placeholder="https://..."
          />
        </div>

        <Input label="Full Name" value={fullName} onChange={(e) => setFullName(e.target.value)} />

        <Input
          label="Phone Number (for WhatsApp order receipts)"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="e.g. 01021389293 or +201021389293"
        />

        {/* Color Picker */}
        <div>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', color: 'var(--tx-2)', marginBottom: '8px' }}>
            Avatar Color
          </label>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {colors.map(c => (
              <button
                key={c}
                onClick={() => setColor(c)}
                style={{
                  width: '32px', height: '32px', borderRadius: '50%',
                  background: c,
                  border: color === c ? '3px solid var(--tx-1)' : '2px solid transparent',
                  cursor: 'pointer'
                }}
              />
            ))}
          </div>
        </div>

        <Button size="lg" onClick={handleSave} disabled={saving} className="btn-gradient">
          {saving ? 'Saving...' : 'Save Profile'}
        </Button>
      </Card>
    </div>
  );
}
