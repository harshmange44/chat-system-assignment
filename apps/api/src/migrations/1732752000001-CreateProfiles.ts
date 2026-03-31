import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from "typeorm";

export class CreateProfiles1732752000001 implements MigrationInterface {
  name = "CreateProfiles1732752000001";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pg_trgm"`);

    await queryRunner.createTable(
      new Table({
        name: "profiles",
        columns: [
          {
            name: "id",
            type: "uuid",
            isPrimary: true,
            isNullable: false,
          },
          {
            name: "displayName",
            type: "varchar",
            length: "120",
            isNullable: false,
          },
          {
            name: "email",
            type: "varchar",
            length: "320",
            isNullable: true,
          },
          {
            name: "createdAt",
            type: "timestamp",
            default: "now()",
            isNullable: false,
          },
          {
            name: "updatedAt",
            type: "timestamp",
            default: "now()",
            isNullable: false,
          },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      "profiles",
      new TableForeignKey({
        columnNames: ["id"],
        referencedTableName: "users",
        referencedColumnNames: ["id"],
        referencedSchema: "auth",
        onDelete: "CASCADE",
      }),
    );

    await queryRunner.createIndex(
      "profiles",
      new TableIndex({
        name: "idx_profiles_display_name",
        columnNames: ["displayName"],
      }),
    );

    await queryRunner.query(`
      CREATE INDEX "idx_profiles_display_name_trgm"
      ON "profiles" USING gin ("displayName" gin_trgm_ops)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_profiles_display_name_trgm"`);
    await queryRunner.dropTable("profiles");
  }
}
