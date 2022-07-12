// import { Pool, QueryResult } from 'pg';
import { AnyTable, Column, InferColumnsTypes, InferColumnType } from 'drizzle-orm';
import {
	InferType,
	SelectFields,
	UpdateConfig,
	SelectConfig,
	Return,
	InferColumns,
} from 'drizzle-orm/operations';
import { SQL, Primitive } from 'drizzle-orm/sql';
import { TableName } from 'drizzle-orm/utils';

import { AnyPgTable, PgColumn, AnyPgDialect, PgSession, PgTable, PgInteger } from '.';

interface QueryResult<T> {}

export class PgTableOperations<TTable extends AnyPgTable = AnyPgTable> {
	constructor(
		private table: TTable,
		private session: AnyPgSession,
		private dialect: AnyPgDialect,
	) {}

	private map(rows: any[]): InferType<TTable>[] {
		return rows;
	}

	select(): Omit<PgSelect<TTable>, 'where'> & { 'where': PgSelect<TTable>['whereWithSql'] };
	select<TSelectedFields extends SelectFields<TableName<TTable>>>(fields?: TSelectedFields): Omit<PgSelect<TTable, TSelectedFields>, 'where'> & { 'where': PgSelect<TTable, TSelectedFields>['whereWithSql'] };
	select(fields?: any) {
		return new PgSelect<TTable>(this.table, fields, this.session, this.map, this.dialect);
	}

	update(): Pick<PgUpdate<TTable>, 'set'> {
		return new PgUpdate(this.table, this.session, this.map, this.dialect);
	}
}

export const rawQuery = Symbol('raw');

export type DB<TDBSchema extends Record<string, AnyPgTable>> = {
	[TTable in keyof TDBSchema & string]: PgTableOperations<TDBSchema[TTable]>;
} & {
	[rawQuery]: (query: SQL) => Promise<unknown>;
};

export type AnyPgSession = PgSession<any>;

export interface PgUpdateConfig extends UpdateConfig {
	returning?: boolean;
}

export interface PgSelectConfig extends SelectConfig<AnyPgTable> {}

export type AnyPgSelectConfig = SelectConfig<AnyPgTable>;

export interface PgReturn extends Return {
	num: number;
}

export class PgUpdate<TTable extends AnyPgTable, TReturn = QueryResult<any>> {
	private fields: PgUpdateConfig = {} as PgUpdateConfig;

	constructor(
		private table: TTable,
		private session: AnyPgSession,
		private mapper: (rows: any[]) => InferType<TTable>[],
		private dialect: AnyPgDialect,
	) {
		this.fields.table = table;
	}

	public set(values: SQL<TableName<TTable>>): Pick<this, 'where' | 'returning' | 'execute'> {
		this.fields.set = values;
		return this;
	}

	public where(where: SQL<TableName<TTable>>): Pick<this, 'returning' | 'execute'> {
		this.fields.where = where;
		return this;
	}

	public returning(): Pick<PgUpdate<TTable, InferType<TTable>>, 'execute'> {
		this.fields.returning = true;
		return this as unknown as Pick<PgUpdate<TTable, InferType<TTable>>, 'execute'>;
	}

	public async execute(): Promise<TReturn> {
		const query = this.dialect.buildUpdateQuery(this.fields);
		const [sql, params] = this.dialect.prepareSQL(query);
		const result = await this.session.query(sql, params);
		// mapping from driver response to return type
		return this.mapper(result.rows) as unknown as TReturn;
	}
}

export type InferTableNameFrom<TJoins extends { [K in TableName<AnyTable>]: any }> =
	TJoins extends { [K in TableName<infer TTable>]: any } ? TTable : never;

export type BuildAlias<
	TTable extends AnyPgTable,
	TAlias extends number,
> = `${TableName<TTable>}${TAlias}`;

export type TableAlias<TTable extends AnyPgTable, TAlias extends string> = TTable extends PgTable<
	any,
	infer TColumns
>
	? PgTable<TAlias, AliasColumns<TColumns, TAlias>> & AliasColumns<TColumns, TAlias>
	: never;

export type AliasColumns<TColumns, TAlias extends string> = {
	[Key in keyof TColumns]: TColumns[Key] extends PgColumn<
		any,
		infer TType,
		infer TNotNull,
		infer TDefault
	>
		? PgColumn<TAlias, TType, TNotNull, TDefault>
		: never;
};

// prettier-ignore
export type Increment<
	TTableName extends string,
	TAlias extends { [name: string]: number },
> = TAlias extends { [key in TTableName]: infer N }
	? N extends number
		? Omit<TAlias, TTableName> 
		& {
				[K in TTableName]: 
				[ 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
			21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37,
			38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54,
		][N];
		  }
		: never
	: Omit<TAlias, TTableName> & {[Key in TTableName]: 2};

export type GetAliasIndex<
	TTableName extends string,
	TAlias extends { [name: string]: number },
> = TAlias extends { [name in TTableName]: infer N } ? (N extends number ? N : never) : 1;

export type JoinResponse<TJoins extends { [k: string]: any }> = 
	[{ [Key in keyof TJoins]: InferColumnsTypes<TJoins[Key]> }]

export class PgSelect<
	TTable extends AnyPgTable,
	TReturn = InferColumns<TTable>,
	TJoins extends { [k: string]: any } = { [K in TableName<TTable>]: InferColumns<TTable> },
	TAlias extends { [name: string]: number } = { [K in TableName<TTable>]: 1 },
> {
	private config: PgSelectConfig = {} as PgSelectConfig;
	private _alias!: TAlias;
	private _joins!: TJoins;

	constructor(
		private table: TTable,
		private fields: SelectFields<TableName<TTable>> | undefined,
		private session: AnyPgSession,
		private mapper: (rows: any[]) => InferType<TTable>[],
		private dialect: AnyPgDialect,
	) {
		this.config.fields = fields;
		this.config.table = table;
	}

	private join<
		TJoinedTable extends PgTable<TableName<TJoinedTable>, any>,
		TJoinedPartial = TJoinedTable,
	>(
		value: TJoinedTable,
		callback: (
			joins: TJoins & {
				[Alias in BuildAlias<
					TJoinedTable,
					GetAliasIndex<TableName<TJoinedTable>, TAlias>
				>]: TableAlias<TJoinedTable, Alias>;
			},
		) => SQL<
			| (keyof TJoins & string)
			| BuildAlias<TJoinedTable, GetAliasIndex<TableName<TJoinedTable>, TAlias>>
		>,
		joinType: string,
		partial?: TJoinedPartial,
	): Pick<PgSelect<
	TTable,
	TReturn,
	TJoins & {
		[Alias in BuildAlias<
			TJoinedTable,
			GetAliasIndex<TableName<TJoinedTable>, TAlias>
		>]: TableAlias<TJoinedTable, Alias>;
	},
	Increment<TableName<TJoinedTable>, TAlias>
>, 'offset' | 'limit' | 'execute' | 'innerJoin'> & { 'where': PgSelect<
TTable,
TReturn & {
	[Alias in BuildAlias<
		TJoinedTable,
		GetAliasIndex<TableName<TJoinedTable>, TAlias>
	>]: TableAlias<TJoinedTable, Alias>;
},
TJoins & {
	[Alias in BuildAlias<
		TJoinedTable,
		GetAliasIndex<TableName<TJoinedTable>, TAlias>
	>]: TableAlias<TJoinedTable, Alias>;
},
Increment<TableName<TJoinedTable>, TAlias>
>['whereWithCallback']}{
		// const valueAsProxy = new Proxy(value, new JoinedHandler(1));

		// if (partial) {
		// 	for (const key of Object.keys(partial!)) {
		// 		// eslint-disable-next-line no-param-reassign
		// 		(partial as unknown as PartialFor<any>)[key] = new Proxy((partial as unknown as PartialFor<any>)[key], new JoinedColumn(value, 1));
		// 	}
		// }

		// const obj: OnlyColumnsFrom<TJoinedPartial> = partial ?? (valueAsProxy as any).mapped;

		// const joins = this.joinedTables.map(jt => jt.columns) as TJoins;
		// const onExpression = callback(...joins, obj);

		// this.joinedTables.push({
		// 	aliasTableName: (valueAsProxy as any).tableName(),
		// 	table: value,
		// 	columns: obj,
		// 	originalName: (value as any).tableName(),
		// 	onExpression,
		// 	type: joinType,
		// });

		return this as unknown as Pick<PgSelect<
		TTable,
		TReturn,
		TJoins & {
			[Alias in BuildAlias<
				TJoinedTable,
				GetAliasIndex<TableName<TJoinedTable>, TAlias>
			>]: TableAlias<TJoinedTable, Alias>;
		},
		Increment<TableName<TJoinedTable>, TAlias>
	>, 'offset' | 'limit' | 'execute' | 'innerJoin'> & { 'where': PgSelect<
	TTable,
	TReturn & {
		[Alias in BuildAlias<
			TJoinedTable,
			GetAliasIndex<TableName<TJoinedTable>, TAlias>
		>]: TableAlias<TJoinedTable, Alias>;
	},
	TJoins & {
		[Alias in BuildAlias<
			TJoinedTable,
			GetAliasIndex<TableName<TJoinedTable>, TAlias>
		>]: TableAlias<TJoinedTable, Alias>;
	},
	Increment<TableName<TJoinedTable>, TAlias>
>['whereWithCallback']}
	}

	public innerJoin<
		TJoinedTable extends PgTable<TableName<TJoinedTable>, any>,
		TJoinedPartial = TJoinedTable,
	>(
		value: TJoinedTable,
		callback: (
			joins: TJoins & {
				[Alias in BuildAlias<
					TJoinedTable,
					GetAliasIndex<TableName<TJoinedTable>, TAlias>
				>]: TableAlias<TJoinedTable, Alias>;
			},
		) => SQL<
			| (keyof TJoins & string)
			| BuildAlias<TJoinedTable, GetAliasIndex<TableName<TJoinedTable>, TAlias>>
		>,
		partial?: TJoinedPartial,
	): Pick<PgSelect<
		TTable,
		TReturn,
		TJoins & {
			[Alias in BuildAlias<
				TJoinedTable,
				GetAliasIndex<TableName<TJoinedTable>, TAlias>
			>]: TableAlias<TJoinedTable, Alias>;
		},
		Increment<TableName<TJoinedTable>, TAlias>
	>, 'offset' | 'limit' | 'execute' | 'innerJoin'> & { 'where': PgSelect<
	TTable,
	TReturn & {
		[Alias in BuildAlias<
			TJoinedTable,
			GetAliasIndex<TableName<TJoinedTable>, TAlias>
		>]: TableAlias<TJoinedTable, Alias>;
	},
	TJoins & {
		[Alias in BuildAlias<
			TJoinedTable,
			GetAliasIndex<TableName<TJoinedTable>, TAlias>
		>]: TableAlias<TJoinedTable, Alias>;
	},
	Increment<TableName<TJoinedTable>, TAlias>
>['whereWithCallback']} {
		return this.join(value, callback, 'INNER JOIN', partial);
	}

	/** @internal */
	private whereWithCallback(callback: (joins: TJoins) => SQL<keyof TJoins & string>): Omit<this, 'distinct'| 'where'| 'innerJoin' | 'execute'> 
	& {'execute': PgSelect<TTable, TReturn, TJoins, TAlias>['executeWithJoin']}{
		return this.where(callback)
	}

	/** @internal */
	private whereWithSql(where: SQL<TableName<TTable>>): Omit<this, 'distinct'| 'where'|'execute'>& {'execute': PgSelect<TTable, TReturn, TJoins, TAlias>['executeWithoutJoin']}{
		return this.where(where)
	}

	public where(where: (joins: TJoins) => SQL<keyof TJoins & string>): Omit<this, 
	'distinct'| 'where'| 'innerJoin' | 'execute'> & {'execute': PgSelect<TTable, TReturn, TJoins, TAlias>['executeWithJoin']};
	public where(where: SQL<TableName<TTable>>): Omit<this, 'distinct'| 'where'| 'execute'> & {'execute': PgSelect<TTable, TReturn, TJoins, TAlias>['executeWithoutJoin']};
	public where(where: any) {
		if (where instanceof SQL<TableName<TTable>>){
			this.config.where = where;
		} else {
			this.config.where = where(this._joins)
		}
		return this;
	}

	public distinct(column: PgColumn<TableName<TTable>>): Omit<this, 'distinct'> {
		this.config.distinct = column;
		return this;
	}

	public limit(limit: number): Pick<this, 'offset' | 'execute'> {
		this.config.limit = limit;
		return this;
	}

	public offset(offset: number): Pick<this, 'execute'> {
		this.config.offset = offset;
		return this;
	}

	/** @internal */
	private executeWithJoin(): Promise<JoinResponse<TJoins>>{
		return this.execute() as unknown as Promise<JoinResponse<TJoins>>
	}

	/** @internal */
	private executeWithoutJoin(): Promise<InferType<TTable>> {
		return this.execute() as unknown as Promise<InferType<TTable>>
	}

	public async execute(): Promise<InferType<TTable, "select">>;
	public async execute(): Promise<JoinResponse<TJoins>>;
	public async execute(): Promise<InferType<TTable, "select"> | JoinResponse<TJoins>> {
		const query = this.dialect.buildSelectQuery(this.config);
		const [sql, params] = this.dialect.prepareSQL(query);
		return this.session.query(sql, params).then((result) => {
			return this.mapper(result.rows) as unknown as JoinResponse<TJoins>;
		});
	}
}

export class PgJson<TTable extends string, TData extends Primitive = Primitive> extends PgColumn<
	TTable,
	TData
> {
	getSQLType(): string {
		return 'json';
	}
}

export class PgJsonb<TTable extends string, TData extends Primitive = Primitive> extends PgColumn<
	TTable,
	TData
> {
	getSQLType(): string {
		return 'jsonb';
	}
}

export class PgBoolean<TTable extends string> extends PgColumn<TTable, boolean> {
	getSQLType(): string {
		return 'boolean';
	}
}

export class PgDate<TTable extends string> extends PgColumn<TTable, Date> {
	getSQLType(): string {
		return 'date';
	}
}

export class PgTimestamp<TTable extends string> extends PgColumn<TTable, Date> {
	getSQLType(): string {
		return 'timestamp';
	}
}

export class PgTimestampTz<TTable extends string> extends PgColumn<TTable, Date> {
	getSQLType(): string {
		return 'timestamp with time zone';
	}
}

export class PgTime<TTable extends string> extends PgColumn<TTable, Date> {
	getSQLType(): string {
		return 'time';
	}
}
