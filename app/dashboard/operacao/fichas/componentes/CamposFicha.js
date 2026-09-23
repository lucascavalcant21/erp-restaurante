"use client";

// Peças do editor de fichas, usadas pelos dois formulários (prato e
// pré-preparo). Cada peça recebe o valor e devolve o valor alterado; quem guarda
// o estado e grava é o EditorFicha.
//
// A cor vem do tipo pelas variáveis --tipo, --tipo-soft e --tipo-fg (definidas
// no contêiner do editor com estiloDoTipo), então a mesma peça fica verde no
// prato e azul-petróleo no pré-preparo sem nenhum "if".

import { useMemo, useRef, useState } from "react";
import {
  Camera, Check, ChefHat, FolderPlus, Loader2, Plus, Search, Sparkles, Trash2, Wine, X,
} from "lucide-react";
import { comprimirFotoParaIA } from "../../../../lib/imagem";
import { fmtBRL } from "../../../../components/ui";
import {
  ALERGENICOS, EQUIPAMENTOS_SUGERIDOS, CONSERVACOES, SETORES, rotuloUnidadeSetor,
  quantidadeComUnidade,
} from "../../../../lib/ficha-modelo.mjs";
import {
  subUnidade, buscarOpcoes, custoDosItens, precoSuspeito, rendimentoSomado, rendimentoEhAutomatizavel,
} from "../../../../lib/ficha-editor.mjs";
import { parseNumero } from "../../../../lib/ficha-calculos.mjs";

const numero = (n, casas = 3) => (Number(n) || 0).toLocaleString("pt-BR", { maximumFractionDigits: casas });

// ─── Estrutura ──────────────────────────────────────────────────────────────

export function SecaoEditor({ id, titulo, descricao, destaque = false, acao = null, children }) {
  return (
    <section id={id} className="scroll-mt-4 overflow-hidden rounded-2xl border border-line bg-card">
      <div className={`flex items-start justify-between gap-3 px-4 py-3 sm:px-5 ${
        destaque ? "bg-[color:var(--tipo)] text-[color:var(--tipo-fg)]" : "border-b border-line-soft"}`}>
        <div className="min-w-0">
          <h3 className={`text-xs font-black uppercase tracking-[0.14em] ${destaque ? "" : "text-[color:var(--tipo)]"}`}>{titulo}</h3>
          {descricao ? <p className={`mt-0.5 text-xs font-medium ${destaque ? "opacity-85" : "text-muted"}`}>{descricao}</p> : null}
        </div>
        {acao}
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

function Rotulo({ children, htmlFor }) {
  return <label htmlFor={htmlFor} className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted">{children}</label>;
}

// ─── Identificação ──────────────────────────────────────────────────────────

// Mesma compressão de sempre (600 px, JPEG 70%): a foto vai em base64 dentro
// da linha da ficha, então não pode ser grande.
export function CampoFoto({ imagem, onChange }) {
  const entrada = useRef(null);
  const [processando, setProcessando] = useState(false);
  const foto = imagem ? (String(imagem).startsWith("data:") ? imagem : `data:image/jpeg;base64,${imagem}`) : "";

  const escolher = async (e) => {
    const arquivo = e.target.files?.[0];
    e.target.value = "";
    if (!arquivo) return;
    setProcessando(true);
    try {
      const base64 = await comprimirFotoParaIA(arquivo, 600, 0.7);
      if (base64) onChange(base64);
    } finally {
      setProcessando(false);
    }
  };

  return (
    <div className="relative h-24 w-24 shrink-0 sm:h-28 sm:w-28">
      <button type="button" onClick={() => entrada.current?.click()} title={foto ? "Trocar foto" : "Adicionar foto"}
        className="group relative flex h-full w-full items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-line bg-elevated text-muted hover:border-[color:var(--tipo)]">
        {foto ? <img src={foto} alt="" className="h-full w-full object-cover" /> : (
          <span className="flex flex-col items-center gap-1 text-3xs font-bold uppercase tracking-widest">
            {processando ? <Loader2 size={22} className="animate-spin" /> : <Camera size={22} />} Foto
          </span>
        )}
      </button>
      <input ref={entrada} type="file" accept="image/*" onChange={escolher} className="hidden" />
      {foto ? (
        <button type="button" onClick={() => onChange("")} title="Remover foto" aria-label="Remover foto"
          className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full border border-line bg-card text-muted shadow-sm hover:text-fg">
          <X size={14} />
        </button>
      ) : null}
    </div>
  );
}

const ICONE_SETOR = { cozinha: ChefHat, bar: Wine };

export function SeletorSetor({ valor, onChange }) {
  return (
    <div>
      <Rotulo>Setor</Rotulo>
      <div className="grid grid-cols-2 gap-2">
        {Object.values(SETORES).map(setor => {
          const Icone = ICONE_SETOR[setor.id];
          const ativo = valor === setor.id;
          return (
            <button key={setor.id} type="button" onClick={() => onChange(setor.id)} aria-pressed={ativo}
              className={`flex min-h-12 items-center justify-center gap-2 rounded-xl border-2 px-3 text-sm font-black transition ${
                ativo ? "border-[color:var(--tipo)] bg-[color:var(--tipo-soft)] text-[color:var(--tipo)]" : "border-line bg-card text-muted hover:text-fg"}`}>
              <Icone size={17} /> {setor.rotulo}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function CampoCategoria({ valor, opcoes, onChange, onGerenciar }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <Rotulo htmlFor="ficha-categoria">Categoria</Rotulo>
        {onGerenciar ? (
          <button type="button" onClick={onGerenciar} className="mb-1.5 flex items-center gap-1 text-xs font-bold text-[color:var(--tipo)] hover:underline">
            <FolderPlus size={13} /> Gerenciar
          </button>
        ) : null}
      </div>
      <select id="ficha-categoria" value={valor || ""} onChange={e => onChange(e.target.value)} className="erp-input" style={{ appearance: "auto" }}>
        <option value="">Sem categoria</option>
        {valor && !opcoes.includes(valor) ? <option value={valor}>{valor}</option> : null}
        {opcoes.map(c => <option key={c} value={c}>{c}</option>)}
      </select>
    </div>
  );
}

// ─── Ingredientes ───────────────────────────────────────────────────────────

// Busca por digitação (a lista tem centenas de itens) e, em cada linha, só o
// ingrediente e a quantidade. Custo e perda não aparecem aqui: a ficha mostra o
// que vai no prato, a conta fica com o sistema.
export function ListaIngredientes({ itens, opcoes, onAdicionar, onQuantidade, onAlternarModo, onRemover, onSubstituir }) {
  const [busca, setBusca] = useState("");
  const [alvo, setAlvo] = useState(null);
  const [substituto, setSubstituto] = useState("");
  const sugestoes = useMemo(() => buscarOpcoes(opcoes, busca), [opcoes, busca]);
  const jaNaFicha = new Set(itens.map(i => i.chave));

  const adicionar = (valor) => {
    onAdicionar(valor);
    setBusca("");
  };

  return (
    <div>
      <div className="relative">
        <div className="flex items-center gap-2 rounded-xl border border-line bg-elevated px-3 focus-within:border-[color:var(--tipo)]">
          <Search size={17} className="shrink-0 text-subtle" />
          <input value={busca} onChange={e => setBusca(e.target.value)} aria-label="Buscar ingrediente"
            placeholder="Digite para adicionar ingrediente ou pré-preparo"
            className="h-12 min-w-0 flex-1 bg-transparent text-[15px] font-semibold text-fg outline-none placeholder:font-medium placeholder:text-subtle" />
          {busca ? <button type="button" onClick={() => setBusca("")} aria-label="Limpar busca" className="shrink-0 text-subtle hover:text-fg"><X size={16} /></button> : null}
        </div>
        {busca.trim() ? (
          <div className="mt-2 overflow-hidden rounded-xl border border-line bg-card shadow-sm">
            {sugestoes.length === 0 ? (
              <p className="p-3 text-sm font-semibold text-muted">Nada encontrado com esse nome.</p>
            ) : sugestoes.map(o => {
              const id = o.valor.split(":")[1];
              const repetido = jaNaFicha.has(id);
              return (
                <button key={o.valor + o.nome} type="button" disabled={repetido} onClick={() => adicionar(o.valor)}
                  className="flex w-full items-center gap-2 border-b border-line-soft px-3 py-2.5 text-left last:border-0 hover:bg-[color:var(--tipo-soft)] disabled:opacity-50">
                  <Plus size={15} className="shrink-0 text-[color:var(--tipo)]" />
                  <span className="min-w-0 flex-1 truncate text-sm font-bold text-fg">{o.nome}</span>
                  <span className="shrink-0 text-3xs font-bold uppercase tracking-wider text-subtle">
                    {repetido ? "já está na ficha" : `${o.grupo}${o.detalhe ? ` · ${o.detalhe}` : ""}`}
                  </span>
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      {itens.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-line p-5 text-center text-sm font-semibold text-muted">
          Nenhum ingrediente ainda. Busque acima para adicionar.
        </p>
      ) : (
        <div className="mt-4">
          <div className="flex items-center gap-3 border-b border-line px-1 pb-2 text-3xs font-bold uppercase tracking-wider text-subtle">
            <span className="flex-1">Ingrediente</span>
            <span className="w-[132px] text-right">Quantidade</span>
            <span className="w-9" />
          </div>
          <ul className="divide-y divide-[color:var(--line-soft)]">
            {itens.map(item => {
              const sub = subUnidade(item.unidade);
              const emSub = sub && item.modo === "sub";
              const fator = emSub ? sub.fator : 1;
              const unidade = emSub ? sub.sub : String(item.unidade || "un").toLowerCase();
              const valor = item.quantidade ? +(item.quantidade * fator).toFixed(4) : "";
              return (
                <li key={item.chave} className="flex items-center gap-3 px-1 py-2.5">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-bold text-fg">{item.nome}</span>
                    {item.tipo === "base" ? (
                      <span className="mt-0.5 inline-block rounded border border-[color:var(--ficha-preparo)] px-1.5 text-3xs font-bold uppercase tracking-wider text-[color:var(--ficha-preparo)]">pré-preparo</span>
                    ) : null}
                  </span>
                  <span className="flex w-[132px] items-center justify-end gap-1.5">
                    <input type="number" inputMode="decimal" min="0" step={emSub ? "1" : "0.001"} placeholder="0"
                      aria-label={`Quantidade de ${item.nome}`} value={valor}
                      onChange={e => onQuantidade(item.chave, (Number(e.target.value) || 0) / fator)}
                      className="h-11 w-[84px] rounded-lg border border-line bg-card px-2 text-right text-[15px] font-black text-fg outline-none focus:border-[color:var(--tipo)]" />
                    {sub ? (
                      <button type="button" onClick={() => onAlternarModo(item.chave)} title="Trocar a unidade de digitação"
                        className="h-11 w-10 rounded-lg border border-line bg-elevated text-xs font-black text-fg-soft hover:border-[color:var(--tipo)]">{unidade}</button>
                    ) : (
                      <span className="w-10 text-center text-xs font-black text-muted">{unidade}</span>
                    )}
                  </span>
                  <button type="button" onClick={() => { setSubstituto(""); setAlvo(item); }} title="Remover ou substituir"
                    aria-label={`Remover ${item.nome}`}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line text-muted hover:text-fg">
                    <Trash2 size={15} />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {alvo ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/60 p-4" onClick={() => setAlvo(null)}>
          <div className="w-full max-w-md rounded-3xl border border-line bg-card p-5 shadow-2xl" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
            <div className="mb-1 flex items-start justify-between gap-3">
              <h3 className="text-lg font-black text-fg">Remover “{alvo.nome}”</h3>
              <button type="button" onClick={() => setAlvo(null)} aria-label="Fechar" className="p-1 text-muted hover:text-fg"><X size={18} /></button>
            </div>
            <p className="mb-4 text-sm font-medium text-muted">Quer trocar por outro ingrediente (mantendo a quantidade) ou só remover?</p>
            <Rotulo htmlFor="ficha-substituto">Substituir por (opcional)</Rotulo>
            <select id="ficha-substituto" value={substituto} onChange={e => setSubstituto(e.target.value)} className="erp-input mb-4" style={{ appearance: "auto" }}>
              <option value="">Escolher...</option>
              {opcoes.filter(o => o.valor.split(":")[1] !== alvo.chave).map(o => (
                <option key={o.valor} value={o.valor}>{o.nome} ({o.grupo.toLowerCase()})</option>
              ))}
            </select>
            <div className="flex gap-2">
              <button type="button" onClick={() => { onRemover(alvo.chave); setAlvo(null); }}
                className="flex-1 rounded-xl bg-elevated py-3 text-sm font-bold text-fg-soft hover:text-fg">Só remover</button>
              <button type="button" disabled={!substituto} onClick={() => { onSubstituir(alvo.chave, substituto); setAlvo(null); }}
                className="flex-1 rounded-xl bg-[color:var(--tipo)] py-3 text-sm font-black text-[color:var(--tipo-fg)] disabled:opacity-40">Substituir</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ─── Instruções (montagem ou modo de preparo) ───────────────────────────────

// Texto livre, um passo por linha. A IA opcional organiza uma explicação solta
// em passos — nada é gravado sem a pessoa conferir e salvar.
export function CampoInstrucoes({ id, valor, onChange, placeholder, tipo, nomeReceita, itens }) {
  const [aberto, setAberto] = useState(false);
  const [explicacao, setExplicacao] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");

  const organizar = async () => {
    if (!explicacao.trim()) { setErro("Escreva com suas palavras como é feito."); return; }
    setCarregando(true);
    setErro("");
    try {
      const resposta = await fetch("/api/ia-preparo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo,
          explicacao,
          nome_receita: nomeReceita,
          ingredientes: itens.map(i => ({ nome: i.nome, quantidade: quantidadeComUnidade(i.quantidade, i.unidade) })),
        }),
      });
      const dados = await resposta.json();
      if (!resposta.ok || dados.error) { setErro(dados.error || "A IA não conseguiu organizar agora."); return; }
      onChange(dados.modo_preparo || "");
      setAberto(false);
      setExplicacao("");
    } catch {
      setErro("Não consegui falar com a IA. Verifique a conexão.");
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div>
      <textarea id={id} value={valor} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="erp-input min-h-[230px] resize-y py-3 text-[15px] leading-relaxed" />
      <p className="mt-1.5 text-xs font-medium text-muted">Um passo por linha. A numeração é feita na ficha impressa.</p>

      {aberto ? (
        <div className="mt-3 rounded-xl border border-line bg-elevated p-3">
          <label htmlFor={`${id}-ia`} className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[color:var(--tipo)]">
            <Sparkles size={14} /> Explique com suas palavras — a IA organiza em passos
          </label>
          <textarea id={`${id}-ia`} value={explicacao} onChange={e => setExplicacao(e.target.value)}
            placeholder={tipo === "prato"
              ? "Ex.: arroz do lado esquerdo, picanha no meio em leque, batata do outro lado e o vinagrete num ramequim..."
              : "Ex.: refogo o alho, junto o arroz, ponho a água fervendo com sal e deixo secar em fogo baixo..."}
            className="mt-2 h-24 w-full resize-none rounded-lg border border-line bg-card p-3 text-sm font-medium text-fg outline-none focus:border-[color:var(--tipo)]" />
          {erro ? <p className="mt-1 text-xs font-bold text-[color:var(--danger-strong)]">{erro}</p> : null}
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={() => { setAberto(false); setErro(""); }} className="rounded-lg px-3 py-2 text-sm font-bold text-muted hover:text-fg">Cancelar</button>
            <button type="button" onClick={organizar} disabled={carregando}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[color:var(--tipo)] py-2 text-sm font-black text-[color:var(--tipo-fg)] disabled:opacity-50">
              {carregando ? <><Loader2 size={15} className="animate-spin" /> Organizando...</> : <><Sparkles size={15} /> Organizar em passos</>}
            </button>
          </div>
          <p className="mt-1.5 text-3xs font-medium text-muted">O texto organizado substitui o do campo acima; confira antes de salvar.</p>
        </div>
      ) : (
        <button type="button" onClick={() => setAberto(true)} className="mt-2 flex items-center gap-1.5 text-sm font-bold text-[color:var(--tipo)] hover:underline">
          <Sparkles size={15} /> Organizar com IA
        </button>
      )}
    </div>
  );
}

// ─── Rendimento ─────────────────────────────────────────────────────────────

// Rendimento do prato: o peso final servido, sempre em gramas. A soma dos
// ingredientes é só um ponto de partida — cocção, redução, drenagem e perdas
// mudam o que vai ao cliente —, então o número é digitado.
export function CampoRendimentoPrato({ form, onChange, itens, ajuda = "" }) {
  const soma = rendimentoSomado(itens, form.departamento);
  const somaG = soma ? Math.round(soma.valor * 1000) : 0;
  const valor = form.peso_final_g === "" || form.peso_final_g == null ? "" : String(parseNumero(form.peso_final_g));
  return (
    <div>
      <Rotulo htmlFor="ficha-rendimento-prato">Rendimento</Rotulo>
      <div className="flex items-center gap-2">
        <input id="ficha-rendimento-prato" type="number" inputMode="numeric" min="0" step="1" value={valor} placeholder="Ex.: 420"
          onChange={e => onChange({ peso_final_g: e.target.value })} className="erp-input" />
        <span className="w-10 text-center text-sm font-black text-muted">g</span>
      </div>
      {ajuda ? <p className="mt-1 text-xs font-medium text-muted">{ajuda}</p> : null}
      {somaG > 0 && somaG !== parseNumero(valor) ? (
        <button type="button" onClick={() => onChange({ peso_final_g: String(somaG) })}
          className="mt-1 text-xs font-bold text-[color:var(--tipo)] hover:underline">
          usar a soma dos ingredientes ({numero(somaG, 0)} g)
        </button>
      ) : null}
    </div>
  );
}

// ─── Produção (pré-preparo) ─────────────────────────────────────────────────

// Rendimento do pré-preparo: soma dos ingredientes (automático) ou digitado.
// É dele que sai o custo por kg que entra nos pratos.
export function CampoRendimento({ form, onChange, auto, onAuto, itens }) {
  const automatizavel = rendimentoEhAutomatizavel(form);
  const unidadeSetor = rotuloUnidadeSetor(form.departamento);
  const unidade = automatizavel ? unidadeSetor : quantidadeComUnidade(1, form.rendimento_unidade).replace(/^1\s*/, "");
  const soma = rendimentoSomado(itens, form.departamento);

  if (automatizavel && auto) {
    return (
      <div>
        <Rotulo>Rendimento</Rotulo>
        <div className="flex min-h-[52px] items-center justify-between gap-2 rounded-2xl border border-line bg-elevated px-4">
          <span className="text-lg font-black text-fg">{soma ? `${numero(soma.valor)} ${unidadeSetor}` : "—"}</span>
          <button type="button" onClick={() => onAuto(false)} className="text-xs font-bold text-[color:var(--tipo)] hover:underline">ajustar</button>
        </div>
        <p className="mt-1 text-xs font-medium text-muted">{soma ? "Soma dos ingredientes." : "Aparece ao adicionar ingredientes com peso."}</p>
      </div>
    );
  }
  return (
    <div>
      <Rotulo htmlFor="ficha-rendimento">Rendimento</Rotulo>
      <div className="flex items-center gap-2">
        <input id="ficha-rendimento" type="number" inputMode="decimal" min="0" step="any" value={form.rendimento_porcoes}
          onChange={e => onChange({ rendimento_porcoes: e.target.value })} className="erp-input" />
        <span className="w-10 text-center text-sm font-black text-muted">{unidade}</span>
      </div>
      {automatizavel ? (
        <button type="button" onClick={() => onAuto(true)} className="mt-1 text-xs font-bold text-[color:var(--tipo)] hover:underline">
          usar a soma dos ingredientes{soma ? ` (${numero(soma.valor)} ${unidadeSetor})` : ""}
        </button>
      ) : (
        <p className="mt-1 text-xs font-medium text-muted">Mantido em {unidade}: há receitas que usam este pré-preparo nessa unidade.</p>
      )}
    </div>
  );
}

// Peso/volume final em kg (cozinha) ou L (bar); gravado em g/ml, como antes.
export function CampoPesoFinal({ form, onChange }) {
  const unidade = rotuloUnidadeSetor(form.departamento);
  const valor = form.peso_final_g === "" || form.peso_final_g == null ? "" : +(parseNumero(form.peso_final_g) / 1000).toFixed(3);
  return (
    <div>
      <Rotulo htmlFor="ficha-peso-final">{form.departamento === "bar" ? "Volume final" : "Peso final"}</Rotulo>
      <div className="flex items-center gap-2">
        <input id="ficha-peso-final" type="number" inputMode="decimal" min="0" step="any" value={valor} placeholder="Opcional"
          onChange={e => onChange({ peso_final_g: e.target.value === "" ? "" : String(parseNumero(e.target.value) * 1000) })} className="erp-input" />
        <span className="w-10 text-center text-sm font-black text-muted">{unidade}</span>
      </div>
      <p className="mt-1 text-xs font-medium text-muted">O que sai pronto, depois de cozinhar ou reduzir.</p>
    </div>
  );
}

export function CampoTempoPreparo({ valor, onChange }) {
  return (
    <div>
      <Rotulo htmlFor="ficha-tempo">Tempo de preparo</Rotulo>
      <div className="flex items-center gap-2">
        <input id="ficha-tempo" type="number" inputMode="numeric" min="0" step="1" value={valor} placeholder="Opcional"
          onChange={e => onChange(e.target.value)} className="erp-input" />
        <span className="w-10 text-center text-sm font-black text-muted">min</span>
      </div>
    </div>
  );
}

export function CampoArmazenamento({ valor, onChange }) {
  const mudar = (campo, v) => onChange({ ...valor, [campo]: v });
  return (
    <div className="grid gap-4">
      <div>
        <Rotulo htmlFor="ficha-recipiente">Forma / recipiente</Rotulo>
        <input id="ficha-recipiente" value={valor.recipiente || ""} onChange={e => mudar("recipiente", e.target.value)}
          placeholder="Ex.: Cuba GN com tampa" className="erp-input" />
      </div>
      <div>
        <Rotulo>Local e validade</Rotulo>
        <div className="grid gap-2 sm:grid-cols-[1fr_1fr_150px]">
          <select aria-label="Conservação" value={valor.forma || ""} onChange={e => mudar("forma", e.target.value)} className="erp-input" style={{ appearance: "auto" }}>
            <option value="">Conservação...</option>
            {valor.forma && !CONSERVACOES.includes(valor.forma) ? <option value={valor.forma}>{valor.forma}</option> : null}
            {CONSERVACOES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <input aria-label="Local" value={valor.local_armazenamento || ""} onChange={e => mudar("local_armazenamento", e.target.value)}
            placeholder="Local (ex.: Geladeira 2)" className="erp-input" />
          <div className="flex items-center gap-2">
            <input aria-label="Validade em dias" type="number" inputMode="numeric" min="0" step="1" value={valor.validade_dias || ""}
              onChange={e => mudar("validade_dias", e.target.value)} placeholder="Validade" className="erp-input" />
            <span className="text-sm font-black text-muted">dias</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Chip({ ativo, onClick, children, tom = "tipo" }) {
  const cores = tom === "alerta"
    ? (ativo ? "border-[color:var(--warning)] bg-[color:var(--warning-soft)] text-[color:var(--warning-strong)]" : "border-line bg-card text-fg-soft")
    : (ativo ? "border-[color:var(--tipo)] bg-[color:var(--tipo)] text-[color:var(--tipo-fg)]" : "border-line bg-card text-fg-soft");
  return (
    <button type="button" onClick={onClick} aria-pressed={ativo}
      className={`flex min-h-10 items-center gap-1 rounded-xl border px-3 text-sm font-bold transition hover:border-[color:var(--tipo)] ${cores}`}>
      {ativo ? <Check size={14} /> : null} {children}
    </button>
  );
}

export function CampoEquipamentos({ selecionados, onChange }) {
  const [novo, setNovo] = useState("");
  const marcados = new Set(selecionados.map(s => s.toLowerCase()));
  const alternar = (nome) => onChange(marcados.has(nome.toLowerCase())
    ? selecionados.filter(s => s.toLowerCase() !== nome.toLowerCase())
    : [...selecionados, nome]);
  const extras = selecionados.filter(s => !EQUIPAMENTOS_SUGERIDOS.some(e => e.toLowerCase() === s.toLowerCase()));
  const adicionar = () => {
    const nome = novo.trim();
    if (nome && !marcados.has(nome.toLowerCase())) onChange([...selecionados, nome]);
    setNovo("");
  };
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {[...EQUIPAMENTOS_SUGERIDOS, ...extras].map(nome => (
          <Chip key={nome} ativo={marcados.has(nome.toLowerCase())} onClick={() => alternar(nome)}>{nome}</Chip>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <input value={novo} onChange={e => setNovo(e.target.value)} placeholder="Outro (ex.: Panela 10 L)" aria-label="Outro equipamento"
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); adicionar(); } }} className="erp-input" />
        <button type="button" onClick={adicionar} className="rounded-xl border border-line px-4 text-sm font-bold text-fg-soft hover:text-fg">Adicionar</button>
      </div>
    </div>
  );
}

export function CampoAlergenicos({ selecionados, podeConter, onChange, onPodeConter }) {
  const marcados = new Set(selecionados.map(s => s.toLowerCase()));
  const alternar = (nome) => onChange(marcados.has(nome.toLowerCase())
    ? selecionados.filter(s => s.toLowerCase() !== nome.toLowerCase())
    : [...selecionados, nome]);
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {ALERGENICOS.map(nome => <Chip key={nome} tom="alerta" ativo={marcados.has(nome.toLowerCase())} onClick={() => alternar(nome)}>{nome}</Chip>)}
      </div>
      <div className="mt-3">
        <Rotulo htmlFor="ficha-pode-conter">Pode conter (traços)</Rotulo>
        <input id="ficha-pode-conter" value={podeConter || ""} onChange={e => onPodeConter(e.target.value)} placeholder="Ex.: soja, ovos" className="erp-input" />
      </div>
      <p className="mt-2 text-sm font-semibold text-fg-soft">
        {selecionados.length ? <>Na ficha: <b>Contém:</b> {selecionados.join(", ")}.</> : "Na ficha: Não contém alergênicos cadastrados."}
      </p>
    </div>
  );
}

// Custos do pré-preparo: calculados pelo sistema, sem campo para digitar.
export function PainelCustos({ itens, form }) {
  const total = custoDosItens(itens);
  const rendimento = parseNumero(form.rendimento_porcoes);
  const unidade = rendimentoEhAutomatizavel(form) ? rotuloUnidadeSetor(form.departamento) : String(form.rendimento_unidade || "un");
  const suspeitos = itens.filter(precoSuspeito);
  const linha = (rotulo, valor, forte = false) => (
    <div className={`flex items-center justify-between py-2 ${forte ? "border-t border-line font-black text-fg" : "text-fg-soft"}`}>
      <span className={forte ? "" : "font-semibold"}>{rotulo}</span>
      <span className="font-black tabular-nums">{valor}</span>
    </div>
  );
  return (
    <div>
      <div className="text-sm">
        {linha("Custo dos ingredientes", fmtBRL(total))}
        {linha("Custo total", fmtBRL(total), true)}
        {rendimento > 0 ? linha(`Custo por ${unidade}`, fmtBRL(total / rendimento, total / rendimento < 0.1 ? 4 : 2)) : null}
      </div>
      {suspeitos.length ? (
        <p className="mt-2 rounded-xl border border-[color:var(--warning)] bg-[color:var(--warning-soft)] px-3 py-2 text-xs font-bold text-[color:var(--warning-strong)]">
          Preço por grama suspeito: {suspeitos.map(i => i.nome).join(", ")}. Confira o cadastro do ingrediente — pode ser o preço do pacote.
        </p>
      ) : null}
      <p className="mt-2 text-xs font-medium text-muted">Os custos vêm do cadastro dos ingredientes e dos pré-preparos usados.</p>
    </div>
  );
}
