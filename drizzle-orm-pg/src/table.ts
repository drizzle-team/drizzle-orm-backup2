import { GetColumnData } from 'drizzle-orm';
import { OptionalKeyOnly, RequiredKeyOnly } from 'drizzle-orm/operations';
import { Table } from 'drizzle-orm/table';
import { RequiredKeys } from 'drizzle-orm/utils';
import { Simplify } from 'type-fest';

import { AnyCheckBuilder, BuildCheck, Check, CheckBuilder } from './checks';
import { AnyPgColumn, AnyPgColumnBuilder, BuildPgColumns } from './columns/common';
import { ForeignKey, ForeignKeyBuilder } from './foreign-keys';
import { AnyIndexBuilder, BuildIndex, Index, IndexBuilder } from './indexes';

export type PgTableExtraConfig<TTableName extends string> = Record<
	string,
	AnyIndexBuilder<TTableName> | CheckBuilder<TTableName> | ForeignKeyBuilder<TTableName, string>
>;

export type AnyConflictConstraintBuilder<TTableName extends string> =
	| AnyIndexBuilder<TTableName>
	| AnyCheckBuilder<TTableName>;

export type BuildConflictConstraint<
	TConstraint,
	TTableColumns extends Record<string, AnyPgColumn>,
> = TConstraint extends IndexBuilder<any, true> ? BuildIndex<TConstraint, TTableColumns>
	: TConstraint extends AnyCheckBuilder ? BuildCheck<TConstraint>
	: never;

export type ConflictConstraintKeyOnly<Key, TType> = TType extends AnyCheckBuilder ? Key
	: TType extends IndexBuilder<any, infer TUnique> ? TUnique extends true ? Key
		: never
	: never;

export type BuildConflictConstraints<
	TConfig extends PgTableExtraConfig<any>,
	TTableColumns extends Record<string, AnyPgColumn>,
> = Simplify<
	{
		[Key in keyof TConfig as ConflictConstraintKeyOnly<Key, TConfig[Key]>]: BuildConflictConstraint<
			TConfig[Key],
			TTableColumns
		>;
	}
>;

export type ConflictConstraint<TTableName extends string> =
	| Index<TTableName, any, true>
	| Check<TTableName>;

export type ConflictConstraints = Record<string | symbol, ConflictConstraint<string>>;

export interface TableConfig<TName extends string = string> {
	name: TName;
	columns: Record<string | symbol, AnyPgColumn<{ tableName: TName }>>;
	conflictConstraints: ConflictConstraints;
}

export type UpdateTableConfig<T extends TableConfig, TUpdate extends Partial<TableConfig>> = {} extends TUpdate ? T
	: RequiredKeys<Omit<T, keyof TUpdate> & Pick<TUpdate, keyof TableConfig>>;

/** @internal */
export const Indexes = Symbol('Indexes');

/** @internal */
export const ForeignKeys = Symbol('ForeignKeys');

/** @internal */
export const Checks = Symbol('Checks');

/** @internal */
export const ConflictConstraints = Symbol('ConflictConstraints');

export class PgTable<T extends TableConfig> extends Table<T['name']> {
	declare protected $columns: T['columns'];
	declare protected $conflictConstraints: T['conflictConstraints'];

	/** @internal */
	static override readonly Symbol = Object.assign(Table.Symbol, {
		Indexes: Indexes as typeof Indexes,
		ForeignKeys: ForeignKeys as typeof ForeignKeys,
		Checks: Checks as typeof Checks,
		ConflictConstraints: ConflictConstraints as typeof ConflictConstraints,
	});

	/** @internal */
	override [Table.Symbol.Columns]!: T['columns'];

	/** @internal */
	[Indexes]: Record<string | symbol, Index<T['name'], any, boolean>> = {};

	/** @internal */
	[ForeignKeys]: Record<string | symbol, ForeignKey<T['name'], string>> = {};

	/** @internal */
	[Checks]: Record<string | symbol, Check<T['name']>> = {};

	/** @internal */
	[ConflictConstraints]: T['conflictConstraints'] = {};
}

export type AnyPgTable<TPartial extends Partial<TableConfig> = {}> = PgTable<
	UpdateTableConfig<TableConfig, TPartial>
>;

export type PgTableWithColumns<T extends TableConfig> =
	& PgTable<T>
	& {
		[Key in keyof T['columns']]: T['columns'][Key];
	};

/**
 * See `GetColumnConfig`.
 */
export type GetTableConfig<T extends AnyPgTable, TParam extends keyof TableConfig | undefined = undefined> = T extends
	PgTableWithColumns<infer TConfig> ? TParam extends keyof TConfig ? TConfig[TParam] : TConfig
	: never;

export type InferModel<
	TTable extends AnyPgTable,
	TInferMode extends 'select' | 'insert' = 'select',
> = TInferMode extends 'insert' ? Simplify<
		& {
			[
				Key in keyof GetTableConfig<TTable, 'columns'> & string as RequiredKeyOnly<
					Key,
					GetTableConfig<TTable, 'columns'>[Key]
				>
			]: GetColumnData<GetTableConfig<TTable, 'columns'>[Key], 'query'>;
		}
		& {
			[
				Key in keyof GetTableConfig<TTable, 'columns'> & string as OptionalKeyOnly<
					Key,
					GetTableConfig<TTable, 'columns'>[Key]
				>
			]?: GetColumnData<GetTableConfig<TTable, 'columns'>[Key], 'query'>;
		}
	>
	: {
		[Key in keyof GetTableConfig<TTable, 'columns'>]: GetColumnData<
			GetTableConfig<TTable, 'columns'>[Key],
			'query'
		>;
	};

export function pgTable<
	TTableName extends string,
	TColumnsMap extends Record<string, AnyPgColumnBuilder>,
	TExtraConfig extends PgTableExtraConfig<TTableName> = {},
>(
	name: TTableName,
	columns: TColumnsMap,
	extraConfig?: (self: BuildPgColumns<TTableName, TColumnsMap>) => TExtraConfig,
): PgTableWithColumns<{
	name: TTableName;
	columns: BuildPgColumns<TTableName, TColumnsMap>;
	conflictConstraints: BuildConflictConstraints<TExtraConfig, BuildPgColumns<TTableName, TColumnsMap>>;
}> {
	const rawTable = new PgTable<{
		name: TTableName;
		columns: BuildPgColumns<TTableName, TColumnsMap>;
		conflictConstraints: BuildConflictConstraints<TExtraConfig, BuildPgColumns<TTableName, TColumnsMap>>;
	}>(name);

	const builtColumns = Object.fromEntries(
		Object.entries(columns).map(([name, colBuilder]) => {
			const column = colBuilder.build(rawTable);
			colBuilder.buildForeignKeys(column, rawTable).forEach((fk, fkIndex) => {
				rawTable[ForeignKeys][Symbol(`${name}_${fkIndex}`)] = fk;
			});
			return [name, column];
		}),
	) as BuildPgColumns<TTableName, TColumnsMap>;

	rawTable[PgTable.Symbol.Columns] = builtColumns;

	const table = Object.assign(rawTable, builtColumns);

	table[PgTable.Symbol.Columns] = builtColumns;

	if (extraConfig) {
		const builtConfig = extraConfig(table[PgTable.Symbol.Columns]);
		table[ConflictConstraints] = builtConfig as unknown as BuildConflictConstraints<
			TExtraConfig,
			BuildPgColumns<TTableName, TColumnsMap>
		>;

		Object.entries(builtConfig).forEach(([name, builder]) => {
			if (builder instanceof IndexBuilder) {
				table[Indexes][name] = builder.build(table);
			} else if (builder instanceof CheckBuilder) {
				table[Checks][name] = builder.build(table);
			} else if (builder instanceof ForeignKeyBuilder) {
				table[ForeignKeys][name] = builder.build(table);
			}
		});
	}

	return table;
}
