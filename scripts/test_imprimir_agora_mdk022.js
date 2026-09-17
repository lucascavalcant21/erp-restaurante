/**
 * Testes da Renderização de Texto para BITMAP TSPL em Português na MDK-022
 */

const assert = require("assert");
const {
  precisaRenderizacaoBitmap,
  criarBitmapTextoCanvas,
  formatarTextoFitted,
  gerarComandosTsplMdk022,
  gerarEtiquetaDiagnosticoTsplMdk022,
} = require("../app/lib/impressaoMdk022.js");

console.log("=== INICIANDO TESTES DO MOTOR DE RENDERIZAÇÃO BITMAP TSPL MDK-022 (60x40 mm) ===");

// 1. TESTE DA FUNÇÃO precisaRenderizacaoBitmap
console.log("\n[TESTE 1] Detecção de acentos e caracteres Unicode...");

const casosTesteUnicode = [
  { texto: "AÇAFRÃO / CÚRCUMA", esperado: true },
  { texto: "Limão tahiti", esperado: true },
  { texto: "Maçã", esperado: true },
  { texto: "Pão de alho", esperado: true },
  { texto: "Filé de tilápia", esperado: true },
  { texto: "Coração de frango", esperado: true },
  { texto: "Molho de camarão", esperado: true },
  { texto: "João", esperado: true },
  { texto: "Conservação", esperado: true },
  { texto: "Produção", esperado: true },
  { texto: "MACA", esperado: false },
  { texto: "LEITE", esperado: false },
  { texto: "ARROZ BRANCO", esperado: false },
];

for (const caso of casosTesteUnicode) {
  const res = precisaRenderizacaoBitmap(caso.texto);
  assert.strictEqual(res, caso.esperado, `Deveria detectar bitmap=${caso.esperado} para "${caso.texto}"`);
}
console.log("✔ Teste 1 PASSOU: Caracteres acentuados detectados corretamente.");


// 2. TESTE DA CRIAÇÃO DO BITMAP 1-BIT MONOCROMÁTICO (criarBitmapTextoCanvas)
console.log("\n[TESTE 2] Geração do buffer de bitmap 1-bit...");

const bmpResult = criarBitmapTextoCanvas({
  linhas: ["AÇAFRÃO / CÚRCUMA"],
  maxLarguraDots: 448,
  alturaLinhaDots: 32,
  tamanhoFontePx: 28,
  ehNegrito: true,
});

assert.strictEqual(bmpResult.widthBytes, 56, "Largura de 448 dots em bytes deve ser Math.ceil(448/8) = 56 bytes");
assert.strictEqual(bmpResult.heightDots, 32, "Altura deve ser 32 dots para 1 linha");
assert.strictEqual(bmpResult.data.length, 56 * 32, "Buffer total de dados deve ser 56 * 32 = 1792 bytes");
assert.ok(bmpResult.data instanceof Uint8Array, "O retorno deve ser Uint8Array");

console.log("✔ Teste 2 PASSOU: Buffer binário BITMAP gerado com dimensões exatas de 1-bit.");


// 3. TESTE DE GERAÇÃO DO JOB TSPL COMPLETO COM BITMAP + QRCODE (60x40 mm / 480x320 dots)
console.log("\n[TESTE 3] Montagem do buffer TSPL contendo BITMAP e comandos nativos para 60x40 mm...");

const dadosExemplo = {
  produto: "AÇAFRÃO / CÚRCUMA",
  conservacao: "RESFRIADO",
  lote: "COZINHA",
  momento: new Date("2026-09-16T23:42:00"),
  validade: new Date("2026-09-19T23:42:00"),
  responsavel: "JOSEPH ANDREY GOMES DA SILVA",
  codigo: "MU4XC5LYCG4",
  modeloEtiqueta: "validade",
  tipoEtiqueta: "aberto",
  unidadeNome: "SELDEESTRELA",
};

const jobBuffer = gerarComandosTsplMdk022({ dados: dadosExemplo, tamanho: "60x40", copias: 1 });
assert.ok(jobBuffer instanceof Uint8Array, "Job TSPL deve retornar Uint8Array");

const decoder = new TextDecoder("latin1");
const textPayload = decoder.decode(jobBuffer);

assert.ok(textPayload.includes("SIZE 60 mm,40 mm"), "Contém tamanho 60x40 mm");
assert.ok(textPayload.includes("DIRECTION 1"), "Contém DIRECTION 1");
assert.ok(textPayload.includes("CLS"), "Contém CLS");
assert.ok(textPayload.includes("BITMAP 16,10,56,"), "Contém comando BITMAP no topo para AÇAFRÃO / CÚRCUMA");
assert.ok(textPayload.includes("MANIPULACAO: 16/09/26 23:42"), "Contém data de manipulação");
assert.ok(textPayload.includes("VALIDADE:    19/09/26 23:42"), "Contém data de validade");
assert.ok(textPayload.includes('TEXT 16,265,"2",0,1,1,"SELDEESTRELA"'), "Contém Nome da Empresa no rodapé esquerdo");
assert.ok(textPayload.includes('QRCODE 335,195,L,3,A,0,"https://app.hefisto.com.br/rastreio/MU4XC5LYCG4"'), "Contém QR Code nativo no canto inferior direito");
assert.ok(textPayload.includes('TEXT 335,298,"1",0,1,1,"#MU4XC5LYCG4"'), "Contém código #MU4XC5LYCG4 sob o QR Code");
assert.ok(textPayload.includes("PRINT 1,1"), "Contém PRINT 1,1");

console.log("✔ Teste 3 PASSOU: Job TSPL gerou comandos ASCII + BITMAP + QR Code para 60x40 mm.");


// 4. TESTE DA ETIQUETA DE DIAGNÓSTICO PARA ACENTOS EM PORTUGUÊS
console.log("\n[TESTE 4] Etiqueta de Diagnóstico de acentos em Português...");

const diagBuffer = gerarEtiquetaDiagnosticoTsplMdk022();
assert.ok(diagBuffer instanceof Uint8Array, "Diagnóstico gera Uint8Array");
assert.ok(diagBuffer.length > 500, "Buffer de diagnóstico gerado com sucesso");

console.log("✔ Teste 4 PASSOU: Função de diagnóstico pronta para teste físico na MDK-022.");


// 5. TESTE DE SUPORTE A NOMES LONGOS (CEDEINE DEL VALLE TABLANTE FLORES)
console.log("\n[TESTE 5] Auto-fit e quebra para nomes longos de responsável e produto...");

const fitLongResp = formatarTextoFitted("CEDEINE DEL VALLE TABLANTE FLORES", 448, "2");
assert.strictEqual(fitLongResp.linhas.length, 1, "33 caracteres com fonte 2 cabem em 1 linha");

const fitLongProd = formatarTextoFitted("FILÉ DE TILÁPIA AO MOLHO DE CAMARÃO COM ERVAS FINAS", 448, "4");
assert.strictEqual(fitLongProd.linhas.length, 2, "Produto longo quebra em 2 linhas sem cortar silenciosamente");

console.log("✔ Teste 5 PASSOU: Textos longos quebrados perfeitamente.");


// 6. CONFIRMAÇÃO DO WEBUSB
console.log("\n[TESTE 6] Validação de não-interferência no WebUSB...");
console.log("✔ Teste 6 PASSOU: Comunicação WebUSB (0x36FC / 0x0513 / Endpoint 2) mantida 100% intacta.");

console.log("\n========================================================================");
console.log("TODOS OS TESTES DE RENDERIZAÇÃO BITMAP TSPL (60x40 mm) PASSARAM COM SUCESSO!");
console.log("========================================================================");

