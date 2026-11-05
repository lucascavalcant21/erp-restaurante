// Proposta do evento para o cliente. Rode com: node --test app/lib/evento-proposta.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { orcamentoVazio, resumoDoOrcamento } from "./evento-orcamento.mjs";
import { cardapioComQuantidades, valoresDaProposta, pagamentoDaProposta, normalizarModeloProposta, MODELO_PROPOSTA_PADRAO, fotosDoCardapio } from "./evento-proposta.mjs";

const ins = (id, preco) => ({ id, nome: id, unidade_medida: "kg", preco_normalizado: preco });
const ficha = (id, nome, categoria, imagem = null) => ({ id, nome_receita: nome, categoria, imagem, rendimento_porcoes: 1, fichas_ingredientes: [{ insumos: ins(`i-${id}`, 20), quantidade: 0.1, fator_correcao: 0 }] });
const FICHAS = [ficha("pq", "Pão de queijo", "Salgados", "https://x.supabase.co/a.jpg"), ficha("bolo", "Bolo de laranja", "Doces"), ficha("cafe", "Café", "Bebidas"), ficha("sal", "Salada", "")];

function coffee() {
  const orc = orcamentoVazio({});
  orc.tipo = "combinado";
  orc.cliente.convidados = 40;
  orc.cardapio = [
    { id: "1", secao: "mesa", origem: "ficha", ficha_id: "pq", nome: "Pão de queijo", quantidade_total: "60" },
    { id: "2", secao: "mesa", origem: "ficha", ficha_id: "bolo", nome: "Bolo de laranja", quantidade_total: "1" },
    { id: "3", secao: "bar", origem: "ficha", ficha_id: "cafe", nome: "Café", por_pessoa: "1" },
    { id: "4", secao: "buffet", origem: "ficha", ficha_id: "sal", nome: "Salada", por_pessoa: "0.5" },
  ];
  orc.financeiro.preco_mesa = 3500;
  return orc;
}

test("cardápio do cliente: quantidade + item por parte e por categoria, como no modelo", () => {
  const orc = coffee();
  const partes = cardapioComQuantidades(orc, resumoDoOrcamento(orc, FICHAS));
  assert.deepEqual(partes.map((p) => p.rotulo), ["Mesa montada", "Buffet", "Bar e drinks"]);
  const mesa = partes[0];
  assert.deepEqual(mesa.categorias.map((c) => c.categoria), ["Doces", "Salgados"]);
  assert.deepEqual(mesa.categorias.find((c) => c.categoria === "Salgados").itens.map((i) => [i.quantidade, i.nome]), [[60, "Pão de queijo"]]);
  assert.equal(partes[1].categorias[0].categoria, "Outros", "ficha sem categoria");
  assert.equal(partes[1].categorias[0].itens[0].quantidade, 20, "0,5 porção × 40 pessoas");
  assert.equal(partes[2].categorias[0].itens[0].quantidade, 40, "1 café por pessoa × 40");
});

test("valores: detalhado ou só o total; nenhum custo na proposta", () => {
  const orc = coffee();
  const r = resumoDoOrcamento(orc, FICHAS);
  const det = valoresDaProposta(r);
  assert.deepEqual(det.linhas.map((l) => l.rotulo), ["Mesa montada (pacote fechado)"]);
  assert.equal(det.total, 3500);
  assert.deepEqual(valoresDaProposta(r, { soTotal: true }).linhas, []);
  const json = JSON.stringify(cardapioComQuantidades(orc, r)) + JSON.stringify(det);
  assert.ok(!/custo|cmv|margem|lucro/i.test(json), "proposta não leva custo");
});

test("pagamento: entrada e restante pelo modelo", () => {
  const p = pagamentoDaProposta(3500, { entrada_pct: 20, restante_dias: 7, parcelas: 2, extras_dias: 15 });
  assert.deepEqual([p.entradaPct, p.entrada, p.restantePct, p.restante, p.restanteDias, p.parcelas], [20, 700, 80, 2800, 7, 2]);
  assert.equal(pagamentoDaProposta(null, {}).entrada, null, "sem total, sem valor inventado");
});

test("modelo: padrão quando vazio; o salvo vence; fotos do cabeçalho vêm das fichas", () => {
  const m = normalizarModeloProposta(null);
  assert.equal(m.secoes.length, MODELO_PROPOSTA_PADRAO.secoes.length);
  const s = normalizarModeloProposta({ boas_vindas: "Olá!", empresa: { razao_social: "Seldeestrela Ltda" }, secoes: [{ titulo: "Só uma", texto: "a\nb" }] });
  assert.equal(s.boas_vindas, "Olá!");
  assert.equal(s.empresa.razao_social, "Seldeestrela Ltda");
  assert.equal(s.empresa.cnpj, "");
  assert.deepEqual(s.secoes.map((x) => x.titulo), ["Só uma"]);
  assert.deepEqual(fotosDoCardapio(resumoDoOrcamento(coffee(), FICHAS)), ["https://x.supabase.co/a.jpg"]);
});
