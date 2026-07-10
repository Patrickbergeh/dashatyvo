# Facebook Ads Analytics Dashboard

Plataforma moderna de analytics de vendas e gastos no Facebook/Meta Ads.
Next.js 14 (App Router) + Supabase (Auth, Postgres com RLS, Edge Functions).

## Rodar localmente

```bash
npm install
npm run dev        # http://localhost:4567
```

1. Acesse `http://localhost:4567` → tela de **login** (com cadastro).
2. Crie uma conta (o profile é criado automaticamente por trigger).
3. Para ver dados de exemplo, rode `supabase/seed.sql` no SQL Editor do Supabase.

## Banco de dados

O schema já foi aplicado no projeto Supabase. Tabelas (todas com **RLS**, cada
usuário só vê os próprios dados):

| Tabela | Função |
|--------|--------|
| `profiles` | Perfil do usuário (criado por trigger no signup) |
| `facebook_integrations` | Token e conta de anúncios conectada ao Meta |
| `ad_metrics` | Base dos KPIs: gasto, cliques, impressões, vendas, receita por dia/campanha |
| `webhook_events` | Log bruto dos webhooks recebidos do Facebook |
| `ad_kpis_daily` (view) | KPIs agregados por dia (ROAS, CPC, CPA, conversão) |

Reaplicar o schema: rode `supabase/migrations/0001_init.sql` no SQL Editor.

## KPIs do dashboard

- **Vendas** — nº de conversões
- **ROAS** — receita ÷ gasto
- **Valor gasto** — investimento total
- **CPC** — gasto ÷ cliques
- **CPA** — gasto ÷ vendas
- **Taxa de conversão** — vendas ÷ cliques

## Edge Functions

Deploy (com a Supabase CLI logada no projeto `SEU-PROJETO-REF`):

```bash
supabase functions deploy facebook-webhook --no-verify-jwt
supabase functions deploy facebook-sync

# secrets usados pelas functions
supabase secrets set FACEBOOK_WEBHOOK_VERIFY_TOKEN=meu_token_secreto_meta
```

### `facebook-webhook`
Recebe os webhooks do Meta (verificação `hub.challenge` + eventos de gasto).
Grava em `webhook_events` e faz upsert em `ad_metrics`.
URL de callback: `https://SEU-PROJETO-REF.supabase.co/functions/v1/facebook-webhook`

### `facebook-sync`
Puxa insights da Meta Marketing API (`/insights`) e grava em `ad_metrics`.
Chamada autenticada: `POST /functions/v1/facebook-sync` com `{ ad_account_id, days }`.

## Design

- Sem navbar com logo/nome — topo minimalista com filtro de período e conta.
- Toggle **modo escuro / claro** (persistido em `localStorage`).
- Fonte **Instrument Sans** (Regular 400 / Bold 700).
- Inputs sem borda/anel novo no foco ou hover; campo de senha com olho de revelar.
