"use client";

// CONFIGURAÇÕES → ESTOQUE → SEGURANÇA DA CONTAGEM (EST-MOV-1).
// PIN do administrador (guardado só como hash no banco; esta tela nunca lê o
// PIN, só troca com o PIN atual) e contagem cega. Quem pode estornar, ajustar
// e corrigir contagem é definido pelo perfil (Estoque → Segurança do estoque).

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Lock, ShieldCheck, EyeOff, Loader2, Check, AlertTriangle } from "lucide-react";
import { useERP } from "../../../context/ERPContext";
import { lerSeguranca, salvarSeguranca } from "../../../lib/estoque-movimento-dados";
import { unidadeValida } from "../../../lib/contas-pagar.mjs";

const soDigitos = (v) => String(v || "").replace(/\D/g, "").slice(0, 8);

export default function SegurancaEstoquePage() {
  const { unidadeAtiva } = useERP();
  const [st, setSt] = useState(null);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [pin, setPin] = useState({ atual: "", novo: "", confirmacao: "" });
  const [cega, setCega] = useState({ valor: true, pin: "" });
  const [enviando, setEnviando] = useState("");
  const [aviso, setAviso] = useState(null);

  const carregar = useCallback(async () => {
    if (!unidadeValida(unidadeAtiva)) { setCarregando(false); return; }
    const r = await lerSeguranca(unidadeAtiva);
    setSt(r.data); setErro(r.error || ""); setCarregando(false);
    if (r.data) setCega((c) => ({ ...c, valor: r.data.contagem_cega }));
  }, [unidadeAtiva]);
  useEffect(() => { carregar(); }, [carregar]);

  const trocarPin = async (e) => {
    e.preventDefault();
    if (enviando) return;
    setEnviando("pin"); setAviso(null);
    const r = await salvarSeguranca({ unidade_id: unidadeAtiva, pin_atual: pin.atual, pin_novo: pin.novo, pin_confirmacao: pin.confirmacao });
    setEnviando("");
    if (r.error) return setAviso({ tipo: "erro", texto: r.error });
    setPin({ atual: "", novo: "", confirmacao: "" });
    setAviso({ tipo: "ok", texto: "PIN trocado. O PIN antigo deixou de valer." });
    setSt(r.data);
  };
  const salvarCega = async (e) => {
    e.preventDefault();
    if (enviando) return;
    setEnviando("cega"); setAviso(null);
    const r = await salvarSeguranca({ unidade_id: unidadeAtiva, pin_atual: cega.pin, contagem_cega: cega.valor });
    setEnviando("");
    if (r.error) return setAviso({ tipo: "erro", texto: r.error });
    setCega({ valor: r.data.contagem_cega, pin: "" });
    setAviso({ tipo: "ok", texto: r.data.contagem_cega ? "Contagem cega LIGADA: quem conta não vê o saldo do sistema." : "Contagem cega DESLIGADA: quem conta vê o saldo esperado." });
    setSt(r.data);
  };

  const campo = "w-full h-12 px-3 rounded-xl border border-line bg-white font-black tracking-widest";
  if (!unidadeValida(unidadeAtiva)) return <p className="p-8 text-center font-bold text-fg">Selecione uma unidade.</p>;

  return (
    <div className="min-h-screen pb-24 bg-[var(--surface)] text-slate-800">
      <div className="max-w-xl mx-auto px-4 pt-5 space-y-4">
        <Link href="/dashboard/configuracoes" className="inline-flex items-center gap-1 text-sm font-bold text-fg"><ArrowLeft size={16} /> Configurações</Link>
        <div>
          <p className="text-3xs font-black uppercase tracking-widest text-fg">Configurações · Estoque</p>
          <h1 className="text-2xl font-black tracking-tight flex items-center gap-2"><ShieldCheck size={22} className="text-emerald-600" /> Segurança da contagem</h1>
        </div>

        {carregando && <p className="font-bold text-fg">Carregando...</p>}
        {erro && <p className="rounded-2xl border border-amber-300 bg-amber-50 p-3 text-sm font-bold text-amber-900">{erro}</p>}
        {aviso && (
          <div className={`rounded-2xl border p-3 text-sm font-bold flex gap-2 ${aviso.tipo === "ok" ? "border-emerald-300 bg-emerald-50 text-emerald-900" : "border-red-300 bg-red-50 text-red-800"}`}>
            {aviso.tipo === "ok" ? <Check size={18} className="shrink-0" /> : <AlertTriangle size={18} className="shrink-0" />}<span>{aviso.texto}</span>
          </div>
        )}

        {st && (
          <>
            <div className="bg-card rounded-2xl border border-line p-4 text-sm space-y-1">
              <p><b>Contagem cega:</b> {st.contagem_cega ? "ligada (quem conta não vê o saldo do sistema)" : "desligada (quem conta vê o saldo esperado)"}</p>
              <p><b>Você pode estornar e ajustar:</b> {st.pode_autorizar ? "sim, com o PIN" : "não"}</p>
              <p><b>Você pode alterar esta tela:</b> {st.pode_configurar ? "sim, com o PIN atual" : "não"}</p>
              {st.pin_padrao && <p className="font-black text-red-700 flex items-center gap-1"><AlertTriangle size={14} /> O PIN ainda é o inicial (1234). Troque agora.</p>}
              {st.pin_bloqueado_ate && <p className="font-black text-red-700">PIN bloqueado por excesso de tentativas até {new Date(st.pin_bloqueado_ate).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}.</p>}
            </div>

            {!st.pode_configurar && <p className="text-sm font-bold text-fg">Seu perfil não altera a segurança do estoque. Peça ao administrador (permissão Estoque → Segurança do estoque → Alterar configurações).</p>}

            {st.pode_configurar && (
              <form onSubmit={trocarPin} className="bg-card rounded-2xl border border-line p-4 space-y-3">
                <h2 className="font-black flex items-center gap-2"><Lock size={18} /> Trocar o PIN do administrador</h2>
                <p className="text-xs text-fg">De 4 a 8 números. Fica guardado só como código (hash): ninguém consegue ler o PIN no banco. 5 erros seguidos bloqueiam por 15 minutos.</p>
                <input required type="password" inputMode="numeric" autoComplete="off" value={pin.atual} onChange={(e) => setPin({ ...pin, atual: soDigitos(e.target.value) })} placeholder="PIN atual" className={campo} />
                <input required type="password" inputMode="numeric" autoComplete="new-password" value={pin.novo} onChange={(e) => setPin({ ...pin, novo: soDigitos(e.target.value) })} placeholder="PIN novo" className={campo} />
                <input required type="password" inputMode="numeric" autoComplete="new-password" value={pin.confirmacao} onChange={(e) => setPin({ ...pin, confirmacao: soDigitos(e.target.value) })} placeholder="Repita o PIN novo" className={campo} />
                <button disabled={!!enviando} className="w-full h-12 rounded-2xl bg-emerald-500 text-white font-black disabled:opacity-60 flex items-center justify-center gap-2">
                  {enviando === "pin" ? <><Loader2 size={18} className="animate-spin" /> Trocando...</> : "Trocar PIN"}
                </button>
              </form>
            )}

            {st.pode_configurar && (
              <form onSubmit={salvarCega} className="bg-card rounded-2xl border border-line p-4 space-y-3">
                <h2 className="font-black flex items-center gap-2"><EyeOff size={18} /> Contagem cega</h2>
                <p className="text-xs text-fg">Ligada: na tela de contagem, quem conta não vê o saldo do sistema nem a divergência (só o administrador vê). Assim a contagem não é “puxada” pelo número esperado.</p>
                <div className="grid grid-cols-2 gap-2">
                  {[[true, "Ligada"], [false, "Desligada"]].map(([v, r]) => (
                    <button key={r} type="button" onClick={() => setCega({ ...cega, valor: v })}
                      className={`h-12 rounded-xl font-black border ${cega.valor === v ? "bg-slate-900 text-white border-slate-900" : "bg-white border-line"}`}>{r}</button>
                  ))}
                </div>
                <input required type="password" inputMode="numeric" autoComplete="off" value={cega.pin} onChange={(e) => setCega({ ...cega, pin: soDigitos(e.target.value) })} placeholder="PIN atual para confirmar" className={campo} />
                <button disabled={!!enviando || cega.valor === st.contagem_cega} className="w-full h-12 rounded-2xl bg-emerald-500 text-white font-black disabled:opacity-40 flex items-center justify-center gap-2">
                  {enviando === "cega" ? <><Loader2 size={18} className="animate-spin" /> Salvando...</> : "Salvar"}
                </button>
              </form>
            )}

            <div className="bg-card rounded-2xl border border-line p-4 text-xs text-fg space-y-1">
              <p className="font-black text-sm text-slate-800">Como funciona</p>
              <p>Funcionário lança entrada e retirada; depois de confirmado, não edita, não apaga e não zera.</p>
              <p>Correção é por <b>estorno</b>: o lançamento original fica e entra o contrário, com quem autorizou e o motivo.</p>
              <p>Estornar, ajustar o estoque pelo inventário e corrigir produto já contado exigem a permissão <b>Estoque → Segurança do estoque → Aprovar</b> e o PIN. O banco confere as duas coisas, mesmo se alguém chamar o sistema por fora da tela.</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
