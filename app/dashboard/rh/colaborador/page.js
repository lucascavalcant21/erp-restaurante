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
  fetchAdvertenciasColab, calcularAdicionaisMes
} from "../../../lib/rh";
import { fetchHistoricoPonto, fetchPontosMes } from "../../../lib/ponto";

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
    const [rDocs, rFolgas, rConsumo, rBanco, rPonto, rAdv, rPontosMes] = await Promise.all([
      fetchDocumentos(c.id),
      fetchFolgasEsporadicas(c.id),
      fetchConsumoFuncionario(c.id),
      fetchBancoHorasColaborador(c.id, mes),
      fetchHistoricoPonto(c.id),
      fetchAdvertenciasColab(c.id),
      fetchPontosMes(c.id, mes),
    ]);
    setVida({
      docs: rDocs.data || [], folgas: rFolgas.data || [], consumo: rConsumo.data || [],
      banco: rBanco.data || [], ponto: rPonto.data || [],
      advertencias: rAdv.data || [], pontosMes: rPontosMes.data || [],
    });
    setVidaLoading(false);
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
            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-5 gap-y-3 text-sm">
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
                const ad = calcularAdicionaisMes(vida.pontosMes, sel.salario);
                const fixo = Number(sel.salario) || 0;
                const va = Number(sel.vale_alimentacao) || 0;
                const taxa = Number(sel.taxa_servico_mes) || 0;
                const totalMes = fixo + va + taxa + ad.valorNoturno + ad.valorExtra;
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
                    <p className="text-[10px] font-medium mt-2" style={{ color: "var(--dim)" }}>Adicionais calculados automaticamente do ponto (hora normal = salário ÷ 220). O botão "Lançar Folha" no RH usa estes valores.</p>
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
    c.nome.toLowerCase().includes(busca.toLowerCase()) || (c.cargo || "").toLowerCase().includes(busca.toLowerCase())
  );

  return (
    <div className="min-h-screen pb-24">
      <PageHeader title="Colaboradores" subtitle={`A vida completa de cada funcionário · ${unidadeInfo?.nome || ""}`} icon={Users}
        onAction={() => router.push("/dashboard/rh")} actionLabel="Cadastrar no RH" />
      <PageBody>
        <SearchBar value={busca} onChange={setBusca} placeholder="Buscar por nome ou cargo..." />
        {loading ? <SkeletonList rows={5} /> : filtrados.length === 0 ? (
          <EmptyState icon={Users} title={colaboradores.length === 0 ? "Nenhum colaborador" : "Nada encontrado"}
            hint={colaboradores.length === 0 ? "Cadastre a equipe na Gestão de RH — aqui você acompanha a vida de cada um." : "Tente outro nome ou cargo."}
            actionLabel={colaboradores.length === 0 ? "Ir para Gestão de RH" : undefined}
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
