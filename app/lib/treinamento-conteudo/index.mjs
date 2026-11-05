// Pacote do treinamento: módulos e trilhas por área e função. Os cargos são os
// de rh_cargos no banco real (04/11/2026). A trilha de "Extra" é escolhida pelo
// líder conforme a área em que a pessoa vai trabalhar.
import { GERAL } from "./geral.mjs";
import { COZINHA } from "./cozinha.mjs";
import { BAR } from "./bar.mjs";
import { SALAO } from "./salao.mjs";
import { LIDERANCA } from "./lideranca.mjs";

const BASE = ["g-casa", "g-comportamento", "g-higiene", "g-seguranca"];
const COZ_BASE = [...BASE, "c-conhecer", "c-preparo", "c-servico", "p-coz-conhecer", "p-coz-montar"];
const COZ_COZINHEIRO = [...COZ_BASE, "c-coccao", "p-coz-preparar"];
const BAR_BASE = [...BASE, "b-conhecer", "b-organizacao", "p-bar-conhecer"];
const BAR_BARTENDER = [...BAR_BASE, "b-tecnica", "b-responsavel", "p-bar-montar", "p-bar-preparar"];
const SAL_BASE = [...BASE, "s-conhecer", "s-apoio", "s-mesas", "s-comportamento", "s-situacoes"];
const SAL_GARCOM = [...SAL_BASE, "s-atendimento", "s-bebidas", "s-cardapio", "b-responsavel", "p-sal-pratos", "p-sal-drinks"];
const LIDER = ["l-lideranca", "l-organizacao"];

const PRATICA_BASE = ["Chegou no horário, com uniforme e higiene no padrão", "Lavou as mãos nos momentos certos sem precisar ser lembrado", "Pediu ajuda e avisou problemas na hora"];

export const TRILHAS = [
  { chave: "coz-aux", area: "cozinha", nivel: 1, ordem: 10, nome: "Auxiliar de cozinha", descricao: "Conhecer a cozinha, os pratos e como montar cada um.", cargos: ["Auxiliar de Cozinha 1", "Auxiliar de Cozinha 2", "Auxiliar de Cozinha 3", "Produção"], modulos: COZ_BASE,
    pratica: [...PRATICA_BASE, "Montou a praça sem ajuda", "Usou balança e seguiu a ficha", "Etiquetou e guardou os preparos no padrão", "Fez abertura e fechamento com o checklist"] },
  { chave: "coz-cozinheiro", area: "cozinha", nivel: 2, ordem: 20, nome: "Cozinheiro", descricao: "Tudo do auxiliar, mais cocção e como fazer cada prato.", cargos: ["Cozinheiro 1", "Cozinheiro 2", "Cozinheiro 3"], modulos: COZ_COZINHEIRO,
    pratica: [...PRATICA_BASE, "Executou os pratos da sua praça seguindo a ficha", "Controlou temperatura e ponto", "Manteve o padrão no pico do serviço", "Conferiu cada prato antes de sair", "Resfriou e guardou as sobras corretamente"] },
  { chave: "coz-lider", area: "cozinha", nivel: 3, ordem: 30, nome: "Chefe de cozinha", descricao: "Liderança, organização e elaboração de fichas técnicas.", cargos: ["Chefe de Cozinha"], modulos: [...COZ_COZINHEIRO, ...LIDER, "l-ficha"],
    pratica: ["Conduziu um serviço completo", "Formou uma pessoa nova com o método da casa", "Organizou a equipe com uma ausência inesperada", "Criou uma ficha técnica completa, com preparo, foto e custo conferido", "Fez a contagem e explicou as perdas da área"] },
  { chave: "bar-aux", area: "bar", nivel: 1, ordem: 40, nome: "Auxiliar de bar", descricao: "Conhecer o bar, os drinks, abastecer e manter a estação.", cargos: ["Auxiliar de Barman"], modulos: BAR_BASE,
    pratica: [...PRATICA_BASE, "Montou a estação sem ajuda", "Manipulou gelo e copos no padrão", "Etiquetou sucos, xaropes e frutas", "Fez abertura e fechamento com o checklist"] },
  { chave: "bar-bartender", area: "bar", nivel: 2, ordem: 50, nome: "Bartender", descricao: "Técnica, drinks da casa e serviço responsável.", cargos: ["Barman / Bartender"], modulos: BAR_BARTENDER,
    pratica: [...PRATICA_BASE, "Fez os drinks da carta medindo e seguindo a ficha", "Manteve o padrão no pico", "Atendeu no balcão com o padrão da casa", "Recusou uma venda indevida com educação em simulação", "Registrou perdas corretamente"] },
  { chave: "bar-lider", area: "bar", nivel: 3, ordem: 60, nome: "Chefe de bar", descricao: "Liderança, organização e elaboração de fichas de drinks.", cargos: ["Chefe de Bar"], modulos: [...BAR_BARTENDER, ...LIDER, "l-ficha"],
    pratica: ["Conduziu um serviço completo", "Formou uma pessoa nova com o método da casa", "Fez inventário e explicou as perdas do bar", "Criou uma ficha de drink completa, com copo, método, foto e custo conferido"] },
  { chave: "sal-cumim", area: "salao", nivel: 1, ordem: 70, nome: "Cumim", descricao: "Conhecer o salão, apoiar o serviço e agir nos imprevistos.", cargos: ["Cumim"], modulos: SAL_BASE,
    pratica: [...PRATICA_BASE, "Montou uma mesa inteira no padrão da casa", "Retirou pratos no momento certo", "Manteve as praças abastecidas", "Soube chamar o garçom ou o líder diante de um problema"] },
  { chave: "sal-garcom", area: "salao", nivel: 2, ordem: 80, nome: "Garçom", descricao: "Atendimento completo, comportamento, venda e situações inesperadas.", cargos: ["Garçom"], modulos: SAL_GARCOM,
    pratica: [...PRATICA_BASE, "Atendeu uma mesa do início ao fim no padrão", "Abriu e serviu um vinho na sequência correta", "Explicou os pratos e drinks sem ler", "Perguntou sobre alergias e lançou o pedido corretamente", "Manteve a postura durante o pico", "Resolveu uma reclamação simulada com o método OUVIR"] },
  { chave: "sal-lider", area: "salao", nivel: 3, ordem: 90, nome: "Chefe de fila e maître", descricao: "Comando do salão, liderança e organização.", cargos: ["Chefe de Fila", "Maître"], modulos: [...SAL_GARCOM, ...LIDER, "l-salao"],
    pratica: ["Distribuiu o salão com base nas reservas", "Conduziu um serviço completo", "Recuperou um cliente insatisfeito", "Formou uma pessoa nova com o método da casa"] },
  { chave: "gerente", area: "gestao", nivel: 4, ordem: 100, nome: "Gerente", descricao: "A casa inteira: pessoas, rotina, números e crises.", cargos: ["Gerente"], modulos: [...BASE, ...LIDER, "l-ficha", "l-salao", "l-gerente", "b-responsavel", "s-situacoes"],
    pratica: ["Abriu e fechou a casa sem ajuda", "Conferiu o caixa e lançou o faturamento", "Conduziu um serviço completo", "Conduziu uma simulação de emergência com a equipe"] },
];

export const MODULOS = [...GERAL, ...COZINHA, ...BAR, ...SALAO, ...LIDERANCA];

/** Pacote aceito por trein_importar_pacote: cada questão ganha uma chave estável. */
export function pacoteDoTreinamento() {
  return {
    modulos: MODULOS.map((m) => ({
      ...m,
      aulas: (m.aulas || []).map((a) => ({
        ...a,
        questoes: a.questoes.map((q, i) => ({ ...q, chave: `${a.chave}-q${i + 1}`, ordem: i + 1 })),
      })),
    })),
    trilhas: TRILHAS,
  };
}
