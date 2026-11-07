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
