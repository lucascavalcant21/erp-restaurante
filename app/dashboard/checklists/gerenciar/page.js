"use client";

import { useState, useEffect } from "react";
import { useERP } from "../../../context/ERPContext";
import { fetchTemplates, salvarTemplate, desativarTemplate } from "../../../lib/checklists";
import { SkeletonList } from "../../../components/ui";
import { CheckSquare, Plus, Trash2, Edit3, X, Save, Printer, User, Sparkles, Layers, Loader2 } from "lucide-react";
import { MODELOS_CHECKLIST, modeloDe } from "../modelos";

// Tipos de checklist por setor:
// - Cozinha: mise en place, abertura, pré-preparos p/ outro dia, fechamento, limpeza
// - Salão e Bar: abertura e fechamento
const TIPOS_POR_DEPT = {
  cozinha: [
    ["mise_en_place", "Mise en Place"],
    ["abertura", "Abertura"],
    ["pre_preparos", "Pré-preparos p/ outro dia"],
    ["fechamento", "Fechamento"],
    ["limpeza_organizacao", "Limpeza e Organização"],
  ],
  bar: [
    ["abertura", "Abertura"],
    ["fechamento", "Fechamento"],
  ],
  salao: [
    ["abertura", "Abertura"],
    ["fechamento", "Fechamento"],
  ],
};
const ROTULOS_LEGADO = { operacional: "Operacional", limpeza: "Limpeza" };
const rotuloTipo = (tipo) => {
  for (const lista of Object.values(TIPOS_POR_DEPT)) {
    const achou = lista.find(([id]) => id === tipo);
    if (achou) return achou[1];
  }
  return ROTULOS_LEGADO[tipo] || tipo;
};
const CORES_DEPT = {
  cozinha: "bg-amber-100 text-amber-700",
  bar: "bg-purple-100 text-purple-700",
  salao: "bg-sky-100 text-sky-700",
};

export default function GerenciarChecklistsPage() {
  const { unidadeAtiva, unidadeInfo } = useERP();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deptFiltro, setDeptFiltro] = useState("todos");

  const [modalNovo, setModalNovo] = useState(false);
  const [modalModelos, setModalModelos] = useState(false);
  const [criandoTudo, setCriandoTudo] = useState(false);
  const [form, setForm] = useState({ id: null, departamento: "cozinha", tipo: "abertura", titulo: "", itens: [{ id: 1, texto: "", responsavel: "" }] });

  const carregar = async () => {
    setLoading(true);
    const { data } = await fetchTemplates(unidadeAtiva);
    setTemplates(data);
    setLoading(false);
  };

  useEffect(() => { if (unidadeAtiva) carregar(); }, [unidadeAtiva]);

  const abrirNovo = () => {
    setForm({ id: null, departamento: "cozinha", tipo: "abertura", titulo: "", itens: [{ id: 1, texto: "", responsavel: "" }] });
    setModalNovo(true);
  };
  const abrirEditar = (t) => {
    setForm({ ...t, itens: t.itens?.length ? t.itens.map(i => ({ responsavel: "", ...i })) : [{ id: 1, texto: "", responsavel: "" }] });
    setModalNovo(true);
  };

  const addTarefa = () => setForm(f => ({ ...f, itens: [...f.itens, { id: Date.now(), texto: "", responsavel: "" }] }));
  const mudaTarefa = (id, patch) => setForm(f => ({ ...f, itens: f.itens.map(i => i.id === id ? { ...i, ...patch } : i) }));
  const removeTarefa = (id) => setForm(f => ({ ...f, itens: f.itens.filter(i => i.id !== id) }));

  const mudarDept = (dept) => {
    const tipos = TIPOS_POR_DEPT[dept] || [];
    const tipoValido = tipos.some(([id]) => id === form.tipo) ? form.tipo : tipos[0]?.[0] || "abertura";
    setForm({ ...form, departamento: dept, tipo: tipoValido });
  };

  // Preenche o formulário atual com um modelo pronto (título + tarefas)
  const aplicarModeloNoForm = () => {
    const modelo = modeloDe(form.departamento, form.tipo);
    if (!modelo) return alert("Não há modelo pronto para este setor/momento — monte manualmente.");
    setForm(f => ({
      ...f,
      titulo: f.titulo.trim() || modelo.titulo,
      itens: modelo.itens.map((texto, i) => ({ id: Date.now() + i, texto, responsavel: "" })),
    }));
  };

  // Cria de uma vez TODOS os modelos de um setor que ainda não existem
  const criarTodosDoSetor = async (dept) => {
    const modelos = MODELOS_CHECKLIST[dept] || {};
    const existentes = new Set(templates.filter(t => t.departamento === dept).map(t => (t.titulo || "").toLowerCase().trim()));
    const paraCriar = Object.entries(modelos).filter(([, m]) => !existentes.has(m.titulo.toLowerCase().trim()));
    if (!paraCriar.length) return alert(`Todos os checklists de ${dept} já existem.`);
    if (!confirm(`Criar ${paraCriar.length} checklist(s) completo(s) de ${dept} (${paraCriar.map(([, m]) => m.titulo).join(", ")})?`)) return;
    setCriandoTudo(true);
    for (const [tipo, m] of paraCriar) {
      await salvarTemplate({
        unidade_id: unidadeAtiva,
        departamento: dept,
        tipo,
        titulo: m.titulo,
        itens: m.itens.map((texto, i) => ({ id: i + 1, texto, responsavel: "" })),
      });
    }
    setCriandoTudo(false);
    setModalModelos(false);
    carregar();
  };

  const handleSalvar = async () => {
    if (!form.titulo.trim()) return alert("Digite um título");
    const itensValidos = form.itens.filter(i => i.texto.trim() !== "");
    if (itensValidos.length === 0) return alert("Adicione pelo menos uma tarefa");

    await salvarTemplate({
      id: form.id,
      unidade_id: unidadeAtiva,
      departamento: form.departamento,
      tipo: form.tipo,
      titulo: form.titulo,
      itens: itensValidos,
    });
    setModalNovo(false);
    carregar();
  };

  const handleDesativar = async (id) => {
    if (confirm("Deseja apagar este checklist?")) { await desativarTemplate(id); carregar(); }
  };

  // ── Impressão: folha do checklist com responsáveis, check e visto ─────────
  const imprimirChecklist = (t) => {
    const itens = t.itens || [];
    const linhas = itens.map((it, i) => `
      <tr>
        <td class="n">${i + 1}</td>
        <td class="tarefa">${it.texto || ""}</td>
        <td class="resp">${it.responsavel || ""}</td>
        <td class="check"><span class="box"></span></td>
        <td class="visto"></td>
      </tr>`).join("");
    const extras = Array.from({ length: 3 }).map((_, i) => `
      <tr>
        <td class="n">${itens.length + i + 1}</td>
        <td class="tarefa"></td>
        <td class="resp"></td>
        <td class="check"><span class="box"></span></td>
        <td class="visto"></td>
      </tr>`).join("");

    const deptLabel = t.departamento === "salao" ? "Salão" : t.departamento === "bar" ? "Bar" : "Cozinha";
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Checklist - ${t.titulo}</title>
      <style>
        *{margin:0;padding:0;box-sizing:border-box}
        body{font-family:Arial,Helvetica,sans-serif;color:#111;padding:8mm 8mm}
        .head{border-bottom:3px solid #111;padding-bottom:8px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:flex-end}
        .tag{font-size:10px;letter-spacing:3px;text-transform:uppercase;color:#555;font-weight:bold}
        h1{font-size:21px;margin-top:2px}
        .meta{font-size:12px;font-weight:bold;text-align:right}
        .meta span{display:block;font-size:10px;color:#555;font-weight:normal;margin-top:2px}
        .datas{display:flex;gap:24px;font-size:12px;margin:8px 0 10px;font-weight:bold}
        .datas b{border-bottom:1px solid #999;min-width:110px;display:inline-block}
        table{width:100%;border-collapse:collapse}
        th,td{border:1px solid #333;padding:7px 6px;font-size:12px;vertical-align:middle}
        th{background:#eee;text-transform:uppercase;letter-spacing:.5px;font-size:9px}
        td{height:30px}
        td.n{width:5%;text-align:center;color:#666}
        td.tarefa{width:45%}
        td.resp{width:22%}
        td.check{width:8%;text-align:center}
        td.visto{width:20%}
        .box{display:inline-block;width:14px;height:14px;border:2px solid #333;border-radius:3px}
        .assin{margin-top:22px;display:flex;justify-content:space-between;gap:40px}
        .assin div{flex:1;border-top:1px solid #333;padding-top:4px;font-size:10px;text-align:center;color:#444}
        @media print{@page{margin:0}}
      </style></head><body>
      <div class="head">
        <div>
          <div class="tag">Checklist ${deptLabel} · ${rotuloTipo(t.tipo)} · ${unidadeInfo?.nome || ""}</div>
          <h1>${t.titulo}</h1>
        </div>
        <div class="meta">${itens.length} tarefas<span>marque ao concluir e vista</span></div>
      </div>
      <div class="datas">Data: <b>&nbsp;</b> Turno/Horário: <b>&nbsp;</b> Responsável geral: <b>&nbsp;</b></div>
      <table>
        <thead><tr><th>#</th><th>Tarefa</th><th>Responsável</th><th>Feito</th><th>Visto / Hora</th></tr></thead>
        <tbody>${linhas}${extras}</tbody>
      </table>
      <div class="assin">
        <div>Responsável pelo ${deptLabel.toLowerCase()}</div>
        <div>Gerente / Conferência</div>
      </div>
      </body></html>`;

    let win = null;
    try { win = window.open("", "_blank", "width=860,height=1000"); } catch { win = null; }
    if (!win) {
      try {
        const iframe = document.createElement("iframe");
        iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
        document.body.appendChild(iframe);
        iframe.srcdoc = html;
        iframe.onload = () => {
          setTimeout(() => {
            try { iframe.contentWindow.focus(); iframe.contentWindow.print(); } catch (e) { alert("Não consegui abrir a impressão: " + e.message); }
            setTimeout(() => iframe.remove(), 60000);
          }, 300);
        };
        return;
      } catch (e) {
        return alert("O navegador bloqueou a impressão. Habilite os popups.\n\nDetalhe: " + e.message);
      }
    }
    win.document.write(html);
    win.document.close();
    setTimeout(() => win.print(), 400);
  };

  const filtrados = templates.filter(t => deptFiltro === "todos" || t.departamento === deptFiltro);

  return (
    <div className="min-h-screen pb-24 font-sans text-slate-800">

      {/* HEADER */}
      <div className="pt-6 pb-6 px-6 max-w-5xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-3xl bg-slate-100 text-emerald-600 flex items-center justify-center shadow-inner">
            <CheckSquare size={32} />
          </div>
          <div>
            <h1 className="text-4xl font-black tracking-tighter text-slate-900">Checklists</h1>
            <p className="text-slate-700 font-bold uppercase tracking-widest text-xs mt-1">Cozinha · Bar · Salão — crie, designe responsáveis e imprima</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setModalModelos(true)} className="flex items-center gap-2 bg-white text-emerald-700 border border-emerald-200 px-5 py-3 rounded-xl font-bold hover:bg-emerald-50 transition-colors shadow-sm">
            <Sparkles size={18} /> Modelos prontos
          </button>
          <button onClick={abrirNovo} className="flex items-center gap-2 bg-emerald-600 text-white px-5 py-3 rounded-xl font-bold hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-600/20">
            <Plus size={18} /> Novo Checklist
          </button>
        </div>
      </div>

      {/* Faixa: começar rápido com os modelos completos por setor */}
      {!loading && templates.length === 0 && (
        <div className="max-w-5xl mx-auto px-6 mb-6">
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 flex flex-col sm:flex-row items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0"><Sparkles size={22} /></div>
            <div className="flex-1 text-center sm:text-left">
              <p className="font-black text-slate-800">Comece com checklists completos</p>
              <p className="text-sm font-medium text-slate-600">Modelos prontos de abertura, fechamento, mise en place e limpeza — com as tarefas certas do dia a dia. É só ajustar.</p>
            </div>
            <button onClick={() => setModalModelos(true)} className="bg-emerald-600 text-white px-5 py-3 rounded-xl font-bold hover:bg-emerald-700 transition-colors shrink-0">Ver modelos</button>
          </div>
        </div>
      )}

      {/* Filtro por setor */}
      <div className="max-w-5xl mx-auto px-6 mb-6 flex gap-2">
        {[["todos", "Todos"], ["cozinha", "Cozinha"], ["bar", "Bar"], ["salao", "Salão"]].map(([d, l]) => (
          <button key={d} onClick={() => setDeptFiltro(d)}
            className={`px-4 py-2 rounded-xl font-bold text-sm transition-all ${deptFiltro === d ? "bg-slate-900 text-white shadow-md" : "bg-white text-slate-500 border border-slate-200 hover:bg-slate-50"}`}>
            {l}
          </button>
        ))}
      </div>

      <div className="max-w-5xl mx-auto px-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {loading ? (
          <div className="col-span-full"><SkeletonList /></div>
        ) : filtrados.length === 0 ? (
          <p className="col-span-full font-bold text-slate-500 text-center py-10">Nenhum checklist {deptFiltro !== "todos" ? `de ${deptFiltro}` : ""} criado ainda. Crie um para cada momento do dia (abertura, fechamento...).</p>
        ) : (
          filtrados.map(t => (
            <div key={t.id} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all flex flex-col">
              <div className="flex justify-between items-start mb-3">
                <div className="flex flex-wrap gap-1.5">
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${CORES_DEPT[t.departamento] || "bg-slate-100 text-slate-600"}`}>
                    {t.departamento === "salao" ? "Salão" : t.departamento}
                  </span>
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-slate-100 text-slate-600">
                    {rotuloTipo(t.tipo)}
                  </span>
                </div>
              </div>
              <h3 className="text-xl font-black text-slate-800 leading-tight">{t.titulo}</h3>
              <p className="text-sm font-medium text-slate-500 mt-1.5 flex-1">
                {t.itens?.length || 0} tarefas
                {(t.itens || []).some(i => i.responsavel) && <span className="text-emerald-600"> · com responsáveis definidos</span>}
              </p>
              <div className="flex gap-2 border-t border-slate-100 pt-3 mt-4">
                <button onClick={() => imprimirChecklist(t)} className="flex-1 py-2.5 rounded-xl flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors">
                  <Printer size={14} /> Imprimir
                </button>
                <button onClick={() => abrirEditar(t)} className="w-10 h-10 rounded-xl flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors" title="Editar"><Edit3 size={15} /></button>
                <button onClick={() => handleDesativar(t.id)} className="w-10 h-10 rounded-xl flex items-center justify-center bg-slate-100 hover:bg-red-100 text-slate-600 hover:text-red-500 transition-colors" title="Excluir"><Trash2 size={15} /></button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* MODAL: MODELOS PRONTOS (biblioteca por setor) */}
      {modalModelos && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-[32px] w-full max-w-2xl max-h-[88vh] overflow-y-auto custom-scrollbar p-8 shadow-2xl animate-in zoom-in-95">
            <div className="flex justify-between items-center mb-5 sticky top-0 bg-white z-10 pb-4 border-b border-slate-100">
              <div>
                <h2 className="font-black text-2xl text-slate-800 flex items-center gap-2"><Sparkles size={22} className="text-emerald-600" /> Modelos Prontos</h2>
                <p className="text-sm font-bold text-slate-500 mt-0.5">Checklists completos com as tarefas do dia a dia — clique para criar</p>
              </div>
              <button onClick={() => setModalModelos(false)} className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-200"><X size={20} /></button>
            </div>

            <div className="space-y-6">
              {Object.entries(MODELOS_CHECKLIST).map(([dept, modelos]) => {
                const existentes = new Set(templates.filter(t => t.departamento === dept).map(t => (t.titulo || "").toLowerCase().trim()));
                const faltam = Object.values(modelos).filter(m => !existentes.has(m.titulo.toLowerCase().trim())).length;
                return (
                  <div key={dept}>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">{dept === "salao" ? "Salão" : dept}</p>
                      {faltam > 0 && (
                        <button onClick={() => criarTodosDoSetor(dept)} disabled={criandoTudo}
                          className="flex items-center gap-1 text-[11px] font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg hover:bg-emerald-100 disabled:opacity-50">
                          {criandoTudo ? <Loader2 size={12} className="animate-spin" /> : <Layers size={12} />} Criar todos ({faltam})
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {Object.entries(modelos).map(([tipo, m]) => {
                        const jaExiste = existentes.has(m.titulo.toLowerCase().trim());
                        return (
                          <button key={tipo} disabled={jaExiste}
                            onClick={() => {
                              setForm({ id: null, departamento: dept, tipo, titulo: m.titulo, itens: m.itens.map((texto, i) => ({ id: Date.now() + i, texto, responsavel: "" })) });
                              setModalModelos(false);
                              setModalNovo(true);
                            }}
                            className={`text-left p-3.5 rounded-xl border transition-all ${jaExiste ? "bg-slate-50 border-slate-100 opacity-60 cursor-default" : "bg-white border-slate-200 hover:border-emerald-400 hover:shadow-sm"}`}>
                            <div className="flex items-center justify-between gap-2">
                              <p className="font-bold text-slate-800 text-sm">{m.titulo}</p>
                              {jaExiste && <span className="text-[9px] font-black uppercase text-emerald-600 shrink-0">criado</span>}
                            </div>
                            <p className="text-[11px] font-medium text-slate-400 mt-0.5">{m.itens.length} tarefas · {rotuloTipo(tipo)}</p>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {modalNovo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-[32px] w-full max-w-2xl max-h-[90vh] overflow-y-auto custom-scrollbar p-8 shadow-2xl animate-in zoom-in-95">

            <div className="flex justify-between items-center mb-6 sticky top-0 bg-white z-10 pb-4 border-b border-slate-100">
              <h2 className="font-black text-2xl text-slate-800">{form.id ? "Editar Checklist" : "Novo Checklist"}</h2>
              <button onClick={() => setModalNovo(false)} className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-200"><X size={20} /></button>
            </div>

            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Setor</label>
                  <select value={form.departamento} onChange={e => mudarDept(e.target.value)} className="w-full p-4 mt-1 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-emerald-500">
                    <option value="cozinha">Cozinha</option>
                    <option value="bar">Bar</option>
                    <option value="salao">Salão</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Momento do dia</label>
                  <select value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })} className="w-full p-4 mt-1 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-emerald-500">
                    {(TIPOS_POR_DEPT[form.departamento] || []).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                  </select>
                </div>
              </div>

              {modeloDe(form.departamento, form.tipo) && (
                <button type="button" onClick={aplicarModeloNoForm} className="w-full flex items-center justify-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold text-sm py-3 rounded-xl hover:bg-emerald-100 transition-colors">
                  <Sparkles size={16} /> Preencher com o modelo pronto de {rotuloTipo(form.tipo)} ({modeloDe(form.departamento, form.tipo).itens.length} tarefas)
                </button>
              )}

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Título do Checklist</label>
                <input type="text" placeholder={form.departamento === "cozinha" ? "Ex: Mise en Place do Almoço" : "Ex: Abertura do Salão"} value={form.titulo} onChange={e => setForm({ ...form, titulo: e.target.value })} className="w-full p-4 mt-1 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:border-emerald-500" />
              </div>

              <div className="pt-4 border-t border-slate-100">
                <div className="flex items-baseline justify-between mb-3">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Tarefas</label>
                  <span className="text-[10px] font-medium text-slate-400">Responsável em branco = quem executar escreve o nome na folha</span>
                </div>
                <div className="space-y-2.5">
                  {form.itens.map((it, i) => (
                    <div key={it.id} className="flex items-center gap-2">
                      <span className="w-6 text-center font-black text-slate-400 text-sm shrink-0">{i + 1}.</span>
                      <input
                        type="text"
                        placeholder="O que deve ser feito?"
                        value={it.texto}
                        onChange={e => mudaTarefa(it.id, { texto: e.target.value })}
                        className="flex-1 p-3 bg-white border border-slate-200 rounded-lg font-medium outline-none focus:border-emerald-500"
                      />
                      <div className="relative shrink-0 w-40">
                        <User size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          placeholder="Responsável"
                          value={it.responsavel || ""}
                          onChange={e => mudaTarefa(it.id, { responsavel: e.target.value })}
                          className="w-full p-3 pl-8 bg-slate-50 border border-slate-200 rounded-lg font-medium text-sm outline-none focus:border-emerald-500"
                        />
                      </div>
                      <button onClick={() => removeTarefa(it.id)} className="p-2.5 text-slate-400 hover:text-red-500 transition-colors shrink-0"><Trash2 size={17} /></button>
                    </div>
                  ))}
                </div>
                <button onClick={addTarefa} className="mt-4 text-emerald-600 font-bold text-sm flex items-center gap-1 hover:text-emerald-800">
                  <Plus size={16} /> Adicionar Tarefa
                </button>
              </div>
            </div>

            <div className="mt-8 sticky bottom-0 bg-white pt-4 border-t border-slate-100">
              <button onClick={handleSalvar} className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-lg rounded-2xl transition-all shadow-xl shadow-emerald-600/20 active:scale-95 flex items-center justify-center gap-2">
                <Save size={20} /> {form.id ? "Salvar Alterações" : "Criar Checklist"}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
