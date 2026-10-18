// CARDÁPIO DIGITAL — regras puras (sem Next e sem banco).
//
// Quem usa: o servidor (lerCardapioPublico e criarPedidoPublico), a página do
// cliente (/cardapio/[unidade]) e o editor do painel (prévia ao vivo). As três
// pontas montam o cardápio com a MESMA função, então o que o dono vê na prévia
// é o que o cliente vê, e o preço que o cliente vê é o que o servidor cobra.
//
// De onde vem cada coisa:
//   - prato e drink: o produto de venda (`produtos`), ligado à ficha técnica
//     (`produtos.ficha_id`). Nome comercial, descrição comercial, categoria,
//     alergênicos e foto vêm da FICHA; o preço vem do PRODUTO (é o que o caixa
//     cobra — mesma regra da tela da ficha);
//   - vitrine (cores, fundo, capa, categorias do cardápio, destaques, selos,
//     promoções, textos da conversa): config_sistema.params.cardapio_digital,
//     sempre passando por normalizarConfigCardapio.
//
// Regras:
//   - promoção só BAIXA preço, nunca sobe; o servidor recalcula na hora do
//     pedido com precoEfetivo;
//   - prato sem preço (R$ 0,00), com a ficha desativada ou oculto pelo dono não
//     aparece e não pode ser pedido;
//   - a conversa responde com o que o dono marcou (destaques, selos,
//     promoções, categorias) e com o que está na ficha. Sem dado, ela diz que
//     não sabe: não inventa prato, preço, tempo nem "mais vendido";
//   - restrição alimentar: só o que está marcado, sempre com "confirme com a
//     equipe".

import {
  DIAS_T, HORAS_T, IDS_IDIOMAS, INTENCOES_T, LIGACOES_DIAS, ROTULO_PROMO_T, SAUDACOES, SELOS_T, TEXTOS_PADRAO,
  idiomaValido, infoIdioma, r as resposta, traduzirAlergeno,
} from "./cardapio-idiomas.mjs";
import { fidelidadePublica } from "./fidelidade.mjs";

export const FUSO_PADRAO = "America/Sao_Paulo";

export const FONTES = [
  { id: "classica", rotulo: "Clássica", detalhe: "Títulos com serifa e texto limpo" },
  { id: "editorial", rotulo: "Editorial", detalhe: "Títulos grandes, ar de revista" },
  { id: "moderna", rotulo: "Moderna", detalhe: "Tudo sem serifa, direto" },
];

export const ESTILOS_LISTA = [
  { id: "lista", rotulo: "Lista", detalhe: "Como um menu impresso; foto pequena ao lado" },
  { id: "cartoes", rotulo: "Cartões", detalhe: "Foto grande em cima de cada prato" },
];

export const PAPEIS_CATEGORIA = [
  { id: "comida", rotulo: "Comida" },
  { id: "bebida", rotulo: "Bebida" },
  { id: "sobremesa", rotulo: "Sobremesa" },
  { id: "outro", rotulo: "Outro" },
];

// O que o dono pode marcar em cada prato. "Sem glúten" e "Sem lactose" são
// declaração do restaurante — a conversa sempre pede para confirmar.
export const SELOS = [
  { id: "da_casa", rotulo: "Receita da casa" },
  { id: "novo", rotulo: "Novidade" },
  { id: "serve_2", rotulo: "Serve 2" },
  { id: "leve", rotulo: "Leve" },
  { id: "picante", rotulo: "Picante" },
  { id: "vegetariano", rotulo: "Vegetariano" },
  { id: "vegano", rotulo: "Vegano" },
  { id: "sem_gluten", rotulo: "Sem glúten" },
  { id: "sem_lactose", rotulo: "Sem lactose" },
  { id: "rapido", rotulo: "Sai rápido" },
];
const IDS_SELOS = new Set(SELOS.map((s) => s.id));

export const TIPOS_PROMOCAO = [
  { id: "desconto", rotulo: "Desconto em %" },
  { id: "preco", rotulo: "Preço especial" },
  { id: "aviso", rotulo: "Só um aviso (não muda preço)" },
];

export const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

// Combinações prontas para o dono começar. Ele pode trocar cada cor depois.
export const TEMAS_PRONTOS = [
  { id: "casa", nome: "Casa", tema: { cor_primaria: "#9a3412", cor_fundo: "#f6f1e8", cor_texto: "#221c16", cor_cartao: "#fffdf8" } },
  { id: "mata", nome: "Mata", tema: { cor_primaria: "#2f5d3a", cor_fundo: "#f1f3ec", cor_texto: "#1b241d", cor_cartao: "#fcfdf9" } },
  { id: "rio", nome: "Rio", tema: { cor_primaria: "#1f4e6b", cor_fundo: "#eef3f5", cor_texto: "#16232b", cor_cartao: "#fbfdfe" } },
  { id: "papel", nome: "Papel", tema: { cor_primaria: "#1c1917", cor_fundo: "#fafaf9", cor_texto: "#1c1917", cor_cartao: "#ffffff" } },
  { id: "acai", nome: "Açaí", tema: { cor_primaria: "#5b2245", cor_fundo: "#f7f0f3", cor_texto: "#24161e", cor_cartao: "#fffbfd" } },
  { id: "noite", nome: "Noite", tema: { cor_primaria: "#e0a84f", cor_fundo: "#1b1814", cor_texto: "#f3ece2", cor_cartao: "#25211b" } },
];

export const CONFIG_PADRAO = Object.freeze({
  tema: Object.freeze({
    ...TEMAS_PRONTOS[0].tema,
    fundo_imagem_url: "",
    fundo_opacidade: 0.12,
    capa_url: "",
    logo_url: "",
    fonte: "classica",
    estilo_lista: "lista",
  }),
  textos: Object.freeze({
    apresentacao: "",
    boas_vindas: "{saudacao}, {nome}! Que bom ter você aqui.",
    pedir_nome: "Antes de tudo: como podemos te chamar?",
    sugestao_bebida: "Que tal uma bebida para acompanhar?",
    sugestao_sobremesa: "E para fechar, uma sobremesa?",
    pedido_enviado: "Pedido recebido, {nome}. A equipe já está conferindo.",
    rodape: "",
  }),
  conversa: Object.freeze({
    ativa: true,
    nome_atendente: "",
    intro: "Posso te ajudar a escolher?",
  }),
  banner: Object.freeze([]),
  categorias: Object.freeze([]),
  itens: Object.freeze({}),
  promocoes: Object.freeze([]),
  // Idiomas que o cliente pode escolher (português sempre).
  idiomas: Object.freeze([...IDS_IDIOMAS]),
  // Tradução do que é do dono (pratos, seções, promoções, abertura, textos), por idioma.
  traducoes: Object.freeze({}),
  // Delivery: o mínimo e o grátis-acima valem também no servidor, na hora do pedido.
  entrega: Object.freeze({ pedido_minimo: 0, gratis_acima: 0, tempo_min: 0, tempo_max: 0 }),
  // O que aparece em "Mais informações" (cidade sempre; o resto, se o dono quiser).
  info: Object.freeze({ mostrar_horario: true, mostrar_endereco: false, mostrar_telefone: false }),
});

export const LIMITES = { banner: 8, categorias: 40, promocoes: 30, itens: 2000, produtosPorPromocao: 200 };

export const TIPOS_MIDIA = [
  { id: "imagem", rotulo: "Foto" },
  { id: "video", rotulo: "Vídeo" },
];
export const ACOES_BANNER = [
  { id: "", rotulo: "Nenhuma" },
  { id: "categoria", rotulo: "Abrir uma seção" },
  { id: "promocao", rotulo: "Mostrar uma promoção" },
  { id: "produto", rotulo: "Abrir um prato" },
];

// ─── LIMPEZA ─────────────────────────────────────────────────────────────────

const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
export const idValido = (v) => typeof v === "string" && ID_RE.test(v);

function texto(v, max) {
  if (v == null) return "";
  return String(v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").trim().slice(0, max);
}

export function limparCor(v, padrao) {
  const s = String(v ?? "").trim();
  if (/^#[0-9a-fA-F]{6}$/.test(s)) return s.toLowerCase();
  if (/^#[0-9a-fA-F]{3}$/.test(s)) return `#${s.slice(1).split("").map((c) => c + c).join("")}`.toLowerCase();
  return padrao;
}

/** Só https (e caminho do próprio site, "/..."). Nada de javascript:, data: ou http solto. */
export function limparUrl(v) {
  const s = String(v ?? "").trim();
  if (!s || s.length > 600) return "";
  if (/^\/(?!\/)[A-Za-z0-9_\-./%]*$/.test(s)) return s;
  try {
    const u = new URL(s);
    return u.protocol === "https:" ? u.href : "";
  } catch {
    return "";
  }
}

const bool = (v, padrao) => (typeof v === "boolean" ? v : padrao);
const hora = (v) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(v ?? "").trim());
  if (!m) return "";
  const h = Number(m[1]), mi = Number(m[2]);
  if (h > 24 || mi > 59 || (h === 24 && mi > 0)) return "";
  return `${String(h).padStart(2, "0")}:${m[2]}`;
};
const data = (v) => {
  const s = String(v ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return "";
  const d = new Date(`${s}T12:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s ? "" : s;
};
export const centavos = (v) => Math.round((Number(v) || 0) * 100) / 100;

function slug(v) {
  return String(v ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48);
}

/** Texto sem acento e minúsculo, para comparar o que o cliente digitou. */
export function normalizarBusca(v) {
  return String(v ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

/** Id novo, curto, que não colide com os existentes. */
export function gerarId(prefixo, existentes = []) {
  const usados = new Set(existentes);
  for (let i = 0; i < 50; i++) {
    const id = `${prefixo}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    if (!usados.has(id)) return id;
  }
  return `${prefixo}-${usados.size + 1}`;
}

// ─── CORES ───────────────────────────────────────────────────────────────────

function rgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function hexDe([r, g, b]) {
  return `#${[r, g, b].map((c) => Math.round(Math.max(0, Math.min(255, c))).toString(16).padStart(2, "0")).join("")}`;
}
export function luminancia(hex) {
  const [r, g, b] = rgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
/** Razão de contraste WCAG (1 a 21). */
export function contraste(a, b) {
  const [x, y] = [luminancia(a), luminancia(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}
/** Texto que fica legível em cima da cor (botão, selo). */
export function corSobre(fundo) {
  return contraste(fundo, "#ffffff") >= contraste(fundo, "#1c1917") ? "#ffffff" : "#1c1917";
}
/** Mistura a com b; t = quanto de b (0 a 1). */
export function misturar(a, b, t) {
  const [x, y] = [rgb(a), rgb(b)];
  return hexDe(x.map((c, i) => c + (y[i] - c) * t));
}

/**
 * Tema limpo e LEGÍVEL: se o dono escolher texto que some no fundo, o texto
 * vira escuro ou claro (o que contrastar mais). Devolve também as cores
 * derivadas que a página usa (linha, texto suave, cor dos preços).
 */
export function normalizarTema(t = {}) {
  const p = CONFIG_PADRAO.tema;
  const cor_fundo = limparCor(t.cor_fundo, p.cor_fundo);
  let cor_texto = limparCor(t.cor_texto, p.cor_texto);
  if (contraste(cor_texto, cor_fundo) < 4.5) cor_texto = corSobre(cor_fundo);
  let cor_cartao = limparCor(t.cor_cartao, p.cor_cartao);
  if (contraste(cor_texto, cor_cartao) < 4.5) cor_cartao = cor_fundo;
  const cor_primaria = limparCor(t.cor_primaria, p.cor_primaria);
  const op = Number(t.fundo_opacidade);
  return {
    cor_primaria,
    cor_fundo,
    cor_texto,
    cor_cartao,
    fundo_imagem_url: limparUrl(t.fundo_imagem_url),
    fundo_opacidade: Number.isFinite(op) ? Math.round(Math.max(0, Math.min(0.9, op)) * 100) / 100 : p.fundo_opacidade,
    capa_url: limparUrl(t.capa_url),
    logo_url: limparUrl(t.logo_url),
    fonte: FONTES.some((f) => f.id === t.fonte) ? t.fonte : p.fonte,
    estilo_lista: ESTILOS_LISTA.some((e) => e.id === t.estilo_lista) ? t.estilo_lista : p.estilo_lista,
  };
}

export function coresDoTema(tema) {
  const t = normalizarTema(tema);
  // Preço e link na cor do restaurante só se ela for legível no cartão.
  const destaque = contraste(t.cor_primaria, t.cor_cartao) >= 3 ? t.cor_primaria : t.cor_texto;
  return {
    primaria: t.cor_primaria,
    sobre_primaria: corSobre(t.cor_primaria),
    fundo: t.cor_fundo,
    texto: t.cor_texto,
    texto_suave: misturar(t.cor_texto, t.cor_fundo, 0.32),
    cartao: t.cor_cartao,
    linha: misturar(t.cor_texto, t.cor_fundo, 0.86),
    destaque,
    suave_primaria: misturar(t.cor_primaria, t.cor_cartao, 0.88),
  };
}

// ─── CONFIGURAÇÃO ────────────────────────────────────────────────────────────

function normalizarTextos(t = {}) {
  const p = CONFIG_PADRAO.textos;
  const limites = { apresentacao: 140, boas_vindas: 160, pedir_nome: 100, sugestao_bebida: 100, sugestao_sobremesa: 100, pedido_enviado: 160, rodape: 240 };
  const r = {};
  for (const [k, max] of Object.entries(limites)) {
    const v = t && typeof t[k] === "string" ? texto(t[k], max) : null;
    // Vazio de propósito vale para apresentação e rodapé; o resto volta ao padrão.
    r[k] = v == null ? p[k] : (v || (k === "apresentacao" || k === "rodape" ? "" : p[k]));
  }
  return r;
}

function normalizarConversa(c = {}) {
  const p = CONFIG_PADRAO.conversa;
  return {
    ativa: bool(c?.ativa, p.ativa),
    nome_atendente: texto(c?.nome_atendente, 30),
    intro: texto(c?.intro, 140) || p.intro,
  };
}

export function normalizarCategorias(lista) {
  const usados = new Set();
  const r = [];
  for (const c of Array.isArray(lista) ? lista : []) {
    if (r.length >= LIMITES.categorias) break;
    const nome = texto(c?.nome, 40);
    if (!nome) continue;
    let id = idValido(c?.id) ? c.id : `cat-${slug(nome) || r.length + 1}`;
    if (usados.has(id)) id = `${id}-${r.length + 1}`;
    usados.add(id);
    r.push({
      id,
      nome,
      descricao: texto(c?.descricao, 140),
      imagem_url: limparUrl(c?.imagem_url),
      visivel: bool(c?.visivel, true),
      papel: PAPEIS_CATEGORIA.some((p) => p.id === c?.papel) ? c.papel : "comida",
    });
  }
  return r;
}

export function normalizarItens(obj) {
  const r = {};
  let n = 0;
  for (const [id, it] of Object.entries(obj && typeof obj === "object" && !Array.isArray(obj) ? obj : {})) {
    if (n >= LIMITES.itens) break;
    if (!idValido(id) || !it || typeof it !== "object") continue;
    const item = {};
    if (idValido(it.categoria_id)) item.categoria_id = it.categoria_id;
    const descricao = texto(it.descricao, 280);
    if (descricao) item.descricao = descricao;
    const harmoniza = texto(it.harmoniza, 140);
    if (harmoniza) item.harmoniza = harmoniza;
    const selos = [...new Set((Array.isArray(it.selos) ? it.selos : []).filter((s) => IDS_SELOS.has(s)))];
    if (selos.length) item.selos = selos;
    if (it.destaque === true) item.destaque = true;
    if (it.oculto === true) item.oculto = true;
    if (Object.keys(item).length) { r[id] = item; n++; }
  }
  return r;
}

export function normalizarPromocao(p, i = 0) {
  const tipo = TIPOS_PROMOCAO.some((t) => t.id === p?.tipo) ? p.tipo : "aviso";
  // O editor guarda o que foi digitado ("29,90"); aqui vira número.
  const preco = centavos(String(p?.preco_promocional ?? "").replace(/\./g, (m, i, t) => (t.includes(",") ? "" : m)).replace(",", "."));
  const pct = Math.round(Number(p?.desconto_pct));
  const dias = [...new Set((Array.isArray(p?.dias_semana) ? p.dias_semana : []).map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort();
  return {
    id: idValido(p?.id) ? p.id : `promo-${i + 1}`,
    titulo: texto(p?.titulo, 60),
    texto: texto(p?.texto, 160),
    imagem_url: limparUrl(p?.imagem_url),
    produto_ids: [...new Set((Array.isArray(p?.produto_ids) ? p.produto_ids : []).filter(idValido))].slice(0, LIMITES.produtosPorPromocao),
    tipo,
    preco_promocional: tipo === "preco" && preco > 0 ? preco : null,
    desconto_pct: tipo === "desconto" && pct >= 1 && pct <= 90 ? pct : null,
    dias_semana: dias.length === 7 ? [] : dias,
    hora_inicio: hora(p?.hora_inicio),
    hora_fim: hora(p?.hora_fim),
    data_inicio: data(p?.data_inicio),
    data_fim: data(p?.data_fim),
    ativa: bool(p?.ativa, true),
  };
}

/** O que falta para a promoção valer — o editor mostra antes de salvar. */
export function errosDaPromocao(p) {
  const e = [];
  if (!texto(p?.titulo, 60)) e.push("Dê um nome à promoção.");
  const n = normalizarPromocao(p);
  if (n.tipo !== "aviso" && !n.produto_ids.length) e.push("Escolha os pratos da promoção.");
  if (n.tipo === "preco" && !n.preco_promocional) e.push("Informe o preço especial.");
  if (n.tipo === "desconto" && !n.desconto_pct) e.push("O desconto vai de 1% a 90%.");
  if (n.data_inicio && n.data_fim && n.data_fim < n.data_inicio) e.push("A data final vem antes da inicial.");
  if (n.hora_inicio && n.hora_fim && n.hora_inicio === n.hora_fim) e.push("Horário de início e fim iguais.");
  return e;
}

export function normalizarPromocoes(lista) {
  const usados = new Set();
  const r = [];
  for (const [i, p] of (Array.isArray(lista) ? lista : []).entries()) {
    if (r.length >= LIMITES.promocoes) break;
    const n = normalizarPromocao(p, i);
    if (!n.titulo) continue;
    if (usados.has(n.id)) n.id = `${n.id}-${i + 1}`;
    usados.add(n.id);
    r.push(n);
  }
  return r;
}

/** Banner de abertura: fotos e vídeos, cada um com um toque que leva a algum lugar. */
export function normalizarBanner(lista) {
  const usados = new Set();
  const r = [];
  for (const [i, b] of (Array.isArray(lista) ? lista : []).entries()) {
    if (r.length >= LIMITES.banner) break;
    const url = limparUrl(b?.url);
    if (!url) continue;
    let id = idValido(b?.id) ? b.id : `midia-${i + 1}`;
    if (usados.has(id)) id = `${id}-${i + 1}`;
    usados.add(id);
    const tipoAcao = ACOES_BANNER.some((a) => a.id && a.id === b?.acao?.tipo) ? b.acao.tipo : "";
    r.push({
      id,
      tipo: b?.tipo === "video" ? "video" : "imagem",
      url,
      poster_url: b?.tipo === "video" ? limparUrl(b?.poster_url) : "",
      titulo: texto(b?.titulo, 60),
      texto: texto(b?.texto, 120),
      acao: tipoAcao && idValido(b?.acao?.id) ? { tipo: tipoAcao, id: b.acao.id } : null,
    });
  }
  return r;
}

const LIMITE_TRAD = { produtos: { nome: 80, descricao: 280, harmoniza: 140 }, categorias: { nome: 40, descricao: 140 }, promocoes: { titulo: 60, texto: 160 }, banner: { titulo: 60, texto: 120 } };
const TEXTOS_TRADUZIVEIS = { apresentacao: 140, boas_vindas: 160, pedir_nome: 100, sugestao_bebida: 100, sugestao_sobremesa: 100, pedido_enviado: 160, rodape: 240 };

/** Traduções do dono: { en: { produtos: {id: {nome, descricao}}, categorias, promocoes, banner, textos, conversa } }. */
export function normalizarTraducoes(raw) {
  const out = {};
  for (const idioma of IDS_IDIOMAS) {
    if (idioma === "pt") continue;
    const t = raw?.[idioma];
    if (!t || typeof t !== "object") continue;
    const lado = {};
    for (const [grupo, campos] of Object.entries(LIMITE_TRAD)) {
      const g = {};
      let n = 0;
      for (const [id, v] of Object.entries(t[grupo] && typeof t[grupo] === "object" ? t[grupo] : {})) {
        if (n >= LIMITES.itens || !idValido(id) || !v || typeof v !== "object") continue;
        const item = {};
        for (const [c, max] of Object.entries(campos)) { const x = texto(v[c], max); if (x) item[c] = x; }
        if (Object.keys(item).length) { g[id] = item; n++; }
      }
      if (Object.keys(g).length) lado[grupo] = g;
    }
    const textos = {};
    for (const [k, max] of Object.entries(TEXTOS_TRADUZIVEIS)) { const x = texto(t.textos?.[k], max); if (x) textos[k] = x; }
    if (Object.keys(textos).length) lado.textos = textos;
    const intro = texto(t.conversa?.intro, 140);
    if (intro) lado.conversa = { intro };
    if (Object.keys(lado).length) out[idioma] = lado;
  }
  return out;
}

/**
 * O que o dono traduz, com o texto original ao lado: seções visíveis, pratos
 * no ar, promoções, abertura, apresentação e rodapé. Só entra campo que tem
 * texto no original. As frases do atendimento (boas-vindas, pedido enviado…)
 * não contam: elas já vêm prontas em cada idioma.
 */
export function camposParaTraduzir({ config, produtos = [], categorias = [] }) {
  const cfg = normalizarConfigCardapio(config);
  const out = [];
  const add = (grupo, id, campo, original) => {
    const o = String(original ?? "").trim();
    if (!o || !idValido(id)) return;
    out.push({ grupo, id, campo, original: o, max: grupo === "textos" ? TEXTOS_TRADUZIVEIS[campo] : LIMITE_TRAD[grupo][campo] });
  };
  for (const k of ["apresentacao", "rodape"]) add("textos", k, k, cfg.textos[k]);
  for (const c of categorias) if (c.visivel !== false) { add("categorias", c.id, "nome", c.nome); add("categorias", c.id, "descricao", c.descricao); }
  for (const p of produtos) { add("produtos", p.id, "nome", p.nome); add("produtos", p.id, "descricao", p.descricao); add("produtos", p.id, "harmoniza", p.harmoniza); }
  for (const p of cfg.promocoes) { add("promocoes", p.id, "titulo", p.titulo); add("promocoes", p.id, "texto", p.texto); }
  for (const b of cfg.banner) { add("banner", b.id, "titulo", b.titulo); add("banner", b.id, "texto", b.texto); }
  return out;
}

/** A tradução gravada de um campo (vazio quando não há). */
export function lerTraducao(traducoes, idioma, { grupo, id, campo }) {
  const t = traducoes?.[idioma] || {};
  if (grupo === "textos") return t.textos?.[id] || "";
  if (grupo === "conversa") return t.conversa?.[campo] || "";
  return t[grupo]?.[id]?.[campo] || "";
}

/** A configuração com a tradução de um campo trocada (sem mexer no resto). */
export function comTraducao(config, idioma, { grupo, id, campo }, valor) {
  if (!idiomaValido(idioma) || idioma === "pt") return config;
  const tr = { ...(config.traducoes || {}) };
  const lado = { ...(tr[idioma] || {}) };
  if (grupo === "textos") lado.textos = { ...(lado.textos || {}), [id]: valor };
  else if (grupo === "conversa") lado.conversa = { ...(lado.conversa || {}), [campo]: valor };
  else lado[grupo] = { ...(lado[grupo] || {}), [id]: { ...(lado[grupo]?.[id] || {}), [campo]: valor } };
  tr[idioma] = lado;
  return { ...config, traducoes: tr };
}

/** Quantos campos já têm tradução neste idioma, no total e por grupo. */
export function progressoDaTraducao(campos, traducoes, idioma) {
  const porGrupo = {};
  let feitos = 0;
  for (const c of campos) {
    const g = (porGrupo[c.grupo] ||= { feitos: 0, total: 0 });
    g.total++;
    if (String(lerTraducao(traducoes, idioma, c)).trim()) { g.feitos++; feitos++; }
  }
  return { feitos, total: campos.length, porGrupo };
}

const dinheiro = (v) => { const n = centavos(String(v ?? "").replace(/\./g, (m, i, x) => (x.includes(",") ? "" : m)).replace(",", ".")); return n > 0 ? n : 0; };
const minutos = (v) => { const n = Math.round(Number(v)); return Number.isFinite(n) && n > 0 && n <= 600 ? n : 0; };

export function normalizarEntrega(e = {}) {
  let tempo_min = minutos(e?.tempo_min);
  let tempo_max = minutos(e?.tempo_max);
  if (tempo_min && tempo_max && tempo_max < tempo_min) [tempo_min, tempo_max] = [tempo_max, tempo_min];
  return { pedido_minimo: dinheiro(e?.pedido_minimo), gratis_acima: dinheiro(e?.gratis_acima), tempo_min, tempo_max };
}

/** Tudo o que o dono salvou, limpo. Campo ruim volta ao padrão; nada quebra. */
export function normalizarConfigCardapio(raw) {
  const c = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  return {
    tema: normalizarTema(c.tema),
    textos: normalizarTextos(c.textos),
    conversa: normalizarConversa(c.conversa),
    banner: normalizarBanner(c.banner),
    categorias: normalizarCategorias(c.categorias),
    itens: normalizarItens(c.itens),
    promocoes: normalizarPromocoes(c.promocoes),
    idiomas: Array.isArray(c.idiomas) ? ["pt", ...IDS_IDIOMAS.filter((i) => i !== "pt" && c.idiomas.includes(i))] : [...IDS_IDIOMAS],
    traducoes: normalizarTraducoes(c.traducoes),
    entrega: normalizarEntrega(c.entrega),
    info: {
      mostrar_horario: bool(c.info?.mostrar_horario, true),
      mostrar_endereco: bool(c.info?.mostrar_endereco, false),
      mostrar_telefone: bool(c.info?.mostrar_telefone, false),
    },
  };
}

// ─── HORÁRIO E PROMOÇÕES ─────────────────────────────────────────────────────

const DIA_EN = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

/** Data, minuto do dia e dia da semana no fuso do restaurante. */
export function partesNoFuso(agora = new Date(), fuso = FUSO_PADRAO) {
  const d = agora instanceof Date ? agora : new Date(agora);
  let partes;
  try {
    partes = new Intl.DateTimeFormat("en-US", {
      timeZone: fuso, year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", weekday: "short", hourCycle: "h23",
    }).formatToParts(d);
  } catch {
    return partesNoFuso(d, FUSO_PADRAO);
  }
  const v = Object.fromEntries(partes.map((p) => [p.type, p.value]));
  const h = Number(v.hour) % 24;
  return { data: `${v.year}-${v.month}-${v.day}`, minutos: h * 60 + Number(v.minute), dia: DIA_EN[v.weekday] ?? 0 };
}

const minutosDe = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

/** A promoção vale agora? Horário que vira a noite (22:00–02:00) conta para o dia em que começou. */
export function promocaoVigente(promo, agora = new Date(), fuso = FUSO_PADRAO) {
  const p = normalizarPromocao(promo);
  if (!p.ativa || !p.titulo) return false;
  const { data: hoje, minutos, dia } = partesNoFuso(agora, fuso);
  if (p.data_inicio && hoje < p.data_inicio) return false;
  if (p.data_fim && hoje > p.data_fim) return false;
  const vale = (d) => !p.dias_semana.length || p.dias_semana.includes(d);
  const ini = p.hora_inicio ? minutosDe(p.hora_inicio) : 0;
  const fim = p.hora_fim ? minutosDe(p.hora_fim) : 24 * 60;
  if (ini < fim) return minutos >= ini && minutos < fim && vale(dia);
  if (minutos >= ini) return vale(dia);
  if (minutos < fim) return vale((dia + 6) % 7);
  return false;
}

export function promocoesVigentes(promocoes, agora = new Date(), fuso = FUSO_PADRAO) {
  return normalizarPromocoes(promocoes).filter((p) => promocaoVigente(p, agora, fuso));
}

/**
 * Preço que vale para o produto agora. Entre várias promoções, a mais barata.
 * Promoção que daria preço MAIOR que o normal é ignorada.
 */
export function precoEfetivo(produto, vigentes = []) {
  const original = centavos(produto?.preco_venda);
  let preco = original;
  let promocao_id = null;
  for (const p of vigentes) {
    if (!p.produto_ids.includes(String(produto?.id))) continue;
    let candidato = null;
    if (p.tipo === "preco" && p.preco_promocional) candidato = p.preco_promocional;
    if (p.tipo === "desconto" && p.desconto_pct) candidato = centavos(original * (1 - p.desconto_pct / 100));
    if (candidato != null && candidato > 0 && candidato < preco) {
      preco = candidato;
      promocao_id = p.id;
    }
  }
  return { preco, preco_original: promocao_id ? original : null, promocao_id };
}

// ─── TEXTOS DE PROMOÇÃO ──────────────────────────────────────────────────────

const FORMATOS_PRECO = new Map();
/** Preço no jeito de cada idioma (R$ 29,90 · R$29.90). A moeda é sempre o real. */
export function formatarPreco(v, idioma = "pt") {
  const locale = infoIdioma(idioma).locale;
  if (!FORMATOS_PRECO.has(locale)) FORMATOS_PRECO.set(locale, new Intl.NumberFormat(locale, { style: "currency", currency: "BRL", currencyDisplay: "narrowSymbol" }));
  return FORMATOS_PRECO.get(locale).format(Number(v) || 0).replace(/\u00a0|\u202f/g, " ");
}

const preencher = (modelo, vars) => String(modelo).replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));

function textoHora(hhmm, idioma) {
  if (idioma !== "pt") return hhmm === "24:00" ? "24:00" : hhmm;
  const [h, m] = hhmm.split(":");
  return m === "00" ? `${Number(h)}h` : `${Number(h)}h${m}`;
}

function textoData(iso, idioma) {
  const [a, m, d] = iso.split("-").map(Number);
  if (idioma === "pt" || idioma === "es" || idioma === "fr" || idioma === "it") return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}`;
  if (idioma === "en") return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(Date.UTC(a, m - 1, d));
  if (idioma === "ko") return `${m}월 ${d}일`;
  return `${m}月${d}日`;
}

export function textoDias(dias, idioma = "pt") {
  if (!dias?.length || dias.length === 7) return "";
  const nomes = DIAS_T[idioma] || DIAS_T.pt;
  const lig = LIGACOES_DIAS[idioma] || LIGACOES_DIAS.pt;
  const ordem = [1, 2, 3, 4, 5, 6, 0].filter((d) => dias.includes(d));
  const corridas = [];
  for (const d of ordem) {
    const ult = corridas[corridas.length - 1];
    const posAnterior = ult ? [1, 2, 3, 4, 5, 6, 0].indexOf(ult[ult.length - 1]) : -2;
    if (ult && [1, 2, 3, 4, 5, 6, 0].indexOf(d) === posAnterior + 1) ult.push(d);
    else corridas.push([d]);
  }
  if (corridas.length === 1 && corridas[0].length === 1 && (idioma === "ja" || idioma === "ko")) {
    return `${nomes[corridas[0][0]]}${idioma === "ja" ? "曜" : "요일"}`;
  }
  return corridas.map((c) => (c.length >= 3 ? preencher(lig.faixa, { a: nomes[c[0]], b: nomes[c[c.length - 1]] })
    : c.length === 2 ? preencher(lig.par, { a: nomes[c[0]], b: nomes[c[1]] }) : nomes[c[0]])).join(lig.lista);
}

/** "Seg a Sex · das 18h às 20h · até 31/10" — vazio quando vale sempre. */
export function quandoVale(promo, idioma = "pt") {
  const p = normalizarPromocao(promo);
  const h = HORAS_T[idioma] || HORAS_T.pt;
  const partes = [];
  const dias = textoDias(p.dias_semana, idioma);
  if (dias) partes.push(dias);
  if (p.hora_inicio && p.hora_fim) partes.push(preencher(h.entre, { a: textoHora(p.hora_inicio, idioma), b: textoHora(p.hora_fim, idioma) }));
  else if (p.hora_inicio) partes.push(preencher(h.desde, { a: textoHora(p.hora_inicio, idioma) }));
  else if (p.hora_fim) partes.push(preencher(h.ate, { b: textoHora(p.hora_fim, idioma) }));
  if (p.data_fim) partes.push(preencher(h.data, { d: textoData(p.data_fim, idioma) }));
  return partes.join(" · ");
}

export function rotuloDaPromocao(promo, idioma = "pt") {
  const p = normalizarPromocao(promo);
  const m = ROTULO_PROMO_T[idioma] || ROTULO_PROMO_T.pt;
  if (p.tipo === "desconto" && p.desconto_pct) {
    const zhe = String((100 - p.desconto_pct) / 10).replace(/\.0$/, "");
    return preencher(m.desconto, { pct: p.desconto_pct, zhe });
  }
  if (p.tipo === "preco" && p.preco_promocional) return preencher(m.preco, { valor: formatarPreco(p.preco_promocional, idioma) });
  return "";
}

export const rotuloSelo = (id, idioma = "pt") => SELOS_T[id]?.[idioma] || SELOS_T[id]?.pt || id;

// ─── CATEGORIAS ──────────────────────────────────────────────────────────────

const BEBIDA_RE = /bebida|drink|suco|cervej|vinho|refri|agua|cafe|coquetel|dose|chopp|caipi/;
const DOCE_RE = /sobremesa|doce|acai|sorvete|pudim|torta|bolo/;

/** Categoria de origem do produto: a da ficha técnica; sem ela, a do produto. */
export function categoriaDeOrigem(produto) {
  return texto(produto?.ficha?.categoria, 60) || texto(produto?.categoria, 60) || "Outros";
}

function papelProvavel(nome, departamento) {
  const n = normalizarBusca(nome);
  if (DOCE_RE.test(n)) return "sobremesa";
  if (String(departamento || "").toLowerCase() === "bar" || BEBIDA_RE.test(n)) return "bebida";
  return "comida";
}

/**
 * Categorias do cardápio. Se o dono ainda não montou as dele, saem das fichas
 * técnicas (e dos produtos sem ficha), na ordem comida → bebida → sobremesa.
 */
export function categoriasEfetivas(config, produtos = []) {
  const cfg = config?.categorias ? config : normalizarConfigCardapio(config);
  let cats = cfg.categorias.map((c) => ({ ...c }));
  if (!cats.length) {
    const vistos = new Map();
    for (const p of produtos) {
      const nome = categoriaDeOrigem(p);
      const id = `cat-${slug(nome) || "outros"}`;
      if (!vistos.has(id)) vistos.set(id, { id, nome, descricao: "", imagem_url: "", visivel: true, papel: papelProvavel(nome, p?.ficha?.departamento || p?.departamento) });
    }
    const ordem = { comida: 0, bebida: 1, sobremesa: 2, outro: 3 };
    cats = [...vistos.values()].sort((a, b) => ordem[a.papel] - ordem[b.papel]);
  }
  return cats;
}

/** Em que categoria do cardápio o produto entra. */
export function categoriaDoProduto(produto, categorias, itens = {}) {
  const escolhida = itens[produto?.id]?.categoria_id;
  if (escolhida && categorias.some((c) => c.id === escolhida)) return escolhida;
  const origem = categoriaDeOrigem(produto);
  const porId = `cat-${slug(origem) || "outros"}`;
  if (categorias.some((c) => c.id === porId)) return porId;
  const porNome = categorias.find((c) => normalizarBusca(c.nome) === normalizarBusca(origem));
  return porNome ? porNome.id : "outros";
}

// ─── MONTAGEM ────────────────────────────────────────────────────────────────

/**
 * Junta produto de venda, ficha técnica e alergênicos no formato que
 * montarCardapioPublico espera. Usado pelo servidor e pelo editor, para os
 * dois verem a mesma coisa. `fotoDaFicha(produtoId)` devolve o endereço que
 * serve a foto guardada na ficha (só chamado quando a ficha tem foto e o
 * produto não tem a dele).
 */
export function juntarProdutosEFichas(produtos = [], fichas = [], alergenicos = [], { fotoDaFicha = null, fichasComFoto = null } = {}) {
  const fichaPorId = new Map(fichas.map((f) => [String(f.id), f]));
  const alergPorFicha = new Map();
  for (const a of alergenicos) {
    const k = String(a.ficha_id);
    if (!alergPorFicha.has(k)) alergPorFicha.set(k, []);
    alergPorFicha.get(k).push(a.alergenico);
  }
  const comFoto = fichasComFoto ? new Set([...fichasComFoto].map(String)) : null;
  return produtos.map((p) => {
    const f = p.ficha_id != null ? fichaPorId.get(String(p.ficha_id)) : null;
    const temFotoNaFicha = f && (comFoto ? comFoto.has(String(f.id)) : Boolean(f.imagem));
    const fotoFicha = temFotoNaFicha
      ? ((/^https:\/\//.test(String(f.imagem || "")) && limparUrl(f.imagem)) || (fotoDaFicha ? fotoDaFicha(p.id) : ""))
      : "";
    return {
      id: p.id,
      nome_produto: p.nome_produto,
      preco_venda: p.preco_venda,
      categoria: p.categoria,
      departamento: p.departamento,
      imagem_url: p.imagem_url,
      ficha: f ? {
        id: f.id,
        nome_comercial: f.nome_comercial,
        descricao_comercial: f.descricao_comercial,
        categoria: f.categoria,
        departamento: f.departamento,
        ativo: f.ativo,
        status: f.status,
        alergenicos: alergPorFicha.get(String(f.id)) || [],
        pode_conter: f.alergenicos_pode_conter,
        imagem_url: fotoFicha,
      } : null,
    };
  });
}

/** Ficha desativada, arquivada ou inativa tira o prato do cardápio. */
function fichaAtiva(ficha) {
  if (!ficha) return true;
  if (ficha.ativo === false) return false;
  const s = normalizarBusca(ficha.status);
  return !s || s === "ativa" || s === "ativo";
}

function alergenicosDaFicha(ficha) {
  const lista = Array.isArray(ficha?.alergenicos) ? ficha.alergenicos : [];
  return [...new Set(lista.map((a) => texto(a, 40)).filter(Boolean))].slice(0, 12);
}

/**
 * O cardápio que o cliente vê. `produtos` chega do servidor (ou do editor) com
 * a ficha embutida: { id, nome_produto, preco_venda, categoria, departamento,
 * imagem_url, ficha: { nome_comercial, descricao_comercial, categoria,
 * departamento, ativo, status, alergenicos[], pode_conter, imagem_url } }.
 */
export function montarCardapioPublico({ unidade = {}, produtos = [], config, fidelidade = null, agora = new Date(), fuso = FUSO_PADRAO } = {}) {
  const cfg = normalizarConfigCardapio(config);
  const vigentes = promocoesVigentes(cfg.promocoes, agora, fuso);
  let categorias = categoriasEfetivas(cfg, produtos);
  const visivel = new Map(categorias.map((c) => [c.id, c.visivel]));

  const lista = [];
  const semCategoria = [];
  for (const p of produtos) {
    if (!idValido(String(p?.id ?? ""))) continue;
    const item = cfg.itens[p.id] || {};
    const original = centavos(p.preco_venda);
    if (!(original > 0) || item.oculto || !fichaAtiva(p.ficha)) continue;
    const categoria_id = categoriaDoProduto(p, categorias, cfg.itens);
    if (categoria_id === "outros" && !categorias.some((c) => c.id === "outros")) semCategoria.push(p.id);
    else if (visivel.get(categoria_id) === false) continue;
    const { preco, preco_original, promocao_id } = precoEfetivo(p, vigentes);
    lista.push({
      id: String(p.id),
      nome: texto(p.ficha?.nome_comercial, 80) || texto(p.nome_produto, 80),
      descricao: texto(p.ficha?.descricao_comercial, 280) || item.descricao || "",
      imagem_url: limparUrl(p.imagem_url) || limparUrl(p.ficha?.imagem_url) || null,
      preco,
      preco_original,
      promocao_id,
      selos: item.selos || [],
      alergenicos: alergenicosDaFicha(p.ficha),
      pode_conter: texto(p.ficha?.pode_conter, 160),
      harmoniza: item.harmoniza || "",
      destaque: item.destaque === true,
      categoria_id,
    });
  }
  if (semCategoria.length) categorias = [...categorias, { id: "outros", nome: "Outros", descricao: "", imagem_url: "", visivel: true, papel: "outro" }];

  const porNome = (a, b) => Number(b.destaque) - Number(a.destaque) || a.nome.localeCompare(b.nome, "pt-BR");
  const saidaCategorias = categorias
    .filter((c) => c.visivel)
    .map((c) => ({
      id: c.id, nome: c.nome, descricao: c.descricao, imagem_url: c.imagem_url || null, papel: c.papel,
      produto_ids: lista.filter((p) => p.categoria_id === c.id).sort(porNome).map((p) => p.id),
    }))
    .filter((c) => c.produto_ids.length);

  const ids = new Set(lista.map((p) => p.id));
  const promocoes = vigentes
    .map((p) => ({ ...p, produto_ids: p.produto_ids.filter((id) => ids.has(id)) }))
    .filter((p) => p.tipo === "aviso" || p.produto_ids.some((id) => lista.find((x) => x.id === id)?.promocao_id === p.id))
    .map((p) => ({
      id: p.id, titulo: p.titulo, texto: p.texto, imagem_url: p.imagem_url || null, tipo: p.tipo,
      produto_ids: p.produto_ids, rotulo: rotuloDaPromocao(p), quando: quandoVale(p),
      // dados crus: a página escreve rótulo e horário no idioma do cliente
      desconto_pct: p.desconto_pct, preco_promocional: p.preco_promocional, dias_semana: p.dias_semana,
      hora_inicio: p.hora_inicio, hora_fim: p.hora_fim, data_fim: p.data_fim,
    }));

  // Toque do banner que levaria a uma seção, promoção ou prato que não está
  // no ar agora vira banner sem toque (nunca um botão que não faz nada).
  const alvos = {
    categoria: new Set(saidaCategorias.map((c) => c.id)),
    promocao: new Set(promocoes.map((p) => p.id)),
    produto: ids,
  };
  const banner = cfg.banner.map((b) => ({ ...b, acao: b.acao && alvos[b.acao.tipo]?.has(b.acao.id) ? b.acao : null }));

  // Traduções só do que está no ar (nada de nome de prato escondido saindo por aqui).
  const ativos = { produtos: ids, categorias: alvos.categoria, promocoes: alvos.promocao, banner: new Set(banner.map((b) => b.id)) };
  const traducoes = {};
  for (const idioma of cfg.idiomas) {
    const t = cfg.traducoes[idioma];
    if (!t) continue;
    const lado = {};
    for (const grupo of Object.keys(ativos)) {
      const g = Object.fromEntries(Object.entries(t[grupo] || {}).filter(([id]) => ativos[grupo].has(id)));
      if (Object.keys(g).length) lado[grupo] = g;
    }
    if (t.textos) lado.textos = t.textos;
    if (t.conversa) lado.conversa = t.conversa;
    if (Object.keys(lado).length) traducoes[idioma] = lado;
  }

  return {
    idioma: "pt",
    idiomas: cfg.idiomas,
    unidade: {
      nome: texto(unidade.nome, 80),
      // Vale só para o delivery: pedido na mesa não depende disso.
      delivery_aberto: unidade.delivery_aberto !== false,
      taxa_entrega: centavos(unidade.taxa_entrega),
      cidade: texto(unidade.cidade, 60),
      uf: texto(unidade.uf, 2).toUpperCase(),
      horario: cfg.info.mostrar_horario ? texto(unidade.horario, 80) : "",
      endereco: cfg.info.mostrar_endereco ? texto(unidade.endereco, 160) : "",
      telefone: cfg.info.mostrar_telefone ? texto(unidade.telefone, 20) : "",
    },
    entrega: cfg.entrega,
    tema: cfg.tema,
    cores: coresDoTema(cfg.tema),
    textos: cfg.textos,
    conversa: cfg.conversa,
    banner,
    filtros: filtrosDisponiveis(lista),
    categorias: saidaCategorias,
    produtos: lista,
    promocoes,
    traducoes,
    // Regras do programa (cartões de selo e cashback) — nunca saldo nem dado de cliente.
    fidelidade: fidelidadePublica(fidelidade, lista.map((p) => p.id)),
  };
}

/**
 * O cardápio no idioma do cliente. Conteúdo do dono: a tradução dele, ou o
 * original (nunca tradução automática inventada). Textos fixos (selos,
 * promoções, saudação): os do idioma. O prato traduzido guarda o nome
 * original em `nome_original` — a equipe reconhece quando o cliente aponta.
 */
export function localizarCardapio(cardapio, idioma = "pt") {
  if (!cardapio) return cardapio;
  const id = idiomaValido(idioma) && (cardapio.idiomas || IDS_IDIOMAS).includes(idioma) ? idioma : "pt";
  const tr = id === "pt" ? {} : cardapio.traducoes?.[id] || {};
  const g = (grupo, chave) => tr[grupo]?.[chave] || {};
  const padrao = TEXTOS_PADRAO[id];
  const textos = { ...cardapio.textos };
  if (id !== "pt") {
    for (const k of ["boas_vindas", "pedir_nome", "sugestao_bebida", "sugestao_sobremesa", "pedido_enviado"]) textos[k] = tr.textos?.[k] || padrao[k];
    for (const k of ["apresentacao", "rodape"]) textos[k] = tr.textos?.[k] || cardapio.textos[k];
  }
  return {
    ...cardapio,
    idioma: id,
    textos,
    conversa: { ...cardapio.conversa, intro: id === "pt" ? cardapio.conversa.intro : tr.conversa?.intro || padrao.intro },
    produtos: cardapio.produtos.map((p) => {
      const t = g("produtos", p.id);
      return {
        ...p,
        nome: t.nome || p.nome,
        nome_original: t.nome && t.nome !== p.nome ? p.nome : "",
        descricao: t.descricao || p.descricao,
        harmoniza: t.harmoniza || p.harmoniza,
        alergenicos: p.alergenicos.map((a) => traduzirAlergeno(a, id)),
      };
    }),
    categorias: cardapio.categorias.map((c) => ({ ...c, nome: g("categorias", c.id).nome || c.nome, descricao: g("categorias", c.id).descricao || c.descricao })),
    promocoes: cardapio.promocoes.map((p) => ({
      ...p,
      titulo: g("promocoes", p.id).titulo || p.titulo,
      texto: g("promocoes", p.id).texto || p.texto,
      rotulo: rotuloDaPromocao(p, id),
      quando: quandoVale(p, id),
    })),
    banner: (cardapio.banner || []).map((b) => ({ ...b, titulo: g("banner", b.id).titulo || b.titulo, texto: g("banner", b.id).texto || b.texto })),
    filtros: (cardapio.filtros || []).map((f) => ({ ...f, rotulo: rotuloSelo(f.id, id) })),
  };
}

/** Filtros que têm prato atrás: nunca um filtro que mostra lista vazia. */
export function filtrosDisponiveis(produtos, idioma = "pt") {
  const conta = new Map();
  for (const p of produtos) for (const s of p.selos) conta.set(s, (conta.get(s) || 0) + 1);
  return SELOS.filter((s) => conta.get(s.id)).map((s) => ({ id: s.id, rotulo: rotuloSelo(s.id, idioma), total: conta.get(s.id) }));
}

/** Pratos que passam nos filtros (todos os selos marcados) e na busca. */
export function filtrarProdutos(produtos, { selos = [], busca = "" } = {}) {
  const termos = normalizarBusca(busca).split(" ").filter(Boolean);
  return produtos.filter((p) => selos.every((s) => p.selos.includes(s))
    && termos.every((t) => normalizarBusca(`${p.nome} ${p.descricao}`).includes(t)));
}

// ─── NOME E SAUDAÇÃO ─────────────────────────────────────────────────────────

export function saudacao(agora = new Date(), fuso = FUSO_PADRAO, idioma = "pt") {
  const { minutos } = partesNoFuso(agora, fuso);
  const [dia, tarde, noite] = SAUDACOES[idioma] || SAUDACOES.pt;
  if (minutos < 5 * 60) return noite;
  if (minutos < 12 * 60) return dia;
  if (minutos < 18 * 60) return tarde;
  return noite;
}

/** Primeiro nome, com a inicial maiúscula. Sem letra nenhuma, vazio. */
export function primeiroNome(nome) {
  const limpo = String(nome ?? "").normalize("NFC").replace(/<[^>]*>/g, " ").replace(/[^\p{L}\s'-]/gu, " ").trim().split(/\s+/)[0] || "";
  const curto = limpo.slice(0, 20).replace(/^['-]+|['-]+$/g, "");
  if (!curto) return "";
  return curto.split("-").map((p) => p.charAt(0).toLocaleUpperCase("pt-BR") + p.slice(1).toLocaleLowerCase("pt-BR")).join("-");
}

/**
 * Troca {nome} e {saudacao}. Sem nome, tira o nome e a vírgula que o
 * acompanha: "Pedido recebido, {nome}." → "Pedido recebido."
 */
export function aplicarNome(modelo, { nome = "", saudacao: s = "Olá" } = {}) {
  const n = primeiroNome(nome);
  // "[, {nome}]" (moldes dos outros idiomas): o trecho todo some sem nome.
  let t = String(modelo ?? "").replace(/\[([^[\]]*\{nome\}[^[\]]*)\]/g, (m, dentro) => (n ? dentro : "")).replace(/\{saudacao\}/g, s);
  if (n) return t.replace(/\{nome\}/g, n);
  if (!t.includes("{nome}")) return t.trim();
  t = t.replace(/,\s*\{nome\}/g, "").replace(/\{nome\}\s*,\s*/g, "").replace(/\s*\{nome\}/g, "").replace(/\{nome\}/g, "");
  t = t.replace(/\s+([!?.,])/g, "$1").replace(/\s{2,}/g, " ").trim();
  return t.charAt(0).toLocaleUpperCase("pt-BR") + t.slice(1);
}

// ─── CONVERSA ────────────────────────────────────────────────────────────────

const ORDEM_INTENCOES = ["sugestao", "promocoes", "compartilhar", "leve", "vegetariano", "bebida", "doce", "rapido", "restricao"];
/** Intenções da conversa. `palavras`: as de TODOS os idiomas (o turista pode escrever em inglês com o cardápio em português). */
export const INTENCOES = ORDEM_INTENCOES.map((id) => ({
  id,
  rotulo: INTENCOES_T[id].rotulo.pt,
  rotulos: INTENCOES_T[id].rotulo,
  palavras: [...new Set(INTENCOES_T[id].palavras.map((p) => normalizarBusca(p)).filter(Boolean))],
}));
const rotuloIntencao = (i, idioma) => i.rotulos[idioma] || i.rotulo;

const PALAVRAS_VAZIAS = new Set([
  "quero", "queria", "algo", "alguma", "algum", "tem", "voces", "vcs", "para", "pra", "com", "uma", "um", "que", "qual", "quais", "por", "favor",
  "gostaria", "hoje", "ai", "me", "de", "do", "da", "dos", "das", "e", "o", "a", "os", "as", "no", "na", "mais", "bem", "muito", "tipo", "ola", "oi",
  "boa", "bom", "noite", "dia", "tarde", "sim", "nao", "ver", "mostra", "mostrar",
  "what", "have", "you", "any", "the", "for", "with", "some", "there", "want", "like", "please", "can", "get", "your", "menu",
  "hay", "tienen", "tiene", "quiero", "con", "una", "los", "las", "del", "por", "favor",
  "avez", "vous", "est", "les", "des", "une", "pour", "avec", "voglio", "avete", "per", "con", "che", "una", "del",
]);

const TEM_CJK = /[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af\uf900-\ufaff]/;
// Pares de caracteres (chinês, japonês e coreano não separam palavras por espaço).
function bigramas(textoCjk) {
  const so = textoCjk.replace(/[^\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af\uf900-\ufaff]+/g, " ");
  const out = new Set();
  for (const bloco of so.split(" ")) for (let i = 0; i + 1 < bloco.length; i++) out.add(bloco.slice(i, i + 2));
  return [...out];
}

function buscarProdutos(consulta, cardapio) {
  const termos = normalizarBusca(consulta).replace(/[^\p{L}\p{N} ]+/gu, " ").split(" ")
    .filter((t) => t.length >= 3 && !PALAVRAS_VAZIAS.has(t) && !TEM_CJK.test(t));
  const pares = TEM_CJK.test(consulta) ? bigramas(consulta) : [];
  if (!termos.length && !pares.length) return { fortes: [], fracos: [] };
  const fortes = [];
  const fracos = [];
  for (const p of cardapio.produtos) {
    const nomeBruto = `${p.nome} ${p.nome_original || ""}`;
    const nome = normalizarBusca(nomeBruto);
    const desc = normalizarBusca(`${p.descricao} ${p.harmoniza}`);
    const noNome = termos.filter((t) => nome.includes(t)).length + pares.filter((b) => nomeBruto.includes(b)).length;
    if (noNome) fortes.push({ id: p.id, n: noNome });
    else if (termos.some((t) => desc.includes(t)) || pares.some((b) => `${p.descricao}`.includes(b))) fracos.push({ id: p.id, n: 1 });
  }
  const ord = (a, b) => b.n - a.n;
  return { fortes: fortes.sort(ord).map((x) => x.id), fracos: fracos.sort(ord).map((x) => x.id) };
}

/** O que o cliente quis dizer: uma intenção, uma busca por prato, ou nada. */
export function entenderMensagem(mensagem, cardapio) {
  const n = ` ${normalizarBusca(mensagem)} `;
  if (!n.trim()) return null;
  const { fortes, fracos } = buscarProdutos(mensagem, cardapio);
  if (fortes.length) return { tipo: "busca", consulta: texto(mensagem, 60), produto_ids: fortes.slice(0, 8) };
  const intencao = INTENCOES.find((i) => i.palavras.some((p) => n.includes(p)));
  if (intencao) return { tipo: "intencao", id: intencao.id };
  if (fracos.length) return { tipo: "busca", consulta: texto(mensagem, 60), produto_ids: fracos.slice(0, 8) };
  return { tipo: "busca", consulta: texto(mensagem, 60), produto_ids: [] };
}

const comSelo = (cardapio, ...selos) => cardapio.produtos.filter((p) => selos.some((s) => p.selos.includes(s)));
const ordenarVitrine = (lista) => [...lista].sort((a, b) =>
  Number(b.destaque) - Number(a.destaque) || Number(Boolean(b.promocao_id)) - Number(Boolean(a.promocao_id)) || a.nome.localeCompare(b.nome, "pt-BR"));
const doPapel = (cardapio, papel) => {
  const cats = new Set(cardapio.categorias.filter((c) => c.papel === papel).map((c) => c.id));
  return cardapio.produtos.filter((p) => cats.has(p.categoria_id));
};
const chipsDeIntencao = (idioma, excluir) => INTENCOES.filter((i) => i.id !== excluir && i.id !== "restricao").slice(0, 4)
  .map((i) => ({ tipo: "intencao", id: i.id, rotulo: rotuloIntencao(i, idioma) }));
const chipsDeCategoria = (cardapio, papel) => cardapio.categorias.filter((c) => !papel || c.papel === papel).slice(0, 6)
  .map((c) => ({ tipo: "categoria", id: c.id, rotulo: c.nome }));
const LATINOS = new Set(["pt", "en", "es", "fr", "it"]);

/**
 * Resposta da conversa, no idioma do cardápio (cardapio.idioma). Sempre a
 * partir do cardápio montado (o que o dono marcou e o que está na ficha).
 * Sem dado: diz que não tem e oferece outro caminho. Devolve { texto, produto_ids, acoes }.
 */
export function responderConversa(pedido, cardapio, { nome = "" } = {}) {
  const idioma = idiomaValido(cardapio?.idioma) ? cardapio.idioma : "pt";
  const R = (chave, vars) => resposta(idioma, chave, vars);
  const n = primeiroNome(nome);
  const comNome = (t) => {
    if (!n) return t;
    const corpo = LATINOS.has(idioma) ? `${t.charAt(0).toLocaleLowerCase(infoIdioma(idioma).locale)}${t.slice(1)}` : t;
    return R("com_nome", { nome: n, texto: corpo });
  };
  const ids = (lista, max = 8) => ordenarVitrine(lista).slice(0, max).map((p) => p.id);
  const out = (textoResp, produto_ids = [], acoes = []) => ({ texto: textoResp, produto_ids, acoes });

  if (!pedido) return out(R("nao_entendi"), [], chipsDeIntencao(idioma));

  if (pedido.tipo === "busca") {
    if (pedido.produto_ids.length) return out(R(pedido.produto_ids.length === 1 ? "achei_um" : "achei_varios"), pedido.produto_ids);
    return out(R("nao_achei", { q: pedido.consulta }), [], chipsDeIntencao(idioma));
  }

  const aviso = R("aviso_alergia");
  switch (pedido.id) {
    case "sugestao": {
      const d = cardapio.produtos.filter((p) => p.destaque);
      if (d.length) return out(comNome(R("sugestao_sim")), ids(d));
      return out(R("sugestao_nao"), [], chipsDeCategoria(cardapio));
    }
    case "promocoes": {
      if (!cardapio.promocoes.length) return out(R("promo_nao"), [], chipsDeCategoria(cardapio));
      const lista = cardapio.promocoes.map((p) => [p.titulo, p.rotulo, p.quando].filter(Boolean).join(" — ")).join("\n");
      const prods = cardapio.produtos.filter((p) => p.promocao_id);
      return out(`${R("promo_sim")}\n${lista}`, ids(prods));
    }
    case "compartilhar": {
      const l = comSelo(cardapio, "serve_2");
      if (l.length) return out(R("dividir_sim"), ids(l));
      return out(R("dividir_nao"), [], chipsDeIntencao(idioma, "compartilhar"));
    }
    case "leve": {
      const l = comSelo(cardapio, "leve");
      if (l.length) return out(R("leve_sim"), ids(l));
      return out(R("leve_nao"), [], chipsDeIntencao(idioma, "leve"));
    }
    case "vegetariano": {
      const l = comSelo(cardapio, "vegetariano", "vegano");
      if (l.length) return out(R("veg_sim"), ids(l));
      return out(R("veg_nao"), [], chipsDeIntencao(idioma, "vegetariano"));
    }
    case "bebida": {
      const l = doPapel(cardapio, "bebida");
      if (!l.length) return out(R("bebida_nao"));
      return out(R("bebida_sim"), ids(l, 6), chipsDeCategoria(cardapio, "bebida"));
    }
    case "doce": {
      const l = doPapel(cardapio, "sobremesa");
      if (!l.length) return out(R("doce_nao"));
      return out(R("doce_sim"), ids(l, 6), chipsDeCategoria(cardapio, "sobremesa"));
    }
    case "rapido": {
      const l = comSelo(cardapio, "rapido");
      if (l.length) return out(R("rapido_sim"), ids(l));
      return out(R("rapido_nao"));
    }
    case "restricao": {
      const l = comSelo(cardapio, "sem_gluten", "sem_lactose", "vegano");
      if (l.length) return out(R("restricao_sim", { aviso }), ids(l));
      return out(R("restricao_nao", { aviso }));
    }
    default:
      return out(R("nao_entendi"), [], chipsDeIntencao(idioma));
  }
}

/** Primeira mensagem da conversa, já com o nome, no idioma do cardápio. */
export function aberturaDaConversa(cardapio, { nome = "", agora = new Date(), fuso = FUSO_PADRAO } = {}) {
  const idioma = idiomaValido(cardapio?.idioma) ? cardapio.idioma : "pt";
  const intro = cardapio?.conversa?.intro || TEXTOS_PADRAO[idioma].intro;
  const modelo = TEXTOS_PADRAO[idioma].abertura.replace("{intro}", intro);
  return {
    texto: aplicarNome(modelo, { nome, saudacao: saudacao(agora, fuso, idioma) }),
    produto_ids: [],
    acoes: INTENCOES.filter((i) => ["sugestao", "promocoes", "compartilhar", "bebida", "doce", "restricao"].includes(i.id))
      .filter((i) => i.id !== "promocoes" || cardapio?.promocoes?.length)
      .map((i) => ({ tipo: "intencao", id: i.id, rotulo: rotuloIntencao(i, idioma) })),
  };
}

// ─── CARRINHO ────────────────────────────────────────────────────────────────

/** Total para MOSTRAR. Quem cobra é o servidor, que recalcula tudo. */
export function totalDoCarrinho(carrinho, cardapio, { tipo = "qrcode" } = {}) {
  const preco = new Map(cardapio.produtos.map((p) => [p.id, p.preco]));
  const subtotal = centavos((carrinho || []).reduce((s, i) => s + (preco.get(i.id) || 0) * (Number(i.quantidade) || 0), 0));
  const regras = taxaDeEntrega(subtotal, cardapio, tipo);
  return { subtotal, ...regras, total: centavos(subtotal + regras.taxa) };
}

/**
 * Taxa e regras do delivery para um subtotal: grátis acima de X e pedido
 * mínimo. A MESMA conta roda no servidor na hora do pedido.
 */
export function taxaDeEntrega(subtotal, cardapio, tipo = "delivery") {
  if (tipo !== "delivery") return { taxa: 0, falta_minimo: 0, falta_gratis: 0 };
  const e = cardapio?.entrega || {};
  const base = centavos(cardapio?.unidade?.taxa_entrega);
  const gratis = e.gratis_acima > 0 && subtotal >= e.gratis_acima;
  return {
    taxa: gratis ? 0 : base,
    falta_minimo: e.pedido_minimo > 0 && subtotal < e.pedido_minimo ? centavos(e.pedido_minimo - subtotal) : 0,
    falta_gratis: e.gratis_acima > 0 && base > 0 && !gratis ? centavos(e.gratis_acima - subtotal) : 0,
  };
}

/** Itens do carrinho que saíram do cardápio (ou mudaram de preço) desde que entraram. */
export function conferirCarrinho(carrinho, cardapio) {
  const atual = new Map(cardapio.produtos.map((p) => [p.id, p]));
  const validos = [];
  const removidos = [];
  for (const i of carrinho || []) {
    const p = atual.get(i.id);
    if (p) validos.push({ ...i, preco: p.preco, nome: p.nome });
    else removidos.push(i);
  }
  return { validos, removidos };
}

/** Uma sugestão para o carrinho: bebida se não tem, sobremesa se não tem. */
export function sugestaoParaCarrinho(carrinho, cardapio) {
  const noCarrinho = new Set((carrinho || []).map((i) => i.id));
  if (!noCarrinho.size) return null;
  const papelDe = new Map(cardapio.categorias.map((c) => [c.id, c.papel]));
  const papeis = new Set(cardapio.produtos.filter((p) => noCarrinho.has(p.id)).map((p) => papelDe.get(p.categoria_id)));
  for (const [papel, chave] of [["bebida", "sugestao_bebida"], ["sobremesa", "sugestao_sobremesa"]]) {
    if (papeis.has(papel)) continue;
    const opcoes = ordenarVitrine(doPapel(cardapio, papel).filter((p) => !noCarrinho.has(p.id))).slice(0, 3);
    if (opcoes.length) return { tipo: papel, texto: cardapio.textos?.[chave] || CONFIG_PADRAO.textos[chave], produto_ids: opcoes.map((p) => p.id) };
  }
  return null;
}
