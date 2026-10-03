"use client";

// INVENTÁRIOS / CONTAGENS DE ESTOQUE — F2.4A.
// Quem conta só informa QUANTIDADE (na unidade do cadastro). Cada "Contado"
// grava na hora; sem internet, fica numa fila neste aparelho e é enviado
// quando a conexão volta. FINALIZAR mostra o resumo, valoriza com custo de
// origem conhecida e fecha: depois disso quantidade e custo ficam congelados.
// Ao fechar, o saldo do estoque de cada produto contado passa a ser o contado
// (lib/inventario-saldo.mjs): é a única forma de contar estoque no sistema.
// Garrafa, saco e afins são contados em "fechadas + aberta".
// EST-MOV: produto contado não se corrige nem se apaga pelo funcionário (só o
// administrador, com PIN); ZERO exige confirmação; contagem cega configurável;
// com o banco atualizado, ir para o saldo é o AJUSTE autorizado (PIN) — sem
// ele, segue o caminho anterior (aplicar ao saldo ao fechar).

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useERP } from "../../../../context/ERPContext";
import {
  fetchBaseContagem, fetchContagens, fetchContagem, fetchItensContagem, abrirContagem, gravarItemContagem,
  registrarPendencia, alterarPendencia, finalizarContagem, descartarContagem, aplicarInventarioAoSaldo, situacaoNoSaldo,
} from "../../../../lib/estoque-contagens";
import { ehFracionavel, ehUnidadeContavel, quantidadeDeEmbalagens, saldoParaCadastro, unidadeDoConteudo, conteudoDe, lerSoma } from "../../../../lib/inventario-saldo.mjs";
import EstoqueAbas from "../../../../components/navigation/EstoqueAbas";
import {
  TIPOS_CONTAGEM, STATUS_CONTAGEM, GRUPOS_LOCAL, grupoDoEstoque, unidadeContagem, daBase, fmtQtd, lerQuantidade,
  cicloDoMes, proximaContagem, tituloContagem, lerObs, progressoContagem, resumoFechamento, custoSugerido,
  enfileirar, compararContagens, valorContagem, chaveItem, hojeLocal, UNIDADES_PENDENCIA,
  statusItemContagem, ROTULO_STATUS_ITEM, impactoDivergencias, paraBase,
} from "../../../../lib/contagem-estoque.mjs";
import { quantidadeDoLancamento, embalagemDoProduto, unidadesDaFracao, STATUS_AJUSTE } from "../../../../lib/estoque-movimento.mjs";
import { lerSeguranca, corrigirProdutoContado, ajustarPeloInventario, fetchAjustesDoInventario } from "../../../../lib/estoque-movimento-dados";
import { unidadeValida, lerValor } from "../../../../lib/contas-pagar.mjs";
import { hasPermission, permissionKey } from "../../../../lib/permissions-catalog.mjs";
import { fmtBRL } from "../../../../components/ui";
import { ArrowLeft, Check, ClipboardList, Plus, Search, X, AlertTriangle, CloudOff, Loader2, Lock, EyeOff, Scale } from "lucide-react";

const fmtData = (d) => (d ? new Date(`${String(d).slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR") : "—");
const fmtHora = (d) => (d ? new Date(d).toLocaleString("pt-BR") : "—");
const nomeUsuario = (s) => s?.nome || s?.user_metadata?.nome || s?.email || "Usuário do sistema";
const COR_STATUS = { aberta: "bg-amber-100 text-amber-800", fechada: "bg-emerald-100 text-emerald-800", cancelada: "bg-stone-200 text-stone-700" };
const ordenarNome = (a, b) => String(a.insumo?.nome || "").localeCompare(String(b.insumo?.nome || ""), "pt-BR", { sensitivity: "base" });
const normal = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
// erro de rede (fica na fila) × erro de regra (não adianta tentar de novo)
const erroDeRede = (msg) => /fetch|network|offline|timeout|failed|load failed|err_|conex/i.test(String(msg || ""));

export default function ContagensPage() {
  return <Suspense fallback={<p className="p-8 text-center font-bold text-fg">Carregando...</p>}><Contagens /></Suspense>;
}

function Contagens() {
  const { unidadeAtiva, sessao } = useERP();
  const params = useSearchParams();
  const id = params.get("id");
  if (!unidadeValida(unidadeAtiva)) return <p className="p-8 text-center font-bold text-fg">Selecione uma unidade para contar o estoque.</p>;
  return id ? <TelaContagem key={id} id={id} unidade={unidadeAtiva} sessao={sessao} /> : <Painel unidade={unidadeAtiva} />;
}

// ═══ PAINEL: em andamento, próxima contagem, histórico ══════════════════════
function Painel({ unidade }) {
  const router = useRouter();
  const hoje = hojeLocal();
  const [contagens, setContagens] = useState([]);
  const [itens, setItens] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [nova, setNova] = useState(null);
  const [processando, setProcessando] = useState(false);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const c = await fetchContagens(unidade);
      const ids = (c.data || []).filter((x) => x.status !== "cancelada").map((x) => x.id);
      const i = await fetchItensContagem(ids);
      if (!vivo) return;
      setContagens(c.data || []); setItens(i.data || []); setErro([c.error, i.error].filter(Boolean).join(" · ")); setCarregando(false);
    })();
    return () => { vivo = false; };
  }, [unidade]);

  const [ano, mes] = hoje.split("-").map(Number);
  const ciclo = cicloDoMes(ano, mes);
  const proxima = proximaContagem(contagens, hoje);
  const fechadas = contagens.filter((c) => c.status === "fechada");
  const ultima = fechadas[0];
  const abertas = contagens.filter((c) => c.status === "aberta");
  const itensDe = (cid) => itens.filter((i) => i.contagem_id === cid);
  const sugestaoTipo = ciclo.find((x) => x.data === hoje)?.tipo || "intermediaria";

  const abrir = async (e) => {
    e.preventDefault();
    if (processando) return;
    setProcessando(true);
    const r = await abrirContagem({ unidade_id: unidade, tipo: nova.tipo, data_referencia: nova.data, nota: nova.nota });
    setProcessando(false);
    if (r.error) return alert(`Não foi possível abrir: ${r.error}`);
    router.push(`/dashboard/operacao/estoque/contagens?id=${r.data.id}`);
  };

  return (
    <div className="min-h-screen pb-24 bg-[var(--surface)] text-slate-800">
      <EstoqueAbas />
      <div className="bg-slate-900 px-4 sm:px-8 pt-6 pb-6 text-white">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-4xl font-black tracking-tighter">Contagem de estoque</h1>
            <p className="text-slate-300 font-bold uppercase tracking-widest text-3xs sm:text-xs mt-1">Inventário · ao fechar, vira o saldo do estoque · base do CMV real</p>
          </div>
          <button onClick={() => setNova({ data: hoje, tipo: sugestaoTipo, nota: "" })} className="px-4 py-3 bg-emerald-500 hover:bg-emerald-600 font-black rounded-2xl flex items-center gap-2 text-sm">
            <Plus size={18} /> Nova contagem
          </button>
        </div>
        <div className="max-w-5xl mx-auto mt-5 grid grid-cols-2 lg:grid-cols-4 gap-2">
          {[
            ["Última contagem fechada", ultima ? fmtData(ultima.data_referencia) : "Nenhuma", ultima ? tituloContagem(ultima) : "ainda não há inventário fechado"],
            ["Valor do último inventário", ultima ? fmtBRL(valorContagem(itensDe(ultima.id)).valor) : "—", ultima ? `${itensDe(ultima.id).length} produtos contados` : "—"],
            ["Próxima contagem", proxima ? fmtData(proxima.data) : "—", proxima ? TIPOS_CONTAGEM.find((t) => t.codigo === proxima.tipo)?.rotulo : ""],
            ["Em contagem agora", String(abertas.length), abertas.length ? "toque em Continuar abaixo" : "nenhuma aberta"],
          ].map(([r, v, n]) => (
            <div key={r} className="bg-slate-800/80 p-3 rounded-2xl border border-slate-700/50">
              <p className="text-3xs font-black uppercase text-slate-300">{r}</p>
              <p className="text-lg sm:text-2xl font-black mt-1">{v}</p>
              <p className="text-3xs text-slate-300">{n}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-8 mt-5 space-y-4">
        {erro && <p className="text-sm font-bold text-red-700">Parte dos dados não carregou: {erro}</p>}

        {nova && (
          <form onSubmit={abrir} className="bg-card rounded-3xl border border-line p-4 space-y-3">
            <div className="flex justify-between items-center"><h2 className="font-black">Nova contagem</h2><button type="button" onClick={() => setNova(null)} aria-label="Fechar"><X size={18} /></button></div>
            <div className="grid sm:grid-cols-2 gap-3">
              <label className="block"><span className="text-xs font-bold uppercase text-fg">Data do inventário</span>
                <input type="date" required max={hoje} value={nova.data} onChange={(e) => setNova({ ...nova, data: e.target.value, tipo: cicloDoMes(...e.target.value.split("-").slice(0, 2).map(Number)).find((x) => x.data === e.target.value)?.tipo || nova.tipo })}
                  className="mt-1 w-full h-12 px-3 rounded-xl border border-line bg-white font-bold" /></label>
              <label className="block"><span className="text-xs font-bold uppercase text-fg">Tipo</span>
                <select value={nova.tipo} onChange={(e) => setNova({ ...nova, tipo: e.target.value })} className="mt-1 w-full h-12 px-3 rounded-xl border border-line bg-white font-bold">
                  {TIPOS_CONTAGEM.map((t) => <option key={t.codigo} value={t.codigo}>{t.rotulo}</option>)}
                </select></label>
            </div>
            <label className="block"><span className="text-xs font-bold uppercase text-fg">Observação (opcional)</span>
              <input value={nova.nota} onChange={(e) => setNova({ ...nova, nota: e.target.value })} className="mt-1 w-full h-12 px-3 rounded-xl border border-line bg-white font-bold" /></label>
            <p className="text-xs text-fg">Um inventário cobre a unidade inteira: cada pessoa escolhe o local (Cozinha, Bar, Pré-preparos, Outros) na hora de contar.</p>
            <button disabled={processando} className="w-full h-12 bg-emerald-500 text-white font-black rounded-2xl disabled:opacity-60">{processando ? "Abrindo..." : "Começar a contar"}</button>
          </form>
        )}

        {abertas.map((c) => (
          <div key={c.id} className="bg-amber-50 border border-amber-200 rounded-3xl p-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-3xs font-black uppercase text-amber-800">Em contagem</p>
              <p className="font-black text-lg">{tituloContagem(c)}</p>
              <p className="text-xs text-fg">{fmtData(c.data_referencia)} · {itensDe(c.id).length} produto(s) já contado(s)</p>
            </div>
            <button onClick={() => router.push(`/dashboard/operacao/estoque/contagens?id=${c.id}`)} className="h-12 px-5 bg-emerald-500 text-white font-black rounded-2xl">Continuar</button>
          </div>
        ))}

        <div className="bg-card rounded-3xl border border-line p-4">
          <h2 className="font-black text-sm uppercase tracking-wider">Ciclo de {new Date(`${hoje}T12:00:00`).toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</h2>
          <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
            {ciclo.map((x) => {
              const feita = contagens.find((c) => String(c.data_referencia).slice(0, 10) === x.data && c.status === "fechada");
              const aberta = contagens.find((c) => String(c.data_referencia).slice(0, 10) === x.data && c.status === "aberta");
              return (
                <div key={x.data} className={`rounded-xl p-2 border ${feita ? "border-emerald-300 bg-emerald-50" : aberta ? "border-amber-300 bg-amber-50" : "border-line bg-white"}`}>
                  <p className="font-black">{fmtData(x.data)}</p>
                  <p className="text-fg">{TIPOS_CONTAGEM.find((t) => t.codigo === x.tipo)?.rotulo}</p>
                  <p className="font-bold">{feita ? "fechada" : aberta ? "em contagem" : x.data < hoje ? "não feita" : "a fazer"}</p>
                </div>
              );
            })}
          </div>
          <p className="text-3xs text-fg mt-2">As contagens semanais acompanham o mês; o fechamento do último dia é o estoque final do CMV.</p>
        </div>

        <div className="bg-card rounded-3xl border border-line overflow-hidden">
          <h2 className="font-black text-sm uppercase tracking-wider p-4 pb-2">Histórico</h2>
          {carregando ? <p className="p-4 text-sm font-bold text-fg">Carregando...</p>
            : !contagens.length ? <p className="p-4 text-sm text-fg">Nenhum inventário ainda. Toque em “Nova contagem”.</p>
            : <ul className="divide-y divide-line">{contagens.map((c) => {
              const its = itensDe(c.id);
              const v = valorContagem(its);
              return (
                <li key={c.id}>
                  <button onClick={() => router.push(`/dashboard/operacao/estoque/contagens?id=${c.id}`)} className="w-full text-left p-4 flex justify-between gap-3 hover:bg-white">
                    <div>
                      <p className="font-black">{fmtData(c.data_referencia)} — {tituloContagem(c)}</p>
                      <p className="text-xs text-fg">{its.length} produto(s){c.status === "fechada" ? ` · fechado em ${fmtHora(c.fechada_em)}` : ""}</p>
                    </div>
                    <div className="text-right">
                      <span className={`px-2 py-0.5 rounded-full text-3xs font-black uppercase ${COR_STATUS[c.status]}`}>{STATUS_CONTAGEM[c.status]}</span>
                      {c.status === "fechada" && <p className="font-black mt-1">{fmtBRL(v.valor)}</p>}
                    </div>
                  </button>
                </li>);
            })}</ul>}
        </div>
      </div>
    </div>
  );
}

// ═══ CONTAGEM ═══════════════════════════════════════════════════════════════
function TelaContagem({ id, unidade, sessao }) {
  const router = useRouter();
  const chaveFila = `hefisto:contagem:${id}:fila`;
  const [contagem, setContagem] = useState(null);
  const [base, setBase] = useState(null);
  const [itens, setItens] = useState(new Map());
  const [fila, setFila] = useState([]);
  const [falhasEnvio, setFalhasEnvio] = useState([]);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [f, setF] = useState({ grupo: "todos", estoqueId: "", busca: "", categoria: "", mostrar: "todos" });
  const [edit, setEdit] = useState({});
  const [modal, setModal] = useState(null);
  const [processando, setProcessando] = useState(false);
  const enviando = useRef(false);
  const inputs = useRef({});
  const [seg, setSeg] = useState(null);
  const [estMov, setEstMov] = useState(false);
  useEffect(() => { lerSeguranca(unidade).then((r) => { setSeg(r.data || null); setEstMov(!!r.data); }); }, [unidade]);

  // ── carga ──
  const carregar = useCallback(async () => {
    const [c, b, i] = await Promise.all([fetchContagem(id), fetchBaseContagem(unidade), fetchItensContagem(id)]);
    setContagem(c.data); setBase(b.data);
    setItens(new Map((i.data || []).map((x) => [chaveItem(x.insumo_id, x.estoque_id), x])));
    setErro([c.error, b.error, i.error].filter(Boolean).join(" · "));
    setCarregando(false);
  }, [id, unidade]);
  useEffect(() => { carregar(); }, [carregar]);

  // ── fila local (salvamento progressivo) ──
  useEffect(() => { try { setFila(JSON.parse(localStorage.getItem(chaveFila) || "[]")); } catch { setFila([]); } }, [chaveFila]);
  const filaRef = useRef(fila);
  filaRef.current = fila;
  // a ref muda na hora (o envio em laço lê a fila atual, não a do último render)
  const gravarFila = (nova) => {
    filaRef.current = nova; setFila(nova);
    try { localStorage.setItem(chaveFila, JSON.stringify(nova)); } catch { /* sem armazenamento: segue só em memória */ }
  };

  const enviar = useCallback(async () => {
    if (enviando.current || !filaRef.current.length || contagem?.status !== "aberta") return;
    enviando.current = true;
    let semRede = false;
    try {
      for (const op of [...filaRef.current]) {
        const r = await gravarItemContagem({ ...op, contagem_id: id, unidade_id: unidade });
        if (r.error && erroDeRede(r.error)) { semRede = true; break; }   // sem conexão: tenta depois
        const restante = filaRef.current.filter((x) => !(x.insumo_id === op.insumo_id && (x.estoque_id || null) === (op.estoque_id || null) && x.enfileirado_em === op.enfileirado_em));
        gravarFila(restante);
        if (r.error) { setFalhasEnvio((s) => [...s, { nome: op.nome, motivo: r.error }]); continue; }
        setItens((m) => new Map(m).set(chaveItem(op.insumo_id, op.estoque_id), {
          ...(m.get(chaveItem(op.insumo_id, op.estoque_id)) || {}), id: r.data.id, insumo_id: op.insumo_id, estoque_id: op.estoque_id || null,
          quantidade_contada: r.data.quantidade_contada, unidade_base: r.data.unidade_base,
          quantidade_sistema: op.quantidade_sistema == null ? null : paraBase(op.quantidade_sistema, op.unidade_medida),
          observacao: op.detalhe || null,
        }));
      }
    } finally { enviando.current = false; }
    // o que entrou na fila durante o envio (correção do mesmo produto) vai em seguida
    if (!semRede && filaRef.current.length) setTimeout(() => enviarRef.current?.(), 200);
  }, [id, unidade, contagem?.status]); // eslint-disable-line react-hooks/exhaustive-deps
  const enviarRef = useRef(null);
  enviarRef.current = enviar;
  useEffect(() => {
    if (!fila.length) return undefined;
    const t = setTimeout(enviar, 300);
    const i = setInterval(enviar, 15000);
    window.addEventListener("online", enviar);
    return () => { clearTimeout(t); clearInterval(i); window.removeEventListener("online", enviar); };
  }, [fila.length, enviar]);
  useEffect(() => {
    const aviso = (e) => { if (filaRef.current.length) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", aviso);
    return () => window.removeEventListener("beforeunload", aviso);
  }, []);

  // ── dados derivados ──
  const estoques = base?.estoques || [];
  const estoquePorId = useMemo(() => new Map(estoques.map((e) => [e.id, e])), [estoques]);
  const insumoPorId = useMemo(() => new Map((base?.insumos || []).map((i) => [i.id, i])), [base]);
  const produtos = useMemo(() => (base?.vinculos || [])
    .filter((v) => estoquePorId.has(v.estoque_id) && insumoPorId.has(v.insumo_id))
    .map((v) => ({ ...v, key: chaveItem(v.insumo_id, v.estoque_id), insumo: insumoPorId.get(v.insumo_id), estoque: estoquePorId.get(v.estoque_id) })), [base, estoquePorId, insumoPorId]);
  const pendentesFila = useMemo(() => new Map(fila.map((o) => [chaveItem(o.insumo_id, o.estoque_id), o])), [fila]);
  const contadoDe = (key) => pendentesFila.get(key) || itens.get(key) || null;
  const itensLista = useMemo(() => {
    const m = new Map(itens);
    for (const [k, o] of pendentesFila) m.set(k, { insumo_id: o.insumo_id, estoque_id: o.estoque_id || null, quantidade_contada: 0 });
    return [...m.values()];
  }, [itens, pendentesFila]);
  const obs = lerObs(contagem?.observacao);
  const aberta = contagem?.status === "aberta";
  // contar: quem entra na tela. Finalizar/cancelar: permissão própria (vê custo e congela).
  const podeFechar = !sessao?.gerenciado || hasPermission(sessao, permissionKey("estoque", "counts", "close_inventory"));
  // contagem cega (padrão ligada): quem conta não vê o saldo do sistema nem a divergência
  const cega = seg?.contagem_cega !== false;
  const admin = !!seg?.pode_autorizar;
  const mostrarDivergencia = admin || !cega;

  const estoquesDoGrupo = f.grupo === "todos" ? estoques : estoques.filter((e) => grupoDoEstoque(e) === f.grupo);
  const noFiltroLocal = (estoqueId) => (f.estoqueId ? estoqueId === f.estoqueId : estoquesDoGrupo.some((e) => e.id === estoqueId));
  const termo = normal(f.busca.trim());
  const casaBusca = (ins) => !termo || normal(ins?.nome).includes(termo) || normal(ins?.nome_interno).includes(termo) || normal(ins?.codigo_interno).includes(termo);
  const doLocal = produtos.filter((p) => noFiltroLocal(p.estoque_id));
  const visiveis = doLocal
    .filter((p) => casaBusca(p.insumo) && (!f.categoria || p.insumo?.categoria === f.categoria))
    .filter((p) => f.mostrar === "todos" || (f.mostrar === "nao" ? !contadoDe(p.key) : !!contadoDe(p.key)))
    .sort(ordenarNome);
  // busca também no cadastro inteiro: produto que não está vinculado a este local
  const localParaExtra = f.estoqueId || (estoquesDoGrupo.length === 1 ? estoquesDoGrupo[0].id : "");
  const extras = termo.length >= 2 ? (base?.insumos || [])
    .filter((i) => casaBusca(i) && !doLocal.some((p) => p.insumo_id === i.id))
    .slice(0, 20) : [];
  const categorias = [...new Set(doLocal.map((p) => p.insumo?.categoria).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  const progGeral = progressoContagem(produtos, itensLista);
  const progLocal = progressoContagem(doLocal, itensLista);

  // ── ações ──
  // valorTexto na unidade do cadastro; detalhe = o que foi digitado ("3 fechadas + 200 ml", "6+4")
  const registrar = (p, valorTexto, estoqueId = p.estoque_id, detalhe = "") => {
    if (!aberta) return;
    const q = lerQuantidade(valorTexto);
    if (q.erro) return alert(`${p.insumo?.nome}: ${q.erro}`);
    const key = chaveItem(p.insumo_id, estoqueId);
    if (contadoDe(key)) return alert(`${p.insumo?.nome}: este produto já foi contado. Correção só pelo administrador, com PIN.`);
    gravarFila(enfileirar(filaRef.current, {
      insumo_id: p.insumo_id, estoque_id: estoqueId || null, nome: p.insumo?.nome, quantidade: String(q.valor), detalhe,
      unidade_medida: p.insumo?.unidade_medida, quantidade_sistema: saldoParaCadastro(p.quantidade_atual, p.insumo), item_id: null,
    }));
    setEdit((s) => { const n = { ...s }; delete n[key]; return n; });
    // vai para o próximo da lista
    const idx = visiveis.findIndex((x) => x.key === key);
    const prox = visiveis.slice(idx + 1).find((x) => !contadoDe(x.key));
    if (prox) setTimeout(() => inputs.current[prox.key]?.focus(), 50);
  };

  const salvarPendencia = async (e) => {
    e.preventDefault();
    if (processando) return;
    setProcessando(true);
    const r = await registrarPendencia({ contagem_id: id, nome: modal.nome, unidade: modal.unidade, estoque_id: modal.estoque_id || null, quantidade: modal.quantidade, registrado_por: nomeUsuario(sessao) });
    setProcessando(false);
    if (r.error) return alert(erroDeRede(r.error) ? "Sem conexão: produto não cadastrado precisa de internet para ser registrado. Tente de novo em instantes." : `Não foi possível registrar: ${r.error}`);
    setModal(null); await carregar();
  };
  const mudarPendencia = async (pendencia_id, status) => {
    const r = await alterarPendencia({ contagem_id: id, pendencia_id, status });
    if (r.error) return alert(`Não foi possível alterar: ${r.error}`);
    await carregar();
  };
  const cancelar = async () => {
    const motivo = window.prompt("Motivo do cancelamento deste inventário (os itens contados ficam no histórico):");
    if (!motivo) return;
    const r = await descartarContagem({ contagem_id: id, motivo });
    if (r.error) return alert(`Não foi possível cancelar: ${r.error}`);
    await carregar();
  };

  if (carregando) return <p className="p-8 text-center font-bold text-fg">Carregando inventário...</p>;
  if (!contagem) return <div className="p-8 text-center space-y-3"><p className="font-bold text-red-700">{erro || "Inventário não encontrado."}</p><button onClick={() => router.push("/dashboard/operacao/estoque/contagens")} className="font-black underline">Voltar</button></div>;

  return (
    <div className="min-h-screen pb-32 bg-[var(--surface)] text-slate-800">
      {/* topo fixo: título, status, progresso */}
      <div className="sticky top-0 z-20 bg-slate-900 text-white px-4 sm:px-8 pt-4 pb-3 shadow-lg">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-start justify-between gap-2">
            <button onClick={() => router.push("/dashboard/operacao/estoque/contagens")} className="p-2 -ml-2" aria-label="Voltar"><ArrowLeft size={20} /></button>
            <div className="flex-1 min-w-0">
              <p className="text-3xs font-black uppercase tracking-widest text-slate-300">Contagem de estoque</p>
              <h1 className="text-lg sm:text-2xl font-black truncate">{tituloContagem(contagem)}</h1>
              <p className="text-xs text-slate-300">{fmtData(contagem.data_referencia)} · responsável: {nomeUsuario(sessao)}{cega ? " · " : ""}{cega && <span className="inline-flex items-center gap-1 font-bold"><EyeOff size={12} /> contagem cega</span>}</p>
            </div>
            <span className={`px-2 py-1 rounded-full text-3xs font-black uppercase ${COR_STATUS[contagem.status]}`}>{STATUS_CONTAGEM[contagem.status]}</span>
          </div>
          <div className="mt-3">
            <div className="flex justify-between text-xs font-bold">
              <span>{progGeral.contados} / {progGeral.total} produtos contados</span>
              <span>{progGeral.pct}% · não contados: {progGeral.naoContados}</span>
            </div>
            <div className="h-2 bg-slate-700 rounded-full mt-1 overflow-hidden"><div className="h-full bg-emerald-400" style={{ width: `${progGeral.pct}%` }} /></div>
          </div>
          {fila.length > 0 && <p className="mt-2 text-xs font-bold text-amber-300 flex items-center gap-1"><CloudOff size={14} /> {fila.length} contagem(ns) guardada(s) neste aparelho, aguardando envio. Não feche o navegador.</p>}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-3 sm:px-8 mt-3 space-y-3">
        {erro && <p className="text-sm font-bold text-red-700">Parte dos dados não carregou: {erro}</p>}
        {falhasEnvio.length > 0 && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-xs">
            <p className="font-black text-red-800">Não foi possível gravar:</p>
            {falhasEnvio.map((x, i) => <p key={i}>{x.nome}: {x.motivo}</p>)}
            <button onClick={() => setFalhasEnvio([])} className="mt-1 font-bold underline">ok</button>
          </div>
        )}
        {!aberta && <FechadoResumo contagem={contagem} itens={[...itens.values()]} insumoPorId={insumoPorId} estoquePorId={estoquePorId} obs={obs} unidade={unidade} sessao={sessao} podeAplicar={podeFechar} admin={admin} estMov={estMov} />}

        {aberta && (
          <>
            {/* local */}
            <div className="flex gap-2 overflow-x-auto pb-1">
              {[{ id: "todos", rotulo: "Todos" }, ...GRUPOS_LOCAL].map((g) => (
                <button key={g.id} onClick={() => setF({ ...f, grupo: g.id, estoqueId: "", categoria: "" })}
                  className={`shrink-0 h-11 px-4 rounded-2xl font-black text-sm border ${f.grupo === g.id ? "bg-emerald-500 text-white border-emerald-500" : "bg-white border-line"}`}>{g.rotulo}</button>
              ))}
            </div>
            {estoquesDoGrupo.length > 1 && f.grupo !== "todos" && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                <button onClick={() => setF({ ...f, estoqueId: "" })} className={`shrink-0 h-9 px-3 rounded-xl text-xs font-bold border ${!f.estoqueId ? "bg-slate-900 text-white" : "bg-white border-line"}`}>Todos deste grupo</button>
                {estoquesDoGrupo.map((e) => (
                  <button key={e.id} onClick={() => setF({ ...f, estoqueId: e.id })} className={`shrink-0 h-9 px-3 rounded-xl text-xs font-bold border ${f.estoqueId === e.id ? "bg-slate-900 text-white" : "bg-white border-line"}`}>{e.nome}</button>
                ))}
              </div>
            )}
            {/* busca e filtros */}
            <div className="bg-card rounded-2xl border border-line p-2 space-y-2">
              <div className="flex items-center gap-2 px-2">
                <Search size={18} className="text-fg shrink-0" />
                <input value={f.busca} onChange={(e) => setF({ ...f, busca: e.target.value })} placeholder="Buscar produto ou código" className="flex-1 h-11 bg-transparent font-bold outline-none text-base" />
                {f.busca && <button onClick={() => setF({ ...f, busca: "" })} aria-label="Limpar"><X size={18} /></button>}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <select value={f.categoria} onChange={(e) => setF({ ...f, categoria: e.target.value })} className="h-10 px-2 rounded-xl border border-line bg-white text-xs font-bold">
                  <option value="">Todas as categorias</option>
                  {categorias.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <select value={f.mostrar} onChange={(e) => setF({ ...f, mostrar: e.target.value })} className="h-10 px-2 rounded-xl border border-line bg-white text-xs font-bold">
                  <option value="todos">Contados e não contados</option>
                  <option value="nao">Só não contados</option>
                  <option value="sim">Só contados</option>
                </select>
              </div>
              <p className="text-3xs text-fg px-2">Neste filtro: {progLocal.contados} / {progLocal.total} contados ({progLocal.pct}%) · ordem alfabética</p>
            </div>

            {/* lista */}
            <div className="space-y-2">
              {!visiveis.length && !extras.length && <p className="p-6 text-center text-sm font-bold text-fg">Nenhum produto neste filtro.</p>}
              {visiveis.map((p) => (
                <LinhaProduto key={p.key} p={p} contado={contadoDe(p.key)} pendente={pendentesFila.has(p.key)} valor={edit[p.key] ?? ""}
                  onValor={(v) => setEdit({ ...edit, [p.key]: v })} onConfirmar={(v, detalhe) => registrar(p, v, p.estoque_id, detalhe)} refInput={(el) => { inputs.current[p.key] = el; }} mostrarLocal={!f.estoqueId}
                  onZero={() => setModal({ tipo: "zero", p, estoqueId: p.estoque_id })} onCorrigir={(item) => setModal({ tipo: "corrigir", p, item })}
                  mostrarSistema={!cega} mostrarDivergencia={mostrarDivergencia} admin={admin} />
              ))}
              {extras.length > 0 && (
                <div className="pt-2">
                  <p className="text-xs font-black uppercase text-fg px-1">Outros produtos do cadastro (não vinculados a este local)</p>
                  {!localParaExtra && <p className="text-xs text-amber-700 px-1">Escolha um local específico acima para contar estes produtos nele.</p>}
                  <div className="space-y-2 mt-2">
                    {extras.map((ins) => {
                      const p = { insumo_id: ins.id, estoque_id: localParaExtra || null, insumo: ins, key: chaveItem(ins.id, localParaExtra || null), estoque: estoquePorId.get(localParaExtra) };
                      return (
                        <LinhaProduto key={`x-${ins.id}`} p={p} contado={localParaExtra ? contadoDe(p.key) : null} pendente={pendentesFila.has(p.key)} valor={edit[p.key] ?? ""} desabilitado={!localParaExtra}
                          onValor={(v) => setEdit({ ...edit, [p.key]: v })} onConfirmar={(v, detalhe) => registrar(p, v, localParaExtra, detalhe)} refInput={() => {}} mostrarLocal
                          onZero={() => setModal({ tipo: "zero", p, estoqueId: localParaExtra })} onCorrigir={(item) => setModal({ tipo: "corrigir", p, item })}
                          mostrarSistema={false} mostrarDivergencia={mostrarDivergencia} admin={admin} />
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* pendências */}
            <div className="bg-card rounded-2xl border border-line p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="font-black text-sm">Produtos não cadastrados ({obs.pendencias.filter((x) => (x.status || "pendente") === "pendente").length} pendente(s))</p>
                <button onClick={() => setModal({ tipo: "pendencia", nome: f.busca, unidade: "kg", estoque_id: f.estoqueId || estoquesDoGrupo[0]?.id || "", quantidade: "" })}
                  className="h-10 px-3 rounded-xl bg-slate-900 text-white text-xs font-black flex items-center gap-1"><Plus size={14} /> Produto não cadastrado</button>
              </div>
              {obs.pendencias.length > 0 && (
                <ul className="mt-2 divide-y divide-line text-sm">
                  {obs.pendencias.map((x) => (
                    <li key={x.id} className="py-2 flex justify-between gap-2">
                      <div>
                        <p className={`font-bold ${x.status === "descartada" ? "line-through text-fg" : ""}`}>{x.nome}</p>
                        <p className="text-xs text-fg">{fmtQtd(x.quantidade)} {x.unidade} · {estoquePorId.get(x.estoque_id)?.nome || "local não informado"} · <b>{x.status === "resolvida" ? "CADASTRADO" : x.status === "descartada" ? "DESCARTADO" : "PENDENTE DE CADASTRO"}</b></p>
                      </div>
                      {(x.status || "pendente") === "pendente" && (
                        <div className="flex gap-1 self-start">
                          <button onClick={() => mudarPendencia(x.id, "resolvida")} className="px-2 py-1 rounded-lg bg-emerald-100 text-emerald-800 text-3xs font-black">Cadastrado e contado</button>
                          <button onClick={() => mudarPendencia(x.id, "descartada")} className="px-2 py-1 rounded-lg bg-stone-200 text-3xs font-black">Descartar</button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-3xs text-fg mt-2">Não cria produto no cadastro. Para entrar no valor do inventário, cadastre o produto e conte-o na lista; depois marque “Cadastrado e contado”.</p>
            </div>

            {podeFechar && <button onClick={cancelar} className="text-xs font-bold text-fg underline">Cancelar este inventário</button>}
          </>
        )}
      </div>

      {aberta && podeFechar && (
        <div className="fixed bottom-0 inset-x-0 z-30 bg-white/95 border-t border-line p-3">
          <div className="max-w-5xl mx-auto">
            <button onClick={() => setModal({ tipo: "finalizar", etapa: 1 })} className="w-full h-14 rounded-2xl bg-slate-900 text-white font-black text-base flex items-center justify-center gap-2">
              <ClipboardList size={20} /> Finalizar inventário
            </button>
          </div>
        </div>
      )}

      {modal?.tipo === "pendencia" && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-end sm:items-center justify-center sm:p-4">
          <form onSubmit={salvarPendencia} className="bg-card w-full max-w-md rounded-t-3xl sm:rounded-3xl p-5 space-y-3">
            <div className="flex justify-between"><h3 className="font-black text-lg">Produto não cadastrado</h3><button type="button" onClick={() => setModal(null)} aria-label="Fechar"><X size={20} /></button></div>
            <p className="text-xs text-fg">Fica registrado como PENDENTE DE CADASTRO neste inventário. Nenhum produto é criado.</p>
            <input required value={modal.nome} onChange={(e) => setModal({ ...modal, nome: e.target.value })} placeholder="Nome do produto" className="w-full h-12 px-3 rounded-xl border border-line bg-white font-bold" />
            <div className="grid grid-cols-2 gap-2">
              <input required inputMode="decimal" value={modal.quantidade} onChange={(e) => setModal({ ...modal, quantidade: e.target.value })} placeholder="Quantidade" className="h-12 px-3 rounded-xl border border-line bg-white font-bold text-lg" />
              <select value={modal.unidade} onChange={(e) => setModal({ ...modal, unidade: e.target.value })} className="h-12 px-3 rounded-xl border border-line bg-white font-bold">
                {UNIDADES_PENDENCIA.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <select value={modal.estoque_id} onChange={(e) => setModal({ ...modal, estoque_id: e.target.value })} className="w-full h-12 px-3 rounded-xl border border-line bg-white font-bold">
              <option value="">Local não informado</option>
              {estoques.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
            </select>
            <button disabled={processando} className="w-full h-12 bg-emerald-500 text-white font-black rounded-2xl disabled:opacity-60">{processando ? "Registrando..." : "Registrar pendência"}</button>
          </form>
        </div>
      )}

      {modal?.tipo === "zero" && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-end sm:items-center justify-center sm:p-4">
          <div className="bg-card w-full max-w-md rounded-t-3xl sm:rounded-3xl p-5 space-y-3">
            <div className="flex justify-between"><h3 className="font-black text-lg">Produto zerado?</h3><button type="button" onClick={() => setModal(null)} aria-label="Fechar"><X size={20} /></button></div>
            <p className="text-sm"><b>{modal.p.insumo?.nome}</b>{estoquePorId.get(modal.estoqueId)?.nome ? <> em <b>{estoquePorId.get(modal.estoqueId).nome}</b></> : null}: não há nenhuma unidade?</p>
            <p className="text-xs text-fg">Grava ZERO de verdade. Produto que você não olhou NÃO é zero: deixe sem contar. Depois de confirmado, só o administrador corrige.</p>
            <button onClick={() => { registrar(modal.p, "0", modal.estoqueId, "produto zerado (confirmado)"); setModal(null); }}
              className="w-full h-14 bg-slate-900 text-white font-black rounded-2xl">CONFIRMAR PRODUTO ZERADO</button>
            <button onClick={() => setModal(null)} className="w-full h-11 rounded-2xl bg-slate-100 font-bold">Voltar</button>
          </div>
        </div>
      )}

      {modal?.tipo === "corrigir" && (
        <ModalCorrigir p={modal.p} item={modal.item} onFechar={() => setModal(null)} onFeito={async () => { setModal(null); await carregar(); }} />
      )}

      {modal?.tipo === "finalizar" && (
        <Finalizar id={id} unidade={unidade} contagem={contagem} sessao={sessao} estMov={estMov} itens={[...itens.values()]} produtos={produtos} estoques={estoques} pendencias={obs.pendencias}
          fila={fila} insumoPorId={insumoPorId} custosMedios={base?.custosMedios || {}} etapa={modal.etapa}
          onEtapa={(etapa) => setModal({ ...modal, etapa })} onFechar={() => setModal(null)} onFechado={async () => { setModal(null); await carregar(); }} />
      )}
    </div>
  );
}

// Garrafa, saco, galão: quem conta vê embalagens, não ml. "3 fechadas + 200 ml"
// vira a quantidade do cadastro na hora de gravar (inventario-saldo.mjs).
function emEmbalagens(qtd, insumo) {
  const c = conteudoDe(insumo);
  // Garrafa cadastrada em "garrafa": a quantidade vem em garrafas; em ml/g/kg, em conteúdo.
  const totalConteudo = ehUnidadeContavel(insumo?.unidade_medida) ? Number(qtd) * c : Number(qtd);
  const fechadas = Math.floor(totalConteudo / c + 1e-9);
  const aberto = Math.round((totalConteudo - fechadas * c) * 1000) / 1000;
  return { fechadas, aberto };
}

function LinhaProduto({ p, contado, pendente, valor, onValor, onConfirmar, refInput, mostrarLocal, desabilitado = false,
  onZero, onCorrigir, mostrarSistema = false, mostrarDivergencia = false, admin = false }) {
  const um = p.insumo?.unidade_medida;
  const uc = unidadeContagem(um);
  const frac = ehFracionavel(p.insumo);
  const qtd = contado ? (pendente ? Number(contado.quantidade) : daBase(contado.quantidade_contada, um)) : null;
  const emb = frac && qtd != null ? emEmbalagens(qtd, p.insumo) : null;
  const unAberta = frac ? unidadeDoConteudo(p.insumo) : "";
  const v = frac ? (valor && typeof valor === "object" ? valor : { fechadas: "", aberto: "" }) : (typeof valor === "string" ? valor : "");
  const vazio = frac ? v.fechadas === "" && v.aberto === "" : v === "";
  const doBar = grupoDoEstoque(p.estoque) === "bar";
  const status = contado && !pendente ? statusItemContagem(contado, { mostrarDivergencia }) : (contado ? "contado" : "nao_contado");
  const sistemaCad = contado?.quantidade_sistema != null ? daBase(contado.quantidade_sistema, um) : null;
  const confirmar = () => {
    if (!frac) {
      if (!v.includes("+")) return onConfirmar(v, "");
      const soma = lerSoma(v);
      if (!Number.isFinite(soma)) return alert(`${p.insumo?.nome}: soma inválida. Ex.: 6+4`);
      return onConfirmar(String(soma), `${v.replace(/\s+/g, "")} = ${fmtQtd(soma)} ${uc.rotulo}`);
    }
    const q = quantidadeDeEmbalagens(v, p.insumo);
    if (q.erro) return alert(`${p.insumo?.nome}: ${q.erro}`);
    onConfirmar(String(q.valor), `${lerSoma(v.fechadas) || 0} fechada(s) + ${fmtQtd(lerSoma(v.aberto) || 0)} ${unAberta}`);
  };
  const enter = (e) => { if (e.key === "Enter" && !vazio) { e.preventDefault(); confirmar(); } };
  const sistemaVisivel = !contado && mostrarSistema ? saldoParaCadastro(p.quantidade_atual, p.insumo) : null;
  return (
    <div className={`rounded-2xl border p-3 ${contado ? "bg-emerald-50 border-emerald-200" : "bg-white border-line"}`}>
      <div className="flex justify-between gap-2">
        <div className="min-w-0">
          <p className="font-black text-base leading-tight">{p.insumo?.nome}</p>
          <p className="text-xs text-slate-600 truncate">
            {frac ? <>Embalagem de <b>{fmtQtd(conteudoDe(p.insumo))} {unAberta}</b></> : <>Unidade: <b>{uc.rotulo}</b></>}
            {p.insumo?.codigo_interno ? ` · cód. ${p.insumo.codigo_interno}` : ""}{p.insumo?.categoria ? ` · ${p.insumo.categoria}` : ""}{mostrarLocal && p.estoque ? ` · ${p.estoque.nome}` : ""}
          </p>
          {sistemaVisivel != null && <p className="text-3xs font-bold text-slate-500">Sistema: {fmtQtd(sistemaVisivel)} {uc.rotulo}</p>}
        </div>
        <span className={`shrink-0 self-start px-2 py-0.5 rounded-full text-3xs font-black uppercase ${COR_STATUS_ITEM[status]}`}>{ROTULO_STATUS_ITEM[status]}</span>
      </div>
      {contado ? (
        // Contado: o funcionário não corrige nem apaga. Só o administrador, com PIN.
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm min-w-0">
            <p className="font-black text-emerald-800 flex items-center gap-1">
              <Check size={14} />{emb ? `${emb.fechadas} fechada(s) + ${fmtQtd(emb.aberto)} ${unAberta}` : `${fmtQtd(qtd)} ${uc.rotulo}`}{pendente ? " · aguardando envio" : ""}
            </p>
            {emb && <p className="text-xs font-bold text-emerald-700">= {fmtQtd(qtd)} {uc.rotulo}</p>}
            {contado.observacao && <p className="text-3xs text-slate-500">{String(contado.observacao).split(" · ").filter((x) => !x.startsWith("custo: ")).join(" · ")}</p>}
            {mostrarDivergencia && sistemaCad != null && !pendente && (
              <p className="text-3xs font-bold">Sistema na contagem: {fmtQtd(sistemaCad)} {uc.rotulo} · diferença {qtd - sistemaCad > 0 ? "+" : ""}{fmtQtd(Math.round((qtd - sistemaCad) * 1000) / 1000)} {uc.rotulo}</p>
            )}
          </div>
          {admin && !pendente && contado.id && (
            <button onClick={() => onCorrigir?.(contado)} className="h-9 px-3 rounded-xl bg-white border border-line text-xs font-black flex items-center gap-1"><Lock size={12} /> Corrigir</button>
          )}
        </div>
      ) : (
        <>
          {/* Garrafa/saco: os dois campos ganham a linha inteira no celular, senão a
              dica some cortada ao lado dos botões. */}
          <div className="mt-2 flex flex-wrap gap-2">
            <div className={`flex min-w-0 gap-2 ${frac ? "basis-full sm:basis-0 sm:flex-1" : "flex-1"}`}>
              {frac ? (
                <>
                  <input ref={refInput} inputMode="text" enterKeyHint="next" disabled={desabilitado} value={v.fechadas} onChange={(e) => onValor({ ...v, fechadas: e.target.value })} onKeyDown={enter}
                    placeholder="fechadas" aria-label="Embalagens fechadas" className="w-0 flex-1 min-w-0 h-12 px-3 rounded-xl border border-line bg-white font-black text-lg placeholder:text-sm placeholder:font-semibold disabled:opacity-50" />
                  <input inputMode="decimal" enterKeyHint="next" disabled={desabilitado} value={v.aberto} onChange={(e) => onValor({ ...v, aberto: e.target.value })} onKeyDown={enter}
                    placeholder={`aberta (${unAberta})`} aria-label={`Quanto tem na aberta, em ${unAberta}`} className="w-0 flex-1 min-w-0 h-12 px-3 rounded-xl border border-line bg-white font-black text-lg placeholder:text-sm placeholder:font-semibold disabled:opacity-50" />
                </>
              ) : (
                <input ref={refInput} inputMode={doBar ? "text" : "decimal"} enterKeyHint="next" disabled={desabilitado} value={v} onChange={(e) => onValor(e.target.value)} onKeyDown={enter}
                  placeholder={`quantidade (${uc.rotulo})`} className="w-0 flex-1 min-w-0 h-12 px-3 rounded-xl border border-line bg-white font-black text-lg placeholder:text-sm placeholder:font-semibold disabled:opacity-50" />
              )}
            </div>
            <button disabled={desabilitado || vazio} onClick={confirmar} className={`h-12 px-3 sm:px-4 rounded-xl bg-emerald-600 text-white font-black text-sm disabled:opacity-40 flex items-center justify-center gap-1 ${frac ? "flex-1 sm:flex-none" : ""}`}><Check size={16} /> Contado</button>
            <button disabled={desabilitado} onClick={() => onZero?.()} className="h-12 px-3 rounded-xl bg-slate-200 font-black text-sm disabled:opacity-40">Zero</button>
          </div>
          {doBar && <p className="mt-1.5 text-xs font-semibold text-slate-500">Expositor e depósito: conte cada um e some no campo, ex.: 6+4.</p>}
        </>
      )}
    </div>
  );
}

const COR_STATUS_ITEM = {
  nao_contado: "bg-stone-100 text-stone-700", contado: "bg-emerald-100 text-emerald-800",
  divergencia: "bg-amber-100 text-amber-900", revisao: "bg-sky-100 text-sky-900",
};

// Correção de produto já contado: só administrador, com PIN (o banco confere).
// Quantidade como na contagem: embalagens + fração (garrafa: fechadas + ml).
function ModalCorrigir({ p, item, onFechar, onFeito }) {
  const um = p.insumo?.unidade_medida;
  const uc = unidadeContagem(um);
  const emb = embalagemDoProduto(p.insumo);
  const unidades = unidadesDaFracao(p.insumo);
  const [v, setV] = useState({ emb: "", frac: "", uf: emb && unidades.length > 1 ? unidades[1] : unidades[0] });
  const [zero, setZero] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [pin, setPin] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  const lanc = !zero && (v.emb !== "" || v.frac !== "") ? quantidadeDoLancamento({ insumo: p.insumo, embalagens: v.emb, fracao: v.frac, unidadeFracao: v.uf }) : null;
  // a contagem é na unidade do cadastro (garrafa fracionada: garrafas)
  const quantidade = zero ? 0 : (lanc && !lanc.erro ? lanc.quantidade : null);
  const enviar = async (e) => {
    e.preventDefault();
    if (enviando || quantidade == null) return;
    setEnviando(true); setErro("");
    const r = await corrigirProdutoContado({ item_id: item.id, quantidade, justificativa: motivo, pin });
    setEnviando(false);
    if (r.error) { setErro(r.error); if (r.pin) setPin(""); return; }
    onFeito();
  };
  const campo = "h-12 px-2 rounded-xl border border-line bg-white font-black text-lg disabled:opacity-50";
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-end sm:items-center justify-center sm:p-4">
      <form onSubmit={enviar} className="bg-card w-full max-w-md rounded-t-3xl sm:rounded-3xl p-5 space-y-3">
        <div className="flex justify-between"><h3 className="font-black text-lg flex items-center gap-2"><Lock size={18} /> Corrigir contagem</h3><button type="button" onClick={onFechar} aria-label="Fechar"><X size={20} /></button></div>
        <p className="text-sm"><b>{p.insumo?.nome}</b> · contado {fmtQtd(daBase(item.quantidade_contada, um))} {uc.rotulo}</p>
        <div className="flex gap-2">
          {emb && <input inputMode="text" disabled={zero} value={v.emb} onChange={(e) => setV({ ...v, emb: e.target.value })} placeholder={emb.emConteudo ? "fechadas" : emb.nome} aria-label={`Embalagens (${emb.texto})`} className={`w-24 min-w-0 ${campo}`} />}
          <input inputMode="decimal" disabled={zero} value={v.frac} onChange={(e) => setV({ ...v, frac: e.target.value })} placeholder={emb ? "+ fração" : "quantidade"} className={`flex-1 min-w-0 ${campo}`} />
          {unidades.length > 1
            ? <select disabled={zero} value={v.uf} onChange={(e) => setV({ ...v, uf: e.target.value })} className="h-12 px-1 rounded-xl border border-line bg-white font-black text-sm">{unidades.map((u) => <option key={u} value={u}>{u}</option>)}</select>
            : <span className="h-12 px-2 rounded-xl bg-slate-100 font-black text-sm flex items-center">{unidades[0]}</span>}
        </div>
        <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={zero} onChange={(e) => setZero(e.target.checked)} /> Não tem nenhum (zero)</label>
        {lanc?.erro && <p className="text-xs font-bold text-red-700">{lanc.erro}</p>}
        {quantidade != null && <p className="text-sm font-black">Nova quantidade: {fmtQtd(quantidade)} {uc.rotulo}{lanc?.texto ? ` (${lanc.texto})` : ""}</p>}
        <input required value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Motivo da correção" className="w-full h-12 px-3 rounded-xl border border-line bg-white font-bold" />
        <input required type="password" inputMode="numeric" autoComplete="off" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))} placeholder="PIN do administrador" className="w-full h-12 px-3 rounded-xl border border-line bg-white font-black tracking-widest" />
        {erro && <p className="text-sm font-bold text-red-700">{erro}</p>}
        <p className="text-3xs text-fg">A correção fica registrada na linha (de quanto para quanto, quem e por quê).</p>
        <button disabled={enviando || quantidade == null} className="w-full h-12 bg-slate-900 text-white font-black rounded-2xl disabled:opacity-40 flex items-center justify-center gap-2">
          {enviando ? <><Loader2 size={18} className="animate-spin" /> Corrigindo...</> : "Corrigir com PIN"}
        </button>
      </form>
    </div>
  );
}

// ═══ FINALIZAR: resumo → valorização → fechar ═══════════════════════════════
function Finalizar({ id, unidade, contagem, sessao, estMov = false, itens, produtos, estoques, pendencias, fila, insumoPorId, custosMedios, etapa, onEtapa, onFechar, onFechado }) {
  const resumo = resumoFechamento({ produtos, itens, pendencias, estoques });
  const [ciente, setCiente] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  const [processando, setProcessando] = useState(false);
  const comQtd = itens.filter((i) => Number(i.quantidade_contada) > 0);
  const sugestoes = useMemo(() => Object.fromEntries(comQtd.map((i) => [i.id, custoSugerido(insumoPorId.get(i.insumo_id), custosMedios[i.insumo_id])])), [itens]); // eslint-disable-line react-hooks/exhaustive-deps
  const [custos, setCustos] = useState({});
  const aplicar = (situacoes) => setCustos((c) => {
    const n = { ...c };
    for (const i of comQtd) {
      const s = sugestoes[i.id];
      if (situacoes.includes(s.situacao) && s.porUnidade != null && n[i.id] == null) {
        n[i.id] = { porUnidade: String(Math.round(s.porUnidade * 10000) / 10000).replace(".", ","), origem: `${s.origem}${s.data ? `, preço de ${fmtData(s.data)}` : ""}` };
      }
    }
    return n;
  });
  const faltando = comQtd.filter((i) => { const c = custos[i.id]; return !c || c.porUnidade === "" || !Number.isFinite(lerValor(c.porUnidade)) || lerValor(c.porUnidade) < 0; });
  const total = comQtd.reduce((s, i) => {
    const c = custos[i.id]; const v = c ? lerValor(c.porUnidade) : NaN;
    return Number.isFinite(v) ? s + daBase(i.quantidade_contada, insumoPorId.get(i.insumo_id)?.unidade_medida) * v : s;
  }, 0);
  const unidadesPorInsumo = Object.fromEntries(itens.map((i) => [i.insumo_id, insumoPorId.get(i.insumo_id)?.unidade_medida]));

  const fechar = async () => {
    if (processando) return;
    setProcessando(true);
    const r = await finalizarContagem({ contagem_id: id, itens, unidadesPorInsumo, custos, confirmado: confirmar });
    if (r.error) { setProcessando(false); return alert(`Não foi possível fechar: ${r.error}`); }
    if (estMov) {
      // Banco atualizado (EST-MOV): o saldo muda pelo AJUSTE autorizado, com PIN,
      // na tela do inventário fechado (contado − sistema na hora da contagem).
      setProcessando(false);
      alert("Inventário FECHADO. Quantidades e custos estão congelados.\n\nPara o saldo do estoque: o administrador abre este inventário e confirma o ajuste com o PIN.");
      return onFechado();
    }
    // Fechou: o contado vira o saldo do estoque (só o que foi contado).
    const a = await aplicarInventarioAoSaldo({
      unidadeId: unidade, contagem: { ...contagem, status: "fechada" }, itens, insumoPorId, daBase,
      usuarioId: sessao?.id || sessao?.user?.id || null, usuarioNome: nomeUsuario(sessao),
    });
    setProcessando(false);
    const linhas = ["Inventário FECHADO. Quantidades e custos estão congelados."];
    if (a.error) linhas.push(`O saldo do estoque não foi atualizado: ${a.error}. Abra o inventário e toque em "Aplicar ao saldo".`);
    else {
      linhas.push(`Saldo do estoque atualizado em ${a.data.aplicados + a.data.jaEstavam} produto(s).`);
      if (a.data.falhas.length) linhas.push(`${a.data.falhas.length} produto(s) não foram para o saldo (${a.data.falhas.slice(0, 3).map((x) => x.nome).join(", ")}…): abra o inventário e toque em "Aplicar ao saldo".`);
      if (a.data.semLocal.length) linhas.push(`${a.data.semLocal.length} produto(s) contados sem local ficaram fora do saldo.`);
    }
    alert(linhas.join("\n\n"));
    onFechado();
  };
  const BADGE = { ok: ["conferido", "bg-emerald-100 text-emerald-800"], unico: ["sem conferência", "bg-amber-100 text-amber-800"], divergente: ["cadastro divergente", "bg-red-100 text-red-800"], sem_custo: ["sem custo", "bg-stone-200 text-stone-700"] };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-end sm:items-center justify-center sm:p-4">
      <div className="bg-card w-full max-w-3xl rounded-t-3xl sm:rounded-3xl max-h-[94vh] flex flex-col">
        <div className="p-5 pb-3 border-b border-line flex justify-between">
          <div><p className="text-3xs font-black uppercase text-fg">Finalizar inventário · etapa {etapa} de 2</p><h3 className="font-black text-lg">{etapa === 1 ? "Resumo da contagem" : "Valorização e fechamento"}</h3></div>
          <button onClick={onFechar} disabled={processando} aria-label="Fechar"><X size={20} /></button>
        </div>
        <div className="p-5 overflow-y-auto space-y-3">
          {fila.length > 0 && <p className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm font-bold text-red-800">Há {fila.length} contagem(ns) ainda não enviada(s). Conecte o aparelho e espere o envio antes de finalizar.</p>}
          {etapa === 1 && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                {[["Produtos contados", resumo.contadosTotal], ["Contados como zero", resumo.zerados], ["Não contados", resumo.naoContados], ["Pendências de cadastro", resumo.pendencias]].map(([r, v]) => (
                  <div key={r} className="bg-white rounded-xl p-3 border border-line"><p className="text-xs text-fg font-bold">{r}</p><p className="text-2xl font-black">{v}</p></div>
                ))}
              </div>
              <table className="w-full text-xs">
                <thead><tr className="text-left text-fg"><th className="py-1">Local</th><th>Contados</th><th>Não contados</th></tr></thead>
                <tbody>{resumo.porLocal.map((l) => <tr key={l.estoque_id} className="border-t border-line"><td className="py-1 font-bold">{l.nome}</td><td>{l.contados + l.foraDaLista}</td><td className={l.naoContados ? "text-amber-700 font-black" : ""}>{l.naoContados}</td></tr>)}</tbody>
              </table>
              {resumo.precisaConfirmar && (
                <label className="flex gap-2 items-start rounded-2xl border border-amber-300 bg-amber-50 p-3 text-sm">
                  <input type="checkbox" checked={ciente} onChange={(e) => setCiente(e.target.checked)} className="mt-1" />
                  <span><b>Estou ciente:</b> {resumo.naoContados > 0 && <>{resumo.naoContados} produto(s) NÃO foram contados e ficam FORA deste inventário (não viram zero). </>}{resumo.pendencias > 0 && <>{resumo.pendencias} produto(s) sem cadastro ficam fora do valor.</>}</span>
                </label>
              )}
              <button disabled={fila.length > 0 || !resumo.contadosTotal || (resumo.precisaConfirmar && !ciente)} onClick={() => onEtapa(2)}
                className="w-full h-12 rounded-2xl bg-slate-900 text-white font-black disabled:opacity-40">Continuar para valorização</button>
            </>
          )}
          {etapa === 2 && (
            <>
              <p className="text-xs text-fg">O custo de cada produto é congelado no fechamento. Use o custo conferido do cadastro ou informe. Itens contados como zero não precisam de custo.</p>
              <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-bold text-emerald-900">Ao fechar, o saldo do estoque de cada produto contado passa a ser a quantidade contada, com histórico (saldo anterior → contado, quem e quando). Produtos não contados não mudam.</p>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => aplicar(["ok"])} className="h-10 px-3 rounded-xl bg-emerald-500 text-white text-xs font-black">Usar custos conferidos</button>
                <button onClick={() => aplicar(["ok", "unico"])} className="h-10 px-3 rounded-xl bg-amber-100 text-amber-900 text-xs font-black">Usar também custos sem conferência</button>
              </div>
              <ul className="divide-y divide-line text-sm">
                {comQtd.map((i) => {
                  const ins = insumoPorId.get(i.insumo_id);
                  const uc = unidadeContagem(ins?.unidade_medida);
                  const s = sugestoes[i.id];
                  const [rot, cor] = BADGE[s.situacao];
                  const c = custos[i.id];
                  return (
                    <li key={i.id} className="py-2">
                      <div className="flex justify-between gap-2">
                        <p className="font-bold">{ins?.nome} <span className="text-xs text-fg font-normal">· {fmtQtd(daBase(i.quantidade_contada, ins?.unidade_medida))} {uc.rotulo}</span></p>
                        <span className={`px-2 py-0.5 rounded-full text-3xs font-black uppercase self-start ${cor}`}>{rot}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        <span className="text-xs">R$</span>
                        <input inputMode="decimal" value={c?.porUnidade ?? ""} onChange={(e) => setCustos({ ...custos, [i.id]: { porUnidade: e.target.value, origem: "informado no fechamento" } })}
                          placeholder="custo" className="w-28 h-10 px-2 rounded-lg border border-line bg-white font-black" />
                        <span className="text-xs text-fg">por {uc.rotulo}</span>
                        {s.opcoes.map((o, k) => (
                          <button key={k} onClick={() => setCustos({ ...custos, [i.id]: { porUnidade: String(Math.round(o.valor * 10000) / 10000).replace(".", ","), origem: `${o.origem}${s.data ? `, preço de ${fmtData(s.data)}` : ""}` } })}
                            className="px-2 py-1 rounded-lg bg-slate-100 text-3xs font-bold">{fmtBRL(o.valor, o.valor < 1 ? 4 : 2)} · {o.origem}</button>
                        ))}
                      </div>
                    </li>
                  );
                })}
              </ul>
              <div className="rounded-2xl bg-slate-50 p-3 text-sm flex justify-between"><span>Valor do inventário (com os custos acima)</span><b>{fmtBRL(total)}</b></div>
              {faltando.length > 0 && <p className="text-sm font-bold text-amber-700">{faltando.length} produto(s) ainda sem custo.</p>}
              <label className="flex gap-2 items-start rounded-2xl border border-slate-300 p-3 text-sm">
                <input type="checkbox" checked={confirmar} onChange={(e) => setConfirmar(e.target.checked)} className="mt-1" />
                <span><Lock size={14} className="inline" /> Fechar o inventário: quantidades e custos ficam <b>congelados</b>. Correções depois só por ajuste.</span>
              </label>
              <div className="flex gap-2">
                <button onClick={() => onEtapa(1)} disabled={processando} className="h-12 px-4 rounded-2xl bg-slate-100 font-bold">Voltar</button>
                <button onClick={fechar} disabled={processando || faltando.length > 0 || !confirmar || fila.length > 0} className="flex-1 h-12 rounded-2xl bg-emerald-500 text-white font-black disabled:opacity-40 flex items-center justify-center gap-2">
                  {processando ? <><Loader2 size={18} className="animate-spin" /> Fechando...</> : "Fechar inventário"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══ DIVERGÊNCIAS E AJUSTE DO ESTOQUE (inventário fechado) ═════════════════
// Inventário ≠ movimentação: aqui se vê sistema × contado × diferença e o
// impacto em R$. O saldo só muda quando o administrador ajusta, com PIN.
function AjusteInventario({ contagem, unidade, itens, insumoPorId, estoquePorId, admin }) {
  const [ajustes, setAjustes] = useState({ data: [], legado: new Set(), desatualizado: false });
  const [modal, setModal] = useState(null);
  const [resultado, setResultado] = useState(null);
  const carregar = useCallback(async () => {
    const r = await fetchAjustesDoInventario(contagem.id, unidade);
    setAjustes({ data: r.data || [], legado: r.legado || new Set(), desatualizado: !!r.desatualizado });
  }, [contagem.id, unidade]);
  useEffect(() => { carregar(); }, [carregar]);
  // ajustado pela EST-MOV (ligado ao item) ou já aplicado pelo caminho anterior (fechar → acerto de contagem)
  const ajustados = new Set([
    ...ajustes.data.filter((a) => a.inventario_item_id).map((a) => a.inventario_item_id),
    ...itens.filter((i) => ajustes.legado.has(`${i.estoque_id}|${i.insumo_id}`)).map((i) => i.id),
  ]);
  const imp = impactoDivergencias(itens);
  const linhas = [...imp.linhas].sort((a, b) => a.valor - b.valor);
  const pendentes = linhas.filter((l) => !ajustados.has(l.id)).length;

  const enviar = async (e) => {
    e.preventDefault();
    if (modal.enviando) return;
    setModal({ ...modal, enviando: true, erro: "" });
    const r = await ajustarPeloInventario({ contagem_id: contagem.id, justificativa: modal.justificativa, pin: modal.pin });
    if (r.error) return setModal({ ...modal, enviando: false, erro: r.error, pin: r.pin ? "" : modal.pin });
    setModal(null); setResultado(r.data); await carregar();
  };

  return (
    <div className="bg-card rounded-2xl border border-line p-3 space-y-2">
      <p className="font-black text-sm flex items-center gap-2"><Scale size={16} /> Divergências e ajuste do estoque</p>
      <p className="text-3xs text-fg">Sistema = saldo do Controle de Estoque na hora em que cada produto foi contado. O impacto usa o custo congelado no fechamento. Produto não contado não entra (não vira zero).</p>
      <div className="grid grid-cols-3 gap-2 text-center">
        {[["Faltou (R$)", imp.perdas, "text-red-700"], ["Sobrou (R$)", imp.sobras, "text-emerald-700"], ["Resultado (R$)", imp.liquido, imp.liquido < 0 ? "text-red-700" : "text-emerald-700"]].map(([r, v, cor]) => (
          <div key={r} className="rounded-xl bg-white border border-line p-2"><p className="text-3xs font-black uppercase text-fg">{r}</p><p className={`font-black ${cor}`}>{fmtBRL(v)}</p></div>
        ))}
      </div>
      <p className="text-3xs text-fg">{imp.comDiferenca} produto(s) com diferença{imp.semReferencia ? ` · ${imp.semReferencia} sem saldo do sistema guardado (fora da conta)` : ""}.</p>
      {linhas.length > 0 && (
        <div className="overflow-x-auto"><table className="w-full text-xs">
          <thead><tr className="text-left text-fg"><th className="py-1">Produto</th><th>Local</th><th className="text-right">Sistema</th><th className="text-right">Contado</th><th className="text-right">Diferença</th><th className="text-right">R$</th><th className="text-right">Estoque</th></tr></thead>
          <tbody>{linhas.map((l) => {
            const it = itens.find((i) => i.id === l.id); const um = insumoPorId.get(l.insumo_id)?.unidade_medida; const rot = unidadeContagem(um).rotulo;
            return (
              <tr key={l.id} className="border-t border-line">
                <td className="py-1 font-bold">{insumoPorId.get(l.insumo_id)?.nome || "—"}</td>
                <td>{estoquePorId.get(l.estoque_id)?.nome || "—"}</td>
                <td className="text-right">{fmtQtd(daBase(it?.quantidade_sistema, um))} {rot}</td>
                <td className="text-right">{fmtQtd(daBase(it?.quantidade_contada, um))} {rot}</td>
                <td className={`text-right font-black ${l.diferenca < 0 ? "text-red-700" : "text-emerald-700"}`}>{l.diferenca > 0 ? "+" : ""}{fmtQtd(daBase(l.diferenca, um))} {rot}</td>
                <td className={`text-right font-black ${l.valor < 0 ? "text-red-700" : "text-emerald-700"}`}>{fmtBRL(l.valor)}</td>
                <td className="text-right">{ajustados.has(l.id) ? "ajustado" : "a ajustar"}</td>
              </tr>);
          })}</tbody>
        </table></div>
      )}
      {ajustes.desatualizado && <p className="text-xs font-bold text-amber-800">O banco ainda não recebeu a atualização do estoque (EST-MOV): o ajuste fica disponível depois dela.</p>}
      {admin && !ajustes.desatualizado && contagem.status === "fechada" && (
        <button onClick={() => setModal({ justificativa: `Inventário de ${fmtData(contagem.data_referencia)}`, pin: "", erro: "", enviando: false })} disabled={!pendentes}
          className="w-full h-12 rounded-2xl bg-slate-900 text-white font-black disabled:opacity-40 flex items-center justify-center gap-2">
          <Lock size={16} /> {pendentes ? `Ajustar o estoque pelo inventário (${pendentes})` : "Estoque já ajustado por este inventário"}
        </button>
      )}
      {!admin && pendentes > 0 && <p className="text-3xs text-fg">O ajuste do saldo é feito pelo administrador, com PIN.</p>}
      {resultado && (
        <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-2 text-xs space-y-1">
          <p className="font-black">{resultado.ajustados} produto(s) ajustado(s).</p>
          {(resultado.itens || []).filter((i) => i.status !== "ajustado" && i.status !== "sem_diferenca").map((i) => <p key={i.item_id}>{i.nome}: {STATUS_AJUSTE[i.status] || i.status}</p>)}
        </div>
      )}
      {modal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-end sm:items-center justify-center sm:p-4">
          <form onSubmit={enviar} className="bg-card w-full max-w-md rounded-t-3xl sm:rounded-3xl p-5 space-y-3">
            <div className="flex justify-between"><h3 className="font-black text-lg flex items-center gap-2"><Scale size={18} /> Ajustar o estoque</h3><button type="button" onClick={() => setModal(null)} aria-label="Fechar"><X size={20} /></button></div>
            <p className="text-sm">Lança entrada/retirada de ajuste para cada produto com diferença ({pendentes}). Impacto: <b>{fmtBRL(imp.liquido)}</b>.</p>
            <p className="text-3xs text-fg">O que entrou ou saiu depois da contagem continua valendo. Nada é apagado: cada ajuste fica no histórico, ligado a este inventário.</p>
            <input required value={modal.justificativa} onChange={(e) => setModal({ ...modal, justificativa: e.target.value })} placeholder="Motivo" className="w-full h-12 px-3 rounded-xl border border-line bg-white font-bold" />
            <input required type="password" inputMode="numeric" autoComplete="off" value={modal.pin} onChange={(e) => setModal({ ...modal, pin: e.target.value.replace(/\D/g, "").slice(0, 8) })} placeholder="PIN do administrador" className="w-full h-12 px-3 rounded-xl border border-line bg-white font-black tracking-widest" />
            {modal.erro && <p className="text-sm font-bold text-red-700">{modal.erro}</p>}
            <button disabled={modal.enviando} className="w-full h-12 bg-slate-900 text-white font-black rounded-2xl disabled:opacity-60 flex items-center justify-center gap-2">
              {modal.enviando ? <><Loader2 size={18} className="animate-spin" /> Ajustando...</> : "Confirmar ajuste com PIN"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

// ═══ INVENTÁRIO FECHADO: valores congelados + comparação ═══════════════════
function FechadoResumo({ contagem, itens, insumoPorId, estoquePorId, obs, unidade, sessao, podeAplicar, admin = false, estMov = false }) {
  const [anteriores, setAnteriores] = useState([]);
  const [noSaldo, setNoSaldo] = useState(null);
  const [maisRecente, setMaisRecente] = useState(null);
  const [aplicando, setAplicando] = useState(false);
  // itens chega como array novo a cada render: o efeito depende de chaves
  // estáveis (id, status, quantidade) e lê o resto pela ref, senão consultaria
  // o banco em laço.
  const atual = useRef({ contagem, itens, insumoPorId });
  atual.current = { contagem, itens, insumoPorId };
  const verSaldo = useCallback(async () => {
    const { contagem: c, itens: its, insumoPorId: ipi } = atual.current;
    if (c.status !== "fechada") return;
    const r = await situacaoNoSaldo({ unidadeId: unidade, contagem: c, itens: its, insumoPorId: ipi, daBase });
    setNoSaldo(r.error ? { erro: r.error } : r.data);
  }, [unidade]);
  useEffect(() => { verSaldo(); }, [verSaldo, contagem.id, contagem.status, itens.length, insumoPorId.size]);
  useEffect(() => {
    // Só o inventário fechado mais recente pode mandar no saldo: aplicar um
    // antigo por cima de um novo voltaria o estoque no tempo.
    fetchContagens(unidade).then((r) => setMaisRecente((r.data || []).find((c) => c.status === "fechada") || null));
  }, [unidade]);
  const ehOMaisRecente = !maisRecente || maisRecente.id === contagem.id;
  const aplicar = async () => {
    if (aplicando || !noSaldo?.faltando) return;
    if (!window.confirm(`O saldo de ${noSaldo.faltando} produto(s) vai passar a ser o contado em ${fmtData(contagem.data_referencia)}. Entradas e baixas lançadas depois dessa data ficam para trás. Continuar?`)) return;
    setAplicando(true);
    const r = await aplicarInventarioAoSaldo({ unidadeId: unidade, contagem, itens, insumoPorId, daBase, usuarioId: sessao?.id || sessao?.user?.id || null, usuarioNome: nomeUsuario(sessao) });
    setAplicando(false);
    if (r.error) alert(`Não foi possível aplicar: ${r.error}`);
    else if (r.data.falhas.length) alert(`${r.data.aplicados} produto(s) aplicados; ${r.data.falhas.length} falharam (${r.data.falhas.slice(0, 3).map((x) => `${x.nome}: ${x.erro}`).join("; ")}). Tente de novo.`);
    await verSaldo();
  };
  const [compara, setCompara] = useState("");
  const [itensAnt, setItensAnt] = useState([]);
  useEffect(() => {
    fetchContagens(unidade).then((r) => setAnteriores((r.data || []).filter((c) => c.status === "fechada" && c.id !== contagem.id && String(c.data_referencia) <= String(contagem.data_referencia))));
  }, [unidade, contagem.id, contagem.data_referencia]);
  useEffect(() => { if (compara) fetchItensContagem(compara).then((r) => setItensAnt(r.data || [])); else setItensAnt([]); }, [compara]);
  const v = valorContagem(itens);
  const ordenados = [...itens].sort((a, b) => String(insumoPorId.get(a.insumo_id)?.nome || "").localeCompare(String(insumoPorId.get(b.insumo_id)?.nome || ""), "pt-BR"));
  const cmp = compara ? compararContagens(itensAnt, itens) : [];
  return (
    <div className="space-y-3">
      <div className="bg-card rounded-2xl border border-line p-4 flex flex-wrap justify-between gap-3">
        <div>
          <p className="text-3xs font-black uppercase text-fg">{contagem.status === "fechada" ? `Fechado em ${fmtHora(contagem.fechada_em)}` : "Cancelado"}</p>
          <p className="text-2xl font-black">{fmtBRL(v.valor)}</p>
          <p className="text-xs text-fg">{itens.length} produto(s) · custo congelado no fechamento{obs.pendencias.length ? ` · ${obs.pendencias.length} produto(s) sem cadastro registrado(s)` : ""}</p>
        </div>
        {obs.nota && <p className="text-xs text-fg max-w-md">{obs.nota}</p>}
      </div>
      {contagem.status === "fechada" && estMov && <AjusteInventario contagem={contagem} unidade={unidade} itens={itens} insumoPorId={insumoPorId} estoquePorId={estoquePorId} admin={admin} />}
      {contagem.status === "fechada" && !estMov && noSaldo && (
        <div className={`rounded-2xl border p-4 text-sm ${noSaldo.erro ? "border-red-200 bg-red-50 text-red-800" : noSaldo.faltando ? "border-amber-300 bg-amber-50 text-amber-900" : "border-emerald-200 bg-emerald-50 text-emerald-900"}`}>
          {noSaldo.erro ? <p className="font-bold">Não consegui conferir o saldo do estoque: {noSaldo.erro}</p>
            : noSaldo.faltando === 0 ? <p className="font-bold">Saldo do estoque: os {noSaldo.total} produto(s) contados já estão no saldo, com o histórico do ajuste.</p>
            : (
              <div className="space-y-2">
                <p className="font-bold">Saldo do estoque: {noSaldo.aplicados} de {noSaldo.total} produto(s) contados estão no saldo.</p>
                {!ehOMaisRecente ? <p className="text-xs">Há um inventário fechado mais recente ({fmtData(maisRecente?.data_referencia)}): o saldo segue o mais recente.</p>
                  : podeAplicar ? (
                    <button onClick={aplicar} disabled={aplicando} className="h-11 px-4 rounded-xl bg-emerald-600 text-white font-black text-sm disabled:opacity-60">
                      {aplicando ? "Aplicando..." : `Aplicar ao saldo (${noSaldo.faltando})`}
                    </button>
                  ) : <p className="text-xs">Quem pode finalizar inventários aplica o contado ao saldo.</p>}
              </div>
            )}
          {noSaldo.semLocal?.length > 0 && <p className="mt-1 text-xs">{noSaldo.semLocal.length} produto(s) contado(s) sem local não entram no saldo.</p>}
        </div>
      )}
      <div className="bg-card rounded-2xl border border-line overflow-x-auto">
        <table className="w-full text-xs">
          <thead><tr className="text-left text-fg"><th className="p-2">Produto</th><th>Local</th><th className="text-right">Quantidade</th><th className="text-right">Custo</th><th className="text-right p-2">Valor</th></tr></thead>
          <tbody>{ordenados.map((i) => {
            const ins = insumoPorId.get(i.insumo_id); const uc = unidadeContagem(ins?.unidade_medida);
            return (
              <tr key={i.id} className="border-t border-line">
                <td className="p-2 font-bold">{ins?.nome || "—"}<span className="block text-3xs text-fg font-normal">{i.observacao || ""}</span></td>
                <td>{estoquePorId.get(i.estoque_id)?.nome || "—"}</td>
                <td className="text-right">{fmtQtd(daBase(i.quantidade_contada, ins?.unidade_medida))} {uc.rotulo}</td>
                <td className="text-right">{i.custo_unitario == null ? "—" : `${fmtBRL(Number(i.custo_unitario) * uc.fator, Number(i.custo_unitario) * uc.fator < 1 ? 4 : 2)}/${uc.rotulo}`}</td>
                <td className="text-right p-2 font-black">{i.valor_total == null ? "—" : fmtBRL(i.valor_total)}</td>
              </tr>);
          })}</tbody>
        </table>
      </div>
      {contagem.status === "fechada" && (
        <div className="bg-card rounded-2xl border border-line p-3 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-black text-sm">Comparar com</p>
            <select value={compara} onChange={(e) => setCompara(e.target.value)} className="h-10 px-2 rounded-xl border border-line bg-white text-xs font-bold">
              <option value="">escolha um inventário anterior</option>
              {anteriores.map((c) => <option key={c.id} value={c.id}>{fmtData(c.data_referencia)} — {tituloContagem(c)}</option>)}
            </select>
          </div>
          {compara && (
            <>
              <p className="text-3xs text-fg">Diferença FÍSICA entre as contagens. Não é consumo: pode haver compra, produção, perda, transferência, venda ou ajuste no meio.</p>
              <div className="overflow-x-auto"><table className="w-full text-xs">
                <thead><tr className="text-left text-fg"><th className="py-1">Produto</th><th>Local</th><th className="text-right">Anterior</th><th className="text-right">Atual</th><th className="text-right">Diferença</th></tr></thead>
                <tbody>{cmp.sort((a, b) => String(insumoPorId.get(a.insumo_id)?.nome || "").localeCompare(String(insumoPorId.get(b.insumo_id)?.nome || ""), "pt-BR")).map((l) => {
                  const um = insumoPorId.get(l.insumo_id)?.unidade_medida; const rot = unidadeContagem(um).rotulo;
                  return (
                    <tr key={`${l.insumo_id}-${l.estoque_id}`} className="border-t border-line">
                      <td className="py-1 font-bold">{insumoPorId.get(l.insumo_id)?.nome || "—"}</td>
                      <td>{estoquePorId.get(l.estoque_id)?.nome || "—"}</td>
                      <td className="text-right">{l.anterior == null ? "não contado" : `${fmtQtd(daBase(l.anterior, um))} ${rot}`}</td>
                      <td className="text-right">{l.atual == null ? "não contado" : `${fmtQtd(daBase(l.atual, um))} ${rot}`}</td>
                      <td className={`text-right font-black ${l.diferenca < 0 ? "text-red-700" : l.diferenca > 0 ? "text-emerald-700" : ""}`}>{l.diferenca == null ? "—" : `${l.diferenca > 0 ? "+" : ""}${fmtQtd(daBase(l.diferenca, um))} ${rot}`}</td>
                    </tr>);
                })}</tbody>
              </table></div>
            </>
          )}
        </div>
      )}
      {obs.pendencias.length > 0 && (
        <div className="bg-card rounded-2xl border border-line p-3 text-sm">
          <p className="font-black">Produtos sem cadastro registrados na contagem</p>
          {obs.pendencias.map((x) => <p key={x.id} className="text-xs">{x.nome} — {fmtQtd(x.quantidade)} {x.unidade} · {estoquePorId.get(x.estoque_id)?.nome || "local não informado"} · {x.status === "resolvida" ? "cadastrado" : x.status === "descartada" ? "descartado" : "pendente de cadastro"}</p>)}
        </div>
      )}
    </div>
  );
}
