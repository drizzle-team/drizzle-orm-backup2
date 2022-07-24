import { Column, Connector, Dialect, Driver, MigrationMeta, Session, sql } from 'drizzle-orm';
import { ColumnData, TableName, Unwrap } from 'drizzle-orm/branded-types';
import { Name, SQL, SQLResponse, SQLSourceParam } from 'drizzle-orm/sql';
import { GetTableName, tableColumns, tableName } from 'drizzle-orm/utils';
import { Connection, FieldPacket, Pool } from "mysql2/promise";
import { Simplify } from 'type-fest';
import { AnyMySqlColumn } from './columns/common';
import { MySqlSelectFields, MySqlSelectFieldsOrdered, MySqlTableOperations } from './operations';
import { AnyMySqlInsertConfig, MySqlDeleteConfig, MySqlSelectConfig, MySqlUpdateConfig, MySqlUpdateSet } from './queries';
import { AnyMySQL, MySqlPreparedQuery } from './sql';
import { AnyMySqlTable } from './table';

import { getTableColumns } from './utils';

export type MySqlQueryResult = [any, FieldPacket[]]

export type MySqlColumnDriverDataType =
	| string
	| number
	| bigint
	| boolean
	| null
	| Record<string, unknown>
	| Date;

export type MySqlClient = Connection | Pool;

export interface MySqlSession extends Session<MySqlColumnDriverDataType, Promise<MySqlQueryResult>> {
	queryObjects(
		query: string,
		params: unknown[],
	): Promise<MySqlQueryResult>;
}

export class MySqlSessionDefault implements MySqlSession {
	constructor(private client: MySqlClient) {}

	public async query(query: string, params: unknown[]): Promise<MySqlQueryResult> {
		// console.log({ query, params });
		const result = await this.client.query({ sql: query, values: params, rowsAsArray: true });
		return result;
	}

	public async queryObjects(
		query: string,
		params: unknown[],
	): Promise<MySqlQueryResult> {
		return this.client.query(query, params);
	}
}

export class MySqlDriver implements Driver<MySqlSession> {
	constructor(private client: MySqlClient) {
	}

	async connect(): Promise<MySqlSession> {
		return new MySqlSessionDefault(this.client);
	}
}

export class MySqlDialect<TDBSchema extends Record<string, AnyMySqlTable>>
	implements Dialect<MySqlSession, MySqlDatabase<TDBSchema>>
{
	constructor(private schema: TDBSchema) {}

	async migrate(migrations: MigrationMeta[], session: MySqlSession): Promise<void> {
		const migrationTableCreate = `CREATE TABLE IF NOT EXISTS \`drizzle\`.\`__drizzle_migrations\` (
			id SERIAL PRIMARY KEY,
			hash text NOT NULL,
			created_at bigint
		)`
			.trim()
			.replace(/\s{2,}/, ' ')
			.replace(/\n+/g, '')
			.replace(/ +/g, ' ');
		await session.query('CREATE SCHEMA IF NOT EXISTS \`drizzle\`', []);
		await session.query(migrationTableCreate, []);

		const dbMigrations = await session.query(
			`SELECT id, hash, created_at FROM \`drizzle\`.\`__drizzle_migrations\` ORDER BY created_at DESC LIMIT 1`,
			[],
		);

		const lastDbMigration = dbMigrations[0][0] ?? undefined;
		await session.query('BEGIN;', []);

		try {
			for await (const migration of migrations) {
				if (!lastDbMigration || parseInt(lastDbMigration[2], 10)! < migration.folderMillis) {
					await session.query(migration.sql, []);
					await session.query(
						`INSERT INTO \`drizzle\`.\`__drizzle_migrations\` (\`hash\`, \`created_at\`) VALUES('${migration.hash}', ${migration.folderMillis})`,
						[],
					);
				}
			}

			await session.query('COMMIT;', []);
		} catch (e) {
			await session.query('ROLLBACK;', []);
			throw e;
		}
	}

	createDB(session: MySqlSession): MySqlDatabase<TDBSchema> {
		return this.createMySqlDB(this.schema, session);
	}

	createMySqlDB(schema: TDBSchema, session: MySqlSession): MySqlDatabase<TDBSchema> {
		return Object.assign(
			Object.fromEntries(
				Object.entries(schema).map(([tableName, table]) => {
					return [
						tableName,
						new MySqlTableOperations(table, session, this as unknown as AnyMySqlDialect),
					];
				}),
			),
			{
				execute: (query: MySqlPreparedQuery | AnyMySQL): Promise<MySqlQueryResult> => {
					const preparedQuery = query instanceof SQL ? this.prepareSQL(query) : query;
					return session.queryObjects(preparedQuery.sql, preparedQuery.params);
				},
			},
		) as unknown as MySqlDatabase<TDBSchema>;
	}

	public escapeName(name: string): string {
		return `\`${name}\``;
	}

	public escapeParam(num: number): string {
		return `?`;
	}

	public buildDeleteQuery<TTable extends AnyMySqlTable>({
		table,
		where,
		returning,
	}: MySqlDeleteConfig<TTable>): AnyMySQL<GetTableName<TTable>> {
		const returningStatement = returning
			? sql.fromList(this.prepareTableFieldsForQuery(returning))
			: undefined;

		return sql`delete from ${table} ${where ? sql`where ${where}` : undefined} ${returningStatement}` as AnyMySQL<
			GetTableName<TTable>
		>;
	}

	buildUpdateSet<TTableName extends TableName>(
		table: AnyMySqlTable,
		set: MySqlUpdateSet<AnyMySqlTable>,
	): AnyMySQL<TTableName> {
		const setEntries = Object.entries<ColumnData | AnyMySQL<TTableName>>(set);

		const setSize = setEntries.length;
		return sql.fromList(
			setEntries
				.map(([colName, value], i): AnyMySQL<TTableName>[] => {
					const col = table[tableColumns][colName]!;
					const res = sql<TTableName>`${new Name(col.name)} = ${value}`;
					if (i < setSize - 1) {
						return [res, sql.raw(', ')];
					}
					return [res];
				})
				.flat(1),
		);
	}

	orderSelectedFields<TTableName extends TableName>(
		fields: MySqlSelectFields<TTableName>,
	): MySqlSelectFieldsOrdered<TTableName> {
		return Object.entries(fields).map(([name, column]) => ({
			name,
			column,
		}));
	}

	public buildUpdateQuery<TTable extends AnyMySqlTable>({
		table,
		set,
		where,
		returning,
	}: MySqlUpdateConfig<TTable>): SQL<GetTableName<TTable>> {
		const setSql = this.buildUpdateSet<GetTableName<TTable>>(table, set);

		const returningStatement = returning
			? sql<GetTableName<TTable>>`returning ${
				sql.fromList(
					this.prepareTableFieldsForQuery(returning),
				)
			}`
			: undefined;

		return sql<GetTableName<TTable>>`update ${table} set ${setSql} ${
			where ? sql`where ${where}` : undefined
		} ${returningStatement}`;
	}

	private prepareTableFieldsForQuery<TTableName extends TableName>(
		columns: MySqlSelectFieldsOrdered<TTableName>,
	): SQLSourceParam<TTableName>[] {
		const columnsLen = columns.length;

		return columns
			.map(({ column }, i) => {
				const chunk: SQLSourceParam<TTableName>[] = [];

				if (column instanceof SQLResponse) {
					chunk.push(column.sql);
				} else if (column instanceof Column) {
					const columnTableName = column.table[tableName];
					chunk.push(column);
				}

				if (i < columnsLen - 1) {
					chunk.push(sql`, `);
				}

				return chunk;
			})
			.flat(1);
	}

	public buildSelectQuery<TTableName extends TableName>({
		fields,
		where,
		table,
		joins,
		orderBy,
		limit,
		offset,
	}: MySqlSelectConfig): AnyMySQL<TTableName> {
		const sqlFields = sql.fromList(this.prepareTableFieldsForQuery(fields));

		const joinsArray: AnyMySQL[] = [];
		if (joins) {
			const joinKeys = Object.keys(joins);

			joinKeys.forEach((tableAlias, index) => {
				const joinMeta = joins[tableAlias]!;
				joinsArray.push(
					sql`${sql.raw(joinMeta.joinType)} join ${joinMeta.table} ${joinMeta.alias} on ${joinMeta.on}` as AnyMySQL,
				);
				if (index < joinKeys.length - 1) {
					joinsArray.push(sql` `);
				}
			});
		}

		const orderByList: AnyMySQL[] = [];
		orderBy.forEach((orderByValue, index) => {
			orderByList.push(orderByValue);

			if (index < orderBy.length - 1) {
				orderByList.push(sql`, `);
			}
		});

		return sql<TTableName>`select ${sqlFields} from ${table as AnyMySqlTable<TTableName>} ${sql.fromList(joinsArray)} ${
			where ? sql`where ${where}` : undefined
		} ${orderBy.length > 0 ? sql.raw('order by') : undefined} ${sql.fromList(orderByList)} ${
			limit ? sql.raw(`limit ${limit}`) : undefined
		} ${offset ? sql.raw(`offset ${offset}`) : undefined}`;
	}

	public buildInsertQuery({ table, values, onConflict, returning }: AnyMySqlInsertConfig): AnyMySQL {
		const joinedValues: (SQLSourceParam<TableName> | AnyMySQL)[][] = [];
		const columns: Record<string, AnyMySqlColumn> = getTableColumns(table);
		const columnKeys = Object.keys(columns);
		const insertOrder = Object.values(columns).map((column) => new Name(column.name));

		values.forEach((value) => {
			const valueList: (SQLSourceParam<TableName> | AnyMySQL)[] = [];
			columnKeys.forEach((key) => {
				const colValue = value[key];
				if (typeof colValue === 'undefined') {
					valueList.push(sql`default`);
				} else {
					valueList.push(colValue);
				}
			});
			joinedValues.push(valueList);
		});

		const returningStatement = returning
			? sql`returning ${sql.fromList(this.prepareTableFieldsForQuery(returning))}`
			: undefined;

		return sql`insert into ${table} ${insertOrder} values ${
			joinedValues.length === 1 ? joinedValues[0] : joinedValues
		} ${onConflict ? sql`on conflict ${onConflict}` : undefined} ${returningStatement}`;
	}

	public prepareSQL(sql: AnyMySQL): MySqlPreparedQuery {
		return sql.toQuery<MySqlColumnDriverDataType>({
			escapeName: this.escapeName,
			escapeParam: this.escapeParam,
		});
	}
}

export type AnyMySqlDialect = MySqlDialect<Record<string, AnyMySqlTable>>;

export type BuildTableNamesMap<TSchema extends Record<string, AnyMySqlTable>> = {
	[Key in keyof TSchema & string as Unwrap<GetTableName<TSchema[Key]>>]: Key;
};

export type MySqlDatabase<TSchema extends Record<string, AnyMySqlTable>> = Simplify<
	{
		[TTableName in keyof TSchema & string]: TSchema[TTableName] extends AnyMySqlTable<TableName>
			? MySqlTableOperations<TSchema[TTableName], BuildTableNamesMap<TSchema>>
			: never;
	} & {
		execute: <T extends MySqlQueryResult = MySqlQueryResult>(
			query: MySqlPreparedQuery | AnyMySQL,
		) => Promise<T>;
	},
	{ deep: true }
>;

export class PgConnector<TDBSchema extends Record<string, AnyMySqlTable>>
	implements Connector<MySqlSession, MySqlDatabase<TDBSchema>>
{
	dialect: Dialect<MySqlSession, MySqlDatabase<TDBSchema>>;
	driver: Driver<MySqlSession>;

	constructor(client: MySqlClient, dbSchema: TDBSchema) {
		this.dialect = new MySqlDialect(dbSchema);
		this.driver = new MySqlDriver(client);
	}
}
