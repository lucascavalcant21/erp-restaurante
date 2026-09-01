"use client";

// GUIA DE FUNÇÕES — a rotina de cada função, hora a hora.
//
// A escala responde "quem trabalha hoje"; esta tela responde "o que a pessoa
// faz às 15h40". A segunda pergunta vivia na cabeça de quem está na casa há
// tempo, e cobrava caro em todo treino e toda falta.
//
// É por FUNÇÃO, sem nomes: quem cobre o turno do outro lê a mesma folha.

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Clock, Coffee, Database, Loader2, Plus, Printer, RotateCcw, Save, Table, Trash2, X,
  Copy, CheckSquare, BarChart3, AlertTriangle, ShieldCheck, CheckCircle2, ListChecks, ChevronRight, RefreshCw, Layers, Check
} from "lucide-react";
import { useERP } from "../../../context/ERPContext";
import { fetchGuias, removerGuia, salvarGuia, semearGuias, TIPOS_GUIA } from "../../../lib/guias";
import {
  GUIA_FUNCOES_PADRAO, normalizarConteudo, ordenarBlocos, periodoDoBloco, periodoDoHorario, tarefasDoHorario,
  obterStatusHorario, calcularMinutosRestantes, calcularProgressoFuncao, calcularProgressoSetores,
} from "../../../lib/guia-funcoes.mjs";
import { logoSeldeestrelaSVG } from "../../../lib/marca";

const esc = (v) => String(v == null ? "" : v).replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));

export default function GuiaDeFuncoes() {
  const router = useRouter();
  const { unidadeAtiva, unidadeInfo } = useERP();
  const [funcoes, setFuncoes] = useState(GUIA_FUNCOES_PADRAO);
  const [carregando, setCarregando] = useState(true);
  const [editando, setEditando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [alterado, setAlterado] = useState(false);
  const [copiaInicial, setCopiaInicial] = useState([]);
  const [idsRemovidos, setIdsRemovidos] = useState([]);
  const [salvo, setSalvo] = useState("");
  const [semTabela, setSemTabela] = useState(false);

  // Abas e modo de operação: "guia" (visão geral/edição/impressão), "checklist" (execução do turno), "painel" (gerência)
  const [abaAtiva, setAbaAtiva] = useState("guia");
  const [funcaoChecklistId, setFuncaoChecklistId] = useState("");
  const [horaAtual, setHoraAtual] = useState("");
  const [concluidos, setConcluidos] = useState({});

  const avisar = (texto) => { setSalvo(texto); setTimeout(() => setSalvo(""), 2500); };

  // Atualiza relógio em tempo real
  useEffect(() => {
    const atualizarRelogio = () => {
      setHoraAtual(new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }));
    };
    atualizarRelogio();
    const timer = setInterval(atualizarRelogio, 10000);
    return () => clearInterval(timer);
  }, []);

  // Chave diária do localStorage para tarefas concluídas
  const hojeChave = useMemo(() => {
    const d = new Date();
    return `guias_concluidos_${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);

  useEffect(() => {
    try {
      const salvos = localStorage.getItem(hojeChave);
      if (salvos) setConcluidos(JSON.parse(salvos));
    } catch {}
  }, [hojeChave]);

  const alternarTarefaConcluida = (chave) => {
    setConcluidos(prev => {
      const prox = { ...prev, [chave]: !prev[chave] };
      try { localStorage.setItem(hojeChave, JSON.stringify(prox)); } catch {}
      return prox;
    });
  };

  const daLinha = (linha) => ({
    id: linha.id, funcao: linha.titulo, setor: linha.setor || "",
    cor: linha.cor || "#475569",
    blocos: normalizarConteudo(linha.conteudo),
  });

  const carregar = useCallback(async () => {
    if (!unidadeAtiva) return;
    setCarregando(true);
    let { data, error } = await fetchGuias(unidadeAtiva, TIPOS_GUIA.FUNCAO);
    if (error === "sem_tabela") { setSemTabela(true); setFuncoes([]); setCarregando(false); return; }
    setSemTabela(false);

    if (!data.length) {
      const semeado = await semearGuias(unidadeAtiva, GUIA_FUNCOES_PADRAO.map(f => ({
        titulo: f.funcao, setor: f.setor, cor: f.cor, conteudo: f.blocos,
      })), TIPOS_GUIA.FUNCAO);
      if (semeado.error === "sem_tabela") { setSemTabela(true); setCarregando(false); return; }
      data = semeado.data || [];
    }
    const listaNormalizada = data.map(daLinha);
    setFuncoes(listaNormalizada);
    if (listaNormalizada.length && !funcaoChecklistId) {
      setFuncaoChecklistId(listaNormalizada[0].id);
    }
    setCarregando(false);
  }, [unidadeAtiva, funcaoChecklistId]);

  useEffect(() => { carregar(); }, [carregar]);

  const clonar = (valor) => JSON.parse(JSON.stringify(valor));

  const iniciarEdicao = () => {
    setCopiaInicial(clonar(funcoes));
    setIdsRemovidos([]);
    setAlterado(false);
    setEditando(true);
  };

  const cancelarEdicao = () => {
    if (alterado && !confirm("Descartar todas as alterações que ainda não foram salvas?")) return;
    setFuncoes(clonar(copiaInicial));
    setIdsRemovidos([]);
    setAlterado(false);
    setEditando(false);
  };

  const mexer = (idFuncao, transformacao) => {
    setFuncoes(atual => {
      return atual.map(f => f.id === idFuncao ? transformacao(f) : f);
    });
    setAlterado(true);
  };

  const alterarBloco = (idFuncao, indice, campo, valor) =>
    mexer(idFuncao, f => ({ ...f, blocos: f.blocos.map((b, i) => i === indice ? { ...b, [campo]: valor } : b) }));

  const adicionarBloco = (idFuncao) =>
    mexer(idFuncao, f => ({
      ...f,
      blocos: [...f.blocos, {
        titulo: "", hora: "", fim: "",
        horarios: [{ hora: "", fim: "", tarefas: [""] }],
      }],
    }));

  const removerBloco = (idFuncao, indice) =>
    mexer(idFuncao, f => ({ ...f, blocos: f.blocos.filter((_, i) => i !== indice) }));

  const alterarHorario = (idFuncao, indiceBloco, indiceHorario, campo, valor) =>
    mexer(idFuncao, f => ({
      ...f,
      blocos: f.blocos.map((bloco, i) => i === indiceBloco
        ? { ...bloco, horarios: bloco.horarios.map((horario, j) => j === indiceHorario ? { ...horario, [campo]: valor } : horario) }
        : bloco),
    }));

  const adicionarHorario = (idFuncao, indiceBloco) =>
    mexer(idFuncao, f => ({
      ...f,
      blocos: f.blocos.map((bloco, i) => i === indiceBloco
        ? { ...bloco, horarios: [...bloco.horarios, { hora: "", fim: "", tarefas: [""] }] }
        : bloco),
    }));

  const removerHorario = (idFuncao, indiceBloco, indiceHorario) =>
    mexer(idFuncao, f => ({
      ...f,
      blocos: f.blocos.map((bloco, i) => i === indiceBloco
        ? { ...bloco, horarios: bloco.horarios.filter((_, j) => j !== indiceHorario) }
        : bloco),
    }));

  const alterarTarefa = (idFuncao, indiceBloco, indiceHorario, indiceTarefa, valor) =>
    mexer(idFuncao, f => ({
      ...f,
      blocos: f.blocos.map((bloco, i) => i === indiceBloco ? {
        ...bloco,
        horarios: bloco.horarios.map((horario, j) => j === indiceHorario
          ? { ...horario, tarefas: tarefasDoHorario(horario).map((tarefa, k) => k === indiceTarefa ? valor : tarefa) }
          : horario),
      } : bloco),
    }));

  const adicionarTarefa = (idFuncao, indiceBloco, indiceHorario) =>
    mexer(idFuncao, f => ({
      ...f,
      blocos: f.blocos.map((bloco, i) => i === indiceBloco ? {
        ...bloco,
        horarios: bloco.horarios.map((horario, j) => j === indiceHorario
          ? { ...horario, tarefas: [...tarefasDoHorario(horario), ""] }
          : horario),
      } : bloco),
    }));

  const removerTarefa = (idFuncao, indiceBloco, indiceHorario, indiceTarefa) =>
    mexer(idFuncao, f => ({
      ...f,
      blocos: f.blocos.map((bloco, i) => i === indiceBloco ? {
        ...bloco,
        horarios: bloco.horarios.map((horario, j) => {
          if (j !== indiceHorario) return horario;
          const tarefas = tarefasDoHorario(horario).filter((_, k) => k !== indiceTarefa);
          return { ...horario, tarefas: tarefas.length ? tarefas : [""] };
        }),
      } : bloco),
    }));

  const alterarFuncao = (idFuncao, campo, valor) =>
    mexer(idFuncao, f => ({ ...f, [campo]: valor }));

  const adicionarFuncao = () => {
    if (!editando) {
      setCopiaInicial(clonar(funcoes));
      setIdsRemovidos([]);
      setEditando(true);
    }
    const idTemporario = `nova-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setFuncoes(atual => [...atual, {
      id: idTemporario, funcao: "", setor: "", cor: "#475569",
      blocos: [{
        titulo: "", hora: "", fim: "",
        horarios: [{ hora: "", fim: "", tarefas: [""] }],
      }],
    }]);
    setAlterado(true);
    setTimeout(() => {
      const campo = document.querySelector(`[data-funcao-id="${idTemporario}"] input[placeholder="Nome da função"]`);
      campo?.scrollIntoView({ behavior: "smooth", block: "center" });
      campo?.focus();
    }, 50);
  };

  // REQUISITO SOLICITADO: Clonar Função em 1 clique
  const clonarFuncao = (idFuncao) => {
    if (!editando) {
      setCopiaInicial(clonar(funcoes));
      setIdsRemovidos([]);
      setEditando(true);
    }
    const origem = funcoes.find(f => f.id === idFuncao);
    if (!origem) return;
    const idTemporario = `nova-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const clonada = {
      ...clonar(origem),
      id: idTemporario,
      funcao: `${origem.funcao || "Nova Função"} (Cópia)`,
    };
    setFuncoes(atual => [...atual, clonada]);
    setAlterado(true);
    avisar(`Função "${clonada.funcao}" clonada! Clique em Salvar alterações.`);
    setTimeout(() => {
      const campo = document.querySelector(`[data-funcao-id="${idTemporario}"] input[placeholder="Nome da função"]`);
      campo?.scrollIntoView({ behavior: "smooth", block: "center" });
      campo?.focus();
    }, 50);
  };

  const removerFuncao = (idFuncao) => {
    const alvo = funcoes.find(f => f.id === idFuncao);
    if (!confirm(`Excluir a ficha inteira de "${alvo?.funcao || "sem nome"}", com todas as linhas? A exclusão só será confirmada quando você clicar em Salvar alterações.`)) return;
    if (!String(idFuncao).startsWith("nova-")) setIdsRemovidos(atual => [...atual, idFuncao]);
    setFuncoes(atual => atual.filter(f => f.id !== idFuncao));
    setAlterado(true);
    avisar("Ficha removida do rascunho — clique em Salvar alterações");
  };

  const salvarAlteracoes = async () => {
    if (!alterado) { setEditando(false); return; }
    const semNome = funcoes.find(f => !String(f.funcao || "").trim());
    if (semNome) {
      avisar("Preencha o nome da função antes de salvar");
      setTimeout(() => {
        const campo = document.querySelector(`[data-funcao-id="${semNome.id}"] input[placeholder="Nome da função"]`);
        campo?.scrollIntoView({ behavior: "smooth", block: "center" });
        campo?.focus();
      }, 50);
      return;
    }
    setSalvando(true);

    for (let ordem = 0; ordem < funcoes.length; ordem += 1) {
      const funcao = funcoes[ordem];
      const nova = String(funcao.id).startsWith("nova-");
      const { error } = await salvarGuia({
        id: nova ? undefined : funcao.id,
        unidade_id: unidadeAtiva,
        tipo: TIPOS_GUIA.FUNCAO,
        titulo: funcao.funcao,
        setor: funcao.setor,
        cor: funcao.cor,
        conteudo: ordenarBlocos(funcao.blocos),
        ordem,
      });
      if (error === "sem_tabela") {
        setSemTabela(true);
        setSalvando(false);
        return;
      }
      if (error) {
        setSalvando(false);
        return avisar(`Não consegui salvar: ${error}`);
      }
    }

    for (const id of idsRemovidos) {
      const { error } = await removerGuia(id);
      if (error) {
        setSalvando(false);
        return avisar(`Não consegui excluir a ficha: ${error}`);
      }
    }

    await carregar();
    setCopiaInicial([]);
    setIdsRemovidos([]);
    setAlterado(false);
    setEditando(false);
    setSalvando(false);
    avisar("Alterações salvas");
  };

  const restaurarPadrao = () => {
    if (!confirm("Substituir o rascunho pelo modelo padrão? A mudança só irá para os outros aparelhos quando você clicar em Salvar alterações.")) return;
    const idsAtuais = funcoes
      .filter(f => !String(f.id).startsWith("nova-"))
      .map(f => f.id);
    setIdsRemovidos(atual => [...new Set([...atual, ...idsAtuais])]);
    setFuncoes(GUIA_FUNCOES_PADRAO.map((f, indice) => ({
      ...clonar(f),
      id: `nova-padrao-${Date.now()}-${indice}`,
      blocos: normalizarConteudo(f.blocos),
    })));
    setAlterado(true);
    avisar("Modelo padrão aplicado ao rascunho — clique em Salvar alterações");
  };

  const funcoesOrdenadas = useMemo(
    () => funcoes.map(f => ({ ...f, blocos: ordenarBlocos(f.blocos) })),
    [funcoes],
  );

  const funcoesExibidas = editando ? funcoes : funcoesOrdenadas;

  const imprimir = () => {
    const win = window.open("", "_blank");
    if (!win) return alert("Habilite pop-ups para imprimir.");
    const paginas = funcoesOrdenadas.map((f, indice) => `
      <section class="pagina${indice < funcoesOrdenadas.length - 1 ? " quebra" : ""}">
        <div class="marca">${logoSeldeestrelaSVG(38)}</div>
        <div class="faixa" style="background:${esc(f.cor)}"></div>
        <h1>${esc(f.funcao || "(sem nome)")}</h1>
        <p class="sub">${esc(f.setor || "")} · ${esc(unidadeInfo?.nome || "")}</p>
        <table>
          <thead><tr><th class="h">Horário</th><th>Etapa e tarefas</th></tr></thead>
          <tbody>
            ${f.blocos.map(b => {
              const horarios = b.horarios || [];
              return `<tr class="periodo"><td colspan="2"><b>${esc(b.titulo || "Período")}</b><span>${esc(periodoDoBloco(b))}</span></td></tr>
                ${horarios.map(horario => {
                  const tarefas = tarefasDoHorario(horario).filter(tarefa => tarefa.trim());
                  return `<tr class="${horario.intervalo ? "pausa" : ""}">
                    <td class="h">${esc(periodoDoHorario(horario))}</td>
                    <td>${horario.intervalo ? "<b>INTERVALO</b>" : (tarefas.length ? `<ul>${tarefas.map(tarefa => `<li>${esc(tarefa)}</li>`).join("")}</ul>` : "")}</td>
                  </tr>`;
                }).join("")}`;
            }).join("")}
          </tbody>
        </table>
        <p class="rodape">Guia de funções · impresso em ${new Date().toLocaleDateString("pt-BR")}</p>
      </section>`).join("");

    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Guia de Funções</title><style>
      *{margin:0;padding:0;box-sizing:border-box}
      body{font-family:Arial,Helvetica,sans-serif;color:#0f172a;-webkit-print-color-adjust:exact;print-color-adjust:exact}
      .pagina{padding:14mm}
      .quebra{page-break-after:always}
      .marca{display:flex;justify-content:center;margin-bottom:10px}
      .faixa{height:6px;border-radius:99px;margin-bottom:10px}
      h1{font-size:30px;text-transform:uppercase;letter-spacing:1px;line-height:1.05}
      .sub{font-size:12px;font-weight:bold;color:#64748b;margin:4px 0 14px}
      table{width:100%;border-collapse:collapse;font-size:14px}
      th,td{padding:9px 10px;border-bottom:1px solid #e2e8f0;text-align:left;vertical-align:top}
      th{font-size:9px;text-transform:uppercase;letter-spacing:1.5px;color:#475569;border-bottom:2px solid #cbd5e1}
      .h{white-space:nowrap;font-weight:bold;width:34%}
      ul{margin:0;padding-left:18px}li{margin:3px 0;line-height:1.35}
      tr.periodo td{background:#e2e8f0;padding:8px 10px;border-bottom:0}
      tr.periodo b{font-size:12px;text-transform:uppercase;letter-spacing:.7px}
      tr.periodo span{float:right;font-size:11px;font-weight:bold;color:#475569}
      tr.pausa td{background:#f1f5f9;font-weight:bold}
      .rodape{margin-top:14px;font-size:10px;color:#94a3b8;font-weight:bold}
      @media print{@page{margin:0}}
    </style></head><body>${paginas}</body></html>`);
    win.document.close();
    setTimeout(() => win.print(), 400);
  };

  const imprimirPlanilha = () => {
    const win = window.open("", "_blank");
    if (!win) return alert("Habilite pop-ups para imprimir.");
    const linhas = funcoesOrdenadas.map(f => `
      <tr class="grupo"><td colspan="3" style="border-left:6px solid ${esc(f.cor)}">
        ${esc(f.funcao || "(sem nome)")}<small>${esc(f.setor || "")}</small>
      </td></tr>
      ${f.blocos.map(b => {
        const horarios = b.horarios || [];
        return `<tr class="periodo"><td colspan="3"><b>${esc(b.titulo || "Período")}</b><span>${esc(periodoDoBloco(b))}</span></td></tr>
          ${horarios.map(horario => {
            const tarefas = tarefasDoHorario(horario).filter(tarefa => tarefa.trim());
            return `<tr class="${horario.intervalo ? "pausa" : ""}">
              <td></td>
              <td class="h">${esc(periodoDoHorario(horario))}</td>
              <td>${horario.intervalo ? "<b>INTERVALO</b>" : (tarefas.length ? `<ul>${tarefas.map(tarefa => `<li>${esc(tarefa)}</li>`).join("")}</ul>` : "")}</td>
            </tr>`;
          }).join("")}`;
      }).join("")}`).join("");

    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Guia de Funções — planilha</title><style>
      *{margin:0;padding:0;box-sizing:border-box}
      body{font-family:Arial,Helvetica,sans-serif;color:#0f172a;padding:12mm;-webkit-print-color-adjust:exact;print-color-adjust:exact}
      .marca{display:flex;justify-content:center;margin-bottom:10px}
      h1{font-size:20px;text-transform:uppercase;letter-spacing:2px;border-bottom:3px solid #0f172a;padding-bottom:6px;margin-bottom:4px}
      .sub{font-size:11px;color:#64748b;font-weight:bold;margin-bottom:12px}
      table{width:100%;border-collapse:collapse;font-size:12px}
      th,td{padding:6px 8px;border-bottom:1px solid #e2e8f0;text-align:left;vertical-align:top}
      th{font-size:9px;text-transform:uppercase;letter-spacing:1px;color:#475569;border-bottom:2px solid #cbd5e1}
      td.h{white-space:nowrap;font-weight:bold;width:22%}
      ul{margin:0;padding-left:16px}li{margin:2px 0;line-height:1.3}
      td:first-child{width:8px;padding:0}
      tr.grupo td{background:#0f172a;color:#fff;font-size:13px;font-weight:900;text-transform:uppercase;letter-spacing:1px;padding:7px 10px}
      tr.grupo small{display:block;font-size:9px;font-weight:bold;letter-spacing:1px;color:#cbd5e1;text-transform:none}
      tr.periodo td{background:#e2e8f0;padding:6px 8px;border-bottom:0}
      tr.periodo b{font-size:10px;text-transform:uppercase;letter-spacing:.6px}
      tr.periodo span{float:right;font-size:10px;font-weight:bold;color:#475569}
      tr.pausa td{background:#f1f5f9;font-weight:bold}
      tr{page-break-inside:avoid}
      .nota{margin-top:12px;border-top:1px solid #e2e8f0;padding-top:8px;font-size:10px;color:#64748b;line-height:1.5}
      @media print{@page{margin:10mm}}
    </style></head><body>
      <div class="marca">${logoSeldeestrelaSVG(38)}</div>
      <h1>Guia de Funções</h1>
      <div class="sub">${esc(unidadeInfo?.nome || "")} · ${new Date().toLocaleDateString("pt-BR")} · ${funcoesOrdenadas.length} função(ões)</div>
      <table>
        <thead><tr><th></th><th>Horário</th><th>Etapa e tarefas</th></tr></thead>
        <tbody>${linhas}</tbody>
      </table>
      <p class="nota">Guia por função, sem nomes: quem cobre o turno de alguém segue a mesma linha. As faixas cinzas são os intervalos.</p>
    </body></html>`);
    win.document.close();
    setTimeout(() => win.print(), 400);
  };

  const funcaoAtivaChecklist = useMemo(() => {
    return funcoesOrdenadas.find(f => f.id === funcaoChecklistId) || funcoesOrdenadas[0];
  }, [funcoesOrdenadas, funcaoChecklistId]);

  const progressoGerencia = useMemo(() => {
    return calcularProgressoSetores(funcoesOrdenadas, concluidos);
  }, [funcoesOrdenadas, concluidos]);

  return (
    <div className="min-h-screen bg-[var(--surface)] pb-16">
      <div className="sticky top-0 z-20 border-b border-slate-200 bg-white px-4 py-4 sm:px-6 shadow-sm">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3">
          <button onClick={() => router.push("/dashboard/rh")} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200"><ArrowLeft size={19} /></button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-black text-slate-900 sm:text-xl">Guia de Funções</h1>
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-black text-emerald-800 border border-emerald-200">Rotina Interativa</span>
            </div>
            <p className="text-xs font-bold text-slate-500">A rotina de cada função, hora a hora — sem nomes, por posição</p>
          </div>

          {/* Navegação por Abas Principais */}
          <div className="flex rounded-xl bg-slate-100 p-1 border border-slate-200 text-xs font-black">
            <button
              onClick={() => setAbaAtiva("guia")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-2 transition-all ${abaAtiva === "guia" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"}`}
            >
              <ListChecks size={15} /> <span>Fichas & Edição</span>
            </button>
            <button
              onClick={() => setAbaAtiva("checklist")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-2 transition-all ${abaAtiva === "checklist" ? "bg-emerald-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-900"}`}
            >
              <CheckSquare size={15} /> <span>Modo Checklist</span>
            </button>
            <button
              onClick={() => setAbaAtiva("painel")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-2 transition-all ${abaAtiva === "painel" ? "bg-slate-900 text-white shadow-sm" : "text-slate-500 hover:text-slate-900"}`}
            >
              <BarChart3 size={15} /> <span>Painel Gerência</span>
            </button>
          </div>

          {abaAtiva === "guia" && (
            <div className="-mx-4 flex w-full items-center gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:w-auto sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
              {editando ? (
                <>
                  <button onClick={salvarAlteracoes} disabled={salvando}
                    className="flex h-10 shrink-0 items-center gap-2 rounded-xl bg-emerald-600 px-4 text-xs font-black text-white hover:bg-emerald-700 disabled:cursor-wait disabled:opacity-60">
                    {salvando ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                    {salvando ? "Salvando..." : "Salvar alterações"}
                  </button>
                  <button onClick={cancelarEdicao} disabled={salvando}
                    className="flex h-10 shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-black text-slate-600 hover:bg-slate-50 disabled:opacity-60">
                    <X size={15} /> Cancelar
                  </button>
                </>
              ) : (
                <button onClick={iniciarEdicao}
                  className="flex h-10 shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-black text-slate-700 hover:bg-slate-50">
                  <Save size={15} /> Editar horários
                </button>
              )}
              <button onClick={adicionarFuncao} title="Cria uma função nova e abre a edição"
                className="flex h-10 shrink-0 items-center gap-2 rounded-xl border-2 border-emerald-200 bg-white px-4 text-xs font-black text-emerald-700 hover:bg-emerald-50">
                <Plus size={15} /> Nova função
              </button>
              {editando && (
                <button onClick={restaurarPadrao} className="flex h-10 shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-black text-slate-600 hover:bg-slate-50">
                  <RotateCcw size={15} /> Voltar ao padrão
                </button>
              )}
              <button onClick={imprimirPlanilha} title="Todas as funções numa tabela só, para a mesa da gerência"
                className="flex h-10 shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-black text-slate-700 hover:bg-slate-50">
                <Table size={15} /> Planilha
              </button>
              <button onClick={imprimir} title="Uma função por página, para a parede do setor"
                className="flex h-10 shrink-0 items-center gap-2 rounded-xl bg-slate-900 px-4 text-xs font-black text-white hover:bg-slate-800">
                <Printer size={15} /> <span className="sm:hidden">Cartaz</span><span className="hidden sm:inline">Cartaz por função</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {salvo && (
        <div className="mx-auto mt-3 max-w-5xl px-4 sm:px-6">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-800 flex items-center justify-between animate-in fade-in">
            <span>{salvo}</span>
            <CheckCircle2 size={16} />
          </div>
        </div>
      )}

      <div className="mx-auto mt-6 max-w-5xl px-4 sm:px-6">
        {carregando ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <Loader2 size={32} className="animate-spin mb-3 text-emerald-600" />
            <p className="text-sm font-bold">Carregando o guia de funções...</p>
          </div>
        ) : semTabela ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center text-amber-900">
            <h2 className="text-lg font-black mb-2">Tabela de guias operacionais não encontrada</h2>
            <p className="text-xs font-medium">Execute a migração `db/migracao_guias_operacionais.sql` no Supabase para ativar a funcionalidade na loja.</p>
          </div>
        ) : abaAtiva === "checklist" ? (
          /* 📱 ABA 2: MODO CHECKLIST DINÂMICO DO TURNO (EXECUÇÃO) */
          <div className="space-y-6">
            {/* Seletor de Função e Relógio em Tempo Real */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
              <div className="flex-1 w-full">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1.5">Selecione a sua função no turno</label>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {funcoesOrdenadas.map(f => (
                    <button
                      key={f.id}
                      onClick={() => setFuncaoChecklistId(f.id)}
                      className={`px-4 py-2.5 rounded-2xl text-xs font-black whitespace-nowrap transition-all border ${funcaoChecklistId === f.id ? "bg-slate-900 text-white border-slate-900 shadow-md" : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"}`}
                    >
                      <span className="inline-block w-2.5 h-2.5 rounded-full mr-2" style={{ background: f.cor }}></span>
                      {f.funcao}
                    </button>
                  ))}
                </div>
              </div>
              <div className="bg-slate-900 text-white px-5 py-3 rounded-2xl flex items-center gap-3 shrink-0 self-end sm:self-center">
                <Clock size={20} className="text-emerald-400 animate-pulse" />
                <div>
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Horário Atual</span>
                  <span className="text-xl font-black tabular-nums">{horaAtual}</span>
                </div>
              </div>
            </div>

            {funcaoAtivaChecklist && (
              <div className="space-y-4">
                {/* Progresso da Função */}
                {(() => {
                  const prog = calcularProgressoFuncao(funcaoAtivaChecklist, concluidos);
                  return (
                    <div className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-white" style={{ background: funcaoAtivaChecklist.cor }}>
                          {prog.pct}%
                        </div>
                        <div>
                          <h3 className="font-black text-slate-900 text-base">{funcaoAtivaChecklist.funcao}</h3>
                          <p className="text-xs font-bold text-slate-400">{prog.concluidos} de {prog.total} tarefas concluídas no turno de hoje</p>
                        </div>
                      </div>
                      <div className="w-full sm:w-48 bg-slate-100 h-3 rounded-full overflow-hidden border border-slate-200">
                        <div className="bg-emerald-600 h-full transition-all duration-500" style={{ width: `${prog.pct}%` }}></div>
                      </div>
                    </div>
                  );
                })()}

                {/* Blocos de Horário e Tarefas */}
                {funcaoAtivaChecklist.blocos.map((bloco, idxBloco) => (
                  <div key={idxBloco} className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
                    <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full" style={{ background: funcaoAtivaChecklist.cor }}></span>
                        <h4 className="font-black text-sm uppercase tracking-wide">{bloco.titulo || "Período"}</h4>
                      </div>
                      <span className="text-xs font-bold text-slate-300 bg-slate-800 px-3 py-1 rounded-full">{periodoDoBloco(bloco)}</span>
                    </div>

                    <div className="p-4 space-y-4">
                      {(bloco.horarios || []).map((horario, idxHorario) => {
                        const status = obterStatusHorario(horario, horaAtual);
                        const restaMin = horario.fim ? calcularMinutosRestantes(horario.fim, horaAtual) : null;
                        const alertaRestando = status === "ativo" && restaMin !== null && restaMin >= 0 && restaMin <= 15;
                        const tarefas = tarefasDoHorario(horario).filter(t => t.trim());

                        return (
                          <div
                            key={idxHorario}
                            className={`rounded-2xl border p-4 transition-all ${
                              horario.intervalo
                                ? "bg-amber-50/70 border-amber-200"
                                : status === "ativo"
                                ? "bg-emerald-50/50 border-emerald-300 ring-2 ring-emerald-500/20 shadow-md"
                                : status === "passado"
                                ? "bg-slate-50 border-slate-200 opacity-80"
                                : "bg-white border-slate-200"
                            }`}
                          >
                            {/* Alerta de Tempo Restante */}
                            {alertaRestando && (
                              <div className="mb-3 p-2.5 rounded-xl bg-amber-500 text-white font-black text-xs flex items-center gap-2 animate-bounce shadow-md">
                                <AlertTriangle size={16} />
                                <span>Atenção: Faltam apenas {restaMin} minutos para encerrar esta etapa ({horario.fim})!</span>
                              </div>
                            )}

                            <div className="flex items-center justify-between mb-3 border-b border-slate-200/60 pb-2">
                              <div className="flex items-center gap-2">
                                <span className={`text-xs font-black px-2.5 py-1 rounded-lg ${status === "ativo" ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-700"}`}>
                                  {periodoDoHorario(horario)}
                                </span>
                                {status === "ativo" && (
                                  <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md flex items-center gap-1">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span> Horário Atual
                                  </span>
                                )}
                              </div>
                              {horario.intervalo && (
                                <span className="text-xs font-black text-amber-700 bg-amber-200/60 px-3 py-0.5 rounded-full flex items-center gap-1">
                                  <Coffee size={13} /> Pausa para Intervalo
                                </span>
                              )}
                            </div>

                            {/* Lista de Tarefas Interativas */}
                            {horario.intervalo ? (
                              <p className="text-xs font-bold text-amber-800">Horário reservado para descanso/intervalo da função.</p>
                            ) : (
                              <div className="space-y-2">
                                {tarefas.map((tarefa, idxTarefa) => {
                                  const chave = `${funcaoAtivaChecklist.id}_${bloco.titulo}_${horario.hora}_${idxTarefa}`;
                                  const estaConcluido = !!concluidos[chave];

                                  return (
                                    <label
                                      key={idxTarefa}
                                      onClick={() => alternarTarefaConcluida(chave)}
                                      className={`flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer select-none ${
                                        estaConcluido
                                          ? "bg-emerald-100/60 border-emerald-300 text-emerald-900"
                                          : "bg-white border-slate-200 hover:border-slate-300 text-slate-800"
                                      }`}
                                    >
                                      <div className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 mt-0.5 transition-colors border ${
                                        estaConcluido ? "bg-emerald-600 border-emerald-600 text-white" : "border-slate-300 bg-white"
                                      }`}>
                                        {estaConcluido && <Check size={14} strokeWidth={3} />}
                                      </div>
                                      <span className={`text-xs font-bold leading-relaxed flex-1 ${estaConcluido ? "line-through opacity-75" : ""}`}>
                                        {tarefa}
                                      </span>
                                    </label>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : abaAtiva === "painel" ? (
          /* 📊 ABA 3: PAINEL DE ACOMPANHAMENTO DA GERÊNCIA */
          <div className="space-y-6">
            <div className="bg-slate-900 text-white p-6 rounded-3xl shadow-lg border border-slate-800">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-black">Painel da Gerência — Rotina do Dia</h2>
                  <p className="text-xs text-slate-400 font-bold mt-1">Acompanhamento em tempo real do cumprimento do Guia de Funções por Setor</p>
                </div>
                <div className="bg-slate-800 px-4 py-2 rounded-2xl text-right border border-slate-700">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Data</span>
                  <span className="text-sm font-black">{new Date().toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" })}</span>
                </div>
              </div>
            </div>

            {/* Grid de Progresso por Setor */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {Object.keys(progressoGerencia).map(setorKey => {
                const s = progressoGerencia[setorKey];
                return (
                  <div key={setorKey} className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-black uppercase tracking-wider text-slate-400">{setorKey}</span>
                      <span className="text-lg font-black text-slate-900">{s.pct}%</span>
                    </div>
                    <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden border border-slate-200">
                      <div
                        className={`h-full transition-all duration-500 ${s.pct >= 80 ? "bg-emerald-600" : s.pct >= 40 ? "bg-amber-500" : "bg-rose-500"}`}
                        style={{ width: `${s.pct}%` }}
                      ></div>
                    </div>
                    <p className="text-xs font-bold text-slate-500">
                      {s.concluidos} de {s.total} tarefas executadas ({s.funcoesCount} função/funções)
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Status por Função Individual */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
              <h3 className="font-black text-slate-900 text-base">Detalhamento por Função no Turno de Hoje</h3>
              <div className="divide-y divide-slate-100">
                {funcoesOrdenadas.map(f => {
                  const p = calcularProgressoFuncao(f, concluidos);
                  return (
                    <div key={f.id} className="py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full shrink-0" style={{ background: f.cor }}></div>
                        <div>
                          <p className="font-black text-slate-900 text-sm">{f.funcao}</p>
                          <p className="text-xs font-bold text-slate-400">{f.setor || "Sem setor"}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 w-full sm:w-auto justify-between">
                        <div className="text-right">
                          <span className="text-xs font-black text-slate-800">{p.concluidos} / {p.total} tarefas</span>
                          <span className="text-[11px] font-bold text-slate-400 block">{p.pct}% concluído</span>
                        </div>
                        <div className="w-24 bg-slate-100 h-2.5 rounded-full overflow-hidden border border-slate-200">
                          <div className="bg-emerald-600 h-full" style={{ width: `${p.pct}%` }}></div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          /* 📋 ABA 1: GUIA DE FUNÇÕES (LISTAGEM / EDIÇÃO / IMPRESSÃO) */
          <div className="space-y-6">
            {funcoesExibidas.map((funcao) => (
              <article key={funcao.id} data-funcao-id={funcao.id} className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition-all hover:border-slate-300">
                <header className="flex flex-col gap-3 border-b border-slate-200 bg-slate-900 p-4 text-white sm:flex-row sm:items-center sm:justify-between sm:p-5">
                  {editando ? (
                    <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
                      <input type="color" value={funcao.cor || "#475569"} onChange={e => alterarFuncao(funcao.id, "cor", e.target.value)} title="Cor da faixa no cartaz impresso" className="h-10 w-12 cursor-pointer rounded-lg border border-slate-700 bg-slate-800 p-1" />
                      <input value={funcao.funcao || ""} onChange={e => alterarFuncao(funcao.id, "funcao", e.target.value)} placeholder="Nome da função" className="h-10 font-black text-white bg-slate-800 border border-slate-700 px-3 rounded-xl" />
                      <input value={funcao.setor || ""} onChange={e => alterarFuncao(funcao.id, "setor", e.target.value)} placeholder="Área / Setor" className="h-10 font-bold text-white bg-slate-800 border border-slate-700 px-3 rounded-xl" />
                      <div className="flex gap-2">
                        <button onClick={() => clonarFuncao(funcao.id)} title="Duplicar esta função" className="h-10 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-black text-xs rounded-xl flex items-center gap-1.5 border border-slate-700">
                          <Copy size={14} /> Clonar
                        </button>
                        <button onClick={() => removerFuncao(funcao.id)} className="h-10 px-3 bg-red-500/20 text-red-300 hover:bg-red-500/30 font-black text-xs rounded-xl flex items-center gap-1.5 border border-red-500/30">
                          <Trash2 size={14} /> Excluir
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-3">
                        <div className="w-4 h-10 rounded-full" style={{ background: funcao.cor }}></div>
                        <div>
                          <h2 className="text-lg font-black uppercase text-white">{funcao.funcao}</h2>
                          <p className="text-xs font-bold text-slate-400">{funcao.setor}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => clonarFuncao(funcao.id)} title="Duplicar função" className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-black text-slate-200 rounded-xl flex items-center gap-1.5 border border-slate-700">
                          <Copy size={13} /> Clonar
                        </button>
                      </div>
                    </>
                  )}
                </header>

                <div className="space-y-4 p-4">
                  {funcao.blocos.map((bloco, indice) => (
                    <div key={indice} className="rounded-2xl border border-slate-200 overflow-hidden bg-slate-50/50">
                      {editando ? (
                        <div className="p-4 space-y-3">
                          <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                            <input value={bloco.titulo || ""} onChange={e => alterarBloco(funcao.id, indice, "titulo", e.target.value)} placeholder="Período Maior (Ex: Abertura do Salão 1)" className="h-10 flex-1 bg-white border border-slate-200 px-3 font-black text-sm rounded-xl" />
                            <div className="flex items-center gap-1.5">
                              <input type="time" value={bloco.hora || ""} onChange={e => alterarBloco(funcao.id, indice, "hora", e.target.value)} className="h-10 bg-white border border-slate-200 px-2 font-bold text-sm rounded-xl" />
                              <span className="text-xs font-bold text-slate-400">até</span>
                              <input type="time" value={bloco.fim || ""} onChange={e => alterarBloco(funcao.id, indice, "fim", e.target.value)} className="h-10 bg-white border border-slate-200 px-2 font-bold text-sm rounded-xl" />
                            </div>
                            <button onClick={() => removerBloco(funcao.id, indice)} className="h-10 px-3 bg-red-50 text-red-600 font-black text-xs rounded-xl flex items-center gap-1 border border-red-200">
                              <Trash2 size={14} /> Excluir Período
                            </button>
                          </div>

                          <div className="space-y-3 pt-2">
                            {(bloco.horarios || []).map((horario, idxHorario) => (
                              <div key={idxHorario} className="bg-white p-3 rounded-xl border border-slate-200 space-y-2">
                                <div className="flex flex-col sm:flex-row gap-2 sm:items-center justify-between">
                                  <div className="flex items-center gap-1.5">
                                    <input type="time" value={horario.hora || ""} onChange={e => alterarHorario(funcao.id, indice, idxHorario, "hora", e.target.value)} className="h-9 bg-slate-50 border border-slate-200 px-2 font-bold text-xs rounded-lg" />
                                    <span className="text-xs font-bold text-slate-400">até</span>
                                    <input type="time" value={horario.fim || ""} onChange={e => alterarHorario(funcao.id, indice, idxHorario, "fim", e.target.value)} className="h-9 bg-slate-50 border border-slate-200 px-2 font-bold text-xs rounded-lg" />
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <button onClick={() => alterarHorario(funcao.id, indice, idxHorario, "intervalo", !horario.intervalo)} className={`h-9 px-3 text-xs font-black rounded-lg border ${horario.intervalo ? "bg-amber-100 text-amber-800 border-amber-300" : "bg-slate-50 text-slate-600 border-slate-200"}`}>
                                      <Coffee size={14} className="inline mr-1" /> {horario.intervalo ? "Intervalo" : "É intervalo?"}
                                    </button>
                                    <button onClick={() => removerHorario(funcao.id, indice, idxHorario)} className="h-9 w-9 bg-red-50 text-red-600 rounded-lg flex items-center justify-center border border-red-200">
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                </div>

                                {!horario.intervalo && (
                                  <div className="space-y-1.5 pt-1">
                                    {tarefasDoHorario(horario).map((t, idxT) => (
                                      <div key={idxT} className="flex items-center gap-2">
                                        <input value={t} onChange={e => alterarTarefa(funcao.id, indice, idxHorario, idxT, e.target.value)} placeholder="Descrição da tarefa" className="h-9 flex-1 bg-slate-50 border border-slate-200 px-3 text-xs font-bold rounded-lg" />
                                        <button onClick={() => removerTarefa(funcao.id, indice, idxHorario, idxT)} className="h-9 w-9 text-slate-400 hover:text-red-600 flex items-center justify-center">
                                          <Trash2 size={14} />
                                        </button>
                                      </div>
                                    ))}
                                    <button onClick={() => adicionarTarefa(funcao.id, indice, idxHorario)} className="text-xs font-black text-emerald-700 hover:underline flex items-center gap-1 pt-1">
                                      <Plus size={13} /> Adicionar tarefa neste horário
                                    </button>
                                  </div>
                                )}
                              </div>
                            ))}
                            <button onClick={() => adicionarHorario(funcao.id, indice)} className="text-xs font-black text-slate-700 hover:underline flex items-center gap-1 pt-1">
                              <Plus size={13} /> Adicionar horário menor dentro deste período
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div className="bg-slate-900 text-white p-3 flex justify-between items-center">
                            <span className="font-black text-xs uppercase">{bloco.titulo || "Período"}</span>
                            <span className="text-xs font-bold text-slate-300">{periodoDoBloco(bloco)}</span>
                          </div>
                          <div className="p-3 space-y-3">
                            {(bloco.horarios || []).map((h, idxH) => (
                              <div key={idxH} className="bg-white p-3 rounded-xl border border-slate-200">
                                <span className="text-xs font-black bg-slate-100 text-slate-800 px-2 py-1 rounded-md inline-block mb-2">{periodoDoHorario(h)}</span>
                                {h.intervalo ? (
                                  <p className="text-xs font-bold text-amber-700">INTERVALO / PAUSA</p>
                                ) : (
                                  <ul className="list-disc list-inside space-y-1 text-xs font-bold text-slate-700">
                                    {tarefasDoHorario(h).map((t, idxT) => (
                                      <li key={idxT}>{t}</li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}

                  {editando && (
                    <button onClick={() => adicionarBloco(funcao.id)} className="w-full py-3 bg-white border-2 border-dashed border-slate-300 text-slate-600 hover:border-emerald-500 hover:text-emerald-700 font-black text-xs rounded-2xl flex items-center justify-center gap-1.5 transition-all">
                      <Plus size={15} /> Adicionar Período Maior (Ex: Abertura, Serviço, Fechamento)
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
