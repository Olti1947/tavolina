# apps/api

Spring Boot backend (Java 21, Maven), built as a **modular monolith**: one deployable, split into
strict modules under `src/main/java/com/tavolina/`. Each module's `package-info.java` describes
what it owns.

Modules talk to each other only through public service interfaces or domain events, never
through another module's repositories. That keeps the boundaries clean enough to split a module
(for example `fiscal`) into its own service later.

## JDK

Build with **JDK 21**. The Makefile picks it automatically on macOS. When calling `./mvnw` directly
with a newer default JDK, run `export JAVA_HOME=$(/usr/libexec/java_home -v 21)` first; otherwise
the enforcer stops the build, because palantir-java-format breaks on newer JDKs.

## Run

`make dev` from the repo root starts Postgres and the API with the settings from the root `.env`.
To run only the API (Postgres from `make db` must be up):

```sh
./mvnw spring-boot:run
```

| URL | What |
|---|---|
| http://localhost:8080/swagger-ui.html | API explorer |
| http://localhost:8080/v3/api-docs | OpenAPI spec (source for `packages/api-client`) |
| http://localhost:8080/actuator/health | Health check |

## Database

Flyway owns the schema: migrations live in `src/main/resources/db/migration` and run on startup.
Hibernate only validates (`ddl-auto: validate`). Never edit an applied migration; add a new one.

## Test

```sh
./mvnw verify
```

`verify` also checks formatting (Spotless with palantir-java-format); `./mvnw spotless:apply`
fixes it. It also rewrites `packages/api-client/openapi.json` from the running app (see
`make api-client`).

Tests use Testcontainers, so Docker must be running. They start the same `postgres:16.10-alpine`
image as `infra/docker-compose.yml`.
