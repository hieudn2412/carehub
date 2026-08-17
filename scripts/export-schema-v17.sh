#!/bin/sh
set -eu

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
repository_dir=$(CDPATH= cd -- "$script_dir/.." && pwd)
source_container=${SOURCE_POSTGRES_CONTAINER:-postgres}
output_file=${OUTPUT_SCHEMA_PATH:-$repository_dir/carehub-backend/docker/postgres/baseline/schema-v17.sql}

mkdir -p "$(dirname -- "$output_file")"
temporary_file="$output_file.tmp"
trap 'rm -f "$temporary_file"' EXIT HUP INT TERM

version_17_applied=$(docker exec "$source_container" sh -c \
    'exec psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --tuples-only --no-align --command "SELECT count(*) FROM flyway_schema_history WHERE version = '\''17'\'' AND success"')
if [ "$version_17_applied" != "1" ]; then
    echo >&2 "Source database has not successfully applied Flyway version 17."
    exit 1
fi

docker exec "$source_container" sh -c \
    'exec pg_dump --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --schema-only --no-owner --no-privileges --exclude-table=public.flyway_schema_history' \
    > "$temporary_file"

if grep -qi 'flyway_schema_history' "$temporary_file"; then
    echo >&2 "Export still contains flyway_schema_history; refusing to publish it."
    exit 1
fi

if ! grep -q 'CREATE TABLE' "$temporary_file"; then
    echo >&2 "Export contains no CREATE TABLE statements; check the source container and database."
    exit 1
fi

mv "$temporary_file" "$output_file"
trap - EXIT HUP INT TERM
echo "Wrote schema-only baseline to $output_file"
