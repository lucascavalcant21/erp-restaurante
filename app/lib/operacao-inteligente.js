import { supabase, isSupabaseReady } from "./supabase";
import {
  execucoesPrevistas, statusDaExecucao, concluiuNoPrazo,
  respostaConforme, isoData,
} from "./operacao-agenda.mjs";

// Camada de dados da Operação Inteligente. As regras de negócio vivem no motor
// (operacao-agenda.mjs), que é puro e testado; aqui só se conversa com o banco.

const err = (e) => e?.message || null;
const hojeISO = () => isoData(new Date());

// ── PROCESSOS (modelo) ──────────────────────────────────────────────────────
export async function fetchProcessos(unidadeId, { incluirArquivados = false } = {}) {
  if (!isSupabaseReady() || !unidadeId) return { data: [] };
  let q = supabase.from("op_processos").select("*").eq("unidade_id", String(unidadeId));
  if (!incluirArquivados) q = q.eq("arquivado", false);
  const { data, error } = await q.order("nome");
  return { data: data || [], error: err(error) };
}

// Traz o processo inteiro (seções + itens) numa consulta só.
export async function fetchProcessoCompleto(processoId) {
  if (!isSupabaseReady() || !processoId) return { data: null };
  const { data: processo, error } = await supabase
    .from("op_processos").select("*").eq("id", processoId).single();
  if (error) return { data: null, error: err(error) };
  const [{ data: secoes }, { data: itens }] = await Promise.all([
    supabase.from("op_secoes").select("*").eq("processo_id", processoId).order("ordem"),
    supabase.from("op_itens").select("*").eq("processo_id", processoId).order("ordem"),
  ]);
  return {
    data: {
      ...processo,
      secoes: (secoes || []).map(s => ({ ...s, itens: (itens || []).filter(i => i.secao_id === s.id) })),
    },
  };
}

export async function salvarProcesso(processo) {
  if (!isSupabaseReady()) return { error: "Offline" };
  const { id, secoes, ...campos } = processo;
  campos.updated_at = new Date().toISOString();
  if (id) {
    const { error } = await supabase.from("op_processos").update(campos).eq("id", id);
    return { id, error: err(error) };
  }
  const { data, error } = await supabase.from("op_processos").insert([campos]).select("id").single();
  return { id: data?.id, error: err(error) };
}

// Grava seções e itens de uma vez. Editar um processo que já rodou sobe a
// versão: o histórico continua apontando para a versão antiga.
export async function salvarEstrutura(processoId, secoes, { subirVersao = false } = {}) {
  if (!isSupabaseReady() || !processoId) return { error: "Processo inválido" };

  if (subirVersao) {
    const { data: atual } = await supabase.from("op_processos").select("versao").eq("id", processoId).single();
    await supabase.from("op_processos").update({ versao: (Number(atual?.versao) || 1) + 1 }).eq("id", processoId);
  }

  // Regrava a estrutura: as execuções antigas guardam suas próprias respostas.
  await supabase.from("op_itens").delete().eq("processo_id", processoId);
  await supabase.from("op_secoes").delete().eq("processo_id", processoId);

  // Regravar gera ids novos, então o item condicional é ligado pela "chave" que
  // o construtor carrega e resolvido numa segunda passada, já com os ids reais.
  const idPorChave = {};
  const pendentes = [];

  for (const [iSecao, secao] of (secoes || []).entries()) {
    const { data: nova, error } = await supabase.from("op_secoes")
      .insert([{ processo_id: processoId, titulo: secao.titulo, descricao: secao.descricao || null, ordem: iSecao }])
      .select("id").single();
    if (error) return { error: err(error) };

    const itens = (secao.itens || []).map((item, iItem) => ({
      secao_id: nova.id,
      processo_id: processoId,
      titulo: item.titulo,
      instrucao: item.instrucao || null,
      tipo: item.tipo || "FEITO_NAO_FEITO",
      ordem: iItem,
      obrigatorio: item.obrigatorio !== false,
      permite_na: !!item.permite_na,
      peso: Number(item.peso) || 1,
      critico: !!item.critico,
      exige_foto: !!item.exige_foto,
      exige_comentario: !!item.exige_comentario,
      exige_gps: !!item.exige_gps,
      valor_min: item.valor_min === "" || item.valor_min == null ? null : Number(item.valor_min),
      valor_max: item.valor_max === "" || item.valor_max == null ? null : Number(item.valor_max),
      unidade_medida: item.unidade_medida || null,
      opcoes: Array.isArray(item.opcoes) ? item.opcoes : [],
      resposta_esperada: item.resposta_esperada || null,
      depende_item_id: item.depende_chave ? null : (item.depende_item_id || null),
      depende_valor: item.depende_valor || null,
      acao_reprovar: item.acao_reprovar || "nao_conformidade",
      criterios_ia: item.criterios_ia || null,
    }));
    if (itens.length) {
      const { data: gravados, error: e2 } = await supabase.from("op_itens").insert(itens).select("id");
      if (e2) return { error: err(e2) };
      (gravados || []).forEach((linha, i) => {
        const origem = secao.itens[i];
        if (origem?.chave) idPorChave[origem.chave] = linha.id;
        if (origem?.depende_chave) pendentes.push({ id: linha.id, alvo: origem.depende_chave, valor: origem.depende_valor || null });
      });
    }
  }

  for (const p of pendentes) {
    const alvo = idPorChave[p.alvo];
    if (alvo) await supabase.from("op_itens").update({ depende_item_id: alvo, depende_valor: p.valor }).eq("id", p.id);
  }
  return { error: null };
}

// ── AGENDAS ─────────────────────────────────────────────────────────────────
// Já rodou alguma vez? Se sim, editar o modelo sobe a versão — o histórico
// continua contando a história da versão que foi executada.
export async function processoTemExecucao(processoId) {
  if (!isSupabaseReady() || !processoId) return false;
  const { count } = await supabase.from("op_execucoes")
    .select("id", { count: "exact", head: true }).eq("processo_id", processoId);
  return (count || 0) > 0;
}

export async function arquivarProcesso(id, arquivado = true) {
  if (!isSupabaseReady()) return { error: "Offline" };
  const { error } = await supabase.from("op_processos")
    .update({ arquivado, ativo: !arquivado, updated_at: new Date().toISOString() }).eq("id", id);
  return { error: err(error) };
}

// Copia modelo, seções e itens. As agendas não vêm junto de propósito: a cópia
// costuma rodar em outro horário.
export async function duplicarProcesso(processoId, { criadoPor } = {}) {
  const { data: original } = await fetchProcessoCompleto(processoId);
  if (!original) return { error: "Processo não encontrado" };
  const { id, secoes, created_at, updated_at, versao, ...campos } = original;
  const { id: novoId, error } = await salvarProcesso({
    ...campos, nome: `${original.nome} (cópia)`, versao: 1,
    criado_por: criadoPor || original.criado_por || null,
  });
  if (error || !novoId) return { error: error || "Não consegui copiar." };
  const e2 = await salvarEstrutura(novoId, secoes);
  return { id: novoId, error: e2.error };
}

export async function fetchAgendasDoProcesso(processoId) {
  if (!isSupabaseReady() || !processoId) return { data: [] };
  const { data, error } = await supabase.from("op_agendas").select("*")
    .eq("processo_id", processoId).order("hora_inicio");
  return { data: data || [], error: err(error) };
}

export async function excluirAgenda(id) {
  if (!isSupabaseReady() || !id) return { error: "Agenda inválida" };
  const { error } = await supabase.from("op_agendas").delete().eq("id", id);
  return { error: err(error) };
}

export async function fetchAgendas(unidadeId) {
  if (!isSupabaseReady() || !unidadeId) return { data: [] };
  const { data, error } = await supabase.from("op_agendas").select("*")
    .eq("unidade_id", String(unidadeId)).eq("ativo", true);
  return { data: data || [], error: err(error) };
}

export async function salvarAgenda(agenda) {
  if (!isSupabaseReady()) return { error: "Offline" };
  const { id, ...campos } = agenda;
  if (id) {
    const { error } = await supabase.from("op_agendas").update(campos).eq("id", id);
    return { id, error: err(error) };
  }
  const { data, error } = await supabase.from("op_agendas").insert([campos]).select("id").single();
  return { id: data?.id, error: err(error) };
}

// ── GERAÇÃO DAS EXECUÇÕES (idempotente) ─────────────────────────────────────
// Roda ao abrir a Central: cria o que falta para a data e nunca duplica, porque
// o banco tem chave única em (agenda_id, data_referencia, previsto_para).
export async function gerarExecucoesDoDia(unidadeId, iso = hojeISO()) {
  if (!isSupabaseReady() || !unidadeId) return { criadas: 0 };
  const [{ data: agendas }, { data: processos }] = await Promise.all([
    fetchAgendas(unidadeId),
    fetchProcessos(unidadeId),
  ]);
  const previstas = execucoesPrevistas(agendas, iso, { processos });
  if (!previstas.length) return { criadas: 0 };

  // Conta itens do processo para mostrar progresso desde o começo.
  const { data: itens } = await supabase.from("op_itens").select("id, processo_id")
    .in("processo_id", [...new Set(previstas.map(p => p.processo_id))]);
  const totalPorProcesso = {};
  (itens || []).forEach(i => { totalPorProcesso[i.processo_id] = (totalPorProcesso[i.processo_id] || 0) + 1; });

  const registros = previstas.map(p => ({ ...p, total_itens: totalPorProcesso[p.processo_id] || 0 }));
  const { data, error } = await supabase.from("op_execucoes")
    .upsert(registros, { onConflict: "agenda_id,data_referencia,previsto_para", ignoreDuplicates: true })
    .select("id");
  if (error) return { criadas: 0, error: err(error) };
  return { criadas: (data || []).length };
}

// ── EXECUÇÕES ───────────────────────────────────────────────────────────────
export async function fetchExecucoes(unidadeId, { data: iso = hojeISO(), responsavelId = null } = {}) {
  if (!isSupabaseReady() || !unidadeId) return { data: [] };
  let q = supabase.from("op_execucoes")
    .select("*, processo:op_processos(nome, setor, categoria, criticidade)")
    .eq("unidade_id", String(unidadeId)).eq("data_referencia", iso);
  if (responsavelId) q = q.eq("responsavel_id", responsavelId);
  const { data, error } = await q.order("previsto_para");
  // Status é recalculado aqui: o frontend não decide o que é atraso.
  const agora = new Date();
  return { data: (data || []).map(e => ({ ...e, status: statusDaExecucao(e, agora) })), error: err(error) };
}

// Execuções de um intervalo, para os rankings.
//
// O status é recalculado aqui também, e é justamente no passado que isso
// importa: ATRASADA nunca é gravada no banco — ela nasce da comparação do
// prazo com o relógio. Uma rotina de semana passada que ninguém concluiu está
// gravada como AGENDADA, e sem recalcular o ranking a contaria como "ainda vai
// acontecer" em vez do atraso que foi. Os status terminais (concluída,
// cancelada) passam intactos, então o que já aconteceu não é reescrito.
//
// O teto de 5000 linhas existe para uma unidade com muitos processos não puxar
// o histórico inteiro sem querer. O retorno diz quando bateu no teto, para a
// tela avisar em vez de mostrar meio período como se fosse o todo.
export async function fetchExecucoesPeriodo(unidadeId, { de, ate } = {}) {
  if (!isSupabaseReady() || !unidadeId || !de || !ate) return { data: [] };
  const TETO = 5000;
  const { data, error } = await supabase.from("op_execucoes")
    .select("*, processo:op_processos(nome, setor, categoria, criticidade)")
    .eq("unidade_id", String(unidadeId))
    .gte("data_referencia", de)
    .lte("data_referencia", ate)
    .order("data_referencia")
    .limit(TETO);
  if (error) return { data: [], error: err(error) };
  const agora = new Date();
  return {
    data: (data || []).map(e => ({ ...e, status: statusDaExecucao(e, agora) })),
    truncado: (data || []).length >= TETO,
  };
}

export async function fetchExecucao(execucaoId) {
  if (!isSupabaseReady() || !execucaoId) return { data: null };
  const { data, error } = await supabase.from("op_execucoes")
    .select("*, processo:op_processos(*)").eq("id", execucaoId).single();
  if (error) return { data: null, error: err(error) };
  const [{ data: respostas }, { data: evidencias }] = await Promise.all([
    supabase.from("op_respostas").select("*").eq("execucao_id", execucaoId),
    supabase.from("op_evidencias").select("*").eq("execucao_id", execucaoId),
  ]);
  return { data: { ...data, status: statusDaExecucao(data), respostas: respostas || [], evidencias: evidencias || [] } };
}

export async function iniciarExecucao(execucaoId, usuario) {
  if (!isSupabaseReady()) return { error: "Offline" };
  const { error } = await supabase.from("op_execucoes").update({
    status: "EM_ANDAMENTO",
    iniciado_em: new Date().toISOString(),
    responsavel_id: usuario?.id || null,
    responsavel_nome: usuario?.nome || null,
  }).eq("id", execucaoId);
  await registrarAuditoria({ entidade: "execucao", entidadeId: execucaoId, acao: "iniciou", usuario: usuario?.nome });
  return { error: err(error) };
}

// Grava a resposta e já decide se é conforme. Reprovou item com ação
// configurada? Abre a não conformidade na hora.
export async function responderItem({ execucao, item, valor, valorNumero, comentario, naoAplica = false, usuario }) {
  if (!isSupabaseReady()) return { error: "Offline" };
  const conforme = respostaConforme(item, { valor, valor_numero: valorNumero, nao_aplica: naoAplica });

  const { error } = await supabase.from("op_respostas").upsert({
    execucao_id: execucao.id,
    item_id: item.id,
    valor: valor == null ? null : String(valor),
    valor_numero: Number.isFinite(Number(valorNumero)) ? Number(valorNumero) : null,
    conforme,
    nao_aplica: naoAplica,
    comentario: comentario || null,
    respondido_por: usuario?.nome || null,
    respondido_em: new Date().toISOString(),
  }, { onConflict: "execucao_id,item_id" });
  if (error) return { error: err(error) };

  if (conforme === false && item.acao_reprovar !== "nenhuma") {
    await abrirNaoConformidade({
      unidadeId: execucao.unidade_id,
      processoId: execucao.processo_id,
      execucaoId: execucao.id,
      itemId: item.id,
      setor: execucao.processo?.setor,
      titulo: `${item.titulo} — fora do padrão`,
      descricao: [
        item.instrucao,
        valorNumero != null ? `Valor registrado: ${valorNumero}${item.unidade_medida || ""}` : `Resposta: ${valor}`,
        item.valor_min != null || item.valor_max != null
          ? `Padrão esperado: ${item.valor_min ?? "—"} a ${item.valor_max ?? "—"}${item.unidade_medida || ""}` : "",
        comentario ? `Observação: ${comentario}` : "",
      ].filter(Boolean).join("\n"),
      criticidade: item.critico ? "critica" : "normal",
      abertaPor: usuario?.nome,
    });
  }
  return { error: null, conforme };
}

// Fecha a execução conferindo as regras do processo.
export async function concluirExecucao({ execucao, itens, respostas, usuario, justificativa }) {
  if (!isSupabaseReady()) return { error: "Offline" };
  const porItem = Object.fromEntries((respostas || []).map(r => [r.item_id, r]));

  if (execucao.processo?.exige_todos_obrigatorios !== false) {
    const faltando = (itens || []).filter(i => i.obrigatorio && !porItem[i.id]);
    if (faltando.length && !justificativa) {
      return { error: `Faltam ${faltando.length} item(ns) obrigatório(s): ${faltando.slice(0, 3).map(i => i.titulo).join(", ")}.` };
    }
  }
  const criticosReprovados = (itens || []).filter(i => i.critico && porItem[i.id]?.conforme === false);
  if (criticosReprovados.length && execucao.processo?.permite_concluir_com_nc === false) {
    return { error: "Há item crítico reprovado. Corrija antes de concluir." };
  }

  const agora = new Date();
  const noPrazo = concluiuNoPrazo(execucao, agora);
  const conformes = (respostas || []).filter(r => r.conforme === true).length;
  const naoConformes = (respostas || []).filter(r => r.conforme === false).length;

  const { error } = await supabase.from("op_execucoes").update({
    status: noPrazo ? "CONCLUIDA" : "CONCLUIDA_COM_ATRASO",
    concluido_em: agora.toISOString(),
    itens_respondidos: (respostas || []).length,
    itens_conformes: conformes,
    itens_nao_conformes: naoConformes,
    observacoes: justificativa || null,
  }).eq("id", execucao.id);
  if (error) return { error: err(error) };

  if (!noPrazo) {
    await criarAlerta({
      unidadeId: execucao.unidade_id, tipo: "atencao",
      titulo: `${execucao.processo?.nome || "Processo"} concluído com atraso`,
      descricao: `Prazo era ${new Date(execucao.prazo_ate).toLocaleString("pt-BR")}.`,
      execucaoId: execucao.id,
      chaveDedupe: `atraso:${execucao.id}`,
    });
  }
  await registrarAuditoria({ entidade: "execucao", entidadeId: execucao.id, acao: "concluiu", usuario: usuario?.nome });
  return { error: null, noPrazo, naoConformes };
}

// ── NÃO CONFORMIDADES ───────────────────────────────────────────────────────
export async function abrirNaoConformidade(nc) {
  if (!isSupabaseReady()) return { error: "Offline" };
  const registro = {
    unidade_id: String(nc.unidadeId),
    origem: nc.origem || "execucao",
    processo_id: nc.processoId || null,
    execucao_id: nc.execucaoId || null,
    item_id: nc.itemId || null,
    setor: nc.setor || null,
    titulo: nc.titulo,
    descricao: nc.descricao || null,
    criticidade: nc.criticidade || "normal",
    responsavel_id: nc.responsavelId || null,
    responsavel_nome: nc.responsavelNome || null,
    prazo: nc.prazo || null,
    aberta_por: nc.abertaPor || null,
  };
  const { data, error } = await supabase.from("op_nao_conformidades").insert([registro]).select("id").single();
  if (!error && data?.id) {
    await criarAlerta({
      unidadeId: registro.unidade_id,
      tipo: registro.criticidade === "critica" ? "critico" : "atencao",
      titulo: `Não conformidade: ${registro.titulo}`,
      descricao: registro.descricao,
      naoConformidadeId: data.id,
      chaveDedupe: `nc:${data.id}`,
    });
  }
  return { id: data?.id, error: err(error) };
}

export async function fetchNaoConformidades(unidadeId, { status = "" } = {}) {
  if (!isSupabaseReady() || !unidadeId) return { data: [] };
  let q = supabase.from("op_nao_conformidades").select("*").eq("unidade_id", String(unidadeId));
  if (status) q = q.eq("status", status);
  const { data, error } = await q.order("created_at", { ascending: false }).limit(300);
  return { data: data || [], error: err(error) };
}

export async function atualizarNaoConformidade(id, campos, usuario) {
  if (!isSupabaseReady()) return { error: "Offline" };
  if (campos.status === "RESOLVIDA") campos.resolvida_em = new Date().toISOString();
  const { error } = await supabase.from("op_nao_conformidades").update(campos).eq("id", id);
  await registrarAuditoria({ entidade: "nao_conformidade", entidadeId: id, acao: "atualizou", usuario: usuario?.nome, dadosDepois: campos });
  return { error: err(error) };
}

// ── AÇÕES CORRETIVAS ────────────────────────────────────────────────────────
export async function fetchAcoesCorretivas(ncId) {
  if (!isSupabaseReady() || !ncId) return { data: [] };
  const { data, error } = await supabase.from("op_acoes_corretivas")
    .select("*").eq("nao_conformidade_id", ncId).order("created_at");
  return { data: data || [], error: err(error) };
}

export async function salvarAcaoCorretiva(acao) {
  if (!isSupabaseReady()) return { error: "Offline" };
  const { id, ...campos } = acao;
  if (campos.status === "CONCLUIDA") campos.concluida_em = new Date().toISOString();
  if (id) {
    const { error } = await supabase.from("op_acoes_corretivas").update(campos).eq("id", id);
    return { error: err(error) };
  }
  const { data, error } = await supabase.from("op_acoes_corretivas").insert([campos]).select("id").single();
  return { id: data?.id, error: err(error) };
}

// ── ALERTAS (com deduplicação) ──────────────────────────────────────────────
export async function criarAlerta({ unidadeId, tipo = "atencao", titulo, descricao, execucaoId, naoConformidadeId, destinatario, chaveDedupe }) {
  if (!isSupabaseReady()) return { error: null };
  // A chave única no banco impede o mesmo aviso duas vezes.
  const { error } = await supabase.from("op_alertas").upsert({
    unidade_id: String(unidadeId), tipo, titulo,
    descricao: descricao || null,
    execucao_id: execucaoId || null,
    nao_conformidade_id: naoConformidadeId || null,
    destinatario: destinatario || null,
    chave_dedupe: chaveDedupe || `${titulo}:${Date.now()}`,
  }, { onConflict: "chave_dedupe", ignoreDuplicates: true });
  return { error: err(error) };
}

export async function fetchAlertas(unidadeId, { apenasNaoLidos = false } = {}) {
  if (!isSupabaseReady() || !unidadeId) return { data: [] };
  let q = supabase.from("op_alertas").select("*").eq("unidade_id", String(unidadeId));
  if (apenasNaoLidos) q = q.eq("lido", false);
  const { data, error } = await q.order("created_at", { ascending: false }).limit(100);
  return { data: data || [], error: err(error) };
}

// ── AUDITORIA ───────────────────────────────────────────────────────────────
export async function registrarAuditoria({ unidadeId, entidade, entidadeId, acao, usuario, dadosAntes, dadosDepois, motivo }) {
  if (!isSupabaseReady()) return;
  try {
    await supabase.from("op_auditoria").insert([{
      unidade_id: String(unidadeId || ""),
      entidade, entidade_id: entidadeId || null, acao,
      usuario: usuario || null,
      dados_antes: dadosAntes || null,
      dados_depois: dadosDepois || null,
      motivo: motivo || null,
    }]);
  } catch { /* auditoria nunca derruba a operação */ }
}
