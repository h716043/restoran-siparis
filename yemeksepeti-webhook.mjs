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

function sanitizeTableName(remoteId) {
  const clean =
    String(remoteId || "genel")
      .replace(/[^a-zA-Z0-9_]/g, "_")
      .replace(/^_+|_+$/g, "")
      .toLowerCase() || "genel";
  return `yemeksepeti_siparis_${clean}`;
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

  // Yemeksepeti (Delivery Hero Middleware) Sipariş Karşılama Ucu:
  // POST /order/{remoteId} veya POST /v2/order/{remoteId} veya POST /yemeksepeti/{remoteId}
  if (
    req.method === "POST" &&
    (req.url?.startsWith("/order/") ||
      req.url?.startsWith("/v2/order/") ||
      req.url?.startsWith("/yemeksepeti/"))
  ) {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", async () => {
      try {
        const cleanUrl = (req.url || "").split("?")[0];
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

        const baseUrl = YS_TURSO_URL.trim()
          .replace(/^libsql:\/\//i, "https://")
          .replace(/^wss:\/\//i, "https://")
          .replace(/\/+$/, "");

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
                    { type: "text", value: rawRemoteId },
                    { type: "text", value: orderCode },
                    { type: "text", value: body },
                    { type: "text", value: nowIso },
                  ],
                },
              },
              { type: "close" },
            ],
          }),
        });

        console.log(
          `[YEMEKSEPETI] Yeni siparis alindi -> Tablo: ${tableName}, Kod: ${orderCode}`
        );

        res.writeHead(202, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            remoteOrderId: `ys_${orderId}`,
            status: "order_accepted",
            tursoTable: tableName,
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
      service: "YildizhanPOS - Yemeksepeti Cloud Webhook Server",
      tursoDb: "yemeksepeti-musteri-h716043",
      endpoint: "/order/{remoteId}",
    })
  );
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(
    `[YildizhanPOS Yemeksepeti Webhook] Port ${PORT} uzerinde calisiyor...`
  );
});
