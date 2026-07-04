"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Warehouse, Plus, Minus, History, Trash2, Edit3, Boxes, Layers, PackageX, X
} from "lucide-react";
import {
  PageHeader, PageBody, EmptyState, Modal, Field, TextInput, NumberInput, Select, Btn, Toast, SearchBar, Chips, SkeletonList, fmtBRL
} from "../../../components/ui";
import { useERP } from "../../../context/ERPContext";
import {
  fetchInventario, salvarItemInventario, removerItemInventario,
  registrarMovimentoInventario, fetchMovimentosInventario, CATEGORIAS_INVENTARIO
} from "../../../lib/inventario";

const TIPOS_BAIXA = [
  { id: "quebra", label: "Quebra" },
  { id: "perda", label: "Perda" },
  { id: "descarte", label: "Descarte" },
];
const COR_TIPO = {
  entrada:  { bg: "rgba(5,150,105,0.10)", fg: "#047857", label: "Entrada" },
  quebra:   { bg: "rgba(239,68,68,0.10)", fg: "#DC2626", label: "Quebra" },
  perda:    { bg: "rgba(239,68,68,0.10)", fg: "#DC2626", label: "Perda" },
  descarte: { bg: "rgba(245,158,11,0.12)", fg: "#B45309", label: "Descarte" },
  ajuste:   { bg: "rgba(59,130,246,0.10)", fg: "#2563EB", label: "Ajuste" },
};

function fmtDataHora(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${d.toLocaleDateString("pt-BR")} às ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
}

export default function InventarioPage() {
  const { unidadeAtiva, unidadeInfo } = useERP();
  const [itens, setItens] = useState([]);
  const [movimentos, setMovimentos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [catFiltro, setCatFiltro] = useState("Todas");
  const [toast, setToast] = useState("");

  // Modais
  const [modalItem, setModalItem] = useState(false);
  const [form, setForm] = useState(null);
  const [modalMov, setModalMov] = useState(null); // { item, modo: 'entrada' | 'baixa' | 'ajuste' }
  const [movForm, setMovForm] = useState({});
  const [modalHist, setModalHist] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const notificar = (msg) => { setToast(msg); setTimeout(() => setToast(""), 2800); };

  const carregar = async () => {
    setLoading(true);
    const [ri, rm] = await Promise.all([
      fetchInventario(unidadeAtiva),
      fetchMovimentosInventario(unidadeAtiva),
    ]);
    setItens(ri.data || []);
    setMovimentos(rm.data || []);
    setLoading(false);
  };

  useEffect(() => { if (unidadeAtiva) carregar(); }, [unidadeAtiva]);

  // ── Resumo ────────────────────────────────────────────────────────────────
  const resumo = useMemo(() => {
    const totalUnidades = itens.reduce((s, i) => s + (Number(i.quantidade) || 0), 0);
    const categorias = [...new Set(itens.map(i => i.categoria || "Outros"))];
    const valorTotal = itens.reduce((s, i) => s + (Number(i.valor_unitario) || 0) * (Number(i.quantidade) || 0), 0);
    const mes = new Date().toISOString().slice(0, 7);
    const baixasMes = movimentos
      .filter(m => ["quebra", "perda", "descarte"].includes(m.tipo) && String(m.created_at || "").slice(0, 7) === mes)
      .reduce((s, m) => s + (Number(m.quantidade) || 0), 0);
    return { totalUnidades, tipos: itens.length, categorias, valorTotal, baixasMes };
  }, [itens, movimentos]);

  const filtrados = itens.filter(i =>
    i.nome.toLowerCase().includes(busca.toLowerCase()) &&
    (catFiltro === "Todas" || (i.categoria || "Outros") === catFiltro)
  );
  const porCategoria = useMemo(() => {
    const g = {};
    filtrados.forEach(i => {
      const c = i.categoria || "Outros";
      (g[c] = g[c] || []).push(i);
    });
    return Object.entries(g).sort((a, b) => a[0].localeCompare(b[0], "pt-BR"));
  }, [filtrados]);

  // ── Ações ─────────────────────────────────────────────────────────────────
  const abrirNovo = () => {
    setForm({ id: null, nome: "", categoria: catFiltro !== "Todas" ? catFiltro : "Talheres", quantidade: "", valor_unitario: "", localizacao: "", observacao: "" });
    setModalItem(true);
  };
  const abrirEditar = (item) => {
    setForm({ id: item.id, nome: item.nome, categoria: item.categoria || "Outros", quantidade: String(item.quantidade ?? ""), valor_unitario: item.valor_unitario ?? "", localizacao: item.localizacao || "", observacao: item.observacao || "" });
    setModalItem(true);
  };

  const salvarItem = async (e) => {
    e.preventDefault();
    if (!form.nome.trim()) return alert("Dê um nome ao item.");
    setSalvando(true);
    const ehNovo = !form.id;
    const { id, error } = await salvarItemInventario({
      id: form.id,
      unidade_id: unidadeAtiva,
      nome: form.nome.trim(),
      categoria: form.categoria || "Outros",
      quantidade: Number(form.quantidade) || 0,
      valor_unitario: form.valor_unitario === "" ? null : Number(form.valor_unitario),
      localizacao: form.localizacao || null,
      observacao: form.observacao || null,
    });
    if (!error && ehNovo && id && (Number(form.quantidade) || 0) > 0) {
      // Primeira contagem entra no histórico como entrada (com data/hora)
      await supabaseMovimentoInicial(id);
    }
    setSalvando(false);
    if (error) return alert("Erro ao salvar: " + error);
    notificar(ehNovo ? "Item adicionado ao inventário!" : "Item atualizado!");
    setModalItem(false);
    carregar();
  };

  // registra a entrada inicial de um item recém-criado
  const supabaseMovimentoInicial = async (novoId) => {
    await registrarMovimentoInventario(
      { id: novoId, unidade_id: unidadeAtiva, quantidade: 0 },
      { tipo: "entrada", quantidade: Number(form.quantidade) || 0, motivo: "Cadastro inicial" }
    );
  };

  const excluirItem = async (item) => {
    if (!confirm(`Excluir "${item.nome}" do inventário? O histórico dele também será apagado.`)) return;
    const { error } = await removerItemInventario(item.id);
    if (error) return alert("Erro: " + error);
    notificar("Item excluído.");
    carregar();
  };

  const abrirMov = (item, modo) => {
    setModalMov({ item, modo });
    setMovForm({ tipo: modo === "baixa" ? "quebra" : modo, quantidade: "", motivo: "", responsavel: "" });
  };

  const confirmarMov = async (e) => {
    e.preventDefault();
    const qtd = Number(movForm.quantidade) || 0;
    if (qtd <= 0) return alert("Informe a quantidade.");
    const { item, modo } = modalMov;
    const tipo = modo === "entrada" ? "entrada" : modo === "ajuste" ? "ajuste" : movForm.tipo;
    if (tipo !== "entrada" && tipo !== "ajuste" && qtd > (Number(item.quantidade) || 0)) {
      if (!confirm(`Você está dando baixa de ${qtd}, mas só há ${item.quantidade} no inventário. Continuar (o saldo vai a zero)?`)) return;
    }
    const { error } = await registrarMovimentoInventario(item, {
      tipo, quantidade: qtd, motivo: movForm.motivo, responsavel: movForm.responsavel,
    });
    if (error) return alert("Erro: " + error);
    notificar(tipo === "entrada" ? "Entrada registrada!" : tipo === "ajuste" ? "Quantidade ajustada!" : "Baixa registrada!");
    setModalMov(null);
    carregar();
  };

  if (!unidadeAtiva || unidadeAtiva === "todas") {
    return (
      <div className="min-h-screen">
        <PageHeader title="Inventário da Unidade" subtitle="Patrimônio físico da loja" icon={Warehouse} />
        <PageBody>
          <EmptyState icon={Warehouse} title="Selecione uma unidade" hint="Escolha a unidade no topo para ver o inventário dela." />
        </PageBody>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24">
      <PageHeader title="Inventário da Unidade" subtitle={`Tudo que ${unidadeInfo?.nome || "a loja"} possui — com histórico de entradas, quebras e perdas`} icon={Warehouse}
        onAction={abrirNovo} actionLabel="Novo Item">
        <Btn variant="ghost" className="!h-9 text-xs" onClick={() => setModalHist(true)}>
          <History size={14} /> Histórico
        </Btn>
      </PageHeader>

      <PageBody>
        <Toast show={!!toast}>{toast}</Toast>

        {/* Totais */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          <div className="erp-card p-5 text-center">
            <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: "var(--muted)" }}>Total de itens</p>
            <p className="text-3xl font-extrabold tracking-tight mt-1" style={{ color: "var(--fg)" }}>{resumo.totalUnidades.toLocaleString("pt-BR")}</p>
            <p className="text-[10px] font-medium" style={{ color: "var(--dim)" }}>unidades somadas</p>
          </div>
          <div className="erp-card p-5 text-center">
            <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: "var(--muted)" }}>Tipos cadastrados</p>
            <p className="text-3xl font-extrabold tracking-tight mt-1" style={{ color: "var(--fg)" }}>{resumo.tipos}</p>
            <p className="text-[10px] font-medium" style={{ color: "var(--dim)" }}>em {resumo.categorias.length} categoria{resumo.categorias.length !== 1 ? "s" : ""}</p>
          </div>
          <div className="erp-card p-5 text-center">
            <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: "var(--muted)" }}>Baixas no mês</p>
            <p className="text-3xl font-extrabold tracking-tight mt-1" style={{ color: resumo.baixasMes > 0 ? "#DC2626" : "var(--fg)" }}>{resumo.baixasMes.toLocaleString("pt-BR")}</p>
            <p className="text-[10px] font-medium" style={{ color: "var(--dim)" }}>quebras, perdas e descartes</p>
          </div>
          <div className="erp-card p-5 text-center">
            <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: "var(--muted)" }}>Valor do patrimônio</p>
            <p className="text-2xl font-extrabold tracking-tight mt-1.5" style={{ color: "var(--accent-strong)" }}>{fmtBRL(resumo.valorTotal)}</p>
            <p className="text-[10px] font-medium" style={{ color: "var(--dim)" }}>itens com valor informado</p>
          </div>
        </div>

        {/* Busca + filtro por categoria */}
        <div className="space-y-3">
          <SearchBar value={busca} onChange={setBusca} placeholder="Buscar item... (ex: garfo, freezer, pote)" />
          <Chips options={["Todas", ...CATEGORIAS_INVENTARIO]} value={catFiltro} onChange={setCatFiltro} />
        </div>

        {/* Lista agrupada por categoria */}
        {loading ? (
          <SkeletonList rows={5} />
        ) : filtrados.length === 0 ? (
          <EmptyState icon={Boxes} title={itens.length === 0 ? "Inventário vazio" : "Nada encontrado"}
            hint={itens.length === 0 ? "Cadastre tudo que a loja possui: talheres, potes, panelas, freezers, móveis..." : "Tente outra busca ou categoria."}
            actionLabel={itens.length === 0 ? "Adicionar primeiro item" : undefined}
            onAction={itens.length === 0 ? abrirNovo : undefined} />
        ) : (
          <div className="space-y-6">
            {porCategoria.map(([cat, lista]) => (
              <div key={cat}>
                <div className="flex items-center justify-between mb-2">
                  <p className="erp-label flex items-center gap-1.5"><Layers size={12} /> {cat}</p>
                  <span className="text-[11px] font-black" style={{ color: "var(--muted)" }}>
                    {lista.reduce((s, i) => s + (Number(i.quantidade) || 0), 0).toLocaleString("pt-BR")} un · {lista.length} tipo{lista.length !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="erp-card divide-y" style={{ borderColor: "var(--line)" }}>
                  {lista.map(item => {
                    const zerado = (Number(item.quantidade) || 0) <= 0;
                    return (
                      <div key={item.id} className="px-4 py-3 flex items-center gap-3" style={{ borderColor: "var(--line-soft)" }}>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm truncate" style={{ color: "var(--fg)" }}>{item.nome}</p>
                          <p className="text-[10px] font-medium truncate" style={{ color: "var(--dim)" }}>
                            {item.localizacao ? `${item.localizacao} · ` : ""}
                            {Number(item.valor_unitario) > 0 ? `${fmtBRL(item.valor_unitario)}/un` : "sem valor informado"}
                          </p>
                        </div>
                        <div className="w-16 text-center shrink-0">
                          <p className="text-xl font-extrabold leading-none" style={{ color: zerado ? "#DC2626" : "var(--fg)" }}>{Number(item.quantidade).toLocaleString("pt-BR")}</p>
                          <p className="text-[9px] font-black uppercase tracking-widest" style={{ color: zerado ? "#DC2626" : "var(--dim)" }}>{zerado ? "zerado" : "un"}</p>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <button onClick={() => abrirMov(item, "entrada")} title="Entrada (comprei/ganhei mais)"
                            className="px-2.5 py-2 rounded-lg font-bold text-xs flex items-center gap-1 transition-colors"
                            style={{ background: "var(--accent-soft)", color: "var(--accent-strong)" }}>
                            <Plus size={13} /> Entrada
                          </button>
                          <button onClick={() => abrirMov(item, "baixa")} title="Baixa (quebra/perda/descarte)"
                            className="px-2.5 py-2 rounded-lg font-bold text-xs flex items-center gap-1 transition-colors"
                            style={{ background: "var(--danger-soft)", color: "var(--danger-strong)" }}>
                            <Minus size={13} /> Baixa
                          </button>
                          <button onClick={() => abrirEditar(item)} title="Editar" className="p-2 rounded-lg transition-colors" style={{ background: "var(--elevated)", color: "var(--muted)" }}>
                            <Edit3 size={14} />
                          </button>
                          <button onClick={() => excluirItem(item)} title="Excluir" className="p-2 rounded-lg transition-colors" style={{ background: "var(--elevated)", color: "var(--muted)" }}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </PageBody>

      {/* Modal: novo/editar item */}
      <Modal open={modalItem} onClose={() => setModalItem(false)} title={form?.id ? "Editar Item" : "Novo Item do Inventário"}>
        {form && (
          <form onSubmit={salvarItem}>
            <Field label="Nome do item">
              <TextInput value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} placeholder="Ex: Garfo de mesa inox, Freezer horizontal 400L..." required />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Categoria">
                <Select value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value })}>
                  {CATEGORIAS_INVENTARIO.map(c => <option key={c} value={c}>{c}</option>)}
                </Select>
              </Field>
              <Field label={form.id ? "Quantidade" : "Quantidade inicial"}>
                <NumberInput value={form.quantidade} onChange={e => setForm({ ...form, quantidade: e.target.value })} placeholder="Ex: 50" min="0" step="1" required />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Valor por unidade (opcional)">
                <NumberInput value={form.valor_unitario} onChange={e => setForm({ ...form, valor_unitario: e.target.value })} placeholder="Ex: 4,50" min="0" step="0.01" />
              </Field>
              <Field label="Onde fica (opcional)">
                <TextInput value={form.localizacao} onChange={e => setForm({ ...form, localizacao: e.target.value })} placeholder="Ex: Cozinha, Bar, Depósito" />
              </Field>
            </div>
            <Field label="Observações (opcional)">
              <TextInput value={form.observacao} onChange={e => setForm({ ...form, observacao: e.target.value })} placeholder="Ex: marca, estado de conservação..." />
            </Field>
            <div className="mt-5 flex gap-3">
              <Btn type="button" variant="ghost" className="flex-1" onClick={() => setModalItem(false)}>Cancelar</Btn>
              <Btn type="submit" variant="primary" className="flex-1" disabled={salvando}>{salvando ? "Salvando..." : "Salvar"}</Btn>
            </div>
          </form>
        )}
      </Modal>

      {/* Modal: entrada / baixa / ajuste */}
      <Modal open={!!modalMov} onClose={() => setModalMov(null)}
        title={modalMov ? (modalMov.modo === "entrada" ? `Entrada: ${modalMov.item.nome}` : modalMov.modo === "ajuste" ? `Ajustar contagem: ${modalMov.item.nome}` : `Baixa: ${modalMov.item.nome}`) : ""}>
        {modalMov && (
          <form onSubmit={confirmarMov}>
            <p className="text-xs font-medium mb-4" style={{ color: "var(--muted)" }}>
              Saldo atual: <b style={{ color: "var(--fg)" }}>{Number(modalMov.item.quantidade).toLocaleString("pt-BR")} un</b> · registro em <b>{fmtDataHora(new Date().toISOString())}</b>
            </p>
            {modalMov.modo === "baixa" && (
              <Field label="Motivo da baixa">
                <Select value={movForm.tipo} onChange={e => setMovForm({ ...movForm, tipo: e.target.value })}>
                  {TIPOS_BAIXA.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                </Select>
              </Field>
            )}
            <Field label={modalMov.modo === "ajuste" ? "Quantidade contada (nova quantidade exata)" : "Quantidade"}>
              <NumberInput value={movForm.quantidade} onChange={e => setMovForm({ ...movForm, quantidade: e.target.value })} placeholder="Ex: 3" min="0" step="1" required />
            </Field>
            <Field label="Detalhe (opcional)">
              <TextInput value={movForm.motivo} onChange={e => setMovForm({ ...movForm, motivo: e.target.value })} placeholder={modalMov.modo === "entrada" ? "Ex: compra no atacadão" : "Ex: caiu no salão, sumiu no evento..."} />
            </Field>
            <Field label="Responsável (opcional)">
              <TextInput value={movForm.responsavel} onChange={e => setMovForm({ ...movForm, responsavel: e.target.value })} placeholder="Quem registrou / quem quebrou" />
            </Field>
            <div className="mt-5 flex gap-3">
              <Btn type="button" variant="ghost" className="flex-1" onClick={() => setModalMov(null)}>Cancelar</Btn>
              <Btn type="submit" variant={modalMov.modo === "entrada" ? "primary" : "danger"} className="flex-1">Confirmar</Btn>
            </div>
          </form>
        )}
      </Modal>

      {/* Modal: histórico de movimentos com data e hora */}
      {modalHist && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto" onClick={() => setModalHist(false)}>
          <div className="w-full max-w-2xl my-8 rounded-3xl border flex flex-col max-h-[85vh]" style={{ background: "var(--card)", borderColor: "var(--line)", boxShadow: "var(--shadow-float)" }} onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center p-6 border-b shrink-0" style={{ borderColor: "var(--line-soft)" }}>
              <div>
                <h2 className="font-black text-xl" style={{ color: "var(--fg)" }}>Histórico do Inventário</h2>
                <p className="text-xs font-bold mt-0.5" style={{ color: "var(--muted)" }}>Entradas, quebras, perdas e ajustes — com data e hora</p>
              </div>
              <button onClick={() => setModalHist(false)} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "var(--elevated)", color: "var(--muted)" }}><X size={17} /></button>
            </div>
            <div className="p-6 overflow-y-auto space-y-2">
              {movimentos.length === 0 ? (
                <EmptyState icon={PackageX} title="Nenhum movimento ainda" hint="As entradas e baixas aparecem aqui com data e hora." />
              ) : movimentos.map(m => {
                const cor = COR_TIPO[m.tipo] || COR_TIPO.ajuste;
                const ehEntrada = m.tipo === "entrada";
                return (
                  <div key={m.id} className="p-3 rounded-xl flex items-center gap-3" style={{ background: "var(--elevated)" }}>
                    <span className="text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-md shrink-0" style={{ background: cor.bg, color: cor.fg }}>{cor.label}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold truncate" style={{ color: "var(--fg)" }}>{m.inventario_itens?.nome || "Item removido"}</p>
                      <p className="text-[10px] font-medium truncate" style={{ color: "var(--dim)" }}>
                        {fmtDataHora(m.created_at)}
                        {m.motivo ? ` · ${m.motivo}` : ""}
                        {m.responsavel ? ` · por ${m.responsavel}` : ""}
                      </p>
                    </div>
                    <span className="font-extrabold text-base shrink-0" style={{ color: cor.fg }}>
                      {m.tipo === "ajuste" ? `= ${Number(m.quantidade).toLocaleString("pt-BR")}` : `${ehEntrada ? "+" : "−"}${Number(m.quantidade).toLocaleString("pt-BR")}`}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
