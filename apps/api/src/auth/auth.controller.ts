import { Body, Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";
import { JwtAuthGuard, type RequestUser } from "./jwt-auth.guard";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("register")
  async register(@Body() body: RegisterDto) {
    return this.authService.register({
      email: body.email,
      password: body.password,
      displayName: body.displayName,
    });
  }

  @Post("login")
  async login(@Body() body: LoginDto) {
    return this.authService.login({
      email: body.email,
      password: body.password,
    });
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  me(@Req() req: { user: RequestUser }) {
    return { id: req.user.id, email: req.user.email ?? null };
  }
}
