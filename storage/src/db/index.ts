/**
 * Database connection pool for storage service.
 * Uses separate database from main app to isolate file workload.
 */

import fs from 'fs';
import pg from 'pg';

const { Pool } = pg;

let pool: pg.Pool | null = null;

export function initDb(): void {
	if (pool) return;

	const config: pg.PoolConfig = {
		host: process.env.DB_HOST || 'localhost',
		port: Number(process.env.DB_PORT) || 5432,
		database: process.env.DB_NAME || 'storage',
		user: process.env.DB_USER || 'postgres',
		password: process.env.DB_PASSWORD,
		max: 10,
		idleTimeoutMillis: 30000,
		connectionTimeoutMillis: 5000,
	};

	// SSL for AWS RDS
	if (process.env.NODE_ENV === 'production') {
		config.ssl = {
			rejectUnauthorized: true,
			ca: fs.readFileSync('/app/rds-ca-bundle.pem', 'utf8'),
		};
	}

	pool = new Pool(config);

	pool.on('error', (err) => {
		console.error('Unexpected database pool error:', err);
	});

	console.log('Database pool initialized');
}

export function getPool(): pg.Pool {
	if (!pool) {
		throw new Error('Database pool not initialized');
	}
	return pool;
}

export async function closeDb(): Promise<void> {
	if (pool) {
		await pool.end();
		pool = null;
		console.log('Database pool closed');
	}
}

export { pool };
