"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useERP } from "../../../context/ERPContext";
import { useTempoReal } from "../../../lib/realtime";
import { fetchEstoque } from "../../../lib/estoque";
import { fetchFornecedores, inserirFornecedor, atualizarFornecedor } from "../../../lib/fornecedores";
import { fetchProducoes } from "../../../lib/producao";
import { fetchPrecosDoInsumo, salvarPrecoFornecedor, escolherFornecedor } from "../../../lib/insumo-fornecedores";
import {
  fetchPedidosCompra,
  criarPedidoCompra,
  atualizarStatusPedidoCompra,
  fetchRecebimentosCompra,
  executarConfirmacaoRecebimentoIntegrado,
  registrarDevolucaoFornecedor
} from "../../../lib/compras.mjs";
import {
  calcularNecessidadeCompra,
  agruparNecessidadesPorFornecedor,
  validarDivergenciaPreco,
  formatarTextoPedidoWhatsApp,
  converterQuantidadeParaEmbalagem
} from "../../../lib/compras-domain";
import {
  ShoppingCart,
  PackagePlus,
  ArrowLeft,
  Sparkles,
  AlertCircle,
  Truck,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Send,
  Printer,
  ChevronRight,
  Building2,
  Scale,
  RefreshCw,
  Search,
  X,
  History,
  RotateCcw
} from "lucide-react";
import { fmtBRL } from "../../../components/ui";

export default function ComprasHubPage() {
  const router = useRouter();
  const { abrirMenu, unidadeAtiva } = useERP();

  // Estados dos Dados Centrais
  const [abaAtiva, setAbaAtiva] = useState("necessidade"); // "necessidade", "pedidos", "recebimento", "fornecedores"
  const [insumos, setInsumos] = useState([]);
  const [fornecedores, setFornecedores] = useState([]);
  const [producoes, setProducoes] = useState([]);
  const [pedidos, setPedidos] = useState([]);
  const [recebimentos, setRecebimentos] = useState([]);
  const [loading, setLoading] = useState(true);

  // Estados da Aba 1 (Necessidade)
  const [itensSelecionadosNecessidade, setItensSelecionadosNecessidade] = useState([]);
  const [filtroAcao, setFiltroAcao] = useState("TODOS"); // "TODOS", "COMPRAR", "PRODUZIR"

  // Estados da Aba 2 (Pedidos)
  const [pedidoDetalhe, setPedidoDetalhe] = useState(null);

  // Estados da Aba 3 (Recebimento)
  const [pedidoParaReceber, setPedidoParaReceber] = useState(null);
  const [numeroNF, setNumeroNF] = useState("");
  const [fornecedorRecebimentoId, setFornecedorRecebimentoId] = useState("");
  const [itensRecebimento, setItensRecebimento] = useState([]);
  const [salvandoRecebimento, setSalvandoRecebimento] = useState(false);

  // Estados da Aba 4 (Fornecedores)
  const [modalFornecedorOpen, setModalFornecedorOpen] = useState(false);
  const [formFornecedor, setFormFornecedor] = useState({ id: "", nome: "", cnpj_cpf: "", telefone: "", email: "", prazo_entrega_dias: 1 });
  const [insumoComparacaoId, setInsumoComparacaoId] = useState("");
  const [precosFornecedorInsumo, setPrecosFornecedorInsumo] = useState([]);

  // Modal Devolução
  const [modalDevolucaoOpen, setModalDevolucaoOpen] = useState(false);
  const [formDevolucao, setFormDevolucao] = useState({ recebimentoId: "", fornecedorId: "", motivo: "", insumoId: "", quantidade: 1, valorUnitario: "" });

  const carregarDados = async (silencioso = false) => {
    if (!silencioso) setLoading(true);
    const [resEstoque, resForn, resProd, resPed, resRec] = await Promise.all([
      fetchEstoque(unidadeAtiva),
      fetchFornecedores(unidadeAtiva),
      fetchProducoes(unidadeAtiva),
      fetchPedidosCompra(unidadeAtiva),
      fetchRecebimentosCompra(unidadeAtiva)
    ]);

    setInsumos(resEstoque.data || []);
    setFornecedores(resForn.data || []);
    setProducoes(resProd.data || []);
    setPedidos(resPed.data || []);
    setRecebimentos(resRec.data || []);
    setLoading(false);
  };

  useEffect(() => {
    if (unidadeAtiva) carregarDados();
  }, [unidadeAtiva]);

  useTempoReal(null, () => carregarDados(true));

  // CÁLCULOS DA ABA 1 (NECESSIDADE DE COMPRA)
  const listaNecessidades = useMemo(() => {
    return calcularNecessidadeCompra(insumos, producoes);
  }, [insumos, producoes]);

  const listaNecessidadesFiltrada = useMemo(() => {
    if (filtroAcao === "TODOS") return listaNecessidades;
    return listaNecessidades.filter(i => i.acao === filtroAcao);
  }, [listaNecessidades, filtroAcao]);

  // AÇÕES DA ABA 1
  const toggleSelecaoNecessidade = (id) => {
    setItensSelecionadosNecessidade(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const selecionarTodosNecessidade = () => {
    const apenasComprar = listaNecessidadesFiltrada.filter(i => i.acao === "COMPRAR").map(i => i.insumo_id);
    if (itensSelecionadosNecessidade.length === apenasComprar.length) {
      setItensSelecionadosNecessidade([]);
    } else {
      setItensSelecionadosNecessidade(apenasComprar);
    }
  };

  const handleGerarPedidosAgrupados = async () => {
    const selecionados = listaNecessidades.filter(i => itensSelecionadosNecessidade.includes(i.insumo_id));
    if (!selecionados.length) return alert("Selecione pelo menos 1 item para gerar pedido.");

    const agrupados = agruparNecessidadesPorFornecedor(selecionados, fornecedores);
    let gerados = 0;

    for (const grupo of agrupados) {
      const res = await criarPedidoCompra({
        unidadeId: unidadeAtiva,
        fornecedorId: grupo.fornecedor_id,
        itens: grupo.itens,
        observacoes: `Gerado automaticamente via Necessidade de Compra em ${new Date().toLocaleDateString("pt-BR")}`
      });
      if (res.success) gerados++;
    }

    alert(`🎉 ${gerados} Pedido(s) de Compra gerado(s) com sucesso!`);
    setItensSelecionadosNecessidade([]);
    await carregarDados();
    setAbaAtiva("pedidos");
  };

  // AÇÕES DA ABA 2 (PEDIDOS)
  const handleEnviarWhatsApp = (ped) => {
    const textoEncoded = formatarTextoPedidoWhatsApp(
      { numero_pedido: ped.numero_pedido, fornecedor_nome: ped.fornecedor?.nome },
      ped.itens || [],
      "HÉFISTO ERP"
    );
    const tel = ped.fornecedor?.telefone ? ped.fornecedor.telefone.replace(/\D/g, "") : "";
    const url = tel ? `https://wa.me/55${tel}?text=${textoEncoded}` : `https://wa.me/?text=${textoEncoded}`;
    window.open(url, "_blank");
    atualizarStatusPedidoCompra(ped.id, "ENVIADO");
    carregarDados(true);
  };

  const iniciarRecebimentoDoPedido = (ped) => {
    setPedidoParaReceber(ped);
    setFornecedorRecebimentoId(ped.fornecedor_id || "");

    const itensIniciais = (ped.itens || []).map(i => ({
      insumo_id: i.insumo_id,
      nome: i.insumo?.nome || "Insumo",
      unidade_medida: i.insumo?.unidade_medida || "un",
      quantidade_embalagem: i.quantidade_pedida_embalagem || 1,
      tamanho_embalagem: i.insumo?.tamanho_embalagem || 1,
      preco_pago: i.preco_unitario_estimado || 0,
      preco_esperado: i.preco_unitario_estimado || 0,
      lote: "",
      validade: "",
      departamento: "cozinha"
    }));

    setItensRecebimento(itensIniciais);
    setAbaAtiva("recebimento");
  };

  // AÇÕES DA ABA 3 (RECEBIMENTO)
  const adicionarInsumoAoRecebimentoAvulso = (insumoId) => {
    const ins = insumos.find(i => i.id === insumoId);
    if (!ins) return;

    if (itensRecebimento.some(i => i.insumo_id === ins.id)) {
      return alert("Este insumo já está na lista de recebimento.");
    }

    setItensRecebimento(prev => [
      ...prev,
      {
        insumo_id: ins.id,
        nome: ins.nome,
        unidade_medida: ins.unidade_medida || "un",
        quantidade_embalagem: 1,
        tamanho_embalagem: Number(ins.tamanho_embalagem) || 1,
        preco_pago: Number(ins.custo_compra) || Number(ins.custo_unitario) || 0,
        preco_esperado: Number(ins.custo_compra) || Number(ins.custo_unitario) || 0,
        lote: "",
        validade: "",
        departamento: ins.departamento || "cozinha"
      }
    ]);
  };

  const atualizarItemRecebimento = (index, campo, valor) => {
    setItensRecebimento(prev => {
      const copia = [...prev];
      copia[index] = { ...copia[index], [campo]: valor };
      return copia;
    });
  };

  const removerItemRecebimento = (index) => {
    setItensRecebimento(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleConfirmarRecebimento = async (e) => {
    e.preventDefault();
    if (!itensRecebimento.length) return alert("Adicione pelo menos um item para receber.");

    setSalvandoRecebimento(true);

    const res = await executarConfirmacaoRecebimentoIntegrado({
      unidadeId: unidadeAtiva,
      pedidoId: pedidoParaReceber?.id || null,
      fornecedorId: fornecedorRecebimentoId || null,
      numeroNF: numeroNF,
      itens: itensRecebimento
    });

    setSalvandoRecebimento(false);

    if (res.error) return alert(`❌ Erro ao confirmar recebimento: ${res.error}`);

    alert(`✅ Recebimento confirmado! R$ ${res.data?.valor_total?.toFixed(2) || '0,00'} adicionados ao Estoque e lançados no Contas a Pagar.`);
    setPedidoParaReceber(null);
    setNumeroNF("");
    setItensRecebimento([]);
    await carregarDados();
  };

  // AÇÕES DA ABA 4 (FORNECEDORES)
  const handleSalvarFornecedor = async (e) => {
    e.preventDefault();
    if (!formFornecedor.nome) return alert("Informe o nome do fornecedor.");

    let res;
    if (formFornecedor.id) {
      res = await atualizarFornecedor(formFornecedor.id, formFornecedor);
    } else {
      res = await inserirFornecedor(formFornecedor, unidadeAtiva);
    }

    if (res.error) return alert(`❌ Erro ao salvar fornecedor: ${res.error}`);

    alert("Fornecedor salvo com sucesso!");
    setModalFornecedorOpen(false);
    setFormFornecedor({ id: "", nome: "", cnpj_cpf: "", telefone: "", email: "", prazo_entrega_dias: 1 });
    carregarDados();
  };

  const carregarPrecosComparativo = async (insumoId) => {
    setInsumoComparacaoId(insumoId);
    if (!insumoId) {
      setPrecosFornecedorInsumo([]);
      return;
    }
    const res = await fetchPrecosDoInsumo(insumoId);
    setPrecosFornecedorInsumo(res.data || []);
  };

  const handleDefinirFornecedorAtivo = async (insumoId, fornecedorId) => {
    const res = await escolherFornecedor({ insumoId, fornecedorId });
    if (res.error) return alert(`❌ Erro ao definir fornecedor ativo: ${res.error}`);
    alert("Fornecedor ativo e preço atualizados no ingrediente!");
    carregarDados();
  };

  // AÇÕES DE DEVOLUÇÃO
  const handleRegistrarDevolucao = async (e) => {
    e.preventDefault();
    if (!formDevolucao.insumoId || !formDevolucao.motivo) return alert("Selecione o insumo e o motivo.");

    const res = await registrarDevolucaoFornecedor({
      unidadeId: unidadeAtiva,
      recebimentoId: formDevolucao.recebimentoId || null,
      fornecedorId: formDevolucao.fornecedorId || null,
      motivo: formDevolucao.motivo,
      itens: [{
        insumo_id: formDevolucao.insumoId,
        quantidade_devolvida_base: Number(formDevolucao.quantidade),
        valor_unitario: parseFloat(formDevolucao.valorUnitario.replace(',', '.')) || 0
      }]
    });

    if (res.error) return alert(`❌ Erro ao registrar devolução: ${res.error}`);

    alert("Devolução registrada com sucesso! Estoque ajustado.");
    setModalDevolucaoOpen(false);
    setFormDevolucao({ recebimentoId: "", fornecedorId: "", motivo: "", insumoId: "", quantidade: 1, valorUnitario: "" });
    carregarDados();
  };

  return (
    <div className="min-h-screen pb-24 font-sans text-slate-800 bg-[var(--surface)]">

      {/* CABEÇALHO SUPERIOR */}
      <div className="bg-slate-900 pt-6 sm:pt-8 pb-8 sm:pb-10 px-4 sm:px-8 shadow-lg text-white">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <button onClick={() => abrirMenu()} className="p-3 bg-slate-800 hover:bg-slate-700 rounded-full transition-colors cursor-pointer">
              <ArrowLeft size={20} />
            </button>
            <div className="hidden sm:flex w-14 h-14 shrink-0 rounded-2xl bg-emerald-500/20 text-emerald-400 items-center justify-center">
              <ShoppingCart size={30} />
            </div>
            <div>
              <h1 className="text-2xl sm:text-4xl font-black tracking-tighter">Hub de Compras & Recebimento</h1>
              <p className="text-subtle font-bold uppercase tracking-widest text-xs mt-1">
                Arquitetura Integrada: Estoque • Lotes • Custos Cascata • Contas a Pagar
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <button
              onClick={() => { setPedidoParaReceber(null); setItensRecebimento([]); setAbaAtiva("recebimento"); }}
              className="flex-1 md:flex-none px-5 py-3.5 bg-emerald-500 hover:bg-emerald-600 text-white font-black rounded-2xl flex items-center justify-center gap-2 shadow-xl shadow-emerald-500/20 active:scale-95 transition-all cursor-pointer text-sm"
            >
              <PackagePlus size={18} /> Nova Conferência (Tablet)
            </button>
          </div>
        </div>

        {/* NAVEGAÇÃO DE ABAS */}
        <div className="max-w-7xl mx-auto mt-8 flex border-b border-slate-800 gap-2 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setAbaAtiva("necessidade")}
            className={`px-5 py-3 font-black text-sm rounded-t-2xl flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
              abaAtiva === "necessidade" ? "bg-[var(--surface)] text-slate-900 border-t-2 border-emerald-500" : "text-slate-400 hover:text-white"
            }`}
          >
            <Sparkles size={16} /> 1. Necessidade de Compra
            {listaNecessidades.length > 0 && (
              <span className="ml-1.5 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-3xs font-bold">
                {listaNecessidades.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setAbaAtiva("pedidos")}
            className={`px-5 py-3 font-black text-sm rounded-t-2xl flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
              abaAtiva === "pedidos" ? "bg-[var(--surface)] text-slate-900 border-t-2 border-emerald-500" : "text-slate-400 hover:text-white"
            }`}
          >
            <FileText size={16} /> 2. Pedidos de Compra
            {pedidos.length > 0 && (
              <span className="ml-1.5 px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 text-3xs font-bold">
                {pedidos.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setAbaAtiva("recebimento")}
            className={`px-5 py-3 font-black text-sm rounded-t-2xl flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
              abaAtiva === "recebimento" ? "bg-[var(--surface)] text-slate-900 border-t-2 border-emerald-500" : "text-slate-400 hover:text-white"
            }`}
          >
            <Truck size={16} /> 3. Recebimento & Conferência
          </button>

          <button
            onClick={() => setAbaAtiva("fornecedores")}
            className={`px-5 py-3 font-black text-sm rounded-t-2xl flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
              abaAtiva === "fornecedores" ? "bg-[var(--surface)] text-slate-900 border-t-2 border-emerald-500" : "text-slate-400 hover:text-white"
            }`}
          >
            <Building2 size={16} /> 4. Fornecedores & Preços
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 mt-6">

        {/* ════════════════════════════════════════════════════════════════════ */}
        {/* ABA 1: NECESSIDADE DE COMPRA */}
        {/* ════════════════════════════════════════════════════════════════════ */}
        {abaAtiva === "necessidade" && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-card p-5 rounded-3xl border border-line shadow-sm">
              <div>
                <h2 className="text-xl font-black text-slate-800">Insumos em Estado de Reposição</h2>
                <p className="text-xs text-subtle font-bold">
                  Sugestão baseada em estoque mínimo e padrões de uso das produções
                </p>
              </div>

              <div className="flex items-center gap-3 w-full md:w-auto">
                <div className="flex bg-slate-100 p-1 rounded-xl">
                  {["TODOS", "COMPRAR", "PRODUZIR"].map(f => (
                    <button
                      key={f}
                      onClick={() => setFiltroAcao(f)}
                      className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all ${
                        filtroAcao === f ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>

                <button
                  onClick={handleGerarPedidosAgrupados}
                  disabled={!itensSelecionadosNecessidade.length}
                  className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-md transition-all cursor-pointer"
                >
                  <Plus size={16} /> Gerar Pedidos ({itensSelecionadosNecessidade.length})
                </button>
              </div>
            </div>

            {loading ? (
              <div className="p-12 text-center text-muted font-bold">Carregando necessidades de compra...</div>
            ) : !listaNecessidadesFiltrada.length ? (
              <div className="p-12 text-center bg-card rounded-3xl border border-line space-y-3">
                <CheckCircle2 size={48} className="mx-auto text-emerald-500" />
                <h3 className="text-lg font-black text-slate-800">Estoque 100% Abastecido!</h3>
                <p className="text-xs text-subtle font-bold">Nenhum ingrediente abaixo do estoque mínimo cadastrado neste momento.</p>
              </div>
            ) : (
              <div className="bg-card rounded-3xl border border-line overflow-hidden shadow-sm">
                <div className="p-4 bg-slate-50 border-b border-line flex items-center justify-between text-xs font-bold text-slate-500">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      onChange={selecionarTodosNecessidade}
                      checked={itensSelecionadosNecessidade.length > 0 && itensSelecionadosNecessidade.length === listaNecessidadesFiltrada.filter(i=>i.acao==="COMPRAR").length}
                      className="w-4 h-4 rounded text-emerald-500 accent-emerald-500 cursor-pointer"
                    />
                    <span>SELECIONAR TODOS PARA PEDIDO</span>
                  </div>
                  <span>TOTAL EM ALERTA: {listaNecessidadesFiltrada.length} ITENS</span>
                </div>

                <div className="divide-y divide-line">
                  {listaNecessidadesFiltrada.map((item) => {
                    const isSelected = itensSelecionadosNecessidade.includes(item.insumo_id);
                    return (
                      <div key={item.insumo_id} className={`p-4 sm:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 hover:bg-slate-50 transition-colors ${isSelected ? "bg-emerald-50/50" : ""}`}>
                        <div className="flex items-start gap-3.5 min-w-0">
                          {item.acao === "COMPRAR" && (
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelecaoNecessidade(item.insumo_id)}
                              className="w-5 h-5 mt-1 rounded text-emerald-500 accent-emerald-500 cursor-pointer"
                            />
                          )}
                          <div>
                            <div className="flex items-center gap-2">
                              <strong className="text-base font-black text-slate-800">{item.nome}</strong>
                              <span className={`px-2.5 py-0.5 rounded-full text-3xs font-black uppercase tracking-wider ${
                                item.acao === "COMPRAR" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                              }`}>
                                {item.acao === "COMPRAR" ? "🛒 COMPRAR" : "🍳 PRODUZIR"}
                              </span>
                            </div>
                            <p className="text-xs text-subtle mt-1">
                              Fornecedor Preferencial: <strong className="text-slate-700">{item.fornecedor_nome}</strong> • Setor: {item.departamento}
                            </p>
                            <div className="mt-2 flex items-center gap-4 text-xs font-medium text-slate-600">
                              <span>Saldo Atual: <strong className="text-red-600">{item.saldo_atual} {item.unidade_medida}</strong></span>
                              <span>Estoque Mín: <strong>{item.estoque_minimo ?? 'N/I'}</strong></span>
                              <span>Estoque Máx: <strong>{item.estoque_maximo ?? 'N/I'}</strong></span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end border-t md:border-t-0 pt-3 md:pt-0 border-line">
                          <div className="text-left md:text-right">
                            <span className="text-xs text-subtle font-bold block">Sugestão de Reposição</span>
                            <strong className="text-lg font-black text-slate-800">
                              +{item.quantidade_sugerida_embalagem} cx/saco(s)
                            </strong>
                            <span className="text-3xs text-slate-500 block">
                              ({item.quantidade_sugerida_base} {item.unidade_medida})
                            </span>
                          </div>

                          {item.custo_estimado_total > 0 && (
                            <div className="text-right pl-4 border-l border-line">
                              <span className="text-xs text-subtle font-bold block">Custo Estimado</span>
                              <strong className="text-base font-black text-emerald-600">
                                {fmtBRL(item.custo_estimado_total)}
                              </strong>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════ */}
        {/* ABA 2: PEDIDOS DE COMPRA */}
        {/* ════════════════════════════════════════════════════════════════════ */}
        {abaAtiva === "pedidos" && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="flex items-center justify-between bg-card p-5 rounded-3xl border border-line shadow-sm">
              <div>
                <h2 className="text-xl font-black text-slate-800">Pedidos de Compra Emitidos</h2>
                <p className="text-xs text-subtle font-bold">Acompanhe o status e envie os pedidos via WhatsApp</p>
              </div>
            </div>

            {!pedidos.length ? (
              <div className="p-12 text-center bg-card rounded-3xl border border-line space-y-3">
                <FileText size={48} className="mx-auto text-slate-400" />
                <h3 className="text-lg font-black text-slate-800">Nenhum Pedido Emitido</h3>
                <p className="text-xs text-subtle font-bold">Gere um pedido na Aba 1 (Necessidade) para iniciar o acompanhamento.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {pedidos.map(ped => (
                  <div key={ped.id} className="bg-card rounded-3xl border border-line p-5 shadow-sm space-y-4 hover:border-slate-300 transition-all">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{ped.numero_pedido}</span>
                        <h3 className="text-lg font-black text-slate-800">{ped.fornecedor?.nome || "Fornecedor Não Informado"}</h3>
                        <p className="text-xs text-subtle">Criado em {new Date(ped.created_at).toLocaleDateString("pt-BR")}</p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-3xs font-black uppercase tracking-wider ${
                        ped.status === "RECEBIDO" ? "bg-emerald-100 text-emerald-800" :
                        ped.status === "ENVIADO" ? "bg-blue-100 text-blue-800" : "bg-amber-100 text-amber-800"
                      }`}>
                        {ped.status}
                      </span>
                    </div>

                    <div className="bg-slate-50 p-3 rounded-2xl text-xs space-y-1">
                      <div className="flex justify-between text-slate-600 font-medium">
                        <span>Total de Itens:</span>
                        <strong className="text-slate-800">{ped.itens?.length || 0} produto(s)</strong>
                      </div>
                      <div className="flex justify-between text-slate-600 font-medium">
                        <span>Valor Total Estimado:</span>
                        <strong className="text-emerald-600 font-black">{fmtBRL(ped.valor_total_estimado)}</strong>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-2 border-t border-line">
                      <button
                        onClick={() => handleEnviarWhatsApp(ped)}
                        className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                      >
                        <Send size={15} /> WhatsApp
                      </button>

                      <button
                        onClick={() => iniciarRecebimentoDoPedido(ped)}
                        className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                      >
                        <Truck size={15} /> Receber Pedido
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════ */}
        {/* ABA 3: RECEBIMENTO & CONFERÊNCIA (TABLET) */}
        {/* ════════════════════════════════════════════════════════════════════ */}
        {abaAtiva === "recebimento" && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="bg-gradient-to-br from-slate-900 to-slate-950 text-white p-6 rounded-3xl shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <span className="text-3xs font-black uppercase tracking-widest text-emerald-400 bg-emerald-500/20 px-3 py-1 rounded-full border border-emerald-500/30">
                  Modo Tablet / Conferência na Entrega
                </span>
                <h2 className="text-2xl font-black text-white mt-2">
                  {pedidoParaReceber ? `Conferência do Pedido: ${pedidoParaReceber.numero_pedido}` : "Recebimento de Mercadoria (Avulso)"}
                </h2>
                <p className="text-xs text-slate-400">Verifique os preços da Nota Fiscal e informe lote/validade</p>
              </div>

              {pedidoParaReceber && (
                <button
                  onClick={() => { setPedidoParaReceber(null); setItensRecebimento([]); }}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition-all cursor-pointer"
                >
                  Alternar para Recebimento Avulso
                </button>
              )}
            </div>

            {/* DADOS GERAIS DA NOTA */}
            <div className="bg-card rounded-3xl border border-line p-5 shadow-sm space-y-4">
              <h3 className="font-black text-slate-800 text-base">1. Identificação do Recebimento</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-muted uppercase block mb-1.5">Fornecedor</label>
                  <select
                    value={fornecedorRecebimentoId}
                    onChange={e => setFornecedorRecebimentoId(e.target.value)}
                    className="w-full p-3.5 bg-slate-50 border border-line rounded-2xl font-bold text-slate-800 outline-none focus:border-emerald-500 text-sm"
                  >
                    <option value="">-- Selecione o Fornecedor --</option>
                    {fornecedores.map(f => (
                      <option key={f.id} value={f.id}>{f.nome}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-muted uppercase block mb-1.5">Número da Nota Fiscal (NF)</label>
                  <input
                    type="text"
                    placeholder="Ex: 104592"
                    value={numeroNF}
                    onChange={e => setNumeroNF(e.target.value)}
                    className="w-full p-3.5 bg-slate-50 border border-line rounded-2xl font-bold text-slate-800 outline-none focus:border-emerald-500 text-sm"
                  />
                </div>
              </div>

              {!pedidoParaReceber && (
                <div className="pt-3 border-t border-line">
                  <label className="text-xs font-bold text-muted uppercase block mb-1.5">Adicionar Insumo ao Recebimento</label>
                  <select
                    onChange={e => { if (e.target.value) { adicionarInsumoAoRecebimentoAvulso(e.target.value); e.target.value = ""; } }}
                    className="w-full p-3.5 bg-emerald-50/50 border border-emerald-200 rounded-2xl font-bold text-emerald-900 outline-none focus:border-emerald-500 text-sm"
                  >
                    <option value="">-- Clique para Selecionar o Insumo Que Chegou --</option>
                    {insumos.map(i => (
                      <option key={i.id} value={i.id}>{i.nome} ({i.unidade_medida})</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* TABELA DE ITENS CHEGANDO */}
            <div className="bg-card rounded-3xl border border-line p-5 shadow-sm space-y-4">
              <h3 className="font-black text-slate-800 text-base">2. Conferência de Quantidade, Preço e Validade</h3>

              {!itensRecebimento.length ? (
                <p className="text-center py-8 font-bold text-muted text-sm">Nenhum item adicionado ao recebimento ainda.</p>
              ) : (
                <div className="space-y-4">
                  {itensRecebimento.map((item, idx) => {
                    const div = validarDivergenciaPreco(item.preco_esperado, item.preco_pago);
                    return (
                      <div key={idx} className="p-4 rounded-2xl bg-slate-50 border border-line space-y-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <strong className="text-base font-black text-slate-800">{item.nome}</strong>
                            <span className="text-xs text-subtle block">Embalagem Base: {item.tamanho_embalagem} {item.unidade_medida}</span>
                          </div>

                          <button onClick={() => removerItemRecebimento(idx)} className="text-red-500 hover:text-red-700 text-xs font-bold cursor-pointer">
                            Remover
                          </button>
                        </div>

                        {div.divergencia && (
                          <div className={`p-2.5 rounded-xl text-xs font-bold ${
                            div.nivel === "critico" ? "bg-red-100 text-red-800 border border-red-200" : "bg-amber-100 text-amber-800 border border-amber-200"
                          }`}>
                            {div.mensagem}
                          </div>
                        )}

                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                          <div>
                            <label className="text-3xs font-bold text-muted uppercase block mb-1">Qtd Entregue (Emb.)</label>
                            <input
                              type="number"
                              step="0.01"
                              value={item.quantidade_embalagem}
                              onChange={e => atualizarItemRecebimento(idx, "quantidade_embalagem", parseFloat(e.target.value) || 0)}
                              className="w-full p-2.5 bg-white border border-line rounded-xl font-bold text-slate-800 text-sm"
                            />
                          </div>

                          <div>
                            <label className="text-3xs font-bold text-muted uppercase block mb-1">Preço Pago Emb. (R$)</label>
                            <input
                              type="number"
                              step="0.01"
                              value={item.preco_pago}
                              onChange={e => atualizarItemRecebimento(idx, "preco_pago", parseFloat(e.target.value) || 0)}
                              className="w-full p-2.5 bg-white border border-line rounded-xl font-black text-emerald-600 text-sm"
                            />
                          </div>

                          <div>
                            <label className="text-3xs font-bold text-muted uppercase block mb-1">Nº do Lote</label>
                            <input
                              type="text"
                              placeholder="Ex: L2026-A"
                              value={item.lote}
                              onChange={e => atualizarItemRecebimento(idx, "lote", e.target.value)}
                              className="w-full p-2.5 bg-white border border-line rounded-xl font-medium text-slate-800 text-sm"
                            />
                          </div>

                          <div>
                            <label className="text-3xs font-bold text-muted uppercase block mb-1">Data de Validade</label>
                            <input
                              type="date"
                              value={item.validade}
                              onChange={e => atualizarItemRecebimento(idx, "validade", e.target.value)}
                              className="w-full p-2.5 bg-white border border-line rounded-xl font-medium text-slate-800 text-sm"
                            />
                          </div>

                          <div>
                            <label className="text-3xs font-bold text-muted uppercase block mb-1">Setor Destino</label>
                            <select
                              value={item.departamento}
                              onChange={e => atualizarItemRecebimento(idx, "departamento", e.target.value)}
                              className="w-full p-2.5 bg-white border border-line rounded-xl font-bold text-slate-800 text-sm"
                            >
                              <option value="cozinha">Cozinha</option>
                              <option value="bar">Bar</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {itensRecebimento.length > 0 && (
                <div className="pt-4 border-t border-line flex flex-col md:flex-row items-center justify-between gap-4">
                  <div className="text-left">
                    <span className="text-xs font-bold text-subtle block">Valor Total da Nota Fiscal:</span>
                    <strong className="text-2xl font-black text-emerald-600">
                      {fmtBRL(itensRecebimento.reduce((s, i) => s + ((i.quantidade_embalagem || 0) * (i.preco_pago || 0)), 0))}
                    </strong>
                  </div>

                  <div className="flex items-center gap-3 w-full md:w-auto">
                    <button
                      onClick={() => setModalDevolucaoOpen(true)}
                      className="px-4 py-3 bg-red-100 hover:bg-red-200 text-red-800 font-bold text-xs rounded-2xl flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <RotateCcw size={16} /> Registrar Devolução
                    </button>

                    <button
                      onClick={handleConfirmarRecebimento}
                      disabled={salvandoRecebimento}
                      className="px-6 py-4 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-black text-sm rounded-2xl flex items-center gap-2 shadow-xl shadow-emerald-500/20 active:scale-95 transition-all cursor-pointer"
                    >
                      <CheckCircle2 size={18} /> {salvandoRecebimento ? "Confirmando RPC..." : "Confirmar Recebimento Integrado"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════ */}
        {/* ABA 4: FORNECEDORES & COMPARADOR DE PREÇOS */}
        {/* ════════════════════════════════════════════════════════════════════ */}
        {abaAtiva === "fornecedores" && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="flex items-center justify-between bg-card p-5 rounded-3xl border border-line shadow-sm">
              <div>
                <h2 className="text-xl font-black text-slate-800">Catálogo de Fornecedores & Preços</h2>
                <p className="text-xs text-subtle font-bold">Compare valores normalizados entre distribuidores</p>
              </div>

              <button
                onClick={() => { setFormFornecedor({ id: "", nome: "", cnpj_cpf: "", telefone: "", email: "", prazo_entrega_dias: 1 }); setModalFornecedorOpen(true); }}
                className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-md transition-all cursor-pointer"
              >
                <Plus size={16} /> Cadastrar Fornecedor
              </button>
            </div>

            {/* COMPARADOR MULTI-FORNECEDOR DE UM INSUMO */}
            <div className="bg-card rounded-3xl border border-line p-5 shadow-sm space-y-4">
              <h3 className="font-black text-slate-800 text-base">Comparador de Preços por Insumo</h3>

              <select
                value={insumoComparacaoId}
                onChange={e => carregarPrecosComparativo(e.target.value)}
                className="w-full p-3.5 bg-slate-50 border border-line rounded-2xl font-bold text-slate-800 outline-none focus:border-emerald-500 text-sm"
              >
                <option value="">-- Selecione um Insumo para Comparar Fornecedores --</option>
                {insumos.map(i => (
                  <option key={i.id} value={i.id}>{i.nome} ({i.unidade_medida})</option>
                ))}
              </select>

              {insumoComparacaoId && (
                <div className="pt-2">
                  {!precosFornecedorInsumo.length ? (
                    <p className="text-xs font-bold text-muted py-4">Nenhum preço por fornecedor cadastrado para este ingrediente.</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {precosFornecedorInsumo.map(pf => (
                        <div key={pf.id} className="p-4 rounded-2xl bg-slate-50 border border-line flex items-center justify-between">
                          <div>
                            <strong className="text-sm font-black text-slate-800">{pf.fornecedor?.nome}</strong>
                            <p className="text-xs text-subtle mt-0.5">
                              {fmtBRL(pf.preco)} por embalagem de {pf.tamanho_embalagem} {pf.unidade_embalagem || 'un'}
                            </p>
                            <span className="text-3xs font-bold text-emerald-600 block mt-1">
                              Custo Normalizado: {fmtBRL(pf.preco_normalizado)}/unidade base
                            </span>
                          </div>

                          <button
                            onClick={() => handleDefinirFornecedorAtivo(insumoComparacaoId, pf.fornecedor_id)}
                            className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs rounded-xl transition-all cursor-pointer"
                          >
                            Definir Ativo
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* LISTA DE FORNECEDORES */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {fornecedores.map(f => (
                <div key={f.id} className="bg-card rounded-3xl border border-line p-5 shadow-sm space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-lg font-black text-slate-800">{f.nome}</h3>
                      <p className="text-xs text-subtle">{f.cnpj_cpf || "Sem CNPJ"}</p>
                    </div>

                    <button
                      onClick={() => { setFormFornecedor(f); setModalFornecedorOpen(true); }}
                      className="text-xs font-bold text-emerald-600 hover:text-emerald-700 cursor-pointer"
                    >
                      Editar
                    </button>
                  </div>

                  <div className="text-xs text-slate-600 space-y-1 bg-slate-50 p-3 rounded-2xl">
                    <p><strong>Tel:</strong> {f.telefone || "Não informado"}</p>
                    <p><strong>E-mail:</strong> {f.email || "Não informado"}</p>
                    <p><strong>Prazo Entrega:</strong> {f.prazo_entrega_dias || 1} dia(s)</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* MODAL CADASTRO FORNECEDOR */}
      {modalFornecedorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-card rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-xl font-black text-slate-800">
              {formFornecedor.id ? "Editar Fornecedor" : "Novo Fornecedor"}
            </h3>

            <form onSubmit={handleSalvarFornecedor} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-muted uppercase block mb-1">Nome do Fornecedor</label>
                <input required type="text" value={formFornecedor.nome} onChange={e => setFormFornecedor({ ...formFornecedor, nome: e.target.value })} className="w-full p-3 bg-slate-50 border border-line rounded-xl font-bold text-slate-800 text-sm" />
              </div>

              <div>
                <label className="text-xs font-bold text-muted uppercase block mb-1">CNPJ / CPF</label>
                <input type="text" value={formFornecedor.cnpj_cpf} onChange={e => setFormFornecedor({ ...formFornecedor, cnpj_cpf: e.target.value })} className="w-full p-3 bg-slate-50 border border-line rounded-xl font-medium text-slate-800 text-sm" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-muted uppercase block mb-1">Telefone / WhatsApp</label>
                  <input type="text" value={formFornecedor.telefone} onChange={e => setFormFornecedor({ ...formFornecedor, telefone: e.target.value })} className="w-full p-3 bg-slate-50 border border-line rounded-xl font-medium text-slate-800 text-sm" />
                </div>

                <div>
                  <label className="text-xs font-bold text-muted uppercase block mb-1">Prazo Entrega (dias)</label>
                  <input type="number" value={formFornecedor.prazo_entrega_dias} onChange={e => setFormFornecedor({ ...formFornecedor, prazo_entrega_dias: parseInt(e.target.value) || 1 })} className="w-full p-3 bg-slate-50 border border-line rounded-xl font-bold text-slate-800 text-sm" />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setModalFornecedorOpen(false)} className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm rounded-xl transition-all cursor-pointer">Cancelar</button>
                <button type="submit" className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm rounded-xl transition-all cursor-pointer">Salvar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DEVOLUÇÃO */}
      {modalDevolucaoOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-card rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-xl font-black text-slate-800">Registrar Devolução ao Fornecedor</h3>

            <form onSubmit={handleRegistrarDevolucao} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-muted uppercase block mb-1">Insumo Recusado/Devolvido</label>
                <select required value={formDevolucao.insumoId} onChange={e => setFormDevolucao({ ...formDevolucao, insumoId: e.target.value })} className="w-full p-3 bg-slate-50 border border-line rounded-xl font-bold text-slate-800 text-sm">
                  <option value="">-- Selecione o Insumo --</option>
                  {insumos.map(i => <option key={i.id} value={i.id}>{i.nome}</option>)}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-muted uppercase block mb-1">Motivo da Devolução</label>
                <input required type="text" placeholder="Ex: Produto avariado / Embalagem rasgada" value={formDevolucao.motivo} onChange={e => setFormDevolucao({ ...formDevolucao, motivo: e.target.value })} className="w-full p-3 bg-slate-50 border border-line rounded-xl font-medium text-slate-800 text-sm" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-muted uppercase block mb-1">Qtd Devolvida</label>
                  <input required type="number" step="0.01" value={formDevolucao.quantidade} onChange={e => setFormDevolucao({ ...formDevolucao, quantidade: e.target.value })} className="w-full p-3 bg-slate-50 border border-line rounded-xl font-bold text-slate-800 text-sm" />
                </div>

                <div>
                  <label className="text-xs font-bold text-muted uppercase block mb-1">Valor Unitário (R$)</label>
                  <input type="text" placeholder="50,00" value={formDevolucao.valorUnitario} onChange={e => setFormDevolucao({ ...formDevolucao, valorUnitario: e.target.value })} className="w-full p-3 bg-slate-50 border border-line rounded-xl font-black text-emerald-600 text-sm" />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setModalDevolucaoOpen(false)} className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm rounded-xl transition-all cursor-pointer">Cancelar</button>
                <button type="submit" className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-bold text-sm rounded-xl transition-all cursor-pointer">Confirmar Devolução</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
