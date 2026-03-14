import { Client, GatewayIntentBits, SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, PermissionFlagsBits, GuildMember, ActionRowBuilder, ButtonBuilder, ButtonStyle, REST, Routes } from 'discord.js';
import { storage } from './storage';
import { db } from './db';
import { discordActivity, clanMembers, transactions, shopItems } from '@shared/schema';
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

// Глобальный Discord Bot Client
export let botClient: Client | null = null;

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
  const botToken = process.env.DISCORD_BOT_TOKEN;
  
  if (!botToken) {
    console.log('⚠️ DISCORD_BOT_TOKEN не найден, бот не будет запущен');
    console.log('💡 Пожалуйста, установите переменную окружения DISCORD_BOT_TOKEN');
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
  ];

  client.once('clientReady', async () => {
    console.log(`✅ Discord бот запущен: ${client.user?.tag}`);
    console.log(`📊 База данных: ${process.env.DATABASE_URL?.substring(0, 50)}...`);
    console.log(`🌍 Окружение: ${process.env.NODE_ENV || 'development'}`);
    
    // Инициализация музыкальной системы DisTube
    if (music && music.initializeMusicSystem) {
      music.initializeMusicSystem(client);
    }
    
    // Глобальная регистрация slash-команд через REST API
    try {
      console.log(`📝 Регистрация ${commands.length} slash-команд...`);
      const rest = new REST({ version: '10' }).setToken(botToken!);
      const commandData = commands.map(cmd => cmd.toJSON());
      
      // Регистрируем глобально (доступно на всех серверах через ~1 час)
      // Или для конкретного сервера — моментально
      const guilds = client.guilds.cache;
      for (const guild of guilds.values()) {
        try {
          await rest.put(
            Routes.applicationGuildCommands(client.user!.id, guild.id),
            { body: commandData }
          );
          console.log(`✅ Slash-команды зарегистрированы на сервере: ${guild.name} (${guild.id})`);
        } catch (guildErr) {
          console.error(`❌ Ошибка регистрации команд на ${guild.name}:`, guildErr);
        }
      }
    } catch (regError) {
      console.error('❌ Ошибка регистрации slash-команд:', regError);
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
    setInterval(async () => {
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

  // Отслеживание сообщений
  client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    
    try {
      await trackMessageActivity(message.author.id);
    } catch (error) {
      console.error('Ошибка отслеживания сообщения:', error);
    }
  });

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
          await handlePlayCommand(interaction);
          break;
        case 'пауза':
          await handlePauseCommand(interaction);
          break;
        case 'продолжить':
          await handleResumeCommand(interaction);
          break;
        case 'скип':
          await handleSkipCommand(interaction);
          break;
        case 'стоп':
          await handleStopCommand(interaction);
          break;
        case 'очередь':
          await handleQueueCommand(interaction);
          break;
        case 'текущее':
          await handleNowPlayingCommand(interaction);
          break;
        case 'повтор':
          await handleLoopCommand(interaction);
          break;
        case 'громкость':
          await handleVolumeCommand(interaction);
          break;
        case 'перемешать':
          await handleShuffleCommand(interaction);
          break;
        case 'удалить':
          await handleRemoveCommand(interaction);
          break;
        case 'очистить-очередь':
          await handleClearQueueCommand(interaction);
          break;
        case 'перейти':
          await handleJumpCommand(interaction);
          break;
        case 'поиск':
          await handleSearchCommand(interaction);
          break;
        case 'плейлист':
          await handlePlaylistCommand(interaction);
          break;
        case 'меню-музыки':
          await handleMusicMenuCommand(interaction);
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

    try {
      let result;
      
      switch (customId) {
        case 'music_pause':
          result = music.pauseMusic(interaction.guild.id);
          await interaction.reply({ content: result.message, ephemeral: true });
          break;
          
        case 'music_resume':
          result = music.resumeMusic(interaction.guild.id);
          await interaction.reply({ content: result.message, ephemeral: true });
          break;
          
        case 'music_skip':
          result = music.skipSong(interaction.guild.id);
          await interaction.reply({ content: result.message, ephemeral: false });
          break;
          
        case 'music_stop':
          result = music.stopMusic(interaction.guild.id);
          await interaction.reply({ content: result.message, ephemeral: false });
          break;
          
        case 'music_shuffle':
          result = music.shuffleQueue(interaction.guild.id);
          await interaction.reply({ content: result.message, ephemeral: true });
          break;
          
        case 'music_loop':
          result = music.toggleLoop(interaction.guild.id);
          await interaction.reply({ content: result.message, ephemeral: true });
          break;
          
        case 'music_queue':
          const queueResult = music.getQueue(interaction.guild.id);
          
          if (!queueResult.success || !queueResult.queue) {
            await interaction.reply({ content: queueResult.message!, ephemeral: true });
            return;
          }

          const queue = queueResult.queue;
          const embed = new EmbedBuilder()
            .setColor(0xA855F7)
            .setTitle('🎵 Очередь треков')
            .setDescription(
              queue.songs.slice(0, 10).map((song, index) => 
                `**${index + 1}.** ${song.title} [${song.duration}]`
              ).join('\n') || 'Очередь пуста'
            )
            .addFields(
              { name: 'Всего треков', value: `${queue.songs.length}`, inline: true },
              { name: 'Повтор', value: queue.loop ? 'Вкл' : 'Выкл', inline: true }
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
  setInterval(async () => {
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

  await client.login(botToken);
  botClient = client; // Сохраняем глобально для мониторинга
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

  const result = music.pauseMusic(interaction.guild.id);
  await interaction.reply({ content: result.message, ephemeral: !result.success });
}

async function handleResumeCommand(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) {
    await interaction.reply({ content: '❌ Команда доступна только на сервере', ephemeral: true });
    return;
  }

  const result = music.resumeMusic(interaction.guild.id);
  await interaction.reply({ content: result.message, ephemeral: !result.success });
}

async function handleSkipCommand(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) {
    await interaction.reply({ content: '❌ Команда доступна только на сервере', ephemeral: true });
    return;
  }

  const result = music.skipSong(interaction.guild.id);
  await interaction.reply({ content: result.message });
}

async function handleStopCommand(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) {
    await interaction.reply({ content: '❌ Команда доступна только на сервере', ephemeral: true });
    return;
  }

  const result = music.stopMusic(interaction.guild.id);
  await interaction.reply({ content: result.message });
}

async function handleQueueCommand(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) {
    await interaction.reply({ content: '❌ Команда доступна только на сервере', ephemeral: true });
    return;
  }

  const result = music.getQueue(interaction.guild.id);
  
  if (!result.success || !result.queue) {
    await interaction.reply({ content: result.message!, ephemeral: true });
    return;
  }

  const queue = result.queue;
  const embed = new EmbedBuilder()
    .setColor(0xA855F7)
    .setTitle('🎵 Очередь треков')
    .setDescription(
      queue.songs.map((song, index) => 
        `**${index + 1}.** ${song.title} [${song.duration}] - *запросил ${song.requestedBy}*`
      ).join('\n') || 'Очередь пуста'
    )
    .addFields(
      { name: 'Всего треков', value: `${queue.songs.length}`, inline: true },
      { name: 'Повтор', value: queue.loop ? 'Включен' : 'Выключен', inline: true }
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

  const result = music.getCurrentSong(interaction.guild.id);
  
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

  const result = music.toggleLoop(interaction.guild.id);
  await interaction.reply({ content: result.message, ephemeral: !result.success });
}

async function handleVolumeCommand(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) {
    await interaction.reply({ content: '❌ Команда доступна только на сервере', ephemeral: true });
    return;
  }

  const volume = interaction.options.getInteger('уровень', true);
  const result = music.setVolume(interaction.guild.id, volume);
  await interaction.reply({ content: result.message, ephemeral: !result.success });
}

async function handleShuffleCommand(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) {
    await interaction.reply({ content: '❌ Команда доступна только на сервере', ephemeral: true });
    return;
  }

  const result = music.shuffleQueue(interaction.guild.id);
  await interaction.reply({ content: result.message, ephemeral: !result.success });
}

async function handleRemoveCommand(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) {
    await interaction.reply({ content: '❌ Команда доступна только на сервере', ephemeral: true });
    return;
  }

  const index = interaction.options.getInteger('номер', true);
  const result = music.removeSong(interaction.guild.id, index);
  await interaction.reply({ content: result.message, ephemeral: !result.success });
}

async function handleClearQueueCommand(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) {
    await interaction.reply({ content: '❌ Команда доступна только на сервере', ephemeral: true });
    return;
  }

  const result = music.clearQueue(interaction.guild.id);
  await interaction.reply({ content: result.message, ephemeral: !result.success });
}

async function handleJumpCommand(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) {
    await interaction.reply({ content: '❌ Команда доступна только на сервере', ephemeral: true });
    return;
  }

  const index = interaction.options.getInteger('номер', true);
  const result = music.jumpToSong(interaction.guild.id, index);
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

  const result = music.getCurrentSong(interaction.guild.id);
  const queue = music.getQueue(interaction.guild.id);

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
