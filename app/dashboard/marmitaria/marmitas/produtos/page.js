"use client";

// Cadastro próprio dos produtos da marmitaria (pedido do dono, 05/11/2026): só
// o que a marmitaria compra e usa. Embalagem e limpeza têm cadastro à parte.

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { useMarmitaria } from "../../../../components/marmitaria/contexto";
import { ehEmbalagem } from "../../../../components/marmitaria/BuscaItens";
import { NovoProduto } from "../../../../components/marmitaria/CadastrosRapidos";
import { Botao, Cartao, Secao, brl, inputCls, num } from "../../../../components/marmitaria/ui";
import { ESTOQUE_MARMITARIA } from "../../../../lib/marmitaria/dados";
import { ehLimpeza } from "../../../../lib/marmitaria/cozinha.mjs";
import { fatorSaldo } from "../../../../lib/marmitaria/nucleo.mjs";
import { custoUnitarioEfetivoInsumo } from "../../../../lib/ficha-calculos.mjs";
import { casaBusca } from "../../../../lib/busca.mjs";

export default function ProdutosPage() {
  const { base, carregando, unidadeId, recarregar } = useMarmitaria();
  const [novo, setNovo] = useState(false);
  const [busca, setBusca] = useState("");
  const lista = useMemo(() => (base?.insumosLista || []).filter((i) => !i.ficha_tecnica_id && !ehEmbalagem(i) && !ehLimpeza(i) && (!busca.trim() || casaBusca(i.nome, busca)))
    .sort((a, b) => String(a.nome).localeCompare(String(b.nome), "pt-BR")), [base, busca]);

  if (!base) return carregando ? <Cartao><p className="text-sm text-hf-muted">Carregando produtos…</p></Cartao> : null;
  const localId = base.estoques.find((e) => e.slug === ESTOQUE_MARMITARIA)?.id;
  const saldoDe = (i) => {
    const it = base.itensEstoque.find((x) => x.estoque_id === localId && x.insumo_id === i.id);
    return it ? (Number(it.quantidade_atual) || 0) / fatorSaldo(i) : 0;
  };

  return (
    <div className="space-y-4">
      {novo && <NovoProduto unidadeId={unidadeId} rotuloSalvar="Cadastrar" onFechar={() => setNovo(false)} onCriado={async () => { await recarregar(); setNovo(false); }} />}
      <Secao titulo="Produtos" subtitulo="O que a marmitaria compra e usa nas fichas."
        direita={!novo && <Botao onClick={() => setNovo(true)}><Plus size={16} /> Novo produto</Botao>}>
        <input className={`${inputCls} mb-1`} value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar produto" aria-label="Buscar produto" />
        <ul className="divide-y divide-hf-border">
          {lista.map((i) => {
            const un = String(i.unidade_medida || "un").toLowerCase();
            const c = custoUnitarioEfetivoInsumo(i);
            return (
              <li key={i.id} className="flex items-center justify-between gap-3 py-3">
                <span className="min-w-0"><span className="block text-sm font-bold text-hf-text">{i.nome}</span><span className="block text-xs text-hf-muted">Em estoque: {num(saldoDe(i))} {un}</span></span>
                <span className={`shrink-0 text-sm font-black tabular-nums ${c > 0 ? "text-hf-text" : "text-hf-warning"}`}>{c > 0 ? `${brl(c)}/${un}` : "Sem valor"}</span>
              </li>
            );
          })}
        </ul>
        {!lista.length && <p className="py-4 text-sm text-hf-muted">{busca.trim() ? "Nenhum produto com essa busca." : "Nenhum produto cadastrado."}</p>}
      </Secao>
    </div>
  );
}
