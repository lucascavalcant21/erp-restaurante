import { supabase, isSupabaseReady } from "./supabase";
import { calcularConsumoProducao } from "./estoque";

const TZ = "America/Sao_Paulo";
const STATUS_FINAIS = new Set(["finalizado", "finalizada", "concluido", "concluida"]);
const ALIASES = {
  kg: "kg", quilo: "kg", quilos: "kg", kilo: "kg", kilos: "kg",
  g: "g", grama: "g", gramas: "g",
  l: "l", litro: "l", litros: "l",
  ml: "ml", mililitro: "ml", mililitros: "ml",
  un: "un", unidade: "un", unidades: "un", porcao: "un", porcoes: "un",
};

function numero(valor) {
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : 0;
  let texto = String(valor ?? "").trim();
  if (!texto) return 0;
  if (texto.includes(",")) texto = texto.replace(/\./g, "").replace(",", ".");
  const n = Number(texto);
  return Number.isFinite(n) ? n : 0;
}

function normalizarTexto(valor) {
  return String(valor || "").trim().toLowerCase().normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function unidadeCanonica(unidade) {
  return ALIASES[normalizarTexto(unidade)] || null;
}

function familiaUnidade(unidade) {
  const u = unidadeCanonica(unidade);
  if (u === "kg" || u === "g") return "g";
  if (u === "l" || u === "ml") return "ml";
  if (u === "un") return "un";
  return null;
}

function diaUtc(data) {
  const [ano, mes, dia] = String(data).split("-").map(Number);
  return new Date(Date.UTC(ano, mes - 1, dia));
}

function dataUtc(data) {
  return data.toISOString().slice(0, 10);
}

function somarDias(data, dias) {
  const d = diaUtc(data);
  d.setUTCDate(d.getUTCDate() + dias);
  return dataUtc(d);
}

function inicioSemana(data) {
  const d = diaUtc(data);
  const deslocamento = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - deslocamento);
  return dataUtc(d);
}

function inicioMes(data) {
  const d = diaUtc(data);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

function somarMeses(data, meses) {
  const d = diaUtc(inicioMes(data));
  d.setUTCMonth(d.getUTCMonth() + meses);
  return dataUtc(d);
}

function erroCalculo(mensagem, codigo = "DADOS_INVALIDOS") {
  return { itens: [], erros: [mensagem], error: mensagem, codigo };
}

export function dataSaoPaulo(valor = new Date()) {
  if (typeof valor === "string" && /^\d{4}-\d{2}-\d{2}$/.test(valor)) return valor;
  const d = valor instanceof Date ? valor : new Date(valor);
  if (Number.isNaN(d.getTime())) return dataSaoPaulo();
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(d).reduce((acc, p) => ({ ...acc, [p.type]: p.value }), {});
  return `${partes.year}-${partes.month}-${partes.day}`;
}

export function intervaloPeriodo(dataRef = dataSaoPaulo(), tipo = "dia") {
  const referencia = dataSaoPaulo(dataRef);
  let inicio = referencia;
  let fim = referencia;
  if (tipo === "semana") {
    inicio = inicioSemana(referencia);
    fim = somarDias(inicio, 6);
  } else if (tipo === "mes") {
    inicio = inicioMes(referencia);
    fim = somarDias(somarMeses(inicio, 1), -1);
  } else if (tipo !== "dia") {
    throw new Error("Período inválido. Use dia, semana ou mes.");
  }
  return {
    tipo, inicio, fim,
    inicioISO: `${inicio}T00:00:00-03:00`,
    fimExclusivoISO: `${somarDias(fim, 1)}T00:00:00-03:00`,
  };
}

export function unidadePadraoFicha(ficha) {
  return unidadeCanonica(ficha?.rendimento_unidade) || "un";
}

export function converterParaBase(qtd, unidade) {
  const n = numero(qtd);
  const u = unidadeCanonica(unidade);
  if (!u) return NaN;
  if (u === "kg" || u === "l") return n * 1000;
  return n;
}

export function converterDaBase(base, unidade) {
  const n = numero(base);
  const u = unidadeCanonica(unidade);
  if (!u) return NaN;
  if (u === "kg" || u === "l") return n / 1000;
  return n;
}

export function formatarQuantidadeBase(base, unidade) {
  const u = unidadeCanonica(unidade) || "un";
  const valor = converterDaBase(base, u);
  const rotulo = { kg: "kg", g: "g", l: "L", ml: "ml", un: "un" }[u];
  return `${valor.toLocaleString("pt-BR", { maximumFractionDigits: 3 })} ${rotulo}`;
}

export function calcularConsumoPorSaida(ficha, qtd, unidade, todasFichas = []) {
  if (!ficha) return erroCalculo("Receita não informada.");
  const unidadeAlvo = unidadeCanonica(unidade || unidadePadraoFicha(ficha));
  const unidadeRendimento = unidadePadraoFicha(ficha);
  const familiaAlvo = familiaUnidade(unidadeAlvo);
  const familiaRendimento = familiaUnidade(unidadeRendimento);
  let alvoBase = converterParaBase(qtd, unidadeAlvo);
  let rendimentoBase = converterParaBase(ficha.rendimento_porcoes, unidadeRendimento);
  let unidadeBase = familiaRendimento;

  if (!(alvoBase > 0) || !(rendimentoBase > 0)) {
    return erroCalculo("Quantidade e rendimento devem ser maiores que zero.");
  }
  if (familiaAlvo !== familiaRendimento) {
    const pesoPorcao = numero(ficha.peso_porcao_g);
    const massaEUnidade = new Set([familiaAlvo, familiaRendimento]);
    if (pesoPorcao > 0 && massaEUnidade.has("g") && massaEUnidade.has("un") && massaEUnidade.size === 2) {
      if (familiaRendimento === "un") rendimentoBase *= pesoPorcao;
      if (familiaAlvo === "un") alvoBase *= pesoPorcao;
      unidadeBase = "g";
    } else {
      return erroCalculo("A unidade escolhida não é compatível com o rendimento da receita.", "UNIDADE_INCOMPATIVEL");
    }
  }

  const fatorReceita = alvoBase / rendimentoBase;
  const calculo = calcularConsumoProducao(ficha, fatorReceita, todasFichas);
  const itens = (calculo.itens || []).map(({ insumo, quantidade }) => {
    const custo = numero(insumo?.custo_unitario);
    return {
      insumo,
      insumo_id: insumo?.id,
      nome: insumo?.nome || "Ingrediente",
      unidade_medida: insumo?.unidade_medida || "",
      quantidade: numero(quantidade),
      custo_unitario_snapshot: custo,
      custo_total: numero(quantidade) * custo,
    };
  }).filter(i => i.insumo_id).sort((a, b) => String(a.insumo_id).localeCompare(String(b.insumo_id)));

  return {
    itens,
    erros: calculo.erros || [],
    fatorReceita,
    alvoBase,
    rendimentoBase,
    unidadeBase,
    unidadeEntrada: unidadeAlvo,
    custoPrevisto: itens.reduce((s, i) => s + i.custo_total, 0),
    custoTotal: itens.reduce((s, i) => s + i.custo_total, 0),
  };
}

export function calcularCapacidadePorEstoque(ficha, estoque = [], todasFichas = [], unidade) {
  const unidadeSaida = unidadeCanonica(unidade || unidadePadraoFicha(ficha));
  const consumo = calcularConsumoPorSaida(ficha, 1, unidadeSaida, todasFichas);
  if (consumo.erros?.length || !consumo.itens.length) {
    return { capacidade: 0, unidade: unidadeSaida, itens: [], erros: consumo.erros || ["Receita sem ingredientes."] };
  }
  const saldos = new Map((estoque || []).map(i => [String(i.insumo_id || i.id), numero(i.quantidade_atual ?? i.quantidade)]));
  const itens = consumo.itens.map(i => {
    const disponivel = saldos.get(String(i.insumo_id)) || 0;
    return { ...i, disponivel, capacidade: i.quantidade > 0 ? disponivel / i.quantidade : Infinity };
  });
  const capacidade = Math.max(0, Math.min(...itens.map(i => i.capacidade)));
  return {
    capacidade: Number.isFinite(capacidade) ? capacidade : 0,
    capacidadeBase: converterParaBase(Number.isFinite(capacidade) ? capacidade : 0, unidadeSaida),
    unidade: unidadeSaida,
    limitante: itens.find(i => i.capacidade === capacidade) || null,
    itens,
    erros: [],
  };
}

function dataLote(lote) {
  return dataSaoPaulo(lote.data_producao || lote.finalizado_em || lote.iniciado_em || lote.created_at);
}

function loteFinalizado(lote) {
  return !lote.status ? numero(lote.quantidade_produzida) > 0 : STATUS_FINAIS.has(normalizarTexto(lote.status));
}

function fichaIdLote(lote) {
  return lote.ficha_id || lote.fichas_tecnicas?.id;
}

function produzidoBase(lote, ficha) {
  const salvo = numero(lote.quantidade_produzida_base ?? lote.quantidade_real_base);
  if (salvo > 0) return salvo;
  return converterParaBase(lote.quantidade_produzida ?? lote.quantidade_real, lote.unidade_produzida || lote.unidade || unidadePadraoFicha(ficha)) || 0;
}

function custoLote(lote) {
  const direto = numero(lote.custo_real ?? lote.custo_total ?? lote.custo_previsto);
  if (direto > 0) return direto;
  let itens = lote.ingredientes || lote.producao_consumos || [];
  if (typeof itens === "string") { try { itens = JSON.parse(itens); } catch { itens = []; } }
  return (itens || []).reduce((s, i) => s + numero(i.quantidade_baixada ?? i.quantidade) * numero(i.custo_unitario_snapshot ?? i.custo_unitario), 0);
}

function nivelConfianca(amostras, esperado) {
  if (!amostras) return "nenhuma";
  const p = amostras / esperado;
  return p < 0.4 ? "baixa" : p < 0.75 ? "media" : "alta";
}

function mediaPeriodos(periodos, porData) {
  if (!periodos.length) return { mediaBase: 0, custoMedio: 0, amostras: 0 };
  const totais = periodos.map(({ inicio, fim }) => {
    let quantidade = 0, custo = 0;
    for (const [data, valor] of porData) if (data >= inicio && data <= fim) { quantidade += valor.quantidade; custo += valor.custo; }
    return { quantidade, custo };
  });
  return {
    mediaBase: totais.reduce((s, x) => s + x.quantidade, 0) / totais.length,
    custoMedio: totais.reduce((s, x) => s + x.custo, 0) / totais.length,
    amostras: totais.length,
  };
}

export function calcularMediasProducao(fichas = [], lotes = [], dataRef = dataSaoPaulo()) {
  const ref = dataSaoPaulo(dataRef);
  return fichas.map(ficha => {
    const registros = lotes.filter(l => fichaIdLote(l) === ficha.id && loteFinalizado(l) && dataLote(l) < ref);
    const porData = new Map();
    registros.forEach(l => {
      const data = dataLote(l), atual = porData.get(data) || { quantidade: 0, custo: 0 };
      atual.quantidade += produzidoBase(l, ficha); atual.custo += custoLote(l); porData.set(data, atual);
    });
    const primeira = [...porData.keys()].sort()[0];
    const datasDia = [];
    for (let i = 1; i <= 8; i += 1) {
      const d = somarDias(ref, -7 * i);
      if (primeira && d >= primeira) datasDia.push({ inicio: d, fim: d });
    }
    const semanaAtual = inicioSemana(ref), semanas = [];
    for (let i = 1; i <= 8; i += 1) {
      const ini = somarDias(semanaAtual, -7 * i);
      if (primeira && somarDias(ini, 6) >= primeira) semanas.push({ inicio: ini, fim: somarDias(ini, 6) });
    }
    const mesAtual = inicioMes(ref), meses = [];
    for (let i = 1; i <= 3; i += 1) {
      const ini = somarMeses(mesAtual, -i), fim = somarDias(somarMeses(ini, 1), -1);
      if (primeira && fim >= primeira) meses.push({ inicio: ini, fim });
    }
    const dia = mediaPeriodos(datasDia, porData), semana = mediaPeriodos(semanas, porData), mes = mediaPeriodos(meses, porData);
    dia.confianca = nivelConfianca(dia.amostras, 8);
    semana.confianca = nivelConfianca(semana.amostras, 8);
    mes.confianca = nivelConfianca(mes.amostras, 3);
    return {
      ficha_id: ficha.id, nome: ficha.nome_receita, unidade: unidadePadraoFicha(ficha),
      unidade_base: familiaUnidade(unidadePadraoFicha(ficha)), diaSemana: dia, semanal: semana, mensal: mes,
      mediaDiaSemanaBase: dia.mediaBase, mediaSemanalBase: semana.mediaBase, mediaMensalBase: mes.mediaBase,
      custoMedioDiaSemana: dia.custoMedio, custoMedioSemanal: semana.custoMedio, custoMedioMensal: mes.custoMedio,
      confianca: dia.confianca,
    };
  });
}

export function resumirPeriodoProducao(fichas = [], lotes = [], dataRef = dataSaoPaulo(), tipo = "dia") {
  const intervalo = intervaloPeriodo(dataRef, tipo);
  const mapaFichas = new Map(fichas.map(f => [f.id, f]));
  const mapa = new Map();
  lotes.filter(l => { const d = dataLote(l); return d >= intervalo.inicio && d <= intervalo.fim; }).forEach(l => {
    const ficha = mapaFichas.get(fichaIdLote(l)) || l.fichas_tecnicas || { id: fichaIdLote(l), nome_receita: l.ficha_nome || "Receita" };
    const chave = ficha.id, atual = mapa.get(chave) || {
      ficha_id: chave, nome: ficha.nome_receita, unidade: unidadePadraoFicha(ficha),
      unidade_base: familiaUnidade(unidadePadraoFicha(ficha)), planejadoBase: 0, produzidoBase: 0,
      custo: 0, lotes: 0, finalizados: 0, abertos: 0, cancelados: 0,
    };
    atual.lotes += 1;
    atual.planejadoBase += numero(l.quantidade_planejada_base) || converterParaBase(l.quantidade_planejada, l.unidade_planejada || atual.unidade) || 0;
    const status = normalizarTexto(l.status);
    if (loteFinalizado(l)) { atual.finalizados += 1; atual.produzidoBase += produzidoBase(l, ficha); atual.custo += custoLote(l); }
    else if (status.includes("cancel")) atual.cancelados += 1;
    else if (status === "em_producao" || status.includes("andamento") || status.includes("iniciado") || status === "aberto") atual.abertos += 1;
    mapa.set(chave, atual);
  });
  const itens = [...mapa.values()].map(i => ({ ...i, faltanteBase: Math.max(0, i.planejadoBase - i.produzidoBase) }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  return {
    intervalo, itens,
    totais: {
      custo: itens.reduce((s, i) => s + i.custo, 0),
      lotes: itens.reduce((s, i) => s + i.lotes, 0),
      finalizados: itens.reduce((s, i) => s + i.finalizados, 0),
      abertos: itens.reduce((s, i) => s + i.abertos, 0),
      porUnidade: itens.reduce((acc, i) => { acc[i.unidade_base] = (acc[i.unidade_base] || 0) + i.produzidoBase; return acc; }, {}),
    },
  };
}

function migracaoPendente(error) {
  const msg = normalizarTexto(`${error?.message || ""} ${error?.details || ""} ${error?.hint || ""}`);
  return ["42p01", "42703", "42883", "42p10", "pgrst202", "pgrst204", "pgrst205"].includes(normalizarTexto(error?.code))
    || /does not exist|could not find|schema cache|no unique or exclusion/.test(msg);
}

function falha(error) {
  if (!error) return null;
  return { data: null, error: error.message || String(error), codigo: migracaoPendente(error) ? "MIGRACAO_PENDENTE" : (error.code || "ERRO_BANCO") };
}

function offline(vazio = []) {
  return { data: vazio, error: "Supabase offline", codigo: "OFFLINE" };
}

export async function fetchLotesProducao(unidadeId, filtros = {}) {
  if (!isSupabaseReady()) return offline([]);
  let q = supabase.from("producao_lotes").select("*, fichas_tecnicas(id,nome_receita,departamento,rendimento_porcoes,rendimento_unidade,peso_porcao_g)");
  if (unidadeId && unidadeId !== "todas") q = q.eq("unidade_id", unidadeId);
  if (filtros.departamento) q = q.eq("departamento", filtros.departamento);
  if (filtros.fichaId) q = q.eq("ficha_id", filtros.fichaId);
  if (Array.isArray(filtros.status)) q = q.in("status", filtros.status);
  else if (filtros.status) q = q.eq("status", filtros.status);
  if (filtros.inicio || filtros.dataInicio) q = q.gte("data_producao", filtros.inicio || filtros.dataInicio);
  if (filtros.fim || filtros.dataFim) q = q.lte("data_producao", filtros.fim || filtros.dataFim);
  const { data, error } = await q.order("data_producao", { ascending: false }).order("created_at", { ascending: false }).limit(filtros.limite || 1000);
  return falha(error) || { data: data || [], error: null, codigo: null };
}

export async function fetchHistoricoProducao(unidadeId, dataRef = dataSaoPaulo(), tipo = "mes", filtros = {}) {
  if (typeof dataRef === "object") { filtros = dataRef; dataRef = filtros.dataRef || dataSaoPaulo(); tipo = filtros.tipo || "mes"; }
  const intervalo = intervaloPeriodo(dataRef, tipo);
  const res = await fetchLotesProducao(unidadeId, { ...filtros, inicio: intervalo.inicio, fim: intervalo.fim });
  return { ...res, intervalo };
}

export async function fetchContagensProducao(unidadeId, filtros = {}) {
  if (!isSupabaseReady()) return offline([]);
  let q = supabase.from("producao_contagens")
    .select("*, fichas_tecnicas(id,nome_receita,departamento,rendimento_porcoes,rendimento_unidade,peso_porcao_g)");
  if (unidadeId && unidadeId !== "todas") q = q.eq("unidade_id", unidadeId);
  if (filtros.departamento) q = q.eq("departamento", filtros.departamento);
  if (filtros.fichaId || filtros.ficha_id) q = q.eq("ficha_id", filtros.fichaId || filtros.ficha_id);
  if (filtros.origem) q = q.eq("origem", filtros.origem);
  if (filtros.colaboradorId || filtros.colaborador_id) {
    q = q.eq("colaborador_id", filtros.colaboradorId || filtros.colaborador_id);
  }
  if (filtros.inicio || filtros.dataInicio) q = q.gte("data_contagem", filtros.inicio || filtros.dataInicio);
  if (filtros.fim || filtros.dataFim) q = q.lte("data_contagem", filtros.fim || filtros.dataFim);
  const { data, error } = await q
    .order("data_contagem", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(filtros.limite || 1000);
  return falha(error) || { data: data || [], error: null, codigo: null };
}

export async function fetchSaldosProducao(unidadeId, departamento = null) {
  if (!isSupabaseReady()) return offline([]);
  let q = supabase.from("producao_saldos").select("*, fichas_tecnicas(id,nome_receita,departamento,rendimento_unidade,peso_porcao_g)");
  if (unidadeId && unidadeId !== "todas") q = q.eq("unidade_id", unidadeId);
  const { data, error } = await q;
  const f = falha(error); if (f) return f;
  const lista = (data || []).filter(x => !departamento || x.fichas_tecnicas?.departamento === departamento)
    .sort((a, b) => String(a.fichas_tecnicas?.nome_receita || "").localeCompare(String(b.fichas_tecnicas?.nome_receita || ""), "pt-BR"));
  return { data: lista, error: null, codigo: null };
}

export async function salvarPlanoProducao(unidadeId, plano = {}, itens = []) {
  if (!isSupabaseReady()) return offline([]);
  if (!unidadeId || !plano.departamento || !plano.data_producao) return { data: null, error: "Unidade, departamento e data são obrigatórios.", codigo: "DADOS_INVALIDOS" };
  if (!itens.length) return { data: [], error: null, codigo: null };
  const idsParaExcluir = itens
    .filter(item => item.id && (item.status || "planejado") === "planejado" && numero(item.quantidade_planejada_base) <= 0)
    .map(item => item.id);
  if (idsParaExcluir.length) {
    const { error: erroDelete } = await supabase.from("producao_lotes")
      .delete().in("id", idsParaExcluir).eq("status", "planejado");
    const falhaDelete = falha(erroDelete);
    if (falhaDelete) return falhaDelete;
  }

  const montarPayload = (item) => ({
    unidade_id: unidadeId,
    departamento: plano.departamento,
    data_producao: plano.data_producao,
    ficha_id: item.ficha_id || item.ficha?.id,
    ficha_nome: item.ficha_nome || item.ficha?.nome_receita || "",
    status: "planejado",
    quantidade_planejada: numero(item.quantidade_planejada),
    unidade_planejada: item.unidade_planejada,
    quantidade_planejada_base: numero(item.quantidade_planejada_base),
    unidade_base: item.unidade_base,
    estoque_pronto_informado_base: numero(item.estoque_pronto_informado_base),
    media_dia_base: numero(item.media_dia_base),
    media_semana_base: numero(item.media_semana_base),
    media_mes_base: numero(item.media_mes_base),
    margem_seguranca_pct: numero(item.margem_seguranca_pct),
    responsavel_planejado_id: item.responsavel_planejado_id || null,
    responsavel_planejado_nome: item.responsavel_planejado_nome || "",
    custo_previsto: numero(item.custo_previsto),
    ingredientes_previstos: item.ingredientes_previstos || [],
    origem: item.origem || "manual",
    transcricao_audio: item.transcricao_audio || null,
  });

  const positivos = itens.filter(item => numero(item.quantidade_planejada_base) > 0);
  const salvos = [];
  for (const item of positivos) {
    const payload = montarPayload(item);
    if (!payload.ficha_id) continue;

    // Lotes que outra pessoa já iniciou não podem ser alterados nem duplicados.
    // Eles continuam visíveis na tela, mas o salvamento dos demais cartões deve
    // prosseguir normalmente.
    if (item.id && (item.status || "planejado") === "em_producao") continue;

    if (item.id && (item.status || "planejado") === "planejado") {
      const { data, error } = await supabase.from("producao_lotes")
        .update(payload)
        .eq("id", item.id)
        .eq("status", "planejado")
        .select();
      const erroUpdate = falha(error);
      if (erroUpdate) return erroUpdate;
      if ((data || []).length) {
        salvos.push(...data);
        continue;
      }
      // O lote pode ter sido iniciado por outra tela entre a leitura e o salvamento.
      // Nesse caso, preserva o lote existente. O próximo recarregamento mostrará
      // o estado correto sem tentar criar um segundo lote ativo.
      continue;
    }

    const { data, error } = await supabase.from("producao_lotes").insert(payload).select();
    const erroInsert = falha(error);
    if (erroInsert) return erroInsert;
    salvos.push(...(data || []));
  }
  return { data: salvos, error: null, codigo: null };
}

function argsObjeto(primeiro, segundo) {
  return typeof primeiro === "object" ? primeiro : { ...(segundo || {}), unidadeId: primeiro };
}

function normalizarIngredientes(ingredientes = []) {
  return ingredientes.map(i => {
    const insumo = i.insumo || {};
    const quantidade = numero(i.quantidade_baixada ?? i.quantidade);
    const custo = numero(i.custo_unitario_snapshot ?? i.custo_unitario ?? insumo.custo_unitario);
    return {
      insumo_id: i.insumo_id || insumo.id, nome: i.nome || insumo.nome || "Ingrediente",
      unidade_medida: i.unidade_medida || insumo.unidade_medida || "", quantidade,
      custo_unitario_snapshot: custo, custo_total: quantidade * custo,
    };
  }).filter(i => i.insumo_id && i.quantidade > 0).sort((a, b) => String(a.insumo_id).localeCompare(String(b.insumo_id)));
}

function uuidChamada() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (caractere) => {
    const aleatorio = Math.floor(Math.random() * 16);
    const valor = caractere === "x" ? aleatorio : (aleatorio & 0x3) | 0x8;
    return valor.toString(16);
  });
}

async function executarRpc(nome, params) {
  if (!isSupabaseReady()) return offline(null);
  const { data, error } = await supabase.rpc(nome, params);
  return falha(error) || { data, error: null, codigo: null };
}

export async function registrarContagemProducao(primeiro, segundo) {
  const p = argsObjeto(primeiro, segundo), unidade = unidadeCanonica(p.unidade || p.unidadeBase || "un");
  const quantidadeBase = p.quantidadeBase ?? converterParaBase(p.quantidade, unidade);
  const chaveIdempotencia = p.chaveIdempotencia || p.chave_idempotencia || uuidChamada();
  return executarRpc("registrar_contagem_producao", {
    p_unidade_id: p.unidadeId || p.unidade_id, p_ficha_id: p.fichaId || p.ficha_id,
    p_quantidade_base: numero(quantidadeBase), p_unidade_base: familiaUnidade(unidade),
    p_data: p.dataReferencia || p.data_referencia || dataSaoPaulo(),
    p_origem: p.origem || "manual", p_transcricao: p.transcricao || null,
    p_colaborador: p.colaboradorId || p.colaborador_id || null,
    p_chave_idempotencia: chaveIdempotencia,
  });
}

export async function iniciarLoteProducao(payload = {}) {
  const ingredientes = normalizarIngredientes(payload.ingredientes || []);
  const custo = payload.custoPrevisto ?? ingredientes.reduce((s, i) => s + i.custo_total, 0);
  return executarRpc("iniciar_producao_lote", {
    p_lote_id: payload.loteId || payload.lote_id,
    p_colaborador_id: payload.colaboradorId || payload.colaborador_id || null,
    p_colaborador_nome: payload.colaboradorNome || payload.colaborador_nome || null,
    p_ingredientes: ingredientes,
    p_custo_previsto: numero(custo),
  });
}

export async function finalizarLoteProducao(payload = {}) {
  const unidade = unidadeCanonica(payload.unidade || "un");
  const base = payload.quantidadeBase ?? converterParaBase(payload.quantidade, unidade);
  return executarRpc("finalizar_producao_lote", {
    p_lote_id: payload.loteId || payload.lote_id,
    p_quantidade: numero(payload.quantidade),
    p_unidade: unidade,
    p_quantidade_base: numero(base),
    p_observacoes: payload.observacoes || null,
  });
}

export async function cancelarLoteProducao(payload = {}) {
  return executarRpc("cancelar_producao_lote", {
    p_lote_id: payload.loteId || payload.lote_id,
    p_devolver_estoque: payload.devolverEstoque !== false,
    p_motivo: payload.motivo || null,
  });
}
