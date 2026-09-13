"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { fatiasDoPrato, setorDonut, centroDoSetor } from "../../../lib/pizza-do-prato.mjs";

const fmt = (v) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// Abaixo disto a fatia é fina demais para caber um número legível dentro. Esse
// caso não fica sem rótulo: a legenda abaixo traz todos, sempre.
const PCT_MINIMO_ROTULO = 7;

// Contraste medido contra cada cor: branco reprova sobre o verde (2,54) e passa
// em todos os degraus de custo; no verde quem passa é o slate escuro (7,04).
const tintaDaFatia = (id) => (id === "lucro" ? "#0F172A" : "#FFFFFF");

/* A pizza do prato: para onde vai cada real da venda.
 *
 * A rosca (e não a pizza cheia) é de propósito: o buraco do meio carrega o
 * número que a pessoa veio buscar — quanto sobra — sem competir com as fatias.
 */
export default function PizzaDoPrato({
  preco, custoIngredientes, custoEmbalagem, impostoPct, taxaMaquininhaPct, params,
  partesCmv = null, partesCmo = null, compacta = false,
}) {
  const [emFoco, setEmFoco] = useState(null);
  // Qual segmento está aberto. Um por vez: abrir todos de uma vez devolve a
  // parede de números que a rosca existe para evitar.
  const [aberto, setAberto] = useState(null);
  const dados = fatiasDoPrato({ preco, custoIngredientes, custoEmbalagem, impostoPct, taxaMaquininhaPct, params, partesCmv, partesCmo });
  const { fatias, prejuizo, lucro, preco: precoVenda, rateavel } = dados;

  if (!fatias.length) {
    return (
      <p className="rounded-xl bg-slate-50 px-3 py-4 text-center text-2xs font-bold text-subtle">
        Sem preço de venda: não dá para dividir a pizza.
      </p>
    );
  }

  const tam = compacta ? 150 : 172;
  const centro = tam / 2;
  const rExt = centro - 4;
  const rInt = rExt * 0.58;

  let anguloAtual = 0;
  const setores = fatias.map((f) => {
    const varrer = (f.pct / 100) * 360;
    const s = { ...f, inicio: anguloAtual, fim: anguloAtual + varrer };
    anguloAtual += varrer;
    return s;
  });

  const pctLucro = fatias.find((f) => f.id === "lucro")?.pct || 0;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative shrink-0" style={{ width: tam, height: tam }}>
        <svg width={tam} height={tam} viewBox={`0 0 ${tam} ${tam}`} role="img"
          aria-label={prejuizo > 0 ? `Prejuízo de ${fmt(prejuizo)} por porção` : `Lucro de ${fmt(lucro)}, ${pctLucro.toFixed(0)}% da venda`}>
          {setores.map((s) => (
            <path key={s.id} d={setorDonut(centro, centro, rExt, rInt, s.inicio, s.fim)}
              fill={s.cor}
              /* O fio branco entre as fatias é o que impede duas cores vizinhas
                 de virarem um borrão só quando a fatia é fina. */
              stroke="#FFFFFF" strokeWidth="2"
              opacity={emFoco && emFoco !== s.id ? 0.3 : 1}
              onMouseEnter={() => setEmFoco(s.id)} onMouseLeave={() => setEmFoco(null)}
              style={{ transition: "opacity .15s" }}>
              <title>{`${s.rotulo}: ${fmt(s.valor)} (${s.pct.toFixed(1)}%)`}</title>
            </path>
          ))}
          {/* O número dentro da fatia. Só nas que têm espaço — escrever por cima
              de uma fatia de 2% vira borrão e some contra a vizinha. */}
          {setores.filter((s) => s.pct >= PCT_MINIMO_ROTULO).map((s) => {
            const p = centroDoSetor(centro, centro, rExt, rInt, s.inicio, s.fim);
            return (
              <text key={`r-${s.id}`} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="central"
                fill={tintaDaFatia(s.id)} fontSize="11" fontWeight="900" pointerEvents="none"
                opacity={emFoco && emFoco !== s.id ? 0.3 : 1}>
                {s.pct.toFixed(0)}%
              </text>
            );
          })}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          {prejuizo > 0 ? (
            <>
              <span className="text-3xs font-bold uppercase tracking-wider text-subtle">Prejuízo</span>
              <span className="text-sm font-black text-slate-800">{fmt(prejuizo)}</span>
            </>
          ) : (
            <>
              <span className="text-3xs font-bold uppercase tracking-wider text-subtle">Sobra</span>
              <span className="text-lg font-black text-success">{pctLucro.toFixed(0)}%</span>
              <span className="text-3xs font-bold text-muted">{fmt(lucro)}</span>
            </>
          )}
        </div>
      </div>

      <div className="w-full min-w-0">
        <ul className="space-y-1.5">
          {fatias.map((f) => (
            <li key={f.id}
              onMouseEnter={() => setEmFoco(f.id)} onMouseLeave={() => setEmFoco(null)}
              className={`rounded-md px-1 py-0.5 transition-colors ${emFoco === f.id ? "bg-slate-50" : ""}`}>
              <button type="button" disabled={!f.partes.length}
                onClick={() => setAberto(aberto === f.id ? null : f.id)}
                aria-expanded={aberto === f.id}
                className="flex w-full items-center gap-2 text-left text-2xs disabled:cursor-default">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: f.cor }} />
                <span className={`min-w-0 flex-1 truncate font-black ${f.id === "lucro" ? "text-accent" : "text-fg-soft"}`}>
                  {f.rotulo}
                  {!!f.partes.length && (
                    <ChevronDown size={11} className={`ml-1 inline shrink-0 text-subtle transition-transform ${aberto === f.id ? "" : "-rotate-90"}`} />
                  )}
                </span>
                <span className="shrink-0 font-black text-slate-800">{fmt(f.valor)}</span>
                <span className="w-11 shrink-0 text-right font-black text-muted">{f.pct.toFixed(1)}%</span>
              </button>
              {/* Do que o segmento é feito — só quando a pessoa pede. Aberto
                  sempre, isto vira uma parede de vinte linhas num prato com
                  muitos ingredientes. */}
              {aberto === f.id && !!f.partes.length && (
                <ul className="mt-0.5 space-y-0.5 border-l border-line pl-2 ml-[5px]">
                  {f.partes.map((x) => (
                    <li key={x.rotulo} className="flex items-center gap-2 text-3xs">
                      <span className="min-w-0 flex-1 truncate font-bold text-subtle">{x.rotulo}</span>
                      <span className="shrink-0 font-bold text-muted">{fmt(x.valor)}</span>
                      <span className="w-11 shrink-0 text-right font-bold text-subtle">{x.pctNoSegmento.toFixed(0)}%</span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
        <p className="mt-2 border-t border-line-soft pt-1.5 text-3xs font-bold text-subtle">
          {prejuizo > 0
            ? `As fatias dividem o custo de ${fmt(dados.custoTotal)}: ele passou da venda de ${fmt(precoVenda)}.`
            : `As fatias dividem a venda de ${fmt(precoVenda)}. Dentro de cada uma, o % é do próprio segmento.`}
        </p>
        {!rateavel && (
          <p className="mt-1 text-3xs font-bold text-subtle">
            Custo fixo e CMO ficam de fora até preencher dias de operação e pratos por dia no Ponto de Equilíbrio.
          </p>
        )}
      </div>
    </div>
  );
}
