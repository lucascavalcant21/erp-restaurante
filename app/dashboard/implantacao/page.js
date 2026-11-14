"use client";

// PRIMEIROS PASSOS (implantação, pedido do dono, 14/11/2026): primeiro o
// cadastro (o status vem do que está cadastrado de verdade); depois o Jhon
// pergunta, uma de cada vez, e as respostas formam o perfil do negócio que o
// Jhon e o Nico usam. Só o dono.

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ChevronRight, Circle, CircleDashed, CircleSlash, Loader2, Pencil } from "lucide-react";
import { useERP } from "../../context/ERPContext";
import { FundoMedway, RotuloSecao, TopoComVoltar } from "../../components/ui/Medway";
import PerguntaDoJhon from "../../components/implantacao/PerguntaDoJhon";
import { sessaoEhDono } from "../../lib/assistentes.mjs";
import { PERGUNTAS, statusDasEtapas, proximaPergunta, respostaDe, conhecimento } from "../../lib/implantacao.mjs";
import { carregarImplantacao, salvarResposta, salvarCustosFixos } from "../../lib/implantacao-dados";
import { DESPESAS_OPERACIONAIS } from "../../lib/composicao-preco.mjs";

const ICONE = { feito: CheckCircle2, pendente: Circle, sem_dado: CircleDashed, dispensada: CircleSlash };
const COR = { feito: "text-mw-agua", pendente: "text-mw-sec", sem_dado: "text-hf-warning", dispensada: "text-mw-borda" };
const valorTexto = (p, v) => (v === "nao_sei" ? "Não sei" : Array.isArray(v) ? v.join(", ") : p.tipo === "numero" && p.unidade?.startsWith("R$") ? Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : String(v));

function CustosFixos({ params, unidadeId, onSalvo }) {
  const [v, setV] = useState(() => Object.fromEntries(DESPESAS_OPERACIONAIS.map(([k]) => [k, Number(params?.[k]) > 0 ? String(params[k]) : ""])));
  const [mais, setMais] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const lista = mais ? DESPESAS_OPERACIONAIS : DESPESAS_OPERACIONAIS.slice(0, 5);
  async function salvar() {
    setSalvando(true); setErro("");
    const r = await salvarCustosFixos(unidadeId, v);
    setSalvando(false);
    if (r.error) setErro(r.error); else onSalvo();
  }
  return (
    <div className="mt-3 space-y-2">
      {lista.map(([k, rotulo]) => (
        <label key={k} className="flex items-center gap-3">
          <span className="w-32 shrink-0 text-[15px] text-mw-texto">{rotulo}</span>
          <span className="text-[14px] text-mw-sec">R$</span>
          <input inputMode="decimal" value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} placeholder="0,00"
            className="h-11 min-w-0 flex-1 rounded-full border border-mw-borda bg-white px-4 text-[16px] text-mw-marinho" />
        </label>
      ))}
      {!mais && <button type="button" onClick={() => setMais(true)} className="min-h-[44px] text-[14px] font-semibold text-mw-agua shadow-none">Mais custos (internet, contabilidade, sistemas…)</button>}
      <p className="text-[12.5px] text-mw-sec">Valores do mês. Ficam também na Pizza do Lucro e entram no custo de cada prato.</p>
      {erro && <p className="text-[14px] text-hf-danger">{erro}</p>}
      <button type="button" onClick={salvar} disabled={salvando} className="min-h-[48px] w-full rounded-full bg-mw-marinho text-[16px] font-semibold text-white shadow-none disabled:opacity-50">{salvando ? "Salvando…" : "Salvar custos"}</button>
    </div>
  );
}

export default function PrimeirosPassos() {
  const { unidadeAtiva, sessao } = useERP();
  const router = useRouter();
  const [dados, setDados] = useState(undefined);
  const [abertos, setAbertos] = useState({});
  const [mudando, setMudando] = useState(null);

  const carregar = useCallback(async () => setDados(await carregarImplantacao(unidadeAtiva)), [unidadeAtiva]);
  useEffect(() => { carregar(); }, [carregar]);

  const s = useMemo(() => (dados ? statusDasEtapas(dados) : null), [dados]);
  const pergunta = useMemo(() => (dados && s ? proximaPergunta(dados.perfil, { basicoPronto: s.basicoPronto }) : null), [dados, s]);
  const sabe = dados ? conhecimento(dados.perfil) : null;

  async function responderPergunta(id, valor) {
    const r = await salvarResposta(unidadeAtiva, id, valor);
    if (r.error) return `Não salvou: ${r.error}`;
    setDados((d) => ({ ...d, perfil: r.perfil }));
    setMudando(null);
    return null;
  }

  if (sessao && !sessaoEhDono(sessao)) return <FundoMedway><TopoComVoltar titulo="Primeiros passos" /><p className="px-4 py-8 text-[15px] text-mw-sec">Os primeiros passos são feitos pelo dono.</p></FundoMedway>;
  if (dados === undefined) return <FundoMedway><TopoComVoltar titulo="Primeiros passos" /><p className="flex items-center gap-2 px-4 py-8 text-mw-sec"><Loader2 size={18} className="animate-spin" /> Conferindo o que já está cadastrado…</p></FundoMedway>;
  if (!dados) return <FundoMedway><TopoComVoltar titulo="Primeiros passos" /><p className="px-4 py-8 text-mw-sec">Escolha uma unidade.</p></FundoMedway>;

  const respondidas = PERGUNTAS.filter((p) => respostaDe(dados.perfil, p.id) !== undefined);

  return (
    <FundoMedway>
      <TopoComVoltar titulo="Primeiros passos" />
      <div className="mx-auto max-w-2xl space-y-6 px-4 pt-5 sm:px-6">
        <section className="rounded-[22px] bg-gradient-to-br from-mw-azul/20 to-mw-agua-claro p-5">
          <p className="text-[15px] text-mw-texto">Seu Héfisto está</p>
          <p className="text-[34px] font-semibold leading-none text-mw-marinho">{s.pct}% pronto</p>
          <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white/70"><div className="h-full rounded-full bg-mw-agua transition-all" style={{ width: `${s.pct}%` }} /></div>
          <p className="mt-2 text-[14px] text-mw-sec">{s.feitas} de {s.total} passos · o Jhon conhece {sabe.pct}% do seu negócio</p>
        </section>

        <section className="space-y-2.5">
          <RotuloSecao>1. Cadastre o básico</RotuloSecao>
          <ul className="space-y-2.5">
            {s.etapas.map((e) => {
              const Icone = ICONE[e.status] || Circle;
              return (
                <li key={e.id} className="rounded-[20px] border border-mw-borda bg-mw-card p-4">
                  <div className="flex items-start gap-3">
                    <Icone size={24} className={`mt-0.5 shrink-0 ${COR[e.status]}`} />
                    <div className="min-w-0 flex-1">
                      <p className={`text-[16px] font-semibold ${e.status === "dispensada" ? "text-mw-sec line-through" : "text-mw-marinho"}`}>{e.titulo}</p>
                      <p className="text-[14px] text-mw-sec">{e.status === "sem_dado" ? "DADOS INSUFICIENTES: não consegui conferir agora." : e.detalhe || e.texto}</p>
                    </div>
                    {e.status !== "dispensada" && (e.rota ? (
                      <button type="button" onClick={() => router.push(e.rota)} aria-label={`Abrir ${e.titulo}`} className="flex min-h-[44px] shrink-0 items-center gap-1 rounded-full border border-mw-borda px-3 text-[14px] font-semibold text-mw-marinho shadow-none">
                        {e.status === "feito" ? "Ver" : "Cadastrar"} <ChevronRight size={15} />
                      </button>
                    ) : (
                      <button type="button" onClick={() => setAbertos((a) => ({ ...a, [e.id]: !a[e.id] }))} className="min-h-[44px] shrink-0 rounded-full border border-mw-borda px-3 text-[14px] font-semibold text-mw-marinho shadow-none">
                        {abertos[e.id] ? "Fechar" : e.status === "feito" ? "Editar" : "Preencher"}
                      </button>
                    ))}
                  </div>
                  {e.id === "custos" && abertos.custos && <CustosFixos params={dados.params} unidadeId={unidadeAtiva} onSalvo={() => { setAbertos((a) => ({ ...a, custos: false })); carregar(); }} />}
                </li>
              );
            })}
          </ul>
        </section>

        <section className="space-y-3">
          <RotuloSecao>2. O Jhon quer te conhecer</RotuloSecao>
          {!s.basicoPronto ? (
            <p className="rounded-[20px] border border-dashed border-mw-borda p-4 text-[15px] text-mw-sec">Assim que os dados do estabelecimento estiverem prontos, o Jhon começa a te fazer perguntas, uma de cada vez. O que você responder, ele passa para o Nico (só o que é da cozinha).</p>
          ) : mudando ? (
            <PerguntaDoJhon key={mudando.id} pergunta={mudando} inicial={respostaDe(dados.perfil, mudando.id)} onResponder={(v) => responderPergunta(mudando.id, v)} />
          ) : pergunta ? (
            <PerguntaDoJhon key={pergunta.id} pergunta={pergunta} onResponder={(v) => responderPergunta(pergunta.id, v)} />
          ) : (
            <p className="rounded-[20px] bg-mw-agua-claro p-4 text-[15px] text-mw-marinho">O Jhon já conhece o básico do seu negócio. Quando quiser mudar alguma resposta, toque nela.</p>
          )}
          {respondidas.length > 0 && (
            <ul className="divide-y divide-mw-borda rounded-[20px] border border-mw-borda bg-mw-card">
              {respondidas.map((p) => (
                <li key={p.id}>
                  <button type="button" onClick={() => setMudando(p)} className="flex min-h-[56px] w-full items-center gap-3 px-4 py-3 text-left shadow-none">
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] text-mw-sec">{p.texto}</span>
                      <span className="block text-[15.5px] font-semibold text-mw-marinho">{valorTexto(p, respostaDe(dados.perfil, p.id))}</span>
                    </span>
                    <Pencil size={15} className="shrink-0 text-mw-sec" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </FundoMedway>
  );
}
