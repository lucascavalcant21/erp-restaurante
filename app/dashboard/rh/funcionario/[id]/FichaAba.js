"use client";

// FICHA E OCORRÊNCIAS do funcionário (pedido do dono, 14/11/2026): advertências
// verbais e por escrito, ocorrências, observações do dia, quebras, uniformes,
// reuniões e documentos, cada um com a cópia assinada anexada.
//
// Registro não se apaga: errou, anula com motivo (o banco garante).
// A cópia assinada vai para o bucket PRIVADO de RH; abrir gera link curto.

import { useCallback, useEffect, useMemo, useState } from "react";
import { Camera, CheckCircle2, FileSignature, Printer, Shirt, AlertTriangle, Ban, Undo2, Paperclip, Plus } from "lucide-react";
import { Card, SectionLabel, Chips, EmptyState, Modal, Field, TextInput, Select, Btn } from "../../../../components/ui";
import {
  TIPOS, FILTROS, GRAVIDADES, TITULOS_RAPIDOS, ITENS_UNIFORME, tipoPorId, montarRegistro, recorrencias,
  sugestaoDisciplinar, uniformesComFuncionario, faltaAssinatura, linhaDoTempo, filtrar, reais, termoParaAssinar,
} from "../../../../lib/ficha-funcionario.mjs";
import { carregarFicha, registrarNaFicha, anexarAssinado, registrarRecusa, marcarDevolvido, anularRegistro } from "../../../../lib/ficha-funcionario-dados";
import { abrirArquivoRH } from "../../../../lib/rh-arquivos";

const hojeISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const dataBR = (iso) => String(iso || "").slice(0, 10).split("-").reverse().join("/");
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// Tipos que o gerente mais usa ficam no topo, em botões grandes.
const ATALHOS = ["advertencia_verbal", "advertencia_escrita", "ocorrencia", "observacao", "quebra", "uniforme", "reuniao", "documento"];

function imprimirTermo(registro, funcionario, empresa) {
  const t = termoParaAssinar(registro, { funcionario, empresa });
  const janela = window.open("", "_blank");
  if (!janela) { alert("O navegador bloqueou a janela de impressão."); return; }
  janela.opener = null;
  janela.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(t.titulo)}</title>
<style>body{font-family:Arial,sans-serif;max-width:720px;margin:40px auto;padding:0 24px;color:#111;line-height:1.55}
h1{font-size:20px;margin:0 0 4px}p.emp{margin:0 0 24px;color:#555}p{font-size:15px}
.ass{display:grid;grid-template-columns:1fr 1fr;gap:48px 32px;margin-top:64px}.ass div{border-top:1px solid #111;padding-top:6px;font-size:13px;text-align:center}
.data{margin-top:32px}</style></head><body>
<h1>${esc(t.titulo)}</h1><p class="emp">${esc(t.empresa)}</p>
${t.paragrafos.map((p) => `<p>${esc(p)}</p>`).join("")}
<p class="data">Data: ${esc(t.data)}</p>
<div class="ass">${t.assinaturas.map((a) => `<div>${esc(a.rotulo)}</div>`).join("")}</div>
<script>window.onload=function(){window.print()}</script></body></html>`);
  janela.document.close();
}

function NovoRegistro({ tipoInicial, func, quem, onSalvo, onCancelar }) {
  const [f, setF] = useState({ tipo: tipoInicial, data: hojeISO(), titulo: "", descricao: "", gravidade: "leve", item: "", quantidade: "1", tamanho: "", valor: "" });
  const [arquivo, setArquivo] = useState(null);
  const [erros, setErros] = useState({});
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const tipo = tipoPorId(f.tipo);
  const set = (k, v) => { setF((x) => ({ ...x, [k]: v })); setErros((e) => ({ ...e, [k]: undefined })); setErro(""); };

  async function salvar() {
    const m = montarRegistro(f, { colaboradorId: func.id, registradoPor: quem });
    if (m.erros) { setErros(m.erros); return; }
    setSalvando(true);
    const r = await registrarNaFicha(m.registro, { arquivo });
    setSalvando(false);
    if (r.error && !r.data) { setErro(r.error); return; }
    onSalvo(r.data, r.error);
  }

  return (
    <div className="space-y-1">
      <Field label="Tipo">
        <Select value={f.tipo} onChange={(e) => set("tipo", e.target.value)}>
          {TIPOS.map((t) => <option key={t.id} value={t.id}>{t.rotulo}</option>)}
        </Select>
      </Field>
      <Field label="O que aconteceu">
        <div className="mb-2 flex flex-wrap gap-1.5">
          {(TITULOS_RAPIDOS[f.tipo] || []).map((t) => (
            <button key={t} type="button" onClick={() => set("titulo", t)}
              className={`min-h-[40px] rounded-full border px-3 text-[13px] font-semibold ${f.titulo === t ? "border-hf-menu bg-hf-menu text-white" : "border-hf-border bg-hf-surface text-hf-text"}`}>{t}</button>
          ))}
        </div>
        <TextInput value={f.titulo} onChange={(e) => set("titulo", e.target.value)} placeholder="Ou escreva" maxLength={160} />
        {erros.titulo && <p className="mt-1 text-[13px] text-hf-danger">{erros.titulo}</p>}
      </Field>
      <Field label="Data">
        <TextInput type="date" value={f.data} onChange={(e) => set("data", e.target.value)} />
      </Field>
      {tipo?.gravidade && (
        <Field label="Gravidade">
          <Chips options={GRAVIDADES.map((g) => ({ value: g.id, label: g.rotulo }))} value={f.gravidade} onChange={(v) => set("gravidade", v)} />
        </Field>
      )}
      {tipo?.item && (
        <Field label={tipo.id === "uniforme" ? "Peça" : "Produto ou item"}>
          {tipo.id === "uniforme" && (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {ITENS_UNIFORME.map((t) => (
                <button key={t} type="button" onClick={() => set("item", t)}
                  className={`min-h-[40px] rounded-full border px-3 text-[13px] font-semibold ${f.item === t ? "border-hf-menu bg-hf-menu text-white" : "border-hf-border bg-hf-surface text-hf-text"}`}>{t}</button>
              ))}
            </div>
          )}
          <TextInput value={f.item} onChange={(e) => set("item", e.target.value)} maxLength={160} />
          {erros.item && <p className="mt-1 text-[13px] text-hf-danger">{erros.item}</p>}
        </Field>
      )}
      {(tipo?.quantidade || tipo?.tamanho) && (
        <div className="grid grid-cols-2 gap-3">
          {tipo.quantidade && (
            <Field label="Quantidade">
              <TextInput inputMode="decimal" value={f.quantidade} onChange={(e) => set("quantidade", e.target.value)} />
              {erros.quantidade && <p className="mt-1 text-[13px] text-hf-danger">{erros.quantidade}</p>}
            </Field>
          )}
          {tipo.tamanho && (
            <Field label="Tamanho">
              <TextInput value={f.tamanho} onChange={(e) => set("tamanho", e.target.value)} placeholder="P, M, G, 40…" maxLength={20} />
            </Field>
          )}
        </div>
      )}
      {tipo?.valor && (
        <Field label="Valor do item (R$, opcional)">
          <TextInput inputMode="decimal" value={f.valor} onChange={(e) => set("valor", e.target.value)} placeholder="Ex.: 18,90" />
          {erros.valor && <p className="mt-1 text-[13px] text-hf-danger">{erros.valor}</p>}
          <p className="mt-1 text-[12px] text-hf-muted">Só registro. Desconto em salário depende de acordo prévio ou dolo (art. 462 da CLT).</p>
        </Field>
      )}
      <Field label="Detalhes (opcional)">
        <textarea className="erp-input min-h-[80px] w-full" value={f.descricao} onChange={(e) => set("descricao", e.target.value)} maxLength={4000} />
      </Field>
      {tipo?.assinatura && (
        <Field label="Cópia assinada (opcional agora)">
          <label className="erp-btn erp-btn-ghost w-full cursor-pointer">
            <Camera size={15} /> {arquivo ? arquivo.name.slice(0, 28) : "Foto ou PDF do papel assinado"}
            <input type="file" accept="image/*,application/pdf" capture="environment" hidden onChange={(e) => setArquivo(e.target.files?.[0] || null)} />
          </label>
          <p className="mt-1 text-[12px] text-hf-muted">Sem a cópia agora? Salve, imprima o termo, colha a assinatura e anexe depois.</p>
        </Field>
      )}
      {erro && <p className="erp-badge erp-badge-danger mb-3 w-full justify-center" role="alert">{erro}</p>}
      <div className="flex gap-3 pt-2">
        <Btn variant="ghost" className="flex-1" onClick={onCancelar}>Cancelar</Btn>
        <Btn variant="primary" className="flex-1" disabled={salvando} onClick={salvar}>{salvando ? "Salvando…" : "Registrar"}</Btn>
      </div>
    </div>
  );
}

function ItemDaFicha({ it, podeEditar, func, empresa, onMudou, onAviso }) {
  const tipo = tipoPorId(it.tipo);
  const [ocupado, setOcupado] = useState(false);
  const legado = it.origem === "legado";
  const pendente = !legado && faltaAssinatura(it);

  async function anexar(e) {
    const arq = e.target.files?.[0];
    e.target.value = "";
    if (!arq) return;
    setOcupado(true);
    const r = await anexarAssinado(it, arq);
    setOcupado(false);
    if (r.error) onAviso(`Não anexou: ${r.error}`); else { onAviso("Cópia assinada anexada."); onMudou(); }
  }
  async function recusa() {
    const t = prompt("Recusou assinar. Nome das duas testemunhas:");
    if (!t) return;
    const r = await registrarRecusa(it.id, t);
    if (r.error) onAviso(`Não salvou: ${r.error}`); else onMudou();
  }
  async function anular() {
    const m = prompt("Por que anular este registro? (fica no histórico)");
    if (!m || m.trim().length < 3) return;
    const r = await anularRegistro(it.id, m);
    if (r.error) onAviso(`Não anulou: ${r.error}`); else onMudou();
  }
  async function devolveu() {
    const r = await marcarDevolvido(it.id, hojeISO());
    if (r.error) onAviso(`Não salvou: ${r.error}`); else onMudou();
  }

  return (
    <Card className={`!p-3 ${it.anulado_em ? "opacity-60" : ""}`}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-semibold uppercase tracking-wide text-hf-muted">
            {tipo?.curto || "Registro"} · {dataBR(it.data)}{it.gravidade ? ` · ${GRAVIDADES.find((g) => g.id === it.gravidade)?.rotulo}` : ""}{legado ? " · anterior" : ""}
          </p>
          <p className={`text-[15px] font-semibold text-hf-text ${it.anulado_em ? "line-through" : ""}`}>{it.titulo}</p>
          {(it.item || it.quantidade) && (
            <p className="text-[13px] text-hf-text-2">
              {it.quantidade ? `${Number(it.quantidade).toLocaleString("pt-BR")} × ` : ""}{it.item || ""}{it.tamanho ? ` · tam. ${it.tamanho}` : ""}
              {it.valor_centavos != null ? ` · ${reais(it.valor_centavos)} (valor informado)` : ""}
              {it.devolvido_em ? ` · devolvido em ${dataBR(it.devolvido_em)}` : ""}
            </p>
          )}
          {it.descricao && <p className="mt-0.5 text-[13px] text-hf-text-2">{it.descricao}</p>}
          {it.anulado_em && <p className="mt-0.5 text-[13px] text-hf-danger">Anulado: {it.anulado_motivo}</p>}
          {it.recusou_assinar && <p className="mt-0.5 text-[13px] text-hf-warning">Recusou assinar. Testemunhas: {it.testemunhas}</p>}
          {!legado && it.registrado_por && <p className="mt-0.5 text-[12px] text-hf-muted">Registrado por {it.registrado_por}</p>}
          {pendente && <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-hf-warning/10 px-2 py-0.5 text-[12px] font-semibold text-hf-warning"><FileSignature size={12} /> Falta a cópia assinada</p>}
          {!legado && it.arquivo_url && <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-hf-success/10 px-2 py-0.5 text-[12px] font-semibold text-hf-success"><CheckCircle2 size={12} /> Assinado</p>}
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-2 no-print">
        {it.arquivo_url && (
          <Btn variant="ghost" className="!h-10 text-[13px]" onClick={() => abrirArquivoRH(legado ? it.fonteArquivo : "registro_colab", legado ? it.arquivoId : it.id)}>
            <Paperclip size={14} /> Ver documento
          </Btn>
        )}
        {!legado && !it.anulado_em && tipo?.assinatura && (
          <Btn variant="ghost" className="!h-10 text-[13px]" onClick={() => imprimirTermo(it, func, empresa)}><Printer size={14} /> Imprimir para assinar</Btn>
        )}
        {podeEditar && pendente && (
          <>
            <label className={`erp-btn erp-btn-ghost !h-10 cursor-pointer text-[13px] ${ocupado ? "pointer-events-none opacity-50" : ""}`}>
              <Camera size={14} /> {ocupado ? "Enviando…" : "Anexar assinado"}
              <input type="file" accept="image/*,application/pdf" capture="environment" hidden onChange={anexar} />
            </label>
            {tipo?.grupo === "disciplina" && <Btn variant="ghost" className="!h-10 text-[13px]" onClick={recusa}>Recusou assinar</Btn>}
          </>
        )}
        {podeEditar && !legado && !it.anulado_em && it.tipo === "uniforme" && !it.devolvido_em && (
          <Btn variant="ghost" className="!h-10 text-[13px]" onClick={devolveu}><Undo2 size={14} /> Devolveu</Btn>
        )}
        {podeEditar && !legado && !it.anulado_em && (
          <Btn variant="ghost" className="!h-10 text-[13px] !text-hf-danger" onClick={anular}><Ban size={14} /> Anular</Btn>
        )}
      </div>
    </Card>
  );
}

export default function FichaAba({ func, podeEditar, quem, empresa, onAviso }) {
  const [dados, setDados] = useState(null);
  const [filtro, setFiltro] = useState("todos");
  const [novo, setNovo] = useState(null);

  const carregar = useCallback(async () => { setDados(await carregarFicha(func.id)); }, [func.id]);
  useEffect(() => { carregar(); }, [carregar]);

  const itens = useMemo(() => (dados ? linhaDoTempo({ registros: dados.registros, ...dados.legado }) : []), [dados]);
  const rec = useMemo(() => recorrencias([
    ...(dados?.registros || []),
    ...(dados?.legado?.advertenciasAntigas || []).map((a) => ({ tipo: "advertencia_escrita", titulo: a.motivo, data: a.data })),
  ], { hoje: hojeISO() }), [dados]);
  const sugestao = sugestaoDisciplinar(rec);
  const uniformes = useMemo(() => uniformesComFuncionario(dados?.registros), [dados]);
  const pendentes = (dados?.registros || []).filter(faltaAssinatura).length;
  const visiveis = filtrar(itens, filtro);

  return (
    <div className="space-y-4">
      {podeEditar && (
        <Card>
          <SectionLabel>Registrar</SectionLabel>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {ATALHOS.map((id) => (
              <button key={id} type="button" disabled={dados?.semMigracao} onClick={() => setNovo(id)}
                className="flex min-h-[52px] items-center justify-center gap-1.5 rounded-xl border border-hf-border bg-hf-surface px-2 text-center text-[14px] font-semibold text-hf-text disabled:opacity-50">
                <Plus size={15} /> {tipoPorId(id).curto}
              </button>
            ))}
          </div>
          {dados?.semMigracao && <p className="mt-2 text-[13px] text-hf-warning">A ficha nova ainda não existe neste banco (migração RH-FICHA-1). Abaixo, só o que já estava registrado.</p>}
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="!p-3"><p className="text-[12px] text-hf-muted">Advertências (12 meses)</p><p className="text-[22px] font-black text-hf-text">{dados ? rec.advertencias : "…"}</p></Card>
        <Card className="!p-3"><p className="text-[12px] text-hf-muted">Suspensões</p><p className="text-[22px] font-black text-hf-text">{dados ? rec.suspensoes : "…"}</p></Card>
        <Card className="!p-3"><p className="text-[12px] text-hf-muted">Quebras (12 meses)</p><p className="text-[22px] font-black text-hf-text">{dados ? rec.quebras : "…"}</p></Card>
        <Card className="!p-3"><p className="text-[12px] text-hf-muted">Falta assinar</p><p className={`text-[22px] font-black ${pendentes ? "text-hf-warning" : "text-hf-text"}`}>{dados ? pendentes : "…"}</p></Card>
      </div>

      {(rec.repetidos.length > 0 || sugestao) && (
        <Card>
          <SectionLabel>Recorrências</SectionLabel>
          {rec.repetidos.map((r) => (
            <p key={`${r.tipo}|${r.titulo}`} className="flex items-center gap-2 py-1 text-[14px] text-hf-text">
              <AlertTriangle size={15} className="text-hf-warning" /> <b className="capitalize">{r.titulo}</b> · {r.vezes} vezes ({tipoPorId(r.tipo)?.curto})
            </p>
          ))}
          {sugestao && <p className="mt-2 rounded-xl bg-hf-elevated px-3 py-2 text-[13px] text-hf-text-2"><b>{sugestao.natureza}:</b> {sugestao.texto} A decisão é sua.</p>}
        </Card>
      )}

      {uniformes.length > 0 && (
        <Card>
          <SectionLabel>Uniformes com o funcionário</SectionLabel>
          {uniformes.map((u) => (
            <p key={`${u.item}|${u.tamanho}`} className="flex items-center gap-2 py-1 text-[14px] text-hf-text">
              <Shirt size={15} className="text-hf-muted" /> {u.quantidade} × {u.item}{u.tamanho ? ` (${u.tamanho})` : ""} · última entrega {dataBR(u.ultimaEntrega)}
            </p>
          ))}
        </Card>
      )}

      <div className="no-print">
        <Chips options={FILTROS.map((f) => ({ value: f.id, label: f.rotulo }))} value={filtro} onChange={setFiltro} />
      </div>
      {dados?.erro && <p className="text-[14px] text-hf-danger">Não consegui ler a ficha: {dados.erro}</p>}
      {!dados ? <EmptyState icon={FileSignature} title="Carregando a ficha…" /> : visiveis.length === 0 ? (
        <EmptyState icon={FileSignature} title="Nada registrado aqui ainda" />
      ) : (
        <div className="space-y-2">
          {visiveis.map((it) => (
            <ItemDaFicha key={it.id} it={it} func={func} empresa={empresa} podeEditar={podeEditar} onMudou={carregar} onAviso={onAviso} />
          ))}
        </div>
      )}

      <Modal open={!!novo} onClose={() => setNovo(null)} title={novo ? tipoPorId(novo)?.rotulo : ""}>
        {novo && (
          <NovoRegistro key={novo} tipoInicial={novo} func={func} quem={quem}
            onCancelar={() => setNovo(null)}
            onSalvo={(_, aviso) => { setNovo(null); onAviso(aviso || "Registrado na ficha."); carregar(); }} />
        )}
      </Modal>
    </div>
  );
}
