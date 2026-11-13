package com.tavolina;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * Entry point of the Tavolina API. Business code lives in the module packages next to this
 * class (identity, catalog, ordering, ...); see each module's {@code package-info.java}.
 */
@SpringBootApplication
public class TavolinaApplication {

    public static void main(String[] args) {
        SpringApplication.run(TavolinaApplication.class, args);
    }
}
