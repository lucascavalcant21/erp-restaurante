"use client";

// Cadastro das embalagens da marmitaria (pedido do dono, 05/11/2026). São os
// mesmos itens do cadastro geral, então o preço novo vale na hora em todas as
// fichas que usam a embalagem e fica no histórico de preço.

import { useEffect, useMemo, useState } from "react";
import { Package, Plus } from "lucide-react";
import { useMarmitaria } from "../../../../components/marmitaria/contexto";
import { ehEmbalagem } from "../../../../components/marmitaria/BuscaItens";
import { NovoProduto } from "../../../../components/marmitaria/CadastrosRapidos";
import { Aviso, Botao, Campo, CampoNumero, Cartao, Secao, brl, inputCls, lerNumero, num } from "../../../../components/marmitaria/ui";
import { ESTOQUE_EMBALAGENS, atualizarPrecoEmbalagem } from "../../../../lib/marmitaria/dados";
import { fatorSaldo } from "../../../../lib/marmitaria/nucleo.mjs";
import { custoUnitarioEfetivoInsumo } from "../../../../lib/ficha-calculos.mjs";
import { casaBusca } from "../../../../lib/busca.mjs";
import { fetchProcessosMarmitaria } from "../../../../lib/parametros";
import { marmitasDaEmbalagem } from "../../../../lib/marmitaria/processos.mjs";

function LinhaEmbalagem({ item, usos, saldo, serve = [] }) {
  const { recarregar } = useMarmitaria();
  const [editando, setEditando] = useState(false);
  const [preco, setPreco] = useState("");
  const [tamanho, setTamanho] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(null);
  const custo = custoUnitarioEfetivoInsumo(item);

  function abrir() {
    setPreco(String(item.valor_embalagem ?? item.custo_compra ?? "").replace(".", ","));
    setTamanho(String(item.tamanho_embalagem || 1).replace(".", ","));
    setErro(null);
    setEditando(true);
  }

  async function salvar() {
    if (salvando) return;
    setSalvando(true);
    try {
      const r = await atualizarPrecoEmbalagem({ id: item.id, unidade_medida: item.unidade_medida, preco_embalagem: lerNumero(preco), tamanho_embalagem: lerNumero(tamanho) });
      if (r.error) { setErro(r.error); return; }
      setEditando(false);
      await recarregar();
    } finally { setSalvando(false); }
  }

  return (
    <li className="py-3">
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-hf-elevated text-hf-muted"><Package size={18} /></span>
        <div className="min-w-0 flex-1">
          <p className="break-words text-sm font-bold text-hf-text">{item.nome}</p>
          <p className="text-xs text-hf-muted">Em estoque: {num(saldo)} · {usos ? `usada em ${usos} ficha${usos > 1 ? "s" : ""}` : "em nenhuma ficha"}</p>
          {serve.length > 0 && <p className="text-xs text-hf-text-2">Serve para: {serve.join(", ")}</p>}
        </div>
        <div className="shrink-0 text-right">
          <p className={`text-sm font-black tabular-nums ${custo > 0 ? "text-hf-text" : "text-hf-warning"}`}>{custo > 0 ? brl(custo) : "Sem valor"}</p>
          <p className="text-[11px] text-hf-muted">por unidade</p>
        </div>
        <Botao variante="secundario" type="button" onClick={editando ? () => setEditando(false) : abrir}>{editando ? "Fechar" : "Alterar"}</Botao>
      </div>
      {editando && (
        <div className="mt-3 rounded-xl bg-hf-elevated/60 p-3">
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <Campo rotulo="Preço pago na compra (R$)"><CampoNumero valor={preco} onChange={setPreco} placeholder="0,00" /></Campo>
            <Campo rotulo="Unidades nessa compra"><CampoNumero valor={tamanho} onChange={setTamanho} /></Campo>
            <Botao type="button" onClick={salvar} disabled={salvando}>{salvando ? "Salvando…" : "Salvar"}</Botao>
          </div>
          {erro && <Aviso tipo="alerta" className="mt-3">{erro}</Aviso>}
        </div>
      )}
    </li>
  );
}

export default function EmbalagensPage() {
  const { base, carregando, unidadeId, recarregar } = useMarmitaria();
  const [nova, setNova] = useState(false);
  const [busca, setBusca] = useState("");
  const [processos, setProcessos] = useState({});
  useEffect(() => { if (unidadeId) fetchProcessosMarmitaria(unidadeId).then((r) => setProcessos(r.data || {})); }, [unidadeId]);
  const usos = useMemo(() => {
    const m = new Map();
    for (const f of base?.marmitas || []) for (const e of f.embalagens || []) m.set(e.insumo_id, (m.get(e.insumo_id) || 0) + 1);
    return m;
  }, [base]);
  const lista = useMemo(() => (base?.insumosLista || []).filter(ehEmbalagem).filter((i) => !busca.trim() || casaBusca(i.nome, busca))
    .sort((a, b) => String(a.nome).localeCompare(String(b.nome), "pt-BR")), [base, busca]);

  if (!base) return carregando ? <Cartao><p className="text-sm text-hf-muted">Carregando embalagens…</p></Cartao> : null;
  const localId = base.estoques.find((e) => e.slug === ESTOQUE_EMBALAGENS)?.id;
  const saldoDe = (id) => {
    const it = base.itensEstoque.find((x) => x.estoque_id === localId && x.insumo_id === id);
    return it ? (Number(it.quantidade_atual) || 0) / fatorSaldo(base.insumos.get(id)) : 0;
  };

  return (
    <div className="space-y-4">
      {nova ? (
        <NovoProduto unidadeId={unidadeId} embalagem rotuloSalvar="Cadastrar" onFechar={() => setNova(false)} onCriado={async () => { await recarregar(); setNova(false); }} />
      ) : null}
      <Secao titulo="Embalagens" subtitulo="O valor de cada uma entra sozinho no custo das fichas que a usam."
        direita={!nova && <Botao onClick={() => setNova(true)}><Plus size={16} /> Nova embalagem</Botao>}>
        <input className={`${inputCls} mb-1`} value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar embalagem" aria-label="Buscar embalagem" />
        <ul className="divide-y divide-hf-border">
          {lista.map((i) => <LinhaEmbalagem key={i.id} item={i} usos={usos.get(i.id) || 0} saldo={saldoDe(i.id)} serve={marmitasDaEmbalagem(processos, i.id, base.marmitas)} />)}
        </ul>
        {!lista.length && <p className="py-4 text-sm text-hf-muted">{busca.trim() ? "Nenhuma embalagem com essa busca." : "Nenhuma embalagem cadastrada."}</p>}
      </Secao>
    </div>
  );
}
