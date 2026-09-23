// ══════════════════════════════════════════════════════════════════════════════
// SUITE DE TESTES AUTOMATIZADOS: CENTRAL DE COMANDO INTELIGENTE
// ERP HÉFISTO — Validação da Engine de Sinais, Impacto em Cadeia e Permissões
// ══════════════════════════════════════════════════════════════════════════════

import { 
  arredondar2, 
  avaliarSinaisEstoque, 
  avaliarProducaoSugerida, 
  analisarImpactoCustoInsumo,
  simularPrecoVendaAlvo,
  avaliarSinaisFinanceiros
} from '../app/lib/sinais-domain.js';

import { fetchCentralDeComandoResumo } from '../app/lib/central-comando.js';

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

console.log('🧪 INICIANDO BATERIA DE TESTES DA CENTRAL DE COMANDO INTELIGENTE — HÉFISTO ERP\n');

// ─── TESTE 1: SINAIS DE ESTOQUE MÍNIMO E SEVERIDADE ───────────────────────────
console.log('--- TESTE 1: Sinais Operacionais de Estoque Mínimo e Severidade ---');
const amostraEstoque = [
  { insumo_id: 'i1', nome: 'Picanha Grill', quantidade_atual: 2, estoque_minimo: 5, unidade_medida: 'kg' },
  { insumo_id: 'i2', nome: 'Molho de Tomate', quantidade_atual: 0, estoque_minimo: 10, unidade_medida: 'L' }
];

const sinaisEst = avaliarSinaisEstoque(amostraEstoque);
assert(sinaisEst.length === 2, '2 Sinais de estoque gerados');
assert(sinaisEst[0].severidade === 'ATENCAO', 'Picanha 2kg (Mín 5kg) -> Severidade ATENÇÃO');
assert(sinaisEst[1].severidade === 'CRITICO', 'Molho 0L (Mín 10L) -> Severidade CRÍTICO');
assert(sinaisEst[0].acao_rotulo === 'Comprar Insumo', 'Ação contextual para compras gerada');


// ─── TESTE 2: SUGESTÃO AUTOMÁTICA DE PRODUÇÃO (SUB-RECEITAS) ──────────────────
console.log('\n--- TESTE 2: Sugestão Automática de Produção para Pré-Preparos ---');
const fichasBases = [
  { id: 'f-molho-madeira', nome_receita: 'Molho Madeira Base', tipo_base: 'pre', rendimento_porcoes: 2, rendimento_unidade: 'L' }
];
const estoqueAtualMap = { 'f-molho-madeira': 1.2 };

const sugProd = avaliarProducaoSugerida(fichasBases, estoqueAtualMap);
assert(sugProd.length === 1, 'Sugestão de produção gerada para Molho Madeira');
assert(sugProd[0].dados_json.sugerido === 2.8, 'Sugestão de produzir 2,8 L de Molho Madeira');


// ─── TESTE 3: PROPAGAÇÃO DE AUMENTO DE CUSTO EM CADEIA ────────────────────────
console.log('\n--- TESTE 3: Propagação de Aumento de Custo de Insumo em Cadeia ---');
const fichasTecnicas = [
  { id: 'f-picanha-300g', nome_receita: 'Picanha Fatiada 300g', custo_total: 21.60, fichas_ingredientes: [{ insumo_id: 'ins-pic', quantidade: 0.3 }] },
  { id: 'f-espetinho', nome_receita: 'Espetinho Picanha 200g', custo_total: 14.40, fichas_ingredientes: [{ insumo_id: 'ins-pic', quantidade: 0.2 }] }
];

const impacto = analisarImpactoCustoInsumo({
  insumoId: 'ins-pic',
  insumoNome: 'Picanha Grill',
  precoAnterior: 72.00,
  precoAtual: 80.20,
  fichasTecnicas
});

assert(impacto !== null, 'Análise de impacto em cadeia retornou com sucesso');
assert(impacto.percentualAumento === 11.39, 'Aumento da Picanha = +11.39%');
assert(impacto.quantidadeFichasAfetadas === 2, '2 Fichas Técnicas afetadas');
assert(impacto.fichasAfetadas[0].aumentoNoPrato === 2.46, 'Aumento no prato Picanha 300g = R$ 2,46');


// ─── TESTE 4: SIMULADOR DE PREÇO DE VENDA PARA CMV ALVO ──────────────────────
console.log('\n--- TESTE 4: Simulador de Preço Venda para CMV Alvo (sem alterar banco) ---');
const sim = simularPrecoVendaAlvo(42.00, 35.0);
assert(sim.precoSugerido === 120.00, 'Preço sugerido para CMV 35% em custo de R$ 42,00 = R$ 120,00');


// ─── TESTE 5: ALERTAS FINANCEIROS DE CONTAS ATRASADAS E DIVERGENTES ──────────
console.log('\n--- TESTE 5: Alertas Financeiros (Contas Atrasadas e Recebíveis Divergentes) ---');
const contasPagar = [
  { id: 'cp-1', data_vencimento: '2026-09-01', saldo: 1500, status: 'PENDENTE' }
];

const contasReceber = [
  { id: 'cr-1', status: 'DIVERGENTE', valor_liquido_esperado: 400 }
];

const sinaisFin = avaliarSinaisFinanceiros(contasPagar, contasReceber);
assert(sinaisFin.length === 2, '2 Sinais financeiros críticos/atenção gerados');
assert(sinaisFin[0].tipo_sinal === 'PAYABLE_OVERDUE', 'Alerta de contas a pagar atrasadas gerado');
assert(sinaisFin[1].tipo_sinal === 'RECEIVABLE_DIVERGENCE', 'Alerta de recebíveis divergentes gerado');


// ─── TESTE 6: ISOLAMENTO DE UNIDADE E PERMISSÃO DE PERFIL ─────────────────────
console.log('\n--- TESTE 6: Isolamento de Unidade e Permissão de Perfil ---');
const resumoSemFin = await fetchCentralDeComandoResumo('00000000-0000-0000-0000-000000000001', false);
assert(resumoSemFin !== null, 'Resumo retornado');
assert(resumoSemFin.financeiro?.restrito === true, 'Dados financeiros ocultados quando podeVerFinanceiro é false');


// ─── RESUMO DOS TESTES ───────────────────────────────────────────────────────
console.log('\n==================================================');
console.log(`📊 TESTES DA CENTRAL DE COMANDO: ${passed} PASSARAM | ${failed} FALHARAM`);
console.log('==================================================\n');

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
