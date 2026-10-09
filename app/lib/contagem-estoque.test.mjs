// Testes da contagem de estoque (F2.4A). Puras + integração no Postgres em
// memória (PGlite) com o SQL REAL da F2.1 (triggers, RLS por unidade, grants
// como em produção). Uso:
//   PGLITE=<caminho de @electric-sql/pglite> node app/lib/contagem-estoque.test.mjs
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  unidadeContagem, paraBase, daBase, lerQuantidade, cicloDoMes, proximaContagem, grupoDoEstoque, tituloContagem,
  lerObs, escreverObs, progressoContagem, resumoFechamento, custoSugerido, enfileirar, compararContagens, valorContagem,
  statusItemContagem, impactoDivergencias, MSG_JA_CONTADO,
  criarContagem, salvarItemContagem, adicionarPendencia, marcarPendencia, fecharContagem, cancelarContagem,
} from "./contagem-estoque.mjs";
import { criarBancoF21, clienteSupabase } from "./teste-banco-f21.mjs";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
let falhas = 0;
const conferir = (nome, obtido, esperado) => {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas++;
  console.log(`${ok ? "ok  " : "FALHA"} ${nome}${ok ? "" : `\n      obtido:   ${JSON.stringify(obtido)}\n      esperado: ${JSON.stringify(esperado)}`}`);
};

// ── 1. puras ─────────────────────────────────────────────────────────────────
conferir("unidades: kg→g ×1000, L→ml ×1000, g/ml/un ×1", ["kg", "g", "L", "l", "ml", "un"].map((u) => [unidadeContagem(u).rotulo, unidadeContagem(u).base, unidadeContagem(u).fator]),
  [["kg", "g", 1000], ["g", "g", 1], ["L", "ml", 1000], ["L", "ml", 1000], ["ml", "ml", 1], ["un", "un", 1]]);
conferir("unidades: garrafa/caixa/pacote contadas como estão (sem conversão inventada)", ["garrafa", "caixa", "pacote"].map((u) => [unidadeContagem(u).rotulo, unidadeContagem(u).base, unidadeContagem(u).fator]),
  [["garrafa", "un", 1], ["caixa", "un", 1], ["pacote", "un", 1]]);
conferir("12,500 kg → 12500 g e volta", [paraBase(12.5, "kg"), daBase(12500, "kg"), paraBase(14, "L"), daBase(14000, "l")], [12500, 12.5, 14000, 14]);
conferir("quantidade digitada: '12,500' / '8,35' / '0' / '32'", ["12,500", "8,35", "0", "32"].map((v) => lerQuantidade(v).valor), [12.5, 8.35, 0, 32]);
conferir("quantidade: vazio, negativo e texto → erro", ["", "-1", "abc"].map((v) => !!lerQuantidade(v).erro), [true, true, true]);
conferir("ciclo de outubro/2026: 01 inicial, 08/15/22/29 semanais, 31 fechamento",
  cicloDoMes(2026, 10).map((c) => `${c.data.slice(8)}:${c.tipo}`), ["01:inicial", "08:intermediaria", "15:intermediaria", "22:intermediaria", "29:intermediaria", "31:final"]);
conferir("ciclo de fevereiro/2028 (29 dias): 29 é o fechamento, sem semanal duplicada",
  cicloDoMes(2028, 2).map((c) => `${c.data.slice(8)}:${c.tipo}`), ["01:inicial", "08:intermediaria", "15:intermediaria", "22:intermediaria", "29:final"]);
conferir("próxima contagem: sem nada fechado em 01/10 → 01/10", proximaContagem([], "2026-10-01")?.data, "2026-10-01");
conferir("próxima contagem: 01/10 fechado → 08/10", proximaContagem([{ status: "fechada", data_referencia: "2026-10-01" }], "2026-10-01")?.data, "2026-10-08");
conferir("próxima contagem: em 30/10 → 31/10 (fechamento)", proximaContagem([], "2026-10-30")?.data, "2026-10-31");
conferir("grupos: cozinha / bar / pré-preparos / outros pelo slug",
  ["cozinha", "bar", "pre-preparos-cozinha", "pre-preparos-bar", "limpeza", "embalagens-bar", "deposito"].map((slug) => grupoDoEstoque({ slug })),
  ["cozinha", "bar", "pre", "pre", "outros", "outros", "outros"]);
conferir("título: Estoque inicial — outubro/2026", tituloContagem({ tipo: "inicial", data_referencia: "2026-10-01" }), "Estoque inicial — outubro/2026");
conferir("observação: JSON ida e volta; texto antigo vira nota", [lerObs(escreverObs({ nota: "x", pendencias: [{ id: 1 }] })), lerObs("texto livre")],
  [{ nota: "x", pendencias: [{ id: 1 }] }, { nota: "texto livre", pendencias: [] }]);
const prods = [{ insumo_id: "a", estoque_id: "E1" }, { insumo_id: "b", estoque_id: "E1" }, { insumo_id: "c", estoque_id: "E2" }, { insumo_id: "a", estoque_id: "E2" }];
const its = [{ insumo_id: "a", estoque_id: "E1", quantidade_contada: 5 }, { insumo_id: "c", estoque_id: "E2", quantidade_contada: 0 }, { insumo_id: "z", estoque_id: "E1", quantidade_contada: 1 }];
conferir("progresso: 2/4 contados (50%), 1 zerado, 1 achado pela busca fora da lista",
  progressoContagem(prods, its), { total: 4, contados: 2, naoContados: 2, zerados: 1, foraDaLista: 1, pct: 50 });
const rf = resumoFechamento({ produtos: prods, itens: its, pendencias: [{ status: "pendente" }, { status: "descartada" }], estoques: [{ id: "E1", nome: "Cozinha" }, { id: "E2", nome: "Bar" }] });
conferir("finalizar: não contados e pendências exigem confirmação; resumo por local",
  [rf.naoContados, rf.pendencias, rf.precisaConfirmar, rf.porLocal.map((l) => `${l.nome}:${l.contados}/${l.total}`)], [2, 1, true, ["Cozinha:1/2", "Bar:1/2"]]);
conferir("custo: unitário = embalagem/tamanho → OK (picanha R$ 46,67/kg)",
  [custoSugerido({ unidade_medida: "kg", custo_unitario: 46.67, custo_compra: 46.67, tamanho_embalagem: 1 }).situacao, custoSugerido({ unidade_medida: "kg", custo_unitario: 46.67, custo_compra: 46.67, tamanho_embalagem: 1 }).porUnidade], ["ok", 46.67]);
conferir("custo: valores do cadastro que não batem → DIVERGENTE, nada aplicado sozinho",
  [custoSugerido({ unidade_medida: "kg", custo_unitario: 0.05, custo_compra: 50, tamanho_embalagem: 1 }).situacao, custoSugerido({ unidade_medida: "kg", custo_unitario: 0.05, custo_compra: 50, tamanho_embalagem: 1 }).porUnidade], ["divergente", null]);
conferir("custo: só um valor → ÚNICO (sem conferência); nenhum → SEM CUSTO",
  [custoSugerido({ unidade_medida: "un", custo_unitario: 3 }).situacao, custoSugerido({ unidade_medida: "un" }).situacao], ["unico", "sem_custo"]);
conferir("custo: garrafa cujo tamanho é o conteúdo (600 ml) → a embalagem é a própria garrafa",
  [custoSugerido({ unidade_medida: "garrafa", custo_unitario: 13, custo_compra: 13, tamanho_embalagem: 600, unidade_conteudo: "ml" }).situacao,
   custoSugerido({ unidade_medida: "garrafa", custo_unitario: 13, custo_compra: 13, tamanho_embalagem: 600, unidade_conteudo: "ml" }).porUnidade], ["ok", 13]);
conferir("custo: custo médio das compras tem prioridade (R$ 0,04667/g → R$ 46,67/kg)",
  Math.round(custoSugerido({ unidade_medida: "kg", custo_unitario: 40 }, 0.04667).porUnidade * 100) / 100, 46.67);
conferir("fila offline: a gravação mais nova do mesmo produto/local substitui a anterior",
  enfileirar(enfileirar([], { insumo_id: "a", estoque_id: "E1", quantidade: "1" }), { insumo_id: "a", estoque_id: "E1", quantidade: "2" }).map((x) => x.quantidade), ["2"]);
conferir("comparação: diferença física (não é consumo)",
  compararContagens([{ insumo_id: "p", estoque_id: "E1", quantidade_contada: 10000, unidade_base: "g" }], [{ insumo_id: "p", estoque_id: "E1", quantidade_contada: 6500, unidade_base: "g" }]).map((l) => [l.anterior, l.atual, l.diferenca]),
  [[10000, 6500, -3500]]);

conferir("status do produto: não contado / contado / divergência só para quem pode ver / revisão (corrigido)",
  [statusItemContagem(null), statusItemContagem({ quantidade_contada: 8000, quantidade_sistema: 10000 }),
   statusItemContagem({ quantidade_contada: 8000, quantidade_sistema: 10000 }, { mostrarDivergencia: true }),
   statusItemContagem({ quantidade_contada: 10000, quantidade_sistema: 10000 }, { mostrarDivergencia: true }),
   statusItemContagem({ quantidade_contada: 1, observacao: "Corrigido por Gil: 2 → 1 kg (balança)" }, { mostrarDivergencia: true })],
  ["nao_contado", "contado", "divergencia", "contado", "revisao"]);
const imp = impactoDivergencias([
  { id: "a", quantidade_contada: 8000, quantidade_sistema: 10000, custo_unitario: 0.04 },   // −2 kg × R$ 40/kg
  { id: "b", quantidade_contada: 1500, quantidade_sistema: 1000, custo_unitario: 0.009 },   // +500 ml × R$ 9/L
  { id: "c", quantidade_contada: 5, quantidade_sistema: 5, custo_unitario: 5 },
  { id: "d", quantidade_contada: 3, quantidade_sistema: null, custo_unitario: 5 },
]);
conferir("impacto em R$: perda −80, sobra +4,50, líquido −75,50; sem saldo do sistema fica à parte",
  [imp.perdas, imp.sobras, imp.liquido, imp.comDiferenca, imp.semReferencia], [-80, 4.5, -75.5, 2, 1]);

// ── 2. banco simulado (SQL real da F2.1, papel authenticated, RLS) ──────────
const pg = await criarBancoF21(raiz, `
  alter table public.insumos add column unidade_medida text, add column custo_unitario numeric, add column custo_compra numeric,
    add column tamanho_embalagem numeric, add column categoria text, add column codigo_interno text;
  alter table public.estoques add column slug text, add column tipo text, add column status text default 'ativo';
`, { secFin2: true, f24b: process.env.F24B === "1" });
if (!pg) { console.log("\nPGLITE não informado: integração NÃO executada."); process.exit(falhas ? 1 : 2); }
console.log(`(banco: F2.1 + SEC-FIN-2${process.env.F24B === "1" ? " + F2.4B (gatilho de custo no fechamento)" : ""})`);
const db = clienteSupabase(pg);
const outra = clienteSupabase(pg, { unidade: "outra", uid: "44444444-4444-4444-4444-444444444444" });
const U = "seldeestrela";
// "hoje" no fuso de São Paulo, como fin_hoje() no banco (em UTC o teste falhava entre 21h e 24h)
const HOJE = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
const id = async (sql, params = []) => (await pg.query(sql, params)).rows[0].id;
const estCozinha = await id(`insert into public.estoques (unidade_id, nome, slug, tipo) values ($1,'Cozinha','cozinha','alimentos') returning id`, [U]);
const estBar = await id(`insert into public.estoques (unidade_id, nome, slug, tipo) values ($1,'Bar','bar','bebidas') returning id`, [U]);
const picanha = await id(`insert into public.insumos (unidade_id, nome, unidade_medida, custo_unitario, custo_compra, tamanho_embalagem) values ($1,'Picanha','kg',46.67,46.67,1) returning id`, [U]);
const oleo = await id(`insert into public.insumos (unidade_id, nome, unidade_medida, custo_unitario) values ($1,'Óleo','L',9) returning id`, [U]);
const cerveja = await id(`insert into public.insumos (unidade_id, nome, unidade_medida, custo_unitario) values ($1,'Cerveja X','un',5) returning id`, [U]);
const itens = async (cid) => (await pg.query(`select id, insumo_id, estoque_id, quantidade_contada::float q, unidade_base, quantidade_sistema::float s,
  custo_unitario::float c, valor_total::float v, observacao from public.estoque_contagens_itens where contagem_id = $1 order by created_at`, [cid])).rows;

conferir("abrir inventário com data futura → recusado", /futura/.test((await criarContagem(db, { unidade_id: U, tipo: "inicial", data_referencia: "2999-01-01" })).error || ""), true);
conferir("abrir inventário com tipo inválido → recusado", /inválido/.test((await criarContagem(db, { unidade_id: U, tipo: "mensal", data_referencia: HOJE })).error || ""), true);
const c1 = await criarContagem(db, { unidade_id: U, tipo: "inicial", data_referencia: HOJE });
const cab = (await pg.query(`select status, tipo, estoque_id, criado_por from public.estoque_contagens where id = $1`, [c1.data?.id])).rows[0];
conferir("abrir: EM CONTAGEM (aberta), estoque inicial, a unidade inteira, responsável = usuário logado",
  [c1.error, cab.status, cab.tipo, cab.estoque_id, cab.criado_por], [null, "aberta", "inicial", null, "33333333-3333-3333-3333-333333333333"]);
const c1b = await criarContagem(db, { unidade_id: U, tipo: "inicial", data_referencia: HOJE });
conferir("abrir de novo (clique duplo / outro celular) → reaproveita o mesmo, não duplica", [c1b.data.id === c1.data.id, c1b.data.ja_existia], [true, true]);
const C = c1.data.id;

const s1 = await salvarItemContagem(db, { contagem_id: C, unidade_id: U, insumo_id: picanha, estoque_id: estCozinha, quantidade: "8,350", unidade_medida: "kg", quantidade_sistema: 10 });
conferir("contar Picanha 8,350 kg → grava 8350 g (base), saldo do sistema 10 kg guardado como 10000 g",
  [s1.error, (await itens(C)).map((i) => [i.q, i.unidade_base, i.s])], [null, [[8350, "g", 10000]]]);
const s1b = await salvarItemContagem(db, { contagem_id: C, unidade_id: U, insumo_id: picanha, estoque_id: estCozinha, quantidade: "8,400", unidade_medida: "kg", quantidade_sistema: 99, item_id: s1.data.id });
conferir("produto já contado: funcionário NÃO corrige (só administrador, com PIN); nada muda",
  [s1b.error, s1b.jaContado, (await itens(C)).map((i) => [i.q, i.s])], [MSG_JA_CONTADO, true, [[8350, 10000]]]);
const s1c = await salvarItemContagem(db, { contagem_id: C, unidade_id: U, insumo_id: picanha, estoque_id: estCozinha, quantidade: "8,400", unidade_medida: "kg" });
conferir("outro celular grava OUTRO número no mesmo produto/local → recusado, não substitui",
  [s1c.jaContado, (await itens(C)).length, (await itens(C))[0].q], [true, 1, 8350]);
const s1d = await salvarItemContagem(db, { contagem_id: C, unidade_id: U, insumo_id: picanha, estoque_id: estCozinha, quantidade: "8,350", unidade_medida: "kg" });
conferir("reenvio do MESMO número (rede caiu depois de gravar) → ok, sem duplicar",
  [s1d.error, s1d.data?.novo, (await itens(C)).length], [null, false, 1]);
await salvarItemContagem(db, { contagem_id: C, unidade_id: U, insumo_id: oleo, estoque_id: estCozinha, quantidade: "14", unidade_medida: "L", detalhe: "15 garrafa(s) de 0,9 L + 500 ml = 14 L" });
await salvarItemContagem(db, { contagem_id: C, unidade_id: U, insumo_id: cerveja, estoque_id: estBar, quantidade: "32", unidade_medida: "un" });
const z = await salvarItemContagem(db, { contagem_id: C, unidade_id: U, insumo_id: cerveja, estoque_id: estCozinha, quantidade: "0", unidade_medida: "un" });
conferir("ZERO grava 0 de verdade (linha existe); o mesmo produto em outro local é outra linha",
  [z.error, (await itens(C)).map((i) => [i.q, i.unidade_base])], [null, [[8350, "g"], [14000, "ml"], [32, "un"], [0, "un"]]]);
conferir("quantidade negativa → recusada", /negativa/.test((await salvarItemContagem(db, { contagem_id: C, unidade_id: U, insumo_id: oleo, estoque_id: estBar, quantidade: "-2", unidade_medida: "L" })).error || ""), true);

const pd = await adicionarPendencia(db, { contagem_id: C, nome: "Molho X (sem cadastro)", unidade: "garrafa", estoque_id: estBar, quantidade: "3" });
const [pa, pb] = await Promise.all([
  adicionarPendencia(db, { contagem_id: C, nome: "Item A", unidade: "kg", quantidade: "1" }),
  adicionarPendencia(db, { contagem_id: C, nome: "Item B", unidade: "un", quantidade: "2" }),
]);
const obs = lerObs((await pg.query(`select observacao from public.estoque_contagens where id = $1`, [C])).rows[0].observacao);
conferir("produto não cadastrado → PENDENTE no inventário (nenhum insumo criado); duas ao mesmo tempo não se perdem",
  [pd.error, pa.error, pb.error, obs.pendencias.map((p) => `${p.nome}:${p.status}`).sort(), (await pg.query(`select count(*)::int n from public.insumos`)).rows[0].n],
  [null, null, null, ["Item A:pendente", "Item B:pendente", "Molho X (sem cadastro):pendente"], 3]);
conferir("pendência sem unidade válida → recusada", !!(await adicionarPendencia(db, { contagem_id: C, nome: "x y", unidade: "litrão", quantidade: "1" })).error, true);
conferir("marcar pendência como descartada", (await marcarPendencia(db, { contagem_id: C, pendencia_id: pa.data.id, status: "descartada" })).data.pendencias.find((p) => p.id === pa.data.id).status, "descartada");

const its1 = (await itens(C)).map((i) => ({ id: i.id, insumo_id: i.insumo_id, quantidade_contada: i.q }));
const un = { [picanha]: "kg", [oleo]: "L", [cerveja]: "un" };
conferir("fechar sem confirmação explícita → recusado", /Confirme/.test((await fecharContagem(db, { contagem_id: C, itens: its1, unidadesPorInsumo: un, custos: {}, confirmado: false })).error || ""), true);
const semCusto = await fecharContagem(db, { contagem_id: C, itens: its1, unidadesPorInsumo: un, custos: { [its1[0].id]: { porUnidade: 46.67, origem: "x" } }, confirmado: true });
conferir("fechar com produto contado sem custo → recusado, continua EM CONTAGEM",
  [/sem custo/.test(semCusto.error || ""), (await pg.query(`select status from public.estoque_contagens where id = $1`, [C])).rows[0].status], [true, "aberta"]);
conferir("banco também recusa fechar com item sem custo (trigger da F2.1)",
  /sem custo/.test((await db.from("estoque_contagens").update({ status: "fechada" }).eq("id", C)).error?.message || ""), true);
const custos = {
  [its1[0].id]: { porUnidade: "46,67", origem: "cadastro do insumo" },
  [its1[1].id]: { porUnidade: 9, origem: "custo unitário do cadastro" },
  [its1[2].id]: { porUnidade: 5, origem: "informado no fechamento" },
};
const fx = await fecharContagem(db, { contagem_id: C, itens: its1, unidadesPorInsumo: un, custos, confirmado: true });
const fechados = await itens(C);
conferir("FECHAR: status fechado; custo congelado por unidade base; valor = quantidade × custo",
  [fx.error, fx.data?.status, fechados.map((i) => [i.c, i.v])], [null, "fechada", [[0.04667, 389.69], [0.009, 126], [5, 160], [0, 0]]]);
conferir("item zerado fecha sem custo informado (valor 0, origem registrada)", fechados[3].observacao, "custo: quantidade zero: custo não se aplica");
conferir("o que foi digitado (embalagens + fração) continua na linha depois de fechar", fechados[1].observacao, "15 garrafa(s) de 0,9 L + 500 ml = 14 L · custo: custo unitário do cadastro");
const fechadaCab = (await pg.query(`select fechada_em is not null f, fechada_por from public.estoque_contagens where id = $1`, [C])).rows[0];
conferir("fechamento registra quando e quem", [fechadaCab.f, fechadaCab.fechada_por], [true, "33333333-3333-3333-3333-333333333333"]);
conferir("valor do inventário fechado = 389,69 + 126 + 160 = 675,69", valorContagem(fechados.map((i) => ({ custo_unitario: i.c, valor_total: i.v }))), { valor: 675.69, semCusto: 0 });

// imutável depois de fechado
conferir("fechado: corrigir quantidade → recusado", !!(await salvarItemContagem(db, { contagem_id: C, unidade_id: U, insumo_id: picanha, estoque_id: estCozinha, quantidade: "1", unidade_medida: "kg", item_id: its1[0].id })).error, true);
conferir("fechado: contar produto novo → recusado", !!(await salvarItemContagem(db, { contagem_id: C, unidade_id: U, insumo_id: oleo, estoque_id: estBar, quantidade: "1", unidade_medida: "L" })).error, true);
conferir("fechado: mudar custo direto no banco → recusado (custo congelado)",
  /não aceita alteração/.test((await db.from("estoque_contagens_itens").update({ custo_unitario: 1 }).eq("id", its1[0].id)).error?.message || ""), true);
conferir("fechado: reabrir → recusado", !!(await db.from("estoque_contagens").update({ status: "aberta" }).eq("id", C)).error, true);
conferir("fechado: nova pendência → recusada", /não está mais em contagem/.test((await adicionarPendencia(db, { contagem_id: C, nome: "Tardio", unidade: "un", quantidade: "1" })).error || ""), true);
conferir("fechado: apagar item → sem permissão", !!(await pg.query(`select 1`).then(async () => {
  await pg.exec("set role authenticated"); try { await pg.query(`delete from public.estoque_contagens_itens where contagem_id = $1`, [C]); return null; } catch (e) { return e.message; } finally { await pg.exec("reset role"); }
})), true);
conferir("segundo estoque inicial FECHADO na mesma data → recusado (corrigir é por ajuste)",
  /FECHADO/.test((await criarContagem(db, { unidade_id: U, tipo: "inicial", data_referencia: HOJE })).error || ""), true);

// isolamento por unidade
conferir("outra unidade não vê o inventário", (await outra.from("estoque_contagens").select("id").eq("id", C)).data.length, 0);
conferir("outra unidade não grava item no inventário alheio",
  !!(await salvarItemContagem(outra, { contagem_id: C, unidade_id: U, insumo_id: picanha, estoque_id: estCozinha, quantidade: "1", unidade_medida: "kg" })).error, true);

// semanal + comparação + cancelamento
const c2 = await criarContagem(db, { unidade_id: U, tipo: "intermediaria", data_referencia: HOJE });
await salvarItemContagem(db, { contagem_id: c2.data.id, unidade_id: U, insumo_id: picanha, estoque_id: estCozinha, quantidade: "6,5", unidade_medida: "kg" });
const cmp = compararContagens(fechados.map((i) => ({ insumo_id: i.insumo_id, estoque_id: i.estoque_id, quantidade_contada: i.q, unidade_base: i.unidade_base })),
  (await itens(c2.data.id)).map((i) => ({ insumo_id: i.insumo_id, estoque_id: i.estoque_id, quantidade_contada: i.q, unidade_base: i.unidade_base })));
conferir("comparação inicial × semanal: Picanha 8,350 → 6,500 kg = −1,850 kg (diferença física)",
  cmp.filter((l) => l.insumo_id === picanha).map((l) => [daBase(l.anterior, "kg"), daBase(l.atual, "kg"), daBase(l.diferenca, "kg")]), [[8.35, 6.5, -1.85]]);
conferir("cancelar sem motivo → recusado", !!(await cancelarContagem(db, { contagem_id: c2.data.id, motivo: "" })).error, true);
const cx = await cancelarContagem(db, { contagem_id: c2.data.id, motivo: "aberto por engano" });
const c2cab = (await pg.query(`select status, observacao from public.estoque_contagens where id = $1`, [c2.data.id])).rows[0];
conferir("cancelar → CANCELADO, motivo registrado, itens preservados",
  [cx.error, c2cab.status, lerObs(c2cab.observacao).nota, (await itens(c2.data.id)).length], [null, "cancelada", "Cancelado: aberto por engano", 1]);

console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTodos os testes passaram.");
process.exit(falhas ? 1 : 0);
