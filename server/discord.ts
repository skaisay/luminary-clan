import { Client, GatewayIntentBits } from 'discord.js';

let connectionSettings: any;

async function getAccessToken() {
  if (connectionSettings && connectionSettings.settings.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    return connectionSettings.settings.access_token;
  }
  
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=discord',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  const accessToken = connectionSettings?.settings?.access_token || connectionSettings.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    throw new Error('Discord not connected');
  }
  return accessToken;
}

// WARNING: Never cache this client.
// Access tokens expire, so a new client must be created each time.
// Always call this function again to get a fresh client.
export async function getUncachableDiscordClient() {
  const token = await getAccessToken();

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds, 
      GatewayIntentBits.GuildMessages, 
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildPresences,
      GatewayIntentBits.GuildVoiceStates
    ]
  });

  await client.login(token);
  return client;
}

export async function getDiscordServerInfo() {
  let client;
  try {
    const botToken = process.env.DISCORD_BOT_TOKEN;
    
    if (!botToken) {
      return { memberCount: 0, onlineCount: 0, guildName: "No bot token" };
    }

    client = new Client({
      intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildPresences // Нужен для получения онлайн статуса
      ]
    });

    await client.login(botToken);
    await new Promise(resolve => setTimeout(resolve, 2000)); // Ждем подключения
    
    const guilds = client.guilds.cache;
    
    if (guilds.size === 0) {
      return { memberCount: 0, onlineCount: 0, guildName: "No server" };
    }

    const guild = guilds.first();
    if (!guild) {
      return { memberCount: 0, onlineCount: 0, guildName: "No server" };
    }

    // Получаем всех участников с их presence
    const members = await guild.members.fetch();
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
  } finally {
    if (client) {
      await client.destroy();
    }
  }
}

async function getBotClient() {
  const botToken = process.env.DISCORD_BOT_TOKEN;
  
  if (!botToken) {
    throw new Error('DISCORD_BOT_TOKEN не найден в переменных окружения');
  }

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds, 
      GatewayIntentBits.GuildMessages, 
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildPresences,
      GatewayIntentBits.GuildVoiceStates
    ]
  });

  await client.login(botToken);
  return client;
}

export async function getDiscordMembers() {
  let client;
  try {
    client = await getBotClient();
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const guilds = client.guilds.cache;
    
    if (guilds.size === 0) {
      throw new Error('Нет доступных серверов. Убедитесь, что бот добавлен на ваш сервер Discord.');
    }

    const guild = guilds.first();
    if (!guild) {
      throw new Error('Не удалось получить доступ к серверу Discord.');
    }

    const members = await guild.members.fetch();
    
    const memberData = members
      .filter(member => !member.user.bot)
      .map(member => ({
        discordId: member.user.id,
        username: member.user.globalName || member.user.username,
        avatar: member.user.displayAvatarURL({ size: 256 }),
        role: member.roles.highest.name === '@everyone' ? 'Member' : member.roles.highest.name,
        joinedAt: member.joinedAt || new Date(),
      }));

    console.log(`Successfully fetched ${memberData.length} members from Discord`);
    return memberData;
  } catch (error: any) {
    console.error("Discord members fetch error:", error);
    throw error;
  } finally {
    if (client) {
      await client.destroy();
    }
  }
}

export async function getDiscordChannels() {
  let client;
  try {
    client = await getBotClient();
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const guild = client.guilds.cache.first();
    if (!guild) {
      throw new Error('Сервер не найден');
    }

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
  } finally {
    if (client) {
      await client.destroy();
    }
  }
}

export async function getVoiceChannels() {
  try {
    // Используем getDistube чтобы получить существующий клиент DisTube
    // ВАЖНО: НЕ создаем новый клиент, чтобы не отключить DisTube!
    const { getDistube } = await import('./music-system');
    const distube = getDistube();
    const client = distube.client;
    
    const guild = client.guilds.cache.first();
    if (!guild) {
      throw new Error('Сервер не найден');
    }

    // Получаем голосовые каналы с участниками внутри
    const channels = guild.channels.cache
      .filter(channel => channel.type === 2) // Только голосовые каналы
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
  let client;
  try {
    client = await getBotClient();
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const channel = await client.channels.fetch(channelId);
    if (!channel || !('send' in channel)) {
      throw new Error('Канал не найден или не является текстовым');
    }

    await channel.send(message);
    return { success: true };
  } catch (error: any) {
    console.error("Discord send message error:", error);
    throw error;
  } finally {
    if (client) {
      await client.destroy();
    }
  }
}

export async function kickDiscordMember(userId: string) {
  let client;
  try {
    client = await getBotClient();
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const guild = client.guilds.cache.first();
    if (!guild) {
      throw new Error('Сервер не найден');
    }

    const member = await guild.members.fetch(userId);
    if (!member) {
      throw new Error('Участник не найден');
    }

    await member.kick('Исключен через админ-панель');
    return { success: true };
  } catch (error: any) {
    console.error("Discord kick error:", error);
    throw error;
  } finally {
    if (client) {
      await client.destroy();
    }
  }
}

export async function banDiscordMember(userId: string) {
  let client;
  try {
    client = await getBotClient();
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const guild = client.guilds.cache.first();
    if (!guild) {
      throw new Error('Сервер не найден');
    }

    await guild.members.ban(userId, { reason: 'Забанен через админ-панель' });
    return { success: true };
  } catch (error: any) {
    console.error("Discord ban error:", error);
    throw error;
  } finally {
    if (client) {
      await client.destroy();
    }
  }
}

export async function getDiscordMembersForAdmin() {
  let client;
  try {
    client = await getBotClient();
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const guild = client.guilds.cache.first();
    if (!guild) {
      throw new Error('Сервер не найден');
    }

    const members = await guild.members.fetch();
    
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
  } finally {
    if (client) {
      await client.destroy();
    }
  }
}

export async function assignDiscordRole(discordId: string, roleData: { roleName: string; roleColor?: string; permissions?: string[] }) {
  let client;
  try {
    client = await getBotClient();
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const guild = client.guilds.cache.first();
    if (!guild) {
      throw new Error('Сервер не найден');
    }

    const member = await guild.members.fetch(discordId);
    if (!member) {
      throw new Error('Участник не найден');
    }

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
  } finally {
    if (client) {
      await client.destroy();
    }
  }
}

export async function getDiscordRoles() {
  let client;
  try {
    client = await getBotClient();
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const guild = client.guilds.cache.first();
    if (!guild) {
      throw new Error('Сервер не найден');
    }

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
  } finally {
    if (client) {
      await client.destroy();
    }
  }
}

export async function createBeautifulTestRoles() {
  let client;
  try {
    client = await getBotClient();
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const guild = client.guilds.cache.first();
    if (!guild) {
      throw new Error('Сервер Discord не найден');
    }

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
        createdRoles.push({
          id: newRole.id,
          name: newRole.name,
          color: roleData.color,
          description: roleData.description
        });
        console.log(`✨ Создана роль: ${newRole.name} (${roleData.color})`);
        await new Promise(resolve => setTimeout(resolve, 500));
      } else {
        await existingRole.edit({
          color: color,
          hoist: true,
          mentionable: false
        });
        createdRoles.push({
          id: existingRole.id,
          name: existingRole.name,
          color: roleData.color,
          description: roleData.description
        });
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
  } finally {
    if (client) {
      await client.destroy();
    }
  }
}

export async function changeDiscordNickname(discordId: string, newNickname: string) {
  let client;
  try {
    client = await getBotClient();
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const guild = client.guilds.cache.first();
    if (!guild) {
      throw new Error('Сервер Discord не найден');
    }

    const member = await guild.members.fetch(discordId);
    if (!member) {
      throw new Error('Участник не найден на сервере');
    }

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
  } finally {
    if (client) {
      await client.destroy();
    }
  }
}
