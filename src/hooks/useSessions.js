import { useState, useEffect, useRef, useCallback } from 'react';
import { API, getAuthHeaders } from '../api';

/**
 * useSessions — WebSocket-first with polling fallback.
 *
 * Strategy:
 *  1. Fetch initial state via REST on mount.
 *  2. Subscribe to WebSocket topic; on any WS message, trigger a REST refetch
 *     (WS is an invalidation signal only — never merge WS payload directly into state).
 *  3. If WS is unavailable, fall back to 5s polling.
 *  4. When WS reconnects, stop polling.
 */
export function useSessions() {
  const [activeSessions, setActiveSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const wsRef = useRef(null);
  const pollIntervalRef = useRef(null);
  const isMounted = useRef(true);

  const fetchActiveSessions = useCallback(async () => {
    try {
      const res = await fetch(`${API}/sessions/active`, { headers: getAuthHeaders(false) });
      if (res.ok && isMounted.current) {
        const data = await res.json();
        setActiveSessions(data);
      }
    } catch (err) {
      if (isMounted.current) {
        console.warn('[useSessions] REST fetch failed:', err.message);
      }
    } finally {
      if (isMounted.current) setLoading(false);
    }
  }, []);

  const startPolling = useCallback(() => {
    if (pollIntervalRef.current) return; // already polling
    pollIntervalRef.current = setInterval(fetchActiveSessions, 5000);
  }, [fetchActiveSessions]);

  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  const connectWebSocket = useCallback(() => {
    // Only attempt if SockJS/STOMP client is available on the page
    if (!window.SockJS || !window.Stomp) {
      startPolling();
      return;
    }

    try {
      const apiBase = API.replace('/api', '');
      const socket = new window.SockJS(`${apiBase}/ws`);
      const stompClient = window.Stomp.over(socket);
      stompClient.debug = null; // silence STOMP debug logs

      stompClient.connect({}, () => {
        // WS connected — stop polling
        stopPolling();

        stompClient.subscribe('/topic/sessions', () => {
          // Invalidation signal: refetch from REST
          fetchActiveSessions();
        });

        wsRef.current = stompClient;
      }, (error) => {
        // WS error or disconnect — fall back to polling
        console.warn('[useSessions] WebSocket unavailable, using polling fallback:', error);
        startPolling();
      });
    } catch (e) {
      startPolling();
    }
  }, [fetchActiveSessions, startPolling, stopPolling]);

  useEffect(() => {
    isMounted.current = true;
    fetchActiveSessions();
    connectWebSocket();

    return () => {
      isMounted.current = false;
      stopPolling();
      if (wsRef.current) {
        try { wsRef.current.disconnect(); } catch (_) {}
        wsRef.current = null;
      }
    };
  }, [fetchActiveSessions, connectWebSocket, stopPolling]);

  return { activeSessions, loading, refreshSessions: fetchActiveSessions };
}
