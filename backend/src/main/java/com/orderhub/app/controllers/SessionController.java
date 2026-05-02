package com.orderhub.app.controllers;

import com.orderhub.app.models.OrderSession;
import com.orderhub.app.models.PersonOrder;
import com.orderhub.app.repositories.OrderSessionRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.http.ResponseEntity;
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

    // Inject MongoTemplate for atomic updates — avoids the save() insert/update confusion
    @Autowired
    private MongoTemplate mongoTemplate;

    @GetMapping("/active")
    public List<OrderSession> getActiveSessions() {
        return sessionRepository.findByStatus("OPEN");
    }

    @GetMapping("/active/status")
    public ResponseEntity<Map<String, Object>> getActiveSessionStatus() {
        List<OrderSession> active = sessionRepository.findByStatus("OPEN");
        log.info("Active status poll. Found {} open sessions.", active.size());

        if (!active.isEmpty()) {
            OrderSession session = active.get(0);
            return ResponseEntity.ok(Map.of(
                "sessionId", session.getId(),
                "status", session.getStatus(),
                "participants", session.getPersonOrders().size()
            ));
        }

        // Check for recently SENT session
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

    /**
     * Add or replace a person's order in a session.
     *
     * THE CORE FIX: Instead of fetching the full document, mutating it, then
     * calling save() — which Spring Data may misidentify as a new insert when
     * the @Version field is involved — we use MongoTemplate to:
     *   1. Pull any existing order for this person atomically.
     *   2. Push the new order atomically.
     *   3. Recalculate and set the total atomically.
     *
     * This is a single round-trip with no optimistic locking conflicts and
     * no risk of DuplicateKeyException.
     */
    @PostMapping("/{id}/order")
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

        Query query = Query.query(Criteria.where("_id").is(id));

        // Step 1: atomically remove any existing order for this person
        Update pullUpdate = new Update().pull("personOrders",
            org.springframework.data.mongodb.core.query.Query.query(
                Criteria.where("name").is(personOrder.getName())
            )
        );
        mongoTemplate.updateFirst(query, pullUpdate, OrderSession.class);

        // Step 2: atomically push the new order
        Update pushUpdate = new Update().push("personOrders", personOrder);
        mongoTemplate.updateFirst(query, pushUpdate, OrderSession.class);

        // Step 3: recalculate total — re-fetch after mutations
        OrderSession updated = mongoTemplate.findOne(query, OrderSession.class);
        if (updated == null) {
            return ResponseEntity.notFound().build();
        }

        double newTotal = updated.getDeliveryFee();
        for (PersonOrder p : updated.getPersonOrders()) {
            newTotal += p.getSubtotal();
        }

        Update totalUpdate = new Update().set("total", newTotal);
        mongoTemplate.updateFirst(query, totalUpdate, OrderSession.class);

        // Re-fetch the final state to return to the client
        OrderSession finalSession = mongoTemplate.findOne(query, OrderSession.class);
        log.info("Order saved for person '{}' in session '{}'.", personOrder.getName(), id);
        return ResponseEntity.ok(finalSession);
    }

    @DeleteMapping("/{id}/order/{name}")
    public ResponseEntity<?> removePersonOrder(
            @PathVariable String id,
            @PathVariable String name) {

        if (!sessionRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }

        Query query = Query.query(Criteria.where("_id").is(id));

        // Atomically pull the person's order
        Update pullUpdate = new Update().pull("personOrders",
            Query.query(Criteria.where("name").is(name))
        );
        mongoTemplate.updateFirst(query, pullUpdate, OrderSession.class);

        // Recalculate total
        OrderSession updated = mongoTemplate.findOne(query, OrderSession.class);
        if (updated == null) {
            return ResponseEntity.notFound().build();
        }

        double newTotal = updated.getDeliveryFee();
        for (PersonOrder p : updated.getPersonOrders()) {
            newTotal += p.getSubtotal();
        }

        Update totalUpdate = new Update().set("total", newTotal);
        mongoTemplate.updateFirst(query, totalUpdate, OrderSession.class);

        OrderSession finalSession = mongoTemplate.findOne(query, OrderSession.class);
        log.info("Removed order for '{}' from session '{}'.", name, id);
        return ResponseEntity.ok(finalSession);
    }

    /**
     * Allows a regular user to declare how they paid or will pay.
     */
    @PatchMapping("/{id}/payment")
    public ResponseEntity<?> declarePaymentMethod(
            @PathVariable String id,
            @RequestBody Map<String, String> request) {

        String username = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication().getName();
        String method = request.get("paymentMethod");

        Query query = Query.query(Criteria.where("_id").is(id).and("personOrders.name").is(username));
        Update update = new Update();
        
        if (method != null) {
            update.set("personOrders.$.paymentMethod", method);
            // Optional: If they clicked Vodafone/Instapay links, they are essentially declaring they paid.
            // We'll leave it up to the admin to tick the 'isPaid' box to confirm it, but the method is set.
        }

        mongoTemplate.updateFirst(query, update, OrderSession.class);
        OrderSession updatedSession = mongoTemplate.findOne(Query.query(Criteria.where("_id").is(id)), OrderSession.class);
        return ResponseEntity.ok(updatedSession);
    }
}
