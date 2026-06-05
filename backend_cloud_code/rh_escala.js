// =============================================================================
// FOODERP -- rh_escala.js
// Agente de IA para gerenciamento de RH e escala de trabalho.
//
// Responsabilidades:
//   - Registrar faltas e atestados em tempo real
//   - Encontrar automaticamente o substituto mais adequado
//   - Recalcular a escala da semana sem conflitos
//   - Notificar o gerente e o substituto
//   - Chamar a Anthropic API (Claude) para decisoes complexas
// =============================================================================

"use strict";

const db = require("./banco_de_dados");

// ---------------------------------------------------------------------------
// TIPOS de ocorrencia que o Agente gerencia
// ---------------------------------------------------------------------------
const TIPOS_OCORRENCIA = {
  FALTA_JUSTIFICADA:   "falta_justificada",
  FALTA_INJUSTIFICADA: "falta_injustificada",
  ATESTADO_MEDICO:     "atestado_medico",
  FOLGA_EXTRA:         "folga_extra",
  TROCA_TURNO:         "troca_turno",
  FERIAS:              "ferias",
};

// Log em memoria das ocorrencias do dia
const ocorrencias_do_dia = [];

// Utilitario de delay
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// 1. REGISTRAR FALTA
// ---------------------------------------------------------------------------

/**
 * Ponto de entrada principal do Agente de RH.
 * Registra a ocorrencia, localiza um substituto e atualiza a escala.
 */
async function registrarFalta({ funcionario_id, loja_id, data, tipo, motivo = "" }) {
  console.log(`\n[RH-AGENTE] Falta registrada -- funcionario: ${funcionario_id} | data: ${data} | tipo: ${tipo}`);

  const funcionario = db.funcionarios[funcionario_id];
  if (!funcionario) {
    return { sucesso: false, erro: `Funcionario '${funcionario_id}' nao encontrado.` };
  }

  // 1. Registra ocorrencia
  const ocorrencia = {
    id: `ocorr_${Date.now()}`,
    funcionario_id,
    loja_id,
    data,
    tipo,
    motivo,
    timestamp_registro: new Date().toISOString(),
    acoes: [],
  };

  // Marca falta na escala do funcionario
  const diaEscala = funcionario.escala_semana.find((d) => d.data === data);
  if (diaEscala) {
    diaEscala.status = tipo === TIPOS_OCORRENCIA.ATESTADO_MEDICO ? "atestado" : "falta";
  }

  if (tipo === TIPOS_OCORRENCIA.FALTA_INJUSTIFICADA || tipo === TIPOS_OCORRENCIA.FALTA_JUSTIFICADA) {
    funcionario.faltas_mes += 1;
  }
  funcionario.status_hoje = tipo === TIPOS_OCORRENCIA.ATESTADO_MEDICO ? "atestado" : "falta";

  ocorrencia.acoes.push(`Escala de ${funcionario.nome} atualizada para '${funcionario.status_hoje}' em ${data}.`);
  console.log(`[RH-AGENTE] Escala atualizada para ${funcionario.nome}`);

  // 2. Buscar substituto
  const substituto = await encontrarSubstituto({ funcionario, loja_id, data });

  if (substituto) {
    ocorrencia.substituto_id = substituto.id;
    ocorrencia.acoes.push(`Substituto encontrado: ${substituto.nome} (${substituto.cargo}).`);

    const diaSubst = substituto.escala_semana.find((d) => d.data === data);
    if (diaSubst) {
      diaSubst.status = "convocado";
      diaSubst.turno = funcionario.turno;
      diaSubst.obs = `Cobrindo falta de ${funcionario.nome}`;
    } else {
      substituto.escala_semana.push({
        data,
        turno: funcionario.turno,
        status: "convocado",
        obs: `Cobrindo falta de ${funcionario.nome}`,
      });
    }
    console.log(`[RH-AGENTE] Substituto convocado: ${substituto.nome}`);
  } else {
    ocorrencia.acoes.push("Nenhum substituto disponivel encontrado. Gerente notificado manualmente.");
    console.warn(`[RH-AGENTE] Sem substituto para ${data} na ${loja_id}`);
  }

  // 3. Decisao avancada via IA (Claude) -- analise de impacto
  const analise = await analisarImpactoComIA({ funcionario, tipo, data, loja_id, substituto });
  ocorrencia.analise_ia = analise;
  ocorrencia.acoes.push(`Analise IA: ${analise.resumo}`);

  // 4. Notificacoes
  const notificacoes = emitirNotificacoes({ funcionario, substituto, ocorrencia, loja_id });
  ocorrencia.notificacoes = notificacoes;

  ocorrencias_do_dia.push(ocorrencia);

  console.log(`[RH-AGENTE] Ocorrencia processada com ${ocorrencia.acoes.length} acoes.\n`);
  return { sucesso: true, ocorrencia };
}

// ---------------------------------------------------------------------------
// 2. ENCONTRAR SUBSTITUTO
// ---------------------------------------------------------------------------

/**
 * Algoritmo de matching: encontra o melhor substituto disponivel.
 * Criterios (em ordem de prioridade):
 *   1. Mesmo cargo
 *   2. Mesma loja
 *   3. Nao esta trabalhando no mesmo horario
 *   4. Menos horas extras acumuladas no mes
 *   5. Menos faltas no mes (mais confiavel)
 */
async function encontrarSubstituto({ funcionario, loja_id, data }) {
  const candidatos = Object.values(db.funcionarios).filter((f) => {
    if (f.id === funcionario.id) return false;
    if (f.loja_id !== loja_id) return false;
    if (f.cargo !== funcionario.cargo) return false;
    if (f.status_hoje === "falta" || f.status_hoje === "ferias" || f.status_hoje === "atestado") return false;
    const diaF = f.escala_semana.find((d) => d.data === data);
    if (diaF && diaF.status === "presente") return false;
    return true;
  });

  if (candidatos.length === 0) return null;

  candidatos.sort((a, b) => {
    if (a.faltas_mes !== b.faltas_mes) return a.faltas_mes - b.faltas_mes;
    return a.horas_mes - b.horas_mes;
  });

  await sleep(80);
  return candidatos[0];
}

// ---------------------------------------------------------------------------
// 3. ANALISE DE IMPACTO VIA IA (Claude)
// ---------------------------------------------------------------------------

/**
 * Monta um prompt estruturado e "chama" o modelo Claude para analisar o impacto
 * da falta e sugerir acoes preventivas.
 *
 * Em producao: descomente o bloco com fetch() e insira sua ANTHROPIC_API_KEY.
 */
async function analisarImpactoComIA({ funcionario, tipo, data, loja_id, substituto }) {
  const loja = db.lojas[loja_id];
  const alertasEstoque = db.getAlertasEstoque().filter((a) => a.loja_id === loja_id);

  const prompt = `
Voce e o Agente de RH do sistema FoodERP. Analise a ocorrencia abaixo e forneca:
1. Avaliacao de impacto operacional (baixo / medio / alto)
2. Recomendacoes preventivas (max. 3 itens)
3. Se deve alertar o dono da rede

CONTEXTO DA OCORRENCIA:
- Funcionario: ${funcionario.nome} (${funcionario.cargo})
- Tipo: ${tipo}
- Data: ${data}
- Loja: ${loja.nome}
- Faltas do mes: ${funcionario.faltas_mes}
- Substituto encontrado: ${substituto ? substituto.nome : "Nenhum"}
- Alertas de estoque ativos na loja: ${alertasEstoque.length}
- Faturamento do mes: R$ ${loja.faturamento_mes_atual.toLocaleString("pt-BR")}

Responda em JSON com: { impacto, recomendacoes, alertar_dono, resumo }
`.trim();

  // Chamada real a API Anthropic
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": process.env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 512,
          messages: [{ role: "user", content: prompt + "\n\nResponda SOMENTE com JSON valido, sem markdown." }],
        }),
      });
      const respData = await response.json();
      if (respData.content && respData.content[0]) {
        const parsed = JSON.parse(respData.content[0].text);
        parsed.simulado = false;
        return parsed;
      }
    } catch(e) { console.error("[RH-IA] Erro API:", e.message); }
  }

  // Fallback simulado
  await sleep(120);
  const temSubstituto = !!substituto;
  const faltasAltas = funcionario.faltas_mes >= 3;
  const estoqueRisco = alertasEstoque.length > 0;

  const impacto = !temSubstituto || (faltasAltas && estoqueRisco)
    ? "alto"
    : faltasAltas || estoqueRisco
    ? "medio"
    : "baixo";

  const recomendacoes = [];
  if (!temSubstituto) recomendacoes.push("Acionar funcionario de outra loja ou autonomo credenciado.");
  if (faltasAltas) recomendacoes.push(`${funcionario.nome} atingiu ${funcionario.faltas_mes} faltas este mes -- agendar conversa de feedback.`);
  if (estoqueRisco) recomendacoes.push("Revisar estoque critico antes da abertura do turno.");
  if (recomendacoes.length === 0) recomendacoes.push("Operacao dentro do normal. Monitorar turno.");

  return {
    impacto,
    recomendacoes,
    alertar_dono: impacto === "alto",
    resumo: `Impacto ${impacto}. ${recomendacoes[0]}`,
    prompt_enviado: prompt,
    modelo: db.config.integracoes.anthropic_model,
    simulado: true,
  };
}

// ---------------------------------------------------------------------------
// 4. NOTIFICACOES
// ---------------------------------------------------------------------------

function emitirNotificacoes({ funcionario, substituto, ocorrencia, loja_id }) {
  const notifs = [];
  const loja = db.lojas[loja_id];
  const gerente = db.funcionarios[loja.gerente_id];

  // Notifica gerente via painel
  const msgGerente = `${funcionario.nome} (${funcionario.cargo}) registrou ${ocorrencia.tipo.replace(/_/g, " ")} em ${ocorrencia.data}. ${substituto ? `Substituto convocado: ${substituto.nome}.` : "Sem substituto disponivel."}`;

  db.criarNotificacao({
    loja_id,
    tipo: "rh",
    nivel: substituto ? "info" : "atencao",
    titulo: `Falta registrada: ${funcionario.nome}`,
    mensagem: msgGerente,
    acao: substituto ? null : {
      label: "Buscar substituto",
      endpoint: `/api/rh/alertar`,
      payload: { funcionario_id: funcionario.id, loja_id, data: ocorrencia.data, tipo: ocorrencia.tipo },
    },
  });

  notifs.push({
    destinatario: gerente?.nome || "Gerente",
    canal: "whatsapp",
    mensagem: `[FoodERP] ${msgGerente}`,
    enviado_em: new Date().toISOString(),
  });

  // Notifica substituto (se houver)
  if (substituto) {
    notifs.push({
      destinatario: substituto.nome,
      canal: "push_app",
      mensagem: `[FoodERP] Voce foi convocado para cobrir a falta de ${funcionario.nome} em ${ocorrencia.data}. Turno: ${funcionario.turno}. Confirme disponibilidade.`,
      enviado_em: new Date().toISOString(),
    });
  }

  // Alerta dono se impacto alto
  if (ocorrencia.analise_ia && ocorrencia.analise_ia.alertar_dono) {
    db.criarNotificacao({
      loja_id,
      tipo: "rh",
      nivel: "critico",
      titulo: `[URGENTE] Falta sem substituto -- ${loja.nome}`,
      mensagem: `Falta de ${funcionario.cargo} na ${loja.nome} sem substituto disponivel. Intervencao necessaria.`,
      acao: {
        label: "Ver Escala",
        endpoint: `/api/rh/escala?loja_id=${loja_id}`,
        payload: null,
      },
    });
    notifs.push({
      destinatario: "Dono da Rede",
      canal: "email",
      mensagem: `[FoodERP] ALERTA ALTO -- falta de ${funcionario.cargo} na ${loja.nome} sem substituto. Verifique a operacao.`,
      enviado_em: new Date().toISOString(),
    });
  }

  notifs.forEach((n) => {
    console.log(`[NOTIFICACAO] -> ${n.destinatario} via ${n.canal}: ${n.mensagem}`);
  });

  return notifs;
}

// ---------------------------------------------------------------------------
// 5. CONSULTAS DE ESCALA
// ---------------------------------------------------------------------------

function getEscalaPorLoja(loja_id, data_inicio, data_fim) {
  if (!data_inicio) data_inicio = new Date().toISOString().split('T')[0];
  if (!data_fim) {
    const fim = new Date(); fim.setDate(fim.getDate() + 6);
    data_fim = fim.toISOString().split('T')[0];
  }
  const funcionariosLoja = db.getFuncionariosPorLoja(loja_id);
  return funcionariosLoja.map((f) => ({
    funcionario_id: f.id,
    nome: f.nome,
    cargo: f.cargo,
    turno_padrao: f.turno,
    status_hoje: f.status_hoje,
    escala: f.escala_semana.filter((d) => d.data >= data_inicio && d.data <= data_fim),
    escala_completa: f.escala_semana,
  }));
}

function getAusentesHoje(loja_id, data) {
  return db.getFuncionariosPorLoja(loja_id).filter((f) => {
    const dia = f.escala_semana.find((d) => d.data === data);
    return dia && ["falta", "atestado", "ferias"].includes(dia.status);
  });
}

function calcularCMOSemana(loja_id, data_inicio, data_fim) {
  if (!data_inicio) {
    const inicio = new Date(); inicio.setDate(inicio.getDate() - inicio.getDay());
    data_inicio = inicio.toISOString().split('T')[0];
  }
  if (!data_fim) data_fim = new Date().toISOString().split('T')[0];
  const funcionariosLoja = db.getFuncionariosPorLoja(loja_id);
  let total_horas = 0;
  let total_custo = 0;

  funcionariosLoja.forEach((f) => {
    const diasTrabalhados = f.escala_semana.filter(
      (d) => d.data >= data_inicio && d.data <= data_fim && d.status === "presente"
    ).length;
    const horas_dia = f.turno === "integral" ? 11 : 9;
    const horas_semana = diasTrabalhados * horas_dia;
    const custo_hora = (f.salario_base / 176).toFixed(2);
    total_horas += horas_semana;
    total_custo += horas_semana * custo_hora;
  });

  return {
    loja_id,
    periodo: `${data_inicio} a ${data_fim}`,
    total_horas: +total_horas.toFixed(1),
    total_custo: +total_custo.toFixed(2),
    funcionarios: funcionariosLoja.length,
  };
}

// ---------------------------------------------------------------------------
// 6. RH INTELIGENTE -- alertarGerente()
// ---------------------------------------------------------------------------

/**
 * Motor central de RH Inteligente.
 * Ao receber o alerta de falta, este motor:
 *   1. Busca TODOS os candidatos (mesma loja + outras lojas)
 *   2. Calcula score de adequacao para cada candidato
 *   3. Monta ranking com justificativa em linguagem natural
 *   4. Envia notificacao estruturada ao painel do gerente com acao em 1 clique
 */
async function alertarGerente({ funcionario_id, loja_id, data, tipo, motivo = "" }) {
  const funcionario = db.funcionarios[funcionario_id];
  if (!funcionario) return { sucesso: false, erro: "Funcionario nao encontrado." };

  const loja = db.lojas[loja_id];
  const gerente = db.funcionarios[loja.gerente_id];

  // 1. Varredura de candidatos (inclui outras lojas para emergencia)
  const candidatos = Object.values(db.funcionarios)
    .filter((f) => {
      if (f.id === funcionario_id) return false;
      if (f.cargo !== funcionario.cargo) return false;
      if (["falta", "atestado", "ferias"].includes(f.status_hoje)) return false;
      const diaF = f.escala_semana.find((d) => d.data === data);
      if (diaF && diaF.status === "presente") return false;
      return true;
    });

  // 2. Score de adequacao
  //    +40 mesma loja | +30 mesmo turno | -10/falta no mes | -5/10h extras
  const ranking = candidatos
    .map((f) => {
      let score = 0;
      const motivos = [];

      if (f.loja_id === loja_id) {
        score += 40;
        motivos.push("mesma loja (+40)");
      } else {
        motivos.push(`loja ${db.lojas[f.loja_id]?.nome || f.loja_id} (outra loja)`);
      }

      if (f.turno === funcionario.turno) {
        score += 30;
        motivos.push("mesmo turno (+30)");
      }

      if (f.faltas_mes > 0) {
        const penalidade = f.faltas_mes * 10;
        score -= penalidade;
        motivos.push(`${f.faltas_mes} falta(s) no mes (-${penalidade})`);
      }

      const horas_extras = Math.max(0, f.horas_mes - 176);
      if (horas_extras >= 10) {
        const penalidade = Math.floor(horas_extras / 10) * 5;
        score -= penalidade;
        motivos.push(`${horas_extras}h extras (-${penalidade})`);
      }

      const justificativa = motivos.join(" | ");
      return { ...f, score, justificativa };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 5); // top 5

  const melhor = ranking[0] || null;

  // 3. Monta notificacao estruturada para o painel do gerente
  const tituloNotif = melhor
    ? `Substituto sugerido para ${funcionario.nome}: ${melhor.nome}`
    : `Sem substituto disponivel para ${funcionario.nome}`;

  const mensagemNotif = melhor
    ? `${melhor.nome} (${melhor.cargo}) -- Score ${melhor.score} -- ${melhor.justificativa}. Turno a cobrir: ${funcionario.turno} em ${data}.`
    : `Nenhum candidato disponivel com o cargo '${funcionario.cargo}' para a data ${data}. Considere acionar um funcionario autonomo.`;

  const notificacao_gerente = db.criarNotificacao({
    loja_id,
    tipo: "rh_inteligente",
    nivel: melhor ? "info" : "critico",
    titulo: tituloNotif,
    mensagem: mensagemNotif,
    acao: melhor
      ? {
          label: `Convocar ${melhor.nome}`,
          endpoint: `/api/rh/convocar`,
          payload: {
            substituto_id: melhor.id,
            funcionario_id,
            loja_id,
            data,
          },
        }
      : null,
  });

  console.log(`[RH-INTELIGENTE] Ranking gerado: ${ranking.length} candidatos. Melhor: ${melhor?.nome || "nenhum"}`);

  return {
    sucesso: true,
    alerta: {
      funcionario: { id: funcionario.id, nome: funcionario.nome, cargo: funcionario.cargo },
      loja: loja.nome,
      data,
      tipo,
    },
    ranking: ranking.map((f) => ({
      id: f.id,
      nome: f.nome,
      cargo: f.cargo,
      loja_id: f.loja_id,
      turno: f.turno,
      score: f.score,
      justificativa: f.justificativa,
    })),
    melhor_substituto: melhor
      ? { id: melhor.id, nome: melhor.nome, score: melhor.score }
      : null,
    notificacao_gerente,
  };
}

// ---------------------------------------------------------------------------
// 7. CONVOCAR SUBSTITUTO
// ---------------------------------------------------------------------------

/**
 * Confirma a convocacao de um substituto especifico.
 * Atualiza a escala e dispara notificacao push para o colaborador.
 */
async function convocarSubstituto({ substituto_id, funcionario_id, loja_id, data }) {
  const substituto  = db.funcionarios[substituto_id];
  const funcionario = db.funcionarios[funcionario_id];

  if (!substituto)  return { sucesso: false, erro: "Substituto nao encontrado." };
  if (!funcionario) return { sucesso: false, erro: "Funcionario ausente nao encontrado." };

  // Atualiza escala do substituto
  const diaSubst = substituto.escala_semana.find((d) => d.data === data);
  if (diaSubst) {
    diaSubst.status = "convocado";
    diaSubst.turno  = funcionario.turno;
    diaSubst.obs    = `Cobrindo falta de ${funcionario.nome}`;
  } else {
    substituto.escala_semana.push({
      data,
      turno:  funcionario.turno,
      status: "convocado",
      obs:    `Cobrindo falta de ${funcionario.nome}`,
    });
  }

  // Notificacao push para o substituto
  const notificacao = {
    destinatario: substituto.nome,
    canal: "push_app",
    mensagem: `[FoodERP] Voce foi convocado para cobrir a falta de ${funcionario.nome} em ${data}. Turno: ${funcionario.turno}. Confirme sua presenca no app.`,
    enviado_em: new Date().toISOString(),
  };

  // Notificacao no painel do gerente confirmando a convocacao
  db.criarNotificacao({
    loja_id,
    tipo: "rh",
    nivel: "info",
    titulo: `Convocacao confirmada: ${substituto.nome}`,
    mensagem: `${substituto.nome} foi convocado para cobrir ${funcionario.nome} em ${data} (turno: ${funcionario.turno}).`,
    acao: null,
  });

  console.log(`[RH-AGENTE] Substituto convocado manualmente: ${substituto.nome} para cobrir ${funcionario.nome} em ${data}`);

  return {
    sucesso: true,
    substituto: { id: substituto.id, nome: substituto.nome, cargo: substituto.cargo },
    notificacao,
    escala_atualizada: substituto.escala_semana.find((d) => d.data === data),
  };
}

// ---------------------------------------------------------------------------
// EXPORTS
// ---------------------------------------------------------------------------
module.exports = {
  TIPOS_OCORRENCIA,
  registrarFalta,
  alertarGerente,
  convocarSubstituto,
  encontrarSubstituto,
  analisarImpactoComIA,
  getEscalaPorLoja,
  getAusentesHoje,
  calcularCMOSemana,
  ocorrencias_do_dia,
};
