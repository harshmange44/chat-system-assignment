import { ConflictException, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { InjectRepository } from "@nestjs/typeorm";
import * as bcrypt from "bcrypt";
import { Repository } from "typeorm";
import { ProfileEntity } from "../common/entities/profile.entity";
import { UserEntity } from "../common/entities/user.entity";

export type AuthUser = {
  id: string;
  email?: string;
  userName: string;
};

type JwtPayload = { sub: string; email: string };

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @InjectRepository(ProfileEntity)
    private readonly profileRepository: Repository<ProfileEntity>,
    private readonly jwtService: JwtService,
  ) {}

  verifyAccessToken(accessToken?: string): AuthUser | null {
    if (!accessToken) return null;
    try {
      const payload = this.jwtService.verify<JwtPayload>(accessToken);
      const email = payload.email;
      return {
        id: payload.sub,
        email,
        userName: email?.includes("@") ? email.split("@")[0]! : `user-${payload.sub.slice(0, 8)}`,
      };
    } catch {
      return null;
    }
  }

  async register(input: {
    email: string;
    password: string;
    displayName: string;
  }): Promise<{ accessToken: string; user: { id: string; email: string } }> {
    const email = input.email.trim().toLowerCase();
    const existing = await this.userRepository.findOne({ where: { email } });
    if (existing) {
      throw new ConflictException("An account with this email already exists");
    }
    const passwordHash = await bcrypt.hash(input.password, 12);
    const user = this.userRepository.create({ email, passwordHash });
    await this.userRepository.save(user);

    const profile = this.profileRepository.create({
      id: user.id,
      displayName: input.displayName.trim(),
      email,
    });
    await this.profileRepository.save(profile);

    return {
      accessToken: this.signToken(user.id, email),
      user: { id: user.id, email },
    };
  }

  async login(input: {
    email: string;
    password: string;
  }): Promise<{ accessToken: string; user: { id: string; email: string } }> {
    const email = input.email.trim().toLowerCase();
    const user = await this.userRepository.findOne({ where: { email } });
    if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) {
      throw new UnauthorizedException("Invalid email or password");
    }
    return {
      accessToken: this.signToken(user.id, user.email),
      user: { id: user.id, email: user.email },
    };
  }

  private signToken(userId: string, email: string): string {
    return this.jwtService.sign({ sub: userId, email } satisfies JwtPayload);
  }
}
