"use client";

// O apoio da Produção do dia: as receitas dos subprodutos, o registro das marmitas
// feitas, o planejamento e os pedidos do iFood.
// Fica sob /estoque para herdar a mesma permissão de rota.

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useMarmitaria } from "../../../../components/marmitaria/contexto";
import { Botao, Cartao, Secao, num } from "../../../../components/marmitaria/ui";
import { NovoPrePreparo } from "../../../../components/marmitaria/CadastrosRapidos";
import { Planejar, RegistrarMarmitas } from "../../../../components/marmitaria/TelasDeEstoque";
import PedidosIfood from "../../../../components/marmitaria/PedidosIfood";
import AbasDaProducao, { ABAS_DA_PRODUCAO } from "../../../../components/marmitaria/AbasDaProducao";

const unTxt = (u) => (String(u).toLowerCase() === "l" ? "L" : u || "un");

function Subprodutos() {
  const { base, unidadeId, recarregar } = useMarmitaria();
  const [editando, setEditando] = useState(false); // false | true (novo) | ficha
  return (
    <div className="space-y-4">
      {editando && <NovoPrePreparo key={editando?.id || "novo"} unidadeId={unidadeId} base={base} ficha={editando === true ? null : editando} onFechar={() => setEditando(false)} onCriado={async () => { await recarregar(); setEditando(false); }} />}
      <Secao titulo="Subprodutos" subtitulo="O que é transformado aqui: molho, frango empanado, arroz."
        direita={!editando && <Botao onClick={() => setEditando(true)}>Novo subproduto</Botao>}>
        {!base.prePreparos.length ? <p className="text-sm text-hf-text-2">Nenhum subproduto cadastrado.</p> : (
          <ul className="divide-y divide-hf-border">
            {base.prePreparos.map((f) => (
              <li key={f.id} className="flex items-center justify-between gap-3 py-2">
                <span className="min-w-0"><span className="block text-sm font-bold text-hf-text">{f.nome_receita}</span><span className="block text-xs text-hf-muted">Rende {num(f.rendimento_porcoes)} {unTxt(f.rendimento_unidade)}</span></span>
                <button type="button" onClick={() => setEditando(f)} className="min-h-[40px] shrink-0 text-sm font-bold text-hf-accent hover:underline">Editar</button>
              </li>
            ))}
          </ul>
        )}
      </Secao>
    </div>
  );
}

function Conteudo() {
  const { base, carregando } = useMarmitaria();
  const params = useSearchParams();
  const aba = ABAS_DA_PRODUCAO.some((a) => a.id === params.get("aba")) && params.get("aba") !== "hoje" ? params.get("aba") : "subprodutos";
  if (!base) return carregando ? <Cartao><p className="text-sm text-hf-muted">Carregando produções…</p></Cartao> : null;
  return (
    <div className="space-y-4">
      <AbasDaProducao ativa={aba} />
      {aba === "subprodutos" && <Subprodutos />}
      {aba === "marmitas" && <RegistrarMarmitas />}
      {aba === "planejar" && <Planejar />}
      {aba === "pedidos" && <PedidosIfood />}
    </div>
  );
}

export default function ProducoesPage() {
  return <Suspense fallback={null}><Conteudo /></Suspense>;
}
