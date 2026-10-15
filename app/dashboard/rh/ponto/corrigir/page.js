"use client";

// CORREÇÃO E AJUSTE DE PONTO NO ERP
//
// Permite ajustar horários (dia completo ou batida individual) para qualquer
// colaborador (ativo ou inativo), além de gerenciar folgas de domingo e horários noturnos.
// Mantém total conformidade com a Portaria MTP 671/2021 registrando os ajustes
// no livro de ponto com NSR e autor.

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft, Check, Loader2, ShieldCheck, Clock3, Sun, Sparkles,
  Trash2, UserCheck, UserX, AlertTriangle, Calendar, Layers
} from "lucide-react";
import { useERP } from "../../../../context/ERPContext";
import { fetchColaboradores, fetchFolgasEsporadicas, inserirFolgaEsporadica, removerFolgaEsporadica } from "../../../../lib/rh";
import { fetchPontosMes, corrigirBatida, salvarAjusteDiaCompleto, CAMPO_POR_TIPO } from "../../../../lib/ponto";
import { fetchPins } from "../../../../lib/seguranca";

const TIPOS = [
  ["entrada", "Entrada"],
  ["saida_intervalo", "Saída para intervalo"],
  ["retorno_intervalo", "Volta do intervalo"],
  ["saida_trabalho", "Saída do trabalho"],
];

const DIAS_SEMANA = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];

const MOTIVOS_RAPIDOS = [
  "Esqueceu de bater entrada/saída",
  "Problema técnico no tablet de ponto",
  "Trabalhou no domingo / ajuste de escala",
  "Saída na madrugada não registrada",
  "Ajuste autorizado pela gerência",
];

const hojeISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const horaDe = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return isNaN(d) ? "" : `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

export default function CorrigirPontoPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { unidadeAtiva, sessao } = useERP();

  const colabParam = searchParams.get("colab");
  const dataParam = searchParams.get("data");

  const [colaboradores, setColaboradores] = useState([]);
  const [mostrarInativos, setMostrarInativos] = useState(true);
  const [colabId, setColabId] = useState(colabParam || "");
  const [data, setData] = useState(dataParam || hojeISO());
  const [diaDoMes, setDiaDoMes] = useState(null);
  const [folgaEsporadica, setFolgaEsporadica] = useState(null);
  const [carregando, setCarregando] = useState(false);

  // Modo: "completo" (todos os 4 horários) ou "individual" (1 batida)
  const [modo, setModo] = useState("completo");

  // Campos do modo completo
  const [entrada, setEntrada] = useState("");
  const [saidaInt, setSaidaInt] = useState("");
  const [retornoInt, setRetornoInt] = useState("");
  const [saida, setSaida] = useState("");
  const [passouMeiaNoite, setPassouMeiaNoite] = useState(false);
  const [ehFolgaDomingo, setEhFolgaDomingo] = useState(false);

  // Campos do modo individual
  const [tipo, setTipo] = useState("entrada");
  const [hora, setHora] = useState("");

  const [motivo, setMotivo] = useState("");
  const [pinGerente, setPinGerente] = useState("");
  const [pinDigitado, setPinDigitado] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState(null);

  // Carrega lista de colaboradores (INCLUINDO INATIVOS) e PIN do gerente
  useEffect(() => {
    if (!unidadeAtiva || unidadeAtiva === "todas") return;
    fetchColaboradores(unidadeAtiva).then((r) => {
      const lista = r.data || [];
      // Ordena: ativos primeiro, depois por nome
      lista.sort((a, b) => {
        const aInativo = (a.status || "ativo") === "inativo";
        const bInativo = (b.status || "ativo") === "inativo";
        if (aInativo !== bInativo) return aInativo ? 1 : -1;
        return (a.nome || "").localeCompare(b.nome || "");
      });
      setColaboradores(lista);
      if (colabParam && lista.some((c) => String(c.id) === String(colabParam))) {
        setColabId(colabParam);
      }
    });
    fetchPins(unidadeAtiva).then((r) => setPinGerente(r?.data?.pin_gerente || "1234"));
  }, [unidadeAtiva, colabParam]);

  // Carrega dados gravados no dia escolhido
  useEffect(() => {
    if (!colabId || !data) {
      setDiaDoMes(null);
      setFolgaEsporadica(null);
      return;
    }
    let ativo = true;
    setCarregando(true);

    Promise.all([
      fetchPontosMes(colabId, data.slice(0, 7)),
      fetchFolgasEsporadicas(colabId),
    ]).then(([resPts, resFolgas]) => {
      if (!ativo) return;
      const reg = (resPts.data || []).find((d) => String(d.data_referencia).slice(0, 10) === data) || null;
      setDiaDoMes(reg);

      const folga = (resFolgas.data || []).find((f) => String(f.data_folga).slice(0, 10) === data) || null;
      setFolgaEsporadica(folga);
      setEhFolgaDomingo(Boolean(folga));

      if (reg) {
        const entH = horaDe(reg.hora_entrada);
        const sIntH = horaDe(reg.hora_saida_intervalo);
        const rIntH = horaDe(reg.hora_retorno_intervalo);
        const saiH = horaDe(reg.hora_saida);

        setEntrada(entH);
        setSaidaInt(sIntH);
        setRetornoInt(rIntH);
        setSaida(saiH);

        if (reg.hora_saida && reg.hora_entrada) {
          const dEnt = new Date(reg.hora_entrada);
          const dSai = new Date(reg.hora_saida);
          setPassouMeiaNoite(dSai.getDate() !== dEnt.getDate() || Number(saiH.slice(0, 2)) < 6);
        } else if (saiH && Number(saiH.slice(0, 2)) < 6) {
          setPassouMeiaNoite(true);
        } else {
          setPassouMeiaNoite(false);
        }

        setHora(horaDe(reg[CAMPO_POR_TIPO[tipo]]) || "");
      } else {
        setEntrada("");
        setSaidaInt("");
        setRetornoInt("");
        setSaida("");
        setPassouMeiaNoite(false);
        setHora("");
      }

      setCarregando(false);
    });

    return () => { ativo = false; };
  }, [colabId, data, tipo]);

  // Auto-detecta saída na madrugada se o usuário digitar 00:xx até 05:xx
  useEffect(() => {
    if (saida && Number(saida.slice(0, 2)) < 6) {
      setPassouMeiaNoite(true);
    }
  }, [saida]);

  const colaboradorSelecionado = useMemo(
    () => colaboradores.find((c) => String(c.id) === String(colabId)) || null,
    [colaboradores, colabId]
  );

  const colaboradoresFiltrados = useMemo(() => {
    if (mostrarInativos) return colaboradores;
    return colaboradores.filter((c) => (c.status || "ativo") !== "inativo" && c.ativo !== false);
  }, [colaboradores, mostrarInativos]);

  const dataObj = useMemo(() => {
    if (!data) return new Date();
    return new Date(`${data}T12:00:00`);
  }, [data]);

  const diaSemanaIndex = dataObj.getDay();
  const ehDomingo = diaSemanaIndex === 0;
  const diaSemanaNome = DIAS_SEMANA[diaSemanaIndex];
  const ehInativo = colaboradorSelecionado && ((colaboradorSelecionado.status || "ativo") === "inativo" || colaboradorSelecionado.ativo === false);

  const valorAtualIndividual = diaDoMes ? diaDoMes[CAMPO_POR_TIPO[tipo]] : null;

  // Preenchimento com o horário contratado
  const preencherHorarioContratado = () => {
    if (!colaboradorSelecionado) return;
    const c = colaboradorSelecionado;
    const ent = ehDomingo ? (c.horario_dom_entrada || c.horario_entrada) : c.horario_entrada;
    const sai = ehDomingo ? (c.horario_dom_saida || c.horario_saida) : c.horario_saida;
    const intIni = ehDomingo ? (c.intervalo_dom_inicio || c.intervalo_inicio) : c.intervalo_inicio;
    const intFim = ehDomingo ? (c.intervalo_dom_fim || c.intervalo_fim) : c.intervalo_fim;

    if (ent) setEntrada(ent.slice(0, 5));
    if (sai) {
      const saiFmt = sai.slice(0, 5);
      setSaida(saiFmt);
      setPassouMeiaNoite(Number(saiFmt.slice(0, 2)) < 6);
    }
    if (intIni) setSaidaInt(intIni.slice(0, 5));
    if (intFim) setRetornoInt(intFim.slice(0, 5));
    setMotivo("Horário preenchido de acordo com o contrato");
  };

  const limparBatidasDoDia = () => {
    setEntrada("");
    setSaidaInt("");
    setRetornoInt("");
    setSaida("");
    setPassouMeiaNoite(false);
    setMotivo("Limpeza de batidas do dia");
  };

  // Salva no modo Completo
  const salvarCompleto = async (apenasLimpar = false) => {
    setAviso(null);
    if (pinGerente && pinDigitado !== pinGerente) {
      return setAviso({ erro: true, msg: "PIN do gerente incorreto." });
    }
    if (!colabId) return setAviso({ erro: true, msg: "Escolha o colaborador." });
    if (!data) return setAviso({ erro: true, msg: "Informe a data." });

    const autor = sessao?.nome || sessao?.user?.email || sessao?.email || "Gerência";

    setSalvando(true);
    const res = await salvarAjusteDiaCompleto({
      unidadeId: unidadeAtiva,
      colaboradorId: colabId,
      dataReferencia: data,
      horarios: {
        hora_entrada: apenasLimpar ? "" : entrada,
        hora_saida_intervalo: apenasLimpar ? "" : saidaInt,
        hora_retorno_intervalo: apenasLimpar ? "" : retornoInt,
        hora_saida: apenasLimpar ? "" : saida,
      },
      passouMeiaNoite,
      registradoPor: autor,
      motivo: motivo || (apenasLimpar ? "Limpeza de batidas" : "Ajuste manual de horários"),
      ehFolgaDomingo: ehFolgaDomingo,
      limparTudo: apenasLimpar,
    });
    setSalvando(false);

    if (res.error) return setAviso({ erro: true, msg: res.error });

    setAviso({
      erro: false,
      msg: apenasLimpar
        ? `Batidas de ${colaboradorSelecionado?.nome} em ${data.split("-").reverse().join("/")} foram limpas com sucesso.`
        : `Horários de ${colaboradorSelecionado?.nome} em ${data.split("-").reverse().join("/")} atualizados com sucesso.` +
          (res.alteracoes?.length ? ` (${res.alteracoes.length} ajustes registrados no livro).` : ""),
    });

    setPinDigitado("");
    // Recarrega dia
    fetchPontosMes(colabId, data.slice(0, 7)).then((r) => {
      setDiaDoMes((r.data || []).find((d) => String(d.data_referencia).slice(0, 10) === data) || null);
    });
    fetchFolgasEsporadicas(colabId).then((r) => {
      setFolgaEsporadica((r.data || []).find((f) => String(f.data_folga).slice(0, 10) === data) || null);
    });
  };

  // Salva no modo Individual (compatibilidade)
  const salvarIndividual = async () => {
    setAviso(null);
    if (pinGerente && pinDigitado !== pinGerente) {
      return setAviso({ erro: true, msg: "PIN do gerente incorreto." });
    }
    if (!colabId) return setAviso({ erro: true, msg: "Escolha o colaborador." });
    if (!hora) return setAviso({ erro: true, msg: "Informe o horário corrigido." });

    const [h, m] = hora.split(":").map(Number);
    const base = new Date(`${data}T00:00:00`);
    const viradaMeiaNoite = tipo === "saida_trabalho" && h < 6;
    if (viradaMeiaNoite) base.setDate(base.getDate() + 1);
    base.setHours(h, m, 0, 0);

    setSalvando(true);
    const r = await corrigirBatida({
      unidadeId: unidadeAtiva,
      colaboradorId: colabId,
      dataReferencia: data,
      tipo,
      novaHoraISO: base.toISOString(),
      registradoPor: sessao?.nome || sessao?.user?.email || "Gerência",
      motivo,
    });
    setSalvando(false);

    if (r.error) return setAviso({ erro: true, msg: r.error });

    setAviso({
      erro: false,
      msg: `${colaboradorSelecionado?.nome}: ${TIPOS.find(([id]) => id === tipo)[1].toLowerCase()} corrigida para ${hora}${viradaMeiaNoite ? " do dia seguinte" : ""}.` +
        (r.nsr ? ` Ajuste registrado sob NSR ${r.nsr}.` : ""),
    });

    setHora("");
    setPinDigitado("");
    fetchPontosMes(colabId, data.slice(0, 7)).then((res) =>
      setDiaDoMes((res.data || []).find((d) => String(d.data_referencia).slice(0, 10) === data) || null)
    );
  };

  const campo = "mt-1.5 h-12 w-full rounded-xl border border-line bg-card px-3.5 font-bold text-slate-800 outline-none focus:border-emerald-500";
  const rotulo = "text-2xs font-black uppercase tracking-wider text-fg";

  return (
    <div className="min-h-screen bg-hf-bg pb-16 text-fg font-sans">
      <header className="border-b border-line bg-card px-4 py-4 sm:px-7">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <button
            onClick={() => router.back()}
            className="grid h-11 w-11 place-items-center rounded-xl border border-line text-slate-900 hover:bg-slate-100 transition-colors"
            aria-label="Voltar"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-black sm:text-2xl flex items-center gap-2">
              <Clock3 size={22} className="text-emerald-600 shrink-0" />
              Ajuste e Correção de Ponto
            </h1>
            <p className="text-xs sm:text-sm font-semibold text-fg">
              Ajuste batidas esquecidas, escalas de domingo e turnos noturnos com registro oficial
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-5 px-4 py-6 sm:px-7">

        {/* 1. SELEÇÃO DO COLABORADOR E DIA */}
        <section className="rounded-2xl border border-line bg-card p-4 shadow-sm sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
            <p className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-2">
              <Calendar size={15} className="text-emerald-600" />
              1. Colaborador e Data de Referência
            </p>
            <label className="flex items-center gap-2 text-xs font-bold text-slate-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={mostrarInativos}
                onChange={(e) => setMostrarInativos(e.target.checked)}
                className="w-4 h-4 rounded accent-emerald-600 cursor-pointer"
              />
              <span>Incluir colaboradores inativos / desligados</span>
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label>
              <span className={rotulo}>Colaborador *</span>
              <select
                value={colabId}
                onChange={(e) => setColabId(e.target.value)}
                className={campo}
              >
                <option value="">Selecione o colaborador…</option>
                {colaboradoresFiltrados.map((c) => {
                  const inat = (c.status || "ativo") === "inativo" || c.ativo === false;
                  return (
                    <option key={c.id} value={c.id}>
                      {c.nome} {inat ? "— [INATIVO / DESLIGADO]" : ""}
                    </option>
                  );
                })}
              </select>
            </label>

            <label>
              <span className={rotulo}>Dia da Referência *</span>
              <input
                type="date"
                value={data}
                onChange={(e) => setData(e.target.value)}
                className={campo}
              />
            </label>
          </div>

          {colaboradorSelecionado && (
            <div className="flex items-center justify-between rounded-xl bg-slate-50 border border-slate-200 p-3 text-xs">
              <div>
                <p className="font-black text-slate-800">
                  {colaboradorSelecionado.nome}
                  {ehInativo ? (
                    <span className="ml-2 rounded-md bg-slate-200 px-2 py-0.5 text-3xs font-black uppercase text-slate-700">
                      Inativo
                    </span>
                  ) : (
                    <span className="ml-2 rounded-md bg-emerald-100 px-2 py-0.5 text-3xs font-black uppercase text-emerald-800">
                      Ativo
                    </span>
                  )}
                  {ehDomingo && (
                    <span className="ml-2 rounded-md bg-amber-100 border border-amber-300 px-2 py-0.5 text-3xs font-black uppercase text-amber-900">
                      Domingo
                    </span>
                  )}
                </p>
                <p className="text-3xs text-slate-500 mt-0.5">
                  Cargo: {colaboradorSelecionado.cargo || "—"} · Horário contratado: {colaboradorSelecionado.horario_entrada || "—"} às {colaboradorSelecionado.horario_saida || "—"}
                  {ehDomingo && colaboradorSelecionado.horario_dom_entrada && ` (Domingo: ${colaboradorSelecionado.horario_dom_entrada} às ${colaboradorSelecionado.horario_dom_saida})`}
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  const novoValor = !ehFolgaDomingo;
                  setEhFolgaDomingo(novoValor);
                  if (novoValor && !entrada && !saida) {
                    setMotivo(ehDomingo ? "Folga de domingo" : "Folga semanal");
                  }
                }}
                className={`rounded-lg px-2.5 py-1 text-xs font-bold border transition-colors ${
                  ehFolgaDomingo
                    ? "bg-amber-100 border-amber-300 text-amber-900 font-black"
                    : "bg-white border-slate-300 text-slate-700 hover:bg-slate-100"
                }`}
              >
                <Sun size={12} className="inline mr-1 text-amber-600" />
                {ehFolgaDomingo
                  ? (ehDomingo ? "✓ Folga de Domingo Marcada" : "✓ Folga Marcada")
                  : (ehDomingo ? "Marcar Folga de Domingo" : "Marcar Folga (Semanal / Esporádica)")}
              </button>
            </div>
          )}

          {/* O que está gravado neste dia */}
          {colabId && (
            <div className="rounded-xl border border-line bg-card p-4">
              <div className="flex items-center justify-between mb-2">
                <p className={rotulo}>O que está gravado neste dia ({data.split("-").reverse().join("/")} - {diaSemanaNome})</p>
                {folgaEsporadica && (
                  <span className="text-3xs font-bold uppercase rounded bg-rose-100 text-rose-800 px-2 py-0.5">
                    {folgaEsporadica.descricao || "Folga Registrada"}
                  </span>
                )}
              </div>

              {carregando ? (
                <p className="flex items-center gap-2 text-sm font-bold text-fg py-2">
                  <Loader2 size={15} className="animate-spin text-emerald-600" /> Carregando batidas…
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {TIPOS.map(([id, nome]) => (
                    <div key={id} className="rounded-xl bg-card border border-line px-3 py-2 text-center">
                      <p className="text-3xs font-extrabold uppercase text-subtle">{nome.split(" ")[0]}</p>
                      <p className="text-base font-black text-slate-800">
                        {horaDe(diaDoMes?.[CAMPO_POR_TIPO[id]]) || "--:--"}
                      </p>
                    </div>
                  ))}
                </div>
              )}
              {!carregando && !diaDoMes && (
                <p className="mt-2 text-xs font-bold text-amber-700">
                  Nenhuma batida registrada neste dia. O ajuste criará o registro de jornada.
                </p>
              )}
            </div>
          )}
        </section>

        {/* 2. MODO DE EDIÇÃO: DIA COMPLETO OU BATIDA INDIVIDUAL */}
        <div className="flex items-center gap-2 bg-slate-200/80 p-1 rounded-2xl">
          <button
            type="button"
            onClick={() => setModo("completo")}
            className={`flex-1 py-2.5 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-2 ${
              modo === "completo"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Clock3 size={16} className={modo === "completo" ? "text-emerald-600" : ""} />
            Ajustar Dia Completo (Todos os 4 horários)
          </button>

          <button
            type="button"
            onClick={() => setModo("individual")}
            className={`flex-1 py-2.5 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-2 ${
              modo === "individual"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Layers size={16} className={modo === "individual" ? "text-emerald-600" : ""} />
            Corrigir Batida Individual
          </button>
        </div>

        {/* 3. FORMULÁRIO DE CORREÇÃO */}
        {modo === "completo" ? (
          <section className="rounded-2xl border-2 border-emerald-300 bg-card p-4 shadow-sm sm:p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Clock3 className="text-emerald-600" size={20} />
                <h2 className="text-base sm:text-lg font-black text-slate-800">Horários da Jornada Completa</h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={preencherHorarioContratado}
                  className="rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800 hover:bg-emerald-100 flex items-center gap-1"
                >
                  <Sparkles size={12} /> Preencher Contratado
                </button>
                <button
                  type="button"
                  onClick={limparBatidasDoDia}
                  className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-700 hover:bg-rose-100 flex items-center gap-1"
                >
                  <Trash2 size={12} /> Limpar
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <label>
                <span className={rotulo}>1. Entrada</span>
                <input
                  type="time"
                  value={entrada}
                  onChange={(e) => setEntrada(e.target.value)}
                  className={`${campo} text-center font-black`}
                />
              </label>

              <label>
                <span className={rotulo}>2. Saída Int.</span>
                <input
                  type="time"
                  value={saidaInt}
                  onChange={(e) => setSaidaInt(e.target.value)}
                  className={`${campo} text-center font-black`}
                />
              </label>

              <label>
                <span className={rotulo}>3. Volta Int.</span>
                <input
                  type="time"
                  value={retornoInt}
                  onChange={(e) => setRetornoInt(e.target.value)}
                  className={`${campo} text-center font-black`}
                />
              </label>

              <label>
                <span className={rotulo}>4. Saída</span>
                <input
                  type="time"
                  value={saida}
                  onChange={(e) => setSaida(e.target.value)}
                  className={`${campo} text-center font-black`}
                />
              </label>
            </div>

            <label className="flex items-center gap-2 pt-1 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={passouMeiaNoite}
                onChange={(e) => setPassouMeiaNoite(e.target.checked)}
                className="w-4 h-4 rounded accent-emerald-600 cursor-pointer"
              />
              <span className="text-xs font-bold text-slate-700">
                Saída na madrugada do dia seguinte (+1 dia)
              </span>
              <span className="text-3xs text-subtle">
                (ex.: 00:00 ou 01:00 pertence à jornada do dia de referência)
              </span>
            </label>
          </section>
        ) : (
          <section className="rounded-2xl border-2 border-emerald-300 bg-card p-4 shadow-sm sm:p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Clock3 className="text-emerald-600" size={20} />
              <h2 className="text-base sm:text-lg font-black text-slate-800">Batida Individual</h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label>
                <span className={rotulo}>Qual batida *</span>
                <select value={tipo} onChange={(e) => setTipo(e.target.value)} className={campo}>
                  {TIPOS.map(([id, nome]) => (
                    <option key={id} value={id}>{nome}</option>
                  ))}
                </select>
              </label>
              <label>
                <span className={rotulo}>Horário correto *</span>
                <input
                  type="time"
                  value={hora}
                  onChange={(e) => setHora(e.target.value)}
                  className={campo}
                />
              </label>
            </div>
            <p className="text-xs font-semibold text-fg">
              Valor atual: <b className="text-fg-soft">{horaDe(valorAtualIndividual) || "não marcado"}</b>
              {tipo === "saida_trabalho" && " · saída antes das 6h é entendida como madrugada do dia seguinte"}
            </p>
          </section>
        )}

        {/* 4. MOTIVO E JUSTIFICATIVA */}
        <section className="rounded-2xl border border-line bg-card p-4 shadow-sm sm:p-6 space-y-3">
          <span className={rotulo}>Motivo do Ajuste *</span>
          <div className="flex flex-wrap gap-1.5">
            {MOTIVOS_RAPIDOS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMotivo(m)}
                className={`rounded-lg border px-2.5 py-1 text-3xs font-bold transition-colors ${
                  motivo === m
                    ? "border-emerald-600 bg-emerald-50 text-emerald-800 font-black"
                    : "border-line bg-card text-subtle hover:bg-slate-100"
                }`}
              >
                {m}
              </button>
            ))}
          </div>

          <textarea
            rows={2}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ex.: Funcionário esqueceu de bater saída no fechamento"
            className={`${campo} h-auto py-2.5 font-semibold text-xs`}
          />
        </section>

        {/* 5. AUTORIZAÇÃO PIN */}
        <section className="rounded-2xl border border-line bg-card p-4 shadow-sm sm:p-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="text-emerald-600" size={22} />
            <div>
              <h2 className="font-black text-sm text-slate-800">Autorização da Gerência</h2>
              <p className="text-3xs text-subtle">Digite o PIN do gerente para confirmar a alteração no livro</p>
            </div>
          </div>
          <label className="block sm:max-w-[150px]">
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              placeholder="PIN"
              value={pinDigitado}
              onChange={(e) => setPinDigitado(e.target.value)}
              className={`${campo} text-center tracking-widest text-sm`}
            />
          </label>
        </section>

        {/* MENSAGENS */}
        {aviso && (
          <div className={`rounded-xl p-4 text-sm font-bold flex items-center gap-2 ${
            aviso.erro ? "border border-red-200 bg-red-50 text-red-700" : "border border-emerald-200 bg-emerald-50 text-emerald-800"
          }`}>
            {aviso.erro ? <AlertTriangle size={18} className="shrink-0" /> : <Check size={18} className="shrink-0" />}
            <span>{aviso.msg}</span>
          </div>
        )}

        {/* BOTÃO PRINCIPAL */}
        <button
          onClick={() => (modo === "completo" ? salvarCompleto(false) : salvarIndividual())}
          disabled={salvando}
          className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-accent px-6 text-base font-black text-accent-fg shadow-lg shadow-emerald-200 hover:bg-accent-strong disabled:opacity-60 transition-all cursor-pointer"
        >
          {salvando ? <Loader2 className="animate-spin" size={20} /> : <Check size={20} />}
          {modo === "completo" ? "Salvar Ajuste do Dia" : "Registrar Correção Individual"}
        </button>
      </main>
    </div>
  );
}
