"use client";

import { useState, useEffect, useMemo, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useERP } from "../../../context/ERPContext";
import {
  UtensilsCrossed,
  Plus,
  Search,
  Printer,
  Copy,
  Edit3,
  Trash2,
  CheckCircle2,
  Sparkles,
  Layers,
  Package,
  Boxes,
  Clock,
  ArrowRight,
  Info,
  ChevronDown,
  ChevronUp,
  X,
  FileText,
  Sliders,
  AlertTriangle,
} from "lucide-react";
import { fmtBRL } from "../../../components/ui";
import {
  fetchMarmitas,
  salvarMarmita,
  fetchPreparacoesBase,
  salvarPrePreparoMarmitaria,
  fetchInsumosEstoque,
  salvarInsumoMarmitaria,
  fetchEmbalagensMarmitaria,
  salvarEmbalagemMarmitaria,
  resolverUnidade,
} from "../../../lib/marmitaria/marmitaria-service";
import {
  calcularCustoTecnicoMarmita,
  TAMANHOS_MARMITA,
  SEQUENCIA_MONTAGEM_PADRAO,
} from "../../../lib/marmitaria/marmitaria-calculos.mjs";

export default function MarmitariaFichasPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { unidadeAtiva, unidades } = useERP();

  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [marmitas, setMarmitas] = useState([]);
  const [preparacoesBase, setPreparacoesBase] = useState([]);
  const [insumosEstoque, setInsumosEstoque] = useState([]);
  const [embalagensDisponiveis, setEmbalagensDisponiveis] = useState([]);

  const [busca, setBusca] = useState("");
  const [tamanhoFiltro, setTamanhoFiltro] = useState("todos");

  // Modal de edição / cadastro de Marmita
  const [modalAberto, setModalAberto] = useState(false);
  const [modoAvancado, setModoAvancado] = useState(false);
  const [modalMontagemImpressao, setModalMontagemImpressao] = useState(null);

  // Modais de Criação Rápida Inline
  const [modalNovoPrePreparo, setModalNovoPrePreparo] = useState(false);
  const [formNovoPrePreparo, setFormNovoPrePreparo] = useState({
    nome_receita: "",
    categoria: "Guarnições",
    rendimento: 5.0,
    rendimento_unidade: "kg",
    custo_total: 40.0,
    tempo_preparo_min: 30,
  });

  const [modalNovoInsumo, setModalNovoInsumo] = useState(false);
  const [formNovoInsumo, setFormNovoInsumo] = useState({
    nome: "",
    categoria: "Proteínas",
    unidade_medida: "kg",
    custo_unitario: 25.0,
    estoque_minimo: 5,
  });

  const [modalNovaEmbalagem, setModalNovaEmbalagem] = useState(false);
  const [formNovaEmbalagem, setFormNovaEmbalagem] = useState({
    nome: "",
    tipo_embalagem: "marmita",
    custo_unitario: 1.30,
    estoque_minimo: 30,
  });

  // Form State
  const [form, setForm] = useState({
    id: null,
    codigo: "",
    nome_receita: "",
    categoria: "Marmitas Tradicionais",
    tamanho: "M",
    peso_final_g: 550,
    tempo_preparo_min: 15,
    descricao_comercial: "",
    foto_url: "",
    preco_venda: 25.0,
    ingredientes: [],
    preparacoes: [],
    embalagens: [],
    montagem_passos: SEQUENCIA_MONTAGEM_PADRAO,
  });

  // Carregar dados
  const carregarTudo = async () => {
    setLoading(true);
    try {
      const uId = resolverUnidade(unidadeAtiva, unidades);
      const [resMarmitas, resPreps, resInsumos, resEmbs] = await Promise.all([
        fetchMarmitas(uId),
        fetchPreparacoesBase(uId),
        fetchInsumosEstoque(uId),
        fetchEmbalagensMarmitaria(uId),
      ]);

      setMarmitas(resMarmitas.data || []);
      setPreparacoesBase(resPreps.data || []);
      setInsumosEstoque(resInsumos.data || []);
      setEmbalagensDisponiveis(resEmbs.data || []);

      if (searchParams.get("nova") === "1") {
        abrirNovaMarmita();
      }
    } catch (e) {
      console.error("Erro ao carregar fichas de marmitas:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarTudo();
  }, [unidadeAtiva, unidades]);

  // Marmitas filtradas
  const marmitasFiltradas = useMemo(() => {
    return marmitas.filter((m) => {
      const matchBusca =
        !busca ||
        m.nome_receita?.toLowerCase().includes(busca.toLowerCase()) ||
        m.categoria?.toLowerCase().includes(busca.toLowerCase()) ||
        m.codigo?.toLowerCase().includes(busca.toLowerCase());
      const matchTamanho = tamanhoFiltro === "todos" || m.tamanho === tamanhoFiltro;
      return matchBusca && matchTamanho;
    });
  }, [marmitas, busca, tamanhoFiltro]);

  // Cálculo ao vivo do custo do formulário atual
  const resumoCustoForm = useMemo(() => {
    return calcularCustoTecnicoMarmita({
      ingredientes: form.ingredientes,
      preparacoes: form.preparacoes,
      embalagens: form.embalagens,
      percentualPerdaAdicional: 2,
    });
  }, [form.ingredientes, form.preparacoes, form.embalagens]);

  const abrirNovaMarmita = () => {
    const padraoEmbs = embalagensDisponiveis.slice(0, 3).map((e) => ({
      embalagem_insumo_id: e.id,
      nome: e.nome,
      tipo_embalagem: "marmita",
      quantidade: 1,
      custo_unitario: e.custo_unitario || 1.2,
    }));

    setForm({
      id: null,
      codigo: `MARM-${(marmitas.length + 1).toString().padStart(3, "0")}`,
      nome_receita: "",
      categoria: "Marmitas Tradicionais",
      tamanho: "M",
      peso_final_g: 550,
      tempo_preparo_min: 15,
      descricao_comercial: "",
      foto_url: "",
      preco_venda: 26.0,
      ingredientes: [],
      preparacoes: [
        {
          subficha_id: preparacoesBase[0]?.id || null,
          nome: preparacoesBase[0]?.nome_receita || "Arroz branco cozido",
          quantidade: 0.15,
          unidade_medida: "kg",
          custo_unitario: preparacoesBase[0]?.custo_total || 6.5,
        },
      ],
      embalagens: padraoEmbs.length > 0 ? padraoEmbs : [
        { nome: "Marmita c/ divisória", tipo_embalagem: "marmita", quantidade: 1, custo_unitario: 1.25 },
        { nome: "Tampa térmica", tipo_embalagem: "tampa", quantidade: 1, custo_unitario: 0.45 },
        { nome: "Sacola kraft", tipo_embalagem: "sacola", quantidade: 1, custo_unitario: 0.85 },
      ],
      montagem_passos: SEQUENCIA_MONTAGEM_PADRAO,
    });
    setModalAberto(true);
  };

  const abrirEdicao = (m) => {
    let passos = SEQUENCIA_MONTAGEM_PADRAO;
    if (m.instrucoes_preparo) {
      try {
        const parsed = JSON.parse(m.instrucoes_preparo);
        if (Array.isArray(parsed) && parsed.length > 0) passos = parsed;
      } catch (_) {}
    }

    setForm({
      id: m.id,
      codigo: m.codigo || `MARM-${m.id.slice(0, 4)}`,
      nome_receita: m.nome_receita,
      categoria: m.categoria || "Marmitas Tradicionais",
      tamanho: m.tamanho || "M",
      peso_final_g: m.peso_final_g || 550,
      tempo_preparo_min: m.tempo_preparo_min || 15,
      descricao_comercial: m.descricao_comercial || "",
      foto_url: m.foto_url || "",
      preco_venda: m.preco_venda || 26.0,
      ingredientes: (m.fichas_ingredientes || [])
        .filter((i) => !i.subficha_id)
        .map((i) => ({
          insumo_id: i.insumo_id,
          nome: i.insumos?.nome || "Ingrediente",
          quantidade: i.quantidade,
          unidade_medida: i.unidade_medida || "kg",
          fator_correcao: i.fator_correcao || 1,
          perda_pct: i.perda_pct || 0,
          custo_unitario: i.custo_unitario || i.insumos?.custo_unitario || 0,
        })),
      preparacoes: (m.fichas_ingredientes || [])
        .filter((i) => i.subficha_id)
        .map((i) => ({
          subficha_id: i.subficha_id,
          nome: i.insumos?.nome || "Pré-preparo",
          quantidade: i.quantidade,
          unidade_medida: i.unidade_medida || "kg",
          custo_unitario: i.custo_unitario || 0,
        })),
      embalagens: m.embalagens || [],
      montagem_passos: passos,
    });
    setModalAberto(true);
  };

  const handleSalvar = async () => {
    if (!form.nome_receita.trim()) {
      alert("Por favor, informe o nome da marmita.");
      return;
    }

    setSalvando(true);
    try {
      const uId = resolverUnidade(unidadeAtiva, unidades);
      const payload = {
        ...form,
        custo_total: resumoCustoForm.custoTecnicoTotal,
      };

      const res = await salvarMarmita(uId, payload);
      if (res.error) {
        alert("Erro ao salvar marmita: " + res.error);
      } else {
        setModalAberto(false);
        await carregarTudo();
      }
    } catch (e) {
      alert("Erro ao salvar: " + e.message);
    } finally {
      setSalvando(false);
    }
  };

  // Helper para adicionar pré-preparo
  const adicionarPreparacao = (prepId) => {
    const prep = preparacoesBase.find((p) => p.id === prepId);
    if (!prep) return;
    setForm((prev) => ({
      ...prev,
      preparacoes: [
        ...prev.preparacoes,
        {
          subficha_id: prep.id,
          nome: prep.nome_receita,
          quantidade: 0.15,
          unidade_medida: prep.rendimento_unidade || "kg",
          custo_unitario: prep.custo_total || 0,
        },
      ],
    }));
  };

  // Helper para adicionar ingrediente direto
  const adicionarIngrediente = (insumoId) => {
    const ins = insumosEstoque.find((i) => i.id === insumoId);
    if (!ins) return;
    setForm((prev) => ({
      ...prev,
      ingredientes: [
        ...prev.ingredientes,
        {
          insumo_id: ins.id,
          nome: ins.nome,
          quantidade: 0.05,
          unidade_medida: ins.unidade_medida || "kg",
          fator_correcao: ins.fator_correcao || 1,
          perda_pct: ins.perda_pct || 0,
          custo_unitario: ins.custo_unitario || 0,
        },
      ],
    }));
  };

  // Helper para adicionar embalagem
  const adicionarEmbalagem = (embId) => {
    const emb = embalagensDisponiveis.find((e) => e.id === embId);
    if (!emb) return;
    setForm((prev) => ({
      ...prev,
      embalagens: [
        ...prev.embalagens,
        {
          embalagem_insumo_id: emb.id,
          nome: emb.nome,
          tipo_embalagem: "marmita",
          quantidade: 1,
          custo_unitario: emb.custo_unitario || 0,
        },
      ],
    }));
  };

  // Criação rápida Inline de Pré-preparo
  const handleSalvarNovoPrePreparoInline = async () => {
    if (!formNovoPrePreparo.nome_receita.trim()) {
      alert("Informe o nome do pré-preparo.");
      return;
    }
    setSalvando(true);
    try {
      const uId = resolverUnidade(unidadeAtiva, unidades);
      const res = await salvarPrePreparoMarmitaria(uId, formNovoPrePreparo);
      if (res.error) alert("Erro ao salvar: " + res.error);
      else {
        const resPreps = await fetchPreparacoesBase(uId);
        setPreparacoesBase(resPreps.data || []);
        // Adiciona automaticamente à marmita aberta
        const novoId = res.data?.id;
        const rend = Number(formNovoPrePreparo.rendimento) || 1;
        const custoUnit = rend > 0 ? (Number(formNovoPrePreparo.custo_total) || 0) / rend : 0;
        setForm((prev) => ({
          ...prev,
          preparacoes: [
            ...prev.preparacoes,
            {
              subficha_id: novoId,
              nome: formNovoPrePreparo.nome_receita,
              quantidade: 0.15,
              unidade_medida: formNovoPrePreparo.rendimento_unidade || "kg",
              custo_unitario: custoUnit,
            },
          ],
        }));
        setModalNovoPrePreparo(false);
        setFormNovoPrePreparo({
          nome_receita: "",
          categoria: "Guarnições",
          rendimento: 5.0,
          rendimento_unidade: "kg",
          custo_total: 40.0,
          tempo_preparo_min: 30,
        });
      }
    } catch (e) {
      alert("Erro ao salvar pré-preparo: " + e.message);
    } finally {
      setSalvando(false);
    }
  };

  // Criação rápida Inline de Insumo
  const handleSalvarNovoInsumoInline = async () => {
    if (!formNovoInsumo.nome.trim()) {
      alert("Informe o nome do insumo.");
      return;
    }
    setSalvando(true);
    try {
      const uId = resolverUnidade(unidadeAtiva, unidades);
      const res = await salvarInsumoMarmitaria(uId, formNovoInsumo);
      if (res.error) alert("Erro ao salvar: " + res.error);
      else {
        const resIns = await fetchInsumosEstoque(uId);
        setInsumosEstoque(resIns.data || []);
        const novoId = res.data?.id;
        setForm((prev) => ({
          ...prev,
          ingredientes: [
            ...prev.ingredientes,
            {
              insumo_id: novoId,
              nome: formNovoInsumo.nome,
              quantidade: 0.05,
              unidade_medida: formNovoInsumo.unidade_medida || "kg",
              fator_correcao: 1,
              perda_pct: 0,
              custo_unitario: Number(formNovoInsumo.custo_unitario) || 0,
            },
          ],
        }));
        setModalNovoInsumo(false);
        setFormNovoInsumo({
          nome: "",
          categoria: "Proteínas",
          unidade_medida: "kg",
          custo_unitario: 25.0,
          estoque_minimo: 5,
        });
      }
    } catch (e) {
      alert("Erro ao salvar insumo: " + e.message);
    } finally {
      setSalvando(false);
    }
  };

  // Criação rápida Inline de Embalagem
  const handleSalvarNovaEmbalagemInline = async () => {
    if (!formNovaEmbalagem.nome.trim()) {
      alert("Informe o nome da embalagem.");
      return;
    }
    setSalvando(true);
    try {
      const uId = resolverUnidade(unidadeAtiva, unidades);
      const res = await salvarEmbalagemMarmitaria(uId, formNovaEmbalagem);
      if (res.error) alert("Erro ao salvar: " + res.error);
      else {
        const resEmbs = await fetchEmbalagensMarmitaria(uId);
        setEmbalagensDisponiveis(resEmbs.data || []);
        const novoId = res.data?.id;
        setForm((prev) => ({
          ...prev,
          embalagens: [
            ...prev.embalagens,
            {
              embalagem_insumo_id: novoId,
              nome: formNovaEmbalagem.nome,
              tipo_embalagem: formNovaEmbalagem.tipo_embalagem || "marmita",
              quantidade: 1,
              custo_unitario: Number(formNovaEmbalagem.custo_unitario) || 1.3,
            },
          ],
        }));
        setModalNovaEmbalagem(false);
        setFormNovaEmbalagem({
          nome: "",
          tipo_embalagem: "marmita",
          custo_unitario: 1.30,
          estoque_minimo: 30,
        });
      }
    } catch (e) {
      alert("Erro ao salvar embalagem: " + e.message);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho da área */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-hf-surface p-6 rounded-3xl border border-hf-border shadow-sm">
        <div>
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-emerald-700 mb-1">
            <UtensilsCrossed size={14} /> Fichas Técnicas Exclusivas
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Fichas Técnicas de Marmitas
          </h1>
          <p className="text-sm font-medium text-slate-500 mt-0.5">
            Composição por pré-preparos da cozinha central, porcionamento em gramas, embalagens e montagem.
          </p>
        </div>

        <button
          onClick={abrirNovaMarmita}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold px-5 py-2.5 rounded-2xl shadow-sm shadow-emerald-600/30 transition-all active:scale-95"
        >
          <Plus size={16} /> Cadastrar Nova Marmita
        </button>
      </div>

      {/* Barra de Filtros e Busca */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-hf-surface p-3 rounded-2xl border border-hf-border shadow-sm">
        <div className="relative w-full sm:w-80">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por nome, código ou categoria..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
          <span className="text-xs font-bold text-slate-500 shrink-0">Tamanho:</span>
          {["todos", "PP", "P", "M", "G", "personalizado"].map((tam) => (
            <button
              key={tam}
              onClick={() => setTamanhoFiltro(tam)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                tamanhoFiltro === tam
                  ? "bg-emerald-600 text-white"
                  : "bg-slate-100 hover:bg-slate-200 text-slate-700"
              }`}
            >
              {tam.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Listagem de Marmitas em Cards Elegantes */}
      {loading ? (
        <div className="py-20 text-center text-slate-500 font-bold">
          Carregando fichas técnicas da marmitaria...
        </div>
      ) : marmitasFiltradas.length === 0 ? (
        <div className="bg-hf-surface p-12 text-center rounded-3xl border border-hf-border">
          <UtensilsCrossed size={40} className="mx-auto text-slate-300 mb-3" />
          <h3 className="text-lg font-bold text-slate-800">Nenhuma marmita cadastrada ainda</h3>
          <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
            Cadastre sua primeira marmita com pré-preparos da cozinha central, gramaturas e embalagens.
          </p>
          <button
            onClick={abrirNovaMarmita}
            className="mt-4 inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold px-4 py-2 rounded-xl transition-all"
          >
            <Plus size={16} /> Criar Primeira Marmita
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {marmitasFiltradas.map((m) => {
            const custoTecnico = Number(m.custo_total) || 8.5;
            const precoVenda = Number(m.preco_venda) || 25.0;
            const cmvPct = precoVenda > 0 ? (custoTecnico / precoVenda) * 100 : 0;
            const margemUnit = precoVenda - custoTecnico;

            return (
              <div
                key={m.id}
                className="bg-hf-surface rounded-3xl border border-hf-border hover:border-emerald-500/40 p-5 shadow-sm transition-all flex flex-col justify-between space-y-4"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-[11px] font-black tracking-wider uppercase border border-emerald-100">
                        Tam. {m.tamanho || "M"} ({m.peso_final_g || 550}g)
                      </span>
                      <span className="text-xs font-mono font-bold text-slate-400">
                        {m.codigo || "MARM"}
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setModalMontagemImpressao(m)}
                        title="Imprimir Guia de Montagem"
                        className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors"
                      >
                        <Printer size={16} />
                      </button>
                      <button
                        onClick={() => abrirEdicao(m)}
                        title="Editar Marmita"
                        className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-emerald-600 transition-colors"
                      >
                        <Edit3 size={16} />
                      </button>
                    </div>
                  </div>

                  <h3 className="text-base font-black text-slate-900 mt-2 leading-tight">
                    {m.nome_receita}
                  </h3>
                  <p className="text-xs text-slate-500 line-clamp-2 mt-1">
                    {m.descricao_comercial || "Marmita balanceada produzida com pré-preparos da cozinha central."}
                  </p>

                  {/* Resumo de Composição */}
                  <div className="mt-3.5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
                    <span className="flex items-center gap-1">
                      <Layers size={13} className="text-blue-500" />
                      {m.fichas_ingredientes?.length || 4} itens na receita
                    </span>
                    <span className="flex items-center gap-1">
                      <Package size={13} className="text-amber-500" />
                      {m.embalagens?.length || 3} embalagens
                    </span>
                  </div>
                </div>

                {/* Métricas Financeiras Técnicas */}
                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/60 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-semibold">Custo Técnico:</span>
                    <strong className="text-slate-900 font-bold">{fmtBRL(custoTecnico)}</strong>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-semibold">Preço Sugerido:</span>
                    <strong className="text-emerald-700 font-bold">{fmtBRL(precoVenda)}</strong>
                  </div>
                  <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200/50">
                    <span className="text-slate-500 font-semibold">CMV Técnico:</span>
                    <span className={`font-black ${cmvPct > 35 ? "text-amber-600" : "text-emerald-600"}`}>
                      {cmvPct.toFixed(1)}% (Margem {fmtBRL(margemUnit)})
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={() => setModalMontagemImpressao(m)}
                    className="flex-1 py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <FileText size={14} /> Ficha de Montagem
                  </button>
                  <button
                    onClick={() => router.push(`/dashboard/marmitaria/precificacao?marmita=${m.id}`)}
                    className="flex-1 py-2 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors border border-emerald-200/60"
                  >
                    <Sparkles size={14} /> Precificar Canais
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL DE CADASTRO / EDIÇÃO DE MARMITA */}
      {modalAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in">
          <div className="bg-hf-surface w-full max-w-4xl rounded-3xl border border-hf-border shadow-2xl p-6 sm:p-8 space-y-6 my-8 max-h-[90vh] overflow-y-auto">
            {/* Topo do Modal */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <span className="text-xs font-black uppercase tracking-wider text-emerald-700 block">
                  {form.id ? "Editar Ficha de Marmita" : "Nova Ficha de Marmita"}
                </span>
                <h2 className="text-xl font-black text-slate-900">
                  {form.nome_receita || "Composição Técnica da Marmita"}
                </h2>
              </div>

              <div className="flex items-center gap-3">
                {/* Alternância Modo Simples / Modo Avançado (Fase 14) */}
                <button
                  type="button"
                  onClick={() => setModoAvancado(!modoAvancado)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                    modoAvancado
                      ? "bg-purple-50 text-purple-700 border-purple-200"
                      : "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200"
                  }`}
                >
                  <Sliders size={13} />
                  {modoAvancado ? "Modo Avançado (Ativo)" : "Modo Simples"}
                </button>

                <button
                  onClick={() => setModalAberto(false)}
                  className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* SEÇÃO 1: IDENTIFICAÇÃO DA MARMITA */}
            <div className="space-y-4">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <Info size={16} className="text-emerald-600" />
                1. Identificação Comercial
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2 space-y-1">
                  <label className="text-xs font-bold text-slate-700">Nome da Marmita *</label>
                  <input
                    type="text"
                    placeholder="Ex: Marmita Executiva Frango Grelhado c/ Purê"
                    value={form.nome_receita}
                    onChange={(e) => setForm({ ...form, nome_receita: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Código</label>
                  <input
                    type="text"
                    value={form.codigo}
                    onChange={(e) => setForm({ ...form, codigo: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono text-slate-900"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Tamanho da Marmita</label>
                  <select
                    value={form.tamanho}
                    onChange={(e) => {
                      const sel = TAMANHOS_MARMITA.find((t) => t.id === e.target.value);
                      setForm({ ...form, tamanho: e.target.value, peso_final_g: sel?.pesoMedioG || form.peso_final_g });
                    }}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900"
                  >
                    {TAMANHOS_MARMITA.map((tam) => (
                      <option key={tam.id} value={tam.id}>
                        {tam.nome}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Peso Final Estimado (g)</label>
                  <input
                    type="number"
                    value={form.peso_final_g}
                    onChange={(e) => setForm({ ...form, peso_final_g: Number(e.target.value) })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Tempo de Preparo (min)</label>
                  <input
                    type="number"
                    value={form.tempo_preparo_min}
                    onChange={(e) => setForm({ ...form, tempo_preparo_min: Number(e.target.value) })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900"
                  />
                </div>

                <div className="sm:col-span-3 space-y-1">
                  <label className="text-xs font-bold text-slate-700">Descrição Comercial (Cardápio / iFood)</label>
                  <textarea
                    rows={2}
                    placeholder="Descrição apetitosa com ingredientes e complementos..."
                    value={form.descricao_comercial}
                    onChange={(e) => setForm({ ...form, descricao_comercial: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900"
                  />
                </div>
              </div>
            </div>

            {/* SEÇÃO 2: PREPARAÇÕES DA COZINHA CENTRAL (PRÉ-PREPAROS REUTILIZADOS) */}
            <div className="space-y-3 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                    <Layers size={16} className="text-blue-600" />
                    2. Preparações da Cozinha Central (Pré-preparos)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Reutiliza arroz cozido, feijão, carnes grelhadas e molhos já calculados sem retrabalho.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setModalNovoPrePreparo(true)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm shadow-blue-600/20 transition-all shrink-0"
                  >
                    <Plus size={13} /> Criar Pré-preparo
                  </button>
                  <select
                    onChange={(e) => {
                      if (e.target.value === "__CRIAR__") {
                        setModalNovoPrePreparo(true);
                      } else if (e.target.value) {
                        adicionarPreparacao(e.target.value);
                      }
                      e.target.value = "";
                    }}
                    defaultValue=""
                    className="px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-xl text-xs font-bold text-blue-800"
                  >
                    <option value="" disabled>
                      + Adicionar Pré-preparo
                    </option>
                    <option value="__CRIAR__">+ Criar Novo Pré-preparo...</option>
                    {preparacoesBase.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nome_receita} ({fmtBRL(p.custo_total)}/kg)
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {form.preparacoes.length === 0 ? (
                <div className="p-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-center text-xs text-slate-500 font-medium">
                  Nenhum pré-preparo adicionado. Selecione acima para incluir arroz, feijão, proteínas, etc.
                </div>
              ) : (
                <div className="space-y-2">
                  {form.preparacoes.map((prep, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-200 gap-3"
                    >
                      <div className="flex-1">
                        <span className="text-xs font-bold text-slate-900 block">{prep.nome}</span>
                        <span className="text-[11px] text-slate-500">
                          Custo base: {fmtBRL(prep.custo_unitario)}/{prep.unidade_medida || "kg"}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <label className="text-xs font-bold text-slate-500">Qtd ({prep.unidade_medida}):</label>
                        <input
                          type="number"
                          step="0.01"
                          value={prep.quantidade}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            const clone = [...form.preparacoes];
                            clone[idx].quantidade = val;
                            setForm({ ...form, preparacoes: clone });
                          }}
                          className="w-24 px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-900"
                        />
                        <span className="text-xs font-bold text-slate-800 min-w-16 text-right">
                          {fmtBRL(prep.quantidade * prep.custo_unitario)}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setForm({
                              ...form,
                              preparacoes: form.preparacoes.filter((_, i) => i !== idx),
                            });
                          }}
                          className="p-1 text-slate-400 hover:text-red-600 rounded-lg"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* SEÇÃO 3: INGREDIENTES DIRETOS (SE HOUVER) */}
            <div className="space-y-3 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                    <UtensilsCrossed size={16} className="text-emerald-600" />
                    3. Ingredientes Adicionais Diretos
                  </h3>
                  <p className="text-xs text-slate-500">
                    Itens que não passam por pré-preparo (ex: azeite, salada in natura, sachê).
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setModalNovoInsumo(true)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm shadow-emerald-600/20 transition-all shrink-0"
                  >
                    <Plus size={13} /> Novo Insumo
                  </button>
                  <select
                    onChange={(e) => {
                      if (e.target.value === "__CRIAR__") {
                        setModalNovoInsumo(true);
                      } else if (e.target.value) {
                        adicionarIngrediente(e.target.value);
                      }
                      e.target.value = "";
                    }}
                    defaultValue=""
                    className="px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-800"
                  >
                    <option value="" disabled>
                      + Adicionar Insumo
                    </option>
                    <option value="__CRIAR__">+ Cadastrar Novo Insumo...</option>
                    {insumosEstoque.slice(0, 40).map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.nome} ({fmtBRL(i.custo_unitario)}/{i.unidade_medida})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {form.ingredientes.map((ing, idx) => (
                <div
                  key={idx}
                  className="flex flex-wrap items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-200 gap-3"
                >
                  <div className="flex-1 min-w-36">
                    <span className="text-xs font-bold text-slate-900 block">{ing.nome}</span>
                    {modoAvancado && (
                      <span className="text-[11px] text-slate-400">
                        FC: {ing.fator_correcao || 1} | Perda: {ing.perda_pct || 0}%
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="text-xs font-bold text-slate-500">Qtd ({ing.unidade_medida}):</label>
                    <input
                      type="number"
                      step="0.01"
                      value={ing.quantidade}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        const clone = [...form.ingredientes];
                        clone[idx].quantidade = val;
                        setForm({ ...form, ingredientes: clone });
                      }}
                      className="w-20 px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-900"
                    />

                    {modoAvancado && (
                      <>
                        <input
                          type="number"
                          step="0.05"
                          title="Fator de Correção (FC)"
                          value={ing.fator_correcao}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            const clone = [...form.ingredientes];
                            clone[idx].fator_correcao = val;
                            setForm({ ...form, ingredientes: clone });
                          }}
                          className="w-16 px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-600"
                          placeholder="FC"
                        />
                      </>
                    )}

                    <span className="text-xs font-bold text-slate-800 min-w-16 text-right">
                      {fmtBRL(ing.quantidade * (ing.fator_correcao || 1) * ing.custo_unitario)}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setForm({
                          ...form,
                          ingredientes: form.ingredientes.filter((_, i) => i !== idx),
                        });
                      }}
                      className="p-1 text-slate-400 hover:text-red-600 rounded-lg"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* SEÇÃO 4: EMBALAGENS VINCULADAS */}
            <div className="space-y-3 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                    <Package size={16} className="text-amber-600" />
                    4. Embalagens e Descartáveis Vinculados
                  </h3>
                  <p className="text-xs text-slate-500">
                    O custo das embalagens entra automaticamente no custo técnico da marmita.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setModalNovaEmbalagem(true)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-sm shadow-amber-600/20 transition-all shrink-0"
                  >
                    <Plus size={13} /> Nova Embalagem
                  </button>
                  <select
                    onChange={(e) => {
                      if (e.target.value === "__CRIAR__") {
                        setModalNovaEmbalagem(true);
                      } else if (e.target.value) {
                        adicionarEmbalagem(e.target.value);
                      }
                      e.target.value = "";
                    }}
                    defaultValue=""
                    className="px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-xl text-xs font-bold text-amber-800"
                  >
                    <option value="" disabled>
                      + Adicionar Embalagem
                    </option>
                    <option value="__CRIAR__">+ Cadastrar Nova Embalagem...</option>
                    {embalagensDisponiveis.map((emb) => (
                      <option key={emb.id} value={emb.id}>
                        {emb.nome} ({fmtBRL(emb.custo_unitario)})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {form.embalagens.map((emb, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-200"
                  >
                    <div>
                      <span className="text-xs font-bold text-slate-900 block">{emb.nome}</span>
                      <span className="text-[11px] text-slate-400">
                        {fmtBRL(emb.custo_unitario)} cada
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="1"
                        value={emb.quantidade}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          const clone = [...form.embalagens];
                          clone[idx].quantidade = val;
                          setForm({ ...form, embalagens: clone });
                        }}
                        className="w-14 px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-center"
                      />
                      <span className="text-xs font-bold text-slate-800">
                        {fmtBRL(emb.quantidade * emb.custo_unitario)}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setForm({
                            ...form,
                            embalagens: form.embalagens.filter((_, i) => i !== idx),
                          });
                        }}
                        className="p-1 text-slate-400 hover:text-red-600 rounded-lg"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* SEÇÃO 5: RESUMO DE CUSTO TÉCNICO & PREÇO */}
            <div className="p-5 bg-emerald-50/70 rounded-3xl border border-emerald-200/80 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-black uppercase tracking-wider text-emerald-800">
                    Custo Técnico Consolidado
                  </span>
                  <div className="text-2xl font-black text-emerald-950">
                    {fmtBRL(resumoCustoForm.custoTecnicoTotal)}
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-xs font-semibold text-slate-600 block">
                    Alimentos: <strong>{fmtBRL(resumoCustoForm.custoTotalAlimentos)}</strong>
                  </span>
                  <span className="text-xs font-semibold text-slate-600 block">
                    Embalagens: <strong>{fmtBRL(resumoCustoForm.custoEmbalagens)}</strong>
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-emerald-200/60">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-bold text-emerald-900">Preço de Venda Base (R$):</label>
                  <input
                    type="number"
                    step="0.50"
                    value={form.preco_venda}
                    onChange={(e) => setForm({ ...form, preco_venda: Number(e.target.value) })}
                    className="w-24 px-2.5 py-1 bg-white border border-emerald-300 rounded-xl text-sm font-black text-slate-900 text-center"
                  />
                </div>

                <div className="text-xs font-black text-emerald-800">
                  CMV Técnico:{" "}
                  {form.preco_venda > 0
                    ? ((resumoCustoForm.custoTecnicoTotal / form.preco_venda) * 100).toFixed(1)
                    : 0}
                  %
                </div>
              </div>
            </div>

            {/* Botões do Rodapé */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setModalAberto(false)}
                className="px-5 py-2.5 rounded-2xl text-sm font-bold text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={handleSalvar}
                disabled={salvando}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-bold rounded-2xl shadow-sm shadow-emerald-600/30 transition-all flex items-center gap-2"
              >
                {salvando ? "Salvando..." : "Salvar Ficha Técnica"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL / GUIA DE MONTAGEM PARA IMPRESSÃO NA COZINHA (FASE 2) */}
      {modalMontagemImpressao && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in">
          <div className="bg-white text-slate-900 w-full max-w-2xl rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl print:m-0 print:p-0 print:shadow-none print:w-full">
            <div className="flex items-center justify-between border-b pb-4 print:hidden">
              <div>
                <span className="text-xs font-black uppercase text-emerald-700">Ficha de Montagem</span>
                <h3 className="text-xl font-black text-slate-900">
                  {modalMontagemImpressao.nome_receita}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold flex items-center gap-1.5"
                >
                  <Printer size={15} /> Imprimir na Cozinha
                </button>
                <button
                  onClick={() => setModalMontagemImpressao(null)}
                  className="p-2 text-slate-400 hover:text-slate-700 rounded-xl"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Conteúdo formatado para impressão */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b-2 border-slate-900 pb-3">
                <div>
                  <h1 className="text-2xl font-black text-slate-950 uppercase tracking-tight">
                    {modalMontagemImpressao.nome_receita}
                  </h1>
                  <span className="text-sm font-bold text-slate-600">
                    Tamanho {modalMontagemImpressao.tamanho || "M"} • Peso Padrão: {modalMontagemImpressao.peso_final_g || 550}g
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xs font-mono font-bold text-slate-500 block">
                    {modalMontagemImpressao.codigo || "MARMITA"}
                  </span>
                  <span className="text-xs font-bold text-emerald-700 uppercase">
                    HÉFISTO MARMITARIA
                  </span>
                </div>
              </div>

              {/* Tabela de Passos de Montagem */}
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 mb-2">
                  Sequência Padrão de Montagem (Cozinha / Embalagem)
                </h4>
                <div className="divide-y divide-slate-200 border border-slate-200 rounded-2xl overflow-hidden">
                  {SEQUENCIA_MONTAGEM_PADRAO.map((p) => (
                    <div key={p.passo} className="flex items-center p-3 text-xs gap-3">
                      <span className="w-6 h-6 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-[11px] shrink-0">
                        {p.passo}
                      </span>
                      <strong className="w-40 font-bold text-slate-800 shrink-0">{p.etapa}</strong>
                      <span className="text-slate-600 font-medium">{p.instrucao}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Embalagens requeridas */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
                <h5 className="text-xs font-bold uppercase text-slate-700">Materiais & Embalagens:</h5>
                <p className="text-xs text-slate-600 font-medium">
                  {modalMontagemImpressao.embalagens?.map((e) => `${e.quantidade}x ${e.nome}`).join(" • ") || "Marmita, tampa térmica, sacola kraft e lacre de segurança."}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL INLINE: CRIAR NOVO PRÉ-PREPARO */}
      {modalNovoPrePreparo && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-hf-surface w-full max-w-md rounded-3xl border border-hf-border shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <span className="text-[10px] font-black uppercase text-blue-700 block">Criação Rápida</span>
                <h4 className="text-base font-black text-slate-900">Novo Pré-preparo (Receita Base)</h4>
              </div>
              <button onClick={() => setModalNovoPrePreparo(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-700">Nome da Receita Base:</label>
                <input
                  type="text"
                  placeholder="Ex: Arroz Branco Soltinho, Feijão Tropeiro..."
                  value={formNovoPrePreparo.nome_receita}
                  onChange={(e) => setFormNovoPrePreparo({ ...formNovoPrePreparo, nome_receita: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-hf-border bg-slate-50 text-xs font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Rendimento:</label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      step="0.1"
                      value={formNovoPrePreparo.rendimento}
                      onChange={(e) => setFormNovoPrePreparo({ ...formNovoPrePreparo, rendimento: Number(e.target.value) })}
                      className="w-full p-2 rounded-xl border border-hf-border bg-slate-50 text-xs font-black"
                    />
                    <select
                      value={formNovoPrePreparo.rendimento_unidade}
                      onChange={(e) => setFormNovoPrePreparo({ ...formNovoPrePreparo, rendimento_unidade: e.target.value })}
                      className="p-2 rounded-xl border border-hf-border bg-slate-50 text-xs font-bold"
                    >
                      <option value="kg">kg</option>
                      <option value="g">g</option>
                      <option value="un">un</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Custo Total (R$):</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formNovoPrePreparo.custo_total}
                    onChange={(e) => setFormNovoPrePreparo({ ...formNovoPrePreparo, custo_total: Number(e.target.value) })}
                    className="w-full p-2 rounded-xl border border-hf-border bg-slate-50 text-xs font-black"
                  />
                </div>
              </div>

              <div className="p-2.5 bg-blue-50 text-blue-800 rounded-xl font-bold flex justify-between">
                <span>Custo Médio Calculado:</span>
                <span>
                  {fmtBRL(
                    Number(formNovoPrePreparo.rendimento) > 0
                      ? formNovoPrePreparo.custo_total / formNovoPrePreparo.rendimento
                      : 0
                  )}{" "}
                  / {formNovoPrePreparo.rendimento_unidade}
                </span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <button
                type="button"
                onClick={() => setModalNovoPrePreparo(false)}
                className="px-3 py-2 rounded-xl text-slate-600 font-bold hover:bg-slate-100 text-xs"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSalvarNovoPrePreparoInline}
                disabled={salvando}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs shadow-sm"
              >
                {salvando ? "Salvando..." : "Salvar e Inserir na Marmita"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL INLINE: CRIAR NOVO INSUMO */}
      {modalNovoInsumo && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-hf-surface w-full max-w-md rounded-3xl border border-hf-border shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <span className="text-[10px] font-black uppercase text-emerald-700 block">Criação Rápida</span>
                <h4 className="text-base font-black text-slate-900">Novo Insumo / Ingrediente</h4>
              </div>
              <button onClick={() => setModalNovoInsumo(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-700">Nome do Insumo:</label>
                <input
                  type="text"
                  placeholder="Ex: Azeite Extra Virgem, Queijo Parmesão..."
                  value={formNovoInsumo.nome}
                  onChange={(e) => setFormNovoInsumo({ ...formNovoInsumo, nome: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-hf-border bg-slate-50 text-xs font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Unidade:</label>
                  <select
                    value={formNovoInsumo.unidade_medida}
                    onChange={(e) => setFormNovoInsumo({ ...formNovoInsumo, unidade_medida: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-hf-border bg-slate-50 text-xs font-semibold"
                  >
                    <option value="kg">kg</option>
                    <option value="g">g</option>
                    <option value="l">l</option>
                    <option value="ml">ml</option>
                    <option value="un">un</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Custo Unitário (R$):</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formNovoInsumo.custo_unitario}
                    onChange={(e) => setFormNovoInsumo({ ...formNovoInsumo, custo_unitario: Number(e.target.value) })}
                    className="w-full p-2.5 rounded-xl border border-hf-border bg-slate-50 text-xs font-black"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <button
                type="button"
                onClick={() => setModalNovoInsumo(false)}
                className="px-3 py-2 rounded-xl text-slate-600 font-bold hover:bg-slate-100 text-xs"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSalvarNovoInsumoInline}
                disabled={salvando}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-sm"
              >
                {salvando ? "Salvando..." : "Salvar e Inserir na Marmita"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL INLINE: CRIAR NOVA EMBALAGEM */}
      {modalNovaEmbalagem && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-hf-surface w-full max-w-md rounded-3xl border border-hf-border shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <span className="text-[10px] font-black uppercase text-amber-700 block">Criação Rápida</span>
                <h4 className="text-base font-black text-slate-900">Nova Embalagem / Descartável</h4>
              </div>
              <button onClick={() => setModalNovaEmbalagem(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-700">Nome da Embalagem:</label>
                <input
                  type="text"
                  placeholder="Ex: Marmita Térmica 500ml, Tampa de Isopor..."
                  value={formNovaEmbalagem.nome}
                  onChange={(e) => setFormNovaEmbalagem({ ...formNovaEmbalagem, nome: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-hf-border bg-slate-50 text-xs font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Tipo:</label>
                  <select
                    value={formNovaEmbalagem.tipo_embalagem}
                    onChange={(e) => setFormNovaEmbalagem({ ...formNovaEmbalagem, tipo_embalagem: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-hf-border bg-slate-50 text-xs font-semibold"
                  >
                    <option value="marmita">Marmita (Base)</option>
                    <option value="tampa">Tampa</option>
                    <option value="sacola">Sacola</option>
                    <option value="lacre">Lacre</option>
                    <option value="talher">Talher</option>
                    <option value="pote">Pote de Molho</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Preço / Custo Unitário (R$):</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formNovaEmbalagem.custo_unitario}
                    onChange={(e) => setFormNovaEmbalagem({ ...formNovaEmbalagem, custo_unitario: Number(e.target.value) })}
                    className="w-full p-2.5 rounded-xl border border-hf-border bg-slate-50 text-xs font-black"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <button
                type="button"
                onClick={() => setModalNovaEmbalagem(false)}
                className="px-3 py-2 rounded-xl text-slate-600 font-bold hover:bg-slate-100 text-xs"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSalvarNovaEmbalagemInline}
                disabled={salvando}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold text-xs shadow-sm"
              >
                {salvando ? "Salvando..." : "Salvar e Inserir na Marmita"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
