// CENTRAL DE COMANDO — regras puras (sem React, sem localStorage) da busca
// global: comandos ("abrir estoque"), sugestões por frequência/perfil,
// resultados reordenados pelo uso e o "Explorar módulos". A permissão continua
// sendo do navigation-registry (getAccessibleNavigation): aqui nada abre
// módulo que o usuário não pode ver.

import { searchNavigationRegistry, normalizeString } from "./navigation-registry.mjs";

// "abrir etiquetas", "ir para o estoque", "ver contas a pagar", "acessar CMV"
const VERBO = /^(abrir|abra|abre|ir para|ir pra|ir pro|ir|ver|acessar|acesse|mostrar|entrar (em|no|na))(\s+(o |a |os |as )?|$)/;

/** Separa o verbo de comando do termo buscado. */
export function interpretarConsulta(consulta = "") {
  const n = normalizeString(consulta);
  const m = VERBO.exec(n);
  return m ? { termo: n.slice(m[0].length).trim(), comando: true } : { termo: n, comando: false };
}

/** Nome curto e categoria (seção) de um módulo: a categoria evita repetir "Operação" em tudo. */
export const nomeDo = (item) => item?.shortTitle || item?.title || "";
export const categoriaDo = (item) => item?.section || item?.domain || "";

/** Restaurante, Marmitaria e Eventos são negócios separados: cada um vê primeiro o que é dele. */
const ehDaMarmitaria = (item) => String(item?.route || "").startsWith("/dashboard/marmitaria");
export const doNegocio = (item, unidadeId) => (unidadeId === "marmitaria" ? ehDaMarmitaria(item) : !ehDaMarmitaria(item));

/** Só o que é do negócio aberto; sem nada dele, mantém tudo para a lista não ficar vazia. */
export function filtrarPorNegocio(itens = [], unidadeId) {
  const dele = itens.filter((i) => doNegocio(i, unidadeId));
  return dele.length ? dele : itens;
}

/** Dentro do negócio, o sufixo só ocupa espaço. */
export const nomeCurto = (item) => nomeDo(item).replace(/ da marmitaria$/i, "");

/** Atalhos da tela inicial: favoritos primeiro, depois os mais usados, sem repetir nos recentes. */
export function montarInicio({ acessiveis = [], favoritos = [], recentes = [], uso = {}, unidadeId, atalhos = 6, limiteRecentes = 4 } = {}) {
  const favs = favoritos.filter((i) => doNegocio(i, unidadeId)).slice(0, atalhos);
  const sug = sugestoes({ acessiveis: filtrarPorNegocio(acessiveis, unidadeId), uso, excluir: favs.map((f) => f.id), limite: atalhos - favs.length });
  const lista = [...favs, ...sug.itens];
  const usados = new Set(lista.map((i) => i.id));
  return { atalhos: lista, recentes: recentes.filter((r) => doNegocio(r, unidadeId) && !usados.has(r.id)).slice(0, limiteRecentes), origem: sug.origem };
}

const ordemBase = (a, b) => (a.mobilePriority || 9) - (b.mobilePriority || 9);

/**
 * Sugestões: mais usados por este usuário (frequência real); sem histórico,
 * os módulos prioritários do perfil. Não repete o que já está em `excluir`.
 * @returns {{ itens: object[], origem: "uso"|"perfil" }}
 */
export function sugestoes({ acessiveis = [], uso = {}, excluir = [], limite = 6 } = {}) {
  const fora = new Set(excluir);
  const candidatos = acessiveis.filter((i) => !fora.has(i.id));
  const usados = candidatos.filter((i) => (uso[i.id] || 0) > 0).sort((a, b) => (uso[b.id] - uso[a.id]) || ordemBase(a, b));
  if (usados.length >= Math.min(3, limite)) return { itens: usados.slice(0, limite), origem: "uso" };
  const perfil = candidatos.filter((i) => !usados.includes(i) && i.mobilePriority && i.mobilePriority <= 2).sort(ordemBase);
  return { itens: [...usados, ...perfil].slice(0, limite), origem: usados.length ? "uso" : "perfil" };
}

/**
 * Busca: mesmo ranking do registry (nome, palavras-chave, sinônimos, descrição),
 * com um empurrão moderado para o que o usuário mais usa. Comando sem termo
 * ("abrir") não busca nada.
 */
export function buscar(consulta, sessao, { uso = {}, limite = 12, unidadeId } = {}) {
  const { termo, comando } = interpretarConsulta(consulta);
  if (!termo) return { termo, comando, itens: [] };
  const brutos = searchNavigationRegistry(termo, sessao);
  const itens = brutos
    .map((i) => ({ ...i, score: i.score + Math.min((uso[i.id] || 0) * 15, 150) }))
    .sort((a, b) => (unidadeId ? doNegocio(b, unidadeId) - doNegocio(a, unidadeId) : 0) || b.score - a.score || a.title.localeCompare(b.title))
    .slice(0, limite);
  return { termo, comando, itens };
}

/** Explorar módulos: agrupados por área, em ordem alfabética. */
export function explorar(acessiveis = [], unidadeId) {
  const grupos = new Map();
  for (const i of acessiveis) {
    const g = i.domain || "Outros";
    if (!grupos.has(g)) grupos.set(g, []);
    grupos.get(g).push(i);
  }
  return [...grupos.entries()]
    .sort(([a, itensA], [b, itensB]) => (unidadeId ? doNegocio(itensB[0], unidadeId) - doNegocio(itensA[0], unidadeId) : 0) || a.localeCompare(b, "pt-BR"))
    .map(([area, itens]) => ({ area, itens: itens.sort((a, b) => nomeDo(a).localeCompare(nomeDo(b), "pt-BR")) }));
}
