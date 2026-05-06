package com.orderhub.app.controllers;

import com.orderhub.app.models.OrderSession;
import com.orderhub.app.models.PersonOrder;
import com.orderhub.app.repositories.OrderSessionRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/sessions")
@CrossOrigin(origins = "*")
@Slf4j
public class SessionController {

    @Autowired
    private OrderSessionRepository sessionRepository;

    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    @GetMapping("/active")
    public List<OrderSession> getActiveSessions() {
        return sessionRepository.findByStatusIn(List.of("OPEN", "CLOSED"));
    }

    @GetMapping("/active/status")
    public ResponseEntity<Map<String, Object>> getActiveSessionStatus() {
        List<OrderSession> active = sessionRepository.findByStatusIn(List.of("OPEN", "CLOSED"));
        log.info("Active status poll. Found {} active sessions.", active.size());

        if (!active.isEmpty()) {
            OrderSession session = active.get(0);
            return ResponseEntity.ok(Map.of(
                "sessionId", session.getId(),
                "status", session.getStatus(),
                "participants", session.getPersonOrders().size()
            ));
        }

        List<OrderSession> sent = sessionRepository.findByStatus("SENT");
        Optional<OrderSession> recentSent = sent.stream()
            .filter(s -> s.getSentAt() != null)
            .max((a, b) -> a.getSentAt().compareTo(b.getSentAt()));

        if (recentSent.isPresent()) {
            OrderSession session = recentSent.get();
            return ResponseEntity.ok(Map.of(
                "sessionId", session.getId(),
                "status", "SENT",
                "participants", session.getPersonOrders().size()
            ));
        }

        return ResponseEntity.ok(Map.of("status", "NONE"));
    }

    @GetMapping("/{id}")
    public ResponseEntity<OrderSession> getSessionById(@PathVariable String id) {
        return sessionRepository.findById(id)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/{id}/order")
    @Transactional
    public ResponseEntity<?> addOrUpdatePersonOrder(
            @PathVariable String id,
            @RequestBody PersonOrder personOrder) {

        Optional<OrderSession> optSession = sessionRepository.findById(id);
        if (optSession.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        OrderSession session = optSession.get();

        if ("CLOSED".equals(session.getStatus()) || "SENT".equals(session.getStatus())) {
            return ResponseEntity.badRequest()
                .body(Map.of("error", "Session is not open for new orders"));
        }

        if (personOrder.getStatus() == null) {
            personOrder.setStatus("PENDING");
        }

        // JPA Logic: Remove existing order for same person, then add new one
        session.getPersonOrders().removeIf(p -> p.getName().equals(personOrder.getName()));
        
        personOrder.setSession(session);
        session.getPersonOrders().add(personOrder);

        // Recalculate total
        double newTotal = session.getDeliveryFee();
        for (PersonOrder p : session.getPersonOrders()) {
            newTotal += p.getSubtotal();
        }
        session.setTotal(newTotal);

        OrderSession finalSession = sessionRepository.save(session);
        messagingTemplate.convertAndSend("/topic/sessions", Map.of(
                "type", "ORDER_UPDATED",
                "sessionId", id,
                "personName", personOrder.getName()
        ));
        log.info("Order saved for person '{}' in session '{}'.", personOrder.getName(), id);
        return ResponseEntity.ok(finalSession);
    }

    @DeleteMapping("/{id}/order/{name}")
    @Transactional
    public ResponseEntity<?> removePersonOrder(
            @PathVariable String id,
            @PathVariable String name) {

        Optional<OrderSession> optSession = sessionRepository.findById(id);
        if (optSession.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        OrderSession session = optSession.get();
        session.getPersonOrders().removeIf(p -> p.getName().equals(name));

        // Recalculate total
        double newTotal = session.getDeliveryFee();
        for (PersonOrder p : session.getPersonOrders()) {
            newTotal += p.getSubtotal();
        }
        session.setTotal(newTotal);

        OrderSession finalSession = sessionRepository.save(session);
        messagingTemplate.convertAndSend("/topic/sessions", Map.of(
                "type", "ORDER_REMOVED",
                "sessionId", id,
                "personName", name
        ));
        log.info("Removed order for '{}' from session '{}'.", name, id);
        return ResponseEntity.ok(finalSession);
    }

    @PatchMapping("/{id}/payment")
    @Transactional
    public ResponseEntity<?> declarePaymentMethod(
            @PathVariable String id,
            @RequestBody Map<String, String> request) {

        String username = SecurityContextHolder.getContext().getAuthentication().getName();
        String method = request.get("paymentMethod");

        Optional<OrderSession> optSession = sessionRepository.findById(id);
        if (optSession.isEmpty()) return ResponseEntity.notFound().build();

        OrderSession session = optSession.get();
        session.getPersonOrders().stream()
                .filter(p -> p.getName().equals(username))
                .findFirst()
                .ifPresent(p -> p.setPaymentMethod(method));

        OrderSession updatedSession = sessionRepository.save(session);
        return ResponseEntity.ok(updatedSession);
    }

    // ── Text-based order endpoints (for restaurants with orderMode=TEXT) ──

    @PostMapping("/{id}/text-order")
    @Transactional
    public ResponseEntity<?> addOrUpdateTextOrder(
            @PathVariable String id,
            @RequestBody Map<String, String> request) {

        String username = SecurityContextHolder.getContext().getAuthentication().getName();
        String text = request.get("text");

        Optional<OrderSession> optSession = sessionRepository.findById(id);
        if (optSession.isEmpty()) return ResponseEntity.notFound().build();

        OrderSession session = optSession.get();
        if ("CLOSED".equals(session.getStatus()) || "SENT".equals(session.getStatus())) {
            return ResponseEntity.badRequest().body(Map.of("error", "Session is not open for new orders"));
        }

        session.getPersonOrders().removeIf(p -> p.getName().equals(username));

        PersonOrder po = new PersonOrder();
        po.setName(username);
        po.setTextOrder(text);
        po.setSubtotal(0);
        po.setItems(List.of());
        po.setSession(session);
        session.getPersonOrders().add(po);

        // Recalculate total
        double newTotal = session.getDeliveryFee();
        for (PersonOrder p : session.getPersonOrders()) {
            newTotal += p.getSubtotal();
        }
        session.setTotal(newTotal);

        OrderSession finalSession = sessionRepository.save(session);
        messagingTemplate.convertAndSend("/topic/sessions", Map.of(
                "type", "ORDER_UPDATED",
                "sessionId", id,
                "personName", username
        ));
        log.info("Text order saved for '{}' in session '{}'.", username, id);
        return ResponseEntity.ok(finalSession);
    }

    @DeleteMapping("/{id}/text-order")
    @Transactional
    public ResponseEntity<?> removeTextOrder(@PathVariable String id) {
        String username = SecurityContextHolder.getContext().getAuthentication().getName();

        Optional<OrderSession> optSession = sessionRepository.findById(id);
        if (optSession.isEmpty()) return ResponseEntity.notFound().build();

        OrderSession session = optSession.get();
        session.getPersonOrders().removeIf(p -> p.getName().equals(username) && p.getTextOrder() != null);

        OrderSession finalSession = sessionRepository.save(session);
        messagingTemplate.convertAndSend("/topic/sessions", Map.of(
                "type", "ORDER_REMOVED",
                "sessionId", id,
                "personName", username
        ));
        log.info("Removed text order for '{}' from session '{}'.", username, id);
        return ResponseEntity.ok(finalSession);
    }

    // ── Pizza-specific order endpoints (for restaurants with orderMode=PIZZA) ──

    @PostMapping("/{id}/pizza-order")
    @Transactional
    public ResponseEntity<?> addOrUpdatePizzaOrder(
            @PathVariable String id,
            @RequestBody Map<String, Object> request) {

        String username = SecurityContextHolder.getContext().getAuthentication().getName();

        Optional<OrderSession> optSession = sessionRepository.findById(id);
        if (optSession.isEmpty()) return ResponseEntity.notFound().build();

        OrderSession session = optSession.get();
        if ("CLOSED".equals(session.getStatus()) || "SENT".equals(session.getStatus())) {
            return ResponseEntity.badRequest().body(Map.of("error", "Session is not open for new orders"));
        }

        String pizzaName  = (String)  request.getOrDefault("pizzaName", "");
        String size       = (String)  request.getOrDefault("size", "Medium");
        int    quantity   = ((Number) request.getOrDefault("quantity", 1)).intValue();
        String drinkName  = (String)  request.getOrDefault("drinkName", "");
        String notes      = (String)  request.getOrDefault("notes", "");

        // Build a summary text that fits in the textOrder field
        StringBuilder sb = new StringBuilder();
        sb.append(quantity).append("x ").append(pizzaName).append(" (").append(size).append(")");
        if (drinkName != null && !drinkName.isBlank()) sb.append(" + Drink: ").append(drinkName);
        if (notes != null && !notes.isBlank()) sb.append(" | Notes: ").append(notes);

        session.getPersonOrders().removeIf(p -> p.getName().equals(username));

        PersonOrder po = new PersonOrder();
        po.setName(username);
        po.setTextOrder(sb.toString());
        po.setSubtotal(0);
        po.setItems(List.of());
        po.setStatus("PENDING");
        po.setSession(session);
        session.getPersonOrders().add(po);

        double newTotal = session.getDeliveryFee();
        for (PersonOrder p : session.getPersonOrders()) newTotal += p.getSubtotal();
        session.setTotal(newTotal);

        OrderSession finalSession = sessionRepository.save(session);
        messagingTemplate.convertAndSend("/topic/sessions", Map.of(
                "type", "ORDER_UPDATED",
                "sessionId", id,
                "personName", username
        ));
        // Notify the ordering user via their personal queue
        messagingTemplate.convertAndSend("/topic/notifications", Map.of(
                "type", "ORDER_CONFIRMED",
                "sessionId", id,
                "personName", username,
                "message", username + " placed a pizza order in session " + session.getSessionName()
        ));
        log.info("Pizza order saved for '{}' in session '{}'.", username, id);
        return ResponseEntity.ok(finalSession);
    }

    @DeleteMapping("/{id}/pizza-order")
    @Transactional
    public ResponseEntity<?> removePizzaOrder(@PathVariable String id) {
        String username = SecurityContextHolder.getContext().getAuthentication().getName();

        Optional<OrderSession> optSession = sessionRepository.findById(id);
        if (optSession.isEmpty()) return ResponseEntity.notFound().build();

        OrderSession session = optSession.get();
        session.getPersonOrders().removeIf(p -> p.getName().equals(username));

        OrderSession finalSession = sessionRepository.save(session);
        messagingTemplate.convertAndSend("/topic/sessions", Map.of(
                "type", "ORDER_REMOVED",
                "sessionId", id,
                "personName", username
        ));
        log.info("Removed pizza order for '{}' from session '{}'.", username, id);
        return ResponseEntity.ok(finalSession);
    }
}

