import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizarOrganizador, comVitrine, vitrineDe, adicionarCategoria, renomearCategoria, moverCategoria, removerCategoria,
  salvarItem, moverItem, removerItem, mesclarLeitura, puxarMarmitas, pendencias, descontoPct, textoDoItem, resumoDaVitrine, normalizarItem,
} from "./organizador.mjs";

const base = () => {
  let v = adicionarCategoria({}, "Executivos").vitrine;
  v = adicionarCategoria(v, "Bebidas").vitrine;
  return v;
};

test("organizador: só apps conhecidos e vitrines independentes", () => {
  const o = normalizarOrganizador({ plataformas: { ifood: { categorias: [{ nome: "A", itens: [{ nome: "X", preco: "40,00" }] }] }, hack: {} } });
  assert.deepEqual(Object.keys(o.plataformas), ["ifood"]);
  const o2 = comVitrine(o, "keeta", base(), "2026-11-17T00:00:00Z");
  assert.equal(vitrineDe(o2, "ifood").categorias[0].itens[0].preco, 40);
  assert.equal(vitrineDe(o2, "keeta").categorias.length, 2);
  assert.equal(comVitrine(o, "nada", base()).plataformas.nada, undefined);
});

test("categorias: nome único, renomear, mover e apagar", () => {
  const v = base();
  assert.match(adicionarCategoria(v, "executivos").erro, /Já existe/);
  assert.match(adicionarCategoria(v, "  ").erro, /nome/);
  const [a, b] = v.categorias;
  assert.match(renomearCategoria(v, b.id, "Executivos").erro, /Já existe/);
  assert.equal(renomearCategoria(v, b.id, "Refrigerantes").vitrine.categorias[1].nome, "Refrigerantes");
  assert.deepEqual(moverCategoria(v, b.id, -1).categorias.map((c) => c.nome), ["Bebidas", "Executivos"]);
  assert.deepEqual(moverCategoria(v, a.id, -1).categorias.map((c) => c.nome), ["Executivos", "Bebidas"]);
  assert.equal(removerCategoria(v, a.id).categorias.length, 1);
});

test("item: cupom só se menor, troca de categoria, mover e apagar", () => {
  let v = base();
  const [exec, beb] = v.categorias;
  const r = salvarItem(v, exec.id, { id: "s1", nome: "Strogonoff de Carne", preco: "R$ 40,00", preco_cupom: "28,00", destaque: "1º mais curtido" });
  assert.equal(r.erro, null);
  v = r.vitrine;
  const it = v.categorias[0].itens[0];
  assert.equal(it.preco, 40); assert.equal(it.preco_cupom, 28); assert.equal(descontoPct(it), 30);
  assert.equal(normalizarItem({ nome: "x", preco: 10, preco_cupom: 12 }).preco_cupom, null);
  assert.equal(normalizarItem({ nome: "x", foto_url: "javascript:alert(1)" }).foto_url, "");
  v = salvarItem(v, exec.id, { id: "s2", nome: "Brasileirinho", preco: 36 }).vitrine;
  assert.deepEqual(moverItem(v, exec.id, "s2", -1).categorias[0].itens.map((i) => i.id), ["s2", "s1"]);
  v = salvarItem(v, beb.id, { ...it, nome: "Strogonoff" }).vitrine; // mudou de categoria
  assert.deepEqual(v.categorias.map((c) => c.itens.map((i) => i.id)), [["s2"], ["s1"]]);
  assert.equal(removerItem(v, "s1").categorias[1].itens.length, 0);
  assert.match(salvarItem(v, "nada", { nome: "x" }).erro, /categoria/);
  assert.match(salvarItem(v, exec.id, { nome: "" }).erro, /nome/);
});

test("leitura do print: cria categorias, cupom do 'a partir de' e atualiza sem perder a foto", () => {
  let v = base();
  v = salvarItem(v, v.categorias[0].id, { id: "s1", nome: "Brasileirinho de Alcatra", foto_url: "https://x.supabase.co/f.jpg", preco: 30 }).vitrine;
  const r = mesclarLeitura(v, [
    { tipo: "prato", categoria: "Executivos do Chef", nome: "Strogonoff de Carne", descricao: "Tiras de alcatra", preco: 28, preco_original: 40 },
    { tipo: "prato", categoria: "Executivos", nome: "brasileirinho de alcatra", preco: 25.2, preco_original: 36 },
    { tipo: "adicional", grupo: "Turbine", nome: "Ovo frito", preco: 3 },
    { tipo: "prato", nome: "", preco: 10 },
  ]);
  assert.equal(r.novos, 2); assert.equal(r.atualizados, 1); assert.equal(r.ignorados, 1);
  const nomes = r.vitrine.categorias.map((c) => c.nome);
  assert.deepEqual(nomes, ["Executivos", "Bebidas", "Executivos do Chef", "Turbine"]);
  const alcatra = r.vitrine.categorias[0].itens[0];
  assert.equal(alcatra.foto_url, "https://x.supabase.co/f.jpg");
  assert.equal(alcatra.preco, 36); assert.equal(alcatra.preco_cupom, 25.2);
  assert.equal(r.vitrine.categorias[2].itens[0].preco_cupom, 28);
});

test("puxar marmitas: só as que faltam, com o preço do app ou sem preço", () => {
  const v = base();
  const marmitas = [
    { id: "f1", nome_comercial: "Frango Grelhado", categoria: "Executivos", descricao_comercial: "Arroz, feijão", imagem: "https://a/b.jpg", precos: { ifood: 34 } },
    { id: "f2", nome_receita: "Parmegiana", precos: {} },
    { id: "f3", nome_receita: "Inativa", ativo: false },
  ];
  const r = puxarMarmitas(v, marmitas, (m) => m.precos?.ifood ?? null);
  assert.equal(r.novos, 2);
  assert.equal(r.vitrine.categorias[0].itens[0].preco, 34);
  const parm = r.vitrine.categorias.find((c) => c.nome === "Marmitas").itens[0];
  assert.equal(parm.preco, null);
  assert.equal(puxarMarmitas(r.vitrine, marmitas, () => 1).novos, 0);
  const p = pendencias(r.vitrine);
  assert.equal(p.semPreco.length, 1); assert.equal(p.semFoto.length, 1);
  assert.deepEqual(p.categoriasVazias, ["Bebidas"]);
  assert.match(resumoDaVitrine(r.vitrine).texto, /3 categorias, 2 itens; 1 sem foto, 1 sem descrição, 1 sem preço/);
});

test("texto para colar tem um campo por linha e não inventa o que falta", () => {
  const t = textoDoItem({ nome: "Strogonoff", descricao: "Tiras de alcatra", preco: 40, preco_cupom: 28 }, "Executivos");
  assert.equal(t.split("\n").length, 5);
  assert.match(t, /^Categoria: Executivos\nNome: Strogonoff/);
  assert.doesNotMatch(textoDoItem({ nome: "X" }), /Preço/);
});
