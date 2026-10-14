"use client";

// Estoque e produção da marmitaria sobre o estoque oficial do Héfisto:
//   Planejar   quanto produzir → o que falta comprar (desconta o estoque)
//   Estoque    os dois locais da marmitaria, com validade (FEFO) e mínimo;
//              traz da cozinha por transferência (estoque_transferir)
//   Pedidos    pedidos do iFood do dia: o que separar e (opcional) baixa por pedido
//   Produção   registra o lote e baixa ingredientes, pré-preparos e
//              embalagens numa transação (marmitaria_registrar_producao)
// Entrada, retirada, perda e inventário usam a tela oficial do estoque.

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMarmitaria } from "../../../components/marmitaria/contexto";
import { Abas, Aviso, Botao, Campo, CampoNumero, Secao, SemDados, brl, inputCls, num, lerNumero } from "../../../components/marmitaria/ui";
import { ativarEstoques, vincularProduto, transferir, registrarProducao, fetchProducoes, novaChave, ESTOQUE_MARMITARIA, ESTOQUE_EMBALAGENS } from "../../../lib/marmitaria/dados";
import PedidosIfood from "../../../components/marmitaria/PedidosIfood";
import { necessidadeDeProducao, baixasDaProducao, fatorSaldo, paraUnidadeDoCadastro, unidadesCompativeis } from "../../../lib/marmitaria/nucleo.mjs";

const hoje = () => new Date().toLocaleDateString("sv-SE");
const ehDaMarmitaria = (e) => e.slug === ESTOQUE_MARMITARIA || e.slug === ESTOQUE_EMBALAGENS;
const rotuloUn = (u) => (String(u).toLowerCase() === "l" ? "L" : u || "un");

function useSaldos(base, estoquesIds) {
  return useMemo(() => {
    const ids = new Set(estoquesIds);
    const m = new Map();
    for (const it of base.itensEstoque) {
      if (!ids.has(it.estoque_id)) continue;
      const ins = base.insumos.get(it.insumo_id);
      const v = (Number(it.quantidade_atual) || 0) / fatorSaldo(ins?.unidade_medida);
      m.set(it.insumo_id, (m.get(it.insumo_id) || 0) + v);
    }
    return m;
  }, [base, estoquesIds]);
}

function Conteudo() {
  const { base } = useMarmitaria();
  const params = useSearchParams();
  const router = useRouter();
  const [aba, setAba] = useState(["estoque", "producao", "pedidos"].includes(params.get("aba")) ? params.get("aba") : "planejar");
  if (!base) return null;
  return (
    <div className="space-y-4">
      <Abas abas={[{ id: "planejar", rotulo: "Planejar e comprar" }, { id: "estoque", rotulo: "Estoque" }, { id: "producao", rotulo: "Registrar produção" }, { id: "pedidos", rotulo: "Pedidos do iFood" }]}
        valor={aba} onChange={(v) => { setAba(v); router.replace(`?aba=${v}`); }} />
      {aba === "planejar" && <Planejar />}
      {aba === "estoque" && <Estoque />}
      {aba === "producao" && <Producao />}
      {aba === "pedidos" && <PedidosIfood />}
    </div>
  );
}

function SeletorEstoques({ estoques, marcados, onChange }) {
  return (
    <div className="flex flex-wrap gap-2">
      {estoques.map((e) => (
        <label key={e.id} className={`flex min-h-[40px] items-center gap-2 rounded-full border px-3 text-sm ${marcados.includes(e.id) ? "border-hf-accent bg-hf-accent/10 text-hf-text" : "border-hf-border text-hf-text-2"}`}>
          <input type="checkbox" className="h-4 w-4 accent-[rgb(var(--hf-accent))]" checked={marcados.includes(e.id)} onChange={(ev) => onChange(ev.target.checked ? [...marcados, e.id] : marcados.filter((x) => x !== e.id))} />
          {e.nome}
        </label>
      ))}
    </div>
  );
}

function Planejar() {
  const { base } = useMarmitaria();
  const marmitas = base.marmitas.filter((m) => m.ativo !== false);
  const padrao = base.estoques.filter((e) => ehDaMarmitaria(e) || e.slug === "pre-preparos-cozinha").map((e) => e.id);
  const [estoquesSel, setEstoquesSel] = useState(padrao);
  const [qtds, setQtds] = useState({});
  const [copiado, setCopiado] = useState(false);
  const saldo = useSaldos(base, estoquesSel);
  const plano = marmitas.map((m) => ({ ficha_id: m.id, quantidade: lerNumero(qtds[m.id]) || 0 })).filter((p) => p.quantidade > 0);
  const r = useMemo(() => necessidadeDeProducao({ plano, marmitas: new Map(marmitas.map((m) => [m.id, m])), fichas: base.fichas, insumos: base.insumos, saldo, espelho: base.espelho }),
    [JSON.stringify(plano), base, saldo]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!marmitas.length) return <SemDados titulo="Nenhuma marmita no cardápio" motivo="Cadastre as marmitas para planejar a produção." href="/dashboard/marmitaria/marmitas" acao="Cadastrar marmita" />;

  function copiar() {
    const linhas = r.listaDeCompras.map((i) => `• ${i.nome}: ${num(i.comprar)} ${rotuloUn(i.unidade)}`);
    const txt = `Lista de compras — marmitaria (${new Date().toLocaleDateString("pt-BR")})\n${linhas.join("\n")}`;
    navigator.clipboard?.writeText(txt).then(() => { setCopiado(true); setTimeout(() => setCopiado(false), 2000); });
  }

  return (
    <div className="space-y-4">
      <Secao titulo="Quanto vai produzir?" subtitulo="Ex.: 80 de frango e 40 de carne. O cálculo usa as fichas técnicas.">
        <div className="grid gap-2 sm:grid-cols-2">
          {marmitas.map((m) => (
            <div key={m.id} className="grid grid-cols-[1fr_110px] items-center gap-2">
              <span className="truncate text-sm font-semibold">{m.nome_receita}</span>
              <CampoNumero valor={qtds[m.id] ?? ""} onChange={(v) => setQtds({ ...qtds, [m.id]: v })} placeholder="0" aria-label={`Quantidade de ${m.nome_receita}`} />
            </div>
          ))}
        </div>
        <p className="mb-2 mt-4 text-xs font-semibold text-hf-text-2">Descontar o que já existe em:</p>
        <SeletorEstoques estoques={base.estoques} marcados={estoquesSel} onChange={setEstoquesSel} />
      </Secao>

      {plano.length > 0 && (
        <>
          {r.avisos.map((a) => <Aviso key={a} tipo="alerta">{a}</Aviso>)}
          {r.prePreparos.length > 0 && (
            <Secao titulo="Pré-preparos" subtitulo="Primeiro usa o que já está pronto; só a diferença vira ingrediente.">
              <Tabela cab={["Pré-preparo", "Precisa", "Em estoque", "Produzir", "Lotes"]}
                linhas={r.prePreparos.map((p) => [p.nome, `${num(p.necessario)} ${rotuloUn(p.unidade)}`, `${num(p.disponivel)} ${rotuloUn(p.unidade)}`, <b key="p">{num(p.produzir)} {rotuloUn(p.unidade)}</b>, p.lotes === null ? "sem rendimento" : num(p.lotes, 2)])} />
            </Secao>
          )}
          <Secao titulo="Lista de compras" subtitulo={`${r.listaDeCompras.length} item(ns) a comprar · valor estimado pelo último custo: ${r.valorEstimadoCompras === null ? "há item sem custo" : brl(r.valorEstimadoCompras)}`}
            direita={<div className="flex gap-2"><Botao variante="secundario" onClick={copiar} disabled={!r.listaDeCompras.length}>{copiado ? "Copiado" : "Copiar lista"}</Botao><Link href="/dashboard/operacao/compras" className="inline-flex min-h-[44px] items-center rounded-xl px-3 text-sm font-bold text-hf-accent hover:bg-hf-accent/5">Abrir Compras</Link></div>}>
            {r.listaDeCompras.length ? (
              <Tabela cab={["Item", "Precisa", "Disponível", "Comprar", "Valor est."]}
                linhas={r.listaDeCompras.map((i) => [<span key="n">{i.nome}{i.tipo === "embalagem" ? <span className="ml-1 text-xs text-hf-muted">embalagem</span> : null}</span>, `${num(i.necessario)} ${rotuloUn(i.unidade)}`, `${num(i.disponivel)} ${rotuloUn(i.unidade)}`, <b key="c">{num(i.comprar)} {rotuloUn(i.unidade)}</b>, i.valorEstimado === null ? "sem custo" : brl(i.valorEstimado)])} />
            ) : <Aviso>O estoque selecionado cobre essa produção. Nada a comprar.</Aviso>}
          </Secao>
        </>
      )}
    </div>
  );
}

function Tabela({ cab, linhas }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] text-sm">
        <thead><tr className="text-left text-xs uppercase tracking-wide text-hf-muted">{cab.map((c, i) => <th key={c} className={`py-2 pr-2 ${i ? "text-right" : ""}`}>{c}</th>)}</tr></thead>
        <tbody className="divide-y divide-hf-border">{linhas.map((l, i) => <tr key={i}>{l.map((c, j) => <td key={j} className={`py-2 pr-2 ${j ? "text-right tabular-nums" : ""}`}>{c}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

function Estoque() {
  const { base, unidadeId, recarregar } = useMarmitaria();
  const [msg, setMsg] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const [transf, setTransf] = useState(null);
  const locais = base.estoques.filter(ehDaMarmitaria);
  const est = locais.find((e) => e.slug === ESTOQUE_MARMITARIA);
  const estEmb = locais.find((e) => e.slug === ESTOQUE_EMBALAGENS);

  async function ativar() {
    setOcupado(true); setMsg(null);
    try { const r = await ativarEstoques(unidadeId); if (r.error) setMsg({ tipo: "alerta", texto: r.error }); else await recarregar(); } finally { setOcupado(false); }
  }

  // ingredientes, pré-preparos e embalagens das marmitas que ainda não estão nos locais da marmitaria
  const faltaVincular = useMemo(() => {
    if (!est || !estEmb) return [];
    const ja = new Set(base.itensEstoque.filter((i) => i.estoque_id === est.id || i.estoque_id === estEmb.id).map((i) => i.insumo_id));
    const ids = new Map();
    for (const m of base.marmitas) {
      for (const it of m.itens) {
        const id = it.subficha_id ? base.espelho.get(it.subficha_id) : it.insumo_id;
        if (id && !ja.has(id)) ids.set(id, est.id);
      }
      for (const e of m.embalagens) if (!ja.has(e.insumo_id)) ids.set(e.insumo_id, estEmb.id);
    }
    return [...ids.entries()];
  }, [base, est, estEmb]);

  async function vincularTodos() {
    setOcupado(true); setMsg(null);
    try {
      for (const [insumoId, estoqueId] of faltaVincular) {
        const r = await vincularProduto({ unidadeId, estoqueId, insumoId });
        if (r.error) { setMsg({ tipo: "alerta", texto: r.error }); break; }
      }
      await recarregar();
    } finally { setOcupado(false); }
  }

  if (!locais.length) {
    return (
      <Secao titulo="Estoque da marmitaria ainda não ativado">
        <p className="text-sm text-hf-text-2">Cria dois locais no estoque oficial do Héfisto: <b>Marmitaria</b> (insumos e pré-preparos) e <b>Embalagens da Marmitaria</b>. Os produtos continuam os mesmos do cadastro geral; o que é da cozinha vem por transferência, e cada local tem saldo, validade e inventário próprios.</p>
        <Botao className="mt-3" onClick={ativar} disabled={ocupado}>{ocupado ? "Ativando…" : "Ativar estoque da marmitaria"}</Botao>
        {msg && <Aviso tipo={msg.tipo} className="mt-3">{msg.texto}</Aviso>}
      </Secao>
    );
  }

  const agora = hoje();
  return (
    <div className="space-y-4">
      {faltaVincular.length > 0 && (
        <Aviso tipo="alerta">
          {faltaVincular.length} produto(s) das marmitas ainda não estão nos locais da marmitaria.
          <Botao variante="texto" className="ml-2 min-h-0 px-1" onClick={vincularTodos} disabled={ocupado}>{ocupado ? "Incluindo…" : "Incluir todos"}</Botao>
        </Aviso>
      )}
      {msg && <Aviso tipo={msg.tipo}>{msg.texto}</Aviso>}
      <Aviso>Entrada, retirada, perda e inventário semanal: use a <Link href="/dashboard/operacao/estoque" className="font-semibold text-hf-accent">tela oficial do Estoque</Link> escolhendo o local “Marmitaria”. Compras entram por <Link href="/dashboard/operacao/compras" className="font-semibold text-hf-accent">Compras</Link>, destinando ao local da marmitaria.</Aviso>
      {transf && <Transferir key={transf.chave} inicial={transf} onFechar={() => setTransf(null)} />}
      {locais.map((e) => {
        const itens = base.itensEstoque.filter((i) => i.estoque_id === e.id).map((i) => {
          const ins = base.insumos.get(i.insumo_id);
          const saldo = (Number(i.quantidade_atual) || 0) / fatorSaldo(ins?.unidade_medida);
          const min = i.estoque_minimo === null || i.estoque_minimo === undefined ? null : Number(i.estoque_minimo);
          const dias = i.validade ? Math.round((new Date(`${i.validade}T12:00:00`) - new Date(`${agora}T12:00:00`)) / 86400000) : null;
          return { ...i, ins, saldo, min, dias };
        }).sort((a, b) => (a.validade || "9999").localeCompare(b.validade || "9999") || String(a.ins?.nome).localeCompare(String(b.ins?.nome), "pt-BR"));
        return (
          <Secao key={e.id} titulo={e.nome} subtitulo={`${itens.length} produto(s) · ordenado por validade (primeiro a vencer, primeiro a sair)`}
            direita={<Botao variante="secundario" onClick={() => setTransf({ chave: novaChave(), destino: e.id })}>Trazer de outro estoque</Botao>}>
            {itens.length ? (
              <Tabela cab={["Produto", "Saldo", "Mínimo", "Validade", "Situação"]}
                linhas={itens.map((i) => {
                  const un = rotuloUn(i.ins?.unidade_medida);
                  const sit = i.saldo <= 0 ? <span className="font-semibold text-hf-danger">Zerado</span>
                    : i.dias !== null && i.dias < 0 ? <span className="font-semibold text-hf-danger">Vencido</span>
                      : i.dias !== null && i.dias <= 2 ? <span className="font-semibold text-hf-warning">Vence em {i.dias} dia(s)</span>
                        : i.min !== null && i.saldo < i.min ? <span className="font-semibold text-hf-warning">Abaixo do mínimo</span> : "Normal";
                  return [i.ins?.nome || "Produto", `${num(i.saldo)} ${un}`, i.min === null ? "—" : `${num(i.min)} ${un}`, i.validade ? new Date(`${i.validade}T12:00:00`).toLocaleDateString("pt-BR") : "—", sit];
                })} />
            ) : <SemDados titulo="Local vazio" motivo="Inclua os produtos das marmitas ou traga da cozinha." />}
          </Secao>
        );
      })}
    </div>
  );
}

function Transferir({ inicial, onFechar }) {
  const { base, unidadeId, recarregar } = useMarmitaria();
  const [f, setF] = useState({ origem: "", insumo: "", qtd: "", un: "" });
  const [msg, setMsg] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const origens = base.estoques.filter((e) => e.id !== inicial.destino);
  const itensOrigem = base.itensEstoque.filter((i) => i.estoque_id === f.origem && Number(i.quantidade_atual) > 0)
    .map((i) => ({ ...i, ins: base.insumos.get(i.insumo_id) })).filter((i) => i.ins).sort((a, b) => a.ins.nome.localeCompare(b.ins.nome, "pt-BR"));
  const sel = itensOrigem.find((i) => i.insumo_id === f.insumo);
  const unCad = String(sel?.ins?.unidade_medida || "un").toLowerCase();
  const qCad = sel ? paraUnidadeDoCadastro(f.qtd, f.un || unCad, unCad) : null;
  const qSaldo = qCad === null ? null : Math.round(qCad * fatorSaldo(unCad) * 1000) / 1000;
  const saldoCad = sel ? Number(sel.quantidade_atual) / fatorSaldo(unCad) : 0;

  async function confirmar() {
    if (salvando) return;
    setMsg(null);
    if (!sel) return setMsg("Escolha o estoque de origem e o produto.");
    if (!(qSaldo > 0)) return setMsg("Informe a quantidade.");
    if (qSaldo > Number(sel.quantidade_atual)) return setMsg(`A origem tem só ${num(saldoCad)} ${rotuloUn(unCad)}.`);
    setSalvando(true);
    try {
      const r = await transferir({ unidadeId, origemId: f.origem, destinoId: inicial.destino, insumoId: sel.insumo_id, quantidadeSaldo: qSaldo, chave: inicial.chave });
      if (r.error) setMsg(r.error); else { await recarregar(); onFechar(); }
    } finally { setSalvando(false); }
  }

  return (
    <Secao titulo="Trazer de outro estoque" subtitulo="Transferência registrada no histórico do estoque, com custo médio. Entra no CMV da marmitaria.">
      <div className="grid gap-3 sm:grid-cols-4">
        <Campo rotulo="De"><select className={inputCls} value={f.origem} onChange={(e) => setF({ origem: e.target.value, insumo: "", qtd: "", un: "" })}><option value="">Escolha…</option>{origens.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}</select></Campo>
        <Campo rotulo="Produto"><select className={inputCls} value={f.insumo} onChange={(e) => { const i = itensOrigem.find((x) => x.insumo_id === e.target.value); setF({ ...f, insumo: e.target.value, un: unidadesCompativeis(i?.ins?.unidade_medida)[0] }); }} disabled={!f.origem}>
          <option value="">{f.origem && !itensOrigem.length ? "Nada com saldo" : "Escolha…"}</option>{itensOrigem.map((i) => <option key={i.insumo_id} value={i.insumo_id}>{i.ins.nome}</option>)}</select></Campo>
        <Campo rotulo="Quantidade" dica={sel ? `Disponível: ${num(saldoCad)} ${rotuloUn(unCad)}` : null}><CampoNumero valor={f.qtd} onChange={(v) => setF({ ...f, qtd: v })} /></Campo>
        <Campo rotulo="Unidade"><select className={inputCls} value={f.un} onChange={(e) => setF({ ...f, un: e.target.value })} disabled={!sel}>{unidadesCompativeis(unCad).map((u) => <option key={u} value={u}>{rotuloUn(u)}</option>)}</select></Campo>
      </div>
      {msg && <Aviso tipo="alerta" className="mt-3">{msg}</Aviso>}
      <div className="mt-3 flex justify-end gap-2"><Botao variante="secundario" onClick={onFechar}>Cancelar</Botao><Botao onClick={confirmar} disabled={salvando}>{salvando ? "Transferindo…" : "Transferir"}</Botao></div>
    </Secao>
  );
}

function Producao() {
  const { base, unidadeId, custos, recarregar } = useMarmitaria();
  const marmitas = base.marmitas.filter((m) => m.ativo !== false);
  const [f, setF] = useState(() => ({ lote: novaChave(), ficha: marmitas[0]?.id || "", qtd: "", perdas: "", data: hoje() }));
  const [msg, setMsg] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [historico, setHistorico] = useState([]);
  useEffect(() => { if (unidadeId) fetchProducoes(unidadeId).then((r) => setHistorico(r.data || [])); }, [unidadeId, base]);

  const prioridade = (e) => (ehDaMarmitaria(e) ? 0 : e.slug === "pre-preparos-cozinha" ? 1 : 2);
  const saldos = useMemo(() => {
    const porId = new Map(base.estoques.map((e) => [e.id, e]));
    const m = new Map();
    for (const it of base.itensEstoque) {
      const e = porId.get(it.estoque_id);
      if (!e) continue;
      const l = m.get(it.insumo_id) || [];
      l.push({ estoque_id: e.id, estoque_nome: e.nome, saldo: Number(it.quantidade_atual) || 0, prioridade: prioridade(e) });
      m.set(it.insumo_id, l);
    }
    return m;
  }, [base]);
  const marmita = marmitas.find((m) => m.id === f.ficha);
  const qtd = lerNumero(f.qtd) || 0;
  const calc = marmita && qtd > 0 ? baixasDaProducao({ marmita, quantidade: qtd, fichas: base.fichas, insumos: base.insumos, espelho: base.espelho, saldos }) : null;
  const custo = custos.get(marmita?.id);

  if (!marmitas.length) return <SemDados titulo="Nenhuma marmita no cardápio" motivo="Cadastre as marmitas primeiro." href="/dashboard/marmitaria/marmitas" acao="Cadastrar marmita" />;

  async function confirmar() {
    if (salvando || !calc) return;
    setMsg(null);
    if (calc.faltas.length) return setMsg({ tipo: "alerta", texto: "Há item sem saldo suficiente: traga do estoque da cozinha ou lance a entrada antes." });
    setSalvando(true);
    try {
      const r = await registrarProducao({ lote_id: f.lote, unidade_id: unidadeId, ficha_id: marmita.id, quantidade: qtd, perdas: lerNumero(f.perdas) || 0, data: f.data,
        custo_previsto: custo ? Math.round(custo.total * qtd * 100) / 100 : 0, baixas: calc.baixas.map(({ estoque_id, insumo_id, quantidade }) => ({ estoque_id, insumo_id, quantidade })) });
      if (r.error) setMsg({ tipo: "alerta", texto: r.error });
      else {
        setMsg({ tipo: "info", texto: r.data?.idempotente ? "Esta produção já estava registrada (nada foi baixado de novo)." : `Produção registrada: ${qtd} marmita(s), ${r.data?.baixas || 0} baixa(s) no estoque.` });
        setF({ lote: novaChave(), ficha: f.ficha, qtd: "", perdas: "", data: f.data });
        await recarregar();
      }
    } finally { setSalvando(false); }
  }

  return (
    <div className="space-y-4">
      <Secao titulo="Registrar produção" subtitulo="Baixa a ficha técnica do estoque: ingrediente direto, o pré-preparo pronto (sem baixar os ingredientes dele de novo) e as embalagens.">
        <div className="grid gap-3 sm:grid-cols-4">
          <Campo rotulo="Marmita" className="sm:col-span-2"><select className={inputCls} value={f.ficha} onChange={(e) => setF({ ...f, ficha: e.target.value })}>{marmitas.map((m) => <option key={m.id} value={m.id}>{m.nome_receita}</option>)}</select></Campo>
          <Campo rotulo="Quantidade produzida"><CampoNumero valor={f.qtd} onChange={(v) => setF({ ...f, qtd: v })} /></Campo>
          <Campo rotulo="Data"><input type="date" className={inputCls} value={f.data} onChange={(e) => setF({ ...f, data: e.target.value })} /></Campo>
          <Campo rotulo="Perdas (marmitas)" dica="Opcional, para acompanhar desperdício."><CampoNumero valor={f.perdas} onChange={(v) => setF({ ...f, perdas: v })} /></Campo>
        </div>
        {calc && (
          <div className="mt-4">
            <Tabela cab={["Baixa", "Quantidade", "De"]} linhas={calc.baixas.map((b) => {
              const ins = base.insumos.get(b.insumo_id);
              const un = String(ins?.unidade_medida || "un").toLowerCase();
              return [b.nome, `${num(b.quantidade / fatorSaldo(un))} ${rotuloUn(un)}`, b.estoque_nome];
            })} />
            {calc.faltas.map((x) => <Aviso key={x} tipo="alerta" className="mt-2">{x}</Aviso>)}
            {custo && <p className="mt-2 text-sm text-hf-text-2">Custo previsto do lote: <b className="tabular-nums">{brl(custo.total * qtd)}</b></p>}
          </div>
        )}
        {msg && <Aviso tipo={msg.tipo} className="mt-3">{msg.texto}</Aviso>}
        <div className="mt-3 flex justify-end"><Botao onClick={confirmar} disabled={salvando || !calc || calc.faltas.length > 0}>{salvando ? "Registrando…" : "Registrar e baixar estoque"}</Botao></div>
      </Secao>
      <Secao titulo="Últimas produções">
        {historico.length ? (
          <Tabela cab={["Data", "Marmita", "Produzidas", "Perdas", "Custo previsto"]} linhas={historico.map((h) => [
            new Date(`${String(h.data_producao).slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR"),
            base.marmitas.find((m) => m.id === h.ficha_id)?.nome_receita || "—", num(h.quantidade_produzida, 0), num(h.quantidade_perdas, 0), brl(h.custo_total)])} />
        ) : <SemDados titulo="Nenhuma produção registrada" />}
      </Secao>
    </div>
  );
}

export default function EstoquePage() {
  return <Suspense fallback={null}><Conteudo /></Suspense>;
}

