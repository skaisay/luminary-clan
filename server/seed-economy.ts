import { db } from "./db";
import { achievements, items, quests } from "@shared/schema";

async function seedEconomy() {
  console.log("🎮 Seeding economy data...");

  // Проверяем, не добавлены ли уже данные
  const existingItems = await db.select().from(items).limit(1);
  if (existingItems.length > 0) {
    console.log("Economy data already seeded, skipping...");
    return;
  }

  // === ДОСТИЖЕНИЯ ===
  console.log("📜 Creating achievements...");
  await db.insert(achievements).values([
    {
      name: "Первые шаги",
      description: "Отправьте своё первое сообщение в Discord",
      icon: "💬",
      category: "activity",
      requirement: { type: "messages", count: 1 },
      reward: { coins: 10 },
      isSecret: false,
    },
    {
      name: "Болтун",
      description: "Отправьте 100 сообщений",
      icon: "🗣️",
      category: "activity",
      requirement: { type: "messages", count: 100 },
      reward: { coins: 100, items: [] },
      isSecret: false,
    },
    {
      name: "Говорун",
      description: "Отправьте 1000 сообщений",
      icon: "📢",
      category: "activity",
      requirement: { type: "messages", count: 1000 },
      reward: { coins: 500 },
      isSecret: false,
    },
    {
      name: "Первый в войсе",
      description: "Проведите первую минуту в голосовом канале",
      icon: "🎤",
      category: "activity",
      requirement: { type: "voice_minutes", count: 1 },
      reward: { coins: 20 },
      isSecret: false,
    },
    {
      name: "Заядлый собеседник",
      description: "Проведите 60 минут в голосовых каналах",
      icon: "🎧",
      category: "activity",
      requirement: { type: "voice_minutes", count: 60 },
      reward: { coins: 200 },
      isSecret: false,
    },
    {
      name: "Богач",
      description: "Накопите 1000 LumiCoins",
      icon: "💰",
      category: "economy",
      requirement: { type: "coins", count: 1000 },
      reward: { coins: 100 },
      isSecret: false,
    },
    {
      name: "Миллионер",
      description: "Накопите 10000 LumiCoins",
      icon: "💎",
      category: "economy",
      requirement: { type: "coins", count: 10000 },
      reward: { coins: 1000 },
      isSecret: false,
    },
    {
      name: "Покупатель",
      description: "Купите свой первый предмет",
      icon: "🛍️",
      category: "economy",
      requirement: { type: "purchases", count: 1 },
      reward: { coins: 50 },
      isSecret: false,
    },
    {
      name: "Коллекционер",
      description: "Соберите 10 различных предметов",
      icon: "🎒",
      category: "economy",
      requirement: { type: "unique_items", count: 10 },
      reward: { coins: 500 },
      isSecret: false,
    },
    {
      name: "Социальный",
      description: "Поставьте 100 реакций",
      icon: "👍",
      category: "social",
      requirement: { type: "reactions", count: 100 },
      reward: { coins: 150 },
      isSecret: false,
    },
    {
      name: "Секретный агент",
      description: "Найдите секретный код в описании клана",
      icon: "🕵️",
      category: "general",
      requirement: { type: "secret_code", count: 1 },
      reward: { coins: 1000 },
      isSecret: true,
    },
  ]);

  // === ПРЕДМЕТЫ ===
  console.log("🎁 Creating items...");
  
  // Бустеры опыта
  await db.insert(items).values([
    {
      name: "Бустер Опыта x1.5",
      description: "Увеличивает получение LumiCoin на 50% в течение 1 часа",
      price: 500,
      category: "booster",
      rarity: "common",
      itemData: { boostType: "coins", multiplier: 1.5, duration: 3600 },
      imageUrl: null,
      stock: -1,
    },
    {
      name: "Бустер Опыта x2",
      description: "Удваивает получение LumiCoin в течение 1 часа",
      price: 1000,
      category: "booster",
      rarity: "rare",
      itemData: { boostType: "coins", multiplier: 2.0, duration: 3600 },
      imageUrl: null,
      stock: -1,
    },
    {
      name: "Бустер Опыта x3",
      description: "Утраивает получение LumiCoin в течение 30 минут",
      price: 2000,
      category: "booster",
      rarity: "epic",
      itemData: { boostType: "coins", multiplier: 3.0, duration: 1800 },
      imageUrl: null,
      stock: -1,
    },
    {
      name: "Мега Бустер x5",
      description: "Увеличивает получение LumiCoin в 5 раз на 15 минут!",
      price: 5000,
      category: "booster",
      rarity: "legendary",
      itemData: { boostType: "coins", multiplier: 5.0, duration: 900 },
      imageUrl: null,
      stock: -1,
    },
  ]);

  // Бейджи
  await db.insert(items).values([
    {
      name: "Бейдж Новичка",
      description: "Награда за вступление в клан",
      price: 100,
      category: "badge",
      rarity: "common",
      itemData: { icon: "🌟", displayName: "Новичок" },
      imageUrl: null,
      stock: -1,
    },
    {
      name: "Бейдж Ветерана",
      description: "Для тех, кто с нами более 6 месяцев",
      price: 2500,
      category: "badge",
      rarity: "rare",
      itemData: { icon: "⚔️", displayName: "Ветеран" },
      imageUrl: null,
      stock: -1,
    },
    {
      name: "Бейдж Легенды",
      description: "Только для настоящих легенд клана",
      price: 10000,
      category: "badge",
      rarity: "legendary",
      itemData: { icon: "👑", displayName: "Легенда" },
      imageUrl: null,
      stock: 10,
    },
  ]);

  // Титулы
  await db.insert(items).values([
    {
      name: "Титул: Воин",
      description: "Отображается в вашем профиле",
      price: 300,
      category: "title",
      rarity: "common",
      itemData: { titleText: "⚔️ Воин" },
      imageUrl: null,
      stock: -1,
    },
    {
      name: "Титул: Чемпион",
      description: "Для победителей турниров",
      price: 1500,
      category: "title",
      rarity: "epic",
      itemData: { titleText: "🏆 Чемпион" },
      imageUrl: null,
      stock: -1,
    },
    {
      name: "Титул: Повелитель Хаоса",
      description: "Редкий титул для избранных",
      price: 7500,
      category: "title",
      rarity: "legendary",
      itemData: { titleText: "💀 Повелитель Хаоса" },
      imageUrl: null,
      stock: 5,
    },
  ]);

  // Баннеры (цветные фоны)
  await db.insert(items).values([
    {
      name: "Синий Баннер",
      description: "Кастомный цвет профиля",
      price: 200,
      category: "banner",
      rarity: "common",
      itemData: { color: "#3b82f6", gradientColors: ["#3b82f6", "#2563eb"] },
      imageUrl: null,
      stock: -1,
    },
    {
      name: "Золотой Баннер",
      description: "Роскошный золотой фон",
      price: 1000,
      category: "banner",
      rarity: "rare",
      itemData: { color: "#fbbf24", gradientColors: ["#fbbf24", "#f59e0b"] },
      imageUrl: null,
      stock: -1,
    },
    {
      name: "Радужный Баннер",
      description: "Эпический радужный градиент",
      price: 3000,
      category: "banner",
      rarity: "epic",
      itemData: { color: "#ec4899", gradientColors: ["#ec4899", "#8b5cf6", "#3b82f6"] },
      imageUrl: null,
      stock: -1,
    },
  ]);

  // Коллекционные предметы
  await db.insert(items).values([
    {
      name: "Кристалл Силы",
      description: "Редкий коллекционный кристалл",
      price: 5000,
      category: "collectible",
      rarity: "epic",
      itemData: { collectionSet: "crystals", displayIcon: "💎" },
      imageUrl: null,
      stock: 20,
    },
    {
      name: "Древний Артефакт",
      description: "Легендарный артефакт древних времён",
      price: 15000,
      category: "collectible",
      rarity: "legendary",
      itemData: { collectionSet: "artifacts", displayIcon: "🏺" },
      imageUrl: null,
      stock: 5,
    },
  ]);

  // Специальные услуги
  await db.insert(items).values([
    {
      name: "Смена Имени на Сервере",
      description: "Измените свой никнейм на Discord сервере один раз. Услуга применяется сразу после покупки.",
      price: 15000,
      category: "service",
      rarity: "legendary",
      itemData: { serviceType: "nickname_change", usageLimit: 1 },
      imageUrl: null,
      stock: -1,
    },
    {
      name: "VIP Смена Имени",
      description: "Премиум услуга смены имени с возможностью использования эмодзи и специальных символов",
      price: 25000,
      category: "service",
      rarity: "legendary",
      itemData: { serviceType: "nickname_change_vip", usageLimit: 1, allowSpecialChars: true },
      imageUrl: null,
      stock: -1,
    },
  ]);

  // === КВЕСТЫ ===
  console.log("📋 Creating quests...");
  
  // Ежедневные квесты
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);

  await db.insert(quests).values([
    {
      name: "Ежедневная активность",
      description: "Отправьте 10 сообщений сегодня",
      questType: "daily",
      requirements: [{ type: "messages", count: 10 }],
      rewards: { coins: 50 },
      isActive: true,
      expiresAt: tomorrow,
    },
    {
      name: "Голосовое общение",
      description: "Проведите 30 минут в голосовом канале",
      questType: "daily",
      requirements: [{ type: "voice_minutes", count: 30 }],
      rewards: { coins: 100 },
      isActive: true,
      expiresAt: tomorrow,
    },
    {
      name: "Социальная бабочка",
      description: "Поставьте 5 реакций",
      questType: "daily",
      requirements: [{ type: "reactions", count: 5 }],
      rewards: { coins: 30 },
      isActive: true,
      expiresAt: tomorrow,
    },
  ]);

  // Недельные квесты
  const nextWeek = new Date(today);
  nextWeek.setDate(nextWeek.getDate() + 7);

  await db.insert(quests).values([
    {
      name: "Недельный чемпион",
      description: "Отправьте 100 сообщений за неделю",
      questType: "weekly",
      requirements: [{ type: "messages", count: 100 }],
      rewards: { coins: 500 },
      isActive: true,
      expiresAt: nextWeek,
    },
    {
      name: "Голосовой марафон",
      description: "Проведите 5 часов в голосовых каналах за неделю",
      questType: "weekly",
      requirements: [{ type: "voice_minutes", count: 300 }],
      rewards: { coins: 1000 },
      isActive: true,
      expiresAt: nextWeek,
    },
  ]);

  console.log("✅ Economy data seeded successfully!");
}

seedEconomy()
  .then(() => {
    console.log("✅ Economy seeding completed");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Economy seeding failed:", error);
    process.exit(1);
  });
