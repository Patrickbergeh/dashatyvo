// Envio de e-mails transacionais via Resend, com template branco moderno.
// Boas práticas p/ cair na caixa de entrada (evitar Promoções/Social):
//  - conteúdo transacional, texto claro, 1 CTA, sem imagens pesadas
//  - versão em texto puro (multipart), remetente com nome real
//  - domínio verificado no Resend (SPF/DKIM/DMARC)

const RESEND_API_KEY = process.env.RESEND_API_KEY!;
const EMAIL_FROM = process.env.EMAIL_FROM ?? "Atyvo Group <no-reply@atyvo.com.br>";
const DASH_URL = process.env.DASH_URL ?? "https://dash.atyvo.com.br/login";

type Shell = {
  preheader: string;
  heading: string;
  body: string; // HTML dos parágrafos
  ctaLabel?: string;
  ctaUrl?: string;
};

function shell({ preheader, heading, body, ctaLabel, ctaUrl }: Shell) {
  const cta =
    ctaLabel && ctaUrl
      ? `<tr><td style="padding:8px 0 4px;">
           <a href="${ctaUrl}" style="display:inline-block;background:#111418;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:13px 26px;border-radius:10px;">${ctaLabel}</a>
         </td></tr>`
      : "";
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"></head>
<body style="margin:0;background:#ffffff;">
<span style="display:none;opacity:0;color:#ffffff;height:0;width:0;overflow:hidden;">${preheader}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;">
  <tr><td align="center" style="padding:32px 16px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border:1px solid #eceef2;border-radius:16px;">
      <tr><td style="padding:26px 30px 0;">
        <div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-weight:800;font-size:16px;color:#111418;letter-spacing:.2px;">Atyvo Group</div>
      </td></tr>
      <tr><td style="padding:18px 30px 30px;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#111418;">
        <h1 style="margin:0 0 12px;font-size:20px;line-height:1.35;font-weight:800;color:#111418;">${heading}</h1>
        <div style="font-size:15px;line-height:1.6;color:#3b414b;">${body}</div>
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:14px;">${cta}</table>
      </td></tr>
    </table>
    <div style="max-width:480px;margin:16px auto 0;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:12px;line-height:1.6;color:#9aa1ac;text-align:center;">
      Atyvo Group · Este é um e-mail automático da plataforma.
    </div>
  </td></tr>
</table></body></html>`;
}

async function send(opts: {
  to: string;
  subject: string;
  html: string;
  text: string;
}) {
  if (!RESEND_API_KEY) return { ok: false, error: "sem RESEND_API_KEY" };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: [opts.to],
        subject: opts.subject,
        html: opts.html,
        text: opts.text,
        headers: { "X-Entity-Ref-ID": crypto.randomUUID() },
      }),
    });
    const j = await res.json().catch(() => ({}));
    return { ok: res.ok, id: j.id, error: res.ok ? undefined : JSON.stringify(j) };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

const brl = (v: number) =>
  `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// 1) Acesso concedido à dashboard
export function emailAccess(to: string) {
  return send({
    to,
    subject: "Seu acesso à dashboard da Atyvo Group",
    html: shell({
      preheader: "Você recebeu acesso à dashboard da Atyvo Group.",
      heading: "Você recebeu acesso à dashboard",
      body: `<p style="margin:0 0 10px;">Olá! Seu acesso à <b>dashboard da Atyvo Group</b> foi liberado.</p>
             <p style="margin:0;">Clique no botão abaixo para entrar na plataforma.</p>`,
      ctaLabel: "Acessar a dashboard",
      ctaUrl: DASH_URL,
    }),
    text: `Você recebeu acesso à dashboard da Atyvo Group. Acesse: ${DASH_URL}`,
  });
}

// 2) Login realizado
export function emailLogin(to: string) {
  const when = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  return send({
    to,
    subject: "Login na sua conta Atyvo Group",
    html: shell({
      preheader: "Um login foi realizado na sua conta.",
      heading: "Login realizado na sua conta",
      body: `<p style="margin:0 0 10px;">Detectamos um acesso à sua conta em <b>${when}</b>.</p>
             <p style="margin:0;">Se foi você, tudo certo. Caso não reconheça, altere sua senha.</p>`,
      ctaLabel: "Abrir a dashboard",
      ctaUrl: DASH_URL,
    }),
    text: `Login realizado na sua conta Atyvo Group em ${when}. ${DASH_URL}`,
  });
}

// 3) Venda aprovada
export function emailSale(
  to: string,
  data: { amount: number; product?: string | null; client?: string | null }
) {
  return send({
    to,
    subject: `Venda aprovada · ${brl(data.amount)}`,
    html: shell({
      preheader: `Nova venda aprovada de ${brl(data.amount)}.`,
      heading: "Nova venda aprovada 🎉",
      body: `<p style="margin:0 0 10px;">Uma venda foi <b>aprovada</b> na sua operação.</p>
             <p style="margin:0 0 4px;"><b>Valor:</b> ${brl(data.amount)}</p>
             ${data.product ? `<p style="margin:0 0 4px;"><b>Produto:</b> ${data.product}</p>` : ""}
             ${data.client ? `<p style="margin:0;"><b>Cliente:</b> ${data.client}</p>` : ""}`,
      ctaLabel: "Ver no dashboard",
      ctaUrl: DASH_URL,
    }),
    text: `Venda aprovada: ${brl(data.amount)}${data.product ? " · " + data.product : ""}. ${DASH_URL}`,
  });
}

// 4) Alerta de prejuízo
export function emailLoss(to: string, data: { net: number; spend: number; revenue: number }) {
  return send({
    to,
    subject: "Atenção: sua operação está em prejuízo",
    html: shell({
      preheader: `Sua conversão líquida está negativa (${brl(data.net)}).`,
      heading: "Alerta de prejuízo",
      body: `<p style="margin:0 0 10px;">Sua <b>conversão líquida</b> está negativa no período.</p>
             <p style="margin:0 0 4px;"><b>Resultado líquido:</b> ${brl(data.net)}</p>
             <p style="margin:0 0 4px;"><b>Gasto:</b> ${brl(data.spend)}</p>
             <p style="margin:0;"><b>Receita:</b> ${brl(data.revenue)}</p>`,
      ctaLabel: "Analisar no dashboard",
      ctaUrl: DASH_URL,
    }),
    text: `Alerta de prejuízo. Líquido ${brl(data.net)} · Gasto ${brl(data.spend)} · Receita ${brl(data.revenue)}. ${DASH_URL}`,
  });
}
