"use client";

// Ficha técnica numa tela só: dados, ingredientes e pré-preparos, embalagens e
// o custo final, recalculado a cada tecla. Preço não mora aqui: fica no
// Cardápio, por plataforma. Salvar nunca fica preso
// em "Salvando…" (finally) e, se der erro, o que foi digitado continua aqui.

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Check, ImagePlus, Pencil, Trash2 } from "lucide-react";
import { useMarmitaria } from "./contexto";
import BuscaItens, { ehEmbalagem } from "./BuscaItens";
import { NovoProduto, NovoPrePreparo } from "./CadastrosRapidos";
import { Aviso, Botao, Campo, CampoNumero, Secao, brl, inputCls, pctTxt } from "./ui";
import { salvarMarmita, novaChave, arquivarPrePreparo } from "../../lib/marmitaria/dados";
import { apagarRascunhoNoBanco as apagarRascunho, guardarRascunhoNoBanco } from "../../lib/rascunho-aparelho";
import { atalhosDeQuantidade, catalogoDePrePreparos, custoDoForm, payloadDoForm, TAMANHOS, TIPOS_EMBALAGEM, unidadeDoItem } from "../../lib/marmitaria/formulario.mjs";
import { unidadesCompativeis } from "../../lib/marmitaria/nucleo.mjs";
import { CATEGORIAS_FICHA, ordenarCategorias } from "../../lib/marmitaria/cardapio.mjs";
import { pesosDoInsumo } from "../../lib/ficha-calculos.mjs";
import { normalizarBusca } from "../../lib/ingredientes-utils.mjs";
import { custoDeProduzirFicha, custoUnitarioEfetivoInsumo, parseNumero } from "../../lib/ficha-calculos.mjs";
import { uploadFotoMontagem } from "../../lib/montagem";

export const chaveRascunhoFicha = (unidadeId) => `ficha-marmita:${unidadeId}`;

export default function EditorMarmita({ form: formInicial, onFechar: fecharSemRascunho, onSalvo, recuperado = null }) {
  const { base, unidadeId, recarregar } = useMarmitaria();
  const [form, setForm] = useState(formInicial);
  const [painel, setPainel] = useState(() => (recuperado?.painelPrep ? "novo-prep" : null)); // busca-item | busca-emb | novo-prod | novo-prep | nova-emb | editar-prep
  // rascunho no aparelho (dono, 17/11/2026: "o sistema atualiza e some a ficha que eu estava criando")
  // só é rascunho o que mudou: abrir uma ficha para olhar não pode deixá-la "aberta" na próxima visita (dono, 17/11)
  const [original] = useState(() => JSON.stringify(formInicial));
  const mudou = !!recuperado || JSON.stringify(form) !== original;
  const onFechar = () => {
    if (mudou && (form.nome?.trim() || form.itens?.length) && typeof window !== "undefined" && !window.confirm("Sair sem salvar? O que você montou nesta ficha será descartado.")) return;
    apagarRascunho(chaveRascunhoFicha(unidadeId)); fecharSemRascunho?.();
  };
  const [prepEditando, setPrepEditando] = useState(null);
  const [avisoPrep, setAvisoPrep] = useState(null);
  const [textoNovo, setTextoNovo] = useState(() => recuperado?.textoNovo || "");
  useEffect(() => {
    const chave = chaveRascunhoFicha(unidadeId);
    if (mudou || painel === "novo-prep") guardarRascunhoNoBanco(chave, { form, painelPrep: painel === "novo-prep", textoNovo }, unidadeId);
    else apagarRascunho(chave);
  }, [form, painel, textoNovo, unidadeId, mudou]);
  const [tipoEmb, setTipoEmb] = useState("marmitex");
  const [salvando, setSalvando] = useState(false);
  const [erros, setErros] = useState([]);
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  const fotoRef = useRef(null);
  const ctx = { insumos: base.insumos, fichas: base.fichas };

  const set = (campo, valor) => setForm((f) => ({ ...f, [campo]: valor }));
  const custo = useMemo(() => custoDoForm(form, ctx), [form, base]); // eslint-disable-line react-hooks/exhaustive-deps

  // `unidade` vem de quem acabou de cadastrar (a base recarregada ainda não
  // chegou a esta closure).
  function adicionarItem(r) {
    if (r.tipo === "pre_preparo") {
      const f = base.fichas.find((x) => x.id === r.id);
      const un = String(r.unidade || f?.rendimento_unidade || "un").toLowerCase();
      setForm((x) => ({ ...x, itens: [...x.itens, { key: novaChave(), subficha_id: r.id, insumo_id: null, qtd: "", un: unidadesCompativeis(un)[0] }] }));
    } else {
      const un = r.unidade || base.insumos.get(r.id)?.unidade_medida;
      setForm((x) => ({ ...x, itens: [...x.itens, { key: novaChave(), insumo_id: r.id, subficha_id: null, qtd: "", un: unidadesCompativeis(un)[0], fator_correcao: 0 }] }));
    }
    setPainel(null);
  }
  const embalagensCadastradas = (base.insumosLista || []).filter((i) => ehEmbalagem(i) && i.ativo !== false && !form.embalagens.some((e) => e.insumo_id === i.id))
    .sort((a, b) => String(a.nome).localeCompare(String(b.nome), "pt-BR"));
  function adicionarEmbalagem(id) {
    setForm((x) => ({ ...x, embalagens: [...x.embalagens, { key: novaChave(), insumo_id: id, qtd: "1", tipo: tipoEmb }] }));
    setPainel(null);
  }
  const mudarItem = (key, campos) => setForm((x) => ({ ...x, itens: x.itens.map((i) => (i.key === key ? { ...i, ...campos } : i)) }));
  const mudarEmb = (key, campos) => setForm((x) => ({ ...x, embalagens: x.embalagens.map((i) => (i.key === key ? { ...i, ...campos } : i)) }));

  async function enviarFoto(arquivo) {
    if (!arquivo) return;
    setEnviandoFoto(true);
    try {
      const { url, error } = await uploadFotoMontagem(arquivo, form.nome || "marmita");
      if (error) setErros([`Foto não enviada: ${error}`]); else set("foto", url);
    } finally { setEnviandoFoto(false); }
  }

  async function salvar() {
    if (salvando) return;
    const { payload, erros: e } = payloadDoForm(form, ctx, unidadeId);
    if (e.length) { setErros(e); return; }
    setErros([]);
    setSalvando(true);
    try {
      const r = await salvarMarmita(payload);
      if (r.error) { setErros([r.error]); return; }
      apagarRascunho(chaveRascunhoFicha(unidadeId));
      setForm((f) => ({ ...f, novo: false, codigo: r.data?.codigo || f.codigo }));
      await recarregar();
      onSalvo?.(r.data);
    } catch (err) {
      setErros([err?.message || "Erro inesperado ao salvar. Seus dados continuam na tela."]);
    } finally {
      setSalvando(false);
    }
  }

  // Lista para montar com um toque (como o orçamento rápido de eventos).
  const catalogo = useMemo(() => catalogoDePrePreparos(base.prePreparos, base.fichas, custoDeProduzirFicha), [base]);
  const [verLista, setVerLista] = useState(!form.itens.length);
  const [grupoSel, setGrupoSel] = useState("");
  const [buscaPrep, setBuscaPrep] = useState("");
  const escolhidos = new Set(form.itens.map((i) => i.subficha_id).filter(Boolean));
  async function excluirPrep(it) {
    const usam = base.marmitas.filter((m) => (m.itens || []).some((x) => x.subficha_id === it.id)).map((m) => m.nome_receita);
    const aqui = form.itens.some((x) => x.subficha_id === it.id);
    const aviso = usam.length || aqui
      ? `"${it.nome}" está em ${[...usam, ...(aqui && !usam.length ? ["esta marmita"] : [])].join(", ")}. Ele sai da lista para novas marmitas, mas continua nas que já usam, com o mesmo custo. Excluir mesmo?`
      : `Excluir "${it.nome}" da lista de pré-preparos?`;
    if (!window.confirm(aviso)) return;
    const r = await arquivarPrePreparo(it.id);
    if (r.error) { setAvisoPrep({ tipo: "alerta", texto: r.error }); return; }
    await recarregar();
    setAvisoPrep({ tipo: "info", texto: `"${it.nome}" foi excluído da lista. O histórico continua guardado.` });
  }

  const alternarPrep = (it) => {
    if (escolhidos.has(it.id)) setForm((x) => ({ ...x, itens: x.itens.filter((i) => i.subficha_id !== it.id) }));
    else adicionarItem({ tipo: "pre_preparo", id: it.id, unidade: it.unidade });
  };
  const linhaCusto = (item) => custo.linhas.find((l) => (item.subficha_id ? l.subficha_id === item.subficha_id : l.insumo_id === item.insumo_id));

  return (
    <div className="space-y-4">
      {recuperado && <Aviso>Recuperei a ficha que você estava montando antes da tela recarregar. Confira e toque em Salvar ficha técnica.</Aviso>}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button type="button" onClick={onFechar} className="inline-flex min-h-[44px] items-center gap-2 rounded-xl px-2 text-sm font-semibold text-hf-text-2 hover:bg-hf-elevated">
          <ArrowLeft size={16} /> Voltar para a ficha técnica
        </button>
        <p className="text-sm text-hf-muted">{form.codigo ? `Código ${form.codigo}` : "Nova ficha técnica"}</p>
      </div>

      {/* A — dados básicos */}
      <Secao titulo="Dados básicos">
        <div className="grid gap-3 sm:grid-cols-[1fr_160px]">
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo rotulo="Nome" className="sm:col-span-2"><input className={inputCls} value={form.nome} onChange={(e) => set("nome", e.target.value)} placeholder="Ex.: Frango grelhado com arroz e feijão" /></Campo>
            <Campo rotulo="Descrição para o cardápio" className="sm:col-span-2"><textarea className={`${inputCls} min-h-[72px] py-2`} value={form.descricao} onChange={(e) => set("descricao", e.target.value)} /></Campo>
            <div className="sm:col-span-2">
              <span className="mb-1 block text-xs font-semibold text-hf-text-2">Categoria</span>
              <div className="flex flex-wrap gap-1.5">
                {ordenarCategorias([...CATEGORIAS_FICHA, ...base.marmitas.map((m) => m.categoria).filter(Boolean)]).map((c) => (
                  <button key={c} type="button" onClick={() => set("categoria", c)} aria-pressed={form.categoria === c}
                    className={`min-h-[40px] rounded-full border px-3 text-sm font-semibold ${form.categoria === c ? "border-hf-accent bg-hf-accent text-hf-accent-fg" : "border-hf-border bg-hf-surface text-hf-text-2"}`}>{c}</button>
                ))}
              </div>
              <input className={`${inputCls} mt-2`} value={form.categoria} onChange={(e) => set("categoria", e.target.value)} placeholder="Ou digite outra categoria" aria-label="Categoria" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Campo rotulo="Tamanho"><select className={inputCls} value={form.tamanho} onChange={(e) => set("tamanho", e.target.value)}>{TAMANHOS.map((t) => <option key={t}>{t}</option>)}</select></Campo>
              <Campo rotulo="Porção (g)"><CampoNumero valor={form.peso} onChange={(v) => set("peso", v)} placeholder="Ex.: 550" /></Campo>
            </div>
            <label className="flex min-h-[44px] items-center gap-2 text-sm font-medium text-hf-text sm:col-span-2">
              <input type="checkbox" className="h-5 w-5 accent-[rgb(var(--hf-accent))]" checked={form.ativo} onChange={(e) => set("ativo", e.target.checked)} />
              Disponível no cardápio
            </label>
          </div>
          <div>
            <span className="mb-1 block text-xs font-semibold text-hf-text-2">Foto</span>
            <button type="button" onClick={() => fotoRef.current?.click()} className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-xl border border-dashed border-hf-border-strong bg-hf-elevated/50 text-hf-muted hover:border-hf-accent">
              {form.foto ? <img src={form.foto} alt="Foto da marmita" className="h-full w-full object-cover" /> : <span className="flex flex-col items-center gap-1 text-xs"><ImagePlus size={22} />{enviandoFoto ? "Enviando…" : "Adicionar foto"}</span>}
            </button>
            <input ref={fotoRef} type="file" accept="image/*" className="hidden" onChange={(e) => enviarFoto(e.target.files?.[0])} />
            {form.foto && <button type="button" onClick={() => set("foto", "")} className="mt-1 text-xs font-semibold text-hf-muted hover:text-hf-danger">Remover foto</button>}
          </div>
        </div>
      </Secao>

      {/* B — ingredientes e pré-preparos */}
      {/* dono 17/11: pré-preparo ou produto, é tudo ingrediente; um total só */}
      <Secao titulo="Ingredientes" subtitulo="Produtos e pré-preparos da marmitaria."
        direita={<p className="text-sm text-hf-text-2">Total <b className="tabular-nums">{brl(custo.alimentos + custo.prePreparos)}</b></p>}>
        {form.itens.length > 0 && (
          <ul className="divide-y divide-hf-border">
            {form.itens.map((it) => {
              const nome = it.subficha_id ? base.fichas.find((f) => f.id === it.subficha_id)?.nome_receita : base.insumos.get(it.insumo_id)?.nome;
              const l = linhaCusto(it);
              const unCad = unidadeDoItem(it, ctx);
              return (
                <li key={it.key} className="grid grid-cols-[1fr_auto] gap-2 py-2 sm:grid-cols-[1fr_110px_90px_110px_44px] sm:items-center">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-hf-text">{nome || "Item removido do cadastro"}</p>
                    <p className="text-xs text-hf-muted">{it.subficha_id ? "Pré-preparo" : "Ingrediente"}{it.fator_correcao > 0 ? ` · FC +${pctTxt(it.fator_correcao, 0)}` : ""}</p>
                  </div>
                  <button type="button" aria-label="Remover" onClick={() => setForm((x) => ({ ...x, itens: x.itens.filter((i) => i.key !== it.key) }))} className="flex h-11 w-11 items-center justify-center rounded-lg text-hf-muted hover:bg-hf-elevated sm:order-last"><Trash2 size={16} /></button>
                  <CampoNumero valor={it.qtd} onChange={(v) => mudarItem(it.key, { qtd: v })} placeholder="Qtd." aria-label={`Quantidade de ${nome}`} />
                  <select className={inputCls} value={it.un} onChange={(e) => mudarItem(it.key, { un: e.target.value })} aria-label="Unidade">
                    {unidadesCompativeis(unCad, it.insumo_id ? pesosDoInsumo(base.insumos.get(it.insumo_id) || {}) : null).map((u) => <option key={u} value={u}>{u === "l" ? "L" : u === "porcao" ? "porção" : u}</option>)}
                  </select>
                  <p className="text-right text-sm font-bold tabular-nums text-hf-text">{l?.custo === null || l === undefined ? "—" : brl(l.custo)}</p>
                  <div className="col-span-2 flex flex-wrap gap-1.5 sm:col-span-5">
                    {atalhosDeQuantidade(it.un).map((q) => (
                      <button key={q} type="button" onClick={() => mudarItem(it.key, { qtd: String(q).replace(".", ",") })}
                        className={`h-8 rounded-full border px-3 text-xs font-bold ${parseNumero(it.qtd) === q ? "border-hf-accent bg-hf-accent text-hf-accent-fg" : "border-hf-border bg-hf-surface text-hf-text-2"}`}>
                        {String(q).replace(".", ",")} {it.un === "l" ? "L" : it.un}
                      </button>
                    ))}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <div className="mt-3 space-y-3">
          {verLista && (
            <div className="rounded-xl border border-hf-border">
              {catalogo.length > 1 && (
                <div className="flex flex-wrap gap-1.5 border-b border-hf-border p-2">
                  {["", ...catalogo.map((g) => g.grupo)].map((g) => (
                    <button key={g || "todos"} type="button" onClick={() => setGrupoSel(g)} aria-pressed={grupoSel === g}
                      className={`h-8 shrink-0 rounded-full border px-3 text-xs font-bold ${grupoSel === g ? "border-hf-accent bg-hf-accent text-hf-accent-fg" : "border-hf-border bg-hf-surface text-hf-text-2"}`}>{g || "Todos"}</button>
                  ))}
                </div>
              )}
              <div className="border-b border-hf-border p-2">
                <input className={inputCls} value={buscaPrep} onChange={(e) => setBuscaPrep(e.target.value)} placeholder="Buscar pré-preparo (ex.: feijão, frango)" aria-label="Buscar pré-preparo" />
              </div>
              <div className="space-y-2 p-2">
                {!catalogo.length && <p className="p-2 text-sm text-hf-muted">Nenhum pré-preparo cadastrado ainda.</p>}
                {catalogo.filter((g) => !grupoSel || g.grupo === grupoSel)
                  .map((g) => ({ ...g, itens: g.itens.filter((it) => !buscaPrep.trim() || normalizarBusca(it.nome).includes(normalizarBusca(buscaPrep))) }))
                  .filter((g) => g.itens.length).map((g) => (
                  <div key={g.grupo}>
                    <p className="px-1 pb-1 text-[11px] font-black uppercase tracking-wide text-hf-muted">{g.grupo}</p>
                    <div className="grid gap-1.5 sm:grid-cols-2">
                      {g.itens.map((it) => {
                        const sel = escolhidos.has(it.id);
                        const unTxt = it.unidade === "l" ? "L" : it.unidade;
                        return (
                          <div key={it.id} className={`flex min-h-[48px] items-stretch rounded-xl border ${sel ? "border-hf-accent bg-hf-accent/5" : "border-hf-border bg-hf-surface"}`}>
                            <button type="button" onClick={() => alternarPrep(it)} aria-pressed={sel} className="flex min-w-0 flex-1 items-center gap-2 px-3 text-left">
                              <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-md border ${sel ? "border-hf-accent bg-hf-accent text-hf-accent-fg" : "border-hf-border-strong text-transparent"}`}><Check size={14} /></span>
                              <span className="min-w-0">
                                <span className="block truncate text-sm font-semibold text-hf-text">{it.nome}</span>
                                <span className={`block text-xs ${it.custoPorUnidade ? "text-hf-muted" : "font-semibold text-hf-warning"}`}>{it.custoPorUnidade ? `${brl(it.custoPorUnidade)}/${unTxt}` : "sem custo: DADOS INSUFICIENTES"}</span>
                              </span>
                            </button>
                            <button type="button" aria-label={`Editar ${it.nome}`} onClick={() => { setPrepEditando(base.fichas.find((x) => x.id === it.id) || null); setVerLista(false); setPainel("editar-prep"); setAvisoPrep(null); }}
                              className="grid w-11 shrink-0 place-items-center text-hf-muted hover:text-hf-text"><Pencil size={16} /></button>
                            <button type="button" aria-label={`Excluir ${it.nome}`} onClick={() => excluirPrep(it)}
                              className="grid w-11 shrink-0 place-items-center text-hf-muted hover:text-hf-danger"><Trash2 size={16} /></button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-2 border-t border-hf-border p-2">
                <Botao variante="secundario" type="button" onClick={() => { setTextoNovo(buscaPrep); setVerLista(false); setPainel("novo-prep"); }}>+ Criar novo pré-preparo</Botao>
                <Botao variante="texto" type="button" onClick={() => setVerLista(false)}>Fechar a lista</Botao>
              </div>
            </div>
          )}
          {painel === "busca-item" && (
            // "+ Ingrediente" (dono, 17/11/2026): só ingredientes; pré-preparo tem o próprio botão
            <BuscaItens base={base} modo="ingrediente" semPrePreparos excluir={form.itens.map((i) => i.insumo_id || i.subficha_id)} onEscolher={adicionarItem}
              onCriarIngrediente={(t) => { setTextoNovo(t); setPainel("novo-prod"); }} />
          )}
          {painel === "novo-prod" && (
            <NovoProduto unidadeId={unidadeId} nomeInicial={textoNovo} onFechar={() => setPainel(null)}
              onCriado={async (id, unidade) => { await recarregar(); if (id) adicionarItem({ tipo: "ingrediente", id, unidade }); else setPainel(null); }} />
          )}
          {avisoPrep && <Aviso tipo={avisoPrep.tipo}>{avisoPrep.texto}</Aviso>}
          {painel === "editar-prep" && prepEditando && (
            <NovoPrePreparo key={prepEditando.id} unidadeId={unidadeId} base={base} ficha={prepEditando} onFechar={() => { setPainel(null); setPrepEditando(null); }}
              onCriado={async () => { await recarregar(); setPainel(null); setPrepEditando(null); setAvisoPrep({ tipo: "info", texto: "Pré-preparo atualizado. O custo das marmitas que usam ele já mudou." }); }} />
          )}
          {painel === "novo-prep" && (
            <NovoPrePreparo unidadeId={unidadeId} base={base} nomeInicial={textoNovo} onFechar={() => setPainel(null)}
              onCriado={async (id, unidade) => { await recarregar(); adicionarItem({ tipo: "pre_preparo", id, unidade }); }} />
          )}
          {/* dois botões sempre embaixo da lista (dono, 17/11/2026) */}
          {painel !== "novo-prod" && painel !== "novo-prep" && painel !== "editar-prep" && (
            <div className="grid grid-cols-2 gap-2 sm:flex">
              <Botao variante={painel === "busca-item" ? "primario" : "secundario"} type="button"
                onClick={() => { setVerLista(false); setPainel(painel === "busca-item" ? null : "busca-item"); }}>+ Ingrediente</Botao>
              <Botao variante={verLista ? "primario" : "secundario"} type="button"
                onClick={() => { setPainel(null); setVerLista((v) => !v); }}>+ Pré-preparo{catalogo.length ? ` (${catalogo.reduce((t, g) => t + g.itens.length, 0)})` : ""}</Botao>
            </div>
          )}
        </div>
      </Secao>

      {/* C — embalagens */}
      <Secao titulo="Embalagens" direita={<p className="text-sm text-hf-text-2">Total <b className="tabular-nums">{brl(custo.embalagens)}</b> por unidade</p>}>
        {form.embalagens.length > 0 && (
          <ul className="mb-3 divide-y divide-hf-border">
            {form.embalagens.map((e) => {
              const ins = base.insumos.get(e.insumo_id);
              const unit = ins ? custoUnitarioEfetivoInsumo(ins) : null;
              return (
                <li key={e.key} className="grid grid-cols-[1fr_80px_100px_44px] items-center gap-2 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-hf-text">{ins?.nome || "Embalagem removida"}</p>
                    <p className="text-xs text-hf-muted">{unit ? `${brl(unit)} por unidade` : "sem custo"}</p>
                  </div>
                  <CampoNumero valor={e.qtd} onChange={(v) => mudarEmb(e.key, { qtd: v })} aria-label="Quantidade" />
                  <p className="text-right text-sm font-bold tabular-nums">{unit ? brl(unit * parseNumero(e.qtd)) : "—"}</p>
                  <button type="button" aria-label="Remover" onClick={() => setForm((x) => ({ ...x, embalagens: x.embalagens.filter((i) => i.key !== e.key) }))} className="flex h-11 w-11 items-center justify-center rounded-lg text-hf-muted hover:bg-hf-elevated"><Trash2 size={16} /></button>
                </li>
              );
            })}
          </ul>
        )}
        {/* dono 17/11: aparecem as embalagens que ele cadastrou, não tipos genéricos */}
        <div className="flex flex-wrap gap-2">
          {embalagensCadastradas.map((i) => (
            <button key={i.id} type="button" onClick={() => adicionarEmbalagem(i.id)}
              className="min-h-[40px] max-w-full truncate rounded-full border border-hf-border px-3 text-sm font-semibold text-hf-text-2 hover:border-hf-accent">
              + {i.nome}
            </button>
          ))}
          <button type="button" onClick={() => { setTextoNovo(""); setPainel("nova-emb"); }}
            className="min-h-[40px] rounded-full border border-dashed border-hf-accent/60 px-3 text-sm font-semibold text-hf-text hover:border-hf-accent">
            + Nova embalagem
          </button>
        </div>
        {!embalagensCadastradas.length && !form.embalagens.length && <p className="mt-2 text-xs text-hf-muted">Nenhuma embalagem cadastrada ainda. Toque em "+ Nova embalagem".</p>}
        {painel === "busca-emb" && (
          <div className="mt-3">
            <BuscaItens key={tipoEmb} base={base} modo="embalagem" filtroInicial={tipoEmb === "outra" ? "" : tipoEmb === "marmitex" ? "" : tipoEmb}
              onEscolher={(r) => adicionarEmbalagem(r.id)} onCriarEmbalagem={(t) => { setTextoNovo(t || TIPOS_EMBALAGEM.find((x) => x.id === tipoEmb)?.rotulo || ""); setPainel("nova-emb"); }} />
          </div>
        )}
        {painel === "nova-emb" && (
          <div className="mt-3">
            <NovoProduto unidadeId={unidadeId} embalagem nomeInicial={textoNovo} onFechar={() => setPainel(null)}
              onCriado={async (id) => { await recarregar(); if (id) adicionarEmbalagem(id); else setPainel(null); }} />
          </div>
        )}
      </Secao>

      <Secao titulo="Custo" subtitulo="Comida e embalagem. O preço, as taxas e o lucro ficam no Cardápio.">
        <div className="grid gap-3 sm:grid-cols-3">
          <Resumo rotulo="Ingredientes" valor={custo.alimentos + custo.prePreparos} />
          <Resumo rotulo="Embalagens" valor={custo.embalagens} />
          <Resumo rotulo="Custo total" valor={custo.total} forte />
        </div>
        {custo.pendencias.length > 0 && <Aviso tipo="alerta" className="mt-3">Custo incompleto: {custo.pendencias.join(" ")}</Aviso>}
      </Secao>

      {erros.length > 0 && (
        <Aviso tipo="alerta"><p className="font-semibold">Não foi possível salvar:</p><ul className="ml-4 list-disc">{erros.map((e) => <li key={e}>{e}</li>)}</ul></Aviso>
      )}
      <div className="sticky bottom-3 z-10 flex justify-end gap-2 rounded-2xl border border-hf-border bg-hf-surface/95 p-2 backdrop-blur">
        <Botao variante="secundario" type="button" onClick={onFechar}>Cancelar</Botao>
        <Botao type="button" onClick={salvar} disabled={salvando} className="min-w-[160px]">{salvando ? "Salvando…" : "Salvar ficha técnica"}</Botao>
      </div>
    </div>
  );
}

function Resumo({ rotulo, valor, forte }) {
  return (
    <div className={`rounded-xl p-3 ${forte ? "bg-hf-accent/10" : "bg-hf-elevated/60"}`}>
      <p className="text-xs font-semibold text-hf-text-2">{rotulo}</p>
      <p className={`mt-1 tabular-nums ${forte ? "text-xl font-black text-hf-accent" : "text-lg font-bold text-hf-text"}`}>{brl(valor)}</p>
    </div>
  );
}

