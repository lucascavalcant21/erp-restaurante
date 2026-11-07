"use client";

// Equipe do salão (07/11/2026): o caixa decide, garçom por garçom, quem pode
// trocar e juntar mesas e quem pode cancelar item enviado. Desconto e receber
// pagamento ficam só com o caixa. Contas novas de garçom: Configurações →
// Usuários → Conta rápida → Garçom (dono).

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, UserRound } from "lucide-react";
import { useERP } from "../../../context/ERPContext";
import { definirPermissaoDoGarcom, fetchEquipeDoSalao } from "../../../lib/access-control";
import { hasPermission } from "../../../lib/permissions-catalog.mjs";
import { PERMISSOES_DO_GARCOM } from "../../../lib/salao-equipe.mjs";

function Interruptor({ ligado, onChange, disabled, rotulo }) {
  return (
    <button type="button" role="switch" aria-checked={ligado} aria-label={rotulo} disabled={disabled} onClick={() => onChange(!ligado)}
      className={`relative h-8 w-14 shrink-0 rounded-full transition-colors disabled:opacity-50 ${ligado ? "bg-emerald-600" : "bg-hf-border"}`}>
      <span className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all ${ligado ? "left-7" : "left-1"}`} />
    </button>
  );
}

export default function EquipeDoSalaoPage() {
  const { unidadeAtiva, sessao } = useERP();
  const [estado, setEstado] = useState({ carregando: true, garcons: [], erro: "" });
  const [salvando, setSalvando] = useState(null);
  const [aviso, setAviso] = useState("");
  const podeEditar = !sessao?.gerenciado || hasPermission(sessao, "salao.team.edit");

  const carregar = useCallback(async () => {
    if (!unidadeAtiva || unidadeAtiva === "todas") return;
    try {
      const r = await fetchEquipeDoSalao(unidadeAtiva);
      setEstado({ carregando: false, garcons: r.garcons || [], erro: "" });
    } catch (e) {
      setEstado({ carregando: false, garcons: [], erro: e.message });
    }
  }, [unidadeAtiva]);
  useEffect(() => { carregar(); }, [carregar]);

  async function mudar(g, acao, ligado) {
    setSalvando(`${g.id}:${acao}`); setAviso("");
    try {
      await definirPermissaoDoGarcom(unidadeAtiva, g.id, acao, ligado);
      setEstado((e) => ({ ...e, garcons: e.garcons.map((x) => (x.id === g.id ? { ...x, pode: { ...x.pode, [acao]: ligado } } : x)) }));
      setAviso(`${g.nome}: ${PERMISSOES_DO_GARCOM[acao].rotulo.toLowerCase()} ${ligado ? "liberado" : "bloqueado"}. Vale no próximo login ou ao atualizar a tela dele.`);
    } catch (e) {
      setAviso(`Não salvou: ${e.message}`);
    }
    setSalvando(null);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4 pb-16 sm:p-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/salao/caixa" aria-label="Voltar ao painel do caixa" className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-hf-border text-hf-text hover:bg-hf-elevated"><ArrowLeft size={18} /></Link>
        <div className="min-w-0">
          <h1 className="text-xl font-black text-hf-text">Equipe do salão</h1>
          <p className="text-sm text-hf-text-2">O que cada garçom pode fazer além de lançar pedidos.</p>
        </div>
      </div>

      <div className="rounded-2xl border border-hf-border bg-hf-elevated p-4 text-sm text-hf-text">
        <p className="font-bold">Todo garçom pode: abrir mesa, lançar pedidos, separar por pessoa, acompanhar o preparo e pedir a conta.</p>
        <p className="mt-1 text-hf-text-2">Desconto, taxa de serviço e receber pagamento ficam só com o caixa.</p>
      </div>

      {aviso && <p role="status" className="rounded-xl bg-hf-surface p-3 text-sm font-semibold text-hf-text">{aviso}</p>}

      {estado.carregando ? (
        <p className="flex items-center gap-2 text-sm text-hf-muted"><Loader2 size={16} className="animate-spin" /> Carregando a equipe…</p>
      ) : estado.erro ? (
        <p className="rounded-xl border border-hf-danger/30 bg-hf-danger/10 p-3 text-sm font-semibold text-hf-danger">{estado.erro}</p>
      ) : !estado.garcons.length ? (
        <div className="rounded-2xl border border-hf-border bg-hf-surface p-5 text-sm text-hf-text-2">
          <p className="font-bold text-hf-text">Nenhuma conta de garçom nesta unidade.</p>
          <p className="mt-1">Cada garçom precisa do próprio login. O dono cria em Configurações → Usuários → Conta rápida → Garçom; depois ele aparece aqui.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {estado.garcons.map((g) => (
            <li key={g.id} className="rounded-2xl border border-hf-border bg-hf-surface p-4">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-hf-elevated text-hf-text-2"><UserRound size={18} /></span>
                <div className="min-w-0">
                  <p className="truncate text-base font-black text-hf-text">{g.nome}</p>
                  <p className="truncate text-xs text-hf-text-2">{g.login}{g.status !== "ativo" ? " · inativo" : ""}</p>
                </div>
              </div>
              <div className="mt-3 divide-y divide-hf-border border-t border-hf-border">
                {Object.entries(PERMISSOES_DO_GARCOM).map(([acao, p]) => (
                  <div key={acao} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-hf-text">{p.rotulo}</p>
                      <p className="text-xs text-hf-text-2">{p.ajuda}</p>
                    </div>
                    {salvando === `${g.id}:${acao}` ? <Loader2 size={20} className="animate-spin text-hf-muted" /> : (
                      <Interruptor ligado={!!g.pode[acao]} disabled={!podeEditar || !!salvando} rotulo={`${p.rotulo}: ${g.nome}`} onChange={(v) => mudar(g, acao, v)} />
                    )}
                  </div>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
