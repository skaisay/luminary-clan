import { Client, ChannelType, TextChannel, PermissionFlagsBits } from 'discord.js';
import { botClient } from './bot-commands';
import { db } from './db';
import { discordRestrictedUsers } from '@shared/schema';
import { eq } from 'drizzle-orm';

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

    // Fetch fresh channel list from Discord API (cache may be incomplete)
    await guild.channels.fetch();

    // Include text (0), voice (2), announcement (5), forum (15), stage (13)
    const channels = guild.channels.cache
      .filter(channel => [0, 2, 5, 13, 15].includes(channel.type))
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

  // Fetch fresh channel list from Discord API (cache may be incomplete)
  await guild.channels.fetch();

  // Get categories
  const categories = guild.channels.cache
    .filter(c => c.type === ChannelType.GuildCategory)
    .map(c => ({ id: c.id, name: c.name }));

// Include text, voice, announcement (5), forum (15), stage (13) channels
    const TEXT_LIKE = new Set([ChannelType.GuildText, ChannelType.GuildAnnouncement, ChannelType.GuildForum]);
    const VOICE_LIKE = new Set([ChannelType.GuildVoice, ChannelType.GuildStageVoice]);

    const channels = guild.channels.cache
    .filter(c => TEXT_LIKE.has(c.type) || VOICE_LIKE.has(c.type))
    .map(c => ({
      id: c.id,
      name: c.name,
      type: VOICE_LIKE.has(c.type) ? 'voice' : 'text',
      parentId: (c as any).parentId || null,
      parentName: (c as any).parent?.name || null,
    }));

  return { channels, categories };
}

// ==================== MESSAGE MODERATION ====================

// ═══════════════════════════════════════════════════════════════
// ADVANCED MODERATION ENGINE — Anti-evasion, anti-spam, anti-obfuscation
// ═══════════════════════════════════════════════════════════════

// ── Homoglyph map: Latin → Cyrillic lookalikes ──
// Used to detect mixed-script attacks where players substitute 
// Latin chars that look like Cyrillic to bypass detection
const LATIN_TO_CYRILLIC: Record<string, string> = {
  'a': 'а', 'e': 'е', 'o': 'о', 'p': 'р', 'c': 'с', 'x': 'х',
  'y': 'у', 'k': 'к', 'n': 'п', 'm': 'м', 'b': 'в', 'h': 'н',
  't': 'т', 'i': 'і', 'u': 'и',
};
const CYRILLIC_TO_LATIN: Record<string, string> = {
  'а': 'a', 'е': 'e', 'о': 'o', 'р': 'p', 'с': 'c', 'х': 'x',
  'у': 'y', 'к': 'k', 'п': 'n', 'м': 'm', 'в': 'b', 'н': 'h',
  'т': 't', 'і': 'i', 'и': 'u',
};

// Characters to strip before analysis (decorators, zero-width, etc.)
const JUNK_CHARS_REGEX = /[\u200B-\u200F\u2060\uFEFF\u034F\u00AD\u180E⠀​᠎\s\d_\-.,!?;:"'()\[\]{}<>@#$%^&*+=\/\\|~`™®©€£¥°±²³¹₀₁₂₃₄₅₆₇₈₉⁰¹²³⁴⁵⁶⁷⁸⁹]/g;

// Leet-speak / obfuscation substitutions for profanity
const LEET_MAP: Record<string, string> = {
  '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't',
  '@': 'a', '$': 's', '!': 'i', '(': 'c',
};

/**
 * Strip decorators, zero-width chars, symbols, numbers from text.
 * Leaves only actual letters (Latin + Cyrillic).
 */
function stripJunk(text: string): string {
  return text.replace(JUNK_CHARS_REGEX, '');
}

/**
 * Normalize a string by converting all homoglyphs to a consistent script.
 * If targetScript is 'cyrillic', Latin lookalikes → Cyrillic.
 * If targetScript is 'latin', Cyrillic lookalikes → Latin.
 */
function normalizeHomoglyphs(text: string, targetScript: 'cyrillic' | 'latin'): string {
  const map = targetScript === 'cyrillic' ? LATIN_TO_CYRILLIC : CYRILLIC_TO_LATIN;
  return text.split('').map(ch => map[ch] || ch).join('');
}

/**
 * Normalize leet-speak / obfuscation: replace 0→o, @→a, etc.
 */
function normalizeLeet(text: string): string {
  return text.split('').map(ch => LEET_MAP[ch] || ch).join('');
}

/**
 * Full normalization pipeline for moderation.
 * Exported for reuse in bot-commands.ts
 */
export function normalizeForModeration(text: string): string {
  let t = text.toLowerCase();
  t = normalizeLeet(t);
  // Remove repeating characters (>2) to handle "fuuuuck" → "fuck"
  t = t.replace(/(.)\1{2,}/g, '$1$1');
  return t;
}

// Common Russian profanity stems (abbreviated to avoid explicit content)
const RU_PROFANITY_STEMS = [
  'бля', 'хуй', 'хуе', 'хуё', 'пизд', 'ебат', 'ебан', 'ёбан', 'сука', 'сук ',
  'нахуй', 'нахер', 'пидор', 'пидар', 'мудак', 'мудил', 'залуп', 'шлюх',
  'дебил', 'уёб', 'уеб', 'ублюд', 'блят', 'пиздец', 'хуяр', 'ёб ', 'еб ',
  'хер ', 'херов', 'сучк', 'сучар', 'пидр', 'ахуе', 'охуе', 'отъеб', 'отьеб',
];

// Russian profanity written in Latin letters (transliteration bypass)
const RU_TRANSLIT_PROFANITY = [
  'suka', 'cyka', 'blyat', 'blya', 'blyad', 'bliad', 'bliat', 'nahui', 'nahuy',
  'naher', 'pidar', 'pidor', 'pidoras', 'pidr', 'mudak', 'mudila', 'ebat',
  'ebal', 'eban', 'eblan', 'ebaniy', 'ebanyj', 'huy', 'hui', 'huya', 'huye',
  'huynya', 'pizda', 'pizdec', 'pizdet', 'pizdez', 'pizdato', 'zalupa',
  'shlya', 'shlyuha', 'suchka', 'suchar', 'ueban', 'uebok', 'debil',
  'yoban', 'yob', 'yobany', 'gandon', 'dolboeb', 'dolboyob', 'zalupа',
  'ohuel', 'ohuet', 'ahuet', 'ahuel', 'nahren', 'blet', 'bled',
  'syka', 'suca', 'bl9d', 'bl9t', 'p1zda', 'p1zd', 'xu9', 'xyu', 'xyй',
  'pzdc', 'pzd', 'huyesos', 'pidorас', 'ped1k', 'pederast',
];

// Common English profanity stems
const EN_PROFANITY_STEMS = [
  'fuck', 'shit', 'bitch', 'asshole', 'dick', 'cunt', 'bastard', 'damn',
  'whore', 'slut', 'retard', 'faggot', 'nigger', 'nigga', 'stfu', 'wtf',
  'fck', 'fcuk', 'phuck', 'biatch', 'btch',
];

// Discrimination keywords (both languages)
const DISCRIMINATION_KEYWORDS = [
  'nigger', 'nigga', 'фашист', 'нацист', 'nazi', 'расист',
  'хохол', 'жид', 'чурк', 'черножоп', 'негр',
  'чёрная обезьяна', 'черная обезьяна', 'monkey',
  'расизм', 'white power', 'white suprem', 'heil', 'зига', 'зиг хайл',
];

// ─── ADVANCED LANGUAGE DETECTION ────────────────────────────────

/**
 * Detect language of a SINGLE WORD after junk stripping.
 * Returns 'ru', 'en', 'mixed', or 'unknown'.
 */
function detectWordLanguage(word: string): 'ru' | 'en' | 'mixed' | 'unknown' {
  const clean = stripJunk(word);
  if (clean.length < 1) return 'unknown';
  const cyrillic = (clean.match(/[\u0400-\u04FF]/g) || []).length;
  const latin = (clean.match(/[a-zA-Z]/g) || []).length;
  if (cyrillic === 0 && latin === 0) return 'unknown';
  // If BOTH scripts present in single word → mixed (evasion attempt)
  if (cyrillic > 0 && latin > 0) return 'mixed';
  if (cyrillic > 0) return 'ru';
  if (latin > 0) return 'en';
  return 'unknown';
}

/**
 * Advanced language detection for full message.
 * Analyzes per-word to catch mixed-language evasion.
 * Returns detected language, list of foreign/mixed words count, and confidence.
 */
function detectLanguageAdvanced(text: string): {
  primary: 'ru' | 'en' | 'unknown';
  foreignWords: number;
  mixedWords: number;
  totalWords: number;
  confidence: number;
} {
  // Split on whitespace + common separators
  const words = text.split(/[\s,.!?;:\-_|/\\]+/).filter(w => stripJunk(w).length >= 2);
  if (words.length === 0) return { primary: 'unknown', foreignWords: 0, mixedWords: 0, totalWords: 0, confidence: 0 };

  let ruWords = 0, enWords = 0, mixedWords = 0, unknownWords = 0;
  for (const word of words) {
    const lang = detectWordLanguage(word);
    switch (lang) {
      case 'ru': ruWords++; break;
      case 'en': enWords++; break;
      case 'mixed': mixedWords++; break;
      default: unknownWords++; break;
    }
  }

  const identifiedWords = ruWords + enWords + mixedWords;
  if (identifiedWords === 0) return { primary: 'unknown', foreignWords: 0, mixedWords, totalWords: words.length, confidence: 0 };

  let primary: 'ru' | 'en' | 'unknown';
  let foreignWords: number;
  if (ruWords >= enWords) {
    primary = 'ru';
    foreignWords = enWords;
  } else {
    primary = 'en';
    foreignWords = ruWords;
  }

  const confidence = (Math.max(ruWords, enWords) + mixedWords) / identifiedWords;
  return { primary, foreignWords, mixedWords, totalWords: words.length, confidence };
}

/**
 * Check message content against moderation rules.
 * Returns violations found or null if clean.
 * 
 * Anti-evasion features:
 * - Homoglyph normalization (Latin a→Cyrillic а, etc.)
 * - Leet-speak normalization (@ → a, $ → s, etc.)
 * - Repeated character collapsing (fuuuck → fuck)
 * - Per-word language detection (catches even 1 foreign word)
 * - Mixed-script word detection (пpивeт with Latin lookalikes)
 * - Symbol/decorator stripping
 */
export function checkMessageViolations(
  content: string,
  rules: { languageRestriction?: string | null; blockProfanity?: boolean; blockDiscrimination?: boolean }
): { reason: string; reasonDetail: string } | null {
  if (!content || content.trim().length === 0) return null;

  // For very short messages (1 char), only check language restriction, skip profanity
  const isVeryShort = content.trim().length < 2;

  // Full normalization pipeline
  const normalized = normalizeForModeration(content);
  // Also create a version with homoglyphs resolved both ways
  const asCyrillic = normalizeHomoglyphs(normalized, 'cyrillic');
  const asLatin = normalizeHomoglyphs(normalized, 'latin');
  // Stripped version (letters only, no symbols/spaces)
  const stripped = stripJunk(normalized);
  const strippedCyr = stripJunk(asCyrillic);
  const strippedLat = stripJunk(asLatin);

  // 1) Discrimination check (highest priority) — check all normalized versions
  if (rules.blockDiscrimination && !isVeryShort) {
    for (const kw of DISCRIMINATION_KEYWORDS) {
      if (normalized.includes(kw) || asCyrillic.includes(kw) || asLatin.includes(kw)
          || stripped.includes(kw.replace(/\s/g, ''))
          || strippedCyr.includes(kw.replace(/\s/g, ''))
          || strippedLat.includes(kw.replace(/\s/g, ''))) {
        return { reason: 'discrimination', reasonDetail: `Обнаружена дискриминация` };
      }
    }
  }

  // 2) Profanity check — check normalized + homoglyph versions + stripped
  if (rules.blockProfanity && !isVeryShort) {
    for (const stem of RU_PROFANITY_STEMS) {
      const stemClean = stem.trim();
      if (normalized.includes(stemClean) || asCyrillic.includes(stemClean)
          || stripped.includes(stemClean.replace(/\s/g, ''))
          || strippedCyr.includes(stemClean.replace(/\s/g, ''))) {
        return { reason: 'profanity', reasonDetail: `Нецензурная лексика (RU)` };
      }
    }
    for (const stem of EN_PROFANITY_STEMS) {
      if (normalized.includes(stem) || asLatin.includes(stem)
          || stripped.includes(stem) || strippedLat.includes(stem)) {
        return { reason: 'profanity', reasonDetail: `Нецензурная лексика (EN)` };
      }
    }
    // 2b) Russian profanity in Latin transliteration (suka, blyat, nahui etc.)
    for (const stem of RU_TRANSLIT_PROFANITY) {
      if (normalized.includes(stem) || asLatin.includes(stem)
          || stripped.includes(stem) || strippedLat.includes(stem)) {
        return { reason: 'profanity', reasonDetail: `Нецензурная лексика (транслит RU→EN)` };
      }
    }
  }

  // 3) Language restriction check — per-word analysis with anti-evasion
  if (rules.languageRestriction) {
    // For very short messages (1-2 chars), do direct character check
    const cleanContent = stripJunk(content);
    if (cleanContent.length > 0 && cleanContent.length <= 2) {
      const hasCyrillic = /[\u0400-\u04FF]/.test(cleanContent);
      const hasLatin = /[a-zA-Z]/.test(cleanContent);
      if (rules.languageRestriction === 'en' && hasCyrillic && !hasLatin) {
        return { reason: 'wrong_language', reasonDetail: 'Кириллические символы в English-only канале' };
      }
      if (rules.languageRestriction === 'ru' && hasLatin && !hasCyrillic) {
        return { reason: 'wrong_language', reasonDetail: 'Латинские символы в Russian-only канале' };
      }
    }

    const analysis = detectLanguageAdvanced(content);

    // Any mixed-script word is an evasion attempt → violation
    if (analysis.mixedWords > 0) {
      const langNames: Record<string, string> = { ru: 'русский', en: 'английский' };
      const expected = langNames[rules.languageRestriction] || rules.languageRestriction;
      return {
        reason: 'wrong_language',
        reasonDetail: `Обнаружена попытка обхода: смешанные скрипты в словах (ожидается ${expected})`,
      };
    }

    // If primary detected language differs from required
    if (analysis.primary !== 'unknown' && analysis.primary !== rules.languageRestriction) {
      const langNames: Record<string, string> = { ru: 'русский', en: 'английский' };
      const expected = langNames[rules.languageRestriction] || rules.languageRestriction;
      const actual = langNames[analysis.primary] || analysis.primary;
      return { reason: 'wrong_language', reasonDetail: `Ожидается ${expected}, обнаружен ${actual}` };
    }

    // Even if primary matches, if there are ANY foreign words → violation
    // (catches: "Hello world привет" in an English channel where primary is en but has 1 RU word)
    if (analysis.foreignWords > 0 && analysis.totalWords >= 2) {
      const langNames: Record<string, string> = { ru: 'русский', en: 'английский' };
      const expected = langNames[rules.languageRestriction] || rules.languageRestriction;
      const foreignLang = rules.languageRestriction === 'en' ? 'русские' : 'английские';
      return {
        reason: 'wrong_language',
        reasonDetail: `В тексте обнаружены ${foreignLang} слова (канал: только ${expected})`,
      };
    }

    // Check via homoglyph normalization — after converting all to target script,
    // see if the "pure" text reveals hidden foreign characters
    if (rules.languageRestriction === 'en') {
      // Force all to Latin, then check for remaining Cyrillic
      const forcedLatin = normalizeHomoglyphs(normalized, 'latin');
      const remainingCyrillic = (forcedLatin.match(/[\u0400-\u04FF]/g) || []).length;
      if (remainingCyrillic > 0) {
        return {
          reason: 'wrong_language',
          reasonDetail: 'Обнаружены кириллические символы (канал: только английский)',
        };
      }
    } else if (rules.languageRestriction === 'ru') {
      // Force all to Cyrillic, then check for remaining Latin
      const forcedCyrillic = normalizeHomoglyphs(normalized, 'cyrillic');
      const remainingLatin = (forcedCyrillic.match(/[a-zA-Z]/g) || []).length;
      // Allow some tolerance — short English abbreviations like "ok", "lol" in Russian chat
      if (remainingLatin > 3) {
        return {
          reason: 'wrong_language',
          reasonDetail: 'Обнаружены латинские символы (канал: только русский)',
        };
      }
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

// ═══════════════════════════════════════════════════════════════
// SOFT-BAN (RESTRICT) SYSTEM
// Uses a "🔇 Restricted" role that removes Send Messages + Connect
// in ALL channels. User can still VIEW content but cannot interact.
// ═══════════════════════════════════════════════════════════════

export const RESTRICTED_ROLE_NAME = '🔇 Restricted';

/**
 * Get or create the "Restricted" role that blocks all messaging/voice.
 * Sets channel-level permission overwrites for ALL channels.
 */
export async function getOrCreateRestrictedRole(guild: any) {
  let role = guild.roles.cache.find((r: any) => r.name === RESTRICTED_ROLE_NAME);

  if (!role) {
    // Create the role with no permissions (all denied at channel level)
    role = await guild.roles.create({
      name: RESTRICTED_ROLE_NAME,
      color: 0x808080, // grey
      reason: 'Luminary soft-ban system — restricts user from messaging/voice',
      permissions: [], // no server-level permissions
      mentionable: false,
      hoist: false,
    });
    console.log(`[RESTRICT] Created role: ${RESTRICTED_ROLE_NAME} (${role.id})`);
  }

  // Ensure all channels have the deny overwrite for this role
  const channels = guild.channels.cache.values();
  for (const channel of channels) {
    if (channel.type === ChannelType.GuildCategory) continue; // skip categories
    try {
      // Check if overwrite already exists
      const existing = channel.permissionOverwrites?.cache?.get(role.id);
      if (!existing) {
        await channel.permissionOverwrites.create(role, {
          SendMessages: false,
          SendMessagesInThreads: false,
          CreatePublicThreads: false,
          CreatePrivateThreads: false,
          AddReactions: false,
          Connect: false,   // blocks voice
          Speak: false,     // blocks voice speak
        });
        // Small delay to avoid rate limits
        await new Promise(r => setTimeout(r, 100));
      }
    } catch (err: any) {
      console.error(`[RESTRICT] Failed to set overwrites for #${channel.name}: ${err.message}`);
    }
  }

  return role;
}

/**
 * Soft-ban a user: assign Restricted role.
 * If user is on the server — restrict immediately.
 * If user is NOT on the server — save to DB pre-ban list (auto-restrict on join).
 */
export async function softBanUser(discordId: string, reason?: string): Promise<{
  success: boolean;
  username: string;
  message: string;
}> {
  const client = getSharedBot();
  if (!client) throw new Error('Бот не подключён');

  const guild = getGuild(client);
  if (!guild) throw new Error('Сервер Discord не найден');

  const member = guild.members.cache.get(discordId) || await guild.members.fetch(discordId).catch(() => null);

  // Always save to DB pre-ban list (so it persists across restarts and covers non-members)
  try {
    await db.insert(discordRestrictedUsers)
      .values({ discordId, reason: reason || null })
      .onConflictDoUpdate({
        target: discordRestrictedUsers.discordId,
        set: { isActive: true, reason: reason || null },
      });
  } catch (dbErr: any) {
    console.error('[RESTRICT] DB save error:', dbErr.message);
  }

  // If user is NOT on the server — pre-ban saved, will apply on join
  if (!member) {
    console.log(`[RESTRICT] Pre-banned ID ${discordId} (not on server). Will restrict on join.`);
    return {
      success: true,
      username: discordId,
      message: `ID ${discordId} добавлен в список ограничений. Ограничения применятся автоматически при входе на сервер.`,
    };
  }

  if (!member.manageable) {
    throw new Error('Недостаточно прав для ограничения этого участника (роль бота ниже)');
  }

  // Check if already restricted
  if (member.roles.cache.some((r: any) => r.name === RESTRICTED_ROLE_NAME)) {
    return {
      success: true,
      username: member.user.username,
      message: `${member.user.username} уже ограничен`,
    };
  }

  const role = await getOrCreateRestrictedRole(guild);
  await member.roles.add(role, reason || 'Soft-ban через админ-панель Luminary');

  // Disconnect from voice if currently connected
  if (member.voice?.channel) {
    try {
      await member.voice.disconnect('Soft-ban: ограничение доступа');
    } catch {}
  }

  // Send DM notification
  try {
    await member.send({
      content: `🔇 **Luminary Moderation**\n\nВы были ограничены на сервере. Вы можете просматривать каналы, но не можете писать сообщения или подключаться к голосовым каналам.\n${reason ? `Причина: ${reason}` : ''}`,
    });
  } catch {} // DMs might be disabled

  console.log(`[RESTRICT] Soft-banned ${member.user.username} (${discordId}). Reason: ${reason || 'N/A'}`);

  return {
    success: true,
    username: member.user.username,
    message: `${member.user.username} ограничен — не может писать и подключаться к голосу`,
  };
}

/**
 * Remove soft-ban: remove Restricted role.
 */
export async function softUnbanUser(discordId: string): Promise<{
  success: boolean;
  username: string;
  message: string;
}> {
  // Always remove from DB pre-ban list
  try {
    await db.update(discordRestrictedUsers)
      .set({ isActive: false })
      .where(eq(discordRestrictedUsers.discordId, discordId));
  } catch (dbErr: any) {
    console.error('[RESTRICT] DB remove error:', dbErr.message);
  }

  const client = getSharedBot();
  if (!client) throw new Error('Бот не подключён');

  const guild = getGuild(client);
  if (!guild) throw new Error('Сервер Discord не найден');

  const member = guild.members.cache.get(discordId) || await guild.members.fetch(discordId).catch(() => null);

  // If user is not on server, just remove from DB (already done above)
  if (!member) {
    console.log(`[RESTRICT] Removed pre-ban for ID ${discordId} (not on server)`);
    return {
      success: true,
      username: discordId,
      message: `ID ${discordId} убран из списка ограничений`,
    };
  }

  const role = guild.roles.cache.find((r: any) => r.name === RESTRICTED_ROLE_NAME);
  if (!role || !member.roles.cache.has(role.id)) {
    return {
      success: true,
      username: member.user.username,
      message: `${member.user.username} не был ограничен`,
    };
  }

  await member.roles.remove(role, 'Soft-ban снят через админ-панель Luminary');

  // Send DM notification
  try {
    await member.send({
      content: `✅ **Luminary Moderation**\n\nОграничения сняты! Вы снова можете писать сообщения и подключаться к голосовым каналам.`,
    });
  } catch {}

  console.log(`[RESTRICT] Soft-unbanned ${member.user.username} (${discordId})`);

  return {
    success: true,
    username: member.user.username,
    message: `${member.user.username} разбанен — ограничения сняты`,
  };
}

/**
 * Get list of currently soft-banned (restricted) users.
 * Merges Discord role members + DB pre-ban list.
 */
export async function getSoftBannedUsers(): Promise<Array<{
  id: string;
  username: string;
  avatar: string;
  restrictedSince: string;
  isPreBan: boolean;
}>> {
  const results: Array<{ id: string; username: string; avatar: string; restrictedSince: string; isPreBan: boolean }> = [];
  const seenIds = new Set<string>();

  // 1) Get members with restricted role from Discord
  const client = getSharedBot();
  if (client) {
    const guild = getGuild(client);
    if (guild) {
      const role = guild.roles.cache.find((r: any) => r.name === RESTRICTED_ROLE_NAME);
      if (role) {
        const members = role.members;
        members.forEach((m: any) => {
          seenIds.add(m.user.id);
          results.push({
            id: m.user.id,
            username: m.user.username,
            avatar: m.user.displayAvatarURL({ size: 64 }),
            restrictedSince: m.roles.cache.get(role.id)?.createdAt?.toISOString() || new Date().toISOString(),
            isPreBan: false,
          });
        });
      }
    }
  }

  // 2) Get pre-banned users from DB (not yet on server, or role not yet applied)
  try {
    const dbRestricted = await db.select().from(discordRestrictedUsers)
      .where(eq(discordRestrictedUsers.isActive, true));
    for (const entry of dbRestricted) {
      if (!seenIds.has(entry.discordId)) {
        seenIds.add(entry.discordId);
        results.push({
          id: entry.discordId,
          username: `ID: ${entry.discordId}`,
          avatar: '',
          restrictedSince: entry.createdAt?.toISOString() || new Date().toISOString(),
          isPreBan: true,
        });
      }
    }
  } catch (dbErr: any) {
    if (!dbErr.message?.includes('does not exist')) {
      console.error('[RESTRICT] DB fetch error:', dbErr.message);
    }
  }

  return results;
}

/**
 * Check if a Discord user ID is in the pre-ban list.
 * Called from guildMemberAdd to auto-restrict on join.
 */
export async function checkPreBan(discordId: string): Promise<boolean> {
  try {
    const entry = await db.select().from(discordRestrictedUsers)
      .where(eq(discordRestrictedUsers.discordId, discordId))
      .limit(1);
    return entry.length > 0 && entry[0].isActive;
  } catch {
    return false;
  }
}
