import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/session";

function getAppUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.redirect(`${getAppUrl()}/login`);

  const clientId = process.env.MP_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json(
      { error: "MP_CLIENT_ID no configurado. Revisá tu .env.local" },
      { status: 500 },
    );
  }

  const redirectUri = `${getAppUrl()}/api/mercadopago/callback`;
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
  });

  const authUrl = `https://auth.mercadolibre.com.ar/authorization?${params.toString()}`;
  return NextResponse.redirect(authUrl);
}
