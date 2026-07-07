"use client";

import { useState, useEffect } from "react";
import {
  Sun, Moon, CheckCircle2, Check, ChevronDown, User, Printer,
  ChefHat, Wine, Armchair, ClipboardList, Plus, Settings, Loader2
} from "lucide-react";
import {
  PageHeader, PageBody, Card, SectionLabel, Field, TextInput, Btn, EmptyState,
} from "../../../components/ui";
import { useERP } from "../../../context/ERPContext";
import { fetchTemplates, salvarExecucao, fetchHistoricoExecucoes } from "../../../lib/checklists";
import { fetchColaboradores } from "../../../lib/rh";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

/* ─── Tema visual por departamento ─── */
const TEMAS = {
  cozinha: {
    nome: "Cozinha", Icon: ChefHat,
    cor: "#F59E0B", corClara: "#FFFBEB", corBorda: "#FDE68A", corTexto: "#92400E",
    corBg: "linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%)",
  },
  bar: {
    nome: "Bar", Icon: Wine,
    cor: "#8B5CF6", corClara: "#F5F3FF", corBorda: "#DDD6FE", corTexto: "#5B21B6",
    corBg: "linear-gradient(135deg, #EDE9FE 0%, #DDD6FE 100%)",
  },
  salao: {
    nome: "Salão", Icon: Armchair,
    cor: "#0EA5E9", corClara: "#F0F9FF", corBorda: "#BAE6FD", corTexto: "#0C4A6E",
    corBg: "linear-gradient(135deg, #E0F2FE 0%, #BAE6FD 100%)",
  },
};

const ROTULOS_TIPO = {
  abertura: "Abertura", fechamento: "Fechamento", mise_en_place: "Mise en Place",
  pre_preparos: "Pré-preparos p/ outro dia", limpeza_organizacao: "Limpeza e Organização", operacional: "Operacional", limpeza: "Limpeza",
};
// Ordem lógica do dia para agrupar os checklists na tela
const ORDEM_TIPOS = ["abertura", "mise_en_place", "pre_preparos", "operacional", "limpeza_organizacao", "limpeza", "fechamento"];

function RotinaRunner() {
  const { unidadeAtiva, unidadeInfo } = useERP();
  const router = useRouter();
  const searchParams = useSearchParams();
  const deptUrl = searchParams.get("dept");

  const [dept, setDept] = useState(TEMAS[deptUrl] ? deptUrl : "cozinha");
  const [templates, setTemplates] = useState([]);
  const [colaboradores, setColaboradores] = useState([]);
  const [loading, setLoading] = useState(true);

  // Execução
  const [checklistAtual, setChecklistAtual] = useState(null);
  const [respostas, setRespostas] = useState({});
  const [colabSelecionado, setColabSelecionado] = useState("");
  const [exp, setExp] = useState(null);
  const [registrado, setRegistrado] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const t = TEMAS[dept];

  const [historico, setHistorico] = useState([]);

  const carregar = async () => {
    setLoading(true);
    const hoje = new Date().toISOString().split("T")[0];
    const [resT, resC, resH] = await Promise.all([
      fetchTemplates(unidadeAtiva, dept),
      fetchColaboradores(unidadeAtiva),
      fetchHistoricoExecucoes(unidadeAtiva, hoje, dept),
    ]);
    setTemplates(resT.data || []);
    setColaboradores(resC.data || []);
    setHistorico(resH.data || []);
    setLoading(false);
  };

  useEffect(() => {
    if (unidadeAtiva && unidadeAtiva !== "todas") carregar();
  }, [unidadeAtiva, dept]);

  // Segue o ?dept= da URL (clicar em Checklist na Cozinha/Bar/Salão troca a aba)
  useEffect(() => {
    if (TEMAS[deptUrl] && deptUrl !== dept) { setDept(deptUrl); setChecklistAtual(null); }
  }, [deptUrl]);

  const trocarDept = (d) => {
    setDept(d);
    setChecklistAtual(null);
    setRegistrado(false);
  };

  const iniciar = (tmpl) => {
    setChecklistAtual(tmpl);
    const ini = {};
    (tmpl.itens || []).forEach(i => ini[i.id] = { marcado: false, obs: "" });
    setRespostas(ini);
    setColabSelecionado("");
    setRegistrado(false);
    setExp(null);
  };

  const toggle = (id) => {
    setRespostas(r => ({ ...r, [id]: { ...r[id], marcado: !r[id].marcado } }));
    setRegistrado(false);
  };

  const mudaObs = (id, txt) => {
    setRespostas(r => ({ ...r, [id]: { ...r[id], obs: txt } }));
  };

  const itens = checklistAtual?.itens || [];
  const concluidas = itens.filter(i => respostas[i.id]?.marcado).length;
  const pct = itens.length > 0 ? Math.round((concluidas / itens.length) * 100) : 0;

  const finalizar = async () => {
    if (!colabSelecionado) return alert("Selecione quem está preenchendo.");
    if (pct < 100) return;
    setSalvando(true);

    const arrRespostas = Object.keys(respostas).map(k => ({
      id_tarefa: k,
      texto_tarefa: itens.find(i => i.id.toString() === k.toString())?.texto,
      marcado: respostas[k].marcado,
      obs: respostas[k].obs,
    }));

    await salvarExecucao({
      template_id: checklistAtual.id,
      unidade_id: unidadeAtiva,
      colaborador_id: colabSelecionado,
      data_referencia: new Date().toISOString().split("T")[0],
      respostas: arrRespostas,
    });

    setSalvando(false);
    setRegistrado(true);
  };

  /* ─── Impressão ─── */
  const imprimir = (tmpl) => {
    let catImpr = null;
    const itensHtml = (tmpl.itens || []).map((it, i) => {
      const cat = (it.categoria || "").trim();
      const header = cat && cat !== catImpr ? (catImpr = cat, `<tr class="cat"><td colspan="5">${cat}</td></tr>`) : "";
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
        <td class="n">${(tmpl.itens?.length || 0) + i + 1}</td>
        <td class="tarefa"></td><td class="resp"></td>
        <td class="check"><span class="box"></span></td><td class="visto"></td>
      </tr>`).join("");

    const deptLabel = TEMAS[tmpl.departamento]?.nome || tmpl.departamento;
    const tipoLabel = ROTULOS_TIPO[tmpl.tipo] || tmpl.tipo;
    const corDept = TEMAS[tmpl.departamento]?.cor || "#10B981";

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${tmpl.titulo}</title>
      <style>
        *{margin:0;padding:0;box-sizing:border-box}
        body{font-family:Arial,Helvetica,sans-serif;color:#111;padding:8mm}
        .head{border-bottom:4px solid ${corDept};padding-bottom:10px;margin-bottom:10px;display:flex;justify-content:space-between;align-items:flex-end}
        .tag{font-size:10px;letter-spacing:3px;text-transform:uppercase;color:${corDept};font-weight:bold}
        h1{font-size:22px;margin-top:4px}
        .meta{font-size:12px;font-weight:bold;text-align:right}
        .meta span{display:block;font-size:10px;color:#555;font-weight:normal;margin-top:2px}
        .datas{display:flex;gap:24px;font-size:12px;margin:10px 0 12px;font-weight:bold}
        .datas b{border-bottom:1px solid #999;min-width:120px;display:inline-block}
        table{width:100%;border-collapse:collapse}
        th,td{border:1px solid #333;padding:8px 6px;font-size:12px;vertical-align:middle}
        th{background:${corDept}22;text-transform:uppercase;letter-spacing:.5px;font-size:9px;color:${corDept}}
        tr.cat td{background:${corDept}18;color:${corDept};font-weight:bold;text-transform:uppercase;letter-spacing:1px;font-size:10px;height:auto;padding:5px 6px}
        td{height:32px}
        td.n{width:5%;text-align:center;color:#666}
        td.tarefa{width:45%}
        td.resp{width:22%}
        td.check{width:8%;text-align:center}
        td.visto{width:20%}
        .box{display:inline-block;width:14px;height:14px;border:2px solid #333;border-radius:3px}
        .assin{margin-top:24px;display:flex;justify-content:space-between;gap:40px}
        .assin div{flex:1;border-top:1px solid #333;padding-top:5px;font-size:10px;text-align:center;color:#444}
        @media print{@page{margin:0}}
      </style></head><body>
      <div class="head">
        <div>
          <div class="tag">${deptLabel} · ${tipoLabel} · ${unidadeInfo?.nome || ""}</div>
          <h1>${tmpl.titulo}</h1>
        </div>
        <div class="meta">${tmpl.itens?.length || 0} tarefas<span>marque ao concluir e vista</span></div>
      </div>
      <div class="datas">Data: <b>&nbsp;</b> Turno/Horário: <b>&nbsp;</b> Responsável geral: <b>&nbsp;</b></div>
      <table>
        <thead><tr><th>#</th><th>Tarefa</th><th>Responsável</th><th>Feito</th><th>Visto / Hora</th></tr></thead>
        <tbody>${itensHtml}${extras}</tbody>
      </table>
      <div class="assin">
        <div>Responsável pelo ${deptLabel}</div>
        <div>Gerente / Conferência</div>
      </div>
      </body></html>`;

    const win = window.open("", "_blank");
    if (win) { win.document.write(html); win.document.close(); setTimeout(() => win.print(), 400); }
    else alert("O navegador bloqueou a impressão. Habilite os popups.");
  };

  /* ─── Imprime TODOS os checklists do setor, cada um numa folha ─── */
  const imprimirTodos = () => {
    if (!templates.length) return alert("Nenhum checklist para imprimir.");
    const corDept = t.cor;
    const bloco = (tmpl) => {
      let catB = null;
      const linhas = (tmpl.itens || []).map((it, i) => {
        const cat = (it.categoria || "").trim();
        const header = cat && cat !== catB ? (catB = cat, `<tr class="cat"><td colspan="5">${cat}</td></tr>`) : "";
        return `${header}<tr><td class="n">${i + 1}</td><td class="tarefa">${it.texto || ""}</td><td class="resp">${it.responsavel || ""}</td><td class="check"><span class="box"></span></td><td class="visto"></td></tr>`;
      }).join("");
      const extras = Array.from({ length: 2 }).map((_, i) => `
        <tr><td class="n">${(tmpl.itens?.length || 0) + i + 1}</td><td class="tarefa"></td><td class="resp"></td><td class="check"><span class="box"></span></td><td class="visto"></td></tr>`).join("");
      return `<section>
        <div class="head">
          <div><div class="tag">${t.nome} · ${ROTULOS_TIPO[tmpl.tipo] || tmpl.tipo} · ${unidadeInfo?.nome || ""}</div><h1>${tmpl.titulo}</h1></div>
          <div class="meta">${tmpl.itens?.length || 0} tarefas<span>marque ao concluir e vista</span></div>
        </div>
        <div class="datas">Data: <b>&nbsp;</b> Turno/Horário: <b>&nbsp;</b> Responsável geral: <b>&nbsp;</b></div>
        <table><thead><tr><th>#</th><th>Tarefa</th><th>Responsável</th><th>Feito</th><th>Visto / Hora</th></tr></thead><tbody>${linhas}${extras}</tbody></table>
        <div class="assin"><div>Responsável pelo ${t.nome}</div><div>Gerente / Conferência</div></div>
      </section>`;
    };
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Checklists ${t.nome}</title>
      <style>
        *{margin:0;padding:0;box-sizing:border-box}
        body{font-family:Arial,Helvetica,sans-serif;color:#111}
        section{padding:8mm;page-break-after:always}
        section:last-child{page-break-after:auto}
        .head{border-bottom:4px solid ${corDept};padding-bottom:10px;margin-bottom:10px;display:flex;justify-content:space-between;align-items:flex-end}
        .tag{font-size:10px;letter-spacing:3px;text-transform:uppercase;color:${corDept};font-weight:bold}
        h1{font-size:22px;margin-top:4px}
        .meta{font-size:12px;font-weight:bold;text-align:right}.meta span{display:block;font-size:10px;color:#555;font-weight:normal;margin-top:2px}
        .datas{display:flex;gap:24px;font-size:12px;margin:10px 0 12px;font-weight:bold}.datas b{border-bottom:1px solid #999;min-width:120px;display:inline-block}
        table{width:100%;border-collapse:collapse}
        th,td{border:1px solid #333;padding:8px 6px;font-size:12px;vertical-align:middle}
        th{background:${corDept}22;text-transform:uppercase;letter-spacing:.5px;font-size:9px;color:${corDept}}
        tr.cat td{background:${corDept}18;color:${corDept};font-weight:bold;text-transform:uppercase;letter-spacing:1px;font-size:10px;height:auto;padding:5px 6px}
        td{height:32px}td.n{width:5%;text-align:center;color:#666}td.tarefa{width:45%}td.resp{width:22%}td.check{width:8%;text-align:center}td.visto{width:20%}
        .box{display:inline-block;width:14px;height:14px;border:2px solid #333;border-radius:3px}
        .assin{margin-top:24px;display:flex;justify-content:space-between;gap:40px}.assin div{flex:1;border-top:1px solid #333;padding-top:5px;font-size:10px;text-align:center;color:#444}
        @media print{@page{margin:0}}
      </style></head><body>${templates.map(bloco).join("")}</body></html>`;
    const win = window.open("", "_blank");
    if (win) { win.document.write(html); win.document.close(); setTimeout(() => win.print(), 400); }
    else alert("O navegador bloqueou a impressão. Habilite os popups.");
  };

  /* ─── EXECUÇÃO DE UM CHECKLIST ─── */
  if (checklistAtual) {
    const DIcon = t.Icon;
    const tipoLabel = ROTULOS_TIPO[checklistAtual.tipo] || checklistAtual.tipo;

    return (
      <div className="min-h-screen pb-28">
        <PageHeader title={checklistAtual.titulo} subtitle={`${t.nome} · ${tipoLabel} · ${unidadeInfo?.nome || ""}`} icon={DIcon} back={false}>
          <button onClick={() => setChecklistAtual(null)} className="erp-btn erp-btn-ghost !h-9 text-xs">← Voltar</button>
          <button onClick={() => imprimir(checklistAtual)} className="erp-btn erp-btn-ghost !h-9 text-xs"><Printer size={14} /> Imprimir</button>
        </PageHeader>
        <PageBody>
          {/* Progresso */}
          <div className="erp-card p-5 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-28 h-28 opacity-[0.05]">
              <DIcon size={112} style={{ position: "absolute", top: -16, right: -16, color: t.cor }} />
            </div>
            <div className="flex items-end justify-between mb-3 relative z-[1]">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: t.cor }}>{t.nome} · {tipoLabel}</p>
                <p className="text-5xl font-black leading-none" style={{ color: pct === 100 ? t.cor : "var(--fg)" }}>{pct}%</p>
              </div>
              <div className="text-right">
                <p className="text-[11px] font-bold" style={{ color: "var(--dim)" }}>{concluidas} de {itens.length}</p>
                <p className="text-[10px]" style={{ color: "var(--dim)" }}>tarefas concluídas</p>
              </div>
            </div>
            <div className="h-3 rounded-full overflow-hidden" style={{ background: "var(--elevated)" }}>
              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${t.cor}CC, ${t.cor})` }} />
            </div>
            {pct === 100 && <p className="text-xs font-black mt-2 flex items-center gap-1" style={{ color: t.cor }}><CheckCircle2 size={14} /> Todas concluídas!</p>}
          </div>

          {/* Quem preenche */}
          <Card>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: `${t.cor}15` }}>
                <User size={15} style={{ color: t.cor }} />
              </div>
              <p className="text-sm font-bold" style={{ color: "var(--fg)" }}>Quem está preenchendo?</p>
            </div>
            <select value={colabSelecionado} onChange={e => setColabSelecionado(e.target.value)}
              className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-emerald-500"
              style={{ borderColor: colabSelecionado ? t.cor : undefined }}>
              <option value="">-- Selecione seu nome --</option>
              {colaboradores.map(c => <option key={c.id} value={c.id}>{c.nome} ({c.cargo})</option>)}
            </select>
          </Card>

          {/* Itens */}
          <div>
            <SectionLabel>Tarefas</SectionLabel>
            <div className="space-y-2">
              {itens.map((it, i) => {
                const ok = !!respostas[it.id]?.marcado;
                const aberto = exp === it.id;
                const cat = (it.categoria || "").trim();
                const catAnterior = i > 0 ? (itens[i - 1].categoria || "").trim() : null;
                const mostrarCat = cat && cat !== catAnterior;
                return (
                  <div key={it.id}>
                  {mostrarCat && (
                    <p className="text-[10px] font-black uppercase tracking-widest mt-4 mb-1.5 px-1" style={{ color: t.cor }}>{cat}</p>
                  )}
                  <div className="erp-card !p-0 overflow-hidden transition-all duration-200"
                    style={{ borderColor: ok ? t.cor : undefined, borderWidth: ok ? 2 : undefined, boxShadow: ok ? `0 4px 20px ${t.cor}15` : undefined }}>
                    <div className="flex items-center gap-3 px-4 py-3.5">
                      <button onClick={() => toggle(it.id)} className="flex-shrink-0 active:scale-90 transition-all duration-200">
                        {ok ? (
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: t.cor }}>
                            <Check size={18} color="#fff" />
                          </div>
                        ) : (
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center border-2" style={{ borderColor: "var(--faint)", color: "var(--dim)" }}>
                            <span className="text-xs font-black">{i + 1}</span>
                          </div>
                        )}
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold leading-tight transition-all"
                          style={{ color: ok ? t.cor : "var(--fg)", textDecoration: ok ? "line-through" : "none", opacity: ok ? 0.85 : 1 }}>
                          {it.texto}
                        </p>
                        {it.responsavel && <p className="text-[10px] font-bold mt-0.5" style={{ color: "var(--dim)" }}>Responsável: {it.responsavel}</p>}
                      </div>
                      {ok && (
                        <button onClick={() => setExp(aberto ? null : it.id)} className="flex-shrink-0 p-1">
                          <ChevronDown size={16} style={{ color: "var(--dim)", transform: aberto ? "rotate(180deg)" : "none", transition: "transform 200ms" }} />
                        </button>
                      )}
                    </div>
                    {ok && aberto && (
                      <div className="px-4 pb-3 pt-2" style={{ borderTop: "1px solid var(--line)" }}>
                        <input type="text" placeholder="Observação (opcional)"
                          value={respostas[it.id]?.obs || ""}
                          onChange={e => mudaObs(it.id, e.target.value)}
                          className="w-full p-2.5 text-sm font-medium rounded-lg outline-none"
                          style={{ background: `${t.cor}08`, border: `1px solid ${t.cor}30`, color: t.corTexto }}
                          onClick={e => e.stopPropagation()} />
                      </div>
                    )}
                  </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Finalizar */}
          {registrado ? (
            <div className="erp-card p-6 flex flex-col items-center text-center gap-2" style={{ border: `2px solid ${t.cor}`, background: t.corClara }}>
              <CheckCircle2 size={40} style={{ color: t.cor }} />
              <p className="text-lg font-black" style={{ color: t.corTexto }}>Checklist registrado!</p>
              <p className="text-xs font-medium" style={{ color: t.corTexto }}>
                {t.nome} · {tipoLabel} · {unidadeInfo?.nome} — por <b>{colaboradores.find(c => c.id === colabSelecionado)?.nome || ""}</b>
              </p>
              <button onClick={() => setChecklistAtual(null)} className="mt-2 text-sm font-bold underline" style={{ color: t.cor }}>← Voltar aos checklists</button>
            </div>
          ) : (
            <button className="w-full py-4 rounded-2xl font-black text-base transition-all duration-200 active:scale-[0.98] flex items-center justify-center gap-2"
              disabled={pct < 100 || !colabSelecionado || salvando}
              onClick={finalizar}
              style={{
                background: pct === 100 && colabSelecionado ? t.cor : "var(--elevated)",
                color: pct === 100 && colabSelecionado ? "#fff" : "var(--dim)",
                boxShadow: pct === 100 && colabSelecionado ? `0 8px 30px ${t.cor}40` : "none",
                cursor: pct < 100 || !colabSelecionado ? "not-allowed" : "pointer",
              }}>
              {salvando ? <><Loader2 size={18} className="animate-spin" /> Salvando...</> :
                pct === 100 ? "Finalizar e registrar" : `Conclua as tarefas (${itens.length - concluidas} restantes)`}
            </button>
          )}
        </PageBody>
      </div>
    );
  }

  /* ─── LISTA DE CHECKLISTS POR DEPARTAMENTO ─── */
  const DIcon = t.Icon;

  return (
    <div className="min-h-screen pb-24">
      <PageHeader title="Checklist" subtitle={`${t.nome} · ${unidadeInfo?.nome || ""}`} icon={DIcon}
        onAction={() => router.push("/dashboard/checklists/gerenciar")} actionLabel="Gerenciar">
        {templates.length > 0 && (
          <button onClick={imprimirTodos} className="erp-btn erp-btn-ghost !h-9 text-xs"><Printer size={14} /> Imprimir todos</button>
        )}
      </PageHeader>
      <PageBody>

        {/* Seletor de Departamento */}
        <div className="grid grid-cols-3 gap-3 mb-1">
          {Object.entries(TEMAS).map(([key, tema]) => {
            const ativo = dept === key;
            const DepIcon = tema.Icon;
            return (
              <button key={key} onClick={() => trocarDept(key)}
                className="relative flex flex-col items-center gap-2 py-5 rounded-2xl font-bold text-sm transition-all duration-300 active:scale-95 overflow-hidden"
                style={{
                  background: ativo ? tema.corBg : "var(--card-bg)",
                  border: `2px solid ${ativo ? tema.cor : "var(--line)"}`,
                  color: ativo ? tema.corTexto : "var(--dim)",
                  boxShadow: ativo ? `0 8px 30px ${tema.cor}25` : "none",
                }}>
                <div className="w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300"
                  style={{ background: ativo ? `${tema.cor}20` : "var(--elevated)" }}>
                  <DepIcon size={24} style={{ color: ativo ? tema.cor : "var(--muted)" }} />
                </div>
                <span className="text-xs font-black uppercase tracking-widest">{tema.nome}</span>
                {ativo && <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-1 rounded-t-full" style={{ background: tema.cor }} />}
              </button>
            );
          })}
        </div>

        {/* Lista de Templates */}
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-3" style={{ color: t.cor }}>
            <Loader2 size={24} className="animate-spin" />
            <span className="font-bold text-sm">Carregando checklists...</span>
          </div>
        ) : templates.length === 0 ? (
          <EmptyState icon={ClipboardList} title={`Nenhum checklist de ${t.nome}`}
            hint="Crie modelos de abertura, fechamento, mise en place etc. pelo Gerenciar."
            actionLabel="Criar checklists" onAction={() => router.push("/dashboard/checklists/gerenciar")} />
        ) : (
          <div className="space-y-6">
            {ORDEM_TIPOS.filter(tipo => templates.some(x => x.tipo === tipo)).map(tipo => (
              <div key={tipo}>
                <SectionLabel>{ROTULOS_TIPO[tipo] || tipo}</SectionLabel>
                <div className="space-y-3">
                  {templates.filter(x => x.tipo === tipo).map(tmpl => {
                    const execHoje = historico.find(h => h.template_id === tmpl.id);
                    return (
                    <div key={tmpl.id} className="erp-card !p-0 overflow-hidden hover:shadow-lg transition-all duration-200"
                      style={{ borderLeft: `4px solid ${execHoje ? t.cor : t.cor}` }}>
                      <div className="flex items-center gap-4 p-5">
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: execHoje ? t.cor : `${t.cor}15` }}>
                          {execHoje ? <CheckCircle2 size={22} color="#fff" /> : <DIcon size={22} style={{ color: t.cor }} />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-base font-black leading-tight truncate" style={{ color: "var(--fg)" }}>{tmpl.titulo}</h3>
                          {execHoje ? (
                            <p className="text-[11px] font-bold mt-0.5" style={{ color: t.cor }}>
                              ✓ Feito hoje por {execHoje.colaboradores?.nome || "colaborador"} · {new Date(execHoje.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                            </p>
                          ) : (
                            <p className="text-[11px] font-medium mt-0.5" style={{ color: "var(--dim)" }}>
                              {tmpl.itens?.length || 0} tarefas
                              {(tmpl.itens || []).some(i => i.responsavel) && <span style={{ color: t.cor }}> · responsáveis definidos</span>}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button onClick={() => imprimir(tmpl)} title="Imprimir"
                            className="w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200"
                            style={{ background: "var(--elevated)", color: "var(--muted)" }}>
                            <Printer size={17} />
                          </button>
                          <button onClick={() => iniciar(tmpl)}
                            className="px-5 py-2.5 rounded-xl font-black text-sm transition-all duration-200 active:scale-95"
                            style={{ background: execHoje ? "var(--elevated)" : t.cor, color: execHoje ? "var(--muted)" : "#fff", boxShadow: execHoje ? "none" : `0 4px 16px ${t.cor}30` }}>
                            {execHoje ? "Refazer" : "Preencher"}
                          </button>
                        </div>
                      </div>
                    </div>
                  );})}
                </div>
              </div>
            ))}
          </div>
        )}

      </PageBody>
    </div>
  );
}

export default function RotinaPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center font-bold text-slate-500">Carregando checklists...</div>}>
      <RotinaRunner />
    </Suspense>
  );
}
