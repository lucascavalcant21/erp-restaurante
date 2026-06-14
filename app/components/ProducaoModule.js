"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  ChefHat, DollarSign, TrendingUp, AlertTriangle, Clock, Plus,
  User, BookOpen, Minus, X, CheckCircle, XCircle, Package,
  BarChart3, ArrowLeft, Flame, Edit3, Scale,
} from "lucide-react";
import {
  PageHeader, PageBody, Card, KpiGrid, Kpi, SearchBar, Toast, fmtBRL,
} from "./ui";
import { useERP } from "../context/ERPContext";
import { fetchCardapio } from "../lib/cardapio";
import { fetchDrinks } from "../lib/drinks";
import { fetchEstoque } from "../lib/estoque";
import { fetchFuncionarios } from "../lib/rh";
import { fetchProducoes, registrarProducao, fetchFichaDoPrato, calcularResumo } from "../lib/producao";

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmtData = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
};
const fmtHora = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
};

const UNIDADES_MEDIDA = ["KG", "g", "L", "ml", "UN"];

// ─── Modal Nova Produção ─────────────────────────────────────────────────────
function ModalNovaProducao({ pratos, estoque, funcionarios, setor, onConfirmar, onClose, loading }) {
  const [pratoId, setPratoId] = useState("");
  const [funcId, setFuncId] = useState("");
  const [quantidade, setQuantidade] = useState("");
  const [unidadeMedida, setUnidadeMedida] = useState("KG");
  const [ficha, setFicha] = useState([]);
  const [ingredientes, setIngredientes] = useState([]);
  const [motivo, setMotivo] = useState("");
  const [sobras, setSobras] = useState("");
  const [erro, setErro] = useState("");
  const [loadingFicha, setLoadingFicha] = useState(false);

  const prato = pratos.find((p) => p.id === pratoId);
  const func = funcionarios.find((f) => f.id === funcId);

  const labelSetor = setor === "bar" ? "Produção para Bar" : "Produção para Cozinha";

  // Verifica se houve alteração nos ingredientes vs ficha técnica
  const teveAlteracao = ingredientes.some(
    (ing) => Math.abs((ing.qtd_usada || 0) - (ing.qtd_ficha || 0)) > 0.001
  );

  // Ao selecionar um prato, busca a ficha técnica
  useEffect(() => {
    if (!pratoId) { setFicha([]); setIngredientes([]); return; }
    (async () => {
      setLoadingFicha(true);
      const { data } = await fetchFichaDoPrato(pratoId);
      setFicha(data || []);
      const qtdNum = Number(quantidade) || 1;
      const mapped = (data || []).map((fi) => {
        const estoqueItem = estoque.find(
          (e) => e.nome?.toLowerCase() === fi.nome?.toLowerCase()
            || e.id === fi.ingrediente_id
        );
        return {
          ficha_id: fi.id,
          estoque_id: estoqueItem?.id || null,
          nome: fi.nome,
          unidade: fi.unidade,
          qtd_ficha: (fi.quantidade || 0) * qtdNum,
          qtd_usada: (fi.quantidade || 0) * qtdNum,
          custo_unit: fi.custo_unit || estoqueItem?.custo_unitario || estoqueItem?.preco_unit || 0,
          disponivel: estoqueItem?.quantidade || 0,
        };
      });
      setIngredientes(mapped);
      setLoadingFicha(false);
    })();
  }, [pratoId, quantidade, estoque]);

  function atualizarQtdUsada(idx, valor) {
    setIngredientes((prev) => prev.map((ing, i) =>
      i === idx ? { ...ing, qtd_usada: Math.max(0, Number(valor) || 0) } : ing
    ));
  }

  async function confirmar() {
    if (!pratoId) return setErro("Selecione o que foi produzido.");
    if (!funcId) return setErro("Selecione quem produziu.");
    if (!quantidade || Number(quantidade) <= 0) return setErro("Informe a quantidade produzida.");
    if (pratoId && ingredientes.length === 0) return setErro("Este item não possui ficha técnica cadastrada. Cadastre antes de registrar a produção.");
    if (teveAlteracao && !motivo.trim()) return setErro("Houve alteração nos ingredientes. Informe o motivo obrigatoriamente.");
    if (!sobras.trim()) return setErro("Informe as sobras ou resultado da produção.");
    setErro("");

    await onConfirmar({
      setor,
      prato_id: pratoId,
      prato_nome: prato?.nome || "",
      prato_preco: Number(prato?.preco || prato?.preco_venda) || 0,
      quantidade: Number(quantidade),
      unidade_medida: unidadeMedida,
      funcionario_id: funcId,
      funcionario_nome: func?.nome || "",
      motivo_alteracao: teveAlteracao ? motivo : null,
      sobras: sobras,
    }, ingredientes);
  }

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 1000, backdropFilter: "blur(4px)", padding: 16,
      overflowY: "auto",
    }}>
      <div style={{
        background: "#1E293B", borderRadius: 24, width: "min(600px, 100%)",
        border: "1px solid #334155", boxShadow: "0 32px 64px rgba(0,0,0,0.5)",
        maxHeight: "90vh", overflowY: "auto",
      }}>
        {/* Header */}
        <div style={{
          padding: "20px 24px", borderBottom: "1px solid #334155",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          position: "sticky", top: 0, background: "#1E293B", zIndex: 10,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 12,
              background: "rgba(249,115,22,0.15)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Flame size={20} color="#F97316" />
            </div>
            <div>
              <p style={{ color: "#94A3B8", fontSize: 12, fontWeight: 600, textTransform: "uppercase" }}>NOVA PRODUÇÃO</p>
              <p style={{ color: "#F1F5F9", fontSize: 18, fontWeight: 700 }}>{labelSetor}</p>
            </div>
          </div>
          <button onClick={onClose} style={{ color: "#64748B", background: "none", border: "none", cursor: "pointer" }}>
            <X size={22} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>

          {/* O que foi produzido */}
          <div>
            <label style={{ display: "flex", alignItems: "center", gap: 6, color: "#64748B", fontSize: 12, fontWeight: 700, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              <BookOpen size={14} /> {labelSetor} — O que foi produzido? *
            </label>
            <select value={pratoId} onChange={(e) => { setPratoId(e.target.value); setErro(""); }}
              style={{
                width: "100%", height: 52, padding: "0 16px", borderRadius: 12,
                background: "#0F172A", border: "1.5px solid #334155",
                color: pratoId ? "#F1F5F9" : "#64748B", fontSize: 16, fontWeight: 600,
                outline: "none", cursor: "pointer",
              }}>
              <option value="">Selecione...</option>
              {pratos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome} — {fmtBRL(p.preco || p.preco_venda || 0)}
                </option>
              ))}
            </select>
          </div>

          {/* Quem produziu */}
          <div>
            <label style={{ display: "flex", alignItems: "center", gap: 6, color: "#64748B", fontSize: 12, fontWeight: 700, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              <User size={14} /> Quem produziu? *
            </label>
            <select value={funcId} onChange={(e) => { setFuncId(e.target.value); setErro(""); }}
              style={{
                width: "100%", height: 52, padding: "0 16px", borderRadius: 12,
                background: "#0F172A", border: "1.5px solid #334155",
                color: funcId ? "#F1F5F9" : "#64748B", fontSize: 16, fontWeight: 600,
                outline: "none", cursor: "pointer",
              }}>
              <option value="">Selecione o funcionário...</option>
              {funcionarios.map((f) => (
                <option key={f.id} value={f.id}>{f.nome} — {f.cargo}</option>
              ))}
            </select>
          </div>

          {/* Quantidade produzida + Unidade de medida */}
          <div>
            <label style={{ display: "flex", alignItems: "center", gap: 6, color: "#64748B", fontSize: 12, fontWeight: 700, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              <Scale size={14} /> Quantidade produzida *
            </label>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button onClick={() => setQuantidade((q) => String(Math.max(0.1, (Number(q) || 1) - 1)))}
                style={{ width: 52, height: 52, borderRadius: 12, background: "#334155", border: "none", color: "#F1F5F9", fontSize: 22, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Minus size={20} />
              </button>
              <input type="number" value={quantidade} min="0.01" step="0.1"
                placeholder="0"
                onChange={(e) => setQuantidade(e.target.value)}
                style={{
                  flex: 1, height: 52, textAlign: "center", borderRadius: 12,
                  background: "#0F172A", border: "1.5px solid #334155",
                  color: "#F1F5F9", fontSize: 22, fontWeight: 700, outline: "none",
                  minWidth: 0,
                }} />
              <select value={unidadeMedida} onChange={(e) => setUnidadeMedida(e.target.value)}
                style={{
                  width: 90, height: 52, padding: "0 10px", borderRadius: 12,
                  background: "#0F172A", border: "1.5px solid #334155",
                  color: "#F1F5F9", fontSize: 16, fontWeight: 700,
                  outline: "none", cursor: "pointer", textAlign: "center", flexShrink: 0,
                }}>
                {UNIDADES_MEDIDA.map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
              <button onClick={() => setQuantidade((q) => String((Number(q) || 0) + 1))}
                style={{ width: 52, height: 52, borderRadius: 12, background: "#334155", border: "none", color: "#F1F5F9", fontSize: 22, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Plus size={20} />
              </button>
            </div>
          </div>

          {/* Ingredientes da Ficha Técnica */}
          {pratoId && (
            <div>
              <label style={{ display: "flex", alignItems: "center", gap: 6, color: "#64748B", fontSize: 12, fontWeight: 700, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                <Package size={14} /> Ingredientes utilizados (da ficha técnica)
              </label>
              {loadingFicha ? (
                <p style={{ color: "#475569", fontSize: 14, padding: "16px 0" }}>Carregando ficha técnica...</p>
              ) : ingredientes.length === 0 ? (
                <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 12, padding: "14px 16px" }}>
                  <p style={{ color: "#EF4444", fontSize: 13, fontWeight: 600 }}>
                    ⚠ Nenhuma ficha técnica cadastrada para este item.
                  </p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 280, overflowY: "auto" }}>
                  {ingredientes.map((ing, idx) => {
                    const alterado = Math.abs((ing.qtd_usada || 0) - (ing.qtd_ficha || 0)) > 0.001;
                    return (
                      <div key={idx} style={{
                        background: alterado ? "rgba(249,115,22,0.08)" : "#0F172A",
                        border: `1.5px solid ${alterado ? "#F97316" : "#334155"}`,
                        borderRadius: 14, padding: "12px 16px",
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                          <p style={{ color: "#F1F5F9", fontSize: 14, fontWeight: 700 }}>{ing.nome}</p>
                          {alterado && (
                            <span style={{ fontSize: 11, fontWeight: 700, color: "#F97316", background: "rgba(249,115,22,0.15)", padding: "2px 8px", borderRadius: 6 }}>
                              ALTERADO
                            </span>
                          )}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
                          <span style={{ color: "#64748B", fontSize: 12, minWidth: 100 }}>
                            Receita: {ing.qtd_ficha} {ing.unidade}
                          </span>
                          <input type="number" value={ing.qtd_usada} step="0.1" min="0"
                            onChange={(e) => atualizarQtdUsada(idx, e.target.value)}
                            style={{
                              flex: 1, height: 38, textAlign: "center", borderRadius: 10,
                              background: "#1E293B", border: `1px solid ${alterado ? "#F97316" : "#475569"}`,
                              color: "#F1F5F9", fontSize: 15, fontWeight: 600, outline: "none",
                            }} />
                          <span style={{ color: "#475569", fontSize: 12 }}>{ing.unidade}</span>
                        </div>
                        <p style={{ color: "#475569", fontSize: 11 }}>
                          Disponível: {ing.disponivel} {ing.unidade} · Custo: {fmtBRL(ing.custo_unit)}/{ing.unidade}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Motivo da alteração — SÓ aparece se alterou ingredientes */}
          {teveAlteracao && (
            <div style={{ background: "rgba(249,115,22,0.06)", border: "1.5px solid #F97316", borderRadius: 14, padding: 16 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 6, color: "#F97316", fontSize: 12, fontWeight: 700, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                <AlertTriangle size={14} /> Motivo da alteração nos ingredientes *
              </label>
              <p style={{ color: "#94A3B8", fontSize: 12, marginBottom: 10 }}>
                A quantidade utilizada está diferente da ficha técnica. Informe o motivo:
              </p>
              <input value={motivo} onChange={(e) => { setMotivo(e.target.value); setErro(""); }}
                placeholder="Ex: Usou mais farinha pois a massa ficou seca, ingrediente menor que o padrão..."
                style={{
                  width: "100%", height: 52, padding: "0 16px", borderRadius: 12,
                  background: "#0F172A", border: "1.5px solid #F97316",
                  color: "#F1F5F9", fontSize: 15, outline: "none",
                }} />
            </div>
          )}

          {/* Sobras / Resultado */}
          <div>
            <label style={{ color: "#64748B", fontSize: 12, fontWeight: 700, marginBottom: 8, display: "block", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Sobras / Resultado da produção *
            </label>
            <input value={sobras} onChange={(e) => { setSobras(e.target.value); setErro(""); }}
              placeholder="Ex: Nada sobrou, sobrou 2 porções, massa guardada na geladeira..."
              style={{
                width: "100%", height: 52, padding: "0 16px", borderRadius: 12,
                background: "#0F172A", border: "1.5px solid #334155",
                color: "#F1F5F9", fontSize: 15, outline: "none",
              }} />
          </div>

          {/* Resumo financeiro */}
          {pratoId && ingredientes.length > 0 && (
            <div style={{ background: "#0F172A", borderRadius: 14, padding: 16, border: "1px solid #334155" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ color: "#64748B", fontSize: 13 }}>Custo dos ingredientes:</span>
                <span style={{ color: "#EF4444", fontSize: 14, fontWeight: 700 }}>
                  {fmtBRL(ingredientes.reduce((a, i) => a + (i.qtd_usada || 0) * (i.custo_unit || 0), 0))}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ color: "#64748B", fontSize: 13 }}>
                  Receita potencial ({quantidade || 0} {unidadeMedida} x {fmtBRL(prato?.preco || prato?.preco_venda || 0)}):
                </span>
                <span style={{ color: "#10B981", fontSize: 14, fontWeight: 700 }}>
                  {fmtBRL((prato?.preco || prato?.preco_venda || 0) * (Number(quantidade) || 0))}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid #334155", paddingTop: 8 }}>
                <span style={{ color: "#94A3B8", fontSize: 13, fontWeight: 600 }}>Lucro estimado:</span>
                <span style={{ color: "#3B82F6", fontSize: 15, fontWeight: 800 }}>
                  {fmtBRL((prato?.preco || prato?.preco_venda || 0) * (Number(quantidade) || 0) - ingredientes.reduce((a, i) => a + (i.qtd_usada || 0) * (i.custo_unit || 0), 0))}
                </span>
              </div>
            </div>
          )}

          {/* Erro */}
          {erro && (
            <p style={{
              background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)",
              borderRadius: 10, padding: "10px 14px", color: "#EF4444", fontSize: 13, fontWeight: 600,
            }}>{erro}</p>
          )}

          {/* Botões */}
          <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
            <button onClick={onClose} style={{
              flex: 1, height: 52, borderRadius: 14, background: "#334155",
              border: "none", color: "#94A3B8", fontSize: 16, fontWeight: 700, cursor: "pointer",
            }}>Cancelar</button>
            <button onClick={confirmar} disabled={loading} style={{
              flex: 2, height: 52, borderRadius: 14,
              background: loading ? "#475569" : "#F97316",
              border: "none", color: "#fff", fontSize: 16, fontWeight: 700,
              cursor: loading ? "default" : "pointer", transition: "background 150ms",
            }}>
              {loading ? "Registrando..." : "Registrar Lote Produzido"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Componente Principal ────────────────────────────────────────────────────
export default function ProducaoModule({ setor }) {
  const router = useRouter();
  const { unidadeAtiva } = useERP();

  const [producoes, setProducoes] = useState([]);
  const [pratos, setPratos] = useState([]);
  const [estoque, setEstoque] = useState([]);
  const [funcionarios, setFuncionarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [modal, setModal] = useState(false);
  const [toast, setToast] = useState(null);
  const [busca, setBusca] = useState("");

  const carregar = useCallback(async () => {
    setLoading(true);
    const [resP, resItens, resE, resF] = await Promise.all([
      fetchProducoes(unidadeAtiva, setor),
      // Bar puxa do módulo Drinks, Cozinha puxa do Cardápio
      setor === "bar" ? fetchDrinks(unidadeAtiva) : fetchCardapio(unidadeAtiva),
      fetchEstoque(unidadeAtiva),
      fetchFuncionarios(unidadeAtiva),
    ]);
    setProducoes(resP.data || []);

    // Normaliza: drinks têm preco_venda, cardapio tem preco
    const itens = (resItens.data || []).filter((p) => p.ativo !== false);
    setPratos(itens);

    setEstoque(resE.data || []);
    setFuncionarios((resF.data || []).filter((f) => f.ativo !== false && f.status !== "inativo"));
    setLoading(false);
  }, [unidadeAtiva, setor]);

  useEffect(() => { carregar(); }, [carregar]);

  const resumo = useMemo(() => calcularResumo(producoes), [producoes]);

  const historicoFiltrado = useMemo(() =>
    producoes.filter((p) =>
      p.prato_nome?.toLowerCase().includes(busca.toLowerCase())
      || p.funcionario_nome?.toLowerCase().includes(busca.toLowerCase())
    ), [producoes, busca]);

  async function confirmarProducao(prod, ingredientes) {
    setSalvando(true);
    const { error } = await registrarProducao(prod, ingredientes, unidadeAtiva);
    setSalvando(false);
    if (error) {
      setToast({ msg: "Erro: " + error, tipo: "erro" });
      return;
    }
    setModal(false);
    setToast({ msg: "Lote de produção registrado. Estoque do produto atualizado!", tipo: "ok" });
    carregar();
  }

  const titulo = setor === "bar" ? "🍹 Produção para Bar" : "👨‍🍳 Produção para Cozinha";
  const subtitulo = "Registro de lote produzido e formação do Estoque de Prontos";

  return (
    <div className="min-h-screen">
      <PageHeader title={titulo} subtitle={subtitulo} icon={Flame}
        onAction={() => setModal(true)} actionLabel="Nova Produção" />
      <PageBody>
        {toast && (
          <Toast show={true} onClose={() => setToast(null)}>
            {toast.msg}
          </Toast>
        )}

        {/* KPIs financeiros */}
        <KpiGrid>
          <Kpi icon={DollarSign} label="Custo da Produção" value={fmtBRL(resumo.custoTotal)} tint="#EF4444" />
          <Kpi icon={TrendingUp} label="Receita Potencial" value={fmtBRL(resumo.receitaPotencial)} tint="#10B981" />
          <Kpi icon={BarChart3} label="Lucro Estimado" value={fmtBRL(resumo.lucroEstimado)} tint="#3B82F6" />
          <Kpi icon={Flame} label="Itens Produzidos" value={resumo.totalProduzido} tint="#F97316" />
        </KpiGrid>

        <SearchBar value={busca} onChange={setBusca} placeholder="Buscar por produção ou funcionário..." />

        {/* Histórico */}
        <div className="space-y-3">
          <p className="text-xs font-bold uppercase" style={{ color: "var(--dim)", letterSpacing: "0.05em" }}>
            Histórico de Produções ({historicoFiltrado.length})
          </p>

          {loading ? (
            <div style={{ textAlign: "center", padding: "60px 0", color: "var(--muted)" }}>
              Carregando...
            </div>
          ) : historicoFiltrado.length === 0 ? (
            <Card className="!p-8 text-center">
              <Flame size={48} style={{ color: "var(--muted)", opacity: 0.3, margin: "0 auto 12px" }} />
              <p style={{ color: "var(--dim)", fontSize: 15, fontWeight: 600 }}>
                Nenhuma produção registrada ainda
              </p>
              <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 4 }}>
                Clique em &quot;Nova Produção&quot; para começar
              </p>
            </Card>
          ) : (
            historicoFiltrado.map((p) => {
              let ings = [];
              try { ings = typeof p.ingredientes_usados === "string" ? JSON.parse(p.ingredientes_usados) : (p.ingredientes_usados || []); } catch (_) {}

              return (
                <Card key={p.id} className="!p-4">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <div style={{
                        width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                        background: "rgba(249,115,22,0.12)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        <Flame size={22} color="#F97316" />
                      </div>
                      <div>
                        <p className="font-bold text-base" style={{ color: "var(--fg)" }}>{p.prato_nome}</p>
                        <div className="flex items-center gap-2 flex-wrap" style={{ marginTop: 2 }}>
                          <span className="text-xs font-semibold" style={{ color: "var(--dim)" }}>
                            {fmtData(p.created_at)} {fmtHora(p.created_at)}
                          </span>
                          {p.funcionario_nome && (
                            <span className="text-xs flex items-center gap-1" style={{ color: "var(--muted)" }}>
                              <User size={11} /> {p.funcionario_nome}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-lg font-extrabold" style={{ color: "#F97316" }}>
                        {p.quantidade}{p.unidade_medida ? ` ${p.unidade_medida}` : "x"}
                      </p>
                    </div>
                  </div>

                  {/* Financeiro */}
                  <div className="flex gap-3 mb-3 flex-wrap">
                    <div style={{ background: "rgba(239,68,68,0.08)", borderRadius: 10, padding: "8px 12px", flex: 1, minWidth: 120 }}>
                      <p style={{ color: "#64748B", fontSize: 10, fontWeight: 700, textTransform: "uppercase" }}>Custo</p>
                      <p style={{ color: "#EF4444", fontSize: 16, fontWeight: 800 }}>{fmtBRL(p.custo_total)}</p>
                    </div>
                    <div style={{ background: "rgba(16,185,129,0.08)", borderRadius: 10, padding: "8px 12px", flex: 1, minWidth: 120 }}>
                      <p style={{ color: "#64748B", fontSize: 10, fontWeight: 700, textTransform: "uppercase" }}>Receita Potencial</p>
                      <p style={{ color: "#10B981", fontSize: 16, fontWeight: 800 }}>{fmtBRL(p.receita_potencial)}</p>
                    </div>
                    <div style={{ background: "rgba(59,130,246,0.08)", borderRadius: 10, padding: "8px 12px", flex: 1, minWidth: 120 }}>
                      <p style={{ color: "#64748B", fontSize: 10, fontWeight: 700, textTransform: "uppercase" }}>Lucro</p>
                      <p style={{ color: "#3B82F6", fontSize: 16, fontWeight: 800 }}>{fmtBRL((p.receita_potencial || 0) - (p.custo_total || 0))}</p>
                    </div>
                  </div>

                  {p.teve_alteracao && (
                    <div style={{
                      background: "rgba(249,115,22,0.08)", border: "1px solid rgba(249,115,22,0.25)",
                      borderRadius: 10, padding: "10px 14px", marginBottom: 10,
                    }}>
                      <p style={{ color: "#F97316", fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
                        <AlertTriangle size={14} /> ALTERAÇÃO NA RECEITA
                      </p>
                      <p style={{ color: "#94A3B8", fontSize: 13, marginTop: 4 }}>{p.motivo_alteracao}</p>
                    </div>
                  )}

                  {ings.length > 0 && (
                    <details style={{ marginTop: 4 }}>
                      <summary style={{ color: "var(--muted)", fontSize: 12, fontWeight: 600, cursor: "pointer", marginBottom: 6 }}>
                        Ver ingredientes utilizados ({ings.length})
                      </summary>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        {ings.map((ing, i) => {
                          const alt = Math.abs((ing.qtd_usada || 0) - (ing.qtd_ficha || 0)) > 0.001;
                          return (
                            <div key={i} style={{
                              display: "flex", justifyContent: "space-between", alignItems: "center",
                              padding: "6px 10px", borderRadius: 8,
                              background: alt ? "rgba(249,115,22,0.06)" : "transparent",
                            }}>
                              <span style={{ color: "var(--fg)", fontSize: 13 }}>{ing.nome}</span>
                              <span style={{ color: alt ? "#F97316" : "var(--dim)", fontSize: 12, fontWeight: 600 }}>
                                {alt && <span style={{ textDecoration: "line-through", marginRight: 6, opacity: 0.5 }}>{ing.qtd_ficha}</span>}
                                {ing.qtd_usada} {ing.unidade}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </details>
                  )}

                  {p.sobras && (
                    <p style={{ color: "var(--muted)", fontSize: 12, marginTop: 8 }}>
                      💡 Sobras: {p.sobras}
                    </p>
                  )}
                </Card>
              );
            })
          )}
        </div>
      </PageBody>

      {modal && (
        <ModalNovaProducao
          pratos={pratos}
          estoque={estoque}
          funcionarios={funcionarios}
          setor={setor}
          onConfirmar={confirmarProducao}
          onClose={() => setModal(false)}
          loading={salvando}
        />
      )}
    </div>
  );
}
