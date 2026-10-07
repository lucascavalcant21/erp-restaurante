"use client";

// ENTRADA E RETIRADA DE ESTOQUE (EST-MOV-1).
// Pesquisar → selecionar → quantidade (embalagens + fração) → motivo →
// confirmar. Cada lançamento vai para o histórico pelo banco (que confere quem
// é, a permissão, o saldo e não deixa gravar duas vezes). Depois de confirmado
// não se edita nem se apaga: correção só por ESTORNO do administrador, com PIN.

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useERP } from "../../../../context/ERPContext";
import {
  fetchBaseMovimento, fetchUltimosMovimentos, lancarMovimento, estornarLancamento, lerSeguranca, MSG_BANCO_DESATUALIZADO,
} from "../../../../lib/estoque-movimento-dados";
import {
  MOTIVOS, rotuloMotivo, quantidadeDoLancamento, unidadesDaFracao, embalagemDoProduto, produtosParaLancar, saldoDepois,
  podeEstornar, novaChave, unidadeDoSaldo, ehEntradaDeCompra,
} from "../../../../lib/estoque-movimento.mjs";
import { unidadeValida } from "../../../../lib/contas-pagar.mjs";
import { hasPermission } from "../../../../lib/permissions-catalog.mjs";
import { fmtBRL } from "../../../../components/ui";
import EstoqueAbas from "../../../../components/navigation/EstoqueAbas";
import { useContextoInteligencia } from "../../../../components/intelligence/useContextoInteligencia";
import { ArrowLeft, Check, Minus, Plus, Search, X, AlertTriangle, Loader2, Lock, RotateCcw } from "lucide-react";

const fmtQ = (n) => Number(n || 0).toLocaleString("pt-BR", { maximumFractionDigits: 3 });
const un = (u) => (String(u || "").toLowerCase() === "l" ? "L" : (u || "un"));
const fmtHora = (d) => (d ? new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—");
const CHAVE_LOCAL = "hefisto:movimentar:estoque";
const FORM_VAZIO = { embalagens: "", fracao: "", unidadeFracao: "", motivo: "", validade: "", observacao: "", responsavel: "", justificativa: "", pin: "" };

export default function MovimentarPage() {
  return <Suspense fallback={<p className="p-8 text-center font-bold text-fg">Carregando...</p>}><MovimentarComParametros /></Suspense>;
}

// O Controle de Estoque abre esta aba já no local, no tipo e no produto:
// ?estoque=<id>&tipo=entrada|saida&insumo=<id>
function MovimentarComParametros() {
  const { unidadeAtiva, sessao } = useERP();
  const params = useSearchParams();
  if (!unidadeValida(unidadeAtiva)) return <p className="p-8 text-center font-bold text-fg">Selecione uma unidade para lançar no estoque.</p>;
  const inicial = { estoque: params.get("estoque") || "", tipo: params.get("tipo") === "saida" ? "saida" : "entrada", insumo: params.get("insumo") || "" };
  return <Movimentar key={`${unidadeAtiva}|${inicial.estoque}|${inicial.tipo}|${inicial.insumo}`} unidade={unidadeAtiva} sessao={sessao} inicial={inicial} />;
}

function Movimentar({ unidade, sessao, inicial = {} }) {
  const [base, setBase] = useState(null);
  const [seg, setSeg] = useState(null);
  const [segErro, setSegErro] = useState("");
  const [erro, setErro] = useState("");
  const [estoqueId, setEstoqueId] = useState("");
  const [tipo, setTipo] = useState(inicial.tipo || "entrada");
  const [busca, setBusca] = useState("");
  const [produto, setProduto] = useState(null);
  // Héfisto: "Perdi 2 kg." / "Quanto tenho?" entendem o produto selecionado
  useContextoInteligencia(produto ? { modulo: "estoque", tipo: "produto", id: produto.id, nome: produto.nome } : null);
  const [form, setForm] = useState(FORM_VAZIO);
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState(null);
  const [ultimos, setUltimos] = useState({ data: [], estornados: new Set() });
  const [estorno, setEstorno] = useState(null);
  const chave = useRef(novaChave());
  const buscaRef = useRef(null);
  const podeVerCusto = !sessao?.gerenciado || hasPermission(sessao, "estoque.products.view_costs") || hasPermission(sessao, "estoque.overview.view_costs");

  const carregarBase = useCallback(async () => {
    const b = await fetchBaseMovimento(unidade);
    setBase(b.data); setErro(b.error || "");
    if (b.data?.estoques?.length) {
      setEstoqueId((atual) => {
        if (atual && b.data.estoques.some((e) => e.id === atual)) return atual;
        let salvo = inicial.estoque || "";
        try { salvo = salvo || localStorage.getItem(`${CHAVE_LOCAL}:${unidade}`) || ""; } catch { /* sem armazenamento */ }
        return b.data.estoques.some((e) => e.id === salvo) ? salvo : b.data.estoques[0].id;
      });
    }
  }, [unidade]); // eslint-disable-line react-hooks/exhaustive-deps
  const carregarUltimos = useCallback(async () => {
    if (!estoqueId) return;
    const r = await fetchUltimosMovimentos(unidade, estoqueId);
    setUltimos({ data: r.data, estornados: r.estornados, desatualizado: r.desatualizado, error: r.error });
  }, [unidade, estoqueId]);

  useEffect(() => { carregarBase(); }, [carregarBase]);
  useEffect(() => { carregarUltimos(); }, [carregarUltimos]);
  useEffect(() => {
    lerSeguranca(unidade).then((r) => { setSeg(r.data); setSegErro(r.error || ""); });
  }, [unidade]);
  useEffect(() => {
    if (!estoqueId) return;
    try { localStorage.setItem(`${CHAVE_LOCAL}:${unidade}`, estoqueId); } catch { /* sem armazenamento */ }
  }, [unidade, estoqueId]);

  const insumoInicial = useRef(inicial.insumo || "");
  useEffect(() => {
    if (!insumoInicial.current || !base?.insumos) return;
    const ins = base.insumos.find((i) => i.id === insumoInicial.current);
    insumoInicial.current = "";
    if (ins) escolher(ins);
  }, [base]); // eslint-disable-line react-hooks/exhaustive-deps

  const estoque = base?.estoques?.find((e) => e.id === estoqueId);
  const saldoAtual = produto ? (Number(base?.itens?.find((i) => i.estoque_id === estoqueId && i.insumo_id === produto.id)?.quantidade_atual) || 0) : 0;
  const resultados = useMemo(() => (base && estoqueId && !produto)
    ? produtosParaLancar({ insumos: base.insumos, itens: base.itens, estoqueId, tipo, termo: busca }) : [],
  [base, estoqueId, tipo, busca, produto]);

  const embalagem = produto ? embalagemDoProduto(produto) : null;
  const unidadesFrac = produto ? unidadesDaFracao(produto) : [];
  const unSaldo = produto ? unidadeDoSaldo(produto) : "";
  const lanc = produto && (form.embalagens !== "" || form.fracao !== "")
    ? quantidadeDoLancamento({ insumo: produto, embalagens: form.embalagens, fracao: form.fracao, unidadeFracao: form.unidadeFracao || unidadesFrac[0] })
    : null;
  const depois = lanc && !lanc.erro ? saldoDepois(saldoAtual, tipo, lanc.quantidadeSaldo) : null;
  const motivoSel = MOTIVOS[tipo].find((m) => m.codigo === form.motivo);
  const semPermissao = seg && (tipo === "entrada" ? !seg.pode_entrada : !seg.pode_retirada) && !motivoSel?.admin;
  const bancoAntigo = /EST-MOV/.test(segErro);
  const pronto = produto && lanc && !lanc.erro && motivoSel && !(depois < 0)
    && (!motivoSel.admin || (form.justificativa.trim().length >= 3 && /^\d{4,8}$/.test(form.pin)));

  const escolher = (ins) => {
    setProduto(ins);
    const emb = embalagemDoProduto(ins);
    const unidades = unidadesDaFracao(ins);
    // com embalagem, a fração costuma ser a unidade menor (g/ml); sem, a do cadastro
    setForm({ ...FORM_VAZIO, motivo: form.motivo && MOTIVOS[tipo].some((m) => m.codigo === form.motivo && !m.admin) ? form.motivo : "",
      unidadeFracao: emb && unidades.length > 1 ? unidades[1] : unidades[0] });
    chave.current = novaChave();
    setAviso(null);
  };
  const trocarTipo = (t) => { setTipo(t); setForm((f) => ({ ...f, motivo: "", justificativa: "", pin: "" })); setAviso(null); };
  const limpar = () => { setProduto(null); setForm(FORM_VAZIO); setBusca(""); chave.current = novaChave(); setTimeout(() => buscaRef.current?.focus(), 50); };

  const confirmar = async () => {
    if (!pronto || enviando) return;
    setEnviando(true); setAviso(null);
    const r = await lancarMovimento({
      unidade_id: unidade, estoque_id: estoqueId, insumo_id: produto.id, tipo, motivo: form.motivo, lancamento: lanc,
      validade: form.validade || null, observacao: form.observacao, responsavel_nome: form.responsavel,
      chave: chave.current, pin: form.pin, justificativa: form.justificativa,
    });
    setEnviando(false);
    if (r.error) {
      setAviso({ tipo: "erro", texto: r.error });
      if (r.pin) setForm((f) => ({ ...f, pin: "" }));
      return;
    }
    setAviso({ tipo: "ok", texto: `${tipo === "entrada" ? "ENTRADA" : "RETIRADA"} de ${lanc.texto} de ${produto.nome} registrada. Saldo neste local: ${fmtQ(r.data.saldo_posterior)} ${unSaldo}.` });
    limpar();
    await Promise.all([carregarBase(), carregarUltimos()]);
  };

  if (!base && !erro) return <p className="p-8 text-center font-bold text-fg">Carregando...</p>;

  return (
    <div className="min-h-screen pb-28 bg-[var(--surface)] text-slate-800">
      <EstoqueAbas />
      <div className="bg-slate-900 text-white px-4 pt-5 pb-4">
        <div className="max-w-xl mx-auto">
          <h1 className="text-2xl font-black tracking-tight">Entrada e retirada</h1>
          <p className="text-xs text-slate-300 mt-1">Cada lançamento fica no histórico. Não se edita nem se apaga: correção só por estorno do administrador.</p>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {(base?.estoques || []).map((e) => (
              <button key={e.id} onClick={() => { setEstoqueId(e.id); setProduto(null); setAviso(null); }}
                className={`shrink-0 h-10 px-3 rounded-xl text-sm font-black border ${estoqueId === e.id ? "bg-white text-slate-900 border-white" : "border-slate-600 text-white"}`}>{e.nome}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-xl mx-auto px-3 mt-3 space-y-3">
        {erro && <p className="text-sm font-bold text-red-700">Não foi possível carregar: {erro}</p>}
        {bancoAntigo && <p className="rounded-2xl border border-amber-300 bg-amber-50 p-3 text-sm font-bold text-amber-900">{MSG_BANCO_DESATUALIZADO}</p>}
        {aviso && (
          <div className={`rounded-2xl border p-3 text-sm font-bold flex gap-2 ${aviso.tipo === "ok" ? "border-emerald-300 bg-emerald-50 text-emerald-900" : "border-red-300 bg-red-50 text-red-800"}`}>
            {aviso.tipo === "ok" ? <Check size={18} className="shrink-0" /> : <AlertTriangle size={18} className="shrink-0" />}
            <span>{aviso.texto}</span>
          </div>
        )}

        {/* ENTRADA / RETIRADA */}
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => trocarTipo("entrada")} className={`h-14 rounded-2xl font-black text-base flex items-center justify-center gap-2 border-2 ${tipo === "entrada" ? "bg-emerald-500 text-white border-emerald-500" : "bg-white border-line"}`}>
            <Plus size={20} /> ENTRADA
          </button>
          <button onClick={() => trocarTipo("saida")} className={`h-14 rounded-2xl font-black text-base flex items-center justify-center gap-2 border-2 ${tipo === "saida" ? "bg-rose-600 text-white border-rose-600" : "bg-white border-line"}`}>
            <Minus size={20} /> RETIRADA
          </button>
        </div>

        {/* 1. pesquisar e selecionar */}
        {!produto && (
          <div className="bg-card rounded-2xl border border-line p-2">
            <div className="flex items-center gap-2 px-2">
              <Search size={18} className="text-fg shrink-0" />
              <input ref={buscaRef} value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Pesquisar produto, código, marca ou fornecedor"
                className="flex-1 h-12 bg-transparent font-bold outline-none text-base" />
              {busca && <button onClick={() => setBusca("")} aria-label="Limpar"><X size={18} /></button>}
            </div>
            <ul className="divide-y divide-line">
              {!resultados.length && <li className="p-4 text-sm text-fg text-center">{tipo === "saida" ? "Nenhum produto deste local com esse nome." : busca ? "Nenhum produto no cadastro com esse nome." : "Pesquise o produto (o cadastro inteiro aparece na busca)."}</li>}
              {resultados.map((p) => {
                const emb = embalagemDoProduto(p.insumo);
                return (
                  <li key={p.insumo.id}>
                    <button onClick={() => escolher(p.insumo)} className="w-full text-left p-3 flex justify-between gap-3 hover:bg-white">
                      <div className="min-w-0">
                        <p className="font-black leading-tight">{p.insumo.nome}{p.insumo.marca ? <span className="font-bold text-fg"> · {p.insumo.marca}</span> : null}</p>
                        <p className="text-xs text-fg truncate">
                          {[p.insumo.fornecedor && `Fornecedor: ${p.insumo.fornecedor}`, emb?.texto, podeVerCusto && Number(p.insumo.custo_compra) > 0 && `${fmtBRL(p.insumo.custo_compra)} a embalagem`].filter(Boolean).join(" · ") || "sem fornecedor/embalagem no cadastro"}
                        </p>
                        {!p.vinculado && <p className="text-3xs font-black uppercase text-amber-700">ainda não está neste local</p>}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-3xs uppercase font-bold text-fg">saldo aqui</p>
                        <p className={`font-black ${p.saldo > 0 ? "" : "text-fg"}`}>{fmtQ(p.saldo)} {unidadeDoSaldo(p.insumo)}</p>
                      </div>
                    </button>
                  </li>);
              })}
            </ul>
          </div>
        )}

        {/* 2. quantidade, motivo, confirmar */}
        {produto && (
          <div className="bg-card rounded-2xl border border-line p-4 space-y-3">
            <div className="flex justify-between gap-2">
              <div className="min-w-0">
                <p className="text-3xs font-black uppercase text-fg">{estoque?.nome}</p>
                <p className="font-black text-lg leading-tight">{produto.nome}</p>
                <p className="text-xs text-fg">
                  {[produto.fornecedor && `Fornecedor: ${produto.fornecedor}`, embalagem?.texto, podeVerCusto && base?.custosMedios?.[produto.id] != null && `custo médio ${fmtBRL(base.custosMedios[produto.id] * (["kg", "l"].includes(String(produto.unidade_medida).toLowerCase()) ? 1000 : 1))}/${un(produto.unidade_medida)}`].filter(Boolean).join(" · ")}
                </p>
                <p className="text-xs font-bold mt-1">Saldo neste local: {fmtQ(saldoAtual)} {unSaldo}</p>
              </div>
              <button onClick={limpar} className="self-start h-9 px-3 rounded-xl bg-slate-100 text-xs font-black">Trocar</button>
            </div>

            <div className={`grid gap-2 ${embalagem ? "grid-cols-2" : "grid-cols-1"}`}>
              {embalagem && (
                <label className="block">
                  <span className="text-3xs font-black uppercase text-fg">Embalagens ({embalagem.texto})</span>
                  <input inputMode="numeric" value={form.embalagens} onChange={(e) => setForm({ ...form, embalagens: e.target.value })} placeholder="0"
                    className="mt-1 w-full h-14 px-3 rounded-xl border border-line bg-white font-black text-xl" />
                </label>
              )}
              <label className="block">
                <span className="text-3xs font-black uppercase text-fg">{embalagem ? "Mais (fração)" : "Quantidade"}</span>
                <div className="mt-1 flex gap-1">
                  <input inputMode="decimal" value={form.fracao} onChange={(e) => setForm({ ...form, fracao: e.target.value })} placeholder="0"
                    className="flex-1 min-w-0 h-14 px-3 rounded-xl border border-line bg-white font-black text-xl" />
                  {unidadesFrac.length > 1
                    ? <select value={form.unidadeFracao} onChange={(e) => setForm({ ...form, unidadeFracao: e.target.value })} className="h-14 px-2 rounded-xl border border-line bg-white font-black">
                        {unidadesFrac.map((u) => <option key={u} value={u}>{u}</option>)}
                      </select>
                    : <span className="h-14 px-3 rounded-xl bg-slate-100 font-black flex items-center">{unidadesFrac[0]}</span>}
                </div>
              </label>
            </div>
            {lanc && (lanc.erro
              ? <p className="text-sm font-bold text-red-700">{lanc.erro}</p>
              : <p className="text-sm font-black">{lanc.texto} <span className="font-bold text-fg">· saldo depois: <span className={depois < 0 ? "text-red-700" : ""}>{fmtQ(depois)} {unSaldo}</span></span></p>)}
            {depois < 0 && <p className="text-sm font-bold text-red-700">Retirada maior que o saldo deste local. Confira a quantidade ou o local.</p>}

            <div>
              <p className="text-3xs font-black uppercase text-fg">Motivo da {tipo === "entrada" ? "entrada" : "retirada"}</p>
              <div className="mt-1 flex flex-wrap gap-2">
                {MOTIVOS[tipo].filter((m) => !m.pelaCompra && (!m.admin || seg?.pode_autorizar)).map((m) => (
                  <button key={m.codigo} onClick={() => setForm({ ...form, motivo: m.codigo })}
                    className={`h-10 px-3 rounded-xl text-sm font-black border ${form.motivo === m.codigo ? "bg-slate-900 text-white border-slate-900" : "bg-white border-line"}`}>
                    {m.admin && <Lock size={12} className="inline mr-1" />}{m.rotulo}
                  </button>
                ))}
              </div>
            </div>

            {tipo === "entrada" && (
              <p className="text-xs text-fg">Chegou mercadoria comprada? Lance em <a href="/dashboard/operacao/estoque/compras?aba=nova" className="font-black underline">Compras</a>: ao confirmar, a entrada no estoque, o custo médio e a conta a pagar saem juntos.</p>
            )}
            {tipo === "entrada" && (
              <label className="block">
                <span className="text-3xs font-black uppercase text-fg">Validade (opcional)</span>
                <input type="date" value={form.validade} onChange={(e) => setForm({ ...form, validade: e.target.value })} className="mt-1 w-full h-12 px-3 rounded-xl border border-line bg-white font-bold" />
              </label>
            )}

            {motivoSel?.admin && (
              <div className="rounded-2xl border border-amber-300 bg-amber-50 p-3 space-y-2">
                <p className="text-xs font-black text-amber-900 flex items-center gap-1"><Lock size={14} /> Ajuste autorizado: motivo e PIN do administrador</p>
                <input value={form.justificativa} onChange={(e) => setForm({ ...form, justificativa: e.target.value })} placeholder="Por que este ajuste?" className="w-full h-12 px-3 rounded-xl border border-line bg-white font-bold" />
                <input type="password" inputMode="numeric" autoComplete="off" value={form.pin} onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/\D/g, "").slice(0, 8) })} placeholder="PIN" className="w-full h-12 px-3 rounded-xl border border-line bg-white font-black tracking-widest" />
              </div>
            )}

            <details className="text-sm">
              <summary className="font-bold text-fg cursor-pointer">Observação / responsável (opcional)</summary>
              <div className="mt-2 space-y-2">
                <input value={form.observacao} onChange={(e) => setForm({ ...form, observacao: e.target.value })} placeholder="Observação" className="w-full h-11 px-3 rounded-xl border border-line bg-white font-bold" />
                <input value={form.responsavel} onChange={(e) => setForm({ ...form, responsavel: e.target.value })} placeholder="Quem está lançando (aparelho compartilhado)" className="w-full h-11 px-3 rounded-xl border border-line bg-white font-bold" />
              </div>
            </details>

            {semPermissao && <p className="text-sm font-bold text-red-700">Seu perfil não tem permissão para lançar {tipo === "entrada" ? "entrada" : "retirada"} neste estoque. Peça ao administrador.</p>}
            <button onClick={confirmar} disabled={!pronto || enviando || semPermissao || bancoAntigo}
              className={`w-full h-14 rounded-2xl font-black text-base text-white flex items-center justify-center gap-2 disabled:opacity-40 ${tipo === "entrada" ? "bg-emerald-500" : "bg-rose-600"}`}>
              {enviando ? <><Loader2 size={18} className="animate-spin" /> Gravando...</>
                : <><Check size={20} /> Confirmar {tipo === "entrada" ? "ENTRADA" : "RETIRADA"}{lanc && !lanc.erro ? ` · ${fmtQ(lanc.quantidadeSaldo)} ${unSaldo}` : ""}</>}
            </button>
            {!motivoSel && lanc && !lanc.erro && <p className="text-xs text-fg text-center">Escolha o motivo para confirmar.</p>}
          </div>
        )}

        {/* últimos lançados */}
        <div className="bg-card rounded-2xl border border-line overflow-hidden">
          <p className="font-black text-sm uppercase tracking-wider p-3 pb-1">Últimos lançados · {estoque?.nome || ""}</p>
          <p className="text-3xs text-fg px-3">Sem edição. Para corrigir, o administrador faz o estorno (o lançamento original continua aqui).</p>
          {ultimos.error && <p className="p-3 text-sm text-red-700">{ultimos.error}</p>}
          <ul className="divide-y divide-line mt-2">
            {!ultimos.data.length && <li className="p-4 text-sm text-fg text-center">Nenhum lançamento neste local ainda.</li>}
            {ultimos.data.map((m) => {
              const entra = m.tipo === "entrada" || m.tipo === "transferencia_entrada" || (m.tipo === "contagem" && Number(m.quantidade) >= 0);
              const estornado = ultimos.estornados.has(m.id);
              return (
                <li key={m.id} className={`p-3 flex justify-between gap-2 ${estornado ? "opacity-60" : ""}`}>
                  <div className="min-w-0">
                    <p className="font-black leading-tight">
                      <span className={entra ? "text-emerald-700" : "text-rose-700"}>{entra ? "+" : "−"}{fmtQ(Math.abs(Number(m.quantidade)))} {m.unidade_medida ? un(m.unidade_medida) : unidadeDoSaldo(m.insumo)}</span> {m.insumo?.nome || "—"}
                    </p>
                    <p className="text-xs text-fg">
                      {[rotuloMotivo(m.motivo) || (m.tipo.startsWith("transferencia") ? "Transferência" : m.tipo === "contagem" ? "Contagem antiga" : null),
                        m.usuario_nome, m.responsavel_nome && `por ${m.responsavel_nome}`, fmtHora(m.created_at)].filter(Boolean).join(" · ")}
                    </p>
                    {m.motivo === "estorno" && <p className="text-3xs font-bold text-fg">Estorno autorizado por {m.autorizado_por_nome}: {m.justificativa}</p>}
                    {m.motivo === "ajuste_autorizado" && <p className="text-3xs font-bold text-fg">Autorizado por {m.autorizado_por_nome}: {m.justificativa}</p>}
                    {ehEntradaDeCompra(m) && !estornado && <p className="text-3xs font-bold text-fg">{m.observacao}. Para desfazer, cancele a compra em Compras.</p>}
                    {estornado && <p className="text-3xs font-black uppercase text-rose-700">Estornado</p>}
                  </div>
                  {seg?.pode_autorizar && !ultimos.desatualizado && podeEstornar(m, ultimos.estornados) && (
                    <button onClick={() => setEstorno({ mov: m, justificativa: "", pin: "", chave: novaChave(), erro: "" })}
                      className="self-start h-9 px-2 rounded-xl bg-slate-100 text-xs font-black flex items-center gap-1"><RotateCcw size={14} /> Estornar</button>
                  )}
                </li>);
            })}
          </ul>
        </div>
      </div>

      {estorno && <ModalEstorno estorno={estorno} setEstorno={setEstorno} onFeito={async (texto) => { setEstorno(null); setAviso({ tipo: "ok", texto }); await Promise.all([carregarBase(), carregarUltimos()]); }} />}
    </div>
  );
}

function ModalEstorno({ estorno, setEstorno, onFeito }) {
  const [enviando, setEnviando] = useState(false);
  const m = estorno.mov;
  const entra = m.tipo === "entrada";
  const unidade = m.unidade_medida ? un(m.unidade_medida) : unidadeDoSaldo(m.insumo);
  const enviar = async (e) => {
    e.preventDefault();
    if (enviando) return;
    setEnviando(true);
    const r = await estornarLancamento({ movimento_id: m.id, justificativa: estorno.justificativa, pin: estorno.pin, chave: estorno.chave });
    setEnviando(false);
    if (r.error) return setEstorno({ ...estorno, erro: r.error, pin: r.pin ? "" : estorno.pin });
    onFeito(`Estorno feito: ${entra ? "saíram" : "voltaram"} ${fmtQ(m.quantidade)} ${unidade} de ${m.insumo?.nome || "produto"}. O lançamento original continua no histórico.`);
  };
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-end sm:items-center justify-center sm:p-4">
      <form onSubmit={enviar} className="bg-card w-full max-w-md rounded-t-3xl sm:rounded-3xl p-5 space-y-3">
        <div className="flex justify-between"><h3 className="font-black text-lg flex items-center gap-2"><RotateCcw size={18} /> Estornar lançamento</h3><button type="button" onClick={() => setEstorno(null)} aria-label="Fechar"><X size={20} /></button></div>
        <div className="rounded-2xl bg-slate-50 p-3 text-sm">
          <p className="font-black">{entra ? "ENTRADA" : "RETIRADA"} de {fmtQ(m.quantidade)} {unidade} · {m.insumo?.nome}</p>
          <p className="text-xs text-fg">{[rotuloMotivo(m.motivo), m.usuario_nome, fmtHora(m.created_at)].filter(Boolean).join(" · ")}</p>
          <p className="text-xs mt-1">O estorno lança o movimento contrário ({entra ? "retira" : "devolve"} {fmtQ(m.quantidade)} {unidade}). Nada é apagado.</p>
        </div>
        <input required value={estorno.justificativa} onChange={(e) => setEstorno({ ...estorno, justificativa: e.target.value })} placeholder="Motivo do estorno" className="w-full h-12 px-3 rounded-xl border border-line bg-white font-bold" />
        <input required type="password" inputMode="numeric" autoComplete="off" value={estorno.pin} onChange={(e) => setEstorno({ ...estorno, pin: e.target.value.replace(/\D/g, "").slice(0, 8) })} placeholder="PIN do administrador" className="w-full h-12 px-3 rounded-xl border border-line bg-white font-black tracking-widest" />
        {estorno.erro && <p className="text-sm font-bold text-red-700">{estorno.erro}</p>}
        <button disabled={enviando} className="w-full h-12 bg-slate-900 text-white font-black rounded-2xl disabled:opacity-60 flex items-center justify-center gap-2">
          {enviando ? <><Loader2 size={18} className="animate-spin" /> Estornando...</> : "Confirmar estorno"}
        </button>
      </form>
    </div>
  );
}
