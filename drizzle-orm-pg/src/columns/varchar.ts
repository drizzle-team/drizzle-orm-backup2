import { ColumnData, ColumnDriverParam, ColumnHasDefault, ColumnNotNull, TableName } from 'drizzle-orm/branded-types';

import { AnyPgTable } from '~/table';
import { PgColumn, PgColumnBuilder } from './common';

export class PgVarcharBuilder<
	TData extends ColumnData<string> = ColumnData<string>,
	TNotNull extends ColumnNotNull = ColumnNotNull<false>,
	THasDefault extends ColumnHasDefault = ColumnHasDefault<false>,
> extends PgColumnBuilder<TData, ColumnDriverParam<string>, TNotNull, THasDefault> {
	/** @internal */ length: number | undefined;

	constructor(name: string, length?: number) {
		super(name);
		this.length = length;
	}

	/** @internal */
	override build<TTableName extends TableName>(
		table: AnyPgTable<TTableName>,
	): PgVarchar<TTableName, TData, TNotNull, THasDefault> {
		return new PgVarchar(table, this);
	}
}

export class PgVarchar<
	TTableName extends TableName,
	TData extends ColumnData<string>,
	TNotNull extends ColumnNotNull,
	THasDefault extends ColumnHasDefault,
> extends PgColumn<TTableName, TData, ColumnDriverParam<string>, TNotNull, THasDefault> {
	protected brand!: 'PgVarchar';

	length: number | undefined;

	constructor(table: AnyPgTable<TTableName>, builder: PgVarcharBuilder<TData, TNotNull, THasDefault>) {
		super(table, builder);
		this.length = builder.length;
	}

	getSQLType(): string {
		return typeof this.length !== 'undefined' ? `varchar(${this.length})` : `varchar`;
	}
}

export function varchar<T extends string = string>(
	name: string,
	config: { length?: number } = {},
): PgVarcharBuilder<ColumnData<T>> {
	return new PgVarcharBuilder(name, config.length);
}
