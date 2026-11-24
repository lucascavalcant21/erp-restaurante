// CONFIGURAÇÕES EM GRUPOS (dono, 24/11/2026: "está antigo, longo, complexo e
// nada objetivo"). A tela vira uma lista curta, como os ajustes do celular:
// cada linha mostra o que está valendo hoje e abre só aquele assunto.
// Em cima, "Falta ajustar" lista o que está incompleto ou inseguro.
//
// `secao` abre dentro da própria tela (?s=…); `href` vai para a tela que já
// existe. `rota` é a que o catálogo de permissões confere.

const BASE = "/dashboard/configuracoes";

export const GRUPOS_CONFIG = Object.freeze([
  {
    id: "empresa", titulo: "Empresa",
    itens: [
      { id: "empresa", titulo: "Dados da empresa", icone: "Store", secao: "empresa", rota: BASE },
      { id: "unidades", titulo: "Unidades", icone: "Layers", secao: "unidades", rota: BASE },
    ],
  },
  {
    id: "equipe", titulo: "Equipe e acesso",
    itens: [
      { id: "usuarios", titulo: "Usuários e senhas", icone: "Users", href: `${BASE}/usuarios`, rota: `${BASE}/usuarios`, resumoFixo: "Logins, senhas e o que cada um vê" },
      { id: "perfis", titulo: "Perfis de acesso", icone: "ShieldCheck", href: `${BASE}/perfis`, rota: `${BASE}/perfis`, resumoFixo: "Permissões prontas por função" },
      { id: "apps", titulo: "Tablets e terminais", icone: "Tablet", href: `${BASE}/apps`, rota: `${BASE}/apps`, resumoFixo: "Cozinha, bar, salão, ponto" },
      { id: "cargos", titulo: "Funções", icone: "UserRound", cor: "rosa", secao: "cargos", rota: BASE },
      { id: "pin", titulo: "PIN do gerente", icone: "Lock", secao: "pin", rota: BASE },
    ],
  },
  {
    id: "operacao", titulo: "Regras da operação",
    itens: [
      { id: "ponto", titulo: "Ponto", icone: "Hourglass", secao: "ponto", rota: BASE },
      { id: "metas", titulo: "Metas e descontos", icone: "Wallet", secao: "metas", rota: BASE },
      { id: "validades", titulo: "Validade das etiquetas", icone: "Tag", secao: "validades", rota: BASE },
      { id: "estoque", titulo: "Segurança do estoque", icone: "Package", href: `${BASE}/estoque`, rota: `${BASE}/estoque`, resumoFixo: "PIN de ajuste e contagem cega" },
    ],
  },
  {
    id: "impressao", titulo: "Impressão",
    itens: [
      { id: "comandas", titulo: "Comandas", icone: "Printer", href: `${BASE}/impressao`, rota: `${BASE}/impressao`, resumoFixo: "Vias da cozinha, bar e recibo" },
      { id: "etiquetas", titulo: "Tamanho das etiquetas", icone: "Tag", cor: "ciano", href: `${BASE}/etiquetas`, rota: `${BASE}/etiquetas`, resumoFixo: "Largura, altura e impressora" },
      { id: "usb", titulo: "Testar impressora USB", icone: "Plug", cor: "ardosia", href: `${BASE}/impressoras`, rota: `${BASE}/impressoras`, resumoFixo: "Para técnico: detectar e testar" },
    ],
  },
  {
    id: "integracoes", titulo: "Conexões",
    itens: [
      { id: "integracoes", titulo: "Integrações", icone: "Plug", href: `${BASE}/integracoes`, rota: `${BASE}/integracoes`, resumoFixo: "iFood, pagamentos e fiscal" },
      { id: "instalar", titulo: "Instalar o app neste aparelho", icone: "Smartphone", secao: "instalar", rota: BASE, resumoFixo: "Tela cheia, sem barra do navegador" },
    ],
  },
]);

export const SECOES_CONFIG = Object.freeze(GRUPOS_CONFIG.flatMap((g) => g.itens.filter((i) => i.secao).map((i) => i.secao)));
export const itemDaSecao = (secao) => GRUPOS_CONFIG.flatMap((g) => g.itens).find((i) => i.secao === secao) || null;

/** Só os grupos e linhas que a pessoa pode abrir. */
export function gruposVisiveis(podeRota = () => true) {
  return GRUPOS_CONFIG
    .map((g) => ({ ...g, itens: g.itens.filter((i) => podeRota(i.rota)) }))
    .filter((g) => g.itens.length);
}

const digitos = (v) => String(v || "").replace(/\D/g, "");
export const cepCompleto = (cep) => digitos(cep).length === 8;
export const cnpjCompleto = (cnpj) => digitos(cnpj).length === 14;
export const mascaraCep = (v) => digitos(v).slice(0, 8).replace(/^(\d{5})(\d)/, "$1-$2");
export const PIN_DE_FABRICA = "1234";
const PINS_FRACOS = new Set(["0000", "1111", "1234", "4321", "1212", "2222", "9999", "0123"]);
export const pinFraco = (pin) => PINS_FRACOS.has(String(pin || ""));

/**
 * O que está faltando ou inseguro, na ordem em que vale resolver.
 * @returns {{ secao: string, texto: string }[]}
 */
export function pendenciasConfig({ unidade = null, pins = null } = {}) {
  const out = [];
  if (pins && pinFraco(pins.pin_gerente)) {
    out.push({ secao: "pin", texto: pins.pin_gerente === PIN_DE_FABRICA ? "PIN do gerente ainda é o de fábrica (1234)" : "PIN do gerente fácil de adivinhar" });
  }
  if (unidade) {
    if (unidade.cep && !cepCompleto(unidade.cep)) out.push({ secao: "empresa", texto: `CEP incompleto (${digitos(unidade.cep).length} de 8 números)` });
    if (!unidade.cep) out.push({ secao: "empresa", texto: "Falta o CEP" });
    if (unidade.cnpj && !cnpjCompleto(unidade.cnpj)) out.push({ secao: "empresa", texto: "CNPJ incompleto" });
    if (!unidade.cnpj) out.push({ secao: "empresa", texto: "Falta o CNPJ" });
  }
  return out;
}

/** Linha de baixo de cada item: o que vale hoje, em poucas palavras. */
export function resumoDoItem(id, d = {}) {
  const u = d.unidade || {};
  switch (id) {
    case "empresa": return [u.nome_fantasia || u.nome, u.cidade && `${u.cidade}${u.uf ? `/${u.uf}` : ""}`].filter(Boolean).join(" · ") || "Nome, CNPJ e endereço";
    case "unidades": {
      const n = (d.unidades || []).length;
      return n ? `${n} ${n === 1 ? "unidade" : "unidades"} · em uso: ${u.nome || "—"}` : "Nenhuma unidade";
    }
    case "cargos": return d.cargos == null ? "…" : `${d.cargos.length} ${d.cargos.length === 1 ? "função" : "funções"}${d.cargos.some((c) => c.eh_supervisor) ? ` · ${d.cargos.filter((c) => c.eh_supervisor).length} de supervisão` : ""}`;
    case "pin": return d.pins == null ? "…" : pinFraco(d.pins.pin_gerente) ? "Troque: PIN fácil" : "Definido";
    case "ponto": return d.params == null ? "…" : `Tolerância ${d.params.tolerancia_marcacao} min · falta após ${d.params.limite_atraso} min`;
    case "metas": return d.params == null ? "…" : `CMV até ${d.params.meta_cmv}% · desconto da equipe ${d.params.desconto_func_pct}%`;
    case "validades": return d.validades == null ? "…" : d.validades.map((v) => `${v.nome} ${v.dias}d`).slice(0, 3).join(" · ") || "Nenhuma";
    default: return null;
  }
}
