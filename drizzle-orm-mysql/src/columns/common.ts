import { Column } from 'drizzle-orm';
import { ColumnData, ColumnHasDefault, ColumnNotNull, TableName } from 'drizzle-orm/branded-types';
import { ColumnBuilder } from 'drizzle-orm/column-builder';
import { Simplify } from 'type-fest';
import { MySqlColumnDriverParam } from '~/branded-types';
import { AnyMySqlTable } from '~/table';

export abstract class MySqlColumnBuilder<
	TData extends ColumnData,
	TDriverParam extends MySqlColumnDriverParam,
	TNotNull extends ColumnNotNull,
	THasDefault extends ColumnHasDefault,
> extends ColumnBuilder<TData, TDriverParam, TNotNull, THasDefault> {
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
> extends Column<TTableName, TDataType, TDriverData, TNotNull, THasDefault> {}

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

export type BuildPgColumn<TTableName extends TableName, TBuilder extends AnyMySqlColumnBuilder> = TBuilder extends
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
		[Key in keyof TConfigMap]: BuildPgColumn<TTableName, TConfigMap[Key]>;
	}
>;
