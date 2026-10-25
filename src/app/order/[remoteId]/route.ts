import { NextRequest, NextResponse } from "next/server";

const YS_TURSO_URL =
  process.env.YS_TURSO_DATABASE_URL ||
  "https://yemeksepeti-musteri-h716043.aws-eu-west-1.turso.io";

const YS_TURSO_TOKEN =
  process.env.YS_TURSO_AUTH_TOKEN ||
  "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3OTI5NTA5MzIsImlkIjoiMDFhMTc0MzMtYjMwMS03YTIwLWI0ZjUtOTM4NDA0NmUxNDA0Iiwia2lkIjoicU5MRDQ0b2tMUmMzYUVXU1BfUVhTQzk1RUFfLUUzUS1MZmhOVkFKY215ZyIsInJpZCI6ImJlNzA5NTc3LWM3N2QtNGIyYi04YTZkLTE4Y2M5MWNlNzM4OSJ9.rWpp8aV0HJd5kKNwJB60Ofz4-b1dXF8DeVbhjwQCp9Aml4W-pQGLiMN5pN9fSnpHEFOJPi_FCUz9ocRoSdXlCw";

function sanitizeTableName(remoteId: string): string {
  const clean =
    (remoteId || "genel")
      .replace(/[^a-zA-Z0-9_]/g, "_")
      .replace(/^_+|_+$/g, "")
      .toLowerCase() || "genel";
  return `yemeksepeti_siparis_${clean}`;
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ remoteId: string }> }
) {
  try {
    const { remoteId } = await context.params;
    const rawBody = await req.text();
    const tableName = sanitizeTableName(remoteId);

    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      // keep rawBody
    }

    const orderObj = (parsed.ysOrderData as Record<string, unknown>) || parsed;
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
                { type: "text", value: remoteId },
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

    return NextResponse.json(
      {
        remoteOrderId: `ys_${orderId}`,
        status: "order_accepted",
        tursoTable: tableName,
      },
      { status: 202 }
    );
  } catch (err) {
    return NextResponse.json(
      { error: String(err) },
      { status: 500 }
    );
  }
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ remoteId: string }> }
) {
  const { remoteId } = await context.params;
  return NextResponse.json({
    ok: true,
    service: "YildizhanPOS Yemeksepeti Webhook Endpoint",
    remoteId,
    tursoTable: sanitizeTableName(remoteId),
  });
}
