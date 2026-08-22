// Quanto cabe em uma embalagem: "1 L", "750 ml", "5 kg".
//
// O cadastro guarda tamanho_embalagem (número) + unidade_medida. O par serve
// para duas coisas diferentes, e é aí que estava o erro:
//
//   Absolut       → 1 e "L"        → volume de uma garrafa
//   Água com gás  → 12 e "garrafa" → quantidade de garrafas no fardo
//
// O segundo caso não é volume nenhum. Mostrá-lo como volume dizia "12
// garrafas" no lugar onde a pessoa procura "600 ml" — pior que não mostrar
// nada, porque parece informação.
//
// Módulo puro, com teste: a regra tem exceção e exceção sem teste volta.

// Unidades que CONTAM coisas em vez de medir. Se a unidade de medida é uma
// destas, o número ao lado é quantidade de itens, não volume.
const UNIDADES_DE_CONTAGEM = new Set([
  "un", "und", "unid", "unidade", "unidades",
  "garrafa", "garrafas", "lata", "latas", "caixa", "caixas", "cx",
  "pct", "pacote", "pacotes", "fardo", "fardos", "dz", "duzia", "duzias",
  "saco", "sacos", "pote", "potes", "bandeja", "bandejas", "peca", "pecas",
]);

const semAcento = (v) => String(v ?? "")
  .normalize("NFD").replace(/[̀-ͯ]/g, "")
  .toLocaleLowerCase("pt-BR").trim();

export const ehUnidadeDeContagem = (unidade) =>
  UNIDADES_DE_CONTAGEM.has(semAcento(unidade).replace(/\.$/, ""));

const formatar = (n) => Number(n).toLocaleString("pt-BR", { maximumFractionDigits: 3 });

// Item a granel: pré-preparo da ficha técnica, item pesado na balança. Não vem
// em embalagem, então não tem volume de embalagem a mostrar.
//
// Dois sinais, nesta ordem:
//
// 1) A CATEGORIA. Quando a ficha técnica migra para o estoque, o item nasce
//    categorizado como "Pre-preparos" ou "Xaropes e pre-preparos" — é o código
//    da migração que escreve isso. Sinal explícito, escrito por quem sabe.
//
// 2) As duas unidades IGUAIS. Item pesado na balança tem kg nos dois campos.
//    Item comprado em embalagem tem os dois diferentes: a Absolut mede em "L"
//    e se compra em "garrafa".
//
// Ausência de unidade comercial NÃO conta como granel: o cadastro pode
// simplesmente não ter preenchido, e uma garrafa de 1 L sumiria por omissão.
//
// Sem essa distinção, todo molho da cozinha exibiria "1 l de 1 l" — não diz
// nada e ainda sugere que o molho vem em potes de um litro.
export function ehGranel(item) {
  if (!item) return false;

  const categoria = semAcento(item.categoria ?? item.insumo?.categoria);
  if (categoria.includes("pre-preparo") || categoria.includes("pre preparo")) return true;

  const tamanho = Number(item.tamanho_embalagem ?? item.insumo?.tamanho_embalagem);
  if (tamanho !== 1) return false;
  const medida = semAcento(item.unidade_medida ?? item.insumo?.unidade_medida);
  const comercial = semAcento(item.unidade_comercial ?? item.insumo?.unidade_comercial);
  return !!medida && !!comercial && comercial === medida;
}

// Devolve "1 L", "750 ml", "5 kg" — ou "" quando não há volume a mostrar.
export function volumeDaEmbalagem(item) {
  if (!item) return "";
  const tamanho = Number(item.tamanho_embalagem ?? item.insumo?.tamanho_embalagem);
  const unidade = item.unidade_medida ?? item.insumo?.unidade_medida;
  if (!Number.isFinite(tamanho) || tamanho <= 0) return "";
  if (!unidade) return "";
  // "12 garrafas" é contagem do fardo, não o volume de cada garrafa.
  if (ehUnidadeDeContagem(unidade)) return "";
  // Pré-preparo e granel não têm embalagem.
  if (ehGranel(item)) return "";
  return `${formatar(tamanho)} ${unidade}`;
}
