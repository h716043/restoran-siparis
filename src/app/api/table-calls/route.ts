import { NextRequest, NextResponse } from "next/server";
import {
  createTableCall,
  getTableCalls,
  resolveTableCall,
} from "@/lib/db";
import { syncActivityWithCloud } from "@/lib/cloud-sync";

export async function GET() {
  try {
    await syncActivityWithCloud();
    const calls = getTableCalls();
    return NextResponse.json({ calls });
  } catch (error) {
    console.error("GET /api/table-calls error:", error);
    return NextResponse.json({ error: "Çağrılar alınamadı" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await syncActivityWithCloud();
    const body = await req.json();
    const tableNumber = String(body.tableNumber || "").trim();
    const type = body.type as "waiter" | "bill_cash" | "bill_card";

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
    const role = req.cookies.get("restoran_staff_role")?.value;
    if (role !== "admin" && role !== "kitchen") {
      return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
    }

    await syncActivityWithCloud();
    const body = await req.json();
    if (!body.id) {
      return NextResponse.json({ error: "ID gerekli" }, { status: 400 });
    }
    resolveTableCall(String(body.id));
    await syncActivityWithCloud();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PATCH /api/table-calls error:", error);
    return NextResponse.json({ error: "Güncellenemedi" }, { status: 500 });
  }
}

