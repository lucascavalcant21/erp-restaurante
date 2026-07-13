"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Warehouse, Plus, Minus, History, Trash2, Edit3, Boxes, Layers, PackageX, X, Sparkles, Loader2, Camera, Printer
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

function fileParaBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
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

  // Importação em massa via IA (texto colado e/ou foto)
  const [modalIA, setModalIA] = useState(false);
  const [iaTexto, setIaTexto] = useState("");
  const [iaImagem, setIaImagem] = useState(null); // { base64, mediaType, previewUrl }
  const [iaLoading, setIaLoading] = useState(false);
  const [iaItens, setIaItens] = useState(null); // lista revisável antes de salvar
  const [iaSalvando, setIaSalvando] = useState(false);

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
    setForm({ id: null, nome: "", categoria: catFiltro !== "Todas" ? catFiltro : "Talheres", quantidade: "", valor_unitario: "", localizacao: "", observacao: "", foto: "" });
    setModalItem(true);
  };
  const abrirEditar = (item) => {
    setForm({ id: item.id, nome: item.nome, categoria: item.categoria || "Outros", quantidade: String(item.quantidade ?? ""), valor_unitario: item.valor_unitario ?? "", localizacao: item.localizacao || "", observacao: item.observacao || "", foto: item.foto || "" });
    setModalItem(true);
  };

  // Foto do item (guardada em base64, junto do cadastro)
  const escolherFotoItem = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const base64 = await fileParaBase64(file);
    setForm(f => ({ ...f, foto: base64 }));
    e.target.value = "";
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
      foto: form.foto || null,
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

  // Planilha de controle imprimível: foto + item + qtd + valores + colunas de
  // contagem manual — agrupada por categoria, com totais e assinatura.
  const imprimirPlanilha = () => {
    if (!itens.length) return alert("Inventário vazio — nada para imprimir.");
    const grupos = {};
    itens.forEach(i => { const c = i.categoria || "Outros"; (grupos[c] = grupos[c] || []).push(i); });
    const cats = Object.keys(grupos).sort((a, b) => a.localeCompare(b, "pt-BR"));
    let corpo = "";
    cats.forEach(cat => {
      const lista = grupos[cat].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
      const linhas = lista.map(i => {
        const qtd = Number(i.quantidade) || 0;
        const vu = Number(i.valor_unitario) || 0;
        return `<tr>
          <td class="foto">${i.foto ? `<img src="data:image/jpeg;base64,${i.foto}"/>` : ""}</td>
          <td><b>${i.nome}</b>${i.observacao ? `<div class="mini">${i.observacao}</div>` : ""}</td>
          <td>${i.localizacao || ""}</td>
          <td class="c">${qtd.toLocaleString("pt-BR")}</td>
          <td class="r">${vu > 0 ? fmtBRL(vu) : ""}</td>
          <td class="r">${vu > 0 ? fmtBRL(vu * qtd) : ""}</td>
          <td class="conta"></td>
          <td class="conta"></td>
        </tr>`;
      }).join("");
      const totCat = lista.reduce((s, i) => s + (Number(i.quantidade) || 0), 0);
      corpo += `<tr class="cat"><td colspan="3">${cat}</td><td class="c">${totCat.toLocaleString("pt-BR")}</td><td colspan="4"></td></tr>${linhas}`;
    });
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Inventário — ${unidadeInfo?.nome || ""}</title>
      <style>
        *{margin:0;padding:0;box-sizing:border-box}
        body{font-family:Arial,Helvetica,sans-serif;color:#111;padding:8mm;-webkit-print-color-adjust:exact;print-color-adjust:exact}
        .head{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:3px solid #111;padding-bottom:8px;margin-bottom:10px}
        h1{font-size:20px}
        .tag{font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#555;font-weight:bold}
        .meta{font-size:11px;color:#555;font-weight:bold;text-align:right}
        table{width:100%;border-collapse:collapse;font-size:11px}
        th,td{border:1px solid #94a3b8;padding:4px 6px;text-align:left;vertical-align:middle}
        th{background:#e2e8f0;font-size:9px;text-transform:uppercase;letter-spacing:1px}
        tr{page-break-inside:avoid}
        tr.cat td{background:#f1f5f9;font-weight:bold;text-transform:uppercase;letter-spacing:1px;font-size:10px;color:#334155}
        td.foto{width:16mm;height:16mm;text-align:center;padding:1.5mm}
        td.foto img{width:13mm;height:13mm;object-fit:cover;border-radius:2mm}
        td.c{text-align:center;font-weight:bold}
        td.r{text-align:right}
        td.conta{width:18mm;background:#fff}
        .mini{font-size:9px;color:#64748b;font-weight:normal}
        .totais{display:flex;justify-content:flex-end;gap:20px;margin-top:8px;font-size:12px;font-weight:bold}
        .assin{margin-top:18mm;display:flex;gap:30px}
        .assin div{flex:1;border-top:1px solid #111;padding-top:4px;font-size:10px;text-align:center;color:#444}
        @media print{@page{margin:8mm}}
      </style></head><body>
      <div class="head">
        <div><div class="tag">Planilha de Controle — Inventário</div><h1>${unidadeInfo?.nome || "Unidade"}</h1></div>
        <div class="meta">${itens.length} tipo(s) · ${resumo.totalUnidades.toLocaleString("pt-BR")} unidades<br/>Impresso em ${new Date().toLocaleDateString("pt-BR")}</div>
      </div>
      <table>
        <thead><tr><th>Foto</th><th>Item</th><th>Onde fica</th><th>Qtd sistema</th><th>Valor un.</th><th>Valor total</th><th>Contagem física</th><th>Diferença</th></tr></thead>
        <tbody>${corpo}</tbody>
      </table>
      <div class="totais"><span>Patrimônio informado: ${fmtBRL(resumo.valorTotal)}</span></div>
      <div class="assin"><div>Conferido por</div><div>Data da contagem</div><div>Assinatura do responsável</div></div>
      </body></html>`;
    const win = window.open("", "_blank", "width=900,height=1000");
    if (win) { win.document.write(html); win.document.close(); setTimeout(() => win.print(), 500); }
    else alert("Habilite os popups para imprimir a planilha.");
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

  // ── Importação em massa via IA ────────────────────────────────────────────
  const abrirModalIA = () => {
    setIaTexto(""); setIaImagem(null); setIaItens(null); setModalIA(true);
  };

  const escolherFotoIA = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const base64 = await fileParaBase64(file);
    setIaImagem({ base64, mediaType: file.type || "image/jpeg", previewUrl: URL.createObjectURL(file) });
    e.target.value = "";
  };

  const lerComIA = async () => {
    if (!iaTexto.trim() && !iaImagem) return alert("Cole uma lista de texto ou envie uma foto.");
    setIaLoading(true);
    setIaItens(null);
    try {
      const res = await fetch("/api/ia-inventario", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          texto: iaTexto,
          imagem_base64: iaImagem?.base64 || null,
          imagem_media_type: iaImagem?.mediaType || null,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) { alert(data.error || "Falha ao ler a lista."); return; }
      setIaItens((data.itens || []).map(it => ({ ...it, incluir: true })));
    } catch {
      alert("Não consegui falar com a IA. Verifique a conexão.");
    } finally {
      setIaLoading(false);
    }
  };

  const atualizarItemIA = (idx, patch) => {
    setIaItens(lista => lista.map((it, i) => i === idx ? { ...it, ...patch } : it));
  };

  const salvarTodosIA = async () => {
    const paraSalvar = (iaItens || []).filter(it => it.incluir && it.nome.trim());
    if (!paraSalvar.length) return alert("Nenhum item marcado para salvar.");
    setIaSalvando(true);
    let ok = 0, falhas = 0;
    for (const it of paraSalvar) {
      const { id, error } = await salvarItemInventario({
        id: null,
        unidade_id: unidadeAtiva,
        nome: it.nome.trim(),
        categoria: it.categoria || "Outros",
        quantidade: Number(it.quantidade) || 0,
        valor_unitario: Number(it.valor_unitario) > 0 ? Number(it.valor_unitario) : null,
        localizacao: it.localizacao || null,
        observacao: null,
      });
      if (error || !id) { falhas++; continue; }
      if ((Number(it.quantidade) || 0) > 0) {
        await registrarMovimentoInventario(
          { id, unidade_id: unidadeAtiva, quantidade: 0 },
          { tipo: "entrada", quantidade: Number(it.quantidade) || 0, motivo: "Importação por IA" }
        );
      }
      ok++;
    }
    setIaSalvando(false);
    setModalIA(false);
    notificar(`${ok} item(ns) importado(s)${falhas ? ` · ${falhas} falha(s)` : ""}!`);
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
        <Btn variant="ghost" className="!h-9 text-xs" onClick={abrirModalIA}>
          <Sparkles size={14} /> Importar com IA
        </Btn>
        <Btn variant="ghost" className="!h-9 text-xs" onClick={() => setModalHist(true)}>
          <History size={14} /> Histórico
        </Btn>
        <Btn variant="ghost" className="!h-10 text-xs" onClick={imprimirPlanilha}>
          <Printer size={14} /> Planilha
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
                        {item.foto ? (
                          <img src={`data:image/jpeg;base64,${item.foto}`} alt="" className="w-11 h-11 rounded-lg object-cover shrink-0 border" style={{ borderColor: "var(--line)" }} />
                        ) : (
                          <div className="w-11 h-11 rounded-lg flex items-center justify-center shrink-0" style={{ background: "var(--elevated)" }}>
                            <Boxes size={16} style={{ color: "var(--dim)" }} />
                          </div>
                        )}
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
            {/* Foto do item (opcional) */}
            <div className="flex items-center gap-3 mb-4">
              <label className="w-20 h-20 shrink-0 rounded-2xl border-2 border-dashed flex items-center justify-center cursor-pointer overflow-hidden" style={{ borderColor: "var(--line)", background: "var(--elevated)" }}>
                {form.foto
                  ? <img src={`data:image/jpeg;base64,${form.foto}`} className="w-full h-full object-cover" alt="Foto do item" />
                  : <Camera size={22} style={{ color: "var(--dim)" }} />}
                <input type="file" accept="image/*" className="hidden" onChange={escolherFotoItem} />
              </label>
              <div className="text-xs font-medium" style={{ color: "var(--dim)" }}>
                <p className="font-bold" style={{ color: "var(--fg-soft)" }}>Foto do item (opcional)</p>
                <p>Toque para {form.foto ? "trocar" : "adicionar"} — sai na planilha impressa.</p>
                {form.foto && <button type="button" onClick={() => setForm(f => ({ ...f, foto: "" }))} className="font-bold text-rose-500 hover:text-rose-600 mt-1">Remover foto</button>}
              </div>
            </div>
            <Field label="Nome do item">
              <TextInput value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} placeholder="Ex: Garfo de mesa inox, Freezer horizontal 400L..." required />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Categoria">
                <Select value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value })}>
                  {CATEGORIAS_INVENTARIO.map(c => <option key={c} value={c}>{c}</option>)}
                </Select>
              </Field>
              <Field label={form.id ? "Quantidade" : "Quantidade inicial"}>
                <NumberInput value={form.quantidade} onChange={e => setForm({ ...form, quantidade: e.target.value })} placeholder="Ex: 50" min="0" step="1" required />
              </Field>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

      {/* Modal: importação em massa via IA */}
      {modalIA && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto" onClick={() => !iaLoading && !iaSalvando && setModalIA(false)}>
          <div className="w-full max-w-2xl my-3 sm:my-8 rounded-2xl sm:rounded-3xl border flex flex-col max-h-[94vh] sm:max-h-[88vh]" style={{ background: "var(--card)", borderColor: "var(--line)", boxShadow: "var(--shadow-float)" }} onClick={e => e.stopPropagation()}>
            <div className="flex flex-wrap justify-between items-center gap-2 p-4 sm:p-6 border-b shrink-0" style={{ borderColor: "var(--line-soft)" }}>
              <div>
                <h2 className="font-black text-xl flex items-center gap-2" style={{ color: "var(--fg)" }}><Sparkles size={20} style={{ color: "var(--accent-strong)" }} /> Importar Inventário com IA</h2>
                <p className="text-xs font-bold mt-0.5" style={{ color: "var(--muted)" }}>Cole a lista ou envie uma foto — a IA monta os itens e você revisa antes de salvar</p>
              </div>
              <button onClick={() => setModalIA(false)} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "var(--elevated)", color: "var(--muted)" }}><X size={17} /></button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4">
              {!iaItens ? (
                <>
                  <textarea
                    value={iaTexto}
                    onChange={e => setIaTexto(e.target.value)}
                    placeholder={"Cole aqui, um item por linha. Ex:\n48 garfos de mesa inox\n30 pratos rasos brancos\n2 freezers horizontais 400L (R$ 2.500 cada) - depósito\n12 potes herméticos 2L"}
                    rows={7}
                    className="erp-input !h-auto py-3 font-medium text-sm resize-none"
                  />
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed cursor-pointer font-bold text-xs transition-colors" style={{ borderColor: "var(--line)", color: "var(--muted)" }}>
                      <Camera size={16} /> {iaImagem ? "Trocar foto" : "Enviar foto (opcional)"}
                      <input type="file" accept="image/*" className="hidden" onChange={escolherFotoIA} />
                    </label>
                    {iaImagem && (
                      <div className="relative">
                        <img src={iaImagem.previewUrl} alt="" className="h-14 w-14 object-cover rounded-lg border" style={{ borderColor: "var(--line)" }} />
                        <button onClick={() => setIaImagem(null)} className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center"><X size={11} /></button>
                      </div>
                    )}
                  </div>
                  <Btn variant="primary" className="w-full" onClick={lerComIA} disabled={iaLoading}>
                    {iaLoading ? <><Loader2 size={16} className="animate-spin" /> Lendo a lista...</> : <><Sparkles size={16} /> Ler com IA</>}
                  </Btn>
                </>
              ) : (
                <>
                  <p className="text-xs font-bold" style={{ color: "var(--muted)" }}>{iaItens.length} item(ns) identificado(s) — revise e desmarque o que não quiser salvar:</p>
                  <div className="space-y-2">
                    {iaItens.map((it, idx) => (
                      <div key={idx} className="p-3 rounded-xl border" style={{ background: it.incluir ? "var(--card)" : "var(--elevated)", borderColor: "var(--line)", opacity: it.incluir ? 1 : 0.55 }}>
                        <div className="flex items-center gap-2 flex-wrap">
                          <input type="checkbox" checked={it.incluir} onChange={e => atualizarItemIA(idx, { incluir: e.target.checked })} className="w-4 h-4 accent-emerald-600 shrink-0" />
                          <input type="text" value={it.nome} onChange={e => atualizarItemIA(idx, { nome: e.target.value })} className="w-full sm:flex-1 sm:min-w-[140px] p-2 rounded-lg border font-bold text-sm outline-none" style={{ background: "var(--surface)", borderColor: "var(--line)", color: "var(--fg)" }} />
                          <select value={it.categoria} onChange={e => atualizarItemIA(idx, { categoria: e.target.value })} className="p-2 rounded-lg border font-bold text-xs outline-none" style={{ background: "var(--surface)", borderColor: "var(--line)", color: "var(--fg-soft)" }}>
                            {CATEGORIAS_INVENTARIO.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </div>
                        <div className="flex items-center gap-2 mt-2 pl-6 flex-wrap">
                          <label className="text-[10px] font-bold" style={{ color: "var(--dim)" }}>Qtd</label>
                          <input type="number" min="0" value={it.quantidade} onChange={e => atualizarItemIA(idx, { quantidade: e.target.value })} className="w-20 p-2 text-center rounded-lg border font-black text-sm outline-none" style={{ background: "var(--surface)", borderColor: "var(--line)", color: "var(--fg)" }} />
                          <label className="text-[10px] font-bold ml-1" style={{ color: "var(--dim)" }}>R$/un</label>
                          <input type="number" min="0" step="0.01" value={it.valor_unitario || ""} onChange={e => atualizarItemIA(idx, { valor_unitario: e.target.value })} placeholder="0,00" className="w-24 p-2 text-center rounded-lg border font-bold text-sm outline-none" style={{ background: "var(--surface)", borderColor: "var(--line)", color: "var(--accent-strong)" }} />
                          <input type="text" value={it.localizacao || ""} onChange={e => atualizarItemIA(idx, { localizacao: e.target.value })} placeholder="Onde fica (opcional)" className="w-full sm:flex-1 sm:min-w-[120px] p-2 rounded-lg border font-medium text-xs outline-none" style={{ background: "var(--surface)", borderColor: "var(--line)", color: "var(--fg-soft)" }} />
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-3">
                    <Btn variant="ghost" className="flex-1" onClick={() => setIaItens(null)} disabled={iaSalvando}>← Voltar</Btn>
                    <Btn variant="primary" className="flex-1" onClick={salvarTodosIA} disabled={iaSalvando}>
                      {iaSalvando ? <><Loader2 size={16} className="animate-spin" /> Salvando...</> : `Salvar ${iaItens.filter(i => i.incluir).length} item(ns)`}
                    </Btn>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal: histórico de movimentos com data e hora */}
      {modalHist && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto" onClick={() => setModalHist(false)}>
          <div className="w-full max-w-2xl my-3 sm:my-8 rounded-2xl sm:rounded-3xl border flex flex-col max-h-[94vh] sm:max-h-[85vh]" style={{ background: "var(--card)", borderColor: "var(--line)", boxShadow: "var(--shadow-float)" }} onClick={e => e.stopPropagation()}>
            <div className="flex flex-wrap justify-between items-center gap-2 p-4 sm:p-6 border-b shrink-0" style={{ borderColor: "var(--line-soft)" }}>
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
