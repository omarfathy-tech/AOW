import { useState, useEffect, useMemo } from 'react';
import MenuPanel from './MenuPanel';
import ItemExtrasModal from './ItemExtrasModal';
import ChatOrder from './ChatOrder';
import { ITEM_EXTRA_OPTIONS } from '../constants';
import { API, getAuthHeaders } from '../api.js';
import Button from './common/Button';
import Input from './common/Input';
import Card from './common/Card';
import StatusBadge from './common/StatusBadge';
import BottomSheet from './common/BottomSheet';
import { useSessions } from '../hooks/useSessions';
import { useToast } from '../context/ToastContext';

function SuccessCheckmark() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 'var(--sp-4)' }}>
      <svg className="checkmark" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52">
        <circle className="checkmark__circle" cx="26" cy="26" r="25" fill="none"/>
        <path className="checkmark__check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8"/>
      </svg>
    </div>
  );
}

function CountdownTimer({ deadline }) {
  const [remaining, setRemaining] = useState('');
  const [isUrgent, setIsUrgent] = useState(false);
  useEffect(() => {
    const tick = () => {
      const diff = new Date(deadline) - new Date();
      if (diff <= 0) { setRemaining("Time's up!"); setIsUrgent(true); return; }
      const mins = Math.floor(diff / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      setRemaining(`${mins}:${secs.toString().padStart(2, '0')}`);
      setIsUrgent(mins < 5);
    };
    tick();
    const i = setInterval(tick, 1000);
    return () => clearInterval(i);
  }, [deadline]);
  return (
    <div style={{ 
      background: isUrgent ? 'var(--red-dim)' : 'var(--bg-elevated)',
      padding: '4px 10px',
      borderRadius: 'var(--r-md)',
      border: `1px solid ${isUrgent ? 'var(--red-border)' : 'var(--border-strong)'}`,
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      color: isUrgent ? 'var(--red)' : 'var(--tx-1)',
      fontWeight: '700',
      fontSize: '0.875rem'
    }}>
      <span style={{ animation: isUrgent ? 'status-pulse 1s infinite' : 'none' }}>⏱</span>
      {remaining}
    </div>
  );
}

export default function UserPortal({ user, restaurant, onBack }) {
  const { activeSessions } = useSessions();
  const [activeSession, setActiveSession] = useState(null);
  const [sessionStatus, setSessionStatus] = useState("NONE"); 
  const [menu, setMenu] = useState({ categories: {} });
  const [currentCat, setCurrentCat] = useState("");
  const [myItems, setMyItems] = useState([]);
  const [orderNotes, setOrderNotes] = useState("");
  const [orderSubmitted, setOrderSubmitted] = useState(false);
  const [favorites, setFavorites] = useState([]);
  
  const [pendingItem, setPendingItem] = useState(null);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const showToast = useToast();

  // 1. Fetch User Favorites
  useEffect(() => {
    fetch(`${API}/users/me/favorites`, { headers: getAuthHeaders() })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (!data) return;
        try {
          const favs = typeof data.favorites === 'string' ? JSON.parse(data.favorites) : (data.favorites || []);
          setFavorites(Array.isArray(favs) ? favs : []);
        } catch (e) { setFavorites([]); }
      })
      .catch(() => setFavorites([]));
  }, []);

  // 2. Session Polling Sync
  useEffect(() => {
    const s = activeSessions.find(s => s.restaurantId === restaurant.id);
    if (s) {
      setActiveSession(s);
      setSessionStatus(s.status);
      const myOrder = s.personOrders?.find(p => p.name === user.username);
      if (myOrder && (myOrder.items?.length > 0 || myOrder.textOrder)) setOrderSubmitted(true);
      else setOrderSubmitted(false);
    } else {
      setActiveSession(null);
      setSessionStatus("NONE");
      setOrderSubmitted(false);
    }
  }, [activeSessions, restaurant.id, user.username]);

  // 3. Menu Fetch
  useEffect(() => {
    fetch(`${API}/menu/${restaurant.id}`, { headers: getAuthHeaders(false) })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (!data) return;
        setMenu(data);
        const firstCat = Object.keys(data.categories)[0];
        if (firstCat) setCurrentCat(firstCat);
      });
  }, [restaurant.id]);

  const cats = Object.keys(menu.categories);
  const menuItems = menu.categories[currentCat] || [];
  const subtotal = useMemo(() => myItems.reduce((acc, item) => acc + item.price * (item.quantity || 1), 0), [myItems]);

  function getOptionLabel(optionId) {
    return ITEM_EXTRA_OPTIONS.find(o => o.id === optionId)?.label || "عادي";
  }

  async function handleSaveFavorite() {
    const myOrder = activeSession?.personOrders?.find(p => p.name === user.username);
    if (!myOrder) return;
    
    // Check if duplicate
    const isDuplicate = favorites.some(f => 
      f.restaurantId === restaurant.id && 
      JSON.stringify(f.items) === JSON.stringify(myOrder.items)
    );
    if (isDuplicate) {
      showToast("Order already in favorites", "info");
      return;
    }

    const updatedFavs = [...favorites, {
      id: Date.now(),
      restaurantId: restaurant.id,
      restaurantName: restaurant.name,
      items: myOrder.items,
      notes: myOrder.notes,
      timestamp: new Date().toISOString()
    }];
    setFavorites(updatedFavs);
    try {
      await fetch(`${API}/users/me/favorites`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ favorites: JSON.stringify(updatedFavs) })
      });
      showToast("Order saved to favorites!", "success");
    } catch (e) {
      showToast("Failed to save favorite", "error");
    }
  }

  function handleReorderFavorite(fav) {
    if (sessionStatus !== "OPEN") return alert("No open session.");
    setMyItems(fav.items.map(i => ({
      id: Math.random(),
      itemName: i.name,
      size: i.size,
      price: i.price,
      optionId: ITEM_EXTRA_OPTIONS.find(o => o.label === i.option)?.id || "none",
      isExtra: i.option === "إضافة"
    })));
    setOrderNotes(fav.notes || "");
    setIsCartOpen(true);
  }

  function openItemExtras(itemName, size, price) {
    setPendingItem({ itemName, size, price });
  }

  function confirmItemWithExtra(cancelled = false, combos = []) {
    if (cancelled || !pendingItem) {
      setPendingItem(null);
      return;
    }
    const newItems = [];
    combos.forEach(({ optionId, qty }) => {
      for (let i = 0; i < qty; i++) {
        newItems.push({
          id: Date.now() + Math.random() + i,
          itemName: pendingItem.itemName,
          size: pendingItem.size,
          price: pendingItem.price,
          optionId,
          isExtra: false,
          quantity: 1
        });
      }
    });
    if (newItems.length === 0) return;
    setMyItems(items => [...items, ...newItems]);
    const totalQty = combos.reduce((sum, c) => sum + c.qty, 0);
    showToast(`${totalQty}× ${pendingItem.itemName} added to cart`, 'success');
    setPendingItem(null);
  }

  async function handleSubmitOrder() {
    if (myItems.length === 0 || !activeSession) return;
    const payload = {
      name: user.username,
      items: myItems.map(item => ({
        name: item.itemName,
        price: item.price,
        size: item.size || "-",
        option: item.isExtra ? "إضافة" : getOptionLabel(item.optionId),
        quantity: item.quantity || 1
      })),
      subtotal,
      notes: orderNotes || null
    };
    try {
      const res = await fetch(`${API}/sessions/${activeSession.id}/order`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setOrderSubmitted(true);
        setMyItems([]);
        setOrderNotes("");
        setIsCartOpen(false);
        showToast(orderSubmitted ? "Order updated successfully!" : "Order submitted successfully!", "success");
        // Send WhatsApp receipt if user has phone
        if (user?.phone) {
          const lines = [
            `🧺 Your Order — ${restaurant.name}`,
            `━━━━━━━━━━━━━━━`,
            ...payload.items.map(i => `• ${i.quantity > 1 ? i.quantity + '× ' : ''}${i.name} ${i.size !== '-' ? '(' + i.size + ')' : ''}${i.option && i.option !== 'عادي' ? ' — ' + i.option : ''} — ${i.price}ج`),
            ``,
            `Subtotal: ${subtotal.toFixed(1)}ج`,
            `Delivery share: ${(restaurant.deliveryFee / (activeSession?.personOrders?.length || 1)).toFixed(1)}ج`,
            `*Total: ${(subtotal + (restaurant.deliveryFee / (activeSession?.personOrders?.length || 1))).toFixed(1)}ج*`
          ];
          const phone = user.phone.replace(/\+/g, '');
          const url = `https://wa.me/${phone}?text=${encodeURIComponent(lines.join('\n'))}`;
          window.open(url, '_blank');
        }
      } else {
        showToast("Failed to submit order", "error");
      }
    } catch (err) { 
      showToast("Network error submitting order", "error");
    }
  }

  function handleAddMoreItems() {
    const myOrder = activeSession?.personOrders?.find(p => p.name === user.username);
    if (!myOrder) return;
    setMyItems(myOrder.items.map((i, idx) => ({
      id: Date.now() + idx + Math.random(),
      itemName: i.name,
      size: i.size,
      price: i.price,
      optionId: ITEM_EXTRA_OPTIONS.find(o => o.label === i.option)?.id || "none",
      isExtra: i.option === "إضافة",
      quantity: i.quantity || 1
    })));
    setOrderNotes(myOrder.notes || "");
  }

  function updateQuantity(itemId, delta) {
    setMyItems(items => items.map(item => {
      if (item.id !== itemId) return item;
      const newQty = Math.max(1, (item.quantity || 1) + delta);
      return { ...item, quantity: newQty };
    }));
  }

  async function handleClearOrder() {
    if (!activeSession) return;
    await fetch(`${API}/sessions/${activeSession.id}/order/${encodeURIComponent(user.username)}`, { 
      method: "DELETE", headers: getAuthHeaders() 
    });
    setOrderSubmitted(false);
  }

  async function handleDeclarePayment(method) {
    if (!activeSession) return;
    try {
      await fetch(`${API}/sessions/${activeSession.id}/payment`, {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify({ paymentMethod: method })
      });
      showToast(`Payment method logged as ${method.toLowerCase()}`, "success");
    } catch (err) {
      console.error(err);
    }
  }

  const canOrder = sessionStatus === "OPEN";

  return (
    <div className="user-portal" style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      minHeight: '100vh',
      background: 'var(--bg-base)'
    }}>
      {/* Sticky Header */}
      <header style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        background: 'var(--bg-base-90)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--border-strong)',
        padding: 'var(--sp-3) var(--sp-4)',
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--sp-4)'
      }}>
        <Button variant="secondary" size="sm" onClick={onBack} style={{ padding: '8px' }}>←</Button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ 
            fontFamily: 'var(--font-display)', 
            fontSize: '1.25rem', 
            margin: 0,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}>{restaurant.name}</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
            <StatusBadge status={sessionStatus} />
            {activeSession?.deadline && sessionStatus === 'OPEN' && (
              <CountdownTimer deadline={activeSession.deadline} />
            )}
          </div>
        </div>
        <div style={{ fontSize: '1.5rem' }}>
          {restaurant.cuisineType === 'PITZA' ? '🍕' : restaurant.cuisineType === 'BURGER' ? '🍔' : '🍴'}
        </div>
      </header>

      <main className="main-content" style={{ padding: 'var(--sp-4)', paddingBottom: '100px' }}>
        {orderSubmitted && (
          <Card variant="raised" style={{ marginBottom: 'var(--sp-6)', textAlign: 'center', borderColor: 'var(--green-border)', background: 'var(--green-dim)', padding: 'var(--sp-6)' }}>
             <SuccessCheckmark />
             <h2 style={{ 
               fontFamily: 'var(--font-display)',
               color: 'var(--green)', 
               fontSize: '1.5rem', 
               marginBottom: '8px' 
             }}>
               {sessionStatus === "SENT" ? "Deliciousness is coming!" : "Order Locked In"}
             </h2>
             <p style={{ color: 'var(--tx-2)', fontSize: '0.95rem', fontWeight: '500' }}>
               {sessionStatus === "SENT" ? "Your order was successfully sent to the restaurant." : "Sit tight! We'll notify you once it's on the way."}
             </p>
             <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '24px', flexWrap: 'wrap' }}>
                <Button size="sm" variant="secondary" onClick={handleSaveFavorite}>🧡 Save This Order</Button>
                {sessionStatus === "OPEN" && (
                  <>
                    <Button size="sm" variant="ghost" onClick={handleAddMoreItems} style={{ borderColor: 'var(--gold)', color: 'var(--gold)' }}>➕ Add More Items</Button>
                    <Button size="sm" variant="ghost" onClick={handleClearOrder} style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>🗑 Clear Order</Button>
                  </>
                )}
             </div>

             <div style={{ marginTop: 'var(--sp-6)', paddingTop: 'var(--sp-4)', borderTop: '1px solid var(--green-border)' }}>
                <h3 style={{ fontSize: '0.9rem', color: 'var(--tx-1)', marginBottom: 'var(--sp-3)', fontWeight: '800' }}>💸 Send Payment Now</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <a href="http://vf.eg/vfcash?id=mt&qrId=j3XdEK" target="_blank" rel="noreferrer" onClick={() => handleDeclarePayment('VODAFONE')} style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', padding: '12px', background: '#FDE8E7', color: '#D93025', borderRadius: 'var(--r-md)', fontWeight: '700', fontSize: '0.9rem' }}>
                     📱 Vodafone Cash: +201040458295
                  </a>
                  <a href="https://ipn.eg/S/shenawy2002/instapay/52OUvv" target="_blank" rel="noreferrer" onClick={() => handleDeclarePayment('INSTAPAY')} style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', padding: '12px', background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)', color: 'var(--tx-1)', borderRadius: 'var(--r-md)', fontWeight: '700', fontSize: '0.9rem' }}>
                     ⚡ Instapay (@shenawy2002)
                  </a>
                  <button onClick={() => handleDeclarePayment('CASH')} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)', color: 'var(--tx-1)', padding: '12px', borderRadius: 'var(--r-md)', fontWeight: '700', fontSize: '0.9rem', cursor: 'pointer', display: 'flex', alignItems: 'center', fontFamily: 'var(--font-body)' }}>
                     💵 I will pay in Cash
                  </button>
                </div>
             </div>
          </Card>
        )}
        
        {/* Favorites Section */}
        {favorites.length > 0 && favorites.filter(f => f.restaurantId === restaurant.id).length > 0 && (
          <div style={{ marginBottom: 'var(--sp-6)' }}>
            <h4 style={{ 
              color: 'var(--tx-3)', 
              fontSize: '0.75rem', 
              textTransform: 'uppercase', 
              letterSpacing: '0.1em',
              fontWeight: '800',
              marginBottom: 'var(--sp-3)'
            }}>
              ⭐ Quick Reorder (Favorites)
            </h4>
            <div style={{ 
              display: 'flex', 
              gap: 'var(--sp-3)', 
              overflowX: 'auto', 
              paddingBottom: 'var(--sp-2)',
              margin: '0 calc(var(--sp-4) * -1)',
              padding: '0 var(--sp-4)'
            }}>
              {favorites.filter(f => f.restaurantId === restaurant.id).map(fav => (
                <Card 
                  key={fav.id} 
                  onClick={() => handleReorderFavorite(fav)}
                  style={{ 
                    minWidth: '220px', 
                    flexShrink: 0, 
                    cursor: 'pointer', 
                    padding: '12px',
                    border: '1px solid var(--border-strong)',
                    background: 'var(--bg-elevated)'
                  }}
                >
                  <div style={{ fontSize: '0.85rem', fontWeight: '800', color: 'var(--tx-1)', marginBottom: '4px' }}>
                    {fav.items.map(i => i.name).join(' + ')}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--tx-3)' }}>
                    {fav.items.length} items • Click to load
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}
        
        {restaurant.orderMode === 'TEXT' ? (
          <ChatOrder
            user={user}
            activeSession={activeSession}
            sessionStatus={sessionStatus}
          />
        ) : (
          <>
            <div style={{ opacity: canOrder ? 1 : 0.6, pointerEvents: canOrder ? 'auto' : 'none' }}>
              <MenuPanel
                activePerson={user.username}
                cats={cats}
                currentCat={currentCat}
                setCurrentCat={setCurrentCat}
                menuItems={menuItems}
                onOpenItemExtras={openItemExtras}
                onToggleExtra={(extra) => {
                  const existing = myItems.find(i => i.isExtra && i.itemName === extra.nameAr);
                  if (existing) setMyItems(items => items.filter(x => x.id !== existing.id));
                  else setMyItems(items => [...items, { id: Math.random(), itemName: extra.nameAr, price: extra.price, isExtra: true, quantity: 1 }]);
                }}
                isExtraSelected={(name) => myItems.some(i => i.isExtra && i.itemName === name)}
              />
            </div>
            <ItemExtrasModal
              pendingItem={pendingItem}
              onConfirm={confirmItemWithExtra}
            />
          </>
        )}
      </main>

      {/* Floating Cart Button (Mobile) */}
      {myItems.length > 0 && (
        <div style={{
          position: 'fixed',
          bottom: 'var(--sp-4)',
          left: 'var(--sp-4)',
          right: 'var(--sp-4)',
          zIndex: 90
        }}>
          <Button 
            onClick={() => setIsCartOpen(true)}
            style={{ 
              width: '100%', 
              justifyContent: 'space-between', 
              boxShadow: 'var(--shadow-lg)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ 
                background: 'rgba(255,255,255,0.2)', 
                padding: '2px 8px', 
                borderRadius: '8px',
                fontSize: '0.8rem'
              }}>{myItems.length}</span>
              <span>Review Cart</span>
            </div>
            <span>{subtotal}ج</span>
          </Button>
        </div>
      )}

      {/* Cart Bottom Sheet */}
      <BottomSheet 
        isOpen={isCartOpen} 
        onClose={() => setIsCartOpen(false)} 
        title="Your Selection"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {myItems.map(item => (
            <div key={item.id} style={{ 
              padding: '16px', 
              background: 'var(--bg-elevated)', 
              borderRadius: 'var(--r-md)',
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              gap: '12px'
            }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontWeight: '700' }}>{item.itemName}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--tx-3)' }}>
                  {item.isExtra ? "Extra Side" : `${item.size} • ${getOptionLabel(item.optionId)}`}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
                {/* Quantity Stepper */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--bg-base)', borderRadius: 'var(--r-md)', padding: '4px', border: '1px solid var(--border-default)' }}>
                  <button 
                    onClick={() => updateQuantity(item.id, -1)}
                    style={{ background: 'var(--bg-elevated)', border: 'none', color: 'var(--tx-1)', width: '28px', height: '28px', borderRadius: 'var(--r-sm)', cursor: 'pointer', fontWeight: '800', fontSize: '1rem' }}
                  >−</button>
                  <span style={{ fontWeight: '800', color: 'var(--tx-1)', minWidth: '24px', textAlign: 'center', fontSize: '0.9rem' }}>{item.quantity || 1}</span>
                  <button 
                    onClick={() => updateQuantity(item.id, 1)}
                    style={{ background: 'var(--bg-elevated)', border: 'none', color: 'var(--tx-1)', width: '28px', height: '28px', borderRadius: 'var(--r-sm)', cursor: 'pointer', fontWeight: '800', fontSize: '1rem' }}
                  >+</button>
                </div>
                <span style={{ fontWeight: '800', minWidth: '50px', textAlign: 'right' }}>{(item.price * (item.quantity || 1)).toFixed(1)}ج</span>
                <button 
                  onClick={() => setMyItems(items => items.filter(x => x.id !== item.id))} 
                  style={{ background: 'var(--red-dim)', border: 'none', color: 'var(--red)', width: '28px', height: '28px', borderRadius: '50%', cursor: 'pointer' }}
                >×</button>
              </div>
            </div>
          ))}

          <Card variant="flat" style={{ marginTop: 'var(--sp-4)' }}>
            <Input 
              label="Special Instructions"
              value={orderNotes}
              onChange={(e) => setOrderNotes(e.target.value)}
              placeholder="e.g. no onions, extra bread..."
            />
          </Card>

          <div style={{ 
            marginTop: 'auto', 
            paddingTop: 'var(--sp-6)',
            borderTop: '1px solid var(--border-strong)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--tx-2)', fontSize: '0.9rem' }}>Items Subtotal</span>
                <span style={{ fontWeight: '700', color: 'var(--tx-1)' }}>{subtotal.toFixed(1)}ج</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--tx-2)', fontSize: '0.9rem' }}>
                  Estimated Delivery Share
                  <span style={{ color: 'var(--tx-3)', fontSize: '0.75rem', marginLeft: '6px' }}>
                    ({activeSession?.personOrders?.length || 1} participant{activeSession?.personOrders?.length !== 1 ? 's' : ''})
                  </span>
                </span>
                <span style={{ fontWeight: '700', color: 'var(--tx-1)' }}>
                  {(restaurant.deliveryFee / (activeSession?.personOrders?.length || 1)).toFixed(1)}ج
                </span>
              </div>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                paddingTop: '10px',
                borderTop: '1px dashed var(--border-default)'
              }}>
                <span style={{ color: 'var(--tx-2)', fontWeight: '700' }}>Estimated Total</span>
                <span style={{ fontSize: '1.5rem', fontWeight: '800', fontFamily: 'var(--font-display)', color: 'var(--gold)' }}>
                  {(subtotal + (restaurant.deliveryFee / (activeSession?.personOrders?.length || 1))).toFixed(1)}ج
                </span>
              </div>
            </div>
            <Button 
              size="lg" 
              onClick={handleSubmitOrder}
              disabled={!canOrder}
              className="btn-gradient"
              style={{ width: '100%' }}
            >
              {!canOrder ? "Ordering Closed" : orderSubmitted ? "Update My Order" : "Place My Order"}
            </Button>
          </div>
        </div>
      </BottomSheet>
    </div>
  );
}
