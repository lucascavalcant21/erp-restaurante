"use client";

// Cadastro da marmita numa tela só, em quatro seções:
//   A dados básicos · B ingredientes e pré-preparos · C embalagens · D preço e resultado
// O custo e a margem são recalculados a cada tecla. Salvar nunca fica preso
// em "Salvando…" (finally) e, se der erro, o que foi digitado continua aqui.

import { useMemo, useRef, useState } from "react";
import { ArrowLeft, Check, ImagePlus, Trash2 } from "lucide-react";
import { useMarmitaria } from "./contexto";
import BuscaItens from "./BuscaItens";
import { NovoProduto, NovoPrePreparo } from "./CadastrosRapidos";
import { Aviso, Botao, Campo, CampoNumero, Secao, Selo, brl, inputCls, pctTxt } from "./ui";
import { salvarMarmita, novaChave } from "../../lib/marmitaria/dados";
import { atalhosDeQuantidade, catalogoDePrePreparos, custoDoForm, payloadDoForm, TAMANHOS, TIPOS_EMBALAGEM, unidadeDoItem } from "../../lib/marmitaria/formulario.mjs";
import { precoSugerido, resultadoPorCanal, unidadesCompativeis } from "../../lib/marmitaria/nucleo.mjs";
import { CANAL_DIRETO } from "../../lib/marmitaria/promocoes.mjs";
import { normalizarBusca } from "../../lib/ingredientes-utils.mjs";
import { custoDeProduzirFicha, custoUnitarioEfetivoInsumo, parseNumero } from "../../lib/ficha-calculos.mjs";
import { uploadFotoMontagem } from "../../lib/montagem";

export default function EditorMarmita({ form: formInicial, onFechar, onSalvo }) {
  const { base, unidadeId, recarregar } = useMarmitaria();
  const [form, setForm] = useState(formInicial);
  const [painel, setPainel] = useState(null); // busca-item | busca-emb | novo-ing | novo-prep | nova-emb
  const [textoNovo, setTextoNovo] = useState("");
  const [tipoEmb, setTipoEmb] = useState("marmitex");
  const [salvando, setSalvando] = useState(false);
  const [erros, setErros] = useState([]);
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  const fotoRef = useRef(null);
  const ctx = { insumos: base.insumos, fichas: base.fichas };

  const set = (campo, valor) => setForm((f) => ({ ...f, [campo]: valor }));
  const custo = useMemo(() => custoDoForm(form, ctx), [form, base]); // eslint-disable-line react-hooks/exhaustive-deps
  // Sem canal configurado, a margem sai pela venda direta (sem comissão).
  const canaisAtivos = base.config.canais.filter((c) => c.ativo);
  const canais = canaisAtivos.length ? canaisAtivos : [CANAL_DIRETO];
  const tributos = base.config.tributos_pct;
  const margemAlvo = base.config.margem_alvo_pct;

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
  const alternarPrep = (it) => {
    if (escolhidos.has(it.id)) setForm((x) => ({ ...x, itens: x.itens.filter((i) => i.subficha_id !== it.id) }));
    else adicionarItem({ tipo: "pre_preparo", id: it.id, unidade: it.unidade });
  };
  const preco = parseNumero(form.preco);
  const linhaCusto = (item) => custo.linhas.find((l) => (item.subficha_id ? l.subficha_id === item.subficha_id : l.insumo_id === item.insumo_id));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button type="button" onClick={onFechar} className="inline-flex min-h-[44px] items-center gap-2 rounded-xl px-2 text-sm font-semibold text-hf-text-2 hover:bg-hf-elevated">
          <ArrowLeft size={16} /> Voltar para as marmitas
        </button>
        <p className="text-sm text-hf-muted">{form.codigo ? `Código ${form.codigo}` : "Nova marmita"}</p>
      </div>

      {/* A — dados básicos */}
      <Secao titulo="A · Dados básicos">
        <div className="grid gap-3 sm:grid-cols-[1fr_160px]">
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo rotulo="Nome da marmita" className="sm:col-span-2"><input className={inputCls} value={form.nome} onChange={(e) => set("nome", e.target.value)} placeholder="Ex.: Frango grelhado com arroz e feijão" /></Campo>
            <Campo rotulo="Descrição para o cardápio" className="sm:col-span-2"><textarea className={`${inputCls} min-h-[72px] py-2`} value={form.descricao} onChange={(e) => set("descricao", e.target.value)} /></Campo>
            <Campo rotulo="Categoria"><input className={inputCls} value={form.categoria} onChange={(e) => set("categoria", e.target.value)} placeholder="Ex.: Tradicional, Fit" list="categorias-marmita" /></Campo>
            <datalist id="categorias-marmita">{[...new Set(base.marmitas.map((m) => m.categoria).filter(Boolean))].map((c) => <option key={c} value={c} />)}</datalist>
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
      <Secao titulo="B · Ingredientes e pré-preparos" subtitulo="Os mesmos do estoque e das fichas do restaurante: nada é duplicado."
        direita={<p className="text-sm text-hf-text-2">Alimentos <b className="tabular-nums">{brl(custo.alimentos)}</b> · Pré-preparos <b className="tabular-nums">{brl(custo.prePreparos)}</b></p>}>
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
                    {unidadesCompativeis(unCad).map((u) => <option key={u} value={u}>{u === "l" ? "L" : u}</option>)}
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
          <button type="button" onClick={() => setVerLista((v) => !v)} aria-expanded={verLista}
            className="inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-hf-border bg-hf-surface px-3 text-sm font-bold text-hf-text">
            {verLista ? "Esconder a lista de pré-preparos" : `Escolher da lista (${catalogo.reduce((t, g) => t + g.itens.length, 0)} pré-preparos)`}
          </button>
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
                {!catalogo.length && <p className="p-2 text-sm text-hf-muted">Nenhum pré-preparo cadastrado. Use a busca para ingredientes ou crie um pré-preparo.</p>}
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
                          <button key={it.id} type="button" onClick={() => alternarPrep(it)} aria-pressed={sel}
                            className={`flex min-h-[48px] items-center gap-2 rounded-xl border px-3 text-left ${sel ? "border-hf-accent bg-hf-accent/5" : "border-hf-border bg-hf-surface hover:bg-hf-elevated"}`}>
                            <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-md border ${sel ? "border-hf-accent bg-hf-accent text-hf-accent-fg" : "border-hf-border-strong text-transparent"}`}><Check size={14} /></span>
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-semibold text-hf-text">{it.nome}</span>
                              <span className={`block text-xs ${it.custoPorUnidade ? "text-hf-muted" : "font-semibold text-hf-warning"}`}>{it.custoPorUnidade ? `${brl(it.custoPorUnidade)}/${unTxt}` : "sem custo: DADOS INSUFICIENTES"}</span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {painel === "busca-item" && (
            <BuscaItens base={base} excluir={form.itens.map((i) => i.insumo_id || i.subficha_id)} onEscolher={adicionarItem}
              onCriarIngrediente={(t) => { setTextoNovo(t); setPainel("novo-ing"); }}
              onCriarPrePreparo={(t) => { setTextoNovo(t); setPainel("novo-prep"); }} />
          )}
          {painel === "novo-ing" && (
            <NovoProduto unidadeId={unidadeId} nomeInicial={textoNovo} onFechar={() => setPainel(null)}
              onCriado={async (id, unidade) => { await recarregar(); if (id) adicionarItem({ tipo: "ingrediente", id, unidade }); else setPainel(null); }} />
          )}
          {painel === "novo-prep" && (
            <NovoPrePreparo unidadeId={unidadeId} base={base} nomeInicial={textoNovo} onFechar={() => setPainel(null)}
              onCriado={async (id, unidade) => { await recarregar(); adicionarItem({ tipo: "pre_preparo", id, unidade }); }} />
          )}
          {painel !== "busca-item" && painel !== "novo-ing" && painel !== "novo-prep" && (
            <Botao variante="secundario" type="button" onClick={() => setPainel("busca-item")}>+ Adicionar ingrediente ou pré-preparo</Botao>
          )}
        </div>
      </Secao>

      {/* C — embalagens */}
      <Secao titulo="C · Embalagens" direita={<p className="text-sm text-hf-text-2">Total <b className="tabular-nums">{brl(custo.embalagens)}</b> por marmita</p>}>
        {form.embalagens.length > 0 && (
          <ul className="mb-3 divide-y divide-hf-border">
            {form.embalagens.map((e) => {
              const ins = base.insumos.get(e.insumo_id);
              const unit = ins ? custoUnitarioEfetivoInsumo(ins) : null;
              return (
                <li key={e.key} className="grid grid-cols-[1fr_80px_100px_44px] items-center gap-2 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-hf-text">{ins?.nome || "Embalagem removida"}</p>
                    <p className="text-xs text-hf-muted">{TIPOS_EMBALAGEM.find((t) => t.id === e.tipo)?.rotulo || "Embalagem"} · {unit ? `${brl(unit)}/un` : "sem custo"}</p>
                  </div>
                  <CampoNumero valor={e.qtd} onChange={(v) => mudarEmb(e.key, { qtd: v })} aria-label="Quantidade" />
                  <p className="text-right text-sm font-bold tabular-nums">{unit ? brl(unit * parseNumero(e.qtd)) : "—"}</p>
                  <button type="button" aria-label="Remover" onClick={() => setForm((x) => ({ ...x, embalagens: x.embalagens.filter((i) => i.key !== e.key) }))} className="flex h-11 w-11 items-center justify-center rounded-lg text-hf-muted hover:bg-hf-elevated"><Trash2 size={16} /></button>
                </li>
              );
            })}
          </ul>
        )}
        <div className="flex flex-wrap gap-2">
          {TIPOS_EMBALAGEM.map((t) => (
            <button key={t.id} type="button" onClick={() => { setTipoEmb(t.id); setPainel("busca-emb"); }}
              className={`min-h-[40px] rounded-full border px-3 text-sm font-semibold ${painel === "busca-emb" && tipoEmb === t.id ? "border-hf-accent bg-hf-accent/10 text-hf-accent" : "border-hf-border text-hf-text-2 hover:border-hf-accent"}`}>
              + {t.rotulo}
            </button>
          ))}
        </div>
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

      {/* D — preço e resultado */}
      <Secao titulo="D · Preço e resultado" subtitulo="Margem de contribuição não é lucro: ainda faltam mão de obra e despesas fixas (veja o Financeiro).">
        <div className="grid gap-3 sm:grid-cols-4">
          <Resumo rotulo="Alimentos" valor={custo.alimentos} />
          <Resumo rotulo="Pré-preparos" valor={custo.prePreparos} />
          <Resumo rotulo="Embalagens" valor={custo.embalagens} />
          <Resumo rotulo="Custo técnico total" valor={custo.total} forte />
        </div>
        {custo.pendencias.length > 0 && <Aviso tipo="alerta" className="mt-3">Custo incompleto: {custo.pendencias.join(" ")}</Aviso>}

        <div className="mt-4 grid gap-3 sm:grid-cols-[220px_1fr]">
          <Campo rotulo="Preço de referência (balcão/cardápio)" dica="Usado nos canais sem preço próprio.">
            <CampoNumero valor={form.preco} onChange={(v) => set("preco", v)} placeholder="0,00" />
          </Campo>
          {tributos === null
            ? <Aviso tipo="alerta">Impostos em branco: preencha em <a href="/dashboard/financeiro/resultado" className="font-bold underline">Financeiro → Resultado do mês</a> (ou em Configurações, só para a marmitaria) para a margem descontar o imposto.</Aviso>
            : <p className="self-center text-xs text-hf-muted">Impostos de {pctTxt(tributos)}{base.config.doResultado?.tributos_pct ? " (do Resultado do mês)" : ""}. {canaisAtivos.length ? "" : "Sem canal configurado: a tabela mostra a venda direta, sem comissão."} Promoções e combos: aba <b>Combos e promoções</b>.</p>}
        </div>

        {false ? null : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-hf-muted">
                  <th className="py-2 pr-2">Canal</th><th className="py-2 pr-2">Preço</th><th className="py-2 pr-2 text-right">Tributos</th><th className="py-2 pr-2 text-right">Taxas do canal</th>
                  <th className="py-2 pr-2 text-right">Margem de contribuição</th><th className="py-2 pr-2 text-right">CMV técnico</th><th className="py-2 text-right">Markup</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hf-border">
                {canais.map((c) => {
                  const proprio = form.precos[c.id];
                  const p = String(proprio ?? "").trim() ? parseNumero(proprio) : preco;
                  const r = resultadoPorCanal({ preco: p, custoTecnico: custo.total, canal: c, tributosPct: tributos });
                  const sug = precoSugerido({ custoTecnico: custo.total, canal: c, tributosPct: tributos, margemAlvoPct: margemAlvo });
                  return (
                    <tr key={c.id} className="align-top">
                      <td className="py-2 pr-2"><p className="font-semibold text-hf-text">{c.nome}</p>{c.modalidade && <p className="text-xs text-hf-muted">{c.modalidade}</p>}</td>
                      <td className="py-2 pr-2 w-[150px]">
                        <CampoNumero valor={proprio ?? ""} onChange={(v) => setForm((x) => ({ ...x, precos: { ...x.precos, [c.id]: v } }))} placeholder={form.preco ? String(form.preco) : "0,00"} />
                        {sug.preco !== null ? (
                          <button type="button" onClick={() => setForm((x) => ({ ...x, precos: { ...x.precos, [c.id]: String(sug.preco).replace(".", ",") } }))} className="mt-1 text-xs font-semibold text-hf-accent hover:underline">
                            Sugerido p/ {pctTxt(margemAlvo, 0)}: {brl(sug.preco)}
                          </button>
                        ) : <p className="mt-1 text-[11px] text-hf-muted">{sug.motivo}</p>}
                      </td>
                      <td className="py-2 pr-2 text-right tabular-nums">{r.valido ? brl(r.tributos) : "—"}</td>
                      <td className="py-2 pr-2 text-right tabular-nums">{r.valido ? brl(r.variaveis) : "—"}</td>
                      <td className={`py-2 pr-2 text-right font-bold tabular-nums ${r.margemContribuicao < 0 ? "text-hf-danger" : "text-hf-text"}`}>
                        {r.valido && r.margemContribuicao !== null ? <>{brl(r.margemContribuicao)}<br /><span className="text-xs font-semibold">{pctTxt(r.margemContribuicaoPct)}</span></> : "—"}
                      </td>
                      <td className="py-2 pr-2 text-right tabular-nums">{r.valido ? pctTxt(r.cmvTecnicoPct) : "—"}</td>
                      <td className="py-2 text-right tabular-nums">{r.valido && r.markup !== null ? `${r.markup.toLocaleString("pt-BR")}×` : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="mt-2 text-xs text-hf-muted">Margem = receita − tributos − taxas do canal − custo técnico, em % da receita. Markup = preço ÷ custo técnico. <Selo natureza="previsto" /></p>
          </div>
        )}
      </Secao>

      {erros.length > 0 && (
        <Aviso tipo="alerta"><p className="font-semibold">Não foi possível salvar:</p><ul className="ml-4 list-disc">{erros.map((e) => <li key={e}>{e}</li>)}</ul></Aviso>
      )}
      <div className="sticky bottom-3 z-10 flex justify-end gap-2 rounded-2xl border border-hf-border bg-hf-surface/95 p-2 backdrop-blur">
        <Botao variante="secundario" type="button" onClick={onFechar}>Cancelar</Botao>
        <Botao type="button" onClick={salvar} disabled={salvando} className="min-w-[160px]">{salvando ? "Salvando…" : "Salvar marmita"}</Botao>
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

