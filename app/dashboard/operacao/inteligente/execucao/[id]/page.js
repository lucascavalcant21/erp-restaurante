"use client";

// EXECUÇÃO GUIADA — um item por vez, no celular ou tablet.
// Responde, comprova e conclui. Item fora do padrão abre não conformidade na
// hora (a regra de conformidade vive no motor, não aqui).

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, ArrowRight, Camera, Check, CheckCircle2, Loader2,
  AlertTriangle, ShieldAlert, X,
} from "lucide-react";
import { useERP } from "../../../../../context/ERPContext";
import { lerSessao } from "../../../../../lib/auth";
import {
  fetchExecucao, fetchProcessoCompleto, iniciarExecucao, responderItem, concluirExecucao,
} from "../../../../../lib/operacao-inteligente";
import { itemVisivel, respostaConforme } from "../../../../../lib/operacao-agenda.mjs";

const POSITIVO = { FEITO_NAO_FEITO: "feito", CONFORME_NAO_CONFORME: "conforme", SIM_NAO: "sim", BOOLEAN: "sim" };
const NEGATIVO = { FEITO_NAO_FEITO: "nao_feito", CONFORME_NAO_CONFORME: "nao_conforme", SIM_NAO: "nao", BOOLEAN: "nao" };
const NUMERICOS = ["NUMERO", "DECIMAL", "TEMPERATURA", "QUANTIDADE", "PERCENTUAL", "MOEDA"];

export default function ExecucaoGuiada() {
  const { id } = useParams();
  const router = useRouter();
  const { unidadeAtiva } = useERP();

  const [execucao, setExecucao] = useState(null);
  const [processo, setProcesso] = useState(null);
  const [respostas, setRespostas] = useState({});   // item_id -> resposta
  const [indice, setIndice] = useState(0);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [sessao, setSessao] = useState(null);
  const [rascunho, setRascunho] = useState({ valor: "", comentario: "" });
  const [concluida, setConcluida] = useState(false);

  useEffect(() => { lerSessao().then(setSessao).catch(() => {}); }, []);

  useEffect(() => {
    (async () => {
      const { data: exec } = await fetchExecucao(id);
      if (!exec) { setCarregando(false); return; }
      const { data: proc } = await fetchProcessoCompleto(exec.processo_id);
      setExecucao(exec);
      setProcesso(proc);
      setRespostas(Object.fromEntries((exec.respostas || []).map(r => [r.item_id, r])));
      setConcluida(["CONCLUIDA", "CONCLUIDA_COM_ATRASO"].includes(exec.status));
      setCarregando(false);
    })();
  }, [id]);

  // Lista achatada dos itens, respeitando as condicionais já respondidas.
  const itens = useMemo(() => {
    const todos = (processo?.secoes || []).flatMap(s => (s.itens || []).map(i => ({ ...i, secao: s.titulo })));
    return todos.filter(i => itemVisivel(i, respostas));
  }, [processo, respostas]);

  const item = itens[indice];
  const respondidos = itens.filter(i => respostas[i.id]).length;
  const progresso = itens.length ? Math.round((respondidos / itens.length) * 100) : 0;

  // Ao trocar de item, carrega o que já foi respondido antes.
  useEffect(() => {
    if (!item) return;
    const r = respostas[item.id];
    setRascunho({ valor: r?.valor ?? "", comentario: r?.comentario ?? "" });
    setErro("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indice, item?.id]);

  const usuario = { id: sessao?.id, nome: sessao?.nome || sessao?.email };

  const garantirIniciada = async () => {
    if (execucao?.status === "EM_ANDAMENTO") return;
    await iniciarExecucao(execucao.id, usuario);
    setExecucao(e => ({ ...e, status: "EM_ANDAMENTO" }));
  };

  const salvarResposta = async (valorDireto, naoAplica = false) => {
    if (!item || salvando) return;
    const valor = valorDireto ?? rascunho.valor;
    if (!naoAplica) {
      if (item.obrigatorio && (valor == null || String(valor).trim() === "")) { setErro("Este item é obrigatório."); return; }
      if (item.exige_comentario && !rascunho.comentario.trim()) { setErro("Escreva um comentário para este item."); return; }
    }
    setSalvando(true);
    await garantirIniciada();
    const numerico = NUMERICOS.includes(String(item.tipo).toUpperCase());
    const r = await responderItem({
      execucao: { ...execucao, processo },
      item,
      valor,
      valorNumero: numerico ? Number(String(valor).replace(",", ".")) : null,
      comentario: rascunho.comentario,
      naoAplica,
      usuario,
    });
    setSalvando(false);
    if (r.error) { setErro(r.error); return; }

    const nova = {
      item_id: item.id, valor: String(valor ?? ""),
      valor_numero: numerico ? Number(String(valor).replace(",", ".")) : null,
      conforme: r.conforme, nao_aplica: naoAplica, comentario: rascunho.comentario,
    };
    setRespostas(a => ({ ...a, [item.id]: nova }));
    if (indice < itens.length - 1) setIndice(i => i + 1);
  };

  const finalizar = async () => {
    setSalvando(true);
    const r = await concluirExecucao({
      execucao: { ...execucao, processo },
      itens,
      respostas: Object.values(respostas),
      usuario,
    });
    setSalvando(false);
    if (r.error) { setErro(r.error); return; }
    setConcluida(true);
  };

  if (carregando) return <div className="grid min-h-[60vh] place-items-center"><Loader2 className="animate-spin text-emerald-600" size={30} /></div>;
  if (!execucao) return <div className="p-10 text-center font-bold text-slate-500">Execução não encontrada.</div>;

  if (concluida) {
    const naoConformes = Object.values(respostas).filter(r => r.conforme === false).length;
    return (
      <div className="grid min-h-screen place-items-center bg-slate-50 p-5">
        <div className="w-full max-w-md rounded-3xl border border-emerald-200 bg-white p-7 text-center shadow-sm">
          <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-emerald-100 text-emerald-700"><CheckCircle2 size={34} /></div>
          <h1 className="text-xl font-black text-slate-900">{processo?.nome} concluído</h1>
          <p className="mt-2 text-sm font-medium text-slate-600">{respondidos} de {itens.length} itens respondidos.</p>
          {naoConformes > 0 && (
            <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
              {naoConformes} item(ns) fora do padrão geraram não conformidade.
            </p>
          )}
          <button onClick={() => router.push("/dashboard/operacao/inteligente")}
            className="mt-5 w-full rounded-2xl bg-emerald-600 py-4 text-base font-black text-white hover:bg-emerald-700">
            Voltar à Central
          </button>
        </div>
      </div>
    );
  }

  const tipo = String(item?.tipo || "").toUpperCase();
  const conformeAtual = item ? respostaConforme(item, { valor: rascunho.valor, valor_numero: Number(String(rascunho.valor).replace(",", ".")) }) : null;

  return (
    <div className="min-h-screen bg-slate-50 pb-32">
      <div className="sticky top-0 z-20 border-b border-slate-200 bg-white px-4 py-3.5 sm:px-6">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <button onClick={() => router.push("/dashboard/operacao/inteligente")} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-600"><ArrowLeft size={19} /></button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-black text-slate-900">{processo?.nome}</p>
            <p className="text-[11px] font-bold text-slate-500">Item {Math.min(indice + 1, itens.length)} de {itens.length} · {progresso}% concluído</p>
          </div>
        </div>
        <div className="mx-auto mt-2.5 h-1.5 w-full max-w-2xl overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${progresso}%` }} />
        </div>
      </div>

      <main className="mx-auto max-w-2xl p-4 sm:p-6">
        {!item ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
            <p className="font-black text-slate-700">Nenhum item para responder</p>
            <p className="mt-1 text-sm text-slate-500">Este processo ainda não tem itens cadastrados.</p>
          </div>
        ) : (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-[11px] font-black uppercase tracking-widest text-emerald-700">{item.secao}</p>
            <h2 className="mt-1 text-xl font-black leading-snug text-slate-900">{item.titulo}</h2>
            {item.instrucao && <p className="mt-2 text-[15px] font-medium leading-relaxed text-slate-600">{item.instrucao}</p>}

            <div className="mt-3 flex flex-wrap gap-2">
              {item.obrigatorio && <span className="rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-black text-slate-600">Obrigatório</span>}
              {item.critico && <span className="rounded-lg bg-red-50 px-2 py-1 text-[11px] font-black text-red-700">Item crítico</span>}
              {item.exige_foto && <span className="rounded-lg bg-emerald-50 px-2 py-1 text-[11px] font-black text-emerald-700">Foto obrigatória</span>}
              {(item.valor_min != null || item.valor_max != null) && (
                <span className="rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-black text-slate-600">
                  Padrão: {item.valor_min ?? "—"} a {item.valor_max ?? "—"}{item.unidade_medida || ""}
                </span>
              )}
            </div>

            {/* Resposta conforme o tipo do item */}
            <div className="mt-5">
              {["FEITO_NAO_FEITO", "CONFORME_NAO_CONFORME", "SIM_NAO", "BOOLEAN"].includes(tipo) && (
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => salvarResposta(POSITIVO[tipo])} disabled={salvando}
                    className="flex min-h-16 items-center justify-center gap-2 rounded-2xl bg-emerald-600 text-base font-black text-white hover:bg-emerald-700 disabled:opacity-60">
                    <Check size={20} /> {tipo === "CONFORME_NAO_CONFORME" ? "Conforme" : tipo === "SIM_NAO" ? "Sim" : "Feito"}
                  </button>
                  <button onClick={() => salvarResposta(NEGATIVO[tipo])} disabled={salvando}
                    className="flex min-h-16 items-center justify-center gap-2 rounded-2xl border-2 border-red-200 bg-white text-base font-black text-red-700 hover:bg-red-50 disabled:opacity-60">
                    <X size={20} /> {tipo === "CONFORME_NAO_CONFORME" ? "Não conforme" : tipo === "SIM_NAO" ? "Não" : "Não feito"}
                  </button>
                </div>
              )}

              {NUMERICOS.includes(tipo) && (
                <>
                  <div className="flex items-center gap-2">
                    <input type="number" step="any" inputMode="decimal" autoFocus
                      value={rascunho.valor} onChange={e => setRascunho(r => ({ ...r, valor: e.target.value }))}
                      placeholder="0"
                      className="h-16 flex-1 rounded-2xl border-2 border-slate-200 px-4 text-2xl font-black text-slate-800 outline-none focus:border-emerald-500" />
                    {item.unidade_medida && <span className="text-xl font-black text-slate-500">{item.unidade_medida}</span>}
                  </div>
                  {rascunho.valor !== "" && conformeAtual === false && (
                    <p className="mt-2 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
                      <AlertTriangle size={16} /> Fora do padrão — vai gerar não conformidade.
                    </p>
                  )}
                </>
              )}

              {["TEXTO_CURTO", "TEXTO_LONGO"].includes(tipo) && (
                <textarea rows={tipo === "TEXTO_LONGO" ? 5 : 2} value={rascunho.valor}
                  onChange={e => setRascunho(r => ({ ...r, valor: e.target.value }))}
                  className="w-full rounded-2xl border-2 border-slate-200 p-4 text-base font-medium outline-none focus:border-emerald-500" />
              )}

              {["SELECAO_UNICA", "MULTIPLA_ESCOLHA"].includes(tipo) && (
                <div className="space-y-2">
                  {(item.opcoes || []).map((op, i) => (
                    <button key={i} onClick={() => salvarResposta(String(op))} disabled={salvando}
                      className="flex w-full items-center rounded-xl border-2 border-slate-200 bg-white p-4 text-left text-[15px] font-bold text-slate-700 hover:border-emerald-400">
                      {String(op)}
                    </button>
                  ))}
                </div>
              )}

              {["DATA", "HORA", "DATA_HORA"].includes(tipo) && (
                <input type={tipo === "DATA" ? "date" : tipo === "HORA" ? "time" : "datetime-local"}
                  value={rascunho.valor} onChange={e => setRascunho(r => ({ ...r, valor: e.target.value }))}
                  className="h-14 w-full rounded-2xl border-2 border-slate-200 px-4 text-base font-bold outline-none focus:border-emerald-500" />
              )}

              {["FOTO", "MULTIPLAS_FOTOS", "FOTO_COM_IA", "ASSINATURA"].includes(tipo) && (
                <div className="rounded-2xl border-2 border-dashed border-slate-300 p-6 text-center">
                  <Camera className="mx-auto text-slate-400" size={30} />
                  <p className="mt-2 text-sm font-bold text-slate-500">Captura de evidência entra na próxima etapa do módulo.</p>
                  <button onClick={() => salvarResposta("registrado")} disabled={salvando}
                    className="mt-3 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-black text-white">Marcar como feito</button>
                </div>
              )}
            </div>

            {/* Comentário */}
            <label className="mt-4 block">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">
                Observação {item.exige_comentario ? "(obrigatória)" : "(opcional)"}
              </span>
              <textarea rows={2} value={rascunho.comentario} onChange={e => setRascunho(r => ({ ...r, comentario: e.target.value }))}
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-[15px] font-medium outline-none focus:border-emerald-500" />
            </label>

            {erro && <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{erro}</p>}

            <div className="mt-5 flex flex-wrap gap-2">
              <button onClick={() => setIndice(i => Math.max(0, i - 1))} disabled={indice === 0}
                className="flex min-h-12 items-center gap-1.5 rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-600 disabled:opacity-40">
                <ArrowLeft size={16} /> Anterior
              </button>
              {item.permite_na && (
                <button onClick={() => salvarResposta("nao_aplica", true)} disabled={salvando}
                  className="min-h-12 rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-600">Não se aplica</button>
              )}
              {!["FEITO_NAO_FEITO", "CONFORME_NAO_CONFORME", "SIM_NAO", "BOOLEAN", "SELECAO_UNICA", "MULTIPLA_ESCOLHA"].includes(tipo) && (
                <button onClick={() => salvarResposta()} disabled={salvando}
                  className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-base font-black text-white hover:bg-emerald-700 disabled:opacity-60">
                  {salvando ? <Loader2 size={18} className="animate-spin" /> : <ArrowRight size={18} />} Salvar e continuar
                </button>
              )}
            </div>
          </section>
        )}

        {/* Conclusão */}
        <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-[13px] font-bold text-slate-600">
            {respondidos} de {itens.length} respondidos
            {Object.values(respostas).some(r => r.conforme === false) && (
              <span className="ml-2 inline-flex items-center gap-1 text-red-700"><ShieldAlert size={14} /> há itens fora do padrão</span>
            )}
          </p>
          <button onClick={finalizar} disabled={salvando || respondidos === 0}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 py-4 text-base font-black text-white hover:bg-slate-800 disabled:opacity-50">
            {salvando ? <Loader2 size={19} className="animate-spin" /> : <CheckCircle2 size={19} />} Concluir processo
          </button>
        </div>
      </main>
    </div>
  );
}
