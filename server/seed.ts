import { db } from "./db";
import { clanMembers, news, clanStats, admins, clanSettings, monthlyStats } from "@shared/schema";
import { hashPassword } from "./auth";

async function seed() {
  console.log("Seeding database...");

  const existingMembers = await db.select().from(clanMembers).limit(1);
  if (existingMembers.length > 0) {
    console.log("Database already seeded, skipping...");
    return;
  }

  await db.insert(admins).values({
    username: "admin",
    passwordHash: await hashPassword("Luminary2024!"),
    email: "admin@luminary.clan",
  });

  await db.insert(clanSettings).values({
    clanName: "CLAN COMMAND",
    clanTag: "[CC]",
    description: "Элитный игровой клан с футуристичной эстетикой и профессиональным подходом к киберспорту",
    aiSystemPrompt: "Ты - AI советник игрового клана CLAN COMMAND. Помогай игрокам анализировать статистику, улучшать навыки и разрабатывать стратегии. Будь дружелюбным, но профессиональным.",
    primaryColor: "#06b6d4",
    accentColor: "#a855f7",
  });

  await db.insert(clanMembers).values([
    {
      username: "ShadowStrike",
      discordId: "123456789",
      role: "Leader",
      rank: 2500,
      wins: 245,
      losses: 89,
      kills: 3520,
      deaths: 1205,
      assists: 1890,
      activityScore: 1850,
      avatar: null,
    },
    {
      username: "PhoenixRising",
      discordId: "987654321",
      role: "Officer",
      rank: 2350,
      wins: 198,
      losses: 102,
      kills: 2890,
      deaths: 1450,
      assists: 1650,
      activityScore: 1620,
      avatar: null,
    },
    {
      username: "CyberNinja",
      discordId: "456789123",
      role: "Officer",
      rank: 2280,
      wins: 176,
      losses: 98,
      kills: 2650,
      deaths: 1320,
      assists: 1520,
      activityScore: 1480,
      avatar: null,
    },
    {
      username: "ThunderBolt",
      discordId: "789123456",
      role: "Member",
      rank: 2150,
      wins: 152,
      losses: 115,
      kills: 2280,
      deaths: 1580,
      assists: 1350,
      activityScore: 1320,
      avatar: null,
    },
    {
      username: "FrostByte",
      discordId: "321654987",
      role: "Member",
      rank: 2090,
      wins: 143,
      losses: 108,
      kills: 2150,
      deaths: 1480,
      assists: 1280,
      activityScore: 1250,
      avatar: null,
    },
    {
      username: "VortexGamer",
      discordId: "654987321",
      role: "Member",
      rank: 1980,
      wins: 128,
      losses: 125,
      kills: 1950,
      deaths: 1620,
      assists: 1150,
      activityScore: 1100,
      avatar: null,
    },
    {
      username: "NeonWarrior",
      discordId: "147258369",
      role: "Member",
      rank: 1850,
      wins: 115,
      losses: 132,
      kills: 1720,
      deaths: 1680,
      assists: 1050,
      activityScore: 980,
      avatar: null,
    },
    {
      username: "PixelHunter",
      discordId: "963852741",
      role: "Member",
      rank: 1750,
      wins: 98,
      losses: 145,
      kills: 1520,
      deaths: 1820,
      assists: 920,
      activityScore: 850,
      avatar: null,
    },
  ]);

  await db.insert(news).values([
    {
      title: "🏆 Победа в Региональном Турнире!",
      content: "Наш клан одержал блестящую победу в региональном турнире! Команда показала исключительную игру и заслуженно заняла первое место. Особая благодарность ShadowStrike за тактическое лидерство и PhoenixRising за невероятные механики.",
      category: "Турнир",
      authorName: "Администрация",
      imageUrl: null,
    },
    {
      title: "🚀 Запуск AI-Советника Клана",
      content: "Мы рады представить нашу новую систему AI-советника! Теперь каждый участник может получить персонализированные рекомендации по улучшению игры, анализ статистики и тактические советы в режиме реального времени.",
      category: "Обновления",
      authorName: "Tech Team",
      imageUrl: null,
    },
    {
      title: "🎮 Тренировочный Лагерь - Новый Сезон",
      content: "Стартует новый сезон тренировочного лагеря для всех участников клана. Занятия пройдут каждый вторник и четверг с 19:00. Присоединяйтесь для улучшения навыков и координации команды!",
      category: "События",
      authorName: "CyberNinja",
      imageUrl: null,
    },
    {
      title: "⚔️ Клановые Войны - Расписание",
      content: "Опубликовано расписание клановых войн на следующий месяц. Все участники должны быть готовы к матчам по средам и воскресеньям. Проверьте Discord для получения подробной информации.",
      category: "Расписание",
      authorName: "ThunderBolt",
      imageUrl: null,
    },
  ]);

  await db.insert(clanStats).values({
    totalMembers: 8,
    totalWins: 1255,
    totalLosses: 914,
    averageRank: 2119,
    monthlyActivity: 11450,
  });

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  
  await db.insert(monthlyStats).values([
    { year: currentYear, month: currentMonth >= 6 ? currentMonth - 6 : 12 + currentMonth - 6, wins: 145, losses: 112, activity: 850 },
    { year: currentYear, month: currentMonth >= 5 ? currentMonth - 5 : 12 + currentMonth - 5, wins: 152, losses: 115, activity: 920 },
    { year: currentYear, month: currentMonth >= 4 ? currentMonth - 4 : 12 + currentMonth - 4, wins: 148, losses: 118, activity: 880 },
    { year: currentYear, month: currentMonth >= 3 ? currentMonth - 3 : 12 + currentMonth - 3, wins: 161, losses: 114, activity: 1050 },
    { year: currentYear, month: currentMonth >= 2 ? currentMonth - 2 : 12 + currentMonth - 2, wins: 158, losses: 116, activity: 980 },
    { year: currentYear, month: currentMonth >= 1 ? currentMonth - 1 : 12, wins: 165, losses: 111, activity: 1120 },
  ]);

  console.log("Database seeded successfully!");
}

seed()
  .then(() => {
    console.log("Seeding completed");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Seeding failed:", error);
    process.exit(1);
  });
