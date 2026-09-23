# 01 — Tool Registry Specification

> **Status:** Especificação Técnica Conceitual (Arquitetura)  
> **Sistema:** Cerebro ERP (FoodERP) / Hefisto AI Core  
> **Compatibilidade:** Next.js App Router, Supabase (PostgreSQL + RLS), permissions-catalog.mjs, server/autorizacao.mjs

---

## 1. Visão Geral e Propósito

O **Tool Registry** é o catálogo central e fortemente tipado de capacidades executáveis do ERP. Ele atua como o intermediário soberano entre o **Agent Core** (IA, Chat Interno, WhatsApp, Voz) e as **Ações de Domínio** (pp/lib/*), garantindo:

1. **Isolamento de Domínio:** A IA nunca acessa o banco de dados diretamente via SQL livre; ela apenas solicita a execução de uma *Tool* registrada.
2. **Autorização Rígida:** Nenhuma ferramenta é executada sem passar pelo Permission Engine do ERP (permissions-catalog.mjs + uthorizeAction).
3. **Classificação de Risco & Confirmação:** Ações destrutivas, financeiras ou operacionais exigem níveis explícitos de consentimento humano.
4. **Idempotência Garantida:** Prevenção contra execuções duplicadas de ferramentas críticas (baixas de estoque, pagamentos, cancelamentos).
5. **Observabilidade Total:** Todas as entradas, saídas, autorizações e recusas são auditadas em hefisto_auditoria.

`
┌────────────────────────────────────────────────────────┐
│                      AGENT CORE                        │
└──────────────────────────┬─────────────────────────────┘
                           │ 1. Invoca Tool por ID + Input
                           ▼
┌────────────────────────────────────────────────────────┐
│                     TOOL REGISTRY                      │
│  ┌─────────────────┐ ┌──────────────────────────────┐  │
│  │  Schema Validator │ │  Permission Engine Gate      │  │
│  │  (Zod / JSON)    │ │  (authorizeAction)          │  │
│  └─────────────────┘ └──────────────────────────────┘  │
│  ┌─────────────────┐ ┌──────────────────────────────┐  │
│  │  Idempotency Check │ │  Confirmation Gate Evaluator│  │
│  └─────────────────┘ └──────────────────────────────┘  │
└──────────────────────────┬─────────────────────────────┘
                           │ 2. Executa Handler Seguro
                           ▼
┌────────────────────────────────────────────────────────┐
│                 DOMAIN ACTIONS (app/lib)               │
│   estoque.js · vendas.js · financeiro.js · rh.js ...   │
└──────────────────────────┬─────────────────────────────┘
                           │ 3. PostgREST com RLS / RPC
                           ▼
┌────────────────────────────────────────────────────────┐
│                   BANCO POSTGRESQL                     │
└──────────────────────────┴─────────────────────────────┘
`

---

## 2. Contrato TypeScript Conceitual

O contrato abaixo define o modelo de dados e interfaces que regem o Tool Registry, adaptado à base JavaScript/TypeScript do projeto:

`	ypescript
// ============================================================================
// TIPOS BASE DO TOOL REGISTRY
// ============================================================================

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export type ConfirmationPolicy = 
  | 'SEM_CONFIRMACAO'          // Leitura segura ou navegação
  | 'CONFIRMACAO_RECOMENDADA'  // Alteração operacional reversível
  | 'CONFIRMACAO_OBRIGATORIA'; // Financeiro, exclusão, RH ou estoque físico

export type ToolCategory =
  | 'estoque'
  | 'compras'
  | 'fichas'
  | 'vendas'
  | 'eventos'
  | 'reservas'
  | 'crm'
  | 'rh'
  | 'checklist'
  | 'auditoria'
  | 'financeiro'
  | 'sistema';

export interface JSONSchemaDefinition {
  type: string;
  properties?: Record<string, any>;
  required?: string[];
  description?: string;
  enum?: any[];
  [key: string]: any;
}

/**
 * Contexto de Requisição imutável resolvido pelo servidor
 * Baseado em app/lib/server/contexto.mjs
 */
export interface RequestContext {
  readonly requestId: string;
  readonly channel: 'web' | 'quiosque' | 'sistema' | 'integracao' | 'agente';
  readonly actor: {
    readonly id: string;
    readonly nome: string;
    readonly email?: string;
    readonly tipo: 'usuario' | 'colaborador' | 'integracao' | 'sistema';
  };
  readonly unidadeId: string | null;
  readonly empresaId: string | null;
  readonly permissions: readonly string[];
  readonly negacoes: readonly string[];
  readonly superAdmin: boolean;
}

export interface ToolResult<TOutput = any> {
  success: boolean;
  data?: TOutput;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  metadata?: {
    executionTimeMs: number;
    cached?: boolean;
    idempotencyKey?: string;
  };
}

export interface ToolConfirmationRequest {
  toolId: string;
  summary: string;
  impactDescription: string;
  params: Record<string, any>;
  riskLevel: RiskLevel;
  expiresAt: string;
}

export interface ToolHandlerDependencies {
  supabaseClient: any;
  logger: any;
  auditService: {
    registrar: (entry: Record<string, any>) => Promise<any>;
  };
}

/**
 * Contrato Canônico de uma Tool do Hefisto AI Core
 */
export interface AgentTool<TInput = Record<string, any>, TOutput = any> {
  /** Identificador único no formato categoria.acao (ex: estoque.consultar_saldo) */
  readonly id: string;
  
  /** Nome legível para humanos e documentação */
  readonly name: string;
  
  /** Descrição detalhada do propósito (usada pelo LLM para Tool Calling) */
  readonly description: string;
  
  /** Categoria operacional */
  readonly category: ToolCategory;
  
  /** Se a ferramenta é estritamente de consulta (sem efeitos colaterais) */
  readonly readOnly: boolean;
  
  /** Nível de criticidade da ação */
  readonly riskLevel: RiskLevel;
  
  /** Política de confirmação humana antes da execução */
  readonly confirmationPolicy: ConfirmationPolicy;
  
  /**
   * Permissão real exigida no catálogo do ERP.
   * Formato: modulo.pagina.acao (ex: estoque.overview.view, financeiro.dre.view_values)
   * Referência: app/lib/permissions-catalog.mjs
   */
  readonly requiredPermission: string;
  
  /** Schema dos parâmetros de entrada */
  readonly inputSchema: JSONSchemaDefinition;
  
  /** Schema da estrutura de retorno */
  readonly outputSchema: JSONSchemaDefinition;
  
  /** Validador síncrono de entrada (Zod ou JSON Schema) */
  validateInput: (input: unknown) => { valid: boolean; errors?: string[]; parsed?: TInput };
  
  /**
   * Função executora que encapsula a chamada à Domain Action real
   */
  handler: (
    input: TInput,
    ctx: RequestContext,
    deps: ToolHandlerDependencies
  ) => Promise<ToolResult<TOutput>>;
}
`

---

## 3. Classificação de Risco e Políticas de Confirmação

| Nível de Risco | Definição | Política de Confirmação Padrão | Exemplos de Ações |
| :--- | :--- | :--- | :--- |
| **LOW** | Leitura pura sem efeitos colaterais. Não altera nenhum dado no banco. | SEM_CONFIRMACAO | estoque.consultar_saldo, inanceiro.consultar_dre, ichas.consultar_ficha |
| **MEDIUM** | Alterações operacionais do dia a dia facilmente reversíveis ou aditivas. | CONFIRMACAO_RECOMENDADA | estoque.registrar_entrada, checklists.salvar_execucao, crm.criar_cliente |
| **HIGH** | Ações financeiras, exclusões de registros, movimentações de ajuste físico, desligamento de equipe, cancelamento de reservas. | CONFIRMACAO_OBRIGATORIA | inanceiro.pagar_conta, estoque.ajustar_saldo, h.desligar_colaborador |

### Regra do Confirmation Gate:
- Se a Tool for classificada como CONFIRMACAO_OBRIGATORIA:
  1. O Agent Core intercepta o Tool Call.
  2. Gera um token de confirmação com TTL de 5 minutos contendo o resumo em linguagem natural e os parâmetros validados.
  3. Envia para o usuário (via chat/WhatsApp/UI) um card de confirmação explícita.
  4. O handler **NUNCA** executa até que a mensagem de confirmação seja respondida com APPROVED.

---

## 4. Integração com o Permission Engine Existente

O Hefisto ERP já possui um catálogo estruturado em pp/lib/permissions-catalog.mjs e um validador de escopo em pp/lib/server/autorizacao.mjs.

O Tool Registry utiliza a função **uthorizeAction** como guardião absoluto antes de disparar qualquer handler:

`	ypescript
// Fluxo de autorização de Tool no Registry:
async function executeToolSafely(tool: AgentTool, input: any, ctx: RequestContext, deps: any) {
  // 1. Validação de formato de Entrada
  const validation = tool.validateInput(input);
  if (!validation.valid) {
    return {
      success: false,
      error: { code: 'INVALID_INPUT', message: 'Parâmetros inválidos', details: validation.errors }
    };
  }

  // 2. Validação de Permissão pelo Permission Engine do ERP
  const authDecision = await authorizeAction(ctx, tool.requiredPermission, {
    unidadeId: ctx.unidadeId,
    acao: tool.id,
    deps: deps.authDeps
  });

  if (!authDecision.ok) {
    // Log de auditoria de tentativa negada
    await deps.auditService.registrar({
      unidadeId: ctx.unidadeId,
      usuarioId: ctx.actor.id,
      usuarioNome: ctx.actor.nome,
      acao: tool.id,
      modulo: tool.category,
      resultado: 'negado',
      erro: authDecision.mensagem,
      exigiuConfirmacao: tool.confirmationPolicy !== 'SEM_CONFIRMACAO'
    });

    return {
      success: false,
      error: {
        code: authDecision.codigo || 'FORBIDDEN',
        message: authDecision.mensagem || 'Acesso negado para esta operação.'
      }
    };
  }

  // 3. Execução do Handler
  return await tool.handler(validation.parsed!, ctx, deps);
}
`

---

## 5. Contrato de Idempotência e Desduplicação

Para operações que criam movimentações físicas ou financeiras, a duplicidade pode gerar prejuízo imediato (ex: enviar duas vezes uma entrada de estoque por instabilidade de rede ou retry do modelo).

### Estratégia de 3 Camadas:
1. **equestId**: ID único de correlação gerado na entrada do canal (Web, WhatsApp, Webhook).
2. **	oolCallId**: Identificador emitido pelo LLM para aquela chamada de ferramenta específica no fluxo de raciocínio.
3. **idempotencyKey**: Hash composto:
   \text{idempotencyKey} = \text{SHA256}(\text{unidadeId} + \text{toolId} + \text{requestId} + \text{toolCallId} + \text{JSON.stringify(input)})

### Comportamento do Registry:
- O Registry consulta a tabela hefisto_idempotency_keys antes da execução.
- Se a chave já existir com status COMPLETED, retorna imediatamente o payload de resposta salvo em cache (cached: true).
- Se a chave estiver IN_PROGRESS, rejeita a chamada concorrente com status CONCURRENT_EXECUTION_BLOCKED.
- Se não existir, grava IN_PROGRESS, executa a ação de domínio, e ao concluir grava COMPLETED com o resultado.
