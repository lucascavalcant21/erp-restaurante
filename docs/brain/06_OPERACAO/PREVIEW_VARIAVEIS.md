# Preview: variáveis para validar as telas (15/10/2026)

Levantado do código (`process.env.*` em `app/`). **Só nomes, nunca valores.**
Estado na Vercel: NÃO VALIDADO. O conector da Vercel deu 403 no escopo `lucas-cavalcante`
e o CLI local não está linkado ao projeto.

## Recomendado: Supabase isolado de testes
Crie um projeto Supabase separado, com o esquema de produção e só dados sintéticos.
O Preview **não** aponta para o banco de produção.

| Variável | Ambiente Vercel | Tipo | Observação |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Preview | pública | URL do Supabase **de testes** |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Preview | pública | chave anon do Supabase de testes (protegida por RLS) |
| `NEXT_PUBLIC_HEFISTO_ENV` | Preview | pública | `preview` (faixa de ambiente na tela) |
| `NEXT_PUBLIC_SITE_URL` | Preview | pública | opcional; links de convite e e-mail |
| `NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA` | automática | pública | a Vercel preenche |

## Telas que precisam de rota de servidor
Usuários e Perfis (`/api/admin/access-control`), export e OCR.

| Variável | Ambiente | Regra |
|---|---|---|
| `SUPABASE_URL` | Preview | mesma URL do Supabase de testes |
| `SUPABASE_SERVICE_ROLE_KEY` | Preview | **só a do Supabase de TESTES**. Nunca a de produção; nunca com `NEXT_PUBLIC_` |

## Deixar FORA do Preview
`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `IFOOD_*`, `WHATSAPP_*`, `YCLOUD_*`, `FISCAL_API_*`, `SAIPOS_INTEGRATION_SECRET`,
`INTEGRATION_MASTER_KEY`, `RESEND_API_KEY`, `RH_LINK_SECRET`, `CRON_SECRET`.
Sem elas, as rotas respondem "não configurado" e não chamam serviço real.

## Depende de configuração manual do dono
1. Criar o Supabase de testes e aplicar o esquema (e as migrações de `db/security`).
2. Cadastrar as variáveis acima no ambiente **Preview** da Vercel.
3. Dar ao conector da Vercel acesso ao escopo `lucas-cavalcante`, ou rodar `vercel link`, para conferir.
4. Criar logins sintéticos por perfil (super admin, gerente-geral, cozinheiro, somente-consulta, tablet do ponto) para os testes negativos.
