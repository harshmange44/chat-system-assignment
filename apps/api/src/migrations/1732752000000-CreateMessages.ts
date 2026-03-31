import { MigrationInterface, QueryRunner, Table, TableIndex } from "typeorm";

export class CreateMessages1732752000000 implements MigrationInterface {
  name = "CreateMessages1732752000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);

    await queryRunner.createTable(
      new Table({
        name: "messages",
        columns: [
          {
            name: "id",
            type: "uuid",
            isPrimary: true,
            default: "gen_random_uuid()",
          },
          {
            name: "roomId",
            type: "varchar",
            length: "80",
            isNullable: false,
          },
          {
            name: "userId",
            type: "varchar",
            length: "80",
            isNullable: false,
          },
          {
            name: "userName",
            type: "varchar",
            length: "80",
            isNullable: false,
          },
          {
            name: "content",
            type: "text",
            isNullable: false,
          },
          {
            name: "createdAt",
            type: "timestamp",
            default: "now()",
            isNullable: false,
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      "messages",
      new TableIndex({
        name: "idx_messages_room_id",
        columnNames: ["roomId"],
      }),
    );

    await queryRunner.createIndex(
      "messages",
      new TableIndex({
        name: "idx_messages_room_created_at",
        columnNames: ["roomId", "createdAt"],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable("messages");
  }
}
