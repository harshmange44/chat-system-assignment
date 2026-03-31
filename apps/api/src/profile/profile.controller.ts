import { Body, Controller, Get, Put, Query, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard, type RequestUser } from "../auth/jwt-auth.guard";
import { UpsertProfileDto } from "./dto/upsert-profile.dto";
import { ProfileService } from "./profile.service";

@Controller("profiles")
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get("search")
  @UseGuards(JwtAuthGuard)
  async search(
    @Query("q") q: string,
    @Query("limit") limit?: string,
  ) {
    const parsed = limit ? Number(limit) : 20;
    return this.profileService.searchByDisplayName(q ?? "", Number.isFinite(parsed) ? parsed : 20);
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  async me(@Req() req: { user: RequestUser }) {
    const profile = await this.profileService.findById(req.user.id);
    return profile ?? { id: req.user.id, displayName: req.user.userName, email: req.user.email ?? null };
  }

  @Put("me")
  @UseGuards(JwtAuthGuard)
  async upsertMe(
    @Req() req: { user: RequestUser },
    @Body() body: UpsertProfileDto,
  ) {
    return this.profileService.upsertForUser({
      id: req.user.id,
      displayName: body.displayName,
      email: req.user.email ?? null,
    });
  }
}
