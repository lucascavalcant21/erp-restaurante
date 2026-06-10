# PROJECT_CONTEXT.md — Cerebro ERP (FoodERP)
> Documento mestre de contexto. Abra uma conversa nova colando/anexando este arquivo para continuar o desenvolvimento sem perder contexto.
> Última atualização: 2026-06-09.

---

## 1. RESUMO EXECUTIVO
**Cerebro ERP** (pasta/repo: FoodERP) é um **ERP de rede para food service** (restaurantes), pensado para uma **Matriz (Central) que observa e controla 3 lojas independentes**: **Seldeestrela**, **Tico Tico Saladas** e **Burguer**. Cada loja opera sozinha (estoque, cardápio, equipe, caixa próprios) e a Central consolida/compara tudo.

Cobre: Operação (estoque, ingredientes, cardápio, fichas técnicas, fornecedores, eventos, rotina, **etiquetas QR + rastreio + validade/perdas**), Financeiro (DRE, fluxo de caixa, CMV, margem, documentos), RH (gestão, ponto, **portal do colaborador**), Clientes (CRM, NPS, campanhas), IA assistente (Heitor), Dashboard com BI (KPIs com variação %, gráficos) e Visão de Rede.

- **Status:** funcional e **publicado em produção**. ~30 módulos recriados sobre um design system. Auth real + banco seguro (RLS). **PDV/Vendas construído** (fecha o ciclo venda→receita→estoque) — falta apenas **rodar `docs/vendas.sql` no Supabase** para criar as tabelas. Pendências principais: **cadastrar dados reais** e **RLS por unidade**.
- **Site:** https://erp-restaurante-sand.vercel.app
- **Repo GitHub:** `lucascavalcant21/erp-restaurante` — **branch de deploy = `main`** (Vercel publica de `main`).
- **Supabase project ref:** `sezccspqxgklicfndwxx` (nome: cerebro-erp, AWS sa-east-1, plano Free). Painel: https://supabase.com/dashboard/project/sezccspqxgklicfndwxx

---

## 2. OBJETIVO PRINCIPAL
Gerir uma **rede de 3 restaurantes** com:
- Cada unidade **independente** nos dados (multiunidade via `unidade_id`).
- Uma **Central/Matriz** que consolida e compara (faturamento, CMV, estoque, folha, perdas).
- Controle total: CMV, fichas técnicas, ingredientes, estoque, funcionários, validade de produtos (FEFO), perdas em R$, e muito mais.

---

## 3. ARQUITETURA ATUAL
- **Frontend:** Next.js 14 (App Router), React 18, componentes client-side (`"use client"`).
- **Backend de dados:** **Supabase** (PostgreSQL + Auth + Storage + REST/PostgREST). O app fala direto com o Supabase pelo client JS (sem backend próprio para CRUD).
- **Backend Express** (`backend_cloud_code/server.js`): existe para `/api` e `/webhook` (crons/triggers via vercel.json), pouco usado pelo app hoje.
- **Deploy:** Vercel (auto-deploy no push para `main`). HTTPS.
- **Design System:** tokens centralizados (CSS vars em `globals.css :root` + `tailwind.config.js`) → trocar tema = mexer num lugar só. Kit de UI em `app/components/ui.js`.
- **Padrão de dados:** cada domínio tem um arquivo em `app/lib/*.js` com funções `fetch*/inserir*/atualizar*/remover*` que: (a) checam `isSupabaseReady()`, (b) filtram/carimbam por unidade (`escoparPorUnidade`/`carimbarUnidade`).
- **Estado global:** `app/context/ERPContext.js` (estoque compartilhado, notificações, **unidade ativa**, papel/permissões de troca de unidade).

---

## 4. TECNOLOGIAS UTILIZADAS
- Next.js 14.2 (App Router) · React 18.3 · React-DOM 18.3
- Tailwind CSS 3.4 (+ postcss, autoprefixer)
- @supabase/supabase-js 2.49 (DB, Auth, Storage)
- lucide-react 0.383 (ícones)
- qrcode.react 4.2 (QR Code das etiquetas)
- express, cors, morgan, firebase-admin (backend_cloud_code — legado/cron)
- nodemon (dev)

---

## 5. ESTRUTURA DO BANCO DE DADOS (Supabase / Postgres)
Scripts SQL versionados em `docs/`:
- `docs/schema-completo.sql` — recria todas as tabelas operacionais/financeiras/clientes com `unidade_id` + RLS + bucket Storage. **Schema canônico** (casa com o app).
- `docs/migracao-multiunidade.sql` — adiciona `unidade_id` + tabela `unidades`.
- `docs/seguranca-rls.sql` — liga RLS + revoke anon + grant authenticated.
- `docs/rh-portal.sql` — tabelas de RH/Portal (documentos, holerites, avisos, advertências, produções, cursos) + bucket `anexos`.
- `docs/vendas.sql` — **PDV/Vendas**: tabelas `vendas` + `venda_itens` + RLS + índices. **(Rodar no Supabase para ativar o PDV.)**
- (Etiquetas/validade: tabela `etiquetas` + colunas `status`/`custo_unit` — SQL fornecido no chat; `setor` em cardapio/ingredientes idem.)

### Tabelas e principais colunas
- **unidades**: `id (text pk)`, nome, cor, ativo, created_at. Seed: seldeestrela, ticotico, burguer.
- **ingredientes**: id(uuid), nome, unidade(KG/L/UN/MACO/CX), preco_compra, custo_por_unidade_base, **setor**(Cozinha/Bar), unidade_id, created_at.
- **estoque**: id, nome, categoria, unidade, quantidade, minimo, preco_unit, custo_unitario, fornecedor, ultima_entrada, updated_at, unidade_id.
- **estoque_movimentacoes**: id, estoque_id→estoque, tipo(entrada/saida), quantidade, obs, unidade_id.
- **cardapio**: id, nome, categoria, preco, custo, descricao, ativo, **setor**(Cozinha/Bar), unidade_id.
- **fichas_tecnicas**: id, prato_id, nome, custo_total, unidade_id. **ficha_itens**: id, ficha_id→fichas_tecnicas, ingrediente_id, quantidade.
- **funcionarios**: id, nome, cargo, turno, salario, admissao, telefone, email, ativo, unidade_id. (E-mail = chave de ligação com o Portal do Colaborador.)
- **registros_ponto**: id, func_id→funcionarios, data, entrada(time), saida(time), obs, unidade_id, unique(func_id,data).
- **holerites**: id, func_id, mes, ano, bruto, liquido, detalhes(jsonb), arquivo_url, unidade_id.
- **func_documentos**: id, func_id, tipo, titulo, arquivo_url, unidade_id.
- **avisos**: id, titulo, corpo, tipo, func_id (null=todos), unidade_id, data.
- **advertencias**: id, func_id, gravidade, motivo, descricao, data, unidade_id.
- **producoes**: id, func_id, titulo, descricao, periodo(dia/semana), data, status, unidade_id.
- **cursos**: id, titulo, descricao, origem(empresa/colaborador), tipo_arquivo(pdf/video/link), arquivo_url, func_id(null=todos), unidade_id, status.
- **clientes**: id, nome, tel, total_gasto, total_pedidos, ultima_compra, unidade_id.
- **avaliacoes_nps**: id, nome, nota(0-10), comentario, data, unidade_id.
- **campanhas**: id, nome, tipo, descricao, cupom, desconto, inicio, fim, meta_clientes, clientes_atingidos, receita_gerada, status, unidade_id.
- **eventos**: id, nome, tipo, status, data, local, responsavel, convidados, valor_contrato, custo_estimado, observacoes, unidade_id.
- **fornecedores**: id, nome, segmento, contato, telefone, email, cidade, forma_pagamento, pedido_minimo, estrelas, ativo, total_compras, unidade_id.
- **documentos**: id, tipo, descricao, categoria, valor, emissao, vencimento, status, unidade_id.
- **lancamentos** (fluxo de caixa): id, tipo(entrada/saida), categoria, descricao, valor, data, unidade_id.
- **vendas** (PDV): id, subtotal, desconto, total, forma_pagamento(dinheiro/pix/credito/debito), cliente, observacao, status(concluida/cancelada), **lancamento_id**(receita gerada, p/ estorno), unidade_id, created_at.
- **venda_itens**: id, venda_id→vendas, cardapio_id, nome, preco_unit, custo_unit, quantidade, subtotal, unidade_id.
- **etiquetas**: id, codigo(unique), produto, conservacao, quantidade, unidade, validade_dias, manipulacao_em, validade_em, lote, responsavel, **status**(ativa/baixa/perda), **custo_unit**, unidade_id. (Leitura pública/anon p/ rastreio do QR.)

### Relacionamentos
- Tudo → `unidades(id)` via `unidade_id` (escopo por loja).
- estoque_movimentacoes → estoque; ficha_itens → fichas_tecnicas; registros_ponto/holerites/func_documentos/avisos/advertencias/producoes/cursos → funcionarios; avaliacoes_nps → clientes (cliente_id, quando usado).
- **Portal do Colaborador ↔ funcionário:** ligação por **e-mail** (e-mail do funcionário = e-mail de login no Supabase Auth).

### Segurança (RLS)
- RLS **ligado** em todas as tabelas; `REVOKE ALL ... FROM anon` + `GRANT ... TO authenticated` + policy `for all to authenticated`.
- Exceção: **etiquetas** tem leitura pública (anon SELECT) para o rastreio do QR funcionar sem login.
- Storage bucket **`anexos`** (público p/ leitura, escrita só autenticado).

---

## 6. APIS / INTEGRAÇÕES
**Integradas:** Supabase (Postgres/Auth/Storage), GitHub (repo), Vercel (deploy).
**Planejadas/futuras:** PDV (iFood/Saipos) para vendas em tempo real, e-mail SMTP próprio (reset de senha), Firebase (admin já como dependência, pouco usado).

---

## 7. FUNCIONALIDADES — CONCLUÍDAS
- ✅ Multiunidade (Central + 3 lojas) com seletor de unidade e escopo por `unidade_id`.
- ✅ **PDV / Vendas** (`/dashboard/vendas`): catálogo (pratos ativos do Cardápio) → carrinho com +/− → checkout (forma de pagamento, desconto, cliente) → **registra venda** (`vendas`/`venda_itens`), **gera receita** automática no Fluxo de Caixa (alimenta DRE/Dashboard) e **dá baixa de estoque** via ficha técnica (melhor esforço, por nome do ingrediente). Histórico do dia + **cancelar venda** (estorna a receita). Papel **caixa** abre direto no PDV. *(Depende de rodar `docs/vendas.sql`.)*
- ✅ **Operação:** Estoque (CRUD + entrada/saída + valor), Ingredientes (custo por unidade-base; sincroniza p/ Estoque), Cardápio (preço/custo/CMV/MC + setor Cozinha/Bar), Fichas Técnicas (montagem de receita por setor), Fornecedores, Eventos, Rotina (checklist abertura/fechamento).
- ✅ **Etiquetas QR:** criação (produto, conservação, validade por dias **ou data**, presets de validade do usuário, lote, responsável, CNPJ), preview 60×40/60×60, impressão térmica (CSS print), **QR com rastreio público**, layout estilo KAIRU.
- ✅ **Controle de Validade (FEFO):** produtos por cor (vencido/vencendo/ok), dias p/ vencer, busca por código, **baixa (usado) / perda**, **área de Perdas com R$**, alertas.
- ✅ **Financeiro:** CMV, Margem (derivam do Cardápio), Fluxo de Caixa (lançamentos), Documentos (notas/boletos), DRE (deriva dos lançamentos).
- ✅ **RH:** Gestão de equipe, Ponto (entrada/saída do dia), **Portal do Colaborador** (vê holerites, documentos, avisos, advertências, produções, cursos, histórico de ponto — só os seus, por e-mail) e **gestão por funcionário** (RH cadastra/anexa tudo, com upload PDF/vídeo via Storage).
- ✅ **Clientes:** CRM, NPS (cálculo real), Campanhas.
- ✅ **Dashboard BI:** KPIs com **variação %** (Receita/Despesas/Lucro), filtro **Mensal/Trimestral/Anual**, gráfico **Receita × Despesa**, distribuição de despesas, estoque crítico, atalhos.
- ✅ **Visão de Rede:** consolidado financeiro, faturamento por unidade (comparativo), métricas por loja.
- ✅ **IA Heitor:** chat dirigido por dados reais (estoque/notificações).
- ✅ **Auth real** (Supabase Auth): login, cadastro (wizard), **lembrar-me**, **esqueci/redefinir senha**, logout, guard de rota, redirect por papel.
- ✅ **Permissões (RBAC)** por papel (menu filtrado + guard).
- ✅ **Segurança:** banco fechado (RLS), token GitHub exposto removido, senhas com hash.
- ✅ **Tema:** visual claro/profissional (estilo Ascend), minimalista, via design tokens.

## 8. FUNCIONALIDADES — EM DESENVOLVIMENTO / PARCIAIS
- ⚠️ Fichas Técnicas: monta e calcula custo, mas **persistência** das fichas no banco ainda é básica (foco no cálculo).
- ⚠️ Notificações: contexto pronto, mas **geração automática** (estoque crítico/validade) ainda é parcial/visual.
- ⚠️ Dados reais: tabelas vazias — depende de cadastro pelo usuário.

## 9. FUNCIONALIDADES — PENDENTES
- ⛔ RLS **por unidade** (hoje é "qualquer logado vê tudo"; falta restringir gerente à sua loja via claim/coluna do usuário). **Agora é a pendência nº 1.**
- ⚠️ PDV: baixa de estoque é por **nome** do ingrediente (ficha → estoque). Evoluir para FK real `ingrediente_id`/`estoque_id`. Cancelamento estorna a receita mas **não restaura estoque** automaticamente.
- ⛔ Perdas de validade lançadas automaticamente no Financeiro/DRE.
- ⛔ Notificações automáticas (validade vencendo, estoque crítico, metas).
- ⛔ Importação em massa / relatórios exportáveis (PDF existe lib `exportPDF.js`, pouco usada).

---

## 10. PERMISSÕES E USUÁRIOS (RBAC)
Definido em `app/lib/auth.js` (`PAPEIS`). Cada papel tem `home` (rota inicial) e `nav` (módulos visíveis). `podeAcessar(papel, navId)` + guard no layout.
| Papel | Home | Vê |
|------|------|----|
| admin | /dashboard | tudo (incl. Rede) |
| gerente | /dashboard | tudo da loja (sem Rede) |
| financeiro | /dashboard/financeiro/dre | painel, rede, dre, fluxo, cmv, margem, documentos |
| rh | /dashboard/rh/gestao | gestao_rh, ponto, colaborador |
| estoque | /dashboard/operacao/estoque | estoque, ingredientes, fichas, cardapio, fornecedores, etiquetas, validade |
| cozinha | /dashboard/operacao/cardapio | ingredientes, fichas, cardapio, estoque, etiquetas, validade |
| marketing | /dashboard/clientes/crm | crm, campanhas, nps |
| caixa | /dashboard/vendas | vendas (PDV), dashboard, notificações |

`podeVerTodas(papel)` (admin/financeiro) habilita o seletor de unidade/Central.

---

## 11. FLUXOS OPERACIONAIS
- **Ingrediente → Estoque:** ao cadastrar ingrediente, cria item no estoque (qtd 0) pronto p/ entrada.
- **Estoque ↔ Central:** página de Estoque sincroniza `itens` no ERPContext → Dashboard/IA/Notificações refletem.
- **Etiqueta → Rastreio → Validade → Perda:** cria etiqueta (Imprimir/Salvar grava no banco) → QR aponta p/ `/rastreio/[codigo]` (público) → entra no Controle de Validade → baixa(usado)/perda → Perdas (R$).
- **RH → Portal:** RH lança (holerite/aviso/curso/etc.) por funcionário → cai automático no Portal do colaborador (ligado por e-mail).
- **Fluxo de Caixa → Dashboard/DRE:** lançamentos alimentam KPIs, gráficos e DRE.
- **PDV → Receita → Estoque:** registrar venda grava `vendas`/`venda_itens` → cria lançamento de **entrada** (categoria "Vendas") no Fluxo → baixa ingredientes do estoque pela ficha técnica do prato. Cancelar a venda remove o lançamento (estorno).

---

## 12. REGRAS DE NEGÓCIO IMPLEMENTADAS
- Multiunidade: "todas" (Central) não filtra; unidade específica filtra/carimba `unidade_id`.
- CMV = custo/preço; MC = (preço−custo)/preço; meta CMV ≤ 35%, MC saudável ≥ 30%.
- Validade: status por dias (vencido <0, crítico ≤2, atenção ≤7, ok >7). FEFO: usar primeiro o que vence antes.
- Perda = quantidade × custo_unit (custo capturado do Estoque/Cardápio na criação da etiqueta).
- Variação % no dashboard = período atual vs período anterior equivalente (dados de `lancamentos`).
- Valor de estoque = quantidade × (custo_unitario || preco_unit). (Bug do `??` com 0 corrigido.)

---

## 13. COMPONENTES E PÁGINAS (estrutura `app/`)
**Kit UI** (`app/components/ui.js`): PageHeader, PageBody, Card, SectionLabel, KpiGrid, Kpi, SearchBar, Chips, EmptyState, Modal, Field, TextInput, NumberInput, Select, Btn, Toast, fmt (BRL/Pct/Data). `Skeleton.js`.
**Contexto:** `app/context/ERPContext.js`.
**Libs (`app/lib/`):** supabase, auth, unidades, estoque, ingredientes, cardapio, fornecedores, eventos, clientes, rh, pessoas (RH/portal), financeiro, etiquetas, **vendas** (PDV), exportPDF.
**Páginas:** login, cadastro, recuperar, nova-senha, rastreio/[codigo], dashboard (page + layout), dashboard/rede, notificacoes, **vendas (PDV)**, operacao/{rotina,cardapio,fichas,ingredientes,estoque,fornecedores,eventos,etiquetas,validade}, financeiro/{dre,fluxo,cmv,margem,documentos}, rh/{gestao,ponto,colaborador,funcionario/[id]}, clientes/{crm,campanhas,nps}, ia/heitor.

---

## 14. DASHBOARD E INDICADORES
- KPIs: Receita, Despesas, Lucro (com variação % vs período anterior), Valor em estoque + críticos.
- Filtro de período: Mensal (dias) / Trimestral (semanas) / Anual (meses).
- Gráficos: Receita × Despesa (barras por período), Distribuição de despesas por categoria.
- Visão de Rede: consolidado + faturamento por unidade + métricas por loja (receita/lucro 30d, estoque, equipe, pratos, CMV).

---

## 15. PROBLEMAS CONHECIDOS / DÍVIDAS TÉCNICAS
- RLS é "qualquer autenticado vê tudo" — falta isolamento por unidade/usuário.
- Usuários de teste no Supabase Auth (e-mails `@teste-erp.com`) criados em diagnósticos — **apagar** em Authentication → Users.
- Token GitHub antigo exposto deve ser **revogado** no GitHub (já removido do remoto).
- Edição de alguns itens persistia só local em versões antigas (estoque corrigido; revisar outros se necessário).
- Reset de senha usa SMTP padrão do Supabase (rate limit) — configurar **Site URL/Redirect URL** no Supabase (`/nova-senha`).
- Projeto vive em pasta OneDrive → ocasionais erros transitórios de `.next` no build (resolver com `rm -rf .next`).

---

## 16. PRÓXIMOS PASSOS RECOMENDADOS
1. **Rodar `docs/vendas.sql`** no Supabase para ativar o PDV em produção. (Código já publicado.)
2. **RLS por unidade** (claim de unidade no usuário + policies).
3. **Notificações automáticas** (validade/estoque) + perdas no DRE.
4. Cadastrar **dados reais** das 3 lojas (e testar o ciclo de venda no PDV).
5. Limpeza de usuários de teste + revogar token + configurar SMTP/URLs.
6. Evoluir baixa de estoque do PDV (FK ingrediente↔estoque) e restauro de estoque no cancelamento.

---

## 17. CHECKLIST GERAL
- [x] Multiunidade · [x] Auth real · [x] RLS (global) · [x] Design system claro
- [x] Operação completa · [x] Etiquetas+QR+Validade+Perdas · [x] Financeiro (BI) · [x] RH+Portal · [x] Clientes · [x] Dashboard+Rede · [x] IA
- [x] **PDV/Vendas (código)** · [ ] `docs/vendas.sql` rodado no Supabase · [ ] RLS por unidade · [ ] Notificações automáticas · [ ] Perdas no DRE · [ ] Dados reais cadastrados · [ ] Limpeza segurança (usuários teste/token/SMTP)

---

## 18. ESTRUTURA DE PASTAS (resumo)
```
Meu ERP/Meu ERP/
├─ app/
│  ├─ layout.js, page.js, error.js, globals.css
│  ├─ login/ cadastro/ recuperar/ nova-senha/
│  ├─ rastreio/[codigo]/
│  ├─ components/ (ui.js, Skeleton.js)
│  ├─ context/ (ERPContext.js)
│  ├─ lib/ (supabase, auth, unidades, estoque, ingredientes, cardapio,
│  │        fornecedores, eventos, clientes, rh, pessoas, financeiro,
│  │        etiquetas, exportPDF)
│  └─ dashboard/
│     ├─ layout.js, page.js, rede/, notificacoes/
│     ├─ operacao/ (rotina, cardapio, fichas, ingredientes, estoque,
│     │             fornecedores, eventos, etiquetas, validade)
│     ├─ financeiro/ (dre, fluxo, cmv, margem, documentos)
│     ├─ rh/ (gestao, ponto, colaborador, funcionario/[id])
│     ├─ clientes/ (crm, campanhas, nps)
│     └─ ia/heitor/
├─ backend_cloud_code/ (server.js — Express /api /webhook)
├─ docs/ (schema-completo.sql, migracao-multiunidade.sql, seguranca-rls.sql, rh-portal.sql)
├─ public/, tailwind.config.js, next.config.js, vercel.json, package.json
```

## 19. DEPENDÊNCIAS INSTALADAS
**prod:** next@14.2, react@18.3, react-dom@18.3, @supabase/supabase-js@2.49, lucide-react@0.383, qrcode.react@4.2, express, cors, morgan, firebase-admin.
**dev:** tailwindcss@3.4, postcss, autoprefixer, nodemon.

## 20. VARIÁVEIS DE AMBIENTE (`.env.local`)
- `NEXT_PUBLIC_SUPABASE_URL` = https://sezccspqxgklicfndwxx.supabase.co
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` = (chave publishable do Supabase)
> Há fallback hardcoded em `app/lib/supabase.js` (a anon/publishable key é pública por design, protegida por RLS).

## 21. MODELO DE DADOS (visão)
`unidades` é o eixo. Todas as tabelas referenciam `unidade_id`. Operação (ingredientes/estoque/cardapio/fichas/fornecedores/eventos), Financeiro (lancamentos/documentos), Clientes (clientes/avaliacoes_nps/campanhas), RH (funcionarios + ponto/holerites/documentos/avisos/advertencias/producoes/cursos ligados por func_id), Etiquetas (rastreio/validade/perdas). Portal do colaborador liga por **e-mail**.

## 22. ROADMAP — PRÓXIMOS 90 DIAS
**Dias 1–30 (fundação de receita):** PDV/Vendas → baixa estoque + grava lançamento; perdas de validade lançam despesa no Fluxo/DRE; cadastro dos dados reais das 3 lojas; limpeza de segurança (usuários teste, token, SMTP/URLs).
**Dias 31–60 (governança & automação):** RLS por unidade (isolar gerentes); notificações automáticas (validade/estoque/metas); persistência completa de fichas técnicas; relatórios exportáveis (PDF/Excel).
**Dias 61–90 (escala & inteligência):** integração PDV externo (iFood/Saipos); IA Heitor com mais dados (CMV/financeiro/RH); metas por loja + benchmark na Central; app/PWA mobile para a operação (ponto, etiquetas, checklists).

---
_Gerado por consolidação da conversa de desenvolvimento. Mantenha este arquivo atualizado a cada marco._
