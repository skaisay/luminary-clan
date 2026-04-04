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

/**
 * Set a nickname color for a user by creating/reusing a personal color role.
 * Discord shows the color of the highest-positioned role.
 */
export async function setNicknameColor(discordId: string, hexColor: string): Promise<{ success: boolean; roleName: string; color: string }> {
  const client = getSharedBot();
  if (!client) throw new Error('Бот не подключён');
  const guild = getGuild(client);
  if (!guild) throw new Error('Сервер не найден');

  const member = guild.members.cache.get(discordId) || await guild.members.fetch(discordId);
  if (!member) throw new Error('Участник не найден');

  const colorRoleName = `🎨 ${member.user.username}`;
  const colorInt = parseInt(hexColor.replace('#', ''), 16);

  // Check if user already has a personal color role
  let existingRole = guild.roles.cache.find(r => r.name === colorRoleName);

  if (existingRole) {
    // Update existing role color
    await existingRole.edit({ color: colorInt, reason: 'Обновление цвета никнейма через магазин' });
  } else {
    // Remove any old color roles from this user (prefix 🎨)
    const oldColorRoles = member.roles.cache.filter(r => r.name.startsWith('🎨 '));
    for (const [, role] of oldColorRoles) {
      await member.roles.remove(role);
      // Delete role if no other members have it
      if (role.members.size <= 1) {
        await role.delete('Старая цветовая роль');
      }
    }

    // Create new color role at a high position
    const botRole = guild.members.me?.roles.highest;
    const position = botRole ? botRole.position - 1 : 1;

    existingRole = await guild.roles.create({
      name: colorRoleName,
      color: colorInt,
      hoist: false,
      mentionable: false,
      position: Math.max(1, position),
      reason: 'Цвет никнейма через LumiCoin магазин',
    });
  }

  // Assign the role
  if (!member.roles.cache.has(existingRole.id)) {
    await member.roles.add(existingRole, 'Цвет никнейма');
  }

  return { success: true, roleName: existingRole.name, color: hexColor };
}

/**
 * Get a member's Discord info for preview card.
 */
export async function getDiscordMemberPreview(discordId: string) {
  const client = getSharedBot();
  if (!client) throw new Error('Бот не подключён');
  const guild = getGuild(client);
  if (!guild) throw new Error('Сервер не найден');

  const member = guild.members.cache.get(discordId) || await guild.members.fetch(discordId);
  if (!member) throw new Error('Участник не найден');

  const user = member.user;
  // Fetch full user to get banner
  const fullUser = await user.fetch(true);

  return {
    id: user.id,
    username: user.username,
    displayName: member.displayName,
    avatar: user.displayAvatarURL({ size: 256 }),
    banner: fullUser.bannerURL({ size: 512 }) || null,
    bannerColor: fullUser.hexAccentColor || null,
    highestRoleColor: member.displayHexColor !== '#000000' ? member.displayHexColor : null,
    status: member.presence?.status || 'offline',
    roles: member.roles.cache
      .filter(r => r.id !== guild.id)
      .sort((a, b) => b.position - a.position)
      .map(r => ({ id: r.id, name: r.name, color: r.hexColor }))
      .slice(0, 10),
  };
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
  allowedRoleIds?: string[]; // If provided, only these roles can see the channel
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
    reason: 'Created via admin panel / Создан через админ-панель',
  };
  if (parent) channelData.parent = parent;
  if (options.topic && channelType === ChannelType.GuildText) {
    channelData.topic = options.topic;
  }

  // Set role-based permissions: deny @everyone, allow only specified roles
  if (options.allowedRoleIds && options.allowedRoleIds.length > 0) {
    channelData.permissionOverwrites = [
      // Deny @everyone from viewing
      {
        id: guild.id, // @everyone role ID = guild ID
        deny: [PermissionFlagsBits.ViewChannel],
      },
      // Allow bot to see the channel
      ...(client.user ? [{
        id: client.user.id,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
      }] : []),
      // Allow specified roles
      ...options.allowedRoleIds.map(roleId => ({
        id: roleId,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.Connect],
      })),
    ];
  }

  const newChannel = await guild.channels.create(channelData);

  return {
    id: newChannel.id,
    name: newChannel.name,
    type: options.type,
  };
}

/**
 * Get all roles from the guild.
 */
export async function getDiscordRoles() {
  const client = getSharedBot();
  if (!client) throw new Error('Бот не подключён');
  const guild = getGuild(client);
  if (!guild) throw new Error('Сервер не найден');

  await guild.roles.fetch();
  const roles = guild.roles.cache
    .filter(r => r.id !== guild.id) // Exclude @everyone
    .sort((a, b) => b.position - a.position)
    .map(r => ({
      id: r.id,
      name: r.name,
      color: r.hexColor,
      position: r.position,
      memberCount: r.members.size,
    }));

  return roles;
}

/**
 * Create a new Discord role.
 */
export async function createDiscordRole(data: { name: string; color?: string; hoist?: boolean; mentionable?: boolean }) {
  const client = getSharedBot();
  if (!client) throw new Error('Бот не подключён');
  const guild = getGuild(client);
  if (!guild) throw new Error('Сервер не найден');

  const color = data.color ? parseInt(data.color.replace('#', ''), 16) : undefined;
  const role = await guild.roles.create({
    name: data.name,
    color,
    hoist: data.hoist ?? false,
    mentionable: data.mentionable ?? false,
    reason: 'Создано через админ-панель',
  });

  return { id: role.id, name: role.name, color: role.hexColor, position: role.position };
}

/**
 * Edit an existing Discord role.
 */
export async function editDiscordRole(roleId: string, data: { name?: string; color?: string; hoist?: boolean; mentionable?: boolean }) {
  const client = getSharedBot();
  if (!client) throw new Error('Бот не подключён');
  const guild = getGuild(client);
  if (!guild) throw new Error('Сервер не найден');

  const role = guild.roles.cache.get(roleId);
  if (!role) throw new Error('Роль не найдена');
  if (role.managed) throw new Error('Эта роль управляется интеграцией и не может быть изменена');

  const updates: any = {};
  if (data.name !== undefined) updates.name = data.name;
  if (data.color !== undefined) updates.color = parseInt(data.color.replace('#', ''), 16);
  if (data.hoist !== undefined) updates.hoist = data.hoist;
  if (data.mentionable !== undefined) updates.mentionable = data.mentionable;
  updates.reason = 'Изменено через админ-панель';

  await role.edit(updates);
  return { id: role.id, name: role.name, color: role.hexColor };
}

/**
 * Delete a Discord role.
 */
export async function deleteDiscordRole(roleId: string) {
  const client = getSharedBot();
  if (!client) throw new Error('Бот не подключён');
  const guild = getGuild(client);
  if (!guild) throw new Error('Сервер не найден');

  const role = guild.roles.cache.get(roleId);
  if (!role) throw new Error('Роль не найдена');
  if (role.managed) throw new Error('Эта роль управляется интеграцией и не может быть удалена');

  await role.delete('Удалена через админ-панель');
  return { success: true };
}

/**
 * Assign a role to a member.
 */
export async function addRoleToMember(discordId: string, roleId: string) {
  const client = getSharedBot();
  if (!client) throw new Error('Бот не подключён');
  const guild = getGuild(client);
  if (!guild) throw new Error('Сервер не найден');

  const member = guild.members.cache.get(discordId) || await guild.members.fetch(discordId);
  if (!member) throw new Error('Участник не найден');
  const role = guild.roles.cache.get(roleId);
  if (!role) throw new Error('Роль не найдена');

  await member.roles.add(role, 'Назначено через админ-панель');
  return { success: true, memberName: member.user.username, roleName: role.name };
}

/**
 * Remove a role from a member.
 */
export async function removeRoleFromMember(discordId: string, roleId: string) {
  const client = getSharedBot();
  if (!client) throw new Error('Бот не подключён');
  const guild = getGuild(client);
  if (!guild) throw new Error('Сервер не найден');

  const member = guild.members.cache.get(discordId) || await guild.members.fetch(discordId);
  if (!member) throw new Error('Участник не найден');
  const role = guild.roles.cache.get(roleId);
  if (!role) throw new Error('Роль не найдена');

  await member.roles.remove(role, 'Снято через админ-панель');
  return { success: true, memberName: member.user.username, roleName: role.name };
}

/**
 * Get server activity statistics from DB.
 */
export async function getServerActivityStats() {
  const client = getSharedBot();
  if (!client) throw new Error('Бот не подключён');
  const guild = getGuild(client);
  if (!guild) throw new Error('Сервер не найден');

  const totalMembers = guild.memberCount;
  const onlineMembers = guild.members.cache.filter(m => m.presence?.status !== 'offline' && m.presence?.status !== undefined).size;
  const textChannels = guild.channels.cache.filter(c => c.type === ChannelType.GuildText).size;
  const voiceChannels = guild.channels.cache.filter(c => c.type === ChannelType.GuildVoice).size;
  const rolesCount = guild.roles.cache.size - 1; // exclude @everyone
  const boostLevel = guild.premiumTier;
  const boostCount = guild.premiumSubscriptionCount || 0;

  return {
    totalMembers,
    onlineMembers,
    textChannels,
    voiceChannels,
    rolesCount,
    boostLevel,
    boostCount,
    createdAt: guild.createdAt.toISOString(),
    guildName: guild.name,
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
  't': 'т', 'i': 'і', 'u': 'и', 'd': 'д', 'r': 'г',
};
const CYRILLIC_TO_LATIN: Record<string, string> = {
  'а': 'a', 'е': 'e', 'о': 'o', 'р': 'p', 'с': 'c', 'х': 'x',
  'у': 'y', 'к': 'k', 'п': 'n', 'м': 'm', 'в': 'b', 'н': 'h',
  'т': 't', 'і': 'i', 'и': 'u', 'д': 'd', 'г': 'r',
};

// Characters to strip before analysis (decorators, zero-width, etc.)
const JUNK_CHARS_REGEX = /[\u200B-\u200F\u2060\uFEFF\u034F\u00AD\u180E⠀​᠎\s\d_\-.,!?;:"'()\[\]{}<>@#$%^&*+=\/\\|~`™®©€£¥°±²³¹₀₁₂₃₄₅₆₇₈₉⁰¹²³⁴⁵⁶⁷⁸⁹•*·★☆♡♥❤️💀🖕🤬😡×÷→←↑↓▪▫●○◎◇◆■□¤§¶†‡※‼️⁉️‽]/g;

// Leet-speak / obfuscation substitutions for profanity
const LEET_MAP: Record<string, string> = {
  '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '8': 'b', '9': 'g',
  '@': 'a', '$': 's', '!': 'i', '(': 'c', ')': 'j',
  '¡': 'i', '€': 'e', '£': 'l', '¥': 'y',
  'ё': 'е', // Russian ё → е for stem matching
  'й': 'и', // й → и for looser matching
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
  // Remove repeating characters (>1) — "шлюююха" → "шлюха", "fuuuck" → "fuck"
  t = t.replace(/(.)\1{1,}/g, '$1');
  return t;
}

/**
 * Generate multiple normalized variants of the text for matching.
 * Each variant applies a different deobfuscation strategy.
 */
function getMatchVariants(content: string): string[] {
  const lower = content.toLowerCase();
  const leet = normalizeLeet(lower);
  
  // Standard normalization
  const norm = normalizeForModeration(content);
  
  // ё → е normalization (critical for Russian profanity)
  const normYo = norm.replace(/ё/g, 'е');
  
  // Homoglyph variants
  const asCyr = normalizeHomoglyphs(norm, 'cyrillic');
  const asLat = normalizeHomoglyphs(norm, 'latin');
  const asCyrYo = asCyr.replace(/ё/g, 'е');
  
  // Per-word stripped: remove junk from each word individually but keep spaces
  // This catches "ш.л.ю.х.а тут" → "шлюха тут" without creating cross-word false positives
  const wordStrip = (s: string) => s.split(/\s+/).map(w => w.replace(/[^a-zа-яёі]/g, '')).filter(Boolean).join(' ');
  const wordStripped = wordStrip(norm);
  const wordStrippedCyr = wordStrip(asCyr);
  const wordStrippedYo = wordStripped.replace(/ё/g, 'е');
  
  // Fully stripped (letters only, no spaces) — used ONLY for short text / evasion detection
  const stripped = stripJunk(norm);
  const rawLettersOnly = lower.replace(/[^a-zа-яёі]/g, '');
  const rawLettersNorm = rawLettersOnly.replace(/(.)\1{1,}/g, '$1');
  
  // Leet + stripped
  const leetStripped = stripJunk(leet).replace(/(.)\1{1,}/g, '$1');
  const leetCyr = normalizeHomoglyphs(leetStripped, 'cyrillic');
  
  return [
    // Spaced variants (safe — word boundaries preserved)
    norm, normYo, asCyr, asCyrYo, asLat,
    wordStripped, wordStrippedCyr, wordStrippedYo,
    // Stripped variants (no spaces — only checked for short text)
    stripped, rawLettersNorm, leetStripped, leetCyr,
  ];
}

/**
 * Check if any variant contains the given stem.
 * For spaced variants: checks per-word + adjacent 2-3 word groups.
 * For stripped variants: only checks if text is short (likely evasion, not normal sentence).
 */
function matchesStem(variants: string[], stem: string): boolean {
  const cleanStem = stem.trim().replace(/\s/g, '');
  if (cleanStem.length === 0) return false;
  for (const v of variants) {
    if (v.includes(' ')) {
      // Spaced variant — check per-word and adjacent groups
      const words = v.split(/\s+/).filter(w => w.length > 0);
      for (const w of words) {
        if (w.includes(cleanStem)) return true;
      }
      for (let i = 0; i < words.length - 1; i++) {
        if ((words[i] + words[i + 1]).includes(cleanStem)) return true;
      }
      for (let i = 0; i < words.length - 2; i++) {
        if ((words[i] + words[i + 1] + words[i + 2]).includes(cleanStem)) return true;
      }
    } else if (v.length > 0 && v.length <= 30) {
      // Stripped variant — only check short text to avoid cross-word false positives
      if (v.includes(cleanStem)) return true;
    }
  }
  return false;
}

// ── REGEX-BASED ROOT PATTERNS ──
// These catch ALL derivative forms: diminutives, augmentatives, verb conjugations, etc.
// Each pattern matches the root + any suffix (шлюх → шлюха, шлюшка, шлюшечка, шлюхоидный...)
const RU_PROFANITY_REGEXES: RegExp[] = [
  // шлюх* — шлюха, шлюшка, шлюшечка, шлюшонок, шлюхоидный
  /шлю[хшщ]/,
  // блять, бляди, блядина, блядский, бля
  /бля[дтнск]?/,
  // хуй, хуе, хуё, хуя, хуил, хуйня, хуесос, хуеплёт
  /ху[йеёяилн]/,
  // пизд*, пиздец, пиздобол, пиздюк, пиздато
  /пизд/,
  // ебать, ебан, ёбан, ебало, ебанат, ебашить, ебучий, ебля
  /[её]ба[нтлшч]?/,
  /еб[алуио]/,
  // сука, сучка, сученок, сучий, сучара, суки, сукин
  /сук[аиеёоу]|суч[каеёоин]/,
  // пидор, пидар, пидорас, педик, педераст 
  /п[иеё]д[оаие]?[рксн]/,
  // мудак, мудила, мудозвон, мудоёб
  /муд[аоиеёя]/,
  // дебил, дебилоид, дебильный
  /дебил/,
  // урод, уродина, уродский
  /урод/,
  // мразь, мразина, мразота, мразотный
  /мраз[ьоие]/,
  // тварь, тварина, тварюка
  /твар[ьиеюя]/,
  // падла, падлюка, падлец
  /падл[аеюёиу]/,
  // говно, говнюк, говняшка, говнище
  /говн[оюяеиа]/,
  // жопа, жопный, жопошник
  /жоп[аеоунс]/,
  // залупа, залупный
  /залуп/,
  // гандон
  /гандон/,
  // сволочь, сволочной
  /сволоч/,
  // выродок
  /выродок|выродк/,
  // засранец, засранка
  /засран/,
  // проститутка
  /проститут/,
  // шалава
  /шалав/,
  // потаскуха, потаскушка
  /потаскух|потаскуш/,
  // нахуй, нахер
  /нах[уе][йр]/,
  // долбоёб
  /долбо[её]б/,
  // ублюдок, ублюдочный
  /ублюд/,
];

const EN_PROFANITY_REGEXES: RegExp[] = [
  /fuck/,
  /f[uv]ck|fuk|fuq|fuc[ck]|phuck|fck/,
  /shit|sh[i1]t|sht/,
  /bitch|b[i1]tch|btch|biatch/,
  /asshole|a[s5]{2}hole/,
  /dick|d[i1]ck/,
  /cunt|c[uv]nt|cnt/,
  /whore|wh[o0]re/,
  /slut|sl[uv]t/,
  /retard/,
  /fag[g]?[oi]t|f[a4]g/,
  /nigg[ae]r|n[i1]gg[ae]/,
  /cock|c[o0]ck/,
  /wanker|twat|prick/,
];

/**
 * Check if any variant matches any of the regex patterns.
 * For spaced variants: checks per-word + adjacent 2-3 word groups.
 * For stripped variants: only checks short text (avoids cross-word false positives).
 */
function matchesRegexPatterns(variants: string[], patterns: RegExp[]): boolean {
  for (const pattern of patterns) {
    for (const v of variants) {
      if (v.includes(' ')) {
        // Spaced variant — check each word and adjacent groups
        const words = v.split(/\s+/).filter(w => w.length > 0);
        for (const w of words) {
          if (w.length >= 2 && pattern.test(w)) return true;
        }
        for (let i = 0; i < words.length - 1; i++) {
          if (pattern.test(words[i] + words[i + 1])) return true;
        }
        for (let i = 0; i < words.length - 2; i++) {
          if (pattern.test(words[i] + words[i + 1] + words[i + 2])) return true;
        }
      } else if (v.length > 0 && v.length <= 30) {
        // Stripped — only check short strings (evasion attempts like "ш.л.ю.х.а")
        if (pattern.test(v)) return true;
      }
    }
  }
  return false;
}

// Common Russian profanity stems (abbreviated to avoid explicit content)
const RU_PROFANITY_STEMS = [
  'бля', 'хуй', 'хуе', 'хуё', 'пизд', 'ебат', 'ебан', 'ёбан', 'сука', 'сук',
  'нахуй', 'нахер', 'пидор', 'пидар', 'мудак', 'мудил', 'залуп', 'шлюх',
  'дебил', 'уёб', 'уеб', 'ублюд', 'блят', 'пиздец', 'хуяр', 'ёб', 'еб',
  'хер', 'херов', 'сучк', 'сучар', 'пидр', 'ахуе', 'охуе', 'отъеб', 'отьеб',
  // Additional stems and common evasions
  'ебл', 'ёбл', 'хуил', 'хуял', 'выбляд', 'пизд', 'спизд',
  'пздц', 'хуйн', 'хуен', 'хуён', 'ебуч', 'ёбуч', 'ебош', 'заеб', 'заёб',
  'долбоеб', 'долбоёб', 'мудозвон', 'педик', 'педераст', 'гандон',
  'сволоч', 'выродок', 'тварь', 'падл', 'мразь', 'мраз', 'урод',
  'блядь', 'блядин', 'блядск', 'шалав', 'потаскух', 'проститут',
  'засран', 'говн', 'жоп', 'срань', 'срака', 'сран',
  'хуесос', 'пиздобол', 'хуеплёт', 'мудоёб', 'ёбтвоюмать',
  'ебтвоюмать', 'твоюмать', 'ёбаный', 'ебаный', 'ебанат', 'ёбанат',
  'впизд', 'напизд', 'распизд', 'припизд', 'опизд',
  'выебан', 'выёбан', 'наебан', 'наёбан', 'приеб', 'приёб',
  'поеб', 'поёб', 'объеб', 'объёб', 'перееб', 'переёб',
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
  // Additional transliterations
  'pizduk', 'sukin', 'blyadi', 'mraz', 'tvary', 'urod', 'padla',
  'gavno', 'govno', 'zhopa', 'sran', 'zasranec',
  'huesos', 'pizdobol', 'yobtvoyumat', 'ebtvoyumat',
  'ebanat', 'yobanat', 'ebanashka', 'pizdabol',
  'huyeplit', 'huynya', 'nahuysos', 'pohuy', 'pohui',
  'zaebis', 'zaebal', 'zaebat', 'priebat', 'prieb',
  'otyebis', 'otyebal', 'svoloch', 'vyrodok',
];

// Common English profanity stems
const EN_PROFANITY_STEMS = [
  'fuck', 'shit', 'bitch', 'asshole', 'dick', 'cunt', 'bastard', 'damn',
  'whore', 'slut', 'retard', 'faggot', 'nigger', 'nigga', 'stfu', 'wtf',
  'fck', 'fcuk', 'phuck', 'biatch', 'btch',
  // Additional
  'motherfuck', 'bullshit', 'horseshit', 'dipshit', 'dumbass', 'jackass',
  'piss', 'cock', 'dildo', 'wanker', 'twat', 'prick', 'arse',
  'fuk', 'fuq', 'fuc', 'sht', 'btch', 'b1tch', 'a55', 'azz',
  'sh1t', 'd1ck', 'c0ck', 'f4g', 'fag', 'cnt',
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

  // Generate all deobfuscation variants at once
  const variants = getMatchVariants(content);

  // 1) Discrimination check (highest priority)
  if (rules.blockDiscrimination && !isVeryShort) {
    for (const kw of DISCRIMINATION_KEYWORDS) {
      if (matchesStem(variants, kw)) {
        return { reason: 'discrimination', reasonDetail: `Обнаружена дискриминация` };
      }
    }
  }

  // 2) Profanity check — REGEX first (catches all derivative forms), then stem fallback
  if (rules.blockProfanity && !isVeryShort) {
    // 2a) Regex patterns — catch diminutives, conjugations, all forms
    if (matchesRegexPatterns(variants, RU_PROFANITY_REGEXES)) {
      return { reason: 'profanity', reasonDetail: `Нецензурная лексика (RU)` };
    }
    if (matchesRegexPatterns(variants, EN_PROFANITY_REGEXES)) {
      return { reason: 'profanity', reasonDetail: `Нецензурная лексика (EN)` };
    }
    // 2b) Stem-based fallback — catches specific forms not covered by regex
    for (const stem of RU_PROFANITY_STEMS) {
      if (matchesStem(variants, stem)) {
        return { reason: 'profanity', reasonDetail: `Нецензурная лексика (RU)` };
      }
    }
    for (const stem of EN_PROFANITY_STEMS) {
      if (matchesStem(variants, stem)) {
        return { reason: 'profanity', reasonDetail: `Нецензурная лексика (EN)` };
      }
    }
    for (const stem of RU_TRANSLIT_PROFANITY) {
      if (matchesStem(variants, stem)) {
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
