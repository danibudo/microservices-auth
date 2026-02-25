/**
 * Lightweight database migration runner.
 *
 * Applies Flyway-style versioned SQL files (V{n}__{description}.sql) in order.
 * Tracks applied migrations in a `schema_migrations` table.
 * Validates checksums of previously applied files to catch accidental edits.
 */
import 'dotenv/config';
import { Client } from 'pg';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const MIGRATIONS_DIR = path.resolve(__dirname, '../../db/migrations');

interface AppliedMigration {
  version: string;
  checksum: string;
}

async function migrate(): Promise<void> {
  const client = new Client({
    host: process.env['DB_HOST'],
    port: Number(process.env['DB_PORT'] ?? 5432),
    database: process.env['DB_NAME'],
    user: process.env['DB_USER'],
    password: process.env['DB_PASSWORD'],
  });

  await client.connect();
  console.log('Connected to database.');

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version      VARCHAR(50)   PRIMARY KEY,
        script       VARCHAR(1000) NOT NULL,
        checksum     VARCHAR(64)   NOT NULL,
        applied_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        execution_ms INT           NOT NULL
      )
    `);

    const { rows: applied } = await client.query<AppliedMigration>(
      'SELECT version, checksum FROM schema_migrations ORDER BY version',
    );
    const appliedMap = new Map(applied.map((r) => [r.version, r.checksum]));

    const files = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((f) => /^V\d+__.*\.sql$/.test(f))
      .sort((a, b) => extractVersion(a) - extractVersion(b));

    let appliedCount = 0;

    for (const file of files) {
      const version = String(extractVersion(file));
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
      const checksum = sha256(sql);

      if (appliedMap.has(version)) {
        if (appliedMap.get(version) !== checksum) {
          throw new Error(
            `Checksum mismatch for migration "${file}". ` +
              `The file was modified after being applied. ` +
              `Create a new migration instead of editing an existing one.`,
          );
        }
        continue;
      }

      console.log(`Applying: ${file}`);
      const start = Date.now();

      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query(
          `INSERT INTO schema_migrations (version, script, checksum, execution_ms)
           VALUES ($1, $2, $3, $4)`,
          [version, file, checksum, Date.now() - start],
        );
        await client.query('COMMIT');
        appliedCount++;
      } catch (err) {
        await client.query('ROLLBACK');
        throw new Error(`Migration "${file}" failed: ${String(err)}`);
      }
    }

    if (appliedCount === 0) {
      console.log('Database schema is already up to date.');
    } else {
      console.log(`Successfully applied ${appliedCount} migration(s).`);
    }
  } finally {
    await client.end();
  }
}

function extractVersion(filename: string): number {
  const match = /^V(\d+)__/.exec(filename);
  if (!match?.[1]) throw new Error(`Invalid migration filename: "${filename}"`);
  return parseInt(match[1], 10);
}

function sha256(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

migrate().catch((err: unknown) => {
  console.error('Migration failed:', err);
  process.exit(1);
});