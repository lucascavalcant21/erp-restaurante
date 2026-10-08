# Integrações

_Só o que existe no código. Variáveis aparecem pelo NOME, nunca pelo valor._

| Integração | Estado | Onde | Variáveis |
|---|---|---|---|
| Supabase | Em uso | `app/lib/supabase.js`, `app/lib/server/supabase-server.mjs` | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (sensitive no Vercel) |
| Anthropic (Intelligence Core) | Implementada | `app/lib/intelligence/providers/anthropic.mjs` | `ANTHROPIC_API_KEY` (existe no Vercel; **não marcada Sensitive**), `HEFISTO_IA_MODELO`, `HEFISTO_IA_DESLIGADA` |
| Anthropic (rotas `ia-*`, `api/hefisto`) | Legada | `app/api/ia-*`, `app/api/hefisto` | `fetch` direto, modelos fixos no código |
| OpenAI | Legada | `ocr`, `ia-ata`, `ia-checklist`, `ia-insumos`, `ia-cardapio-fichas` | `OPENAI_API_KEY` |
| WhatsApp (Meta Cloud API) | **Parcial** | `app/api/channels/whatsapp/webhook`, `app/lib/server/channels/whatsapp/*`, `db/3a/` | `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET`, `WHATSAPP_API_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` (no Vercel só em preview) |
| iFood | Implementada | `app/lib/ifood.js`, `app/lib/integrations/ifood/adapter.mjs` | `IFOOD_CLIENT_ID`, `IFOOD_CLIENT_SECRET`, `IFOOD_API_BASE`, `IFOOD_WEBHOOK_SECRET` |
| Saipos | Parcial | `app/lib/integrations/saipos/adapter.mjs` | `SAIPOS_INTEGRATION_SECRET` (o registro usa `SAIPOS_INTEGRACAO_SECRET`: **nomes diferentes**) |
| E-mail (Resend) | Implementada | `app/api/comprovante-email` | `RESEND_API_KEY`, `COMPROVANTE_REMETENTE` |
| Fiscal | Stub | `app/api/fiscal/emitir` (503 sem config) | `FISCAL_API_URL`, `FISCAL_API_TOKEN` |
| Firebase | Legada | `backend_cloud_code/` | `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` |
| PagSeguro | Mock | `app/lib/pagseguro.js` | — |
| Google | Ausente | só `next/font`, links do Maps | — |
| Meta / Instagram | Planejada | registro em `app/lib/server/integracoes.mjs` | `INSTAGRAM_APP_SECRET` |
| Push | Ausente | `public/sw.js` é só cache de PWA | — |
| Voz | Navegador | `app/lib/intelligence/voice/voice-provider.js`, `app/lib/hefisto-voz.js` | — |

## WhatsApp hoje: atenção

O webhook encaminha para o **agente legado** (`hefisto-intents.js`, `confirmation-engine.js`) com o cliente anon.
- A verificação HMAC é **pulada** quando falta o segredo ou o cabeçalho de assinatura.
- O token de verificação tem um valor padrão literal no código.

Não estender esse caminho. O HI-06 refaz o canal sobre o Intelligence Core, com:
- assinatura obrigatória;
- identidade do dono;
- fila de comandos.

Ver [[ROADMAP]] e [[SEGURANCA]].

## Futuras (preparar, não implementar agora)

- **Google:** Search Console, Business Profile, Gmail, Drive, Sheets, Analytics.
- **Meta:** Facebook, Instagram, WhatsApp Business Platform, Ads.
- Sempre por API oficial e com permissão mínima. Os pedidos de acesso vão em [[ACESSOS_NECESSARIOS]].
