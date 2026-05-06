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

        return sessionRepository.save(newSession);
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
        return ResponseEntity.ok(sessionRepository.save(session));
    }

    @PatchMapping("/sessions/{id}/reopen")
    public ResponseEntity<OrderSession> reopenSession(@PathVariable String id) {
        OrderSession session = sessionRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Session not found"));
        session.setStatus("OPEN");
        session.setClosedAt(null);
        return ResponseEntity.ok(sessionRepository.save(session));
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
        double discountPct = session.getDiscountPercent() != null ? session.getDiscountPercent() : 0.0;
        double flatDiscount = session.getFlatDiscountPerUser() != null ? session.getFlatDiscountPerUser() : 0.0;

        // Mark all person orders as CONFIRMED
        for (PersonOrder po : session.getPersonOrders()) {
            po.setStatus("CONFIRMED");

            // Sync to MySQL for long-term history/auditing
            try {
                User user = userRepository.findByUsername(po.getName()).orElse(null);
                if (user != null) {
                    double discountedTotal = calculateDiscountedTotal(po.getSubtotal(), dlvPP, discountPct, flatDiscount);

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

        return ResponseEntity.ok(sessionRepository.save(session));
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
                });

        return ResponseEntity.ok(sessionRepository.save(session));
    }

    @PatchMapping("/sessions/{id}/discounts")
    public ResponseEntity<?> updateSessionDiscounts(
            @PathVariable String id,
            @RequestBody Map<String, Object> request) {

        OrderSession session = sessionRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Session not found"));

        if (request.containsKey("discountPercent")) {
            session.setDiscountPercent(((Number) request.get("discountPercent")).doubleValue());
        }
        if (request.containsKey("flatDiscountPerUser")) {
            session.setFlatDiscountPerUser(((Number) request.get("flatDiscountPerUser")).doubleValue());
        }

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
}
