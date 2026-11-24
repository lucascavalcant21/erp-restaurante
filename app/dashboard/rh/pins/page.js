"use client";

// PIN DO PONTO — o PIN de 4 números de cada funcionário para bater o ponto no
// tablet compartilhado (decisão do dono, 14/11/2026). O PIN vai direto para o
// banco (hefisto_definir_pin) e fica guardado só como hash: nem o dono vê
// depois. A tela só mostra quem já tem PIN.

import { useCallback, useEffect, useState } from "react";
import { Check, KeyRound, Loader2, X } from "lucide-react";
import { useERP } from "../../../context/ERPContext";
import { fetchColaboradores } from "../../../lib/rh";
import { supabase } from "../../../lib/supabase";
import { FundoMedway, RotuloSecao, TituloGrande } from "../../../components/ui/Medway";

function DefinirPin({ colaborador, onFechar, onSalvo }) {
  const [pin, setPin] = useState("");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  async function salvar() {
    setSalvando(true);
    const { data, error } = await supabase.rpc("hefisto_definir_pin", { p_colaborador: colaborador.id, p_pin: pin });
    setSalvando(false);
    if (error) return setErro("Não foi possível salvar agora. O banco de teste já tem o PIN do ponto?");
    if (!data?.ok) return setErro(data?.erro || "Não foi possível salvar.");
    onSalvo();
  }
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 sm:items-center sm:p-4">
      <div role="dialog" aria-modal="true" aria-label={`PIN de ${colaborador.nome}`} className="w-full max-w-sm space-y-4 rounded-t-[26px] bg-mw-card p-6 sm:rounded-[26px]">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[19px] font-semibold text-mw-marinho">PIN de {colaborador.nome.split(" ")[0]}</p>
          <button type="button" onClick={onFechar} aria-label="Fechar" className="grid h-11 w-11 place-items-center rounded-full text-mw-texto shadow-none hover:bg-mw-bg"><X size={20} /></button>
        </div>
        <input
          inputMode="numeric" autoComplete="off" maxLength={4} value={pin}
          onChange={(e) => { setPin(e.target.value.replace(/\D/g, "").slice(0, 4)); setErro(""); }}
          placeholder="4 números"
          className="h-14 w-full rounded-[14px] border border-mw-borda text-center text-[28px] tracking-[0.5em] text-mw-marinho focus:outline-none focus:ring-2 focus:ring-mw-agua"
        />
        <p className="text-[13px] text-mw-sec">Evite 1111, 1234 e datas. Combine o PIN com a pessoa: depois de salvo, ninguém consegue ver.</p>
        {erro && <p className="text-[14px] font-semibold text-hf-danger">{erro}</p>}
        <button type="button" disabled={pin.length !== 4 || salvando} onClick={salvar}
          className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-full bg-mw-marinho text-[17px] font-semibold text-white shadow-none disabled:opacity-50">
          {salvando ? <Loader2 size={18} className="animate-spin" /> : <KeyRound size={18} />} Salvar PIN
        </button>
      </div>
    </div>
  );
}

export default function PinsDoPontoPage() {
  const { unidadeAtiva } = useERP();
  const [lista, setLista] = useState(undefined);
  const [comPin, setComPin] = useState(new Set());
  const [semMigracao, setSemMigracao] = useState(false);
  const [editando, setEditando] = useState(null);

  const carregar = useCallback(async () => {
    if (!unidadeAtiva) return;
    const [rC, rP] = await Promise.all([fetchColaboradores(unidadeAtiva), supabase.rpc("hefisto_tem_pin", { p_unidade: unidadeAtiva })]);
    setLista((rC.data || []).filter((c) => (c.status || "ativo") === "ativo").sort((a, b) => a.nome.localeCompare(b.nome)));
    setSemMigracao(!!rP.error);
    setComPin(new Set(rP.error ? [] : (rP.data || []).map((x) => (typeof x === "string" ? x : Object.values(x)[0]))));
  }, [unidadeAtiva]);
  useEffect(() => { carregar(); }, [carregar]);

  return (
    <FundoMedway>
      <div className="mx-auto w-full max-w-3xl">
        <TituloGrande subtitulo="Cada funcionário bate o ponto no tablet com o próprio PIN de 4 números">PIN do ponto</TituloGrande>
        <div className="space-y-4 px-4 sm:px-6">
          {semMigracao && (
            <p className="rounded-[18px] border border-mw-borda bg-mw-card p-4 text-[15px] text-mw-sec">
              DADOS INSUFICIENTES: o banco ainda não tem o PIN do ponto (migração PONTO-PIN-1). Enquanto isso, o tablet mostra a lista de nomes.
            </p>
          )}
          <RotuloSecao>Equipe ativa</RotuloSecao>
          {lista === undefined ? (
            <p className="flex items-center gap-2 text-mw-sec"><Loader2 size={18} className="animate-spin" /> Carregando…</p>
          ) : lista.length === 0 ? (
            <p className="rounded-[18px] border border-mw-borda bg-mw-card p-4 text-[15px] text-mw-sec">Nenhum funcionário ativo nesta unidade.</p>
          ) : (
            <ul className="divide-y divide-mw-borda overflow-hidden rounded-[18px] border border-mw-borda bg-mw-card">
              {lista.map((c) => (
                <li key={c.id} className="flex min-h-[64px] items-center gap-3 px-4">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[16px] font-medium text-mw-marinho">{c.nome}</span>
                    <span className="block text-[13px] text-mw-sec">{c.cargo || "Sem cargo"}</span>
                  </span>
                  {comPin.has(c.id) && <span className="inline-flex items-center gap-1 rounded-full bg-mw-agua-claro px-2.5 py-1 text-[12px] font-semibold text-mw-agua"><Check size={13} /> PIN definido</span>}
                  <button type="button" disabled={semMigracao} onClick={() => setEditando(c)}
                    className="min-h-[44px] shrink-0 rounded-full bg-mw-suave px-4 text-[14px] font-semibold text-mw-marinho shadow-none disabled:opacity-40">
                    {comPin.has(c.id) ? "Trocar" : "Definir"}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      {editando && <DefinirPin colaborador={editando} onFechar={() => setEditando(null)} onSalvo={() => { setEditando(null); carregar(); }} />}
    </FundoMedway>
  );
}
