import { SelectedModifier } from "@/types";

export interface SplitOptionResult {
  /** Eğer seçenek "Kaşarlı Kuşbaşılı Pide — 1 Porsiyon (Standart)" gibiyse alt ürünün adı */
  dishName: string;
  /** Porsiyon kısmı (Örn: "1 Porsiyon (Standart)", "1.5 Porsiyon", "Normal Porsiyon") */
  portionLabel: string;
}

/**
 * Bir porsiyon/seçenek metnini "Seçilen Ürün Çeşidi" ve "Porsiyon" olarak ikiye ayırır.
 * Örn:
 * - "Kaşarlı Kuşbaşılı Pide — 1 Porsiyon (Standart)"
 *    -> dishName: "Kaşarlı Kuşbaşılı Pide", portionLabel: "1 Porsiyon (Standart)"
 * - "Baharatlı Patates (Normal Porsiyon) + 2 Kutu İçecek"
 *    -> dishName: "Baharatlı Patates + 2 Kutu İçecek", portionLabel: "Normal Porsiyon"
 * - "1.5 Porsiyon (Doyurucu - 270g)"
 *    -> dishName: "", portionLabel: "1.5 Porsiyon (Doyurucu - 270g)"
 */
export function splitOptionNameAndPortion(rawName: string): SplitOptionResult {
  const text = (rawName || "").trim();
  if (!text) return { dishName: "", portionLabel: "" };

  // 1) " — " veya " - " ile ayrılmış "Ürün Adı — Porsiyon" formatı
  if (text.includes(" — ")) {
    const [left, ...rest] = text.split(" — ");
    return {
      dishName: left.trim(),
      portionLabel: rest.join(" — ").trim(),
    };
  }

  // 2) Parantez içinde porsiyon/boyut ifadesi geçen çoklu seçenekler
  // Örn: "Baharatlı Patates (Normal Porsiyon) + 2 Kutu İçecek" veya "2x Bol Köpüklü Yayık Ayran (Standart 300ml)"
  const parenMatch = text.match(
    /\(([^)]*(?:Porsiyon|Standart|Büyük|Orta|Küçük|Double|Duble|Tek|Kişilik|ml|Litre|Adet)[^)]*)\)/i
  );
  if (
    parenMatch &&
    !text.toLowerCase().startsWith("1 porsiyon") &&
    !text.toLowerCase().startsWith("1.5 porsiyon") &&
    !text.toLowerCase().startsWith("yarım") &&
    !text.toLowerCase().startsWith("tam ") &&
    !text.toLowerCase().startsWith("double") &&
    !text.toLowerCase().startsWith("duble") &&
    !text.toLowerCase().startsWith("standart") &&
    !text.toLowerCase().startsWith("büyük") &&
    !text.toLowerCase().startsWith("küçük")
  ) {
    const portionInParen = parenMatch[1].trim();
    const cleanedDish = text
      .replace(parenMatch[0], "")
      .replace(/\s{2,}/g, " ")
      .trim();
    return {
      dishName: cleanedDish,
      portionLabel: portionInParen,
    };
  }

  // 3) Doğrudan porsiyon ifadesi (Örn: "1 Porsiyon (Standart - 180g)")
  return {
    dishName: "",
    portionLabel: text,
  };
}

export interface StructuredSubProductBlock {
  /** Sıra etiketi: "1. ÜRÜN", "2. ÜRÜN", "3. ÜRÜN" vb. (Tekil ürün ise undefined) */
  stepBadge?: string;
  /** Alt ürün kategori başlığı: örn. "🍕 Taş Fırın Pide Seçimi" */
  productTitle?: string;
  /** Seçilen ana ürün/çeşit adı: örn. "Kaşarlı Kuşbaşılı Pide" */
  chosenDishName?: string;
  /** Seçilen porsiyon adı: örn. "1 Porsiyon (Standart)" */
  portionLabel?: string;
  /** Porsiyon fiyat farkı */
  portionPrice: number;
  /** Bu alt ürüne / porsiyona ait ekstra ve tercihler */
  extras: Array<{ name: string; price: number }>;
  /** Çıkarılacak malzemeler */
  removals: Array<{ name: string }>;
}

/**
 * grup adından veya productTag'den "1. ÜRÜN" ve temiz başlığı çıkarır.
 * Örn: "🍕 1. Ürün: Taş Fırın Pide Seçimi (1. Ürün Porsiyon & Çeşit Seçimi)"
 *   -> stepBadge: "1. ÜRÜN", cleanTitle: "🍕 Taş Fırın Pide Seçimi", key: "1"
 */
export function extractSubProductHeader(rawGroupOrTag?: string): {
  stepBadge?: string;
  cleanTitle?: string;
  groupKey: string;
} {
  if (!rawGroupOrTag) return { groupKey: "single" };

  // " • Porsiyon Ekstrası" veya "(...)" kısmını temizle
  let base = rawGroupOrTag.split(" • ")[0].trim();
  base = base.replace(/\s*\([^)]*Porsiyon[^)]*\)\s*$/i, "").trim();

  // "1. Ürün", "2. Ürün", "3. Ürün", "4. Ürün" yakala
  const stepMatch = base.match(/(\d+)\.\s*Ürün\s*:?\s*(.*)/i);
  if (stepMatch) {
    const num = stepMatch[1];
    // Başındaki emojiyi koru
    const leadingEmojiMatch = base.match(/^([^\w\d\s]+)/);
    const emoji = leadingEmojiMatch ? `${leadingEmojiMatch[1]} ` : "";
    const restTitle = stepMatch[2].trim();
    return {
      stepBadge: `${num}. ÜRÜN`,
      cleanTitle: `${emoji}${restTitle}`.trim() || `${num}. Ürün`,
      groupKey: `sub-${num}`,
    };
  }

  return { groupKey: "single" };
}

/**
 * Sipariş veya sepetteki `selectedModifiers` dizisini;
 * - Kampanya ise: 1. ÜRÜN, 2. ÜRÜN, 3. ÜRÜN, 4. ÜRÜN bloklarına (her birinin içinde Ürün, Porsiyon ve Ekstralar ayrı)
 * - Tekil ürün ise: Porsiyon, Ekstralar ve Çıkarılacak Malzemeler bloklarına
 * dönüştürür. Hem yeni siparişlerle hem de veritabanındaki eski siparişlerle (%100 geriye dönük) uyumludur.
 */
export function parseStructuredModifiers(
  modifiers: SelectedModifier[]
): StructuredSubProductBlock[] {
  if (!modifiers || modifiers.length === 0) return [];

  const blocksMap = new Map<string, StructuredSubProductBlock>();
  let lastActiveBlockKey = "single";

  const ensureBlock = (
    key: string,
    stepBadge?: string,
    productTitle?: string
  ): StructuredSubProductBlock => {
    let existing = blocksMap.get(key);
    if (!existing) {
      existing = {
        stepBadge,
        productTitle,
        portionPrice: 0,
        extras: [],
        removals: [],
      };
      blocksMap.set(key, existing);
    } else {
      if (stepBadge && !existing.stepBadge) existing.stepBadge = stepBadge;
      if (productTitle && !existing.productTitle)
        existing.productTitle = productTitle;
    }
    return existing;
  };

  for (const mod of modifiers) {
    const rawSource = mod.productTag || mod.groupName || "";
    const header = extractSubProductHeader(rawSource);

    // Rol tespiti (Geriye dönük uyumlu)
    const gLower = (mod.groupName || "").toLowerCase();
    const oLower = (mod.optionName || "").toLowerCase();

    let role: "portion" | "extra" | "removal" = "extra";
    if (mod.modifierRole === "portion") {
      role = "portion";
    } else if (mod.modifierRole === "removal") {
      role = "removal";
    } else if (
      mod.modifierRole === "sub_extra" ||
      mod.modifierRole === "extra"
    ) {
      role = "extra";
    } else if (
      gLower.includes("porsiyon ekstrası") ||
      gLower.includes("ekstra malzeme") ||
      gLower.includes("ekstra &") ||
      gLower.includes("sos &") ||
      gLower.includes("yan lezzet")
    ) {
      role = "extra";
    } else if (
      gLower.includes("çıkarılacak") ||
      oLower.startsWith("soğansız") ||
      oLower.startsWith("domatessiz") ||
      oLower.startsWith("turşusuz")
    ) {
      role = "removal";
    } else if (
      gLower.includes("porsiyon") ||
      gLower.includes("çeşit seçimi") ||
      gLower.includes("ürün:") ||
      header.stepBadge
    ) {
      role = "portion";
    }

    const targetKey =
      header.groupKey !== "single"
        ? header.groupKey
        : role !== "portion" && lastActiveBlockKey !== "single"
        ? lastActiveBlockKey
        : "single";

    const block = ensureBlock(
      targetKey,
      header.stepBadge,
      header.cleanTitle
    );

    if (role === "portion") {
      lastActiveBlockKey = targetKey;
      const split = splitOptionNameAndPortion(mod.optionName);
      if (split.dishName) {
        block.chosenDishName = split.dishName;
      }
      block.portionLabel = split.portionLabel || mod.optionName;
      block.portionPrice += mod.price || 0;
    } else if (role === "removal") {
      block.removals.push({ name: mod.optionName });
    } else {
      block.extras.push({
        name: mod.optionName,
        price: mod.price || 0,
      });
    }
  }

  return Array.from(blocksMap.values());
}
