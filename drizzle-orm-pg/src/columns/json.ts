import { ColumnConfig } from 'drizzle-orm';
import { ColumnBuilderConfig } from 'drizzle-orm/column-builder';
import { AnyPgTable } from '~/table';
import { PgColumn, PgColumnBuilder } from './common';

export class PgJsonBuilder<TData> extends PgColumnBuilder<ColumnBuilderConfig<{ data: TData; driverParam: string }>> {
	constructor(name: string) {
		super(name);
	}

	/** @internal */
	override build<TTableName extends string>(table: AnyPgTable<{ name: TTableName }>): PgJson<TTableName, TData> {
		return new PgJson(table, this);
	}
}

export class PgJson<TTableName extends string, TData>
	extends PgColumn<ColumnConfig<{ tableName: TTableName; data: TData; driverParam: string }>>
{
	protected override $pgColumnBrand!: 'PgJson';

	constructor(table: AnyPgTable<{ name: TTableName }>, builder: PgJsonBuilder<TData>) {
		super(table, builder);
	}

	getSQLType(): string {
		return 'json';
	}

	override mapToDriverValue(value: TData): string {
		return JSON.stringify(value);
	}
}

export function json<TData = any>(name: string): PgJsonBuilder<TData> {
	return new PgJsonBuilder(name);
}
