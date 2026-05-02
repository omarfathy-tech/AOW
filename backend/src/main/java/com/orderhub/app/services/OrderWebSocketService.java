package com.orderhub.app.services;

import com.orderhub.app.controllers.WebSocketController;
import com.orderhub.app.models.Order;
import com.orderhub.app.models.OrderStatus;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.Map;

@Service
public class OrderWebSocketService {

    @Autowired
    private WebSocketController webSocketController;

    public void notifyOrderStatusChange(Order order) {
        webSocketController.sendOrderStatusUpdate(
                order.getId(),
                order.getStatus().toString(),
                order.getUser().getId()
        );
    }

    public void notifyOrderCreated(Order order) {
        Map<String, Object> message = Map.of(
                "orderId",      order.getId(),
                "userId",       order.getUser().getId(),
                "restaurantId", order.getRestaurantId(),
                "sessionId",    order.getSessionId() != null ? order.getSessionId() : "",
                "status",       order.getStatus().toString(),
                "type",         "ORDER_CREATED"
        );
        webSocketController.broadcastMessage("orders/new", message);
    }

    public void notifyOrderCancelled(Long orderId, Long userId) {
        Map<String, Object> message = Map.of(
                "orderId", orderId,
                "userId",  userId,
                "status",  OrderStatus.CANCELLED.toString(),
                "type",    "ORDER_CANCELLED"
        );
        webSocketController.broadcastMessage("orders/cancelled", message);
        webSocketController.sendOrderStatusUpdate(orderId, OrderStatus.CANCELLED.toString(), userId);
    }

    public void notifyOrderReady(Order order) {
        Map<String, Object> message = Map.of(
                "orderId", order.getId(),
                "userId",  order.getUser().getId(),
                "type",    "ORDER_READY",
                "message", "Your order is ready for pickup/delivery"
        );
        webSocketController.sendNotificationToUser(order.getUser().getId(), message);
        webSocketController.sendOrderStatusUpdate(order.getId(), "READY", order.getUser().getId());
    }
}
