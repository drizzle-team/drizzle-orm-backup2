import { ColumnData, ColumnDriverParam, ColumnHasDefault, ColumnNotNull, TableName } from 'drizzle-orm/branded-types';
import { AnyMySqlTable } from '~/table';
import { MySqlColumn, MySqlColumnBuilder } from './common';

export class MySqlBinaryBuilder<
	TNotNull extends ColumnNotNull = ColumnNotNull<false>,
	THasDefault extends ColumnHasDefault = ColumnHasDefault<false>,
> extends MySqlColumnBuilder<ColumnData<string>, ColumnDriverParam<string>, TNotNull, THasDefault> {
	/** @internal */ length: number | undefined;

	constructor(name: string, length?: number) {
		super(name);
		this.length = length;
	}

	/** @internal */
	override build<TTableName extends TableName>(
		table: AnyMySqlTable<TTableName>,
	): MySqlBinary<TTableName, TNotNull, THasDefault> {
		return new MySqlBinary<TTableName, TNotNull, THasDefault>(table, this);
	}
}

export class MySqlBinary<
	TTableName extends TableName,
	TNotNull extends ColumnNotNull,
	THasDefault extends ColumnHasDefault,
> extends MySqlColumn<
	TTableName,
	ColumnData<string>,
	ColumnDriverParam<string>,
	TNotNull,
	THasDefault
> {
	protected brand!: 'MySqlBinary';

	length: number | undefined;

	constructor(table: AnyMySqlTable<TTableName>, builder: MySqlBinaryBuilder<TNotNull, THasDefault>) {
		super(table, builder);
		this.length = builder.length;
	}

	getSQLType(): string {
		return typeof this.length !== 'undefined' ? `binary(${this.length})` : `binary`;
	}
}

export interface MySqlBinaryConfig {
	length?: number;
}

export function binary(name: string, config: MySqlBinaryConfig = {}): MySqlBinaryBuilder {
	return new MySqlBinaryBuilder(name, config.length);
}
