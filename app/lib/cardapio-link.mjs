// Endereços do cardápio digital. Um lugar só para o editor (QR Code) e para
// o redirecionamento dos links antigos do Experience.

/** "Mesa 12", "mesa-12" e "12" viram "12". O resto que não for letra/número sai. */
export function limparMesa(v) {
  const s = String(v ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim()
    .replace(/^mesa[\s_-]*/i, "").replace(/[^A-Za-z0-9-]+/g, "");
  return s.slice(0, 10);
}

export function caminhoDoCardapio(unidade, { mesa = "" } = {}) {
  const m = limparMesa(mesa);
  const base = `/cardapio/${encodeURIComponent(String(unidade || ""))}`;
  return m ? `${base}?mesa=${encodeURIComponent(m)}` : base;
}

/** Página do cadastro pelo QR (CRM + desconto do cadastro). */
export function caminhoDoCadastro(unidade) {
  return `/cadastro/${encodeURIComponent(String(unidade || ""))}`;
}
