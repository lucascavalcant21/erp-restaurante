"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ChevronRight, UserPlus } from "lucide-react";
import { useERP } from "../../../context/ERPContext";
import { fetchEquipe, fetchTrilhas, matricular } from "../../../lib/treinamento";
import { AREAS_TREINAMENTO, STATUS_MATRICULA, mensagemDeErro } from "../../../lib/treinamento-regras.mjs";
import CabecalhoTela from "../../../components/ui/CabecalhoTela";

const CAMPO = "min-h-12 w-full rounded-xl border border-hf-border bg-hf-surface px-3 text-sm font-semibold text-hf-text";

export default function EquipeTreinamentoPage() {
  const { unidadeAtiva } = useERP();
  const [equipe, setEquipe] = useState(null);
  const [trilhas, setTrilhas] = useState([]);
  const [erro, setErro] = useState("");
  const [pessoa, setPessoa] = useState("");
  const [trilha, setTrilha] = useState("");
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    if (!unidadeAtiva || unidadeAtiva === "todas") return;
    const [e, t] = await Promise.all([fetchEquipe(unidadeAtiva), fetchTrilhas(unidadeAtiva)]);
    if (e.error) setErro(mensagemDeErro(e.error));
    setEquipe(e.data || { pessoas: [], matriculas: [] });
    setTrilhas(t.data);
  }, [unidadeAtiva]);
  useEffect(() => { carregar(); }, [carregar]);

  const enviar = async (ev) => {
    ev.preventDefault();
    setSalvando(true); setErro("");
    const r = await matricular(pessoa, trilha);
    setSalvando(false);
    if (r.error) return setErro(mensagemDeErro(r.error));
    setPessoa(""); setTrilha("");
    carregar();
  };
  const grupos = useMemo(() => Object.entries(STATUS_MATRICULA).filter(([k]) => k !== "cancelado").map(([k, rotulo]) => ({ k, rotulo, itens: (equipe?.matriculas || []).filter((m) => m.status === k) })), [equipe]);

  return (
    <div className="mx-auto w-full max-w-4xl space-y-5 px-4 py-5 sm:px-6 sm:py-8">
      <CabecalhoTela embutido voltarPara="/dashboard/treinamento" titulo="Treinamento da equipe" subtitulo="Quem está fazendo cada aula e em que ponto parou" />
      {(!unidadeAtiva || unidadeAtiva === "todas") && <p className="text-sm font-semibold text-hf-text">Escolha uma unidade para ver a equipe.</p>}
      {erro && <p role="alert" className="rounded-xl border border-hf-border bg-hf-elevated p-3 text-sm font-semibold text-hf-text">{erro}</p>}

      <form onSubmit={enviar} className="grid gap-3 rounded-2xl border border-hf-border bg-hf-surface p-4 sm:grid-cols-[1fr_1fr_auto]">
        <label className="text-sm font-bold text-hf-text">Pessoa
          <select required value={pessoa} onChange={(e) => setPessoa(e.target.value)} className={`${CAMPO} mt-1`}>
            <option value="">Escolha</option>
            {(equipe?.pessoas || []).map((p) => <option key={p.id} value={p.id}>{p.nome}{p.cargo ? ` · ${p.cargo}` : ""}</option>)}
          </select>
        </label>
        <label className="text-sm font-bold text-hf-text">Trilha
          <select required value={trilha} onChange={(e) => setTrilha(e.target.value)} className={`${CAMPO} mt-1`}>
            <option value="">Escolha</option>
            {trilhas.map((t) => <option key={t.id} value={t.id}>{AREAS_TREINAMENTO[t.area]}: {t.nome}</option>)}
          </select>
        </label>
        <button disabled={salvando} className="flex min-h-12 items-center justify-center gap-2 self-end rounded-xl bg-hf-accent px-4 text-sm font-black text-hf-accent-fg disabled:opacity-60"><UserPlus size={18} /> Colocar na trilha</button>
      </form>

      {grupos.map(({ k, rotulo, itens }) => itens.length > 0 && (
        <section key={k}>
          <h2 className="mb-2 text-base font-black text-hf-text">{rotulo} ({itens.length})</h2>
          <ul className="space-y-2">
            {itens.map((m) => (
              <li key={m.id}>
                <Link href={`/dashboard/treinamento/equipe/${m.id}`} className="flex min-h-16 items-center gap-3 rounded-xl border border-hf-border bg-hf-surface p-3 hover:border-hf-accent">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-hf-text">{m.nome}</span>
                    <span className="block truncate text-xs font-medium text-hf-text-2">{m.trilha} · {m.provas_feitas} de {m.provas_total} provas · {m.pratica_feita} de {m.pratica_total} na prática</span>
                  </span>
                  <ChevronRight size={18} className="shrink-0 text-hf-text-2" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
      {equipe && !equipe.matriculas.length && !erro && <p className="rounded-xl border border-dashed border-hf-border p-6 text-center text-sm font-medium text-hf-text-2">Ninguém em treinamento ainda.</p>}
    </div>
  );
}
