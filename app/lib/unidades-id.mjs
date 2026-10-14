// Identificador de unidade nova. A coluna unidades.id é texto, obrigatória e
// sem valor padrão no banco: a tela antiga mandava só o nome e a criação
// falhava. O id é o nome em minúsculas, sem acento, com hífen
// ("Marmitaria Centro" → "marmitaria-centro"); se já existir, ganha -2, -3…

export function idDaUnidade(nome, existentes = []) {
  const base = String(nome || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
    .slice(0, 40) || "unidade";
  const usados = new Set(existentes.map((x) => String(x).toLowerCase()));
  // "todas" e "matriz" são valores especiais do seletor de unidade
  usados.add("todas"); usados.add("matriz");
  if (!usados.has(base)) return base;
  for (let n = 2; ; n++) if (!usados.has(`${base}-${n}`)) return `${base}-${n}`;
}

/** Empresa da unidade nova: a única empresa das unidades existentes; se houver mais de uma, quem cria escolhe. */
export function empresaPadrao(unidades = []) {
  const ids = [...new Set(unidades.map((u) => u?.empresa_id).filter(Boolean))];
  return ids.length === 1 ? ids[0] : null;
}
