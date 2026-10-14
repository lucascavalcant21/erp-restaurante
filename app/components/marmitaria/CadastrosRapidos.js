"use client";

// Cadastro rápido dentro da marmita. Ingrediente e embalagem vão para o
// cadastro geral pelo salvarInsumo (trava de nome repetido, histórico de
// preço, vínculo no estoque). Pré-preparo vai para a base compartilhada da
// cozinha pela marmitaria_salvar_ficha — o restaurante passa a enxergá-lo.

import { useState } from "react";
import { Trash2, X } from "lucide-react";
import { criarProduto, salvarPrePreparo, novaChave } from "../../lib/marmitaria/dados";
import { custoDaMarmita, paraUnidadeDoCadastro, unidadesCompativeis } from "../../lib/marmitaria/nucleo.mjs";
import BuscaItens from "./BuscaItens";
import { Botao, Campo, CampoNumero, inputCls, brl, Aviso, lerNumero } from "./ui";

function Painel({ titulo, onFechar, children }) {
  return (
    <div className="rounded-2xl border border-hf-accent/30 bg-hf-surface p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-sm font-bold text-hf-text">{titulo}</p>
        <button type="button" onClick={onFechar} aria-label="Fechar" className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-hf-elevated"><X size={16} /></button>
      </div>
      {children}
    </div>
  );
}

const UNIDADES = [["kg", "kg"], ["g", "g"], ["l", "L"], ["ml", "ml"], ["un", "unidade"]];

export function NovoProduto({ unidadeId, embalagem = false, nomeInicial = "", onCriado, onFechar }) {
  const [f, setF] = useState({ nome: nomeInicial, unidade: embalagem ? "un" : "kg", preco: "", tamanho: embalagem ? "1" : "1", exclusivo: false });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(null);
  const preco = lerNumero(f.preco);
  const tamanho = lerNumero(f.tamanho);
  const porUnidade = preco !== "" && tamanho > 0 ? preco / tamanho : null;

  async function salvar() {
    if (salvando) return;
    setErro(null);
    if (f.nome.trim().length < 2) return setErro("Informe o nome.");
    if (preco === "" || preco < 0) return setErro("Informe o preço de compra.");
    if (!(tamanho > 0)) return setErro("Informe quanto vem na embalagem de compra.");
    setSalvando(true);
    try {
      const r = await criarProduto({
        unidadeId, nome: f.nome, unidade_medida: f.unidade, preco_embalagem: preco, tamanho_embalagem: tamanho,
        departamento: embalagem ? "embalagens" : f.exclusivo ? "marmitaria" : "cozinha",
        categoria: embalagem ? "Embalagens da marmitaria" : "",
      });
      if (r.error) setErro(r.error);
      else await onCriado(r.id, f.unidade);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Painel titulo={embalagem ? "Nova embalagem" : "Novo ingrediente"} onFechar={onFechar}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo rotulo="Nome" className="sm:col-span-2"><input className={inputCls} value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} /></Campo>
        <Campo rotulo="Preço pago na compra (R$)" dica="O valor da embalagem/pacote, como na nota.">
          <CampoNumero valor={f.preco} onChange={(v) => setF({ ...f, preco: v })} placeholder="0,00" />
        </Campo>
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <Campo rotulo="Quanto vem nela"><CampoNumero valor={f.tamanho} onChange={(v) => setF({ ...f, tamanho: v })} /></Campo>
          <Campo rotulo="Unidade">
            <select className={inputCls} value={f.unidade} onChange={(e) => setF({ ...f, unidade: e.target.value })} disabled={embalagem}>
              {UNIDADES.map(([v, r]) => <option key={v} value={v}>{r}</option>)}
            </select>
          </Campo>
        </div>
      </div>
      {porUnidade !== null && <p className="mt-2 text-xs text-hf-muted">Custo: {brl(porUnidade)} por {f.unidade === "un" ? "unidade" : f.unidade}.</p>}
      {!embalagem && (
        <label className="mt-3 flex min-h-[44px] items-center gap-2 text-sm text-hf-text-2">
          <input type="checkbox" className="h-5 w-5 accent-[rgb(var(--hf-accent))]" checked={f.exclusivo} onChange={(e) => setF({ ...f, exclusivo: e.target.checked })} />
          Só da marmitaria (desmarcado: fica no estoque geral, compartilhado com a cozinha)
        </label>
      )}
      {erro && <Aviso tipo="alerta" className="mt-3">{erro}</Aviso>}
      <div className="mt-3 flex justify-end gap-2">
        <Botao variante="secundario" onClick={onFechar} type="button">Cancelar</Botao>
        <Botao onClick={salvar} disabled={salvando} type="button">{salvando ? "Salvando…" : "Cadastrar e usar"}</Botao>
      </div>
    </Painel>
  );
}

export function NovoPrePreparo({ unidadeId, base, nomeInicial = "", onCriado, onFechar }) {
  const [id] = useState(() => novaChave());
  const [f, setF] = useState({ nome: nomeInicial, rendimento: "", unidade: "kg", setor: "cozinha", validade: "" });
  const [itens, setItens] = useState([]);
  const [buscando, setBuscando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(null);

  const convertidos = itens.map((it) => {
    const ins = base.insumos.get(it.insumo_id);
    return { ...it, ins, quantidade: paraUnidadeDoCadastro(it.qtd, it.un, ins?.unidade_medida) };
  });
  const custo = custoDaMarmita({ itens: convertidos.filter((c) => c.quantidade > 0).map((c) => ({ insumo_id: c.insumo_id, quantidade: c.quantidade })), fichas: base.fichas, insumos: base.insumos });
  const rend = lerNumero(f.rendimento);

  async function salvar() {
    if (salvando) return;
    setErro(null);
    if (f.nome.trim().length < 2) return setErro("Informe o nome do pré-preparo.");
    if (!(rend > 0)) return setErro("Informe quanto o lote rende.");
    if (!itens.length) return setErro("Adicione os ingredientes do pré-preparo.");
    if (convertidos.some((c) => !(c.quantidade > 0))) return setErro("Confira a quantidade e a unidade de cada ingrediente.");
    setSalvando(true);
    try {
      const r = await salvarPrePreparo({
        id, unidade_id: unidadeId, nome: f.nome, departamento: f.setor, rendimento: rend, rendimento_unidade: f.unidade,
        validade_dias: lerNumero(f.validade) || null,
        itens: convertidos.map((c) => ({ insumo_id: c.insumo_id, quantidade: c.quantidade })),
      });
      if (r.error) setErro(r.error);
      else await onCriado(id, f.unidade);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Painel titulo="Novo pré-preparo" onFechar={onFechar}>
      <div className="grid gap-3 sm:grid-cols-4">
        <Campo rotulo="Nome" className="sm:col-span-2"><input className={inputCls} value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} placeholder="Ex.: Arroz branco cozido" /></Campo>
        <Campo rotulo="O lote rende"><CampoNumero valor={f.rendimento} onChange={(v) => setF({ ...f, rendimento: v })} placeholder="Ex.: 5" /></Campo>
        <Campo rotulo="Unidade">
          <select className={inputCls} value={f.unidade} onChange={(e) => setF({ ...f, unidade: e.target.value })}>
            <option value="kg">kg</option><option value="l">L</option><option value="un">unidades</option>
          </select>
        </Campo>
        <Campo rotulo="Setor"><select className={inputCls} value={f.setor} onChange={(e) => setF({ ...f, setor: e.target.value })}><option value="cozinha">Cozinha</option><option value="bar">Bar</option></select></Campo>
        <Campo rotulo="Validade (dias)"><CampoNumero valor={f.validade} onChange={(v) => setF({ ...f, validade: v })} placeholder="opcional" /></Campo>
      </div>
      <p className="mt-3 text-xs font-semibold text-hf-text-2">Ingredientes do lote</p>
      <ul className="mt-1 space-y-2">
        {convertidos.map((c, i) => (
          <li key={c.key} className="grid grid-cols-[1fr_90px_80px_40px] items-center gap-2">
            <span className="truncate text-sm text-hf-text">{c.ins?.nome || "Ingrediente"}</span>
            <CampoNumero valor={c.qtd} onChange={(v) => setItens(itens.map((x, j) => (j === i ? { ...x, qtd: v } : x)))} />
            <select className={inputCls} value={c.un} onChange={(e) => setItens(itens.map((x, j) => (j === i ? { ...x, un: e.target.value } : x)))}>
              {unidadesCompativeis(c.ins?.unidade_medida).map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
            <button type="button" aria-label="Remover" onClick={() => setItens(itens.filter((_, j) => j !== i))} className="flex h-10 w-10 items-center justify-center rounded-lg text-hf-muted hover:bg-hf-elevated"><Trash2 size={15} /></button>
          </li>
        ))}
      </ul>
      {buscando ? (
        <div className="mt-2">
          <BuscaItens base={base} modo="ingrediente" excluir={itens.map((x) => x.insumo_id)}
            onEscolher={(r) => { if (r.tipo !== "ingrediente") return; const ins = base.insumos.get(r.id); setItens([...itens, { key: novaChave(), insumo_id: r.id, qtd: "", un: unidadesCompativeis(ins?.unidade_medida)[0] }]); setBuscando(false); }}
            onCriarIngrediente={() => setErro("Cadastre o ingrediente novo pela busca da marmita e depois volte ao pré-preparo.")} />
        </div>
      ) : (
        <Botao variante="texto" type="button" className="mt-1" onClick={() => setBuscando(true)}>+ Adicionar ingrediente</Botao>
      )}
      <p className="mt-2 text-sm text-hf-text-2">
        Custo do lote: <b className="tabular-nums">{brl(custo.total)}</b>
        {rend > 0 && custo.total > 0 && <> · por {f.unidade === "un" ? "unidade" : f.unidade.toUpperCase() === "L" ? "L" : f.unidade}: <b className="tabular-nums">{brl(custo.total / rend)}</b></>}
      </p>
      {custo.pendencias.length > 0 && <Aviso tipo="alerta" className="mt-2">{custo.pendencias.join(" ")}</Aviso>}
      {erro && <Aviso tipo="alerta" className="mt-2">{erro}</Aviso>}
      <div className="mt-3 flex justify-end gap-2">
        <Botao variante="secundario" onClick={onFechar} type="button">Cancelar</Botao>
        <Botao onClick={salvar} disabled={salvando} type="button">{salvando ? "Salvando…" : "Cadastrar e usar"}</Botao>
      </div>
    </Painel>
  );
}

