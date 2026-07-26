"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  AlertTriangle, ArrowLeft, ArrowRightLeft, Boxes, CalendarDays, Check,
  ChevronRight, ClipboardCheck, Clock3, Edit3, Filter, History, Loader2,
  MapPin, MoreVertical, Package, PackageMinus, PackagePlus, Plus, Search,
  Settings2, Upload, Warehouse, X,
} from "lucide-react";
import { useERP } from "../../../context/ERPContext";
import { fetchInsumos, salvarInsumo } from "../../../lib/operacao";
import {
  atualizarItemEstoque, fetchEstoques, fetchItensEstoque, fetchMovimentosMulti,
  registrarContagemMulti, registrarMovimentoMulti, salvarEstoque,
  transferirEntreEstoques, vincularItemEstoque,
} from "../../../lib/estoques-multiplos";
import {
  filtrarItensEstoque, statusItemEstoque, TIPOS_ESTOQUE, tiposCompativeis,
} from "../../../lib/estoques-multiplos-utils.mjs";
import { fmtBRL } from "../../../components/ui";
import SimuladorRendimento from "../../../components/SimuladorRendimento";

const fmtQtd = (valor) => Number(valor || 0).toLocaleString("pt-BR", { maximumFractionDigits: 3 });
const fmtData = (valor, hora = false) => {
  if (!valor) return "—";
  return new Date(valor).toLocaleString("pt-BR", hora
    ? { dateStyle: "short", timeStyle: "short" }
    : { dateStyle: "short" });
};
const nomeUsuario = sessao => sessao?.nome || sessao?.user_metadata?.nome || sessao?.email || "Usuário do sistema";
const idUsuario = sessao => sessao?.id || sessao?.user?.id || null;

function Modal({ titulo, descricao, onClose, children, largo = false }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/45 p-0 backdrop-blur-sm sm:items-center sm:p-5">
      <div className={`max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl ${largo ? "sm:max-w-3xl" : "sm:max-w-xl"}`}>
        <div className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-100 bg-white px-5 py-4 sm:px-6">
          <div>
            <h2 className="text-lg font-black text-slate-900">{titulo}</h2>
            {descricao && <p className="mt-1 text-sm text-slate-500">{descricao}</p>}
          </div>
          <button onClick={onClose} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100" aria-label="Fechar"><X size={20} /></button>
        </div>
        <div className="p-5 sm:p-6">{children}</div>
      </div>
    </div>
  );
}

function Campo({ label, children }) {
  return <label className="block text-sm font-bold text-slate-700"><span className="mb-2 block">{label}</span>{children}</label>;
}

function BotaoSalvar({ carregando, children = "Salvar" }) {
  return (
    <button disabled={carregando} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 py-3 font-extrabold text-white hover:bg-emerald-800 disabled:opacity-50">
      {carregando ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}{children}
    </button>
  );
}

function EstoqueRunner() {
  const searchParams = useSearchParams();
  const { unidadeAtiva, unidadeInfo, abrirMenu, sessao } = useERP();
  const [estoques, setEstoques] = useState([]);
  const [estoqueId, setEstoqueId] = useState("");
  const [itens, setItens] = useState([]);
  const [movimentos, setMovimentos] = useState([]);
  const [catalogo, setCatalogo] = useState([]);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");
  const [aba, setAba] = useState("atual");
  const [filtros, setFiltros] = useState({ busca: "", categoria: "Todas", status: "todos", local: "Todos" });
  const [modal, setModal] = useState(null);
  const [operacao, setOperacao] = useState({ insumo_id: "", quantidade: "", destino_id: "", observacao: "", data: "" });
  const [formItem, setFormItem] = useState({});
  const [formEstoque, setFormEstoque] = useState({});
  const [textoImportacao, setTextoImportacao] = useState("");

  const estoqueAtual = useMemo(() => estoques.find(item => item.id === estoqueId), [estoques, estoqueId]);

  const carregarEstoques = useCallback(async (manterId = "") => {
    if (!unidadeAtiva || unidadeAtiva === "todas") return;
    const [resEstoques, resCatalogo] = await Promise.all([
      fetchEstoques(unidadeAtiva, true),
      fetchInsumos(unidadeAtiva, null, { escopoEstrito: true }),
    ]);
    if (resEstoques.error) setErro(resEstoques.error);
    setEstoques(resEstoques.data || []);
    setCatalogo(resCatalogo.data || []);
    const preferencia = searchParams.get("dept");
    const escolhido = resEstoques.data?.find(item => item.id === manterId)
      || resEstoques.data?.find(item => item.slug === preferencia)
      || resEstoques.data?.find(item => item.status === "ativo");
    setEstoqueId(escolhido?.id || "");
  }, [unidadeAtiva, searchParams]);

  const carregarArea = useCallback(async () => {
    if (!estoqueId || !unidadeAtiva) return;
    setLoading(true);
    const [resItens, resMovimentos] = await Promise.all([
      fetchItensEstoque(estoqueId),
      fetchMovimentosMulti(unidadeAtiva, estoqueId),
    ]);
    setItens(resItens.data || []);
    setMovimentos(resMovimentos.data || []);
    if (resItens.error || resMovimentos.error) setErro(resItens.error || resMovimentos.error);
    setLoading(false);
  }, [estoqueId, unidadeAtiva]);

  useEffect(() => { carregarEstoques(); }, [carregarEstoques]);
  useEffect(() => { carregarArea(); }, [carregarArea]);

  const avisar = (mensagem, tipo = "sucesso") => {
    if (tipo === "erro") setErro(mensagem);
    else setSucesso(mensagem);
    window.setTimeout(() => tipo === "erro" ? setErro("") : setSucesso(""), 4500);
  };

  const atualizarTudo = async () => {
    await Promise.all([carregarArea(), carregarEstoques(estoqueId)]);
  };

  const categorias = useMemo(() => ["Todas", ...new Set(itens.map(i => i.categoria || "Sem categoria"))], [itens]);
  const locais = useMemo(() => ["Todos", ...new Set(itens.map(i => i.local_interno).filter(Boolean))], [itens]);
  const itensFiltrados = useMemo(
    () => filtrarItensEstoque(itens, filtros, estoqueAtual),
    [itens, filtros, estoqueAtual],
  );
  const alertas = useMemo(
    () => itens.filter(item => {
      const status = statusItemEstoque(item, estoqueAtual);
      return status.abaixoMinimo || status.validadeProxima || status.vencido;
    }),
    [itens, estoqueAtual],
  );
  const valorTotal = itens.reduce((soma, item) => soma + Number(item.quantidade_atual || 0) * Number(item.custo_unitario || 0), 0);
  const ultimaEntrada = movimentos.find(m => ["entrada", "transferencia_entrada"].includes(m.tipo));

  const abrirOperacao = (tipo, item = null) => {
    setOperacao({
      insumo_id: item?.insumo_id || "",
      quantidade: tipo === "contagem" ? String(item?.quantidade_atual ?? "") : "",
      destino_id: "",
      observacao: "",
      data: "",
    });
    setModal({ tipo, item });
  };

  const destinosCompativeis = estoques.filter(item =>
    item.id !== estoqueId && item.status === "ativo" && tiposCompativeis(estoqueAtual?.tipo, item.tipo));

  const executarOperacao = async event => {
    event.preventDefault();
    setSalvando(true);
    setErro("");
    let item = modal?.item || itens.find(i => i.insumo_id === operacao.insumo_id);
    const insumo = catalogo.find(i => i.id === operacao.insumo_id);
    if (!item && insumo && modal?.tipo === "entrada") {
      const vinculo = await vincularItemEstoque({
        unidadeId: unidadeAtiva, estoqueId, insumoId: insumo.id,
        custoUnitario: insumo.custo_compra ?? insumo.custo_unitario,
      });
      if (vinculo.error) {
        setSalvando(false);
        avisar(vinculo.error, "erro");
        return;
      }
      item = { ...insumo, insumo_id: insumo.id, estoque_item_id: vinculo.data?.id, permite_transferencia: true };
    }
    let resposta;
    if (modal?.tipo === "contagem") {
      resposta = await registrarContagemMulti({
        unidadeId, estoqueId, insumoId: item?.insumo_id,
        saldoContado: operacao.quantidade, usuarioId: idUsuario(sessao),
        usuarioNome: nomeUsuario(sessao), observacao: operacao.observacao,
      });
    } else if (modal?.tipo === "transferencia") {
      resposta = await transferirEntreEstoques({
        unidadeId, estoqueOrigem: estoqueAtual,
        estoqueDestino: estoques.find(i => i.id === operacao.destino_id),
        item, quantidade: operacao.quantidade, usuarioId: idUsuario(sessao),
        usuarioNome: nomeUsuario(sessao), observacao: operacao.observacao,
      });
    } else {
      resposta = await registrarMovimentoMulti({
        unidadeId, estoqueId, insumoId: item?.insumo_id,
        tipo: modal?.tipo, quantidade: operacao.quantidade,
        usuarioId: idUsuario(sessao), usuarioNome: nomeUsuario(sessao),
        observacao: operacao.observacao, dataMovimento: operacao.data || null,
      });
    }
    setSalvando(false);
    if (resposta?.error) return avisar(resposta.error, "erro");
    setModal(null);
    avisar(modal?.tipo === "transferencia" ? "Transferência concluída nos dois estoques." : "Movimentação registrada.");
    await atualizarTudo();
  };

  const abrirEdicaoItem = item => {
    setFormItem({
      ...item,
      estoque_minimo: item.estoque_minimo ?? "",
      estoque_maximo: item.estoque_maximo ?? "",
      custo_unitario: item.custo_unitario ?? "",
    });
    setModal({ tipo: "item", item });
  };

  const salvarConfiguracaoItem = async event => {
    event.preventDefault();
    setSalvando(true);
    const resposta = await atualizarItemEstoque(formItem.estoque_item_id, formItem);
    setSalvando(false);
    if (resposta.error) return avisar(resposta.error, "erro");
    setModal(null);
    avisar("Configuração do item atualizada.");
    await carregarArea();
  };

  const abrirEdicaoEstoque = estoque => {
    setFormEstoque(estoque ? {
      ...estoque,
      locais_texto: (estoque.locais_internos || []).join(", "),
      permissoes_texto: (estoque.permissoes || []).join(", "),
    } : {
      unidade_id: unidadeAtiva, nome: "", tipo: "materiais", descricao: "",
      status: "ativo", cor: "#059669", controla_validade: false,
      controla_minimo: true, locais_texto: "", permissoes_texto: "",
      ordem: estoques.length,
    });
    setModal({ tipo: "estoque", item: estoque });
  };

  const salvarConfiguracaoEstoque = async event => {
    event.preventDefault();
    setSalvando(true);
    const resposta = await salvarEstoque({
      ...formEstoque,
      unidade_id: unidadeAtiva,
      locais_internos: formEstoque.locais_texto?.split(",").map(v => v.trim()).filter(Boolean),
      permissoes: formEstoque.permissoes_texto?.split(",").map(v => v.trim()).filter(Boolean),
    });
    setSalvando(false);
    if (resposta.error) return avisar(resposta.error, "erro");
    setModal(null);
    avisar(formEstoque.id ? "Estoque atualizado." : "Novo estoque criado.");
    await carregarEstoques(resposta.data?.id || estoqueId);
  };

  const importarLista = async event => {
    event.preventDefault();
    const linhas = textoImportacao.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (!linhas.length) return avisar("Cole ao menos uma linha para importar.", "erro");
    setSalvando(true);
    let importados = 0;
    for (const linha of linhas) {
      const [nome, saldo = "0", unidade = "un", minimo = "", local = ""] = linha.split(/[;\t]/).map(v => v.trim());
      if (!nome || /^produto|^nome/i.test(nome)) continue;
      let insumo = catalogo.find(i => i.nome?.toLowerCase() === nome.toLowerCase());
      if (!insumo) {
        const novo = await salvarInsumo({
          unidade_id: unidadeAtiva, departamento: estoqueAtual.slug,
          nome, nome_original: nome, unidade_medida: unidade || "un",
          tamanho_embalagem: 1, categoria: "Sem categoria",
          custo_unitario: 0, custo_compra: 0, ativo: true,
        }, { origem: `Importação — estoque ${estoqueAtual.nome}` });
        if (novo.error) continue;
        insumo = { id: novo.id, nome, unidade_medida: unidade || "un" };
      }
      const vinculo = await vincularItemEstoque({
        unidadeId: unidadeAtiva, estoqueId, insumoId: insumo.id,
        minimo, local, custoUnitario: insumo.custo_compra ?? insumo.custo_unitario ?? 0,
      });
      if (vinculo.error) continue;
      const contagem = await registrarContagemMulti({
        unidadeId: unidadeAtiva, estoqueId, insumoId: insumo.id,
        saldoContado: Number(String(saldo).replace(",", ".")) || 0,
        usuarioId: idUsuario(sessao), usuarioNome: nomeUsuario(sessao),
        observacao: "Importação de lista",
      });
      if (!contagem.error) importados += 1;
    }
    setSalvando(false);
    setModal(null);
    setTextoImportacao("");
    avisar(`${importados} item(ns) importado(s) para ${estoqueAtual.nome}.`);
    await atualizarTudo();
  };

  const ativo = estoqueAtual?.status === "ativo";

  return (
    <div className="min-h-screen bg-slate-50 pb-16 text-slate-900">
      <header className="border-b border-slate-200 bg-white px-4 py-5 sm:px-7">
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <button onClick={abrirMenu} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50" aria-label="Voltar ao módulo"><ArrowLeft size={21} /></button>
            <div>
              <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Estoque</h1>
              <p className="text-sm text-slate-500">Saldos e movimentações separados por área · {unidadeInfo?.nome || "Unidade"}</p>
            </div>
          </div>
          <button onClick={() => abrirEdicaoEstoque(null)} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 font-bold hover:bg-slate-50">
            <Settings2 size={18} /> Gerenciar estoques
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-[1500px] space-y-5 px-4 py-5 sm:px-7">
        {(erro || sucesso) && (
          <div className={`fixed right-4 top-4 z-[150] max-w-sm rounded-2xl px-5 py-4 text-sm font-bold text-white shadow-xl ${erro ? "bg-red-600" : "bg-emerald-700"}`}>
            {erro || sucesso}
          </div>
        )}

        <section>
          <div className="mb-3 flex items-center justify-between">
            <div><p className="text-sm font-extrabold text-slate-800">Área de estoque</p><p className="text-xs text-slate-500">Cada área mantém seu próprio saldo.</p></div>
            <button onClick={() => abrirEdicaoEstoque(estoqueAtual)} disabled={!estoqueAtual} className="text-sm font-bold text-emerald-700 hover:underline">Editar área</button>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            {estoques.map(estoque => (
              <button
                key={estoque.id}
                onClick={() => setEstoqueId(estoque.id)}
                className={`relative min-h-[110px] rounded-2xl border p-4 text-left transition ${estoque.id === estoqueId ? "border-transparent text-white shadow-lg" : "border-slate-200 bg-white hover:border-slate-300"} ${estoque.status !== "ativo" ? "opacity-55" : ""}`}
                style={estoque.id === estoqueId ? { backgroundColor: estoque.cor || "#047857" } : undefined}
              >
                <div className="flex items-center justify-between"><Warehouse size={20} /><ChevronRight size={17} /></div>
                <strong className="mt-3 block text-base">{estoque.nome}</strong>
                <span className={`text-xs ${estoque.id === estoqueId ? "text-white/80" : "text-slate-500"}`}>{estoque.itens || 0} itens · {estoque.status}</span>
              </button>
            ))}
          </div>
        </section>

        {estoqueAtual && (
          <>
            <section className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3">
              <span className="mr-auto px-2 text-sm font-black" style={{ color: estoqueAtual.cor }}>{estoqueAtual.nome}</span>
              <button disabled={!ativo} onClick={() => abrirOperacao("entrada")} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-emerald-700 px-4 text-sm font-extrabold text-white disabled:opacity-40"><PackagePlus size={17} /> Nova entrada</button>
              <button disabled={!ativo || !itens.length} onClick={() => abrirOperacao("saida")} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-extrabold disabled:opacity-40"><PackageMinus size={17} /> Nova baixa</button>
              <button disabled={!ativo || !itens.length} onClick={() => abrirOperacao("contagem")} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-extrabold disabled:opacity-40"><ClipboardCheck size={17} /> Contagem</button>
              <button disabled={!ativo || !itens.length || !destinosCompativeis.length} onClick={() => abrirOperacao("transferencia")} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-extrabold disabled:opacity-40"><ArrowRightLeft size={17} /> Transferência</button>
              <button disabled={!ativo} onClick={() => setModal({ tipo: "importar" })} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-extrabold disabled:opacity-40"><Upload size={17} /> Importar lista</button>
            </section>

            <section className="grid grid-cols-2 gap-3 xl:grid-cols-5">
              {[
                { icon: Package, label: "Valor neste estoque", value: fmtBRL(valorTotal) },
                { icon: AlertTriangle, label: "Abaixo do mínimo", value: `${itens.filter(i => statusItemEstoque(i, estoqueAtual).abaixoMinimo).length} itens` },
                { icon: CalendarDays, label: "Próximas validades", value: estoqueAtual.controla_validade ? `${itens.filter(i => statusItemEstoque(i, estoqueAtual).validadeProxima).length} itens` : "Não controlada" },
                { icon: Clock3, label: "Última reposição", value: ultimaEntrada ? fmtData(ultimaEntrada.data_movimento, true) : "Sem registro" },
                { icon: Boxes, label: "Resumo da área", value: `${itens.length} itens` },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="mb-4 grid h-9 w-9 place-items-center rounded-full bg-emerald-50 text-emerald-700"><Icon size={18} /></div>
                  <p className="text-xs font-semibold text-slate-500">{label}</p>
                  <p className="mt-1 text-lg font-black text-slate-900">{value}</p>
                </div>
              ))}
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white">
              <div className="grid grid-cols-2 gap-x-4 border-b border-slate-200 px-4 pt-1 sm:flex sm:gap-5 sm:overflow-x-auto sm:px-6">
                {[
                  ["atual", "Estoque atual"], ["historico", "Histórico"],
                  ["movimentacoes", "Movimentações"], ["alertas", `Alertas (${alertas.length})`],
                ].map(([id, label]) => (
                  <button key={id} onClick={() => setAba(id)} className={`whitespace-nowrap border-b-2 px-1 py-3 text-xs font-extrabold sm:py-4 sm:text-sm ${aba === id ? "border-emerald-600 text-emerald-700" : "border-transparent text-slate-500"}`}>{label}</button>
                ))}
              </div>

              {aba === "atual" || aba === "alertas" ? (
                <>
                  <div className="grid gap-3 p-4 lg:grid-cols-[1fr_190px_170px_180px]">
                    <label className="relative"><Search className="absolute left-3 top-3 text-slate-400" size={19} /><input value={filtros.busca} onChange={e => setFiltros({ ...filtros, busca: e.target.value })} placeholder="Buscar produto por nome, marca ou código..." className="h-11 w-full rounded-xl border border-slate-200 pl-10 pr-3 outline-none focus:border-emerald-500" /></label>
                    <select value={filtros.categoria} onChange={e => setFiltros({ ...filtros, categoria: e.target.value })} className="h-11 rounded-xl border border-slate-200 px-3 font-semibold">{categorias.map(v => <option key={v}>{v}</option>)}</select>
                    <select value={filtros.status} onChange={e => setFiltros({ ...filtros, status: e.target.value })} className="h-11 rounded-xl border border-slate-200 px-3 font-semibold">
                      <option value="todos">Todos os status</option><option value="abaixo">Abaixo do mínimo</option><option value="validade">Validade próxima</option><option value="sem-saldo">Sem saldo</option>
                    </select>
                    <select value={filtros.local} onChange={e => setFiltros({ ...filtros, local: e.target.value })} className="h-11 rounded-xl border border-slate-200 px-3 font-semibold">{locais.map(v => <option key={v}>{v}</option>)}</select>
                  </div>
                  <TabelaItens
                    itens={aba === "alertas" ? itensFiltrados.filter(i => alertas.some(a => a.id === i.id)) : itensFiltrados}
                    estoque={estoqueAtual} loading={loading}
                    onEntrada={item => abrirOperacao("entrada", item)}
                    onSaida={item => abrirOperacao("saida", item)}
                    onEditar={abrirEdicaoItem}
                  />
                </>
              ) : (
                <ListaMovimentos movimentos={movimentos} modo={aba} />
              )}
            </section>
          </>
        )}
      </main>

      {["entrada", "saida", "contagem", "transferencia"].includes(modal?.tipo) && (
        <Modal
          titulo={{ entrada: "Nova entrada", saida: "Nova baixa", contagem: "Contagem de estoque", transferencia: "Transferir entre estoques" }[modal.tipo]}
          descricao={`Movimentação exclusiva do estoque ${estoqueAtual?.nome}.`}
          onClose={() => setModal(null)}
        >
          <form onSubmit={executarOperacao} className="space-y-4">
            <Campo label="Produto">
              <select required value={operacao.insumo_id} disabled={!!modal.item} onChange={e => setOperacao({ ...operacao, insumo_id: e.target.value })} className="h-12 w-full rounded-xl border border-slate-200 px-3 disabled:bg-slate-100">
                <option value="">Selecione...</option>
                {(modal.tipo === "entrada" ? catalogo : itens).map(item => <option key={item.id} value={item.insumo_id || item.id}>{item.nome} {item.marca ? `· ${item.marca}` : ""}</option>)}
              </select>
            </Campo>
            <div className="grid grid-cols-2 gap-3">
              <Campo label={modal.tipo === "contagem" ? "Saldo contado" : "Quantidade"}>
                <input required min="0" step="0.001" type="number" value={operacao.quantidade} onChange={e => setOperacao({ ...operacao, quantidade: e.target.value })} className="h-12 w-full rounded-xl border border-slate-200 px-3" />
              </Campo>
              {modal.tipo === "transferencia" ? (
                <Campo label="Estoque de destino">
                  <select required value={operacao.destino_id} onChange={e => setOperacao({ ...operacao, destino_id: e.target.value })} className="h-12 w-full rounded-xl border border-slate-200 px-3">
                    <option value="">Selecione...</option>{destinosCompativeis.map(item => <option key={item.id} value={item.id}>{item.nome}</option>)}
                  </select>
                </Campo>
              ) : modal.tipo !== "contagem" ? (
                <Campo label="Data (opcional)"><input type="datetime-local" value={operacao.data} onChange={e => setOperacao({ ...operacao, data: e.target.value })} className="h-12 w-full rounded-xl border border-slate-200 px-3" /></Campo>
              ) : <div />}
            </div>
            <Campo label="Observação"><textarea value={operacao.observacao} onChange={e => setOperacao({ ...operacao, observacao: e.target.value })} className="min-h-24 w-full rounded-xl border border-slate-200 p-3" placeholder="Motivo, documento ou responsável..." /></Campo>
            {modal.tipo === "transferencia" && !destinosCompativeis.length && <p className="rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-800">Não há outro estoque ativo e compatível com esta área.</p>}
            <div className="flex justify-end"><BotaoSalvar carregando={salvando}>Confirmar</BotaoSalvar></div>
          </form>
        </Modal>
      )}

      {modal?.tipo === "item" && (
        <Modal titulo={`Configurar ${modal.item.nome}`} descricao={`Parâmetros válidos apenas em ${estoqueAtual?.nome}.`} onClose={() => setModal(null)}>
          <form onSubmit={salvarConfiguracaoItem} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Campo label="Estoque mínimo"><input type="number" min="0" step="0.001" value={formItem.estoque_minimo} onChange={e => setFormItem({ ...formItem, estoque_minimo: e.target.value })} className="h-12 w-full rounded-xl border border-slate-200 px-3" /></Campo>
              <Campo label="Estoque máximo"><input type="number" min="0" step="0.001" value={formItem.estoque_maximo} onChange={e => setFormItem({ ...formItem, estoque_maximo: e.target.value })} className="h-12 w-full rounded-xl border border-slate-200 px-3" /></Campo>
              <Campo label="Custo unitário"><input type="number" min="0" step="0.01" value={formItem.custo_unitario} onChange={e => setFormItem({ ...formItem, custo_unitario: e.target.value })} className="h-12 w-full rounded-xl border border-slate-200 px-3" /></Campo>
              <Campo label="Local interno"><input value={formItem.local_interno || ""} onChange={e => setFormItem({ ...formItem, local_interno: e.target.value })} className="h-12 w-full rounded-xl border border-slate-200 px-3" placeholder="Ex.: Câmara fria 01" /></Campo>
              {estoqueAtual?.controla_validade && <Campo label="Validade"><input type="date" value={formItem.validade || ""} onChange={e => setFormItem({ ...formItem, validade: e.target.value })} className="h-12 w-full rounded-xl border border-slate-200 px-3" /></Campo>}
            </div>
            <label className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 text-sm font-bold"><input type="checkbox" checked={formItem.permite_transferencia !== false} onChange={e => setFormItem({ ...formItem, permite_transferencia: e.target.checked })} /> Permitir transferências deste item</label>
            <div className="flex justify-end"><BotaoSalvar carregando={salvando} /></div>
          </form>
        </Modal>
      )}

      {modal?.tipo === "estoque" && (
        <Modal titulo={formEstoque.id ? "Editar estoque" : "Novo estoque"} descricao="Cadastre uma área independente de saldo e movimentações." onClose={() => setModal(null)} largo>
          <form onSubmit={salvarConfiguracaoEstoque} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo label="Nome"><input required value={formEstoque.nome || ""} onChange={e => setFormEstoque({ ...formEstoque, nome: e.target.value })} className="h-12 w-full rounded-xl border border-slate-200 px-3" /></Campo>
              <Campo label="Tipo"><select value={formEstoque.tipo || "materiais"} onChange={e => setFormEstoque({ ...formEstoque, tipo: e.target.value })} className="h-12 w-full rounded-xl border border-slate-200 px-3">{TIPOS_ESTOQUE.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}</select></Campo>
              <Campo label="Status"><select value={formEstoque.status || "ativo"} onChange={e => setFormEstoque({ ...formEstoque, status: e.target.value })} className="h-12 w-full rounded-xl border border-slate-200 px-3"><option value="ativo">Ativo</option><option value="inativo">Inativo</option></select></Campo>
              <Campo label="Cor"><input type="color" value={formEstoque.cor || "#059669"} onChange={e => setFormEstoque({ ...formEstoque, cor: e.target.value })} className="h-12 w-full rounded-xl border border-slate-200 p-2" /></Campo>
              <Campo label="Locais internos (separados por vírgula)"><input value={formEstoque.locais_texto || ""} onChange={e => setFormEstoque({ ...formEstoque, locais_texto: e.target.value })} className="h-12 w-full rounded-xl border border-slate-200 px-3" placeholder="Despensa, Câmara fria" /></Campo>
              <Campo label="Perfis autorizados (separados por vírgula)"><input value={formEstoque.permissoes_texto || ""} onChange={e => setFormEstoque({ ...formEstoque, permissoes_texto: e.target.value })} className="h-12 w-full rounded-xl border border-slate-200 px-3" placeholder="administrador, estoque" /></Campo>
            </div>
            <Campo label="Descrição"><textarea value={formEstoque.descricao || ""} onChange={e => setFormEstoque({ ...formEstoque, descricao: e.target.value })} className="min-h-20 w-full rounded-xl border border-slate-200 p-3" /></Campo>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 text-sm font-bold"><input type="checkbox" checked={!!formEstoque.controla_validade} onChange={e => setFormEstoque({ ...formEstoque, controla_validade: e.target.checked })} /> Controlar validade</label>
              <label className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 text-sm font-bold"><input type="checkbox" checked={formEstoque.controla_minimo !== false} onChange={e => setFormEstoque({ ...formEstoque, controla_minimo: e.target.checked })} /> Controlar estoque mínimo</label>
            </div>
            <div className="flex justify-end"><BotaoSalvar carregando={salvando} /></div>
          </form>
        </Modal>
      )}

      {modal?.tipo === "importar" && (
        <Modal titulo={`Importar lista para ${estoqueAtual?.nome}`} descricao="Cada linha: produto; saldo; unidade; mínimo; local." onClose={() => setModal(null)} largo>
          <form onSubmit={importarLista} className="space-y-4">
            <div className="rounded-xl bg-emerald-50 p-3 font-mono text-xs text-emerald-900">Arroz branco; 12; kg; 5; Despensa seca<br />Detergente; 24; un; 6; Armário 02</div>
            <textarea required value={textoImportacao} onChange={e => setTextoImportacao(e.target.value)} className="min-h-64 w-full rounded-xl border border-slate-200 p-3 font-mono text-sm" placeholder="Cole sua lista aqui..." />
            <div className="flex justify-end"><BotaoSalvar carregando={salvando}>Importar</BotaoSalvar></div>
          </form>
        </Modal>
      )}
    </div>
  );
}

// Saldo de bebidas/embalados: mostra UNIDADES comerciais como principal e o
// equivalente (ml/L/g/kg) como secundário — quando o item tem conteúdo por
// embalagem (> 1). Ex.: 5000 ml de garrafas de 750 → "6 un + 500 ml".
function saldoEmbalado(item) {
  const conteudo = Number(item.tamanho_embalagem) || 1;
  const total = Number(item.quantidade_atual) || 0;
  const un = String(item.unidade_medida || "un").toLowerCase();
  if (conteudo <= 1 || un === "un") return null; // sem embalagem fracionável
  const unLabel = item.unidade_comercial || "un";
  const fechadas = Math.floor(total / conteudo);
  const aberto = +(total - fechadas * conteudo).toFixed(3);
  const fmtEq = (q, u) => {
    const n = Number(q) || 0;
    if (u === "ml") return n >= 1000 ? `${(+(n / 1000).toFixed(3)).toLocaleString("pt-BR")} L` : `${fmtQtd(n)} ml`;
    if (u === "g") return n >= 1000 ? `${(+(n / 1000).toFixed(3)).toLocaleString("pt-BR")} kg` : `${fmtQtd(n)} g`;
    return `${fmtQtd(n)} ${u}`;
  };
  const principal = `${fechadas} ${unLabel}${aberto > 0 ? ` + ${fmtEq(aberto, un)}` : ""}`;
  const secundario = `Conteúdo: ${fmtQtd(conteudo)} ${un}/un · Total: ${fmtEq(total, un)}`;
  return { principal, secundario };
}

function TabelaItens({ itens, estoque, loading, onEntrada, onSaida, onEditar }) {
  if (loading) return <div className="grid min-h-64 place-items-center text-slate-500"><Loader2 className="animate-spin" /></div>;
  if (!itens.length) return <div className="grid min-h-64 place-items-center px-5 text-center"><div><Package size={42} className="mx-auto mb-3 text-slate-300" /><p className="font-black text-slate-700">Nenhum item encontrado neste estoque</p><p className="mt-1 text-sm text-slate-500">Use “Nova entrada” ou “Importar lista” para começar.</p></div></div>;
  return (
    <>
      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full min-w-[1050px] text-left text-sm">
          <thead className="bg-slate-900 text-xs uppercase tracking-wide text-white"><tr>
            <th className="px-5 py-4">Produto</th><th className="px-4 py-4">Categoria</th><th className="px-4 py-4">Embalagem</th><th className="px-4 py-4">Custo/un.</th><th className="px-4 py-4">Saldo</th><th className="px-4 py-4">Mínimo</th>{estoque.controla_validade && <th className="px-4 py-4">Validade</th>}<th className="px-4 py-4">Local</th><th className="px-4 py-4">Última mov.</th><th className="px-4 py-4">Ações</th>
          </tr></thead>
          <tbody className="divide-y divide-slate-100">
            {itens.map(item => {
              const status = statusItemEstoque(item, estoque);
              return <tr key={item.id} className="hover:bg-slate-50">
                <td className="px-5 py-3"><strong className="block">{item.nome}</strong><span className="text-xs text-slate-500">{item.codigo_interno || item.marca || "Sem código"}</span></td>
                <td className="px-4 py-3"><span className="rounded-lg bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700">{item.categoria || "Sem categoria"}</span></td>
                <td className="px-4 py-3">{fmtQtd(item.tamanho_embalagem || 1)} {item.unidade_medida || "un"}</td>
                <td className="px-4 py-3"><strong>{fmtBRL(item.custo_unitario || 0)}</strong></td>
                <td className={`px-4 py-3 font-black ${status.abaixoMinimo ? "text-red-600" : "text-emerald-700"}`}>{(() => { const s = saldoEmbalado(item); return s ? <><span>{s.principal}</span><span className="block text-[10px] font-medium text-slate-400">{s.secundario}</span></> : <>{fmtQtd(item.quantidade_atual)} {item.unidade_medida || "un"}</>; })()}</td>
                <td className="px-4 py-3">{item.estoque_minimo == null ? "—" : `${fmtQtd(item.estoque_minimo)} ${item.unidade_medida || "un"}`}</td>
                {estoque.controla_validade && <td className={`px-4 py-3 ${status.vencido || status.validadeProxima ? "font-bold text-amber-700" : ""}`}>{fmtData(item.validade)}</td>}
                <td className="px-4 py-3"><span className="inline-flex items-center gap-1"><MapPin size={14} />{item.local_interno || "Não definido"}</span></td>
                <td className="px-4 py-3 text-xs text-slate-500">{fmtData(item.ultima_movimentacao_em, true)}</td>
                <td className="px-4 py-3"><div className="flex gap-2">
                  <button onClick={() => onEntrada(item)} className="grid h-9 w-9 place-items-center rounded-lg border border-emerald-600 text-emerald-700" title="Entrada"><Plus size={17} /></button>
                  <button onClick={() => onSaida(item)} className="grid h-9 w-9 place-items-center rounded-lg border border-emerald-600 text-emerald-700" title="Baixa"><span className="text-xl leading-none">−</span></button>
                  <SimuladorRendimento item={item} variant="icon" />
                  <button onClick={() => onEditar(item)} className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 text-slate-600" title="Configurar"><MoreVertical size={17} /></button>
                </div></td>
              </tr>;
            })}
          </tbody>
        </table>
      </div>
      <div className="divide-y divide-slate-100 lg:hidden">
        {itens.map(item => {
          const status = statusItemEstoque(item, estoque);
          return <article key={item.id} className="p-4">
            <div className="flex items-start justify-between gap-3"><div><strong>{item.nome}</strong><p className="mt-1 text-xs text-slate-500">{item.categoria || "Sem categoria"} · {item.local_interno || "Sem local"}</p></div><div className="text-right">{(() => { const s = saldoEmbalado(item); return s ? <><strong className={status.abaixoMinimo ? "text-red-600" : "text-emerald-700"}>{s.principal}</strong><span className="block text-[10px] font-medium text-slate-400">{s.secundario}</span></> : <strong className={status.abaixoMinimo ? "text-red-600" : "text-emerald-700"}>{fmtQtd(item.quantidade_atual)} {item.unidade_medida || "un"}</strong>; })()}</div></div>
            <div className="mt-4 grid grid-cols-3 gap-2"><button onClick={() => onEntrada(item)} className="rounded-xl bg-emerald-50 py-2 text-sm font-bold text-emerald-700">+ Entrada</button><button onClick={() => onSaida(item)} className="rounded-xl bg-slate-100 py-2 text-sm font-bold">− Baixa</button><button onClick={() => onEditar(item)} className="rounded-xl bg-slate-100 py-2 text-sm font-bold">Configurar</button></div>
            <div className="mt-2"><SimuladorRendimento item={item} variant="full" /></div>
          </article>;
        })}
      </div>
    </>
  );
}

function ListaMovimentos({ movimentos, modo }) {
  const lista = modo === "movimentacoes"
    ? movimentos.filter(m => ["entrada", "saida", "transferencia_saida", "transferencia_entrada", "contagem"].includes(m.tipo))
    : movimentos;
  if (!lista.length) return <div className="grid min-h-64 place-items-center text-sm font-semibold text-slate-500">Nenhuma movimentação registrada nesta área.</div>;
  return <div className="divide-y divide-slate-100">
    {lista.map(mov => {
      const positivo = ["entrada", "transferencia_entrada"].includes(mov.tipo) || (mov.tipo === "contagem" && Number(mov.quantidade) >= 0);
      return <div key={mov.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
        <div className={`grid h-10 w-10 place-items-center rounded-full ${positivo ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>{mov.tipo.includes("transferencia") ? <ArrowRightLeft size={18} /> : <History size={18} />}</div>
        <div className="min-w-0 flex-1"><strong className="block truncate">{mov.insumo?.nome || "Produto"}</strong><p className="text-xs text-slate-500">{mov.tipo.replaceAll("_", " ")} · {mov.usuario_nome || "Sistema"} · {fmtData(mov.data_movimento, true)}</p></div>
        <div className="text-right"><strong className={positivo ? "text-emerald-700" : "text-red-600"}>{positivo ? "+" : "−"} {fmtQtd(Math.abs(Number(mov.quantidade) || 0))} {mov.insumo?.unidade_medida || "un"}</strong>{mov.destino?.nome && <p className="text-xs text-slate-500">Destino: {mov.destino.nome}</p>}</div>
      </div>;
    })}
  </div>;
}

export default function EstoquePage() {
  return <Suspense fallback={<div className="grid min-h-screen place-items-center"><Loader2 className="animate-spin text-emerald-700" /></div>}><EstoqueRunner /></Suspense>;
}
