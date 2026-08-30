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
  description: string | null;
  phone: string | null;
  address: string | null;
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
};