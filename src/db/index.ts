import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema.ts';

declare global {
  var _postgresPool: Pool | undefined;
  var _schemaInitPromise: Promise<void> | undefined;
}

const connectionString =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_PRISMA_URL ||
  '';

export const hasDatabaseConfig = Boolean(
  connectionString || process.env.SQL_HOST
);

function shouldUseSsl(connStr: string): boolean | { rejectUnauthorized: boolean } {
  if (process.env.SQL_SSL === 'true') {
    return { rejectUnauthorized: false };
  }
  if (
    !connStr ||
    connStr.includes('localhost') ||
    connStr.includes('127.0.0.1') ||
    connStr.includes('sslmode=disable')
  ) {
    return false;
  }
  return { rejectUnauthorized: false };
}

export const createPool = () => {
  if (!global._postgresPool) {
    const poolConfig = connectionString
      ? {
          connectionString,
          ssl: shouldUseSsl(connectionString),
          max: 10,
          idleTimeoutMillis: 10000,
          connectionTimeoutMillis: 15000,
          keepAlive: true,
          keepAliveInitialDelayMillis: 5000,
          allowExitOnIdle: true,
        }
      : {
          host: process.env.SQL_HOST,
          port: process.env.SQL_PORT ? Number(process.env.SQL_PORT) : undefined,
          user: process.env.SQL_USER,
          password: process.env.SQL_PASSWORD,
          database: process.env.SQL_DB_NAME,
          ssl:
            process.env.SQL_SSL === 'true'
              ? { rejectUnauthorized: false }
              : undefined,
          max: 10,
          idleTimeoutMillis: 10000,
          connectionTimeoutMillis: 15000,
          keepAlive: true,
          keepAliveInitialDelayMillis: 5000,
          allowExitOnIdle: true,
        };

    global._postgresPool = new Pool(poolConfig);

    global._postgresPool.on('error', (err: NodeJS.ErrnoException) => {
      const msg = err?.message || '';
      const isIdleDisconnect =
        msg.includes('Connection terminated') ||
        err?.code === 'ECONNRESET' ||
        err?.code === 'EPIPE' ||
        err?.code === 'ETIMEDOUT' ||
        err?.code === '57P01';

      if (isIdleDisconnect) {
        console.warn(
          'Idle SQL pool connection closed by database; pool will reconnect on demand.'
        );
      } else {
        console.error('SQL pool error:', msg || err);
      }
    });
  }
  return global._postgresPool;
};

const pool = createPool();

export const db = drizzle(pool, { schema });

export async function ensureDatabaseSchema(): Promise<void> {
  if (!hasDatabaseConfig) return;
  if (!global._schemaInitPromise) {
    global._schemaInitPromise = (async () => {
      try {
        const check = await pool.query<{
          s: string | null;
          c: string | null;
          sc: string | null;
        }>(
          `SELECT
             to_regclass('public.squads') AS s,
             to_regclass('public.campaigns') AS c,
             to_regclass('public.site_credits') AS sc`
        );
        const row = check.rows[0];
        if (row?.s && row?.c && row?.sc) {
          return;
        }

        await pool.query(`
          CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            uid TEXT NOT NULL UNIQUE,
            email TEXT NOT NULL,
            display_name TEXT,
            role TEXT NOT NULL DEFAULT 'user',
            created_at TIMESTAMP NOT NULL DEFAULT NOW()
          );
          CREATE TABLE IF NOT EXISTS squads (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL,
            season TEXT NOT NULL DEFAULT '',
            country TEXT NOT NULL DEFAULT '',
            competition TEXT,
            crest_url TEXT,
            is_example BOOLEAN NOT NULL DEFAULT FALSE,
            is_final_only BOOLEAN NOT NULL DEFAULT FALSE,
            created_at TIMESTAMP NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP NOT NULL DEFAULT NOW()
          );
          CREATE TABLE IF NOT EXISTS players (
            id SERIAL PRIMARY KEY,
            squad_id INTEGER NOT NULL REFERENCES squads(id) ON DELETE CASCADE,
            full_name TEXT NOT NULL,
            nickname TEXT NOT NULL,
            shirt_number INTEGER NOT NULL DEFAULT 10,
            primary_position TEXT NOT NULL,
            secondary_positions JSONB NOT NULL DEFAULT '[]'::jsonb,
            rating INTEGER NOT NULL,
            is_legendary BOOLEAN NOT NULL DEFAULT FALSE,
            photo_url TEXT,
            created_at TIMESTAMP NOT NULL DEFAULT NOW()
          );
          CREATE TABLE IF NOT EXISTS campaigns (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
            guest_token TEXT,
            coach_name TEXT NOT NULL DEFAULT 'Treinador',
            formation TEXT NOT NULL,
            style TEXT NOT NULL,
            difficulty TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'drafting',
            skips_remaining INTEGER NOT NULL DEFAULT 3,
            current_squad_id INTEGER,
            drawn_squad_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
            avg_rating INTEGER NOT NULL DEFAULT 0,
            wins INTEGER NOT NULL DEFAULT 0,
            draws INTEGER NOT NULL DEFAULT 0,
            losses INTEGER NOT NULL DEFAULT 0,
            goals_for INTEGER NOT NULL DEFAULT 0,
            goals_against INTEGER NOT NULL DEFAULT 0,
            is_champion BOOLEAN NOT NULL DEFAULT FALSE,
            is_perfect_seven_zero BOOLEAN NOT NULL DEFAULT FALSE,
            share_code TEXT NOT NULL UNIQUE,
            created_at TIMESTAMP NOT NULL DEFAULT NOW(),
            completed_at TIMESTAMP
          );
          CREATE TABLE IF NOT EXISTS lineups (
            id SERIAL PRIMARY KEY,
            campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
            slot_index INTEGER NOT NULL,
            slot_position TEXT NOT NULL,
            slot_label TEXT NOT NULL,
            player_id INTEGER REFERENCES players(id) ON DELETE SET NULL,
            player_snapshot JSONB,
            picked_at TIMESTAMP DEFAULT NOW()
          );
          CREATE TABLE IF NOT EXISTS matches (
            id SERIAL PRIMARY KEY,
            campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
            match_order INTEGER NOT NULL,
            stage TEXT NOT NULL,
            opponent_name TEXT NOT NULL,
            opponent_crest_url TEXT,
            opponent_strength INTEGER NOT NULL,
            home_score INTEGER NOT NULL,
            away_score INTEGER NOT NULL,
            penalty_note TEXT,
            events JSONB NOT NULL DEFAULT '[]'::jsonb,
            played_at TIMESTAMP NOT NULL DEFAULT NOW()
          );
          CREATE TABLE IF NOT EXISTS achievements (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            guest_token TEXT,
            campaign_id INTEGER REFERENCES campaigns(id) ON DELETE SET NULL,
            code TEXT NOT NULL,
            title TEXT NOT NULL,
            description TEXT NOT NULL,
            unlocked_at TIMESTAMP NOT NULL DEFAULT NOW()
          );
          CREATE TABLE IF NOT EXISTS site_credits (
            id SERIAL PRIMARY KEY,
            title TEXT NOT NULL DEFAULT 'Créditos & Agradecimentos',
            subtitle TEXT NOT NULL DEFAULT '',
            intro TEXT NOT NULL DEFAULT '',
            entries JSONB NOT NULL DEFAULT '[]'::jsonb,
            footer_note TEXT NOT NULL DEFAULT '',
            updated_by TEXT,
            updated_at TIMESTAMP NOT NULL DEFAULT NOW()
          );
        `);
      } catch (err) {
        global._schemaInitPromise = undefined;
        throw err;
      }
    })();
  }
  await global._schemaInitPromise;
}
