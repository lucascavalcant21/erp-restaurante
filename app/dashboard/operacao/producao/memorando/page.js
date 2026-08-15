"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, ChefHat, ClipboardList, GlassWater, Plus, Printer, Save, Share2, ShoppingCart, Trash2 } from "lucide-react";
import { useERP } from "../../../../context/ERPContext";
import { fetchFichas } from "../../../../lib/operacao";
import { fetchColaboradores } from "../../../../lib/rh";
import { calcularConsumoProducao, fetchEstoque } from "../../../../lib/estoque";
import { fetchMemorandoOperacao, salvarMemorandoOperacao } from "../../../../lib/memorandos";
import { registrarAuditoria } from "../../../../lib/hefisto-acoes";
import { imprimirHtml } from "../../../../lib/imprimir";

const numero = valor => Number(String(valor ?? "").replace(",", ".")) || 0;
const escapar = valor => String(valor ?? "").replace(/[&<>"']/g, caractere => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[caractere]));
const dataAmanha = () => {
  const data = new Date();
  data.setDate(data.getDate() + 1);
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(data.getDate()).padStart(2, "0")}`;
};
const chaveLocal = (unidadeId, data) => `hefisto_memorando_${unidadeId || "sem-unidade"}_${data}`;

function lerLocal(unidadeId, data) {
  try { return JSON.parse(localStorage.getItem(chaveLocal(unidadeId, data)) || "null"); } catch { return null; }
}

function gravarLocal(unidadeId, data, memorando) {
  try { localStorage.setItem(chaveLocal(unidadeId, data), JSON.stringify(memorando)); } catch {}
}

function SetorPlanejamento({ titulo, icone: Icone, cor, fichas, plano, colaboradores, alterar }) {
  return <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
    <header className={`flex items-center gap-3 px-5 py-4 text-white ${cor}`}>
      <Icone size={24}/><div><h2 className="text-xl font-black">{titulo}</h2><p className="text-xs font-semibold text-white/80">Quantidades para produzir no dia seguinte</p></div>
    </header>
    <div className="space-y-2 p-3 sm:p-5">
      {fichas.length === 0 ? <p className="p-5 text-center text-sm font-bold text-slate-400">Nenhuma ficha cadastrada neste setor.</p> : fichas.map(ficha => {
        const item = plano[ficha.id] || {};
        const ativo = numero(item.qtd) > 0;
        return <article key={ficha.id} className={`rounded-2xl border p-3 transition ${ativo ? "border-emerald-300 bg-emerald-50/40" : "border-slate-200 bg-slate-50/50"}`}>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <strong className="min-w-0 flex-1 text-sm text-slate-800">{ficha.nome_receita}</strong>
            <div className="flex items-center gap-2">
              <input type="number" min="0" step="0.01" inputMode="decimal" value={item.qtd || ""} onChange={e => alterar(ficha.id, { qtd: e.target.value })} placeholder="0" className="h-10 w-24 rounded-xl border border-slate-200 bg-white px-3 text-center font-black outline-none focus:border-emerald-500"/>
              <span className="text-[10px] font-black uppercase text-slate-400">porções</span>
            </div>
          </div>
          {ativo && <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <select value={item.responsavel || ""} onChange={e => alterar(ficha.id, { responsavel: e.target.value })} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600 outline-none">
              <option value="">Responsável a definir</option>
              {colaboradores.map(pessoa => <option key={pessoa.id} value={pessoa.nome}>{pessoa.nome}</option>)}
            </select>
            <input value={item.observacao || ""} onChange={e => alterar(ficha.id, { observacao: e.target.value })} placeholder="Observação: prioridade, armazenamento..." className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold outline-none"/>
          </div>}
        </article>;
      })}
    </div>
  </section>;
}

export default function MemorandoProducaoPage() {
  const router = useRouter();
  const { unidadeAtiva, unidadeInfo, sessao } = useERP();
  const [dataReferencia, setDataReferencia] = useState(dataAmanha);
  const [fichasCozinha, setFichasCozinha] = useState([]);
  const [fichasBar, setFichasBar] = useState([]);
  const [colaboradores, setColaboradores] = useState([]);
  const [estoque, setEstoque] = useState([]);
  const [cozinha, setCozinha] = useState({});
  const [bar, setBar] = useState({});
  const [comprasManuais, setComprasManuais] = useState([]);
  const [novaCompra, setNovaCompra] = useState({ nome: "", quantidade: "", unidade: "UN", observacao: "" });
  const [observacoes, setObservacoes] = useState("");
  const [status, setStatus] = useState("rascunho");
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState("");

  const todasFichas = useMemo(() => [...fichasCozinha, ...fichasBar], [fichasCozinha, fichasBar]);

  const carregarBase = useCallback(async () => {
    if (!unidadeAtiva || unidadeAtiva === "todas") return setLoading(false);
    setLoading(true);
    const [coz, br, equipe, saldo] = await Promise.all([
      fetchFichas(unidadeAtiva, "cozinha"),
      fetchFichas(unidadeAtiva, "bar"),
      fetchColaboradores(unidadeAtiva),
      fetchEstoque(unidadeAtiva),
    ]);
    setFichasCozinha(coz.data || []);
    setFichasBar(br.data || []);
    setColaboradores((equipe.data || []).filter(pessoa => pessoa.ativo !== false && pessoa.status !== "inativo"));
    setEstoque(saldo.data || []);
    setLoading(false);
  }, [unidadeAtiva]);

  useEffect(() => { carregarBase(); }, [carregarBase]);

  useEffect(() => {
    if (!unidadeAtiva || unidadeAtiva === "todas" || !dataReferencia) return;
    let ativo = true;
    (async () => {
      const remoto = await fetchMemorandoOperacao(unidadeAtiva, dataReferencia);
      if (!ativo) return;
      const salvo = remoto.data || lerLocal(unidadeAtiva, dataReferencia);
      setCozinha(salvo?.cozinha || {});
      setBar(salvo?.bar || {});
      setComprasManuais(salvo?.compras_manuais || salvo?.comprasManuais || []);
      setObservacoes(salvo?.observacoes || "");
      setStatus(salvo?.status || "rascunho");
    })();
    return () => { ativo = false; };
  }, [dataReferencia, unidadeAtiva]);

  const alterarPlano = (setPlano, id, patch) => setPlano(atual => ({ ...atual, [id]: { ...(atual[id] || {}), ...patch } }));
  const planejados = useMemo(() => [
    ...fichasCozinha.filter(ficha => numero(cozinha[ficha.id]?.qtd) > 0).map(ficha => ({ setor: "Cozinha", ficha, ...cozinha[ficha.id] })),
    ...fichasBar.filter(ficha => numero(bar[ficha.id]?.qtd) > 0).map(ficha => ({ setor: "Bar", ficha, ...bar[ficha.id] })),
  ], [bar, cozinha, fichasBar, fichasCozinha]);

  const comprasAutomaticas = useMemo(() => {
    const consumo = new Map();
    planejados.forEach(item => {
      calcularConsumoProducao(item.ficha, numero(item.qtd), todasFichas).itens.forEach(linha => {
        const id = linha.insumo.id;
        const atual = consumo.get(id) || { id, nome: linha.insumo.nome, unidade: linha.insumo.unidade_medida || "UN", necessario: 0 };
        atual.necessario += numero(linha.quantidade);
        consumo.set(id, atual);
      });
    });
    return [...consumo.values()].map(item => {
      const saldo = estoque.find(registro => String(registro.insumo_id || registro.id) === String(item.id));
      const disponivel = numero(saldo?.quantidade_atual ?? saldo?.quantidade);
      return { ...item, disponivel, comprar: Math.max(0, item.necessario - disponivel) };
    }).filter(item => item.comprar > 0.0001).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }, [estoque, planejados, todasFichas]);

  const adicionarCompraManual = () => {
    if (!novaCompra.nome.trim() || numero(novaCompra.quantidade) <= 0) return setAviso("Informe o item e a quantidade da compra.");
    setComprasManuais(atual => [...atual, { ...novaCompra, id: `manual:${Date.now()}`, nome: novaCompra.nome.trim() }]);
    setNovaCompra({ nome: "", quantidade: "", unidade: "UN", observacao: "" });
  };

  const montarMemorando = () => ({
    dataReferencia, cozinha, bar, comprasManuais, observacoes, status,
    criadoPor: sessao?.nome || sessao?.user?.email || "Equipe",
  });

  const salvar = async () => {
    if (!planejados.length && !comprasManuais.length) return setAviso("Adicione pelo menos uma produção ou compra.");
    setSalvando(true);
    const memorando = montarMemorando();
    const resposta = await salvarMemorandoOperacao(unidadeAtiva, memorando);
    gravarLocal(unidadeAtiva, dataReferencia, memorando);
    setAviso(resposta.error ? "Memorando salvo neste aparelho. Ative a tabela para compartilhar com a equipe." : "Memorando salvo e compartilhado com a equipe.");
    registrarAuditoria({
      unidadeId: unidadeAtiva,
      usuarioId: sessao?.user?.id || sessao?.id || null,
      usuarioNome: sessao?.nome || sessao?.user?.email || "",
      comando: "Salvar memorando de produção",
      intencao: { data: dataReferencia, producoes: planejados.length, compras: comprasAutomaticas.length + comprasManuais.length, status },
      acao: "operations.production_memo.save",
      modulo: "operations",
      resultado: resposta.error ? "local" : "sucesso",
      exigiuConfirmacao: true,
    }).catch(() => {});
    setSalvando(false);
  };

  // Manda o que a equipe tem que produzir, separado por setor, para o grupo.
  const enviarProducaoWhatsApp = () => {
    if (!planejados.length) return setAviso("Nenhuma produção planejada para esta data.");
    const dataFmt = dataReferencia.split("-").reverse().join("/");
    let txt = `*PRODUÇÃO DO DIA*\n${unidadeInfo?.nome || "Restaurante"}\n${dataFmt}\n`;
    txt += `----------------------------------\n`;
    ["Cozinha", "Bar"].forEach(setor => {
      const itens = planejados.filter(item => item.setor === setor);
      if (!itens.length) return;
      txt += `\n*${setor.toUpperCase()}*\n`;
      itens.forEach(item => {
        txt += `- ${item.ficha.nome_receita}: *${numero(item.qtd).toLocaleString("pt-BR")} porções*`;
        if (item.responsavel) txt += ` — ${item.responsavel}`;
        if (item.observacao) txt += `\n  (${item.observacao})`;
        txt += `\n`;
      });
    });
    if (observacoes?.trim()) txt += `\n*Observações:* ${observacoes.trim()}\n`;
    txt += `\n${planejados.length} preparação(ões) no total.`;
    window.open(`https://wa.me/?text=${encodeURIComponent(txt)}`, "_blank");
  };

  // Manda a lista de compras do memorando direto para o WhatsApp: o que falta
  // comprar para dar conta da produção de amanhã, já descontado o estoque.
  const enviarComprasWhatsApp = () => {
    const compras = [
      ...comprasAutomaticas.map(item => ({
        nome: item.nome,
        quantidade: item.comprar,
        unidade: item.unidade,
        detalhe: `precisa ${numero(item.necessario).toLocaleString("pt-BR", { maximumFractionDigits: 3 })}, tem ${numero(item.disponivel).toLocaleString("pt-BR", { maximumFractionDigits: 3 })}`,
      })),
      ...comprasManuais.map(item => ({ nome: item.nome, quantidade: item.quantidade, unidade: item.unidade, detalhe: item.observacao || "" })),
    ];
    if (!compras.length) return setAviso("Nenhuma compra necessária para esta data.");
    const dataFmt = dataReferencia.split("-").reverse().join("/");
    let txt = `*LISTA DE COMPRAS*\n${unidadeInfo?.nome || "Restaurante"}\nProdução de ${dataFmt}\n`;
    txt += `----------------------------------\n\n`;
    compras.forEach(item => {
      txt += `- ${item.nome}: *${numero(item.quantidade).toLocaleString("pt-BR", { maximumFractionDigits: 3 })} ${item.unidade}*`;
      if (item.detalhe) txt += `\n  (${item.detalhe})`;
      txt += `\n`;
    });
    txt += `\n${compras.length} item(ns) para comprar.`;
    window.open(`https://wa.me/?text=${encodeURIComponent(txt)}`, "_blank");
  };

  const imprimir = () => {
    if (!planejados.length && !comprasAutomaticas.length && !comprasManuais.length) return setAviso("O memorando está vazio.");
    const dataFmt = dataReferencia.split("-").reverse().join("/");
    const linhasSetor = setor => planejados.filter(item => item.setor === setor).map((item, indice) => `<tr><td>${indice + 1}</td><td><b>${escapar(item.ficha.nome_receita)}</b>${item.observacao ? `<br><small>${escapar(item.observacao)}</small>` : ""}</td><td class="centro">${numero(item.qtd).toLocaleString("pt-BR")} porções</td><td>${escapar(item.responsavel || "A definir")}</td><td class="check"></td></tr>`).join("") || '<tr><td colspan="5" class="vazio">Nenhuma produção planejada.</td></tr>';
    const compras = [
      ...comprasAutomaticas.map(item => ({ nome: item.nome, quantidade: item.comprar, unidade: item.unidade, observacao: `Necessário ${item.necessario.toLocaleString("pt-BR", { maximumFractionDigits: 3 })}; saldo ${item.disponivel.toLocaleString("pt-BR", { maximumFractionDigits: 3 })}` })),
      ...comprasManuais,
    ];
    const linhasCompras = compras.map((item, indice) => `<tr><td>${indice + 1}</td><td><b>${escapar(item.nome)}</b></td><td class="centro">${numero(item.quantidade).toLocaleString("pt-BR", { maximumFractionDigits: 3 })} ${escapar(item.unidade)}</td><td>${escapar(item.observacao || "")}</td><td class="check"></td></tr>`).join("") || '<tr><td colspan="5" class="vazio">Nenhuma compra necessária.</td></tr>';
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Memorando ${dataFmt}</title><style>@page{size:A4;margin:10mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#111;margin:0}.topo{display:flex;justify-content:space-between;border-bottom:3px solid #111;padding-bottom:8px}.marca{font-size:10px;text-transform:uppercase;letter-spacing:2px;color:#555}h1{font-size:24px;margin:3px 0}.data{text-align:right;font-weight:bold}.status{font-size:10px;text-transform:uppercase;margin-top:4px}h2{font-size:15px;margin:15px 0 5px;padding:6px 8px;background:#eee;border-left:5px solid #111}table{width:100%;border-collapse:collapse}th,td{border:1px solid #444;padding:6px;font-size:11px;vertical-align:top}th{background:#f3f3f3;text-transform:uppercase;font-size:9px}td:first-child{width:5%;text-align:center}.centro{text-align:center;width:16%}.check{width:8%;height:28px}.vazio{text-align:center;color:#777}.obs{margin-top:15px;border:1px solid #555;padding:8px;min-height:45px;font-size:11px}.assinaturas{display:flex;gap:35px;margin-top:25px}.assinaturas div{flex:1;border-top:1px solid #333;padding-top:4px;text-align:center;font-size:10px}</style></head><body><div class="topo"><div><div class="marca">${escapar(unidadeInfo?.nome || "Unidade")}</div><h1>Memorando de Produção</h1><div class="status">Cozinha · Bar · Compras</div></div><div class="data">${dataFmt}<div class="status">${status === "confirmado" ? "Confirmado" : "Rascunho"}</div></div></div><h2>Produção da Cozinha</h2><table><thead><tr><th>#</th><th>Preparação</th><th>Quantidade</th><th>Responsável</th><th>OK</th></tr></thead><tbody>${linhasSetor("Cozinha")}</tbody></table><h2>Produção do Bar</h2><table><thead><tr><th>#</th><th>Preparação</th><th>Quantidade</th><th>Responsável</th><th>OK</th></tr></thead><tbody>${linhasSetor("Bar")}</tbody></table><h2>Lista de Compras</h2><table><thead><tr><th>#</th><th>Item</th><th>Comprar</th><th>Observação</th><th>OK</th></tr></thead><tbody>${linhasCompras}</tbody></table><div class="obs"><b>Observações gerais:</b><br>${escapar(observacoes || "")}</div><div class="assinaturas"><div>Responsável Cozinha</div><div>Responsável Bar</div><div>Gerência / Compras</div></div></body></html>`;
    imprimirHtml(html, { aoFalhar: () => setAviso("O navegador bloqueou a impressão do memorando.") });
  };

  if (!unidadeAtiva || unidadeAtiva === "todas") return <div className="p-10 text-center font-bold text-slate-500">Selecione uma unidade para criar o memorando.</div>;

  return <div className="min-h-screen bg-slate-50 pb-24 text-slate-800">
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-4 py-4 backdrop-blur sm:px-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3"><button onClick={() => router.back()} className="grid h-11 w-11 place-items-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600"><ArrowLeft size={20}/></button><div><h1 className="text-2xl font-black tracking-tight">Memorando do Dia Seguinte</h1><p className="text-xs font-bold text-slate-500">Cozinha + Bar + lista de compras · {unidadeInfo?.nome}</p></div></div>
        <div className="flex flex-wrap items-center gap-2"><input type="date" value={dataReferencia} onChange={e => setDataReferencia(e.target.value)} className="h-11 rounded-xl border border-slate-200 bg-white px-3 font-bold"/><select value={status} onChange={e => setStatus(e.target.value)} className="h-11 rounded-xl border border-slate-200 bg-white px-3 font-bold"><option value="rascunho">Rascunho</option><option value="confirmado">Confirmado</option></select><button onClick={salvar} disabled={salvando} className="flex h-11 items-center gap-2 rounded-xl bg-emerald-600 px-4 font-black text-white disabled:opacity-50"><Save size={18}/>{salvando ? "Salvando..." : "Salvar"}</button><button onClick={enviarProducaoWhatsApp} className="flex h-11 items-center gap-2 rounded-xl border-2 border-emerald-200 bg-white px-4 font-black text-emerald-700 hover:bg-emerald-50"><Share2 size={18}/>Produção no WhatsApp</button><button onClick={enviarComprasWhatsApp} className="flex h-11 items-center gap-2 rounded-xl border-2 border-emerald-200 bg-white px-4 font-black text-emerald-700 hover:bg-emerald-50"><Share2 size={18}/>Compras no WhatsApp</button><button onClick={imprimir} className="flex h-11 items-center gap-2 rounded-xl bg-slate-900 px-4 font-black text-white"><Printer size={18}/>Imprimir</button></div>
      </div>
    </header>

    <main className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-6">
      {aviso && <div className="flex items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800"><span>{aviso}</span><button onClick={() => setAviso("")} className="text-emerald-600">×</button></div>}
      {loading ? <div className="p-16 text-center font-bold text-slate-400">Carregando fichas e estoque...</div> : <div className="grid gap-5 lg:grid-cols-2"><SetorPlanejamento titulo="Produção da Cozinha" icone={ChefHat} cor="bg-emerald-700" fichas={fichasCozinha} plano={cozinha} colaboradores={colaboradores} alterar={(id, patch) => alterarPlano(setCozinha, id, patch)}/><SetorPlanejamento titulo="Produção do Bar" icone={GlassWater} cor="bg-blue-700" fichas={fichasBar} plano={bar} colaboradores={colaboradores} alterar={(id, patch) => alterarPlano(setBar, id, patch)}/></div>}

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <header className="flex items-center gap-3 bg-amber-500 px-5 py-4 text-white"><ShoppingCart size={24}/><div><h2 className="text-xl font-black">Lista de Compras</h2><p className="text-xs font-semibold text-amber-50">Faltas calculadas automaticamente + itens manuais</p></div></header>
        <div className="p-4 sm:p-5">
          {comprasAutomaticas.length > 0 && <div className="mb-4 overflow-x-auto"><table className="w-full min-w-[620px] text-left text-xs"><thead className="bg-slate-100 text-[10px] font-black uppercase text-slate-500"><tr><th className="p-3">Item</th><th className="p-3">Necessário</th><th className="p-3">Saldo</th><th className="p-3">Comprar</th></tr></thead><tbody className="divide-y divide-slate-100">{comprasAutomaticas.map(item => <tr key={item.id}><td className="p-3 font-black">{item.nome}</td><td className="p-3">{item.necessario.toLocaleString("pt-BR", { maximumFractionDigits: 3 })} {item.unidade}</td><td className="p-3">{item.disponivel.toLocaleString("pt-BR", { maximumFractionDigits: 3 })} {item.unidade}</td><td className="p-3 font-black text-rose-600">{item.comprar.toLocaleString("pt-BR", { maximumFractionDigits: 3 })} {item.unidade}</td></tr>)}</tbody></table></div>}
          {comprasAutomaticas.length === 0 && <p className="mb-4 rounded-xl bg-emerald-50 p-3 text-sm font-bold text-emerald-700">O estoque atual cobre as produções planejadas.</p>}
          <div className="grid gap-2 rounded-2xl border border-dashed border-amber-300 bg-amber-50/50 p-3 sm:grid-cols-[1fr_110px_90px_1fr_auto]"><input value={novaCompra.nome} onChange={e => setNovaCompra({ ...novaCompra, nome: e.target.value })} placeholder="Adicionar compra manual" className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold outline-none"/><input value={novaCompra.quantidade} onChange={e => setNovaCompra({ ...novaCompra, quantidade: e.target.value })} inputMode="decimal" placeholder="Qtd" className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold outline-none"/><select value={novaCompra.unidade} onChange={e => setNovaCompra({ ...novaCompra, unidade: e.target.value })} className="h-10 rounded-xl border border-slate-200 bg-white px-2 text-xs font-bold"><option>UN</option><option>KG</option><option>G</option><option>L</option><option>ML</option><option>CX</option><option>PCT</option></select><input value={novaCompra.observacao} onChange={e => setNovaCompra({ ...novaCompra, observacao: e.target.value })} placeholder="Observação/fornecedor" className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold outline-none"/><button onClick={adicionarCompraManual} className="flex h-10 items-center justify-center gap-1 rounded-xl bg-amber-500 px-3 text-xs font-black text-white"><Plus size={16}/>Adicionar</button></div>
          {comprasManuais.length > 0 && <div className="mt-3 grid gap-2 sm:grid-cols-2">{comprasManuais.map(item => <article key={item.id} className="flex items-center gap-3 rounded-xl border border-slate-200 p-3"><div className="min-w-0 flex-1"><strong className="block truncate text-sm">{item.nome}</strong><small className="text-slate-500">{item.quantidade} {item.unidade}{item.observacao ? ` · ${item.observacao}` : ""}</small></div><button onClick={() => setComprasManuais(atual => atual.filter(compra => compra.id !== item.id))} className="grid h-9 w-9 place-items-center rounded-lg bg-rose-50 text-rose-600"><Trash2 size={16}/></button></article>)}</div>}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5"><label className="mb-2 flex items-center gap-2 text-sm font-black text-slate-700"><ClipboardList size={18}/>Observações gerais do memorando</label><textarea rows={4} value={observacoes} onChange={e => setObservacoes(e.target.value)} placeholder="Prioridades, entregas, eventos, armazenamento e recados para as equipes..." className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold outline-none focus:border-emerald-500"/><div className="mt-4 flex items-center justify-between text-xs font-bold text-slate-500"><span>{planejados.length} produção(ões) · {comprasAutomaticas.length + comprasManuais.length} compra(s)</span>{status === "confirmado" && <span className="flex items-center gap-1 text-emerald-600"><CheckCircle2 size={16}/>Memorando confirmado</span>}</div></section>
    </main>
  </div>;
}
