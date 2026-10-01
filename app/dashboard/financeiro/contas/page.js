"use client";

// CONTAS A PAGAR — contrato mínimo (HOTFIX FIN-CP-1).
// Grava só o que existe hoje em contas_pagar: descrição, valor, vencimento,
// categoria, recorrente, status ('pendente'/'pago') e data de pagamento.
// Abrir esta tela é só leitura: nenhuma conta é criada automaticamente.

import { useState, useEffect, useMemo, useRef } from "react";
import { useERP } from "../../../context/ERPContext";
import { useTempoReal } from "../../../lib/realtime";
import { fetchContas, salvarConta, pagarConta, estornarPagamento } from "../../../lib/financeiro";
import {
  CATEGORIAS_CONTA,
  CATEGORIAS_NOVA_CONTA,
  rotuloCategoria,
  situacaoConta,
  statusPersistido,
  unidadeValida,
  hojeLocal,
} from "../../../lib/contas-pagar.mjs";
import ModalPagamentoConta from "../../../components/ModalPagamentoConta";
import { Plus, Search, CalendarDays, Wallet, AlertTriangle, Pencil, RotateCcw, X, Info } from "lucide-react";
import { fmtBRL } from "../../../components/ui";

const ROTULO_SITUACAO = { pago: "PAGO", vencida: "VENCIDA", pendente: "PENDENTE", desconhecido: "STATUS DESCONHECIDO" };
const COR_SITUACAO = {
  pago: "bg-emerald-100 text-emerald-800",
  vencida: "bg-red-100 text-red-800",
  pendente: "bg-slate-100 text-slate-900",
  desconhecido: "bg-amber-100 text-amber-800",
};

const formVazio = () => ({
  id: "",
  descricao: "",
  valor: "",
  data_vencimento: hojeLocal(),
  categoria: CATEGORIAS_NOVA_CONTA[0].id,
  categoriaAtual: null,
  recorrente: false,
});

const fmtData = (d) => (d ? new Date(`${String(d).slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR") : "—");

export default function ContasAPagarHubPage() {
  const { unidadeAtiva } = useERP();
  const unidadeOk = unidadeValida(unidadeAtiva);

  const [contas, setContas] = useState([]);
  const [erroLeitura, setErroLeitura] = useState("");
  const [loading, setLoading] = useState(true);

  const [busca, setBusca] = useState("");
  const [filtroSituacao, setFiltroSituacao] = useState("TODAS");
  const [filtroCategoria, setFiltroCategoria] = useState("TODAS");

  const [modalConta, setModalConta] = useState(false);
  const [formConta, setFormConta] = useState(formVazio);
  const [contaPagar, setContaPagar] = useState(null);

  // Trava contra clique duplo: o estado desabilita os botões e o ref impede
  // uma segunda chamada antes de o React re-renderizar.
  const [processando, setProcessando] = useState(false);
  const emAndamento = useRef(false);
  const executar = async (fn) => {
    if (emAndamento.current) return;
    emAndamento.current = true;
    setProcessando(true);
    try { await fn(); } finally {
      emAndamento.current = false;
      setProcessando(false);
    }
  };

  const carregarDados = async (silencioso = false) => {
    if (!unidadeOk) { setContas([]); setLoading(false); return; }
    if (!silencioso) setLoading(true);
    const res = await fetchContas(unidadeAtiva);
    setContas(res.data || []);
    setErroLeitura(res.error || "");
    setLoading(false);
  };

  useEffect(() => { carregarDados(); }, [unidadeAtiva]);
  useTempoReal(null, () => carregarDados(true));

  const hoje = hojeLocal();
  const mesAtual = hoje.slice(0, 7);

  const contasFiltradas = useMemo(() => contas.filter((c) => {
    const sit = situacaoConta(c, hoje);
    if (filtroSituacao !== "TODAS" && sit !== filtroSituacao) return false;
    if (filtroCategoria !== "TODAS" && c.categoria !== filtroCategoria) return false;
    if (busca.trim() && !String(c.descricao || "").toLowerCase().includes(busca.trim().toLowerCase())) return false;
    return true;
  }), [contas, filtroSituacao, filtroCategoria, busca, hoje]);

  const kpis = useMemo(() => {
    let pendente = 0, vencido = 0, pagoNoMes = 0;
    contas.forEach((c) => {
      const v = Number(c.valor) || 0;
      const sit = situacaoConta(c, hoje);
      if (sit === "pago") {
        if (String(c.data_pagamento || "").slice(0, 7) === mesAtual) pagoNoMes += v;
      } else if (sit === "pendente" || sit === "vencida") {
        pendente += v;
        if (sit === "vencida") vencido += v;
      }
    });
    return { pendente, vencido, pagoNoMes };
  }, [contas, hoje, mesAtual]);

  const abrirNova = () => { setFormConta(formVazio()); setModalConta(true); };
  const abrirEdicao = (c) => {
    setFormConta({
      id: c.id,
      descricao: c.descricao || "",
      valor: String(c.valor ?? "").replace(".", ","),
      data_vencimento: String(c.data_vencimento || "").slice(0, 10),
      categoria: c.categoria || CATEGORIAS_NOVA_CONTA[0].id,
      categoriaAtual: c.categoria || null,
      recorrente: !!c.recorrente,
    });
    setModalConta(true);
  };

  const handleSalvarConta = (e) => {
    e.preventDefault();
    executar(async () => {
      const res = await salvarConta({ ...formConta, id: formConta.id || undefined, unidade_id: unidadeAtiva });
      if (res.error) return alert(`Não foi possível salvar a conta: ${res.error}`);
      setModalConta(false);
      await carregarDados(true);
      alert(formConta.id ? "Conta atualizada." : "Conta lançada como pendente.");
    });
  };

  const confirmarPagamento = (dataPagamento) => executar(async () => {
    const res = await pagarConta(contaPagar.id, { unidade_id: unidadeAtiva, data_pagamento: dataPagamento });
    if (res.error) return alert(`Não foi possível registrar o pagamento: ${res.error}`);
    setContaPagar(null);
    await carregarDados(true);
    alert("Pagamento registrado.");
  });

  const handleEstornar = (c) => {
    if (!confirm(`Estornar o pagamento de “${c.descricao}”?\n\nA conta volta para pendente e a data de pagamento é apagada. A conta não é excluída.`)) return;
    executar(async () => {
      const res = await estornarPagamento(c.id, unidadeAtiva);
      if (res.error) return alert(`Não foi possível estornar: ${res.error}`);
      await carregarDados(true);
      alert("Pagamento estornado. A conta voltou para pendente.");
    });
  };

  // Categorias do formulário: nunca oferece CMV para conta nova; na edição de
  // uma conta antiga já classificada assim, mantém a opção para não alterá-la
  // sem querer.
  const opcoesCategoria = formConta.categoriaAtual && !CATEGORIAS_NOVA_CONTA.some((c) => c.id === formConta.categoriaAtual)
    ? [...CATEGORIAS_NOVA_CONTA, { id: formConta.categoriaAtual, label: `${rotuloCategoria(formConta.categoriaAtual)} (categoria atual)` }]
    : CATEGORIAS_NOVA_CONTA;

  if (!unidadeOk) return <div className="p-8 text-center font-bold text-fg">Selecione uma unidade para ver as contas a pagar.</div>;

  return (
    <div className="min-h-screen pb-24 font-sans text-slate-800 bg-[var(--surface)]">
      <div className="bg-slate-900 pt-6 sm:pt-8 pb-8 sm:pb-10 px-4 sm:px-8 shadow-lg text-white">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tighter">Contas a Pagar</h1>
            <p className="text-subtle font-bold uppercase tracking-widest text-xs mt-1">Obrigações da unidade · pendente / pago</p>
          </div>
          <button onClick={abrirNova} disabled={processando}
            className="px-6 py-4 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white font-black rounded-2xl flex items-center gap-2 shadow-xl shadow-emerald-500/20 active:scale-95 transition-all cursor-pointer">
            <Plus size={20} /> Lançar Nova Despesa
          </button>
        </div>

        <div className="max-w-7xl mx-auto mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { rotulo: "Total pendente", valor: kpis.pendente, cor: "text-amber-400", Icone: CalendarDays, fundo: "bg-amber-500/20 text-amber-400" },
            { rotulo: "Total vencido", valor: kpis.vencido, cor: "text-red-400", Icone: AlertTriangle, fundo: "bg-red-500/20 text-red-400" },
            { rotulo: "Pago neste mês", valor: kpis.pagoNoMes, cor: "text-emerald-400", Icone: Wallet, fundo: "bg-emerald-500/20 text-emerald-400" },
          ].map(({ rotulo, valor, cor, Icone, fundo }) => (
            <div key={rotulo} className="bg-slate-800/80 p-5 rounded-3xl border border-slate-700/50 flex items-center gap-4">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${fundo}`}><Icone size={24} /></div>
              <div>
                <p className="text-3xs uppercase font-bold tracking-widest text-slate-300">{rotulo}</p>
                <p className={`text-2xl font-black ${cor}`}>{fmtBRL(valor)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 mt-6 space-y-4">
        <div className="flex items-start gap-2 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-xs font-semibold text-sky-900">
          <Info size={16} className="mt-0.5 shrink-0" />
          <p>
            A geração automática de contas recorrentes está <b>temporariamente indisponível</b>: lance cada mês manualmente.
            Parcelamento, fornecedor, documento e pagamento parcial voltam com a nova estrutura financeira.
          </p>
        </div>

        {erroLeitura && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-800">
            Não foi possível carregar as contas: {erroLeitura}
          </div>
        )}

        <div className="bg-card rounded-3xl p-6 border border-line shadow-sm space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="relative">
              <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-800" />
              <input type="text" placeholder="Buscar pela descrição..." value={busca} onChange={(e) => setBusca(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-line rounded-2xl text-xs font-bold text-slate-800 outline-none focus:border-emerald-500" />
            </div>
            <select value={filtroSituacao} onChange={(e) => setFiltroSituacao(e.target.value)}
              className="w-full p-2.5 bg-white border border-line rounded-2xl text-xs font-bold text-slate-800 outline-none focus:border-emerald-500">
              <option value="TODAS">-- Todas as situações --</option>
              <option value="pendente">Pendente</option>
              <option value="vencida">Vencida</option>
              <option value="pago">Pago</option>
            </select>
            <select value={filtroCategoria} onChange={(e) => setFiltroCategoria(e.target.value)}
              className="w-full p-2.5 bg-white border border-line rounded-2xl text-xs font-bold text-slate-800 outline-none focus:border-emerald-500">
              <option value="TODAS">-- Todas as categorias --</option>
              {CATEGORIAS_CONTA.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>

          {loading ? (
            <div className="py-12 text-center text-fg font-bold">Carregando contas a pagar...</div>
          ) : !contasFiltradas.length ? (
            <div className="py-12 text-center text-fg space-y-2">
              <Wallet size={40} className="mx-auto text-slate-300" />
              <p className="font-bold text-slate-900">Nenhuma conta encontrada para o filtro selecionado.</p>
            </div>
          ) : (
            <div className="rounded-2xl border border-line overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900 text-white uppercase font-black tracking-wider">
                    <tr>
                      <th className="p-3.5">Descrição</th>
                      <th className="p-3.5">Vencimento</th>
                      <th className="p-3.5 text-right">Valor</th>
                      <th className="p-3.5 text-center">Situação</th>
                      <th className="p-3.5">Pago em</th>
                      <th className="p-3.5 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line bg-card">
                    {contasFiltradas.map((c) => {
                      const sit = situacaoConta(c, hoje);
                      const paga = statusPersistido(c) === "pago";
                      return (
                        <tr key={c.id} className="hover:bg-white transition-colors">
                          <td className="p-3.5">
                            <strong className="text-slate-800 font-black block">{c.descricao}</strong>
                            <span className="text-3xs text-subtle font-medium">
                              {rotuloCategoria(c.categoria)}{c.recorrente ? " · recorrente" : ""}
                            </span>
                          </td>
                          <td className="p-3.5 font-bold text-slate-900">{fmtData(c.data_vencimento)}</td>
                          <td className="p-3.5 text-right font-black text-slate-800">{fmtBRL(c.valor)}</td>
                          <td className="p-3.5 text-center">
                            <span className={`px-2.5 py-1 rounded-full text-3xs font-black uppercase tracking-wider ${COR_SITUACAO[sit]}`}>
                              {ROTULO_SITUACAO[sit]}
                            </span>
                          </td>
                          <td className="p-3.5 font-medium text-slate-900">{paga ? fmtData(c.data_pagamento) : "—"}</td>
                          <td className="p-3.5 text-right whitespace-nowrap space-x-2">
                            <button onClick={() => abrirEdicao(c)} disabled={processando} title="Editar"
                              className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-900 rounded-lg transition-colors cursor-pointer disabled:opacity-50">
                              <Pencil size={15} />
                            </button>
                            {sit === "pendente" || sit === "vencida" ? (
                              <button onClick={() => setContaPagar(c)} disabled={processando}
                                className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-lg text-2xs transition-all cursor-pointer disabled:opacity-50">
                                Pagar
                              </button>
                            ) : paga ? (
                              <button onClick={() => handleEstornar(c)} disabled={processando} title="Estornar pagamento"
                                className="px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 font-bold rounded-lg text-2xs transition-all cursor-pointer disabled:opacity-50 inline-flex items-center gap-1">
                                <RotateCcw size={12} /> Estornar
                              </button>
                            ) : null}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {modalConta && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-card rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-3 border-b border-line">
              <h3 className="text-xl font-black text-slate-800">{formConta.id ? "Editar conta" : "Lançar nova despesa"}</h3>
              <button onClick={() => setModalConta(false)} disabled={processando} className="text-slate-800 hover:text-slate-900" aria-label="Fechar"><X size={20} /></button>
            </div>

            <form onSubmit={handleSalvarConta} className="space-y-3.5">
              <div>
                <label className="text-xs font-bold text-fg uppercase block mb-1">Descrição</label>
                <input required type="text" placeholder="Ex: Conta de luz de setembro" value={formConta.descricao}
                  onChange={(e) => setFormConta({ ...formConta, descricao: e.target.value })}
                  className="w-full p-3 bg-white border border-line rounded-xl font-bold text-slate-800 text-sm" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-fg uppercase block mb-1">Valor (R$)</label>
                  <input required type="text" inputMode="decimal" placeholder="1200,00" value={formConta.valor}
                    onChange={(e) => setFormConta({ ...formConta, valor: e.target.value })}
                    className="w-full p-3 bg-white border border-line rounded-xl font-black text-emerald-600 text-sm" />
                </div>
                <div>
                  <label className="text-xs font-bold text-fg uppercase block mb-1">Vencimento</label>
                  <input required type="date" value={formConta.data_vencimento}
                    onChange={(e) => setFormConta({ ...formConta, data_vencimento: e.target.value })}
                    className="w-full p-3 bg-white border border-line rounded-xl font-bold text-slate-800 text-sm" />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-fg uppercase block mb-1">Categoria</label>
                <select value={formConta.categoria} onChange={(e) => setFormConta({ ...formConta, categoria: e.target.value })}
                  className="w-full p-3 bg-white border border-line rounded-xl font-bold text-slate-800 text-sm">
                  {opcoesCategoria.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
                <p className="mt-1 text-3xs text-fg">Compra de mercadoria para estoque não é lançada aqui como CMV: ela terá módulo próprio de Compras.</p>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input type="checkbox" id="recorrente" checked={formConta.recorrente}
                  onChange={(e) => setFormConta({ ...formConta, recorrente: e.target.checked })}
                  className="w-4 h-4 rounded accent-emerald-500 cursor-pointer" />
                <label htmlFor="recorrente" className="text-xs font-bold text-slate-900 cursor-pointer">
                  Despesa recorrente (só marcação; a geração automática está temporariamente indisponível)
                </label>
              </div>

              {formConta.id && (
                <p className="text-3xs text-fg">A edição não altera a situação de pagamento. Para pagar ou estornar, use os botões da lista.</p>
              )}

              <div className="flex gap-3 pt-4 border-t border-line">
                <button type="button" onClick={() => setModalConta(false)} disabled={processando}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-900 font-bold text-sm rounded-xl cursor-pointer">Cancelar</button>
                <button type="submit" disabled={processando}
                  className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white font-bold text-sm rounded-xl cursor-pointer">
                  {processando ? "Salvando..." : "Salvar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {contaPagar && (
        <ModalPagamentoConta conta={contaPagar} processando={processando}
          onConfirmar={confirmarPagamento} onFechar={() => setContaPagar(null)} />
      )}
    </div>
  );
}
