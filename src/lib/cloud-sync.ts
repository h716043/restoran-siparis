import {
  getActiveOtpCodes,
  getAllTableCalls,
  getAllUsers,
  getCategories,
  getMenuItems,
  getOrders,
  getReservations,
  getSettings,
  getWhatsAppLogs,
  mergeActivityFromCloud,
  mergeCatalogFromCloud,
} from "@/lib/db";

const DEFAULT_TURSO_URL =
  "libsql://restoran-siparis-h716043.aws-eu-west-1.turso.io";
const DEFAULT_TURSO_TOKEN =
  "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3OTIwMjk4NTksImlkIjoiMDFhMTNkNGQtMTIwMS03MjBmLWJiM2EtMzQwMmMzOTJiMmJiIiwia2lkIjoicU5MRDQ0b2tMUmMzYUVXU1BfUVhTQzk1RUFfLUUzUS1MZmhOVkFKY215ZyIsInJpZCI6ImQwNjhlMzJjLTMzOWYtNDcyZi04NWE5LTZiMDljNzdkNDA5MSJ9.loMcw0-7YNgjdnkq7LW78c4dmIRRobd4eeISokLfSwyAP_QMGRjDi8LKctOWpRPlSwgXdy__t5u8f2ir3_b_Bw";

function resolveTursoCredentials(): {
  endpoint: string;
  token: string;
} | null {
  const settings = getSettings();
  const isNewFirma = process.env.IS_NEW_FIRMA_PACKAGE === "true";
  const rawUrl = (
    process.env.TURSO_DATABASE_URL ||
    settings.cloudSyncConfig?.tursoUrl ||
    (isNewFirma ? "" : DEFAULT_TURSO_URL)
  ).trim();
  const token = (
    process.env.TURSO_AUTH_TOKEN ||
    settings.cloudSyncConfig?.tursoAuthToken ||
    (isNewFirma ? "" : DEFAULT_TURSO_TOKEN)
  ).trim();

  // Eğer yerel ayarlarda açıkça devre dışı bırakılmışsa (enabled === false) ve Netlify'da değilsek kullanma
  const isNetlify =
    process.env.NETLIFY === "true" ||
    process.env.NEXT_PUBLIC_CUSTOMER_ONLY === "true";
  const explicitlyDisabled =
    !isNetlify &&
    settings.cloudSyncConfig !== undefined &&
    settings.cloudSyncConfig.enabled === false;

  if (explicitlyDisabled || !rawUrl || !token) return null;

  const baseHttps = rawUrl
    .replace(/^libsql:\/\//i, "https://")
    .replace(/^wss:\/\//i, "https://")
    .replace(/\/+$/, "");

  return {
    endpoint: `${baseHttps}/v2/pipeline`,
    token,
  };
}

async function executeTursoStatements(
  statements: Array<{ sql: string; args?: string[] }>
) {
  const creds = resolveTursoCredentials();
  if (!creds) return null;

  const requests = [
    ...statements.map((s) => ({
      type: "execute",
      stmt: {
        sql: s.sql,
        args: (s.args || []).map((val) => ({ type: "text", value: val })),
      },
    })),
    { type: "close" },
  ];

  const res = await fetch(creds.endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${creds.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ requests }),
    cache: "no-store",
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Turso HTTP Hatası (${res.status}): ${errText}`);
  }

  return res.json();
}

export async function ensureCloudTable() {
  await executeTursoStatements([
    {
      sql: "CREATE TABLE IF NOT EXISTS restoran_cloud_store (k TEXT PRIMARY KEY, v TEXT NOT NULL, updatedAt TEXT NOT NULL)",
    },
  ]);
}

/**
 * Yerel Admin panelinde menü, kategori, kupon veya dükkan ayarları değiştiğinde
 * buluta (Turso) gönderir. Böylece Netlify'daki müşteri sayfası anında güncellenir.
 */
export async function pushCatalogToCloud(): Promise<boolean> {
  try {
    if (!resolveTursoCredentials()) return false;
    await ensureCloudTable();

    const settings = getSettings();
    const categories = getCategories();
    const menuItems = getMenuItems();

    const catalogPayload = JSON.stringify({
      settings: {
        ...settings,
        securityConfig: undefined,
        cloudSyncConfig: undefined,
        posIntegrationConfig: undefined,
      },
      categories,
      menuItems,
    });

    await executeTursoStatements([
      {
        sql: `INSERT INTO restoran_cloud_store (k, v, updatedAt) VALUES ('catalog', ?, ?)
              ON CONFLICT(k) DO UPDATE SET v = excluded.v, updatedAt = excluded.updatedAt`,
        args: [catalogPayload, new Date().toISOString()],
      },
    ]);
    return true;
  } catch (e) {
    console.error("pushCatalogToCloud error:", e);
    return false;
  }
}

/**
 * Netlify müşteri sayfası açıldığında buluttaki güncel menü ve dükkan ayarlarını çeker.
 */
export async function pullCatalogFromCloud(): Promise<boolean> {
  try {
    if (!resolveTursoCredentials()) return false;
    const data = await executeTursoStatements([
      {
        sql: "SELECT v FROM restoran_cloud_store WHERE k = 'catalog'",
      },
    ]);
    const row = data?.results?.[0]?.response?.result?.rows?.[0];
    const jsonStr = row?.[0]?.value;
    if (!jsonStr) return false;

    const parsed = JSON.parse(jsonStr);
    mergeCatalogFromCloud(parsed);
    return true;
  } catch (e) {
    console.error("pullCatalogFromCloud error:", e);
    return false;
  }
}

let inFlightPull: Promise<boolean> | null = null;
let lastPullTime = 0;

/**
 * Sadece OKUMA (GET) isteklerinde kullanılır: Buluttaki yeni siparişleri, rezervasyonları,
 * masa çağrılarını, OTP kodlarını ve WhatsApp loglarını yerel SQLite'a çeker (bulutu ezmez!).
 */
export async function pullActivityFromCloud(force = false): Promise<boolean> {
  if (!force && Date.now() - lastPullTime < 1200) {
    return true;
  }
  if (inFlightPull) {
    return inFlightPull;
  }

  inFlightPull = (async () => {
    try {
      if (!resolveTursoCredentials()) return false;
      const data = await executeTursoStatements([
        {
          sql: "SELECT v FROM restoran_cloud_store WHERE k = 'activity'",
        },
      ]);
      const row = data?.results?.[0]?.response?.result?.rows?.[0];
      const jsonStr = row?.[0]?.value;
      if (jsonStr) {
        const cloudActivity = JSON.parse(jsonStr);
        mergeActivityFromCloud(cloudActivity);
      }
      lastPullTime = Date.now();
      return true;
    } catch (e) {
      console.error("pullActivityFromCloud error:", e);
      return false;
    } finally {
      inFlightPull = null;
    }
  })();

  return inFlightPull;
}

/**
 * YAZMA (POST / PATCH / DELETE) isteklerinde kullanılır:
 * Önce buluttaki mevcut sipariş/rezervasyon/çağrı/OTP/WhatsApp verilerini çekip yerelle birleştirir,
 * ardından birleşmiş güncel durumu buluta yazar.
 */
export async function syncActivityWithCloud(): Promise<boolean> {
  try {
    if (!resolveTursoCredentials()) return false;
    await ensureCloudTable();

    // 1. Önce buluttaki mevcut sipariş/rezervasyon/çağrı verilerini çekip yerelle birleştir
    const data = await executeTursoStatements([
      {
        sql: "SELECT v FROM restoran_cloud_store WHERE k = 'activity'",
      },
    ]);
    const row = data?.results?.[0]?.response?.result?.rows?.[0];
    const jsonStr = row?.[0]?.value;
    if (jsonStr) {
      const cloudActivity = JSON.parse(jsonStr);
      mergeActivityFromCloud(cloudActivity);
    }

    // 2. Birleşmiş güncel durumu tekrar buluta yaz
    const mergedPayload = JSON.stringify({
      orders: getOrders(),
      reservations: getReservations(),
      tableCalls: getAllTableCalls(),
      users: getAllUsers(),
      otpCodes: getActiveOtpCodes(),
      whatsappLogs: getWhatsAppLogs(),
    });

    await executeTursoStatements([
      {
        sql: `INSERT INTO restoran_cloud_store (k, v, updatedAt) VALUES ('activity', ?, ?)
              ON CONFLICT(k) DO UPDATE SET v = excluded.v, updatedAt = excluded.updatedAt`,
        args: [mergedPayload, new Date().toISOString()],
      },
    ]);
    lastPullTime = Date.now();
    return true;
  } catch (e) {
    console.error("syncActivityWithCloud error:", e);
    return false;
  }
}

export async function testAndSyncCloudConnection(): Promise<{
  ok: boolean;
  message: string;
}> {
  try {
    const creds = resolveTursoCredentials();
    if (!creds) {
      return {
        ok: false,
        message:
          "Lütfen önce Turso Veritabanı URL ve Auth Token bilgilerini girip 'Aktif' kutucuğunu işaretleyin.",
      };
    }
    await ensureCloudTable();
    await pushCatalogToCloud();
    await syncActivityWithCloud();
    return {
      ok: true,
      message:
        "Bulut veritabanı (Turso) bağlantısı başarılı! Tüm menü, kategoriler, ayarlar ve siparişler bulutla senkronize edildi.",
    };
  } catch (err) {
    return {
      ok: false,
      message:
        err instanceof Error
          ? err.message
          : "Bulut veritabanına bağlanırken hata oluştu.",
    };
  }
}
