"use client";

// Operacional → Estoque abre AQUI: uma tela só (pedido do dono, 27/10/2026)
// com todos os produtos; tocar no produto abre retirar/adicionar por cima.
// Histórico, inventário, locais e valor ficam no "Mais" (EstoqueAbas).
// ?estoque=<id>&tipo=entrada|saida|transferencia&insumo=<id> abre já no produto;
// ?area=cozinha|bar|salao|limpeza filtra a área.
// Endereços antigos: ?gestao=1 (o painel de antes) vai para Produtos e locais.

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useERP } from "../../../context/ERPContext";
import { unidadeValida } from "../../../lib/contas-pagar.mjs";
import EstoqueAbas from "../../../components/navigation/EstoqueAbas";
import TelaEstoque from "../../../components/estoque/TelaEstoque";

export default function EstoquePage() {
  return <Suspense fallback={<p className="p-8 text-center font-bold text-hf-text-2">Carregando...</p>}><Estoque /></Suspense>;
}

function Estoque() {
  const { unidadeAtiva } = useERP();
  const params = useSearchParams();
  const router = useRouter();
  const legado = params.get("gestao") === "1";
  useEffect(() => {
    if (legado) router.replace(`/dashboard/operacao/estoque/painel/produtos${params.get("dept") ? `?dept=${params.get("dept")}` : ""}`);
  }, [legado]); // eslint-disable-line react-hooks/exhaustive-deps
  if (legado) return null;
  const inicial = { estoque: params.get("estoque") || "", area: params.get("area") || "", tipo: params.get("tipo") || "", insumo: params.get("insumo") || "" };
  return (
    <div className="min-h-screen bg-hf-bg">
      <EstoqueAbas />
      {unidadeValida(unidadeAtiva)
        ? <TelaEstoque key={`${unidadeAtiva}|${inicial.estoque}|${inicial.area}|${inicial.tipo}|${inicial.insumo}`} inicial={inicial} />
        : <p className="p-8 text-center font-bold text-hf-text-2">Selecione uma unidade para lançar no estoque.</p>}
    </div>
  );
}
