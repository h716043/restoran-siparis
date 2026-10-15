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
} from "@/types";

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
  schemaMigratedV6?: boolean;
};

export function getDb(): DatabaseSync {
  if (!globalForDb.sqliteDb) {
    const db = new DatabaseSync(DB_PATH);
    db.exec("PRAGMA journal_mode = WAL;");
    initSchema(db);
    globalForDb.sqliteDb = db;
    globalForDb.schemaMigratedV6 = true;
  } else if (!globalForDb.schemaMigratedV6) {
    initSchema(globalForDb.sqliteDb);
    globalForDb.schemaMigratedV6 = true;
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
      subtotal REAL NOT NULL,
      discountAmount REAL DEFAULT 0,
      couponCode TEXT,
      deliveryFee REAL NOT NULL,
      totalAmount REAL NOT NULL,
      estimatedMinutes INTEGER,
      rejectReason TEXT,
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

  // Ensure new columns exist on orders table
  const alterCols = [
    "ALTER TABLE orders ADD COLUMN userId TEXT;",
    "ALTER TABLE orders ADD COLUMN deliveryZoneId TEXT;",
    "ALTER TABLE orders ADD COLUMN deliveryZoneName TEXT;",
    "ALTER TABLE orders ADD COLUMN scheduledTime TEXT;",
    "ALTER TABLE orders ADD COLUMN discountAmount REAL DEFAULT 0;",
    "ALTER TABLE orders ADD COLUMN couponCode TEXT;",
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
    if (parsed.firstOrderDiscountPercent === undefined) {
      parsed.firstOrderDiscountPercent = 10;
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
    announcementBar: {
      enabled: true,
      badgeText: "🔥 GÜNÜN FIRSATI",
      text: "Tüm ızgara menülerde ücretsiz Yayık Ayran! • 350 ₺ üzeri siparişlerde MERHABA50 koduyla 50 ₺ indirim",
      couponCodeToApply: "MERHABA50",
      theme: "orange",
    },
    deliveryZones: DEFAULT_ZONES,
    coupons: DEFAULT_COUPONS,
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
  if (updated) {
    db.prepare("UPDATE settings SET data = ? WHERE id = 1").run(JSON.stringify(parsed));
  }
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
    imageUrl: string;
    available: number;
    popular: number;
    modifierGroupsJson: string;
  }>;

  return rows.map((r) => ({
    id: r.id,
    categoryId: r.categoryId,
    name: r.name,
    description: r.description,
    price: r.price,
    imageUrl: r.imageUrl,
    available: Boolean(r.available),
    popular: Boolean(r.popular),
    modifierGroups: JSON.parse(r.modifierGroupsJson || "[]"),
  }));
}

export function saveMenuItem(item: MenuItem): MenuItem {
  const db = getDb();
  const existing = db.prepare("SELECT id FROM menu_items WHERE id = ?").get(item.id);
  if (existing) {
    db.prepare(`
      UPDATE menu_items
      SET categoryId = ?, name = ?, description = ?, price = ?, imageUrl = ?, available = ?, popular = ?, modifierGroupsJson = ?
      WHERE id = ?
    `).run(
      item.categoryId,
      item.name,
      item.description,
      item.price,
      item.imageUrl,
      item.available ? 1 : 0,
      item.popular ? 1 : 0,
      JSON.stringify(item.modifierGroups || []),
      item.id
    );
  } else {
    const id = item.id || `item-${Date.now()}`;
    item.id = id;
    db.prepare(`
      INSERT INTO menu_items (id, categoryId, name, description, price, imageUrl, available, popular, modifierGroupsJson)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      item.categoryId,
      item.name,
      item.description,
      item.price,
      item.imageUrl,
      item.available ? 1 : 0,
      item.popular ? 1 : 0,
      JSON.stringify(item.modifierGroups || [])
    );
  }
  return item;
}

export function deleteMenuItem(id: string) {
  const db = getDb();
  db.prepare("DELETE FROM menu_items WHERE id = ?").run(id);
}

export function getOrders(): Order[] {
  const db = getDb();
  const rows = db
    .prepare("SELECT * FROM orders ORDER BY createdAt DESC LIMIT 200")
    .all() as Array<{
    id: string;
    orderNumber: number;
    orderType: Order["orderType"];
    status: Order["status"];
    tableNumber: string | null;
    userId: string | null;
    customerName: string;
    customerPhone: string;
    customerAddress: string | null;
    deliveryZoneId: string | null;
    deliveryZoneName: string | null;
    scheduledTime: string | null;
    orderNote: string | null;
    paymentMethod: Order["paymentMethod"];
    subtotal: number;
    discountAmount: number | null;
    couponCode: string | null;
    deliveryFee: number;
    totalAmount: number;
    estimatedMinutes: number | null;
    rejectReason: string | null;
    itemsJson: string;
    createdAt: string;
    updatedAt: string;
  }>;

  return rows.map((r) => ({
    id: r.id,
    orderNumber: r.orderNumber,
    orderType: r.orderType,
    status: r.status,
    tableNumber: r.tableNumber || undefined,
    userId: r.userId || undefined,
    customerName: r.customerName,
    customerPhone: r.customerPhone,
    customerAddress: r.customerAddress || undefined,
    deliveryZoneId: r.deliveryZoneId || undefined,
    deliveryZoneName: r.deliveryZoneName || undefined,
    scheduledTime: r.scheduledTime || undefined,
    orderNote: r.orderNote || undefined,
    paymentMethod: r.paymentMethod,
    subtotal: r.subtotal,
    discountAmount: r.discountAmount || 0,
    couponCode: r.couponCode || undefined,
    deliveryFee: r.deliveryFee,
    totalAmount: r.totalAmount,
    estimatedMinutes: r.estimatedMinutes || undefined,
    rejectReason: r.rejectReason || undefined,
    items: JSON.parse(r.itemsJson || "[]"),
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }));
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
    userId: string | null;
    customerName: string;
    customerPhone: string;
    customerAddress: string | null;
    deliveryZoneId: string | null;
    deliveryZoneName: string | null;
    scheduledTime: string | null;
    orderNote: string | null;
    paymentMethod: Order["paymentMethod"];
    subtotal: number;
    discountAmount: number | null;
    couponCode: string | null;
    deliveryFee: number;
    totalAmount: number;
    estimatedMinutes: number | null;
    rejectReason: string | null;
    itemsJson: string;
    createdAt: string;
    updatedAt: string;
  } | undefined;

  if (!r) return null;
  return {
    id: r.id,
    orderNumber: r.orderNumber,
    orderType: r.orderType,
    status: r.status,
    tableNumber: r.tableNumber || undefined,
    userId: r.userId || undefined,
    customerName: r.customerName,
    customerPhone: r.customerPhone,
    customerAddress: r.customerAddress || undefined,
    deliveryZoneId: r.deliveryZoneId || undefined,
    deliveryZoneName: r.deliveryZoneName || undefined,
    scheduledTime: r.scheduledTime || undefined,
    orderNote: r.orderNote || undefined,
    paymentMethod: r.paymentMethod,
    subtotal: r.subtotal,
    discountAmount: r.discountAmount || 0,
    couponCode: r.couponCode || undefined,
    deliveryFee: r.deliveryFee,
    totalAmount: r.totalAmount,
    estimatedMinutes: r.estimatedMinutes || undefined,
    rejectReason: r.rejectReason || undefined,
    items: JSON.parse(r.itemsJson || "[]"),
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

export function createOrder(
  input: Omit<Order, "id" | "orderNumber" | "status" | "createdAt" | "updatedAt">
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
    status: "pending",
    createdAt: now,
    updatedAt: now,
  };

  db.prepare(`
    INSERT INTO orders (
      id, orderNumber, orderType, status, tableNumber, userId,
      customerName, customerPhone, customerAddress, deliveryZoneId, deliveryZoneName,
      scheduledTime, orderNote, paymentMethod, subtotal, discountAmount, couponCode,
      deliveryFee, totalAmount, estimatedMinutes, rejectReason,
      itemsJson, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    order.id,
    order.orderNumber,
    order.orderType,
    order.status,
    order.tableNumber || null,
    order.userId || null,
    order.customerName,
    order.customerPhone,
    order.customerAddress || null,
    order.deliveryZoneId || null,
    order.deliveryZoneName || null,
    order.scheduledTime || null,
    order.orderNote || null,
    order.paymentMethod,
    order.subtotal,
    order.discountAmount || 0,
    order.couponCode || null,
    order.deliveryFee,
    order.totalAmount,
    order.estimatedMinutes || null,
    order.rejectReason || null,
    JSON.stringify(order.items),
    order.createdAt,
    order.updatedAt
  );

  return order;
}

// --- Masa Rezervasyon Fonksiyonları ---

export function getReservations(rawPhone?: string): TableReservation[] {
  const db = getDb();
  const rows = db
    .prepare("SELECT * FROM reservations ORDER BY createdAt DESC LIMIT 100")
    .all() as unknown as TableReservation[];
  if (!rawPhone) return rows;
  const norm = normalizePhone(rawPhone);
  return rows.filter((r) => normalizePhone(r.customerPhone) === norm);
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
  db.prepare("UPDATE table_calls SET status = 'resolved' WHERE id = ?").run(id);
}

export function updateOrderStatus(
  id: string,
  status: Order["status"],
  estimatedMinutes?: number,
  rejectReason?: string
): Order | null {
  const db = getDb();
  const existing = getOrderById(id);
  if (!existing) return null;

  const updatedAt = new Date().toISOString();
  const est = estimatedMinutes !== undefined ? estimatedMinutes : existing.estimatedMinutes;
  const rej = rejectReason !== undefined ? rejectReason : existing.rejectReason;

  db.prepare(`
    UPDATE orders
    SET status = ?, estimatedMinutes = ?, rejectReason = ?, updatedAt = ?
    WHERE id = ?
  `).run(status, est || null, rej || null, updatedAt, id);

  return getOrderById(id);
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
    createdAt: string;
    lastLoginAt: string;
  } | undefined;

  if (!row) return null;
  return {
    id: row.id,
    phone: row.phone,
    name: row.name,
    addresses: JSON.parse(row.addressesJson || "[]"),
    createdAt: row.createdAt,
    lastLoginAt: row.lastLoginAt,
  };
}

export function upsertUserAfterOtp(
  rawPhone: string,
  name?: string,
  newAddress?: string
): CustomerUser {
  const db = getDb();
  const phone = normalizePhone(rawPhone);
  const existing = getUserByPhone(phone);
  const now = new Date().toISOString();

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
      INSERT INTO users (id, phone, name, addressesJson, createdAt, lastLoginAt)
      VALUES (?, ?, ?, ?, ?, ?)
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
  db.prepare(`
    UPDATE users SET name = ?, addressesJson = ? WHERE phone = ?
  `).run(name, JSON.stringify(addresses), phone);
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
    createdAt: string;
    lastLoginAt: string;
  }>;

  return rows.map((r) => ({
    id: r.id,
    phone: r.phone,
    name: r.name,
    addresses: JSON.parse(r.addressesJson || "[]"),
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
      INSERT INTO menu_items (id, categoryId, name, description, price, imageUrl, available, popular, modifierGroupsJson)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        JSON.stringify(item.modifierGroups || [])
      );
    }
  }
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
    const upsertOrder = db.prepare(`
      INSERT INTO orders (
        id, orderNumber, orderType, status, tableNumber, userId,
        customerName, customerPhone, customerAddress, deliveryZoneId, deliveryZoneName,
        scheduledTime, orderNote, paymentMethod, subtotal, discountAmount, couponCode,
        deliveryFee, totalAmount, estimatedMinutes, rejectReason,
        itemsJson, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        status = CASE WHEN excluded.updatedAt >= orders.updatedAt THEN excluded.status ELSE orders.status END,
        estimatedMinutes = COALESCE(excluded.estimatedMinutes, orders.estimatedMinutes),
        rejectReason = COALESCE(excluded.rejectReason, orders.rejectReason),
        updatedAt = CASE WHEN excluded.updatedAt >= orders.updatedAt THEN excluded.updatedAt ELSE orders.updatedAt END
    `);
    for (const o of payload.orders) {
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
        o.subtotal,
        o.discountAmount || 0,
        o.couponCode || null,
        o.deliveryFee,
        o.totalAmount,
        o.estimatedMinutes || null,
        o.rejectReason || null,
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
        status = excluded.status,
        assignedTable = COALESCE(excluded.assignedTable, reservations.assignedTable),
        rejectReason = COALESCE(excluded.rejectReason, reservations.rejectReason)
    `);
    for (const r of payload.reservations) {
      upsertRes.run(
        r.id,
        r.reservationNumber,
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
      ON CONFLICT(id) DO UPDATE SET status = excluded.status
    `);
    for (const c of payload.tableCalls) {
      upsertCall.run(c.id, c.tableNumber, c.type, c.status, c.createdAt);
    }
  }

  if (payload.users) {
    const upsertUser = db.prepare(`
      INSERT INTO users (id, phone, name, addressesJson, createdAt, lastLoginAt)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(phone) DO UPDATE SET
        name = excluded.name,
        addressesJson = excluded.addressesJson,
        lastLoginAt = excluded.lastLoginAt
    `);
    for (const u of payload.users) {
      upsertUser.run(
        u.id,
        u.phone,
        u.name,
        JSON.stringify(u.addresses || []),
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

