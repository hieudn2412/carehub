# CareHub backend environments

The backend has explicit, isolated runtime profiles. Configuration shared by
all environments stays in `application.yaml`; each profile only overrides
environment-specific infrastructure and safety settings.

| Profile | PostgreSQL | RabbitMQ | Environment file | Seed default |
|---|---|---|---|---|
| `dev` (default) | `116.118.6.153:5432/carehub` | `116.118.6.153:5672` | `.env.dev` | off |
| `prod` | Docker service `db:5432` | Docker service `rabbitmq:5672` | `.env.prod` | off after bootstrap |
| `test` | isolated H2 database | disabled | test resources | off |

If the shared VPS is unreachable, the `dev` profile fails fast instead of
switching to another database.

## Shared VPS development

`.env.properties` was renamed to `.env.dev`. It is ignored by Git and contains
the existing credentials for the shared VPS. New developers should copy the
tracked example and fill the secrets:

```powershell
Copy-Item .env.dev.example .env.dev
.\mvnw.cmd spring-boot:run
```

No profile argument is necessary because `dev` is the default. Passing
`-Dspring-boot.run.profiles=dev` remains valid when an explicit command is
preferred.

The VPS firewall must allow the developer IP to reach PostgreSQL 5432 and
RabbitMQ 5672. RabbitMQ's built-in `guest` account cannot log in remotely;
create a dedicated development user and place it in `.env.dev`.

The `dev` profile defaults `APP_SEED_ENABLED=false` because the database is
shared. Schema migrations still run through Flyway, so migration changes must
be reviewed before starting a newer branch against the shared database.

## Production

Production is started only through root `compose.prod.yml` with profile `prod`.
It uses a separate named PostgreSQL volume initialized from the V17 schema
without development data. See `../PRODUCTION_DEPLOYMENT.md` for the deployment
sequence.

## Tests

```powershell
.\mvnw.cmd test
```

Tests explicitly select profile `test`; they never connect to development or
production PostgreSQL/RabbitMQ.
