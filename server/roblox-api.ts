/**
 * Roblox API — серверная обёртка для публичных Roblox API.
 * История поиска хранится на клиенте (localStorage).
 */

// --- Roblox Public API helpers ---

async function fetchJson(url: string, options?: RequestInit) {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Accept': 'application/json',
      ...(options?.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`Roblox API ${res.status}: ${res.statusText}`);
  return res.json();
}

/** Получить userId по username */
export async function getUserIdByUsername(username: string): Promise<{ id: number; name: string; displayName: string } | null> {
  try {
    const data = await fetchJson('https://users.roblox.com/v1/usernames/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usernames: [username], excludeBannedUsers: false }),
    });
    if (data.data && data.data.length > 0) {
      return data.data[0];
    }
    return null;
  } catch {
    return null;
  }
}

/** Профиль пользователя */
export async function getUserProfile(userId: number) {
  try {
    const data = await fetchJson(`https://users.roblox.com/v1/users/${userId}`);
    return {
      id: data.id,
      name: data.name,
      displayName: data.displayName,
      description: data.description || '',
      created: data.created,
      isBanned: data.isBanned || false,
      externalAppDisplayName: data.externalAppDisplayName || null,
    };
  } catch {
    return null;
  }
}

/** Аватар (headshot) — с retry при Pending */
export async function getUserAvatar(userId: number): Promise<string | null> {
  const sizes = ['420x420', '352x352', '150x150'];
  
  for (const size of sizes) {
    try {
      const data = await fetchJson(
        `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=${size}&format=Png&isCircular=false`
      );
      if (data.data && data.data.length > 0) {
        const thumb = data.data[0];
        // Если state=Completed и есть imageUrl — возвращаем
        if (thumb.imageUrl && thumb.state === 'Completed') {
          return thumb.imageUrl;
        }
        // Если Pending — подождём и повторим один раз
        if (thumb.state === 'Pending') {
          await new Promise(r => setTimeout(r, 1500));
          const retry = await fetchJson(
            `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=${size}&format=Png&isCircular=false`
          );
          if (retry.data?.[0]?.imageUrl && retry.data[0].state === 'Completed') {
            return retry.data[0].imageUrl;
          }
        }
        // Если imageUrl есть, но state не Completed — всё равно попробуем
        if (thumb.imageUrl) return thumb.imageUrl;
      }
    } catch {
      continue;
    }
  }
  
  // Fallback: прямой URL Roblox avatar API
  try {
    const data = await fetchJson(
      `https://thumbnails.roblox.com/v1/users/avatar?userIds=${userId}&size=352x352&format=Png&isCircular=false`
    );
    if (data.data?.[0]?.imageUrl) return data.data[0].imageUrl;
  } catch {}
  
  return null;
}

/** Статус онлайн / в игре */
export async function getUserPresence(userId: number) {
  try {
    const data = await fetchJson('https://presence.roblox.com/v1/presence/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userIds: [userId] }),
    });
    if (data.userPresences && data.userPresences.length > 0) {
      const p = data.userPresences[0];
      // userPresenceType: 0=Offline, 1=Online, 2=InGame, 3=InStudio
      return {
        userPresenceType: p.userPresenceType,
        lastLocation: p.lastLocation || '',
        placeId: p.placeId || null,
        rootPlaceId: p.rootPlaceId || null,
        universeId: p.universeId || null,
        gameId: p.gameId || null,
        lastOnline: p.lastOnline || null,
      };
    }
    return null;
  } catch {
    return null;
  }
}

/** Друзья (количество) */
export async function getFriendsCount(userId: number): Promise<number> {
  try {
    const data = await fetchJson(`https://friends.roblox.com/v1/users/${userId}/friends/count`);
    return data.count || 0;
  } catch {
    return 0;
  }
}

/** Подписчики (количество) */
export async function getFollowersCount(userId: number): Promise<number> {
  try {
    const data = await fetchJson(`https://friends.roblox.com/v1/users/${userId}/followers/count`);
    return data.count || 0;
  } catch {
    return 0;
  }
}

/** Подписки (количество) */
export async function getFollowingsCount(userId: number): Promise<number> {
  try {
    const data = await fetchJson(`https://friends.roblox.com/v1/users/${userId}/followings/count`);
    return data.count || 0;
  } catch {
    return 0;
  }
}

/** Последние игры (badges) — получаем badges как индикатор активных игр */
export async function getRecentBadges(userId: number) {
  try {
    const data = await fetchJson(
      `https://badges.roblox.com/v1/users/${userId}/badges?limit=10&sortOrder=Desc`
    );
    return (data.data || []).slice(0, 10).map((badge: any) => ({
      id: badge.id,
      name: badge.name,
      description: badge.description,
      imageUrl: badge.displayIconImageId 
        ? `https://thumbnails.roblox.com/v1/assets?assetIds=${badge.displayIconImageId}&size=150x150&format=Png`
        : null,
      awardedDate: badge.awarder?.created || badge.created,
    }));
  } catch {
    return [];
  }
}

/** Инфо об игре по placeId */
export async function getGameInfo(placeId: number) {
  try {
    // Сначала получаем universeId по placeId
    const universeData = await fetchJson(
      `https://apis.roblox.com/universes/v1/places/${placeId}/universe`
    );
    const universeId = universeData.universeId;
    if (!universeId) return null;

    return await getGameInfoByUniverse(universeId, placeId);
  } catch {
    return null;
  }
}

/** Инфо об игре по universeId */
export async function getGameInfoByUniverse(universeId: number, placeId?: number) {
  try {
    const data = await fetchJson(
      `https://games.roblox.com/v1/games?universeIds=${universeId}`
    );
    if (data.data && data.data.length > 0) {
      const game = data.data[0];
      return {
        id: game.id,
        name: game.name,
        description: game.description?.substring(0, 200) || '',
        playing: game.playing || 0,
        visits: game.visits || 0,
        maxPlayers: game.maxPlayers || 0,
        created: game.created,
        updated: game.updated,
        placeId: placeId || game.rootPlaceId,
        rootPlaceId: game.rootPlaceId,
        creator: game.creator?.name || 'Unknown',
      };
    }
    return null;
  } catch {
    return null;
  }
}

/** Получить thumbnail игры */
export async function getGameThumbnail(universeId: number): Promise<string | null> {
  try {
    const data = await fetchJson(
      `https://thumbnails.roblox.com/v1/games/icons?universeIds=${universeId}&size=512x512&format=Png&isCircular=false`
    );
    if (data.data && data.data.length > 0) {
      return data.data[0].imageUrl;
    }
    return null;
  } catch {
    return null;
  }
}

/** Извлечь placeId из URL Roblox */
export function extractPlaceIdFromUrl(input: string): number | null {
  // Поддерживаемые форматы:
  // https://www.roblox.com/games/12345678/Game-Name
  // https://www.roblox.com/games/12345678
  // https://ro.blox.com/Ebh5?pid=share&is_retargeting=true&af_dp=roblox%3A%2F%2FplaceId%3D12345678
  // roblox://placeId=12345678
  const urlMatch = input.match(/roblox\.com\/games\/(\d+)/i);
  if (urlMatch) return parseInt(urlMatch[1]);
  
  const placeIdMatch = input.match(/placeId[=:](\d+)/i);
  if (placeIdMatch) return parseInt(placeIdMatch[1]);
  
  // Просто число
  if (/^\d+$/.test(input.trim())) return parseInt(input.trim());
  
  return null;
}

/** Поиск игр по названию (через Roblox catalog/discovery) */
export async function searchGames(keyword: string, limit: number = 12) {
  // 1. Проверяем, является ли keyword ссылкой на игру
  const placeIdFromUrl = extractPlaceIdFromUrl(keyword);
  if (placeIdFromUrl) {
    const gameInfo = await getGameInfo(placeIdFromUrl);
    if (gameInfo) {
      return [{
        universeId: gameInfo.id,
        name: gameInfo.name,
        placeId: gameInfo.placeId || placeIdFromUrl,
        rootPlaceId: gameInfo.rootPlaceId || placeIdFromUrl,
        playerCount: gameInfo.playing || 0,
        totalUpVotes: 0,
        totalDownVotes: 0,
        creatorName: gameInfo.creator || 'Unknown',
        creatorType: '',
      }];
    }
  }
  
  const results: any[] = [];
  
  // 2. Попробуем через games.roblox.com/v1/games/list (основной API)
  try {
    const data = await fetchJson(
      `https://games.roblox.com/v1/games/list?model.keyword=${encodeURIComponent(keyword)}&model.startRows=0&model.maxRows=${limit}`
    );
    if (data.games && data.games.length > 0) {
      for (const game of data.games) {
        results.push({
          universeId: game.universeId,
          name: game.name,
          placeId: game.placeId,
          rootPlaceId: game.rootPlaceId || game.placeId,
          playerCount: game.playerCount || 0,
          totalUpVotes: game.totalUpVotes || 0,
          totalDownVotes: game.totalDownVotes || 0,
          creatorName: game.creatorName || 'Unknown',
          creatorType: game.creatorType || '',
        });
      }
      return results;
    }
  } catch (e: any) {
    console.log('Roblox games/list failed:', e.message);
  }
  
  // 3. Fallback: через discover API (experiences catalog)
  try {
    const discoverData = await fetchJson(
      `https://apis.roblox.com/discovery-api/omni-search?searchQuery=${encodeURIComponent(keyword)}&pageToken=&sessionId=&searchType=1`
    );
    if (discoverData?.contents) {
      for (const item of discoverData.contents) {
        if (item.contentType === 'Game' || item.universeId) {
          results.push({
            universeId: item.universeId || 0,
            name: item.name || item.title || 'Unknown',
            placeId: item.rootPlaceId || 0,
            rootPlaceId: item.rootPlaceId || 0,
            playerCount: item.playerCount || 0,
            totalUpVotes: item.totalUpVotes || 0,
            totalDownVotes: item.totalDownVotes || 0,
            creatorName: item.creatorName || 'Unknown',
            creatorType: '',
          });
        }
      }
      if (results.length > 0) return results.slice(0, limit);
    }
  } catch (e: any) {
    console.log('Roblox discovery-api failed:', e.message);
  }

  // 4. Fallback: search autocomplete + multiget universe details
  try {
    const autoData = await fetchJson(
      `https://apis.roblox.com/search-api/omni-search-stricter?searchQuery=${encodeURIComponent(keyword)}&pageToken=&pageType=games&sessionId=`
    );
    const universeIds: number[] = [];
    if (autoData?.searchResults) {
      for (const r of autoData.searchResults) {
        if (r.contentId?.universeId) universeIds.push(r.contentId.universeId);
        else if (r.universeId) universeIds.push(r.universeId);
      }
    }
    if (universeIds.length > 0) {
      const gamesData = await fetchJson(
        `https://games.roblox.com/v1/games?universeIds=${universeIds.slice(0, limit).join(',')}`
      );
      if (gamesData?.data) {
        for (const game of gamesData.data) {
          results.push({
            universeId: game.id,
            name: game.name,
            placeId: game.rootPlaceId || 0,
            rootPlaceId: game.rootPlaceId || 0,
            playerCount: game.playing || 0,
            totalUpVotes: game.votes?.upVotes || 0,
            totalDownVotes: game.votes?.downVotes || 0,
            creatorName: game.creator?.name || 'Unknown',
            creatorType: game.creator?.type || '',
          });
        }
        if (results.length > 0) return results;
      }
    }
  } catch (e: any) {
    console.log('Roblox omni-search-stricter failed:', e.message);
  }
  
  // 5. Последний fallback: search-api omni-search
  try {
    const searchData = await fetchJson(
      `https://apis.roblox.com/search-api/omni-search?searchQuery=${encodeURIComponent(keyword)}&searchType=games&pageToken=&sessionId=`
    );
    if (searchData?.searchResults) {
      const universeIds: number[] = [];
      for (const r of searchData.searchResults) {
        if (r.contentType === 'Game') {
          if (r.contentId?.universeId) universeIds.push(r.contentId.universeId);
          else if (r.universeId) universeIds.push(r.universeId);
        }
      }
      if (universeIds.length > 0) {
        const gamesData = await fetchJson(
          `https://games.roblox.com/v1/games?universeIds=${universeIds.slice(0, limit).join(',')}`
        );
        if (gamesData?.data) {
          for (const game of gamesData.data) {
            results.push({
              universeId: game.id,
              name: game.name,
              placeId: game.rootPlaceId || 0,
              rootPlaceId: game.rootPlaceId || 0,
              playerCount: game.playing || 0,
              totalUpVotes: game.votes?.upVotes || 0,
              totalDownVotes: game.votes?.downVotes || 0,
              creatorName: game.creator?.name || 'Unknown',
              creatorType: game.creator?.type || '',
            });
          }
          return results;
        }
      }
    }
  } catch (e: any) {
    console.log('Roblox omni-search failed:', e.message);
  }

  return results;
}

/** Получить серверы (instances) игры и проверить наличие игрока */
export async function getGameServers(placeId: number, limit: number = 10) {
  try {
    const data = await fetchJson(
      `https://games.roblox.com/v1/games/${placeId}/servers/0?sortOrder=Desc&excludeFullGames=false&limit=${limit}`
    );
    if (data.data) {
      return data.data.map((server: any) => ({
        id: server.id,
        maxPlayers: server.maxPlayers || 0,
        playing: server.playing || 0,
        playerTokens: server.playerTokens || [],
        fps: server.fps || 0,
        ping: server.ping || 0,
      }));
    }
    return [];
  } catch {
    return [];
  }
}

/** Полный поиск по username — агрегированные данные */
export async function lookupUser(username: string) {
  // 1. Ищем userId
  const userIdData = await getUserIdByUsername(username);
  if (!userIdData) {
    return { success: false, error: 'Пользователь не найден' };
  }

  const userId = userIdData.id;

  // 2. Параллельно запрашиваем всё
  const [profile, avatar, presence, friendsCount, followersCount, followingsCount] = await Promise.all([
    getUserProfile(userId),
    getUserAvatar(userId),
    getUserPresence(userId),
    getFriendsCount(userId),
    getFollowersCount(userId),
    getFollowingsCount(userId),
  ]);

  if (!profile) {
    return { success: false, error: 'Не удалось загрузить профиль' };
  }

  // 3. Если в игре — пробуем получить инфо об игре разными способами
  let currentGame = null;
  if (presence && presence.userPresenceType === 2) {
    // Способ 1: По placeId
    if (presence.placeId) {
      currentGame = await getGameInfo(presence.placeId);
    }
    // Способ 2: По rootPlaceId (если placeId не дал результат)
    if (!currentGame && presence.rootPlaceId && presence.rootPlaceId !== presence.placeId) {
      currentGame = await getGameInfo(presence.rootPlaceId);
    }
    // Способ 3: По universeId напрямую
    if (!currentGame && presence.universeId) {
      currentGame = await getGameInfoByUniverse(presence.universeId, presence.placeId || undefined);
    }
    // Способ 4: Фолбек — используем lastLocation как название игры
    if (!currentGame && presence.lastLocation) {
      currentGame = {
        id: 0,
        name: presence.lastLocation,
        description: '',
        playing: 0,
        visits: 0,
        maxPlayers: 0,
        created: '',
        updated: '',
        placeId: presence.placeId || presence.rootPlaceId || 0,
        rootPlaceId: presence.rootPlaceId || 0,
        creator: '',
      };
    }
  }

  // Определяем статус
  let status = 'Оффлайн';
  let statusColor = 'gray';
  if (presence) {
    switch (presence.userPresenceType) {
      case 1: status = 'Онлайн'; statusColor = 'green'; break;
      case 2: status = 'В игре'; statusColor = 'blue'; break;
      case 3: status = 'В Roblox Studio'; statusColor = 'orange'; break;
      default: status = 'Оффлайн'; statusColor = 'gray';
    }
  }

  return {
    success: true,
    user: {
      id: userId,
      name: profile.name,
      displayName: profile.displayName,
      description: profile.description,
      created: profile.created,
      isBanned: profile.isBanned,
      avatar: avatar,
      status,
      statusColor,
      lastOnline: presence?.lastOnline || null,
      lastLocation: presence?.lastLocation || '',
      currentGame,
      stats: {
        friends: friendsCount,
        followers: followersCount,
        followings: followingsCount,
      },
      presence: presence ? {
        type: presence.userPresenceType,
        placeId: presence.placeId,
        rootPlaceId: presence.rootPlaceId,
        universeId: presence.universeId,
        gameId: presence.gameId,
      } : null,
      profileUrl: `https://www.roblox.com/users/${userId}/profile`,
    },
  };
}
