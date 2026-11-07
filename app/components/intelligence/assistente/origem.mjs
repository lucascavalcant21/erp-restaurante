// Ida e volta do contexto da tela para o Assistente Héfisto pela URL.
//
// O atalho (Alt+H, menu, busca) em qualquer tela abre /dashboard/inteligencia/assistente
// levando a pergunta (q), a rota de origem (de) e o registro aberto (tipo, id, nome).
// Tudo é só INDICATIVO: o servidor revalida a tela (context-engine) e a entidade
// só vale depois de conferida no banco da unidade. Aqui só se limita o formato.

export const ROTA_ASSISTENTE = "/dashboard/inteligencia/assistente";

const TIPOS = new Set(["produto", "compra", "colaborador", "conta_pagar", "ficha", "fornecedor", "evento"]);
const ROTULO_TIPO = { produto: "Produto", compra: "Compra", colaborador: "Funcionário", conta_pagar: "Conta", ficha: "Ficha técnica", fornecedor: "Fornecedor", evento: "Evento" };
const ID = /^[A-Za-z0-9_\-]{1,64}$/;

/** Monta o link do assistente. `tela` no formato de telaAtual (PainelHefisto). */
export function linkDoAssistente({ texto = null, tela = null } = {}) {
  const p = new URLSearchParams();
  if (texto) p.set("q", String(texto).slice(0, 500));
  const rota = String(tela?.rota || "");
  if (rota.startsWith("/dashboard") && !rota.startsWith("/dashboard/inteligencia")) p.set("de", rota.slice(0, 200));
  const e = tela?.entidade;
  if (e && TIPOS.has(e.tipo) && (e.id || e.nome)) {
    p.set("tipo", e.tipo);
    if (e.id && ID.test(String(e.id))) p.set("id", String(e.id));
    if (e.nome) p.set("nome", String(e.nome).slice(0, 80));
  }
  const qs = p.toString();
  return qs ? `${ROTA_ASSISTENTE}?${qs}` : ROTA_ASSISTENTE;
}

/** Lê a URL de volta: { pergunta, tela, rotulo } — com o mesmo limite de formato. */
export function origemDaUrl(params) {
  const get = (k) => (params && typeof params.get === "function" ? params.get(k) : null);
  const q = get("q");
  const de = get("de");
  const rota = de && de.startsWith("/dashboard") && !de.startsWith("/dashboard/inteligencia") ? de.slice(0, 200) : null;
  const tipo = get("tipo");
  const id = get("id");
  const nome = get("nome");
  const entidade = TIPOS.has(tipo) && ((id && ID.test(id)) || nome)
    ? { tipo, id: id && ID.test(id) ? id : null, nome: nome ? nome.slice(0, 80) : null } : null;
  const tela = rota ? { rota, entidade } : null;
  const rotulo = rota
    ? `${entidade ? `${ROTULO_TIPO[tipo]}: ${entidade.nome || entidade.id} · ` : ""}${rota.replace(/^\/dashboard\/?/, "").split("?")[0] || "início"}`
    : null;
  return { pergunta: q ? q.slice(0, 500) : null, tela, rotulo };
}
