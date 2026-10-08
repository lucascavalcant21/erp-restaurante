# Segurança

## Achados abertos (por gravidade)

| # | Achado | Gravidade | Evidência | Situação |
|---|---|---|---|---|
| S-01 | `colaboradores` e `registro_ponto` com **RLS desligado**: qualquer usuário logado lê salário, CPF e ponto | CRÍTICO | TESTADO NO SUPABASE REAL (advisor ERROR, 07/10) | Aguarda aprovação do dono ([[HDEV-008]]) |
| S-02 | Policies `using (true)` em `insumos`, `estoques`, `etiquetas`, `unidades`, `usuarios_erp`, `rh_recibos_prestacao`, `colaboradores`: um usuário de uma empresa lê as outras | CRÍTICO para multiempresa (hoje só há 1 empresa) | TESTADO NO SUPABASE REAL (isolamento com tenant B, 07/10) | Aguarda aprovação ([[HDEV-008]]) |
| S-03 | Fase 1A/1B de segurança não aplicada; os arquivos da 1A nem estão no repositório | ALTO | Banco sem `hefisto_contexto_requisicao` | Planejar |
| S-04 | Rotas `app/api/ia-*` (17) sem checagem de sessão | ALTO (custo de API e abuso) | Leitura do código, 08/10 | Backlog |
| S-05 | `app/api/saas/export` sem autenticação (cliente anon) | ALTO | Leitura do código | Backlog |
| S-06 | Webhook do WhatsApp aceita POST sem assinatura; token de verificação com padrão literal | ALTO quando ativado | Leitura do código | Refazer no HI-06 |
| S-07 | `ANTHROPIC_API_KEY` no Vercel não marcada Sensitive (`readable-secret`) | MÉDIO | Vercel, 07/10 | Dono marca Sensitive |
| S-08 | Funções SECURITY DEFINER executáveis por `anon` (ex.: `hefisto_session_context`, `excluir_insumo_cascata`) | MÉDIO | Advisor. `excluir_insumo_cascata` confere `auth.role()` e recusa anon | Revisar caso a caso |
| S-09 | Guarda de página só vale para sessão `gerenciado` | MÉDIO | `app/dashboard/layout.js` | Backlog |
| S-10 | PIN do estoque começa como `1234` | MÉDIO | EST-MOV-1 | Exigir troca |
| S-11 | `CRON_SECRET` com valor padrão no código legado | MÉDIO | `api/hefisto/automation/cron` | Backlog |
| S-12 | Proteção contra senha vazada desligada no Supabase Auth | BAIXO | Advisor | Dono liga no painel |

## O que já protege (validado)

- **Intelligence Core:**
  - contexto resolvido no banco;
  - banco escopado com verificação linha a linha;
  - auditoria imutável;
  - service role só no servidor e fora do bundle (TESTADO LOCAL: varredura do `.next/static`);
  - isolamento com segundo tenant (TESTADO NO SUPABASE REAL).
- **Estoque:**
  - `estoque_movimentar` recusa quem não tem permissão (TESTADO NO SUPABASE REAL);
  - histórico imutável (EST-MOV-1).
- **Catálogo de rotas:** nenhuma tela cai na entrada genérica `/dashboard` (trava em teste, TESTADO LOCAL).

## Regras permanentes

- `SUPABASE_SERVICE_ROLE_KEY` nunca vai ao navegador, a `NEXT_PUBLIC_`, a log ou ao bundle.
- Segredo nunca entra no chat, no código, em commit ou neste cérebro. Só o NOME da variável.
- Tenant vem do banco, nunca do corpo da requisição.
- Mudança de RLS, policy ou grant em produção é **ação crítica**: precisa de aprovação do dono e de transação com verificação. Ver [[REGRAS_DO_PROJETO]].
