import { AnyTable } from 'drizzle-orm';
import { ColumnData, ColumnDriverParam, ColumnHasDefault, ColumnNotNull, TableName } from 'drizzle-orm/branded-types';

import { PgColumn } from './common';
import { PgDateColumnBaseBuilder } from './date-common';

export class PgTimestampBuilder<
	TNotNull extends ColumnNotNull = ColumnNotNull<false>,
	THasDefault extends ColumnHasDefault = ColumnHasDefault<false>,
> extends PgDateColumnBaseBuilder<ColumnData<Date>, ColumnDriverParam<string>, TNotNull, THasDefault> {
	constructor(
		name: string,
		public readonly withTimezone: boolean,
		public readonly precision: number | undefined,
	) {
		super(name);
	}

	/** @internal */
	override build<TTableName extends TableName>(
		table: AnyTable<TTableName>,
	): PgTimestamp<TTableName, TNotNull, THasDefault> {
		return new PgTimestamp(table, this);
	}
}

export class PgTimestamp<
	TTableName extends TableName,
	TNotNull extends ColumnNotNull,
	THasDefault extends ColumnHasDefault,
> extends PgColumn<TTableName, ColumnData<Date>, ColumnDriverParam<string>, TNotNull, THasDefault> {
	protected brand!: 'PgTimestamp';

	public readonly withTimezone: boolean;
	public readonly precision: number | undefined;

	constructor(
		table: AnyTable<TTableName>,
		builder: PgTimestampBuilder<TNotNull, THasDefault>,
	) {
		super(table, builder);
		this.withTimezone = builder.withTimezone;
		this.precision = builder.precision;
	}

	getSQLType(): string {
		const precision = typeof this.precision !== 'undefined' ? ` (${this.precision})` : '';
		return `timestamp${precision}${this.withTimezone ? ' with time zone' : ''}`;
	}

	override mapFromDriverValue(value: ColumnDriverParam<string>): ColumnData<Date> {
		return new Date(value) as ColumnData<Date>;
	}
}

export class PgTimestampStringBuilder<
	TNotNull extends ColumnNotNull = ColumnNotNull<false>,
	THasDefault extends ColumnHasDefault = ColumnHasDefault<false>,
> extends PgDateColumnBaseBuilder<ColumnData<string>, ColumnDriverParam<string>, TNotNull, THasDefault> {
	constructor(
		name: string,
		public readonly withTimezone: boolean,
		public readonly precision: number | undefined,
	) {
		super(name);
	}

	/** @internal */
	override build<TTableName extends TableName>(
		table: AnyTable<TTableName>,
	): PgTimestampString<TTableName, TNotNull, THasDefault> {
		return new PgTimestampString(table, this);
	}
}

export class PgTimestampString<
	TTableName extends TableName,
	TNotNull extends ColumnNotNull,
	THasDefault extends ColumnHasDefault,
> extends PgColumn<TTableName, ColumnData<string>, ColumnDriverParam<string>, TNotNull, THasDefault> {
	protected brand!: 'PgTimestampString';

	public readonly withTimezone: boolean;
	public readonly precision: number | undefined;

	constructor(
		table: AnyTable<TTableName>,
		builder: PgTimestampStringBuilder<TNotNull, THasDefault>,
	) {
		super(table, builder);
		this.withTimezone = builder.withTimezone;
		this.precision = builder.precision;
	}

	getSQLType(): string {
		const precision = typeof this.precision !== 'undefined' ? ` (${this.precision})` : '';
		return `timestamp${precision}${this.withTimezone ? ' with time zone' : ''}`;
	}
}

export type TimestampConfig<TMode extends 'string' | 'date' = 'string' | 'date'> =
	& {
		precision?: number;
	}
	& (
		| {
			mode: TMode;
			withTimezone?: boolean;
		}
		| {
			mode?: TMode;
			withTimezone: boolean;
		}
	);

export function timestamp<TWithTZ extends boolean>(
	name: string,
	config?: TimestampConfig<'date'>,
): PgTimestampBuilder;
export function timestamp<TWithTZ extends boolean>(
	name: string,
	config: TimestampConfig<'string'>,
): PgTimestampStringBuilder;
export function timestamp(name: string, config?: TimestampConfig) {
	if (config?.mode === 'string') {
		return new PgTimestampStringBuilder(name, config.withTimezone ?? false, config.precision);
	}
	return new PgTimestampBuilder(name, config?.withTimezone ?? false, config?.precision);
}
