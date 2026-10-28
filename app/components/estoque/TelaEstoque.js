"use client";
// ESTOQUE EM UMA TELA (pedidos do dono, 27/10/2026: "ver todos os produtos,
// lançar e retirar com um toque, mínimo e máximo pelo ritmo" e "deixe uma
// coisa só, no estoque está cheio de páginas"). Todos os produtos de todos os
// locais; tocar no produto abre a movimentação (MovimentarEstoque fixo) por
// cima, sem sair da tela. Ritmo = REAL; sugestão = ESTIMATIVA; sem histórico
// suficiente = DADOS INSUFICIENTES. Regras em estoque-ritmo.mjs.

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDownToLine, ArrowUpFromLine, Check, Loader2, Plus, Search, Settings2, Sparkles, X } from "lucide-react";
import { useERP } from "../../context/ERPContext";
import { unidadeValida } from "../../lib/contas-pagar.mjs";
import MovimentarEstoque from "./MovimentarEstoque";
import { hasPermission } from "../../lib/permissions-catalog.mjs";
import { carregarVisaoEstoque, salvarMinMax } from "../../lib/estoque-visao";
import { PADRAO_RITMO } from "../../lib/estoque-ritmo.mjs";

const brl = (n) => Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmt = (n) => Number(n || 0).toLocaleString("pt-BR", { maximumFractionDigits: 2 });
// ml e g grandes ficam ilegíveis (7.304 ml): mostra também em L/kg.
const MAIOR = { ml: "L", g: "kg" };
const emMaior = (n, un) => { const u = MAIOR[String(un || "").toLowerCase()]; return u && Math.abs(n) >= 1000 ? ` (${fmt(n / 1000)} ${u})` : ""; };
const AREAS = [["todas", "Todas"], ["cozinha", "Cozinha"], ["bar", "Bar"], ["salao", "Salão"], ["limpeza", "Limpeza"], ["embalagens", "Embalagens"], ["marmitaria", "Marmitaria"], ["outros", "Outros"]];
// Bar em garrafas/latas (pedido do dono, 28/10/2026): a linha traz `contagem`
// { nome, fator }; o banco segue em ml/L e aqui só se divide para mostrar.
const pluralEmb = (nome, n) => (Math.abs(n) === 1 ? nome : `${nome}s`);
const qtd = (l, n) => (l.contagem ? fmt(n / l.contagem.fator) : fmt(n));
const un = (l, n) => (l.contagem ? pluralEmb(l.contagem.nome, n / l.contagem.fator) : l.unidade);
// "24 latas de 350 ml" (pedido do dono, 28/10/2026): o conteúdo de cada embalagem, não o total em ml.
const extra = (l, n) => (l.contagem ? ` de ${fmt(l.contagem.fator)} ${l.unidade}` : emMaior(n, l.unidade));
const qtdNum = (l, n) => (l.contagem ? Math.round((Number(n) / l.contagem.fator) * 100) / 100 : n);
const paraBanco = (l, v) => (l.contagem && v !== "" && v != null ? Math.round(Number(v) * l.contagem.fator * 1000) / 1000 : v);
const COR = { zerado: "#B42318", baixo: "#B45309", acima: "#1D4ED8", ok: "#047857", parado: "#6B7280" };
const ROTULO = { zerado: "Acabou", baixo: "Abaixo do mínimo", acima: "Acima do máximo", ok: "Em dia", parado: "Sem uso" };
const ORDEM = { zerado: 0, baixo: 1, acima: 2, ok: 3, parado: 4 };
const CHAVE_REGRAS = "hefisto:estoque:regras-minmax";

function lerRegras(u) {
  try { const r = JSON.parse(localStorage.getItem(`${CHAVE_REGRAS}:${u}`) || "null"); return r && typeof r === "object" ? r : {}; } catch { return {}; }
}

export default function TelaEstoque({ inicial = {} }) {
  const { unidadeAtiva, sessao } = useERP();
  // Mínimo e máximo: quem só lança (cozinha) vê, mas não muda.
  const podeVerCusto = !sessao?.gerenciado || hasPermission(sessao, "estoque.overview.view_costs") || hasPermission(sessao, "estoque.overview.view_values");
  const podeMinMax = !sessao?.gerenciado || hasPermission(sessao, "estoque.all_products.edit") || hasPermission(sessao, "estoque.overview.edit");
  // Movimentação aberta por cima: { estoque, insumo, tipo } (produto) ou { livre: true } (outro produto/local).
  const [mov, setMov] = useState(inicial.estoque && inicial.insumo ? { estoque: inicial.estoque, insumo: inicial.insumo, tipo: inicial.tipo || "" } : null);
  const [linhas, setLinhas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [busca, setBusca] = useState("");
  const [area, setArea] = useState(AREAS.some(([id]) => id === inicial.area) ? inicial.area : "todas");
  const [situacao, setSituacao] = useState("todas");
  const [regras, setRegras] = useState({});
  const [verRegras, setVerRegras] = useState(false);
  const [edicao, setEdicao] = useState({}); // id → { minimo, maximo }
  const [salvando, setSalvando] = useState("");
  const [aviso, setAviso] = useState("");

  useEffect(() => { if (unidadeValida(unidadeAtiva)) setRegras(lerRegras(unidadeAtiva)); }, [unidadeAtiva]);

  const carregar = useCallback(async () => {
    if (!unidadeValida(unidadeAtiva)) { setCarregando(false); return; }
    setCarregando(true);
    const r = await carregarVisaoEstoque(unidadeAtiva, { regras });
    setLinhas(r.linhas); setErro(r.erro || ""); setCarregando(false);
  }, [unidadeAtiva, regras]);
  useEffect(() => { carregar(); }, [carregar]);
  useEffect(() => {
    if (!mov) return;
    const esc = (e) => { if (e.key === "Escape") setMov(null); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [mov]);

  const mudarRegra = (k, v) => {
    const n = Math.max(0, Math.min(90, Math.round(Number(v) || 0)));
    const novo = { ...regras, [k]: n };
    setRegras(novo);
    try { localStorage.setItem(`${CHAVE_REGRAS}:${unidadeAtiva}`, JSON.stringify(novo)); } catch { /* segue */ }
  };
  const avisar = (t) => { setAviso(t); setTimeout(() => setAviso(""), 3500); };

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return linhas.filter((l) => {
      if (area !== "todas" && l.area !== area) return false;
      if (situacao === "sem_min" && l.minimo > 0) return false;
      if (situacao === "sugestao" && !(l.sugestao.ok && (l.sugestao.minimo !== l.minimo || l.sugestao.maximo !== l.maximo))) return false;
      if (["zerado", "baixo", "acima", "parado"].includes(situacao) && l.situacao !== situacao) return false;
      return !q || `${l.nome} ${l.categoria} ${l.local}`.toLowerCase().includes(q);
    }).sort((a, b) => ORDEM[a.situacao] - ORDEM[b.situacao] || a.nome.localeCompare(b.nome, "pt-BR"));
  }, [linhas, busca, area, situacao]);

  const resumo = useMemo(() => ({
    total: linhas.length,
    zerado: linhas.filter((l) => l.situacao === "zerado").length,
    baixo: linhas.filter((l) => l.situacao === "baixo").length,
    comSugestao: linhas.filter((l) => l.sugestao.ok && (l.sugestao.minimo !== l.minimo || l.sugestao.maximo !== l.maximo)).length,
  }), [linhas]);

  async function salvar(lista, rotulo) {
    setSalvando(rotulo);
    const { falhas } = await salvarMinMax(lista);
    setSalvando("");
    if (falhas.length) avisar(`${lista.length - falhas.length} salvo(s); ${falhas.length} com erro: ${falhas[0].erro}`);
    else avisar(lista.length > 1 ? `Mínimo e máximo salvos em ${lista.length} produtos.` : "Mínimo e máximo salvos.");
    setEdicao((e) => { const n = { ...e }; for (const a of lista) delete n[a.id]; return n; });
    carregar();
  }
  const aplicarTodas = () => {
    const lista = filtradas.filter((l) => l.sugestao.ok && (l.sugestao.minimo !== l.minimo || l.sugestao.maximo !== l.maximo)).map((l) => ({ id: l.id, minimo: l.sugestao.minimo, maximo: l.sugestao.maximo }));
    if (!lista.length) return;
    if (!confirm(`Usar o mínimo e o máximo sugeridos em ${lista.length} produto(s) da lista? Dá para mudar depois.`)) return;
    salvar(lista, "todas");
  };

  if (!unidadeValida(unidadeAtiva)) {
    return <p className="p-8 text-center font-bold text-hf-text-2">Selecione uma unidade para ver o estoque.</p>;
  }
  const r = { ...PADRAO_RITMO, ...regras };
  const campoRegra = (k, rotulo) => (
    <label className="flex flex-col gap-1 text-xs font-bold text-hf-text-2">
      {rotulo}
      <input type="number" min={0} max={90} value={r[k]} onChange={(e) => mudarRegra(k, e.target.value)} className="h-10 w-24 rounded-xl border border-hf-border bg-hf-surface px-3 text-base font-black text-hf-text" />
    </label>
  );

  return (
    <>
      <div className="mx-auto max-w-[1500px] space-y-4 px-3 py-4 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-hf-text-2">Toque no produto para retirar ou adicionar.</p>
          </div>
          <div className="flex flex-wrap gap-2">
          <button onClick={() => setMov({ livre: true })} className="inline-flex h-10 items-center gap-2 rounded-xl bg-hf-accent px-3 text-sm font-black text-white">
            <Plus size={16} /> Lançar outro produto
          </button>
          {podeMinMax && <button onClick={() => setVerRegras((v) => !v)} className="inline-flex h-10 items-center gap-2 rounded-xl border border-hf-border bg-hf-surface px-3 text-sm font-bold text-hf-text">
            <Settings2 size={16} /> Mínimo e máximo
          </button>}
          </div>
        </div>

        {verRegras ? (
          <div className="rounded-2xl border border-hf-border bg-hf-surface p-4">
            {/* Texto simples (pedido do dono, 28/10/2026: "isso não entendi nada"). */}
            <p className="text-base font-black text-hf-text">Como o sistema sugere o mínimo e o máximo</p>
            <p className="mt-1 text-sm font-semibold text-hf-text-2">Responda 3 perguntas. O sistema olha quanto você retira de cada produto e calcula sozinho.</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {campoRegra("prazoReposicaoDias", "Quantos dias o fornecedor leva para entregar?")}
              {campoRegra("segurancaDias", "Quantos dias a mais, por segurança?")}
              {campoRegra("intervaloCompraDias", "De quantos em quantos dias você compra?")}
            </div>
            <div className="mt-3 rounded-xl bg-hf-elevated p-3 text-sm font-semibold text-hf-text">
              <p><b>Exemplo:</b> sai 1 garrafa por dia.</p>
              <p className="mt-1">• <b>Mínimo: {r.prazoReposicaoDias + r.segurancaDias} garrafas</b> — o suficiente para esperar a entrega ({r.prazoReposicaoDias} dias) e mais {r.segurancaDias} de segurança. Chegou no mínimo, é hora de comprar.</p>
              <p className="mt-1">• <b>Máximo: {r.prazoReposicaoDias + r.segurancaDias + r.intervaloCompraDias} garrafas</b> — o mínimo mais o que sai até a próxima compra ({r.intervaloCompraDias} dias). Compre até chegar nele.</p>
            </div>
            <p className="mt-2 text-xs font-semibold text-hf-text-2">A conta usa as retiradas dos últimos {r.janelaDias} dias. Produto novo ou quase sem uso fica sem sugestão até ter histórico.</p>
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[["Produtos nos locais", resumo.total, "text-hf-text", "todas"], ["Acabou", resumo.zerado, resumo.zerado ? "text-[#B42318]" : "text-[#047857]", "zerado"], ["Abaixo do mínimo", resumo.baixo, resumo.baixo ? "text-[#B45309]" : "text-[#047857]", "baixo"], ["Com sugestão nova", resumo.comSugestao, "text-hf-text", "sugestao"]].map(([rot, v, cor, s]) => (
            <button key={rot} onClick={() => setSituacao(situacao === s ? "todas" : s)} className={`rounded-2xl border bg-hf-surface px-3 py-2.5 text-left ${situacao === s ? "border-hf-accent" : "border-hf-border"}`}>
              <p className={`text-2xl font-black leading-none ${cor}`}>{v}</p>
              <p className="mt-1 text-xs font-bold text-hf-text-2">{rot}</p>
            </button>
          ))}
        </div>

        <div className="space-y-2">
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-hf-text-2" />
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar produto, categoria ou local…" className="h-12 w-full rounded-2xl border border-zinc-300 bg-zinc-100 pl-10 pr-10 font-semibold text-hf-text placeholder:text-zinc-500 focus:bg-hf-surface" />
            {busca ? <button onClick={() => setBusca("")} aria-label="Limpar busca" className="absolute right-3 top-1/2 -translate-y-1/2"><X size={18} /></button> : null}
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
            {AREAS.map(([id, rot]) => <button key={id} onClick={() => setArea(id)} aria-pressed={area === id} className={`h-9 shrink-0 rounded-full border px-3 text-sm font-bold ${area === id ? "border-hf-accent bg-hf-accent text-white" : "border-hf-border bg-hf-surface text-hf-text"}`}>{rot}</button>)}
          </div>
          {/* Sem a fileira de situações (pedido do dono, 28/10/2026: "tira isso"); os quadros de cima filtram. */}
                    ) : <p className="mt-2 text-xs font-bold text-hf-text-2">DADOS INSUFICIENTES para sugerir: {s.motivo}</p>}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {mov ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={(e) => { if (e.target === e.currentTarget) setMov(null); }}>
          <div role="dialog" aria-modal="true" aria-label="Movimentar produto" className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-3xl bg-hf-bg pt-3 shadow-xl sm:rounded-3xl">
            <div className="flex items-center justify-between px-4 pb-1">
              <p className="text-sm font-black text-hf-text">{mov.livre ? "Lançar outro produto" : "Retirar ou adicionar"}</p>
              <button type="button" onClick={() => setMov(null)} aria-label="Fechar" className="grid h-10 w-10 place-items-center rounded-full text-hf-text-2 hover:bg-hf-elevated"><X size={20} /></button>
            </div>
            <MovimentarEstoque key={JSON.stringify(mov)} unidade={unidadeAtiva} sessao={sessao} fixo={!mov.livre}
              inicial={mov.livre ? { area: area === "todas" ? "" : area } : { estoque: mov.estoque, insumo: mov.insumo, tipo: mov.tipo }}
              onFeito={() => carregar()} />
          </div>
        </div>
      ) : null}
    </>
  );
}
