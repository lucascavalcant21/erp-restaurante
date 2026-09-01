"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Wallet, TrendingUp, ReceiptText, CreditCard, ShoppingBag, Plus, Trash2,
  CheckCircle2, Loader2, X, CalendarDays, Banknote, AlertCircle,
} from "lucide-react";
import { useERP } from "../../context/ERPContext";
import {
  CATEGORIAS_CUSTO, fetchEntradasEstoqueFinanceiro, fetchPainelCaixa, pagarConta, removerConta, salvarConta,
} from "../../lib/financeiro";
import { fetchColaboradores, fetchRecibosPrestacaoUnidade } from "../../lib/rh";
import { folhaDoMes } from "../../lib/cmo.mjs";
import { valorDaCompra } from "../../lib/compras.mjs";
import { fmtBRL } from "../../components/ui";

const PERIODOS = [
  { id: "dia", label: "Hoje" },
  { id: "semana", label: "Semana" },
  { id: "mes", label: "Mês" },
  { id: "ano", label: "Ano" },
];

const CATEGORIAS_PAINEL = ["custo_fixo", "custo_variavel", "impostos", "cmo", "cmv", "frete"];

const PAGAMENTOS = {
  dinheiro: "Dinheiro", pix: "PIX", credito: "Cartão de crédito",
  debito: "Cartão de débito", cartao_credito: "Cartão de crédito",
  cartao_debito: "Cartão de débito", nao_informado: "Não informado",
};

const inicioDia = data => new Date(data.getFullYear(), data.getMonth(), data.getDate());
const somarDias = (data, dias) => {
  const nova = new Date(data);
  nova.setDate(nova.getDate() + dias);
  return nova;
};

function intervaloPeriodo(periodo, agora = new Date()) {
  if (periodo === "dia") return [inicioDia(agora), somarDias(inicioDia(agora), 1)];
  if (periodo === "semana") {
    const inicio = inicioDia(agora);
    const dia = inicio.getDay();
    inicio.setDate(inicio.getDate() - (dia === 0 ? 6 : dia - 1));
    return [inicio, somarDias(inicio, 7)];
  }
  if (periodo === "mes") return [new Date(agora.getFullYear(), agora.getMonth(), 1), new Date(agora.getFullYear(), agora.getMonth() + 1, 1)];
  return [new Date(agora.getFullYear(), 0, 1), new Date(agora.getFullYear() + 1, 0, 1)];
}

const dataConta = conta => new Date(conta.data_pagamento || conta.data_vencimento || conta.created_at);

export default function FinanceiroPage() {
  const { unidadeAtiva, unidadeInfo } = useERP();
  const [periodo, setPeriodo] = useState("dia");
  const [dados, setDados] = useState({ vendas: [], despesas: [], colaboradores: [], recibos: [], entradasEstoque: [] });
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [modal, setModal] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [form, setForm] = useState({ descricao: "", valor: "", categoria: "custo_fixo", data_vencimento: new Date().toISOString().slice(0, 10), status: "pendente" });

  const carregar = async () => {
    if (!unidadeAtiva || unidadeAtiva === "todas") return;
    setLoading(true);
    const agora = new Date();
    const inicio = new Date(agora.getFullYear(), 0, 1);
    const fim = new Date(agora.getFullYear() + 1, 0, 1);
    const [resposta, equipe, recibos, entradas] = await Promise.all([
      fetchPainelCaixa(unidadeAtiva, inicio.toISOString(), fim.toISOString()),
      fetchColaboradores(unidadeAtiva),
      fetchRecibosPrestacaoUnidade(unidadeAtiva),
      fetchEntradasEstoqueFinanceiro(unidadeAtiva, inicio.toISOString(), fim.toISOString()),
    ]);
    setDados({
      ...(resposta.data || { vendas: [], despesas: [] }),
      colaboradores: equipe.data || [], recibos: recibos.data || [], entradasEstoque: entradas.data || [],
    });
    setErro([resposta.error, equipe.error, recibos.error, entradas.error].filter(Boolean).join(" · "));
    setLoading(false);
  };

  useEffect(() => { carregar(); }, [unidadeAtiva]);

  const resumo = useMemo(() => {
    const [inicio, fim] = intervaloPeriodo(periodo);
    const dentro = valor => {
      const data = new Date(valor);
      return data >= inicio && data < fim;
    };
    const vendas = dados.vendas.filter(v => dentro(v.created_at));
    const despesas = dados.despesas.filter(c => {
      const data = dataConta(c);
      return !["cmo", "cmv"].includes(c.categoria) && !Number.isNaN(data.getTime()) && data >= inicio && data < fim;
    });
    const faturamento = vendas.reduce((s, v) => s + Number(v.total || 0), 0);
    const entradasEstoque = (dados.entradasEstoque || []).filter(movimento => {
      const data = new Date(movimento.data_movimento);
      return data >= inicio && data < fim;
    });
    const cmv = entradasEstoque.reduce((soma, movimento) => soma + valorDaCompra(movimento), 0);
    const quantidadeEstoque = entradasEstoque.reduce((soma, movimento) => soma + Number(movimento.quantidade || 0), 0);
    const cmvMedio = quantidadeEstoque > 0 ? cmv / quantidadeEstoque : 0;

    const folhaMensal = folhaDoMes(dados.colaboradores || []);
    const diasNoMes = new Date(inicio.getFullYear(), inicio.getMonth() + 1, 0).getDate();
    const diasDoPeriodo = Math.max(1, Math.round((fim - inicio) / 86400000));
    const folha = periodo === "ano" ? folhaMensal * 12 : periodo === "mes" ? folhaMensal : (folhaMensal / diasNoMes) * diasDoPeriodo;
    const recibosExtras = (dados.recibos || []).filter(recibo => {
      if (!recibo.pagamento_realizado) return false;
      const data = new Date(`${String(recibo.data_pagamento || recibo.data_trabalho || "").slice(0, 10)}T12:00:00`);
      return !Number.isNaN(data.getTime()) && data >= inicio && data < fim;
    });
    const extras = recibosExtras.reduce((soma, recibo) => soma + Number(recibo.valor_total || 0), 0);
    const cmo = folha + extras;
    const despesasManuaisPagas = despesas.filter(c => c.status === "pago").reduce((s, c) => s + Number(c.valor || 0), 0);
    const despesasPagas = despesasManuaisPagas + cmo + cmv;
    const pagamentos = {};
    const itens = {};
    const setores = { bar: { quantidade: 0, total: 0 }, cozinha: { quantidade: 0, total: 0 } };
    vendas.forEach(venda => {
      const forma = PAGAMENTOS[venda.forma_pagamento] || venda.forma_pagamento || "Não informado";
      pagamentos[forma] = (pagamentos[forma] || 0) + Number(venda.total || 0);
      (venda.itens || []).forEach(item => {
        const nome = item.nome || "Item";
        const quantidade = Number(item.quantidade || 0);
        const totalItem = quantidade * Number(item.valor_unitario || 0);
        if (!itens[nome]) itens[nome] = { nome, quantidade: 0, total: 0 };
        itens[nome].quantidade += quantidade;
        itens[nome].total += totalItem;
        const setor = item.setor === "bar" ? "bar" : "cozinha";
        setores[setor].quantidade += quantidade;
        setores[setor].total += totalItem;
      });
    });
    return {
      vendas, despesas, faturamento, despesasPagas,
      resultado: faturamento - despesasPagas,
      ticketBar: setores.bar.quantidade ? setores.bar.total / setores.bar.quantidade : 0,
      ticketCozinha: setores.cozinha.quantidade ? setores.cozinha.total / setores.cozinha.quantidade : 0,
      pagamentos: Object.entries(pagamentos).sort((a, b) => b[1] - a[1]),
      itens: Object.values(itens).sort((a, b) => b.quantidade - a.quantidade),
      automaticos: { cmo, folha, extras, recibosExtras, cmv, cmvMedio, quantidadeEstoque, entradasEstoque },
    };
  }, [dados, periodo]);

  const faturamentos = useMemo(() => Object.fromEntries(PERIODOS.map(p => {
    const [inicio, fim] = intervaloPeriodo(p.id);
    const total = dados.vendas.filter(v => {
      const data = new Date(v.created_at);
      return data >= inicio && data < fim;
    }).reduce((s, v) => s + Number(v.total || 0), 0);
    return [p.id, total];
  })), [dados.vendas]);

  const abrirDespesa = categoria => {
    setForm({ descricao: "", valor: "", categoria, data_vencimento: new Date().toISOString().slice(0, 10), status: "pendente" });
    setModal(true);
  };

  const salvarDespesa = async e => {
    e.preventDefault();
    setSalvando(true);
    const resposta = await salvarConta({ ...form, unidade_id: unidadeAtiva, valor: Number(form.valor) });
    setSalvando(false);
    if (resposta.error) return alert("Não foi possível salvar: " + resposta.error);
    setModal(false);
    await carregar();
  };

  const excluirDespesa = async conta => {
    if (!confirm(`Excluir a despesa “${conta.descricao}”?`)) return;
    const resposta = await removerConta(conta.id);
    if (resposta.error) return alert("Não foi possível excluir: " + resposta.error);
    carregar();
  };

  const marcarPaga = async conta => {
    if (!confirm(`Confirmar o pagamento de “${conta.descricao}”?`)) return;
    const resposta = await pagarConta(conta.id);
    if (resposta.error) return alert("Não foi possível registrar o pagamento: " + resposta.error);
    carregar();
  };

  if (!unidadeAtiva || unidadeAtiva === "todas") return <div className="p-8 text-center font-bold text-slate-500">Selecione uma unidade para abrir o caixa.</div>;
  if (loading) return <div className="flex min-h-[65vh] flex-col items-center justify-center gap-3 text-slate-500"><Loader2 className="animate-spin text-emerald-600" size={42} /><b>Carregando o caixa...</b></div>;

  return (
    <div className="min-h-screen bg-slate-100/80 p-3 pb-24 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-[1500px]">
        <header className="mb-5 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <p className="text-xs font-black uppercase tracking-[.2em] text-emerald-700">Financeiro · {unidadeInfo?.nome}</p>
            <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">Fluxo de caixa do balcão</h1>
            <p className="mt-1 font-medium text-slate-500">Vendas, recebimentos, despesas e resultado em um só lugar.</p>
          </div>
          <div className="flex max-w-full gap-2 overflow-x-auto rounded-2xl bg-slate-200/80 p-1.5">
            {PERIODOS.map(p => <button key={p.id} onClick={() => setPeriodo(p.id)} className={`min-h-11 whitespace-nowrap rounded-xl px-5 text-sm font-black ${periodo === p.id ? "bg-white text-emerald-700 shadow-sm" : "text-slate-600"}`}>{p.label}</button>)}
          </div>
        </header>

        {erro && <div className="mb-4 flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-800"><AlertCircle size={19} className="shrink-0" />Alguns históricos não puderam ser carregados: {erro}</div>}

        <section className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
          {PERIODOS.map(p => <button key={p.id} onClick={() => setPeriodo(p.id)} className={`rounded-2xl border p-4 text-left shadow-sm transition ${periodo === p.id ? "border-emerald-400 bg-emerald-50" : "border-slate-200 bg-white"}`}>
            <span className="text-[11px] font-black uppercase tracking-widest text-slate-500">Faturamento · {p.label}</span>
            <strong className="mt-2 block break-words text-xl font-black text-slate-900 sm:text-2xl">{fmtBRL(faturamentos[p.id] || 0)}</strong>
          </button>)}
        </section>

        <section className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
          {[
            [TrendingUp, "Faturamento", resumo.faturamento, "text-emerald-700", "bg-emerald-100"],
            [ReceiptText, "Ticket médio · Bar", resumo.ticketBar, "text-cyan-700", "bg-cyan-100"],
            [ReceiptText, "Ticket médio · Cozinha", resumo.ticketCozinha, "text-blue-700", "bg-blue-100"],
            [ShoppingBag, "CMV médio · Estoque", resumo.automaticos.cmvMedio, "text-orange-700", "bg-orange-100"],
            [Banknote, "Despesas pagas", resumo.despesasPagas, "text-rose-700", "bg-rose-100"],
            [Wallet, "Resultado", resumo.resultado, resumo.resultado >= 0 ? "text-emerald-700" : "text-rose-700", "bg-slate-200"],
          ].map(([Icon, label, valor, cor, fundo]) => <div key={label} className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className={`mb-3 grid h-10 w-10 place-items-center rounded-xl ${fundo} ${cor}`}><Icon size={20} /></div>
            <p className="text-xs font-black uppercase tracking-wider text-slate-500">{label}</p>
            <p className={`mt-1 break-words text-xl font-black sm:text-2xl ${cor}`}>{fmtBRL(valor)}</p>
            {label === "Faturamento" && <p className="mt-1 text-xs font-bold text-slate-400">{resumo.vendas.length} venda(s)</p>}
          </div>)}
        </section>

        <section className="mb-5 grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2"><CreditCard className="text-emerald-600" /><h2 className="text-lg font-black text-slate-900">Formas de pagamento pagas</h2></div>
            <div className="space-y-2">
              {!resumo.pagamentos.length && <p className="py-8 text-center font-semibold text-slate-400">Nenhum pagamento no período.</p>}
              {resumo.pagamentos.map(([nome, valor]) => <div key={nome} className="flex items-center justify-between gap-4 rounded-xl bg-slate-100 p-3"><span className="font-bold text-slate-700">{nome}</span><b className="text-slate-900">{fmtBRL(valor)}</b></div>)}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2"><ShoppingBag className="text-emerald-600" /><h2 className="text-lg font-black text-slate-900">Itens vendidos</h2></div>
            <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
              {!resumo.itens.length && <p className="py-8 text-center font-semibold text-slate-400">Nenhum item vendido no período.</p>}
              {resumo.itens.map(item => <div key={item.nome} className="flex items-center justify-between gap-4 rounded-xl bg-slate-100 p-3"><div className="min-w-0"><p className="truncate font-bold text-slate-800">{item.nome}</p><p className="text-xs font-bold text-slate-500">{item.quantidade.toLocaleString("pt-BR")} vendido(s)</p></div><b className="shrink-0 text-emerald-700">{fmtBRL(item.total)}</b></div>)}
            </div>
          </div>
        </section>

        <div className="mb-3 flex items-center justify-between gap-3">
          <div><h2 className="text-2xl font-black text-slate-900">Despesas por categoria</h2><p className="text-sm font-medium text-slate-500">Crie, pague ou exclua despesas dentro de cada grupo.</p></div>
        </div>
        <section className="grid gap-4 xl:grid-cols-2">
          {CATEGORIAS_PAINEL.map(id => {
            const categoria = CATEGORIAS_CUSTO.find(c => c.id === id);
            const automatico = id === "cmo" || id === "cmv";
            const contas = automatico ? [] : resumo.despesas.filter(c => c.categoria === id);
            const total = id === "cmo" ? resumo.automaticos.cmo : id === "cmv" ? resumo.automaticos.cmv : contas.reduce((s, c) => s + Number(c.valor || 0), 0);
            const quantidade = id === "cmo" ? (resumo.automaticos.recibosExtras.length + (resumo.automaticos.folha > 0 ? 1 : 0)) : id === "cmv" ? resumo.automaticos.entradasEstoque.length : contas.length;
            return <div key={id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between gap-3 border-b border-slate-100 p-4">
                <div className="min-w-0"><h3 className="truncate font-black text-slate-900">{categoria?.label || id}</h3><p className="text-sm font-bold text-slate-500">{fmtBRL(total)} · {quantidade} lançamento(s)</p></div>
                {automatico ? <span className="rounded-full bg-emerald-100 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-emerald-700">Automático</span> : <button onClick={() => abrirDespesa(id)} className="flex min-h-11 shrink-0 items-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-black text-white"><Plus size={18} /> Adicionar</button>}
              </div>
              <div className="max-h-72 divide-y divide-slate-100 overflow-y-auto">
                {id === "cmo" && <><div className="flex items-center justify-between gap-3 p-4"><div><p className="font-bold text-slate-800">Funcionários contratados</p><p className="text-xs font-semibold text-slate-500">Salários e benefícios do período</p></div><b>{fmtBRL(resumo.automaticos.folha)}</b></div><div className="flex items-center justify-between gap-3 p-4"><div><p className="font-bold text-slate-800">Extras pagos</p><p className="text-xs font-semibold text-slate-500">{resumo.automaticos.recibosExtras.length} recibo(s) pago(s)</p></div><b>{fmtBRL(resumo.automaticos.extras)}</b></div></>}
                {id === "cmv" && <>{!resumo.automaticos.entradasEstoque.length ? <p className="p-6 text-center text-sm font-semibold text-slate-400">Nenhuma entrada de estoque neste período.</p> : resumo.automaticos.entradasEstoque.slice(0, 30).map(movimento => <div key={movimento.id} className="flex items-center justify-between gap-3 p-4"><div className="min-w-0"><p className="truncate font-bold text-slate-800">{movimento.insumo?.nome || "Entrada de estoque"}</p><p className="text-xs font-semibold text-slate-500">{new Date(movimento.data_movimento).toLocaleDateString("pt-BR")} · {Number(movimento.quantidade || 0).toLocaleString("pt-BR")}</p></div><b className="shrink-0">{fmtBRL(valorDaCompra(movimento))}</b></div>)}</>}
                {!automatico && !contas.length && <p className="p-6 text-center text-sm font-semibold text-slate-400">Nenhuma despesa neste período.</p>}
                {contas.map(conta => <div key={conta.id} className="flex items-center gap-3 p-4">
                  <div className="min-w-0 flex-1"><p className="truncate font-bold text-slate-800">{conta.descricao}</p><p className="text-xs font-semibold text-slate-500">{dataConta(conta).toLocaleDateString("pt-BR")} · {conta.status === "pago" ? "Pago" : "Pendente"}</p></div>
                  <b className="shrink-0 text-slate-900">{fmtBRL(conta.valor)}</b>
                  {conta.status !== "pago" && <button title="Marcar como paga" onClick={() => marcarPaga(conta)} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-emerald-100 text-emerald-700"><CheckCircle2 size={19} /></button>}
                  <button title="Excluir despesa" onClick={() => excluirDespesa(conta)} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-rose-100 text-rose-700"><Trash2 size={18} /></button>
                </div>)}
              </div>
            </div>;
          })}
        </section>
      </div>

      {modal && <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/60 p-3 pt-8 backdrop-blur-sm sm:items-center sm:pt-3">
        <form onSubmit={salvarDespesa} className="w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl">
          <div className="flex items-center justify-between bg-slate-900 p-5 text-white"><div><p className="text-xs font-black uppercase tracking-widest text-slate-400">Financeiro</p><h2 className="text-xl font-black">Nova despesa</h2></div><button type="button" onClick={() => setModal(false)} className="grid h-11 w-11 place-items-center rounded-xl bg-white/10"><X /></button></div>
          <div className="space-y-4 p-5">
            <label className="block"><span className="mb-1.5 block text-xs font-black uppercase tracking-wider text-slate-500">Descrição</span><input required value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })} className="min-h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 font-bold outline-none focus:border-emerald-500" placeholder="Ex.: energia elétrica" /></label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label><span className="mb-1.5 block text-xs font-black uppercase tracking-wider text-slate-500">Valor</span><input required min="0.01" step="0.01" type="number" value={form.valor} onChange={e => setForm({ ...form, valor: e.target.value })} className="min-h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 font-black outline-none focus:border-emerald-500" placeholder="0,00" /></label>
              <label><span className="mb-1.5 block text-xs font-black uppercase tracking-wider text-slate-500">Data</span><input required type="date" value={form.data_vencimento} onChange={e => setForm({ ...form, data_vencimento: e.target.value })} className="min-h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 font-bold outline-none focus:border-emerald-500" /></label>
            </div>
            <label className="block"><span className="mb-1.5 block text-xs font-black uppercase tracking-wider text-slate-500">Categoria</span><select value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value })} className="min-h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 font-bold outline-none focus:border-emerald-500">{CATEGORIAS_PAINEL.map(id => <option key={id} value={id}>{CATEGORIAS_CUSTO.find(c => c.id === id)?.label}</option>)}</select></label>
            <label className="block"><span className="mb-1.5 block text-xs font-black uppercase tracking-wider text-slate-500">Situação</span><select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className="min-h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 font-bold outline-none focus:border-emerald-500"><option value="pendente">Pendente</option><option value="pago">Já foi paga</option></select></label>
            <div className="flex gap-3 pt-2"><button type="button" onClick={() => setModal(false)} className="min-h-12 flex-1 rounded-xl bg-slate-100 font-black text-slate-600">Cancelar</button><button disabled={salvando} className="min-h-12 flex-1 rounded-xl bg-emerald-600 font-black text-white disabled:opacity-50">{salvando ? "Salvando..." : "Salvar despesa"}</button></div>
          </div>
        </form>
      </div>}
    </div>
  );
}
