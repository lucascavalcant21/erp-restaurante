// Cardápio de concorrente do delivery pela foto: guardar (competitor.menu) e
// comparar com as nossas marmitas (marmitaria.concorrentes). 17/11/2026.
// TESTADO EM MOCK: banco em memória; a função do banco (CONC-1) é testada com
// SQL real no PGlite em app/lib/concorrentes-banco.test.mjs.
import test from "node:test";
import assert from "node:assert/strict";
import { criarMotorDeMetricas } from "../metrics/engine.mjs";
import { criarDbEscopado } from "../context/db-escopado.mjs";
import { montarContextoInteligencia } from "../context/context-engine.mjs";
import { criarVerificador } from "../permissions/mapa.mjs";
import { criarServicoDeAcoes } from "../actions/servico.mjs";
import { processarComando, pedidoSchema } from "../commands/command-bus.mjs";
import { criarStoreMemoria } from "../audit/store-memoria.mjs";
import { interpretarPorRegras } from "../commands/interpretador-regras.mjs";
import { HANDLERS_CONCORRENTES, concorrenteDaFrase, nossasParaComparar } from "../agents/concorrentes-agente.mjs";
import { acaoPorId } from "../actions/registry.mjs";
import { cardapioDoOcr } from "../../marmitaria/concorrentes.mjs";
import { bancoFalso, contexto, depsFalsas, AGORA } from "./apoio.mjs";
import { tabelasPadrao } from "./fixtures.mjs";

const A = "loja-a";
const CARDAPIO = cardapioDoOcr({
  estabelecimento: "Sabor da Vila", plataforma: "iFood", taxa_entrega: "5,99",
  itens: [
    { tipo: "prato", nome: "Frango empanado com fritas", descricao: "Arroz, feijão, frango empanado e batata frita", peso: "500 g", preco: "27,90" },
    { tipo: "prato", nome: "Strogonoff de carne", descricao: "Arroz, strogonoff e batata palha", preco: "32,00" },
    { tipo: "adicional", grupo: "Turbine sua marmita", nome: "Ovo frito", preco: "3,00" },
    { tipo: "adicional", grupo: "Turbine sua marmita", nome: "Farofa", preco: "2,50" },
    { tipo: "bebida", nome: "Coca lata", preco: "6,00" },
  ],
});

async function montar({ negar = [], comNome = true } = {}) {
  const deps = depsFalsas({ negar });
  const ctx = await contexto(undefined, A, deps);
  const ic = montarContextoInteligencia({ requestContext: ctx, tela: null, agora: AGORA });
  const t = tabelasPadrao();
  t.delivery_concorrentes = [{ id: "c-old", unidade_id: A, nome: "Cantinho da Ana", plataforma: "ifood" }];
  const gravados = [];
  const db = bancoFalso(t, {
    rpcs: {
      hefisto_salvar_leitura_concorrente: async (a) => {
        gravados.push(a);
        return { ok: true, idempotente: gravados.filter((g) => g.p_dados.chave === a.p_dados.chave).length > 1, leitura_id: "0f0f0f0f-0000-4000-8000-000000000001", concorrente_id: "0f0f0f0f-0000-4000-8000-000000000002", itens: a.p_dados.itens.length };
      },
    },
  });
  const dbe = criarDbEscopado(db, ic.escopo);
  const verificador = criarVerificador(ctx, deps);
  const motor = criarMotorDeMetricas({ dbe, escopo: ic.escopo, verificador, agora: AGORA });
  const store = criarStoreMemoria();
  const servicoAcoes = criarServicoDeAcoes({ store, escopo: ic.escopo, dbe, dbUsuario: db, verificador, nomeUsuario: "Lucas", relogio: () => AGORA });
  let n = 0;
  const cardapio = comNome ? CARDAPIO : (({ concorrente, plataforma, ...resto }) => resto)(CARDAPIO);
  const pedir = (pedido) => processarComando({ pedido: { chave: `chave-cardapio-${++n}`, ...pedido }, ic, motor, servicoAcoes, store, correlationId: `c${n}` });
  const responder = (acaoId, valor) => processarComando({ pedido: { continuar: { acaoId, campo: "resposta", valor } }, ic, motor, servicoAcoes, store, correlationId: "r" });
  const confirmar = (acaoId) => servicoAcoes.confirmar({ acaoId, correlationId: "ok" });
  return { pedir, responder, confirmar, gravados, cardapio };
}

test("frases: mandar o cardápio, comparar e não confundir com o raio-x", () => {
  const casos = {
    "Jhon, vou te mandar o cardápio de um concorrente": "marmitaria.concorrente_ler",
    "lê esse cardápio do concorrente": "marmitaria.concorrente_ler",
    "Compare o cardápio da Sabor da Vila com as nossas marmitas": "marmitaria.concorrentes",
    "estamos mais caros que os concorrentes?": "marmitaria.concorrentes",
    "Compare os adicionais dos concorrentes com os nossos": "marmitaria.concorrentes",
    "como são nossas marmitas?": "marmitaria.raio_x",
  };
  for (const [frase, esperado] of Object.entries(casos)) assert.equal(interpretarPorRegras(frase).valor.intencao, esperado, frase);
});

test("pedidoSchema aceita o cardápio lido e recusa item sem preço", () => {
  assert.equal(pedidoSchema.parse({ chave: "chave-12345678", cardapio: CARDAPIO }).ok, true);
  const ruim = { ...CARDAPIO, itens: [{ tipo: "prato", nome: "Sem preço" }] };
  assert.equal(pedidoSchema.parse({ chave: "chave-12345678", cardapio: ruim }).ok, false);
  assert.equal(pedidoSchema.parse({ chave: "chave-12345678", cardapio: { ...CARDAPIO, plataforma: "orkut" } }).ok, false);
});

test("cardápio com nome e app: prévia direto, confirmar grava pela função do banco com chave", async () => {
  const { pedir, confirmar, gravados, cardapio } = await montar();
  const r = await pedir({ cardapio });
  assert.equal(r.interpretacao.intencao, "marmitaria.concorrente_ler");
  assert.equal(r.tipo, "confirmacao");
  assert.match(r.texto, /^Li o cardápio da Sabor da Vila: 2 pratos, 2 adicionais, 1 outros itens\./);
  const linhas = Object.fromEntries(r.confirmacao.linhas.map((l) => [l.rotulo, l.valor]));
  assert.equal(linhas.Concorrente, "Sabor da Vila");
  assert.equal(linhas.App, "iFood");
  assert.match(linhas.Pratos, /R\$\s?27,90 a R\$\s?32,00/);
  assert.match(linhas.Adicionais, /Ovo frito/);
  assert.equal(r.confirmacao.risco, "MEDIUM");
  assert.equal(gravados.length, 0, "nada gravado antes de confirmar");
  const ok = await confirmar(r.confirmacao.acaoId);
  assert.equal(ok.tipo, "resultado_acao");
  assert.match(ok.texto, /Cardápio da Sabor da Vila guardado/);
  assert.equal(gravados.length, 1);
  assert.equal(gravados[0].p_unidade, A);
  assert.equal(gravados[0].p_dados.concorrente, "Sabor da Vila");
  assert.equal(gravados[0].p_dados.plataforma, "ifood");
  assert.equal(gravados[0].p_dados.fonte, "foto");
  assert.equal(gravados[0].p_dados.itens.length, 5);
  assert.ok(gravados[0].p_dados.chave, "manda a chave de idempotência");
  assert.ok(ok.sugestoes.some((s) => /Compare o cardápio da Sabor da Vila/.test(s)));
});

test("sem nome e sem app: pergunta os dois (concorrentes já guardados viram botões)", async () => {
  const { pedir, responder, cardapio } = await montar({ comNome: false });
  let r = await pedir({ cardapio });
  assert.equal(r.tipo, "pergunta");
  assert.match(r.texto, /De qual concorrente/);
  assert.ok(r.pergunta.opcoes.some((o) => /Cantinho da Ana \(iFood\)/.test(o.rotulo)));
  const acao = r.pergunta.acaoId;
  r = await responder(acao, "sabor da vila");
  assert.match(r.texto, /é de qual app/);
  assert.ok(r.pergunta.opcoes.some((o) => o.id === "99food"));
  r = await responder(acao, "99");
  assert.equal(r.tipo, "confirmacao");
  const linhas = Object.fromEntries(r.confirmacao.linhas.map((l) => [l.rotulo, l.valor]));
  assert.equal(linhas.Concorrente, "Sabor da vila");
  assert.equal(linhas.App, "99Food");
});

test("sem permissão de guardar concorrente: bloqueado", async () => {
  const { pedir, cardapio } = await montar({ negar: ["marmitaria.competitors.create"] });
  const r = await pedir({ cardapio });
  assert.equal(r.tipo, "bloqueado");
});

test("a ação está no registro com risco médio e capacidade própria", () => {
  const def = acaoPorId("competitor.menu");
  assert.equal(def.risco, "MEDIUM");
  assert.equal(def.capacidade, "concorrentes_gravar");
});

// ─── Comparação ──────────────────────────────────────────────────────────────

const FICHAS = [
  { id: "m1", nome_receita: "Frango empanado com fritas", departamento: "marmitaria", ativo: true, status: "ativa", peso_porcao_g: 450 },
  { id: "m2", nome_receita: "Carne de panela", departamento: "marmitaria", ativo: true, status: "ativa" },
];
const INGS = [{ ficha_id: "m1", insumo_id: "i1", quantidade: 0.15, fator_correcao: 0 }, { ficha_id: "m1", insumo_id: "i2", quantidade: 0.12, fator_correcao: 0 }];
const INSUMOS = [
  { id: "i1", nome: "Filé de frango", unidade_medida: "kg", custo_unitario: 24, tamanho_embalagem: 1, custo_compra: 24 },
  { id: "i2", nome: "Batata frita", unidade_medida: "kg", custo_unitario: 12, tamanho_embalagem: 1, custo_compra: 12 },
];
const ITENS = CARDAPIO.itens.map((i, k) => ({ ...i, leitura_id: "l1", ordem: k + 1 }));

function motorFalso({ pode = true, tabelas = {}, canais = [{ id: "ifood", nome: "iFood", ativo: true, comissao_pct: 12 }] } = {}) {
  const base = {
    fichas_tecnicas: FICHAS, fichas_ingredientes: INGS, insumos: INSUMOS,
    marmitaria_configuracoes: [{ canais, rateio: {} }],
    marmitaria_fichas_embalagens: [], marmitaria_precificacao_canais: [{ ficha_id: "m1", canal: "ifood", preco_venda: 29.9 }],
    marmitaria_rh_alocacoes: [], marmitaria_vendas: [],
    config_sistema: [{ params: { cardapio_digital: { grupos: [{ nome: "Adicionais", tipo: "adicional", opcoes: [{ nome: "Ovo frito", preco: 2.5 }, { nome: "Bacon", preco: 4 }] }] } } }],
    delivery_concorrentes: [{ id: "c1", nome: "Sabor da Vila", plataforma: "ifood" }, { id: "c2", nome: "Cantinho da Ana", plataforma: "ifood" }],
    delivery_concorrentes_leituras: [
      { id: "l0", concorrente_id: "c1", observado_em: "2026-10-01", created_at: "2026-10-01T10:00:00Z" },
      { id: "l1", concorrente_id: "c1", observado_em: "2026-11-17", created_at: "2026-11-17T10:00:00Z" },
    ],
    delivery_concorrentes_itens: [...ITENS, { tipo: "prato", nome: "Velho", preco: 10, leitura_id: "l0", ordem: 1 }],
    ...tabelas,
  };
  const q = (t) => {
    const filtros = [];
    const ordem = [];
    const o = {
      select: () => o, gte: () => o, lte: () => o, limit: () => o, in: () => o,
      eq: (c, v) => { filtros.push([c, v]); return o; },
      order: (c, op) => { ordem.push([c, op?.ascending !== false]); return o; },
      then: (f, g) => {
        let linhas = (base[t] || []).filter((l) => filtros.every(([c, v]) => String(l[c]) === String(v)));
        for (const [c, asc] of [...ordem].reverse()) linhas = [...linhas].sort((a, b) => (a[c] > b[c] ? 1 : a[c] < b[c] ? -1 : 0) * (asc ? 1 : -1));
        return Promise.resolve({ data: linhas, error: null }).then(f, g);
      },
    };
    return o;
  };
  return { ambiente: { dbe: { from: q, consultas: [] }, hoje: "2026-11-17", verificador: { pode: async () => pode } } };
}

test("concorrente citado na frase pelo nome", () => {
  const cs = [{ id: "c1", nome: "Sabor da Vila" }, { id: "c2", nome: "Cantinho da Ana" }];
  assert.equal(concorrenteDaFrase(cs, "compare o cardápio da sabor da vila")?.id, "c1");
  assert.equal(concorrenteDaFrase(cs, "e a Ana, está mais barata?")?.id, "c2");
  assert.equal(concorrenteDaFrase(cs, "compare os concorrentes"), null);
});

test("comparação: último cardápio, preço no mesmo app, adicionais deles × nossos", async () => {
  const out = await HANDLERS_CONCORRENTES["marmitaria.concorrentes"]({ motor: motorFalso(), params: { texto: "Compare o cardápio da Sabor da Vila com as nossas marmitas" } });
  assert.match(out.texto, /Sabor da Vila no iFood \(cardápio visto em 17\/11\)/);
  assert.match(out.texto, /1 das nossas está mais cara/);
  assert.match(out.texto, /Farofa/, "adicional que só eles têm");
  const pratos = out.blocos.find((b) => /Nossas marmitas ×/.test(b.titulo));
  const frango = pratos.itens.find((i) => /Frango empanado com fritas ×/.test(i.rotulo));
  assert.match(frango.valor, /R\$\s?29,90 × R\$\s?27,90 \(\+R\$\s?2,00\)/);
  assert.match(frango.valor, /100 g: R\$\s?6,64 × R\$\s?5,58/);
  assert.ok(pratos.itens.some((i) => i.rotulo === "Carne de panela" && /sem preço · sem prato parecido/.test(i.valor)));
  assert.ok(!JSON.stringify(out).includes("Velho"), "usa só a leitura mais recente");
  const adic = out.blocos.find((b) => /Adicionais/.test(b.titulo));
  assert.ok(adic.itens.some((i) => /Ovo frito/.test(i.rotulo) && /nosso R\$\s?2,50/.test(i.valor)));
  assert.ok(adic.itens.some((i) => i.rotulo === "Bacon" && /só nós/.test(i.valor)));
});

test("sem o app do concorrente em Custos e apps: não compara valor (DADOS INSUFICIENTES)", async () => {
  const out = await HANDLERS_CONCORRENTES["marmitaria.concorrentes"]({ motor: motorFalso({ canais: [{ id: "balcao", nome: "Balcão", ativo: true }] }), params: { texto: "compare os concorrentes" } });
  assert.match(out.texto, /DADOS INSUFICIENTES do nosso preço no iFood/);
  assert.ok(!/mais cara/.test(out.texto));
});

test("nada guardado: DADOS INSUFICIENTES e como mandar os prints", async () => {
  const out = await HANDLERS_CONCORRENTES["marmitaria.concorrentes"]({ motor: motorFalso({ tabelas: { delivery_concorrentes: [] } }), params: { texto: "compare os concorrentes" } });
  assert.match(out.texto, /^DADOS INSUFICIENTES: ainda não há cardápio de concorrente guardado/);
  assert.match(out.texto, /Cardápio de concorrente/);
});

test("sem permissão: não mostra os cardápios", async () => {
  const out = await HANDLERS_CONCORRENTES["marmitaria.concorrentes"]({ motor: motorFalso({ pode: false }), params: { texto: "compare os concorrentes" } });
  assert.match(out.texto, /não tem acesso/);
  assert.equal(out.blocos.length, 0);
});

test("nossas marmitas: preço só do app do concorrente, componentes e peso da ficha", () => {
  const d = {
    canais: [{ id: "ifood", nome: "iFood", ativo: true }, { id: "99food", nome: "99Food", ativo: true }],
    marmitas: [{ id: "m1", nome_receita: "Frango", peso_final_g: 450, precos: { ifood: 29.9, "99food": 27 }, itens: [{ insumo_id: "i1" }] }],
    fichas: [], insumos: new Map([["i1", { nome: "Filé de frango" }]]),
  };
  assert.equal(nossasParaComparar(d, "99food")[0].preco, 27);
  assert.equal(nossasParaComparar(d, "ifood")[0].preco, 29.9);
  assert.equal(nossasParaComparar(d, "rappi")[0].preco, null);
  assert.deepEqual(nossasParaComparar(d, "ifood")[0].componentes, ["Filé de frango"]);
  assert.equal(nossasParaComparar(d, "ifood")[0].peso_g, 450);
});
