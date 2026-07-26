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
  
  const slug = (estoque?.slug || estoque?.nome || "").toLowerCase();
  const tipo = (estoque?.tipo || "").toLowerCase();

  return (itens || []).filter(item => {
    // Filtro estrito de pertencimento à área de estoque selecionada
    if (estoque) {
      const dept = (item.departamento || "").toLowerCase();
      const cat = (item.categoria || "").toLowerCase();
      const nome = (item.nome || "").toLowerCase();

      if (slug.includes("limpeza") || tipo === "limpeza") {
        const ehLimpeza = dept.includes("limpeza") || cat.includes("limpeza") || cat.includes("higiene") || /(detergente|sabao|saboaria|desinfetante|cloro|alcool|papel toalha|bucha|esponja|vassoura|rodo|saco de lixo|palha de aco|alvejante|multiuso|pano)/.test(nome);
        if (!ehLimpeza) return false;
      } else if (slug.includes("embalag") || tipo === "embalagens") {
        const ehEmbalagem = dept.includes("embalag") || dept.includes("descartav") || cat.includes("embalag") || cat.includes("descartav") || /(embalagem|caixa|sacola|copo|pote|marmita|isopor|papel acoplado|guardanapo|canudo|tampa|pelicula|filme pvc|aluminio|bobina)/.test(nome);
        if (!ehEmbalagem) return false;
      } else if (slug.includes("bar") || tipo === "bebidas") {
        const ehBar = dept.includes("bar") || dept.includes("bebida") || dept.includes("drink") || cat.includes("bebida") || cat.includes("drink") || cat.includes("cerveja") || cat.includes("destilado") || cat.includes("vinho") || cat.includes("refrigerante") || cat.includes("suco") || cat.includes("xarope") || /(cerveja|chopp|vinho|vodka|gin|whisky|cachaca|rum|xarope|licor|tonica|energetico|refrigerante|suco|agua|ice|tequila|poupa|hortela|morango)/.test(nome);
        if (!ehBar) return false;
      } else if (slug.includes("cozinha") || tipo === "alimentos") {
        const ehOutraArea = dept.includes("limpeza") || dept.includes("embalag") || dept.includes("bar") || cat.includes("limpeza") || cat.includes("embalag") || cat.includes("bebida") || /(detergente|sabao|desinfetante|cloro|alcool|papel toalha|bucha|vassoura|rodo|saco de lixo|embalagem|caixa|sacola|copo|pote|marmita|isopor|cerveja|chopp|vodka|gin|whisky|cachaca|rum|xarope|refrigerante|suco|agua)/.test(nome);
        if (ehOutraArea) return false;
      }
    }

    const texto = [item.nome, item.marca, item.codigo_interno, item.categoria, item.local_interno, item.fornecedor]
      .join(" ").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const status = statusItemEstoque(item, estoque);
    if (termo && !texto.includes(termo)) return false;
    if (filtros?.categoria && filtros.categoria !== "Todas" && item.categoria !== filtros.categoria) return false;
    if (filtros?.local && filtros.local !== "Todos" && item.local_interno !== filtros.local) return false;
    if (filtros?.status === "abaixo" && !status.abaixoMinimo) return false;
    if (filtros?.status === "validade" && !status.validadeProxima) return false;
    if (filtros?.status === "sem-saldo" && !status.semSaldo) return false;
    return true;
  });
}
