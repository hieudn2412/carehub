# PostgreSQL V17 baseline

Place the reviewed schema-only export at:

```text
carehub-backend/docker/postgres/baseline/schema-v17.sql
```

Generate it on the VPS while the existing PostgreSQL container is still
running:

```sh
chmod +x scripts/export-schema-v17.sh
./scripts/export-schema-v17.sh
```

The export contains no application rows and excludes `flyway_schema_history`.
Review it before starting a brand-new `postgres_data` volume. The PostgreSQL
entrypoint refuses to initialize when the file is missing, empty, or still
contains Flyway history.
