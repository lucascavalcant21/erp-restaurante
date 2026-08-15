"use client";

// Sino do topo: avisa quando alguém se cadastra pelos portais públicos
// (banco de extras e vagas). Só conta o que ainda está como "novo".

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Bell, UserPlus, Briefcase } from "lucide-react";
import { useERP } from "../context/ERPContext";
import { supabase, isSupabaseReady } from "../lib/supabase";

const quando = (iso) => {
  if (!iso) return "";
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  return `há ${Math.floor(h / 24)} dia(s)`;
};

export default function SinoCadastros() {
  const router = useRouter();
  const { unidadeAtiva } = useERP();
  const [aberto, setAberto] = useState(false);
  const [extras, setExtras] = useState([]);
  const [candidatos, setCandidatos] = useState([]);
  const caixaRef = useRef(null);

  const carregar = async () => {
    if (!isSupabaseReady() || !unidadeAtiva || unidadeAtiva === "todas") return;
    // Cada consulta é independente: se a tabela de extras ainda não existir,
    // as candidaturas continuam aparecendo.
    try {
      const { data } = await supabase.from("extras_cadastros")
        .select("id, nome, funcao_principal, interesse, created_at")
        .eq("unidade_id", String(unidadeAtiva)).eq("status", "novo")
        .order("created_at", { ascending: false }).limit(15);
      setExtras(data || []);
    } catch { /* tabela ainda não criada */ }
    try {
      const { data } = await supabase.from("candidatos")
        .select("id, nome, cargo_pretendido, created_at")
        .eq("unidade_id", unidadeAtiva).eq("status", "Novo")
        .order("created_at", { ascending: false }).limit(15);
      setCandidatos(data || []);
    } catch { /* sem acesso */ }
  };

  useEffect(() => {
    carregar();
    const t = setInterval(carregar, 60000); // atualiza sozinho a cada minuto
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unidadeAtiva]);

  useEffect(() => {
    const fora = (e) => { if (caixaRef.current && !caixaRef.current.contains(e.target)) setAberto(false); };
    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  }, []);

  const total = extras.length + candidatos.length;

  return (
    <div className="relative" ref={caixaRef}>
      <button onClick={() => { setAberto(a => !a); if (!aberto) carregar(); }}
        aria-label={`Notificações${total ? ` (${total} novas)` : ""}`}
        className="relative flex h-11 w-11 items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700">
        <Bell size={20} />
        {total > 0 && (
          <span className="absolute right-1.5 top-1.5 grid min-w-[18px] place-items-center rounded-full bg-emerald-600 px-1 text-[10px] font-black text-white">
            {total > 99 ? "99+" : total}
          </span>
        )}
      </button>

      {aberto && (
        <div className="absolute right-0 top-full z-50 mt-2 w-[min(22rem,calc(100vw-1rem))] overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-xl animate-in fade-in zoom-in-95 origin-top-right">
          <div className="border-b border-slate-100 px-4 py-3">
            <p className="text-sm font-black text-slate-900">Novos cadastros</p>
            <p className="text-[11px] font-bold text-slate-400">{total ? `${total} aguardando você` : "Nada novo por enquanto"}</p>
          </div>

          <div className="max-h-[min(24rem,60vh)] overflow-y-auto">
            {extras.map(e => (
              <button key={`e-${e.id}`} onClick={() => { setAberto(false); router.push("/dashboard/rh/extra"); }}
                className="flex w-full items-start gap-3 border-b border-slate-50 px-4 py-3 text-left hover:bg-slate-50">
                <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><UserPlus size={17} /></span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-black text-slate-800">{e.nome}</span>
                  <span className="block truncate text-[12px] font-bold text-slate-500">
                    Extra · {e.funcao_principal}{e.interesse !== "extra" ? " · quer CLT" : ""}
                  </span>
                  <span className="block text-[11px] font-medium text-slate-400">{quando(e.created_at)}</span>
                </span>
              </button>
            ))}
            {candidatos.map(c => (
              <button key={`c-${c.id}`} onClick={() => { setAberto(false); router.push("/dashboard/rh/recrutamento"); }}
                className="flex w-full items-start gap-3 border-b border-slate-50 px-4 py-3 text-left hover:bg-slate-50">
                <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><Briefcase size={17} /></span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-black text-slate-800">{c.nome}</span>
                  <span className="block truncate text-[12px] font-bold text-slate-500">Candidatura · {c.cargo_pretendido || "vaga"}</span>
                  <span className="block text-[11px] font-medium text-slate-400">{quando(c.created_at)}</span>
                </span>
              </button>
            ))}
            {!total && <p className="px-4 py-8 text-center text-sm font-bold text-slate-400">Quando alguém se cadastrar pelos portais, aparece aqui.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
