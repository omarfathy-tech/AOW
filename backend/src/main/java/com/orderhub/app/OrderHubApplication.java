package com.orderhub.app;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class OrderHubApplication {

	public static void main(String[] args) {
		SpringApplication.run(OrderHubApplication.class, args);
	}

}
