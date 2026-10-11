"use client";

// Operacional → Estoque abre AQUI: a tela única de movimentação (HDEV-EST-001).
// Inventário, histórico, painel e produtos/locais ficam nas abas (EstoqueAbas).
// ?estoque=<id>&tipo=entrada|saida|transferencia&insumo=<id> abre já no produto.
// Endereços antigos: ?gestao=1 (o painel de antes) vai para Produtos e locais.

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useERP } from "../../../context/ERPContext";
import { unidadeValida } from "../../../lib/contas-pagar.mjs";
import EstoqueAbas from "../../../components/navigation/EstoqueAbas";
import MovimentarEstoque from "../../../components/estoque/MovimentarEstoque";

export default function EstoquePage() {
  return <Suspense fallback={<p className="p-8 text-center font-bold text-hf-text-2">Carregando...</p>}><Estoque /></Suspense>;
}

function Estoque() {
  const { unidadeAtiva, sessao } = useERP();
  const params = useSearchParams();
  const router = useRouter();
  const legado = params.get("gestao") === "1";
  useEffect(() => {
    if (legado) router.replace(`/dashboard/operacao/estoque/painel/produtos${params.get("dept") ? `?dept=${params.get("dept")}` : ""}`);
  }, [legado]); // eslint-disable-line react-hooks/exhaustive-deps
  if (legado) return null;
  const inicial = { estoque: params.get("estoque") || "", tipo: params.get("tipo") || "", insumo: params.get("insumo") || "" };
  return (
    <div className="min-h-screen bg-hf-bg">
      <EstoqueAbas />
      {unidadeValida(unidadeAtiva)
        ? <MovimentarEstoque key={`${unidadeAtiva}|${inicial.estoque}|${inicial.tipo}|${inicial.insumo}`} unidade={unidadeAtiva} sessao={sessao} inicial={inicial} />
        : <p className="p-8 text-center font-bold text-hf-text-2">Selecione uma unidade para lançar no estoque.</p>}
    </div>
  );
}
