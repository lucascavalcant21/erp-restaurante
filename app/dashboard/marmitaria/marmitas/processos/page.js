"use client";

// Processos da marmitaria: o passo a passo de cada marmita, da montagem até o
// motoboy, e quais embalagens servem para ela. Fica sob /marmitas para herdar a
// mesma permissão de rota. Os processos ficam em config_sistema.

import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowLeft, ArrowUp, Check, ClipboardList, ImagePlus, Plus, Trash2 } from "lucide-react";
import { useMarmitaria } from "../../../../components/marmitaria/contexto";
import { ehEmbalagem } from "../../../../components/marmitaria/BuscaItens";
import { Aviso, Botao, Campo, CampoNumero, Cartao, Secao, inputCls } from "../../../../components/marmitaria/ui";
import { fetchProcessosMarmitaria, salvarProcessosMarmitaria } from "../../../../lib/parametros";
import { uploadFotoMontagem } from "../../../../lib/montagem";
import { novaChave } from "../../../../lib/marmitaria/dados";
import { ETAPAS, moverEtapa, normalizarProcesso, resumoDoProcesso } from "../../../../lib/marmitaria/processos.mjs";
import { ordenarCategorias } from "../../../../lib/marmitaria/cardapio.mjs";

function Etapa({ etapa, grupo, nome, mudar, tirar, mover }) {
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState(null);
  async function foto(arquivo) {
    if (!arquivo) return;
    setEnviando(true); setErro(null);
    try {
      const { url, error } = await uploadFotoMontagem(arquivo, `${nome} ${etapa.titulo}`);
      if (error) setErro(`Foto não enviada: ${error}`); else mudar({ foto: url });
    } finally { setEnviando(false); }
  }
  return (
    <li className="rounded-xl border border-hf-border p-3">
      <div className="flex items-center gap-1">
        <input className={`${inputCls} font-bold`} value={etapa.titulo} onChange={(e) => mudar({ titulo: e.target.value })} aria-label="Nome da etapa" placeholder="Nome da etapa" />
        <button type="button" aria-label="Subir" onClick={() => mover(-1)} className="grid h-11 w-11 shrink-0 place-items-center rounded-lg text-hf-muted hover:bg-hf-elevated"><ArrowUp size={16} /></button>
        <button type="button" aria-label="Descer" onClick={() => mover(1)} className="grid h-11 w-11 shrink-0 place-items-center rounded-lg text-hf-muted hover:bg-hf-elevated"><ArrowDown size={16} /></button>
        <button type="button" aria-label={`Tirar ${etapa.titulo}`} onClick={tirar} className="grid h-11 w-11 shrink-0 place-items-center rounded-lg text-hf-muted hover:bg-hf-elevated"><Trash2 size={16} /></button>
      </div>
      <textarea className={`${inputCls} mt-2 min-h-[72px] py-2`} value={etapa.texto} onChange={(e) => mudar({ texto: e.target.value })} placeholder="Como fazer" aria-label={`Como fazer: ${etapa.titulo}`} />
      {grupo.tempo && (
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Campo rotulo="Tempo (min)"><CampoNumero valor={etapa.minutos} onChange={(v) => mudar({ minutos: v })} /></Campo>
          <Campo rotulo="Temperatura (°C)"><CampoNumero valor={etapa.graus} onChange={(v) => mudar({ graus: v })} /></Campo>
        </div>
      )}
      <div className="mt-2 flex items-center gap-3">
        {etapa.foto && <img src={etapa.foto} alt={etapa.titulo} className="h-16 w-16 rounded-lg object-cover" />}
        <label className="inline-flex min-h-[40px] cursor-pointer items-center gap-1.5 text-sm font-bold text-hf-accent">
          <ImagePlus size={16} /> {enviando ? "Enviando…" : etapa.foto ? "Trocar foto" : "Colocar foto"}
          <input type="file" accept="image/*" className="hidden" onChange={(e) => foto(e.target.files?.[0])} />
        </label>
      </div>
      {erro && <Aviso tipo="alerta" className="mt-2">{erro}</Aviso>}
    </li>
  );
}

function Editor({ marmita, inicial, onVoltar, onSalvar }) {
  const { base } = useMarmitaria();
  const [p, setP] = useState(() => normalizarProcesso(inicial));
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState(null);
  const embalagens = useMemo(() => base.insumosLista.filter(ehEmbalagem).sort((a, b) => String(a.nome).localeCompare(String(b.nome), "pt-BR")), [base]);
  const mudarEtapa = (id, campos) => setP((x) => ({ ...x, etapas: x.etapas.map((e) => (e.id === id ? { ...e, ...campos } : e)) }));
  const nova = (grupo, titulo) => setP((x) => ({ ...x, etapas: [...x.etapas, { id: novaChave(), grupo, titulo, texto: "", minutos: "", graus: "", foto: "" }] }));

  async function salvar() {
    if (salvando) return;
    setSalvando(true); setMsg(null);
    try {
      const r = await onSalvar(p);
      setMsg(r?.error ? { tipo: "alerta", texto: `Não foi possível salvar: ${r.error}` } : { tipo: "info", texto: "Processo salvo." });
    } finally { setSalvando(false); }
  }

  return (
    <div className="space-y-4">
      <button type="button" onClick={onVoltar} className="inline-flex min-h-[44px] items-center gap-2 rounded-xl px-2 text-sm font-semibold text-hf-text-2 hover:bg-hf-elevated"><ArrowLeft size={16} /> Voltar para os processos</button>
      <h2 className="text-lg font-black text-hf-text">{marmita.nome_receita}</h2>
      <Secao titulo="Embalagens que servem" subtitulo="Toque nas embalagens que podem ser usadas nesta marmita.">
        {!embalagens.length ? <p className="text-sm text-hf-text-2">Cadastre as embalagens primeiro.</p> : (
          <div className="flex flex-wrap gap-1.5">
            {embalagens.map((e) => {
              const sel = p.embalagens.includes(e.id);
              return <button key={e.id} type="button" aria-pressed={sel} onClick={() => setP((x) => ({ ...x, embalagens: sel ? x.embalagens.filter((i) => i !== e.id) : [...x.embalagens, e.id] }))}
                className={`inline-flex min-h-[40px] items-center gap-1 rounded-full border px-3 text-sm font-semibold ${sel ? "border-hf-accent bg-hf-accent text-hf-accent-fg" : "border-hf-border bg-hf-surface text-hf-text-2"}`}>{sel && <Check size={14} />}{e.nome}</button>;
            })}
          </div>
        )}
      </Secao>
      {ETAPAS.map((g) => {
        const lista = p.etapas.filter((e) => e.grupo === g.id);
        return (
          <Secao key={g.id} titulo={g.rotulo}>
            {lista.length > 0 && (
              <ol className="mb-3 space-y-2">
                {lista.map((e) => <Etapa key={e.id} etapa={e} grupo={g} nome={marmita.nome_receita} mudar={(c) => mudarEtapa(e.id, c)}
                  tirar={() => setP((x) => ({ ...x, etapas: x.etapas.filter((i) => i.id !== e.id) }))} mover={(d) => setP((x) => ({ ...x, etapas: moverEtapa(x.etapas, e.id, d) }))} />)}
              </ol>
            )}
            <div className="flex flex-wrap gap-1.5">
              {g.atalhos.map((a) => <button key={a} type="button" onClick={() => nova(g.id, a)} className="min-h-[40px] rounded-full border border-hf-border px-3 text-sm font-semibold text-hf-text-2"><Plus size={13} className="mr-1 inline" />{a}</button>)}
              <button type="button" onClick={() => nova(g.id, "")} className="min-h-[40px] rounded-full border border-dashed border-hf-border-strong px-3 text-sm font-semibold text-hf-accent">Outra etapa</button>
            </div>
          </Secao>
        );
      })}
      {msg && <Aviso tipo={msg.tipo}>{msg.texto}</Aviso>}
      <div className="sticky bottom-3 z-10 flex justify-end rounded-2xl border border-hf-border bg-hf-surface/95 p-2 backdrop-blur">
        <Botao type="button" onClick={salvar} disabled={salvando} className="min-w-[160px]">{salvando ? "Salvando…" : "Salvar processo"}</Botao>
      </div>
    </div>
  );
}

export default function ProcessosPage() {
  const { base, carregando, unidadeId } = useMarmitaria();
  const [processos, setProcessos] = useState({});
  const [abertoId, setAbertoId] = useState(null);
  useEffect(() => { if (unidadeId) fetchProcessosMarmitaria(unidadeId).then((r) => setProcessos(r.data || {})); }, [unidadeId]);

  if (!base) return carregando ? <Cartao><p className="text-sm text-hf-muted">Carregando processos…</p></Cartao> : null;
  const aberto = base.marmitas.find((m) => m.id === abertoId);
  if (aberto) {
    return <Editor key={aberto.id} marmita={aberto} inicial={processos[aberto.id]} onVoltar={() => setAbertoId(null)}
      onSalvar={async (p) => {
        const todos = { ...processos, [aberto.id]: p };
        const r = await salvarProcessosMarmitaria(unidadeId, todos);
        if (!r?.error) setProcessos(todos);
        return r;
      }} />;
  }

  const categorias = ordenarCategorias(base.marmitas.map((m) => m.categoria || "Sem categoria"));
  return (
    <Secao titulo="Processos" subtitulo="Como cada item é montado, fechado e entregue.">
      {!base.marmitas.length && <p className="text-sm text-hf-text-2">Monte as fichas técnicas primeiro.</p>}
      <div className="space-y-4">
        {categorias.map((c) => (
          <div key={c}>
            <p className="text-xs font-black uppercase tracking-wide text-hf-muted">{c}</p>
            <ul className="divide-y divide-hf-border">
              {base.marmitas.filter((m) => (m.categoria || "Sem categoria") === c).map((m) => {
                const r = resumoDoProcesso(processos[m.id]);
                return (
                  <li key={m.id}>
                    <button type="button" onClick={() => setAbertoId(m.id)} className="flex min-h-[60px] w-full items-center gap-3 py-2 text-left hover:bg-hf-elevated/40">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-hf-elevated text-hf-muted"><ClipboardList size={18} /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-bold text-hf-text">{m.nome_receita}</span>
                        <span className={`block text-xs ${r.etapas ? "text-hf-muted" : "font-semibold text-hf-warning"}`}>{r.etapas ? `${r.escritas} de ${r.etapas} etapas escritas · ${r.embalagens} embalagem(ns)` : "Processo não escrito"}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </Secao>
  );
}
