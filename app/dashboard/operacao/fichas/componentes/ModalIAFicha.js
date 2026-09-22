"use client";

// CRIAR COM IA — a receita (texto e/ou foto) vira um rascunho de ficha do tipo
// da aba em que a pessoa está: em Pratos, ficha de montagem; em Pré-preparos,
// ficha de produção. Nada é gravado aqui: o rascunho abre no editor para ser
// conferido e salvo.

import { useMemo, useRef, useState } from "react";
import { AlertTriangle, Camera, CheckCircle2, Loader2, Sparkles, X } from "lucide-react";
import { comprimirFotoParaIA } from "../../../../lib/imagem";
import { salvarInsumo } from "../../../../lib/operacao";
import { configDoTipo, estiloDoTipo, tipoFichaDe } from "../../../../lib/ficha-modelo.mjs";
import { itemDeOpcao } from "../../../../lib/ficha-editor.mjs";
import { converterParaBaseDoInsumo } from "../../../../lib/ficha-calculos.mjs";
import { unidadeNormalizada } from "../../../../lib/ingredientes-utils.mjs";
import { ICONE_DO_TIPO } from "./EditorFicha";

const DIACRITICOS = new RegExp("[" + String.fromCharCode(0x0300) + "-" + String.fromCharCode(0x036f) + "]", "g");
const normalizar = (s) => String(s || "").toLowerCase().normalize("NFD").replace(DIACRITICOS, "").trim();

// Casa o nome lido pela IA com o que já está cadastrado. No prato, um "Arroz
// branco" deve virar o pré-preparo da casa antes de virar o insumo "arroz".
function vinculoProvavel(nome, opcoes) {
  const alvo = normalizar(nome);
  if (!alvo) return "novo";
  const exata = opcoes.find(o => normalizar(o.nome) === alvo);
  if (exata) return exata.valor;
  const parecida = opcoes.find(o => { const n = normalizar(o.nome); return n.includes(alvo) || alvo.includes(n); });
  return parecida ? parecida.valor : "novo";
}

export default function ModalIAFicha({ tipo, departamento, insumos = [], fichas = [], unidadeId, onInsumoCriado, onUsar, onFechar }) {
  const cfg = configDoTipo(tipo);
  const Icone = ICONE_DO_TIPO[cfg.id];
  const [texto, setTexto] = useState("");
  const [imagem, setImagem] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const [resultado, setResultado] = useState(null);
  const entradaFoto = useRef(null);

  const bases = useMemo(() => fichas.filter(f => tipoFichaDe(f) === "pre_preparo"), [fichas]);
  const opcoes = useMemo(() => {
    const deInsumo = insumos.map(i => ({ valor: `insumo:${i.id}`, nome: i.nome, grupo: "Ingrediente" }));
    const dePreparo = bases.map(b => ({ valor: `base:${b.id}`, nome: b.nome_receita, grupo: "Pré-preparo" }));
    return cfg.id === "prato" ? [...dePreparo, ...deInsumo] : [...deInsumo, ...dePreparo];
  }, [insumos, bases, cfg.id]);

  const escolherFoto = async (e) => {
    const arquivo = e.target.files?.[0];
    e.target.value = "";
    if (!arquivo) return;
    const base64 = await comprimirFotoParaIA(arquivo);
    setImagem({ base64, previa: URL.createObjectURL(arquivo), nome: arquivo.name });
  };

  const gerar = async () => {
    if (!texto.trim() && !imagem) { setErro("Cole a receita em texto ou envie uma foto."); return; }
    setErro("");
    setCarregando(true);
    try {
      const resposta = await fetch("/api/ia-ficha", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          texto, tipo: cfg.id, departamento,
          imagem_base64: imagem?.base64 || null,
          imagem_media_type: imagem ? "image/jpeg" : null,
        }),
      });
      const dados = await resposta.json();
      if (!resposta.ok || dados.error) { setErro(dados.error || "Falha ao ler a receita."); return; }
      setResultado({
        ...dados,
        itens: (dados.ingredientes || []).map(ing => ({
          ...ing,
          vinculo: vinculoProvavel(ing.nome, opcoes),
          novo: { unidade_medida: ing.unidade_lida === "g" ? "kg" : ing.unidade_lida === "ml" ? "l" : ing.unidade_lida, custo: "", marca: "" },
          cadastrando: false,
        })),
      });
    } catch {
      setErro("Não consegui falar com a IA. Verifique a conexão.");
    } finally {
      setCarregando(false);
    }
  };

  const mudarItem = (indice, patch) => setResultado(r => ({ ...r, itens: r.itens.map((it, i) => (i === indice ? { ...it, ...patch } : it)) }));

  const cadastrar = async (indice) => {
    const item = resultado.itens[indice];
    const custo = Number(String(item.novo.custo).replace(",", "."));
    if (!(custo > 0)) { setErro(`Digite o custo de "${item.nome}" antes de cadastrar.`); return; }
    setErro("");
    mudarItem(indice, { cadastrando: true });
    const r = await salvarInsumo({
      departamento, nome: item.nome, marca: item.novo.marca.trim(), unidade_medida: item.novo.unidade_medida,
      custo_unitario: custo, unidade_id: unidadeId,
    });
    if (r.error || !r.id) {
      mudarItem(indice, { cadastrando: false });
      setErro(`Erro ao cadastrar "${item.nome}": ${r.error || "o banco não devolveu o id"}`);
      return;
    }
    const novoInsumo = { id: r.id, nome: item.nome, marca: item.novo.marca, unidade_medida: item.novo.unidade_medida, custo_unitario: custo, departamento };
    onInsumoCriado?.(novoInsumo);
    mudarItem(indice, { vinculo: `insumo:${r.id}`, cadastrando: false, insumoCriado: novoInsumo });
  };

  const usar = () => {
    const pendente = resultado.itens.find(it => it.vinculo === "novo");
    if (pendente) { setErro(`Cadastre ou vincule "${pendente.nome}" antes de continuar.`); return; }
    const fontesComNovos = { insumos: [...insumos, ...resultado.itens.map(it => it.insumoCriado).filter(Boolean)], fichas };
    const itens = [];
    for (const it of resultado.itens) {
      const item = itemDeOpcao(it.vinculo, fontesComNovos, 0);
      if (!item || itens.some(i => i.chave === item.chave)) continue;
      // A IA lê "300 g"; o editor guarda na unidade-base (kg, L, un).
      const destino = item.tipo === "base" ? item.unidade : (unidadeNormalizada(item.unidade) || item.unidade);
      itens.push({ ...item, quantidade: converterParaBaseDoInsumo(it.quantidade_lida, it.unidade_lida, destino) });
    }
    onUsar({
      nome_receita: resultado.nome_receita,
      modo_preparo: resultado.modo_preparo || "",
      tempo_preparo: resultado.tempo_preparo || "",
      equipamentos: resultado.equipamentos || [],
      alergenicos: resultado.alergenicos || [],
      armazenamento: resultado.armazenamento || undefined,
      departamento,
      itens,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/60 p-2 backdrop-blur-sm sm:p-4" style={estiloDoTipo(cfg)}>
      <div role="dialog" aria-modal="true" aria-labelledby="ia-ficha-titulo"
        className="my-2 flex max-h-[calc(100dvh-1rem)] w-full max-w-3xl flex-col rounded-3xl bg-card shadow-2xl sm:max-h-[90vh]">
        <header className="flex items-center gap-3 border-b-4 border-[color:var(--tipo)] p-4 sm:px-6">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[color:var(--tipo)] text-[color:var(--tipo-fg)]"><Icone size={22} /></span>
          <div className="min-w-0 flex-1">
            <h2 id="ia-ficha-titulo" className="text-xl font-black text-fg">Criar {cfg.id === "prato" ? "prato" : "pré-preparo"} com IA</h2>
            <p className="text-xs font-semibold text-muted">
              {cfg.id === "prato"
                ? "A IA monta a ficha de prato: ingredientes de um prato e a montagem."
                : "A IA monta a ficha de produção: ingredientes, modo de preparo, equipamentos e alergênicos."}
            </p>
          </div>
          <button type="button" onClick={onFechar} aria-label="Fechar" className="flex h-10 w-10 items-center justify-center rounded-full bg-elevated text-muted hover:text-fg"><X size={19} /></button>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
          {!resultado ? (
            <>
              <div>
                <label htmlFor="ia-texto" className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted">Colar a receita (opcional se enviar foto)</label>
                <textarea id="ia-texto" value={texto} onChange={e => setTexto(e.target.value)}
                  placeholder={cfg.id === "prato"
                    ? "Ex.: Picanha na brasa: 400 g de picanha, 300 g de arroz branco, farofa e vinagrete. Arroz à esquerda, picanha ao centro..."
                    : "Ex.: Tucupi reduzido: 1 L de tucupi, 20 g de alho, sal. Refogo o alho, junto o tucupi e reduzo por 20 minutos..."}
                  className="erp-input min-h-[140px] resize-y py-3 text-sm" />
              </div>
              <div>
                <p className="mb-1.5 text-xs font-bold uppercase tracking-wider text-muted">Ou enviar foto (caderno de receitas, print...)</p>
                <input ref={entradaFoto} type="file" accept="image/*" onChange={escolherFoto} className="hidden" />
                {imagem ? (
                  <div className="flex items-center gap-3 rounded-xl border border-line bg-elevated p-3">
                    <img src={imagem.previa} alt="" className="h-16 w-16 rounded-lg border border-line object-cover" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-fg">{imagem.nome}</p>
                      <button type="button" onClick={() => setImagem(null)} className="mt-1 text-xs font-bold text-muted hover:text-fg">Remover foto</button>
                    </div>
                  </div>
                ) : (
                  <button type="button" onClick={() => entradaFoto.current?.click()}
                    className="flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-line bg-elevated p-6 text-muted hover:border-[color:var(--tipo)] hover:text-fg">
                    <Camera size={24} /><span className="text-sm font-bold">Tirar foto ou escolher da galeria</span>
                  </button>
                )}
              </div>
            </>
          ) : (
            <>
              <div>
                <label htmlFor="ia-nome" className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted">Nome</label>
                <input id="ia-nome" value={resultado.nome_receita} onChange={e => setResultado(r => ({ ...r, nome_receita: e.target.value }))} className="erp-input font-black" />
              </div>

              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">Ingredientes identificados</p>
                <ul className="space-y-2">
                  {resultado.itens.map((it, i) => {
                    const vinculado = it.vinculo !== "novo";
                    return (
                      <li key={i} className={`rounded-xl border p-3 ${vinculado ? "border-line bg-card" : "border-[color:var(--warning)] bg-[color:var(--warning-soft)]"}`}>
                        <div className="flex flex-wrap items-center gap-2">
                          {vinculado ? <CheckCircle2 size={16} className="shrink-0 text-[color:var(--tipo)]" /> : <AlertTriangle size={16} className="shrink-0 text-[color:var(--warning-strong)]" />}
                          <span className="text-sm font-bold text-fg">{it.nome}</span>
                          <span className="text-xs font-bold text-muted">{it.quantidade_lida} {it.unidade_lida}</span>
                          <select value={it.vinculo} onChange={e => mudarItem(i, { vinculo: e.target.value })} aria-label={`Vincular ${it.nome}`}
                            className="ml-auto max-w-[60%] rounded-lg border border-line bg-card p-2 text-xs font-bold text-fg outline-none">
                            <option value="novo">Cadastrar novo ingrediente</option>
                            {opcoes.map(o => <option key={o.valor} value={o.valor}>{o.nome} ({o.grupo.toLowerCase()})</option>)}
                          </select>
                        </div>
                        {!vinculado ? (
                          <div className="mt-2 flex flex-wrap items-center gap-2 pl-6">
                            <input value={it.novo.marca} onChange={e => mudarItem(i, { novo: { ...it.novo, marca: e.target.value } })} placeholder="Marca (opcional)"
                              className="w-32 rounded-lg border border-line bg-card p-2 text-xs outline-none" />
                            <select value={it.novo.unidade_medida} onChange={e => mudarItem(i, { novo: { ...it.novo, unidade_medida: e.target.value } })}
                              aria-label="Unidade de compra" className="w-20 rounded-lg border border-line bg-card p-2 text-xs font-bold outline-none">
                              {["kg", "l", "un", "g", "ml"].map(u => <option key={u} value={u}>{u.toUpperCase()}</option>)}
                            </select>
                            <input type="text" inputMode="decimal" value={it.novo.custo} onChange={e => mudarItem(i, { novo: { ...it.novo, custo: e.target.value.replace(/[^0-9.,]/g, "") } })}
                              placeholder="Custo R$" aria-label="Custo por unidade de compra" className="w-24 rounded-lg border border-line bg-card p-2 text-xs font-bold outline-none" />
                            <button type="button" onClick={() => cadastrar(i)} disabled={it.cadastrando}
                              className="flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">
                              {it.cadastrando ? <Loader2 size={12} className="animate-spin" /> : null} Cadastrar e usar
                            </button>
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </div>

              <div>
                <label htmlFor="ia-instrucoes" className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted">{cfg.instrucoes.titulo} (editável)</label>
                <textarea id="ia-instrucoes" value={resultado.modo_preparo || ""} onChange={e => setResultado(r => ({ ...r, modo_preparo: e.target.value }))}
                  className="erp-input min-h-[150px] resize-y py-3 text-sm" />
              </div>

              {cfg.id === "pre_preparo" ? (
                <div className="grid gap-3 text-sm sm:grid-cols-2">
                  <p className="rounded-xl bg-elevated p-3"><b className="text-fg">Tempo de preparo:</b> {resultado.tempo_preparo ? `${resultado.tempo_preparo} min (estimativa da IA)` : "não informado"}</p>
                  <p className="rounded-xl bg-elevated p-3"><b className="text-fg">Equipamentos:</b> {resultado.equipamentos?.length ? resultado.equipamentos.join(", ") : "nenhum"}</p>
                  <p className="rounded-xl bg-elevated p-3"><b className="text-fg">Alergênicos:</b> {resultado.alergenicos?.length ? resultado.alergenicos.join(", ") : "nenhum identificado"}</p>
                  <p className="rounded-xl bg-elevated p-3"><b className="text-fg">Validade:</b> {resultado.armazenamento?.validade_dias ? `${resultado.armazenamento.validade_dias} dias (informada na receita)` : "preencha no editor"}</p>
                </div>
              ) : null}

              <button type="button" onClick={() => setResultado(null)} className="text-xs font-bold text-muted hover:text-fg">Voltar e enviar outra receita</button>
            </>
          )}
          {erro ? <p role="alert" className="rounded-xl border border-[color:var(--danger)] bg-[color:var(--danger-soft)] px-3 py-2 text-sm font-bold text-[color:var(--danger-strong)]">{erro}</p> : null}
        </div>

        <footer className="border-t border-line p-4 sm:px-6">
          {!resultado ? (
            <button type="button" onClick={gerar} disabled={carregando}
              className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[color:var(--tipo)] text-base font-black text-[color:var(--tipo-fg)] disabled:opacity-50">
              {carregando ? <><Loader2 size={18} className="animate-spin" /> Montando a ficha...</> : <><Sparkles size={18} /> Montar ficha de {cfg.id === "prato" ? "prato" : "pré-preparo"}</>}
            </button>
          ) : (
            <button type="button" onClick={usar}
              className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[color:var(--tipo)] text-base font-black text-[color:var(--tipo-fg)]">
              Abrir no editor para conferir e salvar
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}
