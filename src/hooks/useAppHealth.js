import { useState, useEffect } from 'react';
import { API, getAuthHeaders } from '../api';

export function useAppHealth(user) {
  const [connectionOk, setConnectionOk] = useState(true);

  useEffect(() => {
    if (!user) return;
    
    const check = () => {
      fetch(`${API}/sessions/active/status`, {
        headers: getAuthHeaders()
      })
        .then(() => setConnectionOk(true))
        .catch(() => setConnectionOk(false));
    };
    
    check();
    const interval = setInterval(check, 10000);
    return () => clearInterval(interval);
  }, [user]);

  return connectionOk;
}
