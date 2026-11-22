"use client";

// CARDÁPIO DA MARMITARIA (pedidos do dono, 28/10 e 05/11/2026): cada item
// sozinho ou em combo, por plataforma, com preço, markup, CMV e o que sobra
// tirando todos os custos; promoções como "compre 1 e ganhe outra" mostram o
// lucro antes de publicar. Contas em lib/marmitaria/promocoes.mjs e
// cardapio.mjs. É simulação: nada grava venda. Combos e promoções ficam em
// config_sistema; o preço de cada plataforma, em marmitaria_precificacao_canais.

import { useState } from "react";
import { Plus, Trash2, Save, Loader2, ChevronDown, ChevronUp, UtensilsCrossed, CupSoda, IceCreamCone, SlidersHorizontal, CheckCircle2 } from "lucide-react";
import { useMarmitaria } from "./contexto";
import { Abas, Aviso, Botao, Campo, CampoNumero, Secao, Selo, brl, markupPctTxt, markupTxt, inputCls, lerNumero, pctTxt } from "./ui";
import {
  TIPOS_OFERTA, MODELOS_COMBO, ROTULO_GRUPO,
  simularOferta, normalizarCombo, itensDoCombo,
  normalizarOferta, rotuloDaOferta,
} from "../../lib/marmitaria/promocoes.mjs";
import { composicaoDoPreco, ehMei, ordenarCategorias, rotuloDoLucro } from "../../lib/marmitaria/cardapio.mjs";
import NoBolso from "../metas/NoBolso";
import { metaEmReais } from "../../lib/precificacao.mjs";
import { melhorTroca } from "../../lib/marmitaria/painel-lucro.mjs";
import { normalizarCanal, precoSugerido } from "../../lib/marmitaria/nucleo.mjs";
import { alertasDoPreco, cascataDoPreco, contaDoPreco, faixaDePrecos } from "../../lib/marmitaria/precificacao.mjs";
import { precoPorMarkup } from "../../lib/marmitaria/dia.mjs";
import { definirDisponibilidade, salvarPrecoNoCanal } from "../../lib/marmitaria/dados";
import { useCardapio } from "./useCardapio";
import ModeloDaLoja from "./ModeloDaLoja";
import ImprimirPrecificacao from "./ImprimirPrecificacao";
import { salvarCombosMarmitaria, salvarOfertasMarmitaria } from "../../lib/parametros";

const chip = (ativo) => `h-10 rounded-xl border px-3 text-sm font-bold transition ${ativo ? "border-hf-accent bg-hf-accent text-white" : "border-hf-border bg-hf-surface text-hf-text-2 hover:bg-hf-elevated"}`;

// Dono, 17/11/2026: "Precificação" (o preço de cada produto, com equipe e custos)
// e, no passo seguinte, "Combos e descontos" (marmita + bebida/sobremesa, descontos).
const ABAS_DO_MODO = {
  precificacao: [{ id: "cardapio", rotulo: "Produtos" }, { id: "modelo", rotulo: "Modelo da loja" }],
  combos: [{ id: "combos", rotulo: "Combos" }, { id: "promocoes", rotulo: "Descontos" }, { id: "cardapio", rotulo: "Como fica no cardápio" }],
};
const SECOES_DO_MODO = { precificacao: [["marmitas", "Produtos"]], combos: [["promocoes", "Descontos"], ["combos", "Combos"]] };

export default function CombosPromocoes({ onEditar, abaInicial, modo = "precificacao" }) {
  const abas = ABAS_DO_MODO[modo] || ABAS_DO_MODO.precificacao;
  const [aba, setAba] = useState(abas.some((a) => a.id === abaInicial) ? abaInicial : abas[0].id);
  const { base, custos, unidadeId } = useMarmitaria();
  const { canais, canal, setCanalId, embutidos, combos, setCombos, ofertas, setOfertas, metaPct, setMetaPct, catalogo, comum, linhas, mudancas, porCanal } = useCardapio();
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState(null);

  async function gravarOfertas(lista) {
    setOfertas(lista);
    const r = await salvarOfertasMarmitaria(unidadeId, lista);
    setMsg(r?.error ? { tipo: "alerta", t: `Não foi possível salvar a promoção: ${r.error}` } : { tipo: "info", t: "Cardápio salvo." });
  }

  async function salvarCombos(lista) {
    setSalvando(true); setMsg(null);
    const r = await salvarCombosMarmitaria(unidadeId, lista);
    setSalvando(false);
    setMsg(r?.error ? { tipo: "alerta", t: `Não foi possível salvar: ${r.error}` } : { tipo: "info", t: "Combos salvos." });
  }

  const qtd = { marmitas: linhas.filter((l) => l.secao === "marmitas").length, combos: combos.length, promocoes: ofertas.length };
  // dono, 17/11/2026: tocou no tipo, o combo abre na hora, em cima (não lá embaixo), e não repete combo vazio
  const novoCombo = (modelo) => {
    setAba("combos");
    const vazio = combos.find((c) => c.modelo === modelo.id && !c.itens.some((i) => i.id) && !String(c.preco).trim());
    const alvo = vazio || normalizarCombo({ modelo: modelo.id, nome: modelo.rotulo });
    if (!vazio) setCombos((l) => [alvo, ...l]);
    setTimeout(() => document.getElementById(`combo-${alvo.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
  };

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-3xl border border-hf-border bg-hf-surface">
        <div className="bg-gradient-to-br from-hf-accent/15 via-hf-accent/5 to-transparent p-4 sm:p-5">
          <p className="text-xs font-black uppercase tracking-wider text-hf-accent">{modo === "combos" ? "Combos e descontos" : "Precificação"}</p>
          <h2 className="mt-0.5 text-lg font-black text-hf-text sm:text-xl">{modo === "combos" ? "Junte marmita, bebida e sobremesa e dê descontos vendo o lucro" : "O preço de cada produto e o que sobra em cada venda"}</h2>
          {modo === "precificacao" && <div className="mt-3"><ImprimirPrecificacao canais={canais} porCanal={porCanal} custos={custos} embutidos={embutidos} metaPct={metaPct} /></div>}
          {modo === "combos" && <div className="mt-3 grid grid-cols-2 gap-2">
            {[["Combos", qtd.combos, "combos"], ["Descontos", qtd.promocoes, "promocoes"]].map(([rot, n, id]) => (
              <button key={id} type="button" onClick={() => setAba(id)} className="rounded-2xl bg-hf-surface/90 p-3 text-left shadow-sm ring-1 ring-hf-border transition hover:ring-hf-accent">
                <p className="text-2xl font-black tabular-nums text-hf-text">{n}</p>
                <p className="text-xs font-bold text-hf-text-2">{rot}</p>
              </button>
            ))}
          </div>}
          {modo === "combos" && <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold uppercase text-hf-muted">Vendendo em</span>
            {canais.map((c) => <button key={c.id} type="button" className={chip(c.id === canal.id)} onClick={() => setCanalId(c.id)}>{c.nome}</button>)}
          </div>}
        </div>
      </section>

      <Abas abas={abas} valor={aba} onChange={setAba} />

      {aba !== "modelo" && mudancas.length > 0 && <Aviso tipo="alerta">{mudancas.length} {mudancas.length > 1 ? "custos mudaram" : "custo mudou"} nos últimos 30 dias e {mudancas.length > 1 ? "mexeram" : "mexeu"} no lucro. <a href="/dashboard/marmitaria/marmitas/lucro" className="font-bold underline">Ver no painel</a></Aviso>}
      {aba !== "modelo" && linhas[0]?.falta && <Aviso tipo="alerta">{linhas[0].falta}: preencha em <a href="/dashboard/marmitaria/configuracoes" className="font-bold underline">Configurações</a> para ver o lucro.</Aviso>}
      {aba !== "modelo" && !embutidos.completo && <Aviso>Equipe e custos fixos ainda não entram por completo (falta {embutidos.faltando.join(", ")}). Preencha em <a href="/dashboard/marmitaria/configuracoes" className="font-bold underline">Configurações</a>.</Aviso>}

      {aba === "cardapio" && <CardapioVendas linhas={linhas} custos={custos} onEditar={onEditar} comum={comum} metaPct={metaPct}
        onRemoverOferta={(id) => gravarOfertas(ofertas.filter((o) => o.id !== id))} msg={msg} irPara={modo === "combos" ? setAba : null} secoes={SECOES_DO_MODO[modo]} porCanal={modo === "precificacao" ? porCanal : null} canais={canais} />}

      {aba === "promocoes" && <SimuladorPromocao catalogo={catalogo} comum={comum} bloqueio={linhas[0]?.falta || null}
        onAdicionar={(fichaId, o) => { gravarOfertas([...ofertas, normalizarOferta({ ...o, ficha_id: fichaId })]); setAba("cardapio"); }} />}

      {aba === "combos" && (
        <Secao titulo="Montar combos" subtitulo="Escolha o tipo, os itens e o preço. Com preço, o combo entra no cardápio.">
          <p className="mb-2 text-xs font-bold uppercase text-hf-muted">Toque no tipo de combo</p>
          <div className="flex flex-wrap gap-2">
            {MODELOS_COMBO.map((m) => (
              <button key={m.id} type="button" onClick={() => novoCombo(m)}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-hf-border bg-hf-surface px-3 text-sm font-bold text-hf-text transition hover:border-hf-accent">
                <span className="flex -space-x-1.5">
                  {m.grupos.map((g, i) => { const I = ICONE_GRUPO[g]; return <span key={`${g}-${i}`} className="grid h-7 w-7 place-items-center rounded-full border-2 border-hf-surface bg-hf-menu text-white"><I size={13} /></span>; })}
                </span>
                {m.rotulo.replace(/^Comida/, "Marmita")}
              </button>
            ))}
          </div>
          {!combos.length && <p className="mt-3 text-sm text-hf-text-2">Nenhum combo ainda. Toque em um dos tipos acima.</p>}
          <ul className="mt-3 space-y-3">
            {combos.map((c) => <LinhaCombo key={c.id} combo={c} catalogo={catalogo} comum={comum}
              onChange={(novo) => setCombos((l) => l.map((x) => (x.id === c.id ? normalizarCombo(novo) : x)))}
              onRemover={() => setCombos((l) => l.filter((x) => x.id !== c.id))} />)}
          </ul>
          {combos.length > 0 && (
            <div className="sticky bottom-3 mt-4 flex flex-wrap items-center gap-3 rounded-2xl bg-hf-surface/95 p-2 shadow-lg ring-1 ring-hf-border">
              <Botao onClick={() => salvarCombos(combos)} disabled={salvando}>{salvando ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Salvar combos</Botao>
              {msg && <span className={`text-sm font-bold ${msg.tipo === "alerta" ? "text-hf-danger" : "text-hf-accent"}`}>{msg.t}</span>}
            </div>
          )}
        </Secao>
      )}

      {aba === "modelo" && <ModeloDaLoja linhas={linhas} canal={canal} onEditar={onEditar} />}

      {aba !== "modelo" && <details className="group rounded-2xl border border-hf-border bg-hf-surface p-4">
        <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-black text-hf-text">
          <SlidersHorizontal size={16} className="text-hf-accent" /> Ajustes da conta
          <span className="ml-auto text-xs font-semibold text-hf-text-2">{ehMei(base.config) ? "MEI · " : ""}meta {Number(base.config.rateio?.meta_lucro_reais) > 0 ? brl(Number(base.config.rateio.meta_lucro_reais)) : metaPct === "" ? "—" : `${metaPct}%`}</span>
        </summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-hf-elevated p-3 text-sm">
            <p className="text-xs font-semibold text-hf-text-2">Em cada marmita <Selo natureza="estimado" /></p>
            <p className="mt-1 text-hf-text">Equipe {embutidos.cmoPorMarmita == null ? "—" : brl(embutidos.cmoPorMarmita)}</p>
            <p className="text-hf-text">Custos fixos {embutidos.fixosPorMarmita == null ? "—" : brl(embutidos.fixosPorMarmita)}</p>
          </div>
          <Campo rotulo="Meta de lucro" dica="Acima dela: faz sentido. Para fixar, use Configurações."><CampoNumero sufixo="%" valor={metaPct} onChange={setMetaPct} placeholder="ex.: 15" /></Campo>
        </div>
      </details>}
    </div>
  );
}

const ICONE_GRUPO = { marmita: UtensilsCrossed, bebida: CupSoda, sobremesa: IceCreamCone };

const BORDA_VEREDITO = { ok: "border-b-hf-success", baixo: "border-b-hf-warning", prejuizo: "border-b-hf-danger", lucro: "border-b-hf-border", sem_dados: "border-b-hf-border" };
const VEREDITO_COR = { ok: "bg-hf-success/10 text-hf-success", baixo: "bg-hf-warning/10 text-hf-warning", prejuizo: "bg-hf-danger/10 text-hf-danger", lucro: "bg-hf-elevated text-hf-text-2", sem_dados: "bg-hf-elevated text-hf-muted" };
const SECOES_CARDAPIO = [["promocoes", "Promoções"], ["combos", "Combos"], ["marmitas", "Sozinhos"]];

// Cardápio como o cliente vê (estilo iFood) e, ao lado, o lucro de cada item.
function CardapioVendas({ linhas, custos, onRemoverOferta, msg, onEditar, irPara, comum: comumGeral, metaPct, secoes = SECOES_CARDAPIO, porCanal = null, canais = [] }) {
  const [canalDoCard, setCanalDoCard] = useState({});
  const { recarregar } = useMarmitaria();
  const [aberto, setAberto] = useState(null);
  const [precoAberto, setPrecoAberto] = useState(null);
  // dono, 17/11/2026: "onde eu coloco o preço?" → sem preço, o campo já vem aberto no card
  const [fechados, setFechados] = useState(() => new Set());
  const precoVisivel = (l, cid = "") => precoAberto === `${l.id}|${cid}` || (l.secao === "marmitas" && l.semPreco && !fechados.has(`${l.id}|${cid}`));
  const [erro, setErro] = useState(null);
  const rotuloLucro = rotuloDoLucro(comumGeral.embutidos);
  async function tirarDoCardapio(ficha) {
    setErro(null);
    const r = await definirDisponibilidade(ficha.id, false);
    if (r.error) setErro(r.error); else await recarregar();
  }
  return (
    <Secao titulo={porCanal ? "Precificação" : `Cardápio no ${comumGeral.canal.nome}`} subtitulo={porCanal ? "Em cada produto, toque no app para ver e colocar o preço dele." : "O preço de cada item nessa plataforma e quanto sobra para você em cada pedido."}>
      {erro && <p className="mb-2 text-sm font-bold text-hf-danger">{erro}</p>}
      {msg && <p className={`mb-2 text-sm font-bold ${msg.tipo === "alerta" ? "text-hf-danger" : "text-hf-accent"}`}>{msg.t}</p>}
      <div className="space-y-5">
        {secoes.map(([sec, rot]) => {
          const lista = linhas.filter((l) => l.secao === sec);
          if (!lista.length) {
            if (sec === "marmitas" || !irPara) return null;
            return (
              <button key={sec} type="button" onClick={() => irPara(sec)} className="flex w-full items-center gap-3 rounded-2xl border-2 border-dashed border-hf-border p-4 text-left hover:border-hf-accent">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-hf-accent/10 text-hf-accent"><Plus size={18} /></span>
                <span><span className="block text-sm font-black text-hf-text">{sec === "combos" ? "Montar o primeiro combo" : "Criar o primeiro desconto"}</span>
                  <span className="block text-xs text-hf-text-2">{sec === "combos" ? "Marmita + bebida, marmita + sobremesa, ou marmita + bebida + sobremesa." : "Desconto, 2 por 1 ou 3 por 2, vendo o lucro antes."}</span></span>
              </button>
            );
          }
          // "Sozinhos" vem separado pelas categorias da Ficha técnica.
          const blocos = sec === "marmitas"
            ? ordenarCategorias(lista.map((l) => l.categoria)).map((c) => [c, lista.filter((l) => l.categoria === c)])
            : [[rot, lista]];
          return blocos.map(([titulo, itens]) => (
            <div key={`${sec}-${titulo}`}>
              <p className="mb-2 flex items-center gap-2 text-sm font-black text-hf-text">{titulo} <span className="rounded-full bg-hf-elevated px-2 text-xs text-hf-text-2">{itens.length}</span></p>
              <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {itens.map((l0) => {
                  // o app de cada card (dono, 17/11/2026: "dentro do card eu aperto e visualizo")
                  const cid = canalDoCard[l0.id] || comumGeral.canal.id;
                  const doCanal = porCanal?.get(cid);
                  const l = doCanal?.linhas.find((x) => x.id === l0.id) || l0;
                  const comum = doCanal?.comum || comumGeral;
                  const img = l.ficha?.imagem;
                  const abrir = aberto === l.id;
                  const c = l.ficha ? custos.get(l.ficha.id) : null;
                  return (
                    <li key={l.id} className={`overflow-hidden rounded-2xl border border-hf-border border-b-4 bg-hf-surface ${BORDA_VEREDITO[l.veredito.id] || ""}`}>
                      {/* Identidade "Gestão" (08/11/2026): a foto do prato em cima, com o código da ficha. */}
                      <div className="relative h-36 bg-gradient-to-br from-hf-elevated to-hf-border">
                        {img ? <img src={img} alt="" loading="lazy" className="h-full w-full object-cover" /> : <span className="grid h-full place-items-center text-hf-muted"><UtensilsCrossed size={28} /></span>}
                        {l.ficha?.codigo && <span className="absolute left-2 top-2 rounded-md bg-hf-accent px-1.5 py-0.5 text-[11px] font-bold text-white">{l.ficha.codigo}</span>}
                      </div>
                      <div className="p-3">
                        {porCanal && canais.length > 1 && (
                          <div className="mb-2 flex flex-wrap gap-1.5" role="group" aria-label="App">
                            {canais.map((c) => {
                              const temPreco = !(porCanal.get(c.id)?.linhas.find((x) => x.id === l0.id)?.semPreco ?? true);
                              return (
                                <button key={c.id} type="button" aria-pressed={c.id === cid} onClick={() => setCanalDoCard((m) => ({ ...m, [l0.id]: c.id }))}
                                  className={`min-h-[36px] rounded-full border px-3 text-xs font-bold ${c.id === cid ? "border-hf-menu bg-hf-menu text-white" : "border-hf-border bg-hf-surface text-hf-text-2"}`}>
                                  {c.nome}{temPreco ? "" : " · sem preço"}
                                </button>
                              );
                            })}
                          </div>
                        )}
                        <div className="min-w-0">
                          {l.rotulo && l.secao !== "marmitas" ? <span className="mb-0.5 inline-block rounded-md bg-hf-danger/10 px-1.5 py-0.5 text-[11px] font-black text-hf-danger">{l.rotulo}</span> : null}
                          <p className="break-words text-sm font-bold text-hf-text">{l.nome}</p>
                          <span className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${VEREDITO_COR[l.veredito.id]}`}>{l.veredito.id === "ok" && <CheckCircle2 size={12} />}{l.veredito.rotulo}</span>
                          {l.descricao && <p className="text-xs text-hf-muted">{l.descricao}</p>}
                        </div>
                      <dl className="mt-3 grid grid-cols-4 gap-2 text-center">
                        <Numero r="Preço" v={l.semPreco ? "—" : brl(l.precoPago)} riscado={l.precoCheio > l.precoPago ? brl(l.precoCheio) : null} />
                        <Numero r="Custo" v={l.custo == null ? "—" : brl(l.custo)} />
                        <Numero r="Markup" v={markupPctTxt(l.markup)} />
                        <Numero r="CMV" v={l.cmvPct == null ? "—" : pctTxt(l.cmvPct)} />
                      </dl>
                      <div className="mt-2 rounded-xl bg-hf-elevated p-2.5">
                        <div className="min-w-0">
                          <p className="text-[11px] font-bold uppercase text-hf-muted">{rotuloLucro}</p>
                          <p className={`text-xl font-black tabular-nums ${l.lucro < 0 ? "text-hf-danger" : "text-hf-text"}`}>{l.lucro == null ? "—" : brl(l.lucro)} <span className="text-xs font-bold text-hf-text-2">{l.lucro == null ? "" : pctTxt(l.lucroPct)}</span></p>
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                        {l.secao === "marmitas" && !precoVisivel(l, cid) && <button type="button" onClick={() => setPrecoAberto(`${l.id}|${cid}`)} aria-expanded={false} className="min-h-[36px] rounded-full bg-hf-menu px-3 text-xs font-bold text-white">{l.semPreco ? "Colocar preço" : "Mudar preço"}</button>}
                        {!l.semPreco && !l.falta && <button type="button" onClick={() => setAberto(abrir ? null : l.id)} aria-expanded={abrir} className="inline-flex min-h-[32px] items-center gap-1 text-xs font-bold text-hf-accent hover:underline">{abrir ? <ChevronUp size={14} /> : <ChevronDown size={14} />} Ver a conta</button>}
                        {onEditar && l.ficha && <button type="button" onClick={() => onEditar(l.ficha)} className="min-h-[32px] text-xs font-bold text-hf-text hover:underline">Editar ficha</button>}
                        {l.secao === "marmitas" && l.ficha && <button type="button" onClick={() => tirarDoCardapio(l.ficha)} className="min-h-[32px] text-xs font-bold text-hf-text-2 hover:text-hf-danger">Tirar do cardápio</button>}
                        {l.secao === "promocoes" && <button type="button" onClick={() => onRemoverOferta(l.id)} className="min-h-[32px] text-xs font-bold text-hf-text-2 hover:text-hf-danger">Tirar do cardápio</button>}
                      </div>
                      {precoVisivel(l, cid) && <FormarPreco key={`${l.id}|${cid}`} linha={l} comum={comum} metaPct={metaPct} custoFicha={c} aoSalvar={() => { setPrecoAberto(null); setFechados((f) => new Set(f).add(`${l.id}|${cid}`)); }} />}
                      {abrir && l.sim && (
                        <div className="mt-2">
                          {c && <p className="text-xs text-hf-text-2">Custo de 1 unidade: ingredientes {brl(c.alimentos + c.prePreparos)} · embalagens {brl(c.embalagens)} = <b>{brl(c.total)}</b>{!c.completo ? " (incompleto)" : ""}</p>}
                          {l.secao === "combos" && <p className="text-xs text-hf-text-2">Itens: {l.itens.map((i) => `${i.nome} (custo ${i.custo == null ? "—" : brl(i.custo)})`).join(" · ")}</p>}
                          <ComposicaoDoPreco c={composicaoDoPreco({ linha: l, custoFicha: l.secao === "combos" ? null : c, embutidos: comum.embutidos })} />
                          {l.secao === "marmitas" ? <Comparacao s={{ ...l.sim, sem: l.sim.com }} rotuloSem="Preço cheio" rotuloCom="Preço cheio" unico rotuloLucro={rotuloLucro} /> : <Comparacao s={l.sim} rotuloSem={l.secao === "combos" ? "Separado" : "Sem promoção"} rotuloCom={l.secao === "combos" ? "Combo" : "Com promoção"} rotuloLucro={rotuloLucro} />}
                        </div>
                      )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ));
        })}
        {!linhas.length && <p className="text-sm text-hf-text-2">Monte as fichas técnicas para formar o cardápio.</p>}
      </div>
      <a href="/dashboard/marmitaria/marmitas/lucro?aba=simulador" className="mt-5 inline-flex min-h-[44px] items-center text-sm font-bold text-hf-accent hover:underline">Simular vendas do dia, da semana e do mês</a>
    </Secao>
  );
}

// De cada R$ do preço, quanto vai para cada coisa. Toque na linha para abrir.
function ComposicaoDoPreco({ c }) {
  if (!c) return null;
  return (
    <div className="mt-2 rounded-2xl border border-hf-border p-3">
      <p className="flex justify-between gap-3 text-sm font-black text-hf-text"><span>Do preço de {brl(c.preco)}</span><span className="tabular-nums">Markup {c.markupPct == null ? "—" : `${Math.round(c.markupPct)}%`}</span></p>
      <div className="mt-1 divide-y divide-hf-border">
        {c.linhas.map((l) => {
          const cabeca = <><span className={l.id === "lucro" ? "font-black text-hf-text" : "font-semibold text-hf-text"}>{l.rotulo}</span><span className={`ml-auto tabular-nums ${l.valor < 0 ? "text-hf-danger" : "text-hf-text-2"}`}>{pctTxt(l.pct)} · {brl(l.valor)}</span></>;
          if (!l.filhos?.length) return <div key={l.id} className="flex min-h-[40px] items-center gap-3 text-sm">{cabeca}</div>;
          return (
            <details key={l.id} className="text-sm">
              <summary className="flex min-h-[40px] cursor-pointer list-none items-center gap-3">{cabeca}</summary>
              <ul className="pb-2 pl-3">
                {l.filhos.map((f) => <li key={f.rotulo} className="flex justify-between gap-3 py-0.5 text-xs text-hf-text-2"><span>{f.rotulo}</span><span className="tabular-nums">{pctTxt(f.pct)} · {brl(f.valor)}</span></li>)}
              </ul>
            </details>
          );
        })}
      </div>
    </div>
  );
}

function Numero({ r, v, riscado }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-semibold text-hf-muted">{r}</dt>
      <dd className="text-sm font-bold tabular-nums text-hf-text">{v}</dd>
      {riscado && <dd className="text-[11px] tabular-nums text-hf-muted line-through">{riscado}</dd>}
    </div>
  );
}

// Forma o preço do item nesta plataforma. A conta muda a cada tecla; só grava no botão.
// Estilo de precificação (especificação do dono, 21/11/2026): preço de lista,
// o que o cliente paga e o que chega para você são coisas diferentes. A conta
// vem em cascata, com preço mínimo, preço da meta e alertas. Tudo ESTIMATIVA.
const QUEM_PAGA = [{ id: "loja", rotulo: "Você (loja)" }, { id: "app", rotulo: "O app" }, { id: "dividido", rotulo: "Metade cada" }];

function CascataDoPreco({ linhas }) {
  if (!linhas?.length) return null;
  return (
    <ul className="mt-3 divide-y divide-hf-border rounded-xl border border-hf-border text-sm">
      {linhas.map((l) => (
        <li key={l.id} className={`flex items-baseline justify-between gap-3 px-3 py-2 ${l.tipo === "final" ? "bg-hf-elevated font-black" : l.tipo === "total" ? "font-bold" : ""} ${l.informativo ? "text-hf-muted" : ""}`}>
          <span className="min-w-0">{l.rotulo}</span>
          <span className={`shrink-0 tabular-nums ${l.tipo === "final" && l.valor < 0 ? "text-hf-danger" : ""}`}>
            {l.valor == null ? "pendente" : brl(l.valor)}{l.pct != null && l.id !== "lista" ? <span className="ml-1 text-[11px] font-normal text-hf-muted">{pctTxt(l.pct)}</span> : null}
          </span>
        </li>
      ))}
    </ul>
  );
}

function FormarPreco({ linha, comum, metaPct, aoSalvar, custoFicha = null }) {
  const { base, unidadeId, recarregar } = useMarmitaria();
  const metaReais = Number(base.config.rateio?.meta_lucro_reais) > 0 ? Number(base.config.rateio.meta_lucro_reais) : null;
  const metaAte = Number(base.config.rateio?.meta_lucro_ate) > 0 ? Number(base.config.rateio.meta_lucro_ate) : null;
  const item = linha.itens[0];
  const ehMarmita = item.grupo === "marmita";
  const [preco, setPreco] = useState(item.preco > 0 ? String(item.preco).replace(".", ",") : "");
  const [markup, setMarkup] = useState("");
  const [promo, setPromo] = useState("");
  const [quemPaga, setQuemPaga] = useState("loja");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(null);
  const valor = lerNumero(preco);
  const conta = valor > 0 ? contaDoPreco({ precoLista: valor, clientePaga: lerNumero(promo), quemPaga, custo: item.custo, canal: comum.canal, tributosPct: comum.tributosPct, embutidos: ehMarmita ? comum.embutidos : null, ehMarmita }) : null;
  const r = conta?.r;
  const custoComEmbutidos = item.custo == null ? null : item.custo + (ehMarmita ? comum.embutidos.totalPorMarmita || 0 : 0);
  const faixa = faixaDePrecos({ custoComEmbutidos, canal: comum.canal, tributosPct: comum.tributosPct, metas: ehMarmita ? [metaReais, metaAte] : [] });
  const ingredientes = custoFicha ? (Number(custoFicha.alimentos) || 0) + (Number(custoFicha.prePreparos) || 0) : item.custo;
  const linhas = r?.valido ? cascataDoPreco({ r, custo: { ingredientes: item.custo == null ? null : ingredientes, embalagens: custoFicha?.embalagens || 0 }, descontoApp: conta.descontoApp }) : null;
  const alertas = r ? alertasDoPreco({ r, metaReais: ehMarmita ? metaReais : null, completo: !linha.falta && (custoFicha ? custoFicha.completo !== false : item.custo != null) }) : [];
  const usar = (v) => { setPreco(String(v).replace(".", ",")); setErro(null); };
  const canalN = normalizarCanal(comum.canal);
  const modo = canalN.usar_fatura ? `taxa real da fatura, ${pctTxt(canalN.fatura.totalPct)} (estimativa)` : "taxas do contrato";

  async function salvar() {
    if (salvando) return;
    setSalvando(true); setErro(null);
    try {
      const res = await salvarPrecoNoCanal({ unidadeId, fichaId: item.id, canal: comum.canal.id, preco: valor });
      if (res.error) { setErro(res.error); return; }
      await recarregar();
      aoSalvar();
    } finally { setSalvando(false); }
  }

  return (
    <div className="mt-2 rounded-xl border border-hf-border p-3">
      {/* dono, 17/11/2026: sem campo de markup; o markup aparece sozinho conforme o preço */}
      <Campo rotulo={`Preço de lista no ${comum.canal.nome}`} dica={`Calculado com as ${modo}.`}><CampoNumero prefixo="R$" valor={preco} onChange={(v) => { setPreco(v); setMarkup(""); }} placeholder="0,00" /></Campo>
      {!linha.falta && (faixa.minimo != null || faixa.metas.length > 0) && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {faixa.minimo != null && <button type="button" onClick={() => usar(faixa.minimo)} className="min-h-[36px] rounded-full border border-hf-border px-3 text-xs font-bold text-hf-text-2">Ponto de equilíbrio {brl(faixa.minimo)}</button>}
          {faixa.metas.filter((m) => m.preco != null).map((m) => <button key={m.lucro} type="button" onClick={() => usar(m.preco)} className="min-h-[36px] rounded-full bg-hf-menu px-3 text-xs font-bold text-white">Lucro {brl(m.lucro)}: {brl(m.preco)}</button>)}
        </div>
      )}
      {r?.valido && !linha.falta && (
        <p className="mt-2 text-sm text-hf-text-2">Markup <b className="tabular-nums">{markupPctTxt(r.markup)}</b> · CMV <b className="tabular-nums">{pctTxt(r.cmvTecnicoPct)}</b></p>
      )}
      {valor > 0 && (
        <details className="mt-2">
          <summary className="min-h-[36px] cursor-pointer py-1 text-xs font-bold text-hf-text-2">Simular promoção {conta?.desconto ? `· ${pctTxt(conta.desconto.pct)} de desconto` : ""}</summary>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <Campo rotulo="Com a promoção, o cliente paga" dica={conta?.desconto ? `Desconto de ${brl(conta.desconto.desconto)} (${pctTxt(conta.desconto.pct)})` : "Ex.: lista R$ 42, cliente paga R$ 30"}><CampoNumero prefixo="R$" valor={promo} onChange={setPromo} placeholder="0,00" /></Campo>
            <div>
              <p className="mb-1 text-[13px] font-medium text-hf-muted">Quem paga o desconto</p>
              <div className="flex flex-wrap gap-1.5">
                {QUEM_PAGA.map((q) => <button key={q.id} type="button" aria-pressed={quemPaga === q.id} onClick={() => setQuemPaga(q.id)} className={`min-h-[40px] rounded-full border px-3 text-sm font-semibold ${quemPaga === q.id ? "border-hf-menu bg-hf-menu text-white" : "border-hf-border bg-hf-surface text-hf-text-2"}`}>{q.rotulo}</button>)}
              </div>
            </div>
          </div>
        </details>
      )}
      {!linha.falta && <CascataDoPreco linhas={linhas} />}
      {alertas.map((a) => <Aviso key={a.texto} tipo={a.tipo === "perigo" || a.tipo === "alerta" ? "alerta" : "info"} className="mt-2">{a.texto}</Aviso>)}
      {r?.valido && !linha.falta && <NoBolso lucro={r.lucro} preco={valor} metaPct={metaPct} metaReais={ehMarmita ? metaReais : null} rotulo={`${rotuloDoLucro(comum.embutidos)} (estimativa)`} />}
      {erro && <Aviso tipo="alerta" className="mt-2">{erro}</Aviso>}
      <Botao className="mt-2" type="button" onClick={salvar} disabled={salvando || !(valor > 0)}>{salvando ? "Salvando…" : `Salvar preço no ${comum.canal.nome}`}</Botao>
      <p className="mt-1 text-[11px] text-hf-muted">Salva só o preço deste app; os outros apps e o balcão não mudam. Promoção aqui é simulação.</p>
    </div>
  );
}

function SimuladorPromocao({ catalogo, comum, bloqueio, onAdicionar }) {
  const { base } = useMarmitaria();
  const opcoes = [...catalogo.marmita, ...catalogo.bebida.filter((i) => i.propria), ...catalogo.sobremesa.filter((i) => i.propria)];
  const [itemId, setItemId] = useState(catalogo.marmita[0]?.id || opcoes[0]?.id || "");
  const [qtd, setQtd] = useState("1");
  const [precoSim, setPrecoSim] = useState("");
  const [oferta, setOferta] = useState({ tipo: "leve_pague", leve: "2", pague: "1", valor: "" });
  const base0 = opcoes.find((o) => o.id === itemId);
  // Preço digitado só para simular (o da marmita não muda).
  const item = base0 && String(precoSim).trim() ? { ...base0, preco: precoSim } : base0;
  if (!opcoes.length) return <Secao titulo="Simular promoção"><p className="text-sm text-hf-text-2">Cadastre uma marmita para simular.</p></Secao>;
  const s = item ? simularOferta({ itens: [{ ...item, qtd }], oferta, ...comum }) : null;
  const atalhos = [["Compre 1, ganhe 1", { tipo: "leve_pague", leve: "2", pague: "1" }], ["3 por 2", { tipo: "leve_pague", leve: "3", pague: "2" }], ["10% off", { tipo: "desconto_pct", valor: "10" }], ["20% off", { tipo: "desconto_pct", valor: "20" }], ["R$ 5 off", { tipo: "desconto_rs", valor: "5" }]];
  return (
    <Secao titulo="Nova promoção" subtitulo="Escolha o item e a promoção, veja o que sobra e coloque no cardápio.">
      <div className="grid gap-3 sm:grid-cols-[1fr_160px_120px]">
        <Campo rotulo="Produto">
          <select className={inputCls} value={itemId} onChange={(e) => { setItemId(e.target.value); setPrecoSim(""); }}>
            {["marmita", "bebida", "sobremesa"].map((g) => opcoes.some((o) => o.grupo === g) ? <optgroup key={g} label={ROTULO_GRUPO[g]}>{opcoes.filter((o) => o.grupo === g).map((o) => <option key={o.id} value={o.id}>{o.nome}{o.preco ? ` · ${brl(o.preco)}` : ""}</option>)}</optgroup> : null)}
          </select>
        </Campo>
        <Campo rotulo="Preço" dica={base0?.preco ? `Hoje: ${brl(base0.preco)}` : "Sem preço cadastrado"}><CampoNumero prefixo="R$" valor={precoSim} onChange={setPrecoSim} placeholder={base0?.preco ? String(base0.preco).replace(".", ",") : "0,00"} /></Campo>
        <Campo rotulo="Quantidade"><CampoNumero valor={qtd} onChange={setQtd} /></Campo>
      </div>
      {base0 && !(Number(String(item.preco).replace(",", ".")) > 0) && <Aviso tipo="alerta" className="mt-3">{base0.nome} está sem preço: digite um preço acima para simular, ou salve em Formar preço.</Aviso>}
      <div className="mt-3 flex flex-wrap gap-2">
        {atalhos.map(([rot, o]) => {
          const ativo = oferta.tipo === o.tipo && (o.tipo === "leve_pague" ? oferta.leve === o.leve && oferta.pague === o.pague : String(oferta.valor) === o.valor);
          return <button key={rot} type="button" className={chip(ativo)} onClick={() => setOferta({ ...oferta, ...o })}>{rot}</button>;
        })}
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <Campo rotulo="Tipo">
          <select className={inputCls} value={oferta.tipo} onChange={(e) => setOferta({ ...oferta, tipo: e.target.value })}>
            {TIPOS_OFERTA.filter((t) => t.id !== "preco_fixo").map((t) => <option key={t.id} value={t.id}>{t.rotulo}</option>)}
          </select>
        </Campo>
        {oferta.tipo === "leve_pague" ? <>
          <Campo rotulo="Leva"><CampoNumero valor={oferta.leve} onChange={(v) => setOferta({ ...oferta, leve: v })} /></Campo>
          <Campo rotulo="Paga"><CampoNumero valor={oferta.pague} onChange={(v) => setOferta({ ...oferta, pague: v })} /></Campo>
        </> : oferta.tipo !== "nenhuma" ? (
          <Campo rotulo={oferta.tipo === "desconto_pct" ? "Desconto (%)" : "Desconto (R$)"}><CampoNumero valor={oferta.valor} onChange={(v) => setOferta({ ...oferta, valor: v })} /></Campo>
        ) : null}
      </div>
      {item && item.custo == null && <Aviso tipo="alerta" className="mt-3">{item.nome} está sem custo na ficha: o lucro não dá para calcular (DADOS INSUFICIENTES).</Aviso>}
      {bloqueio ? <Aviso tipo="alerta" className="mt-3">{bloqueio}: preencha em Configurações para ver o lucro.</Aviso> : s && <><Comparacao s={s} rotuloLucro={rotuloDoLucro(comum.embutidos)} />{s.com.valido && <NoBolso lucro={s.com.lucro} preco={s.com.preco} metaPct={base.config.margem_alvo_pct ?? ""} metaReais={item?.grupo === "marmita" && Number(base.config.rateio?.meta_lucro_reais) > 0 ? Number(base.config.rateio.meta_lucro_reais) * (s.com.pedido?.unidades || 1) : null} rotulo={rotuloDoLucro(comum.embutidos)} />}</>}
      {onAdicionar && item && oferta.tipo !== "nenhuma" && !String(precoSim).trim() && (
        <Botao className="mt-3" onClick={() => onAdicionar(item.id, oferta)}><Plus size={16} /> Colocar “{rotuloDaOferta(oferta)}” no cardápio</Botao>
      )}
    </Secao>
  );
}

function LinhaCombo({ combo, catalogo, comum, onChange, onRemover }) {
  const itens = itensDoCombo(combo, catalogo);
  const soma = itens ? itens.reduce((t, i) => t + (Number(i.preco) || 0), 0) : null;
  const s = itens && String(combo.preco).trim() ? simularOferta({ itens, oferta: { tipo: "preco_fixo", valor: combo.preco }, ...comum }) : null;
  const modelo = MODELOS_COMBO.find((m) => m.id === combo.modelo);
  const troca = s && !s.semCusto ? melhorTroca({ itens, preco: combo.preco, catalogo, comum }) : null;
  return (
    <li id={`combo-${combo.id}`} className="scroll-mt-24 rounded-2xl border border-hf-border p-3 sm:p-4">
      <div className="flex flex-wrap items-end gap-2">
        <Campo rotulo={modelo?.rotulo || "Combo"} className="min-w-[200px] flex-1"><input className={inputCls} value={combo.nome} onChange={(e) => onChange({ ...combo, nome: e.target.value })} placeholder="Nome do combo" /></Campo>
        <button type="button" onClick={onRemover} aria-label={`Remover ${combo.nome || "combo"}`} className="grid h-11 w-11 place-items-center rounded-xl border border-hf-border text-hf-text-2 hover:text-hf-danger"><Trash2 size={16} /></button>
      </div>
      <div className={`mt-3 grid gap-3 ${combo.itens.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
        {combo.itens.map((slot, pos) => (
          <Campo key={`${slot.grupo}-${pos}`} rotulo={ROTULO_GRUPO[slot.grupo]}>
            <select className={inputCls} value={slot.id} onChange={(e) => onChange({ ...combo, itens: combo.itens.map((x, j) => (j === pos ? { ...x, id: e.target.value } : x)) })}>
              <option value="">Escolha…</option>
              {catalogo[slot.grupo].map((o) => <option key={o.id} value={o.id}>{o.nome}{o.preco ? ` · ${brl(o.preco)}` : ""}</option>)}
            </select>
            {!catalogo[slot.grupo].length && <span className="mt-1 block text-xs text-hf-muted">Nenhuma ficha de {ROTULO_GRUPO[slot.grupo].toLowerCase()} ativa.</span>}
          </Campo>
        ))}
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-[200px_1fr] sm:items-end">
        <Campo rotulo="Preço do combo" dica={soma != null ? `Separado: ${brl(soma)}` : "Escolha os itens."}><CampoNumero prefixo="R$" valor={combo.preco} onChange={(v) => onChange({ ...combo, preco: v })} /></Campo>
        {soma != null && soma > 0 && (
          <div className="flex flex-wrap gap-2">
            {[10, 15, 20].map((d) => <button key={d} type="button" className={chip(false)} onClick={() => onChange({ ...combo, preco: String(Math.floor(soma * (1 - d / 100) * 100) / 100).replace(".", ",") })}>{d}% abaixo · {brl(soma * (1 - d / 100))}</button>)}
          </div>
        )}
      </div>
      {s && <Comparacao s={s} rotuloCom="Combo" rotuloSem="Separado" rotuloLucro={rotuloDoLucro(comum.embutidos)} />}
      {troca && (
        <Aviso className="mt-3">Trocando {troca.sai.nome} por {troca.entra.nome}, no mesmo preço, sobram {brl(troca.ganho)} a mais por pedido.{" "}
          <button type="button" className="font-bold underline" onClick={() => onChange({ ...combo, itens: combo.itens.map((x) => (x.id === troca.sai.id ? { ...x, id: troca.entra.id } : x)) })}>Trocar</button>
        </Aviso>
      )}
    </li>
  );
}

function Comparacao({ s, rotuloCom = "Com promoção", rotuloSem = "Sem promoção", unico = false, rotuloLucro = "Lucro" }) {
  const col = (titulo, r, destaque) => (
    <div className={`rounded-2xl p-3 ${destaque ? "border-2 border-hf-accent/40 bg-hf-accent/5" : "bg-hf-elevated"}`}>
      <p className="text-xs font-black uppercase tracking-wide text-hf-text-2">{titulo}</p>
      {!r.valido ? <p className="mt-1 text-sm text-hf-text-2">{r.motivo}</p> : (
        <dl className="mt-1 space-y-0.5 text-sm">
          <L r="Cliente paga" v={brl(r.pedido.paga)} forte />
          {r.pedido.unidades > 1 && <L r="Sai da cozinha" v={`${r.pedido.unidades} unidades`} />}
          {r.pedido.desconto > 0 && <L r="Desconto dado" v={`− ${brl(r.pedido.desconto)}`} />}
          <L r="Impostos" v={r.tributos > 0 ? `− ${brl(r.tributos)}` : brl(0)} />
          {r.comissao > 0 && <L r="Comissão da plataforma" v={`− ${brl(r.comissao)}`} />}
          {r.taxaPagamento > 0 && <L r="Maquininha / pagamento" v={`− ${brl(r.taxaPagamento)}`} />}
          {r.taxaFixa > 0 && <L r="Taxa fixa" v={`− ${brl(r.taxaFixa)}`} />}
          {r.entrega > 0 && <L r="Entrega" v={`− ${brl(r.entrega)}`} />}
          <L r="Custo dos produtos" v={r.custo == null ? "—" : `− ${brl(r.custo)}`} />
          <L r="Equipe (CMO)" v={r.cmo == null ? "falta dado" : `− ${brl(r.cmo)}`} />
          <L r="Custos fixos" v={r.fixos == null ? "falta dado" : `− ${brl(r.fixos)}`} />
          <div className={`mt-1 flex justify-between gap-3 border-t border-hf-border pt-1.5 text-base font-black ${r.lucro < 0 ? "text-hf-danger" : "text-hf-text"}`}>
            <dt>{rotuloLucro}</dt><dd className="shrink-0 tabular-nums">{r.lucro == null ? "—" : `${brl(r.lucro)} · ${pctTxt(r.lucroPct)}`}</dd>
          </div>
          <L r="Markup · CMV" v={`${markupTxt(r.markup)} · ${pctTxt(r.cmvTecnicoPct)}`} />
        </dl>
      )}
    </div>
  );
  return (
    <div className="mt-4">
      <div className={`grid gap-3 ${unico ? "" : "sm:grid-cols-2"}`}>{!unico && col(rotuloSem, s.sem, false)}{col(rotuloCom, s.com, true)}</div>
      <p className="mt-2 text-sm font-semibold text-hf-text">
        {unico ? null : s.prejuizo ? <span className="text-hf-danger">Essa promoção dá prejuízo em cada pedido.</span>
          : s.vezesParaEmpatar != null && s.vezesParaEmpatar > 1 ? <>Para lucrar o mesmo que sem promoção, você precisa vender <b>{s.vezesParaEmpatar.toLocaleString("pt-BR")}×</b> mais pedidos.</>
          : s.vezesParaEmpatar != null ? <>A promoção lucra igual ou mais por pedido.</> : null}
        {" "}<Selo natureza="simulacao" />
      </p>
    </div>
  );
}

function L({ r, v, forte }) {
  return <div className={`flex justify-between gap-3 ${forte ? "font-black text-hf-text" : "text-hf-text-2"}`}><dt>{r}</dt><dd className="tabular-nums">{v}</dd></div>;
}
