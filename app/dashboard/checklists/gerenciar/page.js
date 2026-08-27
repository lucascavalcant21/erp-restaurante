"use client";

import { Suspense, useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useERP } from "../../../context/ERPContext";
import {
  desativarTemplate, fetchExecucoesMes, fetchTemplates, formatarMinutos, salvarFotoReferencia, salvarTemplate, tempoDoChecklist,
} from "../../../lib/checklists";
import { comprimirFoto } from "../../../lib/operacao-evidencias";
import { SkeletonList } from "../../../components/ui";
import { BarChart3, Camera, CheckSquare, Clock, Edit3, Layers, Loader2, Plus, Printer, Save, Sparkles, Trash2, User, Users, X } from "lucide-react";
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
  const [form, setForm] = useState({ id: null, departamento: deptPadrao, tipo: "abertura", titulo: "", frequencia: "diario", itens: [{ id: 1, texto: "", categoria: "", responsavel: "", minutos: "", foto_url: null }] });

  // Montar por IA (organiza em título + categorias + tópicos)
  const [contextoIA, setContextoIA] = useState("");
  const [montandoIA, setMontandoIA] = useState(false);
  // Recusa do banco não pode passar por sucesso: um checklist que não salvou
  // é uma tarefa que o time não vai executar, e ninguém fica sabendo.
  const [erroBanco, setErroBanco] = useState("");

  const carregar = async () => {
    const idCarga = ++cargaAtual.current;
    setLoading(true);
    const { data, error } = await fetchTemplates(unidadeAtiva, deptFixo || undefined);
    if (idCarga !== cargaAtual.current) return;
    setErroBanco(error ? `Não consegui carregar os checklists: ${error}` : "");
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
    setForm({ id: null, departamento: deptFixo, tipo: TIPOS_POR_DEPT[deptFixo][0][0], titulo: "", frequencia: "diario", itens: [{ id: 1, texto: "", categoria: "", responsavel: "", minutos: "", foto_url: null }] });
  }, [deptFixo]);

  const abrirNovo = () => {
    const departamento = deptFixo || (deptFiltro !== "todos" && deptValido(deptFiltro) ? deptFiltro : "cozinha");
    setForm({ id: null, departamento, tipo: TIPOS_POR_DEPT[departamento][0][0], titulo: "", frequencia: "diario", itens: [{ id: 1, texto: "", categoria: "", responsavel: "", minutos: "", foto_url: null }] });
    setContextoIA("");
    setModalNovo(true);
  };
  const abrirEditar = (t) => {
    if (deptFixo && t.departamento !== deptFixo) return;
    setForm({ frequencia: "diario", ...t, itens: t.itens?.length ? t.itens.map(i => ({ categoria: "", responsavel: "", minutos: "", foto_url: null, conjunto: false, ...i })) : [{ id: 1, texto: "", categoria: "", responsavel: "", minutos: "", foto_url: null }] });
    setContextoIA("");
    setModalNovo(true);
  };

  // Nova tarefa herda a categoria da última (facilita montar por blocos)
  const addTarefa = () => setForm(f => ({ ...f, itens: [...f.itens, { id: Date.now(), texto: "", categoria: f.itens[f.itens.length - 1]?.categoria || "", responsavel: "", minutos: "", foto_url: null }] }));
  const mudaTarefa = (id, patch) => setForm(f => ({ ...f, itens: f.itens.map(i => i.id === id ? { ...i, ...patch } : i) }));
  const removeTarefa = (id) => setForm(f => ({ ...f, itens: f.itens.filter(i => i.id !== id) }));

  // Foto de como o ambiente tem que FICAR. É o padrão da casa, tirado uma vez
  // pelo gestor — quem executa olha e compara. Não confundir com evidência do
  // que foi feito, que é outro módulo.
  const [subindoFoto, setSubindoFoto] = useState(null);
  const enviarFotoTarefa = async (itemId, file) => {
    if (!file) return;
    setSubindoFoto(itemId);
    const r = await salvarFotoReferencia(file, { unidadeId: unidadeAtiva, itemId });
    setSubindoFoto(null);
    if (r.error) return alert(r.error);
    mudaTarefa(itemId, { foto_url: r.url });
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
      itens: modelo.itens.map((texto, i) => ({ id: Date.now() + i, texto, responsavel: "", minutos: "", foto_url: null, conjunto: false })),
    }));
  };

  // Monta o checklist inteiro por IA: título + tarefas organizadas em categorias
  // Foto do ambiente: a IA olha o que esta na imagem (equipamentos, bancadas,
  // o que esta fora do lugar) e monta as tarefas a partir dai, em vez de sair
  // do modelo generico de "abertura de salao".
  const [fotoIA, setFotoIA] = useState(null);

  const montarPorIA = async () => {
    setMontandoIA(true);
    try {
      const res = await fetch("/api/ia-checklist", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ departamento: form.departamento, tipo: form.tipo, contexto: contextoIA, unidade_nome: unidadeInfo?.nome, foto: fotoIA?.envio || null }),
      });
      const data = await res.json();
      if (!res.ok || data.error) { alert(data.error || "Falha ao montar o checklist."); return; }
      setForm(f => ({
        ...f,
        titulo: f.titulo.trim() || data.titulo || "",
        itens: (data.itens || []).map((i, idx) => ({ id: Date.now() + idx, texto: i.texto || "", categoria: i.categoria || "", responsavel: "", minutos: i.minutos ?? "", foto_url: null, conjunto: false })),
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
    // O lote continua mesmo se um falhar, mas os que falharam são nomeados no
    // fim: antes o setor ficava pela metade sem ninguém perceber.
    const falhas = [];
    for (const [tipo, m] of paraCriar) {
      const { error } = await salvarTemplate({
        unidade_id: unidadeAtiva,
        departamento: dept,
        tipo,
        titulo: m.titulo,
        itens: m.itens.map((texto, i) => ({ id: i + 1, texto, responsavel: "" })),
      });
      if (error) falhas.push(`${m.titulo} (${error})`);
    }
    setCriandoTudo(false);
    setModalModelos(false);
    carregar();
    if (falhas.length) {
      alert(`${paraCriar.length - falhas.length} de ${paraCriar.length} checklist(s) criados.\n\nNão entraram:\n${falhas.join("\n")}`);
    }
  };

  const handleSalvar = async () => {
    if (!form.titulo.trim()) return alert("Digite um título");
    const itensValidos = form.itens.filter(i => i.texto.trim() !== "");
    if (itensValidos.length === 0) return alert("Adicione pelo menos uma tarefa");

    const { error } = await salvarTemplate({
      id: form.id,
      unidade_id: unidadeAtiva,
      departamento: deptFixo || form.departamento,
      tipo: form.tipo,
      titulo: form.titulo,
      frequencia: form.frequencia || "diario",
      itens: itensValidos,
    });
    // Fechar o modal com o salvamento recusado jogava fora tudo que foi
    // digitado, e a lista recarregada só não mostrava o checklist novo.
    if (error) return alert(`Não consegui salvar este checklist: ${error}`);
    setModalNovo(false);
    carregar();
  };

  const handleDesativar = async (id) => {
    if (!confirm("Deseja apagar este checklist?")) return;
    const { error } = await desativarTemplate(id);
    if (error) return alert(`Não consegui apagar este checklist: ${error}`);
    carregar();
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
      const header = cat && cat !== catAtual ? (catAtual = cat, `<tr class="cat"><td colspan="6">${cat}</td></tr>`) : "";
      // A marca de foto vai na propria linha da tarefa: quem esta com a folha
      // na mao precisa saber que existe um padrao para conferir no fim.
      const marcaFoto = it.foto_url ? ` <span class="temfoto">ver foto ${i + 1}</span>` : "";
      return `${header}<tr>
        <td class="n">${i + 1}</td>
        <td class="tarefa">${it.texto || ""}${marcaFoto}</td>
        <td class="tempo">${formatarMinutos(it.minutos)}</td>
        <td class="resp">${it.conjunto ? "Em conjunto" : (it.responsavel || "")}</td>
        <td class="check"><span class="box"></span></td>
        <td class="visto"></td>
      </tr>`;
    }).join("");
    const extras = Array.from({ length: 3 }).map((_, i) => `
      <tr>
        <td class="n">${itens.length + i + 1}</td>
        <td class="tarefa"></td>
        <td class="tempo"></td>
        <td class="resp"></td>
        <td class="check"><span class="box"></span></td>
        <td class="visto"></td>
      </tr>`).join("");

    // Galeria no fim, numerada igual as tarefas. Foto ao lado de cada linha
    // esticaria a tabela e jogaria o checklist para tres folhas; no fim ela
    // cabe em uma e continua servindo para conferir antes de assinar.
    const comFoto = itens.map((it, i) => ({ ...it, n: i + 1 })).filter(it => it.foto_url);
    const galeria = comFoto.length ? `
      <div class="galeria">
        <h2>Como tem que ficar</h2>
        <div class="fotos">
          ${comFoto.map(it => `
            <figure>
              <img src="${it.foto_url}" alt="Padrao da tarefa ${it.n}" />
              <figcaption><b>${it.n}.</b> ${it.texto || ""}</figcaption>
            </figure>`).join("")}
        </div>
      </div>` : "";

    const tempo = tempoDoChecklist(itens);

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
        td.tarefa{width:40%}
        td.tempo{width:8%;text-align:center;font-weight:bold;color:#444}
        td.resp{width:20%}
        td.check{width:7%;text-align:center}
        td.visto{width:20%}
        .temfoto{font-size:9px;color:#6b21a8;font-weight:bold;white-space:nowrap}
        .galeria{page-break-before:always;padding-top:4mm}
        .galeria h2{font-size:15px;border-bottom:2px solid #111;padding-bottom:5px;margin-bottom:8px}
        .fotos{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
        .fotos figure{border:1px solid #333;padding:4px;page-break-inside:avoid}
        .fotos img{width:100%;height:46mm;object-fit:cover;display:block}
        .fotos figcaption{font-size:9px;margin-top:3px;line-height:1.25}
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
        <div class="meta">${itens.length} tarefas${tempo.minutos > 0 ? ` &middot; ${formatarMinutos(tempo.minutos)}` : ""}<span>${tempo.parcial ? `tempo de ${tempo.comTempo} de ${tempo.total} tarefas` : "marque ao concluir e vista"}</span></div>
      </div>
      <div class="datas">Data: <b>&nbsp;</b> Turno/Horário: <b>&nbsp;</b> Responsável geral: <b>&nbsp;</b></div>
      <table>
        <thead><tr><th>#</th><th>Tarefa</th><th>Tempo</th><th>Responsável</th><th>Feito</th><th>Visto / Hora</th></tr></thead>
        <tbody>${linhas}${extras}</tbody>
      </table>
      <div class="assin">
        <div>Responsável pelo ${deptLabel.toLowerCase()}</div>
        <div>Gerente / Conferência</div>
      </div>
      ${galeria}
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

      {/* Banco recusou a leitura: a lista vazia abaixo não significa que não há
          checklist, e o convite dos modelos criaria duplicata quando voltar. */}
      {erroBanco && (
        <div className="max-w-5xl mx-auto px-4 sm:px-6 mb-6">
          <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{erroBanco}</p>
        </div>
      )}

      {/* Faixa: começar rápido com os modelos completos por setor */}
      {!loading && !erroBanco && templates.length === 0 && (
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
          <p className="col-span-full font-bold text-slate-500 text-center py-10">{erroBanco ? "A lista não pôde ser carregada — veja o aviso acima." : `Nenhum checklist ${deptFiltro !== "todos" ? `de ${deptFiltro}` : ""} criado ainda. Crie um para cada momento do dia (abertura, fechamento...).`}</p>
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
                              setForm({ id: null, departamento: dept, tipo, titulo: m.titulo, frequencia: "diario", itens: m.itens.map((texto, i) => ({ id: Date.now() + i, texto, responsavel: "" })) });
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
          <div className="bg-white rounded-2xl sm:rounded-[32px] w-full max-w-2xl max-h-[calc(100dvh-2rem)] sm:max-h-[90dvh] overflow-y-auto custom-scrollbar p-4 sm:p-8 shadow-2xl animate-in zoom-in-95">

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
                {/* A foto do ambiente vai junto do texto. Comprimida com o mesmo
                    comprimirFoto das evidencias: foto de celular crua passa de 5 MB
                    e a requisicao morre no limite de tamanho. */}
                <div className="flex items-center gap-2 mb-2">
                  <label className="flex items-center gap-2 rounded-xl border border-violet-200 bg-white px-3 py-2 text-xs font-black text-violet-700 cursor-pointer hover:border-violet-400">
                    <input type="file" accept="image/*" className="hidden"
                      onChange={async e => {
                        const file = e.target.files?.[0];
                        e.target.value = "";
                        if (!file) return;
                        try {
                          const foto = await comprimirFoto(file);
                          setFotoIA({ nome: file.name, previa: URL.createObjectURL(file), envio: { data: foto.base64, media_type: foto.mediaType } });
                        } catch (erro) { alert(erro?.message || "Não consegui preparar a foto."); }
                      }} />
                    <Camera size={14} /> {fotoIA ? "Trocar foto" : "Enviar foto do ambiente"}
                  </label>
                  {fotoIA && (
                    <>
                      <img src={fotoIA.previa} alt="Ambiente" className="h-9 w-9 rounded-lg object-cover border border-violet-200" />
                      <button type="button" onClick={() => setFotoIA(null)} className="text-[11px] font-bold text-violet-700 underline">tirar</button>
                    </>
                  )}
                </div>
                <button type="button" onClick={montarPorIA} disabled={montandoIA}
                  className="w-full flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-700 text-white font-bold text-sm py-3 rounded-xl transition-colors disabled:opacity-60">
                  {montandoIA ? <><Loader2 size={16} className="animate-spin" /> Montando checklist...</> : <><Sparkles size={16} /> {fotoIA ? "Montar pela foto" : "Montar por IA"}</>}
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
                <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1 mb-3">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Tarefas</label>
                  <span className="text-[10px] font-medium text-slate-400">Categoria agrupa as tarefas · responsável em branco = quem executar escreve o nome</span>
                </div>
                <div className="space-y-2.5">
                  {form.itens.map((it, i) => {
                    const catAnterior = i > 0 ? (form.itens[i - 1].categoria || "").trim() : null;
                    const catAtual = (it.categoria || "").trim();
                    const novaCategoria = catAtual && catAtual !== catAnterior;
                    return (
                    <div key={it.id}>
                      {novaCategoria && (
                        <div className="flex items-center gap-2 mt-4 mb-1.5">
                          <Layers size={13} className="text-violet-500 shrink-0" />
                          <span className="text-[11px] font-black uppercase tracking-widest text-violet-700">{catAtual}</span>
                          <div className="flex-1 h-px bg-violet-100" />
                        </div>
                      )}
                      <div className="grid grid-cols-[1.5rem_minmax(0,1fr)] sm:flex sm:items-center gap-2 rounded-xl border border-slate-100 p-2 sm:p-0 sm:border-0">
                        <span className="w-6 text-center font-black text-slate-400 text-sm shrink-0">{i + 1}.</span>
                        <input
                          type="text"
                          placeholder="O que deve ser feito?"
                          value={it.texto}
                          onChange={e => mudaTarefa(it.id, { texto: e.target.value })}
                          className="w-full min-w-0 sm:flex-1 p-3 bg-white border border-slate-200 rounded-lg font-medium outline-none focus:border-emerald-500"
                        />
                        <input
                          type="text"
                          list="categorias-checklist"
                          placeholder="Categoria"
                          value={it.categoria || ""}
                          onChange={e => mudaTarefa(it.id, { categoria: e.target.value })}
                          className="col-start-2 w-full sm:col-auto sm:shrink-0 sm:w-32 p-3 bg-violet-50 border border-violet-200 rounded-lg font-medium text-base outline-none focus:border-violet-500"
                        />
                        {/* Tarefa de uma pessoa ou do time. Marcar "em conjunto" limpa
                            o nome: guardar os dois deixaria a folha dizendo "Todos" e o
                            sistema cobrando de uma pessoa so. */}
                        <div className="relative col-start-2 w-full sm:col-auto sm:shrink-0 sm:w-44 flex items-center gap-1.5">
                          {it.conjunto ? (
                            <span className="flex-1 flex items-center gap-1.5 h-11 px-3 rounded-lg bg-emerald-50 border border-emerald-200 text-[13px] font-black text-emerald-700">
                              <Users size={13} /> Em conjunto
                            </span>
                          ) : (
                            <span className="relative flex-1">
                              <User size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                              <input
                                type="text"
                                placeholder="Responsável"
                                value={it.responsavel || ""}
                                onChange={e => mudaTarefa(it.id, { responsavel: e.target.value })}
                                className="w-full p-3 pl-8 bg-slate-50 border border-slate-200 rounded-lg font-medium text-base outline-none focus:border-emerald-500"
                              />
                            </span>
                          )}
                          <button type="button"
                            onClick={() => mudaTarefa(it.id, { conjunto: !it.conjunto, responsavel: "" })}
                            title={it.conjunto ? "Voltar para uma pessoa" : "Marcar como tarefa do time"}
                            className={`h-11 w-9 shrink-0 grid place-items-center rounded-lg border transition-colors ${it.conjunto ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-white text-slate-400 hover:border-emerald-300"}`}>
                            <Users size={15} />
                          </button>
                        </div>
                        <div className="relative col-start-2 w-full sm:col-auto sm:shrink-0 sm:w-24">
                          <Clock size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input
                            type="number" min="1" inputMode="numeric"
                            placeholder="min"
                            value={it.minutos ?? ""}
                            onChange={e => mudaTarefa(it.id, { minutos: e.target.value })}
                            className="w-full p-3 pl-8 bg-slate-50 border border-slate-200 rounded-lg font-medium text-base outline-none focus:border-emerald-500"
                          />
                        </div>
                        <label className={`col-start-2 justify-self-start sm:col-auto sm:shrink-0 h-11 w-11 flex items-center justify-center rounded-lg border cursor-pointer transition-colors ${it.foto_url ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-white hover:border-emerald-300"}`}
                          title={it.foto_url ? "Trocar a foto de como deve ficar" : "Foto de como deve ficar"}>
                          <input type="file" accept="image/*" className="hidden"
                            onChange={e => { const f = e.target.files?.[0]; e.target.value = ""; enviarFotoTarefa(it.id, f); }} />
                          {subindoFoto === it.id
                            ? <span className="text-[10px] font-black text-slate-400">...</span>
                            : it.foto_url
                              ? <img src={it.foto_url} alt="Como deve ficar" className="h-9 w-9 rounded object-cover" />
                              : <Camera size={16} className="text-slate-400" />}
                        </label>
                        {it.foto_url && (
                          <button type="button" onClick={() => mudaTarefa(it.id, { foto_url: null })}
                            className="col-start-2 justify-self-start sm:col-auto text-[10px] font-bold text-slate-400 hover:text-red-600 underline">
                            tirar foto
                          </button>
                        )}
                        <button onClick={() => removeTarefa(it.id)} className="col-start-2 justify-self-end sm:col-auto w-11 h-11 flex items-center justify-center text-slate-400 hover:text-red-500 transition-colors shrink-0" aria-label={`Remover tarefa ${i + 1}`}><Trash2 size={17} /></button>
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
