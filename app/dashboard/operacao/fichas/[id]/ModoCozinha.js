"use client";

// MODO COZINHA — a mesma ficha, do jeito que se lê com as mãos ocupadas.
//
// Letras grandes, alto contraste, alvos de toque folgados e NENHUMA informação
// financeira: custo, preço, CMV e margem não aparecem aqui. Quem está na praça
// não precisa disso e, em muitos restaurantes, nem deve ver.
//
// Riscar uma etapa é só visual e não é gravado: serve para não perder o lugar
// no meio do preparo.

import { useState } from "react";
import { ArrowLeft, Check, Clock, Thermometer, Wrench, X } from "lucide-react";
import { parseNumero, tempoTotal } from "../../../../lib/ficha-calculos.mjs";

export default function ModoCozinha({
  ficha, etapas = [], equipamentos = [], alergenicos = [], podeConter = "",
  montagem = [], ingredientes = [], onSair,
}) {
  const [feitas, setFeitas] = useState(() => new Set());

  const alternar = (chave) => setFeitas(atual => {
    const proximo = new Set(atual);
    if (proximo.has(chave)) proximo.delete(chave); else proximo.add(chave);
    return proximo;
  });

  const foto = ficha.imagem
    ? (String(ficha.imagem).startsWith("data:") ? ficha.imagem : `data:image/jpeg;base64,${ficha.imagem}`)
    : "";
  const total = tempoTotal(ficha.tempo_preparo, ficha.tempo_coccao_min);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900 text-white">
      {/* Barra fixa: sair sempre alcançável com o polegar */}
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-white/10 bg-slate-900/95 px-4 py-3 backdrop-blur">
        <button onClick={onSair}
          className="flex items-center gap-2 rounded-2xl bg-white/10 px-4 py-3 text-base font-bold hover:bg-white/20">
          <ArrowLeft size={20} /> Sair
        </button>
        <div className="min-w-0 flex-1">
          <div className="truncate text-xl font-extrabold leading-tight sm:text-2xl">
            {ficha.nome_comercial || ficha.nome_receita}
          </div>
          <div className="text-sm text-white/50">
            {ficha.codigo ? `${ficha.codigo} · ` : ""}v{ficha.versao || "1.0"}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-4xl space-y-5 p-4 pb-16">
        {/* Rendimento e tempos */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Bloco rotulo="Rendimento"
            valor={`${parseNumero(ficha.rendimento_porcoes) || "—"} ${ficha.rendimento_unidade || ""}`.trim()} />
          <Bloco rotulo="Peso final"
            valor={parseNumero(ficha.peso_final_g) ? `${Math.round(parseNumero(ficha.peso_final_g))} g` : "—"} />
          <Bloco rotulo="Preparo" valor={ficha.tempo_preparo ? `${ficha.tempo_preparo}` : "—"} />
          <Bloco rotulo="Tempo total" valor={total ? `${total} min` : "—"} />
        </div>

        {alergenicos.length || podeConter ? (
          <div className="rounded-2xl border-2 border-amber-400/40 bg-amber-400/10 p-4">
            <div className="text-sm font-bold uppercase tracking-wide text-amber-300">Alergênicos</div>
            <div className="mt-1 text-lg font-semibold">
              {alergenicos.length ? <>Contém: {alergenicos.join(", ").toLowerCase()}.</> : null}
              {podeConter ? <span className="text-white/70"> Pode conter: {podeConter}.</span> : null}
            </div>
          </div>
        ) : null}

        {foto ? (
          <img src={foto} alt={ficha.nome_receita}
            className="max-h-72 w-full rounded-2xl object-cover" />
        ) : null}

        {/* Ingredientes */}
        <section>
          <h2 className="mb-2 text-lg font-bold uppercase tracking-wide text-white/50">Ingredientes</h2>
          {ingredientes.length === 0 ? (
            <p className="text-white/40">Sem ingredientes cadastrados.</p>
          ) : (
            <ul className="divide-y divide-white/10 overflow-hidden rounded-2xl bg-white/5">
              {ingredientes.map((ing, i) => {
                const chave = `ing-${i}`;
                const feito = feitas.has(chave);
                return (
                  <li key={chave}>
                    <button onClick={() => alternar(chave)}
                      className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-white/5">
                      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border-2 ${
                        feito ? "border-emerald-400 bg-emerald-400 text-slate-900" : "border-white/25"}`}>
                        {feito ? <Check size={16} strokeWidth={3} /> : null}
                      </span>
                      <span className={`min-w-0 flex-1 text-lg font-semibold ${feito ? "text-white/35 line-through" : ""}`}>
                        {ing.nome}
                      </span>
                      <span className={`shrink-0 text-lg font-bold tabular-nums ${feito ? "text-white/35" : "text-emerald-300"}`}>
                        {ing.quantidade} {ing.unidade}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Equipamentos */}
        {equipamentos.length ? (
          <section>
            <h2 className="mb-2 flex items-center gap-2 text-lg font-bold uppercase tracking-wide text-white/50">
              <Wrench size={18} /> Equipamentos
            </h2>
            <div className="flex flex-wrap gap-2">
              {equipamentos.map(nome => (
                <span key={nome} className="rounded-xl bg-white/10 px-3 py-2 text-base font-semibold">{nome}</span>
              ))}
            </div>
          </section>
        ) : null}

        {/* Modo de preparo */}
        <section>
          <h2 className="mb-2 text-lg font-bold uppercase tracking-wide text-white/50">Modo de preparo</h2>
          {etapas.length === 0 ? (
            ficha.modo_preparo
              ? <p className="whitespace-pre-wrap rounded-2xl bg-white/5 p-4 text-lg leading-relaxed">{ficha.modo_preparo}</p>
              : <p className="text-white/40">Sem modo de preparo cadastrado.</p>
          ) : (
            <ol className="space-y-3">
              {etapas.map((etapa, i) => {
                const chave = etapa.chave || `et-${i}`;
                const feito = feitas.has(chave);
                return (
                  <li key={chave}>
                    <button onClick={() => alternar(chave)}
                      className={`flex w-full gap-3 rounded-2xl p-4 text-left transition ${
                        feito ? "bg-white/5" : "bg-white/10 hover:bg-white/15"}`}>
                      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg font-extrabold ${
                        feito ? "bg-emerald-400 text-slate-900" : "bg-white/15"}`}>
                        {feito ? <Check size={20} strokeWidth={3} /> : i + 1}
                      </span>
                      <span className={`min-w-0 flex-1 ${feito ? "text-white/35" : ""}`}>
                        {etapa.titulo ? (
                          <span className={`block text-lg font-bold ${feito ? "line-through" : ""}`}>{etapa.titulo}</span>
                        ) : null}
                        {etapa.instrucao ? (
                          <span className="mt-0.5 block text-lg leading-relaxed">{etapa.instrucao}</span>
                        ) : null}
                        {(etapa.tempo_min || etapa.temperatura || etapa.equipamento) ? (
                          <span className="mt-2 flex flex-wrap items-center gap-3 text-base font-semibold text-sky-300">
                            {etapa.tempo_min ? <span className="flex items-center gap-1"><Clock size={16} /> {etapa.tempo_min} min</span> : null}
                            {etapa.temperatura ? <span className="flex items-center gap-1"><Thermometer size={16} /> {etapa.temperatura}</span> : null}
                            {etapa.equipamento ? <span className="flex items-center gap-1"><Wrench size={16} /> {etapa.equipamento}</span> : null}
                          </span>
                        ) : null}
                        {etapa.observacao ? (
                          <span className="mt-1.5 block text-base italic text-amber-300">{etapa.observacao}</span>
                        ) : null}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        {/* Montagem */}
        {montagem.length ? (
          <section>
            <h2 className="mb-2 text-lg font-bold uppercase tracking-wide text-white/50">Montagem</h2>
            <ol className="space-y-2">
              {montagem.map((passo, i) => {
                const chave = passo.chave || `mt-${i}`;
                const feito = feitas.has(chave);
                return (
                  <li key={chave}>
                    <button onClick={() => alternar(chave)}
                      className="flex w-full items-center gap-3 rounded-2xl bg-white/10 px-4 py-3 text-left hover:bg-white/15">
                      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg font-bold ${
                        feito ? "bg-emerald-400 text-slate-900" : "bg-white/15"}`}>
                        {feito ? <Check size={17} strokeWidth={3} /> : i + 1}
                      </span>
                      <span className={`text-lg font-semibold ${feito ? "text-white/35 line-through" : ""}`}>
                        {passo.descricao}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </section>
        ) : null}

        {ficha.observacoes ? (
          <section>
            <h2 className="mb-2 text-lg font-bold uppercase tracking-wide text-white/50">Observações</h2>
            <p className="whitespace-pre-wrap rounded-2xl bg-white/5 p-4 text-lg leading-relaxed">{ficha.observacoes}</p>
          </section>
        ) : null}

        {feitas.size ? (
          <button onClick={() => setFeitas(new Set())}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/15 py-4 text-base font-bold text-white/60 hover:bg-white/5">
            <X size={18} /> Limpar marcações
          </button>
        ) : null}
      </div>
    </div>
  );
}

function Bloco({ rotulo, valor }) {
  return (
    <div className="rounded-2xl bg-white/10 p-3">
      <div className="text-xs font-bold uppercase tracking-wide text-white/45">{rotulo}</div>
      <div className="mt-0.5 text-2xl font-extrabold tabular-nums">{valor}</div>
    </div>
  );
}
