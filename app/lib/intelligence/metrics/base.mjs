// Base comum das métricas: cada métrica roda com o mesmo ambiente (banco
// escopado, escopo, fuso, "agora"), confere a permissão ANTES de ler e sai
// sempre num dos três formatos do contrato: métrica, insuficiente ou
// sem_permissao. Fonte ausente/indisponível vira DADOS INSUFICIENTES com o
// motivo; violação de isolamento NÃO é engolida — derruba a requisição.

import { insuficiente, semPermissao } from "../core/contratos.mjs";
import { ErroDeFonte, ErroDeIsolamento, consultasDesde } from "../context/db-escopado.mjs";
import { exigirEscopo } from "../context/escopo.mjs";
import { hojeNoFuso, FUSO_PADRAO } from "../core/periodos.mjs";
import { ROTULO_CAPACIDADE } from "../permissions/mapa.mjs";

/**
 * @param {object} p
 * @param {object} p.dbe          banco escopado (criarDbEscopado)
 * @param {object} p.escopo       escopo autêntico
 * @param {{pode:(cap:string)=>Promise<boolean>}} p.verificador
 * @param {Date}   [p.agora]
 * @param {string} [p.fuso]
 */
export function criarAmbiente({ dbe, escopo, verificador, agora = new Date(), fuso = FUSO_PADRAO }) {
  exigirEscopo(escopo);
  if (!verificador?.pode) throw new Error("Métricas sem verificador de permissão.");
  return Object.freeze({ dbe, escopo, verificador, agora, fuso, hoje: hojeNoFuso(agora, fuso), apuradoEm: agora.toISOString() });
}

/**
 * Executa uma métrica com permissão, captura das consultas e tratamento de
 * fonte ausente. `corpo(consultas)` devolve metrica()/insuficiente().
 */
export async function medir(amb, { id, capacidade, periodo = null }, corpo) {
  if (capacidade && !(await amb.verificador.pode(capacidade))) {
    return semPermissao({ metrica: id, capacidade: ROTULO_CAPACIDADE[capacidade] || capacidade, apuradoEm: amb.apuradoEm });
  }
  const inicio = amb.dbe.consultas.length;
  const consultas = () => consultasDesde(amb.dbe, inicio);
  try {
    return await corpo(consultas);
  } catch (e) {
    if (e instanceof ErroDeIsolamento) throw e;
    if (e instanceof ErroDeFonte) {
      return insuficiente({
        metrica: id, periodo, escopo: amb.escopo, apuradoEm: amb.apuradoEm, consultas: consultas(),
        motivo: e.ausente ? `${e.message} Este dado ainda não existe no Héfisto desta empresa.` : `${e.message} Tente novamente em instantes.`,
        faltando: [e.tabela],
      });
    }
    throw e;
  }
}

export const r2 = (n) => Math.round(Number(n) * 100) / 100;
export const r3 = (n) => Math.round(Number(n) * 1000) / 1000;
export const soma = (xs, f = (x) => x) => xs.reduce((t, x) => t + (Number(f(x)) || 0), 0);
export const brl = (v) => Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const pct = (v, casas = 1) => `${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas })}%`;
export const fonte = (tabela, descricao) => ({ tabela, descricao });
