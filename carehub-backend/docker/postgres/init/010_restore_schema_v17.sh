#!/bin/sh
set -eu

schema_file=/baseline/schema-v17.sql

if [ ! -s "$schema_file" ]; then
    echo >&2 "Missing $schema_file. Export the reviewed V17 schema before starting a new PostgreSQL volume."
    exit 1
fi

if grep -qi 'flyway_schema_history' "$schema_file"; then
    echo >&2 "$schema_file must not contain flyway_schema_history. Re-export it with the provided script."
    exit 1
fi

if ! grep -q 'CREATE TABLE' "$schema_file"; then
    echo >&2 "$schema_file does not appear to contain a PostgreSQL schema."
    exit 1
fi

psql --set=ON_ERROR_STOP=1 \
    --username "$POSTGRES_USER" \
    --dbname "$POSTGRES_DB" \
    --file "$schema_file"
