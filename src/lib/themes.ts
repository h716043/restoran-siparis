export type ThemeId =
  | "light-classic"
  | "light-emerald"
  | "light-royal"
  | "dark-obsidian"
  | "dark-luxury"
  | "dark-neon";

export interface ThemeDefinition {
  id: ThemeId;
  name: string;
  shortName: string;
  mode: "light" | "dark";
  badge: string;
  description: string;
  previewBg: string;
  previewCard: string;
  previewAccent: string;
  previewText: string;
}

export const STOREFRONT_THEMES: ThemeDefinition[] = [
  // 3 AÇIK TEMA
  {
    id: "light-classic",
    name: "Klasik Ateş & Turuncu",
    shortName: "Klasik Açık",
    mode: "light",
    badge: "☀️ Açık Tema 1",
    description: "Ferah beyaz zemin üzerinde iştah açıcı ateş turuncusu ve kırmızı vurgular.",
    previewBg: "#f8fafc",
    previewCard: "#ffffff",
    previewAccent: "#ea580c",
    previewText: "#0f172a",
  },
  {
    id: "light-emerald",
    name: "Doğal Zeytin & Zümrüt",
    shortName: "Zümrüt Açık",
    mode: "light",
    badge: "🌿 Açık Tema 2",
    description: "Yumuşak adaçayı kremi zemin ve doğal zümrüt yeşili tonları. Cafe & Ege konsepti.",
    previewBg: "#f2f9f5",
    previewCard: "#ffffff",
    previewAccent: "#059669",
    previewText: "#064e3b",
  },
  {
    id: "light-royal",
    name: "Saray & Gurme Bordo",
    shortName: "Gurme Açık",
    mode: "light",
    badge: "👑 Açık Tema 3",
    description: "Sıcak fildişi krem zemin üzerinde asil yakut bordosu. Kebap ve gurme restoran konsepti.",
    previewBg: "#fcf8f2",
    previewCard: "#fffdf9",
    previewAccent: "#be123c",
    previewText: "#271217",
  },

  // 3 KAPALI (KOYU) TEMA
  {
    id: "dark-obsidian",
    name: "Gece Ateşi & Obsidyen",
    shortName: "Obsidyen Koyu",
    mode: "dark",
    badge: "🔥 Kapalı Tema 1",
    description: "Derin gece mavisi-antrasit zemin üzerinde parlayan köz turuncusu vurgular.",
    previewBg: "#0b0f19",
    previewCard: "#131b2e",
    previewAccent: "#f97316",
    previewText: "#f8fafc",
  },
  {
    id: "dark-luxury",
    name: "VIP Gold & Kömür",
    shortName: "VIP Gold Koyu",
    mode: "dark",
    badge: "✨ Kapalı Tema 2",
    description: "Lüks mat kömür siyahı zemin ve altın kehribar detaylar. Steakhouse & Lounge konsepti.",
    previewBg: "#0c0c0e",
    previewCard: "#16161a",
    previewAccent: "#f59e0b",
    previewText: "#fafaf9",
  },
  {
    id: "dark-neon",
    name: "Modern Gece & Mor-İndigo",
    shortName: "Gece İndigo Koyu",
    mode: "dark",
    badge: "🌌 Kapalı Tema 3",
    description: "Derin uzay laciverti zemin ve canlı mor-indigo vurgular. Burger, pizza & gece konsepti.",
    previewBg: "#0d0b1e",
    previewCard: "#171432",
    previewAccent: "#8b5cf6",
    previewText: "#f5f3ff",
  },
];

export function getThemeDefinition(themeId?: string): ThemeDefinition {
  return (
    STOREFRONT_THEMES.find((t) => t.id === themeId) || STOREFRONT_THEMES[0]
  );
}

export function applyThemeToDocument(themeId: ThemeId) {
  if (typeof document === "undefined") return;
  const def = getThemeDefinition(themeId);
  document.documentElement.setAttribute("data-theme", def.id);
  document.documentElement.setAttribute("data-theme-mode", def.mode);
}
