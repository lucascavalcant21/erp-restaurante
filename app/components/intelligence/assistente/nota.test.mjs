import test from "node:test";
import assert from "node:assert/strict";
import { notaDoOcr } from "./nota.mjs";
import { notaSchema } from "../../../lib/intelligence/actions/lancar-nota.mjs";

test("leitura do /api/ocr vira um pedido que o servidor aceita", () => {
  const ocr = {
    fornecedor: "ATACADAO", cnpj: "", data_emissao: "2026-11-06", hora_emissao: "10:00", categoria: "Outros", valor_total: 83.5,
    numero: "000.004.521", serie: "1", chave_acesso: "", valor_frete: null, valor_desconto: null,
    vencimentos: [{ data: "", valor: null }, { data: "2026-11-20", valor: 83.5 }],
    itens: [{ codigo: "", nome: "OLEO SOJA 900ML", qtd: 2, un: "UN", valor_unitario: 8.9, preco: 17.8 }, { nome: "", qtd: 1, preco: 1 }, { nome: "ARROZ 5KG", qtd: 0, preco: 0 }, { nome: "FEIJAO 1KG", qtd: 3, un: "UN", valor_unitario: null, preco: 65.7 }],
  };
  const n = notaDoOcr(ocr);
  assert.equal(n.numero, "4521");
  assert.equal(n.cnpj, undefined);
  assert.deepEqual(n.vencimentos, [{ data: "2026-11-20", valor: 83.5 }]);
  assert.deepEqual(n.itens.map((i) => i.nome), ["OLEO SOJA 900ML", "FEIJAO 1KG"]);
  assert.ok(notaSchema.parse(n).ok, "passa no schema do servidor");
  assert.equal(notaDoOcr({ itens: [] }), null);
});

test("XML da NF-e vira a mesma nota, com origem xml", async () => {
  const { notaDoXml } = await import("./nota.mjs");
  const xml = `<?xml version="1.0" encoding="UTF-8"?><nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00"><NFe><infNFe Id="NFe35261112345678000195550010000045211000045210" versao="4.00">
<ide><cUF>15</cUF><nNF>4521</nNF><serie>1</serie><dhEmi>2026-11-06T10:15:00-03:00</dhEmi></ide>
<emit><CNPJ>12345678000195</CNPJ><xNome>ATACAD&#195;O S.A. &amp; CIA</xNome><xFant>Atacadão</xFant></emit>
<det nItem="1"><prod><cProd>789</cProd><xProd>OLEO SOJA 900ML</xProd><uCom>UN</uCom><qCom>2.0000</qCom><vUnCom>8.9000000000</vUnCom><vProd>17.80</vProd></prod><imposto><vTotTrib>1.00</vTotTrib></imposto></det>
<det nItem="2"><prod><cProd>123</cProd><xProd><![CDATA[JAMBU KG]]></xProd><uCom>KG</uCom><qCom>3.5000</qCom><vUnCom>18.80</vUnCom><vProd>65.80</vProd></prod></det>
<total><ICMSTot><vProd>83.60</vProd><vFrete>0.00</vFrete><vDesc>0.10</vDesc><vNF>83.50</vNF></ICMSTot></total>
<cobr><fat><nFat>1</nFat></fat><dup><nDup>001</nDup><dVenc>2026-11-20</dVenc><vDup>83.50</vDup></dup></cobr>
</infNFe></NFe></nfeProc>`;
  const { nota, erro } = notaDoXml(xml);
  assert.equal(erro, null);
  assert.equal(nota.fornecedor, "ATACADÃO S.A. & CIA");
  assert.equal(nota.cnpj, "12345678000195");
  assert.equal(nota.numero, "4521");
  assert.equal(nota.chave_acesso, "35261112345678000195550010000045211000045210");
  assert.equal(nota.data_emissao, "2026-11-06");
  assert.equal(nota.valor_total, 83.5);
  assert.equal(nota.valor_desconto, 0.1);
  assert.deepEqual(nota.vencimentos, [{ data: "2026-11-20", valor: 83.5 }]);
  assert.deepEqual(nota.itens.map((i) => [i.nome, i.un, i.qtd, i.preco]), [["OLEO SOJA 900ML", "UN", 2, 17.8], ["JAMBU KG", "KG", 3.5, 65.8]]);
  assert.equal(nota.origem, "xml");
  assert.ok(notaSchema.parse(nota).ok, "passa no schema do servidor");
  assert.match(notaDoXml("<html>oi</html>").erro, /não é o XML de uma NF-e/);
  assert.match(notaDoXml(`<infNFe>${"<det><prod><xProd>A</xProd><qCom>1</qCom><vProd>1</vProd></prod></det>".repeat(61)}</infNFe>`).erro, /61 itens/);
});
