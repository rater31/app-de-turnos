import type { BusinessHours, Service, StaffMember } from "@/lib/types";

export type BookingStatus = "pending" | "confirmed" | "completed" | "cancelled" | "no_show";

export type DBUser = {
  id: string;
  email: string;
  password_hash: string;
  created_at: string;
};

export type DBProfile = {
  id: string; // = id del usuario
  tenant_id: string | null; // null = superadmin global
  full_name: string;
  email: string;
  phone: string | null;
  role: "superadmin" | "owner" | "staff";
};

export type DBTenant = {
  id: string;
  name: string;
  slug: string;
  plan: string;
  status: string;
  primary_color: string;
  logo_url: string | null;
  logo_text: string | null;
  description: string | null;
  phone: string | null;
  address: string | null;
  alias_cbu: string | null;
  banco: string | null;
  titular: string | null;
  trial_ends_at: string | null;
  created_at: string;
  updated_at: string;
};

export type DBStaffMember = StaffMember & {
  tenant_id: string;
  created_at: string;
};

export type DBService = Service & {
  tenant_id: string;
  active: boolean;
  created_at: string;
};

export type DBServiceStaff = {
  id: string;
  tenant_id: string;
  service_id: string;
  staff_id: string;
  created_at: string;
};

export type DBBusinessHours = BusinessHours & {
  tenant_id: string;
  created_at: string;
};

export type DBClient = {
  id: string;
  tenant_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  created_at: string;
};

export type DBBooking = {
  id: string;
  tenant_id: string;
  service_id: string;
  staff_id: string;
  client_id: string;
  starts_at: string; // "YYYY-MM-DD HH:MM:SS" (hora local del negocio)
  ends_at: string;
  status: BookingStatus;
  notes: string | null;
  created_at: string;
};

export type DBSubscription = {
  id: string;
  tenant_id: string;
  plan: string;
  status: string;
  current_period_start: string | null;
  current_period_end: string | null;
  created_at: string;
};

export type DBSellerAccount = {
  id: string;
  tenant_id: string;
  mp_user_id: string;
  access_token: string | null;
  refresh_token: string | null;
  commission_pct: number;
  connected_at: string;
};

export type DBPaymentStatus = "pending" | "paid" | "refunded" | "failed";

export type DBPayment = {
  id: string;
  tenant_id: string;
  booking_id: string | null;
  amount: number;
  method: "local" | "mercado_pago";
  status: DBPaymentStatus;
  mp_payment_id: string | null;
  receipt_url: string | null;
  created_at: string;
};

export type DBSubscriptionPayment = {
  id: string;
  tenant_id: string;
  subscription_id: string | null;
  amount: number;
  status: "pending" | "paid" | "refunded" | "cancelled";
  receipt_url: string | null;
  period_start: string | null;
  period_end: string | null;
  created_at: string;
  processed_at: string | null;
};

export type DB = {
  users: DBUser[];
  profiles: DBProfile[];
  tenants: DBTenant[];
  staff_members: DBStaffMember[];
  services: DBService[];
  service_staff: DBServiceStaff[];
  business_hours: DBBusinessHours[];
  clients: DBClient[];
  bookings: DBBooking[];
  subscriptions: DBSubscription[];
  seller_accounts: DBSellerAccount[];
  payments: DBPayment[];
};