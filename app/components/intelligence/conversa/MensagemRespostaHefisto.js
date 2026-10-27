"use client";

import { memo } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, AlertTriangle, ShieldAlert, RefreshCw } from "lucide-react";
import { MetricaCartao, ListaBloco, TextoBloco } from "../Blocos";
import InsightCartao from "../InsightCartao";
import ConfirmacaoAcaoCard, { BotaoConversa, RespostaLivreForm } from "./ConfirmacaoAcaoCard";

const MensagemRespostaHefisto = memo(function MensagemRespostaHefisto({
  r,
  ocupado,
  onComando,
  onContinuar,
  onConfirmar,
  onCancelar,
}) {
  const router = useRouter();
  const ehErroOuBloqueio = r.tipo === "bloqueado" || r.tipo === "erro_acao";
  const tomCaixa = ehErroOuBloqueio
    ? "border-amber-300/80 bg-amber-50/90"
    : "border-hf-border bg-hf-surface shadow-xs";

  return (
    <div className="hf-animate-in space-y-2.5">
      {r.tipo === "resultado_acao" ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/90 p-4 shadow-xs">
          <p className="flex items-center gap-2 text-[15px] font-black text-emerald-900">
            <CheckCircle2 size={18} className="shrink-0 text-hf-accent" /> {r.texto}
          </p>
          <dl className="mt-2.5 space-y-1">
            {r.resultado?.linhas?.map((l, i) => (
              <div key={i} className="flex justify-between gap-3 text-[13px]">
                <dt className="text-emerald-800">{l.rotulo}</dt>
                <dd className="font-bold tabular-nums text-emerald-950">{l.valor}</dd>
              </div>
            ))}
          </dl>
          {r.repetido && (
            <p className="mt-2 text-[12px] font-medium text-emerald-800">
              Este registro já tinha sido feito — nada foi duplicado.
            </p>
          )}
        </div>
      ) : (
        <div className={`rounded-2xl border p-3.5 ${tomCaixa}`}>
          <p className="flex gap-2 whitespace-pre-line text-[14px] leading-relaxed text-hf-text">
            {r.tipo === "bloqueado" && <ShieldAlert size={17} className="mt-0.5 shrink-0 text-hf-warning" />}
            {r.tipo === "erro_acao" && <AlertTriangle size={17} className="mt-0.5 shrink-0 text-hf-warning" />}
            <span>{r.texto}</span>
          </p>
          {r.tipo === "erro_acao" && r.comandoOriginal && (
            <button
              type="button"
              disabled={ocupado}
              onClick={() => onComando(r.comandoOriginal)}
              className="mt-2.5 inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-amber-400/70 bg-hf-surface px-3 py-1.5 text-[12px] font-bold text-hf-text transition hover:border-hf-accent hover:text-hf-accent disabled:opacity-50"
            >
              <RefreshCw size={13} /> Tentar novamente
            </button>
          )}
        </div>
      )}

      {(r.blocos || []).map((b, i) => {
        if (b.tipo === "metrica") return <MetricaCartao key={i} rotulo={b.rotulo} m={b.metrica} compacto />;
        if (b.tipo === "lista") return <ListaBloco key={i} titulo={b.titulo} itens={b.itens} />;
        if (b.tipo === "texto") return <TextoBloco key={i} texto={b.texto} qualificador={b.qualificador} />;
        if (b.tipo === "insight") return <InsightCartao key={i} insight={b.insight} onComando={onComando} compacto />;
        return null;
      })}

      {r.pergunta && (
        <div className="rounded-2xl border border-hf-border bg-hf-elevated/60 p-3.5">
          {r.pergunta.texto !== r.texto && (
            <p className="text-[14px] font-bold text-hf-text">{r.pergunta.texto}</p>
          )}
          {r.pergunta.opcoes?.length ? (
            <div className="mt-2.5 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
              {r.pergunta.opcoes.map((o) => (
                <BotaoConversa
                  key={o.id}
                  disabled={ocupado}
                  onClick={() => (o.comando ? onComando(o.comando) : onContinuar(r.pergunta, o.id))}
                >
                  {o.rotulo}
                </BotaoConversa>
              ))}
            </div>
          ) : r.pergunta.acaoId ? (
            <RespostaLivreForm pergunta={r.pergunta} desabilitado={ocupado} onEnviar={(v) => onContinuar(r.pergunta, v)} />
          ) : r.pergunta.comandoBase ? (
            <RespostaLivreForm
              pergunta={r.pergunta}
              desabilitado={ocupado}
              onEnviar={(v) => onComando(r.pergunta.comandoBase.replace("{valor}", v))}
            />
          ) : null}
        </div>
      )}

      {r.confirmacao && (
        <ConfirmacaoAcaoCard
          c={r.confirmacao}
          ocupado={ocupado}
          onConfirmar={(t) => onConfirmar(r.confirmacao.acaoId, t)}
          onCancelar={() => onCancelar(r.confirmacao.acaoId)}
        />
      )}

      {r.sugestoes?.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {r.sugestoes.map((s) => (
            <BotaoConversa key={s} onClick={() => onComando(s)} disabled={ocupado}>
              {s}
            </BotaoConversa>
          ))}
        </div>
      )}

      {r.acoes?.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {r.acoes.map((a, i) => (
            <BotaoConversa
              key={i}
              onClick={() => (a.rota ? router.push(a.rota) : onComando(a.comando))}
              disabled={ocupado}
            >
              {a.rotulo}
            </BotaoConversa>
          ))}
        </div>
      )}

      {(r.agentes?.length > 0 || r.fontesConsultadas?.length > 0) && (
        <p className="px-1 text-[11px] font-medium text-hf-muted">
          {r.agentes?.length > 0 && <>Consultado: {r.agentes.join(", ")}. </>}
          {r.fontesConsultadas?.length > 0 && <>Fontes: {r.fontesConsultadas.join(" · ")}. </>}
          {r.interpretacao?.origem === "ia" && <>Pedido interpretado por IA. </>}
          {r.auditado === false && <>Auditoria não persistida neste servidor.</>}
        </p>
      )}
    </div>
  );
});

export default MensagemRespostaHefisto;
