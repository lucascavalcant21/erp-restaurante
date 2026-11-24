"use client";

// Organizador de plataforma (pedido do dono, 17/11/2026): a vitrine do app de
// entrega montada aqui, igual ela aparece para o cliente (categoria, nome,
// descrição, foto, "a partir de", preço com cupom). Cada campo tem um botão de
// copiar, para colar na plataforma. Uma vitrine por app. O Jhon também
// preenche: prints da tela do app pelo "+ › Tela da plataforma".
// Fica sob /marmitas para herdar a permissão de rota do cardápio.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, Camera, Check, Copy, ImagePlus, MessageCircle, Pencil, Plus, ScanText, Trash2, X } from "lucide-react";
import { useMarmitaria } from "../../../../components/marmitaria/contexto";
import { Aviso, Botao, Campo, Cartao, inputCls } from "../../../../components/marmitaria/ui";
import { carregarOrganizador, enviarFotoDoPrato, salvarVitrine } from "../../../../lib/marmitaria/organizador-dados";
import {
  PLATAFORMAS_VITRINE, MAX_DESCRICAO, adicionarCategoria, descontoPct, mesclarLeitura, moverCategoria, moverItem, normalizarItem,
  pendencias, precoTexto, puxarMarmitas, removerCategoria, removerItem, renomearCategoria, rotuloPlataforma, salvarItem, textoDoItem, vitrineDe,
} from "../../../../lib/marmitaria/organizador.mjs";
import { MAX_PRINTS, cardapioDoOcr } from "../../../../lib/marmitaria/concorrentes.mjs";
import { reduzirImagem } from "../../../../components/intelligence/assistente/nota.mjs";
import { fetchComSessao } from "../../../../lib/api-sessao";

const PEDIDO_JHON = "/dashboard/inteligencia/assistente?q=" + encodeURIComponent("Jhon, vamos organizar a nossa tela da plataforma");
const fold = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const paraCampo = (v) => (v == null ? "" : String(v).replace(".", ","));

/** O canal da marmitaria que corresponde ao app (pelo nome); sem canal, sem preço. */
function canalDoApp(base, plataforma) {
  const rotulo = fold(rotuloPlataforma(plataforma));
  return (base?.config?.canais || []).find((c) => c.ativo !== false && (fold(c.nome).includes(rotulo) || fold(c.id).includes(fold(plataforma)))) || null;
}

function BotaoCopiar({ texto, rotulo = "Copiar" }) {
  const [ok, setOk] = useState(false);
  const copiar = async () => {
    try { await navigator.clipboard.writeText(texto); setOk(true); setTimeout(() => setOk(false), 1500); } catch { setOk(false); }
  };
  return (
    <button type="button" onClick={copiar} disabled={!texto}
      className="inline-flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-xl border border-hf-border bg-hf-surface px-3 text-[13px] font-semibold text-hf-text disabled:opacity-40">
      {ok ? <Check size={15} className="text-hf-success" /> : <Copy size={15} />} {ok ? "Copiado" : rotulo}
    </button>
  );
}

function Foto({ url, tamanho = "h-28 w-28" }) {
  if (url) return <img src={url} alt="" className={`${tamanho} shrink-0 rounded-2xl object-cover`} loading="lazy" />;
  return (
    <div className={`${tamanho} grid shrink-0 place-items-center rounded-2xl border border-dashed border-hf-border bg-hf-elevated text-hf-muted`}>
      <span className="flex flex-col items-center gap-1 text-[11px]"><Camera size={20} /> Sem foto</span>
    </div>
  );
}

function ItemVitrine({ item, onAbrir }) {
  const pct = descontoPct(item);
  return (
    <button type="button" onClick={onAbrir} className="flex w-full items-start gap-3 py-4 text-left">
      <div className="min-w-0 flex-1">
        <p className="text-[16px] font-semibold leading-snug text-hf-text">{item.nome}</p>
        {item.descricao
          ? <p className="mt-1 line-clamp-2 text-[14px] leading-snug text-hf-muted">{item.descricao}</p>
          : <p className="mt-1 text-[13px] italic text-hf-muted">Sem descrição</p>}
        {item.destaque && <p className="mt-1 text-[13px] font-medium text-hf-warning">{item.destaque}</p>}
        {item.preco != null ? (
          <div className="mt-2">
            {item.a_partir_de && <p className="text-[12px] text-hf-text">a partir de</p>}
            <p className="text-[17px] font-bold tabular-nums text-hf-text">{precoTexto(item.preco)}</p>
            {item.preco_cupom != null && (
              <p className="mt-0.5 flex items-center gap-1.5 text-[14px] font-semibold tabular-nums text-hf-success">
                {precoTexto(item.preco_cupom)}
                <span className="rounded-md bg-hf-success px-1.5 py-0.5 text-[11px] font-semibold text-white">Com cupom{pct ? ` · ${pct}%` : ""}</span>
              </p>
            )}
          </div>
        ) : <p className="mt-2 text-[13px] font-semibold text-hf-warning">Sem preço</p>}
      </div>
      <Foto url={item.foto_url} />
    </button>
  );
}

function FolhaItem({ inicial, categorias, categoriaId, unidadeId, onFechar, onSalvar, onApagar }) {
  const [it, setIt] = useState({ ...inicial, preco: paraCampo(inicial.preco), preco_cupom: paraCampo(inicial.preco_cupom) });
  const [cat, setCat] = useState(categoriaId);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const fotoRef = useRef(null);
  const nomeCat = categorias.find((c) => c.id === cat)?.nome || "";
  const pronto = normalizarItem(it);
  const mudar = (k) => (e) => setIt((x) => ({ ...x, [k]: e.target.value }));

  const enviarFoto = async (arquivo) => {
    if (!arquivo) return;
    setEnviando(true); setErro("");
    const r = await enviarFotoDoPrato(unidadeId, arquivo);
    setEnviando(false);
    if (r.erro || r.video) { setErro(r.erro || "Use uma foto (JPG, PNG ou WEBP)."); return; }
    setIt((x) => ({ ...x, foto_url: r.url }));
  };
  const salvar = () => {
    const e = onSalvar(cat, { ...it });
    if (e) setErro(e);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" role="dialog" aria-modal="true" data-sem-puxar>
      <div className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-hf-surface p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:rounded-3xl">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-base font-bold text-hf-text">{inicial.nome ? "Editar item" : "Novo item"}</h2>
          <button type="button" onClick={onFechar} aria-label="Fechar" className="grid h-10 w-10 place-items-center rounded-full text-hf-muted hover:bg-hf-elevated"><X size={20} /></button>
        </div>

        <div className="flex items-start gap-3">
          <Foto url={it.foto_url} />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <input ref={fotoRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; enviarFoto(f); }} />
            <Botao variante="secundario" onClick={() => fotoRef.current?.click()} disabled={enviando}><ImagePlus size={16} /> {enviando ? "Enviando…" : it.foto_url ? "Trocar foto" : "Pôr foto"}</Botao>
            {it.foto_url && <a href={it.foto_url} target="_blank" rel="noreferrer" className="text-center text-[13px] font-semibold text-hf-accent">Abrir foto para salvar</a>}
          </div>
        </div>

        <div className="mt-4 space-y-3">
          <Campo rotulo="Categoria">
            <div className="flex gap-2">
              <select value={cat} onChange={(e) => setCat(e.target.value)} className={inputCls}>
                {categorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
              <BotaoCopiar texto={nomeCat} />
            </div>
          </Campo>
          <Campo rotulo="Nome do prato">
            <div className="flex gap-2"><input value={it.nome} onChange={mudar("nome")} maxLength={160} className={inputCls} placeholder="Ex.: Strogonoff de Carne" /><BotaoCopiar texto={pronto.nome} /></div>
          </Campo>
          <Campo rotulo="Descrição" dica={`${String(it.descricao || "").length}/${MAX_DESCRICAO}`}>
            <div className="flex items-start gap-2">
              <textarea value={it.descricao} onChange={mudar("descricao")} maxLength={MAX_DESCRICAO} rows={3} className={`${inputCls} py-2`} placeholder="O que vem no prato" />
              <BotaoCopiar texto={pronto.descricao} />
            </div>
          </Campo>
          <div className="grid grid-cols-2 gap-3">
            <Campo rotulo="Preço (R$)">
              <input value={it.preco} onChange={mudar("preco")} inputMode="decimal" className={inputCls} placeholder="40,00" />
            </Campo>
            <Campo rotulo="Preço com cupom (R$)" dica="Deixe vazio se não tiver">
              <input value={it.preco_cupom} onChange={mudar("preco_cupom")} inputMode="decimal" className={inputCls} placeholder="28,00" />
            </Campo>
          </div>
          <div className="flex flex-wrap gap-2">
            <BotaoCopiar texto={pronto.preco != null ? paraCampo(pronto.preco.toFixed(2)) : ""} rotulo="Copiar preço" />
            <BotaoCopiar texto={pronto.preco_cupom != null ? paraCampo(pronto.preco_cupom.toFixed(2)) : ""} rotulo="Copiar cupom" />
          </div>
          {pronto.preco != null && it.preco_cupom && pronto.preco_cupom == null && <p className="text-[12px] text-hf-warning">O preço com cupom precisa ser menor que o preço; ele não será guardado.</p>}
          <label className="flex min-h-[44px] items-center gap-2 text-sm text-hf-text">
            <input type="checkbox" checked={it.a_partir_de !== false} onChange={(e) => setIt((x) => ({ ...x, a_partir_de: e.target.checked }))} className="h-5 w-5" />
            Mostrar "a partir de" antes do preço
          </label>
          <Campo rotulo="Selo (opcional)" dica='Ex.: "1º mais curtido", "Novo"'>
            <input value={it.destaque} onChange={mudar("destaque")} maxLength={60} className={inputCls} />
          </Campo>
        </div>

        {erro && <Aviso tipo="alerta" className="mt-3">{erro}</Aviso>}

        <div className="mt-4 grid gap-2">
          <BotaoCopiar texto={textoDoItem(pronto, nomeCat)} rotulo="Copiar tudo" />
          <Botao onClick={salvar} disabled={enviando}>Salvar</Botao>
          {inicial.nome && <Botao variante="perigo" onClick={onApagar}><Trash2 size={16} /> Tirar da vitrine</Botao>}
        </div>
      </div>
    </div>
  );
}

export default function OrganizadorPlataforma() {
  const { unidadeId, base } = useMarmitaria();
  const [plataforma, setPlataforma] = useState("ifood");
  const [org, setOrg] = useState(null);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [estado, setEstado] = useState("");
  const [organizando, setOrganizando] = useState(false);
  const [aberto, setAberto] = useState(null); // { item, categoriaId }
  const [lendo, setLendo] = useState(false);
  const fila = useRef(Promise.resolve());
  const printRef = useRef(null);

  const recarregar = useCallback(async () => {
    const r = await carregarOrganizador(unidadeId);
    setErro(r.erro || "");
    setOrg(r.organizador);
  }, [unidadeId]);
  useEffect(() => { recarregar(); }, [recarregar]);

  const vitrine = useMemo(() => vitrineDe(org, plataforma), [org, plataforma]);
  const falta = useMemo(() => pendencias(vitrine), [vitrine]);

  // Cada mudança vai para o banco na hora, uma depois da outra.
  const aplicar = useCallback((nova) => {
    setOrg((o) => ({ ...(o || {}), plataformas: { ...(o?.plataformas || {}), [plataforma]: nova } }));
    setEstado("Salvando…");
    fila.current = fila.current.then(async () => {
      const r = await salvarVitrine(unidadeId, plataforma, nova);
      setEstado(r.erro ? "" : "Salvo");
      if (r.erro) setErro(r.erro);
    });
  }, [unidadeId, plataforma]);

  const novaCategoria = () => {
    const nome = window.prompt("Nome da categoria (como vai aparecer no app):");
    if (nome == null) return;
    const r = adicionarCategoria(vitrine, nome);
    if (r.erro) setAviso(r.erro); else { setAviso(""); aplicar(r.vitrine); }
  };
  const renomear = (c) => {
    const nome = window.prompt("Novo nome da categoria:", c.nome);
    if (nome == null) return;
    const r = renomearCategoria(vitrine, c.id, nome);
    if (r.erro) setAviso(r.erro); else aplicar(r.vitrine);
  };
  const apagarCategoria = (c) => {
    if (c.itens.length && !window.confirm(`Tirar a categoria "${c.nome}" e os ${c.itens.length} itens dela da vitrine?`)) return;
    aplicar(removerCategoria(vitrine, c.id));
  };
  const novoItem = (categoriaId) => {
    let v = vitrine; let cat = categoriaId || v.categorias[0]?.id;
    if (!cat) { const r = adicionarCategoria(v, "Marmitas"); v = r.vitrine; cat = v.categorias[0].id; aplicar(v); }
    setAberto({ item: normalizarItem({ nome: "" }), categoriaId: cat, novo: true });
  };

  const puxar = () => {
    const canal = canalDoApp(base, plataforma);
    const r = puxarMarmitas(vitrine, base?.marmitas || [], (m) => (canal ? Number(m.precos?.[canal.id]) || null : null));
    if (!r.novos) { setAviso("Todas as marmitas ativas já estão nesta vitrine."); return; }
    aplicar(r.vitrine);
    setAviso(`${r.novos} ${r.novos === 1 ? "marmita entrou" : "marmitas entraram"} na vitrine${canal ? ` com o preço do ${canal.nome}` : `, sem preço: não há canal ${rotuloPlataforma(plataforma)} cadastrado nas marmitas`}. Confira e complete.`);
  };

  const lerPrints = async (lista) => {
    const arquivos = [...(lista || [])].slice(0, MAX_PRINTS);
    if (!arquivos.length) return;
    setLendo(true); setAviso("");
    try {
      let fotos = await Promise.all(arquivos.map((a) => reduzirImagem(a)));
      if (fotos.reduce((t, f) => t + f.dataUrl.length, 0) > 4_000_000) fotos = await Promise.all(arquivos.map((a) => reduzirImagem(a, { lado: 1280, qualidade: 0.7 })));
      const resp = await fetchComSessao("/api/ocr/cardapio", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ imagens: fotos.map((f) => f.dataUrl) }) });
      const lido = await resp.json().catch(() => null);
      if (!resp.ok) { setAviso(lido?.error || "Não consegui ler os prints agora."); return; }
      const cardapio = cardapioDoOcr(lido);
      if (!cardapio) { setAviso("Não encontrei pratos com preço nesses prints."); return; }
      const r = mesclarLeitura(vitrine, cardapio.itens);
      aplicar(r.vitrine);
      setAviso(`Li ${cardapio.itens.length} itens: ${r.novos} novos, ${r.atualizados} atualizados. As fotos não vêm do print: ponha as fotos tocando em cada prato.`);
    } catch {
      setAviso("Não consegui abrir os prints. Tente de novo.");
    } finally {
      setLendo(false);
    }
  };

  if (!org) return <Cartao><p className="text-sm text-hf-muted">{erro || "Carregando a vitrine…"}</p></Cartao>;

  return (
    <div className="space-y-4">
      <Cartao>
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold tracking-tight text-hf-text">Organizador de plataforma</h2>
            <p className="mt-0.5 text-[13px] text-hf-muted">Monte a vitrine como ela aparece no app e copie cada campo para a plataforma.</p>
          </div>
          {estado && <span className="shrink-0 text-[12px] text-hf-muted">{estado}</span>}
        </div>
        <div className="-mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-1">
          {PLATAFORMAS_VITRINE.map((p) => (
            <button key={p.id} type="button" onClick={() => { setPlataforma(p.id); setAviso(""); }}
              className={`min-h-[40px] shrink-0 whitespace-nowrap rounded-full px-4 text-sm font-semibold ${plataforma === p.id ? "bg-hf-menu text-white" : "bg-hf-elevated text-hf-text"}`}>
              {p.rotulo}
            </button>
          ))}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          <Botao onClick={() => novoItem()}><Plus size={16} /> Item</Botao>
          <Botao variante="secundario" onClick={novaCategoria}><Plus size={16} /> Categoria</Botao>
          <Botao variante="secundario" onClick={puxar} disabled={!base?.marmitas?.length}>Puxar nossas marmitas</Botao>
          <Botao variante="secundario" onClick={() => printRef.current?.click()} disabled={lendo}><ScanText size={16} /> {lendo ? "Lendo…" : "Ler print do app"}</Botao>
          <input ref={printRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { const fs = e.target.files; lerPrints(fs); e.target.value = ""; }} />
          <Botao variante={organizando ? "primario" : "secundario"} onClick={() => setOrganizando((v) => !v)}><Pencil size={16} /> {organizando ? "Pronto" : "Organizar ordem"}</Botao>
          <Link href={PEDIDO_JHON} className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-hf-border px-4 text-sm font-bold text-hf-text"><MessageCircle size={16} /> Pelo Jhon</Link>
        </div>
      </Cartao>

      {erro && <Aviso tipo="alerta">{erro}</Aviso>}
      {aviso && <Aviso>{aviso}</Aviso>}
      {(falta.semFoto.length > 0 || falta.semDescricao.length > 0 || falta.semPreco.length > 0) && (
        <Aviso tipo="alerta">
          Falta para copiar: {[falta.semFoto.length && `${falta.semFoto.length} sem foto`, falta.semDescricao.length && `${falta.semDescricao.length} sem descrição`, falta.semPreco.length && `${falta.semPreco.length} sem preço`].filter(Boolean).join(", ")}.
        </Aviso>
      )}

      {!vitrine.categorias.length ? (
        <Cartao>
          <p className="font-semibold text-hf-text">A vitrine do {rotuloPlataforma(plataforma)} está vazia</p>
          <p className="mt-1 text-sm text-hf-muted">Puxe as nossas marmitas, leia um print da tela do app ou crie a primeira categoria.</p>
        </Cartao>
      ) : (
        <Cartao className="!p-0">
          <div className="sticky top-0 z-10 -mb-1 flex gap-2 overflow-x-auto rounded-t-2xl border-b border-hf-border bg-hf-surface px-4 py-3">
            {vitrine.categorias.map((c) => (
              <a key={c.id} href={`#cat-${c.id}`} className="shrink-0 whitespace-nowrap rounded-full bg-hf-elevated px-4 py-2 text-[14px] font-semibold text-hf-text">{c.nome}</a>
            ))}
          </div>
          <div className="px-4 pb-2">
            {vitrine.categorias.map((c, ci) => (
              <section key={c.id} id={`cat-${c.id}`} className="scroll-mt-20 pt-6">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="text-[20px] font-bold leading-tight text-hf-text">{c.nome}</h2>
                  {organizando ? (
                    <div className="flex shrink-0 gap-1">
                      <button type="button" aria-label="Subir categoria" disabled={ci === 0} onClick={() => aplicar(moverCategoria(vitrine, c.id, -1))} className="grid h-10 w-10 place-items-center rounded-xl border border-hf-border disabled:opacity-30"><ArrowUp size={16} /></button>
                      <button type="button" aria-label="Descer categoria" disabled={ci === vitrine.categorias.length - 1} onClick={() => aplicar(moverCategoria(vitrine, c.id, 1))} className="grid h-10 w-10 place-items-center rounded-xl border border-hf-border disabled:opacity-30"><ArrowDown size={16} /></button>
                      <button type="button" aria-label="Renomear categoria" onClick={() => renomear(c)} className="grid h-10 w-10 place-items-center rounded-xl border border-hf-border"><Pencil size={16} /></button>
                      <button type="button" aria-label="Tirar categoria" onClick={() => apagarCategoria(c)} className="grid h-10 w-10 place-items-center rounded-xl border border-hf-border text-hf-danger"><Trash2 size={16} /></button>
                    </div>
                  ) : <BotaoCopiar texto={c.nome} />}
                </div>
                <ul className="divide-y divide-hf-border">
                  {c.itens.map((i, ii) => (
                    <li key={i.id} className="flex items-center gap-2">
                      {organizando && (
                        <div className="flex shrink-0 flex-col gap-1">
                          <button type="button" aria-label="Subir item" disabled={ii === 0} onClick={() => aplicar(moverItem(vitrine, c.id, i.id, -1))} className="grid h-9 w-9 place-items-center rounded-lg border border-hf-border disabled:opacity-30"><ArrowUp size={14} /></button>
                          <button type="button" aria-label="Descer item" disabled={ii === c.itens.length - 1} onClick={() => aplicar(moverItem(vitrine, c.id, i.id, 1))} className="grid h-9 w-9 place-items-center rounded-lg border border-hf-border disabled:opacity-30"><ArrowDown size={14} /></button>
                        </div>
                      )}
                      <div className="min-w-0 flex-1"><ItemVitrine item={i} onAbrir={() => setAberto({ item: i, categoriaId: c.id })} /></div>
                    </li>
                  ))}
                </ul>
                <button type="button" onClick={() => novoItem(c.id)} className="mt-1 flex min-h-[44px] items-center gap-1.5 text-sm font-semibold text-hf-accent"><Plus size={16} /> Item em {c.nome}</button>
              </section>
            ))}
          </div>
        </Cartao>
      )}

      {aberto && (
        <FolhaItem
          key={aberto.item.id}
          inicial={aberto.item}
          categoriaId={aberto.categoriaId}
          categorias={vitrine.categorias}
          unidadeId={unidadeId}
          onFechar={() => setAberto(null)}
          onSalvar={(cat, item) => {
            const r = salvarItem(vitrine, cat, item);
            if (r.erro) return r.erro;
            aplicar(r.vitrine); setAberto(null); return null;
          }}
          onApagar={() => { aplicar(removerItem(vitrine, aberto.item.id)); setAberto(null); }}
        />
      )}
    </div>
  );
}
