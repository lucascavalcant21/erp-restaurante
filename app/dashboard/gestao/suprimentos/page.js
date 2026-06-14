"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Package, Plus, Send, AlertTriangle, Building2, Beaker, Archive } from "lucide-react";
import {
  PageHeader, PageBody, Card, KpiGrid, Kpi,
  SearchBar, Chips, EmptyState, Modal, Field, TextInput, NumberInput, Select, Btn, Toast, fmtBRL
} from "../../../../components/ui";
import { useERP } from "../../../../context/ERPContext";
import {
  fetchCatalogoCentral, inserirSuprimentoCentral, atualizarSuprimentoCentral,
  entradaEstoqueCentral, transferirParaUnidade, CATEGORIAS_SUP, UNIDADES_SUP
} from "../../../../lib/suprimentos";
import { UNIDADES } from "../../../../lib/unidades";

const VAZIO = { nome: "", categoria: "Limpeza", unidade_medida: "UN", custo_unitario: "" };

function FormItem({ inicial, onSalvar, onCancelar }) {
  const [f, setF] = useState(inicial ? { ...inicial, custo_unitario: String(inicial.custo_unitario) } : VAZIO);
  const [erro, setErro] = useState("");

  function salvar() {
    if (!f.nome.trim()) return setErro("Informe o nome do item.");
    onSalvar({ ...f, nome: f.nome.trim(), custo_unitario: Number(f.custo_unitario) || 0 });
  }

  return (
    <>
      <Field label="Nome do item (Ex: Sabão em pó)"><TextInput value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} placeholder="Nome..." /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Categoria"><Select value={f.categoria} onChange={(e) => setF({ ...f, categoria: e.target.value })}>{CATEGORIAS_SUP.map(c => <option key={c}>{c}</option>)}</Select></Field>
        <Field label="Unidade"><Select value={f.unidade_medida} onChange={(e) => setF({ ...f, unidade_medida: e.target.value })}>{UNIDADES_SUP.map(u => <option key={u}>{u}</option>)}</Select></Field>
      </div>
      <Field label="Custo Unitário (Global)"><NumberInput value={f.custo_unitario} onChange={(e) => setF({ ...f, custo_unitario: e.target.value })} placeholder="0,00" step="0.01" /></Field>
      
      {erro && <p className="erp-badge erp-badge-danger w-full justify-center mb-3">{erro}</p>}
      <div className="flex gap-3">
        <Btn variant="ghost" className="flex-1" onClick={onCancelar}>Cancelar</Btn>
        <Btn variant="primary" className="flex-1" onClick={salvar}>{inicial ? "Salvar" : "Cadastrar"}</Btn>
      </div>
    </>
  );
}

function FormCompra({ item, onConfirmar, onCancelar }) {
  const [qtd, setQtd] = useState("");
  const n = Number(qtd) || 0;
  return (
    <>
      <p className="text-sm mb-4" style={{ color: "var(--dim)" }}>Registrar nova compra para o estoque central de <strong>{item.nome}</strong>.</p>
      <Field label={`Quantidade (${item.unidade_medida})`}><NumberInput autoFocus value={qtd} onChange={(e) => setQtd(e.target.value)} placeholder="0" /></Field>
      <div className="flex gap-3 mt-4">
        <Btn variant="ghost" className="flex-1" onClick={onCancelar}>Cancelar</Btn>
        <Btn variant="primary" className="flex-1" disabled={n <= 0} onClick={() => onConfirmar(n)}>Confirmar Compra</Btn>
      </div>
    </>
  );
}

function FormTransferencia({ item, onConfirmar, onCancelar }) {
  const [unidade, setUnidade] = useState(UNIDADES[0]?.id || "");
  const [qtd, setQtd] = useState("");
  const [minimo, setMinimo] = useState("");
  
  const q = Number(qtd) || 0;
  const m = Number(minimo) || 0;
  const invalido = !unidade || q <= 0 || q > Number(item.estoque_central);

  return (
    <>
      <div className="p-3 rounded-lg mb-4" style={{ background: "var(--elevated)", border: "1px solid var(--line)" }}>
        <p className="text-xs font-bold" style={{ color: "var(--dim)", textTransform: "uppercase" }}>Disponível na Central</p>
        <p className="text-xl font-bold" style={{ color: "var(--accent-fg)" }}>{item.estoque_central} <span className="text-sm">{item.unidade_medida}</span></p>
      </div>
      
      <Field label="Loja Destino">
        <Select value={unidade} onChange={(e) => setUnidade(e.target.value)}>
          {UNIDADES.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
        </Select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={`Qtd a Enviar (${item.unidade_medida})`}><NumberInput value={qtd} onChange={(e) => setQtd(e.target.value)} placeholder="0" /></Field>
        <Field label="Novo Mínimo na Loja"><NumberInput value={minimo} onChange={(e) => setMinimo(e.target.value)} placeholder="Opcional" /></Field>
      </div>
      {q > Number(item.estoque_central) && <p className="text-xs text-red-500 mt-1 mb-2">Quantidade maior que o disponível na central.</p>}
      
      <div className="flex gap-3 mt-4">
        <Btn variant="ghost" className="flex-1" onClick={onCancelar}>Cancelar</Btn>
        <Btn variant="primary" className="flex-1" disabled={invalido} onClick={() => onConfirmar(unidade, q, m)}>Enviar</Btn>
      </div>
    </>
  );
}

export default function GestaoSuprimentosCentral() {
  const { sessao } = useERP();
  const [lista, setLista] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [cat, setCat] = useState("Todos");
  
  const [modalItem, setModalItem] = useState(false);
  const [modalCompra, setModalCompra] = useState(null); // item a comprar
  const [modalTransf, setModalTransf] = useState(null); // item a transferir
  const [editar, setEditar] = useState(null);
  const [toast, setToast] = useState("");

  const carregar = useCallback(async () => {
    setLoading(true);
    const { data } = await fetchCatalogoCentral();
    setLista(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const filtrados = useMemo(() => lista.filter(i => {
    const mb = i.nome?.toLowerCase().includes(busca.toLowerCase());
    const mc = cat === "Todos" || i.categoria === cat;
    return mb && mc;
  }), [lista, busca, cat]);

  const resumo = useMemo(() => ({
    totalItens: lista.length,
    valorCentral: lista.reduce((a, i) => a + (Number(i.estoque_central) * Number(i.custo_unitario)), 0),
    zerados: lista.filter(i => Number(i.estoque_central) <= 0).length
  }), [lista]);

  async function salvarItem(dados) {
    if (editar) {
      await atualizarSuprimentoCentral(editar.id, dados);
      setToast("Item atualizado!");
    } else {
      await inserirSuprimentoCentral(dados);
      setToast("Item criado na Central!");
    }
    setModalItem(false); setEditar(null);
    setTimeout(() => setToast(""), 3000);
    carregar();
  }

  async function confirmarCompra(qtd) {
    await entradaEstoqueCentral(modalCompra.id, qtd, sessao?.nome || "Admin");
    setToast(`Compradas ${qtd} ${modalCompra.unidade_medida}`);
    setModalCompra(null);
    setTimeout(() => setToast(""), 3000);
    carregar();
  }

  async function confirmarTransf(unidadeId, qtd, min) {
    await transferirParaUnidade(modalTransf.id, unidadeId, qtd, min, sessao?.nome || "Admin");
    const loja = UNIDADES.find(u => u.id === unidadeId)?.nome || unidadeId;
    setToast(`Enviado ${qtd} ${modalTransf.unidade_medida} para ${loja}`);
    setModalTransf(null);
    setTimeout(() => setToast(""), 3000);
    carregar();
  }

  return (
    <div className="min-h-screen">
      <PageHeader 
        title="Estoque Central: Limpeza & Suprimentos" 
        subtitle="Gerencie o abastecimento das lojas e os depósitos globais" 
        icon={Archive} 
        actionLabel="Novo Item no Catálogo"
        onAction={() => { setEditar(null); setModalItem(true); }}
      />
      
      <PageBody>
        <Toast show={!!toast}>{toast}</Toast>

        <KpiGrid>
          <Kpi icon={Archive} label="Itens no Catálogo" value={resumo.totalItens} tint="#3B82F6" />
          <Kpi icon={Building2} label="Valor em Depósito" value={fmtBRL(resumo.valorCentral)} tint="#10B981" />
          <Kpi icon={AlertTriangle} label="Sem Estoque Central" value={resumo.zerados} tint={resumo.zerados > 0 ? "#F59E0B" : "var(--muted)"} />
        </KpiGrid>

        <div className="space-y-3">
          <SearchBar value={busca} onChange={setBusca} placeholder="Buscar item..." />
          <Chips options={["Todos", ...CATEGORIAS_SUP]} value={cat} onChange={setCat} />
        </div>

        {loading ? (
          <EmptyState icon={Beaker} title="Carregando catálogo central..." />
        ) : filtrados.length === 0 ? (
          <EmptyState icon={Beaker} title="Nenhum suprimento encontrado." hint="Ajuste a busca ou cadastre novos materiais." />
        ) : (
          <div className="space-y-3">
            {filtrados.map(i => {
              const central = Number(i.estoque_central) || 0;
              const zerado = central <= 0;
              return (
                <Card key={i.id} className="!p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <p className="text-[10px] font-bold uppercase" style={{ color: "var(--dim)" }}>{i.categoria}</p>
                      <p className="font-bold text-base" style={{ color: "var(--fg)" }}>{i.nome}</p>
                      <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>Custo Global: {fmtBRL(i.custo_unitario)}</p>
                    </div>
                    
                    <div className="text-right">
                      <p className="text-[10px] font-bold uppercase mb-1" style={{ color: "var(--dim)" }}>Depósito Central</p>
                      <div className="inline-flex items-end gap-1">
                        <span className="text-2xl font-black leading-none" style={{ color: zerado ? "#EF4444" : "var(--fg)" }}>{central}</span>
                        <span className="text-xs font-bold leading-tight" style={{ color: "var(--dim)" }}>{i.unidade_medida}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 mt-4 pt-3 border-t" style={{ borderColor: "var(--line)" }}>
                    <button 
                      onClick={() => setModalCompra(i)}
                      className="flex-1 py-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1"
                      style={{ background: "rgba(16,185,129,0.1)", color: "#10B981" }}
                    >
                      <Plus size={14} /> Registrar Compra (Mãe)
                    </button>
                    
                    <button 
                      onClick={() => setModalTransf(i)}
                      disabled={zerado}
                      className="flex-1 py-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1"
                      style={{ background: zerado ? "var(--elevated)" : "var(--accent)", color: zerado ? "var(--muted)" : "var(--accent-fg)", opacity: zerado ? 0.5 : 1 }}
                    >
                      <Send size={14} /> Abastecer Loja
                    </button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </PageBody>

      <Modal open={modalItem} onClose={() => setModalItem(false)} title={editar ? "Editar Item" : "Cadastrar Suprimento"}>
        <FormItem inicial={editar} onSalvar={salvarItem} onCancelar={() => setModalItem(false)} />
      </Modal>

      <Modal open={!!modalCompra} onClose={() => setModalCompra(null)} title="Compra Central">
        {modalCompra && <FormCompra item={modalCompra} onConfirmar={confirmarCompra} onCancelar={() => setModalCompra(null)} />}
      </Modal>

      <Modal open={!!modalTransf} onClose={() => setModalTransf(null)} title="Abastecer Loja / Transferência">
        {modalTransf && <FormTransf item={modalTransf} onConfirmar={confirmarTransf} onCancelar={() => setModalTransf(null)} />}
      </Modal>
    </div>
  );
}

// Alias to fix JSX matching in component
const FormTransf = FormTransferencia;
