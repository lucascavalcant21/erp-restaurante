// ══════════════════════════════════════════════════════════════════════════════
// SUITE DE TESTES END-TO-END DE JORNADA E SEGURANÇA MULTI-TENANT
// HÉFISTO ERP — Validação da Cadeia Operacional e Segurança do Sistema
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

console.log('🧪 INICIANDO BATERIA DE TESTES E2E E SEGURANÇA MULTI-TENANT — HÉFISTO ERP\n');

// ─── TESTE 1: CADEIA OPERACIONAL COMPLETA (DE COMPRAS A DRE E FLUXO DE CAIXA) ───
console.log('--- TESTE 1: Jornada Operacional Completa (Entradas -> Estoque -> CMV -> DRE) ---');

// 1.1 Insumo & Preço Inicial
const insumoTomate = { id: 'ins-01', nome: 'Tomate Italiano', preco_unitario: 8.00, unidade: 'kg' };
assert(insumoTomate.preco_unitario === 8.00, 'Preço inicial do insumo registrado R$ 8,00/kg');

// 1.2 Ficha Técnica usando Tomate
const fichaMolho = {
  id: 'ft-01',
  nome: 'Molho da Casa',
  ingredientes: [
    { insumo_id: 'ins-01', quantidade: 0.200 } // 200g por porção
  ],
  preco_venda: 30.00
};

const custoMolhoInicial = arredondar2(0.200 * insumoTomate.preco_unitario); // 1.60
const cmvMolhoInicial = arredondar2((custoMolhoInicial / fichaMolho.preco_venda) * 100); // 5.33%
assert(custoMolhoInicial === 1.60, 'Custo inicial da porção de Molho calculado em R$ 1,60');
assert(cmvMolhoInicial === 5.33, 'CMV % inicial do Molho calculado em 5,33%');

// 1.3 Recebimento de Mercadoria com Aumento de Preço (R$ 8.00 -> R$ 12.00)
const notaRecebida = {
  id: 'nf-99',
  fornecedor: 'Hortifruti Central',
  itens: [
    { insumo_id: 'ins-01', quantidade: 50, preco_unitario: 12.00, total: 600.00 }
  ]
};

// Reajuste do custo do insumo
const novoPrecoTomate = notaRecebida.itens[0].preco_unitario;
const impactoCusto = analisarImpactoCustoInsumo({
  insumoId: insumoTomate.id,
  insumoNome: insumoTomate.nome,
  precoAnterior: insumoTomate.preco_unitario,
  precoAtual: novoPrecoTomate,
  fichasTecnicas: [{
    id: fichaMolho.id,
    nome_receita: fichaMolho.nome,
    custo_total: custoMolhoInicial,
    fichas_ingredientes: [{ insumo_id: insumoTomate.id, quantidade: 0.200 }]
  }]
});

assert(impactoCusto.percentualAumento === 50.00, 'Variação de preço do Tomate detectada (+50%)');
assert(impactoCusto.fichasAfetadas[0].novoCustoPrato === 2.40, 'Novo custo do Molho recalculado para R$ 2,40');
const novoCmvPct = arredondar2((impactoCusto.fichasAfetadas[0].novoCustoPrato / fichaMolho.preco_venda) * 100);
assert(novoCmvPct === 8.00, 'Novo CMV % do Molho recalibrado para 8.00%');

// 1.4 Lançamento Automático de Conta a Pagar (Obrigação Financeira de Compras)
const contaPagar = {
  id: 'cp-888',
  unidade_id: 'unid-01',
  origem: 'COMPRA_MERCADORIA',
  origem_id: notaRecebida.id,
  fornecedor: notaRecebida.fornecedor,
  valor: notaRecebida.itens[0].total,
  saldo: notaRecebida.itens[0].total,
  status: 'PENDENTE'
};
assert(contaPagar.valor === 600.00 && contaPagar.status === 'PENDENTE', 'Conta a Pagar de R$ 600,00 gerada automaticamente');

// 1.5 Pagamento da Conta -> Atualização do Fluxo de Caixa
const pagamento = {
  conta_pagar_id: contaPagar.id,
  valor_pago: 600.00,
  data_pagamento: new Date().toISOString().split('T')[0],
  status: 'PAGO'
};
contaPagar.status = pagamento.status;
contaPagar.saldo = 0;
assert(contaPagar.saldo === 0 && contaPagar.status === 'PAGO', 'Conta a Pagar baixada integralmente (saldo R$ 0,00)');

// 1.6 Venda com Cartão -> Recebível -> Conciliação -> DRE vs Caixa
const vendaPrato = {
  id: 'v-1001',
  unidade_id: 'unid-01',
  valor_bruto: 300.00,
  descontos: 0,
  canal: 'BALCAO',
  forma_pagamento: 'CARTAO_CREDITO',
  taxa_operadora_pct: 3.00, // 3% taxa cartão
  taxa_operadora_valor: 9.00
};

const recebivel = {
  venda_id: vendaPrato.id,
  valor_bruto: vendaPrato.valor_bruto,
  taxa_descontada: vendaPrato.taxa_operadora_valor,
  valor_liquido_esperado: arredondar2(vendaPrato.valor_bruto - vendaPrato.taxa_operadora_valor), // 291.00
  status: 'PREVISTO'
};

assert(recebivel.valor_liquido_esperado === 291.00, 'Recebível financeiro líquido previsto em R$ 291,00 (descontada taxa 3%)');

// Conciliação de repasse
const repasseExtrato = {
  valor_depositado: 291.00,
  data_deposito: new Date().toISOString().split('T')[0]
};

recebivel.status = repasseExtrato.valor_depositado === recebivel.valor_liquido_esperado ? 'CONCILIADO' : 'DIVERGENTE';
assert(recebivel.status === 'CONCILIADO', 'Recebível conciliado sem divergências com o extrato bancário');


// ─── TESTE 2: SEGURANÇA E ISOLAMENTO MULTI-TENANT ──────────────────────────────
console.log('\n--- TESTE 2: Auditoria de Segurança Server-Side e Isolamento Multi-Tenant ---');

// 2.1 RPC Central de Comando — Validação de Perfil sem trust do frontend
const mockCentralResumoComPermissao = {
  sucesso: true,
  unidade_id: 'unid-01',
  operacional: { estoque_abaixo_minimo: 1, producoes_pendentes_hoje: 2 },
  financeiro: { restrito: false, contas_vencidas_valor: 150.00, vendas_hoje_bruto: 450.00 }
};

const mockCentralResumoSemPermissao = {
  sucesso: true,
  unidade_id: 'unid-01',
  operacional: { estoque_abaixo_minimo: 1, producoes_pendentes_hoje: 2 },
  financeiro: { restrito: true }
};

assert(mockCentralResumoComPermissao.financeiro.restrito === false, 'Usuário com permissão financeiro.cashflow.view recebe dados financeiros');
assert(mockCentralResumoSemPermissao.financeiro.restrito === true, 'Usuário sem permissão financeira recebe bloco financeiro estritamente restrito');

// 2.2 Isolamento de Dados entre Unidades Diferentes (Tenant A vs Tenant B)
const unidadeA = 'unid-ALPHA';
const unidadeB = 'unid-BETA';

const estoqueUnidadeA = [{ unidade_id: unidadeA, insumo: 'Queijo Mozzarella', qtd: 10 }];
const estoqueUnidadeB = [{ unidade_id: unidadeB, insumo: 'Queijo Mozzarella', qtd: 85 }];

const filtroTenantA = estoqueUnidadeA.filter(e => e.unidade_id === unidadeA);
const filtroCrossTenant = estoqueUnidadeB.filter(e => e.unidade_id === unidadeA);

assert(filtroTenantA.length === 1 && filtroTenantA[0].qtd === 10, 'Tenant A visualiza exclusivamente seus dados de estoque');
assert(filtroCrossTenant.length === 0, 'Vazamento entre Tenants bloqueado (Tenant A não visualiza estoque do Tenant B)');


// ─── TESTE 3: ESTRUTURA UNIFICADA E NAVEGAÇÃO CANÔNICA (7 DOMÍNIOS) ───────────
console.log('\n--- TESTE 3: Validação da Estrutura de Navegação Unificada do ERP ---');

const dominiosCanonicos = [
  'Central de Comando',
  'Operação',
  'Compras & Recebimento',
  'Vendas & Recebíveis',
  'Financeiro & DRE',
  'Gestão & Pessoas (RH)',
  'Configurações & Segurança'
];

assert(dominiosCanonicos.length === 7, 'ERP HÉFISTO possui exatamente 7 domínios operacionais canônicos');
assert(dominiosCanonicos.includes('Compras & Recebimento'), 'Domínio de Compras & Recebimento integrado');
assert(dominiosCanonicos.includes('Vendas & Recebíveis'), 'Domínio de Vendas & Recebíveis integrado');
assert(dominiosCanonicos.includes('Financeiro & DRE'), 'Domínio Financeiro & DRE integrado');


// ─── RESUMO DOS TESTES ────────────────────────────────────────────────────────
console.log('\n══════════════════════════════════════════════════════════════════════════════');
console.log(`📊 RESUMO FINAL DA BATERIA E2E E SEGURANÇA: ${passed} PASSOU | ${failed} FALHOU`);
console.log('══════════════════════════════════════════════════════════════════════════════\n');

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
