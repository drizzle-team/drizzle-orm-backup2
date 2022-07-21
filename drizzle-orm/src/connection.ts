import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

import { sql } from './sql';

export interface Session<TQueryParam, TQueryResponse> {
	query(query: string, params: TQueryParam[]): TQueryResponse;
}

export interface Driver<TSession> {
	connect(): Promise<TSession>;
}

export interface Dialect<TSession, TDatabase> {
	createDB(session: TSession): TDatabase;

	migrate(path: string | { migrationsFolder: string }): Promise<void>;
}

export interface Connector<TSession, TOperations> {
	dialect: Dialect<TSession, TOperations>;
	driver: Driver<TSession>;
}

export async function connect<TSession, TDatabase>(connector: Connector<TSession, TDatabase>) {
	const session = await connector.driver.connect();
	return connector.dialect.createDB(session);
}

export interface KitConfig {
	out: string;
	schema: string;
}

export interface MigrationConfig {
	migrationsFolder: string;
}

export async function migrate<TSession, TDatabase>(
	connector: Connector<TSession, TDatabase>,
	config: string,
): Promise<void>;
export async function migrate<TSession, TDatabase>(
	connector: Connector<TSession, TDatabase>,
	config: MigrationConfig,
): Promise<void>;
export async function migrate<TSession extends Session<any, any>, TDatabase>(
	connector: Connector<TSession, TDatabase>,
	config: string | MigrationConfig,
) {
	await connector.dialect.migrate(config);

	
	let migrationFolderTo: string | undefined;
	if (typeof config === 'string') {
		const configAsString = fs.readFileSync(path.resolve('.', config), 'utf8');
		const jsonConfig = JSON.parse(configAsString) as KitConfig;
		migrationFolderTo = jsonConfig.out;
	} else {
		migrationFolderTo = (config as MigrationConfig).out;
	}

	if (!migrationFolderTo) {
		throw Error('no migration folder defined');
	}

	// connector.dialect.

	const session = await connector.driver.connect();
	const migrationTableCreate = `CREATE TABLE \'__drizzle_migrations\' IF NOT EXISTS (
		id SERIAL PRIMARY KEY,
		hash text NOT NULL,
		created_at bigint
	)`
		.trim()
		.replace(/\s{2,}/, ' ')
		.replace(/\n+/g, '')
		.replace(/ +/g, ' ');
	await session.query(migrationTableCreate, []);

	const dbMigrations = await session.query(`SELECT id, hash, created_at FROM __drizzle_migrations ORDER BY created_at DESC LIMIT 1`, []);

	const dbMigrations = await migrationTable
		.select()
		.limit(1)
		.orderBy((table) => table.createdAt, Order.DESC)
		.all();

	const lastDbMigration = dbMigrations[0] ?? undefined;
	console.log('last migration: ', lastDbMigration?.hash);

	const files = fs.readdirSync(migrationFolderTo);
	const transaction = new Transaction(this.db.session());
	await transaction.begin();

	try {
		for await (const migrationFolder of files) {
			if (migrationFolder === '.DS_Store') {
				continue;
			}
			const migrationFiles = fs.readdirSync(`${migrationFolderTo}/${migrationFolder}`);
			const migrationFile = migrationFiles.filter((file) => file === 'migration.sql')[0];

			const query = fs
				.readFileSync(`${migrationFolderTo}/${migrationFolder}/${migrationFile}`)
				.toString();

			const year = Number(migrationFolder.slice(0, 4));
			// second param for Date() is month index, that started from 0, so we need
			// to decrement a value for month
			const month = Number(migrationFolder.slice(4, 6)) - 1;
			const day = Number(migrationFolder.slice(6, 8));
			const hour = Number(migrationFolder.slice(8, 10));
			const min = Number(migrationFolder.slice(10, 12));
			const sec = Number(migrationFolder.slice(12, 14));

			const folderAsMillis = Date.UTC(year, month, day, hour, min, sec);
			console.log(`check migration ${migrationFolder} {folderAsMillis}`);
			if (!lastDbMigration || lastDbMigration.createdAt! < folderAsMillis) {
				console.log(`executing ${migrationFolder}`);
				await this.db.session().execute(query);
				await migrationTable
					.insert({
						hash: this.generateHash(query),
						createdAt: folderAsMillis,
					})
					.execute();
			}
		}

		await transaction.commit();
	} catch (e) {
		await transaction.rollback();
		throw e;
	}
}

interface Pool {}
