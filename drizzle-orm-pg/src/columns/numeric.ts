import { ColumnData, ColumnDriverParam, ColumnHasDefault, ColumnNotNull, TableName } from 'drizzle-orm/branded-types';

import { AnyPgTable } from '~/table';
import { PgColumnBuilder, PgColumnWithMapper } from './common';

export class PgNumericBuilder<
	TNotNull extends ColumnNotNull = ColumnNotNull<false>,
	THasDefault extends ColumnHasDefault = ColumnHasDefault<false>,
> extends PgColumnBuilder<ColumnData<string>, ColumnDriverParam<string>, TNotNull, THasDefault> {
	/** @internal */ precision: number | undefined;
	/** @internal */ scale: number | undefined;

	constructor(name: string, precision?: number, scale?: number) {
		super(name);
		this.precision = precision;
		this.scale = scale;
	}

	/** @internal */
	override build<TTableName extends TableName>(
		table: AnyPgTable<TTableName>,
	): PgNumeric<TTableName, TNotNull, THasDefault> {
		return new PgNumeric(table, this);
	}
}

export class PgNumeric<
	TTableName extends TableName,
	TNotNull extends ColumnNotNull,
	THasDefault extends ColumnHasDefault,
> extends PgColumnWithMapper<
	TTableName,
	ColumnData<string>,
	ColumnDriverParam<string>,
	TNotNull,
	THasDefault
> {
	protected brand!: 'PgNumeric';

	precision: number | undefined;
	scale: number | undefined;

	constructor(table: AnyPgTable<TTableName>, builder: PgNumericBuilder<TNotNull, THasDefault>) {
		super(table, builder);
		this.precision = builder.precision;
		this.scale = builder.scale;
	}

	getSQLType(): string {
		if (typeof this.precision !== 'undefined' && typeof this.scale !== 'undefined') {
			return `numeric(${this.precision}, ${this.scale})`;
		} else if (typeof this.precision === 'undefined') {
			return 'numeric';
		} else {
			return `numeric(${this.precision})`;
		}
	}
}

export function numeric(name: string, precision?: number, scale?: number) {
	return new PgNumericBuilder(name, precision, scale);
}
