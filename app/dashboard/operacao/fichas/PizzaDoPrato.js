"use client";

import { useState } from "react";
import { fatiasDoPrato, setorDonut } from "../../../lib/pizza-do-prato.mjs";

const fmt = (v) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/* A pizza do prato: para onde vai cada real da venda.
 *
 * A rosca (e não a pizza cheia) é de propósito: o buraco do meio carrega o
 * número que a pessoa veio buscar — quanto sobra — sem competir com as fatias.
 *
 * A legenda sempre aparece com valor e porcentagem. Não é enfeite: as fatias
 * mais claras têm pouco contraste contra o cartão branco, então a identidade
 * de cada uma nunca pode depender só da cor.
 */
export default function PizzaDoPrato({
  preco, custoIngredientes, custoEmbalagem, impostoPct, taxaMaquininhaPct, params, compacta = false,
}) {
  const [emFoco, setEmFoco] = useState(null);
  const dados = fatiasDoPrato({ preco, custoIngredientes, custoEmbalagem, impostoPct, taxaMaquininhaPct, params });
  const { fatias, prejuizo, lucro, preco: precoVenda, rateavel } = dados;

  if (!fatias.length) {
    return (
      <p className="rounded-xl bg-slate-50 px-3 py-4 text-center text-[11px] font-bold text-slate-400">
        Sem preço de venda: não dá para dividir a pizza.
      </p>
    );
  }

  const tam = compacta ? 128 : 152;
  const centro = tam / 2;
  const rExt = centro - 4;
  const rInt = rExt * 0.62;

  let anguloAtual = 0;
  const setores = fatias.map((f) => {
    const varrer = (f.pct / 100) * 360;
    const setor = { ...f, inicio: anguloAtual, fim: anguloAtual + varrer };
    anguloAtual += varrer;
    return setor;
  });

  const pctLucro = fatias.find((f) => f.id === "lucro")?.pct || 0;

  return (
    <div className={compacta ? "flex flex-col items-center gap-3" : "flex flex-col items-center gap-3 sm:flex-row sm:items-start"}>
      <div className="relative shrink-0" style={{ width: tam, height: tam }}>
        <svg width={tam} height={tam} viewBox={`0 0 ${tam} ${tam}`} role="img"
          aria-label={prejuizo > 0 ? `Prejuízo de ${fmt(prejuizo)} por porção` : `Lucro de ${fmt(lucro)}, ${pctLucro.toFixed(0)}% da venda`}>
          {setores.map((s) => (
            <path key={s.id} d={setorDonut(centro, centro, rExt, rInt, s.inicio, s.fim)}
              fill={s.cor}
              /* O fio branco entre as fatias é o que impede duas cores vizinhas
                 de virarem um borrão só quando a fatia é fina. */
              stroke="#FFFFFF" strokeWidth="2"
              opacity={emFoco && emFoco !== s.id ? 0.35 : 1}
              onMouseEnter={() => setEmFoco(s.id)} onMouseLeave={() => setEmFoco(null)}
              style={{ transition: "opacity .15s" }}>
              <title>{`${s.rotulo}${s.detalhe ? ` — ${s.detalhe}` : ""}: ${fmt(s.valor)} (${s.pct.toFixed(1)}%)`}</title>
            </path>
          ))}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          {prejuizo > 0 ? (
            <>
              <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">Prejuízo</span>
              <span className="text-sm font-black text-slate-800">{fmt(prejuizo)}</span>
            </>
          ) : (
            <>
              <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">Sobra</span>
              <span className="text-base font-black text-emerald-600">{pctLucro.toFixed(0)}%</span>
              <span className="text-[10px] font-bold text-slate-500">{fmt(lucro)}</span>
            </>
          )}
        </div>
      </div>

      <div className="w-full min-w-0 flex-1">
        <ul className="space-y-1">
          {fatias.map((f) => (
            <li key={f.id}
              onMouseEnter={() => setEmFoco(f.id)} onMouseLeave={() => setEmFoco(null)}
              className={`flex items-center gap-2 rounded-md px-1 py-0.5 text-[11px] transition-colors ${emFoco === f.id ? "bg-slate-50" : ""}`}>
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: f.cor }} />
              <span className={`min-w-0 flex-1 truncate font-bold ${f.id === "lucro" ? "text-emerald-700" : "text-slate-600"}`}>{f.rotulo}</span>
              <span className="shrink-0 font-black text-slate-800">{fmt(f.valor)}</span>
              <span className="w-11 shrink-0 text-right font-bold text-slate-400">{f.pct.toFixed(1)}%</span>
            </li>
          ))}
        </ul>
        <p className="mt-2 border-t border-slate-100 pt-1.5 text-[10px] font-bold text-slate-400">
          {prejuizo > 0
            ? `As fatias dividem o custo de ${fmt(dados.custoTotal)}: ele passou da venda de ${fmt(precoVenda)}.`
            : `As fatias dividem a venda de ${fmt(precoVenda)}.`}
        </p>
        {!rateavel && (
          <p className="mt-1 text-[10px] font-bold text-slate-400">
            Custo fixo e CMO ficam de fora até preencher dias de operação e pratos por dia no Ponto de Equilíbrio.
          </p>
        )}
      </div>
    </div>
  );
}
