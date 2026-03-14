import {
  clanMembers,
  news,
  aiChatMessages,
  clanStats,
  admins,
  clanSettings,
  monthlyStats,
  requests,
  forumTopics,
  forumReplies,
  shopItems,
  purchases,
  transactions,
  siteBans,
  channels,
  channelSubscriptions,
  videos,
  videoLikes,
  videoComments,
  videoPlatformAdmins,
  type ClanMember,
  type InsertClanMember,
  type News,
  type InsertNews,
  type AiChatMessage,
  type InsertAiChatMessage,
  type ClanStats,
  type InsertClanStats,
  type Admin,
  type InsertAdmin,
  type ClanSettings,
  type InsertClanSettings,
  type MonthlyStats,
  type InsertMonthlyStats,
  type Request,
  type InsertRequest,
  type ForumTopic,
  type InsertForumTopic,
  type ForumReply,
  type InsertForumReply,
  type ShopItem,
  type InsertShopItem,
  type Purchase,
  type InsertPurchase,
  type Transaction,
  type InsertTransaction,
  type SiteBan,
  type InsertSiteBan,
  type Channel,
  type InsertChannel,
  type ChannelSubscription,
  type InsertChannelSubscription,
  type Video,
  type InsertVideo,
  type VideoLike,
  type InsertVideoLike,
  type VideoComment,
  type InsertVideoComment,
  type VideoPlatformAdmin,
  type InsertVideoPlatformAdmin,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, count, or, sql } from "drizzle-orm";

export interface IStorage {
  getAdminByUsername(username: string): Promise<Admin | undefined>;
  getAdminById(id: string): Promise<Admin | undefined>;
  createAdmin(admin: InsertAdmin): Promise<Admin>;
  
  getClanSettings(): Promise<ClanSettings | undefined>;
  updateClanSettings(settings: Partial<InsertClanSettings>): Promise<ClanSettings>;
  
  getAllClanMembers(): Promise<ClanMember[]>;
  getTopClanMembers(limit: number): Promise<ClanMember[]>;
  getClanMemberById(id: string): Promise<ClanMember | undefined>;
  getClanMemberByDiscordId(discordId: string): Promise<ClanMember | undefined>;
  getClanMemberByUsername(username: string): Promise<ClanMember | undefined>;
  createClanMember(member: InsertClanMember): Promise<ClanMember>;
  updateClanMember(id: string, member: Partial<InsertClanMember>): Promise<ClanMember | undefined>;
  deleteClanMember(id: string): Promise<boolean>;
  
  getAllNews(): Promise<News[]>;
  getLatestNews(limit: number): Promise<News[]>;
  getNewsById(id: string): Promise<News | undefined>;
  createNews(newsItem: InsertNews): Promise<News>;
  updateNews(id: string, newsItem: Partial<InsertNews>): Promise<News | undefined>;
  deleteNews(id: string): Promise<boolean>;
  
  getAllAiMessages(): Promise<AiChatMessage[]>;
  createAiMessage(message: InsertAiChatMessage): Promise<AiChatMessage>;
  
  getClanStats(): Promise<ClanStats | undefined>;
  updateClanStats(stats: InsertClanStats): Promise<ClanStats>;
  
  getMonthlyStats(limit?: number): Promise<MonthlyStats[]>;
  createMonthlyStats(stats: InsertMonthlyStats): Promise<MonthlyStats>;
  updateMonthlyStats(year: number, month: number, stats: Partial<InsertMonthlyStats>): Promise<MonthlyStats | undefined>;
  
  getAllRequests(): Promise<Request[]>;
  getRequestById(id: string): Promise<Request | undefined>;
  createRequest(request: InsertRequest): Promise<Request>;
  respondToRequest(id: string, status: string, adminResponse: string, respondedBy: string): Promise<Request | undefined>;
  deleteRequest(id: string): Promise<boolean>;
  
  getAllForumTopics(): Promise<ForumTopic[]>;
  getForumTopicById(id: string): Promise<ForumTopic | undefined>;
  createForumTopic(topic: InsertForumTopic): Promise<ForumTopic>;
  updateForumTopic(id: string, updates: Partial<InsertForumTopic>): Promise<ForumTopic | undefined>;
  incrementTopicViews(id: string): Promise<void>;
  deleteForumTopic(id: string): Promise<boolean>;
  
  getForumRepliesByTopic(topicId: string): Promise<ForumReply[]>;
  createForumReply(reply: InsertForumReply): Promise<ForumReply>;
  deleteForumReply(id: string): Promise<boolean>;
  
  getAllShopItems(): Promise<ShopItem[]>;
  getActiveShopItems(): Promise<ShopItem[]>;
  getShopItemById(id: string): Promise<ShopItem | undefined>;
  getShopItemByDiscordRoleId(roleId: string): Promise<ShopItem | undefined>;
  createShopItem(item: InsertShopItem): Promise<ShopItem>;
  updateShopItem(id: string, item: Partial<InsertShopItem>): Promise<ShopItem | undefined>;
  deleteShopItem(id: string): Promise<boolean>;
  
  createPurchase(purchase: InsertPurchase): Promise<Purchase>;
  getPurchasesByMemberId(memberId: string): Promise<Purchase[]>;
  getPurchasesByDiscordId(discordId: string): Promise<Purchase[]>;
  
  createTransaction(transaction: InsertTransaction): Promise<Transaction>;
  getTransactionsByMemberId(memberId: string): Promise<Transaction[]>;
  getTransactionsByDiscordId(discordId: string): Promise<Transaction[]>;
  getAllTransactions(options?: { type?: string; discordId?: string; limit?: number; offset?: number }): Promise<{ transactions: (Transaction & { username: string })[]; total: number }>;
  
  addLumiCoins(memberId: string, amount: number, description: string): Promise<void>;
  removeLumiCoins(memberId: string, amount: number, description: string): Promise<void>;
  getMemberBalance(discordId: string): Promise<number>;
  
  // Система банов на сайте
  createSiteBan(ban: InsertSiteBan): Promise<SiteBan>;
  getAllSiteBans(): Promise<SiteBan[]>;
  getActiveSiteBan(discordId: string): Promise<SiteBan | undefined>;
  updateSiteBan(id: string, updates: Partial<InsertSiteBan>): Promise<SiteBan | undefined>;
  deleteSiteBan(id: string): Promise<boolean>;
  
  // Видеоплатформа - Каналы
  createChannel(channel: InsertChannel): Promise<Channel>;
  getAllChannels(): Promise<Channel[]>;
  getChannelById(id: string): Promise<Channel | undefined>;
  getChannelByHandle(handle: string): Promise<Channel | undefined>;
  getChannelByOwnerId(ownerId: string): Promise<Channel | undefined>;
  updateChannel(id: string, data: Partial<InsertChannel>): Promise<Channel | undefined>;
  deleteChannel(id: string): Promise<boolean>;
  incrementChannelVideoCount(id: string): Promise<void>;
  incrementChannelViews(id: string, views: number): Promise<void>;
  
  // Подписки на каналы
  subscribeToChannel(subscription: InsertChannelSubscription): Promise<ChannelSubscription>;
  unsubscribeFromChannel(channelId: string, subscriberId: string): Promise<boolean>;
  isSubscribed(channelId: string, subscriberId: string): Promise<boolean>;
  getChannelSubscribers(channelId: string): Promise<ChannelSubscription[]>;
  getChannelSubscriberCount(channelId: string): Promise<number>;
  
  // Видео
  createVideo(video: InsertVideo): Promise<Video>;
  getAllVideos(): Promise<Video[]>;
  getVideoById(id: string): Promise<Video | undefined>;
  getVideosByChannelId(channelId: string): Promise<Video[]>;
  incrementVideoViews(id: string): Promise<void>;
  deleteVideo(id: string): Promise<boolean>;
  
  likeVideo(like: InsertVideoLike): Promise<VideoLike>;
  unlikeVideo(videoId: string, discordId: string): Promise<boolean>;
  getVideoLikes(videoId: string): Promise<VideoLike[]>;
  getVideoLikeCount(videoId: string): Promise<number>;
  hasUserLiked(videoId: string, discordId: string): Promise<boolean>;
  getLikedVideosByUser(discordId: string): Promise<Video[]>;
  
  createVideoComment(comment: InsertVideoComment): Promise<VideoComment>;
  getVideoComments(videoId: string): Promise<VideoComment[]>;
  deleteVideoComment(id: string): Promise<boolean>;
  
  // Video platform admins
  getVideoPlatformAdmin(discordId: string): Promise<VideoPlatformAdmin | undefined>;
  getAllVideoPlatformAdmins(): Promise<VideoPlatformAdmin[]>;
  addVideoPlatformAdmin(admin: InsertVideoPlatformAdmin): Promise<VideoPlatformAdmin>;
  removeVideoPlatformAdmin(id: string): Promise<boolean>;
  
  // Video get/update
  getVideo(id: string): Promise<Video | undefined>;
  updateVideo(id: string, data: Partial<InsertVideo>): Promise<Video | undefined>;
}

export class DatabaseStorage implements IStorage {
  async getAdminByUsername(username: string): Promise<Admin | undefined> {
    const [admin] = await db.select().from(admins).where(eq(admins.username, username));
    return admin || undefined;
  }

  async getAdminById(id: string): Promise<Admin | undefined> {
    const [admin] = await db.select().from(admins).where(eq(admins.id, id));
    return admin || undefined;
  }

  async createAdmin(admin: InsertAdmin): Promise<Admin> {
    const [newAdmin] = await db
      .insert(admins)
      .values(admin)
      .returning();
    return newAdmin;
  }

  async getClanSettings(): Promise<ClanSettings | undefined> {
    const [settings] = await db.select().from(clanSettings).limit(1);
    return settings || undefined;
  }

  async updateClanSettings(settings: Partial<InsertClanSettings>): Promise<ClanSettings> {
    const existing = await this.getClanSettings();
    if (existing) {
      const [updated] = await db
        .update(clanSettings)
        .set({ ...settings, updatedAt: new Date() })
        .where(eq(clanSettings.id, existing.id))
        .returning();
      return updated;
    } else {
      const [created] = await db
        .insert(clanSettings)
        .values(settings as InsertClanSettings)
        .returning();
      return created;
    }
  }

  async getAllClanMembers(): Promise<ClanMember[]> {
    return await db.select().from(clanMembers).orderBy(desc(clanMembers.lumiCoins));
  }

  async getTopClanMembers(limit: number): Promise<ClanMember[]> {
    return await db.select().from(clanMembers).orderBy(desc(clanMembers.lumiCoins)).limit(limit);
  }

  async getClanMemberById(id: string): Promise<ClanMember | undefined> {
    const [member] = await db.select().from(clanMembers).where(eq(clanMembers.id, id));
    return member || undefined;
  }

  async getClanMemberByDiscordId(discordId: string): Promise<ClanMember | undefined> {
    const [member] = await db.select().from(clanMembers).where(eq(clanMembers.discordId, discordId));
    return member || undefined;
  }

  async getClanMemberByUsername(username: string): Promise<ClanMember | undefined> {
    const [member] = await db.select().from(clanMembers).where(eq(clanMembers.username, username));
    return member || undefined;
  }

  async createClanMember(member: InsertClanMember): Promise<ClanMember> {
    const [newMember] = await db
      .insert(clanMembers)
      .values(member)
      .returning();
    return newMember;
  }

  async updateClanMember(id: string, member: Partial<InsertClanMember>): Promise<ClanMember | undefined> {
    const [updated] = await db
      .update(clanMembers)
      .set(member)
      .where(eq(clanMembers.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteClanMember(id: string): Promise<boolean> {
    const result = await db
      .delete(clanMembers)
      .where(eq(clanMembers.id, id));
    return true;
  }

  async getAllNews(): Promise<News[]> {
    return await db.select().from(news).orderBy(desc(news.createdAt));
  }

  async getLatestNews(limit: number): Promise<News[]> {
    return await db.select().from(news).orderBy(desc(news.createdAt)).limit(limit);
  }

  async getNewsById(id: string): Promise<News | undefined> {
    const [newsItem] = await db.select().from(news).where(eq(news.id, id));
    return newsItem || undefined;
  }

  async createNews(newsItem: InsertNews): Promise<News> {
    const [created] = await db
      .insert(news)
      .values(newsItem)
      .returning();
    return created;
  }

  async updateNews(id: string, newsItem: Partial<InsertNews>): Promise<News | undefined> {
    const [updated] = await db
      .update(news)
      .set({ ...newsItem, updatedAt: new Date() })
      .where(eq(news.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteNews(id: string): Promise<boolean> {
    await db.delete(news).where(eq(news.id, id));
    return true;
  }

  async getAllAiMessages(): Promise<AiChatMessage[]> {
    return await db.select().from(aiChatMessages).orderBy(aiChatMessages.createdAt);
  }

  async createAiMessage(message: InsertAiChatMessage): Promise<AiChatMessage> {
    const [created] = await db
      .insert(aiChatMessages)
      .values(message)
      .returning();
    return created;
  }

  async getClanStats(): Promise<ClanStats | undefined> {
    const [stats] = await db.select().from(clanStats).limit(1);
    return stats || undefined;
  }

  async updateClanStats(stats: InsertClanStats): Promise<ClanStats> {
    const existing = await this.getClanStats();
    if (existing) {
      const [updated] = await db
        .update(clanStats)
        .set(stats)
        .where(eq(clanStats.id, existing.id))
        .returning();
      return updated;
    } else {
      const [created] = await db
        .insert(clanStats)
        .values(stats)
        .returning();
      return created;
    }
  }

  async getMonthlyStats(limit: number = 12): Promise<MonthlyStats[]> {
    return await db
      .select()
      .from(monthlyStats)
      .orderBy(desc(monthlyStats.year), desc(monthlyStats.month))
      .limit(limit);
  }

  async createMonthlyStats(stats: InsertMonthlyStats): Promise<MonthlyStats> {
    const [created] = await db
      .insert(monthlyStats)
      .values(stats)
      .returning();
    return created;
  }

  async updateMonthlyStats(year: number, month: number, stats: Partial<InsertMonthlyStats>): Promise<MonthlyStats | undefined> {
    const [existing] = await db
      .select()
      .from(monthlyStats)
      .where(and(eq(monthlyStats.year, year), eq(monthlyStats.month, month)))
      .limit(1);

    if (existing) {
      const [updated] = await db
        .update(monthlyStats)
        .set(stats)
        .where(eq(monthlyStats.id, existing.id))
        .returning();
      return updated;
    } else if (stats.wins !== undefined && stats.losses !== undefined && stats.activity !== undefined) {
      return await this.createMonthlyStats({ year, month, wins: stats.wins, losses: stats.losses, activity: stats.activity });
    }
    return undefined;
  }

  async getAllRequests(): Promise<Request[]> {
    return await db.select().from(requests).orderBy(desc(requests.createdAt));
  }

  async getRequestById(id: string): Promise<Request | undefined> {
    const [request] = await db.select().from(requests).where(eq(requests.id, id));
    return request || undefined;
  }

  async createRequest(request: InsertRequest): Promise<Request> {
    const [created] = await db
      .insert(requests)
      .values(request)
      .returning();
    return created;
  }

  async respondToRequest(id: string, status: string, adminResponse: string, respondedBy: string): Promise<Request | undefined> {
    const [updated] = await db
      .update(requests)
      .set({ status, adminResponse, respondedBy, respondedAt: new Date() })
      .where(eq(requests.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteRequest(id: string): Promise<boolean> {
    await db.delete(requests).where(eq(requests.id, id));
    return true;
  }

  async getAllForumTopics(): Promise<ForumTopic[]> {
    return await db
      .select()
      .from(forumTopics)
      .orderBy(desc(forumTopics.isPinned), desc(forumTopics.createdAt));
  }

  async getForumTopicById(id: string): Promise<ForumTopic | undefined> {
    const [topic] = await db.select().from(forumTopics).where(eq(forumTopics.id, id));
    return topic || undefined;
  }

  async createForumTopic(topic: InsertForumTopic): Promise<ForumTopic> {
    const [created] = await db
      .insert(forumTopics)
      .values(topic)
      .returning();
    return created;
  }

  async updateForumTopic(id: string, updates: Partial<InsertForumTopic>): Promise<ForumTopic | undefined> {
    const [updated] = await db
      .update(forumTopics)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(forumTopics.id, id))
      .returning();
    return updated || undefined;
  }

  async incrementTopicViews(id: string): Promise<void> {
    const topic = await this.getForumTopicById(id);
    if (topic) {
      await db
        .update(forumTopics)
        .set({ views: topic.views + 1 })
        .where(eq(forumTopics.id, id));
    }
  }

  async deleteForumTopic(id: string): Promise<boolean> {
    await db.delete(forumTopics).where(eq(forumTopics.id, id));
    return true;
  }

  async getForumRepliesByTopic(topicId: string): Promise<ForumReply[]> {
    return await db
      .select()
      .from(forumReplies)
      .where(eq(forumReplies.topicId, topicId))
      .orderBy(forumReplies.createdAt);
  }

  async createForumReply(reply: InsertForumReply): Promise<ForumReply> {
    const [created] = await db
      .insert(forumReplies)
      .values(reply)
      .returning();
    return created;
  }

  async deleteForumReply(id: string): Promise<boolean> {
    await db.delete(forumReplies).where(eq(forumReplies.id, id));
    return true;
  }

  async getAllShopItems(): Promise<ShopItem[]> {
    return await db.select().from(shopItems).orderBy(desc(shopItems.createdAt));
  }

  async getActiveShopItems(): Promise<ShopItem[]> {
    return await db.select().from(shopItems).where(eq(shopItems.isAvailable, true)).orderBy(desc(shopItems.createdAt));
  }

  async getShopItemById(id: string): Promise<ShopItem | undefined> {
    const [item] = await db.select().from(shopItems).where(eq(shopItems.id, id));
    return item || undefined;
  }

  async getShopItemByDiscordRoleId(roleId: string): Promise<ShopItem | undefined> {
    const [item] = await db.select().from(shopItems).where(eq(shopItems.discordRoleId, roleId));
    return item || undefined;
  }

  async createShopItem(item: InsertShopItem): Promise<ShopItem> {
    const [created] = await db
      .insert(shopItems)
      .values(item)
      .returning();
    return created;
  }

  async updateShopItem(id: string, item: Partial<InsertShopItem>): Promise<ShopItem | undefined> {
    const [updated] = await db
      .update(shopItems)
      .set({ ...item, updatedAt: new Date() })
      .where(eq(shopItems.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteShopItem(id: string): Promise<boolean> {
    await db.delete(shopItems).where(eq(shopItems.id, id));
    return true;
  }

  async createPurchase(purchase: InsertPurchase): Promise<Purchase> {
    const [created] = await db
      .insert(purchases)
      .values(purchase)
      .returning();
    return created;
  }

  async getPurchasesByMemberId(memberId: string): Promise<Purchase[]> {
    return await db.select().from(purchases).where(eq(purchases.memberId, memberId)).orderBy(desc(purchases.createdAt));
  }

  async getPurchasesByDiscordId(discordId: string): Promise<Purchase[]> {
    return await db.select().from(purchases).where(eq(purchases.discordId, discordId)).orderBy(desc(purchases.createdAt));
  }

  async createTransaction(transaction: InsertTransaction): Promise<Transaction> {
    const [created] = await db
      .insert(transactions)
      .values(transaction)
      .returning();
    return created;
  }

  async getTransactionsByMemberId(memberId: string): Promise<Transaction[]> {
    return await db.select().from(transactions).where(eq(transactions.memberId, memberId)).orderBy(desc(transactions.createdAt));
  }

  async getTransactionsByDiscordId(discordId: string): Promise<Transaction[]> {
    return await db.select().from(transactions).where(eq(transactions.discordId, discordId)).orderBy(desc(transactions.createdAt));
  }

  async getAllTransactions(options?: { type?: string; discordId?: string; limit?: number; offset?: number }): Promise<{ transactions: (Transaction & { username: string })[]; total: number }> {
    const { type, discordId, limit = 50, offset = 0 } = options || {};
    
    // Строим условия фильтрации
    const conditions = [];
    if (type) {
      conditions.push(eq(transactions.type, type));
    }
    if (discordId) {
      conditions.push(eq(transactions.discordId, discordId));
    }
    
    // Получаем транзакции с JOIN к clanMembers для получения username
    const query = db
      .select({
        id: transactions.id,
        memberId: transactions.memberId,
        discordId: transactions.discordId,
        amount: transactions.amount,
        type: transactions.type,
        description: transactions.description,
        createdAt: transactions.createdAt,
        username: clanMembers.username,
      })
      .from(transactions)
      .leftJoin(clanMembers, eq(transactions.memberId, clanMembers.id))
      .orderBy(desc(transactions.createdAt));
    
    // Применяем условия если есть
    const filteredQuery = conditions.length > 0 
      ? query.where(and(...conditions))
      : query;
    
    // Получаем данные с пагинацией
    const transactionsData = await filteredQuery.limit(limit).offset(offset);
    
    // Получаем общее количество для пагинации
    const countQuery = conditions.length > 0
      ? db.select({ count: count() }).from(transactions).where(and(...conditions))
      : db.select({ count: count() }).from(transactions);
    
    const [{ count: total }] = await countQuery;
    
    return {
      transactions: transactionsData.map(t => ({
        ...t,
        username: t.username || 'Unknown',
      })),
      total: Number(total),
    };
  }

  async addLumiCoins(memberId: string, amount: number, description: string): Promise<void> {
    const member = await this.getClanMemberById(memberId);
    if (member) {
      const newBalance = (member.lumiCoins || 0) + amount;
      await this.updateClanMember(memberId, { lumiCoins: newBalance });
      await this.createTransaction({
        memberId,
        discordId: member.discordId || '',
        username: member.username,
        amount,
        type: 'earn',
        description,
      });
    }
  }

  async removeLumiCoins(memberId: string, amount: number, description: string): Promise<void> {
    const member = await this.getClanMemberById(memberId);
    if (member) {
      const newBalance = Math.max((member.lumiCoins || 0) - amount, 0);
      await this.updateClanMember(memberId, { lumiCoins: newBalance });
      await this.createTransaction({
        memberId,
        discordId: member.discordId || '',
        username: member.username,
        amount: -amount,
        type: 'spend',
        description,
      });
    }
  }

  async getMemberBalance(discordId: string): Promise<number> {
    const member = await this.getClanMemberByDiscordId(discordId);
    return member?.lumiCoins || 0;
  }

  // Система банов на сайте
  async createSiteBan(ban: InsertSiteBan): Promise<SiteBan> {
    const [newBan] = await db
      .insert(siteBans)
      .values(ban)
      .returning();
    return newBan;
  }

  async getAllSiteBans(): Promise<SiteBan[]> {
    return await db.select().from(siteBans).orderBy(desc(siteBans.createdAt));
  }

  async getActiveSiteBan(discordId: string): Promise<SiteBan | undefined> {
    const [ban] = await db
      .select()
      .from(siteBans)
      .where(
        and(
          eq(siteBans.discordId, discordId),
          eq(siteBans.isActive, true)
        )
      )
      .limit(1);
    
    // Проверяем, не истёк ли бан
    if (ban && ban.expiresAt && new Date(ban.expiresAt) < new Date()) {
      // Деактивируем истёкший бан
      await db
        .update(siteBans)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(siteBans.id, ban.id));
      return undefined;
    }
    
    return ban || undefined;
  }

  async updateSiteBan(id: string, updates: Partial<InsertSiteBan>): Promise<SiteBan | undefined> {
    const [updated] = await db
      .update(siteBans)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(siteBans.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteSiteBan(id: string): Promise<boolean> {
    const result = await db.delete(siteBans).where(eq(siteBans.id, id)).returning();
    return result.length > 0;
  }

  // Видеоплатформа
  async createVideo(video: InsertVideo): Promise<Video> {
    const [newVideo] = await db
      .insert(videos)
      .values(video)
      .returning();
    return newVideo;
  }

  async getAllVideos(): Promise<Video[]> {
    return await db.select().from(videos).orderBy(desc(videos.createdAt));
  }

  async searchVideos(query: string): Promise<Video[]> {
    if (!query || query.trim() === '') {
      return await this.getAllVideos();
    }

    const searchPattern = `%${query.toLowerCase()}%`;
    return await db
      .select()
      .from(videos)
      .where(
        or(
          sql`LOWER(${videos.title}) LIKE ${searchPattern}`,
          sql`LOWER(${videos.description}) LIKE ${searchPattern}`,
          sql`LOWER(${videos.uploadedByUsername}) LIKE ${searchPattern}`
        )
      )
      .orderBy(desc(videos.createdAt));
  }

  async getVideoById(id: string): Promise<Video | undefined> {
    const [video] = await db.select().from(videos).where(eq(videos.id, id));
    return video || undefined;
  }

  async incrementVideoViews(id: string): Promise<void> {
    const video = await this.getVideoById(id);
    if (video) {
      await db
        .update(videos)
        .set({ views: (video.views || 0) + 1 })
        .where(eq(videos.id, id));
    }
  }

  async deleteVideo(id: string): Promise<boolean> {
    const result = await db.delete(videos).where(eq(videos.id, id)).returning();
    return result.length > 0;
  }

  async likeVideo(like: InsertVideoLike): Promise<VideoLike> {
    const [newLike] = await db
      .insert(videoLikes)
      .values(like)
      .returning();
    return newLike;
  }

  async unlikeVideo(videoId: string, discordId: string): Promise<boolean> {
    const result = await db
      .delete(videoLikes)
      .where(and(eq(videoLikes.videoId, videoId), eq(videoLikes.discordId, discordId)))
      .returning();
    return result.length > 0;
  }

  async getVideoLikes(videoId: string): Promise<VideoLike[]> {
    return await db.select().from(videoLikes).where(eq(videoLikes.videoId, videoId));
  }

  async getVideoLikeCount(videoId: string): Promise<number> {
    const result = await db
      .select({ count: count() })
      .from(videoLikes)
      .where(eq(videoLikes.videoId, videoId));
    return result[0]?.count || 0;
  }

  async hasUserLiked(videoId: string, discordId: string): Promise<boolean> {
    const [like] = await db
      .select()
      .from(videoLikes)
      .where(and(eq(videoLikes.videoId, videoId), eq(videoLikes.discordId, discordId)))
      .limit(1);
    return !!like;
  }

  async getLikedVideosByUser(discordId: string): Promise<Video[]> {
    const likedVideos = await db
      .select({ video: videos })
      .from(videoLikes)
      .innerJoin(videos, eq(videoLikes.videoId, videos.id))
      .where(eq(videoLikes.discordId, discordId))
      .orderBy(desc(videoLikes.createdAt));
    
    return likedVideos.map(row => row.video);
  }

  async createVideoComment(comment: InsertVideoComment): Promise<VideoComment> {
    const [newComment] = await db
      .insert(videoComments)
      .values(comment)
      .returning();
    return newComment;
  }

  async getVideoComments(videoId: string): Promise<VideoComment[]> {
    return await db.select().from(videoComments).where(eq(videoComments.videoId, videoId)).orderBy(desc(videoComments.createdAt));
  }

  async deleteVideoComment(id: string): Promise<boolean> {
    const result = await db.delete(videoComments).where(eq(videoComments.id, id)).returning();
    return result.length > 0;
  }

  // ===== КАНАЛЫ =====
  async createChannel(channel: InsertChannel): Promise<Channel> {
    const [newChannel] = await db.insert(channels).values(channel).returning();
    return newChannel;
  }

  async getAllChannels(): Promise<Channel[]> {
    return await db.select().from(channels).orderBy(desc(channels.subscriberCount));
  }

  async getChannelById(id: string): Promise<Channel | undefined> {
    const [channel] = await db.select().from(channels).where(eq(channels.id, id));
    return channel || undefined;
  }

  async getChannelByHandle(handle: string): Promise<Channel | undefined> {
    const [channel] = await db.select().from(channels).where(eq(channels.handle, handle));
    return channel || undefined;
  }

  async getChannelByOwnerId(ownerId: string): Promise<Channel | undefined> {
    const [channel] = await db.select().from(channels).where(eq(channels.ownerId, ownerId));
    return channel || undefined;
  }

  async updateChannel(id: string, data: Partial<InsertChannel>): Promise<Channel | undefined> {
    const [updated] = await db.update(channels).set({ ...data, updatedAt: new Date() }).where(eq(channels.id, id)).returning();
    return updated || undefined;
  }

  async deleteChannel(id: string): Promise<boolean> {
    const result = await db.delete(channels).where(eq(channels.id, id)).returning();
    return result.length > 0;
  }

  async incrementChannelVideoCount(id: string): Promise<void> {
    const channel = await this.getChannelById(id);
    if (channel) {
      await db.update(channels).set({ videoCount: channel.videoCount + 1 }).where(eq(channels.id, id));
    }
  }

  async incrementChannelViews(id: string, views: number): Promise<void> {
    const channel = await this.getChannelById(id);
    if (channel) {
      await db.update(channels).set({ totalViews: channel.totalViews + views }).where(eq(channels.id, id));
    }
  }

  // ===== ПОДПИСКИ =====
  async subscribeToChannel(subscription: InsertChannelSubscription): Promise<ChannelSubscription> {
    const [newSub] = await db.insert(channelSubscriptions).values(subscription).returning();
    const channel = await this.getChannelById(subscription.channelId);
    if (channel) {
      await db.update(channels).set({ subscriberCount: channel.subscriberCount + 1 }).where(eq(channels.id, subscription.channelId));
    }
    return newSub;
  }

  async unsubscribeFromChannel(channelId: string, subscriberId: string): Promise<boolean> {
    const result = await db.delete(channelSubscriptions)
      .where(and(eq(channelSubscriptions.channelId, channelId), eq(channelSubscriptions.subscriberId, subscriberId)))
      .returning();
    if (result.length > 0) {
      const channel = await this.getChannelById(channelId);
      if (channel) {
        await db.update(channels).set({ subscriberCount: Math.max(0, channel.subscriberCount - 1) }).where(eq(channels.id, channelId));
      }
    }
    return result.length > 0;
  }

  async isSubscribed(channelId: string, subscriberId: string): Promise<boolean> {
    const [sub] = await db.select().from(channelSubscriptions)
      .where(and(eq(channelSubscriptions.channelId, channelId), eq(channelSubscriptions.subscriberId, subscriberId)));
    return !!sub;
  }

  async getChannelSubscribers(channelId: string): Promise<ChannelSubscription[]> {
    return await db.select().from(channelSubscriptions).where(eq(channelSubscriptions.channelId, channelId));
  }

  async getChannelSubscriberCount(channelId: string): Promise<number> {
    const channel = await this.getChannelById(channelId);
    return channel?.subscriberCount || 0;
  }

  // Обновление метода getVideosByChannelId
  async getVideosByChannelId(channelId: string): Promise<Video[]> {
    return await db.select().from(videos).where(eq(videos.channelId, channelId)).orderBy(desc(videos.createdAt));
  }

  // ===== VIDEO PLATFORM ADMINS =====
  async getVideoPlatformAdmin(discordId: string): Promise<VideoPlatformAdmin | undefined> {
    const [admin] = await db.select().from(videoPlatformAdmins).where(eq(videoPlatformAdmins.discordId, discordId));
    return admin || undefined;
  }

  async getAllVideoPlatformAdmins(): Promise<VideoPlatformAdmin[]> {
    return await db.select().from(videoPlatformAdmins).orderBy(desc(videoPlatformAdmins.createdAt));
  }

  async addVideoPlatformAdmin(admin: InsertVideoPlatformAdmin): Promise<VideoPlatformAdmin> {
    const [newAdmin] = await db.insert(videoPlatformAdmins).values(admin).returning();
    return newAdmin;
  }

  async removeVideoPlatformAdmin(id: string): Promise<boolean> {
    const result = await db.delete(videoPlatformAdmins).where(eq(videoPlatformAdmins.id, id)).returning();
    return result.length > 0;
  }

  // ===== VIDEO GET/UPDATE =====
  async getVideo(id: string): Promise<Video | undefined> {
    const [video] = await db.select().from(videos).where(eq(videos.id, id));
    return video || undefined;
  }

  async updateVideo(id: string, data: Partial<InsertVideo>): Promise<Video | undefined> {
    const [updated] = await db.update(videos).set(data).where(eq(videos.id, id)).returning();
    return updated || undefined;
  }
}

export const storage = new DatabaseStorage();
