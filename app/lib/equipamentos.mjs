// FRITADEIRA E COIFA (dono, 24/11/2026): abastecimento, filtragem e limpeza da
// fritadeira (água, óleo e sal), limpeza da coifa a cada 15 dias. Cada tarefa tem
// de quantos em quantos dias, a próxima data, o passo a passo, os materiais com a
// quantidade exata e os cuidados. "Fiz agora" registra e agenda a próxima;
// "Reagendar" muda a data. Os registros viram a planilha; os avisos dizem
// "amanhã é dia de limpar a fritadeira, vai precisar de…" e o que falta no estoque.
//
// Onde mora:
//   tarefas e histórico → tabela controle_manutencoes (a agenda de limpezas que já existia)
//   equipamentos, passo a passo, materiais e cuidados → config_sistema.params.equipamentos
// Nenhuma quantidade é inventada: o que o dono não preencheu aparece como "a definir".

export const TIPOS_EQUIPAMENTO = Object.freeze({
  fritadeira: { rotulo: "Fritadeira", tarefas: ["abastecimento", "filtragem", "limpeza"] },
  coifa: { rotulo: "Coifa", tarefas: ["limpeza"] },
  outro: { rotulo: "Equipamento", tarefas: ["limpeza"] },
});

export const TAREFAS = Object.freeze({
  abastecimento: { rotulo: "Abastecimento", verbo: "abastecer" },
  filtragem: { rotulo: "Filtragem do óleo", verbo: "filtrar o óleo" },
  limpeza: { rotulo: "Limpeza e higienização", verbo: "limpar" },
});

export const UNIDADES_MATERIAL = Object.freeze(["kg", "g", "L", "ml", "un"]);

const limpo = (v) => String(v ?? "").replace(/\s+/g, " ").trim();
export const semAcento = (v) => String(v ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const num = (v) => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 1000) / 1000 : null;
};
export const novoIdEquip = (p = "eq") => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

// ─── Dados guardados ────────────────────────────────────────────────────────

export function normalizarMaterial(m = {}) {
  return {
    nome: limpo(m.nome).slice(0, 60),
    quantidade: num(m.quantidade),
    unidade: UNIDADES_MATERIAL.includes(m.unidade) ? m.unidade : "kg",
    insumo_id: m.insumo_id || null,
  };
}

export function normalizarProcedimento(p = {}) {
  const lista = (v) => (Array.isArray(v) ? v : String(v || "").split("\n")).map(limpo).filter(Boolean).slice(0, 30);
  return {
    equipamento_id: p.equipamento_id || null,
    tarefa: TAREFAS[p.tarefa] ? p.tarefa : "limpeza",
    materiais: (Array.isArray(p.materiais) ? p.materiais : []).map(normalizarMaterial).filter((m) => m.nome).slice(0, 20),
    passos: lista(p.passos),
    cuidados: lista(p.cuidados),
  };
}

export function normalizarEquipamentos(v) {
  const equipamentos = (Array.isArray(v?.equipamentos) ? v.equipamentos : [])
    .map((e) => ({ id: e.id || novoIdEquip(), nome: limpo(e.nome).slice(0, 40), tipo: TIPOS_EQUIPAMENTO[e.tipo] ? e.tipo : "outro" }))
    .filter((e) => e.nome);
  const procedimentos = {};
  for (const [id, p] of Object.entries(v?.procedimentos || {})) procedimentos[id] = normalizarProcedimento(p);
  return { versao: 1, equipamentos, procedimentos };
}

/** Nome da linha na agenda: "Fritadeira 1 · Limpeza e higienização". */
export const nomeDaTarefa = (equipamento, tarefa) => `${equipamento.nome} · ${TAREFAS[tarefa]?.rotulo || "Limpeza"}`;

/**
 * Junta as linhas da agenda (controle_manutencoes) com os equipamentos:
 * [{ ...equipamento, tarefas: [{ id, tarefa, rotulo, frequencia_dias, proxima_prevista, ultima_execucao, historico, procedimento }] }]
 */
export function montarEquipamentos(dados, manutencoes = []) {
  const { equipamentos, procedimentos } = normalizarEquipamentos(dados);
  return equipamentos.map((e) => {
    const tarefas = manutencoes
      .filter((m) => procedimentos[m.id]?.equipamento_id === e.id && m.ativo !== false)
      .map((m) => ({
        id: m.id,
        tarefa: procedimentos[m.id].tarefa,
        rotulo: TAREFAS[procedimentos[m.id].tarefa]?.rotulo || m.nome,
        frequencia_dias: m.frequencia_dias || null,
        proxima_prevista: m.proxima_prevista || null,
        ultima_execucao: m.ultima_execucao || null,
        historico: Array.isArray(m.historico) ? m.historico : [],
        procedimento: procedimentos[m.id],
        linha: m,
      }))
      .sort((a, b) => TIPOS_EQUIPAMENTO[e.tipo].tarefas.indexOf(a.tarefa) - TIPOS_EQUIPAMENTO[e.tipo].tarefas.indexOf(b.tarefa));
    return { ...e, tarefas };
  });
}

// ─── Datas e situação ───────────────────────────────────────────────────────

const dia = (iso) => new Date(`${String(iso).slice(0, 10)}T12:00:00Z`);
const isoDia = (d) => d.toISOString().slice(0, 10);
export const somarDiasEquip = (iso, n) => { const d = dia(iso); d.setUTCDate(d.getUTCDate() + Number(n || 0)); return isoDia(d); };
export const hojeSP = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
export const dataBR = (iso) => (iso ? `${String(iso).slice(8, 10)}/${String(iso).slice(5, 7)}` : "—");

/** Situação pela próxima data: atrasada, hoje, amanhã, breve (≤3 dias) ou em dia. */
export function situacaoDaTarefa(proxima, hoje = hojeSP()) {
  if (!proxima) return { nivel: "sem_data", dias: null, texto: "Sem data marcada" };
  const dias = Math.round((dia(proxima) - dia(hoje)) / 864e5);
  if (dias < 0) return { nivel: "atrasada", dias, texto: `Atrasada há ${-dias} dia${dias === -1 ? "" : "s"}` };
  if (dias === 0) return { nivel: "hoje", dias, texto: "É hoje" };
  if (dias === 1) return { nivel: "amanha", dias, texto: "É amanhã" };
  return { nivel: dias <= 3 ? "breve" : "ok", dias, texto: `Faltam ${dias} dias` };
}

// ─── Materiais e estoque ────────────────────────────────────────────────────

const fmt = (n) => Number(n).toLocaleString("pt-BR", { maximumFractionDigits: 3 });
export const textoMaterial = (m) => (m.quantidade ? `${m.nome}: ${fmt(m.quantidade)} ${m.unidade}` : `${m.nome}: quantidade a definir`);

/**
 * Confere cada material no estoque da unidade.
 * insumos: [{ id, nome }]; saldos: Map(insumo_id → saldo somado de estoque_itens)
 * → [{ material, insumo|null, situacao: "sem_cadastro" | "sem_estoque" | "tem", saldo }]
 * Só diz "tem" ou "sem estoque": comparar a quantidade exigiria a mesma unidade, então não arrisca.
 */
export function conferirMateriais(materiais = [], insumos = [], saldos = new Map()) {
  return materiais.map((m) => {
    const insumo = (m.insumo_id && insumos.find((i) => i.id === m.insumo_id))
      || insumos.find((i) => semAcento(limpo(i.nome)) === semAcento(m.nome))
      || null;
    if (!insumo) return { material: m, insumo: null, situacao: "sem_cadastro", saldo: null };
    const saldo = Number(saldos.get(insumo.id) || 0);
    return { material: m, insumo, situacao: saldo > 0 ? "tem" : "sem_estoque", saldo };
  });
}

/**
 * Avisos do dia: tarefas atrasadas, de hoje e de amanhã, com o que vai precisar
 * e o que falta no estoque. → [{ id, nivel, texto, materiais: [texto], faltando: [texto] }]
 */
export function avisosEquipamentos(equipamentos = [], { hoje = hojeSP(), insumos = [], saldos = new Map() } = {}) {
  const out = [];
  for (const e of equipamentos) {
    for (const t of e.tarefas) {
      const s = situacaoDaTarefa(t.proxima_prevista, hoje);
      if (!["atrasada", "hoje", "amanha"].includes(s.nivel)) continue;
      const verbo = TAREFAS[t.tarefa]?.verbo || "limpar";
      const quando = s.nivel === "amanha" ? "Amanhã é dia de" : s.nivel === "hoje" ? "Hoje é dia de" : `${s.texto}:`;
      const conf = conferirMateriais(t.procedimento?.materiais || [], insumos, saldos);
      out.push({
        id: t.id, nivel: s.nivel, equipamento: e.nome, tarefa: t.tarefa,
        texto: `${quando} ${verbo} ${s.nivel === "atrasada" ? `(${e.nome})` : `a ${e.nome}`}`.replace(/ a (coifa|fritadeira)/i, (x) => x),
        materiais: (t.procedimento?.materiais || []).map(textoMaterial),
        faltando: conf.filter((c) => c.situacao !== "tem").map((c) => `${c.material.nome}${c.situacao === "sem_cadastro" ? " (não está no cadastro do estoque)" : " (sem estoque)"}`),
      });
    }
  }
  const ordem = { atrasada: 0, hoje: 1, amanha: 2 };
  return out.sort((a, b) => ordem[a.nivel] - ordem[b.nivel]);
}

// ─── Planilha ───────────────────────────────────────────────────────────────

/** Todos os registros, do mais novo ao mais antigo. */
export function planilhaEquipamentos(equipamentos = []) {
  const linhas = [];
  for (const e of equipamentos) for (const t of e.tarefas) for (const h of t.historico) {
    linhas.push({ data: h.data, equipamento: e.nome, tarefa: TAREFAS[t.tarefa]?.rotulo || t.rotulo, responsavel: h.responsavel || "", observacao: h.observacao || "" });
  }
  return linhas.sort((a, b) => String(b.data).localeCompare(String(a.data)));
}

/** CSV da planilha (Excel abre): separador ";" e BOM para acento. */
export function csvPlanilha(linhas = []) {
  const q = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const dataHora = (iso) => (iso ? new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "");
  return "﻿" + [["Data", "Equipamento", "Tarefa", "Quem fez", "Observação"], ...linhas.map((l) => [dataHora(l.data), l.equipamento, l.tarefa, l.responsavel, l.observacao])]
    .map((r) => r.map(q).join(";")).join("\n");
}

// ─── Modelos (sugestão para começar; o dono revisa) ─────────────────────────
// Só texto de orientação geral. Quantidades ficam em branco: quem define é o dono.
export const MODELOS_PROCEDIMENTO = Object.freeze({
  "fritadeira:abastecimento": {
    materiais: [{ nome: "Sal grosso", quantidade: null, unidade: "kg" }, { nome: "Água", quantidade: null, unidade: "L" }, { nome: "Óleo", quantidade: null, unidade: "L" }],
    passos: ["Confira se a fritadeira está desligada, fria e limpa.", "Coloque a água até a marca indicada.", "Coloque o sal.", "Complete com o óleo até a marca de nível.", "Ligue e espere chegar na temperatura antes de fritar."],
    cuidados: ["Nunca coloque água com o óleo quente.", "Respeite as marcas de nível do fabricante."],
  },
  "fritadeira:filtragem": {
    materiais: [{ nome: "Papel ou filtro de óleo", quantidade: null, unidade: "un" }],
    passos: ["Desligue e espere o óleo esfriar até a temperatura segura do fabricante.", "Escorra o óleo pelo filtro.", "Retire os resíduos do fundo.", "Volte o óleo filtrado e complete o nível se precisar."],
    cuidados: ["Use luva térmica e avental.", "Não deixe água encostar no óleo quente."],
  },
  "fritadeira:limpeza": {
    materiais: [{ nome: "Detergente desengordurante", quantidade: null, unidade: "ml" }],
    passos: ["Desligue da tomada e espere esfriar.", "Retire o óleo, a água e as cestas.", "Lave a cuba e as cestas com desengordurante.", "Enxágue e seque bem antes de abastecer de novo."],
    cuidados: ["Não molhe a parte elétrica.", "Seque tudo antes de ligar."],
  },
  "coifa:limpeza": {
    materiais: [{ nome: "Desengordurante", quantidade: null, unidade: "ml" }],
    passos: ["Desligue a coifa e os equipamentos embaixo dela.", "Retire os filtros.", "Deixe os filtros de molho no desengordurante e esfregue.", "Limpe a parte interna e externa da coifa.", "Enxágue, seque e recoloque os filtros."],
    cuidados: ["Use escada firme e luvas.", "Cubra os equipamentos de baixo para não cair gordura."],
  },
});
export const modeloDe = (tipo, tarefa) => MODELOS_PROCEDIMENTO[`${tipo}:${tarefa}`] || null;
