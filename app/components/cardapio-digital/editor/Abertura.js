"use client";

import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { ACOES_BANNER, DIAS_SEMANA, LIMITES, LIMITES_CARROSSEL, gerarId, normalizarCarrossel } from "../../../lib/cardapio-digital.mjs";
import { Aviso, Botao, Campo, Envio, Secao, inputCls, mover } from "./ui";

function Programacao({ horario, onMudar }) {
  const h = horario || { dias_semana: [], hora_inicio: "", hora_fim: "" };
  const dias = h.dias_semana || [];
  const muda = (campos) => onMudar({ ...h, ...campos });
  return (
    <div className="sm:col-span-2 rounded-xl bg-hf-elevated/60 p-3">
      <span className="mb-2 block text-xs font-semibold text-hf-text-2">Programação: quando passa (sem marcar nada, passa sempre)</span>
      <div className="flex flex-wrap items-center gap-1.5">
        {DIAS_SEMANA.map((d, i) => (
          <button key={d} type="button" aria-pressed={dias.includes(i)} onClick={() => muda({ dias_semana: dias.includes(i) ? dias.filter((x) => x !== i) : [...dias, i].sort() })}
            className={`min-h-[36px] rounded-lg border px-2.5 text-xs font-bold transition ${dias.includes(i) ? "border-hf-accent bg-hf-accent text-hf-accent-fg" : "border-hf-border bg-hf-surface text-hf-text-2"}`}>
            {d}
          </button>
        ))}
        <span className="ml-1 flex items-center gap-1.5 text-xs text-hf-text-2">
          das <input type="time" className={`${inputCls} !min-h-[36px] w-28`} value={h.hora_inicio || ""} onChange={(e) => muda({ hora_inicio: e.target.value })} aria-label="Começa às" />
          às <input type="time" className={`${inputCls} !min-h-[36px] w-28`} value={h.hora_fim || ""} onChange={(e) => muda({ hora_fim: e.target.value })} aria-label="Termina às" />
        </span>
      </div>
    </div>
  );
}

export default function Abertura({ config, mudar, unidadeId, opcoes }) {
  const lista = config.banner;
  const setLista = (fn) => mudar((c) => ({ ...c, banner: fn(c.banner) }));
  const editar = (id, campos) => setLista((l) => l.map((b) => (b.id === id ? { ...b, ...campos } : b)));
  const alvos = { categoria: opcoes.categorias, promocao: opcoes.promocoes, produto: opcoes.produtos };

  const car = normalizarCarrossel(config.carrossel);
  const mudarCar = (campos) => mudar((c) => ({ ...c, carrossel: { ...normalizarCarrossel(c.carrossel), ...campos } }));

  return (
    <div className="space-y-4">
      <Secao titulo="Como os banners passam" subtitulo="Vale para o delivery e para a mesa. No celular passa um de cada vez; no tablet, quantos você escolher.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo rotulo={`Tempo em cada banner: ${car.segundos} segundos`} dica="Vídeo passa quando termina, se estiver sozinho na tela.">
            <input type="range" min={LIMITES_CARROSSEL.segundosMin} max={LIMITES_CARROSSEL.segundosMax} step={1} value={car.segundos}
              onChange={(e) => mudarCar({ segundos: Number(e.target.value) })} className="w-full accent-hf-accent" aria-label="Segundos em cada banner" />
          </Campo>
          <Campo rotulo="Quantos aparecem juntos (tablet)">
            <span className="flex gap-2">
              {[1, 2, 3].map((n) => (
                <button key={n} type="button" onClick={() => mudarCar({ por_vez: n })} aria-pressed={car.por_vez === n}
                  className={`min-h-[44px] flex-1 rounded-xl border text-sm font-bold transition ${car.por_vez === n ? "border-hf-accent bg-hf-accent text-white" : "border-hf-border text-hf-text hover:border-hf-border-strong"}`}>
                  {n}
                </button>
              ))}
            </span>
          </Campo>
        </div>
      </Secao>
      <Secao titulo="Abertura do cardápio" subtitulo="Fotos, vídeos e pratos que passam no topo (no tablet, na mesa e no delivery). Cada um pode levar o cliente a uma seção, a uma promoção ou a um prato, e pode ter dia e horário para passar."
        direita={<span className="text-xs font-semibold text-hf-muted">{lista.length} de {LIMITES.banner}</span>}>
        {!lista.length ? <Aviso>Sem fotos ou vídeos, o cardápio abre com a capa (em Aparência) ou só com o nome da casa.</Aviso> : null}
        <div className="space-y-3">
          {lista.map((b, i) => (
            <div key={b.id} className="rounded-xl border border-hf-border p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                {b.tipo === "prato" ? (
                  <Campo rotulo="Prato no carrossel" dica="Usa a foto, o nome e o preço do prato. Sem foto, ele não aparece." className="min-w-[220px] flex-1">
                    <select className={inputCls} value={b.acao?.id || ""} onChange={(e) => editar(b.id, { acao: { tipo: "produto", id: e.target.value } })}>
                      {(opcoes.produtos || []).map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
                    </select>
                  </Campo>
                ) : (
                  <Envio url={b.url} ehVideo={b.tipo === "video"} aceitaVideo unidadeId={unidadeId} pasta="abertura" compacto
                    onEnviado={(url, video) => editar(b.id, { url, tipo: video ? "video" : "imagem" })} />
                )}
                <span className="flex gap-1">
                  <Botao variante="secundario" onClick={() => setLista((l) => mover(l, i, -1))} disabled={i === 0} aria-label="Subir"><ArrowUp size={16} /></Botao>
                  <Botao variante="secundario" onClick={() => setLista((l) => mover(l, i, 1))} disabled={i === lista.length - 1} aria-label="Descer"><ArrowDown size={16} /></Botao>
                  <Botao variante="perigo" onClick={() => setLista((l) => l.filter((x) => x.id !== b.id))} aria-label="Tirar da abertura"><Trash2 size={16} /></Botao>
                </span>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <Campo rotulo="Título (opcional)"><input className={inputCls} value={b.titulo} maxLength={60} onChange={(e) => editar(b.id, { titulo: e.target.value })} placeholder="Ex.: Noite de maniçoba" /></Campo>
                <Campo rotulo="Frase (opcional)"><input className={inputCls} value={b.texto} maxLength={120} onChange={(e) => editar(b.id, { texto: e.target.value })} placeholder="Ex.: Toda sexta, até acabar" /></Campo>
                {b.tipo === "prato" ? null : <Campo rotulo="Ao tocar">
                  <select className={inputCls} value={b.acao?.tipo || ""} onChange={(e) => editar(b.id, { acao: e.target.value ? { tipo: e.target.value, id: alvos[e.target.value]?.[0]?.id || "" } : null })}>
                    {ACOES_BANNER.map((a) => <option key={a.id} value={a.id}>{a.rotulo}</option>)}
                  </select>
                </Campo>}
                {b.acao?.tipo && b.tipo !== "prato" ? (
                  <Campo rotulo={b.acao.tipo === "categoria" ? "Seção" : b.acao.tipo === "promocao" ? "Promoção" : "Prato"}
                    dica={!alvos[b.acao.tipo]?.length ? "Nada disponível para escolher ainda." : undefined}>
                    <select className={inputCls} value={b.acao.id} onChange={(e) => editar(b.id, { acao: { tipo: b.acao.tipo, id: e.target.value } })}>
                      {(alvos[b.acao.tipo] || []).map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
                    </select>
                  </Campo>
                ) : null}
                <Programacao horario={b.horario} onMudar={(horario) => editar(b.id, { horario })} />
                {b.tipo === "video" ? (
                  <div className="sm:col-span-2">
                    <Envio rotulo="Imagem enquanto o vídeo carrega (opcional)" url={b.poster_url} unidadeId={unidadeId} pasta="abertura" compacto
                      onEnviado={(url) => editar(b.id, { poster_url: url })} onRemover={() => editar(b.id, { poster_url: "" })} />
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </div>
        {lista.length < LIMITES.banner ? (
          <div className="mt-3 rounded-xl border border-dashed border-hf-border-strong p-3">
            <Envio rotulo="Adicionar à abertura" url="" aceitaVideo unidadeId={unidadeId} pasta="abertura"
              onEnviado={(url, video) => setLista((l) => [...l, { id: gerarId("midia", l.map((x) => x.id)), tipo: video ? "video" : "imagem", url, poster_url: "", titulo: "", texto: "", acao: null }])} />
            {opcoes.produtos?.length ? (
              <Botao variante="secundario" className="mt-2"
                onClick={() => setLista((l) => [...l, { id: gerarId("prato", l.map((x) => x.id)), tipo: "prato", url: "", poster_url: "", titulo: "", texto: "", acao: { tipo: "produto", id: opcoes.produtos[0].id } }])}>
                + Prato no carrossel
              </Botao>
            ) : null}
          </div>
        ) : null}
        <p className="mt-3 text-[11px] text-hf-muted">Vídeo toca sem som e em repetição, como nos aplicativos. Para quem pediu menos movimento no celular, ele espera o toque.</p>
      </Secao>
    </div>
  );
}
