import { useState, useEffect } from 'react';
import { API, getAuthHeaders } from '../api.js';
import Card from './common/Card';
import { useSessions } from '../hooks/useSessions';

function Shimmer() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
      {[1, 2, 3].map(i => (
        <Card key={i} variant="raised" style={{ height: '120px', position: 'relative', overflow: 'hidden' }}>
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.05), transparent)',
            animation: 'shimmer 1.5s infinite',
            transform: 'translateX(-100%)'
          }} />
        </Card>
      ))}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes shimmer { 100% { transform: translateX(100%); } }
      `}} />
    </div>
  );
}

export default function RestaurantList({ onSelect }) {
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const { activeSessions } = useSessions();

  useEffect(() => {
    fetch(`${API}/restaurants`, { headers: getAuthHeaders(false) })
      .then(res => res.json())
      .then(data => {
        setRestaurants(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <Shimmer />;

  return (
    <div className="restaurant-list" style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      gap: 'var(--sp-4)' 
    }}>
      {restaurants.length === 0 && (
        <div style={{ textAlign: 'center', padding: 'var(--sp-12)', color: 'var(--tx-3)' }}>
          <div style={{ fontSize: '4rem', marginBottom: 'var(--sp-4)' }}>🍽️</div>
          <h3>No open kitchens yet</h3>
          <p>Check back later or ask an admin to start a session.</p>
        </div>
      )}
      {restaurants.map(restaurant => {
        const session = activeSessions.find(s => s.restaurantId === restaurant.id);
        const isOpen = session?.status === 'OPEN';

        return (
          <Card 
            key={restaurant.id} 
            onClick={() => onSelect(restaurant)}
            variant="raised"
            style={{ 
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--sp-4)',
              padding: 'var(--sp-4)',
              cursor: 'pointer'
            }}
          >
            <div style={{ fontSize: '2.5rem', minWidth: '60px', textAlign: 'center' }}>
              {restaurant.cuisineType === 'PITZA' ? '🍕' : 
               restaurant.cuisineType === 'BURGER' ? '🍔' : 
               restaurant.cuisineType === 'CHICKEN' ? '🍗' : '🧺'}
            </div>
            
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <h3 style={{ 
                  fontFamily: 'var(--font-display)', 
                  fontSize: '1.25rem',
                  margin: 0,
                  color: 'var(--tx-1)'
                }}>{restaurant.name}</h3>
                
                {restaurant.deliveryFee > 0 && (
                  <span style={{
                    background: 'var(--bg-base)',
                    color: 'var(--tx-1)',
                    fontSize: '0.75rem',
                    fontWeight: '800',
                    padding: '4px 10px',
                    borderRadius: 'var(--r-full)',
                    border: '1px solid var(--border-subtle)',
                    whiteSpace: 'nowrap',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    💵 {restaurant.deliveryFee}ج Delivery
                  </span>
                )}
              </div>
              
              <p style={{ 
                color: 'var(--tx-2)', 
                fontSize: '0.85rem', 
                margin: '4px 0',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}>{restaurant.description}</p>
              
              {isOpen && (
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '6px',
                  marginTop: '4px'
                }}>
                  <div style={{ 
                    width: '6px', 
                    height: '6px', 
                    borderRadius: '50%', 
                    backgroundColor: 'var(--green)',
                    animation: 'status-pulse 2s infinite'
                  }} />
                  <span style={{ 
                    fontSize: '0.75rem', 
                    color: 'var(--green)', 
                    fontWeight: '700' 
                  }}>
                    Active Session • {session.participants || 0} ordering
                  </span>
                </div>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
