import { NextResponse } from "next/server";
import {
  applyAdisyoOrderStatusUpdate,
  getResolvedAdisyoConfig,
} from "@/lib/adisyo";

/**
 * POST /api/pos-sync/adisyo-webhook
 * Adisyo Bulut POS veya Kurye POS sistemlerinden gelen anlık:
 * - Kurye ataması (`courierName`, `status: "ON_WAY"` / `"Yolda"`)
 * - Teslimat tamamlandı (`status: "DELIVERED"` / `"Teslim Edildi"` / `"COMPLETED"`)
 * bildirimlerini alır ve sitedeki siparişi (ve Turso bulutu) otomatik günceller.
 */
export async function POST(request: Request) {
  try {
    const cfg = getResolvedAdisyoConfig();
    const headerSecret =
      request.headers.get("x-webhook-secret") ||
      request.headers.get("x-api-secret") ||
      "";

    const body = (await request.json().catch(() => ({}))) as {
      secret?: string;
      orderId?: string;
      externalOrderId?: string;
      orderNumber?: number | string;
      externalTicketId?: string;
      adisyoOrderId?: string;
      courierName?: string;
      courier?: { name?: string };
      status?: string;
    };

    // Eğer webhookSecret tanımlıysa ve dışarıdan yanlış secret gönderildiyse kontrol et
    if (
      cfg.webhookSecret &&
      headerSecret &&
      headerSecret !== cfg.webhookSecret &&
      headerSecret !== cfg.apiSecret
    ) {
      return NextResponse.json(
        { ok: false, error: "Geçersiz Webhook Güvenlik Anahtarı" },
        { status: 401 }
      );
    }

    const result = applyAdisyoOrderStatusUpdate({
      orderId: body.orderId || body.externalOrderId,
      orderNumber: body.orderNumber ? Number(body.orderNumber) : undefined,
      externalTicketId: body.externalTicketId || body.adisyoOrderId,
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
            : "Adisyo Webhook işlenirken hata oluştu.",
      },
      { status: 500 }
    );
  }
}
