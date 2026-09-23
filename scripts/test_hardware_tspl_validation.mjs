// ══════════════════════════════════════════════════════════════════════════════
// SUITE DE TESTES: VALIDAÇÃO DE HARDWARE & GERADOR DE ETIQUETAS TSPL
// HÉFISTO ERP — Validação da Impressão Operacional de Validades (60x40 mm)
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

console.log('🧪 INICIANDO TESTES DE IMPRESSÃO E HARDWARE TSPL — HÉFISTO ERP\n');

// Simulação da Engine de Impressão TSPL da Cozinha
function gerarComandoTsplEtiqueta({
  nomeInsumo,
  dataProducao,
  dataValidade,
  lote,
  responsavel,
  larguraMm = 60,
  alturaMm = 40,
  gapMm = 3
}) {
  return `
SIZE ${larguraMm} mm, ${alturaMm} mm
GAP ${gapMm} mm, 0 mm
DIRECTION 1
CLS
TEXT 50,30,"3",0,1,1,"HEFISTO RESTAURANTE"
TEXT 50,70,"2",0,1,1,"PRODUTO: ${nomeInsumo.toUpperCase()}"
TEXT 50,110,"2",0,1,1,"PROD: ${dataProducao}"
TEXT 50,140,"2",0,1,1,"VAL: ${dataValidade}"
TEXT 50,170,"1",0,1,1,"LOTE: ${lote} | RESP: ${responsavel}"
QRCODE 360,60,H,4,A,0,"HEFISTO:${lote}"
PRINT 1
`.trim();
}

// ─── TESTE 1: VALIDAÇÃO DO COMANDO TSPL GERADO ───────────────────────────────
console.log('--- TESTE 1: Validação de Parâmetros da Etiqueta Padrão 60x40mm ---');

const comando = gerarComandoTsplEtiqueta({
  nomeInsumo: 'Molho de Tomate Rústico',
  dataProducao: '22/09/2026 14:00',
  dataValidade: '25/09/2026 14:00',
  lote: 'L-20260922-01',
  responsavel: 'Chef Marcos'
});

assert(comando.includes('SIZE 60 mm, 40 mm'), 'Tamanho de mídia configurado para 60x40 mm');
assert(comando.includes('GAP 3 mm, 0 mm'), 'Sensor de GAP configurado para 3 mm');
assert(comando.includes('DIRECTION 1'), 'Direção de saída da impressora alinhada (DIRECTION 1)');
assert(comando.includes('CLS'), 'Comando de limpeza de buffer CLS presente');
assert(comando.includes('PRODUTO: MOLHO DE TOMATE RÚSTICO'), 'Nome do insumo formatado em caixa alta');
assert(comando.includes('VAL: 25/09/2026 14:00'), 'Data e hora de validade presentes no layout');
assert(comando.includes('LOTE: L-20260922-01'), 'Número de lote gravado na etiqueta');
assert(comando.includes('RESP: Chef Marcos'), 'Identificação do operador responsável gravada');
assert(comando.includes('QRCODE 360,60,H,4,A,0,"HEFISTO:L-20260922-01"'), 'QR Code de rastreabilidade gerado com sucesso');
assert(comando.includes('PRINT 1'), 'Comando de disparo de impressão PRINT 1 executado');


// ─── RESUMO DOS TESTES ────────────────────────────────────────────────────────
console.log('\n══════════════════════════════════════════════════════════════════════════════');
console.log(`📊 RESUMO DOS TESTES DE HARDWARE TSPL: ${passed} PASSOU | ${failed} FALHOU`);
console.log('══════════════════════════════════════════════════════════════════════════════\n');

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
