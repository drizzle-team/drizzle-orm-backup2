import { ColumnData, ColumnDriverParam, ColumnHasDefault, ColumnNotNull, TableName } from 'drizzle-orm/branded-types';

import { AnyPgTable } from '~/table';
import { PgColumn, PgColumnBuilder } from './common';

export class PgDoublePrecisionBuilder<
	TNotNull extends ColumnNotNull = ColumnNotNull<false>,
	THasDefault extends ColumnHasDefault = ColumnHasDefault<false>,
> extends PgColumnBuilder<
	ColumnData<number>,
	ColumnDriverParam<string | number>,
	TNotNull,
	THasDefault
> {
	/** @internal */ length: number | undefined;

	constructor(name: string, length?: number) {
		super(name);
		this.length = length;
	}

	/** @internal */
	override build<TTableName extends TableName>(
		table: AnyPgTable<TTableName>,
	): PgDoublePrecision<TTableName, TNotNull, THasDefault> {
		return new PgDoublePrecision(table, this);
	}
}

export class PgDoublePrecision<
	TTableName extends TableName,
	TNotNull extends ColumnNotNull,
	THasDefault extends ColumnHasDefault,
> extends PgColumn<
	TTableName,
	ColumnData<number>,
	ColumnDriverParam<string | number>,
	TNotNull,
	THasDefault
> {
	protected brand!: 'PgDoublePrecision';

	constructor(
		table: AnyPgTable<TTableName>,
		builder: PgDoublePrecisionBuilder<TNotNull, THasDefault>,
	) {
		super(table, builder);
	}

	getSQLType(): string {
		return 'double precision';
	}

	override mapFromDriverValue = (value: ColumnDriverParam<string | number>): ColumnData<number> => {
		if (typeof value === 'string') {
			return parseFloat(value) as ColumnData<number>;
		}
		return value as ColumnData<any>;
	};
}

export function doublePrecision(name: string) {
	return new PgDoublePrecisionBuilder(name);
}
