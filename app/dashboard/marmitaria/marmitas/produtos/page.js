"use client";

// Cadastro próprio dos produtos da marmitaria (pedido do dono, 05/11/2026): só
// o que a marmitaria compra e usa. Embalagem e limpeza têm cadastro à parte.

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { useMarmitaria } from "../../../../components/marmitaria/contexto";
import { ehEmbalagem } from "../../../../components/marmitaria/BuscaItens";
import { NovoProduto } from "../../../../components/marmitaria/CadastrosRapidos";
import { Aviso, Botao, Campo, CampoNumero, Cartao, Secao, brl, inputCls, lerNumero, num } from "../../../../components/marmitaria/ui";
import { ESTOQUE_MARMITARIA, atualizarPrecoEmbalagem } from "../../../../lib/marmitaria/dados";
import { ehLimpeza } from "../../../../lib/marmitaria/cozinha.mjs";
import { fatorSaldo } from "../../../../lib/marmitaria/nucleo.mjs";
import { custoUnitarioEfetivoInsumo } from "../../../../lib/ficha-calculos.mjs";
import { casaBusca } from "../../../../lib/busca.mjs";

function LinhaProduto({ item, saldo }) {
  const { recarregar } = useMarmitaria();
  const un = String(item.unidade_medida || "un").toLowerCase();
  const c = custoUnitarioEfetivoInsumo(item);
  const [aberto, setAberto] = useState(false);
  const [preco, setPreco] = useState("");
  const [tamanho, setTamanho] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(null);
  async function salvar() {
    if (salvando) return;
    setSalvando(true);
    try {
      const r = await atualizarPrecoEmbalagem({ id: item.id, unidade_medida: item.unidade_medida, preco_embalagem: lerNumero(preco), tamanho_embalagem: lerNumero(tamanho) });
      if (r.error) { setErro(r.error); return; }
      setAberto(false);
      await recarregar();
    } finally { setSalvando(false); }
  }
  return (
    <li className="py-3">
      <div className="flex items-center justify-between gap-3">
        <span className="min-w-0"><span className="block text-sm font-bold text-hf-text">{item.nome}</span><span className="block text-xs text-hf-muted">Em estoque: {num(saldo)} {un}</span></span>
        <span className="flex shrink-0 items-center gap-3">
          <span className={`text-sm font-black tabular-nums ${c > 0 ? "text-hf-text" : "text-hf-warning"}`}>{c > 0 ? `${brl(c)}/${un}` : "Sem valor"}</span>
          <button type="button" className="min-h-[40px] text-sm font-bold text-hf-accent hover:underline" onClick={() => { setPreco(String(item.valor_embalagem ?? item.custo_compra ?? "").replace(".", ",")); setTamanho(String(item.tamanho_embalagem || 1).replace(".", ",")); setErro(null); setAberto(!aberto); }}>{aberto ? "Fechar" : "Alterar"}</button>
        </span>
      </div>
      {aberto && (
        <div className="mt-3 rounded-xl bg-hf-elevated/60 p-3">
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <Campo rotulo="Preço pago na compra (R$)"><CampoNumero valor={preco} onChange={setPreco} placeholder="0,00" /></Campo>
            <Campo rotulo={`Quanto vem na compra (${un})`}><CampoNumero valor={tamanho} onChange={setTamanho} /></Campo>
            <Botao type="button" onClick={salvar} disabled={salvando}>{salvando ? "Salvando…" : "Salvar"}</Botao>
          </div>
          {erro && <Aviso tipo="alerta" className="mt-3">{erro}</Aviso>}
        </div>
      )}
    </li>
  );
}

export default function ProdutosPage() {
  const { base, carregando, unidadeId, recarregar } = useMarmitaria();
  const [novo, setNovo] = useState(false);
  const [busca, setBusca] = useState("");
  const lista = useMemo(() => (base?.insumosLista || []).filter((i) => !i.ficha_tecnica_id && !ehEmbalagem(i) && !ehLimpeza(i) && (!busca.trim() || casaBusca(i.nome, busca)))
    .sort((a, b) => String(a.nome).localeCompare(String(b.nome), "pt-BR")), [base, busca]);

  if (!base) return carregando ? <Cartao><p className="text-sm text-hf-muted">Carregando ingredientes…</p></Cartao> : null;
  const localId = base.estoques.find((e) => e.slug === ESTOQUE_MARMITARIA)?.id;
  const saldoDe = (i) => {
    const it = base.itensEstoque.find((x) => x.estoque_id === localId && x.insumo_id === i.id);
    return it ? (Number(it.quantidade_atual) || 0) / fatorSaldo(i) : 0;
  };

  return (
    <div className="space-y-4">
      {novo && <NovoProduto unidadeId={unidadeId} rotuloSalvar="Cadastrar" onFechar={() => setNovo(false)} onCriado={async () => { await recarregar(); setNovo(false); }} />}
      <Secao titulo="Cadastro de ingredientes" subtitulo="O que a marmitaria compra e usa nas fichas."
        direita={!novo && <Botao onClick={() => setNovo(true)}><Plus size={16} /> Novo ingrediente</Botao>}>
        <input className={`${inputCls} mb-1`} value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar ingrediente" aria-label="Buscar ingrediente" />
        <ul className="divide-y divide-hf-border">
          {lista.map((i) => <LinhaProduto key={i.id} item={i} saldo={saldoDe(i)} />)}
        </ul>
        {!lista.length && <p className="py-4 text-sm text-hf-muted">{busca.trim() ? "Nenhum ingrediente com essa busca." : "Nenhum ingrediente cadastrado."}</p>}
      </Secao>
    </div>
  );
}
