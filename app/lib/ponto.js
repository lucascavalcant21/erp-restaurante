import { supabase, isSupabaseReady } from "./supabase";
import { registrarMarcacao } from "./ponto-marcacao";
import { entradaContratada, minutosAteOTurno } from "./jornada-calculo.mjs";

// Data local (São Paulo) em YYYY-MM-DD, com deslocamento opcional de dias
function dataLocalISO(offsetDias = 0) {
  const d = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  d.setDate(d.getDate() + offsetDias);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

// Jornada da VÉSPERA ainda aberta (turno que virou a meia-noite): tem entrada,
// não tem saída, e a entrada foi há menos de 20h (não confunde com dia esquecido).
function jornadaAbertaDeOntem(reg) {
  if (!reg || !reg.hora_entrada || reg.hora_saida) return false;
  return (Date.now() - new Date(reg.hora_entrada).getTime()) < 20 * 3600000;
}

export async function fetchPontoHoje(unidadeId) {
  if (!isSupabaseReady()) return { data: [] };
  const hoje = dataLocalISO(0);
  const ontem = dataLocalISO(-1);

  // Busca hoje E ontem: quem trabalha até depois da meia-noite continua na
  // jornada de ontem (sem isso, à 00h o sistema pedia ENTRADA de novo e a
  // saída ficava sem registro).
  const { data, error } = await supabase
    .from("registro_ponto")
    .select("*")
    .eq("unidade_id", unidadeId)
    .in("data_referencia", [hoje, ontem])
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Erro ao buscar pontos:", error);
    return { data: [] };
  }

  // Um registro por colaborador: o de HOJE vence; sem hoje, vale o de ontem
  // apenas se a jornada ainda estiver aberta (madrugada do turno noturno).
  const porColab = {};
  (data || []).forEach(r => {
    const atual = porColab[r.colaborador_id];
    if (r.data_referencia === hoje) {
      if (!atual || atual.data_referencia !== hoje) porColab[r.colaborador_id] = r;
    } else if (!atual && jornadaAbertaDeOntem(r)) {
      porColab[r.colaborador_id] = r;
    }
  });
  return { data: Object.values(porColab) };
}

export async function fetchHistoricoPonto(colaboradorId) {
  if (!isSupabaseReady()) return { data: [] };
  
  const { data, error } = await supabase
    .from("registro_ponto")
    .select("*")
    .eq("colaborador_id", colaboradorId)
    .order("data_referencia", { ascending: false })
    .limit(7);
    
  if (error) {
    console.error("Erro ao buscar histórico:", error);
    return { data: [] };
  }
  return { data };
}

export async function fetchHistoricoPontoCompleto(colaboradorId, limite = 365) {
  if (!isSupabaseReady() || !colaboradorId) return { data: [] };
  const { data, error } = await supabase
    .from("registro_ponto")
    .select("*")
    .eq("colaborador_id", colaboradorId)
    .order("data_referencia", { ascending: false })
    .limit(limite);
  return { data: data || [], error: error?.message };
}

export async function fetchPontosMes(colaboradorId, anoMes) {
  if (!isSupabaseReady()) return { data: [] };
  
  // anoMes ex: '2026-06'
  const ano = parseInt(anoMes.split('-')[0]);
  const mes = parseInt(anoMes.split('-')[1]);
  const ultimoDia = new Date(ano, mes, 0).getDate();
  
  const start = `${anoMes}-01`;
  const end = `${anoMes}-${ultimoDia.toString().padStart(2, '0')}`;
  
  const { data, error } = await supabase
    .from("registro_ponto")
    .select("*")
    .eq("colaborador_id", colaboradorId)
    .gte("data_referencia", start)
    .lte("data_referencia", end)
    .order("data_referencia", { ascending: true });
    
  if (error) {
    console.error("Erro ao buscar pontos do mês:", error);
    return { data: [] };
  }
  return { data };
}

// Pontos do mês da UNIDADE inteira (uma query só — usado no salário previsto do RH)
export async function fetchPontosMesUnidade(unidadeId, anoMes) {
  if (!isSupabaseReady() || !unidadeId || unidadeId === "todas") return { data: [] };
  const ano = parseInt(anoMes.split('-')[0]);
  const mes = parseInt(anoMes.split('-')[1]);
  const ultimoDia = new Date(ano, mes, 0).getDate();
  const { data, error } = await supabase
    .from("registro_ponto")
    .select("colaborador_id, data_referencia, hora_entrada, hora_saida, hora_saida_intervalo, hora_retorno_intervalo")
    .eq("unidade_id", unidadeId)
    .gte("data_referencia", `${anoMes}-01`)
    .lte("data_referencia", `${anoMes}-${ultimoDia.toString().padStart(2, '0')}`);
  return { data: data || [], error: error?.message };
}

// A opção de declarar que NÃO vai tirar o intervalo saiu do sistema.
//
// A CLT art. 71 obriga a CONCESSÃO do intervalo, e o §4º manda pagar como
// extra, com 50%, o período suprimido. Um botão que oferece pular convidava à
// irregularidade e ainda deixava gravado que a casa ofereceu — prova pronta
// contra ela mesma. Quem precisar encurtar bate a volta antes e justifica:
// assim é exceção registrada, não rotina oferecida.

// horaMarcada (ISO, opcional): hora AJUSTADA pela tolerância (Súmula 366 TST) —
// ex.: bateu 15:39 com turno 15:40 => grava 15:40. Sem ela, usa a hora real.
export async function registrarBatida(colaboradorId, unidadeId, tipoBatida, horaMarcada = null, dadosGPS = null) {
  if (!isSupabaseReady()) return { error: "Offline" };
  const hoje = dataLocalISO(0);
  const ontem = dataLocalISO(-1);
  const agora = horaMarcada || new Date().toISOString();

  // Entrada antes da hora do turno não entra. O livro de marcações guarda a
  // hora REAL (art. 74, II proíbe horário predeterminado) e registro_ponto
  // segue o livro, então não dá para "arredondar" 15:39 para 15:40 na
  // gravação: o jeito honesto é a pessoa esperar o minuto e bater 15:40.
  //
  // Falha na consulta não tranca o ponto de ninguém: sem o horário, libera.
  if (tipoBatida === "entrada" && !horaMarcada) {
    const { data: colab } = await supabase
      .from("colaboradores")
      .select("horario_entrada, horario_dom_entrada, horario_por_dia, horarios_dia")
      .eq("id", colaboradorId)
      .maybeSingle();
    const agoraLocal = new Date();
    // Quem tem jornada por dia da semana comeca em hora diferente a cada dia.
    // Comparar com o horario fixo travaria a pessoa no dia errado.
    const inicio = entradaContratada(colab, agoraLocal);
    const falta = minutosAteOTurno(inicio, agoraLocal);
    if (falta > 0) {
      return {
        error: `Seu turno começa às ${inicio}. Faltam ${falta} ${falta === 1 ? "minuto" : "minutos"} — bata a entrada a partir desse horário.`,
      };
    }
  }

  // Busca o registro de hoje E o de ontem (turno noturno que virou a madrugada)
  let { data: registros, error: err } = await supabase
    .from("registro_ponto")
    .select("*")
    .eq("colaborador_id", colaboradorId)
    .in("data_referencia", [hoje, ontem])
    .order("data_referencia", { ascending: false });

  const regHoje = (registros || []).find(r => r.data_referencia === hoje) || null;
  const regOntem = (registros || []).find(r => r.data_referencia === ontem) || null;

  // Sem registro hoje mas com a jornada de ONTEM aberta: as batidas continuam
  // nela (a saída depois da meia-noite fecha o dia de ontem, não abre um novo).
  let registro = regHoje;
  if (!registro && jornadaAbertaDeOntem(regOntem)) {
    if (tipoBatida === "entrada") {
      return { error: "A jornada de ontem ainda está aberta — bata a SAÍDA DO TRABALHO para encerrá-la antes de iniciar um novo dia." };
    }
    registro = regOntem;
  }
    
  let updates = {};
  let novoStatus = 0;
  
  if (tipoBatida === 'entrada') {
    updates = { hora_entrada: agora, status_jornada: 1 };
    novoStatus = 1;
  } else if (tipoBatida === 'saida_intervalo') {
    updates = { hora_saida_intervalo: agora, status_jornada: 2 };
    novoStatus = 2;
  } else if (tipoBatida === 'retorno_intervalo') {
    updates = { hora_retorno_intervalo: agora, status_jornada: 3 };
    novoStatus = 3;
  } else if (tipoBatida === 'saida_trabalho') {
    updates = { hora_saida: agora, status_jornada: 4 };
    novoStatus = 4;
  }

  // Incorpora coordenadas e validação por GPS se disponíveis
  if (dadosGPS) {
    if (dadosGPS.latitude != null) updates.latitude = dadosGPS.latitude;
    if (dadosGPS.longitude != null) updates.longitude = dadosGPS.longitude;
    if (dadosGPS.distanciaMetros != null) updates.distancia_metros = dadosGPS.distanciaMetros;
    if (dadosGPS.valido != null) updates.validado_gps = dadosGPS.valido;
    if (dadosGPS.mensagem) updates.localizacao_texto = dadosGPS.mensagem;

    // As colunas acima guardam UMA localização por dia, sobrescrita a cada
    // batida: no fim do expediente só sobrava a última. Para o RH conferir onde
    // a pessoa estava em cada marcação, toda batida vira uma linha nova no
    // histórico do próprio registro do dia.
    const marca = {
      tipo: tipoBatida,
      em: agora,
      latitude: dadosGPS.latitude ?? null,
      longitude: dadosGPS.longitude ?? null,
      distancia_metros: dadosGPS.distanciaMetros ?? null,
      valido: dadosGPS.valido ?? null,
    };
    const anteriores = Array.isArray(registro?.localizacoes) ? registro.localizacoes : [];
    updates.localizacoes = [...anteriores, marca];
  }

  // Coluna nova ainda não migrada não pode impedir alguém de bater o ponto:
  // grava sem ela e o histórico de localização começa quando o SQL rodar.
  const semColunaNova = (erro) => /localizacoes/i.test(erro?.message || "");

  // O livro de marcações é o registro que vale para a fiscalização: uma linha
  // por batida, com NSR e encadeada por hash. Entra ANTES do resumo do dia,
  // porque é ele que precisa ser inviolável — registro_ponto é derivado.
  //
  // Se falhar, a batida continua: travar o ponto da casa por causa do livro
  // seria pior. Mas o aviso sobe junto para não passar despercebido.
  const dataDaMarcacao = registro?.data_referencia || hoje;
  const marcacao = await registrarMarcacao({
    unidadeId,
    colaboradorId,
    tipo: tipoBatida,
    // Hora só quando ela NÃO é agora (tolerância antiga, importação). No fluxo
    // normal vai vazia e quem carimba é o servidor.
    marcadoEm: horaMarcada || null,
    dataReferencia: dataDaMarcacao,
    origem: "tablet",
    latitude: dadosGPS?.latitude ?? null,
    longitude: dadosGPS?.longitude ?? null,
  });

  // O livro é a fonte da hora: o servidor carimbou, e o resumo do dia segue o
  // livro. Divergir aqui faria o espelho mostrar uma hora e o AFD outra.
  //
  // Tem que vir DEPOIS da marcação: antes, "marcacao" ainda está na zona morta
  // e a leitura estoura — o botão do tablet simplesmente não fazia nada.
  const horaOficial = marcacao.marcadoEm || agora;
  for (const campo of ["hora_entrada", "hora_saida_intervalo", "hora_retorno_intervalo", "hora_saida"]) {
    if (updates[campo]) updates[campo] = horaOficial;
  }

  if (!registro) {
    // Primeira batida do dia (entrada)
    if(tipoBatida !== 'entrada') return { error: "Precisa bater a entrada primeiro." };
    const base = { colaborador_id: colaboradorId, unidade_id: unidadeId, data_referencia: hoje };
    let { data, error } = await supabase
      .from("registro_ponto").insert([{ ...base, ...updates }]).select("id");
    if (error && semColunaNova(error)) {
      const { localizacoes, ...semHistorico } = updates;
      ({ data, error } = await supabase
        .from("registro_ponto").insert([{ ...base, ...semHistorico }]).select("id"));
    }
    return concluir(error, data);
  } else {
    // Atualiza o registro existente
    let { data, error } = await supabase
      .from("registro_ponto").update(updates).eq("id", registro.id).select("id");
    if (error && semColunaNova(error)) {
      const { localizacoes, ...semHistorico } = updates;
      ({ data, error } = await supabase
        .from("registro_ponto").update(semHistorico).eq("id", registro.id).select("id"));
    }
    return concluir(error, data);
  }

  // Confere que a linha foi mesmo gravada.
  //
  // O PostgREST devolve sucesso sem erro quando a RLS barra o UPDATE ou quando
  // nenhuma linha casa: a batida "dava OK" e nada era escrito. Num ponto isso é
  // o pior defeito possível — a pessoa vai embora achando que bateu e o dia
  // fica em branco. Sem o .select(), não há como distinguir os dois casos.
  function concluir(error, linhas) {
    if (!error && (!linhas || linhas.length === 0)) {
      return {
        error: "A batida não foi gravada (o banco não confirmou a escrita). Chame o gerente — não bata de novo antes de conferir.",
        nsr: marcacao.nsr, avisoLegal: marcacao.erro || null,
      };
    }
    return {
      error: error?.message,
      novoStatus,
      nsr: marcacao.nsr,
      hash: marcacao.hash || null,
      marcadoEm: horaOficial,
      avisoLegal: marcacao.erro || null,
    };
  }
}

// Guarda a prova da batida por reconhecimento facial no registro do dia:
// foto pequena para conferência, distância do match e origem. Nunca bloqueia a
// batida — se a auditoria falhar, o ponto já está registrado.
export async function anexarAuditoriaFacial(colaboradorId, { foto, distancia, tipo }) {
  if (!isSupabaseReady() || !colaboradorId) return { error: null };
  try {
    const hoje = dataLocalISO(0);
    const ontem = dataLocalISO(-1);
    const { data: registros } = await supabase
      .from("registro_ponto")
      .select("id, data_referencia, hora_saida")
      .eq("colaborador_id", colaboradorId)
      .in("data_referencia", [hoje, ontem])
      .order("data_referencia", { ascending: false });
    const registro = (registros || [])[0];
    if (!registro) return { error: null };

    const campos = { origem_batida: "facial" };
    if (Number.isFinite(Number(distancia))) campos.face_confianca = Number(distancia);
    if (foto) campos[tipo === "saida" ? "face_foto_saida" : "face_foto_entrada"] = foto;

    await supabase.from("registro_ponto").update(campos).eq("id", registro.id);
    return { error: null };
  } catch {
    return { error: null }; // auditoria é acessória
  }
}

// ─── CORREÇÃO DE BATIDA ──────────────────────────────────────────────────────
// Esqueceu de picar, picou na hora errada, tablet fora do ar: a batida precisa
// ser corrigida, e ATÉ AGORA não havia como fazer isso pelo sistema — só
// mexendo no banco à mão, o que quebraria o encadeamento por hash.
//
// Corrigir aqui NÃO reescreve a marcação original. Entra uma marcação do tipo
// 'ajuste' guardando o valor anterior, quem corrigiu e o motivo — que é o que a
// Portaria MTP 671/2021 manda. Depois disso o resumo do dia (registro_ponto),
// que é o que as telas leem, recebe a hora nova.

export const CAMPO_POR_TIPO = {
  entrada: "hora_entrada",
  saida_intervalo: "hora_saida_intervalo",
  retorno_intervalo: "hora_retorno_intervalo",
  saida_trabalho: "hora_saida",
};

export async function corrigirBatida({
  unidadeId, colaboradorId, dataReferencia, tipo, novaHoraISO, registradoPor, motivo,
}) {
  if (!isSupabaseReady()) return { error: "Sistema sem conexão com o banco." };
  const campo = CAMPO_POR_TIPO[tipo];
  if (!campo) return { error: "Tipo de batida inválido." };
  if (!unidadeId || !colaboradorId || !dataReferencia) return { error: "Faltam dados da correção." };
  if (!novaHoraISO) return { error: "Informe o horário corrigido." };
  if (!String(registradoPor || "").trim()) return { error: "Informe quem está corrigindo." };

  const { data: registro, error: erroLeitura } = await supabase
    .from("registro_ponto")
    .select(`id, ${campo}`)
    .eq("colaborador_id", colaboradorId)
    .eq("data_referencia", dataReferencia)
    .maybeSingle();
  if (erroLeitura) return { error: erroLeitura.message };

  const valorAnterior = registro ? registro[campo] : null;

  // Livro legal PRIMEIRO. Se ele não gravar, nada mais acontece: resumo
  // corrigido sem marcação correspondente é pior do que correção nenhuma,
  // porque a tela passa a mostrar uma hora que o livro não conhece.
  const marcacao = await registrarMarcacao({
    unidadeId, colaboradorId, dataReferencia,
    tipo: "ajuste",
    tipoAlvo: tipo,
    marcadoEm: novaHoraISO,
    valorAnterior,
    origem: "ajuste",
    registradoPor,
    motivo: String(motivo || "").trim() || null,
  });
  if (marcacao?.erro) {
    return {
      error: marcacao.semTabela
        ? "O livro de marcações não existe neste banco. Rode db/migracao_ponto_nsr.sql antes de corrigir batidas."
        : `Não consegui gravar a correção no livro de marcações: ${marcacao.erro}`,
    };
  }

  // Agora o resumo do dia, que é o que as telas mostram.
  if (registro) {
    const { error } = await supabase.from("registro_ponto")
      .update({ [campo]: novaHoraISO }).eq("id", registro.id);
    if (error) return { error: `Correção registrada no livro, mas o resumo do dia não aceitou: ${error.message}` };
  } else {
    // Dia sem registro nenhum: a pessoa não bateu nada. A correção cria a linha.
    const { error } = await supabase.from("registro_ponto").insert([{
      colaborador_id: colaboradorId, unidade_id: unidadeId,
      data_referencia: dataReferencia, [campo]: novaHoraISO,
    }]);
    if (error) return { error: `Correção registrada no livro, mas não consegui criar o dia: ${error.message}` };
  }

  return { error: null, nsr: marcacao?.nsr ?? null, valorAnterior };
}
