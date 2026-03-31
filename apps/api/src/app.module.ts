import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthModule } from "./auth/auth.module";
import { ConversationMemberEntity } from "./common/entities/conversation-member.entity";
import { ConversationEntity } from "./common/entities/conversation.entity";
import { MessageEntity } from "./common/entities/message.entity";
import { ProfileEntity } from "./common/entities/profile.entity";
import { UserEntity } from "./common/entities/user.entity";
import { ChatModule } from "./chat/chat.module";
import { typeormMigrations } from "./migrations";
import { ProfileModule } from "./profile/profile.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [".env", ".env.local"],
    }),
    AuthModule,
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const dbType = config.get<string>("DB_TYPE", "postgres");
        if (dbType === "postgres") {
          return {
            type: "postgres" as const,
            url: config.get<string>("DATABASE_URL"),
            host: config.get<string>("DB_HOST") ?? undefined,
            port: config.get<string>("DB_PORT") ? Number(config.get("DB_PORT")) : undefined,
            username: config.get<string>("DB_USER") ?? undefined,
            password: config.get<string>("DB_PASSWORD") ?? undefined,
            database: config.get<string>("DB_NAME") ?? undefined,
            ssl: config.get<string>("DB_SSL") === "false" ? false : { rejectUnauthorized: false },
            entities: [MessageEntity, ProfileEntity, UserEntity, ConversationEntity, ConversationMemberEntity],
            migrations: typeormMigrations,
            migrationsRun: config.get<string>("DB_MIGRATIONS_RUN") === "true",
            synchronize: config.get<string>("DB_SYNC") === "true",
          };
        }

        return {
          type: "sqlite" as const,
          database: config.get<string>("DB_PATH", "chat.sqlite"),
          entities: [MessageEntity, ProfileEntity, UserEntity, ConversationEntity, ConversationMemberEntity],
          synchronize: true,
        };
      },
    }),
    ChatModule,
    ProfileModule,
  ],
})
export class AppModule {}
