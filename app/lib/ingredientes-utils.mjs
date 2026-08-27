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
  pacote: { familia: "unidade", paraBase: valor => valor, rotulo: "Pacote" },
  fardo: { familia: "unidade", paraBase: valor => valor, rotulo: "Lata" },
};

// UNIDADE mede; EMBALAGEM conta. Garrafa, lata e barril estavam misturadas na
// mesma lista das unidades de medida, e escolher "Garrafa" fazia o volume
// desaparecer: 500 ml de agua viravam "500 garrafas". Agora sao duas perguntas
// separadas — quanto (500 ml) e em que (garrafa).
export const UNIDADES_INGREDIENTE = [
  { value: "ml", label: "ml" },
  { value: "l", label: "L" },
  { value: "g", label: "g" },
  { value: "kg", label: "kg" },
  { value: "un", label: "unidade (un)" },
];

// O bar mede tudo em volume. Poder escolher kg numa garrafa de gin so gerava
// ficha com rendimento errado.
export const UNIDADES_INGREDIENTE_BAR = [
  { value: "ml", label: "ml" },
  { value: "l", label: "L" },
];

export function unidadesDoDepartamento(departamento) {
  return String(departamento || "").toLowerCase() === "bar"
    ? UNIDADES_INGREDIENTE_BAR
    : UNIDADES_INGREDIENTE;
}

// Em que o volume/peso vem embalado. Vazio = a granel, pesado na balanca.
export const EMBALAGENS_INGREDIENTE = [
  { value: "", label: "A granel / sem embalagem" },
  { value: "garrafa", label: "Garrafa" },
  { value: "lata", label: "Lata" },
  { value: "barril", label: "Barril (Chopp)" },
  { value: "caixa", label: "Caixa" },
  { value: "pacote", label: "Pacote" },
  { value: "saco", label: "Saco" },
  { value: "pote", label: "Pote" },
  { value: "un", label: "Unidade" },
];

export function rotuloEmbalagem(valor) {
  const achado = EMBALAGENS_INGREDIENTE.find(e => e.value === String(valor || "").toLowerCase());
  // "Barril (Chopp)" e bom no seletor e ruim no meio da frase: o parentese
  // vira "30 L por barril (chopp)".
  return achado && achado.value ? achado.label.replace(/\s*\(.*\)$/, "").toLowerCase() : "";
}

// Unidades que CONTAM em vez de medir. Uma garrafa não é uma quantidade: é um
// recipiente, e o que interessa na receita é quanto cabe nele. Por isso essas
// três pedem o volume no cadastro (insumos.volume_unidade_ml, em ml).
export const UNIDADES_CONTADAS = new Set(["garrafa", "lata", "barril"]);

export const ehUnidadeContada = (unidade) =>
  UNIDADES_CONTADAS.has(String(unidade || "").toLowerCase().trim());

// Quantos ml valem 1 unidade contada. Zero quando não é unidade contada ou
// quando ninguém preencheu o volume — nesse caso a receita continua sem saber o
// rendimento, que é melhor do que inventar um número.
export function volumeUnitarioMl(insumo) {
  // Caminho novo: mede em ml/L e vem embalado. 500 ml numa garrafa = 500 ml
  // por garrafa. tamanho_embalagem ja e o conteudo de UMA embalagem.
  const un = String(insumo?.unidade_medida || "").toLowerCase();
  if (un === "ml" || un === "l") {
    if (!String(insumo?.unidade_comercial || "").trim()) return 0;
    const tam = Number(insumo?.tamanho_embalagem);
    if (!Number.isFinite(tam) || tam <= 0) return 0;
    return un === "l" ? tam * 1000 : tam;
  }
  // Caminho antigo: quem foi cadastrado com "garrafa" na unidade de medida,
  // quando as duas listas eram uma so. O volume ficou em volume_unidade_ml.
  if (!ehUnidadeContada(un)) return 0;
  const ml = Number(insumo?.volume_unidade_ml);
  return Number.isFinite(ml) && ml > 0 ? ml : 0;
}

// Em que esse volume vem: "garrafa", "lata", "barril". Vazio quando o item e
// a granel — ai nao ha embalagem para mostrar.
export function embalagemDoInsumo(insumo) {
  const comercial = String(insumo?.unidade_comercial || "").toLowerCase().trim();
  if (comercial) return rotuloEmbalagem(comercial) || comercial;
  const un = String(insumo?.unidade_medida || "").toLowerCase();
  return ehUnidadeContada(un) ? un : "";
}

// "500 ml", "1 L", "30 L" — como mostrar o volume de uma unidade contada.
export function rotuloVolumeUnitario(insumo) {
  const ml = volumeUnitarioMl(insumo);
  if (!ml) return "";
  const medida = ml >= 1000
    ? `${(ml / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 3 })} L`
    : `${ml.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} ml`;
  // O volume sozinho nao diz onde ele esta. "500 ml" pode ser garrafa, lata ou
  // uma medida solta; "500 ml por garrafa" e o que a pessoa precisa ler.
  const emb = embalagemDoInsumo(insumo);
  return emb ? `${medida} por ${emb}` : medida;
}

// A cozinha tem o mesmo problema do bar, só que em peso. "1 un" de tomate não
// diz nada para a receita enquanto ninguém contar quanto pesa. Mesma pergunta,
// mesma tela, unidade diferente: o bar responde em ml, a cozinha em g.
export const ehUnidadeUnitaria = (unidade) =>
  ["un", "unidade"].includes(String(unidade || "").toLowerCase().trim());

// Quantos gramas vale 1 unidade. Zero quando não é "un" ou quando ninguém
// preencheu — aí o item fica de fora do rendimento, como a garrafa sem volume.
export function pesoUnitarioG(insumo) {
  // Mesma logica do volume, do lado do peso: 5 kg num saco = 5 kg por saco.
  const un = String(insumo?.unidade_medida || "").toLowerCase();
  if (un === "g" || un === "kg") {
    if (!String(insumo?.unidade_comercial || "").trim()) return 0;
    const tam = Number(insumo?.tamanho_embalagem);
    if (!Number.isFinite(tam) || tam <= 0) return 0;
    return un === "kg" ? tam * 1000 : tam;
  }
  if (!ehUnidadeUnitaria(un)) return 0;
  const g = Number(insumo?.peso_medio_g);
  return Number.isFinite(g) && g > 0 ? g : 0;
}

// "100 g", "1,5 kg" — como mostrar o peso de uma unidade.
export function rotuloPesoUnitario(insumo) {
  const g = pesoUnitarioG(insumo);
  if (!g) return "";
  const medida = g >= 1000
    ? `${(g / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 3 })} kg`
    : `${g.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} g`;
  const emb = embalagemDoInsumo(insumo);
  return emb ? `${medida} por ${emb}` : `${medida} por unidade`;
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
  const info = UNIDADES[String(unidade || "").toLowerCase()];
  if (!info || !Number.isFinite(qtd) || qtd <= 0 || !Number.isFinite(valor) || valor < 0) return 0;
  const quantidadeBase = info.paraBase(qtd);
  return quantidadeBase > 0 ? valor / quantidadeBase : 0;
}

export function unidadeNormalizada(unidade) {
  const info = UNIDADES[String(unidade || "").toLowerCase()];
  if (!info) return "";
  if (info.familia === "massa") return "kg";
  if (info.familia === "volume") return "L";
  return "unidade";
}

export function precoNormalizadoDoInsumo(insumo) {
  const salvo = Number(insumo?.preco_normalizado);
  // Registros anteriores à migração receberam 0 como valor padrão. Esse zero
  // não deve esconder o preço que já existe na embalagem.
  if (Number.isFinite(salvo) && salvo > 0) return salvo;
  const tamanho = Number(insumo?.tamanho_embalagem) || 1;
  const valorTotal = Number(insumo?.custo_compra);
  const valor = Number.isFinite(valorTotal)
    ? valorTotal
    : (Number(insumo?.custo_unitario) || 0) * tamanho;
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
