"use client";

// Contadores reais dos submódulos da central de navegação (ModuleHub).
// Busca só o que cada módulo precisa, em paralelo, e nunca quebra a tela:
// qualquer falha vira "sem contador" naquele item.

import { fetchInsumos, fetchFichas } from "./operacao";
import { fetchEstoque } from "./estoque";
import { fetchMontagens } from "./montagem";
import { fetchFornecedores } from "./fornecedores";
import { fetchNotas } from "./notas";
import { fetchEtiquetas } from "./etiquetas";
import { fetchColaboradores } from "./rh";
import { fetchContas } from "./financeiro";
import { fetchManutencoes } from "./controles_cozinha";
import { fetchInventario } from "./inventario";

const tam = (r) => (Array.isArray(r) ? r.length : Array.isArray(r?.data) ? r.data.length : 0);
async function segura(promessa) { try { return await promessa; } catch { return null; } }

// Retorna um mapa { countKey: número } para o módulo pedido.
export async function fetchContadoresModulo(modulo, unidadeId) {
  const c = {};
  if (!unidadeId || unidadeId === "todas") return c;
  const dept = (modulo === "cozinha" || modulo === "bar") ? modulo : undefined;

  if (modulo === "cozinha" || modulo === "bar") {
    const [ins, fic, est, mon, forn, notas, etq] = await Promise.all([
      segura(fetchInsumos(unidadeId, dept)),
      segura(fetchFichas(unidadeId, dept)),
      segura(fetchEstoque(unidadeId, dept)),
      segura(fetchMontagens(unidadeId, dept)),
      segura(fetchFornecedores(unidadeId)),
      segura(fetchNotas(unidadeId)),
      segura(fetchEtiquetas(unidadeId, 500, "ativa")),
    ]);
    if (ins) c.insumos = tam(ins);
    if (fic) c.fichas = tam(fic);
    if (est) c.estoque = tam(est);
    if (mon) c.montagens = tam(mon);
    if (forn) c.fornecedores = tam(forn);
    if (notas) c.notas = tam(notas);
    if (etq) c.etiquetas = tam(etq);
    return c;
  }

  if (modulo === "financeiro") {
    const contas = await segura(fetchContas(unidadeId, ""));
    if (contas) c.contasPendentes = (contas.data || []).filter((x) => (x.status || "pendente") !== "pago").length;
    return c;
  }

  if (modulo === "rh") {
    const colab = await segura(fetchColaboradores(unidadeId));
    if (colab) c.colaboradores = (colab.data || []).filter((x) => (x.status || "ativo") !== "inativo").length;
    return c;
  }

  if (modulo === "gestao") {
    const [inv, man] = await Promise.all([
      segura(fetchInventario(unidadeId)),
      segura(fetchManutencoes(unidadeId)),
    ]);
    if (inv) c.inventario = tam(inv);
    if (man) c.manutencoes = tam(man);
    return c;
  }

  return c;
}
