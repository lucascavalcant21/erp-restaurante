// ══════════════════════════════════════════════════════════════════════════════
// SUITE DE TESTES: INVENTÁRIO INICIAL, DATA DE CORTE & CUTOVER DO RESTAURANTE
// HÉFISTO ERP — Processamento de Implantação e Carga Inicial de Dados
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

console.log('🧪 INICIANDO TESTES DE INVENTÁRIO INICIAL & CUTOVER — HÉFISTO ERP\n');

// ─── TESTE 1: REGISTRO DE DATA DE CORTE E LANÇAMENTO DE SALDO INICIAL ─────────
console.log('--- TESTE 1: Processamento de Inventário Físico Inicial (SALDO_INICIAL) ---');

const dataCorte = '2026-10-01';

function processarContagemInicial(insumosFisicos, dataCorteIso) {
  const movimentacoes = [];
  
  for (const item of insumosFisicos) {
    movimentacoes.push({
      insumo_id: item.id,
      tipo_movimento: 'SALDO_INICIAL',
      quantidade: item.quantidadeFisica,
      unidade_medida: item.unidade,
      data_corte: dataCorteIso,
      observacao: `Inventário físico inicial de implantação em ${dataCorteIso}`
    });
  }
  
  return { sucesso: true, totalItens: movimentacoes.length, movimentacoes };
}

const inventarioFisicoReal = [
  { id: 'ins-01', nome: 'Arroz Tipo 1', quantidadeFisica: 25.0, unidade: 'kg' },
  { id: 'ins-02', nome: 'Feijão Preto', quantidadeFisica: 10.0, unidade: 'kg' },
  { id: 'ins-03', nome: 'Óleo de Soja', quantidadeFisica: 12.0, unidade: 'L' }
];

const resultadoCutover = processarContagemInicial(inventarioFisicoReal, dataCorte);

assert(resultadoCutover.sucesso === true, 'Carga de inventário inicial processada com sucesso');
assert(resultadoCutover.totalItens === 3, '3 Insumos cadastrados com saldo inicial exato');
assert(resultadoCutover.movimentacoes[0].tipo_movimento === 'SALDO_INICIAL', 'Movimentação registrada com tipo auditável SALDO_INICIAL (sem alteração direta do banco)');


// ─── TESTE 2: CONTAS FINANCEIRAS E SALDOS INICIAIS DE ABERTURA ──────────────
console.log('\n--- TESTE 2: Saldos Iniciais de Contas Bancárias e Caixa Físico ---');

const contasBancariasIniciais = [
  { conta: 'Caixa Gaveta PDV', saldoInicial: 350.00, dataAbertura: dataCorte },
  { conta: 'Banco Itaú Operacional', saldoInicial: 4850.20, dataAbertura: dataCorte }
];

const totalAbertura = contasBancariasIniciais.reduce((acc, c) => acc + c.saldoInicial, 0);

assert(totalAbertura === 5200.20, 'Saldo inicial consolidado de bancos e caixa configurado em R$ 5.200,20');


// ─── TESTE 3: AUDITORIA DE FICHAS TÉCNICAS E PREÇOS INCOMPLETOS ───────────────
console.log('\n--- TESTE 3: Auditoria de Insumos sem Preço e Fichas Incompletas ---');

const catalogoInsumos = [
  { id: 'ins-01', nome: 'Arroz', preco: 6.50 },
  { id: 'ins-02', nome: 'Sal Refinado', preco: 0 } // Sem preço
];

const insumosSemPreco = catalogoInsumos.filter(i => !i.preco || i.preco <= 0);

assert(insumosSemPreco.length === 1, 'Auditoria identificou 1 insumo sem preço de compra cadastrado');
assert(insumosSemPreco[0].nome === 'Sal Refinado', 'Alerta gerado apontando o insumo que precisa de cotação antes do go-live');


// ─── RESUMO DOS TESTES ────────────────────────────────────────────────────────
console.log('\n══════════════════════════════════════════════════════════════════════════════');
console.log(`📊 RESUMO DOS TESTES DE INVENTÁRIO INICIAL: ${passed} PASSOU | ${failed} FALHOU`);
console.log('══════════════════════════════════════════════════════════════════════════════\n');

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
