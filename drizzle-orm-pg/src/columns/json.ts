import {
	ColumnData,
	ColumnDriverParam,
	ColumnHasDefault,
	ColumnNotNull,
	TableName,
	Unwrap,
} from 'drizzle-orm/branded-types';

import { AnyPgTable } from '~/table';
import { PgColumn, PgColumnBuilder } from './common';

export class PgJsonBuilder<
	TData,
	TNotNull extends ColumnNotNull = ColumnNotNull<false>,
	THasDefault extends ColumnHasDefault = ColumnHasDefault<false>,
> extends PgColumnBuilder<ColumnData<TData>, ColumnDriverParam<string>, TNotNull, THasDefault> {
	constructor(name: string) {
		super(name);
	}

	/** @internal */
	override build<TTableName extends TableName>(
		table: AnyPgTable<TTableName>,
	): PgJson<TTableName, TNotNull, THasDefault, TData> {
		return new PgJson(table, this);
	}
}

export class PgJson<
	TTableName extends TableName,
	TNotNull extends ColumnNotNull,
	THasDefault extends ColumnHasDefault,
	TData,
> extends PgColumn<TTableName, ColumnData<TData>, ColumnDriverParam<string>, TNotNull, THasDefault> {
	protected brand!: 'PgJson';

	constructor(table: AnyPgTable<TTableName>, builder: PgJsonBuilder<TData, TNotNull, THasDefault>) {
		super(table, builder);
	}

	getSQLType(): string {
		return 'json';
	}

	override mapToDriverValue(value: TData): string {
		return JSON.stringify(value);
	}
}

export function json<TData>(name: string) {
	return new PgJsonBuilder<TData>(name);
}
