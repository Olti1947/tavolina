# infra

Local infrastructure for development. `docker-compose.yml` runs **PostgreSQL 16** only; the API
runs on the host (`./mvnw spring-boot:run`) and the fake printer arrives in #4.

| Service  | Address          | Notes                                              |
|----------|------------------|----------------------------------------------------|
| postgres | `127.0.0.1:5432` | Localhost only. Data in the `tavolina_postgres-data` volume. Timezone UTC. |

Settings come from the **root** `.env` (copy `.env.example`). Compose would otherwise look for
`.env` in `infra/`, so the Makefile passes it with `--env-file`. Without a `.env` the defaults
from `.env.example` are used.

```sh
make db        # start Postgres and wait until it is healthy
make psql      # open a psql shell
make stop      # stop Postgres (data is kept)
make db-reset  # delete the data volume and start an empty database
```

Schema and roles are created by Flyway migrations in `apps/api`, not by init scripts here.
