// Organizador de plataforma (pedido do dono, 17/11/2026): "uma tela igual à do
// app de entrega, com a foto do prato, o valor, a descrição e a categoria; a
// gente preenche tudo aqui e só copia e cola para a plataforma".
//
// Fica em config_sistema.params.organizador_plataforma, uma vitrine por app
// (iFood, 99Food, Keeta…). Nada aqui calcula dinheiro: os preços são os que o
// dono digitou (ou o preço da marmita no app, quando ele puxa das marmitas) e o
// "% de desconto" é só a conta entre o preço e o preço com cupom que ele pôs.
//
//   { versao: 1, plataformas: { ifood: { categorias: [ { id, nome, itens: [
//       { id, nome, descricao, foto_url, preco, preco_cupom, a_partir_de, destaque, ficha_id } ] } ],
//     atualizado_em } } }

import { PLATAFORMAS, numeroBR, brl } from "./concorrentes.mjs";

export const CHAVE_PARAMS = "organizador_plataforma";
export const PLATAFORMAS_VITRINE = PLATAFORMAS.filter((p) => p.id !== "outro");
export const MAX_CATEGORIAS = 40;
export const MAX_ITENS_CATEGORIA = 80;
export const MAX_DESCRICAO = 1000;
export const SEM_CATEGORIA = "Sem categoria";

const IDS = new Set(PLATAFORMAS.map((p) => p.id));
const fold = (t) => String(t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
const limpar = (v, max) => String(v ?? "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim().slice(0, max);
const r2 = (n) => Math.round(Number(n) * 100) / 100;
const preco = (v) => { const n = numeroBR(v); return n != null && n > 0 && n < 100000 ? r2(n) : null; };
const urlSegura = (u) => (/^https:\/\/[^\s"'<>]+$/i.test(String(u || "")) ? String(u).slice(0, 600) : "");

let seq = 0;
export function novoId(prefixo = "i") {
  seq = (seq + 1) % 1e6;
  return `${prefixo}${Date.now().toString(36)}${seq.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export const rotuloPlataforma = (id) => PLATAFORMAS.find((p) => p.id === id)?.rotulo || "Outro";

export function normalizarItem(i) {
  const p = preco(i?.preco);
  let cupom = preco(i?.preco_cupom);
  if (cupom != null && p != null && cupom >= p) cupom = null; // cupom só se for menor que o preço
  return {
    id: String(i?.id || novoId("i")).slice(0, 40),
    nome: limpar(i?.nome, 160),
    descricao: limpar(i?.descricao, MAX_DESCRICAO),
    foto_url: urlSegura(i?.foto_url),
    preco: p,
    preco_cupom: cupom,
    a_partir_de: i?.a_partir_de !== false,
    destaque: limpar(i?.destaque, 60),
    ficha_id: i?.ficha_id ? String(i.ficha_id).slice(0, 60) : null,
  };
}

export function normalizarCategoria(c) {
  return {
    id: String(c?.id || novoId("c")).slice(0, 40),
    nome: limpar(c?.nome, 80) || SEM_CATEGORIA,
    itens: (Array.isArray(c?.itens) ? c.itens : []).slice(0, MAX_ITENS_CATEGORIA).map(normalizarItem).filter((i) => i.nome),
  };
}

export function normalizarVitrine(v) {
  return {
    categorias: (Array.isArray(v?.categorias) ? v.categorias : []).slice(0, MAX_CATEGORIAS).map(normalizarCategoria),
    atualizado_em: typeof v?.atualizado_em === "string" ? v.atualizado_em.slice(0, 40) : null,
  };
}

export function normalizarOrganizador(raw) {
  const plataformas = {};
  const ent = raw && typeof raw === "object" && raw.plataformas && typeof raw.plataformas === "object" ? raw.plataformas : {};
  for (const [id, v] of Object.entries(ent)) if (IDS.has(id)) plataformas[id] = normalizarVitrine(v);
  return { versao: 1, plataformas };
}

export const vitrineDe = (org, plataforma) => normalizarVitrine(normalizarOrganizador(org).plataformas[plataforma]);

/** Troca só a vitrine de um app, mantendo as outras como estão no banco. */
export function comVitrine(org, plataforma, vitrine, agora = new Date().toISOString()) {
  const o = normalizarOrganizador(org);
  if (!IDS.has(plataforma)) return o;
  return { ...o, plataformas: { ...o.plataformas, [plataforma]: { ...normalizarVitrine(vitrine), atualizado_em: agora } } };
}

// ─── edição ──────────────────────────────────────────────────────────────────
const mover = (lista, de, delta) => {
  const para = de + delta;
  if (de < 0 || para < 0 || para >= lista.length) return lista;
  const nova = [...lista];
  const [x] = nova.splice(de, 1);
  nova.splice(para, 0, x);
  return nova;
};

export function adicionarCategoria(vitrine, nome) {
  const v = normalizarVitrine(vitrine);
  const n = limpar(nome, 80);
  if (!n) return { vitrine: v, erro: "Dê um nome para a categoria." };
  if (v.categorias.some((c) => fold(c.nome) === fold(n))) return { vitrine: v, erro: "Já existe uma categoria com esse nome." };
  if (v.categorias.length >= MAX_CATEGORIAS) return { vitrine: v, erro: `Cabem até ${MAX_CATEGORIAS} categorias.` };
  return { vitrine: { ...v, categorias: [...v.categorias, normalizarCategoria({ nome: n })] }, erro: null };
}

export function renomearCategoria(vitrine, catId, nome) {
  const v = normalizarVitrine(vitrine);
  const n = limpar(nome, 80);
  if (!n) return { vitrine: v, erro: "Dê um nome para a categoria." };
  if (v.categorias.some((c) => c.id !== catId && fold(c.nome) === fold(n))) return { vitrine: v, erro: "Já existe uma categoria com esse nome." };
  return { vitrine: { ...v, categorias: v.categorias.map((c) => (c.id === catId ? { ...c, nome: n } : c)) }, erro: null };
}

export function moverCategoria(vitrine, catId, delta) {
  const v = normalizarVitrine(vitrine);
  return { ...v, categorias: mover(v.categorias, v.categorias.findIndex((c) => c.id === catId), delta) };
}

export function removerCategoria(vitrine, catId) {
  const v = normalizarVitrine(vitrine);
  return { ...v, categorias: v.categorias.filter((c) => c.id !== catId) };
}

export function moverItem(vitrine, catId, itemId, delta) {
  const v = normalizarVitrine(vitrine);
  return { ...v, categorias: v.categorias.map((c) => (c.id === catId ? { ...c, itens: mover(c.itens, c.itens.findIndex((i) => i.id === itemId), delta) } : c)) };
}

export function removerItem(vitrine, itemId) {
  const v = normalizarVitrine(vitrine);
  return { ...v, categorias: v.categorias.map((c) => ({ ...c, itens: c.itens.filter((i) => i.id !== itemId) })) };
}

/** Grava o item na categoria escolhida (novo, ou trocando de lugar se mudou de categoria). */
export function salvarItem(vitrine, catId, item) {
  const v = normalizarVitrine(vitrine);
  const it = normalizarItem(item);
  if (!it.nome) return { vitrine: v, erro: "Dê um nome para o item." };
  if (!v.categorias.some((c) => c.id === catId)) return { vitrine: v, erro: "Escolha a categoria." };
  const destino = v.categorias.find((c) => c.id === catId);
  const jaNoDestino = destino.itens.some((i) => i.id === it.id);
  if (!jaNoDestino && destino.itens.length >= MAX_ITENS_CATEGORIA) return { vitrine: v, erro: `Cabem até ${MAX_ITENS_CATEGORIA} itens por categoria.` };
  const categorias = v.categorias.map((c) => {
    if (c.id === catId) return { ...c, itens: jaNoDestino ? c.itens.map((i) => (i.id === it.id ? it : i)) : [...c.itens, it] };
    return { ...c, itens: c.itens.filter((i) => i.id !== it.id) };
  });
  return { vitrine: { ...v, categorias }, erro: null };
}

// ─── de onde vêm os itens ────────────────────────────────────────────────────
function categoriaPorNome(categorias, nome) {
  const n = limpar(nome, 80) || SEM_CATEGORIA;
  let c = categorias.find((x) => fold(x.nome) === fold(n));
  if (!c && categorias.length < MAX_CATEGORIAS) { c = normalizarCategoria({ nome: n }); categorias.push(c); }
  return c || null;
}

/**
 * Itens lidos de um print da plataforma (cardapioDoOcr): cada um entra na
 * categoria que o print mostra. Item com o mesmo nome em qualquer categoria é
 * atualizado (nome, descrição, preços); a foto que já estava fica.
 * "a partir de R$ 40 / R$ 28 com cupom": o cheio vira preço e o menor, cupom.
 */
export function mesclarLeitura(vitrine, itensLidos = []) {
  const v = normalizarVitrine(vitrine);
  const categorias = v.categorias.map((c) => ({ ...c, itens: [...c.itens] }));
  let novos = 0; let atualizados = 0; let ignorados = 0;
  for (const l of itensLidos) {
    const nome = limpar(l?.nome, 160);
    if (!nome) { ignorados++; continue; }
    const pago = preco(l?.preco);
    const cheio = preco(l?.preco_original);
    const dados = {
      nome,
      ...(l?.descricao ? { descricao: limpar(l.descricao, MAX_DESCRICAO) } : {}),
      ...(cheio && pago && cheio > pago ? { preco: cheio, preco_cupom: pago } : pago ? { preco: pago } : {}),
    };
    const catNome = l?.tipo === "adicional" ? (l?.grupo || "Adicionais") : l?.categoria;
    let achou = null;
    for (const c of categorias) { const i = c.itens.find((x) => fold(x.nome) === fold(nome)); if (i) { achou = { c, i }; break; } }
    if (achou) {
      achou.c.itens = achou.c.itens.map((x) => (x.id === achou.i.id ? normalizarItem({ ...x, ...dados }) : x));
      atualizados++;
      continue;
    }
    const c = categoriaPorNome(categorias, catNome);
    if (!c || c.itens.length >= MAX_ITENS_CATEGORIA) { ignorados++; continue; }
    c.itens.push(normalizarItem(dados));
    novos++;
  }
  return { vitrine: { ...v, categorias }, novos, atualizados, ignorados };
}

/**
 * Nossas marmitas (fichas da marmitaria) que ainda não estão na vitrine:
 * nome comercial, descrição, foto da ficha e o preço cadastrado nesse app.
 * Marmita sem preço no app entra sem preço (o dono completa); nada é inventado.
 */
export function puxarMarmitas(vitrine, marmitas = [], precoDoApp = () => null) {
  const v = normalizarVitrine(vitrine);
  const categorias = v.categorias.map((c) => ({ ...c, itens: [...c.itens] }));
  const ja = new Set(categorias.flatMap((c) => c.itens.map((i) => i.ficha_id).filter(Boolean)));
  const nomes = new Set(categorias.flatMap((c) => c.itens.map((i) => fold(i.nome))));
  let novos = 0;
  for (const m of marmitas) {
    if (!m?.id || m.ativo === false || ja.has(String(m.id))) continue;
    const nome = limpar(m.nome_comercial || m.nome_receita, 160);
    if (!nome || nomes.has(fold(nome))) continue;
    const c = categoriaPorNome(categorias, m.categoria || "Marmitas");
    if (!c || c.itens.length >= MAX_ITENS_CATEGORIA) continue;
    c.itens.push(normalizarItem({
      nome, ficha_id: String(m.id),
      descricao: m.descricao_comercial || m.descricao || "",
      foto_url: m.imagem || m.imagem_url || "",
      preco: precoDoApp(m),
    }));
    nomes.add(fold(nome));
    novos++;
  }
  return { vitrine: { ...v, categorias }, novos };
}

// ─── leitura ─────────────────────────────────────────────────────────────────
export function contagem(vitrine) {
  const v = normalizarVitrine(vitrine);
  const itens = v.categorias.flatMap((c) => c.itens);
  return { categorias: v.categorias.length, itens: itens.length };
}

/** O que falta para a vitrine ficar pronta para copiar. */
export function pendencias(vitrine) {
  const v = normalizarVitrine(vitrine);
  const itens = v.categorias.flatMap((c) => c.itens.map((i) => ({ ...i, categoria: c.nome })));
  return {
    semFoto: itens.filter((i) => !i.foto_url),
    semDescricao: itens.filter((i) => !i.descricao),
    semPreco: itens.filter((i) => i.preco == null),
    categoriasVazias: v.categorias.filter((c) => !c.itens.length).map((c) => c.nome),
  };
}

export const precoTexto = (v) => (v == null ? "" : brl(v));

/** "R$ 40,00" → desconto do cupom em % (conta sobre o que o dono digitou). */
export function descontoPct(item) {
  if (item?.preco == null || item?.preco_cupom == null || item.preco <= 0) return null;
  return Math.round((1 - item.preco_cupom / item.preco) * 100);
}

/** Texto para colar na plataforma (um campo por linha). */
export function textoDoItem(item, categoria = "") {
  const i = normalizarItem(item);
  return [
    categoria ? `Categoria: ${categoria}` : null,
    `Nome: ${i.nome}`,
    i.descricao ? `Descrição: ${i.descricao}` : null,
    i.preco != null ? `Preço: ${precoTexto(i.preco)}` : null,
    i.preco_cupom != null ? `Preço com cupom: ${precoTexto(i.preco_cupom)}` : null,
  ].filter(Boolean).join("\n");
}

/** Resumo curto para o Jhon: "3 categorias, 12 itens; 4 sem foto, 2 sem preço". */
export function resumoDaVitrine(vitrine) {
  const n = contagem(vitrine);
  const p = pendencias(vitrine);
  const faltas = [
    p.semFoto.length ? `${p.semFoto.length} sem foto` : null,
    p.semDescricao.length ? `${p.semDescricao.length} sem descrição` : null,
    p.semPreco.length ? `${p.semPreco.length} sem preço` : null,
  ].filter(Boolean);
  return {
    ...n, ...p,
    texto: `${n.categorias} ${n.categorias === 1 ? "categoria" : "categorias"}, ${n.itens} ${n.itens === 1 ? "item" : "itens"}${faltas.length ? `; ${faltas.join(", ")}` : n.itens ? "; tudo preenchido" : ""}`,
  };
}

export const plataformaValida = (id) => IDS.has(id);
