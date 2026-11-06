"use client";

// Metas do Restaurante: as mesmas regras da Marmitaria (metas-negocio.mjs), com o
// faturamento diário do Financeiro e os custos do Resultado do mês.

import { useEffect, useMemo, useState } from "react";
import { supabase, isSupabaseReady } from "../../../lib/supabase";
import { estruturaDoMes, gargaloDaEstrutura, porPeriodo, previsaoDoMes, vendasDoMes } from "../../../lib/metas-negocio.mjs";
import { Estrutura, Projecao, TabelaDePeriodos, brl } from "../../../components/metas/BlocosDeMetas";

const ultimoDia = (mes) => {
  const [a, m] = mes.split("-").map(Number);
  return `${mes}-${String(new Date(a, m, 0).getDate()).padStart(2, "0")}`;
};

function Caixa({ titulo, subtitulo, children }) {
  return (
    <section className="rounded-2xl border border-hf-border bg-hf-surface p-4">
      <h2 className="text-base font-black text-hf-text">{titulo}</h2>
      {subtitulo && <p className="text-xs text-hf-muted">{subtitulo}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

export default function MetasDoRestaurante({ unidadeId, mes, modelo, resultado, cmo }) {
  const [diario, setDiario] = useState({ linhas: [], erro: "" });
  const hoje = new Date().toLocaleDateString("sv-SE");
  const referencia = mes === hoje.slice(0, 7) ? hoje : ultimoDia(mes);

  useEffect(() => {
    if (!unidadeId || !isSupabaseReady()) return undefined;
    let vivo = true;
    supabase.from("fin_faturamento_diario").select("data, vendas_brutas, descontos, cancelamentos")
      .eq("unidade_id", unidadeId).gte("data", `${mes}-01`).lte("data", ultimoDia(mes)).order("data")
      .then(({ data, error }) => { if (vivo) setDiario({ linhas: data || [], erro: error ? "Não foi possível ler o faturamento diário." : "" }); });
    return () => { vivo = false; };
  }, [unidadeId, mes]);

  const d = useMemo(() => {
    const diasMes = resultado.dias > 0 ? resultado.dias : null;
    const metaMes = Number(modelo.meta_faturamento) > 0 ? Number(modelo.meta_faturamento) : null;
    const equilibrioMes = resultado.equilibrio?.mes ?? null;
    const dias = vendasDoMes(diario.linhas.map((l) => ({ data: l.data, valor_bruto: l.vendas_brutas, descontos: l.descontos, cancelamentos: l.cancelamentos, quantidade: 0 })), referencia);
    const prev = previsaoDoMes({ dias, hojeIso: referencia, diasMes, metaMes, equilibrioMes });
    const linha = (id) => resultado.linhas.find((l) => l.id === id);
    const itens = (id) => (linha(id)?.itens || []).filter((i) => Number(i.valor) > 0).map((i) => ({ nome: i.nome, valor: i.valor }));
    const faturamento = resultado.faturamento > 0 ? resultado.faturamento : prev.ok ? prev.previsto : null;
    const estrutura = estruturaDoMes({
      faturamento, cmvPct: linha("cmv")?.pct ?? null,
      cmoLinhas: (cmo?.pessoas || []).filter((p) => p.total > 0).map((p) => ({ nome: p.nome, valor: p.total })),
      fixosLinhas: [...itens("fixos"), ...itens("outros")],
    });
    return { diasMes, metaMes, equilibrioMes, dias, prev, estrutura, gargalo: gargaloDaEstrutura(estrutura),
      periodoEq: porPeriodo(equilibrioMes, diasMes), periodoMeta: porPeriodo(metaMes, diasMes) };
  }, [diario, modelo, resultado, cmo, referencia]);

  return (
    <>
      <Caixa titulo="Metas" subtitulo="Ponto de equilíbrio e meta de faturamento por período.">
        <TabelaDePeriodos equilibrio={d.periodoEq} meta={d.periodoMeta} />
        {!d.metaMes && <p className="mt-2 text-xs text-hf-text-2">Informe a meta de faturamento do mês em Vendas, impostos e cartão.</p>}
      </Caixa>
      <Caixa titulo="Projeção de faturamento" subtitulo="Calculada pelo faturamento diário lançado no Financeiro e pelas comandas.">
        {diario.erro ? <p className="text-sm font-bold text-hf-danger">{diario.erro}</p>
          : <Projecao p={d.prev} dias={d.dias} metaMes={d.metaMes} equilibrioMes={d.equilibrioMes} plano={null} />}
      </Caixa>
      {d.estrutura && (
        <Caixa titulo="Estrutura de custos" subtitulo={`Sobre ${brl(d.estrutura.faturamento)}. Abra cada grupo para ver o detalhe por pessoa e por conta.`}>
          {d.gargalo && <p className="mb-2 rounded-xl border border-hf-danger/40 bg-hf-danger/10 p-3 text-sm text-hf-text"><b>Principal gargalo: {d.gargalo.rotulo}.</b> Está em {String(d.gargalo.pct).replace(".", ",")}%, acima de {d.gargalo.limite}%. O excesso reduz o lucro em {brl(d.gargalo.excesso)} por mês.</p>}
          <Estrutura e={d.estrutura} />
        </Caixa>
      )}
    </>
  );
}
