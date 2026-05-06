package com.orderhub.app.services;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.HashMap;
import java.util.Map;

@Slf4j
@Service
public class MetaWhatsAppService {

    @Value("${whatsapp.meta.enabled:false}")
    private boolean enabled;

    @Value("${whatsapp.meta.token:}")
    private String token;

    @Value("${whatsapp.meta.phone-number-id:}")
    private String phoneNumberId;

    @Value("${whatsapp.meta.api-version:v20.0}")
    private String apiVersion;

    @Value("${whatsapp.meta.default-country-code:20}")
    private String defaultCountryCode;

    private final HttpClient httpClient = HttpClient.newBuilder()
        .connectTimeout(Duration.ofSeconds(10))
        .build();
    private final ObjectMapper objectMapper = new ObjectMapper();

    public boolean isEnabled() {
        return enabled && token != null && !token.isBlank() && phoneNumberId != null && !phoneNumberId.isBlank();
    }

    public String normalizePhoneToWhatsapp(String rawPhone) {
        if (rawPhone == null) return null;
        String digits = rawPhone.replaceAll("\\D", "");
        if (digits.isBlank()) return null;

        // 0020xxxx -> 20xxxx
        if (digits.startsWith("00")) digits = digits.substring(2);
        // 010xxxx -> 2010xxxx (Egypt local format)
        if (digits.startsWith("0")) digits = defaultCountryCode + digits.substring(1);

        return digits;
    }

    public boolean sendTextMessage(String rawPhone, String messageBody) {
        if (!isEnabled()) {
            log.warn("Meta WhatsApp is not enabled/configured, skipping message send");
            return false;
        }
        String phone = normalizePhoneToWhatsapp(rawPhone);
        if (phone == null || phone.isBlank()) {
            log.warn("Invalid user phone '{}', skipping WhatsApp send", rawPhone);
            return false;
        }

        try {
            String endpoint = String.format("https://graph.facebook.com/%s/%s/messages", apiVersion, phoneNumberId);
            Map<String, Object> body = new HashMap<>();
            body.put("messaging_product", "whatsapp");
            body.put("to", phone);
            body.put("type", "text");
            body.put("text", Map.of("body", messageBody));

            HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(endpoint))
                .timeout(Duration.ofSeconds(20))
                .header("Authorization", "Bearer " + token)
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(body)))
                .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() >= 200 && response.statusCode() < 300) {
                return true;
            }

            String resp = response.body();
            if (resp != null && resp.length() > 500) resp = resp.substring(0, 500) + "...";
            log.warn("Meta WhatsApp send failed HTTP {} body={}", response.statusCode(), resp);
            return false;
        } catch (Exception e) {
            log.warn("Meta WhatsApp send exception: {}", e.getMessage());
            return false;
        }
    }
}
