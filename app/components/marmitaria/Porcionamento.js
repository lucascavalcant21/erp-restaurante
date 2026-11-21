"use client";

// Ficha de porcionamento (dono, 21/11/2026): peça ou pacote → limpeza → porções
// iguais no estoque, com custo por porção. Grava como subproduto que rende
// unidades de X g (o resto do sistema já sabe produzir, estocar e custear).

import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { useMarmitaria } from "./contexto";
import BuscaItens from "./BuscaItens";
import { Aviso, Botao, Campo, CampoNumero, Secao, brl, inputCls, lerNumero, num } from "./ui";
import { salvarPrePreparo, salvarModoDePreparo, novaChave } from "../../lib/marmitaria/dados";
import { custoUnitarioEfetivoInsumo } from "../../lib/ficha-calculos.mjs";
import { CATEGORIA_PORCIONAMENTO, calcularPorcionamento, ehPorcionamento, passosDoPorcionamento } from "../../lib/marmitaria/porcionamento.mjs";
import { imprimirGuias } from "./imprimirGuia";
import { guiaDoPrePreparo } from "../../lib/marmitaria/guia-prepreparo.mjs";

const GUARDAR = ["Geladeira (0 a 4 °C)", "Freezer (−18 °C)", "Temperatura ambiente"];
const kgTxt = (g) => (g >= 1000 ? `${num(g / 1000)} kg` : `${num(g)} g`);

// Os dados da ficha ficam legíveis na descrição e voltam dela ao editar.
function descricaoDe(v) {
  return [`Perda na limpeza: ${v.perda}${v.perdaModo === "pct" ? "%" : " g"}`, v.embalagem && `Embalagem: ${v.embalagem}`, v.guardar && `Guardar: ${v.guardar}`].filter(Boolean).join(" · ");
}
function lerDescricao(txt = "") {
  const p = /Perda na limpeza: ([\d.,]+)\s*(%|g)/.exec(txt);
  return { perda: p ? p[1] : "", perdaModo: p?.[2] === "g" ? "g" : "pct", embalagem: /Embalagem: ([^·]+)/.exec(txt)?.[1]?.trim() || "", guardar: /Guardar: ([^·]+)/.exec(txt)?.[1]?.trim() || "" };
}

function Editor({ ficha, onFechar, onSalvo }) {
  const { base, unidadeId } = useMarmitaria();
  const ingr = ficha?.fichas_ingredientes?.find((i) => i.insumo_id);
  const insCad = ingr ? base.insumos.get(ingr.insumo_id) : null;
  const [id] = useState(() => ficha?.id || novaChave());
  const [v, setV] = useState(() => {
    const d = lerDescricao(ficha?.descricao);
    const un = String(insCad?.unidade_medida || "kg").toLowerCase();
    return { insumoId: ingr?.insumo_id || null, bruto: ingr ? String(ingr.quantidade).replace(".", ",") : "", brutoUn: ["g", "kg", "ml", "l"].includes(un) ? un : "kg",
      porcao: ficha?.peso_porcao_g ? String(ficha.peso_porcao_g).replace(".", ",") : "", validade: ficha?.validade_dias ? String(ficha.validade_dias) : "", nome: ficha?.nome_receita || "", ...d };
  });
  const [buscando, setBuscando] = useState(!ficha);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(null);
  const [aviso, setAviso] = useState(null);
  const ins = v.insumoId ? base.insumos.get(v.insumoId) : null;
  const unCad = String(ins?.unidade_medida || "kg").toLowerCase();
  const calc = useMemo(() => calcularPorcionamento({
    brutoQtd: lerNumero(v.bruto), brutoUn: v.brutoUn, perda: { modo: v.perdaModo, valor: lerNumero(v.perda) || 0 },
    porcaoG: lerNumero(v.porcao), custoPorUnidadeCadastro: ins ? custoUnitarioEfetivoInsumo(ins) : null, unidadeCadastro: unCad,
  }), [v, ins, unCad]);
  const nomeSugerido = ins && lerNumero(v.porcao) > 0 ? `${ins.nome} porcionado ${num(lerNumero(v.porcao))} g` : "";
  const mudar = (m) => setV((x) => ({ ...x, ...m }));

  async function salvar() {
    if (salvando) return;
    setErro(null);
    if (!ins) return setErro("Escolha o produto que vai ser porcionado.");
    if (!calc.ok) return setErro(calc.motivos[0]);
    if (!["g", "kg", "ml", "l"].includes(unCad)) return setErro(`"${ins.nome}" está cadastrado em ${unCad}: para porcionar por peso, o cadastro precisa estar em kg, g, L ou ml.`);
    setSalvando(true);
    try {
      const nome = (v.nome || nomeSugerido).trim();
      const r = await salvarPrePreparo({
        id, unidade_id: unidadeId, nome, departamento: "cozinha", rendimento: calc.porcoes, rendimento_unidade: "un",
        validade_dias: lerNumero(v.validade) || null, categoria: CATEGORIA_PORCIONAMENTO, descricao: descricaoDe(v), foto: ficha?.imagem || "", peso_final_g: calc.limpoG,
        itens: [{ insumo_id: ins.id, quantidade: calc.quantidadeCadastro }],
      });
      if (r.error) return setErro(r.error);
      const passos = passosDoPorcionamento({ nomeProduto: ins.nome, calc, embalagem: v.embalagem, armazenamento: v.guardar, validadeDias: lerNumero(v.validade) || null });
      const mp = await salvarModoDePreparo(id, { modo_preparo: passos, tempo_preparo: null, peso_porcao_g: calc.porcaoG });
      if (mp.error) return setErro(`Ficha salva, mas o passo a passo não: ${mp.error}`);
      if (r.offline || mp.offline) { setAviso("Sem internet: a ficha foi guardada no aparelho e vai para o sistema quando a conexão voltar."); return; }
      await onSalvo();
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Secao titulo={ficha ? `Editar ${ficha.nome_receita}` : "Nova ficha de porcionamento"} direita={<button type="button" onClick={onFechar} aria-label="Fechar" className="grid h-11 w-11 place-items-center rounded-lg text-hf-muted hover:bg-hf-elevated"><X size={18} /></button>}>
      <div className="space-y-4">
        <div>
          <p className="mb-1 text-[13px] font-medium text-hf-muted">Produto que chega para porcionar</p>
          {ins && !buscando ? (
            <div className="flex items-center justify-between gap-2 rounded-xl border border-hf-border px-3 py-2">
              <span className="min-w-0"><span className="block text-sm font-bold text-hf-text">{ins.nome}</span>
                <span className="block text-xs text-hf-muted">{custoUnitarioEfetivoInsumo(ins) > 0 ? `${brl(custoUnitarioEfetivoInsumo(ins))} por ${unCad === "l" ? "L" : unCad}` : "Sem custo de compra no cadastro"}</span></span>
              <button type="button" onClick={() => setBuscando(true)} className="min-h-[44px] text-sm font-bold text-hf-accent hover:underline">Trocar</button>
            </div>
          ) : (
            <BuscaItens base={base} modo="ingrediente" semPrePreparos
              onEscolher={(r) => { if (r.tipo !== "ingrediente") return; const i = base.insumos.get(r.id); const u = String(i?.unidade_medida || "kg").toLowerCase(); mudar({ insumoId: r.id, brutoUn: ["g", "kg", "ml", "l"].includes(u) ? u : "kg" }); setBuscando(false); }}
              onCriarIngrediente={() => setErro("Cadastre o produto em Ingredientes e volte aqui.")} />
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Campo rotulo="Quanto entra (bruto)">
            <div className="grid grid-cols-[minmax(0,1fr)_88px] gap-2">
              <CampoNumero valor={v.bruto} onChange={(x) => mudar({ bruto: x })} placeholder="Ex.: 5" aria-label="Peso bruto" />
              <select className={inputCls} value={v.brutoUn} onChange={(e) => mudar({ brutoUn: e.target.value })} aria-label="Unidade do peso bruto">
                <option value="kg">kg</option><option value="g">g</option><option value="l">L</option><option value="ml">ml</option>
              </select>
            </div>
          </Campo>
          <Campo rotulo="Perda na limpeza" dica="Aparas, gordura, osso, casca.">
            <div className="grid grid-cols-[minmax(0,1fr)_88px] gap-2">
              <CampoNumero valor={v.perda} onChange={(x) => mudar({ perda: x })} placeholder="Ex.: 10" aria-label="Perda na limpeza" />
              <select className={inputCls} value={v.perdaModo} onChange={(e) => mudar({ perdaModo: e.target.value })} aria-label="Perda em porcentagem ou gramas">
                <option value="pct">%</option><option value="g">g</option>
              </select>
            </div>
          </Campo>
          <Campo rotulo="Peso de cada porção"><CampoNumero valor={v.porcao} onChange={(x) => mudar({ porcao: x })} sufixo="g" placeholder="Ex.: 150" aria-label="Peso da porção" /></Campo>
        </div>

        {calc.ok ? (
          <div className="rounded-xl border border-hf-border bg-hf-elevated/60 p-3">
            <p className="text-2xl font-bold tabular-nums text-hf-text">{calc.porcoes} porções de {num(calc.porcaoG)} g</p>
            <ul className="mt-2 grid gap-x-4 gap-y-1 text-sm text-hf-text-2 sm:grid-cols-2">
              <li>Peso limpo: <b className="tabular-nums text-hf-text">{kgTxt(calc.limpoG)}</b> ({num(calc.aproveitamentoPct)}% de aproveitamento)</li>
              <li>Perda na limpeza: <b className="tabular-nums text-hf-text">{kgTxt(calc.perdaG)}</b></li>
              {calc.sobraG > 0 && <li>Sobra que não fecha porção: <b className="tabular-nums text-hf-text">{kgTxt(calc.sobraG)}</b></li>}
              <li>Custo da porção: <b className="tabular-nums text-hf-text">{calc.custoPorcao !== null ? brl(calc.custoPorcao) : "DADOS INSUFICIENTES (produto sem custo de compra)"}</b></li>
              {calc.custoKgLimpo !== null && <li>Custo do kg limpo: <b className="tabular-nums text-hf-text">{brl(calc.custoKgLimpo)}</b> (o bruto custa {brl(calc.custoTotal)})</li>}
            </ul>
            <p className="mt-2 text-xs text-hf-muted">A perda e a sobra ficam no custo das porções. Valores: ESTIMATIVA pela ficha; a perda real aparece na pesagem.</p>
          </div>
        ) : (
          <p className="text-sm text-hf-muted">{calc.motivos[0]}</p>
        )}

        <div className="grid gap-3 sm:grid-cols-3">
          <Campo rotulo="Embalagem"><input className={inputCls} value={v.embalagem} onChange={(e) => mudar({ embalagem: e.target.value })} placeholder="Ex.: saco a vácuo" /></Campo>
          <Campo rotulo="Como guardar">
            <select className={inputCls} value={v.guardar} onChange={(e) => mudar({ guardar: e.target.value })}>
              <option value="">Escolha</option>{GUARDAR.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </Campo>
          <Campo rotulo="Validade"><CampoNumero valor={v.validade} onChange={(x) => mudar({ validade: x })} sufixo="dias" placeholder="Ex.: 30" aria-label="Validade em dias" /></Campo>
        </div>
        <Campo rotulo="Nome no estoque e nas fichas"><input className={inputCls} value={v.nome} onChange={(e) => mudar({ nome: e.target.value })} placeholder={nomeSugerido || "Ex.: Frango porcionado 150 g"} /></Campo>

        {erro && <Aviso tipo="alerta">{erro}</Aviso>}
        {aviso && <Aviso>{aviso}</Aviso>}
        <div className="flex flex-wrap gap-2">
          <Botao onClick={salvar} disabled={salvando} className="min-h-[48px]">{salvando ? "Salvando…" : "Salvar ficha"}</Botao>
          <Botao variante="secundario" onClick={onFechar}>Cancelar</Botao>
        </div>
      </div>
    </Secao>
  );
}

export default function Porcionamento() {
  const { base, recarregar } = useMarmitaria();
  const [editando, setEditando] = useState(false); // false | true | ficha
  const fichas = (base?.prePreparos || []).filter(ehPorcionamento);
  if (editando) return <Editor key={editando?.id || "nova"} ficha={editando === true ? null : editando} onFechar={() => setEditando(false)} onSalvo={async () => { await recarregar(); setEditando(false); }} />;
  return (
    <Secao titulo="Fichas de porcionamento" subtitulo="O produto chega em peça ou pacote, é limpo e cortado em porções iguais. Para produzir, use Converter em Hoje: dá baixa no bruto e as porções entram no estoque."
      direita={<Botao onClick={() => setEditando(true)}>Nova ficha</Botao>}>
      {!fichas.length ? <p className="text-sm text-hf-text-2">Nenhuma ficha de porcionamento. Ex.: 5 kg de peito de frango, 10% de perda, porções de 150 g → 30 porções.</p> : (
        <ul className="divide-y divide-hf-border">
          {fichas.map((f) => {
            const ingr = f.fichas_ingredientes?.find((i) => i.insumo_id);
            const ins = ingr ? base.insumos.get(ingr.insumo_id) : null;
            const custo = ins && custoUnitarioEfetivoInsumo(ins) > 0 && f.rendimento_porcoes > 0 ? (ingr.quantidade * custoUnitarioEfetivoInsumo(ins)) / f.rendimento_porcoes : null;
            return (
              <li key={f.id} className="flex items-center justify-between gap-3 py-2">
                <span className="min-w-0">
                  <span className="block text-sm font-bold text-hf-text">{f.nome_receita}</span>
                  <span className="block text-xs text-hf-muted">
                    {ins ? `${num(ingr.quantidade)} ${String(ins.unidade_medida || "").toLowerCase() === "l" ? "L" : ins.unidade_medida} de ${ins.nome} → ` : ""}{num(f.rendimento_porcoes)} porções{f.peso_porcao_g ? ` de ${num(f.peso_porcao_g)} g` : ""}
                    {custo !== null ? ` · ${brl(custo)} cada` : ""}{f.validade_dias ? ` · validade ${f.validade_dias} dias` : ""}
                  </span>
                </span>
                <span className="flex shrink-0 gap-3">
                  <button type="button" onClick={() => imprimirGuias([guiaDoPrePreparo(f, base.insumos, base.fichas)])} className="min-h-[44px] text-sm font-bold text-hf-accent hover:underline">Imprimir</button>
                  <button type="button" onClick={() => setEditando(f)} className="min-h-[44px] text-sm font-bold text-hf-accent hover:underline">Editar</button>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Secao>
  );
}
