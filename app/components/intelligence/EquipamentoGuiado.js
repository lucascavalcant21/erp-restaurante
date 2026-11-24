"use client";

// "Fritadeira" / "coifa" no Nico e no Jhon (dono, 24/11/2026): escolhe o
// equipamento, depois abastecimento, filtragem ou limpeza; mostra quanto falta,
// os materiais com a quantidade exata, o passo a passo e os cuidados, com
// "Fiz agora" e "Reagendar". Quem cadastra tudo é o dono, na tela Fritadeira e coifa.

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Flame } from "lucide-react";
import { useERP } from "../../context/ERPContext";
import { usePermission } from "../access-control/PermissionGate";
import { useEquipamentos } from "../../lib/equipamentos-dados";
import { TAREFAS, avisosEquipamentos, semAcento } from "../../lib/equipamentos.mjs";
import { AcoesTarefa, AvisosEquipamentos, ComoFazer, Situacao } from "../equipamentos/Partes";

export default function EquipamentoGuiado({ filtro = "" }) {
  const { unidadeAtiva } = useERP();
  const api = useEquipamentos(unidadeAtiva);
  const podeRecord = usePermission("cozinha.equipment.record");
  const podeEdit = usePermission("cozinha.equipment.edit");
  const podeRegistrar = podeRecord || podeEdit;
  const [eqId, setEqId] = useState(null);
  const [tarefaId, setTarefaId] = useState(null);

  const lista = useMemo(() => {
    const f = semAcento(filtro);
    const achados = f ? api.equipamentos.filter((e) => semAcento(`${e.nome} ${e.tipo}`).includes(f)) : [];
    return achados.length ? achados : api.equipamentos;
  }, [api.equipamentos, filtro]);
  const eq = api.equipamentos.find((e) => e.id === eqId) || (lista.length === 1 ? lista[0] : null);
  const tarefa = eq?.tarefas.find((t) => t.id === tarefaId) || (eq?.tarefas.length === 1 ? eq.tarefas[0] : null);
  const avisos = useMemo(() => avisosEquipamentos(lista, { insumos: api.insumos, saldos: api.saldos }), [lista, api.insumos, api.saldos]);

  const pilula = "min-h-[52px] w-full rounded-2xl border border-hf-border bg-hf-surface px-4 text-left text-[16px] font-semibold text-hf-text";
  const voltar = (fn) => <button type="button" onClick={fn} className="flex h-10 items-center gap-1 text-[14px] font-medium text-hf-muted"><ArrowLeft size={16} /> Voltar</button>;

  return (
    <div className="w-full space-y-3 rounded-2xl border border-hf-border bg-hf-surface p-3.5">
      <p className="flex items-center gap-2 text-[13px] font-semibold text-hf-muted"><Flame size={15} /> Fritadeira e coifa</p>
      {api.carregando ? <p className="text-[14px] text-hf-muted">Carregando…</p> : api.erro ? <p className="text-[14px] text-hf-danger">Não consegui carregar: {api.erro}</p> : !api.equipamentos.length ? (
        <p className="text-[15px] text-hf-text">Ainda não tem equipamento cadastrado. <Link href="/dashboard/operacao/equipamentos" className="font-semibold underline">Cadastrar</Link></p>
      ) : !eq ? (
        <>
          <AvisosEquipamentos avisos={avisos} compacto />
          <p className="text-[16px] font-semibold text-hf-text">Qual equipamento?</p>
          <div className="space-y-2">{lista.map((e) => <button key={e.id} type="button" onClick={() => setEqId(e.id)} className={pilula}>{e.nome}</button>)}</div>
        </>
      ) : !tarefa ? (
        <>
          {lista.length > 1 && voltar(() => setEqId(null))}
          <p className="text-[16px] font-semibold text-hf-text">{eq.nome}: o que você vai fazer?</p>
          <div className="space-y-2">
            {eq.tarefas.map((t) => (
              <button key={t.id} type="button" onClick={() => setTarefaId(t.id)} className={`${pilula} flex items-center justify-between gap-2`}>
                <span>{TAREFAS[t.tarefa]?.rotulo}</span><Situacao tarefa={t} />
              </button>
            ))}
          </div>
          {!eq.tarefas.length && <p className="text-[14px] text-hf-muted">Sem tarefa na agenda deste equipamento.</p>}
        </>
      ) : (
        <>
          {(eq.tarefas.length > 1 || lista.length > 1) && voltar(() => (eq.tarefas.length > 1 ? setTarefaId(null) : setEqId(null)))}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[17px] font-semibold text-hf-text">{eq.nome} · {TAREFAS[tarefa.tarefa]?.rotulo}</p>
            <Situacao tarefa={tarefa} />
          </div>
          <ComoFazer tarefa={tarefa} />
          {podeRegistrar && <AcoesTarefa tarefa={tarefa} onFiz={api.fizAgora} onReagendar={api.reagendar} />}
        </>
      )}
    </div>
  );
}

/** "fritadeira", "coifa", "óleo da fritadeira", "filtrar o óleo"… → filtro (ou null se não é isso). */
export function pedidoDeEquipamento(texto) {
  const t = semAcento(texto).replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
  if (!t || t.length > 80) return null;
  if (/\bcoifa/.test(t)) return { filtro: "coifa" };
  if (/\bfritadeira|\boleo da fritadeira|\bfiltr(ar|agem) (o )?oleo|\btrocar (o )?oleo/.test(t)) return { filtro: "fritadeira" };
  return null;
}
