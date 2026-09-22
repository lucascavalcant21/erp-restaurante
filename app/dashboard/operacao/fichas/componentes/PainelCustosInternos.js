"use client";

// CUSTOS — USO INTERNO. Não é parte da ficha: é o que o ERP calcula a partir
// dela (CMV, margem, custo por kg, histórico). Fica numa aba separada e só
// aparece para quem tem permissão de ver custos.
//
// A ficha de prato não mostra custo nenhum, mas o custo do prato continua
// sendo calculado aqui, pelos ingredientes e pelos pré-preparos que ele usa.

import { useMemo } from "react";
import { Plus } from "lucide-react";
import { fmtBRL } from "../../../../components/ui";
import { custoDeProduzirFicha, fichasQueUsam, precoSugerido } from "../../../../lib/ficha-calculos.mjs";
import { tipoFichaDe, custosDoPrePreparo, brlUnitario } from "../../../../lib/ficha-modelo.mjs";

function Numero({ rotulo, valor, tom = "neutro", nota }) {
  const cor = tom === "ruim" ? "text-[color:var(--danger-strong)]" : tom === "bom" ? "text-[color:var(--tipo)]" : "text-fg";
  return (
    <div className="rounded-xl border border-line bg-card px-3 py-2.5">
      <p className="text-3xs font-bold uppercase tracking-wider text-muted">{rotulo}</p>
      <p className={`mt-0.5 text-lg font-black tabular-nums ${cor}`}>{valor}</p>
      {nota ? <p className="text-3xs font-semibold text-muted">{nota}</p> : null}
    </div>
  );
}

export default function PainelCustosInternos({
  ficha, fichas = [], custoPorcao = 0, preco = 0, historico = [], statusHistorico = "idle",
  registrando = false, onRegistrar, onAbrirFicha,
}) {
  const prePreparo = tipoFichaDe(ficha) === "pre_preparo";
  const custoTotal = custoDeProduzirFicha(ficha, fichas);
  const composicao = useMemo(() => (ficha.fichas_ingredientes || []).map((fi, i) => {
    const base = fi.subficha_id ? fichas.find(x => x.id === fi.subficha_id) : null;
    return {
      nome: fi.insumos?.nome || base?.nome_receita || "Item",
      custo: custoDeProduzirFicha({ id: `${ficha.id}::linha-${i}`, fichas_ingredientes: [fi] }, fichas),
      prePreparo: !!base,
    };
  }).sort((a, b) => b.custo - a.custo), [ficha, fichas]);

  const meta = Number(ficha.cmv_meta) || 30;
  const cmv = preco > 0 ? (custoPorcao / preco) * 100 : null;
  const custosPreparo = prePreparo ? custosDoPrePreparo(ficha, fichas) : null;
  const usadoPor = prePreparo ? fichasQueUsam(ficha.id, fichas) : [];

  return (
    <div className="space-y-4">
      <p className="rounded-xl border border-line bg-elevated px-3 py-2 text-xs font-semibold text-muted">
        Números calculados pelo sistema para gestão. {prePreparo ? "O custo por kg é o que entra nos pratos que usam este pré-preparo." : "Não aparecem na ficha de prato impressa."}
      </p>

      {prePreparo ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Numero rotulo="Custo do lote" valor={fmtBRL(custoTotal)} />
          <Numero rotulo={`Custo por ${custosPreparo.unidade}`} valor={custosPreparo.porUnidade != null ? brlUnitario(custosPreparo.porUnidade) : "—"} />
          <Numero rotulo="Usado em" valor={usadoPor.length ? `${usadoPor.length} receita${usadoPor.length > 1 ? "s" : ""}` : "—"} nota={usadoPor.length ? "mudar o custo mexe nelas" : "nenhuma receita usa ainda"} />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Numero rotulo="Custo por porção" valor={fmtBRL(custoPorcao)} />
          <Numero rotulo="Preço (Cardápio)" valor={preco > 0 ? fmtBRL(preco) : "—"} nota={preco > 0 ? null : "defina no Cardápio"} />
          <Numero rotulo="CMV" valor={cmv != null ? `${cmv.toFixed(1)}%` : "—"} tom={cmv == null ? "neutro" : cmv > meta ? "ruim" : "bom"} nota={`meta ${meta}%`} />
          <Numero rotulo="Margem" valor={cmv != null ? `${(100 - cmv).toFixed(1)}%` : "—"} nota={preco > 0 ? `${fmtBRL(preco - custoPorcao)} por porção` : null} />
          <Numero rotulo="Custo total da receita" valor={fmtBRL(custoTotal)} />
          <Numero rotulo={`Preço sugerido (CMV ${meta}%)`} valor={custoPorcao > 0 ? fmtBRL(precoSugerido(custoPorcao, meta)) : "—"} />
        </div>
      )}

      {usadoPor.length ? (
        <section className="rounded-2xl border border-line bg-card p-4">
          <h4 className="mb-2 text-xs font-black uppercase tracking-wider text-[color:var(--tipo)]">Receitas que usam este pré-preparo</h4>
          <ul className="flex flex-wrap gap-2">
            {usadoPor.map(f => (
              <li key={f.id}>
                <button type="button" onClick={() => onAbrirFicha?.(f)} className="rounded-lg border border-line px-2.5 py-1 text-sm font-semibold text-fg-soft hover:text-fg">{f.nome_receita}</button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="rounded-2xl border border-line bg-card p-4">
        <h4 className="text-xs font-black uppercase tracking-wider text-[color:var(--tipo)]">Composição do custo</h4>
        <p className="mb-3 text-xs font-medium text-muted">Participação de cada item no custo total ({fmtBRL(custoTotal)}).</p>
        {composicao.length ? (
          <div className="space-y-2.5">
            {composicao.map((l, i) => {
              const pct = custoTotal > 0 ? (l.custo / custoTotal) * 100 : 0;
              return (
                <div key={i}>
                  <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                    <span className="truncate font-bold text-fg-soft">{l.nome}{l.prePreparo ? <span className="ml-1.5 text-3xs font-bold uppercase tracking-wider text-muted">pré-preparo</span> : null}</span>
                    <span className="shrink-0 font-black text-fg">{fmtBRL(l.custo)} <span className="font-bold text-muted">· {pct.toFixed(1)}%</span></span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-elevated"><div className="h-full rounded-full bg-[color:var(--tipo)]" style={{ width: `${Math.min(100, pct)}%` }} /></div>
                </div>
              );
            })}
          </div>
        ) : <p className="text-sm font-medium text-muted">Sem ingredientes para compor o custo.</p>}
      </section>

      <section className="rounded-2xl border border-line bg-card p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h4 className="text-xs font-black uppercase tracking-wider text-[color:var(--tipo)]">Histórico de custos</h4>
          {onRegistrar ? (
            <button type="button" onClick={onRegistrar} disabled={registrando || statusHistorico === "sem_tabela"}
              className="flex items-center gap-1.5 rounded-xl border border-line px-3 py-1.5 text-xs font-bold text-fg-soft hover:text-fg disabled:opacity-50">
              <Plus size={14} /> {registrando ? "Registrando..." : "Registrar custo atual"}
            </button>
          ) : null}
        </div>
        {statusHistorico === "sem_tabela" ? (
          <p className="rounded-xl border border-[color:var(--warning)] bg-[color:var(--warning-soft)] p-3 text-xs font-semibold text-[color:var(--warning-strong)]">
            Para guardar a variação de custo, rode a migração db/migracao_ficha_custo_historico.sql no Supabase.
          </p>
        ) : statusHistorico === "carregando" ? (
          <p className="text-sm font-medium text-muted">Carregando histórico...</p>
        ) : historico.length === 0 ? (
          <p className="text-sm font-medium text-muted">Nenhum custo registrado ainda. Ele é gravado quando a ficha é salva, ou pelo botão acima.</p>
        ) : (
          <ul className="space-y-2">
            {historico.slice(0, 20).map((h, i) => {
              const dif = h.diferenca == null ? null : Number(h.diferenca);
              const pct = h.diferenca_pct == null ? null : Number(h.diferenca_pct);
              const origem = h.origem === "edicao_ficha" ? "edição" : h.origem === "variacao_preco" ? "variação de preço" : "manual";
              return (
                <li key={h.id || i} className="flex items-center justify-between gap-3 rounded-xl border border-line-soft bg-elevated px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-black text-fg">{fmtBRL(Number(h.custo_total) || 0)}<span className="ml-1.5 text-2xs font-bold text-muted">total{h.custo_porcao != null ? ` · ${fmtBRL(Number(h.custo_porcao))}/porção` : ""}</span></p>
                    <p className="text-3xs font-bold text-muted">{new Date(h.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })} · {origem}{h.usuario_nome ? ` · ${h.usuario_nome}` : ""}</p>
                  </div>
                  <span className={`shrink-0 text-xs font-bold ${dif == null ? "text-muted" : dif > 0.005 ? "text-[color:var(--danger-strong)]" : dif < -0.005 ? "text-[color:var(--tipo)]" : "text-muted"}`}>
                    {dif == null ? "1º registro" : `${dif > 0.005 ? "subiu" : dif < -0.005 ? "caiu" : "igual"} ${fmtBRL(Math.abs(dif))}${pct != null ? ` (${pct > 0 ? "+" : ""}${pct.toFixed(1)}%)` : ""}`}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
