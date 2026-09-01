"use client";
// tempo real: recarrega sozinho a cada 15s e quando o banco muda

import { useState, useEffect } from "react";
import { useTempoReal } from "../../../lib/realtime";
import { useRouter } from "next/navigation";
import {
  Users, ArrowLeft, Phone, CreditCard, Clock, Hourglass, CalendarHeart,
  ShoppingBag, FileText, Star, Edit3, Printer, ChevronRight, User, Network,
  DollarSign, AlertTriangle, MapPin
} from "lucide-react";
import { PageHeader, PageBody, EmptyState, SearchBar, SkeletonList, fmtBRL, fmtData } from "../../../components/ui";
import { useERP } from "../../../context/ERPContext";
import {
  fetchColaboradores, fetchDocumentos, fetchFolgasEsporadicas, fetchConsumoFuncionario, fetchAtestados,
  salvarAtestado, removerAtestado, anexarArquivoAtestado,
  fetchBancoHorasColaborador, somaMinutosBanco, BANCO_LIMITE_MIN, BANCO_ALERTA_MIN,
  fetchAdvertenciasColab, calcularAdicionaisMes, jornadaContratadaMin, fetchFeriados, fetchAllFolgasDaUnidade
} from "../../../lib/rh";
import { fetchHistoricoPonto, fetchPontosMes, fetchPontoHoje } from "../../../lib/ponto";
import { situacaoDoPonto, atestadoNaData, CORES_TOM } from "../../../lib/ponto-status.mjs";
import { fetchHolerites, confirmarRecebimentoHolerite } from "../../../lib/pessoas";

const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
// Nome curto de cada batida, para caber na etiqueta de localização.
const ROTULO_BATIDA = {
  entrada: "Entrada", saida_intervalo: "Saiu p/ intervalo",
  retorno_intervalo: "Voltou", saida_trabalho: "Saída",
};

// Mesma dedução de área usada na Escala da Semana do painel
const AREAS = ["Salão", "Bar", "Cozinha", "Caixa", "Louça", "Outros"];
function areaDoCargo(cargo) {
  const c = (cargo || "").toLowerCase();
  if (/(caixa|financ|tesour|recep)/.test(c)) return "Caixa";
  if (/(lou[çc]a|copa|steward|lavagem|higieniz)/.test(c)) return "Louça";
  if (/(cozinh|chapeir|confeit|pizzai|sushi|salgad|padeir|churrasqueir|a[cç]ougue|chefe de fila)/.test(c)) return "Cozinha";
  if (/(\bbar\b|barman|bartender|barista|copeir)/.test(c)) return "Bar";
  if (/(gar[çc]|atendente|sal[aã]o|hostess|maitre|maître|comand|gerente|supervisor)/.test(c)) return "Salão";
  return "Outros";
}
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
  const [areaFiltro, setAreaFiltro] = useState("Todos");
  const [pontosHoje, setPontosHoje] = useState({});   // colaborador_id → registro de hoje
  const [folgasHoje, setFolgasHoje] = useState(new Set()); // ids com folga esporádica hoje

  // Colaborador aberto + a vida dele
  const [sel, setSel] = useState(null);
  const [vida, setVida] = useState(null); // { docs, folgas, consumo, banco, ponto }
  const [vidaLoading, setVidaLoading] = useState(false);
  const [formAtestado, setFormAtestado] = useState(null);
  const [salvandoAtestado, setSalvandoAtestado] = useState(false);

  const salvarAtestadoDoColaborador = async () => {
    if (!formAtestado?.data_inicio) return alert("Informe a data de início do atestado.");
    setSalvandoAtestado(true);
    // O anexo sobe primeiro: se o arquivo falhar, o registro não nasce sem a
    // prova — melhor não gravar do que gravar um atestado que ninguém consegue
    // comprovar depois.
    let arquivo_url = "";
    if (formAtestado.arquivo) {
      const envio = await anexarArquivoAtestado(sel.id, formAtestado.arquivo);
      if (envio.error) { setSalvandoAtestado(false); return alert(`Não consegui anexar o arquivo: ${envio.error}`); }
      arquivo_url = envio.url;
    }
    const { error } = await salvarAtestado({
      unidade_id: unidadeAtiva, colaborador_id: sel.id,
      data_inicio: formAtestado.data_inicio,
      data_fim: formAtestado.data_fim || formAtestado.data_inicio,
      parcial: !!formAtestado.parcial,
      cid: formAtestado.cid || null, medico: formAtestado.medico || null,
      observacao: formAtestado.observacao || null,
      arquivo_url: arquivo_url || null,
    });
    setSalvandoAtestado(false);
    if (error) return alert(`Não consegui salvar: ${error}`);
    setFormAtestado(null);
    await abrir(sel);
  };

  const excluirAtestado = async (id) => {
    if (!confirm("Excluir este atestado? O dia volta a contar como falta.")) return;
    const { error } = await removerAtestado(id);
    if (error) return alert(error);
    await abrir(sel);
  };

  const carregarLista = async (silencioso = false) => {
    if (!unidadeAtiva || unidadeAtiva === "todas") { setLoading(false); return; }
    if (!silencioso) setLoading(true);
    const hojeISO = new Date().toISOString().split("T")[0];
    const [{ data }, rPonto, rFolgas] = await Promise.all([
      fetchColaboradores(unidadeAtiva),
      fetchPontoHoje(unidadeAtiva),
      fetchAllFolgasDaUnidade(unidadeAtiva),
    ]);
    setColaboradores(data || []);
    const mapa = {};
    (rPonto.data || []).forEach(r => { mapa[r.colaborador_id] = r; });
    setPontosHoje(mapa);
    setFolgasHoje(new Set((rFolgas.data || []).filter(f => f.data_folga === hojeISO).map(f => f.colaborador_id)));
    setLoading(false);
  };

  useEffect(() => { carregarLista(); /* eslint-disable-next-line */ }, [unidadeAtiva]);
  useTempoReal(null, () => carregarLista(true)); // batidas de ponto aparecem sozinhas nos cards

  const abrir = async (c) => {
    setSel(c);
    setVida(null);
    setVidaLoading(true);
    const mes = new Date().toISOString().slice(0, 7);
    const [rDocs, rFolgas, rConsumo, rBanco, rPonto, rAdv, rPontosMes, rFeriados, rHolerites, rAtestados] = await Promise.all([
      fetchDocumentos(c.id),
      fetchFolgasEsporadicas(c.id),
      fetchConsumoFuncionario(c.id),
      fetchBancoHorasColaborador(c.id, mes),
      fetchHistoricoPonto(c.id),
      fetchAdvertenciasColab(c.id),
      fetchPontosMes(c.id, mes),
      fetchFeriados(unidadeAtiva, mes),
      fetchHolerites(c.id),
      fetchAtestados(c.id),
    ]);
    setVida({
      docs: rDocs.data || [], folgas: rFolgas.data || [], consumo: rConsumo.data || [],
      banco: rBanco.data || [], ponto: rPonto.data || [],
      advertencias: rAdv.data || [], pontosMes: rPontosMes.data || [], feriados: rFeriados.data || [],
      holerites: Array.isArray(rHolerites) ? rHolerites : [],
      atestados: rAtestados?.data || [],
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
        <PageHeader title="Colaboradores" subtitle="A vida completa de cada funcionário" icon={Users} />
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
            </div>
          </Bloco>

          {vidaLoading || !vida ? <SkeletonList rows={4} /> : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Remuneração do mês: fixo + VA + taxa + adicionais do ponto (CLT) */}
              {!isFree && (() => {
                const ad = calcularAdicionaisMes(vida.pontosMes, sel.salario, vida.feriados, { contratadaDoDia: (d) => jornadaContratadaMin(sel, d) });
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

              {/* Diárias trabalhadas do extra: cada dia com horário e valor + total pago */}
              {isFree && (() => {
                const diaria = Number(sel.salario) || 0;
                const dias = (vida.pontosMes || [])
                  .filter(p => p.hora_entrada)
                  .sort((a, b) => (b.data_referencia || "").localeCompare(a.data_referencia || ""));
                const pagos = (vida.holerites || []).filter(h => h.detalhes?.recebimento_confirmado).length;
                const totalPago = (vida.holerites || []).filter(h => h.detalhes?.recebimento_confirmado).reduce((s, h) => s + (Number(h.liquido) || 0), 0);
                return (
                  <Bloco icon={CalendarHeart} titulo="Diárias trabalhadas (mês)"
                    extra={<span className="text-sm font-black" style={{ color: "var(--accent-strong)" }}>{dias.length} dia(s) · {fmtBRL(dias.length * diaria)}</span>}>
                    {dias.length === 0 ? (
                      <p className="text-xs font-medium" style={{ color: "var(--dim)" }}>Nenhuma diária registrada neste mês.</p>
                    ) : (
                      <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                        {dias.map(p => (
                          <div key={p.id} className="flex items-center justify-between text-xs p-2 rounded-lg" style={{ background: "var(--elevated)" }}>
                            <div className="min-w-0">
                              <p className="font-bold" style={{ color: "var(--fg-soft)" }}>{p.data_referencia?.split("-").reverse().join("/")}</p>
                              <p className="text-[10px] font-medium" style={{ color: "var(--dim)" }}>{horaDe(p.hora_entrada)} às {horaDe(p.hora_saida)}</p>
                            </div>
                            <span className="font-black shrink-0 ml-2" style={{ color: "var(--accent-strong)" }}>{fmtBRL(diaria)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 pt-2 border-t text-[11px] font-bold" style={{ borderColor: "var(--line-soft)", color: "var(--dim)" }}>
                      <span>Recibos pagos: <b style={{ color: "#15803D" }}>{pagos}</b></span>
                      <span>Total pago: <b style={{ color: "#15803D" }}>{fmtBRL(totalPago)}</b></span>
                    </div>
                    <p className="text-[10px] font-medium mt-1" style={{ color: "var(--dim)" }}>Diária base {fmtBRL(diaria)} × dias com ponto. Advertências e recibos completos nos blocos ao lado.</p>
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
                <p className="text-[10px] font-medium mt-2" style={{ color: "var(--dim)" }}>Registradas e impressas pela Gestão de RH (botão Advertências).</p>
              </Bloco>
              {/* Atestados médicos. Fica antes do ponto de propósito: quem abre
                  a ficha para conferir uma falta precisa ver o atestado antes
                  de olhar o dia em branco e concluir a coisa errada. */}
              <Bloco icon={FileText} titulo="Atestados médicos"
                extra={<button onClick={() => setFormAtestado({ data_inicio: "", data_fim: "", parcial: false, cid: "", medico: "", observacao: "" })}
                  className="text-[10px] font-bold" style={{ color: "var(--accent-strong)" }}>Registrar</button>}>
                {formAtestado && (
                  <div className="mb-3 rounded-xl border p-3" style={{ borderColor: "var(--line)", background: "var(--elevated)" }}>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="block"><span className="erp-label">Início</span>
                        <input type="date" value={formAtestado.data_inicio} onChange={e => setFormAtestado({ ...formAtestado, data_inicio: e.target.value })} className="h-11 w-full rounded-lg border px-2 text-sm font-bold" style={{ borderColor: "var(--line)" }} /></label>
                      <label className="block"><span className="erp-label">Fim</span>
                        <input type="date" value={formAtestado.data_fim} onChange={e => setFormAtestado({ ...formAtestado, data_fim: e.target.value })} placeholder="igual ao início" className="h-11 w-full rounded-lg border px-2 text-sm font-bold" style={{ borderColor: "var(--line)" }} /></label>
                      <label className="block"><span className="erp-label">CID (opcional)</span>
                        <input value={formAtestado.cid} onChange={e => setFormAtestado({ ...formAtestado, cid: e.target.value })} className="h-11 w-full rounded-lg border px-2 text-sm font-bold" style={{ borderColor: "var(--line)" }} /></label>
                      <label className="block"><span className="erp-label">Médico (opcional)</span>
                        <input value={formAtestado.medico} onChange={e => setFormAtestado({ ...formAtestado, medico: e.target.value })} className="h-11 w-full rounded-lg border px-2 text-sm font-bold" style={{ borderColor: "var(--line)" }} /></label>
                    </div>
                    <label className="mt-2 flex items-center gap-2 text-xs font-bold" style={{ color: "var(--fg-soft)" }}>
                      <input type="checkbox" checked={formAtestado.parcial} onChange={e => setFormAtestado({ ...formAtestado, parcial: e.target.checked })} className="h-4 w-4 accent-cyan-600" />
                      Trabalhou e saiu no meio do turno (o ponto do dia continua valendo)
                    </label>
                    <label className="mt-2 block"><span className="erp-label">Anexar o atestado</span>
                      <input type="file" accept="image/*,application/pdf" onChange={e => setFormAtestado({ ...formAtestado, arquivo: e.target.files?.[0] || null })}
                        className="mt-1 w-full text-xs font-bold" /></label>
                    <div className="mt-3 flex gap-2">
                      <button onClick={() => setFormAtestado(null)} className="h-10 flex-1 rounded-lg border text-xs font-bold" style={{ borderColor: "var(--line)" }}>Cancelar</button>
                      <button onClick={salvarAtestadoDoColaborador} disabled={salvandoAtestado}
                        className="h-10 flex-1 rounded-lg text-xs font-black text-white disabled:opacity-60" style={{ background: "var(--accent-strong)" }}>
                        {salvandoAtestado ? "Salvando..." : "Salvar atestado"}
                      </button>
                    </div>
                  </div>
                )}
                {(vida.atestados || []).length === 0 ? (
                  <p className="text-xs font-medium" style={{ color: "var(--dim)" }}>Nenhum atestado registrado.</p>
                ) : (
                  <div className="space-y-2">
                    {vida.atestados.map(a => (
                      <div key={a.id} className="flex items-center justify-between gap-2 rounded-lg p-2.5" style={{ background: "var(--elevated)" }}>
                        <div className="min-w-0">
                          <p className="text-xs font-black" style={{ color: "var(--fg)" }}>
                            {String(a.data_inicio).split("-").reverse().join("/")}
                            {a.data_fim && a.data_fim !== a.data_inicio ? ` até ${String(a.data_fim).split("-").reverse().join("/")}` : ""}
                            {a.parcial ? " · parcial" : ""}
                          </p>
                          <p className="text-[10px] font-bold" style={{ color: "var(--dim)" }}>
                            {[a.cid && `CID ${a.cid}`, a.medico, a.observacao].filter(Boolean).join(" · ") || "Sem detalhes"}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5">
                          {a.arquivo_url && <a href={a.arquivo_url} target="_blank" rel="noreferrer" className="text-[10px] font-black" style={{ color: "var(--accent-strong)" }}>Ver anexo</a>}
                          <button onClick={() => excluirAtestado(a.id)} className="text-[10px] font-bold text-rose-600">Excluir</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Bloco>

              {/* Ponto */}
              <Bloco icon={Clock} titulo="Ponto — últimos dias"
                extra={<button onClick={() => router.push(`/dashboard/rh/espelho/${sel.id}?mes=${new Date().toISOString().slice(0, 7)}`)} className="text-[10px] font-bold flex items-center gap-0.5" style={{ color: "var(--accent-strong)" }}>Espelho completo <ChevronRight size={11} /></button>}>
                {vida.ponto.length === 0 ? <p className="text-xs font-medium" style={{ color: "var(--dim)" }}>Sem batidas registradas ainda.</p> : (
                  <div className="space-y-1">
                    <div className="grid grid-cols-[60px_1fr_1fr_1fr_1fr] gap-1 text-[9px] font-black uppercase tracking-widest text-center" style={{ color: "var(--dim)" }}>
                      <span className="text-left">Dia</span><span>Entrada</span><span>Int. saída</span><span>Int. volta</span><span>Saída</span>
                    </div>
                    {vida.ponto.map(h => {
                      const marcas = Array.isArray(h.localizacoes) ? h.localizacoes : [];
                      const atestado = atestadoNaData(vida.atestados, h.data_referencia);
                      return (
                      <div key={h.id} className="rounded-lg py-1.5" style={{ background: "var(--elevated)" }}>
                        <div className="grid grid-cols-[60px_1fr_1fr_1fr_1fr] gap-1 items-center text-center">
                          <span className="text-[11px] font-black text-left pl-2" style={{ color: "var(--muted)" }}>{h.data_referencia?.slice(5).split("-").reverse().join("/")}</span>
                          {["hora_entrada", "hora_saida_intervalo", "hora_retorno_intervalo", "hora_saida"].map(c => (
                            <span key={c} className="text-xs font-bold" style={{ color: h[c] ? "var(--fg-soft)" : "var(--dim)" }}>{horaDe(h[c])}</span>
                          ))}
                        </div>
                        {atestado && (
                          <div className="mt-1.5 px-2">
                            <span className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[9px] font-black"
                              style={{ background: CORES_TOM.atestado.fundo, color: CORES_TOM.atestado.cor }}>
                              Atestado médico{atestado.cid ? ` · CID ${atestado.cid}` : ""}
                            </span>
                          </div>
                        )}
                        {/* Onde a pessoa estava em cada batida. É a prova de que
                            o ponto foi batido no restaurante, e não a caminho. */}
                        {marcas.length > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-1 px-2">
                            {marcas.map((m, i) => (
                              <span key={i} className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[9px] font-black"
                                style={{ background: m.valido === false ? "rgba(244,63,94,.12)" : "rgba(16,185,129,.12)", color: m.valido === false ? "#BE123C" : "#047857" }}
                                title={m.latitude != null ? `${m.latitude}, ${m.longitude}` : "Sem coordenada"}>
                                <MapPin size={9} />
                                {ROTULO_BATIDA[m.tipo] || m.tipo}
                                {m.distancia_metros != null ? ` · ${Math.round(m.distancia_metros)}m` : ""}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      );
                    })}
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
                {vida.docs.length === 0 ? <p className="text-xs font-medium" style={{ color: "var(--dim)" }}>Nenhum documento. Anexe pela Gestão de RH.</p> : (
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
    (c.nome.toLowerCase().includes(busca.toLowerCase()) || (c.cargo || "").toLowerCase().includes(busca.toLowerCase())) &&
    (areaFiltro === "Todos" || areaDoCargo(c.cargo) === areaFiltro)
  );

  // Situação de agora: folga na frente, o resto vem do módulo de status, que é
  // a mesma frase usada no painel do RH — a tela não escreve texto próprio.
  const statusDoDia = (c) => {
    if ((c.status || "ativo") === "inativo") return null;
    const diaSemana = String(new Date().getDay());
    const folga = folgasHoje.has(c.id) || !(c.dias_trabalho || "").split(",").includes(diaSemana);
    if (folga) return { rotulo: "Folga hoje", cor: "var(--dim)", fundo: "var(--elevated)" };
    const situacao = situacaoDoPonto(pontosHoje[c.id]);
    const cores = CORES_TOM[situacao.tom] || CORES_TOM.atencao;
    return { rotulo: situacao.texto, ...cores };
  };

  return (
    <div className="min-h-screen pb-24">
      <PageHeader title="Colaboradores" subtitle={`A vida completa de cada funcionário · ${unidadeInfo?.nome || ""}`} icon={Users}
        onAction={() => router.push("/dashboard/rh")} actionLabel="Cadastrar no RH" />
      <PageBody>
        <SearchBar value={busca} onChange={setBusca} placeholder="Buscar por nome ou cargo..." />
        <div className="flex gap-1.5 overflow-x-auto pb-1 -mt-1 mb-3">
          {["Todos", ...AREAS].map(a => {
            const n = a === "Todos" ? colaboradores.length : colaboradores.filter(c => areaDoCargo(c.cargo) === a).length;
            if (a !== "Todos" && n === 0) return null;
            return (
              <button key={a} onClick={() => setAreaFiltro(a)}
                className={`px-3 py-1.5 rounded-full text-[11px] font-black whitespace-nowrap transition-colors ${areaFiltro === a ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900" : ""}`}
                style={areaFiltro === a ? {} : { background: "var(--elevated)", color: "var(--muted)" }}>
                {a} <span className={areaFiltro === a ? "opacity-60" : ""} style={areaFiltro === a ? {} : { color: "var(--dim)" }}>({n})</span>
              </button>
            );
          })}
        </div>
        {loading ? <SkeletonList rows={5} /> : filtrados.length === 0 ? (
          <EmptyState icon={Users} title={colaboradores.length === 0 ? "Nenhum colaborador" : "Nada encontrado"}
            hint={colaboradores.length === 0 ? "Cadastre a equipe na Gestão de RH — aqui você acompanha a vida de cada um." : "Tente outro nome ou cargo."}
            actionLabel={colaboradores.length === 0 ? "Ir para Gestão de RH" : undefined}
            onAction={colaboradores.length === 0 ? () => router.push("/dashboard/rh") : undefined} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtrados.map(c => {
              const inativo = (c.status || "ativo") === "inativo";
              const st = statusDoDia(c);
              return (
                <button key={c.id} onClick={() => abrir(c)} className={`erp-card p-5 text-left flex items-center gap-3 ${inativo ? "opacity-50" : ""}`}>
                  <div className="w-12 h-12 rounded-full overflow-hidden flex items-center justify-center text-lg font-black shrink-0" style={{ background: "var(--accent-soft)", color: "var(--accent-strong)" }}>
                    {c.foto ? <img src={`data:image/jpeg;base64,${c.foto}`} alt={c.nome} className="w-full h-full object-cover" /> : c.nome[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold truncate" style={{ color: "var(--fg)" }}>{c.nome}</p>
                    <p className="text-[11px] font-bold uppercase tracking-widest truncate" style={{ color: "var(--dim)" }}>
                      {c.cargo || "—"}{c.tipo_contrato === "Freelancer" ? " · Extra" : ""}{inativo ? " · inativo" : ""}
                    </p>
                    {st && (
                      <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-black" style={{ background: st.fundo, color: st.cor }}>
                        {st.rotulo}
                      </span>
                    )}
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
