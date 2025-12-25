import type { MigrationBuilder } from 'node-pg-migrate';

export async function up(pgm: MigrationBuilder): Promise<void> {
	// Enable UUID extension
	pgm.sql('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');

	// Users table (primary identity)
	pgm.createTable('users', {
		id: {
			type: 'uuid',
			primaryKey: true,
			default: pgm.func('gen_random_uuid()'),
		},
		cognito_sub: {
			type: 'varchar(255)',
			notNull: true,
			unique: true,
		},
		display_name: {
			type: 'varchar(255)',
			notNull: true,
		},
		avatar_url: {
			type: 'text',
		},
		created_at: {
			type: 'timestamptz',
			default: pgm.func('NOW()'),
		},
		updated_at: {
			type: 'timestamptz',
			default: pgm.func('NOW()'),
		},
	});

	// User emails (multiple per user)
	pgm.createTable('user_emails', {
		id: {
			type: 'uuid',
			primaryKey: true,
			default: pgm.func('gen_random_uuid()'),
		},
		user_id: {
			type: 'uuid',
			notNull: true,
			references: 'users',
			onDelete: 'CASCADE',
		},
		email: {
			type: 'varchar(255)',
			notNull: true,
			unique: true,
		},
		is_primary: {
			type: 'boolean',
			default: false,
		},
		is_verified: {
			type: 'boolean',
			default: false,
		},
		verified_at: {
			type: 'timestamptz',
		},
		created_at: {
			type: 'timestamptz',
			default: pgm.func('NOW()'),
		},
	});

	// Ensure one primary email per user
	pgm.createIndex('user_emails', 'user_id', {
		unique: true,
		where: 'is_primary = TRUE',
		name: 'idx_user_primary_email',
	});

	// GitHub connections
	pgm.createTable('github_connections', {
		id: {
			type: 'uuid',
			primaryKey: true,
			default: pgm.func('gen_random_uuid()'),
		},
		user_id: {
			type: 'uuid',
			notNull: true,
			unique: true,
			references: 'users',
			onDelete: 'CASCADE',
		},
		github_user_id: {
			type: 'varchar(255)',
			notNull: true,
			unique: true,
		},
		github_username: {
			type: 'varchar(255)',
			notNull: true,
		},
		access_token: {
			type: 'text',
			notNull: true,
		},
		refresh_token: {
			type: 'text',
		},
		token_expires_at: {
			type: 'timestamptz',
		},
		scopes: {
			type: 'text[]',
			notNull: true,
		},
		connected_at: {
			type: 'timestamptz',
			default: pgm.func('NOW()'),
		},
	});

	// MCP OAuth tokens
	pgm.createTable('mcp_tokens', {
		id: {
			type: 'uuid',
			primaryKey: true,
			default: pgm.func('gen_random_uuid()'),
		},
		user_id: {
			type: 'uuid',
			notNull: true,
			references: 'users',
			onDelete: 'CASCADE',
		},
		client_id: {
			type: 'varchar(255)',
			notNull: true,
		},
		access_token_hash: {
			type: 'varchar(255)',
			notNull: true,
			unique: true,
		},
		refresh_token_hash: {
			type: 'varchar(255)',
		},
		scopes: {
			type: 'text[]',
			notNull: true,
		},
		expires_at: {
			type: 'timestamptz',
			notNull: true,
		},
		created_at: {
			type: 'timestamptz',
			default: pgm.func('NOW()'),
		},
	});

	// OAuth authorization codes (short-lived)
	pgm.createTable('oauth_codes', {
		code: {
			type: 'varchar(255)',
			primaryKey: true,
		},
		user_id: {
			type: 'uuid',
			notNull: true,
			references: 'users',
			onDelete: 'CASCADE',
		},
		client_id: {
			type: 'varchar(255)',
			notNull: true,
		},
		code_challenge: {
			type: 'varchar(255)',
			notNull: true,
		},
		code_challenge_method: {
			type: 'varchar(10)',
			notNull: true,
		},
		scopes: {
			type: 'text[]',
			notNull: true,
		},
		redirect_uri: {
			type: 'text',
			notNull: true,
		},
		expires_at: {
			type: 'timestamptz',
			notNull: true,
		},
	});

	// Additional indexes for common queries
	pgm.createIndex('user_emails', 'user_id');
	pgm.createIndex('github_connections', 'user_id');
	pgm.createIndex('mcp_tokens', 'user_id');
	pgm.createIndex('mcp_tokens', 'expires_at');
	pgm.createIndex('oauth_codes', 'expires_at');
}

export async function down(pgm: MigrationBuilder): Promise<void> {
	pgm.dropTable('oauth_codes');
	pgm.dropTable('mcp_tokens');
	pgm.dropTable('github_connections');
	pgm.dropTable('user_emails');
	pgm.dropTable('users');
}
