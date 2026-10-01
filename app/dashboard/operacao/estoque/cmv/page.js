"use client";

// CMV REAL — F2.4C. Estoque inicial + compras − estoque final, entre
// inventários FECHADOS; CMV % sobre o faturamento do MESMO período.
// Nada inventado: falta de dado = NÃO APURADO com o motivo. Todo número abre
// a sua origem (inventário, compras, faturamento). Não usa o DRE antigo.

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useERP } from "../../../../context/ERPContext";
import { supabase, isSupabaseReady } from "../../../../lib/supabase";
import { carregarDadosCmv, salvarFaturamentoDia } from "../../../../lib/cmv-dados.mjs";
import {
  CONFIG_CMV, ROTULO_GRUPO, periodosEntreContagens, periodoPorDatas, contagensValidas, apurarPeriodo, analiseCompras, maisConsumidos,
  porCategoria, variacoesPreco, comparacaoPeriodos, mediasHistoricas, alertas, estoqueParado, exibirQtd, rotuloBase, somarDiasIso,
  entradasSaidasPorProduto,
} from "../../../../lib/cmv-real.mjs";
import { rotuloTipo } from "../../../../lib/contagem-estoque.mjs";
import { intervaloPeriodo, unidadeValida, hojeLocal } from "../../../../lib/contas-pagar.mjs";
import { hasPermission, permissionKey } from "../../../../lib/permissions-catalog.mjs";
import { fmtBRL } from "../../../../components/ui";
import { X, ChevronDown } from "lucide-react";

const fmtData = (d) => (d ? new Date(`${String(d).slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR") : "—");
const fmtHora = (d) => (d ? new Date(d).toLocaleString("pt-BR") : "—");
const NA = "NÃO APURADO";
const brl = (v) => (v == null ? NA : fmtBRL(v));
const pct = (v) => (v == null ? NA : `${v.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`);
const seta = (v) => (v == null ? "" : v > 0 ? "↑" : v < 0 ? "↓" : "=");
const qtd = (q, b) => (q == null ? "—" : `${exibirQtd(q, b).toLocaleString("pt-BR", { maximumFractionDigits: 3 })} ${rotuloBase(b)}`);
const STATUS = { apurado: ["APURADO", "bg-emerald-100 text-emerald-800"], nao_apurado: [NA, "bg-amber-100 text-amber-900"], em_andamento: ["EM ANDAMENTO", "bg-sky-100 text-sky-800"] };

export default function CmvPage() {
  return <Suspense fallback={<p className="p-8 text-center font-bold text-fg">Carregando...</p>}><Cmv /></Suspense>;
}

function Cmv() {
  const { unidadeAtiva, sessao } = useERP();
  const hoje = hojeLocal();
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState("");
  const [modo, setModo] = useState("contagens");
  const [selPeriodo, setSelPeriodo] = useState("");
  const [par, setPar] = useState({ de: "", ate: "" });
  const [custom, setCustom] = useState({ de: "", ate: "" });
  const [drawer, setDrawer] = useState(null);
  const podeFaturamento = !sessao?.gerenciado || hasPermission(sessao, permissionKey("estoque", "cmv", "edit"));

  const carregar = useCallback(async () => {
    if (!isSupabaseReady() || !unidadeValida(unidadeAtiva)) return;
    const r = await carregarDadosCmv(supabase, unidadeAtiva);
    setDados(r.data); setErro(r.error || "");
  }, [unidadeAtiva]);
  useEffect(() => { carregar(); }, [carregar]);

  const periodos = useMemo(() => (dados ? periodosEntreContagens(dados.contagens, hoje) : []), [dados, hoje]);
  const apurados = useMemo(() => (dados ? periodos.map((p) => apurarPeriodo(p, dados)) : []), [dados, periodos]);
  const validas = useMemo(() => (dados ? contagensValidas(dados.contagens) : []), [dados]);

  const periodo = useMemo(() => {
    if (!dados) return null;
    if (modo === "contagens") {
      const fechados = periodos.filter((p) => !p.emAndamento);
      return periodos.find((p) => p.id === selPeriodo) || fechados[fechados.length - 1] || periodos[periodos.length - 1] || null;
    }
    if (modo === "par") {
      const a = validas.find((c) => c.id === par.de); const b = validas.find((c) => c.id === par.ate);
      if (!a || !b || a.fronteira >= b.fronteira) return null;
      return { id: `par:${a.id}:${b.id}`, inicio: a, fim: b, de: a.fronteira, ateExclusivo: b.fronteira, emAndamento: false };
    }
    let iv = null;
    if (modo === "semana") iv = intervaloPeriodo("semana", hoje);
    if (modo === "semana_anterior") iv = intervaloPeriodo("semana", somarDiasIso(hoje, -7));
    if (modo === "mes") iv = intervaloPeriodo("mes", hoje);
    if (modo === "mes_anterior") { const ini = `${hoje.slice(0, 7)}-01`; iv = intervaloPeriodo("mes", somarDiasIso(ini, -1)); }
    if (modo === "ultimos30") iv = { de: somarDiasIso(hoje, -29), ate: hoje };
    if (modo === "personalizado") iv = intervaloPeriodo("personalizado", hoje, custom);
    return iv ? periodoPorDatas(iv.de, iv.ate, dados.contagens) : null;
  }, [dados, modo, selPeriodo, par, custom, periodos, validas, hoje]);
  const ap = useMemo(() => (periodo && dados ? apurarPeriodo(periodo, dados) : null), [periodo, dados]);

  if (!unidadeValida(unidadeAtiva)) return <p className="p-8 text-center font-bold text-fg">Selecione uma unidade para ver o CMV.</p>;
  if (!dados) return <p className="p-8 text-center font-bold text-fg">{erro ? `Não foi possível carregar: ${erro}` : "Carregando..."}</p>;

  const varPreco = variacoesPreco(dados.compras, dados.comprasItens, { ateExclusivo: ap?.periodo.ateExclusivo });
  const listaAlertas = alertas({ apurados, variacoes: varPreco, insumoPorId: dados.insumoPorId });
  const comp = comparacaoPeriodos(apurados);
  const medias = mediasHistoricas(apurados);

  return (
    <div className="min-h-screen pb-24 bg-[var(--surface)] text-slate-800">
      <div className="bg-slate-900 px-4 sm:px-8 pt-6 pb-5 text-white">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-2xl sm:text-4xl font-black tracking-tighter">CMV Real</h1>
          <p className="text-subtle font-bold uppercase tracking-widest text-3xs sm:text-xs mt-1">Estoque inicial + compras − estoque final · entre inventários fechados</p>
          <div className="mt-4 flex flex-wrap gap-2 items-center">
            <select value={modo} onChange={(e) => setModo(e.target.value)} className="h-10 px-3 rounded-xl bg-slate-800 border border-slate-700 font-bold text-sm">
              <option value="contagens">Entre contagens</option><option value="par">Escolher duas contagens</option>
              <option value="semana">Esta semana</option><option value="semana_anterior">Semana anterior</option>
              <option value="mes">Este mês</option><option value="mes_anterior">Mês anterior</option>
              <option value="ultimos30">Últimos 30 dias</option><option value="personalizado">Personalizado</option>
            </select>
            {modo === "contagens" && periodos.length > 0 && (
              <select value={periodo?.id || ""} onChange={(e) => setSelPeriodo(e.target.value)} className="h-10 px-3 rounded-xl bg-slate-800 border border-slate-700 font-bold text-sm">
                {[...periodos].reverse().map((p) => <option key={p.id} value={p.id}>{fmtData(p.de)} → {p.emAndamento ? "hoje (em andamento)" : fmtData(somarDiasIso(p.ateExclusivo, -1))}</option>)}
              </select>
            )}
            {modo === "par" && ["de", "ate"].map((k) => (
              <select key={k} value={par[k]} onChange={(e) => setPar({ ...par, [k]: e.target.value })} className="h-10 px-3 rounded-xl bg-slate-800 border border-slate-700 font-bold text-sm">
                <option value="">{k === "de" ? "Contagem inicial" : "Contagem final"}</option>
                {validas.map((c) => <option key={c.id} value={c.id}>{fmtData(c.data_referencia)} — {rotuloTipo(c.tipo)}</option>)}
              </select>
            ))}
            {modo === "personalizado" && ["de", "ate"].map((k) => <input key={k} type="date" value={custom[k]} onChange={(e) => setCustom({ ...custom, [k]: e.target.value })} className="h-10 px-3 rounded-xl bg-slate-800 border border-slate-700 font-bold text-sm" />)}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-3 sm:px-8 mt-4 space-y-3">
        {erro && <p className="text-sm font-bold text-red-700">{erro}</p>}
        {!validas.length && (
          <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm">
            <p className="font-black">Nenhum inventário fechado ainda.</p>
            <p>O CMV real começa a existir quando houver dois inventários fechados: o primeiro é o estoque inicial (ex.: 01/10) e o seguinte fecha o período (ex.: 08/10). Faça a contagem em Operacional → Inventários / Contagens.</p>
          </div>
        )}
        {ap ? <Resumo ap={ap} onAbrir={setDrawer} /> : modo === "par" && <p className="text-sm text-fg">Escolha duas contagens fechadas, a inicial antes da final.</p>}

        {ap && (
          <>
            <Secao titulo="Evolução entre contagens" aberta>
              {!apurados.length ? <p className="text-xs text-fg">Sem períodos ainda.</p> : (
                <div className="overflow-x-auto"><table className="w-full text-xs">
                  <thead><tr className="text-left text-fg"><th className="py-1">Período</th><th>Status</th><th className="text-right">Est. inicial</th><th className="text-right">Compras</th><th className="text-right">Est. final</th><th className="text-right">CMV</th><th className="text-right">Faturamento</th><th className="text-right">CMV %</th><th className="text-right">vs anterior</th></tr></thead>
                  <tbody>{[...apurados].reverse().map((a) => {
                    const c = comp.find((x) => x.periodo.id === a.periodo.id);
                    const [rot, cor] = STATUS[a.status];
                    return (
                      <tr key={a.periodo.id} className="border-t border-line">
                        <td className="py-1 font-bold">{fmtData(a.periodo.de)} → {a.status === "em_andamento" ? "hoje" : fmtData(a.periodo.ate)}</td>
                        <td><span className={`px-2 py-0.5 rounded-full text-3xs font-black ${cor}`}>{rot}</span></td>
                        <td className="text-right">{brl(a.ei.valor)}</td><td className="text-right">{fmtBRL(a.compras.valor)}</td><td className="text-right">{brl(a.ef.valor)}</td>
                        <td className="text-right font-black">{brl(a.cmv.valor)}</td><td className="text-right">{brl(a.faturamento.valor)}</td><td className="text-right font-black">{pct(a.cmvPct)}</td>
                        <td className="text-right">{c?.vsAnterior ? <>{c.vsAnterior.cmvPctPontos != null ? `${seta(c.vsAnterior.cmvPctPontos)} ${c.vsAnterior.cmvPctPontos} p.p.` : ""} {c.vsAnterior.cmv ? `${seta(c.vsAnterior.cmv.valor)} CMV ${fmtBRL(c.vsAnterior.cmv.valor)}` : ""}</> : "—"}</td>
                      </tr>);
                  })}</tbody>
                </table></div>
              )}
              <p className="font-black text-xs mt-3">Inventários fechados</p>
              <div className="flex flex-wrap gap-2 mt-1">{validas.map((c) => {
                const v = (dados.itensPorContagem.get(c.id) || []).reduce((s, i) => s + (Number(i.valor_total) || 0), 0);
                return <a key={c.id} href={`/dashboard/operacao/estoque/contagens?id=${c.id}`} className="rounded-xl border border-line bg-white px-3 py-2 text-xs"><b>{fmtData(c.data_referencia)}</b> · {rotuloTipo(c.tipo)} · {fmtBRL(v)}</a>;
              })}</div>
            </Secao>
            <Compras ap={ap} dados={dados} />
            <Consumidos ap={ap} />
            <EntradasSaidas apurados={apurados} />
            <Precos varPreco={varPreco} dados={dados} />
            <Categorias ap={ap} />
            <Secao titulo={`Alertas (${listaAlertas.length})`}>
              {!listaAlertas.length ? <p className="text-xs text-fg">Nenhum alerta. Alertas só aparecem com histórico suficiente ({CONFIG_CMV.alertas.periodosParaMedia} períodos ou compras anteriores) e passando dos limites abaixo.</p>
                : listaAlertas.map((a, i) => (
                  <div key={i} className="border-t border-line py-2 text-xs">
                    <p className="font-bold">{a.texto}</p>
                    <p className="text-fg">Atual: {typeof a.atual === "number" ? a.atual.toLocaleString("pt-BR") : a.atual}{a.unidade ? ` ${a.unidade}` : ""} · média: {a.media?.toLocaleString?.("pt-BR") ?? a.media}{a.unidade ? ` ${a.unidade}` : ""} · base: {a.base} · fonte: {a.fonte} · limite: {a.limite}</p>
                  </div>))}
              <p className="text-3xs text-fg mt-2">Limites configurados (um lugar só, cmv-real.mjs): preço ±{CONFIG_CMV.alertas.variacaoPrecoPct}%, consumo ±{CONFIG_CMV.alertas.variacaoConsumoPct}%, compra ±{CONFIG_CMV.alertas.variacaoCompraPct}%, estoque ≥ {CONFIG_CMV.alertas.estoqueSobreConsumo}× o consumo médio; médias com os últimos {CONFIG_CMV.alertas.janelaPeriodos} períodos. Alerta não diz a causa.</p>
            </Secao>
            <Parado ap={ap} dados={dados} />
            <Secao titulo="Médias históricas">
              {!medias.suficiente ? <p className="text-xs font-bold">HISTÓRICO INSUFICIENTE PARA MÉDIA ({medias.periodos} período(s) apurado(s); mínimo {medias.minimo}).</p> : (
                <div className="text-xs space-y-1">
                  <p className="text-fg">Média baseada em {medias.periodos} período(s) apurado(s).</p>
                  <p>CMV médio por período: <b>{fmtBRL(medias.cmv)}</b>{medias.cmvPct ? <> · CMV % médio: <b>{pct(medias.cmvPct.valor)}</b> ({medias.cmvPct.periodos} período(s) com faturamento)</> : " · CMV % médio: NÃO APURADO (sem faturamento)"}</p>
                  <p>Compras médias por semana: <b>{fmtBRL(medias.comprasPorSemana)}</b> · Estoque final médio: <b>{fmtBRL(medias.estoqueFinal)}</b>{medias.faturamento != null && <> · Faturamento médio: <b>{fmtBRL(medias.faturamento)}</b></>}</p>
                </div>
              )}
            </Secao>
            <Faturamento ap={ap} dados={dados} unidade={unidadeAtiva} pode={podeFaturamento} onSalvo={carregar} />
            <Secao titulo="Como o CMV é calculado">
              <ul className="text-xs list-disc pl-5 space-y-1">
                <li>CMV R$ = estoque inicial + compras confirmadas do período − estoque final. Compra não é CMV; a conta a pagar e o "cmv" do DRE antigo não entram.</li>
                <li>Estoque inicial e final = valor do inventário FECHADO (quantidade × custo congelado no fechamento). Nunca é revalorizado pelo preço de hoje.</li>
                <li>Período entre contagens: contagem inicial e semanal são consideradas na ABERTURA do dia (o dia entra no período que começa nela); o fechamento do mês é no FIM do dia (o último dia entra no mês). A mesma contagem fecha um período e abre o próximo.</li>
                <li>Compras: confirmadas, pela data de recebimento (ou da compra), com frete e desconto rateados. Canceladas e rascunhos não entram.</li>
                <li>Grupos: cozinha/bar = mercadoria; embalagens = embalagem (entra no CMV, mostrada à parte); limpeza = consumo operacional (fora do CMV). Pelo departamento do produto.</li>
                <li>Produto com estoque ou compra no período e sem contagem na outra ponta → NÃO APURADO (não vira zero). Unidades diferentes do mesmo produto → NÃO APURADO.</li>
                <li>Consumo por produto = inicial + compras − final (consumo APARENTE): inclui vendas, produção, perdas e desperdício sem distinção. O Héfisto não tem hoje perdas datadas por produto (nenhuma etiqueta marcada como perda); transferência entre locais não muda o total da unidade.</li>
                <li>CMV % = CMV R$ ÷ faturamento do mesmo período × 100. Faturamento = vendas − cancelamentos − descontos (não é entrada bancária nem líquido de taxa). Faltou um dia → NÃO APURADO.</li>
              </ul>
            </Secao>
          </>
        )}
      </div>
      {drawer && ap && <Auditoria tipo={drawer} ap={ap} dados={dados} onFechar={() => setDrawer(null)} />}
    </div>
  );
}

function Secao({ titulo, aberta = false, children }) {
  return (
    <details open={aberta} className="bg-card rounded-2xl border border-line p-3 group">
      <summary className="font-black text-sm cursor-pointer flex items-center justify-between list-none">{titulo}<ChevronDown size={16} className="group-open:rotate-180 transition-transform" /></summary>
      <div className="mt-2">{children}</div>
    </details>
  );
}

function Resumo({ ap, onAbrir }) {
  const [rot, cor] = STATUS[ap.status];
  const cards = [
    ["ei", "Estoque inicial", brl(ap.ei.valor), ap.ei.contagem ? `inventário de ${fmtData(ap.ei.contagem.data_referencia)}` : "sem inventário"],
    ["compras", "Compras", fmtBRL(ap.compras.valor), `${ap.compras.confirmadas.length} compra(s) confirmada(s)`],
    ["ef", "Estoque final", brl(ap.ef.valor), ap.ef.contagem ? `inventário de ${fmtData(ap.ef.contagem.data_referencia)}` : "sem inventário"],
    ["cmv", "CMV real", brl(ap.cmv.valor), ap.cmv.valor != null ? "inicial + compras − final" : ap.cmv.parcial != null ? `parcial ${fmtBRL(ap.cmv.parcial)} (não é o CMV)` : ""],
    ["fat", "Faturamento", brl(ap.faturamento.valor), ap.faturamento.valor != null ? "fonte: faturamento informado" : "sem fonte"],
    ["pct", "CMV %", pct(ap.cmvPct), ap.cmvPct != null ? "CMV ÷ faturamento" : ""],
  ];
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`px-3 py-1 rounded-full text-xs font-black ${cor}`}>{rot}</span>
        <span className="text-sm font-bold">Período: {fmtData(ap.periodo.de)} a {ap.status === "em_andamento" ? "hoje" : fmtData(ap.periodo.ate)} ({ap.periodo.dias} dia(s))</span>
      </div>
      {ap.motivos.length > 0 && <ul className="text-xs text-amber-800 list-disc pl-5">{ap.motivos.map((m, i) => <li key={i}>{m}</li>)}</ul>}
      {ap.cmv.valor != null && ap.motivoPct && <p className="text-xs text-amber-800">CMV %: {ap.motivoPct}</p>}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-2">
        {cards.map(([k, r, v, n]) => (
          <button key={k} onClick={() => onAbrir(k)} className="text-left bg-card rounded-2xl border border-line p-3 hover:border-emerald-500">
            <p className="text-3xs font-black uppercase text-fg">{r}</p>
            <p className={`text-lg font-black ${v === NA ? "text-amber-800 text-sm" : ""}`}>{v}</p>
            <p className="text-3xs text-fg">{n}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

function Auditoria({ tipo, ap, dados, onFechar }) {
  const forn = (id) => dados.fornecedorPorId.get(id)?.nome || "Fornecedor não informado";
  const grupos = (pg) => pg && <ul className="text-xs mt-1">{Object.entries(pg).map(([g, v]) => <li key={g}>{ROTULO_GRUPO[g]}: <b>{fmtBRL(v)}</b></li>)}</ul>;
  const contagem = (c, rot, valor, pg) => !c ? <p className="text-sm">Sem inventário fechado nesta ponta do período: {rot} NÃO APURADO.</p> : (
    <div className="text-sm space-y-1">
      <p>{rot} vem do inventário <b>{rotuloTipo(c.tipo)}</b> de <b>{fmtData(c.data_referencia)}</b> ({c.momento === "fechamento" ? "contado no fim do dia" : "contado na abertura do dia"}), fechado em {fmtHora(c.fechada_em)}.</p>
      <p>Valor congelado no fechamento: <b>{fmtBRL(valor)}</b> ({(dados.itensPorContagem.get(c.id) || []).length} produto(s)).</p>{grupos(pg)}
      <a className="underline font-bold text-xs" href={`/dashboard/operacao/estoque/contagens?id=${c.id}`}>Abrir o inventário</a>
    </div>);
  let corpo = null; let titulo = "";
  if (tipo === "ei") { titulo = "Estoque inicial"; corpo = contagem(ap.ei.contagem, "O estoque inicial", ap.ei.valor, ap.ei.porGrupo); }
  if (tipo === "ef") { titulo = "Estoque final"; corpo = contagem(ap.ef.contagem, "O estoque final", ap.ef.valor, ap.ef.porGrupo); }
  if (tipo === "compras") {
    titulo = "Compras do período";
    corpo = (
      <div className="text-xs space-y-2">
        <p>Compras CONFIRMADAS com recebimento (ou compra) de {fmtData(ap.periodo.de)} a {fmtData(ap.periodo.ate)}, com frete e desconto: <b>{fmtBRL(ap.compras.valor)}</b></p>
        <table className="w-full"><tbody>{ap.compras.confirmadas.map((c) => <tr key={c.id} className="border-t border-line"><td className="py-1">{fmtData(c.data_recebimento || c.data_compra)}</td><td>{forn(c.fornecedor_id)}</td><td>{c.numero_documento || "sem documento"}</td><td className="text-right font-bold">{fmtBRL(c.valor_total)}</td></tr>)}</tbody></table>
        {ap.compras.canceladas.length > 0 && <p className="text-fg">Não entram (canceladas): {ap.compras.canceladas.map((c) => `${fmtData(c.data_compra)} ${fmtBRL(c.valor_total)}`).join(" · ")}</p>}
        {ap.compras.rascunhos.length > 0 && <p className="text-fg">Não entram (rascunhos não confirmados): {ap.compras.rascunhos.length}</p>}
        <p>Por grupo:</p>{grupos(ap.compras.porGrupo)}
        <a className="underline font-bold" href="/dashboard/operacao/estoque/compras">Abrir Compras</a>
      </div>);
  }
  if (tipo === "cmv") {
    titulo = "CMV real";
    corpo = ap.cmv.valor == null ? (
      <div className="text-sm space-y-1"><p className="font-black">{NA}</p><ul className="list-disc pl-5 text-xs">{ap.motivos.map((m, i) => <li key={i}>{m}</li>)}</ul>
        {ap.cmv.parcial != null && <p className="text-xs">Só dos produtos contados nas duas pontas: {fmtBRL(ap.cmv.parcial)}. Isto NÃO é o CMV do período.</p>}</div>
    ) : (
      <div className="text-sm space-y-1">
        <p>Estoque inicial {fmtBRL(ap.ei.valor)} + compras {fmtBRL(ap.compras.valor)} − estoque final {fmtBRL(ap.ef.valor)}</p>
        <p className="text-xs text-fg">(totais com tudo; o CMV tira o consumo operacional)</p>
        <p>Mercadoria: <b>{fmtBRL(ap.cmv.mercadoria)}</b> + embalagens: <b>{fmtBRL(ap.cmv.embalagem)}</b> = <b>CMV {fmtBRL(ap.cmv.valor)}</b></p>
        <p className="text-xs">Consumo operacional (limpeza, fora do CMV): {fmtBRL(ap.cmv.operacional)}</p>
      </div>);
  }
  if (tipo === "fat") {
    titulo = "Faturamento";
    corpo = (
      <div className="text-sm space-y-1">
        <p>{ap.faturamento.valor != null ? <>Faturamento do período: <b>{fmtBRL(ap.faturamento.valor)}</b></> : <b>{NA}</b>}</p>
        <p className="text-xs">Origem: {ap.faturamento.fonte || "nenhuma fonte disponível"}.</p>
        {ap.faturamento.motivo && <p className="text-xs text-amber-800">{ap.faturamento.motivo}</p>}
        {ap.faturamento.diasFaltando?.length > 0 && <p className="text-xs">Dias sem registro: {ap.faturamento.diasFaltando.map(fmtData).join(", ")}</p>}
      </div>);
  }
  if (tipo === "pct") {
    titulo = "CMV %";
    corpo = <p className="text-sm">{ap.cmvPct != null ? <>CMV {fmtBRL(ap.cmv.valor)} ÷ faturamento {fmtBRL(ap.faturamento.valor)} × 100 = <b>{pct(ap.cmvPct)}</b></> : <>{NA}: {ap.motivoPct}</>}</p>;
  }
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-end sm:items-center justify-center sm:p-4">
      <div className="bg-card w-full max-w-2xl rounded-t-3xl sm:rounded-3xl max-h-[90vh] flex flex-col">
        <div className="p-5 pb-3 border-b border-line flex justify-between"><h3 className="font-black text-lg">{titulo}</h3><button onClick={onFechar} aria-label="Fechar"><X size={20} /></button></div>
        <div className="p-5 overflow-y-auto">{corpo}</div>
      </div>
    </div>
  );
}

function Compras({ ap, dados }) {
  const a = analiseCompras(ap, { insumoPorId: dados.insumoPorId, fornecedorPorId: dados.fornecedorPorId });
  return (
    <Secao titulo={`Análise de compras · ${fmtBRL(a.total)}`}>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
        {[["Total comprado", fmtBRL(a.total)], ["Compras", a.quantidadeCompras], ["Itens", a.quantidadeItens], ["Fornecedores", a.fornecedores.length], ["Ticket médio", a.ticketMedio == null ? "—" : fmtBRL(a.ticketMedio)]].map(([r, v]) => (
          <div key={r} className="bg-white rounded-xl border border-line p-2"><p className="text-fg font-bold">{r}</p><p className="font-black">{v}</p></div>
        ))}
      </div>
      <div className="grid lg:grid-cols-3 gap-3 mt-3 text-xs">
        <div><p className="font-black">Mais comprados em R$</p>{a.porValor.slice(0, 10).map((p, i) => <p key={p.insumo_id} className="border-t border-line py-0.5">{i + 1}. {p.nome} · <b>{fmtBRL(p.valor)}</b></p>)}</div>
        <div><p className="font-black">Mais comprados em quantidade</p>{["g", "ml", "un"].map((b) => a.porQuantidade[b].length > 0 && <div key={b}><p className="text-fg mt-1">em {rotuloBase(b)}</p>{a.porQuantidade[b].slice(0, 5).map((p) => <p key={p.insumo_id} className="border-t border-line py-0.5">{p.nome} · <b>{qtd(p.q, b)}</b></p>)}</div>)}</div>
        <div><p className="font-black">Maiores custos de compra</p>{["g", "ml", "un"].map((b) => a.maisCaros[b].length > 0 && <div key={b}><p className="text-fg mt-1">por {rotuloBase(b)}</p>{a.maisCaros[b].slice(0, 5).map((p) => <p key={p.insumo_id} className="border-t border-line py-0.5">{p.nome} · <b>{fmtBRL(p.precoMedio)}/{rotuloBase(b)}</b></p>)}</div>)}</div>
      </div>
      {a.fornecedores.length > 0 && <div className="mt-3 text-xs"><p className="font-black">Fornecedores</p>{a.fornecedores.map((f) => <p key={f.nome} className="border-t border-line py-0.5">{f.nome} · {f.compras} compra(s) · <b>{fmtBRL(f.valor)}</b></p>)}</div>}
    </Secao>
  );
}

function Consumidos({ ap }) {
  if (ap.status !== "apurado") return <Secao titulo="Produtos mais consumidos"><p className="text-xs text-fg">Consumo aparente só com o período apurado (inventário inicial e final fechados com todos os produtos).</p></Secao>;
  const m = maisConsumidos(ap);
  return (
    <Secao titulo="Produtos mais consumidos (consumo aparente)">
      <p className="text-3xs text-fg mb-2">Inicial + compras − final. Inclui vendas, produção, perdas e desperdício: não é só venda.</p>
      <div className="grid lg:grid-cols-2 gap-3 text-xs">
        <div><p className="font-black">Por valor</p>{m.porValor.slice(0, 10).map((p, i) => <p key={p.insumo_id} className="border-t border-line py-0.5">{i + 1}. {p.nome} · <b>{fmtBRL(p.consumo_v)}</b> <span className="text-fg">({qtd(p.ei_q, p.unidade_base)} + {qtd(p.compras_q, p.unidade_base)} − {qtd(p.ef_q, p.unidade_base)})</span></p>)}</div>
        <div><p className="font-black">Por quantidade</p>{["g", "ml", "un"].map((b) => m.porQuantidade[b].length > 0 && <div key={b}><p className="text-fg mt-1">em {rotuloBase(b)}</p>{m.porQuantidade[b].slice(0, 5).map((p) => <p key={p.insumo_id} className="border-t border-line py-0.5">{p.nome} · <b>{qtd(p.consumo_q, b)}</b></p>)}</div>)}</div>
      </div>
      {m.negativos.length > 0 && <p className="text-xs text-amber-800 mt-2">Consumo negativo (contou mais no fim do que havia + comprou): {m.negativos.map((p) => p.nome).join(", ")}. Indica erro de contagem ou entrada sem registro.</p>}
    </Secao>
  );
}

function EntradasSaidas({ apurados }) {
  const [grupo, setGrupo] = useState("todos");
  const todos = entradasSaidasPorProduto(apurados);
  const lista = todos.filter((x) => grupo === "todos" || x.grupo === grupo);
  const nPer = apurados.filter((a) => a.status === "apurado").length;
  return (
    <Secao titulo="Entradas e saídas por produto (médias por dia, semana e mês)">
      <p className="text-3xs text-fg">Entrada = compras confirmadas. Saída = inicial + entradas − final (saída física apurada entre contagens; inclui venda, produção, perda e desperdício). Média ponderada pelos dias dos períodos apurados ({nPer}); semana = ×7 e mês = ×30 dias. Inclui embalagens e limpeza.</p>
      <div className="flex flex-wrap gap-1 my-2">{[["todos", "Todos"], ["mercadoria", "Mercadoria"], ["embalagem", "Embalagens"], ["operacional", "Limpeza / operacional"]].map(([g, r]) => (
        <button key={g} onClick={() => setGrupo(g)} className={`px-3 py-1 rounded-lg text-xs font-bold border ${grupo === g ? "bg-slate-900 text-white" : "bg-white border-line"}`}>{r}</button>))}</div>
      {!nPer ? <p className="text-xs font-bold">Ainda não há período apurado: as médias aparecem depois de dois inventários fechados.</p> : !lista.length ? <p className="text-xs text-fg">Nenhum produto neste grupo.</p> : (
        <div className="overflow-x-auto"><table className="w-full text-xs">
          <thead><tr className="text-left text-fg"><th className="py-1">Produto</th><th className="text-right">Entrada/dia</th><th className="text-right">Saída/dia</th><th className="text-right">Saída/semana</th><th className="text-right">Saída/mês</th><th className="text-right">Entrada/mês</th><th className="text-right">Estoque cobre</th><th className="text-right">Base</th></tr></thead>
          <tbody>{lista.slice(0, 60).map((x) => (
            <tr key={`${x.insumo_id}${x.unidade_base}`} className="border-t border-line">
              <td className="py-1 font-bold">{x.nome}<span className="block text-3xs text-fg font-normal">{ROTULO_GRUPO[x.grupo]}</span></td>
              <td className="text-right">{qtd(x.entradaDia, x.unidade_base)}</td><td className="text-right font-black">{qtd(x.saidaDia, x.unidade_base)}</td>
              <td className="text-right">{qtd(x.saidaSemana, x.unidade_base)}</td><td className="text-right">{qtd(x.saidaMes, x.unidade_base)}</td><td className="text-right">{qtd(x.entradaMes, x.unidade_base)}</td>
              <td className="text-right">{x.coberturaDias == null ? "—" : `${x.coberturaDias.toLocaleString("pt-BR")} dia(s)`}</td>
              <td className="text-right text-fg">{x.periodos} per. · {x.dias} dias</td>
            </tr>))}</tbody>
        </table></div>
      )}
    </Secao>
  );
}

function Precos({ varPreco, dados }) {
  const nome = (id) => dados.insumoPorId.get(id)?.nome || "—";
  const comAnterior = varPreco.filter((v) => v.anterior).sort((a, b) => Math.abs(b.pct || 0) - Math.abs(a.pct || 0));
  const [aberto, setAberto] = useState(null);
  return (
    <Secao titulo="Variação de preço">
      {!comAnterior.length ? <p className="text-xs text-fg">É preciso ao menos duas compras confirmadas do mesmo produto.</p> : comAnterior.slice(0, 20).map((v) => (
        <div key={`${v.insumo_id}${v.unidade_base}`} className="border-t border-line py-1 text-xs">
          <button onClick={() => setAberto(aberto === v.insumo_id ? null : v.insumo_id)} className="w-full text-left flex justify-between gap-2">
            <span className="font-bold">{nome(v.insumo_id)}</span>
            <span>{fmtBRL(v.anterior.preco)} → {fmtBRL(v.atual.preco)}/{rotuloBase(v.unidade_base)} · <b className={v.diferenca > 0 ? "text-red-700" : v.diferenca < 0 ? "text-emerald-700" : ""}>{seta(v.diferenca)} {fmtBRL(v.diferenca)} ({v.pct > 0 ? "+" : ""}{v.pct}%)</b></span>
          </button>
          {aberto === v.insumo_id && <div className="pl-3 text-fg">{v.historico.map((h) => <p key={h.compra_id}>{fmtData(h.data)} · {dados.fornecedorPorId.get(h.fornecedor_id)?.nome || "—"} · {fmtBRL(h.preco)}/{rotuloBase(v.unidade_base)}</p>)}</div>}
        </div>
      ))}
      <p className="text-3xs text-fg mt-1">Preço do item na nota (sem frete), por kg / L / un. Compras canceladas não entram.</p>
    </Secao>
  );
}

function Categorias({ ap }) {
  const c = porCategoria(ap);
  return (
    <Secao titulo="Categorias">
      {!c ? <p className="text-xs text-fg">Só com o período apurado.</p> : (
        <div className="grid lg:grid-cols-2 gap-3 text-xs">
          <div><p className="font-black">CMV por categoria do cadastro</p>{c.categorias.map((x) => <p key={x.nome} className="border-t border-line py-0.5 flex justify-between"><span>{x.nome}</span><b>{fmtBRL(x.valor)} · {x.pct}%</b></p>)}</div>
          <div><p className="font-black">Grupos</p>{c.grupos.map((g) => <p key={g.grupo} className="border-t border-line py-0.5 flex justify-between"><span>{g.rotulo}</span><b>{brl(g.valor)}</b></p>)}
            <p className="text-3xs text-fg mt-1">Limpeza é consumo operacional: fica fora do CMV.</p></div>
        </div>
      )}
    </Secao>
  );
}

function Parado({ ap, dados }) {
  const lista = estoqueParado(ap, { compras: dados.compras, itens: dados.comprasItens });
  return (
    <Secao titulo="Estoque com baixo giro">
      {ap.status !== "apurado" ? <p className="text-xs text-fg">Só com o período apurado.</p> : !lista.length ? <p className="text-xs text-fg">Nenhum produto com consumo ≤ {CONFIG_CMV.baixoGiroPct}% do disponível no período.</p> : (
        <table className="w-full text-xs"><thead><tr className="text-left text-fg"><th className="py-1">Produto</th><th className="text-right">Saldo</th><th className="text-right">Valor parado</th><th>Última compra</th><th className="text-right">Consumo no período</th></tr></thead>
          <tbody>{lista.slice(0, 20).map((p) => <tr key={p.insumo_id} className="border-t border-line"><td className="py-1 font-bold">{p.nome}</td><td className="text-right">{qtd(p.ef_q, p.unidade_base)}</td><td className="text-right font-black">{fmtBRL(p.valorParado)}</td><td>{fmtData(p.ultimaCompra)}</td><td className="text-right">{qtd(p.consumo_q, p.unidade_base)}</td></tr>)}</tbody></table>
      )}
    </Secao>
  );
}

function Faturamento({ ap, dados, unidade, pode, onSalvo }) {
  const f = dados.fonteFaturamento;
  const [form, setForm] = useState({ data: "", vendas_brutas: "", cancelamentos: "", descontos: "", fonte: "Saipos — relatório de vendas do dia" });
  const [salvando, setSalvando] = useState(false);
  if (!f.habilitado) return <Secao titulo="Faturamento"><p className="text-xs">{f.motivo}</p><p className="text-3xs text-fg mt-1">Para o CMV %, é possível habilitar o lançamento do faturamento diário (proposta db/F2_4C_FATURAMENTO_DIARIO_OPCIONAL.sql, que depende da sua aprovação).</p></Secao>;
  const dias = []; for (let d = ap.periodo.de; d < ap.periodo.ateExclusivo && dias.length < 62; d = somarDiasIso(d, 1)) dias.push(d);
  const porDia = new Map((f.dias || []).map((x) => [x.data, x]));
  const salvar = async (e) => {
    e.preventDefault(); if (salvando) return; setSalvando(true);
    const r = await salvarFaturamentoDia(supabase, { unidade_id: unidade, ...form });
    setSalvando(false);
    if (r.error) return alert(`Não foi possível salvar: ${r.error}`);
    setForm({ ...form, data: "", vendas_brutas: "", cancelamentos: "", descontos: "" }); await onSalvo();
  };
  return (
    <Secao titulo={`Faturamento do período · ${brl(ap.faturamento.valor)}`}>
      <p className="text-3xs text-fg">Receita = vendas brutas − cancelamentos − descontos (sem taxa de serviço). Lançado por dia, com a fonte.</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-1 mt-2 text-xs">{dias.map((d) => {
        const x = porDia.get(d);
        return <button key={d} onClick={() => pode && setForm({ ...form, data: d, vendas_brutas: x ? String(x.detalhe.vendas_brutas).replace(".", ",") : "", cancelamentos: x ? String(x.detalhe.cancelamentos).replace(".", ",") : "", descontos: x ? String(x.detalhe.descontos).replace(".", ",") : "", fonte: x?.detalhe.fonte || form.fonte })}
          className={`rounded-lg border p-1 text-left ${x ? "border-emerald-200 bg-emerald-50" : "border-amber-300 bg-amber-50"}`}><b>{fmtData(d).slice(0, 5)}</b><br />{x ? fmtBRL(x.valor) : "sem registro"}</button>;
      })}</div>
      {pode && (
        <form onSubmit={salvar} className="grid grid-cols-2 sm:grid-cols-6 gap-2 mt-3 items-end text-xs">
          <label>Data<input type="date" required max={hojeLocal()} value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} className="w-full h-10 px-2 rounded-lg border border-line bg-white font-bold" /></label>
          <label>Vendas brutas<input required inputMode="decimal" value={form.vendas_brutas} onChange={(e) => setForm({ ...form, vendas_brutas: e.target.value })} className="w-full h-10 px-2 rounded-lg border border-line bg-white font-bold" /></label>
          <label>Cancelamentos<input inputMode="decimal" value={form.cancelamentos} onChange={(e) => setForm({ ...form, cancelamentos: e.target.value })} className="w-full h-10 px-2 rounded-lg border border-line bg-white font-bold" /></label>
          <label>Descontos<input inputMode="decimal" value={form.descontos} onChange={(e) => setForm({ ...form, descontos: e.target.value })} className="w-full h-10 px-2 rounded-lg border border-line bg-white font-bold" /></label>
          <label className="sm:col-span-1 col-span-2">Fonte<input required value={form.fonte} onChange={(e) => setForm({ ...form, fonte: e.target.value })} className="w-full h-10 px-2 rounded-lg border border-line bg-white font-bold" /></label>
          <button disabled={salvando} className="h-10 rounded-lg bg-emerald-500 text-white font-black disabled:opacity-50">{salvando ? "Salvando..." : "Salvar dia"}</button>
        </form>
      )}
    </Secao>
  );
}
