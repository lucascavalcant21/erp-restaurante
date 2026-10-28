"use client";

// "Pergunte ao Héfisto": conversa (texto ou voz) com o Command Bus do servidor.
// Usada na Central de Inteligência e no painel lateral / bottom sheet.
// A voz só troca a ENTRADA (fala → texto) e, se ligado, lê a resposta: o
// pedido segue o mesmo caminho do teclado.
//
// Estrutura: este arquivo orquestra estado e rede; a UI mora em ./conversa/*
// (MensagemRespostaHefisto, ConfirmacaoAcaoCard, BarraEntradaConversa). A barra
// de entrada guarda o texto digitado sozinha, então digitar não re-renderiza
// o histórico inteiro.

import { forwardRef, memo, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Mic, Loader2, Sparkles } from "lucide-react";
import { perguntarAoHefisto, confirmarAcao, cancelarAcao, novaChaveDeEnvio } from "../../lib/intelligence/client/api";
import { provedorDeVoz } from "../../lib/intelligence/voice/voice-provider";
import MensagemRespostaHefisto from "./conversa/MensagemRespostaHefisto";
import BarraEntradaConversa from "./conversa/BarraEntradaConversa";

export const SUGESTOES_PADRAO = [
  "Como foi minha empresa hoje?",
  "Quanto vendi esta semana?",
  "Quanto comprei esta semana?",
  "Qual produto teve maior aumento de preço?",
  "Quais produtos estão próximos do vencimento?",
  "Tem alguma diferença estranha no estoque?",
  "Quais contas vencem nos próximos dias?",
  "Como está meu CMV?",
  "Como está meu CMO?",
];

let seq = 0;
const novoId = () => `m${++seq}`;
const MAX_MENSAGENS = 80; // limite de memória da conversa em sessões longas

const MensagemUsuario = memo(function MensagemUsuario({ texto, canal }) {
  return (
    <div className="hf-animate-in flex justify-end">
      <p className="max-w-[85%] rounded-2xl rounded-br-md bg-hf-text px-3.5 py-2 text-[14px] text-hf-surface shadow-xs">
        {canal === "voz" && <Mic size={13} className="mr-1 inline" />}
        {texto}
      </p>
    </div>
  );
});

const ConversaHefisto = forwardRef(function ConversaHefisto({ unidadeId, tela = null, sugestoes = SUGESTOES_PADRAO, autoFoco = false, altura = "auto", onNavegar }, ref) {
  const router = useRouter();
  const [mensagens, setMensagens] = useState([]);
  const [ocupado, setOcupado] = useState(false);
  const [ouvindo, setOuvindo] = useState(false);
  const [parcialVoz, setParcialVoz] = useState("");
  const [lerEmVoz, setLerEmVoz] = useState(false);
  const [vozOk, setVozOk] = useState(false);
  const escutaRef = useRef(null);
  // O que a última resposta citou (produto, alertas): volta no próximo pedido
  // para "Por quê?" e "Perdi 2 kg." — o servidor reconfere tudo.
  const referenciaRef = useRef(null);
  const ocupadoRef = useRef(false);
  const fimRef = useRef(null);
  const voz = useMemo(() => provedorDeVoz(), []);

  useEffect(() => { setVozOk(voz.disponivel()); }, [voz]);
  useEffect(() => { referenciaRef.current = null; }, [unidadeId]);
  useEffect(() => { fimRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [mensagens, ocupado]);
  useEffect(() => () => { escutaRef.current?.parar(); voz.calar(); }, [voz]);

  const adicionar = useCallback((m) => {
    setMensagens((xs) => [...xs, { id: novoId(), ...m }].slice(-MAX_MENSAGENS));
  }, []);

  const tratar = useCallback((dados, { canal } = {}) => {
    adicionar({ de: "hefisto", resposta: dados });
    if (dados?.referencia) referenciaRef.current = dados.referencia;
    if (canal === "voz" && lerEmVoz && dados?.texto) voz.falar(dados.texto);
    if (dados?.tipo === "navegacao" && dados.rota) {
      setTimeout(() => { onNavegar?.(); router.push(dados.rota); }, 350);
    }
  }, [adicionar, lerEmVoz, voz, router, onNavegar]);

  // Executa uma chamada de rede com estado de carregamento e erro amigável.
  // ocupadoRef evita envio duplo (duplo clique ou Enter repetido) sem depender de re-render.
  const executar = useCallback(async (chamada, mensagemFalha, { canal, comandoOriginal } = {}) => {
    ocupadoRef.current = true;
    setOcupado(true);
    try {
      const r = await chamada();
      if (r?.ok) tratar(r.dados, { canal });
      else tratar({ tipo: "erro_acao", texto: r?.dados?.erro || mensagemFalha, comandoOriginal }, { canal });
    } catch {
      tratar({ tipo: "erro_acao", texto: "Falha de conexão. Verifique a internet e tente novamente.", comandoOriginal }, { canal });
    } finally {
      ocupadoRef.current = false;
      setOcupado(false);
    }
  }, [tratar]);

  const enviar = useCallback(async (texto, { canal = "texto" } = {}) => {
    const t = String(texto || "").trim();
    if (!t || ocupadoRef.current) return;
    setParcialVoz("");
    adicionar({ de: "usuario", texto: t, canal });
    await executar(
      () => perguntarAoHefisto(unidadeId, { texto: t, chave: novaChaveDeEnvio(), canal, tela, conversa: referenciaRef.current }),
      "Não consegui responder agora.",
      { canal, comandoOriginal: t },
    );
  }, [adicionar, executar, unidadeId, tela]);

  useImperativeHandle(ref, () => ({ enviar }), [enviar]);

  const continuar = useCallback(async (pergunta, valor) => {
    if (ocupadoRef.current) return;
    const rotulo = pergunta.opcoes?.find((o) => o.id === valor)?.rotulo || String(valor);
    adicionar({ de: "usuario", texto: rotulo });
    const bruto = String(valor).trim();
    const numero = pergunta.campo === "quantidade" ? Number(bruto.includes(",") ? bruto.replace(/\./g, "").replace(",", ".") : bruto) : null;
    const continuarCampo = { acaoId: pergunta.acaoId, campo: pergunta.campo, valor: numero == null ? bruto : null, valorNumero: Number.isFinite(numero) ? numero : null };
    await executar(() => perguntarAoHefisto(unidadeId, { continuar: continuarCampo, tela }), "Não consegui continuar.");
  }, [adicionar, executar, unidadeId, tela]);

  const confirmar = useCallback((acaoId, confirmacaoTexto) => {
    if (ocupadoRef.current) return;
    return executar(() => confirmarAcao(unidadeId, acaoId, confirmacaoTexto), "Não consegui confirmar.");
  }, [executar, unidadeId]);

  const cancelar = useCallback((acaoId) => {
    if (ocupadoRef.current) return;
    return executar(() => cancelarAcao(unidadeId, acaoId), "Não consegui cancelar.");
  }, [executar, unidadeId]);

  const alternarMicrofone = useCallback(() => {
    if (ouvindo) { escutaRef.current?.parar(); setOuvindo(false); return; }
    voz.calar();
    setOuvindo(true);
    escutaRef.current = voz.ouvir({
      onParcial: (t) => setParcialVoz(t),
      onFinal: (t) => { setOuvindo(false); enviar(t, { canal: "voz" }); },
      onErro: (msg) => { setOuvindo(false); adicionar({ de: "hefisto", resposta: { tipo: "erro_acao", texto: msg } }); },
      onFim: () => setOuvindo(false),
    });
  }, [ouvindo, voz, enviar, adicionar]);

  const alternarLeituraVoz = useCallback(() => { setLerEmVoz((v) => !v); voz.calar(); }, [voz]);
  const aoComando = useCallback((c) => enviar(c), [enviar]);

  return (
    <div className="flex min-h-0 flex-col" style={altura === "auto" ? undefined : { height: altura }}>
      <div className={`min-h-0 flex-1 space-y-3 ${altura === "auto" ? "" : "overflow-y-auto overscroll-contain"} pb-2`} aria-live="polite">
        {mensagens.length === 0 && (
          <div className="space-y-3">
            <p className="flex items-center gap-2 text-[13px] font-medium text-hf-text-2">
              <Sparkles size={15} className="text-hf-accent" /> Respostas só com dados da sua unidade, com a fonte de cada número.
            </p>
            <div className="flex flex-wrap gap-2">
              {sugestoes.map((s) => (
                <button key={s} type="button" onClick={() => enviar(s)}
                  className="min-h-[40px] rounded-full border border-hf-border bg-hf-surface px-3.5 text-left text-[13px] font-semibold text-hf-text shadow-xs transition hover:-translate-y-px hover:border-hf-accent hover:text-hf-accent">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {mensagens.map((m) => m.de === "usuario" ? (
          <MensagemUsuario key={m.id} texto={m.texto} canal={m.canal} />
        ) : (
          <MensagemRespostaHefisto key={m.id} r={m.resposta} ocupado={ocupado} onComando={aoComando} onContinuar={continuar} onConfirmar={confirmar} onCancelar={cancelar} />
        ))}
        {ocupado && (
          <p className="flex items-center gap-2 text-[13px] font-medium text-hf-text-2" role="status">
            <Loader2 size={15} className="animate-spin text-hf-accent" /> Consultando os dados…
          </p>
        )}
        <div ref={fimRef} />
      </div>

      <BarraEntradaConversa
        ocupado={ocupado}
        autoFoco={autoFoco}
        vozOk={vozOk}
        sinteseOk={vozOk && voz.sinteseDisponivel()}
        ouvindo={ouvindo}
        lerEmVoz={lerEmVoz}
        textoVozParcial={parcialVoz}
        onEnviar={enviar}
        onAlternarMicrofone={alternarMicrofone}
        onAlternarLeituraVoz={alternarLeituraVoz}
      />
    </div>
  );
});

export default ConversaHefisto;
