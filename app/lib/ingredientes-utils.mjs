const UNIDADES = {
  g: { familia: "massa", paraBase: valor => valor / 1000, rotulo: "g" },
  kg: { familia: "massa", paraBase: valor => valor, rotulo: "kg" },
  ml: { familia: "volume", paraBase: valor => valor / 1000, rotulo: "ml" },
  l: { familia: "volume", paraBase: valor => valor, rotulo: "L" },
  un: { familia: "unidade", paraBase: valor => valor, rotulo: "unidade" },
  garrafa: { familia: "unidade", paraBase: valor => valor, rotulo: "Garrafa" },
  lata: { familia: "unidade", paraBase: valor => valor, rotulo: "Lata" },
  barril: { familia: "unidade", paraBase: valor => valor, rotulo: "Barril (Chopp)" },
  caixa: { familia: "unidade", paraBase: valor => valor, rotulo: "Caixa" },
  pct: { familia: "unidade", paraBase: valor => valor, rotulo: "pct" },
  pacote: { familia: "unidade", paraBase: valor => valor, rotulo: "Pacote" },
  maco: { familia: "unidade", paraBase: valor => valor, rotulo: "maço" },
  fardo: { familia: "unidade", paraBase: valor => valor, rotulo: "Lata" },
};

export const UNIDADES_INGREDIENTE_COZINHA = [
  { value: "kg", label: "kg" },
  { value: "g", label: "g" },
  { value: "l", label: "L" },
  { value: "ml", label: "ml" },
  { value: "pct", label: "pct" },
  { value: "maco", label: "maço" },
  { value: "caixa", label: "caixa" },
];

export const UNIDADES_INGREDIENTE_BAR = [
  { value: "ml", label: "ml" },
  { value: "l", label: "L" },
  { value: "un", label: "unidade (un)" },
  { value: "garrafa", label: "Garrafa" },
  { value: "lata", label: "Lata" },
  { value: "barril", label: "Barril (Chopp)" },
  { value: "g", label: "g" },
  { value: "kg", label: "kg" },
];

export const UNIDADES_INGREDIENTE = [
  ...UNIDADES_INGREDIENTE_COZINHA,
  ...UNIDADES_INGREDIENTE_BAR.filter(
    item => !UNIDADES_INGREDIENTE_COZINHA.some(unidade => unidade.value === item.value),
  ),
];

export function unidadesIngredientePorDepartamento(departamento) {
  return String(departamento || "cozinha").toLowerCase() === "bar"
    ? UNIDADES_INGREDIENTE_BAR
    : UNIDADES_INGREDIENTE_COZINHA;
}

export function ehInsumoPrePreparo(insumo) {
  return normalizarBusca(insumo?.categoria).includes("preparo");
}

export function parseNumeroBR(valor) {
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : NaN;
  const texto = String(valor ?? "").trim().replace(/\s/g, "");
  if (!texto) return NaN;
  const normalizado = texto.includes(",")
    ? texto.replace(/\./g, "").replace(",", ".")
    : texto;
  return Number(normalizado);
}

export function normalizarBusca(valor) {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]/g, "");
}

export function compararNomes(a, b) {
  return normalizarBusca(a).localeCompare(normalizarBusca(b), "pt-BR", {
    sensitivity: "base",
    numeric: true,
  });
}

export function calcularPrecoNormalizado(quantidade, unidade, valorEmbalagem) {
  const qtd = Number(quantidade);
  const valor = Number(valorEmbalagem);
  if (!Number.isFinite(qtd) || qtd <= 0 || !Number.isFinite(valor) || valor < 0) return 0;
  const info = UNIDADES[String(unidade || "").toLowerCase()];
  const quantidadeBase = info ? info.paraBase(qtd) : qtd;
  return quantidadeBase > 0 ? valor / quantidadeBase : 0;
}

export function unidadeNormalizada(unidade) {
  const un = String(unidade || "").toLowerCase();
  const info = UNIDADES[un];
  if (!info) return un;
  if (info.familia === "massa") return "kg";
  if (info.familia === "volume") return "l";
  return un;
}

export function precoNormalizadoDoInsumo(insumo) {
  const salvo = Number(insumo?.preco_normalizado);
  // Registros anteriores à migração receberam 0 como valor padrão. Esse zero
  // não deve esconder o preço que já existe na embalagem.
  if (Number.isFinite(salvo) && salvo > 0) return salvo;
  const tamanho = Number(insumo?.tamanho_embalagem) || 1;
  const valorTotal = Number(insumo?.custo_compra);
  const valor = Number.isFinite(valorTotal) && valorTotal > 0
    ? valorTotal
    : (Number(insumo?.custo_unitario) || 0) * (Number(insumo?.tamanho_embalagem) > 0 ? Number(insumo?.tamanho_embalagem) : 1);
  return calcularPrecoNormalizado(tamanho, insumo?.unidade_medida, valor);
}

export function calcularCustoSolicitado(insumo, quantidadeInformada, unidadeSolicitada) {
  const quantidade = parseNumeroBR(quantidadeInformada);
  if (!Number.isFinite(quantidade)) return { valor: null, erro: "" };
  if (quantidade < 0) return { valor: null, erro: "A quantidade não pode ser negativa." };

  const unidadeOrigem = UNIDADES[String(insumo?.unidade_medida || "").toLowerCase()];
  const unidadeDestino = UNIDADES[String(unidadeSolicitada || "").toLowerCase()];
  if (!unidadeOrigem || !unidadeDestino) return { valor: null, erro: "Selecione uma unidade válida." };

  const normalizado = precoNormalizadoDoInsumo(insumo);
  if (unidadeOrigem.familia === unidadeDestino.familia) {
    return { valor: unidadeDestino.paraBase(quantidade) * normalizado, erro: "" };
  }

  const cruzandoPesoVolume = ["massa", "volume"].includes(unidadeOrigem.familia)
    && ["massa", "volume"].includes(unidadeDestino.familia);
  if (!cruzandoPesoVolume) {
    return { valor: null, erro: "Esta unidade não é compatível com o ingrediente." };
  }

  const densidade = Number(insumo?.densidade_g_ml);
  if (!Number.isFinite(densidade) || densidade <= 0) {
    return { valor: null, erro: "Não é possível converter peso em volume para este ingrediente." };
  }

  if (unidadeOrigem.familia === "massa") {
    const volumeMl = unidadeDestino.paraBase(quantidade) * 1000;
    const massaKg = (volumeMl * densidade) / 1000;
    return { valor: massaKg * normalizado, erro: "" };
  }

  const massaG = unidadeDestino.paraBase(quantidade) * 1000;
  const volumeL = (massaG / densidade) / 1000;
  return { valor: volumeL * normalizado, erro: "" };
}

export function textoPesquisavel(insumo) {
  const fornecedores = (insumo?.fornecedores_vinculados || [])
    .map(item => typeof item === "string" ? item : item?.nome)
    .filter(Boolean);
  return normalizarBusca([
    insumo?.nome,
    insumo?.nome_interno,
    insumo?.marca,
    insumo?.fornecedor,
    ...fornecedores,
    insumo?.codigo_interno,
    insumo?.categoria,
  ].join(" "));
}

export function ordenarIngredientes(lista, ordem = "nome-asc") {
  return [...(lista || [])].sort((a, b) => {
    if (ordem === "nome-desc") return compararNomes(b?.nome, a?.nome);
    if (ordem === "maior-preco") return precoNormalizadoDoInsumo(b) - precoNormalizadoDoInsumo(a)
      || compararNomes(a?.nome, b?.nome);
    if (ordem === "menor-preco") return precoNormalizadoDoInsumo(a) - precoNormalizadoDoInsumo(b)
      || compararNomes(a?.nome, b?.nome);
    if (ordem === "recentes") {
      const dataA = new Date(a?.preco_atualizado_em || a?.updated_at || a?.created_at || 0).getTime();
      const dataB = new Date(b?.preco_atualizado_em || b?.updated_at || b?.created_at || 0).getTime();
      return dataB - dataA || compararNomes(a?.nome, b?.nome);
    }
    return compararNomes(a?.nome, b?.nome);
  });
}
