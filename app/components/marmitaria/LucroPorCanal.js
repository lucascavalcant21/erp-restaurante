"use client";

// O mesmo prato, um lucro em cada canal: o destaque compara os canais de um item e
// a tabela mostra todos. Sem preço, custo ou taxa, o valor fica vazio, nunca zero.

import { useMemo, useState } from "react";
import { useMarmitaria } from "./contexto";
import { Selo, brl } from "./ui";
import { custoPorcaoDaFicha } from "../../lib/evento-financeiro.mjs";
import { lucroPorCanal, porQueCai } from "../../lib/marmitaria/lucro-por-canal.mjs";

const LIMITE = 8;
const sinal = (v) => (v > 0 ? `+${brl(v)}` : v < 0 ? `−${brl(Math.abs(v))}` : brl(0));
const corDoValor = (v) => (v > 0 ? "text-hf-success" : v < 0 ? "text-hf-danger" : "text-hf-text-2");
const pontilhado = { backgroundImage: "radial-gradient(rgb(var(--hf-text) / .09) 1px, transparent 1px)", backgroundSize: "14px 14px" };
const moldura = "rounded-2xl border-2 border-hf-text bg-hf-surface";
const sombraDura = { boxShadow: "4px 4px 0 0 rgb(var(--hf-text))" };
const ouro = { color: "rgb(var(--hf-accent))" };

function CartaoDoCanal({ valor, nome }) {
  const lucro = valor?.lucro ?? null;
  return (
    <div className={`${moldura} min-w-0 p-3 text-center`} style={sombraDura}>
      <p className="truncate text-sm font-black uppercase tracking-wide text-hf-text">{nome}</p>
      {lucro == null
        ? <p className="mt-2 rounded-xl bg-hf-elevated px-2 py-2.5 text-sm font-bold text-hf-text-2">Sem dados</p>
        : <p className={`mt-2 rounded-xl px-2 py-2 text-xl font-black tabular-nums text-white sm:text-2xl ${lucro < 0 ? "bg-hf-danger" : lucro > 0 ? "bg-hf-success" : "bg-hf-text-2"}`}>{sinal(lucro)}</p>}
      {valor?.preco > 0 && <p className="mt-1.5 text-xs text-hf-text-2">Vendido a {brl(valor.preco)}</p>}
    </div>
  );
}

function Tabela({ canais, itens, rotulo }) {
  const [tudo, setTudo] = useState(false);
  const visiveis = tudo ? itens : itens.slice(0, LIMITE);
  return (
    <div className={`${moldura} overflow-hidden`} style={sombraDura}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-full border-collapse text-sm">
          <caption className="sr-only">{rotulo} por pedido em cada canal</caption>
          <thead>
            <tr className="bg-hf-text">
              <th scope="col" className="sticky left-0 bg-hf-text px-3 py-2.5 text-left text-xs font-black uppercase tracking-wide" style={ouro}>Por pedido</th>
              {canais.map((c) => <th key={c.id} scope="col" className="whitespace-nowrap px-3 py-2.5 text-right text-xs font-black uppercase tracking-wide" style={ouro}>{c.nome}</th>)}
            </tr>
          </thead>
          <tbody>
            {visiveis.map((i) => (
              <tr key={i.id} className="border-t border-hf-border">
                <th scope="row" className="sticky left-0 max-w-[42vw] truncate bg-hf-surface px-3 py-2.5 text-left font-bold text-hf-text sm:max-w-none" title={i.nome}>{i.nome}</th>
                {canais.map((c) => {
                  const lucro = i.valores[c.id]?.lucro ?? null;
                  return <td key={c.id} className={`whitespace-nowrap px-3 py-2.5 text-right font-black tabular-nums ${lucro == null ? "text-hf-muted" : corDoValor(lucro)}`}>{lucro == null ? "—" : sinal(lucro)}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {itens.length > LIMITE && <button type="button" onClick={() => setTudo(!tudo)} className="min-h-[44px] w-full border-t border-hf-border text-sm font-bold text-hf-text hover:bg-hf-elevated">{tudo ? "Ver menos" : `Ver todos os ${itens.length}`}</button>}
    </div>
  );
}

export default function LucroPorCanal({ canais, combos, tributosPct, embutidos, rotulo }) {
  const { base, custos } = useMarmitaria();
  const { itens, faltas } = useMemo(() => lucroPorCanal({
    marmitas: base.marmitas, custos, fichas: base.fichas, combos, canais, tributosPct, embutidos,
    custoFicha: (f) => { const c = custoPorcaoDaFicha(f, base.fichas); return c > 0 ? c : null; },
  }), [base, custos, combos, canais, tributosPct, embutidos]);
  const [itemId, setItemId] = useState("");
  const comLucro = itens.filter((i) => i.melhor);
  const item = comLucro.find((i) => i.id === itemId) || comLucro[0] || null;
  const motivos = useMemo(() => porQueCai(item, { embutidos, custos }), [item, embutidos, custos]);

  return (
    <section aria-labelledby="lucro-canal" className="rounded-3xl border border-hf-border bg-hf-surface p-4 sm:p-6" style={pontilhado}>
      <div className="flex justify-end"><Selo natureza="estimado" /></div>
      <h2 id="lucro-canal" className="mt-1 text-center text-3xl font-black uppercase leading-none tracking-tight text-hf-text sm:text-4xl">
        O mesmo prato
        <span className="mx-auto mt-2 block w-fit bg-hf-accent px-2 py-1 text-xl text-hf-accent-fg sm:text-2xl">Um lucro em cada canal</span>
      </h2>

      {!item ? (
        <div className={`${moldura} mt-5 p-4`} style={sombraDura}>
          <p className="text-sm font-black text-hf-text">DADOS INSUFICIENTES</p>
          <p className="mt-1 text-sm text-hf-text-2">{faltas.length ? `${faltas.join(" · ")}.` : "Faltam itens com preço e custo completo."}</p>
          <a href={faltas.length ? "/dashboard/marmitaria/configuracoes" : "/dashboard/marmitaria/marmitas"} className="mt-2 inline-flex min-h-[44px] items-center text-sm font-bold text-hf-text underline">{faltas.length ? "Preencher em Configurações" : "Abrir a Ficha técnica"}</a>
        </div>
      ) : (
        <div className="mx-auto mt-5 max-w-3xl space-y-5">
          <label className="block text-center">
            <span className="sr-only">Escolha o prato</span>
            <select value={item.id} onChange={(e) => setItemId(e.target.value)} className="mx-auto block h-12 w-full max-w-sm truncate rounded-xl border-2 border-hf-text bg-hf-surface px-3 text-center text-base font-black text-hf-text outline-none focus:border-hf-accent">
              {comLucro.map((i) => <option key={i.id} value={i.id}>{i.nome}</option>)}
            </select>
          </label>
          <div className={`grid gap-3 sm:gap-4 ${canais.length === 1 ? "grid-cols-1" : "grid-cols-2"} ${canais.length > 2 ? "lg:grid-cols-4" : ""}`}>
            {canais.map((c) => <CartaoDoCanal key={c.id} nome={c.nome} valor={item.valores[c.id]} />)}
          </div>
          {motivos.length > 0 && (
            <div>
              <p className="text-center text-sm font-bold text-hf-text">No {item.pior.canal} sobram {brl(item.diferenca)} a menos que no {item.melhor.canal}:</p>
              <ul className="mt-2 flex flex-wrap justify-center gap-2">
                {motivos.map((m) => <li key={m.rotulo} className="rounded-full bg-hf-text px-3 py-1.5 text-sm font-black" style={ouro}>− {m.rotulo} {brl(m.valor)}</li>)}
              </ul>
            </div>
          )}
          <Tabela canais={canais} itens={itens} rotulo={rotulo} />
          <p className="text-center text-xs text-hf-text-2">{rotulo}, por pedido, com as taxas e os preços de cada canal.{faltas.length ? ` ${faltas.join(" · ")}.` : ""}</p>
        </div>
      )}
    </section>
  );
}
