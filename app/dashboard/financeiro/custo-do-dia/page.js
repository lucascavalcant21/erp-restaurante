"use client";

// CUSTO POR DIA (pedido do dono, 28/11/2026): "Quanto é que eu gasto por dia de
// aluguel? De luz? Com um funcionário? Na equipe da manhã? De água? Quanto é
// que eu preciso vender por dia para me pagar todos esses custos? É isso que
// eu quero enxergar." E o simulador: "vendi X, o sistema mostra o que consegui
// pagar no dia, qual meu custo diário antes do lucro, se faltou ou se já estou
// no lucro".
//
// As contas vêm de custo-do-dia.mjs (testado). Os valores das contas da casa
// são os mesmos que a Pizza do Lucro grava; a equipe vem do RH.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, ChevronDown, CircleAlert, CircleDashed, Loader2 } from "lucide-react";
import CabecalhoTela from "../../../components/ui/CabecalhoTela";
import CampoDecimal from "../../../components/CampoDecimal";
import { useERP } from "../../../context/ERPContext";
import { fetchParamsDaCasa, PARAMS_PADRAO } from "../../../lib/parametros";
import { fetchColaboradores, fetchRecibosPrestacaoUnidade } from "../../../lib/rh";
import { calcularCMO } from "../../../lib/cmo.mjs";
import { custoDoDia, oQueAVendaPagou } from "../../../lib/custo-do-dia.mjs";
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
  const n = t.fixos.length + t.extras.length;
  return (
    <div className="rounded-xl border border-hf-border bg-hf-surface">
      <button type="button" onClick={alternar} aria-expanded={aberto}
        className="flex min-h-[52px] w-full items-center justify-between gap-3 px-3 text-left">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-hf-text">{t.rotulo}</p>
          <p className="text-xs text-hf-muted">{n} {n === 1 ? "pessoa" : "pessoas"} · {t.ajuda}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <div className="text-right">
            <p className="text-sm font-bold tabular-nums text-hf-text">{t.fixoDia == null ? "—" : !t.fixos.length ? "Só extras" : `${brl(t.fixoDia)}/dia`}</p>
            {t.extrasDiaria > 0 ? <p className="text-xs tabular-nums text-hf-muted">+ {brl(t.extrasDiaria)} se vierem os extras</p> : null}
          </div>
          <ChevronDown size={18} className={`text-hf-muted transition ${aberto ? "rotate-180" : ""}`} />
        </div>
      </button>
      {aberto ? (
        <div className="divide-y divide-hf-border border-t border-hf-border px-3">
          {t.fixos.map((p) => <Linha key={p.id} rotulo={p.nome} detalhe={p.cargo || "Contratado"} dia={p.dia} mes={p.mes} />)}
          {t.extras.map((p) => (
            <div key={p.id} className="flex items-baseline justify-between gap-3 py-2">
              <div className="min-w-0"><p className="truncate text-sm text-hf-text">{p.nome}</p><p className="truncate text-xs text-hf-muted">Extra{p.cargo ? ` · ${p.cargo}` : ""}</p></div>
              <p className="shrink-0 text-sm font-semibold tabular-nums text-hf-text">{brl(p.diaria)} <span className="text-xs font-normal text-hf-muted">no dia que vem</span></p>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

const ICONE = { pago: CheckCircle2, parcial: CircleDashed, falta: CircleAlert };
const COR = { pago: "text-hf-success", parcial: "text-hf-warning", falta: "text-hf-danger" };

export default function CustoDoDiaPage() {
  const { unidadeAtiva } = useERP();
  const [params, setParams] = useState(PARAMS_PADRAO);
  const [equipe, setEquipe] = useState([]);
  const [extrasMes, setExtrasMes] = useState(0);
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
        setExtrasMes(calcularCMO({ colaboradores: rE.data || [], recibos: rR.data || [] }).extras || 0);
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
  // O quadro do topo é sempre o salão; o simulador usa o canal escolhido.
  const r = useMemo(() => custoDoDia({ params, colaboradores: equipe, extrasPagosMes: extrasMes }), [params, equipe, extrasMes]);
  const rCanal = useMemo(() => (canal ? custoDoDia({ params, colaboradores: equipe, extrasPagosMes: extrasMes, canal }) : r), [params, equipe, extrasMes, canal, r]);
  const sim = useMemo(() => oQueAVendaPagou({ venda: Number(venda) || 0, sobraPct: rCanal.descontos.sobraPct, linhas: rCanal.linhas }), [venda, rCanal]);
  const daCasa = r.linhas.filter((l) => l.grupo === "casa");
  const proLabore = r.linhas.filter((l) => l.grupo === "prolabore");

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

          {/* A resposta primeiro: quanto vender e quanto custa abrir. */}
          <section className="rounded-2xl bg-hf-menu p-4 text-white">
            <p className="text-sm text-white/70">Para pagar tudo, você precisa vender por dia</p>
            <p className="mt-1 text-3xl font-bold tabular-nums">{r.vendaMinimaDia != null ? brl(r.vendaMinimaDia) : "DADOS INSUFICIENTES"}</p>
            {r.vendaMinimaDia != null ? (
              <p className="mt-1 text-xs text-white/70">{brl(r.vendaMinimaMes)} no mês · {r.dias} dias de operação · ESTIMATIVA</p>
            ) : <p className="mt-1 text-xs text-white/80">{r.motivo}</p>}
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
              Saem antes {pct(r.descontos.pct)}: {r.descontos.partes.map((p) => `${p.rotulo} ${pct(p.pct)}`).join(" · ") || "nenhum desconto cadastrado"}.
              {!r.descontos.temMetaCmv ? " Sem meta de CMV: a conta fica otimista." : ""}
            </p>
          </section>

          {/* Equipe por turno. */}
          <section className="space-y-2">
            <div className="flex items-baseline justify-between">
              <h2 className="text-[13px] font-medium text-hf-muted">Equipe</h2>
              <p className="text-sm font-semibold tabular-nums text-hf-text">{r.equipe.fixoDia != null ? `${brl(r.equipe.fixoDia)}/dia` : "—"}</p>
            </div>
            {r.equipe.turnos.length ? r.equipe.turnos.map((t) => (
              <Turno key={t.id} t={t} aberto={!!aberto[t.id]} alternar={() => setAberto((a) => ({ ...a, [t.id]: !a[t.id] }))} />
            )) : <p className="rounded-xl border border-hf-border bg-hf-surface p-3 text-sm text-hf-muted">DADOS INSUFICIENTES: nenhum funcionário ativo com salário no RH.</p>}
            {r.extrasMes > 0 ? (
              <p className="text-xs text-hf-muted">Extras pagos neste mês: {brl(r.extrasMes)}, em média {brl(r.extrasDia)} por dia (ESTIMATIVA). Entra no custo do dia.</p>
            ) : null}
            {r.equipe.semSalario.length ? (
              <p className="rounded-xl border border-hf-warning/40 bg-hf-warning/10 p-3 text-xs text-hf-text">
                {r.equipe.semSalario.length} {r.equipe.semSalario.length === 1 ? "pessoa está" : "pessoas estão"} sem salário ou diária no RH e não {r.equipe.semSalario.length === 1 ? "entra" : "entram"} na conta: {r.equipe.semSalario.map((p) => p.nome).join(", ")}.{" "}
                <Link href="/dashboard/rh/equipe" className="font-semibold underline">Completar no RH</Link>
              </p>
            ) : null}
            <p className="text-xs text-hf-muted">A equipe sai do horário de entrada no RH. Contratado: salário + vale + taxa de serviço{Number(params.encargos_folha_pct) > 0 ? ` + ${pct(params.encargos_folha_pct)} de encargos` : ""} ÷ {r.dias || "?"} dias.</p>
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
              <p className="text-xs text-hf-muted">Quanto você vendeu hoje? O sistema mostra o que essa venda pagou.</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="text-xs text-hf-muted">Vendi (R$)</span>
                <CampoDecimal value={venda} onChange={(e) => setVenda(e.target.value)} placeholder="0,00"
                  className="mt-1 min-h-[48px] w-full rounded-xl border border-hf-border bg-hf-bg px-3 text-base tabular-nums text-hf-text" />
              </label>
              <label className="block">
                <span className="text-xs text-hf-muted">Onde</span>
                <select value={canalId} onChange={(e) => setCanalId(e.target.value)}
                  className="mt-1 min-h-[48px] w-full rounded-xl border border-hf-border bg-hf-bg px-3 text-base text-hf-text">
                  <option value="salao">Salão / balcão</option>
                  {apps.map((a) => <option key={a.id} value={String(a.id)}>{a.nome}</option>)}
                </select>
              </label>
            </div>

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
                  {sim.situacao === "faltou" && rCanal.vendaMinimaDia != null ? (
                    <p className="mt-1 text-xs text-hf-muted">Para empatar vendendo só {canal ? `no ${canal.nome}` : "no salão"}: {brl(rCanal.vendaMinimaDia)} no dia.</p>
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
                <p className="text-xs text-hf-muted">{canal ? `Taxas do ${canal.nome}: ${rCanal.descontos.partes.filter((x) => !/CMV|Imposto/.test(x.rotulo)).map((x) => `${x.rotulo.replace(` (${canal.nome})`, "")} ${pct(x.pct)}`).join(" · ") || "nenhuma"}. ` : ""}SIMULAÇÃO com a meta de CMV, não o CMV real do dia. {canal ? "Taxa fixa por pedido e entrega paga pela loja não entram." : ""}</p>
              </>
            )}
          </section>
        </>
      )}
    </div>
  );
}
