"use client";

// FRITADEIRA E COIFA (dono, 24/11/2026). Regras: app/lib/equipamentos.mjs;
// leitura e gravação: app/lib/equipamentos-dados.js. O Nico e o Jhon mostram o
// mesmo (EquipamentoGuiado).

import { useMemo, useState } from "react";
import { ChevronDown, Download, Flame, Pencil, Plus, Printer, Trash2 } from "lucide-react";
import CabecalhoTela from "../../../components/ui/CabecalhoTela";
import { useERP } from "../../../context/ERPContext";
import { usePermission } from "../../../components/access-control/PermissionGate";
import { useEquipamentos } from "../../../lib/equipamentos-dados";
import { TAREFAS, TIPOS_EQUIPAMENTO, avisosEquipamentos, csvPlanilha, dataBR, planilhaEquipamentos } from "../../../lib/equipamentos.mjs";
import { AcoesTarefa, AvisosEquipamentos, ComoFazer, EditorTarefa, Situacao, inputEq } from "../../../components/equipamentos/Partes";

function NovoEquipamento({ onCriar, onCancelar }) {
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState("fritadeira");
  const [freq, setFreq] = useState({});
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const tarefas = TIPOS_EQUIPAMENTO[tipo].tarefas;
  async function criar() {
    if (!nome.trim()) return setErro("Dê um nome (ex.: Fritadeira 1).");
    if (!tarefas.some((t) => Number(freq[t]) > 0)) return setErro("Diga de quantos em quantos dias para pelo menos uma tarefa.");
    setSalvando(true); setErro("");
    try { await onCriar({ nome, tipo, freq }); onCancelar(); } catch (e) { setErro(e.message); }
    setSalvando(false);
  }
  return (
    <div className="space-y-3 rounded-2xl border border-hf-border bg-hf-surface p-4">
      <div className="flex flex-wrap gap-2">
        {Object.entries(TIPOS_EQUIPAMENTO).map(([id, t]) => (
          <button key={id} type="button" aria-pressed={tipo === id} onClick={() => { setTipo(id); setNome((n) => n || (id === "outro" ? "" : t.rotulo)); }}
            className={`min-h-[44px] rounded-full px-4 text-[14px] font-semibold ${tipo === id ? "bg-hf-menu text-white" : "border border-hf-border text-hf-text"}`}>{id === "outro" ? "Outro" : t.rotulo}</button>
        ))}
      </div>
      <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome (ex.: Fritadeira 1)" className={inputEq} />
      {tarefas.map((t) => (
        <label key={t} className="flex items-center justify-between gap-2 text-[15px] text-hf-text">
          <span>{TAREFAS[t].rotulo}: de quantos em quantos dias?</span>
          <input inputMode="numeric" value={freq[t] || ""} onChange={(e) => setFreq((f) => ({ ...f, [t]: e.target.value.replace(/\D/g, "") }))} placeholder={t === "limpeza" && tipo === "coifa" ? "15" : "dias"} className={`${inputEq} w-20 text-center`} />
        </label>
      ))}
      <p className="text-[13px] text-hf-muted">Tarefa sem número não entra na agenda (dá para pôr depois). O passo a passo e os materiais você põe em seguida, em cada tarefa.</p>
      {erro && <p className="text-[14px] font-semibold text-hf-danger">{erro}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={onCancelar} className="h-12 flex-1 rounded-xl border border-hf-border text-[15px] font-semibold text-hf-text">Cancelar</button>
        <button type="button" disabled={salvando} onClick={criar} className="h-12 flex-1 rounded-xl bg-hf-menu text-[15px] font-semibold text-white disabled:opacity-50">{salvando ? "Criando…" : "Criar"}</button>
      </div>
    </div>
  );
}

function LinhaTarefa({ equipamento, tarefa, api, podeEditar, podeRegistrar }) {
  const [aberto, setAberto] = useState(false);
  const [editando, setEditando] = useState(false);
  return (
    <li className="py-3">
      <button type="button" onClick={() => setAberto((v) => !v)} aria-expanded={aberto} className="flex w-full items-center gap-3 text-left">
        <span className="min-w-0 flex-1">
          <span className="block text-[16px] font-semibold text-hf-text">{TAREFAS[tarefa.tarefa]?.rotulo}</span>
          <span className="mt-1 flex flex-wrap items-center gap-2 text-[13px] text-hf-muted"><Situacao tarefa={tarefa} />{tarefa.frequencia_dias ? `a cada ${tarefa.frequencia_dias} dias` : ""}{tarefa.ultima_execucao ? ` · última ${dataBR(tarefa.ultima_execucao)}` : ""}</span>
        </span>
        <ChevronDown size={18} className={`shrink-0 text-hf-muted transition-transform ${aberto ? "rotate-180" : ""}`} />
      </button>
      {aberto && (
        <div className="mt-3 space-y-3">
          {editando ? (
            <EditorTarefa equipamento={equipamento} tarefa={tarefa} onSalvar={api.salvarTarefa} onCancelar={() => setEditando(false)} />
          ) : (
            <>
              <ComoFazer tarefa={tarefa} />
              {podeRegistrar && <AcoesTarefa tarefa={tarefa} onFiz={api.fizAgora} onReagendar={api.reagendar} />}
              {podeEditar && <button type="button" onClick={() => setEditando(true)} className="flex h-10 items-center gap-1.5 text-[14px] font-semibold text-hf-text-2"><Pencil size={15} /> Ajustar passo a passo, materiais e dias</button>}
            </>
          )}
        </div>
      )}
    </li>
  );
}

function imprimirPlanilha(linhas, unidade) {
  const esc = (v) => String(v ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const dh = (iso) => (iso ? new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" }) : "");
  const iframe = document.createElement("iframe");
  iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument;
  doc.open();
  doc.write(`<html><head><meta charset="utf-8"><title>Fritadeira e coifa</title><style>body{font-family:system-ui,sans-serif;padding:20px}h1{font-size:20px}table{width:100%;border-collapse:collapse;font-size:13px}td,th{border:1px solid #d1d5db;padding:6px;text-align:left}</style></head><body>
    <h1>Fritadeira e coifa · registros${unidade ? ` · ${esc(unidade)}` : ""}</h1><table><tr><th>Data</th><th>Equipamento</th><th>Tarefa</th><th>Quem fez</th><th>Observação</th></tr>
    ${linhas.map((l) => `<tr><td>${dh(l.data)}</td><td>${esc(l.equipamento)}</td><td>${esc(l.tarefa)}</td><td>${esc(l.responsavel)}</td><td>${esc(l.observacao)}</td></tr>`).join("")}</table></body></html>`);
  doc.close();
  setTimeout(() => { try { iframe.contentWindow.print(); } finally { setTimeout(() => iframe.remove(), 60000); } }, 50);
}

export default function EquipamentosPage() {
  const { unidadeAtiva, unidadeInfo } = useERP();
  const api = useEquipamentos(unidadeAtiva);
  const podeEditar = usePermission("cozinha.equipment.edit");
  const podeRegistrar = usePermission("cozinha.equipment.record") || podeEditar;
  const podeCriar = usePermission("cozinha.equipment.create");
  const podeExcluir = usePermission("cozinha.equipment.delete");
  const [aba, setAba] = useState("agenda");
  const [novo, setNovo] = useState(false);
  const avisos = useMemo(() => avisosEquipamentos(api.equipamentos, { insumos: api.insumos, saldos: api.saldos }), [api.equipamentos, api.insumos, api.saldos]);
  const planilha = useMemo(() => planilhaEquipamentos(api.equipamentos), [api.equipamentos]);

  function baixarCsv() {
    const url = URL.createObjectURL(new Blob([csvPlanilha(planilha)], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = "fritadeira-e-coifa.csv"; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }
  async function remover(e) {
    if (!window.confirm(`Tirar "${e.nome}" da tela? Os registros continuam guardados.`)) return;
    try { await api.remover(e); } catch (er) { window.alert(`Não tirou: ${er.message}`); }
  }

  if (!unidadeAtiva || unidadeAtiva === "todas") return <p className="mx-auto max-w-3xl px-4 py-8 text-center text-hf-muted">Escolha uma unidade.</p>;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-5 sm:px-6">
      <CabecalhoTela titulo="Fritadeira e coifa" subtitulo="Abastecer, filtrar e limpar no dia certo, com o passo a passo" icone={Flame} />

      <div className="flex gap-2 rounded-full bg-hf-elevated p-1">
        {[["agenda", "Agenda"], ["registros", `Registros${planilha.length ? ` (${planilha.length})` : ""}`]].map(([id, r]) => (
          <button key={id} type="button" onClick={() => setAba(id)} className={`h-11 flex-1 rounded-full text-[15px] font-semibold ${aba === id ? "bg-hf-menu text-white" : "text-hf-text-2"}`}>{r}</button>
        ))}
      </div>

      {api.erro && <p role="alert" className="rounded-2xl bg-hf-danger/10 px-4 py-3 text-[14px] font-semibold text-hf-danger">Não consegui carregar: {api.erro}</p>}
      {api.carregando ? <p className="py-8 text-center text-hf-muted">Carregando…</p> : aba === "agenda" ? (
        <>
          <AvisosEquipamentos avisos={avisos} />
          {api.equipamentos.map((e) => (
            <section key={e.id} className="rounded-2xl border border-hf-border bg-hf-surface px-4 py-2">
              <div className="flex items-center justify-between gap-2 pt-1">
                <h2 className="text-[17px] font-semibold text-hf-text">{e.nome}</h2>
                {podeExcluir && <button type="button" aria-label={`Tirar ${e.nome}`} onClick={() => remover(e)} className="grid h-10 w-10 place-items-center text-hf-muted hover:text-hf-danger"><Trash2 size={16} /></button>}
              </div>
              {e.tarefas.length ? (
                <ul className="divide-y divide-hf-border">{e.tarefas.map((t) => <LinhaTarefa key={t.id} equipamento={e} tarefa={t} api={api} podeEditar={podeEditar} podeRegistrar={podeRegistrar} />)}</ul>
              ) : <p className="py-3 text-[14px] text-hf-muted">Sem tarefa na agenda.</p>}
            </section>
          ))}
          {!api.equipamentos.length && !novo && (
            <div className="rounded-2xl border border-dashed border-hf-border px-4 py-8 text-center">
              <p className="font-semibold text-hf-text">Nenhum equipamento ainda.</p>
              <p className="mt-1 text-[14px] text-hf-muted">Comece pela fritadeira e pela coifa: diga de quantos em quantos dias cada tarefa é feita.</p>
            </div>
          )}
          {novo ? <NovoEquipamento onCriar={api.criar} onCancelar={() => setNovo(false)} /> : podeCriar && (
            <button type="button" onClick={() => setNovo(true)} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-hf-menu text-[15px] font-semibold text-white"><Plus size={18} /> Equipamento</button>
          )}
        </>
      ) : (
        <section className="space-y-3">
          {planilha.length > 0 && (
            <div className="flex gap-2">
              <button type="button" onClick={() => imprimirPlanilha(planilha, unidadeInfo?.nome)} className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-hf-border text-[14px] font-semibold text-hf-text"><Printer size={16} /> Imprimir</button>
              <button type="button" onClick={baixarCsv} className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-hf-border text-[14px] font-semibold text-hf-text"><Download size={16} /> Planilha (Excel)</button>
            </div>
          )}
          {!planilha.length ? <p className="py-6 text-center text-hf-muted">Nenhum registro ainda. Cada "Fiz agora" entra aqui.</p> : (
            <ul className="divide-y divide-hf-border rounded-2xl border border-hf-border bg-hf-surface">
              {planilha.map((l, i) => (
                <li key={i} className="px-4 py-3">
                  <p className="text-[15px] font-semibold text-hf-text">{l.equipamento} · {l.tarefa}</p>
                  <p className="text-[13px] text-hf-muted">{new Date(l.data).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}{l.responsavel ? ` · ${l.responsavel}` : ""}{l.observacao ? ` · ${l.observacao}` : ""}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
