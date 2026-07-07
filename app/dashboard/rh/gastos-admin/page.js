"use client";

import { useState, useEffect, useMemo } from "react";
import { Package, Plus, Trash2, Printer, X } from "lucide-react";
import { PageHeader, PageBody, EmptyState, Modal, Field, TextInput, NumberInput, Select, Btn, Toast, SkeletonList, fmtBRL } from "../../../components/ui";
import { useERP } from "../../../context/ERPContext";
import { fetchGastosAdmin, salvarGastoAdmin, removerGastoAdmin } from "../../../lib/rh";

const CATEGORIAS = ["Papelaria", "Escritório", "Cartões / Fidelidade", "Impressão", "Informática", "Limpeza (adm)", "Correios", "Outros"];

export default function GastosAdminPage() {
  const { unidadeAtiva, unidadeInfo } = useERP();
  const [gastos, setGastos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mes, setMes] = useState(new Date().toISOString().slice(0, 7));
  const [toast, setToast] = useState("");
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(null);

  const notificar = (m) => { setToast(m); setTimeout(() => setToast(""), 2600); };

  const carregar = async () => {
    setLoading(true);
    const { data } = await fetchGastosAdmin(unidadeAtiva, mes);
    setGastos(data || []);
    setLoading(false);
  };
  useEffect(() => { if (unidadeAtiva && unidadeAtiva !== "todas") carregar(); }, [unidadeAtiva, mes]);

  const abrirNovo = () => {
    setForm({ id: null, data: new Date().toISOString().split("T")[0], item: "", categoria: "Papelaria", quantidade: "1", valor_unitario: "", fornecedor: "", observacao: "" });
    setModal(true);
  };
  const abrirEditar = (g) => {
    setForm({ id: g.id, data: g.data || "", item: g.item || "", categoria: g.categoria || "Outros", quantidade: String(g.quantidade ?? "1"), valor_unitario: g.valor_unitario ?? "", fornecedor: g.fornecedor || "", observacao: g.observacao || "" });
    setModal(true);
  };

  const salvar = async (e) => {
    e.preventDefault();
    if (!form.item.trim()) return alert("Informe o item.");
    const { error } = await salvarGastoAdmin({
      id: form.id,
      unidade_id: unidadeAtiva,
      data: form.data || new Date().toISOString().split("T")[0],
      item: form.item.trim(),
      categoria: form.categoria,
      quantidade: Number(form.quantidade) || 1,
      valor_unitario: Number(form.valor_unitario) || 0,
      fornecedor: form.fornecedor || null,
      observacao: form.observacao || null,
    });
    if (error) return alert("Erro: " + error);
    notificar(form.id ? "Gasto atualizado!" : "Gasto lançado!");
    setModal(false);
    carregar();
  };

  const excluir = async (g) => {
    if (!confirm(`Excluir "${g.item}"?`)) return;
    await removerGastoAdmin(g.id);
    notificar("Excluído.");
    carregar();
  };

  const totalDe = (g) => (Number(g.quantidade) || 0) * (Number(g.valor_unitario) || 0);
  const resumo = useMemo(() => {
    const total = gastos.reduce((s, g) => s + totalDe(g), 0);
    const porCat = {};
    gastos.forEach(g => { const c = g.categoria || "Outros"; porCat[c] = (porCat[c] || 0) + totalDe(g); });
    return { total, itens: gastos.length, porCat: Object.entries(porCat).sort((a, b) => b[1] - a[1]) };
  }, [gastos]);

  const imprimirPlanilha = () => {
    if (!gastos.length) return alert("Nenhum gasto no mês para imprimir.");
    const mesNome = new Date(mes + "-02").toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    const linhas = gastos.map(g => `<tr>
      <td class="c">${g.data ? g.data.split("-").reverse().slice(0, 2).join("/") : "—"}</td>
      <td><b>${g.item}</b>${g.fornecedor ? `<span class="forn"> · ${g.fornecedor}</span>` : ""}</td>
      <td>${g.categoria || "—"}</td>
      <td class="c">${Number(g.quantidade) || 0}</td>
      <td class="r">${fmtBRL(g.valor_unitario)}</td>
      <td class="r"><b>${fmtBRL(totalDe(g))}</b></td>
    </tr>`).join("");
    const vazias = Array.from({ length: 4 }).map(() => `<tr><td class="c"></td><td></td><td></td><td class="c"></td><td class="r"></td><td class="r"></td></tr>`).join("");
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Gastos Administrativos — ${mesNome}</title>
      <style>
        *{margin:0;padding:0;box-sizing:border-box}
        body{font-family:Arial,Helvetica,sans-serif;color:#111;padding:9mm 10mm}
        .head{border-bottom:3px solid #0f172a;padding-bottom:10px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:flex-end}
        .tag{font-size:10px;letter-spacing:3px;text-transform:uppercase;color:#64748b;font-weight:bold}
        h1{font-size:22px;margin-top:3px}
        .resumo{text-align:right}.resumo .l{font-size:11px;color:#64748b}.resumo b{font-size:24px;display:block}
        table{width:100%;border-collapse:collapse;font-size:12px}
        th,td{border:1px solid #333;padding:7px 8px;text-align:left}
        th{background:#f1f5f9;text-transform:uppercase;letter-spacing:.5px;font-size:9px;color:#475569}
        td.c,th.c{text-align:center}td.r,th.r{text-align:right}
        td{height:26px}.forn{color:#94a3b8;font-weight:normal}
        tfoot td{border:none;padding-top:10px}.tot{text-align:right;font-size:14px;font-weight:900}
        .cats{margin-top:14px;font-size:11px;color:#475569}.cats span{margin-right:16px}
        .obs{margin-top:16px;font-size:10px;color:#94a3b8}
        @media print{@page{margin:0}}
      </style></head><body>
      <div class="head">
        <div><div class="tag">Gastos Administrativos · ${unidadeInfo?.nome || ""}</div><h1>${mesNome}</h1></div>
        <div class="resumo"><span class="l">Total do mês</span><b>${fmtBRL(resumo.total)}</b></div>
      </div>
      <table>
        <thead><tr><th class="c">Data</th><th>Item / Fornecedor</th><th>Categoria</th><th class="c">Qtd</th><th class="r">Valor unit.</th><th class="r">Total</th></tr></thead>
        <tbody>${linhas}${vazias}</tbody>
        <tfoot><tr><td colspan="6" class="tot">TOTAL DO MÊS: ${fmtBRL(resumo.total)}</td></tr></tfoot>
      </table>
      <div class="cats"><b>Por categoria:</b> ${resumo.porCat.map(([c, v]) => `<span>${c}: ${fmtBRL(v)}</span>`).join("")}</div>
      <div class="obs">Controle de material de escritório, papelaria, cartões e afins. Gerado em ${new Date().toLocaleDateString("pt-BR")}.</div>
      </body></html>`;
    const win = window.open("", "_blank", "width=880,height=1000");
    if (win) { win.document.write(html); win.document.close(); setTimeout(() => win.print(), 400); }
    else alert("Habilite os popups para imprimir.");
  };

  if (!unidadeAtiva || unidadeAtiva === "todas") {
    return <div className="min-h-screen"><PageHeader title="Gastos Administrativos" subtitle="Material de escritório e afins" icon={Package} /><PageBody><EmptyState icon={Package} title="Selecione uma unidade" /></PageBody></div>;
  }

  return (
    <div className="min-h-screen pb-24">
      <PageHeader title="Gastos Administrativos" subtitle={`Papelaria, escritório, cartões... · ${unidadeInfo?.nome || ""}`} icon={Package}
        onAction={abrirNovo} actionLabel="Novo Gasto">
        <Btn variant="ghost" className="!h-9 text-xs" onClick={imprimirPlanilha}><Printer size={14} /> Imprimir planilha</Btn>
      </PageHeader>
      <PageBody>
        <Toast show={!!toast}>{toast}</Toast>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: "var(--dim)" }}>Mês:</span>
            <input type="month" value={mes} onChange={e => setMes(e.target.value)} className="p-2.5 rounded-lg border font-bold text-sm outline-none" style={{ background: "var(--card)", borderColor: "var(--line)", color: "var(--fg)" }} />
          </div>
          <div className="erp-card px-4 py-2.5 flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: "var(--muted)" }}>Total do mês</span>
            <span className="text-lg font-extrabold" style={{ color: "var(--accent-strong)" }}>{fmtBRL(resumo.total)}</span>
            <span className="text-[11px] font-medium" style={{ color: "var(--dim)" }}>· {resumo.itens} lançamento(s)</span>
          </div>
        </div>

        {loading ? <SkeletonList rows={5} /> : gastos.length === 0 ? (
          <EmptyState icon={Package} title="Nenhum gasto neste mês" hint="Lance canetas, papel, cartões de fidelidade, cartuchos... e imprima a planilha no fim do mês."
            actionLabel="Lançar primeiro gasto" onAction={abrirNovo} />
        ) : (
          <div className="erp-card divide-y" style={{ borderColor: "var(--line)" }}>
            {gastos.map(g => (
              <div key={g.id} className="px-4 py-3 flex items-center gap-3" style={{ borderColor: "var(--line-soft)" }}>
                <div className="w-14 text-center shrink-0">
                  <p className="text-xs font-black" style={{ color: "var(--muted)" }}>{g.data ? g.data.split("-").reverse().slice(0, 2).join("/") : "—"}</p>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm truncate" style={{ color: "var(--fg)" }}>{g.item}</p>
                  <p className="text-[10px] font-medium truncate" style={{ color: "var(--dim)" }}>
                    {g.categoria}{g.fornecedor ? ` · ${g.fornecedor}` : ""} · {Number(g.quantidade) || 0} × {fmtBRL(g.valor_unitario)}
                  </p>
                </div>
                <span className="font-extrabold text-sm shrink-0" style={{ color: "var(--fg)" }}>{fmtBRL(totalDe(g))}</span>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => abrirEditar(g)} className="p-2 rounded-lg" style={{ background: "var(--elevated)", color: "var(--muted)" }} title="Editar">✎</button>
                  <button onClick={() => excluir(g)} className="p-2 rounded-lg" style={{ background: "var(--elevated)", color: "var(--muted)" }} title="Excluir"><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        )}

        {resumo.porCat.length > 0 && (
          <div className="erp-card p-5">
            <p className="erp-label mb-3">Por categoria</p>
            <div className="space-y-2">
              {resumo.porCat.map(([c, v]) => {
                const pct = resumo.total > 0 ? (v / resumo.total) * 100 : 0;
                return (
                  <div key={c}>
                    <div className="flex justify-between text-sm font-bold mb-1"><span style={{ color: "var(--fg-soft)" }}>{c}</span><span style={{ color: "var(--muted)" }}>{fmtBRL(v)} · {pct.toFixed(0)}%</span></div>
                    <div className="w-full rounded-full h-2" style={{ background: "var(--elevated)" }}><div className="h-2 rounded-full" style={{ width: `${pct}%`, background: "var(--accent)" }} /></div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </PageBody>

      <Modal open={modal} onClose={() => setModal(false)} title={form?.id ? "Editar Gasto" : "Novo Gasto Administrativo"}>
        {form && (
          <form onSubmit={salvar}>
            <Field label="Item"><TextInput value={form.item} onChange={e => setForm({ ...form, item: e.target.value })} placeholder="Ex: Caneta esferográfica azul (cx)" required /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Categoria"><Select value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value })}>{CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}</Select></Field>
              <Field label="Data"><input type="date" value={form.data} onChange={e => setForm({ ...form, data: e.target.value })} className="erp-input" /></Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Quantidade"><NumberInput value={form.quantidade} onChange={e => setForm({ ...form, quantidade: e.target.value })} min="1" step="1" /></Field>
              <Field label="Valor unitário (R$)"><NumberInput value={form.valor_unitario} onChange={e => setForm({ ...form, valor_unitario: e.target.value })} min="0" step="0.01" placeholder="0,00" /></Field>
            </div>
            <Field label="Fornecedor / loja (opcional)"><TextInput value={form.fornecedor} onChange={e => setForm({ ...form, fornecedor: e.target.value })} placeholder="Ex: Kalunga" /></Field>
            <Field label="Observação (opcional)"><TextInput value={form.observacao} onChange={e => setForm({ ...form, observacao: e.target.value })} /></Field>
            <div className="bg-slate-50 rounded-xl p-3 text-center mb-4">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total deste item</span>
              <p className="text-xl font-black text-emerald-600">{fmtBRL((Number(form.quantidade) || 0) * (Number(form.valor_unitario) || 0))}</p>
            </div>
            <div className="flex gap-3">
              <Btn type="button" variant="ghost" className="flex-1" onClick={() => setModal(false)}>Cancelar</Btn>
              <Btn type="submit" variant="primary" className="flex-1">Salvar</Btn>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
