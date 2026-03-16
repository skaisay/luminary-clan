import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, jsonb, boolean, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const admins = pgTable("admins", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  email: text("email"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const clanSettings = pgTable("clan_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clanName: text("clan_name").notNull().default("CLAN COMMAND"),
  clanTag: text("clan_tag").default("[CC]"),
  description: text("description").notNull().default("Элитный игровой клан"),
  heroImageUrl: text("hero_image_url"),
  logoUrl: text("logo_url"),
  splashImageUrl: text("splash_image_url"),
  discordServerId: text("discord_server_id"),
  discordBotToken: text("discord_bot_token"),
  aiSystemPrompt: text("ai_system_prompt").notNull().default("Ты - AI советник игрового клана. Помогаешь игрокам улучшать навыки и стратегию."),
  primaryColor: text("primary_color").default("#06b6d4"),
  accentColor: text("accent_color").default("#a855f7"),
  seasonalTheme: text("seasonal_theme").default("none"),
  messageRewardRate: real("message_reward_rate").default(1.0).notNull(),
  voiceRewardRate: real("voice_reward_rate").default(10.0).notNull(),
  reactionRewardRate: real("reaction_reward_rate").default(1.0).notNull(),
  antiSpamEnabled: boolean("anti_spam_enabled").default(true).notNull(),
  antiSpamMessageWindow: integer("anti_spam_message_window").default(10).notNull(),
  antiSpamMessageThreshold: integer("anti_spam_message_threshold").default(5).notNull(),
  antiSpamPenaltyRate: real("anti_spam_penalty_rate").default(0.1).notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const clanMembers = pgTable("clan_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  discordId: text("discord_id").unique(),
  username: text("username").notNull(),
  avatar: text("avatar"),
  role: text("role").notNull().default("Member"),
  rank: integer("rank").default(0),
  wins: integer("wins").default(0),
  losses: integer("losses").default(0),
  kills: integer("kills").default(0),
  deaths: integer("deaths").default(0),
  assists: integer("assists").default(0),
  lumiCoins: integer("lumi_coins").default(0),
  experience: integer("experience").default(0).notNull(),
  level: integer("level").default(1).notNull(),
  equippedTitle: text("equipped_title"),
  equippedBanner: text("equipped_banner"),
  videoPlatformBackground: text("video_platform_background").default("background1"),
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
});

export const news = pgTable("news", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  content: text("content").notNull(),
  category: text("category").notNull().default("General"),
  authorId: varchar("author_id"),
  authorName: text("author_name").notNull(),
  imageUrl: text("image_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const aiChatMessages = pgTable("ai_chat_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  role: text("role").notNull(),
  content: text("content").notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const clanStats = pgTable("clan_stats", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  totalMembers: integer("total_members").default(0),
  totalWins: integer("total_wins").default(0),
  totalLosses: integer("total_losses").default(0),
  averageRank: integer("average_rank").default(0),
  monthlyActivity: integer("monthly_activity").default(0),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const monthlyStats = pgTable("monthly_stats", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  year: integer("year").notNull(),
  month: integer("month").notNull(),
  wins: integer("wins").default(0).notNull(),
  losses: integer("losses").default(0).notNull(),
  activity: integer("activity").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const discordActivity = pgTable("discord_activity", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  memberId: varchar("member_id").notNull().references(() => clanMembers.id),
  discordId: text("discord_id").notNull(),
  messageCount: integer("message_count").default(0),
  voiceMinutes: integer("voice_minutes").default(0),
  reactionCount: integer("reaction_count").default(0),
  lastVoiceJoin: timestamp("last_voice_join"),
  lastActivity: timestamp("last_activity").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertClanMemberSchema = createInsertSchema(clanMembers).omit({
  id: true,
  joinedAt: true,
});

export const insertNewsSchema = createInsertSchema(news).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAiChatMessageSchema = createInsertSchema(aiChatMessages).omit({
  id: true,
  createdAt: true,
});

export const insertClanStatsSchema = createInsertSchema(clanStats).omit({
  id: true,
  updatedAt: true,
});

export const insertMonthlyStatsSchema = createInsertSchema(monthlyStats).omit({
  id: true,
  createdAt: true,
});

export const insertAdminSchema = createInsertSchema(admins).omit({
  id: true,
  createdAt: true,
});

export const insertClanSettingsSchema = createInsertSchema(clanSettings).omit({
  id: true,
  updatedAt: true,
});

export type Admin = typeof admins.$inferSelect;
export type InsertAdmin = z.infer<typeof insertAdminSchema>;

export type ClanSettings = typeof clanSettings.$inferSelect;
export type InsertClanSettings = z.infer<typeof insertClanSettingsSchema>;

export type ClanMember = typeof clanMembers.$inferSelect;
export type InsertClanMember = z.infer<typeof insertClanMemberSchema>;

export type News = typeof news.$inferSelect;
export type InsertNews = z.infer<typeof insertNewsSchema>;

export type AiChatMessage = typeof aiChatMessages.$inferSelect;
export type InsertAiChatMessage = z.infer<typeof insertAiChatMessageSchema>;

export type ClanStats = typeof clanStats.$inferSelect;
export type InsertClanStats = z.infer<typeof insertClanStatsSchema>;

export type MonthlyStats = typeof monthlyStats.$inferSelect;
export type InsertMonthlyStats = z.infer<typeof insertMonthlyStatsSchema>;

export const insertDiscordActivitySchema = createInsertSchema(discordActivity).omit({
  id: true,
  createdAt: true,
});

export type DiscordActivity = typeof discordActivity.$inferSelect;
export type InsertDiscordActivity = z.infer<typeof insertDiscordActivitySchema>;

export const requests = pgTable("requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull(),
  discordId: text("discord_id"),
  requestType: text("request_type").notNull(),
  content: text("content").notNull(),
  status: text("status").notNull().default("pending"),
  adminResponse: text("admin_response"),
  respondedBy: text("responded_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  respondedAt: timestamp("responded_at"),
});

export const forumTopics = pgTable("forum_topics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  authorUsername: text("author_username").notNull(),
  authorDiscordId: text("author_discord_id"),
  content: text("content").notNull(),
  isPinned: boolean("is_pinned").default(false).notNull(),
  isLocked: boolean("is_locked").default(false).notNull(),
  views: integer("views").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const forumReplies = pgTable("forum_replies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  topicId: varchar("topic_id").notNull().references(() => forumTopics.id, { onDelete: "cascade" }),
  authorUsername: text("author_username").notNull(),
  authorDiscordId: text("author_discord_id"),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertRequestSchema = createInsertSchema(requests).omit({
  id: true,
  createdAt: true,
  respondedAt: true,
});

export const insertForumTopicSchema = createInsertSchema(forumTopics).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertForumReplySchema = createInsertSchema(forumReplies).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type Request = typeof requests.$inferSelect;
export type InsertRequest = z.infer<typeof insertRequestSchema>;

export type ForumTopic = typeof forumTopics.$inferSelect;
export type InsertForumTopic = z.infer<typeof insertForumTopicSchema>;

export type ForumReply = typeof forumReplies.$inferSelect;
export type InsertForumReply = z.infer<typeof insertForumReplySchema>;

export const shopItems = pgTable("shop_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description").notNull(),
  price: integer("price").notNull(),
  category: text("category").notNull().default("role"),
  rarity: text("rarity").notNull().default("common"),
  itemType: text("item_type").notNull().default("role"),
  roleCategory: text("role_category"),
  discordRoleId: text("discord_role_id"),
  roleColor: text("role_color"),
  roleIcon: text("role_icon"),
  discordPermissions: text("discord_permissions").array(),
  imageUrl: text("image_url"),
  stock: integer("stock").default(-1),
  isAvailable: boolean("is_available").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const purchases = pgTable("purchases", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  memberId: varchar("member_id").notNull().references(() => clanMembers.id),
  itemId: varchar("item_id").notNull().references(() => shopItems.id),
  discordId: text("discord_id").notNull(),
  discordRoleId: text("discord_role_id"),
  price: integer("price").notNull(),
  status: text("status").notNull().default("completed"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const transactions = pgTable("transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  memberId: varchar("member_id").notNull().references(() => clanMembers.id),
  discordId: text("discord_id").notNull(),
  username: text("username").notNull(),
  amount: integer("amount").notNull(),
  type: text("type").notNull(),
  description: text("description").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertShopItemSchema = createInsertSchema(shopItems).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPurchaseSchema = createInsertSchema(purchases).omit({
  id: true,
  createdAt: true,
});

export const insertTransactionSchema = createInsertSchema(transactions).omit({
  id: true,
  createdAt: true,
});

export type ShopItem = typeof shopItems.$inferSelect;
export type InsertShopItem = z.infer<typeof insertShopItemSchema>;

export type Purchase = typeof purchases.$inferSelect;
export type InsertPurchase = z.infer<typeof insertPurchaseSchema>;

export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;

// === РАСШИРЕННАЯ ЭКОНОМИКА ===

// Типы предметов
export const items = pgTable("items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description").notNull(),
  price: integer("price").notNull(),
  category: text("category").notNull(), // role, booster, badge, title, banner, collectible
  rarity: text("rarity").notNull().default("common"), // common, rare, epic, legendary
  itemData: jsonb("item_data"), // Дополнительные данные (roleId, multiplier, duration и т.д.)
  imageUrl: text("image_url"),
  stock: integer("stock").default(-1), // -1 = безлимит
  isAvailable: boolean("is_available").default(true).notNull(),
  isPurchasable: boolean("is_purchasable").default(true).notNull(),
  isGiftable: boolean("is_giftable").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Инвентарь пользователей
export const userInventory = pgTable("user_inventory", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  memberId: varchar("member_id").notNull().references(() => clanMembers.id, { onDelete: "cascade" }),
  itemId: varchar("item_id").notNull().references(() => items.id),
  quantity: integer("quantity").default(1).notNull(),
  isEquipped: boolean("is_equipped").default(false).notNull(),
  acquiredAt: timestamp("acquired_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at"), // Для временных предметов
});

// Достижения
export const achievements = pgTable("achievements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description").notNull(),
  icon: text("icon"),
  category: text("category").notNull().default("general"), // general, activity, economy, social
  requirement: jsonb("requirement").notNull(), // { type: "messages", count: 100 }
  reward: jsonb("reward"), // { coins: 100, items: [...] }
  isSecret: boolean("is_secret").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Достижения пользователей
export const userAchievements = pgTable("user_achievements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  memberId: varchar("member_id").notNull().references(() => clanMembers.id, { onDelete: "cascade" }),
  achievementId: varchar("achievement_id").notNull().references(() => achievements.id),
  progress: integer("progress").default(0).notNull(),
  isCompleted: boolean("is_completed").default(false).notNull(),
  completedAt: timestamp("completed_at"),
  unlockedAt: timestamp("unlocked_at").defaultNow().notNull(),
});

// Ежедневные награды
export const dailyRewards = pgTable("daily_rewards", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  memberId: varchar("member_id").notNull().references(() => clanMembers.id, { onDelete: "cascade" }),
  lastClaimDate: timestamp("last_claim_date").defaultNow().notNull(),
  streakDays: integer("streak_days").default(1).notNull(),
  totalClaims: integer("total_claims").default(1).notNull(),
});

// Квесты
export const quests = pgTable("quests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description").notNull(),
  questType: text("quest_type").notNull().default("daily"), // daily, weekly, special
  requirements: jsonb("requirements").notNull(), // [{ type: "messages", count: 10 }]
  rewards: jsonb("rewards").notNull(), // { coins: 50, items: [...] }
  isActive: boolean("is_active").default(true).notNull(),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Прогресс квестов пользователей
export const userQuests = pgTable("user_quests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  memberId: varchar("member_id").notNull().references(() => clanMembers.id, { onDelete: "cascade" }),
  questId: varchar("quest_id").notNull().references(() => quests.id),
  progress: jsonb("progress").notNull().default({}), // { messages: 5, voice_minutes: 10 }
  isCompleted: boolean("is_completed").default(false).notNull(),
  completedAt: timestamp("completed_at"),
  claimedAt: timestamp("claimed_at"),
  startedAt: timestamp("started_at").defaultNow().notNull(),
});

// P2P торговля
export const trades = pgTable("trades", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fromMemberId: varchar("from_member_id").notNull().references(() => clanMembers.id),
  toMemberId: varchar("to_member_id").notNull().references(() => clanMembers.id),
  offerItems: jsonb("offer_items").notNull(), // [{ itemId, quantity }]
  offerCoins: integer("offer_coins").default(0).notNull(),
  requestItems: jsonb("request_items").notNull(),
  requestCoins: integer("request_coins").default(0).notNull(),
  status: text("status").notNull().default("pending"), // pending, accepted, rejected, cancelled
  message: text("message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Активные эффекты бустеров
export const activeBoosts = pgTable("active_boosts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  memberId: varchar("member_id").notNull().references(() => clanMembers.id, { onDelete: "cascade" }),
  itemId: varchar("item_id").notNull().references(() => items.id),
  boostType: text("boost_type").notNull(), // exp, coins, luck
  multiplier: real("multiplier").notNull().default(1.5),
  activatedAt: timestamp("activated_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
});

// Схемы для вставки
export const insertItemSchema = createInsertSchema(items).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUserInventorySchema = createInsertSchema(userInventory).omit({
  id: true,
  acquiredAt: true,
});

export const insertAchievementSchema = createInsertSchema(achievements).omit({
  id: true,
  createdAt: true,
});

export const insertUserAchievementSchema = createInsertSchema(userAchievements).omit({
  id: true,
  unlockedAt: true,
});

export const insertDailyRewardSchema = createInsertSchema(dailyRewards).omit({
  id: true,
});

export const insertQuestSchema = createInsertSchema(quests).omit({
  id: true,
  createdAt: true,
});

export const insertUserQuestSchema = createInsertSchema(userQuests).omit({
  id: true,
  startedAt: true,
});

export const insertTradeSchema = createInsertSchema(trades).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertActiveBoostSchema = createInsertSchema(activeBoosts).omit({
  id: true,
  activatedAt: true,
});

// Типы
export type Item = typeof items.$inferSelect;
export type InsertItem = z.infer<typeof insertItemSchema>;

export type UserInventory = typeof userInventory.$inferSelect;
export type InsertUserInventory = z.infer<typeof insertUserInventorySchema>;

export type Achievement = typeof achievements.$inferSelect;
export type InsertAchievement = z.infer<typeof insertAchievementSchema>;

export type UserAchievement = typeof userAchievements.$inferSelect;
export type InsertUserAchievement = z.infer<typeof insertUserAchievementSchema>;

export type DailyReward = typeof dailyRewards.$inferSelect;
export type InsertDailyReward = z.infer<typeof insertDailyRewardSchema>;

export type Quest = typeof quests.$inferSelect;
export type InsertQuest = z.infer<typeof insertQuestSchema>;

export type UserQuest = typeof userQuests.$inferSelect;
export type InsertUserQuest = z.infer<typeof insertUserQuestSchema>;

export type Trade = typeof trades.$inferSelect;
export type InsertTrade = z.infer<typeof insertTradeSchema>;

export type ActiveBoost = typeof activeBoosts.$inferSelect;
export type InsertActiveBoost = z.infer<typeof insertActiveBoostSchema>;

// Настройки конвертации Robux
export const robuxConversionSettings = pgTable("robux_conversion_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  exchangeRate: integer("exchange_rate").notNull().default(1000), // Сколько LumiCoin = 1 Robux (например, 1000 LC = 1 Robux)
  minAmount: integer("min_amount").notNull().default(1000), // Минимальная сумма LumiCoin для конвертации
  maxAmount: integer("max_amount").notNull().default(100000), // Максимальная сумма LumiCoin для конвертации
  isEnabled: boolean("is_enabled").default(true).notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Запросы на конвертацию Robux
export const robuxConversionRequests = pgTable("robux_conversion_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  memberId: varchar("member_id").notNull().references(() => clanMembers.id, { onDelete: "cascade" }),
  discordId: text("discord_id").notNull(),
  username: text("username").notNull(),
  robloxUsername: text("roblox_username").notNull(), // Roblox имя пользователя для перевода
  lumiCoinAmount: integer("lumi_coin_amount").notNull(),
  robuxAmount: integer("robux_amount").notNull(),
  status: text("status").notNull().default("pending"), // pending, approved, rejected, completed
  adminNote: text("admin_note"), // Заметка администратора
  createdAt: timestamp("created_at").defaultNow().notNull(),
  processedAt: timestamp("processed_at"),
  processedBy: varchar("processed_by"), // ID админа который обработал
});

// Схемы для вставки
export const insertRobuxConversionSettingsSchema = createInsertSchema(robuxConversionSettings).omit({
  id: true,
  updatedAt: true,
});

export const insertRobuxConversionRequestSchema = createInsertSchema(robuxConversionRequests).omit({
  id: true,
  createdAt: true,
});

// Типы
export type RobuxConversionSettings = typeof robuxConversionSettings.$inferSelect;
export type InsertRobuxConversionSettings = z.infer<typeof insertRobuxConversionSettingsSchema>;

export type RobuxConversionRequest = typeof robuxConversionRequests.$inferSelect;
export type InsertRobuxConversionRequest = z.infer<typeof insertRobuxConversionRequestSchema>;

// Управление доступностью страниц
export const pageAvailability = pgTable("page_availability", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  pageId: text("page_id").notNull().unique(), // Идентификатор страницы (convert, forum, shop, etc.)
  pageName: text("page_name").notNull(), // Отображаемое имя страницы
  isEnabled: boolean("is_enabled").default(true).notNull(), // Доступна ли страница
  maintenanceTitleRu: text("maintenance_title_ru"), // Заголовок на русском для экрана обслуживания
  maintenanceTitleEn: text("maintenance_title_en"), // Заголовок на английском
  maintenanceMessageRu: text("maintenance_message_ru"), // Сообщение на русском
  maintenanceMessageEn: text("maintenance_message_en"), // Сообщение на английском
  updatedBy: text("updated_by"), // Кто последний изменил
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertPageAvailabilitySchema = createInsertSchema(pageAvailability).omit({
  id: true,
  updatedAt: true,
});

export type PageAvailability = typeof pageAvailability.$inferSelect;
export type InsertPageAvailability = z.infer<typeof insertPageAvailabilitySchema>;

// Система банов на сайте
export const siteBans = pgTable("site_bans", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  memberId: varchar("member_id").references(() => clanMembers.id, { onDelete: "cascade" }),
  discordId: text("discord_id").notNull(),
  username: text("username").notNull(),
  reason: text("reason").notNull(),
  bannedBy: varchar("banned_by").notNull(), // ID админа
  bannedByUsername: text("banned_by_username").notNull(),
  expiresAt: timestamp("expires_at"), // null = permanent ban
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertSiteBanSchema = createInsertSchema(siteBans).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  memberId: true,
  isActive: true,
}).extend({
  expiresAt: z.string().nullable().optional().transform((val) => {
    if (!val) return null;
    return new Date(val);
  }),
});

export type SiteBan = typeof siteBans.$inferSelect;
export type InsertSiteBan = z.infer<typeof insertSiteBanSchema>;

// Видеоплатформа - Каналы
export const channels = pgTable("channels", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  handle: text("handle").notNull().unique(), // @channelname
  avatarUrl: text("avatar_url"),
  bannerUrl: text("banner_url"),
  ownerId: text("owner_id").notNull(), // Discord ID владельца
  ownerUsername: text("owner_username").notNull(),
  ownerAvatar: text("owner_avatar"),
  subscriberCount: integer("subscriber_count").default(0).notNull(),
  videoCount: integer("video_count").default(0).notNull(),
  totalViews: integer("total_views").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Видеоплатформа - Видео
export const videos = pgTable("videos", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  channelId: varchar("channel_id").notNull().references(() => channels.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  fileName: text("file_name").notNull(), // имя файла на диске
  filePath: text("file_path").notNull(), // полный путь к файлу
  thumbnailPath: text("thumbnail_path"), // путь к превью
  duration: integer("duration"), // длительность в секундах
  fileSize: integer("file_size").notNull(), // размер файла в байтах
  views: integer("views").default(0).notNull(),
  uploadedBy: varchar("uploaded_by").notNull(), // Discord ID пользователя (дублируем для удобства)
  uploadedByUsername: text("uploaded_by_username").notNull(),
  uploadedByAvatar: text("uploaded_by_avatar"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const videoLikes = pgTable("video_likes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  videoId: varchar("video_id").notNull().references(() => videos.id, { onDelete: "cascade" }),
  discordId: text("discord_id").notNull(), // Discord ID пользователя
  username: text("username").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const videoComments = pgTable("video_comments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  videoId: varchar("video_id").notNull().references(() => videos.id, { onDelete: "cascade" }),
  discordId: text("discord_id").notNull(), // Discord ID пользователя
  username: text("username").notNull(),
  avatar: text("avatar"),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Подписки на каналы
export const channelSubscriptions = pgTable("channel_subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  channelId: varchar("channel_id").notNull().references(() => channels.id, { onDelete: "cascade" }),
  subscriberId: text("subscriber_id").notNull(), // Discord ID подписчика
  subscriberUsername: text("subscriber_username").notNull(),
  subscriberAvatar: text("subscriber_avatar"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Schemas для каналов
export const insertChannelSchema = createInsertSchema(channels).omit({
  id: true,
  subscriberCount: true,
  videoCount: true,
  totalViews: true,
  createdAt: true,
  updatedAt: true,
});

export const insertChannelSubscriptionSchema = createInsertSchema(channelSubscriptions).omit({
  id: true,
  createdAt: true,
});

export const insertVideoSchema = createInsertSchema(videos).omit({
  id: true,
  views: true,
  createdAt: true,
  updatedAt: true,
});

export const insertVideoLikeSchema = createInsertSchema(videoLikes).omit({
  id: true,
  createdAt: true,
});

export const insertVideoCommentSchema = createInsertSchema(videoComments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types
export type Channel = typeof channels.$inferSelect;
export type InsertChannel = z.infer<typeof insertChannelSchema>;
export type ChannelSubscription = typeof channelSubscriptions.$inferSelect;
export type InsertChannelSubscription = z.infer<typeof insertChannelSubscriptionSchema>;
export type Video = typeof videos.$inferSelect;
export type InsertVideo = z.infer<typeof insertVideoSchema>;
export type VideoLike = typeof videoLikes.$inferSelect;
export type InsertVideoLike = z.infer<typeof insertVideoLikeSchema>;
export type VideoComment = typeof videoComments.$inferSelect;
export type InsertVideoComment = z.infer<typeof insertVideoCommentSchema>;

// Админы видеоплатформы
export const videoPlatformAdmins = pgTable("video_platform_admins", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  discordId: varchar("discord_id").notNull().unique(),
  username: varchar("username").notNull(),
  avatar: varchar("avatar"),
  role: varchar("role").notNull().default("admin"),
  addedBy: varchar("added_by").notNull(),
  addedByUsername: varchar("added_by_username").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertVideoPlatformAdminSchema = createInsertSchema(videoPlatformAdmins).omit({
  id: true,
  createdAt: true,
});

export type VideoPlatformAdmin = typeof videoPlatformAdmins.$inferSelect;
export type InsertVideoPlatformAdmin = z.infer<typeof insertVideoPlatformAdminSchema>;

// Discord Profile Decorations (значки, рамки аватаров, эффекты профиля, баннеры)
export const profileDecorations = pgTable("profile_decorations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description").notNull(),
  type: text("type").notNull().default("badge"), // badge, avatar_frame, profile_effect, banner, name_color
  emoji: text("emoji"), // эмодзи/символ для отображения рядом с ником
  imageUrl: text("image_url"), // URL картинки декорации
  cssEffect: text("css_effect"), // CSS для анимаций/эффектов
  color: text("color"), // Цвет для name_color типа
  rarity: text("rarity").notNull().default("common"), // common, uncommon, rare, epic, legendary
  price: integer("price").notNull().default(100), // Цена в LumiCoin
  category: text("category").notNull().default("general"), // general, seasonal, limited, exclusive
  isAvailable: boolean("is_available").default(true).notNull(),
  maxOwners: integer("max_owners").default(-1), // -1 = неограничено
  currentOwners: integer("current_owners").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Купленные/назначенные декорации участников
export const memberDecorations = pgTable("member_decorations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  memberId: varchar("member_id").notNull().references(() => clanMembers.id, { onDelete: "cascade" }),
  decorationId: varchar("decoration_id").notNull().references(() => profileDecorations.id, { onDelete: "cascade" }),
  discordId: text("discord_id").notNull(),
  isEquipped: boolean("is_equipped").default(false).notNull(),
  acquiredAt: timestamp("acquired_at").defaultNow().notNull(),
});

// История мини-игр
export const gameHistory = pgTable("game_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  discordId: text("discord_id").notNull(),
  game: text("game").notNull(),
  bet: integer("bet").notNull(),
  reward: integer("reward").notNull(),
  result: text("result").notNull(),
  playedAt: timestamp("played_at").defaultNow().notNull(),
});

export const insertProfileDecorationSchema = createInsertSchema(profileDecorations).omit({
  id: true,
  currentOwners: true,
  createdAt: true,
  updatedAt: true,
});

export const insertMemberDecorationSchema = createInsertSchema(memberDecorations).omit({
  id: true,
  acquiredAt: true,
});

export type ProfileDecoration = typeof profileDecorations.$inferSelect;
export type InsertProfileDecoration = z.infer<typeof insertProfileDecorationSchema>;
export type MemberDecoration = typeof memberDecorations.$inferSelect;
export type InsertMemberDecoration = z.infer<typeof insertMemberDecorationSchema>;
