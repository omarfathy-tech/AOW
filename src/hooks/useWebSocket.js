import { useEffect, useRef, useState, useCallback } from "react";
import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";

// Derives WS URL from the same host/port the API uses (8080)
const WS_URL = `http://${window.location.hostname}:8080/ws`;

export function useWebSocket(userId) {
  const [connected, setConnected] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const clientRef = useRef(null);
  const subscriptionsRef = useRef([]);

  // Load from localStorage when userId changes
  useEffect(() => {
    if (userId) {
      try {
        const saved = localStorage.getItem(`notifications_${userId}`);
        if (saved) {
          setNotifications(JSON.parse(saved));
        }
      } catch (e) {
        console.error("Failed to load notifications", e);
      }
    } else {
      setNotifications([]);
    }
  }, [userId]);

  // Save to localStorage when notifications change
  useEffect(() => {
    if (userId && notifications.length > 0) {
      localStorage.setItem(`notifications_${userId}`, JSON.stringify(notifications));
    } else if (userId && notifications.length === 0) {
      // If we genuinely cleared notifications, ensure storage is updated,
      // but avoid wiping it if it just hasn't loaded yet.
      const saved = localStorage.getItem(`notifications_${userId}`);
      if (saved && saved !== '[]') {
        localStorage.setItem(`notifications_${userId}`, '[]');
      }
    }
  }, [notifications, userId]);

  const addNotification = useCallback((notification) => {
    setNotifications((prev) => [
      { ...notification, id: Date.now() + Math.random(), readAt: null },
      ...prev,
    ].slice(0, 50));
  }, []);

  useEffect(() => {
    const client = new Client({
      webSocketFactory: () => new SockJS(WS_URL),
      reconnectDelay: 5000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
      onConnect: () => {
        console.log("[WS] Connected");
        setConnected(true);

        // Broadcast notifications (session events: STARTED, CLOSED, SENT, etc.)
        const sub1 = client.subscribe("/topic/notifications", (msg) => {
          addNotification(JSON.parse(msg.body));
        });

        // Session order updates (ORDER_UPDATED / ORDER_REMOVED)
        const sub2 = client.subscribe("/topic/sessions", (msg) => {
          const data = JSON.parse(msg.body);
          // Only push to bell if it's a meaningful event for users
          if (data.type === "ORDER_CONFIRMED") {
            addNotification(data);
          }
        });

        // Per-user private notifications
        if (userId) {
          const sub3 = client.subscribe(
            `/queue/user/${userId}/notifications`,
            (msg) => addNotification(JSON.parse(msg.body))
          );
          subscriptionsRef.current = [sub1, sub2, sub3];
        } else {
          subscriptionsRef.current = [sub1, sub2];
        }
      },
      onDisconnect: () => {
        console.log("[WS] Disconnected");
        setConnected(false);
      },
      onStompError: (frame) => {
        console.error("[WS] STOMP error:", frame);
      },
    });

    client.activate();
    clientRef.current = client;

    return () => {
      subscriptionsRef.current.forEach((s) => { try { s.unsubscribe(); } catch (_) {} });
      subscriptionsRef.current = [];
      clientRef.current?.deactivate();
    };
  }, [userId, addNotification]);

  const sendMessage = useCallback((destination, body) => {
    if (clientRef.current?.connected) {
      clientRef.current.publish({
        destination: `/app${destination}`,
        body: JSON.stringify(body),
      });
    }
  }, []);

  const subscribe = useCallback((topic, callback) => {
    if (clientRef.current?.connected) {
      return clientRef.current.subscribe(topic, (msg) => callback(JSON.parse(msg.body)));
    }
    return null;
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, readAt: Date.now() })));
  }, []);

  const clearNotifications = useCallback(() => setNotifications([]), []);

  return {
    connected,
    notifications,
    unreadCount: notifications.filter((n) => !n.readAt).length,
    sendMessage,
    subscribe,
    markAllRead,
    clearNotifications,
  };
}

export default useWebSocket;
