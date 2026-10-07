"use client";

// COMPRAS → CUSTO MÉDIO → CONTA A PAGAR — F2.4B.
// Registro oficial da compra (nota): itens recebidos (e o que foi pedido),
// frete/desconto, forma de pagamento. CONFIRMAR grava no banco, numa transação:
// compra + ENTRADA NO ESTOQUE (EST-MOV-4: cada item no local escolhido, com a
// validade para o FEFO) + custo médio ponderado + histórico + conta a pagar.
// Cancelar a confirmada é do administrador, com PIN, e desfaz tudo junto.
// COMPRA ≠ CMV.

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useERP } from "../../../../context/ERPContext";
import {
  fetchBaseCompras, fetchCompras, fetchHistoricoCusto, gravarRascunhoCompra, confirmarCompraRegistro,
  cancelarCompraRegistro, novoFornecedor, faltaMigracaoF24B,
} from "../../../../lib/compras-registro";
import {
  FORMAS_PAGAMENTO, STATUS_COMPRA, rotuloForma, montarItemCompra, divergenciaPedido, totalCompra, resumoCompras,
  variacaoPct, custoNaUnidade, hojeLocal, novaChave, fmtQtd, entrouNoEstoque,
} from "../../../../lib/compras-estoque.mjs";
import { unidadeContagem, daBase } from "../../../../lib/contagem-estoque.mjs";
import { intervaloPeriodo, unidadeValida, lerValor } from "../../../../lib/contas-pagar.mjs";
import { hasPermission, permissionKey } from "../../../../lib/permissions-catalog.mjs";
import { fmtBRL } from "../../../../components/ui";
import { Plus, Search, X, Trash2, ShoppingCart, AlertTriangle, Loader2, History, Lock, Check } from "lucide-react";
import CampoDecimal from "../../../../components/CampoDecimal";

const fmtData = (d) => (d ? new Date(`${String(d).slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR") : "—");
const normal = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const COR = { rascunho: "bg-amber-100 text-amber-800", confirmada: "bg-emerald-100 text-emerald-800", cancelada: "bg-stone-200 text-stone-700" };
const fmtCusto = (v) => (v == null ? "—" : fmtBRL(v, Math.abs(v) < 1 ? 4 : 2));
const fmtPctS = (v) => (v == null ? "—" : `${v > 0 ? "+" : ""}${v.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`);
const campo = "w-full h-11 px-3 rounded-xl border border-line bg-white font-bold text-sm";
const estoquePadrao = (estoques, ins) => {
  const dept = String(ins?.departamento || "").toLowerCase();
  return (estoques.find((e) => e.slug === (dept === "bar" ? "bar" : "cozinha")) || estoques[0])?.id || "";
};
const formVazio = () => ({
  id: null, chave: novaChave(), fornecedor_id: "", numero_documento: "", data_compra: hojeLocal(), data_recebimento: hojeLocal(),
  forma_pagamento: "boleto", gerar_conta: true, data_vencimento: "", valor_frete: "", valor_desconto: "", observacao: "", itens: [],
});

export default function ComprasPage() {
  return <Suspense fallback={<p className="p-8 text-center font-bold text-fg">Carregando...</p>}><Compras /></Suspense>;
}

function Compras() {
  const { unidadeAtiva, sessao } = useERP();
  const router = useRouter();
  const params = useSearchParams();
  const aba = params.get("aba") || "compras";
  const irAba = (a) => router.replace(`/dashboard/operacao/estoque/compras${a === "compras" ? "" : `?aba=${a}`}`);
  const [base, setBase] = useState(null);
  const [lista, setLista] = useState({ compras: [], itens: [] });
  const [periodo, setPeriodo] = useState("mes");
  const [custom, setCustom] = useState({ de: "", ate: "" });
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [form, setForm] = useState(formVazio);
  const [detalhe, setDetalhe] = useState(null);
  const [processando, setProcessando] = useState(false);
  const pode = (acao) => !sessao?.gerenciado || hasPermission(sessao, permissionKey("estoque", "purchases", acao));
  // cancelar compra CONFIRMADA = estorno de estoque: administrador com o PIN (o banco confere)
  const podeAutorizar = !sessao?.gerenciado || hasPermission(sessao, "estoque.security.approve");

  const intervalo = intervaloPeriodo(periodo, hojeLocal(), custom);
  const carregar = useCallback(async () => {
    if (!unidadeValida(unidadeAtiva)) return;
    const b = await fetchBaseCompras(unidadeAtiva);
    const l = intervalo ? await fetchCompras(unidadeAtiva, intervalo.de, intervalo.ate) : { data: { compras: [], itens: [] } };
    setBase(b.data); setLista(l.data || { compras: [], itens: [] });
    setErro([b.error, l.error].filter(Boolean).join(" · ")); setCarregando(false);
  }, [unidadeAtiva, intervalo?.de, intervalo?.ate]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { carregar(); }, [carregar]);

  const insumoPorId = useMemo(() => new Map((base?.insumos || []).map((i) => [i.id, i])), [base]);
  const fornecedorPorId = useMemo(() => new Map((base?.fornecedores || []).map((f) => [f.id, f])), [base]);
  const executar = async (fn) => { if (processando) return; setProcessando(true); try { await fn(); } finally { setProcessando(false); } };

  if (!unidadeValida(unidadeAtiva)) return <p className="p-8 text-center font-bold text-fg">Selecione uma unidade para registrar compras.</p>;
  const semMigracao = faltaMigracaoF24B(erro);

  return (
    <div className="min-h-screen pb-24 bg-[var(--surface)] text-slate-800">
      <div className="bg-slate-900 px-4 sm:px-8 pt-6 pb-5 text-white">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-4xl font-black tracking-tighter">Compras</h1>
            <p className="text-subtle font-bold uppercase tracking-widest text-3xs sm:text-xs mt-1">Entrada de mercadoria · custo médio · conta a pagar · compra não é CMV</p>
          </div>
          {pode("create") && <button onClick={() => { setForm(formVazio()); irAba("nova"); }} className="px-4 py-3 bg-emerald-500 hover:bg-emerald-600 font-black rounded-2xl flex items-center gap-2 text-sm"><Plus size={18} /> Nova compra</button>}
        </div>
        <div className="max-w-6xl mx-auto mt-4 flex gap-2">
          {[["compras", "Compras"], ["nova", form.id ? "Editar rascunho" : "Nova compra"], ["custos", "Custo médio"]].map(([id, r]) => (
            <button key={id} onClick={() => irAba(id)} className={`px-4 py-2 rounded-xl text-sm font-black ${aba === id ? "bg-emerald-500" : "bg-slate-800 border border-slate-700"}`}>{r}</button>
          ))}
        </div>
      </div>
      <div className="max-w-6xl mx-auto px-3 sm:px-8 mt-4 space-y-4">
        {semMigracao
          ? <p className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm font-bold">O banco ainda não recebeu a atualização da F2.4B (db/F2_4B_COMPRAS_CUSTO_MEDIO.sql). Compras ficam disponíveis depois que ela for aplicada.</p>
          : erro && <p className="text-sm font-bold text-red-700">Parte dos dados não carregou: {erro}</p>}
        {carregando ? <p className="p-6 text-center font-bold text-fg">Carregando...</p> : !semMigracao && base && (
          <>
            {aba === "compras" && <ListaCompras lista={lista} base={base} insumoPorId={insumoPorId} fornecedorPorId={fornecedorPorId} periodo={periodo} setPeriodo={setPeriodo}
              custom={custom} setCustom={setCustom} onAbrir={setDetalhe} onEditar={(c) => { setForm(formDoRascunho(c, lista.itens, insumoPorId)); irAba("nova"); }} />}
            {aba === "nova" && (pode("create")
              ? <FormCompra form={form} setForm={setForm} base={base} insumoPorId={insumoPorId} processando={processando} unidade={unidadeAtiva}
                  podeConfirmar={pode("confirm")} executar={executar} onFeito={async () => { setForm(formVazio()); await carregar(); irAba("compras"); }}
                  onFornecedor={async (nome) => { const r = await novoFornecedor({ unidade_id: unidadeAtiva, nome }); if (r.error) { alert(`Não foi possível cadastrar: ${r.error}`); return null; } await carregar(); return r.data; }} />
              : <p className="p-6 text-center font-bold text-fg">Você não tem permissão para registrar compras.</p>)}
            {aba === "custos" && <Custos base={base} insumoPorId={insumoPorId} unidade={unidadeAtiva} />}
          </>
        )}
      </div>
      {detalhe && <DetalheCompra compra={detalhe} itens={lista.itens.filter((i) => i.compra_id === detalhe.id)} insumoPorId={insumoPorId} fornecedorPorId={fornecedorPorId}
        estoques={base?.estoques || []} unidade={unidadeAtiva} podeCancelar={pode("cancel")} podeAutorizar={podeAutorizar} processando={processando} executar={executar}
        onFechar={() => setDetalhe(null)} onMudou={async () => { setDetalhe(null); await carregar(); }}
        onEditar={(c) => { setDetalhe(null); setForm(formDoRascunho(c, lista.itens, insumoPorId)); irAba("nova"); }} />}
    </div>
  );
}

function formDoRascunho(c, itens, insumoPorId) {
  return {
    id: c.id, chave: c.chave_idempotencia || novaChave(), fornecedor_id: c.fornecedor_id || "", numero_documento: c.numero_documento || "",
    data_compra: c.data_compra, data_recebimento: c.data_recebimento || c.data_compra, forma_pagamento: c.forma_pagamento || "boleto",
    gerar_conta: true, data_vencimento: c.data_vencimento || "", valor_frete: c.valor_frete ? String(c.valor_frete).replace(".", ",") : "",
    valor_desconto: c.valor_desconto ? String(c.valor_desconto).replace(".", ",") : "", observacao: c.observacao || "",
    itens: itens.filter((i) => i.compra_id === c.id).map((i) => {
      const ins = insumoPorId.get(i.insumo_id) || { id: i.insumo_id, nome: i.descricao_snapshot, unidade_medida: i.unidade_base };
      const fator = unidadeContagem(ins.unidade_medida).fator;
      const emEmb = Number(i.conteudo_por_embalagem) !== fator;
      return {
        k: novaChave(), insumo: ins, estoque_id: i.estoque_id || "",
        quantidade: emEmb ? "" : String(i.quantidade_embalagens).replace(".", ","),
        embalagens: emEmb ? String(i.quantidade_embalagens).replace(".", ",") : "", conteudo: emEmb ? String(Number(i.conteudo_por_embalagem) / fator).replace(".", ",") : "",
        emEmbalagens: emEmb, valor_total: String(i.valor_total).replace(".", ","),
        quantidade_pedida: i.quantidade_pedida_embalagens != null ? String(i.quantidade_pedida_embalagens).replace(".", ",") : "",
        valor_pedido: i.valor_pedido != null ? String(i.valor_pedido).replace(".", ",") : "", verPedido: i.quantidade_pedida_embalagens != null || i.valor_pedido != null,
        validade: i.validade ? String(i.validade).slice(0, 10) : "", lote: i.lote || "",
      };
    }),
  };
}

// ═══ LISTA + RESUMO DO PERÍODO ══════════════════════════════════════════════
function ListaCompras({ lista, insumoPorId, fornecedorPorId, periodo, setPeriodo, custom, setCustom, onAbrir, onEditar }) {
  const resumo = resumoCompras(lista.compras, lista.itens, { insumoPorId, fornecedorPorId });
  const rascunhos = lista.compras.filter((c) => c.status === "rascunho");
  const doPeriodo = lista.compras.filter((c) => c.status !== "rascunho");
  return (
    <>
      <div className="flex flex-wrap gap-2 items-center">
        <select value={periodo} onChange={(e) => setPeriodo(e.target.value)} className="h-11 px-3 rounded-xl border border-line bg-white font-bold text-sm">
          <option value="semana">Esta semana</option><option value="mes">Este mês</option><option value="personalizado">Personalizado</option>
        </select>
        {periodo === "personalizado" && <>
          <input type="date" value={custom.de} onChange={(e) => setCustom({ ...custom, de: e.target.value })} className="h-11 px-3 rounded-xl border border-line bg-white font-bold text-sm" />
          <input type="date" value={custom.ate} onChange={(e) => setCustom({ ...custom, ate: e.target.value })} className="h-11 px-3 rounded-xl border border-line bg-white font-bold text-sm" />
        </>}
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        {[["Total comprado (confirmadas)", fmtBRL(resumo.total)], ["Compras confirmadas", String(resumo.quantidade)], ["Fornecedores", String(resumo.fornecedores.length)], ["Rascunhos em aberto", String(rascunhos.length)]].map(([r, v]) => (
          <div key={r} className="bg-card rounded-2xl border border-line p-3"><p className="text-3xs font-black uppercase text-fg">{r}</p><p className="text-xl font-black">{v}</p></div>
        ))}
      </div>
      <p className="text-3xs text-fg">Compra vira estoque e, se escolhido, conta a pagar. Não é CMV: o CMV real sai de estoque inicial + compras − estoque final.</p>
      {rascunhos.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3">
          <p className="font-black text-sm">Rascunhos (ainda não entraram no custo nem no financeiro)</p>
          {rascunhos.map((c) => (
            <div key={c.id} className="flex justify-between items-center py-1 text-sm gap-2">
              <span>{fmtData(c.data_compra)} · {fornecedorPorId.get(c.fornecedor_id)?.nome || "sem fornecedor"} · {c.numero_documento || "sem documento"} · {fmtBRL(c.valor_total)}</span>
              <button onClick={() => onEditar(c)} className="px-3 py-1 rounded-lg bg-white border border-line text-xs font-black">Continuar</button>
            </div>
          ))}
        </div>
      )}
      <div className="grid lg:grid-cols-2 gap-3">
        <div className="bg-card rounded-2xl border border-line p-3">
          <p className="font-black text-sm mb-2">Produtos com maior valor comprado</p>
          {!resumo.topValor.length ? <p className="text-xs text-fg">Nenhuma compra confirmada no período.</p>
            : resumo.topValor.slice(0, 8).map((p) => {
              const um = insumoPorId.get(p.insumo_id)?.unidade_medida;
              return <div key={p.insumo_id} className="flex justify-between text-xs py-1 border-t border-line"><span className="font-bold">{p.nome}</span><span>{fmtQtd(daBase(p.quantidade_base, um))} {unidadeContagem(um).rotulo} · <b>{fmtBRL(p.valor)}</b></span></div>;
            })}
        </div>
        <div className="bg-card rounded-2xl border border-line p-3">
          <p className="font-black text-sm mb-2">Fornecedores</p>
          {!resumo.fornecedores.length ? <p className="text-xs text-fg">—</p>
            : resumo.fornecedores.map((f) => <div key={f.fornecedor_id || "x"} className="flex justify-between text-xs py-1 border-t border-line"><span className="font-bold">{f.nome}</span><span>{f.compras} compra(s) · <b>{fmtBRL(f.valor)}</b></span></div>)}
        </div>
      </div>
      <div className="bg-card rounded-2xl border border-line overflow-hidden">
        {!doPeriodo.length ? <p className="p-6 text-center text-sm font-bold text-fg">Nenhuma compra no período.</p>
          : <ul className="divide-y divide-line">{doPeriodo.map((c) => (
            <li key={c.id}><button onClick={() => onAbrir(c)} className="w-full text-left p-3 flex justify-between gap-3 hover:bg-white">
              <div>
                <p className="font-black">{fmtData(c.data_compra)} · {fornecedorPorId.get(c.fornecedor_id)?.nome || "Fornecedor não informado"}</p>
                <p className="text-xs text-fg">{c.numero_documento || "sem documento"} · {c.qtd_itens} item(ns) · {rotuloForma(c.forma_pagamento)}{c.conta_pagar_id ? " · conta a pagar gerada" : ""}</p>
              </div>
              <div className="text-right"><span className={`px-2 py-0.5 rounded-full text-3xs font-black uppercase ${COR[c.status]}`}>{STATUS_COMPRA[c.status]}</span><p className="font-black mt-1">{fmtBRL(c.valor_total)}</p></div>
            </button></li>
          ))}</ul>}
      </div>
    </>
  );
}

// ═══ NOVA COMPRA / RASCUNHO ═════════════════════════════════════════════════
function FormCompra({ form, setForm, base, insumoPorId, processando, unidade, podeConfirmar, executar, onFeito, onFornecedor }) {
  const [busca, setBusca] = useState("");
  const [confirmando, setConfirmando] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });
  const setItem = (k, patch) => setForm({ ...form, itens: form.itens.map((i) => (i.k === k ? { ...i, ...patch } : i)) });
  const termo = normal(busca.trim());
  const achados = termo.length >= 2 ? base.insumos.filter((i) => normal(i.nome).includes(termo) || normal(i.nome_interno).includes(termo) || normal(i.codigo_interno).includes(termo)).slice(0, 12) : [];
  const adicionar = (ins) => {
    setForm({ ...form, itens: [...form.itens, { k: novaChave(), insumo: ins, estoque_id: estoquePadrao(base.estoques, ins), quantidade: "", embalagens: "", conteudo: "", emEmbalagens: false, valor_total: "", quantidade_pedida: "", valor_pedido: "", verPedido: false, validade: "", lote: "" }] });
    setBusca("");
  };
  const montados = form.itens.map((it) => ({ it, m: montarItemCompra(it.emEmbalagens ? { ...it, quantidade: "" } : { ...it, embalagens: "", conteudo: "" }) }));
  const tot = totalCompra(montados.map(({ it }) => lerValor(it.valor_total)), form.valor_frete, form.valor_desconto);
  const erros = montados.filter(({ m }) => m.erro).map(({ m }) => m.erro);
  const paraSalvar = () => ({ compra: { ...form, unidade_id: unidade }, itens: form.itens.map((it) => (it.emEmbalagens ? { ...it, quantidade: "" } : { ...it, embalagens: "", conteudo: "" })), chave: form.chave });

  const salvar = () => executar(async () => {
    const r = await gravarRascunhoCompra(paraSalvar());
    if (r.error) return alert(`Não foi possível salvar: ${r.error}`);
    setForm({ ...form, id: r.data.id });
    alert("Rascunho salvo. Ele ainda não entrou no custo nem no financeiro.");
  });
  const confirmar = () => executar(async () => {
    const s = await gravarRascunhoCompra({ ...paraSalvar(), compra: { ...paraSalvar().compra, id: form.id } });
    if (s.error) return alert(`Não foi possível salvar: ${s.error}`);
    const r = await confirmarCompraRegistro({ compra_id: s.data.id, gerar_conta_pagar: form.gerar_conta, data_vencimento: form.data_vencimento || null });
    if (r.error) { setForm({ ...form, id: s.data.id }); return alert(`Compra salva como rascunho, mas não foi confirmada: ${r.error}`); }
    setConfirmando(false);
    const est = r.data.entradas_estoque;
    alert(`Compra confirmada: ${fmtBRL(r.data.valor_total ?? tot.total)}.${est != null ? ` ${est} produto(s) entraram no estoque.` : " Atenção: o banco ainda não dá entrada no estoque pela compra (falta a atualização EST-MOV-4)."}${r.data.conta_pagar_id ? " Conta a pagar gerada." : ""} Custo médio atualizado.`);
    await onFeito();
  });
  const novoForn = async () => {
    const nome = window.prompt("Nome do fornecedor:");
    if (!nome) return;
    const f = await onFornecedor(nome);
    if (f) setForm({ ...form, fornecedor_id: f.id });
  };

  return (
    <div className="space-y-3">
      <div className="bg-card rounded-2xl border border-line p-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <label className="block"><span className="text-xs font-bold uppercase text-fg">Fornecedor</span>
          <div className="flex gap-1 mt-1">
            <select value={form.fornecedor_id} onChange={set("fornecedor_id")} className={campo}>
              <option value="">Não informado</option>
              {base.fornecedores.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
            </select>
            <button type="button" onClick={novoForn} className="px-3 rounded-xl bg-slate-900 text-white text-xs font-black whitespace-nowrap">+ novo</button>
          </div>
          {base.avisoFornecedores && <span className="text-3xs text-amber-700">Não foi possível ler os fornecedores: {base.avisoFornecedores}</span>}</label>
        <label className="block"><span className="text-xs font-bold uppercase text-fg">Nº da nota / documento</span><input value={form.numero_documento} onChange={set("numero_documento")} className={`${campo} mt-1`} /></label>
        <label className="block"><span className="text-xs font-bold uppercase text-fg">Forma de pagamento</span>
          <select value={form.forma_pagamento} onChange={set("forma_pagamento")} className={`${campo} mt-1`}>{FORMAS_PAGAMENTO.map((f) => <option key={f.codigo} value={f.codigo}>{f.rotulo}</option>)}</select></label>
        <label className="block"><span className="text-xs font-bold uppercase text-fg">Data da compra</span><input type="date" max={hojeLocal()} value={form.data_compra} onChange={set("data_compra")} className={`${campo} mt-1`} /></label>
        <label className="block"><span className="text-xs font-bold uppercase text-fg">Data do recebimento</span><input type="date" max={hojeLocal()} min={form.data_compra} value={form.data_recebimento} onChange={set("data_recebimento")} className={`${campo} mt-1`} /></label>
        <div className="block">
          <label className="flex items-center gap-2 text-xs font-bold uppercase text-fg"><input type="checkbox" checked={form.gerar_conta} onChange={set("gerar_conta")} /> Gerar conta a pagar</label>
          {form.gerar_conta ? <input type="date" value={form.data_vencimento} onChange={set("data_vencimento")} className={`${campo} mt-1`} placeholder="vencimento" />
            : <p className="text-3xs text-fg mt-2">Sem conta: use quando já foi pago e lançado de outra forma.</p>}
          {form.gerar_conta && <span className="text-3xs text-fg">Vencimento da conta</span>}
        </div>
        <label className="block"><span className="text-xs font-bold uppercase text-fg">Frete (R$)</span><CampoDecimal value={form.valor_frete} onChange={set("valor_frete")} placeholder="0,00" className={`${campo} mt-1`} /></label>
        <label className="block"><span className="text-xs font-bold uppercase text-fg">Desconto (R$)</span><CampoDecimal value={form.valor_desconto} onChange={set("valor_desconto")} placeholder="0,00" className={`${campo} mt-1`} /></label>
        <label className="block"><span className="text-xs font-bold uppercase text-fg">Observação</span><input value={form.observacao} onChange={set("observacao")} className={`${campo} mt-1`} /></label>
      </div>

      <div className="bg-card rounded-2xl border border-line p-3">
        <div className="flex items-center gap-2 px-1">
          <Search size={18} className="text-fg" />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Adicionar produto: digite o nome ou código" className="flex-1 h-11 bg-transparent font-bold outline-none" />
        </div>
        {achados.length > 0 && <div className="mt-2 grid sm:grid-cols-2 gap-1">{achados.map((i) => (
          <button key={i.id} onClick={() => adicionar(i)} className="text-left p-2 rounded-xl bg-white border border-line hover:border-emerald-500 text-sm"><b>{i.nome}</b> <span className="text-xs text-fg">· {unidadeContagem(i.unidade_medida).rotulo}{i.categoria ? ` · ${i.categoria}` : ""}</span></button>
        ))}</div>}
        {termo.length >= 2 && !achados.length && <p className="text-xs text-fg mt-2 px-1">Nenhum produto com esse nome. Cadastre o produto em Produtos antes de lançar a compra.</p>}
      </div>

      <div className="space-y-2">
        {montados.map(({ it, m }) => {
          const uc = unidadeContagem(it.insumo?.unidade_medida);
          const cm = base.custos[it.insumo.id];
          const custoAtual = cm ? custoNaUnidade(cm.custo_medio_base, it.insumo.unidade_medida) : null;
          const varia = m.precoPorUnidade != null ? variacaoPct(m.precoPorUnidade, custoAtual) : null;
          const div = m.linha && (it.quantidade_pedida || it.valor_pedido) ? divergenciaPedido(m.linha, it.insumo.unidade_medida) : null;
          return (
            <div key={it.k} className="bg-white rounded-2xl border border-line p-3">
              <div className="flex justify-between gap-2">
                <p className="font-black">{it.insumo.nome} <span className="text-xs text-fg font-bold">· {uc.rotulo}</span></p>
                <button onClick={() => setForm({ ...form, itens: form.itens.filter((x) => x.k !== it.k) })} aria-label="Remover" className="text-fg"><Trash2 size={16} /></button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
                <select value={it.estoque_id} onChange={(e) => setItem(it.k, { estoque_id: e.target.value })} className={campo}>
                  <option value="">Estoque: onde o produto já está</option>{base.estoques.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
                </select>
                {it.emEmbalagens ? (
                  <div className="flex gap-1 col-span-1">
                    <input inputMode="decimal" value={it.embalagens} onChange={(e) => setItem(it.k, { embalagens: e.target.value })} placeholder="embalagens" className={campo} />
                    <input inputMode="decimal" value={it.conteudo} onChange={(e) => setItem(it.k, { conteudo: e.target.value })} placeholder={`${uc.rotulo} cada`} className={campo} />
                  </div>
                ) : <input inputMode="decimal" value={it.quantidade} onChange={(e) => setItem(it.k, { quantidade: e.target.value })} placeholder={`quantidade recebida (${uc.rotulo})`} className={campo} />}
                <CampoDecimal value={it.valor_total} onChange={(e) => setItem(it.k, { valor_total: e.target.value })} placeholder="valor total cobrado (R$)" className={campo} />
                <div className="text-xs">
                  <p>Preço: <b>{m.precoPorUnidade != null ? `${fmtCusto(m.precoPorUnidade)}/${uc.rotulo}` : "—"}</b></p>
                  <p className="text-fg">Custo médio atual: {custoAtual != null ? `${fmtCusto(custoAtual)}/${uc.rotulo}` : "sem histórico"}{varia != null && <b className={varia > 0 ? " text-red-700" : " text-emerald-700"}> ({fmtPctS(varia)})</b>}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-3 mt-2 text-xs">
                <label className="flex items-center gap-1"><input type="checkbox" checked={it.emEmbalagens} onChange={(e) => setItem(it.k, { emEmbalagens: e.target.checked })} /> Informar em embalagens (ex.: 2 caixas × 5 {uc.rotulo})</label>
                <label className="flex items-center gap-1"><input type="checkbox" checked={it.verPedido} onChange={(e) => setItem(it.k, { verPedido: e.target.checked })} /> Comparar com o pedido</label>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <label className="block"><span className="text-3xs font-black uppercase text-fg">Validade (opcional)</span>
                  <input type="date" value={it.validade || ""} onChange={(e) => setItem(it.k, { validade: e.target.value })} className={`${campo} mt-1`} /></label>
                <label className="block"><span className="text-3xs font-black uppercase text-fg">Lote (opcional)</span>
                  <input value={it.lote || ""} onChange={(e) => setItem(it.k, { lote: e.target.value })} className={`${campo} mt-1`} /></label>
              </div>
              {it.verPedido && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2 items-center">
                  <input inputMode="decimal" value={it.quantidade_pedida} onChange={(e) => setItem(it.k, { quantidade_pedida: e.target.value })} placeholder={it.emEmbalagens ? "embalagens pedidas" : `quantidade pedida (${uc.rotulo})`} className={campo} />
                  <CampoDecimal value={it.valor_pedido} onChange={(e) => setItem(it.k, { valor_pedido: e.target.value })} placeholder="valor pedido (R$)" className={campo} />
                  {div && <p className="text-xs sm:col-span-2">Pedido {fmtQtd(div.pedida)} × recebido {fmtQtd(div.recebida)} {uc.rotulo}: <b className={div.diferencaQtd < 0 ? "text-red-700" : ""}>{div.diferencaQtd != null ? `${div.diferencaQtd > 0 ? "+" : ""}${fmtQtd(div.diferencaQtd)} ${uc.rotulo}` : "—"}</b>{div.variacaoPrecoPct != null && <> · preço {fmtPctS(div.variacaoPrecoPct)}</>}</p>}
                </div>
              )}
              {m.erro && it.valor_total !== "" && <p className="text-xs text-amber-700 mt-1">{m.erro}</p>}
            </div>
          );
        })}
        {!form.itens.length && <p className="p-4 text-center text-sm text-fg">Adicione os produtos da nota pela busca acima.</p>}
      </div>

      <div className="bg-card rounded-2xl border border-line p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm">
          <p>Itens {fmtBRL(tot.itens)} + frete {fmtBRL(lerValor(form.valor_frete) || 0)} − desconto {fmtBRL(lerValor(form.valor_desconto) || 0)}</p>
          <p className="text-xl font-black">Total {fmtBRL(tot.total)}</p>
          {erros.length > 0 && <p className="text-xs text-amber-700">{erros.length} item(ns) incompleto(s).</p>}
        </div>
        <div className="flex gap-2">
          <button disabled={processando || !form.itens.length} onClick={salvar} className="h-12 px-4 rounded-2xl bg-slate-100 font-black disabled:opacity-40">Salvar rascunho</button>
          {podeConfirmar && <button disabled={processando || !form.itens.length || erros.length > 0 || (form.gerar_conta && !form.data_vencimento)} onClick={() => setConfirmando(true)}
            className="h-12 px-5 rounded-2xl bg-emerald-500 text-white font-black disabled:opacity-40 flex items-center gap-2"><ShoppingCart size={18} /> Confirmar compra</button>}
        </div>
      </div>

      {confirmando && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-end sm:items-center justify-center sm:p-4">
          <div className="bg-card w-full max-w-md rounded-t-3xl sm:rounded-3xl p-5 space-y-3">
            <div className="flex justify-between"><h3 className="font-black text-lg">Confirmar compra</h3><button onClick={() => setConfirmando(false)} aria-label="Fechar"><X size={20} /></button></div>
            <p className="text-sm">Total <b>{fmtBRL(tot.total)}</b> · {form.itens.length} produto(s) · {rotuloForma(form.forma_pagamento)}</p>
            <ul className="text-xs list-disc pl-5 space-y-1">
              <li>Cada produto <b>entra no estoque</b> escolhido (sem estoque escolhido: no único em que ele já está), com a validade informada. A entrada fica no histórico com o seu nome: <b>não lance de novo</b> em Entrada e retirada.</li>
              <li>O custo médio de cada produto será atualizado (frete e desconto rateados).</li>
              <li>{form.gerar_conta ? <>Será gerada uma conta a pagar de <b>{fmtBRL(tot.total)}</b> com vencimento em <b>{fmtData(form.data_vencimento)}</b>, categoria Mercadoria (não é despesa).</> : "Nenhuma conta a pagar será gerada."}</li>
              <li>Compra não é CMV. Depois de confirmada, a compra não muda: correção é pelo cancelamento (administrador com PIN), que desfaz estoque, custo e conta juntos.</li>
            </ul>
            <div className="flex gap-2">
              <button onClick={() => setConfirmando(false)} disabled={processando} className="h-12 px-4 rounded-2xl bg-slate-100 font-bold">Voltar</button>
              <button onClick={confirmar} disabled={processando} className="flex-1 h-12 rounded-2xl bg-emerald-500 text-white font-black flex items-center justify-center gap-2">
                {processando ? <><Loader2 size={18} className="animate-spin" /> Confirmando...</> : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══ DETALHE: itens, pedido × recebido, custo antes → depois, cancelar ══════
function DetalheCompra({ compra, itens, insumoPorId, fornecedorPorId, estoques, unidade, podeCancelar, podeAutorizar, processando, executar, onFechar, onMudou, onEditar }) {
  const [hist, setHist] = useState([]);
  const [cancelando, setCancelando] = useState(null);
  const confirmada = compra.status === "confirmada";
  const comEntrada = itens.some(entrouNoEstoque);
  useEffect(() => { if (compra.status !== "rascunho") fetchHistoricoCusto(unidade, { compraId: compra.id }).then((r) => setHist(r.data || [])); }, [compra.id, compra.status, unidade]);
  const nomeEst = (id) => estoques.find((e) => e.id === id)?.nome || "—";
  const cancelar = () => executar(async () => {
    const r = await cancelarCompraRegistro({ compra_id: compra.id, motivo: cancelando.motivo, pin: confirmada ? cancelando.pin : null });
    if (r.error) return setCancelando({ ...cancelando, pin: r.pin ? "" : cancelando.pin, erro: r.error });
    setCancelando(null);
    alert(`Compra cancelada. Ela continua no histórico.${r.data?.estornos_estoque ? ` ${r.data.estornos_estoque} entrada(s) no estoque estornada(s).` : ""}`);
    await onMudou();
  });
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-end sm:items-center justify-center sm:p-4">
      <div className="bg-card w-full max-w-3xl rounded-t-3xl sm:rounded-3xl max-h-[94vh] flex flex-col">
        <div className="p-5 pb-3 border-b border-line flex justify-between">
          <div>
            <span className={`px-2 py-0.5 rounded-full text-3xs font-black uppercase ${COR[compra.status]}`}>{STATUS_COMPRA[compra.status]}</span>
            <h3 className="font-black text-lg mt-1">{fornecedorPorId.get(compra.fornecedor_id)?.nome || "Fornecedor não informado"} · {fmtBRL(compra.valor_total)}</h3>
            <p className="text-xs text-fg">Compra {fmtData(compra.data_compra)} · recebida {fmtData(compra.data_recebimento)} · {compra.numero_documento || "sem documento"} · {rotuloForma(compra.forma_pagamento)}</p>
          </div>
          <button onClick={onFechar} aria-label="Fechar"><X size={20} /></button>
        </div>
        <div className="p-5 overflow-y-auto space-y-3">
          <div className="overflow-x-auto"><table className="w-full text-xs">
            <thead><tr className="text-left text-fg"><th className="py-1">Produto</th><th>Local</th><th className="text-right">Recebido</th><th className="text-right">Preço</th><th className="text-right">Valor</th><th className="text-right">Pedido × recebido</th></tr></thead>
            <tbody>{itens.map((i) => {
              const ins = insumoPorId.get(i.insumo_id); const um = ins?.unidade_medida; const uc = unidadeContagem(um);
              const qtd = daBase(Number(i.quantidade_base ?? i.quantidade_embalagens * i.conteudo_por_embalagem), um);
              const d = divergenciaPedido(i, um);
              return (
                <tr key={i.id} className="border-t border-line">
                  <td className="py-1 font-bold">{ins?.nome || i.descricao_snapshot}{i.validade && <span className="block text-3xs font-bold text-fg">validade {fmtData(i.validade)}{i.lote ? ` · lote ${i.lote}` : ""}</span>}</td>
                  <td>{nomeEst(i.estoque_id)}{entrouNoEstoque(i) && <span className="block text-3xs font-black text-emerald-700"><Check size={10} className="inline" /> entrou no estoque</span>}</td>
                  <td className="text-right">{fmtQtd(qtd)} {uc.rotulo}</td>
                  <td className="text-right">{qtd > 0 ? `${fmtCusto(Number(i.valor_total) / qtd)}/${uc.rotulo}` : "—"}</td>
                  <td className="text-right font-black">{fmtBRL(i.valor_total)}</td>
                  <td className={`text-right ${d?.diferencaQtd < 0 ? "text-red-700 font-black" : ""}`}>{d ? `${d.diferencaQtd != null ? `${d.diferencaQtd > 0 ? "+" : ""}${fmtQtd(d.diferencaQtd)} ${uc.rotulo}` : ""}${d.variacaoPrecoPct != null ? ` · preço ${fmtPctS(d.variacaoPrecoPct)}` : ""}` : "—"}</td>
                </tr>);
            })}</tbody>
          </table></div>
          <p className="text-xs">Itens {fmtBRL(compra.valor_itens)} + frete {fmtBRL(compra.valor_frete)} − desconto {fmtBRL(compra.valor_desconto)} = <b>{fmtBRL(compra.valor_total)}</b></p>
          {hist.length > 0 && (
            <div>
              <p className="font-black text-sm">Custo médio: antes → depois</p>
              {hist.map((h) => {
                const um = insumoPorId.get(h.insumo_id)?.unidade_medida; const rot = unidadeContagem(um).rotulo;
                return <p key={h.id} className="text-xs">{insumoPorId.get(h.insumo_id)?.nome || "—"}: {h.origem_tipo === "ESTORNO_COMPRA" ? "estorno · " : ""}{fmtCusto(custoNaUnidade(h.custo_medio_anterior, um))} → <b>{fmtCusto(custoNaUnidade(h.custo_medio_novo, um))}</b>/{rot} (entrada a {fmtCusto(custoNaUnidade(h.custo_entrada, um))}/{rot})</p>;
              })}
            </div>
          )}
          {confirmada && !comEntrada && <p className="text-xs rounded-xl bg-amber-50 border border-amber-300 p-2">Confirmada antes da entrada automática no estoque: esta compra não mexeu no saldo.</p>}
          {compra.conta_pagar_id && <p className="text-xs">Conta a pagar gerada: veja em <a className="underline font-bold" href="/dashboard/financeiro/contas">Financeiro → Contas a Pagar</a>.</p>}
          {compra.status === "cancelada" && <p className="text-xs text-fg">Cancelada: {compra.motivo_cancelamento}</p>}
          {compra.observacao && <p className="text-xs text-fg">Obs.: {compra.observacao}</p>}
        </div>
        {cancelando ? (
          <div className="p-4 border-t border-line space-y-2">
            <p className="font-black text-sm">{confirmada ? "Cancelar compra confirmada" : "Cancelar rascunho"}</p>
            {confirmada && <p className="text-xs">Desfaz junto: {comEntrada ? "a entrada no estoque (estorno; o lançamento original continua no histórico), " : ""}o custo médio e a conta a pagar sem pagamento. Se parte já saiu do estoque, não cancela.</p>}
            <input value={cancelando.motivo} onChange={(e) => setCancelando({ ...cancelando, motivo: e.target.value, erro: "" })} placeholder="Motivo do cancelamento" className={campo} />
            {confirmada && <input type="password" inputMode="numeric" autoComplete="off" value={cancelando.pin} onChange={(e) => setCancelando({ ...cancelando, pin: e.target.value.replace(/\D/g, "").slice(0, 8), erro: "" })}
              placeholder="PIN do administrador" className={`${campo} tracking-widest`} />}
            {cancelando.erro && <p className="text-xs font-bold text-red-700">{cancelando.erro}</p>}
            <div className="flex gap-2">
              <button onClick={() => setCancelando(null)} disabled={processando} className="h-11 px-4 rounded-xl bg-slate-100 font-bold text-sm">Voltar</button>
              <button onClick={cancelar} disabled={processando || cancelando.motivo.trim().length < 3 || (confirmada && !/^\d{4,8}$/.test(cancelando.pin))}
                className="flex-1 h-11 rounded-xl bg-rose-600 text-white font-black text-sm disabled:opacity-40 flex items-center justify-center gap-1">
                {processando ? <Loader2 size={16} className="animate-spin" /> : confirmada && <Lock size={14} />} Cancelar compra
              </button>
            </div>
          </div>
        ) : (
          <div className="p-4 border-t border-line flex flex-wrap items-center gap-2">
            {compra.status === "rascunho" && <button onClick={() => onEditar(compra)} className="h-11 px-4 rounded-xl bg-emerald-500 text-white font-black text-sm">Continuar rascunho</button>}
            {podeCancelar && compra.status !== "cancelada" && (!confirmada || podeAutorizar) && <button onClick={() => setCancelando({ motivo: "", pin: "", erro: "" })} disabled={processando} className="h-11 px-4 rounded-xl bg-stone-200 font-black text-sm disabled:opacity-50">Cancelar compra</button>}
            {podeCancelar && confirmada && !podeAutorizar && <p className="text-xs text-fg">Cancelar compra confirmada: só o administrador, com o PIN.</p>}
          </div>
        )}
      </div>
    </div>
  );
}

// ═══ CUSTO MÉDIO POR PRODUTO + HISTÓRICO ════════════════════════════════════
function Custos({ base, insumoPorId, unidade }) {
  const [busca, setBusca] = useState("");
  const [aberto, setAberto] = useState(null);
  const [hist, setHist] = useState([]);
  useEffect(() => { if (aberto) fetchHistoricoCusto(unidade, { insumoId: aberto }).then((r) => setHist(r.data || [])); }, [aberto, unidade]);
  const termo = normal(busca.trim());
  const linhas = Object.values(base.custos)
    .map((c) => ({ ...c, insumo: insumoPorId.get(c.insumo_id) }))
    .filter((c) => !termo || normal(c.insumo?.nome).includes(termo))
    .sort((a, b) => String(a.insumo?.nome || "").localeCompare(String(b.insumo?.nome || ""), "pt-BR"));
  const ultimaCompra = hist.find((h) => h.origem_tipo === "COMPRA");
  const anteriorCompra = hist.filter((h) => h.origem_tipo === "COMPRA")[1];
  return (
    <div className="space-y-3">
      <p className="text-xs text-fg">Custo médio ponderado por produto (fonte única no banco). Começa no inventário fechado e muda a cada compra confirmada. O saldo de referência volta à quantidade contada a cada inventário fechado.</p>
      <div className="flex items-center gap-2 bg-card rounded-2xl border border-line px-3"><Search size={18} className="text-fg" /><input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar produto" className="flex-1 h-11 bg-transparent font-bold outline-none" /></div>
      {!linhas.length ? <p className="p-6 text-center text-sm font-bold text-fg">Ainda não há custo médio. Ele nasce quando um inventário é fechado ou uma compra é confirmada.</p> : (
        <div className="bg-card rounded-2xl border border-line overflow-x-auto"><table className="w-full text-xs">
          <thead><tr className="text-left text-fg"><th className="p-2">Produto</th><th className="text-right">Custo médio</th><th className="text-right">Saldo de referência</th><th>Atualizado</th><th>Origem</th><th></th></tr></thead>
          <tbody>{linhas.map((c) => {
            const um = c.insumo?.unidade_medida; const rot = unidadeContagem(um).rotulo;
            return (
              <tr key={c.insumo_id} className="border-t border-line">
                <td className="p-2 font-bold">{c.insumo?.nome || "—"}</td>
                <td className="text-right font-black">{fmtCusto(custoNaUnidade(c.custo_medio_base, um))}/{rot}</td>
                <td className="text-right">{fmtQtd(daBase(c.saldo_referencia, um))} {rot}</td>
                <td>{fmtData(c.atualizado_em)}</td><td>{c.origem_tipo === "CONTAGEM" ? "inventário" : c.origem_tipo === "COMPRA" ? "compra" : "ajuste"}</td>
                <td><button onClick={() => setAberto(c.insumo_id)} className="p-1" aria-label="Histórico"><History size={16} /></button></td>
              </tr>);
          })}</tbody>
        </table></div>
      )}
      {aberto && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-end sm:items-center justify-center sm:p-4">
          <div className="bg-card w-full max-w-2xl rounded-t-3xl sm:rounded-3xl max-h-[90vh] flex flex-col">
            <div className="p-5 pb-3 border-b border-line flex justify-between"><h3 className="font-black text-lg">{insumoPorId.get(aberto)?.nome} — histórico do custo</h3><button onClick={() => { setAberto(null); setHist([]); }} aria-label="Fechar"><X size={20} /></button></div>
            <div className="p-5 overflow-y-auto">
              {(() => {
                const um = insumoPorId.get(aberto)?.unidade_medida; const rot = unidadeContagem(um).rotulo;
                const atual = base.custos[aberto];
                const ult = ultimaCompra ? custoNaUnidade(ultimaCompra.custo_entrada, um) : null;
                const ant = anteriorCompra ? custoNaUnidade(anteriorCompra.custo_entrada, um) : null;
                return (
                  <>
                    <div className="grid grid-cols-3 gap-2 text-sm mb-3">
                      <div className="bg-white rounded-xl p-2 border border-line"><p className="text-xs text-fg">Custo médio</p><p className="font-black">{fmtCusto(custoNaUnidade(atual?.custo_medio_base, um))}/{rot}</p></div>
                      <div className="bg-white rounded-xl p-2 border border-line"><p className="text-xs text-fg">Último custo de compra</p><p className="font-black">{ult != null ? `${fmtCusto(ult)}/${rot}` : "—"}</p></div>
                      <div className="bg-white rounded-xl p-2 border border-line"><p className="text-xs text-fg">Variação vs compra anterior</p><p className="font-black">{fmtPctS(variacaoPct(ult, ant))}</p></div>
                    </div>
                    <table className="w-full text-xs">
                      <thead><tr className="text-left text-fg"><th className="py-1">Data</th><th>Origem</th><th className="text-right">Quantidade</th><th className="text-right">Custo da entrada</th><th className="text-right">Custo médio</th></tr></thead>
                      <tbody>{hist.map((h) => (
                        <tr key={h.id} className="border-t border-line">
                          <td className="py-1">{fmtData(h.data_referencia)}</td>
                          <td>{{ COMPRA: "compra", CONTAGEM: "inventário", ESTORNO_COMPRA: "compra cancelada", AJUSTE: "ajuste" }[h.origem_tipo]}</td>
                          <td className="text-right">{fmtQtd(daBase(h.quantidade, um))} {rot}</td>
                          <td className="text-right">{fmtCusto(custoNaUnidade(h.custo_entrada, um))}</td>
                          <td className="text-right">{fmtCusto(custoNaUnidade(h.custo_medio_anterior, um))} → <b>{fmtCusto(custoNaUnidade(h.custo_medio_novo, um))}</b></td>
                        </tr>))}</tbody>
                    </table>
                    {!hist.length && <p className="text-xs text-fg">Sem movimentos.</p>}
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
