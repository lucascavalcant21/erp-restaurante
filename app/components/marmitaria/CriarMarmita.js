"use client";

// CRIAR MARMITA (pedido do dono, 08/11/2026): tudo de uma vez e rápido —
// proteína e quantidade, empanamento ligado ou não (com o custo dele), arroz,
// batata e o que mais for, embalagem, custo, preço sugerido, lucro, desconto e
// combos com bebida e sobremesa, descrição e foto. "Salvar e colocar no
// cardápio" grava a ficha técnica de cada versão com o preço da plataforma, o
// desconto e os combos, usando as peças que já existem. Contas em
// app/lib/marmitaria/montador.mjs.

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle2, CupSoda, IceCreamCone, ImagePlus, Loader2, Plus, Sparkles, Trash2, UtensilsCrossed } from "lucide-react";
import { useMarmitaria } from "./contexto";
import { useCardapio } from "./useCardapio";
import BuscaItens from "./BuscaItens";
import { NovoPrePreparo, NovoProduto } from "./CadastrosRapidos";
import { Aviso, Botao, Campo, CampoNumero, brl, inputCls, pctTxt } from "./ui";
import { salvarMarmita, novaChave } from "../../lib/marmitaria/dados";
import { salvarCombosMarmitaria, salvarOfertasMarmitaria } from "../../lib/parametros";
import { uploadFotoMontagem } from "../../lib/montagem";
import { unidadesCompativeis } from "../../lib/marmitaria/nucleo.mjs";
import { CATEGORIAS_FICHA, ordenarCategorias, rotuloDoLucro } from "../../lib/marmitaria/cardapio.mjs";
import { custoUnitarioEfetivoInsumo, pesosDoInsumo, parseNumero } from "../../lib/ficha-calculos.mjs";
import {
  TIPOS_COMBO, contaDaVersao, vereditoDaVersao, contaDoCombo, custoDosItens, errosDoMontador, montadorVazio, nomeEmpanado, novoItem, planoDeGravacao, versoesDoMontador,
} from "../../lib/marmitaria/montador.mjs";

const ATALHOS_G = [80, 100, 120, 150, 180, 200, 250];
const VEREDITO_COR = { ok: "bg-hf-success/10 text-hf-success", baixo: "bg-hf-warning/10 text-hf-warning", prejuizo: "bg-hf-danger/10 text-hf-danger", lucro: "bg-hf-elevated text-hf-text-2", sem_dados: "bg-hf-elevated text-hf-muted" };

function Etapa({ n, titulo, subtitulo, direita, children }) {
  return (
    <section className="rounded-2xl border border-hf-border bg-hf-surface p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_6px_18px_-8px_rgba(0,0,0,0.12)] sm:p-5">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-hf-accent text-sm font-bold text-white">{n}</span>
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-hf-text">{titulo}</h2>
            {subtitulo && <p className="text-xs text-hf-muted">{subtitulo}</p>}
          </div>
        </div>
        {direita}
      </div>
      {children}
    </section>
  );
}

export default function CriarMarmita() {
  const { base, unidadeId, recarregar } = useMarmitaria();
  const { canais, canal, setCanalId, embutidos, catalogo, combos: combosAtuais, ofertas: ofertasAtuais, setCombos, setOfertas, metaPct } = useCardapio();
  const [m, setM] = useState(montadorVazio);
  const [busca, setBusca] = useState(null); // proteina | empanamento | acompanhamento | embalagem | novo-prod | novo-prep | nova-emb
  const [destinoNovo, setDestinoNovo] = useState("acompanhamento");
  const [textoNovo, setTextoNovo] = useState("");
  const [erros, setErros] = useState([]);
  const [salvando, setSalvando] = useState(false);
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  const [pronto, setPronto] = useState(null);
  const fotoRef = useRef(null);
  const ctx = { insumos: base.insumos, fichas: base.fichas };
  const set = (campos) => setM((x) => ({ ...x, ...campos }));

  const lucroAlvoReais = Number(base.config.rateio?.meta_lucro_reais) > 0 ? base.config.rateio.meta_lucro_reais : null;
  const margemAlvoPct = metaPct === "" ? base.config.margem_alvo_pct : parseNumero(metaPct);
  const versoes = versoesDoMontador(m);
  const contas = useMemo(() => versoes.map((v) => contaDaVersao({ m, v, ctx, canal, tributosPct: base.config.tributos_pct, embutidos, margemAlvoPct, lucroAlvoReais })),
    [m, base, canal, embutidos, margemAlvoPct, lucroAlvoReais]); // eslint-disable-line react-hooks/exhaustive-deps
  const custoProteina = m.proteina ? custoDosItens([m.proteina], ctx).total : null;
  const custoEmpanamento = m.empanamento.length ? custoDosItens(m.empanamento, ctx).total : null;
  const rotuloLucro = rotuloDoLucro(embutidos);

  // ─── Itens ────────────────────────────────────────────────────────────────
  const nomeDoItem = (it) => (it.subficha_id ? base.fichas.find((f) => f.id === it.subficha_id)?.nome_receita : base.insumos.get(it.insumo_id)?.nome) || "Item fora do cadastro";
  const unidadeCadastro = (r) => (r.tipo === "pre_preparo"
    ? String(r.unidade || base.fichas.find((f) => f.id === r.id)?.rendimento_unidade || "un").toLowerCase()
    : String(r.unidade || base.insumos.get(r.id)?.unidade_medida || "un").toLowerCase());
  function itemDaBusca(r) {
    const un = unidadesCompativeis(unidadeCadastro(r))[0];
    return novoItem(r.tipo === "pre_preparo" ? { subficha_id: r.id, un } : { insumo_id: r.id, un });
  }
  function escolher(destino, r) {
    const it = itemDaBusca(r);
    if (destino === "proteina") set({ proteina: { ...it, qtd: it.un === "g" ? "150" : "" } });
    if (destino === "empanamento") setM((x) => ({ ...x, empanamento: [...x.empanamento, it] }));
    if (destino === "acompanhamento") setM((x) => ({ ...x, acompanhamentos: [...x.acompanhamentos, it] }));
    setBusca(null);
  }
  const mudar = (lista, key, campos) => setM((x) => ({ ...x, [lista]: x[lista].map((i) => (i.key === key ? { ...i, ...campos } : i)) }));
  const tirar = (lista, key) => setM((x) => ({ ...x, [lista]: x[lista].filter((i) => i.key !== key) }));

  // Funções de desenho (não componentes): assim o campo não perde o foco a cada tecla.
  function linhaItem({ it, onQtd, onUn, onTirar }) {
    const un = it.subficha_id ? String(base.fichas.find((f) => f.id === it.subficha_id)?.rendimento_unidade || "un").toLowerCase() : String(base.insumos.get(it.insumo_id)?.unidade_medida || "un").toLowerCase();
    const opcoes = unidadesCompativeis(un, it.insumo_id ? pesosDoInsumo(base.insumos.get(it.insumo_id) || {}) : null);
    const c = custoDosItens([it], ctx).total;
    return (
      <li key={it.key} className="py-2.5">
        <div className="grid grid-cols-[1fr_auto] items-center gap-2 sm:grid-cols-[1fr_96px_78px_88px_44px]">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-hf-text">{nomeDoItem(it)}</p>
            <p className="text-xs text-hf-muted">{it.subficha_id ? "Pré-preparo" : "Ingrediente"}</p>
          </div>
          <button type="button" aria-label="Remover" onClick={onTirar} className="flex h-11 w-11 items-center justify-center rounded-lg text-hf-muted hover:bg-hf-elevated sm:order-last"><Trash2 size={16} /></button>
          <CampoNumero valor={it.qtd} onChange={onQtd} placeholder="Qtd." aria-label={`Quantidade de ${nomeDoItem(it)}`} />
          <select className={inputCls} value={it.un} onChange={(e) => onUn(e.target.value)} aria-label="Unidade">
            {opcoes.map((u) => <option key={u} value={u}>{u === "l" ? "L" : u === "porcao" ? "porção" : u}</option>)}
          </select>
          <p className="text-right text-sm font-bold tabular-nums text-hf-text">{c > 0 ? brl(c) : "—"}</p>
        </div>
        {it.un === "g" && (
          <div className="mt-1.5 flex gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none]">
            {ATALHOS_G.map((q) => (
              <button key={q} type="button" onClick={() => onQtd(String(q))}
                className={`h-8 shrink-0 rounded-full border px-3 text-xs font-bold ${parseNumero(it.qtd) === q ? "border-hf-accent bg-hf-accent text-white" : "border-hf-border bg-hf-surface text-hf-text-2"}`}>{q} g</button>
            ))}
          </div>
        )}
      </li>
    );
  }

  const painelBusca = (destino) => (
    <div className="mt-2">
      <BuscaItens base={base} onEscolher={(r) => escolher(destino, r)}
        excluir={[m.proteina, ...m.empanamento, ...m.acompanhamentos].filter(Boolean).map((i) => i.insumo_id || i.subficha_id)}
        onCriarIngrediente={(t) => { setTextoNovo(t); setDestinoNovo(destino); setBusca("novo-prod"); }}
        onCriarPrePreparo={(t) => { setTextoNovo(t); setDestinoNovo(destino); setBusca("novo-prep"); }} />
      <button type="button" onClick={() => setBusca(null)} className="mt-1 min-h-[40px] text-sm font-semibold text-hf-muted">Fechar a busca</button>
    </div>
  );

  // ─── Foto e descrição ─────────────────────────────────────────────────────
  async function enviarFoto(arquivo) {
    if (!arquivo) return;
    setEnviandoFoto(true);
    try {
      const { url, error } = await uploadFotoMontagem(arquivo, m.nome || "marmita");
      if (error) setErros([`Foto não enviada: ${error}`]); else set({ foto: url });
    } finally { setEnviandoFoto(false); }
  }
  function descricaoAutomatica() {
    const parte = (it) => { const q = parseNumero(it.qtd); return `${nomeDoItem(it).toLowerCase()}${q > 0 ? ` (${String(it.qtd).replace(".", ",")} ${it.un === "l" ? "L" : it.un})` : ""}`; };
    const itens = [m.proteina, ...m.acompanhamentos].filter(Boolean).map(parte);
    if (!itens.length) return;
    const lista = itens.length > 1 ? `${itens.slice(0, -1).join(", ")} e ${itens.at(-1)}` : itens[0];
    const txt = `${lista.charAt(0).toUpperCase()}${lista.slice(1)}.`;
    set({ descricao: txt });
  }

  // ─── Salvar ───────────────────────────────────────────────────────────────
  async function salvar() {
    if (salvando) return;
    const e = errosDoMontador(m, ctx, canal.id);
    if (e.length) { setErros(e); return; }
    setErros([]);
    setSalvando(true);
    try {
      const plano = planoDeGravacao({ m, ctx, unidadeId, canalId: canal.id, ofertasAtuais, combosAtuais });
      for (const f of plano.fichas) {
        const r = await salvarMarmita(f);
        if (r.error) { setErros([`"${f.nome}": ${r.error}`]); return; }
      }
      const ofertasMudaram = JSON.stringify(plano.ofertas) !== JSON.stringify(ofertasAtuais);
      if (ofertasMudaram) {
        const r = await salvarOfertasMarmitaria(unidadeId, plano.ofertas);
        if (r?.error) { setErros([`As marmitas foram salvas, mas o desconto não: ${r.error}`]); return; }
        setOfertas(plano.ofertas);
      }
      if (plano.combos.length !== combosAtuais.length || JSON.stringify(plano.combos) !== JSON.stringify(combosAtuais)) {
        const r = await salvarCombosMarmitaria(unidadeId, plano.combos);
        if (r?.error) { setErros([`As marmitas foram salvas, mas os combos não: ${r.error}`]); return; }
        setCombos(plano.combos);
      }
      await recarregar();
      setPronto({ versoes: plano.versoes, combos: (m.combos || []).length, canal: canal.nome });
    } catch (err) {
      setErros([err?.message || "Erro inesperado ao salvar. O que você digitou continua na tela."]);
    } finally {
      setSalvando(false);
    }
  }

  if (pronto) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-hf-border bg-hf-surface p-6 text-center shadow-sm">
        <CheckCircle2 size={44} className="mx-auto text-hf-success" />
        <h2 className="mt-3 text-xl font-bold text-hf-text">Pronto para vender</h2>
        <p className="mt-1 text-sm text-hf-text-2">{pronto.versoes.map((v) => v.nome).join(" e ")} {pronto.versoes.length > 1 ? "estão" : "está"} no cardápio do {pronto.canal}{pronto.combos ? `, com ${pronto.combos} combo(s)` : ""}.</p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Link href="/dashboard/marmitaria/marmitas/cardapio" className="inline-flex min-h-[48px] items-center justify-center rounded-xl bg-hf-accent px-5 text-sm font-semibold text-white">Ver na Precificação</Link>
          <button type="button" onClick={() => { setM(montadorVazio()); setPronto(null); }} className="inline-flex min-h-[48px] items-center justify-center rounded-xl border border-hf-border px-5 text-sm font-semibold text-hf-text">Criar outra marmita</button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-4 pb-28 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
      <div className="min-w-0 space-y-4">
        {/* 1 — nome */}
        <Etapa n={1} titulo="Qual marmita?" direita={canais.length > 1 && (
          <select value={canal.id} onChange={(e) => setCanalId(e.target.value)} aria-label="Plataforma" className={`${inputCls} w-auto`}>
            {canais.map((c) => <option key={c.id} value={c.id}>Preço no {c.nome}</option>)}
          </select>
        )}>
          <Campo rotulo="Nome"><input className={inputCls} value={m.nome} onChange={(e) => set({ nome: e.target.value })} placeholder="Ex.: Peito de frango com arroz e batata" /></Campo>
          <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]">
            {ordenarCategorias([...CATEGORIAS_FICHA.filter((c) => /marmita/i.test(c)), ...base.marmitas.map((x) => x.categoria).filter(Boolean)]).map((c) => (
              <button key={c} type="button" onClick={() => set({ categoria: c })} aria-pressed={m.categoria === c}
                className={`min-h-[40px] shrink-0 rounded-full border px-3 text-sm font-semibold ${m.categoria === c ? "border-hf-accent bg-hf-accent text-white" : "border-hf-border bg-hf-surface text-hf-text-2"}`}>{c}</button>
            ))}
          </div>
        </Etapa>

        {/* 2 — proteína */}
        <Etapa n={2} titulo="Proteína" subtitulo="O que vai de carne, frango ou peixe e quanto vai."
          direita={custoProteina > 0 && <p className="text-sm text-hf-text-2">Custa <b className="tabular-nums text-hf-text">{brl(custoProteina)}</b></p>}>
          {m.proteina ? (
            <ul>{linhaItem({ it: m.proteina, onQtd: (v) => set({ proteina: { ...m.proteina, qtd: v } }), onUn: (u) => set({ proteina: { ...m.proteina, un: u } }), onTirar: () => set({ proteina: null }) })}</ul>
          ) : busca === "proteina" ? painelBusca("proteina") : (
            <Botao variante="secundario" type="button" onClick={() => setBusca("proteina")}><Plus size={16} /> Escolher a proteína</Botao>
          )}
        </Etapa>

        {/* 3 — empanamento */}
        <Etapa n={3} titulo="Empanamento" subtitulo="Ligue para ter a versão empanada, com o custo da farinha, do ovo…"
          direita={
            <label className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 text-sm font-semibold text-hf-text">
              <input type="checkbox" className="peer sr-only" checked={m.empanar} onChange={(e) => set({ empanar: e.target.checked })} />
              <span className="relative h-7 w-12 rounded-full bg-hf-border-strong transition peer-checked:bg-hf-accent after:absolute after:left-1 after:top-1 after:h-5 after:w-5 after:rounded-full after:bg-white after:transition peer-checked:after:translate-x-5" />
              {m.empanar ? "Empanado" : "Sem empanar"}
            </label>
          }>
          {m.empanar ? (
            <div className="space-y-3">
              {m.empanamento.length > 0 && (
                <ul className="divide-y divide-hf-border">
                  {m.empanamento.map((it) => linhaItem({ it, onQtd: (v) => mudar("empanamento", it.key, { qtd: v }), onUn: (u) => mudar("empanamento", it.key, { un: u }), onTirar: () => tirar("empanamento", it.key) }))}
                </ul>
              )}
              {busca === "empanamento" ? painelBusca("empanamento") : (
                <Botao variante="secundario" type="button" onClick={() => setBusca("empanamento")}><Plus size={16} /> Item do empanamento</Botao>
              )}
              {custoEmpanamento > 0 && <p className="rounded-xl bg-hf-elevated px-3 py-2 text-sm text-hf-text-2">O empanamento soma <b className="tabular-nums text-hf-text">{brl(custoEmpanamento)}</b> em cada marmita.</p>}
              <div className="grid gap-2 sm:grid-cols-2">
                {[["os_dois", "Vender com e sem empanamento"], ["so_empanado", "Vender só empanado"]].map(([id, r]) => (
                  <button key={id} type="button" onClick={() => set({ vender: id })} aria-pressed={m.vender === id}
                    className={`min-h-[48px] rounded-xl border px-3 text-sm font-semibold ${m.vender === id ? "border-hf-accent bg-hf-accent/10 text-hf-accent" : "border-hf-border text-hf-text-2"}`}>{r}</button>
                ))}
              </div>
              <Campo rotulo="Nome da versão empanada">
                <input className={inputCls} value={m.nomeComEditado ? m.nomeCom : nomeEmpanado(m.nome)} onChange={(e) => set({ nomeCom: e.target.value, nomeComEditado: true })} />
              </Campo>
            </div>
          ) : <p className="text-sm text-hf-muted">Desligado: a marmita sai só na versão sem empanamento.</p>}
        </Etapa>

        {/* 4 — acompanhamentos */}
        <Etapa n={4} titulo="Acompanhamentos" subtitulo="Arroz, batata, feijão, salada… e quanto vai de cada um.">
          {m.acompanhamentos.length > 0 && (
            <ul className="divide-y divide-hf-border">
              {m.acompanhamentos.map((it) => linhaItem({ it, onQtd: (v) => mudar("acompanhamentos", it.key, { qtd: v }), onUn: (u) => mudar("acompanhamentos", it.key, { un: u }), onTirar: () => tirar("acompanhamentos", it.key) }))}
            </ul>
          )}
          {busca === "acompanhamento" ? painelBusca("acompanhamento") : (
            <Botao variante="secundario" type="button" className="mt-2" onClick={() => setBusca("acompanhamento")}><Plus size={16} /> Acompanhamento</Botao>
          )}
        </Etapa>

        {(busca === "novo-prod" || busca === "novo-prep") && (
          <div className="rounded-2xl border border-hf-border bg-hf-surface p-4">
            {busca === "novo-prod" ? (
              <NovoProduto unidadeId={unidadeId} nomeInicial={textoNovo} onFechar={() => setBusca(null)}
                onCriado={async (id, unidade) => { await recarregar(); if (id) escolher(destinoNovo, { tipo: "ingrediente", id, unidade }); else setBusca(null); }} />
            ) : (
              <NovoPrePreparo unidadeId={unidadeId} base={base} nomeInicial={textoNovo} onFechar={() => setBusca(null)}
                onCriado={async (id, unidade) => { await recarregar(); escolher(destinoNovo, { tipo: "pre_preparo", id, unidade }); }} />
            )}
          </div>
        )}

        {/* 5 — embalagem */}
        <Etapa n={5} titulo="Embalagem" subtitulo="Marmitex, tampa, talheres, sacola…">
          {m.embalagens.length > 0 && (
            <ul className="mb-2 divide-y divide-hf-border">
              {m.embalagens.map((e) => {
                const ins = base.insumos.get(e.insumo_id);
                const c = ins ? (parseNumero(e.qtd) || 0) * custoUnitarioEfetivoInsumo(ins) : null;
                return (
                  <li key={e.key} className="grid grid-cols-[1fr_76px_72px_44px] items-center gap-2 py-2">
                    <p className="min-w-0 truncate text-sm font-semibold text-hf-text">{ins?.nome || "Embalagem fora do cadastro"}</p>
                    <CampoNumero valor={e.qtd} onChange={(v) => setM((x) => ({ ...x, embalagens: x.embalagens.map((i) => (i.key === e.key ? { ...i, qtd: v } : i)) }))} aria-label="Quantidade" />
                    <p className="text-right text-sm font-bold tabular-nums">{c > 0 ? brl(c) : "—"}</p>
                    <button type="button" aria-label="Remover" onClick={() => setM((x) => ({ ...x, embalagens: x.embalagens.filter((i) => i.key !== e.key) }))} className="flex h-11 w-11 items-center justify-center rounded-lg text-hf-muted hover:bg-hf-elevated"><Trash2 size={16} /></button>
                  </li>
                );
              })}
            </ul>
          )}
          {busca === "embalagem" ? (
            <div>
              <BuscaItens base={base} modo="embalagem" excluir={m.embalagens.map((e) => e.insumo_id)}
                onEscolher={(r) => { setM((x) => ({ ...x, embalagens: [...x.embalagens, { key: novaChave(), insumo_id: r.id, qtd: "1", tipo: x.embalagens.length ? "outra" : "marmitex" }] })); setBusca(null); }}
                onCriarEmbalagem={(t) => { setTextoNovo(t); setBusca("nova-emb"); }} />
              <button type="button" onClick={() => setBusca(null)} className="mt-1 min-h-[40px] text-sm font-semibold text-hf-muted">Fechar a busca</button>
            </div>
          ) : busca === "nova-emb" ? (
            <NovoProduto unidadeId={unidadeId} embalagem nomeInicial={textoNovo} onFechar={() => setBusca(null)}
              onCriado={async (id) => { await recarregar(); if (id) setM((x) => ({ ...x, embalagens: [...x.embalagens, { key: novaChave(), insumo_id: id, qtd: "1", tipo: "marmitex" }] })); setBusca(null); }} />
          ) : (
            <Botao variante="secundario" type="button" onClick={() => setBusca("embalagem")}><Plus size={16} /> Embalagem</Botao>
          )}
        </Etapa>

        {/* 6 — preço e lucro */}
        <Etapa n={6} titulo="Preço e lucro" subtitulo={`${rotuloLucro} depois das taxas do ${canal.nome}${embutidos?.completo ? ", da equipe e dos custos fixos" : ""}.`}>
          <div className="grid gap-3 sm:grid-cols-2">
            {contas.map((c) => {
              const campo = c.chave === "com" ? "precoCom" : "precoSem";
              const v = vereditoDaVersao(c, { margemAlvoPct, lucroAlvoReais });
              return (
                <div key={c.chave} className="rounded-2xl border border-hf-border bg-hf-elevated/50 p-3">
                  <p className="text-sm font-bold text-hf-text">{c.nome || (c.chave === "com" ? "Versão empanada" : "Marmita")}</p>
                  <dl className="mt-2 space-y-1 text-sm">
                    <div className="flex justify-between gap-2"><dt className="text-hf-text-2">Comida</dt><dd className="tabular-nums">{brl(c.alimentos)}</dd></div>
                    <div className="flex justify-between gap-2"><dt className="text-hf-text-2">Embalagem</dt><dd className="tabular-nums">{brl(c.embalagens)}</dd></div>
                    <div className="flex justify-between gap-2 border-t border-hf-border pt-1 font-semibold"><dt>Custo da marmita</dt><dd className="tabular-nums">{c.custo === null ? "—" : brl(c.custo)}</dd></div>
                  </dl>
                  {c.pendencias.length > 0 && <p className="mt-1 text-xs text-hf-warning">{c.pendencias[0]}</p>}
                  <div className="mt-3">
                    <span className="mb-1 block text-xs font-semibold text-hf-text-2">Preço de venda</span>
                    <CampoNumero valor={m[campo]} onChange={(val) => set({ [campo]: val })} placeholder="R$" aria-label={`Preço de ${c.nome}`} />
                    {c.sugerido?.preco ? (
                      <button type="button" onClick={() => set({ [campo]: String(c.sugerido.preco).replace(".", ",") })} className="mt-1 inline-flex min-h-[36px] items-center gap-1 text-xs font-semibold text-hf-accent">
                        <Sparkles size={13} /> Usar o sugerido: {brl(c.sugerido.preco)}
                      </button>
                    ) : <p className="mt-1 text-xs text-hf-muted">{c.sugerido?.motivo}</p>}
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2 rounded-xl bg-hf-surface px-3 py-2">
                    <span className="text-sm text-hf-text-2">{rotuloLucro}</span>
                    <span className={`text-lg font-bold tabular-nums ${c.cheio?.lucro < 0 ? "text-hf-danger" : "text-hf-success"}`}>{c.cheio ? `${brl(c.cheio.lucro)}` : "—"}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${VEREDITO_COR[v.id]}`}>{v.rotulo}</span>
                    {c.cheio?.lucroPct != null && <span className="text-xs text-hf-muted">{pctTxt(c.cheio.lucroPct)} do preço</span>}
                  </div>
                  {c.precoDesconto && (
                    <div className="mt-2 rounded-xl border border-dashed border-hf-border-strong px-3 py-2 text-sm">
                      <div className="flex justify-between gap-2"><span className="text-hf-text-2">Com {String(m.descontoPct).replace(".", ",")}% de desconto</span><b className="tabular-nums">{brl(c.precoDesconto)}</b></div>
                      <div className="flex justify-between gap-2"><span className="text-hf-text-2">Lucro</span><b className={`tabular-nums ${c.comDesconto?.lucro < 0 ? "text-hf-danger" : "text-hf-success"}`}>{brl(c.comDesconto?.lucro)}</b></div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-[220px_1fr] sm:items-end">
            <Campo rotulo="Desconto para promoção (%)" dica="Opcional. Fica salvo como promoção na Precificação.">
              <CampoNumero valor={m.descontoPct} onChange={(v) => set({ descontoPct: v })} placeholder="Ex.: 10" />
            </Campo>
          </div>
        </Etapa>

        {/* 7 — combos */}
        <Etapa n={7} titulo="Combos" subtitulo="Opcional: a marmita com bebida e/ou sobremesa que você já tem cadastradas.">
          {m.combos.map((cb) => {
            const versao = versoes.find((v) => v.chave === cb.versao) || versoes[0];
            const conta = contas.find((c) => c.chave === versao.chave);
            const r = contaDoCombo({ combo: cb, marmita: { preco: conta?.preco, custo: conta?.custo }, catalogo, canal, tributosPct: base.config.tributos_pct, embutidos });
            const tipo = TIPOS_COMBO.find((t) => t.id === cb.tipo);
            const mudarCombo = (campos) => setM((x) => ({ ...x, combos: x.combos.map((c) => (c.id === cb.id ? { ...c, ...campos } : c)) }));
            return (
              <div key={cb.id} className="mb-3 rounded-2xl border border-hf-border p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-bold text-hf-text">{tipo.rotulo}</p>
                  <button type="button" aria-label="Tirar o combo" onClick={() => setM((x) => ({ ...x, combos: x.combos.filter((c) => c.id !== cb.id) }))} className="flex h-10 w-10 items-center justify-center rounded-lg text-hf-muted hover:bg-hf-elevated"><Trash2 size={16} /></button>
                </div>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {versoes.length > 1 && (
                    <select className={inputCls} value={cb.versao} onChange={(e) => mudarCombo({ versao: e.target.value })} aria-label="Qual marmita">
                      {versoes.map((v) => <option key={v.chave} value={v.chave}>{v.nome || (v.chave === "com" ? "Empanada" : "Sem empanar")}</option>)}
                    </select>
                  )}
                  {tipo.grupos.map((g) => (
                    <select key={g} className={inputCls} value={cb[`${g}_id`] || ""} onChange={(e) => mudarCombo({ [`${g}_id`]: e.target.value })} aria-label={g === "bebida" ? "Bebida" : "Sobremesa"}>
                      <option value="">{g === "bebida" ? "Escolha a bebida" : "Escolha a sobremesa"}</option>
                      {(catalogo[g] || []).map((i) => <option key={i.id} value={i.id}>{i.nome} · {brl(i.preco)}</option>)}
                    </select>
                  ))}
                  <div>
                    <CampoNumero valor={cb.preco} onChange={(v) => mudarCombo({ preco: v })} placeholder="Preço do combo (R$)" aria-label="Preço do combo" />
                    {r.ok && r.separado > 0 && (r.economiaCliente < 0
                      ? <p className="mt-1 text-xs font-semibold text-hf-warning">O combo está mais caro que comprar separado ({brl(r.separado)}).</p>
                      : <p className="mt-1 text-xs text-hf-muted">Separado sai {brl(r.separado)}{r.economiaCliente > 0 ? `: o cliente economiza ${brl(r.economiaCliente)}` : ""}</p>)}
                  </div>
                </div>
                {!r.ok ? <p className="mt-2 text-xs text-hf-muted">{r.motivo}</p> : r.lucro != null && (
                  <p className="mt-2 text-sm">Lucro do combo: <b className={`tabular-nums ${r.prejuizo ? "text-hf-danger" : "text-hf-success"}`}>{brl(r.lucro)}</b> <span className="text-xs text-hf-muted">({pctTxt(r.lucroPct)})</span></p>
                )}
              </div>
            );
          })}
          <div className="flex flex-wrap gap-2">
            {TIPOS_COMBO.map((t) => (
              <button key={t.id} type="button" onClick={() => setM((x) => ({ ...x, combos: [...x.combos, { id: novaChave(), tipo: t.id, versao: versoes[0]?.chave || "sem", bebida_id: "", sobremesa_id: "", preco: "" }] }))}
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-hf-border px-3 text-sm font-semibold text-hf-text-2 hover:border-hf-accent">
                {t.id === "sobremesa" ? <IceCreamCone size={15} /> : <CupSoda size={15} />} + {t.rotulo}
              </button>
            ))}
          </div>
          {(!catalogo.bebida?.length || !catalogo.sobremesa?.length) && (
            <p className="mt-2 text-xs text-hf-muted">{!catalogo.bebida?.length ? "Nenhuma bebida cadastrada. " : ""}{!catalogo.sobremesa?.length ? "Nenhuma sobremesa cadastrada. " : ""}Cadastre na Ficha técnica (categorias Refrigerantes, Sucos ou Sobremesas).</p>
          )}
        </Etapa>

        {/* 8 — descrição e foto */}
        <Etapa n={8} titulo="Descrição e foto" subtitulo="O que o cliente lê e vê no cardápio.">
          <div className="grid gap-3 sm:grid-cols-[1fr_168px]">
            <div>
              <textarea className={`${inputCls} min-h-[96px] py-2`} value={m.descricao} onChange={(e) => set({ descricao: e.target.value })} placeholder="Ex.: Peito de frango grelhado, arroz soltinho e batata assada." aria-label="Descrição" />
              <button type="button" onClick={descricaoAutomatica} className="mt-1 inline-flex min-h-[40px] items-center gap-1 text-sm font-semibold text-hf-accent"><Sparkles size={14} /> Montar a descrição com os itens</button>
            </div>
            <div>
              <button type="button" onClick={() => fotoRef.current?.click()} className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-2xl border border-dashed border-hf-border-strong bg-hf-elevated/50 text-hf-muted hover:border-hf-accent">
                {m.foto ? <img src={m.foto} alt="Foto da marmita" className="h-full w-full object-cover" /> : <span className="flex flex-col items-center gap-1 text-xs">{enviandoFoto ? <Loader2 size={22} className="animate-spin" /> : <ImagePlus size={22} />}{enviandoFoto ? "Enviando…" : "Adicionar foto"}</span>}
              </button>
              <input ref={fotoRef} type="file" accept="image/*" className="hidden" onChange={(e) => enviarFoto(e.target.files?.[0])} />
              {m.foto && <button type="button" onClick={() => set({ foto: "" })} className="mt-1 min-h-[36px] text-xs font-semibold text-hf-muted hover:text-hf-danger">Remover foto</button>}
            </div>
          </div>
        </Etapa>

        {erros.length > 0 && (
          <Aviso tipo="alerta"><p className="font-semibold">Falta pouco:</p><ul className="ml-4 list-disc">{erros.map((e) => <li key={e}>{e}</li>)}</ul></Aviso>
        )}
      </div>

      {/* Resumo: fixo ao lado no computador, embaixo no celular */}
      <aside style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }} className="fixed inset-x-0 bottom-0 z-20 border-t border-hf-border bg-hf-surface/95 p-3 backdrop-blur lg:sticky lg:top-4 lg:rounded-2xl lg:border lg:p-4 lg:shadow-sm">
        <div className="mx-auto flex max-w-3xl items-center gap-3 lg:block">
          <div className="hidden lg:block">
            <div className="mb-3 aspect-[4/3] overflow-hidden rounded-xl bg-gradient-to-br from-hf-elevated to-hf-border">
              {m.foto ? <img src={m.foto} alt="" className="h-full w-full object-cover" /> : <span className="grid h-full place-items-center text-hf-muted"><UtensilsCrossed size={30} /></span>}
            </div>
            <p className="font-bold text-hf-text">{m.nome || "Nova marmita"}</p>
            <ul className="mt-2 space-y-1.5 text-sm">
              {contas.map((c) => (
                <li key={c.chave} className="flex items-center justify-between gap-2 rounded-lg bg-hf-elevated px-2.5 py-1.5">
                  <span className="min-w-0 truncate text-hf-text-2">{c.chave === "com" ? "Empanada" : m.empanar ? "Sem empanar" : "Marmita"} · {brl(c.preco)}</span>
                  <b className={`shrink-0 tabular-nums ${c.cheio?.lucro < 0 ? "text-hf-danger" : "text-hf-success"}`}>{c.cheio ? brl(c.cheio.lucro) : "—"}</b>
                </li>
              ))}
            </ul>
          </div>
          <div className="min-w-0 flex-1 lg:hidden">
            <p className="text-[11px] text-hf-muted">{rotuloLucro === "Lucro" ? "Lucro por marmita" : rotuloLucro}</p>
            {contas.map((c) => (
              <p key={c.chave} className="flex items-baseline gap-1.5 whitespace-nowrap text-sm">
                {contas.length > 1 && <span className="text-xs text-hf-text-2">{c.chave === "com" ? "Empanada" : "Sem empanar"}</span>}
                <b className={`tabular-nums ${c.cheio?.lucro < 0 ? "text-hf-danger" : "text-hf-success"}`}>{c.cheio ? brl(c.cheio.lucro) : "—"}</b>
              </p>
            ))}
          </div>
          <Botao type="button" onClick={salvar} disabled={salvando} className="min-h-[48px] shrink-0 lg:mt-3 lg:w-full">
            {salvando ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />} {salvando ? "Salvando…" : <><span className="lg:hidden">Salvar no cardápio</span><span className="hidden lg:inline">Salvar e colocar no cardápio</span></>}
          </Botao>
        </div>
      </aside>
    </div>
  );
}
