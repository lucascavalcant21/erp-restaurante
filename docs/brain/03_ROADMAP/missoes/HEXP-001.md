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
atualizado_em: 2026-10-14
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
