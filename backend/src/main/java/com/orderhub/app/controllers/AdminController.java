package com.orderhub.app.controllers;

import com.orderhub.app.models.OrderSession;
import com.orderhub.app.models.PersonOrder;
import com.orderhub.app.models.Restaurant;
import com.orderhub.app.repositories.OrderSessionRepository;
import com.orderhub.app.repositories.RestaurantRepository;
import com.orderhub.app.repositories.UserRepository;
import com.orderhub.app.models.User;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

import java.time.LocalDateTime;
import java.util.List;

@RestController
@RequestMapping("/api/admin")
@CrossOrigin(origins = "*")
public class AdminController {

    @Autowired
    private OrderSessionRepository sessionRepository;

    @Autowired
    private RestaurantRepository restaurantRepository;
    
    @Autowired
    private UserRepository userRepository;
    
    @Autowired
    private com.orderhub.app.repositories.OrderRepository orderRepository;

    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    @GetMapping("/sessions")
    public List<OrderSession> getAllSessions() {
        return sessionRepository.findAll();
    }

    @GetMapping("/sessions/history")
    public Page<OrderSession> getSessionHistory(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by("id").descending());
        return sessionRepository.findByStatus("SENT", pageable);
    }

    @PostMapping("/sessions")
    public OrderSession createSession(@RequestBody OrderSession request) {
        Restaurant restaurant = restaurantRepository.findById(request.getRestaurantId())
                .orElseThrow(() -> new RuntimeException("Restaurant not found"));

        OrderSession newSession = new OrderSession();
        newSession.setRestaurantId(restaurant.getId());
        String sessionName = (request.getSessionName() != null && !request.getSessionName().isEmpty())
                ? request.getSessionName() : restaurant.getName() + " Session";
        newSession.setSessionName(sessionName);
        newSession.setOpenedBy(request.getOpenedBy());
        newSession.setDeliveryFee(restaurant.getDeliveryFee());
        newSession.setTotal(restaurant.getDeliveryFee());

        OrderSession saved = sessionRepository.save(newSession);

        messagingTemplate.convertAndSend("/topic/notifications", Map.of(
                "type", "SESSION_STARTED",
                "sessionId", saved.getId(),
                "restaurantName", restaurant.getName(),
                "message", "New session started for " + restaurant.getName(),
                "timestamp", LocalDateTime.now().toString()
        ));

        return saved;
    }

    @PutMapping("/sessions/{id}/status")
    public OrderSession updateSessionStatus(@PathVariable String id, @RequestParam String status) {
        OrderSession session = sessionRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Session not found"));
        session.setStatus(status);
        return sessionRepository.save(session);
    }

    @PatchMapping("/sessions/{id}/close")
    public ResponseEntity<OrderSession> closeSession(@PathVariable String id) {
        OrderSession session = sessionRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Session not found"));
        session.setStatus("CLOSED");
        session.setClosedAt(LocalDateTime.now());
        OrderSession saved = sessionRepository.save(session);
        messagingTemplate.convertAndSend("/topic/notifications", Map.of(
                "type", "SESSION_CLOSED",
                "sessionId", saved.getId(),
                "sessionName", saved.getSessionName(),
                "message", "Session closed: " + saved.getSessionName(),
                "timestamp", LocalDateTime.now().toString()
        ));
        return ResponseEntity.ok(saved);
    }

    @PatchMapping("/sessions/{id}/reopen")
    public ResponseEntity<OrderSession> reopenSession(@PathVariable String id) {
        OrderSession session = sessionRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Session not found"));
        session.setStatus("OPEN");
        session.setClosedAt(null);
        OrderSession saved = sessionRepository.save(session);
        messagingTemplate.convertAndSend("/topic/notifications", Map.of(
                "type", "SESSION_REOPENED",
                "sessionId", saved.getId(),
                "sessionName", saved.getSessionName(),
                "message", "Session reopened: " + saved.getSessionName(),
                "timestamp", LocalDateTime.now().toString()
        ));
        return ResponseEntity.ok(saved);
    }

    @PatchMapping("/sessions/{id}/send")
    @Transactional
    public ResponseEntity<OrderSession> sendSession(@PathVariable String id) {
        OrderSession session = sessionRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Session not found"));
        session.setStatus("SENT");
        session.setSentAt(LocalDateTime.now());

        int personCount = session.getPersonOrders().size();
        double dlvPP = personCount > 0 ? session.getDeliveryFee() / personCount : 0;

        // Mark all person orders as CONFIRMED
        for (PersonOrder po : session.getPersonOrders()) {
            po.setStatus("CONFIRMED");

            // Sync to MySQL for long-term history/auditing
            try {
                User user = userRepository.findByUsername(po.getName()).orElse(null);
                if (user != null) {
                    double userDiscPct = po.getDiscountPercent() != null ? po.getDiscountPercent() : 0.0;
                    double userFlatDisc = po.getFlatDiscountPerUser() != null ? po.getFlatDiscountPerUser() : 0.0;
                    double discountedTotal = calculateDiscountedTotal(po.getSubtotal(), dlvPP, userDiscPct, userFlatDisc);

                    com.orderhub.app.models.Order mysqlOrder = new com.orderhub.app.models.Order();
                    mysqlOrder.setUser(user);
                    mysqlOrder.setRestaurantId(session.getRestaurantId());
                    mysqlOrder.setSessionId(session.getId());
                    mysqlOrder.setStatus(com.orderhub.app.models.OrderStatus.DELIVERED);
                    mysqlOrder.setTotalPrice(discountedTotal);
                    mysqlOrder.setNotes(po.getNotes());

                    List<com.orderhub.app.models.OrderLineItem> sqlItems = new java.util.ArrayList<>();
                    for (Map<String, Object> itemMap : po.getItems()) {
                        com.orderhub.app.models.OrderLineItem sqlItem = new com.orderhub.app.models.OrderLineItem();
                        sqlItem.setItemName((String) itemMap.get("name"));
                        sqlItem.setSize((String) itemMap.get("size"));
                        sqlItem.setUnitPrice(((Number) itemMap.get("price")).doubleValue());
                        sqlItem.setExtras((String) itemMap.get("option"));
                        Number qty = (Number) itemMap.get("quantity");
                        sqlItem.setQuantity(qty != null ? qty.intValue() : 1);
                        sqlItem.setOrder(mysqlOrder);
                        sqlItems.add(sqlItem);
                    }
                    mysqlOrder.setItems(sqlItems);
                    orderRepository.save(mysqlOrder);
                }
            } catch (Exception e) {
                e.printStackTrace();
            }
        }

        OrderSession saved = sessionRepository.save(session);

        // Send in-app private "customer service style" order details to each user
        String restaurantName = restaurantRepository.findById(saved.getRestaurantId())
            .map(Restaurant::getName)
            .orElse(saved.getSessionName());
        for (PersonOrder po : saved.getPersonOrders()) {
            try {
                User user = userRepository.findByUsername(po.getName()).orElse(null);
                if (user == null || user.getId() == null) continue;

                double userDiscPct = po.getDiscountPercent() != null ? po.getDiscountPercent() : 0.0;
                double userFlatDisc = po.getFlatDiscountPerUser() != null ? po.getFlatDiscountPerUser() : 0.0;
                String details = buildOrderDetailsMessage(po, restaurantName, saved.getDeliveryFee(), personCount, userDiscPct, userFlatDisc);

                messagingTemplate.convertAndSend("/queue/user/" + user.getId() + "/notifications", Map.of(
                    "type", "ORDER_DETAILS",
                    "sessionId", saved.getId(),
                    "restaurantName", restaurantName,
                    "message", "Your order details are ready from " + restaurantName,
                    "details", details,
                    "sender", "OrderHub Support",
                    "timestamp", LocalDateTime.now().toString()
                ));
            } catch (Exception ignored) {
                // Never block session send if one user's message fails.
            }
        }

        messagingTemplate.convertAndSend("/topic/notifications", Map.of(
                "type", "SESSION_SENT",
                "sessionId", saved.getId(),
                "sessionName", saved.getSessionName(),
                "message", "Order sent to restaurant: " + saved.getSessionName(),
                "timestamp", LocalDateTime.now().toString()
        ));
        return ResponseEntity.ok(saved);
    }

    @DeleteMapping("/sessions/{id}")
    public ResponseEntity<?> deleteSession(@PathVariable String id) {
        if (!sessionRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        sessionRepository.deleteById(id);
        return ResponseEntity.ok(Map.of("message", "Session deleted successfully"));
    }

    @PatchMapping("/sessions/{id}/orders/{name}/payment")
    @Transactional
    public ResponseEntity<?> updatePersonPayment(
            @PathVariable String id,
            @PathVariable String name,
            @RequestBody Map<String, Object> request) {

        OrderSession session = sessionRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Session not found"));

        session.getPersonOrders().stream()
                .filter(p -> p.getName().equals(name))
                .findFirst()
                .ifPresent(p -> {
                    if (request.containsKey("isPaid")) p.setPaid((Boolean) request.get("isPaid"));
                    if (request.containsKey("paymentMethod")) p.setPaymentMethod((String) request.get("paymentMethod"));
                    if (request.containsKey("amountReceived")) p.setAmountReceived(((Number) request.get("amountReceived")).doubleValue());
                    if (request.containsKey("discountPercent")) p.setDiscountPercent(((Number) request.get("discountPercent")).doubleValue());
                    if (request.containsKey("flatDiscountPerUser")) p.setFlatDiscountPerUser(((Number) request.get("flatDiscountPerUser")).doubleValue());
                    if (request.containsKey("subtotal")) p.setSubtotal(((Number) request.get("subtotal")).doubleValue());
                });

        // Recalculate session total
        double newTotal = session.getDeliveryFee();
        for (PersonOrder p : session.getPersonOrders()) {
            newTotal += p.getSubtotal();
        }
        session.setTotal(newTotal);

        return ResponseEntity.ok(sessionRepository.save(session));
    }

    private double calculateDiscountedTotal(double subtotal, double deliveryShare, double discountPercent, double flatDiscount) {
        double afterPercent = subtotal + deliveryShare;
        if (discountPercent > 0) {
            afterPercent = afterPercent * (1 - discountPercent / 100.0);
        }
        double afterFlat = afterPercent - flatDiscount;
        return Math.max(0, Math.ceil(afterFlat));
    }

    private String buildOrderDetailsMessage(PersonOrder personOrder, String restaurantName, double deliveryFee, int personCount, double discountPercent, double flatDiscount) {
        StringBuilder sb = new StringBuilder();
        sb.append("Order details - ").append(restaurantName).append("\n");
        sb.append("-------------------------\n");

        if (personOrder.getTextOrder() != null && !personOrder.getTextOrder().isBlank()) {
            sb.append(personOrder.getTextOrder()).append("\n");
        } else if (personOrder.getItems() != null) {
            for (Map<String, Object> item : personOrder.getItems()) {
                String name = String.valueOf(item.getOrDefault("name", "Item"));
                String size = String.valueOf(item.getOrDefault("size", "-"));
                String option = String.valueOf(item.getOrDefault("option", ""));
                int qty = item.get("quantity") instanceof Number n ? n.intValue() : 1;
                double price = item.get("price") instanceof Number n ? n.doubleValue() : 0.0;
                sb.append("- ").append(qty).append("x ").append(name)
                    .append(" (").append(size).append(")");
                if (!option.isBlank() && !"null".equalsIgnoreCase(option) && !"عادي".equals(option)) {
                    sb.append(" ").append(option);
                }
                sb.append(" : ").append(Math.round(price * qty)).append(" EGP\n");
            }
        }

        double deliveryShare = personCount > 0 ? deliveryFee / personCount : 0;
        double base = personOrder.getSubtotal() + deliveryShare;
        double afterPct = discountPercent > 0 ? base * (1 - discountPercent / 100.0) : base;
        double afterFlat = afterPct - flatDiscount;
        double total = Math.max(0, Math.ceil(afterFlat));

        sb.append("\nSubtotal: ").append(Math.round(personOrder.getSubtotal())).append(" EGP");
        sb.append("\nDelivery share: ").append(Math.round(deliveryShare)).append(" EGP");
        if (discountPercent > 0) sb.append("\nDiscount: -").append(discountPercent).append("%");
        if (flatDiscount > 0) sb.append("\nCompensation: -").append(Math.round(flatDiscount)).append(" EGP");
        sb.append("\nTotal: ").append((long) total).append(" EGP");

        if (personOrder.getNotes() != null && !personOrder.getNotes().isBlank()) {
            sb.append("\nNotes: ").append(personOrder.getNotes());
        }
        return sb.toString();
    }
}
