import express, { type Express } from "express";
import fs from "fs";
import path from "path";

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

/** Detect Discord/social media bot user agents */
const BOT_UA = /Discordbot|facebookexternalhit|Twitterbot|TelegramBot|WhatsApp|Slackbot|LinkedInBot|Googlebot|bingbot|Embedly|Quora Link Preview|vkShare|W3C_Validator/i;

export function serveStatic(app: Express) {
  const distPath = path.resolve(import.meta.dirname, "public");

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  // Hashed assets (JS/CSS) — long cache (Vite adds content hash to filenames)
  app.use("/assets", express.static(path.join(distPath, "assets"), {
    maxAge: "1y",
    immutable: true,
  }));

  // All other static files — short cache
  app.use(express.static(distPath, {
    maxAge: "1h",
    setHeaders(res, filePath) {
      // index.html must never be cached so new routes work immediately
      if (filePath.endsWith("index.html") || filePath.endsWith(".html")) {
        res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      }
    },
  }));

  // OG meta intercept for social media bots on /profile/* routes
  app.get("/profile/:identifier", async (req, res, next) => {
    const ua = req.headers["user-agent"] || "";
    if (!BOT_UA.test(ua)) return next();

    try {
      const id = req.params.identifier;
      const { db } = await import("./db");
      const { clanMembers } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");

      const isDiscordId = /^\d+$/.test(id);
      let member;
      if (isDiscordId) {
        member = await db.select().from(clanMembers).where(eq(clanMembers.discordId, id)).limit(1);
      }
      if (!member || !member[0]) {
        member = await db.select().from(clanMembers).where(eq(clanMembers.username, id)).limit(1);
      }
      if (!member?.[0]) return next(); // Fallback to SPA

      const m = member[0];
      const siteUrl = `${req.protocol}://${req.get("host")}`;
      const profileUrl = `${siteUrl}/profile/${m.discordId}`;
      const avatar = m.avatar || "https://i.postimg.cc/1tPnXtX8/IMG-9561.jpg";
      // Always point to the DB-backed screenshot route (falls back to SVG if none stored)
      // Use seconds-based cache buster so Discord always fetches fresh image
      const ogImage = `${siteUrl}/api/og-screenshot/${m.discordId}?t=${Date.now()}`;
      const title = `${m.username} — LUMINARY`;
      const desc = `🏆 Ранг: ${m.rank || '—'} • 💰 ${m.lumiCoins ?? 0} LC • ${m.role || 'Участник'} • Уровень ${m.level ?? 1}`;

      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache");
      res.send(`<!DOCTYPE html><html><head>
        <meta charset="utf-8"/>
        <meta property="og:type" content="profile"/>
        <meta property="og:site_name" content="LUMINARY Clan"/>
        <meta property="og:title" content="${title}"/>
        <meta property="og:description" content="${desc}"/>
        <meta property="og:image" content="${ogImage}"/>
        <meta property="og:image:width" content="1200"/>
        <meta property="og:image:height" content="630"/>
        <meta property="og:url" content="${profileUrl}"/>
        <meta name="twitter:card" content="summary_large_image"/>
        <meta name="twitter:title" content="${title}"/>
        <meta name="twitter:description" content="${desc}"/>
        <meta name="twitter:image" content="${ogImage}"/>
        <meta name="theme-color" content="#6366f1"/>
        <title>${title}</title>
      </head><body></body></html>`);
    } catch (e) {
      console.error("[OG] Error generating profile meta:", e);
      next();
    }
  });

  // SPA fallback — serve index.html for all client-side routes
  app.use("*", (_req, res) => {
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
