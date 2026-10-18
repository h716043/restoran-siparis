import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import {
  Category,
  Coupon,
  CustomerUser,
  DeliveryZone,
  MenuItem,
  Order,
  RestaurantSettings,
  SavedAddress,
  TableCall,
  TableReservation,
  WhatsAppLog,
  formatTableLabel,
  isSameTableName,
} from "@/types";
import {
  CAMPAIGN_CATEGORY,
  CAMPAIGN_MENU_ITEMS,
  enrichSingleItemPortions,
} from "@/lib/campaignSeed";

function resolveDataDir(): string {
  if (process.env.NETLIFY === "true" || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return path.join(os.tmpdir(), "restoran-siparis-data");
  }
  const localDir = path.join(process.cwd(), "data");
  try {
    if (!fs.existsSync(localDir)) {
      fs.mkdirSync(localDir, { recursive: true });
    }
    return localDir;
  } catch {
    const fallbackDir = path.join(os.tmpdir(), "restoran-siparis-data");
    if (!fs.existsSync(fallbackDir)) {
      fs.mkdirSync(fallbackDir, { recursive: true });
    }
    return fallbackDir;
  }
}

const DATA_DIR = resolveDataDir();
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, "restaurant.sqlite");

const globalForDb = globalThis as unknown as {
  sqliteDb?: DatabaseSync;
  schemaMigratedV12?: boolean;
};

export function getDb(): DatabaseSync {
  if (!globalForDb.sqliteDb) {
    const db = new DatabaseSync(DB_PATH);
    db.exec("PRAGMA journal_mode = WAL;");
    initSchema(db);
    globalForDb.sqliteDb = db;
    globalForDb.schemaMigratedV12 = true;
  } else if (!globalForDb.schemaMigratedV12) {
    initSchema(globalForDb.sqliteDb);
    globalForDb.schemaMigratedV12 = true;
  }
  return globalForDb.sqliteDb;
}

const DEFAULT_ZONES: DeliveryZone[] = [
  {
    id: "zone-1",
    name: "Merkez / Caferağa & Osmanağa Mah.",
    minAmount: 250,
    deliveryFee: 0,
    estimatedMinutes: 25,
    active: true,
  },
  {
    id: "zone-2",
    name: "Moda / Fenerbahçe & Kalamış",
    minAmount: 350,
    deliveryFee: 25,
    estimatedMinutes: 35,
    active: true,
  },
  {
    id: "zone-3",
    name: "Acıbadem / Koşuyolu",
    minAmount: 450,
    deliveryFee: 35,
    estimatedMinutes: 40,
    active: true,
  },
  {
    id: "zone-4",
    name: "Göztepe / Caddebostan / Suadiye",
    minAmount: 550,
    deliveryFee: 45,
    estimatedMinutes: 45,
    active: true,
  },
];

const DEFAULT_COUPONS: Coupon[] = [
  {
    id: "cpn-1",
    code: "MERHABA50",
    title: "50 ₺ Hoş Geldin İndirimi",
    discountType: "fixed",
    discountValue: 50,
    minOrderAmount: 350,
    active: true,
  },
  {
    id: "cpn-2",
    code: "LEZZET15",
    title: "%15 Online Sipariş İndirimi",
    discountType: "percentage",
    discountValue: 15,
    minOrderAmount: 500,
    active: true,
  },
];

function initSchema(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      data TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL,
      sortOrder INTEGER NOT NULL DEFAULT 0,
      icon TEXT NOT NULL DEFAULT 'Utensils'
    );

    CREATE TABLE IF NOT EXISTS menu_items (
      id TEXT PRIMARY KEY,
      categoryId TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      price REAL NOT NULL,
      imageUrl TEXT NOT NULL,
      available INTEGER NOT NULL DEFAULT 1,
      popular INTEGER NOT NULL DEFAULT 0,
      dailyStock INTEGER DEFAULT NULL,
      modifierGroupsJson TEXT NOT NULL DEFAULT '[]'
    );

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      orderNumber INTEGER NOT NULL,
      orderType TEXT NOT NULL,
      status TEXT NOT NULL,
      tableNumber TEXT,
      userId TEXT,
      customerName TEXT NOT NULL,
      customerPhone TEXT NOT NULL,
      customerAddress TEXT,
      deliveryZoneId TEXT,
      deliveryZoneName TEXT,
      scheduledTime TEXT,
      orderNote TEXT,
      paymentMethod TEXT NOT NULL,
      splitPaymentJson TEXT,
      subtotal REAL NOT NULL,
      discountAmount REAL DEFAULT 0,
      couponCode TEXT,
      deliveryFee REAL NOT NULL,
      totalAmount REAL NOT NULL,
      estimatedMinutes INTEGER,
      courierName TEXT,
      rejectReason TEXT,
      loyaltyPointsEarned REAL DEFAULT 0,
      loyaltyPointsUsed REAL DEFAULT 0,
      rating INTEGER,
      reviewText TEXT,
      reviewedAt TEXT,
      itemsJson TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS reservations (
      id TEXT PRIMARY KEY,
      reservationNumber INTEGER NOT NULL,
      customerName TEXT NOT NULL,
      customerPhone TEXT NOT NULL,
      guestCount INTEGER NOT NULL,
      reservationDate TEXT NOT NULL,
      reservationTime TEXT NOT NULL,
      specialRequests TEXT,
      assignedTable TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      rejectReason TEXT,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      phone TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      addressesJson TEXT NOT NULL DEFAULT '[]',
      loyaltyPoints REAL DEFAULT 0,
      createdAt TEXT NOT NULL,
      lastLoginAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS otp_codes (
      phone TEXT PRIMARY KEY,
      code TEXT NOT NULL,
      expiresAt INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS whatsapp_logs (
      id TEXT PRIMARY KEY,
      phone TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT NOT NULL,
      status TEXT NOT NULL,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS table_calls (
      id TEXT PRIMARY KEY,
      tableNumber TEXT NOT NULL,
      type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      createdAt TEXT NOT NULL
    );
  `);

  // Ensure new columns exist on orders, menu_items, and users tables
  const alterCols = [
    "ALTER TABLE orders ADD COLUMN userId TEXT;",
    "ALTER TABLE orders ADD COLUMN deliveryZoneId TEXT;",
    "ALTER TABLE orders ADD COLUMN deliveryZoneName TEXT;",
    "ALTER TABLE orders ADD COLUMN scheduledTime TEXT;",
    "ALTER TABLE orders ADD COLUMN discountAmount REAL DEFAULT 0;",
    "ALTER TABLE orders ADD COLUMN couponCode TEXT;",
    "ALTER TABLE orders ADD COLUMN courierName TEXT;",
    "ALTER TABLE orders ADD COLUMN loyaltyPointsEarned REAL DEFAULT 0;",
    "ALTER TABLE orders ADD COLUMN loyaltyPointsUsed REAL DEFAULT 0;",
    "ALTER TABLE orders ADD COLUMN rating INTEGER;",
    "ALTER TABLE orders ADD COLUMN reviewText TEXT;",
    "ALTER TABLE orders ADD COLUMN reviewedAt TEXT;",
    "ALTER TABLE orders ADD COLUMN splitPaymentJson TEXT;",
    "ALTER TABLE orders ADD COLUMN guestCount INTEGER DEFAULT NULL;",
    "ALTER TABLE orders ADD COLUMN isPriority INTEGER DEFAULT 0;",
    "ALTER TABLE menu_items ADD COLUMN dailyStock INTEGER DEFAULT NULL;",
    "ALTER TABLE menu_items ADD COLUMN costPrice REAL DEFAULT 0;",
    "ALTER TABLE menu_items ADD COLUMN originalPrice REAL DEFAULT NULL;",
    "ALTER TABLE menu_items ADD COLUMN badgesJson TEXT DEFAULT '[]';",
    "ALTER TABLE users ADD COLUMN loyaltyPoints REAL DEFAULT 0;",
  ];
  for (const sql of alterCols) {
    try {
      db.exec(sql);
    } catch {
      // already exists
    }
  }

  const row = db.prepare("SELECT id, data FROM settings WHERE id = 1").get() as
    | { id: number; data: string }
    | undefined;
  if (!row) {
    seedDatabase(db);
  } else {
    const parsed = JSON.parse(row.data) as RestaurantSettings;
    let changed = false;
    if (!parsed.whatsappConfig) {
      parsed.whatsappConfig = {
        provider: "simulation",
        gatewayUrl: "http://localhost:3001/send-message",
        gatewayApiKey: "",
        metaPhoneNumberId: "",
        metaAccessToken: "",
        sendOrderUpdates: true,
        requireAuthForDeliveryAndPickup: true,
      };
      changed = true;
    }
    if (!parsed.securityConfig) {
      parsed.securityConfig = {
        adminPassword: "admin1234",
        kitchenPassword: "1234",
      };
      changed = true;
    }
    if (!parsed.deliveryZones || parsed.deliveryZones.length === 0) {
      parsed.deliveryZones = DEFAULT_ZONES;
      changed = true;
    }
    if (!parsed.coupons) {
      parsed.coupons = DEFAULT_COUPONS;
      changed = true;
    }
    if (!parsed.couriers || parsed.couriers.length === 0) {
      parsed.couriers = [
        "Kurye 1 (Motorlu)",
        "Kurye 2 (Motorlu)",
        "Hızlı Kurye",
      ];
      changed = true;
    }
    if (parsed.firstOrderDiscountPercent === undefined) {
      parsed.firstOrderDiscountPercent = 10;
      changed = true;
    }
    if (!parsed.loyaltyConfig) {
      parsed.loyaltyConfig = {
        enabled: true,
        earnPercent: 5,
        minRedeemPoints: 20,
      };
      changed = true;
    }
    if (!parsed.storefrontTheme) {
      parsed.storefrontTheme = "light-classic";
      changed = true;
    }
    if (parsed.allowCustomerThemeSwitch === undefined) {
      parsed.allowCustomerThemeSwitch = true;
      changed = true;
    }
    if (!parsed.announcementBar) {
      parsed.announcementBar = {
        enabled: true,
        badgeText: "🔥 GÜNÜN FIRSATI",
        text: "Tüm ızgara menülerde ücretsiz Yayık Ayran! • 350 ₺ üzeri siparişlerde MERHABA50 koduyla 50 ₺ indirim",
        couponCodeToApply: "MERHABA50",
        theme: "orange",
      };
      changed = true;
    }
    if (changed) {
      db.prepare("UPDATE settings SET data = ? WHERE id = 1").run(
        JSON.stringify(parsed)
      );
    }
  }

  ensureCampaignCategoryAndItems(db);
}

function ensureCampaignCategoryAndItems(db: DatabaseSync) {
  // 1. "🎁 Kampanya & Fırsat Menüleri" kategorisi yoksa en başa (sortOrder: 0) ekle
  const existingCampCat = db
    .prepare("SELECT id FROM categories WHERE id = ?")
    .get(CAMPAIGN_CATEGORY.id);
  if (!existingCampCat) {
    db.prepare(
      "INSERT INTO categories (id, name, slug, sortOrder, icon) VALUES (?, ?, ?, ?, ?)"
    ).run(
      CAMPAIGN_CATEGORY.id,
      CAMPAIGN_CATEGORY.name,
      CAMPAIGN_CATEGORY.slug,
      CAMPAIGN_CATEGORY.sortOrder,
      CAMPAIGN_CATEGORY.icon
    );
  }

  // 2. Kampanya ürünlerini (birden fazla ürün içeren, her ürünün porsiyonu + her porsiyonun ekstraları olan) ekle
  const insertItemStmt = db.prepare(`
    INSERT INTO menu_items (id, categoryId, name, description, price, imageUrl, available, popular, modifierGroupsJson)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const campItem of CAMPAIGN_MENU_ITEMS) {
    const exists = db
      .prepare("SELECT id FROM menu_items WHERE id = ?")
      .get(campItem.id);
    if (!exists) {
      insertItemStmt.run(
        campItem.id,
        campItem.categoryId,
        campItem.name,
        campItem.description,
        campItem.price,
        campItem.imageUrl,
        campItem.available ? 1 : 0,
        campItem.popular ? 1 : 0,
        JSON.stringify(campItem.modifierGroups)
      );
    }
  }

  // 3. Mevcut tekil ürünlerin porsiyon seçeneklerinde henüz porsiyon ekstrası (subOptions) yoksa zenginleştir
  const allRows = db
    .prepare("SELECT * FROM menu_items WHERE categoryId != ?")
    .all(CAMPAIGN_CATEGORY.id) as Array<{
    id: string;
    categoryId: string;
    name: string;
    description: string;
    price: number;
    imageUrl: string;
    available: number;
    popular: number;
    modifierGroupsJson: string;
  }>;

  const updateStmt = db.prepare(
    "UPDATE menu_items SET modifierGroupsJson = ? WHERE id = ?"
  );

  for (const r of allRows) {
    const currentItem: MenuItem = {
      id: r.id,
      categoryId: r.categoryId,
      name: r.name,
      description: r.description,
      price: r.price,
      imageUrl: r.imageUrl,
      available: Boolean(r.available),
      popular: Boolean(r.popular),
      modifierGroups: JSON.parse(r.modifierGroupsJson || "[]"),
    };
    const hasAnySubOptions = currentItem.modifierGroups.some((g) =>
      g.options.some((o) => o.subOptions && o.subOptions.length > 0)
    );
    if (!hasAnySubOptions) {
      const enriched = enrichSingleItemPortions(currentItem);
      updateStmt.run(JSON.stringify(enriched.modifierGroups), r.id);
    }
  }
}

function seedDatabase(db: DatabaseSync) {
  const defaultSettings: RestaurantSettings = {
    name: "Lezzet Durağı Restoran & Izgara",
    slogan: "Odun Ateşinde Gerçek Lezzet • Masa & Paket Sipariş",
    phone: "0212 555 01 99",
    address: "Atatürk Mah. Cumhuriyet Cad. No:42 Kadıköy / İstanbul",
    isOpen: true,
    minDeliveryAmount: 250,
    deliveryFee: 35,
    estimatedPrepMinutes: 25,
    tableCount: 15,
    currency: "₺",
    openingHours: "11:00 - 23:30",
    firstOrderDiscountPercent: 10,
    storefrontTheme: "light-classic",
    allowCustomerThemeSwitch: true,
    loyaltyConfig: {
      enabled: true,
      earnPercent: 5,
      minRedeemPoints: 20,
    },
    announcementBar: {
      enabled: true,
      badgeText: "🔥 GÜNÜN FIRSATI",
      text: "Tüm ızgara menülerde ücretsiz Yayık Ayran! • 350 ₺ üzeri siparişlerde MERHABA50 koduyla 50 ₺ indirim",
      couponCodeToApply: "MERHABA50",
      theme: "orange",
    },
    deliveryZones: DEFAULT_ZONES,
    coupons: DEFAULT_COUPONS,
    couriers: ["Kurye 1 (Motorlu)", "Kurye 2 (Motorlu)", "Hızlı Kurye"],
    whatsappConfig: {
      provider: "simulation",
      gatewayUrl: "http://localhost:3001/send-message",
      gatewayApiKey: "",
      metaPhoneNumberId: "",
      metaAccessToken: "",
      sendOrderUpdates: true,
      requireAuthForDeliveryAndPickup: true,
    },
    securityConfig: {
      adminPassword: "admin1234",
      kitchenPassword: "1234",
    },
  };

  db.prepare("INSERT INTO settings (id, data) VALUES (1, ?)").run(
    JSON.stringify(defaultSettings)
  );

  const initialCategories: Category[] = [
    { id: "cat-1", name: "Popüler & Menüler", slug: "populer", sortOrder: 1, icon: "Flame" },
    { id: "cat-2", name: "Izgara & Kebaplar", slug: "izgara-kebap", sortOrder: 2, icon: "UtensilsCrossed" },
    { id: "cat-3", name: "Taş Fırın & Burger", slug: "firin-burger", sortOrder: 3, icon: "Pizza" },
    { id: "cat-4", name: "Başlangıç & Salatalar", slug: "baslangic", sortOrder: 4, icon: "Salad" },
    { id: "cat-5", name: "Tatlılar", slug: "tatlilar", sortOrder: 5, icon: "IceCream" },
    { id: "cat-6", name: "İçecekler", slug: "icecekler", sortOrder: 6, icon: "CupSoda" },
  ];

  const insertCat = db.prepare(
    "INSERT INTO categories (id, name, slug, sortOrder, icon) VALUES (?, ?, ?, ?, ?)"
  );
  for (const c of initialCategories) {
    insertCat.run(c.id, c.name, c.slug, c.sortOrder, c.icon);
  }

  const initialItems: MenuItem[] = [
    {
      id: "item-1",
      categoryId: "cat-1",
      name: "Karışık Izgara Şef Tabağı",
      description: "Adana kebap, kuzu şiş, tavuk kanat, ızgara köfte, közlenmiş biber-domates, bulgur pilavı ve sıcak lavaş ile.",
      price: 540,
      imageUrl: "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=800&q=80",
      available: true,
      popular: true,
      modifierGroups: [
        {
          id: "mod-porsiyon",
          name: "Porsiyon Seçimi",
          required: true,
          multiSelect: false,
          options: [
            { id: "opt-1", name: "1 Porsiyon (Standart)", price: 0 },
            { id: "opt-2", name: "1.5 Porsiyon (Doyuran)", price: 210 },
          ],
        },
        {
          id: "mod-eslikci",
          name: "Ekstra Yan Lezzetler",
          required: false,
          multiSelect: true,
          options: [
            { id: "opt-3", name: "Ekstra İçli Köfte (1 Adet)", price: 75 },
            { id: "opt-4", name: "Ekstra Puf Lavaş (2 Adet)", price: 25 },
            { id: "opt-5", name: "Süzme Yoğurt", price: 50 },
          ],
        },
        {
          id: "mod-cikar",
          name: "Çıkarılacak Malzemeler",
          required: false,
          multiSelect: true,
          options: [
            { id: "opt-6", name: "Soğansız Olsun", price: 0 },
            { id: "opt-7", name: "Acısız Olsun", price: 0 },
          ],
        },
      ],
    },
    {
      id: "item-2",
      categoryId: "cat-2",
      name: "Zırh Kıyması Adana Kebap",
      description: "Özel zırhta çekilmiş erkek kuzu eti, sumaklı soğan salatası, ezme, közlenmiş domates ve biber eşliğinde.",
      price: 360,
      imageUrl: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=800&q=80",
      available: true,
      popular: true,
      modifierGroups: [
        {
          id: "mod-aci",
          name: "Acı Seçimi",
          required: true,
          multiSelect: false,
          options: [
            { id: "opt-a1", name: "Acılı (Orijinal Adana)", price: 0 },
            { id: "opt-a2", name: "Acısız (Urfa Usulü)", price: 0 },
          ],
        },
        {
          id: "mod-porsiyon-2",
          name: "Porsiyon Seçimi",
          required: true,
          multiSelect: false,
          options: [
            { id: "opt-p1", name: "Tam Porsiyon (180g)", price: 0 },
            { id: "opt-p2", name: "1.5 Porsiyon (270g)", price: 150 },
          ],
        },
      ],
    },
    {
      id: "item-3",
      categoryId: "cat-3",
      name: "Trüf Mantarlı Gurme Burger",
      description: "180g dana kaburga burger köftesi, karamelize soğan, duble cheddar peyniri, trüf mayonez ve baharatlı patates kızartması.",
      price: 330,
      imageUrl: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=800&q=80",
      available: true,
      popular: true,
      modifierGroups: [
        {
          id: "mod-pisme",
          name: "Pişme Derecesi",
          required: true,
          multiSelect: false,
          options: [
            { id: "opt-b1", name: "Orta (Medium - Önerilen)", price: 0 },
            { id: "opt-b2", name: "İyi Pişmiş (Well Done)", price: 0 },
          ],
        },
        {
          id: "mod-burger-ekstra",
          name: "Ekstra Malzemeler",
          required: false,
          multiSelect: true,
          options: [
            { id: "opt-b3", name: "Ekstra Cheddar Peyniri", price: 35 },
            { id: "opt-b4", name: "Dana Füme Et", price: 65 },
            { id: "opt-b5", name: "Ekstra Burger Köftesi (+120g)", price: 130 },
          ],
        },
      ],
    },
    {
      id: "item-4",
      categoryId: "cat-3",
      name: "Odun Ateşinde Kaşarlı Kuşbaşılı Pide",
      description: "İncecik çıtır hamur üzerinde dinlendirilmiş dana kuşbaşı, Trabzon tereyağı ve bol kaşar peyniri.",
      price: 310,
      imageUrl: "https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=800&q=80",
      available: true,
      popular: false,
      modifierGroups: [
        {
          id: "mod-pide-ekstra",
          name: "Üzerine Ekstra",
          required: false,
          multiSelect: true,
          options: [
            { id: "opt-pi1", name: "Üzerine Köy Yumurtası", price: 30 },
            { id: "opt-pi2", name: "Ekstra Kaşar Peyniri", price: 45 },
          ],
        },
      ],
    },
    {
      id: "item-5",
      categoryId: "cat-4",
      name: "Gavurdağı Salatası",
      description: "İnce kıyım domates, salatalık, bol ceviz içi, nar ekşisi sosu ve taze nane.",
      price: 145,
      imageUrl: "https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=800&q=80",
      available: true,
      popular: false,
      modifierGroups: [],
    },
    {
      id: "item-6",
      categoryId: "cat-4",
      name: "Sıcak Humus (Pastırmalı / Sade)",
      description: "Tahin, zeytinyağı ve kimyon ile hazırlanan ılık humus.",
      price: 135,
      imageUrl: "https://images.unsplash.com/photo-1577906096429-f73c2c312435?auto=format&fit=crop&w=800&q=80",
      available: true,
      popular: false,
      modifierGroups: [
        {
          id: "mod-humus",
          name: "Sunum Tercihi",
          required: true,
          multiSelect: false,
          options: [
            { id: "opt-h1", name: "Tereyağlı Sade", price: 0 },
            { id: "opt-h2", name: "Kayseri Pastırmalı", price: 55 },
          ],
        },
      ],
    },
    {
      id: "item-7",
      categoryId: "cat-5",
      name: "Antep Fıstıklı Sıcak Künefe",
      description: "Siparişe özel pişirilen çıtır kadayıf, özel Hatay peyniri ve bol boz Antep fıstığı.",
      price: 210,
      imageUrl: "https://images.unsplash.com/photo-1579372786545-d24232daf58c?auto=format&fit=crop&w=800&q=80",
      available: true,
      popular: true,
      modifierGroups: [
        {
          id: "mod-kunefe",
          name: "Üzerine Ekstra",
          required: false,
          multiSelect: true,
          options: [
            { id: "opt-k1", name: "Kesme Maraş Dondurması", price: 55 },
            { id: "opt-k2", name: "Manda Kaymağı", price: 65 },
          ],
        },
      ],
    },
    {
      id: "item-8",
      categoryId: "cat-6",
      name: "Bol Köpüklü Yayık Ayranı (Bakır Maşrapa / Kapalı)",
      description: "Günlük taze yoğurttan hazırlanan ev yapımı yayık ayranı (330ml).",
      price: 55,
      imageUrl: "https://images.unsplash.com/photo-1556881286-fc6915169721?auto=format&fit=crop&w=800&q=80",
      available: true,
      popular: false,
      modifierGroups: [],
    },
    {
      id: "item-9",
      categoryId: "cat-6",
      name: "Kutu İçecek (330ml)",
      description: "Soğuk kutu meşrubat çeşitleri.",
      price: 60,
      imageUrl: "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=800&q=80",
      available: true,
      popular: false,
      modifierGroups: [
        {
          id: "mod-icecek",
          name: "İçecek Seçimi",
          required: true,
          multiSelect: false,
          options: [
            { id: "opt-i1", name: "Coca-Cola (330ml)", price: 0 },
            { id: "opt-i2", name: "Coca-Cola Zero (330ml)", price: 0 },
            { id: "opt-i3", name: "Fanta (330ml)", price: 0 },
            { id: "opt-i4", name: "Sprite (330ml)", price: 0 },
            { id: "opt-i5", name: "Şalgam Suyu (Acılı)", price: 0 },
          ],
        },
      ],
    },
  ];

  const insertItem = db.prepare(`
    INSERT INTO menu_items (id, categoryId, name, description, price, imageUrl, available, popular, modifierGroupsJson)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const item of initialItems) {
    insertItem.run(
      item.id,
      item.categoryId,
      item.name,
      item.description,
      item.price,
      item.imageUrl,
      item.available ? 1 : 0,
      item.popular ? 1 : 0,
      JSON.stringify(item.modifierGroups)
    );
  }
}

export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("90") && digits.length === 12) return digits;
  if (digits.startsWith("0") && digits.length === 11) return "9" + digits;
  if (digits.length === 10 && digits.startsWith("5")) return "90" + digits;
  return digits;
}

export function getSettings(): RestaurantSettings {
  const db = getDb();
  const row = db.prepare("SELECT data FROM settings WHERE id = 1").get() as { data: string };
  const parsed = JSON.parse(row.data) as RestaurantSettings;
  let updated = false;
  if (!parsed.announcementBar) {
    parsed.announcementBar = {
      enabled: true,
      badgeText: "🔥 GÜNÜN FIRSATI",
      text: "Tüm ızgara menülerde ücretsiz Yayık Ayran! • 350 ₺ üzeri siparişlerde MERHABA50 koduyla 50 ₺ indirim",
      couponCodeToApply: "MERHABA50",
      theme: "orange",
    };
    updated = true;
  }
  if (!parsed.openTime) {
    parsed.openTime = "11:00";
    updated = true;
  }
  if (!parsed.closeTime) {
    parsed.closeTime = "23:30";
    updated = true;
  }
  if (parsed.autoOpenCloseByHours === undefined) {
    parsed.autoOpenCloseByHours = false;
    updated = true;
  }
  if (!parsed.happyHourConfig) {
    parsed.happyHourConfig = {
      enabled: false,
      title: "⏱️ Öğle Molası Happy Hour İndirimi",
      startTime: "12:00",
      endTime: "16:00",
      discountPercent: 15,
      categoryIds: [],
    };
    updated = true;
  }
  if (!Array.isArray(parsed.cashExpenses)) {
    parsed.cashExpenses = [];
    updated = true;
  }
  if (!Array.isArray(parsed.creditAccounts)) {
    parsed.creditAccounts = [
      {
        id: "cari-1",
        customerName: "Ahmet Yılmaz (Yandaki Eczane)",
        customerPhone: "0532 111 22 33",
        companyTitle: "Şifa Eczanesi",
        balance: 0,
        transactions: [],
        updatedAt: new Date().toISOString(),
      },
    ];
    updated = true;
  }
  if (!Array.isArray(parsed.couriers) || parsed.couriers.length === 0) {
    parsed.couriers = [
      "Kurye 1 (Motorlu)",
      "Kurye 2 (Motorlu)",
      "Hızlı Kurye",
    ];
    updated = true;
  }
  if (!parsed.courierPins || typeof parsed.courierPins !== "object") {
    parsed.courierPins = {};
    updated = true;
  }
  parsed.couriers.forEach((cName, idx) => {
    if (!parsed.courierPins![cName]) {
      parsed.courierPins![cName] = String((idx + 1) * 1111).slice(0, 4);
      updated = true;
    }
  });
  if (!Array.isArray(parsed.waiters) || parsed.waiters.length === 0) {
    parsed.waiters = [
      "Garson 1 (Salon)",
      "Garson 2 (Bahçe)",
      "Şef Garson",
    ];
    updated = true;
  }
  if (!parsed.waiterPins || typeof parsed.waiterPins !== "object") {
    parsed.waiterPins = {};
    updated = true;
  }
  parsed.waiters.forEach((wName, idx) => {
    if (!parsed.waiterPins![wName]) {
      parsed.waiterPins![wName] = String((idx + 1) * 1010).slice(0, 4);
      updated = true;
    }
  });
  if (!parsed.defaultDailyStocks || typeof parsed.defaultDailyStocks !== "object") {
    parsed.defaultDailyStocks = {};
    updated = true;
  }
  if (
    !Array.isArray(parsed.enabledOrderTypes) ||
    parsed.enabledOrderTypes.length === 0
  ) {
    parsed.enabledOrderTypes = ["delivery", "pickup", "dine_in"];
    updated = true;
  }
  if (!Array.isArray(parsed.tvDisplayOrderTypes)) {
    parsed.tvDisplayOrderTypes = ["pickup", "dine_in", "delivery"];
    updated = true;
  }
  if (!parsed.tvTickerSpeed) {
    parsed.tvTickerSpeed = "normal";
    updated = true;
  }
  if (parsed.tvCustomNote === undefined) {
    parsed.tvCustomNote = "📶 Ücretsiz Wi-Fi Şifremiz: Lezzet2026 • Afiyet Olsun!";
    updated = true;
  }
  if (!parsed.defaultMenuLayout) {
    parsed.defaultMenuLayout = "grid";
    updated = true;
  }
  if (parsed.showFeaturedCarousel === undefined) {
    parsed.showFeaturedCarousel = true;
    updated = true;
  }
  if (parsed.showRestaurantInfoBar === undefined) {
    parsed.showRestaurantInfoBar = true;
    updated = true;
  }
  if (!Array.isArray(parsed.reservations)) {
    parsed.reservations = [];
    updated = true;
  }
  if (updated) {
    db.prepare("UPDATE settings SET data = ? WHERE id = 1").run(JSON.stringify(parsed));
  }
  parsed.reservations = getReservations();
  return parsed;
}

export function updateSettings(settings: RestaurantSettings): RestaurantSettings {
  const db = getDb();
  db.prepare("UPDATE settings SET data = ? WHERE id = 1").run(JSON.stringify(settings));
  return settings;
}

export function getCategories(): Category[] {
  const db = getDb();
  return db
    .prepare("SELECT id, name, slug, sortOrder, icon FROM categories ORDER BY sortOrder ASC")
    .all() as unknown as Category[];
}

export function createCategory(cat: Omit<Category, "id">): Category {
  const db = getDb();
  const id = `cat-${Date.now()}`;
  db.prepare(
    "INSERT INTO categories (id, name, slug, sortOrder, icon) VALUES (?, ?, ?, ?, ?)"
  ).run(id, cat.name, cat.slug, cat.sortOrder, cat.icon);
  return { id, ...cat };
}

export function deleteCategory(id: string) {
  const db = getDb();
  db.prepare("DELETE FROM categories WHERE id = ?").run(id);
}

export function getMenuItems(): MenuItem[] {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM menu_items").all() as Array<{
    id: string;
    categoryId: string;
    name: string;
    description: string;
    price: number;
    originalPrice?: number | null;
    costPrice?: number | null;
    imageUrl: string;
    available: number;
    popular: number;
    badgesJson?: string | null;
    dailyStock: number | null;
    modifierGroupsJson: string;
  }>;

  return rows.map((r) => {
    let parsedBadges: string[] = [];
    try {
      parsedBadges = JSON.parse(r.badgesJson || "[]");
    } catch {
      parsedBadges = [];
    }
    // Varsayılan zenginleştirme: Henüz etiket atanmamış popüler/kampanya ürünlerine görsel rozet önerisi
    if (parsedBadges.length === 0) {
      const lower = `${r.name} ${r.description}`.toLowerCase();
      if (lower.includes("acılı") || lower.includes("adana") || lower.includes("urfa")) {
        if (lower.includes("adana") || lower.includes("acılı")) parsedBadges.push("spicy");
      }
      if (lower.includes("taş fırın") || lower.includes("odun") || lower.includes("pide") || lower.includes("lahmacun")) {
        parsedBadges.push("wood_fire");
      }
      if (lower.includes("döner") || lower.includes("iskender") || lower.includes("yaprak")) {
        parsedBadges.push("meat_100");
      }
      if (Boolean(r.popular) && parsedBadges.length < 2) {
        parsedBadges.push("chef");
      }
    }

    const origPrice =
      r.originalPrice !== null &&
      r.originalPrice !== undefined &&
      Number(r.originalPrice) > r.price
        ? Number(r.originalPrice)
        : r.categoryId === "cat-kampanya"
        ? Math.round((r.price * 1.18) / 10) * 10
        : undefined;

    return {
      id: r.id,
      categoryId: r.categoryId,
      name: r.name,
      description: r.description,
      price: r.price,
      originalPrice: origPrice,
      costPrice:
        r.costPrice !== null && r.costPrice !== undefined
          ? Number(r.costPrice)
          : 0,
      imageUrl: r.imageUrl,
      available: Boolean(r.available),
      popular: Boolean(r.popular),
      badges: parsedBadges,
      dailyStock:
        r.dailyStock !== null && r.dailyStock !== undefined
          ? Number(r.dailyStock)
          : null,
      modifierGroups: JSON.parse(r.modifierGroupsJson || "[]"),
    };
  });
}

export function saveMenuItem(item: MenuItem): MenuItem {
  const db = getDb();
  const normalizedStock =
    item.dailyStock !== null &&
    item.dailyStock !== undefined &&
    String(item.dailyStock).trim() !== ""
      ? Math.max(0, Math.round(Number(item.dailyStock)))
      : null;
  item.dailyStock = normalizedStock;
  if (normalizedStock !== null && normalizedStock <= 0) {
    item.available = false;
  }
  const normalizedCost = Math.max(0, Number(item.costPrice || 0));
  item.costPrice = normalizedCost;
  const normalizedOrigPrice =
    item.originalPrice !== undefined &&
    item.originalPrice !== null &&
    Number(item.originalPrice) > 0
      ? Number(item.originalPrice)
      : null;
  item.originalPrice = normalizedOrigPrice || undefined;
  const badgesArr = Array.isArray(item.badges) ? item.badges : [];
  item.badges = badgesArr;

  const existing = db.prepare("SELECT id FROM menu_items WHERE id = ?").get(item.id);
  if (existing) {
    db.prepare(`
      UPDATE menu_items
      SET categoryId = ?, name = ?, description = ?, price = ?, originalPrice = ?, costPrice = ?, imageUrl = ?, available = ?, popular = ?, badgesJson = ?, dailyStock = ?, modifierGroupsJson = ?
      WHERE id = ?
    `).run(
      item.categoryId,
      item.name,
      item.description,
      item.price,
      normalizedOrigPrice,
      normalizedCost,
      item.imageUrl,
      item.available ? 1 : 0,
      item.popular ? 1 : 0,
      JSON.stringify(badgesArr),
      normalizedStock,
      JSON.stringify(item.modifierGroups || []),
      item.id
    );
  } else {
    const id = item.id || `item-${Date.now()}`;
    item.id = id;
    db.prepare(`
      INSERT INTO menu_items (id, categoryId, name, description, price, originalPrice, costPrice, imageUrl, available, popular, badgesJson, dailyStock, modifierGroupsJson)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      item.categoryId,
      item.name,
      item.description,
      item.price,
      normalizedOrigPrice,
      normalizedCost,
      item.imageUrl,
      item.available ? 1 : 0,
      item.popular ? 1 : 0,
      JSON.stringify(badgesArr),
      normalizedStock,
      JSON.stringify(item.modifierGroups || [])
    );
  }
  if (normalizedStock !== null && normalizedStock > 0) {
    const s = getSettings();
    s.defaultDailyStocks = {
      ...(s.defaultDailyStocks || {}),
      [item.id]: normalizedStock,
    };
    updateSettings(s);
  }
  return item;
}

/** Tüm menüde veya seçili kategoride toplu yüzdelik/sabit fiyat artışı veya indirimi uygular */
export function bulkUpdateMenuPrices(params: {
  categoryId?: string;
  mode: "percent" | "fixed";
  value: number;
  rounding?: "none" | "nearest_1" | "nearest_5" | "nearest_10";
  includeModifiers?: boolean;
}): MenuItem[] {
  const db = getDb();
  const items = getMenuItems();
  const applyPriceChange = (oldPrice: number, minFloor = 5) => {
    let next =
      params.mode === "percent"
        ? oldPrice * (1 + params.value / 100)
        : oldPrice + params.value;
    next = Math.max(minFloor, next);
    if (params.rounding === "nearest_1") {
      next = Math.round(next);
    } else if (params.rounding === "nearest_5") {
      next = Math.round(next / 5) * 5;
    } else if (params.rounding === "nearest_10") {
      next = Math.round(next / 10) * 10;
    } else {
      next = Math.round(next * 100) / 100;
    }
    return Math.max(minFloor, next);
  };

  for (const item of items) {
    if (
      params.categoryId &&
      params.categoryId !== "all" &&
      item.categoryId !== params.categoryId
    ) {
      continue;
    }
    const newPrice = applyPriceChange(item.price, 5);
    if (params.includeModifiers && item.modifierGroups?.length) {
      const updatedGroups = item.modifierGroups.map((g) => ({
        ...g,
        options: (g.options || []).map((opt) => ({
          ...opt,
          price: opt.price > 0 ? applyPriceChange(opt.price, 1) : opt.price,
          subOptions: opt.subOptions?.map((sub) => ({
            ...sub,
            price: sub.price > 0 ? applyPriceChange(sub.price, 1) : sub.price,
          })),
        })),
      }));
      db.prepare(
        "UPDATE menu_items SET price = ?, modifierGroupsJson = ? WHERE id = ?"
      ).run(newPrice, JSON.stringify(updatedGroups), item.id);
    } else {
      db.prepare("UPDATE menu_items SET price = ? WHERE id = ?").run(
        newPrice,
        item.id
      );
    }
  }
  return getMenuItems();
}

/** Sabah / Vardiya başında günlük sınırlı ürünleri varsayılan porsiyon stoklarına yeniler ve satışa açar */
export function resetDailyMenuStocks(defaultStockAmount = 50): MenuItem[] {
  const db = getDb();
  const s = getSettings();
  const defaults = s.defaultDailyStocks || {};
  const allItems = getMenuItems();

  for (const item of allItems) {
    if (
      item.dailyStock !== null ||
      defaults[item.id] !== undefined ||
      !item.available
    ) {
      const targetStock =
        defaults[item.id] !== undefined
          ? defaults[item.id]
          : item.dailyStock !== null && item.dailyStock !== undefined
          ? Math.max(defaultStockAmount, item.dailyStock)
          : null;
      db.prepare(
        "UPDATE menu_items SET dailyStock = ?, available = 1 WHERE id = ?"
      ).run(targetStock, item.id);
    }
  }
  return getMenuItems();
}

export function deleteMenuItem(id: string) {
  const db = getDb();
  db.prepare("DELETE FROM menu_items WHERE id = ?").run(id);
}

/** Sipariş kalemlerine göre günlük porsiyon stoklarını düşürür veya iade eder */
function adjustMenuStockForItems(items: Order["items"], direction: "decrement" | "restore") {
  const db = getDb();
  for (const ordItem of items) {
    if (!ordItem.menuItemId) continue;
    const row = db
      .prepare("SELECT id, dailyStock, available FROM menu_items WHERE id = ?")
      .get(ordItem.menuItemId) as
      | { id: string; dailyStock: number | null; available: number }
      | undefined;
    if (!row || row.dailyStock === null || row.dailyStock === undefined) continue;

    const qty = Math.max(1, Number(ordItem.quantity || 1));
    if (direction === "decrement") {
      const nextStock = Math.max(0, Number(row.dailyStock) - qty);
      const nextAvail = nextStock <= 0 ? 0 : row.available;
      db.prepare(
        "UPDATE menu_items SET dailyStock = ?, available = ? WHERE id = ?"
      ).run(nextStock, nextAvail, row.id);
    } else {
      const nextStock = Number(row.dailyStock) + qty;
      const nextAvail = nextStock > 0 ? 1 : row.available;
      db.prepare(
        "UPDATE menu_items SET dailyStock = ?, available = ? WHERE id = ?"
      ).run(nextStock, nextAvail, row.id);
    }
  }
}

export function getOrders(): Order[] {
  const db = getDb();
  const rows = db
    .prepare("SELECT * FROM orders ORDER BY createdAt DESC LIMIT 300")
    .all() as Array<{
    id: string;
    orderNumber: number;
    orderType: Order["orderType"];
    status: Order["status"];
    tableNumber: string | null;
    guestCount?: number | null;
    isPriority?: number | null;
    userId: string | null;
    customerName: string;
    customerPhone: string;
    customerAddress: string | null;
    deliveryZoneId: string | null;
    deliveryZoneName: string | null;
    scheduledTime: string | null;
    orderNote: string | null;
    paymentMethod: Order["paymentMethod"];
    splitPaymentJson: string | null;
    subtotal: number;
    discountAmount: number | null;
    couponCode: string | null;
    deliveryFee: number;
    totalAmount: number;
    estimatedMinutes: number | null;
    courierName: string | null;
    rejectReason: string | null;
    loyaltyPointsEarned: number | null;
    loyaltyPointsUsed: number | null;
    rating: number | null;
    reviewText: string | null;
    reviewedAt: string | null;
    itemsJson: string;
    createdAt: string;
    updatedAt: string;
  }>;

  return rows.map((r) => {
    const parsedSplit = r.splitPaymentJson
      ? JSON.parse(r.splitPaymentJson)
      : undefined;
    return {
      id: r.id,
      orderNumber: r.orderNumber,
      orderType: r.orderType,
      status: r.status,
      tableNumber: r.tableNumber || undefined,
      guestCount: r.guestCount ? Number(r.guestCount) : undefined,
      isPriority: Boolean(r.isPriority),
      userId: r.userId || undefined,
      customerName: r.customerName,
      customerPhone: r.customerPhone,
      customerAddress: r.customerAddress || undefined,
      deliveryZoneId: r.deliveryZoneId || undefined,
      deliveryZoneName: r.deliveryZoneName || undefined,
      scheduledTime: r.scheduledTime || undefined,
      orderNote: r.orderNote || undefined,
      paymentMethod: r.paymentMethod,
      splitPaymentInfo: parsedSplit,
      posSyncInfo: parsedSplit?.posSyncInfo,
      subtotal: r.subtotal,
      discountAmount: r.discountAmount || 0,
      couponCode: r.couponCode || undefined,
      deliveryFee: r.deliveryFee,
      totalAmount: r.totalAmount,
      estimatedMinutes: r.estimatedMinutes || undefined,
      courierName: r.courierName || undefined,
      rejectReason: r.rejectReason || undefined,
      loyaltyPointsEarned: r.loyaltyPointsEarned || 0,
      loyaltyPointsUsed: r.loyaltyPointsUsed || 0,
      rating: r.rating || undefined,
      reviewText: r.reviewText || undefined,
      reviewedAt: r.reviewedAt || undefined,
      items: JSON.parse(r.itemsJson || "[]"),
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  });
}

export function getOrdersByCustomer(rawPhone: string, userId?: string): Order[] {
  const normalized = normalizePhone(rawPhone);
  const all = getOrders();
  return all.filter((o) => {
    if (userId && o.userId === userId) return true;
    const oPhone = normalizePhone(o.customerPhone || "");
    return oPhone === normalized && normalized.length >= 10;
  });
}

export function getOrderById(id: string): Order | null {
  const db = getDb();
  const r = db.prepare("SELECT * FROM orders WHERE id = ?").get(id) as {
    id: string;
    orderNumber: number;
    orderType: Order["orderType"];
    status: Order["status"];
    tableNumber: string | null;
    guestCount?: number | null;
    isPriority?: number | null;
    userId: string | null;
    customerName: string;
    customerPhone: string;
    customerAddress: string | null;
    deliveryZoneId: string | null;
    deliveryZoneName: string | null;
    scheduledTime: string | null;
    orderNote: string | null;
    paymentMethod: Order["paymentMethod"];
    splitPaymentJson: string | null;
    subtotal: number;
    discountAmount: number | null;
    couponCode: string | null;
    deliveryFee: number;
    totalAmount: number;
    estimatedMinutes: number | null;
    courierName: string | null;
    rejectReason: string | null;
    loyaltyPointsEarned: number | null;
    loyaltyPointsUsed: number | null;
    rating: number | null;
    reviewText: string | null;
    reviewedAt: string | null;
    itemsJson: string;
    createdAt: string;
    updatedAt: string;
  } | undefined;

  if (!r) return null;
  const parsedSplit = r.splitPaymentJson
    ? JSON.parse(r.splitPaymentJson)
    : undefined;
  return {
    id: r.id,
    orderNumber: r.orderNumber,
    orderType: r.orderType,
    status: r.status,
    tableNumber: r.tableNumber || undefined,
    guestCount: r.guestCount ? Number(r.guestCount) : undefined,
    isPriority: Boolean(r.isPriority),
    userId: r.userId || undefined,
    customerName: r.customerName,
    customerPhone: r.customerPhone,
    customerAddress: r.customerAddress || undefined,
    deliveryZoneId: r.deliveryZoneId || undefined,
    deliveryZoneName: r.deliveryZoneName || undefined,
    scheduledTime: r.scheduledTime || undefined,
    orderNote: r.orderNote || undefined,
    paymentMethod: r.paymentMethod,
    splitPaymentInfo: parsedSplit,
    posSyncInfo: parsedSplit?.posSyncInfo || undefined,
    subtotal: r.subtotal,
    discountAmount: r.discountAmount || 0,
    couponCode: r.couponCode || undefined,
    deliveryFee: r.deliveryFee,
    totalAmount: r.totalAmount,
    estimatedMinutes: r.estimatedMinutes || undefined,
    courierName: r.courierName || undefined,
    rejectReason: r.rejectReason || undefined,
    loyaltyPointsEarned: r.loyaltyPointsEarned || 0,
    loyaltyPointsUsed: r.loyaltyPointsUsed || 0,
    rating: r.rating || undefined,
    reviewText: r.reviewText || undefined,
    reviewedAt: r.reviewedAt || undefined,
    items: JSON.parse(r.itemsJson || "[]"),
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

export function updateOrderPosSyncInfo(
  orderId: string,
  posSyncInfo: NonNullable<Order["posSyncInfo"]>
): Order | null {
  const db = getDb();
  const existing = getOrderById(orderId);
  if (!existing) return null;
  const nextSplit = {
    cashAmount: existing.splitPaymentInfo?.cashAmount || 0,
    cardAmount: existing.splitPaymentInfo?.cardAmount || 0,
    ...existing.splitPaymentInfo,
    posSyncInfo,
  };
  const now = new Date().toISOString();
  db.prepare(`
    UPDATE orders
    SET splitPaymentJson = ?, updatedAt = ?
    WHERE id = ?
  `).run(JSON.stringify(nextSplit), now, orderId);
  return getOrderById(orderId);
}

export function createOrder(
  input: Omit<Order, "id" | "orderNumber" | "status" | "createdAt" | "updatedAt"> & {
    initialStatus?: Order["status"];
  }
): Order {
  const db = getDb();
  const maxRow = db
    .prepare("SELECT MAX(orderNumber) as maxNum FROM orders")
    .get() as { maxNum: number | null };
  const nextOrderNumber = (maxRow?.maxNum || 100) + 1;
  const now = new Date().toISOString();
  const id = `ord-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

  const order: Order = {
    ...input,
    id,
    orderNumber: nextOrderNumber,
    status: input.initialStatus || "pending",
    createdAt: now,
    updatedAt: now,
  };

  db.prepare(`
    INSERT INTO orders (
      id, orderNumber, orderType, status, tableNumber, guestCount, isPriority, userId,
      customerName, customerPhone, customerAddress, deliveryZoneId, deliveryZoneName,
      scheduledTime, orderNote, paymentMethod, splitPaymentJson, subtotal, discountAmount, couponCode,
      deliveryFee, totalAmount, estimatedMinutes, courierName, rejectReason,
      loyaltyPointsEarned, loyaltyPointsUsed,
      itemsJson, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    order.id,
    order.orderNumber,
    order.orderType,
    order.status,
    order.tableNumber || null,
    order.guestCount ? Number(order.guestCount) : null,
    order.isPriority ? 1 : 0,
    order.userId || null,
    order.customerName,
    order.customerPhone,
    order.customerAddress || null,
    order.deliveryZoneId || null,
    order.deliveryZoneName || null,
    order.scheduledTime || null,
    order.orderNote || null,
    order.paymentMethod,
    order.splitPaymentInfo ? JSON.stringify(order.splitPaymentInfo) : null,
    order.subtotal,
    order.discountAmount || 0,
    order.couponCode || null,
    order.deliveryFee,
    order.totalAmount,
    order.estimatedMinutes || null,
    order.courierName || null,
    order.rejectReason || null,
    order.loyaltyPointsEarned || 0,
    order.loyaltyPointsUsed || 0,
    JSON.stringify(order.items),
    order.createdAt,
    order.updatedAt
  );

  // Günlük porsiyon stoklarını düşür
  adjustMenuStockForItems(order.items, "decrement");

  return order;
}

/** Mutfak ekranında siparişi Acil / Öncelikli (VIP) olarak en üste sabitler veya kaldırır */
export function toggleOrderPriority(orderId: string): Order | null {
  const db = getDb();
  const existing = getOrderById(orderId);
  if (!existing) return null;
  const nextPriority = existing.isPriority ? 0 : 1;
  const updatedAt = new Date().toISOString();
  db.prepare("UPDATE orders SET isPriority = ?, updatedAt = ? WHERE id = ?").run(
    nextPriority,
    updatedAt,
    orderId
  );
  return getOrderById(orderId);
}

export function submitOrderReview(
  orderId: string,
  rating: number,
  reviewText?: string
): Order | null {
  const db = getDb();
  const existing = getOrderById(orderId);
  if (!existing) return null;
  const now = new Date().toISOString();
  const cleanRating = Math.min(5, Math.max(1, Math.round(Number(rating) || 5)));

  db.prepare(`
    UPDATE orders
    SET rating = ?, reviewText = ?, reviewedAt = ?, updatedAt = ?
    WHERE id = ?
  `).run(cleanRating, reviewText?.trim() || null, now, now, orderId);

  return getOrderById(orderId);
}

/** Müşterinin henüz hazırlanmakta olan veya bekleyen siparişine sonradan ek not iletmesini sağlar */
export function appendOrderCustomerNote(
  orderId: string,
  additionalNote: string
): Order | null {
  const db = getDb();
  const existing = getOrderById(orderId);
  if (!existing) return null;
  const cleanAdd = additionalNote.trim();
  if (!cleanAdd) return existing;
  const now = new Date().toISOString();
  const nextNote = existing.orderNote
    ? `${existing.orderNote} | 📝 Müşteri Ek Notu: ${cleanAdd}`
    : `📝 Müşteri Notu: ${cleanAdd}`;

  db.prepare(`
    UPDATE orders
    SET orderNote = ?, updatedAt = ?
    WHERE id = ?
  `).run(nextNote, now, orderId);

  return getOrderById(orderId);
}

// --- Masa Rezervasyon Fonksiyonları ---

export function getReservations(rawPhone?: string): TableReservation[] {
  const db = getDb();
  const rows = db
    .prepare("SELECT * FROM reservations ORDER BY createdAt DESC LIMIT 100")
    .all() as unknown as TableReservation[];
  const mapped = rows.map((r) => ({
    ...r,
    guests: r.guestCount ?? r.guests ?? 2,
    date: r.reservationDate || r.date || "",
    time: r.reservationTime || r.time || "",
    notes: r.specialRequests || r.notes || undefined,
    tableNumber: r.assignedTable
      ? String(r.assignedTable).replace(/^Masa\s*/i, "").trim()
      : r.tableNumber || undefined,
  }));
  if (!rawPhone) return mapped;
  const norm = normalizePhone(rawPhone);
  return mapped.filter((r) => normalizePhone(r.customerPhone) === norm);
}

export function createReservation(
  input: Omit<TableReservation, "id" | "reservationNumber" | "status" | "createdAt">
): TableReservation {
  const db = getDb();
  const maxRow = db
    .prepare("SELECT MAX(reservationNumber) as maxNum FROM reservations")
    .get() as { maxNum: number | null };
  const reservationNumber = (maxRow?.maxNum || 500) + 1;
  const id = `res-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const createdAt = new Date().toISOString();

  db.prepare(`
    INSERT INTO reservations (
      id, reservationNumber, customerName, customerPhone,
      guestCount, reservationDate, reservationTime, specialRequests,
      status, createdAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
  `).run(
    id,
    reservationNumber,
    input.customerName,
    input.customerPhone,
    input.guestCount,
    input.reservationDate,
    input.reservationTime,
    input.specialRequests || null,
    createdAt
  );

  return {
    id,
    reservationNumber,
    customerName: input.customerName,
    customerPhone: input.customerPhone,
    guestCount: input.guestCount,
    reservationDate: input.reservationDate,
    reservationTime: input.reservationTime,
    specialRequests: input.specialRequests,
    status: "pending",
    createdAt,
  };
}

export function updateReservationStatus(
  id: string,
  status: TableReservation["status"],
  assignedTable?: string,
  rejectReason?: string
): TableReservation | null {
  const db = getDb();
  db.prepare(`
    UPDATE reservations
    SET status = ?, assignedTable = ?, rejectReason = ?
    WHERE id = ?
  `).run(status, assignedTable || null, rejectReason || null, id);

  const row = db
    .prepare("SELECT * FROM reservations WHERE id = ?")
    .get(id) as unknown as TableReservation | undefined;
  return row || null;
}

// --- Masa Garson Çağrı & Hesap İste Fonksiyonları ---

export function getTableCalls(): TableCall[] {
  const db = getDb();
  return db
    .prepare("SELECT * FROM table_calls WHERE status = 'pending' ORDER BY createdAt DESC")
    .all() as unknown as TableCall[];
}

export function getAllTableCalls(): TableCall[] {
  const db = getDb();
  return db
    .prepare("SELECT * FROM table_calls ORDER BY createdAt DESC LIMIT 100")
    .all() as unknown as TableCall[];
}

export function createTableCall(
  tableNumber: string,
  type: TableCall["type"]
): TableCall {
  const db = getDb();
  const id = `call-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
  const createdAt = new Date().toISOString();
  db.prepare(`
    INSERT INTO table_calls (id, tableNumber, type, status, createdAt)
    VALUES (?, ?, ?, 'pending', ?)
  `).run(id, tableNumber, type, createdAt);
  return { id, tableNumber, type, status: "pending", createdAt };
}

export function resolveTableCall(id: string) {
  const db = getDb();
  if (id === "all") {
    db.prepare("UPDATE table_calls SET status = 'resolved' WHERE status = 'pending'").run();
    return;
  }
  const target = db
    .prepare("SELECT tableNumber, type FROM table_calls WHERE id = ?")
    .get(id) as { tableNumber: string; type: string } | undefined;

  db.prepare("UPDATE table_calls SET status = 'resolved' WHERE id = ?").run(id);
  if (target) {
    db.prepare(
      "UPDATE table_calls SET status = 'resolved' WHERE tableNumber = ? AND type = ? AND status = 'pending'"
    ).run(target.tableNumber, target.type);
  }
}

export function updateOrderStatus(
  id: string,
  status: Order["status"],
  estimatedMinutes?: number,
  rejectReason?: string,
  courierName?: string,
  paymentMethod?: Order["paymentMethod"]
): Order | null {
  const db = getDb();
  const existing = getOrderById(id);
  if (!existing) return null;

  const updatedAt = new Date().toISOString();
  const est = estimatedMinutes !== undefined ? estimatedMinutes : existing.estimatedMinutes;
  const rej = rejectReason !== undefined ? rejectReason : existing.rejectReason;
  const cou = courierName !== undefined ? courierName : existing.courierName;
  const pay = paymentMethod !== undefined ? paymentMethod : existing.paymentMethod;

  // Eğer sipariş iptal/red edildiyse günlük stokları ve kullanılan Para Puanları geri yükle
  if (status === "rejected" && existing.status !== "rejected") {
    adjustMenuStockForItems(existing.items, "restore");
    const usedPts = Number(existing.loyaltyPointsUsed || 0);
    const earnedPts = Number(existing.loyaltyPointsEarned || 0);
    const netRefundDelta = Number((usedPts - earnedPts).toFixed(2));
    if (netRefundDelta !== 0 && existing.customerPhone) {
      adjustUserLoyaltyPoints(existing.customerPhone, netRefundDelta);
    }
  } else if (existing.status === "rejected" && status !== "rejected") {
    adjustMenuStockForItems(existing.items, "decrement");
    const usedPts = Number(existing.loyaltyPointsUsed || 0);
    const earnedPts = Number(existing.loyaltyPointsEarned || 0);
    const netReapplyDelta = Number((earnedPts - usedPts).toFixed(2));
    if (netReapplyDelta !== 0 && existing.customerPhone) {
      adjustUserLoyaltyPoints(existing.customerPhone, netReapplyDelta);
    }
  }

  db.prepare(`
    UPDATE orders
    SET status = ?, estimatedMinutes = ?, courierName = ?, rejectReason = ?, paymentMethod = ?, updatedAt = ?
    WHERE id = ?
  `).run(status, est || null, cou || null, rej || null, pay, updatedAt, id);

  return getOrderById(id);
}

/** Mutfak ekranında usta ürün bazlı "Hazırlandı ✓" tiklemesi */
export function toggleOrderItemPrepared(
  orderId: string,
  itemId: string
): Order | null {
  const db = getDb();
  const existing = getOrderById(orderId);
  if (!existing) return null;

  const updatedItems = existing.items.map((item) => {
    if (itemId === "all") {
      return { ...item, prepared: true };
    }
    if (item.id === itemId) {
      return { ...item, prepared: !item.prepared };
    }
    return item;
  });

  const updatedAt = new Date().toISOString();
  db.prepare(`
    UPDATE orders
    SET itemsJson = ?, updatedAt = ?
    WHERE id = ?
  `).run(JSON.stringify(updatedItems), updatedAt, orderId);

  return getOrderById(orderId);
}

/** Adisyondaki bir ürünü tek tuşla "Müessese İkramı (0 ₺)" yapar veya ikramı geri alır */
export function toggleOrderItemComplimentary(
  orderId: string,
  itemId: string
): Order | null {
  const db = getDb();
  const existing = getOrderById(orderId);
  if (!existing) return null;

  const updatedItems = existing.items.map((item) => {
    if (item.id === itemId) {
      const nextComp = !item.isComplimentary;
      return {
        ...item,
        isComplimentary: nextComp,
        totalPrice: nextComp
          ? 0
          : Number((item.unitPrice * item.quantity).toFixed(2)),
      };
    }
    return item;
  });

  const nextSubtotal = updatedItems.reduce(
    (sum, i) => sum + Number(i.totalPrice || 0),
    0
  );
  const nextTotal = Number(
    Math.max(
      0,
      nextSubtotal -
        (existing.discountAmount || 0) -
        (existing.loyaltyPointsUsed || 0) +
        (existing.deliveryFee || 0)
    ).toFixed(2)
  );
  const updatedAt = new Date().toISOString();

  db.prepare(`
    UPDATE orders
    SET itemsJson = ?, subtotal = ?, totalAmount = ?, updatedAt = ?
    WHERE id = ?
  `).run(
    JSON.stringify(updatedItems),
    nextSubtotal,
    nextTotal,
    updatedAt,
    orderId
  );

  return getOrderById(orderId);
}

/** Açık masa adisyonuna yeni ürünler ekler */
export function appendItemsToOrder(
  orderId: string,
  newItems: Order["items"],
  extraNote?: string,
  extraDiscount = 0,
  extraLoyaltyPointsUsed = 0,
  extraLoyaltyPointsEarned = 0
): Order | null {
  const db = getDb();
  const existing = getOrderById(orderId);
  if (!existing) return null;

  const mergedItems = [...existing.items, ...newItems];
  const addedSubtotal = newItems.reduce(
    (sum, i) => sum + Number(i.totalPrice || 0),
    0
  );
  const nextSubtotal = Number((existing.subtotal + addedSubtotal).toFixed(2));
  const nextDiscount = Number(
    ((existing.discountAmount || 0) + extraDiscount).toFixed(2)
  );
  const nextLoyaltyUsed = Number(
    ((existing.loyaltyPointsUsed || 0) + extraLoyaltyPointsUsed).toFixed(2)
  );
  const nextLoyaltyEarned = Number(
    ((existing.loyaltyPointsEarned || 0) + extraLoyaltyPointsEarned).toFixed(2)
  );
  const nextTotal = Number(
    Math.max(
      0,
      nextSubtotal - nextDiscount - nextLoyaltyUsed + (existing.deliveryFee || 0)
    ).toFixed(2)
  );
  const nextNote = extraNote?.trim()
    ? existing.orderNote
      ? `${existing.orderNote} | Ek: ${extraNote.trim()}`
      : extraNote.trim()
    : existing.orderNote || null;

  // Eğer sipariş 'ready' durumundaysa ve yeni ürün eklendiyse tekrar mutfak hazırlığına ('accepted') çek
  const nextStatus = existing.status === "ready" ? "accepted" : existing.status;

  const updatedAt = new Date().toISOString();
  db.prepare(`
    UPDATE orders
    SET status = ?, itemsJson = ?, subtotal = ?, discountAmount = ?, loyaltyPointsUsed = ?, loyaltyPointsEarned = ?, totalAmount = ?, orderNote = ?, updatedAt = ?
    WHERE id = ?
  `).run(
    nextStatus,
    JSON.stringify(mergedItems),
    nextSubtotal,
    nextDiscount,
    nextLoyaltyUsed,
    nextLoyaltyEarned,
    nextTotal,
    nextNote,
    updatedAt,
    orderId
  );

  adjustMenuStockForItems(newItems, "decrement");

  return getOrderById(orderId);
}

/** Açık adisyondaki bir ürünü iptal eder veya adedini 1 azaltır (stok iadesi ile) */
export function removeItemFromOrder(
  orderId: string,
  itemId: string,
  decrementOnly = false
): Order | null {
  const db = getDb();
  const existing = getOrderById(orderId);
  if (!existing) return null;

  const targetItem = existing.items.find((i) => i.id === itemId);
  if (!targetItem) return existing;

  let nextItems: Order["items"] = [];
  let restoredQty = targetItem.quantity;

  if (decrementOnly && targetItem.quantity > 1) {
    restoredQty = 1;
    const newQty = targetItem.quantity - 1;
    nextItems = existing.items.map((i) =>
      i.id === itemId
        ? {
            ...i,
            quantity: newQty,
            totalPrice: Number((i.unitPrice * newQty).toFixed(2)),
          }
        : i
    );
  } else {
    nextItems = existing.items.filter((i) => i.id !== itemId);
  }

  adjustMenuStockForItems(
    [{ ...targetItem, quantity: restoredQty }],
    "restore"
  );

  const updatedAt = new Date().toISOString();

  if (nextItems.length === 0) {
    if (existing.status !== "rejected" && existing.customerPhone) {
      const usedPts = Number(existing.loyaltyPointsUsed || 0);
      const earnedPts = Number(existing.loyaltyPointsEarned || 0);
      const netRefundDelta = Number((usedPts - earnedPts).toFixed(2));
      if (netRefundDelta !== 0) {
        adjustUserLoyaltyPoints(existing.customerPhone, netRefundDelta);
      }
    }
    db.prepare(`
      UPDATE orders
      SET status = 'rejected', itemsJson = '[]', subtotal = 0, totalAmount = 0, rejectReason = 'Garson tarafından kalemler iptal edildi', updatedAt = ?
      WHERE id = ?
    `).run(updatedAt, orderId);
    return getOrderById(orderId);
  }

  const nextSubtotal = nextItems.reduce(
    (sum, i) => sum + Number(i.totalPrice || 0),
    0
  );
  const nextTotal = Number(
    Math.max(
      0,
      nextSubtotal -
        (existing.discountAmount || 0) -
        (existing.loyaltyPointsUsed || 0) +
        (existing.deliveryFee || 0)
    ).toFixed(2)
  );

  db.prepare(`
    UPDATE orders
    SET itemsJson = ?, subtotal = ?, totalAmount = ?, updatedAt = ?
    WHERE id = ?
  `).run(
    JSON.stringify(nextItems),
    nextSubtotal,
    nextTotal,
    updatedAt,
    orderId
  );

  return getOrderById(orderId);
}

/** Masadaki açık adisyonları başka bir masaya taşır veya dolu masayla birleştirir */
export function transferTableOrders(
  fromTable: string,
  toTable: string
): Order[] {
  const db = getDb();
  const cleanFrom = String(fromTable).trim();
  const cleanTo = String(toTable).trim();
  if (!cleanFrom || !cleanTo || isSameTableName(cleanFrom, cleanTo)) return getOrders();

  const allOrders = getOrders();
  const fromActive = allOrders.filter(
    (o) =>
      o.orderType === "dine_in" &&
      isSameTableName(o.tableNumber, cleanFrom) &&
      (o.status === "pending" || o.status === "accepted" || o.status === "ready")
  );
  if (fromActive.length === 0) return allOrders;

  const toActive = allOrders.filter(
    (o) =>
      o.orderType === "dine_in" &&
      isSameTableName(o.tableNumber, cleanTo) &&
      (o.status === "pending" || o.status === "accepted" || o.status === "ready")
  );

  const now = new Date().toISOString();

  if (toActive.length > 0) {
    // Hedef masada zaten açık adisyon varsa birleştir (Masa Birleştirme)
    const primaryTarget = toActive[0];
    const itemsToAppend = fromActive.flatMap((o) => o.items);
    const addedSub = fromActive.reduce((s, o) => s + o.subtotal, 0);
    const addedDisc = fromActive.reduce(
      (s, o) => s + (o.discountAmount || 0),
      0
    );
    const mergedItems = [...primaryTarget.items, ...itemsToAppend];
    const nextSubtotal = primaryTarget.subtotal + addedSub;
    const nextDiscount = (primaryTarget.discountAmount || 0) + addedDisc;
    const nextTotal = Math.max(0, nextSubtotal - nextDiscount);
    const mergedNote = [
      primaryTarget.orderNote,
      `${formatTableLabel(cleanFrom)} birleştirildi`,
    ]
      .filter(Boolean)
      .join(" • ");

    db.prepare(`
      UPDATE orders
      SET itemsJson = ?, subtotal = ?, discountAmount = ?, totalAmount = ?, orderNote = ?, updatedAt = ?
      WHERE id = ?
    `).run(
      JSON.stringify(mergedItems),
      nextSubtotal,
      nextDiscount,
      nextTotal,
      mergedNote,
      now,
      primaryTarget.id
    );

    for (const oldOrd of fromActive) {
      db.prepare("DELETE FROM orders WHERE id = ?").run(oldOrd.id);
    }
  } else {
    // Hedef masa boşsa doğrudan masa numarasını güncelle (Masa Taşıma)
    for (const ord of fromActive) {
      db.prepare(`
        UPDATE orders
        SET tableNumber = ?, customerName = ?, updatedAt = ?
        WHERE id = ?
      `).run(cleanTo, formatTableLabel(cleanTo), now, ord.id);
    }
  }

  // Bekleyen masa çağrılarını da yeni masaya aktar
  const pendingCalls = getTableCalls();
  for (const call of pendingCalls) {
    if (isSameTableName(call.tableNumber, cleanFrom)) {
      db.prepare("UPDATE table_calls SET tableNumber = ? WHERE id = ?").run(
        cleanTo,
        call.id
      );
    }
  }

  return getOrders();
}

/** Cari / Veresiye hesabına borç veya tahsilat işlemi kaydeder (0 tutarla çağrılırsa sadece yeni cari kart açar) */
export function recordCreditAccountTransaction(params: {
  accountId?: string;
  customerName?: string;
  customerPhone?: string;
  type: "debt" | "payment";
  amount: number;
  description: string;
  orderNumber?: number;
}) {
  const settings = getSettings();
  const accounts = Array.isArray(settings.creditAccounts)
    ? [...settings.creditAccounts]
    : [];
  const now = new Date().toISOString();
  const amt = Math.max(0, Number(params.amount || 0));

  let targetIdx = params.accountId
    ? accounts.findIndex((a) => a.id === params.accountId)
    : -1;

  // Eğer accountId verilmediyse veya bulunamadıysa isim veya telefonla mevcut cari hesabı bul
  if (targetIdx === -1 && params.customerName?.trim()) {
    const cleanName = params.customerName.trim().toLocaleLowerCase("tr-TR");
    const cleanPhone = normalizePhone(params.customerPhone || "");
    targetIdx = accounts.findIndex((a) => {
      if (cleanPhone && cleanPhone.length >= 10 && normalizePhone(a.customerPhone || "") === cleanPhone) {
        return true;
      }
      return a.customerName.trim().toLocaleLowerCase("tr-TR") === cleanName;
    });
  }

  if (targetIdx === -1 && params.customerName?.trim()) {
    const newAcc = {
      id: `cari-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      customerName: params.customerName.trim(),
      customerPhone: params.customerPhone?.trim() || "",
      balance: 0,
      transactions: [],
      updatedAt: now,
    };
    accounts.unshift(newAcc);
    targetIdx = 0;
  }

  if (targetIdx !== -1) {
    const acc = accounts[targetIdx];
    const nextPhone = params.customerPhone?.trim() || acc.customerPhone || "";
    if (amt > 0) {
      const tx = {
        id: `ctx-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        type: params.type,
        amount: amt,
        description: params.description,
        orderNumber: params.orderNumber,
        createdAt: now,
      };
      const nextBalance =
        params.type === "debt"
          ? Number((acc.balance + amt).toFixed(2))
          : Math.max(0, Number((acc.balance - amt).toFixed(2)));
      accounts[targetIdx] = {
        ...acc,
        customerPhone: nextPhone,
        balance: nextBalance,
        transactions: [tx, ...(acc.transactions || [])].slice(0, 100),
        updatedAt: now,
      };
    } else {
      accounts[targetIdx] = {
        ...acc,
        customerPhone: nextPhone,
        updatedAt: now,
      };
    }
    settings.creditAccounts = accounts;
    updateSettings(settings);
  }
  return settings;
}

/** Kuryenin teslim ettiği paket siparişlerin kasa hesaplaşmasını (tahsilat teslimini) onaylar */
export function settleCourierOrders(courierName: string): Order[] {
  const db = getDb();
  const allOrders = getOrders();
  const now = new Date().toISOString();
  const targetOrders = allOrders.filter(
    (o) =>
      o.orderType === "delivery" &&
      o.courierName === courierName &&
      (o.status === "ready" || o.status === "completed") &&
      !o.splitPaymentInfo?.courierSettled
  );

  for (const ord of targetOrders) {
    const nextSplit = {
      cashAmount: ord.splitPaymentInfo?.cashAmount || 0,
      cardAmount: ord.splitPaymentInfo?.cardAmount || 0,
      ...ord.splitPaymentInfo,
      courierSettled: true,
    };
    db.prepare(`
      UPDATE orders
      SET status = 'completed', splitPaymentJson = ?, updatedAt = ?
      WHERE id = ?
    `).run(JSON.stringify(nextSplit), now, ord.id);
  }

  return getOrders();
}

/** Masanın açık adisyonlarını Nakit / Kart / Parçalı (Alman Usulü) / Cari Veresiye ödeme ile kapatır */
export function closeTableOrdersWithPayment(
  tableNumber: string,
  paymentData: {
    paymentMethod: Order["paymentMethod"];
    cashAmount?: number;
    cardAmount?: number;
    discountAmount?: number;
    creditAccountId?: string;
    creditAccountName?: string;
    creditAccountPhone?: string;
  }
): Order[] {
  const db = getDb();
  const cleanTable = String(tableNumber).trim();
  const allOrders = getOrders();
  const tableActive = allOrders.filter(
    (o) =>
      o.orderType === "dine_in" &&
      isSameTableName(o.tableNumber, cleanTable) &&
      (o.status === "pending" || o.status === "accepted" || o.status === "ready")
  );
  if (tableActive.length === 0) return allOrders;

  const now = new Date().toISOString();
  const extraDiscount = Math.max(0, Number(paymentData.discountAmount || 0));
  let totalClosedAmount = 0;

  tableActive.forEach((ord, idx) => {
    const applyDisc = idx === 0 ? (ord.discountAmount || 0) + extraDiscount : ord.discountAmount || 0;
    const nextTotal = Number(
      Math.max(0, ord.subtotal - applyDisc - (ord.loyaltyPointsUsed || 0)).toFixed(2)
    );
    totalClosedAmount += nextTotal;

    const splitObj =
      idx === 0 &&
      ((paymentData.cashAmount !== undefined &&
        paymentData.cardAmount !== undefined &&
        paymentData.cashAmount > 0 &&
        paymentData.cardAmount > 0) ||
        paymentData.paymentMethod === "credit")
        ? {
            cashAmount: Number(paymentData.cashAmount || 0),
            cardAmount: Number(paymentData.cardAmount || 0),
            creditAccountId: paymentData.creditAccountId,
            creditAccountName: paymentData.creditAccountName,
          }
        : ord.splitPaymentInfo;

    const splitInfo = splitObj ? JSON.stringify(splitObj) : null;

    db.prepare(`
      UPDATE orders
      SET status = 'completed', paymentMethod = ?, splitPaymentJson = ?, discountAmount = ?, totalAmount = ?, updatedAt = ?
      WHERE id = ?
    `).run(
      paymentData.paymentMethod,
      splitInfo,
      applyDisc,
      nextTotal,
      now,
      ord.id
    );
  });

  // Eğer Cari / Veresiye seçildiyse otomatik olarak Cari Hesap Defterine borç işle
  if (paymentData.paymentMethod === "credit" && totalClosedAmount > 0) {
    recordCreditAccountTransaction({
      accountId: paymentData.creditAccountId,
      customerName: paymentData.creditAccountName || `${formatTableLabel(cleanTable)} Müşterisi`,
      customerPhone: paymentData.creditAccountPhone,
      type: "debt",
      amount: totalClosedAmount,
      description: `${formatTableLabel(cleanTable)} Adisyon Kapama (#${tableActive[0].orderNumber})`,
      orderNumber: tableActive[0].orderNumber,
    });
  }

  // O masanın bekleyen garson/hesap çağrılarını kapat
  const pendingCalls = getTableCalls();
  for (const call of pendingCalls) {
    if (isSameTableName(call.tableNumber, cleanTable)) {
      db.prepare("UPDATE table_calls SET status = 'resolved' WHERE id = ?").run(
        call.id
      );
    }
  }

  return getOrders();
}

/** Masadan erken kalkan kişinin seçilen ürünlerini tahsil edip adisyondan düşer, kalan ürünleri masada açık bırakır */
export function payPartialTableItems(
  tableNumber: string,
  selectedCompositeKeys: string[],
  paymentMethod: Order["paymentMethod"]
): Order[] {
  const db = getDb();
  const cleanTable = String(tableNumber).trim();
  const keySet = new Set(selectedCompositeKeys);
  if (keySet.size === 0) return getOrders();

  const allOrders = getOrders();
  const tableActive = allOrders.filter(
    (o) =>
      o.orderType === "dine_in" &&
      isSameTableName(o.tableNumber, cleanTable) &&
      (o.status === "pending" || o.status === "accepted" || o.status === "ready")
  );
  if (tableActive.length === 0) return allOrders;

  const paidItems: Order["items"] = [];
  const now = new Date().toISOString();

  for (const ord of tableActive) {
    const remaining: Order["items"] = [];
    for (const item of ord.items) {
      const compKey = `${ord.id}__${item.id}`;
      if (keySet.has(compKey) || keySet.has(item.id)) {
        paidItems.push(item);
      } else {
        remaining.push(item);
      }
    }

    if (remaining.length !== ord.items.length) {
      if (remaining.length === 0) {
        db.prepare("DELETE FROM orders WHERE id = ?").run(ord.id);
      } else {
        const nextSub = remaining.reduce(
          (sum, it) => sum + Number(it.totalPrice || 0),
          0
        );
        const nextTot = Math.max(0, nextSub - (ord.discountAmount || 0));
        db.prepare(`
          UPDATE orders
          SET itemsJson = ?, subtotal = ?, totalAmount = ?, updatedAt = ?
          WHERE id = ?
        `).run(JSON.stringify(remaining), nextSub, nextTot, now, ord.id);
      }
    }
  }

  if (paidItems.length > 0) {
    const paidSubtotal = paidItems.reduce(
      (sum, it) => sum + Number(it.totalPrice || 0),
      0
    );
    const maxRow = db
      .prepare("SELECT MAX(orderNumber) as maxNum FROM orders")
      .get() as { maxNum: number | null };
    const nextOrderNum = (maxRow?.maxNum || 100) + 1;
    const paidOrderId = `ord-partial-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 6)}`;

    db.prepare(`
      INSERT INTO orders (
        id, orderNumber, orderType, status, tableNumber, customerName, customerPhone,
        orderNote, paymentMethod, subtotal, discountAmount, deliveryFee, totalAmount,
        itemsJson, createdAt, updatedAt
      ) VALUES (?, ?, 'dine_in', 'completed', ?, ?, '-', ?, ?, ?, 0, 0, ?, ?, ?, ?)
    `).run(
      paidOrderId,
      nextOrderNum,
      cleanTable,
      `${formatTableLabel(cleanTable)} (Kısmi Tahsilat)`,
      "Masadan kısmi ürün ödemesi alındı",
      paymentMethod,
      paidSubtotal,
      paidSubtotal,
      JSON.stringify(paidItems),
      now,
      now
    );
  }

  return getOrders();
}

// --- WhatsApp OTP & Customer Membership Functions ---

export function createOtpCode(rawPhone: string): { phone: string; code: string } {
  const db = getDb();
  const phone = normalizePhone(rawPhone);
  const code = String(Math.floor(100000 + Math.random() * 900000)); // 6 haneli kod
  const expiresAt = Date.now() + 5 * 60 * 1000; // 5 dakika geçerli

  db.prepare(`
    INSERT INTO otp_codes (phone, code, expiresAt)
    VALUES (?, ?, ?)
    ON CONFLICT(phone) DO UPDATE SET code = excluded.code, expiresAt = excluded.expiresAt
  `).run(phone, code, expiresAt);

  return { phone, code };
}

export function verifyOtpCode(rawPhone: string, code: string): boolean {
  const db = getDb();
  const phone = normalizePhone(rawPhone);
  const row = db
    .prepare("SELECT code, expiresAt FROM otp_codes WHERE phone = ?")
    .get(phone) as { code: string; expiresAt: number } | undefined;

  if (!row) return false;
  if (Date.now() > row.expiresAt) {
    db.prepare("DELETE FROM otp_codes WHERE phone = ?").run(phone);
    return false;
  }
  if (row.code !== code.trim()) return false;

  // Doğrulandıktan sonra tek kullanımlık kodu sil
  db.prepare("DELETE FROM otp_codes WHERE phone = ?").run(phone);
  return true;
}

export function getUserByPhone(rawPhone: string): CustomerUser | null {
  const db = getDb();
  const phone = normalizePhone(rawPhone);
  const row = db
    .prepare("SELECT * FROM users WHERE phone = ?")
    .get(phone) as {
    id: string;
    phone: string;
    name: string;
    addressesJson: string;
    loyaltyPoints: number | null;
    createdAt: string;
    lastLoginAt: string;
  } | undefined;

  if (!row) return null;
  return {
    id: row.id,
    phone: row.phone,
    name: row.name,
    addresses: JSON.parse(row.addressesJson || "[]"),
    loyaltyPoints: Number(row.loyaltyPoints || 0),
    createdAt: row.createdAt,
    lastLoginAt: row.lastLoginAt,
  };
}

export function adjustUserLoyaltyPoints(
  rawPhone: string,
  delta: number,
  fallbackName?: string,
  fallbackAddress?: string,
  exactPoints?: number
): CustomerUser | null {
  const db = getDb();
  const phone = normalizePhone(rawPhone);
  if (!phone) return null;
  let user = getUserByPhone(phone);
  if (!user) {
    user = upsertUserAfterOtp(
      phone,
      fallbackName?.trim() || "Değerli Müşterimiz",
      fallbackAddress?.trim() || undefined
    );
  }
  const targetPoints =
    exactPoints !== undefined && Number.isFinite(exactPoints)
      ? Math.max(0, Math.round(Number(exactPoints) * 100) / 100)
      : Math.max(
          0,
          Math.round(((user.loyaltyPoints || 0) + delta) * 100) / 100
        );
  const prevMs = user.lastLoginAt ? Date.parse(user.lastLoginAt) : 0;
  const now = new Date(
    Math.max(Date.now(), (Number.isFinite(prevMs) ? prevMs : 0) + 1)
  ).toISOString();
  db.prepare(
    "UPDATE users SET loyaltyPoints = ?, lastLoginAt = ? WHERE phone = ?"
  ).run(targetPoints, now, phone);
  return getUserByPhone(phone);
}

export function upsertUserAfterOtp(
  rawPhone: string,
  name?: string,
  newAddress?: string
): CustomerUser {
  const db = getDb();
  const phone = normalizePhone(rawPhone);
  const existing = getUserByPhone(phone);
  const prevMs = existing?.lastLoginAt ? Date.parse(existing.lastLoginAt) : 0;
  const now = new Date(
    Math.max(Date.now(), (Number.isFinite(prevMs) ? prevMs : 0) + 1)
  ).toISOString();

  if (existing) {
    const updatedName = name?.trim() ? name.trim() : existing.name;
    const addresses: SavedAddress[] = [...existing.addresses];
    if (
      newAddress?.trim() &&
      !addresses.some((a) => a.fullAddress === newAddress.trim())
    ) {
      addresses.unshift({
        id: `addr-${Date.now()}`,
        title: addresses.length === 0 ? "Ev Adresim" : `Adres ${addresses.length + 1}`,
        fullAddress: newAddress.trim(),
      });
    }

    db.prepare(`
      UPDATE users
      SET name = ?, addressesJson = ?, lastLoginAt = ?
      WHERE phone = ?
    `).run(updatedName, JSON.stringify(addresses), now, phone);

    return getUserByPhone(phone)!;
  } else {
    const id = `usr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const addresses: SavedAddress[] = newAddress?.trim()
      ? [
          {
            id: `addr-${Date.now()}`,
            title: "Ev Adresim",
            fullAddress: newAddress.trim(),
          },
        ]
      : [];

    db.prepare(`
      INSERT INTO users (id, phone, name, addressesJson, loyaltyPoints, createdAt, lastLoginAt)
      VALUES (?, ?, ?, ?, 0, ?, ?)
    `).run(
      id,
      phone,
      name?.trim() || "Değerli Müşterimiz",
      JSON.stringify(addresses),
      now,
      now
    );

    return getUserByPhone(phone)!;
  }
}

export function updateUserAddresses(
  rawPhone: string,
  name: string,
  addresses: SavedAddress[]
): CustomerUser | null {
  const db = getDb();
  const phone = normalizePhone(rawPhone);
  const existing = getUserByPhone(phone);
  const prevMs = existing?.lastLoginAt ? Date.parse(existing.lastLoginAt) : 0;
  const now = new Date(
    Math.max(Date.now(), (Number.isFinite(prevMs) ? prevMs : 0) + 1)
  ).toISOString();

  if (existing) {
    db.prepare(`
      UPDATE users
      SET name = ?, addressesJson = ?, lastLoginAt = ?
      WHERE phone = ?
    `).run(
      name?.trim() || existing.name,
      JSON.stringify(addresses || []),
      now,
      phone
    );
  } else {
    const id = `usr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    db.prepare(`
      INSERT INTO users (id, phone, name, addressesJson, loyaltyPoints, createdAt, lastLoginAt)
      VALUES (?, ?, ?, ?, 0, ?, ?)
    `).run(
      id,
      phone,
      name?.trim() || "Değerli Müşterimiz",
      JSON.stringify(addresses || []),
      now,
      now
    );
  }
  return getUserByPhone(phone);
}

export function getAllUsers(): CustomerUser[] {
  const db = getDb();
  const rows = db
    .prepare("SELECT * FROM users ORDER BY lastLoginAt DESC")
    .all() as Array<{
    id: string;
    phone: string;
    name: string;
    addressesJson: string;
    loyaltyPoints: number | null;
    createdAt: string;
    lastLoginAt: string;
  }>;

  return rows.map((r) => ({
    id: r.id,
    phone: r.phone,
    name: r.name,
    addresses: JSON.parse(r.addressesJson || "[]"),
    loyaltyPoints: Number(r.loyaltyPoints || 0),
    createdAt: r.createdAt,
    lastLoginAt: r.lastLoginAt,
  }));
}

export function logWhatsAppMessage(
  phone: string,
  message: string,
  type: WhatsAppLog["type"],
  status: WhatsAppLog["status"]
): WhatsAppLog {
  const db = getDb();
  const id = `wa-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const createdAt = new Date().toISOString();
  db.prepare(`
    INSERT INTO whatsapp_logs (id, phone, message, type, status, createdAt)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, phone, message, type, status, createdAt);

  return { id, phone, message, type, status, createdAt };
}

export function getWhatsAppLogs(): WhatsAppLog[] {
  const db = getDb();
  return db
    .prepare("SELECT * FROM whatsapp_logs ORDER BY createdAt DESC LIMIT 50")
    .all() as unknown as WhatsAppLog[];
}

// --- Bulut (Turso SQLite) <-> Yerel SQLite Senkronizasyon Yardımcıları ---

export function getActiveOtpCodes(): Array<{
  phone: string;
  code: string;
  expiresAt: number;
}> {
  const db = getDb();
  return db
    .prepare("SELECT phone, code, expiresAt FROM otp_codes WHERE expiresAt > ?")
    .all(Date.now()) as Array<{ phone: string; code: string; expiresAt: number }>;
}

export function mergeCatalogFromCloud(payload: {
  settings?: RestaurantSettings;
  categories?: Category[];
  menuItems?: MenuItem[];
}) {
  const db = getDb();
  if (payload.settings) {
    const localSettings = getSettings();
    const merged: RestaurantSettings = {
      ...payload.settings,
      securityConfig:
        payload.settings.securityConfig || localSettings.securityConfig,
      cloudSyncConfig:
        localSettings.cloudSyncConfig || payload.settings.cloudSyncConfig,
      posIntegrationConfig:
        localSettings.posIntegrationConfig ||
        payload.settings.posIntegrationConfig,
    };
    db.prepare("UPDATE settings SET data = ? WHERE id = 1").run(
      JSON.stringify(merged)
    );
  }
  if (payload.categories && payload.categories.length > 0) {
    db.prepare("DELETE FROM categories").run();
    const stmt = db.prepare(
      "INSERT INTO categories (id, name, slug, sortOrder, icon) VALUES (?, ?, ?, ?, ?)"
    );
    for (const c of payload.categories) {
      stmt.run(c.id, c.name, c.slug, c.sortOrder, c.icon);
    }
  }
  if (payload.menuItems && payload.menuItems.length > 0) {
    db.prepare("DELETE FROM menu_items").run();
    const stmt = db.prepare(`
      INSERT INTO menu_items (id, categoryId, name, description, price, imageUrl, available, popular, dailyStock, modifierGroupsJson)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const item of payload.menuItems) {
      stmt.run(
        item.id,
        item.categoryId,
        item.name,
        item.description,
        item.price,
        item.imageUrl,
        item.available ? 1 : 0,
        item.popular ? 1 : 0,
        item.dailyStock !== undefined && item.dailyStock !== null
          ? Number(item.dailyStock)
          : null,
        JSON.stringify(item.modifierGroups || [])
      );
    }
  }
  ensureCampaignCategoryAndItems(db);
}

export function mergeActivityFromCloud(payload: {
  orders?: Order[];
  reservations?: TableReservation[];
  tableCalls?: TableCall[];
  users?: CustomerUser[];
  otpCodes?: Array<{ phone: string; code: string; expiresAt: number }>;
  whatsappLogs?: WhatsAppLog[];
}) {
  const db = getDb();

  if (payload.orders) {
    const existingRows = db
      .prepare("SELECT id, splitPaymentJson FROM orders")
      .all() as Array<{ id: string; splitPaymentJson: string | null }>;
    const existingSplitMap = new Map<string, string | null>();
    for (const row of existingRows) {
      existingSplitMap.set(row.id, row.splitPaymentJson);
    }

    const upsertOrder = db.prepare(`
      INSERT INTO orders (
        id, orderNumber, orderType, status, tableNumber, userId,
        customerName, customerPhone, customerAddress, deliveryZoneId, deliveryZoneName,
        scheduledTime, orderNote, paymentMethod, splitPaymentJson, subtotal, discountAmount, couponCode,
        deliveryFee, totalAmount, estimatedMinutes, courierName, rejectReason,
        loyaltyPointsEarned, loyaltyPointsUsed, rating, reviewText, reviewedAt,
        itemsJson, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        status = CASE WHEN excluded.updatedAt >= orders.updatedAt THEN excluded.status ELSE orders.status END,
        tableNumber = CASE WHEN excluded.updatedAt >= orders.updatedAt THEN excluded.tableNumber ELSE orders.tableNumber END,
        customerName = CASE WHEN excluded.updatedAt >= orders.updatedAt THEN excluded.customerName ELSE orders.customerName END,
        orderNote = CASE WHEN excluded.updatedAt >= orders.updatedAt THEN excluded.orderNote ELSE orders.orderNote END,
        paymentMethod = CASE WHEN excluded.updatedAt >= orders.updatedAt THEN excluded.paymentMethod ELSE orders.paymentMethod END,
        splitPaymentJson = COALESCE(excluded.splitPaymentJson, orders.splitPaymentJson),
        subtotal = CASE WHEN excluded.updatedAt >= orders.updatedAt THEN excluded.subtotal ELSE orders.subtotal END,
        discountAmount = CASE WHEN excluded.updatedAt >= orders.updatedAt THEN excluded.discountAmount ELSE orders.discountAmount END,
        totalAmount = CASE WHEN excluded.updatedAt >= orders.updatedAt THEN excluded.totalAmount ELSE orders.totalAmount END,
        itemsJson = CASE WHEN excluded.updatedAt >= orders.updatedAt THEN excluded.itemsJson ELSE orders.itemsJson END,
        estimatedMinutes = COALESCE(excluded.estimatedMinutes, orders.estimatedMinutes),
        courierName = COALESCE(excluded.courierName, orders.courierName),
        rejectReason = COALESCE(excluded.rejectReason, orders.rejectReason),
        rating = COALESCE(excluded.rating, orders.rating),
        reviewText = COALESCE(excluded.reviewText, orders.reviewText),
        reviewedAt = COALESCE(excluded.reviewedAt, orders.reviewedAt),
        updatedAt = CASE WHEN excluded.updatedAt >= orders.updatedAt THEN excluded.updatedAt ELSE orders.updatedAt END
    `);
    for (const o of payload.orders) {
      let localPosSyncInfo = undefined;
      const localSplitRaw = existingSplitMap.get(o.id);
      if (localSplitRaw) {
        try {
          localPosSyncInfo = JSON.parse(localSplitRaw)?.posSyncInfo;
        } catch {
          // ignore
        }
      }
      const mergedPosSync =
        localPosSyncInfo?.status === "synced"
          ? localPosSyncInfo
          : o.posSyncInfo || o.splitPaymentInfo?.posSyncInfo || localPosSyncInfo;
      const mergedSplit =
        o.splitPaymentInfo || mergedPosSync
          ? {
              cashAmount: o.splitPaymentInfo?.cashAmount || 0,
              cardAmount: o.splitPaymentInfo?.cardAmount || 0,
              ...(o.splitPaymentInfo || {}),
              ...(mergedPosSync ? { posSyncInfo: mergedPosSync } : {}),
            }
          : null;

      upsertOrder.run(
        o.id,
        o.orderNumber,
        o.orderType,
        o.status,
        o.tableNumber || null,
        o.userId || null,
        o.customerName,
        o.customerPhone,
        o.customerAddress || null,
        o.deliveryZoneId || null,
        o.deliveryZoneName || null,
        o.scheduledTime || null,
        o.orderNote || null,
        o.paymentMethod,
        mergedSplit ? JSON.stringify(mergedSplit) : null,
        o.subtotal,
        o.discountAmount || 0,
        o.couponCode || null,
        o.deliveryFee,
        o.totalAmount,
        o.estimatedMinutes || null,
        o.courierName || null,
        o.rejectReason || null,
        o.loyaltyPointsEarned || 0,
        o.loyaltyPointsUsed || 0,
        o.rating || null,
        o.reviewText || null,
        o.reviewedAt || null,
        JSON.stringify(o.items || []),
        o.createdAt,
        o.updatedAt
      );
    }
  }

  if (payload.reservations) {
    const upsertRes = db.prepare(`
      INSERT INTO reservations (
        id, reservationNumber, customerName, customerPhone,
        guestCount, reservationDate, reservationTime, specialRequests,
        assignedTable, status, rejectReason, createdAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        status = CASE WHEN reservations.status != 'pending' AND excluded.status = 'pending' THEN reservations.status ELSE excluded.status END,
        assignedTable = COALESCE(excluded.assignedTable, reservations.assignedTable),
        rejectReason = COALESCE(excluded.rejectReason, reservations.rejectReason)
    `);
    for (const r of payload.reservations) {
      upsertRes.run(
        r.id,
        r.reservationNumber || 501,
        r.customerName,
        r.customerPhone,
        r.guestCount,
        r.reservationDate,
        r.reservationTime,
        r.specialRequests || null,
        r.assignedTable || null,
        r.status,
        r.rejectReason || null,
        r.createdAt
      );
    }
  }

  if (payload.tableCalls) {
    const upsertCall = db.prepare(`
      INSERT INTO table_calls (id, tableNumber, type, status, createdAt)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        status = CASE WHEN table_calls.status = 'resolved' OR excluded.status = 'resolved' THEN 'resolved' ELSE excluded.status END
    `);
    for (const c of payload.tableCalls) {
      upsertCall.run(c.id, c.tableNumber, c.type, c.status, c.createdAt);
    }
  }

  if (payload.users) {
    const upsertUser = db.prepare(`
      INSERT INTO users (id, phone, name, addressesJson, loyaltyPoints, createdAt, lastLoginAt)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(phone) DO UPDATE SET
        name = CASE WHEN excluded.lastLoginAt > COALESCE(users.lastLoginAt, '') THEN excluded.name ELSE users.name END,
        addressesJson = CASE WHEN excluded.lastLoginAt > COALESCE(users.lastLoginAt, '') THEN excluded.addressesJson ELSE users.addressesJson END,
        loyaltyPoints = CASE WHEN excluded.lastLoginAt > COALESCE(users.lastLoginAt, '') THEN excluded.loyaltyPoints ELSE users.loyaltyPoints END,
        lastLoginAt = CASE WHEN excluded.lastLoginAt > COALESCE(users.lastLoginAt, '') THEN excluded.lastLoginAt ELSE users.lastLoginAt END
    `);
    for (const u of payload.users) {
      upsertUser.run(
        u.id,
        u.phone,
        u.name,
        JSON.stringify(u.addresses || []),
        Number(u.loyaltyPoints || 0),
        u.createdAt,
        u.lastLoginAt
      );
    }
  }

  if (payload.otpCodes) {
    const upsertOtp = db.prepare(`
      INSERT INTO otp_codes (phone, code, expiresAt)
      VALUES (?, ?, ?)
      ON CONFLICT(phone) DO UPDATE SET
        code = excluded.code,
        expiresAt = excluded.expiresAt
    `);
    for (const otp of payload.otpCodes) {
      upsertOtp.run(otp.phone, otp.code, otp.expiresAt);
    }
  }

  if (payload.whatsappLogs) {
    const upsertWaLog = db.prepare(`
      INSERT INTO whatsapp_logs (id, phone, message, type, status, createdAt)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        status = CASE WHEN whatsapp_logs.status = 'sent' OR excluded.status = 'sent' THEN 'sent' ELSE excluded.status END
    `);
    for (const log of payload.whatsappLogs) {
      upsertWaLog.run(
        log.id,
        log.phone,
        log.message,
        log.type,
        log.status,
        log.createdAt
      );
    }
  }
}

export function exportFullBackup() {
  return {
    version: "v8",
    exportedAt: new Date().toISOString(),
    settings: getSettings(),
    categories: getCategories(),
    menuItems: getMenuItems(),
    orders: getOrders(),
    reservations: getReservations(),
    users: getAllUsers(),
  };
}

export function importFullBackup(backup: {
  settings?: RestaurantSettings;
  categories?: Category[];
  menuItems?: MenuItem[];
  orders?: Order[];
  reservations?: TableReservation[];
  users?: CustomerUser[];
}) {
  mergeCatalogFromCloud({
    settings: backup.settings,
    categories: backup.categories,
    menuItems: backup.menuItems,
  });
  mergeActivityFromCloud({
    orders: backup.orders,
    reservations: backup.reservations,
    users: backup.users,
  });
}


