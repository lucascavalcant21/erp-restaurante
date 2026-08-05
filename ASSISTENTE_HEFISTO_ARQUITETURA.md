# Assistente Hefisto — Arquitetura

Assistente inteligente embutido no ERP (Seldeestrela / Hefisto). Permite controlar o
sistema por **texto ou voz**: responder, navegar, preencher e executar ações, sempre
reutilizando os serviços e validações já existentes.

## 1. Arquitetura atual (mapeada)

- **Framework:** Next.js (App Router), páginas `"use client"` em `app/dashboard/**`.
- **Banco/Auth:** Supabase (`app/lib/supabase.js`), sessão em `app/lib/auth.js` (`lerSessao`).
- **Contexto global:** `app/context/ERPContext.js` → `useERP()` expõe `unidadeAtiva`, `unidadeInfo`, `sessao`, `unidades`.
- **Layout global:** `app/dashboard/layout.js` (sidebar + header). Ponto único para montar o assistente global.
- **IA:** rotas `app/api/ia-*` chamando **Anthropic** `https://api.anthropic.com/v1/messages`, modelo `claude-opus-4-8`, header `x-api-key: ANTHROPIC_API_KEY`, `anthropic-version: 2023-06-01`. Resposta em JSON (parse tolerante a ```json```).
- **Permissões:** `app/lib/permissions-catalog.js` → `hasPermission(session, chave)`, `canAccessRoute`, `permittedRoutes`. `sessao.gerenciado` = usuário restrito.

## 2. Módulos e serviços reutilizáveis

| Domínio | Lib | Funções-chave |
|---|---|---|
| Estoque multi | `app/lib/estoques-multiplos.js` | `fetchEstoques`, `fetchItensEstoque`, `registrarMovimentoMulti`, `registrarContagemMulti`, `transferirEntreEstoques`, `vincularItemEstoque` |
| Bebidas | `app/lib/estoque-bebidas.js` | `entradaBebidaUnidades`, `baixaBebidaConteudo`, `contagemBebida` |
| Ingredientes/Fichas | `app/lib/operacao.js` | `fetchInsumos`, `salvarInsumo`, `fetchFichas`, `salvarFicha` |
| Fornecedores | `app/lib/fornecedores.js`, `app/lib/insumo-fornecedores.js` | preço por fornecedor + histórico |
| Financeiro | `app/lib/financeiro.js` | `salvarConta`, `fetchContas`, `fetchLancamentos` |
| Vendas | `app/lib/vendas.js` | `fetchProdutos` |
| RH | `app/lib/rh.js` | colaboradores, ponto, banco de horas |

O assistente **não duplica regra de negócio** — chama essas funções.

## 3. Camadas do assistente

- `app/components/HefistoAssistant.js` — **UI** (botão flutuante + painel lateral + chat + contexto + confirmação). Montado no layout.
- `app/api/hefisto/route.js` — **intent-parser**: transforma linguagem natural em intenção estruturada (JSON) via Claude. **Não executa nada**, não recebe/gera SQL.
- `app/lib/hefisto-acoes.js` — **action-router + actions + validator + resolver + audit**: resolve nomes contra dados reais, valida, executa via libs internas, grava auditoria.
- `db/migracao_hefisto_auditoria.sql` — tabela `hefisto_auditoria`.

Fluxo: **interpretar → validar → permissões → resolver registros reais → resumo (se preciso) → executar via serviço interno → auditar → retornar**. O modelo nunca inventa IDs/produtos/valores; o cliente sempre resolve contra o banco.

## 4. Níveis de autorização

1. **Consulta** (auto): abrir página, pesquisar, responder, saldo.
2. **Operacional** (auto p/ autorizado): entrada/retirada pequena, cadastrar item, checklist.
3. **Confirmação** (resumo + confirmar): ajustes grandes, custo/preço, ficha, financeiro.
4. **Reforçada** (permissão especial): excluir, cancelar venda, folha, permissões, massa.

## 5. Riscos

- Ambiguidade de nomes → sempre oferecer opções clicáveis, nunca escolher no escuro.
- Estoque negativo → bloqueado sem autorização.
- Multiunidade → confirmar unidade quando não estiver clara.
- Prompt injection → o modelo só classifica; a execução é do código com whitelist de ações.

## 6. Plano de implementação (etapas)

- **E1 (feito):** este doc + registro de ações + parser + auditoria.
- **E2 (feito):** painel visual (botão flutuante, painel lateral, chat, contexto, sugestões).
- **E3 (v1):** abrir páginas, consultar estoque, entrada, retirada, coleta de faltantes, confirmação, auditoria.
- **E4:** voz (Web Speech), resposta em áudio, desfazer, alertas.
- **E5:** automações + sugestões proativas.
- **E6:** financeiro, RH, ponto, fichas, compras, DRE, multiunidade.

## 7. Ações iniciais (registro central)

| id | módulo | nível | campos obrigatórios | reversível |
|---|---|---|---|---|
| `navegar` | core | 1 | rota | — |
| `consultar_estoque` | inventory | 1 | produto | — |
| `inventory.create_entry` | inventory | 2 | produto, quantidade, unidade | sim |
| `inventory.create_withdrawal` | inventory | 2 | produto, quantidade | sim |

Cada ação tem `validar()`, `executar()` e (quando aplicável) `reverter()`, além de mensagens de sucesso/erro. Auditoria registra usuário, comando, intenção, módulo, saldo anterior/novo, resultado.
