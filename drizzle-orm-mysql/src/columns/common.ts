import { Column } from 'drizzle-orm';
import { ColumnData, ColumnHasDefault, ColumnNotNull, TableName, Unwrap } from 'drizzle-orm/branded-types';
import { ColumnBuilder } from 'drizzle-orm/column-builder';
import { Simplify } from 'type-fest';
import { MySqlColumnDriverParam } from '~/branded-types';
import { AnyForeignKey, ForeignKeyBuilder, UpdateDeleteAction } from '~/foreign-keys';
import { AnyMySQL } from '~/sql';
import { AnyMySqlTable } from '~/table';

export interface ReferenceConfig<TData extends ColumnData> {
	ref: () => AnyMySqlColumn<any, TData>;
	actions: {
		onUpdate?: UpdateDeleteAction;
		onDelete?: UpdateDeleteAction;
	};
}

export abstract class MySqlColumnBuilder<
	TData extends ColumnData,
	TDriverParam extends MySqlColumnDriverParam,
	TNotNull extends ColumnNotNull,
	THasDefault extends ColumnHasDefault,
> extends ColumnBuilder<TData, TDriverParam, TNotNull, THasDefault> {
	private foreignKeyConfigs: ReferenceConfig<TData>[] = [];

	constructor(name: string) {
		super(name);
	}

	override notNull(): MySqlColumnBuilder<TData, TDriverParam, ColumnNotNull<true>, THasDefault> {
		return super.notNull() as any;
	}

	override default(
		value: Unwrap<TData> | AnyMySQL,
	): MySqlColumnBuilder<TData, TDriverParam, TNotNull, ColumnHasDefault<true>> {
		return super.default(value) as any;
	}

	override primaryKey(): MySqlColumnBuilder<TData, TDriverParam, ColumnNotNull<true>, THasDefault> {
		return super.primaryKey() as any;
	}

	references(
		ref: ReferenceConfig<TData>['ref'],
		actions: ReferenceConfig<TData>['actions'] = {},
	): this {
		this.foreignKeyConfigs.push({ ref, actions });
		return this;
	}

	/** @internal */
	buildForeignKeys(column: AnyMySqlColumn, table: AnyMySqlTable): AnyForeignKey[] {
		return this.foreignKeyConfigs.map(({ ref, actions }) => {
			const builder = new ForeignKeyBuilder(() => {
				const foreignColumn = ref();
				return { columns: [column], foreignColumns: [foreignColumn] };
			});
			if (actions.onUpdate) {
				builder.onUpdate(actions.onUpdate);
			}
			if (actions.onDelete) {
				builder.onDelete(actions.onDelete);
			}
			return builder.build(table);
		});
	}

	/** @internal */
	abstract override build<TTableName extends TableName>(
		table: AnyMySqlTable<TTableName>,
	): MySqlColumn<TTableName, TData, TDriverParam, TNotNull, THasDefault>;
}

export type AnyMySqlColumnBuilder = MySqlColumnBuilder<any, any, any, any>;

export abstract class MySqlColumn<
	TTableName extends TableName<string>,
	TDataType extends ColumnData,
	TDriverData extends MySqlColumnDriverParam,
	TNotNull extends ColumnNotNull,
	THasDefault extends ColumnHasDefault,
> extends Column<TTableName, TDataType, TDriverData, TNotNull, THasDefault> {
	override readonly table!: AnyMySqlTable<TTableName>;

	constructor(
		table: AnyMySqlTable<TTableName>,
		builder: MySqlColumnBuilder<TDataType, TDriverData, TNotNull, THasDefault>,
	) {
		super(table, builder);
	}
}

export abstract class MySqlColumnWithMapper<
	TTableName extends TableName,
	TData extends ColumnData,
	TDriverParam extends MySqlColumnDriverParam,
	TNotNull extends ColumnNotNull,
	THasDefault extends ColumnHasDefault,
> extends MySqlColumn<TTableName, TData, TDriverParam, TNotNull, THasDefault> {
	override mapFromDriverValue = (value: TDriverParam): TData => {
		return value as unknown as TData;
	};

	override mapToDriverValue = (value: TData): TDriverParam => {
		return value as unknown as TDriverParam;
	};
}

export type AnyMySqlColumn<
	TTableName extends TableName = any,
	TData extends ColumnData = any,
	TDriverParam extends MySqlColumnDriverParam = MySqlColumnDriverParam,
	TNotNull extends ColumnNotNull = any,
	THasDefault extends ColumnHasDefault = any,
> = MySqlColumn<TTableName, TData, TDriverParam, TNotNull, THasDefault>;

export type AnyMySqlColumnWithMapper<
	TTableName extends TableName = TableName,
	TData extends ColumnData = any,
	TDriverParam extends MySqlColumnDriverParam = MySqlColumnDriverParam,
	TNotNull extends ColumnNotNull = ColumnNotNull,
	THasDefault extends ColumnHasDefault = ColumnHasDefault,
> = MySqlColumnWithMapper<TTableName, TData, TDriverParam, TNotNull, THasDefault>;

export type BuildMySqlColumn<TTableName extends TableName, TBuilder extends AnyMySqlColumnBuilder> = TBuilder extends
	MySqlColumnBuilder<
		infer TData,
		infer TDriverParam,
		infer TNotNull,
		infer THasDefault
	> ? MySqlColumnWithMapper<TTableName, TData, TDriverParam, TNotNull, THasDefault>
	: never;

export type BuildMySqlColumns<
	TTableName extends TableName,
	TConfigMap extends Record<string, AnyMySqlColumnBuilder>,
> = Simplify<
	{
		[Key in keyof TConfigMap]: BuildMySqlColumn<TTableName, TConfigMap[Key]>;
	}
>;
