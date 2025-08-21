import dotenv from 'dotenv';
import path from 'path';
import { Client } from 'pg';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

export default async function() {
  if (process.env.NODE_ENV !== 'test') return;
  const schema = process.env.DB_SCHEMA;
  if (!schema || schema === 'public') return;

  const host = process.env.DB_HOST || 'localhost';
  const port = parseInt(process.env.DB_PORT || '5433');
  const user = process.env.DB_USER || 'postgres';
  const password = process.env.DB_PASSWORD || 'password';
  const database = process.env.DB_NAME || 'chorely';

  const client = new Client({ host, port, user, password, database });
  await client.connect();
  await client.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
  await client.end();
}


