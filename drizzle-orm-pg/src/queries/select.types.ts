import { AnyColumn } from 'drizzle-orm';
import { TableName, Unwrap } from 'drizzle-orm/branded-types';
import { GetTableName } from 'drizzle-orm/utils';
import { Simplify } from 'type-fest';

import { AnyPgColumn } from '~/columns';
import { ChangeColumnTable } from '~/columns/common';
import { PgSelectFields, SelectResultFields } from '~/operations';
import { AnyPgSQL } from '~/sql';
import { AnyPgTable, GetTableColumns } from '~/table';

import { PgSelect } from './select';

export type JoinType = 'inner' | 'left' | 'right' | 'full';

export interface JoinsValue {
	on: AnyPgSQL;
	table: AnyPgTable;
	joinType: JoinType;
	aliasTable: AnyPgTable;
}

export type JoinNullability = 'nullable' | 'null' | 'not-null';

export type ApplyNotNullMapToJoins<
	TResult extends Record<string, Record<string, unknown>>,
	TJoinsNotNullable extends Record<string, JoinNullability>,
> = TJoinsNotNullable extends TJoinsNotNullable ? {
		[TTableName in keyof TResult & keyof TJoinsNotNullable & string]: TJoinsNotNullable[TTableName] extends 'nullable'
			? TResult[TTableName] | null
			: TJoinsNotNullable[TTableName] extends 'null' ? null
			: TJoinsNotNullable[TTableName] extends 'not-null' ? TResult[TTableName]
			: never;
	}
	: never;

export type SelectResult<
	TTable extends AnyPgTable,
	TReturn,
	TInitialSelectResultFields extends Record<string, unknown>,
	TTableNamesMap extends Record<string, string>,
	TJoinsNotNullable extends Record<string, JoinNullability>,
> = TReturn extends undefined ? TInitialSelectResultFields[]
	: RemoveDuplicates<
		Simplify<
			ApplyNotNullMapToJoins<
				& TReturn
				& { [Key in TTableNamesMap[Unwrap<GetTableName<TTable>>]]: TInitialSelectResultFields },
				TJoinsNotNullable
			>
		>
	>[];

export type AnyPgSelect = PgSelect<
	AnyPgTable,
	Record<string, string>,
	SelectResultFields<PgSelectFields<TableName>>,
	unknown,
	{ [tableName: string]: any },
	string,
	any
>;

export type QueryFinisherMethods = 'getQuery' | 'getSQL' | 'execute';

export type PickWhere<TJoinReturn extends AnyPgSelect> = Omit<
	TJoinReturn,
	'where' | `${JoinType}Join`
>;
export type PickOrderBy<TJoinReturn extends AnyPgSelect> = Pick<
	TJoinReturn,
	'limit' | 'offset' | QueryFinisherMethods
>;
export type PickLimit<TJoinReturn extends AnyPgSelect> = Pick<TJoinReturn, 'offset' | QueryFinisherMethods>;
export type PickOffset<TJoinReturn extends AnyPgSelect> = Pick<TJoinReturn, QueryFinisherMethods>;

export type BuildAliasTable<TTable extends AnyPgTable, TAlias extends TableName> = MapColumnsToTableAlias<
	GetTableColumns<TTable>,
	TAlias
>;

export type MapColumnsToTableAlias<TColumns extends Record<string, AnyPgColumn>, TAlias extends TableName> = {
	[Key in keyof TColumns]: ChangeColumnTable<TColumns[Key], TAlias>;
};

export type AppendToResult<
	TReturn,
	TJoinedName extends string,
	TSelectedFields extends PgSelectFields<TableName>,
> = TReturn extends undefined ? { [Key in TJoinedName]: SelectResultFields<TSelectedFields> }
	: Simplify<TReturn & { [Key in TJoinedName]: SelectResultFields<TSelectedFields> }>;

export type AppendToAliases<
	TJoins extends { [k: string]: AnyPgTable | Record<string, AnyColumn> },
	TJoinedTable extends AnyPgTable,
	TJoinedName extends string,
	TDBName extends string = TJoinedName,
> = Simplify<
	& TJoins
	& { [Alias in TJoinedName]: BuildAliasTable<TJoinedTable, TableName<TDBName>> },
	{ deep: true }
>;

export type JoinOn<
	TTableNamesMap extends Record<string, string>,
	TJoinedDBTableNames extends string,
	TAliases extends { [tableName: string]: any },
	TJoinedTable extends AnyPgTable<TableName<keyof TTableNamesMap & string>>,
	TJoinedName extends string,
	TDBName extends string = TJoinedName,
> =
	| ((
		aliases: AppendToAliases<TAliases, TJoinedTable, TJoinedName, TDBName>,
	) => AnyPgSQL<TableName<TJoinedDBTableNames | TDBName>>)
	| AnyPgSQL<TableName<TJoinedDBTableNames | TDBName>>;

export type JoinSelect<
	TJoinedTable extends AnyPgTable,
	TDBName extends string,
	TSelectedFields extends PgSelectFields<TableName>,
> =
	| ((table: BuildAliasTable<TJoinedTable, TableName<TDBName>>) => TSelectedFields)
	| TSelectedFields;

export type GetSelectedFields<T extends JoinSelect<any, any, any>> = T extends
	JoinSelect<any, any, infer TSelectedFields> ? TSelectedFields : never;

type SetJoinsNotNull<TJoinsNotNull extends Record<string, JoinNullability>, TValue extends JoinNullability> = {
	[Key in keyof TJoinsNotNull]: TValue;
};

// https://stackoverflow.com/a/70061272/9929789
type UnionToParm<U> = U extends any ? (k: U) => void : never;
type UnionToSect<U> = UnionToParm<U> extends ((k: infer I) => void) ? I : never;
type ExtractParm<F> = F extends { (a: infer A): void } ? A : never;
type SpliceOne<Union> = Exclude<Union, ExtractOne<Union>>;
type ExtractOne<Union> = ExtractParm<UnionToSect<UnionToParm<Union>>>;
type ToTupleRec<Union, Result extends any[] = []> = SpliceOne<Union> extends never ? [ExtractOne<Union>, ...Result]
	: ToTupleRec<SpliceOne<Union>, [ExtractOne<Union>, ...Result]>;
export type RemoveDuplicates<T> = ToTupleRec<T> extends any[] ? ToTupleRec<T>[number] : never;

export type AppendToJoinsNotNull<
	TJoinsNotNull extends Record<string, JoinNullability>,
	TJoinedName extends string,
	TJoinType extends JoinType,
> = Simplify<
	'left' extends TJoinType ? TJoinsNotNull & { [name in TJoinedName]: 'nullable' }
		: 'right' extends TJoinType ? SetJoinsNotNull<TJoinsNotNull, 'nullable'> & { [name in TJoinedName]: 'not-null' }
		: 'inner' extends TJoinType ? SetJoinsNotNull<TJoinsNotNull, 'not-null'> & { [name in TJoinedName]: 'not-null' }
		: 'full' extends TJoinType ? 
				| (TJoinsNotNull & { [name in TJoinedName]: 'null' })
				| (SetJoinsNotNull<TJoinsNotNull, 'null'> & { [name in TJoinedName]: 'not-null' })
				| (TJoinsNotNull & { [name in TJoinedName]: 'not-null' })
		: never
>;
