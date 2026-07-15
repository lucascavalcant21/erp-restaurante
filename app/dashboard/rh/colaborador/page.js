"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Users, ArrowLeft, Phone, CreditCard, Clock, Hourglass, CalendarHeart,
  ShoppingBag, FileText, Star, Edit3, Printer, ChevronRight, User, Network,
  DollarSign, AlertTriangle
} from "lucide-react";
import { PageHeader, PageBody, EmptyState, SearchBar, SkeletonList, fmtBRL, fmtData } from "../../../components/ui";
import { useERP } from "../../../context/ERPContext";
import {
  fetchColaboradores, fetchDocumentos, fetchFolgasEsporadicas, fetchConsumoFuncionario,
  fetchBancoHorasColaborador, somaMinutosBanco, BANCO_LIMITE_MIN, BANCO_ALERTA_MIN,
  fetchAdvertenciasColab, calcularAdicionaisMes, fetchFeriados
} from "../../../lib/rh";
import { fetchHistoricoPonto, fetchPontosMes } from "../../../lib/ponto";
import { fetchHolerites, confirmarRecebimentoHolerite } from "../../../lib/pessoas";

const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const fmtMin = (m) => `${Math.floor(m / 60)}h${String(Math.round(m) % 60).padStart(2, "0")}`;
const horaDe = (iso) => iso ? new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "--:--";

function Bloco({ icon: Icon, titulo, extra, children }) {
  return (
    <div className="erp-card p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="erp-label flex items-center gap-1.5"><Icon size={13} /> {titulo}</p>
        {extra}
      </div>
      {children}
    </div>
  );
}

export default function VidaColaboradorPage() {
  const { unidadeAtiva, unidadeInfo } = useERP();
  const router = useRouter();
  const [colaboradores, setColaboradores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");

  // Colaborador aberto + a vida dele
  const [sel, setSel] = useState(null);
  const [vida, setVida] = useState(null); // { docs, folgas, consumo, banco, ponto }
  const [vidaLoading, setVidaLoading] = useState(false);

  useEffect(() => {
    (async () => {
      if (!unidadeAtiva || unidadeAtiva === "todas") { setLoading(false); return; }
      setLoading(true);
      const { data } = await fetchColaboradores(unidadeAtiva);
      setColaboradores(data || []);
      setLoading(false);
    })();
  }, [unidadeAtiva]);

  const abrir = async (c) => {
    setSel(c);
    setVida(null);
    setVidaLoading(true);
    const mes = new Date().toISOString().slice(0, 7);
    const [rDocs, rFolgas, rConsumo, rBanco, rPonto, rAdv, rPontosMes, rFeriados, rHolerites] = await Promise.all([
      fetchDocumentos(c.id),
      fetchFolgasEsporadicas(c.id),
      fetchConsumoFuncionario(c.id),
      fetchBancoHorasColaborador(c.id, mes),
      fetchHistoricoPonto(c.id),
      fetchAdvertenciasColab(c.id),
      fetchPontosMes(c.id, mes),
      fetchFeriados(unidadeAtiva, mes),
      fetchHolerites(c.id),
    ]);
    setVida({
      docs: rDocs.data || [], folgas: rFolgas.data || [], consumo: rConsumo.data || [],
      banco: rBanco.data || [], ponto: rPonto.data || [],
      advertencias: rAdv.data || [], pontosMes: rPontosMes.data || [], feriados: rFeriados.data || [],
      holerites: Array.isArray(rHolerites) ? rHolerites : [],
    });
    setVidaLoading(false);
  };

  const imprimirHolerite = (h, colaborador) => {
    const d = h.detalhes || {};
    const esc = (v) => String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
    const moeda = (v) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    const win = window.open("", "_blank", "width=850,height=900");
    if (!win) return alert("O navegador bloqueou a janela. Habilite pop-ups para imprimir ou salvar em PDF.");
    win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Holerite ${esc(colaborador.nome)}</title><style>*{box-sizing:border-box}body{font-family:Arial,sans-serif;padding:28px;color:#111}.folha{max-width:760px;margin:auto;border:1px solid #111}.cab{padding:18px;border-bottom:2px solid #111;display:flex;justify-content:space-between}.cab h1{font-size:19px;margin:0}.cab p{font-size:12px;margin:5px 0 0}.dados{padding:14px 18px;border-bottom:1px solid #777;font-size:13px}.linha{display:grid;grid-template-columns:1fr 130px;padding:11px 18px;border-bottom:1px solid #ddd;font-size:13px}.linha b{text-align:right}.total{background:#eee;font-size:15px}.assinaturas{display:grid;grid-template-columns:1fr 1fr;gap:50px;padding:70px 28px 25px;text-align:center;font-size:11px}.assinaturas div{border-top:1px solid #111;padding-top:6px}.recebido{padding:10px 18px;background:#ecfdf5;color:#166534;font-size:11px}@media print{@page{size:A4;margin:12mm}body{padding:0}}</style></head><body><div class="folha"><div class="cab"><div><h1>Demonstrativo de Pagamento</h1><p>${esc(unidadeInfo?.nome || "Empresa")} · Competência ${String(h.mes).padStart(2,"0")}/${h.ano}</p></div><strong>${esc(d.tipo_contrato || "")}</strong></div><div class="dados"><b>Colaborador:</b> ${esc(colaborador.nome)}<br><b>Cargo:</b> ${esc(colaborador.cargo || d.cargo || "—")} · <b>Dias trabalhados:</b> ${d.dias_trabalhados || 0}</div><div class="linha"><span>Salário / base calculada</span><b>${moeda(d.salario_base)}</b></div><div class="linha"><span>Acréscimos e bônus</span><b>${moeda(d.acrescimos)}</b></div><div class="linha"><span>Vales e adiantamentos</span><b>− ${moeda(d.vales)}</b></div><div class="linha"><span>Outros descontos</span><b>− ${moeda(d.outros_descontos)}</b></div><div class="linha total"><strong>Valor líquido</strong><b>${moeda(h.liquido)}</b></div>${d.recebimento_confirmado ? `<div class="recebido">Recebimento confirmado em ${new Date(d.recebido_em).toLocaleString("pt-BR")}</div>` : ""}<div class="assinaturas"><div>Assinatura do colaborador</div><div>Responsável pelo RH</div></div></div><script>window.onload=()=>setTimeout(()=>window.print(),250)</script></body></html>`);
    win.document.close();
  };

  const confirmarHolerite = async (h) => {
    if (!confirm(`Confirmar o recebimento do holerite de ${String(h.mes).padStart(2,"0")}/${h.ano}?`)) return;
    const { data, error } = await confirmarRecebimentoHolerite(h.id, h.detalhes);
    if (error) return alert("Não foi possível confirmar: " + error);
    setVida(v => ({ ...v, holerites: v.holerites.map(x => x.id === h.id ? data : x) }));
  };

  if (!unidadeAtiva || unidadeAtiva === "todas") {
    return (
      <div className="min-h-screen">
        <PageHeader title="Funcionários" subtitle="A vida completa de cada funcionário" icon={Users} />
        <PageBody><EmptyState icon={Users} title="Selecione uma unidade" hint="Escolha a unidade no topo." /></PageBody>
      </div>
    );
  }

  // ── Detalhe: a vida do colaborador ────────────────────────────────────────
  if (sel) {
    const supervisor = colaboradores.find(c => c.id === sel.supervisor_id);
    const liderados = colaboradores.filter(c => c.supervisor_id === sel.id);
    const totalBanco = vida ? somaMinutosBanco(vida.banco) : 0;
    const excessos = vida ? vida.banco.filter(b => b.tipo === "excesso") : [];
    const consumoPendente = vida ? vida.consumo.filter(x => (x.status_pagamento || "") === "Pendente").reduce((s, x) => s + (Number(x.valor_final ?? x.valor_original) || 0), 0) : 0;
    const isFree = sel.tipo_contrato === "Freelancer";
    const diasTrab = String(sel.dias_trabalho || "").split(",").filter(Boolean).map(d => DIAS_SEMANA[Number(d)] || d).join(", ");

    return (
      <div className="min-h-screen pb-24">
        <PageHeader title={sel.nome} subtitle={`${sel.cargo || "—"} · ${isFree ? "Freelancer/Extra" : sel.tipo_contrato || "Fixo"} · ${unidadeInfo?.nome}`} icon={User} back={false}>
          <button onClick={() => { setSel(null); setVida(null); }} className="erp-btn erp-btn-ghost !h-9 text-xs"><ArrowLeft size={14} /> Todos</button>
          <button onClick={() => router.push(`/dashboard/rh/espelho/${sel.id}?mes=${new Date().toISOString().slice(0, 7)}`)} className="erp-btn erp-btn-ghost !h-9 text-xs"><Printer size={14} /> Espelho de Ponto</button>
          <button onClick={() => router.push("/dashboard/rh")} className="erp-btn erp-btn-primary !h-9 text-xs"><Edit3 size={14} /> Editar no RH</button>
        </PageHeader>
        <PageBody>
          {/* Dados cadastrais */}
          <Bloco icon={User} titulo="Dados do colaborador">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-x-5 gap-y-3 text-sm">
              <div><p className="text-[10px] font-black uppercase tracking-widest" style={{ color: "var(--dim)" }}>Telefone</p><p className="font-bold" style={{ color: "var(--fg-soft)" }}>{sel.telefone || "—"}</p></div>
              <div><p className="text-[10px] font-black uppercase tracking-widest" style={{ color: "var(--dim)" }}>CPF</p><p className="font-bold" style={{ color: "var(--fg-soft)" }}>{sel.cpf || "—"}</p></div>
              <div><p className="text-[10px] font-black uppercase tracking-widest" style={{ color: "var(--dim)" }}>Chave PIX</p><p className="font-bold truncate" style={{ color: "var(--fg-soft)" }}>{sel.chave_pix || "—"}</p></div>
              <div><p className="text-[10px] font-black uppercase tracking-widest" style={{ color: "var(--dim)" }}>{isFree ? "Diária base" : "Salário base"}</p><p className="font-bold" style={{ color: "var(--accent-strong)" }}>{fmtBRL(sel.salario)}</p></div>
              <div><p className="text-[10px] font-black uppercase tracking-widest" style={{ color: "var(--dim)" }}>Horário</p><p className="font-bold" style={{ color: "var(--fg-soft)" }}>{sel.horario_entrada || "—"} às {sel.horario_saida || "—"}</p></div>
              <div><p className="text-[10px] font-black uppercase tracking-widest" style={{ color: "var(--dim)" }}>Dias de trabalho</p><p className="font-bold" style={{ color: "var(--fg-soft)" }}>{diasTrab || "—"}</p></div>
              <div><p className="text-[10px] font-black uppercase tracking-widest" style={{ color: "var(--dim)" }}>Intervalo</p><p className="font-bold" style={{ color: "var(--fg-soft)" }}>{sel.tempo_intervalo || 60} min</p></div>
              <div><p className="text-[10px] font-black uppercase tracking-widest" style={{ color: "var(--dim)" }}>Admissão</p><p className="font-bold" style={{ color: "var(--fg-soft)" }}>{sel.data_admissao ? fmtData(sel.data_admissao) : "—"}</p></div>
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-4 pt-3 border-t" style={{ borderColor: "var(--line-soft)" }}>
              <span className="erp-badge" style={{ background: "var(--elevated)", color: "var(--muted)" }}><Network size={12} /> Supervisor: {supervisor?.nome || "topo da hierarquia"}</span>
              {liderados.length > 0 && <span className="erp-badge erp-badge-ok"><Users size={12} /> Lidera {liderados.length} pessoa(s)</span>}
              {isFree && (
                <span className="erp-badge erp-badge-warn flex items-center gap-1">
                  {[...Array(5)].map((_, i) => <Star key={i} size={11} className={i < (sel.avaliacao_estrelas || 0) ? "fill-amber-500 text-amber-500" : "text-slate-300"} />)}
                </span>
              )}
              {sel.anotacoes_rh && <span className="text-[11px] font-medium" style={{ color: "var(--dim)" }}>{sel.anotacoes_rh}</span>}
            </div>
          </Bloco>

          {vidaLoading || !vida ? <SkeletonList rows={4} /> : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Remuneração do mês: fixo + VA + taxa + adicionais do ponto (CLT) */}
              {!isFree && (() => {
                const ad = calcularAdicionaisMes(vida.pontosMes, sel.salario, vida.feriados);
                const fixo = Number(sel.salario) || 0;
                const va = Number(sel.vale_alimentacao) || 0;
                const taxa = Number(sel.taxa_servico_mes) || 0;
                const totalMes = fixo + va + taxa + ad.valorNoturno + ad.valorExtra + ad.valorFeriado;
                const Linha = ({ rotulo, valor, dica }) => (
                  <div className="flex justify-between items-baseline py-1.5 border-b" style={{ borderColor: "var(--line-soft)" }}>
                    <span className="text-sm font-bold" style={{ color: "var(--fg-soft)" }}>{rotulo}{dica && <span className="text-[10px] font-medium ml-1.5" style={{ color: "var(--dim)" }}>{dica}</span>}</span>
                    <span className="text-sm font-black" style={{ color: "var(--fg)" }}>{fmtBRL(valor)}</span>
                  </div>
                );
                return (
                  <Bloco icon={DollarSign} titulo="Remuneração do mês (prévia)"
                    extra={<span className="text-base font-black" style={{ color: "var(--accent-strong)" }}>{fmtBRL(totalMes)}</span>}>
                    <Linha rotulo="Salário fixo" valor={fixo} />
                    <Linha rotulo="Vale alimentação" valor={va} />
                    <Linha rotulo="Taxa de serviço" valor={taxa} dica="definida no fim do mês" />
                    <Linha rotulo="Adicional noturno" valor={ad.valorNoturno} dica={`${fmtMin(ad.minNoturno)} após 23h30 · 20% CLT`} />
                    <Linha rotulo="Horas extras" valor={ad.valorExtra} dica={`${fmtMin(ad.minExtra)} após 00h00 · +50% CLT`} />
                    <Linha rotulo="Trabalho em feriado" valor={ad.valorFeriado} dica={`${fmtMin(ad.minFeriado)} em feriados · +100% CLT`} />
                    <p className="text-[10px] font-medium mt-2" style={{ color: "var(--dim)" }}>Adicionais calculados automaticamente do ponto (hora normal = salário ÷ 220). O botão "Lançar Folha" no RH usa estes valores.</p>
                  </Bloco>
                );
              })()}

              {/* Mini calendário do mês: feriados, folgas e dias com ponto */}
              {(() => {
                const agora = new Date();
                const ano = agora.getFullYear(), mes = agora.getMonth();
                const diasNoMes = new Date(ano, mes + 1, 0).getDate();
                const offset = new Date(ano, mes, 1).getDay();
                const hojeDia = agora.getDate();
                const feriadosSet = new Set((vida.feriados || []).map(f => f.data));
                const folgasSet = new Set((vida.folgas || []).map(f => f.data_folga));
                const pontosSet = new Set((vida.pontosMes || []).filter(p => p.hora_entrada).map(p => p.data_referencia));
                const trabalhaDias = new Set(String(sel.dias_trabalho || "").split(","));
                const chave = (d) => `${ano}-${String(mes + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
                return (
                  <Bloco icon={CalendarHeart} titulo={`Calendário de ${agora.toLocaleDateString("pt-BR", { month: "long" })}`}>
                    <div className="grid grid-cols-7 gap-1 text-center mb-1">
                      {DIAS_SEMANA.map(d => <span key={d} className="text-[9px] font-black uppercase" style={{ color: "var(--dim)" }}>{d}</span>)}
                    </div>
                    <div className="grid grid-cols-7 gap-1">
                      {Array.from({ length: offset }).map((_, i) => <span key={`v${i}`} />)}
                      {Array.from({ length: diasNoMes }).map((_, i) => {
                        const d = i + 1;
                        const dataISO = chave(d);
                        const diaSemana = new Date(ano, mes, d).getDay();
                        const ehFeriado = feriadosSet.has(dataISO);
                        const ehFolgaEsp = folgasSet.has(dataISO);
                        const ehFolgaSemanal = !trabalhaDias.has(String(diaSemana));
                        const bateu = pontosSet.has(dataISO);
                        const ehHoje = d === hojeDia;
                        let bg = "var(--elevated)", fg = "var(--fg-soft)";
                        if (ehFeriado) { bg = "rgba(239,68,68,0.15)"; fg = "#DC2626"; }
                        else if (ehFolgaEsp) { bg = "rgba(244,114,182,0.18)"; fg = "#BE185D"; }
                        else if (ehFolgaSemanal) { bg = "var(--line-soft)"; fg = "var(--dim)"; }
                        return (
                          <div key={d} className="relative rounded-lg py-1.5 text-center"
                            style={{ background: bg, outline: ehHoje ? "2px solid var(--accent)" : "none" }}
                            title={`${dataISO.split("-").reverse().join("/")}${ehFeriado ? " · Feriado" : ""}${ehFolgaEsp ? " · Folga marcada" : ""}${ehFolgaSemanal ? " · Folga semanal" : ""}${bateu ? " · trabalhou" : ""}`}>
                            <span className="text-[11px] font-black" style={{ color: fg }}>{d}</span>
                            {bateu && <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full" style={{ background: "var(--accent)" }} />}
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 mt-3 text-[9px] font-bold" style={{ color: "var(--dim)" }}>
                      <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded" style={{ background: "rgba(239,68,68,0.3)" }} /> Feriado (+100%)</span>
                      <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded" style={{ background: "rgba(244,114,182,0.35)" }} /> Folga marcada</span>
                      <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded" style={{ background: "var(--line-soft)" }} /> Folga semanal</span>
                      <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--accent)" }} /> Bateu ponto</span>
                    </div>
                  </Bloco>
                );
              })()}

              {/* Advertências */}
              <Bloco icon={AlertTriangle} titulo="Advertências"
                extra={vida.advertencias.length > 0 && <span className="erp-badge erp-badge-danger">{vida.advertencias.length}</span>}>
                {vida.advertencias.length === 0 ? (
                  <p className="text-xs font-medium" style={{ color: "var(--dim)" }}>Nenhuma advertência — tudo certo.</p>
                ) : (
                  <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                    {vida.advertencias.map(a => (
                      <div key={a.id} className="flex items-center gap-2 text-xs p-2 rounded-lg" style={{ background: "var(--elevated)" }}>
                        <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded shrink-0 ${a.gravidade === "grave" ? "bg-red-100 text-red-700" : a.gravidade === "media" ? "bg-amber-100 text-amber-700" : "bg-slate-200 text-slate-600"}`}>{a.gravidade}</span>
                        <span className="font-bold truncate flex-1" style={{ color: "var(--fg-soft)" }}>{a.motivo}</span>
                        <span className="font-medium shrink-0" style={{ color: "var(--dim)" }}>{a.data ? a.data.split("-").reverse().join("/") : ""}</span>
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-[10px] font-medium mt-2" style={{ color: "var(--dim)" }}>Registradas e impressas no Painel da Equipe (botão Advertências).</p>
              </Bloco>
              {/* Ponto */}
              <Bloco icon={Clock} titulo="Ponto — últimos dias"
                extra={<button onClick={() => router.push(`/dashboard/rh/espelho/${sel.id}?mes=${new Date().toISOString().slice(0, 7)}`)} className="text-[10px] font-bold flex items-center gap-0.5" style={{ color: "var(--accent-strong)" }}>Espelho completo <ChevronRight size={11} /></button>}>
                {vida.ponto.length === 0 ? <p className="text-xs font-medium" style={{ color: "var(--dim)" }}>Sem batidas registradas ainda.</p> : (
                  <div className="space-y-1">
                    <div className="grid grid-cols-[60px_1fr_1fr_1fr_1fr] gap-1 text-[9px] font-black uppercase tracking-widest text-center" style={{ color: "var(--dim)" }}>
                      <span className="text-left">Dia</span><span>Entrada</span><span>Int. saída</span><span>Int. volta</span><span>Saída</span>
                    </div>
                    {vida.ponto.map(h => (
                      <div key={h.id} className="grid grid-cols-[60px_1fr_1fr_1fr_1fr] gap-1 items-center text-center py-1.5 rounded-lg" style={{ background: "var(--elevated)" }}>
                        <span className="text-[11px] font-black text-left pl-2" style={{ color: "var(--muted)" }}>{h.data_referencia?.slice(5).split("-").reverse().join("/")}</span>
                        {["hora_entrada", "hora_saida_intervalo", "hora_retorno_intervalo", "hora_saida"].map(c => (
                          <span key={c} className="text-xs font-bold" style={{ color: h[c] ? "var(--fg-soft)" : "var(--dim)" }}>{horaDe(h[c])}</span>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </Bloco>

              {/* Banco de horas */}
              <Bloco icon={Hourglass} titulo="Banco de horas (mês)"
                extra={<span className="text-sm font-black" style={{ color: totalBanco >= BANCO_LIMITE_MIN ? "#DC2626" : totalBanco >= BANCO_ALERTA_MIN ? "#B45309" : "var(--fg)" }}>{fmtMin(totalBanco)} / 8h</span>}>
                <div className="h-2 rounded-full overflow-hidden mb-3" style={{ background: "var(--elevated)" }}>
                  <div className="h-full rounded-full" style={{ width: `${Math.min(100, (totalBanco / BANCO_LIMITE_MIN) * 100)}%`, background: totalBanco >= BANCO_LIMITE_MIN ? "#DC2626" : totalBanco >= BANCO_ALERTA_MIN ? "#F59E0B" : "var(--accent)" }} />
                </div>
                {vida.banco.length === 0 ? <p className="text-xs font-medium" style={{ color: "var(--dim)" }}>Nenhum lançamento neste mês.</p> : (
                  <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                    {vida.banco.map(b => (
                      <div key={b.id} className="flex justify-between items-center text-xs p-2 rounded-lg" style={{ background: b.tipo === "excesso" ? "rgba(245,158,11,0.10)" : "var(--elevated)" }}>
                        <span className="font-medium truncate" style={{ color: "var(--fg-soft)" }}>{b.data?.split("-").reverse().join("/")} · {b.observacao || "Intervalo não tirado"}</span>
                        <span className="font-black shrink-0 ml-2" style={{ color: b.tipo === "excesso" ? "#B45309" : "var(--accent-strong)" }}>{b.tipo === "excesso" ? `+${b.minutos}min além` : fmtMin(Number(b.minutos) || 0)}</span>
                      </div>
                    ))}
                  </div>
                )}
                {excessos.length > 0 && <p className="text-[10px] font-bold mt-2" style={{ color: "#B45309" }}>{excessos.length} ocorrência(s) de intervalo passado do horário.</p>}
              </Bloco>

              {/* Folgas */}
              <Bloco icon={CalendarHeart} titulo="Folgas marcadas">
                {vida.folgas.length === 0 ? <p className="text-xs font-medium" style={{ color: "var(--dim)" }}>Nenhuma folga esporádica marcada.</p> : (
                  <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                    {vida.folgas.map(f => (
                      <div key={f.id} className="flex justify-between items-center text-xs p-2 rounded-lg" style={{ background: "var(--elevated)" }}>
                        <span className="font-bold" style={{ color: "var(--fg-soft)" }}>{f.data_folga?.split("-").reverse().join("/")}</span>
                        <span className="font-medium truncate ml-2" style={{ color: "var(--dim)" }}>{f.descricao || "Folga"}</span>
                      </div>
                    ))}
                  </div>
                )}
              </Bloco>

              {/* Consumo / vales */}
              <Bloco icon={ShoppingBag} titulo="Consumo e vales"
                extra={consumoPendente > 0 && <span className="text-xs font-black" style={{ color: "#DC2626" }}>{fmtBRL(consumoPendente)} pendente</span>}>
                {vida.consumo.length === 0 ? <p className="text-xs font-medium" style={{ color: "var(--dim)" }}>Nenhum consumo registrado.</p> : (
                  <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                    {vida.consumo.map(x => (
                      <div key={x.id} className="flex justify-between items-center text-xs p-2 rounded-lg" style={{ background: "var(--elevated)" }}>
                        <div className="min-w-0">
                          <p className="font-bold truncate" style={{ color: "var(--fg-soft)" }}>{x.descricao}</p>
                          <p className="text-[10px] font-medium" style={{ color: "var(--dim)" }}>{x.data_consumo ? fmtData(x.data_consumo) : "—"} · {x.forma_pagamento || "—"} · {x.status_pagamento || "—"}</p>
                        </div>
                        <span className="font-black shrink-0 ml-2" style={{ color: "var(--fg)" }}>{fmtBRL(x.valor_final ?? x.valor_original)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </Bloco>

              {/* Documentos */}
              <Bloco icon={DollarSign} titulo="Holerites"
                extra={vida.holerites.length > 0 && <span className="erp-badge erp-badge-ok">{vida.holerites.length}</span>}>
                {vida.holerites.length === 0 ? <p className="text-xs font-medium" style={{ color: "var(--dim)" }}>Nenhum holerite gerado ainda.</p> : (
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {vida.holerites.map(h => {
                      const recebido = h.detalhes?.recebimento_confirmado;
                      return <div key={h.id} className="p-3 rounded-xl" style={{ background: "var(--elevated)" }}>
                        <div className="flex justify-between items-center gap-3">
                          <div><p className="text-sm font-black" style={{ color: "var(--fg)" }}>{String(h.mes).padStart(2,"0")}/{h.ano}</p><p className="text-[10px] font-bold" style={{ color: recebido ? "#15803D" : "var(--dim)" }}>{recebido ? `Recebido em ${new Date(h.detalhes.recebido_em).toLocaleDateString("pt-BR")}` : "Aguardando confirmação"}</p></div>
                          <div className="text-right"><p className="text-sm font-black" style={{ color: "var(--accent-strong)" }}>{fmtBRL(h.liquido)}</p><p className="text-[10px]" style={{ color: "var(--dim)" }}>líquido</p></div>
                        </div>
                        <div className="flex gap-2 mt-2">
                          <button onClick={() => imprimirHolerite(h, sel)} className="erp-btn erp-btn-ghost !h-8 text-[10px]"><Printer size={12}/> Imprimir / PDF</button>
                          {!recebido && <button onClick={() => confirmarHolerite(h)} className="erp-btn erp-btn-primary !h-8 text-[10px]">Confirmar recebimento</button>}
                        </div>
                      </div>;
                    })}
                  </div>
                )}
              </Bloco>

              {/* Documentos */}
              <Bloco icon={FileText} titulo="Documentos anexados">
                {vida.docs.length === 0 ? <p className="text-xs font-medium" style={{ color: "var(--dim)" }}>Nenhum documento. Anexe pelo Painel da Equipe.</p> : (
                  <div className="flex flex-wrap gap-2">
                    {vida.docs.map(doc => (
                      <a key={doc.id} href={doc.url_arquivo} target="_blank" rel="noreferrer" className="erp-badge erp-badge-ok flex items-center gap-1"><FileText size={11} /> {doc.nome_arquivo}</a>
                    ))}
                  </div>
                )}
              </Bloco>
            </div>
          )}
        </PageBody>
      </div>
    );
  }

  // ── Lista de colaboradores ────────────────────────────────────────────────
  const filtrados = colaboradores.filter(c =>
    c.nome.toLowerCase().includes(busca.toLowerCase()) || (c.cargo || "").toLowerCase().includes(busca.toLowerCase())
  );

  return (
    <div className="min-h-screen pb-24">
      <PageHeader title="Funcionários" subtitle={`A vida completa de cada funcionário · ${unidadeInfo?.nome || ""}`} icon={Users}
        onAction={() => router.push("/dashboard/rh")} actionLabel="Cadastrar funcionário" />
      <PageBody>
        <SearchBar value={busca} onChange={setBusca} placeholder="Buscar por nome ou cargo..." />
        {loading ? <SkeletonList rows={5} /> : filtrados.length === 0 ? (
          <EmptyState icon={Users} title={colaboradores.length === 0 ? "Nenhum funcionário" : "Nada encontrado"}
            hint={colaboradores.length === 0 ? "Cadastre a equipe no Painel da Equipe — aqui você acompanha a vida de cada um." : "Tente outro nome ou cargo."}
            actionLabel={colaboradores.length === 0 ? "Abrir Painel da Equipe" : undefined}
            onAction={colaboradores.length === 0 ? () => router.push("/dashboard/rh") : undefined} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtrados.map(c => {
              const inativo = (c.status || "ativo") === "inativo";
              return (
                <button key={c.id} onClick={() => abrir(c)} className={`erp-card p-5 text-left flex items-center gap-3 ${inativo ? "opacity-50" : ""}`}>
                  <div className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-black shrink-0" style={{ background: "var(--accent-soft)", color: "var(--accent-strong)" }}>
                    {c.nome[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold truncate" style={{ color: "var(--fg)" }}>{c.nome}</p>
                    <p className="text-[11px] font-bold uppercase tracking-widest truncate" style={{ color: "var(--dim)" }}>
                      {c.cargo || "—"}{c.tipo_contrato === "Freelancer" ? " · Extra" : ""}{inativo ? " · inativo" : ""}
                    </p>
                  </div>
                  <ChevronRight size={16} style={{ color: "var(--dim)" }} className="shrink-0" />
                </button>
              );
            })}
          </div>
        )}
      </PageBody>
    </div>
  );
}
