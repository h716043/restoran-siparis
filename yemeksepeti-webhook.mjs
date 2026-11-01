import http from "node:http";

const PORT = Number(process.env.PORT || 3001);

const YS_TURSO_URL =
  process.env.YS_TURSO_DATABASE_URL ||
  process.env.TURSO_DATABASE_URL ||
  "https://yemeksepeti-musteri-h716043.aws-eu-west-1.turso.io";

const YS_TURSO_TOKEN =
  process.env.YS_TURSO_AUTH_TOKEN ||
  process.env.TURSO_AUTH_TOKEN ||
  "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3OTI5NTA5MzIsImlkIjoiMDFhMTc0MzMtYjMwMS03YTIwLWI0ZjUtOTM4NDA0NmUxNDA0Iiwia2lkIjoicU5MRDQ0b2tMUmMzYUVXU1BfUVhTQzk1RUFfLUUzUS1MZmhOVkFKY215ZyIsInJpZCI6ImJlNzA5NTc3LWM3N2QtNGIyYi04YTZkLTE4Y2M5MWNlNzM4OSJ9.rWpp8aV0HJd5kKNwJB60Ofz4-b1dXF8DeVbhjwQCp9Aml4W-pQGLiMN5pN9fSnpHEFOJPi_FCUz9ocRoSdXlCw";

// Katman 1: Render Anlık RAM Kuyruğu (remoteKey -> Map<orderId, orderRecord>)
const ordersByRemoteId = new Map();

function normalizeRemoteKey(remoteId) {
  return (
    String(remoteId || "genel")
      .replace(/[^a-zA-Z0-9_]/g, "_")
      .replace(/^_+|_+$/g, "")
      .toLowerCase() || "genel"
  );
}

function sanitizeTableName(remoteId) {
  return `yemeksepeti_siparis_${normalizeRemoteKey(remoteId)}`;
}

function getTursoBaseHttpsUrl() {
  return YS_TURSO_URL.trim()
    .replace(/^libsql:\/\//i, "https://")
    .replace(/^wss:\/\//i, "https://")
    .replace(/\/+$/, "");
}

function saveOrderToMemory(remoteId, orderId, orderCode, rawJson, createdAt) {
  const key = normalizeRemoteKey(remoteId);
  if (!ordersByRemoteId.has(key)) {
    ordersByRemoteId.set(key, new Map());
  }
  const storeMap = ordersByRemoteId.get(key);
  storeMap.set(orderId, {
    orderId,
    remoteId: String(remoteId || key),
    orderCode,
    rawJson,
    isRead: false,
    createdAt,
    readAt: null,
  });

  // Bellek şişmesini önlemek için mağaza başına son 200 siparişi tut
  if (storeMap.size > 200) {
    const oldestKey = storeMap.keys().next().value;
    if (oldestKey) storeMap.delete(oldestKey);
  }
}

async function saveOrderToTurso(tableName, orderId, rawRemoteId, orderCode, rawBody, nowIso) {
  const baseUrl = getTursoBaseHttpsUrl();
  await fetch(`${baseUrl}/v2/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${YS_TURSO_TOKEN.trim()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      requests: [
        {
          type: "execute",
          stmt: {
            sql: `CREATE TABLE IF NOT EXISTS ${tableName} (order_id TEXT PRIMARY KEY, remote_id TEXT NOT NULL, order_code TEXT, raw_json TEXT NOT NULL, is_read INTEGER DEFAULT 0, created_at TEXT NOT NULL, read_at TEXT)`,
          },
        },
        {
          type: "execute",
          stmt: {
            sql: `INSERT INTO ${tableName} (order_id, remote_id, order_code, raw_json, is_read, created_at) VALUES (?, ?, ?, ?, 0, ?) ON CONFLICT(order_id) DO UPDATE SET raw_json = excluded.raw_json, is_read = 0`,
            args: [
              { type: "text", value: orderId },
              { type: "text", value: String(rawRemoteId) },
              { type: "text", value: orderCode },
              { type: "text", value: rawBody },
              { type: "text", value: nowIso },
            ],
          },
        },
        { type: "close" },
      ],
    }),
  });
}

async function markOrderReadInTurso(tableName, orderId, nowIso) {
  const baseUrl = getTursoBaseHttpsUrl();
  await fetch(`${baseUrl}/v2/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${YS_TURSO_TOKEN.trim()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      requests: [
        {
          type: "execute",
          stmt: {
            sql: `UPDATE ${tableName} SET is_read = 1, read_at = ? WHERE order_id = ?`,
            args: [
              { type: "text", value: nowIso },
              { type: "text", value: String(orderId) },
            ],
          },
        },
        { type: "close" },
      ],
    }),
  });
}

const server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const cleanUrl = (req.url || "/").split("?")[0];

  // 1) Yemeksepeti Sipariş Karşılama (Hem Render RAM Kuyruğuna + Hem Turso DB'ye Yedekli Yazar)
  // POST /order/{remoteId} veya POST /v2/order/{remoteId} veya POST /yemeksepeti/{remoteId}
  if (
    req.method === "POST" &&
    (cleanUrl.startsWith("/order/") ||
      cleanUrl.startsWith("/v2/order/") ||
      cleanUrl.startsWith("/yemeksepeti/"))
  ) {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", async () => {
      try {
        const parts = cleanUrl.split("/").filter(Boolean);
        const rawRemoteId = parts[parts.length - 1] || "genel";
        const tableName = sanitizeTableName(rawRemoteId);

        let parsed = {};
        try {
          parsed = JSON.parse(body);
        } catch {}

        const orderObj = parsed.ysOrderData || parsed;
        const orderId = String(
          orderObj.token ||
            orderObj.code ||
            `ys_${Date.now()}_${Math.floor(Math.random() * 900 + 100)}`
        );
        const orderCode = String(orderObj.code || orderId);
        const nowIso = new Date().toISOString();

        // Katman 1: Anında Render RAM Kuyruğuna Yaz
        saveOrderToMemory(rawRemoteId, orderId, orderCode, body, nowIso);

        // Katman 2: Aynı Anda Turso Kalıcı Veritabanına Yaz
        let tursoSaved = false;
        try {
          await saveOrderToTurso(tableName, orderId, rawRemoteId, orderCode, body, nowIso);
          tursoSaved = true;
        } catch (tursoErr) {
          console.warn(`[TURSO YEDEK UYARISI - Render RAM aktif]: ${tursoErr}`);
        }

        console.log(
          `[YEMEKSEPETI] Yeni siparis alindi -> Magaza: ${rawRemoteId}, Kod: ${orderCode} (RenderRAM: OK, TursoDB: ${tursoSaved ? "OK" : "FALLBACK"})`
        );

        res.writeHead(202, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            remoteOrderId: `ys_${orderId}`,
            status: "order_accepted",
            renderQueue: normalizeRemoteKey(rawRemoteId),
            tursoTable: tableName,
            tursoSaved,
          })
        );
      } catch (err) {
        console.error("[YEMEKSEPETI HATA]", err);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: String(err) }));
      }
    });
    return;
  }

  // 2) POS Uygulamasının Render RAM Kuyruğundan Canlı Sipariş Çekmesi:
  // GET /orders/{remoteId}
  if (req.method === "GET" && cleanUrl.startsWith("/orders/")) {
    const parts = cleanUrl.split("/").filter(Boolean);
    const rawRemoteId = parts[parts.length - 1] || "genel";
    const key = normalizeRemoteKey(rawRemoteId);
    const storeMap = ordersByRemoteId.get(key);

    const unreadOrders = [];
    if (storeMap) {
      for (const item of storeMap.values()) {
        if (!item.isRead) {
          unreadOrders.push({
            orderId: item.orderId,
            orderCode: item.orderCode,
            rawJson: item.rawJson,
            createdAt: item.createdAt,
          });
        }
      }
    }

    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    res.end(
      JSON.stringify({
        ok: true,
        remoteId: rawRemoteId,
        count: unreadOrders.length,
        orders: unreadOrders,
      })
    );
    return;
  }

  // 3) POS Uygulamasının Siparişi Okundu İşaretlemesi (Hem Render RAM + Hem Turso DB):
  // POST /orders/{remoteId}/ack  veya  POST /orders/ack
  if (req.method === "POST" && cleanUrl.startsWith("/orders/") && cleanUrl.endsWith("/ack")) {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", async () => {
      try {
        const parts = cleanUrl.split("/").filter(Boolean);
        const routeRemoteId = parts.length >= 3 ? parts[1] : "genel";
        let parsed = {};
        try {
          parsed = JSON.parse(body);
        } catch {}

        const rawRemoteId = parsed.remoteId || routeRemoteId || "genel";
        const orderId = String(parsed.orderId || "").trim();
        const key = normalizeRemoteKey(rawRemoteId);
        const nowIso = new Date().toISOString();

        if (orderId && ordersByRemoteId.has(key)) {
          const rec = ordersByRemoteId.get(key).get(orderId);
          if (rec) {
            rec.isRead = true;
            rec.readAt = nowIso;
          }
        }

        if (orderId) {
          try {
            await markOrderReadInTurso(sanitizeTableName(rawRemoteId), orderId, nowIso);
          } catch {}
        }

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true, orderId, remoteId: rawRemoteId }));
      } catch (err) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: String(err) }));
      }
    });
    return;
  }

  // Katalog / Menü veya Mağaza Durum Sorguları için 200 OK karşılama
  if (req.method === "POST" || req.method === "PUT") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok" }));
    return;
  }

  // GET / veya GET /status (Sağlık Kontrolü)
  res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
  res.end(
    JSON.stringify({
      ok: true,
      mode: "HYBRID_RENDER_AND_TURSO",
      service: "YildizhanPOS - Yemeksepeti Cloud Webhook Server (Render + Turso Redundant)",
      tursoDb: "yemeksepeti-musteri-h716043",
      endpoints: {
        webhookPush: "POST /order/{remoteId}",
        livePoll: "GET /orders/{remoteId}",
        ackOrder: "POST /orders/{remoteId}/ack",
      },
    })
  );
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(
    `[YildizhanPOS Yemeksepeti Hybrid Webhook] Port ${PORT} uzerinde calisiyor (Render RAM + Turso DB Yedekli)...`
  );
});
