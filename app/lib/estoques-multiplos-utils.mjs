export const TIPOS_ESTOQUE = [
  { value: "alimentos", label: "Alimentos", controlaValidade: true },
  { value: "bebidas", label: "Bebidas", controlaValidade: true },
  { value: "limpeza", label: "Limpeza", controlaValidade: false },
  { value: "materiais", label: "Materiais", controlaValidade: false },
  { value: "embalagens", label: "Embalagens", controlaValidade: false },
];

export const ESTOQUES_PADRAO = [
  { nome: "Cozinha", slug: "cozinha", tipo: "alimentos", cor: "#059669", controla_validade: true, controla_minimo: true },
  { nome: "Bar", slug: "bar", tipo: "bebidas", cor: "#7c3aed", controla_validade: true, controla_minimo: true },
  { nome: "Limpeza", slug: "limpeza", tipo: "limpeza", cor: "#0284c7", controla_validade: false, controla_minimo: true },
  { nome: "Materiais variados", slug: "materiais-variados", tipo: "materiais", cor: "#d97706", controla_validade: false, controla_minimo: true },
  { nome: "Embalagens", slug: "embalagens", tipo: "embalagens", cor: "#db2777", controla_validade: false, controla_minimo: true },
];

export const GRUPOS_OPERACIONAIS_ESTOQUE = {
  cozinha: ["Todos", "Produtos prontos", "Ingredientes"],
  bar: ["Todos", "Produtos", "Xaropes", "Guarnições", "Frutas"],
};

const textoNormalizado = valor => String(valor || "")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .trim();

export function gruposOperacionaisEstoque(estoque) {
  return GRUPOS_OPERACIONAIS_ESTOQUE[slugEstoque(estoque?.slug || estoque?.nome)] || ["Todos"];
}

export function grupoOperacionalItem(item, estoque) {
  const area = slugEstoque(estoque?.slug || estoque?.nome);
  const categoria = textoNormalizado(item?.categoria);
  const nome = textoNormalizado(item?.nome);
  const tipo = textoNormalizado(item?.tipo_item || item?.tipo);
  const texto = `${categoria} ${nome}`;

  if (area === "cozinha") {
    const produtoPronto = tipo === "produto"
      || /produto pronto|prato pronto|bebida pronta|congelado|industrializado/.test(texto);
    return produtoPronto ? "Produtos prontos" : "Ingredientes";
  }

  if (area === "bar") {
    if (/xarope|cordial|syrup/.test(texto)) return "Xaropes";
    if (/guarnic|decoracao|garnish|erva|especiaria/.test(texto)) return "Guarnições";
    if (/fruta|hortifruti|limao|laranja|abacaxi|morango|maracuja|manga|uva|cereja/.test(texto)) return "Frutas";
    return "Produtos";
  }

  return "Todos";
}

export function slugEstoque(valor) {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function tiposCompativeis(origem, destino) {
  const a = String(origem || "").toLowerCase();
  const b = String(destino || "").toLowerCase();
  if (!a || !b) return false;
  if (a === b) return true;
  return new Set(["alimentos", "bebidas"]).has(a) && new Set(["alimentos", "bebidas"]).has(b);
}

export function statusItemEstoque(item, estoque, agora = new Date()) {
  const saldo = Number(item?.quantidade_atual) || 0;
  const minimo = Number(item?.estoque_minimo);
  const abaixoMinimo = estoque?.controla_minimo !== false
    && Number.isFinite(minimo)
    && minimo > 0
    && saldo < minimo;

  let diasValidade = null;
  if (estoque?.controla_validade && item?.validade) {
    const validade = new Date(`${item.validade}T23:59:59`);
    diasValidade = Math.ceil((validade.getTime() - agora.getTime()) / 86400000);
  }

  return {
    abaixoMinimo,
    diasValidade,
    vencido: diasValidade !== null && diasValidade < 0,
    validadeProxima: diasValidade !== null && diasValidade >= 0 && diasValidade <= 7,
    semSaldo: saldo <= 0,
  };
}

export function filtrarItensEstoque(itens, filtros, estoque) {
  const termo = String(filtros?.busca || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

  return (itens || []).filter(item => {
    if (!item) return false;
    const texto = [item.nome, item.marca, item.codigo_interno, item.categoria, item.local_interno, item.fornecedor, item.departamento]
      .join(" ").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const status = statusItemEstoque(item, estoque);
    if (termo && !texto.includes(termo)) return false;
    if (filtros?.grupo && filtros.grupo !== "Todos" && grupoOperacionalItem(item, estoque) !== filtros.grupo) return false;
    if (filtros?.categoria && filtros.categoria !== "Todas" && item.categoria !== filtros.categoria) return false;
    if (filtros?.local && filtros.local !== "Todos" && item.local_interno !== filtros.local) return false;
    if (filtros?.status === "abaixo" && !status.abaixoMinimo) return false;
    if (filtros?.status === "validade" && !status.validadeProxima) return false;
    if (filtros?.status === "sem-saldo" && !status.semSaldo) return false;
    return true;
  });
}

export function calcularValorItem(item) {
  const qtd = Number(item?.quantidade_atual) || 0;
  if (qtd <= 0) return 0;

  const custoUnit = Number(item?.custo_unitario) || 0;
  const custoCompra = Number(item?.custo_compra) || 0;
  const tamEmb = Number(item?.tamanho_embalagem) || 1;
  const un = String(item?.unidade_medida || "").toLowerCase();

  const ehFrac = tamEmb > 1 && item?.permite_fracionado !== false && un !== "un";

  if (ehFrac) {
    const unComerciais = qtd / tamEmb;
    let custoEmbalagem = custoCompra;
    if (!custoEmbalagem || custoEmbalagem <= 0) {
      custoEmbalagem = custoUnit > 0 ? (custoUnit < 1 ? custoUnit * tamEmb : custoUnit) : 0;
    }
    return unComerciais * custoEmbalagem;
  }

  const custo = custoUnit > 0 ? custoUnit : custoCompra;
  return qtd * custo;
}
