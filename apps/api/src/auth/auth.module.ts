import { Global, Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import type { SignOptions } from "jsonwebtoken";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ProfileEntity } from "../common/entities/profile.entity";
import { UserEntity } from "../common/entities/user.entity";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { JwtAuthGuard } from "./jwt-auth.guard";

@Global()
@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([UserEntity, ProfileEntity]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const expiresIn = (config.get<string>("JWT_EXPIRES_IN") ?? "7d") as SignOptions["expiresIn"];
        return {
          secret: config.get<string>("JWT_SECRET") ?? "dev-only-set-JWT_SECRET",
          signOptions: { expiresIn },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard],
  exports: [AuthService, JwtAuthGuard],
})
export class AuthModule {}
