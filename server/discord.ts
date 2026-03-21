import { Client, ChannelType, TextChannel, PermissionFlagsBits } from 'discord.js';
import { botClient } from './bot-commands';

// ─── Helper: get the shared bot client (from bot-commands.ts) ──────────
// NEVER create new Discord clients — the shared botClient is the only one.
// If the bot is offline (rate-limited), functions return fallback data.
function getSharedBot(): Client | null {
  if (botClient && botClient.isReady()) {
    return botClient;
  }
  return null;
}

function getGuild(client: Client) {
  const guild = client.guilds.cache.first();
  return guild || null;
}

export async function getDiscordServerInfo() {
  try {
    const client = getSharedBot();
    if (!client) {
      console.log('[DISCORD] Bot offline — returning fallback for getDiscordServerInfo');
      // Fallback: return DB-based member count
      const { db } = await import('./db');
      const { clanMembers } = await import('@shared/schema');
      const members = await db.select().from(clanMembers);
      return { memberCount: members.length, onlineCount: 0, guildName: "Luminary", botOffline: true };
    }

    const guild = getGuild(client);
    if (!guild) {
      return { memberCount: 0, onlineCount: 0, guildName: "No server" };
    }

    // Use cache — don't call guild.members.fetch() as it goes through REST API
    const members = guild.members.cache;
    const onlineCount = members.filter(m => 
      m.presence?.status === 'online' || 
      m.presence?.status === 'dnd' || 
      m.presence?.status === 'idle'
    ).size;

    return {
      memberCount: guild.memberCount,
      onlineCount,
      guildName: guild.name,
    };
  } catch (error) {
    console.error("Discord API error:", error);
    return { memberCount: 0, onlineCount: 0, guildName: "Error" };
  }
}

export async function getDiscordMembers() {
  try {
    const client = getSharedBot();
    if (!client) {
      // Fallback: return DB members
      const { db } = await import('./db');
      const { clanMembers } = await import('@shared/schema');
      const dbMembers = await db.select().from(clanMembers);
      return dbMembers.map(m => ({
        discordId: m.discordId,
        username: m.username,
        avatar: m.avatar || '',
        role: m.role || 'Member',
        joinedAt: m.joinedAt || new Date(),
      }));
    }

    const guild = getGuild(client);
    if (!guild) throw new Error('Сервер не найден');

    // Use cache instead of REST fetch
    const members = guild.members.cache;
    const memberData = members
      .filter(member => !member.user.bot)
      .map(member => ({
        discordId: member.user.id,
        username: member.user.globalName || member.user.username,
        avatar: member.user.displayAvatarURL({ size: 256 }),
        role: member.roles.highest.name === '@everyone' ? 'Member' : member.roles.highest.name,
        joinedAt: member.joinedAt || new Date(),
      }));

    return memberData;
  } catch (error: any) {
    console.error("Discord members fetch error:", error);
    throw error;
  }
}

export async function getDiscordChannels() {
  try {
    const client = getSharedBot();
    if (!client) throw new Error('Бот не подключён');

    const guild = getGuild(client);
    if (!guild) throw new Error('Сервер не найден');

    const channels = guild.channels.cache
      .filter(channel => channel.type === 0 || channel.type === 2)
      .map(channel => ({
        id: channel.id,
        name: channel.name,
        type: channel.type,
      }));

    return channels;
  } catch (error: any) {
    console.error("Discord channels fetch error:", error);
    throw error;
  }
}

export async function getVoiceChannels() {
  try {
    // Try shared bot first, then fall back to music system
    let client: Client | null = getSharedBot();
    if (!client) {
      try {
        const { getDistube } = await import('./music-system');
        const distube = getDistube();
        client = distube.client;
      } catch {
        throw new Error('Бот не подключён');
      }
    }
    
    const guild = getGuild(client);
    if (!guild) throw new Error('Сервер не найден');

    const channels = guild.channels.cache
      .filter(channel => channel.type === 2)
      .map(channel => {
        const voiceChannel = channel as any;
        const members = voiceChannel.members?.map((member: any) => ({
          id: member.user.id,
          username: member.user.username,
          displayName: member.displayName || member.user.username,
          avatar: member.user.displayAvatarURL({ size: 64 }),
          isBot: member.user.bot,
        })) || [];
        
        return {
          id: channel.id,
          name: channel.name,
          type: 'voice',
          memberCount: members.length,
          members,
        };
      });

    return channels;
  } catch (error: any) {
    console.error("Discord voice channels fetch error:", error);
    throw error;
  }
}

export async function sendDiscordMessage(channelId: string, message: string) {
  try {
    const client = getSharedBot();
    if (!client) throw new Error('Бот не подключён');

    const channel = client.channels.cache.get(channelId);
    if (!channel || !('send' in channel)) {
      throw new Error('Канал не найден или не является текстовым');
    }

    await (channel as any).send(message);
    return { success: true };
  } catch (error: any) {
    console.error("Discord send message error:", error);
    throw error;
  }
}

export async function kickDiscordMember(userId: string) {
  try {
    const client = getSharedBot();
    if (!client) throw new Error('Бот не подключён');

    const guild = getGuild(client);
    if (!guild) throw new Error('Сервер не найден');

    const member = guild.members.cache.get(userId) || await guild.members.fetch(userId);
    if (!member) throw new Error('Участник не найден');

    await member.kick('Исключен через админ-панель');
    return { success: true };
  } catch (error: any) {
    console.error("Discord kick error:", error);
    throw error;
  }
}

export async function banDiscordMember(userId: string) {
  try {
    const client = getSharedBot();
    if (!client) throw new Error('Бот не подключён');

    const guild = getGuild(client);
    if (!guild) throw new Error('Сервер не найден');

    await guild.members.ban(userId, { reason: 'Забанен через админ-панель' });
    return { success: true };
  } catch (error: any) {
    console.error("Discord ban error:", error);
    throw error;
  }
}

export async function getDiscordMembersForAdmin() {
  try {
    const client = getSharedBot();
    if (!client) throw new Error('Бот не подключён');

    const guild = getGuild(client);
    if (!guild) throw new Error('Сервер не найден');

    const members = guild.members.cache;
    const memberData = members
      .filter(member => !member.user.bot)
      .map(member => ({
        id: member.user.id,
        username: member.user.globalName || member.user.username,
        avatar: member.user.displayAvatarURL({ size: 256 }),
        roles: member.roles.cache.map(r => r.name).filter(n => n !== '@everyone'),
      }));

    return memberData;
  } catch (error: any) {
    console.error("Discord admin members fetch error:", error);
    throw error;
  }
}

export async function assignDiscordRole(discordId: string, roleData: { roleName: string; roleColor?: string; permissions?: string[] }) {
  try {
    const client = getSharedBot();
    if (!client) throw new Error('Бот не подключён');

    const guild = getGuild(client);
    if (!guild) throw new Error('Сервер не найден');

    const member = guild.members.cache.get(discordId) || await guild.members.fetch(discordId);
    if (!member) throw new Error('Участник не найден');

    let role = guild.roles.cache.find(r => r.name === roleData.roleName);
    
    if (!role) {
      const color = roleData.roleColor ? parseInt(roleData.roleColor.replace('#', ''), 16) : undefined;
      const permissions = roleData.permissions || [];
      
      role = await guild.roles.create({
        name: roleData.roleName,
        color: color,
        permissions: permissions,
        reason: 'Создано через систему магазина LumiCoin',
      });
      console.log(`Создана новая роль: ${roleData.roleName} с правами: ${permissions.join(', ')}`);
    } else if (roleData.permissions && roleData.permissions.length > 0) {
      await role.edit({
        permissions: roleData.permissions,
        reason: 'Обновление прав роли из системы магазина',
      });
      console.log(`Обновлены права роли ${roleData.roleName}: ${roleData.permissions.join(', ')}`);
    }

    await member.roles.add(role);
    console.log(`Роль ${roleData.roleName} выдана участнику ${member.user.username}`);
    
    return { success: true, roleName: roleData.roleName };
  } catch (error: any) {
    console.error("Discord role assignment error:", error);
    throw error;
  }
}

export async function getDiscordRoles() {
  try {
    const client = getSharedBot();
    if (!client) throw new Error('Бот не подключён');

    const guild = getGuild(client);
    if (!guild) throw new Error('Сервер не найден');

    const roles = guild.roles.cache
      .filter(role => role.name !== '@everyone' && !role.managed)
      .map(role => ({
        id: role.id,
        name: role.name,
        color: role.color ? `#${role.color.toString(16).padStart(6, '0')}` : null,
        position: role.position,
        permissions: role.permissions.toArray(),
        mentionable: role.mentionable,
        hoist: role.hoist,
      }))
      .sort((a, b) => b.position - a.position);

    return roles;
  } catch (error: any) {
    console.error("Discord roles fetch error:", error);
    throw error;
  }
}

export async function createBeautifulTestRoles() {
  try {
    const client = getSharedBot();
    if (!client) throw new Error('Бот не подключён');

    const guild = getGuild(client);
    if (!guild) throw new Error('Сервер Discord не найден');

    const beautifulRoles = [
      { name: 'Diamond Elite', color: '#B9F2FF', description: 'Сверкающий бриллиантовый статус' },
      { name: 'Cosmic Wanderer', color: '#9D4EDD', description: 'Путешественник по космическим просторам' },
      { name: 'Neon Phoenix', color: '#FF006E', description: 'Возрожденный из пламени неона' },
      { name: 'Aurora Guardian', color: '#06FFA5', description: 'Хранитель северного сияния' },
      { name: 'Golden Legend', color: '#FFD60A', description: 'Легендарный золотой статус' },
      { name: 'Cyber Samurai', color: '#00D9FF', description: 'Воин киберпространства' },
      { name: 'Stardust Mystic', color: '#C77DFF', description: 'Мистик звездной пыли' },
      { name: 'Crimson Blade', color: '#FF4D4D', description: 'Владелец багрового клинка' },
      { name: 'Emerald Knight', color: '#10B981', description: 'Изумрудный рыцарь' },
      { name: 'Void Walker', color: '#4B0082', description: 'Странник пустоты' },
      { name: 'Solar Flare', color: '#FF9500', description: 'Вспышка солнечного света' },
      { name: 'Ocean Spirit', color: '#06B6D4', description: 'Дух океана' }
    ];

    const createdRoles = [];
    
    for (const roleData of beautifulRoles) {
      const existingRole = guild.roles.cache.find(r => r.name === roleData.name);
      const color = parseInt(roleData.color.replace('#', ''), 16);
      
      if (!existingRole) {
        const newRole = await guild.roles.create({
          name: roleData.name,
          color: color,
          reason: 'Красивые декоративные роли для магазина LumiCoin',
          hoist: true,
          mentionable: false
        });
        createdRoles.push({ id: newRole.id, name: newRole.name, color: roleData.color, description: roleData.description });
        console.log(`✨ Создана роль: ${newRole.name} (${roleData.color})`);
        await new Promise(resolve => setTimeout(resolve, 500));
      } else {
        await existingRole.edit({ color: color, hoist: true, mentionable: false });
        createdRoles.push({ id: existingRole.id, name: existingRole.name, color: roleData.color, description: roleData.description });
        console.log(`🔄 Обновлена роль: ${existingRole.name} (${roleData.color})`);
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    return {
      success: true,
      created: createdRoles.length,
      roles: createdRoles,
      message: `Успешно создано ${createdRoles.length} новых ролей в Discord`
    };
  } catch (error: any) {
    console.error('Ошибка при создании тестовых ролей:', error);
    throw error;
  }
}

export async function changeDiscordNickname(discordId: string, newNickname: string) {
  try {
    const client = getSharedBot();
    if (!client) throw new Error('Бот не подключён');

    const guild = getGuild(client);
    if (!guild) throw new Error('Сервер Discord не найден');

    const member = guild.members.cache.get(discordId) || await guild.members.fetch(discordId);
    if (!member) throw new Error('Участник не найден на сервере');

    if (!member.manageable) {
      throw new Error('Недостаточно прав для изменения никнейма этого участника');
    }

    if (newNickname.length > 32) {
      throw new Error('Никнейм не может быть длиннее 32 символов');
    }

    await member.setNickname(newNickname, 'Изменение имени через LumiCoin магазин');

    return {
      success: true,
      oldNickname: member.displayName,
      newNickname: newNickname,
      message: `Никнейм успешно изменён на "${newNickname}"`
    };
  } catch (error: any) {
    console.error('Ошибка при изменении никнейма:', error);
    throw error;
  }
}

// ==================== CHANNEL MANAGEMENT ====================

/**
 * Creates a new Discord channel (text or voice).
 * Rate-limited: 1 channel per call with delay.
 */
export async function createDiscordChannel(options: {
  name: string;
  type: 'text' | 'voice';
  category?: string;
  topic?: string;
}) {
  const client = getSharedBot();
  if (!client) throw new Error('Бот не подключён');

  const guild = getGuild(client);
  if (!guild) throw new Error('Сервер не найден');

  const channelType = options.type === 'voice' ? ChannelType.GuildVoice : ChannelType.GuildText;

  // Find category if specified
  let parent: string | undefined;
  if (options.category) {
    const cat = guild.channels.cache.find(
      c => c.type === ChannelType.GuildCategory && c.name.toLowerCase() === options.category!.toLowerCase()
    );
    if (cat) parent = cat.id;
  }

  const channelData: any = {
    name: options.name,
    type: channelType,
    reason: 'Создан через админ-панель',
  };
  if (parent) channelData.parent = parent;
  if (options.topic && channelType === ChannelType.GuildText) {
    channelData.topic = options.topic;
  }

  const newChannel = await guild.channels.create(channelData);

  return {
    id: newChannel.id,
    name: newChannel.name,
    type: options.type,
  };
}

/**
 * Delete a Discord channel by ID.
 */
export async function deleteDiscordChannel(channelId: string) {
  const client = getSharedBot();
  if (!client) throw new Error('Бот не подключён');

  const channel = client.channels.cache.get(channelId);
  if (!channel) throw new Error('Канал не найден');

  await (channel as any).delete('Удалён через админ-панель');
  return { success: true };
}

/**
 * Get all channels including categories, for display purposes.
 */
export async function getDiscordChannelsDetailed() {
  const client = getSharedBot();
  if (!client) throw new Error('Бот не подключён');

  const guild = getGuild(client);
  if (!guild) throw new Error('Сервер не найден');

  // Get categories
  const categories = guild.channels.cache
    .filter(c => c.type === ChannelType.GuildCategory)
    .map(c => ({ id: c.id, name: c.name }));

  const channels = guild.channels.cache
    .filter(c => c.type === ChannelType.GuildText || c.type === ChannelType.GuildVoice)
    .map(c => ({
      id: c.id,
      name: c.name,
      type: c.type === ChannelType.GuildVoice ? 'voice' : 'text',
      parentId: (c as any).parentId || null,
      parentName: (c as any).parent?.name || null,
    }));

  return { channels, categories };
}

// ==================== MESSAGE MODERATION ====================

// Simple language detection using character ranges and common words
const CYRILLIC_REGEX = /[\u0400-\u04FF]/;
const LATIN_REGEX = /[a-zA-Z]/;

// Common Russian profanity stems (abbreviated to avoid explicit content)
const RU_PROFANITY_STEMS = [
  'бля', 'хуй', 'хуе', 'хуё', 'пизд', 'ебат', 'ебан', 'ёбан', 'сука', 'сук ', 'нахуй', 'нахер',
  'пидор', 'пидар', 'мудак', 'мудил', 'залуп', 'шлюх', 'дебил', 'уёб', 'уеб', 'ублюд',
];

// Common English profanity stems
const EN_PROFANITY_STEMS = [
  'fuck', 'shit', 'bitch', 'asshole', 'dick', 'cunt', 'bastard', 'damn', 'whore', 'slut',
  'retard', 'faggot', 'nigger', 'nigga',
];

// Discrimination keywords (both languages)
const DISCRIMINATION_KEYWORDS = [
  'nigger', 'nigga', 'фашист', 'нацист', 'nazi', 'расист',
  'хохол', 'жид', 'чурк', 'черножоп', 'негр',
  'чёрная обезьяна', 'черная обезьяна', 'monkey',
];

/**
 * Detect predominant language of a text string.
 * Returns 'ru', 'en', or 'unknown'.
 */
function detectLanguage(text: string): 'ru' | 'en' | 'unknown' {
  const cyrillicCount = (text.match(/[\u0400-\u04FF]/g) || []).length;
  const latinCount = (text.match(/[a-zA-Z]/g) || []).length;
  const total = cyrillicCount + latinCount;
  if (total < 3) return 'unknown';
  if (cyrillicCount / total > 0.5) return 'ru';
  if (latinCount / total > 0.5) return 'en';
  return 'unknown';
}

/**
 * Check message content against moderation rules.
 * Returns violations found or null if clean.
 */
export function checkMessageViolations(
  content: string,
  rules: { languageRestriction?: string | null; blockProfanity?: boolean; blockDiscrimination?: boolean }
): { reason: string; reasonDetail: string } | null {
  const lower = content.toLowerCase().trim();
  if (!lower || lower.length < 2) return null;

  // 1) Discrimination check (highest priority)
  if (rules.blockDiscrimination) {
    for (const kw of DISCRIMINATION_KEYWORDS) {
      if (lower.includes(kw)) {
        return { reason: 'discrimination', reasonDetail: `Обнаружена дискриминация: "${kw}"` };
      }
    }
  }

  // 2) Profanity check
  if (rules.blockProfanity) {
    for (const stem of RU_PROFANITY_STEMS) {
      if (lower.includes(stem)) {
        return { reason: 'profanity', reasonDetail: `Обнаружена нецензурная лексика (RU)` };
      }
    }
    for (const stem of EN_PROFANITY_STEMS) {
      if (lower.includes(stem)) {
        return { reason: 'profanity', reasonDetail: `Обнаружена нецензурная лексика (EN)` };
      }
    }
  }

  // 3) Language restriction check
  if (rules.languageRestriction) {
    const lang = detectLanguage(lower);
    if (lang !== 'unknown' && lang !== rules.languageRestriction) {
      const langNames: Record<string, string> = { ru: 'русский', en: 'английский' };
      const expected = langNames[rules.languageRestriction] || rules.languageRestriction;
      const actual = langNames[lang] || lang;
      return { reason: 'wrong_language', reasonDetail: `Ожидается ${expected}, обнаружен ${actual}` };
    }
  }

  return null;
}

/**
 * Scan a Discord channel's recent messages for violations.
 * Rate-limited: fetches max 100 messages per call, with delays.
 */
export async function scanChannelMessages(
  channelId: string,
  rules: { languageRestriction?: string | null; blockProfanity?: boolean; blockDiscrimination?: boolean },
  limit: number = 100
): Promise<Array<{
  messageId: string;
  channelId: string;
  channelName: string;
  authorId: string;
  authorUsername: string;
  content: string;
  reason: string;
  reasonDetail: string;
  messageTimestamp: Date;
}>> {
  const client = getSharedBot();
  if (!client) throw new Error('Бот не подключён');

  const channel = client.channels.cache.get(channelId);
  if (!channel || !(channel instanceof TextChannel)) {
    throw new Error('Текстовый канал не найден');
  }

  // Fetch messages in small batches to avoid rate limiting
  const batchSize = Math.min(limit, 50);
  const messages = await channel.messages.fetch({ limit: batchSize });

  // Small delay to be safe with rate limits
  await new Promise(r => setTimeout(r, 500));

  const violations: Array<{
    messageId: string;
    channelId: string;
    channelName: string;
    authorId: string;
    authorUsername: string;
    content: string;
    reason: string;
    reasonDetail: string;
    messageTimestamp: Date;
  }> = [];

  for (const msg of messages.values()) {
    if (msg.author.bot) continue;
    if (!msg.content || msg.content.length < 2) continue;

    const violation = checkMessageViolations(msg.content, rules);
    if (violation) {
      violations.push({
        messageId: msg.id,
        channelId: channel.id,
        channelName: channel.name,
        authorId: msg.author.id,
        authorUsername: msg.author.username,
        content: msg.content.substring(0, 500),
        reason: violation.reason,
        reasonDetail: violation.reasonDetail,
        messageTimestamp: msg.createdAt,
      });
    }
  }

  return violations;
}

/**
 * Delete specific messages from Discord channels.
 * Rate-limited: deletes in batches with delays between them.
 */
export async function deleteDiscordMessages(messageIds: Array<{ channelId: string; messageId: string }>): Promise<{
  deleted: number;
  failed: number;
  errors: string[];
}> {
  const client = getSharedBot();
  if (!client) throw new Error('Бот не подключён');

  let deleted = 0;
  let failed = 0;
  const errors: string[] = [];

  // Group by channel for bulk delete
  const byChannel = new Map<string, string[]>();
  for (const item of messageIds) {
    const arr = byChannel.get(item.channelId) || [];
    arr.push(item.messageId);
    byChannel.set(item.channelId, arr);
  }

  for (const [channelId, ids] of byChannel) {
    const channel = client.channels.cache.get(channelId);
    if (!channel || !(channel instanceof TextChannel)) {
      failed += ids.length;
      errors.push(`Канал ${channelId} не найден`);
      continue;
    }

    // Try bulk delete (messages < 14 days old), otherwise individual
    try {
      if (ids.length > 1) {
        const result = await channel.bulkDelete(ids, true);
        deleted += result.size;
        const remaining = ids.length - result.size;
        if (remaining > 0) {
          // Delete remaining individually (older than 14 days)
          for (const msgId of ids) {
            try {
              const msg = await channel.messages.fetch(msgId).catch(() => null);
              if (msg && !msg.deleted) {
                await msg.delete();
                deleted++;
              }
            } catch {
              failed++;
            }
            // Rate limit: 250ms between individual deletes
            await new Promise(r => setTimeout(r, 250));
          }
        }
      } else {
        // Single message
        for (const msgId of ids) {
          try {
            const msg = await channel.messages.fetch(msgId).catch(() => null);
            if (msg) {
              await msg.delete();
              deleted++;
            } else {
              failed++;
            }
          } catch {
            failed++;
          }
          await new Promise(r => setTimeout(r, 250));
        }
      }
    } catch (err: any) {
      errors.push(`Ошибка в канале ${channel.name}: ${err.message}`);
      failed += ids.length;
    }

    // Rate limit between channels: 1 second
    await new Promise(r => setTimeout(r, 1000));
  }

  return { deleted, failed, errors };
}
