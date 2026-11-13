package com.tavolina;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.context.annotation.Import;

/**
 * Writes the OpenAPI spec to packages/api-client/openapi.json, the input for the generated TS client.
 * Run it with {@code make api-client}. CI regenerates and fails if the committed file is stale.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Import(TestcontainersConfig.class)
class OpenApiSpecExportTest {

    // Maven runs tests from apps/api.
    static final Path SPEC = Path.of("../../packages/api-client/openapi.json");

    @Autowired
    TestRestTemplate http;

    @Autowired
    ObjectMapper json;

    @Test
    void exportSpec() throws Exception {
        var spec = json.readTree(http.getForObject("/v3/api-docs", String.class));
        // The random test port must not leak into the committed spec.
        if (spec.has("servers")) {
            ((ObjectNode) spec).remove("servers");
        }
        var pretty = json.writer().with(SerializationFeature.INDENT_OUTPUT).writeValueAsString(spec);
        Files.writeString(SPEC, pretty + "\n");
        assertThat(SPEC).exists();
    }
}
