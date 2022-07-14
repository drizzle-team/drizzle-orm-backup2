import { AnyPgTable, PartialSelectResult } from 'drizzle-orm-pg';

import { AnyColumn, Column, InferColumnType } from './column';
import { SQL } from './sql';
import { AnyTable, Table } from './table';
import { TableName } from './utils';

export type RequiredKeyOnly<TKey, T extends AnyColumn> = T extends Column<
	any,
	any,
	any,
	infer TDefault
>
	? TDefault extends false
		? TKey
		: never
	: never;

export type OptionalKeyOnly<TKey, T extends AnyColumn> = T extends Column<
	any,
	any,
	any,
	infer TDefault
>
	? [TDefault] extends [true]
		? TKey
		: never
	: never;

export type InferColumns<TTable extends AnyTable> = TTable extends Table<any, infer TColumns>
	? TColumns
	: never;

export type InferType<
	TTable extends AnyTable,
	TInferMode extends 'select' | 'insert' = 'select',
> = TTable extends Table<any, infer TColumns>
	? TInferMode extends 'insert'
		? {
				[Key in keyof TColumns as RequiredKeyOnly<Key, TColumns[Key]>]: InferColumnType<
					TColumns[Key],
					'query'
				>;
		  } & {
				[Key in keyof TColumns as OptionalKeyOnly<Key, TColumns[Key]>]?: InferColumnType<
					TColumns[Key],
					'query'
				>;
		  }
		: {
				[Key in keyof TColumns]: InferColumnType<TColumns[Key], 'query'>;
		  }
	: never;

// export type InferSelectResult<TColumns extends Record<string, unknown>> =
// 		  {[Key in keyof TColumns]: TColumns[Key] extends Column<infer>}

export type SelectFields<TTableName extends string> = {
	[Key: string]: SQL<TTableName> | Column<TTableName>;
};

export interface SelectConfig<TTable extends AnyTable> {
	fields: SelectFields<TableName<TTable>> | undefined;
	where: SQL<TableName<TTable>>;
	table: TTable;
	limit: number | undefined;
	offset: number | undefined;
	distinct: AnyColumn | undefined;
}

export interface Return {}
