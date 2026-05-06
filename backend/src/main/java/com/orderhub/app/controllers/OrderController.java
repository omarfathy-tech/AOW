package com.orderhub.app.controllers;

import com.orderhub.app.models.Order;
import com.orderhub.app.models.OrderStatus;
import com.orderhub.app.repositories.OrderRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.ArrayList;
import java.util.Optional;

@RestController
@RequestMapping("/api/orders")
@CrossOrigin(origins = "*")
@Slf4j
public class OrderController {

    @Autowired
    private OrderRepository orderRepository;

    @GetMapping
    public Page<Order> getAllOrders(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by("id").descending());
        return orderRepository.findAll(pageable);
    }

    @PostMapping
    public Order createOrder(@RequestBody Order order) {
        long threadId = Thread.currentThread().getId();
        long start = System.currentTimeMillis();
        log.info("[Thread-{}] INCOMING: Creating order for user {} in session {}", 
            threadId,
            order.getUser() != null ? order.getUser().getId() : "unknown",
            order.getSessionId());
            
        Order saved = orderRepository.save(order);
        
        log.info("[Thread-{}] SUCCESS: Persisted order #{} in {}ms", 
            threadId, saved.getId(), System.currentTimeMillis() - start);
        return saved;
    }

    @GetMapping("/user/{userId}")
    public Page<Order> getOrdersByUser(
            @PathVariable Long userId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by("id").descending());
        return orderRepository.findByUserId(userId, pageable);
    }

    @GetMapping("/restaurant/{restaurantId}")
    public Page<Order> getOrdersByRestaurant(
            @PathVariable Long restaurantId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by("id").descending());
        return orderRepository.findByRestaurantId(restaurantId, pageable);
    }

    @GetMapping("/session/{sessionId}")
    public List<Order> getOrdersBySession(@PathVariable String sessionId) {
        return orderRepository.findBySessionId(sessionId);
    }

    @PutMapping("/{id}/status")
    public ResponseEntity<Order> updateOrderStatus(@PathVariable Long id, @RequestBody OrderStatus status) {
        log.info("Updating status for order {} to {}", id, status);
        Optional<Order> orderOpt = orderRepository.findById(id);
        if (orderOpt.isPresent()) {
            Order order = orderOpt.get();
            order.setStatus(status);
            return ResponseEntity.ok(orderRepository.save(order));
        }
        return ResponseEntity.notFound().build();
    }

    @PostMapping("/{id}/cancel")
    public ResponseEntity<?> cancelOrder(@PathVariable Long id) {
        Optional<Order> orderOpt = orderRepository.findById(id);
        if (orderOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        Order order = orderOpt.get();
        if (order.getStatus() == OrderStatus.CANCELLED || order.getStatus() == OrderStatus.DELIVERED) {
            return ResponseEntity.badRequest().body(Map.of("error", "Order cannot be cancelled in its current state"));
        }
        order.setStatus(OrderStatus.CANCELLED);
        log.info("Order {} cancelled", id);
        return ResponseEntity.ok(orderRepository.save(order));
    }

    @PostMapping("/bulk/status")
    public ResponseEntity<List<Order>> bulkUpdateStatus(@RequestBody Map<String, Object> payload) {
        @SuppressWarnings("unchecked")
        List<Integer> rawIds = (List<Integer>) payload.get("orderIds");
        String statusStr = (String) payload.get("status");

        if (rawIds == null || statusStr == null) {
            return ResponseEntity.badRequest().build();
        }

        try {
            OrderStatus status = OrderStatus.valueOf(statusStr.toUpperCase());
            List<Order> updatedOrders = new ArrayList<>();
            for (Integer rawId : rawIds) {
                Long orderId = rawId.longValue();
                orderRepository.findById(orderId).ifPresent(order -> {
                    order.setStatus(status);
                    updatedOrders.add(orderRepository.save(order));
                });
            }
            return ResponseEntity.ok(updatedOrders);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        }
    }
}
