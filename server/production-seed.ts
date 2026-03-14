import { db } from "./db";
import { admins, clanSettings, clanStats } from "@shared/schema";
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
  } catch (error) {
    console.error("[Production] Error ensuring initial data:", error);
  }
}
