"use client";

import { useState, useEffect, useMemo } from "react";
import { useERP } from "../context/ERPContext";
import {
  Percent, Users, Wallet, ShoppingCart, PackageX, CalendarClock,
  Sparkles, Wind, AlertCircle, Clock, Megaphone, ChefHat, ArrowRight, CheckCircle2,
  GripVertical, UserPlus, CalendarDays, ArrowRightLeft, X
} from "lucide-react";
import { useRouter } from "next/navigation";
import { fmtBRL, fmtPct } from "../components/ui";

import { fetchFichas } from "../lib/operacao";
import { fetchProdutos } from "../lib/vendas";
import { fetchColaboradores, fetchAllFolgasDaUnidade, fetchBancoHoras, atualizarEscalaColab, atualizarOrdemEscala, salvarEscalaDia, fetchEscalasDia, BANCO_LIMITE_MIN, BANCO_ALERTA_MIN } from "../lib/rh";
import { fetchContas } from "../lib/financeiro";
import { fetchEstoque } from "../lib/estoque";
import { fetchManutencoes } from "../lib/controles_cozinha";
import { fetchCampanhas } from "../lib/clientes";
import { fetchTemplates, fetchHistoricoExecucoes } from "../lib/checklists";
import { fetchParams, PARAMS_PADRAO } from "../lib/parametros";
import { useTempoReal } from "../lib/realtime";

// Meta de CMV: ajustável em Configurações > Parâmetros (metaCmv)

// Áreas da escala e como deduzir a área pelo cargo.
// "Folga" só recebe gente por arraste (quem está de folga/descanso no dia).
const AREAS_ESCALA = ["Salão", "Bar", "Cozinha", "Caixa", "Louça", "Folga", "Outros"];
function areaDoCargo(cargo) {
  const c = (cargo || "").toLowerCase();
  if (/(caixa|financ|tesour|recep)/.test(c)) return "Caixa";
  if (/(lou[çc]a|copa|steward|lavagem|higieniz)/.test(c)) return "Louça";
  if (/(cozinh|chapeir|confeit|pizzai|sushi|salgad|padeir|churrasqueir|a[cç]ougue|chefe de fila)/.test(c)) return "Cozinha";
  if (/(\bbar\b|barman|bartender|barista|copeir)/.test(c)) return "Bar";
  if (/(gar[çc]|atendente|sal[aã]o|hostess|maitre|maître|comand|gerente|supervisor)/.test(c)) return "Salão";
  return "Outros";
}
const ehExtra = (c) => /(freela|extra|diarist|volante|tempor)/i.test(c?.tipo_contrato || "");
// getDay(): 0=Dom … 6=Sáb
const DIAS_SEMANA = [["0", "Dom"], ["1", "Seg"], ["2", "Ter"], ["3", "Qua"], ["4", "Qui"], ["5", "Sex"], ["6", "Sáb"]];

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
  const [versaoDados, setVersaoDados] = useState(0);
  // Tempo real: qualquer lançamento no sistema atualiza o painel sozinho
  useTempoReal(null, () => setVersaoDados(v => v + 1));
  const [metaCmv, setMetaCmv] = useState(PARAMS_PADRAO.meta_cmv);
  useEffect(() => { if (unidadeAtiva && unidadeAtiva !== "todas") fetchParams(unidadeAtiva).then(r => setMetaCmv(r.data.meta_cmv)); }, [unidadeAtiva]);

  useEffect(() => {
    if (!unidadeAtiva || unidadeAtiva === "todas") { setLoading(false); setDados(null); return; }
    let vivo = true;
    (async () => {
      if (!dados) setLoading(true); // recargas do tempo real são silenciosas
      const hojeISO = new Date().toISOString().split("T")[0];
      const [rF, rP, rColab, rFolgas, rContas, rEstoque, rManut, rCamp, rBanco, rTpl, rExec] = await Promise.all([
        fetchFichas(unidadeAtiva), fetchProdutos(unidadeAtiva), fetchColaboradores(unidadeAtiva),
        fetchAllFolgasDaUnidade(unidadeAtiva), fetchContas(unidadeAtiva, ""), fetchEstoque(unidadeAtiva),
        fetchManutencoes(unidadeAtiva), fetchCampanhas(unidadeAtiva),
        fetchBancoHoras(unidadeAtiva, new Date().toISOString().slice(0, 7)),
        fetchTemplates(unidadeAtiva), fetchHistoricoExecucoes(unidadeAtiva, hojeISO),
      ]);
      if (!vivo) return;
      setDados({
        fichas: rF.data || [], produtos: rP.data || [], colaboradores: rColab.data || [],
        folgas: rFolgas.data || [], contas: rContas.data || [], estoque: rEstoque.data || [],
        manutencoes: rManut.data || [], campanhas: rCamp.fromSeed ? [] : (rCamp.data || []),
        bancoHoras: rBanco.data || [],
        checklistTpls: rTpl.data || [], checklistExecs: rExec.data || [],
      });
      setLoading(false);
    })();
    return () => { vivo = false; };
  }, [unidadeAtiva, versaoDados]);

  const m = useMemo(() => {
    if (!dados) return null;
    const { fichas, produtos, colaboradores, folgas, contas, estoque, manutencoes, campanhas, bancoHoras = [] } = dados;

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
    const cmvAcima = cmvs.filter(v => v > metaCmv).length;

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

    // Banco de horas: quem está perto de estourar as 8h do mês (>= 6h)
    const somaBanco = {};
    bancoHoras.filter(b => b.tipo !== "excesso").forEach(b => { somaBanco[b.colaborador_id] = (somaBanco[b.colaborador_id] || 0) + (Number(b.minutos) || 0); });
    const bancoAlertas = Object.entries(somaBanco)
      .filter(([, min]) => min >= BANCO_ALERTA_MIN)
      .map(([id, min]) => ({ id, min, nome: colaboradores.find(c => c.id === id)?.nome || "Colaborador", estourou: min >= BANCO_LIMITE_MIN }))
      .sort((a, b) => b.min - a.min);

    // Escala da semana por área (extras entram junto, marcados).
    // Área = a atribuída manualmente (area_escala) ou deduzida do cargo.
    const comArea = ativos.map(c => ({ ...c, _area: c.area_escala || areaDoCargo(c.cargo), _extra: ehExtra(c) }));
    const escalaPorArea = {};
    AREAS_ESCALA.forEach(a => {
      escalaPorArea[a] = comArea.filter(c => c._area === a)
        .sort((x, y) => ((x.ordem_escala ?? 1e9) - (y.ordem_escala ?? 1e9)) || String(x.nome).localeCompare(String(y.nome), "pt-BR"));
    });
    const extrasCount = comArea.filter(c => c._extra).length;

    // Checklists de hoje por área: pendências (feitos < total)
    const { checklistTpls = [], checklistExecs = [] } = dados;
    const checklistsPend = ["cozinha", "bar", "salao"].map(d => {
      const tpls = checklistTpls.filter(t => t.departamento === d);
      if (!tpls.length) return null;
      const feitos = new Set(checklistExecs.filter(e => e.checklists_templates?.departamento === d).map(e => e.template_id)).size;
      return feitos < tpls.length ? { dept: d, feitos: Math.min(feitos, tpls.length), total: tpls.length } : null;
    }).filter(Boolean);

    return {
      cmvMedio, cmvAcima, cmvCount: cmvs.length,
      folhaMes, ativosCount: ativos.length,
      equipeHoje, totalContasMes, contasVencendo,
      semEstoque, limpezasVencendo, campanhasAtivas, bancoAlertas,
      escalaPorArea, extrasCount, checklistsPend,
    };
  }, [dados, metaCmv]);

  // Arrastar na escala: move o colaborador para uma área (mesma ou outra) na
  // posição do alvo. Grava a área e a nova ordem de todos da área.
  const [dragEscalaId, setDragEscalaId] = useState(null);
  // Extras pontuais do dia (não cadastrados): guardados neste aparelho, por dia.
  const chaveExtrasDia = () => `escala_extras_${unidadeAtiva}_${new Date().toISOString().slice(0, 10)}`;
  const [extrasDia, setExtrasDia] = useState([]);
  useEffect(() => {
    try { setExtrasDia(JSON.parse(localStorage.getItem(chaveExtrasDia()) || "[]")); } catch { setExtrasDia([]); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unidadeAtiva]);
  const persistirExtras = (lista) => { setExtrasDia(lista); try { localStorage.setItem(chaveExtrasDia(), JSON.stringify(lista)); } catch (_) {} };
  const adicionarExtraDia = (nome, area) => {
    if (!nome || !nome.trim()) return;
    persistirExtras([...extrasDia, { id: "extra_" + Date.now(), nome: nome.trim(), cargo: "Extra do dia", _area: area || "Salão", _extra: true, _temp: true, dias_trabalho: "" }]);
  };
  const removerExtraDia = (id) => persistirExtras(extrasDia.filter(e => e.id !== id));

  // Escala (áreas) já com os extras pontuais do dia mesclados
  const escalaComExtras = useMemo(() => {
    const base = m?.escalaPorArea || {};
    const clone = {}; Object.keys(base).forEach(a => { clone[a] = [...base[a]]; });
    extrasDia.forEach(e => { const a = e._area || "Outros"; (clone[a] = clone[a] || []).push(e); });
    return clone;
  }, [m, extrasDia]);

  const moverParaArea = async (area, colabId, alvoId) => {
    // Extra pontual do dia: só muda de área (não vai ao banco).
    if (String(colabId || "").startsWith("extra_")) {
      persistirExtras(extrasDia.map(e => e.id === colabId ? { ...e, _area: area } : e));
      setDragEscalaId(null);
      return;
    }
    if (!colabId || !m?.escalaPorArea) return;
    const atual = (m.escalaPorArea[area] || []).filter(c => c.id !== colabId);
    const ids = atual.map(c => c.id);
    let pos = alvoId ? ids.indexOf(alvoId) : ids.length;
    if (pos < 0) pos = ids.length;
    ids.splice(pos, 0, colabId);
    const ordemMap = {}; ids.forEach((id, i) => { ordemMap[id] = i; });
    setDados(d => ({
      ...d,
      colaboradores: d.colaboradores.map(c => {
        if (c.id === colabId) return { ...c, area_escala: area, ordem_escala: ordemMap[c.id] };
        if (ordemMap[c.id] !== undefined) return { ...c, ordem_escala: ordemMap[c.id] };
        return c;
      }),
    }));
    setDragEscalaId(null);
    await atualizarEscalaColab(colabId, { area_escala: area, ordem_escala: ordemMap[colabId] });
    for (const id of ids) if (id !== colabId) await atualizarOrdemEscala(id, ordemMap[id]);
  };

  // ── Escala do dia: montar, salvar, compartilhar e imprimir ────────────────
  const montarEscalaDia = () => {
    const out = [];
    AREAS_ESCALA.forEach(a => {
      const lista = escalaComExtras?.[a] || [];
      if (!lista.length) return;
      out.push({
        area: a,
        pessoas: lista.map(c => ({
          nome: c.nome,
          cargo: c.cargo || "",
          extra: !!c._extra,
          horario: (c.horario_entrada || c.horario_saida) ? `${c.horario_entrada || "?"}–${c.horario_saida || "?"}` : "",
        })),
      });
    });
    return out;
  };

  const salvarDia = async () => {
    const escala = montarEscalaDia();
    if (!escala.length) return alert("Nenhum colaborador na escala.");
    const hoje = new Date().toISOString().split("T")[0];
    const { error, atualizada } = await salvarEscalaDia(unidadeAtiva, hoje, escala);
    if (error) return alert("Erro ao salvar a escala: " + error);
    alert(atualizada ? "Escala de hoje atualizada!" : "Escala de hoje salva!");
  };

  const textoEscalaDia = () => {
    const hoje = new Date();
    const linhas = montarEscalaDia().map(g =>
      `*${g.area.toUpperCase()}*\n` + g.pessoas.map(p =>
        `- ${p.nome}${p.extra ? " (extra)" : ""}${p.horario ? ` — ${p.horario}` : ""}`
      ).join("\n")
    );
    return `*Escala do dia* — ${unidadeInfo?.nome || ""}\n${hoje.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit" })}\n\n${linhas.join("\n\n")}`;
  };

  const compartilharDia = async () => {
    const texto = textoEscalaDia();
    if (typeof navigator !== "undefined" && navigator.share) {
      try { await navigator.share({ text: texto }); return; } catch (e) { if (e && e.name === "AbortError") return; }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, "_blank");
  };

  const imprimirDia = () => imprimirEscala(montarEscalaDia(), new Date());

  // Histórico de escalas salvas (rever/reimprimir dias passados)
  const [modalEscalas, setModalEscalas] = useState(null);
  const abrirHistoricoEscalas = async () => {
    setModalEscalas([]);
    const { data } = await fetchEscalasDia(unidadeAtiva);
    setModalEscalas(data || []);
  };

  // Imprime uma escala (de hoje ou uma salva do histórico)
  const imprimirEscala = (escala, dataRef) => {
    if (!escala || !escala.length) return alert("Nenhum colaborador na escala.");
    const hoje = dataRef || new Date();
    const blocos = escala.map(g => `
      <tr class="cat"><td colspan="3">${g.area}</td></tr>
      ${g.pessoas.map(p => `<tr><td><b>${p.nome}</b>${p.extra ? ' <span class="ext">EXTRA</span>' : ""}</td><td>${p.cargo}</td><td class="c">${p.horario || "—"}</td></tr>`).join("")}
    `).join("");
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Escala do dia</title>
      <style>
        *{margin:0;padding:0;box-sizing:border-box}
        body{font-family:Arial,Helvetica,sans-serif;color:#111;padding:10mm}
        .head{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:3px solid #111;padding-bottom:8px;margin-bottom:10px}
        h1{font-size:22px}
        .tag{font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#555;font-weight:bold}
        .meta{font-size:12px;color:#555;font-weight:bold;text-transform:capitalize}
        table{width:100%;border-collapse:collapse;font-size:13px}
        th,td{border:1px solid #94a3b8;padding:6px 8px;text-align:left}
        th{background:#e2e8f0;font-size:9px;text-transform:uppercase;letter-spacing:1px}
        tr.cat td{background:#f1f5f9;font-weight:bold;text-transform:uppercase;letter-spacing:1px;font-size:11px;color:#334155}
        td.c{text-align:center;font-weight:bold;width:28mm}
        .ext{font-size:8px;font-weight:bold;background:#fef3c7;border:1px solid #f59e0b;color:#92400e;border-radius:3px;padding:1px 4px}
        @media print{@page{margin:8mm}}
      </style></head><body>
      <div class="head">
        <div><div class="tag">Escala do Dia</div><h1>${unidadeInfo?.nome || "Unidade"}</h1></div>
        <div class="meta">${hoje.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}</div>
      </div>
      <table>
        <thead><tr><th>Colaborador</th><th>Função</th><th>Horário</th></tr></thead>
        <tbody>${blocos}</tbody>
      </table>
      </body></html>`;
    const win = window.open("", "_blank", "width=860,height=1000");
    if (win) { win.document.write(html); win.document.close(); setTimeout(() => win.print(), 400); }
    else alert("Habilite os popups para imprimir.");
  };

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

  const cmvBom = m.cmvMedio <= metaCmv;

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
        <Kpi icon={Percent} label="CMV médio"
          value={m.cmvCount ? fmtPct(m.cmvMedio) : "—"}
          sub={m.cmvCount ? (cmvBom ? `dentro da meta de ${metaCmv}%` : `${m.cmvAcima} prato(s) acima da meta`) : "sem fichas precificadas"}
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

        <Kpi icon={UserPlus} label="Extras contratados"
          value={m.extrasCount} sub="freelancers / diaristas ativos"
          tintBg="rgba(245,158,11,0.12)" tintFg="#B45309"
          onClick={() => router.push("/dashboard/rh")} />
      </div>

      {/* Escala da semana — por área, com extras e ordenação por arraste */}
      <EscalaSemana
        escalaPorArea={escalaComExtras}
        dragId={dragEscalaId}
        setDragId={setDragEscalaId}
        onMover={moverParaArea}
        onAddExtra={adicionarExtraDia}
        onRemoveExtra={removerExtraDia}
        onVerTudo={() => router.push("/dashboard/rh")}
        onSalvarDia={salvarDia}
        onWhats={compartilharDia}
        onImprimir={imprimirDia}
        onHistorico={abrirHistoricoEscalas}
      />

      {/* Histórico de escalas salvas */}
      {modalEscalas !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4" onClick={() => setModalEscalas(null)}>
          <div className="erp-card w-full max-w-md max-h-[80vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-black flex items-center gap-2" style={{ color: "var(--fg)" }}>
                <CalendarDays size={18} style={{ color: "#7C3AED" }} /> Escalas salvas
              </h3>
              <button onClick={() => setModalEscalas(null)} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "var(--elevated)", color: "var(--muted)" }}>×</button>
            </div>
            {modalEscalas.length === 0 ? (
              <p className="text-sm font-medium py-6 text-center" style={{ color: "var(--dim)" }}>Nenhuma escala salva ainda — use "Salvar escala do dia".</p>
            ) : (
              <div className="space-y-2">
                {modalEscalas.map(e => {
                  const dt = new Date(String(e.data).slice(0, 10) + "T12:00:00");
                  const total = (e.escala || []).reduce((s, g) => s + (g.pessoas?.length || 0), 0);
                  return (
                    <div key={e.id} className="flex items-center justify-between gap-2 p-3 rounded-xl" style={{ background: "var(--elevated)" }}>
                      <div>
                        <p className="text-sm font-bold capitalize" style={{ color: "var(--fg-soft)" }}>{dt.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit" })}</p>
                        <p className="text-[10px] font-medium" style={{ color: "var(--dim)" }}>{total} pessoa(s) · {(e.escala || []).length} área(s)</p>
                      </div>
                      <button onClick={() => imprimirEscala(e.escala, dt)} className="text-xs font-bold px-3 py-2 rounded-lg" style={{ background: "var(--accent-soft)", color: "var(--accent-strong)" }}>Imprimir</button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Painéis operacionais */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

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

            <BlocoAlerta titulo="Checklists de hoje" icon={CheckCircle2}
              vazio="Todos os checklists de hoje foram feitos." acao={() => router.push("/dashboard/operacao/rotina")}>
              {m.checklistsPend.map(c => {
                const nome = c.dept === "salao" ? "Salão" : c.dept === "bar" ? "Bar" : "Cozinha";
                return (
                  <div key={c.dept} className="flex justify-between items-center p-2.5 rounded-xl" style={{ background: "rgba(245,158,11,0.10)" }}>
                    <span className="text-sm font-bold" style={{ color: "var(--fg-soft)" }}>{nome}</span>
                    <span className="text-[11px] font-black shrink-0 ml-2" style={{ color: "#B45309" }}>{c.feitos}/{c.total} — faltam {c.total - c.feitos}</span>
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

            <BlocoAlerta titulo="Banco de horas (limite 8h/mês)" icon={Clock}
              vazio="Ninguém perto do limite." acao={() => router.push("/dashboard/rh")}>
              {m.bancoAlertas.slice(0, 3).map(b => (
                <div key={b.id} className="flex justify-between items-center p-2.5 rounded-xl" style={{ background: b.estourou ? "rgba(239,68,68,0.08)" : "rgba(245,158,11,0.10)" }}>
                  <span className="text-sm font-bold truncate" style={{ color: "var(--fg-soft)" }}>{b.nome}</span>
                  <span className="text-[11px] font-black shrink-0 ml-2" style={{ color: b.estourou ? "#DC2626" : "#B45309" }}>
                    {Math.floor(b.min / 60)}h{String(b.min % 60).padStart(2, "0")}{b.estourou ? " — estourou!" : " / 8h"}
                  </span>
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

// Cores por área da escala
const CORES_AREA = {
  "Salão": "#0EA5E9", "Bar": "#8B5CF6", "Cozinha": "#F59E0B",
  "Caixa": "#10B981", "Louça": "#64748B", "Folga": "#F43F5E", "Outros": "#94A3B8",
};

// Escala da semana: colaboradores agrupados por área, extras marcados,
// arraste para reordenar cada um dentro da sua área.
function EscalaSemana({ escalaPorArea, dragId, setDragId, onMover, onAddExtra, onRemoveExtra, onVerTudo, onSalvarDia, onWhats, onImprimir, onHistorico }) {
  const [aberto, setAberto] = useState(true); // recolhe a escala para o painel respirar
  // Áreas fixas sempre visíveis (mesmo vazias) + "Outros" só quando tiver gente
  const areas = ["Salão", "Bar", "Cozinha", "Caixa", "Louça", "Folga"];
  if (escalaPorArea["Outros"]?.length) areas.push("Outros");
  // Celular/tablet: sem arrastar. Toca em "Mover" e escolhe a área de destino.
  const [mover, setMover] = useState(null); // { id, area } do colaborador sendo movido
  const [addAberto, setAddAberto] = useState(false);
  const [novoNome, setNovoNome] = useState("");
  const [novaArea, setNovaArea] = useState("Salão");
  const confirmarExtra = () => { if (novoNome.trim()) { onAddExtra?.(novoNome, novaArea); setNovoNome(""); setAddAberto(false); } };
  return (
    <div className="erp-card p-3 sm:p-6">
      <div className="flex items-center justify-between gap-2 flex-wrap mb-4 sm:mb-5">
        <h3 className="text-base sm:text-lg font-black flex items-center gap-2" style={{ color: "var(--fg)" }}>
          <CalendarDays size={20} style={{ color: "#7C3AED" }} /> <button onClick={() => setAberto(v => !v)} className="flex items-center gap-1">Escala da Semana <span className="text-xs font-bold" style={{ color: "var(--muted)" }}>{aberto ? "▲" : "▼ mostrar"}</span></button>
        </h3>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => setAddAberto(v => !v)} className="text-xs font-black px-3 py-2 rounded-lg transition-colors" style={{ background: "#7C3AED", color: "#fff" }}>
            + Extra do dia
          </button>
          <button onClick={onSalvarDia} className="text-xs font-bold px-3 py-2 rounded-lg transition-colors" style={{ background: "var(--accent-soft)", color: "var(--accent-strong)" }}>
            Salvar escala do dia
          </button>
          <button onClick={onWhats} className="text-xs font-black px-3 py-2 rounded-lg text-white transition-colors" style={{ background: "#25D366" }}>
            WhatsApp
          </button>
          <button onClick={onImprimir} className="text-xs font-bold px-3 py-2 rounded-lg transition-colors" style={{ background: "var(--elevated)", color: "var(--muted)" }}>
            Imprimir
          </button>
          <button onClick={onHistorico} className="text-xs font-bold px-3 py-2 rounded-lg transition-colors" style={{ background: "var(--elevated)", color: "var(--muted)" }}>
            Histórico
          </button>
          <button onClick={onVerTudo} className="text-xs font-bold flex items-center gap-1 px-1" style={{ color: "var(--accent-strong)" }}>
            Gerir no RH <ArrowRight size={13} />
          </button>
        </div>
      </div>

      {/* Adicionar um extra pontual (só para hoje, sem cadastrar) */}
      {addAberto && (
        <div className="flex flex-wrap items-center gap-2 mb-4 p-3 rounded-2xl" style={{ background: "var(--elevated)" }}>
          <input value={novoNome} onChange={e => setNovoNome(e.target.value)} onKeyDown={e => { if (e.key === "Enter") confirmarExtra(); }} placeholder="Nome do extra de hoje"
            className="flex-1 min-w-[140px] px-3 py-2 rounded-lg text-sm font-bold outline-none" style={{ background: "var(--card)", color: "var(--fg)", border: "1px solid var(--line)" }} autoFocus />
          <select value={novaArea} onChange={e => setNovaArea(e.target.value)} className="px-3 py-2 rounded-lg text-sm font-bold outline-none" style={{ background: "var(--card)", color: "var(--fg)", border: "1px solid var(--line)" }}>
            {["Salão", "Bar", "Cozinha", "Caixa", "Louça", "Folga"].map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <button onClick={confirmarExtra} className="px-4 py-2 rounded-lg text-sm font-black text-white" style={{ background: "#7C3AED" }}>Adicionar</button>
          <button onClick={() => setAddAberto(false)} className="px-3 py-2 rounded-lg text-sm font-bold" style={{ color: "var(--muted)" }}>Cancelar</button>
        </div>
      )}

      {aberto && (<>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {areas.map(area => {
          const cor = CORES_AREA[area] || "#94A3B8";
          const lista = escalaPorArea[area] || [];
          return (
            <div key={area}
              onDragOver={e => { if (dragId) e.preventDefault(); }}
              onDrop={() => onMover(area, dragId, null)}
              className="rounded-2xl border p-3 transition-colors"
              style={{ borderColor: dragId ? cor + "66" : "var(--line)", background: dragId ? cor + "08" : "transparent" }}>
              <div className="flex items-center gap-2 mb-2.5 px-1">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: cor }} />
                <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: "var(--fg-soft)" }}>{area}</span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: "var(--elevated)", color: "var(--muted)" }}>{lista.length}</span>
              </div>
              <div className="space-y-1.5 min-h-[44px]">
                {lista.length === 0 ? (
                  <div className="flex items-center justify-center h-11 rounded-xl border border-dashed text-[11px] font-bold" style={{ borderColor: "var(--line)", color: "var(--dim)" }}>
                    {area === "Folga" ? "Quem está de folga hoje" : "Arraste alguém para cá"}
                  </div>
                ) : lista.map(c => (
                  <div key={c.id} className="relative">
                  <div
                    draggable onDragStart={() => setDragId(c.id)} onDragEnd={() => setDragId(null)}
                    onDragOver={e => { if (dragId) e.preventDefault(); }}
                    onDrop={e => { e.stopPropagation(); onMover(area, dragId, c.id); }}
                    className={`flex items-center gap-2 p-2 rounded-xl ${dragId === c.id ? "opacity-50" : ""}`}
                    style={{ background: "var(--elevated)" }}>
                    <GripVertical size={14} className="cursor-grab active:cursor-grabbing shrink-0 hidden sm:block" style={{ color: "var(--dim)" }} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold truncate flex items-center gap-1.5" style={{ color: "var(--fg-soft)" }}>
                        {c.nome}
                        {c._extra && <span className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded" style={{ background: "rgba(245,158,11,0.15)", color: "#B45309" }}>Extra</span>}
                      </p>
                      <p className="text-[10px] font-medium truncate" style={{ color: "var(--dim)" }}>
                        {c.cargo || "—"}
                        <span className="sm:hidden">{(c.horario_entrada || c.horario_saida) ? ` · ${c.horario_entrada || "?"}–${c.horario_saida || "?"}` : ""}</span>
                      </p>
                    </div>
                    {/* Dias da semana: só no desktop (no celular ocupam o nome) */}
                    <div className="gap-0.5 shrink-0 hidden sm:flex">
                      {DIAS_SEMANA.map(([d, lbl]) => {
                        const on = String(c.dias_trabalho || "").split(",").map(s => s.trim()).includes(d);
                        return (
                          <span key={d} title={lbl} className="w-5 h-5 rounded flex items-center justify-center text-[9px] font-black"
                            style={{ background: on ? cor + "22" : "transparent", color: on ? cor : "var(--faint)", border: on ? `1px solid ${cor}55` : "1px solid var(--line)" }}>
                            {lbl[0]}
                          </span>
                        );
                      })}
                    </div>
                    <span className="text-[10px] font-bold shrink-0 text-right w-[86px] hidden sm:block" style={{ color: "var(--muted)" }}>
                      {(c.horario_entrada || c.horario_saida) ? `${c.horario_entrada || "?"}–${c.horario_saida || "?"}` : "—"}
                    </span>
                    {/* Mover (funciona no toque): abre a escolha da área de destino */}
                    <button type="button" onClick={() => setMover(mover?.id === c.id ? null : { id: c.id, area })}
                      title="Mover para outra área"
                      className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg"
                      style={{ background: "var(--card)", color: mover?.id === c.id ? cor : "var(--muted)", border: "1px solid var(--line)" }}>
                      <ArrowRightLeft size={14} />
                    </button>
                    {/* Extra pontual do dia: pode remover */}
                    {c._temp && (
                      <button type="button" onClick={() => onRemoveExtra?.(c.id)} title="Remover extra do dia"
                        className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg"
                        style={{ background: "var(--card)", color: "#DC2626", border: "1px solid var(--line)" }}>
                        <X size={14} />
                      </button>
                    )}
                  </div>
                  {mover?.id === c.id && (
                    <div className="mt-1 p-2 rounded-xl border flex flex-wrap gap-1.5 relative z-10" style={{ borderColor: cor + "55", background: "var(--card)" }}>
                      <span className="w-full text-[10px] font-black uppercase tracking-widest mb-0.5" style={{ color: "var(--dim)" }}>Mover para:</span>
                      {areas.filter(a => a !== area).map(a => (
                        <button key={a} type="button"
                          onClick={() => { onMover(a, c.id, null); setMover(null); }}
                          className="text-[11px] font-bold px-2.5 py-1.5 rounded-lg"
                          style={{ background: (CORES_AREA[a] || "#94A3B8") + "18", color: CORES_AREA[a] || "#64748b", border: `1px solid ${(CORES_AREA[a] || "#94A3B8")}44` }}>
                          {a}
                        </button>
                      ))}
                    </div>
                  )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-[10px] font-medium mt-4" style={{ color: "var(--dim)" }}>
        No computador, arraste uma pessoa para outra área. No celular/tablet, toque no botão <ArrowRightLeft size={11} className="inline align-[-1px]" /> e escolha a área. Letras = dias da semana (Dom → Sáb).
      </p>
      </>)}
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
