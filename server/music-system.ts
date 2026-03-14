import { Client, TextChannel, VoiceBasedChannel, Guild } from 'discord.js';
import { DisTube, Queue, Song as DisTubeSong } from 'distube';
import { YtDlpPlugin } from '@distube/yt-dlp';

let distube: DisTube | null = null;

export function initializeMusicSystem(client: Client) {
  distube = new DisTube(client, {
    emitNewSongOnly: true,
    emitAddSongWhenCreatingQueue: false,
    emitAddListWhenCreatingQueue: false,
    nsfw: false,
    plugins: [new YtDlpPlugin()],
  });

  // Событие: начало воспроизведения
  distube.on('playSong', (queue: Queue, song: DisTubeSong) => {
    queue.textChannel?.send(`🎵 **Играет:** ${song.name} - \`${song.formattedDuration}\``);
  });

  // Событие: очередь закончилась
  distube.on('finishQueue', (queue: Queue) => {
    queue.textChannel?.send('✅ Очередь завершена!');
  });

  // Событие: ошибка
  distube.on('error', (error: Error) => {
    console.error('DisTube ошибка:', error);
  });

  console.log('✅ DisTube музыкальная система инициализирована');
}

export function getDistube(): DisTube {
  if (!distube) {
    throw new Error('DisTube не инициализирован');
  }
  return distube;
}

export async function addSong(
  guild: Guild,
  voiceChannel: VoiceBasedChannel,
  textChannel: any,
  query: string,
  requestedBy: string
): Promise<{ success: boolean; message: string; song?: any }> {
  try {
    if (!distube) {
      throw new Error('DisTube не инициализирован');
    }

    const result = await distube.play(voiceChannel, query, {
      textChannel: textChannel,
      member: guild.members.cache.find(m => m.user.tag === requestedBy),
    });

    // Получаем информацию о песне
    const queue = distube.getQueue(guild.id);
    const song = queue?.songs[queue.songs.length - 1];

    if (song) {
      return {
        success: true,
        message: `✅ Добавлено в очередь: **${song.name}**`,
        song: {
          title: song.name,
          url: song.url,
          duration: song.formattedDuration,
          thumbnail: song.thumbnail,
          requestedBy,
        },
      };
    }

    return {
      success: true,
      message: '✅ Трек добавлен в очередь',
    };
  } catch (error: any) {
    console.error('Ошибка добавления песни:', error);
    return {
      success: false,
      message: `❌ Ошибка: ${error.message || 'Не удалось добавить трек'}`,
    };
  }
}

export async function pauseSong(guildId: string): Promise<{ success: boolean; message: string }> {
  try {
    if (!distube) throw new Error('DisTube не инициализирован');
    const queue = distube.getQueue(guildId);
    if (!queue) return { success: false, message: '❌ Ничего не играет' };

    distube.pause(guildId);
    return { success: true, message: '⏸️ Пауза' };
  } catch (error: any) {
    return { success: false, message: `❌ Ошибка: ${error.message}` };
  }
}

export async function resumeSong(guildId: string): Promise<{ success: boolean; message: string }> {
  try {
    if (!distube) throw new Error('DisTube не инициализирован');
    const queue = distube.getQueue(guildId);
    if (!queue) return { success: false, message: '❌ Ничего не играет' };

    distube.resume(guildId);
    return { success: true, message: '▶️ Продолжаем' };
  } catch (error: any) {
    return { success: false, message: `❌ Ошибка: ${error.message}` };
  }
}

export async function skipSong(guildId: string): Promise<{ success: boolean; message: string }> {
  try {
    if (!distube) throw new Error('DisTube не инициализирован');
    const queue = distube.getQueue(guildId);
    if (!queue) return { success: false, message: '❌ Ничего не играет' };

    const song = await distube.skip(guildId);
    return { success: true, message: `⏭️ Переход к: **${song.name}**` };
  } catch (error: any) {
    return { success: false, message: `❌ Ошибка: ${error.message}` };
  }
}

export async function stopSong(guildId: string): Promise<{ success: boolean; message: string }> {
  try {
    if (!distube) throw new Error('DisTube не инициализирован');
    const queue = distube.getQueue(guildId);
    if (!queue) return { success: false, message: '❌ Ничего не играет' };

    distube.stop(guildId);
    return { success: true, message: '⏹️ Остановлено' };
  } catch (error: any) {
    return { success: false, message: `❌ Ошибка: ${error.message}` };
  }
}

export async function shuffleQueue(guildId: string): Promise<{ success: boolean; message: string }> {
  try {
    if (!distube) throw new Error('DisTube не инициализирован');
    const queue = distube.getQueue(guildId);
    if (!queue) return { success: false, message: '❌ Ничего не играет' };

    await distube.shuffle(guildId);
    return { success: true, message: '🔀 Очередь перемешана' };
  } catch (error: any) {
    return { success: false, message: `❌ Ошибка: ${error.message}` };
  }
}

export async function toggleLoop(guildId: string): Promise<{ success: boolean; message: string; loopMode?: number }> {
  try {
    if (!distube) throw new Error('DisTube не инициализирован');
    const queue = distube.getQueue(guildId);
    if (!queue) return { success: false, message: '❌ Ничего не играет' };

    const mode = distube.setRepeatMode(guildId);
    const messages = ['🔁 Повтор выключен', '🔂 Повтор трека', '🔁 Повтор очереди'];
    return { success: true, message: messages[mode], loopMode: mode };
  } catch (error: any) {
    return { success: false, message: `❌ Ошибка: ${error.message}` };
  }
}

export async function getQueue(guildId: string): Promise<{ success: boolean; message?: string; queue?: any[] }> {
  try {
    if (!distube) throw new Error('DisTube не инициализирован');
    const queue = distube.getQueue(guildId);
    
    if (!queue || queue.songs.length === 0) {
      return { success: false, message: '❌ Очередь пуста' };
    }

    const songs = queue.songs.slice(0, 10).map((song, index) => ({
      position: index + 1,
      title: song.name,
      duration: song.formattedDuration,
      url: song.url,
      isPlaying: index === 0,
    }));

    return { success: true, queue: songs };
  } catch (error: any) {
    return { success: false, message: `❌ Ошибка: ${error.message}` };
  }
}

export async function setVolume(guildId: string, volume: number): Promise<{ success: boolean; message: string }> {
  try {
    if (!distube) throw new Error('DisTube не инициализирован');
    const queue = distube.getQueue(guildId);
    if (!queue) return { success: false, message: '❌ Ничего не играет' };

    distube.setVolume(guildId, volume);
    return { success: true, message: `🔊 Громкость: ${volume}%` };
  } catch (error: any) {
    return { success: false, message: `❌ Ошибка: ${error.message}` };
  }
}

export async function searchSongs(query: string, limit: number = 5): Promise<{ success: boolean; message?: string; results?: any[] }> {
  try {
    if (!distube) throw new Error('DisTube не инициализирован');
    
    // Используем YouTube SR для поиска
    const YouTube = await import('youtube-sr');
    const results = await YouTube.default.search(query, { limit, type: 'video' });
    
    if (!results || results.length === 0) {
      return { success: false, message: '❌ Ничего не найдено' };
    }

    const formattedResults = results.map((song: any, index: number) => ({
      index: index + 1,
      title: song.title || 'Неизвестно',
      url: song.url,
      duration: song.durationFormatted || '0:00',
      thumbnail: song.thumbnail?.url,
    }));

    return { success: true, results: formattedResults };
  } catch (error: any) {
    console.error('Ошибка поиска:', error);
    return { success: false, message: '❌ Ошибка при поиске' };
  }
}

export async function addPlaylist(
  guild: Guild,
  voiceChannel: VoiceBasedChannel,
  textChannel: any,
  playlistUrl: string,
  requestedBy: string
): Promise<{ success: boolean; message: string; count?: number }> {
  try {
    if (!distube) throw new Error('DisTube не инициализирован');

    const result = await distube.play(voiceChannel, playlistUrl, {
      textChannel: textChannel,
      member: guild.members.cache.find(m => m.user.tag === requestedBy),
    });

    const queue = distube.getQueue(guild.id);
    const count = queue?.songs.length || 0;

    return {
      success: true,
      message: `✅ Добавлен плейлист (${count} треков)`,
      count,
    };
  } catch (error: any) {
    console.error('Ошибка добавления плейлиста:', error);
    return {
      success: false,
      message: `❌ Ошибка: ${error.message || 'Не удалось добавить плейлист'}`,
    };
  }
}

export async function jumpToSong(guildId: string, position: number): Promise<{ success: boolean; message: string }> {
  try {
    if (!distube) throw new Error('DisTube не инициализирован');
    const queue = distube.getQueue(guildId);
    if (!queue) return { success: false, message: '❌ Ничего не играет' };

    if (position < 1 || position > queue.songs.length) {
      return { success: false, message: '❌ Неверная позиция в очереди' };
    }

    const song = await distube.jump(guildId, position - 1);
    return { success: true, message: `⏭️ Переход к: **${song.name}**` };
  } catch (error: any) {
    return { success: false, message: `❌ Ошибка: ${error.message}` };
  }
}

// Функция для совместимости со старым кодом
export async function initializePlayDl() {
  console.log('✅ DisTube готов к работе (старая функция)');
}
