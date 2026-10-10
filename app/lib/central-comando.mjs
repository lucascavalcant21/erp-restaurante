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
export function buscar(consulta, sessao, { uso = {}, limite = 12 } = {}) {
  const { termo, comando } = interpretarConsulta(consulta);
  if (!termo) return { termo, comando, itens: [] };
  const brutos = searchNavigationRegistry(termo, sessao);
  const itens = brutos
    .map((i) => ({ ...i, score: i.score + Math.min((uso[i.id] || 0) * 15, 150) }))
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
    .slice(0, limite);
  return { termo, comando, itens };
}

/** Explorar módulos: agrupados por área, em ordem alfabética. */
export function explorar(acessiveis = []) {
  const grupos = new Map();
  for (const i of acessiveis) {
    const g = i.domain || "Outros";
    if (!grupos.has(g)) grupos.set(g, []);
    grupos.get(g).push(i);
  }
  return [...grupos.entries()]
    .sort(([a], [b]) => a.localeCompare(b, "pt-BR"))
    .map(([area, itens]) => ({ area, itens: itens.sort((a, b) => nomeDo(a).localeCompare(nomeDo(b), "pt-BR")) }));
}
