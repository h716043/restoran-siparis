import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { getAllUsers, getOrders, normalizePhone } from "@/lib/db";
import { CallerIdIncomingEvent } from "@/types";

const DATA_DIR = path.join(process.cwd(), "data");
const CALLER_ID_FILE = path.join(DATA_DIR, "caller_id_events.json");

function readEvents(): CallerIdIncomingEvent[] {
  try {
    if (!fs.existsSync(CALLER_ID_FILE)) return [];
    const raw = fs.readFileSync(CALLER_ID_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeEvents(events: CallerIdIncomingEvent[]): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(
      CALLER_ID_FILE,
      JSON.stringify(events.slice(0, 60), null, 2),
      "utf-8"
    );
  } catch {
    // ignore disk errors on serverless
  }
}

function enrichCallerEvent(
  rawPhone: string,
  line = "Hat 1",
  existingId?: string,
  existingTimestamp?: string,
  dismissed = false
): CallerIdIncomingEvent {
  const cleanDigits = normalizePhone(rawPhone);
  const last10 = cleanDigits.slice(-10);

  const users = getAllUsers();
  const orders = getOrders();

  const matchedUser = users.find((u) => {
    const uDigits = normalizePhone(u.phone).slice(-10);
    return Boolean(last10 && uDigits && uDigits === last10);
  });

  const customerOrders = orders
    .filter((o) => {
      const oDigits = normalizePhone(o.customerPhone || "").slice(-10);
      return Boolean(last10 && oDigits && oDigits === last10);
    })
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

  const latestOrder = customerOrders[0];

  const isRegistered = Boolean(matchedUser || latestOrder);
  const customerName =
    matchedUser?.name || latestOrder?.customerName || undefined;
  const customerAddress =
    matchedUser?.addresses?.[0]?.fullAddress ||
    latestOrder?.customerAddress ||
    undefined;
  const orderCount = customerOrders.length;
  const loyaltyPoints = matchedUser?.loyaltyPoints || 0;

  return {
    id: existingId || `cid-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    phone: rawPhone.trim(),
    line,
    timestamp: existingTimestamp || new Date().toISOString(),
    dismissed,
    isRegistered,
    isRegisteredCustomer: isRegistered,
    customerName,
    customerAddress,
    orderCount,
    loyaltyPoints,
    lastOrder: latestOrder
      ? {
          id: latestOrder.id,
          orderNumber: latestOrder.orderNumber,
          createdAt: latestOrder.createdAt,
          totalAmount: latestOrder.totalAmount,
          items: latestOrder.items,
        }
      : undefined,
  };
}

export async function GET(req: NextRequest) {
  try {
    // Klasik USB Caller ID cihazlarının / yazılımlarının (CidShow vb.) HTTP GET ile tetikleme desteği:
    // Örn: http://localhost:5439/api/caller-id?incomingPhone=05321234567&line=Hat1
    const incomingPhone =
      req.nextUrl.searchParams.get("incomingPhone") ||
      req.nextUrl.searchParams.get("phone") ||
      req.nextUrl.searchParams.get("caller");

    if (incomingPhone) {
      const line = req.nextUrl.searchParams.get("line") || "Hat 1";
      const ev = enrichCallerEvent(incomingPhone, line);
      const list = readEvents();
      writeEvents([ev, ...list]);
      return NextResponse.json({ triggered: true, call: ev });
    }

    const now = Date.now();
    const list = readEvents().map((ev) =>
      enrichCallerEvent(ev.phone, ev.line, ev.id, ev.timestamp, ev.dismissed)
    );

    // Son 15 dakika içindeki kapatılmamış çağrılar aktif kabul edilir
    const activeCalls = list.filter(
      (ev) =>
        !ev.dismissed &&
        now - new Date(ev.timestamp).getTime() < 15 * 60 * 1000
    );

    return NextResponse.json({
      activeCalls,
      recentCalls: list.slice(0, 20),
    });
  } catch (err) {
    console.error("Caller ID GET hatası:", err);
    return NextResponse.json({ activeCalls: [], recentCalls: [] });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    let targetPhone = String(body.phone || "").trim();
    const line = String(body.line || "Hat 1").trim();

    if (body.simulateRandomRegistered || !targetPhone) {
      const users = getAllUsers();
      const orders = getOrders().filter(
        (o) =>
          o.customerPhone &&
          o.customerPhone !== "-" &&
          o.customerPhone !== "Kasa Siparişi"
      );
      if (users.length > 0) {
        const pick = users[Math.floor(Math.random() * users.length)];
        targetPhone = pick.phone;
      } else if (orders.length > 0) {
        const pick = orders[Math.floor(Math.random() * orders.length)];
        targetPhone = pick.customerPhone;
      } else {
        targetPhone = "0532 444 14 53";
      }
    }

    const ev = enrichCallerEvent(targetPhone, line);
    const list = readEvents();
    writeEvents([ev, ...list]);

    return NextResponse.json({ call: ev });
  } catch (err) {
    console.error("Caller ID POST hatası:", err);
    return NextResponse.json(
      { error: "Caller ID kaydı oluşturulamadı" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const list = readEvents();
    if (body.dismissAll) {
      const updated = list.map((ev) => ({ ...ev, dismissed: true }));
      writeEvents(updated);
      return NextResponse.json({ ok: true });
    }
    if (body.id) {
      const updated = list.map((ev) =>
        ev.id === body.id ? { ...ev, dismissed: true } : ev
      );
      writeEvents(updated);
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ ok: false }, { status: 400 });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
