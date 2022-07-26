import { GetColumnData } from 'drizzle-orm';
import { ColumnData, TableName, Unwrap } from 'drizzle-orm/branded-types';
import { SelectFieldsOrdered } from 'drizzle-orm/operations';
import { AnySQLResponse, SQLResponse } from 'drizzle-orm/sql';
import { GetTableName, tableColumns, tableName } from 'drizzle-orm/utils';
import { Simplify } from 'type-fest';
import { MySqlColumnDriverParam } from './branded-types';
import { AnyMySqlColumn } from './columns/common';
import { AnyMySqlDialect, MySqlSession } from './connection';
import { MySqlDelete, MySqlInsert, MySqlSelect, MySqlUpdate } from './queries';
import { AnyMySqlTable, InferModel } from './table';

export type MySqlSelectFields<
	TTableName extends TableName,
	TColumnDriverParam extends MySqlColumnDriverParam = MySqlColumnDriverParam,
> = {
	[key: string]:
		| SQLResponse<TTableName, ColumnData>
		| AnyMySqlColumn<TTableName, any, TColumnDriverParam>;
};

export type MySqlSelectFieldsOrdered<TTableName extends TableName = TableName> = (
	& Omit<SelectFieldsOrdered[number], 'column'>
	& {
		column: AnyMySqlColumn<TTableName> | AnySQLResponse<TTableName>;
	}
)[];

export type SelectResultFields<
	TTableName extends TableName,
	TSelectedFields extends MySqlSelectFields<TTableName>,
> = Simplify<
	{
		[Key in keyof TSelectedFields & string]: TSelectedFields[Key] extends AnyMySqlColumn
			? GetColumnData<TSelectedFields[Key]>
			: TSelectedFields[Key] extends SQLResponse<TableName, infer TDriverParam> ? Unwrap<TDriverParam>
			: never;
	}
>;

export class MySqlTableOperations<TTable extends AnyMySqlTable, TTableNamesMap extends Record<string, string>> {
	constructor(
		protected table: TTable,
		private session: MySqlSession,
		private dialect: AnyMySqlDialect,
		private tableNamesMap: TTableNamesMap,
	) {}

	select(): MySqlSelect<TTable, TTableNamesMap, InferModel<TTable>>;
	select<TSelectedFields extends MySqlSelectFields<GetTableName<TTable>>>(
		fields: TSelectedFields,
	): MySqlSelect<TTable, TTableNamesMap, SelectResultFields<GetTableName<TTable>, TSelectedFields>>;
	select(fields?: MySqlSelectFields<GetTableName<TTable>>): MySqlSelect<TTable, TTableNamesMap, any> {
		const fieldsOrdered = this.dialect.orderSelectedFields(
			fields ?? this.table[tableColumns] as Record<string, AnyMySqlColumn>,
			this.tableNamesMap[this.table[tableName]]!,
		);
		return new MySqlSelect(this.table, fieldsOrdered, this.session, this.dialect, this.tableNamesMap);
	}

	update(): Pick<MySqlUpdate<TTable>, 'set'> {
		return new MySqlUpdate(this.table, this.session, this.dialect);
	}

	insert(values: InferModel<TTable, 'insert'> | InferModel<TTable, 'insert'>[]): MySqlInsert<TTable> {
		return new MySqlInsert(
			this.table,
			Array.isArray(values) ? values : [values],
			this.session,
			this.dialect,
		);
	}

	delete(): MySqlDelete<TTable> {
		return new MySqlDelete(this.table, this.session, this.dialect);
	}
}
