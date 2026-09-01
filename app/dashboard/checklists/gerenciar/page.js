"use client";

import { Suspense, useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useERP } from "../../../context/ERPContext";
import { fetchTemplates, salvarTemplate, desativarTemplate, fetchExecucoesMes } from "../../../lib/checklists";
import { SkeletonList } from "../../../components/ui";
import { Camera, CheckSquare, Plus, Trash2, Edit3, X, Save, Printer, User, Sparkles, Layers, Loader2, BarChart3, ImagePlus, Clock3, Upload, GripVertical, ChevronUp, ChevronDown } from "lucide-react";
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
    ["limpeza_organizacao", "Limpeza e Organização"],
    ["fechamento", "Fechamento"],
  ],
  salao: [
    ["abertura", "Abertura"],
    ["limpeza_organizacao", "Limpeza e Organização"],
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

const NOMES_DEPT = { cozinha: "Cozinha", bar: "Bar", salao: "Salão" };
const ESCOPO_DEPT = { cozinha: "da Cozinha", bar: "do Bar", salao: "do Salão" };
const deptValido = (dept) => Object.prototype.hasOwnProperty.call(TIPOS_POR_DEPT, dept);

function comprimirFotoReferencia(arquivo) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(arquivo);
    img.onload = () => {
      const limite = 960;
      const escala = Math.min(1, limite / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.width * escala));
      canvas.height = Math.max(1, Math.round(img.height * escala));
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.72).split(",")[1]);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Imagem inválida")); };
    img.src = url;
  });
}

function GerenciarChecklistsContent() {
  const { unidadeAtiva, unidadeInfo } = useERP();
  const searchParams = useSearchParams();
  const deptUrl = searchParams.get("dept");
  const deptFixo = deptValido(deptUrl) ? deptUrl : null;
  const deptPadrao = deptFixo || "cozinha";
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deptFiltro, setDeptFiltro] = useState(deptFixo || "todos");
  const cargaAtual = useRef(0);

  const [modalNovo, setModalNovo] = useState(false);
  const [modalModelos, setModalModelos] = useState(false);
  const [criandoTudo, setCriandoTudo] = useState(false);
  const [dragIndex, setDragIndex] = useState(null);
  const [form, setForm] = useState({ id: null, departamento: deptPadrao, tipo: "abertura", titulo: "", frequencia: "diario", itens: [{ id: 1, texto: "", categoria: "", responsavel: "", tempo_minutos: 5 }] });

  const moverTarefa = (origem, destino) => {
    if (destino < 0 || destino >= form.itens.length || origem === destino) return;
    setForm(f => {
      const novaLista = [...f.itens];
      const [itemRemovido] = novaLista.splice(origem, 1);
      novaLista.splice(destino, 0, itemRemovido);
      return { ...f, itens: novaLista };
    });
  };

  // Montar por IA (organiza em título + categorias + tópicos)
  const [contextoIA, setContextoIA] = useState("");
  const [montandoIA, setMontandoIA] = useState(false);

  const carregar = async () => {
    const idCarga = ++cargaAtual.current;
    setLoading(true);
    const { data } = await fetchTemplates(unidadeAtiva, deptFixo || undefined);
    if (idCarga !== cargaAtual.current) return;
    setTemplates(data || []);
    setLoading(false);
  };

  useEffect(() => { if (unidadeAtiva) carregar(); }, [unidadeAtiva, deptFixo]);

  useEffect(() => {
    if (!deptFixo) {
      setDeptFiltro("todos");
      return;
    }
    setDeptFiltro(deptFixo);
    setModalNovo(false);
    setModalModelos(false);
    setForm({ id: null, departamento: deptFixo, tipo: TIPOS_POR_DEPT[deptFixo][0][0], titulo: "", frequencia: "diario", itens: [{ id: 1, texto: "", categoria: "", responsavel: "", tempo_minutos: 5 }] });
  }, [deptFixo]);

  const abrirNovo = () => {
    const departamento = deptFixo || (deptFiltro !== "todos" && deptValido(deptFiltro) ? deptFiltro : "cozinha");
    setForm({ id: null, departamento, tipo: TIPOS_POR_DEPT[departamento][0][0], titulo: "", frequencia: "diario", itens: [{ id: 1, texto: "", categoria: "", responsavel: "", tempo_minutos: 5 }] });
    setContextoIA("");
    setModalNovo(true);
  };
  const abrirEditar = (t) => {
    if (deptFixo && t.departamento !== deptFixo) return;
    setForm({ frequencia: "diario", ...t, itens: t.itens?.length ? t.itens.map(i => ({ categoria: "", responsavel: "", tempo_minutos: 5, ...i })) : [{ id: 1, texto: "", categoria: "", responsavel: "", tempo_minutos: 5 }] });
    setContextoIA("");
    setModalNovo(true);
  };

  // Nova tarefa herda a categoria da última (facilita montar por blocos)
  const addTarefa = () => setForm(f => ({ ...f, itens: [...f.itens, { id: Date.now(), texto: "", categoria: f.itens[f.itens.length - 1]?.categoria || "", responsavel: "", tempo_minutos: 5 }] }));
  const mudaTarefa = (id, patch) => setForm(f => ({ ...f, itens: f.itens.map(i => i.id === id ? { ...i, ...patch } : i) }));
  const removeTarefa = (id) => setForm(f => ({ ...f, itens: f.itens.filter(i => i.id !== id) }));
  const anexarFotoReferencia = async (id, campo, arquivo) => {
    if (!arquivo) return;
    try {
      const foto = await comprimirFotoReferencia(arquivo);
      mudaTarefa(id, { [campo]: foto });
    } catch {
      alert("Não foi possível carregar essa foto.");
    }
  };

  const mudarDept = (dept) => {
    if (deptFixo) return;
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
      itens: modelo.itens.map((texto, i) => ({ id: Date.now() + i, texto, responsavel: "", tempo_minutos: 5 })),
    }));
  };

  // Monta o checklist inteiro por IA: título + tarefas organizadas em categorias
  const montarPorIA = async () => {
    setMontandoIA(true);
    try {
      const res = await fetch("/api/ia-checklist", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ departamento: form.departamento, tipo: form.tipo, contexto: contextoIA, unidade_nome: unidadeInfo?.nome }),
      });
      const data = await res.json();
      if (!res.ok || data.error) { alert(data.error || "Falha ao montar o checklist."); return; }
      setForm(f => ({
        ...f,
        titulo: f.titulo.trim() || data.titulo || "",
        itens: (data.itens || []).map((i, idx) => ({ id: Date.now() + idx, texto: i.texto || "", categoria: i.categoria || "", responsavel: "", tempo_minutos: Number(i.tempo_minutos) || 5 })),
      }));
    } catch { alert("Não consegui falar com a IA."); } finally { setMontandoIA(false); }
  };

  // Cria de uma vez TODOS os modelos de um setor que ainda não existem
  const criarTodosDoSetor = async (dept) => {
    if (deptFixo && dept !== deptFixo) return;
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
        itens: m.itens.map((texto, i) => ({ id: i + 1, texto, responsavel: "", tempo_minutos: 5 })),
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
      departamento: deptFixo || form.departamento,
      tipo: form.tipo,
      titulo: form.titulo,
      frequencia: form.frequencia || "diario",
      itens: itensValidos,
    });
    setModalNovo(false);
    carregar();
  };

  const handleDesativar = async (id) => {
    if (confirm("Deseja apagar este checklist?")) { await desativarTemplate(id); carregar(); }
  };

  // ── Relatório mensal imprimível: o que foi feito, por quem, quantas vezes ──
  const [gerandoRel, setGerandoRel] = useState(false);
  const imprimirRelatorioMes = async () => {
    setGerandoRel(true);
    const mes = new Date().toISOString().slice(0, 7);
    const deptRelatorio = deptFixo || (deptFiltro !== "todos" ? deptFiltro : undefined);
    const { data: execs } = await fetchExecucoesMes(unidadeAtiva, mes, deptRelatorio);
    setGerandoRel(false);
    const mesNome = new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

    // Agrupa por checklist: quantas execuções, quem fez, últimas datas
    const porTemplate = {};
    (execs || []).forEach(e => {
      const key = e.template_id;
      if (!porTemplate[key]) porTemplate[key] = {
        titulo: e.checklists_templates?.titulo || "Checklist",
        dept: e.checklists_templates?.departamento || "",
        execucoes: [],
      };
      porTemplate[key].execucoes.push({
        data: e.data_referencia,
        quem: e.colaboradores?.nome || "—",
        hora: e.created_at ? new Date(e.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "",
      });
    });

    // Inclui checklists sem execução no mês (aparecem como "0x")
    templates
      .filter(t => !deptRelatorio || t.departamento === deptRelatorio)
      .forEach(t => { if (!porTemplate[t.id]) porTemplate[t.id] = { titulo: t.titulo, dept: t.departamento, execucoes: [] }; });

    const grupos = Object.values(porTemplate).sort((a, b) => a.dept.localeCompare(b.dept) || a.titulo.localeCompare(b.titulo));
    const totalExec = (execs || []).length;
    const deptNome = (d) => d === "salao" ? "Salão" : d === "bar" ? "Bar" : "Cozinha";

    const linhas = grupos.map(g => {
      const n = g.execucoes.length;
      const quemContagem = {};
      g.execucoes.forEach(x => { quemContagem[x.quem] = (quemContagem[x.quem] || 0) + 1; });
      const quem = Object.entries(quemContagem).map(([nome, c]) => `${nome} (${c})`).join(", ") || "—";
      return `<tr>
        <td class="c">${deptNome(g.dept)}</td>
        <td><b>${g.titulo}</b></td>
        <td class="cnt ${n === 0 ? "zero" : ""}">${n}x</td>
        <td>${quem}</td>
      </tr>`;
    }).join("");

    const escopoRelatorio = deptRelatorio ? ` · ${NOMES_DEPT[deptRelatorio]}` : "";
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Relatório de Checklists${escopoRelatorio} — ${mesNome}</title>
      <style>
        *{margin:0;padding:0;box-sizing:border-box}
        body{font-family:Arial,Helvetica,sans-serif;color:#111;padding:9mm 10mm}
        .head{border-bottom:3px solid #059669;padding-bottom:10px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:flex-end}
        .tag{font-size:10px;letter-spacing:3px;text-transform:uppercase;color:#059669;font-weight:bold}
        h1{font-size:22px;margin-top:3px}
        .resumo{text-align:right;font-size:12px;color:#475569}.resumo b{font-size:22px;display:block;color:#059669}
        table{width:100%;border-collapse:collapse;font-size:12px}
        th,td{border:1px solid #333;padding:8px 8px;text-align:left}
        th{background:#ecfdf5;text-transform:uppercase;letter-spacing:.5px;font-size:9px;color:#065f46}
        td.c,th.c{text-align:center}
        td.cnt{text-align:center;font-weight:bold}td.cnt.zero{color:#dc2626}
        .obs{margin-top:14px;font-size:10px;color:#94a3b8}
        @media print{@page{margin:0}}
      </style></head><body>
      <div class="head">
        <div><div class="tag">Relatório de Checklists${escopoRelatorio} · ${unidadeInfo?.nome || ""}</div><h1>${mesNome}</h1></div>
        <div class="resumo">execuções no mês<b>${totalExec}</b></div>
      </div>
      <table>
        <thead><tr><th class="c">Setor</th><th>Checklist</th><th class="c">Vezes feito</th><th>Responsáveis (nº de vezes)</th></tr></thead>
        <tbody>${linhas || '<tr><td colspan="4">Nenhum checklist cadastrado.</td></tr>'}</tbody>
      </table>
      <div class="obs">Contagem por execução registrada no sistema. Checklists com "0x" não foram preenchidos no mês. Gerado em ${new Date().toLocaleDateString("pt-BR")}.</div>
      </body></html>`;

    const win = window.open("", "_blank", "width=860,height=1000");
    if (win) { win.document.write(html); win.document.close(); setTimeout(() => win.print(), 400); }
    else alert("Habilite os popups para imprimir o relatório.");
  };

  // ── Impressão: folha do checklist com responsáveis, check e visto ─────────
  const imprimirChecklist = (t) => {
    const itens = t.itens || [];
    let catAtual = null;
    const linhas = itens.map((it, i) => {
      const cat = (it.categoria || "").trim();
      const header = cat && cat !== catAtual ? (catAtual = cat, `<tr class="cat"><td colspan="5">${cat}</td></tr>`) : "";
      return `${header}<tr>
        <td class="n">${i + 1}</td>
        <td class="tarefa">${it.texto || ""}</td>
        <td class="resp">${it.responsavel || ""}</td>
        <td class="check"><span class="box"></span></td>
        <td class="visto"></td>
      </tr>`;
    }).join("");
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
        tr.cat td{background:#f3e8ff;color:#6b21a8;font-weight:bold;text-transform:uppercase;letter-spacing:1px;font-size:10px;height:auto;padding:5px 6px}
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

  const filtrados = templates.filter(t => deptFixo ? t.departamento === deptFixo : deptFiltro === "todos" || t.departamento === deptFiltro);

  return (
    <div className="min-h-screen pb-24 font-sans text-slate-800">

      {/* HEADER */}
      <div className="pt-5 sm:pt-6 pb-6 px-4 sm:px-6 max-w-5xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-3xl bg-slate-100 text-emerald-600 flex items-center justify-center shadow-inner shrink-0">
            <CheckSquare size={32} />
          </div>
          <div>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tighter text-slate-900">{deptFixo ? `Checklists ${ESCOPO_DEPT[deptFixo]}` : "Checklists"}</h1>
            <p className="text-slate-700 font-bold uppercase tracking-widest text-[10px] sm:text-xs mt-1">
              {deptFixo ? `${NOMES_DEPT[deptFixo]} · crie, organize responsáveis e imprima` : "Cozinha · Bar · Salão — crie, organize responsáveis e imprima"}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 md:flex w-full md:w-auto items-stretch gap-2">
          <button onClick={imprimirRelatorioMes} disabled={gerandoRel} className="min-h-12 flex items-center justify-center gap-2 bg-white text-slate-700 border border-slate-200 px-3 sm:px-5 py-3 rounded-xl font-bold text-sm leading-tight hover:bg-slate-50 transition-colors shadow-sm disabled:opacity-50">
            {gerandoRel ? <Loader2 size={18} className="animate-spin" /> : <BarChart3 size={18} />} Relatório do mês
          </button>
          <button onClick={() => setModalModelos(true)} className="min-h-12 flex items-center justify-center gap-2 bg-white text-emerald-700 border border-emerald-200 px-3 sm:px-5 py-3 rounded-xl font-bold text-sm leading-tight hover:bg-emerald-50 transition-colors shadow-sm">
            <Sparkles size={18} /> Modelos prontos
          </button>
          <button onClick={abrirNovo} className="col-span-2 md:col-auto min-h-12 flex w-full md:w-auto items-center justify-center gap-2 bg-emerald-600 text-white px-5 py-3 rounded-xl font-bold hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-600/20">
            <Plus size={18} /> Novo Checklist
          </button>
        </div>
      </div>

      {/* Faixa: começar rápido com os modelos completos por setor */}
      {!loading && templates.length === 0 && (
        <div className="max-w-5xl mx-auto px-4 sm:px-6 mb-6">
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

      {/* Filtro por setor: aparece somente no modo administrativo geral */}
      {!deptFixo && (
        <div className="max-w-5xl mx-auto px-4 sm:px-6 mb-6 flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
          {[["todos", "Todos"], ["cozinha", "Cozinha"], ["bar", "Bar"], ["salao", "Salão"]].map(([d, l]) => (
            <button key={d} onClick={() => setDeptFiltro(d)}
              className={`shrink-0 min-h-11 px-4 py-2 rounded-xl font-bold text-sm transition-all ${deptFiltro === d ? "bg-slate-900 text-white shadow-md" : "bg-white text-slate-500 border border-slate-200 hover:bg-slate-50"}`}>
              {l}
            </button>
          ))}
        </div>
      )}

      <div className="max-w-5xl mx-auto px-4 sm:px-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
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
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-emerald-50 text-emerald-700">
                    {t.frequencia === "semanal" ? "Semanal" : t.frequencia === "mensal" ? "Mensal" : "Diário"}
                  </span>
                </div>
              </div>
              <h3 className="text-xl font-black text-slate-800 leading-tight">{t.titulo}</h3>
              <p className="text-sm font-medium text-slate-500 mt-1.5 flex-1">
                {t.itens?.length || 0} tarefas
                {(t.itens || []).some(i => i.responsavel) && <span className="text-emerald-600"> · com responsáveis definidos</span>}
              </p>
              <div className="flex gap-2 border-t border-slate-100 pt-3 mt-4">
                <button onClick={() => imprimirChecklist(t)} className="flex-1 min-h-11 py-2.5 rounded-xl flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors">
                  <Printer size={14} /> Imprimir
                </button>
                <button onClick={() => abrirEditar(t)} className="w-11 h-11 rounded-xl flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors" title="Editar"><Edit3 size={15} /></button>
                <button onClick={() => handleDesativar(t.id)} className="w-11 h-11 rounded-xl flex items-center justify-center bg-slate-100 hover:bg-red-100 text-slate-600 hover:text-red-500 transition-colors" title="Excluir"><Trash2 size={15} /></button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* MODAL: MODELOS PRONTOS (biblioteca por setor) */}
      {modalModelos && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl sm:rounded-[32px] w-full max-w-2xl max-h-[calc(100dvh-2rem)] sm:max-h-[88dvh] overflow-y-auto custom-scrollbar p-4 sm:p-8 shadow-2xl animate-in zoom-in-95">
            <div className="flex justify-between items-center mb-5 sticky top-0 bg-white z-10 pb-4 border-b border-slate-100">
              <div>
                <h2 className="font-black text-2xl text-slate-800 flex items-center gap-2"><Sparkles size={22} className="text-emerald-600" /> Modelos Prontos</h2>
                <p className="text-sm font-bold text-slate-500 mt-0.5">Checklists completos com as tarefas do dia a dia — clique para criar</p>
              </div>
              <button onClick={() => setModalModelos(false)} className="w-11 h-11 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-200"><X size={20} /></button>
            </div>

            <div className="space-y-6">
              {Object.entries(MODELOS_CHECKLIST).filter(([dept]) => !deptFixo || dept === deptFixo).map(([dept, modelos]) => {
                const existentes = new Set(templates.filter(t => t.departamento === dept).map(t => (t.titulo || "").toLowerCase().trim()));
                const faltam = Object.values(modelos).filter(m => !existentes.has(m.titulo.toLowerCase().trim())).length;
                return (
                  <div key={dept}>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">{NOMES_DEPT[dept] || dept}</p>
                      {faltam > 0 && (
                        <button onClick={() => criarTodosDoSetor(dept)} disabled={criandoTudo}
                          className="min-h-11 flex items-center gap-1 text-[11px] font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-2 rounded-lg hover:bg-emerald-100 disabled:opacity-50">
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
                              setForm({ id: null, departamento: dept, tipo, titulo: m.titulo, frequencia: "diario", itens: m.itens.map((texto, i) => ({ id: Date.now() + i, texto, responsavel: "", tempo_minutos: 5 })) });
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
          <div className="bg-white rounded-2xl sm:rounded-[32px] w-full max-w-4xl max-h-[calc(100dvh-2rem)] sm:max-h-[90dvh] overflow-y-auto custom-scrollbar p-4 sm:p-8 shadow-2xl animate-in zoom-in-95">

            <div className="flex justify-between items-center mb-6 sticky top-0 bg-white z-10 pb-4 border-b border-slate-100">
              <h2 className="font-black text-xl sm:text-2xl text-slate-800">
                {form.id ? "Editar Checklist" : "Novo Checklist"}{deptFixo ? ` · ${NOMES_DEPT[deptFixo]}` : ""}
              </h2>
              <button onClick={() => setModalNovo(false)} className="w-11 h-11 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-200"><X size={20} /></button>
            </div>

            <div className="space-y-5">
              <div className={`grid grid-cols-1 gap-4 ${deptFixo ? "" : "sm:grid-cols-2"}`}>
                {!deptFixo && <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Setor</label>
                  <select value={form.departamento} onChange={e => mudarDept(e.target.value)} className="w-full p-4 mt-1 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-emerald-500">
                    <option value="cozinha">Cozinha</option>
                    <option value="bar">Bar</option>
                    <option value="salao">Salão</option>
                  </select>
                </div>}
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

              {/* Montar tudo por IA: organiza em título + categorias + tópicos */}
              <div className="rounded-2xl border border-violet-200 bg-violet-50/60 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-xl bg-violet-600 text-white flex items-center justify-center shrink-0"><Sparkles size={16} /></div>
                  <div>
                    <p className="font-black text-sm text-violet-900 leading-tight">Montar tudo por IA</p>
                    <p className="text-[11px] font-medium text-violet-700">Organiza o checklist em categorias e tópicos para o {form.departamento === "bar" ? "barman/bartender" : "responsável"} executar</p>
                  </div>
                </div>
                <textarea rows={2} value={contextoIA} onChange={e => setContextoIA(e.target.value)}
                  placeholder="Opcional: detalhe o que não pode faltar (ex: conferir chopeira, repor gelo, higienizar dosadores...)"
                  className="w-full p-3 bg-white border border-violet-200 rounded-xl font-medium text-base outline-none focus:border-violet-500 resize-none mb-2" />
                <button type="button" onClick={montarPorIA} disabled={montandoIA}
                  className="w-full flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-700 text-white font-bold text-sm py-3 rounded-xl transition-colors disabled:opacity-60">
                  {montandoIA ? <><Loader2 size={16} className="animate-spin" /> Montando checklist...</> : <><Sparkles size={16} /> Montar por IA</>}
                </button>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Título do Checklist</label>
                <input type="text" placeholder={form.departamento === "cozinha" ? "Ex: Mise en Place do Almoço" : "Ex: Abertura do Salão"} value={form.titulo} onChange={e => setForm({ ...form, titulo: e.target.value })} className="w-full p-4 mt-1 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:border-emerald-500" />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-2">Frequência</label>
                <div className="flex gap-2">
                  {[["diario", "Diário"], ["semanal", "Semanal"], ["mensal", "Mensal"]].map(([v, l]) => (
                    <button key={v} type="button" onClick={() => setForm({ ...form, frequencia: v })}
                      className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all border-2 ${(form.frequencia || "diario") === v ? "bg-emerald-600 border-emerald-600 text-white" : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"}`}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>

              <datalist id="categorias-checklist">
                {[...new Set(form.itens.map(i => (i.categoria || "").trim()).filter(Boolean))].map(c => <option key={c} value={c} />)}
              </datalist>

              <div className="pt-4 border-t border-slate-100">
                <div className="flex flex-col gap-3 mb-3 sm:flex-row sm:items-center sm:justify-between">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Tarefas</label>
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-slate-600">{form.itens.length} ações</span>
                    <span className="flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-amber-700"><Clock3 size={12}/>{form.itens.reduce((total, tarefa) => total + (Number(tarefa.tempo_minutos) || 0), 0)} min</span>
                    <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-emerald-700"><ImagePlus size={12}/>{form.itens.reduce((total, tarefa) => total + (tarefa.foto_antes ? 1 : 0) + (tarefa.foto_final ? 1 : 0), 0)} fotos</span>
                  </div>
                </div>
                <div className="mb-4 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-emerald-900">
                  <ImagePlus size={20} className="mt-0.5 shrink-0"/>
                  <div><p className="text-xs font-black uppercase tracking-wide">Fotos-modelo pelo celular</p><p className="mt-0.5 text-xs font-medium">Em cada tarefa, envie uma foto de referência de antes e outra mostrando como deve ficar no final. Você pode escolher da galeria ou tirar a foto na hora.</p></div>
                </div>
                <div className="space-y-2.5">
                  {form.itens.map((it, i) => {
                    const catAnterior = i > 0 ? (form.itens[i - 1].categoria || "").trim() : null;
                    const catAtual = (it.categoria || "").trim();
                    const novaCategoria = catAtual && catAtual !== catAnterior;
                    return (
                    <div
                      key={it.id}
                      draggable
                      onDragStart={() => setDragIndex(i)}
                      onDragOver={e => { if (dragIndex !== null) e.preventDefault(); }}
                      onDrop={() => {
                        if (dragIndex !== null && dragIndex !== i) {
                          moverTarefa(dragIndex, i);
                          setDragIndex(null);
                        }
                      }}
                    >
                      {novaCategoria && (
                        <div className="flex items-center gap-2 mt-4 mb-1.5">
                          <Layers size={13} className="text-violet-500 shrink-0" />
                          <span className="text-[11px] font-black uppercase tracking-widest text-violet-700">{catAtual}</span>
                          <div className="flex-1 h-px bg-violet-100" />
                        </div>
                      )}
                      <div className={`rounded-2xl border p-3 shadow-sm transition-all sm:p-4 ${dragIndex === i ? "opacity-50 border-emerald-400 bg-emerald-50/40" : "border-slate-200 bg-slate-50/70 hover:shadow-md hover:border-slate-300"}`}>
                        <div className="flex items-start gap-2.5">
                          {/* CONTROLES DE REORDENAÇÃO (ALÇA DE ARRASTO + SETAS CIMA/BAIXO) */}
                          <div className="flex items-center gap-1 shrink-0 pt-1">
                            <span className="grid h-8 w-8 cursor-grab active:cursor-grabbing place-items-center rounded-xl bg-slate-200/80 text-slate-500 hover:bg-slate-300 transition-colors" title="Arraste para reordenar esta linha">
                              <GripVertical size={16} />
                            </span>
                            <div className="flex flex-col gap-0.5">
                              <button
                                type="button"
                                disabled={i === 0}
                                onClick={() => moverTarefa(i, i - 1)}
                                title="Mover para cima"
                                className="grid h-4 w-6 place-items-center rounded bg-slate-200/90 text-slate-700 hover:bg-emerald-600 hover:text-white disabled:opacity-25 disabled:hover:bg-slate-200 disabled:hover:text-slate-700 transition-colors"
                              >
                                <ChevronUp size={12} />
                              </button>
                              <button
                                type="button"
                                disabled={i === form.itens.length - 1}
                                onClick={() => moverTarefa(i, i + 1)}
                                title="Mover para baixo"
                                className="grid h-4 w-6 place-items-center rounded bg-slate-200/90 text-slate-700 hover:bg-emerald-600 hover:text-white disabled:opacity-25 disabled:hover:bg-slate-200 disabled:hover:text-slate-700 transition-colors"
                              >
                                <ChevronDown size={12} />
                              </button>
                            </div>
                            <span className="grid h-8 w-8 place-items-center rounded-xl bg-slate-900 text-xs font-black text-white shadow-sm ml-0.5">{i + 1}</span>
                          </div>

                          <div className="min-w-0 flex-1">
                            <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-500">Ação a executar</label>
                            <input
                              type="text"
                              placeholder="O que deve ser feito?"
                              value={it.texto}
                              onChange={e => mudaTarefa(it.id, { texto: e.target.value })}
                              className="w-full rounded-xl border border-slate-200 bg-white p-3 text-base font-bold text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                            />
                          </div>
                          <button onClick={() => removeTarefa(it.id)} className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-slate-400 ring-1 ring-slate-200 transition-colors hover:bg-rose-50 hover:text-rose-600 hover:ring-rose-200 mt-1" aria-label={`Remover tarefa ${i + 1}`}><Trash2 size={16} /></button>
                        </div>

                        <div className="mt-3 grid gap-2 sm:grid-cols-3">
                          <label className="block">
                            <span className="mb-1 block text-[9px] font-black uppercase tracking-widest text-violet-600">Grupo / etapa</span>
                            <input
                              type="text"
                              list="categorias-checklist"
                              placeholder="Ex: Bancadas"
                              value={it.categoria || ""}
                              onChange={e => mudaTarefa(it.id, { categoria: e.target.value })}
                              className="w-full rounded-xl border border-violet-200 bg-violet-50 p-3 text-base font-bold text-slate-800 outline-none focus:border-violet-500"
                            />
                          </label>
                          <label className="block">
                            <span className="mb-1 block text-[9px] font-black uppercase tracking-widest text-slate-500">Responsável</span>
                            <div className="relative">
                              <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                              <input
                                type="text"
                                placeholder="Quem executa"
                                value={it.responsavel || ""}
                                onChange={e => mudaTarefa(it.id, { responsavel: e.target.value })}
                                className="w-full rounded-xl border border-slate-200 bg-white p-3 pl-9 text-base font-medium outline-none focus:border-emerald-500"
                              />
                            </div>
                          </label>
                          <label className="block">
                            <span className="mb-1 block text-[9px] font-black uppercase tracking-widest text-amber-600">Tempo previsto</span>
                            <div className="relative">
                              <Clock3 size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-amber-600" />
                              <input type="number" min="1" max="240" value={it.tempo_minutos || ""} onChange={e => mudaTarefa(it.id, { tempo_minutos: Number(e.target.value) || "" })} placeholder="Minutos" title="Tempo previsto em minutos" className="w-full rounded-xl border border-amber-200 bg-amber-50 p-3 pl-9 text-base font-black text-slate-800 outline-none focus:border-amber-500" />
                              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black uppercase text-amber-700">min</span>
                            </div>
                          </label>
                        </div>

                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                          {[["foto_antes", "Padrão antes"], ["foto_final", "Padrão final"]].map(([campo, label]) => (
                            <div key={campo} className="overflow-hidden rounded-xl border border-slate-200 bg-white p-2">
                              {it[campo] ? (
                                <div className="relative">
                                  <img src={`data:image/jpeg;base64,${it[campo]}`} alt={label} className="h-28 w-full rounded-lg object-cover" />
                                  <span className="absolute bottom-2 left-2 rounded-md bg-slate-950/80 px-2 py-1 text-[9px] font-black uppercase tracking-wide text-white">{label}</span>
                                  <button type="button" onClick={() => mudaTarefa(it.id, { [campo]: "" })} className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-white text-rose-600 shadow" aria-label={`Remover ${label}`}><X size={14} /></button>
                                </div>
                              ) : (
                                <div>
                                  <p className="mb-2 text-[10px] font-black uppercase tracking-wide text-slate-600">{label}</p>
                                  <div className="grid grid-cols-2 gap-2">
                                    <label className="flex min-h-11 cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-white px-2 text-[10px] font-black text-slate-700 ring-1 ring-slate-200"><Upload size={14} className="text-emerald-600"/>Galeria / PC<input type="file" accept="image/*" className="hidden" onChange={e => { anexarFotoReferencia(it.id, campo, e.target.files?.[0]); e.target.value = ""; }}/></label>
                                    <label className="flex min-h-11 cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-2 text-[10px] font-black text-white"><Camera size={14}/>Tirar foto<input type="file" accept="image/*" capture="environment" className="hidden" onChange={e => { anexarFotoReferencia(it.id, campo, e.target.files?.[0]); e.target.value = ""; }}/></label>
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );})}
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

export default function GerenciarChecklistsPage() {
  return (
    <Suspense fallback={<div className="min-h-[40vh] flex items-center justify-center px-4 font-bold text-slate-500">Carregando checklists...</div>}>
      <GerenciarChecklistsContent />
    </Suspense>
  );
}
