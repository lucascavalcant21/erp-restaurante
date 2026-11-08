"use client";

// DASHBOARD GERENCIAL DOS EVENTOS (pedido do dono, 08/11/2026): a mesma
// "Visão geral" da Marmitaria, com o que os eventos já têm — o resumo gravado
// pelo orçamento de cada evento (operacao_detalhes.resumo), o funil e as metas
// do mês. O mês se mede pelo contratado (eventos fechados com data no mês), como
// em Metas. Contas em evento-metas.mjs e painel-gerencial.mjs.
// Sem orçamento gravado, o evento não entra no lucro: nada é presumido.

import { useEffect, useMemo, useState } from "react";
import { BarChart3, BookOpen, CalendarDays, Coins, Gauge, Handshake, ListOrdered, Loader2, PartyPopper, PieChart, Receipt, Target, TrendingUp, Wallet } from "lucide-react";
import { useERP } from "../../../context/ERPContext";
import { supabase } from "../../../lib/supabase";
import { metasDosEventos } from "../../../lib/evento-metas.mjs";
import { FASES_FUNIL, faseDaEtapa } from "../../../lib/evento-financeiro.mjs";
import { erroDeColunaDeEventos } from "../../../lib/evento-orcamento.mjs";
import { fetchMetasEventos } from "../../../lib/parametros";
import { analiseDoEvento, faturamentoContraFixos, fatiasDeCusto, maioresPor } from "../../../lib/painel-gerencial.mjs";
import { AnaliseDoItem, BarrasHorizontais, Bloco, CartaoKpi, FaltaDado, FaturamentoXCustos, GraficoMaioresMargens, Rosca, TituloGestao, brl, pct } from "../../../components/gerencial/PainelGerencial";

const BASE = "/dashboard/reservas-eventos";
const mesAtual = () => new Date().toLocaleDateString("sv-SE").slice(0, 7);
const rotuloMes = (m) => { const [a, mm] = m.split("-"); const t = new Date(Number(a), Number(mm) - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" }); return t.charAt(0).toUpperCase() + t.slice(1); };
const dataCurta = (d) => (d ? new Date(`${String(d).slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : "");
const cancelado = (e) => String(e?.funil_status || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().trim() === "CANCELADO";
// Ícone no lugar da foto: evento não tem foto de prato.
const ICONES_FASE = { contato: Handshake, proposta: BookOpen, fechamento: Receipt, confirmados: CalendarDays, encerrados: PartyPopper };

export default function DashboardGerencialEventos() {
  const { unidadeAtiva } = useERP();
  const [eventos, setEventos] = useState([]);
  const [metas, setMetas] = useState({ meta_lucro_mes: "", meta_faturamento_mes: "" });
  const [mes, setMes] = useState(mesAtual());
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [escolhido, setEscolhido] = useState("");

  useEffect(() => {
    if (!unidadeAtiva) return undefined;
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

  const d = useMemo(() => {
    const m = metasDosEventos(eventos, { mes, metaLucroMes: metas.meta_lucro_mes, metaFaturamentoMes: metas.meta_faturamento_mes });
    const doMes = eventos.filter((e) => String(e.data_evento || "").slice(0, 7) === mes && !cancelado(e));
    const analises = doMes.map(analiseDoEvento).filter(Boolean).map((a) => ({ ...a, fase: faseDaEtapa(a.etapa).id }));
    const custos = (m.composicao || []).filter((c) => c.id !== "lucro").map((c) => ({ rotulo: c.rotulo, valor: c.valor }));
    const funil = FASES_FUNIL.filter((f) => f.id !== "encerrados" || doMes.some((e) => faseDaEtapa(e.funil_status).id === "encerrados"))
      .map((f) => ({ id: f.id, nome: f.rotulo, valor: doMes.filter((e) => faseDaEtapa(e.funil_status).id === f.id).length }));
    const margemMedia = m.faturamento > 0 && m.lucro !== null ? (m.lucro / m.faturamento) * 100 : null;
    return {
      m, doMes, analises, funil, margemMedia,
      rosca: fatiasDeCusto(custos, { maximo: 6 }),
      margens: maioresPor(analises, "lucro", 5),
      maioresCustos: maioresPor(analises, "custo", 5),
      // Contratado × meta de lucro do mês: o "resultado" é quanto passou ou falta.
      contraMeta: faturamentoContraFixos({ faturamento: m.lucro, contribuicao: m.lucro, custosFixos: m.metaLucro.meta }),
    };
  }, [eventos, mes, metas]);

  const meses = useMemo(() => {
    const lista = new Set([mesAtual(), ...eventos.map((e) => String(e.data_evento || "").slice(0, 7)).filter((x) => /^\d{4}-\d{2}$/.test(x))]);
    return [...lista].sort().reverse();
  }, [eventos]);

  if (!unidadeAtiva) return null;
  if (carregando) return <div className="flex items-center gap-2 rounded-2xl border border-hf-border bg-hf-surface p-6 text-sm text-hf-muted"><Loader2 size={16} className="animate-spin" /> Carregando o dashboard…</div>;

  const { m } = d;
  const atual = d.margens[0] || d.analises[0] || null;
  const rotuloEvento = (a) => `${a.nome}${a.data ? ` · ${dataCurta(a.data)}` : ""}`;

  return (
    <div className="space-y-4">
      {erro && <p className="rounded-xl border border-hf-danger/30 bg-hf-danger/10 p-3 text-sm font-semibold text-hf-danger">{erro}</p>}

      <TituloGestao icone={Gauge} subtitulo={`Eventos · ${rotuloMes(mes)} · contratado = eventos fechados com data no mês`}>
        <select value={mes} onChange={(e) => setMes(e.target.value)} aria-label="Mês"
          className="min-h-[44px] rounded-xl border border-hf-border bg-hf-surface px-3 text-sm font-medium text-hf-text outline-none focus:border-hf-accent">
          {meses.map((x) => <option key={x} value={x}>{rotuloMes(x)}</option>)}
        </select>
      </TituloGestao>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <CartaoKpi icone={PartyPopper} rotulo="Eventos no mês" valor={m.eventos} formato="int" nota={`${m.fechados} fechados`} />
        <CartaoKpi icone={Receipt} rotulo="Ticket médio" valor={m.ticketMedio} nota="por evento fechado" />
        <CartaoKpi icone={Wallet} rotulo="Faturamento contratado" valor={m.fechados ? m.faturamento : null} natureza="real" />
        <CartaoKpi icone={Handshake} rotulo="Em negociação" valor={m.negociacao.length ? m.potencialFaturamento : null} semDado="Nenhuma proposta aberta" nota={m.negociacao.length ? `${m.negociacao.length} propostas` : null} natureza="projecao" />
        <CartaoKpi icone={Target} rotulo="Margem média" valor={d.margemMedia} formato="pct" natureza="estimativa" />
        <CartaoKpi icone={TrendingUp} rotulo="Lucro contratado" valor={m.lucro} destaque={m.lucro !== null && m.lucro >= 0} natureza="estimativa"
          nota={m.lucro === null ? null : m.semOrcamento ? `${m.semOrcamento} fechado(s) sem orçamento` : "pelos orçamentos"} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Bloco icone={BarChart3} titulo="Maiores margens" subtitulo="Lucro líquido de cada evento pelo orçamento">
          <GraficoMaioresMargens itens={d.margens.map((a) => ({ id: a.id, nome: rotuloEvento(a), valor: a.lucro, icone: ICONES_FASE[a.fase] || PartyPopper }))}
            vazio={<FaltaDado motivo={`Nenhum evento de ${rotuloMes(mes).toLowerCase()} tem orçamento gravado com lucro.`} href={`${BASE}/eventos`} acao="Abrir o funil" />} />
        </Bloco>
        <Bloco icone={PieChart} titulo="Para onde vai o dinheiro" subtitulo="Custos dos eventos fechados no mês">
          {d.rosca.fatias.length ? <Rosca fatias={d.rosca.fatias} total={d.rosca.total} rotuloTotal="em custos" />
            : <FaltaDado motivo="Nenhum evento fechado no mês tem a composição de custos no orçamento. Abra e salve o orçamento do evento." href={`${BASE}/eventos`} acao="Abrir o funil" />}
        </Bloco>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Bloco icone={Coins} titulo="Análise do evento">
          {d.analises.length ? <AnaliseDoItem opcoes={d.analises.map((a) => ({ id: String(a.id), nome: rotuloEvento(a) }))} valor={escolhido || (atual ? String(atual.id) : "")} onChange={setEscolhido}
            analise={escolhido ? d.analises.find((a) => String(a.id) === escolhido) || null : atual} rotuloLucro="Lucro líquido" icone={PartyPopper} />
            : <FaltaDado motivo="Nenhum evento do mês tem orçamento gravado." href={`${BASE}/rapido`} acao="Simular um evento" />}
        </Bloco>
        <Bloco icone={ListOrdered} titulo="Maiores custos" subtitulo="Cardápio, equipe e aluguel de cada evento">
          {d.maioresCustos.length ? <BarrasHorizontais itens={d.maioresCustos.map((a) => ({ id: a.id, nome: rotuloEvento(a), valor: a.custo }))} />
            : <FaltaDado motivo="Nenhum orçamento do mês traz a composição dos custos." />}
        </Bloco>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Bloco icone={Target} titulo="Lucro × meta" subtitulo={rotuloMes(mes)}>
          {m.metaLucro.meta === null ? <FaltaDado motivo="Defina a meta de lucro do mês." href={`${BASE}/metas`} acao="Definir em Metas" />
            : m.lucro === null ? <FaltaDado motivo="Nenhum evento fechado do mês tem orçamento com lucro calculado." />
              : <FaturamentoXCustos r={d.contraMeta} rotuloFaturamento="Lucro contratado" rotuloFixos="Meta de lucro" rotuloResultado={d.contraMeta.resultado >= 0 ? "Margem de segurança" : "Falta para a meta"}
                nota={m.metaLucro.eventosQueFaltam ? `Cerca de ${m.metaLucro.eventosQueFaltam} evento(s) como os do mês para chegar à meta.` : `${pct(m.metaLucro.pct, 0)} da meta.`} />}
        </Bloco>
        <Bloco icone={BookOpen} titulo="Funil do mês" subtitulo="Eventos com data no mês, por fase">
          {d.doMes.length ? <BarrasHorizontais itens={d.funil} formato="int" /> : <FaltaDado motivo={`Nenhum evento com data em ${rotuloMes(mes).toLowerCase()}.`} href={`${BASE}/eventos`} acao="Abrir o funil" />}
        </Bloco>
        <Bloco icone={CalendarDays} titulo="Ano" subtitulo={`${m.ano}: contratado até agora`}>
          <ul className="space-y-1.5 text-sm">
            <li className="flex min-h-[40px] items-center justify-between gap-2 rounded-xl bg-hf-elevated px-3"><span className="text-hf-text-2">Eventos fechados</span><b className="tabular-nums">{m.anoResumo.eventos}</b></li>
            <li className="flex min-h-[40px] items-center justify-between gap-2 rounded-xl bg-hf-elevated px-3"><span className="text-hf-text-2">Faturamento</span><b className="tabular-nums">{brl(m.anoResumo.faturamento)}</b></li>
            <li className="flex min-h-[40px] items-center justify-between gap-2 rounded-xl bg-hf-elevated px-3"><span className="text-hf-text-2">Lucro líquido</span><b className={`tabular-nums ${m.anoResumo.lucro < 0 ? "text-hf-danger" : ""}`}>{m.anoResumo.lucro === null ? "Dados insuficientes" : brl(m.anoResumo.lucro)}</b></li>
          </ul>
        </Bloco>
      </div>

      <p className="text-xs text-hf-muted">Faturamento contratado: REAL (valor contratado ou orçamento dos eventos fechados). Lucro, margens e custos: ESTIMATIVA pelo orçamento gravado de cada evento. Em negociação: PROJEÇÃO, se as propostas do mês fecharem.</p>
    </div>
  );
}
