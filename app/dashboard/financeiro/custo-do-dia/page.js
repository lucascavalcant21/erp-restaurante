"use client";

// CUSTO POR DIA (pedido do dono, 28/11/2026): "Quanto é que eu gasto por dia de
// aluguel? De luz? Com um funcionário? Na equipe da manhã? De água? Quanto é
// que eu preciso vender por dia para me pagar todos esses custos? É isso que
// eu quero enxergar." E o simulador: "vendi X, o sistema mostra o que consegui
// pagar no dia, qual meu custo diário antes do lucro, se faltou ou se já estou
// no lucro".
//
// As contas vêm de custo-do-dia.mjs (testado). Os valores das contas da casa
// são os mesmos que a Pizza do Lucro grava; a equipe contratada vem do RH.
// Dono, 28/11/2026: um canal por vez no topo (salão/balcão ou cada app do
// Delivery) e extra só como custo da noite, pelo recibo gerado.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, ChevronDown, CircleAlert, CircleDashed, Loader2 } from "lucide-react";
import CabecalhoTela from "../../../components/ui/CabecalhoTela";
import CampoDecimal from "../../../components/CampoDecimal";
import { useERP } from "../../../context/ERPContext";
import { fetchParamsDaCasa, PARAMS_PADRAO } from "../../../lib/parametros";
import { fetchColaboradores, fetchRecibosPrestacaoUnidade } from "../../../lib/rh";
import { custoDoDia, oQueAVendaPagou, extrasDoDia } from "../../../lib/custo-do-dia.mjs";
import { regrasDoCanalDelivery } from "../../../lib/financeiro/motor/canais.mjs";
import { supabase, isSupabaseReady } from "../../../lib/supabase";

const brl = (v) => (v == null || !Number.isFinite(Number(v)) ? "—" : Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));
const brlC = (c) => brl((Number(c) || 0) / 100);
const pct = (v) => `${Number(v || 0).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

function Linha({ rotulo, detalhe, dia, mes, forte }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2">
      <div className="min-w-0">
        <p className={`truncate text-sm ${forte ? "font-semibold text-hf-text" : "text-hf-text"}`}>{rotulo}</p>
        {detalhe ? <p className="truncate text-xs text-hf-muted">{detalhe}</p> : null}
      </div>
      <div className="shrink-0 text-right">
        <p className={`text-sm tabular-nums ${forte ? "font-bold text-hf-text" : "font-semibold text-hf-text"}`}>{dia == null ? "—" : `${brl(dia)}/dia`}</p>
        {mes != null ? <p className="text-xs tabular-nums text-hf-muted">{brl(mes)} no mês</p> : null}
      </div>
    </div>
  );
}

function Turno({ t, aberto, alternar }) {
  const n = t.fixos.length;
  return (
    <div className="rounded-xl border border-hf-border bg-hf-surface">
      <button type="button" onClick={alternar} aria-expanded={aberto}
        className="flex min-h-[52px] w-full items-center justify-between gap-3 px-3 text-left">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-hf-text">{t.rotulo}</p>
          <p className="text-xs text-hf-muted">{n} {n === 1 ? "pessoa" : "pessoas"} · {t.ajuda}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <p className="text-sm font-bold tabular-nums text-hf-text">{t.fixoDia == null ? "—" : `${brl(t.fixoDia)}/dia`}</p>
          <ChevronDown size={18} className={`text-hf-muted transition ${aberto ? "rotate-180" : ""}`} />
        </div>
      </button>
      {aberto ? (
        <div className="divide-y divide-hf-border border-t border-hf-border px-3">
          {t.fixos.map((p) => <Linha key={p.id} rotulo={p.nome} detalhe={p.cargo || "Contratado"} dia={p.dia} mes={p.mes} />)}
        </div>
      ) : null}
    </div>
  );
}

const hojeISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const lerTicket = (id) => { try { return localStorage.getItem(`hf_ticket_${id}`) || ""; } catch { return ""; } };
const gravarTicket = (id, v) => { try { localStorage.setItem(`hf_ticket_${id}`, v); } catch { /* sem armazenamento: fica só na tela */ } };

const ICONE = { pago: CheckCircle2, parcial: CircleDashed, falta: CircleAlert };
const COR = { pago: "text-hf-success", parcial: "text-hf-warning", falta: "text-hf-danger" };

export default function CustoDoDiaPage() {
  const { unidadeAtiva } = useERP();
  const [params, setParams] = useState(PARAMS_PADRAO);
  const [equipe, setEquipe] = useState([]);
  const [recibos, setRecibos] = useState([]);
  const [ticket, setTicket] = useState("");
  const [apps, setApps] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [aberto, setAberto] = useState({});
  const [venda, setVenda] = useState("");
  const [canalId, setCanalId] = useState("salao");

  useEffect(() => {
    if (!unidadeAtiva || unidadeAtiva === "todas") { setCarregando(false); return; }
    let vivo = true;
    setCarregando(true);
    Promise.all([fetchParamsDaCasa(unidadeAtiva), fetchColaboradores(unidadeAtiva), fetchRecibosPrestacaoUnidade(unidadeAtiva)])
      .then(([rP, rE, rR]) => {
        if (!vivo) return;
        setParams({ ...PARAMS_PADRAO, ...(rP.data || {}) });
        setEquipe(rE.data || []);
        setRecibos(rR.data || []);
        setErro(rP.error || rE.error || "");
      })
      .catch(() => vivo && setErro("Não deu para carregar os custos agora."))
      .finally(() => vivo && setCarregando(false));
    return () => { vivo = false; };
  }, [unidadeAtiva]);

  // Apps do Delivery, para simular "vendi no 99": a config desta unidade ou a
  // da primeira unidade que tiver apps configurados.
  useEffect(() => {
    if (!isSupabaseReady() || !unidadeAtiva) return;
    supabase.from("marmitaria_configuracoes").select("unidade_id, canais, tributos_pct").then(({ data }) => {
      const linhas = (data || []).filter((l) => Array.isArray(l.canais) && l.canais.length);
      const cfg = linhas.find((l) => l.unidade_id === unidadeAtiva) || linhas[0];
      if (!cfg) return;
      setApps(cfg.canais
        .filter((c) => c && (c.ativo !== false || (c.comissao_pct !== null && c.comissao_pct !== undefined && c.comissao_pct !== "")))
        .map((c) => regrasDoCanalDelivery(c, Number(cfg.tributos_pct) || 0)));
    });
  }, [unidadeAtiva]);

  const canal = canalId === "salao" ? null : apps.find((a) => String(a.id) === canalId) || null;
  useEffect(() => { setTicket(lerTicket(canalId)); }, [canalId]);
  const extras = useMemo(() => extrasDoDia(recibos, equipe, hojeISO()), [recibos, equipe]);
  const r = useMemo(() => custoDoDia({ params, colaboradores: equipe, extrasHoje: extras.total, canal, ticketMedio: Number(ticket) || 0 }),
    [params, equipe, extras.total, canal, ticket]);
  const sim = useMemo(() => oQueAVendaPagou({ venda: Number(venda) || 0, sobraPct: r.descontos.sobraPct, linhas: r.linhasHoje }), [venda, r]);
  const daCasa = r.linhas.filter((l) => l.grupo === "casa");
  const proLabore = r.linhas.filter((l) => l.grupo === "prolabore");
  const temBalcao = apps.some((a) => /balc/i.test(a.nome || ""));
  const onde = canal ? `no ${canal.nome}` : temBalcao ? "no salão" : "no salão e balcão";

  if (!unidadeAtiva || unidadeAtiva === "todas") {
    return (
      <div className="mx-auto max-w-3xl px-4 py-6">
        <CabecalhoTela titulo="Custo por dia" subtitulo="Escolha uma unidade no topo para ver o custo dela." />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 pb-28 pt-4 sm:px-6">
      <CabecalhoTela titulo="Custo por dia" subtitulo="Quanto cada conta, cada pessoa e cada equipe custa por dia que a casa abre." />

      {carregando ? (
        <div className="grid place-items-center py-16 text-hf-muted"><Loader2 className="animate-spin" size={24} /></div>
      ) : (
        <>
          {erro ? <p className="rounded-xl border border-hf-warning/40 bg-hf-warning/10 p-3 text-sm text-hf-text">{erro}</p> : null}

          {/* Um canal por vez: cada um tem as suas taxas. */}
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
            {[{ id: "salao", nome: temBalcao ? "Salão" : "Salão e balcão" }, ...apps].map((a) => (
              <button key={a.id} type="button" onClick={() => setCanalId(String(a.id))}
                className={`min-h-[44px] shrink-0 rounded-full px-4 text-sm font-semibold ${canalId === String(a.id) ? "bg-hf-menu text-white" : "border border-hf-border bg-hf-surface text-hf-text"}`}>
                {a.nome}
              </button>
            ))}
          </div>
          {canal && (r.descontos.fixosPorPedido > 0 || ticket) ? (
            <label className="flex items-center justify-between gap-3 rounded-xl border border-hf-border bg-hf-surface p-3">
              <span className="min-w-0 text-sm text-hf-text">
                Pedido médio no {canal.nome}
                <span className="block text-xs text-hf-muted">O {canal.nome} cobra {brl(r.descontos.fixosPorPedido)} fixos por pedido. Com o pedido médio isso vira % da venda.</span>
              </span>
              <CampoDecimal value={ticket} onChange={(e) => { setTicket(e.target.value); gravarTicket(canalId, e.target.value); }} placeholder="0,00"
                className="min-h-[48px] w-28 shrink-0 rounded-xl border border-hf-border bg-hf-bg px-3 text-right text-base tabular-nums text-hf-text" />
            </label>
          ) : null}

          {/* A resposta primeiro: quanto vender e quanto custa abrir. */}
          <section className="rounded-2xl bg-hf-menu p-4 text-white">
            <p className="text-sm text-white/70">Para pagar tudo vendendo só {onde}, você precisa vender por dia</p>
            <p className="mt-1 text-3xl font-bold tabular-nums">{r.vendaMinimaDia != null ? brl(r.vendaMinimaDia) : "DADOS INSUFICIENTES"}</p>
            {r.vendaMinimaDia != null ? (
              <p className="mt-1 text-xs text-white/70">{brl(r.vendaMinimaMes)} no mês · {r.dias} dias de operação · ESTIMATIVA</p>
            ) : <p className="mt-1 text-xs text-white/80">{r.motivo}</p>}
            {r.extrasHoje > 0 && r.vendaMinimaHoje != null ? (
              <p className="mt-1 text-xs text-white/90">Hoje, com {brl(r.extrasHoje)} de extras: {brl(r.vendaMinimaHoje)}</p>
            ) : null}
            <div className="mt-4 grid grid-cols-2 gap-3 border-t border-white/15 pt-3">
              <div>
                <p className="text-xs text-white/70">Custo do dia, antes do lucro</p>
                <p className="text-lg font-bold tabular-nums">{r.totalDia != null ? brl(r.totalDia) : "—"}</p>
              </div>
              <div>
                <p className="text-xs text-white/70">De cada R$ 100 vendidos sobram</p>
                <p className="text-lg font-bold tabular-nums">{r.descontos.sobraPct > 0 ? brl(r.descontos.sobraPct) : "R$ 0,00"}</p>
              </div>
            </div>
            <p className="mt-2 text-xs text-white/70">
              Saem antes {pct(r.descontos.pct)}: {r.descontos.partes.map((p) => `${canal ? p.rotulo.replace(` (${canal.nome})`, "") : p.rotulo} ${pct(p.pct)}`).join(" · ") || "nenhum desconto cadastrado"}.
              {!r.descontos.temMetaCmv ? " Sem meta de CMV: a conta fica otimista." : ""}
              {r.descontos.fixosSemTicket ? ` Faltam os ${brl(r.descontos.fixosPorPedido)} fixos por pedido: informe o pedido médio acima.` : ""}
            </p>
          </section>

          {/* Equipe por turno. */}
          <section className="space-y-2">
            <div className="flex items-baseline justify-between">
              <h2 className="text-[13px] font-medium text-hf-muted">Equipe contratada</h2>
              <p className="text-sm font-semibold tabular-nums text-hf-text">{r.equipe.fixoDia != null ? `${brl(r.equipe.fixoDia)}/dia` : "—"}</p>
            </div>
            {r.equipe.turnos.length ? r.equipe.turnos.map((t) => (
              <Turno key={t.id} t={t} aberto={!!aberto[t.id]} alternar={() => setAberto((a) => ({ ...a, [t.id]: !a[t.id] }))} />
            )) : <p className="rounded-xl border border-hf-border bg-hf-surface p-3 text-sm text-hf-muted">DADOS INSUFICIENTES: nenhum funcionário ativo com salário no RH.</p>}
            {r.equipe.semSalario.length ? (
              <p className="rounded-xl border border-hf-warning/40 bg-hf-warning/10 p-3 text-xs text-hf-text">
                {r.equipe.semSalario.length} {r.equipe.semSalario.length === 1 ? "pessoa contratada está" : "pessoas contratadas estão"} sem salário no RH e não {r.equipe.semSalario.length === 1 ? "entra" : "entram"} na conta: {r.equipe.semSalario.map((p) => p.nome).join(", ")}.{" "}
                <Link href="/dashboard/rh/equipe" className="font-semibold underline">Completar no RH</Link>
              </p>
            ) : null}
            <p className="text-xs text-hf-muted">Contrato definitivo ou provisório, pelo horário de entrada no RH: salário + vale + taxa de serviço{Number(params.encargos_folha_pct) > 0 ? ` + ${pct(params.encargos_folha_pct)} de encargos` : ""} ÷ {r.dias || "?"} dias.</p>
          </section>

          {/* Extras: só o recibo da noite. */}
          <section className="rounded-2xl border border-hf-border bg-hf-surface px-3">
            <div className="flex items-baseline justify-between border-b border-hf-border py-3">
              <h2 className="text-[13px] font-medium text-hf-muted">Extras desta noite</h2>
              <p className="text-sm font-semibold tabular-nums text-hf-text">{brl(extras.total)}</p>
            </div>
            {extras.recibos.length ? (
              <div className="divide-y divide-hf-border">
                {extras.recibos.map((x) => (
                  <div key={x.id} className="flex items-baseline justify-between gap-3 py-2">
                    <p className="min-w-0 truncate text-sm text-hf-text">{x.nome}</p>
                    <p className="shrink-0 text-sm font-semibold tabular-nums text-hf-text">{brl(x.valor)} <span className="text-xs font-normal text-hf-muted">{x.pago ? "pago" : "a pagar"}</span></p>
                  </div>
                ))}
              </div>
            ) : <p className="py-3 text-sm text-hf-muted">Nenhum recibo de extra hoje. O custo do extra aparece quando você gera o recibo dele.</p>}
            <p className="border-t border-hf-border py-2 text-xs text-hf-muted">
              {extras.mesRecibos ? `No mês: ${brl(extras.mesTotal)} em ${extras.mesRecibos} ${extras.mesRecibos === 1 ? "recibo" : "recibos"}. ` : ""}
              {r.equipe.pessoasExtras ? `${r.equipe.pessoasExtras} ${r.equipe.pessoasExtras === 1 ? "extra cadastrado; não entra" : "extras cadastrados; não entram"} no custo fixo. ` : ""}
              <Link href="/dashboard/rh/extra" className="font-semibold text-hf-text underline">Gerar recibo</Link>
            </p>
          </section>

          {/* Contas da casa. */}
          <section className="rounded-2xl border border-hf-border bg-hf-surface px-3">
            <div className="flex items-baseline justify-between border-b border-hf-border py-3">
              <h2 className="text-[13px] font-medium text-hf-muted">Contas da casa</h2>
              <p className="text-sm font-semibold tabular-nums text-hf-text">{r.temDias ? `${brl(r.contas.totalMes / r.dias)}/dia` : "—"}</p>
            </div>
            {daCasa.length ? (
              <div className="divide-y divide-hf-border">{daCasa.map((l) => <Linha key={l.id} rotulo={l.rotulo} dia={l.dia} mes={l.mes} />)}</div>
            ) : <p className="py-3 text-sm text-hf-muted">DADOS INSUFICIENTES: nenhuma conta cadastrada.</p>}
            {proLabore.length ? (
              <div className="divide-y divide-hf-border border-t border-hf-border">{proLabore.map((l) => <Linha key={l.id} rotulo={l.rotulo} dia={l.dia} mes={l.mes} />)}</div>
            ) : null}
            <p className="border-t border-hf-border py-2 text-xs text-hf-muted">
              Valores informados por você.{" "}
              <Link href="/dashboard/financeiro/pizza" className="font-semibold text-hf-text underline">Mudar aluguel, energia, água e dias de operação</Link>
            </p>
          </section>

          {/* Simulador do dia. */}
          <section className="space-y-3 rounded-2xl border border-hf-border bg-hf-surface p-3">
            <div>
              <h2 className="text-sm font-semibold text-hf-text">Simular o dia</h2>
              <p className="text-xs text-hf-muted">O sistema mostra o que a venda de hoje pagou, com os extras desta noite.</p>
            </div>
            <label className="block">
              <span className="text-xs text-hf-muted">Vendi hoje {onde} (R$)</span>
              <CampoDecimal value={venda} onChange={(e) => setVenda(e.target.value)} placeholder="0,00"
                className="mt-1 min-h-[48px] w-full rounded-xl border border-hf-border bg-hf-bg px-3 text-base tabular-nums text-hf-text" />
            </label>

            {sim.situacao === "sem_venda" ? (
              <p className="text-sm text-hf-muted">Digite o valor vendido para ver.</p>
            ) : (
              <>
                <div className={`rounded-xl p-3 ${sim.situacao === "faltou" ? "bg-hf-danger/10" : "bg-hf-success/10"}`}>
                  <p className="text-sm font-semibold text-hf-text">
                    {sim.situacao === "faltou" ? `Faltou ${brlC(sim.faltouC)} para pagar o dia`
                      : sim.situacao === "lucro" ? `Pagou o dia e sobrou ${brlC(sim.lucroC)} de lucro`
                        : "Pagou o dia, sem sobrar lucro"}
                  </p>
                  <p className="mt-1 text-xs text-hf-muted">
                    De {brlC(sim.vendaC)} vendidos, {brlC(sim.saiuAntesC)} vão para CMV e taxas; sobram {brlC(sim.sobraC)} para o custo do dia de {brlC(sim.custoDiaC)}.
                    {sim.pctCoberto != null ? ` Cobriu ${pct(sim.pctCoberto)} do dia.` : ""}
                  </p>
                  {sim.situacao === "faltou" && r.vendaMinimaHoje != null ? (
                    <p className="mt-1 text-xs text-hf-muted">Para empatar hoje vendendo só {onde}: {brl(r.vendaMinimaHoje)}.</p>
                  ) : null}
                </div>
                <ul className="divide-y divide-hf-border">
                  {sim.linhas.map((l) => {
                    const Ic = ICONE[l.status];
                    return (
                      <li key={l.id} className="flex items-center justify-between gap-3 py-2">
                        <span className="flex min-w-0 items-center gap-2 text-sm text-hf-text"><Ic size={16} className={`shrink-0 ${COR[l.status]}`} /><span className="truncate">{l.rotulo}</span></span>
                        <span className="shrink-0 text-right text-xs tabular-nums text-hf-muted">
                          {l.status === "pago" ? <span className="font-semibold text-hf-text">{brlC(l.custoC)} pago</span>
                            : l.status === "parcial" ? <><span className="font-semibold text-hf-text">{brlC(l.pagoC)}</span> de {brlC(l.custoC)}</>
                              : <>falta {brlC(l.faltaC)}</>}
                        </span>
                      </li>
                    );
                  })}
                </ul>
                <p className="text-xs text-hf-muted">SIMULAÇÃO com a meta de CMV, não o CMV real do dia.{r.descontos.fixosSemTicket ? " Sem o pedido médio, as taxas fixas por pedido não entram." : ""}</p>
              </>
            )}
          </section>
        </>
      )}
    </div>
  );
}
