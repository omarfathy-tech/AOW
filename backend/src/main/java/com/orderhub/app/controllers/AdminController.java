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
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.http.ResponseEntity;
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
    private MongoTemplate mongoTemplate;

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

        return mongoTemplate.save(newSession);
    }

    @PutMapping("/sessions/{id}/status")
    public OrderSession updateSessionStatus(@PathVariable String id, @RequestParam String status) {
        OrderSession session = sessionRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Session not found"));
        session.setStatus(status);
        return mongoTemplate.save(session);
    }

    @PatchMapping("/sessions/{id}/close")
    public ResponseEntity<OrderSession> closeSession(@PathVariable String id) {
        OrderSession session = sessionRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Session not found"));
        session.setStatus("CLOSED");
        session.setClosedAt(LocalDateTime.now());
        return ResponseEntity.ok(mongoTemplate.save(session));
    }

    @PatchMapping("/sessions/{id}/reopen")
    public ResponseEntity<OrderSession> reopenSession(@PathVariable String id) {
        OrderSession session = sessionRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Session not found"));
        session.setStatus("OPEN");
        session.setClosedAt(null);
        return ResponseEntity.ok(mongoTemplate.save(session));
    }

    @PatchMapping("/sessions/{id}/send")
    public ResponseEntity<OrderSession> sendSession(@PathVariable String id) {
        OrderSession session = sessionRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Session not found"));
        session.setStatus("SENT");
        session.setSentAt(LocalDateTime.now());
        // Mark all person orders as CONFIRMED
        for (PersonOrder po : session.getPersonOrders()) {
            po.setStatus("CONFIRMED");
            
            // Sync to MySQL for long-term history/auditing
            try {
                User user = userRepository.findByUsername(po.getName()).orElse(null);
                if (user != null) {
                    com.orderhub.app.models.Order mysqlOrder = new com.orderhub.app.models.Order();
                    mysqlOrder.setUser(user);
                    mysqlOrder.setRestaurantId(session.getRestaurantId());
                    mysqlOrder.setSessionId(session.getId());
                    mysqlOrder.setStatus(com.orderhub.app.models.OrderStatus.DELIVERED);
                    mysqlOrder.setTotalPrice(po.getSubtotal() + (session.getDeliveryFee() / session.getPersonOrders().size()));
                    mysqlOrder.setNotes(po.getNotes());
                    
                    List<com.orderhub.app.models.OrderLineItem> sqlItems = new java.util.ArrayList<>();
                    for (Map<String, Object> itemMap : po.getItems()) {
                        com.orderhub.app.models.OrderLineItem sqlItem = new com.orderhub.app.models.OrderLineItem();
                        sqlItem.setItemName((String) itemMap.get("name"));
                        sqlItem.setSize((String) itemMap.get("size"));
                        sqlItem.setUnitPrice(((Number) itemMap.get("price")).doubleValue());
                        // Option might be stored in extras or separate field
                        sqlItem.setExtras((String) itemMap.get("option"));
                        sqlItem.setQuantity(1);
                        sqlItem.setOrder(mysqlOrder);
                        sqlItems.add(sqlItem);
                    }
                    mysqlOrder.setItems(sqlItems);
                    orderRepository.save(mysqlOrder);
                }
            } catch (Exception e) {
                // Log and continue - don't block the main session logic if history sync fails
                e.printStackTrace();
            }
        }
        
        return ResponseEntity.ok(mongoTemplate.save(session));
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
    public ResponseEntity<?> updatePersonPayment(
            @PathVariable String id,
            @PathVariable String name,
            @RequestBody Map<String, Object> request) {

        Query query = Query.query(Criteria.where("_id").is(id).and("personOrders.name").is(name));
        Update update = new Update();

        if (request.containsKey("isPaid")) {
            update.set("personOrders.$.isPaid", request.get("isPaid"));
        }
        if (request.containsKey("paymentMethod")) {
            update.set("personOrders.$.paymentMethod", request.get("paymentMethod"));
        }
        if (request.containsKey("amountReceived")) {
            update.set("personOrders.$.amountReceived", request.get("amountReceived"));
        }

        mongoTemplate.updateFirst(query, update, OrderSession.class);

        OrderSession updatedSession = mongoTemplate.findOne(Query.query(Criteria.where("_id").is(id)), OrderSession.class);
        return ResponseEntity.ok(updatedSession);
    }
}
