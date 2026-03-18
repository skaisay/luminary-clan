import { Client } from 'discord.js';
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
