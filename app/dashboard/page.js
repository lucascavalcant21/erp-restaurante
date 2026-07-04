"use client";

import { useState, useEffect, useMemo } from "react";
import { useERP } from "../context/ERPContext";
import {
  Percent, Users, Wallet, ShoppingCart, PackageX, CalendarClock,
  Sparkles, Wind, AlertCircle, Clock, Megaphone, ChefHat, ArrowRight, CheckCircle2
} from "lucide-react";
import { useRouter } from "next/navigation";
import { fmtBRL, fmtPct } from "../components/ui";

import { fetchFichas } from "../lib/operacao";
import { fetchProdutos } from "../lib/vendas";
import { fetchColaboradores, fetchAllFolgasDaUnidade } from "../lib/rh";
import { fetchContas } from "../lib/financeiro";
import { fetchEstoque } from "../lib/estoque";
import { fetchManutencoes } from "../lib/controles_cozinha";
import { fetchCampanhas } from "../lib/clientes";

const META_CMV = 30; // % alvo máximo de CMV

// ── Cálculo de custo de ficha (reaproveitado da tela de CMV) ──────────────────
function custoTotalDaFicha(f, todasFichas, guard = new Set()) {
  if (!f || guard.has(f.id)) return 0;
  guard.add(f.id);
  let total = 0;
  (f.fichas_ingredientes || []).forEach(fi => {
    if (fi.insumos) {
      total += (fi.insumos.custo_unitario || 0) * (fi.quantidade || 0);
    } else if (fi.subficha_id) {
      const base = todasFichas.find(x => x.id === fi.subficha_id);
      const custoBaseUnit = base ? custoTotalDaFicha(base, todasFichas, guard) / (base.rendimento_porcoes || 1) : 0;
      total += custoBaseUnit * (fi.quantidade || 0);
    }
  });
  return total;
}
function porcoesDaFicha(f) {
  const rend = Number(f?.rendimento_porcoes) || 1;
  const un = String(f?.rendimento_unidade || "porcao").toLowerCase();
  if (un === "porcao" || un === "un") return rend;
  const pesoPorcao = Number(f?.peso_porcao_g) || 0;
  const pesoTotalG = (un === "kg" || un === "l") ? rend * 1000 : rend;
  return pesoPorcao > 0 ? pesoTotalG / pesoPorcao : rend;
}

function diasAte(dataStr) {
  if (!dataStr) return null;
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const alvo = new Date((dataStr.length <= 10 ? dataStr + "T00:00:00" : dataStr));
  return Math.round((alvo - hoje) / 86400000);
}
function fmtDataCurta(iso) {
  if (!iso) return "—";
  const s = iso.length <= 10 ? iso + "T00:00:00" : iso;
  return new Date(s).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export default function DashboardGestao() {
  const { unidadeAtiva, unidadeInfo } = useERP();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [dados, setDados] = useState(null);

  useEffect(() => {
    if (!unidadeAtiva || unidadeAtiva === "todas") { setLoading(false); setDados(null); return; }
    let vivo = true;
    (async () => {
      setLoading(true);
      const [rF, rP, rColab, rFolgas, rContas, rEstoque, rManut, rCamp] = await Promise.all([
        fetchFichas(unidadeAtiva), fetchProdutos(unidadeAtiva), fetchColaboradores(unidadeAtiva),
        fetchAllFolgasDaUnidade(unidadeAtiva), fetchContas(unidadeAtiva, ""), fetchEstoque(unidadeAtiva),
        fetchManutencoes(unidadeAtiva), fetchCampanhas(unidadeAtiva),
      ]);
      if (!vivo) return;
      setDados({
        fichas: rF.data || [], produtos: rP.data || [], colaboradores: rColab.data || [],
        folgas: rFolgas.data || [], contas: rContas.data || [], estoque: rEstoque.data || [],
        manutencoes: rManut.data || [], campanhas: rCamp.fromSeed ? [] : (rCamp.data || []),
      });
      setLoading(false);
    })();
    return () => { vivo = false; };
  }, [unidadeAtiva]);

  const m = useMemo(() => {
    if (!dados) return null;
    const { fichas, produtos, colaboradores, folgas, contas, estoque, manutencoes, campanhas } = dados;

    // CMV médio da carta
    const fichasPorId = {}; fichas.forEach(f => { fichasPorId[f.id] = f; });
    const cmvs = produtos
      .filter(p => (Number(p.preco_venda) || 0) > 0)
      .map(p => {
        const comps = Array.isArray(p.composicao) && p.composicao.length ? p.composicao
          : (p.ficha_id ? [{ ficha_id: p.ficha_id, qtd: 1 }] : []);
        let custo = 0, tem = false;
        comps.forEach(c => {
          const ficha = fichasPorId[c.ficha_id]; if (!ficha) return; tem = true;
          custo += (custoTotalDaFicha(ficha, fichas) / porcoesDaFicha(ficha)) * (Number(c.qtd) || 1);
        });
        const preco = Number(p.preco_venda) || 0;
        return tem && preco > 0 ? (custo / preco) * 100 : null;
      }).filter(v => v !== null);
    const cmvMedio = cmvs.length ? cmvs.reduce((a, b) => a + b, 0) / cmvs.length : 0;
    const cmvAcima = cmvs.filter(v => v > META_CMV).length;

    // Folha / custo de mão de obra (colaboradores ativos)
    const ativos = colaboradores.filter(c => (c.status || "ativo") !== "inativo");
    const folhaMes = ativos.reduce((s, c) => s + (Number(c.salario) || 0), 0);

    // Equipe de hoje (trabalha hoje e sem folga hoje)
    const hojeISO = new Date().toISOString().split("T")[0];
    const diaSemana = String(new Date().getDay());
    const folgamHoje = new Set(folgas.filter(f => f.data_folga === hojeISO).map(f => f.colaborador_id));
    const equipeHoje = ativos.filter(c =>
      (c.dias_trabalho || "").split(",").includes(diaSemana) && !folgamHoje.has(c.id)
    );

    // Contas a pagar do mês (pendentes)
    const mesAtual = hojeISO.slice(0, 7);
    const pendentes = contas.filter(c => (c.status || "pendente") !== "pago");
    const contasMes = pendentes.filter(c => (c.data_vencimento || "").slice(0, 7) <= mesAtual || (c.data_vencimento || "") <= hojeISO);
    const totalContasMes = contasMes.reduce((s, c) => s + (Number(c.valor) || 0), 0);
    const contasVencendo = pendentes
      .map(c => ({ ...c, dias: diasAte(c.data_vencimento) }))
      .filter(c => c.dias !== null && c.dias <= 7)
      .sort((a, b) => a.dias - b.dias).slice(0, 4);

    // Comprar / repor: itens sem estoque
    const semEstoque = estoque.filter(e => (Number(e.quantidade_atual) || 0) <= 0);

    // Limpezas programadas vencendo (até 3 dias ou atrasadas)
    const limpezasVencendo = manutencoes
      .map(x => ({ ...x, dias: diasAte(x.proxima_prevista) }))
      .filter(x => x.dias !== null && x.dias <= 3)
      .sort((a, b) => a.dias - b.dias);

    // Marketing: campanhas ativas
    const campanhasAtivas = campanhas.filter(c => String(c.status || "").toLowerCase() === "ativa");

    return {
      cmvMedio, cmvAcima, cmvCount: cmvs.length,
      folhaMes, ativosCount: ativos.length,
      equipeHoje, totalContasMes, contasVencendo,
      semEstoque, limpezasVencendo, campanhasAtivas,
    };
  }, [dados]);

  if (!unidadeAtiva || unidadeAtiva === "todas") {
    return (
      <div className="p-6 sm:p-8 max-w-7xl mx-auto">
        <div className="erp-card p-10 text-center text-slate-500 font-bold">Selecione uma unidade no topo para ver o painel de gestão.</div>
      </div>
    );
  }

  if (loading || !m) {
    return (
      <div className="p-6 sm:p-8 max-w-7xl mx-auto space-y-6">
        <div className="h-8 w-56 erp-skeleton rounded-lg" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {[0, 1, 2, 3].map(i => <div key={i} className="erp-card h-36" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {[0, 1, 2].map(i => <div key={i} className="erp-card h-64" />)}
        </div>
      </div>
    );
  }

  const cmvBom = m.cmvMedio <= META_CMV;

  const Kpi = ({ icon: Icon, label, value, sub, tintBg, tintFg, onClick, alerta }) => (
    <button onClick={onClick} className="erp-card p-6 flex flex-col justify-between text-left group" style={{ minHeight: 140 }}>
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs font-bold tracking-widest uppercase" style={{ color: "var(--muted)" }}>{label}</p>
        <div className="w-11 h-11 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110" style={{ background: tintBg || "var(--accent-soft)" }}>
          <Icon size={20} style={{ color: tintFg || "var(--accent-strong)" }} />
        </div>
      </div>
      <div>
        <h3 className="text-3xl font-extrabold tracking-tight" style={{ color: alerta ? tintFg : "var(--fg)" }}>{value}</h3>
        {sub && <p className="text-[11px] font-bold mt-1" style={{ color: "var(--dim)" }}>{sub}</p>}
      </div>
    </button>
  );

  return (
    <div className="p-5 sm:p-8 max-w-7xl mx-auto space-y-7 pb-16">
      <div>
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight" style={{ color: "var(--fg)" }}>Painel de Gestão</h1>
        <p className="mt-1 font-medium" style={{ color: "var(--muted)" }}>
          Controle operacional de <strong style={{ color: "var(--accent-strong)" }}>{unidadeInfo?.nome || "sua loja"}</strong>.
        </p>
      </div>

      {/* KPIs de gestão */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        <Kpi icon={Percent} label="CMV médio da carta"
          value={m.cmvCount ? fmtPct(m.cmvMedio) : "—"}
          sub={m.cmvCount ? (cmvBom ? "dentro da meta de 30%" : `${m.cmvAcima} prato(s) acima da meta`) : "sem fichas precificadas"}
          tintBg={cmvBom ? "rgba(5,150,105,0.12)" : "rgba(239,68,68,0.12)"}
          tintFg={cmvBom ? "#047857" : "#DC2626"} alerta={!cmvBom && m.cmvCount > 0}
          onClick={() => router.push("/dashboard/financeiro/cmv")} />

        <Kpi icon={Wallet} label="Folha do mês (mão de obra)"
          value={fmtBRL(m.folhaMes)} sub={`${m.ativosCount} colaborador(es) ativo(s)`}
          tintBg="rgba(59,130,246,0.10)" tintFg="#2563EB"
          onClick={() => router.push("/dashboard/rh")} />

        <Kpi icon={ShoppingCart} label="Contas a pagar (mês)"
          value={fmtBRL(m.totalContasMes)} sub={m.contasVencendo.length ? `${m.contasVencendo.length} vencendo em breve` : "nada vencendo"}
          tintBg="rgba(239,68,68,0.10)" tintFg="#DC2626" alerta={m.totalContasMes > 0}
          onClick={() => router.push("/dashboard/financeiro/contas")} />

        <Kpi icon={Users} label="Equipe de hoje"
          value={m.equipeHoje.length} sub="funcionários escalados hoje"
          tintBg="rgba(139,92,246,0.10)" tintFg="#7C3AED"
          onClick={() => router.push("/dashboard/rh/ponto")} />
      </div>

      {/* Painéis operacionais */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Programação de funcionários — hoje */}
        <PainelLista
          titulo="Programação de Hoje" icon={Users} corIcon="#7C3AED"
          vazio="Ninguém escalado para hoje." acao={() => router.push("/dashboard/rh/ponto")}
          itens={m.equipeHoje.slice(0, 6).map(c => ({
            id: c.id, principal: c.nome, secundario: c.cargo || "—",
            direita: (c.horario_entrada || c.horario_saida) ? `${c.horario_entrada || "?"} – ${c.horario_saida || "?"}` : "",
          }))}
          contador={m.equipeHoje.length}
        />

        {/* Comprar / repor estoque */}
        <PainelLista
          titulo="Repor / Comprar" icon={PackageX} corIcon="#DC2626"
          vazio="Nenhum insumo zerado. Estoque ok." acao={() => router.push("/dashboard/operacao/compras")}
          itens={m.semEstoque.slice(0, 6).map(e => ({
            id: e.insumo_id, principal: e.nome, secundario: e.departamento || "",
            direita: "sem estoque", direitaCor: "#DC2626",
          }))}
          contador={m.semEstoque.length}
        />

        {/* Alertas: limpezas + contas + marketing */}
        <div className="erp-card p-6">
          <h3 className="text-lg font-black mb-5 flex items-center gap-2" style={{ color: "var(--fg)" }}>
            <AlertCircle size={20} className="text-orange-500" /> Alertas & Agenda
          </h3>

          <div className="space-y-5">
            <BlocoAlerta titulo="Limpezas vencendo" icon={Sparkles}
              vazio="Nenhuma limpeza vencendo." acao={() => router.push("/dashboard/operacao/controles")}>
              {m.limpezasVencendo.slice(0, 3).map(l => {
                const atras = l.dias < 0;
                return (
                  <div key={l.id} className="flex justify-between items-center p-2.5 rounded-xl" style={{ background: atras ? "rgba(239,68,68,0.08)" : "rgba(245,158,11,0.10)" }}>
                    <span className="text-sm font-bold flex items-center gap-1.5 min-w-0" style={{ color: "var(--fg-soft)" }}>
                      {l.categoria === "ar_condicionado" ? <Wind size={13} /> : <Sparkles size={13} />}
                      <span className="truncate">{l.nome}</span>
                    </span>
                    <span className="text-[11px] font-black shrink-0 ml-2" style={{ color: atras ? "#DC2626" : "#B45309" }}>
                      {atras ? `Atrasada ${Math.abs(l.dias)}d` : l.dias === 0 ? "Hoje" : `${l.dias}d`}
                    </span>
                  </div>
                );
              })}
            </BlocoAlerta>

            <BlocoAlerta titulo="Contas vencendo" icon={CalendarClock}
              vazio="Nenhuma conta vencendo." acao={() => router.push("/dashboard/financeiro/contas")}>
              {m.contasVencendo.slice(0, 3).map(c => (
                <div key={c.id} className="flex justify-between items-center p-2.5 rounded-xl" style={{ background: "rgba(239,68,68,0.06)" }}>
                  <div className="min-w-0">
                    <span className="text-sm font-bold block truncate" style={{ color: "var(--fg-soft)" }}>{c.descricao}</span>
                    <span className="text-[10px] font-bold flex items-center gap-1" style={{ color: "#DC2626" }}>
                      <Clock size={9} /> {c.dias < 0 ? `Atrasada ${Math.abs(c.dias)}d` : c.dias === 0 ? "Vence hoje" : `Vence em ${c.dias}d`}
                    </span>
                  </div>
                  <span className="text-sm font-black shrink-0 ml-2" style={{ color: "var(--fg)" }}>{fmtBRL(c.valor)}</span>
                </div>
              ))}
            </BlocoAlerta>

            <BlocoAlerta titulo="Marketing ativo" icon={Megaphone}
              vazio="Nenhuma campanha ativa." acao={() => router.push("/dashboard/clientes/campanhas")}>
              {m.campanhasAtivas.slice(0, 3).map(c => (
                <div key={c.id} className="flex justify-between items-center p-2.5 rounded-xl" style={{ background: "rgba(5,150,105,0.07)" }}>
                  <span className="text-sm font-bold truncate" style={{ color: "var(--fg-soft)" }}>{c.nome || c.titulo || "Campanha"}</span>
                  <CheckCircle2 size={14} className="text-emerald-500 shrink-0 ml-2" />
                </div>
              ))}
            </BlocoAlerta>
          </div>
        </div>
      </div>
    </div>
  );
}

// Painel genérico com lista + botão de ação
function PainelLista({ titulo, icon: Icon, corIcon, itens, vazio, acao, contador }) {
  return (
    <div className="erp-card p-6 flex flex-col">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-lg font-black flex items-center gap-2" style={{ color: "var(--fg)" }}>
          <Icon size={20} style={{ color: corIcon }} /> {titulo}
        </h3>
        {contador > 0 && (
          <span className="text-xs font-black px-2.5 py-1 rounded-full" style={{ background: "var(--elevated)", color: "var(--muted)" }}>{contador}</span>
        )}
      </div>
      {itens.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-center py-6">
          <p className="text-sm font-medium" style={{ color: "var(--dim)" }}>{vazio}</p>
        </div>
      ) : (
        <div className="space-y-2 flex-1">
          {itens.map(it => (
            <div key={it.id} className="flex justify-between items-center p-3 rounded-xl" style={{ background: "var(--elevated)" }}>
              <div className="min-w-0">
                <span className="text-sm font-bold block truncate" style={{ color: "var(--fg-soft)" }}>{it.principal}</span>
                {it.secundario && <span className="text-[11px] font-medium block truncate" style={{ color: "var(--dim)" }}>{it.secundario}</span>}
              </div>
              {it.direita && <span className="text-[11px] font-black shrink-0 ml-2" style={{ color: it.direitaCor || "var(--muted)" }}>{it.direita}</span>}
            </div>
          ))}
        </div>
      )}
      <button onClick={acao} className="mt-4 text-xs font-bold flex items-center gap-1 self-start" style={{ color: "var(--accent-strong)" }}>
        Ver tudo <ArrowRight size={13} />
      </button>
    </div>
  );
}

// Sub-bloco de alerta dentro do painel de alertas
function BlocoAlerta({ titulo, icon: Icon, children, vazio, acao }) {
  const arr = Array.isArray(children) ? children.filter(Boolean) : (children ? [children] : []);
  return (
    <div>
      <button onClick={acao} className="w-full text-[11px] font-black uppercase tracking-widest mb-2 flex items-center gap-1.5" style={{ color: "var(--subtle)" }}>
        <Icon size={13} /> {titulo}
      </button>
      {arr.length === 0 ? (
        <p className="text-xs font-medium px-1" style={{ color: "var(--dim)" }}>{vazio}</p>
      ) : (
        <div className="space-y-2">{arr}</div>
      )}
    </div>
  );
}
