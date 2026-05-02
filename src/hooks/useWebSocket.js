import { useEffect, useRef, useState, useCallback } from "react";
import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";

const WS_URL = "http://192.168.1.8:8080/ws";

export function useWebSocket(userId) {
  const [connected, setConnected] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const clientRef = useRef(null);

  useEffect(() => {
    const client = new Client({
      webSocketFactory: () => new SockJS(WS_URL),
      reconnectDelay: 5000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
      onConnect: () => {
        console.log("WebSocket Connected");
        setConnected(true);

        // Subscribe to user-specific notifications
        if (userId) {
          client.subscribe(`/queue/user/${userId}/notifications`, (message) => {
            const notification = JSON.parse(message.body);
            setNotifications((prev) => [notification, ...prev].slice(0, 10));
          });

          // Subscribe to user orders
          client.subscribe(`/topic/user/${userId}/orders`, (message) => {
            const orderUpdate = JSON.parse(message.body);
            console.log("Order update for user:", orderUpdate);
          });
        }

        // Subscribe to broadcast topics
        client.subscribe("/topic/orders/new", (message) => {
          console.log("New order:", JSON.parse(message.body));
        });
      },
      onDisconnect: () => {
        console.log("WebSocket Disconnected");
        setConnected(false);
      },
      onStompError: (frame) => {
        console.error("STOMP Error:", frame);
      },
    });

    client.activate();
    clientRef.current = client;

    return () => {
      if (clientRef.current) {
        clientRef.current.deactivate();
      }
    };
  }, [userId]);

  const sendMessage = useCallback((destination, body) => {
    if (clientRef.current && clientRef.current.connected) {
      clientRef.current.publish({
        destination: `/app${destination}`,
        body: JSON.stringify(body),
      });
    }
  }, []);

  const subscribe = useCallback((topic, callback) => {
    if (clientRef.current && clientRef.current.connected) {
      return clientRef.current.subscribe(topic, (message) => {
        callback(JSON.parse(message.body));
      });
    }
    return null;
  }, []);

  return {
    connected,
    notifications,
    sendMessage,
    subscribe,
    clearNotifications: () => setNotifications([]),
  };
}

export default useWebSocket;
