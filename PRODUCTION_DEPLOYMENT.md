# Production deployment

Stack production is defined in `compose.prod.yml` and exposes only HTTP/HTTPS
through Caddy. Run all commands from the repository root.

Production uses its own `postgres_data` named volume. It never connects to the
shared development PostgreSQL at `116.118.6.153`; that host is used only by the
explicit Spring profile `dev`. The baseline export copies schema, not rows, so
the new production database starts without development business data.

## 1. Prepare secrets

```sh
cp carehub-backend/.env.prod.example carehub-backend/.env.prod
chmod 600 carehub-backend/.env.prod
```

Fill every blank secret in `.env.prod`. Keep `APP_SEED_ENABLED=true` only for
the first boot of a new database. The real file is ignored by Git.

## 2. Export the reviewed V17 schema

The source PostgreSQL container must contain a successfully applied Flyway V17
migration. The export contains schema only, excludes owners/privileges, and
does not include `flyway_schema_history`.

```sh
SOURCE_POSTGRES_CONTAINER=postgres ./scripts/export-schema-v17.sh
```

Review and commit:

```text
carehub-backend/docker/postgres/baseline/schema-v17.sql
```

Do not start a new PostgreSQL volume before this file exists. The init script
intentionally fails when the baseline is missing or invalid.

## 3. Validate and build

```sh
docker compose --env-file carehub-backend/.env.prod -f compose.prod.yml config --quiet
docker compose --env-file carehub-backend/.env.prod -f compose.prod.yml build --pull
```

## 4. Start infrastructure and backend

```sh
docker compose --env-file carehub-backend/.env.prod -f compose.prod.yml up -d db rabbitmq
docker compose --env-file carehub-backend/.env.prod -f compose.prod.yml up -d backend
docker compose --env-file carehub-backend/.env.prod -f compose.prod.yml ps
docker compose --env-file carehub-backend/.env.prod -f compose.prod.yml logs --tail=200 backend
```

Flyway creates its baseline marker at V17 and applies migrations from V18
onward. Verify it inside PostgreSQL:

```sh
docker compose --env-file carehub-backend/.env.prod -f compose.prod.yml exec db sh -c \
  'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT installed_rank, version, description, success FROM flyway_schema_history ORDER BY installed_rank;"'
```

After the seeded administrator can log in, set `APP_SEED_ENABLED=false` in
`.env.prod` and recreate only the backend:

```sh
docker compose --env-file carehub-backend/.env.prod -f compose.prod.yml up -d --force-recreate backend
```

## 5. Start the public edge

Make sure DNS points `quanlydieuduongvd.org` to the VPS and TCP ports 80/443
plus UDP 443 are open. Then start the remaining services:

```sh
docker compose --env-file carehub-backend/.env.prod -f compose.prod.yml up -d frontend caddy
docker compose --env-file carehub-backend/.env.prod -f compose.prod.yml ps
```

Smoke test:

```sh
curl -I http://quanlydieuduongvd.org
curl -I https://quanlydieuduongvd.org
curl -i https://quanlydieuduongvd.org/actuator/health
curl -i https://quanlydieuduongvd.org/api/v1/auth/login
```

The expected actuator response from the public Internet is `404`. The login
endpoint can return a method or validation error for this GET smoke test, but
it must be served by the backend rather than by the React application.

RabbitMQ Management is bound only to VPS loopback. Access it when needed with:

```sh
ssh -L 15672:127.0.0.1:15672 root@YOUR_VPS_IP
```

Then open `http://127.0.0.1:15672` locally.

## 6. Persistent-data checks

Upload a document, recreate the backend, and verify that the document remains:

```sh
docker compose --env-file carehub-backend/.env.prod -f compose.prod.yml up -d --force-recreate backend
```

PostgreSQL, RabbitMQ, Caddy state, and documents use named volumes. Never use
`docker compose down -v` on production unless those volumes are intentionally
being destroyed and verified backups exist.
