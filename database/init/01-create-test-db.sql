SELECT 'CREATE DATABASE sigot_test OWNER sigot'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'sigot_test')\gexec
