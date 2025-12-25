import type { MigrationBuilder } from 'node-pg-migrate';

export async function up(pgm: MigrationBuilder): Promise<void> {
	// Migration code here
}

export async function down(pgm: MigrationBuilder): Promise<void> {
	// Rollback code here
}
