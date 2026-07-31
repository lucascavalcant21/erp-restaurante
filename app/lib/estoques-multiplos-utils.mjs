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
  cozinha: [
    "Todos",
    "Prato principal 1 pessoa",
    "Prato principal 2 pessoas",
    "Entradas",
    "Sobremesas",
    "Acompanhamentos",
    "Pré-preparos"
  ],
  bar: [
    "Todos",
    "Cervejas",
    "Drinks",
    "Vinhos",
    "Doses",
    "Chopp",
    "Águas",
    "Refrigerantes",
    "Bombons",
    "Pré-preparos"
  ],
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
  const cat = item?.categoria;
  if (cat && cat !== "Sem categoria") return cat;

  const area = slugEstoque(estoque?.slug || estoque?.nome);
  const texto = textoNormalizado(`${item?.categoria || ""} ${item?.nome || ""}`);

  if (area === "bar") {
    if (/cerveja|chopp|amstel|heineken|skol|brahma|corona|budweiser|stella|eisenbahn|sol|spaten/.test(texto)) return "Cervejas";
    if (/drink|coquetel|caipirinha|mojito|margarita|gin tonica|aperol/.test(texto)) return "Drinks";
    if (/vinho|espumante|prosecco|cabernet|malbec|merlot/.test(texto)) return "Vinhos";
    if (/dose|whisky|vodka|cachaca|rum|tequila|gin|licor/.test(texto)) return "Doses";
    if (/chopp|chope|barril/.test(texto)) return "Chopp";
    if (/agua|tonica/.test(texto)) return "Águas";
    if (/refrigerante|coca|guarana|fanta|sprite|schweppes/.test(texto)) return "Refrigerantes";
    if (/bombom|trufa|chocolate/.test(texto)) return "Bombons";
    if (/xarope|mix|espuma|geleia|infusao/.test(texto)) return "Pré-preparos";
    return "Cervejas";
  }

  if (area === "cozinha") {
    if (/entrada/.test(texto)) return "Entradas";
    if (/sobremesa|doce/.test(texto)) return "Sobremesas";
    if (/acompanhamento|guarnicao/.test(texto)) return "Acompanhamentos";
    if (/molho|massa|base|caldo|preparo/.test(texto)) return "Pré-preparos";
    return "Prato principal 1 pessoa";
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
  if (!item) return 0;
  const qtd = Number(item?.quantidade_atual) || 0;
  if (qtd <= 0) return 0;

  const custoUnit = Number(item?.custo_unitario || item?.preco_normalizado || item?.insumo?.preco_normalizado) || 0;
  const custoCompra = Number(item?.custo_compra || item?.preco_compra || item?.insumo?.custo_compra) || 0;
  const tamEmb = Number(item?.tamanho_embalagem) || 1;

  // 1. Custo por unidade comercial/embalagem (ex: R$ 13,00 por garrafa Amstel, R$ 14,00 Corona, R$ 40,00 Aperol)
  let custoEfetivo = custoUnit > 0 ? custoUnit : custoCompra;
  if (custoEfetivo > 0 && custoEfetivo < 0.5 && tamEmb > 1) {
    custoEfetivo = custoEfetivo * tamEmb;
  }

  if (custoEfetivo <= 0) return 0;

  // 2. Número de unidades comerciais/garrafas
  // Se a quantidade no banco for em ml/g totais (ex: 10800 ml com garrafas de 600ml), dividimos por 600 (10800 / 600 = 18 garrafas).
  // Se a quantidade no banco já for em unidades/garrafas (ex: 18 garrafas, 24 un, 6 un, 1 fardo), usaremos 18 diretamente.
  let numUnidades = qtd;
  if (tamEmb > 1 && qtd >= tamEmb * 1.5) {
    numUnidades = qtd / tamEmb;
  }

  return Math.round(numUnidades * custoEfetivo * 100) / 100;
}
