// Testes do inventário → saldo. O risco é gravar o saldo na unidade errada
// (garrafas × ml) ou aplicar duas vezes; os casos abaixo cobrem os dois.
import {
  ehFracionavel, lerSoma, saldoParaCadastro, cadastroParaSaldo, quantidadeDeEmbalagens, unidadeDoConteudo,
  planoDeAplicacao, faltandoAplicar, marcadorInventario, observacaoDoAjuste,
} from "./inventario-saldo.mjs";
import { daBase, paraBase } from "./contagem-estoque.mjs";

let falhas = 0;
function conferir(nome, recebido, esperado) {
  const ok = JSON.stringify(recebido) === JSON.stringify(esperado);
  if (!ok) falhas++;
  console.log(`${ok ? "ok  " : "FALHA"} ${nome}${ok ? "" : `  (recebido ${JSON.stringify(recebido)}, esperado ${JSON.stringify(esperado)})`}`);
}

const vodkaMl = { id: "v", nome: "Vodka", unidade_medida: "ml", tamanho_embalagem: 750 };
const whiskyGarrafa = { id: "w", nome: "Whisky", unidade_medida: "garrafa", tamanho_embalagem: 750, permite_fracionado: true, unidade_conteudo: "ml" };
const cervejaLata = { id: "c", nome: "Cerveja", unidade_medida: "lata", tamanho_embalagem: 350 };
const arrozKg = { id: "a", nome: "Arroz", unidade_medida: "kg", tamanho_embalagem: 5 };
const tomateKg = { id: "t", nome: "Tomate", unidade_medida: "kg" };
const leiteL = { id: "l", nome: "Leite", unidade_medida: "L", tamanho_embalagem: 1 };
const vodkaSemFrac = { ...vodkaMl, permite_fracionado: false };

// Regra única de embalagem (a mesma da tela do estoque)
conferir("vodka em ml com garrafa de 750 é fracionável", ehFracionavel(vodkaMl), true);
conferir("whisky em garrafa marcado fracionado é fracionável", ehFracionavel(whiskyGarrafa), true);
conferir("lata sem marcar não é fracionável", ehFracionavel(cervejaLata), false);
conferir("arroz em saco de 5 kg é fracionável", ehFracionavel(arrozKg), true);
conferir("tomate sem embalagem não é", ehFracionavel(tomateKg), false);
conferir("leite de 1 L não é", ehFracionavel(leiteL), false);
conferir("desmarcado não é", ehFracionavel(vodkaSemFrac), false);

// Soma digitada (frio + quente)
conferir("6+4 = 10", lerSoma("6+4"), 10);
conferir("vírgula e espaços", lerSoma(" 2,5 + 1,25 "), 3.75);
conferir("vazio é zero", lerSoma(""), 0);
conferir("número simples", lerSoma("12"), 12);
conferir("milhar com ponto e vírgula decimal", lerSoma("1.250,5"), 1250.5);
conferir("parte vazia é inválida", Number.isNaN(lerSoma("6+")), true);
conferir("texto é inválido", Number.isNaN(lerSoma("6+abc")), true);
conferir("fechadas somadas em dois lugares", quantidadeDeEmbalagens({ fechadas: "2+1", aberto: "200" }, { unidade_medida: "ml", tamanho_embalagem: 750 }), { valor: 2450 });

// Fechadas + aberta → unidade do cadastro
conferir("vodka: 3 fechadas + 200 ml = 2450 ml", quantidadeDeEmbalagens({ fechadas: "3", aberto: "200" }, vodkaMl), { valor: 2450 });
conferir("whisky: 3 fechadas + 375 ml = 3,5 garrafas", quantidadeDeEmbalagens({ fechadas: 3, aberto: 375 }, whiskyGarrafa), { valor: 3.5 });
conferir("arroz: 2 sacos + 1,5 kg = 11,5 kg", quantidadeDeEmbalagens({ fechadas: "2", aberto: "1,5" }, arrozKg), { valor: 11.5 });
conferir("só fechadas", quantidadeDeEmbalagens({ fechadas: "4", aberto: "" }, vodkaMl), { valor: 3000 });
conferir("aberta acima da embalagem é erro", quantidadeDeEmbalagens({ fechadas: "1", aberto: "800" }, vodkaMl).erro.startsWith("A aberta tem no máximo"), true);
conferir("fechada fracionada é erro", quantidadeDeEmbalagens({ fechadas: "1,5", aberto: "" }, vodkaMl), { erro: "Embalagens fechadas são inteiras." });
conferir("negativo é erro", quantidadeDeEmbalagens({ fechadas: "-1", aberto: "" }, vodkaMl), { erro: "A quantidade não pode ser negativa." });
conferir("unidade da aberta", [unidadeDoConteudo(vodkaMl), unidadeDoConteudo(whiskyGarrafa), unidadeDoConteudo(arrozKg), unidadeDoConteudo(leiteL)], ["ml", "ml", "kg", "L"]);

// Saldo ↔ cadastro: só o fracionado em unidade que se conta muda de escala
conferir("saldo do whisky (ml) vira garrafas na contagem", saldoParaCadastro(2625, whiskyGarrafa), 3.5);
conferir("garrafas contadas voltam a ml no saldo", cadastroParaSaldo(3.5, whiskyGarrafa), 2625);
conferir("vodka em ml fica em ml", [saldoParaCadastro(2450, vodkaMl), cadastroParaSaldo(2450, vodkaMl)], [2450, 2450]);
conferir("kg fica em kg", cadastroParaSaldo(8.35, tomateKg), 8.35);
conferir("saldo vazio", saldoParaCadastro(null, vodkaMl), null);

// Ida e volta pela base do inventário (g/ml/un) sem perder nada
const ida = (q, ins) => daBase(paraBase(q, ins.unidade_medida), ins.unidade_medida);
conferir("8,350 kg ida e volta", ida(8.35, tomateKg), 8.35);
conferir("2,5 L ida e volta", ida(2.5, leiteL), 2.5);

// Plano de aplicação
const insumoPorId = new Map([vodkaMl, whiskyGarrafa, tomateKg].map((i) => [i.id, i]));
const itens = [
  { id: "1", insumo_id: "t", estoque_id: "coz", quantidade_contada: paraBase(8.35, "kg") },
  { id: "2", insumo_id: "w", estoque_id: "bar", quantidade_contada: paraBase(3.5, "garrafa") },
  { id: "3", insumo_id: "v", estoque_id: "bar", quantidade_contada: 0 },
  { id: "4", insumo_id: "v", estoque_id: null, quantidade_contada: 750 },
];
const plano = planoDeAplicacao(itens, insumoPorId, daBase);
conferir("saldos que serão gravados", plano.aplicar.map((p) => [p.nome, p.estoque_id, p.saldo]), [["Tomate", "coz", 8.35], ["Whisky", "bar", 2625], ["Vodka", "bar", 0]]);
conferir("zero contado grava zero", plano.aplicar.find((p) => p.item_id === "3").saldo, 0);
conferir("sem local fica à parte", plano.semLocal.map((s) => s.item_id), ["4"]);

const marca = marcadorInventario("inv1");
const movs = [
  { tipo: "contagem", estoque_id: "coz", insumo_id: "t", observacao: `Inventário de 01/10/2026 (estoque inicial) ${marca}` },
  { tipo: "contagem", estoque_id: "bar", insumo_id: "w", observacao: "Contagem manual" },
  { tipo: "entrada", estoque_id: "bar", insumo_id: "v", observacao: marca },
];
conferir("reaplicar pula o que já foi gravado", faltandoAplicar(plano, movs, "inv1").map((p) => p.item_id), ["2", "3"]);
conferir("marcador de outro inventário não conta", faltandoAplicar(plano, movs, "inv2").length, 3);
conferir("observação do ajuste", observacaoDoAjuste({ id: "inv1", tipo: "inicial", data_referencia: "2026-10-01" }, (d) => d.split("-").reverse().join("/")), `Inventário de 01/10/2026 (estoque inicial) ${marca}`);

console.log(falhas ? `\n${falhas} falha(s)` : "\nTodos os casos passaram.");
process.exit(falhas ? 1 : 0);
