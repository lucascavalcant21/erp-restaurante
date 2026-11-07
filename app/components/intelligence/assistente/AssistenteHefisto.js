"use client";

// ASSISTENTE HÉFISTO — a conversa da Inteligência com cara de WhatsApp (pedido
// do dono, 06/11/2026): papel de parede bege, balões verde-claro (você) e
// brancos (assistente) com "rabinho", hora e ✓✓, botão redondo que vira
// microfone quando o campo está vazio, e responder a uma pergunta direto no
// campo de mensagem (com a citação em cima, como no WhatsApp).
//
// Por baixo é o MESMO caminho da Central: /api/intelligence/ask (Command Bus),
// confirmação no servidor e auditoria. A voz só troca a ENTRADA (fala → texto).
// As cores do WhatsApp ficam presas a esta tela (variáveis --wa-*), como
// exceção pedida pelo dono ao padrão hf-* (decisão registrada em docs/brain).

import { forwardRef, memo, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Mic, Send, Square, Volume2, VolumeX, X, Bot, CheckCheck, Check, AlertTriangle, ShieldAlert, ExternalLink, Lock } from "lucide-react";
import { perguntarAoHefisto, confirmarAcao, cancelarAcao, novaChaveDeEnvio } from "../../../lib/intelligence/client/api";
import { provedorDeVoz } from "../../../lib/intelligence/voice/voice-provider";

export const NOME_ASSISTENTE = "Assistente Héfisto";

export const SUGESTOES_ASSISTENTE = Object.freeze([
  "Adicione 3 kg de picanha, 4 litros de xarope de guaraná",
  "Quanto tenho no estoque de óleo?",
  "Meus funcionários chegaram no horário?",
  "Chegou 3 kg de picanha, só que era para pedir 2",
  "Vamos montar uma receita. O nome vai ser molho de tomate, e vai tomate, sal, alho, pimenta do reino",
  "Como foi minha empresa hoje?",
]);

const CORES = {
  "--wa-fundo": "#EFEAE2",
  "--wa-topo": "#008069",
  "--wa-eu": "#D9FDD3",
  "--wa-ele": "#FFFFFF",
  "--wa-texto": "#111B21",
  "--wa-meta": "#667781",
  "--wa-verde": "#00A884",
  "--wa-verde-escuro": "#008069",
  "--wa-lido": "#53BDEB",
  "--wa-aviso": "#FFEECD",
  "--wa-barra": "#F0F2F5",
};

// Papel de parede: rabiscos leves repetidos (SVG inline, sem imagem externa).
const PAPEL = `url("data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120"><g fill="none" stroke="#d6cfc4" stroke-width="1.4" stroke-linecap="round" opacity="0.55"><circle cx="18" cy="20" r="7"/><path d="M48 14l8 8M56 14l-8 8"/><path d="M84 18c6-6 14 2 8 8s-14-2-8-8z"/><rect x="12" y="52" width="14" height="10" rx="3"/><path d="M50 58c4-8 12-8 16 0"/><circle cx="94" cy="58" r="3"/><path d="M20 96l6-8 6 8z"/><path d="M52 92h16M60 84v16"/><path d="M88 92c0-6 10-6 10 0s-10 6-10 0z"/></g></svg>')}")`;

const FMT_HORA = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });
const hora = (t) => FMT_HORA.format(new Date(t || Date.now()));
let seq = 0;
const novoId = () => `e${Date.now().toString(36)}${++seq}`;
const MAX_MENSAGENS = 120;
const chaveSessao = (u) => `hefisto:assistente:${u || "-"}`;

function lerSalvas(unidadeId) {
  try {
    const x = JSON.parse(window.sessionStorage.getItem(chaveSessao(unidadeId)) || "null");
    return Array.isArray(x?.mensagens) ? x : null;
  } catch { return null; }
}
function salvar(unidadeId, dados) {
  try { window.sessionStorage.setItem(chaveSessao(unidadeId), JSON.stringify(dados)); } catch { /* sem armazenamento: segue só em memória */ }
}

/** A pergunta aberta que o campo de mensagem pode responder (texto livre). */
function perguntaRespondivel(r) {
  const p = r?.pergunta;
  if (!p) return null;
  if (p.acaoId && !p.opcoes?.length) return p;
  if (p.comandoBase && !p.opcoes?.length) return p;
  return null;
}

// ─── balões ───────────────────────────────────────────────────────────────────
function Balao({ lado, children, hora: h, lido, cauda = true, largo = false }) {
  const eu = lado === "eu";
  return (
    <div className={`flex ${eu ? "justify-end" : "justify-start"} px-2 sm:px-[6%]`}>
      <div
        className={`relative ${largo ? "w-full max-w-[92%] sm:max-w-[520px]" : "max-w-[85%] sm:max-w-[520px]"} rounded-[7.5px] px-2.5 pb-1.5 pt-1.5 text-[14.5px] leading-[19px] shadow-[0_1px_0.5px_rgba(11,20,26,0.13)] ${eu && cauda ? "rounded-tr-none" : ""} ${!eu && cauda ? "rounded-tl-none" : ""}`}
        style={{ background: eu ? "var(--wa-eu)" : "var(--wa-ele)", color: "var(--wa-texto)" }}
      >
        {cauda && (
          <svg viewBox="0 0 8 13" width="8" height="13" className={`absolute top-0 ${eu ? "-right-2" : "-left-2 -scale-x-100"}`} aria-hidden="true">
            <path d="M5.188 1H0v11.193l6.467-8.625C7.526 2.156 6.958 1 5.188 1z" fill={eu ? "var(--wa-eu)" : "var(--wa-ele)"} />
          </svg>
        )}
        {children}
        <span className="float-right ml-3 mt-1.5 inline-flex translate-y-0.5 items-center gap-0.5 text-[11px] leading-none" style={{ color: "var(--wa-meta)" }}>
          {hora(h)}
          {eu && (lido ? <CheckCheck size={15} style={{ color: "var(--wa-lido)" }} /> : <Check size={15} />)}
        </span>
      </div>
    </div>
  );
}

const BotoesRapidos = memo(function BotoesRapidos({ opcoes, onEscolher, desabilitado }) {
  if (!opcoes?.length) return null;
  return (
    <div className="flex justify-start px-2 sm:px-[6%]">
      <div className="grid w-full max-w-[85%] gap-1 sm:max-w-[520px]">
        {opcoes.map((o, i) => (
          <button
            key={`${o.id || o.rotulo}-${i}`}
            type="button"
            disabled={desabilitado}
            onClick={() => onEscolher(o)}
            className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-[7.5px] px-3 text-center text-[14px] font-medium shadow-[0_1px_0.5px_rgba(11,20,26,0.13)] transition active:scale-[0.99] disabled:opacity-50"
            style={{ background: "var(--wa-ele)", color: "var(--wa-verde-escuro)" }}
          >
            {o.rota && <ExternalLink size={14} />}
            {o.rotulo}
          </button>
        ))}
      </div>
    </div>
  );
});

function Blocos({ blocos }) {
  if (!blocos?.length) return null;
  return (
    <div className="mt-1.5 space-y-2">
      {blocos.map((b, i) => {
        if (b.tipo === "lista") {
          return (
            <div key={i} className="rounded-md bg-black/[0.035] px-2 py-1.5">
              {b.titulo && <p className="mb-0.5 text-[13px] font-semibold">{b.titulo}</p>}
              <ul className="space-y-0.5">
                {(b.itens || []).slice(0, 14).map((it, j) => (
                  <li key={j} className="flex items-baseline justify-between gap-3 text-[13px]">
                    <span className="min-w-0">
                      {it.rotulo}
                      {it.detalhe ? <span className="block text-[11.5px]" style={{ color: "var(--wa-meta)" }}>{it.detalhe}</span> : null}
                    </span>
                    {it.valor ? <span className="shrink-0 font-semibold tabular-nums">{it.valor}</span> : null}
                  </li>
                ))}
              </ul>
            </div>
          );
        }
        if (b.tipo === "texto") return <p key={i} className="text-[12.5px]" style={{ color: "var(--wa-meta)" }}>{b.qualificador ? <strong>{b.qualificador}: </strong> : null}{b.texto}</p>;
        if (b.tipo === "insight" && b.insight?.titulo) return <p key={i} className="text-[13px]">• {b.insight.titulo}</p>;
        return null; // métrica: o texto da resposta já traz a frase
      })}
    </div>
  );
}

function Rodape({ r }) {
  const fontes = r?.fontesConsultadas || [];
  if (!fontes.length) return null;
  return <p className="mt-1 text-[11px]" style={{ color: "var(--wa-meta)" }}>Fontes: {fontes.join(" · ")}</p>;
}

const CartaoConfirmacao = memo(function CartaoConfirmacao({ c, resolvida, ocupado, onConfirmar, onCancelar }) {
  const [texto, setTexto] = useState("");
  return (
    <>
      <p className="font-semibold">{c.titulo}</p>
      <dl className="mt-1 space-y-0.5 text-[13.5px]">
        {(c.linhas || []).map((l, i) => (
          <div key={i} className="flex items-baseline justify-between gap-3">
            <dt style={{ color: "var(--wa-meta)" }}>{l.rotulo}</dt>
            <dd className="text-right font-medium tabular-nums">{l.valor}</dd>
          </div>
        ))}
      </dl>
      {c.confirmacaoExplicita && !resolvida && (
        <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Digite CONFIRMAR" className="mt-2 h-10 w-full rounded-md border border-black/10 bg-white px-2 text-[14px] outline-none" />
      )}
      {resolvida ? (
        <p className="mt-1.5 text-[12.5px] italic" style={{ color: "var(--wa-meta)" }}>{resolvida === "confirmada" ? "Confirmado." : "Cancelado."}</p>
      ) : (
        <div className="mt-2 grid grid-cols-2 gap-1.5 border-t border-black/5 pt-1.5">
          <button type="button" disabled={ocupado} onClick={onCancelar} className="min-h-[42px] rounded-md text-[14px] font-medium disabled:opacity-50" style={{ color: "var(--wa-meta)" }}>Cancelar</button>
          <button type="button" disabled={ocupado || (c.confirmacaoExplicita && texto !== "CONFIRMAR")} onClick={() => onConfirmar(c.confirmacaoExplicita ? texto : null)} className="min-h-[42px] rounded-md text-[14px] font-semibold text-white disabled:opacity-50" style={{ background: "var(--wa-verde)" }}>Confirmar</button>
        </div>
      )}
      {!resolvida && <p className="mt-1 text-[11px]" style={{ color: "var(--wa-meta)" }}>Nada é gravado antes de confirmar.</p>}
    </>
  );
});

/** Uma resposta do assistente: um ou mais balões (lote = um balão por item). */
const RespostaAssistente = memo(function RespostaAssistente({ m, ultima, ocupado, resolvidas, onComando, onRota, onContinuar, onConfirmar, onCancelar, onConfirmarTodos }) {
  const r = m.resposta || {};
  const conteudo = (x, chave, primeiro) => {
    const erro = x.tipo === "erro_acao" || x.tipo === "bloqueado";
    const resolvida = x.confirmacao ? resolvidas[x.confirmacao.acaoId] : null;
    // escolhas e sugestões só valem na última mensagem (como os botões de resposta do WhatsApp);
    // links para telas continuam em todas
    const opcoes = ultima && x.pergunta?.opcoes?.length && !(x.pergunta.acaoId && resolvidas[x.pergunta.acaoId])
      ? x.pergunta.opcoes.map((o) => ({ ...o, _pergunta: x.pergunta })) : [];
    const rapidos = [
      ...opcoes,
      ...(ultima ? x.sugestoes || [] : []).map((s) => ({ id: s, rotulo: s, comando: s })),
      ...(x.acoes || []).map((a, i) => ({ id: `a${i}`, rotulo: a.rotulo, comando: a.comando, rota: a.rota })),
    ];
    return (
      <div key={chave} className="space-y-1">
        <Balao lado="ele" hora={m.em} cauda={primeiro} largo={!!x.confirmacao}>
          {x.item && !x.confirmacao && <p className="text-[12px] font-semibold" style={{ color: "var(--wa-verde-escuro)" }}>{x.item}</p>}
          {x.confirmacao ? (
            <CartaoConfirmacao c={x.confirmacao} resolvida={resolvida} ocupado={ocupado} onConfirmar={(t) => onConfirmar(x.confirmacao.acaoId, t)} onCancelar={() => onCancelar(x.confirmacao.acaoId)} />
          ) : x.tipo === "resultado_acao" ? (
            <>
              <p className="font-semibold">✅ {x.texto}</p>
              <dl className="mt-1 space-y-0.5 text-[13.5px]">
                {(x.resultado?.linhas || []).map((l, i) => (
                  <div key={i} className="flex items-baseline justify-between gap-3"><dt style={{ color: "var(--wa-meta)" }}>{l.rotulo}</dt><dd className="text-right font-medium tabular-nums">{l.valor}</dd></div>
                ))}
              </dl>
              {x.repetido && <p className="mt-1 text-[12px]" style={{ color: "var(--wa-meta)" }}>Já tinha sido feito — nada foi duplicado.</p>}
            </>
          ) : (
            <p className="whitespace-pre-line">
              {x.tipo === "bloqueado" && <ShieldAlert size={15} className="mr-1 inline -translate-y-px text-amber-600" />}
              {erro && x.tipo !== "bloqueado" && <AlertTriangle size={15} className="mr-1 inline -translate-y-px text-amber-600" />}
              {x.texto}
              {x.pergunta?.texto && x.pergunta.texto !== x.texto ? `\n${x.pergunta.texto}` : ""}
            </p>
          )}
          <Blocos blocos={x.blocos} />
          {primeiro && <Rodape r={r} />}
        </Balao>
        <BotoesRapidos
          opcoes={rapidos}
          desabilitado={ocupado}
          onEscolher={(o) => (o._pergunta?.acaoId && !o.comando ? onContinuar(o._pergunta, o.id, o.rotulo) : o.rota ? onRota(o.rota) : onComando(o.comando || o.rotulo, { exibir: o._pergunta ? o.rotulo : null }))}
        />
      </div>
    );
  };
  if (r.tipo === "lote" && Array.isArray(r.itens)) {
    const pendentes = r.itens.filter((x) => x.confirmacao && !resolvidas[x.confirmacao.acaoId]);
    return (
      <div className="space-y-1">
        <Balao lado="ele" hora={m.em}><p>{r.texto}</p></Balao>
        {r.itens.map((x, i) => conteudo(x, `${m.id}-${i}`, false))}
        {pendentes.length > 1 && (
          <BotoesRapidos opcoes={[{ id: "todos", rotulo: `Confirmar todos (${pendentes.length})` }]} desabilitado={ocupado} onEscolher={() => onConfirmarTodos(pendentes.map((x) => x.confirmacao.acaoId))} />
        )}
      </div>
    );
  }
  return conteudo(r, m.id, true);
});

const MensagemMinha = memo(function MensagemMinha({ m }) {
  return (
    <Balao lado="eu" hora={m.em} lido={m.lido}>
      {m.citacao && (
        <span className="mb-1 block rounded-md border-l-4 bg-black/5 px-2 py-1 text-[12.5px]" style={{ borderColor: "var(--wa-verde)" }}>
          <span className="block font-semibold" style={{ color: "var(--wa-verde-escuro)" }}>{NOME_ASSISTENTE}</span>
          <span className="line-clamp-2" style={{ color: "var(--wa-meta)" }}>{m.citacao}</span>
        </span>
      )}
      {m.canal === "voz" && (
        <span className="mb-0.5 flex items-center gap-2" aria-label="Mensagem de voz">
          <span className="grid h-7 w-7 place-items-center rounded-full text-white" style={{ background: "var(--wa-verde)" }}><Mic size={14} /></span>
          <span className="flex h-5 items-end gap-[2px]" aria-hidden="true">
            {[6, 10, 14, 8, 16, 12, 7, 15, 9, 13, 6, 11, 16, 8, 12, 5].map((h, i) => <span key={i} className="w-[3px] rounded-full" style={{ height: h, background: "var(--wa-meta)", opacity: 0.6 }} />)}
          </span>
        </span>
      )}
      <span className={`whitespace-pre-line ${m.canal === "voz" ? "text-[13.5px] italic" : ""}`}>{m.texto}</span>
    </Balao>
  );
});

function Digitando() {
  return (
    <div className="flex justify-start px-2 sm:px-[6%]" role="status" aria-label="Assistente digitando">
      <div className="relative rounded-[7.5px] rounded-tl-none px-3.5 py-3 shadow-[0_1px_0.5px_rgba(11,20,26,0.13)]" style={{ background: "var(--wa-ele)" }}>
        <span className="flex gap-1">
          {[0, 1, 2].map((i) => <span key={i} className="h-2 w-2 animate-bounce rounded-full" style={{ background: "var(--wa-meta)", animationDelay: `${i * 0.15}s` }} />)}
        </span>
      </div>
    </div>
  );
}

// ─── tela ─────────────────────────────────────────────────────────────────────
const AssistenteHefisto = forwardRef(function AssistenteHefisto({ unidadeId, unidadeNome = "", perguntaInicial = null, tela = null, rotuloOrigem = null, onVoltar, onPerguntaInicialEnviada = null }, ref) {
  // tela de origem (atalho Alt+H de outra página): rota e registro aberto viram contexto da conversa
  const TELA = tela || TELA_PADRAO;
  const router = useRouter();
  const [mensagens, setMensagens] = useState([]);
  const [resolvidas, setResolvidas] = useState({});
  const [ocupado, setOcupado] = useState(false);
  const [texto, setTexto] = useState("");
  const [respondendo, setRespondendo] = useState(null);
  const [ouvindo, setOuvindo] = useState(false);
  const [parcial, setParcial] = useState("");
  const [lerEmVoz, setLerEmVoz] = useState(false);
  const [vozOk, setVozOk] = useState(false);
  const voz = useMemo(() => provedorDeVoz(), []);
  const referenciaRef = useRef(null);
  const ocupadoRef = useRef(false);
  const escutaRef = useRef(null);
  const fimRef = useRef(null);
  const campoRef = useRef(null);
  const iniciou = useRef(false);
  const carregou = useRef(false);

  useEffect(() => { setVozOk(voz.disponivel()); }, [voz]);
  useEffect(() => () => { escutaRef.current?.parar(); voz.calar(); }, [voz]);

  // conversa da sessão do navegador (volta ao reabrir a tela)
  useEffect(() => {
    carregou.current = false;
    const s = typeof window !== "undefined" ? lerSalvas(unidadeId) : null;
    setMensagens(s?.mensagens || []);
    setResolvidas(s?.resolvidas || {});
    referenciaRef.current = s?.referencia || null;
    setRespondendo(null);
    carregou.current = true;
  }, [unidadeId]);
  useEffect(() => {
    if (!carregou.current) return;
    salvar(unidadeId, { mensagens: mensagens.slice(-MAX_MENSAGENS), resolvidas, referencia: referenciaRef.current });
  }, [mensagens, resolvidas, unidadeId]);
  useEffect(() => { fimRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [mensagens, ocupado]);

  const adicionar = useCallback((m) => setMensagens((xs) => [...xs, { id: novoId(), em: Date.now(), ...m }].slice(-MAX_MENSAGENS)), []);
  const marcarLidas = useCallback(() => setMensagens((xs) => xs.map((x) => (x.de === "eu" && !x.lido ? { ...x, lido: true } : x))), []);

  const tratar = useCallback((dados, { canal } = {}) => {
    marcarLidas();
    adicionar({ de: "assistente", resposta: dados });
    if (dados?.referencia) referenciaRef.current = dados.referencia;
    const aberta = perguntaRespondivel(dados);
    setRespondendo(aberta ? { pergunta: aberta, texto: aberta.texto || dados.texto } : null);
    if (canal === "voz" && lerEmVoz && dados?.texto) voz.falar(dados.texto);
    if (dados?.tipo === "navegacao" && dados.rota) setTimeout(() => router.push(dados.rota), 350);
  }, [adicionar, marcarLidas, lerEmVoz, voz, router]);

  const executar = useCallback(async (chamada, falha, { canal } = {}) => {
    ocupadoRef.current = true;
    setOcupado(true);
    try {
      const r = await chamada();
      if (r?.ok) tratar(r.dados, { canal });
      else tratar({ tipo: "erro_acao", texto: r?.dados?.erro || falha }, { canal });
      return r;
    } catch {
      tratar({ tipo: "erro_acao", texto: "Falha de conexão. Verifique a internet e tente de novo." }, { canal });
      return null;
    } finally {
      ocupadoRef.current = false;
      setOcupado(false);
    }
  }, [tratar]);

  const enviarComando = useCallback(async (t, { canal = "texto", exibir = null } = {}) => {
    const limpo = String(t || "").trim();
    if (!limpo || ocupadoRef.current) return;
    // escolha de um botão aparece como o botão ("Recebimento"), não como o comando montado
    adicionar({ de: "eu", texto: exibir || limpo, canal });
    setRespondendo(null);
    await executar(() => perguntarAoHefisto(unidadeId, { texto: limpo, chave: novaChaveDeEnvio(), canal, tela: TELA, conversa: referenciaRef.current }), "Não consegui responder agora.", { canal });
  }, [adicionar, executar, unidadeId, TELA]);

  const continuar = useCallback(async (pergunta, valor, rotulo = null, { canal = "texto" } = {}) => {
    if (ocupadoRef.current) return;
    adicionar({ de: "eu", texto: rotulo || String(valor), canal, citacao: pergunta.texto || null });
    setRespondendo(null);
    const bruto = String(valor).trim();
    const numero = pergunta.campo === "quantidade" ? Number(bruto.includes(",") ? bruto.replace(/\./g, "").replace(",", ".") : bruto) : null;
    await executar(() => perguntarAoHefisto(unidadeId, {
      continuar: { acaoId: pergunta.acaoId, campo: pergunta.campo, valor: numero == null || !Number.isFinite(numero) ? bruto.slice(0, 120) : null, valorNumero: Number.isFinite(numero) ? numero : null },
      tela: TELA,
    }), "Não consegui continuar.", { canal });
  }, [adicionar, executar, unidadeId, TELA]);

  /** Mensagem do campo: responde a pergunta aberta ou vira pedido novo. */
  const enviar = useCallback((t, { canal = "texto" } = {}) => {
    const limpo = String(t || "").trim();
    if (!limpo) return;
    const p = respondendo?.pergunta;
    if (p?.acaoId) return continuar(p, limpo, null, { canal });
    if (p?.comandoBase) {
      adicionar({ de: "eu", texto: limpo, canal, citacao: p.texto || null });
      setRespondendo(null);
      const comando = p.comandoBase.includes("{valor}") ? p.comandoBase.replace("{valor}", limpo) : `${p.comandoBase} ${limpo}`;
      return executar(() => perguntarAoHefisto(unidadeId, { texto: comando.slice(0, 500), chave: novaChaveDeEnvio(), canal, tela: TELA, conversa: referenciaRef.current }), "Não consegui responder agora.", { canal });
    }
    return enviarComando(limpo, { canal });
  }, [respondendo, continuar, enviarComando, adicionar, executar, unidadeId, TELA]);

  useImperativeHandle(ref, () => ({ enviar: enviarComando }), [enviarComando]);

  // Alt+H / busca com pergunta enquanto já se está aqui: a pergunta entra nesta conversa
  useEffect(() => {
    const aoPerguntar = (e) => { const t = e?.detail?.texto; if (t) enviarComando(t); else campoRef.current?.focus(); };
    window.addEventListener("hefisto:perguntar", aoPerguntar);
    return () => window.removeEventListener("hefisto:perguntar", aoPerguntar);
  }, [enviarComando]);

  // pergunta vinda da Central ou do atalho (?q=): manda uma vez só. A função mais nova vem
  // por ref, porque um re-render no meio cancelaria o envio (e o ref "iniciou" já marcado
  // impediria tentar de novo).
  const enviarRef = useRef(enviarComando);
  enviarRef.current = enviarComando;
  useEffect(() => {
    if (!perguntaInicial || iniciou.current || !unidadeId) return;
    iniciou.current = true;
    setTimeout(() => { enviarRef.current(perguntaInicial); onPerguntaInicialEnviada?.(); }, 150);
  }, [perguntaInicial, unidadeId, onPerguntaInicialEnviada]);

  const resolver = useCallback((acaoId, estado) => setResolvidas((x) => ({ ...x, [acaoId]: estado })), []);
  const confirmar = useCallback(async (acaoId, t) => {
    if (ocupadoRef.current) return;
    const r = await executar(() => confirmarAcao(unidadeId, acaoId, t), "Não consegui confirmar.");
    if (r?.ok && r.dados?.tipo !== "erro_acao") resolver(acaoId, "confirmada");
  }, [executar, unidadeId, resolver]);
  const cancelar = useCallback(async (acaoId) => {
    if (ocupadoRef.current) return;
    const r = await executar(() => cancelarAcao(unidadeId, acaoId), "Não consegui cancelar.");
    if (r?.ok) resolver(acaoId, "cancelada");
  }, [executar, unidadeId, resolver]);
  const confirmarTodos = useCallback(async (ids) => {
    for (const id of ids) {
      // um por vez: cada confirmação é auditada e executada no servidor
      // eslint-disable-next-line no-await-in-loop
      await confirmar(id, null);
    }
  }, [confirmar]);

  // ─── voz ───
  const alternarMicrofone = useCallback(() => {
    if (ouvindo) { escutaRef.current?.parar(); setOuvindo(false); return; }
    voz.calar();
    setParcial("");
    setOuvindo(true);
    escutaRef.current = voz.ouvir({
      onParcial: (t) => setParcial(t),
      onFinal: (t) => { setOuvindo(false); setParcial(""); enviar(t, { canal: "voz" }); },
      onErro: (msg) => { setOuvindo(false); adicionar({ de: "assistente", resposta: { tipo: "erro_acao", texto: msg } }); },
      onFim: () => setOuvindo(false),
    });
  }, [ouvindo, voz, enviar, adicionar]);

  const submeter = (e) => {
    e?.preventDefault();
    const t = texto.trim();
    if (!t || ocupado) return;
    setTexto("");
    enviar(t);
  };

  useEffect(() => {
    const el = campoRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [texto]);

  const vazio = mensagens.length === 0;
  const status = ouvindo ? "ouvindo…" : ocupado ? "digitando…" : "online";

  return (
    <div className="flex h-full min-h-0 flex-col" style={{ ...CORES, background: "var(--wa-fundo)" }}>
      {/* topo */}
      <header className="flex min-h-[60px] shrink-0 items-center gap-2 px-2 text-white shadow-sm" style={{ background: "var(--wa-topo)" }}>
        <button type="button" onClick={onVoltar || (() => router.back())} aria-label="Voltar" className="grid h-11 w-10 place-items-center rounded-full active:bg-white/10">
          <ArrowLeft size={22} />
        </button>
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/95" style={{ color: "var(--wa-verde-escuro)" }}><Bot size={22} /></span>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-[16.5px] font-semibold">{NOME_ASSISTENTE}</p>
          <p className="truncate text-[12.5px] text-white/85" aria-live="polite">{status}{unidadeNome ? ` · ${unidadeNome}` : ""}</p>
        </div>
        {vozOk && voz.sinteseDisponivel?.() && (
          <button type="button" onClick={() => { setLerEmVoz((v) => !v); voz.calar(); }} aria-label={lerEmVoz ? "Parar de ler as respostas em voz alta" : "Ler as respostas de voz em voz alta"} className="grid h-11 w-11 place-items-center rounded-full active:bg-white/10">
            {lerEmVoz ? <Volume2 size={21} /> : <VolumeX size={21} />}
          </button>
        )}
      </header>

      {/* conversa */}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-2" style={{ backgroundImage: PAPEL }} aria-live="polite">
        <div className="mx-auto w-full max-w-4xl space-y-1.5">
          <div className="flex justify-center pt-1">
            <span className="rounded-[7.5px] px-3 py-1 text-[12.5px] font-medium shadow-[0_1px_0.5px_rgba(11,20,26,0.13)]" style={{ background: "var(--wa-ele)", color: "var(--wa-meta)" }}>HOJE</span>
          </div>
          {rotuloOrigem && (
            <div className="flex justify-center px-4">
              <span className="max-w-full truncate rounded-[7.5px] px-3 py-1 text-[12px] shadow-[0_1px_0.5px_rgba(11,20,26,0.13)]" style={{ background: "var(--wa-ele)", color: "var(--wa-meta)" }}>Vindo de: {rotuloOrigem}</span>
            </div>
          )}
          <div className="flex justify-center px-4">
            <p className="max-w-md rounded-[7.5px] px-3 py-1.5 text-center text-[12.5px] leading-snug" style={{ background: "var(--wa-aviso)", color: "#54656F" }}>
              <Lock size={11} className="mr-1 inline -translate-y-px" />
              Respostas só com os dados da sua unidade. Nada é gravado sem você confirmar, e tudo fica na auditoria.
            </p>
          </div>

          {vazio && (
            <div className="space-y-1">
              <Balao lado="ele" hora={Date.now()}>
                <p>Olá! Sou o {NOME_ASSISTENTE}. Pode escrever ou mandar áudio. Eu dou entrada no estoque (cada produto no setor dele), confiro o que chegou, vejo quem chegou no horário e monto fichas técnicas com custo e lucro.</p>
              </Balao>
              <BotoesRapidos opcoes={SUGESTOES_ASSISTENTE.map((s) => ({ id: s, rotulo: s, comando: s }))} desabilitado={ocupado} onEscolher={(o) => enviarComando(o.comando)} />
            </div>
          )}

          {mensagens.map((m, i) => (m.de === "eu" ? <MensagemMinha key={m.id} m={m} /> : (
            <RespostaAssistente key={m.id} m={m} ultima={i === mensagens.length - 1} ocupado={ocupado} resolvidas={resolvidas}
              onComando={enviarComando} onRota={(r) => router.push(r)} onContinuar={continuar}
              onConfirmar={confirmar} onCancelar={cancelar} onConfirmarTodos={confirmarTodos} />
          )))}
          {ocupado && <Digitando />}
          <div ref={fimRef} className="h-1" />
        </div>
      </div>

      {/* campo de mensagem */}
      <div className="shrink-0 px-1.5 pt-1.5" style={{ background: "var(--wa-barra)", paddingBottom: "max(6px, env(safe-area-inset-bottom, 0px))" }}>
        <div className="mx-auto w-full max-w-4xl">
          {respondendo && (
            <div className="mx-1 mb-1 flex items-start gap-2 rounded-lg border-l-4 bg-white px-2.5 py-1.5" style={{ borderColor: "var(--wa-verde)" }}>
              <div className="min-w-0 flex-1">
                <p className="text-[12.5px] font-semibold" style={{ color: "var(--wa-verde-escuro)" }}>Respondendo a {NOME_ASSISTENTE}</p>
                <p className="line-clamp-2 text-[12.5px]" style={{ color: "var(--wa-meta)" }}>{respondendo.texto}</p>
              </div>
              <button type="button" onClick={() => setRespondendo(null)} aria-label="Não responder a esta pergunta" className="grid h-8 w-8 place-items-center rounded-full" style={{ color: "var(--wa-meta)" }}><X size={16} /></button>
            </div>
          )}
          {ouvindo ? (
            <div className="flex items-center gap-2 pb-1">
              <div className="flex min-h-[46px] flex-1 items-center gap-2 rounded-3xl bg-white px-4 text-[15px]">
                <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" />
                <span className="min-w-0 flex-1 truncate" style={{ color: parcial ? "var(--wa-texto)" : "var(--wa-meta)" }}>{parcial || "Ouvindo… pode falar"}</span>
              </div>
              <button type="button" onClick={alternarMicrofone} aria-label="Parar e enviar" className="grid h-12 w-12 shrink-0 place-items-center rounded-full text-white shadow" style={{ background: "var(--wa-verde)" }}><Square size={18} fill="currentColor" /></button>
            </div>
          ) : (
            <form onSubmit={submeter} className="flex items-end gap-1.5 pb-1">
              <textarea
                ref={campoRef}
                rows={1}
                value={texto}
                maxLength={500}
                onChange={(e) => setTexto(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submeter(); } }}
                placeholder={respondendo ? "Sua resposta" : "Mensagem"}
                aria-label={`Mensagem para o ${NOME_ASSISTENTE}`}
                className="min-h-[46px] min-w-0 flex-1 resize-none rounded-3xl border-0 bg-white px-4 py-[13px] text-[15px] leading-5 outline-none"
                style={{ color: "var(--wa-texto)" }}
              />
              {texto.trim() || !vozOk ? (
                <button type="submit" disabled={!texto.trim() || ocupado} aria-label="Enviar" className="grid h-12 w-12 shrink-0 place-items-center rounded-full text-white shadow transition active:scale-95 disabled:opacity-60" style={{ background: "var(--wa-verde)" }}>
                  <Send size={20} className="translate-x-px" />
                </button>
              ) : (
                <button type="button" onClick={alternarMicrofone} disabled={ocupado} aria-label="Gravar áudio" className="grid h-12 w-12 shrink-0 place-items-center rounded-full text-white shadow transition active:scale-95 disabled:opacity-60" style={{ background: "var(--wa-verde)" }}>
                  <Mic size={21} />
                </button>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  );
});

const TELA_PADRAO = Object.freeze({ rota: "/dashboard/inteligencia/assistente" });

export default AssistenteHefisto;
