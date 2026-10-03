"use client";

// CONTAS A PAGAR — F2.2 (arquitetura F2.1).
// Leitura: vw_fin_contas_pagar (saldo e situação calculados no banco).
// Escrita: contas-pagar.mjs (criação/edição) e RPCs de pagamento, estorno e
// cancelamento. Abrir a tela é só leitura.

import { useState, useEffect, useMemo, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useERP } from "../../../context/ERPContext";
import { useTempoReal } from "../../../lib/realtime";
import {
  fetchContasPagar, fetchReferenciasContas, fetchPagamentosDaConta, fetchPagamentosPeriodo, usuarioAtualId,
  salvarConta, pagarConta, estornarPagamento, cancelarContaPagar, gerarContasRecorrentes,
} from "../../../lib/financeiro";
import {
  gruposDeCategorias, rotuloSituacao, podeReceberPagamento, podeCancelar, unidadeValida, hojeLocal,
  intervaloPeriodo, resumoContas, planejarRecorrentes, novaChave, ROTULO_GRUPO,
} from "../../../lib/contas-pagar.mjs";
import ModalPagamentoConta from "../../../components/ModalPagamentoConta";
import { Plus, Search, CalendarDays, Wallet, AlertTriangle, Clock, Pencil, X, RefreshCw, Eye, Ban } from "lucide-react";
import { fmtBRL } from "../../../components/ui";
import CampoDecimal from "../../../components/CampoDecimal";

const COR = {
  pago: "bg-emerald-100 text-emerald-800", parcial: "bg-blue-100 text-blue-800", vencido: "bg-red-100 text-red-800",
  pendente: "bg-slate-100 text-slate-900", cancelado: "bg-stone-200 text-stone-700", desconhecido: "bg-amber-100 text-amber-800",
};
const fmtData = (d) => (d ? new Date(`${String(d).slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR") : "—");
const fmtMes = (d) => (d ? new Date(`${String(d).slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR", { month: "long", year: "numeric" }) : "—");
const fmtHora = (d) => (d ? new Date(d).toLocaleString("pt-BR") : "—");

const formVazio = () => ({
  id: "", descricao: "", fornecedor_id: "", categoria_codigo: "", centro_custo_codigo: "",
  valor: "", competencia: hojeLocal().slice(0, 7), data_vencimento: hojeLocal(),
  documento_numero: "", observacao: "", recorrente: false, parcelas: 1,
});

export default function ContasAPagarPage() {
  const { unidadeAtiva } = useERP();
  const unidadeOk = unidadeValida(unidadeAtiva);
  const params = useSearchParams();

  const [contas, setContas] = useState([]);
  const [refs, setRefs] = useState({ categorias: [], centros: [], fornecedores: [], contasFinanceiras: [] });
  const [pagPeriodo, setPagPeriodo] = useState([]);
  const [eu, setEu] = useState(null);
  const [erro, setErro] = useState("");
  const [avisos, setAvisos] = useState([]);
  const [loading, setLoading] = useState(true);

  // filtros (podem vir da URL: ?situacao=vencido, ?periodo=hoje — links da
  // Central Financeira; recarregar a página mantém o filtro)
  const SITUACOES_URL = ["pendente", "parcial", "pago", "vencido", "cancelado"];
  const PERIODOS_URL = ["hoje", "semana", "mes"];
  const [periodoTipo, setPeriodoTipo] = useState(() => (PERIODOS_URL.includes(params?.get("periodo")) ? params.get("periodo") : "todos"));
  const [dataRef, setDataRef] = useState("vencimento");
  const [custom, setCustom] = useState({ de: "", ate: "" });
  const [fSituacao, setFSituacao] = useState(() => (SITUACOES_URL.includes(params?.get("situacao")) ? params.get("situacao") : ""));
  const [fCategoria, setFCategoria] = useState("");
  const [fCentro, setFCentro] = useState("");
  const [fFornecedor, setFFornecedor] = useState("");
  const [busca, setBusca] = useState("");

  // modais
  const [form, setForm] = useState(null);           // { ...campos, chave, contaAtual }
  const [contaPagar, setContaPagar] = useState(null);
  const [detalhe, setDetalhe] = useState(null);     // { conta, pagamentos, erro }
  const [motivo, setMotivo] = useState(null);       // { tipo: 'estorno'|'cancelamento', alvo, texto }
  const [recorrencia, setRecorrencia] = useState(null);

  const [processando, setProcessando] = useState(false);
  const emAndamento = useRef(false);
  const executar = async (fn) => {
    if (emAndamento.current) return;
    emAndamento.current = true;
    setProcessando(true);
    try { await fn(); } finally { emAndamento.current = false; setProcessando(false); }
  };

  const hoje = hojeLocal();
  const periodo = periodoTipo === "todos" ? null : intervaloPeriodo(periodoTipo, hoje, custom);

  const carregar = async (silencioso = false) => {
    if (!unidadeOk) { setContas([]); setLoading(false); return; }
    if (!silencioso) setLoading(true);
    const [c, r, u] = await Promise.all([fetchContasPagar(unidadeAtiva), fetchReferenciasContas(unidadeAtiva), usuarioAtualId()]);
    setContas(c.data || []);
    if (r.data) setRefs(r.data);
    setAvisos(r.avisos || []);
    setErro(c.error || r.error || "");
    setEu(u);
    setLoading(false);
  };
  useEffect(() => { carregar(); }, [unidadeAtiva]);
  useTempoReal(null, () => carregar(true));
  useEffect(() => { if (params?.get("nova") === "1" && unidadeOk) abrirNova(); }, [unidadeOk]);

  useEffect(() => {
    if (!unidadeOk || !periodo) { setPagPeriodo([]); return; }
    fetchPagamentosPeriodo(unidadeAtiva, periodo.de, periodo.ate).then((r) => setPagPeriodo(r.data || []));
  }, [unidadeAtiva, periodoTipo, custom.de, custom.ate, contas]);

  const nomeFornecedor = (id) => refs.fornecedores.find((f) => f.id === id)?.nome || null;
  const nomeCategoria = (cod) => refs.categorias.find((c) => c.codigo === cod)?.nome || cod || "Sem categoria";
  const nomeCentro = (cod) => refs.centros.find((c) => c.codigo === cod)?.nome || null;
  const nomeContaFin = (id) => refs.contasFinanceiras.find((c) => c.id === id)?.nome || null;
  const quem = (uid) => (!uid ? "não registrado" : uid === eu ? "você" : `outro usuário (${String(uid).slice(0, 8)})`);

  const filtradas = useMemo(() => contas.filter((c) => {
    if (periodo) {
      if (dataRef === "vencimento" && (c.data_vencimento < periodo.de || c.data_vencimento > periodo.ate)) return false;
      if (dataRef === "competencia") {
        const comp = String(c.competencia_efetiva).slice(0, 10);
        if (comp < `${periodo.de.slice(0, 7)}-01` || comp > periodo.ate) return false;
      }
    }
    // "vencido" = qualquer conta em aberto com vencimento passado (inclui parcial
    // vencida), o mesmo critério do card "Vencido"
    if (fSituacao === "vencido" ? !c.vencida : fSituacao && c.situacao !== fSituacao) return false;
    if (fCategoria && c.categoria_codigo !== fCategoria) return false;
    if (fCentro && c.centro_custo_codigo !== fCentro) return false;
    if (fFornecedor && c.fornecedor_id !== fFornecedor) return false;
    if (busca.trim()) {
      const t = busca.trim().toLowerCase();
      if (!`${c.descricao} ${nomeFornecedor(c.fornecedor_id) || ""} ${c.documento_numero || ""}`.toLowerCase().includes(t)) return false;
    }
    return true;
  }), [contas, periodoTipo, dataRef, custom, fSituacao, fCategoria, fCentro, fFornecedor, busca, refs]);

  const resumo = useMemo(() => resumoContas(contas, pagPeriodo, periodo, hoje), [contas, pagPeriodo, periodoTipo, custom]);

  // ── ações ────────────────────────────────────────────────────────────────
  function abrirNova() { setForm({ ...formVazio(), chave: novaChave(), contaAtual: null }); }
  function abrirEdicao(c) {
    setForm({
      id: c.id, contaAtual: c, chave: null,
      descricao: c.descricao || "", fornecedor_id: c.fornecedor_id || "", categoria_codigo: c.categoria_codigo || "",
      centro_custo_codigo: c.centro_custo_codigo || "", valor: String(c.valor_original ?? "").replace(".", ","),
      competencia: String(c.competencia_efetiva || "").slice(0, 7), data_vencimento: String(c.data_vencimento || "").slice(0, 10),
      documento_numero: c.documento_numero || "", observacao: c.observacao || "", recorrente: !!c.recorrente, parcelas: 1,
    });
  }
  async function abrirDetalhe(c) {
    setDetalhe({ conta: c, pagamentos: [], carregando: true });
    const r = await fetchPagamentosDaConta(c.id);
    setDetalhe({ conta: c, pagamentos: r.data, erro: r.error, carregando: false });
  }
  async function recarregarDetalhe(id) {
    const c = await fetchContasPagar(unidadeAtiva);
    setContas(c.data || []);
    const atual = (c.data || []).find((x) => x.id === id);
    if (atual && detalhe) await abrirDetalhe(atual);
  }

  const salvar = (e) => {
    e.preventDefault();
    executar(async () => {
      const { chave, contaAtual, ...campos } = form;
      const r = await salvarConta(
        { ...campos, id: campos.id || undefined, unidade_id: unidadeAtiva, contaAtual },
        { chave, categorias: refs.categorias },
      );
      if (r.error) return alert(`Não foi possível salvar: ${r.error}`);
      setForm(null);
      await carregar(true);
      if (campos.id) alert(r.data?.alterados?.length ? "Conta atualizada." : "Nada foi alterado.");
      else alert(`${r.idempotente ? "Esta conta já tinha sido lançada (nada foi duplicado)." : Number(campos.parcelas) > 1 ? `${campos.parcelas} parcelas lançadas.` : "Conta lançada."}`);
    });
  };

  const confirmarPagamento = (dados) => executar(async () => {
    const r = await pagarConta(dados);
    if (r.error) return alert(`Não foi possível registrar o pagamento: ${r.error}`);
    const id = contaPagar.id;
    setContaPagar(null);
    if (detalhe) await recarregarDetalhe(id); else await carregar(true);
    alert(r.data.idempotente ? "Este pagamento já tinha sido registrado (nada foi duplicado)." : `Pagamento registrado. Situação: ${r.data.status}.`);
  });

  const confirmarMotivo = (e) => {
    e.preventDefault();
    executar(async () => {
      const r = motivo.tipo === "estorno"
        ? await estornarPagamento(motivo.alvo, motivo.texto)
        : await cancelarContaPagar(motivo.alvo, motivo.texto);
      if (r.error) return alert(`Não foi possível ${motivo.tipo === "estorno" ? "estornar" : "cancelar"}: ${r.error}`);
      const contaId = motivo.tipo === "estorno" ? detalhe?.conta?.id : motivo.alvo;
      setMotivo(null);
      if (detalhe && contaId) await recarregarDetalhe(contaId); else await carregar(true);
      alert(motivo.tipo === "estorno" ? "Pagamento estornado. O histórico continua visível." : "Conta cancelada. Ela continua no histórico.");
    });
  };

  const planoRecorrencia = useMemo(() => (recorrencia ? planejarRecorrentes(contas, recorrencia.mes) : []), [recorrencia, contas]);
  const gerarRecorrencia = (e) => {
    e.preventDefault();
    executar(async () => {
      const r = await gerarContasRecorrentes(unidadeAtiva, contas, recorrencia.mes);
      await carregar(true);
      setRecorrencia(null);
      const d = r.data || { criadas: 0, existentes: 0 };
      alert(`${d.criadas} conta(s) criada(s)${d.existentes ? `, ${d.existentes} já existiam` : ""}.${r.error ? `\n\nFalhas: ${r.error}` : ""}`);
    });
  };

  if (!unidadeOk) return <div className="p-8 text-center font-bold text-fg">Selecione uma unidade para ver as contas a pagar.</div>;

  const grupos = gruposDeCategorias(refs.categorias, { incluirCodigo: form?.contaAtual?.categoria_codigo || null });
  const sel = "w-full p-2.5 bg-white border border-line rounded-2xl text-xs font-bold text-slate-800 outline-none focus:border-emerald-500";
  const campo = "w-full p-3 bg-white border border-line rounded-xl font-bold text-slate-800 text-sm";

  return (
    <div className="min-h-screen pb-24 font-sans text-slate-800 bg-[var(--surface)]">
      <div className="bg-slate-900 pt-6 sm:pt-8 pb-8 px-4 sm:px-8 text-white">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tighter">Contas a Pagar</h1>
            <p className="text-subtle font-bold uppercase tracking-widest text-xs mt-1">Obrigações, pagamentos e histórico</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setRecorrencia({ mes: hoje.slice(0, 7) })} disabled={processando}
              className="px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-2xl flex items-center gap-2 text-sm disabled:opacity-60">
              <RefreshCw size={16} /> Recorrentes
            </button>
            <button onClick={abrirNova} disabled={processando}
              className="px-5 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-black rounded-2xl flex items-center gap-2 disabled:opacity-60">
              <Plus size={18} /> Nova conta
            </button>
          </div>
        </div>

        <div className="max-w-7xl mx-auto mt-6 grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { r: "A pagar (em aberto)", v: resumo.aPagar, I: CalendarDays, c: "text-amber-400" },
            { r: "Vencido", v: resumo.vencido, I: AlertTriangle, c: "text-red-400" },
            { r: "Próximos 7 dias", v: resumo.proximos7, I: Clock, c: "text-sky-300" },
            { r: periodo ? "Pago no período (caixa)" : "Pago no período", v: resumo.pagoNoPeriodo, I: Wallet, c: "text-emerald-400",
              nota: !periodo ? "Escolha um período" : resumo.pagoNoPeriodoIncluiLegado ? "Inclui pagamentos antigos sem histórico" : null },
          ].map(({ r, v, I, c, nota }) => (
            <div key={r} className="bg-slate-800/80 p-4 rounded-2xl border border-slate-700/50">
              <div className="flex items-center gap-2 text-slate-300"><I size={16} /><p className="text-3xs uppercase font-bold tracking-widest">{r}</p></div>
              <p className={`text-xl sm:text-2xl font-black mt-1 ${c}`}>{v == null ? "—" : fmtBRL(v)}</p>
              <p className="text-3xs text-slate-400 mt-0.5">{nota || "Calculado das contas registradas no Héfisto"}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 mt-6 space-y-4">
        {erro && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-800">Não foi possível carregar: {erro}</div>}
        {avisos.map((a) => <div key={a} className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs font-bold text-amber-900">{a}</div>)}

        <div className="bg-card rounded-3xl p-5 border border-line shadow-sm space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
            <select value={periodoTipo} onChange={(e) => setPeriodoTipo(e.target.value)} className={sel}>
              <option value="todos">Todo o período</option><option value="hoje">Hoje</option>
              <option value="semana">Esta semana</option><option value="mes">Este mês</option><option value="personalizado">Personalizado</option>
            </select>
            <select value={dataRef} onChange={(e) => setDataRef(e.target.value)} className={sel} disabled={!periodo && periodoTipo !== "personalizado"}>
              <option value="vencimento">Por vencimento</option><option value="competencia">Por competência</option>
            </select>
            {periodoTipo === "personalizado" && <>
              <input type="date" value={custom.de} onChange={(e) => setCustom({ ...custom, de: e.target.value })} className={sel} />
              <input type="date" value={custom.ate} onChange={(e) => setCustom({ ...custom, ate: e.target.value })} className={sel} />
            </>}
            <select value={fSituacao} onChange={(e) => setFSituacao(e.target.value)} className={sel}>
              <option value="">Todas as situações</option>
              {["pendente", "parcial", "pago", "vencido", "cancelado"].map((s) => <option key={s} value={s}>{rotuloSituacao({ situacao: s })}</option>)}
            </select>
            <select value={fCategoria} onChange={(e) => setFCategoria(e.target.value)} className={sel}>
              <option value="">Todas as categorias</option>
              {gruposDeCategorias(refs.categorias, {}).concat(
                [{ grupo: "LEGADO", rotulo: ROTULO_GRUPO.LEGADO, itens: refs.categorias.filter((c) => c.grupo === "LEGADO") }]
              ).filter((g) => g.itens.length).map((g) => (
                <optgroup key={g.grupo} label={g.rotulo}>{g.itens.map((c) => <option key={c.codigo} value={c.codigo}>{c.nome}</option>)}</optgroup>
              ))}
            </select>
            <select value={fCentro} onChange={(e) => setFCentro(e.target.value)} className={sel}>
              <option value="">Todos os centros de custo</option>
              {refs.centros.map((c) => <option key={c.codigo} value={c.codigo}>{c.nome}</option>)}
            </select>
            <select value={fFornecedor} onChange={(e) => setFFornecedor(e.target.value)} className={sel}>
              <option value="">Todos os fornecedores</option>
              {refs.fornecedores.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
            </select>
            <div className="relative md:col-span-2">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar descrição, fornecedor ou documento" className={`${sel} pl-9`} />
            </div>
          </div>
          {periodoTipo === "personalizado" && !periodo && <p className="text-xs font-bold text-amber-700">Informe as duas datas (início ≤ fim).</p>}

          {loading ? <div className="py-12 text-center text-fg font-bold">Carregando contas a pagar...</div>
            : !filtradas.length ? <div className="py-12 text-center font-bold text-slate-900">Nenhuma conta para os filtros escolhidos.</div>
            : (
            <div className="rounded-2xl border border-line overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900 text-white uppercase font-black tracking-wider">
                  <tr>
                    <th className="p-3">Conta</th><th className="p-3">Competência</th><th className="p-3">Vencimento</th>
                    <th className="p-3 text-right">Valor</th><th className="p-3 text-right">Pago</th><th className="p-3 text-right">Saldo</th>
                    <th className="p-3 text-center">Situação</th><th className="p-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line bg-card">
                  {filtradas.map((c) => (
                    <tr key={c.id} className="hover:bg-white">
                      <td className="p-3">
                        <strong className="block font-black text-slate-800">{c.descricao}</strong>
                        <span className="text-3xs text-subtle">
                          {[nomeFornecedor(c.fornecedor_id), nomeCategoria(c.categoria_codigo) + (c.categoria_inferida ? " (antigo)" : ""), nomeCentro(c.centro_custo_codigo)].filter(Boolean).join(" · ")}
                        </span>
                      </td>
                      <td className="p-3 font-medium">{fmtMes(c.competencia_efetiva)}{c.competencia_inferida ? <span className="block text-3xs text-subtle">inferida</span> : null}</td>
                      <td className="p-3 font-bold">{fmtData(c.data_vencimento)}</td>
                      <td className="p-3 text-right">{fmtBRL(c.valor_original)}</td>
                      <td className="p-3 text-right text-emerald-700">{fmtBRL(c.valor_pago)}</td>
                      <td className="p-3 text-right font-black">{fmtBRL(c.saldo)}</td>
                      <td className="p-3 text-center"><span className={`px-2 py-1 rounded-full text-3xs font-black uppercase ${COR[c.situacao] || COR.desconhecido}`}>{rotuloSituacao(c)}</span></td>
                      <td className="p-3 text-right whitespace-nowrap space-x-1.5">
                        <button title="Detalhes e histórico" onClick={() => abrirDetalhe(c)} className="p-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg"><Eye size={14} /></button>
                        {c.situacao !== "cancelado" && <button title="Editar" disabled={processando} onClick={() => abrirEdicao(c)} className="p-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg disabled:opacity-50"><Pencil size={14} /></button>}
                        {podeReceberPagamento(c) && <button disabled={processando} onClick={() => setContaPagar(c)} className="px-2.5 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-lg text-2xs disabled:opacity-50">Pagar</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── formulário nova / editar ── */}
      {form && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <form onSubmit={salvar} className="bg-card rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-3 max-h-[92vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-3 border-b border-line">
              <h3 className="text-xl font-black">{form.id ? "Editar conta" : "Nova conta a pagar"}</h3>
              <button type="button" onClick={() => setForm(null)} disabled={processando} aria-label="Fechar"><X size={20} /></button>
            </div>
            {form.contaAtual?.pagamento_legado && <p className="text-xs bg-amber-50 border border-amber-200 rounded-xl p-2 font-semibold">Conta paga antes do novo financeiro: o valor não pode mudar.</p>}
            <label className="block"><span className="text-xs font-bold text-fg uppercase block mb-1">Descrição</span>
              <input required value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} className={campo} placeholder="Ex.: Energia elétrica" /></label>
            <div className="grid sm:grid-cols-2 gap-3">
              <label className="block"><span className="text-xs font-bold text-fg uppercase block mb-1">Fornecedor (opcional)</span>
                <select value={form.fornecedor_id} onChange={(e) => setForm({ ...form, fornecedor_id: e.target.value })} className={campo}>
                  <option value="">Sem fornecedor</option>
                  {refs.fornecedores.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
                </select></label>
              <label className="block"><span className="text-xs font-bold text-fg uppercase block mb-1">Documento (NF, boleto)</span>
                <input value={form.documento_numero} onChange={(e) => setForm({ ...form, documento_numero: e.target.value })} className={campo} /></label>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <label className="block"><span className="text-xs font-bold text-fg uppercase block mb-1">Categoria</span>
                <select required value={form.categoria_codigo} onChange={(e) => setForm({ ...form, categoria_codigo: e.target.value })} className={campo}>
                  <option value="">Escolha...</option>
                  {grupos.map((g) => <optgroup key={g.grupo} label={g.rotulo}>{g.itens.map((c) => <option key={c.codigo} value={c.codigo}>{c.nome}</option>)}</optgroup>)}
                </select>
                <span className="text-3xs text-fg">Compra de mercadoria para estoque não entra aqui: terá o módulo de Compras.</span></label>
              <label className="block"><span className="text-xs font-bold text-fg uppercase block mb-1">Centro de custo</span>
                <select value={form.centro_custo_codigo} onChange={(e) => setForm({ ...form, centro_custo_codigo: e.target.value })} className={campo}>
                  <option value="">Não informado</option>
                  {refs.centros.map((c) => <option key={c.codigo} value={c.codigo}>{c.nome}</option>)}
                </select></label>
            </div>
            <div className="grid sm:grid-cols-3 gap-3">
              <label className="block"><span className="text-xs font-bold text-fg uppercase block mb-1">Valor {Number(form.parcelas) > 1 ? "total" : ""} (R$)</span>
                <CampoDecimal required value={form.valor} disabled={!!form.contaAtual?.pagamento_legado || Number(form.contaAtual?.valor_pago || 0) > 0}
                  onChange={(e) => setForm({ ...form, valor: e.target.value })} className={campo} placeholder="0,00" /></label>
              <label className="block"><span className="text-xs font-bold text-fg uppercase block mb-1">Competência (mês)</span>
                <input required type="month" value={form.competencia} onChange={(e) => setForm({ ...form, competencia: e.target.value })} className={campo} /></label>
              <label className="block"><span className="text-xs font-bold text-fg uppercase block mb-1">{Number(form.parcelas) > 1 ? "1º vencimento" : "Vencimento"}</span>
                <input required type="date" value={form.data_vencimento} onChange={(e) => setForm({ ...form, data_vencimento: e.target.value })} className={campo} /></label>
            </div>
            <p className="text-3xs text-fg">Competência = mês a que a despesa pertence (DRE). Vencimento = quando deve ser paga. A data de pagamento é registrada no pagamento (fluxo de caixa).</p>
            {!form.id && (
              <div className="grid sm:grid-cols-2 gap-3 items-end">
                <label className="block"><span className="text-xs font-bold text-fg uppercase block mb-1">Parcelas</span>
                  <input type="number" min="1" max="120" value={form.parcelas} onChange={(e) => setForm({ ...form, parcelas: e.target.value, recorrente: Number(e.target.value) > 1 ? false : form.recorrente })} className={campo} /></label>
                {Number(form.parcelas) > 1 && <p className="text-xs text-fg pb-2">Cria {form.parcelas} contas ligadas (1/{form.parcelas}…), uma por mês a partir do 1º vencimento.</p>}
              </div>
            )}
            <label className="block"><span className="text-xs font-bold text-fg uppercase block mb-1">Observação</span>
              <textarea value={form.observacao} onChange={(e) => setForm({ ...form, observacao: e.target.value })} className={campo} rows={2} /></label>
            {Number(form.parcelas) <= 1 && (
              <label className="flex items-center gap-2 text-xs font-bold">
                <input type="checkbox" checked={form.recorrente} onChange={(e) => setForm({ ...form, recorrente: e.target.checked })} className="w-4 h-4 accent-emerald-500" />
                Recorrente (todo mês; gerada pelo botão "Recorrentes", nunca sozinha)
              </label>
            )}
            {form.id && <p className="text-3xs text-fg">Editar não mexe em pagamentos nem na situação.</p>}
            <div className="flex gap-3 pt-3 border-t border-line">
              <button type="button" onClick={() => setForm(null)} disabled={processando} className="flex-1 py-3 bg-slate-100 font-bold text-sm rounded-xl">Cancelar</button>
              <button type="submit" disabled={processando} className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white font-black text-sm rounded-xl">{processando ? "Salvando..." : "Salvar"}</button>
            </div>
          </form>
        </div>
      )}

      {/* ── detalhe e histórico ── */}
      {detalhe && !contaPagar && !form && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-card rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
            {(() => { const c = detalhe.conta; return (<>
              <div className="flex justify-between items-start pb-3 border-b border-line">
                <div className="min-w-0">
                  <span className={`px-2 py-0.5 rounded-full text-3xs font-black uppercase ${COR[c.situacao] || COR.desconhecido}`}>{rotuloSituacao(c)}</span>
                  <h3 className="text-xl font-black mt-1">{c.descricao}</h3>
                </div>
                <button onClick={() => { setDetalhe(null); setMotivo(null); }} aria-label="Fechar"><X size={20} /></button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                {[["Valor original", fmtBRL(c.valor_original)], ["Pago", fmtBRL(c.valor_pago)], ["Saldo", fmtBRL(c.saldo)], ["Saiu do caixa", fmtBRL(c.saida_caixa_total)]].map(([r, v]) => (
                  <div key={r} className="bg-white rounded-xl p-2.5"><p className="text-fg font-bold">{r}</p><p className="font-black">{v}</p></div>
                ))}
              </div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                <dt className="text-fg">Fornecedor</dt><dd className="font-bold">{nomeFornecedor(c.fornecedor_id) || "—"}</dd>
                <dt className="text-fg">Categoria</dt><dd className="font-bold">{nomeCategoria(c.categoria_codigo)}{c.categoria_inferida ? ` (lida do lançamento antigo "${c.categoria_texto_antigo}")` : ""}{c.exige_revisao ? " · revisar" : ""}</dd>
                <dt className="text-fg">Centro de custo</dt><dd className="font-bold">{nomeCentro(c.centro_custo_codigo) || "—"}</dd>
                <dt className="text-fg">Competência</dt><dd className="font-bold">{fmtMes(c.competencia_efetiva)}{c.competencia_inferida ? " (inferida pelo vencimento)" : ""}</dd>
                <dt className="text-fg">Vencimento</dt><dd className="font-bold">{fmtData(c.data_vencimento)}</dd>
                <dt className="text-fg">Documento</dt><dd className="font-bold">{c.documento_numero || "—"}</dd>
                {c.parcela_numero && <><dt className="text-fg">Parcela</dt><dd className="font-bold">{c.parcela_numero}/{c.parcelas_total}</dd></>}
                <dt className="text-fg">Origem</dt><dd className="font-bold">{c.origem_tipo || "Lançamento antigo"}</dd>
                <dt className="text-fg">Criada</dt><dd className="font-bold">{fmtHora(c.created_at)} · {quem(c.criado_por)}</dd>
                <dt className="text-fg">Última alteração</dt><dd className="font-bold">{fmtHora(c.updated_at)}{c.atualizado_por ? ` · ${quem(c.atualizado_por)}` : ""}</dd>
                {c.observacao && <><dt className="text-fg">Observação</dt><dd className="font-bold">{c.observacao}</dd></>}
              </dl>

              <div>
                <h4 className="font-black text-xs uppercase tracking-wider mb-2">Pagamentos</h4>
                {c.pagamento_legado && <p className="text-xs bg-amber-50 border border-amber-200 rounded-xl p-2.5">Pago antes do novo financeiro, em {fmtData(c.data_ultimo_pagamento)}. Não há histórico detalhado (juros, forma, quem pagou): nada foi inventado.</p>}
                {detalhe.carregando ? <p className="text-xs text-fg">Carregando...</p>
                  : detalhe.erro ? <p className="text-xs font-bold text-red-700">Não foi possível carregar o histórico: {detalhe.erro}</p>
                  : !detalhe.pagamentos.length && !c.pagamento_legado ? <p className="text-xs text-fg">Nenhum pagamento registrado.</p>
                  : (
                  <div className="space-y-2">
                    {detalhe.pagamentos.map((p) => (
                      <div key={p.id} className={`rounded-xl border p-3 text-xs ${p.estornado_em ? "border-red-200 bg-red-50/60" : "border-line bg-white"}`}>
                        <div className="flex justify-between gap-2">
                          <div>
                            <b className={p.estornado_em ? "line-through" : ""}>{fmtBRL(p.valor_principal)}</b> em {fmtData(p.pago_em)}
                            {(Number(p.juros) || Number(p.multa) || Number(p.desconto)) ? <span className="text-fg"> · juros {fmtBRL(p.juros)} · multa {fmtBRL(p.multa)} · desconto {fmtBRL(p.desconto)}</span> : null}
                            <span className="block text-fg">Saiu do caixa: {fmtBRL(p.valor_total)}{p.forma_pagamento ? ` · ${p.forma_pagamento}` : ""}{nomeContaFin(p.conta_financeira_id) ? ` · ${nomeContaFin(p.conta_financeira_id)}` : ""}</span>
                            <span className="block text-fg">Registrado {fmtHora(p.created_at)} · {quem(p.criado_por)}</span>
                            {p.observacao && <span className="block">{p.observacao}</span>}
                            {p.estornado_em && <span className="block font-bold text-red-700">ESTORNADO {fmtHora(p.estornado_em)} · {quem(p.estornado_por)} · motivo: {p.motivo_estorno}</span>}
                          </div>
                          {!p.estornado_em && <button disabled={processando} onClick={() => setMotivo({ tipo: "estorno", alvo: p.id, texto: "" })} className="self-start px-2 py-1 bg-red-100 hover:bg-red-200 text-red-700 font-bold rounded-lg text-3xs disabled:opacity-50">Estornar</button>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
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

              <div className="flex flex-wrap gap-2 pt-2 border-t border-line">
                {podeReceberPagamento(c) && <button disabled={processando} onClick={() => setContaPagar(c)} className="px-4 py-2.5 bg-emerald-500 text-white font-black text-xs rounded-xl disabled:opacity-50">Registrar pagamento</button>}
                {c.situacao !== "cancelado" && <button disabled={processando} onClick={() => abrirEdicao(c)} className="px-4 py-2.5 bg-slate-100 font-bold text-xs rounded-xl disabled:opacity-50">Editar</button>}
                {podeCancelar(c) && <button disabled={processando} onClick={() => setMotivo({ tipo: "cancelamento", alvo: c.id, texto: "" })} className="px-4 py-2.5 bg-stone-200 font-bold text-xs rounded-xl inline-flex items-center gap-1 disabled:opacity-50"><Ban size={13} /> Cancelar conta</button>}
              </div>
            </>); })()}
          </div>
        </div>
      )}

      {contaPagar && (
        <ModalPagamentoConta conta={contaPagar} contasFinanceiras={refs.contasFinanceiras} processando={processando}
          onConfirmar={confirmarPagamento} onFechar={() => setContaPagar(null)} />
      )}

      {/* ── recorrência sob demanda ── */}
      {recorrencia && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <form onSubmit={gerarRecorrencia} className="bg-card rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-3">
            <div className="flex justify-between items-center"><h3 className="text-lg font-black">Gerar contas recorrentes</h3>
              <button type="button" onClick={() => setRecorrencia(null)} disabled={processando}><X size={20} /></button></div>
            <label className="block"><span className="text-xs font-bold text-fg uppercase block mb-1">Competência</span>
              <input type="month" required value={recorrencia.mes} onChange={(e) => setRecorrencia({ mes: e.target.value })} className={campo} /></label>
            <p className="text-xs text-fg">{planoRecorrencia.length
              ? `Serão criadas ${planoRecorrencia.length} conta(s): ${planoRecorrencia.map((p) => p.modelo.descricao).join(", ")}.`
              : "Nenhuma conta recorrente a gerar para este mês."} Repetir não duplica.</p>
            <div className="flex gap-3">
              <button type="button" onClick={() => setRecorrencia(null)} disabled={processando} className="flex-1 py-3 bg-slate-100 font-bold text-sm rounded-xl">Fechar</button>
              <button type="submit" disabled={processando || !planoRecorrencia.length} className="flex-1 py-3 bg-emerald-500 text-white font-black text-sm rounded-xl disabled:opacity-50">{processando ? "Gerando..." : "Gerar"}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
