import { test } from "node:test";
import assert from "node:assert/strict";
import { cadastroDoColaborador, cpfValido, diasDoTexto, ehExtra, reciboDeDiarias, textoDosDias } from "./diarias.mjs";

test("dias da semana: texto ⇄ lista, sem repetir, na ordem seg→dom", () => {
  assert.deepEqual(diasDoTexto("1, 2,2,9,x,0"), [1, 2, 0]);
  assert.equal(textoDosDias([0, 3, 1, 3]), "1,3,0");
  assert.equal(textoDosDias([]), "");
});

test("CPF: vazio passa, dígito errado e repetido não", () => {
  assert.equal(cpfValido(""), true);
  assert.equal(cpfValido("529.982.247-25"), true);
  assert.equal(cpfValido("529.982.247-24"), false);
  assert.equal(cpfValido("111.111.111-11"), false);
});

test("cadastro do fixo: dias, horário, endereço e filhos; erros claros", () => {
  const { erros, payload } = cadastroDoColaborador({
    nome: " Maria ", cargo: "Cozinheira", salario: "2.000,50", cpf: "529.982.247-25", telefone: "(45) 99999-0000",
    dias: [6, 1, 2], horario_entrada: "08:00", horario_saida: "16:20", tempo_intervalo: "60",
    rua_av: "Rua A", numero_casa: "10", bairro: "Centro", cidade_uf: "Cascavel/PR", estado_civil: "Casado(a)", tem_filhos: true, qtd_filhos: "2",
  }, { unidadeId: "marmitaria", tipo: "fixo" });
  assert.deepEqual(erros, []);
  assert.equal(payload.nome, "Maria");
  assert.equal(payload.salario, 2000.5);
  assert.equal(cadastroDoColaborador({ nome: "Ana", cargo: "x", salario: 1800.5 }, { tipo: "fixo" }).payload.salario, 1800.5);
  assert.equal(payload.dias_trabalho, "1,2,6");
  assert.equal(payload.tempo_intervalo, 60);
  assert.equal(payload.endereco, "Rua A, 10, Centro, Cascavel/PR");
  assert.equal(payload.qtd_filhos, 2);
  assert.equal(payload.cpf, "52998224725");
  assert.equal(payload.tipo_contrato, "CLT");
  assert.deepEqual(cadastroDoColaborador({ nome: "A" }, { tipo: "fixo" }).erros, ["Informe o nome.", "Informe a função."]);
});

test("cadastro do extra: diária obrigatória, telefone com DDD, sem escala", () => {
  assert.deepEqual(cadastroDoColaborador({ nome: "João", telefone: "9999" }, { tipo: "extra" }).erros, ["Informe o telefone com DDD.", "Telefone incompleto: coloque o DDD.", "Informe o valor da diária."]);
  const { payload } = cadastroDoColaborador({ nome: "João", telefone: "45999990000", salario: "120" }, { unidadeId: "marmitaria", tipo: "extra" });
  assert.equal(payload.tipo_contrato, "Freelancer");
  assert.equal(payload.cargo, "Extra");
  assert.equal(payload.dias_trabalho, "");
  assert.equal(ehExtra(payload), true);
});

test("recibo de diárias: soma os dias, ordena, ignora dia sem valor, formato do RH", () => {
  const extra = { id: "e1", nome: "João", cargo: "Ajudante", tipo_contrato: "Freelancer", chave_pix: "x" };
  const { erro, recibo } = reciboDeDiarias({ extra, dias: [{ data: "2026-11-21", valor: "120" }, { data: "2026-11-20", valor: "100,50" }, { data: "2026-11-22", valor: "" }], forma: "Dinheiro", valeTransporte: "10", unidadeId: "marmitaria", numero: "REC-1", hoje: "2026-11-21" });
  assert.equal(erro, null);
  assert.deepEqual(recibo.datas_contratadas, ["2026-11-20", "2026-11-21"]);
  assert.equal(recibo.dias_contratados, 2);
  assert.equal(recibo.valor_diaria, 110.25);
  assert.equal(recibo.valor_total, 230.5);
  assert.equal(recibo.dados.valor_dinheiro, 230.5);
  assert.equal(recibo.dados.valor_pix, 0);
  assert.equal(recibo.data_trabalho, "2026-11-20");
  assert.equal(reciboDeDiarias({ extra, dias: [] }).erro, "Informe pelo menos um dia com data e valor.");
  assert.equal(reciboDeDiarias({ dias: [{ data: "2026-11-20", valor: 1 }] }).erro, "Escolha o extra.");
});
