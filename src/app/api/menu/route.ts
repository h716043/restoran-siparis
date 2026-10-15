import { NextRequest, NextResponse } from "next/server";
import {
  getCategories,
  getMenuItems,
  getOrders,
  getSettings,
  saveMenuItem,
  deleteMenuItem,
  createCategory,
  deleteCategory,
} from "@/lib/db";
import {
  pullActivityFromCloud,
  pullCatalogFromCloud,
  pushCatalogToCloud,
} from "@/lib/cloud-sync";

export async function GET(req: NextRequest) {
  try {
    const role = req.cookies.get("restoran_staff_role")?.value;
    if (role !== "admin") {
      await Promise.all([pullCatalogFromCloud(), pullActivityFromCloud()]);
    }
    const rawSettings = getSettings();
    const settings =
      role === "admin"
        ? rawSettings
        : {
            ...rawSettings,
            securityConfig: undefined,
            cloudSyncConfig: undefined,
          };

    const categories = getCategories();
    const items = getMenuItems();
    const publicReviews = getOrders()
      .filter((o) => (o.rating || 0) >= 4)
      .slice(0, 12)
      .map((o) => {
        const parts = (o.customerName || "Müşteri").trim().split(/\s+/);
        const maskedName =
          parts.length > 1
            ? `${parts[0]} ${parts[parts.length - 1][0]}.`
            : parts[0];
        return {
          id: o.id,
          customerName: maskedName,
          rating: o.rating || 5,
          reviewText: o.reviewText || "Çok lezzetli ve hızlı servis, teşekkürler!",
          itemsSummary: o.items.map((i) => i.name).join(", "),
          reviewedAt: o.reviewedAt || o.updatedAt,
        };
      });

    return NextResponse.json({ settings, categories, items, publicReviews });
  } catch (error) {
    console.error("GET /api/menu error:", error);
    return NextResponse.json({ error: "Menü yüklenemedi" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const role = req.cookies.get("restoran_staff_role")?.value;
    if (role !== "admin" && role !== "kitchen") {
      return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
    }

    const body = await req.json();
    if (body.type === "category") {
      const cat = createCategory({
        name: body.name,
        slug: body.slug || body.name.toLowerCase().replace(/\s+/g, "-"),
        sortOrder: Number(body.sortOrder || 99),
        icon: body.icon || "Utensils",
      });
      await pushCatalogToCloud();
      return NextResponse.json({ category: cat });
    } else {
      const item = saveMenuItem(body.item);
      await pushCatalogToCloud();
      return NextResponse.json({ item });
    }
  } catch (error) {
    console.error("POST /api/menu error:", error);
    return NextResponse.json({ error: "İşlem başarısız" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const role = req.cookies.get("restoran_staff_role")?.value;
    if (role !== "admin") {
      return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const type = searchParams.get("type") || "item";
    if (!id) {
      return NextResponse.json({ error: "ID gerekli" }, { status: 400 });
    }
    if (type === "category") {
      deleteCategory(id);
    } else {
      deleteMenuItem(id);
    }
    await pushCatalogToCloud();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/menu error:", error);
    return NextResponse.json({ error: "Silinemedi" }, { status: 500 });
  }
}

