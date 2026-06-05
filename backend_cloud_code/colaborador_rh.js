// =============================================================================
// FOODERP — colaborador_rh.js
// Módulo 3: Ecossistema do Funcionário
// Contratos · Dossie · Universidade · Ponto · Holerite IA · Aniversariantes
// =============================================================================
"use strict";

const db = require("./banco_de_dados");

// ─────────────────────────────────────────────────────────────────────────────
// DADOS BASE
// ─────────────────────────────────────────────────────────────────────────────

// Perfis extendidos de colaboradores (indexados por func_id)
const _perfis = {};
let _func_counter = 100;

// Treinamentos disponíveis
const _treinamentos = {
  trein_001: {
    id: "trein_001", titulo: "Higiene e Manipulação de Alimentos",
    categoria: "interno", tipo: "video",
    video_url: "https://www.youtube.com/embed/0GaLVVTyVFg",
    descricao: "Boas práticas de higiene na cozinha, temperatura segura e prevenção de contaminação.",
    duracao_min: 28, obrigatorio: true, criado_em: "2025-01-10",
  },
  trein_002: {
    id: "trein_002", titulo: "Atendimento ao Cliente — Padrão FoodERP",
    categoria: "interno", tipo: "video",
    video_url: "https://www.youtube.com/embed/6GdlBjnhZ6k",
    descricao: "Como encantar o cliente, lidar com reclamações e aumentar o ticket médio.",
    duracao_min: 18, obrigatorio: true, criado_em: "2025-02-01",
  },
  trein_003: {
    id: "trein_003", titulo: "Controle de CMV e Redução de Desperdício",
    categoria: "interno", tipo: "video",
    video_url: "https://www.youtube.com/embed/TtJ0G8lbU6A",
    descricao: "Como gerentes e cozinheiros podem reduzir o CMV aplicando ficha técnica e porcionar correto.",
    duracao_min: 35, obrigatorio: false, criado_em: "2025-03-15",
  },
  trein_004: {
    id: "trein_004", titulo: "Prevenção de Acidentes de Trabalho — NR-12",
    categoria: "externo", tipo: "certificado",
    video_url: null,
    pdf_url: null, // simulado
    descricao: "Norma regulamentadora para uso seguro de equipamentos na cozinha.",
    duracao_min: 0, obrigatorio: true, criado_em: "2025-04-01",
  },
  trein_005: {
    id: "trein_005", titulo: "Gestão de Pessoas e Liderança de Equipes",
    categoria: "interno", tipo: "video",
    video_url: "https://www.youtube.com/embed/YDlJQ7YUJe8",
    descricao: "Exclusivo para gerentes: como motivar, dar feedback e reduzir turnover.",
    duracao_min: 42, obrigatorio: false, criado_em: "2025-05-01",
  },
};

// Checklist diário de produção (itens fixos + dinâmicos do KDS)
const CHECKLIST_BASE = [
  { id: "chk_001", descricao: "Higienizar bancadas e equipamentos ao chegar", categoria: "abertura" },
  { id: "chk_002", descricao: "Verificar temperatura do freezer e câmara fria", categoria: "abertura" },
  { id: "chk_003", descricao: "Conferir mise en place dos itens do cardápio", categoria: "abertura" },
  { id: "chk_004", descricao: "Verificar validade dos lotes em uso hoje", categoria: "abertura" },
  { id: "chk_005", descricao: "Pré-preparar proteínas conforme ficha técnica", categoria: "producao" },
  { id: "chk_006", descricao: "Preparar molhos e bases do dia", categoria: "producao" },
  { id: "chk_007", descricao: "Montagem das embalagens e descartáveis", categoria: "producao" },
  { id: "chk_008", descricao: "Limpeza do salão e mesas antes da abertura", categoria: "abertura" },
  { id: "chk_009", descricao: "Conferir caixa e sistema PDV", categoria: "abertura" },
  { id: "chk_010", descricao: "Limpar e desligar equipamentos no fechamento", categoria: "fechamento" },
  { id: "chk_011", descricao: "Registrar sobras e desperdício no sistema", categoria: "fechamento" },
  { id: "chk_012", descricao: "Fechar caixa e transmitir relatório de vendas", categoria: "fechamento" },
];

// Checklists preenchidos por data/funcionário
const _checklists = {};

// ─────────────────────────────────────────────────────────────────────────────
// SEED — perfis expandidos dos funcionários existentes
// ─────────────────────────────────────────────────────────────────────────────

// [CLEAN SLATE — seed block removido]
function _gerarHistoricoHolerites(func_id, salario_base) {
  const holerites = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(); d.setMonth(d.getMonth() - i);
    const competencia = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
    const bonus = Math.random() > 0.6 ? +(salario_base * 0.1).toFixed(2) : 0;
    const horas_extras = Math.random() > 0.5 ? Math.floor(Math.random()*12)*50 : 0;
    const bruto = +(salario_base + bonus + horas_extras).toFixed(2);
    const inss = _calcularINSS(bruto);
    const irrf = _calcularIRRF(bruto - inss);
    const vt = 220.00;
    const vr = +(salario_base * 0.03).toFixed(2);
    const total_descontos = +(inss + irrf + vt * 0.06 + vr * 0.20).toFixed(2);
    const liquido = +(bruto - total_descontos).toFixed(2);
    holerites.push({
      id: `HOL-${func_id}-${competencia}`,
      func_id, competencia,
      salario_base,
      bonus: { valor: bonus, descricao: bonus > 0 ? "Bônus desempenho (10%)" : null },
      horas_extras: { valor: horas_extras, horas: horas_extras > 0 ? Math.floor(horas_extras/50) : 0 },
      bruto,
      descontos: {
        inss: { aliquota: _aliquotaINSS(bruto), valor: inss, descricao: "INSS — Previdência Social" },
        irrf: { aliquota: _aliquotaIRRF(bruto-inss), valor: irrf, descricao: "IRRF — Imposto de Renda Retido na Fonte" },
        vale_transporte: { valor: +(vt * 0.06).toFixed(2), descricao: "Vale Transporte (desconto 6% limite legal)" },
        vale_refeicao: { valor: +(vr * 0.20).toFixed(2), descricao: "Vale Refeição (desconto 20%)" },
      },
      total_descontos,
      liquido,
      status: i === 0 ? "pendente" : "pago",
      data_pagamento: i === 0 ? null : new Date(d.getFullYear(), d.getMonth()+1, 5).toISOString().split("T")[0],
    });
  }
  return holerites;
}

function _calcularINSS(salario) {
  if (salario <= 1412.00) return +(salario * 0.075).toFixed(2);
  if (salario <= 2666.68) return +(salario * 0.09).toFixed(2);
  if (salario <= 4000.03) return +(salario * 0.12).toFixed(2);
  if (salario <= 7786.02) return +(salario * 0.14).toFixed(2);
  return +(7786.02 * 0.14).toFixed(2);
}
function _aliquotaINSS(s) {
  if (s<=1412) return "7,5%"; if (s<=2666.68) return "9%"; if (s<=4000.03) return "12%"; return "14%";
}
function _calcularIRRF(base) {
  const bc = base - 564.80; // dedução dependente (sem dependente para simplificar)
  if (bc <= 2259.20) return 0;
  if (bc <= 2826.65) return +(bc * 0.075 - 169.44).toFixed(2);
  if (bc <= 3751.05) return +(bc * 0.15 - 381.44).toFixed(2);
  if (bc <= 4664.68) return +(bc * 0.225 - 662.77).toFixed(2);
  return +(bc * 0.275 - 896.00).toFixed(2);
}
function _aliquotaIRRF(b) {
  if (b<=2259.20) return "Isento"; if (b<=2826.65) return "7,5%"; if (b<=3751.05) return "15%"; if (b<=4664.68) return "22,5%"; return "27,5%";
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. GESTÃO DE CADASTRO E CONTRATOS
// ─────────────────────────────────────────────────────────────────────────────

function listarFuncionarios(loja_id) {
  const funcs = loja_id
    ? Object.values(db.funcionarios).filter(f => f.loja_id === loja_id)
    : Object.values(db.funcionarios);

  const agora = new Date();
  return funcs.map(f => {
    const perfil = _perfis[f.id] || {};
    let alerta_contrato = null;
    if (perfil.tipo_contrato === "determinado" && perfil.contrato_fim) {
      const dias = Math.ceil((new Date(perfil.contrato_fim) - agora) / 86400000);
      if (dias <= 60) alerta_contrato = { dias, nivel: dias <= 15 ? "critico" : "atencao" };
    }
    let aniversario_prox = null;
    if (perfil.data_nascimento) {
      const nasc = new Date(perfil.data_nascimento);
      const aniv_este_ano = new Date(agora.getFullYear(), nasc.getMonth(), nasc.getDate());
      if (aniv_este_ano < agora) aniv_este_ano.setFullYear(agora.getFullYear() + 1);
      const dias_aniv = Math.ceil((aniv_este_ano - agora) / 86400000);
      if (dias_aniv <= 30) aniversario_prox = { data: aniv_este_ano.toISOString().split("T")[0], dias: dias_aniv };
    }
    return {
      ...f,
      perfil,
      alerta_contrato,
      aniversario_prox,
      tempo_casa: perfil.data_admissao
        ? Math.floor((agora - new Date(perfil.data_admissao)) / (365.25*86400000) * 10) / 10 + " anos"
        : null,
    };
  });
}

function getFuncionarioCompleto(func_id) {
  const f = db.funcionarios[func_id];
  if (!f) return null;
  const perfil = _perfis[func_id] || {};
  return { ...f, perfil };
}

function criarFuncionario(dados) {
  const { nome, cpf, cargo, loja_id, salario_base, turno, data_admissao, tipo_contrato, contrato_fim, data_nascimento } = dados;
  if (!nome || !cargo || !loja_id) return { sucesso: false, erro: "nome, cargo, loja_id obrigatorios" };

  const id = `func_${String(++_func_counter).padStart(3,"0")}`;
  db.funcionarios[id] = {
    id, nome, cpf: cpf || "***.***.***-00",
    cargo, loja_id,
    matricula: String(Math.floor(Math.random()*9000+1000)),
    turno: turno || "almoco",
    horario: { entrada: "09:00", saida: "18:00" },
    salario_base: +parseFloat(salario_base||1412).toFixed(2),
    status_hoje: "presente",
    escala_semana: [],
    horas_mes: 176,
    faltas_mes: 0,
    treinamentos_concluidos: [],
    treinamentos_pendentes: ["trein_001","trein_002"],
    foto_url: null,
  };

  _perfis[id] = {
    func_id: id,
    data_nascimento: data_nascimento || null,
    data_admissao: data_admissao || new Date().toISOString().split("T")[0],
    tipo_contrato: tipo_contrato || "indeterminado",
    contrato_fim: contrato_fim || null,
    salario_base: +parseFloat(salario_base||1412).toFixed(2),
    cargo,
    banco: "", agencia: "", conta: "", pis: "",
    documentos: { contrato_assinado: false, rg: false, cpf: false, comprovante_residencia: false, foto_3x4: false, atestados: [], certificados: [] },
    treinamentos_concluidos: [],
    treinamentos_em_progresso: [],
    holerites: _gerarHistoricoHolerites(id, +parseFloat(salario_base||1412)),
  };

  return { sucesso: true, funcionario: db.funcionarios[id] };
}

function atualizarFuncionario(func_id, dados) {
  const f = db.funcionarios[func_id];
  if (!f) return { sucesso: false, erro: "Funcionario nao encontrado" };
  Object.assign(f, dados);
  if (_perfis[func_id] && dados.perfil) Object.assign(_perfis[func_id], dados.perfil);
  return { sucesso: true, funcionario: f };
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. PONTO ELETRÔNICO
// ─────────────────────────────────────────────────────────────────────────────

const _registros_ponto = {}; // func_id → [{ data, entrada, saida, horas_trabalhadas, status }]


// [CLEAN SLATE — seed block removido]
function baterPonto(func_id, tipo = "entrada") {
  const f = db.funcionarios[func_id];
  if (!f) return { sucesso: false, erro: "Funcionario nao encontrado" };

  const hoje = new Date().toISOString().split("T")[0];
  const hora_atual = new Date().toLocaleTimeString("pt-BR", { hour:"2-digit", minute:"2-digit" });

  if (!_registros_ponto[func_id]) _registros_ponto[func_id] = [];
  const registro_hoje = _registros_ponto[func_id].find(r => r.data === hoje);

  if (tipo === "entrada") {
    if (registro_hoje && registro_hoje.entrada) return { sucesso: false, erro: "Entrada já registrada hoje." };
    const novo = { id:`PT-${func_id}-${hoje}`, func_id, data:hoje, entrada:hora_atual, saida:null, horas_trabalhadas:null, status:"aberto" };
    _registros_ponto[func_id].unshift(novo);
    return { sucesso: true, registro: novo, mensagem: `Entrada registrada às ${hora_atual}` };
  } else {
    if (!registro_hoje || !registro_hoje.entrada) return { sucesso: false, erro: "Nenhuma entrada registrada hoje." };
    if (registro_hoje.saida) return { sucesso: false, erro: "Saída já registrada hoje." };
    registro_hoje.saida = hora_atual;
    const [eh, em] = registro_hoje.entrada.split(":").map(Number);
    const [sh, sm] = hora_atual.split(":").map(Number);
    registro_hoje.horas_trabalhadas = +((sh*60+sm - eh*60-em) / 60).toFixed(2);
    registro_hoje.status = "confirmado";
    return { sucesso: true, registro: registro_hoje, mensagem: `Saída registrada às ${hora_atual}. Horas: ${registro_hoje.horas_trabalhadas}h` };
  }
}

function getPonto(func_id, limite = 30) {
  const registros = _registros_ponto[func_id] || [];
  const hoje = new Date().toISOString().split("T")[0];
  const hoje_reg = registros.find(r => r.data === hoje);
  const total_horas = registros
    .filter(r => r.horas_trabalhadas)
    .reduce((s,r) => s+r.horas_trabalhadas, 0);

  return {
    func_id,
    registro_hoje: hoje_reg || null,
    status_hoje: hoje_reg ? (hoje_reg.saida ? "saiu" : "trabalhando") : "nao_bateu",
    historico: registros.slice(0, limite),
    total_horas_mes: +total_horas.toFixed(1),
    banco_horas: +(total_horas - 176).toFixed(1),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. CHECKLIST DE PRODUÇÃO
// ─────────────────────────────────────────────────────────────────────────────

function getChecklist(func_id, data) {
  const d = data || new Date().toISOString().split("T")[0];
  const chave = `${func_id}_${d}`;
  if (!_checklists[chave]) {
    _checklists[chave] = CHECKLIST_BASE.map(item => ({ ...item, concluido: false, ts: null }));
  }
  const concluidos = _checklists[chave].filter(i => i.concluido).length;
  return {
    func_id, data: d,
    itens: _checklists[chave],
    progresso_pct: Math.round(concluidos / CHECKLIST_BASE.length * 100),
    concluidos,
    total: CHECKLIST_BASE.length,
  };
}

function marcarChecklist(func_id, chk_id, concluido, data) {
  const d = data || new Date().toISOString().split("T")[0];
  const chave = `${func_id}_${d}`;
  if (!_checklists[chave]) getChecklist(func_id, d);
  const item = _checklists[chave].find(i => i.id === chk_id);
  if (!item) return { sucesso: false, erro: "Item nao encontrado" };
  item.concluido = concluido;
  item.ts = concluido ? new Date().toISOString() : null;
  return { sucesso: true, item };
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. UNIVERSIDADE CORPORATIVA
// ─────────────────────────────────────────────────────────────────────────────

function listarTreinamentos(categoria) {
  const todos = Object.values(_treinamentos);
  return categoria ? todos.filter(t => t.categoria === categoria) : todos;
}

function getTreinamento(trein_id) {
  return _treinamentos[trein_id] || null;
}

function registrarConclusaoTreinamento(func_id, trein_id, nota = null) {
  const f = db.funcionarios[func_id];
  const t = _treinamentos[trein_id];
  if (!f) return { sucesso: false, erro: "Funcionario nao encontrado" };
  if (!t) return { sucesso: false, erro: "Treinamento nao encontrado" };

  const perfil = _perfis[func_id];
  if (perfil && !perfil.treinamentos_concluidos.includes(trein_id)) {
    perfil.treinamentos_concluidos.push(trein_id);
  }
  if (!f.treinamentos_concluidos.includes(t.titulo)) {
    f.treinamentos_concluidos.push(t.titulo);
  }
  f.treinamentos_pendentes = f.treinamentos_pendentes.filter(x => x !== t.titulo);

  return { sucesso: true, mensagem: `Treinamento "${t.titulo}" concluído!`, certificado_id: `CERT-${func_id}-${trein_id}` };
}

function getProgressoTreinamentos(func_id) {
  const perfil = _perfis[func_id] || {};
  const todos = Object.values(_treinamentos);
  const obrigatorios = todos.filter(t => t.obrigatorio);
  const concluidos_ids = perfil.treinamentos_concluidos || [];

  return {
    func_id,
    total: todos.length,
    concluidos: concluidos_ids.length,
    pendentes: todos.length - concluidos_ids.length,
    obrigatorios_pendentes: obrigatorios.filter(t => !concluidos_ids.includes(t.id)).length,
    progresso_pct: Math.round(concluidos_ids.length / todos.length * 100),
    lista: todos.map(t => ({
      ...t,
      status: concluidos_ids.includes(t.id) ? "concluido" : "pendente",
    })),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. HOLERITE INTELIGENTE
// ─────────────────────────────────────────────────────────────────────────────

function getHolerite(func_id, competencia) {
  const perfil = _perfis[func_id];
  if (!perfil) return null;
  const holerites = perfil.holerites || [];
  return competencia ? holerites.find(h => h.competencia === competencia) || null : holerites[holerites.length - 1];
}

function listarHolerites(func_id) {
  const perfil = _perfis[func_id];
  if (!perfil) return [];
  return (perfil.holerites || []).map(h => ({
    id: h.id, competencia: h.competencia, bruto: h.bruto,
    liquido: h.liquido, status: h.status, data_pagamento: h.data_pagamento,
  }));
}

// Explicação IA de termos do holerite (respondida diretamente, sem API para ser rápido)
const EXPLICACOES_HOLERITE = {
  inss: {
    titulo: "O que é o INSS?",
    resposta: `O **INSS** (Instituto Nacional do Seguro Social) é a contribuição que você paga todo mês para garantir seus direitos de aposentadoria, auxílio-doença, licença-maternidade e outros benefícios do governo.\n\nNo seu holerite, o desconto é calculado sobre o seu salário bruto com as seguintes alíquotas de 2026:\n\n• Até R$ 1.412,00 → **7,5%**\n• De R$ 1.412,01 a R$ 2.666,68 → **9%**\n• De R$ 2.666,69 a R$ 4.000,03 → **12%**\n• De R$ 4.000,04 a R$ 7.786,02 → **14%**\n\nPense assim: é um investimento no seu futuro! 🛡️`,
  },
  irrf: {
    titulo: "O que é o IRRF?",
    resposta: `O **IRRF** (Imposto de Renda Retido na Fonte) é um imposto do governo federal sobre os seus rendimentos mensais.\n\nA boa notícia: a maioria dos trabalhadores com salário abaixo de R$ 2.259,20 está **isenta** de IRRF!\n\nAs alíquotas em 2026:\n\n• Até R$ 2.259,20 → **Isento** 🎉\n• De R$ 2.259,21 a R$ 2.826,65 → **7,5%**\n• De R$ 2.826,66 a R$ 3.751,05 → **15%**\n• De R$ 3.751,06 a R$ 4.664,68 → **22,5%**\n• Acima de R$ 4.664,68 → **27,5%**\n\nO valor no seu holerite já é calculado automaticamente pela empresa. 📊`,
  },
  vale_transporte: {
    titulo: "Vale Transporte — por que tem desconto?",
    resposta: `O **Vale Transporte** é um benefício que a empresa fornece para pagar seu transporte (ônibus, metrô, etc.).\n\nPela lei (Lei 7.418/85), o desconto máximo é de **6% do seu salário base**. A empresa paga o restante do custo.\n\nExemplo: Se o seu passe mensal custa R$ 300 e seu salário é R$ 1.800:\n• 6% de R$ 1.800 = R$ 108 (seu desconto)\n• R$ 192 → a empresa paga por você! 🚌\n\nÉ um benefício, não um custo puro!`,
  },
  vale_refeicao: {
    titulo: "Vale Refeição — como funciona?",
    resposta: `O **Vale Refeição** é o benefício para suas refeições do dia a dia.\n\nO desconto no holerite é de no máximo **20% do valor do benefício** conforme nossa política interna.\n\nExemplo: Você recebe R$ 600/mês em VR → desconto de R$ 120.\n• Você paga: R$ 120\n• A empresa subsidia: R$ 480 🍽️\n\nO VR pode ser usado em restaurantes, supermercados e afins.`,
  },
  bonus: {
    titulo: "Como é calculado meu bônus?",
    resposta: `O **bônus de desempenho** é um reconhecimento adicional por metas atingidas!\n\nPela política do FoodERP, o bônus é de **10% do salário base** quando você:\n\n✅ Cumpre 100% do checklist de produção no mês\n✅ Zero faltas injustificadas\n✅ Avaliação positiva do gerente\n\nO bônus aparece na rubrica "Bônus desempenho" do seu holerite e também entra na base de cálculo do INSS. 🏆`,
  },
  horas_extras: {
    titulo: "Como funcionam as horas extras?",
    resposta: `**Horas extras** são as horas trabalhadas além da sua jornada contratual.\n\nPela CLT e pela política FoodERP:\n\n• **Hora extra comum** → acréscimo de 50% sobre o valor da hora normal\n• **Hora extra no feriado/domingo** → acréscimo de 100%\n\nCálculo da sua hora normal:\n> Salário ÷ 220 horas = valor da hora\n\nAs horas extras aparecem em rubrica separada no holerite para total transparência. ⏱️`,
  },
  liquido: {
    titulo: "Como é calculado o meu salário líquido?",
    resposta: `O **salário líquido** é o valor que cai na sua conta!\n\nFórmula simples:\n\n> **Salário Bruto** (salário base + bônus + horas extras)\n> ➖ INSS\n> ➖ IRRF (se aplicável)\n> ➖ Desconto Vale Transporte (6%)\n> ➖ Desconto Vale Refeição (20%)\n> = **Salário Líquido** 💰\n\nSe tiver qualquer dúvida sobre um desconto específico, clique sobre ele no holerite e eu explico em detalhes! 😊`,
  },
};

function explicarTermoHolerite(termo) {
  const key = termo.toLowerCase()
    .replace(/[áàã]/g,"a").replace(/[éê]/g,"e").replace(/[í]/g,"i").replace(/[óõô]/g,"o").replace(/[ú]/g,"u")
    .replace(/\s+/g,"_")
    .replace("vale_transporte","vale_transporte")
    .replace("vale_refeicao","vale_refeicao")
    .replace("horas_extras","horas_extras");

  const expl = EXPLICACOES_HOLERITE[key] || EXPLICACOES_HOLERITE[
    Object.keys(EXPLICACOES_HOLERITE).find(k => termo.toLowerCase().includes(k.replace(/_/g," "))) || ""
  ];

  if (expl) return { sucesso: true, ...expl };

  return {
    sucesso: true,
    titulo: `Dúvida sobre: ${termo}`,
    resposta: `Entendo sua dúvida sobre "${termo}"! Este item no holerite representa os valores calculados conforme a legislação trabalhista brasileira (CLT). Para dúvidas específicas sobre o valor exato, recomendo falar com o RH da empresa. Posso explicar: INSS, IRRF, Vale Transporte, Vale Refeição, Bônus, Horas Extras ou Salário Líquido.`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. TOQUE DO HEITOR — Aniversariantes + Alertas de Contratos
// ─────────────────────────────────────────────────────────────────────────────

function getAniversariantesDoMes(mes) {
  const m = mes || new Date().getMonth() + 1;
  const agora = new Date();
  const result = [];

  for (const [fid, perfil] of Object.entries(_perfis)) {
    if (!perfil.data_nascimento) continue;
    const nasc = new Date(perfil.data_nascimento);
    if (nasc.getMonth() + 1 !== m) continue;

    const f = db.funcionarios[fid] || {};
    const aniv_este_ano = new Date(agora.getFullYear(), nasc.getMonth(), nasc.getDate());
    if (aniv_este_ano < agora) aniv_este_ano.setFullYear(agora.getFullYear() + 1);
    const dias = Math.ceil((aniv_este_ano - agora) / 86400000);
    const idade = agora.getFullYear() - nasc.getFullYear() + (dias < 0 ? 1 : 0);

    result.push({
      func_id: fid,
      nome: f.nome || fid,
      cargo: f.cargo || "",
      loja_id: f.loja_id || "",
      loja_nome: db.lojas[f.loja_id]?.nome || "",
      data_nascimento: perfil.data_nascimento,
      data_aniversario: `${String(nasc.getDate()).padStart(2,"0")}/${String(nasc.getMonth()+1).padStart(2,"0")}`,
      dias_para_aniversario: dias,
      idade_completando: idade,
      hoje: dias === 0,
    });
  }
  return result.sort((a,b) => a.dias_para_aniversario - b.dias_para_aniversario);
}

function getAlertasContratos() {
  const agora = new Date();
  const alertas = [];

  for (const [fid, perfil] of Object.entries(_perfis)) {
    if (perfil.tipo_contrato !== "determinado" || !perfil.contrato_fim) continue;
    const dias = Math.ceil((new Date(perfil.contrato_fim) - agora) / 86400000);
    if (dias > 90) continue;

    const f = db.funcionarios[fid] || {};
    alertas.push({
      func_id: fid,
      nome: f.nome || fid,
      cargo: f.cargo || "",
      loja_id: f.loja_id || "",
      loja_nome: db.lojas[f.loja_id]?.nome || "",
      contrato_fim: perfil.contrato_fim,
      dias_para_vencer: dias,
      nivel: dias <= 15 ? "critico" : dias <= 30 ? "urgente" : "atencao",
    });
  }
  return alertas.sort((a,b) => a.dias_para_vencer - b.dias_para_vencer);
}

function getEscalaFolgas(loja_id, semanas = 4) {
  // Retorna a escala de folgas dos próximos N ciclos
  const funcs = db.getFuncionariosPorLoja(loja_id);
  const hoje = new Date();
  const escala = [];

  for (const f of funcs) {
    const folgas = [];
    for (let w = 0; w < semanas; w++) {
      // Simula: cada funcionário tem 2 folgas/semana, rotacionando
      const base_dia = (Object.keys(db.funcionarios).indexOf(f.id) + w * 2) % 7;
      const d1 = new Date(hoje); d1.setDate(d1.getDate() + w*7 + base_dia);
      const d2 = new Date(d1); d2.setDate(d1.getDate() + 1);
      folgas.push(d1.toISOString().split("T")[0]);
      folgas.push(d2.toISOString().split("T")[0]);
    }
    escala.push({ func_id: f.id, nome: f.nome, cargo: f.cargo, folgas });
  }
  return escala;
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────
module.exports = {
  // Cadastro
  listarFuncionarios,
  getFuncionarioCompleto,
  criarFuncionario,
  atualizarFuncionario,
  // Ponto
  baterPonto,
  getPonto,
  // Checklist
  getChecklist,
  marcarChecklist,
  // Treinamentos
  listarTreinamentos,
  getTreinamento,
  registrarConclusaoTreinamento,
  getProgressoTreinamentos,
  // Holerite
  getHolerite,
  listarHolerites,
  explicarTermoHolerite,
  // Heitor's Touch
  getAniversariantesDoMes,
  getAlertasContratos,
  getEscalaFolgas,
};
