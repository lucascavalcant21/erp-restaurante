"use client";

// O apoio da Produção do dia: as receitas dos subprodutos, o registro das marmitas
// feitas, o planejamento e os pedidos do iFood.
// Fica sob /estoque para herdar a mesma permissão de rota.

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useMarmitaria } from "../../../../components/marmitaria/contexto";
import { Botao, Cartao, Secao, num } from "../../../../components/marmitaria/ui";
import { NovoPrePreparo } from "../../../../components/marmitaria/CadastrosRapidos";
import { Planejar, RegistrarMarmitas, useSaldoDaMarmitaria } from "../../../../components/marmitaria/TelasDeEstoque";
import { producaoPossivelDoPreparo } from "../../../../lib/marmitaria/porcoes.mjs";
import { arquivarPrePreparo } from "../../../../lib/marmitaria/dados";
import { guiaDoPrePreparo } from "../../../../lib/marmitaria/guia-prepreparo.mjs";
import { imprimirGuias } from "../../../../components/marmitaria/imprimirGuia";
import { fatorSaldo } from "../../../../lib/marmitaria/nucleo.mjs";
import Porcionamento from "../../../../components/marmitaria/Porcionamento";
import PedidosIfood from "../../../../components/marmitaria/PedidosIfood";
import AbasDaProducao, { ABAS_DA_PRODUCAO } from "../../../../components/marmitaria/AbasDaProducao";

const unTxt = (u) => (String(u).toLowerCase() === "l" ? "L" : u || "un");

function Subprodutos() {
  const { base, unidadeId, recarregar } = useMarmitaria();
  const [editando, setEditando] = useState(false); // false | true (novo) | ficha
  // "com o trigo e o panko que tenho, dá para quantos frangos?" (dono, 17/11/2026)
  const saldo = useSaldoDaMarmitaria(base);
  return (
    <div className="space-y-4">
      {editando && <NovoPrePreparo key={editando?.id || "novo"} unidadeId={unidadeId} base={base} ficha={editando === true ? null : editando} onFechar={() => setEditando(false)} onCriado={async () => { await recarregar(); setEditando(false); }} />}
      <Secao titulo="Subprodutos" subtitulo="O que é transformado aqui: molho, frango empanado, arroz."
        direita={!editando && (
          <span className="flex flex-wrap gap-2">
            {base.prePreparos.length > 0 && <Botao variante="secundario" onClick={() => imprimirGuias(base.prePreparos.map((f) => guiaDoPrePreparo(f, base.insumos, base.fichas)))}>Imprimir todos</Botao>}
            <Botao onClick={() => setEditando(true)}>Novo subproduto</Botao>
          </span>
        )}>
        {!base.prePreparos.length ? <p className="text-sm text-hf-text-2">Nenhum subproduto cadastrado.</p> : (
          <ul className="divide-y divide-hf-border">
            {base.prePreparos.map((f) => (
              <li key={f.id} className="flex items-center justify-between gap-3 py-2">
                <span className="min-w-0">
                  <span className="block text-sm font-bold text-hf-text">{f.nome_receita}</span>
                  <span className="block text-xs text-hf-muted">Rende {num(f.rendimento_porcoes)} {unTxt(f.rendimento_unidade)}{f.peso_porcao_g ? ` · ${num(f.peso_porcao_g)} g cada` : ""}
                    {base.espelho.get(f.id) && saldo.has(base.espelho.get(f.id)) ? ` · pronto no estoque: ${num(saldo.get(base.espelho.get(f.id)))} ${unTxt(f.rendimento_unidade)}` : ""}</span>
                  {(() => {
                    const r = producaoPossivelDoPreparo({ ficha: f, insumos: base.insumos, saldo, fatorSaldo });
                    return r.quantidade === null
                      ? <span className="block text-xs text-hf-muted">Dá para fazer: DADOS INSUFICIENTES ({r.motivo})</span>
                      : <span className="block text-xs font-semibold text-hf-text-2">Dá para fazer com o estoque: {num(r.quantidade)} {unTxt(f.rendimento_unidade)}{r.limita ? ` · acaba primeiro: ${r.limita.nome}` : ""}</span>;
                  })()}
                </span>
                <span className="flex shrink-0 gap-3">
                  <button type="button" onClick={() => imprimirGuias([guiaDoPrePreparo(f, base.insumos, base.fichas)])} className="min-h-[40px] text-sm font-bold text-hf-accent hover:underline">Imprimir</button>
                  <button type="button" onClick={() => setEditando(f)} className="min-h-[40px] text-sm font-bold text-hf-accent hover:underline">Editar</button>
                  <button type="button" onClick={async () => {
                    const usam = base.marmitas.filter((m) => (m.itens || []).some((x) => x.subficha_id === f.id)).map((m) => m.nome_receita);
                    if (!window.confirm(usam.length ? `"${f.nome_receita}" está em ${usam.join(", ")}. Sai da lista para novas marmitas e continua nessas, com o mesmo custo. Excluir mesmo?` : `Excluir "${f.nome_receita}" da lista?`)) return;
                    const r = await arquivarPrePreparo(f.id);
                    if (r.error) window.alert(r.error); else await recarregar();
                  }} className="min-h-[40px] text-sm font-bold text-hf-danger hover:underline">Excluir</button>
                </span>
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
      {aba === "porcionamento" && <Porcionamento />}
      {aba === "marmitas" && <RegistrarMarmitas />}
      {aba === "planejar" && <Planejar />}
      {aba === "pedidos" && <PedidosIfood />}
    </div>
  );
}

export default function ProducoesPage() {
  return <Suspense fallback={null}><Conteudo /></Suspense>;
}
