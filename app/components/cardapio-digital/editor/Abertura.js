"use client";

import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { ACOES_BANNER, LIMITES, gerarId } from "../../../lib/cardapio-digital.mjs";
import { Aviso, Botao, Campo, Envio, Secao, inputCls, mover } from "./ui";

export default function Abertura({ config, mudar, unidadeId, opcoes }) {
  const lista = config.banner;
  const setLista = (fn) => mudar((c) => ({ ...c, banner: fn(c.banner) }));
  const editar = (id, campos) => setLista((l) => l.map((b) => (b.id === id ? { ...b, ...campos } : b)));
  const alvos = { categoria: opcoes.categorias, promocao: opcoes.promocoes, produto: opcoes.produtos };

  return (
    <div className="space-y-4">
      <Secao titulo="Abertura do cardápio" subtitulo="Fotos e vídeos que passam no topo. Cada um pode levar o cliente a uma seção, a uma promoção ou a um prato."
        direita={<span className="text-xs font-semibold text-hf-muted">{lista.length} de {LIMITES.banner}</span>}>
        {!lista.length ? <Aviso>Sem fotos ou vídeos, o cardápio abre com a capa (em Aparência) ou só com o nome da casa.</Aviso> : null}
        <div className="space-y-3">
          {lista.map((b, i) => (
            <div key={b.id} className="rounded-xl border border-hf-border p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <Envio url={b.url} ehVideo={b.tipo === "video"} aceitaVideo unidadeId={unidadeId} pasta="abertura" compacto
                  onEnviado={(url, video) => editar(b.id, { url, tipo: video ? "video" : "imagem" })} />
                <span className="flex gap-1">
                  <Botao variante="secundario" onClick={() => setLista((l) => mover(l, i, -1))} disabled={i === 0} aria-label="Subir"><ArrowUp size={16} /></Botao>
                  <Botao variante="secundario" onClick={() => setLista((l) => mover(l, i, 1))} disabled={i === lista.length - 1} aria-label="Descer"><ArrowDown size={16} /></Botao>
                  <Botao variante="perigo" onClick={() => setLista((l) => l.filter((x) => x.id !== b.id))} aria-label="Tirar da abertura"><Trash2 size={16} /></Botao>
                </span>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <Campo rotulo="Título (opcional)"><input className={inputCls} value={b.titulo} maxLength={60} onChange={(e) => editar(b.id, { titulo: e.target.value })} placeholder="Ex.: Noite de maniçoba" /></Campo>
                <Campo rotulo="Frase (opcional)"><input className={inputCls} value={b.texto} maxLength={120} onChange={(e) => editar(b.id, { texto: e.target.value })} placeholder="Ex.: Toda sexta, até acabar" /></Campo>
                <Campo rotulo="Ao tocar">
                  <select className={inputCls} value={b.acao?.tipo || ""} onChange={(e) => editar(b.id, { acao: e.target.value ? { tipo: e.target.value, id: alvos[e.target.value]?.[0]?.id || "" } : null })}>
                    {ACOES_BANNER.map((a) => <option key={a.id} value={a.id}>{a.rotulo}</option>)}
                  </select>
                </Campo>
                {b.acao?.tipo ? (
                  <Campo rotulo={b.acao.tipo === "categoria" ? "Seção" : b.acao.tipo === "promocao" ? "Promoção" : "Prato"}
                    dica={!alvos[b.acao.tipo]?.length ? "Nada disponível para escolher ainda." : undefined}>
                    <select className={inputCls} value={b.acao.id} onChange={(e) => editar(b.id, { acao: { tipo: b.acao.tipo, id: e.target.value } })}>
                      {(alvos[b.acao.tipo] || []).map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
                    </select>
                  </Campo>
                ) : null}
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
          </div>
        ) : null}
        <p className="mt-3 text-[11px] text-hf-muted">Vídeo toca sem som e em repetição, como nos aplicativos. Para quem pediu menos movimento no celular, ele espera o toque.</p>
      </Secao>
    </div>
  );
}
