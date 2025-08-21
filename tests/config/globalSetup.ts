import dotenv from 'dotenv';
import path from 'path';
import { Client } from 'pg';
import crypto from 'crypto';
import knex, { Knex } from 'knex';
import baseConfig from '../../src/db/config/knexfile';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

export default async function() {
  if (process.env.NODE_ENV !== 'test') return;

  const host = process.env.DB_HOST || 'localhost';
  const port = parseInt(process.env.DB_PORT || '5433');
  const user = process.env.DB_USER || 'postgres';
  const password = process.env.DB_PASSWORD || 'password';
  const database = process.env.DB_NAME || 'chorely';

  const schema = `test_${crypto.randomBytes(6).toString('hex')}`;
  process.env.DB_SCHEMA = schema;

  const client = new Client({ host, port, user, password, database });
  await client.connect();
  await client.query(`CREATE SCHEMA IF NOT EXISTS ${schema}`);
  await client.end();

  // Enable ts-node so Knex can load TypeScript migrations
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const tsnode = require('ts-node');
  tsnode.register({ transpileOnly: true, compilerOptions: { module: 'commonjs' } });
  try { require('tsconfig-paths/register'); } catch {}

  const cfg: Knex.Config = {
    ...baseConfig,
    connection: { host, port, user, password, database },
    searchPath: [schema, 'public'],
    migrations: {
      ...(baseConfig.migrations as any),
      directory: path.resolve(__dirname, '../../src/db/config/migrations'),
    },
    seeds: {
      ...(baseConfig.seeds as any),
      directory: path.resolve(__dirname, '../../src/db/config/seeds'),
    },
  };
  const k = knex(cfg);
  await k.migrate.latest();
  // Optionally: await k.seed.run();
  await k.destroy();
}


