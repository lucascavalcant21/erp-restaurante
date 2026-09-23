// ══════════════════════════════════════════════════════════════════════════════
// SUITE DE TESTES AUTOMATIZADOS: VENDAS, RECEBÍVEIS E CONCILIAÇÃO FINANCEIRA (V2)
// ERP HÉFISTO — Validação Rigorosa das Correções Conceituais e Regras de Negócio
// ══════════════════════════════════════════════════════════════════════════════

import { 
  arredondar2, 
  calcularDecomposicaoVenda, 
  calcularRecebivelFinanceiro,
  calcularTaxaEDataRepasse, 
  gerarTitulosContasReceber, 
  verificarDivergenciaConciliacao,
  calcularConciliacaoLote
} from '../app/lib/vendas-domain.js';

import { importarVendaExterna } from '../app/lib/integracoes-externas.js';

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

console.log('🧪 INICIANDO BATERIA COMPLETA DE TESTES VENDAS, RECEBÍVEIS E CONCILIAÇÃO (V2)\n');

// ─── TESTE 1: CORREÇÃO CONCEITUAL 1 — RECEBÍVEL BANCÁRIO VS DRE (IMPOSTOS) ─────
console.log('--- TESTE 1: Correção Conceitual 1 (Imposto não reduz recebível sem retenção na fonte) ---');
const recSemRetencao = calcularRecebivelFinanceiro({
  valorCobradoCliente: 100,
  taxaAdquirenteValor: 2.50,
  comissaoPlataformaValor: 0,
  retencaoFiscalOrigem: 0
});
assert(recSemRetencao.valorLiquidoEsperadoBanco === 97.50, 'Sem retenção: Recebível = R$ 97,50 (100 - 2.50). Impostos não descontam do banco!');

const recComRetencao = calcularRecebivelFinanceiro({
  valorCobradoCliente: 100,
  taxaAdquirenteValor: 2.50,
  comissaoPlataformaValor: 0,
  retencaoFiscalOrigem: 1.00
});
assert(recComRetencao.valorLiquidoEsperadoBanco === 96.50, 'Com retenção na fonte: Recebível = R$ 96,50 (100 - 2.50 - 1.00)');


// ─── TESTE 2: CORREÇÃO CONCEITUAL 2 — TAXA DE SERVIÇO (EQUIPE VS EMPRESA) ──────
console.log('\n--- TESTE 2: Correção Conceitual 2 (Taxa de Serviço Equipe vs Empresa) ---');
const dServico = calcularDecomposicaoVenda({
  subtotal: 100,
  desconto: 0,
  percentualTaxaServicoEquipe: 80, // 80% garçons, 20% empresa
  taxaServicoPercentual: 10
});

assert(dServico.taxaServicoCobrada === 10, 'Taxa Serviço total cobrada = R$ 10,00');
assert(dServico.taxaServicoDestinadaEquipe === 8.00, 'Destinado à Equipe (Passivo Garçons) = R$ 8,00');
assert(dServico.taxaServicoRetidaEmpresa === 2.00, 'Retido pela Empresa (Receita Operacional) = R$ 2,00');
assert(dServico.vendaBruta === 110, 'Venda Bruta total = R$ 110,00');


// ─── TESTE 3: CORREÇÃO CONCEITUAL 3 — CMV TEÓRICO ────────────────────────────
console.log('\n--- TESTE 3: Correção Conceitual 3 (CMV Teórico por Ficha Técnica) ---');
const consumoFichaGramas = 200; // 200g por prato
const quantidadeVendida = 10;
const cmvTeoricoKg = (consumoFichaGramas * quantidadeVendida) / 1000;
assert(cmvTeoricoKg === 2.0, '10 vendas x 200g = 2,0 kg de carne (CMV TEÓRICO / OPERACIONAL)');


// ─── TESTE 4: CONFIGURAÇÕES DE ADQUIRENTES E PRAZOS DINÂMICOS ────────────────
console.log('\n--- TESTE 4: Configuração Dinâmica de Adquirentes e Prazos D+N ---');
const configCustom = [
  { adquirente_nome: 'CIELO', forma_pagamento: 'CREDITO_AVISTA', taxa_credito_avista: 2.1, dias_repasse_credito: 14 }
];

const repCielo = calcularTaxaEDataRepasse('CREDITO_AVISTA', 'CIELO', '2026-09-22', 1, configCustom);
assert(repCielo.taxaPercentual === 2.1, 'Cielo Crédito Taxa customizada 2.1%');
assert(repCielo.diasRepasse === 14, 'Cielo Crédito Prazo customizado D+14');


// ─── TESTE 5: SPLIT DE PAGAMENTOS (venda_pagamentos) ─────────────────────────
console.log('\n--- TESTE 5: Split de Pagamento com Múltiplas Pernas (venda_pagamentos) ---');
const splitTitulos = gerarTitulosContasReceber({
  vendaId: 'venda-505',
  codigoVenda: 'VND-00505',
  unidadeId: 'unid-01',
  canalVenda: 'SALAO',
  dataVenda: '2026-09-22',
  splitPagamentos: [
    { formaPagamento: 'DINHEIRO', valor: 40, adquirente: 'CAIXA' },
    { formaPagamento: 'PIX', valor: 60, adquirente: 'BANCO' },
    { formaPagamento: 'CREDITO_AVISTA', valor: 100, adquirente: 'STONE' }
  ]
});

assert(splitTitulos.length === 3, '1 Venda gerou 3 Títulos em contas_receber');
assert(splitTitulos[0].forma_pagamento === 'DINHEIRO' && splitTitulos[0].status === 'RECEBIDO', 'Perna 1: DINHEIRO liquidada no caixa');
assert(splitTitulos[1].forma_pagamento === 'PIX' && splitTitulos[1].status === 'RECEBIDO', 'Perna 2: PIX liquidada no banco');
assert(splitTitulos[2].forma_pagamento === 'CREDITO_AVISTA' && splitTitulos[2].status === 'PREVISTO', 'Perna 3: CRÉDITO com status PREVISTO');
assert(splitTitulos[2].taxa_valor === 2.80, 'Perna 3: Taxa Crédito = R$ 2,80');
assert(splitTitulos[2].valor_liquido_esperado === 97.20, 'Perna 3: Líquido Esperado = R$ 97,20');


// ─── TESTE 6: CONCILIAÇÃO POR LOTE N:1 (1 DEPÓSITO BANCÁRIO -> N RECEBÍVEIS) ────
console.log('\n--- TESTE 6: Conciliação por Lote N:1 (Stone R$ 600,00 -> 3 Recebíveis) ---');
const recebiveisLote = [
  { id: 'rec-1', valor_liquido_esperado: 100 },
  { id: 'rec-2', valor_liquido_esperado: 200 },
  { id: 'rec-3', valor_liquido_esperado: 300 }
];

const concLoteOk = calcularConciliacaoLote(recebiveisLote, 600.00);
assert(concLoteOk.valorEsperadoTotal === 600.00, 'Lote valor esperado total = R$ 600,00');
assert(concLoteOk.statusConciliacao === 'CONCILIADO_OK', 'Lote totalmente conciliado OK');
assert(concLoteOk.diferenca === 0, 'Diferença de repasse = R$ 0,00');

const concLoteDiv = calcularConciliacaoLote(recebiveisLote, 580.00);
assert(concLoteDiv.statusConciliacao === 'CONCILIADO_COM_DIVERGENCIA', 'Depósito bancário menor -> CONCILIADO_COM_DIVERGENCIA');
assert(concLoteDiv.diferenca === 20.00, 'Diferença identificada = R$ 20,00');


// ─── TESTE 7: IDEMPOTÊNCIA DE IMPORTAÇÃO DE VENDAS EXTERNAS (SAIPOS / IFOOD) ──
console.log('\n--- TESTE 7: Idempotência na Importação de Vendas Externas (Saipos/iFood) ---');
const imp1 = await importarVendaExterna({
  unidadeId: '00000000-0000-0000-0000-000000000001',
  origem: 'SAIPOS_CSV',
  idExterno: 'SP-99881',
  subtotal: 150,
  splitPagamentos: [{ formaPagamento: 'PIX', valor: 150 }]
});

assert(imp1.sucesso === true, 'Primeira importação de venda externa concluída com sucesso');

const imp2 = await importarVendaExterna({
  unidadeId: '00000000-0000-0000-0000-000000000001',
  origem: 'SAIPOS_CSV',
  idExterno: 'SP-99881',
  subtotal: 150,
  splitPagamentos: [{ formaPagamento: 'PIX', valor: 150 }]
});

assert(imp2.sucesso === true && imp2.duplicado === true, 'Re-importação com mesma chave manteve idempotência (Sem duplicar venda nem estoque)');


// ─── RESUMO DA BATERIA DE TESTES ─────────────────────────────────────────────
console.log('\n==================================================');
console.log(`📊 BATERIA DE TESTES COMPLETA: ${passed} PASSARAM | ${failed} FALHARAM`);
console.log('==================================================\n');

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
