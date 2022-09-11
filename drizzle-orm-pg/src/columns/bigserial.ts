import { ColumnData, ColumnDriverParam, ColumnHasDefault, ColumnNotNull, TableName } from 'drizzle-orm/branded-types';
import { DriverValueDecoder } from 'drizzle-orm/sql';
import { AnyPgTable } from '../table';
import { PgColumn, PgColumnBuilder } from './common';

export class PgBigSerial53Builder<
	TNotNull extends ColumnNotNull = ColumnNotNull<false>,
	THasDefault extends ColumnHasDefault = ColumnHasDefault<false>,
> extends PgColumnBuilder<ColumnData<number>, ColumnDriverParam<number>, TNotNull, THasDefault> {
	/** @internal */
	override build<TTableName extends TableName>(
		table: AnyPgTable<TTableName>,
	): PgBigSerial53<TTableName, TNotNull, THasDefault> {
		return new PgBigSerial53<TTableName, TNotNull, THasDefault>(table, this);
	}
}

export class PgBigSerial53<
	TTableName extends TableName,
	TNotNull extends ColumnNotNull,
	THasDefault extends ColumnHasDefault,
> extends PgColumn<TTableName, ColumnData<number>, ColumnDriverParam<number>, TNotNull, THasDefault> {
	protected brand!: 'PgBigSerial53';

	getSQLType(): string {
		return 'bigserial';
	}

	override mapFromDriverValue(value: number): number {
		if (typeof value === 'number') {
			return value;
		}
		return parseInt(value);
	}
}

export class PgBigSerial64Builder<
	TNotNull extends ColumnNotNull = ColumnNotNull<false>,
	THasDefault extends ColumnHasDefault = ColumnHasDefault<false>,
> extends PgColumnBuilder<ColumnData<bigint>, ColumnDriverParam<string>, TNotNull, THasDefault> {
	/** @internal */
	override build<TTableName extends TableName>(
		table: AnyPgTable<TTableName>,
	): PgBigSerial64<TTableName, TNotNull, THasDefault> {
		return new PgBigSerial64<TTableName, TNotNull, THasDefault>(table, this);
	}
}

export class PgBigSerial64<
	TTableName extends TableName,
	TNotNull extends ColumnNotNull,
	THasDefault extends ColumnHasDefault,
> extends PgColumn<TTableName, ColumnData<bigint>, ColumnDriverParam<string>, TNotNull, THasDefault> {
	protected brand!: 'PgBigSerial64';

	getSQLType(): string {
		return 'bigserial';
	}

	override mapFromDriverValue(value: string): bigint {
		return BigInt(value);
	}
}

interface PgBigSerialConfig<T extends 'number' | 'bigint'> {
	mode: T;
}

export function bigserial(name: string, mode: PgBigSerialConfig<'number'>): PgBigSerial53Builder;
export function bigserial(name: string, mode: PgBigSerialConfig<'bigint'>): PgBigSerial64Builder;
export function bigserial(name: string, mode: any) {
	if (mode === 'number') {
		return new PgBigSerial53Builder(name);
	}
	return new PgBigSerial64Builder(name);
}
