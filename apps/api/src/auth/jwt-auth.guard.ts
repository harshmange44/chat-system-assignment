import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { AuthService } from "./auth.service";

export type RequestUser = {
  id: string;
  email?: string;
  userName: string;
};

type RequestWithUser = {
  headers: { authorization?: string };
  user?: RequestUser;
};

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<RequestWithUser>();
    const header = req.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
    const user = this.authService.verifyAccessToken(token);
    if (!user) {
      throw new UnauthorizedException("Invalid or missing bearer token");
    }
    req.user = user;
    return true;
  }
}
