#!/bin/bash
set -euo pipefail

# Runs as the postgres bootstrap superuser inside docker-entrypoint-initdb.d.
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
  DO \$\$
  BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'aiconn') THEN
      CREATE ROLE aiconn LOGIN PASSWORD 'aiconn' NOSUPERUSER NOBYPASSRLS CREATEDB;
    END IF;
  END
  \$\$;

  SELECT 'CREATE DATABASE aiconnector OWNER aiconn'
    WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'aiconnector')\gexec
  SELECT 'CREATE DATABASE aiconnector_test OWNER aiconn'
    WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'aiconnector_test')\gexec

  GRANT ALL ON SCHEMA public TO aiconn;
EOSQL

for db in aiconnector aiconnector_test; do
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$db" <<-EOSQL
    GRANT ALL ON SCHEMA public TO aiconn;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO aiconn;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO aiconn;
  EOSQL
done
