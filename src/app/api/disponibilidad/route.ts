import { NextResponse } from "next/server";
import { getBookedSlotRows } from "@/lib/db/api";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tenant = searchParams.get("tenant");
  const staff = searchParams.get("staff");
  const date = searchParams.get("date");

  if (!tenant || !staff || !date) {
    return NextResponse.json({ slots: [] });
  }

  return NextResponse.json({ slots: await getBookedSlotRows(tenant, staff, date) });
}