import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { getOrders, getSettings } from "@/lib/db";
import { CourierLiveLocation } from "@/types";

const DATA_DIR = path.join(process.cwd(), "data");
const COURIER_LOC_FILE = path.join(DATA_DIR, "courier_locations.json");

function readLocations(): Record<string, CourierLiveLocation> {
  try {
    if (!fs.existsSync(COURIER_LOC_FILE)) return {};
    const raw = fs.readFileSync(COURIER_LOC_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeLocations(map: Record<string, CourierLiveLocation>): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(COURIER_LOC_FILE, JSON.stringify(map, null, 2), "utf-8");
  } catch {
    // ignore
  }
}

export async function GET() {
  try {
    const map = readLocations();
    const orders = getOrders();
    const settings = getSettings();
    const configuredCouriers = settings.couriers || [];

    const activeDeliveryOrders = orders.filter(
      (o) =>
        o.orderType === "delivery" &&
        (o.status === "accepted" || o.status === "ready")
    );

    const list: Array<
      CourierLiveLocation & {
        assignedOrders: Array<{
          id: string;
          orderNumber: number;
          customerName: string;
          customerPhone: string;
          customerAddress?: string;
          totalAmount: number;
          status: string;
        }>;
      }
    > = [];

    const allNames = Array.from(
      new Set([...Object.keys(map), ...configuredCouriers])
    );

    for (const cName of allNames) {
      const loc = map[cName];
      const assigned = activeDeliveryOrders
        .filter((o) => o.courierName === cName)
        .map((o) => ({
          id: o.id,
          orderNumber: o.orderNumber,
          customerName: o.customerName,
          customerPhone: o.customerPhone,
          customerAddress: o.customerAddress,
          totalAmount: o.totalAmount,
          status: o.status,
        }));

      if (loc) {
        list.push({
          ...loc,
          activeOrderCount: assigned.length,
          status:
            assigned.length > 0
              ? "delivering"
              : loc.status || "idle",
          assignedOrders: assigned,
        });
      }
    }

    return NextResponse.json({
      locations: list,
      couriers: configuredCouriers,
    });
  } catch (err) {
    console.error("Kurye konumları alınamadı:", err);
    return NextResponse.json({ locations: [], couriers: [] });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const courierName = String(body.courierName || "").trim();
    const lat = Number(body.lat);
    const lng = Number(body.lng);

    if (!courierName || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      return NextResponse.json(
        { error: "Geçersiz kurye adı veya GPS koordinatı" },
        { status: 400 }
      );
    }

    const map = readLocations();
    const entry: CourierLiveLocation = {
      courierName,
      lat,
      lng,
      accuracy: body.accuracy ? Number(body.accuracy) : undefined,
      speedKmh: body.speedKmh ? Number(body.speedKmh) : 0,
      status: body.status || "delivering",
      updatedAt: new Date().toISOString(),
    };
    map[courierName] = entry;
    writeLocations(map);

    return NextResponse.json({ location: entry });
  } catch (err) {
    console.error("Kurye konumu kaydedilemedi:", err);
    return NextResponse.json(
      { error: "Kurye konumu kaydedilemedi" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const courierName = String(body.courierName || "").trim();
    const map = readLocations();
    if (courierName && map[courierName]) {
      delete map[courierName];
      writeLocations(map);
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
