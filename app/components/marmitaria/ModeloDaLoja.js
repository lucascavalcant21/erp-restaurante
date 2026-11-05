"use client";

// Modelo da loja: o cardápio como ele aparece para o cliente na plataforma,
// pronto para copiar e colar. Lê as linhas do Cardápio (mesmo preço, mesma
// promoção). Contas em lib/marmitaria/modelo-loja.mjs.

import { useEffect, useMemo, useState } from "react";
import { Check, ClipboardCopy, ImagePlus, UtensilsCrossed, X } from "lucide-react";
import { useMarmitaria } from "./contexto";
import { Aviso, Botao, Campo, Secao, brl, inputCls } from "./ui";
import { fetchVendas, salvarDescricao } from "../../lib/marmitaria/dados";
import { modeloDaLoja, precoParaColar, textoDoModelo } from "../../lib/marmitaria/modelo-loja.mjs";
import { somarDiasIso } from "../../lib/cmv-real.mjs";

function BotaoCopiar({ texto, rotulo, variante = "secundario" }) {
  const [estado, setEstado] = useState(null);
  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      setEstado("ok");
      setTimeout(() => setEstado(null), 1800);
    } catch { setEstado("erro"); }
  }
  return (
    <Botao variante={variante} type="button" onClick={copiar} disabled={!texto}>
      {estado === "ok" ? <><Check size={16} /> Copiado</> : <><ClipboardCopy size={16} /> {estado === "erro" ? "Não copiou" : rotulo}</>}
    </Botao>
  );
}

function Foto({ item, className = "" }) {
  return (
    <span className={`grid shrink-0 place-items-center overflow-hidden bg-hf-elevated text-hf-muted ${className}`}>
      {item.foto ? <img src={item.foto} alt="" className="h-full w-full object-cover" /> : <UtensilsCrossed size={22} />}
    </span>
  );
}

function Preco({ item }) {
  if (item.semPreco) return <span className="text-sm font-bold text-hf-warning">Sem preço</span>;
  return (
    <span className="text-sm font-bold tabular-nums text-hf-text">
      {item.precoDe && <span className="mr-1.5 text-xs font-semibold text-hf-muted line-through">{brl(item.precoDe)}</span>}
      {brl(item.preco)}
    </span>
  );
}

// Toque no item: a tela que o cliente abre, com tudo pronto para copiar.
function DetalheDoItem({ item, canal, onFechar, onEditar }) {
  const { recarregar } = useMarmitaria();
  const [descricao, setDescricao] = useState(item.descricao);
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState(null);
  const mudou = descricao.trim() !== item.descricao;

  useEffect(() => {
    const esc = (e) => { if (e.key === "Escape") onFechar(); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onFechar]);

  async function salvar() {
    if (salvando) return;
    setSalvando(true); setMsg(null);
    try {
      const r = await salvarDescricao(item.fichaId, descricao);
      if (r.error) { setMsg({ tipo: "alerta", texto: r.error }); return; }
      await recarregar();
      setMsg({ tipo: "info", texto: "Descrição salva." });
    } finally { setSalvando(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4" onClick={onFechar}>
      <div role="dialog" aria-modal="true" aria-label={item.nome} onClick={(e) => e.stopPropagation()}
        className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-hf-surface sm:rounded-2xl">
        <div className="relative">
          {item.foto ? <img src={item.foto} alt={item.nome} className="aspect-[4/3] w-full object-cover" />
            : !item.combo && <div className="grid aspect-[4/3] w-full place-items-center bg-hf-elevated text-hf-muted"><span className="flex flex-col items-center gap-1 text-sm font-semibold"><ImagePlus size={26} /> Sem foto</span></div>}
          <button type="button" onClick={onFechar} aria-label="Fechar" className={`grid h-11 w-11 place-items-center rounded-full bg-hf-surface text-hf-text shadow ${item.foto || !item.combo ? "absolute right-3 top-3" : "ml-auto mr-3 mt-3"}`}><X size={18} /></button>
        </div>
        <div className="space-y-3 p-4">
          <div>
            <p className="text-lg font-black text-hf-text">{item.nome}</p>
            <Preco item={item} />
            <p className="text-xs text-hf-muted">Preço no {canal.nome}{item.selo ? ` · ${item.selo}` : ""}</p>
          </div>
          {item.fichaId ? (
            <Campo rotulo="Descrição">
              <textarea className={`${inputCls} min-h-[112px] py-2`} value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex.: arroz, feijão, frango grelhado e salada" />
            </Campo>
          ) : <p className="text-sm text-hf-text-2">{item.descricao}</p>}
          {msg && <Aviso tipo={msg.tipo}>{msg.texto}</Aviso>}
          <div className="flex flex-wrap gap-2">
            {mudou && <Botao type="button" onClick={salvar} disabled={salvando}>{salvando ? "Salvando…" : "Salvar descrição"}</Botao>}
            <BotaoCopiar texto={item.nome} rotulo="Copiar nome" />
            <BotaoCopiar texto={descricao.trim()} rotulo="Copiar descrição" />
            <BotaoCopiar texto={precoParaColar(item.preco)} rotulo="Copiar preço" />
          </div>
          {item.fichaId && onEditar && <button type="button" onClick={() => onEditar({ id: item.fichaId })} className="min-h-[36px] text-sm font-bold text-hf-accent hover:underline">{item.semFoto ? "Colocar foto na ficha" : "Trocar nome ou foto na ficha"}</button>}
        </div>
      </div>
    </div>
  );
}

export default function ModeloDaLoja({ linhas, canal, onEditar }) {
  const { unidadeId } = useMarmitaria();
  const [vendas, setVendas] = useState([]);
  const [abertoId, setAbertoId] = useState(null);

  useEffect(() => {
    if (!unidadeId) return;
    let vivo = true;
    const hoje = new Date().toLocaleDateString("sv-SE");
    fetchVendas(unidadeId, somarDiasIso(hoje, -30), hoje).then((r) => { if (vivo) setVendas(r.data || []); });
    return () => { vivo = false; };
  }, [unidadeId]);

  const modelo = useMemo(() => modeloDaLoja({ linhas, vendas }), [linhas, vendas]);
  const todos = [...modelo.maisPedidos, ...modelo.secoes.flatMap((s) => s.itens)];
  const aberto = todos.find((i) => i.id === abertoId) || null;
  const f = modelo.faltando;
  const pendencias = [f.foto && `${f.foto} sem foto`, f.descricao && `${f.descricao} sem descrição`, f.preco && `${f.preco} sem preço`].filter(Boolean);

  if (!modelo.secoes.length) return <Secao titulo="Modelo da loja"><p className="text-sm text-hf-text-2">Monte as fichas técnicas para ver o modelo.</p></Secao>;

  return (
    <Secao titulo={`Modelo da loja no ${canal.nome}`} subtitulo="Toque em um item para abrir, escrever a descrição e copiar."
      direita={<BotaoCopiar texto={textoDoModelo(modelo)} rotulo="Copiar cardápio inteiro" />}>
      {pendencias.length > 0 && <Aviso tipo="alerta" className="mb-4">Antes de passar para a plataforma: {pendencias.join(", ")}.</Aviso>}

      <div className="space-y-6">
        <section aria-label="Mais pedidos">
          <h3 className="mb-2 text-base font-black text-hf-text">Mais pedidos</h3>
          {modelo.maisPedidos.length ? (
            <ul className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
              {modelo.maisPedidos.map((i) => (
                <li key={i.id} className="w-36 shrink-0">
                  <button type="button" onClick={() => setAbertoId(i.id)} className="w-full text-left">
                    <Foto item={i} className="aspect-square w-full rounded-xl" />
                    <span className="mt-1.5 block"><Preco item={i} /></span>
                    <span className="line-clamp-2 block text-sm text-hf-text-2">{i.nome}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : <p className="rounded-xl bg-hf-elevated p-3 text-sm text-hf-text-2">Aparece quando houver vendas lançadas nos últimos 30 dias.</p>}
        </section>

        {modelo.secoes.map((s) => (
          <section key={s.id} aria-label={s.titulo}>
            <h3 className="mb-1 text-base font-black text-hf-text">{s.titulo}</h3>
            <ul className="grid gap-x-6 divide-y divide-hf-border lg:grid-cols-2 lg:divide-y-0">
              {s.itens.map((i) => (
                <li key={i.id}>
                  <button type="button" onClick={() => setAbertoId(i.id)} className="flex min-h-[112px] w-full items-center gap-3 py-3 text-left hover:bg-hf-elevated/40">
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold text-hf-text">{i.nome}</span>
                      {i.descricao ? <span className="mt-0.5 line-clamp-2 block text-sm text-hf-muted">{i.descricao}</span>
                        : <span className="mt-0.5 block text-sm font-semibold text-hf-warning">Sem descrição</span>}
                      <span className="mt-1 flex flex-wrap items-center gap-2">
                        <Preco item={i} />
                        {i.selo && <span className="rounded-md bg-hf-danger/10 px-1.5 py-0.5 text-[11px] font-black text-hf-danger">{i.selo}</span>}
                      </span>
                    </span>
                    {!i.combo && <Foto item={i} className="h-24 w-24 rounded-xl" />}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      {aberto && <DetalheDoItem key={aberto.id} item={aberto} canal={canal} onFechar={() => setAbertoId(null)} onEditar={onEditar} />}
    </Secao>
  );
}
