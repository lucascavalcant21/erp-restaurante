"use client";

// Regras numéricas: "ponto" (tolerâncias) e "metas" (CMV, CMO, desconto da
// equipe, reposição). Cada uma é uma tela curta; salvar grava o conjunto todo
// de parâmetros (o mesmo registro de antes), mudando só os campos desta tela.

import { useEffect, useMemo, useState } from "react";
import { useERP } from "../../../context/ERPContext";
import { fetchParams, salvarParams, PARAMS_PADRAO } from "../../../lib/parametros";
import { Painel, Bloco, BotaoSalvar, SemUnidade, avisarSalvo } from "./ui";

export const GRUPOS_PARAMS = {
  ponto: {
    titulo: "Ponto",
    descricao: "Como o relógio de ponto trata atraso e tolerância. Vale na próxima batida.",
    campos: [
      ["tolerancia_entrada", "Libera a entrada antes do turno", "min"],
      ["tolerancia_marcacao", "Tolerância na entrada e na saída", "min", "Até aqui grava o horário do turno (Súmula 366 do TST)."],
      ["tolerancia_retorno", "Tolerância na volta do intervalo", "min"],
      ["limite_atraso", "Atraso que vira falta", "min", "Passou disso, a entrada bloqueia e conta falta."],
      ["lembrete_min", "Lembrete antes da entrada e do fim do intervalo", "min"],
    ],
  },
  metas: {
    titulo: "Metas e descontos",
    descricao: "Números que os painéis usam para alertar.",
    campos: [
      ["meta_cmv", "Meta de CMV", "%", "Acima disso o painel mostra em vermelho."],
      ["faturamento_minimo_cmo", "Faturamento mínimo para calcular o CMO", "R$", "Abaixo disso o CMO % fica em branco."],
      ["desconto_func_pct", "Desconto da equipe no consumo", "%"],
      ["fator_reposicao", "Lista de compras repõe até", "× mínimo", "Ex.: 2 = compra até o dobro do estoque mínimo."],
    ],
  },
};

export default function Parametros({ grupo, onVoltar }) {
  const g = GRUPOS_PARAMS[grupo];
  const { unidadeAtiva } = useERP();
  const real = unidadeAtiva && unidadeAtiva !== "todas";
  const [orig, setOrig] = useState(null);
  const [p, setP] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [ok, setOk] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => { if (real) fetchParams(unidadeAtiva).then((r) => { setOrig(r.data); setP(r.data); }); }, [unidadeAtiva, real]);

  const chaves = g.campos.map(([k]) => k);
  const mudou = useMemo(() => p && orig && chaves.some((k) => String(p[k]) !== String(orig[k])), [p, orig]); // eslint-disable-line react-hooks/exhaustive-deps
  const invalido = p && chaves.some((k) => p[k] === "" || !Number.isFinite(Number(p[k])) || Number(p[k]) < 0);

  const salvar = async () => {
    setErro("");
    setSalvando(true);
    const { error } = await salvarParams(unidadeAtiva, { ...orig, ...Object.fromEntries(chaves.map((k) => [k, Number(p[k])])) });
    setSalvando(false);
    if (error) return setErro(`Não salvou: ${error}`);
    setOrig(p);
    avisarSalvo(setOk);
  };

  if (!real) return <Painel titulo={g.titulo} onVoltar={onVoltar}><SemUnidade /></Painel>;

  return (
    <Painel titulo={g.titulo} descricao={g.descricao} onVoltar={onVoltar}
      rodape={<>
        <BotaoSalvar onClick={salvar} salvando={salvando} ok={ok} desabilitado={!mudou || invalido} />
        <button type="button" onClick={() => setP((x) => ({ ...x, ...Object.fromEntries(chaves.map((k) => [k, PARAMS_PADRAO[k]])) }))} className="h-12 rounded-xl px-3 text-[14px] font-medium text-hf-muted">Usar o padrão</button>
        {erro && <span className="text-[13px] font-medium text-hf-danger">{erro}</span>}
      </>}>
      {!p ? <p className="text-[14px] text-hf-muted">Carregando…</p> : (
        <Bloco>
          {g.campos.map(([k, rotulo, unidade, dica]) => (
            <label key={k} className="block">
              <span className="flex items-center gap-3">
                <span className="min-w-0 flex-1 text-[15px] font-medium text-hf-text">{rotulo}</span>
                <span className="flex h-12 w-[132px] shrink-0 items-center rounded-xl border border-hf-border bg-hf-surface focus-within:border-hf-accent">
                  {unidade === "R$" && <span className="pl-3 text-[14px] text-hf-muted">R$</span>}
                  <input type="number" inputMode="decimal" min="0" value={p[k]} onChange={(e) => setP((x) => ({ ...x, [k]: e.target.value === "" ? "" : Number(e.target.value) }))}
                    className="h-full w-full min-w-0 bg-transparent px-3 text-right text-[16px] font-semibold text-hf-text outline-none" />
                  {unidade !== "R$" && <span className="pr-3 text-[13px] text-hf-muted whitespace-nowrap">{unidade}</span>}
                </span>
              </span>
              <span className="mt-1 block text-[13px] text-hf-muted">{dica ? `${dica} ` : ""}Padrão: {PARAMS_PADRAO[k]}{unidade === "R$" ? "" : ` ${unidade}`}.</span>
            </label>
          ))}
        </Bloco>
      )}
    </Painel>
  );
}
