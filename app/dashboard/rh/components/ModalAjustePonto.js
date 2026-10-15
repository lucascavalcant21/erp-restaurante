"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Clock, X, Check, Trash2, Calendar, AlertTriangle, ShieldCheck,
  Sun, Sparkles, Loader2, ArrowRight, UserCheck, UserX, Coffee
} from "lucide-react";
import { salvarAjusteDiaCompleto } from "../../../lib/ponto";
import { fetchPins } from "../../../lib/seguranca";

const DIAS_SEMANA = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];

function extrairHHMM(isoOuHora) {
  if (!isoOuHora) return "";
  const s = String(isoOuHora).trim();
  if (!s) return "";
  if (s.includes("T")) {
    const d = new Date(s);
    if (isNaN(d)) return "";
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }
  return s.slice(0, 5);
}

const MOTIVOS_SUGERIDOS = [
  "Esqueceu de bater entrada/saída",
  "Problema técnico no tablet de ponto",
  "Trabalhou no domingo / ajuste de escala",
  "Saída na madrugada não registrada",
  "Retorno de intervalo não registrado",
  "Ajuste autorizado pela gerência",
];

export default function ModalAjustePonto({
  aberto,
  onClose,
  colaborador,
  dataReferencia, // "YYYY-MM-DD"
  registroPonto = null, // linha atual de registro_ponto se existir
  ehFolgaDomingoAtual = false, // se já tem folga de domingo em rh_folgas_esporadicas
  unidadeId,
  sessao,
  onSalvo,
}) {
  const [entrada, setEntrada] = useState("");
  const [saidaInt, setSaidaInt] = useState("");
  const [retornoInt, setRetornoInt] = useState("");
  const [saida, setSaida] = useState("");
  const [passouMeiaNoite, setPassouMeiaNoite] = useState(false);
  const [ehFolgaDomingo, setEhFolgaDomingo] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [pinGerente, setPinGerente] = useState("");
  const [pinDigitado, setPinDigitado] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");

  // Carrega PIN do gerente
  useEffect(() => {
    if (!unidadeId || unidadeId === "todas") return;
    fetchPins(unidadeId).then((r) => setPinGerente(r?.data?.pin_gerente || "1234"));
  }, [unidadeId]);

  // Preenche dados ao abrir ou mudar de registro/data
  useEffect(() => {
    if (!aberto) return;
    setErro("");
    setSucesso("");
    setPinDigitado("");
    setMotivo("");

    if (registroPonto) {
      const entH = extrairHHMM(registroPonto.hora_entrada);
      const sIntH = extrairHHMM(registroPonto.hora_saida_intervalo);
      const rIntH = extrairHHMM(registroPonto.hora_retorno_intervalo);
      const saiH = extrairHHMM(registroPonto.hora_saida);

      setEntrada(entH);
      setSaidaInt(sIntH);
      setRetornoInt(rIntH);
      setSaida(saiH);

      // Detecta se a saída já foi salva no dia seguinte
      if (registroPonto.hora_saida && registroPonto.hora_entrada) {
        const dEnt = new Date(registroPonto.hora_entrada);
        const dSai = new Date(registroPonto.hora_saida);
        setPassouMeiaNoite(dSai.getDate() !== dEnt.getDate() || Number(saiH.slice(0, 2)) < 6);
      } else if (saiH && Number(saiH.slice(0, 2)) < 6) {
        setPassouMeiaNoite(true);
      } else {
        setPassouMeiaNoite(false);
      }
    } else {
      setEntrada("");
      setSaidaInt("");
      setRetornoInt("");
      setSaida("");
      setPassouMeiaNoite(false);
    }

    setEhFolgaDomingo(Boolean(ehFolgaDomingoAtual));
  }, [aberto, registroPonto, ehFolgaDomingoAtual, dataReferencia]);

  // Auto-detecta saída na madrugada se o usuário digitar 00:xx até 05:xx
  useEffect(() => {
    if (saida) {
      const h = Number(saida.slice(0, 2));
      if (!isNaN(h) && h < 6) {
        setPassouMeiaNoite(true);
      }
    }
  }, [saida]);

  const dataObj = useMemo(() => {
    if (!dataReferencia) return new Date();
    return new Date(`${dataReferencia}T12:00:00`);
  }, [dataReferencia]);

  const diaSemanaIndex = dataObj.getDay();
  const ehDomingo = diaSemanaIndex === 0;
  const diaSemanaNome = DIAS_SEMANA[diaSemanaIndex];
  const dataFormatadaBR = dataReferencia ? dataReferencia.split("-").reverse().join("/") : "";

  const ehInativo = colaborador && (colaborador.status === "inativo" || colaborador.ativo === false);

  // Preenchimento rápido com o horário contratado
  const preencherHorarioContratado = () => {
    if (!colaborador) return;
    const ent = ehDomingo ? (colaborador.horario_dom_entrada || colaborador.horario_entrada) : colaborador.horario_entrada;
    const sai = ehDomingo ? (colaborador.horario_dom_saida || colaborador.horario_saida) : colaborador.horario_saida;
    const intIni = ehDomingo ? (colaborador.intervalo_dom_inicio || colaborador.intervalo_inicio) : colaborador.intervalo_inicio;
    const intFim = ehDomingo ? (colaborador.intervalo_dom_fim || colaborador.intervalo_fim) : colaborador.intervalo_fim;

    if (ent) setEntrada(extrairHHMM(ent));
    if (sai) {
      const saiFmt = extrairHHMM(sai);
      setSaida(saiFmt);
      if (Number(saiFmt.slice(0, 2)) < 6) setPassouMeiaNoite(true);
      else setPassouMeiaNoite(false);
    }
    if (intIni) setSaidaInt(extrairHHMM(intIni));
    if (intFim) setRetornoInt(extrairHHMM(intFim));
    setMotivo("Horário preenchido de acordo com o contrato");
    setErro("");
  };

  const limparBatidasDoDia = () => {
    setEntrada("");
    setSaidaInt("");
    setRetornoInt("");
    setSaida("");
    setPassouMeiaNoite(false);
    setMotivo("Limpeza de batidas do dia");
  };

  const handleSalvar = async (apenasLimpar = false) => {
    setErro("");
    setSucesso("");

    // Valida PIN se exigido
    if (pinGerente && pinDigitado !== pinGerente) {
      setErro("PIN do gerente incorreto. Digite o PIN de 4 dígitos para autorizar.");
      return;
    }

    if (!colaborador?.id || !dataReferencia) {
      setErro("Faltam dados do colaborador ou da data.");
      return;
    }

    const autor = sessao?.nome || sessao?.user?.email || sessao?.email || "Gerente";

    setSalvando(true);
    try {
      const res = await salvarAjusteDiaCompleto({
        unidadeId: unidadeId || colaborador.unidade_id,
        colaboradorId: colaborador.id,
        dataReferencia,
        horarios: {
          hora_entrada: apenasLimpar ? "" : entrada,
          hora_saida_intervalo: apenasLimpar ? "" : saidaInt,
          hora_retorno_intervalo: apenasLimpar ? "" : retornoInt,
          hora_saida: apenasLimpar ? "" : saida,
        },
        passouMeiaNoite,
        registradoPor: autor,
        motivo: motivo || "Ajuste manual no sistema",
        ehFolgaDomingo: ehDomingo ? ehFolgaDomingo : undefined,
        limparTudo: apenasLimpar,
      });

      if (res.error) {
        setErro(res.error);
        setSalvando(false);
        return;
      }

      setSucesso("Ajustes salvos com sucesso no livro de ponto!");
      setTimeout(() => {
        setSalvando(false);
        if (onSalvo) onSalvo();
        onClose();
      }, 700);
    } catch (e) {
      setErro("Falha inesperada ao salvar: " + (e?.message || e));
      setSalvando(false);
    }
  };

  if (!aberto || !colaborador) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/75 p-3 backdrop-blur-sm sm:p-4 overflow-y-auto">
      <div className="flex w-full max-w-lg flex-col overflow-hidden rounded-3xl bg-card border border-line shadow-2xl animate-in zoom-in-95 my-auto max-h-[92vh]">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between border-b border-line bg-gradient-to-r from-emerald-950 to-slate-900 p-4 text-white sm:px-6">
          <div className="flex items-center gap-3 min-w-0">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <Clock size={20} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-black truncate sm:text-lg">Ajustar Ponto do Dia</h2>
                {ehInativo ? (
                  <span className="rounded-md bg-slate-700 px-2 py-0.5 text-3xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-1">
                    <UserX size={10} /> Inativo
                  </span>
                ) : (
                  <span className="rounded-md bg-emerald-500/20 px-2 py-0.5 text-3xs font-bold uppercase tracking-wider text-emerald-300 flex items-center gap-1">
                    <UserCheck size={10} /> Ativo
                  </span>
                )}
                {ehDomingo && (
                  <span className="rounded-md bg-amber-500/20 border border-amber-500/30 px-2 py-0.5 text-3xs font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1">
                    <Sun size={10} /> Domingo
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-300 font-semibold truncate mt-0.5">
                {colaborador.nome} · <span className="text-emerald-400 font-bold">{dataFormatadaBR} ({diaSemanaNome})</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="grid h-8 w-8 place-items-center rounded-full bg-white/10 text-slate-300 hover:bg-white/20 hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        {/* Corpo do formulário */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 text-fg text-sm">

          {/* Atalhos Rápidos */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={preencherHorarioContratado}
              className="flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800 hover:bg-emerald-100 transition-colors"
            >
              <Sparkles size={13} className="text-emerald-600" />
              Preencher Turno Contratado
            </button>

            {ehDomingo && (
              <button
                type="button"
                onClick={() => setEhFolgaDomingo(!ehFolgaDomingo)}
                className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition-colors ${
                  ehFolgaDomingo
                    ? "border-amber-300 bg-amber-100 text-amber-900"
                    : "border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                <Sun size={13} className={ehFolgaDomingo ? "text-amber-600" : "text-slate-500"} />
                {ehFolgaDomingo ? "✓ Folga de Domingo Ativa" : "Marcar como Folga de Domingo"}
              </button>
            )}

            <button
              type="button"
              onClick={limparBatidasDoDia}
              className="flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100 transition-colors ml-auto"
            >
              <Trash2 size={13} />
              Limpar Horários
            </button>
          </div>

          {/* 4 Horários de Batida */}
          <div className="rounded-2xl border border-line bg-card p-4 space-y-3">
            <p className="text-2xs font-black uppercase tracking-wider text-subtle flex items-center gap-1.5">
              <Clock size={13} /> Batidas do Ponto (Entrada, Intervalo e Saída)
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <label className="block">
                <span className="text-3xs font-extrabold uppercase text-slate-600 block mb-1">1. Entrada</span>
                <input
                  type="time"
                  value={entrada}
                  onChange={(e) => setEntrada(e.target.value)}
                  className="w-full h-11 px-2.5 rounded-xl border border-line bg-card font-black text-slate-800 text-sm outline-none focus:border-emerald-500 text-center"
                />
              </label>

              <label className="block">
                <span className="text-3xs font-extrabold uppercase text-slate-600 block mb-1">2. Saída Int.</span>
                <input
                  type="time"
                  value={saidaInt}
                  onChange={(e) => setSaidaInt(e.target.value)}
                  className="w-full h-11 px-2.5 rounded-xl border border-line bg-card font-black text-slate-800 text-sm outline-none focus:border-emerald-500 text-center"
                />
              </label>

              <label className="block">
                <span className="text-3xs font-extrabold uppercase text-slate-600 block mb-1">3. Volta Int.</span>
                <input
                  type="time"
                  value={retornoInt}
                  onChange={(e) => setRetornoInt(e.target.value)}
                  className="w-full h-11 px-2.5 rounded-xl border border-line bg-card font-black text-slate-800 text-sm outline-none focus:border-emerald-500 text-center"
                />
              </label>

              <label className="block">
                <span className="text-3xs font-extrabold uppercase text-slate-600 block mb-1">4. Saída</span>
                <input
                  type="time"
                  value={saida}
                  onChange={(e) => setSaida(e.target.value)}
                  className="w-full h-11 px-2.5 rounded-xl border border-line bg-card font-black text-slate-800 text-sm outline-none focus:border-emerald-500 text-center"
                />
              </label>
            </div>

            {/* Checkbox de Virada da Meia-Noite */}
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
                (ex.: 00:00 até 05:00 pertence ao turno da noite anterior)
              </span>
            </label>
          </div>

          {/* Motivo do Ajuste */}
          <div className="space-y-2">
            <span className="text-2xs font-black uppercase tracking-wider text-subtle block">
              Motivo do Ajuste (Obrigatório p/ conformidade legal)
            </span>

            <div className="flex flex-wrap gap-1.5">
              {MOTIVOS_SUGERIDOS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMotivo(m)}
                  className={`rounded-lg border px-2 py-1 text-3xs font-bold transition-colors ${
                    motivo === m
                      ? "border-emerald-500 bg-emerald-50 text-emerald-800 font-black"
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
              placeholder="Digite o motivo ou selecione uma opção acima..."
              className="w-full rounded-xl border border-line bg-card p-3 font-semibold text-slate-800 text-xs outline-none focus:border-emerald-500"
            />
          </div>

          {/* Autorização: PIN do Gerente */}
          <div className="rounded-2xl border border-line bg-card p-3 sm:p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="text-emerald-600 shrink-0" size={20} />
              <div>
                <p className="text-xs font-black text-slate-800">Autorização da Gerência</p>
                <p className="text-3xs text-subtle">Digite o PIN do gerente para confirmar a alteração</p>
              </div>
            </div>
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              placeholder="PIN"
              value={pinDigitado}
              onChange={(e) => setPinDigitado(e.target.value)}
              className="w-24 h-10 px-3 rounded-xl border border-line bg-card font-black text-slate-800 text-center text-sm outline-none focus:border-emerald-500 tracking-widest"
            />
          </div>

          {/* Alertas e Mensagens */}
          {erro && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-700 flex items-center gap-2">
              <AlertTriangle size={16} className="shrink-0" />
              <span>{erro}</span>
            </div>
          )}

          {sucesso && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-bold text-emerald-800 flex items-center gap-2">
              <Check size={16} className="shrink-0" />
              <span>{sucesso}</span>
            </div>
          )}
        </div>

        {/* Rodapé de Ações */}
        <div className="border-t border-line bg-card p-3 sm:p-4 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={salvando}
            className="rounded-xl border border-line px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={() => handleSalvar(false)}
            disabled={salvando}
            className="flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-xs font-black text-accent-fg shadow-lg shadow-emerald-600/20 hover:bg-accent-strong transition-all disabled:opacity-50"
          >
            {salvando ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                Salvando Ajuste...
              </>
            ) : (
              <>
                <Check size={15} />
                Salvar Ajuste do Ponto
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
