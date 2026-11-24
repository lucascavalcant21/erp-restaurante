"use client";

// MOLHOS (pedido do dono, 23/11/2026): as receitas de molho e quanto rende
// cada uma. São bases (fichas técnicas) — o molho é criado e editado em Bases;
// aqui é a lista rápida. Serve para restaurante, delivery e eventos.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, Loader2, Plus, Search } from "lucide-react";
import CabecalhoTela from "../../../components/ui/CabecalhoTela";
import { useERP } from "../../../context/ERPContext";
import { usePermission } from "../../../components/access-control/PermissionGate";
import { supabase, isSupabaseReady } from "../../../lib/supabase";
import { ehMolho, textoRendimento } from "../../../lib/molhos.mjs";

const semAcento = (v) => String(v ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const SETOR = { cozinha: "Restaurante", marmitaria: "Delivery", bar: "Bar" };

export default function Molhos() {
  const { unidadeAtiva } = useERP();
  const podeFichas = usePermission("fichas.recipes.create");
  const podeCozinha = usePermission("cozinha.recipes.create");
  const podeCriar = podeFichas || podeCozinha;
  const [fichas, setFichas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [busca, setBusca] = useState("");

  useEffect(() => {
    let vivo = true;
    if (!isSupabaseReady() || !unidadeAtiva || unidadeAtiva === "todas") { setCarregando(false); return undefined; }
    setCarregando(true);
    supabase.from("fichas_tecnicas")
      .select("id, nome_receita, departamento, categoria, eh_base, ativo, status, rendimento_porcoes, rendimento_unidade, validade_dias")
      .eq("unidade_id", unidadeAtiva).eq("eh_base", true).order("nome_receita")
      .then(({ data, error }) => {
        if (!vivo) return;
        setErro(error?.message || "");
        setFichas((data || []).filter((f) => f.ativo !== false && f.status !== "arquivada" && ehMolho(f)));
        setCarregando(false);
      });
    return () => { vivo = false; };
  }, [unidadeAtiva]);

  const lista = useMemo(() => {
    const q = semAcento(busca).trim();
    return q ? fichas.filter((f) => semAcento(f.nome_receita).includes(q)) : fichas;
  }, [fichas, busca]);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-5 sm:px-6">
      <CabecalhoTela titulo="Molhos" subtitulo="Receitas de molho e quanto rende cada uma" />
      <p className="rounded-2xl bg-hf-elevated px-4 py-3 text-[14px] text-hf-text-2">
        Todo molho é uma <b>base</b>. Aparece aqui a base com “molho”, “caldo”, “vinagrete”… no nome, ou na categoria <b>Molhos</b>.
      </p>
      {podeCriar && (
        <Link href="/dashboard/operacao/fichas?dept=cozinha&modo=bases" className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-hf-menu text-[15px] font-black text-white">
          <Plus size={18} /> Criar molho em Bases
        </Link>
      )}
      {fichas.length > 6 && (
        <label className="flex h-12 items-center gap-2 rounded-full border border-hf-border bg-hf-surface px-4"><Search size={16} className="text-hf-muted" />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Procurar molho" aria-label="Procurar molho" className="min-w-0 flex-1 bg-transparent text-[16px] outline-none" />
        </label>
      )}
      {erro && <p role="alert" className="rounded-2xl bg-hf-elevated px-4 py-2 text-sm font-bold text-hf-danger">Não consegui carregar: {erro}</p>}
      {carregando ? (
        <p className="py-8 text-center font-bold text-hf-text-2"><Loader2 className="mr-2 inline animate-spin" size={18} />Carregando…</p>
      ) : !fichas.length ? (
        <div className="rounded-3xl border border-dashed border-hf-border px-4 py-8 text-center">
          <p className="font-black text-hf-text">Nenhum molho cadastrado ainda.</p>
          <p className="mt-1 text-sm text-hf-muted">Crie a base com “Molho” no nome, por exemplo “Molho de tucupi (base)”.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {lista.map((f) => (
            <li key={f.id}>
              <Link href={`/dashboard/operacao/fichas/${f.id}`} className="flex min-h-[60px] items-center gap-3 rounded-3xl border border-hf-border bg-hf-surface px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[16px] font-black text-hf-text">{f.nome_receita}</p>
                  <p className="text-[13px] text-hf-muted">{SETOR[f.departamento] || f.departamento || ""}{f.validade_dias ? ` · validade ${f.validade_dias} dia(s)` : ""}</p>
                </div>
                <span className={`shrink-0 text-right text-[15px] font-black ${Number(f.rendimento_porcoes) > 0 ? "text-hf-text" : "text-hf-warning"}`}>{textoRendimento(f.rendimento_porcoes, f.rendimento_unidade)}</span>
                <ChevronRight size={18} className="shrink-0 text-hf-muted" />
              </Link>
            </li>
          ))}
          {!lista.length && <li className="py-6 text-center text-sm font-semibold text-hf-muted">Nenhum molho com esse nome.</li>}
        </ul>
      )}
    </div>
  );
}
