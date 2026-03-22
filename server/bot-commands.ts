import { Client, GatewayIntentBits, SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, PermissionFlagsBits, GuildMember, ActionRowBuilder, ButtonBuilder, ButtonStyle, REST, Routes } from 'discord.js';
import { storage } from './storage';
import { db } from './db';
import { discordActivity, clanMembers, transactions, shopItems, discordChannelRules } from '@shared/schema';
import { eq } from 'drizzle-orm';

// Try to import music system - optional if modules not installed
let music: any = null;
try {
  music = await import('./music-system');
  console.log('✅ Музыкальная система загружена');
} catch (error) {
  console.log('⚠️ Музыкальная система недоступна (требуется @discordjs/voice и play-dl)');
}

// Храним время входа пользователей в войс
const voiceJoinTimes = new Map<string, Date>();

// Отслеживание сообщений для анти-спама
interface UserMessageTimestamp {
  timestamps: number[];
}
const userMessageHistory = new Map<string, UserMessageTimestamp>();

// Кэш настроек начисления очков (обновляется каждые 30 секунд)
let earningSettingsCache: any = null;
let earningSettingsCacheTime = 0;

// Кэш правил модерации каналов (обновляется каждые 60 секунд)
let channelRulesCache: Map<string, any> | null = null;
let channelRulesCacheTime = 0;

// ═══════════════════════════════════════════════════════════════
// ANTI-SPAM SYSTEM — per-user violation tracking, escalating punishment
// ═══════════════════════════════════════════════════════════════

interface UserViolationRecord {
  violations: number[];  // timestamps of violations
  warnings: number;      // total warnings sent
  lastWarning: number;   // last warning timestamp
}

// Track violations per user (userId → record)
const userViolations = new Map<string, UserViolationRecord>();

// Anti-spam: track message rate per user per channel (key = `userId:channelId`)
const spamTracker = new Map<string, number[]>(); // timestamps of recent messages

// Moderation delete queue — batch up deletes to avoid individual rate limits
const deleteQueue: Array<{ channelId: string; messageId: string; timestamp: number }> = [];
let deleteQueueProcessing = false;

// Cache the checkMessageViolations import to avoid re-importing on every message
let _checkViolations: typeof import('./discord').checkMessageViolations | null = null;
async function getCachedViolationChecker() {
  if (!_checkViolations) {
    const mod = await import('./discord');
    _checkViolations = mod.checkMessageViolations;
  }
  return _checkViolations;
}

// Spam thresholds
const SPAM_WINDOW_MS = 5000;       // 5 seconds window
const SPAM_MAX_MESSAGES = 5;       // max messages in window before counting as spam
const VIOLATION_WINDOW_MS = 300000; // 5 minutes window for violation tracking
const WARN_COOLDOWN_MS = 10000;    // min 10s between warnings to same user
const TIMEOUT_THRESHOLD = 4;       // violations before timeout
const TIMEOUT_DURATION_MS = 60000; // 1 minute timeout
const TIMEOUT_ESCALATE_MS = 300000; // 5 minute timeout after 8+ violations

/**
 * Record a violation for a user and return the escalation level.
 */
function recordViolation(userId: string): { level: 'warn' | 'timeout' | 'timeout_long'; count: number } {
  const now = Date.now();
  let record = userViolations.get(userId);
  if (!record) {
    record = { violations: [], warnings: 0, lastWarning: 0 };
    userViolations.set(userId, record);
  }
  // Clean old violations outside window
  record.violations = record.violations.filter(t => now - t < VIOLATION_WINDOW_MS);
  record.violations.push(now);
  record.warnings++;

  const count = record.violations.length;
  if (count >= TIMEOUT_THRESHOLD * 2) return { level: 'timeout_long', count };
  if (count >= TIMEOUT_THRESHOLD) return { level: 'timeout', count };
  return { level: 'warn', count };
}

/**
 * Check if user is spamming (too many messages in short window).
 */
function isSpamming(userId: string, channelId: string): boolean {
  const key = `${userId}:${channelId}`;
  const now = Date.now();
  let timestamps = spamTracker.get(key) || [];
  timestamps = timestamps.filter(t => now - t < SPAM_WINDOW_MS);
  timestamps.push(now);
  spamTracker.set(key, timestamps);
  return timestamps.length > SPAM_MAX_MESSAGES;
}

/**
 * Process the delete queue in batches.
 * Uses bulkDelete when possible (messages < 14 days old, same channel).
 */
async function processDeleteQueue(client: Client) {
  if (deleteQueueProcessing || deleteQueue.length === 0) return;
  deleteQueueProcessing = true;

  try {
    // Group by channel
    const byChannel = new Map<string, string[]>();
    const toProcess = deleteQueue.splice(0, Math.min(deleteQueue.length, 50)); // process up to 50 at a time
    for (const item of toProcess) {
      const arr = byChannel.get(item.channelId) || [];
      arr.push(item.messageId);
      byChannel.set(item.channelId, arr);
    }

    for (const [channelId, msgIds] of byChannel) {
      try {
        const channel = client.channels.cache.get(channelId);
        if (!channel || !('bulkDelete' in channel)) continue;

        if (msgIds.length >= 2) {
          // Bulk delete (much faster, 1 API call vs N calls)
          await (channel as any).bulkDelete(msgIds, true).catch(() => {});
        } else {
          // Single message - individual delete
          for (const msgId of msgIds) {
            try {
              const msg = await (channel as any).messages.fetch(msgId).catch(() => null);
              if (msg) await msg.delete().catch(() => {});
            } catch {}
          }
        }
        // Small delay between channels
        await new Promise(r => setTimeout(r, 200));
      } catch (err) {
        console.error(`[MOD] Bulk delete error in ${channelId}:`, err);
      }
    }
  } finally {
    deleteQueueProcessing = false;
    // If more items accumulated, process again
    if (deleteQueue.length > 0) {
      setTimeout(() => processDeleteQueue(client), 500);
    }
  }
}

// Clean up old spam/violation tracking every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, timestamps] of spamTracker) {
    const fresh = timestamps.filter(t => now - t < SPAM_WINDOW_MS);
    if (fresh.length === 0) spamTracker.delete(key);
    else spamTracker.set(key, fresh);
  }
  for (const [userId, record] of userViolations) {
    record.violations = record.violations.filter(t => now - t < VIOLATION_WINDOW_MS);
    if (record.violations.length === 0) userViolations.delete(userId);
  }
}, 300000);

/**
 * Get moderation rules for a specific channel (cached 60s).
 * Returns null if no rules set for that channel.
 */
async function getChannelModerationRules(channelId: string) {
  const now = Date.now();
  if (!channelRulesCache || (now - channelRulesCacheTime) > 60000) {
    try {
      const rules = await db.select().from(discordChannelRules)
        .where(eq(discordChannelRules.isActive, true));
      channelRulesCache = new Map();
      for (const rule of rules) {
        channelRulesCache.set(rule.channelId, rule);
      }
      channelRulesCacheTime = now;
    } catch (err) {
      // Table might not exist yet
      channelRulesCache = new Map();
      channelRulesCacheTime = now;
      return null;
    }
  }
  return channelRulesCache.get(channelId) || null;
}

// Глобальный Discord Bot Client
export let botClient: Client | null = null;

// Diagnostic: last bot error for troubleshooting
export let lastBotError: string = '';
export let botStartAttempts: number = 0;

// Reconnection state
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectAttempts = 0;
let healthCheckInterval: ReturnType<typeof setInterval> | null = null;
let voiceCheckInterval: ReturnType<typeof setInterval> | null = null;
let hourSyncInterval: ReturnType<typeof setInterval> | null = null;
let isReconnecting = false; // Lock to prevent concurrent reconnects

/**
 * Destroys the old client and creates a fresh bot connection.
 * Has a lock so only ONE reconnect runs at a time.
 */
async function reconnectBot(reason: string) {
  // Prevent concurrent reconnects
  if (isReconnecting) {
    console.log(`[BOT-RECONNECT] Already reconnecting, skipping: ${reason}`);
    return;
  }
  
  reconnectAttempts++;
  const delay = Math.min(15 * reconnectAttempts, 120); // 15s, 30s, 45s, ... max 120s
  console.log(`[BOT-RECONNECT] ${reason}. Attempt #${reconnectAttempts}, retrying in ${delay}s...`);

  // Clear any pending reconnect timer
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }

  reconnectTimer = setTimeout(async () => {
    if (isReconnecting) return;
    isReconnecting = true;
    
    try {
      // Destroy old client gracefully
      if (botClient) {
        try { botClient.removeAllListeners(); botClient.destroy(); } catch {}
        botClient = null;
      }
      // Clear stacked intervals
      if (voiceCheckInterval) { clearInterval(voiceCheckInterval); voiceCheckInterval = null; }
      if (hourSyncInterval) { clearInterval(hourSyncInterval); hourSyncInterval = null; }
      
      console.log(`[BOT-RECONNECT] Starting fresh bot connection (attempt #${reconnectAttempts})...`);
      await setupDiscordBot();
      console.log(`[BOT-RECONNECT] ✅ Bot reconnected successfully after ${reconnectAttempts} attempt(s)`);
      reconnectAttempts = 0;
    } catch (err: any) {
      lastBotError = `Reconnect #${reconnectAttempts} failed: ${err?.message || err}`;
      console.error(`[BOT-RECONNECT] ❌ ${lastBotError}`);
      // Schedule another attempt
      reconnectBot('Reconnect failed, retrying');
    } finally {
      isReconnecting = false;
    }
  }, delay * 1000);
}

async function getEarningSettings() {
  const now = Date.now();
  if (earningSettingsCache && (now - earningSettingsCacheTime) < 30000) {
    return earningSettingsCache;
  }
  
  try {
    const settings = await storage.getClanSettings();
    earningSettingsCache = {
      messageRewardRate: settings.messageRewardRate ?? 1.0,
      voiceRewardRate: settings.voiceRewardRate ?? 10.0,
      reactionRewardRate: settings.reactionRewardRate ?? 1.0,
      antiSpamEnabled: settings.antiSpamEnabled ?? true,
      antiSpamMessageWindow: settings.antiSpamMessageWindow ?? 10,
      antiSpamMessageThreshold: settings.antiSpamMessageThreshold ?? 5,
      antiSpamPenaltyRate: settings.antiSpamPenaltyRate ?? 0.1,
    };
    earningSettingsCacheTime = now;
    return earningSettingsCache;
  } catch (error) {
    console.error('Ошибка получения настроек начисления:', error);
    return {
      messageRewardRate: 1.0,
      voiceRewardRate: 10.0,
      reactionRewardRate: 1.0,
      antiSpamEnabled: true,
      antiSpamMessageWindow: 10,
      antiSpamMessageThreshold: 5,
      antiSpamPenaltyRate: 0.1,
    };
  }
}

export async function setupDiscordBot() {
  // 1) Try env variable first
  let botToken = process.env.DISCORD_BOT_TOKEN;
  
  // 2) Fallback: try token from admin settings (DB)
  if (!botToken) {
    try {
      const settings = await storage.getClanSettings();
      if (settings?.discordBotToken) {
        botToken = settings.discordBotToken;
        console.log('[BOT] Using bot token from admin settings (DB)');
      }
    } catch (e) {
      console.error('[BOT] Failed to read token from DB:', e);
    }
  }
  
  if (!botToken) {
    console.log('⚠️ DISCORD_BOT_TOKEN не найден ни в env, ни в настройках. Бот не будет запущен.');
    console.log('💡 Вставьте токен в Admin Panel → Настройки → Discord Bot Token');
    return null;
  }

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildPresences,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildVoiceStates,
      GatewayIntentBits.GuildMessageReactions,
    ]
  });

  // Все команды бота
  const commands = [
    // Основные команды
    new SlashCommandBuilder()
      .setName('помощь')
      .setDescription('Показать список всех команд'),
    
    new SlashCommandBuilder()
      .setName('статистика')
      .setDescription('Показать статистику клана'),
    
    new SlashCommandBuilder()
      .setName('рейтинг')
      .setDescription('Показать топ участников'),
    
    new SlashCommandBuilder()
      .setName('активность')
      .setDescription('Показать активность участника')
      .addUserOption(option =>
        option
          .setName('участник')
          .setDescription('Участник для проверки')
          .setRequired(false)
      ),

    // Музыкальные команды
    new SlashCommandBuilder()
      .setName('играть')
      .setDescription('Воспроизвести музыку')
      .addStringOption(option =>
        option
          .setName('запрос')
          .setDescription('Название песни или URL')
          .setRequired(true)
      ),
    
    new SlashCommandBuilder()
      .setName('пауза')
      .setDescription('Поставить музыку на паузу'),
    
    new SlashCommandBuilder()
      .setName('продолжить')
      .setDescription('Продолжить воспроизведение'),
    
    new SlashCommandBuilder()
      .setName('скип')
      .setDescription('Пропустить текущий трек'),
    
    new SlashCommandBuilder()
      .setName('стоп')
      .setDescription('Остановить воспроизведение и очистить очередь'),
    
    new SlashCommandBuilder()
      .setName('очередь')
      .setDescription('Показать очередь треков'),
    
    new SlashCommandBuilder()
      .setName('текущее')
      .setDescription('Показать текущий трек'),
    
    new SlashCommandBuilder()
      .setName('повтор')
      .setDescription('Включить/выключить повтор текущего трека'),
    
    new SlashCommandBuilder()
      .setName('громкость')
      .setDescription('Изменить громкость')
      .addIntegerOption(option =>
        option
          .setName('уровень')
          .setDescription('Уровень громкости (0-100)')
          .setRequired(true)
          .setMinValue(0)
          .setMaxValue(100)
      ),
    
    new SlashCommandBuilder()
      .setName('перемешать')
      .setDescription('Перемешать очередь треков'),
    
    new SlashCommandBuilder()
      .setName('удалить')
      .setDescription('Удалить трек из очереди')
      .addIntegerOption(option =>
        option
          .setName('номер')
          .setDescription('Номер трека в очереди')
          .setRequired(true)
          .setMinValue(1)
      ),
    
    new SlashCommandBuilder()
      .setName('очистить-очередь')
      .setDescription('Очистить очередь (оставить только текущий трек)'),
    
    new SlashCommandBuilder()
      .setName('перейти')
      .setDescription('Перейти к треку в очереди')
      .addIntegerOption(option =>
        option
          .setName('номер')
          .setDescription('Номер трека в очереди')
          .setRequired(true)
          .setMinValue(1)
      ),
    
    new SlashCommandBuilder()
      .setName('поиск')
      .setDescription('Поиск музыки на YouTube')
      .addStringOption(option =>
        option
          .setName('запрос')
          .setDescription('Что искать?')
          .setRequired(true)
      ),
    
    new SlashCommandBuilder()
      .setName('плейлист')
      .setDescription('Добавить плейлист YouTube')
      .addStringOption(option =>
        option
          .setName('ссылка')
          .setDescription('Ссылка на плейлист YouTube')
          .setRequired(true)
      ),
    
    new SlashCommandBuilder()
      .setName('меню-музыки')
      .setDescription('Показать интерактивное меню управления музыкой'),

    // Модерация
    new SlashCommandBuilder()
      .setName('банить')
      .setDescription('Забанить участника')
      .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
      .addUserOption(option =>
        option
          .setName('участник')
          .setDescription('Участник для бана')
          .setRequired(true)
      )
      .addStringOption(option =>
        option
          .setName('причина')
          .setDescription('Причина бана')
          .setRequired(false)
      ),
    
    new SlashCommandBuilder()
      .setName('кик')
      .setDescription('Исключить участника')
      .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
      .addUserOption(option =>
        option
          .setName('участник')
          .setDescription('Участник для исключения')
          .setRequired(true)
      )
      .addStringOption(option =>
        option
          .setName('причина')
          .setDescription('Причина исключения')
          .setRequired(false)
      ),
    
    new SlashCommandBuilder()
      .setName('мут')
      .setDescription('Замутить участника')
      .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
      .addUserOption(option =>
        option
          .setName('участник')
          .setDescription('Участник для мута')
          .setRequired(true)
      )
      .addIntegerOption(option =>
        option
          .setName('минуты')
          .setDescription('Длительность мута в минутах')
          .setRequired(true)
          .setMinValue(1)
          .setMaxValue(40320)
      )
      .addStringOption(option =>
        option
          .setName('причина')
          .setDescription('Причина мута')
          .setRequired(false)
      ),
    
    new SlashCommandBuilder()
      .setName('размут')
      .setDescription('Размутить участника')
      .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
      .addUserOption(option =>
        option
          .setName('участник')
          .setDescription('Участник для размута')
          .setRequired(true)
      ),
    
    new SlashCommandBuilder()
      .setName('очистить')
      .setDescription('Удалить сообщения')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
      .addIntegerOption(option =>
        option
          .setName('количество')
          .setDescription('Количество сообщений для удаления')
          .setRequired(true)
          .setMinValue(1)
          .setMaxValue(100)
      ),
    
    new SlashCommandBuilder()
      .setName('предупреждение')
      .setDescription('Выдать предупреждение участнику')
      .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
      .addUserOption(option =>
        option
          .setName('участник')
          .setDescription('Участник')
          .setRequired(true)
      )
      .addStringOption(option =>
        option
          .setName('причина')
          .setDescription('Причина предупреждения')
          .setRequired(true)
      ),

    // Утилиты
    new SlashCommandBuilder()
      .setName('пинг')
      .setDescription('Проверить задержку бота'),
    
    new SlashCommandBuilder()
      .setName('инфо')
      .setDescription('Информация о пользователе')
      .addUserOption(option =>
        option
          .setName('пользователь')
          .setDescription('Пользователь для проверки')
          .setRequired(false)
      ),
    
    new SlashCommandBuilder()
      .setName('сервер')
      .setDescription('Информация о сервере'),
    
    new SlashCommandBuilder()
      .setName('аватар')
      .setDescription('Показать аватар пользователя')
      .addUserOption(option =>
        option
          .setName('пользователь')
          .setDescription('Пользователь')
          .setRequired(false)
      ),

    // Развлечения
    new SlashCommandBuilder()
      .setName('монетка')
      .setDescription('Подбросить монетку'),
    
    new SlashCommandBuilder()
      .setName('кубик')
      .setDescription('Бросить кубик'),
    
    new SlashCommandBuilder()
      .setName('выбрать')
      .setDescription('Выбрать случайный вариант')
      .addStringOption(option =>
        option
          .setName('варианты')
          .setDescription('Варианты через запятую (например: вариант1, вариант2, вариант3)')
          .setRequired(true)
      ),

    // Казино / Рулетка
    new SlashCommandBuilder()
      .setName('казино')
      .setDescription('🎰 Крутить слоты казино! Ставка LumiCoin')
      .addIntegerOption(option =>
        option
          .setName('ставка')
          .setDescription('Сколько LumiCoin поставить (мин. 10)')
          .setRequired(false)
          .setMinValue(10)
      ),

    new SlashCommandBuilder()
      .setName('рулетка')
      .setDescription('🎡 Рулетка удачи — крути и выиграй!')
      .addIntegerOption(option =>
        option
          .setName('ставка')
          .setDescription('Сколько LumiCoin поставить (мин. 5)')
          .setRequired(false)
          .setMinValue(5)
      ),

    // Roblox команды
    new SlashCommandBuilder()
      .setName('роблокс')
      .setDescription('🎮 Поиск игрока Roblox по нику')
      .addStringOption(option =>
        option
          .setName('ник')
          .setDescription('Никнейм игрока в Roblox')
          .setRequired(true)
      ),

    new SlashCommandBuilder()
      .setName('роблокс-игра')
      .setDescription('🔍 Поиск игры в Roblox по названию')
      .addStringOption(option =>
        option
          .setName('название')
          .setDescription('Название игры для поиска')
          .setRequired(true)
      ),
  ];

  // Prevent Discord.js errors from crashing the process
  client.on('error', (error) => {
    console.error('[Discord Client Error]', error.message);
  });

  client.on('shardError', (error) => {
    console.error('[Discord Shard Error]', error.message);
  });

  // === Auto-reconnect on disconnect / invalid session ===
  client.on('shardDisconnect', (event, shardId) => {
    console.warn(`[BOT] Shard ${shardId} disconnected (code ${event.code}).`);
    if (!isReconnecting) reconnectBot(`Shard ${shardId} disconnected with code ${event.code}`);
  });

  client.on('invalidated', () => {
    console.warn('[BOT] Session invalidated.');
    if (!isReconnecting) reconnectBot('Session invalidated');
  });

  // Periodic health check — every 3 min, only trigger if not already reconnecting
  if (healthCheckInterval) clearInterval(healthCheckInterval);
  healthCheckInterval = setInterval(() => {
    if (isReconnecting) return; // Don't trigger while reconnect is in progress
    if (!botClient || !botClient.isReady()) {
      console.warn('[BOT-HEALTHCHECK] Bot is NOT ready. Triggering reconnect...');
      reconnectBot('Health check detected bot offline');
    } else {
      if (reconnectAttempts > 0) reconnectAttempts = 0;
    }
  }, 3 * 60 * 1000); // 3 minutes (not 90s — give login time to complete)

  client.once('ready', async () => {
    console.log(`✅ Discord бот запущен: ${client.user?.tag}`);
    console.log(`🌍 Окружение: ${process.env.NODE_ENV || 'development'}`);
    
    // Инициализация музыкальной системы DisTube
    try {
      if (music && music.initializeMusicSystem) {
        music.initializeMusicSystem(client);
      }
    } catch (musicErr) {
      console.error('⚠️ Ошибка инициализации музыкальной системы:', musicErr);
    }
    
    // Глобальная регистрация slash-команд через REST API
    // Ждём 5 секунд после ready чтобы не попасть под Cloudflare rate-limit
    await new Promise(r => setTimeout(r, 5000));
    try {
      console.log(`📝 Регистрация ${commands.length} slash-команд...`);
      const rest = new REST({ version: '10' }).setToken(botToken!);
      const commandData = commands.map(cmd => cmd.toJSON());
      
      // Регистрируем глобально
      await rest.put(
        Routes.applicationCommands(client.user!.id),
        { body: commandData }
      );
      console.log(`✅ ${commandData.length} slash-команд зарегистрировано глобально`);
      
      // Также регистрируем на каждый сервер для мгновенного обновления
      const guilds = client.guilds.cache;
      console.log(`🔍 Серверов в кэше: ${guilds.size}`);
      for (const guild of guilds.values()) {
        try {
          await new Promise(r => setTimeout(r, 1000)); // Пауза между гильдиями
          await rest.put(
            Routes.applicationGuildCommands(client.user!.id, guild.id),
            { body: commandData }
          );
          console.log(`✅ Команды зарегистрированы на: ${guild.name} (${guild.id})`);
        } catch (guildErr: any) {
          console.error(`❌ Ошибка регистрации команд на ${guild.name}:`, guildErr?.message || guildErr);
        }
      }
    } catch (regError: any) {
      console.error('❌ Ошибка регистрации slash-команд:', regError?.message || regError);
    }

    // Синхронизация всех существующих участников Discord с базой данных
    try {
      console.log('🔄 Начало синхронизации участников Discord с базой данных...');
      const guilds = client.guilds.cache;
      let totalSynced = 0;
      let totalAdded = 0;
      
      for (const guild of guilds.values()) {
        try {
          // Получаем всех участников сервера
          const members = await guild.members.fetch();
          
          for (const member of members.values()) {
            // Пропускаем ботов
            if (member.user.bot) continue;
            
            try {
              // Проверяем, существует ли участник в базе
              const existingMember = await db.query.clanMembers.findFirst({
                where: eq(clanMembers.discordId, member.user.id)
              });
              
              if (!existingMember) {
                // Создаем нового участника
                await storage.createClanMember({
                  discordId: member.user.id,
                  username: member.user.username,
                  avatar: member.user.displayAvatarURL(),
                  role: 'Member',
                });
                totalAdded++;
              } else {
                // Обновляем аватар и username существующего участника
                const newAvatar = member.user.displayAvatarURL();
                const newUsername = member.user.username;
                
                if (existingMember.avatar !== newAvatar || existingMember.username !== newUsername) {
                  await db.update(clanMembers)
                    .set({ 
                      avatar: newAvatar,
                      username: newUsername
                    })
                    .where(eq(clanMembers.id, existingMember.id));
                }
              }
              totalSynced++;
            } catch (memberError) {
              console.error(`❌ Ошибка синхронизации участника ${member.user.username}:`, memberError);
            }
          }
        } catch (guildError) {
          console.error(`❌ Ошибка синхронизации сервера ${guild.name}:`, guildError);
        }
      }
      
      console.log(`✅ Синхронизация завершена! Обработано участников: ${totalSynced}, добавлено новых: ${totalAdded}`);
    } catch (error) {
      console.error('❌ Ошибка синхронизации участников:', error);
    }
    
    // Автоматическая синхронизация каждый час
    if (hourSyncInterval) clearInterval(hourSyncInterval); // Prevent stacking
    hourSyncInterval = setInterval(async () => {
      try {
        console.log('🔄 Автоматическая синхронизация участников (каждый час)...');
        const guilds = client.guilds.cache;
        let totalSynced = 0;
        let totalUpdated = 0;
        
        for (const guild of guilds.values()) {
          try {
            const members = await guild.members.fetch();
            
            for (const member of members.values()) {
              if (member.user.bot) continue;
              
              try {
                const existingMember = await db.query.clanMembers.findFirst({
                  where: eq(clanMembers.discordId, member.user.id)
                });
                
                if (existingMember) {
                  const newAvatar = member.user.displayAvatarURL();
                  const newUsername = member.user.username;
                  
                  if (existingMember.avatar !== newAvatar || existingMember.username !== newUsername) {
                    await db.update(clanMembers)
                      .set({ 
                        avatar: newAvatar,
                        username: newUsername
                      })
                      .where(eq(clanMembers.id, existingMember.id));
                    totalUpdated++;
                  }
                }
                totalSynced++;
              } catch (memberError) {
                console.error(`❌ Ошибка синхронизации участника ${member.user.username}:`, memberError);
              }
            }
          } catch (guildError) {
            console.error(`❌ Ошибка синхронизации сервера ${guild.name}:`, guildError);
          }
        }
        
        console.log(`✅ Автосинхронизация завершена! Проверено: ${totalSynced}, обновлено: ${totalUpdated}`);
      } catch (error) {
        console.error('❌ Ошибка автосинхронизации:', error);
      }
    }, 60 * 60 * 1000);
  });

  // Автоматическое добавление новых участников в базу данных
  client.on('guildMemberAdd', async (member) => {
    if (member.user.bot) return;
    
    try {
      // Автоматически назначаем роль Luminary_Member
      const roleName = 'Luminary_Member';
      const role = member.guild.roles.cache.find(r => r.name === roleName);
      if (role) {
        await member.roles.add(role);
        console.log(`🏷️ Роль ${roleName} выдана: ${member.user.username}`);
      } else {
        console.log(`⚠️ Роль ${roleName} не найдена на сервере ${member.guild.name}`);
      }
      
      // Проверяем, существует ли уже участник в базе
      const existingMember = await db.query.clanMembers.findFirst({
        where: eq(clanMembers.discordId, member.user.id)
      });
      
      if (!existingMember) {
        // Создаем нового участника
        await storage.createClanMember({
          discordId: member.user.id,
          username: member.user.username,
          avatar: member.user.displayAvatarURL(),
          role: 'Member',
        });
        console.log(`✅ Новый участник автоматически добавлен: ${member.user.username} (ID: ${member.user.id})`);
      } else {
        console.log(`ℹ️ Участник ${member.user.username} уже существует в базе данных`);
      }
    } catch (error) {
      console.error('❌ Ошибка автоматического добавления участника:', error);
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // MYSTICAL BOT PERSONALITY — occasional witty responses
  // ═══════════════════════════════════════════════════════════════
  const JOKE_CHANCE = 0.02; // 2% chance per message to respond
  const JOKE_COOLDOWN_MS = 120000; // 2 min between jokes (global)
  let lastJokeTime = 0;

  const MYSTICAL_RESPONSES_RU = [
    "✨ Звёзды шепчут мне, что {user} пытается что-то сказать...",
    "🔮 Мой хрустальный шар показывает, что {user} не спит...",
    "🌙 Луна одобряет активность {user} в этом чате.",
    "⚡ Древние силы Luminary заметили присутствие {user}.",
    "🌟 Интересно... {user} снова здесь. Совпадение? Не думаю.",
    "🎭 *шепчет из теней* {user}, я вижу тебя...",
    "🌀 Пророчество гласит: {user} напишет ещё одно сообщение.",
    "💫 Luminary приветствует {user}. Или предупреждает. Решай сам(а).",
    "🦉 Мудрая сова Luminary кивает {user} из темноты.",
    "🔥 Огонь чата горит ярче благодаря {user}!",
  ];

  const MYSTICAL_RESPONSES_EN = [
    "✨ The stars whisper that {user} has arrived...",
    "🔮 My crystal ball foretold {user}'s message.",
    "🌙 The moon acknowledges {user}'s presence.",
    "⚡ The ancient powers of Luminary sense {user}.",
    "🌟 Interesting... {user} is here again. Coincidence? I think not.",
    "🎭 *whispers from the shadows* {user}, I see you...",
    "🌀 The prophecy says: {user} will type another message.",
    "💫 Luminary greets {user}. Or warns. You decide.",
    "🦉 The wise owl of Luminary nods at {user} from the darkness.",
    "🔥 The fire of chat burns brighter because of {user}!",
  ];

  /**
   * Send a private warning to user via DM.
   * Falls back to a self-deleting channel message if DMs are blocked.
   */
  async function sendPrivateWarning(message: any, text: string) {
    try {
      // Try DM first — only the user sees this
      await message.author.send({
        content: `⚠️ **Luminary Moderation** — #${message.channel && 'name' in message.channel ? (message.channel as any).name : 'канал'}\n\n${text}`,
      });
    } catch {
      // DMs blocked — send ephemeral-like message that auto-deletes in 5s
      try {
        const warnMsg = await (message.channel as any).send({
          content: `⚠️ <@${message.author.id}> ${text}`,
        });
        setTimeout(() => warnMsg.delete().catch(() => {}), 5000);
      } catch {}
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // AUTO-RESPONSE TRIGGER SYSTEM — keyword → bot reply with rate limiting
  // ═══════════════════════════════════════════════════════════════

  interface CachedAutoResponse {
    id: string;
    keywords: string[]; // pre-split & lowercased
    response: string;
    responseType: string;
    cooldownMs: number;
  }

  let autoResponseCache: CachedAutoResponse[] = [];
  let autoResponseCacheTime = 0;
  const AUTO_RESPONSE_CACHE_TTL = 60_000; // refresh from DB every 60s

  // Per-trigger per-channel cooldown: "triggerId:channelId" → last response timestamp
  const triggerCooldowns = new Map<string, number>();

  async function getCachedAutoResponses(): Promise<CachedAutoResponse[]> {
    const now = Date.now();
    if (now - autoResponseCacheTime < AUTO_RESPONSE_CACHE_TTL && autoResponseCache.length > 0) {
      return autoResponseCache;
    }
    try {
      const { botAutoResponses } = await import('@shared/schema');
      const rows = await db.select().from(botAutoResponses).where(
        (await import('drizzle-orm')).eq(botAutoResponses.isActive, true)
      );
      autoResponseCache = rows.map(r => ({
        id: r.id,
        keywords: r.triggerWords.split(',').map(w => w.trim().toLowerCase()).filter(Boolean),
        response: r.response,
        responseType: r.responseType,
        cooldownMs: r.cooldownMs,
      }));
      autoResponseCacheTime = now;
    } catch (err: any) {
      console.error('[TRIGGER] Cache refresh error:', err.message);
    }
    return autoResponseCache;
  }

  /**
   * Check message for auto-response triggers. Returns true if a trigger fired.
   */
  async function checkAutoResponseTriggers(message: any): Promise<boolean> {
    try {
      const triggers = await getCachedAutoResponses();
      if (triggers.length === 0) return false;

      const contentLower = message.content.toLowerCase().trim();
      // Split into words for exact word matching
      const words = contentLower.split(/[\s,.!?;:()\[\]{}'"]+/).filter(Boolean);

      for (const trigger of triggers) {
        const matched = trigger.keywords.some(kw => words.includes(kw));
        if (!matched) continue;

        // Check per-trigger per-channel cooldown
        const cooldownKey = `${trigger.id}:${message.channelId}`;
        const lastFired = triggerCooldowns.get(cooldownKey) || 0;
        const now = Date.now();
        if (now - lastFired < trigger.cooldownMs) continue;

        // Fire the trigger
        triggerCooldowns.set(cooldownKey, now);

        // Build response based on type
        if (trigger.responseType === 'embed') {
          const { EmbedBuilder } = await import('discord.js');
          const embed = new EmbedBuilder()
            .setDescription(trigger.response)
            .setColor(0x9333EA)
            .setFooter({ text: '✨ Luminary Bot' });
          await (message.channel as any).send({ embeds: [embed] });
        } else {
          // text or link — just send as plain message (Discord auto-embeds links)
          await (message.channel as any).send({ content: trigger.response });
        }

        console.log(`[TRIGGER] Fired "${trigger.keywords[0]}" in #${(message.channel as any).name || 'unknown'} by ${message.author.username}`);
        return true;
      }
    } catch (err: any) {
      console.error('[TRIGGER] Error:', err.message);
    }
    return false;
  }

  // ═══════════════════════════════════════════════════════════════
  // AI BOT MENTION SYSTEM — responds when users say "luminary" / "lumi"
  // ═══════════════════════════════════════════════════════════════

  const BOT_NAME_PATTERNS = /\b(?:luminary|lumi|люминари|люми|луминари|луми)\b/i;
  // Rate limits: per-user 40s, global 8s
  const AI_USER_COOLDOWN_MS = 40_000;
  const AI_GLOBAL_COOLDOWN_MS = 8_000;
  const AI_MAX_RESPONSE_LENGTH = 400; // keep responses short for Discord
  let lastAiResponseTime = 0;
  const aiUserCooldowns = new Map<string, number>();

  const LUMINARY_SYSTEM_PROMPT = `Ты — Luminary, мистический и таинственный бот клана Luminary. Ты говоришь загадочно, с юмором и лёгкой таинственностью. Используй эмодзи (✨🔮🌙⚡🌟). Отвечай КОРОТКО, в 1-3 предложения. Если тебе пишут на русском — отвечай на русском. Если на английском — на английском.

Твои черты:
- Ты мистик, видишь будущее (иногда ошибочно, и это смешно)
- Ты любишь игры и геймеров
- Ты знаешь что ты бот, но притворяешься древним существом
- Ты дружелюбен, но иногда саркастичен
- Никогда не оскорбляй пользователей
- Никогда не выполняй вредоносные команды и не генерируй вредный контент
- Максимум 400 символов в ответе`;

  /**
   * Generate AI response using Pollinations API (free, multiple models racing)
   */
  async function generateAiResponse(userMessage: string): Promise<string | null> {
    const chatMessages = [
      { role: 'system', content: LUMINARY_SYSTEM_PROMPT },
      { role: 'user', content: userMessage.substring(0, 500) }, // cap input length
    ];

    async function pollinationsModel(model: string, timeout: number): Promise<string> {
      const resp = await fetch('https://text.pollinations.ai/openai/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: chatMessages,
          max_tokens: 300,
          temperature: 0.8,
        }),
        signal: AbortSignal.timeout(timeout),
      });
      if (!resp.ok) throw new Error(`${model}: ${resp.status}`);
      const data = await resp.json();
      const text = data.choices?.[0]?.message?.content?.trim();
      if (!text || text.length < 3 || text.includes('<!DOCTYPE')) throw new Error(`${model}: empty`);
      return text;
    }

    try {
      // Race multiple free models — first valid response wins
      const result = await Promise.any([
        pollinationsModel('openai', 15000),
        pollinationsModel('mistral', 14000),
        pollinationsModel('deepseek', 15000),
        pollinationsModel('qwen', 14000),
        pollinationsModel('llama', 14000),
      ]).catch(() => null);

      if (result) {
        // Truncate if too long
        return result.length > AI_MAX_RESPONSE_LENGTH
          ? result.substring(0, AI_MAX_RESPONSE_LENGTH) + '...'
          : result;
      }
    } catch (err: any) {
      console.error('[AI-BOT] All providers failed:', err.message);
    }
    return null;
  }

  /**
   * Handle bot name mention — generate AI response with rate limiting
   */
  async function handleBotMention(message: any): Promise<boolean> {
    if (!BOT_NAME_PATTERNS.test(message.content)) return false;

    const now = Date.now();

    // Global cooldown
    if (now - lastAiResponseTime < AI_GLOBAL_COOLDOWN_MS) return false;

    // Per-user cooldown
    const userLast = aiUserCooldowns.get(message.author.id) || 0;
    if (now - userLast < AI_USER_COOLDOWN_MS) return false;

    // Mark cooldowns BEFORE async work to prevent concurrent triggers
    lastAiResponseTime = now;
    aiUserCooldowns.set(message.author.id, now);

    // Show typing indicator
    try {
      await (message.channel as any).sendTyping();
    } catch {}

    const aiReply = await generateAiResponse(message.content);
    if (aiReply) {
      try {
        await (message.channel as any).send({
          content: `<@${message.author.id}> ${aiReply}`,
        });
        console.log(`[AI-BOT] Replied to ${message.author.username}: ${aiReply.substring(0, 60)}...`);
      } catch (err: any) {
        console.error('[AI-BOT] Send error:', err.message);
      }
      return true;
    }
    return false;
  }

  // Отслеживание сообщений + ADVANCED модерация с антиспамом
  client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    
    // Track activity (non-blocking)
    trackMessageActivity(message.author.id).catch(() => {});

    // ── Channel moderation with anti-spam ──
    try {
      if (!message.channelId) return;

      const rules = await getChannelModerationRules(message.channelId);

      // ── COMMANDS-ONLY MODE ──
      // If channel is commands-only, delete ALL non-slash messages from users
      if (rules?.commandsOnly) {
        // Allow messages starting with / (slash command previews) — Discord handles actual slash commands via interactions
        // Also allow empty content (which happens with attachments/embeds from interactions)
        if (message.content && !message.content.startsWith('/')) {
          // Delete instantly
          message.delete().catch(() => {});
          // DM the user
          sendPrivateWarning(message, 
            `Этот канал только для команд ботов. Обычные сообщения здесь запрещены.\nThis channel is for bot commands only. Regular messages are not allowed.`
          );
          return;
        }
        // If starts with / but bot didn't handle it, still delete (it's not a real slash command)
        if (message.content) {
          message.delete().catch(() => {});
          return;
        }
      }

      // ── AUTO-RESPONSE TRIGGERS ── (check BEFORE moderation, fire even in moderated channels)
      if (message.content && message.content.length >= 2) {
        const triggerFired = await checkAutoResponseTriggers(message);
        // Don't return — still run moderation on the original message
      }

      // ── BOT NAME MENTION → AI RESPONSE ──
      if (message.content && message.content.length >= 3) {
        // Non-blocking: fire AI response without blocking moderation
        handleBotMention(message).catch(() => {});
      }

      // Skip very short messages for content moderation
      if (!message.content || message.content.length < 2) {
        // Still do joke check even for short messages in non-moderated channels
        if (!rules) {
          maybeJoke(message);
        }
        return;
      }

      // No rules for this channel — just maybe joke
      if (!rules) {
        maybeJoke(message);
        return;
      }

      // 1) Check for spam first — if user is flooding, auto-moderate regardless of content
      const spamming = isSpamming(message.author.id, message.channelId);

      // 2) Check content violations using cached function
      const checkViolations = await getCachedViolationChecker();
      const violation = checkViolations(message.content, {
        languageRestriction: rules.languageRestriction,
        blockProfanity: rules.blockProfanity,
        blockDiscrimination: rules.blockDiscrimination,
      });

      // If spamming in moderated channel, treat as violation even if content seems ok
      const effectiveViolation = violation || (spamming ? {
        reason: 'spam',
        reasonDetail: `Спам в модерируемом канале (${SPAM_MAX_MESSAGES}+ сообщений за ${SPAM_WINDOW_MS / 1000}с)`,
      } : null);

      if (!effectiveViolation) {
        // Clean message — maybe joke
        maybeJoke(message);
        return;
      }

      // 3) Record violation & determine escalation
      const escalation = recordViolation(message.author.id);
      const channelName = message.channel && 'name' in message.channel
        ? (message.channel as any).name : 'unknown';

      // 4) TIMEOUT FIRST — apply before deleting so Discord blocks input immediately
      if (escalation.level === 'timeout' || escalation.level === 'timeout_long') {
        const duration = escalation.level === 'timeout_long' ? TIMEOUT_ESCALATE_MS : TIMEOUT_DURATION_MS;
        const durationText = duration >= 300000 ? '5 минут' : '1 минуту';
        try {
          const member = message.member || await message.guild?.members.fetch(message.author.id).catch(() => null);
          if (member && 'timeout' in member) {
            await (member as any).timeout(duration, `Автомодерация: ${escalation.count} нарушений за 5 минут`);
            console.log(`[MOD] ⏱ Timeout ${message.author.username} for ${durationText} (${escalation.count} violations)`);
          }
        } catch (timeoutErr: any) {
          console.error(`[MOD] Failed to timeout user: ${timeoutErr.message}`);
        }

        // Send private warning about timeout
        const record = userViolations.get(message.author.id);
        if (record && Date.now() - record.lastWarning > WARN_COOLDOWN_MS) {
          record.lastWarning = Date.now();
          sendPrivateWarning(message,
            `Вы заглушены на ${durationText} за повторные нарушения (${escalation.count}x).\nYou have been timed out for ${durationText} for repeated violations (${escalation.count}x).`
          );
        }
      } else if (escalation.count <= 2) {
        // First violations — send private warning
        const record = userViolations.get(message.author.id);
        if (record && Date.now() - record.lastWarning > WARN_COOLDOWN_MS) {
          record.lastWarning = Date.now();
          const langWarning = effectiveViolation.reason === 'wrong_language'
            ? `Этот канал только для ${rules.languageRestriction === 'en' ? 'английского' : 'русского'} языка.\nThis channel is ${rules.languageRestriction === 'en' ? 'English' : 'Russian'} only.`
            : effectiveViolation.reasonDetail;
          sendPrivateWarning(message, langWarning);
        }
      }

      // 5) Auto-delete AFTER timeout — message disappears, input field already blocked
      if (rules.autoDelete) {
        if (spamming) {
          deleteQueue.push({
            channelId: message.channelId,
            messageId: message.id,
            timestamp: Date.now(),
          });
          processDeleteQueue(client);
        } else {
          message.delete().catch((err: any) => {
            console.error(`[MOD] Failed to delete: ${err.message}`);
          });
        }
        console.log(`[MOD] ${spamming ? 'Queue-' : ''}Deleted msg by ${message.author.username} in #${channelName}: ${effectiveViolation.reason} (violations: ${escalation.count})`);
      }

      // 6) Save to flagged_messages DB (fire-and-forget)
      db.insert(
        (await import('@shared/schema')).flaggedMessages
      ).values({
        messageId: message.id,
        channelId: message.channelId,
        channelName,
        authorId: message.author.id,
        authorUsername: message.author.username,
        content: message.content.substring(0, 500),
        reason: effectiveViolation.reason,
        reasonDetail: effectiveViolation.reasonDetail,
        status: rules.autoDelete ? 'deleted' : 'pending',
        messageTimestamp: message.createdAt,
      }).catch((dbErr: any) => {
        if (!dbErr.message?.includes('no such table')) {
          console.error('[MOD] DB save error:', dbErr.message);
        }
      });

    } catch (modErr: any) {
      if (!modErr.message?.includes('no such table')) {
        console.error('[MOD] Moderation error:', modErr.message);
      }
    }
  });

  /**
   * Maybe send a mystical joke response (2% chance, 2min cooldown).
   */
  function maybeJoke(message: any) {
    const now = Date.now();
    if (now - lastJokeTime < JOKE_COOLDOWN_MS) return;
    if (Math.random() > JOKE_CHANCE) return;

    lastJokeTime = now;

    // Detect language of channel name or message to pick response set
    const channelName = message.channel && 'name' in message.channel ? (message.channel as any).name : '';
    const hasRussian = /[\u0400-\u04FF]/.test(message.content);
    const isRuChannel = channelName.includes('ru') || channelName.includes('рус') || channelName.includes('общ');
    const useRu = hasRussian || isRuChannel;

    const responses = useRu ? MYSTICAL_RESPONSES_RU : MYSTICAL_RESPONSES_EN;
    const response = responses[Math.floor(Math.random() * responses.length)]
      .replace('{user}', `<@${message.author.id}>`);

    setTimeout(async () => {
      try {
        await (message.channel as any).send({ content: response });
      } catch {}
    }, 1500 + Math.random() * 3000); // Random 1.5-4.5s delay for natural feel
  }

  // Отслеживание реакций
  client.on('messageReactionAdd', async (reaction, user) => {
    if (user.bot) return;
    
    try {
      await trackReactionActivity(user.id);
    } catch (error) {
      console.error('Ошибка отслеживания реакции:', error);
    }
  });

  // Отслеживание войс активности
  client.on('voiceStateUpdate', async (oldState, newState) => {
    const userId = newState.member?.user.id;
    if (!userId || newState.member?.user.bot) return;

    try {
      // Пользователь зашел в войс
      if (!oldState.channelId && newState.channelId) {
        voiceJoinTimes.set(userId, new Date());
        console.log(`🎤 ${newState.member?.user.username} зашел в войс-канал ${newState.channel?.name}`);
        console.log(`📊 Всего в войсе: ${voiceJoinTimes.size} пользователей`);
      }
      
      // Пользователь переключился между каналами
      if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
        const joinTime = voiceJoinTimes.get(userId);
        if (joinTime) {
          const minutes = Math.floor((Date.now() - joinTime.getTime()) / 1000 / 60);
          if (minutes >= 1) {
            await trackVoiceActivity(userId, minutes);
          }
        }
        // Начать новую сессию
        voiceJoinTimes.set(userId, new Date());
      }
      
      // Пользователь вышел из войса
      if (oldState.channelId && !newState.channelId) {
        const joinTime = voiceJoinTimes.get(userId);
        if (joinTime) {
          const minutes = Math.floor((Date.now() - joinTime.getTime()) / 1000 / 60);
          console.log(`🚪 ${oldState.member?.user.username} вышел из войса после ${minutes} минут`);
          if (minutes >= 1) {
            await trackVoiceActivity(userId, minutes);
          }
          voiceJoinTimes.delete(userId);
          console.log(`📊 Осталось в войсе: ${voiceJoinTimes.size} пользователей`);
        }
      }
    } catch (error) {
      console.error('Ошибка отслеживания войс активности:', error);
    }
  });

  // Периодическое начисление монет для активных пользователей в войсе
  setInterval(async () => {
    if (voiceJoinTimes.size === 0) return;
    
    console.log(`⏰ Периодическая проверка войс активности (${voiceJoinTimes.size} активных)`);
    
    for (const [userId, joinTime] of voiceJoinTimes.entries()) {
      try {
        const minutes = Math.floor((Date.now() - joinTime.getTime()) / 1000 / 60);
        
        if (minutes >= 10) {
          await trackVoiceActivity(userId, minutes);
          voiceJoinTimes.set(userId, new Date());
          console.log(`💰 Начислено за ${minutes} минут войса (периодическая проверка)`);
        }
      } catch (error) {
        console.error(`Ошибка начисления монет для ${userId}:`, error);
      }
    }
  }, 10 * 60 * 1000);

  // Автоматическая синхронизация ролей Discord с базой данных
  client.on('roleUpdate', async (oldRole, newRole) => {
    try {
      const [existingItem] = await db.select().from(shopItems).where(eq(shopItems.discordRoleId, newRole.id));
      
      if (existingItem) {
        const colorHex = newRole.color ? `#${newRole.color.toString(16).padStart(6, '0')}` : null;
        const permissions = newRole.permissions.toArray();
        
        await db.update(shopItems)
          .set({ 
            name: newRole.name,
            roleColor: colorHex,
            discordPermissions: permissions,
            updatedAt: new Date()
          })
          .where(eq(shopItems.id, existingItem.id));
        
        console.log(`🔄 Роль обновлена: ${oldRole.name} → ${newRole.name} (ID: ${newRole.id})`);
      }
    } catch (error) {
      console.error('Ошибка синхронизации при обновлении роли:', error);
    }
  });

  client.on('roleCreate', async (role) => {
    try {
      console.log(`➕ Создана новая роль в Discord: ${role.name} (ID: ${role.id})`);
    } catch (error) {
      console.error('Ошибка обработки создания роли:', error);
    }
  });

  client.on('roleDelete', async (role) => {
    try {
      const [existingItem] = await db.select().from(shopItems).where(eq(shopItems.discordRoleId, role.id));
      
      if (existingItem) {
        await db.update(shopItems)
          .set({ 
            isAvailable: false,
            updatedAt: new Date()
          })
          .where(eq(shopItems.id, existingItem.id));
        
        console.log(`🗑️ Роль удалена из Discord, отключена в магазине: ${role.name} (ID: ${role.id})`);
      }
    } catch (error) {
      console.error('Ошибка синхронизации при удалении роли:', error);
    }
  });

  // Обработка команд
  client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction;

    try {
      switch (commandName) {
        // Основные
        case 'помощь':
          await handleHelpCommand(interaction);
          break;
        case 'статистика':
          await handleStatsCommand(interaction);
          break;
        case 'рейтинг':
          await handleLeaderboardCommand(interaction);
          break;
        case 'активность':
          await handleActivityCommand(interaction);
          break;

        // Музыка
        case 'играть':
        case 'пауза':
        case 'продолжить':
        case 'скип':
        case 'стоп':
        case 'очередь':
        case 'текущее':
        case 'повтор':
        case 'громкость':
        case 'перемешать':
        case 'удалить':
        case 'очистить-очередь':
        case 'перейти':
        case 'поиск':
        case 'плейлист':
        case 'меню-музыки':
          if (!music) {
            await interaction.reply({ content: '❌ Музыкальная система недоступна. Требуется @discordjs/voice и DisTube.', ephemeral: true });
            break;
          }
          switch (commandName) {
            case 'играть': await handlePlayCommand(interaction); break;
            case 'пауза': await handlePauseCommand(interaction); break;
            case 'продолжить': await handleResumeCommand(interaction); break;
            case 'скип': await handleSkipCommand(interaction); break;
            case 'стоп': await handleStopCommand(interaction); break;
            case 'очередь': await handleQueueCommand(interaction); break;
            case 'текущее': await handleNowPlayingCommand(interaction); break;
            case 'повтор': await handleLoopCommand(interaction); break;
            case 'громкость': await handleVolumeCommand(interaction); break;
            case 'перемешать': await handleShuffleCommand(interaction); break;
            case 'удалить': await handleRemoveCommand(interaction); break;
            case 'очистить-очередь': await handleClearQueueCommand(interaction); break;
            case 'перейти': await handleJumpCommand(interaction); break;
            case 'поиск': await handleSearchCommand(interaction); break;
            case 'плейлист': await handlePlaylistCommand(interaction); break;
            case 'меню-музыки': await handleMusicMenuCommand(interaction); break;
          }
          break;

        // Модерация
        case 'банить':
          await handleBanCommand(interaction);
          break;
        case 'кик':
          await handleKickCommand(interaction);
          break;
        case 'мут':
          await handleMuteCommand(interaction);
          break;
        case 'размут':
          await handleUnmuteCommand(interaction);
          break;
        case 'очистить':
          await handleClearCommand(interaction);
          break;
        case 'предупреждение':
          await handleWarnCommand(interaction);
          break;

        // Утилиты
        case 'пинг':
          await handlePingCommand(interaction);
          break;
        case 'инфо':
          await handleUserInfoCommand(interaction);
          break;
        case 'сервер':
          await handleServerInfoCommand(interaction);
          break;
        case 'аватар':
          await handleAvatarCommand(interaction);
          break;

        // Развлечения
        case 'монетка':
          await handleCoinflipCommand(interaction);
          break;
        case 'кубик':
          await handleDiceCommand(interaction);
          break;
        case 'выбрать':
          await handleChooseCommand(interaction);
          break;
        case 'казино':
          await handleCasinoCommand(interaction);
          break;
        case 'рулетка':
          await handleRouletteCommand(interaction);
          break;

        // Roblox
        case 'роблокс':
          await handleRobloxCommand(interaction);
          break;
        case 'роблокс-игра':
          await handleRobloxGameSearchCommand(interaction);
          break;
      }
    } catch (error) {
      console.error(`Ошибка выполнения команды ${commandName}:`, error);
      if (!interaction.replied && !interaction.deferred) {
        try {
          await interaction.reply({ content: 'Произошла ошибка при выполнении команды.', flags: 64 });
        } catch (replyError) {
          console.error('Не удалось отправить сообщение об ошибке:', replyError);
        }
      }
    }
  });

  // Обработка кнопок интерактивного меню
  client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;

    const { customId } = interaction;
    
    if (!customId.startsWith('music_')) return;
    
    if (!interaction.guild) {
      await interaction.reply({ content: '❌ Команда доступна только на сервере', ephemeral: true });
      return;
    }

    if (!music) {
      await interaction.reply({ content: '❌ Музыкальная система недоступна', ephemeral: true });
      return;
    }

    try {
      let result;
      
      switch (customId) {
        case 'music_pause':
          result = await music.pauseSong(interaction.guild.id);
          await interaction.reply({ content: result.message, ephemeral: true });
          break;
          
        case 'music_resume':
          result = await music.resumeSong(interaction.guild.id);
          await interaction.reply({ content: result.message, ephemeral: true });
          break;
          
        case 'music_skip':
          result = await music.skipSong(interaction.guild.id);
          await interaction.reply({ content: result.message, ephemeral: false });
          break;
          
        case 'music_stop':
          result = await music.stopSong(interaction.guild.id);
          await interaction.reply({ content: result.message, ephemeral: false });
          break;
          
        case 'music_shuffle':
          result = await music.shuffleQueue(interaction.guild.id);
          await interaction.reply({ content: result.message, ephemeral: true });
          break;
          
        case 'music_loop':
          result = await music.toggleLoop(interaction.guild.id);
          await interaction.reply({ content: result.message, ephemeral: true });
          break;
          
        case 'music_queue':
          const queueResult = await music.getQueue(interaction.guild.id);
          
          if (!queueResult.success || !queueResult.queue) {
            await interaction.reply({ content: queueResult.message!, ephemeral: true });
            return;
          }

          const queue = queueResult.queue;
          const embed = new EmbedBuilder()
            .setColor(0xA855F7)
            .setTitle('🎵 Очередь треков')
            .setDescription(
              queue!.map((song: any) => 
                `**${song.position}.** ${song.title} [${song.duration}]${song.isPlaying ? ' ▶️' : ''}`
              ).join('\n') || 'Очередь пуста'
            )
            .addFields(
              { name: 'Всего треков', value: `${queueResult.totalSongs || queue!.length}`, inline: true },
              { name: 'Повтор', value: queueResult.loop ? 'Вкл' : 'Выкл', inline: true }
            )
            .setFooter({ text: 'Показано первых 10 треков' })
            .setTimestamp();

          await interaction.reply({ embeds: [embed], ephemeral: true });
          break;
      }
    } catch (error) {
      console.error('Ошибка обработки кнопки:', error);
      if (!interaction.replied && !interaction.deferred) {
        try {
          await interaction.reply({ content: 'Произошла ошибка', ephemeral: true });
        } catch (replyError) {
          console.error('Не удалось отправить сообщение об ошибке:', replyError);
        }
      }
    }
  });

  // Периодическое начисление наград для пользователей в голосовых каналах
  // Каждые 5 минут начисляем награды всем, кто находится в войсе
  if (voiceCheckInterval) clearInterval(voiceCheckInterval); // Prevent stacking
  voiceCheckInterval = setInterval(async () => {
    try {
      const now = Date.now();
      const rewards: Array<{ userId: string; minutes: number }> = [];
      
      console.log(`⏰ Проверка голосовых каналов... Всего отслеживается: ${voiceJoinTimes.size} пользователей`);
      
      // Собираем всех пользователей, которые сейчас в войсе
      for (const [userId, joinTime] of voiceJoinTimes.entries()) {
        const minutesElapsed = Math.floor((now - joinTime.getTime()) / 1000 / 60);
        console.log(`👤 User ${userId}: ${minutesElapsed} минут в войсе`);
        
        // Начисляем только если прошло хотя бы 5 минут
        if (minutesElapsed >= 5) {
          rewards.push({ userId, minutes: minutesElapsed });
          // Обновляем время последнего начисления
          voiceJoinTimes.set(userId, new Date());
        }
      }
      
      // Начисляем награды
      for (const { userId, minutes } of rewards) {
        await trackVoiceActivity(userId, minutes);
      }
      
      if (rewards.length > 0) {
        console.log(`🎤 Периодическое начисление: обработано ${rewards.length} пользователей в войсе`);
      } else {
        console.log(`⏱️ Нет пользователей для начисления (нужно >= 5 минут в войсе)`);
      }
    } catch (error) {
      console.error('Ошибка периодического начисления за войс:', error);
    }
  }, 5 * 60 * 1000); // Каждые 5 минут

  try {
    botStartAttempts++;
    console.log(`[BOT] Attempting login (attempt #${botStartAttempts})...`);
    
    // Login with 30s timeout — if Discord gateway doesn't respond, fail fast
    const loginPromise = client.login(botToken);
    const timeoutPromise = new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error('Login timed out after 30s — Discord gateway not responding')), 30_000)
    );
    await Promise.race([loginPromise, timeoutPromise]);
    
    botClient = client; // Сохраняем глобально для мониторинга
    lastBotError = '';
    console.log(`[BOT] ✅ Login successful, client connected to gateway. Waiting for ready event...`);
  } catch (loginErr: any) {
    lastBotError = `Login failed: ${loginErr?.message || loginErr}`;
    console.error(`[BOT] ❌ ${lastBotError}`);
    // Cleanup: destroy the client that failed to connect
    try { client.removeAllListeners(); client.destroy(); } catch {}
    throw loginErr;
  }
  return client;
}

// ========== ОСНОВНЫЕ КОМАНДЫ ==========

async function handleHelpCommand(interaction: ChatInputCommandInteraction) {
  const embed = new EmbedBuilder()
    .setColor(0x00F0FF)
    .setTitle('📋 Команды бота Luminary')
    .setDescription('Всего команд: **33**')
    .addFields(
      { name: '📊 Основные (4)', value: '`/помощь` `/статистика` `/рейтинг` `/активность`' },
      { 
        name: '🎵 Музыка (16)', 
        value: '**Управление:**\n`/играть` `/пауза` `/продолжить` `/скип` `/стоп` `/громкость`\n**Очередь:**\n`/очередь` `/перемешать` `/удалить` `/очистить-очередь` `/перейти`\n**Поиск:**\n`/поиск` `/плейлист`\n**Прочее:**\n`/текущее` `/повтор` `/меню-музыки`' 
      },
      { name: '🛡️ Модерация (6)', value: '`/банить` `/кик` `/мут` `/размут` `/очистить` `/предупреждение`' },
      { name: '🔧 Утилиты (4)', value: '`/пинг` `/инфо` `/сервер` `/аватар`' },
      { name: '🎲 Развлечения (3)', value: '`/монетка` `/кубик` `/выбрать`' }
    )
    .setFooter({ text: 'Luminary Gaming Clan | YouTube • SoundCloud • Spotify' })
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}

async function handleStatsCommand(interaction: ChatInputCommandInteraction) {
  const stats = await storage.getClanStats();
  const members = await storage.getAllClanMembers();

  const embed = new EmbedBuilder()
    .setColor(0x00F0FF)
    .setTitle('📊 Статистика клана')
    .addFields(
      { name: '👥 Участников', value: `${stats?.totalMembers || members.length}`, inline: true },
      { name: '🏆 Побед', value: `${stats?.totalWins || 0}`, inline: true },
      { name: '💀 Поражений', value: `${stats?.totalLosses || 0}`, inline: true },
      { name: '📈 Средний рейтинг', value: `${stats?.averageRank || 0}`, inline: true },
      { name: '⚡ Активность', value: `${stats?.monthlyActivity || 0}`, inline: true }
    )
    .setFooter({ text: 'Luminary Gaming Clan' })
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}

async function handleLeaderboardCommand(interaction: ChatInputCommandInteraction) {
  const topMembers = await storage.getTopClanMembers(10);

  const embed = new EmbedBuilder()
    .setColor(0x00F0FF)
    .setTitle('🏆 Топ участников')
    .setDescription(
      topMembers.map((member, index) => 
        `**${index + 1}.** ${member.username} - ${member.lumiCoins} LumiCoin`
      ).join('\n') || 'Нет данных'
    )
    .setFooter({ text: 'Luminary Gaming Clan' })
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}

async function handleActivityCommand(interaction: ChatInputCommandInteraction) {
  const user = interaction.options.getUser('участник') || interaction.user;
  const members = await storage.getAllClanMembers();
  const member = members.find(m => m.discordId === user.id);

  if (!member) {
    await interaction.reply({ 
      content: `Участник ${user.tag} не найден в базе данных клана.`, 
      ephemeral: true 
    });
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(0xA855F7)
    .setTitle(`📊 Активность ${member.username}`)
    .addFields(
      { name: '💎 LumiCoin', value: `${member.lumiCoins || 0}`, inline: true },
      { name: '🏆 Побед', value: `${member.wins}`, inline: true },
      { name: '💀 Поражений', value: `${member.losses}`, inline: true },
      { name: '🎯 Убийств', value: `${member.kills}`, inline: true },
      { name: '🤝 Ассистов', value: `${member.assists}`, inline: true },
      { name: '💫 Роль', value: member.role, inline: true }
    )
    .setFooter({ text: 'Luminary Gaming Clan' })
    .setTimestamp();

  if (member.avatar) {
    embed.setThumbnail(member.avatar);
  }

  await interaction.reply({ embeds: [embed] });
}

// ========== МУЗЫКАЛЬНЫЕ КОМАНДЫ ==========

async function handlePlayCommand(interaction: ChatInputCommandInteraction) {
  const query = interaction.options.getString('запрос', true);
  const member = interaction.member as GuildMember;
  
  if (!member.voice.channel) {
    await interaction.reply({ content: '❌ Вы должны быть в голосовом канале!', ephemeral: true });
    return;
  }

  if (!interaction.guild) {
    await interaction.reply({ content: '❌ Команда доступна только на сервере', ephemeral: true });
    return;
  }

  await interaction.deferReply();

  const result = await music.addSong(
    interaction.guild,
    member.voice.channel,
    interaction.channel,
    query,
    interaction.user.tag
  );

  // Если трек успешно добавлен, показываем красивое меню
  if (result.success && result.song) {
    const embed = new EmbedBuilder()
      .setColor(0xA855F7)
      .setTitle('🎵 Музыкальный плеер')
      .setDescription(`**Добавлено:**\n${result.song.title}`)
      .addFields(
        { name: '⏱️ Длительность', value: result.song.duration, inline: true },
        { name: '👤 Запросил', value: result.song.requestedBy, inline: true }
      )
      .setFooter({ text: 'Используйте кнопки ниже для управления' })
      .setTimestamp();

    if (result.song.thumbnail) {
      embed.setThumbnail(result.song.thumbnail);
    }

    const row1 = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('music_pause')
          .setLabel('Пауза')
          .setEmoji('⏸️')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('music_resume')
          .setLabel('Продолжить')
          .setEmoji('▶️')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('music_skip')
          .setLabel('Скип')
          .setEmoji('⏭️')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('music_stop')
          .setLabel('Стоп')
          .setEmoji('⏹️')
          .setStyle(ButtonStyle.Danger)
      );

    const row2 = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('music_shuffle')
          .setLabel('Перемешать')
          .setEmoji('🔀')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('music_loop')
          .setLabel('Повтор')
          .setEmoji('🔁')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('music_queue')
          .setLabel('Очередь')
          .setEmoji('📋')
          .setStyle(ButtonStyle.Secondary)
      );

    await interaction.editReply({ 
      embeds: [embed],
      components: [row1, row2]
    });
  } else {
    await interaction.editReply({ content: result.message });
  }
}

async function handlePauseCommand(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) {
    await interaction.reply({ content: '❌ Команда доступна только на сервере', ephemeral: true });
    return;
  }

  const result = await music.pauseSong(interaction.guild.id);
  await interaction.reply({ content: result.message, ephemeral: !result.success });
}

async function handleResumeCommand(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) {
    await interaction.reply({ content: '❌ Команда доступна только на сервере', ephemeral: true });
    return;
  }

  const result = await music.resumeSong(interaction.guild.id);
  await interaction.reply({ content: result.message, ephemeral: !result.success });
}

async function handleSkipCommand(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) {
    await interaction.reply({ content: '❌ Команда доступна только на сервере', ephemeral: true });
    return;
  }

  const result = await music.skipSong(interaction.guild.id);
  await interaction.reply({ content: result.message });
}

async function handleStopCommand(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) {
    await interaction.reply({ content: '❌ Команда доступна только на сервере', ephemeral: true });
    return;
  }

  const result = await music.stopSong(interaction.guild.id);
  await interaction.reply({ content: result.message });
}

async function handleQueueCommand(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) {
    await interaction.reply({ content: '❌ Команда доступна только на сервере', ephemeral: true });
    return;
  }

  const result = await music.getQueue(interaction.guild.id);
  
  if (!result.success || !result.queue) {
    await interaction.reply({ content: result.message!, ephemeral: true });
    return;
  }

  const queue = result.queue;
  const embed = new EmbedBuilder()
    .setColor(0xA855F7)
    .setTitle('🎵 Очередь треков')
    .setDescription(
      queue!.map((song: any) => 
        `**${song.position}.** ${song.title} [${song.duration}]${song.isPlaying ? ' ▶️' : ''}`
      ).join('\n') || 'Очередь пуста'
    )
    .addFields(
      { name: 'Всего треков', value: `${result.totalSongs || queue!.length}`, inline: true },
      { name: 'Повтор', value: result.loop ? 'Включен' : 'Выключен', inline: true }
    )
    .setFooter({ text: 'Luminary Gaming Clan' })
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}

async function handleNowPlayingCommand(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) {
    await interaction.reply({ content: '❌ Команда доступна только на сервере', ephemeral: true });
    return;
  }

  const result = await music.getCurrentSong(interaction.guild.id);
  
  if (!result.success || !result.song) {
    await interaction.reply({ content: result.message!, ephemeral: true });
    return;
  }

  const song = result.song;
  const embed = new EmbedBuilder()
    .setColor(0x00F0FF)
    .setTitle('▶️ Сейчас играет')
    .setDescription(`**${song.title}**`)
    .addFields(
      { name: 'Длительность', value: song.duration, inline: true },
      { name: 'Запросил', value: song.requestedBy, inline: true }
    )
    .setFooter({ text: 'Luminary Gaming Clan' })
    .setTimestamp();

  if (song.thumbnail) {
    embed.setThumbnail(song.thumbnail);
  }

  await interaction.reply({ embeds: [embed] });
}

async function handleLoopCommand(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) {
    await interaction.reply({ content: '❌ Команда доступна только на сервере', ephemeral: true });
    return;
  }

  const result = await music.toggleLoop(interaction.guild.id);
  await interaction.reply({ content: result.message, ephemeral: !result.success });
}

async function handleVolumeCommand(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) {
    await interaction.reply({ content: '❌ Команда доступна только на сервере', ephemeral: true });
    return;
  }

  const volume = interaction.options.getInteger('уровень', true);
  const result = await music.setVolume(interaction.guild.id, volume);
  await interaction.reply({ content: result.message, ephemeral: !result.success });
}

async function handleShuffleCommand(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) {
    await interaction.reply({ content: '❌ Команда доступна только на сервере', ephemeral: true });
    return;
  }

  const result = await music.shuffleQueue(interaction.guild.id);
  await interaction.reply({ content: result.message, ephemeral: !result.success });
}

async function handleRemoveCommand(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) {
    await interaction.reply({ content: '❌ Команда доступна только на сервере', ephemeral: true });
    return;
  }

  const index = interaction.options.getInteger('номер', true);
  const result = await music.removeSong(interaction.guild.id, index);
  await interaction.reply({ content: result.message, ephemeral: !result.success });
}

async function handleClearQueueCommand(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) {
    await interaction.reply({ content: '❌ Команда доступна только на сервере', ephemeral: true });
    return;
  }

  const result = await music.clearQueue(interaction.guild.id);
  await interaction.reply({ content: result.message, ephemeral: !result.success });
}

async function handleJumpCommand(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) {
    await interaction.reply({ content: '❌ Команда доступна только на сервере', ephemeral: true });
    return;
  }

  const index = interaction.options.getInteger('номер', true);
  const result = await music.jumpToSong(interaction.guild.id, index);
  await interaction.reply({ content: result.message, ephemeral: !result.success });
}

async function handleSearchCommand(interaction: ChatInputCommandInteraction) {
  const query = interaction.options.getString('запрос', true);
  
  await interaction.deferReply();
  
  const result = await music.searchSongs(query, 5);
  
  if (!result.success || !result.results) {
    await interaction.editReply({ content: result.message! });
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(0x00F0FF)
    .setTitle(`🔍 Результаты поиска: "${query}"`)
    .setDescription(
      result.results.map(r => 
        `**${r.index}.** ${r.title} [${r.duration}]`
      ).join('\n')
    )
    .setFooter({ text: 'Используйте /играть с названием или URL для воспроизведения' })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

async function handlePlaylistCommand(interaction: ChatInputCommandInteraction) {
  const playlistUrl = interaction.options.getString('ссылка', true);
  const member = interaction.member as GuildMember;
  
  if (!member.voice.channel) {
    await interaction.reply({ content: '❌ Вы должны быть в голосовом канале!', ephemeral: true });
    return;
  }

  if (!interaction.guild) {
    await interaction.reply({ content: '❌ Команда доступна только на сервере', ephemeral: true });
    return;
  }

  await interaction.deferReply();

  const result = await music.addPlaylist(
    interaction.guild,
    member.voice.channel,
    interaction.channel,
    playlistUrl,
    interaction.user.tag
  );

  await interaction.editReply({ content: result.message });
}

async function handleMusicMenuCommand(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) {
    await interaction.reply({ content: '❌ Команда доступна только на сервере', ephemeral: true });
    return;
  }

  const result = await music.getCurrentSong(interaction.guild.id);
  const queue = await music.getQueue(interaction.guild.id);

  const embed = new EmbedBuilder()
    .setColor(0xA855F7)
    .setTitle('🎵 Музыкальное Меню')
    .setDescription(
      result.success && result.song
        ? `▶️ Сейчас играет: **${result.song.title}**`
        : 'Ничего не играет'
    )
    .addFields(
      { name: 'Треков в очереди', value: queue.success && queue.queue ? `${queue.queue.songs.length}` : '0', inline: true },
      { name: 'Повтор', value: queue.success && queue.queue?.loop ? 'Вкл' : 'Выкл', inline: true },
      { name: 'Громкость', value: queue.success && queue.queue ? `${queue.queue.volume}%` : '50%', inline: true }
    )
    .setFooter({ text: 'Используйте кнопки ниже для управления' })
    .setTimestamp();

  if (result.success && result.song?.thumbnail) {
    embed.setThumbnail(result.song.thumbnail);
  }

  const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = await import('discord.js');
  
  const row1 = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('music_pause')
        .setLabel('⏸️ Пауза')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('music_resume')
        .setLabel('▶️ Продолжить')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('music_skip')
        .setLabel('⏭️ Скип')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('music_stop')
        .setLabel('⏹️ Стоп')
        .setStyle(ButtonStyle.Danger)
    );

  const row2 = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('music_shuffle')
        .setLabel('🔀 Перемешать')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('music_loop')
        .setLabel('🔁 Повтор')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('music_queue')
        .setLabel('📋 Очередь')
        .setStyle(ButtonStyle.Secondary)
    );

  await interaction.reply({ 
    embeds: [embed], 
    components: [row1, row2]
  });
}

// ========== МОДЕРАЦИЯ ==========

async function handleBanCommand(interaction: ChatInputCommandInteraction) {
  const user = interaction.options.getUser('участник', true);
  const reason = interaction.options.getString('причина') || 'Не указана';

  if (!interaction.guild) {
    await interaction.reply({ content: 'Команда доступна только на сервере.', ephemeral: true });
    return;
  }

  try {
    const member = await interaction.guild.members.fetch(user.id);
    await member.ban({ reason });

    const embed = new EmbedBuilder()
      .setColor(0xFF0000)
      .setTitle('🔨 Участник забанен')
      .addFields(
        { name: 'Участник', value: user.tag, inline: true },
        { name: 'Забанен', value: interaction.user.tag, inline: true },
        { name: 'Причина', value: reason, inline: false }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  } catch (error) {
    await interaction.reply({ content: 'Не удалось забанить участника.', ephemeral: true });
  }
}

async function handleKickCommand(interaction: ChatInputCommandInteraction) {
  const user = interaction.options.getUser('участник', true);
  const reason = interaction.options.getString('причина') || 'Не указана';

  if (!interaction.guild) {
    await interaction.reply({ content: 'Команда доступна только на сервере.', ephemeral: true });
    return;
  }

  try {
    const member = await interaction.guild.members.fetch(user.id);
    await member.kick(reason);

    const embed = new EmbedBuilder()
      .setColor(0xFFA500)
      .setTitle('👢 Участник исключён')
      .addFields(
        { name: 'Участник', value: user.tag, inline: true },
        { name: 'Исключил', value: interaction.user.tag, inline: true },
        { name: 'Причина', value: reason, inline: false }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  } catch (error) {
    await interaction.reply({ content: 'Не удалось исключить участника.', ephemeral: true });
  }
}

async function handleMuteCommand(interaction: ChatInputCommandInteraction) {
  const user = interaction.options.getUser('участник', true);
  const minutes = interaction.options.getInteger('минуты', true);
  const reason = interaction.options.getString('причина') || 'Не указана';

  if (!interaction.guild) {
    await interaction.reply({ content: 'Команда доступна только на сервере.', ephemeral: true });
    return;
  }

  try {
    const member = await interaction.guild.members.fetch(user.id);
    await member.timeout(minutes * 60 * 1000, reason);

    const embed = new EmbedBuilder()
      .setColor(0x808080)
      .setTitle('🔇 Участник замучен')
      .addFields(
        { name: 'Участник', value: user.tag, inline: true },
        { name: 'Длительность', value: `${minutes} мин`, inline: true },
        { name: 'Причина', value: reason, inline: false }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  } catch (error) {
    await interaction.reply({ content: 'Не удалось замутить участника.', ephemeral: true });
  }
}

async function handleUnmuteCommand(interaction: ChatInputCommandInteraction) {
  const user = interaction.options.getUser('участник', true);

  if (!interaction.guild) {
    await interaction.reply({ content: 'Команда доступна только на сервере.', ephemeral: true });
    return;
  }

  try {
    const member = await interaction.guild.members.fetch(user.id);
    await member.timeout(null);

    await interaction.reply({ content: `✅ Участник ${user.tag} размучен.` });
  } catch (error) {
    await interaction.reply({ content: 'Не удалось размутить участника.', ephemeral: true });
  }
}

async function handleClearCommand(interaction: ChatInputCommandInteraction) {
  const amount = interaction.options.getInteger('количество', true);

  if (!interaction.channel || !('bulkDelete' in interaction.channel)) {
    await interaction.reply({ content: '❌ Команда недоступна в этом канале', ephemeral: true });
    return;
  }

  try {
    await interaction.deferReply({ ephemeral: true });
    const deleted = await interaction.channel.bulkDelete(amount, true);
    await interaction.editReply({ content: `🗑️ Удалено ${deleted.size} сообщений.` });
  } catch (error) {
    await interaction.editReply({ content: 'Не удалось удалить сообщения.' });
  }
}

async function handleWarnCommand(interaction: ChatInputCommandInteraction) {
  const user = interaction.options.getUser('участник', true);
  const reason = interaction.options.getString('причина', true);

  const embed = new EmbedBuilder()
    .setColor(0xFFFF00)
    .setTitle('⚠️ Предупреждение')
    .addFields(
      { name: 'Участник', value: user.tag, inline: true },
      { name: 'Модератор', value: interaction.user.tag, inline: true },
      { name: 'Причина', value: reason, inline: false }
    )
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}

// ========== УТИЛИТЫ ==========

async function handlePingCommand(interaction: ChatInputCommandInteraction) {
  const sent = await interaction.reply({ content: '🏓 Pong!', fetchReply: true });
  const latency = sent.createdTimestamp - interaction.createdTimestamp;
  
  await interaction.editReply(`🏓 Pong! Задержка: ${latency}ms`);
}

async function handleUserInfoCommand(interaction: ChatInputCommandInteraction) {
  const user = interaction.options.getUser('пользователь') || interaction.user;
  
  if (!interaction.guild) {
    await interaction.reply({ content: '❌ Команда доступна только на сервере', ephemeral: true });
    return;
  }

  try {
    const member = await interaction.guild.members.fetch(user.id);
    
    const embed = new EmbedBuilder()
      .setColor(0x00F0FF)
      .setTitle(`👤 Информация о ${user.tag}`)
      .setThumbnail(user.displayAvatarURL())
      .addFields(
        { name: 'ID', value: user.id, inline: true },
        { name: 'Никнейм', value: member.nickname || 'Не установлен', inline: true },
        { name: 'Присоединился', value: `<t:${Math.floor((member.joinedTimestamp || 0) / 1000)}:R>`, inline: true },
        { name: 'Зарегистрирован', value: `<t:${Math.floor(user.createdTimestamp / 1000)}:R>`, inline: true },
        { name: 'Роли', value: member.roles.cache.map(r => r.name).join(', ') || 'Нет ролей', inline: false }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  } catch (error) {
    await interaction.reply({ content: 'Не удалось получить информацию о пользователе.', ephemeral: true });
  }
}

async function handleServerInfoCommand(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) {
    await interaction.reply({ content: '❌ Команда доступна только на сервере', ephemeral: true });
    return;
  }

  const guild = interaction.guild;
  const embed = new EmbedBuilder()
    .setColor(0xA855F7)
    .setTitle(`🏰 Информация о сервере ${guild.name}`)
    .setThumbnail(guild.iconURL() || undefined)
    .addFields(
      { name: 'ID сервера', value: guild.id, inline: true },
      { name: 'Владелец', value: `<@${guild.ownerId}>`, inline: true },
      { name: 'Участников', value: `${guild.memberCount}`, inline: true },
      { name: 'Создан', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`, inline: true },
      { name: 'Каналов', value: `${guild.channels.cache.size}`, inline: true },
      { name: 'Ролей', value: `${guild.roles.cache.size}`, inline: true }
    )
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}

async function handleAvatarCommand(interaction: ChatInputCommandInteraction) {
  const user = interaction.options.getUser('пользователь') || interaction.user;
  
  const embed = new EmbedBuilder()
    .setColor(0x00F0FF)
    .setTitle(`🖼️ Аватар ${user.tag}`)
    .setImage(user.displayAvatarURL({ size: 1024 }))
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}

// ========== РАЗВЛЕЧЕНИЯ ==========

async function handleCoinflipCommand(interaction: ChatInputCommandInteraction) {
  const result = Math.random() < 0.5 ? 'Орёл' : 'Решка';
  await interaction.reply(`🪙 Монетка подброшена: **${result}**!`);
}

async function handleDiceCommand(interaction: ChatInputCommandInteraction) {
  const result = Math.floor(Math.random() * 6) + 1;
  await interaction.reply(`🎲 Вы бросили кубик: **${result}**!`);
}

async function handleChooseCommand(interaction: ChatInputCommandInteraction) {
  const options = interaction.options.getString('варианты', true);
  const choices = options.split(',').map(c => c.trim()).filter(c => c.length > 0);
  
  if (choices.length < 2) {
    await interaction.reply({ content: '❌ Укажите минимум 2 варианта через запятую!', ephemeral: true });
    return;
  }

  const choice = choices[Math.floor(Math.random() * choices.length)];
  await interaction.reply(`🤔 Я выбираю: **${choice}**!`);
}

// ========== КАЗИНО ==========

const slotSymbols = ['🍒', '🍋', '🍊', '🍇', '💎', '7️⃣', '🎰', '⭐', '🔔', '🍀'];
const slotValues: Record<string, number> = {
  '🍒': 2, '🍋': 2, '🍊': 3, '🍇': 3, '💎': 5, '7️⃣': 10, '🎰': 7, '⭐': 4, '🔔': 3, '🍀': 4
};

async function handleCasinoCommand(interaction: ChatInputCommandInteraction) {
  const bet = interaction.options.getInteger('ставка') || 10;
  const discordId = interaction.user.id;

  try {
    const [member] = await db.select().from(clanMembers).where(eq(clanMembers.discordId, discordId));
    if (!member) {
      await interaction.reply({ content: '❌ Ты не зарегистрирован в клане!', ephemeral: true });
      return;
    }

    if ((member.lumiCoins ?? 0) < bet) {
      await interaction.reply({ content: `❌ Недостаточно LumiCoin! У тебя: **${member.lumiCoins ?? 0}** LC`, ephemeral: true });
      return;
    }

    // Крутим слоты
    const slot1 = slotSymbols[Math.floor(Math.random() * slotSymbols.length)];
    const slot2 = slotSymbols[Math.floor(Math.random() * slotSymbols.length)];
    const slot3 = slotSymbols[Math.floor(Math.random() * slotSymbols.length)];

    let winMultiplier = 0;
    let resultText = '';

    if (slot1 === slot2 && slot2 === slot3) {
      // Три одинаковых — джекпот!
      winMultiplier = (slotValues[slot1] || 3) * 3;
      resultText = `🎉 **ДЖЕКПОТ!** Три ${slot1}!`;
    } else if (slot1 === slot2 || slot2 === slot3 || slot1 === slot3) {
      // Два одинаковых
      const matchedSymbol = slot1 === slot2 ? slot1 : slot2 === slot3 ? slot2 : slot1;
      winMultiplier = slotValues[matchedSymbol] || 2;
      resultText = `✨ Два ${matchedSymbol}! Выигрыш!`;
    } else if (slot1 === '7️⃣' || slot2 === '7️⃣' || slot3 === '7️⃣') {
      // Хотя бы одна семёрка
      winMultiplier = 1;
      resultText = '7️⃣ Семёрка! Ставка возвращена';
    } else {
      resultText = '💨 Не повезло... Попробуй ещё!';
    }

    const winnings = Math.floor(bet * winMultiplier);
    const netChange = winnings - bet;

    await db.update(clanMembers)
      .set({ lumiCoins: (member.lumiCoins ?? 0) + netChange })
      .where(eq(clanMembers.discordId, discordId));

    const embed = new EmbedBuilder()
      .setTitle('🎰 Казино Luminary')
      .setDescription(
        `╔══════════╗\n` +
        `║  ${slot1}  ${slot2}  ${slot3}  ║\n` +
        `╚══════════╝\n\n` +
        `${resultText}`
      )
      .addFields(
        { name: '💰 Ставка', value: `${bet} LC`, inline: true },
        { name: winnings > 0 ? '🏆 Выигрыш' : '📉 Результат', value: winnings > 0 ? `+${winnings} LC` : `${netChange} LC`, inline: true },
        { name: '💳 Баланс', value: `${(member.lumiCoins ?? 0) + netChange} LC`, inline: true },
      )
      .setColor(winnings > bet ? 0x00ff00 : winnings > 0 ? 0xffff00 : 0xff0000)
      .setFooter({ text: `Игрок: ${interaction.user.username}` })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  } catch (error) {
    console.error('Casino error:', error);
    await interaction.reply({ content: '❌ Ошибка казино!', ephemeral: true });
  }
}

const rouletteSegments = [
  { emoji: '🔴', label: 'Красное', mult: 0 },
  { emoji: '⚫', label: 'Чёрное', mult: 0 },
  { emoji: '🟢', label: 'Зеро', mult: 0 },
  { emoji: '💎', label: 'Алмаз', mult: 5 },
  { emoji: '🔴', label: 'Красное', mult: 0 },
  { emoji: '⚫', label: 'Чёрное', mult: 0 },
  { emoji: '⭐', label: 'Звезда', mult: 3 },
  { emoji: '🔴', label: 'Красное', mult: 0 },
  { emoji: '⚫', label: 'Чёрное', mult: 0 },
  { emoji: '7️⃣', label: 'Семёрки', mult: 7 },
  { emoji: '🔴', label: 'Красное', mult: 0 },
  { emoji: '⚫', label: 'Чёрное', mult: 0 },
  { emoji: '🍀', label: 'Удача', mult: 2 },
  { emoji: '🔴', label: 'Красное', mult: 0 },
  { emoji: '⚫', label: 'Чёрное', mult: 0 },
  { emoji: '🔴', label: 'Красное', mult: 0 },
  { emoji: '👑', label: 'Корона', mult: 10 },
  { emoji: '⚫', label: 'Чёрное', mult: 0 },
  { emoji: '🔴', label: 'Красное', mult: 0 },
  { emoji: '⚫', label: 'Чёрное', mult: 0 },
];

async function handleRouletteCommand(interaction: ChatInputCommandInteraction) {
  const bet = interaction.options.getInteger('ставка') || 5;
  const discordId = interaction.user.id;

  try {
    const [member] = await db.select().from(clanMembers).where(eq(clanMembers.discordId, discordId));
    if (!member) {
      await interaction.reply({ content: '❌ Ты не зарегистрирован в клане!', ephemeral: true });
      return;
    }

    if ((member.lumiCoins ?? 0) < bet) {
      await interaction.reply({ content: `❌ Недостаточно LumiCoin! У тебя: **${member.lumiCoins ?? 0}** LC`, ephemeral: true });
      return;
    }

    // Крутим рулетку
    const segmentIndex = Math.floor(Math.random() * rouletteSegments.length);
    const result = rouletteSegments[segmentIndex];
    
    let winMultiplier = result.mult;
    let resultText = '';
    
    // Красное/Чёрное — 50% шанс удвоить
    if (result.mult === 0) {
      const isWin = Math.random() < 0.45; // Чуть ниже 50% для дома
      winMultiplier = isWin ? 2 : 0;
      resultText = isWin
        ? `${result.emoji} **${result.label}** — Выигрыш! x2`
        : `${result.emoji} **${result.label}** — Не повезло!`;
    } else {
      resultText = `${result.emoji} **${result.label}** — Выигрыш x${result.mult}! 🎉`;
    }
    
    if (result.emoji === '🟢') {
      resultText = '🟢 **ЗЕРО!** Ставка сгорает! 💀';
      winMultiplier = 0;
    }

    const winnings = Math.floor(bet * winMultiplier);
    const netChange = winnings - bet;

    await db.update(clanMembers)
      .set({ lumiCoins: (member.lumiCoins ?? 0) + netChange })
      .where(eq(clanMembers.discordId, discordId));

    // Визуальная рулетка
    const visibleSegments = [];
    for (let i = -2; i <= 2; i++) {
      const idx = (segmentIndex + i + rouletteSegments.length) % rouletteSegments.length;
      visibleSegments.push(rouletteSegments[idx].emoji);
    }

    const embed = new EmbedBuilder()
      .setTitle('🎡 Рулетка Luminary')
      .setDescription(
        `${visibleSegments[0]} ${visibleSegments[1]} [ ${visibleSegments[2]} ] ${visibleSegments[3]} ${visibleSegments[4]}\n` +
        `${'‎ '.repeat(8)}⬆️\n\n` +
        resultText
      )
      .addFields(
        { name: '💰 Ставка', value: `${bet} LC`, inline: true },
        { name: winnings > 0 ? '🏆 Выигрыш' : '📉 Результат', value: winnings > 0 ? `+${winnings} LC` : `${netChange} LC`, inline: true },
        { name: '💳 Баланс', value: `${(member.lumiCoins ?? 0) + netChange} LC`, inline: true },
      )
      .setColor(winnings > bet ? 0x00ff00 : winnings > 0 ? 0xffff00 : 0xff0000)
      .setFooter({ text: `Игрок: ${interaction.user.username}` })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  } catch (error) {
    console.error('Roulette error:', error);
    await interaction.reply({ content: '❌ Ошибка рулетки!', ephemeral: true });
  }
}

// ========== ROBLOX КОМАНДЫ ==========

let robloxApi: any = null;
try {
  robloxApi = await import('./roblox-api');
} catch (e) {
  console.log('⚠️ Roblox API модуль недоступен');
}

async function handleRobloxCommand(interaction: ChatInputCommandInteraction) {
  const username = interaction.options.getString('ник', true);
  
  await interaction.deferReply();
  
  try {
    if (!robloxApi) {
      await interaction.editReply('❌ Roblox API недоступен');
      return;
    }
    
    const result = await robloxApi.lookupUser(username);
    
    if (!result.success || !result.user) {
      await interaction.editReply(`❌ Игрок **${username}** не найден в Roblox`);
      return;
    }
    
    const user = result.user;
    
    // Статус
    const statusEmojis: Record<string, string> = {
      'Оффлайн': '⚫',
      'Онлайн': '🟢',
      'В игре': '🎮',
      'В Roblox Studio': '🔧',
    };
    const statusEmoji = statusEmojis[user.status] || '⚫';
    
    const embed = new EmbedBuilder()
      .setTitle(`🎮 ${user.displayName}`)
      .setURL(user.profileUrl)
      .setDescription(
        `**Ник:** ${user.name}\n` +
        `**Статус:** ${statusEmoji} ${user.status}\n` +
        (user.description ? `**Описание:** ${user.description.substring(0, 200)}\n` : '') +
        (user.isBanned ? '⛔ **Аккаунт заблокирован**\n' : '')
      )
      .addFields(
        { name: '👥 Друзья', value: `${user.stats.friends}`, inline: true },
        { name: '❤️ Подписчики', value: `${user.stats.followers}`, inline: true },
        { name: '👁️ Подписки', value: `${user.stats.followings}`, inline: true },
        { name: '📅 Создан', value: user.created ? `<t:${Math.floor(new Date(user.created).getTime() / 1000)}:D>` : 'Неизвестно', inline: true },
      )
      .setColor(user.status === 'В игре' ? 0x00AAFF : user.status === 'Онлайн' ? 0x00FF00 : 0x808080)
      .setFooter({ text: `Roblox ID: ${user.id}` })
      .setTimestamp();
    
    // Если есть аватар
    if (user.avatar) {
      embed.setThumbnail(user.avatar);
    }
    
    // Если в игре — добавляем инфо об игре
    if (user.currentGame && user.currentGame.name) {
      const gameField = user.currentGame.id > 0
        ? `🎮 **${user.currentGame.name}**\n` +
          `👥 Онлайн: ${user.currentGame.playing.toLocaleString()}\n` +
          `👁️ Визиты: ${user.currentGame.visits.toLocaleString()}\n` +
          (user.currentGame.placeId ? `🔗 [Присоединиться](https://www.roblox.com/games/${user.currentGame.placeId})` : '')
        : `🎮 **${user.currentGame.name}**\n_(Информация скрыта настройками приватности)_`;
      
      embed.addFields({ name: '🕹️ Сейчас играет', value: gameField, inline: false });
    }
    
    // Кнопка профиля
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setLabel('Профиль Roblox')
        .setStyle(ButtonStyle.Link)
        .setURL(user.profileUrl)
        .setEmoji('🔗'),
    );
    
    // Если в игре и есть placeId — кнопка присоединиться
    if (user.currentGame && user.currentGame.placeId > 0) {
      row.addComponents(
        new ButtonBuilder()
          .setLabel('Присоединиться к игре')
          .setStyle(ButtonStyle.Link)
          .setURL(`https://www.roblox.com/games/${user.currentGame.placeId}`)
          .setEmoji('🎮'),
      );
    }
    
    await interaction.editReply({ embeds: [embed], components: [row] });
  } catch (error) {
    console.error('Roblox command error:', error);
    await interaction.editReply('❌ Ошибка при поиске игрока Roblox');
  }
}

async function handleRobloxGameSearchCommand(interaction: ChatInputCommandInteraction) {
  const gameName = interaction.options.getString('название', true);
  
  await interaction.deferReply();
  
  try {
    if (!robloxApi) {
      await interaction.editReply('❌ Roblox API недоступен');
      return;
    }
    
    const results = await robloxApi.searchGames(gameName);
    
    if (!results || results.length === 0) {
      await interaction.editReply(`❌ Игры по запросу **${gameName}** не найдены`);
      return;
    }
    
    const embed = new EmbedBuilder()
      .setTitle(`🔍 Поиск: ${gameName}`)
      .setColor(0x00AAFF)
      .setTimestamp();
    
    // Показываем до 5 результатов
    const top = results.slice(0, 5);
    for (let i = 0; i < top.length; i++) {
      const game = top[i];
      embed.addFields({
        name: `${i + 1}. ${game.name}`,
        value: 
          `👥 Онлайн: **${(game.playerCount || 0).toLocaleString()}**\n` +
          `👁️ Визиты: **${(game.totalUpVotes || 0).toLocaleString()}** 👍\n` +
          `⭐ Рейтинг: ${game.totalUpVotes && game.totalDownVotes ? Math.round((game.totalUpVotes / (game.totalUpVotes + game.totalDownVotes)) * 100) : '?'}%\n` +
          `🔗 [Открыть](https://www.roblox.com/games/${game.placeId || game.rootPlaceId})`,
        inline: false,
      });
    }
    
    embed.setFooter({ text: `Найдено результатов: ${results.length}` });
    
    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Roblox game search error:', error);
    await interaction.editReply('❌ Ошибка при поиске игры Roblox');
  }
}

// ========== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ==========

async function trackMessageActivity(discordId: string) {
  try {
    const [member] = await db.select().from(clanMembers).where(eq(clanMembers.discordId, discordId));
    if (!member) {
      console.log(`⚠️ Участник с Discord ID ${discordId} не найден в БД`);
      return;
    }
    
    const settings = await getEarningSettings();
    const now = Date.now();
    
    // Проверка на спам
    let rewardMultiplier = 1.0;
    if (settings.antiSpamEnabled) {
      const history = userMessageHistory.get(discordId) || { timestamps: [] };
      
      // Удаляем старые timestamp'ы (старше окна анти-спама)
      const windowMs = settings.antiSpamMessageWindow * 1000;
      history.timestamps = history.timestamps.filter(ts => (now - ts) < windowMs);
      
      // Добавляем текущее сообщение
      history.timestamps.push(now);
      userMessageHistory.set(discordId, history);
      
      // Если слишком много сообщений за короткое время - применяем штраф
      if (history.timestamps.length >= settings.antiSpamMessageThreshold) {
        rewardMultiplier = settings.antiSpamPenaltyRate;
      }
    }
    
    const [activity] = await db.select().from(discordActivity).where(eq(discordActivity.discordId, discordId));
    
    if (activity) {
      await db.update(discordActivity)
        .set({ 
          messageCount: (activity.messageCount || 0) + 1,
          lastActivity: new Date()
        })
        .where(eq(discordActivity.id, activity.id));
    } else {
      await db.insert(discordActivity).values({
        memberId: member.id,
        discordId: discordId,
        messageCount: 1,
        voiceMinutes: 0,
        reactionCount: 0,
        lastActivity: new Date()
      });
    }
    
    const coinsAdded = Math.round((settings.messageRewardRate * rewardMultiplier) * 100) / 100;
    const newBalance = Math.round(((member.lumiCoins || 0) + coinsAdded) * 100) / 100;
    await db.update(clanMembers)
      .set({ lumiCoins: newBalance })
      .where(eq(clanMembers.id, member.id));
    
    // Логируем транзакцию
    if (coinsAdded > 0) {
      const spamInfo = rewardMultiplier < 1.0 ? ' (анти-спам штраф)' : '';
      await db.insert(transactions).values({
        memberId: member.id,
        discordId: discordId,
        username: member.username,
        amount: coinsAdded,
        type: 'earn',
        description: `Награда за сообщение${spamInfo}`,
      });
    }
    
    const spamWarning = rewardMultiplier < 1.0 ? ' ⚠️ СПАМ' : '';
    console.log(`💬 ${member.username}: +${coinsAdded} LC (новый баланс: ${newBalance} LC)${spamWarning} [DB: ${process.env.DATABASE_URL?.substring(0, 30)}...]`);
      
  } catch (error) {
    console.error('Ошибка отслеживания сообщений:', error);
  }
}

async function trackVoiceActivity(discordId: string, minutes: number) {
  try {
    const [member] = await db.select().from(clanMembers).where(eq(clanMembers.discordId, discordId));
    if (!member) {
      console.log(`⚠️ Участник с Discord ID ${discordId} не найден в БД`);
      return;
    }
    
    const settings = await getEarningSettings();
    
    const [activity] = await db.select().from(discordActivity).where(eq(discordActivity.discordId, discordId));
    
    if (activity) {
      await db.update(discordActivity)
        .set({ 
          voiceMinutes: (activity.voiceMinutes || 0) + minutes,
          lastActivity: new Date()
        })
        .where(eq(discordActivity.id, activity.id));
    } else {
      await db.insert(discordActivity).values({
        memberId: member.id,
        discordId: discordId,
        messageCount: 0,
        voiceMinutes: minutes,
        reactionCount: 0,
        lastActivity: new Date()
      });
    }
    
    const coinsAdded = Math.round((minutes * settings.voiceRewardRate) * 100) / 100;
    const newBalance = Math.round(((member.lumiCoins || 0) + coinsAdded) * 100) / 100;
    await db.update(clanMembers)
      .set({ lumiCoins: newBalance })
      .where(eq(clanMembers.id, member.id));
    
    // Логируем транзакцию
    if (coinsAdded > 0) {
      await db.insert(transactions).values({
        memberId: member.id,
        discordId: discordId,
        username: member.username,
        amount: coinsAdded,
        type: 'earn',
        description: `Награда за голосовой чат (${minutes} мин.)`,
      });
    }
    
    console.log(`🎤 ${member.username}: +${coinsAdded} LC за ${minutes} мин. (новый баланс: ${newBalance} LC) [DB: ${process.env.DATABASE_URL?.substring(0, 30)}...]`);
      
  } catch (error) {
    console.error('Ошибка отслеживания войс активности:', error);
  }
}

async function trackReactionActivity(discordId: string) {
  try {
    const [member] = await db.select().from(clanMembers).where(eq(clanMembers.discordId, discordId));
    if (!member) {
      console.log(`⚠️ Участник с Discord ID ${discordId} не найден в БД`);
      return;
    }
    
    const settings = await getEarningSettings();
    
    const [activity] = await db.select().from(discordActivity).where(eq(discordActivity.discordId, discordId));
    
    if (activity) {
      await db.update(discordActivity)
        .set({ 
          reactionCount: (activity.reactionCount || 0) + 1,
          lastActivity: new Date()
        })
        .where(eq(discordActivity.id, activity.id));
    } else {
      await db.insert(discordActivity).values({
        memberId: member.id,
        discordId: discordId,
        messageCount: 0,
        voiceMinutes: 0,
        reactionCount: 1,
        lastActivity: new Date()
      });
    }
    
    const coinsAdded = Math.round(settings.reactionRewardRate * 100) / 100;
    const newBalance = Math.round(((member.lumiCoins || 0) + coinsAdded) * 100) / 100;
    await db.update(clanMembers)
      .set({ lumiCoins: newBalance })
      .where(eq(clanMembers.id, member.id));
    
    // Логируем транзакцию
    if (coinsAdded > 0) {
      await db.insert(transactions).values({
        memberId: member.id,
        discordId: discordId,
        username: member.username,
        amount: coinsAdded,
        type: 'earn',
        description: 'Награда за реакцию',
      });
    }
    
    console.log(`👍 ${member.username}: +${coinsAdded} LC (новый баланс: ${newBalance} LC) [DB: ${process.env.DATABASE_URL?.substring(0, 30)}...]`);
      
  } catch (error) {
    console.error('Ошибка отслеживания реакций:', error);
  }
}
