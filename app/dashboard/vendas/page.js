"use client";

import { useState, useEffect, useMemo } from "react";
import {
  ShoppingCart, Plus, Minus, Trash2, Receipt, Check,
  TrendingUp, Clock, XCircle, Search as SearchIcon,
} from "lucide-react";
import {
  PageHeader, PageBody, Card, SectionLabel, KpiGrid, Kpi,
  SearchBar, Chips, EmptyState, Modal, Field, NumberInput, Select, TextInput, Btn, Toast, fmtBRL,
} from "../../components/ui";
import { useERP } from "../../context/ERPContext";
import { fetchCardapio } from "../../lib/cardapio";
import { fetchVendas, registrarVenda, cancelarVenda, FORMAS_PAGAMENTO, labelPagamento } from "../../lib/vendas";

// Início do dia de hoje (ISO) — para filtrar as vendas do histórico
function inicioDeHoje() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}
function horaDe(iso) {
  return iso ? new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "—";
}

export default function VendasPage() {
  const { unidadeAtiva, unidadeInfo } = useERP();

  const [aba, setAba]         = useState("vender"); // vender | historico
  const [produtos, setProdutos] = useState([]);
  const [loading, setLoading] = useState(true);

  const [busca, setBusca]     = useState("");
  const [cat, setCat]         = useState("Todos");

  const [carrinho, setCarrinho] = useState([]); // { id, nome, preco, custo, categoria, quantidade }
  const [checkout, setCheckout] = useState(false);
  const [forma, setForma]       = useState("dinheiro");
  const [desconto, setDesconto] = useState("");
  const [cliente, setCliente]   = useState("");
  const [salvando, setSalvando] = useState(false);
  const [toast, setToast]       = useState("");

  const [vendas, setVendas]     = useState([]);

  // ── Carregamento ──────────────────────────────────────────────────────────
  async function carregarProdutos() {
    setLoading(true);
    const { data } = await fetchCardapio(unidadeAtiva);
    setProdutos((data || []).filter((p) => p.ativo));
    setLoading(false);
  }
  async function carregarVendas() {
    const { data } = await fetchVendas(unidadeAtiva, { desde: inicioDeHoje() });
    setVendas(data || []);
  }
  useEffect(() => {
    carregarProdutos();
    carregarVendas();
    setCarrinho([]);
    /* eslint-disable-next-line */
  }, [unidadeAtiva]);

  // ── Carrinho ──────────────────────────────────────────────────────────────
  function addItem(p) {
    setCarrinho((prev) => {
      const ex = prev.find((x) => x.id === p.id);
      if (ex) return prev.map((x) => x.id === p.id ? { ...x, quantidade: x.quantidade + 1 } : x);
      return [...prev, { id: p.id, nome: p.nome, preco: Number(p.preco) || 0, custo: Number(p.custo) || 0, categoria: p.categoria, quantidade: 1 }];
    });
  }
  function mudarQtd(id, delta) {
    setCarrinho((prev) => prev
      .map((x) => x.id === id ? { ...x, quantidade: x.quantidade + delta } : x)
      .filter((x) => x.quantidade > 0));
  }
  function removerItem(id) { setCarrinho((prev) => prev.filter((x) => x.id !== id)); }
  function limparCarrinho() { setCarrinho([]); }

  const qtdNoCarrinho = (id) => carrinho.find((x) => x.id === id)?.quantidade || 0;

  const subtotal = useMemo(() => carrinho.reduce((a, x) => a + x.preco * x.quantidade, 0), [carrinho]);
  const itensCount = useMemo(() => carrinho.reduce((a, x) => a + x.quantidade, 0), [carrinho]);
  const descN = Math.min(Math.max(0, parseFloat(String(desconto).replace(",", ".")) || 0), subtotal);
  const total = Math.max(0, subtotal - descN);

  // ── Categorias disponíveis ────────────────────────────────────────────────
  const categorias = useMemo(() => {
    const set = [...new Set(produtos.map((p) => p.categoria).filter(Boolean))];
    return ["Todos", ...set];
  }, [produtos]);

  const filtrados = useMemo(() => produtos.filter((p) => {
    const mb = p.nome?.toLowerCase().includes(busca.toLowerCase());
    const mc = cat === "Todos" || p.categoria === cat;
    return mb && mc;
  }), [produtos, busca, cat]);

  // ── Resumo do dia ─────────────────────────────────────────────────────────
  const resumoDia = useMemo(() => {
    const validas = vendas.filter((v) => v.status !== "cancelada");
    return {
      qtd: validas.length,
      faturamento: validas.reduce((a, v) => a + (Number(v.total) || 0), 0),
    };
  }, [vendas]);

  // ── Finalizar venda ───────────────────────────────────────────────────────
  async function finalizar() {
    if (!carrinho.length || salvando) return;
    setSalvando(true);
    const { error, baixaEstoque } = await registrarVenda(
      { itens: carrinho, desconto: descN, forma_pagamento: forma, cliente: cliente.trim() },
      unidadeAtiva,
    );
    setSalvando(false);
    if (error) { setToast(`Erro: ${error}`); setTimeout(() => setToast(""), 3000); return; }
    setCarrinho([]); setDesconto(""); setCliente(""); setForma("dinheiro"); setCheckout(false);
    const baixaMsg = baixaEstoque?.baixados > 0
      ? ` · ${baixaEstoque.baixados} ingrediente(s) baixado(s) do estoque`
      : baixaEstoque?.semEstoque
        ? " · (sem estoque cadastrado)"
        : "";
    setToast(`Venda de ${fmtBRL(total)} registrada!${baixaMsg}`);
    setTimeout(() => setToast(""), 3500);
    carregarVendas();
  }

  async function cancelar(v) {
    await cancelarVenda(v);
    setToast("Venda cancelada e receita estornada.");
    setTimeout(() => setToast(""), 2600);
    carregarVendas();
  }

  // ──────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen">
      <PageHeader title="PDV — Vendas" subtitle={`Ponto de venda · ${unidadeInfo.nome}`} icon={ShoppingCart} back />
      <PageBody>
        {toast && <Toast show>{toast}</Toast>}

        <KpiGrid>
          <Kpi icon={Receipt} label="Vendas hoje" value={resumoDia.qtd} />
          <Kpi icon={TrendingUp} label="Faturamento hoje" value={fmtBRL(resumoDia.faturamento)} />
        </KpiGrid>

        <Chips options={["vender", "historico"].map((v) => ({ value: v, label: v === "vender" ? "Vender" : `Vendas de hoje (${vendas.length})` }))}
          value={aba} onChange={setAba} />

        {aba === "vender" ? (
          <>
            <div className="space-y-3">
              <SearchBar value={busca} onChange={setBusca} placeholder="Buscar produto..." />
              <Chips options={categorias} value={cat} onChange={setCat} />
            </div>

            <div>
              <SectionLabel>{filtrados.length} produto{filtrados.length !== 1 ? "s" : ""}</SectionLabel>
              {loading ? (
                <EmptyState icon={ShoppingCart} title="Carregando cardápio..." />
              ) : filtrados.length === 0 ? (
                <EmptyState icon={SearchIcon}
                  title={produtos.length === 0 ? "Sem produtos ativos" : "Nenhum produto encontrado"}
                  hint={produtos.length === 0 ? "Cadastre pratos ativos em Operação → Cardápio." : "Ajuste a busca ou o filtro."} />
              ) : (
                <div className="space-y-2">
                  {filtrados.map((p) => {
                    const n = qtdNoCarrinho(p.id);
                    return (
                      <Card key={p.id} className="!p-3">
                        <div className="flex items-center gap-3">
                          <div className="flex-1 min-w-0">
                            <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "var(--dim)" }}>{p.categoria}</span>
                            <p className="text-sm font-bold truncate" style={{ color: "var(--fg)" }}>{p.nome}</p>
                            <p className="text-sm font-bold" style={{ color: "var(--accent-fg)" }}>{fmtBRL(p.preco)}</p>
                          </div>
                          {n > 0 ? (
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <button onClick={() => mudarQtd(p.id, -1)} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "var(--elevated)" }}><Minus size={15} style={{ color: "var(--muted)" }} /></button>
                              <span className="text-sm font-bold w-5 text-center" style={{ color: "var(--fg)" }}>{n}</span>
                              <button onClick={() => addItem(p)} className="w-8 h-8 rounded-lg flex items-center justify-center erp-btn-primary"><Plus size={15} /></button>
                            </div>
                          ) : (
                            <button onClick={() => addItem(p)} className="erp-btn erp-btn-primary !h-9 !px-3 text-xs flex-shrink-0"><Plus size={14} /> Add</button>
                          )}
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        ) : (
          <div>
            <SectionLabel>{vendas.length} venda{vendas.length !== 1 ? "s" : ""} hoje</SectionLabel>
            {vendas.length === 0 ? (
              <EmptyState icon={Receipt} title="Nenhuma venda hoje" hint="As vendas registradas no PDV aparecem aqui." />
            ) : (
              <div className="space-y-2">
                {vendas.map((v) => {
                  const cancelada = v.status === "cancelada";
                  const nItens = (v.venda_itens || []).reduce((a, i) => a + (Number(i.quantidade) || 0), 0);
                  return (
                    <Card key={v.id} className="!p-3" style={cancelada ? { opacity: 0.55 } : {}}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-bold" style={{ color: "var(--fg)" }}>
                            {fmtBRL(v.total)} {cancelada && <span className="erp-badge erp-badge-danger ml-1">cancelada</span>}
                          </p>
                          <p className="text-[11px]" style={{ color: "var(--dim)" }}>
                            <Clock size={11} className="inline mr-1" style={{ verticalAlign: "-1px" }} />
                            {horaDe(v.created_at)} · {nItens} item{nItens !== 1 ? "s" : ""} · {labelPagamento(v.forma_pagamento)}
                            {v.cliente ? ` · ${v.cliente}` : ""}
                          </p>
                        </div>
                        {!cancelada && (
                          <button onClick={() => cancelar(v)} className="flex-shrink-0 flex items-center gap-1 text-[11px] font-bold px-2 py-1.5 rounded-lg erp-badge-danger">
                            <XCircle size={13} /> Cancelar
                          </button>
                        )}
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </PageBody>

      {/* Barra inferior do carrinho */}
      {aba === "vender" && carrinho.length > 0 && (
        <div className="fixed bottom-0 right-0 z-30 px-4 py-3"
          style={{ left: 64, background: "var(--surface)", borderTop: "1px solid var(--line)" }}>
          <button onClick={() => setCheckout(true)}
            className="erp-btn erp-btn-primary w-full !h-12 flex items-center justify-between !px-4">
            <span className="flex items-center gap-2"><ShoppingCart size={17} /> {itensCount} item{itensCount !== 1 ? "s" : ""}</span>
            <span className="font-bold">{fmtBRL(subtotal)} · Finalizar</span>
          </button>
        </div>
      )}

      {/* Checkout */}
      <Modal open={checkout} onClose={() => setCheckout(false)} title="Finalizar venda">
        <div className="space-y-2 mb-4">
          {carrinho.map((x) => (
            <div key={x.id} className="flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold truncate" style={{ color: "var(--fg)" }}>{x.nome}</p>
                <p className="text-[11px]" style={{ color: "var(--dim)" }}>{fmtBRL(x.preco)} · un</p>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button onClick={() => mudarQtd(x.id, -1)} className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "var(--elevated)" }}><Minus size={13} style={{ color: "var(--muted)" }} /></button>
                <span className="text-sm font-bold w-5 text-center" style={{ color: "var(--fg)" }}>{x.quantidade}</span>
                <button onClick={() => mudarQtd(x.id, +1)} className="w-7 h-7 rounded-lg flex items-center justify-center erp-btn-primary"><Plus size={13} /></button>
              </div>
              <p className="text-sm font-bold w-20 text-right flex-shrink-0" style={{ color: "var(--fg)" }}>{fmtBRL(x.preco * x.quantidade)}</p>
              <button onClick={() => removerItem(x.id)} className="w-7 h-7 rounded-lg flex items-center justify-center erp-badge-danger flex-shrink-0"><Trash2 size={13} /></button>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Forma de pagamento">
            <Select value={forma} onChange={(e) => setForma(e.target.value)}>
              {FORMAS_PAGAMENTO.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
            </Select>
          </Field>
          <Field label="Desconto (R$)">
            <NumberInput value={desconto} onChange={(e) => setDesconto(e.target.value)} placeholder="0,00" step="0.01" />
          </Field>
        </div>
        <Field label="Cliente (opcional)">
          <TextInput value={cliente} onChange={(e) => setCliente(e.target.value)} placeholder="Nome do cliente" />
        </Field>

        <div className="erp-panel p-3 mb-4 space-y-1">
          <div className="flex justify-between text-[12px]" style={{ color: "var(--muted)" }}>
            <span>Subtotal</span><span>{fmtBRL(subtotal)}</span>
          </div>
          {descN > 0 && (
            <div className="flex justify-between text-[12px]" style={{ color: "#DC2626" }}>
              <span>Desconto</span><span>− {fmtBRL(descN)}</span>
            </div>
          )}
          <div className="flex justify-between items-center pt-1" style={{ borderTop: "1px solid var(--line)" }}>
            <span className="text-sm font-bold" style={{ color: "var(--fg)" }}>Total</span>
            <span className="text-xl font-bold" style={{ color: "var(--accent-fg)" }}>{fmtBRL(total)}</span>
          </div>
        </div>

        <div className="flex gap-3">
          <Btn variant="ghost" className="!px-4" onClick={limparCarrinho}>Limpar</Btn>
          <Btn variant="primary" className="flex-1" onClick={finalizar} disabled={salvando || !carrinho.length}>
            {salvando ? "Registrando..." : <><Check size={16} /> Confirmar {fmtBRL(total)}</>}
          </Btn>
        </div>
      </Modal>
    </div>
  );
}
