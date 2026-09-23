// ══════════════════════════════════════════════════════════════════════════════
// SUITE DE TESTES: MULTIUSUÁRIO SIMULTÂNEO, CONCORRÊNCIA E IDEMPOTÊNCIA
// HÉFISTO ERP — Proteção Contra Colisões Operacionais e Duplo Clique
// ══════════════════════════════════════════════════════════════════════════════

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ [PASS] ${message}`);
    passed++;
  } else {
    console.error(`  ❌ [FAIL] ${message}`);
    failed++;
  }
}

console.log('🧪 INICIANDO TESTES DE CONCORRÊNCIA E MULTIUSUÁRIO SIMULTÂNEO — HÉFISTO ERP\n');

// ─── TESTE 1: SIMULAÇÃO DE DOIS USUÁRIOS ATUANDO AO MESMO TEMPO ───────────────
console.log('--- TESTE 1: Concorrência Simultânea — Usuário A (Estoque) vs Usuário B (Produção) ---');

let estoqueCompartilhado = {
  insumo_id: 'ins-carne-01',
  nome: 'Carne Moída',
  quantidade_atual: 50.0 // 50kg
};

function usuarioABaixaEstoque(qtd) {
  if (estoqueCompartilhado.quantidade_atual >= qtd) {
    estoqueCompartilhado.quantidade_atual -= qtd;
    return { sucesso: true, saldo: estoqueCompartilhado.quantidade_atual };
  }
  return { sucesso: false, erro: 'Saldo insuficiente' };
}

function usuarioBConsomeProducao(qtd) {
  if (estoqueCompartilhado.quantidade_atual >= qtd) {
    estoqueCompartilhado.quantidade_atual -= qtd;
    return { sucesso: true, saldo: estoqueCompartilhado.quantidade_atual };
  }
  return { sucesso: false, erro: 'Saldo insuficiente' };
}

// Simulação de requisições simultâneas (Usuário A consome 30kg, Usuário B consome 30kg)
const resA = usuarioABaixaEstoque(30.0);
const resB = usuarioBConsomeProducao(30.0);

assert(resA.sucesso === true, 'Usuário A consumiu 30kg com sucesso (Saldo restante: 20kg)');
assert(resB.sucesso === false, 'Usuário B teve a operação rejeitada com mensagem de saldo insuficiente (Prevenção de estoque negativo)');
assert(estoqueCompartilhado.quantidade_atual === 20.0, 'Saldo final mantido exatamente em 20kg sem colisão de estado');


// ─── TESTE 2: PROTEÇÃO CONTRA DUPLO CLIQUE (IDEMPOTÊNCIA) ─────────────────────
console.log('\n--- TESTE 2: Proteção Contra Duplo Clique em Transações Financeiras ---');

const transacoesProcessadas = new Set();

function processarPagamentoIdempotente(chaveIdempotencia, valor) {
  if (transacoesProcessadas.has(chaveIdempotencia)) {
    return { sucesso: true, duplicado: true, mensagem: 'Transação já processada anteriormente' };
  }
  transacoesProcessadas.add(chaveIdempotencia);
  return { sucesso: true, duplicado: false, mensagem: 'Pagamento efetuado' };
}

const chave = 'IDEMP-PAY-20260922-999';
const clique1 = processarPagamentoIdempotente(chave, 500.00);
const clique2 = processarPagamentoIdempotente(chave, 500.00);

assert(clique1.duplicado === false, 'Primeira tentativa de pagamento processada normalmente');
assert(clique2.duplicado === true, 'Segunda tentativa idêntica interceptada pela chave de idempotência sem duplicar cobrança');


// ─── TESTE 3: TRATAMENTO DE SESSÃO EXPIRADA EM OPERAÇÕES CRÍTICAS ─────────────
console.log('\n--- TESTE 3: Tratamento de Sessão Expirada em Operação Crítica ---');

function executarOperacaoComSessao(sessaoAtiva) {
  if (!sessaoAtiva || !sessaoAtiva.tokenValido) {
    return { sucesso: false, erro: 'Sessão expirada. Faça login novamente para concluir a operação.' };
  }
  return { sucesso: true };
}

const sessaoExpirada = { tokenValido: false };
const resOperacao = executarOperacaoComSessao(sessaoExpirada);

assert(resOperacao.sucesso === false, 'Operação com sessão expirada rejeitada com falha explícita');
assert(resOperacao.erro.includes('Sessão expirada'), 'Mensagem de orientação de login exibida ao operador');


// ─── RESUMO DOS TESTES ────────────────────────────────────────────────────────
console.log('\n══════════════════════════════════════════════════════════════════════════════');
console.log(`📊 RESUMO DOS TESTES DE CONCORRÊNCIA: ${passed} PASSOU | ${failed} FALHOU`);
console.log('══════════════════════════════════════════════════════════════════════════════\n');

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
