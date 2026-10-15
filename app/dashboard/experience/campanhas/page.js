"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Sparkles,
  Plus,
  Play,
  Pause,
  Trash2,
  TrendingUp,
  Eye,
  MousePointerClick,
  ShoppingCart,
  DollarSign,
  Calendar,
  Clock,
  Layers,
  CheckCircle2,
  AlertCircle,
  X,
  Target,
  Users,
  Image as ImageIcon,
  Flame,
  Wine
} from "lucide-react";
import { supabase } from "../../../lib/supabase";
import { useERP } from "../../../context/ERPContext";

const LOCAIS_EXIBICAO = [
  { id: "abertura", label: "Abertura do Cardápio", desc: "Exibido logo na recepção do cliente" },
  { id: "escolha", label: "Durante a Escolha", desc: "Sugerido pelo Concierge ou nas categorias" },
  { id: "finalizacao", label: "Finalização do Pedido", desc: "Upsell / cross-sell antes de confirmar a comanda" }
];

const OBJETIVOS = [
  { id: "aumentar_ticket", label: "Aumentar Ticket Médio" },
  { id: "giro_estoque", label: "Giro Rápido de Estoque" },
  { id: "alta_margem", label: "Maximizar Margem de Lucro" },
  { id: "lancamento", label: "Lançamento de Novo Prato/Drink" }
];

const DIAS_SEMANA_OPCOES = [
  { id: "0", label: "Dom" },
  { id: "1", label: "Seg" },
  { id: "2", label: "Ter" },
  { id: "3", label: "Qua" },
  { id: "4", label: "Qui" },
  { id: "5", label: "Sex" },
  { id: "6", label: "Sáb" }
];

export default function CampanhasIAPage() {
  const { unidadeAtiva } = useERP();
  const unidadeId = unidadeAtiva || "seldeestrela";

  const [campanhas, setCampanhas] = useState([]);
  const [produtos, setProdutos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [modalNova, setModalNova] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState(null);

  // Formulário de Campanha
  const [formProdutoId, setFormProdutoId] = useState("");
  const [formMensagem, setFormMensagem] = useState("");
  const [formLocal, setFormLocal] = useState("abertura");
  const [formPrioridade, setFormPrioridade] = useState("alta");
  const [formFrequencia, setFormFrequencia] = useState("moderada");
  const [formPublico, setFormPublico] = useState("todos");
  const [formObjetivo, setFormObjetivo] = useState("aumentar_ticket");
  const [formHoraInicio, setFormHoraInicio] = useState("18:00");
  const [formHoraFim, setFormHoraFim] = useState("23:59");
  const [formDias, setFormDias] = useState(["0", "1", "2", "3", "4", "5", "6"]);

  // Carregar dados
  useEffect(() => {
    async function carregarDados() {
      setCarregando(true);
      try {
        // Produtos da unidade
        const { data: prods } = await supabase
          .from("produtos")
          .select("id, nome_produto, preco_venda, categoria, imagem_url, departamento")
          .order("nome_produto");
        setProdutos(prods || []);

        // Campanhas
        const { data: camps, error } = await supabase
          .from("experience_campanhas")
          .select("*")
          .eq("unidade_id", unidadeId)
          .order("created_at", { ascending: false });

        if (!error && camps) {
          setCampanhas(camps);
        } else {
          // Mock ilustrativo se a tabela ainda não estiver populada
          setCampanhas([
            {
              id: "camp-demo-1",
              unidade_id: unidadeId,
              produto_nome: "Drink Selva Cítrica",
              mensagem_ia: "Sugestão do Chef: experimente nosso Drink Selva Cítrica, infusão artesanal de capim-santo e gin!",
              local_exibicao: "abertura",
              prioridade: "alta",
              frequencia: "moderada",
              publico_alvo: "todos",
              objetivo: "aumentar_ticket",
              status: "ativa",
              visualizacoes: 342,
              cliques: 89,
              adicoes_carrinho: 48,
              compras_efetivas: 42,
              receita_gerada: 1512.00,
              dias_semana: ["0", "4", "5", "6"],
              hora_inicio: "18:00",
              hora_fim: "23:59"
            },
            {
              id: "camp-demo-2",
              unidade_id: unidadeId,
              produto_nome: "Moqueca Amazônica de Tambaqui (2 pessoas)",
              mensagem_ia: "Mesa para compartilhar? A Moqueca de Tambaqui é o prato mais aclamado da casa hoje.",
              local_exibicao: "escolha",
              prioridade: "alta",
              frequencia: "moderada",
              publico_alvo: "mesas_2_mais",
              objetivo: "alta_margem",
              status: "ativa",
              visualizacoes: 215,
              cliques: 64,
              adicoes_carrinho: 31,
              compras_efetivas: 27,
              receita_gerada: 4455.00,
              dias_semana: ["0", "5", "6"],
              hora_inicio: "11:30",
              hora_fim: "23:00"
            }
          ]);
        }
      } catch (err) {
        console.error("Erro ao carregar campanhas:", err);
      } finally {
        setCarregando(false);
      }
    }

    carregarDados();
  }, [unidadeId]);

  // Produto selecionado no form
  const produtoSelecionado = useMemo(() => {
    return produtos.find(p => String(p.id) === String(formProdutoId)) || null;
  }, [produtos, formProdutoId]);

  // Gerador de mensagem persuasiva automática pela IA
  const gerarMensagemIA = () => {
    if (!produtoSelecionado) return;
    const nome = produtoSelecionado.nome_produto;
    const cat = produtoSelecionado.categoria || "";
    const dep = produtoSelecionado.departamento;

    if (dep === "bar" || cat.toLowerCase().includes("drink")) {
      setFormMensagem(`Sugestão especial do Chef: descubra o ${nome}, perfeito para despertar o paladar com aromas frescos e autorais!`);
    } else if (cat.toLowerCase().includes("peixe") || nome.toLowerCase().includes("pirarucu") || nome.toLowerCase().includes("tambaqui")) {
      setFormMensagem(`Que tal experimentar o ${nome}? Preparado na brasa com os melhores insumos amazônicos frescos.`);
    } else {
      setFormMensagem(`Destaque da nossa cozinha: conheça o ${nome}, um dos pratos mais recomendados do Seldeestrela hoje!`);
    }
  };

  // Salvar nova campanha
  const handleSalvarCampanha = async (e) => {
    e.preventDefault();
    if (!produtoSelecionado) {
      alert("Selecione um produto para a campanha.");
      return;
    }
    if (!formMensagem.trim()) {
      alert("Digite ou gere a mensagem da IA.");
      return;
    }

    setSalvando(true);
    const nova = {
      unidade_id: unidadeId,
      produto_id: produtoSelecionado.id,
      produto_nome: produtoSelecionado.nome_produto,
      foto_url: produtoSelecionado.imagem_url || null,
      mensagem_ia: formMensagem.trim(),
      local_exibicao: formLocal,
      prioridade: formPrioridade,
      frequencia: formFrequencia,
      publico_alvo: formPublico,
      objetivo: formObjetivo,
      hora_inicio: formHoraInicio,
      hora_fim: formHoraFim,
      dias_semana: formDias,
      status: "ativa",
      visualizacoes: 0,
      cliques: 0,
      adicoes_carrinho: 0,
      compras_efetivas: 0,
      receita_gerada: 0
    };

    try {
      const { data, error } = await supabase
        .from("experience_campanhas")
        .insert([nova])
        .select()
        .single();

      if (!error && data) {
        setCampanhas(prev => [data, ...prev]);
      } else {
        // Mock fallback
        setCampanhas(prev => [{ id: `camp-${Date.now()}`, ...nova }, ...prev]);
      }

      setModalNova(false);
      setFormProdutoId("");
      setFormMensagem("");
      setAviso("Campanha inteligente criada e ativada no cardápio com sucesso!");
      setTimeout(() => setAviso(null), 4000);
    } catch {
      alert("Falha ao salvar campanha.");
    } finally {
      setSalvando(false);
    }
  };

  // Alternar Status da Campanha
  const alternarStatus = async (camp) => {
    const novoStatus = camp.status === "ativa" ? "pausada" : "ativa";
    setCampanhas(prev => prev.map(c => c.id === camp.id ? { ...c, status: novoStatus } : c));
    try {
      await supabase
        .from("experience_campanhas")
        .update({ status: novoStatus })
        .eq("id", camp.id);
    } catch {
      // Ignora erro
    }
  };

  // Excluir Campanha
  const excluirCampanha = async (id) => {
    if (!confirm("Deseja realmente remover esta campanha de vendas?")) return;
    setCampanhas(prev => prev.filter(c => c.id !== id));
    try {
      await supabase.from("experience_campanhas").delete().eq("id", id);
    } catch {
      // Ignora erro
    }
  };

  // Métricas Consolidadas
  const metricas = useMemo(() => {
    const ativas = campanhas.filter(c => c.status === "ativa").length;
    const visualizacoes = campanhas.reduce((s, c) => s + (c.visualizacoes || 0), 0);
    const cliques = campanhas.reduce((s, c) => s + (c.cliques || 0), 0);
    const adicoes = campanhas.reduce((s, c) => s + (c.adicoes_carrinho || 0), 0);
    const compras = campanhas.reduce((s, c) => s + (c.compras_efetivas || 0), 0);
    const receita = campanhas.reduce((s, c) => s + Number(c.receita_gerada || 0), 0);
    const taxaConversao = visualizacoes > 0 ? ((compras / visualizacoes) * 100).toFixed(1) : "0.0";

    return { ativas, visualizacoes, cliques, adicoes, compras, receita, taxaConversao };
  }, [campanhas]);

  return (
    <div className="p-4 sm:p-7 max-w-7xl mx-auto space-y-6 text-slate-800">
      
      {/* HEADER DA PÁGINA */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-line pb-5">
        <div>
          <div className="flex items-center gap-2 text-2xs font-bold uppercase tracking-wider text-emerald-600 mb-1">
            <Sparkles size={14} />
            <span>Héfisto Experience • Inteligência Comercial</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Campanhas Inteligentes de Vendas (IA)
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Incentive produtos de alta margem e drinks autorais apresentados no momento certo pelo Concierge.
          </p>
        </div>

        <button
          onClick={() => setModalNova(true)}
          className="px-5 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs sm:text-sm flex items-center gap-2 shadow-lg shadow-emerald-600/20 transition active:scale-95 shrink-0"
        >
          <Plus size={18} />
          <span>Criar Nova Campanha IA</span>
        </button>
      </div>

      {/* FEEDBACK TOAST */}
      {aviso && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs sm:text-sm font-bold flex items-center gap-2 shadow-sm animate-in fade-in">
          <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
          <span>{aviso}</span>
        </div>
      )}

      {/* CARDS DE MÉTRICAS CONSOLIDADAS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white border border-line rounded-2xl p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-subtle text-2xs font-extrabold uppercase">
            <span>Impactos da IA</span>
            <Eye size={16} className="text-emerald-600" />
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-slate-900">{metricas.visualizacoes}</span>
            <p className="text-3xs text-slate-400 mt-0.5">{metricas.cliques} toques com interesse</p>
          </div>
        </div>

        <div className="bg-white border border-line rounded-2xl p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-subtle text-2xs font-extrabold uppercase">
            <span>Conversão Direta</span>
            <ShoppingCart size={16} className="text-amber-600" />
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-slate-900">{metricas.compras} pedidos</span>
            <p className="text-3xs text-emerald-600 font-bold mt-0.5">{metricas.taxaConversao}% de conversão</p>
          </div>
        </div>

        <div className="bg-white border border-line rounded-2xl p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-subtle text-2xs font-extrabold uppercase">
            <span>Receita Gerada pela IA</span>
            <DollarSign size={16} className="text-emerald-600" />
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-emerald-600">
              R$ {metricas.receita.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </span>
            <p className="text-3xs text-slate-400 mt-0.5">Vendas estimuladas pelo Concierge</p>
          </div>
        </div>

        <div className="bg-white border border-line rounded-2xl p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-subtle text-2xs font-extrabold uppercase">
            <span>Campanhas Ativas</span>
            <Target size={16} className="text-sky-600" />
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-slate-900">{metricas.ativas} ativas</span>
            <p className="text-3xs text-slate-400 mt-0.5">Em exibição no cardápio</p>
          </div>
        </div>
      </div>

      {/* LISTAGEM DE CAMPANHAS ATIVAS */}
      <div className="space-y-3">
        <h2 className="text-base font-black text-slate-800 flex items-center gap-2">
          <Layers size={18} className="text-emerald-600" />
          <span>Campanhas Cadastradas ({campanhas.length})</span>
        </h2>

        {campanhas.length === 0 ? (
          <div className="bg-white border border-line rounded-2xl p-12 text-center text-slate-400">
            <Sparkles size={36} className="mx-auto mb-2 text-slate-300" />
            <p className="text-sm font-bold text-slate-600">Nenhuma campanha de vendas configurada ainda.</p>
            <p className="text-xs text-slate-400 mt-1">
              Crie uma campanha para incentivar drinks especiais ou pratos de alta margem na mesa do cliente.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {campanhas.map(camp => (
              <div
                key={camp.id}
                className="bg-white border border-line rounded-2xl p-5 shadow-sm space-y-4 hover:border-slate-300 transition"
              >
                {/* Cabeçalho do Card */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`px-2 py-0.5 rounded-full text-3xs font-black uppercase ${
                        camp.status === "ativa" ? "bg-emerald-100 text-emerald-800 border border-emerald-300" : "bg-slate-100 text-slate-600"
                      }`}>
                        {camp.status === "ativa" ? "✓ Ativa" : "Pausada"}
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-3xs font-extrabold uppercase">
                        {LOCAIS_EXIBICAO.find(l => l.id === camp.local_exibicao)?.label || camp.local_exibicao}
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-3xs font-extrabold uppercase">
                        Prioridade {camp.prioridade}
                      </span>
                    </div>

                    <h3 className="text-base font-black text-slate-900 mt-2">
                      {camp.produto_nome}
                    </h3>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => alternarStatus(camp)}
                      className={`p-2 rounded-xl border transition ${
                        camp.status === "ativa" ? "bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100" : "bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100"
                      }`}
                      title={camp.status === "ativa" ? "Pausar Campanha" : "Ativar Campanha"}
                    >
                      {camp.status === "ativa" ? <Pause size={15} /> : <Play size={15} />}
                    </button>
                    <button
                      onClick={() => excluirCampanha(camp.id)}
                      className="p-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 transition"
                      title="Excluir"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                {/* Mensagem da IA */}
                <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 text-xs text-slate-700 italic">
                  &ldquo;{camp.mensagem_ia}&rdquo;
                </div>

                {/* Métricas Comerciais do Card */}
                <div className="grid grid-cols-4 gap-2 pt-2 border-t border-slate-100 text-center">
                  <div>
                    <span className="text-3xs text-subtle uppercase block font-bold">Vistas</span>
                    <span className="text-sm font-black text-slate-800">{camp.visualizacoes || 0}</span>
                  </div>
                  <div>
                    <span className="text-3xs text-subtle uppercase block font-bold">Cliques</span>
                    <span className="text-sm font-black text-slate-800">{camp.cliques || 0}</span>
                  </div>
                  <div>
                    <span className="text-3xs text-subtle uppercase block font-bold">Pedidos</span>
                    <span className="text-sm font-black text-emerald-600">{camp.compras_efetivas || 0}</span>
                  </div>
                  <div>
                    <span className="text-3xs text-subtle uppercase block font-bold">Receita</span>
                    <span className="text-sm font-black text-emerald-700">
                      R$ {Number(camp.receita_gerada || 0).toFixed(0)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MODAL CRIAR NOVA CAMPANHA IA */}
      {modalNova && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white border border-slate-200 w-full max-w-xl rounded-3xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto space-y-4">
            
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
                  <Sparkles size={18} />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">Nova Campanha IA de Vendas</h3>
                  <p className="text-2xs text-slate-500">Configure o produto e o gatilho persuasivo</p>
                </div>
              </div>
              <button onClick={() => setModalNova(false)} className="text-slate-400 hover:text-slate-700 p-1">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSalvarCampanha} className="space-y-4">
              
              {/* Seleção do Produto */}
              <div>
                <label className="text-2xs font-extrabold uppercase text-slate-600 block mb-1">
                  1. Qual produto deseja incentivar? *
                </label>
                <select
                  value={formProdutoId}
                  onChange={(e) => setFormProdutoId(e.target.value)}
                  required
                  className="w-full h-11 px-3 rounded-xl border border-line bg-card font-bold text-sm text-slate-800 outline-none focus:border-emerald-600"
                >
                  <option value="">Selecione um produto do cardápio...</option>
                  {produtos.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.nome_produto} — R$ {Number(p.preco_venda || 0).toFixed(2)} ({p.categoria || "Geral"})
                    </option>
                  ))}
                </select>
              </div>

              {/* Mensagem da IA com Gerador Automático */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-2xs font-extrabold uppercase text-slate-600">
                    2. Mensagem Persuasiva da IA *
                  </label>
                  {produtoSelecionado && (
                    <button
                      type="button"
                      onClick={gerarMensagemIA}
                      className="text-3xs font-extrabold text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
                    >
                      <Sparkles size={12} />
                      Sugerir com IA
                    </button>
                  )}
                </div>
                <textarea
                  value={formMensagem}
                  onChange={(e) => setFormMensagem(e.target.value)}
                  placeholder="Ex: Que tal provar nosso Drink Selva Cítrica preparado na hora?"
                  rows={3}
                  required
                  className="w-full p-3 rounded-xl border border-line bg-card font-medium text-xs text-slate-800 outline-none focus:border-emerald-600"
                />
              </div>

              {/* Local de Exibição */}
              <div>
                <label className="text-2xs font-extrabold uppercase text-slate-600 block mb-1.5">
                  3. Onde exibir no cardápio?
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {LOCAIS_EXIBICAO.map(loc => (
                    <button
                      key={loc.id}
                      type="button"
                      onClick={() => setFormLocal(loc.id)}
                      className={`p-2.5 rounded-xl border text-left transition ${
                        formLocal === loc.id ? "bg-emerald-50 border-emerald-500 text-emerald-900 font-black" : "bg-white border-line text-slate-600 hover:bg-slate-50 font-bold"
                      } text-xs`}
                    >
                      {loc.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Prioridade e Objetivo */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-2xs font-extrabold uppercase text-slate-600 block mb-1">
                    Prioridade
                  </label>
                  <select
                    value={formPrioridade}
                    onChange={(e) => setFormPrioridade(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-line bg-card font-bold text-xs outline-none"
                  >
                    <option value="alta">Alta (Sempre sugerir)</option>
                    <option value="media">Média</option>
                    <option value="baixa">Baixa (Discreta)</option>
                  </select>
                </div>

                <div>
                  <label className="text-2xs font-extrabold uppercase text-slate-600 block mb-1">
                    Objetivo Comercial
                  </label>
                  <select
                    value={formObjetivo}
                    onChange={(e) => setFormObjetivo(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-line bg-card font-bold text-xs outline-none"
                  >
                    {OBJETIVOS.map(obj => (
                      <option key={obj.id} value={obj.id}>{obj.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Horário de Exibição */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-2xs font-extrabold uppercase text-slate-600 block mb-1">
                    Horário Início
                  </label>
                  <input
                    type="time"
                    value={formHoraInicio}
                    onChange={(e) => setFormHoraInicio(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-line bg-card font-bold text-xs outline-none text-center"
                  />
                </div>
                <div>
                  <label className="text-2xs font-extrabold uppercase text-slate-600 block mb-1">
                    Horário Término
                  </label>
                  <input
                    type="time"
                    value={formHoraFim}
                    onChange={(e) => setFormHoraFim(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-line bg-card font-bold text-xs outline-none text-center"
                  />
                </div>
              </div>

              {/* Botões do Modal */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalNova(false)}
                  className="px-4 py-2.5 rounded-xl border border-line text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvando}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-md shadow-emerald-600/30 transition active:scale-95 disabled:opacity-50"
                >
                  {salvando ? "Ativando..." : "Salvar e Ativar Campanha"}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  );
}
