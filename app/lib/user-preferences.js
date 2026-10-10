// Gestão de Preferências do Usuário (Recentes & Favoritos - Fase C)
// Persistência isolada por Usuário / Unidade em localStorage com revalidação estrita de permissões.

import { NAVIGATION_REGISTRY, getAccessibleNavigation, getRegistryItemByRoute, getRegistryItemById } from "./navigation-registry.mjs";

/**
 * Retorna uma chave de namespace isolada para cada usuário/empresa.
 * Garante que o Usuário A não veja os recentes/favoritos do Usuário B no mesmo dispositivo.
 */
export function getUserNamespace(session) {
  if (!session) return "hefisto_guest";
  const userId = session.id || session.sub || session.usuario_id || session.email || "user";
  const unitId = session.unidade_id || session.empresa_id || "default";
  return `hefisto_prefs_${userId}_${unitId}`;
}

const VAZIO = () => ({ recentIds: [], favoriteIds: [], usage: {} });
export const MAX_RECENTES = 6;

function loadStorageData(namespace) {
  if (typeof window === "undefined") return VAZIO();
  try {
    const raw = localStorage.getItem(namespace);
    if (!raw) return VAZIO();
    const parsed = JSON.parse(raw);
    const usage = parsed.usage && typeof parsed.usage === "object" && !Array.isArray(parsed.usage) ? parsed.usage : {};
    return {
      recentIds: Array.isArray(parsed.recentIds) ? parsed.recentIds : [],
      favoriteIds: Array.isArray(parsed.favoriteIds) ? parsed.favoriteIds : [],
      usage: Object.fromEntries(Object.entries(usage).filter(([, n]) => Number.isFinite(n) && n > 0)),
    };
  } catch (_) {
    return VAZIO();
  }
}

function saveStorageData(namespace, data) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(namespace, JSON.stringify(data));
  } catch (_) {}
}

/**
 * Adiciona uma rota acessada aos Recentes (máximo MAX_RECENTES) e conta o uso
 * (frequência, para as Sugestões da Central de Comando).
 * Se a rota já existir, move para a primeira posição sem duplicar.
 */
export function addRecentRoute(session, pathname, search = "") {
  if (!session || typeof window === "undefined") return;

  // Ignora login, paginas de erro e telas tecnicas/externas
  if (!pathname || pathname.startsWith("/login") || pathname.startsWith("/nova-senha") || pathname.startsWith("/recuperar")) {
    return;
  }

  const registryItem = getRegistryItemByRoute(pathname, search);
  if (!registryItem || !registryItem.id) return;

  const ns = getUserNamespace(session);
  const data = loadStorageData(ns);

  // Remove duplicatas
  const filtered = data.recentIds.filter(id => id !== registryItem.id);
  // Adiciona ao topo e limita aos mais recentes
  const updatedRecentIds = [registryItem.id, ...filtered].slice(0, MAX_RECENTES);
  const usage = { ...data.usage, [registryItem.id]: Math.min((data.usage[registryItem.id] || 0) + 1, 100000) };

  saveStorageData(ns, { ...data, recentIds: updatedRecentIds, usage });

  // Dispara evento para atualização reativa
  window.dispatchEvent(new CustomEvent("hefisto:recents-changed", { detail: { recentIds: updatedRecentIds } }));
}

/**
 * Retorna a lista de itens Recentes permitidos para o usuário.
 * Revalida rigorosamente contra as permissões atuais antes de retornar.
 */
export function getRecentItems(session) {
  if (!session) return [];
  const ns = getUserNamespace(session);
  const data = loadStorageData(ns);
  const accessible = getAccessibleNavigation(session);
  const accessibleMap = new Map(accessible.map(item => [item.id, item]));

  // Retorna os itens que permanecem acessíveis
  return data.recentIds
    .map(id => accessibleMap.get(id))
    .filter(Boolean);
}

/**
 * Alterna a marcação de um item como Favorito (☆ -> ★).
 */
export function toggleFavoriteItem(session, itemId) {
  if (!session || !itemId || typeof window === "undefined") return false;

  const ns = getUserNamespace(session);
  const data = loadStorageData(ns);
  const exists = data.favoriteIds.includes(itemId);

  let updatedFavorites = [];
  if (exists) {
    updatedFavorites = data.favoriteIds.filter(id => id !== itemId);
  } else {
    updatedFavorites = [...data.favoriteIds, itemId];
  }

  saveStorageData(ns, { ...data, favoriteIds: updatedFavorites });

  const isFav = !exists;
  window.dispatchEvent(new CustomEvent("hefisto:favorites-changed", { detail: { itemId, isFavorite: isFav } }));
  return isFav;
}

/**
 * Retorna se um item é favorito.
 */
export function isFavorite(session, itemId) {
  if (!session || !itemId) return false;
  const ns = getUserNamespace(session);
  const data = loadStorageData(ns);
  return data.favoriteIds.includes(itemId);
}

/**
 * Retorna a lista de itens Favoritos permitidos para o usuário.
 * Se o usuário perdeu permissão de um item, ele NÃO é retornado.
 */
export function getFavoriteItems(session) {
  if (!session) return [];
  const ns = getUserNamespace(session);
  const data = loadStorageData(ns);
  const accessible = getAccessibleNavigation(session);
  const accessibleMap = new Map(accessible.map(item => [item.id, item]));

  return data.favoriteIds
    .map(id => accessibleMap.get(id))
    .filter(Boolean);
}

/**
 * Quantas vezes cada módulo foi aberto por este usuário nesta unidade
 * (só os que ele ainda pode acessar).
 */
export function getUsageCounts(session) {
  if (!session) return {};
  const data = loadStorageData(getUserNamespace(session));
  const ok = new Set(getAccessibleNavigation(session).map((i) => i.id));
  return Object.fromEntries(Object.entries(data.usage).filter(([id]) => ok.has(id)));
}
