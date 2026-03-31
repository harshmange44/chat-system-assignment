import { config } from "dotenv";
import { join } from "path";
import { DataSource } from "typeorm";
import { ConversationMemberEntity } from "./common/entities/conversation-member.entity";
import { ConversationEntity } from "./common/entities/conversation.entity";
import { MessageEntity } from "./common/entities/message.entity";
import { ProfileEntity } from "./common/entities/profile.entity";
import { UserEntity } from "./common/entities/user.entity";
import { typeormMigrations } from "./migrations";

config({ path: join(__dirname, "..", ".env") });

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required to run TypeORM migrations.");
}

export default new DataSource({
  type: "postgres",
  url: process.env.DATABASE_URL,
  ssl: process.env.DB_SSL === "false" ? false : { rejectUnauthorized: false },
  entities: [MessageEntity, ProfileEntity, UserEntity, ConversationEntity, ConversationMemberEntity],
  migrations: typeormMigrations,
  migrationsTableName: "typeorm_migrations",
});
