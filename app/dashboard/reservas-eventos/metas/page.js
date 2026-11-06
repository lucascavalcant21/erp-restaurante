"use client";

// Metas dos eventos (pedido do dono, 06/11/2026): a mesma lógica da Marmitaria e
// do Restaurante — o que importa é o lucro no bolso. O mês se mede pelo que já
// está contratado (eventos fechados com data no mês). Contas em evento-metas.mjs.
// Valores sempre em reais; sem orçamento gravado, o lucro do evento não entra.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2, Save } from "lucide-react";
import { useERP } from "../../../context/ERPContext";
import { supabase } from "../../../lib/supabase";
import { metasDosEventos } from "../../../lib/evento-metas.mjs";
import { rotuloEtapa } from "../../../lib/evento-financeiro.mjs";
import { erroDeColunaDeEventos } from "../../../lib/evento-orcamento.mjs";
import { fetchMetasEventos, salvarMetasEventos } from "../../../lib/parametros";
import { hasPermission } from "../../../lib/permissions-catalog.mjs";
import { brl, Numero } from "../../../components/metas/BlocosDeMetas";

const mesAtual = () => new Date().toLocaleDateString("sv-SE").slice(0, 7);
const rotuloMes = (m) => { const [a, mm] = m.split("-"); const t = new Date(Number(a), Number(mm) - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" }); return t.charAt(0).toUpperCase() + t.slice(1); };
const MESES_CURTOS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const dataTxt = (d) => (d ? new Date(`${String(d).slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR") : "Sem data");
const inputCls = "min-h-[44px] w-full rounded-xl border border-hf-border bg-hf-surface pl-10 pr-3 text-sm font-semibold tabular-nums text-hf-text outline-none focus:border-hf-accent focus:ring-2 focus:ring-hf-accent/15";

function Cartao({ titulo, descricao, children }) {
  return (
    <section className="rounded-2xl border border-hf-border bg-hf-surface p-4 sm:p-5">
      <h2 className="text-base font-black text-hf-text">{titulo}</h2>
      {descricao && <p className="mt-0.5 text-sm text-hf-text-2">{descricao}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Progresso({ rotulo, m, unidadeFalta }) {
  if (m.meta === null) return <p className="text-sm text-hf-text-2">{rotulo}: defina a meta acima.</p>;
  if (m.atual === null) return <p className="text-sm text-hf-text-2">{rotulo}: DADOS INSUFICIENTES. Nenhum evento fechado do mês tem orçamento com lucro calculado.</p>;
  const largura = Math.max(0, Math.min(100, m.pct));
  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-bold text-hf-text">{rotulo}</p>
        <p className="text-sm tabular-nums text-hf-text-2"><b className="text-hf-text">{brl(m.atual)}</b> de {brl(m.meta)}</p>
      </div>
      <div className="mt-1.5 h-3 overflow-hidden rounded-full bg-hf-elevated" role="progressbar" aria-valuenow={Math.round(m.pct)} aria-valuemin={0} aria-valuemax={100} aria-label={rotulo}>
        <div className={`h-full rounded-full ${m.atingida ? "bg-hf-success" : "bg-hf-accent"}`} style={{ width: `${largura}%` }} />
      </div>
      <p className={`mt-1 text-sm font-semibold ${m.atingida ? "text-hf-success" : "text-hf-warning"}`}>
        {m.atingida
          ? (m.margem > 0 ? `Meta atingida, com ${brl(m.margem)} de margem de segurança.` : "Meta atingida.")
          : `Faltam ${brl(m.falta)}${m.eventosQueFaltam ? `: cerca de ${m.eventosQueFaltam} ${m.eventosQueFaltam === 1 ? "evento" : "eventos"} ${unidadeFalta}` : ""}.`}
      </p>
    </div>
  );
}

function GraficoDoAno({ meses, metaMes }) {
  const maior = Math.max(1, ...meses.map((m) => m.faturamento), Number(metaMes) || 0);
  return (
    <div>
      <div className="flex h-40 items-end gap-1 sm:gap-2" aria-label="Faturamento e lucro contratados por mês">
        {meses.map((m, i) => (
          <div key={m.mes} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1" title={`${MESES_CURTOS[i]}: faturamento ${brl(m.faturamento)}, lucro ${m.lucro === null ? "sem orçamento" : brl(m.lucro)}`}>
            <div className="relative flex w-full flex-1 items-end justify-center gap-0.5">
              <div className="w-1/2 max-w-[18px] rounded-t bg-hf-accent/35" style={{ height: `${(m.faturamento / maior) * 100}%` }} />
              <div className={`w-1/2 max-w-[18px] rounded-t ${m.lucro !== null && m.lucro < 0 ? "bg-hf-danger" : "bg-hf-success"}`} style={{ height: `${(Math.abs(m.lucro || 0) / maior) * 100}%` }} />
            </div>
            <span className="text-[10px] font-semibold text-hf-muted">{MESES_CURTOS[i]}</span>
          </div>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-hf-text-2">
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-hf-accent/35" /> Faturamento contratado</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-hf-success" /> Lucro líquido</span>
      </div>
    </div>
  );
}

export default function MetasDosEventosPage() {
  const { unidadeAtiva, sessao } = useERP();
  const [eventos, setEventos] = useState([]);
  const [metas, setMetas] = useState({ meta_lucro_mes: "", meta_faturamento_mes: "" });
  const [mes, setMes] = useState(mesAtual());
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState("");
  const podeEditar = !sessao?.gerenciado || hasPermission(sessao, "eventos.goals.edit");

  useEffect(() => {
    if (!unidadeAtiva) return;
    let vivo = true;
    (async () => {
      setCarregando(true);
      const [rE, rM] = await Promise.all([
        supabase.from("eventos").select("id,nome,data_evento,funil_status,valor_contratado,operacao_detalhes").eq("unidade_id", unidadeAtiva).neq("tipo_evento", "especial"),
        fetchMetasEventos(unidadeAtiva),
      ]);
      if (!vivo) return;
      if (rE.error) setErro(erroDeColunaDeEventos(rE.error.message) ? "O banco ainda não tem as colunas do orçamento dos eventos." : `Não foi possível carregar os eventos: ${rE.error.message}`);
      else { setErro(""); setEventos(rE.data || []); }
      setMetas(rM.data);
      setCarregando(false);
    })();
    return () => { vivo = false; };
  }, [unidadeAtiva]);

  const meses = useMemo(() => {
    const lista = new Set([mesAtual(), ...eventos.map((e) => String(e.data_evento || "").slice(0, 7)).filter((m) => /^\d{4}-\d{2}$/.test(m))]);
    return [...lista].sort().reverse();
  }, [eventos]);
  const m = useMemo(() => metasDosEventos(eventos, { mes, metaLucroMes: metas.meta_lucro_mes, metaFaturamentoMes: metas.meta_faturamento_mes }), [eventos, mes, metas]);

  async function salvar() {
    if (salvando) return;
    setSalvando(true); setAviso("");
    const { error } = await salvarMetasEventos(unidadeAtiva, metas);
    setAviso(error ? `Não salvou: ${error}` : "Metas salvas.");
    setSalvando(false);
  }

  if (!unidadeAtiva) return null;
  if (carregando) return <div className="flex items-center gap-2 rounded-2xl border border-hf-border bg-hf-surface p-6 text-sm text-hf-muted"><Loader2 size={16} className="animate-spin" /> Carregando as metas…</div>;

  const campo = (chave, rotulo) => (
    <label className="block min-w-0">
      <span className="text-xs font-bold text-hf-text-2">{rotulo}</span>
      <span className="relative mt-1 block">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-hf-muted">R$</span>
        <input type="text" inputMode="decimal" value={metas[chave]} disabled={!podeEditar} placeholder="0,00"
          onChange={(e) => { setAviso(""); setMetas((x) => ({ ...x, [chave]: e.target.value.replace(/[^0-9.,]/g, "") })); }} className={inputCls} />
      </span>
    </label>
  );

  return (
    <div className="space-y-4">
      {erro && <p className="rounded-xl border border-hf-danger/30 bg-hf-danger/10 p-3 text-sm font-semibold text-hf-danger">{erro}</p>}

      <Cartao titulo="Metas do mês" descricao="Quanto você quer que sobre no bolso com os eventos de cada mês. Vale para todos os meses.">
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          {campo("meta_lucro_mes", "Meta de lucro líquido por mês")}
          {campo("meta_faturamento_mes", "Meta de faturamento por mês")}
          {podeEditar && (
            <button type="button" onClick={salvar} disabled={salvando} className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-hf-accent px-4 text-sm font-bold text-hf-accent-fg hover:brightness-110 disabled:opacity-60">
              {salvando ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Salvar metas
            </button>
          )}
        </div>
        {aviso && <p className="mt-2 text-sm font-semibold text-hf-text-2" role="status">{aviso}</p>}
      </Cartao>

      <div className="flex flex-wrap items-center gap-2">
        <select value={mes} onChange={(e) => setMes(e.target.value)} aria-label="Mês"
          className="min-h-[44px] w-full rounded-xl border border-hf-border bg-hf-surface px-3 text-sm font-semibold text-hf-text outline-none focus:border-hf-accent sm:w-auto">
          {meses.map((x) => <option key={x} value={x}>{rotuloMes(x)}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Numero rotulo="Eventos fechados" valor={String(m.fechados)} nota={`${m.eventos} no mês, sem cancelados`} />
        <Numero rotulo="Faturamento contratado" valor={brl(m.faturamento)} nota={m.ticketMedio !== null ? `Média de ${brl(m.ticketMedio)} por evento` : "Nenhum evento fechado"} />
        <Numero rotulo="Lucro líquido contratado" valor={m.lucro === null ? "—" : brl(m.lucro)} nota={m.lucro === null ? "Sem orçamento com lucro calculado" : m.semOrcamento ? `${m.semOrcamento} fechado(s) sem orçamento não entram` : `Média de ${brl(m.lucroMedio)} por evento`} />
        <Numero rotulo="Em negociação" valor={brl(m.potencialFaturamento)} nota={m.potencialLucro !== null ? `Lucro previsto de ${brl(m.potencialLucro)}` : `${m.negociacao.length} evento(s) sem orçamento`} />
      </div>

      <Cartao titulo={`Resultado de ${rotuloMes(mes)}`} descricao="Eventos fechados com data no mês, contra as metas.">
        <div className="space-y-4">
          <Progresso rotulo="Lucro líquido" m={m.metaLucro} unidadeFalta="com o lucro médio do mês" />
          <Progresso rotulo="Faturamento" m={m.metaFaturamento} unidadeFalta="com o valor médio do mês" />
          {m.metaLucro.falta > 0 && m.potencialLucro > 0 && (
            <p className="rounded-xl bg-hf-elevated p-3 text-sm text-hf-text">
              {m.potencialLucro >= m.metaLucro.falta
                ? <>Fechando os eventos em negociação, o mês passa da meta: <b>{brl(m.potencialLucro)}</b> de lucro previsto para <b>{brl(m.metaLucro.falta)}</b> que faltam.</>
                : <>Mesmo fechando todos os eventos em negociação (<b>{brl(m.potencialLucro)}</b> de lucro previsto), ainda faltam <b>{brl(m.metaLucro.falta - m.potencialLucro)}</b>.</>}
            </p>
          )}
        </div>
      </Cartao>

      <div className="grid gap-4 lg:grid-cols-2">
        <Cartao titulo="Em negociação" descricao="Eventos do mês que ainda não fecharam.">
          {!m.negociacao.length ? <p className="text-sm text-hf-text-2">Nenhum evento em aberto neste mês.</p> : (
            <ul className="divide-y divide-hf-border">
              {m.negociacao.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-3 py-2">
                  <Link href={`/dashboard/reservas-eventos/eventos/${e.id}`} className="min-w-0">
                    <p className="truncate text-sm font-bold text-hf-text hover:underline">{e.nome}</p>
                    <p className="text-xs text-hf-text-2">{dataTxt(e.data)} · {rotuloEtapa(e.etapa)}</p>
                  </Link>
                  <div className="shrink-0 text-right text-sm tabular-nums">
                    <p className="font-bold text-hf-text">{e.faturamento ? brl(e.faturamento) : "Sem valor"}</p>
                    <p className="text-xs text-hf-text-2">{e.lucro !== null ? `Lucro ${brl(e.lucro)}` : "Sem orçamento"}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Cartao>

        <Cartao titulo="Eventos abaixo da meta" descricao="Fechados com lucro menor que a meta do orçamento, ou com prejuízo.">
          {!m.abaixoDaMeta.length ? <p className="text-sm text-hf-text-2">Nenhum evento fechado do mês está abaixo da meta.</p> : (
            <ul className="divide-y divide-hf-border">
              {m.abaixoDaMeta.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-3 py-2">
                  <Link href={`/dashboard/reservas-eventos/eventos/${e.id}`} className="min-w-0">
                    <p className="truncate text-sm font-bold text-hf-text hover:underline">{e.nome}</p>
                    <p className="text-xs text-hf-text-2">{dataTxt(e.data)}</p>
                  </Link>
                  <div className="shrink-0 text-right text-sm tabular-nums">
                    <p className={`font-bold ${e.prejuizo ? "text-hf-danger" : "text-hf-text"}`}>{e.prejuizo ? `Prejuízo de ${brl(-e.lucro)}` : `Lucro ${brl(e.lucro)}`}</p>
                    {e.falta !== null && <p className="text-xs text-hf-danger">Faltam {brl(e.falta)} para a meta</p>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Cartao>
      </div>

      <Cartao titulo="Para onde vai o dinheiro" descricao="Soma dos eventos fechados do mês: quanto do valor pago pelos clientes vai para cada custo.">
        {!m.composicao ? (
          <p className="text-sm text-hf-text-2">DADOS INSUFICIENTES: nenhum evento fechado do mês tem o orçamento salvo com a composição dos custos. Abra o orçamento do evento e salve para ele entrar aqui.</p>
        ) : (
          <>
            <ul className="space-y-2">
              {m.composicao.map((c) => (
                <li key={c.id}>
                  <div className="flex justify-between gap-3 text-sm"><span className="font-semibold text-hf-text">{c.rotulo}</span><span className="tabular-nums text-hf-text-2"><b className="text-hf-text">{brl(c.valor)}</b> · {c.pct.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%</span></div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-hf-elevated"><div className={`h-full rounded-full ${c.id === "lucro" ? (c.valor < 0 ? "bg-hf-danger" : "bg-hf-success") : "bg-hf-accent/70"}`} style={{ width: `${Math.max(0, Math.min(100, c.pct))}%` }} /></div>
                </li>
              ))}
            </ul>
            {m.maiorCusto && <p className="mt-3 text-sm text-hf-text">Maior custo do mês: <b>{m.maiorCusto.rotulo}</b>, {brl(m.maiorCusto.valor)}. É onde uma redução mais aumenta o lucro.</p>}
            {m.eventosNaComposicao < m.fechados && <p className="mt-1 text-xs text-hf-muted">Considera {m.eventosNaComposicao} de {m.fechados} eventos fechados (os demais não têm a composição salva).</p>}
          </>
        )}
      </Cartao>

      <Cartao titulo={`Ano de ${m.ano}`} descricao="Eventos fechados mês a mês. A meta do ano é a meta do mês × 12.">
        <div className="mb-4 grid gap-4 sm:grid-cols-2">
          <Progresso rotulo="Lucro líquido do ano" m={m.anoResumo.metaLucro} unidadeFalta="" />
          <Progresso rotulo="Faturamento do ano" m={m.anoResumo.metaFaturamento} unidadeFalta="" />
        </div>
        <GraficoDoAno meses={m.anoResumo.meses} metaMes={metas.meta_faturamento_mes} />
      </Cartao>
    </div>
  );
}
