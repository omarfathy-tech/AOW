package com.orderhub.app.services;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.orderhub.app.dto.ScrapedMenuDTO;
import com.orderhub.app.models.MenuCategory;
import com.orderhub.app.models.MenuItem;
import com.orderhub.app.models.Restaurant;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class MenuScraperService {

    private final RestTemplate restTemplate = new RestTemplate();
    private final ObjectMapper objectMapper;

    @Value("${scraper.service.url:http://localhost:3100}")
    private String scraperServiceUrl;

    public ScrapedMenuDTO scrapeMenu(String menuUrl) {
        log.info("Calling Node.js scraper service for url: {}", menuUrl);
        String endpoint = scraperServiceUrl + "/scrape/restaurant";

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        Map<String, String> body = Map.of("url", menuUrl);

        try {
            HttpEntity<Map<String, String>> request = new HttpEntity<>(body, headers);
            JsonNode response = restTemplate.postForObject(endpoint, request, JsonNode.class);

            if (response != null && response.has("ok") && response.get("ok").asBoolean()) {
                JsonNode menuNode = response.get("menu");
                return objectMapper.treeToValue(menuNode, ScrapedMenuDTO.class);
            } else {
                String error = response != null && response.has("error") ? response.get("error").asText() : "Unknown error";
                throw new RuntimeException("Scraper service failed: " + error);
            }
        } catch (Exception e) {
            log.error("Failed to scrape menu from url: {}", menuUrl, e);
            throw new RuntimeException("Failed to scrape menu: " + e.getMessage(), e);
        }
    }

    public List<String> discoverElmenusRestaurantUrls(String area, int limit) {
        log.info("Calling Node.js scraper service to discover area: {}", area);
        String endpoint = scraperServiceUrl + "/scrape/area?area=" + area + "&limit=" + limit;

        try {
            JsonNode response = restTemplate.getForObject(endpoint, JsonNode.class);

            if (response != null && response.has("ok") && response.get("ok").asBoolean()) {
                JsonNode restaurantsNode = response.get("restaurants");
                List<String> urls = new ArrayList<>();
                if (restaurantsNode.isArray()) {
                    for (JsonNode node : restaurantsNode) {
                        urls.add(node.get("url").asText());
                    }
                }
                return urls;
            } else {
                String error = response != null && response.has("error") ? response.get("error").asText() : "Unknown error";
                throw new RuntimeException("Area scraper service failed: " + error);
            }
        } catch (Exception e) {
            log.error("Failed to discover restaurants in area: {}", area, e);
            throw new RuntimeException("Failed to discover area: " + e.getMessage(), e);
        }
    }

    public void applyScrapedMenuToRestaurant(Restaurant restaurant) {
        if (restaurant.getMenuUrl() == null || restaurant.getMenuUrl().isBlank()) {
            throw new IllegalArgumentException("Restaurant has no menu URL to scrape");
        }

        ScrapedMenuDTO scraped = scrapeMenu(restaurant.getMenuUrl());

        restaurant.setName(scraped.getRestaurantName());
        restaurant.setLogoUrl(scraped.getLogoUrl());
        if (scraped.getCuisineType() != null && !scraped.getCuisineType().isBlank()) {
            restaurant.setCuisineType(scraped.getCuisineType());
        }
        if (scraped.getDescription() != null && !scraped.getDescription().isBlank()) {
            restaurant.setDescription(scraped.getDescription());
        }
        if (scraped.getDeliveryFee() != null) {
            restaurant.setDeliveryFee(scraped.getDeliveryFee());
        }

        List<MenuCategory> categories = new ArrayList<>();
        if (scraped.getCategories() != null) {
            for (ScrapedMenuDTO.CategoryDTO catDTO : scraped.getCategories()) {
                MenuCategory cat = new MenuCategory();
                cat.setName(catDTO.getName());
                cat.setRestaurant(restaurant);

                List<MenuItem> items = new ArrayList<>();
                if (catDTO.getItems() != null) {
                    for (ScrapedMenuDTO.ItemDTO itemDTO : catDTO.getItems()) {
                        MenuItem item = new MenuItem();
                        item.setName(itemDTO.getName());
                        item.setPrices(itemDTO.getPrices());
                        item.setCategory(cat);
                        items.add(item);
                    }
                }
                cat.setItems(items);
                categories.add(cat);
            }
        }

        if (restaurant.getCategories() != null) {
            restaurant.getCategories().clear();
            restaurant.getCategories().addAll(categories);
        } else {
            restaurant.setCategories(categories);
        }
    }
}
