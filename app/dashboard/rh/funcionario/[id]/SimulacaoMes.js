"use client";

// Cálculo do mês pelo motor de direitos (HDEV-RH-001, Fases 4 e 4b).
// Usa o vínculo real (rh_vinculos), o ponto do mês e as regras da competência.
// Nasce como SIMULAÇÃO e não lança nada no Financeiro. O RH pode registrar o
// retrato (RH-5) e o contador validar ou reabrir: quem decide é o banco
// (rh_calculo_registrar / _validar / _reabrir); a tela só mostra o que cabe.

import { useCallback, useEffect, useState } from "react";
import { Card, SectionLabel, Btn, fmtBRL } from "../../../../components/ui";
import { fetchVinculos } from "../../../../lib/vinculos-dados";
import { calcularMes, diasDoMes, mesmoResultado, SITUACOES, MOTOR_VERSAO } from "../../../../lib/trabalhista/motor-direitos.mjs";
import { tabelaDaCompetencia } from "../../../../lib/trabalhista/tabelas-oficiais.mjs";
import { fetchCalculoMes, registrarCalculoMes, validarCalculoMes, reabrirCalculoMes } from "../../../../lib/trabalhista/calculos-dados";

const TIPOS = { provento: "Proventos", beneficio: "Benefícios", desconto: "Descontos", encargo: "Encargos do empregador", provisao: "Provisões do mês (custo, não sai no holerite)" };
const ROTULO = { simulacao: "Simulação", calculo_validado: "Validado pelo contador", pagamento_registrado: "Pagamento registrado", obrigacao_cumprida: "Obrigação cumprida" };
const TOM = {
  simulacao: "bg-amber-50 text-amber-900 border-amber-300",
  calculo_validado: "bg-emerald-50 text-emerald-800 border-emerald-200",
  pagamento_registrado: "bg-sky-50 text-sky-800 border-sky-200",
  obrigacao_cumprida: "bg-zinc-100 text-zinc-700 border-zinc-300",
};
const dataHora = (s) => (s ? new Date(s).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "");

export default function SimulacaoMes({ colaborador, competencia, ponto, adicionais, podeRegistrar, podeValidar, onAviso }) {
  const [vinculo, setVinculo] = useState(undefined);
  const [gravado, setGravado] = useState(undefined); // { data, disponivel }
  const [aberto, setAberto] = useState(null);
  const [acao, setAcao] = useState(null); // "validar" | "reabrir"
  const [texto, setTexto] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  const carregarGravado = useCallback(async () => {
    const r = await fetchCalculoMes(colaborador.id, competencia);
    setGravado(r);
  }, [colaborador.id, competencia]);

  useEffect(() => {
    let vivo = true;
    fetchVinculos(colaborador.id).then(({ data }) => { if (vivo) setVinculo((data || []).find((v) => !v.fim) || null); });
    carregarGravado();
    return () => { vivo = false; };
  }, [colaborador.id, carregarGravado]);

  if (vinculo === undefined || gravado === undefined || !ponto) return <Card><SectionLabel>Cálculo do mês</SectionLabel><p className="text-sm text-hf-muted">Carregando...</p></Card>;

  const r = calcularMes(vinculo, {
    competencia,
    adicionais: adicionais?.ad,
    regras: adicionais?.rg,
    ...diasDoMes(competencia, ponto.feriados || []),
    taxaServico: colaborador.taxa_servico_mes,
    valeAlimentacao: colaborador.vale_alimentacao,
  });
  const mesBR = competencia.split("-").reverse().join("/");
  const g = gravado.data;
  const situacao = g?.situacao || "simulacao";
  const desatualizado = g && !mesmoResultado(g, r);
  // validado: mostra o que foi validado, não a conta de agora
  const exibido = g && situacao !== "simulacao" ? { linhas: g.linhas, totais: g.totais, pendencias: g.pendencias } : r;

  const executar = async (fn, ok) => {
    setEnviando(true); setErro("");
    const { error } = await fn();
    setEnviando(false);
    if (error) return setErro(error);
    setAcao(null); setTexto("");
    onAviso?.(ok);
    carregarGravado();
  };
  const registrar = () => executar(() => registrarCalculoMes(colaborador.id, competencia, r, {
    motor_versao: MOTOR_VERSAO, tabela_desde: tabelaDaCompetencia(competencia)?.desde || null, regras_id: adicionais?.rg?.id || null,
  }), "Cálculo do mês registrado como simulação.");

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SectionLabel>Cálculo do mês · {mesBR}</SectionLabel>
        <span className={`text-2xs font-bold px-2 py-1 rounded-full border ${TOM[situacao]}`} title={SITUACOES[situacao]}>
          {ROTULO[situacao]}{g ? ` · versão ${g.versao}` : " · não registrada"}
        </span>
      </div>
      <p className="text-2xs text-hf-muted mb-3">
        {SITUACOES[situacao]}.{g && situacao === "calculo_validado" ? ` Em ${dataHora(g.validado_em)}${g.observacao_validacao ? `: "${g.observacao_validacao}"` : ""}.` : ""} Não lança nada no Financeiro. Toque numa linha para ver o fundamento.
      </p>
      {desatualizado && (
        <p className="text-2xs mb-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 p-2">
          {situacao === "simulacao"
            ? "O ponto ou o cadastro mudou depois do registro: os números abaixo são os de agora. Registre de novo para guardar."
            : `O cálculo de agora dá líquido ${fmtBRL(r.totais?.liquido)}, diferente do validado. Para usar o novo, o contador precisa reabrir.`}
        </p>
      )}

      {exibido.totais && Object.entries(TIPOS).map(([tipo, titulo]) => {
        const ls = (exibido.linhas || []).filter((l) => l.tipo === tipo);
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

      {exibido.totais && (
        <div className="grid grid-cols-2 gap-2 mt-2 text-sm">
          <div className="rounded-xl border border-hf-border p-3"><p className="text-2xs text-hf-muted">Líquido estimado</p><b className="text-lg">{fmtBRL(exibido.totais.liquido)}</b></div>
          <div className="rounded-xl border border-hf-border p-3"><p className="text-2xs text-hf-muted">Custo do mês para a empresa*</p><b className="text-lg">{fmtBRL(exibido.totais.custoEmpresa)}</b></div>
          <p className="col-span-2 text-2xs text-hf-muted">* proventos + benefícios + FGTS + provisões. Sem os encargos patronais, que dependem do regime tributário.</p>
        </div>
      )}

      {(exibido.pendencias || []).length > 0 && (
        <div className="mt-3 rounded-xl bg-amber-50 border border-amber-200 p-3">
          <p className="text-2xs font-bold text-amber-900 mb-1">Antes de usar este número</p>
          <ul className="list-disc pl-4 text-2xs text-amber-900 space-y-0.5">{exibido.pendencias.map((p) => <li key={p}>{p}</li>)}</ul>
        </div>
      )}

      {gravado.disponivel && r.totais && (
        <div className="mt-4 no-print space-y-2">
          <div className="flex flex-wrap gap-2">
            {podeRegistrar && situacao === "simulacao" && (!g || desatualizado) && (
              <Btn variant="ghost" disabled={enviando} onClick={registrar}>{g ? "Registrar de novo" : "Registrar simulação"}</Btn>
            )}
            {podeValidar && g && situacao === "simulacao" && !desatualizado && <Btn variant="primary" disabled={enviando} onClick={() => { setAcao("validar"); setErro(""); }}>Validar cálculo</Btn>}
            {podeValidar && g && situacao === "calculo_validado" && <Btn variant="ghost" disabled={enviando} onClick={() => { setAcao("reabrir"); setErro(""); }}>Reabrir</Btn>}
          </div>
          {acao && (
            <div className="rounded-xl border border-hf-border p-3 space-y-2">
              <p className="text-xs font-semibold text-hf-text">
                {acao === "validar"
                  ? (g.pendencias || []).length ? `Há ${g.pendencias.length} pendência(s): escreva como foram resolvidas.` : "Observação (opcional)."
                  : "Motivo da reabertura (fica no histórico)."}
              </p>
              <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={2} className="w-full rounded-lg border border-hf-border bg-transparent p-2 text-sm" />
              <div className="flex gap-2">
                <Btn variant="primary" disabled={enviando} onClick={() => acao === "validar"
                  ? executar(() => validarCalculoMes(g.id, texto), "Cálculo validado.")
                  : executar(() => reabrirCalculoMes(g.id, texto), "Cálculo reaberto: voltou a ser simulação.")}>
                  {acao === "validar" ? "Confirmar validação" : "Confirmar reabertura"}
                </Btn>
                <Btn variant="ghost" onClick={() => { setAcao(null); setTexto(""); setErro(""); }}>Cancelar</Btn>
              </div>
            </div>
          )}
          {erro && <p className="text-xs text-rose-700">{erro}</p>}
        </div>
      )}
    </Card>
  );
}
