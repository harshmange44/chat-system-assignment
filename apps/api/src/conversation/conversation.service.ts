import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { GENERAL_CONVERSATION_ID } from "@chat-system/shared-types";
import { In, Repository } from "typeorm";
import { ConversationMemberEntity } from "../common/entities/conversation-member.entity";
import { ConversationEntity } from "../common/entities/conversation.entity";
import { ProfileService } from "../profile/profile.service";

export type ConversationSummary = {
  id: string;
  kind: "dm" | "group" | "channel";
  title: string | null;
  peer: { id: string; displayName: string } | null;
  lastMessageAt: string | null;
};

@Injectable()
export class ConversationService {
  constructor(
    @InjectRepository(ConversationEntity)
    private readonly conversationRepository: Repository<ConversationEntity>,
    @InjectRepository(ConversationMemberEntity)
    private readonly memberRepository: Repository<ConversationMemberEntity>,
    private readonly profileService: ProfileService,
  ) {}

  async canAccess(userId: string, conversationId: string): Promise<boolean> {
    if (conversationId === GENERAL_CONVERSATION_ID) return true;
    const row = await this.memberRepository.findOne({
      where: { conversationId, userId },
    });
    return !!row;
  }

  async findById(id: string): Promise<ConversationEntity | null> {
    return this.conversationRepository.findOne({ where: { id } });
  }

  async touchLastMessage(conversationId: string): Promise<void> {
    await this.conversationRepository.update(
      { id: conversationId },
      { lastMessageAt: new Date() },
    );
  }

  async createDmResponse(userId: string, peerUserId: string): Promise<ConversationSummary> {
    const conv = await this.findOrCreateDm(userId, peerUserId);
    return this.dmSummary(conv, userId);
  }

  async findOrCreateDm(userId: string, peerUserId: string): Promise<ConversationEntity> {
    if (userId === peerUserId) {
      throw new BadRequestException("Cannot start a DM with yourself");
    }
    const existingId = await this.findDmConversationIdBetween(userId, peerUserId);
    if (existingId) {
      const conv = await this.conversationRepository.findOne({ where: { id: existingId } });
      if (conv) return conv;
    }
    const entity = this.conversationRepository.create({
      kind: "dm",
      title: null,
      lastMessageAt: null,
    });
    const saved = await this.conversationRepository.save(entity);
    await this.memberRepository.save([
      this.memberRepository.create({ conversationId: saved.id, userId }),
      this.memberRepository.create({ conversationId: saved.id, userId: peerUserId }),
    ]);
    return saved;
  }

  private async findDmConversationIdBetween(a: string, b: string): Promise<string | null> {
    const rows = (await this.conversationRepository.query(
      `SELECT c.id AS id
       FROM conversations c
       WHERE c.kind = 'dm'
         AND EXISTS (
           SELECT 1 FROM conversation_members m
           WHERE m."conversationId" = c.id AND m."userId" = $1
         )
         AND EXISTS (
           SELECT 1 FROM conversation_members m
           WHERE m."conversationId" = c.id AND m."userId" = $2
         )
         AND (
           SELECT COUNT(*)::int FROM conversation_members
           WHERE "conversationId" = c.id
         ) = 2
       LIMIT 1`,
      [a, b],
    )) as { id: string }[];
    return rows[0]?.id ?? null;
  }

  async listSummariesForUser(userId: string): Promise<ConversationSummary[]> {
    const general = await this.generalSummary();

    const memberships = await this.memberRepository.find({ where: { userId } });
    const dmIds = memberships.map((m) => m.conversationId);
    const dms =
      dmIds.length === 0
        ? []
        : await this.conversationRepository.find({
            where: { id: In(dmIds), kind: "dm" },
          });
    dms.sort((a, b) => {
      const at = a.lastMessageAt?.getTime() ?? 0;
      const bt = b.lastMessageAt?.getTime() ?? 0;
      if (bt !== at) return bt - at;
      return b.createdAt.getTime() - a.createdAt.getTime();
    });

    const dmSummaries: ConversationSummary[] = [];
    for (const c of dms) {
      dmSummaries.push(await this.dmSummary(c, userId));
    }

    return [general, ...dmSummaries];
  }

  private async generalSummary(): Promise<ConversationSummary> {
    const row = await this.conversationRepository.findOne({
      where: { id: GENERAL_CONVERSATION_ID },
    });
    return {
      id: GENERAL_CONVERSATION_ID,
      kind: "channel",
      title: row?.title ?? "General",
      peer: null,
      lastMessageAt: row?.lastMessageAt?.toISOString() ?? null,
    };
  }

  private async dmSummary(c: ConversationEntity, me: string): Promise<ConversationSummary> {
    const members = await this.memberRepository.find({
      where: { conversationId: c.id },
    });
    const peerId = members.find((m) => m.userId !== me)?.userId ?? null;
    let peer: { id: string; displayName: string } | null = null;
    if (peerId) {
      const profile = await this.profileService.findById(peerId);
      peer = {
        id: peerId,
        displayName: profile?.displayName ?? "Unknown",
      };
    }
    return {
      id: c.id,
      kind: "dm",
      title: null,
      peer,
      lastMessageAt: c.lastMessageAt?.toISOString() ?? null,
    };
  }

  async requireAccess(userId: string, conversationId: string): Promise<void> {
    const ok = await this.canAccess(userId, conversationId);
    if (!ok) {
      throw new NotFoundException("Conversation not found");
    }
  }
}
