// Envio de e-mails transacionais via Resend, template branco moderno com o verde da marca.
const RESEND_API_KEY = process.env.RESEND_API_KEY!;
const EMAIL_FROM = process.env.EMAIL_FROM ?? "Atyvo Group <no-reply@atyvo.com.br>";
const DASH_URL = process.env.DASH_URL ?? "https://dash.atyvo.com.br/login";
const GREEN = "#e0ff92";

const brl = (v: number) =>
  `R$ ${Math.abs(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const signed = (v: number) => (v < 0 ? "- " : "") + brl(v);

type Shell = {
  pre: string;
  head: string;
  intro: string;
  stat?: [string, string];
  rows?: [string, string][];
  cta?: string;
  url?: string;
  tone?: "neg";
};

function shell({ pre, head, intro, stat, rows, cta, url = DASH_URL, tone }: Shell) {
  let statbg = "#f5ffd8",
    statborder = "#e7f5ba",
    big = "#111418";
  if (tone === "neg") {
    statbg = "#fff1f1";
    statborder = "#ffd9d9";
    big = "#c62828";
  }
  const statHtml = stat
    ? `<tr><td style="padding:4px 0 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${statbg};border:1px solid ${statborder};border-radius:16px;"><tr><td style="padding:20px 22px;"><div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:11px;font-weight:800;letter-spacing:.6px;text-transform:uppercase;color:#8a9a4a;">${stat[0]}</div><div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:32px;font-weight:800;color:${big};margin-top:6px;line-height:1;">${stat[1]}</div></td></tr></table></td></tr>`
    : "";
  const rowsHtml = rows?.length
    ? `<tr><td style="padding:14px 0 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows
        .map(
          ([k, v]) =>
            `<tr><td style="padding:11px 0;border-top:1px solid #f0f2f5;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:14px;color:#6b7280;">${k}</td><td style="padding:11px 0;border-top:1px solid #f0f2f5;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:14px;font-weight:700;color:#111418;text-align:right;">${v}</td></tr>`
        )
        .join("")}</table></td></tr>`
    : "";
  const ctaHtml = cta
    ? `<tr><td style="padding:24px 0 2px;"><a href="${url}" style="display:inline-block;background:${GREEN};color:#111418;text-decoration:none;font-weight:800;font-size:15px;padding:15px 32px;border-radius:12px;">${cta} &nbsp;&rarr;</a></td></tr>`
    : "";
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light"></head>
<body style="margin:0;padding:0;background:#ffffff;">
<span style="display:none;opacity:0;color:#fff;height:0;width:0;overflow:hidden;">${pre}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;"><tr><td align="center" style="padding:36px 16px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #edeff3;border-radius:22px;overflow:hidden;box-shadow:0 8px 30px rgba(17,20,24,.06);">
    <tr><td style="height:6px;background:${GREEN};font-size:0;line-height:0;">&nbsp;</td></tr>
    <tr><td style="padding:28px 34px 0;"><div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-weight:800;font-size:17px;color:#111418;">Atyvo Group</div></td></tr>
    <tr><td style="padding:22px 34px 34px;">
      <h1 style="margin:0 0 12px;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:23px;line-height:1.3;font-weight:800;color:#111418;">${head}</h1>
      <div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:15px;line-height:1.65;color:#4b5563;">${intro}</div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${statHtml}${rowsHtml}${ctaHtml}</table>
    </td></tr>
  </table>
  <div style="max-width:560px;margin:18px auto 0;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:12px;line-height:1.7;color:#9aa1ac;text-align:center;">Atyvo Group &middot; e-mail automático da plataforma<br>Você recebeu porque tem acesso à dashboard.</div>
</td></tr></table></body></html>`;
}

async function send(to: string, subject: string, html: string, text: string) {
  if (!RESEND_API_KEY) return { ok: false, error: "sem RESEND_API_KEY" };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: [to],
        subject,
        html,
        text,
        headers: { "X-Entity-Ref-ID": crypto.randomUUID() },
      }),
    });
    const j = await res.json().catch(() => ({}));
    return { ok: res.ok, id: j.id };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

export function emailAccess(to: string) {
  return send(
    to,
    "Seu acesso à dashboard da Atyvo Group",
    shell({
      pre: "Você recebeu acesso à dashboard.",
      head: "Acesso liberado 🎯",
      intro:
        "<p style='margin:0;'>Olá! Seu acesso à <b>dashboard da Atyvo Group</b> foi liberado. Entre para acompanhar suas campanhas, vendas e resultados em tempo real.</p>",
      cta: "Acessar a dashboard",
    }),
    `Você recebeu acesso à dashboard da Atyvo Group. Acesse: ${DASH_URL}`
  );
}

export function emailLogin(to: string) {
  const when = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  return send(
    to,
    "Login na sua conta Atyvo Group",
    shell({
      pre: "Um login foi realizado na sua conta.",
      head: "Login realizado",
      intro:
        "<p style='margin:0;'>Detectamos um acesso à sua conta. Se foi você, tudo certo. Caso não reconheça, altere sua senha.</p>",
      rows: [["Data e hora", when], ["Plataforma", "Dashboard Atyvo"]],
      cta: "Abrir a dashboard",
    }),
    `Login na sua conta Atyvo Group em ${when}. ${DASH_URL}`
  );
}

export function emailSale(
  to: string,
  d: { amount: number; product?: string | null; client?: string | null; method?: string | null }
) {
  const rows: [string, string][] = [];
  if (d.product) rows.push(["Produto", d.product]);
  if (d.client) rows.push(["Cliente", d.client]);
  if (d.method) rows.push(["Pagamento", d.method]);
  return send(
    to,
    `Venda aprovada · ${brl(d.amount)}`,
    shell({
      pre: `Nova venda aprovada de ${brl(d.amount)}.`,
      head: "Nova venda aprovada 🎉",
      intro: "<p style='margin:0;'>Uma venda foi <b>aprovada</b> na sua operação:</p>",
      stat: ["Valor da venda", brl(d.amount)],
      rows,
      cta: "Ver no dashboard",
    }),
    `Venda aprovada: ${brl(d.amount)}. ${DASH_URL}`
  );
}

export function emailLoss(to: string, d: { net: number; spend: number; revenue: number }) {
  return send(
    to,
    "Atenção: sua operação está em prejuízo",
    shell({
      pre: `Sua conversão líquida está negativa (${signed(d.net)}).`,
      head: "Alerta de prejuízo",
      intro:
        "<p style='margin:0;'>Sua <b>conversão líquida</b> está negativa no período. Vale revisar campanhas e criativos.</p>",
      stat: ["Resultado líquido", signed(d.net)],
      rows: [["Gasto", brl(d.spend)], ["Receita", brl(d.revenue)], ["Período", "Últimos 30 dias"]],
      cta: "Analisar no dashboard",
      tone: "neg",
    }),
    `Alerta de prejuízo. Líquido ${signed(d.net)}. ${DASH_URL}`
  );
}
