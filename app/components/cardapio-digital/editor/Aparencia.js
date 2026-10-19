"use client";

import { Check } from "lucide-react";
import { ESTILOS_LISTA, FONTES, TEMAS_PRONTOS, contraste, normalizarTema } from "../../../lib/cardapio-digital.mjs";
import { Aviso, CampoCor, Envio, Secao } from "./ui";

export default function Aparencia({ config, mudar, unidadeId }) {
  const tema = config.tema;
  const t = (campos) => mudar((c) => ({ ...c, tema: { ...c.tema, ...campos } }));
  const efetivo = normalizarTema(tema);
  const textoTrocado = efetivo.cor_texto !== tema.cor_texto;
  const cartaoTrocado = efetivo.cor_cartao !== tema.cor_cartao;
  const botaoFraco = contraste(efetivo.cor_primaria, efetivo.cor_cartao) < 3;

  return (
    <div className="space-y-4">
      <Secao titulo="Começar por um tema" subtitulo="Escolha um ponto de partida; depois ajuste cada cor como quiser.">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {TEMAS_PRONTOS.map((p) => {
            const ativo = ["cor_primaria", "cor_fundo", "cor_texto", "cor_cartao"].every((k) => tema[k] === p.tema[k]);
            return (
              <button key={p.id} type="button" onClick={() => t(p.tema)} aria-pressed={ativo}
                className={`flex min-h-[64px] items-center gap-3 rounded-xl border p-2.5 text-left transition ${ativo ? "border-hf-accent ring-2 ring-hf-accent/20" : "border-hf-border hover:border-hf-border-strong"}`}>
                <span className="grid h-11 w-11 flex-shrink-0 grid-cols-2 overflow-hidden rounded-lg border border-hf-border">
                  <span style={{ background: p.tema.cor_fundo }} /><span style={{ background: p.tema.cor_primaria }} />
                  <span style={{ background: p.tema.cor_cartao }} /><span style={{ background: p.tema.cor_texto }} />
                </span>
                <span className="min-w-0 flex-1 text-sm font-semibold text-hf-text">{p.nome}</span>
                {ativo ? <Check size={16} className="text-hf-accent" /> : null}
              </button>
            );
          })}
        </div>
      </Secao>

      <Secao titulo="Cores" subtitulo="O cardápio garante a leitura: se o texto sumir no fundo, ele troca sozinho para claro ou escuro.">
        <div className="grid gap-3 sm:grid-cols-2">
          <CampoCor rotulo="Cor da casa (botões e preços)" valor={tema.cor_primaria} onChange={(v) => t({ cor_primaria: v })} />
          <CampoCor rotulo="Fundo" valor={tema.cor_fundo} onChange={(v) => t({ cor_fundo: v })} />
          <CampoCor rotulo="Texto" valor={tema.cor_texto} onChange={(v) => t({ cor_texto: v })} />
          <CampoCor rotulo="Cartões e janelas" valor={tema.cor_cartao} onChange={(v) => t({ cor_cartao: v })} />
        </div>
        {textoTrocado || cartaoTrocado || botaoFraco ? (
          <div className="mt-3 space-y-2">
            {textoTrocado ? <Aviso tipo="alerta">Esse texto ficaria ilegível nesse fundo. O cardápio está usando {efetivo.cor_texto} no lugar.</Aviso> : null}
            {cartaoTrocado ? <Aviso tipo="alerta">O texto não aparece bem nos cartões com essa cor; os cartões estão usando a cor do fundo.</Aviso> : null}
            {botaoFraco ? <Aviso>A cor da casa está clara demais para preços nos cartões; eles saem na cor do texto. Os botões continuam na cor da casa.</Aviso> : null}
          </div>
        ) : null}
      </Secao>

      <Secao titulo="Letras e lista">
        <p className="mb-2 text-xs font-semibold text-hf-text-2">Estilo dos títulos</p>
        <div className="grid gap-2 sm:grid-cols-3">
          {FONTES.map((f) => (
            <button key={f.id} type="button" onClick={() => t({ fonte: f.id })} aria-pressed={tema.fonte === f.id}
              className={`min-h-[64px] rounded-xl border p-3 text-left transition ${tema.fonte === f.id ? "border-hf-accent ring-2 ring-hf-accent/20" : "border-hf-border hover:border-hf-border-strong"}`}>
              <span className="block text-sm font-bold text-hf-text">{f.rotulo}</span>
              <span className="block text-xs text-hf-muted">{f.detalhe}</span>
            </button>
          ))}
        </div>
        <p className="mb-2 mt-4 text-xs font-semibold text-hf-text-2">Como os pratos aparecem</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {ESTILOS_LISTA.map((e) => (
            <button key={e.id} type="button" onClick={() => t({ estilo_lista: e.id })} aria-pressed={tema.estilo_lista === e.id}
              className={`min-h-[64px] rounded-xl border p-3 text-left transition ${tema.estilo_lista === e.id ? "border-hf-accent ring-2 ring-hf-accent/20" : "border-hf-border hover:border-hf-border-strong"}`}>
              <span className="block text-sm font-bold text-hf-text">{e.rotulo}</span>
              <span className="block text-xs text-hf-muted">{e.detalhe}</span>
            </button>
          ))}
        </div>
      </Secao>

      <Secao titulo="Logo e imagens" subtitulo="A capa aparece quando a abertura não tem fotos nem vídeos.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Envio rotulo="Logo" url={tema.logo_url} unidadeId={unidadeId} pasta="marca" onEnviado={(url) => t({ logo_url: url })} onRemover={() => t({ logo_url: "" })} />
          <Envio rotulo="Capa" url={tema.capa_url} unidadeId={unidadeId} pasta="marca" onEnviado={(url) => t({ capa_url: url })} onRemover={() => t({ capa_url: "" })} />
          <div className="sm:col-span-2">
            <Envio rotulo="Imagem de fundo (atrás de todo o cardápio)" url={tema.fundo_imagem_url} unidadeId={unidadeId} pasta="marca"
              onEnviado={(url) => t({ fundo_imagem_url: url })} onRemover={() => t({ fundo_imagem_url: "" })} />
            {tema.fundo_imagem_url ? (
              <label className="mt-3 block">
                <span className="mb-1 block text-xs font-semibold text-hf-text-2">Força da imagem de fundo: {Math.round((tema.fundo_opacidade ?? 0.12) * 100)}%</span>
                <input type="range" min="0" max="0.9" step="0.02" value={tema.fundo_opacidade ?? 0.12}
                  onChange={(e) => t({ fundo_opacidade: Number(e.target.value) })} className="w-full accent-[rgb(var(--hf-accent))]" />
                <span className="block text-[11px] text-hf-muted">Fraquinha deixa o texto mais fácil de ler.</span>
              </label>
            ) : null}
          </div>
        </div>
      </Secao>
    </div>
  );
}
