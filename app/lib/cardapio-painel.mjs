// PAINEL → CARDÁPIO (protótipo PainelCardapio, seção 9K.1 da spec).
//
// Regras puras da lista de produtos do painel: seções com a contagem, cada
// produto com foto, preço, promoção que vale agora, liga/desliga por canal
// (Tablet, QR mesa, Delivery) e "Esgotado hoje". Tudo sai do que já existe:
//   - produto de venda (`produtos`) e ficha técnica ligada (`fichas_tecnicas`);
//   - vitrine do dono (config_sistema.params.cardapio_digital: seções, itens,
//     promoções), lida pelas mesmas funções do cardápio do cliente.
// Nada é inventado: sem tempo de preparo na ficha, a linha não mostra tempo;
// sem foto, diz "sem foto".

import {
  CANAIS_CARDAPIO, canaisDoItem, categoriaDoProduto, categoriasEfetivas, esgotadoHoje, fichaAtiva, formatarPreco,
  juntarProdutosEFichas, normalizarBusca, normalizarConfigCardapio, partesNoFuso, precoEfetivo, promocoesVigentes, FUSO_PADRAO,
} from "./cardapio-digital.mjs";
import { setorDoProduto } from "./kds-fila.mjs";

export const FILTROS_CANAL = [
  { id: "todos", rotulo: "Todos" },
  ...CANAIS_CARDAPIO,
  { id: "equipe", rotulo: "Garçom/PDV" },
];
const ROTULO_CANAL_CURTO = { tablet: "Tablet", qr: "QR", delivery: "Delivery" };
const ESTACAO = { cozinha: "Cozinha", bar: "Bar" };

// Tempo de preparo só da ficha técnica (9C.4). produtos.tempo_preparo_base não
// serve: a coluna nasce com 15 e, no banco real (28/10/2026), os 135 produtos
// têm 15 sem ninguém ter digitado — mostrar isso seria inventar tempo.
const tempoDe = (ficha) => {
  const n = Math.round(Number(ficha?.tempo_preparo) || 0);
  return n > 0 ? n : null;
};

/**
 * Monta a tela. `ingredientes`: { [ficha_id]: ["tucupi", "jambu", ...] } para a
 * busca por ingrediente (opcional). `fotoDaFicha(produtoId)`: endereço da foto
 * guardada na ficha.
 */
export function montarPainelCardapio({
  produtos = [], fichas = [], fichasComFoto = [], config, ingredientes = {}, fotoDaFicha = null, agora = new Date(), fuso = FUSO_PADRAO,
} = {}) {
  const cfg = normalizarConfigCardapio(config);
  const juntos = juntarProdutosEFichas(produtos, fichas, [], { fichasComFoto, fotoDaFicha });
  const categorias = categoriasEfetivas(cfg, juntos);
  const vigentes = promocoesVigentes(cfg.promocoes, agora, fuso);
  const promoPorId = new Map(vigentes.map((p) => [p.id, p]));
  const fichaPorId = new Map(fichas.map((f) => [String(f.id), f]));

  const linhas = juntos.map((p) => {
    const fichaBruta = p.ficha ? fichaPorId.get(String(p.ficha.id)) : null;
    const item = cfg.itens[p.id] || {};
    const preco = Math.round((Number(p.preco_venda) || 0) * 100) / 100;
    const efetivo = preco > 0 ? precoEfetivo(p, vigentes) : { preco, promocao_id: null };
    const promo = efetivo.promocao_id ? promoPorId.get(efetivo.promocao_id) : null;
    const foto = p.imagem_url || p.ficha?.imagem_url || "";
    const tempo = tempoDe(fichaBruta);
    const esgotado = esgotadoHoje(item, agora, fuso);
    const ligados = new Set(canaisDoItem(item));
    // Pendência = o cliente não vê o prato (a mesma regra do cardápio do cliente).
    const pendencias = [];
    if (p.ficha && !fichaAtiva(p.ficha)) pendencias.push("ficha inativa");
    if (!(preco > 0)) pendencias.push("sem preço");
    const info = [tempo ? `${tempo} min` : "", foto ? "" : "sem foto", p.ficha ? "" : "sem ficha técnica", ...pendencias].filter(Boolean);
    return {
      id: String(p.id),
      nome: p.ficha?.nome_comercial || p.nome_produto || "",
      info,
      preco,
      promocao: promo ? `${promo.titulo}: ${formatarPreco(efetivo.preco)}` : "",
      foto,
      categoria_id: categoriaDoProduto(p, categorias, cfg.itens),
      estacao: setorDoProduto(p.ficha?.departamento || p.departamento),
      canais: Object.fromEntries(CANAIS_CARDAPIO.map((c) => [c.id, ligados.has(c.id)])),
      esgotado,
      // O cliente só vê o prato com preço, ficha ativa e fora do "esgotado hoje".
      noAr: pendencias.length === 0 && !esgotado,
      busca: normalizarBusca([p.nome_produto, p.ficha?.nome_comercial, ...(p.ficha ? ingredientes[String(p.ficha.id)] || [] : [])].join(" ")),
    };
  });

  const qtd = new Map();
  for (const l of linhas) qtd.set(l.categoria_id, (qtd.get(l.categoria_id) || 0) + 1);
  const lista = categorias.map((c) => ({ id: c.id, nome: c.nome, qtd: qtd.get(c.id) || 0 }));
  if (qtd.has("outros") && !lista.some((c) => c.id === "outros")) lista.push({ id: "outros", nome: "Outros", qtd: qtd.get("outros") });
  return { categorias: lista, linhas, hoje: partesNoFuso(agora, fuso).data };
}

/** Filtro "Mostrar no:" e a busca por nome ou ingrediente. */
export function filtrarLinhas(linhas, { canal = "todos", busca = "", categoria = null } = {}) {
  const termo = normalizarBusca(busca);
  return linhas.filter((l) => {
    if (categoria && !termo && l.categoria_id !== categoria) return false;
    if (termo && !l.busca.includes(termo)) return false;
    if (canal === "todos" || canal === "equipe") return true;
    return l.canais[canal] && l.noAr;
  });
}

/** "Estação: Cozinha · aparece em Tablet, QR, Delivery" da seção aberta. */
export function resumoDaSecao(linhas) {
  if (!linhas.length) return "";
  const setores = new Map();
  for (const l of linhas) setores.set(l.estacao, (setores.get(l.estacao) || 0) + 1);
  const estacao = ESTACAO[[...setores.entries()].sort((a, b) => b[1] - a[1])[0][0]] || "Cozinha";
  const onde = CANAIS_CARDAPIO.filter((c) => linhas.some((l) => l.noAr && l.canais[c.id])).map((c) => ROTULO_CANAL_CURTO[c.id]);
  return `Estação: ${estacao} · ${onde.length ? `aparece em ${onde.join(", ")}` : "não aparece em nenhum canal"}`;
}

const limparItem = (item) => Object.fromEntries(Object.entries(item).filter(([, v]) => v !== undefined));

/** Liga ou desliga o prato num canal. "Oculto" do editor antigo vira "desligado em todos". */
export function itemComCanal(item = {}, canal, ligado) {
  const ligados = new Set(canaisDoItem(item));
  if (ligado) ligados.add(canal);
  else ligados.delete(canal);
  const fora = CANAIS_CARDAPIO.map((c) => c.id).filter((id) => !ligados.has(id));
  return limparItem({ ...item, oculto: undefined, canais_ocultos: fora.length ? fora : undefined });
}

/** "Esgotado hoje": marca o dia de hoje (volta sozinho amanhã) ou desmarca. */
export function itemEsgotado(item = {}, esgotado, agora = new Date(), fuso = FUSO_PADRAO) {
  return limparItem({ ...item, esgotado_dia: esgotado ? partesNoFuso(agora, fuso).data : undefined });
}

/** Nova ordem das seções (arrastar). Seções que não vieram na lista ficam no fim, na ordem de antes. */
export function reordenarCategorias(categorias, ids) {
  const pos = new Map(ids.map((id, i) => [id, i]));
  return [...categorias]
    .map((c, i) => ({ c, i }))
    .sort((a, b) => (pos.get(a.c.id) ?? ids.length + a.i) - (pos.get(b.c.id) ?? ids.length + b.i))
    .map(({ c }) => c);
}

/** Move um item da lista de `de` para `para` (posições). */
export function mover(lista, de, para) {
  const r = [...lista];
  const [x] = r.splice(de, 1);
  r.splice(Math.max(0, Math.min(r.length, para)), 0, x);
  return r;
}

// ── Editar produto (protótipo PainelProduto) ───────────────────────────────

const IDIOMAS_TRADUCAO = [["en", "English"], ["es", "Español"], ["it", "Italiano"], ["fr", "Français"], ["zh", "中文"], ["ja", "日本語"], ["ko", "한국어"]];

/** Estado inicial do formulário a partir do produto, da ficha e da vitrine. */
export function formularioDoProduto({ produto, ficha = null, config, categorias = [], agora = new Date(), fuso = FUSO_PADRAO }) {
  const cfg = normalizarConfigCardapio(config);
  const item = cfg.itens[produto.id] || {};
  const juntos = juntarProdutosEFichas([produto], ficha ? [ficha] : [])[0];
  const h = item.horario;
  return {
    nome: ficha?.nome_comercial || produto.nome_produto || "",
    descricao: ficha ? ficha.descricao_comercial || "" : item.descricao || "",
    categoria_id: categoriaDoProduto(juntos, categorias, cfg.itens),
    tempo: ficha?.tempo_preparo > 0 ? String(Math.round(ficha.tempo_preparo)) : "",
    midias: item.midias || (produto.imagem_url ? [{ tipo: "foto", url: produto.imagem_url }] : []),
    grupos: item.grupos || [],
    canais: Object.fromEntries(CANAIS_CARDAPIO.map((c) => [c.id, canaisDoItem(item).includes(c.id)])),
    horario: { modo: h ? "horario" : "sempre", dias_semana: h?.dias_semana || [], hora_inicio: h?.hora_inicio || "", hora_fim: h?.hora_fim || "" },
    esgotado: esgotadoHoje(item, agora, fuso),
  };
}

/** Erros que impedem salvar (texto curto para mostrar ao lado do botão). */
export function errosDoFormulario(f, { temFicha }) {
  const e = [];
  if (temFicha && !String(f.nome).trim()) e.push("Dê um nome ao prato.");
  if (f.tempo !== "" && !(Number(f.tempo) > 0 && Number(f.tempo) <= 600)) e.push("Tempo de preparo: de 1 a 600 minutos.");
  if (f.horario.modo === "horario" && !f.horario.dias_semana.length && !f.horario.hora_inicio && !f.horario.hora_fim) {
    e.push("Escolha os dias ou o horário em que o prato aparece.");
  }
  return e;
}

/** O item da vitrine depois do formulário (o que não é do formulário fica como estava). */
export function itemDoFormulario(item = {}, f, { temFicha, categoriaOriginal }, agora = new Date(), fuso = FUSO_PADRAO) {
  let novo = { ...item, oculto: undefined };
  for (const c of CANAIS_CARDAPIO) novo = itemComCanal(novo, c.id, !!f.canais[c.id]);
  novo = itemEsgotado(novo, f.esgotado, agora, fuso);
  novo.midias = f.midias.length ? f.midias : undefined;
  novo.grupos = f.grupos.length ? f.grupos : undefined;
  novo.horario = f.horario.modo === "horario"
    ? { dias_semana: f.horario.dias_semana, hora_inicio: f.horario.hora_inicio, hora_fim: f.horario.hora_fim }
    : undefined;
  novo.categoria_id = f.categoria_id && f.categoria_id !== categoriaOriginal ? f.categoria_id : item.categoria_id;
  if (!temFicha) novo.descricao = String(f.descricao || "").trim() || undefined;
  return Object.fromEntries(Object.entries(novo).filter(([, v]) => v !== undefined));
}

/** Em quantos pratos cada grupo está ligado ("usado em 4 produtos"). */
export function usosDosGrupos(config) {
  const cfg = normalizarConfigCardapio(config);
  const n = {};
  for (const it of Object.values(cfg.itens)) for (const g of it.grupos || []) n[g] = (n[g] || 0) + 1;
  return n;
}

/** Situação das traduções do prato em cada idioma (nome e descrição). */
export function traducoesDoProduto(config, { id, temDescricao }) {
  const cfg = normalizarConfigCardapio(config);
  return IDIOMAS_TRADUCAO.filter(([lang]) => cfg.idiomas.includes(lang)).map(([lang, nome]) => {
    const t = cfg.traducoes[lang]?.produtos?.[id] || {};
    const status = t.nome && (!temDescricao || t.descricao) ? "ok" : t.nome || t.descricao ? "parcial" : "falta";
    return { idioma: lang, nome, status, rotulo: { ok: "Traduzida", parcial: "Falta a descrição", falta: "Sem tradução" }[status] };
  });
}
