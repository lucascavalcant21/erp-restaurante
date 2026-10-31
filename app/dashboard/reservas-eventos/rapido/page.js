"use client";

// SIMULADOR DO EVENTO (pedido do dono, 31/10/2026; substitui o Orçamento rápido
// de 27/10 na mesma rota): combinar Mesa montada + Buffet + Bar + Equipe e ver o
// resultado na hora, sem botão de calcular. Contas em app/lib/evento-simulador.mjs
// (custo da porção = ficha técnica, o mesmo do orçamento do evento).
// "Continuar para precificação" cria o evento com o orçamento montado e abre a
// tela completa (imposto, maquininha, meta, proposta). Visual do dono: pílulas,
// círculos ✓ e resultado limpo, em fundo branco.

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Loader2, Minus, Plus, Search, Trash2 } from "lucide-react";
import { useERP } from "../../../context/ERPContext";
import { supabase } from "../../../lib/supabase";
import { fetchFichas } from "../../../lib/operacao";
import { fetchParamsDaCasa, PARAMS_PADRAO } from "../../../lib/parametros";
import { catalogoDeFichas, filtrarCatalogo } from "../../../lib/evento-rapido.mjs";
import { MODALIDADES, simulacaoVazia, calcularSimulacao, orcamentoDaSimulacao } from "../../../lib/evento-simulador.mjs";
import { resumoDoOrcamento, camposDoEventoParaGravar, mensagemErroEvento } from "../../../lib/evento-orcamento.mjs";

const brl = (v) => (v == null ? "—" : Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));
const fmtQ = (n) => Number(n || 0).toLocaleString("pt-BR", { maximumFractionDigits: 2 });
const pilula = "h-12 w-full rounded-full border border-hf-border bg-hf-surface px-5 text-base font-semibold text-hf-text outline-none focus:border-hf-accent";
const novoId = () => (globalThis.crypto?.randomUUID?.() || `id-${Date.now()}-${Math.random().toString(36).slice(2)}`);
// Passo dos botões − / + e valor inicial de cada modalidade
const PASSO = { mesa: { passo: 5, inicial: 10 }, buffet: { passo: 0.25, inicial: 1 }, bar: { passo: 1, inicial: 2 } };

function Marca({ marcado }) {
  return marcado
    ? <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-hf-text text-white"><Check size={15} strokeWidth={3} /></span>
    : <span className="h-6 w-6 shrink-0 rounded-full border-2 border-hf-border-strong" />;
}

function Contador({ valor, onChange, passo, rotulo, sufixo }) {
  const v = Number(String(valor).replace(",", ".")) || 0;
  const mudar = (d) => onChange(String(Math.max(0, Math.round((v + d) * 100) / 100)));
  return (
    <div className="flex items-center gap-2">
      <button type="button" onClick={() => mudar(-passo)} aria-label={`Menos ${rotulo}`} className="grid h-9 w-9 place-items-center rounded-full border border-hf-border text-hf-text"><Minus size={15} /></button>
      <input inputMode="decimal" value={valor} onChange={(e) => onChange(e.target.value)} aria-label={rotulo} className="h-9 w-16 rounded-full border border-hf-border bg-hf-surface text-center text-sm font-black tabular-nums text-hf-text outline-none focus:border-hf-accent" />
      <button type="button" onClick={() => mudar(passo)} aria-label={`Mais ${rotulo}`} className="grid h-9 w-9 place-items-center rounded-full border border-hf-border text-hf-text"><Plus size={15} /></button>
      <span className="text-xs text-hf-muted">{sufixo}</span>
    </div>
  );
}

// Uma modalidade de fichas (mesa, buffet ou bar): categorias com ✓ por ficha e a quantidade dos marcados
function ModalidadeFichas({ mod, dado, grupos, onAlternar, onQuantidade, parte }) {
  const [busca, setBusca] = useState("");
  const lista = useMemo(() => filtrarCatalogo(grupos, { busca }), [grupos, busca]);
  const marcados = new Map(dado.itens.map((i) => [i.ficha_id, i]));
  const campo = mod.campo;
  return (
    <section className="rounded-3xl border border-hf-border bg-hf-surface p-5">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-wider text-hf-muted">Héfisto · Eventos</p>
          <h2 className="text-lg font-black text-hf-text">{mod.rotulo}</h2>
        </div>
        <p className="text-sm text-hf-text-2">{dado.itens.length} selecionado(s){parte ? <> · <b className="text-hf-text">{brl(parte.custo)}</b></> : null}</p>
      </div>
      <label className="relative mt-3 block">
        <Search size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-hf-muted" />
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar prato, drink ou ingrediente" aria-label={`Buscar em ${mod.rotulo}`} className={`${pilula} h-11 pl-11 text-sm`} />
      </label>
      {lista.length === 0 && <p className="mt-4 text-sm text-hf-muted">{grupos.length ? "Nada encontrado com essa busca." : "Nenhuma ficha técnica cadastrada para isto. Cadastre em Fichas técnicas."}</p>}
      <div className="mt-2 max-h-[560px] divide-y divide-hf-border overflow-y-auto pr-1">
        {lista.map((g) => (
          <div key={g.categoria} className="py-3">
            <div className="flex items-baseline justify-between">
              <h3 className="text-[15px] font-black text-hf-text">{g.categoria}</h3>
              <span className="text-xs text-hf-muted">{g.itens.filter((i) => marcados.has(i.id)).length} selecionados</span>
            </div>
            <ul className="mt-1">
              {g.itens.map((it) => {
                const sel = marcados.get(it.id);
                const linha = parte?.linhas.find((l) => l.ficha_id === it.id);
                return (
                  <li key={it.id} className="py-1.5">
                    <button type="button" onClick={() => onAlternar(it)} aria-pressed={!!sel} className="flex w-full items-center gap-3 text-left">
                      <Marca marcado={!!sel} />
                      <span className="min-w-0 flex-1 truncate text-[15px] text-hf-text">{it.nome}{it.peloInsumo ? <span className="text-xs text-hf-muted"> · leva {it.peloInsumo}</span> : null}</span>
                      <span className={`text-sm tabular-nums ${it.custoPorcao ? "text-hf-text-2" : "text-hf-warning"}`}>{it.custoPorcao ? brl(it.custoPorcao) : "sem custo"}</span>
                    </button>
                    {sel && (
                      <div className="ml-9 mt-2 flex flex-wrap items-center justify-between gap-2">
                        <Contador valor={sel[campo]} onChange={(v) => onQuantidade(it.id, v)} passo={PASSO[mod.id].passo} rotulo={`${mod.sufixo} de ${it.nome}`} sufixo={mod.sufixo} />
                        {linha && <span className="text-sm font-bold tabular-nums text-hf-text">{fmtQ(linha.porcoes)} porç. · {brl(linha.custo)}</span>}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function SimuladorDoEvento() {
  const router = useRouter();
  const { unidadeAtiva, sessao } = useERP();
  const [fichas, setFichas] = useState([]);
  const [params, setParams] = useState(PARAMS_PADRAO);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [sim, setSim] = useState(() => ({ ...simulacaoVazia(), convidados: "20" }));
  const [criando, setCriando] = useState(false);

  useEffect(() => {
    if (!unidadeAtiva) return;
    let ativo = true;
    (async () => {
      setCarregando(true);
      const [rF, rP] = await Promise.all([fetchFichas(unidadeAtiva), fetchParamsDaCasa(unidadeAtiva)]);
      if (!ativo) return;
      setFichas(rF.data || []);
      setParams({ ...PARAMS_PADRAO, ...(rP.data || {}) });
      setErro(rF.error && rF.error !== "Offline" ? "Não foi possível ler as fichas técnicas agora." : "");
      setCarregando(false);
    })();
    return () => { ativo = false; };
  }, [unidadeAtiva]);

  const catalogo = useMemo(() => catalogoDeFichas(fichas), [fichas]);
  const r = useMemo(() => calcularSimulacao(sim, fichas), [sim, fichas]);

  const mudar = (fn) => setSim((s) => { const n = structuredClone(s); fn(n); return n; });
  const alternarModalidade = (id) => mudar((s) => { s.modalidades[id].ativa = !s.modalidades[id].ativa; });
  const alternarFicha = (modId, it) => mudar((s) => {
    const m = s.modalidades[modId];
    if (m.itens.some((i) => i.ficha_id === it.id)) m.itens = m.itens.filter((i) => i.ficha_id !== it.id);
    else m.itens.push({ id: novoId(), ficha_id: it.id, quantidade: modId === "mesa" ? String(PASSO.mesa.inicial) : "", por_pessoa: modId === "mesa" ? "" : String(PASSO[modId].inicial) });
  });
  const quantidade = (modId, fichaId, v) => mudar((s) => {
    const i = s.modalidades[modId].itens.find((x) => x.ficha_id === fichaId);
    if (i) i[modId === "mesa" ? "quantidade" : "por_pessoa"] = v;
  });

  const temItens = r.partes.some((p) => p.linhas.length);
  async function continuar() {
    if (criando || !temItens || !(r.convidados > 0)) return;
    setCriando(true); setErro("");
    const orc = orcamentoDaSimulacao(sim, fichas, params);
    const campos = camposDoEventoParaGravar(orc, resumoDoOrcamento(orc, fichas), {});
    const { data, error } = await supabase.from("eventos")
      .insert([{ ...campos, unidade_id: unidadeAtiva, funil_status: "MONTANDO PROPOSTA", responsavel_id: sessao?.id || null }])
      .select("id").single();
    setCriando(false);
    if (error) { setErro(`Não foi possível criar o evento: ${mensagemErroEvento(error.message)}`); return; }
    router.push(`/dashboard/reservas-eventos/eventos/${data.id}`);
  }

  if (carregando) return <div className="p-8 text-center font-bold text-hf-text-2"><Loader2 className="mr-2 inline animate-spin" size={18} />Carregando as fichas técnicas…</div>;

  const parteDe = (id) => r.partes.find((p) => p.id === id);
  const saldoCor = r.saldo == null ? "text-hf-text" : r.saldo >= 0 ? "text-hf-success" : "text-hf-danger";

  return (
    <div className="grid gap-4 pb-28 lg:grid-cols-[minmax(0,1fr)_400px] lg:pb-8">
      <div className="min-w-0 space-y-4">
        {/* Composição: quais modalidades entram */}
        <section className="rounded-3xl border border-hf-border bg-hf-surface p-5">
          <div className="flex items-baseline justify-between gap-3">
            <div>
              <p className="text-[11px] font-black uppercase tracking-wider text-hf-muted">Héfisto · Eventos</p>
              <h2 className="text-lg font-black text-hf-text">Composição do evento</h2>
            </div>
            <span className="rounded-full bg-hf-elevated px-3 py-1 text-xs font-bold text-hf-text-2">Simulador</span>
          </div>
          <p className="mt-1 text-sm text-hf-text-2">Marque os serviços que vai combinar. Cada um tem a própria conta; o resultado soma tudo.</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {MODALIDADES.map((m) => {
              const ativa = sim.modalidades[m.id].ativa;
              return (
                <button key={m.id} type="button" onClick={() => alternarModalidade(m.id)} aria-pressed={ativa}
                  className={`flex items-center gap-3 rounded-2xl border p-3 text-left transition ${ativa ? "border-hf-text bg-hf-elevated" : "border-hf-border bg-hf-surface"}`}>
                  <Marca marcado={ativa} />
                  <span className="min-w-0 flex-1"><span className="block text-[15px] font-black text-hf-text">{m.rotulo}</span><span className="block text-xs text-hf-muted">{m.ajuda}</span></span>
                  {ativa && parteDe(m.id) ? <span className="text-sm font-bold tabular-nums text-hf-text">{brl(parteDe(m.id).custo)}</span> : null}
                </button>
              );
            })}
          </div>
        </section>

        {erro && <p role="alert" className="rounded-2xl bg-hf-danger/10 px-4 py-3 text-sm font-bold text-hf-danger">{erro}</p>}

        {MODALIDADES.filter((m) => m.campo && sim.modalidades[m.id].ativa).map((m) => (
          <ModalidadeFichas key={m.id} mod={m} dado={sim.modalidades[m.id]} grupos={m.id === "bar" ? catalogo.bar : catalogo.cozinha}
            onAlternar={(it) => alternarFicha(m.id, it)} onQuantidade={(fid, v) => quantidade(m.id, fid, v)} parte={parteDe(m.id)} />
        ))}

        {sim.modalidades.equipe.ativa && (
          <section className="rounded-3xl border border-hf-border bg-hf-surface p-5">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-lg font-black text-hf-text">Equipe de atendimento</h2>
              <span className="text-sm font-bold tabular-nums text-hf-text">{brl(parteDe("equipe")?.custo)}</span>
            </div>
            <div className="mt-3 space-y-2">
              {sim.modalidades.equipe.linhas.map((l) => (
                <div key={l.id} className="grid grid-cols-[1fr_70px_110px_40px] items-center gap-2">
                  <input value={l.funcao} onChange={(e) => mudar((s) => { s.modalidades.equipe.linhas.find((x) => x.id === l.id).funcao = e.target.value; })} placeholder="Garçom" aria-label="Função" className={`${pilula} h-11 text-sm`} />
                  <input inputMode="numeric" value={l.quantidade} onChange={(e) => mudar((s) => { s.modalidades.equipe.linhas.find((x) => x.id === l.id).quantidade = e.target.value; })} aria-label="Quantidade de pessoas" className={`${pilula} h-11 px-3 text-center text-sm`} />
                  <input inputMode="decimal" value={l.valor} onChange={(e) => mudar((s) => { s.modalidades.equipe.linhas.find((x) => x.id === l.id).valor = e.target.value; })} placeholder="Diária R$" aria-label="Diária em reais" className={`${pilula} h-11 px-3 text-sm`} />
                  <button type="button" onClick={() => mudar((s) => { s.modalidades.equipe.linhas = s.modalidades.equipe.linhas.filter((x) => x.id !== l.id); })} aria-label={`Remover ${l.funcao || "pessoa"}`} className="grid h-10 w-10 place-items-center rounded-full text-hf-muted hover:text-hf-danger"><Trash2 size={16} /></button>
                </div>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {["Garçom", "Cozinheiro", "Bartender", "Copeira", "Coordenador"].map((f) => (
                <button key={f} type="button" onClick={() => mudar((s) => { s.modalidades.equipe.linhas.push({ id: novoId(), funcao: f, quantidade: "1", valor: "" }); })}
                  className="h-9 rounded-full border border-hf-border px-4 text-sm font-bold text-hf-text hover:border-hf-accent">+ {f}</button>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Resultado da simulação (fica parado ao lado no computador) */}
      <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
        <section className="rounded-3xl border border-hf-border bg-hf-surface p-5">
          <label className="block text-sm font-bold text-hf-text">Nome do evento (opcional)
            <input value={sim.nome} onChange={(e) => mudar((s) => { s.nome = e.target.value; })} placeholder="Confraternização" className={`${pilula} mt-1.5`} />
          </label>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <label className="block text-sm font-bold text-hf-text">Convidados
              <input inputMode="numeric" value={sim.convidados} onChange={(e) => mudar((s) => { s.convidados = e.target.value.replace(/\D/g, ""); })} className={`${pilula} mt-1.5`} />
            </label>
            <label className="block text-sm font-bold text-hf-text">Preço por pessoa (R$)
              <input inputMode="decimal" value={sim.preco_por_pessoa} onChange={(e) => mudar((s) => { s.preco_por_pessoa = e.target.value; })} placeholder="80" className={`${pilula} mt-1.5`} />
            </label>
          </div>
          <label className="mt-3 block text-sm font-bold text-hf-text">Outros custos (R$)
            <input inputMode="decimal" value={sim.outros_custos} onChange={(e) => mudar((s) => { s.outros_custos = e.target.value; })} placeholder="0" className={`${pilula} mt-1.5`} />
          </label>

          <div className="mt-5 rounded-2xl bg-hf-elevated p-4">
            <p className="text-[11px] font-black uppercase tracking-wider text-hf-muted">Resultado da simulação</p>
            <ul className="mt-2 space-y-1.5 text-sm">
              {r.partes.map((p) => <li key={p.id} className="flex justify-between gap-2"><span className="text-hf-text-2">{p.rotulo}{p.fechada ? " (quantidade fechada)" : ""}</span><span className="font-bold tabular-nums text-hf-text">{brl(p.custo)}</span></li>)}
              {r.outros > 0 && <li className="flex justify-between gap-2"><span className="text-hf-text-2">Outros custos</span><span className="font-bold tabular-nums text-hf-text">{brl(r.outros)}</span></li>}
            </ul>
            <div className="mt-3 flex items-baseline justify-between border-t border-hf-border pt-3">
              <span className="text-sm font-bold text-hf-text">Custo total</span>
              <span className="text-lg font-black tabular-nums text-hf-text">{brl(r.custoTotal)}</span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div><p className="text-xs text-hf-text-2">Custo por convidado</p><p className="text-2xl font-black tabular-nums text-hf-text">{brl(r.custoPorConvidado)}</p></div>
              <div><p className="text-xs text-hf-text-2">Faturamento previsto</p><p className="text-2xl font-black tabular-nums text-hf-text">{brl(r.faturamento)}</p></div>
              <div><p className="text-xs text-hf-text-2">Saldo do evento</p><p className={`text-2xl font-black tabular-nums ${saldoCor}`}>{brl(r.saldo)}</p></div>
              <div><p className="text-xs text-hf-text-2">Saldo por pessoa</p><p className={`text-2xl font-black tabular-nums ${saldoCor}`}>{brl(r.saldoPorConvidado)}{r.margemPct != null ? <span className="ml-1 text-sm">({fmtQ(r.margemPct)}%)</span> : null}</p></div>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-hf-muted">
              {r.natureza}: custos das fichas técnicas{r.semCusto ? ` (${r.semCusto} item(ns) sem custo na ficha, conta incompleta)` : ""}. Mesa montada não cresce com os convidados: o custo só se divide. Ainda sem imposto, maquininha e meta — isso entra na precificação.
            </p>
          </div>

          <button type="button" onClick={continuar} disabled={criando || !temItens || !(r.convidados > 0)}
            className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-hf-accent text-sm font-black text-hf-accent-fg disabled:opacity-50">
            {criando ? <Loader2 size={16} className="animate-spin" /> : null} Continuar para precificação <ArrowRight size={16} />
          </button>
          {!temItens && <p className="mt-2 text-center text-xs text-hf-muted">Marque pelo menos um prato ou bebida.</p>}
        </section>
      </aside>

      {/* Celular: total sempre à vista */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-hf-border bg-hf-surface/95 px-4 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur lg:hidden">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1 leading-tight"><p className="text-xs text-hf-text-2">Custo por convidado</p><p className="text-lg font-black tabular-nums text-hf-text">{brl(r.custoPorConvidado)} <span className="text-xs font-semibold text-hf-muted">· total {brl(r.custoTotal)}</span></p></div>
          <button type="button" onClick={continuar} disabled={criando || !temItens || !(r.convidados > 0)} className="flex h-11 items-center gap-1 rounded-full bg-hf-accent px-4 text-sm font-black text-hf-accent-fg disabled:opacity-50">Precificar <ArrowRight size={15} /></button>
        </div>
      </div>
    </div>
  );
}
