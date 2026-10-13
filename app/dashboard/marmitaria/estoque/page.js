"use client";

import { useState, useEffect, useMemo } from "react";
import { useERP } from "../../../context/ERPContext";
import {
  Boxes,
  Package,
  ArrowRightLeft,
  Search,
  AlertTriangle,
  Plus,
  CheckCircle2,
  Filter,
  History,
  Layers,
  Sparkles,
  X,
  FileSpreadsheet,
  ChefHat,
  UtensilsCrossed,
  ArrowDownToLine,
  Trash2,
  Edit3,
  Scale,
  CheckSquare,
  Square,
  RefreshCw,
} from "lucide-react";
import { fmtBRL } from "../../../components/ui";
import {
  fetchInsumosEstoque,
  fetchTodosInsumosDoRestaurante,
  salvarInsumoMarmitaria,
  migrarInsumosParaMarmitaria,
  excluirInsumoMarmitaria,
  fetchEmbalagensMarmitaria,
  salvarEmbalagemMarmitaria,
  atualizarEstoqueEmbalagem,
  excluirEmbalagemMarmitaria,
  fetchPreparacoesBase,
  salvarPrePreparoMarmitaria,
  excluirPrePreparo,
  fetchTransferenciasEstoque,
  registrarTransferenciaEstoque,
} from "../../../lib/marmitaria/marmitaria-service";
import {
  CATEGORIAS_ESTOQUE_MARMITARIA,
} from "../../../lib/marmitaria/marmitaria-calculos.mjs";

export default function MarmitariaEstoquePage() {
  const { unidadeAtiva } = useERP();

  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);

  // Dados das 4 frentes
  const [insumos, setInsumos] = useState([]);
  const [todosInsumosGerais, setTodosInsumosGerais] = useState([]);
  const [embalagens, setEmbalagens] = useState([]);
  const [prePreparos, setPrePreparos] = useState([]);
  const [transferencias, setTransferencias] = useState([]);

  // Navegação e filtros
  const [abaPrincipal, setAbaPrincipal] = useState("insumos"); // 'insumos' | 'embalagens' | 'prepreparos' | 'transferencias'
  const [categoriaAtiva, setCategoriaAtiva] = useState("todas");
  const [busca, setBusca] = useState("");

  // ─── MODAIS ─────────────────────────────────────────────────────────────────
  // 1. Insumo
  const [modalInsumo, setModalInsumo] = useState(false);
  const [formInsumo, setFormInsumo] = useState({
    id: null,
    nome: "",
    categoria: "Proteínas",
    unidade_medida: "kg",
    custo_unitario: 25.0,
    quantidade_atual: 10,
    estoque_minimo: 5,
  });

  // 2. Migrar Insumos do Restaurante Central
  const [modalMigrar, setModalMigrar] = useState(false);
  const [buscaMigrar, setBuscaMigrar] = useState("");
  const [selecionadosMigrar, setSelecionadosMigrar] = useState([]);

  // 3. Embalagem
  const [modalEmbalagem, setModalEmbalagem] = useState(false);
  const [formEmbalagem, setFormEmbalagem] = useState({
    id: null,
    nome: "",
    tipo_embalagem: "marmita", // marmita, tampa, sacola, lacre, talher, pote, guardanapo, outro
    modoPreco: "unitario", // 'unitario' | 'caixa'
    custo_unitario: 1.25,
    custoCaixa: 125.0,
    unidadesPorCaixa: 100,
    quantidade_atual: 150,
    estoque_minimo: 30,
    unidade_medida: "un",
  });

  // 4. Pré-preparos (Receitas Base)
  const [modalPrePreparo, setModalPrePreparo] = useState(false);
  const [formPrePreparo, setFormPrePreparo] = useState({
    id: null,
    nome_receita: "",
    categoria: "Guarnições",
    departamento: "marmitaria",
    rendimento: 5.0,
    rendimento_unidade: "kg",
    custo_total: 45.0,
    tempo_preparo_min: 40,
    instrucoes_preparo: "",
  });

  // 5. Ajuste rápido de quantidade em estoque
  const [modalAjusteQtd, setModalAjusteQtd] = useState(null); // { item, tipo: 'embalagem' | 'insumo', quantidade }

  // 6. Transferência Interna
  const [modalTransferir, setModalTransferir] = useState(false);
  const [formTransf, setFormTransf] = useState({
    insumo_id: "",
    quantidade: 5,
    unidade_medida: "kg",
    origem: "cozinha_principal",
    destino: "marmitaria",
    observacao: "Transferência para produção de marmitas",
  });

  // 7. Conversão de Caixa
  const [modalConversao, setModalConversao] = useState(false);
  const [formConversao, setFormConversao] = useState({
    nome: "Caixa Marmita com Divisória (100 un)",
    tipoEmbalagem: "caixa",
    fatorConversao: 100,
    quantidadeComprada: 5,
    custoTotalCaixa: 110.0,
  });

  // ─── CARREGAR DADOS ─────────────────────────────────────────────────────────
  const carregarDados = async () => {
    setLoading(true);
    try {
      const uId = unidadeAtiva?.id || "matriz";
      const [resInsumos, resEmbs, resPreps, resTransf, resTodos] = await Promise.all([
        fetchInsumosEstoque(uId),
        fetchEmbalagensMarmitaria(uId),
        fetchPreparacoesBase(uId),
        fetchTransferenciasEstoque(uId),
        fetchTodosInsumosDoRestaurante(uId),
      ]);

      setInsumos(resInsumos.data || []);
      setEmbalagens(resEmbs.data || []);
      setPrePreparos(resPreps.data || []);
      setTransferencias(resTransf.data || []);
      setTodosInsumosGerais(resTodos.data || []);

      if (resInsumos.data?.[0]) {
        setFormTransf((prev) => ({
          ...prev,
          insumo_id: resInsumos.data[0].id,
          unidade_medida: resInsumos.data[0].unidade_medida || "kg",
        }));
      }
    } catch (e) {
      console.error("Erro ao carregar estoque da marmitaria:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarDados();
  }, [unidadeAtiva]);

  // ─── FILTROS ────────────────────────────────────────────────────────────────
  const insumosFiltrados = useMemo(() => {
    return insumos.filter((item) => {
      const matchBusca =
        !busca ||
        item.nome?.toLowerCase().includes(busca.toLowerCase()) ||
        item.categoria?.toLowerCase().includes(busca.toLowerCase());
      const matchCat = categoriaAtiva === "todas" || item.categoria === categoriaAtiva;
      return matchBusca && matchCat;
    });
  }, [insumos, busca, categoriaAtiva]);

  const embalagensFiltradas = useMemo(() => {
    return embalagens.filter((item) => {
      return (
        !busca ||
        item.nome?.toLowerCase().includes(busca.toLowerCase()) ||
        item.categoria?.toLowerCase().includes(busca.toLowerCase())
      );
    });
  }, [embalagens, busca]);

  const prePreparosFiltrados = useMemo(() => {
    return prePreparos.filter((item) => {
      return (
        !busca ||
        item.nome_receita?.toLowerCase().includes(busca.toLowerCase()) ||
        item.categoria?.toLowerCase().includes(busca.toLowerCase())
      );
    });
  }, [prePreparos, busca]);

  // Lista para o modal de migração (filtra insumos gerais que ainda não estão marcados na marmitaria)
  const insumosParaMigrar = useMemo(() => {
    return todosInsumosGerais.filter((item) => {
      if (buscaMigrar) {
        return (
          item.nome?.toLowerCase().includes(buscaMigrar.toLowerCase()) ||
          item.categoria?.toLowerCase().includes(buscaMigrar.toLowerCase())
        );
      }
      return true;
    });
  }, [todosInsumosGerais, buscaMigrar]);

  // ─── AÇÕES DE INSUMOS ───────────────────────────────────────────────────────
  const handleAbrirNovoInsumo = () => {
    setFormInsumo({
      id: null,
      nome: "",
      categoria: "Proteínas",
      unidade_medida: "kg",
      custo_unitario: 25.0,
      quantidade_atual: 10,
      estoque_minimo: 5,
    });
    setModalInsumo(true);
  };

  const handleEditarInsumo = (item) => {
    setFormInsumo({
      id: item.id,
      nome: item.nome,
      categoria: item.categoria || "Proteínas",
      unidade_medida: item.unidade_medida || "kg",
      custo_unitario: item.custo_unitario || 0,
      quantidade_atual: item.quantidade_atual || 0,
      estoque_minimo: item.estoque_minimo || 5,
    });
    setModalInsumo(true);
  };

  const handleSalvarInsumo = async () => {
    if (!formInsumo.nome.trim()) {
      alert("Por favor, preencha o nome do insumo.");
      return;
    }
    setSalvando(true);
    try {
      const uId = unidadeAtiva?.id || "matriz";
      const res = await salvarInsumoMarmitaria(uId, formInsumo);
      if (res.error) alert("Erro ao salvar insumo: " + res.error);
      else {
        setModalInsumo(false);
        carregarDados();
      }
    } catch (e) {
      alert("Erro ao salvar: " + e.message);
    } finally {
      setSalvando(false);
    }
  };

  const handleExcluirInsumo = async (id, nome) => {
    if (!confirm(`Deseja remover o insumo "${nome}" da Marmitaria?`)) return;
    try {
      const res = await excluirInsumoMarmitaria(id);
      if (res.error) alert("Erro ao remover: " + res.error);
      else carregarDados();
    } catch (e) {
      alert("Erro ao remover: " + e.message);
    }
  };

  const handleExecutarMigracao = async () => {
    if (selecionadosMigrar.length === 0) {
      alert("Selecione pelo menos um insumo para adicionar à Marmitaria.");
      return;
    }
    setSalvando(true);
    try {
      const uId = unidadeAtiva?.id || "matriz";
      const res = await migrarInsumosParaMarmitaria(uId, selecionadosMigrar);
      if (res.error) alert("Erro na migração: " + res.error);
      else {
        alert(`${selecionadosMigrar.length} insumo(s) integrados à Marmitaria com sucesso!`);
        setModalMigrar(false);
        setSelecionadosMigrar([]);
        carregarDados();
      }
    } catch (e) {
      alert("Erro ao migrar: " + e.message);
    } finally {
      setSalvando(false);
    }
  };

  // ─── AÇÕES DE EMBALAGENS ────────────────────────────────────────────────────
  const handleAbrirNovaEmbalagem = () => {
    setFormEmbalagem({
      id: null,
      nome: "",
      tipo_embalagem: "marmita",
      modoPreco: "unitario",
      custo_unitario: 1.25,
      custoCaixa: 125.0,
      unidadesPorCaixa: 100,
      quantidade_atual: 150,
      estoque_minimo: 30,
      unidade_medida: "un",
    });
    setModalEmbalagem(true);
  };

  const handleEditarEmbalagem = (emb) => {
    setFormEmbalagem({
      id: emb.id,
      nome: emb.nome,
      tipo_embalagem: emb.categoria || "marmita",
      modoPreco: "unitario",
      custo_unitario: emb.custo_unitario || 1.0,
      custoCaixa: (emb.custo_unitario || 1.0) * 100,
      unidadesPorCaixa: 100,
      quantidade_atual: emb.quantidade_atual || 50,
      estoque_minimo: emb.estoque_minimo || 20,
      unidade_medida: "un",
    });
    setModalEmbalagem(true);
  };

  const handleSalvarEmbalagem = async () => {
    if (!formEmbalagem.nome.trim()) {
      alert("Por favor, informe o nome da embalagem.");
      return;
    }

    let custoFinal = Number(formEmbalagem.custo_unitario) || 0;
    if (formEmbalagem.modoPreco === "caixa") {
      const caixa = Number(formEmbalagem.custoCaixa) || 0;
      const un = Number(formEmbalagem.unidadesPorCaixa) || 1;
      custoFinal = un > 0 ? +(caixa / un).toFixed(4) : caixa;
    }

    setSalvando(true);
    try {
      const uId = unidadeAtiva?.id || "matriz";
      const payload = {
        ...formEmbalagem,
        custo_unitario: custoFinal,
      };
      const res = await salvarEmbalagemMarmitaria(uId, payload);
      if (res.error) alert("Erro ao salvar embalagem: " + res.error);
      else {
        setModalEmbalagem(false);
        carregarDados();
      }
    } catch (e) {
      alert("Erro ao salvar: " + e.message);
    } finally {
      setSalvando(false);
    }
  };

  const handleExcluirEmbalagem = async (id, nome) => {
    if (!confirm(`Deseja excluir a embalagem "${nome}"?`)) return;
    try {
      const res = await excluirEmbalagemMarmitaria(id);
      if (res.error) alert("Erro ao remover: " + res.error);
      else carregarDados();
    } catch (e) {
      alert("Erro ao remover: " + e.message);
    }
  };

  const handleAjustarEstoqueRapido = async (item, tipo, novaQtd) => {
    try {
      const uId = unidadeAtiva?.id || "matriz";
      const res = await atualizarEstoqueEmbalagem(uId, item.id, novaQtd);
      if (res.error) alert("Erro ao ajustar estoque: " + res.error);
      else carregarDados();
    } catch (e) {
      alert("Erro ao ajustar: " + e.message);
    }
  };

  // ─── AÇÕES DE PRÉ-PREPAROS ──────────────────────────────────────────────────
  const handleAbrirNovoPrePreparo = () => {
    setFormPrePreparo({
      id: null,
      nome_receita: "",
      categoria: "Guarnições",
      departamento: "marmitaria",
      rendimento: 5.0,
      rendimento_unidade: "kg",
      custo_total: 45.0,
      tempo_preparo_min: 40,
      instrucoes_preparo: "",
    });
    setModalPrePreparo(true);
  };

  const handleEditarPrePreparo = (prep) => {
    setFormPrePreparo({
      id: prep.id,
      nome_receita: prep.nome_receita,
      categoria: prep.categoria || "Pré-preparo",
      departamento: prep.departamento || "marmitaria",
      rendimento: Number(prep.rendimento) || 1,
      rendimento_unidade: prep.rendimento_unidade || "kg",
      custo_total: Number(prep.custo_total) || 0,
      tempo_preparo_min: Number(prep.tempo_preparo_min) || 30,
      instrucoes_preparo: prep.instrucoes_preparo || "",
    });
    setModalPrePreparo(true);
  };

  const handleSalvarPrePreparo = async () => {
    if (!formPrePreparo.nome_receita.trim()) {
      alert("Informe o nome do pré-preparo (ex: Arroz Branco Cozido).");
      return;
    }
    setSalvando(true);
    try {
      const uId = unidadeAtiva?.id || "matriz";
      const res = await salvarPrePreparoMarmitaria(uId, formPrePreparo);
      if (res.error) alert("Erro ao salvar pré-preparo: " + res.error);
      else {
        setModalPrePreparo(false);
        carregarDados();
      }
    } catch (e) {
      alert("Erro ao salvar: " + e.message);
    } finally {
      setSalvando(false);
    }
  };

  const handleExcluirPrePreparo = async (id, nome) => {
    if (!confirm(`Deseja remover o pré-preparo "${nome}"?`)) return;
    try {
      const res = await excluirPrePreparo(id);
      if (res.error) alert("Erro ao remover: " + res.error);
      else carregarDados();
    } catch (e) {
      alert("Erro ao remover: " + e.message);
    }
  };

  // ─── TRANSFERÊNCIA INTERNA ──────────────────────────────────────────────────
  const handleSalvarTransferencia = async () => {
    if (!formTransf.insumo_id) {
      alert("Selecione o insumo para transferir.");
      return;
    }

    setSalvando(true);
    try {
      const uId = unidadeAtiva?.id || "matriz";
      const res = await registrarTransferenciaEstoque(uId, formTransf);
      if (res.error) alert("Erro ao transferir: " + res.error);
      else {
        alert("Transferência interna registrada com sucesso!");
        setModalTransferir(false);
        carregarDados();
      }
    } catch (e) {
      alert("Erro ao transferir: " + e.message);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Topo do Estoque */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-hf-surface p-6 rounded-3xl border border-hf-border shadow-sm">
        <div>
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-emerald-700 mb-1">
            <Boxes size={14} /> Centro de Recursos & Insumos
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Insumos, Embalagens & Pré-preparos
          </h1>
          <p className="text-sm font-medium text-slate-500 mt-0.5">
            Gerenciamento completo de insumos alimentícios, controle de estoque de embalagens e receitas base de pré-preparo.
          </p>
        </div>

        {/* Ações Rápidas do Topo dependendo da aba ativa */}
        <div className="flex flex-wrap items-center gap-3">
          {abaPrincipal === "insumos" && (
            <>
              <button
                onClick={() => setModalMigrar(true)}
                className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold px-4 py-2.5 rounded-2xl transition-all"
              >
                <ArrowDownToLine size={15} /> Migrar do Estoque Geral
              </button>
              <button
                onClick={handleAbrirNovoInsumo}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2.5 rounded-2xl shadow-sm shadow-emerald-600/30 transition-all active:scale-95"
              >
                <Plus size={15} /> Cadastrar Insumo
              </button>
            </>
          )}

          {abaPrincipal === "embalagens" && (
            <>
              <button
                onClick={() => setModalConversao(true)}
                className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold px-4 py-2.5 rounded-2xl transition-all"
              >
                <Package size={15} /> Conversor Cx → Un
              </button>
              <button
                onClick={handleAbrirNovaEmbalagem}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2.5 rounded-2xl shadow-sm shadow-emerald-600/30 transition-all active:scale-95"
              >
                <Plus size={15} /> Cadastrar Embalagem
              </button>
            </>
          )}

          {abaPrincipal === "prepreparos" && (
            <button
              onClick={handleAbrirNovoPrePreparo}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2.5 rounded-2xl shadow-sm shadow-emerald-600/30 transition-all active:scale-95"
            >
              <Plus size={15} /> Novo Pré-preparo
            </button>
          )}

          {abaPrincipal === "transferencias" && (
            <button
              onClick={() => setModalTransferir(true)}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2.5 rounded-2xl shadow-sm shadow-emerald-600/30 transition-all active:scale-95"
            >
              <ArrowRightLeft size={15} /> Nova Transferência
            </button>
          )}
        </div>
      </div>

      {/* 4 Abas Principais */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto no-scrollbar">
        <button
          onClick={() => {
            setAbaPrincipal("insumos");
            setBusca("");
          }}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
            abaPrincipal === "insumos"
              ? "bg-slate-900 text-white shadow-sm"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <Boxes size={14} /> Insumos Alimentícios ({insumos.length})
        </button>
        <button
          onClick={() => {
            setAbaPrincipal("embalagens");
            setBusca("");
          }}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
            abaPrincipal === "embalagens"
              ? "bg-slate-900 text-white shadow-sm"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <Package size={14} /> Embalagens & Descartáveis ({embalagens.length})
        </button>
        <button
          onClick={() => {
            setAbaPrincipal("prepreparos");
            setBusca("");
          }}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
            abaPrincipal === "prepreparos"
              ? "bg-slate-900 text-white shadow-sm"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <ChefHat size={14} /> Pré-preparos & Fichas Base ({prePreparos.length})
        </button>
        <button
          onClick={() => {
            setAbaPrincipal("transferencias");
            setBusca("");
          }}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
            abaPrincipal === "transferencias"
              ? "bg-slate-900 text-white shadow-sm"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <ArrowRightLeft size={14} /> Transferências Internas ({transferencias.length})
        </button>
      </div>

      {/* Barra de Busca Universal */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder={`Buscar por nome ou categoria...`}
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-hf-border bg-hf-surface text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
          />
        </div>
      </div>

      {/* ─── ABA 1: INSUMOS ─────────────────────────────────────────────────── */}
      {abaPrincipal === "insumos" && (
        <div className="space-y-4">
          {/* Seletor de Categorias */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
            <button
              onClick={() => setCategoriaAtiva("todas")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                categoriaAtiva === "todas"
                  ? "bg-emerald-600 text-white"
                  : "bg-slate-100 hover:bg-slate-200 text-slate-700"
              }`}
            >
              Todas as Categorias
            </button>
            {CATEGORIAS_ESTOQUE_MARMITARIA.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoriaAtiva(cat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                  categoriaAtiva === cat
                    ? "bg-emerald-600 text-white"
                    : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Tabela de Insumos */}
          <div className="bg-hf-surface rounded-3xl border border-hf-border shadow-sm p-4 overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase tracking-wider">
                  <th className="py-3 px-3">Item / Insumo</th>
                  <th className="py-3 px-3">Categoria</th>
                  <th className="py-3 px-3">Custo Unitário</th>
                  <th className="py-3 px-3">Estoque Físico</th>
                  <th className="py-3 px-3">Estoque Mínimo</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {insumosFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400 font-bold">
                      Nenhum insumo encontrado. Clique em "+ Cadastrar Insumo" ou "Migrar do Estoque Geral".
                    </td>
                  </tr>
                ) : (
                  insumosFiltrados.map((item) => {
                    const saldo = Number(item.quantidade_atual) || 0;
                    const min = Number(item.estoque_minimo) || 5;
                    const alerta = saldo < min;

                    return (
                      <tr key={item.id} className="hover:bg-slate-50 font-medium">
                        <td className="py-3 px-3">
                          <span className="font-bold text-slate-900 block">{item.nome}</span>
                          <span className="text-[10px] text-slate-400">Unidade: {item.unidade_medida}</span>
                        </td>
                        <td className="py-3 px-3 text-slate-500">{item.categoria || "Geral"}</td>
                        <td className="py-3 px-3 font-semibold text-slate-800">
                          {fmtBRL(item.custo_unitario)} / {item.unidade_medida}
                        </td>
                        <td className="py-3 px-3 font-black text-slate-900">
                          {saldo} {item.unidade_medida}
                        </td>
                        <td className="py-3 px-3 text-slate-500">
                          {min} {item.unidade_medida}
                        </td>
                        <td className="py-3 px-3">
                          {alerta ? (
                            <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 font-bold flex items-center gap-1 w-fit">
                              <AlertTriangle size={11} /> Abaixo do Mínimo
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-bold">
                              Normal
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleEditarInsumo(item)}
                              title="Editar Insumo"
                              className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 transition-all"
                            >
                              <Edit3 size={14} />
                            </button>
                            <button
                              onClick={() => {
                                setFormTransf({
                                  ...formTransf,
                                  insumo_id: item.id,
                                  unidade_medida: item.unidade_medida,
                                });
                                setModalTransferir(true);
                              }}
                              title="Transferir da Cozinha"
                              className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold"
                            >
                              Transferir
                            </button>
                            <button
                              onClick={() => handleExcluirInsumo(item.id, item.nome)}
                              title="Excluir"
                              className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition-all"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── ABA 2: EMBALAGENS ──────────────────────────────────────────────── */}
      {abaPrincipal === "embalagens" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-hf-surface p-4 rounded-3xl border border-hf-border shadow-sm flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase">Tipos de Embalagens</span>
                <h4 className="text-xl font-black text-slate-900 mt-0.5">{embalagens.length} itens</h4>
              </div>
              <div className="w-10 h-10 rounded-2xl bg-purple-50 text-purple-700 flex items-center justify-center font-bold">
                <Package size={20} />
              </div>
            </div>

            <div className="bg-hf-surface p-4 rounded-3xl border border-hf-border shadow-sm flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase">Unidades em Estoque</span>
                <h4 className="text-xl font-black text-slate-900 mt-0.5">
                  {embalagens.reduce((acc, curr) => acc + (Number(curr.quantidade_atual) || 0), 0)} un
                </h4>
              </div>
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
                <Boxes size={20} />
              </div>
            </div>

            <div className="bg-hf-surface p-4 rounded-3xl border border-hf-border shadow-sm flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase">Abaixo do Mínimo</span>
                <h4 className="text-xl font-black text-amber-600 mt-0.5">
                  {embalagens.filter((e) => (Number(e.quantidade_atual) || 0) < (Number(e.estoque_minimo) || 20)).length} itens
                </h4>
              </div>
              <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                <AlertTriangle size={20} />
              </div>
            </div>
          </div>

          {/* Tabela de Embalagens */}
          <div className="bg-hf-surface rounded-3xl border border-hf-border shadow-sm p-4 overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase tracking-wider">
                  <th className="py-3 px-3">Embalagem / Descartável</th>
                  <th className="py-3 px-3">Tipo</th>
                  <th className="py-3 px-3">Preço de Custo (Unidade)</th>
                  <th className="py-3 px-3">Estoque Físico</th>
                  <th className="py-3 px-3">Estoque Mínimo</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {embalagensFiltradas.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400 font-bold">
                      Nenhuma embalagem cadastrada. Clique em "+ Cadastrar Embalagem" acima.
                    </td>
                  </tr>
                ) : (
                  embalagensFiltradas.map((emb) => {
                    const saldo = Number(emb.quantidade_atual) || 0;
                    const min = Number(emb.estoque_minimo) || 20;
                    const alerta = saldo < min;

                    return (
                      <tr key={emb.id} className="hover:bg-slate-50 font-medium">
                        <td className="py-3 px-3 font-bold text-slate-900">{emb.nome}</td>
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 font-bold text-[10px] uppercase">
                            {emb.categoria || "Embalagem"}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-black text-slate-900">
                          {fmtBRL(emb.custo_unitario)} / un
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-800">{saldo} un</span>
                            <button
                              onClick={() => {
                                const nova = prompt(`Ajustar estoque de "${emb.nome}":`, saldo);
                                if (nova !== null && !isNaN(Number(nova))) {
                                  handleAjustarEstoqueRapido(emb, "embalagem", Number(nova));
                                }
                              }}
                              className="text-[10px] bg-slate-100 hover:bg-slate-200 px-1.5 py-0.5 rounded font-bold text-slate-600"
                            >
                              Ajustar
                            </button>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-slate-500">{min} un</td>
                        <td className="py-3 px-3">
                          {alerta ? (
                            <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 font-bold flex items-center gap-1 w-fit">
                              <AlertTriangle size={11} /> Repor Urgente
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-bold">
                              Estoque OK
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleEditarEmbalagem(emb)}
                              title="Editar Embalagem"
                              className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 transition-all"
                            >
                              <Edit3 size={14} />
                            </button>
                            <button
                              onClick={() => handleExcluirEmbalagem(emb.id, emb.nome)}
                              title="Excluir"
                              className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition-all"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── ABA 3: PRÉ-PREPAROS ─────────────────────────────────────────────── */}
      {abaPrincipal === "prepreparos" && (
        <div className="space-y-4">
          <div className="bg-hf-surface rounded-3xl border border-hf-border shadow-sm p-4 overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase tracking-wider">
                  <th className="py-3 px-3">Receita Base / Pré-preparo</th>
                  <th className="py-3 px-3">Categoria</th>
                  <th className="py-3 px-3">Rendimento da Panela</th>
                  <th className="py-3 px-3">Custo da Batelada</th>
                  <th className="py-3 px-3">Custo por Unidade / Kg</th>
                  <th className="py-3 px-3">Tempo Preparo</th>
                  <th className="py-3 px-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {prePreparosFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400 font-bold">
                      Nenhum pré-preparo cadastrado. Clique em "+ Novo Pré-preparo" (ex: Arroz Branco, Feijão, Frango Grelhado, Purê de Batatas).
                    </td>
                  </tr>
                ) : (
                  prePreparosFiltrados.map((prep) => {
                    const rend = Number(prep.rendimento) || 1;
                    const un = prep.rendimento_unidade || "kg";
                    const custoTot = Number(prep.custo_total) || 0;
                    const custoUnitario = rend > 0 ? custoTot / rend : custoTot;

                    return (
                      <tr key={prep.id} className="hover:bg-slate-50 font-medium">
                        <td className="py-3 px-3 font-bold text-slate-900">
                          {prep.nome_receita}
                        </td>
                        <td className="py-3 px-3 text-slate-500">{prep.categoria || "Pré-preparo"}</td>
                        <td className="py-3 px-3 font-bold text-slate-800">
                          {rend} {un}
                        </td>
                        <td className="py-3 px-3 font-semibold text-slate-700">
                          {fmtBRL(custoTot)}
                        </td>
                        <td className="py-3 px-3 font-black text-emerald-700 bg-emerald-50/50 rounded-lg">
                          {fmtBRL(custoUnitario)} / {un}
                        </td>
                        <td className="py-3 px-3 text-slate-500">
                          {prep.tempo_preparo_min ? `${prep.tempo_preparo_min} min` : "—"}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleEditarPrePreparo(prep)}
                              title="Editar Pré-preparo"
                              className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 transition-all"
                            >
                              <Edit3 size={14} />
                            </button>
                            <button
                              onClick={() => handleExcluirPrePreparo(prep.id, prep.nome_receita)}
                              title="Excluir"
                              className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition-all"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── ABA 4: HISTÓRICO DE TRANSFERÊNCIAS ──────────────────────────────── */}
      {abaPrincipal === "transferencias" && (
        <div className="bg-hf-surface rounded-3xl border border-hf-border shadow-sm p-4 overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase tracking-wider">
                <th className="py-3 px-3">Data</th>
                <th className="py-3 px-3">Produto Transferido</th>
                <th className="py-3 px-3">Quantidade</th>
                <th className="py-3 px-3">Origem</th>
                <th className="py-3 px-3">Destino</th>
                <th className="py-3 px-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {transferencias.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400 font-bold">
                    Nenhuma transferência interna realizada ainda.
                  </td>
                </tr>
              ) : (
                transferencias.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50 font-medium">
                    <td className="py-3 px-3 text-slate-600">{t.data}</td>
                    <td className="py-3 px-3 font-bold text-slate-900">{t.insumos?.nome || "Insumo"}</td>
                    <td className="py-3 px-3 font-black text-slate-800">
                      {t.quantidade} {t.unidade_medida}
                    </td>
                    <td className="py-3 px-3 text-slate-600">Cozinha Principal</td>
                    <td className="py-3 px-3 font-bold text-emerald-700">Marmitaria & Delivery</td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-bold">
                        {t.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ─── MODAL 1: CADASTRAR / EDITAR INSUMO ───────────────────────────────── */}
      {modalInsumo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-hf-surface w-full max-w-lg rounded-3xl border border-hf-border shadow-2xl p-6 sm:p-8 space-y-5">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <span className="text-xs font-black uppercase text-emerald-700 block">Estoque & Insumos</span>
                <h3 className="text-lg font-black text-slate-900">
                  {formInsumo.id ? "Editar Insumo" : "Cadastrar Novo Insumo"}
                </h3>
              </div>
              <button onClick={() => setModalInsumo(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-700">Nome do Insumo / Ingrediente:</label>
                <input
                  type="text"
                  placeholder="Ex: Peito de Frango, Arroz Agulhinha, Batata Inglesa..."
                  value={formInsumo.nome}
                  onChange={(e) => setFormInsumo({ ...formInsumo, nome: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-hf-border bg-slate-50 focus:bg-white text-xs font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Categoria:</label>
                  <select
                    value={formInsumo.categoria}
                    onChange={(e) => setFormInsumo({ ...formInsumo, categoria: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-hf-border bg-slate-50 text-xs font-semibold"
                  >
                    {CATEGORIAS_ESTOQUE_MARMITARIA.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Unidade de Medida:</label>
                  <select
                    value={formInsumo.unidade_medida}
                    onChange={(e) => setFormInsumo({ ...formInsumo, unidade_medida: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-hf-border bg-slate-50 text-xs font-semibold"
                  >
                    <option value="kg">Quilograma (kg)</option>
                    <option value="g">Grama (g)</option>
                    <option value="l">Litro (l)</option>
                    <option value="ml">Mililitro (ml)</option>
                    <option value="un">Unidade (un)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Custo Unitário (R$):</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formInsumo.custo_unitario}
                    onChange={(e) => setFormInsumo({ ...formInsumo, custo_unitario: Number(e.target.value) })}
                    className="w-full p-2.5 rounded-xl border border-hf-border bg-slate-50 text-xs font-black text-slate-900"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Estoque Atual:</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formInsumo.quantidade_atual}
                    onChange={(e) => setFormInsumo({ ...formInsumo, quantidade_atual: Number(e.target.value) })}
                    className="w-full p-2.5 rounded-xl border border-hf-border bg-slate-50 text-xs font-black text-slate-900"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Estoque Mínimo:</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formInsumo.estoque_minimo}
                    onChange={(e) => setFormInsumo({ ...formInsumo, estoque_minimo: Number(e.target.value) })}
                    className="w-full p-2.5 rounded-xl border border-hf-border bg-slate-50 text-xs font-semibold text-slate-700"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t">
              <button
                onClick={() => setModalInsumo(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 text-xs"
              >
                Cancelar
              </button>
              <button
                onClick={handleSalvarInsumo}
                disabled={salvando}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm shadow-emerald-600/30 transition-all"
              >
                {salvando ? "Salvando..." : "Salvar Insumo"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL 2: MIGRAR INSUMOS DO RESTAURANTE CENTRAL ─────────────────── */}
      {modalMigrar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-hf-surface w-full max-w-2xl rounded-3xl border border-hf-border shadow-2xl p-6 sm:p-8 space-y-5">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <span className="text-xs font-black uppercase text-emerald-700 block">Estoque Geral Seldeestrela</span>
                <h3 className="text-lg font-black text-slate-900">Selecionar Insumos do Restaurante</h3>
              </div>
              <button onClick={() => setModalMigrar(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Selecione quais matérias-primas e ingredientes já existentes na cozinha central do restaurante você deseja disponibilizar na <strong>Marmitaria & Delivery</strong> sem duplicar cadastro.
            </p>

            {/* Busca rápida */}
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Pesquisar nos ingredientes do restaurante..."
                value={buscaMigrar}
                onChange={(e) => setBuscaMigrar(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-xl border border-hf-border bg-slate-50 text-xs font-semibold focus:bg-white"
              />
            </div>

            {/* Lista selecionável com scroll */}
            <div className="max-h-72 overflow-y-auto border rounded-2xl divide-y text-xs">
              {insumosParaMigrar.length === 0 ? (
                <div className="p-6 text-center text-slate-400 font-bold">Nenhum insumo encontrado.</div>
              ) : (
                insumosParaMigrar.map((item) => {
                  const selecionado = selecionadosMigrar.includes(item.id);
                  return (
                    <div
                      key={item.id}
                      onClick={() => {
                        if (selecionado) {
                          setSelecionadosMigrar(selecionadosMigrar.filter((id) => id !== item.id));
                        } else {
                          setSelecionadosMigrar([...selecionadosMigrar, item.id]);
                        }
                      }}
                      className={`p-3 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors ${
                        selecionado ? "bg-emerald-50/70" : ""
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="text-emerald-700">
                          {selecionado ? <CheckSquare size={16} /> : <Square size={16} className="text-slate-400" />}
                        </div>
                        <div>
                          <span className="font-bold text-slate-900 block">{item.nome}</span>
                          <span className="text-[10px] text-slate-500">
                            Setor: {item.departamento || "cozinha"} · Unidade: {item.unidade_medida}
                          </span>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="font-bold text-slate-800 block">{fmtBRL(item.custo_unitario)}</span>
                        <span className="text-[10px] text-slate-500">Saldo: {item.quantidade_atual} {item.unidade_medida}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="flex items-center justify-between pt-3 border-t">
              <span className="text-xs font-bold text-slate-600">
                {selecionadosMigrar.length} insumo(s) selecionado(s)
              </span>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setModalMigrar(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 text-xs"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleExecutarMigracao}
                  disabled={salvando || selecionadosMigrar.length === 0}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm shadow-emerald-600/30 transition-all disabled:opacity-50"
                >
                  {salvando ? "Integrando..." : "Integrar à Marmitaria"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL 3: CADASTRAR / EDITAR EMBALAGEM ───────────────────────────── */}
      {modalEmbalagem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-hf-surface w-full max-w-lg rounded-3xl border border-hf-border shadow-2xl p-6 sm:p-8 space-y-5">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <span className="text-xs font-black uppercase text-purple-700 block">Embalagens & Descartáveis</span>
                <h3 className="text-lg font-black text-slate-900">
                  {formEmbalagem.id ? "Editar Embalagem" : "Cadastrar Embalagem"}
                </h3>
              </div>
              <button onClick={() => setModalEmbalagem(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-700">Nome da Embalagem / Descartável:</label>
                <input
                  type="text"
                  placeholder="Ex: Marmita 3 Divisórias 750ml, Tampa Plástica, Sacola Kraft P..."
                  value={formEmbalagem.nome}
                  onChange={(e) => setFormEmbalagem({ ...formEmbalagem, nome: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-hf-border bg-slate-50 focus:bg-white text-xs font-semibold"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Tipo de Embalagem:</label>
                <select
                  value={formEmbalagem.tipo_embalagem}
                  onChange={(e) => setFormEmbalagem({ ...formEmbalagem, tipo_embalagem: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-hf-border bg-slate-50 text-xs font-semibold"
                >
                  <option value="marmita">Marmita (Base)</option>
                  <option value="tampa">Tampa</option>
                  <option value="sacola">Sacola de Entrega</option>
                  <option value="lacre">Lacre de Segurança</option>
                  <option value="etiqueta">Etiqueta Adesiva</option>
                  <option value="talher">Kit Talher</option>
                  <option value="guardanapo">Guardanapo</option>
                  <option value="pote">Pote de Molho / Sobremesa</option>
                  <option value="outro">Outro Material</option>
                </select>
              </div>

              {/* Modo de Precificação */}
              <div className="p-3.5 bg-slate-50 rounded-2xl border space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-700">Forma de Cálculo do Custo:</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setFormEmbalagem({ ...formEmbalagem, modoPreco: "unitario" })}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold ${
                        formEmbalagem.modoPreco === "unitario" ? "bg-purple-600 text-white" : "bg-slate-200 text-slate-700"
                      }`}
                    >
                      Preço Direto / un
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormEmbalagem({ ...formEmbalagem, modoPreco: "caixa" })}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold ${
                        formEmbalagem.modoPreco === "caixa" ? "bg-purple-600 text-white" : "bg-slate-200 text-slate-700"
                      }`}
                    >
                      Compro por Caixa/Fardo
                    </button>
                  </div>
                </div>

                {formEmbalagem.modoPreco === "unitario" ? (
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700">Custo por Unidade (R$):</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formEmbalagem.custo_unitario}
                      onChange={(e) => setFormEmbalagem({ ...formEmbalagem, custo_unitario: Number(e.target.value) })}
                      className="w-full p-2.5 rounded-xl border border-hf-border bg-white text-xs font-black text-slate-900"
                    />
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="font-bold text-slate-700">Preço da Caixa (R$):</label>
                      <input
                        type="number"
                        step="0.01"
                        value={formEmbalagem.custoCaixa}
                        onChange={(e) => setFormEmbalagem({ ...formEmbalagem, custoCaixa: Number(e.target.value) })}
                        className="w-full p-2 rounded-xl border border-hf-border bg-white text-xs font-black"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="font-bold text-slate-700">Unidades na Caixa:</label>
                      <input
                        type="number"
                        value={formEmbalagem.unidadesPorCaixa}
                        onChange={(e) => setFormEmbalagem({ ...formEmbalagem, unidadesPorCaixa: Number(e.target.value) })}
                        className="w-full p-2 rounded-xl border border-hf-border bg-white text-xs font-black"
                      />
                    </div>
                    <div className="col-span-2 text-[11px] font-bold text-purple-700 bg-purple-50 p-2 rounded-xl">
                      Custo Unitário Calculado:{" "}
                      <strong>
                        {fmtBRL(
                          Number(formEmbalagem.unidadesPorCaixa) > 0
                            ? formEmbalagem.custoCaixa / formEmbalagem.unidadesPorCaixa
                            : 0
                        )}{" "}
                        cada
                      </strong>
                    </div>
                  </div>
                )}
              </div>

              {/* Estoque */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Estoque Físico Inicial (un):</label>
                  <input
                    type="number"
                    value={formEmbalagem.quantidade_atual}
                    onChange={(e) => setFormEmbalagem({ ...formEmbalagem, quantidade_atual: Number(e.target.value) })}
                    className="w-full p-2.5 rounded-xl border border-hf-border bg-slate-50 text-xs font-black text-slate-900"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Estoque Mínimo (Alerta de Reposição):</label>
                  <input
                    type="number"
                    value={formEmbalagem.estoque_minimo}
                    onChange={(e) => setFormEmbalagem({ ...formEmbalagem, estoque_minimo: Number(e.target.value) })}
                    className="w-full p-2.5 rounded-xl border border-hf-border bg-slate-50 text-xs font-semibold text-slate-700"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t">
              <button
                onClick={() => setModalEmbalagem(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 text-xs"
              >
                Cancelar
              </button>
              <button
                onClick={handleSalvarEmbalagem}
                disabled={salvando}
                className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-sm shadow-purple-600/30 transition-all"
              >
                {salvando ? "Salvando..." : "Salvar Embalagem"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL 4: CADASTRAR / EDITAR PRÉ-PREPARO ─────────────────────────── */}
      {modalPrePreparo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-hf-surface w-full max-w-lg rounded-3xl border border-hf-border shadow-2xl p-6 sm:p-8 space-y-5">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <span className="text-xs font-black uppercase text-emerald-700 block">Fichas Técnicas Base</span>
                <h3 className="text-lg font-black text-slate-900">
                  {formPrePreparo.id ? "Editar Pré-preparo" : "Novo Pré-preparo"}
                </h3>
              </div>
              <button onClick={() => setModalPrePreparo(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Cadastre preparações prontas que serão reutilizadas nas marmitas (ex: Arroz, Feijão, Carnes e Purês).
            </p>

            <div className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-700">Nome do Pré-preparo:</label>
                <input
                  type="text"
                  placeholder="Ex: Arroz Branco Cozido, Feijão Carioca da Casa, Frango Grelhado..."
                  value={formPrePreparo.nome_receita}
                  onChange={(e) => setFormPrePreparo({ ...formPrePreparo, nome_receita: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-hf-border bg-slate-50 focus:bg-white text-xs font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Categoria:</label>
                  <select
                    value={formPrePreparo.categoria}
                    onChange={(e) => setFormPrePreparo({ ...formPrePreparo, categoria: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-hf-border bg-slate-50 text-xs font-semibold"
                  >
                    <option value="Proteínas">Proteínas</option>
                    <option value="Guarnições">Guarnições</option>
                    <option value="Grãos & Secos">Grãos & Feijões</option>
                    <option value="Molhos">Molhos & Caldos</option>
                    <option value="Saladas">Saladas & Legumes</option>
                    <option value="Pré-preparo">Geral</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Tempo de Cozimento / Preparo (min):</label>
                  <input
                    type="number"
                    value={formPrePreparo.tempo_preparo_min}
                    onChange={(e) => setFormPrePreparo({ ...formPrePreparo, tempo_preparo_min: Number(e.target.value) })}
                    className="w-full p-2.5 rounded-xl border border-hf-border bg-slate-50 text-xs font-semibold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Rendimento da Panela / Batelada:</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step="0.1"
                      value={formPrePreparo.rendimento}
                      onChange={(e) => setFormPrePreparo({ ...formPrePreparo, rendimento: Number(e.target.value) })}
                      className="w-full p-2.5 rounded-xl border border-hf-border bg-slate-50 text-xs font-black"
                    />
                    <select
                      value={formPrePreparo.rendimento_unidade}
                      onChange={(e) => setFormPrePreparo({ ...formPrePreparo, rendimento_unidade: e.target.value })}
                      className="p-2.5 rounded-xl border border-hf-border bg-slate-50 text-xs font-bold"
                    >
                      <option value="kg">kg</option>
                      <option value="g">g</option>
                      <option value="un">un</option>
                      <option value="l">l</option>
                      <option value="porcao">porções</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Custo Total da Batelada (R$):</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formPrePreparo.custo_total}
                    onChange={(e) => setFormPrePreparo({ ...formPrePreparo, custo_total: Number(e.target.value) })}
                    className="w-full p-2.5 rounded-xl border border-hf-border bg-slate-50 text-xs font-black text-slate-900"
                  />
                </div>
              </div>

              {/* Indicador ao vivo de Custo por kg */}
              <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-200/60 flex items-center justify-between text-xs font-bold text-emerald-800">
                <span>Custo Médio Calculado:</span>
                <span className="text-sm font-black">
                  {fmtBRL(
                    Number(formPrePreparo.rendimento) > 0
                      ? formPrePreparo.custo_total / formPrePreparo.rendimento
                      : 0
                  )}{" "}
                  / {formPrePreparo.rendimento_unidade}
                </span>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Instruções de Preparo (Opcional):</label>
                <textarea
                  rows={2}
                  placeholder="Ex: Cozinhar em fogo médio por 25min, descansar 10min antes de porcionar..."
                  value={formPrePreparo.instrucoes_preparo}
                  onChange={(e) => setFormPrePreparo({ ...formPrePreparo, instrucoes_preparo: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-hf-border bg-slate-50 text-xs font-semibold"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t">
              <button
                onClick={() => setModalPrePreparo(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 text-xs"
              >
                Cancelar
              </button>
              <button
                onClick={handleSalvarPrePreparo}
                disabled={salvando}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm shadow-emerald-600/30 transition-all"
              >
                {salvando ? "Salvando..." : "Salvar Pré-preparo"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL 5: TRANSFERÊNCIA INTERNA (COZINHA -> MARMITARIA) ─────────── */}
      {modalTransferir && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-hf-surface w-full max-w-lg rounded-3xl border border-hf-border shadow-2xl p-6 sm:p-8 space-y-5">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <span className="text-xs font-black uppercase text-emerald-700 block">Movimentação Interna</span>
                <h3 className="text-lg font-black text-slate-900">Transferir para Marmitaria</h3>
              </div>
              <button onClick={() => setModalTransferir(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Registra a alocação de insumos da cozinha central para a operação de marmitas com rastreabilidade total,{" "}
              <strong>sem gerar compra ou venda fictícia</strong>.
            </p>

            <div className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-700">Produto a Transferir:</label>
                <select
                  value={formTransf.insumo_id}
                  onChange={(e) => {
                    const ins = insumos.find((i) => i.id === e.target.value);
                    setFormTransf({
                      ...formTransf,
                      insumo_id: e.target.value,
                      unidade_medida: ins?.unidade_medida || "kg",
                    });
                  }}
                  className="w-full p-2.5 rounded-xl border border-hf-border bg-slate-50 text-xs font-semibold"
                >
                  {insumos.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.nome} ({i.quantidade_atual} {i.unidade_medida} disponíveis)
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Quantidade Transferida:</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formTransf.quantidade}
                    onChange={(e) => setFormTransf({ ...formTransf, quantidade: Number(e.target.value) })}
                    className="w-full p-2.5 rounded-xl border border-hf-border bg-slate-50 text-xs font-black text-slate-900"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Unidade:</label>
                  <input
                    type="text"
                    disabled
                    value={formTransf.unidade_medida}
                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-100 text-xs font-bold text-slate-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Setor Origem:</label>
                  <input
                    type="text"
                    disabled
                    value="Cozinha Principal / Central"
                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-100 text-xs font-semibold text-slate-600"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Setor Destino:</label>
                  <input
                    type="text"
                    disabled
                    value="Marmitaria & Delivery"
                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-100 text-xs font-bold text-emerald-700"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Observação / Justificativa:</label>
                <input
                  type="text"
                  value={formTransf.observacao}
                  onChange={(e) => setFormTransf({ ...formTransf, observacao: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-hf-border bg-slate-50 text-xs font-semibold"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t">
              <button
                onClick={() => setModalTransferir(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 text-xs"
              >
                Cancelar
              </button>
              <button
                onClick={handleSalvarTransferencia}
                disabled={salvando}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm shadow-emerald-600/30 transition-all"
              >
                {salvando ? "Processando..." : "Confirmar Transferência"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL 6: CONVERSÃO DE EMBALAGENS ───────────────────────────────── */}
      {modalConversao && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-hf-surface w-full max-w-lg rounded-3xl border border-hf-border shadow-2xl p-6 sm:p-8 space-y-5">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <span className="text-xs font-black uppercase text-purple-700 block">Conversor de Compras</span>
                <h3 className="text-lg font-black text-slate-900">Conversão de Embalagens (Cx → Un)</h3>
              </div>
              <button onClick={() => setModalConversao(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              O fornecedor vende por caixa ou fardo, mas a ficha técnica consome por <strong>unidade</strong>. Converte automaticamente a compra para o estoque operacional.
            </p>

            <div className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-700">Descrição da Caixa Comprada:</label>
                <input
                  type="text"
                  value={formConversao.nome}
                  onChange={(e) => setFormConversao({ ...formConversao, nome: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-hf-border bg-slate-50 text-xs font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Caixas Compradas:</label>
                  <input
                    type="number"
                    value={formConversao.quantidadeComprada}
                    onChange={(e) => setFormConversao({ ...formConversao, quantidadeComprada: Number(e.target.value) })}
                    className="w-full p-2.5 rounded-xl border border-hf-border bg-slate-50 text-xs font-black"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Unidades por Caixa:</label>
                  <input
                    type="number"
                    value={formConversao.fatorConversao}
                    onChange={(e) => setFormConversao({ ...formConversao, fatorConversao: Number(e.target.value) })}
                    className="w-full p-2.5 rounded-xl border border-hf-border bg-slate-50 text-xs font-black"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Valor Total Pago por Caixa (R$):</label>
                <input
                  type="number"
                  step="0.01"
                  value={formConversao.custoTotalCaixa}
                  onChange={(e) => setFormConversao({ ...formConversao, custoTotalCaixa: Number(e.target.value) })}
                  className="w-full p-2.5 rounded-xl border border-hf-border bg-slate-50 text-xs font-black text-slate-900"
                />
              </div>

              {/* Resultado da conversão */}
              <div className="p-4 bg-purple-50 rounded-2xl border border-purple-200/60 space-y-1 text-purple-900">
                <div className="flex justify-between font-bold">
                  <span>Total Convertido para o Estoque:</span>
                  <span className="font-black text-sm">
                    {formConversao.quantidadeComprada * formConversao.fatorConversao} unidades
                  </span>
                </div>
                <div className="flex justify-between font-bold text-xs text-purple-700">
                  <span>Custo Técnico por Marmita / Embalagem:</span>
                  <span className="font-black">
                    {fmtBRL(
                      formConversao.fatorConversao > 0
                        ? formConversao.custoTotalCaixa / formConversao.fatorConversao
                        : 0
                    )}{" "}
                    por unidade
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t">
              <button
                onClick={() => setModalConversao(false)}
                className="px-5 py-2.5 rounded-xl bg-slate-900 text-white font-bold text-xs"
              >
                Concluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
