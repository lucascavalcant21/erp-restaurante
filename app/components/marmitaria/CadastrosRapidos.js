"use client";

// Cadastro rápido dentro da marmita. A embalagem vai para o cadastro geral
// pelo salvarInsumo (trava de nome repetido, histórico de
// preço, vínculo no estoque). Pré-preparo vai para a base compartilhada da
// cozinha pela marmitaria_salvar_ficha — o restaurante passa a enxergá-lo.

import { useEffect, useRef, useState } from "react";
import { Trash2, X } from "lucide-react";
import { criarProduto, salvarPrePreparo, salvarModoDePreparo, novaChave } from "../../lib/marmitaria/dados";
import { fetchComSessao } from "../../lib/api-sessao";
import { numerarPassos } from "../../lib/marmitaria/modo-preparo.mjs";
import { custoDaMarmita, custoPorUnidadeDoPacote, paraUnidadeDoCadastro, unidadesCompativeis } from "../../lib/marmitaria/nucleo.mjs";
import BuscaItens from "./BuscaItens";
import { quantidadeParaTela } from "../../lib/marmitaria/formulario.mjs";
import { Botao, Campo, CampoNumero, inputCls, brl, num, Aviso, lerNumero } from "./ui";

function Painel({ titulo, onFechar, children }) {
  // abre à vista: o painel aparece embaixo da lista e, no celular, ficava fora da tela (17/11/2026)
  const ref = useRef(null);
  useEffect(() => { ref.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }, []);
  return (
    <div ref={ref} className="scroll-mt-24 rounded-2xl border border-hf-accent/30 bg-hf-surface p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-sm font-bold text-hf-text">{titulo}</p>
        <button type="button" onClick={onFechar} aria-label="Fechar" className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-hf-elevated"><X size={16} /></button>
      </div>
      {children}
    </div>
  );
}

const UNIDADES = [["kg", "kg"], ["g", "g"], ["l", "L"], ["ml", "ml"], ["un", "unidade"]];

/** Quanto sai cada unidade do pacote. Mostra as 4 casas para o arredondamento não esconder o valor. */
export function CustoDaUnidade({ preco, unidades }) {
  const custo = custoPorUnidadeDoPacote(preco, unidades);
  if (custo === null) return null;
  const exato = custo.toLocaleString("pt-BR", { minimumFractionDigits: 4, maximumFractionDigits: 4 });
  return <p className="mt-2 rounded-lg bg-hf-elevated px-3 py-2 text-sm text-hf-text">Cada unidade sai a <strong>{brl(custo)}</strong> <span className="text-xs text-hf-muted">({brl(preco)} ÷ {num(unidades)} = {exato})</span></p>;
}

export function NovoProduto({ unidadeId, embalagem = false, limpeza = false, nomeInicial = "", rotuloSalvar = "Cadastrar e usar", onCriado, onFechar }) {
  const [f, setF] = useState({ nome: nomeInicial, marca: "", unidade: embalagem ? "un" : limpeza ? "ml" : "kg", preco: "", tamanho: embalagem ? "" : "1" });
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
    if (!(tamanho > 0)) return setErro(embalagem ? "Informe quantas unidades vêm no pacote." : "Informe quanto vem na embalagem de compra.");
    setSalvando(true);
    try {
      const r = await criarProduto({
        unidadeId, nome: f.nome, marca: f.marca, unidade_medida: f.unidade, preco_embalagem: preco, tamanho_embalagem: tamanho,
        departamento: embalagem ? "embalagens" : limpeza ? "limpeza" : "marmitaria",
        categoria: embalagem ? "Embalagens da marmitaria" : limpeza ? "Limpeza da marmitaria" : "",
      });
      if (r.error) setErro(r.error);
      else await onCriado(r.id, f.unidade);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Painel titulo={embalagem ? "Nova embalagem" : limpeza ? "Novo produto de limpeza" : "Novo ingrediente"} onFechar={onFechar}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo rotulo="Nome"><input className={inputCls} value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} /></Campo>
        <Campo rotulo="Marca"><input className={inputCls} value={f.marca} onChange={(e) => setF({ ...f, marca: e.target.value })} placeholder="Opcional" /></Campo>
        <Campo rotulo={embalagem ? "Preço do pacote (R$)" : "Preço pago na compra (R$)"} dica={embalagem ? "O valor pago, como na nota." : "O valor da embalagem/pacote, como na nota."}>
          <CampoNumero valor={f.preco} onChange={(v) => setF({ ...f, preco: v })} placeholder="0,00" />
        </Campo>
        {embalagem ? <Campo rotulo="Unidades no pacote"><CampoNumero valor={f.tamanho} onChange={(v) => setF({ ...f, tamanho: v })} placeholder="Ex.: 30" /></Campo> : (
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <Campo rotulo="Quanto vem nela"><CampoNumero valor={f.tamanho} onChange={(v) => setF({ ...f, tamanho: v })} /></Campo>
            <Campo rotulo="Unidade">
              <select className={inputCls} value={f.unidade} onChange={(e) => setF({ ...f, unidade: e.target.value })}>
                {UNIDADES.map(([v, r]) => <option key={v} value={v}>{r}</option>)}
              </select>
            </Campo>
          </div>
        )}
      </div>
      {embalagem ? <CustoDaUnidade preco={preco} unidades={tamanho} />
        : porUnidade !== null && <p className="mt-2 text-xs text-hf-muted">Custo: {brl(porUnidade)} por {f.unidade === "un" ? "unidade" : f.unidade}.</p>}
      {erro && <Aviso tipo="alerta" className="mt-3">{erro}</Aviso>}
      <div className="mt-3 flex justify-end gap-2">
        <Botao variante="secundario" onClick={onFechar} type="button">Cancelar</Botao>
        <Botao onClick={salvar} disabled={salvando} type="button">{salvando ? "Salvando…" : rotuloSalvar}</Botao>
      </div>
    </Painel>
  );
}

export function NovoPrePreparo({ unidadeId, base, nomeInicial = "", ficha = null, onCriado, onFechar }) {
  const [id] = useState(() => ficha?.id || novaChave());
  const [f, setF] = useState(() => ({ nome: ficha?.nome_receita || nomeInicial, rendimento: ficha?.rendimento_porcoes ? String(ficha.rendimento_porcoes).replace(".", ",") : "",
    unidade: String(ficha?.rendimento_unidade || "kg").toLowerCase(), setor: ficha?.departamento || "cozinha", validade: ficha?.validade_dias ? String(ficha.validade_dias) : "" }));
  const [itens, setItens] = useState(() => (ficha?.fichas_ingredientes || []).filter((i) => i.insumo_id).map((i) => {
    const t = quantidadeParaTela(i.quantidade, String(base.insumos.get(i.insumo_id)?.unidade_medida || "un").toLowerCase());
    return { key: novaChave(), insumo_id: i.insumo_id, qtd: t.qtd, un: t.un };
  }));
  const [buscando, setBuscando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(null);
  // modo de preparo (dono, 17/11/2026): passo a passo da produção, escrito ou organizado pela IA
  const [preparo, setPreparo] = useState(() => ficha?.modo_preparo || "");
  const [tempo, setTempo] = useState(() => (ficha?.tempo_preparo ? String(ficha.tempo_preparo) : ""));
  // peso de cada unidade pronta (ex.: frango empanado de 144 g), quando rende em unidades
  const [pesoUn, setPesoUn] = useState(() => (ficha?.peso_porcao_g ? String(ficha.peso_porcao_g).replace(".", ",") : ""));
  const [organizando, setOrganizando] = useState(false);

  const convertidos = itens.map((it) => {
    const ins = base.insumos.get(it.insumo_id);
    return { ...it, ins, quantidade: paraUnidadeDoCadastro(it.qtd, it.un, ins?.unidade_medida) };
  });
  const custo = custoDaMarmita({ itens: convertidos.filter((c) => c.quantidade > 0).map((c) => ({ insumo_id: c.insumo_id, quantidade: c.quantidade })), fichas: base.fichas, insumos: base.insumos });
  const rend = lerNumero(f.rendimento);
  // g e ml são só para digitar: o estoque e o custo trabalham em kg e L (300 g → 0,3 kg)
  const unGravada = f.unidade === "g" ? "kg" : f.unidade === "ml" ? "l" : f.unidade;
  const rendGravado = (f.unidade === "g" || f.unidade === "ml") && rend > 0 ? Math.round((rend / 1000) * 1e6) / 1e6 : rend;

  async function salvar() {
    if (salvando) return;
    setErro(null);
    if (f.nome.trim().length < 2) return setErro("Informe o nome do subproduto.");
    if (!(rend > 0)) return setErro("Informe quanto o lote rende.");
    if (!itens.length) return setErro("Adicione os ingredientes do subproduto.");
    if (convertidos.some((c) => !(c.quantidade > 0))) return setErro("Confira a quantidade e a unidade de cada ingrediente.");
    setSalvando(true);
    try {
      const r = await salvarPrePreparo({
        id, unidade_id: unidadeId, nome: f.nome, departamento: f.setor, rendimento: rendGravado, rendimento_unidade: unGravada,
        validade_dias: lerNumero(f.validade) || null,
        // editar não apaga o que a tela não mostra: o salvar do banco regrava categoria, descrição, foto e peso
        ...(ficha ? { categoria: ficha.categoria || "", descricao: ficha.descricao || "", foto: ficha.imagem || "", peso_final_g: ficha.peso_final_g ?? null } : {}),
        itens: convertidos.map((c) => ({ insumo_id: c.insumo_id, quantidade: c.quantidade })),
      });
      if (r.error) { setErro(r.error); return; }
      if (preparo.trim() || tempo || pesoUn || ficha?.modo_preparo || ficha?.peso_porcao_g) {
        const mp = await salvarModoDePreparo(id, { modo_preparo: numerarPassos(preparo), tempo_preparo: Math.round(lerNumero(tempo) || 0) || null,
          peso_porcao_g: f.unidade === "un" ? (lerNumero(pesoUn) || null) : null });
        if (mp.error) { setErro(`Subproduto salvo, mas ${mp.error.charAt(0).toLowerCase()}${mp.error.slice(1)}`); return; }
      }
      await onCriado(id, unGravada);
    } finally {
      setSalvando(false);
    }
  }

  async function organizarComIA() {
    if (organizando) return;
    if (preparo.trim().length < 10) return setErro("Escreva com suas palavras como é feito (pode ser curto) e toque de novo em Organizar com IA.");
    setErro(null); setOrganizando(true);
    try {
      const ingredientes = convertidos.map((c) => `${c.ins?.nome || "ingrediente"}: ${c.qtd} ${c.un}`);
      const resp = await fetchComSessao("/api/ia-preparo", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ explicacao: preparo, nome_receita: f.nome, ingredientes, tipo: "pre_preparo" }) });
      const j = await resp.json().catch(() => ({}));
      if (!resp.ok || !j.modo_preparo) setErro(j.error || "Não consegui organizar agora. O que você escreveu continua aqui.");
      else setPreparo(j.modo_preparo);
    } catch {
      setErro("Não consegui organizar agora. O que você escreveu continua aqui.");
    } finally {
      setOrganizando(false);
    }
  }

  return (
    <Painel titulo={ficha ? `Editar ${ficha.nome_receita}` : "Novo subproduto"} onFechar={onFechar}>
      <div className="grid gap-3 sm:grid-cols-4">
        <Campo rotulo="Nome" className="sm:col-span-2"><input className={inputCls} value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} placeholder="Ex.: Arroz branco cozido" /></Campo>
        {/* rendimento e unidade juntos (dono, 17/11/2026: "no rendimento não está a unidade de medida") */}
        <Campo rotulo="Rendimento" className="sm:col-span-2">
          <div className="flex gap-2">
            <CampoNumero valor={f.rendimento} onChange={(v) => setF({ ...f, rendimento: v })} placeholder="Ex.: 5" className="min-w-0 flex-1" aria-label="Rendimento" />
            <select className={`${inputCls} w-[120px] shrink-0`} value={f.unidade} onChange={(e) => setF({ ...f, unidade: e.target.value })} aria-label="Unidade do rendimento">
              <option value="kg">kg</option><option value="g">g</option><option value="l">L</option><option value="ml">ml</option><option value="un">unidades</option>
            </select>
          </div>
        </Campo>
        {/* no delivery o setor é o próprio delivery (estoque "Pré-preparos da Cozinha" da unidade do delivery); bebidas vão para o do bar */}
        <Campo rotulo="Setor"><select className={inputCls} value={f.setor} onChange={(e) => setF({ ...f, setor: e.target.value })}><option value="cozinha">Delivery</option><option value="bar">Delivery · bebidas</option></select></Campo>
        <Campo rotulo="Validade (dias)"><CampoNumero valor={f.validade} onChange={(v) => setF({ ...f, validade: v })} placeholder="opcional" /></Campo>
        {f.unidade === "un" && <Campo rotulo="Peso de cada unidade (g)"><CampoNumero valor={pesoUn} onChange={setPesoUn} placeholder="Ex.: 144" /></Campo>}
      </div>
      {f.unidade === "un" && (
        <p className="mt-2 text-xs text-hf-muted">Dica: para um frango empanado, ponha "O lote rende 1 unidade" e os gramas de cada ingrediente de 1 frango (sassami, trigo, panko, água). O estoque mostra quantos dá para fazer com o trigo e o panko que tem.</p>
      )}
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
        {rendGravado > 0 && custo.total > 0 && <> · por {unGravada === "un" ? "unidade" : unGravada === "l" ? "L" : "kg"}: <b className="tabular-nums">{brl(custo.total / rendGravado)}</b></>}
      </p>
      {custo.pendencias.length > 0 && <Aviso tipo="alerta" className="mt-2">{custo.pendencias.join(" ")}</Aviso>}

      <div className="mt-4 border-t border-hf-border pt-3">
        <div className="flex items-end justify-between gap-2">
          <p className="text-xs font-semibold text-hf-text-2">Modo de preparo</p>
          <Campo rotulo="Tempo total (min)" className="w-32"><CampoNumero valor={tempo} onChange={setTempo} placeholder="opcional" /></Campo>
        </div>
        <textarea className={`${inputCls} mt-2 min-h-[150px] py-2 leading-relaxed`} value={preparo} onChange={(e) => setPreparo(e.target.value)} maxLength={4000}
          placeholder={"Um passo por linha. Ex.:\n1. Refogar o alho — 1 a 2 min: aqueça o óleo em fogo médio-baixo e doure o alho, sem escurecer.\n2. Refogar o arroz — 2 a 3 min: junte o arroz e mexa até envolver os grãos.\n3. Cozinhar — 15 a 20 min: água quente e sal, ferva, abaixe o fogo e tampe."} />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Botao variante="secundario" type="button" onClick={organizarComIA} disabled={organizando}>{organizando ? "Organizando…" : "Organizar com IA"}</Botao>
          <span className="text-xs text-hf-muted">Escreva do seu jeito e a IA arruma em passos com tempo e fogo. Confira antes de salvar.</span>
        </div>
      </div>

      {erro && <Aviso tipo="alerta" className="mt-2">{erro}</Aviso>}
      <div className="mt-3 flex justify-end gap-2">
        <Botao variante="secundario" onClick={onFechar} type="button">Cancelar</Botao>
        <Botao onClick={salvar} disabled={salvando} type="button">{salvando ? "Salvando…" : ficha ? "Salvar" : "Cadastrar e usar"}</Botao>
      </div>
    </Painel>
  );
}

