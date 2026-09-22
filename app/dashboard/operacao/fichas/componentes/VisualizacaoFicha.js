"use client";

// A ficha na tela, com a mesma estrutura do PDF: as duas desenham a partir de
// dadosDaFicha (lib/ficha-modelo.mjs). Prato e pré-preparo usam o mesmo
// desenho; o que muda (seções, título, cor) vem da configuração do tipo.

import { estiloDoTipo } from "../../../../lib/ficha-modelo.mjs";

function Titulo({ texto, destaque }) {
  return destaque ? (
    <h3 className="rounded-lg bg-[color:var(--tipo)] px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-[color:var(--tipo-fg)]">{texto}</h3>
  ) : (
    <h3 className="border-b-2 border-[color:var(--tipo)] pb-1 text-xs font-black uppercase tracking-[0.14em] text-[color:var(--tipo)]">{texto}</h3>
  );
}

function Linhas({ linhas }) {
  return (
    <dl className="divide-y divide-[color:var(--line-soft)]">
      {linhas.map(l => (
        <div key={l.rotulo} className={`grid grid-cols-[42%_1fr] gap-3 px-2 py-2 text-sm ${l.forte ? "font-black text-fg" : ""}`}>
          <dt className={l.forte ? "" : "font-semibold text-muted"}>{l.rotulo}</dt>
          <dd className="font-bold text-fg">{l.valor}</dd>
        </div>
      ))}
    </dl>
  );
}

export function FichaDocumento({ dados }) {
  const destaque = (chave) => dados.config.destaques.includes(chave);
  return (
    <article style={estiloDoTipo(dados.config)} className="rounded-2xl border border-line border-t-[6px] border-t-[color:var(--tipo)] bg-card p-4 sm:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line pb-3">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.18em] text-[color:var(--tipo)]">{dados.config.tituloDocumento}</p>
          <p className="text-3xs font-bold uppercase tracking-widest text-muted">{dados.setor.rotulo}</p>
        </div>
        {dados.cabecalho.length ? (
          <dl className="grid grid-cols-[auto_auto] gap-x-3 gap-y-0.5 text-right text-xs">
            {dados.cabecalho.map(c => (
              <div key={c.rotulo} className="contents">
                <dt className="text-3xs font-bold uppercase tracking-wider text-muted">{c.rotulo}</dt>
                <dd className="font-black text-fg">{c.valor}</dd>
              </div>
            ))}
          </dl>
        ) : null}
      </header>

      <h2 className="mt-4 font-serif text-2xl font-bold leading-tight text-fg sm:text-3xl">{dados.nome}</h2>
      {dados.identificacao.length ? (
        <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-2">
          {dados.identificacao.map(i => (
            <div key={i.rotulo}>
              <dt className="text-3xs font-bold uppercase tracking-wider text-muted">{i.rotulo}</dt>
              <dd className="text-sm font-black text-fg">{i.valor}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      <div className="mt-5 flex flex-col gap-5 sm:flex-row sm:items-start">
        <section className="min-w-0 flex-1">
          <Titulo texto="Ingredientes" destaque={destaque("ingredientes")} />
          {dados.ingredientes.length ? (
            <table className="mt-2 w-full text-[15px]">
              <thead>
                <tr className="border-b border-line text-left text-3xs font-bold uppercase tracking-wider text-muted">
                  <th className="px-2 pb-1.5 font-bold">Ingrediente</th>
                  <th className="px-2 pb-1.5 text-right font-bold">Quantidade</th>
                </tr>
              </thead>
              <tbody>
                {dados.ingredientes.map((i, n) => (
                  <tr key={`${i.nome}-${n}`} className="border-b border-line-soft even:bg-[color:var(--tipo-soft)]">
                    <td className="px-2 py-2 font-semibold text-fg">
                      {i.nome}
                      {i.prePreparo ? <span className="ml-2 rounded border border-[color:var(--ficha-preparo)] px-1.5 text-3xs font-bold uppercase tracking-wider text-[color:var(--ficha-preparo)]">pré-preparo</span> : null}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2 text-right font-black text-fg">{i.quantidade}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <p className="px-2 py-3 text-sm font-semibold text-muted">Sem ingredientes cadastrados.</p>}
        </section>
        {dados.foto ? (
          <img src={dados.foto} alt={dados.nome} className="w-full rounded-xl border border-line object-cover sm:mt-10 sm:w-56" style={{ maxHeight: 260 }} />
        ) : null}
      </div>

      {dados.instrucoes ? (
        <section className="mt-5">
          <Titulo texto={dados.instrucoes.titulo} destaque={destaque("instrucoes")} />
          <ol className="mt-2">
            {dados.instrucoes.passos.map((p, n) => (
              <li key={n} className="flex gap-3 border-b border-line-soft py-2.5 last:border-0">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[color:var(--tipo)] text-sm font-black text-[color:var(--tipo-fg)]">{n + 1}</span>
                <span className="min-w-0 pt-0.5 text-[15px] font-medium leading-relaxed text-fg">
                  {p.texto}
                  {p.detalhes.length ? <span className="mt-0.5 block text-xs font-semibold text-muted">{p.detalhes.join(" · ")}</span> : null}
                </span>
              </li>
            ))}
          </ol>
          {dados.instrucoes.notas.length ? <p className="mt-1 text-xs font-semibold text-muted">{dados.instrucoes.notas.join(" · ")}</p> : null}
        </section>
      ) : null}

      {dados.armazenamento || dados.equipamentos ? (
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          {dados.armazenamento ? (
            <section><Titulo texto="Armazenamento e validade" destaque={destaque("armazenamento")} /><div className="mt-2"><Linhas linhas={dados.armazenamento} /></div></section>
          ) : null}
          {dados.equipamentos ? (
            <section><Titulo texto="Equipamentos e utensílios" /><p className="mt-2 px-2 text-sm font-semibold text-fg">{dados.equipamentos.join(", ")}.</p></section>
          ) : null}
        </div>
      ) : null}

      {dados.alergenicos || dados.custos ? (
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          {dados.alergenicos ? (
            <section>
              <Titulo texto="Alergênicos" />
              <p className="mt-2 px-2 text-sm font-semibold text-fg">
                {dados.alergenicos.contem.length ? <><b>Contém:</b> {dados.alergenicos.contem.join(", ")}.</> : "Não contém alergênicos cadastrados."}
                {dados.alergenicos.podeConter ? <><br /><b>Pode conter:</b> {dados.alergenicos.podeConter}.</> : null}
              </p>
            </section>
          ) : null}
          {dados.custos ? (
            <section><Titulo texto="Custos" /><div className="mt-2"><Linhas linhas={dados.custos} /></div></section>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

// Os dois nomes que o restante do sistema usa. O desenho é o mesmo; o que cada
// um mostra já veio decidido em `dados` pela configuração do tipo.
export const FichaPrato = FichaDocumento;
export const FichaPrePreparo = FichaDocumento;
