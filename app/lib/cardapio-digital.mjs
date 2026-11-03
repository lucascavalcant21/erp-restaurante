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

// Formato das fotos dos pratos (Aparência): o dono escolhe.
export const FORMATOS_FOTO = [
  { id: "arredondada", rotulo: "Arredondadas" },
  { id: "quadrada", rotulo: "Quadradas" },
];
// Carrossel de banners (Abertura): segundos em cada banner e quantos aparecem juntos.
export const LIMITES_CARROSSEL = Object.freeze({ segundosMin: 2, segundosMax: 20, porVezMax: 3 });

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
  { id: "desconto_valor", rotulo: "Desconto em R$" },
  { id: "leve_mais", rotulo: "Pegue e leve mais" },
  { id: "frete_gratis", rotulo: "Frete grátis" },
  { id: "aviso", rotulo: "Só um aviso (não muda preço)" },
];

export const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

// Canais onde o cliente vê o cardápio (painel → Cardápio liga e desliga cada
// prato por canal). Garçom e PDV não entram: lá a equipe vê tudo que está ativo.
export const CANAIS_CARDAPIO = [
  { id: "tablet", rotulo: "Tablet" },
  { id: "qr", rotulo: "QR mesa" },
  { id: "delivery", rotulo: "Delivery" },
];
const IDS_CANAIS = new Set(CANAIS_CARDAPIO.map((c) => c.id));
const DATA_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Canal de onde veio o pedido do cliente (tipo gravado em pedidos.tipo_pedido). */
export function canalDoPedido(tipo) {
  if (tipo === "qrcode") return "qr";
  if (tipo === "tablet") return "tablet";
  return "delivery";
}

// Combinações prontas para o dono começar. Ele pode trocar cada cor depois.
export const TEMAS_PRONTOS = [
  // Padrão do cardápio novo (9L): verde-escuro e neutros só em cinza, nada de marrom.
  { id: "casa", nome: "Casa", tema: { cor_primaria: "#14532d", cor_fundo: "#ffffff", cor_texto: "#1a1a1a", cor_cartao: "#ffffff" } },
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
    formato_foto: "arredondada",
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
  carrossel: Object.freeze({ segundos: 6, por_vez: 1 }),
  wifi: Object.freeze({ rede: "", senha: "" }),
  categorias: Object.freeze([]),
  itens: Object.freeze({}),
  promocoes: Object.freeze([]),
  // Combos (27/10/2026): pratos juntos por um preço só.
  combos: Object.freeze([]),
  // Grupos de complementos reutilizáveis (painel → Editar produto).
  grupos: Object.freeze([]),
  // Idiomas que o cliente pode escolher (português sempre).
  idiomas: Object.freeze([...IDS_IDIOMAS]),
  // Tradução do que é do dono (pratos, seções, promoções, abertura, textos), por idioma.
  traducoes: Object.freeze({}),
  // Delivery: o mínimo e o grátis-acima valem também no servidor, na hora do pedido.
  entrega: Object.freeze({ pedido_minimo: 0, gratis_acima: 0, tempo_min: 0, tempo_max: 0, retirada: false, formas: Object.freeze(["dinheiro", "cartao"]) }),
  // O que aparece em "Mais informações" (cidade sempre; o resto, se o dono quiser).
  info: Object.freeze({ mostrar_horario: true, mostrar_endereco: false, mostrar_telefone: false }),
});

export const LIMITES = { banner: 8, categorias: 40, promocoes: 30, itens: 2000, produtosPorPromocao: 200, combos: 30, itensPorCombo: 8, grupos: 60, opcoesPorGrupo: 40, fotos: 3, videos: 1 };

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
    formato_foto: FORMATOS_FOTO.some((f) => f.id === t.formato_foto) ? t.formato_foto : p.formato_foto,
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
    // Canais em que o prato não aparece, e o dia (fuso da loja) em que esgotou:
    // "esgotado hoje" vale só nesse dia e o prato volta sozinho no seguinte.
    const fora = [...new Set((Array.isArray(it.canais_ocultos) ? it.canais_ocultos : []).filter((c) => IDS_CANAIS.has(c)))];
    if (fora.length) item.canais_ocultos = fora;
    if (typeof it.esgotado_dia === "string" && DATA_RE.test(it.esgotado_dia)) item.esgotado_dia = it.esgotado_dia;
    // Fotos e vídeo do prato (painel → Editar produto): a primeira foto é a capa.
    const midias = normalizarMidias(it.midias);
    if (midias.length) item.midias = midias;
    // Grupos de complementos ligados ao prato (os grupos ficam em config.grupos e servem a vários pratos).
    const grupos = [...new Set((Array.isArray(it.grupos) ? it.grupos : []).filter(idValido))].slice(0, 12);
    if (grupos.length) item.grupos = grupos;
    // "Só em dias e horários": fora disso o prato não aparece para o cliente.
    if (it.horario && typeof it.horario === "object") {
      const dias = [...new Set((Array.isArray(it.horario.dias_semana) ? it.horario.dias_semana : []).map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort();
      const h = { dias_semana: dias.length === 7 ? [] : dias, hora_inicio: hora(it.horario.hora_inicio), hora_fim: hora(it.horario.hora_fim) };
      if (h.dias_semana.length || h.hora_inicio || h.hora_fim) item.horario = h;
    }
    // Posição do prato na seção, escolhida pelo dono (1 = primeiro).
    const ordem = Math.round(Number(it.ordem));
    if (Number.isInteger(ordem) && ordem >= 1 && ordem <= 9999) item.ordem = ordem;
    if (Object.keys(item).length) { r[id] = item; n++; }
  }
  return r;
}

export function normalizarPromocao(p, i = 0) {
  const tipo = TIPOS_PROMOCAO.some((t) => t.id === p?.tipo) ? p.tipo : "aviso";
  // O editor guarda o que foi digitado ("29,90"); aqui vira número.
  const preco = centavos(String(p?.preco_promocional ?? "").replace(/\./g, (m, i, t) => (t.includes(",") ? "" : m)).replace(",", "."));
  const pct = Math.round(Number(p?.desconto_pct));
  const reais = (v) => centavos(String(v ?? "").replace(/\./g, (m, _i, t) => (t.includes(",") ? "" : m)).replace(",", "."));
  const valorOff = reais(p?.desconto_valor);
  const freteMin = reais(p?.frete_minimo);
  const leve = Math.min(10, Math.max(2, Math.round(Number(p?.leve)) || 2));
  const pague = Math.min(leve - 1, Math.max(1, Math.round(Number(p?.pague)) || 1));
  const canais = [...new Set((Array.isArray(p?.canais) ? p.canais : []).filter((c) => IDS_CANAIS.has(c)))];
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
    desconto_valor: tipo === "desconto_valor" && valorOff > 0 ? valorOff : null,
    pague: tipo === "leve_mais" ? pague : null,
    leve: tipo === "leve_mais" ? leve : null,
    frete_minimo: tipo === "frete_gratis" && freteMin > 0 ? freteMin : 0,
    // Canais onde vale (vazio = todos), "Agora na casa" e se soma com o DESCONTO do cadastro.
    canais: canais.length === CANAIS_CARDAPIO.length ? [] : canais,
    mostrar_agora: bool(p?.mostrar_agora, true),
    acumula_cadastro: bool(p?.acumula_cadastro, false),
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
  if (n.tipo !== "aviso" && n.tipo !== "frete_gratis" && !n.produto_ids.length) e.push("Escolha os pratos da promoção.");
  if (n.tipo === "desconto_valor" && !n.desconto_valor) e.push("Informe quanto sai do preço.");
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

// ─── COMBOS ──────────────────────────────────────────────────────────────────
// Combo = pratos juntos por um preço só (como no Goomer e no Cardápio Web).
// No cardápio vira um item da seção "Combos" (id "combo-<id>"); no pedido o
// servidor cobra o preço do combo e manda cada prato para a cozinha/bar.

export const PREFIXO_COMBO = "combo-";

export function normalizarCombo(c, i = 0) {
  const preco = centavos(String(c?.preco ?? "").replace(/\./g, (m, _i, t) => (t.includes(",") ? "" : m)).replace(",", "."));
  const dias = [...new Set((Array.isArray(c?.dias_semana) ? c.dias_semana : []).map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort();
  const vistos = new Set();
  const itens = [];
  for (const it of Array.isArray(c?.itens) ? c.itens : []) {
    const id = String(it?.produto_id ?? "");
    const q = Math.round(Number(it?.quantidade) || 1);
    if (!idValido(id) || vistos.has(id) || itens.length >= LIMITES.itensPorCombo) continue;
    vistos.add(id);
    itens.push({ produto_id: id, quantidade: Math.min(Math.max(q, 1), 10) });
  }
  const id = idValido(c?.id) && !String(c.id).startsWith(PREFIXO_COMBO) ? c.id : `c${i + 1}`;
  return {
    id,
    nome: texto(c?.nome, 60),
    descricao: texto(c?.descricao, 200),
    imagem_url: limparUrl(c?.imagem_url),
    itens,
    preco: preco > 0 ? preco : null,
    dias_semana: dias.length === 7 ? [] : dias,
    hora_inicio: hora(c?.hora_inicio),
    hora_fim: hora(c?.hora_fim),
    data_inicio: data(c?.data_inicio),
    data_fim: data(c?.data_fim),
    ativa: bool(c?.ativa, true),
  };
}

/** O que falta para o combo valer (o editor mostra antes de salvar). */
export function errosDoCombo(c) {
  const n = normalizarCombo(c);
  const e = [];
  if (!n.nome) e.push("Dê um nome ao combo.");
  if (n.itens.reduce((t, i) => t + i.quantidade, 0) < 2) e.push("Um combo tem pelo menos 2 itens.");
  if (!n.preco) e.push("Informe o preço do combo.");
  if (n.data_inicio && n.data_fim && n.data_fim < n.data_inicio) e.push("A data final vem antes da inicial.");
  return e;
}

export function normalizarCombos(lista) {
  const usados = new Set();
  const r = [];
  for (const [i, c] of (Array.isArray(lista) ? lista : []).entries()) {
    if (r.length >= LIMITES.combos) break;
    const n = normalizarCombo(c, i);
    if (!n.nome || !n.preco || n.itens.length < 1) continue;
    if (usados.has(n.id)) n.id = `${n.id}-${i + 1}`;
    usados.add(n.id);
    r.push(n);
  }
  return r;
}

/**
 * Combos que vão para o cardápio agora: vigentes, com TODOS os pratos no ar
 * (prato escondido, sem preço ou com ficha desativada tira o combo). Cada
 * combo vira um item da seção "Combos", com preço de/por quando o combo sai
 * mais barato que os pratos separados.
 * @param {Array} lista produtos já montados (id, nome, preco, imagem_url, alergenicos)
 */
export function combosNoCardapio(combos, lista, agora = new Date(), fuso = FUSO_PADRAO) {
  const porId = new Map(lista.map((p) => [p.id, p]));
  const r = [];
  for (const c of normalizarCombos(combos)) {
    if (!promocaoVigente({ ...c, titulo: c.nome }, agora, fuso)) continue;
    const partes = c.itens.map((i) => ({ ...i, produto: porId.get(i.produto_id) }));
    if (partes.some((x) => !x.produto) || partes.reduce((t, x) => t + x.quantidade, 0) < 2) continue;
    // "De": o que os pratos custariam separados AGORA (com promoção vigente), nunca um preço cheio inventado.
    const separado = centavos(partes.reduce((t, x) => t + x.produto.preco * x.quantidade, 0));
    r.push({
      id: `${PREFIXO_COMBO}${c.id}`,
      nome: c.nome,
      descricao: c.descricao || `Inclui ${partes.map((x) => `${x.quantidade}× ${x.produto.nome}`).join(" + ")}.`,
      imagem_url: c.imagem_url || partes.find((x) => x.produto.imagem_url)?.produto.imagem_url || null,
      preco: c.preco,
      preco_original: separado > c.preco ? separado : null,
      promocao_id: null,
      selos: [],
      alergenicos: [...new Set(partes.flatMap((x) => x.produto.alergenicos || []))].slice(0, 12),
      pode_conter: "",
      harmoniza: "",
      destaque: false,
      categoria_id: "combos",
      // preco = preço de cada prato agora (público); só serve para repartir o valor do combo no pedido.
      combo: { itens: partes.map((x) => ({ produto_id: x.produto_id, nome: x.produto.nome, quantidade: x.quantidade, preco: x.produto.preco })) },
    });
  }
  return r;
}

/**
 * Linhas do pedido de um combo: uma por unidade de prato (quantidade 1), com
 * o preço do combo repartido pelo preço normal de cada prato; os centavos que
 * sobram vão na última linha. A soma é exatamente preço do combo × quantidade.
 */
export function linhasDoCombo(combo, quantidade = 1) {
  const unidades = [];
  for (let q = 0; q < quantidade; q++) for (const it of combo.combo.itens) for (let k = 0; k < it.quantidade; k++) unidades.push(it);
  const totalCombo = centavos(combo.preco * quantidade);
  const base = unidades.reduce((t, u) => t + (u.preco || 0), 0);
  let usado = 0;
  return unidades.map((u, i) => {
    const valor = i === unidades.length - 1
      ? centavos(totalCombo - usado)
      : centavos(base > 0 ? totalCombo * (u.preco || 0) / base : totalCombo / unidades.length);
    usado = centavos(usado + valor);
    return { produto_id: u.produto_id, quantidade: 1, valor_unitario: valor };
  });
}

/** Banner de abertura: fotos e vídeos, cada um com um toque que leva a algum lugar. */
/** Velocidade (segundos em cada banner) e quantos aparecem juntos no carrossel. */
export function normalizarCarrossel(v = {}) {
  const L = LIMITES_CARROSSEL;
  const seg = Math.round(Number(v?.segundos));
  const por = Math.round(Number(v?.por_vez));
  return {
    segundos: Number.isFinite(seg) ? Math.min(L.segundosMax, Math.max(L.segundosMin, seg)) : 6,
    por_vez: Number.isFinite(por) ? Math.min(L.porVezMax, Math.max(1, por)) : 1,
  };
}

/** Wi-Fi dos clientes (9J): rede e senha que o tablet mostra. Sem senha = rede aberta. */
export function normalizarWifi(v = {}) {
  const rede = String(v?.rede ?? "").trim().slice(0, 32);
  return { rede, senha: rede ? String(v?.senha ?? "").slice(0, 63) : "" };
}

/** Texto do QR do Wi-Fi: WIFI:T:WPA;S:<rede>;P:<senha>;; (\ ; , : " escapados). "" sem rede. */
export function textoQrWifi(wifi) {
  const { rede, senha } = normalizarWifi(wifi);
  if (!rede) return "";
  const esc = (t) => t.replace(/([\\;,:"])/g, "\\$1");
  return senha ? `WIFI:T:WPA;S:${esc(rede)};P:${esc(senha)};;` : `WIFI:T:nopass;S:${esc(rede)};;`;
}

export function normalizarBanner(lista) {
  const usados = new Set();
  const r = [];
  for (const [i, b] of (Array.isArray(lista) ? lista : []).entries()) {
    if (r.length >= LIMITES.banner) break;
    const url = limparUrl(b?.url);
    // "prato": o banner é um prato do cardápio (foto, nome e preço vêm dele; o toque abre o prato).
    const prato = b?.tipo === "prato" && idValido(b?.acao?.id);
    if (!url && !prato) continue;
    let id = idValido(b?.id) ? b.id : `midia-${i + 1}`;
    if (usados.has(id)) id = `${id}-${i + 1}`;
    usados.add(id);
    const tipoAcao = ACOES_BANNER.some((a) => a.id && a.id === b?.acao?.tipo) ? b.acao.tipo : "";
    // Programação: dias da semana e horário em que o banner aparece (vazio = sempre).
    const dias = [...new Set((Array.isArray(b?.horario?.dias_semana) ? b.horario.dias_semana : []).map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort();
    const h = { dias_semana: dias.length === 7 ? [] : dias, hora_inicio: hora(b?.horario?.hora_inicio), hora_fim: hora(b?.horario?.hora_fim) };
    r.push({
      id,
      tipo: prato ? "prato" : b?.tipo === "video" ? "video" : "imagem",
      url: prato ? "" : url,
      poster_url: b?.tipo === "video" ? limparUrl(b?.poster_url) : "",
      titulo: texto(b?.titulo, 60),
      texto: texto(b?.texto, 120),
      acao: prato ? { tipo: "produto", id: b.acao.id } : tipoAcao && idValido(b?.acao?.id) ? { tipo: tipoAcao, id: b.acao.id } : null,
      ...(h.dias_semana.length || h.hora_inicio || h.hora_fim ? { horario: h } : {}),
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

// Formas de pagar na entrega/retirada que a loja aceita (pagamento pelo app
// ainda não existe: precisa de um intermediador). Sem escolha do dono, as duas
// que o pedido antigo já supunha: dinheiro (com troco) e cartão na maquininha.
export const FORMAS_PAGAMENTO = [
  { id: "dinheiro", rotulo: "Dinheiro" },
  { id: "cartao", rotulo: "Cartão na maquininha" },
  { id: "pix", rotulo: "Pix na entrega" },
  { id: "vale", rotulo: "Vale-refeição" },
];
const IDS_FORMAS = FORMAS_PAGAMENTO.map((f) => f.id);

export function normalizarEntrega(e = {}) {
  let tempo_min = minutos(e?.tempo_min);
  let tempo_max = minutos(e?.tempo_max);
  if (tempo_min && tempo_max && tempo_max < tempo_min) [tempo_min, tempo_max] = [tempo_max, tempo_min];
  const formas = IDS_FORMAS.filter((f) => (Array.isArray(e?.formas) ? e.formas : ["dinheiro", "cartao"]).includes(f));
  return {
    pedido_minimo: dinheiro(e?.pedido_minimo), gratis_acima: dinheiro(e?.gratis_acima), tempo_min, tempo_max,
    // Retirada no balcão: só quando o dono liga (sem taxa e sem endereço).
    retirada: bool(e?.retirada, false),
    formas: formas.length ? formas : ["dinheiro", "cartao"],
  };
}

/**
 * Salvar do editor sem apagar o que outra aba gravou: parte por parte
 * (tema, promoções, itens…), o que o editor não mexeu desde que abriu fica
 * como está no banco; o que mexeu, vale o do editor.
 * @param {object} banco config gravada agora
 * @param {object} base config que o editor carregou
 * @param {object} editado config do editor
 */
export function mesclarConfigCardapio(banco, base, editado) {
  const n = (v) => JSON.stringify(v ?? null);
  const b = normalizarConfigCardapio(banco);
  const o = normalizarConfigCardapio(base);
  const e = normalizarConfigCardapio(editado);
  const final = {};
  for (const k of Object.keys(e)) final[k] = n(e[k]) === n(o[k]) ? b[k] : e[k];
  return normalizarConfigCardapio(final);
}

/** Tudo o que o dono salvou, limpo. Campo ruim volta ao padrão; nada quebra. */
export function normalizarConfigCardapio(raw) {
  const c = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  return {
    tema: normalizarTema(c.tema),
    textos: normalizarTextos(c.textos),
    conversa: normalizarConversa(c.conversa),
    banner: normalizarBanner(c.banner),
    carrossel: normalizarCarrossel(c.carrossel),
    wifi: normalizarWifi(c.wifi),
    categorias: normalizarCategorias(c.categorias),
    itens: normalizarItens(c.itens),
    promocoes: normalizarPromocoes(c.promocoes),
    combos: normalizarCombos(c.combos),
    grupos: normalizarGrupos(c.grupos),
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
/** Fotos (até 3) e vídeo (até 1) do prato, só https; a primeira foto é a capa. */
export function normalizarMidias(lista) {
  const out = [];
  let fotos = 0;
  let videos = 0;
  for (const m of Array.isArray(lista) ? lista : []) {
    const url = limparUrl(m?.url);
    if (!url) continue;
    if (m.tipo === "video") {
      if (videos >= LIMITES.videos) continue;
      videos++;
      const poster = limparUrl(m.poster);
      out.push({ tipo: "video", url, ...(poster ? { poster } : {}) });
    } else {
      if (fotos >= LIMITES.fotos) continue;
      fotos++;
      out.push({ tipo: "foto", url });
    }
  }
  return out;
}

// Grupos de complementos (2.3 da spec): reutilizáveis entre pratos; mudar o
// grupo muda em todos. `retirar` = tirar ingrediente, sempre sem custo.
export const TIPOS_GRUPO = [
  { id: "adicional", rotulo: "Escolha ou adicional" },
  { id: "retirar", rotulo: "Retirar ingredientes (sem custo)" },
];
const IDS_TIPOS_GRUPO = new Set(TIPOS_GRUPO.map((t) => t.id));

export function normalizarGrupo(g, i = 0) {
  const tipo = IDS_TIPOS_GRUPO.has(g?.tipo) ? g.tipo : "adicional";
  const opcoes = [];
  const vistos = new Set();
  for (const [k, o] of (Array.isArray(g?.opcoes) ? g.opcoes : []).entries()) {
    const nome = texto(o?.nome, 60);
    if (!nome || opcoes.length >= LIMITES.opcoesPorGrupo) continue;
    let id = idValido(o?.id) && !vistos.has(o.id) ? o.id : `op-${k + 1}`;
    while (vistos.has(id)) id = `${id}-x`;
    vistos.add(id);
    const preco = tipo === "retirar" ? 0 : centavos(Math.max(0, Math.min(9999, Number(o?.preco) || 0)));
    opcoes.push({ id, nome, preco, ...(o?.esgotado === true ? { esgotado: true } : {}) });
  }
  const max = Math.max(1, Math.min(LIMITES.opcoesPorGrupo, Math.round(Number(g?.max) || 1)));
  const min = Math.max(0, Math.min(max, Math.round(Number(g?.min) || 0)));
  return {
    id: idValido(g?.id) ? g.id : `grupo-${i + 1}`,
    nome: texto(g?.nome, 60),
    descricao: texto(g?.descricao, 120),
    tipo,
    min: tipo === "retirar" ? 0 : min,
    max,
    opcoes,
  };
}

export function normalizarGrupos(lista) {
  const out = [];
  const ids = new Set();
  for (const [i, g] of (Array.isArray(lista) ? lista : []).entries()) {
    if (out.length >= LIMITES.grupos) break;
    const n = normalizarGrupo(g, i);
    if (!n.nome || ids.has(n.id)) continue;
    ids.add(n.id);
    out.push(n);
  }
  return out;
}

/**
 * Preço e texto de uma linha do pedido com os complementos escolhidos
 * (`opcoes` = { grupoId: [opcaoId, …] }). A MESMA conta roda na tela e no
 * servidor: confere mínimo/máximo de cada grupo e opção que não existe ou
 * esgotou. Sem grupos no prato, o preço é o do prato.
 */
export function precoDaLinha(produto, opcoes = {}) {
  const base = centavos(produto?.preco);
  const grupos = Array.isArray(produto?.grupos) ? produto.grupos : [];
  const escolhas = opcoes && typeof opcoes === "object" ? opcoes : {};
  for (const id of Object.keys(escolhas)) {
    if (!grupos.some((g) => g.id === id)) return { ok: false, erro: "opcao_invalida", preco: base, extra: 0, texto: "" };
  }
  let extra = 0;
  const partes = [];
  for (const g of grupos) {
    const ids = [...new Set((Array.isArray(escolhas[g.id]) ? escolhas[g.id] : []).map(String))];
    if (ids.length < g.min) return { ok: false, erro: "falta_escolha", grupo: g.id, preco: base, extra: 0, texto: "" };
    if (ids.length > g.max) return { ok: false, erro: "escolhas_demais", grupo: g.id, preco: base, extra: 0, texto: "" };
    const nomes = [];
    for (const id of ids) {
      const o = g.opcoes.find((x) => x.id === id);
      if (!o || o.esgotado) return { ok: false, erro: "opcao_invalida", grupo: g.id, preco: base, extra: 0, texto: "" };
      extra += g.tipo === "retirar" ? 0 : o.preco;
      nomes.push(o.nome);
    }
    if (nomes.length) partes.push(`${g.tipo === "retirar" ? "Sem" : g.nome}: ${nomes.join(", ")}`);
  }
  extra = centavos(extra);
  return { ok: true, preco: centavos(base + extra), extra, texto: partes.join(" · ").slice(0, 200) };
}

/** Grupo de escolha única obrigatória (ex.: Tamanho): mostra o preço cheio de cada opção. */
export const grupoDeTamanho = (g) => g.tipo !== "retirar" && g.min === 1 && g.max === 1;

/** "Obrigatório · escolher 1", "Opcional · até 2", "Opcional · sem custo". */
export function regraDoGrupo(g) {
  if (g.tipo === "retirar") return "Opcional · sem custo";
  if (g.min > 0) return g.min === g.max ? `Obrigatório · escolher ${g.min}` : `Obrigatório · de ${g.min} a ${g.max}`;
  return `Opcional · até ${g.max}`;
}

/** O prato está no horário que o dono marcou? Sem horário, sempre. */
export function itemNoHorario(item, agora = new Date(), fuso = FUSO_PADRAO) {
  const h = item?.horario;
  if (!h) return true;
  const { minutos, dia } = partesNoFuso(agora, fuso);
  const vale = (d) => !h.dias_semana?.length || h.dias_semana.includes(d);
  const ini = h.hora_inicio ? minutosDe(h.hora_inicio) : 0;
  const fim = h.hora_fim ? minutosDe(h.hora_fim) : 24 * 60;
  if (ini < fim) return minutos >= ini && minutos < fim && vale(dia);
  if (minutos >= ini) return vale(dia);
  if (minutos < fim) return vale((dia + 6) % 7);
  return false;
}

/**
 * Foto do prato tirada da Montagem (montagem.foto_url, bucket público
 * montagem-fotos), decidido pelo dono em 28/10/2026: vale quando o produto
 * não tem foto própria (nem no produto, nem na ficha) e o NOME bate exatamente
 * (sem diferença de maiúscula ou acento) com o produto, o nome comercial ou o
 * nome da receita da ficha. Nada de "parecido": sem nome igual, sem foto.
 */
export function aplicarFotosDaMontagem(produtos = [], { fichas = [], fichasComFoto = [], montagens = [] } = {}) {
  const fotos = new Map();
  for (const m of montagens) {
    const url = limparUrl(m?.foto_url);
    const chave = normalizarBusca(m?.nome);
    if (url && chave && !fotos.has(chave)) fotos.set(chave, url);
  }
  if (!fotos.size) return produtos;
  const fichaPorId = new Map(fichas.map((f) => [String(f.id), f]));
  const comFoto = new Set(fichasComFoto.map(String));
  return produtos.map((p) => {
    if (limparUrl(p.imagem_url) || (p.ficha_id != null && comFoto.has(String(p.ficha_id)))) return p;
    const f = p.ficha_id != null ? fichaPorId.get(String(p.ficha_id)) : null;
    const url = [p.nome_produto, f?.nome_comercial, f?.nome_receita].map(normalizarBusca).filter(Boolean).map((k) => fotos.get(k)).find(Boolean);
    return url ? { ...p, imagem_url: url } : p;
  });
}

/** "Esgotado hoje": o dono marcou o prato como esgotado no dia de hoje (fuso da loja). */
export function esgotadoHoje(item, agora = new Date(), fuso = FUSO_PADRAO) {
  return !!item?.esgotado_dia && item.esgotado_dia === partesNoFuso(agora, fuso).data;
}

/** Canais em que o prato aparece para o cliente (oculto = em nenhum). */
export function canaisDoItem(item) {
  if (item?.oculto) return [];
  const fora = new Set(item?.canais_ocultos || []);
  return CANAIS_CARDAPIO.map((c) => c.id).filter((id) => !fora.has(id));
}

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
    if (p.tipo === "desconto_valor" && p.desconto_valor) candidato = centavos(original - p.desconto_valor);
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
  if (p.tipo === "desconto_valor" && p.desconto_valor) return preencher(m.valor, { valor: formatarPreco(p.desconto_valor, idioma) });
  if (p.tipo === "leve_mais") return preencher(m.leve, { pague: p.pague, leve: p.leve });
  if (p.tipo === "frete_gratis") return m.frete;
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

// "Adicional - Arroz branco": no cardápio real, 26 dos 83 itens de Pratos
// Principais (27/10/2026). Sem seção escolhida pelo dono, vão para uma seção
// "Adicionais" própria, depois dos pratos (como no iFood e no Goomer).
export const SECAO_ADICIONAIS = "Adicionais";
const ehAdicionalNome = (p) => /^adiciona(l|is)\b/.test(normalizarBusca(p?.ficha?.nome_comercial || p?.nome_produto || p?.nome || ""));

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
    let adicionais = false;
    for (const p of produtos) {
      if (ehAdicionalNome(p) && !cfg.itens?.[p?.id]?.categoria_id) { adicionais = true; continue; }
      const nome = categoriaDeOrigem(p);
      const id = `cat-${slug(nome) || "outros"}`;
      if (!vistos.has(id)) vistos.set(id, { id, nome, descricao: "", imagem_url: "", visivel: true, papel: papelProvavel(nome, p?.ficha?.departamento || p?.departamento) });
    }
    const ordem = { comida: 0, bebida: 1, sobremesa: 2, outro: 3 };
    cats = [...vistos.values()].sort((a, b) => ordem[a.papel] - ordem[b.papel]);
    // Adicionais logo depois das seções de comida.
    if (adicionais) {
      const i = cats.findIndex((c) => c.papel !== "comida");
      cats.splice(i < 0 ? cats.length : i, 0, { id: "cat-adicionais", nome: SECAO_ADICIONAIS, descricao: "", imagem_url: "", visivel: true, papel: "comida" });
    }
  }
  return cats;
}

/** Em que categoria do cardápio o produto entra. */
export function categoriaDoProduto(produto, categorias, itens = {}) {
  const escolhida = itens[produto?.id]?.categoria_id;
  if (escolhida && categorias.some((c) => c.id === escolhida)) return escolhida;
  if (ehAdicionalNome(produto) && categorias.some((c) => c.id === "cat-adicionais")) return "cat-adicionais";
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
export function fichaAtiva(ficha) {
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
/** Grupos de complementos de um prato no cardápio público: só opções que estão à venda. */
function gruposDoItem(item, gruposPorId) {
  return (item.grupos || []).map((id) => gruposPorId.get(id)).filter(Boolean)
    .map((g) => ({ id: g.id, nome: g.nome, descricao: g.descricao, tipo: g.tipo, min: g.min, max: g.max, opcoes: g.opcoes.filter((o) => !o.esgotado).map(({ id, nome, preco }) => ({ id, nome, preco })) }))
    .filter((g) => g.opcoes.length)
    .map((g) => ({ ...g, min: Math.min(g.min, g.opcoes.length), max: Math.min(g.max, g.opcoes.length) }));
}

export function montarCardapioPublico({ unidade = {}, produtos = [], config, fidelidade = null, agora = new Date(), fuso = FUSO_PADRAO } = {}) {
  const cfg = normalizarConfigCardapio(config);
  const vigentes = promocoesVigentes(cfg.promocoes, agora, fuso);
  let categorias = categoriasEfetivas(cfg, produtos);
  const visivel = new Map(categorias.map((c) => [c.id, c.visivel]));
  const gruposPorId = new Map(cfg.grupos.map((g) => [g.id, g]));

  const lista = [];
  const semCategoria = [];
  for (const p of produtos) {
    if (!idValido(String(p?.id ?? ""))) continue;
    const item = cfg.itens[p.id] || {};
    const original = centavos(p.preco_venda);
    if (!(original > 0) || item.oculto || !fichaAtiva(p.ficha) || esgotadoHoje(item, agora, fuso) || !itemNoHorario(item, agora, fuso)) continue;
    const categoria_id = categoriaDoProduto(p, categorias, cfg.itens);
    if (categoria_id === "outros" && !categorias.some((c) => c.id === "outros")) semCategoria.push(p.id);
    else if (visivel.get(categoria_id) === false) continue;
    const { preco, preco_original, promocao_id } = precoEfetivo(p, vigentes);
    lista.push({
      id: String(p.id),
      nome: texto(p.ficha?.nome_comercial, 80) || texto(p.nome_produto, 80),
      descricao: texto(p.ficha?.descricao_comercial, 280) || item.descricao || "",
      imagem_url: (item.midias || []).find((m) => m.tipo === "foto")?.url || limparUrl(p.imagem_url) || limparUrl(p.ficha?.imagem_url) || null,
      ...(item.midias?.length ? { midias: item.midias } : {}),
      preco,
      preco_original,
      promocao_id,
      selos: item.selos || [],
      alergenicos: alergenicosDaFicha(p.ficha),
      pode_conter: texto(p.ficha?.pode_conter, 160),
      harmoniza: item.harmoniza || "",
      destaque: item.destaque === true,
      ordem: item.ordem || null,
      categoria_id,
      ...(item.canais_ocultos ? { fora_dos_canais: item.canais_ocultos } : {}),
      ...(gruposDoItem(item, gruposPorId).length ? { grupos: gruposDoItem(item, gruposPorId) } : {}),
    });
  }
  const combos = combosNoCardapio(cfg.combos, lista, agora, fuso);
  if (semCategoria.length) categorias = [...categorias, { id: "outros", nome: "Outros", descricao: "", imagem_url: "", visivel: true, papel: "outro" }];

  // Destaque do dono primeiro; "Adicional - …" depois dos pratos (a ordem
  // alfabética punha 20 adicionais no topo dos Pratos Principais).
  const ehAdicional = (p) => /^adiciona(l|is)\b/.test(normalizarBusca(p.nome));
  // Posição escolhida pelo dono vem antes de tudo; sem posição, a regra de antes.
  const pos = (p) => (p.ordem > 0 ? p.ordem : Infinity);
  const porNome = (a, b) => pos(a) - pos(b) || Number(b.destaque) - Number(a.destaque) || Number(ehAdicional(a)) - Number(ehAdicional(b)) || a.nome.localeCompare(b.nome, "pt-BR");
  const saidaCategorias = categorias
    .filter((c) => c.visivel)
    .map((c) => ({
      id: c.id, nome: c.nome, descricao: c.descricao, imagem_url: c.imagem_url || null, papel: c.papel,
      produto_ids: lista.filter((p) => p.categoria_id === c.id).sort(porNome).map((p) => p.id),
    }))
    .filter((c) => c.produto_ids.length);
  if (combos.length) saidaCategorias.unshift({ id: "combos", nome: "Combos", descricao: "", imagem_url: null, papel: "comida", produto_ids: combos.map((c) => c.id) });

  const ids = new Set(lista.map((p) => p.id));
  const promocoes = vigentes
    .map((p) => ({ ...p, produto_ids: p.produto_ids.filter((id) => ids.has(id)) }))
    .filter((p) => p.tipo === "aviso" || p.tipo === "frete_gratis" || (p.tipo === "leve_mais" && p.produto_ids.length)
      || p.produto_ids.some((id) => lista.find((x) => x.id === id)?.promocao_id === p.id))
    .map((p) => ({
      id: p.id, titulo: p.titulo, texto: p.texto, imagem_url: p.imagem_url || null, tipo: p.tipo,
      produto_ids: p.produto_ids, rotulo: rotuloDaPromocao(p), quando: quandoVale(p),
      // dados crus: a página escreve rótulo e horário no idioma do cliente
      desconto_pct: p.desconto_pct, preco_promocional: p.preco_promocional, dias_semana: p.dias_semana,
      hora_inicio: p.hora_inicio, hora_fim: p.hora_fim, data_fim: p.data_fim,
      desconto_valor: p.desconto_valor, pague: p.pague, leve: p.leve, frete_minimo: p.frete_minimo,
      canais: p.canais, mostrar_agora: p.mostrar_agora, acumula_cadastro: p.acumula_cadastro,
    }));

  // Toque do banner que levaria a uma seção, promoção ou prato que não está
  // no ar agora vira banner sem toque (nunca um botão que não faz nada).
  const alvos = {
    categoria: new Set(saidaCategorias.map((c) => c.id)),
    promocao: new Set(promocoes.map((p) => p.id)),
    produto: ids,
  };
  const porIdLista = new Map(lista.map((p) => [p.id, p]));
  const banner = cfg.banner.flatMap((b) => {
    if (b.tipo !== "prato") return [{ ...b, acao: b.acao && alvos[b.acao.tipo]?.has(b.acao.id) ? b.acao : null }];
    // Banner de prato: só com o prato no ar e com foto; o resto vem do próprio prato.
    const p = porIdLista.get(b.acao.id);
    const foto = p?.imagem_url || p?.midias?.find((m) => m.tipo === "foto" && m.url)?.url || "";
    if (!p || !foto) return [];
    return [{ ...b, tipo: "imagem", url: foto, titulo: b.titulo || p.nome, texto: b.texto || formatarPreco(p.preco), prato: true }];
  });

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
    carrossel: cfg.carrossel,
    wifi: cfg.wifi.rede ? cfg.wifi : null,
    filtros: filtrosDisponiveis(lista),
    categorias: saidaCategorias,
    // Combos entram como itens (a página e o carrinho tratam igual); preco_base e ordem são internos.
    produtos: [...combos, ...lista].map(({ ordem, ...p }) => p),
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
/**
 * A conta do pedido, igual na tela e no servidor:
 *   subtotal ............. itens × preço do cardápio (já com desconto/preço da promoção)
 *   desconto_promocoes ... "pegue X, leve Y" (as unidades de graça)
 *   base_cadastro ........ o que entra no DESCONTO do cadastro: item com
 *                          promoção que não acumula fica de fora
 *   taxa ................. entrega (zero com "frete grátis" no ar)
 */
export function totalDoCarrinho(carrinho, cardapio, { tipo = "qrcode" } = {}) {
  const porId = new Map(cardapio.produtos.map((p) => [p.id, p]));
  const promos = cardapio.promocoes || [];
  const promoPorId = new Map(promos.map((p) => [p.id, p]));
  const leveDe = new Map();
  for (const p of promos) if (p.tipo === "leve_mais" && p.leve > p.pague) for (const id of p.produto_ids || []) if (!leveDe.has(id)) leveDe.set(id, p);
  let subtotal = 0;
  let descontoPromo = 0;
  let baseCadastro = 0;
  for (const i of carrinho || []) {
    const p = porId.get(i.id);
    const q = Number(i.quantidade) || 0;
    if (!p || q <= 0) continue;
    // Complementos escolhidos (tamanho, adicionais) entram no preço da linha.
    const linha = i.opcoes ? precoDaLinha(p, i.opcoes) : null;
    const valor = (linha?.ok ? linha.preco : p.preco || 0) * q;
    const leve = leveDe.get(i.id);
    const gratis = leve ? Math.floor(q / leve.leve) * (leve.leve - leve.pague) * (p.preco || 0) : 0;
    subtotal += valor;
    descontoPromo += gratis;
    const promo = (gratis > 0 ? leve : null) || promoPorId.get(p.promocao_id);
    if (!promo || promo.acumula_cadastro) baseCadastro += valor - gratis;
  }
  subtotal = centavos(subtotal);
  const desconto_promocoes = centavos(descontoPromo);
  const pago = centavos(subtotal - desconto_promocoes);
  const regras = taxaDeEntrega(pago, cardapio, tipo);
  const frete = tipo === "delivery" && promos.some((p) => p.tipo === "frete_gratis" && pago >= (p.frete_minimo || 0));
  const taxa = frete ? 0 : regras.taxa;
  return {
    subtotal, desconto_promocoes, base_cadastro: centavos(baseCadastro), ...regras,
    taxa, falta_gratis: frete ? 0 : regras.falta_gratis, frete_promocao: frete && regras.taxa > 0,
    total: centavos(pago + taxa),
  };
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
/**
 * O cardápio que um canal vê: tira os pratos que o dono desligou nesse canal
 * (e as seções e promoções que ficaram vazias). O servidor usa esta mesma
 * função ao receber o pedido, então prato desligado no canal não é cobrado.
 */
export function cardapioDoCanal(cardapio, canal) {
  if (!cardapio || !IDS_CANAIS.has(canal)) return cardapio;
  // Promoção de outro canal sai, e o prato que estava com ela volta ao preço normal.
  const promoFora = new Set((cardapio.promocoes || []).filter((p) => p.canais?.length && !p.canais.includes(canal)).map((p) => p.id));
  const produtos = (cardapio.produtos || [])
    .filter((p) => !(p.fora_dos_canais || []).includes(canal))
    .map((p) => (p.promocao_id && promoFora.has(p.promocao_id)
      ? { ...p, preco: p.preco_original || p.preco, preco_original: null, promocao_id: null }
      : p));
  if (produtos.length === (cardapio.produtos || []).length && !promoFora.size) return cardapio;
  const ids = new Set(produtos.map((p) => p.id));
  const categorias = (cardapio.categorias || [])
    .map((c) => ({ ...c, produto_ids: c.produto_ids.filter((id) => ids.has(id)) }))
    .filter((c) => c.produto_ids.length);
  const promocoes = (cardapio.promocoes || [])
    .filter((p) => !promoFora.has(p.id))
    .map((p) => ({ ...p, produto_ids: (p.produto_ids || []).filter((id) => ids.has(id)) }))
    .filter((p) => p.tipo === "aviso" || p.tipo === "frete_gratis" || p.produto_ids.length);
  return { ...cardapio, produtos, categorias, promocoes, filtros: filtrosDisponiveis(produtos) };
}

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
