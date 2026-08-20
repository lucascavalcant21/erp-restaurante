// Quem aparece em cada área — no ponto e no estoque. Regra errada aqui faz o
// cozinheiro assinar retirada do bar e o chefe de cozinha aparecer em três
// listas, então vale teste com a equipe real da casa.
import { equipeDaArea, ehDeAlgumSetor } from "./equipe-area.mjs";

const equipe = [
  { nome: "Larissa da Silva Uhe", cargo: "Chef de Garçom" },
  { nome: "Alice Teresinha Visintainer Xavier", cargo: "Auxiliar de Cozinha" },
  { nome: "Cedeine Del Valle Tablante Flores", cargo: "Chefe de Cozinha" },
  { nome: "Brenda Larissa Ribeiro Martins", cargo: "Garçom" },
  { nome: "Eduarda de Lima Oliveira", cargo: "Bartender" },
  { nome: "Joseph Andrey Gomes da Silva", cargo: "Cozinheiro III" },
];

let falhas = 0;
const nomes = (lista) => lista.map(c => c.nome.split(" ")[0]).sort().join(", ");
function conferir(titulo, recebido, esperado) {
  const ok = recebido === esperado;
  if (!ok) falhas += 1;
  console.log(`${ok ? "ok  " : "FALHA"} ${titulo}`);
  if (!ok) console.log(`      esperado: ${esperado}\n      recebido: ${recebido}`);
}

conferir("cozinha", nomes(equipeDaArea(equipe, "cozinha")), "Alice, Cedeine, Joseph");
conferir("salao", nomes(equipeDaArea(equipe, "salao")), "Brenda, Larissa");
conferir("bar", nomes(equipeDaArea(equipe, "bar")), "Eduarda");

// O caso que motivou a correção: chefe de cozinha é da cozinha, não é chefia
// genérica. Antes ela casava com /chefe/ e aparecia nas três áreas.
conferir("chefe de cozinha nao vaza p/ o bar",
  String(equipeDaArea(equipe, "bar").some(c => c.cargo === "Chefe de Cozinha")), "false");
conferir("chefe de cozinha nao vaza p/ o salao",
  String(equipeDaArea(equipe, "salao").some(c => c.cargo === "Chefe de Cozinha")), "false");

// Chefia genérica continua cobrindo tudo — é para isso que a regra existe.
const comGerente = [...equipe, { nome: "Lucas Gerente", cargo: "Gerente Geral" }];
conferir("gerente entra na cozinha",
  String(equipeDaArea(comGerente, "cozinha").some(c => c.cargo === "Gerente Geral")), "true");
conferir("gerente entra no bar",
  String(equipeDaArea(comGerente, "bar").some(c => c.cargo === "Gerente Geral")), "true");
conferir("gerente entra no salao",
  String(equipeDaArea(comGerente, "salao").some(c => c.cargo === "Gerente Geral")), "true");

conferir("gerente nao tem setor proprio", String(ehDeAlgumSetor({ cargo: "Gerente Geral" })), "false");
conferir("chefe de cozinha tem setor proprio", String(ehDeAlgumSetor({ cargo: "Chefe de Cozinha" })), "true");

// Extra e inativo nunca entram: ponto e estoque são da equipe contratada.
const comExtras = [...equipe,
  { nome: "Zeca Extra", cargo: "Garçom", tipo_contrato: "Freelancer" },
  { nome: "Ana Desligada", cargo: "Garçom", status: "inativo" },
];
conferir("extra fica de fora", nomes(equipeDaArea(comExtras, "salao")), "Brenda, Larissa");

console.log(falhas ? `\n${falhas} falha(s)` : "\nTodos os casos passaram.");
process.exit(falhas ? 1 : 0);
