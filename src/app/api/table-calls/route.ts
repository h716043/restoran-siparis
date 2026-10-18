import { NextRequest, NextResponse } from "next/server";
import {
  createTableCall,
  getAllTableCalls,
  getTableCalls,
  isSameTableName,
  resolveTableCall,
} from "@/lib/db";
import {
  pullActivityFromCloud,
  syncActivityWithCloud,
} from "@/lib/cloud-sync";

export async function GET(req: NextRequest) {
  try {
    await pullActivityFromCloud();
    const { searchParams } = new URL(req.url);
    const tableFilter = searchParams.get("table")?.trim();
    if (tableFilter) {
      const allCalls = getAllTableCalls();
      const nowMs = Date.now();
      const tableCalls = allCalls.filter((c) => {
        if (!isSameTableName(c.tableNumber, tableFilter)) return false;
        if (c.status === "pending") return true;
        // Çözülmüş (resolved) çağrıları da son 3 dakika içinde oluşturulmuşsa müşteriye "Garsonunuz Yolda" geri bildirimi için döndür
        const createdMs = new Date(c.createdAt).getTime();
        return Number.isFinite(createdMs) && nowMs - createdMs <= 3 * 60 * 1000;
      });
      return NextResponse.json({ calls: tableCalls });
    }
    const calls = getTableCalls();
    return NextResponse.json({ calls });
  } catch (error) {
    console.error("GET /api/table-calls error:", error);
    return NextResponse.json({ error: "Çağrılar alınamadı" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await pullActivityFromCloud(true);
    const body = await req.json();
    const tableNumber = String(body.tableNumber || "").trim();
    const type = body.type as
      | "waiter"
      | "bill_cash"
      | "bill_card"
      | "kitchen_pickup";

    if (!tableNumber || !type) {
      return NextResponse.json(
        { error: "Masa numarası ve çağrı tipi gerekli" },
        { status: 400 }
      );
    }

    const call = createTableCall(tableNumber, type);
    await syncActivityWithCloud();
    return NextResponse.json({ call }, { status: 201 });
  } catch (error) {
    console.error("POST /api/table-calls error:", error);
    return NextResponse.json({ error: "Çağrı gönderilemedi" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await pullActivityFromCloud(true);
    const body = await req.json();
    if (!body.id) {
      return NextResponse.json({ error: "ID gerekli" }, { status: 400 });
    }
    resolveTableCall(String(body.id));
    await syncActivityWithCloud();
    const calls = getTableCalls();
    return NextResponse.json({ success: true, calls });
  } catch (error) {
    console.error("PATCH /api/table-calls error:", error);
    return NextResponse.json({ error: "Güncellenemedi" }, { status: 500 });
  }
}

