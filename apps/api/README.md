# apps/api

Spring Boot backend (Java 21, Maven), built as a **modular monolith**: one deployable, split into
strict modules under `src/main/java/com/tavolina/`. Each module's `package-info.java` describes
what it owns.

Modules talk to each other only through public service interfaces or domain events, never
through another module's repositories. That keeps the boundaries clean enough to split a module
(for example `fiscal`) into its own service later.

The Maven project, Flyway and Postgres wiring arrive in #2.
