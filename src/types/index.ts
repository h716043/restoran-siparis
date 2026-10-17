export type OrderType = "dine_in" | "pickup" | "delivery";

export type OrderStatus =
  | "pending"      // Yeni düştü, restoran onayı bekliyor (Sesli alarm çalar)
  | "accepted"     // Restoran onayladı & tahmini süre verdi (Hazırlanıyor)
  | "ready"        // Hazır / Yolda / Masaya servis edildi
  | "completed"    // Tamamlandı
  | "rejected";    // Reddedildi / İptal

export type PaymentMethod = "cash" | "card_at_door" | "pos_at_table" | "credit";

export interface ModifierOption {
  id: string;
  name: string;
  price: number;
  /** Bu porsiyon / seçenek seçildiğinde açılan, o porsiyona özel ekstra ve tercihler */
  subOptions?: ModifierOption[];
}

export interface ModifierGroup {
  id: string;
  name: string; // örn: "Porsiyon Seçimi", "Ekstra Malzemeler", "Çıkarılacak Malzemeler"
  /** Kampanya menülerinde bu grubun ait olduğu alt ürün başlığı (örn: "1. Ürün: Kebap & Izgara") */
  productTag?: string;
  required: boolean;
  multiSelect: boolean;
  minSelect?: number;
  maxSelect?: number;
  options: ModifierOption[];
}

export interface MenuItem {
  id: string;
  categoryId: string;
  name: string;
  description: string;
  price: number;
  imageUrl: string;
  available: boolean;
  popular?: boolean;
  /** Günlük porsiyon / kritik stok sınırı (null veya undefined = Sınırsız) */
  dailyStock?: number | null;
  modifierGroups: ModifierGroup[];
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
  icon: string;
}

export interface SelectedModifier {
  groupName: string;
  optionName: string;
  price: number;
  /** Kampanya menüsündeki alt ürün başlığı (Örn: "🍕 1. Ürün: Taş Fırın Pide Seçimi") */
  productTag?: string;
  /** Seçimin rolü: porsiyon/ana ürün seçimi mi, porsiyon ekstrası mı, genel ekstra mı, çıkarılacak malzeme mi */
  modifierRole?: "portion" | "sub_extra" | "extra" | "removal";
  /** Porsiyon ekstrası ise ait olduğu porsiyon adı */
  parentOptionName?: string;
}

export interface OrderItem {
  id: string;
  menuItemId: string;
  name: string;
  quantity: number;
  basePrice: number;
  unitPrice: number; // basePrice + modifiers
  totalPrice: number;
  selectedModifiers: SelectedModifier[];
  itemNote?: string;
  /** Mutfak ekranında usta tarafından hazırlandı olarak tiklendi mi? */
  prepared?: boolean;
}

export interface SplitPaymentInfo {
  cashAmount: number;
  cardAmount: number;
  courierSettled?: boolean;
  creditAccountId?: string;
  creditAccountName?: string;
}

export interface Order {
  id: string;
  orderNumber: number;
  orderType: OrderType;
  status: OrderStatus;
  tableNumber?: string;
  userId?: string;
  customerName: string;
  customerPhone: string;
  customerAddress?: string;
  deliveryZoneId?: string;
  deliveryZoneName?: string;
  scheduledTime?: string; // Örn: "Bugün 19:30" (İleri saatli sipariş / Ön sipariş)
  orderNote?: string;
  paymentMethod: PaymentMethod;
  splitPaymentInfo?: SplitPaymentInfo;
  subtotal: number;
  discountAmount?: number;
  couponCode?: string;
  deliveryFee: number;
  totalAmount: number;
  estimatedMinutes?: number;
  courierName?: string;
  rejectReason?: string;
  loyaltyPointsEarned?: number;
  loyaltyPointsUsed?: number;
  rating?: number; // 1-5 yıldız müşteri değerlendirmesi
  reviewText?: string;
  reviewedAt?: string;
  items: OrderItem[];
  createdAt: string;
  updatedAt: string;
}

export interface TableReservation {
  id: string;
  reservationNumber?: number;
  customerName: string;
  customerPhone: string;
  guestCount: number;
  guests?: number;
  reservationDate: string; // YYYY-MM-DD
  date?: string;
  reservationTime: string; // HH:mm
  time?: string;
  specialRequests?: string;
  notes?: string;
  assignedTable?: string;
  tableNumber?: string;
  status: "pending" | "confirmed" | "rejected" | "seated" | "cancelled";
  rejectReason?: string;
  createdAt: string;
}

export interface SavedAddress {
  id: string;
  title: string; // Ev, İş vb.
  zoneId?: string;
  zoneName?: string;
  fullAddress: string;
}

export interface CustomerUser {
  id: string;
  phone: string;
  name: string;
  addresses: SavedAddress[];
  loyaltyPoints?: number; // Biriken Para Puan (TL karşılığı)
  createdAt: string;
  lastLoginAt: string;
}

export interface WhatsAppLog {
  id: string;
  phone: string;
  message: string;
  type: "otp" | "order_status" | "campaign";
  status: "sent" | "simulated" | "failed" | "queued_for_local";
  createdAt: string;
}

export interface WhatsAppConfig {
  provider: "simulation" | "custom_gateway" | "meta_cloud";
  gatewayUrl: string;
  gatewayApiKey: string;
  metaPhoneNumberId: string;
  metaAccessToken: string;
  sendOrderUpdates: boolean;
  requireAuthForDeliveryAndPickup: boolean;
}

export interface SecurityConfig {
  adminPassword: string;
  kitchenPassword: string;
}

export interface CloudSyncConfig {
  enabled: boolean;
  tursoUrl: string; // Örn: libsql://restoran-db-kullanici.turso.io
  tursoAuthToken: string;
  publicStorefrontUrl?: string; // Örn: https://meshur-kebapci.netlify.app
  lastSyncedAt?: string;
}

export interface DeliveryZone {
  id: string;
  name: string; // Örn: "Caferağa & Moda", "Fenerbahçe & Kalamış"
  minAmount: number;
  deliveryFee: number;
  estimatedMinutes: number | string;
  active: boolean;
}

export interface Coupon {
  id: string;
  code: string; // Örn: "HOSGELDIN10", "LEZZET50"
  title: string;
  discountType: "percentage" | "fixed";
  discountValue: number;
  minOrderAmount: number;
  active: boolean;
}

export interface TableCall {
  id: string;
  tableNumber: string;
  type: "waiter" | "bill_cash" | "bill_card";
  status: "pending" | "resolved";
  createdAt: string;
}

export interface AnnouncementBarConfig {
  enabled: boolean;
  badgeText: string;
  text: string;
  couponCodeToApply?: string;
  theme: "dark" | "orange" | "emerald" | "indigo";
}

export interface LoyaltyConfig {
  enabled: boolean; // İsteğe bağlı: Admin panelinden açılıp kapatılabilir
  earnPercent: number; // Örn: %5 Para Puan kazanımı
  minRedeemPoints: number; // Örn: En az 20 TL puan biriktiğinde kullanabilme
}

/** 1. ÖZELLİK: Günlük Gider Kaydı & Kasa Bozuk Para Avansı */
export interface CashExpense {
  id: string;
  title: string; // Örn: "Manav / Yeşillik Ödemesi", "Kurye Benzin", "Sabah Kasa Avansı"
  category:
    | "supplier"
    | "fuel"
    | "staff"
    | "utility"
    | "cash_float"
    | "other";
  amount: number;
  paymentMethod: "cash" | "card";
  createdAt: string;
}

/** 3. ÖZELLİK: Müşteri Veresiye / Cari Hesap (Açık Hesap) Defteri */
export interface CreditTransaction {
  id: string;
  type: "debt" | "payment"; // debt = Borç ekleme (Sipariş), payment = Tahsilat alındı
  amount: number;
  description: string;
  orderNumber?: number;
  createdAt: string;
}

export interface CreditAccount {
  id: string;
  customerName: string; // Örn: "Ahmet Bey (Yandaki Eczane)"
  customerPhone: string;
  companyTitle?: string;
  balance: number; // Güncel kalan borç (TL)
  transactions: CreditTransaction[];
  updatedAt: string;
}

/** 5. ÖZELLİK: Saatlik Happy Hour / Öğle Menüsü Otomatik İndirim Kuralı */
export interface HappyHourConfig {
  enabled: boolean;
  title: string; // Örn: "Öğle Molası Happy Hour İndirimi"
  startTime: string; // Örn: "12:00"
  endTime: string; // Örn: "16:00"
  discountPercent: number; // Örn: 15 (%15 indirim)
  categoryIds?: string[]; // Boşsa tüm menüde geçerli
}

export type StorefrontThemeId =
  | "light-classic"
  | "light-emerald"
  | "light-royal"
  | "dark-obsidian"
  | "dark-luxury"
  | "dark-neon";

export interface RestaurantSettings {
  name: string;
  slogan: string;
  phone: string;
  address: string;
  isOpen: boolean;
  openTime?: string; // Örn: "11:00"
  closeTime?: string; // Örn: "23:30"
  autoOpenCloseByHours?: boolean;
  minDeliveryAmount: number;
  deliveryFee: number;
  estimatedPrepMinutes: number;
  tableCount: number;
  currency: string;
  openingHours: string;
  firstOrderDiscountPercent?: number;
  storefrontTheme?: StorefrontThemeId; // 3 Açık + 3 Koyu tema seçimi
  allowCustomerThemeSwitch?: boolean; // Müşteri vitrinde kendi temasını değiştirebilsin mi?
  loyaltyConfig?: LoyaltyConfig;
  happyHourConfig?: HappyHourConfig;
  cashExpenses?: CashExpense[];
  creditAccounts?: CreditAccount[];
  reservations?: TableReservation[];
  announcementBar?: AnnouncementBarConfig;
  deliveryZones?: DeliveryZone[];
  coupons?: Coupon[];
  couriers?: string[];
  tvDisplayOrderTypes?: OrderType[]; // TV Sıra Çağrı ekranında (/tv) hangi sipariş türlerinin gösterileceği (delivery, pickup, dine_in)
  whatsappConfig?: WhatsAppConfig;
  securityConfig?: SecurityConfig;
  cloudSyncConfig?: CloudSyncConfig;
}




