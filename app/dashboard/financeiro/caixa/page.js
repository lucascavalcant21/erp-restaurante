"use client";

// CAIXA E CONTAS — F2.3.
// Fluxo de caixa pela DATA DO DINHEIRO (pagamentos e recebimentos efetivos),
// separado do PREVISTO (contas em aberto por vencimento/previsão). Saldo das
// contas financeiras é GERENCIAL (saldo inicial informado + movimentos do
// Héfisto), não é saldo bancário conciliado. Taxas: cadastro do dono.

import { useState, useEffect, useMemo, useRef } from "react";
import { useERP } from "../../../context/ERPContext";
import {
  fetchFluxoCaixa, fetchSaldosContasFinanceiras, fetchTaxasMeioPagamento,
  salvarContaFinanceiraF23, cadastrarTaxa, encerrarTaxaMeio,
} from "../../../lib/financeiro";
import { TIPOS_CONTA_FIN, MEIOS_TAXA, MODALIDADES, rotuloMeio, rotuloModalidade, resumoFluxo, hojeLocal } from "../../../lib/contas-receber.mjs";
import { intervaloPeriodo, unidadeValida } from "../../../lib/contas-pagar.mjs";
import { X, Plus } from "lucide-react";
import { fmtBRL } from "../../../components/ui";

const fmtData = (d) => (d ? new Date(`${String(d).slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR") : "—");
const ROTULO_ORIGEM = { pagamento: "Pagamento", pagamento_legado: "Pagamento antigo (sem histórico)", recebimento: "Recebimento", conta_pagar: "Conta a pagar", conta_receber: "Conta a receber" };

export default function CaixaEContasPage() {
  const { unidadeAtiva } = useERP();
  const unidadeOk = unidadeValida(unidadeAtiva);
  const [aba, setAba] = useState("fluxo");
  const [periodoTipo, setPeriodoTipo] = useState("mes");
  const [custom, setCustom] = useState({ de: "", ate: "" });
  const [fluxo, setFluxo] = useState([]);
  const [contas, setContas] = useState([]);
  const [taxas, setTaxas] = useState([]);
  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(true);
  const [formConta, setFormConta] = useState(null);
  const [formTaxa, setFormTaxa] = useState(null);
  const [processando, setProcessando] = useState(false);
  const emAndamento = useRef(false);
  const executar = async (fn) => {
    if (emAndamento.current) return;
    emAndamento.current = true; setProcessando(true);
    try { await fn(); } finally { emAndamento.current = false; setProcessando(false); }
  };

  const hoje = hojeLocal();
  const periodo = intervaloPeriodo(periodoTipo, hoje, custom);

  const carregar = async () => {
    if (!unidadeOk) { setLoading(false); return; }
    setLoading(true);
    const [c, t] = await Promise.all([fetchSaldosContasFinanceiras(unidadeAtiva), fetchTaxasMeioPagamento(unidadeAtiva)]);
    const f = periodo ? await fetchFluxoCaixa(unidadeAtiva, periodo.de, periodo.ate) : { data: [] };
    setContas(c.data || []); setTaxas(t.data || []); setFluxo(f.data || []);
    setErro(c.error || t.error || f.error || ""); setLoading(false);
  };
  useEffect(() => { carregar(); }, [unidadeAtiva, periodoTipo, custom.de, custom.ate]);

  const resumo = useMemo(() => resumoFluxo(fluxo), [fluxo]);
  const saldoGerencial = contas.filter((c) => c.ativa).reduce((s, c) => s + Number(c.saldo_calculado || 0), 0);

  const salvarConta = (e) => {
    e.preventDefault();
    executar(async () => {
      const r = await salvarContaFinanceiraF23({ ...formConta, unidade_id: unidadeAtiva });
      if (r.error) return alert(`Não foi possível salvar: ${r.error}`);
      setFormConta(null); await carregar(); alert("Conta financeira salva.");
    });
  };
  const alternarAtiva = (c) => executar(async () => {
    const r = await salvarContaFinanceiraF23({ id: c.id, unidade_id: unidadeAtiva, ativa: !c.ativa });
    if (r.error) return alert(r.error);
    await carregar();
  });
  const salvarTaxa = (e) => {
    e.preventDefault();
    executar(async () => {
      const r = await cadastrarTaxa({ ...formTaxa, unidade_id: unidadeAtiva });
      if (r.error) return alert(`Não foi possível cadastrar: ${r.error}`);
      setFormTaxa(null); await carregar(); alert("Taxa cadastrada.");
    });
  };
  const encerrar = (t) => {
    if (!confirm("Encerrar esta taxa a partir de hoje? Os recebíveis já lançados mantêm a taxa que usaram.")) return;
    executar(async () => {
      const r = await encerrarTaxaMeio(t.id, unidadeAtiva);
      if (r.error) return alert(r.error);
      await carregar();
    });
  };

  if (!unidadeOk) return <div className="p-8 text-center font-bold text-fg">Selecione uma unidade.</div>;
  const sel = "p-2.5 bg-white border border-line rounded-2xl text-xs font-bold text-slate-800";
  const campo = "w-full p-2.5 bg-white border border-line rounded-xl font-bold text-slate-800 text-sm";

  return (
    <div className="min-h-screen pb-24 font-sans text-slate-800 bg-[var(--surface)]">
      <div className="bg-slate-900 pt-6 pb-5 px-4 sm:px-8 text-white">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl sm:text-4xl font-black tracking-tighter">Caixa e Contas</h1>
          <p className="text-subtle font-bold uppercase tracking-widest text-3xs sm:text-xs mt-1">Fluxo de caixa · contas financeiras · taxas</p>
          <div className="mt-4 flex gap-2 overflow-x-auto">
            {[["fluxo", "Fluxo de caixa"], ["contas", "Contas financeiras"], ["taxas", "Taxas de cartão/plataforma"]].map(([id, r]) => (
              <button key={id} onClick={() => setAba(id)} className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap ${aba === id ? "bg-emerald-500 text-slate-950" : "bg-slate-800 text-slate-300"}`}>{r}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-3 sm:px-6 mt-4 space-y-3">
        {erro && <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-800">Não foi possível carregar: {erro}</div>}

        {aba === "fluxo" && (
          <>
            <div className="flex flex-wrap gap-2">
              <select value={periodoTipo} onChange={(e) => setPeriodoTipo(e.target.value)} className={sel}>
                <option value="hoje">Hoje</option><option value="semana">Esta semana</option><option value="mes">Este mês</option><option value="personalizado">Personalizado</option>
              </select>
              {periodoTipo === "personalizado" && <>
                <input type="date" value={custom.de} onChange={(e) => setCustom({ ...custom, de: e.target.value })} className={sel} />
                <input type="date" value={custom.ate} onChange={(e) => setCustom({ ...custom, ate: e.target.value })} className={sel} />
              </>}
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="bg-card rounded-3xl border border-line p-4">
                <p className="text-3xs font-black uppercase text-emerald-700">Realizado (dinheiro que entrou/saiu)</p>
                <div className="grid grid-cols-3 gap-2 mt-2 text-xs">
                  <div><p className="text-fg font-bold">Entradas</p><p className="font-black text-emerald-700">{fmtBRL(resumo.realizado.entradas)}</p></div>
                  <div><p className="text-fg font-bold">Saídas</p><p className="font-black text-red-700">{fmtBRL(resumo.realizado.saidas)}</p></div>
                  <div><p className="text-fg font-bold">Saldo do período</p><p className="font-black">{fmtBRL(resumo.realizado.saldo)}</p></div>
                </div>
                {resumo.incluiLegado && <p className="text-3xs text-amber-700 mt-2">Inclui pagamentos antigos registrados sem histórico (data e valor da conta).</p>}
              </div>
              <div className="bg-card rounded-3xl border border-line p-4">
                <p className="text-3xs font-black uppercase text-sky-700">Previsto (contas em aberto no período — ainda não é dinheiro)</p>
                <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
                  <div><p className="text-fg font-bold">A receber (líquido)</p><p className="font-black">{fmtBRL(resumo.previsto.entradas)}</p></div>
                  <div><p className="text-fg font-bold">A pagar</p><p className="font-black">{fmtBRL(resumo.previsto.saidas)}</p></div>
                </div>
                {resumo.previsto.entradasIncompletas && <p className="text-3xs text-amber-700 mt-2">Há recebíveis com taxa não informada: o líquido previsto deles não entra na soma.</p>}
              </div>
            </div>
            <p className="text-3xs text-fg">Fluxo pela data do movimento financeiro (não competência). Lançamentos do extrato antigo (PDV/lançamentos manuais) ainda não entram aqui: o realizado mostra só pagamentos e recebimentos registrados no financeiro novo.</p>
            <div className="bg-card rounded-3xl border border-line overflow-hidden">
              {loading ? <p className="p-6 text-center font-bold text-fg">Carregando...</p>
                : !fluxo.length ? <p className="p-6 text-center text-sm font-bold">Nenhum movimento no período.</p>
                : <ul className="divide-y divide-line text-xs">{fluxo.map((l, i) => (
                  <li key={`${l.referencia_id}-${l.origem}-${i}`} className="p-3 flex justify-between gap-2">
                    <div>
                      <p className="font-bold">{fmtData(l.data)} · {ROTULO_ORIGEM[l.origem] || l.origem}</p>
                      <p className="text-3xs text-fg uppercase">{l.natureza === "realizado" ? "realizado" : "previsto"}</p>
                    </div>
                    <p className={`font-black ${l.direcao === "entrada" ? "text-emerald-700" : "text-red-700"} ${l.natureza === "previsto" ? "opacity-60" : ""}`}>
                      {l.direcao === "entrada" ? "+" : "−"} {l.valor == null ? "taxa não informada" : fmtBRL(l.valor)}
                    </p>
                  </li>))}</ul>}
            </div>
          </>
        )}

        {aba === "contas" && (
          <>
            <div className="bg-card rounded-3xl border border-line p-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-3xs font-black uppercase text-fg">Saldo gerencial do Héfisto (contas ativas)</p>
                <p className="text-2xl font-black">{contas.some((c) => c.ativa) ? fmtBRL(saldoGerencial) : "—"}</p>
                <p className="text-3xs text-fg">Saldo inicial informado + recebimentos − pagamentos registrados aqui. Não é o saldo conciliado do banco.</p>
              </div>
              <button onClick={() => setFormConta({ nome: "", tipo: "banco", saldo_inicial: "", saldo_inicial_em: hoje })} className="px-4 py-2.5 bg-emerald-500 text-white font-black rounded-xl text-sm inline-flex items-center gap-1"><Plus size={16} /> Nova conta</button>
            </div>
            {!contas.length ? <p className="text-sm font-bold text-center py-6">Nenhuma conta financeira cadastrada.</p> : (
              <ul className="bg-card rounded-3xl border border-line divide-y divide-line">
                {contas.map((c) => (
                  <li key={c.id} className="p-3 flex items-center justify-between gap-2 text-xs">
                    <div>
                      <p className="font-black text-sm">{c.nome} {!c.ativa && <span className="text-3xs bg-stone-200 px-2 py-0.5 rounded-full">inativa</span>}</p>
                      <p className="text-fg">{TIPOS_CONTA_FIN.find((t) => t.codigo === c.tipo)?.rotulo || c.tipo} · saldo inicial {fmtBRL(c.saldo_inicial)} em {fmtData(c.saldo_inicial_em)}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-sm">{fmtBRL(c.saldo_calculado)}</p>
                      <button disabled={processando} onClick={() => alternarAtiva(c)} className="text-3xs underline font-bold">{c.ativa ? "desativar" : "reativar"}</button>
                    </div>
                  </li>))}
              </ul>
            )}
          </>
        )}

        {aba === "taxas" && (
          <>
            <div className="bg-card rounded-3xl border border-line p-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-fg max-w-xl">Cadastre as taxas reais do seu contrato (ex.: Stone, crédito Visa/Master 1x, 3%). Sem cadastro, a taxa do recebível fica "não informada": o Héfisto não assume nenhum percentual.</p>
              <button onClick={() => setFormTaxa({ meio: "credito", adquirente: "", bandeira: "", modalidade: "a_vista", parcelas_min: 1, parcelas_max: 1, taxa_percentual: "", taxa_fixa: "", dias_para_recebimento: "", vigente_desde: hoje })}
                className="px-4 py-2.5 bg-emerald-500 text-white font-black rounded-xl text-sm inline-flex items-center gap-1"><Plus size={16} /> Nova taxa</button>
            </div>
            {!taxas.length ? <p className="text-sm font-bold text-center py-6">Nenhuma taxa cadastrada.</p> : (
              <ul className="bg-card rounded-3xl border border-line divide-y divide-line text-xs">
                {taxas.map((t) => (
                  <li key={t.id} className={`p-3 flex items-center justify-between gap-2 ${t.ativa ? "" : "opacity-50"}`}>
                    <div>
                      <p className="font-black">{rotuloMeio(t.meio)} · {t.adquirente || "qualquer adquirente"} · {t.bandeira || "qualquer bandeira"}</p>
                      <p className="text-fg">{rotuloModalidade(t.modalidade)} · {t.parcelas_min === t.parcelas_max ? `${t.parcelas_min}x` : `${t.parcelas_min}x a ${t.parcelas_max}x`} · D+{t.dias_para_recebimento} · desde {fmtData(t.vigente_desde)}{t.vigente_ate ? ` até ${fmtData(t.vigente_ate)}` : ""}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-black">{Number(t.taxa_percentual).toLocaleString("pt-BR")}%{Number(t.taxa_fixa) ? ` + ${fmtBRL(t.taxa_fixa)}` : ""}</p>
                      {t.ativa && <button disabled={processando} onClick={() => encerrar(t)} className="text-3xs underline font-bold">encerrar</button>}
                    </div>
                  </li>))}
              </ul>
            )}
          </>
        )}
      </div>

      {formConta && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 sm:p-4">
          <form onSubmit={salvarConta} className="bg-card rounded-t-3xl sm:rounded-3xl max-w-md w-full p-5 space-y-3">
            <div className="flex justify-between"><h3 className="text-lg font-black">Nova conta financeira</h3><button type="button" onClick={() => setFormConta(null)} disabled={processando}><X size={20} /></button></div>
            <label className="block"><span className="text-xs font-bold text-fg uppercase block mb-1">Nome</span>
              <input required value={formConta.nome} onChange={(e) => setFormConta({ ...formConta, nome: e.target.value })} className={campo} placeholder="Caixa do restaurante, Banco X, Stone…" /></label>
            <label className="block"><span className="text-xs font-bold text-fg uppercase block mb-1">Tipo</span>
              <select value={formConta.tipo} onChange={(e) => setFormConta({ ...formConta, tipo: e.target.value })} className={campo}>
                {TIPOS_CONTA_FIN.map((t) => <option key={t.codigo} value={t.codigo}>{t.rotulo}</option>)}
              </select></label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block"><span className="text-xs font-bold text-fg uppercase block mb-1">Saldo inicial real (R$)</span>
                <input required inputMode="decimal" value={formConta.saldo_inicial} onChange={(e) => setFormConta({ ...formConta, saldo_inicial: e.target.value })} className={campo} placeholder="ex.: 0,00" /></label>
              <label className="block"><span className="text-xs font-bold text-fg uppercase block mb-1">Na data</span>
                <input required type="date" max={hoje} value={formConta.saldo_inicial_em} onChange={(e) => setFormConta({ ...formConta, saldo_inicial_em: e.target.value })} className={campo} /></label>
            </div>
            <p className="text-3xs text-fg">O saldo inicial é o que a conta tinha de fato nessa data. Depois de salvo ele não muda (mudaria o histórico). Movimentos registrados depois dessa data entram no saldo gerencial.</p>
            <button type="submit" disabled={processando} className="w-full py-3 bg-emerald-500 text-white font-black rounded-xl disabled:opacity-60">{processando ? "Salvando..." : "Salvar"}</button>
          </form>
        </div>
      )}

      {formTaxa && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 sm:p-4">
          <form onSubmit={salvarTaxa} className="bg-card rounded-t-3xl sm:rounded-3xl max-w-md w-full p-5 space-y-3 max-h-[94vh] overflow-y-auto">
            <div className="flex justify-between"><h3 className="text-lg font-black">Nova taxa</h3><button type="button" onClick={() => setFormTaxa(null)} disabled={processando}><X size={20} /></button></div>
            <div className="grid grid-cols-2 gap-3">
              <label className="block"><span className="text-xs font-bold text-fg uppercase block mb-1">Meio</span>
                <select value={formTaxa.meio} onChange={(e) => setFormTaxa({ ...formTaxa, meio: e.target.value })} className={campo}>
                  {MEIOS_TAXA.map((m) => <option key={m} value={m}>{rotuloMeio(m)}</option>)}
                </select></label>
              <label className="block"><span className="text-xs font-bold text-fg uppercase block mb-1">Modalidade</span>
                <select value={formTaxa.modalidade} onChange={(e) => setFormTaxa({ ...formTaxa, modalidade: e.target.value })} className={campo}>
                  {MODALIDADES.map((m) => <option key={m.codigo} value={m.codigo}>{m.rotulo}</option>)}
                </select></label>
              <label className="block"><span className="text-xs font-bold text-fg uppercase block mb-1">Adquirente (vazio = qualquer)</span>
                <input value={formTaxa.adquirente} onChange={(e) => setFormTaxa({ ...formTaxa, adquirente: e.target.value })} className={campo} /></label>
              <label className="block"><span className="text-xs font-bold text-fg uppercase block mb-1">Bandeira (vazio = qualquer)</span>
                <input value={formTaxa.bandeira} onChange={(e) => setFormTaxa({ ...formTaxa, bandeira: e.target.value })} className={campo} /></label>
              <label className="block"><span className="text-xs font-bold text-fg uppercase block mb-1">Parcelas de</span>
                <input type="number" min="1" value={formTaxa.parcelas_min} onChange={(e) => setFormTaxa({ ...formTaxa, parcelas_min: e.target.value })} className={campo} /></label>
              <label className="block"><span className="text-xs font-bold text-fg uppercase block mb-1">até</span>
                <input type="number" min="1" value={formTaxa.parcelas_max} onChange={(e) => setFormTaxa({ ...formTaxa, parcelas_max: e.target.value })} className={campo} /></label>
              <label className="block"><span className="text-xs font-bold text-fg uppercase block mb-1">Taxa %</span>
                <input required inputMode="decimal" value={formTaxa.taxa_percentual} onChange={(e) => setFormTaxa({ ...formTaxa, taxa_percentual: e.target.value })} className={campo} /></label>
              <label className="block"><span className="text-xs font-bold text-fg uppercase block mb-1">Taxa fixa (R$)</span>
                <input inputMode="decimal" value={formTaxa.taxa_fixa} onChange={(e) => setFormTaxa({ ...formTaxa, taxa_fixa: e.target.value })} className={campo} placeholder="0,00" /></label>
              <label className="block"><span className="text-xs font-bold text-fg uppercase block mb-1">Cai em (dias)</span>
                <input required type="number" min="0" value={formTaxa.dias_para_recebimento} onChange={(e) => setFormTaxa({ ...formTaxa, dias_para_recebimento: e.target.value })} className={campo} /></label>
              <label className="block"><span className="text-xs font-bold text-fg uppercase block mb-1">Vale desde</span>
                <input required type="date" value={formTaxa.vigente_desde} onChange={(e) => setFormTaxa({ ...formTaxa, vigente_desde: e.target.value })} className={campo} /></label>
            </div>
            <button type="submit" disabled={processando} className="w-full py-3 bg-emerald-500 text-white font-black rounded-xl disabled:opacity-60">{processando ? "Salvando..." : "Cadastrar"}</button>
          </form>
        </div>
      )}
    </div>
  );
}
