package com.orderhub.app.controllers;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

import java.time.LocalDateTime;
import java.util.Map;

@Controller
public class WebSocketController {

    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    // Send order status update to all subscribers
    public void sendOrderStatusUpdate(Long orderId, String status, Long userId) {
        Map<String, Object> message = Map.of(
                "orderId", orderId,
                "status", status,
                "timestamp", LocalDateTime.now().toString(),
                "type", "ORDER_STATUS_UPDATE"
        );
        messagingTemplate.convertAndSend("/topic/orders/" + orderId, message);
        messagingTemplate.convertAndSend("/topic/user/" + userId + "/orders", message);
    }

    // Send notification to specific user
    public void sendNotificationToUser(Long userId, Map<String, Object> notification) {
        messagingTemplate.convertAndSend("/queue/user/" + userId + "/notifications", notification);
    }

    // Broadcast to all connected clients
    public void broadcastMessage(String destination, Map<String, Object> message) {
        messagingTemplate.convertAndSend("/topic/" + destination, message);
    }

    // Send session update
    public void sendSessionUpdate(String sessionId, String status, Map<String, Object> data) {
        Map<String, Object> message = Map.of(
                "sessionId", sessionId,
                "status", status,
                "data", data,
                "timestamp", LocalDateTime.now().toString(),
                "type", "SESSION_UPDATE"
        );
        messagingTemplate.convertAndSend("/topic/sessions/" + sessionId, message);
    }


    // WebSocket endpoint for client subscriptions
    @MessageMapping("/subscribe")
    @SendTo("/topic/subscriptions")
    public Map<String, Object> handleSubscription(@Payload Map<String, Object> payload) {
        return Map.of(
                "status", "subscribed",
                "payload", payload,
                "timestamp", LocalDateTime.now().toString()
        );
    }

    // Receive heartbeat from clients
    @MessageMapping("/heartbeat")
    public void receiveHeartbeat(@Payload Map<String, Object> payload) {
        // Process heartbeat - could be used for connection tracking
        String userId = (String) payload.get("userId");
        messagingTemplate.convertAndSend("/queue/user/" + userId + "/heartbeat", 
                Map.of("status", "ack", "serverTime", LocalDateTime.now().toString()));
    }
}
