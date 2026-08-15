"use client";

// CONSTRUTOR DE PROCESSOS
// Monta o modelo que a equipe vai executar: seções, itens (com o tipo de
// resposta, o padrão esperado e o que fazer quando reprova) e os horários em
// que a rotina aparece sozinha na Central Operacional.
//
// Editar um processo que já rodou sobe a versão: o histórico continua
// apontando para a versão que foi executada.

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, Camera, ChevronDown, ChevronUp, Clock, Copy, Loader2, Plus,
  Save, Settings2, Trash2, TriangleAlert,
} from "lucide-react";
import { useERP } from "../../../../../context/ERPContext";
import { lerSessao } from "../../../../../lib/auth";
import { fetchColaboradores } from "../../../../../lib/rh";
import { equipeDaArea } from "../../../../../lib/equipe-area.mjs";
import {
  fetchProcessoCompleto, salvarProcesso, salvarEstrutura, processoTemExecucao,
  fetchAgendasDoProcesso, salvarAgenda, excluirAgenda, registrarAuditoria,
} from "../../../../../lib/operacao-inteligente";
import {
  TIPOS_ITEM, tipoInfo, ehNumerico, ehEscolha, valoresPossiveis,
  FREQUENCIAS, DIAS_SEMANA_OP, SETORES, CRITICIDADES, descreverAgenda,
} from "../../../../../lib/operacao-tipos.mjs";
import { MODELOS_PROCESSO, modeloParaProcesso } from "../../../../../lib/operacao-modelos.mjs";

let contador = 0;
const novaChave = () => `k${Date.now().toString(36)}${(contador += 1)}`;

const ITEM_VAZIO = () => ({
  chave: novaChave(), titulo: "", instrucao: "", tipo: "FEITO_NAO_FEITO",
  obrigatorio: true, permite_na: false, peso: 1, critico: false,
  exige_foto: false, exige_comentario: false, exige_gps: false,
  valor_min: "", valor_max: "", unidade_medida: "", opcoes: [],
  resposta_esperada: "", depende_chave: "", depende_valor: "",
  acao_reprovar: "nao_conformidade", criterios_ia: "",
});

const AGENDA_VAZIA = () => ({
  chave: novaChave(), frequencia: "diaria", dias_semana: [], dia_mes: 1, datas: [],
  hora_inicio: "08:00", minutos_tolerancia: 15, minutos_prazo: 120,
  turno: "", responsavel_id: "", funcao_responsavel: "", ativo: true,
});

const rotulo = "text-[11px] font-black uppercase tracking-widest text-slate-500";
const campo = "mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-[15px] font-semibold text-slate-800 outline-none focus:border-emerald-600";

export default function ConstrutorProcesso() {
  const { id } = useParams();
  const router = useRouter();
  const { unidadeAtiva } = useERP();
  const novo = id === "novo";

  const [processo, setProcesso] = useState({
    nome: "", descricao: "", categoria: "", setor: "cozinha", criticidade: "normal",
    exige_todos_obrigatorios: true, permite_concluir_com_nc: true, ativo: true, arquivado: false,
  });
  const [secoes, setSecoes] = useState([{ chave: novaChave(), titulo: "Checklist", descricao: "", itens: [ITEM_VAZIO()] }]);
  const [agendas, setAgendas] = useState([]);
  const [agendasRemovidas, setAgendasRemovidas] = useState([]);
  const [jaExecutou, setJaExecutou] = useState(false);
  const [colaboradores, setColaboradores] = useState([]);
  const [sessao, setSessao] = useState(null);
  const [carregando, setCarregando] = useState(!novo);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [aberto, setAberto] = useState("");   // chave do item expandido

  useEffect(() => { lerSessao().then(setSessao).catch(() => {}); }, []);

  useEffect(() => {
    if (!unidadeAtiva || unidadeAtiva === "todas") return;
    fetchColaboradores(unidadeAtiva).then(r => setColaboradores(r.data || []));
  }, [unidadeAtiva]);

  // Carrega o processo existente — ou o modelo pronto pedido na URL.
  useEffect(() => {
    if (novo) {
      const modeloId = new URLSearchParams(window.location.search).get("modelo");
      const modelo = MODELOS_PROCESSO.find(m => m.id === modeloId);
      if (modelo && unidadeAtiva) {
        const pronto = modeloParaProcesso(modelo, unidadeAtiva);
        setProcesso(p => ({ ...p, ...pronto.processo }));
        setSecoes(pronto.secoes.map(s => ({
          chave: novaChave(), titulo: s.titulo, descricao: s.descricao,
          itens: s.itens.map(i => ({ ...ITEM_VAZIO(), ...i, chave: novaChave() })),
        })));
        if (pronto.agenda) setAgendas([{ ...AGENDA_VAZIA(), ...pronto.agenda }]);
      }
      return;
    }
    let ativo = true;
    (async () => {
      const [{ data }, { data: ags }, rodou] = await Promise.all([
        fetchProcessoCompleto(id), fetchAgendasDoProcesso(id), processoTemExecucao(id),
      ]);
      if (!ativo || !data) { setCarregando(false); return; }
      const { secoes: secoesBanco, ...campos } = data;
      setProcesso(campos);
      setJaExecutou(rodou);
      setSecoes((secoesBanco || []).map(s => ({
        chave: s.id, titulo: s.titulo, descricao: s.descricao || "",
        itens: (s.itens || []).map(i => ({
          ...ITEM_VAZIO(), ...i,
          chave: i.id,
          depende_chave: i.depende_item_id || "",
          valor_min: i.valor_min ?? "", valor_max: i.valor_max ?? "",
          unidade_medida: i.unidade_medida || "", resposta_esperada: i.resposta_esperada || "",
          instrucao: i.instrucao || "", criterios_ia: i.criterios_ia || "",
          opcoes: Array.isArray(i.opcoes) ? i.opcoes : [],
        })),
      })));
      setAgendas((ags || []).map(a => ({
        ...AGENDA_VAZIA(), ...a, chave: a.id,
        hora_inicio: String(a.hora_inicio || "08:00").slice(0, 5),
        responsavel_id: a.responsavel_id || "", funcao_responsavel: a.funcao_responsavel || "",
        turno: a.turno || "", datas: (a.datas || []).map(d => String(d).slice(0, 10)),
      })));
      setCarregando(false);
    })();
    return () => { ativo = false; };
  }, [id, novo, unidadeAtiva]);

  const equipe = useMemo(
    () => equipeDaArea(colaboradores, processo.setor || ""),
    [colaboradores, processo.setor],
  );

  // ── Seções ────────────────────────────────────────────────────────────────
  const mudarSecao = (iS, campo2, valor) =>
    setSecoes(ss => ss.map((s, i) => i === iS ? { ...s, [campo2]: valor } : s));
  const addSecao = () =>
    setSecoes(ss => [...ss, { chave: novaChave(), titulo: `Seção ${ss.length + 1}`, descricao: "", itens: [ITEM_VAZIO()] }]);
  const removerSecao = (iS) => setSecoes(ss => ss.filter((_, i) => i !== iS));
  const moverSecao = (iS, dir) => setSecoes(ss => {
    const alvo = iS + dir;
    if (alvo < 0 || alvo >= ss.length) return ss;
    const copia = [...ss];
    [copia[iS], copia[alvo]] = [copia[alvo], copia[iS]];
    return copia;
  });

  // ── Itens ─────────────────────────────────────────────────────────────────
  const mudarItem = useCallback((iS, iI, campos) =>
    setSecoes(ss => ss.map((s, i) => i !== iS ? s : {
      ...s, itens: s.itens.map((it, j) => j === iI ? { ...it, ...campos } : it),
    })), []);

  const addItem = (iS) => {
    const item = ITEM_VAZIO();
    setSecoes(ss => ss.map((s, i) => i === iS ? { ...s, itens: [...s.itens, item] } : s));
    setAberto(item.chave);
  };
  const duplicarItem = (iS, iI) => setSecoes(ss => ss.map((s, i) => {
    if (i !== iS) return s;
    const copia = { ...s.itens[iI], chave: novaChave(), titulo: `${s.itens[iI].titulo} (cópia)` };
    const itens = [...s.itens];
    itens.splice(iI + 1, 0, copia);
    return { ...s, itens };
  }));
  const removerItem = (iS, iI) =>
    setSecoes(ss => ss.map((s, i) => i === iS ? { ...s, itens: s.itens.filter((_, j) => j !== iI) } : s));
  const moverItem = (iS, iI, dir) => setSecoes(ss => ss.map((s, i) => {
    if (i !== iS) return s;
    const alvo = iI + dir;
    if (alvo < 0 || alvo >= s.itens.length) return s;
    const itens = [...s.itens];
    [itens[iI], itens[alvo]] = [itens[alvo], itens[iI]];
    return { ...s, itens };
  }));

  // Itens que podem servir de condição: os que vêm antes e têm resposta fechada.
  const candidatosCondicao = (iS, iI) => {
    const saida = [];
    secoes.forEach((s, i) => s.itens.forEach((it, j) => {
      if (i > iS || (i === iS && j >= iI)) return;
      if (valoresPossiveis(it).length) saida.push(it);
    }));
    return saida;
  };

  // ── Agendas ───────────────────────────────────────────────────────────────
  const mudarAgenda = (iA, campos) => setAgendas(as => as.map((a, i) => i === iA ? { ...a, ...campos } : a));
  const addAgenda = () => setAgendas(as => [...as, AGENDA_VAZIA()]);
  const removerAgenda = (iA) => {
    const alvo = agendas[iA];
    if (alvo?.id) setAgendasRemovidas(r => [...r, alvo.id]);
    setAgendas(as => as.filter((_, i) => i !== iA));
  };
  const alternarDia = (iA, dia) => setAgendas(as => as.map((a, i) => {
    if (i !== iA) return a;
    const atual = a.dias_semana || [];
    return { ...a, dias_semana: atual.includes(dia) ? atual.filter(d => d !== dia) : [...atual, dia].sort() };
  }));

  // ── Salvar ────────────────────────────────────────────────────────────────
  const validar = () => {
    if (!unidadeAtiva || unidadeAtiva === "todas") return "Selecione uma unidade específica.";
    if (!processo.nome.trim()) return "Dê um nome ao processo.";
    if (!secoes.length) return "Crie pelo menos uma seção.";
    for (const s of secoes) {
      if (!s.titulo.trim()) return "Toda seção precisa de um título.";
      if (!s.itens.length) return `A seção "${s.titulo}" está sem itens.`;
      for (const i of s.itens) {
        if (!i.titulo.trim()) return `Há item sem título na seção "${s.titulo}".`;
        if (ehEscolha(i.tipo) && (i.opcoes || []).filter(o => String(o).trim()).length < 2)
          return `O item "${i.titulo}" precisa de pelo menos duas opções.`;
        if (ehNumerico(i.tipo) && i.valor_min !== "" && i.valor_max !== "" && Number(i.valor_min) > Number(i.valor_max))
          return `No item "${i.titulo}" o mínimo está maior que o máximo.`;
      }
    }
    for (const a of agendas) {
      if (!a.hora_inicio) return "Informe o horário de cada agendamento.";
      if (["dias_semana"].includes(a.frequencia) && !(a.dias_semana || []).length)
        return "Marque os dias da semana do agendamento.";
      if (a.frequencia === "datas" && !(a.datas || []).length)
        return "Adicione as datas do agendamento.";
    }
    return "";
  };

  const salvar = async () => {
    const falta = validar();
    if (falta) { setErro(falta); window.scrollTo({ top: 0, behavior: "smooth" }); return; }
    setErro(""); setSalvando(true);

    const { id: processoId, error } = await salvarProcesso({
      ...(novo ? {} : { id }),
      unidade_id: String(unidadeAtiva),
      nome: processo.nome.trim(),
      descricao: processo.descricao || null,
      categoria: processo.categoria || null,
      setor: processo.setor || null,
      criticidade: processo.criticidade || "normal",
      exige_todos_obrigatorios: processo.exige_todos_obrigatorios !== false,
      permite_concluir_com_nc: processo.permite_concluir_com_nc !== false,
      // Editar um processo arquivado não o traz de volta sozinho.
      ativo: novo ? true : processo.ativo !== false,
      arquivado: novo ? false : !!processo.arquivado,
      ...(novo ? { criado_por: sessao?.nome || null, versao: 1 } : {}),
    });
    if (error || !processoId) { setSalvando(false); setErro(error || "Não consegui salvar."); return; }

    const limpas = secoes.map(s => ({
      titulo: s.titulo.trim(), descricao: s.descricao || null,
      itens: s.itens.map(i => ({
        ...i,
        titulo: i.titulo.trim(),
        opcoes: (i.opcoes || []).map(o => String(o).trim()).filter(Boolean),
        depende_chave: i.depende_chave || null,
        depende_valor: i.depende_chave ? (i.depende_valor || null) : null,
      })),
    }));
    const e2 = await salvarEstrutura(processoId, limpas, { subirVersao: jaExecutou });
    if (e2.error) { setSalvando(false); setErro(e2.error); return; }

    for (const removida of agendasRemovidas) await excluirAgenda(removida);
    for (const a of agendas) {
      await salvarAgenda({
        ...(a.id ? { id: a.id } : {}),
        processo_id: processoId,
        unidade_id: String(unidadeAtiva),
        frequencia: a.frequencia,
        dias_semana: ["dias_semana", "semanal", "quinzenal"].includes(a.frequencia) ? (a.dias_semana || []) : [],
        dia_mes: a.frequencia === "mensal" ? Number(a.dia_mes) || 1 : null,
        datas: a.frequencia === "datas" ? (a.datas || []) : [],
        hora_inicio: a.hora_inicio,
        minutos_tolerancia: Number(a.minutos_tolerancia) || 0,
        minutos_prazo: Number(a.minutos_prazo) || 120,
        turno: a.turno || null,
        responsavel_id: a.responsavel_id || null,
        funcao_responsavel: a.funcao_responsavel || null,
        ativo: a.ativo !== false,
      });
    }

    await registrarAuditoria({
      unidadeId: unidadeAtiva, entidade: "processo", entidadeId: processoId,
      acao: novo ? "criou" : (jaExecutou ? "editou (nova versão)" : "editou"),
      usuario: sessao?.nome,
    });
    setSalvando(false);
    router.push("/dashboard/operacao/inteligente/processos");
  };

  if (carregando) return <div className="grid min-h-[60vh] place-items-center"><Loader2 className="animate-spin text-emerald-600" size={30} /></div>;

  const totalItens = secoes.reduce((s, x) => s + x.itens.length, 0);

  return (
    <div className="min-h-screen bg-slate-50 pb-32">
      <div className="sticky top-0 z-20 border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-3">
          <button onClick={() => router.push("/dashboard/operacao/inteligente/processos")} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200"><ArrowLeft size={19} /></button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-black text-slate-900 sm:text-xl">{novo ? "Novo processo" : processo.nome || "Processo"}</h1>
            <p className="text-xs font-bold text-slate-500">{secoes.length} seções · {totalItens} itens · {agendas.length} agendamento(s)</p>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-4xl space-y-5 p-4 sm:p-6">
        {erro && <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{erro}</p>}
        {jaExecutou && (
          <p className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">
            <TriangleAlert size={17} className="mt-0.5 shrink-0" />
            Este processo já foi executado. Salvar cria a versão {(Number(processo.versao) || 1) + 1} — as execuções antigas continuam como estão.
          </p>
        )}

        {/* Identificação */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <p className="mb-4 text-xs font-black uppercase tracking-widest text-emerald-700">O processo</p>
          <label className="block">
            <span className={rotulo}>Nome *</span>
            <input value={processo.nome} onChange={e => setProcesso(p => ({ ...p, nome: e.target.value }))}
              placeholder="Ex.: Abertura da cozinha" className={campo} />
          </label>
          <label className="mt-3 block">
            <span className={rotulo}>Para que serve</span>
            <textarea rows={2} value={processo.descricao || ""} onChange={e => setProcesso(p => ({ ...p, descricao: e.target.value }))} className={campo} />
          </label>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <label className="block">
              <span className={rotulo}>Área</span>
              <select value={processo.setor || ""} onChange={e => setProcesso(p => ({ ...p, setor: e.target.value }))} className={campo}>
                <option value="">Toda a operação</option>
                {SETORES.map(s => <option key={s} value={s} className="capitalize">{s}</option>)}
              </select>
            </label>
            <label className="block">
              <span className={rotulo}>Categoria</span>
              <input value={processo.categoria || ""} onChange={e => setProcesso(p => ({ ...p, categoria: e.target.value }))} placeholder="Higiene, Abertura..." className={campo} />
            </label>
            <label className="block">
              <span className={rotulo}>Criticidade</span>
              <select value={processo.criticidade} onChange={e => setProcesso(p => ({ ...p, criticidade: e.target.value }))} className={campo}>
                {CRITICIDADES.map(c => <option key={c.valor} value={c.valor}>{c.rotulo}</option>)}
              </select>
            </label>
          </div>
          <div className="mt-4 space-y-2.5">
            <label className="flex items-center gap-2.5">
              <input type="checkbox" checked={processo.exige_todos_obrigatorios !== false}
                onChange={e => setProcesso(p => ({ ...p, exige_todos_obrigatorios: e.target.checked }))} className="h-5 w-5 accent-emerald-600" />
              <span className="text-sm font-bold text-slate-700">Só deixa concluir com todos os itens obrigatórios respondidos</span>
            </label>
            <label className="flex items-center gap-2.5">
              <input type="checkbox" checked={processo.permite_concluir_com_nc !== false}
                onChange={e => setProcesso(p => ({ ...p, permite_concluir_com_nc: e.target.checked }))} className="h-5 w-5 accent-emerald-600" />
              <span className="text-sm font-bold text-slate-700">Permite concluir mesmo com item crítico reprovado</span>
            </label>
          </div>
        </section>

        {/* Seções e itens */}
        {secoes.map((secao, iS) => (
          <section key={secao.chave} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <span className={rotulo}>Seção {iS + 1}</span>
                <input value={secao.titulo} onChange={e => mudarSecao(iS, "titulo", e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-[16px] font-black text-slate-900 outline-none focus:border-emerald-600" />
                <input value={secao.descricao || ""} onChange={e => mudarSecao(iS, "descricao", e.target.value)}
                  placeholder="Explicação da seção (opcional)"
                  className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 outline-none focus:border-emerald-600" />
              </div>
              <div className="flex shrink-0 flex-col gap-1">
                <button onClick={() => moverSecao(iS, -1)} disabled={iS === 0} className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-30"><ChevronUp size={16} /></button>
                <button onClick={() => moverSecao(iS, 1)} disabled={iS === secoes.length - 1} className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-30"><ChevronDown size={16} /></button>
                <button onClick={() => removerSecao(iS)} disabled={secoes.length === 1} className="grid h-9 w-9 place-items-center rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 disabled:opacity-30"><Trash2 size={16} /></button>
              </div>
            </div>

            <div className="mt-4 space-y-2.5">
              {secao.itens.map((item, iI) => {
                const info = tipoInfo(item.tipo);
                const expandido = aberto === item.chave;
                return (
                  <div key={item.chave} className={`rounded-2xl border ${expandido ? "border-emerald-300 bg-emerald-50/40" : "border-slate-200"}`}>
                    <div className="flex items-start gap-2 p-3">
                      <button onClick={() => setAberto(expandido ? "" : item.chave)} className="min-w-0 flex-1 text-left">
                        <p className="text-[15px] font-black text-slate-900">{item.titulo || <span className="text-slate-400">Item sem título</span>}</p>
                        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] font-bold text-slate-500">
                          <span className="rounded bg-slate-100 px-1.5 py-0.5">{info.rotulo}</span>
                          {ehNumerico(item.tipo) && (item.valor_min !== "" || item.valor_max !== "") && (
                            <span>{item.valor_min !== "" ? item.valor_min : "—"} a {item.valor_max !== "" ? item.valor_max : "—"}{item.unidade_medida}</span>
                          )}
                          {item.critico && <span className="text-red-600">crítico</span>}
                          {!item.obrigatorio && <span>opcional</span>}
                          {item.exige_foto && <span className="flex items-center gap-0.5"><Camera size={11} /> foto</span>}
                          {item.depende_chave && <span className="text-emerald-700">condicional</span>}
                        </p>
                      </button>
                      <div className="flex shrink-0 gap-1">
                        <button onClick={() => moverItem(iS, iI, -1)} disabled={iI === 0} className="grid h-9 w-9 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 disabled:opacity-30"><ChevronUp size={15} /></button>
                        <button onClick={() => moverItem(iS, iI, 1)} disabled={iI === secao.itens.length - 1} className="grid h-9 w-9 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 disabled:opacity-30"><ChevronDown size={15} /></button>
                        <button onClick={() => duplicarItem(iS, iI)} className="grid h-9 w-9 place-items-center rounded-lg text-slate-400 hover:bg-slate-100"><Copy size={15} /></button>
                        <button onClick={() => removerItem(iS, iI)} className="grid h-9 w-9 place-items-center rounded-lg text-rose-500 hover:bg-rose-50"><Trash2 size={15} /></button>
                      </div>
                    </div>

                    {expandido && (
                      <div className="border-t border-emerald-200/70 p-3.5">
                        <label className="block">
                          <span className={rotulo}>O que a pessoa precisa verificar *</span>
                          <input value={item.titulo} onChange={e => mudarItem(iS, iI, { titulo: e.target.value })}
                            placeholder="Ex.: Temperatura da câmara fria" className={campo} />
                        </label>
                        <label className="mt-3 block">
                          <span className={rotulo}>Instrução (aparece na hora de responder)</span>
                          <textarea rows={2} value={item.instrucao || ""} onChange={e => mudarItem(iS, iI, { instrucao: e.target.value })} className={campo} />
                        </label>

                        <label className="mt-3 block">
                          <span className={rotulo}>Tipo de resposta</span>
                          <select value={item.tipo} onChange={e => mudarItem(iS, iI, {
                            tipo: e.target.value,
                            unidade_medida: tipoInfo(e.target.value).unidadePadrao || item.unidade_medida,
                          })} className={campo}>
                            {TIPOS_ITEM.map(g => (
                              <optgroup key={g.grupo} label={g.grupo}>
                                {g.tipos.map(t => <option key={t.valor} value={t.valor}>{t.rotulo}</option>)}
                              </optgroup>
                            ))}
                          </select>
                          <span className="mt-1 block text-[12px] font-medium text-slate-500">{info.ajuda}</span>
                        </label>

                        {ehNumerico(item.tipo) && (
                          <div className="mt-3 grid gap-3 sm:grid-cols-3">
                            <label className="block">
                              <span className={rotulo}>Mínimo aceito</span>
                              <input type="number" step="any" value={item.valor_min} onChange={e => mudarItem(iS, iI, { valor_min: e.target.value })} className={campo} />
                            </label>
                            <label className="block">
                              <span className={rotulo}>Máximo aceito</span>
                              <input type="number" step="any" value={item.valor_max} onChange={e => mudarItem(iS, iI, { valor_max: e.target.value })} className={campo} />
                            </label>
                            <label className="block">
                              <span className={rotulo}>Unidade</span>
                              <input value={item.unidade_medida} onChange={e => mudarItem(iS, iI, { unidade_medida: e.target.value })} placeholder="°C, kg, %" className={campo} />
                            </label>
                          </div>
                        )}

                        {ehEscolha(item.tipo) && (
                          <div className="mt-3">
                            <span className={rotulo}>Opções</span>
                            <div className="mt-1 space-y-2">
                              {(item.opcoes || []).map((op, iO) => (
                                <div key={iO} className="flex gap-2">
                                  <input value={op} onChange={e => mudarItem(iS, iI, { opcoes: item.opcoes.map((x, k) => k === iO ? e.target.value : x) })}
                                    placeholder={`Opção ${iO + 1}`} className="h-11 flex-1 rounded-xl border border-slate-300 px-3 font-semibold text-slate-700 outline-none focus:border-emerald-600" />
                                  <button onClick={() => mudarItem(iS, iI, { opcoes: item.opcoes.filter((_, k) => k !== iO) })}
                                    className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-slate-400 hover:text-rose-600"><Trash2 size={16} /></button>
                                </div>
                              ))}
                              <button onClick={() => mudarItem(iS, iI, { opcoes: [...(item.opcoes || []), ""] })}
                                className="text-[13px] font-black text-emerald-700">+ Adicionar opção</button>
                            </div>
                            <label className="mt-3 block">
                              <span className={rotulo}>Resposta que conta como certa</span>
                              <select value={item.resposta_esperada || ""} onChange={e => mudarItem(iS, iI, { resposta_esperada: e.target.value })} className={campo}>
                                <option value="">Qualquer resposta serve</option>
                                {(item.opcoes || []).filter(Boolean).map((op, iO) => <option key={iO} value={op}>{op}</option>)}
                              </select>
                            </label>
                          </div>
                        )}

                        {item.tipo === "FOTO_COM_IA" && (
                          <label className="mt-3 block">
                            <span className={rotulo}>O que a IA precisa encontrar na foto</span>
                            <textarea rows={2} value={item.criterios_ia || ""} onChange={e => mudarItem(iS, iI, { criterios_ia: e.target.value })}
                              placeholder="Ex.: bancada sem resíduos, panos guardados, produtos etiquetados" className={campo} />
                          </label>
                        )}

                        {/* Exigências e peso */}
                        <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
                          {[
                            ["obrigatorio", "Obrigatório"],
                            ["permite_na", "Aceita “não se aplica”"],
                            ["critico", "Item crítico (reprovar é grave)"],
                            ["exige_foto", "Exige foto"],
                            ["exige_comentario", "Exige comentário"],
                            ["exige_gps", "Exige localização"],
                          ].map(([chave, texto]) => (
                            <label key={chave} className="flex items-center gap-2.5">
                              <input type="checkbox" checked={!!item[chave]} onChange={e => mudarItem(iS, iI, { [chave]: e.target.checked })} className="h-5 w-5 accent-emerald-600" />
                              <span className="text-sm font-bold text-slate-700">{texto}</span>
                            </label>
                          ))}
                        </div>

                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          <label className="block">
                            <span className={rotulo}>Peso na nota</span>
                            <input type="number" min="0" step="0.5" value={item.peso} onChange={e => mudarItem(iS, iI, { peso: e.target.value })} className={campo} />
                          </label>
                          <label className="block">
                            <span className={rotulo}>Quando reprovar</span>
                            <select value={item.acao_reprovar} onChange={e => mudarItem(iS, iI, { acao_reprovar: e.target.value })} className={campo}>
                              <option value="nao_conformidade">Abrir não conformidade</option>
                              <option value="manutencao">Abrir chamado de manutenção</option>
                              <option value="nenhuma">Só registrar</option>
                            </select>
                          </label>
                        </div>

                        {/* Condicional */}
                        <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
                          <p className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-slate-500"><Settings2 size={13} /> Mostrar só em certos casos</p>
                          {candidatosCondicao(iS, iI).length === 0 ? (
                            <p className="mt-1.5 text-[13px] font-medium text-slate-500">Depende de um item anterior de resposta fechada. Não há nenhum antes deste.</p>
                          ) : (
                            <div className="mt-2 grid gap-2 sm:grid-cols-2">
                              <select value={item.depende_chave || ""} onChange={e => mudarItem(iS, iI, { depende_chave: e.target.value, depende_valor: "" })} className={campo}>
                                <option value="">Mostrar sempre</option>
                                {candidatosCondicao(iS, iI).map(c => <option key={c.chave} value={c.chave}>{c.titulo || "(sem título)"}</option>)}
                              </select>
                              {item.depende_chave && (
                                <select value={item.depende_valor || ""} onChange={e => mudarItem(iS, iI, { depende_valor: e.target.value })} className={campo}>
                                  <option value="">Quando a resposta for...</option>
                                  {valoresPossiveis(candidatosCondicao(iS, iI).find(c => c.chave === item.depende_chave)).map(v => (
                                    <option key={v.v} value={v.v}>{v.r}</option>
                                  ))}
                                </select>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <button onClick={() => addItem(iS)} className="mt-3 flex h-11 w-full items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-emerald-300 font-black text-emerald-700 hover:bg-emerald-50">
              <Plus size={17} /> Adicionar item
            </button>
          </section>
        ))}

        <button onClick={addSecao} className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 font-black text-slate-600 hover:border-emerald-400 hover:text-emerald-700">
          <Plus size={18} /> Nova seção
        </button>

        {/* Agendamento */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-emerald-700"><Clock size={14} /> Quando esta rotina acontece</p>
              <p className="mt-1 text-sm font-medium text-slate-500">A execução aparece sozinha na Central, no horário marcado.</p>
            </div>
            <button onClick={addAgenda} className="flex h-11 shrink-0 items-center gap-1.5 rounded-xl border-2 border-emerald-200 bg-white px-3.5 font-black text-emerald-700 hover:bg-emerald-50">
              <Plus size={17} /> Horário
            </button>
          </div>

          {agendas.length === 0 ? (
            <p className="mt-3 rounded-xl bg-amber-50 p-4 text-sm font-bold text-amber-800">
              Sem horário, o processo existe mas nunca é cobrado. Adicione pelo menos um.
            </p>
          ) : (
            <div className="mt-4 space-y-4">
              {agendas.map((a, iA) => (
                <div key={a.chave} className="rounded-2xl border border-slate-200 p-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[14px] font-black text-slate-800">{descreverAgenda(a)}</p>
                    <button onClick={() => removerAgenda(iA)} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50"><Trash2 size={16} /></button>
                  </div>

                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <label className="block">
                      <span className={rotulo}>Repetição</span>
                      <select value={a.frequencia} onChange={e => mudarAgenda(iA, { frequencia: e.target.value })} className={campo}>
                        {FREQUENCIAS.map(f => <option key={f.valor} value={f.valor}>{f.rotulo}</option>)}
                      </select>
                    </label>
                    <label className="block">
                      <span className={rotulo}>Horário</span>
                      <input type="time" value={a.hora_inicio} onChange={e => mudarAgenda(iA, { hora_inicio: e.target.value })} className={campo} />
                    </label>
                  </div>

                  {["dias_semana", "semanal", "quinzenal"].includes(a.frequencia) && (
                    <div className="mt-3">
                      <span className={rotulo}>Dias</span>
                      <div className="mt-1.5 flex flex-wrap gap-2">
                        {DIAS_SEMANA_OP.map(d => {
                          const marcado = (a.dias_semana || []).includes(d.valor);
                          return (
                            <button key={d.valor} onClick={() => alternarDia(iA, d.valor)}
                              className={`h-11 min-w-[58px] rounded-xl border-2 text-sm font-black ${marcado ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-emerald-300"}`}>
                              {d.rotulo}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {a.frequencia === "mensal" && (
                    <label className="mt-3 block sm:w-40">
                      <span className={rotulo}>Dia do mês</span>
                      <input type="number" min="1" max="31" value={a.dia_mes} onChange={e => mudarAgenda(iA, { dia_mes: e.target.value })} className={campo} />
                    </label>
                  )}

                  {a.frequencia === "datas" && (
                    <div className="mt-3">
                      <span className={rotulo}>Datas</span>
                      <div className="mt-1.5 flex flex-wrap gap-2">
                        {(a.datas || []).map((d, iD) => (
                          <span key={iD} className="flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-800">
                            {new Date(`${d}T12:00:00`).toLocaleDateString("pt-BR")}
                            <button onClick={() => mudarAgenda(iA, { datas: a.datas.filter((_, k) => k !== iD) })} className="text-emerald-700 hover:text-rose-600"><Trash2 size={13} /></button>
                          </span>
                        ))}
                      </div>
                      <input type="date" onChange={e => {
                        const v = e.target.value;
                        if (v && !(a.datas || []).includes(v)) mudarAgenda(iA, { datas: [...(a.datas || []), v].sort() });
                        e.target.value = "";
                      }} className={`${campo} sm:w-52`} />
                    </div>
                  )}

                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <label className="block">
                      <span className={rotulo}>Tolerância (min)</span>
                      <input type="number" min="0" value={a.minutos_tolerancia} onChange={e => mudarAgenda(iA, { minutos_tolerancia: e.target.value })} className={campo} />
                    </label>
                    <label className="block">
                      <span className={rotulo}>Vira atraso depois de (min)</span>
                      <input type="number" min="1" value={a.minutos_prazo} onChange={e => mudarAgenda(iA, { minutos_prazo: e.target.value })} className={campo} />
                    </label>
                  </div>

                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <label className="block">
                      <span className={rotulo}>Responsável</span>
                      <select value={a.responsavel_id || ""} onChange={e => mudarAgenda(iA, { responsavel_id: e.target.value })} className={campo}>
                        <option value="">Quem estiver no turno</option>
                        {equipe.map(c => <option key={c.id} value={c.id}>{c.nome}{c.cargo ? ` — ${c.cargo}` : ""}</option>)}
                      </select>
                    </label>
                    <label className="block">
                      <span className={rotulo}>Ou por função</span>
                      <input value={a.funcao_responsavel || ""} onChange={e => mudarAgenda(iA, { funcao_responsavel: e.target.value })} placeholder="Ex.: Chefe de cozinha" className={campo} />
                    </label>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 p-3 backdrop-blur sm:p-4"
        style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))" }}>
        <div className="mx-auto flex max-w-4xl gap-3">
          <button onClick={() => router.push("/dashboard/operacao/inteligente/processos")} className="rounded-xl border border-slate-200 px-5 py-3.5 text-sm font-bold text-slate-600 hover:bg-slate-50">Cancelar</button>
          <button onClick={salvar} disabled={salvando}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3.5 text-base font-black text-white hover:bg-emerald-700 disabled:opacity-60">
            {salvando ? <><Loader2 size={18} className="animate-spin" /> Salvando...</> : <><Save size={18} /> Salvar processo</>}
          </button>
        </div>
      </div>
    </div>
  );
}
