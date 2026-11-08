"use client";

// "Vou preparar agora" na folha do prato/drink (pedido do dono, 08/11/2026):
// tudo no clique. Pergunta se tem todos os ingredientes; se não, a pessoa marca
// o que tem (Tenho / Tenho menos / Não tenho) ou preenche pelo estoque, e a
// receita é refeita para o que dá (conta determinística em adaptar-receita.mjs).
// Faltou um ingrediente: avisa e oferece pedir uma sugestão de substituto, que
// vem do assistente marcada como sugestão. Nada aqui grava no sistema.

import { useMemo, useState } from "react";
import { adaptarReceita, qtdLegivel, rotuloDoFator, unidadeDeTela } from "../../lib/intelligence/metrics/adaptar-receita.mjs";

const VERDE = "var(--wa-verde-escuro, var(--hf-accent))";
const META = "var(--wa-meta, var(--hf-muted))";
const FUNDO = "rgba(0, 90, 73, 0.07)";

function Botao({ children, onClick, ativo = false, cheio = false, disabled = false }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className="min-h-[44px] rounded-xl px-3 text-[15px] font-semibold transition active:scale-[0.98] disabled:opacity-50"
      style={cheio || ativo ? { background: VERDE, color: "#fff" } : { background: FUNDO, color: VERDE }}>
      {children}
    </button>
  );
}

export default function PrepararReceita({ folha, onComando }) {
  const ings = folha.ingredientes || [];
  const [etapa, setEtapa] = useState(folha.preparar ? "pergunta" : "fechado");
  const [disp, setDisp] = useState({}); // índice → { estado, qtd (na unidade do cadastro) }
  const [mult, setMult] = useState(1);
  const temEstoque = ings.some((i) => i.estoque != null && i.qtd > 0);
  const resultado = useMemo(() => adaptarReceita(ings, disp, { multiplicar: mult, rendimentoQtd: folha.rendimentoQtd, rendimentoUnidade: folha.rendimentoUnidade }), [ings, disp, mult, folha.rendimentoQtd, folha.rendimentoUnidade]);

  if (!ings.length) return null;
  const marcar = (i, estado, qtd) => setDisp((d) => ({ ...d, [i]: { estado, qtd: qtd ?? d[i]?.qtd } }));
  const pelaEstoque = () => {
    const novo = {};
    ings.forEach((ing, i) => {
      if (ing.estoque == null || !(ing.qtd > 0)) return;
      const precisa = ing.qtd * mult;
      novo[i] = ing.estoque <= 0 ? { estado: "nao" } : ing.estoque >= precisa ? { estado: "tem" } : { estado: "pouco", qtd: ing.estoque };
    });
    setDisp(novo);
  };

  if (etapa === "fechado") {
    return (
      <div className="pt-1">
        <Botao cheio onClick={() => setEtapa("pergunta")}>🧑‍🍳 Vou preparar agora</Botao>
      </div>
    );
  }

  return (
    <section className="space-y-3 rounded-xl p-3" style={{ background: FUNDO }} aria-label="Preparar agora">
      {etapa === "pergunta" ? (
        <>
          <p className="text-[16px] font-semibold">Você tem todos os ingredientes?</p>
          <div className="grid grid-cols-2 gap-2">
            <Botao cheio onClick={() => { setDisp({}); setEtapa("pronto"); }}>Sim, tenho tudo</Botao>
            <Botao onClick={() => setEtapa("checar")}>Não, falta algo</Botao>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[13.5px]" style={{ color: META }}>Fazer outra quantidade:</span>
            {[0.5, 2, 3].map((m) => (
              <Botao key={m} onClick={() => { setMult(m); setDisp({}); setEtapa("pronto"); }}>{m === 0.5 ? "metade" : `${m}×`}</Botao>
            ))}
          </div>
        </>
      ) : null}

      {etapa === "checar" ? (
        <>
          <p className="text-[16px] font-semibold">Marque o que você tem</p>
          {temEstoque ? <Botao onClick={pelaEstoque}>Preencher pelo estoque</Botao> : null}
          <ul className="space-y-2.5">
            {ings.map((ing, i) => {
              const d = disp[i] || { estado: "tem" };
              const tela = unidadeDeTela(ing.unidade, ing.qtd);
              return (
                <li key={i} className="space-y-1.5 rounded-lg bg-white p-2.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[15px] font-semibold leading-tight">{ing.nome}</span>
                    <span className="shrink-0 text-[14px] tabular-nums" style={{ color: META }}>precisa {ing.quantidade}</span>
                  </div>
                  {ing.estoque != null ? <p className="text-[13px]" style={{ color: META }}>No estoque: {qtdLegivel(ing.estoque, ing.unidade)}</p> : null}
                  <div className="grid grid-cols-3 gap-1.5">
                    <Botao ativo={d.estado === "tem"} onClick={() => marcar(i, "tem")}>Tenho</Botao>
                    <Botao ativo={d.estado === "pouco"} disabled={!(ing.qtd > 0)} onClick={() => marcar(i, "pouco", ing.estoque != null && ing.estoque < ing.qtd ? ing.estoque : ing.qtd / 2)}>Tenho menos</Botao>
                    <Botao ativo={d.estado === "nao"} onClick={() => marcar(i, "nao")}>Não tenho</Botao>
                  </div>
                  {d.estado === "pouco" ? (
                    <label className="flex items-center gap-2 text-[14px]">
                      Tenho
                      <input type="number" inputMode="decimal" min="0" step="any"
                        value={d.qtd != null ? Math.round(d.qtd * tela.mult * 1000) / 1000 : ""}
                        onChange={(e) => marcar(i, "pouco", e.target.value === "" ? null : Number(e.target.value) / tela.mult)}
                        className="h-11 w-24 rounded-lg border border-black/15 px-2 text-[16px] tabular-nums" aria-label={`Quanto você tem de ${ing.nome} (${tela.rotulo})`} />
                      <span>{tela.rotulo}</span>
                    </label>
                  ) : null}
                </li>
              );
            })}
          </ul>
          <div className="grid grid-cols-2 gap-2">
            <Botao onClick={() => setEtapa("pergunta")}>Voltar</Botao>
            <Botao cheio onClick={() => setEtapa("pronto")}>Adaptar a receita</Botao>
          </div>
        </>
      ) : null}

      {etapa === "pronto" ? (
        <>
          {!resultado.possivel ? (
            <p className="text-[16px] font-semibold">Com essa quantidade não dá para fazer a receita. Confira o que você marcou.</p>
          ) : (
            <p className="text-[16px] font-semibold">
              {Object.keys(disp).length || mult !== 1 ? `Dá para fazer ${rotuloDoFator(resultado.fator)}` : "Pode fazer a receita inteira"}
              {resultado.rendimento ? ` · rende ${resultado.rendimento}` : ""}.
            </p>
          )}
          {resultado.limitante && resultado.fator < mult ? <p className="text-[14px]" style={{ color: META }}>Quem limita é {resultado.limitante}.</p> : null}
          {resultado.possivel ? (
            <ul className="space-y-1">
              {resultado.ingredientes.map((it, i) => (
                <li key={i} className="flex items-baseline justify-between gap-2 text-[15px]">
                  <span className={it.falta ? "line-through opacity-60" : ""}>{it.nome}</span>
                  <strong className="shrink-0 tabular-nums" style={it.falta ? { color: "#B42318" } : undefined}>{it.quantidade}</strong>
                </li>
              ))}
            </ul>
          ) : null}
          {resultado.semConta.length ? <p className="text-[13.5px]" style={{ color: META }}>Sem conta (quantidade não informada): {resultado.semConta.join(", ")}.</p> : null}
          {resultado.faltando.length ? (
            <div className="space-y-2 rounded-lg bg-white p-2.5">
              <p className="text-[14.5px]"><strong>Sem {resultado.faltando.join(", ")}</strong>, a receita não sai igual à da ficha. Fale com o chef antes de servir.</p>
              {onComando ? resultado.faltando.map((n) => (
                <Botao key={n} onClick={() => onComando(`O que posso usar no lugar de ${n} no ${folha.nome}?`)}>O que uso no lugar de {n}?</Botao>
              )) : null}
            </div>
          ) : null}
          <p className="text-[12.5px]" style={{ color: META }}>Conta feita com a ficha técnica e o que você marcou. Siga o modo de preparo abaixo com estas quantidades.</p>
          <div className="grid grid-cols-2 gap-2">
            <Botao onClick={() => setEtapa("checar")}>Mudar o que tenho</Botao>
            <Botao onClick={() => { setDisp({}); setMult(1); setEtapa("pergunta"); }}>Recomeçar</Botao>
          </div>
        </>
      ) : null}
    </section>
  );
}
