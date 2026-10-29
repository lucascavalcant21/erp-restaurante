// Fidelidade: cartões de selo por produto e cashback (regras puras).
// Rode: node --test app/lib/fidelidade.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizarFidelidade, fidelidadeVigente, normalizarTelefone, selosDoPedido, cashbackDoPedido, saldoDoCliente,
  cashbackUsavel, progressoDoCartao, cartoesDoProduto, fidelidadePublica, STATUS_CONCLUIDO, validarCadastro, descontoDoCadastro,
} from "./fidelidade.mjs";

const CAFE = "11111111-1111-4111-8111-111111111111";
const CAPPU = "22222222-2222-4222-8222-222222222222";
const BURGER = "33333333-3333-4333-8333-333333333333";
const CFG = {
  ativo: true,
  cartoes: [
    { id: "cafe", nome: "Cartão do café", produto_ids: [CAFE, CAPPU], selos: 10, recompensa: "1 café grátis", validade_dias: 90 },
    { id: "burger", nome: "Burger lover", produto_ids: [BURGER], selos: 5, por: "pedido", recompensa: "1 burger grátis" },
    { id: "rascunho", nome: "Sem prêmio ainda", produto_ids: [CAFE], selos: 8, recompensa: "" },
  ],
  cashback: { ativo: true, percentual: "5", minimo_pedido: 30, validade_dias: 60, uso_maximo_pct: 50 },
};
const dia = (d) => new Date(Date.UTC(2026, 9, d, 15)).toISOString();

test("configuração: limites, padrões e campos ruins", () => {
  const f = normalizarFidelidade({
    ativo: true,
    cartoes: [
      { id: "a", nome: "  Café  ", produto_ids: [CAFE, CAFE, "x y", 7], selos: 99, recompensa: "<b>grátis</b>", validade_dias: -3 },
      { id: "a", nome: "repetido" },
      null,
    ],
    cashback: { ativo: true, percentual: 90, minimo_pedido: "abc", uso_maximo_pct: 0 },
  });
  assert.equal(f.cartoes.length, 1, "id repetido e lixo saem");
  assert.deepEqual(f.cartoes[0].produto_ids, [CAFE, "7"]);
  assert.equal(f.cartoes[0].selos, 30, "teto de 30 selos");
  assert.equal(f.cartoes[0].nome, "Café");
  assert.equal(f.cartoes[0].recompensa, "b grátis /b", "sem tags");
  assert.equal(f.cartoes[0].validade_dias, 0);
  assert.equal(f.cartoes[0].por, "unidade");
  assert.equal(f.cashback.percentual, 30, "teto de 30%");
  assert.equal(f.cashback.minimo_pedido, 0);
  assert.equal(f.cashback.uso_maximo_pct, 1);
  assert.deepEqual(normalizarFidelidade(null), {
    ativo: false, cartoes: [], canais: [],
    cashback: { ativo: false, pontos_por_real: 1, valor_100: 5, percentual: 5, minimo_pedido: 0, validade_dias: 60, uso_maximo_pct: 50 },
    cadastro: { ativo: false, desconto_pct: 10, aplica: "primeiro", validade_dias: 0, pedir_email: false, pedir_aniversario: true },
  });
});

test("pontos: R$ 1 = 1 ponto e 100 pontos = R$ 2 vira 2% de cashback; canais", async () => {
  const { pontosDoCashback, pontosDoGasto } = await import("./fidelidade.mjs");
  const f = normalizarFidelidade({ cashback: { pontos_por_real: 1, valor_100: "2,00" }, canais: ["delivery", "x"] });
  assert.equal(f.cashback.percentual, 2);
  assert.equal(pontosDoCashback(22.4, f.cashback), 1120);
  assert.equal(pontosDoGasto(90.5, f.cashback), 90);
  assert.deepEqual(f.canais, ["delivery"]);
  assert.deepEqual(normalizarFidelidade({ canais: ["mesa", "delivery", "balcao"] }).canais, [], "todos = vazio");
});

test("programa desligado não dá nada; cartão sem prêmio ou sem produto não vale", () => {
  assert.deepEqual(fidelidadeVigente({ ...CFG, ativo: false }), { cartoes: [], cashback: null, cadastro: null });
  assert.deepEqual(fidelidadeVigente(CFG).cartoes.map((c) => c.id), ["cafe", "burger"]);
  assert.deepEqual(selosDoPedido([{ produto_id: CAFE, quantidade: 1 }], { ...CFG, ativo: false }), []);
});

test("telefone: só dígitos, sem o 55; fora de 10–11 dígitos fica sem fidelidade", () => {
  assert.equal(normalizarTelefone("(91) 98888-7777"), "91988887777");
  assert.equal(normalizarTelefone("+55 91 98888-7777"), "91988887777");
  assert.equal(normalizarTelefone("5591988887777"), "91988887777");
  assert.equal(normalizarTelefone("9133334444"), "9133334444");
  assert.equal(normalizarTelefone("98888-7777"), "");
  assert.equal(normalizarTelefone(null), "");
});

test("selos de um pedido concluído: por unidade e por pedido", () => {
  const itens = [{ produto_id: CAFE, quantidade: 2 }, { produto_id: CAPPU, quantidade: 1 }, { produto_id: BURGER, quantidade: 3 }, { produto_id: "outro", quantidade: 5 }];
  assert.deepEqual(selosDoPedido(itens, CFG), [{ cartao_id: "cafe", selos: 3 }, { cartao_id: "burger", selos: 1 }]);
  assert.deepEqual(selosDoPedido([{ produto_id: "outro", quantidade: 1 }], CFG), []);
  assert.ok(STATUS_CONCLUIDO.includes("pago") && STATUS_CONCLUIDO.includes("entregue"));
});

test("cashback: % do que foi pago nos itens, com mínimo e sem contar o cashback usado", () => {
  assert.equal(cashbackDoPedido(100, CFG), 5);
  assert.equal(cashbackDoPedido(29.99, CFG), 0, "abaixo do mínimo de R$ 30");
  assert.equal(cashbackDoPedido(100, CFG, { cashbackUsado: 20 }), 4, "5% de 80");
  assert.equal(cashbackDoPedido(47.9, CFG), 2.4);
  assert.equal(cashbackDoPedido(100, { ...CFG, cashback: { ...CFG.cashback, ativo: false } }), 0);
});

test("saldo pelo livro: selos, resgate, estorno e cashback", () => {
  const livro = [
    { tipo: "selo", cartao_id: "cafe", selos: 6, created_at: dia(1) },
    { tipo: "selo", cartao_id: "cafe", selos: 5, created_at: dia(5) },
    { tipo: "selo_resgate", cartao_id: "cafe", selos: -10, created_at: dia(6) },
    { tipo: "selo", cartao_id: "burger", selos: 1, created_at: dia(6) },
    { tipo: "selo_estorno", cartao_id: "burger", selos: -1, created_at: dia(7) },
    { tipo: "cashback", valor: 5, created_at: dia(1) },
    { tipo: "cashback", valor: 2.4, created_at: dia(5) },
    { tipo: "cashback_uso", valor: -3, created_at: dia(6) },
  ];
  const s = saldoDoCliente(livro, CFG, new Date(dia(10)));
  assert.equal(s.cartoes.cafe.selos, 1);
  assert.equal(s.cartoes.cafe.necessarios, 10);
  assert.equal(s.cartoes.burger.selos, 0);
  assert.equal(s.cashback.saldo, 4.4);
  assert.equal(s.cashback.vence_em, new Date(Date.parse(dia(5)) + 60 * 86400000).toISOString());
  assert.deepEqual(saldoDoCliente([], CFG).cashback, { saldo: 0, vencido: 0, vence_em: null }, "sem lançamento, saldo zero");
});

test("validade: sem ganhar nada por N dias, o saldo vence", () => {
  const livro = [{ tipo: "selo", cartao_id: "cafe", selos: 4, created_at: dia(1) }, { tipo: "cashback", valor: 10, created_at: dia(1) }];
  const depois = new Date(Date.parse(dia(1)) + 91 * 86400000);
  const s = saldoDoCliente(livro, CFG, depois);
  assert.equal(s.cartoes.cafe.selos, 0);
  assert.equal(s.cartoes.cafe.vencidos, 4);
  assert.equal(s.cashback.saldo, 0);
  assert.equal(s.cashback.vencido, 10);
  const burger = saldoDoCliente([{ tipo: "selo", cartao_id: "burger", selos: 2, created_at: dia(1) }], CFG, new Date(Date.UTC(2028, 0, 1)));
  assert.equal(burger.cartoes.burger.selos, 2, "cartão sem validade não vence");
});

test("uso do cashback: até o saldo e até o teto do dono", () => {
  assert.equal(cashbackUsavel(30, 100, CFG), 30);
  assert.equal(cashbackUsavel(80, 100, CFG), 50, "teto de 50% do pedido");
  assert.equal(cashbackUsavel(0, 100, CFG), 0);
  assert.equal(cashbackUsavel(30, 100, { ...CFG, ativo: false }), 0);
});

test("progresso do cartão e prato que vale selo", () => {
  assert.deepEqual(progressoDoCartao({ selos: 10 }, 7), { no_cartao: 7, necessarios: 10, faltam: 3, completos: 0 });
  assert.deepEqual(progressoDoCartao({ selos: 10 }, 12), { no_cartao: 2, necessarios: 10, faltam: 0, completos: 1 });
  assert.deepEqual(cartoesDoProduto(CAPPU, CFG).map((c) => c.id), ["cafe"]);
  assert.deepEqual(cartoesDoProduto("outro", CFG), []);
});

test("cardápio público: só cartões valendo, com os produtos visíveis, e nada de cliente", () => {
  const pub = fidelidadePublica(CFG, [CAFE, BURGER]);
  assert.deepEqual(pub.cartoes.map((c) => [c.id, c.produto_ids]), [["cafe", [CAFE]], ["burger", [BURGER]]]);
  assert.equal(pub.cashback.percentual, 5);
  assert.equal(fidelidadePublica({ ...CFG, ativo: false }), null);
  assert.equal(fidelidadePublica(CFG, ["nenhum"]).cartoes.length, 0, "cartão sem prato visível não aparece");
  assert.doesNotMatch(JSON.stringify(pub), /tel|telefone|cliente/);
});

test("cadastro pelo QR: campos limpos, aceite obrigatório e só o que o dono pediu", () => {
  const cfg = { ativo: true, cadastro: { ativo: true, desconto_pct: 10, pedir_email: true } };
  const ok = validarCadastro({ nome: "  Ana  Lima ", telefone: "+55 (91) 98888-7777", email: "Ana@Exemplo.com", aniversario: "1990-05-31", aceite: true, novidades: true }, cfg);
  assert.deepEqual(ok, { ok: true, cadastro: { nome: "Ana Lima", telefone: "91988887777", email: "ana@exemplo.com", aniversario: "1990-05-31", novidades: true } });
  assert.equal(validarCadastro({ nome: "Ana", telefone: "91988887777" }, cfg).codigo, "aceite", "sem aceite da LGPD não cadastra");
  assert.equal(validarCadastro({ nome: "A", telefone: "91988887777", aceite: true }, cfg).codigo, "nome");
  assert.equal(validarCadastro({ nome: "Ana", telefone: "8888-7777", aceite: true }, cfg).codigo, "telefone");
  assert.equal(validarCadastro({ nome: "Ana", telefone: "91988887777", email: "ana@", aceite: true }, cfg).codigo, "email");
  assert.equal(validarCadastro({ nome: "Ana", telefone: "91988887777", aniversario: "1990-02-31", aceite: true }, cfg).codigo, "aniversario");
  assert.equal(validarCadastro({ nome: "Ana", telefone: "91988887777", aniversario: "2999-01-01", aceite: true }, cfg).codigo, "aniversario");
  const semEmail = validarCadastro({ nome: "Ana", telefone: "91988887777", email: "ana@x.com", aceite: true }, { ativo: true, cadastro: { ativo: true } });
  assert.equal(semEmail.cadastro.email, null, "e-mail só se o dono pediu");
  assert.equal(semEmail.cadastro.novidades, false, "novidades só com o sim do cliente");
  assert.equal(validarCadastro({ nome: "Ana", telefone: "91988887777", aceite: true }, { ativo: true }).codigo, "cadastro_fechado");
});

test("desconto do cadastro e o que sai no cardápio público", () => {
  assert.equal(descontoDoCadastro(87.5, 10), 8.75);
  assert.equal(descontoDoCadastro(100, 0), 0);
  assert.equal(descontoDoCadastro(100, 90), 50, "teto de 50%");
  const pub = fidelidadePublica({ ativo: true, cadastro: { ativo: true, desconto_pct: 15, aplica: "sempre" } }, []);
  assert.deepEqual(pub, { cartoes: [], cashback: null, cadastro: { desconto_pct: 15, aplica: "sempre", pedir_email: false, pedir_aniversario: true } });
});
