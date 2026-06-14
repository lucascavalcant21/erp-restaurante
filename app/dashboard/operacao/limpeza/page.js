"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Sparkles, Minus, Plus, Search, Archive, AlertTriangle } from "lucide-react";
import {
  PageHeader, PageBody, Card, KpiGrid, Kpi,
  SearchBar, Chips, EmptyState, Modal, Field, TextInput, NumberInput, Btn, Toast
} from "../../../../components/ui";
import { useERP } from "../../../../context/ERPContext";
import {
  fetchSuprimentosDaUnidade, registrarConsumo, CATEGORIAS_SUP
} from "../../../../lib/suprimentos";

function FormConsumo({ item, onConfirmar, onCancelar }) {
  const [qtd, setQtd] = useState("");
  const n = Number(qtd) || 0;
  const invalido = n <= 0 || n > Number(item.quantidade);

  return (
    <>
      <div className="p-3 rounded-lg mb-4" style={{ background: "var(--elevated)", border: "1px solid var(--line)" }}>
        <p className="text-xs font-bold" style={{ color: "var(--dim)", textTransform: "uppercase" }}>Disponível na Despensa</p>
        <p className="text-xl font-bold" style={{ color: "var(--accent-fg)" }}>{item.quantidade} <span className="text-sm">{item.unidade_medida}</span></p>
      </div>
      
      <p className="text-sm mb-4" style={{ color: "var(--dim)" }}>Quantos(as) <strong>{item.nome}</strong> foram consumidos/retirados hoje?</p>
      
      <div className="flex items-center gap-4 mb-4">
        <button onClick={() => setQtd((q) => String(Math.max(0, (Number(q) || 0) - 1)))}
          className="w-12 h-12 rounded-xl flex items-center justify-center text-xl font-bold transition"
          style={{ background: "var(--elevated)", color: "var(--fg)" }}>
          <Minus size={20} />
        </button>
        <input 
          type="number" 
          value={qtd} 
          onChange={(e) => setQtd(e.target.value)} 
          className="flex-1 h-12 text-center text-2xl font-black rounded-xl outline-none"
          style={{ background: "var(--bg)", border: "2px solid var(--line)", color: "var(--fg)" }}
          placeholder="0"
        />
        <button onClick={() => setQtd((q) => String((Number(q) || 0) + 1))}
          className="w-12 h-12 rounded-xl flex items-center justify-center text-xl font-bold transition"
          style={{ background: "var(--elevated)", color: "var(--fg)" }}>
          <Plus size={20} />
        </button>
      </div>

      {n > Number(item.quantidade) && <p className="text-xs text-red-500 mb-2">Quantidade maior que o disponível na despensa da unidade.</p>}
      
      <div className="flex gap-3 mt-4">
        <Btn variant="ghost" className="flex-1" onClick={onCancelar}>Cancelar</Btn>
        <Btn variant="primary" className="flex-1" disabled={invalido} onClick={() => onConfirmar(n)}>Dar Baixa Diária</Btn>
      </div>
    </>
  );
}

export default function OperacaoLimpezaUnidade() {
  const { sessao, unidadeAtiva, unidadeInfo } = useERP();
  const [lista, setLista] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [cat, setCat] = useState("Todos");
  
  const [modalBaixa, setModalBaixa] = useState(null); // item a dar baixa
  const [toast, setToast] = useState("");

  const carregar = useCallback(async () => {
    if (!unidadeAtiva || unidadeAtiva === "todas") {
      setLista([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await fetchSuprimentosDaUnidade(unidadeAtiva);
    setLista(data || []);
    setLoading(false);
  }, [unidadeAtiva]);

  useEffect(() => { carregar(); }, [carregar]);

  const filtrados = useMemo(() => lista.filter(i => {
    const mb = i.nome?.toLowerCase().includes(busca.toLowerCase());
    const mc = cat === "Todos" || i.categoria === cat;
    return mb && mc;
  }), [lista, busca, cat]);

  const resumo = useMemo(() => ({
    totalItens: lista.length,
    baixos: lista.filter(i => Number(i.quantidade) <= Number(i.minimo)).length,
  }), [lista]);

  async function confirmarBaixa(qtd) {
    await registrarConsumo(modalBaixa.id, qtd, sessao?.nome || "Equipe");
    setToast(`Consumo de ${qtd} ${modalBaixa.unidade_medida} registrado!`);
    setModalBaixa(null);
    setTimeout(() => setToast(""), 3000);
    carregar();
  }

  if (!unidadeAtiva || unidadeAtiva === "todas") {
    return (
      <div className="min-h-screen">
        <PageHeader title="Limpeza & Suprimentos" subtitle="Gestão de material da unidade" icon={Sparkles} />
        <PageBody>
          <EmptyState icon={Archive} title="Selecione uma unidade" hint="Para ver os suprimentos de limpeza, selecione a unidade no menu lateral." />
        </PageBody>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <PageHeader 
        title={`Limpeza: ${unidadeInfo.nome}`} 
        subtitle="Controle de materiais da despensa local e registro de consumo." 
        icon={Sparkles} 
      />
      
      <PageBody>
        <Toast show={!!toast}>{toast}</Toast>

        <KpiGrid>
          <Kpi icon={Archive} label="Tipos de Materiais na Loja" value={resumo.totalItens} tint="#3B82F6" />
          <Kpi icon={AlertTriangle} label="Estoque Baixo" value={resumo.baixos} tint={resumo.baixos > 0 ? "#EF4444" : "#10B981"} />
        </KpiGrid>

        <div className="space-y-3">
          <SearchBar value={busca} onChange={setBusca} placeholder="Buscar esponja, sabão..." />
          <Chips options={["Todos", ...CATEGORIAS_SUP]} value={cat} onChange={setCat} />
        </div>

        {loading ? (
          <EmptyState icon={Sparkles} title="Carregando suprimentos..." />
        ) : filtrados.length === 0 ? (
          <EmptyState icon={Sparkles} title="Despensa vazia" hint="Nenhum material de limpeza foi transferido pela Central para esta unidade ainda." />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filtrados.map(i => {
              const qtd = Number(i.quantidade) || 0;
              const min = Number(i.minimo) || 0;
              const critico = qtd <= min;
              return (
                <Card key={i.id} className="!p-4 relative overflow-hidden">
                  {critico && (
                    <div className="absolute top-0 right-0 px-2 py-1 text-[9px] font-bold uppercase" style={{ background: "#EF4444", color: "#fff", borderBottomLeftRadius: 8 }}>
                      Estoque Baixo
                    </div>
                  )}
                  
                  <p className="text-[10px] font-bold uppercase mb-1" style={{ color: "var(--dim)" }}>{i.categoria}</p>
                  <p className="font-bold text-lg leading-tight mb-3" style={{ color: "var(--fg)" }}>{i.nome}</p>
                  
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-xs font-bold" style={{ color: "var(--muted)" }}>Saldo Atual</p>
                      <div className="inline-flex items-end gap-1">
                        <span className="text-3xl font-black leading-none" style={{ color: critico ? "#EF4444" : "var(--accent-fg)" }}>{qtd}</span>
                        <span className="text-sm font-bold leading-tight" style={{ color: "var(--dim)" }}>{i.unidade_medida}</span>
                      </div>
                    </div>
                  </div>

                  <button 
                    onClick={() => setModalBaixa(i)}
                    disabled={qtd <= 0}
                    className="w-full py-3 rounded-xl text-sm font-bold transition flex items-center justify-center gap-2"
                    style={{ background: qtd > 0 ? "var(--accent)" : "var(--elevated)", color: qtd > 0 ? "var(--accent-fg)" : "var(--muted)", opacity: qtd > 0 ? 1 : 0.5 }}
                  >
                    <Minus size={16} /> Registrar Consumo
                  </button>
                </Card>
              );
            })}
          </div>
        )}
      </PageBody>

      <Modal open={!!modalBaixa} onClose={() => setModalBaixa(null)} title="Baixa de Limpeza / Consumo">
        {modalBaixa && <FormConsumo item={modalBaixa} onConfirmar={confirmarBaixa} onCancelar={() => setModalBaixa(null)} />}
      </Modal>
    </div>
  );
}
