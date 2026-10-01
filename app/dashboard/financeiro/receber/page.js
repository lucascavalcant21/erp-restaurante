"use client";

// CONTAS A RECEBER — F2.3 (arquitetura F2.1).
// Receita = BRUTO (data da venda). Dinheiro = LÍQUIDO (data do recebimento).
// Leitura: vw_fin_contas_receber. Escrita: contas-receber.mjs + RPCs.
// Abrir a tela é só leitura.

import { useState, useEffect, useMemo, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useERP } from "../../../context/ERPContext";
import {
  fetchContasReceber, fetchRecebimentosDaConta, fetchRecebimentosPeriodo, fetchTaxasMeioPagamento,
  fetchSaldosContasFinanceiras, usuarioAtualId, salvarContaReceber, receberConta, estornarRecebimentoConta, cancelarRecebivel,
} from "../../../lib/financeiro";
import {
  MEIOS, MEIOS_CARTAO, MODALIDADES, ORIGENS, ROTULO_SITUACAO_RECEBER, rotuloMeio, rotuloModalidade,
  escolherTaxa, calcularTaxa, resumoReceber, podeReceber, podeCancelarReceber, hojeLocal, novaChave, somarDias,
} from "../../../lib/contas-receber.mjs";
import { intervaloPeriodo, unidadeValida, lerValor } from "../../../lib/contas-pagar.mjs";
import ModalRecebimentoConta from "../../../components/ModalRecebimentoConta";
import { Plus, Search, X, Ban, Pencil, Eye, Wallet, AlertTriangle, ArrowDownCircle, Receipt } from "lucide-react";
import { fmtBRL } from "../../../components/ui";

const COR = {
  previsto: "bg-slate-100 text-slate-900", parcial: "bg-blue-100 text-blue-800", recebido: "bg-emerald-100 text-emerald-800",
  atrasado: "bg-red-100 text-red-800", cancelado: "bg-stone-200 text-stone-700",
};
const fmtData = (d) => (d ? new Date(`${String(d).slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR") : "—");
const fmtHora = (d) => (d ? new Date(d).toLocaleString("pt-BR") : "—");
const formVazio = () => ({
  descricao: "", meio: "pix", valor_bruto: "", data_venda: hojeLocal(), data_prevista: hojeLocal(),
  adquirente: "", bandeira: "", modalidade: "a_vista", parcelas_venda: 1, recebiveis: 1,
  modo_taxa: "nao_informada", valor_taxa: "", conta_financeira_prevista_id: "", nsu: "", autorizacao: "", observacao: "",
});

export default function ContasAReceberPage() {
  const { unidadeAtiva } = useERP();
  const unidadeOk = unidadeValida(unidadeAtiva);
  const params = useSearchParams();

  const [contas, setContas] = useState([]);
  const [taxas, setTaxas] = useState([]);
  const [contasFin, setContasFin] = useState([]);
  const [recPeriodo, setRecPeriodo] = useState([]);
  const [eu, setEu] = useState(null);
  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(true);

  const SITUACOES = ["previsto", "parcial", "recebido", "atrasado", "cancelado"];
  const [periodoTipo, setPeriodoTipo] = useState(() => (["hoje", "semana", "mes"].includes(params?.get("periodo")) ? params.get("periodo") : "mes"));
  const [dataRef, setDataRef] = useState("prevista");
  const [custom, setCustom] = useState({ de: "", ate: "" });
  const [fSituacao, setFSituacao] = useState(() => (SITUACOES.includes(params?.get("situacao")) ? params.get("situacao") : ""));
  const [fMeio, setFMeio] = useState("");
  const [busca, setBusca] = useState("");

  const [form, setForm] = useState(null);
  const [receber, setReceber] = useState(null);
  const [detalhe, setDetalhe] = useState(null);
  const [motivo, setMotivo] = useState(null);

  const [processando, setProcessando] = useState(false);
  const emAndamento = useRef(false);
  const executar = async (fn) => {
    if (emAndamento.current) return;
    emAndamento.current = true; setProcessando(true);
    try { await fn(); } finally { emAndamento.current = false; setProcessando(false); }
  };

  const hoje = hojeLocal();
  const periodo = periodoTipo === "todos" ? null : intervaloPeriodo(periodoTipo, hoje, custom);

  const carregar = async (silencioso = false) => {
    if (!unidadeOk) { setContas([]); setLoading(false); return; }
    if (!silencioso) setLoading(true);
    const [c, t, f, u] = await Promise.all([fetchContasReceber(unidadeAtiva), fetchTaxasMeioPagamento(unidadeAtiva), fetchSaldosContasFinanceiras(unidadeAtiva), usuarioAtualId()]);
    setContas(c.data || []); setTaxas(t.data || []); setContasFin((f.data || []).filter((x) => x.ativa));
    setErro(c.error || t.error || f.error || ""); setEu(u); setLoading(false);
  };
  useEffect(() => { carregar(); }, [unidadeAtiva]);
  useEffect(() => {
    if (!unidadeOk || !periodo) { setRecPeriodo([]); return; }
    fetchRecebimentosPeriodo(unidadeAtiva, periodo.de, periodo.ate).then((r) => setRecPeriodo(r.data || []));
  }, [unidadeAtiva, periodoTipo, custom.de, custom.ate, contas]);

  const nomeConta = (id) => contasFin.find((c) => c.id === id)?.nome || null;
  const quem = (uid) => (!uid ? "não registrado" : uid === eu ? "você" : `outro usuário (${String(uid).slice(0, 8)})`);

  const filtradas = useMemo(() => contas.filter((c) => {
    if (periodo) {
      const d = dataRef === "prevista" ? c.data_prevista : c.data_venda;
      if (d < periodo.de || d > periodo.ate) return false;
    }
    if (fSituacao && c.situacao !== fSituacao) return false;
    if (fMeio && c.meio !== fMeio) return false;
    if (busca.trim() && !`${c.descricao} ${c.adquirente || ""} ${c.nsu || ""}`.toLowerCase().includes(busca.trim().toLowerCase())) return false;
    return true;
  }), [contas, periodoTipo, dataRef, custom, fSituacao, fMeio, busca]);

  const resumo = useMemo(() => resumoReceber(contas, recPeriodo, periodo), [contas, recPeriodo, periodoTipo, custom]);

  // ── formulário ───────────────────────────────────────────────────────────
  const regraForm = form && !form.id && form.modo_taxa === "regra"
    ? escolherTaxa(taxas, { meio: form.meio, adquirente: form.adquirente, bandeira: form.bandeira, modalidade: form.modalidade, parcelas: Number(form.parcelas_venda) || 1, data: form.data_venda })
    : null;
  const brutoForm = lerValor(form?.valor_bruto);
  const taxaForm = !form ? null : form.modo_taxa === "regra" ? calcularTaxa(regraForm, Number.isFinite(brutoForm) ? brutoForm : 0)
    : form.modo_taxa === "informada" && form.valor_taxa !== "" ? lerValor(form.valor_taxa) : null;

  function abrirNova() { setForm({ ...formVazio(), chave: novaChave() }); }
  function abrirEdicao(c) {
    setForm({
      id: c.id, contaAtual: c, descricao: c.descricao || "", meio: c.meio, valor_bruto: String(c.valor_bruto).replace(".", ","),
      data_venda: String(c.data_venda).slice(0, 10), data_prevista: String(c.data_prevista).slice(0, 10),
      adquirente: c.adquirente || "", bandeira: c.bandeira || "", modalidade: c.modalidade, nsu: c.nsu || "", autorizacao: c.autorizacao || "",
      valor_taxa_previsto: c.valor_taxa_previsto == null ? "" : String(c.valor_taxa_previsto).replace(".", ","),
      conta_financeira_prevista_id: c.conta_financeira_prevista_id || "", observacao: c.observacao || "",
    });
  }
  const salvar = (e) => {
    e.preventDefault();
    executar(async () => {
      const { chave, contaAtual, ...dados } = form;
      const r = form.id
        ? await salvarContaReceber({ ...dados, unidade_id: unidadeAtiva, contaAtual })
        : await salvarContaReceber({ ...dados, unidade_id: unidadeAtiva }, { chave, regras: taxas });
      if (r.error) return alert(`Não foi possível salvar: ${r.error}`);
      setForm(null);
      await carregar(true);
      alert(form.id ? (r.data?.alterados?.length ? "Conta atualizada." : "Nada foi alterado.")
        : r.idempotente ? "Já tinha sido lançada (nada foi duplicado)." : "Conta a receber lançada.");
    });
  };

  async function abrirDetalhe(c) {
    setDetalhe({ conta: c, recebimentos: [], carregando: true });
    const r = await fetchRecebimentosDaConta(c.id);
    setDetalhe({ conta: c, recebimentos: r.data, erro: r.error, carregando: false });
  }
  async function recarregarDetalhe(id) {
    const c = await fetchContasReceber(unidadeAtiva);
    setContas(c.data || []);
    const atual = (c.data || []).find((x) => x.id === id);
    if (atual && detalhe) await abrirDetalhe(atual);
  }
  const confirmarRecebimento = (dados) => executar(async () => {
    const r = await receberConta(dados);
    if (r.error) return alert(`Não foi possível registrar: ${r.error}`);
    const id = receber.id;
    setReceber(null);
    if (detalhe) await recarregarDetalhe(id); else await carregar(true);
    alert(r.data.idempotente ? "Este recebimento já tinha sido registrado (nada foi duplicado)." : `Recebimento registrado. Situação: ${ROTULO_SITUACAO_RECEBER[r.data.status] || r.data.status}.`);
  });
  const confirmarMotivo = (e) => {
    e.preventDefault();
    executar(async () => {
      const r = motivo.tipo === "estorno"
        ? await estornarRecebimentoConta(motivo.alvo, motivo.texto)
        : await cancelarRecebivel(motivo.alvo, unidadeAtiva, motivo.texto);
      if (r.error) return alert(`Não foi possível ${motivo.tipo === "estorno" ? "estornar" : "cancelar"}: ${r.error}`);
      const contaId = motivo.tipo === "estorno" ? detalhe?.conta?.id : motivo.alvo;
      setMotivo(null);
      if (detalhe && contaId) await recarregarDetalhe(contaId); else await carregar(true);
      alert(motivo.tipo === "estorno" ? "Recebimento estornado. O histórico continua visível." : "Conta cancelada. Ela continua no histórico.");
    });
  };

  if (!unidadeOk) return <div className="p-8 text-center font-bold text-fg">Selecione uma unidade para ver as contas a receber.</div>;

  const sel = "w-full p-2.5 bg-white border border-line rounded-2xl text-xs font-bold text-slate-800 outline-none focus:border-emerald-500";
  const campo = "w-full p-2.5 bg-white border border-line rounded-xl font-bold text-slate-800 text-sm";
  const cartao = form && MEIOS_CARTAO.includes(form.meio);

  return (
    <div className="min-h-screen pb-24 font-sans text-slate-800 bg-[var(--surface)]">
      <div className="bg-slate-900 pt-6 pb-6 px-4 sm:px-8 text-white">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-4xl font-black tracking-tighter">Contas a Receber</h1>
            <p className="text-subtle font-bold uppercase tracking-widest text-3xs sm:text-xs mt-1">Receita bruta · taxas · dinheiro que entrou</p>
          </div>
          <button onClick={abrirNova} disabled={processando} className="px-4 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-black rounded-2xl flex items-center gap-2 disabled:opacity-60 text-sm">
            <Plus size={18} /> <span className="hidden sm:inline">Nova receita</span><span className="sm:hidden">Nova</span>
          </button>
        </div>
        <div className="max-w-7xl mx-auto mt-5 grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
          {[
            { r: "A receber (bruto)", v: resumo.aReceberBruto, I: ArrowDownCircle, c: "text-sky-300",
              nota: resumo.aReceberLiquido == null ? "Líquido: há taxa não informada" : `Líquido previsto ${fmtBRL(resumo.aReceberLiquido)}` },
            { r: "Atrasado", v: resumo.atrasado, I: AlertTriangle, c: "text-red-400", nota: "Previsão já passou" },
            { r: "Recebido no período (líquido)", v: resumo.recebidoLiquido, I: Wallet, c: "text-emerald-400",
              nota: periodo ? `Bruto baixado ${fmtBRL(resumo.recebidoBruto)} · taxas ${fmtBRL(resumo.taxasEfetivas)}` : "Escolha um período" },
            { r: "Receita lançada no período", v: resumo.receitaCompetencia, I: Receipt, c: "text-amber-300",
              nota: "Bruto pela data da venda · só o que foi lançado aqui (não é faturamento total)" },
          ].map(({ r, v, I, c, nota }) => (
            <div key={r} className="bg-slate-800/80 p-3 sm:p-4 rounded-2xl border border-slate-700/50">
              <div className="flex items-center gap-1.5 text-slate-300"><I size={14} /><p className="text-3xs uppercase font-bold tracking-wider">{r}</p></div>
              <p className={`text-lg sm:text-2xl font-black mt-1 ${c}`}>{v == null ? "—" : fmtBRL(v)}</p>
              <p className="text-3xs text-slate-400 mt-0.5 leading-snug">{nota}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-3 sm:px-6 mt-4 space-y-3">
        {erro && <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-800">Não foi possível carregar: {erro}</div>}
        <div className="bg-card rounded-3xl p-3 sm:p-5 border border-line shadow-sm space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
            <select value={periodoTipo} onChange={(e) => setPeriodoTipo(e.target.value)} className={sel}>
              <option value="todos">Todo o período</option><option value="hoje">Hoje</option><option value="semana">Esta semana</option>
              <option value="mes">Este mês</option><option value="personalizado">Personalizado</option>
            </select>
            <select value={dataRef} onChange={(e) => setDataRef(e.target.value)} className={sel}>
              <option value="prevista">Por previsão</option><option value="venda">Por data da venda</option>
            </select>
            {periodoTipo === "personalizado" && <>
              <input type="date" value={custom.de} onChange={(e) => setCustom({ ...custom, de: e.target.value })} className={sel} />
              <input type="date" value={custom.ate} onChange={(e) => setCustom({ ...custom, ate: e.target.value })} className={sel} />
            </>}
            <select value={fSituacao} onChange={(e) => setFSituacao(e.target.value)} className={sel}>
              <option value="">Todas as situações</option>
              {SITUACOES.map((s) => <option key={s} value={s}>{ROTULO_SITUACAO_RECEBER[s]}</option>)}
            </select>
            <select value={fMeio} onChange={(e) => setFMeio(e.target.value)} className={sel}>
              <option value="">Todas as formas</option>
              {MEIOS.map((m) => <option key={m.codigo} value={m.codigo}>{m.rotulo}</option>)}
            </select>
            <div className="relative col-span-2">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar descrição, adquirente, NSU" className={`${sel} pl-8`} />
            </div>
          </div>

          {loading ? <div className="py-10 text-center font-bold text-fg">Carregando...</div>
            : !filtradas.length ? (
              <div className="py-10 text-center space-y-1">
                <p className="font-bold text-slate-900">Nenhuma conta a receber para os filtros escolhidos.</p>
                {!contas.length && <p className="text-xs text-fg">As vendas do PDV/Saipos/iFood ainda não geram recebíveis automaticamente. Lance aqui receitas manuais (evento, aluguel, serviço, recebível não integrado).</p>}
              </div>
            ) : (
              <ul className="divide-y divide-line rounded-2xl border border-line overflow-hidden">
                {filtradas.map((c) => (
                  <li key={c.id} className="p-3 bg-card hover:bg-white flex flex-col sm:flex-row sm:items-center gap-2">
                    <button onClick={() => abrirDetalhe(c)} className="flex-1 min-w-0 text-left">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-full text-3xs font-black uppercase ${COR[c.situacao] || COR.previsto}`}>{ROTULO_SITUACAO_RECEBER[c.situacao] || c.situacao}</span>
                        <strong className="font-black text-slate-800 truncate">{c.descricao}</strong>
                      </div>
                      <p className="text-3xs text-subtle mt-0.5">
                        {[ORIGENS[c.origem_tipo] || c.origem_tipo, rotuloMeio(c.meio), c.adquirente, c.bandeira].filter(Boolean).join(" · ")}
                        {" · "}venda {fmtData(c.data_venda)} · previsto {fmtData(c.data_prevista)}
                      </p>
                    </button>
                    <div className="flex items-center justify-between sm:justify-end gap-3 text-xs">
                      <div className="text-right">
                        <p className="font-black">{fmtBRL(c.valor_bruto)} <span className="text-3xs text-fg font-bold">bruto</span></p>
                        <p className="text-3xs text-fg">
                          {c.taxa_nao_informada ? "taxa não informada" : `líquido prev. ${fmtBRL(c.valor_liquido_previsto)}`} · saldo {fmtBRL(c.saldo_bruto)}
                        </p>
                      </div>
                      <div className="flex gap-1.5">
                        <button title="Detalhes" onClick={() => abrirDetalhe(c)} className="p-2 bg-slate-100 rounded-lg"><Eye size={14} /></button>
                        {podeReceber(c) && <button disabled={processando} onClick={() => setReceber(c)} className="px-3 py-2 bg-emerald-500 text-white font-bold rounded-lg text-2xs disabled:opacity-50">Receber</button>}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          <p className="text-3xs text-fg">Faturamento total do restaurante: NÃO APURADO (não há fonte completa de vendas conectada). Esta tela mostra só o que foi lançado como conta a receber.</p>
        </div>
      </div>

      {/* ── nova / editar ── */}
      {form && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-sm sm:p-4">
          <form onSubmit={salvar} className="bg-card rounded-t-3xl sm:rounded-3xl max-w-2xl w-full shadow-2xl max-h-[94vh] flex flex-col">
            <div className="flex justify-between items-center p-5 pb-3 border-b border-line">
              <div>
                <h3 className="text-lg font-black">{form.id ? "Editar conta a receber" : "Nova receita / conta a receber"}</h3>
                {!form.id && <p className="text-3xs font-bold uppercase text-amber-700">Origem: manual (não é venda do PDV)</p>}
              </div>
              <button type="button" onClick={() => setForm(null)} disabled={processando} aria-label="Fechar"><X size={20} /></button>
            </div>
            <div className="p-5 space-y-3 overflow-y-auto">
              <label className="block"><span className="text-xs font-bold text-fg uppercase block mb-1">Descrição</span>
                <input required value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} className={campo} placeholder="Ex.: Evento casamento — sinal" /></label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block"><span className="text-xs font-bold text-fg uppercase block mb-1">Forma</span>
                  <select value={form.meio} disabled={!!form.id} onChange={(e) => setForm({ ...form, meio: e.target.value })} className={campo}>
                    {MEIOS.map((m) => <option key={m.codigo} value={m.codigo}>{m.rotulo}</option>)}
                  </select></label>
                <label className="block"><span className="text-xs font-bold text-fg uppercase block mb-1">Valor bruto (R$)</span>
                  <input required inputMode="decimal" value={form.valor_bruto} disabled={!!form.id && Number(form.contaAtual?.bruto_baixado || 0) > 0}
                    onChange={(e) => setForm({ ...form, valor_bruto: e.target.value })} className={campo} placeholder="0,00" /></label>
                <label className="block"><span className="text-xs font-bold text-fg uppercase block mb-1">Data da venda / origem</span>
                  <input required type="date" value={form.data_venda} onChange={(e) => setForm({ ...form, data_venda: e.target.value })} className={campo} /></label>
                <label className="block"><span className="text-xs font-bold text-fg uppercase block mb-1">{Number(form.recebiveis) > 1 ? "1ª previsão" : "Previsão de recebimento"}</span>
                  <input required type="date" value={form.data_prevista} onChange={(e) => setForm({ ...form, data_prevista: e.target.value })} className={campo} /></label>
              </div>
              <p className="text-3xs text-fg">Data da venda = competência da receita (bruto). Previsão = quando o dinheiro deve entrar. A data real é registrada no recebimento.</p>
              <label className="block"><span className="text-xs font-bold text-fg uppercase block mb-1">Conta financeira prevista</span>
                <select value={form.conta_financeira_prevista_id} onChange={(e) => setForm({ ...form, conta_financeira_prevista_id: e.target.value })} className={campo}>
                  <option value="">{contasFin.length ? "Não informada" : "Nenhuma cadastrada (Caixa e Contas)"}</option>
                  {contasFin.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select></label>

              {(cartao || ["delivery_marketplace", "boleto", "pix", "outro"].includes(form.meio)) && (
                <details open={cartao} className="rounded-2xl border border-line bg-white p-3">
                  <summary className="text-xs font-black uppercase text-fg cursor-pointer">{cartao ? "Cartão" : "Plataforma / adquirente"}</summary>
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <label className="block"><span className="text-3xs font-bold text-fg uppercase block mb-1">Adquirente / plataforma</span>
                      <input value={form.adquirente} onChange={(e) => setForm({ ...form, adquirente: e.target.value })} className={campo} placeholder="Stone, Cielo, iFood…" /></label>
                    {cartao && <label className="block"><span className="text-3xs font-bold text-fg uppercase block mb-1">Bandeira</span>
                      <input value={form.bandeira} onChange={(e) => setForm({ ...form, bandeira: e.target.value })} className={campo} placeholder="Visa, Master…" /></label>}
                    {!form.id && <label className="block"><span className="text-3xs font-bold text-fg uppercase block mb-1">Modalidade</span>
                      <select value={form.modalidade} onChange={(e) => setForm({ ...form, modalidade: e.target.value })} className={campo}>
                        {MODALIDADES.map((m) => <option key={m.codigo} value={m.codigo}>{m.rotulo}</option>)}
                      </select></label>}
                    {!form.id && cartao && <label className="block"><span className="text-3xs font-bold text-fg uppercase block mb-1">Parcelas da venda</span>
                      <input type="number" min="1" max="120" value={form.parcelas_venda} onChange={(e) => setForm({ ...form, parcelas_venda: e.target.value })} className={campo} /></label>}
                    {!form.id && cartao && Number(form.parcelas_venda) > 1 && (
                      <label className="block col-span-2"><span className="text-3xs font-bold text-fg uppercase block mb-1">Como o dinheiro entra</span>
                        <select value={Number(form.recebiveis) > 1 ? "parcelas" : "consolidado"}
                          onChange={(e) => setForm({ ...form, recebiveis: e.target.value === "parcelas" ? Number(form.parcelas_venda) : 1 })} className={campo}>
                          <option value="consolidado">1 recebível consolidado</option>
                          <option value="parcelas">{form.parcelas_venda} recebíveis (um por parcela, mês a mês)</option>
                        </select></label>
                    )}
                    <label className="block"><span className="text-3xs font-bold text-fg uppercase block mb-1">NSU</span>
                      <input value={form.nsu} onChange={(e) => setForm({ ...form, nsu: e.target.value })} className={campo} /></label>
                    <label className="block"><span className="text-3xs font-bold text-fg uppercase block mb-1">Autorização</span>
                      <input value={form.autorizacao} onChange={(e) => setForm({ ...form, autorizacao: e.target.value })} className={campo} /></label>
                  </div>
                </details>
              )}

              {!form.id ? (
                <div className="rounded-2xl border border-line bg-white p-3 space-y-2">
                  <p className="text-xs font-black uppercase text-fg">Taxa</p>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    {[["nao_informada", "Não informada"], ["regra", "Pelo cadastro"], ["informada", "Informar valor"]].map(([v, r]) => (
                      <label key={v} className={`p-2 rounded-xl border text-center font-bold cursor-pointer ${form.modo_taxa === v ? "border-emerald-500 bg-emerald-50" : "border-line"}`}>
                        <input type="radio" className="hidden" checked={form.modo_taxa === v} onChange={() => setForm({ ...form, modo_taxa: v })} />{r}
                      </label>
                    ))}
                  </div>
                  {form.modo_taxa === "regra" && (regraForm
                    ? <p className="text-xs">Regra: {regraForm.adquirente || "qualquer adquirente"} · {regraForm.bandeira || "qualquer bandeira"} · {Number(regraForm.taxa_percentual).toLocaleString("pt-BR")}% + {fmtBRL(regraForm.taxa_fixa)} · cai em D+{regraForm.dias_para_recebimento}
                        {" "}<button type="button" className="underline font-bold" onClick={() => setForm({ ...form, data_prevista: somarDias(form.data_venda, Number(regraForm.dias_para_recebimento)) })}>usar previsão {fmtData(somarDias(form.data_venda, Number(regraForm.dias_para_recebimento)))}</button></p>
                    : <p className="text-xs text-red-700 font-bold">Nenhuma taxa cadastrada para esta combinação. Cadastre em Caixa e Contas → Taxas, ou informe o valor.</p>)}
                  {form.modo_taxa === "informada" && (
                    <input inputMode="decimal" value={form.valor_taxa} onChange={(e) => setForm({ ...form, valor_taxa: e.target.value })} className={campo} placeholder="Valor da taxa (R$)" />)}
                  <div className="flex justify-between text-xs pt-1 border-t border-line">
                    <span>Bruto {fmtBRL(Number.isFinite(brutoForm) ? brutoForm : 0)} − taxa {taxaForm == null ? "não informada" : fmtBRL(taxaForm)}</span>
                    <b>Líquido previsto: {taxaForm == null ? "não apurado" : fmtBRL((Number.isFinite(brutoForm) ? brutoForm : 0) - taxaForm)}</b>
                  </div>
                </div>
              ) : (
                <label className="block"><span className="text-xs font-bold text-fg uppercase block mb-1">Taxa prevista (R$, vazio = não informada)</span>
                  <input inputMode="decimal" value={form.valor_taxa_previsto} disabled={Number(form.contaAtual?.bruto_baixado || 0) > 0}
                    onChange={(e) => setForm({ ...form, valor_taxa_previsto: e.target.value })} className={campo} /></label>
              )}
              <label className="block"><span className="text-xs font-bold text-fg uppercase block mb-1">Observação</span>
                <textarea rows={2} value={form.observacao} onChange={(e) => setForm({ ...form, observacao: e.target.value })} className={campo} /></label>
            </div>
            <div className="flex gap-3 p-4 border-t border-line">
              <button type="button" onClick={() => setForm(null)} disabled={processando} className="flex-1 py-3 bg-slate-100 font-bold text-sm rounded-xl">Cancelar</button>
              <button type="submit" disabled={processando} className="flex-1 py-3 bg-emerald-500 text-white font-black text-sm rounded-xl disabled:opacity-60">{processando ? "Salvando..." : "Salvar"}</button>
            </div>
          </form>
        </div>
      )}

      {/* ── detalhe e histórico ── */}
      {detalhe && !receber && !form && (() => {
        const c = detalhe.conta;
        return (
          <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-sm sm:p-4">
            <div className="bg-card rounded-t-3xl sm:rounded-3xl max-w-2xl w-full shadow-2xl max-h-[94vh] flex flex-col">
              <div className="flex justify-between items-start p-5 pb-3 border-b border-line">
                <div className="min-w-0">
                  <span className={`px-2 py-0.5 rounded-full text-3xs font-black uppercase ${COR[c.situacao] || COR.previsto}`}>{ROTULO_SITUACAO_RECEBER[c.situacao]}</span>
                  <h3 className="text-lg font-black mt-1 truncate">{c.descricao}</h3>
                </div>
                <button onClick={() => { setDetalhe(null); setMotivo(null); }} aria-label="Fechar"><X size={20} /></button>
              </div>
              <div className="p-5 space-y-4 overflow-y-auto">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                  {[["Bruto (receita)", fmtBRL(c.valor_bruto)], ["Taxa prevista", c.taxa_nao_informada ? "não informada" : fmtBRL(c.valor_taxa_previsto)],
                    ["Líquido previsto", c.valor_liquido_previsto == null ? "não apurado" : fmtBRL(c.valor_liquido_previsto)],
                    ["Bruto baixado", fmtBRL(c.bruto_baixado)], ["Líquido recebido", fmtBRL(c.liquido_recebido)], ["Saldo bruto", fmtBRL(c.saldo_bruto)]].map(([r, v]) => (
                    <div key={r} className="bg-white rounded-xl p-2.5"><p className="text-fg font-bold">{r}</p><p className="font-black">{v}</p></div>
                  ))}
                </div>
                <details className="rounded-2xl border border-line bg-white p-3 text-xs">
                  <summary className="font-black uppercase text-fg cursor-pointer">Detalhes da conta</summary>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 mt-2">
                    <dt className="text-fg">Origem</dt><dd className="font-bold">{ORIGENS[c.origem_tipo] || c.origem_tipo}</dd>
                    <dt className="text-fg">Forma</dt><dd className="font-bold">{rotuloMeio(c.meio)} · {rotuloModalidade(c.modalidade)}</dd>
                    <dt className="text-fg">Adquirente / bandeira</dt><dd className="font-bold">{[c.adquirente, c.bandeira].filter(Boolean).join(" · ") || "—"}</dd>
                    <dt className="text-fg">Parcela</dt><dd className="font-bold">{c.parcela_numero}/{c.parcelas_total}</dd>
                    {c.taxa_percentual_prevista != null && <><dt className="text-fg">Regra de taxa</dt><dd className="font-bold">{Number(c.taxa_percentual_prevista).toLocaleString("pt-BR")}% + {fmtBRL(c.taxa_fixa_prevista)}</dd></>}
                    <dt className="text-fg">Data da venda</dt><dd className="font-bold">{fmtData(c.data_venda)}</dd>
                    <dt className="text-fg">Previsão</dt><dd className="font-bold">{fmtData(c.data_prevista)}</dd>
                    <dt className="text-fg">Conta prevista</dt><dd className="font-bold">{nomeConta(c.conta_financeira_prevista_id) || "—"}</dd>
                    <dt className="text-fg">NSU / autorização</dt><dd className="font-bold">{[c.nsu, c.autorizacao].filter(Boolean).join(" · ") || "—"}</dd>
                    <dt className="text-fg">Criada</dt><dd className="font-bold">{fmtHora(c.created_at)} · {quem(c.criado_por)}</dd>
                    {c.cancelado_em && <><dt className="text-fg">Cancelada</dt><dd className="font-bold">{fmtHora(c.cancelado_em)} · {quem(c.atualizado_por)} · {c.motivo_cancelamento}</dd></>}
                    {c.observacao && <><dt className="text-fg">Observação</dt><dd className="font-bold">{c.observacao}</dd></>}
                  </dl>
                </details>
                <div>
                  <h4 className="font-black text-xs uppercase tracking-wider mb-2">Recebimentos</h4>
                  {detalhe.carregando ? <p className="text-xs text-fg">Carregando...</p>
                    : detalhe.erro ? <p className="text-xs font-bold text-red-700">Não foi possível carregar o histórico: {detalhe.erro}</p>
                    : !detalhe.recebimentos.length ? <p className="text-xs text-fg">Nenhum recebimento registrado.</p>
                    : <div className="space-y-2">{detalhe.recebimentos.map((r) => (
                      <div key={r.id} className={`rounded-xl border p-3 text-xs ${r.estornado_em ? "border-red-200 bg-red-50/60" : "border-line bg-white"}`}>
                        <div className="flex justify-between gap-2">
                          <div>
                            <b className={r.estornado_em ? "line-through" : ""}>{fmtBRL(r.valor_liquido_recebido)} entrou</b> em {fmtData(r.recebido_em)}
                            <span className="block text-fg">Bruto baixado {fmtBRL(r.valor_bruto_baixado)} · taxa {fmtBRL(r.valor_taxa_efetiva)}{nomeConta(r.conta_financeira_id) ? ` · ${nomeConta(r.conta_financeira_id)}` : ""}</span>
                            <span className="block text-fg">Registrado {fmtHora(r.created_at)} · {quem(r.criado_por)}</span>
                            {r.conciliacao_referencia && <span className="block">Ref.: {r.conciliacao_referencia}</span>}
                            {r.observacao && <span className="block">{r.observacao}</span>}
                            {r.estornado_em && <span className="block font-bold text-red-700">ESTORNADO {fmtHora(r.estornado_em)} · {quem(r.estornado_por)} · motivo: {r.motivo_estorno}</span>}
                          </div>
                          {!r.estornado_em && <button disabled={processando} onClick={() => setMotivo({ tipo: "estorno", alvo: r.id, texto: "" })} className="self-start px-2 py-1 bg-red-100 text-red-700 font-bold rounded-lg text-3xs disabled:opacity-50">Estornar</button>}
                        </div>
                      </div>))}</div>}
                </div>
                {motivo && (
                  <form onSubmit={confirmarMotivo} className="rounded-2xl border border-red-200 bg-red-50 p-3 space-y-2">
                    <label className="block text-xs font-bold">{motivo.tipo === "estorno" ? "Motivo do estorno" : "Motivo do cancelamento"}
                      <input required autoFocus value={motivo.texto} onChange={(e) => setMotivo({ ...motivo, texto: e.target.value })} className={`${campo} mt-1`} /></label>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setMotivo(null)} disabled={processando} className="flex-1 py-2 bg-white font-bold text-xs rounded-xl">Voltar</button>
                      <button type="submit" disabled={processando} className="flex-1 py-2 bg-red-600 text-white font-black text-xs rounded-xl disabled:opacity-60">{processando ? "Enviando..." : "Confirmar"}</button>
                    </div>
                  </form>
                )}
              </div>
              <div className="flex flex-wrap gap-2 p-4 border-t border-line">
                {podeReceber(c) && <button disabled={processando} onClick={() => setReceber(c)} className="flex-1 px-4 py-2.5 bg-emerald-500 text-white font-black text-xs rounded-xl disabled:opacity-50">Registrar recebimento</button>}
                {c.situacao !== "cancelado" && <button disabled={processando} onClick={() => abrirEdicao(c)} className="px-4 py-2.5 bg-slate-100 font-bold text-xs rounded-xl inline-flex items-center gap-1 disabled:opacity-50"><Pencil size={13} /> Editar</button>}
                {podeCancelarReceber(c) && <button disabled={processando} onClick={() => setMotivo({ tipo: "cancelamento", alvo: c.id, texto: "" })} className="px-4 py-2.5 bg-stone-200 font-bold text-xs rounded-xl inline-flex items-center gap-1 disabled:opacity-50"><Ban size={13} /> Cancelar</button>}
              </div>
            </div>
          </div>
        );
      })()}

      {receber && <ModalRecebimentoConta conta={receber} contasFinanceiras={contasFin} processando={processando} onConfirmar={confirmarRecebimento} onFechar={() => setReceber(null)} />}
    </div>
  );
}
