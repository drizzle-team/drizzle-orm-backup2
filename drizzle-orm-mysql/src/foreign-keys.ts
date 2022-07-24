import { TableName } from 'drizzle-orm/branded-types';
import { AnyMySqlColumn, MySqlColumn } from './columns/common';
import { AnyMySqlTable } from './table';

export type UpdateDeleteAction = 'cascade' | 'restrict' | 'no action' | 'set null' | 'set default';

export type Reference<TTableName extends TableName, TForeignTableName extends TableName> = () => {
	readonly columns: AnyMySqlColumn<TTableName>[];
	readonly foreignTable: AnyMySqlTable<TForeignTableName>;
	readonly foreignColumns: AnyMySqlColumn<TForeignTableName>[];
};

export class ForeignKeyBuilder<TTableName extends TableName, TForeignTableName extends TableName> {
	protected brand!: 'PgForeignKeyBuilder';

	/** @internal */
	_reference: Reference<TTableName, TForeignTableName>;

	/** @internal */
	_onUpdate: UpdateDeleteAction | undefined;

	/** @internal */
	_onDelete: UpdateDeleteAction | undefined;

	constructor(
		reference: () => readonly [
			columns: AnyMySqlColumn<TTableName>[],
			foreignTable: AnyMySqlTable<TForeignTableName>,
			foreignColumns: AnyMySqlColumn<TForeignTableName>[],
		],
	) {
		this._reference = () => {
			const [columns, foreignTable, foreignColumns] = reference();
			return { columns, foreignTable, foreignColumns };
		};
	}

	onUpdate(action: UpdateDeleteAction): Omit<this, 'onUpdate'> {
		this._onUpdate = action;
		return this;
	}

	onDelete(action: UpdateDeleteAction): Omit<this, 'onDelete'> {
		this._onDelete = action;
		return this;
	}

	build(table: AnyMySqlTable<TTableName>): ForeignKey<TTableName, TForeignTableName> {
		return new ForeignKey(table, this);
	}
}

export type AnyForeignKeyBuilder = ForeignKeyBuilder<TableName, TableName>;

export class ForeignKey<TTableName extends TableName, TForeignTableName extends TableName> {
	readonly reference: Reference<TTableName, TForeignTableName>;
	readonly onUpdate: UpdateDeleteAction | undefined;
	readonly onDelete: UpdateDeleteAction | undefined;

	constructor(
		readonly table: AnyMySqlTable<TTableName>,
		builder: ForeignKeyBuilder<TTableName, TForeignTableName>,
	) {
		this.reference = builder._reference;
		this.onUpdate = builder._onUpdate;
		this.onDelete = builder._onDelete;
	}
}

export type AnyForeignKey = ForeignKey<TableName, TableName>;

type ColumnsWithTable<
	TTableName extends TableName,
	TColumns extends AnyMySqlColumn | [AnyMySqlColumn, ...AnyMySqlColumn[]],
> = TColumns extends MySqlColumn<any, infer TType, any, any, any> ? MySqlColumn<TTableName, TType, any, any, any>
	: TColumns extends AnyMySqlColumn[] ? {
			[Key in keyof TColumns]: TColumns[Key] extends MySqlColumn<any, infer TType, any, any, any>
				? MySqlColumn<TTableName, TType, any, any, any>
				: never;
		}
	: never;

type GetColumnsTable<TColumns extends AnyMySqlColumn | AnyMySqlColumn[]> = (
	TColumns extends AnyMySqlColumn ? TColumns
		: TColumns extends AnyMySqlColumn[] ? TColumns[number]
		: never
) extends AnyMySqlColumn<infer TTableName> ? TTableName
	: never;

export function foreignKey<
	TColumns extends AnyMySqlColumn | [AnyMySqlColumn, ...AnyMySqlColumn[]],
	TForeignTableName extends TableName,
>(
	config: () => [
		columns: TColumns,
		foreignTable: AnyMySqlTable<TForeignTableName>,
		foreignColumns: ColumnsWithTable<TForeignTableName, TColumns>,
	],
): ForeignKeyBuilder<
	GetColumnsTable<TColumns>,
	TForeignTableName
> {
	function mappedConfig() {
		const [columns, foreignTable, foreignColumns] = config();
		return [
			(columns instanceof MySqlColumn ? [columns] : columns) as AnyMySqlColumn<
				GetColumnsTable<TColumns>
			>[],
			foreignTable,
			(foreignColumns instanceof MySqlColumn
				? [foreignColumns]
				: foreignColumns) as AnyMySqlColumn<TForeignTableName>[],
		] as const;
	}

	return new ForeignKeyBuilder(mappedConfig);
}
