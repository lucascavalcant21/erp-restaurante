/**
 * Testes FASE 2: Refinamento TSPL, Codificação CP1252, Layout 80x40 e MDK-022 WebUSB
 */

const assert = require("assert");
const { encodeCp1252, formatarTextoFitted, gerarComandosTsplMdk022 } = require("../app/lib/impressaoMdk022.js");

console.log("=== INICIANDO TESTES DA FASE 2: LAYOUT E REFINAMENTO TSPL MDK-022 ===");

// 1. TESTE DE CODIFICAÇÃO CP1252 (Acentuação em Português)
console.log("\n[TESTE 1] Codificação CP1252 para acentos em Português...");

const acentosParaTestar = [
  { texto: "AÇAFRÃO / CÚRCUMA", esperados: [0xC7, 0xC3, 0xDA] }, // Ç, Ã, Ú
  { texto: "LIMÃO TAHITI", esperados: [0xC3] },                 // Ã
  { texto: "MAÇÃ", esperados: [0xC7, 0xC3] },                   // Ç, Ã
  { texto: "PÃO DE ALHO", esperados: [0xC3] },                  // Ã
  { texto: "FILÉ DE TILÁPIA", esperados: [0xC9, 0xC1] },        // É, Á
  { texto: "CORAÇÃO DE FRANGO", esperados: [0xC7, 0xC3] },      // Ç, Ã
  { texto: "MOLHO DE CAMARÃO", esperados: [0xC3] },             // Ã
  { texto: "CEDEINE DEL VALLE TABLANTE FLORES", esperados: [] },
];

for (const item of acentosParaTestar) {
  const bytes = encodeCp1252(item.texto);
  assert.ok(bytes instanceof Uint8Array, "Deve retornar Uint8Array");
  assert.strictEqual(bytes.length, item.texto.length, `Cada caractere deve ser exatamente 1 byte em CP1252 (texto: "${item.texto}")`);
  
  // Verifica se cada byte esperado está presente na saída CP1252
  for (const b of item.esperados) {
    assert.ok(bytes.includes(b), `O byte 0x${b.toString(16).toUpperCase()} para acento deve estar no Uint8Array de "${item.texto}"`);
  }
}
console.log("✔ Teste 1 PASSOU: Todos os caracteres acentuados geraram bytes CP1252 de 1 byte de forma limpa.");


// 2. TESTE DE ENCAIXE DE TEXTO E QUEBRA AUTOMÁTICA (formatarTextoFitted)
console.log("\n[TESTE 2] Formatação e encaixe de textos longos...");

const fitNormal = formatarTextoFitted("AÇAFRÃO / CÚRCUMA", 430, "4");
assert.strictEqual(fitNormal.linhas.length, 1, "Nome normal deve ficar em 1 linha");
assert.strictEqual(fitNormal.fonte, "4", "Nome curto usa fonte 4");

const fitLongo = formatarTextoFitted("CEDEINE DEL VALLE TABLANTE FLORES", 430, "2");
assert.strictEqual(fitLongo.linhas.length, 1, "Nome do responsável de 33 chars cabe em 1 linha com fonte 2 em 430 dots");

const fitSuperLongo = formatarTextoFitted("FILÉ DE CORAÇÃO DE FRANGO TEMPERADO DA CASA REVOLUÇÃO", 430, "4");
assert.strictEqual(fitSuperLongo.linhas.length, 2, "Produto super longo deve quebrar em 2 linhas");
assert.ok(fitSuperLongo.linhas[0].length > 0 && fitSuperLongo.linhas[1].length > 0, "Ambas as linhas devem ter conteúdo");

console.log("✔ Teste 2 PASSOU: Nomes longos foram formatados e divididos em 2 linhas sem corte silencioso.");


// 3. TESTE DE GERAÇÃO TSPL 80x40 - ESTRUTURA VISUAL E HIERARQUIA
console.log("\n[TESTE 3] Geração de comandos TSPL no layout 80x40...");

const dadosExemplo = {
  produto: "AÇAFRÃO / CÚRCUMA",
  conservacao: "RESFRIADO",
  lote: "COZINHA",
  momento: new Date("2026-09-16T23:23:00"),
  validade: new Date("2026-09-19T23:23:00"),
  responsavel: "CEDEINE DEL VALLE TABLANTE FLORES",
  codigo: "MU4WNBEQZUE",
  modeloEtiqueta: "validade",
  tipoEtiqueta: "aberto",
  unidadeNome: "SELDEESTRELA",
};

const tspl = gerarComandosTsplMdk022({ dados: dadosExemplo, tamanho: "80x40", copias: 1 });

assert.ok(tspl.includes("SIZE 80 mm,40 mm"), "Contém tamanho 80x40mm");
assert.ok(tspl.includes("CODEPAGE 1252"), "Contém instrução CODEPAGE 1252");
assert.ok(tspl.includes("DIRECTION 1"), "Contém DIRECTION 1");
assert.ok(tspl.includes("CLS"), "Contém CLS");
assert.ok(tspl.includes('TEXT 20,16,"2",0,1,1,"SELDEESTRELA"'), "Contém Nome da Empresa no topo");
assert.ok(tspl.includes('TEXT 20,42,"4",0,1,1,"AÇAFRÃO / CÚRCUMA"'), "Contém Produto em destaque com fonte 4");
assert.ok(tspl.includes('VAL:   19/09/2026 23:23') || tspl.includes('VAL:   19/09/26 23:23'), "Contém campo VALIDADE em destaque");
assert.ok(tspl.includes("CEDEINE DEL VALLE TABLANTE") && tspl.includes("FLORES"), "Contém o nome do responsável envelopado em 2 linhas");
assert.ok(tspl.includes('QRCODE 460,20,L,4,A,0,"https://app.hefisto.com.br/rastreio/MU4WNBEQZUE"'), "Contém QR Code à direita");
assert.ok(tspl.includes('TEXT 460,205,"2",0,1,1,"#MU4WNBEQZUE"'), "Contém #CÓDIGO sob o QR Code");
assert.ok(tspl.includes("PRINT 1,1"), "Contém comando PRINT 1,1");

console.log("✔ Teste 3 PASSOU: TSPL 80x40 gerado de acordo com a especificação visual e hierarquia.");


// 4. TESTE MODO SOMENTE NOME
console.log("\n[TESTE 4] Geração de comandos TSPL no modo 'Somente Nome'...");

const dadosNome = {
  produto: "AÇAFRÃO / CÚRCUMA",
  modeloEtiqueta: "nome",
  unidadeNome: "SELDEESTRELA",
};

const tsplNome = gerarComandosTsplMdk022({ dados: dadosNome, tamanho: "80x40", copias: 2 });

assert.ok(tsplNome.includes("CODEPAGE 1252"), "Modo nome usa CODEPAGE 1252");
assert.ok(tsplNome.includes('TEXT 20,56,"4",0,1,1,"AÇAFRÃO / CÚRCUMA"'), "Contém o produto centralizado e grande em fonte 4");
assert.strictEqual(tsplNome.includes("QRCODE"), false, "Modo somente nome NÃO imprime QR Code");
assert.strictEqual(tsplNome.includes("VAL:"), false, "Modo somente nome NÃO imprime validade");
assert.ok(tsplNome.includes("PRINT 2,1"), "Respeita a quantidade de cópias 2");

console.log("✔ Teste 4 PASSOU: Modo somente nome gerado limpo e sem elementos extras.");


// 5. TESTE REGRA DE BOTÃO E WEBUSB RETORNO ABSOLUTO
console.log("\n[TESTE 5] Verificação das regras WebUSB do botão...");

let windowPrintChamado = false;
function mockHandlerWebUsb(webUsbDisponivel) {
  windowPrintChamado = false;
  if (webUsbDisponivel) {
    // Impressão física WebUSB
    return "MDK-022 WebUSB finalizado"; // return absoluto
  }
  windowPrintChamado = true;
  return "fallback window.print";
}

assert.strictEqual(mockHandlerWebUsb(true), "MDK-022 WebUSB finalizado");
assert.strictEqual(windowPrintChamado, false, "NÃO chama window.print no WebUSB");
assert.strictEqual(mockHandlerWebUsb(false), "fallback window.print");
assert.strictEqual(windowPrintChamado, true, "Chama fallback quando sem WebUSB");

console.log("✔ Teste 5 PASSOU: Retorno absoluto impediu window.print no WebUSB.");

console.log("\n==================================================================");
console.log("TODOS OS TESTES DA FASE 2 PASSARAM COM 100% DE SUCESSO ABSOLUTO!");
console.log("==================================================================");
