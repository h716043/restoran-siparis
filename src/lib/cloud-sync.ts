import {
  getActiveOtpCodes,
  getAllUsers,
  getCategories,
  getMenuItems,
  getOrders,
  getReservations,
  getSettings,
  getTableCalls,
  mergeActivityFromCloud,
  mergeCatalogFromCloud,
} from "@/lib/db";

function resolveTursoCredentials(): {
  endpoint: string;
  token: string;
} | null {
  const settings = getSettings();
  const rawUrl = (
    process.env.TURSO_DATABASE_URL ||
    settings.cloudSyncConfig?.tursoUrl ||
    ""
  ).trim();
  const token = (
    process.env.TURSO_AUTH_TOKEN ||
    settings.cloudSyncConfig?.tursoAuthToken ||
    ""
  ).trim();

  const isEnabled =
    Boolean(process.env.TURSO_DATABASE_URL && process.env.TURSO_AUTH_TOKEN) ||
    Boolean(settings.cloudSyncConfig?.enabled && rawUrl && token);

  if (!isEnabled || !rawUrl || !token) return null;

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

/**
 * Sipariş, rezervasyon, masa çağrısı veya WhatsApp üyelik verilerini bulutla eşitler.
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
      tableCalls: getTableCalls(),
      users: getAllUsers(),
      otpCodes: getActiveOtpCodes(),
    });

    await executeTursoStatements([
      {
        sql: `INSERT INTO restoran_cloud_store (k, v, updatedAt) VALUES ('activity', ?, ?)
              ON CONFLICT(k) DO UPDATE SET v = excluded.v, updatedAt = excluded.updatedAt`,
        args: [mergedPayload, new Date().toISOString()],
      },
    ]);
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
