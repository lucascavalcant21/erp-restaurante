// Testes do cadastro do colaborador (HDEV-RH-001, Fase 1).
// node --test app/lib/colaborador-cadastro.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { formularioDeEdicao, validarCadastro, progressoCadastro, acharDuplicado, cpfValido } from "./colaborador-cadastro.mjs";

const linhaDoBanco = {
  id: "c1", nome: "Larissa Souza", cargo: "Cozinheira", salario: 0, cpf: "529.982.247-25", telefone: "(45) 99999-1234",
  email: null, rg: null, horarios_dia: null, supervisores_ids: null, supervisor_id: "s1", filhos: null,
  pontos_taxa: 2, tipo_contrato: null, janta_ofertada: null, rua: "Rua A", numero: "10", cidade: "Cascavel",
};

test("edição abre com os dados do colaborador; nulos viram vazio, nada é inventado", () => {
  const f = formularioDeEdicao(linhaDoBanco);
  assert.equal(f.nome, "Larissa Souza");
  assert.equal(f.cargo, "Cozinheira");
  assert.equal(f.salario, 0); // zero é valor real, não some
  assert.equal(f.email, "");
  assert.equal(f.rg, "");
  assert.deepEqual(f.horarios_dia, {});
  assert.deepEqual(f.supervisores_ids, ["s1"]);
  assert.deepEqual(f.filhos, []);
  assert.equal(f.pontos_taxa, "2");
  assert.equal(f.tipo_contrato, "Fixo");
  assert.equal(f.janta_ofertada, true);
  assert.equal(f.rua_av, "Rua A"); // colunas antigas aproveitadas
  assert.equal(f.cidade_uf, "Cascavel");
});

test("edição de linha vazia não quebra", () => {
  const f = formularioDeEdicao({});
  assert.equal(f.nome, "");
  assert.equal(f.dias_trabalho, "1,2,3,4,5,6");
});

test("CPF: dígitos verificadores", () => {
  assert.equal(cpfValido("529.982.247-25"), true);
  assert.equal(cpfValido("529.982.247-24"), false);
  assert.equal(cpfValido("111.111.111-11"), false);
  assert.equal(cpfValido("123"), false);
});

test("validação: nome e função obrigatórios; o resto recomendado", () => {
  const v = validarCadastro({});
  assert.equal(v.ok, false);
  assert.ok(v.erros.nome && v.erros.cargo);
  assert.ok(v.avisos.cpf && v.avisos.telefone);
  assert.equal(v.porEtapa.identificacao, 1);
  assert.equal(v.porEtapa.funcao, 1);
  assert.equal(validarCadastro({ nome: "Ana", cargo: "Garçom" }).ok, true);
});

test("validação de formato: CPF, e-mail, telefone, salário e datas", () => {
  const v = validarCadastro({ nome: "Ana", cargo: "Garçom", cpf: "123.456.789-00", email: "ana@", telefone: "9999", salario: "-1",
    data_admissao: "2026-01-10", data_nascimento: "2026-02-01" });
  assert.ok(v.erros.cpf); assert.ok(v.erros.email); assert.ok(v.erros.telefone); assert.ok(v.erros.salario); assert.ok(v.erros.data_nascimento);
  assert.equal(v.ok, false);
});

test("horário por dia conta como jornada preenchida", () => {
  const v = validarCadastro({ nome: "Ana", cargo: "Garçom", horario_por_dia: true, horarios_dia: { 1: { e: "08:00", s: "16:00" } } });
  assert.equal(v.avisos.horario_entrada, undefined);
});

test("progresso real: só conta campo preenchido e válido", () => {
  assert.equal(progressoCadastro({}).pct, 0);
  const meio = progressoCadastro({ nome: "Ana", cargo: "Garçom", cpf: "123" });
  assert.equal(meio.feitos, 2); // CPF inválido não conta
  const cheio = progressoCadastro({ nome: "Ana", cargo: "Garçom", cpf: "52998224725", telefone: "45999991234", data_admissao: "2026-01-10",
    horario_entrada: "08:00", horario_saida: "16:00", chave_pix: "ana@x.com" });
  assert.equal(cheio.pct, 100);
});

test("duplicado: mesmo CPF (mesmo desligado) bloqueia; o próprio colaborador em edição não", () => {
  const lista = [{ id: "c1", nome: "Larissa Souza", cpf: "52998224725", telefone: "45999991234", status: "inativo" }];
  assert.equal(acharDuplicado({ nome: "Outra", cpf: "529.982.247-25" }, lista).motivo, "cpf");
  assert.equal(acharDuplicado({ nome: "Larissa Souza", cpf: "529.982.247-25" }, lista, "c1"), null);
  assert.equal(acharDuplicado({ nome: "  larissa  SOUZA ", telefone: "(45) 99999-1234" }, lista).motivo, "nome_telefone");
  assert.equal(acharDuplicado({ nome: "Larissa Souza" }, lista), null); // só o nome não basta (homônimos)
});

// A tela: os botões Editar e Novo do quadro usam o mesmo fluxo do resto do RH.
// Antes, o Editar do perfil abria "Novo funcionário fixo" e criava duplicado.
const pagina = fs.readFileSync(new URL("../dashboard/rh/page.js", import.meta.url), "utf8");

test("tela: Editar do perfil abre a edição (com editandoId), Novo limpa a edição", () => {
  assert.match(pagina, /<VisaoColaboradores[^>]*onEditar=\{abrirModalEdicao\}/);
  assert.match(pagina, /<VisaoColaboradores[^>]*onNovo=\{abrirModalNovo\}/);
  assert.match(pagina, /const abrirModalEdicao = \(f\) => \{[\s\S]{0,400}setEditandoId\(f\.id\)/);
  assert.match(pagina, /const abrirModalNovo = \(\) => \{\s*setEditandoId\(null\)/);
});

test("tela: título de edição é 'Editar colaborador' e salvar checa validação e duplicado", () => {
  assert.match(pagina, /editandoId \? "Editar colaborador"/);
  assert.doesNotMatch(pagina, /"Editar funcionário"/);
  assert.match(pagina, /validarCadastro\(novoFunc\)/);
  assert.match(pagina, /acharDuplicado\(novoFunc, funcionarios, editandoId\)/);
});

test("tela: Gestão de Equipe (lista sempre vazia, formulário paralelo) leva ao quadro real", () => {
  const gestao = fs.readFileSync(new URL("../dashboard/rh/gestao/page.js", import.meta.url), "utf8");
  assert.match(gestao, /\/dashboard\/rh\?aba=quadro/);
  assert.doesNotMatch(gestao, /inserirFuncionario|atualizarFuncionario/);
});

test("tela: os modais do RH ficam fora do bloco da Visão Geral (abrem na aba Quadro)", () => {
  const p = pagina.replace(/\r\n/g, "\n");
  const inicioVisao = p.indexOf('{abaModulo === "visao" && (');
  const modalNovo = p.indexOf("{modalNovo && (");
  const modalDeslig = p.indexOf("{modalDeslig && funcDeslig && (");
  assert.ok(inicioVisao > 0 && modalNovo > inicioVisao && modalDeslig > inicioVisao);
  // o bloco da Visão Geral fecha antes do primeiro modal
  const trecho = p.slice(inicioVisao, modalNovo);
  assert.match(trecho, /\n {8}<\/>\n {6}\)\}\n/);
  // e não há outro fechamento de fragmento depois dos modais
  assert.doesNotMatch(p.slice(modalNovo), /\n {8}<\/>\n {6}\)\}\n {4}<\/div>\n {2}\);/);
});

test("tela: Desligar do perfil abre o desligamento do RH (não a página antiga com ?acao=desligar)", () => {
  assert.match(pagina, /<VisaoColaboradores[^>]*onDesligar=\{abrirDesligamento\}/);
  const quadro = fs.readFileSync(new URL("../dashboard/rh/VisaoColaboradores.js", import.meta.url), "utf8");
  assert.doesNotMatch(quadro, /\?acao=desligar/);
});
