// SEQUÊNCIA DA MARMITARIA (pedido do dono, 16/11/2026): "você entra, cadastra
// os dados da empresa e funcionários, custos fixos e variáveis, cadastro de
// apps, ingredientes, embalagens, ficha técnica, precificação unitária e
// combos, guia de montagem e DRE". "Tem que ser simples, rápido e prático mas
// extremamente preciso." "Depois de fazer essa sequência não precisa mais
// seguir a sequência: o sistema muda."
//
// Status de cada passo pelo que está CADASTRADO de verdade (nada de "marquei
// como feito"). Quando os nove ficam prontos, a implantação é dada como
// concluída e a marmitaria passa ao modo do dia a dia, e não volta mais à
// sequência (mesmo que depois falte algo: aí aparece como aviso no Início).
// Módulo puro, testado em jornada.test.mjs.

import { canalConfigurado, normalizarCanal } from "./nucleo.mjs";
import { resumoDoProcesso } from "./processos.mjs";

const FICHA = "/dashboard/marmitaria/marmitas";
export const ROTAS = Object.freeze({
  empresa: "/dashboard/marmitaria/funcionarios",
  custos: "/dashboard/marmitaria/configuracoes/custos",
  apps: "/dashboard/marmitaria/configuracoes/apps",
  ingredientes: `${FICHA}/produtos`,
  embalagens: `${FICHA}/embalagens`,
  fichas: FICHA,
  preco: `${FICHA}/cardapio`,
  combos: `${FICHA}/combos`,
  montagem: `${FICHA}/processos`,
  dre: "/dashboard/marmitaria/financeiro",
});

export const PASSOS = Object.freeze([
  { id: "empresa", titulo: "Delivery e equipe", texto: "Nome e segmento do delivery e quem trabalha nele." },
  { id: "custos", titulo: "Custos fixos e variáveis", texto: "Contas do mês, pró-labore, imposto e o que gasta por marmita." },
  { id: "apps", titulo: "Apps e taxas", texto: "iFood, 99, Keeta, balcão… com as taxas de cada plano." },
  { id: "ingredientes", titulo: "Ingredientes", texto: "O que você compra, com o preço." },
  { id: "embalagens", titulo: "Embalagens", texto: "Potes, tampas, sacolas, com o preço." },
  { id: "fichas", titulo: "Ficha técnica", texto: "O que vai em cada marmita e quanto." },
  { id: "preco", titulo: "Precificação", texto: "O preço de cada produto em cada app, com equipe e custos." },
  // opcional: não segura a implantação (dono, 17/11/2026)
  { id: "combos", titulo: "Combos e descontos", texto: "Marmita com bebida e sobremesa, e descontos.", opcional: true },
  { id: "montagem", titulo: "Guia de montagem", texto: "O passo a passo de cada marmita, para imprimir." },
  { id: "dre", titulo: "DRE", texto: "Lance as vendas e veja o resultado do mês." },
]).map((p, i) => ({ ...p, numero: i + 1, rota: ROTAS[p.id] }));

const pos = (v) => Number(String(v ?? "").replace(",", ".")) > 0;
const preenchido = (v) => v !== null && v !== undefined && String(v).trim() !== "";

/**
 * dados: {
 *   unidade, config (base.config), insumosLista, marmitas, custos (Map id → { completo }),
 *   processos ({ [marmitaId]: processo }), alocacoes (número ou null), temVendas (bool ou null),
 *   ehEmbalagem (fn), precoDoInsumo (fn), concluidaSalva (bool)
 * }
 * Fonte que não pôde ser lida (null) deixa o passo "sem_dado", não "pendente".
 */
export function statusDaJornada(d = {}) {
  const cfg = d.config || {};
  const r = cfg.rateio || {};
  const ativas = (d.marmitas || []).filter((m) => m.ativo !== false);
  const ehEmb = d.ehEmbalagem || (() => false);
  const preco = d.precoDoInsumo || ((i) => Number(i?.custo_unitario) || 0);
  const insumos = d.insumosLista || [];
  const ingredientes = insumos.filter((i) => !ehEmb(i));
  const embalagens = insumos.filter((i) => ehEmb(i));

  const st = {};
  // 1. Delivery e equipe
  // O nome do delivery (passo 1) ou, sem ele, o nome da unidade.
  const empresaOk = Boolean(String(d.delivery?.nome || d.unidade?.nome_fantasia || d.unidade?.nome || "").trim());
  const equipeOk = (d.alocacoes ?? 0) > 0 || preenchido(r.cmo_mes);
  st.empresa = d.alocacoes == null && !preenchido(r.cmo_mes)
    ? { status: "sem_dado", detalhe: "Não consegui conferir a equipe agora." }
    : { status: empresaOk && equipeOk ? "feito" : "pendente", detalhe: !empresaOk ? "Falta o nome do delivery." : !equipeOk ? "Falta dizer quem trabalha na marmitaria." : `${d.alocacoes || 0} na equipe` };

  // 2. Custos fixos e variáveis (+ imposto e volume, sem eles não há custo por marmita)
  const fixos = (Array.isArray(r.custos_fixos) ? r.custos_fixos : []).filter((c) => String(c?.nome || "").trim() && pos(c?.valor)).length;
  const impostoOk = r.regime === "mei" || cfg.tributos_pct !== null && cfg.tributos_pct !== undefined;
  const volumeOk = pos(r.marmitas_mes);
  const faltaCustos = [!fixos && "custos fixos", !impostoOk && "imposto", !volumeOk && "marmitas por mês"].filter(Boolean);
  st.custos = { status: faltaCustos.length ? "pendente" : "feito", detalhe: faltaCustos.length ? `Falta: ${faltaCustos.join(", ")}.` : `${fixos} contas fixas` };

  // 3. Apps e taxas
  const canais = (cfg.canais || []).map(normalizarCanal).filter((c) => c.ativo !== false);
  const prontos = canais.filter(canalConfigurado).length;
  st.apps = { status: prontos ? "feito" : "pendente", detalhe: prontos ? `${prontos} de ${canais.length} com taxas` : "Nenhum app com as taxas preenchidas." };

  // 4. Ingredientes e 5. Embalagens (com preço: sem preço não há custo)
  const ingComPreco = ingredientes.filter((i) => preco(i) > 0).length;
  st.ingredientes = { status: ingComPreco ? "feito" : "pendente", detalhe: `${ingComPreco} com preço${ingredientes.length > ingComPreco ? ` · ${ingredientes.length - ingComPreco} sem preço` : ""}` };
  const embComPreco = embalagens.filter((i) => preco(i) > 0).length;
  st.embalagens = { status: embComPreco ? "feito" : "pendente", detalhe: `${embComPreco} com preço${embalagens.length > embComPreco ? ` · ${embalagens.length - embComPreco} sem preço` : ""}` };

  // 6. Ficha técnica: todas as ativas com custo completo
  const incompletas = ativas.filter((m) => !d.custos?.get?.(m.id)?.completo).length;
  st.fichas = { status: ativas.length && !incompletas ? "feito" : "pendente", detalhe: !ativas.length ? "Nenhuma marmita ainda." : incompletas ? `${incompletas} sem custo completo` : `${ativas.length} marmitas` };

  // 7. Preço: cada ativa com preço em pelo menos um app
  const semPreco = ativas.filter((m) => !Object.values(m.precos || {}).some(pos) && !pos(m.preco_venda)).length;
  st.preco = { status: ativas.length && !semPreco ? "feito" : "pendente", detalhe: !ativas.length ? "Primeiro a ficha técnica." : semPreco ? `${semPreco} sem preço` : "Todas com preço" };

  // 8. Combos e descontos: opcional, só informa
  st.combos = { status: "opcional", detalhe: "Opcional: monte quando quiser." };

  // 9. Guia de montagem: cada ativa com pelo menos um passo escrito
  if (d.processos == null) st.montagem = { status: "sem_dado", detalhe: "Não consegui conferir os guias agora." };
  else {
    const semGuia = ativas.filter((m) => !resumoDoProcesso(d.processos[m.id]).escritas).length;
    st.montagem = { status: ativas.length && !semGuia ? "feito" : "pendente", detalhe: !ativas.length ? "Primeiro a ficha técnica." : semGuia ? `${semGuia} sem guia` : "Todas com guia" };
  }

  // 9. DRE: com venda lançada há resultado para mostrar
  st.dre = d.temVendas == null ? { status: "sem_dado", detalhe: "Não consegui conferir as vendas agora." }
    : { status: d.temVendas ? "feito" : "pendente", detalhe: d.temVendas ? "Com vendas lançadas" : "Lance a primeira venda." };

  const passos = PASSOS.map((p) => ({ ...p, ...st[p.id] }));
  const obrigatorios = passos.filter((p) => !p.opcional);
  const feitos = obrigatorios.filter((p) => p.status === "feito").length;
  const todos = feitos === obrigatorios.length;
  return {
    passos, feitos, total: obrigatorios.length, pct: Math.round((feitos / obrigatorios.length) * 100),
    proximo: obrigatorios.find((p) => p.status !== "feito") || null,
    // Concluída quando os nove ficam prontos (e fica concluída: o dono não volta à sequência).
    concluida: Boolean(d.concluidaSalva) || todos,
    acabouDeConcluir: todos && !d.concluidaSalva,
  };
}
