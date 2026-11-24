"use client";

// Início dos eventos no modelo do Delivery (pedido do dono, 24/11/2026:
// "deixe do evento rápido e prático como do delivery" e "é visual também").
// Primeiro as ações (novo evento, simular, agenda, funil), depois o "Hoje",
// três números e os próximos eventos em cartões com a data grande. As contas
// estão em app/lib/eventos-inicio.mjs. Valor sem dado sai "—".

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, BookOpen, Calculator, CalendarDays, ChevronRight, Plus, Users } from "lucide-react";
import { useERP } from "../../context/ERPContext";
import { supabase } from "../../lib/supabase";
import { canAccessRoute } from "../../lib/permissions-catalog.mjs";
import { faseDaEtapa, normalizarEtapa, rotuloEtapa } from "../../lib/evento-financeiro.mjs";
import { fmtReais } from "../../lib/valor-percentual.mjs";
import { blocoDaData, inicioDosEventos, pagamentoDoEvento, quandoFalta } from "../../lib/eventos-inicio.mjs";
import { NovoEventoModal } from "./eventos/EventosKanban";

const BASE = "/dashboard/reservas-eventos";
const hojeIso = () => new Date().toLocaleDateString("sv-SE");
const maiuscula = (t) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t);
const tituloDe = (e) => e?.nome || e?.cliente_nome || "Evento sem nome";

export default function InicioEventos() {
  const { unidadeAtiva, sessao } = useERP();
  const router = useRouter();
  const [eventos, setEventos] = useState(null);
  const [erro, setErro] = useState("");
  const [novo, setNovo] = useState(false);
  const hoje = hojeIso();

  useEffect(() => {
    if (!unidadeAtiva) return;
    let vivo = true;
    supabase.from("eventos").select("*").eq("unidade_id", unidadeAtiva).neq("tipo_evento", "especial")
      .order("data_evento", { ascending: true })
      .then(({ data, error }) => {
        if (!vivo) return;
        setErro(error ? `Não foi possível carregar os eventos: ${error.message}` : "");
        setEventos(error ? [] : data || []);
      });
    return () => { vivo = false; };
  }, [unidadeAtiva]);

  const r = useMemo(() => (eventos ? inicioDosEventos(eventos, hoje) : null), [eventos, hoje]);
  const pode = (href) => !sessao?.gerenciado || canAccessRoute(sessao, href);

  const acoes = [
    { rotulo: "Novo evento", detalhe: "Cliente, data e pessoas", icone: Plus, onClick: () => setNovo(true), principal: true },
    { rotulo: "Simular orçamento", detalhe: "Preço por pessoa na hora", icone: Calculator, href: `${BASE}/rapido` },
    { rotulo: "Agenda", detalhe: "Calendário do mês", icone: CalendarDays, href: `${BASE}/agenda` },
    { rotulo: "Funil", detalhe: "Todos os eventos", icone: BookOpen, href: `${BASE}/eventos` },
  ].filter((a) => !a.href || pode(a.href));

  const pessoasHoje = r ? r.hoje.reduce((t, e) => t + (Number(e.capacidade) || 0), 0) : 0;
  const valorHoje = r ? r.hoje.reduce((t, e) => t + (Number(e.valor_contratado) || 0), 0) : 0;

  return (
    <div className="space-y-4">
      {/* Ações primeiro: é o que se veio fazer. */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {acoes.map((a) => {
          const Icone = a.icone;
          const classe = `flex min-h-[96px] flex-col justify-between gap-2 rounded-2xl border p-4 text-left transition ${a.principal ? "border-transparent bg-hf-menu text-white hover:brightness-110" : "border-hf-border bg-hf-surface text-hf-text hover:border-hf-border-strong hover:shadow-sm"}`;
          const miolo = (
            <>
              <span className={`grid h-10 w-10 place-items-center rounded-xl ${a.principal ? "bg-white/15" : "bg-hf-elevated"}`}><Icone size={20} /></span>
              <span>
                <span className="block text-[15px] font-bold leading-tight">{a.rotulo}</span>
                <span className={`block text-xs ${a.principal ? "text-white/75" : "text-hf-muted"}`}>{a.detalhe}</span>
              </span>
            </>
          );
          return a.href
            ? <Link key={a.rotulo} href={a.href} className={classe}>{miolo}</Link>
            : <button key={a.rotulo} type="button" onClick={a.onClick} className={classe}>{miolo}</button>;
        })}
      </div>

      {erro && <p role="alert" className="rounded-xl border border-hf-danger/30 bg-hf-danger/5 px-3 py-2.5 text-sm text-hf-text">{erro}</p>}

      {!r ? (
        <div className="rounded-2xl border border-hf-border bg-hf-surface p-6 text-sm text-hf-muted">Carregando os eventos…</div>
      ) : (
        <>
          {/* Hoje, como no Delivery. */}
          <section className="rounded-2xl border border-hf-border bg-hf-surface p-4 sm:p-5">
            <div className="mb-3">
              <h2 className="text-base font-bold text-hf-text">Hoje</h2>
              <p className="text-xs text-hf-muted">{maiuscula(new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" }))}</p>
            </div>
            <div className="grid grid-cols-3 gap-3 rounded-xl bg-hf-elevated p-3">
              <Numero rotulo="Eventos" valor={String(r.hoje.length)} />
              <Numero rotulo="Pessoas" valor={r.hoje.length ? String(pessoasHoje) : "—"} />
              <Numero rotulo="Valor" valor={valorHoje > 0 ? fmtReais(valorHoje) : "—"} />
            </div>
            {r.hoje.length ? (
              <ul className="mt-2 divide-y divide-hf-border">
                {r.hoje.map((e) => (
                  <li key={e.id} className="flex items-center gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-hf-text">{tituloDe(e)}</p>
                      <p className="text-xs font-medium text-hf-text-2">
                        {[e.hora_inicio && String(e.hora_inicio).slice(0, 5), Number(e.capacidade) > 0 && `${e.capacidade} pessoas`, e.local_evento].filter(Boolean).join(" · ") || rotuloEtapa(normalizarEtapa(e.funil_status))}
                      </p>
                    </div>
                    <Link href={`${BASE}/eventos/${e.id}`} className="inline-flex min-h-[44px] items-center rounded-xl bg-hf-menu px-4 text-sm font-bold text-white hover:brightness-110">Abrir</Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-hf-text-2">Nenhum evento hoje.</p>
            )}
          </section>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Cartao rotulo="Orçamentos em aberto" valor={String(r.abertos.n)}
              nota={r.abertos.valor > 0 ? `${fmtReais(r.abertos.valor)} em proposta${r.abertos.semValor ? ` · ${r.abertos.semValor} sem preço` : ""}` : r.abertos.n ? "ainda sem preço" : "nenhum agora"} />
            <Cartao rotulo="Fechados neste mês" valor={String(r.fechadosMes.n)} nota={r.fechadosMes.valor > 0 ? fmtReais(r.fechadosMes.valor) : "—"} />
            <Cartao rotulo="A receber" valor={r.aReceber === null ? "—" : fmtReais(r.aReceber)} nota={r.aReceber === null ? "nenhum evento fechado com valor" : "dos eventos fechados"} destaque className="col-span-2 sm:col-span-1" />
          </div>

          {r.atrasados > 0 && (
            <Link href={`${BASE}/eventos`} className="flex items-center gap-2 rounded-xl border border-hf-warning/30 bg-hf-warning/5 px-3 py-2.5 text-sm font-semibold text-hf-text">
              <AlertTriangle size={16} className="shrink-0 text-hf-warning" />
              <span className="min-w-0 flex-1">{r.atrasados} evento(s) com a data já passada e a etapa sem atualizar.</span>
              <ChevronRight size={16} className="shrink-0 text-hf-muted" />
            </Link>
          )}

          <section>
            <div className="mb-2 flex items-end justify-between gap-2">
              <h2 className="text-base font-bold text-hf-text">Próximos 30 dias</h2>
              {pode(`${BASE}/agenda`) && <Link href={`${BASE}/agenda`} className="inline-flex min-h-[40px] items-center text-sm font-bold text-hf-text-2 hover:text-hf-text">Ver agenda <ChevronRight size={16} /></Link>}
            </div>
            {r.proximos.length ? (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {r.proximos.map((e) => <CartaoProximo key={e.id} e={e} hoje={hoje} />)}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-hf-border-strong bg-hf-surface/60 p-5 text-sm text-hf-text-2">
                Nenhum evento marcado nos próximos 30 dias.
              </div>
            )}
            {r.maisProximos > 0 && <p className="mt-2 text-xs text-hf-muted">E mais {r.maisProximos} no período. Veja todos no funil.</p>}
          </section>
        </>
      )}

      {novo && (
        <NovoEventoModal onClose={() => setNovo(false)} unidadeAtiva={unidadeAtiva} usuarioId={sessao?.id}
          onSuccess={(id) => { setNovo(false); if (id) router.push(`${BASE}/eventos/${id}`); }} />
      )}
    </div>
  );
}

function Numero({ rotulo, valor }) {
  return (
    <div className="min-w-0 text-center">
      <p className="text-base font-black leading-tight tabular-nums text-hf-text sm:text-xl">{valor}</p>
      <p className="text-xs font-semibold text-hf-muted">{rotulo}</p>
    </div>
  );
}

function Cartao({ rotulo, valor, nota, destaque = false, className = "" }) {
  return (
    <div className={`${className} min-w-0 rounded-2xl border p-4 ${destaque ? "border-hf-accent/30 bg-hf-accent/5" : "border-hf-border bg-hf-surface"}`}>
      <p className="text-[13px] font-medium text-hf-muted">{rotulo}</p>
      <p className="mt-1 truncate text-2xl font-black tabular-nums text-hf-text">{valor}</p>
      {nota && <p className="mt-0.5 truncate text-xs font-medium text-hf-text-2">{nota}</p>}
    </div>
  );
}

function CartaoProximo({ e, hoje }) {
  const b = blocoDaData(String(e.data_evento || "").slice(0, 10));
  const p = pagamentoDoEvento(e);
  const etapa = normalizarEtapa(e.funil_status);
  // Barra de pagamento só para evento fechado: proposta ainda não cobra.
  const fechado = ["fechamento", "confirmados"].includes(faseDaEtapa(e.funil_status).id);
  const pct = p.valor > 0 ? Math.min(100, Math.round((p.recebido / p.valor) * 100)) : 0;
  return (
    <Link href={`${BASE}/eventos/${e.id}`} className="flex gap-3 rounded-2xl border border-hf-border bg-hf-surface p-3 transition hover:border-hf-border-strong hover:shadow-sm">
      {b && (
        <div className="flex w-16 shrink-0 flex-col items-center justify-center rounded-xl bg-hf-menu py-2 text-white">
          <span className="text-[10px] font-bold tracking-wide text-white/70">{b.semana}</span>
          <span className="text-2xl font-black leading-none tabular-nums">{b.dia}</span>
          <span className="text-[11px] font-bold tracking-wide">{b.mes}</span>
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="truncate text-sm font-bold text-hf-text">{tituloDe(e)}</p>
          <span className="shrink-0 text-xs font-bold text-hf-text-2">{quandoFalta(String(e.data_evento).slice(0, 10), hoje)}</span>
        </div>
        {e.cliente_nome && e.nome && <p className="truncate text-xs text-hf-text-2">{e.cliente_nome}</p>}
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs font-semibold">
          <span className="rounded-md bg-hf-accent/10 px-1.5 py-0.5 text-hf-accent">{rotuloEtapa(etapa)}</span>
          {Number(e.capacidade) > 0 && <span className="inline-flex items-center gap-1 rounded-md bg-hf-elevated px-1.5 py-0.5 text-hf-text-2"><Users size={12} /> {e.capacidade}</span>}
          {p.valor > 0 && <span className="ml-auto font-bold tabular-nums text-hf-text">{fmtReais(p.valor)}</span>}
        </div>
        {fechado && p.valor > 0 && (
          <div className="mt-2">
            <div className="h-1.5 overflow-hidden rounded-full bg-hf-elevated" aria-hidden="true"><div className="h-full rounded-full bg-hf-success" style={{ width: `${pct}%` }} /></div>
            <p className="mt-0.5 text-[11px] font-medium text-hf-muted">{p.quitado ? "Pago" : p.recebido > 0 ? `Recebido ${fmtReais(p.recebido)} · falta ${fmtReais(p.falta)}` : "Nada recebido ainda"}</p>
          </div>
        )}
      </div>
    </Link>
  );
}
