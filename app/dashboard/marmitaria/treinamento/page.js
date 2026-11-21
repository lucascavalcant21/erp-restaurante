"use client";

// Treinamento do delivery (dono, 21/11/2026): manual de operação por posição
// (comanda, fogão, fritadeira, bancada, fechamento, expedição), com mise en
// place, processos com tempo-meta, pontos críticos, conferência e padrões.
// Imprime e vira PDF para o funcionário. Fica em config_sistema.params.

import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowLeft, ArrowUp, ImagePlus, Plus, Printer, Trash2 } from "lucide-react";
import { useMarmitaria } from "../../../components/marmitaria/contexto";
import { ehEmbalagem } from "../../../components/marmitaria/BuscaItens";
import { imprimirHtml } from "../../../components/marmitaria/imprimirGuia";
import { Aviso, Botao, Campo, CampoNumero, Cartao, Secao, inputCls } from "../../../components/marmitaria/ui";
import { fetchTreinamentoMarmitaria, salvarTreinamentoMarmitaria } from "../../../lib/parametros";
import { uploadFotoMontagem } from "../../../lib/montagem";
import { novaChave } from "../../../lib/marmitaria/dados";
import { MODELO_TREINAMENTO, htmlDoManual, normalizarManual, temposDoManual } from "../../../lib/marmitaria/treinamento.mjs";

const linhas = (arr) => (arr || []).join("\n");
const deLinhas = (txt) => String(txt || "").split("\n");
const fmtMin = (m) => `${Number(m).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} min`;
const areaCls = `${inputCls} min-h-[96px] py-2 leading-relaxed`;

function Lista({ rotulo, dica, valor, onChange, linhasMin = 3 }) {
  return (
    <Campo rotulo={rotulo} dica={dica}>
      <textarea className={areaCls} rows={Math.max(linhasMin, (valor || []).length + 1)} value={linhas(valor)} onChange={(e) => onChange(deLinhas(e.target.value))} />
    </Campo>
  );
}

function Processo({ x, n, mudar, tirar, mover }) {
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState(null);
  async function foto(arquivo) {
    if (!arquivo) return;
    setEnviando(true); setErro(null);
    try {
      const { url, error } = await uploadFotoMontagem(arquivo, `treinamento ${x.nome}`);
      if (error) setErro(`Foto não enviada: ${error}`); else mudar({ foto: url });
    } finally { setEnviando(false); }
  }
  return (
    <Cartao className="space-y-3">
      <div className="flex items-start gap-2">
        <span className="mt-3 text-sm font-bold text-hf-accent">{n}</span>
        <Campo rotulo="Processo" className="min-w-0 flex-1"><input className={inputCls} value={x.nome} onChange={(e) => mudar({ nome: e.target.value })} /></Campo>
        <Campo rotulo="Tempo-meta" className="w-28 shrink-0"><CampoNumero valor={x.tempoMin} onChange={(v) => mudar({ tempoMin: v })} sufixo="min" placeholder="—" aria-label={`Tempo-meta de ${x.nome}, em minutos`} /></Campo>
      </div>
      <Lista rotulo="Passo a passo" dica="Um passo por linha, na ordem." valor={x.passos} onChange={(v) => mudar({ passos: v })} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Lista rotulo="Pontos críticos (atenção)" dica="O que não pode acontecer." valor={x.criticos} onChange={(v) => mudar({ criticos: v })} linhasMin={2} />
        <Lista rotulo="Conferência" dica="Vira caixinha para marcar." valor={x.conferencia} onChange={(v) => mudar({ conferencia: v })} linhasMin={2} />
      </div>
      <div>
        <p className="mb-1 text-[13px] font-medium text-hf-muted">Padrões (quantidades, temperaturas, pesos)</p>
        <ul className="space-y-2">
          {x.padroes.map((q, i) => (
            <li key={i} className="grid grid-cols-[minmax(0,1fr)_110px_44px] items-center gap-2">
              <input className={inputCls} value={q.rotulo} onChange={(e) => mudar({ padroes: x.padroes.map((y, j) => (j === i ? { ...y, rotulo: e.target.value } : y)) })} aria-label="Padrão" placeholder="Ex.: Etiquetas por marmita" />
              <input className={inputCls} value={q.valor} onChange={(e) => mudar({ padroes: x.padroes.map((y, j) => (j === i ? { ...y, valor: e.target.value } : y)) })} aria-label={`Valor de ${q.rotulo || "padrão"}`} placeholder="Defina" />
              <button type="button" onClick={() => mudar({ padroes: x.padroes.filter((_, j) => j !== i) })} aria-label={`Tirar ${q.rotulo || "padrão"}`} className="grid h-11 w-11 place-items-center rounded-lg text-hf-muted hover:bg-hf-elevated"><Trash2 size={16} /></button>
            </li>
          ))}
        </ul>
        <button type="button" onClick={() => mudar({ padroes: [...x.padroes, { rotulo: "", valor: "" }] })} className="mt-2 min-h-[44px] text-sm font-semibold text-hf-accent">+ Padrão</button>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {x.foto && <img src={x.foto} alt={`Foto de ${x.nome}`} className="h-20 w-28 rounded-lg object-cover" />}
        <label className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl border border-hf-border px-3 text-sm font-semibold text-hf-text">
          <ImagePlus size={16} /> {enviando ? "Enviando…" : x.foto ? "Trocar foto" : "Foto de como deve ficar"}
          <input type="file" accept="image/*" className="hidden" onChange={(e) => foto(e.target.files?.[0])} />
        </label>
        {x.foto && <button type="button" onClick={() => mudar({ foto: "" })} className="min-h-[44px] text-sm font-semibold text-hf-muted">Tirar foto</button>}
        <span className="ml-auto flex gap-1">
          <button type="button" onClick={() => mover(-1)} aria-label="Subir processo" className="grid h-11 w-11 place-items-center rounded-lg text-hf-muted hover:bg-hf-elevated"><ArrowUp size={16} /></button>
          <button type="button" onClick={() => mover(1)} aria-label="Descer processo" className="grid h-11 w-11 place-items-center rounded-lg text-hf-muted hover:bg-hf-elevated"><ArrowDown size={16} /></button>
          <button type="button" onClick={tirar} aria-label={`Excluir ${x.nome}`} className="grid h-11 w-11 place-items-center rounded-lg text-hf-danger hover:bg-hf-elevated"><Trash2 size={16} /></button>
        </span>
      </div>
      {erro && <Aviso tipo="alerta">{erro}</Aviso>}
    </Cartao>
  );
}

export default function TreinamentoDeliveryPage() {
  const { base, unidadeId } = useMarmitaria();
  const [manual, setManual] = useState(null);
  const [aberta, setAberta] = useState(null); // id da posição em edição
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState(null);
  const [erro, setErro] = useState(null);

  useEffect(() => {
    if (!unidadeId) return;
    fetchTreinamentoMarmitaria(unidadeId).then((r) => { if (r.error) setErro(r.error); setManual(normalizarManual(r.data)); });
  }, [unidadeId]);

  const tempos = useMemo(() => (manual ? temposDoManual(manual) : null), [manual]);
  const embalagens = useMemo(() => (base?.insumosLista || []).filter(ehEmbalagem).map((i) => i.nome), [base]);
  if (!manual) return <Cartao><p className="text-sm text-hf-muted">Carregando o treinamento…</p></Cartao>;

  const mudarEstacao = (id, m) => { setMsg(null); setManual((x) => ({ ...x, modelo: false, estacoes: x.estacoes.map((e) => (e.id === id ? { ...e, ...m } : e)) })); };
  const imprimir = (so = null) => imprimirHtml(htmlDoManual(normalizarManual(manual), { so, embalagens, data: new Date().toLocaleDateString("pt-BR") }));

  async function salvar() {
    if (salvando) return;
    setSalvando(true); setErro(null); setMsg(null);
    try {
      const limpo = normalizarManual({ ...manual, estacoes: manual.estacoes });
      const r = await salvarTreinamentoMarmitaria(unidadeId, { titulo: limpo.titulo, estacoes: limpo.estacoes, atualizado_em: new Date().toISOString() });
      if (r.error) setErro(r.error); else { setManual({ ...limpo, modelo: false }); setMsg("Treinamento salvo."); }
    } finally { setSalvando(false); }
  }

  const est = aberta ? manual.estacoes.find((e) => e.id === aberta) : null;
  if (est) {
    const mudarProc = (pid, m) => mudarEstacao(est.id, { processos: est.processos.map((x) => (x.id === pid ? { ...x, ...m } : x)) });
    const moverProc = (i, d) => { const l = [...est.processos]; const j = i + d; if (j < 0 || j >= l.length) return; [l[i], l[j]] = [l[j], l[i]]; mudarEstacao(est.id, { processos: l }); };
    const n = manual.estacoes.indexOf(est) + 1;
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Botao variante="secundario" onClick={() => setAberta(null)}><ArrowLeft size={16} /> Posições</Botao>
          <Botao variante="secundario" onClick={() => imprimir(est.id)}><Printer size={16} /> Imprimir esta posição</Botao>
          <Botao onClick={salvar} disabled={salvando} className="ml-auto">{salvando ? "Salvando…" : "Salvar"}</Botao>
        </div>
        {erro && <Aviso tipo="alerta">{erro}</Aviso>}
        {msg && <Aviso>{msg}</Aviso>}
        <Secao titulo={`${n}. ${est.nome}`}>
          <div className="grid gap-3">
            <Campo rotulo="Nome da posição"><input className={inputCls} value={est.nome} onChange={(e) => mudarEstacao(est.id, { nome: e.target.value })} /></Campo>
            <Campo rotulo="Objetivo"><input className={inputCls} value={est.objetivo} onChange={(e) => mudarEstacao(est.id, { objetivo: e.target.value })} /></Campo>
            <Lista rotulo="Mise en place (antes de começar)" dica="Um item por linha: vira caixinha no impresso." valor={est.misePlace} onChange={(v) => mudarEstacao(est.id, { misePlace: v })} />
            {est.id === "fechamento" && embalagens.length > 0 && <p className="text-xs text-hf-muted">As embalagens cadastradas entram sozinhas no impresso desta posição: {embalagens.join(", ")}.</p>}
          </div>
        </Secao>
        {est.processos.map((x, i) => (
          <Processo key={x.id} x={x} n={`${n}.${i + 1}`} mudar={(m) => mudarProc(x.id, m)} mover={(d) => moverProc(i, d)}
            tirar={() => { if (window.confirm(`Excluir o processo "${x.nome}"?`)) mudarEstacao(est.id, { processos: est.processos.filter((y) => y.id !== x.id) }); }} />
        ))}
        <Botao variante="secundario" onClick={() => mudarEstacao(est.id, { processos: [...est.processos, { id: novaChave(), nome: "Novo processo", tempoMin: "", foto: "", passos: [], criticos: [], conferencia: [], padroes: [] }] })}><Plus size={16} /> Processo</Botao>
        <div className="flex justify-end"><Botao onClick={salvar} disabled={salvando} className="min-h-[48px]">{salvando ? "Salvando…" : "Salvar"}</Botao></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Secao titulo="Treinamento do delivery" subtitulo="O manual de operação de cada posição: mise en place, processos com tempo-meta, pontos críticos e conferência. Imprima para o funcionário ou salve em PDF pela janela de impressão."
        direita={<span className="flex flex-wrap gap-2"><Botao variante="secundario" onClick={() => imprimir()}><Printer size={16} /> Imprimir / PDF</Botao><Botao onClick={salvar} disabled={salvando}>{salvando ? "Salvando…" : "Salvar"}</Botao></span>}>
        {manual.modelo && <Aviso className="mb-3">Este é um modelo para você ajustar ao seu delivery. Os tempos, as quantidades e as temperaturas estão em branco: preencha com o padrão da casa e salve.</Aviso>}
        {erro && <Aviso tipo="alerta" className="mb-3">{erro}</Aviso>}
        {msg && <Aviso className="mb-3">{msg}</Aviso>}
        <Campo rotulo="Título do manual"><input className={inputCls} value={manual.titulo} onChange={(e) => { setMsg(null); setManual((x) => ({ ...x, titulo: e.target.value })); }} /></Campo>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {manual.estacoes.map((e, i) => {
            const t = tempos.estacoes.find((x) => x.id === e.id);
            return (
              <li key={e.id}>
                <button type="button" onClick={() => setAberta(e.id)} className="w-full rounded-2xl border border-hf-border bg-hf-surface p-4 text-left hover:bg-hf-elevated">
                  <span className="block text-base font-bold text-hf-text">{i + 1}. {e.nome}</span>
                  {e.objetivo && <span className="mt-0.5 block text-sm text-hf-text-2">{e.objetivo}</span>}
                  <span className="mt-2 block text-xs font-semibold text-hf-muted">
                    {e.misePlace.length} itens de mise en place · {e.processos.length} processo(s){t?.minutos ? ` · ${fmtMin(t.minutos)}` : ""}{t?.semTempo ? ` · ${t.semTempo} sem tempo` : ""}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-hf-border pt-3">
          <p className="text-sm text-hf-text">Pedido inteiro: <b className="tabular-nums">{tempos.total ? fmtMin(tempos.total) : "sem tempos definidos"}</b>{tempos.semTempo ? <span className="text-hf-muted"> · {tempos.semTempo} processo(s) sem tempo</span> : null}</p>
          <span className="ml-auto flex flex-wrap gap-2">
            <Botao variante="secundario" onClick={() => { const id = novaChave(); setManual((x) => ({ ...x, modelo: false, estacoes: [...x.estacoes, { id, nome: "Nova posição", objetivo: "", misePlace: [], processos: [] }] })); setAberta(id); }}><Plus size={16} /> Posição</Botao>
            {!manual.modelo && <Botao variante="secundario" onClick={() => { if (window.confirm("Voltar ao modelo? O que você escreveu some quando salvar.")) setManual(normalizarManual({ titulo: manual.titulo, estacoes: MODELO_TREINAMENTO })); }}>Voltar ao modelo</Botao>}
          </span>
        </div>
      </Secao>
    </div>
  );
}
