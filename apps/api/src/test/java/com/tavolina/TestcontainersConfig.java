package com.tavolina;

import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Bean;
import org.testcontainers.containers.PostgreSQLContainer;

/** A real Postgres for tests. Import it with {@code @Import(TestcontainersConfig.class)}. */
@TestConfiguration(proxyBeanMethods = false)
public class TestcontainersConfig {

    @Bean
    @ServiceConnection
    PostgreSQLContainer<?> postgres() {
        // Same image as infra/docker-compose.yml.
        return new PostgreSQLContainer<>("postgres:16.10-alpine");
    }
}
