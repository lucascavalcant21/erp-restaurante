// Busca dos números da tela inicial. Só LEITURA: abrir a tela inicial não pode
// gravar nada (fetchEstoques, por exemplo, cria os estoques padrão — por isso
// o estoque aqui tem consulta própria, com a mesma regra dos cartões dele).
//
// Cada bloco é independente: um módulo sem tabela ou fora do ar mostra "—" no
// cartão dele e o resto da tela continua de pé.

import { supabase, isSupabaseReady } from "./supabase";
import { fetchPontoHoje } from "./ponto";
import { fetchEventos } from "./eventos";
import { fetchContasPagar } from "./financeiro";
import { fetchMesasEComandas } from "./mesas";
import { MOTIVO_SEM_FATURAMENTO } from "./cmv-dados.mjs";
import {
  dataLocalISO, seteDiasAte, resumirFaturamentoDiario, resumirEquipe, reservasDoDia,
  proximosEventos, resumirContas, estoqueAbaixoDoMinimo, resumirMesas,
} from "./painel-inicio.mjs";

const falhou = (erro) => ({ ok: false, erro: String(erro?.message || erro || "Falha ao carregar") });
const deu = (dados) => ({ ok: true, dados });

const tabelaAusente = (e) => /does not exist|não existe|schema cache|could not find/i.test(String(e?.message || e || ""));

// Faturamento diário informado — a mesma fonte do CMV % e do DRE. A tabela é
// opcional (db/F2_4C_FATURAMENTO_DIARIO_OPCIONAL.sql): sem ela, o cartão diz
// que não há fonte, em vez de mostrar R$ 0,00.
async function faturamentoDaSemana(unidadeId, agora) {
  const { de, ate } = seteDiasAte(agora);
  const { data, error } = await supabase
    .from("fin_faturamento_diario")
    .select("data, receita")
    .eq("unidade_id", unidadeId)
    .gte("data", de)
    .lte("data", ate);
  if (error) {
    if (tabelaAusente(error)) return { disponivel: false, motivo: MOTIVO_SEM_FATURAMENTO };
    throw error;
  }
  return { disponivel: true, ...resumirFaturamentoDiario(data || [], agora) };
}

async function reservasDeHoje(unidadeId, hojeIso) {
  const { data, error } = await supabase
    .from("reservas")
    .select("*")
    .eq("unidade_id", unidadeId)
    .eq("data_reserva", hojeIso)
    .order("horario", { ascending: true });
  if (error) throw error;
  return reservasDoDia(data || [], hojeIso);
}

async function estoqueBaixo(unidadeId) {
  const { data: estoques, error } = await supabase
    .from("estoques").select("id, nome").eq("unidade_id", unidadeId).eq("status", "ativo");
  if (error) throw error;
  const ids = (estoques || []).map((e) => e.id);
  if (!ids.length) return estoqueAbaixoDoMinimo([], []);
  const { data: itens, error: erroItens } = await supabase
    .from("estoque_itens").select("estoque_id, quantidade_atual, estoque_minimo").in("estoque_id", ids);
  if (erroItens) throw erroItens;
  return estoqueAbaixoDoMinimo(estoques, itens || []);
}

const comErro = async (fn) => {
  try { return deu(await fn()); } catch (e) { return falhou(e); }
};

/**
 * pode: { financeiro, contas, rh, eventos, estoque, mesas } — o que a sessão enxerga.
 * Bloco sem permissão nem é consultado (não basta esconder o cartão: o número
 * financeiro não pode nem chegar ao navegador de quem não tem acesso).
 */
export async function carregarPainelInicio(unidadeId, pode, agora = new Date()) {
  if (!isSupabaseReady() || !unidadeId || unidadeId === "todas") return null;
  const hojeIso = dataLocalISO(agora);
  const nada = Promise.resolve(null);

  const [faturamento, contas, equipe, reservas, eventos, estoque, mesas] = await Promise.all([
    pode.financeiro ? comErro(() => faturamentoDaSemana(unidadeId, agora)) : nada,
    pode.contas ? comErro(async () => {
      const r = await fetchContasPagar(unidadeId);
      if (r.error) throw new Error(r.error);
      return resumirContas(r.data, hojeIso);
    }) : nada,
    pode.rh ? comErro(async () => resumirEquipe((await fetchPontoHoje(unidadeId)).data)) : nada,
    pode.eventos ? comErro(() => reservasDeHoje(unidadeId, hojeIso)) : nada,
    pode.eventos ? comErro(async () => {
      const r = await fetchEventos(unidadeId);
      if (r.error) throw new Error(r.error);
      return proximosEventos(r.data, hojeIso);
    }) : nada,
    pode.estoque ? comErro(() => estoqueBaixo(unidadeId)) : nada,
    pode.mesas ? comErro(async () => {
      const r = await fetchMesasEComandas(unidadeId);
      if (r.error) throw new Error(r.error);
      return resumirMesas(r.data);
    }) : nada,
  ]);

  return { hojeIso, faturamento, contas, equipe, reservas, eventos, estoque, mesas, em: agora };
}
