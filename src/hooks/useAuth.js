import { useState, useEffect } from 'react';
import { API, getAuthHeaders } from '../api';

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      const storedUser = localStorage.getItem('user');
      const token = localStorage.getItem('token');
      
      if (storedUser && token) {
        try {
          const res = await fetch(`${API}/users/me`, {
             headers: { 'Authorization': `Bearer ${token}` }
          });
          
          if (res.ok) {
            const userData = await res.json();
            setUser(userData);
          } else {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
          }
        } catch (err) {
          console.error('Auth validation failed:', err);
        }
      }
      setLoading(false);
    };
    
    initAuth();
  }, []);

  const login = (userData) => {
    setUser(userData);
  };

  const logout = async () => {
    try {
      await fetch(`${API}/users/logout`, { 
        method: 'POST',
        headers: getAuthHeaders()
      });
    } catch (err) {
      console.warn("Logout request failed", err);
    }
    
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  return { user, loading, login, logout, isAdmin: user?.role === "ADMIN" || user?.role === "ROLE_ADMIN" };
}
