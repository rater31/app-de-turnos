export type TenantPublic = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logo_url: string | null;
  primary_color: string;
  address: string | null;
  phone: string | null;
};

export type Service = {
  id: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  price: number;
  requires_deposit: boolean;
  deposit_amount: number | null;
};

export type StaffMember = {
  id: string;
  name: string;
  color: string;
  active: boolean;
};

export type ServiceStaff = {
  service_id: string;
  staff_id: string;
};

export type BusinessHours = {
  id: string;
  staff_id: string | null;
  day_of_week: number;
  opens: string;
  closes: string;
  active: boolean;
};

export type Booking = {
  id: string;
  service_id: string;
  staff_id: string;
  client_id: string;
  starts_at: string;
  ends_at: string;
  status: "pending" | "confirmed" | "completed" | "cancelled" | "no_show";
  notes: string | null;
  created_at: string;
  services: Pick<Service, "name" | "duration_minutes" | "price"> | null;
  staff_members: Pick<StaffMember, "name" | "color"> | null;
  clients: Pick<{ id: string; name: string; phone: string | null }, "name" | "phone"> | null;
};

// Fila de turno con relaciones embebidas (resultado de un .select con joins).
export type BookingRow = {
  id: string;
  starts_at: string;
  ends_at: string;
  status: Booking["status"];
  notes: string | null;
  services: { name: string; duration_minutes: number; price: number } | null;
  staff_members: { name: string; color: string } | null;
  clients: { name: string; phone: string | null } | null;
};