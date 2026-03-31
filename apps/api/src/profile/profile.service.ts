import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { ILike, Repository } from "typeorm";
import { ProfileEntity } from "../common/entities/profile.entity";

@Injectable()
export class ProfileService {
  constructor(
    @InjectRepository(ProfileEntity)
    private readonly profileRepository: Repository<ProfileEntity>,
  ) {}

  async findById(id: string): Promise<ProfileEntity | null> {
    return this.profileRepository.findOne({ where: { id } });
  }

  /**
   * Case-insensitive substring search on display name (uses trigram index on Postgres).
   */
  async searchByDisplayName(query: string, limit = 20): Promise<ProfileEntity[]> {
    const q = query.trim();
    if (!q) return [];
    const take = Math.min(Math.max(limit, 1), 50);
    return this.profileRepository.find({
      where: { displayName: ILike(`%${q}%`) },
      order: { displayName: "ASC" },
      take,
    });
  }

  async upsertForUser(input: {
    id: string;
    displayName: string;
    email: string | null;
  }): Promise<ProfileEntity> {
    const existing = await this.findById(input.id);
    const entity = this.profileRepository.create({
      id: input.id,
      displayName: input.displayName.trim(),
      email: input.email,
      ...(existing ? {} : {}),
    });
    return this.profileRepository.save(entity);
  }
}
