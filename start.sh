#!/bin/sh

echo "Running migrations..."
npx knex migrate:latest --knexfile ./src/db/config/knexfile.ts

echo "Starting backend..."
npm start
