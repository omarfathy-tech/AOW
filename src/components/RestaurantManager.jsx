import { useState, useEffect } from 'react';
import { API, getAuthHeaders } from '../api.js';
import Button from './common/Button';
import Input from './common/Input';
import Card from './common/Card';
import { useToast } from '../context/ToastContext';

const CUISINE_TYPES = ['PITZA', 'BURGER', 'CHICKEN', 'OTHER'];
const ORDER_MODES = ['MENU', 'TEXT'];

export default function RestaurantManager() {
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ name: '', cuisineType: 'OTHER', description: '', deliveryFee: 0, logoUrl: '', available: true, orderMode: 'MENU' });
  const [categoryForm, setCategoryForm] = useState({ name: '' });
  const [itemForm, setItemForm] = useState({ name: '', prices: { Small: 0, Medium: 0, Large: 0 } });
  const [editingCategoryId, setEditingCategoryId] = useState(null);
  const [editingItemId, setEditingItemId] = useState(null);
  const showToast = useToast();

  useEffect(() => {
    fetchRestaurants();
  }, []);

  async function fetchRestaurants() {
    try {
      const res = await fetch(`${API}/restaurants`, { headers: getAuthHeaders(false) });
      const data = await res.json();
      setRestaurants(data);
    } catch (err) {
      console.error(err);
      showToast('Failed to load restaurants', 'error');
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setForm({ name: '', cuisineType: 'OTHER', description: '', deliveryFee: 0, logoUrl: '', available: true, orderMode: 'MENU' });
    setEditingId(null);
  }

  async function handleSaveRestaurant() {
    if (!form.name.trim()) {
      showToast('Restaurant name is required', 'error');
      return;
    }
    const payload = {
      ...form,
      deliveryFee: parseFloat(form.deliveryFee) || 0,
    };
    try {
      const url = editingId ? `${API}/restaurants/${editingId}` : `${API}/restaurants`;
      const method = editingId ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      showToast(editingId ? 'Restaurant updated' : 'Restaurant created', 'success');
      resetForm();
      fetchRestaurants();
    } catch (err) {
      console.error(err);
      showToast('Failed to save restaurant', 'error');
    }
  }

  async function handleDeleteRestaurant(id) {
    if (!window.confirm('Delete this restaurant permanently?')) return;
    try {
      const res = await fetch(`${API}/restaurants/${id}`, { method: 'DELETE', headers: getAuthHeaders(false) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      showToast('Restaurant deleted', 'success');
      fetchRestaurants();
    } catch (err) {
      console.error(err);
      showToast('Failed to delete restaurant', 'error');
    }
  }

  function startEdit(restaurant) {
    setEditingId(restaurant.id);
    setForm({
      name: restaurant.name || '',
      cuisineType: restaurant.cuisineType || 'OTHER',
      description: restaurant.description || '',
      deliveryFee: restaurant.deliveryFee || 0,
      logoUrl: restaurant.logoUrl || '',
      available: restaurant.available !== false,
      orderMode: restaurant.orderMode || 'MENU',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleToggleAvailability(restaurant) {
    const updated = { ...restaurant, available: !restaurant.available };
    try {
      const res = await fetch(`${API}/restaurants/${restaurant.id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(updated)
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      showToast(updated.available ? 'Restaurant is now available' : 'Restaurant marked unavailable', 'success');
      fetchRestaurants();
    } catch (err) {
      console.error(err);
      showToast('Failed to update availability', 'error');
    }
  }

  async function handleAddCategory(restaurantId) {
    if (!categoryForm.name.trim()) return;
    try {
      const res = await fetch(`${API}/admin/menu/categories`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ restaurantId, name: categoryForm.name.trim() })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      showToast('Category added', 'success');
      setCategoryForm({ name: '' });
      fetchRestaurants();
    } catch (err) {
      console.error(err);
      showToast('Failed to add category', 'error');
    }
  }

  async function handleUpdateCategory(categoryId, newName) {
    try {
      const res = await fetch(`${API}/admin/menu/categories/${categoryId}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ name: newName.trim() })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      showToast('Category updated', 'success');
      setEditingCategoryId(null);
      fetchRestaurants();
    } catch (err) {
      console.error(err);
      showToast('Failed to update category', 'error');
    }
  }

  async function handleDeleteCategory(categoryId) {
    if (!window.confirm('Delete this category and all its items?')) return;
    try {
      const res = await fetch(`${API}/admin/menu/categories/${categoryId}`, { method: 'DELETE', headers: getAuthHeaders(false) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      showToast('Category deleted', 'success');
      fetchRestaurants();
    } catch (err) {
      console.error(err);
      showToast('Failed to delete category', 'error');
    }
  }

  async function handleAddItem(categoryId) {
    if (!itemForm.name.trim()) return;
    const prices = {};
    Object.entries(itemForm.prices).forEach(([size, price]) => {
      const p = parseFloat(price);
      if (p > 0) prices[size] = p;
    });
    try {
      const res = await fetch(`${API}/admin/menu/items`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ categoryId, name: itemForm.name.trim(), prices })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      showToast('Item added', 'success');
      setItemForm({ name: '', prices: { Small: 0, Medium: 0, Large: 0 } });
      fetchRestaurants();
    } catch (err) {
      console.error(err);
      showToast('Failed to add item', 'error');
    }
  }

  async function handleUpdateItem(itemId, updatedItem) {
    try {
      const res = await fetch(`${API}/admin/menu/items/${itemId}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(updatedItem)
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      showToast('Item updated', 'success');
      setEditingItemId(null);
      fetchRestaurants();
    } catch (err) {
      console.error(err);
      showToast('Failed to update item', 'error');
    }
  }

  async function handleDeleteItem(itemId) {
    if (!window.confirm('Delete this item?')) return;
    try {
      const res = await fetch(`${API}/admin/menu/items/${itemId}`, { method: 'DELETE', headers: getAuthHeaders(false) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      showToast('Item deleted', 'success');
      fetchRestaurants();
    } catch (err) {
      console.error(err);
      showToast('Failed to delete item', 'error');
    }
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '80px', color: 'var(--tx-3)' }}>
        Loading restaurants...
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-6)' }}>
      {/* ── Form ── */}
      <Card variant="raised" style={{ padding: 'var(--sp-5)' }}>
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', marginBottom: 'var(--sp-4)', color: 'var(--tx-1)' }}>
          {editingId ? 'Edit Restaurant' : 'Add Restaurant'}
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--sp-3)' }}>
          <Input label="Name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Restaurant name" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Cuisine</label>
            <select
              value={form.cuisineType}
              onChange={e => setForm(f => ({ ...f, cuisineType: e.target.value }))}
              style={{ padding: '10px 12px', borderRadius: 'var(--r-sm)', border: '1px solid var(--border-default)', background: 'var(--bg-elevated)', color: 'var(--tx-1)', fontFamily: 'var(--font-body)' }}
            >
              {CUISINE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <Input label="Logo URL" value={form.logoUrl} onChange={e => setForm(f => ({ ...f, logoUrl: e.target.value }))} placeholder="https://..." />
          <Input label="Delivery Fee" type="number" value={form.deliveryFee} onChange={e => setForm(f => ({ ...f, deliveryFee: e.target.value }))} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Order Mode</label>
            <select
              value={form.orderMode}
              onChange={e => setForm(f => ({ ...f, orderMode: e.target.value }))}
              style={{ padding: '10px 12px', borderRadius: 'var(--r-sm)', border: '1px solid var(--border-default)', background: 'var(--bg-elevated)', color: 'var(--tx-1)', fontFamily: 'var(--font-body)' }}
            >
              {ORDER_MODES.map(m => <option key={m} value={m}>{m === 'MENU' ? '📋 Structured Menu' : '💬 Free Text (Chat)'}</option>)}
            </select>
          </div>
        </div>
        <div style={{ marginTop: 'var(--sp-3)' }}>
          <Input label="Description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Short description..." />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', marginTop: 'var(--sp-4)' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem', fontWeight: '600', color: 'var(--tx-2)' }}>
            <input
              type="checkbox"
              checked={form.available}
              onChange={e => setForm(f => ({ ...f, available: e.target.checked }))}
              style={{ width: '18px', height: '18px', accentColor: 'var(--gold)' }}
            />
            Available
          </label>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 'var(--sp-3)' }}>
            {editingId && (
              <Button variant="ghost" onClick={resetForm} style={{ borderColor: 'var(--tx-3)', color: 'var(--tx-3)' }}>
                Cancel
              </Button>
            )}
            <Button onClick={handleSaveRestaurant}>
              {editingId ? 'Update Restaurant' : 'Create Restaurant'}
            </Button>
          </div>
        </div>
      </Card>

      {/* ── List ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
        <h3 style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--tx-3)', fontWeight: '800', letterSpacing: '0.08em' }}>
          All Restaurants ({restaurants.length})
        </h3>

        {restaurants.length === 0 && (
          <div style={{ textAlign: 'center', padding: '48px', color: 'var(--tx-3)', background: 'var(--bg-elevated)', borderRadius: 'var(--r-lg)', border: '1px dashed var(--border-default)' }}>
            No restaurants yet.
          </div>
        )}

        {restaurants.map(restaurant => {
          const isExpanded = expandedId === restaurant.id;
          return (
            <Card key={restaurant.id} variant="flat" style={{ padding: 'var(--sp-4)', borderLeft: `4px solid ${restaurant.available !== false ? 'var(--green)' : 'var(--red)'}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '1.5rem' }}>
                    {restaurant.cuisineType === 'PITZA' ? '🍕' : restaurant.cuisineType === 'BURGER' ? '🍔' : restaurant.cuisineType === 'CHICKEN' ? '🍗' : '🍴'}
                  </span>
                  <div>
                    <div style={{ fontWeight: '800', fontSize: '1rem', color: 'var(--tx-1)' }}>{restaurant.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--tx-3)', marginTop: '2px' }}>
                      {restaurant.cuisineType} • {restaurant.deliveryFee}ج delivery • {restaurant.orderMode === 'TEXT' ? '💬 Chat' : '📋 Menu'} • {restaurant.available !== false ? 'Available' : 'Unavailable'}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <Button variant="ghost" size="sm" onClick={() => handleToggleAvailability(restaurant)} style={{ fontSize: '0.8rem' }}>
                    {restaurant.available !== false ? '🔴 Disable' : '🟢 Enable'}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => startEdit(restaurant)} style={{ fontSize: '0.8rem' }}>
                    ✏️ Edit
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDeleteRestaurant(restaurant.id)} style={{ borderColor: 'var(--red)', color: 'var(--red)', fontSize: '0.8rem' }}>
                    🗑 Delete
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setExpandedId(isExpanded ? null : restaurant.id)} style={{ fontSize: '0.8rem' }}>
                    {isExpanded ? '▲ Collapse' : '▼ Manage Menu'}
                  </Button>
                </div>
              </div>

              {/* ── Expanded Menu Manager ── */}
              {isExpanded && (
                <div style={{ marginTop: 'var(--sp-4)', paddingTop: 'var(--sp-4)', borderTop: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
                  <h4 style={{ fontSize: '0.85rem', fontWeight: '800', color: 'var(--tx-2)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Menu Categories
                  </h4>

                  {(restaurant.categories || []).map(category => (
                    <div key={category.id} style={{ background: 'var(--bg-base)', borderRadius: 'var(--r-md)', padding: 'var(--sp-4)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--sp-3)' }}>
                        {editingCategoryId === category.id ? (
                          <div style={{ display: 'flex', gap: '8px', flex: 1 }}>
                            <input
                              defaultValue={category.name}
                              onBlur={(e) => handleUpdateCategory(category.id, e.target.value)}
                              onKeyDown={(e) => { if (e.key === 'Enter') handleUpdateCategory(category.id, e.target.value); }}
                              autoFocus
                              style={{ flex: 1, padding: '6px 10px', borderRadius: 'var(--r-sm)', border: '1px solid var(--gold)', background: 'var(--bg-elevated)', color: 'var(--tx-1)' }}
                            />
                          </div>
                        ) : (
                          <span style={{ fontWeight: '700', color: 'var(--tx-1)' }}>{category.name}</span>
                        )}
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button onClick={() => setEditingCategoryId(editingCategoryId === category.id ? null : category.id)} style={{ background: 'none', border: 'none', color: 'var(--tx-3)', cursor: 'pointer', fontSize: '0.8rem' }}>✏️</button>
                          <button onClick={() => handleDeleteCategory(category.id)} style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: '0.8rem' }}>🗑</button>
                        </div>
                      </div>

                      {/* Items */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {(category.items || []).map(item => (
                          <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--bg-elevated)', borderRadius: 'var(--r-sm)', flexWrap: 'wrap', gap: '8px' }}>
                            {editingItemId === item.id ? (
                              <EditItemRow
                                item={item}
                                onSave={(updated) => handleUpdateItem(item.id, updated)}
                                onCancel={() => setEditingItemId(null)}
                              />
                            ) : (
                              <>
                                <span style={{ fontWeight: '600', fontSize: '0.9rem', color: 'var(--tx-1)' }}>{item.name}</span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                                  <span style={{ fontSize: '0.8rem', color: 'var(--tx-3)' }}>
                                    {item.prices ? Object.entries(item.prices).map(([k, v]) => `${k}: ${v}ج`).join(' • ') : 'No prices'}
                                  </span>
                                  <div style={{ display: 'flex', gap: '6px' }}>
                                    <button onClick={() => setEditingItemId(item.id)} style={{ background: 'none', border: 'none', color: 'var(--tx-3)', cursor: 'pointer', fontSize: '0.8rem' }}>✏️</button>
                                    <button onClick={() => handleDeleteItem(item.id)} style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: '0.8rem' }}>🗑</button>
                                  </div>
                                </div>
                              </>
                            )}
                          </div>
                        ))}

                        {/* Add Item */}
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
                          <input
                            placeholder="Item name"
                            value={itemForm.name}
                            onChange={e => setItemForm(f => ({ ...f, name: e.target.value }))}
                            style={{ flex: 1, minWidth: '120px', padding: '8px 10px', borderRadius: 'var(--r-sm)', border: '1px solid var(--border-default)', background: 'var(--bg-elevated)', color: 'var(--tx-1)' }}
                          />
                          {['Small', 'Medium', 'Large'].map(size => (
                            <input
                              key={size}
                              type="number"
                              placeholder={size}
                              value={itemForm.prices[size] || ''}
                              onChange={e => setItemForm(f => ({ ...f, prices: { ...f.prices, [size]: e.target.value } }))}
                              style={{ width: '70px', padding: '8px 10px', borderRadius: 'var(--r-sm)', border: '1px solid var(--border-default)', background: 'var(--bg-elevated)', color: 'var(--tx-1)' }}
                            />
                          ))}
                          <Button size="sm" onClick={() => handleAddItem(category.id)}>+ Add</Button>
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Add Category */}
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      placeholder="New category name..."
                      value={categoryForm.name}
                      onChange={e => setCategoryForm({ name: e.target.value })}
                      style={{ flex: 1, padding: '10px 12px', borderRadius: 'var(--r-sm)', border: '1px solid var(--border-default)', background: 'var(--bg-elevated)', color: 'var(--tx-1)' }}
                      onKeyDown={e => { if (e.key === 'Enter') handleAddCategory(restaurant.id); }}
                    />
                    <Button onClick={() => handleAddCategory(restaurant.id)}>+ Category</Button>
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function EditItemRow({ item, onSave, onCancel }) {
  const [name, setName] = useState(item.name || '');
  const [prices, setPrices] = useState(() => {
    const p = item.prices || {};
    return { Small: p.Small || '', Medium: p.Medium || '', Large: p.Large || '' };
  });

  return (
    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', flex: 1 }}>
      <input
        value={name}
        onChange={e => setName(e.target.value)}
        style={{ flex: 1, minWidth: '100px', padding: '6px 10px', borderRadius: 'var(--r-sm)', border: '1px solid var(--gold)', background: 'var(--bg-elevated)', color: 'var(--tx-1)' }}
      />
      {['Small', 'Medium', 'Large'].map(size => (
        <input
          key={size}
          type="number"
          placeholder={size}
          value={prices[size]}
          onChange={e => setPrices(p => ({ ...p, [size]: e.target.value }))}
          style={{ width: '60px', padding: '6px 10px', borderRadius: 'var(--r-sm)', border: '1px solid var(--border-default)', background: 'var(--bg-elevated)', color: 'var(--tx-1)' }}
        />
      ))}
      <button onClick={() => onSave({ name, prices })} style={{ background: 'none', border: 'none', color: 'var(--green)', cursor: 'pointer', fontSize: '0.9rem' }}>✓</button>
      <button onClick={onCancel} style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: '0.9rem' }}>✕</button>
    </div>
  );
}
