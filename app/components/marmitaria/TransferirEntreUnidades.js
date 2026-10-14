"use client";

// Trazer mercadoria de OUTRA unidade da empresa (ex.: arroz do restaurante
// para a marmitaria). Uma transação no banco (estoque_transferir_unidades):
// sai da origem ao custo médio dela, entra aqui recalculando o custo médio
// como numa compra. O produto daqui é o de mesmo nome e unidade; se não
// existir, pode ser criado com o mesmo cadastro da origem.

import { useEffect, useMemo, useState } from "react";
import { useERP } from "../../context/ERPContext";
import { useMarmitaria } from "./contexto";
import { Aviso, Botao, Campo, CampoNumero, Secao, brl, inputCls, num } from "./ui";
import { carregarOrigemTransferencia, transferirEntreUnidades, criarProdutoComoNaOrigem, fetchTransferenciasUnidades } from "../../lib/marmitaria/dados";
import { fatorSaldo, paraUnidadeDoCadastro, unidadesCompativeis } from "../../lib/marmitaria/nucleo.mjs";

const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
const rotuloUn = (u) => (String(u).toLowerCase() === "l" ? "L" : u || "un");

export default function TransferirEntreUnidades({ inicial, onFechar }) {
  const { unidades } = useERP();
  const { base, unidadeId, recarregar } = useMarmitaria();
  const outras = (unidades || []).filter((u) => u.id !== unidadeId && u.id !== "todas");
  const nomeUnidade = (id) => (unidades || []).find((u) => u.id === id)?.nome || id;
  const [f, setF] = useState({ unidade: outras[0]?.id || "", estoque: "", insumo: "", qtd: "", un: "", obs: "" });
  const [origem, setOrigem] = useState(null);
  const [historico, setHistorico] = useState([]);
  const [msg, setMsg] = useState(null);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    if (!f.unidade) return;
    setOrigem(null);
    carregarOrigemTransferencia(f.unidade).then((r) => (r.error ? setMsg({ tipo: "alerta", texto: r.error }) : setOrigem(r)));
  }, [f.unidade]);
  useEffect(() => { fetchTransferenciasUnidades(unidadeId, 5).then((r) => setHistorico(r.data || [])); }, [unidadeId, base]);

  const itens = useMemo(() => (origem?.itens || []).filter((i) => i.estoque_id === f.estoque)
    .map((i) => ({ ...i, ins: origem.insumos.get(i.insumo_id) })).filter((i) => i.ins)
    .sort((a, b) => a.ins.nome.localeCompare(b.ins.nome, "pt-BR")), [origem, f.estoque]);
  const sel = itens.find((i) => i.insumo_id === f.insumo);
  const unCad = String(sel?.ins?.unidade_medida || "un").toLowerCase();
  const qCad = sel ? paraUnidadeDoCadastro(f.qtd, f.un || unCad, unCad) : null;
  const qSaldo = qCad === null ? null : Math.round(qCad * fatorSaldo(sel?.ins) * 1000) / 1000;
  const disponivel = sel ? sel.quantidade_atual / fatorSaldo(sel.ins) : 0;
  // o mesmo produto aqui: mesmo nome e mesma unidade de medida
  const destinoIns = sel ? base.insumosLista.find((d) => !d.ficha_tecnica_id && norm(d.nome) === norm(sel.ins.nome)
    && String(d.unidade_medida || "").toLowerCase() === unCad) : null;

  async function criarAqui() {
    if (!sel || ocupado) return;
    setOcupado(true); setMsg(null);
    try {
      const r = await criarProdutoComoNaOrigem(unidadeId, sel.ins);
      if (r.error) setMsg({ tipo: "alerta", texto: r.error }); else await recarregar();
    } finally { setOcupado(false); }
  }

  async function confirmar() {
    if (ocupado) return;
    setMsg(null);
    if (!sel) return setMsg({ tipo: "alerta", texto: "Escolha a unidade, o estoque e o produto de origem." });
    if (!destinoIns) return setMsg({ tipo: "alerta", texto: "Este produto ainda não existe aqui: crie com o mesmo cadastro primeiro." });
    if (!(qSaldo > 0)) return setMsg({ tipo: "alerta", texto: "Informe a quantidade." });
    if (qSaldo > sel.quantidade_atual + 0.0005) return setMsg({ tipo: "alerta", texto: `A origem tem só ${num(disponivel)} ${rotuloUn(unCad)}.` });
    setOcupado(true);
    try {
      const r = await transferirEntreUnidades({
        chave: inicial.chave, unidade_origem: f.unidade, estoque_origem_id: f.estoque, insumo_origem_id: sel.insumo_id,
        unidade_destino: unidadeId, estoque_destino_id: inicial.destino, insumo_destino_id: destinoIns.id, quantidade: qSaldo, observacao: f.obs,
      });
      if (r.error) setMsg({ tipo: "alerta", texto: r.error });
      else {
        await recarregar();
        if (r.data?.sem_custo) setMsg({ tipo: "alerta", texto: "Transferido, mas a origem não tinha custo médio: o valor ficou em branco (o CMV avisa)." });
        else onFechar();
      }
    } finally { setOcupado(false); }
  }

  return (
    <Secao titulo="Trazer de outra unidade" subtitulo="De outro negócio da empresa. Sai ao custo médio da origem e entra aqui como uma compra; fica registrado nas duas unidades.">
      {!outras.length ? <p className="text-sm text-hf-muted">Não há outra unidade visível para você.</p> : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Campo rotulo="Unidade"><select className={inputCls} value={f.unidade} onChange={(e) => setF({ ...f, unidade: e.target.value, estoque: "", insumo: "", qtd: "" })}>{outras.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}</select></Campo>
            <Campo rotulo="Estoque de lá"><select className={inputCls} value={f.estoque} onChange={(e) => setF({ ...f, estoque: e.target.value, insumo: "", qtd: "" })} disabled={!origem}>
              <option value="">{origem ? "Escolha…" : "Carregando…"}</option>{(origem?.estoques || []).map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}</select></Campo>
            <Campo rotulo="Produto"><select className={inputCls} value={f.insumo} onChange={(e) => { const i = itens.find((x) => x.insumo_id === e.target.value); setF({ ...f, insumo: e.target.value, un: unidadesCompativeis(i?.ins?.unidade_medida)[0] }); }} disabled={!f.estoque}>
              <option value="">{f.estoque && !itens.length ? "Nada com saldo" : "Escolha…"}</option>{itens.map((i) => <option key={i.insumo_id} value={i.insumo_id}>{i.ins.nome}</option>)}</select></Campo>
            <Campo rotulo="Quantidade" dica={sel ? `Disponível lá: ${num(disponivel)} ${rotuloUn(unCad)}` : null}><CampoNumero valor={f.qtd} onChange={(v) => setF({ ...f, qtd: v })} /></Campo>
            <Campo rotulo="Unidade de medida"><select className={inputCls} value={f.un} onChange={(e) => setF({ ...f, un: e.target.value })} disabled={!sel}>{unidadesCompativeis(unCad).map((u) => <option key={u} value={u}>{rotuloUn(u)}</option>)}</select></Campo>
            <Campo rotulo="Observação"><input className={inputCls} value={f.obs} onChange={(e) => setF({ ...f, obs: e.target.value })} placeholder="Opcional" /></Campo>
          </div>
          {sel && (destinoIns
            ? <p className="mt-2 text-xs text-hf-muted">Entra aqui como <b>{destinoIns.nome}</b> ({rotuloUn(destinoIns.unidade_medida)}).</p>
            : <Aviso tipo="alerta" className="mt-2">“{sel.ins.nome}” ainda não existe nesta unidade. <Botao variante="texto" className="ml-1 min-h-0 px-1" onClick={criarAqui} disabled={ocupado}>Criar com o mesmo cadastro</Botao></Aviso>)}
        </>
      )}
      {msg && <Aviso tipo={msg.tipo} className="mt-3">{msg.texto}</Aviso>}
      <div className="mt-3 flex justify-end gap-2"><Botao variante="secundario" onClick={onFechar}>Cancelar</Botao><Botao onClick={confirmar} disabled={ocupado || !sel || !destinoIns}>{ocupado ? "Transferindo…" : "Transferir"}</Botao></div>
      {historico.length > 0 && (
        <div className="mt-4 border-t border-hf-border pt-3">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-hf-muted">Últimas transferências entre unidades</p>
          <ul className="space-y-1 text-sm text-hf-text-2">
            {historico.map((t) => (
              <li key={t.id}>{new Date(t.created_at).toLocaleDateString("pt-BR")} · {nomeUnidade(t.unidade_origem)} → {nomeUnidade(t.unidade_destino)} · {num(t.quantidade)} {rotuloUn(t.unidade_medida)} · {t.valor == null ? "sem custo" : brl(t.valor)}{t.criado_por_nome ? ` · ${t.criado_por_nome}` : ""}</li>
            ))}
          </ul>
        </div>
      )}
    </Secao>
  );
}
