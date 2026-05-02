package com.orderhub.app.controllers;

import com.orderhub.app.models.Role;
import com.orderhub.app.models.User;
import com.orderhub.app.repositories.UserRepository;
import com.orderhub.app.security.JwtUtil;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/auth")
@CrossOrigin(origins = "*")
public class AuthController {

    private static final Logger logger = LoggerFactory.getLogger(AuthController.class);

    private final AuthenticationManager authenticationManager;
    private final UserRepository userRepository;
    private final JwtUtil jwtUtil;
    private final PasswordEncoder passwordEncoder;

    public AuthController(AuthenticationManager authenticationManager, UserRepository userRepository, 
                          JwtUtil jwtUtil, PasswordEncoder passwordEncoder) {
        this.authenticationManager = authenticationManager;
        this.userRepository = userRepository;
        this.jwtUtil = jwtUtil;
        this.passwordEncoder = passwordEncoder;
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody Map<String, String> request) {
        String username = request.get("username");
        String password = request.get("password");

        if (username == null || password == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Username and password are required"));
        }

        try {
            Authentication authentication = authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(username.trim(), password)
            );

            Optional<User> userOpt = userRepository.findByUsername(username.trim());
            if (userOpt.isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("error", "User not found"));
            }

            User user = userOpt.get();
            String token = jwtUtil.generateToken(user.getUsername(), user.getRole().name());
            String normalizedRole = user.getRole().name().startsWith("ROLE_")
                    ? user.getRole().name().substring(5)
                    : user.getRole().name();

            Map<String, Object> userMap = new java.util.HashMap<>();
            userMap.put("id", user.getId());
            userMap.put("username", user.getUsername());
            userMap.put("fullName", user.getFullName());
            userMap.put("phone", user.getPhone());
            userMap.put("role", normalizedRole);
            userMap.put("color", user.getColor());

            Map<String, Object> response = new java.util.HashMap<>();
            response.put("token", token);
            response.put("user", userMap);

            return ResponseEntity.ok(response);
        } catch (BadCredentialsException e) {
            return ResponseEntity.status(401).body(Map.of("error", "Invalid username or password"));
        } catch (Exception e) {
            logger.error("Authentication failed for user {}", username, e);
            return ResponseEntity.status(500).body(Map.of("error", "Authentication failed"));
        }
    }

    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody Map<String, String> request) {
        String username = request.get("username");
        String password = request.get("password");
        String fullName = request.get("fullName");
        String phone = request.get("phone");

        // Validation
        if (username == null || username.trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Username is required"));
        }
        if (password == null || password.length() < 4) {
            return ResponseEntity.badRequest().body(Map.of("error", "Password must be at least 4 characters"));
        }
        if (fullName == null || fullName.trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Full name is required"));
        }

        // Check if username exists
        if (userRepository.findByUsername(username.trim()).isPresent()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Username already exists"));
        }

        // Create new user
        User user = User.builder()
                .username(username.trim())
                .password(passwordEncoder.encode(password))
                .fullName(fullName.trim())
                .phone(phone)
                .role(Role.ROLE_USER)
                .color(generateRandomColor())
                .build();

        userRepository.save(user);

        return ResponseEntity.ok(Map.of(
                "message", "Registration successful. Please login to continue.",
                "username", user.getUsername()
        ));
    }

    @PostMapping("/admin/setup")
    public ResponseEntity<?> setupAdmin(@RequestBody Map<String, String> request) {
        String adminUsername = request.get("adminUsername");
        String adminPassword = request.get("adminPassword");
        String secretKey = request.get("secretKey");

        // Simple secret key check (in production, use a more secure method)
        if (!"OrderHubAdmin2024".equals(secretKey)) {
            return ResponseEntity.status(403).body(Map.of("error", "Invalid secret key"));
        }

        // Check if admin already exists
        Optional<User> existingAdmin = userRepository.findByUsername(adminUsername);
        if (existingAdmin.isPresent()) {
            User admin = existingAdmin.get();
            admin.setPassword(passwordEncoder.encode(adminPassword));
            admin.setRole(Role.ROLE_ADMIN);
            userRepository.save(admin);
            return ResponseEntity.ok(Map.of("message", "Admin credentials updated successfully"));
        }

        // Create new admin
        User admin = User.builder()
                .username(adminUsername)
                .password(passwordEncoder.encode(adminPassword))
                .fullName("Administrator")
                .role(Role.ROLE_ADMIN)
                .color("#FF5733")
                .build();

        userRepository.save(admin);

        return ResponseEntity.ok(Map.of("message", "Admin created successfully"));
    }

    private String generateRandomColor() {
        String[] colors = {"#6366f1", "#8b5cf6", "#ec4899", "#f43f5e", "#10b981", "#3b82f6", "#f59e0b", "#14b8a6"};
        return colors[(int) (Math.random() * colors.length)];
    }
}
