// =============================================================================
// FOODERP — documentos.js
// Módulo 2: Central de Documentos e Notas Fiscais (DF-e)
// NF-e por CNPJ · Categorização de Boletos · Documentação Legal
// =============================================================================
"use strict";

const db = require("./banco_de_dados");

// ─────────────────────────────────────────────────────────────────────────────
// DADOS BASE
// ─────────────────────────────────────────────────────────────────────────────

const CNPJS_LOJAS = {
  loja_1: { cnpj: "12.345.678/0001-01", razao: "Seldeestrela Restaurante Ltda" },
  loja_2: { cnpj: "12.345.678/0002-02", razao: "Tico Tico Saladas Ltda" },
  loja_3: { cnpj: "12.345.678/0003-03", razao: "Burguer Artesanal Ltda" },
};

// Categorias de boletos/despesas
const CATEGORIAS_BOLETO = {
  insumos:         { label: "Insumos",          icon: "ti-shopping-cart", cor: "#22c55e" },
  bebidas:         { label: "Bebidas",           icon: "ti-bottle",        cor: "#3b82f6" },
  gas_cozinha:     { label: "Gás de Cozinha",   icon: "ti-flame",         cor: "#f59e0b" },
  descartaveis:    { label: "Descartáveis",      icon: "ti-package",       cor: "#8b5cf6" },
  energia:         { label: "Energia Elétrica",  icon: "ti-bolt",          cor: "#f59e0b" },
  agua:            { label: "Água",              icon: "ti-droplet",       cor: "#60a5fa" },
  telefone:        { label: "Telefone/Internet", icon: "ti-wifi",          cor: "#a78bfa" },
  aluguel:         { label: "Aluguel",           icon: "ti-building",      cor: "#f87171" },
  manutencao:      { label: "Manutenção",        icon: "ti-tool",          cor: "#fb923c" },
  folha:           { label: "Folha de Pagamento",icon: "ti-users",         cor: "#34d399" },
  outros:          { label: "Outros",            icon: "ti-file",          cor: "#94a3b8" },
};

// Tipos de documentos legais
const TIPOS_DOC_LEGAL = {
  alvara_funcionamento: { label: "Alvará de Funcionamento",   orgao: "Prefeitura",          vigencia_anos: 1 },
  vigilancia_sanitaria: { label: "Vigilância Sanitária (CVS)",orgao: "Secretaria de Saúde", vigencia_anos: 1 },
  corpo_bombeiros:      { label: "AVCB — Bombeiros",          orgao: "Corpo de Bombeiros",  vigencia_anos: 3 },
  contrato_social:      { label: "Contrato Social",           orgao: "Junta Comercial",     vigencia_anos: 0 },
  cnpj_cartao:          { label: "Cartão CNPJ",               orgao: "Receita Federal",     vigencia_anos: 0 },
  seguro_incendio:      { label: "Seguro contra Incêndio",    orgao: "Seguradora",          vigencia_anos: 1 },
  certificado_mei:      { label: "Certificado MEI/Simples",   orgao: "Receita Federal",     vigencia_anos: 0 },
  licenca_ambiental:    { label: "Licença Ambiental",         orgao: "Secretaria de Meio Ambiente", vigencia_anos: 2 },
};

// ─────────────────────────────────────────────────────────────────────────────
// 1. NOTAS FISCAIS (NF-e)
// ─────────────────────────────────────────────────────────────────────────────

const _notas_fiscais = [];
let _nf_counter = 1;

// Seed NF-e de exemplo

// [CLEAN SLATE — seed block removido]
function listarNotas(loja_id, filtros = {}) {
  let lista = loja_id
    ? _notas_fiscais.filter(n => n.loja_id === loja_id)
    : [..._notas_fiscais];
  if (filtros.status) lista = lista.filter(n => n.status === filtros.status);
  if (filtros.categoria) lista = lista.filter(n => n.categoria_confirmada === filtros.categoria);
  if (filtros.emitente) lista = lista.filter(n => n.emitente.toLowerCase().includes(filtros.emitente.toLowerCase()));
  return lista.sort((a,b) => new Date(b.data_emissao) - new Date(a.data_emissao));
}

function getNota(nota_id) {
  return _notas_fiscais.find(n => n.id === nota_id) || null;
}

function simularRecebimentoNF(dados) {
  const { loja_id, emitente, cnpj_emitente, natureza, itens = [], valor_total } = dados;
  if (!loja_id || !emitente || !valor_total) return { sucesso: false, erro: "loja_id, emitente, valor_total obrigatorios" };

  // Auto-categoriza por palavras-chave
  const txt = (natureza + " " + emitente + " " + itens.map(i=>i.descricao||"").join(" ")).toLowerCase();
  let cat = "outros";
  if (/frango|carne|peixe|proteina|carne|queijo|lacticio|laticion/.test(txt)) cat = "insumos";
  else if (/bebida|refrig|suco|agua min|cerveja|vinho/.test(txt)) cat = "bebidas";
  else if (/gas|glp|botijao/.test(txt)) cat = "gas_cozinha";
  else if (/embalagem|descartavel|sachet|papel|toalha/.test(txt)) cat = "descartaveis";
  else if (/energia|eletric|celesc|cemig|enel|light/.test(txt)) cat = "energia";
  else if (/agua|saneamento|sabesp|copasa/.test(txt)) cat = "agua";
  else if (/telefone|internet|claro|vivo|tim|oi|net|fibra/.test(txt)) cat = "telefone";
  else if (/aluguel|locacao|imóvel|arrendamento/.test(txt)) cat = "aluguel";
  else if (/manutencao|conserto|tecnico|reparo/.test(txt)) cat = "manutencao";

  const agora = new Date();
  const nf = {
    id: `NF-${String(_nf_counter++).padStart(6,"0")}`,
    loja_id,
    cnpj_destinatario: CNPJS_LOJAS[loja_id]?.cnpj,
    razao_destinatario: CNPJS_LOJAS[loja_id]?.razao,
    emitente,
    cnpj_emitente: cnpj_emitente || "00.000.000/0001-00",
    chave_acesso: Array.from({length:44}, () => Math.floor(Math.random()*10)).join(""),
    numero_nf: String(Math.floor(Math.random()*900000+100000)).padStart(9,"0"),
    serie: "001",
    natureza_operacao: natureza || "Compra de mercadorias",
    data_emissao: agora.toISOString().split("T")[0],
    data_entrada: agora.toISOString().split("T")[0],
    itens: itens.length ? itens : [{ descricao: natureza || "Item", quantidade: 1, unidade: "UN", valor_unit: valor_total, valor_total }],
    valor_total: +parseFloat(valor_total).toFixed(2),
    icms_total: +(valor_total * 0.12).toFixed(2),
    pis_cofins: +(valor_total * 0.0365).toFixed(2),
    categoria_sugerida: cat,
    categoria_confirmada: cat,
    status: "autorizada",
    xml_simulado: true,
    recebida_em: agora.toISOString(),
  };
  _notas_fiscais.unshift(nf);

  db.criarNotificacao({
    loja_id, tipo: "fiscal", nivel: "info",
    titulo: `Nova NF-e recebida: ${emitente}`,
    mensagem: `NF ${nf.numero_nf} — R$ ${nf.valor_total.toFixed(2)} — Categoria: ${CATEGORIAS_BOLETO[cat]?.label || cat}`,
    acao: null,
  });

  return { sucesso: true, nota: nf };
}

function categorizarNota(nota_id, categoria) {
  const nf = _notas_fiscais.find(n => n.id === nota_id);
  if (!nf) return { sucesso: false, erro: "NF nao encontrada" };
  nf.categoria_confirmada = categoria;
  return { sucesso: true, nota: nf };
}

function resumoFiscal(loja_id) {
  const notas = listarNotas(loja_id);
  const por_categoria = {};
  for (const [key, meta] of Object.entries(CATEGORIAS_BOLETO)) {
    const itens = notas.filter(n => n.categoria_confirmada === key);
    por_categoria[key] = {
      ...meta,
      total: itens.length,
      valor_total: itens.reduce((s,n) => s+n.valor_total, 0).toFixed(2),
    };
  }
  return {
    loja_id: loja_id || "todas",
    total_notas: notas.length,
    valor_total_notas: notas.reduce((s,n) => s+n.valor_total, 0).toFixed(2),
    icms_recuperavel: notas.reduce((s,n) => s+n.icms_total, 0).toFixed(2),
    por_categoria,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. BOLETOS / CONTAS
// ─────────────────────────────────────────────────────────────────────────────

const _boletos = [];
let _bol_counter = 1;


// [CLEAN SLATE — seed block removido]
function listarBoletos(loja_id, filtros = {}) {
  let lista = loja_id ? _boletos.filter(b => b.loja_id === loja_id) : [..._boletos];
  if (filtros.categoria) lista = lista.filter(b => b.categoria === filtros.categoria);
  if (filtros.status) lista = lista.filter(b => b.status === filtros.status);

  const agora = new Date();
  return lista.map(b => {
    const venc = new Date(b.vencimento);
    const dias_venc = Math.ceil((venc - agora) / 86400000);
    let alerta = "ok";
    if (b.status === "pago") alerta = "pago";
    else if (dias_venc < 0) alerta = "vencido";
    else if (dias_venc <= 3) alerta = "urgente";
    else if (dias_venc <= 7) alerta = "atencao";
    return { ...b, dias_para_vencer: dias_venc, alerta };
  }).sort((a,b) => new Date(a.vencimento) - new Date(b.vencimento));
}

function criarBoleto(dados) {
  const { loja_id, descricao, credor, valor, vencimento, categoria } = dados;
  if (!loja_id || !descricao || !valor || !vencimento)
    return { sucesso: false, erro: "loja_id, descricao, valor, vencimento obrigatorios" };
  const bol = {
    id: `BOL-${String(_bol_counter++).padStart(5,"0")}`,
    loja_id, descricao, credor: credor||"", valor: +parseFloat(valor).toFixed(2),
    vencimento, categoria: categoria || "outros",
    status: "pendente",
    codigo_barras: Array.from({length:47}, ()=>Math.floor(Math.random()*10)).join(""),
    criado_em: new Date().toISOString(),
    pago_em: null,
  };
  _boletos.push(bol);
  return { sucesso: true, boleto: bol };
}

function pagarBoleto(bol_id) {
  const b = _boletos.find(x => x.id === bol_id);
  if (!b) return { sucesso: false, erro: "Boleto nao encontrado" };
  b.status = "pago";
  b.pago_em = new Date().toISOString();
  return { sucesso: true, boleto: b };
}

function resumoBoletos(loja_id) {
  const lista = listarBoletos(loja_id);
  const pendentes = lista.filter(b => b.status !== "pago");
  const vencidos = lista.filter(b => b.alerta === "vencido");
  const urgentes = lista.filter(b => b.alerta === "urgente");
  const total_pendente = pendentes.reduce((s,b) => s+b.valor, 0);
  return {
    total_boletos: lista.length,
    total_pendente: total_pendente.toFixed(2),
    vencidos: vencidos.length,
    urgentes: urgentes.length,
    valor_vencido: vencidos.reduce((s,b) => s+b.valor, 0).toFixed(2),
    por_categoria: Object.entries(CATEGORIAS_BOLETO).reduce((acc, [key, meta]) => {
      const itens = pendentes.filter(b => b.categoria === key);
      if (itens.length) acc[key] = { ...meta, qtd: itens.length, valor: itens.reduce((s,b) => s+b.valor, 0).toFixed(2) };
      return acc;
    }, {}),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. DOCUMENTOS LEGAIS
// ─────────────────────────────────────────────────────────────────────────────

const _docs_legais = [];
let _dl_counter = 1;


// [CLEAN SLATE — seed block removido]
function listarDocsLegais(loja_id) {
  const agora = new Date();
  return _docs_legais
    .filter(d => !loja_id || d.loja_id === loja_id)
    .map(d => {
      if (!d.data_vencimento) return { ...d, dias_para_vencer: null, alerta: "permanente" };
      const venc = new Date(d.data_vencimento);
      const dias = Math.ceil((venc - agora) / 86400000);
      let alerta = "ok";
      if (dias < 0) alerta = "vencido";
      else if (dias <= 30) alerta = "critico";
      else if (dias <= 90) alerta = "atencao";
      return { ...d, dias_para_vencer: dias, alerta };
    })
    .sort((a,b) => {
      const ordem = { vencido:0, critico:1, atencao:2, ok:3, permanente:4 };
      return (ordem[a.alerta]||5) - (ordem[b.alerta]||5);
    });
}

function upsertDocLegal(dados) {
  const { loja_id, tipo, numero_documento, data_emissao, data_vencimento, observacoes } = dados;
  if (!loja_id || !tipo) return { sucesso: false, erro: "loja_id e tipo obrigatorios" };

  const meta = TIPOS_DOC_LEGAL[tipo] || {};
  const existente = _docs_legais.find(d => d.loja_id === loja_id && d.tipo === tipo);

  if (existente) {
    if (numero_documento) existente.numero_documento = numero_documento;
    if (data_emissao) existente.data_emissao = data_emissao;
    if (data_vencimento !== undefined) existente.data_vencimento = data_vencimento;
    if (observacoes !== undefined) existente.observacoes = observacoes;
    existente.atualizado_em = new Date().toISOString();
    return { sucesso: true, doc: existente };
  }

  const doc = {
    id: `DL-${String(_dl_counter++).padStart(4,"0")}`,
    loja_id, tipo,
    label: meta.label || tipo,
    orgao: meta.orgao || "Orgao",
    numero_documento: numero_documento || "",
    data_emissao: data_emissao || new Date().toISOString().split("T")[0],
    data_vencimento: data_vencimento || null,
    vigencia_anos: meta.vigencia_anos || 0,
    arquivo_nome: null,
    arquivo_simulado: false,
    status: "ativo",
    observacoes: observacoes || "",
    criado_em: new Date().toISOString(),
  };
  _docs_legais.push(doc);

  if (data_vencimento) {
    const dias = Math.ceil((new Date(data_vencimento) - new Date()) / 86400000);
    if (dias <= 30) {
      db.criarNotificacao({
        loja_id, tipo: "documento", nivel: dias < 0 ? "critico" : "atencao",
        titulo: `${meta.label || tipo}: vence em ${dias < 0 ? "VENCIDO" : dias + " dias"}`,
        mensagem: `Documento ${meta.label} da ${db.lojas[loja_id]?.nome || loja_id} precisa de renovação.`,
        acao: null,
      });
    }
  }
  return { sucesso: true, doc };
}

function verificarAlertasDocumentos() {
  const todos = listarDocsLegais(null);
  const alertas = todos.filter(d => d.alerta === "vencido" || d.alerta === "critico");
  for (const d of alertas) {
    db.criarNotificacao({
      loja_id: d.loja_id,
      tipo: "documento",
      nivel: d.alerta === "vencido" ? "critico" : "atencao",
      titulo: `${d.alerta === "vencido" ? "VENCIDO" : "Vencendo"}: ${d.label} — ${db.lojas[d.loja_id]?.nome || d.loja_id}`,
      mensagem: d.alerta === "vencido"
        ? `${d.label} está VENCIDO desde ${d.data_vencimento}. Regularize imediatamente!`
        : `${d.label} vence em ${d.dias_para_vencer} dias (${d.data_vencimento}). Providencie a renovação.`,
      acao: null,
    });
  }
  return alertas;
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────
module.exports = {
  CNPJS_LOJAS,
  CATEGORIAS_BOLETO,
  TIPOS_DOC_LEGAL,
  // NF-e
  listarNotas,
  getNota,
  simularRecebimentoNF,
  categorizarNota,
  resumoFiscal,
  // Boletos
  listarBoletos,
  criarBoleto,
  pagarBoleto,
  resumoBoletos,
  // Docs Legais
  listarDocsLegais,
  upsertDocLegal,
  verificarAlertasDocumentos,
};
