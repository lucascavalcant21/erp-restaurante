"use client";
// Atendimento da mesa (QR da mesa): chamar o garçom, pedir a conta, água e
// talheres. O chamado vai para o Salão (Salão → Mesas → Chamados Mesas); o
// servidor confere a mesa e não abre dois chamados iguais da mesma mesa.

import { BellRing, Check, GlassWater, Loader2, Receipt, Utensils } from "lucide-react";
import s from "./cardapio.module.css";

export const TIPOS_ATENDIMENTO = [
  { id: "garcom", Icone: BellRing, chave: "chamar_garcom" },
  { id: "conta", Icone: Receipt, chave: "pedir_conta" },
  { id: "agua", Icone: GlassWater, chave: "pedir_agua" },
  { id: "talheres", Icone: Utensils, chave: "pedir_talheres" },
];

/**
 * @param {object} p
 * @param {Function} p.T textos no idioma do cliente
 * @param {object} p.chamados { [tipo]: { estado: "enviando" | "ok" } }
 * @param {Function} p.onChamar (tipo) => void
 * @param {string[]} p.tipos quais botões mostrar
 * @param {boolean} p.grade botões grandes em grade (folha) em vez de linha
 */
export function BotoesAtendimento({ T, chamados, onChamar, tipos = ["garcom", "conta"], grade = false }) {
  return (
    <div className={grade ? s.atendimentoGrade : s.atendimento} role="group" aria-label={T("atendimento")}>
      {TIPOS_ATENDIMENTO.filter((t) => tipos.includes(t.id)).map(({ id, Icone, chave }) => {
        const estado = chamados[id]?.estado;
        return (
          <button
            key={id}
            type="button"
            className={`${s.botaoAtendimento} ${estado === "ok" ? s.atendimentoFeito : ""}`}
            disabled={estado === "enviando" || estado === "ok"}
            aria-busy={estado === "enviando"}
            onClick={() => onChamar(id)}
          >
            {estado === "enviando" ? <Loader2 size={18} aria-hidden="true" className={s.girando} />
              : estado === "ok" ? <Check size={18} aria-hidden="true" /> : <Icone size={18} aria-hidden="true" />}
            <span>{T(chave)}</span>
            {estado === "ok" ? <span className={s.atendimentoMarca}>{T("chamado_avisado")}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
