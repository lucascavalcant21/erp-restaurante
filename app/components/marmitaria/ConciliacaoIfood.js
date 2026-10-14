"use client";

// Conciliação do iFood no mês: o que os pedidos dizem que a loja deve receber
// (ESTIMATIVA pelas taxas configuradas) × o que o iFood informou como repasse
// (REAL, quando o financeiro do iFood estiver ligado). Sem repasse real, não
// há diferença a mostrar — só "aguardando".

import { useEffect, useState } from "react";
import { useMarmitaria } from "./contexto";
import { Secao, Selo, brl } from "./ui";
import { fetchRepasses } from "../../lib/ifood/dados";
import { conciliarRepasses } from "../../lib/ifood/nucleo.mjs";

const fimDoMes = (mes) => { const [a, m] = mes.split("-").map(Number); return new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10); };

export default function ConciliacaoIfood({ mes, vendas = [] }) {
  const { unidadeId } = useMarmitaria();
  const [repasses, setRepasses] = useState(null);
  useEffect(() => {
    if (!unidadeId) return;
    let vivo = true;
    fetchRepasses(unidadeId, `${mes}-01`, fimDoMes(mes)).then((r) => { if (vivo) setRepasses(r.migracaoPendente ? [] : r.data || []); });
    return () => { vivo = false; };
  }, [unidadeId, mes]);

  const c = conciliarRepasses({ vendas, repasses: repasses || [] });
  if (c.situacao === "sem_pedidos") return null;
  return (
    <Secao titulo="Conciliação do iFood" subtitulo={`${c.pedidos} pedido(s) do iFood no mês.`}>
      <div className="grid gap-3 text-sm sm:grid-cols-3">
        <div><p className="text-xs text-hf-muted">Receita dos pedidos</p><p className="text-lg font-bold tabular-nums">{brl(c.receita)}</p><Selo natureza="real" /></div>
        <div><p className="text-xs text-hf-muted">Repasse esperado</p><p className="text-lg font-bold tabular-nums">{brl(c.repasseEsperado)}</p><Selo natureza={c.naturezaEsperado} /></div>
        <div>
          <p className="text-xs text-hf-muted">Repasse informado pelo iFood</p>
          {c.repasseRecebido === null
            ? <p className="mt-1 text-sm font-semibold text-hf-muted">Aguardando o financeiro do iFood</p>
            : <><p className="text-lg font-bold tabular-nums">{brl(c.repasseRecebido)}</p><Selo natureza="real" /></>}
        </div>
      </div>
      {c.diferenca !== null && (
        <p className={`mt-3 text-sm font-semibold ${Math.abs(c.diferenca) < 0.01 ? "text-hf-accent" : "text-hf-warning"}`}>
          Diferença (informado − esperado): {brl(c.diferenca)}{Math.abs(c.diferenca) >= 0.01 ? " — confira taxas, cancelamentos e ajustes no extrato do iFood." : ""}
        </p>
      )}
      <p className="mt-3 text-xs text-hf-muted">O esperado usa as taxas do canal iFood em Configurações. O valor real só aparece quando o iFood informar o repasse.</p>
    </Secao>
  );
}
