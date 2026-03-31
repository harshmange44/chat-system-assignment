import { MigrationInterface, QueryRunner } from "typeorm";

export class UserIdTypeFix1774990830247 implements MigrationInterface {
    name = 'UserIdTypeFix1774990830247'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "conversation_members" ALTER COLUMN "userId" TYPE uuid USING "userId"::uuid`);
        await queryRunner.query(`ALTER TABLE "messages" ALTER COLUMN "userId" TYPE uuid USING "userId"::uuid`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "messages" ALTER COLUMN "userId" TYPE varchar(80) USING "userId"::varchar`);
        await queryRunner.query(`ALTER TABLE "conversation_members" ALTER COLUMN "userId" TYPE varchar(80) USING "userId"::varchar`);
    }

}
