"use client";

// Bebidas do delivery (dono, 17/11/2026: "crie ao lado de ingredientes bebidas
// onde vou cadastrar minhas bebidas e crie um estoque para elas"). Cada bebida
// é o produto comprado (estoque "Bebidas da Marmitaria") e o item de venda
// (categoria "Bebidas"), que entra na Precificação e nos Combos.

import Link from "next/link";
import { useMemo, useState } from "react";
import { CupSoda, Plus } from "lucide-react";
import { useMarmitaria } from "../../../../components/marmitaria/contexto";
import { Aviso, Botao, Campo, CampoNumero, Cartao, Secao, brl, inputCls, lerNumero, num } from "../../../../components/marmitaria/ui";
import { criarBebida } from "../../../../lib/marmitaria/dados";
import { custoUnitarioEfetivoInsumo } from "../../../../lib/ficha-calculos.mjs";
import { casaBusca } from "../../../../lib/busca.mjs";

const ehBebida = (i) => String(i?.departamento || "").toLowerCase() === "bebidas";

function NovaBebida({ onFechar }) {
  const { unidadeId, recarregar } = useMarmitaria();
  const [f, setF] = useState({ nome: "", marca: "", preco: "", qtd: "1" });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(null);
  const preco = lerNumero(f.preco);
  const qtd = lerNumero(f.qtd) || 1;
  const porUnidade = preco > 0 ? preco / qtd : null;

  async function salvar() {
    if (salvando) return;
    if (String(f.nome).trim().length < 2) { setErro("Informe o nome da bebida."); return; }
    if (!(preco > 0)) { setErro("Informe quanto você paga."); return; }
    setSalvando(true); setErro(null);
    try {
      const r = await criarBebida({ unidadeId, nome: f.nome, marca: f.marca, preco_embalagem: preco, tamanho_embalagem: qtd });
      if (r.error) { setErro(r.error); if (!r.id) return; }
      await recarregar();
      if (!r.error) onFechar();
    } finally { setSalvando(false); }
  }

  return (
    <Cartao>
      <p className="font-semibold text-hf-text">Nova bebida</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Campo rotulo="Nome"><input className={inputCls} value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} placeholder="Ex.: Coca-Cola lata 350 ml" autoFocus /></Campo>
        <Campo rotulo="Marca"><input className={inputCls} value={f.marca} onChange={(e) => setF({ ...f, marca: e.target.value })} placeholder="opcional" /></Campo>
        <Campo rotulo="Quanto você paga" dica="Pelo fardo, caixa ou pela unidade."><CampoNumero prefixo="R$" valor={f.preco} onChange={(v) => setF({ ...f, preco: v })} placeholder="Ex.: 36,00" /></Campo>
        <Campo rotulo="Unidades nesse preço" dica="Fardo de 12 latas: 12. Uma garrafa: 1."><CampoNumero valor={f.qtd} onChange={(v) => setF({ ...f, qtd: v })} placeholder="1" /></Campo>
      </div>
      {porUnidade !== null && <p className="mt-2 text-sm text-hf-text-2">Custo de cada unidade: <b className="tabular-nums">{brl(porUnidade)}</b></p>}
      {erro && <Aviso tipo="alerta" className="mt-3">{erro}</Aviso>}
      <div className="mt-3 flex flex-wrap gap-2">
        <Botao onClick={salvar} disabled={salvando}>{salvando ? "Salvando…" : "Cadastrar bebida"}</Botao>
        <Botao variante="secundario" onClick={onFechar}>Cancelar</Botao>
      </div>
    </Cartao>
  );
}

export default function BebidasPage() {
  const { base, carregando } = useMarmitaria();
  const [nova, setNova] = useState(false);
  const [busca, setBusca] = useState("");

  const estBeb = useMemo(() => (base?.estoques || []).find((e) => e.slug === "bebidas-marmitaria") || null, [base]);
  const lista = useMemo(() => (base?.insumosLista || []).filter((i) => ehBebida(i) && (!busca.trim() || casaBusca(`${i.nome} ${i.marca || ""}`, busca)))
    .sort((a, b) => String(a.nome).localeCompare(String(b.nome), "pt-BR")), [base, busca]);

  if (!base) return carregando ? <Cartao><p className="text-sm text-hf-muted">Carregando bebidas…</p></Cartao> : null;

  const saldoDe = (id) => {
    if (!estBeb) return null;
    const it = base.itensEstoque.find((x) => x.estoque_id === estBeb.id && x.insumo_id === id);
    return it ? Number(it.quantidade_atual) || 0 : null;
  };
  const vendaDe = (id) => base.marmitas.find((m) => m.ativo !== false && (m.itens || []).length === 1 && m.itens[0].insumo_id === id) || null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-end gap-2">
        {!nova && <Botao onClick={() => setNova(true)}><Plus size={16} /> Nova bebida</Botao>}
      </div>
      {nova && <NovaBebida onFechar={() => setNova(false)} />}
      <Secao titulo="Bebidas" subtitulo="O que você compra pronto para vender. Cada bebida tem estoque próprio e entra na Precificação e nos Combos.">
        {(base.insumosLista || []).some(ehBebida) && (
          <input className={`${inputCls} mb-3`} value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar bebida" aria-label="Buscar bebida" />
        )}
        {!lista.length ? (
          <p className="text-sm text-hf-text-2">{busca ? "Nada encontrado." : "Nenhuma bebida ainda. Toque em \"Nova bebida\"."}</p>
        ) : (
          <ul className="divide-y divide-hf-border">
            {lista.map((i) => {
              const custo = custoUnitarioEfetivoInsumo(i);
              const saldo = saldoDe(i.id);
              const venda = vendaDe(i.id);
              const temPreco = venda && (Number(venda.preco_venda) > 0 || Object.values(venda.precos || {}).some((v) => Number(v) > 0));
              return (
                <li key={i.id} className="flex items-center gap-3 py-3">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-hf-elevated text-hf-muted"><CupSoda size={18} /></span>
                  <div className="min-w-0 flex-1">
                    <p className="break-words text-sm font-bold text-hf-text">{i.nome}</p>
                    {i.marca && <p className="text-xs text-hf-text-2">Marca: {i.marca}</p>}
                    <p className="text-xs text-hf-muted">Em estoque: {saldo === null ? "não conferido" : `${num(saldo)} un`} · {temPreco ? "com preço de venda" : venda ? "sem preço de venda" : "sem item de venda"}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className={`text-sm font-black tabular-nums ${custo > 0 ? "text-hf-text" : "text-hf-warning"}`}>{custo > 0 ? brl(custo) : "Sem valor"}</p>
                    <p className="text-[11px] text-hf-muted">custo por unidade</p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Secao>
      {lista.length > 0 && (
        <Aviso>Para colocar o preço de venda de cada bebida em cada app, vá em <Link href="/dashboard/marmitaria/marmitas/cardapio" className="font-semibold text-hf-accent">Precificação</Link>. Para juntar com marmita, em <Link href="/dashboard/marmitaria/marmitas/combos" className="font-semibold text-hf-accent">Combos e descontos</Link>.</Aviso>
      )}
    </div>
  );
}
