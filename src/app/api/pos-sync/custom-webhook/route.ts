import { NextRequest, NextResponse } from "next/server";
import { getOrders } from "@/lib/db";
import {
  applyCustomPosOrderStatusUpdate,
  buildCustomPosOrderPayload,
  getResolvedCustomPosConfig,
} from "@/lib/custom-pos";

/**
 * GET /api/pos-sync/custom-webhook
 * NarPOS, Kerzz POS veya PosEntegra gibi "Pull (Sipariş Çekme)" yöntemiyle çalışan
 * sistemlerin sitedeki yeni siparişleri JSON formatında çekebilmesi için uç nokta.
 */
export async function GET(req: NextRequest) {
  try {
    const cfg = getResolvedCustomPosConfig();
    const headerSecret =
      req.headers.get("x-webhook-secret") ||
      req.headers.get("x-api-key") ||
      req.headers
        .get("authorization")
        ?.replace(/^Bearer\s+/i, "")
        .trim() ||
      "";

    if (
      cfg.webhookSecret &&
      headerSecret &&
      headerSecret !== cfg.webhookSecret &&
      headerSecret !== cfg.apiKey
    ) {
      return NextResponse.json(
        { ok: false, error: "Geçersiz API / Webhook Anahtarı" },
        { status: 401 }
      );
    }

    const filterStatus = req.nextUrl.searchParams.get("status") || "all";
    const limit = Math.min(
      Number(req.nextUrl.searchParams.get("limit") || 50),
      200
    );

    const allOrders = getOrders();
    const filtered = allOrders
      .filter((o) => {
        if (filterStatus === "new" || filterStatus === "pending") {
          return o.status === "pending" || o.status === "accepted";
        }
        return true;
      })
      .slice(0, limit)
      .map((o) => buildCustomPosOrderPayload(o, cfg));

    return NextResponse.json({
      ok: true,
      provider: cfg.systemPreset,
      branchId: cfg.branchId || "SUBE-01",
      count: filtered.length,
      orders: filtered,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        message:
          err instanceof Error
            ? err.message
            : "Sipariş listesi çekilirken hata oluştu.",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/pos-sync/custom-webhook
 * NarPOS, Kerzz POS veya Özel API sistemlerinden gelen anlık:
 * - Kurye ataması (`courierName`, `status: "ON_WAY"` / `"Yolda"`)
 * - Teslimat tamamlandı (`status: "DELIVERED"` / `"Teslim Edildi"`)
 * bildirimlerini alır ve sitedeki siparişi (ve Turso bulutu) otomatik günceller.
 */
export async function POST(request: Request) {
  try {
    const cfg = getResolvedCustomPosConfig();
    const headerSecret =
      request.headers.get("x-webhook-secret") ||
      request.headers.get("x-api-key") ||
      request.headers
        .get("authorization")
        ?.replace(/^Bearer\s+/i, "")
        .trim() ||
      "";

    const body = (await request.json().catch(() => ({}))) as {
      orderId?: string;
      externalOrderId?: string;
      orderNumber?: number | string;
      externalTicketId?: string;
      posOrderId?: string;
      courierName?: string;
      courier?: { name?: string };
      status?: string;
    };

    if (
      cfg.webhookSecret &&
      headerSecret &&
      headerSecret !== cfg.webhookSecret &&
      headerSecret !== cfg.apiKey
    ) {
      return NextResponse.json(
        { ok: false, error: "Geçersiz Webhook Güvenlik Anahtarı" },
        { status: 401 }
      );
    }

    const result = applyCustomPosOrderStatusUpdate({
      orderId: body.orderId || body.externalOrderId,
      orderNumber: body.orderNumber ? Number(body.orderNumber) : undefined,
      externalTicketId: body.externalTicketId || body.posOrderId,
      courierName: body.courierName || body.courier?.name,
      status: body.status,
    });

    return NextResponse.json(result, { status: result.ok ? 200 : 404 });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        message:
          err instanceof Error
            ? err.message
            : "NarPOS / Kerzz / Özel Webhook işlenirken hata oluştu.",
      },
      { status: 500 }
    );
  }
}
