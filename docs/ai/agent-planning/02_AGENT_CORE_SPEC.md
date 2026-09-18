# 02 — Agent Core Specification

> **Status:** Especificação Técnica Conceitual (Arquitetura)  
> **Sistema:** Cerebro ERP (FoodERP) / Hefisto AI Core  
> **Compatibilidade:** Next.js App Router, Supabase (PostgreSQL + RLS), server/contexto.mjs, server/autorizacao.mjs, hefisto-acoes.js

---

## 1. Fluxo de Vida de uma Mensagem (Execution Pipeline)

O **Agent Core** é o motor orquestrador que processa mensagens de todos os canais (Chat Interno, WhatsApp, Instagram, Voz, Automações).

`
   [Mensagem do Canal]
            │
            ▼
┌──────────────────────────────────────┐
│ 1. Ingestão & NormalizedMessage      │ (Converte formato do canal para padrão canônico)
└──────────────────┬───────────────────┘
                   │
                   ▼
┌──────────────────────────────────────┐
│ 2. Resolução de RequestContext       │ (Token, Unidade, Permissões, Empresa, Ator)
└──────────────────┬───────────────────┘
                   │
                   ▼
┌──────────────────────────────────────┐
│ 3. Invocação do Modelo (LLM Reasoner)│ (Context Window + Tool Definitions do Registry)
└──────────────────┬───────────────────┘
                   │
                   ├──► [Decidiu responder texto] ──► [Sanitização] ──► [Resposta Final]
                   │
                   ▼ [Decidiu Tool Calling]
┌──────────────────────────────────────┐
│ 4. Tool Selection & Input Validation │ (Valida JSON Schema / Tipos dos parâmetros)
└──────────────────┬───────────────────┘
                   │
                   ▼
┌──────────────────────────────────────┐
│ 5. Authorization (Permission Engine) │ (authorizeAction contra permissions-catalog.mjs)
└──────────────────┬───────────────────┘
                   │
                   ├──► [Negado] ──► [Auditoria de Recusa] ──► [Retorno de Erro 403 ao LLM]
                   │
                   ▼ [Autorizado]
┌──────────────────────────────────────┐
│ 6. Confirmation Gate                 │ (Se riskLevel = HIGH / CONFIRMACAO_OBRIGATORIA)
└──────────────────┬───────────────────┘
                   │
                   ├──► [Pendente / Rejeitado] ──► [Emite Card de Confirmação e Pausa]
                   │
                   ▼ [Aprovado ou SEM_CONFIRMACAO]
┌──────────────────────────────────────┐
│ 7. Idempotency Check & Lock          │ (Verifica deduplicação via idempotencyKey)
└──────────────────┬───────────────────┘
                   │
                   ▼
┌──────────────────────────────────────┐
│ 8. Handler Execution (Domain Action) │ (Executa app/lib/* com timeout isolado)
└──────────────────┬───────────────────┘
                   │
                   ▼
┌──────────────────────────────────────┐
│ 9. Audit Logging                     │ (Grava hefisto_auditoria: comando, antes, depois)
└──────────────────┬───────────────────┘
                   │
                   ▼
┌──────────────────────────────────────┐
│ 10. Re-alimentação do Modelo         │ (ToolResult enviado de volta ao LLM)
└──────────────────┬───────────────────┘
                   │
                   ▼
┌──────────────────────────────────────┐
│ 11. Resposta Final ao Canal          │ (Formatação Markdown / WhatsApp / Áudio TTS)
└──────────────────────────────────────┘
`

---

## 2. Limites de Segurança & Guardrails

Para prevenir comportamentos anômalos, alucinações, custos descontrolados e instabilidade de sistema, o Agent Core implementa 6 travas determinísticas:

### A. Limite de Loops / Recursão (Max Iterations)
- **Máximo de 4 ciclos de raciocínio (turns)** por mensagem do usuário.
- Se o agente atingir 4 ciclos sem produzir resposta final, a execução é interrompida, o estado é salvo e uma mensagem explicativa é devolvida: *A operação atingiu o limite de passos. Por favor, especifique seu pedido.*

### B. Limite de Tools por Turno (Max Tool Calls)
- **Máximo de 3 chamadas de ferramentas** por ciclo de raciocínio.
- **Máximo total de 6 ferramentas executadas** por requisição do usuário.
- Impede metralhadoras de chamadas (ex: tentar listar 50 produtos um a um em vez de uma consulta agregada).

### C. Timeouts Rígidos
- **Timeout por Tool:** 4.000 ms (4 segundos). Caso a Domain Action não responda, a Tool aborta com TOOL_TIMEOUT e o agente recebe o erro para tentar fallback ou avisar o usuário.
- **Timeout Total da Requisição:** 25.000 ms (25 segundos), adequado para o limite de serverless/Edge da Vercel.

### D. Detector de Repetição de Ações (Stuck / Ping-Pong Loop Breaker)
- O Core mantém uma assinatura das últimas ferramentas chamadas no turno:
  \text{callSignature} = \text{toolId} + \text{JSON.stringify(input)}
- Se a mesma assinatura for invocada **2 vezes consecutivas** com o mesmo resultado de erro, o Core bloqueia a terceira tentativa e força o modelo a explicar a falha ao operador.

### E. Circuit Breaker de Falhas de Domínio
- Se uma Tool disparar erro de banco ou exceção não tratada **2 vezes no mesmo turno**, ela é temporariamente desabilitada para o restante da conversa.

### F. Sanitização de Saída (Data Loss Prevention)
- O Agent Core remove automaticamente do retorno enviado ao modelo e ao canal:
  - Tokens de autenticação e senhas (JWT, hash bcrypt).
  - Dados sensíveis de colaboradores sem permissão (CPF, RG, salário, PIX) usando a mesma política da equipe_unidade em h.js.

---

## 3. Modelo de Memória e Sessão

### A. Sessão de Curto Prazo (Working Memory)
- Mantida no banco em hefisto_conversas e hefisto_mensagens.
- Janela deslizante de contexto: últimas 12 mensagens (ou ~4.000 tokens), garantindo baixo consumo de contexto e foco operacional.

### B. Segregação Multi-Tenant Rigorosa
- O unidade_id e empresa_id do RequestContext são injetados em **TODAS** as prompts do sistema como premissa imutável.
- O modelo nunca recebe autorização para visualizar ou cruzar dados de lojas distintas, a menos que o usuário possua papel de Matriz / Administrador de Rede (unidade_id === matriz ou superAdmin === true).

---

## 4. Tratamento de Erros e Degradação Graciosa

Quando uma ferramenta falha (ex: banco offline, produto não encontrado, falta de estoque):
1. O Handler da Tool retorna { success: false, error: { code, message, details } }.
2. O Agent Core **NÃO** lança exceção fatal; ele entrega o payload de erro de volta ao LLM.
3. O LLM recebe a instrução de sistema: *A ação falhou pelo motivo X. Explique isso em linguagem natural e ofereça as alternativas plausíveis.*
4. Exemplo Real: Se estoque.registrar_saida falhar por saldo insuficiente (código ESTOQUE_INSUFICIENTE), o agente responde:  
   *Não foi possível registrar a saída de 5 kg de Queijo Mussarela. O saldo atual no sistema é de apenas 2,3 kg. Deseja registrar a saída parcial ou fazer um ajuste de inventário?*
