import { supabase, isSupabaseReady } from "./supabase";

export async function fetchColaboradores(unidadeId) {
  if (!isSupabaseReady()) return { data: [], error: "Supabase offline" };
  
  let query = supabase.from("colaboradores").select("*").order("nome");
  if (unidadeId && unidadeId !== "matriz") {
    query = query.eq("unidade_id", unidadeId);
  }

  const { data, error } = await query;
  return { data: data || [], error: error?.message };
}

// Remove do payload qualquer coluna que o banco não reconheça e tenta de novo
// (evita quebrar cadastro por falta de migração de colunas novas).
async function colabRetrySemColuna(error, tentar, campos, n = 0) {
  const m = error?.message || "";
  const match = m.match(/column "?([a-z_]+)"? (?:of relation "colaboradores" )?does not exist/i)
    || (m.includes("Could not find") && m.match(/'([a-z_]+)' column/i));
  if (error && match && n < 8 && match[1] in campos) {
    delete campos[match[1]];
    return colabRetrySemColuna(await tentar(), tentar, campos, n + 1);
  }
  return error;
}

export async function inserirColaborador(colab) {
  if (!isSupabaseReady()) return { data: null, error: "Offline" };
  let res = await supabase.from("colaboradores").insert([colab]).select().single();
  let data = res.data;
  const error = await colabRetrySemColuna(res.error, async () => {
    const r = await supabase.from("colaboradores").insert([colab]).select().single(); data = r.data; return r.error;
  }, colab);
  return { data, error: error?.message };
}

export async function removerColaborador(id) {
  if (!isSupabaseReady()) return { error: "Offline" };
  const { error } = await supabase.from("colaboradores").delete().eq("id", id);
  return { error: error?.message };
}

// ─── DESLIGAMENTO (arquivo de ex-funcionários) ───────────────────────────────
// Não apaga: marca como inativo e guarda data/motivo/tipo. A vida (ponto,
// advertências, docs, banco...) fica preservada pelo mesmo id.
export async function desligarColaborador(id, { data_desligamento, motivo_desligamento, tipo_desligamento }) {
  if (!isSupabaseReady()) return { error: "Offline" };
  const { error } = await supabase.from("colaboradores").update({
    status: "inativo",
    data_desligamento: data_desligamento || new Date().toISOString().split("T")[0],
    motivo_desligamento: motivo_desligamento || null,
    tipo_desligamento: tipo_desligamento || null,
  }).eq("id", id);
  return { error: error?.message };
}

export async function reativarColaborador(id) {
  if (!isSupabaseReady()) return { error: "Offline" };
  const { error } = await supabase.from("colaboradores").update({
    status: "ativo", data_desligamento: null, motivo_desligamento: null, tipo_desligamento: null,
  }).eq("id", id);
  return { error: error?.message };
}

// ─── GASTOS ADMINISTRATIVOS (material de escritório, cartões, etc.) ──────────
export async function fetchGastosAdmin(unidadeId, mesAno = null) {
  if (!isSupabaseReady() || !unidadeId || unidadeId === "todas") return { data: [] };
  let q = supabase.from("gastos_administrativos").select("*").eq("unidade_id", unidadeId).order("data", { ascending: false });
  if (mesAno) {
    const [ano, mes] = String(mesAno).split("-").map(Number);
    const fim = new Date(ano, mes, 1).toISOString().split("T")[0];
    q = q.gte("data", `${mesAno}-01`).lt("data", fim);
  }
  const { data, error } = await q;
  return { data: data || [], error: error?.message };
}

export async function salvarGastoAdmin(gasto) {
  if (!isSupabaseReady()) return { error: "Offline" };
  const { id, created_at, ...campos } = gasto;
  if (id) {
    const { error } = await supabase.from("gastos_administrativos").update(campos).eq("id", id);
    return { error: error?.message };
  }
  const { error } = await supabase.from("gastos_administrativos").insert([campos]);
  return { error: error?.message };
}

export async function removerGastoAdmin(id) {
  if (!isSupabaseReady()) return { error: "Offline" };
  const { error } = await supabase.from("gastos_administrativos").delete().eq("id", id);
  return { error: error?.message };
}

// Upload de Documentos para o Storage
export async function fetchDocumentos(colabId) {
  if (!isSupabaseReady()) return { data: [] };
  const { data } = await supabase.from("documentos_rh").select("*").eq("colaborador_id", colabId);
  return { data: data || [] };
}

export async function uploadDocumentoRH(colabId, arquivo) {
  if (!isSupabaseReady()) return { error: "Offline" };

  const extensao = arquivo.name.split('.').pop();
  const nomeSeguro = `${Date.now()}-${Math.random().toString(36).substring(7)}.${extensao}`;
  const caminho = `${colabId}/${nomeSeguro}`;

  // 1. Tenta fazer o upload para o bucket 'rh-docs'
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('rh-docs')
    .upload(caminho, arquivo, { cacheControl: '3600', upsert: false });

  if (uploadError) {
    if (uploadError.message.includes("Bucket not found")) {
      return { error: "Por favor, crie um Bucket público chamado 'rh-docs' no seu painel do Supabase (Storage) antes de fazer uploads." };
    }
    return { error: `Erro no upload: ${uploadError.message}` };
  }

  // 2. Pega a URL pública
  const { data: publicUrlData } = supabase.storage.from('rh-docs').getPublicUrl(caminho);
  const urlPublica = publicUrlData?.publicUrl || "";

  // 3. Salva no banco de dados (tabela documentos_rh)
  const { data: docSalvo, error: bdError } = await supabase.from("documentos_rh").insert([{
    colaborador_id: colabId,
    nome_arquivo: arquivo.name,
    tipo: extensao.toUpperCase(), // PDF, JPG, etc
    url_arquivo: urlPublica
  }]).select().single();

  return { data: docSalvo, error: bdError?.message };
}

export async function removerDocumento(docId, url_arquivo) {
  if (!isSupabaseReady()) return { error: "Offline" };
  // 1. Remove do Storage
  if (url_arquivo) {
    try {
      const parts = url_arquivo.split('/rh-docs/');
      if (parts.length === 2) {
         const caminho = parts[1];
         await supabase.storage.from('rh-docs').remove([caminho]);
      }
    } catch(e) {}
  }
  // 2. Remove do BD
  const { error } = await supabase.from("documentos_rh").delete().eq("id", docId);
  return { error: error?.message };
}

export async function fetchFuncionarios() { return { data: [], error: null }; }

export const inserirFuncionario = inserirColaborador;
export const removerFuncionario = removerColaborador;
export const atualizarFuncionario = async (id, dados) => {
  if (!isSupabaseReady()) return { data: null, error: "Offline" };
  let res = await supabase.from("colaboradores").update(dados).eq("id", id).select().single();
  let data = res.data;
  const error = await colabRetrySemColuna(res.error, async () => {
    const r = await supabase.from("colaboradores").update(dados).eq("id", id).select().single(); data = r.data; return r.error;
  }, dados);
  return { data, error: error?.message };
};
export const atualizarColaborador = atualizarFuncionario;

// Escala: grava a ordem e/ou a área do colaborador (arrastar para reordenar e
// mover entre áreas). Se as colunas `ordem_escala`/`area_escala` ainda não
// existirem, o retry as remove (no-op) até rodar a migração.
export async function atualizarEscalaColab(id, campos) {
  if (!isSupabaseReady()) return { error: "Offline" };
  const c = { ...campos };
  let { error } = await supabase.from("colaboradores").update(c).eq("id", id);
  error = await colabRetrySemColuna(error, async () => {
    const r = await supabase.from("colaboradores").update(c).eq("id", id); return r.error;
  }, c);
  return { error: error?.message };
}
export async function atualizarOrdemEscala(id, ordem_escala) {
  return atualizarEscalaColab(id, { ordem_escala });
}

// Escalas salvas (mais recentes primeiro) — para rever/reimprimir dias passados
export async function fetchEscalasDia(unidadeId, limite = 30) {
  if (!isSupabaseReady() || !unidadeId || unidadeId === "todas") return { data: [] };
  const { data, error } = await supabase.from("escalas_dia")
    .select("*").eq("unidade_id", unidadeId)
    .order("data", { ascending: false }).limit(limite);
  return { data: data || [], error: error?.message };
}

// Salva a foto da escala do dia (1 registro por unidade+data; regrava se já existir)
export async function salvarEscalaDia(unidadeId, dataDia, escala) {
  if (!isSupabaseReady()) return { error: "Offline" };
  const { data: exist } = await supabase.from("escalas_dia")
    .select("id").eq("unidade_id", unidadeId).eq("data", dataDia).limit(1);
  if (exist && exist.length) {
    const { error } = await supabase.from("escalas_dia").update({ escala }).eq("id", exist[0].id);
    return { error: error?.message, atualizada: true };
  }
  const { error } = await supabase.from("escalas_dia").insert([{ unidade_id: unidadeId, data: dataDia, escala }]);
  return { error: error?.message };
}

export async function fetchPontoMes(unidadeId, mesAno) { return { data: [], error: null }; }
export async function registrarPonto(dados) { return { data: null, error: null }; }

export const CARGOS_PADRAO_INICIAIS = [
  { id: "cfg-1", nome: "Auxiliar de Cozinha 1", departamento: "Cozinha", nivel: "Auxiliar I", salario_base: 1600, vale_alimentacao: 300, taxa_servico: 200, descricao: "Apoio no pré-preparo, higienização de insumos e organização da praça.", requisitos: ["Sem experiência prévia necessária", "Vontade de aprender e trabalho em equipe", "Pontualidade e cumprimento de higienização"] },
  { id: "cfg-2", nome: "Auxiliar de Cozinha 2", departamento: "Cozinha", nivel: "Auxiliar II", salario_base: 1800, vale_alimentacao: 300, taxa_servico: 250, descricao: "Pré-preparo avançado, corte de insumos, porcionamento e montagem de base.", requisitos: ["3 meses como Auxiliar I ou equivalente", "Domínio de cortes básicos de vegetais e carnes", "Cumprimento de 90%+ dos checklists diários"] },
  { id: "cfg-3", nome: "Auxiliar de Cozinha 3", departamento: "Cozinha", nivel: "Auxiliar III", salario_base: 2000, vale_alimentacao: 300, taxa_servico: 300, descricao: "Auxílio direto à chapa/fogão, controle de pré-preparo e reposição de praça.", requisitos: ["6 meses na operação de cozinha", "Agilidade na montagem e reposição de estoque", "Assiduidade exemplar e organização de bancada"] },
  { id: "cfg-4", nome: "Cozinheiro 1", departamento: "Cozinha", nivel: "Cozinheiro I", salario_base: 2200, vale_alimentacao: 350, taxa_servico: 400, descricao: "Execução de pratos quentes/frios do cardápio, controle de tempo e porções.", requisitos: ["Domínio de fichas técnicas da praça quente/fria", "Conhecimento em boas práticas ANVISA", "Agilidade em horários de pico do salão"] },
  { id: "cfg-5", nome: "Cozinheiro 2", departamento: "Cozinha", nivel: "Cozinheiro II", salario_base: 2600, vale_alimentacao: 350, taxa_servico: 500, descricao: "Preparo de pratos complexos, controle de desperdício e auxílio no ritmo do passe.", requisitos: ["1 ano como Cozinheiro I ou equivalente", "Controle rigoroso de CMV e desperdício de insumos", "Habilidade de orientar auxiliares no turno"] },
  { id: "cfg-6", nome: "Cozinheiro 3", departamento: "Cozinha", nivel: "Cozinheiro III", salario_base: 3100, vale_alimentacao: 400, taxa_servico: 600, descricao: "Especialista de praça, padronização de fichas técnicas e liderança de turno.", requisitos: ["Liderança de praça e passe em alta demanda", "Abertura e fechamento completo de cozinha", "Treinamento e mentoria de novos funcionários"] },
  { id: "cfg-7", nome: "Chef de Cozinha", departamento: "Cozinha", nivel: "Liderança", salario_base: 4500, vale_alimentacao: 500, taxa_servico: 1000, descricao: "Gestão completa da cozinha, criação de pratos, controle de CMV e liderança da brigada.", requisitos: ["Experiência comprovada em gestão de brigada", "Elaboração e controle de custos / Fichas técnicas", "Gestão de escalas, compras e metas de CMV"] },
  { id: "cfg-8", nome: "Steward", departamento: "Cozinha", nivel: "Operacional", salario_base: 1550, vale_alimentacao: 300, taxa_servico: 150, descricao: "Higienização de louças, utensílios, equipamentos pesados e organização da cozinha.", requisitos: ["Cuidados com produtos de limpeza industrial", "Agilidade na devolução de pratos limpos ao passe", "Zelo e conservação dos utensílios da casa"] },
  { id: "cfg-9", nome: "Bartender / Barman", departamento: "Bar", nivel: "Operacional", salario_base: 2400, vale_alimentacao: 350, taxa_servico: 500, descricao: "Preparo de drinks clássicos e autorais, atendimento ao balcão e mise en place de bar.", requisitos: ["Domínio de dosagens e coquetelaria da casa", "Atendimento ao cliente no balcão de bar", "Controle de estoque de destilados e xaropes"] },
  { id: "cfg-10", nome: "Chef de Bar", departamento: "Bar", nivel: "Liderança", salario_base: 3500, vale_alimentacao: 400, taxa_servico: 800, descricao: "Gestão da carta de drinks, inventário do bar, treinamento de bartenders e CMV de bebidas.", requisitos: ["Criação e padronização da carta de drinks", "Controle quinzenal de estoque de bebidas", "Liderança e treinamento da equipe de bar"] },
  { id: "cfg-11", nome: "Chef de Fila", departamento: "Salão", nivel: "Supervisão", salario_base: 2500, vale_alimentacao: 350, taxa_servico: 700, descricao: "Supervisão da equipe de garçons, atendimento V.I.P., fluxo de mesas e resolução de chamados.", requisitos: ["Excelência em atendimento ao cliente", "Resolução ágil de reclamações e imprevistos", "Orientação e apoio aos garçons da praça"] },
  { id: "cfg-12", nome: "Compras", departamento: "Administração", nivel: "Administrativo", salario_base: 2800, vale_alimentacao: 400, taxa_servico: 300, descricao: "Cotação de insumos, negociação com fornecedores, pedidos de compra e recebimento.", requisitos: ["Negociação de prazos e preços com fornecedores", "Conferência rigorosa na entrada de notas fiscais", "Controle de giro e estoque mínimo dos setores"] },
  { id: "cfg-13", nome: "Supervisor", departamento: "Gestão", nivel: "Gestão", salario_base: 4000, vale_alimentacao: 500, taxa_servico: 800, descricao: "Supervisão geral da operação (salão/bar/cozinha), alinhamento de rotinas e resultados.", requisitos: ["Supervisão integrada dos setores da operação", "Cumprimento das metas de faturamento e custos", "Feedback e desenvolvimento contínuo da equipe"] },
  { id: "cfg-14", nome: "CEO", departamento: "Diretoria", nivel: "Executivo", salario_base: 8000, vale_alimentacao: 600, taxa_servico: 0, descricao: "Direção estratégica do negócio, planejamento financeiro e expansão da marca.", requisitos: ["Visão estratégica e planejamento financeiro", "Expansão e reputação da marca", "Liderança executiva do restaurante"] }
];

export async function fetchCargos(unidadeId) {
  if (!isSupabaseReady()) return { data: CARGOS_PADRAO_INICIAIS, error: null };
  try {
    let q = supabase.from("rh_cargos").select("*").order("nome");
    if (unidadeId && unidadeId !== "todas") {
      q = q.eq("unidade_id", unidadeId);
    }
    const { data, error } = await q;
    if (error || !data || data.length === 0) {
      return { data: CARGOS_PADRAO_INICIAIS, error: null };
    }
    const nomesExistentes = new Set(data.map(c => (c.nome || "").toLowerCase().trim()));
    const faltantes = CARGOS_PADRAO_INICIAIS.filter(cp => !nomesExistentes.has(cp.nome.toLowerCase().trim()));
    return { data: [...data, ...faltantes], error: null };
  } catch (e) {
    return { data: CARGOS_PADRAO_INICIAIS, error: null };
  }
}

export async function registrarPromocaoColaborador(dados) {
  if (!isSupabaseReady()) return { error: null };
  const payload = {
    colaborador_id: dados.colaborador_id,
    colaborador_nome: dados.colaborador_nome,
    cargo_anterior: dados.cargo_anterior || "Sem cargo",
    cargo_novo: dados.cargo_novo,
    salario_anterior: Number(dados.salario_anterior) || 0,
    salario_novo: Number(dados.salario_novo) || 0,
    vale_alimentacao: Number(dados.vale_alimentacao) || 0,
    taxa_servico: Number(dados.taxa_servico) || 0,
    data_promocao: new Date().toISOString(),
    responsavel: dados.responsavel || "Gestão",
    motivo: dados.motivo || "Evolução no Plano de Carreiras"
  };
  try {
    let { error } = await supabase.from("rh_historico_promocoes").insert([payload]);
    if (error) {
      const { data: colab } = await supabase.from("colaboradores").select("historico_promocoes").eq("id", dados.colaborador_id).single();
      const hist = Array.isArray(colab?.historico_promocoes) ? colab.historico_promocoes : [];
      hist.push(payload);
      await supabase.from("colaboradores").update({ historico_promocoes: hist }).eq("id", dados.colaborador_id);
    }
  } catch (e) {
    console.warn("Fallback histórico promoção:", e);
  }
  return { error: null };
}

export async function fetchHistoricoPromocoes(colaboradorId) {
  if (!isSupabaseReady() || !colaboradorId) return { data: [] };
  try {
    const { data, error } = await supabase.from("rh_historico_promocoes").select("*").eq("colaborador_id", colaboradorId).order("data_promocao", { ascending: false });
    if (!error && data && data.length > 0) return { data };
    
    const { data: colab } = await supabase.from("colaboradores").select("historico_promocoes").eq("id", colaboradorId).single();
    if (colab?.historico_promocoes && Array.isArray(colab.historico_promocoes)) {
      return { data: colab.historico_promocoes };
    }
  } catch (e) {
    console.warn("Erro ao buscar histórico promoção:", e);
  }
  return { data: [] };
}

export async function salvarCargo(cargo, unidadeId) {
  if (!isSupabaseReady()) return { error: "Offline" };
  const { id, created_at, ...campos } = cargo;
  const payload = { ...campos, unidade_id: unidadeId };

  if (id && !String(id).startsWith("cfg-")) {
    let { error } = await supabase.from("rh_cargos").update(payload).eq("id", id);
    error = await colabRetrySemColuna(error, async () => {
      const r = await supabase.from("rh_cargos").update(payload).eq("id", id); return r.error;
    }, payload);
    return { error: error?.message };
  } else {
    let { error } = await supabase.from("rh_cargos").insert([payload]);
    error = await colabRetrySemColuna(error, async () => {
      const r = await supabase.from("rh_cargos").insert([payload]); return r.error;
    }, payload);
    return { error: error?.message };
  }
}

export async function inserirCargo(cargo, unidadeId) {
  return salvarCargo(cargo, unidadeId);
}

export async function atualizarCargo(id, cargo) {
  if (!isSupabaseReady()) return { error: "Offline" };
  const { error } = await supabase.from("rh_cargos").update(cargo).eq("id", id);
  return { error: error?.message };
}

export async function removerCargo(id) {
  if (!isSupabaseReady()) return { error: "Offline" };
  if (String(id).startsWith("cfg-")) return { error: null }; // Mock apenas local
  const { error } = await supabase.from("rh_cargos").delete().eq("id", id);
  return { error: error?.message };
}

// ── Liberação de ponto do EXTRA/FREELANCER por dia ─────────────────────────────
// O gerente libera a diária de um dia; só então o extra pode bater o ponto.
export async function liberarPontoDia(colaboradorId, unidadeId, data, valorDiaria) {
  if (!isSupabaseReady()) return { error: "Offline" };
  const payload = { colaborador_id: colaboradorId, unidade_id: unidadeId, data, valor_diaria: Number(valorDiaria) || 0 };
  const { error } = await supabase.from("rh_ponto_liberado").insert([payload]);
  return { error: error?.message };
}
export async function fetchLiberacoesDia(unidadeId, data) {
  if (!isSupabaseReady()) return { data: [] };
  let q = supabase.from("rh_ponto_liberado").select("*").eq("data", data);
  if (unidadeId && unidadeId !== "todas") q = q.eq("unidade_id", unidadeId);
  const { data: d, error } = await q;
  return { data: d || [], error: error?.message };
}
export async function fetchLiberacoesColab(colaboradorId, limite = 90) {
  if (!isSupabaseReady()) return { data: [] };
  const { data, error } = await supabase.from("rh_ponto_liberado").select("*").eq("colaborador_id", colaboradorId).order("data", { ascending: false }).limit(limite);
  return { data: data || [], error: error?.message };
}
export async function removerLiberacao(id) {
  if (!isSupabaseReady()) return { error: "Offline" };
  const { error } = await supabase.from("rh_ponto_liberado").delete().eq("id", id);
  return { error: error?.message };
}

// Recibos emitidos para profissionais extras. O histórico fica vinculado ao
// cadastro do colaborador e pode ser consultado mesmo depois do pagamento.
export async function salvarReciboPrestacao(recibo) {
  if (!isSupabaseReady()) return { error: "Offline" };
  const { data, error } = await supabase
    .from("rh_recibos_prestacao")
    .insert([recibo])
    .select("*")
    .single();
  return { data, error: error?.message };
}

export async function fetchRecibosPrestacao(colaboradorId) {
  if (!isSupabaseReady() || !colaboradorId) return { data: [] };
  const { data, error } = await supabase
    .from("rh_recibos_prestacao")
    .select("*")
    .eq("colaborador_id", colaboradorId)
    .order("data_trabalho", { ascending: false })
    .order("created_at", { ascending: false });
  return { data: data || [], error: error?.message };
}

// Visão geral do módulo de Extras. Mantém os recibos no mesmo histórico
// individual, mas permite ao RH enxergar todos os acertos da unidade.
export async function fetchRecibosPrestacaoUnidade(unidadeId, limite = 500) {
  if (!isSupabaseReady() || !unidadeId || unidadeId === "todas") return { data: [] };
  const { data, error } = await supabase
    .from("rh_recibos_prestacao")
    .select("*")
    .eq("unidade_id", unidadeId)
    .order("data_trabalho", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limite);
  return { data: data || [], error: error?.message };
}

export async function atualizarPagamentoRecibo(id, pagamentoRealizado, dataPagamento = null) {
  if (!isSupabaseReady()) return { error: "Offline" };
  const { error } = await supabase
    .from("rh_recibos_prestacao")
    .update({
      pagamento_realizado: !!pagamentoRealizado,
      data_pagamento: pagamentoRealizado ? (dataPagamento || new Date().toISOString().slice(0, 10)) : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  return { error: error?.message };
}

export async function anexarFotoReciboAssinado(id, fotoBase64) {
  if (!isSupabaseReady()) return { error: "Offline" };
  const { data: rec } = await supabase.from("rh_recibos_prestacao").select("dados").eq("id", id).maybeSingle();
  const novosDados = { ...(rec?.dados || {}), foto_recibo_assinado: fotoBase64 };
  const { error } = await supabase
    .from("rh_recibos_prestacao")
    .update({
      dados: novosDados,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  return { error: error?.message };
}

export async function fetchRegulamento(unidadeId) {
  if (!isSupabaseReady()) return { data: null, error: "Offline" };
  const { data, error } = await supabase.from("rh_regulamentos").select("*").eq("unidade_id", unidadeId).single();
  // Se não existir, a query .single() pode retornar erro, lidamos com isso:
  if (error && error.code !== 'PGRST116') return { data: null, error: error.message };
  return { data: data || null, error: null };
}

export async function salvarRegulamento(unidadeId, texto, urlPdf) {
  if (!isSupabaseReady()) return { error: "Offline" };
  const { data: existente } = await supabase.from("rh_regulamentos").select("id").eq("unidade_id", unidadeId).single();
  
  if (existente) {
    const payload = {};
    if (texto !== undefined) payload.texto_regulamento = texto;
    if (urlPdf !== undefined) payload.url_pdf = urlPdf;
    const { error } = await supabase.from("rh_regulamentos").update(payload).eq("id", existente.id);
    return { error: error?.message };
  } else {
    const payload = { unidade_id: unidadeId };
    if (texto !== undefined) payload.texto_regulamento = texto;
    if (urlPdf !== undefined) payload.url_pdf = urlPdf;
    const { error } = await supabase.from("rh_regulamentos").insert([payload]);
    return { error: error?.message };
  }
}

export async function uploadRegulamentoPDF(unidadeId, arquivo) {
  if (!isSupabaseReady()) return { error: "Offline" };
  const extensao = arquivo.name.split('.').pop();
  const nomeSeguro = `regulamento-${unidadeId}-${Date.now()}.${extensao}`;
  
  const { error: uploadError } = await supabase.storage.from('rh-docs').upload(nomeSeguro, arquivo, { upsert: true });
  if (uploadError) return { error: uploadError.message };
  
  const { data: publicUrlData } = supabase.storage.from('rh-docs').getPublicUrl(nomeSeguro);
  const urlPublica = publicUrlData?.publicUrl || "";
  
  return salvarRegulamento(unidadeId, undefined, urlPublica);
}

// Os turnos não foram implementados no DB ainda, manter mocks para não quebrar a tela de config
export const fetchTurnos = async () => { return { data: [], error: null }; };
export const inserirTurno = async () => { return { error: null }; };
export const atualizarTurno = async () => { return { error: null }; };
export const removerTurno = async () => { return { error: null }; };
export const inserirCargosPadrao = async () => { return { error: null }; };

export async function fetchAllFolgasDaUnidade(unidadeId) {
  if (!isSupabaseReady()) return { data: [], error: "Offline" };
  const { data, error } = await supabase.from("rh_folgas_esporadicas").select("*").eq("unidade_id", unidadeId);
  return { data: data || [], error: error?.message };
}

export async function fetchFolgasEsporadicas(colaboradorId) {
  if (!isSupabaseReady()) return { data: [], error: "Offline" };
  const { data, error } = await supabase.from("rh_folgas_esporadicas").select("*").eq("colaborador_id", colaboradorId).order("data_folga");
  return { data: data || [], error: error?.message };
}

export async function inserirFolgaEsporadica(unidadeId, colaboradorId, dataFolga, descricao = "") {
  if (!isSupabaseReady()) return { error: "Offline" };
  const { error } = await supabase.from("rh_folgas_esporadicas").insert([{
    unidade_id: unidadeId,
    colaborador_id: colaboradorId,
    data_folga: dataFolga,
    descricao: descricao
  }]);
  return { error: error?.message };
}

export async function removerFolgaEsporadica(id) {
  if (!isSupabaseReady()) return { error: "Offline" };
  const { error } = await supabase.from("rh_folgas_esporadicas").delete().eq("id", id);
  return { error: error?.message };
}

// ─── ATESTADO MÉDICO ─────────────────────────────────────────────────────────
// Falta desconta, atestado não. Antes os dois caíam no mesmo lugar: errava o
// pagamento e ainda deixava a pessoa marcada como faltosa no histórico dela.
// Guarda um PERÍODO, porque atestado de três dias é um documento só — lançar
// três registros soltos faria perder essa ligação.

export async function fetchAtestados(colaboradorId) {
  if (!isSupabaseReady() || !colaboradorId) return { data: [] };
  const { data, error } = await supabase.from("rh_atestados")
    .select("*").eq("colaborador_id", colaboradorId).order("data_inicio", { ascending: false });
  return { data: data || [], error: error?.message };
}

export async function fetchAtestadosUnidade(unidadeId, { desde = null } = {}) {
  if (!isSupabaseReady() || !unidadeId) return { data: [] };
  let q = supabase.from("rh_atestados").select("*").eq("unidade_id", String(unidadeId));
  if (desde) q = q.gte("data_fim", desde);
  const { data, error } = await q.order("data_inicio", { ascending: false });
  return { data: data || [], error: error?.message };
}

export async function salvarAtestado(atestado) {
  if (!isSupabaseReady()) return { error: "Offline" };
  const { id, created_at, ...campos } = atestado;
  // Um dia só continua sendo um período: quem preenche não deveria digitar a
  // mesma data duas vezes.
  const payload = { ...campos, data_fim: campos.data_fim || campos.data_inicio };
  if (id) {
    const { error } = await supabase.from("rh_atestados").update(payload).eq("id", id);
    return { error: error?.message };
  }
  const { data, error } = await supabase.from("rh_atestados").insert([payload]).select("id").single();
  return { id: data?.id, error: error?.message };
}

export async function removerAtestado(id) {
  if (!isSupabaseReady()) return { error: "Offline" };
  const { error } = await supabase.from("rh_atestados").delete().eq("id", id);
  return { error: error?.message };
}

// ─── BANCO DE HORAS (intervalo não tirado) ───────────────────────────────────
// Quando o colaborador não consegue tirar a folga/intervalo de 1h do dia (ou
// tira só parte), os minutos que faltaram acumulam aqui. Limite: 8h (480 min)
// por colaborador por mês.
export const BANCO_LIMITE_MIN = 480;  // 8h no mês
export const BANCO_ALERTA_MIN = 360;  // 6h = 75% -> perto de estourar

export async function fetchBancoHoras(unidadeId, mesAno) {
  if (!isSupabaseReady() || !unidadeId || unidadeId === "todas") return { data: [] };
  const [ano, mes] = String(mesAno).split("-").map(Number);
  const inicio = `${mesAno}-01`;
  const fim = new Date(ano, mes, 1).toISOString().split("T")[0]; // 1º dia do mês seguinte
  const { data, error } = await supabase.from("rh_banco_horas")
    .select("*")
    .eq("unidade_id", unidadeId)
    .gte("data", inicio)
    .lt("data", fim)
    .order("data", { ascending: false });
  return { data: data || [], error: error?.message };
}

// tipo: 'credito' (intervalo não tirado -> soma no banco) | 'excesso'
// (passou do intervalo -> só ocorrência no histórico, não soma no banco)
export async function inserirBancoHoras(unidadeId, colaboradorId, dataDia, minutos, observacao = "", tipo = "credito") {
  if (!isSupabaseReady()) return { error: "Offline" };
  const { error } = await supabase.from("rh_banco_horas").insert([{
    unidade_id: unidadeId,
    colaborador_id: colaboradorId,
    data: dataDia,
    minutos: Number(minutos) || 0,
    observacao: observacao || null,
    tipo,
  }]);
  return { error: error?.message };
}

// Soma só os CRÉDITOS do banco (excessos de intervalo são ocorrências)
export function somaMinutosBanco(lancamentos) {
  return (lancamentos || [])
    .filter(b => b.tipo !== "excesso")
    .reduce((s, b) => s + (Number(b.minutos) || 0), 0);
}

export async function removerBancoHoras(id) {
  if (!isSupabaseReady()) return { error: "Offline" };
  const { error } = await supabase.from("rh_banco_horas").delete().eq("id", id);
  return { error: error?.message };
}

// ─── REMUNERAÇÃO (CLT simplificada) ─────────────────────────────────────────
// Regras da casa: adicional noturno começa às 23:30 (20% sobre a hora normal,
// ref. CLT art. 73); o que passar de 00:00 conta como hora extra (+50%,
// ref. CF art. 7º XVI); dia trabalhado em FERIADO paga adicional de 100%
// (dobro, Lei 605/49 art. 9º). Hora normal = salário ÷ 220 (divisor CLT).
export function calcularAdicionaisMes(pontosMes, salarioBase, feriados = []) {
  const valorHora = (Number(salarioBase) || 0) / 220;
  const feriadosSet = new Set((feriados || []).map(f => f.data || f));
  let minNoturno = 0;   // 23:30 → 00:00
  let minExtra = 0;     // após 00:00
  let minFeriado = 0;   // horas trabalhadas em dia de feriado

  (pontosMes || []).forEach(reg => {
    if (!reg.hora_entrada || !reg.hora_saida) return;
    const entrada = new Date(reg.hora_entrada);
    const saida = new Date(reg.hora_saida);
    if (saida <= entrada) return;

    // Marco das 23:30 do dia da entrada e a meia-noite seguinte
    const marco2330 = new Date(entrada); marco2330.setHours(23, 30, 0, 0);
    const meiaNoite = new Date(marco2330); meiaNoite.setMinutes(meiaNoite.getMinutes() + 30);

    // Minutos trabalhados entre 23:30 e 00:00 → adicional noturno
    const iniNot = Math.max(entrada.getTime(), marco2330.getTime());
    const fimNot = Math.min(saida.getTime(), meiaNoite.getTime());
    if (fimNot > iniNot) minNoturno += Math.round((fimNot - iniNot) / 60000);

    // Minutos após a meia-noite → hora extra
    if (saida.getTime() > meiaNoite.getTime()) {
      minExtra += Math.round((saida.getTime() - meiaNoite.getTime()) / 60000);
    }

    // Dia de feriado: todas as horas trabalhadas pagam +100%
    if (feriadosSet.has(reg.data_referencia)) {
      // Desconta o intervalo, se registrado
      let minDia = Math.round((saida - entrada) / 60000);
      if (reg.hora_saida_intervalo && reg.hora_retorno_intervalo) {
        minDia -= Math.max(0, Math.round((new Date(reg.hora_retorno_intervalo) - new Date(reg.hora_saida_intervalo)) / 60000));
      }
      if (minDia > 0) minFeriado += minDia;
    }
  });

  const valorNoturno = (minNoturno / 60) * valorHora * 0.20;      // só o adicional de 20%
  const valorExtra = (minExtra / 60) * valorHora * 1.50;          // hora cheia + 50%
  const valorFeriado = (minFeriado / 60) * valorHora * 1.00;      // adicional de 100% (dobro)
  return {
    minNoturno, minExtra, minFeriado,
    valorNoturno: Math.round(valorNoturno * 100) / 100,
    valorExtra: Math.round(valorExtra * 100) / 100,
    valorFeriado: Math.round(valorFeriado * 100) / 100,
  };
}

// Mesmas regras, mas DIA A DIA — alimenta o relatório do espelho de ponto
// ("quais dias teve hora extra / adicional noturno e quantos minutos").
export function calcularAdicionaisPorDia(pontosMes, feriados = []) {
  const feriadosSet = new Set((feriados || []).map(f => f.data || f));
  const dias = [];
  (pontosMes || []).forEach(reg => {
    if (!reg.hora_entrada || !reg.hora_saida) return;
    const entrada = new Date(reg.hora_entrada);
    const saida = new Date(reg.hora_saida);
    if (saida <= entrada) return;

    const marco2330 = new Date(entrada); marco2330.setHours(23, 30, 0, 0);
    const meiaNoite = new Date(marco2330); meiaNoite.setMinutes(meiaNoite.getMinutes() + 30);

    let minNoturno = 0, minExtra = 0, minFeriado = 0;
    const iniNot = Math.max(entrada.getTime(), marco2330.getTime());
    const fimNot = Math.min(saida.getTime(), meiaNoite.getTime());
    if (fimNot > iniNot) minNoturno = Math.round((fimNot - iniNot) / 60000);
    if (saida.getTime() > meiaNoite.getTime()) minExtra = Math.round((saida.getTime() - meiaNoite.getTime()) / 60000);
    if (feriadosSet.has(reg.data_referencia)) {
      let minDia = Math.round((saida - entrada) / 60000);
      if (reg.hora_saida_intervalo && reg.hora_retorno_intervalo) {
        minDia -= Math.max(0, Math.round((new Date(reg.hora_retorno_intervalo) - new Date(reg.hora_saida_intervalo)) / 60000));
      }
      if (minDia > 0) minFeriado = minDia;
    }
    if (minNoturno > 0 || minExtra > 0 || minFeriado > 0) {
      dias.push({ data: reg.data_referencia, minNoturno, minExtra, minFeriado });
    }
  });
  return dias.sort((a, b) => String(a.data).localeCompare(String(b.data)));
}

// ─── FERIADOS DA UNIDADE ─────────────────────────────────────────────────────
export async function fetchFeriados(unidadeId, mesAno = null) {
  if (!isSupabaseReady() || !unidadeId || unidadeId === "todas") return { data: [] };
  let q = supabase.from("rh_feriados").select("*").eq("unidade_id", unidadeId).order("data");
  if (mesAno) {
    const [ano, mes] = String(mesAno).split("-").map(Number);
    const fim = new Date(ano, mes, 1).toISOString().split("T")[0];
    q = q.gte("data", `${mesAno}-01`).lt("data", fim);
  }
  const { data, error } = await q;
  return { data: data || [], error: error?.message };
}

export async function inserirFeriado(unidadeId, data, nome) {
  if (!isSupabaseReady()) return { error: "Offline" };
  const { error } = await supabase.from("rh_feriados").insert([{ unidade_id: unidadeId, data, nome: nome || null }]);
  return { error: error?.message };
}

export async function removerFeriado(id) {
  if (!isSupabaseReady()) return { error: "Offline" };
  const { error } = await supabase.from("rh_feriados").delete().eq("id", id);
  return { error: error?.message };
}

// ─── ADVERTÊNCIAS ────────────────────────────────────────────────────────────
export async function fetchAdvertenciasColab(colaboradorId) {
  if (!isSupabaseReady() || !colaboradorId) return { data: [] };
  const { data, error } = await supabase.from("rh_advertencias_colab")
    .select("*")
    .eq("colaborador_id", colaboradorId)
    .order("data", { ascending: false });
  return { data: data || [], error: error?.message };
}

export async function inserirAdvertencia(adv) {
  if (!isSupabaseReady()) return { error: "Offline" };
  const { error } = await supabase.from("rh_advertencias_colab").insert([adv]);
  return { error: error?.message };
}

export async function removerAdvertencia(id) {
  if (!isSupabaseReady()) return { error: "Offline" };
  const { error } = await supabase.from("rh_advertencias_colab").delete().eq("id", id);
  return { error: error?.message };
}

// Banco de horas de UM colaborador no mês (para a tela de ponto e o espelho)
export async function fetchBancoHorasColaborador(colaboradorId, mesAno) {
  if (!isSupabaseReady() || !colaboradorId) return { data: [] };
  const [ano, mes] = String(mesAno).split("-").map(Number);
  const inicio = `${mesAno}-01`;
  const fim = new Date(ano, mes, 1).toISOString().split("T")[0];
  const { data, error } = await supabase.from("rh_banco_horas")
    .select("*")
    .eq("colaborador_id", colaboradorId)
    .gte("data", inicio)
    .lt("data", fim)
    .order("data", { ascending: false });
  return { data: data || [], error: error?.message };
}

export async function fetchConsumoFuncionario(colaboradorId) {
  if (!isSupabaseReady()) return { data: [], error: "Offline" };
  const { data, error } = await supabase.from("rh_consumo_funcionarios").select("*").eq("funcionario_id", colaboradorId).order("data_consumo", { ascending: false });
  return { data: data || [], error: error?.message };
}

export async function inserirConsumoFuncionario(dados) {
  if (!isSupabaseReady()) return { error: "Offline" };
  const { error } = await supabase.from("rh_consumo_funcionarios").insert([dados]);
  return { error: error?.message };
}

export async function atualizarStatusConsumo(id, status_pagamento, forma_pagamento) {
  if (!isSupabaseReady()) return { error: "Offline" };
  
  const payload = { status_pagamento };
  if (forma_pagamento) payload.forma_pagamento = forma_pagamento;
  if (status_pagamento === "Pago") {
    payload.data_pagamento = new Date().toISOString();
  }

  const { error } = await supabase.from("rh_consumo_funcionarios").update(payload).eq("id", id);
  return { error: error?.message };
}

export async function removerConsumoFuncionario(id) {
  if (!isSupabaseReady()) return { error: "Offline" };
  const { error } = await supabase.from("rh_consumo_funcionarios").delete().eq("id", id);
  return { error: error?.message };
}

export async function fetchValesPendentes(unidadeId) {
  if (!isSupabaseReady()) return { data: [], error: "Offline" };

  let query = supabase
    .from("rh_consumo_funcionarios")
    .select("*")
    .eq("forma_pagamento", "Desconto em Folha")
    .eq("status_pagamento", "Pendente");

  if (unidadeId && unidadeId !== "todas") {
    query = query.eq("unidade_id", unidadeId);
  }

  const { data, error } = await query;
  return { data: data || [], error: error?.message };
}

// ============================================================================
// FECHAMENTO DE FOLHA
// ============================================================================

export async function fetchResumoFolhaMensal(unidadeId, mesAno) {
  if (!isSupabaseReady()) return { data: [], error: "Offline" };

  // 1. Busca Colaboradores
  const { data: colaboradores } = await fetchColaboradores(unidadeId);
  if (!colaboradores) return { data: [] };

  // 2. Busca Pontos do Mês
  const dataInicial = `${mesAno}-01`;
  const ano = parseInt(mesAno.split('-')[0]);
  const mes = parseInt(mesAno.split('-')[1]);
  const ultimoDia = new Date(ano, mes, 0).getDate();
  const dataFinal = `${mesAno}-${ultimoDia.toString().padStart(2, '0')}`;

  let queryPonto = supabase.from("registro_ponto")
    .select("colaborador_id, data_referencia")
    .gte("data_referencia", dataInicial)
    .lte("data_referencia", dataFinal);
    
  if (unidadeId && unidadeId !== "matriz") {
    queryPonto = queryPonto.eq("unidade_id", unidadeId);
  }

  const { data: pontos } = await queryPonto;
  const pontosSeguros = pontos || [];

  // 3. Busca Vales Pendentes
  let queryVales = supabase.from("rh_consumo_funcionarios")
    .select("*")
    .eq("forma_pagamento", "Desconto em Folha")
    .eq("status_pagamento", "Pendente")
    .lte("data_consumo", dataFinal + "T23:59:59Z");

  const { data: vales } = await queryVales;
  const valesSeguros = vales || [];

  const resumo = colaboradores.map(c => {
    const diasTrabalhados = new Set(pontosSeguros.filter(p => p.colaborador_id === c.id).map(p => p.data_referencia)).size;
    const meusVales = valesSeguros.filter(v => v.funcionario_id === c.id);
    const totalVales = meusVales.reduce((acc, v) => acc + Number(v.valor_final), 0);

    const isFreelancer = c.tipo_contrato === "Freelancer";
    const salarioBaseNumber = Number(c.salario || 0);
    
    let baseCalculada = 0;
    if (isFreelancer) {
      baseCalculada = diasTrabalhados * salarioBaseNumber;
    } else {
      baseCalculada = salarioBaseNumber;
    }

    return {
      colaborador_id: c.id,
      nome: c.nome,
      cargo: c.cargo,
      tipo_contrato: c.tipo_contrato,
      salario_cadastrado: salarioBaseNumber,
      dias_trabalhados: diasTrabalhados,
      base_calculada: baseCalculada,
      total_vales_pendentes: totalVales,
      vales_detalhes: meusVales
    };
  });

  return { data: resumo };
}

export async function fecharFolhaMensal(unidadeId, mesAno, pagamentos) {
  if (!isSupabaseReady()) return { error: "Offline" };

  const [anoStr, mesStr] = mesAno.split('-');
  let ano = parseInt(anoStr);
  let mes = parseInt(mesStr); 
  
  mes += 1;
  if (mes > 12) {
    mes = 1;
    ano += 1;
  }
  
  let dia = 1;
  let diasUteis = 0;
  let dataVencimento = null;
  
  while (diasUteis < 5) {
    const data = new Date(ano, mes - 1, dia);
    const diaSemana = data.getDay();
    if (diaSemana !== 0 && diaSemana !== 6) {
      diasUteis++;
    }
    if (diasUteis === 5) {
      dataVencimento = `${ano}-${mes.toString().padStart(2,'0')}-${dia.toString().padStart(2,'0')}`;
      break;
    }
    dia++;
  }

  const descricoes = pagamentos.map(p => `Salário ${mesStr}/${anoStr} - ${p.nome}`);
  const { data: contasExistentes, error: erroConsultaContas } = await supabase
    .from("contas_pagar")
    .select("descricao")
    .eq("unidade_id", unidadeId)
    .in("descricao", descricoes);
  if (erroConsultaContas) return { error: erroConsultaContas.message };

  const descricoesExistentes = new Set((contasExistentes || []).map(c => c.descricao));
  const contasParaInserir = pagamentos.filter(p => !descricoesExistentes.has(`Salário ${mesStr}/${anoStr} - ${p.nome}`)).map(p => ({
    unidade_id: unidadeId,
    descricao: `Salário ${mesStr}/${anoStr} - ${p.nome}`,
    valor: Number(p.valor_liquido),
    data_vencimento: dataVencimento,
    categoria: 'cmo',
    status: 'pendente'
  }));

  if (contasParaInserir.length > 0) {
    const { error } = await supabase.from("contas_pagar").insert(contasParaInserir);
    if (error) return { error: error.message };
  }

  const { data: holeritesExistentes, error: erroConsultaHolerites } = await supabase
    .from("holerites")
    .select("id, func_id")
    .eq("unidade_id", unidadeId)
    .eq("mes", Number(mesStr))
    .eq("ano", Number(anoStr));
  if (erroConsultaHolerites) return { error: erroConsultaHolerites.message };

  const holeritePorFuncionario = new Map((holeritesExistentes || []).map(h => [h.func_id, h]));
  for (const p of pagamentos) {
    const payload = {
      func_id: p.colaborador_id,
      mes: Number(mesStr),
      ano: Number(anoStr),
      bruto: Number(p.base_calculada || 0) + Number(p.acrescimos || 0),
      liquido: Number(p.valor_liquido || 0),
      unidade_id: unidadeId,
      detalhes: {
        nome: p.nome,
        cargo: p.cargo || "",
        tipo_contrato: p.tipo_contrato || "",
        dias_trabalhados: Number(p.dias_trabalhados || 0),
        salario_base: Number(p.base_calculada || 0),
        acrescimos: Number(p.acrescimos || 0),
        vales: Number(p.total_vales_pendentes || 0),
        outros_descontos: Number(p.descontos_manuais || 0),
        competencia: mesAno,
        fechado_em: new Date().toISOString()
      }
    };
    const existente = holeritePorFuncionario.get(p.colaborador_id);
    const operacao = existente
      ? supabase.from("holerites").update(payload).eq("id", existente.id)
      : supabase.from("holerites").insert([payload]);
    const { error: erroHolerite } = await operacao;
    if (erroHolerite) return { error: `Holerite de ${p.nome}: ${erroHolerite.message}` };
  }

  const valesParaBaixar = pagamentos.flatMap(p => p.vales_descontados_ids || []);
  if (valesParaBaixar.length > 0) {
    const dataHoje = new Date().toISOString();
    await supabase.from("rh_consumo_funcionarios")
      .update({ status_pagamento: 'Pago', data_pagamento: dataHoje })
      .in('id', valesParaBaixar);
  }

  return {
    success: true,
    holeritesGerados: pagamentos.length,
    contasCriadas: contasParaInserir.length,
    contasJaExistentes: pagamentos.length - contasParaInserir.length
  };
}
