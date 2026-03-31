import * as bcrypt from "bcrypt";
import { MigrationInterface, QueryRunner, Table, TableForeignKey } from "typeorm";

export class CreateUsers1732752000003 implements MigrationInterface {
  name = "CreateUsers1732752000003";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: "users",
        columns: [
          {
            name: "id",
            type: "uuid",
            isPrimary: true,
            default: "gen_random_uuid()",
          },
          {
            name: "email",
            type: "varchar",
            length: "320",
            isNullable: false,
            isUnique: true,
          },
          {
            name: "passwordHash",
            type: "varchar",
            length: "255",
            isNullable: false,
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

    const fks = (await queryRunner.query(`
      SELECT tc.constraint_name
      FROM information_schema.table_constraints tc
      WHERE tc.table_schema = 'public'
        AND tc.table_name = 'profiles'
        AND tc.constraint_type = 'FOREIGN KEY'
    `)) as { constraint_name: string }[];

    for (const { constraint_name } of fks) {
      await queryRunner.query(`ALTER TABLE "profiles" DROP CONSTRAINT "${constraint_name}"`);
    }

    const profiles = (await queryRunner.query(`SELECT id, email FROM "profiles"`)) as {
      id: string;
      email: string | null;
    }[];

    const placeholderHash = bcrypt.hashSync("__migrated_not_loginable__", 10);
    for (const p of profiles) {
      const email = (p.email || `${p.id}@migrated.local`).toLowerCase();
      await queryRunner.query(
        `INSERT INTO "users" ("id", "email", "passwordHash", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, now(), now())
         ON CONFLICT ("id") DO NOTHING`,
        [p.id, email, placeholderHash],
      );
    }

    await queryRunner.createForeignKey(
      "profiles",
      new TableForeignKey({
        columnNames: ["id"],
        referencedTableName: "users",
        referencedColumnNames: ["id"],
        onDelete: "CASCADE",
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const fkRows = (await queryRunner.query(`
      SELECT tc.constraint_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
      WHERE tc.table_schema = 'public'
        AND tc.table_name = 'profiles'
        AND tc.constraint_type = 'FOREIGN KEY'
        AND kcu.column_name = 'id'
    `)) as { constraint_name: string }[];

    for (const row of fkRows) {
      if (row.constraint_name) {
        await queryRunner.query(`ALTER TABLE "profiles" DROP CONSTRAINT IF EXISTS "${row.constraint_name}"`);
      }
    }

    await queryRunner.dropTable("users");
  }
}
