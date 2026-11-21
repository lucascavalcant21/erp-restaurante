import { test } from "node:test";
import assert from "node:assert/strict";
import { deflateRawSync } from "node:zlib";
import { conciliar, dataDaPlanilha, detectarColunas, lerCsv, numeroDaPlanilha, pedidosDaPlanilha, vendasDaFatura } from "./conciliacao.mjs";
import { lerXlsx } from "../planilha-xlsx.mjs";

test("números e datas como vêm das planilhas", () => {
  assert.equal(numeroDaPlanilha("R$ 1.234,56"), 1234.56);
  assert.equal(numeroDaPlanilha("1,234.56"), 1234.56);
  assert.equal(numeroDaPlanilha("-3,50"), -3.5);
  assert.equal(numeroDaPlanilha("(3,50)"), -3.5);
  assert.equal(numeroDaPlanilha("R$ -12,00"), -12);
  assert.equal(numeroDaPlanilha(""), null);
  assert.equal(numeroDaPlanilha("abc"), null);
  assert.equal(dataDaPlanilha("21/11/2026 14:30"), "2026-11-21");
  assert.equal(dataDaPlanilha("2026-11-02T10:00:00"), "2026-11-02");
  assert.equal(dataDaPlanilha("5/1/26"), "2026-01-05");
  assert.equal(dataDaPlanilha(46347), "2026-11-21");
  assert.equal(dataDaPlanilha("32/13/2026"), null);
});

const CSV = `Relatório de faturamento;;;;;
Pedido;Data do pedido;Ganhos totais;Ofertas da loja;Taxas da 99Food;Valor líquido
1001;02/11/2026;"42,00";"12,00";"4,02";"25,98"
1002;03/11/2026;38,90;0,00;5,20;33,70
1003;04/11/2026;40,90;0;10,00;30,90
1003;04/11/2026;40,90;0;10,00;30,90
Total;;121,80;12,00;19,22;90,58`;

test("CSV com ; e cabeçalho depois de um título: acha as colunas, ignora total e repetido", () => {
  const linhas = lerCsv(CSV);
  const d = detectarColunas(linhas);
  assert.equal(d.linhaCabecalho, 1);
  assert.deepEqual(d.mapa, { pedido: 0, data: 1, liquido: 5, taxas: 4, ofertas: 3, bruto: 2 });
  const { pedidos, ignoradas } = pedidosDaPlanilha(linhas, d);
  assert.deepEqual(pedidos.map((p) => p.pedido), ["1001", "1002", "1003"]);
  assert.deepEqual(ignoradas, [6, 7]);
  assert.equal(pedidos[0].ofertas, 12);
});

test("conciliação: taxa real × contrato, líquido que não bate e totais", () => {
  const { pedidos } = pedidosDaPlanilha(lerCsv(CSV), detectarColunas(lerCsv(CSV)));
  const c = conciliar(pedidos, { contratoPct: 12.1 });
  assert.deepEqual(c.total, { pedidos: 3, bruto: 121.8, ofertas: 12, taxas: 19.22, liquido: 90.58 });
  assert.equal(c.taxasPct, 15.7800);
  assert.equal(c.periodo.de, "2026-11-02");
  assert.equal(c.esperadoContrato, 14.74);
  assert.equal(c.diferencaContrato, 4.48);
  const p3 = c.linhas.find((l) => l.pedido === "1003");
  assert.equal(p3.taxaPct, 24.45);
  assert.equal(p3.problemas.length, 1); // taxa acima do contrato
  assert.equal(c.linhas.find((l) => l.pedido === "1001").problemas.length, 0);
  // líquido divergente
  const div = conciliar([{ pedido: "x", data: "2026-11-02", bruto: 50, ofertas: 0, taxas: 5, liquido: 40 }]);
  assert.match(div.linhas[0].problemas[0], /não bate/);
});

test("fatura → vendas: referência única, não repete o que já foi importado, quantidade 1 avisada", () => {
  const c = conciliar([
    { pedido: "1001", data: "2026-11-02", bruto: 42, ofertas: 12, taxas: 4.02, liquido: 25.98, itens: null },
    { pedido: "1002", data: "2026-11-03", bruto: 38.9, ofertas: 0, taxas: 5.2, liquido: 33.7, itens: 2 },
    { pedido: "1003", data: null, bruto: 10, ofertas: 0, taxas: 1, liquido: 9, itens: 1 },
  ]);
  const v = vendasDaFatura(c.linhas, { canal: "99food", jaImportadas: new Set(["fatura:99food:1002"]) });
  assert.equal(v.length, 1);
  assert.equal(v[0].referencia_externa, "fatura:99food:1001");
  assert.equal(v[0].promocoes, 12);
  assert.equal(v[0].comissao, 4.02);
  assert.equal(v[0].repasse_liquido, 25.98);
  assert.equal(v[0].quantidade, 1);
  assert.match(v[0].observacao, /contado 1/);
});

// .xlsx mínimo montado aqui (zip com XML), para testar o leitor sem dependência.
function zip(arquivos) {
  const enc = new TextEncoder();
  const partes = [], central = [];
  let off = 0;
  for (const [nome, conteudo] of Object.entries(arquivos)) {
    const n = enc.encode(nome), dados = deflateRawSync(Buffer.from(conteudo)), tam = Buffer.byteLength(conteudo);
    const lh = Buffer.alloc(30); lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(8, 8);
    lh.writeUInt32LE(dados.length, 18); lh.writeUInt32LE(tam, 22); lh.writeUInt16LE(n.length, 26);
    partes.push(lh, Buffer.from(n), dados);
    const ch = Buffer.alloc(46); ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(8, 10);
    ch.writeUInt32LE(dados.length, 20); ch.writeUInt32LE(tam, 24); ch.writeUInt16LE(n.length, 28); ch.writeUInt32LE(off, 42);
    central.push(ch, Buffer.from(n));
    off += 30 + n.length + dados.length;
  }
  const cd = Buffer.concat(central);
  const fim = Buffer.alloc(22); fim.writeUInt32LE(0x06054b50, 0); fim.writeUInt16LE(Object.keys(arquivos).length, 8); fim.writeUInt16LE(Object.keys(arquivos).length, 10);
  fim.writeUInt32LE(cd.length, 12); fim.writeUInt32LE(off, 16);
  return Buffer.concat([...partes, cd, fim]);
}

test("lê .xlsx: textos compartilhados, números, células puladas e data do Excel", async () => {
  const buf = zip({
    "xl/workbook.xml": '<workbook><sheets><sheet name="Fatura" sheetId="1" r:id="rId1"/></sheets></workbook>',
    "xl/_rels/workbook.xml.rels": '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>',
    "xl/sharedStrings.xml": "<sst><si><t>Pedido</t></si><si><t>Data</t></si><si><t>Ganhos &amp; taxas</t></si><si><r><t>A</t></r><r><t>B1</t></r></si></sst>",
    "xl/worksheets/sheet1.xml": '<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="D1" t="s"><v>2</v></c></row><row r="2"><c r="A2" t="s"><v>3</v></c><c r="B2"><v>46347</v></c><c r="D2"><v>42.5</v></c></row></sheetData></worksheet>',
  });
  const linhas = await lerXlsx(buf);
  assert.deepEqual(linhas, [["Pedido", "Data", "", "Ganhos & taxas"], ["AB1", 46347, "", 42.5]]);
  assert.equal(dataDaPlanilha(linhas[1][1]), "2026-11-21");
});
