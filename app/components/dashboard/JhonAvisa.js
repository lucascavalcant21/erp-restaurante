"use client";

// "O Jhon avisa": o que precisa do dono agora (ponto, checklists, produção,
// não conformidades). O Jhon nunca muda nada sozinho: em ponto ele pergunta
// qual horário vale, e o dono escolhe. O ajuste vai pelo caminho oficial
// (marcação de ajuste no livro, com autor e motivo; a original fica).

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Check, Clock3, Loader2, Lock, MessageCircle, X } from "lucide-react";
import { useERP } from "../../context/ERPContext";
import { useTempoReal } from "../../lib/realtime";
import { carregarAvisosDoJhon, aprovarAjusteDoJhon } from "../../lib/avisos-do-jhon-dados";
import { dataSP, semDispensados } from "../../lib/avisos-do-jhon.mjs";
import { RotuloSecao } from "../ui/Medway";

const CHAVE_DISPENSADOS = "hefisto:jhon:dispensados";

function lerDispensados() {
  try {
    const salvo = JSON.parse(localStorage.getItem(CHAVE_DISPENSADOS) || "{}");
    return salvo.dia === dataSP(new Date()) ? salvo.chaves || [] : [];
  } catch { return []; }
}
function gravarDispensados(chaves) {
  try { localStorage.setItem(CHAVE_DISPENSADOS, JSON.stringify({ dia: dataSP(new Date()), chaves })); } catch { /* sem storage: só nesta tela */ }
}

function AjusteDePonto({ aviso, onFeito }) {
  const { unidadeAtiva, sessao } = useERP();
  const acao = aviso.acao;
  const [escolha, setEscolha] = useState(null); // "sugerida" | "outro"
  const [hora, setHora] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const quem = sessao?.nome || sessao?.email || "";

  const horaFinal = escolha === "sugerida" ? acao.horaSugerida : hora;

  async function confirmar() {
    setSalvando(true); setErro("");
    const r = await aprovarAjusteDoJhon({ unidadeId: unidadeAtiva, acao, escolha, horaDigitada: hora, quemAprovou: quem });
    setSalvando(false);
    if (r?.error) { setErro(r.error); return; }
    onFeito(r?.nadaAGravar ? "Nada mudou: o horário já era esse." : `Ponto ajustado para ${horaFinal}. A batida original continua guardada.`);
  }

  if (escolha) {
    return (
      <div className="mt-3 space-y-3 rounded-[16px] bg-mw-suave p-3">
        {escolha === "outro" && (
          <label className="block text-[15px] text-mw-texto">
            Horário certo da {acao.rotuloBatida}
            <input type="time" value={hora} onChange={(e) => setHora(e.target.value)}
              className="mt-1 block min-h-[48px] w-full rounded-[12px] border border-mw-borda bg-white px-3 text-[18px] text-mw-marinho" />
          </label>
        )}
        <p className="text-[15px] text-mw-texto">
          {acao.horaRegistrada ? <>Trocar <b>{acao.horaRegistrada}</b> por <b>{horaFinal || "--:--"}</b></> : <>Registrar <b>{horaFinal || "--:--"}</b></>}
          {" "}na {acao.rotuloBatida} de {acao.colaboradorNome?.split(" ")[0]}. Fica gravado em seu nome.
        </p>
        {erro && <p className="text-[14px] text-hf-danger">{erro}</p>}
        <div className="flex gap-2">
          <button type="button" onClick={() => { setEscolha(null); setErro(""); }}
            className="min-h-[48px] flex-1 rounded-full bg-white text-[16px] font-semibold text-mw-marinho shadow-none">Voltar</button>
          <button type="button" disabled={salvando || !horaFinal} onClick={confirmar}
            className="min-h-[48px] flex-1 rounded-full bg-mw-marinho text-[16px] font-semibold text-white shadow-none disabled:opacity-50">
            {salvando ? "Gravando…" : "Aprovar ajuste"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {acao.horaRegistrada && (
        <button type="button" onClick={() => onFeito(`Mantido ${acao.horaRegistrada}.`, true)}
          className="min-h-[44px] rounded-full border border-mw-borda bg-white px-4 text-[15px] font-semibold text-mw-marinho shadow-none">
          Manter {acao.horaRegistrada}
        </button>
      )}
      {acao.horaSugerida && (
        <button type="button" onClick={() => setEscolha("sugerida")}
          className="min-h-[44px] rounded-full bg-mw-marinho px-4 text-[15px] font-semibold text-white shadow-none">
          Usar {acao.horaSugerida} (escala)
        </button>
      )}
      <button type="button" onClick={() => setEscolha("outro")}
        className="min-h-[44px] rounded-full border border-mw-borda bg-white px-4 text-[15px] font-semibold text-mw-marinho shadow-none">
        Outro horário
      </button>
    </div>
  );
}

function CartaoAviso({ aviso, onDispensar, onFeito }) {
  const critico = aviso.gravidade === "critico";
  const Icone = aviso.origem === "ponto" ? Clock3 : AlertTriangle;
  return (
    <li className="rounded-[20px] border border-mw-borda bg-mw-card p-4">
      <div className="flex items-start gap-3">
        <span className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${critico ? "bg-hf-danger/10 text-hf-danger" : "bg-mw-agua-claro text-mw-agua"}`}>
          <Icone size={20} strokeWidth={1.8} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[16px] font-semibold text-mw-marinho">{aviso.titulo}</p>
          <p className="mt-0.5 text-[14px] text-mw-sec">{aviso.detalhe}</p>
        </div>
        <button type="button" onClick={() => onDispensar(aviso.chave)} aria-label="Dispensar aviso"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-mw-sec shadow-none">
          <X size={18} aria-hidden="true" />
        </button>
      </div>

      {aviso.acao?.tipo === "ajustar_ponto" ? (
        <AjusteDePonto aviso={aviso} onFeito={(msg) => onFeito(aviso.chave, msg)} />
      ) : null}

      {aviso.whatsapp && (
        <a href={aviso.whatsapp} target="_blank" rel="noopener noreferrer"
          className="mt-3 inline-flex min-h-[44px] items-center gap-2 rounded-full border border-mw-borda px-4 text-[15px] font-semibold text-mw-marinho">
          <MessageCircle size={18} aria-hidden="true" /> {aviso.acao?.tipo === "ajustar_ponto" ? "Perguntar no WhatsApp" : "Avisar no WhatsApp"}
        </a>
      )}
    </li>
  );
}

export default function JhonAvisa({ liberado = true, linkTrancado = "/dashboard/assinar" }) {
  const { unidadeAtiva } = useERP();
  const [resultado, setResultado] = useState(undefined);
  const [dispensados, setDispensados] = useState([]);
  const [feito, setFeito] = useState("");

  const carregar = useCallback(async () => {
    if (!liberado || !unidadeAtiva) return;
    setResultado(await carregarAvisosDoJhon(unidadeAtiva, new Date()));
  }, [unidadeAtiva, liberado]);

  useEffect(() => { setDispensados(lerDispensados()); }, []);
  useEffect(() => { carregar(); }, [carregar]);
  // Batida nova ou checklist concluído: o aviso some sozinho.
  useTempoReal(liberado ? ["registro_ponto", "op_execucoes", "op_nao_conformidades"] : [], () => carregar());
  // O relógio também muda os avisos (atraso nasce com o tempo).
  useEffect(() => {
    if (!liberado) return undefined;
    const t = setInterval(carregar, 5 * 60 * 1000);
    return () => clearInterval(t);
  }, [carregar, liberado]);

  const visiveis = useMemo(() => semDispensados(resultado?.avisos, dispensados), [resultado, dispensados]);

  const dispensar = (chave) => {
    const novos = [...new Set([...dispensados, chave])];
    setDispensados(novos);
    gravarDispensados(novos);
  };

  if (!liberado) {
    return (
      <section className="space-y-3">
        <RotuloSecao>O Jhon avisa</RotuloSecao>
        <Link href={linkTrancado} className="flex items-center gap-3 rounded-[20px] border border-mw-borda bg-mw-card p-4">
          <Lock size={20} className="text-mw-sec" aria-hidden="true" />
          <span className="text-[15px] text-mw-texto">Atrasos, ponto errado e checklists atrasados chegam aqui no plano Completo.</span>
        </Link>
      </section>
    );
  }

  return (
    <section aria-live="polite" className="space-y-3">
      <RotuloSecao>O Jhon avisa</RotuloSecao>
      {feito && (
        <p className="flex items-center gap-2 rounded-[16px] bg-mw-agua-claro px-4 py-3 text-[15px] text-mw-marinho">
          <Check size={18} aria-hidden="true" /> {feito}
        </p>
      )}
      {resultado === undefined ? (
        <p className="flex items-center gap-2 text-[15px] text-mw-sec"><Loader2 size={18} className="animate-spin" aria-hidden="true" /> O Jhon está conferindo…</p>
      ) : visiveis.length === 0 ? (
        <p className="rounded-[20px] border border-mw-borda bg-mw-card p-4 text-[15px] text-mw-texto">
          Nada para você agora no que o Jhon consegue ver.
        </p>
      ) : (
        <ul className="space-y-3">
          {visiveis.map((a) => (
            <CartaoAviso key={a.chave} aviso={a} onDispensar={dispensar}
              onFeito={(chave, msg) => { setFeito(msg); dispensar(chave); carregar(); }} />
          ))}
        </ul>
      )}
      {resultado?.fontesSemDado?.length > 0 && (
        <details className="text-[14px] text-mw-sec">
          <summary className="min-h-[44px] cursor-pointer py-2">O que o Jhon ainda não vê ({resultado.fontesSemDado.length})</summary>
          <ul className="mt-1 space-y-1">
            {resultado.fontesSemDado.map((f) => (
              <li key={f.fonte}><b className="font-medium text-mw-texto">{f.fonte}:</b> DADOS INSUFICIENTES — {f.motivo}.</li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
