"use client";

// Aba "Contratos e vínculos" do prontuário (HDEV-RH-001, Fase 3).
// Vínculo atual e fase (lib/vinculos.mjs), solicitações pendentes com
// aprovar/recusar, linha do tempo. Regras e permissão: banco (RH-4).

import { useState, useEffect, useCallback } from "react";
import { Card, SectionLabel, Modal, Field, TextInput, NumberInput, Select, Btn, fmtBRL } from "../../../../components/ui";
import { fetchVinculos, fetchTransicoes, solicitarTransicao, decidirTransicao } from "../../../../lib/vinculos-dados";
import { faseDoVinculo, prorrogacaoExigeDocumento, CATEGORIAS, REGRAS_REMUNERACAO, TIPOS_TRANSICAO } from "../../../../lib/vinculos.mjs";

const br = (s) => (s ? String(s).slice(0, 10).split("-").reverse().join("/") : "—");
const hojeIso = () => new Date().toISOString().slice(0, 10);

function resumoDados(t) {
  const d = t.dados || {};
  if (t.tipo === "prorrogacao") return `+${d.dias} dias${d.registro_retroativo ? " · registro de prorrogação já combinada" : ""}`;
  if (t.tipo === "mudanca_categoria") return `${CATEGORIAS[d.categoria] || d.categoria}${d.experiencia_dias ? ` · ${d.experiencia_dias} dias` : ""}`;
  if (t.tipo === "alteracao_salarial") return `Novo salário ${fmtBRL(d.salario)}`;
  return "";
}

export default function VinculosAba({ colaborador, podeSolicitar, podeAprovar, podeVerValores, onMudou, onAviso }) {
  const [vinculos, setVinculos] = useState(null);
  const [transicoes, setTransicoes] = useState([]);
  const [form, setForm] = useState(null); // { tipo, vigencia, dias, categoria, experiencia_dias, salario, motivo, documento }
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  const carregar = useCallback(async () => {
    const [v, t] = await Promise.all([fetchVinculos(colaborador.id), fetchTransicoes(colaborador.id)]);
    setVinculos(v.data); setTransicoes(t.data);
  }, [colaborador.id]);
  useEffect(() => { carregar(); }, [carregar]);

  const atual = (vinculos || []).find((v) => !v.fim) || null;
  const fase = faseDoVinculo(atual, hojeIso());
  const pendentes = transicoes.filter((t) => t.status === "solicitada");
  const decididas = transicoes.filter((t) => t.status !== "solicitada");

  const abrir = (tipo) => { setErro(""); setForm({ tipo, vigencia: hojeIso(), dias: atual?.experiencia_dias ? String(Math.max(atual.experiencia_dias, 90 - atual.experiencia_dias)) : "", categoria: "", experiencia_dias: "30", salario: "", motivo: "", documento: "" }); };
  const set = (k, v) => { setForm((f) => ({ ...f, [k]: v })); setErro(""); };

  async function enviar() {
    if (!form.motivo || form.motivo.trim().length < 3) return setErro("Escreva o motivo.");
    const dados = form.tipo === "prorrogacao" ? { dias: Number(form.dias) }
      : form.tipo === "mudanca_categoria" ? { categoria: form.categoria, ...(form.categoria === "clt_experiencia" ? { experiencia_dias: Number(form.experiencia_dias) } : {}) }
      : form.tipo === "alteracao_salarial" ? { salario: Number(form.salario) } : {};
    setEnviando(true);
    const r = await solicitarTransicao({ colaboradorId: colaborador.id, tipo: form.tipo, vigencia: form.vigencia, dados, motivo: form.motivo.trim(), documento: form.documento.trim() || null });
    setEnviando(false);
    if (r.error) return setErro(r.error);
    setForm(null); onAviso?.("Solicitação registrada. Aguarda aprovação."); carregar();
  }

  async function decidir(t, aprovar) {
    const texto = aprovar ? `Aprovar: ${TIPOS_TRANSICAO[t.tipo]} com vigência em ${br(t.vigencia)}? Isso muda o vínculo e entra no histórico.` : "Recusar esta solicitação?";
    if (!confirm(texto)) return;
    const r = await decidirTransicao(t.id, aprovar, null);
    if (r.error) return alert(r.error);
    onAviso?.(aprovar ? "Aprovado e registrado no histórico." : "Solicitação recusada.");
    await carregar(); if (aprovar) onMudou?.();
  }

  if (vinculos === null) return <Card><p className="text-sm text-hf-muted">Carregando vínculos...</p></Card>;

  return (
    <div className="space-y-4">
      <Card>
        <SectionLabel>Vínculo atual</SectionLabel>
        {!atual ? <p className="text-sm text-hf-muted">Nenhum vínculo aberto.</p> : (
          <>
            <p className="text-lg font-black text-hf-text">{CATEGORIAS[atual.categoria]}</p>
            <p className="text-sm font-semibold text-hf-text-2">{fase.rotulo} · {fase.detalhe}</p>
            <p className="text-xs text-hf-muted mt-1">Remuneração {REGRAS_REMUNERACAO[atual.regra_remuneracao]?.toLowerCase()} · início em {br(atual.inicio)}{atual.inicio_estimado ? " (estimado: confira a data real de início da prestação)" : ""}{podeVerValores && atual.salario_base ? ` · salário-base ${fmtBRL(atual.salario_base)}` : ""}</p>
            {fase.alerta && <p className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm font-semibold text-amber-900">{fase.alerta}</p>}
            {podeSolicitar && fase.acoes.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2 no-print">
                {fase.acoes.map((tipo) => <Btn key={tipo} variant={tipo === "efetivacao" ? "primary" : "ghost"} onClick={() => abrir(tipo)}>{TIPOS_TRANSICAO[tipo]}</Btn>)}
              </div>
            )}
          </>
        )}
      </Card>

      {pendentes.length > 0 && (
        <Card>
          <SectionLabel>Aguardando aprovação</SectionLabel>
          {pendentes.map((t) => (
            <div key={t.id} className="py-2 border-b border-hf-border last:border-0">
              <p className="text-sm font-bold text-hf-text">{TIPOS_TRANSICAO[t.tipo]} · vigência {br(t.vigencia)}</p>
              <p className="text-xs text-hf-text-2">{resumoDados(t)} · {t.motivo}{t.documento_ref ? ` · documento: ${t.documento_ref}` : ""}</p>
              <p className="text-2xs text-hf-muted">{(t.fundamentos || []).join(" · ")}</p>
              {podeAprovar ? (
                <div className="mt-2 flex gap-2 no-print">
                  <Btn variant="primary" className="!h-8 text-2xs" onClick={() => decidir(t, true)}>Aprovar</Btn>
                  <Btn variant="ghost" className="!h-8 text-2xs" onClick={() => decidir(t, false)}>Recusar</Btn>
                </div>
              ) : <p className="text-2xs text-hf-muted mt-1">Quem aprova: proprietário (ou quem tiver permissão de aprovar).</p>}
            </div>
          ))}
        </Card>
      )}

      <Card>
        <SectionLabel>Linha do tempo</SectionLabel>
        {(vinculos || []).map((v) => (
          <div key={v.id} className="py-2 border-b border-hf-border last:border-0">
            <p className="text-sm font-bold text-hf-text">{CATEGORIAS[v.categoria]}{v.experiencia_dias ? ` (${v.experiencia_dias}${v.prorrogacao_dias ? ` + ${v.prorrogacao_dias}` : ""} dias)` : ""}</p>
            <p className="text-xs text-hf-text-2">{br(v.inicio)}{v.inicio_estimado ? " (estimado)" : ""} → {v.fim ? br(v.fim) : "atual"}{v.motivo_fim ? ` · ${v.motivo_fim}` : ""}</p>
          </div>
        ))}
        {decididas.map((t) => (
          <p key={t.id} className="text-2xs text-hf-muted py-1">{br(t.decidido_em)} · {TIPOS_TRANSICAO[t.tipo]} {t.status === "aprovada" ? "aprovada" : "recusada"} · {t.motivo}</p>
        ))}
      </Card>

      <Modal open={!!form} onClose={() => setForm(null)} title={form ? TIPOS_TRANSICAO[form.tipo] : ""}>
        {form && (
          <>
            {form.tipo !== "prorrogacao" && (
              <Field label="Vigência (a partir de)"><TextInput type="date" value={form.vigencia} onChange={(e) => set("vigencia", e.target.value)} /></Field>
            )}
            {form.tipo === "prorrogacao" && (
              <>
                <Field label="Dias de prorrogação"><NumberInput value={form.dias} onChange={(e) => set("dias", e.target.value)} /></Field>
                <p className="text-2xs text-hf-muted mb-3">Uma prorrogação só, não menor que o 1º período ({atual?.experiencia_dias} dias) e com total de até 90 dias (CLT art. 445/451; CCT cl. 19 §3º).</p>
                {prorrogacaoExigeDocumento(atual, hojeIso()) && (
                  <Field label="Contrato assinado que previa a prorrogação (obrigatório)">
                    <TextInput value={form.documento} placeholder="ex.: contrato de experiência anexado em Documentos" onChange={(e) => set("documento", e.target.value)} />
                  </Field>
                )}
              </>
            )}
            {form.tipo === "mudanca_categoria" && (
              <>
                <Field label="Nova modalidade">
                  <Select value={form.categoria} onChange={(e) => set("categoria", e.target.value)}>
                    <option value="">Escolha</option>
                    {Object.entries(CATEGORIAS).filter(([k]) => k !== atual?.categoria).map(([k, r]) => <option key={k} value={k}>{r}</option>)}
                  </Select>
                </Field>
                {form.categoria === "clt_experiencia" && <Field label="Dias do 1º período (mínimo 30 pela CCT)"><NumberInput value={form.experiencia_dias} onChange={(e) => set("experiencia_dias", e.target.value)} /></Field>}
                {form.categoria === "eventual" && <p className="text-2xs text-amber-800 mb-3">Trabalho eventual só quando juridicamente cabível: prestação habitual com subordinação é vínculo de emprego.</p>}
              </>
            )}
            {form.tipo === "alteracao_salarial" && (
              <Field label="Novo salário (R$)"><NumberInput value={form.salario} onChange={(e) => set("salario", e.target.value)} /></Field>
            )}
            <Field label="Motivo"><TextInput value={form.motivo} onChange={(e) => set("motivo", e.target.value)} /></Field>
            {form.tipo !== "prorrogacao" && <Field label="Documento (opcional)"><TextInput value={form.documento} onChange={(e) => set("documento", e.target.value)} /></Field>}
            {erro && <p className="erp-badge erp-badge-danger w-full justify-center mb-3" role="alert">{erro}</p>}
            <div className="flex gap-3">
              <Btn variant="ghost" className="flex-1" onClick={() => setForm(null)}>Cancelar</Btn>
              <Btn variant="primary" className="flex-1" disabled={enviando} onClick={enviar}>{enviando ? "Enviando..." : "Solicitar"}</Btn>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
