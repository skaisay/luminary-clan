import { db } from "./db";
import { admins, clanSettings, clanStats, profileDecorations } from "@shared/schema";
import { hashPassword } from "./auth";
import { eq } from "drizzle-orm";

export async function ensureProductionData() {
  try {
    console.log("[Production] Checking if initial data exists...");

    const existingAdmins = await db.select().from(admins).limit(1);
    
    if (existingAdmins.length === 0) {
      console.log("[Production] Creating initial admin user...");
      
      const adminPassword = process.env.ADMIN_PASSWORD || "Luminary2024!";
      
      if (!process.env.ADMIN_PASSWORD) {
        console.warn("[Production] ⚠️  WARNING: Using default admin password!");
        console.warn("[Production] ⚠️  Set ADMIN_PASSWORD environment variable for better security");
        console.warn("[Production] ⚠️  Current password: Luminary2024!");
      }
      
      await db.insert(admins).values({
        username: "admin",
        passwordHash: await hashPassword(adminPassword),
        email: "admin@luminary.clan",
      });
      console.log("[Production] Admin user created successfully");
    }

    const existingSettings = await db.select().from(clanSettings).limit(1);
    
    if (existingSettings.length === 0) {
      console.log("[Production] Creating initial clan settings...");
      await db.insert(clanSettings).values({
        clanName: "CLAN COMMAND",
        clanTag: "[CC]",
        description: "Элитный игровой клан с футуристичной эстетикой и профессиональным подходом к киберспорту",
        aiSystemPrompt: "Ты - AI советник игрового клана CLAN COMMAND. Помогай игрокам анализировать статистику, улучшать навыки и разрабатывать стратегии. Будь дружелюбным, но профессиональным.",
        primaryColor: "#06b6d4",
        accentColor: "#a855f7",
      });
      console.log("[Production] Clan settings created successfully");
    }

    const existingStats = await db.select().from(clanStats).limit(1);
    
    if (existingStats.length === 0) {
      console.log("[Production] Creating initial clan stats...");
      await db.insert(clanStats).values({
        totalMembers: 0,
        totalWins: 0,
        totalLosses: 0,
        averageRank: 0,
        monthlyActivity: 0,
      });
      console.log("[Production] Clan stats created successfully");
    }

    console.log("[Production] Initial data check complete");

    // Seed default profile decorations
    const existingDecorations = await db.select().from(profileDecorations).limit(1);
    if (existingDecorations.length === 0) {
      console.log("[Production] Creating default profile decorations...");
      const defaultDecorations = [
        // BADGES — SVG-based icons next to name
        { name: "Пламя 🔥", description: "Огненный значок — показывает горячий темперамент", type: "badge", emoji: "🔥", cssEffect: "drop-shadow(0 0 6px #f97316)", color: "#f97316", rarity: "common", price: 500, category: "general" },
        { name: "Молния ⚡", description: "Электрический разряд — скорость и мощь", type: "badge", emoji: "⚡", cssEffect: "drop-shadow(0 0 6px #eab308)", color: "#eab308", rarity: "common", price: 500, category: "general" },
        { name: "Звезда ✦", description: "Яркая звезда — сияй среди остальных", type: "badge", emoji: "✦", cssEffect: "drop-shadow(0 0 6px #60a5fa)", color: "#60a5fa", rarity: "common", price: 750, category: "general" },
        { name: "Корона 👑", description: "Королевская корона — властвуй над игрой", type: "badge", emoji: "👑", cssEffect: "drop-shadow(0 0 8px #f59e0b) animate-pulse", color: "#f59e0b", rarity: "rare", price: 2000, category: "general" },
        { name: "Кристалл 💎", description: "Редчайший кристалл — привлекай взгляды", type: "badge", emoji: "💎", cssEffect: "drop-shadow(0 0 8px #8b5cf6)", color: "#8b5cf6", rarity: "rare", price: 3000, category: "general" },
        { name: "Дракон 🐉", description: "Древний дракон — непобедимая сила", type: "badge", emoji: "🐉", cssEffect: "drop-shadow(0 0 10px #ef4444) animate-bounce", color: "#ef4444", rarity: "epic", price: 7500, category: "exclusive" },
        { name: "Феникс 🦅", description: "Восставший из пепла — бессмертная легенда", type: "badge", emoji: "🦅", cssEffect: "drop-shadow(0 0 10px #f97316) animate-pulse", color: "#f97316", rarity: "epic", price: 10000, category: "exclusive" },
        { name: "Космос 🌌", description: "Галактический путешественник — за пределами вселенной", type: "badge", emoji: "🌌", cssEffect: "drop-shadow(0 0 12px #a855f7) animate-spin-slow", color: "#a855f7", rarity: "legendary", price: 25000, category: "exclusive" },
        { name: "Тёмный Рыцарь ⚔️", description: "Элитный воин тьмы — самый крутой и редкий значок", type: "badge", emoji: "⚔️", cssEffect: "drop-shadow(0 0 15px #dc2626) animate-pulse", color: "#dc2626", rarity: "legendary", price: 50000, category: "limited", maxOwners: 10 },
        // NAME COLORS
        { name: "Золотой Ник", description: "Твой никнейм сияет золотом", type: "name_color", emoji: null, cssEffect: "background: linear-gradient(90deg, #f59e0b, #fbbf24); -webkit-background-clip: text; -webkit-text-fill-color: transparent;", color: "#f59e0b", rarity: "rare", price: 5000, category: "general" },
        { name: "Градиент Неон", description: "Неоновый градиент на нике — киберпанк стиль", type: "name_color", emoji: null, cssEffect: "background: linear-gradient(90deg, #06b6d4, #a855f7, #ec4899); -webkit-background-clip: text; -webkit-text-fill-color: transparent;", color: "#06b6d4", rarity: "epic", price: 15000, category: "exclusive" },
        { name: "Радуга", description: "Все цвета радуги на твоём нике", type: "name_color", emoji: null, cssEffect: "background: linear-gradient(90deg, #ef4444, #f97316, #eab308, #22c55e, #3b82f6, #8b5cf6); -webkit-background-clip: text; -webkit-text-fill-color: transparent; animation: rainbow-shift 3s ease infinite; background-size: 200%;", color: "#ef4444", rarity: "legendary", price: 30000, category: "limited" },
        // AVATAR FRAMES
        { name: "Огненная Рамка", description: "Аватар в кольце пламени", type: "avatar_frame", emoji: null, cssEffect: "ring-2 ring-orange-500 shadow-lg shadow-orange-500/50", color: "#f97316", rarity: "rare", price: 4000, category: "general" },
        { name: "Космическая Рамка", description: "Мерцающая галактическая рамка", type: "avatar_frame", emoji: null, cssEffect: "ring-2 ring-purple-500 shadow-lg shadow-purple-500/50 animate-pulse", color: "#a855f7", rarity: "epic", price: 12000, category: "exclusive" },
      ];

      for (const d of defaultDecorations) {
        try {
          await db.insert(profileDecorations).values(d as any);
        } catch (e) {
          console.error(`[Production] Error inserting decoration ${d.name}:`, e);
        }
      }
      console.log(`[Production] Created ${defaultDecorations.length} default decorations`);
    }
  } catch (error) {
    console.error("[Production] Error ensuring initial data:", error);
  }
}
