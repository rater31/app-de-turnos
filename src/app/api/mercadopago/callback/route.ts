import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/session";
import { getUserWithTenant } from "@/lib/db/api";
import { saveSellerAccount } from "@/lib/db/api";

function getAppUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

export async function GET(request: Request) {
  const appUrl = getAppUrl();
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  const userId = await getSessionUserId();
  if (!userId) return NextResponse.redirect(`${appUrl}/login`);

  const userWithTenant = getUserWithTenant(userId);
  if (!userWithTenant?.tenant)
    return NextResponse.redirect(`${appUrl}/panel/ajustes?mp=error`);

  if (error || !code) {
    return NextResponse.redirect(`${appUrl}/panel/ajustes?mp=error`);
  }

  const clientId = process.env.MP_CLIENT_ID;
  const clientSecret = process.env.MP_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${appUrl}/panel/ajustes?mp=error`);
  }

  const redirectUri = `${appUrl}/api/mercadopago/callback`;

  try {
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    });

    const res = await fetch("https://api.mercadopago.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    if (!res.ok) {
      return NextResponse.redirect(`${appUrl}/panel/ajustes?mp=error`);
    }

    const data = (await res.json()) as {
      access_token: string;
      refresh_token: string;
      user_id: string;
    };

    saveSellerAccount(userWithTenant.tenant.id, {
      mp_user_id: String(data.user_id),
      access_token: data.access_token,
      refresh_token: data.refresh_token,
    });

    return NextResponse.redirect(`${appUrl}/panel/ajustes?mp=ok`);
  } catch {
    return NextResponse.redirect(`${appUrl}/panel/ajustes?mp=error`);
  }
}
