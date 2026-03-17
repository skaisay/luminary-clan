import type { Express } from "express";
import { createServer, type Server } from "http";
import passport from "passport";
import { promisify } from "util";
import { exec } from "child_process";
import path from "path";
import fs from "fs";
import { storage } from "./storage";
import { getChatCompletion } from "./openai";
import { 
  getDiscordServerInfo, 
  getDiscordMembers, 
  getDiscordChannels, 
  sendDiscordMessage, 
  kickDiscordMember, 
  banDiscordMember,
  getDiscordMembersForAdmin,
  getVoiceChannels,
  getDiscordRoles,
  createBeautifulTestRoles,
  changeDiscordNickname
} from "./discord";
import { requireAdmin, requireDiscordAuth } from "./auth";
import { 
  insertNewsSchema, 
  insertAiChatMessageSchema, 
  insertClanMemberSchema,
  insertClanSettingsSchema,
  insertClanStatsSchema,
  insertRequestSchema,
  insertForumTopicSchema,
  insertForumReplySchema,
  insertShopItemSchema,
  insertPurchaseSchema,
  insertRobuxConversionRequestSchema,
  insertRobuxConversionSettingsSchema,
  insertVideoSchema,
  insertVideoLikeSchema,
  insertVideoCommentSchema,
  insertChannelSchema,
  insertProfileDecorationSchema,
  profileDecorations,
  memberDecorations,
  profileCustoms,
  adSpots,
} from "@shared/schema";
import { videoUpload } from "./upload";
import {
  addSong,
  pauseSong,
  resumeSong,
  skipSong,
  stopSong,
  shuffleQueue,
  toggleLoop,
  getQueue,
  getCurrentSong,
  setVolume,
  searchSongs,
  addPlaylist,
  jumpToSong,
  removeSong,
  clearQueue,
  getDistube,
  getLoadingStatus,
  getDebugLogs,
  testStreaming,
  testAudioEndToEnd
} from "./music-system";

// Расширяем тип Session для поддержки returnTo
declare module 'express-session' {
  interface SessionData {
    returnTo?: string;
  }
}

const execAsync = promisify(exec);

/** Escape XML/SVG special characters */
function escapeXml(str: string): string {
  return (str || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

// Валидация returnTo параметра для предотвращения open redirect уязвимости
function validateReturnTo(returnTo: string | undefined): string {
  // Если returnTo не указан или невалиден, возвращаем дефолтный путь
  if (!returnTo || typeof returnTo !== 'string') {
    return '/';
  }

  // Декодируем URL с обработкой ошибок
  let decoded: string;
  try {
    decoded = decodeURIComponent(returnTo);
  } catch (error) {
    console.warn(`Failed to decode returnTo parameter: ${returnTo}`);
    return '/';
  }

  // Проверяем что это относительный путь (начинается с "/")
  // и не содержит абсолютный URL или протокол
  if (!decoded.startsWith('/') || decoded.startsWith('//') || decoded.includes('://')) {
    console.warn(`Invalid returnTo parameter blocked: ${decoded}`);
    return '/';
  }

  // Дополнительная проверка: разрешаем только пути видео платформы или основного сайта
  const allowedPrefixes = ['/', '/shop', '/dashboard', '/news', '/forum', '/members', '/requests', '/leaderboard', '/statistics', '/about', '/inventory', '/convert'];
  const isAllowed = allowedPrefixes.some(prefix => decoded === prefix || decoded.startsWith(prefix + '/'));
  
  if (!isAllowed) {
    console.warn(`returnTo path not in allowed list: ${decoded}`);
    return '/';
  }

  return decoded;
}

// Функция генерации thumbnail из видео с таймаутом
async function generateVideoThumbnail(videoPath: string, outputPath: string, fileSize: number): Promise<void> {
  try {
    // Пропускаем генерацию превью для очень больших файлов (>1GB)
    // чтобы не блокировать загрузку
    if (fileSize > 1024 * 1024 * 1024) {
      console.log(`Skipping thumbnail generation for large file (${(fileSize / (1024 * 1024 * 1024)).toFixed(2)}GB)`);
      throw new Error("Файл слишком большой для генерации превью");
    }

    // Создать папку для thumbnails если её нет
    const thumbnailDir = path.dirname(outputPath);
    if (!fs.existsSync(thumbnailDir)) {
      fs.mkdirSync(thumbnailDir, { recursive: true });
    }

    // Генерируем превью из видео (первый кадр на 1-й секунде)
    // Используем меньшее разрешение для ускорения (720p вместо 1280p)
    const command = `ffmpeg -i "${videoPath}" -ss 00:00:01 -vframes 1 -vf "scale=720:-2" "${outputPath}" -y`;
    
    // Добавляем таймаут 30 секунд
    const timeoutMs = 30000;
    await Promise.race([
      execAsync(command),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Thumbnail generation timeout')), timeoutMs)
      )
    ]);
    
    console.log(`✅ Thumbnail generated: ${outputPath} for file size: ${(fileSize / (1024 * 1024)).toFixed(2)}MB`);
  } catch (error) {
    console.error("⚠️ Error generating thumbnail:", error);
    throw new Error("Не удалось сгенерировать превью видео");
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Serve uploaded files (banners, etc.)
  const express = await import('express');
  app.use('/uploads', express.default.static(path.join(process.cwd(), 'uploads')));

  // ============================================================
  // OG SCREENSHOT — Upload real profile screenshot as OG image
  // ============================================================
  app.post("/api/og-screenshot/:discordId", async (req, res) => {
    try {
      const discordId = req.params.discordId;
      if (!/^\d+$/.test(discordId)) return res.status(400).json({ error: "Invalid discordId" });

      // Read raw PNG body
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(Buffer.from(chunk));
      const pngBuffer = Buffer.concat(chunks);

      if (pngBuffer.length < 100 || pngBuffer.length > 5 * 1024 * 1024) {
        return res.status(400).json({ error: "Invalid image size" });
      }

      // Ensure dir
      const ogDir = path.join(process.cwd(), 'uploads', 'og');
      if (!fs.existsSync(ogDir)) fs.mkdirSync(ogDir, { recursive: true });

      const filePath = path.join(ogDir, `${discordId}.png`);
      fs.writeFileSync(filePath, pngBuffer);
      res.json({ ok: true, url: `/uploads/og/${discordId}.png` });
    } catch (error: any) {
      console.error("[OG-SCREENSHOT]", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================================
  // OG IMAGE — Fallback SVG-generated profile preview
  // ============================================================
  app.get("/api/og-image/:discordId", async (req, res) => {
    try {
      const { db } = await import("./db");
      const { clanMembers } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");
      const id = req.params.discordId;

      const isDiscordId = /^\d+$/.test(id);
      let member;
      if (isDiscordId) {
        member = await db.select().from(clanMembers).where(eq(clanMembers.discordId, id)).limit(1);
      }
      if (!member || !member[0]) {
        member = await db.select().from(clanMembers).where(eq(clanMembers.username, id)).limit(1);
      }
      if (!member?.[0]) return res.status(404).send("Not found");

      const m = member[0];
      const avatarUrl = m.avatar || "";
      const level = m.level ?? 1;
      const coins = m.lumiCoins ?? 0;
      const role = m.role || "Участник";
      const wins = m.wins ?? 0;
      const rank = m.rank ?? 0;

      // Get equipped banner decoration if any
      let bannerGradient = "linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4c1d95 100%)";
      try {
        const { and } = await import("drizzle-orm");
        const bannerRows = await db.select({
          cssEffect: profileDecorations.cssEffect,
        }).from(memberDecorations)
          .innerJoin(profileDecorations, eq(memberDecorations.decorationId, profileDecorations.id))
          .where(and(
            eq(memberDecorations.discordId, m.discordId || ""),
            eq(memberDecorations.isEquipped, true),
            eq(profileDecorations.type, "banner"),
          ));
        if (bannerRows[0]?.cssEffect) {
          // Extract just the gradient part (before any ;)
          bannerGradient = bannerRows[0].cssEffect.split(";")[0].trim();
        }
      } catch (_) { /* ignore banner fetch errors */ }

      // Get custom profile data for custom banner colors
      try {
        const customs = await db.select().from(profileCustoms)
          .where(eq(profileCustoms.discordId, m.discordId || "")).limit(1);
        if (customs[0]?.bannerColor1) {
          bannerGradient = `linear-gradient(135deg, ${customs[0].bannerColor1}, ${customs[0].bannerColor2 || customs[0].bannerColor1})`;
        }
      } catch (_) { /* ignore */ }

      // We fetch the avatar as base64 to embed into the SVG so Discord can render it
      let avatarDataUri = "";
      if (avatarUrl) {
        try {
          const resp = await fetch(avatarUrl);
          if (resp.ok) {
            const buf = Buffer.from(await resp.arrayBuffer());
            const ct = resp.headers.get("content-type") || "image/png";
            avatarDataUri = `data:${ct};base64,${buf.toString("base64")}`;
          }
        } catch (_) { /* use fallback */ }
      }

      // Get equipped name_color + badges
      let nameColor = "#ffffff";
      let badges: Array<{emoji: string | null; name: string; rarity: string; color: string | null}> = [];
      try {
        const { and: andOp } = await import("drizzle-orm");
        const equipped = await db.select({
          type: profileDecorations.type,
          emoji: profileDecorations.emoji,
          color: profileDecorations.color,
          name: profileDecorations.name,
          rarity: profileDecorations.rarity,
          cssEffect: profileDecorations.cssEffect,
        }).from(memberDecorations)
          .innerJoin(profileDecorations, eq(memberDecorations.decorationId, profileDecorations.id))
          .where(andOp(
            eq(memberDecorations.discordId, m.discordId || ""),
            eq(memberDecorations.isEquipped, true),
          ));
        for (const e of equipped) {
          if (e.type === "name_color" && e.color) nameColor = e.color;
          if (e.type === "badge") badges.push(e);
        }
      } catch (_) {}

      const avatarCircle = avatarDataUri
        ? `<image x="50" y="285" width="120" height="120" href="${avatarDataUri}" clip-path="url(#avatar-clip)" />`
        : `<rect x="50" y="285" width="120" height="120" rx="60" fill="#4c1d95"/>
           <text x="110" y="358" font-family="Arial,sans-serif" font-size="40" fill="white" text-anchor="middle" font-weight="bold">${(m.username || "?").substring(0, 2).toUpperCase()}</text>`;

      const badgeSvg = badges.slice(0, 5).map((b, i) =>
        `<text x="${195 + 28 * i}" y="374" font-family="Arial,sans-serif" font-size="22">${b.emoji || '✦'}</text>`
      ).join("");

      const xp = m.experience ?? 0;
      const xpForNext = Math.max(100, level * 150);
      const xpPct = Math.min(100, ((xp % xpForNext) / xpForNext) * 100);
      const joinDate = m.joinedAt ? new Date(m.joinedAt).toLocaleDateString('ru-RU') : '—';

      // Generate SVG that mirrors the actual profile card layout (1200×630)
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <clipPath id="avatar-clip"><circle cx="110" cy="345" r="58"/></clipPath>
    <linearGradient id="bg" x1="0" y1="0" x2="0.3" y2="1">
      <stop offset="0%" stop-color="#0c0a1d"/>
      <stop offset="100%" stop-color="#161233"/>
    </linearGradient>
    <linearGradient id="banner-g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#6366f1"/>
      <stop offset="50%" stop-color="#8b5cf6"/>
      <stop offset="100%" stop-color="#a855f7"/>
    </linearGradient>
    <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#000" stop-opacity="0"/>
      <stop offset="60%" stop-color="#000" stop-opacity="0.4"/>
      <stop offset="100%" stop-color="#000" stop-opacity="0.85"/>
    </linearGradient>
    <linearGradient id="xp-bar" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#6366f1"/>
      <stop offset="100%" stop-color="#a855f7"/>
    </linearGradient>
    <filter id="glow"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <filter id="card-shadow"><feDropShadow dx="0" dy="2" stdDeviation="6" flood-color="#000" flood-opacity="0.4"/></filter>
  </defs>

  <!-- Full background -->
  <rect width="1200" height="630" fill="url(#bg)"/>

  <!-- Card container -->
  <rect x="40" y="20" width="1120" height="590" rx="24" fill="#0f0d23" stroke="#6366f140" stroke-width="1.5" filter="url(#card-shadow)"/>

  <!-- Banner — fills top of card -->
  <rect x="40" y="20" width="1120" height="280" rx="24" fill="url(#banner-g)"/>
  <rect x="40" y="200" width="1120" height="100" fill="url(#fade)"/>

  <!-- Avatar ring -->
  <circle cx="110" cy="345" r="65" fill="#0f0d23" stroke="#6366f1" stroke-width="3"/>
  ${avatarCircle}

  <!-- Username + badges -->
  <text x="190" y="350" font-family="Arial,Helvetica,sans-serif" font-size="36" fill="${nameColor}" font-weight="bold">${escapeXml(m.username)}</text>
  ${badgeSvg}
  <!-- Role badge -->
  <rect x="190" y="362" width="${role.length * 10 + 24}" height="26" rx="6" fill="#ffffff12" stroke="#ffffff20" stroke-width="1"/>
  <text x="202" y="381" font-family="Arial,sans-serif" font-size="14" fill="#a5b4fc">${escapeXml(role)}</text>

  <!-- XP bar -->
  <text x="190" y="415" font-family="Arial,sans-serif" font-size="13" fill="#94a3b8">Уровень ${level} · ${xp % xpForNext}/${xpForNext} XP</text>
  <rect x="190" y="422" width="400" height="8" rx="4" fill="#1e1b4b"/>
  <rect x="190" y="422" width="${Math.max(8, (xpPct / 100) * 400)}" height="8" rx="4" fill="url(#xp-bar)"/>

  <!-- Stats row -->
  <rect x="60" y="460" width="240" height="110" rx="16" fill="#1a1740" stroke="#6366f130" stroke-width="1"/>
  <text x="180" y="500" font-family="Arial,sans-serif" font-size="14" fill="#94a3b8" text-anchor="middle">LumiCoins</text>
  <text x="180" y="540" font-family="Arial,sans-serif" font-size="34" fill="#fbbf24" text-anchor="middle" font-weight="bold">${coins.toLocaleString()}</text>

  <rect x="320" y="460" width="200" height="110" rx="16" fill="#1a1740" stroke="#6366f130" stroke-width="1"/>
  <text x="420" y="500" font-family="Arial,sans-serif" font-size="14" fill="#94a3b8" text-anchor="middle">Побед</text>
  <text x="420" y="540" font-family="Arial,sans-serif" font-size="34" fill="#34d399" text-anchor="middle" font-weight="bold">${wins}</text>

  <rect x="540" y="460" width="200" height="110" rx="16" fill="#1a1740" stroke="#6366f130" stroke-width="1"/>
  <text x="640" y="500" font-family="Arial,sans-serif" font-size="14" fill="#94a3b8" text-anchor="middle">Ранг</text>
  <text x="640" y="540" font-family="Arial,sans-serif" font-size="34" fill="#f472b6" text-anchor="middle" font-weight="bold">#${rank || '—'}</text>

  <!-- Right side: LumiCoins + join date -->
  <rect x="780" y="300" width="360" height="130" rx="16" fill="#1a1740" stroke="#6366f130" stroke-width="1"/>
  <text x="960" y="345" font-family="Arial,sans-serif" font-size="48" fill="#fbbf24" text-anchor="middle" font-weight="bold" filter="url(#glow)">${coins.toLocaleString()}</text>
  <text x="960" y="375" font-family="Arial,sans-serif" font-size="16" fill="#94a3b8" text-anchor="middle">LumiCoins</text>
  <text x="960" y="415" font-family="Arial,sans-serif" font-size="13" fill="#64748b" text-anchor="middle">Присоединился: ${joinDate}</text>

  <!-- Footer branding -->
  <text x="960" y="540" font-family="Arial,sans-serif" font-size="20" fill="#6366f180" text-anchor="middle" font-weight="bold">✦ LUMINARY CLAN ✦</text>
  <text x="960" y="565" font-family="Arial,sans-serif" font-size="12" fill="#475569" text-anchor="middle">luminary-clan.onrender.com</text>
</svg>`;

      res.setHeader("Content-Type", "image/png");
      res.setHeader("Cache-Control", "public, max-age=300"); // 5 min cache
      // Convert SVG to PNG via sharp
      try {
        const sharp = (await import("sharp")).default;
        const pngBuffer = await sharp(Buffer.from(svg)).png().toBuffer();
        res.send(pngBuffer);
      } catch (sharpErr) {
        // Fallback: serve SVG if sharp fails
        console.error("[OG-IMAGE] sharp conversion failed, serving SVG:", sharpErr);
        res.setHeader("Content-Type", "image/svg+xml");
        res.send(svg);
      }
    } catch (error: any) {
      console.error("[OG-IMAGE]", error);
      res.status(500).send("Error generating image");
    }
  });

  // Health endpoint for keep-alive pings and monitoring
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", uptime: process.uptime(), timestamp: new Date().toISOString() });
  });

  // === AI Chat Proxy (free APIs, no key needed) ===
  app.post("/api/ai-chat", async (req, res) => {
    try {
      const { messages, language, currentPage } = req.body;
      if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: 'messages array required' });
      }

      // Fetch real site data for AI context
      let shopInfo = '';
      let memberCount = 0;
      let topMembersInfo = '';
      try {
        const { db } = await import("./db");
        const { items: itemsTable, shopItems: shopItemsTable, clanMembers } = await import("@shared/schema");
        const { eq, desc } = await import("drizzle-orm");

        const [genItems, roleItems, members, topMembers] = await Promise.all([
          db.select({ name: itemsTable.name, price: itemsTable.price, category: itemsTable.category, rarity: itemsTable.rarity }).from(itemsTable).where(eq(itemsTable.isAvailable, true)).limit(30),
          db.select({ name: shopItemsTable.name, price: shopItemsTable.price, category: shopItemsTable.category }).from(shopItemsTable).where(eq(shopItemsTable.isAvailable, true)).limit(20),
          db.select({ id: clanMembers.id }).from(clanMembers),
          db.select({ username: clanMembers.username, level: clanMembers.level, lumiCoins: clanMembers.lumiCoins, role: clanMembers.role, wins: clanMembers.wins }).from(clanMembers).orderBy(desc(clanMembers.lumiCoins)).limit(5),
        ]);

        const allShop = [
          ...genItems.map((i: any) => `${i.name} (${i.price} LC, ${i.category}, ${i.rarity})`),
          ...roleItems.map((i: any) => `${i.name} (${i.price} LC, ${i.category})`),
        ];
        shopInfo = allShop.length > 0 ? allShop.join('; ') : 'Магазин пуст';
        memberCount = members.length;
        topMembersInfo = topMembers.map((m: any, i: number) => `${i + 1}. ${m.username} (lv${m.level}, ${m.lumiCoins} LC, ${m.wins}W, ${m.role})`).join('; ');
      } catch (e) {
        console.log('[AI] DB data fetch error:', e);
        shopInfo = 'данные недоступны';
      }

      const pageContext = currentPage ? `Юзер на: ${currentPage}` : '';

      // Build page-specific field info (only include relevant pages to reduce tokens)
      const cp = (currentPage || '').toLowerCase();
      function getFieldsRu(): string {
        let f = '';
        // Always include admin fields if on admin, plus a few common pages
        if (cp.includes('admin')) {
          f += `/admin: tab-settings, tab-members, tab-shop, tab-news, tab-discord, tab-convert, tab-pages, tab-requests, tab-forum, tab-stats, tab-monitoring, tab-transactions, tab-bans, tab-decorations
tab-shop: создать: button-create-shop-item → input-item-name, input-item-description, input-item-price, input-item-stock, select-item-type, select-item-rarity → button-submit-shop-item. Ред: edit-Имя → поля → измени → button-submit-shop-item. Удалить: delete-Имя.
tab-members: button-add-member → input-new-username, input-new-discord-id, input-new-role. Ред: edit-Имя → save-Имя. Удалить: delete-Имя.
tab-settings: input-clan-name, input-clan-tag, textarea-description, input-hero-image, input-logo, input-splash-image, input-primary-color, input-accent-color, select-seasonal-theme → button-save-settings\n`;
        }
        if (cp.includes('trading') || !cp.includes('admin')) f += `trading: new-offer (ПЕРВЫМ!) → target-user, offer-coins, request-coins, trade-message, send-trade\n`;
        if (cp.includes('profile') || !cp.includes('admin')) f += `profile: profile-edit → profile-bio, profile-avatar, profile-banner, profile-section-* → profile-save\n`;
        if (cp.includes('music') || !cp.includes('admin')) f += `music: music-search, music-play\n`;
        if (cp.includes('roblox') || !cp.includes('admin')) f += `roblox-tracker: roblox-search, roblox-find\n`;
        if (cp.includes('convert')) f += `convert: input-discord-id, input-username, input-roblox-username, input-lumicoin-amount, button-submit-conversion\n`;
        if (cp.includes('forum')) f += `forum: button-create-topic → input-topic-title, input-topic-author, textarea-topic-content, button-submit-topic\n`;
        if (cp.includes('request')) f += `requests: button-create-request → input-username, input-discord-id, select-request-type, textarea-content, button-submit-request\n`;
        if (cp.includes('mini-game') || !cp.includes('admin')) f += `mini-games: game-wheel(таб колесо), game-rps(таб камень-ножницы), game-coinflip(монетка), game-dice(кости), game-history(история). wheel-bet-100/1000/10000+MAX(ставки), wheel-spin(крутить). rps-rock/rps-paper/rps-scissors(выбор). coin-heads/coin-tails. dice-high/dice-low/dice-even/dice-odd\n`;
        if (!cp.includes('admin')) f += `admin/login: input-username, input-password, button-login\n`;
        return f.trim();
      }
      function getFieldsEn(): string {
        let f = '';
        if (cp.includes('admin')) {
          f += `/admin: tab-settings, tab-members, tab-shop, tab-news, tab-discord, tab-convert, tab-pages, tab-requests, tab-forum, tab-stats, tab-monitoring, tab-transactions, tab-bans, tab-decorations
tab-shop: create: button-create-shop-item → input-item-name, input-item-description, input-item-price, input-item-stock, select-item-type, select-item-rarity → button-submit-shop-item. Edit: edit-Name → fields → change → button-submit-shop-item. Delete: delete-Name.
tab-members: button-add-member → input-new-username, input-new-discord-id, input-new-role. Edit: edit-Name → save-Name. Delete: delete-Name.
tab-settings: input-clan-name, input-clan-tag, textarea-description, input-hero-image, input-logo, input-splash-image, input-primary-color, input-accent-color, select-seasonal-theme → button-save-settings\n`;
        }
        if (cp.includes('trading') || !cp.includes('admin')) f += `trading: new-offer (FIRST!) → target-user, offer-coins, request-coins, trade-message, send-trade\n`;
        if (cp.includes('profile') || !cp.includes('admin')) f += `profile: profile-edit → profile-bio, profile-avatar, profile-banner, profile-section-* → profile-save\n`;
        if (cp.includes('music') || !cp.includes('admin')) f += `music: music-search, music-play\n`;
        if (cp.includes('roblox') || !cp.includes('admin')) f += `roblox-tracker: roblox-search, roblox-find\n`;
        if (cp.includes('convert')) f += `convert: input-discord-id, input-username, input-roblox-username, input-lumicoin-amount, button-submit-conversion\n`;
        if (cp.includes('forum')) f += `forum: button-create-topic → input-topic-title, input-topic-author, textarea-topic-content, button-submit-topic\n`;
        if (cp.includes('request')) f += `requests: button-create-request → input-username, input-discord-id, select-request-type, textarea-content, button-submit-request\n`;
        if (cp.includes('mini-game') || !cp.includes('admin')) f += `mini-games: game-wheel(wheel tab), game-rps(rock-paper-scissors tab), game-coinflip(coin flip), game-dice(dice), game-history(history). wheel-bet-100/1000/10000+MAX(bets), wheel-spin(spin). rps-rock/rps-paper/rps-scissors(choice). coin-heads/coin-tails. dice-high/dice-low/dice-even/dice-odd\n`;
        if (!cp.includes('admin')) f += `admin/login: input-username, input-password, button-login\n`;
        return f.trim();
      }

      const siteKnowledgeRu = `Luminary AI — ассистент клана. ${pageContext}
Разделы: /, /statistics, /leaderboard, /members(${memberCount}), /news, /about, /shop, /inventory, /convert, /requests, /forum, /roblox-tracker, /music, /achievements, /quests, /trading, /boosters, /daily-rewards, /profile, /mini-games, /clan-wars, /admin/login, /admin
${getFieldsRu()}
ТОП: ${topMembersInfo || 'нет'}
ТОВАРЫ: ${shopInfo}
Теги: [NAV:/путь], [DO:fill|поле|знач], [DO:click|кнопка], [DO:wait|_|мс], [STEP:N]
ПРАВИЛА:
- Если юзер УЖЕ на нужной странице — НЕ добавляй [NAV:]. Проверяй ${pageContext}.
- [DO:wait|_|500] после смены таба/клика edit/create.
- profile-section-* = ЧЕКБОКСЫ видимости. [DO:click|profile-section-inventory] = скрыть/показать.
- tab-members: "выдай X LC игроку Y" = [DO:click|tab-members][DO:wait|_|500][DO:click|edit-Y][DO:wait|_|500][DO:fill|member-lumiCoins|X][DO:click|save-Y]. member-lumiCoins,member-role,member-rank,member-wins,member-losses = инлайн-поля.
- НЕСКОЛЬКО ЗАДАЧ: используй [STEP:1]...[STEP:2]...[STEP:3] для КАЖДОЙ задачи. Выполняй ВСЕ задачи из запроса! Пример: "зайди в торговлю, потом статистику, потом музыку" → [STEP:1][NAV:/trading][STEP:2][NAV:/statistics][STEP:3][NAV:/music].
Примеры: "100 LC Test123"→"💰[STEP:1][NAV:/trading][DO:click|new-offer][DO:fill|target-user|Test123][DO:fill|offer-coins|100][DO:click|send-trade]"
"Создай Корона 500"→"👑[STEP:1][NAV:/admin][DO:click|tab-shop][DO:click|button-create-shop-item][DO:fill|input-item-name|Корона][DO:fill|input-item-price|500][DO:click|button-submit-shop-item]"
"Измени цену Корона→200"(на /admin)→"✏️[STEP:1][DO:click|tab-shop][DO:wait|_|500][DO:click|edit-Корона][DO:wait|_|500][DO:fill|input-item-price|200][DO:click|button-submit-shop-item]"
"Выдай 1500 монет kairozun"→"💰[STEP:1][DO:click|tab-members][DO:wait|_|500][DO:click|edit-kairozun][DO:wait|_|500][DO:fill|member-lumiCoins|1500][DO:click|save-kairozun]"
"Скрой секцию инвентарь"→"📦[STEP:1][NAV:/profile][DO:click|profile-edit][DO:wait|_|500][DO:click|profile-section-inventory][DO:click|profile-save]"
Кратко(1-2 предл), эмодзи, по-русски. "измени/поставь/сделай/выдай/начисли"→edit→fill→save. input-item-stock=сколько(1=один,-1=∞).`;

      const siteKnowledgeEn = `Luminary AI — clan assistant. ${pageContext}
Pages: /, /statistics, /leaderboard, /members(${memberCount}), /news, /about, /shop, /inventory, /convert, /requests, /forum, /roblox-tracker, /music, /achievements, /quests, /trading, /boosters, /daily-rewards, /profile, /mini-games, /clan-wars, /admin/login, /admin
${getFieldsEn()}
TOP: ${topMembersInfo || 'none'}
SHOP: ${shopInfo}
Tags: [NAV:/path], [DO:fill|field|val], [DO:click|btn], [DO:wait|_|ms], [STEP:N]
RULES:
- If user ALREADY on needed page — NO [NAV:]. Check ${pageContext}.
- [DO:wait|_|500] after tab switch/edit click/create click.
- profile-section-* = CHECKBOXES for visibility toggle. [DO:click|profile-section-inventory] = hide/show.
- tab-members: "give X LC to Y" = [DO:click|tab-members][DO:wait|_|500][DO:click|edit-Y][DO:wait|_|500][DO:fill|member-lumiCoins|X][DO:click|save-Y]. member-lumiCoins,member-role,member-rank,member-wins,member-losses = inline fields.
- MULTIPLE TASKS: use [STEP:1]...[STEP:2]...[STEP:3] for EACH task. Execute ALL tasks from request! Example: "go to trading, then stats, then music" → [STEP:1][NAV:/trading][STEP:2][NAV:/statistics][STEP:3][NAV:/music].
Examples: "100 LC Test123"→"💰[STEP:1][NAV:/trading][DO:click|new-offer][DO:fill|target-user|Test123][DO:fill|offer-coins|100][DO:click|send-trade]"
"Create Crown 500"→"👑[STEP:1][NAV:/admin][DO:click|tab-shop][DO:click|button-create-shop-item][DO:fill|input-item-name|Crown][DO:fill|input-item-price|500][DO:click|button-submit-shop-item]"
"Change Crown price→200"(on /admin)→"✏️[STEP:1][DO:click|tab-shop][DO:wait|_|500][DO:click|edit-Crown][DO:wait|_|500][DO:fill|input-item-price|200][DO:click|button-submit-shop-item]"
"Give 1500 coins to kairozun"→"💰[STEP:1][DO:click|tab-members][DO:wait|_|500][DO:click|edit-kairozun][DO:wait|_|500][DO:fill|member-lumiCoins|1500][DO:click|save-kairozun]"
"Hide inventory section"→"📦[STEP:1][NAV:/profile][DO:click|profile-edit][DO:wait|_|500][DO:click|profile-section-inventory][DO:click|profile-save]"
Concise(1-2 sent), emojis, English. "change/set/make/give/add"→edit→fill→save. input-item-stock=how many(1=one,-1=∞).`;

      const systemPrompt = language === 'ru' ? siteKnowledgeRu : siteKnowledgeEn;

      // Limit history to keep token count manageable for free providers
      const recentMessages = messages.slice(-4);
      const chatMessages = [
        { role: 'system', content: systemPrompt },
        ...recentMessages,
      ];
      const lastUserMsg = recentMessages.filter((m: any) => m.role === 'user').pop()?.content || '';

      // Helper: try a single provider
      async function tryProvider(name: string, fn: () => Promise<string | null>): Promise<{reply: string; provider: string} | null> {
        try {
          const result = await fn();
          if (result && result.length > 3 && !result.includes('<!DOCTYPE') && !result.includes('$@$')) {
            console.log(`[AI] ${name} success (${result.length} chars)`);
            return { reply: result, provider: name };
          }
        } catch (e: any) {
          console.log(`[AI] ${name} failed:`, e.message?.substring(0, 60));
        }
        return null;
      }

      // Helper: Pollinations provider factory (no delays — all start instantly)
      function pollinationsProvider(model: string, timeout: number) {
        return tryProvider(`poll-${model}`, async () => {
          const resp = await fetch('https://text.pollinations.ai/openai/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model, messages: chatMessages, max_tokens: 2000, temperature: 0.7 }),
            signal: AbortSignal.timeout(timeout),
          });
          if (!resp.ok) return null;
          const data = await resp.json();
          return data.choices?.[0]?.message?.content?.trim() || null;
        }).then(r => { if (!r) throw new Error('x'); return r; });
      }

      // Race ALL providers simultaneously — zero delays, first response wins
      const raceResult = await Promise.any([
        pollinationsProvider('openai', 22000),
        pollinationsProvider('mistral', 20000),
        pollinationsProvider('deepseek', 22000),
        pollinationsProvider('llama', 20000),
        pollinationsProvider('qwen', 20000),
        pollinationsProvider('claude-hybridspace', 22000),

        // Blackbox AI
        tryProvider('blackbox', async () => {
          const resp = await fetch('https://api.blackbox.ai/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: lastUserMsg }],
              model: 'gpt-4o-mini',
              max_tokens: 2000,
            }),
            signal: AbortSignal.timeout(18000),
          });
          if (!resp.ok) return null;
          const text = await resp.text();
          return text?.trim() || null;
        }).then(r => { if (!r) throw new Error('x'); return r; }),

        // HuggingFace Zephyr (also in race, no longer last-resort)
        tryProvider('huggingface', async () => {
          const resp = await fetch('https://api-inference.huggingface.co/models/HuggingFaceH4/zephyr-7b-beta', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              inputs: `<|system|>\n${systemPrompt}</s>\n<|user|>\n${lastUserMsg}</s>\n<|assistant|>\n`,
              parameters: { max_new_tokens: 1000, temperature: 0.7 },
            }),
            signal: AbortSignal.timeout(18000),
          });
          if (!resp.ok) return null;
          const data = await resp.json();
          const text = Array.isArray(data) ? data[0]?.generated_text : data?.generated_text;
          if (!text) return null;
          return text.split('<|assistant|>').pop()?.replace('</s>', '').trim() || null;
        }).then(r => { if (!r) throw new Error('x'); return r; }),
      ]).catch(() => null);

      if (raceResult) {
        return res.json({ reply: raceResult.reply, provider: raceResult.provider });
      }

      // All providers failed — silent auto-retry once after 2s
      console.log('[AI] All providers failed, auto-retrying...');
      await new Promise(r => setTimeout(r, 2000));
      const retryResult = await Promise.any([
        pollinationsProvider('openai', 25000),
        pollinationsProvider('mistral', 25000),
        pollinationsProvider('deepseek', 25000),
        pollinationsProvider('llama', 25000),
        pollinationsProvider('qwen', 25000),
        pollinationsProvider('claude-hybridspace', 25000),
      ]).catch(() => null);

      if (retryResult) {
        return res.json({ reply: retryResult.reply, provider: retryResult.provider + '-retry' });
      }

      // All providers failed twice — give a helpful fallback
      const fallback = language === 'ru' 
        ? '⚡ AI-сервисы перегружены. Попробуй переформулировать запрос короче или подожди 30 секунд и повтори! Совет: короткие чёткие запросы работают лучше.'
        : '⚡ AI services are overloaded. Try rephrasing shorter or wait 30s and retry! Tip: short clear requests work best.';
      res.json({ reply: fallback, provider: 'fallback' });

    } catch (error: any) {
      console.error('[AI Chat] Error:', error);
      res.status(500).json({ error: 'AI service error' });
    }
  });

  // === Roblox Tracker API ===
  const robloxApi = await import('./roblox-api');

  // Поиск пользователя Roblox по username
  app.get("/api/roblox/lookup/:username", async (req, res) => {
    try {
      const { username } = req.params;
      if (!username || username.length < 3 || username.length > 20) {
        return res.status(400).json({ success: false, error: 'Имя пользователя должно быть от 3 до 20 символов' });
      }
      const result = await robloxApi.lookupUser(username);
      res.json(result);
    } catch (error: any) {
      console.error('Roblox lookup error:', error);
      res.status(500).json({ success: false, error: 'Ошибка при поиске пользователя' });
    }
  });

  // Информация об игре по placeId
  app.get("/api/roblox/game/:placeId", async (req, res) => {
    try {
      const placeId = parseInt(req.params.placeId);
      if (isNaN(placeId)) {
        return res.status(400).json({ success: false, error: 'Неверный placeId' });
      }
      const game = await robloxApi.getGameInfo(placeId);
      if (!game) {
        return res.status(404).json({ success: false, error: 'Игра не найдена' });
      }
      res.json({ success: true, game });
    } catch (error: any) {
      res.status(500).json({ success: false, error: 'Ошибка при загрузке информации об игре' });
    }
  });

  // Поиск игр по названию
  app.get("/api/roblox/games/search", async (req, res) => {
    try {
      const keyword = req.query.keyword as string;
      if (!keyword || keyword.length < 2) {
        return res.status(400).json({ success: false, error: 'Запрос должен быть не менее 2 символов' });
      }
      const games = await robloxApi.searchGames(keyword, 12);
      res.json({ success: true, games });
    } catch (error: any) {
      console.error('Roblox game search error:', error);
      res.status(500).json({ success: false, error: 'Ошибка при поиске игр' });
    }
  });

  // Подробная информация об игре по universeId
  app.get("/api/roblox/game/details/:universeId", async (req, res) => {
    try {
      const universeId = parseInt(req.params.universeId);
      if (isNaN(universeId)) {
        return res.status(400).json({ success: false, error: 'Неверный universeId' });
      }
      const details = await robloxApi.getGameDetails(universeId);
      if (!details) {
        return res.status(404).json({ success: false, error: 'Игра не найдена' });
      }
      res.json({ success: true, game: details });
    } catch (error: any) {
      res.status(500).json({ success: false, error: 'Ошибка при загрузке деталей игры' });
    }
  });

  // Получить значки игрока в конкретной игре
  app.get("/api/roblox/player-game-badges/:userId/:universeId", async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const universeId = parseInt(req.params.universeId);
      if (isNaN(userId) || isNaN(universeId)) {
        return res.status(400).json({ success: false, error: 'Неверные параметры' });
      }
      const badges = await robloxApi.getPlayerGameBadges(userId, universeId);
      res.json({ success: true, ...badges });
    } catch (error: any) {
      res.status(500).json({ success: false, error: 'Ошибка при загрузке значков' });
    }
  });

  // Получить серверы игры
  app.get("/api/roblox/game/:placeId/servers", async (req, res) => {
    try {
      const placeId = parseInt(req.params.placeId);
      if (isNaN(placeId)) {
        return res.status(400).json({ success: false, error: 'Неверный placeId' });
      }
      const servers = await robloxApi.getGameServers(placeId, 25);
      res.json({ success: true, servers });
    } catch (error: any) {
      res.status(500).json({ success: false, error: 'Ошибка при загрузке серверов' });
    }
  });

  // Full-body Roblox avatar (for 3D-like display on dashboard)
  app.get("/api/roblox/fullbody/:username", async (req, res) => {
    try {
      const { username } = req.params;
      if (!username || username.length < 3 || username.length > 20) {
        return res.status(400).json({ success: false, error: 'Invalid username' });
      }
      const user = await robloxApi.getUserIdByUsername(username);
      if (!user) return res.status(404).json({ success: false, error: 'User not found' });
      const avatarUrl = await robloxApi.getUserFullBodyAvatar(user.id);
      const headshot = await robloxApi.getUserAvatar(user.id);
      res.json({
        success: true,
        userId: user.id,
        username: user.name,
        displayName: user.displayName,
        fullBodyUrl: avatarUrl,
        headshotUrl: headshot,
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: 'Error fetching avatar' });
    }
  });

  // ===== Server-Sent Events (SSE) for real-time updates =====
  const sseClients = new Set<import("express").Response>();

  function broadcastSSE(event: string, data: any) {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const client of sseClients) {
      try { client.write(payload); } catch { sseClients.delete(client); }
    }
  }

  // Make broadcastSSE available to other route handlers via app.locals
  app.locals.broadcastSSE = broadcastSSE;

  app.get("/api/events", (req, res) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.write('event: connected\ndata: {}\n\n');
    sseClients.add(res);
    req.on('close', () => { sseClients.delete(res); });
  });

  app.get("/auth/discord", (req, res, next) => {
    // Валидируем и сохраняем returnTo параметр в session
    const returnTo = req.query.returnTo as string;
    const validatedReturnTo = validateReturnTo(returnTo);
    req.session.returnTo = validatedReturnTo;
    passport.authenticate("discord")(req, res, next);
  });

  app.get(
    "/auth/discord/callback",
    passport.authenticate("discord", { 
      failureRedirect: "/login?error=discord_auth_failed"
    }),
    (req, res) => {
      // Получаем сохраненный returnTo (уже валидированный) или используем дефолтный
      const returnTo = req.session.returnTo || "/";
      delete req.session.returnTo; // Очищаем после использования
      // Явно сохраняем сессию перед редиректом чтобы данные успели записаться в БД
      req.session.save((err) => {
        if (err) console.error('Ошибка сохранения сессии:', err);
        res.redirect(returnTo);
      });
    }
  );

  app.post("/auth/logout", (req, res) => {
    req.logout((err) => {
      if (err) {
        return res.status(500).json({ error: "Ошибка при выходе" });
      }
      req.session.destroy((destroyErr) => {
        if (destroyErr) {
          return res.status(500).json({ error: "Ошибка при очистке сессии" });
        }
        res.clearCookie('luminary.sid');
        res.json({ success: true });
      });
    });
  });

  app.get("/auth/user", (req, res) => {
    if (req.isAuthenticated()) {
      const user = req.user as any;
      if (user && user.type === 'admin') {
        const { passwordHash, ...safeUser } = user;
        res.json({ user: safeUser });
      } else {
        res.json({ user: req.user });
      }
    } else {
      res.json({ user: null });
    }
  });

  app.post("/auth/guest", (req, res) => {
    res.json({ success: true, message: "Гостевой режим активирован" });
  });

  app.get("/api/clan/stats", async (req, res) => {
    try {
      let stats = await storage.getClanStats();
      
      if (!stats) {
        const members = await storage.getAllClanMembers();
        const totalMembers = members.length;
        const totalWins = members.reduce((sum, m) => sum + (m.wins || 0), 0);
        const totalLosses = members.reduce((sum, m) => sum + (m.losses || 0), 0);
        const averageRank = totalMembers > 0 
          ? Math.floor(members.reduce((sum, m) => sum + (m.rank || 0), 0) / totalMembers)
          : 0;
        const monthlyActivity = members.reduce((sum, m) => sum + (m.lumiCoins || 0), 0);

        stats = await storage.updateClanStats({
          totalMembers,
          totalWins,
          totalLosses,
          averageRank,
          monthlyActivity,
        });
      }

      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/monthly-stats", async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 12;
      const stats = await storage.getMonthlyStats(limit);
      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/clan/settings", async (req, res) => {
    try {
      const settings = await storage.getClanSettings();
      res.json(settings);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/members", async (req, res) => {
    try {
      const members = await storage.getAllClanMembers();
      res.json(members);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/members/top", async (req, res) => {
    try {
      const members = await storage.getTopClanMembers(5);
      res.json(members);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/members/by-discord/:discordId", async (req, res) => {
    try {
      const { discordId } = req.params;
      const members = await storage.getAllClanMembers();
      const member = members.find(m => m.discordId === discordId);
      
      if (!member) {
        return res.status(404).json({ error: "Участник не найден" });
      }
      
      res.json(member);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/news", async (req, res) => {
    try {
      const news = await storage.getAllNews();
      res.json(news);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/news/latest", async (req, res) => {
    try {
      const news = await storage.getLatestNews(3);
      res.json(news);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/ai/messages", async (req, res) => {
    try {
      const messages = await storage.getAllAiMessages();
      res.json(messages);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/ai/chat", async (req, res) => {
    try {
      const { content } = req.body;
      if (!content || typeof content !== 'string') {
        return res.status(400).json({ error: "Content is required" });
      }

      await storage.createAiMessage({
        role: "user",
        content,
        metadata: null,
      });

      const stats = await storage.getClanStats();
      const members = await storage.getAllClanMembers();
      const topMembers = members.slice(0, 5);

      const systemPrompt = `Ты - AI советник элитного игрового клана "Clan Command". 
      Твоя задача - помогать участникам клана, анализировать статистику и давать полезные советы.
      
      Текущая статистика клана:
      - Всего участников: ${stats?.totalMembers || 0}
      - Побед: ${stats?.totalWins || 0}
      - Поражений: ${stats?.totalLosses || 0}
      - Средний рейтинг: ${stats?.averageRank || 0}
      
      Топ-5 участников:
      ${topMembers.map((m, i) => `${i+1}. ${m.username} - ${m.lumiCoins} LumiCoin`).join('\n')}
      
      Отвечай дружелюбно, профессионально и давай конкретные советы. Используй данные для персонализации ответов.`;

      const aiResponse = await getChatCompletion(content, systemPrompt);

      await storage.createAiMessage({
        role: "assistant",
        content: aiResponse,
        metadata: null,
      });

      const allMessages = await storage.getAllAiMessages();
      res.json(allMessages);
    } catch (error: any) {
      console.error("AI chat error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/discord/info", async (req, res) => {
    try {
      const info = await getDiscordServerInfo();
      res.json(info);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/login", (req, res, next) => {
    passport.authenticate("local", (err: any, user: any, info: any) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      if (!user) {
        return res.status(401).json({ error: info?.message || "Неверный логин или пароль" });
      }
      req.logIn(user, (err) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        // Явно сохраняем сессию перед отправкой ответа
        req.session.save((saveErr) => {
          if (saveErr) console.error('Ошибка сохранения сессии:', saveErr);
          return res.json({ 
            success: true, 
            admin: { 
              id: user.id, 
              username: user.username 
            } 
          });
        });
      });
    })(req, res, next);
  });

  app.post("/api/admin/logout", (req, res) => {
    req.logout((err) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({ success: true });
    });
  });

  app.get("/api/admin/check", (req, res) => {
    if (req.isAuthenticated() && (req.user as any).type === 'admin') {
      res.json({ 
        authenticated: true, 
        admin: { 
          id: (req.user as any).id, 
          username: (req.user as any).username 
        } 
      });
    } else {
      res.json({ authenticated: false });
    }
  });

  app.get("/api/admin/settings", requireAdmin, async (req, res) => {
    try {
      const settings = await storage.getClanSettings();
      res.json(settings);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/admin/settings", requireAdmin, async (req, res) => {
    try {
      const settings = await storage.updateClanSettings(req.body);
      res.json(settings);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/members", requireAdmin, async (req, res) => {
    try {
      const validatedData = insertClanMemberSchema.parse(req.body);
      const member = await storage.createClanMember(validatedData);
      res.status(201).json(member);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.put("/api/admin/members/:id", requireAdmin, async (req, res) => {
    try {
      const member = await storage.updateClanMember(req.params.id, req.body);
      if (!member) {
        return res.status(404).json({ error: "Участник не найден" });
      }
      res.json(member);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/admin/members/:id", requireAdmin, async (req, res) => {
    try {
      await storage.deleteClanMember(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/sync-discord-members", requireAdmin, async (req, res) => {
    try {
      const discordMembers = await getDiscordMembers();
      
      if (discordMembers.length === 0) {
        return res.status(400).json({ 
          error: "Участников не найдено. Убедитесь, что Discord бот подключен к серверу." 
        });
      }

      let syncedCount = 0;
      let updatedCount = 0;
      let newCount = 0;

      for (const discordMember of discordMembers) {
        const existingMember = await storage.getClanMemberByDiscordId(discordMember.discordId);
        
        if (existingMember) {
          await storage.updateClanMember(existingMember.id, {
            username: discordMember.username,
            avatar: discordMember.avatar,
            role: discordMember.role,
          });
          updatedCount++;
        } else {
          await storage.createClanMember({
            discordId: discordMember.discordId,
            username: discordMember.username,
            avatar: discordMember.avatar,
            role: discordMember.role,
            rank: 0,
            wins: 0,
            losses: 0,
            kills: 0,
            deaths: 0,
            assists: 0,
            lumiCoins: 0,
          });
          newCount++;
        }
        syncedCount++;
      }

      res.json({ 
        success: true, 
        syncedCount,
        newCount,
        updatedCount,
        message: `Синхронизировано ${syncedCount} участников (новых: ${newCount}, обновлено: ${updatedCount})`
      });
    } catch (error: any) {
      console.error("Discord sync error:", error);
      
      let errorMessage = error.message;
      
      if (error.message.includes('TokenInvalid')) {
        errorMessage = 'Discord бот не настроен. Нужен Bot Token.';
      } else if (error.message.includes('disallowed intents')) {
        errorMessage = 'Необходимо включить "SERVER MEMBERS INTENT" в Discord Developer Portal. Перейдите в раздел Bot → Privileged Gateway Intents и включите "SERVER MEMBERS INTENT".';
      }
      
      res.status(500).json({ error: errorMessage });
    }
  });

  app.post("/api/admin/news", requireAdmin, async (req, res) => {
    try {
      const validatedData = insertNewsSchema.parse(req.body);
      const newsItem = await storage.createNews(validatedData);
      res.status(201).json(newsItem);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.put("/api/admin/news/:id", requireAdmin, async (req, res) => {
    try {
      const news = await storage.updateNews(req.params.id, req.body);
      if (!news) {
        return res.status(404).json({ error: "Новость не найдена" });
      }
      res.json(news);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/admin/news/:id", requireAdmin, async (req, res) => {
    try {
      await storage.deleteNews(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/admin/stats", requireAdmin, async (req, res) => {
    try {
      const validatedData = insertClanStatsSchema.parse(req.body);
      const stats = await storage.updateClanStats(validatedData);
      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/discord/channels", requireAdmin, async (req, res) => {
    try {
      const channels = await getDiscordChannels();
      res.json(channels);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/discord/members", requireAdmin, async (req, res) => {
    try {
      const members = await getDiscordMembersForAdmin();
      res.json(members);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/discord/send-message", requireAdmin, async (req, res) => {
    try {
      const { channelId, message } = req.body;
      if (!channelId || !message) {
        return res.status(400).json({ error: "channelId и message обязательны" });
      }
      const result = await sendDiscordMessage(channelId, message);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/discord/kick", requireAdmin, async (req, res) => {
    try {
      const { userId } = req.body;
      if (!userId) {
        return res.status(400).json({ error: "userId обязателен" });
      }
      const result = await kickDiscordMember(userId);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/discord/ban", requireAdmin, async (req, res) => {
    try {
      const { userId } = req.body;
      if (!userId) {
        return res.status(400).json({ error: "userId обязателен" });
      }
      const result = await banDiscordMember(userId);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/discord/roles", requireAdmin, async (req, res) => {
    try {
      const roles = await getDiscordRoles();
      res.json(roles);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/discord/create-test-roles", requireAdmin, async (req, res) => {
    try {
      const result = await createBeautifulTestRoles();
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Music API endpoints - требуют Discord-аутентификации
  const requireMusicAuth = (req: any, res: any, next: any) => {
    // Разрешаем и админам, и Discord-пользователям
    if (req.isAuthenticated()) {
      return next();
    }
    res.status(401).json({ error: "Требуется авторизация" });
  };

  app.get("/api/music/voice-channels", requireMusicAuth, async (req, res) => {
    try {
      const channels = await getVoiceChannels();
      res.json(channels);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/music/now-playing", requireMusicAuth, async (req, res) => {
    try {
      const distube = getDistube();
      const client = distube.client;
      const guild = client.guilds.cache.first();
      
      if (!guild) {
        return res.status(500).json({ error: "Discord сервер не найден" });
      }

      const result = await getCurrentSong(guild.id);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/music/loading-status", requireMusicAuth, async (req, res) => {
    try {
      const distube = getDistube();
      const client = distube.client;
      const guild = client.guilds.cache.first();
      
      if (!guild) {
        return res.status(500).json({ error: "Discord сервер не найден" });
      }

      const status = getLoadingStatus(guild.id);
      res.json(status);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Debug logs endpoint — public for diagnostics
  app.get("/api/music/debug-logs", async (req, res) => {
    try {
      const logs = getDebugLogs();
      res.json({ logs, count: logs.length });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/music/play", requireMusicAuth, async (req, res) => {
    try {
      const { query, channelId } = req.body;
      if (!query || !channelId) {
        return res.status(400).json({ error: "query и channelId обязательны" });
      }

      const distube = getDistube();
      const client = distube.client;
      const guild = client.guilds.cache.first();
      
      if (!guild) {
        return res.status(500).json({ error: "Discord сервер не найден" });
      }

      const channel = await guild.channels.fetch(channelId);
      if (!channel || !channel.isVoiceBased()) {
        return res.status(400).json({ error: "Голосовой канал не найден" });
      }

      // Fire-and-forget: addSong runs in background, we return fast
      // This prevents Render's 30s gateway timeout from killing the request
      addSong(guild, channel, null, query, "Web User")
        .then(result => {
          console.log(`[Music Play] Background result: ${result.success ? '✅' : '❌'} ${result.message}`);
        })
        .catch(err => {
          console.error('[Music Play] Background error:', err.message);
        });

      // Return immediately — frontend will poll /now-playing and /queue
      res.json({ success: true, message: '⏳ Загрузка трека...' });
    } catch (error: any) {
      console.error('[Music Play Error]', error.message);
      if (!res.headersSent) {
        res.status(500).json({ error: error.message });
      }
    }
  });

  app.post("/api/music/pause", requireMusicAuth, async (req, res) => {
    try {
      const distube = getDistube();
      const client = distube.client;
      const guild = client.guilds.cache.first();
      
      if (!guild) {
        return res.status(500).json({ error: "Discord сервер не найден" });
      }

      const result = await pauseSong(guild.id);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/music/resume", requireMusicAuth, async (req, res) => {
    try {
      const distube = getDistube();
      const client = distube.client;
      const guild = client.guilds.cache.first();
      
      if (!guild) {
        return res.status(500).json({ error: "Discord сервер не найден" });
      }

      const result = await resumeSong(guild.id);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/music/skip", requireMusicAuth, async (req, res) => {
    try {
      const distube = getDistube();
      const client = distube.client;
      const guild = client.guilds.cache.first();
      
      if (!guild) {
        return res.status(500).json({ error: "Discord сервер не найден" });
      }

      const result = await skipSong(guild.id);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/music/stop", requireMusicAuth, async (req, res) => {
    try {
      const distube = getDistube();
      const client = distube.client;
      const guild = client.guilds.cache.first();
      
      if (!guild) {
        return res.status(500).json({ error: "Discord сервер не найден" });
      }

      const result = await stopSong(guild.id);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/music/shuffle", requireMusicAuth, async (req, res) => {
    try {
      const distube = getDistube();
      const client = distube.client;
      const guild = client.guilds.cache.first();
      
      if (!guild) {
        return res.status(500).json({ error: "Discord сервер не найден" });
      }

      const result = await shuffleQueue(guild.id);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/music/loop", requireMusicAuth, async (req, res) => {
    try {
      const distube = getDistube();
      const client = distube.client;
      const guild = client.guilds.cache.first();
      
      if (!guild) {
        return res.status(500).json({ error: "Discord сервер не найден" });
      }

      const result = await toggleLoop(guild.id);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/music/queue", requireMusicAuth, async (req, res) => {
    try {
      const distube = getDistube();
      const client = distube.client;
      const guild = client.guilds.cache.first();
      
      if (!guild) {
        return res.status(500).json({ error: "Discord сервер не найден" });
      }

      const result = await getQueue(guild.id);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/music/volume", requireMusicAuth, async (req, res) => {
    try {
      const { volume } = req.body;
      if (volume === undefined || volume < 0 || volume > 100) {
        return res.status(400).json({ error: "Громкость должна быть от 0 до 100" });
      }

      const distube = getDistube();
      const client = distube.client;
      const guild = client.guilds.cache.first();
      
      if (!guild) {
        return res.status(500).json({ error: "Discord сервер не найден" });
      }

      const result = await setVolume(guild.id, volume);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/music/search", requireMusicAuth, async (req, res) => {
    try {
      const { query, limit = 5 } = req.body;
      if (!query) {
        return res.status(400).json({ error: "query обязателен" });
      }

      const result = await searchSongs(query, limit);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Jump to a specific track in the queue
  app.post("/api/music/jump", requireMusicAuth, async (req, res) => {
    try {
      const { position } = req.body;
      if (!position || position < 1) {
        return res.status(400).json({ error: "position обязателен (число >= 1)" });
      }

      const distube = getDistube();
      const client = distube.client;
      const guild = client.guilds.cache.first();
      if (!guild) {
        return res.status(500).json({ error: "Discord сервер не найден" });
      }

      // Fire-and-forget — jumpToSong calls playSong which takes time
      jumpToSong(guild.id, position)
        .then(result => {
          console.log(`[Music Jump] Background: ${result.success ? '✅' : '❌'} ${result.message}`);
        })
        .catch(err => {
          console.error('[Music Jump] Background error:', err.message);
        });

      res.json({ success: true, message: '⏭️ Переключение...' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Remove a track from the queue
  app.post("/api/music/remove", requireMusicAuth, async (req, res) => {
    try {
      const { position } = req.body;
      if (!position || position < 1) {
        return res.status(400).json({ error: "position обязателен (число >= 1)" });
      }

      const distube = getDistube();
      const client = distube.client;
      const guild = client.guilds.cache.first();
      if (!guild) {
        return res.status(500).json({ error: "Discord сервер не найден" });
      }

      const result = await removeSong(guild.id, position);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Clear queue (keep current track)
  app.post("/api/music/clear", requireMusicAuth, async (req, res) => {
    try {
      const distube = getDistube();
      const client = distube.client;
      const guild = client.guilds.cache.first();
      if (!guild) {
        return res.status(500).json({ error: "Discord сервер не найден" });
      }

      const result = await clearQueue(guild.id);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Debug endpoint: test streaming strategies
  app.get("/api/music/debug-stream/:videoId", requireMusicAuth, async (req, res) => {
    try {
      const result = await testStreaming(req.params.videoId);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Full audio diagnostic: test tone → voice channel
  app.post("/api/music/test-audio", requireMusicAuth, async (req, res) => {
    try {
      const { channelId } = req.body;
      if (!channelId) {
        return res.status(400).json({ error: "channelId обязателен" });
      }

      const distube = getDistube();
      const client = distube.client;
      const guild = client.guilds.cache.first();
      if (!guild) {
        return res.status(500).json({ error: "Discord сервер не найден" });
      }

      const channel = await guild.channels.fetch(channelId);
      if (!channel || !channel.isVoiceBased()) {
        return res.status(400).json({ error: "Голосовой канал не найден" });
      }

      const result = await testAudioEndToEnd(guild, channel);
      res.json(result);
    } catch (error: any) {
      console.error('[Test Audio Error]', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Quick voice debug endpoint - no auth required for diagnostics
  app.get("/api/music/voice-debug", async (_req, res) => {
    try {
      const distube = getDistube();
      const client = distube.client;
      const wsStatus = client.ws.status;
      const wsStatusName = ['READY','CONNECTING','RECONNECTING','IDLE','NEARLY','DISCONNECTED','WAITING_FOR_GUILDS','IDENTIFYING','RESUMING'][wsStatus] || `UNKNOWN(${wsStatus})`;
      const guild = client.guilds.cache.first();
      const channelId = '1421975908784541907';
      let channelInfo: any = null;
      let permissions: any = null;
      if (guild) {
        try {
          const ch = await guild.channels.fetch(channelId);
          if (ch && ch.isVoiceBased()) {
            const me = guild.members.me;
            const perms = me ? ch.permissionsFor(me) : null;
            channelInfo = { name: ch.name, type: ch.type, id: ch.id };
            permissions = perms ? {
              Connect: perms.has('Connect'),
              Speak: perms.has('Speak'),
              ViewChannel: perms.has('ViewChannel'),
            } : 'no bot member found';
          }
        } catch (e: any) { channelInfo = { error: e.message }; }
      }
      res.json({
        botReady: client.isReady(),
        wsStatus: wsStatusName,
        guilds: client.guilds.cache.size,
        guildName: guild?.name,
        guildId: guild?.id,
        channel: channelInfo,
        permissions,
        uptime: process.uptime(),
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // UDP connectivity test — check if outbound UDP works on this host
  app.get("/api/music/udp-test", async (_req, res) => {
    const dgram = await import('node:dgram');
    const results: any = { tests: [] };
    
    // Test 1: Can we create a UDP socket?
    try {
      const socket = dgram.createSocket('udp4');
      await new Promise<void>((resolve, reject) => {
        socket.bind(0, () => {
          const addr = socket.address();
          results.tests.push({ test: 'create-socket', status: 'ok', detail: `Bound to ${addr.address}:${addr.port}` });
          resolve();
        });
        socket.on('error', (err) => {
          results.tests.push({ test: 'create-socket', status: 'fail', detail: err.message });
          reject(err);
        });
        setTimeout(() => { reject(new Error('timeout')); }, 5000);
      });

      // Test 2: Can we send a UDP packet to a Discord voice server?
      // Use the voice server endpoint from the debug: c-arn07-68996708.discord.media:8443
      await new Promise<void>((resolve) => {
        const testBuf = Buffer.alloc(74); // IP discovery packet size
        // Try sending to discord voice server
        socket.send(testBuf, 0, testBuf.length, 443, '66.22.196.0', (err) => {
          if (err) {
            results.tests.push({ test: 'udp-send', status: 'fail', detail: err.message });
          } else {
            results.tests.push({ test: 'udp-send', status: 'ok', detail: 'Packet sent successfully' });
          }
          resolve();
        });
        setTimeout(resolve, 3000);
      });

      socket.close();
    } catch (e: any) {
      results.tests.push({ test: 'udp-overall', status: 'fail', detail: e.message });
    }
    
    res.json(results);
  });

  app.get("/api/requests", async (req, res) => {
    try {
      const requests = await storage.getAllRequests();
      res.json(requests);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/requests/:id", async (req, res) => {
    try {
      const request = await storage.getRequestById(req.params.id);
      if (!request) {
        return res.status(404).json({ error: "Запрос не найден" });
      }
      res.json(request);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/requests", async (req, res) => {
    try {
      const validatedData = insertRequestSchema.parse(req.body);
      const request = await storage.createRequest(validatedData);
      res.json(request);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.patch("/api/requests/:id/respond", requireAdmin, async (req, res) => {
    try {
      const { status, adminResponse, respondedBy } = req.body;
      if (!status || !adminResponse || !respondedBy) {
        return res.status(400).json({ error: "status, adminResponse, respondedBy обязательны" });
      }
      
      const request = await storage.respondToRequest(
        req.params.id,
        status,
        adminResponse,
        respondedBy
      );
      
      if (!request) {
        return res.status(404).json({ error: "Запрос не найден" });
      }
      
      res.json(request);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/requests/:id", requireAdmin, async (req, res) => {
    try {
      const success = await storage.deleteRequest(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Запрос не найден" });
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/forum/topics", async (req, res) => {
    try {
      const topics = await storage.getAllForumTopics();
      res.json(topics);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/forum/topics/:id", async (req, res) => {
    try {
      const topic = await storage.getForumTopicById(req.params.id);
      if (!topic) {
        return res.status(404).json({ error: "Топик не найден" });
      }
      await storage.incrementTopicViews(req.params.id);
      res.json(topic);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/forum/topics", async (req, res) => {
    try {
      const validatedData = insertForumTopicSchema.parse(req.body);
      const topic = await storage.createForumTopic(validatedData);
      res.json(topic);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.patch("/api/forum/topics/:id", requireAdmin, async (req, res) => {
    try {
      const { isPinned, isLocked } = req.body;
      const topic = await storage.updateForumTopic(req.params.id, { isPinned, isLocked });
      if (!topic) {
        return res.status(404).json({ error: "Топик не найден" });
      }
      res.json(topic);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/forum/topics/:id", requireAdmin, async (req, res) => {
    try {
      const success = await storage.deleteForumTopic(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Топик не найден" });
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/forum/topics/:topicId/replies", async (req, res) => {
    try {
      const replies = await storage.getForumRepliesByTopic(req.params.topicId);
      res.json(replies);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/forum/topics/:topicId/replies", async (req, res) => {
    try {
      const validatedData = insertForumReplySchema.parse({
        ...req.body,
        topicId: req.params.topicId,
      });
      const reply = await storage.createForumReply(validatedData);
      res.json(reply);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete("/api/forum/replies/:id", requireAdmin, async (req, res) => {
    try {
      const success = await storage.deleteForumReply(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Ответ не найден" });
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/shop/items", async (req, res) => {
    try {
      const items = await storage.getActiveShopItems();
      res.json(items);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/shop/items/:id", async (req, res) => {
    try {
      const item = await storage.getShopItemById(req.params.id);
      if (!item) {
        return res.status(404).json({ error: "Предмет не найден" });
      }
      res.json(item);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/shop/purchase", requireDiscordAuth, async (req, res) => {
    try {
      const { itemId } = req.body;
      const user = req.user as any;
      
      const item = await storage.getShopItemById(itemId);
      if (!item) {
        return res.status(404).json({ error: "Предмет не найден" });
      }

      if (!item.isAvailable) {
        return res.status(400).json({ error: "Предмет недоступен" });
      }

      const member = await storage.getClanMemberById(user.id);
      if (!member || !member.discordId) {
        return res.status(404).json({ error: "Пользователь не найден" });
      }

      const balance = member.lumiCoins || 0;
      if (balance < item.price) {
        return res.status(400).json({ error: "Недостаточно LumiCoin" });
      }

      await storage.removeLumiCoins(member.id, item.price, `Покупка: ${item.name}`);

      const purchase = await storage.createPurchase({
        memberId: member.id,
        itemId: item.id,
        discordId: member.discordId,
        price: item.price,
        status: 'completed',
      });

      if (item.itemType === 'role') {
        const { assignDiscordRole } = await import('./discord');
        try {
          const roleData = {
            roleName: item.name,
            roleColor: item.roleColor || undefined,
            permissions: item.discordPermissions || [],
          };
          await assignDiscordRole(member.discordId, roleData);
        } catch (error) {
          console.error('Ошибка выдачи роли:', error);
        }
      }

      res.json({ 
        success: true, 
        purchase,
        newBalance: (member.lumiCoins || 0) - item.price 
      });
      // SSE: broadcast balance change
      if (app.locals.broadcastSSE) {
        app.locals.broadcastSSE('balance-update', { discordId: member.discordId, newBalance: (member.lumiCoins || 0) - item.price, username: member.username });
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/shop/purchases/:discordId", async (req, res) => {
    try {
      const purchases = await storage.getPurchasesByDiscordId(req.params.discordId);
      res.json(purchases);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/shop/balance/:discordId", async (req, res) => {
    try {
      const input = req.params.discordId;
      let actualDiscordId = input;

      // Определяем тип ввода: если только цифры - это Discord ID, иначе - username
      const isNumericId = /^\d+$/.test(input);
      
      if (!isNumericId) {
        // Это username - получаем Discord ID по username
        const member = await storage.getClanMemberByUsername(input);
        if (!member || !member.discordId) {
          return res.status(404).json({ error: "Пользователь с таким username не найден" });
        }
        actualDiscordId = member.discordId;
      }

      const balance = await storage.getMemberBalance(actualDiscordId);
      res.json({ balance });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/shop/transactions/:discordId", async (req, res) => {
    try {
      const transactions = await storage.getTransactionsByDiscordId(req.params.discordId);
      res.json(transactions);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/shop/items", requireAdmin, async (req, res) => {
    try {
      const items = await storage.getAllShopItems();
      res.json(items);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/shop/items", requireAdmin, async (req, res) => {
    try {
      const validatedData = insertShopItemSchema.parse(req.body);
      const item = await storage.createShopItem(validatedData);
      res.json(item);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.patch("/api/admin/shop/items/:id", requireAdmin, async (req, res) => {
    try {
      const updated = await storage.updateShopItem(req.params.id, req.body);
      if (!updated) {
        return res.status(404).json({ error: "Предмет не найден" });
      }
      res.json(updated);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete("/api/admin/shop/items/:id", requireAdmin, async (req, res) => {
    try {
      const success = await storage.deleteShopItem(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Предмет не найден" });
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/shop/import-roles", requireAdmin, async (req, res) => {
    try {
      const roles = await getDiscordRoles();
      
      const rolesToImport = roles.filter((role: any) => {
        const permissions = BigInt(role.permissions);
        const hasAdminPerms = 
          (permissions & (1n << 3n)) !== 0n ||  // Administrator
          (permissions & (1n << 5n)) !== 0n ||  // ManageGuild  
          (permissions & (1n << 28n)) !== 0n || // ManageRoles
          (permissions & (1n << 2n)) !== 0n ||  // KickMembers
          (permissions & (1n << 4n)) !== 0n;    // BanMembers
        return !hasAdminPerms && !role.name.includes('@everyone');
      });

      const categoryPrices: { [key: string]: number } = {
        'legendary': 10000,
        'unique': 5000,
        'rare': 2500,
        'beautiful': 1000,
        'common': 500
      };

      const importedItems = [];
      let updatedCount = 0;
      for (const role of rolesToImport) {
        const category = role.position > 20 ? 'legendary' :
                        role.position > 15 ? 'unique' :
                        role.position > 10 ? 'rare' :
                        role.position > 5 ? 'beautiful' : 'common';
        
        const existing = await storage.getShopItemByDiscordRoleId(role.id);
        if (!existing) {
          const item = await storage.createShopItem({
            name: role.name,
            description: `Красивая роль ${role.name} с уникальным цветом`,
            price: categoryPrices[category],
            itemType: 'role',
            roleCategory: category,
            discordRoleId: role.id,
            roleColor: role.color || '#808080',
            discordPermissions: role.permissions || [],
            isAvailable: true,
            stock: -1
          });
          importedItems.push(item);
        } else {
          await db.update(shopItems)
            .set({ 
              name: role.name,
              roleColor: role.color || '#808080',
              discordPermissions: role.permissions || [],
              updatedAt: new Date()
            })
            .where(eq(shopItems.id, existing.id));
          updatedCount++;
        }
      }

      res.json({ 
        success: true, 
        imported: importedItems.length,
        updated: updatedCount,
        items: importedItems
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/earning-settings", requireAdmin, async (req, res) => {
    try {
      const settings = await storage.getClanSettings();
      res.json({
        messageRewardRate: settings.messageRewardRate ?? 1.0,
        voiceRewardRate: settings.voiceRewardRate ?? 10.0,
        reactionRewardRate: settings.reactionRewardRate ?? 1.0,
        antiSpamEnabled: settings.antiSpamEnabled ?? true,
        antiSpamMessageWindow: settings.antiSpamMessageWindow ?? 10,
        antiSpamMessageThreshold: settings.antiSpamMessageThreshold ?? 5,
        antiSpamPenaltyRate: settings.antiSpamPenaltyRate ?? 0.1,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/admin/earning-settings", requireAdmin, async (req, res) => {
    try {
      const {
        messageRewardRate,
        voiceRewardRate,
        reactionRewardRate,
        antiSpamEnabled,
        antiSpamMessageWindow,
        antiSpamMessageThreshold,
        antiSpamPenaltyRate,
      } = req.body;

      const updates: any = {};
      if (messageRewardRate !== undefined) updates.messageRewardRate = messageRewardRate;
      if (voiceRewardRate !== undefined) updates.voiceRewardRate = voiceRewardRate;
      if (reactionRewardRate !== undefined) updates.reactionRewardRate = reactionRewardRate;
      if (antiSpamEnabled !== undefined) updates.antiSpamEnabled = antiSpamEnabled;
      if (antiSpamMessageWindow !== undefined) updates.antiSpamMessageWindow = antiSpamMessageWindow;
      if (antiSpamMessageThreshold !== undefined) updates.antiSpamMessageThreshold = antiSpamMessageThreshold;
      if (antiSpamPenaltyRate !== undefined) updates.antiSpamPenaltyRate = antiSpamPenaltyRate;

      const settings = await storage.updateClanSettings(updates);
      res.json({
        messageRewardRate: settings.messageRewardRate,
        voiceRewardRate: settings.voiceRewardRate,
        reactionRewardRate: settings.reactionRewardRate,
        antiSpamEnabled: settings.antiSpamEnabled,
        antiSpamMessageWindow: settings.antiSpamMessageWindow,
        antiSpamMessageThreshold: settings.antiSpamMessageThreshold,
        antiSpamPenaltyRate: settings.antiSpamPenaltyRate,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Получить логи транзакций LumiCoins для мониторинга (с параметрами пути)
  app.get("/api/admin/coin-transactions/:type/:limit/:offset", requireAdmin, async (req, res) => {
    try {
      const { type, limit, offset } = req.params;
      const { discordId } = req.query;
      
      const options: any = {};
      if (type && type !== "all") options.type = type;
      if (discordId) options.discordId = discordId as string;
      if (limit) options.limit = parseInt(limit);
      if (offset) options.offset = parseInt(offset);
      
      const result = await storage.getAllTransactions(options);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Получить логи транзакций LumiCoins для мониторинга (с query параметрами - для обратной совместимости)
  app.get("/api/admin/coin-transactions", requireAdmin, async (req, res) => {
    try {
      const { type, discordId, limit, offset } = req.query;
      
      const options: any = {};
      if (type && type !== "all") options.type = type as string;
      if (discordId) options.discordId = discordId as string;
      if (limit) options.limit = parseInt(limit as string);
      if (offset) options.offset = parseInt(offset as string);
      
      const result = await storage.getAllTransactions(options);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // === РАСШИРЕННАЯ ЭКОНОМИКА ===
  
  // Получить все предметы (расширенный магазин) - объединяет items + shop_items (роли)
  app.get("/api/items", async (req, res) => {
    try {
      const { db } = await import("./db");
      const { items, shopItems } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");
      
      // Получаем предметы из новой системы
      const newItems = await db.select().from(items).where(eq(items.isAvailable, true));
      
      // Получаем роли из старой системы
      const roles = await db.select().from(shopItems).where(eq(shopItems.isAvailable, true));
      
      // Преобразуем роли в формат items
      const rolesAsItems = roles.map((role) => ({
        id: role.id,
        name: role.name,
        description: role.description || "",
        price: role.price,
        category: "role",
        rarity: role.roleCategory === "legendary" ? "legendary" : 
                role.roleCategory === "rare" ? "rare" : 
                role.roleCategory === "beautiful" ? "epic" : "common",
        itemData: {
          roleColor: role.roleColor,
          roleIcon: role.roleIcon,
          discordRoleId: role.discordRoleId,
          itemType: role.itemType,
        },
        imageUrl: role.imageUrl,
        stock: role.stock,
        isAvailable: role.isAvailable,
        isPurchasable: true,
        isGiftable: true,
        createdAt: role.createdAt,
        updatedAt: role.updatedAt,
      }));
      
      // Объединяем обе системы
      const allItems = [...newItems, ...rolesAsItems];
      res.json(allItems);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Получить инвентарь пользователя
  app.get("/api/inventory/:discordId", async (req, res) => {
    try {
      const { db } = await import("./db");
      const { userInventory, items, clanMembers } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");
      
      const input = req.params.discordId;
      let actualDiscordId = input;

      // Определяем тип ввода: если только цифры - это Discord ID, иначе - username
      const isNumericId = /^\d+$/.test(input);
      
      if (!isNumericId) {
        // Это username - получаем Discord ID по username
        const memberByUsername = await storage.getClanMemberByUsername(input);
        if (!memberByUsername || !memberByUsername.discordId) {
          return res.status(404).json({ error: "Пользователь с таким username не найден" });
        }
        actualDiscordId = memberByUsername.discordId;
      }

      const member = await db.select().from(clanMembers).where(eq(clanMembers.discordId, actualDiscordId)).limit(1);
      
      if (!member[0]) {
        return res.status(404).json({ error: "Member not found" });
      }
      
      const inventory = await db.select({
        inventoryId: userInventory.id,
        quantity: userInventory.quantity,
        isEquipped: userInventory.isEquipped,
        acquiredAt: userInventory.acquiredAt,
        expiresAt: userInventory.expiresAt,
        item: items
      })
      .from(userInventory)
      .innerJoin(items, eq(userInventory.itemId, items.id))
      .where(eq(userInventory.memberId, member[0].id));
      
      res.json(inventory);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Получить достижения пользователя
  app.get("/api/achievements/:discordId", async (req, res) => {
    try {
      const { db } = await import("./db");
      const { userAchievements, achievements, clanMembers } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");
      
      const { discordId } = req.params;
      const member = await db.select().from(clanMembers).where(eq(clanMembers.discordId, discordId)).limit(1);
      
      if (!member[0]) {
        return res.status(404).json({ error: "Member not found" });
      }
      
      const userAchs = await db.select({
        userAchievementId: userAchievements.id,
        progress: userAchievements.progress,
        isCompleted: userAchievements.isCompleted,
        completedAt: userAchievements.completedAt,
        achievement: achievements
      })
      .from(userAchievements)
      .innerJoin(achievements, eq(userAchievements.achievementId, achievements.id))
      .where(eq(userAchievements.memberId, member[0].id));
      
      res.json(userAchs);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Получить все достижения
  app.get("/api/achievements", async (req, res) => {
    try {
      const { db } = await import("./db");
      const { achievements } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");
      
      const allAchievements = await db.select().from(achievements).where(eq(achievements.isSecret, false));
      res.json(allAchievements);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Покупка предмета (unified: items + shop_items/roles)
  app.post("/api/items/purchase", async (req, res) => {
    try {
      const { db } = await import("./db");
      const { items, userInventory, clanMembers, shopItems } = await import("@shared/schema");
      const { eq, sql } = await import("drizzle-orm");
      
      const { discordId, itemId } = req.body;
      
      if (!discordId || !itemId) {
        return res.status(400).json({ error: "Discord ID or Username and Item ID required" });
      }
      
      // Determine if input is Discord ID (only digits) or username (contains letters)
      const isDiscordId = /^\d+$/.test(discordId);
      
      let member;
      if (isDiscordId) {
        // Search by Discord ID
        member = await db.select().from(clanMembers).where(eq(clanMembers.discordId, discordId)).limit(1);
      } else {
        // Search by username
        member = await db.select().from(clanMembers).where(eq(clanMembers.username, discordId)).limit(1);
      }
      
      if (!member[0]) {
        return res.status(404).json({ error: isDiscordId ? "Member with this Discord ID not found" : "Member with this username not found" });
      }
      
      // Use the actual Discord ID from the found member
      const actualDiscordId = member[0].discordId;
      if (!actualDiscordId) {
        return res.status(400).json({ error: "Member does not have a Discord ID" });
      }
      
      // Try to find in items table first
      let itemData = await db.select().from(items).where(eq(items.id, itemId)).limit(1);
      let isRole = false;
      let roleData = null;
      
      // If not found in items, try shop_items (roles)
      if (!itemData[0]) {
        const roleItem = await db.select().from(shopItems).where(eq(shopItems.id, itemId)).limit(1);
        if (!roleItem[0]) {
          return res.status(404).json({ error: "Item not found" });
        }
        isRole = true;
        roleData = roleItem[0];
        
        if (!roleData.isAvailable) {
          return res.status(400).json({ error: "Item is not available" });
        }
        
        if (roleData.stock !== -1 && roleData.stock <= 0) {
          return res.status(400).json({ error: "Item out of stock" });
        }
        
        if (member[0].lumiCoins < roleData.price) {
          return res.status(400).json({ error: "Insufficient LumiCoins", required: roleData.price, current: member[0].lumiCoins });
        }
        
        // Deduct coins
        await db.update(clanMembers)
          .set({ lumiCoins: sql`${clanMembers.lumiCoins} - ${roleData.price}` })
          .where(eq(clanMembers.id, member[0].id));
        
        // Update stock if limited
        if (roleData.stock !== -1) {
          await db.update(shopItems)
            .set({ stock: sql`${shopItems.stock} - 1` })
            .where(eq(shopItems.id, roleData.id));
        }
        
        // Assign Discord role
        const { assignDiscordRole } = await import('./discord');
        try {
          await assignDiscordRole(actualDiscordId, {
            roleName: roleData.name,
            roleColor: roleData.roleColor || undefined,
            permissions: roleData.discordPermissions || [],
          });
        } catch (error) {
          console.error('Error assigning Discord role:', error);
        }
        
        res.json({ 
          success: true, 
          message: "Role purchased and assigned successfully",
          newBalance: member[0].lumiCoins - roleData.price,
          item: roleData
        });
      } else {
        // Regular item from items table
        const item = itemData[0];
        
        if (!item.isAvailable) {
          return res.status(400).json({ error: "Item is not available" });
        }
        
        if (item.stock !== -1 && item.stock <= 0) {
          return res.status(400).json({ error: "Item out of stock" });
        }
        
        if (member[0].lumiCoins < item.price) {
          return res.status(400).json({ error: "Insufficient LumiCoins", required: item.price, current: member[0].lumiCoins });
        }
        
        // Deduct coins
        await db.update(clanMembers)
          .set({ lumiCoins: sql`${clanMembers.lumiCoins} - ${item.price}` })
          .where(eq(clanMembers.id, member[0].id));
        
        // Update stock if limited
        if (item.stock !== -1) {
          await db.update(items)
            .set({ stock: sql`${items.stock} - 1` })
            .where(eq(items.id, item.id));
        }
        
        // Add to inventory
        await db.insert(userInventory).values({
          memberId: member[0].id,
          itemId: item.id,
          quantity: 1,
          acquiredAt: new Date()
        });
        
        res.json({ 
          success: true, 
          message: "Item purchased successfully",
          newBalance: member[0].lumiCoins - item.price,
          item: item
        });
      }
    } catch (error: any) {
      console.error("Purchase error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Применить смену имени на Discord сервере
  app.post("/api/items/use-nickname-change", async (req, res) => {
    try {
      const { db } = await import("./db");
      const { userInventory, items, clanMembers } = await import("@shared/schema");
      const { eq, and } = await import("drizzle-orm");
      
      const { discordId, inventoryId, newNickname } = req.body;
      
      if (!discordId || !inventoryId || !newNickname) {
        return res.status(400).json({ error: "Discord ID, Inventory ID, and new nickname required" });
      }
      
      const member = await db.select().from(clanMembers).where(eq(clanMembers.discordId, discordId)).limit(1);
      if (!member[0]) {
        return res.status(404).json({ error: "Member not found" });
      }
      
      const inventory = await db.select({
        inventoryId: userInventory.id,
        itemId: userInventory.itemId,
        item: items
      })
      .from(userInventory)
      .innerJoin(items, eq(userInventory.itemId, items.id))
      .where(and(
        eq(userInventory.id, inventoryId),
        eq(userInventory.memberId, member[0].id)
      ))
      .limit(1);
      
      if (!inventory[0]) {
        return res.status(404).json({ error: "Item not found in inventory" });
      }
      
      const itemData = inventory[0].item.itemData as any;
      if (!itemData || itemData.serviceType !== 'nickname_change' && itemData.serviceType !== 'nickname_change_vip') {
        return res.status(400).json({ error: "This item is not a nickname change service" });
      }
      
      const result = await changeDiscordNickname(discordId, newNickname);
      
      await db.delete(userInventory).where(eq(userInventory.id, inventoryId));
      
      res.json({ 
        success: true, 
        message: result.message,
        oldNickname: result.oldNickname,
        newNickname: result.newNickname
      });
    } catch (error: any) {
      console.error("Nickname change error:", error);
      res.status(500).json({ error: error.message || "Failed to change nickname" });
    }
  });

  // Получить ежедневную награду
  app.post("/api/daily-reward/claim", async (req, res) => {
    try {
      const { db } = await import("./db");
      const { dailyRewards, clanMembers } = await import("@shared/schema");
      const { eq, sql } = await import("drizzle-orm");
      
      const { discordId } = req.body;
      const member = await db.select().from(clanMembers).where(eq(clanMembers.discordId, discordId)).limit(1);
      
      if (!member[0]) {
        return res.status(404).json({ error: "Member not found" });
      }
      
      const existingReward = await db.select().from(dailyRewards).where(eq(dailyRewards.memberId, member[0].id)).limit(1);
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      if (existingReward.length > 0) {
        const lastClaim = new Date(existingReward[0].lastClaimDate);
        const lastClaimDay = new Date(lastClaim.getFullYear(), lastClaim.getMonth(), lastClaim.getDate());
        const diffDays = Math.floor((today.getTime() - lastClaimDay.getTime()) / (1000 * 60 * 60 * 24));
        
        if (diffDays === 0) {
          return res.status(400).json({ error: "Already claimed today", nextClaimAt: new Date(today.getTime() + 24 * 60 * 60 * 1000) });
        }
        
        const newStreak = diffDays === 1 ? existingReward[0].streakDays + 1 : 1;
        const baseReward = 50;
        const streakBonus = Math.min(newStreak * 10, 200);
        const totalReward = baseReward + streakBonus;
        
        await db.update(dailyRewards)
          .set({
            lastClaimDate: now,
            streakDays: newStreak,
            totalClaims: existingReward[0].totalClaims + 1
          })
          .where(eq(dailyRewards.id, existingReward[0].id));
        
        await db.update(clanMembers)
          .set({ lumiCoins: sql`${clanMembers.lumiCoins} + ${totalReward}` })
          .where(eq(clanMembers.id, member[0].id));
        
        res.json({ 
          claimed: true, 
          reward: totalReward, 
          streak: newStreak,
          nextClaimAt: new Date(today.getTime() + 24 * 60 * 60 * 1000)
        });
      } else {
        await db.insert(dailyRewards).values({
          memberId: member[0].id,
          lastClaimDate: now,
          streakDays: 1,
          totalClaims: 1
        });
        
        const baseReward = 50;
        await db.update(clanMembers)
          .set({ lumiCoins: sql`${clanMembers.lumiCoins} + ${baseReward}` })
          .where(eq(clanMembers.id, member[0].id));
        
        res.json({ 
          claimed: true, 
          reward: baseReward, 
          streak: 1,
          nextClaimAt: new Date(today.getTime() + 24 * 60 * 60 * 1000)
        });
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/monitoring", requireAdmin, async (req, res) => {
    try {
      const { botClient } = await import("./bot-commands");
      const { db } = await import("./db");
      const { clanMembers, requests, news } = await import("@shared/schema");
      
      const uptime = process.uptime();
      const memUsage = process.memoryUsage();
      const totalMemory = memUsage.heapTotal + memUsage.external;
      const usedMemory = memUsage.heapUsed;
      
      const botStatus = botClient?.isReady() ? "online" : "offline";
      const botPing = botClient?.ws.ping || 0;
      const botGuilds = botClient?.guilds.cache.size || 0;
      const voiceConnections = botClient?.voice?.adapters ? botClient.voice.adapters.size : 0;
      
      const dbStart = Date.now();
      const [members, requestsData, newsData] = await Promise.all([
        db.select().from(clanMembers),
        db.select().from(requests),
        db.select().from(news)
      ]);
      const dbResponseTime = Date.now() - dbStart;
      
      const discordInfo = await getDiscordServerInfo();
      
      res.json({
        server: {
          status: "online",
          uptime: Math.floor(uptime),
          memory: {
            used: usedMemory,
            total: totalMemory
          },
          cpu: process.cpuUsage().user / 1000000
        },
        bot: {
          status: botStatus,
          username: botClient?.user?.tag || "N/A",
          ping: botPing,
          guilds: botGuilds,
          voiceConnections
        },
        database: {
          status: "online",
          responseTime: dbResponseTime,
          connections: 1
        },
        stats: {
          totalMembers: members.length,
          onlineMembers: discordInfo?.onlineCount || 0,
          totalRequests: requestsData.length,
          totalNews: newsData.length
        }
      });
    } catch (error: any) {
      res.status(500).json({ 
        error: error.message,
        server: {
          status: "degraded",
          uptime: Math.floor(process.uptime()),
          memory: { used: 0, total: 0 },
          cpu: 0
        },
        bot: {
          status: "offline",
          username: "N/A",
          ping: 0,
          guilds: 0,
          voiceConnections: 0
        },
        database: {
          status: "offline",
          responseTime: 0,
          connections: 0
        },
        stats: {
          totalMembers: 0,
          onlineMembers: 0,
          totalRequests: 0,
          totalNews: 0
        }
      });
    }
  });

  // ==================== ROBUX CONVERSION ENDPOINTS ====================

  // Получение настроек конвертации
  app.get("/api/robux/settings", async (req, res) => {
    try {
      const { db } = await import("./db");
      const { robuxConversionSettings } = await import("@shared/schema");
      
      let settings = await db.select().from(robuxConversionSettings);
      
      if (settings.length === 0) {
        // Создаем настройки по умолчанию если не существуют
        await db.insert(robuxConversionSettings).values({
          exchangeRate: 1000,
          minAmount: 1000,
          maxAmount: 100000,
          isEnabled: true
        });
        settings = await db.select().from(robuxConversionSettings);
      }
      
      res.json(settings[0]);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Создание запроса на конвертацию
  app.post("/api/robux/convert", async (req, res) => {
    try {
      const { db } = await import("./db");
      const { robuxConversionRequests, robuxConversionSettings, clanMembers } = await import("@shared/schema");
      const { eq, sql } = await import("drizzle-orm");
      
      const validatedData = insertRobuxConversionRequestSchema.parse(req.body);
      
      // Проверка настроек
      const settings = await db.select().from(robuxConversionSettings);
      if (settings.length === 0 || !settings[0].isEnabled) {
        return res.status(400).json({ error: "Конвертация временно недоступна" });
      }
      
      const { exchangeRate, minAmount, maxAmount } = settings[0];
      
      // Проверка лимитов
      if (validatedData.lumiCoinAmount < minAmount) {
        return res.status(400).json({ error: `Минимальная сумма для конвертации: ${minAmount} LC` });
      }
      if (validatedData.lumiCoinAmount > maxAmount) {
        return res.status(400).json({ error: `Максимальная сумма для конвертации: ${maxAmount} LC` });
      }
      
      // Получение участника
      const member = await db.select().from(clanMembers)
        .where(eq(clanMembers.discordId, validatedData.discordId));
      
      if (member.length === 0) {
        return res.status(404).json({ error: "Участник не найден" });
      }
      
      // Проверка баланса
      if (member[0].lumiCoins < validatedData.lumiCoinAmount) {
        return res.status(400).json({ error: "Недостаточно LumiCoin" });
      }
      
      // Расчет Robux
      const robuxAmount = Math.floor(validatedData.lumiCoinAmount / exchangeRate);
      
      // Создание запроса
      const request = await db.insert(robuxConversionRequests).values({
        memberId: member[0].id,
        discordId: validatedData.discordId,
        username: validatedData.username || member[0].username,
        robloxUsername: validatedData.robloxUsername,
        lumiCoinAmount: validatedData.lumiCoinAmount,
        robuxAmount,
        status: "pending"
      }).returning();
      
      // Списание LumiCoin сразу (резервирование)
      await db.update(clanMembers)
        .set({ lumiCoins: sql`${clanMembers.lumiCoins} - ${validatedData.lumiCoinAmount}` })
        .where(eq(clanMembers.id, member[0].id));
      
      res.json(request[0]);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Получение запросов пользователя
  app.get("/api/robux/requests/:discordId", async (req, res) => {
    try {
      const { db } = await import("./db");
      const { robuxConversionRequests } = await import("@shared/schema");
      const { eq, desc } = await import("drizzle-orm");
      
      const requests = await db.select().from(robuxConversionRequests)
        .where(eq(robuxConversionRequests.discordId, req.params.discordId))
        .orderBy(desc(robuxConversionRequests.createdAt));
      
      res.json(requests);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ADMIN: Получение всех запросов
  app.get("/api/admin/robux/requests", requireAdmin, async (req, res) => {
    try {
      const { db } = await import("./db");
      const { robuxConversionRequests } = await import("@shared/schema");
      const { desc } = await import("drizzle-orm");
      
      const requests = await db.select().from(robuxConversionRequests)
        .orderBy(desc(robuxConversionRequests.createdAt));
      
      res.json(requests);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ADMIN: Обновление настроек конвертации
  app.put("/api/admin/robux/settings", requireAdmin, async (req, res) => {
    try {
      const { db } = await import("./db");
      const { robuxConversionSettings } = await import("@shared/schema");
      const { sql: sqlDrizzle } = await import("drizzle-orm");
      
      const validatedData = insertRobuxConversionSettingsSchema.parse(req.body);
      
      const settings = await db.select().from(robuxConversionSettings);
      
      if (settings.length === 0) {
        const newSettings = await db.insert(robuxConversionSettings)
          .values(validatedData)
          .returning();
        res.json(newSettings[0]);
      } else {
        const updated = await db.update(robuxConversionSettings)
          .set({ ...validatedData, updatedAt: new Date() })
          .returning();
        res.json(updated[0]);
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ADMIN: Обработка запроса (одобрение/отклонение)
  app.put("/api/admin/robux/requests/:id", requireAdmin, async (req, res) => {
    try {
      const { db } = await import("./db");
      const { robuxConversionRequests, clanMembers } = await import("@shared/schema");
      const { eq, sql } = await import("drizzle-orm");
      
      const { status, adminNote } = req.body;
      
      if (!["approved", "rejected", "completed"].includes(status)) {
        return res.status(400).json({ error: "Неверный статус" });
      }
      
      const request = await db.select().from(robuxConversionRequests)
        .where(eq(robuxConversionRequests.id, req.params.id));
      
      if (request.length === 0) {
        return res.status(404).json({ error: "Запрос не найден" });
      }
      
      // Если запрос отклонен, возвращаем LumiCoin
      if (status === "rejected" && request[0].status === "pending") {
        await db.update(clanMembers)
          .set({ lumiCoins: sql`${clanMembers.lumiCoins} + ${request[0].lumiCoinAmount}` })
          .where(eq(clanMembers.id, request[0].memberId));
      }
      
      const updated = await db.update(robuxConversionRequests)
        .set({ 
          status, 
          adminNote,
          processedAt: new Date(),
          processedBy: req.user?.id
        })
        .where(eq(robuxConversionRequests.id, req.params.id))
        .returning();
      
      res.json(updated[0]);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ===== Profile Decorations (Декорации профиля) =====

  // PUBLIC: Получить все назначенные декорации (для отображения возле ников)
  app.get("/api/decorations/all-equipped", async (req, res) => {
    try {
      const { db } = await import("./db");
      const { eq } = await import("drizzle-orm");
      const results = await db.select({
        discordId: memberDecorations.discordId,
        emoji: profileDecorations.emoji,
        type: profileDecorations.type,
        color: profileDecorations.color,
        name: profileDecorations.name,
        rarity: profileDecorations.rarity,
        cssEffect: profileDecorations.cssEffect,
        isEquipped: memberDecorations.isEquipped,
      })
        .from(memberDecorations)
        .innerJoin(profileDecorations, eq(memberDecorations.decorationId, profileDecorations.id))
        .where(eq(memberDecorations.isEquipped, true));
      
      // Группируем по discordId
      const grouped: Record<string, Array<{emoji: string | null, type: string, color: string | null, name: string, rarity: string, cssEffect: string | null}>> = {};
      for (const row of results) {
        if (!grouped[row.discordId]) grouped[row.discordId] = [];
        grouped[row.discordId].push({ emoji: row.emoji, type: row.type, color: row.color, name: row.name, rarity: row.rarity, cssEffect: row.cssEffect });
      }
      res.json(grouped);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // PUBLIC: Получить все доступные декорации
  app.get("/api/decorations", async (req, res) => {
    try {
      const { db } = await import("./db");
      const { eq } = await import("drizzle-orm");
      const decorations = await db.select().from(profileDecorations)
        .where(eq(profileDecorations.isAvailable, true))
        .orderBy(profileDecorations.createdAt);
      res.json(decorations);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // PUBLIC: Получить декорации конкретного участника
  app.get("/api/decorations/member/:discordId", async (req, res) => {
    try {
      const { db } = await import("./db");
      const { eq } = await import("drizzle-orm");
      const decorations = await db.select({
        decoration: profileDecorations,
        memberDecoration: memberDecorations,
      })
        .from(memberDecorations)
        .innerJoin(profileDecorations, eq(memberDecorations.decorationId, profileDecorations.id))
        .where(eq(memberDecorations.discordId, req.params.discordId));
      res.json(decorations);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ADMIN: Получить все декорации (включая недоступные)
  app.get("/api/admin/decorations", requireAdmin, async (req, res) => {
    try {
      const { db } = await import("./db");
      const { desc } = await import("drizzle-orm");
      const decorations = await db.select().from(profileDecorations)
        .orderBy(desc(profileDecorations.createdAt));
      res.json(decorations);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ADMIN: Создать декорацию
  app.post("/api/admin/decorations", requireAdmin, async (req, res) => {
    try {
      const { db } = await import("./db");
      const validatedData = insertProfileDecorationSchema.parse(req.body);
      const [decoration] = await db.insert(profileDecorations).values(validatedData).returning();
      res.status(201).json(decoration);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // ADMIN: Обновить декорацию
  app.patch("/api/admin/decorations/:id", requireAdmin, async (req, res) => {
    try {
      const { db } = await import("./db");
      const { eq } = await import("drizzle-orm");
      const [updated] = await db.update(profileDecorations)
        .set({ ...req.body, updatedAt: new Date() })
        .where(eq(profileDecorations.id, req.params.id))
        .returning();
      if (!updated) return res.status(404).json({ error: "Декорация не найдена" });
      res.json(updated);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // ADMIN: Удалить декорацию
  app.delete("/api/admin/decorations/:id", requireAdmin, async (req, res) => {
    try {
      const { db } = await import("./db");
      const { eq } = await import("drizzle-orm");
      const [deleted] = await db.delete(profileDecorations)
        .where(eq(profileDecorations.id, req.params.id))
        .returning();
      if (!deleted) return res.status(404).json({ error: "Декорация не найдена" });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ADMIN: Выдать декорацию участнику
  app.post("/api/admin/decorations/assign", requireAdmin, async (req, res) => {
    try {
      const { db } = await import("./db");
      const { eq, and } = await import("drizzle-orm");
      const { clanMembers } = await import("@shared/schema");
      const { decorationId, discordId } = req.body;

      // Проверяем существование участника
      const [member] = await db.select().from(clanMembers).where(eq(clanMembers.discordId, discordId));
      if (!member) return res.status(404).json({ error: "Участник не найден" });

      // Проверяем существование декорации
      const [decoration] = await db.select().from(profileDecorations).where(eq(profileDecorations.id, decorationId));
      if (!decoration) return res.status(404).json({ error: "Декорация не найдена" });

      // Проверяем, что участник ещё не имеет эту декорацию
      const [existing] = await db.select().from(memberDecorations)
        .where(and(
          eq(memberDecorations.discordId, discordId),
          eq(memberDecorations.decorationId, decorationId)
        ));
      if (existing) return res.status(400).json({ error: "Участник уже имеет эту декорацию" });

      // Выдаём декорацию
      const [assigned] = await db.insert(memberDecorations).values({
        memberId: member.id,
        decorationId,
        discordId,
        isEquipped: false,
      }).returning();

      // Обновляем счётчик владельцев
      await db.update(profileDecorations)
        .set({ currentOwners: decoration.currentOwners + 1 })
        .where(eq(profileDecorations.id, decorationId));

      res.status(201).json(assigned);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ADMIN: Забрать декорацию у участника
  app.delete("/api/admin/decorations/revoke/:id", requireAdmin, async (req, res) => {
    try {
      const { db } = await import("./db");
      const { eq } = await import("drizzle-orm");
      const [revoked] = await db.delete(memberDecorations)
        .where(eq(memberDecorations.id, req.params.id))
        .returning();
      if (!revoked) return res.status(404).json({ error: "Запись не найдена" });

      // Уменьшаем счётчик владельцев
      const [decoration] = await db.select().from(profileDecorations)
        .where(eq(profileDecorations.id, revoked.decorationId));
      if (decoration && decoration.currentOwners > 0) {
        await db.update(profileDecorations)
          .set({ currentOwners: decoration.currentOwners - 1 })
          .where(eq(profileDecorations.id, revoked.decorationId));
      }

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ADMIN: Получить владельцев конкретной декорации
  app.get("/api/admin/decorations/:id/owners", requireAdmin, async (req, res) => {
    try {
      const { db } = await import("./db");
      const { eq } = await import("drizzle-orm");
      const { clanMembers } = await import("@shared/schema");
      const owners = await db.select({
        memberDecoration: memberDecorations,
        member: clanMembers,
      })
        .from(memberDecorations)
        .innerJoin(clanMembers, eq(memberDecorations.memberId, clanMembers.id))
        .where(eq(memberDecorations.decorationId, req.params.id));
      res.json(owners);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // PLAYER: Мои декорации (с информацией о декорации)
  app.get("/api/decorations/my", requireDiscordAuth, async (req, res) => {
    try {
      const { db } = await import("./db");
      const { eq, inArray } = await import("drizzle-orm");
      const { clanMembers } = await import("@shared/schema");
      const discordId = (req as any).user?.discordId;
      if (!discordId) return res.status(401).json({ error: "Не авторизован" });

      // Query member decorations directly by discordId (no join)
      const myDecs = await db.select().from(memberDecorations)
        .where(eq(memberDecorations.discordId, discordId));

      if (myDecs.length === 0) return res.json([]);

      // Batch-fetch all decoration details
      const decIds = myDecs.map(d => d.decorationId);
      const allDecs = await db.select().from(profileDecorations)
        .where(inArray(profileDecorations.id, decIds));
      const decMap = new Map(allDecs.map(d => [d.id, d]));

      const results = myDecs.map(md => {
        const dec = decMap.get(md.decorationId);
        if (!dec) return null;
        return {
          memberDecorationId: md.id,
          decorationId: md.decorationId,
          isEquipped: md.isEquipped,
          decoration: {
            id: dec.id,
            name: dec.name,
            description: dec.description,
            type: dec.type,
            emoji: dec.emoji,
            imageUrl: dec.imageUrl,
            cssEffect: dec.cssEffect,
            color: dec.color,
            rarity: dec.rarity,
            price: dec.price,
            category: dec.category,
            maxOwners: dec.maxOwners,
            currentOwners: dec.currentOwners,
          },
        };
      }).filter(Boolean);

      res.json(results);
    } catch (error: any) {
      console.error('/api/decorations/my error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // PLAYER: Купить декорацию за LumiCoins
  app.post("/api/decorations/buy", requireDiscordAuth, async (req, res) => {
    try {
      const { db } = await import("./db");
      const { eq, and } = await import("drizzle-orm");
      const { clanMembers } = await import("@shared/schema");
      const { decorationId } = req.body;
      const discordId = (req.user as any)?.discordId;
      if (!discordId) return res.status(401).json({ error: "Not authenticated" });

      const [decoration] = await db.select().from(profileDecorations).where(eq(profileDecorations.id, decorationId));
      if (!decoration) return res.status(404).json({ error: "Декорация не найдена" });
      if (!decoration.isAvailable) return res.status(400).json({ error: "Декорация недоступна" });
      if (decoration.maxOwners > 0 && decoration.currentOwners >= decoration.maxOwners) {
        return res.status(400).json({ error: "Лимит владельцев исчерпан" });
      }

      // Проверяем, не куплена ли уже
      const [existing] = await db.select().from(memberDecorations)
        .where(and(eq(memberDecorations.discordId, discordId), eq(memberDecorations.decorationId, decorationId)));
      if (existing) return res.status(400).json({ error: "Уже куплено" });

      // Проверяем баланс
      const [member] = await db.select().from(clanMembers).where(eq(clanMembers.discordId, discordId));
      if (!member) return res.status(404).json({ error: "Участник не найден" });
      if ((member.lumiCoins || 0) < decoration.price) return res.status(400).json({ error: "Недостаточно LC" });

      // Списываем LC
      const newBalance = (member.lumiCoins || 0) - decoration.price;
      await db.update(clanMembers).set({ lumiCoins: newBalance }).where(eq(clanMembers.id, member.id));

      // Выдаём декорацию
      const [assigned] = await db.insert(memberDecorations).values({
        memberId: member.id,
        decorationId,
        discordId,
        isEquipped: false,
      }).returning();

      await db.update(profileDecorations)
        .set({ currentOwners: decoration.currentOwners + 1 })
        .where(eq(profileDecorations.id, decorationId));

      // SSE: broadcast balance change
      if (app.locals.broadcastSSE) {
        app.locals.broadcastSSE('balance-update', { discordId, newBalance, username: member.username });
      }

      res.json({ success: true, newBalance, memberDecoration: assigned, message: `Декорация "${decoration.name}" куплена!` });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // PLAYER: Надеть/снять декорацию
  app.post("/api/decorations/equip", requireDiscordAuth, async (req, res) => {
    try {
      const { db } = await import("./db");
      const { eq, and } = await import("drizzle-orm");
      // Accept both decorationId (from client) and legacy memberDecorationId
      const { decorationId, memberDecorationId, equip } = req.body;
      const discordId = (req.user as any)?.discordId;
      if (!discordId) return res.status(401).json({ error: "Not authenticated" });

      let md;
      if (decorationId) {
        // Look up by discordId + decorationId (primary path)
        [md] = await db.select().from(memberDecorations)
          .where(and(eq(memberDecorations.discordId, discordId), eq(memberDecorations.decorationId, decorationId)));
      } else if (memberDecorationId) {
        // Legacy: look up by memberDecoration id
        [md] = await db.select().from(memberDecorations).where(eq(memberDecorations.id, memberDecorationId));
        if (md && md.discordId !== discordId) md = undefined;
      }
      if (!md) return res.status(404).json({ error: "Декорация не найдена в вашей коллекции" });

      await db.update(memberDecorations)
        .set({ isEquipped: !!equip })
        .where(eq(memberDecorations.id, md.id));

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ===== Page Availability Management =====
  
  // PUBLIC: Получить статус всех страниц
  app.get("/api/page-availability", async (req, res) => {
    try {
      const { db } = await import("./db");
      const { pageAvailability } = await import("@shared/schema");
      
      const pages = await db.select().from(pageAvailability);
      
      const availabilityMap: Record<string, any> = {};
      pages.forEach(page => {
        availabilityMap[page.pageId] = {
          isEnabled: page.isEnabled,
          titleRu: page.maintenanceTitleRu,
          titleEn: page.maintenanceTitleEn,
          messageRu: page.maintenanceMessageRu,
          messageEn: page.maintenanceMessageEn,
        };
      });
      
      res.json(availabilityMap);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ADMIN: Получить все страницы с полной информацией
  app.get("/api/admin/page-availability", requireAdmin, async (req, res) => {
    try {
      const { db } = await import("./db");
      const { pageAvailability } = await import("@shared/schema");
      const { asc } = await import("drizzle-orm");
      
      const pages = await db.select().from(pageAvailability)
        .orderBy(asc(pageAvailability.pageName));
      
      res.json(pages);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ADMIN: Обновить статус страницы
  app.patch("/api/admin/page-availability/:id", requireAdmin, async (req, res) => {
    try {
      const { db } = await import("./db");
      const { pageAvailability, insertPageAvailabilitySchema } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");
      
      const partialSchema = insertPageAvailabilitySchema.partial();
      const validatedData = partialSchema.parse(req.body);
      
      const updated = await db.update(pageAvailability)
        .set({ 
          ...validatedData,
          updatedBy: req.user?.username || "Admin",
          updatedAt: new Date() 
        })
        .where(eq(pageAvailability.id, req.params.id))
        .returning();
      
      if (updated.length === 0) {
        return res.status(404).json({ error: "Страница не найдена" });
      }
      
      res.json(updated[0]);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // === СИСТЕМА БАНОВ НА САЙТЕ ===

  // Получить все баны (ADMIN)
  app.get("/api/admin/site-bans", requireAdmin, async (req, res) => {
    try {
      const bans = await storage.getAllSiteBans();
      res.json(bans);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Создать бан (ADMIN)
  app.post("/api/admin/site-bans", requireAdmin, async (req, res) => {
    try {
      const { insertSiteBanSchema } = await import("@shared/schema");
      const validatedData = insertSiteBanSchema.parse(req.body);
      const ban = await storage.createSiteBan(validatedData);
      res.json(ban);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Обновить бан (ADMIN)
  app.patch("/api/admin/site-bans/:id", requireAdmin, async (req, res) => {
    try {
      const ban = await storage.updateSiteBan(req.params.id, req.body);
      if (!ban) {
        return res.status(404).json({ error: "Бан не найден" });
      }
      res.json(ban);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Удалить бан (ADMIN)
  app.delete("/api/admin/site-bans/:id", requireAdmin, async (req, res) => {
    try {
      const success = await storage.deleteSiteBan(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Бан не найден" });
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Проверить активный бан пользователя (PUBLIC)
  app.get("/api/check-ban/:discordId", async (req, res) => {
    try {
      const ban = await storage.getActiveSiteBan(req.params.discordId);
      res.json({ banned: !!ban, ban });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Удалить ответ на форуме (ADMIN)
  app.delete("/api/admin/forum/replies/:id", requireAdmin, async (req, res) => {
    try {
      const success = await storage.deleteForumReply(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Ответ не найден" });
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Удалить топик форума (ADMIN)
  app.delete("/api/admin/forum/topics/:id", requireAdmin, async (req, res) => {
    try {
      const success = await storage.deleteForumTopic(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Топик не найден" });
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Закрепить/открепить топик форума (ADMIN)
  app.patch("/api/admin/forum/topics/:id/pin", requireAdmin, async (req, res) => {
    try {
      const { isPinned } = req.body;
      const topic = await storage.updateForumTopic(req.params.id, { isPinned });
      if (!topic) {
        return res.status(404).json({ error: "Топик не найден" });
      }
      res.json(topic);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Заблокировать/разблокировать топик форума (ADMIN)
  app.patch("/api/admin/forum/topics/:id/lock", requireAdmin, async (req, res) => {
    try {
      const { isLocked } = req.body;
      const topic = await storage.updateForumTopic(req.params.id, { isLocked });
      if (!topic) {
        return res.status(404).json({ error: "Топик не найден" });
      }
      res.json(topic);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Удалить ответ на форуме по topicId и replyId (ADMIN)
  app.delete("/api/admin/forum/topics/:topicId/replies/:replyId", requireAdmin, async (req, res) => {
    try {
      const success = await storage.deleteForumReply(req.params.replyId);
      if (!success) {
        return res.status(404).json({ error: "Ответ не найден" });
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================
  // ВИДЕОПЛАТФОРМА
  // ============================================

  // Загрузить видео (требуется Discord авторизация)
  app.post("/api/videos/upload", requireDiscordAuth, videoUpload.single("video"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "Файл видео не найден" });
      }

      console.log(`📹 Начало загрузки видео: ${req.file.filename}, размер: ${(req.file.size / (1024 * 1024)).toFixed(2)}MB`);

      const { title, description } = req.body;
      if (!title) {
        return res.status(400).json({ error: "Название видео обязательно" });
      }

      const user = req.user as any;
      
      // Получить или создать канал пользователя
      let channel = await storage.getChannelByOwnerId(user.discordId);
      if (!channel) {
        // Создать канал автоматически
        channel = await storage.createChannel({
          name: `${user.username}'s Channel`,
          handle: `@${user.username.toLowerCase().replace(/[^a-z0-9]/g, '')}_${Date.now()}`,
          description: `Канал пользователя ${user.username}`,
          ownerId: user.discordId,
          ownerUsername: user.username,
          ownerAvatar: user.avatar || null,
        });
      }
      
      // Генерация превью с timeout
      let thumbnailPath = null;
      try {
        const thumbnailFilename = `thumb_${Date.now()}_${req.file.filename.replace(/\.[^/.]+$/, ".jpg")}`;
        thumbnailPath = path.join("uploads", "thumbnails", thumbnailFilename);
        
        // Добавляем timeout 10 секунд для генерации thumbnail
        const thumbnailPromise = generateVideoThumbnail(req.file.path, thumbnailPath, req.file.size);
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error("Thumbnail generation timeout")), 10000)
        );
        
        await Promise.race([thumbnailPromise, timeoutPromise]);
        console.log(`✅ Thumbnail generated: ${thumbnailPath}`);
      } catch (thumbError) {
        console.warn(`⚠️ Thumbnail generation failed: ${thumbError instanceof Error ? thumbError.message : 'Unknown error'}`);
        // Продолжаем без превью если не удалось сгенерировать
        thumbnailPath = null;
      }

      const videoData = {
        channelId: channel.id,
        title,
        description: description || "",
        fileName: req.file.filename,
        filePath: req.file.path,
        thumbnailPath,
        fileSize: req.file.size,
        uploadedBy: user.discordId,
        uploadedByUsername: user.username,
        uploadedByAvatar: user.avatar || null,
      };

      const video = await storage.createVideo(videoData);
      
      // Увеличить счетчик видео на канале
      await storage.incrementChannelVideoCount(channel.id);
      
      console.log(`✅ Видео успешно загружено: ${video.id}, title: ${video.title}, size: ${(video.fileSize / (1024 * 1024)).toFixed(2)}MB`);
      
      res.status(201).json(video);
    } catch (error: any) {
      console.error("Video upload error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Получить список всех видео (с поддержкой поиска)
  app.get("/api/videos", async (req, res) => {
    try {
      const searchQuery = req.query.q as string | undefined;
      const videos = searchQuery 
        ? await storage.searchVideos(searchQuery)
        : await storage.getAllVideos();
      res.json(videos);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Helper function to escape HTML
  function escapeHtml(text: string): string {
    const map: { [key: string]: string } = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, (char) => map[char]);
  }

  // Server-side rendering для видео страницы с OG тегами (для социальных сетей)
  // Поддержка обоих форматов URL: /video-platform/watch/:id и /v/:id
  const serveVideoPage = async (req: any, res: any) => {
    try {
      const video = await storage.getVideoById(req.params.id);
      if (!video) {
        // Если видео не найдено, перенаправляем на клиентское приложение
        return res.redirect(`/video-platform?error=video_not_found`);
      }

      // Validate and escape video ID to prevent XSS
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(video.id)) {
        console.error('Invalid video ID format:', video.id);
        return res.redirect('/video-platform');
      }
      const safeId = video.id; // Safe after validation

      // Escape user-supplied content to prevent XSS
      const safeTitle = escapeHtml(video.title);
      const safeDescription = escapeHtml(video.description || `Смотрите видео "${video.title}" на Highlights`);

      // Determine MIME type from file extension with safe fallback
      let videoMimeType = 'video/mp4'; // Default fallback
      if (video.filePath) {
        const ext = path.extname(video.filePath).toLowerCase();
        const mimeTypes: Record<string, string> = {
          '.mp4': 'video/mp4',
          '.webm': 'video/webm',
          '.mov': 'video/quicktime',
          '.avi': 'video/x-msvideo',
          '.mkv': 'video/x-matroska',
        };
        videoMimeType = mimeTypes[ext] || 'video/mp4';
      }

      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const videoUrl = `${baseUrl}/video-platform/watch/${video.id}`;
      const videoStreamUrl = `${baseUrl}/api/videos/${video.id}/stream`;
      const thumbnailUrl = video.thumbnailPath ? `${baseUrl}/api/videos/${video.id}/thumbnail` : '';

      // HTML с Open Graph meta тегами (с экранированием для безопасности)
      const html = `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${safeTitle} - Highlights</title>
  
  <!-- Open Graph meta tags -->
  <meta property="og:type" content="video.other">
  <meta property="og:url" content="${videoUrl}">
  <meta property="og:title" content="${safeTitle}">
  <meta property="og:description" content="${safeDescription}">
  <meta property="og:site_name" content="Highlights">
  
  <!-- Video tags -->
  <meta property="og:video" content="${videoStreamUrl}">
  <meta property="og:video:url" content="${videoStreamUrl}">
  <meta property="og:video:secure_url" content="${videoStreamUrl}">
  <meta property="og:video:type" content="${videoMimeType}">
  <meta property="og:video:width" content="1280">
  <meta property="og:video:height" content="720">
  
  ${thumbnailUrl ? `<!-- Image tags -->
  <meta property="og:image" content="${thumbnailUrl}">
  <meta property="og:image:width" content="1280">
  <meta property="og:image:height" content="720">` : ''}
  
  <!-- Twitter Card tags (use name attribute) -->
  <meta name="twitter:card" content="player">
  <meta name="twitter:title" content="${safeTitle}">
  <meta name="twitter:description" content="${safeDescription}">
  ${thumbnailUrl ? `<meta name="twitter:image" content="${thumbnailUrl}">` : ''}
  <meta name="twitter:player" content="${videoStreamUrl}">
  <meta name="twitter:player:width" content="1280">
  <meta name="twitter:player:height" content="720">
  <meta name="twitter:player:stream" content="${videoStreamUrl}">
  <meta name="twitter:player:stream:content_type" content="${videoMimeType}">
  
  <!-- Auto-redirect to client app after meta tags are read by bots -->
  <meta http-equiv="refresh" content="0;url=/video-platform/watch/${safeId}">
  <script>
    // Immediate redirect for regular browsers
    window.location.href = '/video-platform/watch/${safeId}';
  </script>
</head>
<body>
  <h1>${safeTitle}</h1>
  <p>Перенаправление...</p>
</body>
</html>`;

      res.setHeader('Content-Type', 'text/html');
      res.send(html);
    } catch (error: any) {
      console.error("Error serving video page:", error);
      res.redirect('/video-platform');
    }
  };

  // Оба формата URL для видео
  app.get("/video-platform/watch/:id", serveVideoPage);
  app.get("/v/:id", serveVideoPage);

  // Получить данные одного видео
  app.get("/api/videos/:id", async (req, res) => {
    try {
      const video = await storage.getVideoById(req.params.id);
      if (!video) {
        return res.status(404).json({ error: "Видео не найдено" });
      }

      // Увеличить счетчик просмотров
      await storage.incrementVideoViews(req.params.id);

      // Получить лайки и комментарии
      const likeCount = await storage.getVideoLikeCount(req.params.id);
      const comments = await storage.getVideoComments(req.params.id);

      // Проверить лайкнул ли текущий пользователь
      let hasLiked = false;
      if (req.user) {
        const user = req.user as any;
        hasLiked = await storage.hasUserLiked(req.params.id, user.discordId);
      }

      res.json({
        ...video,
        likeCount,
        comments,
        hasLiked,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Раздача видео файлов с поддержкой streaming
  app.get("/api/videos/:id/stream", async (req, res) => {
    try {
      const video = await storage.getVideoById(req.params.id);
      if (!video) {
        return res.status(404).json({ error: "Видео не найдено" });
      }

      const videoPath = path.resolve(video.filePath);
      const stat = fs.statSync(videoPath);
      const fileSize = stat.size;
      const range = req.headers.range;

      // Определить MIME type по расширению файла
      const ext = path.extname(videoPath).toLowerCase();
      const mimeTypes: Record<string, string> = {
        '.mp4': 'video/mp4',
        '.webm': 'video/webm',
        '.mov': 'video/quicktime',
        '.avi': 'video/x-msvideo',
        '.mkv': 'video/x-matroska',
      };
      const contentType = mimeTypes[ext] || 'video/mp4';

      if (range) {
        // Streaming с поддержкой range requests
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunksize = (end - start) + 1;
        const file = fs.createReadStream(videoPath, { start, end });
        const head = {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunksize,
          'Content-Type': contentType,
        };
        res.writeHead(206, head);
        file.pipe(res);
      } else {
        // Обычная отдача файла
        const head = {
          'Content-Length': fileSize,
          'Content-Type': contentType,
        };
        res.writeHead(200, head);
        fs.createReadStream(videoPath).pipe(res);
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Раздача превью видео
  app.get("/api/videos/:id/thumbnail", async (req, res) => {
    try {
      const video = await storage.getVideoById(req.params.id);
      if (!video || !video.thumbnailPath) {
        // Возвращаем дефолтное изображение-заглушку
        return res.status(404).json({ error: "Превью не найдено" });
      }

      res.sendFile(video.thumbnailPath, { root: "." });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Лайк видео
  app.post("/api/videos/:id/like", requireDiscordAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const hasLiked = await storage.hasUserLiked(req.params.id, user.discordId);

      if (hasLiked) {
        // Убрать лайк
        await storage.unlikeVideo(req.params.id, user.discordId);
        res.json({ success: true, action: "unliked" });
      } else {
        // Поставить лайк
        await storage.likeVideo({
          videoId: req.params.id,
          discordId: user.discordId,
          username: user.username,
        });
        res.json({ success: true, action: "liked" });
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Получить лайкнутые видео пользователя
  app.get("/api/videos/liked/my", requireDiscordAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const likedVideos = await storage.getLikedVideosByUser(user.discordId);
      res.json(likedVideos);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Добавить комментарий
  app.post("/api/videos/:id/comments", requireDiscordAuth, async (req, res) => {
    try {
      const { content } = req.body;
      if (!content) {
        return res.status(400).json({ error: "Комментарий не может быть пустым" });
      }

      const user = req.user as any;
      const comment = await storage.createVideoComment({
        videoId: req.params.id,
        discordId: user.discordId,
        username: user.username,
        avatar: user.avatar || null,
        content,
      });

      res.status(201).json(comment);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Получить комментарии видео
  app.get("/api/videos/:id/comments", async (req, res) => {
    try {
      const comments = await storage.getVideoComments(req.params.id);
      res.json(comments);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Удалить видео (только автор или админ)
  app.delete("/api/videos/:id", requireDiscordAuth, async (req, res) => {
    try {
      const video = await storage.getVideo(req.params.id);
      if (!video) {
        return res.status(404).json({ error: "Видео не найдено" });
      }

      const user = req.user as any;
      const isAuthor = video.uploadedBy === user.discordId;
      const isSuperAdmin = user.discordId === "1254059406744621068"; // kairozun
      const videoPlatformAdmin = await storage.getVideoPlatformAdmin(user.discordId);
      const canDelete = isAuthor || isSuperAdmin || !!videoPlatformAdmin;

      if (!canDelete) {
        return res.status(403).json({ error: "Нет прав для удаления этого видео" });
      }

      // Удалить файл
      const fs = await import("fs");
      const path = await import("path");
      const filePath = path.join(process.cwd(), video.filePath);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      // Удалить из БД
      await storage.deleteVideo(req.params.id);
      console.log(`✅ Видео успешно удалено: ${req.params.id} (автор: ${video.uploadedBy}, удалил: ${user.discordId})`);
      res.json({ success: true });
    } catch (error: any) {
      console.error(`❌ Ошибка удаления видео: ${error.message}`);
      res.status(500).json({ error: error.message });
    }
  });

  // ===== КАНАЛЫ =====
  app.post("/api/channels", requireDiscordAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const existing = await storage.getChannelByOwnerId(user.discordId);
      if (existing) {
        return res.status(400).json({ error: "У вас уже есть канал" });
      }
      
      const handleExists = await storage.getChannelByHandle(req.body.handle);
      if (handleExists) {
        return res.status(400).json({ error: "Этот handle уже занят" });
      }

      const channel = await storage.createChannel({
        ...req.body,
        ownerId: user.discordId,
        ownerName: user.username,
        ownerAvatar: user.avatar,
      });
      res.status(201).json(channel);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/channels/@:handle", async (req, res) => {
    try {
      const channel = await storage.getChannelByHandle(req.params.handle);
      if (!channel) {
        return res.status(404).json({ error: "Канал не найден" });
      }
      const videos = await storage.getVideosByChannelId(channel.id);
      res.json({ ...channel, videos });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/channels/:id", async (req, res) => {
    try {
      const channel = await storage.getChannelById(req.params.id);
      if (!channel) {
        return res.status(404).json({ error: "Канал не найден" });
      }
      const videos = await storage.getVideosByChannelId(channel.id);
      res.json({ ...channel, videos });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/channels/:id", requireDiscordAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const channel = await storage.getChannelById(req.params.id);
      if (!channel || channel.ownerId !== user.discordId) {
        return res.status(403).json({ error: "Нет прав" });
      }
      const updated = await storage.updateChannel(req.params.id, req.body);
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/channels/:id/subscribe", requireDiscordAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const sub = await storage.subscribeToChannel({
        channelId: req.params.id,
        subscriberId: user.discordId,
        subscriberUsername: user.username,
        subscriberAvatar: user.avatar,
      });
      res.status(201).json(sub);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/channels/:id/subscribe", requireDiscordAuth, async (req, res) => {
    try {
      const user = req.user as any;
      await storage.unsubscribeFromChannel(req.params.id, user.discordId);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/channels/:id/subscribed", requireDiscordAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const subscribed = await storage.isSubscribed(req.params.id, user.discordId);
      res.json({ subscribed });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/my-channel", requireDiscordAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const channel = await storage.getChannelByOwnerId(user.discordId);
      res.json(channel || null);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Создать канал
  app.post("/api/channels", requireDiscordAuth, async (req, res) => {
    try {
      const user = req.user as any;
      
      // Проверить существует ли уже канал
      const existingChannel = await storage.getChannelByOwnerId(user.discordId);
      if (existingChannel) {
        return res.status(400).json({ error: "У вас уже есть канал" });
      }

      // Валидация данных
      const result = insertChannelSchema.safeParse({
        ...req.body,
        ownerId: user.discordId,
        ownerUsername: user.username,
        ownerAvatar: user.avatar || null,
      });

      if (!result.success) {
        return res.status(400).json({ error: result.error.errors[0].message });
      }

      const data = result.data;
      
      // Проверить уникальность handle
      const handleExists = await storage.getChannelByHandle(data.handle);
      if (handleExists) {
        return res.status(400).json({ error: "Этот handle уже занят" });
      }

      const channel = await storage.createChannel(data);

      res.status(201).json(channel);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Обновить канал
  app.patch("/api/channels/:id", requireDiscordAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const channel = await storage.getChannelById(req.params.id);
      
      if (!channel) {
        return res.status(404).json({ error: "Канал не найден" });
      }

      if (channel.ownerId !== user.discordId) {
        return res.status(403).json({ error: "У вас нет прав на редактирование этого канала" });
      }

      // Валидация данных (частичное обновление, поэтому используем partial)
      const updateSchema = insertChannelSchema.partial().pick({
        name: true,
        description: true,
        bannerUrl: true,
      });

      const result = updateSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: result.error.errors[0].message });
      }

      const updated = await storage.updateChannel(req.params.id, result.data);

      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Обновление фона видеоплатформы
  app.patch("/api/video-platform/background", requireDiscordAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const { background } = req.body;
      
      if (!["background1", "background2", "background3"].includes(background)) {
        return res.status(400).json({ error: "Недопустимый фон" });
      }
      
      const member = await storage.getClanMemberByDiscordId(user.discordId);
      if (!member) {
        return res.status(404).json({ error: "Пользователь не найден" });
      }
      
      await storage.updateClanMember(member.id, { videoPlatformBackground: background });
      res.json({ success: true, background });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== VIDEO PLATFORM ADMIN ROUTES ====================
  const SUPER_ADMIN_ID = "1254059406744621068"; // kairozun

  // Check if user is video platform admin
  app.get("/api/video-platform/check-admin", requireDiscordAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const isSuperAdmin = user.discordId === SUPER_ADMIN_ID;
      
      if (isSuperAdmin) {
        return res.json({ isAdmin: true, isSuperAdmin: true });
      }

      const admin = await storage.getVideoPlatformAdmin(user.discordId);
      res.json({ isAdmin: !!admin, isSuperAdmin: false });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get all video platform admins (super admin only)
  app.get("/api/video-platform/admins", requireDiscordAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const isSuperAdmin = user.discordId === SUPER_ADMIN_ID;
      const admin = await storage.getVideoPlatformAdmin(user.discordId);
      
      if (!isSuperAdmin && !admin) {
        return res.status(403).json({ error: "Access denied" });
      }

      const admins = await storage.getAllVideoPlatformAdmins();
      res.json(admins);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Add video platform admin (super admin only)
  app.post("/api/video-platform/admins", requireDiscordAuth, async (req, res) => {
    try {
      const user = req.user as any;
      if (user.discordId !== SUPER_ADMIN_ID) {
        return res.status(403).json({ error: "Only super admin can add admins" });
      }

      const { discordId } = req.body;
      if (!discordId) {
        return res.status(400).json({ error: "Discord ID required" });
      }

      // Get member info
      const member = await storage.getClanMemberByDiscordId(discordId);
      if (!member) {
        return res.status(404).json({ error: "Member not found" });
      }

      const newAdmin = await storage.addVideoPlatformAdmin({
        discordId,
        username: member.username,
        avatar: member.avatar || null,
        role: "admin",
        addedBy: user.discordId,
        addedByUsername: user.username,
      });

      res.json(newAdmin);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Remove video platform admin (super admin only)
  app.delete("/api/video-platform/admins/:id", requireDiscordAuth, async (req, res) => {
    try {
      const user = req.user as any;
      if (user.discordId !== SUPER_ADMIN_ID) {
        return res.status(403).json({ error: "Only super admin can remove admins" });
      }

      await storage.removeVideoPlatformAdmin(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Admin edit video
  app.patch("/api/videos/:id", requireDiscordAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const isSuperAdmin = user.discordId === SUPER_ADMIN_ID;
      const admin = await storage.getVideoPlatformAdmin(user.discordId);
      
      // Check if user owns video or is admin
      const video = await storage.getVideo(req.params.id);
      if (!video) {
        return res.status(404).json({ error: "Video not found" });
      }

      const isOwner = video.uploadedBy === user.discordId;
      if (!isOwner && !isSuperAdmin && !admin) {
        return res.status(403).json({ error: "Access denied" });
      }

      const { title, description } = req.body;
      const updated = await storage.updateVideo(req.params.id, { title, description });
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================================
  // PROFILE API
  // ============================================================
  app.get("/api/profile/:identifier", async (req, res) => {
    try {
      const { db } = await import("./db");
      const { clanMembers } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");
      const id = req.params.identifier;
      // Try Discord ID first (all digits), then username
      const isDiscordId = /^\d+$/.test(id);
      let member;
      if (isDiscordId) {
        member = await db.select().from(clanMembers).where(eq(clanMembers.discordId, id)).limit(1);
      }
      if (!member || !member[0]) {
        member = await db.select().from(clanMembers).where(eq(clanMembers.username, id)).limit(1);
      }
      if (!member[0]) return res.status(404).json({ error: "Member not found" });
      res.json(member[0]);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================================
  // QUESTS API
  // ============================================================
  app.get("/api/quests", async (req, res) => {
    try {
      const { db } = await import("./db");
      const { quests } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");
      const allQuests = await db.select().from(quests).where(eq(quests.isActive, true));
      res.json(allQuests);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/quests/user/:discordId", async (req, res) => {
    try {
      const { db } = await import("./db");
      const { userQuests, quests, clanMembers } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");
      const member = await db.select().from(clanMembers).where(eq(clanMembers.discordId, req.params.discordId)).limit(1);
      if (!member[0]) return res.status(404).json({ error: "Member not found" });
      const uq = await db.select({
        id: userQuests.id,
        questId: userQuests.questId,
        progress: userQuests.progress,
        isCompleted: userQuests.isCompleted,
        completedAt: userQuests.completedAt,
        claimedAt: userQuests.claimedAt,
        startedAt: userQuests.startedAt,
        quest: quests,
      }).from(userQuests)
        .innerJoin(quests, eq(userQuests.questId, quests.id))
        .where(eq(userQuests.memberId, member[0].id));
      res.json(uq);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/quests/accept", async (req, res) => {
    try {
      const { db } = await import("./db");
      const { userQuests, clanMembers } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");
      const { discordId, questId } = req.body;
      if (!discordId || !questId) return res.status(400).json({ error: "discordId and questId required" });
      const member = await db.select().from(clanMembers).where(eq(clanMembers.discordId, discordId)).limit(1);
      if (!member[0]) return res.status(404).json({ error: "Member not found" });
      const [uq] = await db.insert(userQuests).values({
        memberId: member[0].id,
        questId,
        progress: {},
        isCompleted: false,
      }).returning();
      res.json(uq);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/quests/claim", async (req, res) => {
    try {
      const { db } = await import("./db");
      const { userQuests, quests, clanMembers } = await import("@shared/schema");
      const { eq, and } = await import("drizzle-orm");
      const { discordId, userQuestId } = req.body;
      if (!discordId || !userQuestId) return res.status(400).json({ error: "discordId and userQuestId required" });
      const member = await db.select().from(clanMembers).where(eq(clanMembers.discordId, discordId)).limit(1);
      if (!member[0]) return res.status(404).json({ error: "Member not found" });
      const [uq] = await db.select().from(userQuests).where(and(eq(userQuests.id, userQuestId), eq(userQuests.memberId, member[0].id))).limit(1) as any[];
      if (!uq) return res.status(404).json({ error: "Quest not found" });
      if (!uq.isCompleted) return res.status(400).json({ error: "Quest not completed yet" });
      if (uq.claimedAt) return res.status(400).json({ error: "Already claimed" });
      const [quest] = await db.select().from(quests).where(eq(quests.id, uq.questId)).limit(1);
      const rewards = quest?.rewards as any || { coins: 0 };
      if (rewards.coins) {
        await db.update(clanMembers).set({ lumiCoins: (member[0].lumiCoins || 0) + rewards.coins }).where(eq(clanMembers.id, member[0].id));
      }
      const [updated] = await db.update(userQuests).set({ claimedAt: new Date() }).where(eq(userQuests.id, userQuestId)).returning();
      res.json({ ...updated, reward: rewards });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================================
  // TRADES API
  // ============================================================
  app.get("/api/trades/:discordId", async (req, res) => {
    try {
      const { db } = await import("./db");
      const { trades, clanMembers } = await import("@shared/schema");
      const { eq, or } = await import("drizzle-orm");
      const member = await db.select().from(clanMembers).where(eq(clanMembers.discordId, req.params.discordId)).limit(1);
      if (!member[0]) return res.status(404).json({ error: "Member not found" });
      const allTrades = await db.select().from(trades).where(
        or(eq(trades.fromMemberId, member[0].id), eq(trades.toMemberId, member[0].id))
      );
      // Fetch usernames for all trades
      const memberIds = new Set<string>();
      allTrades.forEach(t => { memberIds.add(t.fromMemberId); memberIds.add(t.toMemberId); });
      const membersMap: Record<string, string> = {};
      for (const mid of memberIds) {
        const m = await db.select().from(clanMembers).where(eq(clanMembers.id, mid)).limit(1);
        if (m[0]) membersMap[mid] = m[0].username;
      }
      const enriched = allTrades.map(t => ({
        ...t,
        fromUsername: membersMap[t.fromMemberId] || 'Участник',
        toUsername: membersMap[t.toMemberId] || 'Участник',
      }));
      const incoming = enriched.filter(t => t.toMemberId === member[0].id);
      const outgoing = enriched.filter(t => t.fromMemberId === member[0].id);
      res.json({ incoming, outgoing });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/trades", async (req, res) => {
    try {
      const { db } = await import("./db");
      const { trades, clanMembers } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");
      const { discordId, targetUser, fromDiscordId, toDiscordId, offerItems, offerCoins, requestItems, requestCoins, message } = req.body;
      // Support both formats: {discordId + targetUser} or {fromDiscordId + toDiscordId}
      const senderDiscordId = discordId || fromDiscordId;
      const receiverInput = targetUser || toDiscordId;
      if (!senderDiscordId || !receiverInput) return res.status(400).json({ error: "Укажите Discord ID или username получателя" });
      const fromMember = await db.select().from(clanMembers).where(eq(clanMembers.discordId, senderDiscordId)).limit(1);
      if (!fromMember[0]) return res.status(404).json({ error: "Отправитель не найден" });
      // Try to find receiver by Discord ID or username
      const isDiscordId = /^\d+$/.test(receiverInput);
      let toMember;
      if (isDiscordId) {
        toMember = await db.select().from(clanMembers).where(eq(clanMembers.discordId, receiverInput)).limit(1);
      } else {
        toMember = await db.select().from(clanMembers).where(eq(clanMembers.username, receiverInput)).limit(1);
      }
      if (!toMember[0]) return res.status(404).json({ error: `Участник "${receiverInput}" не найден` });
      if (fromMember[0].id === toMember[0].id) return res.status(400).json({ error: "Нельзя торговать с самим собой" });
      // Check balance
      const sendCoins = offerCoins || 0;
      if (sendCoins > 0 && (fromMember[0].lumiCoins || 0) < sendCoins) {
        return res.status(400).json({ error: "Недостаточно LumiCoins" });
      }
      const [trade] = await db.insert(trades).values({
        fromMemberId: fromMember[0].id,
        toMemberId: toMember[0].id,
        offerItems: offerItems || [],
        offerCoins: sendCoins,
        requestItems: requestItems || [],
        requestCoins: requestCoins || 0,
        message: message || null,
        status: "pending",
      }).returning();
      res.json({ ...trade, fromUsername: fromMember[0].username, toUsername: toMember[0].username });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/trades/:id/respond", async (req, res) => {
    try {
      const { db } = await import("./db");
      const { trades, clanMembers } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");
      const { action, discordId } = req.body; // action: "accept" | "reject"
      if (!action || !discordId) return res.status(400).json({ error: "action and discordId required" });
      const [trade] = await db.select().from(trades).where(eq(trades.id, req.params.id)).limit(1);
      if (!trade) return res.status(404).json({ error: "Trade not found" });
      if (trade.status !== "pending") return res.status(400).json({ error: "Trade already resolved" });
      const newStatus = action === "accept" ? "accepted" : "rejected";
      if (action === "accept") {
        // Transfer coins
        const fromMember = await db.select().from(clanMembers).where(eq(clanMembers.id, trade.fromMemberId)).limit(1);
        const toMember = await db.select().from(clanMembers).where(eq(clanMembers.id, trade.toMemberId)).limit(1);
        if (fromMember[0] && toMember[0]) {
          await db.update(clanMembers).set({ lumiCoins: (fromMember[0].lumiCoins || 0) - trade.offerCoins + trade.requestCoins }).where(eq(clanMembers.id, fromMember[0].id));
          await db.update(clanMembers).set({ lumiCoins: (toMember[0].lumiCoins || 0) + trade.offerCoins - trade.requestCoins }).where(eq(clanMembers.id, toMember[0].id));
        }
      }
      const [updated] = await db.update(trades).set({ status: newStatus, updatedAt: new Date() }).where(eq(trades.id, req.params.id)).returning();
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/trades/:id/cancel", async (req, res) => {
    try {
      const { db } = await import("./db");
      const { trades } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");
      const [trade] = await db.select().from(trades).where(eq(trades.id, req.params.id)).limit(1);
      if (!trade) return res.status(404).json({ error: "Trade not found" });
      if (trade.status !== "pending") return res.status(400).json({ error: "Trade already resolved" });
      const [updated] = await db.update(trades).set({ status: "cancelled", updatedAt: new Date() }).where(eq(trades.id, req.params.id)).returning();
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================================
  // BOOSTS API
  // ============================================================
  app.get("/api/boosts/:discordId", async (req, res) => {
    try {
      const { db } = await import("./db");
      const { activeBoosts, items, clanMembers } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");
      const member = await db.select().from(clanMembers).where(eq(clanMembers.discordId, req.params.discordId)).limit(1);
      if (!member[0]) return res.status(404).json({ error: "Member not found" });
      const boosts = await db.select({
        id: activeBoosts.id,
        boostType: activeBoosts.boostType,
        multiplier: activeBoosts.multiplier,
        activatedAt: activeBoosts.activatedAt,
        expiresAt: activeBoosts.expiresAt,
        item: items,
      }).from(activeBoosts)
        .innerJoin(items, eq(activeBoosts.itemId, items.id))
        .where(eq(activeBoosts.memberId, member[0].id));
      res.json(boosts);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================================
  // DAILY REWARDS API
  // ============================================================
  app.get("/api/daily-reward/:discordId", async (req, res) => {
    try {
      const { db } = await import("./db");
      const { dailyRewards, clanMembers } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");
      const member = await db.select().from(clanMembers).where(eq(clanMembers.discordId, req.params.discordId)).limit(1);
      if (!member[0]) return res.status(404).json({ error: "Member not found" });
      const [reward] = await db.select().from(dailyRewards).where(eq(dailyRewards.memberId, member[0].id)).limit(1);
      const now = new Date();
      const lastClaim = reward?.lastClaimDate ? new Date(reward.lastClaimDate) : null;
      const canClaim = !lastClaim || (now.getTime() - lastClaim.getTime() > 24 * 60 * 60 * 1000);
      const isStreakBroken = lastClaim && (now.getTime() - lastClaim.getTime() > 48 * 60 * 60 * 1000);
      res.json({
        streakDays: isStreakBroken ? 0 : (reward?.streakDays || 0),
        totalClaims: reward?.totalClaims || 0,
        lastClaimDate: reward?.lastClaimDate || null,
        canClaim,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/daily-reward/claim", async (req, res) => {
    try {
      const { db } = await import("./db");
      const { dailyRewards, clanMembers } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");
      const { discordId } = req.body;
      if (!discordId) return res.status(400).json({ error: "discordId required" });
      const member = await db.select().from(clanMembers).where(eq(clanMembers.discordId, discordId)).limit(1);
      if (!member[0]) return res.status(404).json({ error: "Member not found" });
      const [existing] = await db.select().from(dailyRewards).where(eq(dailyRewards.memberId, member[0].id)).limit(1);
      const now = new Date();
      const lastClaim = existing?.lastClaimDate ? new Date(existing.lastClaimDate) : null;
      if (lastClaim && (now.getTime() - lastClaim.getTime() < 24 * 60 * 60 * 1000)) {
        return res.status(400).json({ error: "Already claimed today" });
      }
      const isStreakBroken = lastClaim && (now.getTime() - lastClaim.getTime() > 48 * 60 * 60 * 1000);
      const newStreak = isStreakBroken ? 1 : ((existing?.streakDays || 0) + 1);
      const dayInCycle = ((newStreak - 1) % 7) + 1;
      const baseReward = [10, 15, 20, 30, 40, 60, 100];
      const coinReward = baseReward[dayInCycle - 1] || 10;
      if (existing) {
        await db.update(dailyRewards).set({
          lastClaimDate: now,
          streakDays: newStreak,
          totalClaims: (existing.totalClaims || 0) + 1,
        }).where(eq(dailyRewards.id, existing.id));
      } else {
        await db.insert(dailyRewards).values({
          memberId: member[0].id,
          lastClaimDate: now,
          streakDays: 1,
          totalClaims: 1,
        });
      }
      await db.update(clanMembers).set({ lumiCoins: (member[0].lumiCoins || 0) + coinReward }).where(eq(clanMembers.id, member[0].id));
      res.json({ reward: coinReward, streakDays: newStreak, totalClaims: (existing?.totalClaims || 0) + 1 });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================================
  // INVENTORY API
  // ============================================================
  app.get("/api/inventory/:discordId", async (req, res) => {
    try {
      const { db } = await import("./db");
      const { userInventory, items, clanMembers } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");
      const member = await db.select().from(clanMembers).where(eq(clanMembers.discordId, req.params.discordId)).limit(1);
      if (!member[0]) return res.status(404).json({ error: "Member not found" });
      const inv = await db.select({
        id: userInventory.id,
        quantity: userInventory.quantity,
        isEquipped: userInventory.isEquipped,
        name: items.name,
        category: items.category,
        rarity: items.rarity,
      }).from(userInventory)
        .innerJoin(items, eq(userInventory.itemId, items.id))
        .where(eq(userInventory.memberId, member[0].id));
      res.json(inv);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================================
  // MINI-GAMES API
  // ============================================================
  app.post("/api/mini-games/wheel", async (req, res) => {
    try {
      const { db } = await import("./db");
      const { clanMembers, gameHistory } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");
      const { discordId, bet } = req.body;
      if (!discordId || !bet || bet < 1) return res.status(400).json({ error: "discordId and bet required" });
      const betAmount = Math.floor(Math.max(1, Number(bet) || 0));
      const member = await db.select().from(clanMembers).where(eq(clanMembers.discordId, discordId)).limit(1);
      if (!member[0]) return res.status(404).json({ error: "Member not found" });
      if ((member[0].lumiCoins || 0) < betAmount) return res.status(400).json({ error: "Not enough LumiCoins" });
      // Multiplier-based wheel: must match client WHEEL_SEGMENTS order
      const multipliers = [0, 0.5, 0, 1, 0.5, 0, 1.5, 0.5, 0, 1, 2, 3];
      const segmentIndex = Math.floor(Math.random() * multipliers.length);
      const multiplier = multipliers[segmentIndex];
      const payout = Math.floor(betAmount * multiplier);
      const reward = payout - betAmount; // net change (negative = loss, positive = profit)
      const newBalance = Math.max(0, (member[0].lumiCoins || 0) + reward);
      await db.update(clanMembers).set({ lumiCoins: newBalance }).where(eq(clanMembers.id, member[0].id));
      try { await db.insert(gameHistory).values({ discordId, game: "wheel", bet: betAmount, reward, result: `x${multiplier}` }); } catch {}
      if (app.locals.broadcastSSE) app.locals.broadcastSSE('balance-update', { discordId, newBalance, username: member[0].username });
      res.json({ segmentIndex, reward, multiplier, newBalance });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/mini-games/rps", async (req, res) => {
    try {
      const { db } = await import("./db");
      const { clanMembers, gameHistory } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");
      const { discordId, choice, bet } = req.body;
      if (!discordId || !choice || !bet || bet < 1) return res.status(400).json({ error: "discordId, choice, and bet required" });
      const betAmount = Math.floor(Math.max(1, Number(bet) || 0));
      const member = await db.select().from(clanMembers).where(eq(clanMembers.discordId, discordId)).limit(1);
      if (!member[0]) return res.status(404).json({ error: "Member not found" });
      if ((member[0].lumiCoins || 0) < betAmount) return res.status(400).json({ error: "Not enough LumiCoins" });
      const choices = ["rock", "paper", "scissors"] as const;
      const botChoice = choices[Math.floor(Math.random() * 3)];
      let result: "win" | "lose" | "draw" = "draw";
      if (choice !== botChoice) {
        if ((choice === "rock" && botChoice === "scissors") ||
            (choice === "paper" && botChoice === "rock") ||
            (choice === "scissors" && botChoice === "paper")) {
          result = "win";
        } else {
          result = "lose";
        }
      }
      let reward = 0;
      if (result === "win") reward = betAmount;
      else if (result === "lose") reward = -betAmount;
      const updateData: Record<string, number> = { lumiCoins: Math.max(0, (member[0].lumiCoins || 0) + reward) };
      if (result === "win") updateData.wins = (member[0].wins || 0) + 1;
      if (result === "lose") updateData.losses = (member[0].losses || 0) + 1;
      await db.update(clanMembers).set(updateData).where(eq(clanMembers.id, member[0].id));
      try { await db.insert(gameHistory).values({ discordId, game: "rps", bet: betAmount, reward, result }); } catch {}
      if (app.locals.broadcastSSE) app.locals.broadcastSSE('balance-update', { discordId, newBalance: updateData.lumiCoins, username: member[0].username });
      res.json({ botChoice, result, reward, newBalance: updateData.lumiCoins });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Coin Flip
  app.post("/api/mini-games/coinflip", async (req, res) => {
    try {
      const { db } = await import("./db");
      const { clanMembers, gameHistory } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");
      const { discordId, bet, guess } = req.body;
      if (!discordId || !bet || bet < 1 || !guess) return res.status(400).json({ error: "Missing params" });
      const betAmount = Math.floor(Math.max(1, Number(bet) || 0));
      const member = await db.select().from(clanMembers).where(eq(clanMembers.discordId, discordId)).limit(1);
      if (!member[0]) return res.status(404).json({ error: "Member not found" });
      if ((member[0].lumiCoins || 0) < betAmount) return res.status(400).json({ error: "Not enough LumiCoins" });
      const coin = Math.random() < 0.5 ? "heads" : "tails";
      const won = coin === guess;
      const reward = won ? betAmount : -betAmount;
      const newBalance = Math.max(0, (member[0].lumiCoins || 0) + reward);
      await db.update(clanMembers).set({ lumiCoins: newBalance }).where(eq(clanMembers.id, member[0].id));
      try { await db.insert(gameHistory).values({ discordId, game: "coinflip", bet: betAmount, reward, result: `${coin} (${won ? 'win' : 'lose'})` }); } catch {}
      if (app.locals.broadcastSSE) app.locals.broadcastSSE('balance-update', { discordId, newBalance, username: member[0].username });
      res.json({ coin, won, reward, newBalance });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Dice
  app.post("/api/mini-games/dice", async (req, res) => {
    try {
      const { db } = await import("./db");
      const { clanMembers, gameHistory } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");
      const { discordId, bet, guess } = req.body;
      if (!discordId || !bet || bet < 1 || !guess) return res.status(400).json({ error: "Missing params" });
      const betAmount = Math.floor(Math.max(1, Number(bet) || 0));
      const member = await db.select().from(clanMembers).where(eq(clanMembers.discordId, discordId)).limit(1);
      if (!member[0]) return res.status(404).json({ error: "Member not found" });
      if ((member[0].lumiCoins || 0) < betAmount) return res.status(400).json({ error: "Not enough LumiCoins" });
      const roll = Math.floor(Math.random() * 6) + 1;
      let won = false;
      let multiplier = 0;
      if (guess === "exact") {
        // Not used for now
        won = false;
      } else if (guess === "high") {
        won = roll >= 4;
        multiplier = won ? 1.8 : 0;
      } else if (guess === "low") {
        won = roll <= 3;
        multiplier = won ? 1.8 : 0;
      } else if (guess === "even") {
        won = roll % 2 === 0;
        multiplier = won ? 1.8 : 0;
      } else if (guess === "odd") {
        won = roll % 2 === 1;
        multiplier = won ? 1.8 : 0;
      }
      const payout = won ? Math.floor(betAmount * multiplier) : 0;
      const reward = payout - betAmount;
      const newBalance = Math.max(0, (member[0].lumiCoins || 0) + reward);
      await db.update(clanMembers).set({ lumiCoins: newBalance }).where(eq(clanMembers.id, member[0].id));
      try { await db.insert(gameHistory).values({ discordId, game: "dice", bet: betAmount, reward, result: `${roll} (${guess})` }); } catch {}
      if (app.locals.broadcastSSE) app.locals.broadcastSSE('balance-update', { discordId, newBalance, username: member[0].username });
      res.json({ roll, won, reward, multiplier: won ? multiplier : 0, newBalance });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============= SLOTS (Casino slot machine) =============
  app.post("/api/mini-games/slots", async (req, res) => {
    try {
      const { db } = await import("./db");
      const { clanMembers, gameHistory } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");
      const { discordId, bet } = req.body;
      if (!discordId || !bet || bet < 1) return res.status(400).json({ error: "Missing params" });
      const betAmount = Math.floor(Math.max(1, Number(bet) || 0));
      const member = await db.select().from(clanMembers).where(eq(clanMembers.discordId, discordId)).limit(1);
      if (!member[0]) return res.status(404).json({ error: "Member not found" });
      if ((member[0].lumiCoins || 0) < betAmount) return res.status(400).json({ error: "Not enough LumiCoins" });

      // 3 reels, 9 symbols each (weighted)
      const SYMBOLS = ["🍒", "🍋", "🍊", "🍇", "🔔", "⭐", "💎", "7️⃣", "🎰"];
      // Weighted: common fruits high, 7/diamond low
      const WEIGHTS = [20, 18, 16, 14, 10, 8, 5, 3, 2];
      const totalWeight = WEIGHTS.reduce((a, b) => a + b, 0);

      function spinReel(): number {
        let r = Math.random() * totalWeight;
        for (let i = 0; i < WEIGHTS.length; i++) {
          r -= WEIGHTS[i];
          if (r <= 0) return i;
        }
        return 0;
      }

      const reels = [
        [spinReel(), spinReel(), spinReel()], // row 1
        [spinReel(), spinReel(), spinReel()], // row 2 (middle - payline)
        [spinReel(), spinReel(), spinReel()], // row 3
      ];

      // Check middle row (main payline)
      const middle = reels[1];
      let multiplier = 0;
      let resultDesc = "";

      if (middle[0] === middle[1] && middle[1] === middle[2]) {
        // 3 of a kind on the middle payline
        const sym = SYMBOLS[middle[0]];
        if (sym === "🎰") { multiplier = 50; resultDesc = "JACKPOT 🎰🎰🎰"; }
        else if (sym === "7️⃣") { multiplier = 25; resultDesc = "MEGA WIN 7️⃣7️⃣7️⃣"; }
        else if (sym === "💎") { multiplier = 15; resultDesc = "BIG WIN 💎💎💎"; }
        else if (sym === "⭐") { multiplier = 10; resultDesc = "WIN ⭐⭐⭐"; }
        else if (sym === "🔔") { multiplier = 7; resultDesc = "WIN 🔔🔔🔔"; }
        else if (sym === "🍇") { multiplier = 5; resultDesc = "WIN 🍇🍇🍇"; }
        else if (sym === "🍊") { multiplier = 4; resultDesc = "WIN 🍊🍊🍊"; }
        else if (sym === "🍋") { multiplier = 3; resultDesc = "WIN 🍋🍋🍋"; }
        else { multiplier = 2; resultDesc = "WIN 🍒🍒🍒"; }
      } else if (middle[0] === middle[1] || middle[1] === middle[2] || middle[0] === middle[2]) {
        // 2 of a kind
        multiplier = 0.5;
        resultDesc = "Small win";
      } else {
        multiplier = 0;
        resultDesc = "No match";
      }

      // Also check diagonals for bonus
      const diag1 = [reels[0][0], reels[1][1], reels[2][2]];
      const diag2 = [reels[0][2], reels[1][1], reels[2][0]];
      if (diag1[0] === diag1[1] && diag1[1] === diag1[2] && multiplier < 2) {
        multiplier += 1.5;
        resultDesc += " + Diagonal!";
      }
      if (diag2[0] === diag2[1] && diag2[1] === diag2[2] && multiplier < 2) {
        multiplier += 1.5;
        resultDesc += " + Diagonal!";
      }

      const payout = Math.floor(betAmount * multiplier);
      const reward = payout - betAmount;
      const newBalance = Math.max(0, (member[0].lumiCoins || 0) + reward);
      await db.update(clanMembers).set({ lumiCoins: newBalance }).where(eq(clanMembers.id, member[0].id));
      try { await db.insert(gameHistory).values({ discordId, game: "slots", bet: betAmount, reward, result: resultDesc }); } catch {}
      if (app.locals.broadcastSSE) app.locals.broadcastSSE('balance-update', { discordId, newBalance, username: member[0].username });

      // Return symbols as indices for client to look up
      const grid = reels.map(row => row.map(idx => SYMBOLS[idx]));
      res.json({ grid, multiplier, reward, resultDesc, newBalance });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/mini-games/history/:discordId", async (req, res) => {
    try {
      const { db } = await import("./db");
      const { gameHistory } = await import("@shared/schema");
      const { eq, desc } = await import("drizzle-orm");
      const { discordId } = req.params;
      const history = await db.select().from(gameHistory)
        .where(eq(gameHistory.discordId, discordId))
        .orderBy(desc(gameHistory.playedAt))
        .limit(50);
      res.json(history);
    } catch {
      res.json([]);
    }
  });

  // ============================================================
  // TOURNAMENTS & CLAN WARS API
  // ============================================================
  app.get("/api/tournaments", async (_req, res) => {
    // Tournaments table doesn't exist yet, return mock data
    res.json([]);
  });

  app.get("/api/clan-wars", async (_req, res) => {
    res.json([]);
  });

  app.get("/api/tournaments/leaderboard", async (req, res) => {
    try {
      const { db } = await import("./db");
      const { clanMembers } = await import("@shared/schema");
      const { desc } = await import("drizzle-orm");
      const members = await db.select({
        discordId: clanMembers.discordId,
        username: clanMembers.username,
        avatar: clanMembers.avatar,
        wins: clanMembers.wins,
        losses: clanMembers.losses,
      }).from(clanMembers).orderBy(desc(clanMembers.wins)).limit(20);
      const leaderboard = members.map((m, i) => ({
        rank: i + 1,
        username: m.username,
        discordId: m.discordId,
        avatar: m.avatar,
        wins: m.wins || 0,
        losses: m.losses || 0,
        score: ((m.wins || 0) * 3 - (m.losses || 0)),
      }));
      res.json(leaderboard);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/tournaments/:id/join", async (req, res) => {
    res.json({ success: true, message: "Joined tournament" });
  });

  app.post("/api/tournaments", async (req, res) => {
    res.json({ success: true, message: "Tournament creation coming soon" });
  });

  // ============================================================
  // PROFILE CUSTOMIZATION API (Database-backed, persistent)
  // ============================================================
  app.get("/api/profile-custom/:discordId", async (req, res) => {
    try {
      const { db } = await import("./db");
      const { eq } = await import("drizzle-orm");
      const rows = await db.select().from(profileCustoms).where(eq(profileCustoms.discordId, req.params.discordId)).limit(1);
      if (rows.length === 0) return res.json({});
      const r = rows[0];
      res.json({
        bannerColor1: r.bannerColor1 || '',
        bannerColor2: r.bannerColor2 || '',
        cardColor: r.cardColor || '',
        bio: r.bio || '',
        customAvatar: r.customAvatar || '',
        bannerImage: r.bannerImage || '',
        hiddenSections: r.hiddenSections || [],
        robloxUsername: r.robloxUsername || '',
      });
    } catch (e: any) {
      console.error('profile-custom GET error:', e.message);
      res.json({});
    }
  });

  app.post("/api/profile-custom/:discordId", async (req, res) => {
    const user = (req as any).user;
    if (!user || (user.discordId !== req.params.discordId && user.type !== 'admin')) {
      return res.status(403).json({ error: "Forbidden" });
    }
    try {
      const { db } = await import("./db");
      const { eq } = await import("drizzle-orm");
      const { bannerColor1, bannerColor2, cardColor, bio, customAvatar, hiddenSections, bannerImage, robloxUsername } = req.body;
      const data = {
        bannerColor1: bannerColor1 || '',
        bannerColor2: bannerColor2 || '',
        cardColor: cardColor || '',
        bio: (bio || '').substring(0, 200),
        customAvatar: customAvatar || '',
        bannerImage: (bannerImage || '').substring(0, 500),
        hiddenSections: hiddenSections || [],
        robloxUsername: (robloxUsername || '').substring(0, 30),
        updatedAt: new Date(),
      };
      const existing = await db.select().from(profileCustoms).where(eq(profileCustoms.discordId, req.params.discordId)).limit(1);
      if (existing.length > 0) {
        await db.update(profileCustoms).set(data).where(eq(profileCustoms.discordId, req.params.discordId));
      } else {
        await db.insert(profileCustoms).values({ discordId: req.params.discordId, ...data });
      }
      res.json({ success: true });
    } catch (e: any) {
      console.error('profile-custom POST error:', e.message, e.stack);
      res.status(500).json({ error: 'Failed to save', detail: e.message });
    }
  });

  // Banner image upload endpoint
  const bannerUpload = (await import('multer')).default({
    storage: (await import('multer')).default.diskStorage({
      destination: (_req: any, _file: any, cb: any) => {
        const dir = path.join(process.cwd(), 'uploads', 'banners');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
      },
      filename: (_req: any, file: any, cb: any) => {
        const ext = path.extname(file.originalname) || '.jpg';
        cb(null, `banner_${Date.now()}_${Math.random().toString(36).substring(2, 8)}${ext}`);
      },
    }),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
    fileFilter: (_req: any, file: any, cb: any) => {
      if (file.mimetype.startsWith('image/')) cb(null, true);
      else cb(new Error('Only images allowed'), false);
    },
  });

  app.post("/api/profile-banner-upload/:discordId", requireDiscordAuth, bannerUpload.single('banner'), (req: any, res) => {
    try {
      const user = (req as any).user;
      if (!user || (user.discordId !== req.params.discordId && user.type !== 'admin')) {
        return res.status(403).json({ error: "Forbidden" });
      }
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }
      const url = `/uploads/banners/${req.file.filename}`;
      res.json({ success: true, url });
    } catch (err: any) {
      console.error('Banner upload error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // ============================================================
  // AD SPOTS API (Roblox avatar ads on dashboard)
  // ============================================================
  app.get("/api/ad-spots", async (_req, res) => {
    try {
      const { db } = await import("./db");
      const { sql } = await import("drizzle-orm");
      const spots = await db.select().from(adSpots)
        .where(sql`${adSpots.expiresAt} > NOW()`)
        .orderBy(adSpots.createdAt);
      res.json(spots);
    } catch (e: any) {
      console.error('ad-spots GET error:', e.message);
      res.json([]);
    }
  });

  app.post("/api/ad-spots/buy", requireDiscordAuth, async (req: any, res) => {
    try {
      const user = req.user;
      if (!user?.discordId) return res.status(401).json({ error: "Not authorized" });

      // Auto-read robloxUsername from request body OR profile_customs
      let robloxUsername = req.body?.robloxUsername;
      if (!robloxUsername) {
        try {
          const { db: _db } = await import("./db");
          const { eq: _eq } = await import("drizzle-orm");
          const [pc] = await _db.select().from(profileCustoms).where(_eq(profileCustoms.discordId, user.discordId)).limit(1);
          robloxUsername = pc?.robloxUsername;
        } catch {}
      }
      if (!robloxUsername || typeof robloxUsername !== 'string' || robloxUsername.trim().length === 0) {
        return res.status(400).json({ error: "Укажите Roblox никнейм в настройках профиля" });
      }

      const cost = 500000;
      const member = await storage.getMemberByDiscordId(user.discordId);
      if (!member || (member.lumiCoins || 0) < cost) {
        return res.status(400).json({ error: "Not enough LumiCoins (need 500,000)" });
      }

      // Get Roblox avatar
      let avatarUrl = "";
      try {
        const { getUserFullBodyAvatar } = await import("./roblox-api");
        avatarUrl = await getUserFullBodyAvatar(robloxUsername) || "";
      } catch { /* fallback: empty */ }

      // Deduct balance
      const newBalance = (member.lumiCoins || 0) - cost;
      await storage.updateMember(member.id, { lumiCoins: newBalance });

      // Create ad spot (7 days)
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await db.insert(adSpots).values({
        discordId: user.discordId,
        robloxUsername: robloxUsername.substring(0, 30),
        robloxAvatarUrl: avatarUrl,
        paidAmount: cost,
        expiresAt,
      });

      // SSE broadcast balance update
      if (app.locals.broadcastSSE) {
        app.locals.broadcastSSE('balance-update', { discordId: user.discordId, newBalance });
      }

      res.json({ success: true, newBalance, expiresAt: expiresAt.toISOString() });
    } catch (e: any) {
      console.error('ad-spots buy error:', e.message);
      res.status(500).json({ error: "Failed to purchase ad spot" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
