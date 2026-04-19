package com.assettracker;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

@SpringBootApplication
@ConfigurationPropertiesScan
public class AssetTrackerBackendApplication {

	public static void main(String[] args) {
		SpringApplication.run(AssetTrackerBackendApplication.class, args);
	}

}
