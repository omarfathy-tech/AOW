package com.orderhub.app.controllers;

import com.orderhub.app.models.OrderSession;
import com.orderhub.app.models.PersonOrder;
import com.orderhub.app.repositories.OrderSessionRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/orders")
@CrossOrigin(origins = "*")
public class OrderHistoryController {

    @Autowired
    private OrderSessionRepository sessionRepository;

    @GetMapping("/mine")
    public List<Map<String, Object>> getMyOrders(@RequestParam String username) {
        List<OrderSession> allSessions = sessionRepository.findAll();
        List<Map<String, Object>> result = new ArrayList<>();

        for (OrderSession session : allSessions) {
            for (PersonOrder po : session.getPersonOrders()) {
                if (po.getName().equals(username)) {
                    Map<String, Object> entry = new LinkedHashMap<>();
                    entry.put("sessionId", session.getId());
                    entry.put("sessionName", session.getSessionName());
                    entry.put("restaurantId", session.getRestaurantId());
                    entry.put("createdAt", session.getCreatedAt());
                    entry.put("sentAt", session.getSentAt());
                    entry.put("sessionStatus", session.getStatus());
                    entry.put("items", po.getItems());
                    entry.put("subtotal", po.getSubtotal());
                    entry.put("orderStatus", po.getStatus());
                    result.add(entry);
                }
            }
        }

        // Sort by createdAt descending
        result.sort((a, b) -> {
            Object aDate = a.get("createdAt");
            Object bDate = b.get("createdAt");
            if (aDate == null || bDate == null) return 0;
            return bDate.toString().compareTo(aDate.toString());
        });

        return result;
    }
}
