"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Wallet, TrendingUp, ReceiptText, CreditCard, ShoppingBag, Plus, Trash2,
  CheckCircle2, Loader2, X, CalendarDays, Banknote, AlertCircle,
  Calculator, Target, Scale, Zap, Droplets, Wifi, Flame, Sparkles, Wrench, PackagePlus, Percent, Settings2, Check,
} from "lucide-react";
import { useERP } from "../../context/ERPContext";
import {
  CATEGORIAS_CUSTO, fetchEntradasEstoqueFinanceiro, fetchPainelCaixa, pagarConta, removerConta, salvarConta,
  obterParametrosPontoEquilibrio, salvarParametrosPontoEquilibrio,
} from "../../lib/financeiro";
import { fetchColaboradores, fetchRecibosPrestacaoUnidade } from "../../lib/rh";
import { fetchFichas } from "../../lib/operacao";
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
  const [fichas, setFichas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [modal, setModal] = useState(false);
  const [modalPE, setModalPE] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [form, setForm] = useState({ descricao: "", valor: "", categoria: "custo_fixo", data_vencimento: new Date().toISOString().slice(0, 10), status: "pendente" });

  const [paramsPE, setParamsPE] = useState({
    diasTrabalho: 26, luz: 1200, agua: 450, internet: 200, gas: 800, limpeza: 350, manutencao: 500, gastosExtras: 300, impostoPct: 4.0, taxaCartaoPct: 2.5,
  });

  const carregar = async () => {
    if (!unidadeAtiva || unidadeAtiva === "todas") return;
    setLoading(true);
    const agora = new Date();
    const inicio = new Date(agora.getFullYear(), 0, 1);
    const fim = new Date(agora.getFullYear() + 1, 0, 1);
    try {
      const [resposta, equipe, recibos, entradas, resFichas] = await Promise.all([
        fetchPainelCaixa(unidadeAtiva, inicio.toISOString(), fim.toISOString()).catch(e => ({ data: { vendas: [], despesas: [] }, error: e?.message })),
        fetchColaboradores(unidadeAtiva).catch(e => ({ data: [], error: e?.message })),
        fetchRecibosPrestacaoUnidade(unidadeAtiva).catch(e => ({ data: [], error: e?.message })),
        fetchEntradasEstoqueFinanceiro(unidadeAtiva, inicio.toISOString(), fim.toISOString()).catch(e => ({ data: [], error: e?.message })),
        fetchFichas(unidadeAtiva).catch(e => ({ data: [], error: e?.message })),
      ]);
      setDados({
        ...(resposta?.data || { vendas: [], despesas: [] }),
        colaboradores: equipe?.data || [],
        recibos: recibos?.data || [],
        entradasEstoque: entradas?.data || [],
      });
      setFichas(resFichas?.data || (Array.isArray(resFichas) ? resFichas : []));
      setErro([resposta?.error, equipe?.error, recibos?.error, entradas?.error].filter(Boolean).join(" · "));
    } catch (err) {
      console.error(err);
      setErro(err?.message || "Não foi possível carregar alguns históricos.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { carregar(); }, [unidadeAtiva]);

  // Carrega / Salva parâmetros do Ponto de Equilíbrio
  useEffect(() => {
    if (unidadeAtiva && unidadeAtiva !== "todas") {
      setParamsPE(obterParametrosPontoEquilibrio(unidadeAtiva));
    }
  }, [unidadeAtiva]);

  const salvarParamsPE = (novosParams) => {
    setParamsPE(novosParams);
    salvarParametrosPontoEquilibrio(unidadeAtiva, novosParams);
  };

  const calculoPE = useMemo(() => {
    // 1. CMV Médio % das Fichas Técnicas
    let cmvPct = 32.0;
    if (fichas.length > 0) {
      const cmvs = fichas.map(f => Number(f.cmv_meta) || 30).filter(c => c > 0);
      if (cmvs.length > 0) {
        cmvPct = cmvs.reduce((a, b) => a + b, 0) / cmvs.length;
      }
    }

    // 2. CMO (Mão de Obra) Mensal
    const folhaMensal = folhaDoMes(dados.colaboradores || []);
    const extrasMensal = (dados.recibos || []).reduce((s, r) => s + Number(r.valor_total || 0), 0);
    const cmoMensal = folhaMensal + extrasMensal;

    // 3. Custos Fixos Operacionais Lançados/Configurados
    const operacionaisMensais =
      Number(paramsPE.luz || 0) +
      Number(paramsPE.agua || 0) +
      Number(paramsPE.internet || 0) +
      Number(paramsPE.gas || 0) +
      Number(paramsPE.limpeza || 0) +
      Number(paramsPE.manutencao || 0) +
      Number(paramsPE.gastosExtras || 0);

    // 4. Montante Total de Custo Fixo Mensal
    const custoFixoTotalMensal = cmoMensal + operacionaisMensais;

    // 5. Dias de trabalho
    const dias = Math.max(1, Number(paramsPE.diasTrabalho) || 26);
    const custoFixoDiario = custoFixoTotalMensal / dias;
    const cmoDiario = cmoMensal / dias;
    const operacaoDiaria = operacionaisMensais / dias;

    // 6. Deduções e Margem de Contribuição %
    const impostoPct = Number(paramsPE.impostoPct) || 4.0;
    const taxaCartaoPct = Number(paramsPE.taxaCartaoPct) || 2.5;
    const deducoesPct = cmvPct + impostoPct + taxaCartaoPct;
    const margemContribucaoPct = Math.max(1, 100 - deducoesPct);

    // 7. Ponto de Equilíbrio (Venda Necessária por dia)
    const metaVendaDiaria = custoFixoDiario / (margemContribucaoPct / 100);
    const metaVendaMensal = metaVendaDiaria * dias;

    // 8. Venda Real de Hoje
    const [inicioHoje, fimHoje] = intervaloPeriodo("dia");
    const vendasHoje = (dados.vendas || []).filter(v => {
      const data = new Date(v.created_at);
      return data >= inicioHoje && data < fimHoje;
    }).reduce((s, v) => s + Number(v.total || 0), 0);

    const progressoHojePct = metaVendaDiaria > 0 ? Math.min(100, (vendasHoje / metaVendaDiaria) * 100) : 0;
    const faltaHoje = Math.max(0, metaVendaDiaria - vendasHoje);

    return {
      cmvPct, cmoMensal, cmoDiario, operacionaisMensais, operacaoDiaria,
      custoFixoTotalMensal, custoFixoDiario, dias, impostoPct, taxaCartaoPct, deducoesPct,
      margemContribucaoPct, metaVendaDiaria, metaVendaMensal, vendasHoje, progressoHojePct, faltaHoje,
    };
  }, [fichas, dados, paramsPE]);

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
            <p className="mt-1 font-medium text-slate-500">Vendas, recebimentos, despesas e ponto de equilíbrio diário.</p>
          </div>
          <div className="flex max-w-full gap-2 overflow-x-auto rounded-2xl bg-slate-200/80 p-1.5">
            {PERIODOS.map(p => <button key={p.id} onClick={() => setPeriodo(p.id)} className={`min-h-11 whitespace-nowrap rounded-xl px-5 text-sm font-black ${periodo === p.id ? "bg-white text-emerald-700 shadow-sm" : "text-slate-600"}`}>{p.label}</button>)}
          </div>
        </header>

        {erro && <div className="mb-4 flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-800"><AlertCircle size={19} className="shrink-0" />Alguns históricos não puderam ser carregados: {erro}</div>}

        {/* ========================================================================= */}
        {/* PAINEL DE PONTO DE EQUILÍBRIO DIÁRIO DO RESTAURANTE                       */}
        {/* ========================================================================= */}
        <section className="mb-6 rounded-3xl border border-emerald-200/80 bg-gradient-to-br from-white via-slate-50/50 to-emerald-50/30 p-5 shadow-sm sm:p-6">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
            <div className="flex items-center gap-3">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-600/20">
                <Target size={24} />
              </div>
              <div>
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-800">
                  Meta Diária de Sobrevivência e Lucro
                </span>
                <h2 className="text-xl font-black text-slate-900 sm:text-2xl mt-0.5">Ponto de Equilíbrio Diário</h2>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setModalPE(true)}
                className="flex items-center gap-2 rounded-xl border border-emerald-300 bg-white px-4 py-2.5 text-xs font-black text-emerald-700 shadow-sm hover:bg-emerald-50 transition-all"
              >
                <Settings2 size={16} /> Ajustar Custos Fixos & Dias
              </button>
            </div>
          </div>

          {/* KPIS PRINCIPAIS DO PONTO DE EQUILÍBRIO */}
          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
            {/* CARD 1: META DIÁRIA */}
            <div className="rounded-2xl border-2 border-emerald-300 bg-white p-5 shadow-sm">
              <span className="text-[11px] font-black uppercase tracking-wider text-emerald-700">Venda Diária Necessária</span>
              <p className="mt-1 text-2xl sm:text-3xl font-black text-slate-950">{fmtBRL(calculoPE.metaVendaDiaria)}</p>
              <p className="mt-2 text-xs font-bold text-slate-500">
                Para cobrir <b className="text-slate-800">{fmtBRL(calculoPE.custoFixoDiario)}/dia</b> de custos fixos + CMO ({calculoPE.dias} dias úteis)
              </p>
            </div>

            {/* CARD 2: REALIZADO HOJE VS META */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">Vendido Hoje</span>
                <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-black ${calculoPE.vendasHoje >= calculoPE.metaVendaDiaria ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800"}`}>
                  {calculoPE.progressoHojePct.toFixed(0)}% da meta
                </span>
              </div>
              <p className="mt-1 text-2xl sm:text-3xl font-black text-slate-900">{fmtBRL(calculoPE.vendasHoje)}</p>

              {/* BARRA DE PROGRESSO DO DIA */}
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${calculoPE.vendasHoje >= calculoPE.metaVendaDiaria ? "bg-emerald-500" : "bg-amber-500"}`}
                  style={{ width: `${calculoPE.progressoHojePct}%` }}
                />
              </div>

              <p className="mt-2 text-xs font-bold text-slate-500">
                {calculoPE.faltaHoje > 0 ? (
                  <>Falta vender <b className="text-slate-800">{fmtBRL(calculoPE.faltaHoje)}</b> para o ponto de equilíbrio.</>
                ) : (
                  <span className="text-emerald-700 font-black">🎉 Ponto de equilíbrio atingido hoje! O restante é lucro!</span>
                )}
              </p>
            </div>

            {/* CARD 3: META MENSAL TOTAL */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">Ponto de Equilíbrio Mensal</span>
              <p className="mt-1 text-2xl sm:text-3xl font-black text-slate-900">{fmtBRL(calculoPE.metaVendaMensal)}</p>
              <p className="mt-2 text-xs font-bold text-slate-500">
                Faturamento no mês em {calculoPE.dias} dias de trabalho ({fmtBRL(calculoPE.custoFixoTotalMensal)} de custo fixo mensal)
              </p>
            </div>
          </div>

          {/* DISCRIMINAÇÃO DOS CUSTOS DIVIDIDOS */}
          <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4">
              Detalhamento da Composição dos Custos & Margem
            </h3>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
              {/* CMV */}
              <button
                type="button"
                onClick={() => window.location.href = "/dashboard/operacao/fichas"}
                title="Clique para ir para as Fichas Técnicas"
                className="rounded-xl border border-orange-200 bg-orange-50/60 p-3 text-left transition-all hover:border-orange-300 hover:bg-orange-100/70 hover:shadow-md hover:scale-[1.02] cursor-pointer"
              >
                <span className="block text-[10px] font-black uppercase tracking-wider text-orange-700">1. CMV Média (Fichas) 🔗</span>
                <span className="mt-1 block text-lg font-black text-orange-950">{calculoPE.cmvPct.toFixed(1)}%</span>
                <span className="text-[10px] font-semibold text-slate-500">Baseado nas Fichas Técnicas</span>
              </button>

              {/* CMO */}
              <button
                type="button"
                onClick={() => window.location.href = "/dashboard/rh"}
                title="Clique para ir para a Equipe / RH"
                className="rounded-xl border border-blue-200 bg-blue-50/60 p-3 text-left transition-all hover:border-blue-300 hover:bg-blue-100/70 hover:shadow-md hover:scale-[1.02] cursor-pointer"
              >
                <span className="block text-[10px] font-black uppercase tracking-wider text-blue-700">2. CMO (Mão de Obra) 🔗</span>
                <span className="mt-1 block text-lg font-black text-blue-950">{fmtBRL(calculoPE.cmoDiario)}<small className="text-xs text-slate-500">/dia</small></span>
                <span className="text-[10px] font-semibold text-slate-500">{fmtBRL(calculoPE.cmoMensal)} / mês</span>
              </button>

              {/* OPERACIONAIS FIXOS */}
              <button
                type="button"
                onClick={() => setModalPE(true)}
                title="Clique para ajustar os Custos Operacionais"
                className="rounded-xl border border-purple-200 bg-purple-50/60 p-3 text-left transition-all hover:border-purple-300 hover:bg-purple-100/70 hover:shadow-md hover:scale-[1.02] cursor-pointer"
              >
                <span className="block text-[10px] font-black uppercase tracking-wider text-purple-700">3. Operacional Fixo ✏️</span>
                <span className="mt-1 block text-lg font-black text-purple-950">{fmtBRL(calculoPE.operacaoDiaria)}<small className="text-xs text-slate-500">/dia</small></span>
                <span className="text-[10px] font-semibold text-slate-500">{fmtBRL(calculoPE.operacionaisMensais)} / mês</span>
              </button>

              {/* TAXAS & IMPOSTOS */}
              <button
                type="button"
                onClick={() => setModalPE(true)}
                title="Clique para ajustar os Impostos e Taxas"
                className="rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-left transition-all hover:border-amber-300 hover:bg-amber-100/70 hover:shadow-md hover:scale-[1.02] cursor-pointer"
              >
                <span className="block text-[10px] font-black uppercase tracking-wider text-amber-700">4. Impostos + Cartão ✏️</span>
                <span className="mt-1 block text-lg font-black text-amber-950">{(calculoPE.impostoPct + calculoPE.taxaCartaoPct).toFixed(1)}%</span>
                <span className="text-[10px] font-semibold text-slate-500">({calculoPE.impostoPct}% imp + {calculoPE.taxaCartaoPct}% maq)</span>
              </button>

              {/* MARGEM CONTRIBUIÇÃO */}
              <button
                type="button"
                onClick={() => setModalPE(true)}
                title="Clique para ver / ajustar os parâmetros"
                className="col-span-2 sm:col-span-4 lg:col-span-1 rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 text-left transition-all hover:border-emerald-300 hover:bg-emerald-100/80 hover:shadow-md hover:scale-[1.02] cursor-pointer"
              >
                <span className="block text-[10px] font-black uppercase tracking-wider text-emerald-800">5. Margem Contribuição ✏️</span>
                <span className="mt-1 block text-lg font-black text-emerald-950">{calculoPE.margemContribucaoPct.toFixed(1)}%</span>
                <span className="text-[10px] font-semibold text-slate-500">100% - Deduções Totais</span>
              </button>
            </div>

            {/* BARRA DE DISCRIMINAÇÃO DOS CUSTOS FIXOS OPERACIONAIS */}
            <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs font-bold text-slate-600">
              <button type="button" onClick={() => setModalPE(true)} title="Clique para editar valor da Luz" className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-amber-50 hover:text-amber-900 transition-all cursor-pointer border border-transparent hover:border-amber-200"><Zap size={14} className="text-amber-500"/> Luz: <b>{fmtBRL(paramsPE.luz)}</b></button>
              <button type="button" onClick={() => setModalPE(true)} title="Clique para editar valor da Água" className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-blue-50 hover:text-blue-900 transition-all cursor-pointer border border-transparent hover:border-blue-200"><Droplets size={14} className="text-blue-500"/> Água: <b>{fmtBRL(paramsPE.agua)}</b></button>
              <button type="button" onClick={() => setModalPE(true)} title="Clique para editar valor da Internet" className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-indigo-50 hover:text-indigo-900 transition-all cursor-pointer border border-transparent hover:border-indigo-200"><Wifi size={14} className="text-indigo-500"/> Internet: <b>{fmtBRL(paramsPE.internet)}</b></button>
              <button type="button" onClick={() => setModalPE(true)} title="Clique para editar valor do Gás" className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-rose-50 hover:text-rose-900 transition-all cursor-pointer border border-transparent hover:border-rose-200"><Flame size={14} className="text-rose-500"/> Gás: <b>{fmtBRL(paramsPE.gas)}</b></button>
              <button type="button" onClick={() => setModalPE(true)} title="Clique para editar valor do Material de Limpeza" className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-cyan-50 hover:text-cyan-900 transition-all cursor-pointer border border-transparent hover:border-cyan-200"><Sparkles size={14} className="text-cyan-500"/> Limpeza: <b>{fmtBRL(paramsPE.limpeza)}</b></button>
              <button type="button" onClick={() => setModalPE(true)} title="Clique para editar valor de Manutenção" className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-slate-100 hover:text-slate-900 transition-all cursor-pointer border border-transparent hover:border-slate-200"><Wrench size={14} className="text-slate-500"/> Manutenção: <b>{fmtBRL(paramsPE.manutencao)}</b></button>
              <button type="button" onClick={() => setModalPE(true)} title="Clique para editar Gastos Extras" className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-emerald-50 hover:text-emerald-900 transition-all cursor-pointer border border-transparent hover:border-emerald-200"><PackagePlus size={14} className="text-emerald-500"/> Extras: <b>{fmtBRL(paramsPE.gastosExtras)}</b></button>
            </div>
          </div>
        </section>

        {/* CARDS RESUMO FINANCEIRO E FATURAMENTOS */}
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

      {/* MODAL CONFIGURAÇÃO DO PONTO DE EQUILÍBRIO */}
      {modalPE && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/60 p-3 pt-8 backdrop-blur-sm sm:items-center sm:pt-3">
          <div className="w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between bg-slate-900 p-5 text-white">
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-emerald-400">Configuração Financeira</p>
                <h2 className="text-xl font-black">Ajustar Custos Fixos & Dias de Trabalho</h2>
              </div>
              <button type="button" onClick={() => setModalPE(false)} className="grid h-10 w-10 place-items-center rounded-xl bg-white/10 text-white hover:bg-white/20">
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
              <p className="text-xs font-semibold text-slate-500 leading-relaxed">
                Informe os valores médios mensais de cada custo fixo operacional e a quantidade de dias que o restaurante trabalha no mês. O sistema irá dividir estes custos pelos dias e calcular o ponto de equilíbrio exato.
              </p>

              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-600 mb-1.5">
                  Dias de Funcionamento no Mês
                </label>
                <div className="flex gap-2 mb-2">
                  {[20, 24, 26, 30].map(dias => (
                    <button
                      key={dias}
                      type="button"
                      onClick={() => setParamsPE(p => ({ ...p, diasTrabalho: dias }))}
                      className={`h-9 px-3 rounded-lg text-xs font-black transition ${Number(paramsPE.diasTrabalho) === dias ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-700"}`}
                    >
                      {dias} dias
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  min="1"
                  max="31"
                  value={paramsPE.diasTrabalho}
                  onChange={e => setParamsPE({ ...paramsPE, diasTrabalho: Math.max(1, Number(e.target.value)) })}
                  className="w-full h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 font-bold text-slate-900 outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-600 mb-1">⚡ Luz / Energia (R$/mês)</label>
                  <input
                    type="number" step="0.01" value={paramsPE.luz}
                    onChange={e => setParamsPE({ ...paramsPE, luz: e.target.value })}
                    className="w-full h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 font-bold text-slate-900 outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-600 mb-1">💧 Água (R$/mês)</label>
                  <input
                    type="number" step="0.01" value={paramsPE.agua}
                    onChange={e => setParamsPE({ ...paramsPE, agua: e.target.value })}
                    className="w-full h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 font-bold text-slate-900 outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-600 mb-1">🌐 Internet / Telefone (R$/mês)</label>
                  <input
                    type="number" step="0.01" value={paramsPE.internet}
                    onChange={e => setParamsPE({ ...paramsPE, internet: e.target.value })}
                    className="w-full h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 font-bold text-slate-900 outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-600 mb-1">🔥 Gás (R$/mês)</label>
                  <input
                    type="number" step="0.01" value={paramsPE.gas}
                    onChange={e => setParamsPE({ ...paramsPE, gas: e.target.value })}
                    className="w-full h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 font-bold text-slate-900 outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-600 mb-1">🧹 Material de Limpeza (R$/mês)</label>
                  <input
                    type="number" step="0.01" value={paramsPE.limpeza}
                    onChange={e => setParamsPE({ ...paramsPE, limpeza: e.target.value })}
                    className="w-full h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 font-bold text-slate-900 outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-600 mb-1">🛠️ Manutenção (R$/mês)</label>
                  <input
                    type="number" step="0.01" value={paramsPE.manutencao}
                    onChange={e => setParamsPE({ ...paramsPE, manutencao: e.target.value })}
                    className="w-full h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 font-bold text-slate-900 outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-600 mb-1">📦 Gastos Extras (R$/mês)</label>
                  <input
                    type="number" step="0.01" value={paramsPE.gastosExtras}
                    onChange={e => setParamsPE({ ...paramsPE, gastosExtras: e.target.value })}
                    className="w-full h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 font-bold text-slate-900 outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-600 mb-1">🏛️ Imposto Fiscais (%)</label>
                  <input
                    type="number" step="0.1" value={paramsPE.impostoPct}
                    onChange={e => setParamsPE({ ...paramsPE, impostoPct: e.target.value })}
                    className="w-full h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 font-bold text-slate-900 outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-600 mb-1">💳 Taxa Maquininha Cartão (%)</label>
                  <input
                    type="number" step="0.1" value={paramsPE.taxaCartaoPct}
                    onChange={e => setParamsPE({ ...paramsPE, taxaCartaoPct: e.target.value })}
                    className="w-full h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 font-bold text-slate-900 outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="pt-3">
                <button
                  type="button"
                  onClick={() => {
                    salvarParamsPE(paramsPE);
                    setModalPE(false);
                  }}
                  className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-base rounded-2xl transition shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2"
                >
                  <Check size={20} /> Salvar Parâmetros e Recalcular
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE ADICIONAR DESPESA */}
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
