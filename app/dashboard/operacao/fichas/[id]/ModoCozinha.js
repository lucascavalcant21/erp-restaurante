"use client";

// MODO COZINHA — a mesma ficha, do jeito que se lê com as mãos ocupadas.
//
// Letras grandes, alto contraste, alvos de toque folgados e NENHUMA informação
// financeira. Mostra o que a ficha do tipo mostra (dadosDaFicha): no prato,
// ingredientes e montagem; no pré-preparo, também rendimento, tempo,
// equipamentos, alergênicos e armazenamento.
//
// Riscar um item ou passo é só visual e não é gravado: serve para não perder
// o lugar no meio do trabalho.

import { useState } from "react";
import { ArrowLeft, Check, Wrench, X } from "lucide-react";
import { estiloDoTipo } from "../../../../lib/ficha-modelo.mjs";

export default function ModoCozinha({ dados, onSair }) {
  const [feitas, setFeitas] = useState(() => new Set());

  const alternar = (chave) => setFeitas(atual => {
    const proximo = new Set(atual);
    if (proximo.has(chave)) proximo.delete(chave); else proximo.add(chave);
    return proximo;
  });

  // Rendimento, tempo e peso final (só existem no pré-preparo).
  const producao = dados.identificacao.filter(i => !["Categoria", "Setor"].includes(i.rotulo));

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900 text-white" style={estiloDoTipo(dados.config)}>
      {/* Barra fixa: sair sempre alcançável com o polegar */}
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b-4 border-[color:var(--tipo)] bg-slate-900/95 px-4 py-3 backdrop-blur">
        <button onClick={onSair} className="flex items-center gap-2 rounded-2xl bg-white/10 px-4 py-3 text-base font-bold hover:bg-white/20">
          <ArrowLeft size={20} /> Sair
        </button>
        <div className="min-w-0 flex-1">
          <div className="truncate text-xl font-extrabold leading-tight sm:text-2xl">{dados.nome}</div>
          <div className="text-sm text-white/60">{dados.config.tituloDocumento} · {dados.setor.rotulo}{dados.codigo ? ` · ${dados.codigo}` : ""}</div>
        </div>
      </div>

      <div className="mx-auto max-w-4xl space-y-5 p-4 pb-16">
        {producao.length ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {producao.map(i => (
              <div key={i.rotulo} className="rounded-2xl bg-white/10 p-3">
                <div className="text-xs font-bold uppercase tracking-wide text-white/50">{i.rotulo}</div>
                <div className="mt-0.5 text-2xl font-extrabold tabular-nums">{i.valor}</div>
              </div>
            ))}
          </div>
        ) : null}

        {dados.alergenicos && (dados.alergenicos.contem.length || dados.alergenicos.podeConter) ? (
          <div className="rounded-2xl border-2 border-amber-400/40 bg-amber-400/10 p-4">
            <div className="text-sm font-bold uppercase tracking-wide text-amber-300">Alergênicos</div>
            <div className="mt-1 text-lg font-semibold">
              {dados.alergenicos.contem.length ? <>Contém: {dados.alergenicos.contem.join(", ").toLowerCase()}.</> : null}
              {dados.alergenicos.podeConter ? <span className="text-white/70"> Pode conter: {dados.alergenicos.podeConter}.</span> : null}
            </div>
          </div>
        ) : null}

        {dados.foto ? <img src={dados.foto} alt={dados.nome} className="max-h-72 w-full rounded-2xl object-cover" /> : null}

        <section>
          <h2 className="mb-2 text-lg font-bold uppercase tracking-wide text-white/50">Ingredientes</h2>
          {dados.ingredientes.length === 0 ? (
            <p className="text-white/40">Sem ingredientes cadastrados.</p>
          ) : (
            <ul className="divide-y divide-white/10 overflow-hidden rounded-2xl bg-white/5">
              {dados.ingredientes.map((ing, i) => {
                const chave = `ing-${i}`;
                const feito = feitas.has(chave);
                return (
                  <li key={chave}>
                    <button onClick={() => alternar(chave)} className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-white/5">
                      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border-2 ${feito ? "border-[color:var(--tipo)] bg-[color:var(--tipo)] text-[color:var(--tipo-fg)]" : "border-white/25"}`}>
                        {feito ? <Check size={16} strokeWidth={3} /> : null}
                      </span>
                      <span className={`min-w-0 flex-1 text-lg font-semibold ${feito ? "text-white/35 line-through" : ""}`}>{ing.nome}</span>
                      <span className={`shrink-0 text-lg font-bold tabular-nums ${feito ? "text-white/35" : ""}`}>{ing.quantidade}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {dados.equipamentos ? (
          <section>
            <h2 className="mb-2 flex items-center gap-2 text-lg font-bold uppercase tracking-wide text-white/50"><Wrench size={18} /> Equipamentos</h2>
            <div className="flex flex-wrap gap-2">
              {dados.equipamentos.map(nome => <span key={nome} className="rounded-xl bg-white/10 px-3 py-2 text-base font-semibold">{nome}</span>)}
            </div>
          </section>
        ) : null}

        {dados.instrucoes ? (
          <section>
            <h2 className="mb-2 text-lg font-bold uppercase tracking-wide text-white/50">{dados.instrucoes.titulo}</h2>
            <ol className="space-y-3">
              {dados.instrucoes.passos.map((passo, i) => {
                const chave = `passo-${i}`;
                const feito = feitas.has(chave);
                return (
                  <li key={chave}>
                    <button onClick={() => alternar(chave)} className={`flex w-full gap-3 rounded-2xl p-4 text-left transition ${feito ? "bg-white/5" : "bg-white/10 hover:bg-white/15"}`}>
                      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg font-extrabold ${feito ? "bg-[color:var(--tipo)] text-[color:var(--tipo-fg)]" : "bg-white/15"}`}>
                        {feito ? <Check size={20} strokeWidth={3} /> : i + 1}
                      </span>
                      <span className={`min-w-0 flex-1 ${feito ? "text-white/35" : ""}`}>
                        <span className={`block text-lg leading-relaxed ${feito ? "line-through" : ""}`}>{passo.texto}</span>
                        {passo.detalhes.length ? <span className="mt-1 block text-base font-semibold text-sky-300">{passo.detalhes.join(" · ")}</span> : null}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
            {dados.instrucoes.notas.length ? <p className="mt-2 text-base text-white/60">{dados.instrucoes.notas.join(" · ")}</p> : null}
          </section>
        ) : null}

        {dados.armazenamento ? (
          <section>
            <h2 className="mb-2 text-lg font-bold uppercase tracking-wide text-white/50">Armazenamento e validade</h2>
            <dl className="space-y-2 rounded-2xl bg-white/5 p-4">
              {dados.armazenamento.map(l => (
                <div key={l.rotulo}>
                  <dt className="text-sm font-bold uppercase tracking-wide text-white/50">{l.rotulo}</dt>
                  <dd className="text-lg font-semibold">{l.valor}</dd>
                </div>
              ))}
            </dl>
          </section>
        ) : null}

        {feitas.size ? (
          <button onClick={() => setFeitas(new Set())} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/15 py-4 text-base font-bold text-white/60 hover:bg-white/5">
            <X size={18} /> Limpar marcações
          </button>
        ) : null}
      </div>
    </div>
  );
}
