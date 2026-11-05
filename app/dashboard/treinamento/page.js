"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, ChevronRight, Clapperboard, GraduationCap, Hourglass, ListChecks, UsersRound } from "lucide-react";
import { useERP } from "../../context/ERPContext";
import { canAccessRoute } from "../../lib/permissions-catalog.mjs";
import { fetchMeuTreinamento } from "../../lib/treinamento";
import { AREAS_TREINAMENTO, STATUS_MATRICULA, mensagemDeErro, progressoDaTrilha, resumirModulo } from "../../lib/treinamento-regras.mjs";
import Boneco from "../../components/treinamento/Boneco";

const ESTADO = {
  novo: { texto: "Começar", cor: "text-hf-text-2" },
  andamento: { texto: "Continuar", cor: "text-hf-accent" },
  prova: { texto: "Fazer a prova", cor: "text-hf-accent" },
  aprovado: { texto: "Aprovado", cor: "text-hf-success" },
  pratos: { texto: "Abrir", cor: "text-hf-accent" },
};

export default function MeuTreinamentoPage() {
  const { sessao } = useERP();
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState("");

  useEffect(() => {
    fetchMeuTreinamento().then((r) => { if (r.error) setErro(mensagemDeErro(r.error)); setDados(r); });
  }, []);

  const limitado = !!sessao?.gerenciado || !!sessao?.is_app;
  const podeEquipe = !!sessao && (!limitado || canAccessRoute(sessao, "/dashboard/treinamento/equipe"));
  const podeEstudio = !!sessao && (!limitado || canAccessRoute(sessao, "/dashboard/treinamento/estudio"));

  const trilhas = useMemo(() => (dados?.matriculas || []).map((matricula) => {
    const trilha = dados.trilhas.find((t) => t.id === matricula.trilha_id);
    const ids = dados.ligacoes.filter((l) => l.trilha_id === matricula.trilha_id).map((l) => l.modulo_id);
    const modulos = ids.map((id) => dados.modulos.find((m) => m.id === id)).filter(Boolean);
    const concluidas = new Set(dados.concluidas.filter((c) => c.matricula_id === matricula.id).map((c) => c.aula_id));
    const tentativas = dados.tentativas.filter((t) => t.matricula_id === matricula.id);
    return { matricula, trilha, modulos, concluidas, tentativas, progresso: progressoDaTrilha(modulos, dados.aulas, concluidas, tentativas) };
  }), [dados]);

  return (
    <div className="mx-auto w-full max-w-4xl space-y-5 px-4 py-5 sm:px-6 sm:py-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-hf-text sm:text-3xl">Meu treinamento</h1>
          <p className="mt-1 text-sm font-medium text-hf-text-2">Aprenda no seu ritmo, com os instrutores do Héfisto.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {podeEquipe && <Link href="/dashboard/treinamento/equipe" className="flex min-h-11 items-center gap-2 rounded-xl border border-hf-border px-3 text-sm font-bold text-hf-text"><UsersRound size={18} /> Equipe</Link>}
          {podeEstudio && <Link href="/dashboard/treinamento/estudio" className="flex min-h-11 items-center gap-2 rounded-xl bg-hf-accent px-3 text-sm font-bold text-hf-accent-fg"><Clapperboard size={18} /> Héfisto Estúdio</Link>}
        </div>
      </header>

      {erro && <p role="alert" className="rounded-xl border border-hf-border bg-hf-elevated p-4 text-sm font-semibold text-hf-text">{erro}</p>}
      {!dados && !erro && <div className="h-44 animate-pulse rounded-2xl bg-hf-elevated" aria-hidden />}

      {dados && !erro && trilhas.length === 0 && (
        <section className="flex flex-col items-center gap-3 rounded-2xl border border-hf-border bg-hf-surface p-6 text-center sm:flex-row sm:text-left">
          <Boneco area="geral" className="h-40 w-32 shrink-0" />
          <div>
            <h2 className="text-lg font-black text-hf-text">Sua trilha ainda não foi liberada</h2>
            <p className="mt-1 text-sm font-medium text-hf-text-2">Fale com o seu líder. Ele escolhe a trilha da sua função e ela aparece aqui.</p>
          </div>
        </section>
      )}

      {trilhas.map(({ matricula, trilha, modulos, concluidas, tentativas, progresso }) => (
        <section key={matricula.id} className="overflow-hidden rounded-2xl border border-hf-border bg-hf-surface shadow-sm">
          <div className="flex flex-wrap items-center gap-4 border-b border-hf-border p-4 sm:p-5">
            <Boneco area={trilha?.area} className="h-24 w-20 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-hf-accent">{AREAS_TREINAMENTO[trilha?.area] || "Treinamento"} · {STATUS_MATRICULA[matricula.status]}</p>
              <h2 className="text-xl font-black text-hf-text">{trilha?.nome}</h2>
              {progresso ? (
                <>
                  <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-hf-elevated" role="progressbar" aria-valuenow={progresso.percentual} aria-valuemin={0} aria-valuemax={100} aria-label="Progresso da trilha"><div className="h-full rounded-full bg-hf-accent" style={{ width: `${progresso.percentual}%` }} /></div>
                  <p className="mt-1 text-xs font-semibold text-hf-text-2">{progresso.aprovados} de {progresso.total} provas aprovadas</p>
                </>
              ) : <p className="mt-1 text-sm font-medium text-hf-text-2">O conteúdo desta trilha está sendo preparado.</p>}
            </div>
          </div>
          {matricula.status === "aguardando_lider" && <p className="flex items-center gap-2 border-b border-hf-border bg-hf-elevated p-3 text-sm font-semibold text-hf-text"><Hourglass size={18} className="shrink-0 text-hf-accent" /> Provas concluídas. Agora o líder vai avaliar você na prática.</p>}
          {matricula.status === "aprovado" && <p className="flex items-center gap-2 border-b border-hf-border bg-hf-elevated p-3 text-sm font-semibold text-hf-text"><CheckCircle2 size={18} className="shrink-0 text-hf-success" /> Treinamento concluído e aprovado pelo líder.</p>}
          <ol>
            {modulos.map((m, i) => {
              const r = resumirModulo(m, dados.aulas, concluidas, tentativas);
              const e = ESTADO[r.estado];
              return (
                <li key={m.id} className="border-b border-hf-border last:border-0">
                  <Link href={`/dashboard/treinamento/modulo/${m.id}?m=${matricula.id}`} className="flex min-h-16 items-center gap-3 p-3 hover:bg-hf-elevated sm:px-5">
                    <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl text-sm font-black ${r.aprovado ? "bg-hf-success/10 text-hf-success" : "bg-hf-elevated text-hf-text"}`}>
                      {r.aprovado ? <CheckCircle2 size={19} aria-hidden /> : m.tipo === "pratos" ? <ListChecks size={18} aria-hidden /> : i + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold text-hf-text sm:text-base">{m.titulo}</span>
                      {r.total > 0 && <span className="block text-xs font-medium text-hf-text-2">{r.feitas} de {r.total} aulas</span>}
                    </span>
                    <span className={`text-xs font-bold ${e.cor}`}>{e.texto}</span>
                    <ChevronRight size={18} className="shrink-0 text-hf-text-2" aria-hidden />
                  </Link>
                </li>
              );
            })}
            {!modulos.length && <li className="flex items-center gap-2 p-4 text-sm font-medium text-hf-text-2"><GraduationCap size={18} aria-hidden /> Nenhum módulo aprovado nesta trilha ainda.</li>}
          </ol>
        </section>
      ))}
    </div>
  );
}
