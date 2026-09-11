import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

const knownSlugs = new Map<string, number>();
const KNOWN_TTL_MS = 10 * 60 * 1000;

function getClient(): SupabaseClient {
  if (!client) {
    client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          detectSessionInUrl: false,
          persistSession: false,
          autoRefreshToken: false,
        },
      },
    );
  }
  return client;
}

async function slugsExists(slug: string): Promise<boolean> {
  const { data } = await getClient()
    .from("tenants")
    .select("id")
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle();
  return Boolean(data);
}

const NOT_FOUND_HTML = `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"/><meta name="robots" content="noindex"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>TurnoFácil — Página no encontrada</title><style>body{font-family:system-ui,Segoe UI,Roboto,Arial,sans-serif;background:#f8fafc;color:#0f172a;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}.card{text-align:center;max-width:24rem;padding:2rem}.logo{display:inline-flex;align-items:center;gap:.5rem;font-weight:700}.logo span{display:flex;width:2rem;height:2rem;align-items:center;justify-content:center;border-radius:.5rem;background:#4f46e5;color:#fff;font-size:1rem}h1{font-size:1.5rem;margin:.75rem 0 .25rem}p{color:#64748b;font-size:.95rem;line-height:1.5;margin:0 0 1.5rem}a{display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;font-weight:600;font-size:.9rem;padding:.6rem 1.2rem;border-radius:.6rem}</style></head><body><div class="card"><div class="logo"><span>TF</span>TurnoFácil</div><h1>Página no encontrada</h1><p>Ese enlace no corresponde a ning\u00fan negocio.<br/>Verific\u00e1 la direcci\u00f3n o volv\u00e9 al inicio.</p><a href="/">Ir a TurnoFácil</a></div></body></html>`;

function isBusinessPath(pathname: string): string | null {
  if (pathname.startsWith("/abonar/")) {
    const slug = pathname.slice("/abonar/".length);
    return slug && !slug.includes("/") ? slug : null;
  }
  if (
    pathname === "/" ||
    pathname.includes(".") ||
    /^\/(api|_next|login|registro|panel|admin|abonar|favicon|robots|sitemap|manifest|_error)[/]?$/.test(pathname)
  ) {
    return null;
  }
  const slug = pathname.slice(1);
  return /^[a-z0-9-]+$/.test(slug) ? slug : null;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const slug = isBusinessPath(pathname);
  if (!slug) return NextResponse.next();

  const now = Date.now();
  const knownAt = knownSlugs.get(slug);
  if (knownAt !== undefined && now - knownAt < KNOWN_TTL_MS) {
    return NextResponse.next();
  }

  const exists = await slugsExists(slug);
  if (exists) {
    knownSlugs.set(slug, now);
    return NextResponse.next();
  }

  return new NextResponse(NOT_FOUND_HTML, {
    status: 404,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

export const config = {
  matcher: ["/abonar/:slug", "/((?!api|_next|login|registro|panel|admin|favicon)[a-z0-9-]+)"],
};