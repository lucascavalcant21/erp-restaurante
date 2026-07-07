"use client";

import { useState, useEffect, useMemo } from "react";
import { Wrench, Plus, Trash2, Printer, X, CheckCircle2, Loader2, Sparkles, Clock } from "lucide-react";
import { PageHeader, PageBody, EmptyState, Modal, Field, TextInput, NumberInput, Select, Btn, Toast, SkeletonList, fmtBRL } from "../../../components/ui";
import { useERP } from "../../../context/ERPContext";
import { fetchServicosManutencao, salvarServicoManutencao, removerServicoManutencao, finalizarServicoManutencao, CATEGORIAS_MANUTENCAO } from "../../../lib/manutencao";

const FORMAS = ["Dinheiro", "PIX", "Cartão", "Transferência", "A pagar"];
const fmtDataBR = (d) => d ? d.split("-").reverse().join("/") : "—";

export default function ManutencaoPage() {
  const { unidadeAtiva, unidadeInfo } = useERP();
  const [servicos, setServicos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mes, setMes] = useState(new Date().toISOString().slice(0, 7));
  const [toast, setToast] = useState("");

  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(null);

  // Finalizar (gera recibo por IA)
  const [modalFinal, setModalFinal] = useState(null);
  const [reciboTexto, setReciboTexto] = useState("");
  const [gerandoIA, setGerandoIA] = useState(false);
  const [finalizando, setFinalizando] = useState(false);

  const notificar = (m) => { setToast(m); setTimeout(() => setToast(""), 2800); };

  const carregar = async () => {
    setLoading(true);
    const { data } = await fetchServicosManutencao(unidadeAtiva, mes);
    setServicos(data || []);
    setLoading(false);
  };
  useEffect(() => { if (unidadeAtiva && unidadeAtiva !== "todas") carregar(); }, [unidadeAtiva, mes]);

  const abrirNovo = () => {
    setForm({ id: null, data: new Date().toISOString().split("T")[0], servico: "", categoria: "Elétrica", descricao: "", valor: "", prestador: "", prestador_doc: "", pagador: unidadeInfo?.nome || "", forma_pagamento: "PIX", status: "aberto" });
    setModal(true);
  };
  const abrirEditar = (s) => { setForm({ ...s, valor: String(s.valor ?? "") }); setModal(true); };

  const salvar = async (e) => {
    e.preventDefault();
    if (!form.servico.trim()) return alert("Informe o serviço.");
    const { error } = await salvarServicoManutencao({
      id: form.id, unidade_id: unidadeAtiva,
      data: form.data, servico: form.servico.trim(), categoria: form.categoria,
      descricao: form.descricao || null, valor: Number(form.valor) || 0,
      prestador: form.prestador || null, prestador_doc: form.prestador_doc || null,
      pagador: form.pagador || null, forma_pagamento: form.forma_pagamento || null,
      status: form.status || "aberto",
    });
    if (error) return alert("Erro: " + error);
    notificar(form.id ? "Serviço atualizado!" : "Serviço registrado!");
    setModal(false);
    carregar();
  };

  const excluir = async (s) => {
    if (!confirm(`Excluir "${s.servico}"?`)) return;
    await removerServicoManutencao(s.id);
    notificar("Excluído.");
    carregar();
  };

  // ── Finalizar: gera recibo com IA e lança no financeiro ──
  const abrirFinalizar = (s) => {
    setModalFinal(s);
    setReciboTexto(s.recibo_texto || "");
  };
  const gerarRecibo = async () => {
    const s = modalFinal;
    setGerandoIA(true);
    try {
      const res = await fetch("/api/ia-recibo", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ servico: s.servico, descricao: s.descricao, valor: s.valor, prestador: s.prestador, pagador: s.pagador || unidadeInfo?.nome, forma_pagamento: s.forma_pagamento, data: s.data, unidade_nome: unidadeInfo?.nome }),
      });
      const data = await res.json();
      if (!res.ok || data.error) { alert(data.error || "Falha ao gerar recibo."); return; }
      setReciboTexto(data.texto);
    } catch { alert("Não consegui falar com a IA."); } finally { setGerandoIA(false); }
  };
  const confirmarFinalizacao = async () => {
    setFinalizando(true);
    const { error, contaLancada } = await finalizarServicoManutencao(modalFinal, { recibo_texto: reciboTexto });
    setFinalizando(false);
    if (error) return alert("Erro: " + error);
    notificar(contaLancada ? "Serviço concluído e lançado nos custos!" : "Serviço concluído!");
    setModalFinal(null);
    carregar();
  };

  // Impressão do recibo (A4)
  const imprimirRecibo = (s, textoOverride) => {
    const texto = textoOverride || s.recibo_texto || "";
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Recibo — ${s.servico}</title>
      <style>
        *{margin:0;padding:0;box-sizing:border-box}
        body{font-family:Georgia,'Times New Roman',serif;color:#111;padding:14mm 16mm;max-width:720px;margin:0 auto;line-height:1.9}
        .topo{border-bottom:3px double #111;padding-bottom:10px;margin-bottom:6px;display:flex;justify-content:space-between;align-items:flex-end}
        h1{font-size:26px;letter-spacing:6px;text-transform:uppercase}
        .valor{font-size:22px;font-weight:900;border:2px solid #111;padding:6px 16px;border-radius:8px}
        .empresa{font-family:Arial,sans-serif;font-size:11px;color:#555;margin-bottom:18px}
        .corpo{font-size:15px;text-align:justify;white-space:pre-wrap;margin-bottom:10px}
        .grid{font-family:Arial,sans-serif;font-size:12px;color:#333;border:1px solid #999;border-radius:6px;padding:10px 12px;margin:14px 0}
        .assin{margin-top:46px;text-align:center}
        .assin .linha{width:340px;border-top:1px solid #111;margin:0 auto;padding-top:5px;font-size:12px;font-family:Arial,sans-serif}
        .assin small{display:block;color:#666;font-size:10px;margin-top:2px}
        @media print{@page{margin:0}}
      </style></head><body>
      <div class="topo"><h1>Recibo</h1><span class="valor">${fmtBRL(s.valor)}</span></div>
      <div class="empresa">${unidadeInfo?.nome || ""}${s.categoria ? ` · Serviço de manutenção (${s.categoria})` : ""}</div>
      <div class="corpo">${(texto || `Recebi de ${s.pagador || unidadeInfo?.nome || "____"} a importância de ${fmtBRL(s.valor)}, referente a: ${s.servico}.`).replace(/</g, "&lt;")}</div>
      <div class="grid">
        <b>Prestador:</b> ${s.prestador || "____________________"}${s.prestador_doc ? ` · CPF/CNPJ: ${s.prestador_doc}` : ""}<br/>
        <b>Pagador:</b> ${s.pagador || unidadeInfo?.nome || "____________________"}<br/>
        <b>Forma de pagamento:</b> ${s.forma_pagamento || "____________________"} · <b>Data:</b> ${fmtDataBR(s.data)}
      </div>
      <div class="assin"><div class="linha">${s.prestador || "Assinatura do prestador"}<small>quem recebeu o pagamento</small></div></div>
      </body></html>`;
    const win = window.open("", "_blank", "width=820,height=1000");
    if (win) { win.document.write(html); win.document.close(); setTimeout(() => win.print(), 400); }
    else alert("Habilite os popups para imprimir.");
  };

  const resumo = useMemo(() => {
    const total = servicos.reduce((s, x) => s + (Number(x.valor) || 0), 0);
    const concluidos = servicos.filter(x => x.status === "concluido").length;
    return { total, concluidos, abertos: servicos.length - concluidos };
  }, [servicos]);

  if (!unidadeAtiva || unidadeAtiva === "todas") {
    return <div className="min-h-screen"><PageHeader title="Serviços de Manutenção" subtitle="Prestadores de serviço" icon={Wrench} /><PageBody><EmptyState icon={Wrench} title="Selecione uma unidade" /></PageBody></div>;
  }

  return (
    <div className="min-h-screen pb-24">
      <PageHeader title="Serviços de Manutenção" subtitle={`Prestadores, recibos e custos · ${unidadeInfo?.nome || ""}`} icon={Wrench} onAction={abrirNovo} actionLabel="Novo Serviço" />
      <PageBody>
        <Toast show={!!toast}>{toast}</Toast>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: "var(--dim)" }}>Mês:</span>
            <input type="month" value={mes} onChange={e => setMes(e.target.value)} className="p-2.5 rounded-lg border font-bold text-sm outline-none" style={{ background: "var(--card)", borderColor: "var(--line)", color: "var(--fg)" }} />
          </div>
          <div className="erp-card px-4 py-2.5 flex items-center gap-2"><span className="text-[10px] font-black uppercase tracking-widest" style={{ color: "var(--muted)" }}>Total do mês</span><span className="text-lg font-extrabold" style={{ color: "var(--accent-strong)" }}>{fmtBRL(resumo.total)}</span></div>
          <div className="erp-card px-4 py-2.5 flex items-center gap-2 text-xs font-bold" style={{ color: "var(--muted)" }}>{resumo.abertos} aberto(s) · {resumo.concluidos} concluído(s)</div>
        </div>

        {loading ? <SkeletonList rows={5} /> : servicos.length === 0 ? (
          <EmptyState icon={Wrench} title="Nenhum serviço neste mês" hint="Registre reparos de elétrica, hidráulica, refrigeração... Ao concluir, gera o recibo e soma nos custos." actionLabel="Registrar serviço" onAction={abrirNovo} />
        ) : (
          <div className="space-y-2">
            {servicos.map(s => {
              const concluido = s.status === "concluido";
              return (
                <div key={s.id} className="erp-card p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-sm" style={{ color: "var(--fg)" }}>{s.servico}</p>
                      <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded" style={{ background: "var(--elevated)", color: "var(--muted)" }}>{s.categoria}</span>
                      {concluido ? <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded" style={{ background: "rgba(5,150,105,0.12)", color: "#047857" }}>concluído</span>
                        : <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded" style={{ background: "rgba(245,158,11,0.13)", color: "#B45309" }}>aberto</span>}
                    </div>
                    <p className="text-[11px] font-medium mt-0.5" style={{ color: "var(--dim)" }}>
                      {fmtDataBR(s.data)}{s.prestador ? ` · ${s.prestador}` : ""}{s.forma_pagamento ? ` · ${s.forma_pagamento}` : ""}
                    </p>
                  </div>
                  <span className="font-extrabold shrink-0" style={{ color: "var(--fg)" }}>{fmtBRL(s.valor)}</span>
                  <div className="flex gap-1.5 shrink-0">
                    {concluido ? (
                      <button onClick={() => imprimirRecibo(s)} className="px-3 py-2 rounded-lg font-bold text-xs flex items-center gap-1" style={{ background: "var(--accent-soft)", color: "var(--accent-strong)" }}><Printer size={13} /> Recibo</button>
                    ) : (
                      <button onClick={() => abrirFinalizar(s)} className="px-3 py-2 rounded-lg font-bold text-xs flex items-center gap-1 bg-emerald-600 text-white hover:bg-emerald-700"><CheckCircle2 size={13} /> Finalizar</button>
                    )}
                    <button onClick={() => abrirEditar(s)} className="p-2 rounded-lg" style={{ background: "var(--elevated)", color: "var(--muted)" }} title="Editar">✎</button>
                    <button onClick={() => excluir(s)} className="p-2 rounded-lg" style={{ background: "var(--elevated)", color: "var(--muted)" }} title="Excluir"><Trash2 size={14} /></button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </PageBody>

      {/* Modal novo/editar serviço */}
      <Modal open={modal} onClose={() => setModal(false)} title={form?.id ? "Editar Serviço" : "Novo Serviço de Manutenção"}>
        {form && (
          <form onSubmit={salvar}>
            <Field label="Serviço"><TextInput value={form.servico} onChange={e => setForm({ ...form, servico: e.target.value })} placeholder="Ex: Troca do compressor da câmara fria" required /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Categoria"><Select value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value })}>{CATEGORIAS_MANUTENCAO.map(c => <option key={c} value={c}>{c}</option>)}</Select></Field>
              <Field label="Data"><input type="date" value={form.data} onChange={e => setForm({ ...form, data: e.target.value })} className="erp-input" /></Field>
            </div>
            <Field label="Detalhes (opcional)"><TextInput value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })} placeholder="Peças trocadas, garantia..." /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Valor (R$)"><NumberInput value={form.valor} onChange={e => setForm({ ...form, valor: e.target.value })} min="0" step="0.01" placeholder="0,00" required /></Field>
              <Field label="Forma de pagamento"><Select value={form.forma_pagamento} onChange={e => setForm({ ...form, forma_pagamento: e.target.value })}>{FORMAS.map(f => <option key={f} value={f}>{f}</option>)}</Select></Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Prestador (quem recebe)"><TextInput value={form.prestador} onChange={e => setForm({ ...form, prestador: e.target.value })} placeholder="Nome do técnico/empresa" /></Field>
              <Field label="CPF/CNPJ (opcional)"><TextInput value={form.prestador_doc} onChange={e => setForm({ ...form, prestador_doc: e.target.value })} placeholder="000.000.000-00" /></Field>
            </div>
            <Field label="Pagador (quem paga)"><TextInput value={form.pagador} onChange={e => setForm({ ...form, pagador: e.target.value })} placeholder={unidadeInfo?.nome} /></Field>
            <div className="flex gap-3 mt-2">
              <Btn type="button" variant="ghost" className="flex-1" onClick={() => setModal(false)}>Cancelar</Btn>
              <Btn type="submit" variant="primary" className="flex-1">Salvar</Btn>
            </div>
          </form>
        )}
      </Modal>

      {/* Modal finalizar → gera recibo + lança custo */}
      <Modal open={!!modalFinal} onClose={() => setModalFinal(null)} title={modalFinal ? `Finalizar: ${modalFinal.servico}` : ""}>
        {modalFinal && (
          <div>
            <p className="text-xs font-medium mb-3" style={{ color: "var(--muted)" }}>
              {fmtBRL(modalFinal.valor)} · {modalFinal.forma_pagamento || "—"} · prestador: <b>{modalFinal.prestador || "não informado"}</b>. Ao concluir, o valor entra nos <b>custos da empresa</b> (Contas a Pagar, categoria manutenção).
            </p>
            <Btn variant="ghost" className="w-full mb-3" onClick={gerarRecibo} disabled={gerandoIA}>
              {gerandoIA ? <><Loader2 size={16} className="animate-spin" /> Gerando recibo...</> : <><Sparkles size={16} /> Gerar recibo com IA</>}
            </Btn>
            <textarea value={reciboTexto} onChange={e => setReciboTexto(e.target.value)} rows={7} placeholder="Texto do recibo (gere com IA ou escreva). Ele sai impresso com valor, prestador, pagador, forma de pagamento e assinatura." className="erp-input !h-auto py-3 text-sm resize-none w-full mb-3" />
            <div className="flex gap-3">
              <Btn variant="ghost" className="flex-1" onClick={() => imprimirRecibo(modalFinal, reciboTexto)}><Printer size={15} /> Imprimir</Btn>
              <Btn variant="primary" className="flex-1" onClick={confirmarFinalizacao} disabled={finalizando}>
                {finalizando ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />} Concluir e lançar custo
              </Btn>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
