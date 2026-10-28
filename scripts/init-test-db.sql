-- Runs once when the Postgres volume is first created.
-- Creates a separate database for automated integration tests.
CREATE DATABASE taskflow_test;

-- Test data is disposable: skip waiting for WAL fsync on commit. This makes the
-- suite dramatically faster on Docker Desktop volumes (Windows/macOS).
ALTER DATABASE taskflow_test SET synchronous_commit = off;
