// SINALIZAÇÃO DIGITAL — regras puras do módulo de TVs (pedido do dono, 07/11/2026).
//
// O dono quer tirar o pendrive das TVs: subir as artes e os vídeos uma vez,
// escolher o que cada TV roda (a mesma arte em todas ou uma em cada) e
// programar por dia e horário (almoço numa, rodízio de sexta noutra), em
// quantas TVs quiser e a qualquer distância. Referência: Nina PenDrive.
//
// Este arquivo não tem Next nem banco: valida o que entra, decide o que cada
// TV mostra agora e monta o roteiro do player. Tudo determinístico e testado
// (app/lib/sinalizacao.test.mjs). O banco fica em app/lib/server/sinalizacao.mjs.

export const FUSO_PADRAO = "America/Sao_Paulo";

export const ORIENTACOES = Object.freeze(["horizontal", "vertical"]);

// Formatos que qualquer TV com navegador toca. MP4 H.264/AAC é o único vídeo
// que roda em toda TV/TV Box; WebM fica de fora de propósito.
export const FORMATOS = Object.freeze({
  "image/jpeg": { tipo: "imagem", ext: "jpg" },
  "image/png": { tipo: "imagem", ext: "png" },
  "image/webp": { tipo: "imagem", ext: "webp" },
  "video/mp4": { tipo: "video", ext: "mp4" },
});

// Plano FREE do Supabase: 50 MB por arquivo. Imagem acima de 25 MB não
// melhora nada numa TV e só pesa o download.
export const LIMITE_BYTES = Object.freeze({ imagem: 25 * 1024 * 1024, video: 50 * 1024 * 1024 });

export const DURACAO = Object.freeze({ min: 3, max: 600, imagem: 10, cardapio: 15 });

export const LIMITES = Object.freeze({ itensPorPlaylist: 60, telasPorRegra: 500, nome: 80, porPagina: { min: 3, max: 12, padrao: 6 } });

// A TV pergunta a cada 30 s. Sem notícia por 2,5 min = fora do ar.
export const INTERVALO_TV_MS = 30 * 1000;
export const ONLINE_MS = 150 * 1000;

// Código de pareamento: 6 letras/números sem os que se confundem na TV (0/O, 1/I/L).
export const ALFABETO_CODIGO = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const TAMANHO_CODIGO = 6;
export const VALIDADE_CODIGO_MS = 30 * 60 * 1000;

export const PRIORIDADE = Object.freeze({ min: 1, max: 999, padrao: 100 });

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const uuidValido = (v) => typeof v === "string" && UUID_RE.test(v);
const HORA_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATA_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

const falha = (erro) => ({ ok: false, erro });

export function texto(v, max = LIMITES.nome) {
  if (v == null) return "";
  return String(v).replace(/\s+/g, " ").trim().slice(0, max);
}

const inteiro = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : NaN;
};

const limitar = (n, min, max) => Math.min(max, Math.max(min, n));

// ─── CÓDIGO DE PAREAMENTO ────────────────────────────────────────────────────

/** `aleatorio(n)` devolve n bytes (crypto no servidor; injetável no teste). */
export function gerarCodigo(aleatorio) {
  const bytes = aleatorio(TAMANHO_CODIGO);
  let s = "";
  for (let i = 0; i < TAMANHO_CODIGO; i++) s += ALFABETO_CODIGO[bytes[i] % ALFABETO_CODIGO.length];
  return s;
}

/** O que a pessoa digitou → código canônico, ou "" se não pode ser um código. */
export function normalizarCodigo(v) {
  const s = String(v ?? "").toUpperCase().replace(/[\s-]/g, "")
    .replace(/O/g, "0").replace(/[IL]/g, "1");
  // 0 e 1 não existem no alfabeto: quem digitou O/I/L leu errado a TV, e o
  // código não casa com nada (melhor "não encontrado" que parear a TV errada).
  if (s.length !== TAMANHO_CODIGO) return "";
  for (const c of s) if (!ALFABETO_CODIGO.includes(c)) return "";
  return s;
}

export const formatarCodigo = (c) => (c && c.length === 6 ? `${c.slice(0, 3)} ${c.slice(3)}` : c || "");

// ─── MÍDIAS ──────────────────────────────────────────────────────────────────

/**
 * Pedido de envio de arquivo (antes do upload): só formato e tamanho que a TV
 * toca e o plano aceita.
 */
export function validarEnvio({ nome, mime, tamanho } = {}) {
  const f = FORMATOS[String(mime || "").toLowerCase()];
  if (!f) return falha("Formato não aceito. Envie JPG, PNG, WebP ou vídeo MP4 (H.264/AAC).");
  const bytes = Number(tamanho);
  if (!(bytes > 0)) return falha("Arquivo vazio.");
  const limite = LIMITE_BYTES[f.tipo];
  if (bytes > limite) return falha(`${f.tipo === "video" ? "Vídeo" : "Imagem"} acima de ${Math.round(limite / 1024 / 1024)} MB.`);
  const n = texto(nome) || (f.tipo === "video" ? "Vídeo" : "Imagem");
  return { ok: true, tipo: f.tipo, ext: f.ext, mime: String(mime).toLowerCase(), tamanho: bytes, nome: n };
}

/** Orientação pela proporção (largura × altura); sem medida, "horizontal". */
export function orientacaoPorMedida(largura, altura) {
  const l = Number(largura);
  const a = Number(altura);
  if (l > 0 && a > 0 && a > l) return "vertical";
  return "horizontal";
}

/** Duração de cada mídia na tela. Vídeo usa a duração real (arredondada). */
export function duracaoDaMidia(midia, pedido) {
  const p = inteiro(pedido);
  if (Number.isFinite(p) && p > 0) return limitar(p, DURACAO.min, DURACAO.max);
  if (midia?.tipo === "video") {
    const d = Math.ceil(Number(midia.duracao_seg));
    return Number.isFinite(d) && d > 0 ? limitar(d, 1, 3600) : DURACAO.imagem;
  }
  const d = inteiro(midia?.duracao_seg);
  return Number.isFinite(d) && d > 0 ? limitar(d, DURACAO.min, DURACAO.max) : DURACAO.imagem;
}

// ─── PLAYLISTS ───────────────────────────────────────────────────────────────

/** Um item da playlist: uma mídia do acervo ou o cardápio do Héfisto (preço vivo). */
export function normalizarItem(item) {
  if (!item || typeof item !== "object") return null;
  const dur = inteiro(item.duracao_seg);
  const duracao_seg = Number.isFinite(dur) && dur > 0 ? limitar(dur, DURACAO.min, DURACAO.max) : null;
  if (item.tipo === "midia") {
    if (!uuidValido(item.midia_id)) return null;
    return { tipo: "midia", midia_id: item.midia_id, duracao_seg };
  }
  if (item.tipo === "cardapio") {
    const categorias = Array.isArray(item.categoria_ids)
      ? [...new Set(item.categoria_ids.map((c) => texto(c, 64)).filter(Boolean))].slice(0, 40)
      : [];
    const pp = inteiro(item.por_pagina);
    return {
      tipo: "cardapio",
      titulo: texto(item.titulo, 60) || "Cardápio",
      categoria_ids: categorias,
      por_pagina: Number.isFinite(pp) ? limitar(pp, LIMITES.porPagina.min, LIMITES.porPagina.max) : LIMITES.porPagina.padrao,
      mostrar_descricao: item.mostrar_descricao !== false,
      duracao_seg: duracao_seg ?? DURACAO.cardapio,
    };
  }
  return null;
}

export function validarPlaylist({ nome, orientacao, itens } = {}) {
  const n = texto(nome);
  if (!n) return falha("Dê um nome à playlist.");
  const lista = (Array.isArray(itens) ? itens : []).map(normalizarItem).filter(Boolean);
  if (!lista.length) return falha("A playlist precisa de pelo menos um conteúdo.");
  if (lista.length > LIMITES.itensPorPlaylist) return falha(`No máximo ${LIMITES.itensPorPlaylist} conteúdos por playlist.`);
  return { ok: true, playlist: { nome: n, orientacao: ORIENTACOES.includes(orientacao) ? orientacao : "horizontal", itens: lista } };
}

// ─── CONTEÚDO FIXO DA TELA ("Trocar conteúdo") ──────────────────────────────

/** O que a tela roda quando nenhuma programação vale: uma playlist ou uma arte só. */
export function normalizarConteudo(c) {
  if (!c || typeof c !== "object") return null;
  if ((c.tipo === "playlist" || c.tipo === "midia") && uuidValido(c.id)) return { tipo: c.tipo, id: c.id };
  return null;
}

// ─── PROGRAMAÇÃO ─────────────────────────────────────────────────────────────

export function validarProgramacao(r = {}) {
  const nome = texto(r.nome);
  if (!nome) return falha("Dê um nome à regra.");
  if (!uuidValido(r.playlist_id)) return falha("Escolha a playlist que será exibida.");
  const telas = Array.isArray(r.tela_ids) ? [...new Set(r.tela_ids.filter(uuidValido))] : [];
  if (telas.length > LIMITES.telasPorRegra) return falha("Telas demais nesta regra.");
  const dias = Array.isArray(r.dias_semana)
    ? [...new Set(r.dias_semana.map(inteiro).filter((d) => d >= 0 && d <= 6))].sort((a, b) => a - b)
    : [];
  const ini = r.hora_inicio ? String(r.hora_inicio).slice(0, 5) : null;
  const fim = r.hora_fim ? String(r.hora_fim).slice(0, 5) : null;
  if ((ini && !HORA_RE.test(ini)) || (fim && !HORA_RE.test(fim))) return falha("Horário inválido (use HH:MM).");
  if ((ini && !fim) || (!ini && fim)) return falha("Informe o horário de início e o de término, ou deixe o dia inteiro.");
  if (ini && fim && ini === fim) return falha("Início e término iguais. Para o dia todo, deixe sem horário.");
  const dIni = r.data_inicio ? String(r.data_inicio).slice(0, 10) : null;
  const dFim = r.data_fim ? String(r.data_fim).slice(0, 10) : null;
  if ((dIni && !DATA_RE.test(dIni)) || (dFim && !DATA_RE.test(dFim))) return falha("Data inválida.");
  if (dIni && dFim && dFim < dIni) return falha("A data final vem antes da inicial.");
  const p = inteiro(r.prioridade);
  return {
    ok: true,
    regra: {
      nome,
      playlist_id: r.playlist_id,
      tela_ids: telas,
      dias_semana: dias,
      hora_inicio: ini,
      hora_fim: fim,
      data_inicio: dIni,
      data_fim: dFim,
      prioridade: Number.isFinite(p) ? limitar(p, PRIORIDADE.min, PRIORIDADE.max) : PRIORIDADE.padrao,
      ativa: r.ativa !== false,
    },
  };
}

const DIA_EN = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

/** Data (AAAA-MM-DD), minuto do dia e dia da semana no fuso do restaurante. */
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
  return { data: `${v.year}-${v.month}-${v.day}`, minutos: (Number(v.hour) % 24) * 60 + Number(v.minute), dia: DIA_EN[v.weekday] ?? 0 };
}

const minutosDe = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

/** Dia anterior de uma data AAAA-MM-DD (para horário que vira a noite). */
function ontem(data) {
  const [a, m, d] = data.split("-").map(Number);
  const t = new Date(Date.UTC(a, m - 1, d) - 86400000);
  return t.toISOString().slice(0, 10);
}

/**
 * A regra vale agora para esta tela? Horário que vira a noite (18:00–02:00)
 * conta para o dia e a data em que começou: o rodízio de sexta continua na
 * madrugada de sábado.
 */
export function regraVale(regra, telaId, agora = new Date(), fuso = FUSO_PADRAO) {
  if (!regra || regra.ativa === false) return false;
  const telas = regra.tela_ids || [];
  if (telas.length && !telas.includes(telaId)) return false;
  const { data, minutos, dia } = partesNoFuso(agora, fuso);
  const valeNaData = (dt, dsem) =>
    (!regra.data_inicio || dt >= regra.data_inicio) &&
    (!regra.data_fim || dt <= regra.data_fim) &&
    (!regra.dias_semana?.length || regra.dias_semana.includes(dsem));
  if (!regra.hora_inicio || !regra.hora_fim) return valeNaData(data, dia);
  const ini = minutosDe(regra.hora_inicio);
  const fim = minutosDe(regra.hora_fim);
  if (ini < fim) return minutos >= ini && minutos < fim && valeNaData(data, dia);
  if (minutos >= ini) return valeNaData(data, dia);
  if (minutos < fim) return valeNaData(ontem(data), (dia + 6) % 7);
  return false;
}

const tempo = (v) => {
  const t = Date.parse(v || "");
  return Number.isFinite(t) ? t : 0;
};

/**
 * O que a tela mostra agora. Ordem: a regra de programação que vale com a
 * maior prioridade (empate: a mais recente); senão o conteúdo fixo da tela;
 * senão nada (a TV mostra a tela de espera, nunca uma arte inventada).
 */
export function resolverConteudo({ tela, programacoes = [], agora = new Date(), fuso = FUSO_PADRAO } = {}) {
  if (!tela?.id) return { origem: "nenhum", conteudo: null, regra: null };
  const valendo = programacoes
    .filter((r) => regraVale(r, tela.id, agora, fuso))
    .sort((a, b) => (b.prioridade ?? 0) - (a.prioridade ?? 0) || tempo(b.updated_at) - tempo(a.updated_at));
  if (valendo.length) {
    const r = valendo[0];
    return { origem: "programacao", conteudo: { tipo: "playlist", id: r.playlist_id }, regra: { id: r.id, nome: r.nome } };
  }
  const fixo = normalizarConteudo(tela.conteudo);
  if (fixo) return { origem: "fixo", conteudo: fixo, regra: null };
  return { origem: "nenhum", conteudo: null, regra: null };
}

// ─── MONITORAMENTO ───────────────────────────────────────────────────────────

/** "no_ar" (falou nos últimos 2,5 min), "sem_contato" ou "aguardando" (nunca falou). */
export function statusDaTela(tela, agora = Date.now()) {
  const t = tempo(tela?.ultimo_contato);
  if (!t) return "aguardando";
  return agora - t <= ONLINE_MS ? "no_ar" : "sem_contato";
}

export function resumoDasTelas(telas = [], agora = Date.now()) {
  const r = { total: 0, no_ar: 0, sem_contato: 0, aguardando: 0 };
  for (const t of telas) {
    r.total += 1;
    r[statusDaTela(t, agora)] += 1;
  }
  return r;
}

/** "Sem contato desde 20/09, 20:24" no fuso da loja. */
export function rotuloSemContato(ultimo, fuso = FUSO_PADRAO) {
  const t = tempo(ultimo);
  if (!t) return "Nunca conectou";
  const f = new Intl.DateTimeFormat("pt-BR", { timeZone: fuso, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(t));
  return `Sem contato desde ${f}`;
}

// ─── CARDÁPIO NA TV ──────────────────────────────────────────────────────────

/**
 * Páginas de cardápio para a TV a partir do cardápio público montado pelo
 * servidor (mesmo preço do QR Code e do delivery: promoção vigente incluída).
 * Sem prato com preço, sem página: a TV pula o item, nunca mostra R$ 0,00.
 */
export function paginasDoCardapio(cardapio, item) {
  const cfg = normalizarItem({ ...item, tipo: "cardapio" });
  if (!cardapio || !cfg) return [];
  const porId = new Map((cardapio.produtos || []).map((p) => [String(p.id), p]));
  const escolhidas = cfg.categoria_ids.length
    ? cfg.categoria_ids.map((id) => (cardapio.categorias || []).find((c) => c.id === id)).filter(Boolean)
    : cardapio.categorias || [];
  const paginas = [];
  for (const c of escolhidas) {
    if (c.id === "combos") continue;
    const pratos = (c.produto_ids || [])
      .map((id) => porId.get(String(id)))
      .filter((p) => p && Number(p.preco) > 0)
      .map((p) => ({
        nome: p.nome,
        descricao: cfg.mostrar_descricao ? texto(p.descricao, 120) : "",
        preco: Number(p.preco),
        preco_original: Number(p.preco_original) > Number(p.preco) ? Number(p.preco_original) : null,
        imagem_url: p.imagem_url || null,
      }));
    for (let i = 0; i < pratos.length; i += cfg.por_pagina) {
      paginas.push({ titulo: cfg.titulo, categoria: c.nome, itens: pratos.slice(i, i + cfg.por_pagina) });
    }
  }
  return paginas;
}

export const formatarPreco = (v) =>
  `R$ ${Number(v).toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;

// ─── ROTEIRO DO PLAYER ───────────────────────────────────────────────────────

/**
 * Lista de slides que a TV toca em sequência.
 *   itens       — da playlist (ou uma arte só, do conteúdo fixo)
 *   midias      — Map id → { id, tipo, nome, duracao_seg, versao, orientacao }
 *   urls        — Map id → URL assinada (temporária)
 *   cardapio    — cardápio público da unidade (ou null se indisponível)
 * Mídia apagada, sem URL ou cardápio vazio somem do roteiro (nunca slide quebrado).
 */
export function montarRoteiro({ itens = [], midias = new Map(), urls = new Map(), cardapio = null } = {}) {
  const slides = [];
  for (const bruto of itens) {
    const item = normalizarItem(bruto);
    if (!item) continue;
    if (item.tipo === "midia") {
      const m = midias.get(item.midia_id);
      const url = urls.get(item.midia_id);
      if (!m || !url) continue;
      slides.push({
        tipo: m.tipo, midia_id: m.id, nome: m.nome, url,
        chave: `${m.id}:${m.versao || 1}`,
        duracao_seg: duracaoDaMidia(m, item.duracao_seg),
      });
      continue;
    }
    const paginas = paginasDoCardapio(cardapio, item);
    paginas.forEach((pg, i) => slides.push({
      tipo: "cardapio", chave: `cardapio:${pg.categoria}:${i}`, nome: `${pg.titulo} · ${pg.categoria}`,
      duracao_seg: item.duracao_seg, pagina: pg,
    }));
  }
  return slides;
}

/** Ids das mídias que um conjunto de itens usa (para buscar no banco de uma vez). */
export function midiasUsadas(itens = []) {
  return [...new Set(itens.map(normalizarItem).filter((i) => i?.tipo === "midia").map((i) => i.midia_id))];
}
