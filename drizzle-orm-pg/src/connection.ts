import {
	Column,
	Connector,
	DefaultLogger,
	Dialect,
	Driver,
	Logger,
	MigrationMeta,
	NoopLogger,
	Session,
	sql,
} from 'drizzle-orm';
import { ColumnData, TableName, Unwrap } from 'drizzle-orm/branded-types';
import { AnySQL, Name, SQL, SQLResponse, SQLSourceParam } from 'drizzle-orm/sql';
import { GetTableName, tableColumns, tableName } from 'drizzle-orm/utils';
import { Client, Pool, PoolClient, QueryResult, QueryResultRow, types } from 'pg';
import { Simplify } from 'type-fest';

import { AnyPgColumn, PgColumn } from './columns';
import { PgSelectFields, PgSelectFieldsOrdered, PgTableOperations } from './operations';
import { AnyPgInsertConfig, PgDeleteConfig, PgSelectConfig, PgUpdateConfig, PgUpdateSet } from './queries';
import { AnyPgSQL, PgPreparedQuery } from './sql';
import { AnyPgTable } from './table';

export type PgColumnDriverDataType =
	| string
	| number
	| bigint
	| boolean
	| null
	| Record<string, unknown>
	| Date;

export type PgClient = Pool | PoolClient | Client;

export interface PgSession extends Session<PgColumnDriverDataType, Promise<QueryResult>> {
	queryObjects<T extends QueryResultRow>(
		query: string,
		params: unknown[],
	): Promise<QueryResult<T>>;
}

export interface PgDefaultSessionOptions {
	logger?: Logger;
}

export class PgDefaultSession implements PgSession {
	private logger: Logger;

	constructor(private client: PgClient, options: PgDefaultSessionOptions = {}) {
		this.logger = options.logger ?? new NoopLogger();
	}

	public async query(query: string, params: unknown[]): Promise<QueryResult> {
		this.logger.logQuery(query, params);
		const result = await this.client.query({
			rowMode: 'array',
			text: query,
			values: params,
		});
		return result;
	}

	public async queryObjects<T extends QueryResultRow>(
		query: string,
		params: unknown[],
	): Promise<QueryResult<T>> {
		return this.client.query<T>(query, params);
	}
}

export interface PgDriverOptions {
	logger?: Logger;
}

export class PgDriver implements Driver<PgSession> {
	constructor(private client: PgClient, private options: PgDriverOptions = {}) {
		this.initMappers();
	}

	async connect(): Promise<PgSession> {
		return new PgDefaultSession(this.client, { logger: this.options.logger });
	}

	public initMappers() {
		types.setTypeParser(types.builtins.TIMESTAMPTZ, (val) => val);
		types.setTypeParser(types.builtins.TIMESTAMP, (val) => val);
		types.setTypeParser(types.builtins.DATE, (val) => val);
	}
}

export class PgDialect<TDBSchema extends Record<string, AnyPgTable>>
	implements Dialect<PgSession, PGDatabase<TDBSchema>>
{
	constructor(private schema: TDBSchema) {}

	async migrate(migrations: MigrationMeta[], session: PgSession): Promise<void> {
		const migrationTableCreate = `CREATE TABLE IF NOT EXISTS "drizzle"."__drizzle_migrations" (
			id SERIAL PRIMARY KEY,
			hash text NOT NULL,
			created_at bigint
		)`
			.trim()
			.replace(/\s{2,}/, ' ')
			.replace(/\n+/g, '')
			.replace(/ +/g, ' ');
		await session.query('CREATE SCHEMA IF NOT EXISTS "drizzle"', []);
		await session.query(migrationTableCreate, []);

		const dbMigrations = await session.query(
			`SELECT id, hash, created_at FROM "drizzle"."__drizzle_migrations" ORDER BY created_at DESC LIMIT 1`,
			[],
		);

		const lastDbMigration = dbMigrations.rows[0] ?? undefined;
		await session.query('BEGIN;', []);

		try {
			for await (const migration of migrations) {
				if (!lastDbMigration || parseInt(lastDbMigration[2], 10)! < migration.folderMillis) {
					await session.query(migration.sql, []);
					await session.query(
						`INSERT INTO "drizzle"."__drizzle_migrations" ("hash", "created_at") VALUES('${migration.hash}', ${migration.folderMillis})`,
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

	private buildTableNamesMap(): Record<string, string> {
		return Object.entries(this.schema).reduce<Record<string, string>>((acc, [tName, table]) => {
			acc[table[tableName]] = tName;
			return acc;
		}, {});
	}

	createDB(session: PgSession): PGDatabase<TDBSchema> {
		return this.createPGDB(session);
	}

	createPGDB(session: PgSession): PGDatabase<TDBSchema> {
		return Object.assign(
			Object.fromEntries(
				Object.entries(this.schema).map(([tableName, table]) => {
					return [
						tableName,
						new PgTableOperations(table, session, this as unknown as AnyPgDialect, this.buildTableNamesMap()),
					];
				}),
			),
			{
				execute: (query: PgPreparedQuery | AnyPgSQL): Promise<QueryResult> => {
					const preparedQuery = query instanceof SQL ? this.prepareSQL(query) : query;
					return session.queryObjects(preparedQuery.sql, preparedQuery.params);
				},
			},
		) as unknown as PGDatabase<TDBSchema>;
	}

	public escapeName(name: string): string {
		return `"${name}"`;
	}

	public escapeParam(num: number): string {
		return `$${num}`;
	}

	public buildDeleteQuery<TTable extends AnyPgTable>({
		table,
		where,
		returning,
	}: PgDeleteConfig<TTable>): AnyPgSQL<GetTableName<TTable>> {
		const returningSql = returning
			? sql.fromList([sql` returning `, ...this.prepareTableFieldsForQuery(returning, { isSingleTable: true })])
			: undefined;

		const whereSql = where ? sql` where ${where}` : undefined;

		return sql`delete from ${table}${whereSql}${returningSql}` as AnyPgSQL<
			GetTableName<TTable>
		>;
	}

	buildUpdateSet<TTableName extends TableName>(
		table: AnyPgTable,
		set: PgUpdateSet<AnyPgTable>,
	): AnyPgSQL<TTableName> {
		const setEntries = Object.entries<ColumnData | AnyPgSQL<TTableName>>(set);

		const setSize = setEntries.length;
		return sql.fromList(
			setEntries
				.map(([colName, value], i): AnyPgSQL<TTableName>[] => {
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

	orderSelectedFields(
		fields: PgSelectFields<TableName>,
		resultTableName: string,
	): PgSelectFieldsOrdered {
		return Object.entries(fields).map(([name, column]) => ({
			name,
			resultTableName,
			column,
		}));
	}

	public buildUpdateQuery<TTable extends AnyPgTable>({
		table,
		set,
		where,
		returning,
	}: PgUpdateConfig<TTable>): AnySQL {
		const setSql = this.buildUpdateSet<GetTableName<TTable>>(table, set);

		const returningSql = returning
			? sql<GetTableName<TTable>>` returning ${
				sql.fromList(
					this.prepareTableFieldsForQuery(returning, { isSingleTable: true }),
				)
			}`
			: undefined;

		const whereSql = where ? sql` where ${where}` : undefined;

		return sql`update ${table} set ${setSql}${whereSql}${returningSql}`;
	}

	private prepareTableFieldsForQuery(
		columns: PgSelectFieldsOrdered,
		{ isSingleTable = false }: { isSingleTable?: boolean } = {},
	): SQLSourceParam<TableName>[] {
		const columnsLen = columns.length;

		return columns
			.map(({ column }, i) => {
				const chunk: SQLSourceParam<TableName>[] = [];

				if (column instanceof SQLResponse) {
					if (isSingleTable) {
						chunk.push(
							new SQL(column.sql.queryChunks.map((c) => {
								if (c instanceof PgColumn) {
									return new Name(c.name);
								}
								return c;
							})),
						);
					} else {
						chunk.push(column.sql);
					}
				} else if (column instanceof Column) {
					if (isSingleTable) {
						chunk.push(new Name(column.name));
					} else {
						chunk.push(column);
					}
				}

				if (i < columnsLen - 1) {
					chunk.push(sql`, `);
				}

				return chunk;
			})
			.flat(1);
	}

	public buildSelectQuery({
		fields,
		where,
		table,
		joins,
		orderBy,
		limit,
		offset,
	}: PgSelectConfig): AnyPgSQL {
		const joinKeys = Object.keys(joins);

		const fieldsSql = sql.fromList(
			this.prepareTableFieldsForQuery(fields, { isSingleTable: joinKeys.length === 0 }),
		);

		const joinsArray: AnyPgSQL[] = [];

		joinKeys.forEach((tableAlias, index) => {
			if (index === 0) {
				joinsArray.push(sql` `);
			}
			const joinMeta = joins[tableAlias]!;
			const alias = joinMeta.aliasTable[tableName] === joinMeta.table[tableName] ? undefined : joinMeta.aliasTable;
			joinsArray.push(sql`${sql.raw(joinMeta.joinType)} join ${joinMeta.table} ${alias} on ${joinMeta.on}`);
			if (index < joinKeys.length - 1) {
				joinsArray.push(sql` `);
			}
		});

		const joinsSql = sql.fromList(joinsArray);

		const whereSql = where ? sql` where ${where}` : undefined;

		const orderByList: AnyPgSQL[] = [];
		orderBy.forEach((orderByValue, index) => {
			orderByList.push(orderByValue);

			if (index < orderBy.length - 1) {
				orderByList.push(sql`, `);
			}
		});

		const orderBySql = orderByList.length > 0 ? sql` order by ${sql.fromList(orderByList)}` : undefined;

		const limitSql = limit ? sql` limit ${limit}` : undefined;

		const offsetSql = offset ? sql` offset ${offset}` : undefined;

		return sql`select ${fieldsSql} from ${table}${joinsSql}${whereSql}${orderBySql}${limitSql}${offsetSql}`;
	}

	public buildInsertQuery({ table, values, onConflict, returning }: AnyPgInsertConfig): AnyPgSQL {
		const joinedValues: (SQLSourceParam<TableName> | AnyPgSQL)[][] = [];
		const columns: Record<string, AnyPgColumn> = table[tableColumns];
		const columnKeys = Object.keys(columns);
		const insertOrder = Object.values(columns).map((column) => new Name(column.name));

		values.forEach((value) => {
			const valueList: (SQLSourceParam<TableName> | AnyPgSQL)[] = [];
			columnKeys.forEach((colKey) => {
				const colValue = value[colKey];
				const column = columns[colKey]!;
				if (typeof colValue === 'undefined') {
					valueList.push(sql`default`);
				} else {
					valueList.push(column.mapToDriverValue(colValue) as SQLSourceParam<TableName>);
				}
			});
			joinedValues.push(valueList);
		});

		const returningSql = returning
			? sql` returning ${sql.fromList(this.prepareTableFieldsForQuery(returning, { isSingleTable: true }))}`
			: undefined;

		const valuesSql = joinedValues.length === 1 ? joinedValues[0] : joinedValues;

		const onConflictSql = onConflict ? sql` on conflict ${onConflict}` : undefined;

		return sql`insert into ${table} ${insertOrder} values ${valuesSql}${onConflictSql}${returningSql}`;
	}

	public prepareSQL(sql: AnyPgSQL): PgPreparedQuery {
		return sql.toQuery<PgColumnDriverDataType>({
			escapeName: this.escapeName,
			escapeParam: this.escapeParam,
		});
	}
}

export type AnyPgDialect = PgDialect<Record<string, AnyPgTable>>;

export type BuildTableNamesMap<TSchema extends Record<string, AnyPgTable>> = {
	[Key in keyof TSchema & string as Unwrap<GetTableName<TSchema[Key]>>]: Key;
};

export type PGDatabase<TSchema extends Record<string, AnyPgTable>> = Simplify<
	{
		[TTableName in keyof TSchema & string]: TSchema[TTableName] extends AnyPgTable<TableName>
			? PgTableOperations<TSchema[TTableName], BuildTableNamesMap<TSchema>>
			: never;
	} & {
		execute<T extends QueryResultRow = QueryResultRow>(
			query: PgPreparedQuery | AnyPgSQL,
		): Promise<T>;
	},
	{ deep: true }
>;

export interface PgConnectorOptions {
	logger?: Logger;
}

export class PgConnector<TDBSchema extends Record<string, AnyPgTable>>
	implements Connector<PgSession, PGDatabase<TDBSchema>>
{
	dialect: Dialect<PgSession, PGDatabase<TDBSchema>>;
	driver: Driver<PgSession>;

	constructor(client: PgClient, dbSchema: TDBSchema, options: PgConnectorOptions = {}) {
		this.dialect = new PgDialect(dbSchema);
		this.driver = new PgDriver(client, { logger: options.logger });
	}
}
