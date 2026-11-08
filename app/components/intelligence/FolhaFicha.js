"use client";

// Folha do prato/drink no chat ("como faz a caipirinha?"): o cartaz da casa —
// foto, ingredientes com quantidade, COPO · GELO · MÉTODO · GUARNIÇÃO (ou
// RENDE · PORÇÃO · TEMPO · SERVIR), preparo e montagem numerados e a dica.
// Só mostra o que veio da ficha cadastrada; o que falta aparece como "Falta
// cadastrar" (nunca é completado com palpite). Cores: as do Assistente
// (--wa-*) quando estiver dentro dele, senão as do Héfisto (--hf-*).

import { memo } from "react";
import { iconeDoIngrediente, iconeDoServico } from "./folha-icones.mjs";
import PrepararReceita from "./PrepararReceita";

const VERDE = "var(--wa-verde-escuro, var(--hf-accent))";
const META = "var(--wa-meta, var(--hf-muted))";
const FUNDO_VERDE = "rgba(0, 90, 73, 0.07)";
const TIPO = { drink: "Drink", prato: "Prato", base: "Pré-preparo" };

function Titulo({ children }) {
  return <p className="mb-1.5 text-[12px] font-bold uppercase tracking-[0.08em]" style={{ color: VERDE }}>{children}</p>;
}

function Passos({ titulo, passos }) {
  if (!passos?.length) return null;
  return (
    <section>
      <Titulo>{titulo}</Titulo>
      <ol className="space-y-2">
        {passos.map((p, i) => (
          <li key={i} className="flex gap-2.5">
            <span className="mt-[1px] flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[13px] font-bold text-white" style={{ background: VERDE }}>{i + 1}</span>
            <span className="min-w-0 text-[15px] leading-snug">
              {p.texto}
              {p.detalhe ? <span className="mt-0.5 block text-[13px]" style={{ color: META }}>{p.detalhe}</span> : null}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function FolhaFicha({ folha, onComando }) {
  if (!folha?.nome) return null;
  return (
    <article className="overflow-hidden rounded-xl border border-black/[0.07] bg-white" aria-label={`Ficha de ${folha.nome}`}>
      <div className="space-y-4 px-3 pb-3 pt-2.5">
        <header>
          <p className="text-[11.5px] font-bold uppercase tracking-[0.12em]" style={{ color: META }}>{TIPO[folha.tipo] || "Ficha"}</p>
          <h3 className="text-[21px] font-extrabold uppercase leading-tight tracking-wide" style={{ color: VERDE }}>{folha.nome}</h3>
          {folha.descricao ? <p className="mt-0.5 text-[14px]" style={{ color: META }}>{folha.descricao}</p> : null}
        </header>

        {/* foto do prato/drink logo abaixo do título, quando tem; sem foto, a folha segue igual */}
        {folha.foto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={folha.foto} alt={`Foto de ${folha.nome}`} loading="lazy" className="max-h-64 w-full rounded-lg object-cover" />
        ) : null}

        {folha.ingredientes?.length ? (
          <section>
            <Titulo>Ingredientes</Titulo>
            <ul className="space-y-1">
              {folha.ingredientes.map((it, i) => (
                <li key={i} className="flex items-center gap-2.5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[17px]" style={{ background: FUNDO_VERDE }} aria-hidden="true">{iconeDoIngrediente(it.nome)}</span>
                  <span className="min-w-0 flex-1 text-[15px] leading-tight">{it.nome}</span>
                  <span className="shrink-0 text-[15px] font-bold tabular-nums">{it.quantidade}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {/* "Vou preparar agora": tem tudo? adapta a receita ao que tem (clicável) */}
        <PrepararReceita folha={folha} onComando={onComando} />

        {folha.servico?.length ? (
          <section className="grid grid-cols-2 gap-1.5">
            {folha.servico.map((s) => (
              <div key={s.id} className="rounded-lg px-2 py-1.5 text-center" style={{ background: FUNDO_VERDE }}>
                <span className="block text-[18px] leading-none" aria-hidden="true">{iconeDoServico(s.id, s.valor)}</span>
                <span className="mt-1 block text-[11px] font-bold uppercase tracking-[0.08em]" style={{ color: VERDE }}>{s.rotulo}</span>
                {s.valor
                  ? <span className="block text-[13.5px] font-semibold leading-tight">{s.valor}</span>
                  : <span className="block text-[12.5px] italic leading-tight" style={{ color: META }}>não cadastrado</span>}
              </div>
            ))}
          </section>
        ) : null}

        <Passos titulo={folha.tipo === "drink" ? "Preparo" : "Modo de preparo"} passos={folha.preparo} />
        <Passos titulo="Montagem" passos={folha.montagem} />

        {folha.alergenicos ? (
          <p className="text-[13.5px]"><strong>Alergênicos:</strong> {folha.alergenicos}</p>
        ) : null}

        {folha.dica ? (
          <div className="rounded-lg px-2.5 py-2 text-[14px]" style={{ background: "#FFF4D6" }}>
            <strong>💡 Dica:</strong> {folha.dica}
          </div>
        ) : null}

        {folha.faltando?.length ? (
          <p className="rounded-lg border border-dashed border-black/15 px-2.5 py-2 text-[13.5px]" style={{ color: META }}>
            <strong>Falta cadastrar na ficha:</strong> {folha.faltando.join(", ")}.
          </p>
        ) : null}
      </div>
    </article>
  );
}

export default memo(FolhaFicha);
