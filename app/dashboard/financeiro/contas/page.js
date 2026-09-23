"use client";

import { useState, useEffect, useMemo } from "react";
import { useERP } from "../../../context/ERPContext";
import { useTempoReal } from "../../../lib/realtime";
import { fetchFornecedores } from "../../../lib/fornecedores";
import {
  fetchContas,
  salvarConta,
  pagarConta,
  estornarPagamento,
  fetchHistoricoPagamentos,
  fetchContasFinanceiras,
  gerarContasRecorrentes,
  removerConta,
  CATEGORIAS_CUSTO
} from "../../../lib/financeiro";
import { calcularStatusConta } from "../../../lib/financeiro-domain";
import {
  Plus,
  Search,
  CheckCircle2,
  CircleDashed,
  Filter,
  CalendarDays,
  Wallet,
  AlertTriangle,
  Building2,
  Receipt,
  FileText,
  RotateCcw,
  Eye,
  Paperclip,
  TrendingDown,
  ArrowRight,
  ShieldCheck,
  X
} from "lucide-react";
import { fmtBRL } from "../../../components/ui";

export default function ContasAPagarHubPage() {
  const { unidadeAtiva } = useERP();

  // Estados Principais
  const [contas, setContas] = useState([]);
  const [fornecedores, setFornecedores] = useState([]);
  const [contasFinanceiras, setContasFinanceiras] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("TODOS");
  const [filtroCategoria, setFiltroCategoria] = useState("TODAS");
  const [filtroFornecedor, setFiltroFornecedor] = useState("TODOS");

  // Modais
  const [modalNovaContaOpen, setModalNovaContaOpen] = useState(false);
  const [modalPagarOpen, setModalPagarOpen] = useState(false);
  const [modalDetalheOpen, setModalDetalheOpen] = useState(false);
  const [avisoRecorrentes, setAvisoRecorrentes] = useState("");

  // Conta Selecionada para Pagamento / Detalhes
  const [contaSelecionada, setContaSelecionada] = useState(null);
  const [historicoPagamentos, setHistoricoPagamentos] = useState([]);

  // Form Lançamento de Conta (Com Parcelamento)
  const [formConta, setFormConta] = useState({
    id: "",
    descricao: "",
    fornecedor_id: "",
    valor: "",
    data_vencimento: new Date().toISOString().slice(0, 10),
    categoria: CATEGORIAS_CUSTO[0].id,
    centro_custo: "geral",
    numero_documento: "",
    total_parcelas: 1,
    recorrente: false,
    observacao: ""
  });

  // Form Pagamento Completo
  const [formPagamento, setFormPagamento] = useState({
    valor_pago_agora: "",
    juros: "0,00",
    multa: "0,00",
    desconto: "0,00",
    forma_pagamento: "pix",
    conta_financeira_id: "",
    observacao: ""
  });

  const carregarDados = async (silencioso = false) => {
    if (!silencioso) setLoading(true);
    const { criadas } = await gerarContasRecorrentes(unidadeAtiva);
    if (criadas > 0) {
      setAvisoRecorrentes(`${criadas} conta(s) recorrente(s) do mês gerada(s) automaticamente.`);
      setTimeout(() => setAvisoRecorrentes(""), 5000);
    }

    const [resContas, resForn, resFin] = await Promise.all([
      fetchContas(unidadeAtiva),
      fetchFornecedores(unidadeAtiva),
      fetchContasFinanceiras(unidadeAtiva)
    ]);

    setContas(resContas.data || []);
    setFornecedores(resForn.data || []);
    setContasFinanceiras(resFin.data || []);
    setLoading(false);
  };

  useEffect(() => {
    if (unidadeAtiva) carregarDados();
  }, [unidadeAtiva]);

  useTempoReal(null, () => carregarDados(true));

  // CÁLCULOS E FILTROS DA TABELA
  const contasFiltradas = useMemo(() => {
    return contas.filter(c => {
      const st = c.status_calculado || calcularStatusConta(c);

      if (filtroStatus !== "TODOS" && st !== filtroStatus) return false;
      if (filtroCategoria !== "TODAS" && c.categoria !== filtroCategoria) return false;
      if (filtroFornecedor !== "TODOS" && c.fornecedor_id !== filtroFornecedor) return false;

      if (busca.trim()) {
        const term = busca.toLowerCase();
        const desc = String(c.descricao || "").toLowerCase();
        const forn = String(c.fornecedor?.nome || "").toLowerCase();
        const doc = String(c.numero_documento || "").toLowerCase();
        if (!desc.includes(term) && !forn.includes(term) && !doc.includes(term)) return false;
      }
      return true;
    });
  }, [contas, filtroStatus, filtroCategoria, filtroFornecedor, busca]);

  // KPIS TOTAIS
  const kpis = useMemo(() => {
    let pendente = 0;
    let vencido = 0;
    let pago = 0;

    contas.forEach(c => {
      const st = c.status_calculado || calcularStatusConta(c);
      const saldo = Number(c.saldo !== undefined ? c.saldo : (Number(c.valor) - Number(c.valor_pago || 0)));
      const vPago = Number(c.valor_pago) || 0;

      if (st === "PAGA") {
        pago += (vPago || Number(c.valor));
      } else {
        pendente += saldo;
        if (st === "VENCIDA") vencido += saldo;
      }
    });

    return { pendente, vencido, pago };
  }, [contas]);

  // AÇÕES
  const handleSalvarConta = async (e) => {
    e.preventDefault();
    const valNum = parseFloat(String(formConta.valor).replace(',', '.'));
    if (isNaN(valNum) || valNum <= 0) return alert("Informe um valor válido.");

    const res = await salvarConta({
      ...formConta,
      unidade_id: unidadeAtiva,
      valor_original: valNum
    });

    if (res.error) return alert(`❌ Erro ao salvar conta: ${res.error}`);

    alert("Conta a pagar salva com sucesso!");
    setModalNovaContaOpen(false);
    setFormConta({
      id: "", descricao: "", fornecedor_id: "", valor: "", data_vencimento: new Date().toISOString().slice(0, 10),
      categoria: CATEGORIAS_CUSTO[0].id, centro_custo: "geral", numero_documento: "", total_parcelas: 1, recorrente: false, observacao: ""
    });
    carregarDados();
  };

  const abrirModalPagamento = (conta) => {
    const saldo = Number(conta.saldo !== undefined ? conta.saldo : (Number(conta.valor) - Number(conta.valor_pago || 0)));
    setContaSelecionada(conta);
    setFormPagamento({
      valor_pago_agora: saldo.toFixed(2).replace('.', ','),
      juros: "0,00",
      multa: "0,00",
      desconto: "0,00",
      forma_pagamento: conta.forma_pagamento || "pix",
      conta_financeira_id: contasFinanceiras[0]?.id || "",
      observacao: ""
    });
    setModalPagarOpen(true);
  };

  const handleConfirmarPagamento = async (e) => {
    e.preventDefault();
    if (!contaSelecionada) return;

    const valPago = parseFloat(String(formPagamento.valor_pago_agora).replace(',', '.'));
    if (isNaN(valPago) || valPago <= 0) return alert("Informe o valor a pagar.");

    const jurosNum = parseFloat(String(formPagamento.juros).replace(',', '.')) || 0;
    const multaNum = parseFloat(String(formPagamento.multa).replace(',', '.')) || 0;
    const descNum = parseFloat(String(formPagamento.desconto).replace(',', '.')) || 0;

    const res = await pagarConta(contaSelecionada.id, {
      unidade_id: unidadeAtiva,
      valor_pago_agora: valPago,
      juros: jurosNum,
      multa: multaNum,
      desconto: descNum,
      forma_pagamento: formPagamento.forma_pagamento,
      conta_financeira_id: formPagamento.conta_financeira_id || null,
      observacao: formPagamento.observacao,
      chave_idempotencia: `PAG-${contaSelecionada.id}-${Date.now()}`
    });

    if (res.error) return alert(`❌ Erro ao efetuar pagamento: ${res.error}`);

    alert("✅ Pagamento registrado com sucesso! Débito efetuado no saldo financeiro.");
    setModalPagarOpen(false);
    setContaSelecionada(null);
    carregarDados();
  };

  const abrirDetalhesConta = async (conta) => {
    setContaSelecionada(conta);
    setModalDetalheOpen(true);
    const resHist = await fetchHistoricoPagamentos(conta.id);
    setHistoricoPagamentos(resHist.data || []);
  };

  const handleEstornar = async (pagamentoId) => {
    if (!confirm("Tem certeza que deseja estornar este pagamento? O valor será creditado de volta na conta financeira.")) return;
    const res = await estornarPagamento(pagamentoId, unidadeAtiva, "Estorno solicitado pelo usuário");
    if (res.error) return alert(`❌ Erro ao estornar: ${res.error}`);

    alert("Pagamento estornado com sucesso!");
    setModalDetalheOpen(false);
    carregarDados();
  };

  return (
    <div className="min-h-screen pb-24 font-sans text-slate-800 bg-[var(--surface)]">

      {avisoRecorrentes && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-sky-600 text-white font-bold text-sm px-5 py-3 rounded-full shadow-xl animate-in fade-in">
          {avisoRecorrentes}
        </div>
      )}

      {/* CABEÇALHO */}
      <div className="bg-slate-900 pt-6 sm:pt-8 pb-8 sm:pb-10 px-4 sm:px-8 shadow-lg text-white">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tighter">Contas a Pagar</h1>
            <p className="text-subtle font-bold uppercase tracking-widest text-xs mt-1">
              Fonte Única da Verdade • Gestão de Obrigações, Liquidações e DRE
            </p>
          </div>

          <button
            onClick={() => {
              setFormConta({
                id: "", descricao: "", fornecedor_id: "", valor: "", data_vencimento: new Date().toISOString().slice(0, 10),
                categoria: CATEGORIAS_CUSTO[0].id, centro_custo: "geral", numero_documento: "", total_parcelas: 1, recorrente: false, observacao: ""
              });
              setModalNovaContaOpen(true);
            }}
            className="px-6 py-4 bg-emerald-500 hover:bg-emerald-600 text-white font-black rounded-2xl flex items-center gap-2 shadow-xl shadow-emerald-500/20 active:scale-95 transition-all cursor-pointer"
          >
            <Plus size={20} /> Lançar Nova Despesa
          </button>
        </div>

        {/* CARDS KPIS DE RESUMO */}
        <div className="max-w-7xl mx-auto mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-slate-800/80 p-5 rounded-3xl border border-slate-700/50 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <CalendarDays size={24} />
            </div>
            <div>
              <p className="text-3xs uppercase font-bold tracking-widest text-slate-400">Total Pendente</p>
              <p className="text-2xl font-black text-amber-400">{fmtBRL(kpis.pendente)}</p>
            </div>
          </div>

          <div className="bg-slate-800/80 p-5 rounded-3xl border border-slate-700/50 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-red-500/20 text-red-400 flex items-center justify-center">
              <AlertTriangle size={24} />
            </div>
            <div>
              <p className="text-3xs uppercase font-bold tracking-widest text-slate-400">Total Vencido</p>
              <p className="text-2xl font-black text-red-400">{fmtBRL(kpis.vencido)}</p>
            </div>
          </div>

          <div className="bg-slate-800/80 p-5 rounded-3xl border border-slate-700/50 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Wallet size={24} />
            </div>
            <div>
              <p className="text-3xs uppercase font-bold tracking-widest text-slate-400">Total Pago no Mês</p>
              <p className="text-2xl font-black text-emerald-400">{fmtBRL(kpis.pago)}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 mt-6">
        <div className="bg-card rounded-3xl p-6 border border-line shadow-sm space-y-6">

          {/* BARRA DE BUSCA E FILTROS */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="relative md:col-span-1">
              <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar fornecedor, NF ou descrição..."
                value={busca}
                onChange={e => setBusca(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-line rounded-2xl text-xs font-bold text-slate-800 outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <select
                value={filtroStatus}
                onChange={e => setFiltroStatus(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-line rounded-2xl text-xs font-bold text-slate-800 outline-none focus:border-emerald-500"
              >
                <option value="TODOS">-- Todos os Status --</option>
                <option value="PENDENTE">PENDENTE</option>
                <option value="VENCENDO">VENCENDO (Próximos 3 dias)</option>
                <option value="VENCIDA">VENCIDA</option>
                <option value="PARCIALMENTE PAGA">PARCIALMENTE PAGA</option>
                <option value="PAGA">PAGA</option>
                <option value="CANCELADA">CANCELADA</option>
              </select>
            </div>

            <div>
              <select
                value={filtroCategoria}
                onChange={e => setFiltroCategoria(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-line rounded-2xl text-xs font-bold text-slate-800 outline-none focus:border-emerald-500"
              >
                <option value="TODAS">-- Todas as Categorias --</option>
                {CATEGORIAS_CUSTO.map(c => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            </div>

            <div>
              <select
                value={filtroFornecedor}
                onChange={e => setFiltroFornecedor(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-line rounded-2xl text-xs font-bold text-slate-800 outline-none focus:border-emerald-500"
              >
                <option value="TODOS">-- Todos os Fornecedores --</option>
                {fornecedores.map(f => (
                  <option key={f.id} value={f.id}>{f.nome}</option>
                ))}
              </select>
            </div>
          </div>

          {/* TABELA DE CONTAS OPERACIONAL */}
          {loading ? (
            <div className="py-12 text-center text-muted font-bold">Carregando contas a pagar...</div>
          ) : !contasFiltradas.length ? (
            <div className="py-12 text-center text-muted space-y-2">
              <Wallet size={40} className="mx-auto text-slate-300" />
              <p className="font-bold text-slate-700">Nenhuma conta encontrada para o filtro selecionado.</p>
            </div>
          ) : (
            <div className="rounded-2xl border border-line overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900 text-white uppercase font-black tracking-wider">
                    <tr>
                      <th className="p-3.5">Fornecedor / Descrição</th>
                      <th className="p-3.5">Documento</th>
                      <th className="p-3.5">Vencimento</th>
                      <th className="p-3.5 text-right">Original</th>
                      <th className="p-3.5 text-right">Pago</th>
                      <th className="p-3.5 text-right">Saldo</th>
                      <th className="p-3.5 text-center">Status</th>
                      <th className="p-3.5 text-right">Ação</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-line bg-card">
                    {contasFiltradas.map(c => {
                      const st = c.status_calculado || calcularStatusConta(c);
                      const orig = Number(c.valor_original ?? c.valor) || 0;
                      const pago = Number(c.valor_pago) || 0;
                      const saldo = Number(c.saldo !== undefined ? c.saldo : (orig - pago));

                      return (
                        <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                          <td className="p-3.5">
                            <strong className="text-slate-800 font-black block">{c.fornecedor?.nome || c.descricao}</strong>
                            <span className="text-3xs text-subtle font-medium">{c.descricao} • {c.categoria}</span>
                          </td>

                          <td className="p-3.5 font-medium text-slate-600">
                            {c.numero_documento ? `NF ${c.numero_documento}` : (c.origem_tipo || "Manual")}
                          </td>

                          <td className="p-3.5 font-bold text-slate-700">
                            {c.data_vencimento ? new Date(`${c.data_vencimento}T12:00:00`).toLocaleDateString("pt-BR") : "N/I"}
                          </td>

                          <td className="p-3.5 text-right font-medium text-slate-600">{fmtBRL(orig)}</td>
                          <td className="p-3.5 text-right font-medium text-emerald-600">{fmtBRL(pago)}</td>
                          <td className="p-3.5 text-right font-black text-slate-800">{fmtBRL(saldo)}</td>

                          <td className="p-3.5 text-center">
                            <span className={`px-2.5 py-1 rounded-full text-3xs font-black uppercase tracking-wider ${
                              st === "PAGA" ? "bg-emerald-100 text-emerald-800" :
                              st === "PARCIALMENTE PAGA" ? "bg-blue-100 text-blue-800" :
                              st === "VENCIDA" ? "bg-red-100 text-red-800" :
                              st === "VENCENDO" ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-700"
                            }`}>
                              {st}
                            </span>
                          </td>

                          <td className="p-3.5 text-right space-x-2">
                            <button
                              onClick={() => abrirDetalhesConta(c)}
                              className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors cursor-pointer"
                              title="Ver Detalhes e Histórico"
                            >
                              <Eye size={15} />
                            </button>

                            {st !== "PAGA" && st !== "CANCELADA" && (
                              <button
                                onClick={() => abrirModalPagamento(c)}
                                className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-lg text-2xs transition-all cursor-pointer"
                              >
                                Pagar
                              </button>
                            )}
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

      {/* MODAL NOVO LANÇAMENTO (COM PARCELAMENTO) */}
      {modalNovaContaOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-card rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-3 border-b border-line">
              <h3 className="text-xl font-black text-slate-800">Lançar Nova Despesa</h3>
              <button onClick={() => setModalNovaContaOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>

            <form onSubmit={handleSalvarConta} className="space-y-3.5">
              <div>
                <label className="text-xs font-bold text-muted uppercase block mb-1">Descrição</label>
                <input required type="text" placeholder="Ex: Conta de Luz ou Distribuidora XYZ" value={formConta.descricao} onChange={e => setFormConta({ ...formConta, descricao: e.target.value })} className="w-full p-3 bg-slate-50 border border-line rounded-xl font-bold text-slate-800 text-sm" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-muted uppercase block mb-1">Fornecedor (Opcional)</label>
                  <select value={formConta.fornecedor_id} onChange={e => setFormConta({ ...formConta, fornecedor_id: e.target.value })} className="w-full p-3 bg-slate-50 border border-line rounded-xl font-bold text-slate-800 text-sm">
                    <option value="">-- Sem Fornecedor --</option>
                    {fornecedores.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-muted uppercase block mb-1">Número da NF / Doc</label>
                  <input type="text" placeholder="Ex: 10482" value={formConta.numero_documento} onChange={e => setFormConta({ ...formConta, numero_documento: e.target.value })} className="w-full p-3 bg-slate-50 border border-line rounded-xl font-medium text-slate-800 text-sm" />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-bold text-muted uppercase block mb-1">Valor Total (R$)</label>
                  <input required type="text" placeholder="1200,00" value={formConta.valor} onChange={e => setFormConta({ ...formConta, valor: e.target.value })} className="w-full p-3 bg-slate-50 border border-line rounded-xl font-black text-emerald-600 text-sm" />
                </div>

                <div>
                  <label className="text-xs font-bold text-muted uppercase block mb-1">Nº Parcelas</label>
                  <input required type="number" min="1" max="60" value={formConta.total_parcelas} onChange={e => setFormConta({ ...formConta, total_parcelas: parseInt(e.target.value) || 1 })} className="w-full p-3 bg-slate-50 border border-line rounded-xl font-bold text-slate-800 text-sm" />
                </div>

                <div>
                  <label className="text-xs font-bold text-muted uppercase block mb-1">1º Vencimento</label>
                  <input required type="date" value={formConta.data_vencimento} onChange={e => setFormConta({ ...formConta, data_vencimento: e.target.value })} className="w-full p-3 bg-slate-50 border border-line rounded-xl font-bold text-slate-800 text-sm" />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-muted uppercase block mb-1">Categoria Contábil</label>
                <select value={formConta.categoria} onChange={e => setFormConta({ ...formConta, categoria: e.target.value })} className="w-full p-3 bg-slate-50 border border-line rounded-xl font-bold text-slate-800 text-sm">
                  {CATEGORIAS_CUSTO.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input type="checkbox" id="recorrente" checked={formConta.recorrente} onChange={e => setFormConta({ ...formConta, recorrente: e.target.checked })} className="w-4 h-4 rounded text-emerald-500 accent-emerald-500 cursor-pointer" />
                <label htmlFor="recorrente" className="text-xs font-bold text-slate-700 cursor-pointer">Despesa Recorrente (Recriar todo mês)</label>
              </div>

              <div className="flex gap-3 pt-4 border-t border-line">
                <button type="button" onClick={() => setModalNovaContaOpen(false)} className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm rounded-xl cursor-pointer">Cancelar</button>
                <button type="submit" className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm rounded-xl cursor-pointer">Salvar Despesa</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL PAGAMENTO COMPLETO (JUROS, MULTA, DESCONTO, BANCO) */}
      {modalPagarOpen && contaSelecionada && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-card rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-line">
              <div>
                <span className="text-3xs font-black uppercase text-emerald-600 tracking-wider">Liquidação Financeira</span>
                <h3 className="text-xl font-black text-slate-800">{contaSelecionada.fornecedor?.nome || contaSelecionada.descricao}</h3>
              </div>
              <button onClick={() => setModalPagarOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>

            <form onSubmit={handleConfirmarPagamento} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-muted uppercase block mb-1">Valor a Pagar Agora (R$)</label>
                <input required type="text" value={formPagamento.valor_pago_agora} onChange={e => setFormPagamento({ ...formPagamento, valor_pago_agora: e.target.value })} className="w-full p-3.5 bg-slate-50 border border-line rounded-2xl font-black text-emerald-600 text-lg outline-none focus:border-emerald-500" />
              </div>

              <div className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <label className="font-bold text-muted uppercase block mb-1">Juros (R$)</label>
                  <input type="text" value={formPagamento.juros} onChange={e => setFormPagamento({ ...formPagamento, juros: e.target.value })} className="w-full p-2.5 bg-slate-50 border border-line rounded-xl font-bold text-slate-800" />
                </div>
                <div>
                  <label className="font-bold text-muted uppercase block mb-1">Multa (R$)</label>
                  <input type="text" value={formPagamento.multa} onChange={e => setFormPagamento({ ...formPagamento, multa: e.target.value })} className="w-full p-2.5 bg-slate-50 border border-line rounded-xl font-bold text-slate-800" />
                </div>
                <div>
                  <label className="font-bold text-muted uppercase block mb-1">Desconto (R$)</label>
                  <input type="text" value={formPagamento.desconto} onChange={e => setFormPagamento({ ...formPagamento, desconto: e.target.value })} className="w-full p-2.5 bg-slate-50 border border-line rounded-xl font-bold text-emerald-600" />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-muted uppercase block mb-1">Debitar da Conta Financeira</label>
                <select value={formPagamento.conta_financeira_id} onChange={e => setFormPagamento({ ...formPagamento, conta_financeira_id: e.target.value })} className="w-full p-3 bg-slate-50 border border-line rounded-xl font-bold text-slate-800 text-sm">
                  {contasFinanceiras.map(cf => (
                    <option key={cf.id} value={cf.id}>{cf.nome} (Saldo: {fmtBRL(cf.saldo_atual)})</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3 pt-4 border-t border-line">
                <button type="button" onClick={() => setModalPagarOpen(false)} className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm rounded-xl cursor-pointer">Cancelar</button>
                <button type="submit" className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-black text-sm rounded-xl cursor-pointer shadow-lg shadow-emerald-500/20">Confirmar Pagamento</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DETALHES & HISTÓRICO DE PAGAMENTOS / ESTORNO */}
      {modalDetalheOpen && contaSelecionada && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-card rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-3 border-b border-line">
              <div>
                <span className="text-3xs font-black uppercase text-slate-500 tracking-wider">Detalhamento & Rastreabilidade</span>
                <h3 className="text-xl font-black text-slate-800">{contaSelecionada.fornecedor?.nome || contaSelecionada.descricao}</h3>
              </div>
              <button onClick={() => setModalDetalheOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl text-xs space-y-2">
              <div className="flex justify-between"><span>Origem:</span><strong className="text-slate-800">{contaSelecionada.origem_tipo || 'Manual'}</strong></div>
              <div className="flex justify-between"><span>Número Documento:</span><strong className="text-slate-800">{contaSelecionada.numero_documento || 'N/A'}</strong></div>
              <div className="flex justify-between"><span>Valor Original:</span><strong className="text-slate-800">{fmtBRL(contaSelecionada.valor_original ?? contaSelecionada.valor)}</strong></div>
              <div className="flex justify-between"><span>Valor Pago Acumulado:</span><strong className="text-emerald-600">{fmtBRL(contaSelecionada.valor_pago)}</strong></div>
              <div className="flex justify-between border-t border-line pt-1 font-bold"><span>Saldo Restante:</span><strong className="text-slate-900 text-sm">{fmtBRL(contaSelecionada.saldo)}</strong></div>
            </div>

            <div className="space-y-2">
              <h4 className="font-black text-xs uppercase tracking-wider text-slate-700">Histórico de Pagamentos</h4>
              {!historicoPagamentos.length ? (
                <p className="text-xs text-muted py-3">Nenhum pagamento efetuado até o momento.</p>
              ) : (
                <div className="space-y-2">
                  {historicoPagamentos.map(h => (
                    <div key={h.id} className="p-3 bg-white border border-line rounded-xl text-xs flex justify-between items-center">
                      <div>
                        <strong className="text-emerald-600 font-bold">{fmtBRL(h.valor_pago)}</strong>
                        <span className="text-3xs text-subtle block">{new Date(h.created_at).toLocaleDateString("pt-BR")} • {h.forma_pagamento}</span>
                        {h.estornado && <span className="text-3xs font-black text-red-600 uppercase">ESTORNADO</span>}
                      </div>

                      {!h.estornado && (
                        <button onClick={() => handleEstornar(h.id)} className="px-2.5 py-1 bg-red-100 hover:bg-red-200 text-red-700 font-bold text-3xs rounded-lg transition-colors cursor-pointer">
                          Estornar
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-2">
              <button onClick={() => setModalDetalheOpen(false)} className="w-full py-3 bg-slate-900 text-white font-bold text-xs rounded-xl cursor-pointer">Fechar</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
