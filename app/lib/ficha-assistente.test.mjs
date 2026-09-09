// Testes do Assistente da Receita. Rode com:
//   node app/lib/ficha-assistente.test.mjs

import {
  interpretar, executar, acharIngrediente, custosPorLinha, normalizar, lerValor,
} from "./ficha-assistente.mjs";
import { custoTotalReceita, custoDeProduzirFicha } from "./ficha-calculos.mjs";

let falhas = 0;
function conferir(nome, obtido, esperado) {
  const ok = String(obtido) === String(esperado);
  if (!ok) falhas++;
  console.log(`${ok ? "ok  " : "FALHA"} ${nome}${ok ? "" : `  (obtido ${JSON.stringify(obtido)}, esperado ${JSON.stringify(esperado)})`}`);
}
function contem(nome, texto, trecho) {
  const ok = String(texto || "").includes(trecho);
  if (!ok) falhas++;
  console.log(`${ok ? "ok  " : "FALHA"} ${nome}${ok ? "" : `  (nao achei "${trecho}" em: ${JSON.stringify(texto)})`}`);
}

// ── Leitura de texto ───────────────────────────────────────────────────────
conferir("tira acento e caixa", normalizar("Açaí PURO do Pará"), "acai puro do para");
conferir("le R$ com virgula", lerValor("se a carne subir para R$ 50,00/kg"), 50);
conferir("le milhar", lerValor("custa 1.234,56 reais"), 1234.56);

// ── Intenções ──────────────────────────────────────────────────────────────
const tipo = (frase) => interpretar(frase)?.tipo || null;

conferir("quanto custa", tipo("Quanto custa essa receita hoje?"), "custo_atual");
conferir("qual o custo", tipo("qual o custo da receita"), "custo_atual");
conferir("ingrediente que mais pesa", tipo("Qual ingrediente mais pesa no custo?"), "ingrediente_mais_caro");
conferir("o que mais encarece", tipo("o que mais encarece esse prato"), "ingrediente_mais_caro");

const cmv = interpretar("Simule CMV de 30%");
conferir("simular cmv", cmv?.tipo, "simular_cmv");
conferir("cmv capturado", cmv?.cmv, 30);
conferir("cmv sem porcento", interpretar("quero cmv de 28")?.cmv, 28);

const carne = interpretar("Se a carne subir para R$ 50/kg quanto fica o custo?");
conferir("simular preco de insumo", carne?.tipo, "simular_preco_insumo");
conferir("insumo capturado", carne?.insumo, "carne");
conferir("preco capturado", carne?.preco, 50);
conferir("unidade capturada", carne?.unidade, "kg");
conferir("aceita 'passar para'", interpretar("se o queijo passar para 38,90 o kg")?.preco, 38.9);
conferir("aceita queda de preco", interpretar("se a cebola cair para 3 reais o kg")?.preco, 3);

const escala = interpretar("Transforme esta receita para 20 porções");
conferir("escalar", escala?.tipo, "escalar");
conferir("alvo da escala", escala?.alvo, 20);
conferir("quantas pessoas", interpretar("quanto preciso produzir para 50 pessoas")?.alvo, 50);
conferir("quantas pessoas e escalar", tipo("quanto preciso produzir para 50 pessoas"), "escalar");

conferir("reduzir custo", tipo("Reduza o custo da receita em 10%"), "reduzir_custo");
conferir("pct da reducao", interpretar("reduza o custo em 15%")?.pct, 15);

const add = interpretar("Adicione 150g de carne");
conferir("adicionar", add?.tipo, "adicionar_ingrediente");
conferir("quantidade", add?.quantidade, 150);
conferir("unidade", add?.unidade, "g");
conferir("nome do item", add?.nome, "carne");

const troca = interpretar("Troque o queijo cheddar por queijo prato");
conferir("trocar", troca?.tipo, "trocar_ingrediente");
conferir("de", troca?.de, "queijo cheddar");
conferir("para", troca?.para, "queijo prato");

conferir("frase sem sentido devolve null", interpretar("bom dia, tudo bem?"), null);
conferir("texto vazio devolve null", interpretar(""), null);

// ── Ficha de exemplo ───────────────────────────────────────────────────────
// Carne 150 g a R$ 40/kg = 6,00 · Pão 1 un a R$ 2,00 = 2,00 · Queijo 40 g a
// R$ 30/kg = 1,20. Direto = 9,20.
const ficha = {
  id: "burger", nome_receita: "Cheese Burger", rendimento_porcoes: 1,
  rendimento_unidade: "un", preco_venda: 29.9,
  custo_indireto_tipo: "percentual", custo_indireto_valor: 0,
  fichas_ingredientes: [
    { insumos: { nome: "Carne bovina", custo_compra: 40, tamanho_embalagem: 1000, unidade_medida: "g" }, quantidade: 150, fator_correcao: 0 },
    { insumos: { nome: "Pão brioche", custo_compra: 2, tamanho_embalagem: 1, unidade_medida: "un" }, quantidade: 1, fator_correcao: 0 },
    { insumos: { nome: "Queijo prato", custo_compra: 30, tamanho_embalagem: 1000, unidade_medida: "g" }, quantidade: 40, fator_correcao: 0 },
  ],
};
const direto = custoDeProduzirFicha(ficha, [ficha]);
const custos = custoTotalReceita({ custoIngredientes: direto });
const ctx = { ficha, todasFichas: [ficha], custos };

conferir("custo da ficha de exemplo", direto.toFixed(2), "9.20");

// ── Busca de ingrediente ───────────────────────────────────────────────────
const linhas = custosPorLinha(ficha, [ficha]);
conferir("acha por prefixo", acharIngrediente("carne", linhas)?.nome, "Carne bovina");
conferir("acha nome completo", acharIngrediente("Queijo prato", linhas)?.nome, "Queijo prato");
conferir("acha sem acento", acharIngrediente("pao", linhas)?.nome, "Pão brioche");
conferir("nao inventa item", acharIngrediente("bacon", linhas), null);

// ── Execução ───────────────────────────────────────────────────────────────
const custo = executar({ tipo: "custo_atual" }, ctx);
contem("responde o custo", custo.texto, "R$ 9,20");
contem("responde o CMV", custo.texto, "30,8%");

const caro = executar({ tipo: "ingrediente_mais_caro" }, ctx);
contem("aponta a carne", caro.texto, "Carne bovina");
contem("mostra a fatia do custo", caro.texto, "65,2%");

const sim = executar({ tipo: "simular_cmv", cmv: 25 }, ctx);
contem("preco para CMV 25", sim.texto, "R$ 36,80");
conferir("propoe gravar o preco", sim.proposta?.campo, "preco_venda");
conferir("valor proposto", sim.proposta?.valor, 36.8);

// Carne de R$ 40/kg para R$ 50/kg: 150 g passam de 6,00 para 7,50 (+1,50).
const simCarne = executar({ tipo: "simular_preco_insumo", insumo: "carne", preco: 50, unidade: "kg" }, ctx);
contem("novo custo com carne mais cara", simCarne.texto, "R$ 10,70");
contem("mostra a diferenca", simCarne.texto, "R$ 1,50");

// O MESMO preço dito em outra unidade tem de dar o mesmo custo. Foi aqui que
// o simulador quebrou: trocar a unidade do insumo fazia 150 g virarem 150 kg.
const simCarneG = executar({ tipo: "simular_preco_insumo", insumo: "carne", preco: 0.05, unidade: "g" }, ctx);
contem("R$ 0,05/g da o mesmo que R$ 50/kg", simCarneG.texto, "R$ 10,70");
// E a quantidade da receita continua em gramas depois da simulacao.
contem("nao vira 150 kg de carne", simCarne.texto, "R$ 10,70");

const esc = executar({ tipo: "escalar", alvo: 20, unidade: "porcoes" }, ctx);
contem("escala a carne", esc.texto, "3000 g");
contem("escala o custo", esc.texto, "R$ 184,00");
contem("avisa que nao alterou", esc.nota, "não foi alterada");

const red = executar({ tipo: "reduzir_custo", pct: 10 }, ctx);
contem("valor a cortar", red.texto, "R$ 0,92");
contem("sugere onde cortar", red.texto, "Carne bovina");

// Pré-preparo não tem CMV.
const preparo = executar({ tipo: "simular_cmv", cmv: 30 }, {
  ...ctx, ficha: { ...ficha, eh_base: true, tipo_base: "pre" },
});
contem("preparo nao tem CMV", preparo.texto, "não é vendido");

// Item que não está na receita
const semItem = executar({ tipo: "simular_preco_insumo", insumo: "bacon", preco: 60, unidade: "kg" }, ctx);
contem("avisa item ausente", semItem.texto, "Não achei");

conferir("intencao desconhecida nao quebra", typeof executar({ tipo: "xpto" }, ctx).texto, "string");
conferir("sem ficha nao quebra", typeof executar({ tipo: "custo_atual" }, {}).texto, "string");

console.log(falhas ? `\n${falhas} falha(s)` : "\nTodos os casos passaram.");
process.exit(falhas ? 1 : 0);
