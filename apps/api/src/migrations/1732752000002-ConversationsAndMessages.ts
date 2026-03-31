import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from "typeorm";

const GENERAL_ID = "00000000-0000-4000-8000-000000000001";

export class ConversationsAndMessages1732752000002 implements MigrationInterface {
  name = "ConversationsAndMessages1732752000002";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: "conversations",
        columns: [
          {
            name: "id",
            type: "uuid",
            isPrimary: true,
            default: "gen_random_uuid()",
          },
          {
            name: "kind",
            type: "varchar",
            length: "20",
            isNullable: false,
          },
          {
            name: "title",
            type: "varchar",
            length: "120",
            isNullable: true,
          },
          {
            name: "lastMessageAt",
            type: "timestamp",
            isNullable: true,
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
      "conversations",
      new TableIndex({
        name: "idx_conversations_kind",
        columnNames: ["kind"],
      }),
    );

    await queryRunner.createIndex(
      "conversations",
      new TableIndex({
        name: "idx_conversations_last_message_at",
        columnNames: ["lastMessageAt"],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: "conversation_members",
        columns: [
          {
            name: "conversationId",
            type: "uuid",
            isPrimary: true,
            isNullable: false,
          },
          {
            name: "userId",
            type: "varchar",
            length: "80",
            isPrimary: true,
            isNullable: false,
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      "conversation_members",
      new TableIndex({
        name: "idx_conversation_members_user_id",
        columnNames: ["userId"],
      }),
    );

    await queryRunner.createForeignKey(
      "conversation_members",
      new TableForeignKey({
        columnNames: ["conversationId"],
        referencedTableName: "conversations",
        referencedColumnNames: ["id"],
        onDelete: "CASCADE",
      }),
    );

    await queryRunner.query(
      `INSERT INTO "conversations" ("id", "kind", "title", "lastMessageAt", "createdAt") VALUES ($1, 'channel', 'General', NULL, now())`,
      [GENERAL_ID],
    );

    await queryRunner.query(`ALTER TABLE "messages" ADD COLUMN "conversationId" uuid`);

    await queryRunner.query(`UPDATE "messages" SET "conversationId" = $1 WHERE "roomId" = 'general'`, [
      GENERAL_ID,
    ]);

    const otherRooms = (await queryRunner.query(
      `SELECT DISTINCT "roomId" FROM "messages" WHERE "roomId" IS NOT NULL AND "roomId" <> 'general'`,
    )) as { roomId: string }[];

    for (const { roomId } of otherRooms) {
      const inserted = (await queryRunner.query(
        `INSERT INTO "conversations" ("id", "kind", "title", "lastMessageAt", "createdAt")
         VALUES (gen_random_uuid(), 'channel', $1, NULL, now()) RETURNING "id"`,
        [roomId],
      )) as { id: string }[];
      const newId = inserted[0]?.id;
      if (newId) {
        await queryRunner.query(`UPDATE "messages" SET "conversationId" = $1 WHERE "roomId" = $2`, [
          newId,
          roomId,
        ]);
      }
    }

    await queryRunner.query(`UPDATE "messages" SET "conversationId" = $1 WHERE "conversationId" IS NULL`, [
      GENERAL_ID,
    ]);

    await queryRunner.query(`ALTER TABLE "messages" ALTER COLUMN "conversationId" SET NOT NULL`);

    await queryRunner.createForeignKey(
      "messages",
      new TableForeignKey({
        columnNames: ["conversationId"],
        referencedTableName: "conversations",
        referencedColumnNames: ["id"],
        onDelete: "CASCADE",
      }),
    );

    await queryRunner.query(`DROP INDEX IF EXISTS "idx_messages_room_created_at"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_messages_room_id"`);
    await queryRunner.query(`ALTER TABLE "messages" DROP COLUMN "roomId"`);

    await queryRunner.createIndex(
      "messages",
      new TableIndex({
        name: "idx_messages_conversation_id",
        columnNames: ["conversationId"],
      }),
    );

    await queryRunner.createIndex(
      "messages",
      new TableIndex({
        name: "idx_messages_conversation_created_at",
        columnNames: ["conversationId", "createdAt"],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_messages_conversation_created_at"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_messages_conversation_id"`);

    await queryRunner.query(`ALTER TABLE "messages" ADD COLUMN "roomId" varchar(80) NOT NULL DEFAULT 'general'`);

    const fkRows = (await queryRunner.query(`
      SELECT tc.constraint_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
      WHERE tc.table_name = 'messages' AND tc.constraint_type = 'FOREIGN KEY' AND kcu.column_name = 'conversationId'
    `)) as { constraint_name: string }[];
    if (fkRows.length && fkRows[0]?.constraint_name) {
      await queryRunner.query(
        `ALTER TABLE "messages" DROP CONSTRAINT "${fkRows[0].constraint_name}"`,
      );
    }

    await queryRunner.query(`ALTER TABLE "messages" DROP COLUMN "conversationId"`);

    await queryRunner.dropTable("conversation_members");
    await queryRunner.dropTable("conversations");
  }
}
