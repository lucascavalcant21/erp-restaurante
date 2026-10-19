---
id: HEXP-001
titulo: Héfisto Experience — O Restaurante na Palma da Mão
fase: produto
status: IN_PROGRESS
prioridade: 1
dependencias: []
bloqueadores: []
tentativas: 1
sem_progresso: 0
mesma_falha: 0
ultima_falha: ""
atualizado_em: 2026-10-19
---

# HEXP-001 — Héfisto Experience: O Restaurante na Palma da Mão

## Objetivo

Transformar o Héfisto em uma plataforma de atendimento gastronômico inteligente integrada aos módulos existentes (Salão/Mesas, KDS, Estoque, Fichas Técnicas, CRM e Financeiro), iniciando pelo Seldeestrela em Foz do Iguaçu e com arquitetura multi-tenant pronta para comercialização SaaS.

## Princípios
- Aproveitar 100% o ERP existente (sem criar um sistema paralelo).
- Experiência do cliente sem login obrigatório, focada em botões e escolhas visuais.
- Preços, totais e integridade validados estritamente no servidor (SEC-DADOS-2).
- Design premium em tons quentes, mobile-first e multilíngue (PT, EN, ES).
- Integração direta às comandas da mesa e roteamento KDS (Cozinha/Bar).

## Fases
- [x] **Fase 0 — Auditoria Técnica e Arquitetura**
- [ ] **Fase 1 — Experience Funcional** (Cardápio digital rico, sessão de mesa, carrinho, envio de pedidos à mesa/KDS, chamadas de garçom, painel do salão e testes)
- [ ] **Fase 2 — Concierge IA** (Recomendações gastronômicas, navegação guiada por botões, consulta contextual de harmonização e fichas técnicas)
- [ ] **Fase 3 — Campanhas Inteligentes** (Painel de campanhas IA no ERP, upsell e métricas de conversão)
- [ ] **Fase 4 — Héfisto Discover** (História do prato, ingredientes interativos, cultura gastronômica)
- [ ] **Fase 5 — Operação Avançada** (Comanda compartilhada, divisão de conta, CRM com consentimento LGPD)
- [ ] **Fase 6 — Produto Comercial SaaS** (Multiempresa completo, temas personalizáveis, telemetria)

## Arquivos Afetados
- `docs/brain/03_ROADMAP/missoes/HEXP-001.md`
- `app/lib/server/experience.mjs`
- `app/lib/experience.test.mjs`
- `app/api/public/experience/**`
- `app/experience/[unidade]/[mesa]/page.js`
- `app/experience/[unidade]/page.js`
- `app/dashboard/salao/mesas/page.js`
- `app/dashboard/experience/**`
- `db/MIGRACAO_EXPERIENCE_HEXP_001.sql`

## Rodada 19/10/2026 — Fase 1 pelo cardápio digital

**Resultado (o que mudou para o dono):**
- A experiência da mesa agora é o **cardápio digital** (`/cardapio/[unidade]?mesa=N`, PR #187 em produção): cardápio da ficha técnica, carrinho, pedido da mesa → painel de pedidos online → KDS, 8 idiomas. Os links e QR antigos do Experience (`/experience/...`) abrem o cardápio com a mesma mesa. O `ExperienceApp` antigo não é mais usado (código morto).
- **Chamar garçom e pedir a conta** no modo mesa: botões no topo e sino na barra (folha com garçom, conta, água e talheres), nos 8 idiomas; "Avisado" por 1 minuto; outro celular da mesma mesa não abre chamado repetido.
- **Salão (Frente de Loja):** faixa amarela quando uma mesa chama; botão de chamados também no celular e no tablet (antes só em tela de computador); hora do chamado no fuso do aparelho (antes UTC).
- Servidor: mesa "Mesa 5" = "5" e liga ao cadastro do Salão; chamado repetido = "equipe já avisada"; unidade inexistente = 404.
- **CHAMADOS-1 aplicada no banco real em 19/10** (APR-015, sim do dono): impressão digital 479c60f3e90fae069d1b785189a8ce22; ensaio desfeito (repetido bloqueado, equipe vê e atende, anônimo bloqueado). TESTADO NO SUPABASE REAL.

**Evidências:**
- TESTADO LOCAL: migração no PGlite 5/5 (`app/lib/chamados-banco.test.mjs`); servidor 13/13 (`app/lib/experience.test.mjs`); idiomas 17/17; app/lib 632/632 com PGLITE; build OK.
- TESTADO EM MOCK (Playwright): sem a tabela (aviso para acenar; delivery sem botão) e com a tabela simulada (garçom, conta, repetido, japonês, Salão no computador e no celular). Sem erros no console.
- TESTADO NO SUPABASE REAL: mesas com `numero` "Mesa 1…21"; CHAMADOS-1 aplicada (impressão digital igual à do PGlite) e ensaio de escrita desfeito.
- NÃO VALIDADO: preview autenticado e produção.

**Fases seguintes:** Concierge IA e Campanhas (fases 2 e 3) ficam para depois; a conversa do cardápio ("me ajuda a escolher") já cobre a recomendação sem IA, com dado real.

