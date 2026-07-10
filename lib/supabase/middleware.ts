import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Bloqueio por DISPOSITIVO (user-agent), não por tamanho de tela.
const MOBILE_UA =
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|Tablet|Silk|Kindle|PlayBook|Windows Phone/i;

const BLOCK_HTML = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Acesso restrito</title></head><body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0a0b0f;color:#edf0f6;font-family:system-ui,-apple-system,sans-serif;padding:28px;box-sizing:border-box"><p style="max-width:340px;text-align:center;font-size:16px;font-weight:700;line-height:1.55;margin:0">Não é possível acessar essa plataforma por mobile.</p></body></html>`;

export async function updateSession(request: NextRequest) {
  // Antes de tudo (inclusive login): dispositivos móveis são bloqueados.
  const ua = request.headers.get("user-agent") || "";
  if (MOBILE_UA.test(ua)) {
    return new NextResponse(BLOCK_HTML, {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isAuthRoute = path === "/login" || path.startsWith("/auth");
  const isApi = path.startsWith("/api");

  // Sem sessão em rota protegida -> login (APIs tratam o próprio 401)
  if (!user && !isAuthRoute && !isApi && path !== "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Com sessão tentando acessar login -> dashboard
  if (user && (path === "/login" || path === "/")) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return response;
}
