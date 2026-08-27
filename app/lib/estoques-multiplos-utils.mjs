export const TIPOS_ESTOQUE = [
  { value: "alimentos", label: "Alimentos", controlaValidade: true },
  { value: "bebidas", label: "Bebidas", controlaValidade: true },
  { value: "limpeza", label: "Limpeza", controlaValidade: false },
  { value: "materiais", label: "Materiais", controlaValidade: false },
  { value: "embalagens", label: "Embalagens", controlaValidade: false },
];

// Onde a bebida fica dentro do bar. Vale para os produtos e para os
// pré-preparos: o mesmo xarope pode estar no depósito e no balcão.
export const LOCAIS_BAR = ["Depósito", "Expositor 1", "Expositor 2", "Balcão refrigerado"];

// Nomes que estes locais já tiveram. Serve para trocar a lista antiga pela
// atual sem apagar o que o usuário criou por conta própria.
export const LOCAIS_BAR_ANTIGOS = ["Expositor de bebidas", "Balcão refrigerado", "Depósito de bebidas"];

export const ESTOQUES_PADRAO = [
  { nome: "Cozinha", slug: "cozinha", tipo: "alimentos", cor: "#059669", controla_validade: true, controla_minimo: true },
  { nome: "Pré-preparos da Cozinha", slug: "pre-preparos-cozinha", tipo: "alimentos", cor: "#d97706", controla_validade: true, controla_minimo: true },
  // O bar guarda a mesma bebida em lugares diferentes; o local separa a
  // contagem sem precisar de um estoque para cada geladeira.
  { nome: "Bar", slug: "bar", tipo: "bebidas", cor: "#7c3aed", controla_validade: true, controla_minimo: true,
    locais: LOCAIS_BAR },
  { nome: "Pré-preparos do Bar", slug: "pre-preparos-bar", tipo: "bebidas", cor: "#ea580c", controla_validade: true, controla_minimo: true,
    locais: LOCAIS_BAR },
  // O salão também pré-prepara (mise en place de bebidas, guarnições de balcão,
  // sobremesas montadas). Sem estoque próprio isso caía no da cozinha, e a
  // contagem de dois setores virava um número só.
  { nome: "Pré-preparos do Salão", slug: "pre-preparos-salao", tipo: "alimentos", cor: "#0d9488", controla_validade: true, controla_minimo: true },
  { nome: "Limpeza", slug: "limpeza", tipo: "limpeza", cor: "#0284c7", controla_validade: false, controla_minimo: true },
  { nome: "Materiais variados", slug: "materiais-variados", tipo: "materiais", cor: "#d97706", controla_validade: false, controla_minimo: true },
  { nome: "Embalagens da Cozinha", slug: "embalagens-cozinha", tipo: "embalagens", cor: "#db2777", controla_validade: false, controla_minimo: true },
  { nome: "Embalagens do Bar", slug: "embalagens-bar", tipo: "embalagens", cor: "#9333ea", controla_validade: false, controla_minimo: true },
  // Depósito: estoque geral da casa — aceita ingredientes E materiais juntos,
  // sem o filtro por setor dos demais. Mesma auditoria dos outros estoques.
  { nome: "Depósito", slug: "deposito", tipo: "materiais", cor: "#047857", controla_validade: true, controla_minimo: true },
];

// Validade por entrada (lote) só existe no pré-preparo. Lá cada fornada tem a
// sua data e sai na ordem de vencimento. No estoque normal da cozinha e do bar
// a pessoa repõe o mesmo produto várias vezes por turno; pedir a data em cada
// reposição só atrasava o lançamento e vinha em branco de qualquer jeito.
// O nome entra na conta junto do slug porque estoque criado à mão não segue o
// slug padrão.
export function ehEstoquePrePreparo(estoque) {
  if (!estoque) return false;
  const alvo = `${estoque.slug || ""} ${estoque.nome || ""}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  return alvo.includes("pre-preparo") || alvo.includes("pre preparo");
}

export function estoqueControlaLote(estoque) {
  return !!estoque?.controla_validade && ehEstoquePrePreparo(estoque);
}

export const GRUPOS_OPERACIONAIS_ESTOQUE = {
  cozinha: [
    "Todos",
    "Carne vermelha",
    "Peixe",
    "Aves",
    "Frutos do mar",
    "Caranguejo",
    "Laticínios",
    "Hortifrúti",
    "Secos",
    "Líquidos",
    "Pré-preparos"
  ],
  bar: [
    "Todos",
    "Cervejas",
    "Destilados",
    "Vinhos",
    "Chopp",
    "Água",
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
  let cat = String(item?.categoria || "").trim();
  const ehGenerico = !cat || /^(bebidas?|insumos?|ingredientes?|sem categoria|outros?)$/i.test(cat);
  if (cat && !ehGenerico) return cat;

  const area = slugEstoque(estoque?.slug || estoque?.nome);
  const texto = textoNormalizado(`${item?.categoria || ""} ${item?.nome || ""} ${item?.marca || ""}`);

  if (area === "bar") {
    if (/cerveja|chopp|chope|amstel|heineken|skol|brahma|corona|budweiser|stella|eisenbahn|sol|spaten|long neck|pilsen|ipa|lager/.test(texto)) return "Cervejas";
    if (/destilado|vodka|absolut|smirnoff|grey goose|whisky|whiskey|red label|black label|jack daniels|ballantines|chivas|passport|white horse|gin|tanqueray|beefeater|gordons|bombay|cachaca|cachaça|jambu|amburana|pirassununga|51|velho barreiro|seleta|salinas|ypioca|rum|bacardi|montilla|tequila|jose cuervo|licor|jagermeister|baileys|cointreau|amaretto|drambuie|campari|aperol|martini|vermute|conhaque|domecq|dreher|presidente|dose|drink|coquetel|caipirinha|mojito|margarita/.test(texto)) return "Destilados";
    if (/vinho|espumante|champagne|prosecco|cabernet|malbec|merlot|chardonnay|sauvignon|carmenere|tinto|branco|rose|rosé|chocovino|contry wine|campo largo|cordeiro con piel|pergola|santa helena|concha y toro/.test(texto)) return "Vinhos";
    if (/chopp|chope|barril/.test(texto)) return "Chopp";
    if (/agua|água|tonica|tônica|schweppes|perrier|san pellegrino/.test(texto)) return "Água";
    if (/refrigerante|coca|cocacola|guarana|guaraná|fanta|sprite|pepsi|soda|h2oh|sukita/.test(texto)) return "Refrigerantes";
    if (/bombom|trufa|chocolate|ferrero|raffaello|lacta|nestle|garoto/.test(texto)) return "Bombons";
    if (/xarope|mix|espuma|geleia|infusao|monin|1883|fabbri/.test(texto)) return "Pré-preparos";
    return "Destilados";
  }

  if (area === "cozinha") {
    if (/carne|bovina|picanha|alcatra|contrafile|costela|cupim|maminha|porco|suino|linguica|bacon|patinho|hamburguer/.test(texto)) return "Carne vermelha";
    if (/peixe|salmao|tilapia|bacalhau|tucunare|tambaqui|pirarucu|pescada|robalo|atum|filhote|dourada/.test(texto)) return "Peixe";
    if (/frango|galinha|peru|pato|chester|ave|coxa|sobrecoxa|asa|peito/.test(texto)) return "Aves";
    if (/camarao|lula|polvo|ostra|marisco|mexilhao/.test(texto)) return "Frutos do mar";
    if (/caranguejo|siri|patola/.test(texto)) return "Caranguejo";
    if (/queijo|leite|manteiga|requeijao|creme de leite|iogurte|mucarela|cheddar|catupiry|coalho|nata|ricota|parmesao/.test(texto)) return "Laticínios";
    if (/tomate|cebola|alho|batata|cenoura|pimentao|alface|couve|cheiro verde|coentro|salsa|banana|limao|manga|abacaxi|maracuja|repolho|verdura|legume|fruta/.test(texto)) return "Hortifrúti";
    if (/arroz|feijao|farinha|acucar|sal|macarrao|massa|tapioca|fuba|amido|fermento|biscoito|pao|graos|aveia|cafe|cha|pimenta|colorau|cominho|curry|acafrao|louro|oregano|canela|cravo|tempero/.test(texto)) return "Secos";
    if (/oleo|azeite|vinagre|molho|shoyu|agua|caldo|leite de coco|leite condensado/.test(texto)) return "Líquidos";
    if (/base|mix|preparo/.test(texto)) return "Pré-preparos";
    return "Carne vermelha";
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
  const tamEmb = Number(item?.tamanho_embalagem) || 1;
  const unMed = String(item?.unidade_medida || "").toLowerCase();
  let saldoUnidades = Number(item?.quantidade_atual) || 0;
  if (tamEmb > 1 && (unMed === "ml" || unMed === "l" || unMed === "g" || unMed === "kg")) {
    saldoUnidades = (Number(item?.quantidade_atual) || 0) / tamEmb;
  }

  const minimo = Number(item?.estoque_minimo);
  const abaixoMinimo = estoque?.controla_minimo !== false
    && Number.isFinite(minimo)
    && minimo > 0
    && saldoUnidades < minimo;

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
    semSaldo: (Number(item?.quantidade_atual) || 0) <= 0,
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
    if (filtros?.tempBar === "apenas_gelado") {
      const cat = String(item?.categoria || "").toLowerCase();
      const nm = String(item?.nome || "").toLowerCase();
      const ehGelado = (Number(item?.qtd_frio) > 0) ||
        /cerveja|chopp|chope|refrigerante|coca|fanta|sprite|guarana|schweppes|agua|tonica|energetico|suco|ice|red bull|heineken|amstel|skol|brahma|corona|budweiser|stella|eisenbahn|spaten/.test(cat + " " + nm) ||
        ["cervejas", "chopp", "águas", "refrigerantes", "sucos"].includes(cat);
      if (!ehGelado) return false;
    }
    if (filtros?.tempBar === "apenas_quente") {
      const cat = String(item?.categoria || "").toLowerCase();
      const nm = String(item?.nome || "").toLowerCase();
      const ehQuente = (Number(item?.qtd_quente) > 0) ||
        /vinho|dose|destilado|whisky|vodka|cachaca|rum|tequila|gin|licor|xarope|vermute|bitter|espumante|conhaque/.test(cat + " " + nm) ||
        ["vinhos", "doses", "drinks", "pré-preparos"].includes(cat);
      if (!ehQuente) return false;
    }
    if (filtros?.estadoCozinha === "resfriados" && item?.estado_conservacao !== "resfriado") return false;
    if (filtros?.estadoCozinha === "congelados" && item?.estado_conservacao !== "congelado") return false;
    if (filtros?.estadoCozinha === "insumos" && (item?.estado_conservacao === "resfriado" || item?.estado_conservacao === "congelado")) return false;
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
  // Se a quantidade no banco já for em unidades/garrafas (ex: 18 garrafas, 24 un, 6 un, 1 lata), usaremos 18 diretamente.
  let numUnidades = qtd;
  if (tamEmb > 1 && qtd >= tamEmb * 1.5) {
    numUnidades = qtd / tamEmb;
  }

  return Math.round(numUnidades * custoEfetivo * 100) / 100;
}
