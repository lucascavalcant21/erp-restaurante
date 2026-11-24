"use client";

// Tela de SALMOURAS ou EMPANADOS (dono, 23/11/2026): calculadora primeiro (o
// que o funcionário veio fazer) e o cadastro "por quilo" para quem pode editar.
// Serve para restaurante, delivery e eventos. Dados: config_sistema.params
// .formulas_cozinha; contas em app/lib/formulas-por-quilo.mjs.

import { useEffect, useMemo, useState } from "react";
import { Check, Loader2, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import CabecalhoTela from "../ui/CabecalhoTela";
import { useERP } from "../../context/ERPContext";
import { usePermission } from "../access-control/PermissionGate";
import { fetchFormulasCozinha, salvarListaFormulas } from "../../lib/parametros";
import CalculadoraFormula from "./CalculadoraFormula";
import { CATEGORIAS_SALMOURA, TIPOS_FORMULA, UNIDADES_FORMULA, conferirFormula, listaDoTipo, normalizarFormula, normalizarFormulas, novoIdFormula } from "../../lib/formulas-por-quilo.mjs";

const inputCls = "h-12 w-full rounded-full border border-hf-border bg-hf-surface px-4 text-[16px] font-semibold text-hf-text outline-none focus:border-hf-accent";
const pill = (ativo) => `min-h-[44px] shrink-0 rounded-full px-4 text-sm font-bold ${ativo ? "bg-hf-menu text-white" : "border border-hf-border bg-hf-surface text-hf-text-2"}`;
const semAcento = (v) => String(v ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const PERM = { salmoura: "cozinha.brines", empanado: "cozinha.breading" };

function novaFormula(tipo) {
  return tipo === "empanado"
    ? { tipo, nome: "", referencia: "Farinha panko", kgReferencia: 1, produtos: [], tempo: "", preparo: "",
        secoes: [{ id: novoIdFormula("s"), titulo: "Farinha temperada", itens: [{ id: novoIdFormula("i"), nome: "Sal", qtd: "", unidade: "g" }] },
                 { id: novoIdFormula("s"), titulo: "Massinha", itens: [{ id: novoIdFormula("i"), nome: "Farinha de trigo", qtd: "", unidade: "g" }, { id: novoIdFormula("i"), nome: "Sal", qtd: "", unidade: "g" }, { id: novoIdFormula("i"), nome: "Ovos", qtd: "", unidade: "un" }] }] }
    : { tipo, nome: "", categoria: "peixe", kgReferencia: 1, produtos: [], tempo: "", preparo: "",
        secoes: [{ id: novoIdFormula("s"), titulo: "Salmoura", itens: [{ id: novoIdFormula("i"), nome: "Água", qtd: "", unidade: "ml" }, { id: novoIdFormula("i"), nome: "Sal", qtd: "", unidade: "g" }] }] };
}

function Editor({ inicial, outros, salvando, onSalvar, onCancelar }) {
  const [f, setF] = useState(() => ({ ...inicial, produtosTxt: (inicial.produtos || []).join(", "), kgReferencia: String(inicial.kgReferencia ?? 1).replace(".", ","), secoes: structuredClone(inicial.secoes || []) }));
  const [erros, setErros] = useState([]);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const setItem = (si, ii, k, v) => setF((x) => { const secoes = structuredClone(x.secoes); secoes[si].itens[ii][k] = v; return { ...x, secoes }; });
  const addItem = (si) => setF((x) => { const secoes = structuredClone(x.secoes); secoes[si].itens.push({ id: novoIdFormula("i"), nome: "", qtd: "", unidade: "g" }); return { ...x, secoes }; });
  const tirarItem = (si, ii) => setF((x) => { const secoes = structuredClone(x.secoes); secoes[si].itens.splice(ii, 1); return { ...x, secoes }; });
  const ref = f.tipo === "empanado" ? (f.referencia || "farinha") : "produto";

  function salvar() {
    const dados = { ...f, produtos: f.produtosTxt, secoes: f.secoes.map((s) => ({ ...s, itens: s.itens.filter((i) => String(i.nome).trim()) })) };
    const e = conferirFormula(dados, outros);
    setErros(e);
    if (!e.length) onSalvar(normalizarFormula({ ...dados, atualizado_em: new Date().toISOString() }, f.tipo));
  }

  return (
    <div className="space-y-4 rounded-3xl border border-hf-border bg-hf-surface p-4">
      <label className="block"><span className="text-[13px] font-medium text-hf-muted">Nome</span>
        <input autoFocus value={f.nome} onChange={(e) => set("nome", e.target.value)} placeholder={f.tipo === "empanado" ? "Ex.: Empanado panko" : "Ex.: Salmoura de peixe"} className={`${inputCls} mt-1`} />
      </label>
      {f.tipo === "salmoura" ? (
        <div><span className="text-[13px] font-medium text-hf-muted">Para</span>
          <div className="mt-1 flex flex-wrap gap-2">{CATEGORIAS_SALMOURA.map((c) => <button key={c.id} type="button" aria-pressed={f.categoria === c.id} onClick={() => set("categoria", c.id)} className={pill(f.categoria === c.id)}>{c.rotulo}</button>)}</div>
        </div>
      ) : (
        <label className="block"><span className="text-[13px] font-medium text-hf-muted">Farinha</span>
          <input value={f.referencia} onChange={(e) => set("referencia", e.target.value)} placeholder="Farinha panko" className={`${inputCls} mt-1`} />
        </label>
      )}
      <label className="block"><span className="text-[13px] font-medium text-hf-muted">As quantidades abaixo são para quantos kg de {ref}?</span>
        <div className="mt-1 flex items-center gap-2"><input inputMode="decimal" value={f.kgReferencia} onChange={(e) => set("kgReferencia", e.target.value)} className={`${inputCls} w-28 text-center`} /><span className="font-bold text-hf-text-2">kg</span></div>
      </label>
      <label className="block"><span className="text-[13px] font-medium text-hf-muted">Usada em quais produtos? (separe por vírgula)</span>
        <input value={f.produtosTxt} onChange={(e) => set("produtosTxt", e.target.value)} placeholder="Ex.: Filé de pirarucu empanado, Isca de peixe" className={`${inputCls} mt-1`} />
      </label>

      {f.secoes.map((s, si) => (
        <div key={s.id} className="rounded-2xl bg-hf-elevated p-3">
          <input value={s.titulo} onChange={(e) => setF((x) => { const secoes = structuredClone(x.secoes); secoes[si].titulo = e.target.value; return { ...x, secoes }; })}
            aria-label="Nome da parte" className="mb-2 h-10 w-full rounded-full border border-hf-border bg-hf-surface px-4 text-sm font-black text-hf-text outline-none" />
          <ul className="space-y-2">
            {s.itens.map((i, ii) => (
              <li key={i.id} className="grid grid-cols-[1fr_84px_auto_auto] items-center gap-1.5">
                <input value={i.nome} onChange={(e) => setItem(si, ii, "nome", e.target.value)} placeholder="Ingrediente" aria-label="Ingrediente" className="h-11 min-w-0 rounded-full border border-hf-border bg-hf-surface px-3 text-[15px] font-semibold outline-none" />
                <input inputMode="decimal" value={i.qtd ?? ""} onChange={(e) => setItem(si, ii, "qtd", e.target.value)} placeholder="Qtd" aria-label={`Quantidade de ${i.nome || "ingrediente"}`} className="h-11 min-w-0 rounded-full border border-hf-border bg-hf-surface px-2 text-center text-[15px] font-bold tabular-nums outline-none" />
                <select value={i.unidade} onChange={(e) => setItem(si, ii, "unidade", e.target.value)} aria-label="Unidade" className="h-11 rounded-full border border-hf-border bg-hf-surface px-2 text-sm font-bold">
                  {UNIDADES_FORMULA.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
                <button type="button" aria-label="Tirar ingrediente" onClick={() => tirarItem(si, ii)} className="grid h-11 w-11 place-items-center rounded-full text-hf-danger"><Trash2 size={16} /></button>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" onClick={() => addItem(si)} className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-hf-border bg-hf-surface px-4 text-sm font-bold text-hf-text"><Plus size={15} /> Ingrediente</button>
            {f.secoes.length > 1 && <button type="button" onClick={() => setF((x) => ({ ...x, secoes: x.secoes.filter((_, k) => k !== si) }))} className="min-h-[44px] rounded-full px-4 text-sm font-bold text-hf-danger">Tirar esta parte</button>}
          </div>
        </div>
      ))}
      <button type="button" onClick={() => setF((x) => ({ ...x, secoes: [...x.secoes, { id: novoIdFormula("s"), titulo: "Outra parte", itens: [{ id: novoIdFormula("i"), nome: "", qtd: "", unidade: "g" }] }] }))}
        className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-dashed border-hf-border px-4 text-sm font-bold text-hf-text-2"><Plus size={15} /> Outra parte (ex.: massinha)</button>

      <label className="block"><span className="text-[13px] font-medium text-hf-muted">Tempo (opcional)</span>
        <input value={f.tempo} onChange={(e) => set("tempo", e.target.value)} placeholder={f.tipo === "salmoura" ? "Ex.: 2 horas na geladeira" : "Ex.: empanar na hora de fritar"} className={`${inputCls} mt-1`} />
      </label>
      <label className="block"><span className="text-[13px] font-medium text-hf-muted">Como fazer (opcional)</span>
        <textarea value={f.preparo} onChange={(e) => set("preparo", e.target.value)} rows={4} className="mt-1 w-full rounded-3xl border border-hf-border bg-hf-surface px-4 py-3 text-[15px] text-hf-text outline-none focus:border-hf-accent" />
      </label>
      {erros.length > 0 && <ul className="space-y-1 text-[14px] font-semibold text-hf-danger">{erros.map((e) => <li key={e}>{e}</li>)}</ul>}
      <div className="flex gap-2">
        <button type="button" onClick={onCancelar} className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-full border border-hf-border text-sm font-bold text-hf-text-2"><X size={16} /> Cancelar</button>
        <button type="button" onClick={salvar} disabled={salvando} className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-hf-menu text-sm font-black text-white disabled:opacity-50">{salvando ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Salvar</button>
      </div>
    </div>
  );
}

export default function TelaFormulas({ tipo = "salmoura", embutido = false }) {
  const T = TIPOS_FORMULA[tipo];
  const chave = tipo === "empanado" ? "empanados" : "salmouras";
  const { unidadeAtiva } = useERP();
  const podeCriar = usePermission(`${PERM[tipo]}.create`);
  const podeEditar = usePermission(`${PERM[tipo]}.edit`);
  const podeExcluir = usePermission(`${PERM[tipo]}.delete`);
  const [lista, setLista] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erroCarga, setErroCarga] = useState("");
  const [aba, setAba] = useState("calc");
  const [cat, setCat] = useState("todas");
  const [busca, setBusca] = useState("");
  const [selId, setSelId] = useState(null);
  const [editando, setEditando] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState("");

  useEffect(() => {
    let vivo = true;
    setCarregando(true);
    fetchFormulasCozinha(unidadeAtiva).then(({ data, error }) => {
      if (!vivo) return;
      setErroCarga(error || "");
      setLista(listaDoTipo(normalizarFormulas(data), tipo));
      setCarregando(false);
    });
    return () => { vivo = false; };
  }, [unidadeAtiva, tipo]);

  const visiveis = useMemo(() => {
    const q = semAcento(busca).trim();
    return lista.filter((f) => (cat === "todas" || f.categoria === cat) && (!q || semAcento(`${f.nome} ${f.produtos.join(" ")}`).includes(q)));
  }, [lista, cat, busca]);
  const sel = lista.find((f) => f.id === selId) || (visiveis.length === 1 ? visiveis[0] : null);
  const cats = CATEGORIAS_SALMOURA.filter((c) => lista.some((f) => f.categoria === c.id));

  async function gravar(nova, msg) {
    setSalvando(true);
    const r = await salvarListaFormulas(unidadeAtiva, chave, nova);
    setSalvando(false);
    if (r?.error) { setAviso(`Não salvou: ${r.error}`); return; }
    setLista(listaDoTipo(normalizarFormulas({ [chave]: nova }), tipo));
    setEditando(null);
    setAviso(msg);
    setTimeout(() => setAviso(""), 3000);
  }
  const salvarItem = (f) => gravar(editando === "novo" ? [...lista, f] : lista.map((x) => (x.id === f.id ? f : x)), `${f.nome} salva.`);
  const excluir = (f) => { if (window.confirm(`Excluir "${f.nome}"?`)) gravar(lista.filter((x) => x.id !== f.id), `${f.nome} excluída.`); };

  if (!unidadeAtiva || unidadeAtiva === "todas") return <div className="mx-auto max-w-3xl px-4 py-8 text-center font-bold text-hf-text-2">Escolha uma unidade.</div>;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-5 sm:px-6">
      {!embutido && <CabecalhoTela titulo={tipo === "salmoura" ? "Calculadora de salmoura" : "Empanados"} subtitulo={tipo === "salmoura" ? "Escolha o produto e os quilos: o sistema calcula a salmoura" : "Farinha temperada e massinha na medida dos quilos de farinha"} />}
      {embutido && <h1 className="text-xl font-black text-hf-text">{tipo === "salmoura" ? "Calculadora de salmoura" : "Empanados"}</h1>}

      {(podeCriar || podeEditar) && (
        <div className="grid grid-cols-2 gap-1 rounded-full bg-hf-elevated p-1 sm:inline-grid sm:w-auto">
          {[["calc", "Calculadora"], ["cad", "Cadastro"]].map(([id, rot]) => (
            <button key={id} type="button" aria-pressed={aba === id} onClick={() => { setAba(id); setEditando(null); }} className={`h-10 rounded-full px-5 text-sm font-black ${aba === id ? "bg-hf-menu text-white" : "text-hf-text-2"}`}>{rot}</button>
          ))}
        </div>
      )}
      {aviso && <p role="status" className="rounded-full bg-hf-elevated px-4 py-2 text-sm font-bold text-hf-text">{aviso}</p>}
      {erroCarga && <p role="alert" className="rounded-2xl bg-hf-elevated px-4 py-2 text-sm font-bold text-hf-danger">Não consegui carregar: {erroCarga}</p>}

      {carregando ? (
        <p className="py-8 text-center font-bold text-hf-text-2"><Loader2 className="mr-2 inline animate-spin" size={18} />Carregando…</p>
      ) : aba === "calc" ? (
        !lista.length ? (
          <div className="rounded-3xl border border-dashed border-hf-border px-4 py-8 text-center">
            <p className="font-black text-hf-text">Nenhuma {T.singular} cadastrada ainda.</p>
            {(podeCriar) && <button type="button" onClick={() => { setAba("cad"); setEditando("novo"); }} className="mt-3 inline-flex h-12 items-center gap-2 rounded-full bg-hf-menu px-5 text-sm font-black text-white"><Plus size={16} /> Cadastrar {T.singular}</button>}
          </div>
        ) : (
          <>
            {tipo === "salmoura" && cats.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
                <button type="button" onClick={() => { setCat("todas"); setSelId(null); }} className={pill(cat === "todas")}>Todas</button>
                {cats.map((c) => <button key={c.id} type="button" onClick={() => { setCat(c.id); setSelId(null); }} className={pill(cat === c.id)}>{c.rotulo}</button>)}
              </div>
            )}
            {lista.length > 5 && (
              <label className="flex h-12 items-center gap-2 rounded-full border border-hf-border bg-hf-surface px-4"><Search size={16} className="text-hf-muted" />
                <input value={busca} onChange={(e) => { setBusca(e.target.value); setSelId(null); }} placeholder="Procurar pelo nome ou produto (ex.: pirarucu)" className="min-w-0 flex-1 bg-transparent text-[16px] outline-none" />
              </label>
            )}
            <div className="flex flex-wrap gap-2">
              {visiveis.map((f) => (
                <button key={f.id} type="button" aria-pressed={sel?.id === f.id} onClick={() => setSelId(f.id)}
                  className={`min-h-[48px] rounded-2xl px-4 py-2 text-left ${sel?.id === f.id ? "bg-hf-menu text-white" : "border border-hf-border bg-hf-surface text-hf-text"}`}>
                  <span className="block text-[15px] font-black">{f.nome}</span>
                  {f.produtos.length > 0 && <span className={`block text-[12px] ${sel?.id === f.id ? "text-white/75" : "text-hf-muted"}`}>{f.produtos.slice(0, 3).join(", ")}</span>}
                </button>
              ))}
              {!visiveis.length && <p className="text-sm font-semibold text-hf-muted">Nada com esse nome.</p>}
            </div>
            {sel ? <div className="rounded-3xl border border-hf-border bg-hf-elevated p-4"><CalculadoraFormula key={sel.id} formula={sel} /></div>
              : <p className="text-sm font-semibold text-hf-muted">Toque numa {T.singular} para calcular.</p>}
          </>
        )
      ) : (
        <div className="space-y-3">
          {podeCriar && editando !== "novo" && <button type="button" onClick={() => setEditando("novo")} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-hf-menu text-[15px] font-black text-white"><Plus size={18} /> Nova {T.singular}</button>}
          {editando === "novo" && <Editor inicial={novaFormula(tipo)} outros={lista} salvando={salvando} onSalvar={salvarItem} onCancelar={() => setEditando(null)} />}
          <ul className="space-y-2">
            {lista.map((f) => editando === f.id ? (
              <li key={f.id}><Editor inicial={f} outros={lista} salvando={salvando} onSalvar={salvarItem} onCancelar={() => setEditando(null)} /></li>
            ) : (
              <li key={f.id} className="flex items-center gap-3 rounded-3xl border border-hf-border bg-hf-surface px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[16px] font-black text-hf-text">{f.nome}</p>
                  <p className="text-[13px] text-hf-muted">
                    {tipo === "salmoura" ? (CATEGORIAS_SALMOURA.find((c) => c.id === f.categoria)?.rotulo || "") : f.referencia} · para {String(f.kgReferencia).replace(".", ",")} kg · {f.secoes.reduce((t, s) => t + s.itens.length, 0)} ingredientes
                    {f.produtos.length ? ` · ${f.produtos.join(", ")}` : ""}
                  </p>
                </div>
                {podeEditar && <button type="button" aria-label={`Editar ${f.nome}`} onClick={() => setEditando(f.id)} className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-hf-border text-hf-text-2"><Pencil size={16} /></button>}
                {podeExcluir && <button type="button" aria-label={`Excluir ${f.nome}`} onClick={() => excluir(f)} className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-hf-border text-hf-danger"><Trash2 size={16} /></button>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
