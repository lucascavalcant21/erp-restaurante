"use client";

// Simulação do mês pelo motor de direitos (HDEV-RH-001, Fase 4).
// Usa o vínculo real (rh_vinculos), o ponto do mês e as regras da competência.
// É SIMULAÇÃO: não grava nada, não lança no Financeiro, não substitui a
// conferência do contador. Cada linha mostra o fundamento.

import { useEffect, useState } from "react";
import { Card, SectionLabel, fmtBRL } from "../../../../components/ui";
import { fetchVinculos } from "../../../../lib/vinculos-dados";
import { calcularMes, diasDoMes, SITUACOES } from "../../../../lib/trabalhista/motor-direitos.mjs";

const TIPOS = { provento: "Proventos", beneficio: "Benefícios", desconto: "Descontos", encargo: "Encargos do empregador", provisao: "Provisões do mês (custo, não sai no holerite)" };

export default function SimulacaoMes({ colaborador, competencia, ponto, adicionais }) {
  const [vinculo, setVinculo] = useState(undefined);
  const [aberto, setAberto] = useState(null);

  useEffect(() => {
    let vivo = true;
    fetchVinculos(colaborador.id).then(({ data }) => { if (vivo) setVinculo((data || []).find((v) => !v.fim) || null); });
    return () => { vivo = false; };
  }, [colaborador.id]);

  if (vinculo === undefined || !ponto) return <Card><SectionLabel>Simulação do mês</SectionLabel><p className="text-sm text-hf-muted">Carregando...</p></Card>;

  const r = calcularMes(vinculo, {
    competencia,
    adicionais: adicionais?.ad,
    regras: adicionais?.rg,
    ...diasDoMes(competencia, ponto.feriados || []),
    taxaServico: colaborador.taxa_servico_mes,
    valeAlimentacao: colaborador.vale_alimentacao,
  });
  const mesBR = competencia.split("-").reverse().join("/");

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SectionLabel>Simulação do mês · {mesBR}</SectionLabel>
        <span className="text-2xs font-bold px-2 py-1 rounded-full border bg-amber-50 text-amber-900 border-amber-300" title={SITUACOES.simulacao}>Simulação</span>
      </div>
      <p className="text-2xs text-hf-muted mb-3">{SITUACOES.simulacao}. Não lança nada no Financeiro. Toque numa linha para ver o fundamento.</p>

      {r.totais && Object.entries(TIPOS).map(([tipo, titulo]) => {
        const ls = r.linhas.filter((l) => l.tipo === tipo);
        if (!ls.length) return null;
        return (
          <div key={tipo} className="mb-3">
            <p className="text-2xs font-bold uppercase tracking-wide text-hf-text-2 mb-1">{titulo}</p>
            {ls.map((l) => (
              <button key={l.codigo} type="button" onClick={() => setAberto(aberto === l.codigo ? null : l.codigo)} className="w-full text-left py-1.5 border-b border-hf-border/60">
                <span className="flex justify-between gap-3 text-sm">
                  <span className="text-hf-text">{l.descricao}{l.exigeRevisao && <span className="ml-1 text-amber-700" title={l.motivo || "Exige revisão"}>⚠</span>}</span>
                  <b className={tipo === "desconto" ? "text-rose-700" : "text-hf-text"}>{tipo === "desconto" ? "− " : ""}{fmtBRL(l.valor)}</b>
                </span>
                {aberto === l.codigo && (
                  <span className="block text-2xs text-hf-muted mt-1">
                    {l.base != null && <>Base: {fmtBRL(l.base)} · </>}{l.fundamento}{l.motivo && <><br /><span className="text-amber-800">{l.motivo}</span></>}
                  </span>
                )}
              </button>
            ))}
          </div>
        );
      })}

      {r.totais && (
        <div className="grid grid-cols-2 gap-2 mt-2 text-sm">
          <div className="rounded-xl border border-hf-border p-3"><p className="text-2xs text-hf-muted">Líquido estimado</p><b className="text-lg">{fmtBRL(r.totais.liquido)}</b></div>
          <div className="rounded-xl border border-hf-border p-3"><p className="text-2xs text-hf-muted">Custo do mês para a empresa*</p><b className="text-lg">{fmtBRL(r.totais.custoEmpresa)}</b></div>
          <p className="col-span-2 text-2xs text-hf-muted">* proventos + benefícios + FGTS + provisões. Sem os encargos patronais, que dependem do regime tributário.</p>
        </div>
      )}

      {r.pendencias.length > 0 && (
        <div className="mt-3 rounded-xl bg-amber-50 border border-amber-200 p-3">
          <p className="text-2xs font-bold text-amber-900 mb-1">Antes de usar este número</p>
          <ul className="list-disc pl-4 text-2xs text-amber-900 space-y-0.5">{r.pendencias.map((p) => <li key={p}>{p}</li>)}</ul>
        </div>
      )}
    </Card>
  );
}
