export type OrderType = "dine_in" | "pickup" | "delivery";

export type OrderStatus =
  | "pending"      // Yeni düştü, restoran onayı bekliyor (Sesli alarm çalar)
  | "accepted"     // Restoran onayladı & tahmini süre verdi (Hazırlanıyor)
  | "ready"        // Hazır / Yolda / Masaya servis edildi
  | "completed"    // Tamamlandı
  | "rejected";    // Reddedildi / İptal

export type PaymentMethod = "cash" | "card_at_door" | "pos_at_table";

export interface ModifierOption {
  id: string;
  name: string;
  price: number;
}

export interface ModifierGroup {
  id: string;
  name: string; // örn: "Porsiyon Seçimi", "Ekstra Malzemeler", "Çıkarılacak Malzemeler"
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
  subtotal: number;
  discountAmount?: number;
  couponCode?: string;
  deliveryFee: number;
  totalAmount: number;
  estimatedMinutes?: number;
  courierName?: string;
  rejectReason?: string;
  items: OrderItem[];
  createdAt: string;
  updatedAt: string;
}

export interface TableReservation {
  id: string;
  reservationNumber: number;
  customerName: string;
  customerPhone: string;
  guestCount: number;
  reservationDate: string; // YYYY-MM-DD
  reservationTime: string; // HH:mm
  specialRequests?: string;
  assignedTable?: string;
  status: "pending" | "confirmed" | "rejected";
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
  createdAt: string;
  lastLoginAt: string;
}

export interface WhatsAppLog {
  id: string;
  phone: string;
  message: string;
  type: "otp" | "order_status";
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
  announcementBar?: AnnouncementBarConfig;
  deliveryZones?: DeliveryZone[];
  coupons?: Coupon[];
  couriers?: string[];
  whatsappConfig?: WhatsAppConfig;
  securityConfig?: SecurityConfig;
  cloudSyncConfig?: CloudSyncConfig;
}


