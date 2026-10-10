// CENTRAL DE COMANDO: regras puras (TESTADO LOCAL), com o registry real.
import test from "node:test";
import assert from "node:assert/strict";
import { interpretarConsulta, sugestoes, buscar, explorar, categoriaDo, nomeDo } from "./central-comando.mjs";
import { getAccessibleNavigation } from "./navigation-registry.mjs";

const DONO = { papel: "admin", gerenciado: false, permissions: "*" };
const todos = getAccessibleNavigation(DONO);
const idDe = (frag) => todos.find((i) => i.route === frag)?.id;

test("comandos: 'abrir X', 'ir para o X', 'ver X' viram busca pelo X; sem verbo é busca normal", () => {
  assert.deepEqual(interpretarConsulta("Abrir Etiquetas"), { termo: "etiquetas", comando: true });
  assert.deepEqual(interpretarConsulta("ir para o estoque"), { termo: "estoque", comando: true });
  assert.deepEqual(interpretarConsulta("ver contas a pagar"), { termo: "contas a pagar", comando: true });
  assert.deepEqual(interpretarConsulta("acessar CMV"), { termo: "cmv", comando: true });
  assert.deepEqual(interpretarConsulta("ponto"), { termo: "ponto", comando: false });
  assert.deepEqual(buscar("abrir", DONO).itens, [], "verbo sozinho não busca");
});

test("busca: os comandos pedidos pelo dono abrem o módulo certo em primeiro lugar", () => {
  const primeiro = (q) => buscar(q, DONO).itens[0]?.route || "";
  assert.match(primeiro("abrir etiquetas"), /etiquetas/);
  assert.match(primeiro("abrir estoque"), /estoque/);
  assert.match(primeiro("abrir ponto"), /ponto/);
  assert.match(primeiro("abrir contas a pagar"), /financeiro\/contas/);
  assert.match(primeiro("abrir cmv"), /cmv/);
});

test("busca: o uso do próprio usuário desempata, sem passar por cima de um nome exato", () => {
  const semUso = buscar("estoque", DONO).itens.map((i) => i.id);
  const alvo = semUso[semUso.length - 1];
  const comUso = buscar("estoque", DONO, { uso: { [alvo]: 50 } }).itens.map((i) => i.id);
  assert.ok(comUso.indexOf(alvo) < semUso.indexOf(alvo), "o mais usado sobe");
  assert.equal(buscar("estoque", DONO, { uso: { [alvo]: 50 } }).itens.length <= 12, true);
});

test("sugestões: mais usados primeiro; sem histórico, prioridades do perfil; nunca repete os recentes", () => {
  const a = todos[5].id, b = todos[9].id, c = todos[12].id;
  const r = sugestoes({ acessiveis: todos, uso: { [a]: 2, [b]: 9, [c]: 5 }, limite: 6 });
  assert.equal(r.origem, "uso");
  assert.deepEqual(r.itens.slice(0, 3).map((i) => i.id), [b, c, a]);
  const vazio = sugestoes({ acessiveis: todos, limite: 6 });
  assert.equal(vazio.origem, "perfil");
  assert.ok(vazio.itens.length >= 4 && vazio.itens.length <= 6);
  assert.ok(vazio.itens.every((i) => i.mobilePriority <= 2));
  const semRecentes = sugestoes({ acessiveis: todos, uso: { [a]: 2, [b]: 9, [c]: 5 }, excluir: [b] });
  assert.ok(!semRecentes.itens.some((i) => i.id === b));
});

test("explorar: agrupado por área, todas as áreas e todos os módulos acessíveis", () => {
  const g = explorar(todos);
  assert.equal(g.reduce((s, x) => s + x.itens.length, 0), todos.length);
  assert.deepEqual(g.map((x) => x.area), [...g.map((x) => x.area)].sort((x, y) => x.localeCompare(y, "pt-BR")));
});

test("categoria e nome: seção específica (não 'Operação' em tudo) e nome curto", () => {
  const etiq = todos.find((i) => /etiquetas/.test(i.route));
  assert.notEqual(categoriaDo(etiq), "Operação");
  assert.ok(nomeDo(etiq).length <= etiq.title.length);
  assert.ok(idDe("/dashboard"), "registry real carregado");
});
