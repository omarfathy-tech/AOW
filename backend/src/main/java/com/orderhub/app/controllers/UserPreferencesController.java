package com.orderhub.app.controllers;

import com.orderhub.app.models.User;
import com.orderhub.app.repositories.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.Optional;

/**
 * Preferences are now stored directly on the User entity (languagePref, notificationsEnabled).
 * This controller maintains the original API contract so existing frontend calls do not break.
 */
@RestController
@RequestMapping("/api/user-preferences")
@CrossOrigin(origins = "*")
public class UserPreferencesController {

    @Autowired
    private UserRepository userRepository;

    @GetMapping("/user/{userId}")
    public ResponseEntity<?> getPreferences(@PathVariable Long userId) {
        Optional<User> userOpt = userRepository.findById(userId);
        if (userOpt.isEmpty()) return ResponseEntity.notFound().build();
        User user = userOpt.get();
        return ResponseEntity.ok(Map.of(
            "userId", userId,
            "languagePreference", user.getLanguagePref() != null ? user.getLanguagePref() : "ar",
            "notificationEnabled", user.getNotificationsEnabled() != null && user.getNotificationsEnabled()
        ));
    }

    @PostMapping("/user/{userId}")
    public ResponseEntity<?> createOrUpdatePreferences(@PathVariable Long userId,
                                                        @RequestBody Map<String, Object> preferences) {
        Optional<User> userOpt = userRepository.findById(userId);
        if (userOpt.isEmpty()) return ResponseEntity.badRequest().body(Map.of("error", "User not found"));
        User user = userOpt.get();
        if (preferences.containsKey("languagePreference")) {
            user.setLanguagePref((String) preferences.get("languagePreference"));
        }
        if (preferences.containsKey("notificationEnabled")) {
            user.setNotificationsEnabled((Boolean) preferences.get("notificationEnabled"));
        }
        userRepository.save(user);
        return ResponseEntity.ok(Map.of("userId", userId, "updated", true));
    }

    @PutMapping("/user/{userId}")
    public ResponseEntity<?> updatePreferences(@PathVariable Long userId,
                                               @RequestBody Map<String, Object> updates) {
        return createOrUpdatePreferences(userId, updates);
    }
}
