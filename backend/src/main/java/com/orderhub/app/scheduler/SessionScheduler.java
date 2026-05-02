package com.orderhub.app.scheduler;

import com.orderhub.app.models.OrderSession;
import com.orderhub.app.repositories.OrderSessionRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.List;

@Component
public class SessionScheduler {

    @Autowired
    private OrderSessionRepository sessionRepository;

    @Scheduled(fixedRate = 30000) // check every 30 seconds
    public void autoClosePastDeadline() {
        List<OrderSession> openSessions = sessionRepository.findByStatus("OPEN");
        LocalDateTime now = LocalDateTime.now();
        for (OrderSession session : openSessions) {
            if (session.getDeadline() != null && now.isAfter(session.getDeadline())) {
                session.setStatus("CLOSED");
                session.setClosedAt(now);
                sessionRepository.save(session);
            }
        }
    }
}
