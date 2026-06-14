"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Package, AlertTriangle, TrendingDown, Wallet, ArrowUpCircle, ArrowDownCircle,
  Edit3, Trash2, Tablet,
} from "lucide-react";
import {
  PageHeader, PageBody, Card, SectionLabel, KpiGrid, Kpi,
  SearchBar, Chips, EmptyState, Modal, Field, TextInput, NumberInput, Select, Btn, Toast, fmtBRL, fmtData,
} from "../../../components/ui";
import { useERP } from "../../../context/ERPContext";
import { fetchEstoque, inserirItem, atualizarItem, movimentar, removerItem } from "../../../lib/estoque";
import { podeEditarGlobal } from "../../../lib/auth";
import { fetchCardapio } from "../../../lib/cardapio";
import { fetchDrinks } from "../../../lib/drinks";

const CATEGORIAS = ["Proteína", "Grão", "Hortifruti", "Laticínios", "Óleo", "Bebida", "Embalagem", "Limpeza", "Outros"];
const UNIDADES_EST = ["KG", "L", "UN", "CX", "MAÇO", "G", "ML"];
const VAZIO = { nome: "", categoria: "Proteína", unidade: "KG", quantidade: "", minimo: "", custo_unitario: "" };

function statusItem(i) {
  if ((i.quantidade ?? 0) <= (i.minimo ?? 0)) return "critico";
  if ((i.quantidade ?? 0) <= (i.minimo ?? 0) * 1.5) return "baixo";
  return "ok";
}

function FormItem({ inicial, onSalvar, onCancelar }) {
  const [f, setF] = useState(inicial
    ? { ...inicial, quantidade: String(inicial.quantidade ?? ""), minimo: String(inicial.minimo ?? ""), custo_unitario: String(Number(inicial.custo_unitario) || Number(inicial.preco_unit) || "") }
    : VAZIO);
  const [erro, setErro] = useState("");
  const set = (k, v) => { setF((p) => ({ ...p, [k]: v })); setErro(""); };

  function salvar() {
    if (!f.nome.trim()) return setErro("Informe o nome do item.");
    onSalvar({
      ...f, nome: f.nome.trim(),
      quantidade: Number(f.quantidade) || 0,
      minimo: Number(f.minimo) || 0,
      custo_unitario: Number(f.custo_unitario) || 0,
    });
  }

  return (
    <>
      <Field label="Nome do item"><TextInput value={f.nome} onChange={(e) => set("nome", e.target.value)} placeholder="ex: Frango (peito)" /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Categoria"><Select value={f.categoria} onChange={(e) => set("categoria", e.target.value)}>{CATEGORIAS.map((c) => <option key={c}>{c}</option>)}</Select></Field>
        <Field label="Unidade"><Select value={f.unidade} onChange={(e) => set("unidade", e.target.value)}>{UNIDADES_EST.map((u) => <option key={u}>{u}</option>)}</Select></Field>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Quantidade"><NumberInput value={f.quantidade} onChange={(e) => set("quantidade", e.target.value)} placeholder="0" /></Field>
        <Field label="Mínimo"><NumberInput value={f.minimo} onChange={(e) => set("minimo", e.target.value)} placeholder="0" /></Field>
        <Field label="Custo un. (R$)"><NumberInput value={f.custo_unitario} onChange={(e) => set("custo_unitario", e.target.value)} placeholder="0,00" step="0.01" /></Field>
      </div>
      {erro && <p className="erp-badge erp-badge-danger w-full justify-center mb-3">{erro}</p>}
      <div className="flex gap-3">
        <Btn variant="ghost" className="flex-1" onClick={onCancelar}>Cancelar</Btn>
        <Btn variant="primary" className="flex-1" onClick={salvar}>{inicial ? "Salvar" : "Adicionar"}</Btn>
      </div>
    </>
  );
}

function FormMov({ item, tipo, produtosCombo, onConfirmar, onCancelar }) {
  const [qtd, setQtd] = useState("");
  const [obs, setObs] = useState("");
  const [produtoDestino, setProdutoDestino] = useState("");
  const entrada = tipo === "entrada";
  const n = parseFloat(qtd) || 0;
  const invalido = n <= 0 || (!entrada && n > (item.quantidade ?? 0)) || (!entrada && !produtoDestino);
  
  function confirmar() {
    let finalObs = obs;
    if (!entrada && produtoDestino) {
      finalObs = `Retirada para produção: ${produtoDestino}${obs ? ` - ${obs}` : ""}`;
    }
    onConfirmar(n, finalObs);
  }

  return (
    <>
      <p className="text-[11px] font-medium mb-3" style={{ color: "var(--dim)" }}>
        {item.nome} · disponível: {item.quantidade} {item.unidade}
      </p>
      
      {!entrada && (
        <Field label="Para qual produção está tirando? *">
          <Select value={produtoDestino} onChange={(e) => setProdutoDestino(e.target.value)}>
            <option value="">Selecione o prato ou drink...</option>
            {produtosCombo.map((p) => (
              <option key={p.id} value={p.nome}>{p.nome}</option>
            ))}
            <option value="Outro (Desperdício, Consumo interno, etc)">Outro (Desperdício, Consumo interno, etc)</option>
          </Select>
        </Field>
      )}

      <Field label={`Quantidade (${item.unidade}) *`}>
        <NumberInput autoFocus value={qtd} onChange={(e) => setQtd(e.target.value)} placeholder="0" step="0.1" />
      </Field>
      
      <Field label="Observação (opcional)">
        <TextInput value={obs} onChange={(e) => setObs(e.target.value)} placeholder={entrada ? "ex: Compra Fornecedor X" : "ex: Complemento da requisição..."} />
      </Field>
      
      <div className="flex gap-3">
        <Btn variant="ghost" className="flex-1" onClick={onCancelar}>Cancelar</Btn>
        <Btn variant="primary" className="flex-1" disabled={invalido} onClick={confirmar}>
          Confirmar {entrada ? "entrada" : "saída"}
        </Btn>
      </div>
    </>
  );
}

export default function EstoquePage() {
  const router = useRouter();
  const { setEstoque: setEstoqueGlobal, unidadeAtiva, sessao } = useERP();
  const podeEditar = sessao ? podeEditarGlobal(sessao.papel) : false;
  const [itens, setItens]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca]     = useState("");
  const [cat, setCat]         = useState("Todos");
  const [modal, setModal]     = useState(false);
  const [editar, setEditar]   = useState(null);
  const [mov, setMov]         = useState(null); // { item, tipo }
  const [salvou, setSalvou]   = useState(false);
  const [produtos, setProdutos] = useState([]);

  const carregar = useCallback(async () => {
    setLoading(true);
    const [resEstoque, resCardapio, resDrinks] = await Promise.all([
      fetchEstoque(unidadeAtiva),
      fetchCardapio(unidadeAtiva),
      fetchDrinks(unidadeAtiva)
    ]);
    setItens(resEstoque.data || []);
    
    // Junta pratos e drinks para o combo de "Produção Alvo"
    const ativos = [...(resCardapio.data || []), ...(resDrinks.data || [])].filter(p => p.ativo !== false);
    // Ordena alfabeticamente
    ativos.sort((a, b) => (a.nome || "").localeCompare(b.nome || ""));
    setProdutos(ativos);
    
    setLoading(false);
  }, [unidadeAtiva]);
  useEffect(() => { carregar(); }, [carregar]);

  // Sincroniza com a Central (Dashboard / IA / Notificações)
  useEffect(() => { if (!loading) setEstoqueGlobal(itens); }, [itens, loading, setEstoqueGlobal]);

  const resumo = useMemo(() => ({
    total: itens.length,
    valor: itens.reduce((a, i) => a + (i.quantidade || 0) * (Number(i.custo_unitario) || Number(i.preco_unit) || 0), 0),
    criticos: itens.filter((i) => statusItem(i) === "critico").length,
    baixos: itens.filter((i) => statusItem(i) === "baixo").length,
  }), [itens]);

  const filtrados = useMemo(() => itens.filter((i) => {
    const mb = i.nome?.toLowerCase().includes(busca.toLowerCase());
    const mc = cat === "Todos" || i.categoria === cat;
    return mb && mc;
  }), [itens, busca, cat]);

  async function salvarItem(dados) {
    const campos = {
      nome: dados.nome, categoria: dados.categoria, unidade: dados.unidade,
      quantidade: dados.quantidade, minimo: dados.minimo,
      preco_unit: dados.custo_unitario, custo_unitario: dados.custo_unitario,
    };
    if (editar) {
      await atualizarItem(editar.id, campos);
    } else {
      await inserirItem(campos, unidadeAtiva);
    }
    await carregar();
    setModal(false); setEditar(null);
    setSalvou(true); setTimeout(() => setSalvou(false), 2200);
  }

  async function confirmarMov(qtd, obs) {
    const { item, tipo } = mov;
    const delta = tipo === "entrada" ? qtd : -qtd;
    setItens((p) => p.map((i) => i.id === item.id ? { ...i, quantidade: Math.max(0, (i.quantidade || 0) + delta) } : i));
    await movimentar(item.id, tipo, qtd, obs);
    setMov(null);
  }

  async function remover(id) {
    await removerItem(id);
    setItens((p) => p.filter((i) => i.id !== id));
  }

  return (
    <div className="min-h-screen">
      <PageHeader title="Estoque" subtitle="Insumos, mínimos e movimentação" icon={Package}
        onAction={podeEditar ? () => { setEditar(null); setModal(true); } : undefined} actionLabel={podeEditar ? "Novo" : undefined}>
        <button
          onClick={() => router.push("/dashboard/operacao/estoque/tablet")}
          className="erp-btn erp-btn-ghost flex items-center gap-2 text-sm"
          title="Abrir modo tablet para a sala de estoque"
          style={{ borderColor: "var(--accent)", color: "var(--accent-fg)" }}
        >
          <Tablet size={16} /> Modo Tablet
        </button>
      </PageHeader>
      <PageBody>
        <Toast show={salvou}>Estoque atualizado!</Toast>

        <KpiGrid>
          <Kpi icon={Package} label="Itens cadastrados" value={resumo.total} tint="var(--accent-fg)" />
          <Kpi icon={Wallet} label="Valor em estoque" value={fmtBRL(resumo.valor)} tint="#3B82F6" />
          <Kpi icon={AlertTriangle} label="Itens críticos" value={resumo.criticos} tint={resumo.criticos > 0 ? "#EF4444" : "#10B981"} />
          <Kpi icon={TrendingDown} label="Estoque baixo" value={resumo.baixos} tint={resumo.baixos > 0 ? "#F59E0B" : "var(--muted)"} />
        </KpiGrid>

        <div className="space-y-3">
          <SearchBar value={busca} onChange={setBusca} placeholder="Buscar item..." />
          <Chips options={["Todos", ...CATEGORIAS]} value={cat} onChange={setCat} />
        </div>

        <div>
          <SectionLabel>{filtrados.length} item{filtrados.length !== 1 ? "ns" : ""}</SectionLabel>
          {loading ? (
            <EmptyState icon={Package} title="Carregando..." />
          ) : filtrados.length === 0 ? (
            <EmptyState icon={Package} title={busca || cat !== "Todos" ? "Nenhum item encontrado" : "Estoque vazio"}
              hint={busca || cat !== "Todos" ? "Ajuste a busca ou o filtro" : "Toque em Novo para cadastrar um insumo"} />
          ) : (
            <div className="space-y-3">
              {filtrados.map((i) => {
                const st = statusItem(i);
                const valor = (i.quantidade || 0) * (Number(i.custo_unitario) || Number(i.preco_unit) || 0);
                const pct = Math.min(((i.quantidade || 0) / ((i.minimo || 1) * 3)) * 100, 100);
                const cor = st === "critico" ? "#EF4444" : st === "baixo" ? "#F59E0B" : "#10B981";
                return (
                  <Card key={i.id}>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "var(--dim)" }}>{i.categoria}</span>
                          {st === "critico" && <span className="erp-badge erp-badge-danger">Crítico</span>}
                          {st === "baixo" && <span className="erp-badge erp-badge-warn">Baixo</span>}
                        </div>
                        <p className="text-base font-bold truncate" style={{ color: "var(--fg)" }}>{i.nome}</p>
                        {i.ultima_entrada && <p className="text-[11px]" style={{ color: "var(--dim)" }}>Última entrada: {fmtData(i.ultima_entrada)}</p>}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-xl font-bold" style={{ color: "var(--fg)" }}>{i.quantidade}</p>
                        <p className="text-[11px]" style={{ color: "var(--dim)" }}>{i.unidade}</p>
                      </div>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden mb-1" style={{ background: "var(--elevated)" }}>
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: cor }} />
                    </div>
                    <div className="flex justify-between text-[10px] font-medium mb-3">
                      <span style={{ color: "var(--dim)" }}>Mín: {i.minimo} {i.unidade}</span>
                      <span style={{ color: "var(--dim)" }}>Valor: {fmtBRL(valor)}</span>
                    </div>
                    <div className="flex gap-2" style={{ borderTop: "1px solid var(--line)", paddingTop: 10 }}>
                      <button onClick={() => setMov({ item: i, tipo: "entrada" })} className="flex-1 flex items-center justify-center gap-1 py-2 text-[11px] font-bold rounded-lg erp-badge-ok"><ArrowUpCircle size={13} /> Entrada</button>
                      <button onClick={() => setMov({ item: i, tipo: "saida" })} className="flex-1 flex items-center justify-center gap-1 py-2 text-[11px] font-bold rounded-lg" style={{ background: "rgba(59,130,246,0.14)", color: "#60A5FA" }}><ArrowDownCircle size={13} /> Saída</button>
                      {podeEditar && (
                        <>
                          <button onClick={() => { setEditar(i); setModal(true); }} className="w-9 flex items-center justify-center rounded-lg" style={{ background: "var(--elevated)" }}><Edit3 size={14} style={{ color: "var(--muted)" }} /></button>
                          <button onClick={() => remover(i.id)} className="w-9 flex items-center justify-center rounded-lg erp-badge-danger"><Trash2 size={14} /></button>
                        </>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </PageBody>

      <Modal open={modal} onClose={() => { setModal(false); setEditar(null); }} title={editar ? "Editar item" : "Novo item"}>
        <FormItem inicial={editar} onSalvar={salvarItem} onCancelar={() => { setModal(false); setEditar(null); }} />
      </Modal>
      <Modal open={!!mov} onClose={() => setMov(null)} title={mov?.tipo === "entrada" ? "Registrar entrada" : "Registrar saída da Dispensa"}>
        {mov && <FormMov item={mov.item} tipo={mov.tipo} produtosCombo={produtos} onConfirmar={confirmarMov} onCancelar={() => setMov(null)} />}
      </Modal>
    </div>
  );
}
