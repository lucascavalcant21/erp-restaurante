"use client";

function comprimirFotoParaIA(file, maxDim = 1000, qualidade = 0.70) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      let w = img.width, h = img.height;
      if (w > maxDim || h > maxDim) {
        if (w > h) { h = Math.round((h * maxDim) / w); w = maxDim; }
        else { w = Math.round((w * maxDim) / h); h = maxDim; }
      }
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      const b64 = canvas.toDataURL("image/jpeg", qualidade).split(",")[1] || "";
      resolve(b64);
    };
    img.onerror = reject;
    img.src = url;
  });
}


import { useState, useEffect } from "react";
import {
  FileText, Sparkles, Loader2, Printer, Trash2, Save, X, History, ScrollText
} from "lucide-react";
import { PageHeader, PageBody, EmptyState, Btn, Toast, SkeletonList } from "../../../components/ui";
import { useERP } from "../../../context/ERPContext";
import { fetchColaboradores } from "../../../lib/rh";
import { fetchUnidades } from "../../../lib/unidades";
import { fetchAtasReuniao, salvarAtaReuniao, removerAtaReuniao } from "../../../lib/atas";

const FORM_VAZIO = () => ({
  id: null,
  tema: "",
  assuntos: "",
  data_reuniao: new Date().toISOString().split("T")[0],
  hora: "",
  local: "",
  condutor: "",
  texto: "",
});

export default function AtasReuniaoPage() {
  const { unidadeAtiva, unidadeInfo } = useERP();
  const [colaboradores, setColaboradores] = useState([]);
  const [unidadeFull, setUnidadeFull] = useState(null); // linha completa (razão social, CNPJ, endereço)
  const [atas, setAtas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");

  const [form, setForm] = useState(FORM_VAZIO());
  const [participantes, setParticipantes] = useState({}); // colaborador_id -> bool
  const [qtdParticipantes, setQtdParticipantes] = useState(""); // nº de linhas de assinatura na folha
  const [gerando, setGerando] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const notificar = (msg) => { setToast(msg); setTimeout(() => setToast(""), 2800); };

  const carregar = async () => {
    setLoading(true);
    const [rColab, rAtas, rUnis] = await Promise.all([
      fetchColaboradores(unidadeAtiva),
      fetchAtasReuniao(unidadeAtiva),
      fetchUnidades(),
    ]);
    const ativos = (rColab.data || []).filter(c => (c.status || "ativo") !== "inativo");
    setColaboradores(ativos);
    // Todos os funcionários entram na lista de presença por padrão
    setParticipantes(prev => {
      if (Object.keys(prev).length) return prev;
      const p = {}; ativos.forEach(c => { p[c.id] = true; }); return p;
    });
    setAtas(rAtas.data || []);
    setUnidadeFull((rUnis.data || []).find(u => u.id === unidadeAtiva) || null);
    setLoading(false);
  };

  useEffect(() => { if (unidadeAtiva && unidadeAtiva !== "todas") carregar(); }, [unidadeAtiva]);

  // ── Transcrever foto da ata com IA ─────────────────────────────────────
  const transcreverFotoAta = async (b64, mediaType = "image/jpeg") => {
    setGerando(true);
    try {
      const res = await fetch("/api/ia-ata", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imagem_base64: b64,
          imagem_media_type: mediaType,
          tema: form.tema,
          assuntos: form.assuntos,
          data: form.data_reuniao,
          hora: form.hora,
          local: form.local || unidadeInfo?.nome,
          condutor: form.condutor,
          unidade_nome: unidadeFull?.nome_fantasia || unidadeInfo?.nome,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        alert(data.error || "Falha ao ler e transcrever foto da ata.");
        return;
      }
      setForm(f => ({
        ...f,
        tema: data.tema || f.tema || "Ata de Reunião",
        data_reuniao: data.data_reuniao || f.data_reuniao,
        hora: data.hora || f.hora,
        local: data.local || f.local,
        condutor: data.condutor || f.condutor,
        texto: data.texto || f.texto,
        foto: b64,
      }));
      notificar("Ata transcrevida da foto pela IA mantendo sua estrutura!");
    } catch (e) {
      alert("Não consegui ler a foto da ata. Tente novamente.");
    } finally {
      setGerando(false);
    }
  };

  const handleSelecionarFotoAta = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const base64 = await comprimirFotoParaIA(file, 1000, 0.70);
      setForm(f => ({ ...f, foto: base64 }));
      await transcreverFotoAta(base64, file.type || "image/jpeg");
    } catch {
      alert("Erro ao processar imagem.");
    }
  };

  // ── Gerar texto da ata com IA ─────────────────────────────────────────────
  const gerarComIA = async () => {
    if (!form.tema.trim()) return alert("Informe o tema da reunião.");
    setGerando(true);
    try {
      const res = await fetch("/api/ia-ata", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tema: form.tema,
          assuntos: form.assuntos,
          data: form.data_reuniao,
          hora: form.hora,
          local: form.local || unidadeInfo?.nome,
          condutor: form.condutor,
          unidade_nome: unidadeFull?.nome_fantasia || unidadeInfo?.nome,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) { alert(data.error || "Falha ao gerar a ata."); return; }
      setForm(f => ({ ...f, texto: data.texto }));
    } catch {
      alert("Não consegui falar com a IA. Verifique a conexão.");
    } finally {
      setGerando(false);
    }
  };

  // ── Salvar no histórico ───────────────────────────────────────────────────
  const salvar = async () => {
    if (!form.tema.trim()) return alert("Informe o tema.");
    if (!form.texto.trim()) return alert("Gere (ou escreva) o texto da ata antes de salvar.");
    setSalvando(true);
    const nomes = colaboradores.filter(c => participantes[c.id]).map(c => ({ nome: c.nome, cargo: c.cargo || "" }));
    const { id, error } = await salvarAtaReuniao({
      id: form.id,
      unidade_id: unidadeAtiva,
      tema: form.tema.trim(),
      assuntos: form.assuntos || null,
      texto: form.texto,
      data_reuniao: form.data_reuniao || null,
      hora: form.hora || null,
      local: form.local || null,
      condutor: form.condutor || null,
      participantes: nomes,
    });
    setSalvando(false);
    if (error) return alert("Erro ao salvar: " + error);
    setForm(f => ({ ...f, id }));
    notificar("Ata salva no histórico!");
    carregar();
  };

  const abrirDoHistorico = (a) => {
    setForm({
      id: a.id, tema: a.tema || "", assuntos: a.assuntos || "", texto: a.texto || "",
      data_reuniao: a.data_reuniao || "", hora: a.hora || "", local: a.local || "", condutor: a.condutor || "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const excluir = async (a) => {
    if (!confirm(`Excluir a ata "${a.tema}" do histórico?`)) return;
    await removerAtaReuniao(a.id);
    if (form.id === a.id) setForm(FORM_VAZIO());
    notificar("Ata excluída.");
    carregar();
  };

  // ── Impressão: logo, dados da empresa, texto e lista de assinaturas ──────
  const imprimir = () => {
    if (!form.texto.trim()) return alert("Gere o texto da ata antes de imprimir.");
    const u = unidadeFull || {};
    const nomeEmpresa = u.nome_fantasia || u.nome || unidadeInfo?.nome || "Empresa";
    const dataFmt = form.data_reuniao ? form.data_reuniao.split("-").reverse().join("/") : "____/____/______";
    const enderecoLinha = [u.endereco && `${u.endereco}${u.numero ? ", " + u.numero : ""}`, u.bairro, u.cidade && `${u.cidade}${u.uf ? "/" + u.uf : ""}`].filter(Boolean).join(" · ");

    const presentes = colaboradores.filter(c => participantes[c.id]);
    // Nº de linhas: o que você definiu em "quantos vão participar" (nomes
    // marcados primeiro, o resto em branco). Sem número definido: nomes + 4.
    const qtdDesejada = Number(qtdParticipantes) || 0;
    const totalLinhas = qtdDesejada > 0 ? Math.max(qtdDesejada, presentes.length) : presentes.length + 4;
    const extras = totalLinhas - presentes.length;
    const linhaAssin = (n, nome, cargo) => `
      <tr>
        <td class="n">${n}</td>
        <td class="nome">${nome || ""}</td>
        <td class="funcao">${cargo || ""}</td>
        <td class="assin"></td>
      </tr>`;
    const linhasPresenca = [
      ...presentes.map((c, i) => linhaAssin(i + 1, c.nome, c.cargo)),
      ...Array.from({ length: extras }).map((_, i) => linhaAssin(presentes.length + i + 1, "", "")),
    ].join("");

    const corpo = form.texto.split("\n").filter(t => t.trim())
      .map(t => `<p>${t.replace(/</g, "&lt;")}</p>`).join("");

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Ata - ${form.tema}</title>
      <style>
        *{margin:0;padding:0;box-sizing:border-box}
        body{font-family:Georgia,'Times New Roman',serif;color:#111;padding:7mm 8mm;max-width:740px;margin:0 auto}
        .topo{border-bottom:3px double #111;padding-bottom:12px;margin-bottom:6px;text-align:center}
        .empresa h2{font-size:20px;letter-spacing:.5px}
        .empresa p{font-size:10.5px;color:#444;margin-top:2px;font-family:Arial,sans-serif}
        h1{text-align:center;font-size:17px;letter-spacing:4px;text-transform:uppercase;margin:16px 0 4px}
        .tema{text-align:center;font-size:13px;color:#333;margin-bottom:12px;font-style:italic}
        .meta{display:flex;justify-content:center;gap:18px;flex-wrap:wrap;font-family:Arial,sans-serif;font-size:11px;color:#333;border:1px solid #999;border-radius:6px;padding:8px 12px;margin-bottom:16px}
        .meta b{font-weight:bold}
        .corpo p{font-size:12.5px;line-height:1.8;text-align:justify;text-indent:2em;margin-bottom:8px}
        h3{font-family:Arial,sans-serif;font-size:11px;text-transform:uppercase;letter-spacing:2px;color:#444;margin:22px 0 8px;border-bottom:1px solid #999;padding-bottom:4px}
        table{width:100%;border-collapse:collapse}
        th,td{border:1px solid #555;padding:8px 8px;font-size:11.5px;font-family:Arial,sans-serif}
        th{background:#eee;font-size:9px;text-transform:uppercase;letter-spacing:1px}
        td.n{width:6%;text-align:center;color:#666}
        td.nome{width:34%}
        td.funcao{width:22%;color:#444}
        td.assin{width:38%;height:30px}
        .rodape{margin-top:34px;display:flex;justify-content:center}
        .rodape div{width:320px;border-top:1px solid #111;padding-top:5px;text-align:center;font-size:11px;font-family:Arial,sans-serif;color:#333}
        /* margem 0 na página: além de aproveitar a folha, remove o cabeçalho
           e rodapé automáticos do navegador (data/hora, título, URL) */
        @media print{@page{margin:0}}
      </style></head><body>
      <div class="topo">
        <div class="empresa">
          <h2>${nomeEmpresa}</h2>
          <p>
            ${u.razao_social ? `${u.razao_social} · ` : ""}${u.cnpj ? `CNPJ: ${u.cnpj}` : ""}
            ${enderecoLinha ? `<br/>${enderecoLinha}` : ""}
            ${u.telefone_unidade || u.telefone_contato ? `<br/>Tel: ${u.telefone_unidade || u.telefone_contato}` : ""}
          </p>
        </div>
      </div>

      <h1>Ata de Reunião</h1>
      <div class="tema">${form.tema}</div>
      <div class="meta">
        <span><b>Data:</b> ${dataFmt}</span>
        <span><b>Horário:</b> ${form.hora || "____:____"}</span>
        <span><b>Local:</b> ${form.local || nomeEmpresa}</span>
        ${form.condutor ? `<span><b>Condução:</b> ${form.condutor}</span>` : ""}
      </div>

      <div class="corpo">${corpo}</div>

      <h3>Lista de Presença — nome e assinatura</h3>
      <table>
        <thead><tr><th>Nº</th><th>Nome</th><th>Função</th><th>Assinatura</th></tr></thead>
        <tbody>${linhasPresenca}</tbody>
      </table>

      <div class="rodape"><div>${form.condutor || "Responsável pela reunião"}<br/>Condução da reunião</div></div>
      </body></html>`;

    let win = null;
    try { win = window.open("", "_blank", "width=820,height=1000"); } catch { win = null; }
    if (!win) {
      try {
        const iframe = document.createElement("iframe");
        iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
        document.body.appendChild(iframe);
        iframe.srcdoc = html;
        iframe.onload = () => {
          setTimeout(() => {
            try { iframe.contentWindow.focus(); iframe.contentWindow.print(); } catch (e) { alert("Não consegui abrir a impressão: " + e.message); }
            setTimeout(() => iframe.remove(), 60000);
          }, 400);
        };
        return;
      } catch (e) {
        return alert("O navegador bloqueou a janela de impressão. Habilite os popups.\n\nDetalhe: " + e.message);
      }
    }
    win.document.write(html);
    win.document.close();
    setTimeout(() => win.print(), 500);
  };

  if (!unidadeAtiva || unidadeAtiva === "todas") {
    return (
      <div className="min-h-screen">
        <PageHeader title="Atas de Reunião" subtitle="Gere, imprima e arquive atas" icon={ScrollText} />
        <PageBody><EmptyState icon={ScrollText} title="Selecione uma unidade" hint="Escolha a unidade no topo." /></PageBody>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24">
      <PageHeader title="Atas de Reunião" subtitle={`Tema + pauta → a IA redige · logo, dados da empresa e assinaturas · ${unidadeInfo?.nome || ""}`} icon={ScrollText} />
      <PageBody>
        <Toast show={!!toast}>{toast}</Toast>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6 items-start">
          {/* Coluna principal: montagem da ata */}
          <div className="space-y-4">
            <div className="erp-card p-5 space-y-4">
              <div className="flex items-center justify-between">
                <p className="erp-label">Dados da Reunião</p>
                {form.id && <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full" style={{ background: "var(--accent-soft)", color: "var(--accent-strong)" }}>salva no histórico</span>}
              </div>
              <div>
                <label className="erp-label block mb-1.5">Tema da reunião</label>
                <input type="text" value={form.tema} onChange={e => setForm({ ...form, tema: e.target.value })} placeholder="Ex: Alinhamento da equipe para o evento de sábado" className="erp-input" />
              </div>
              <div>
                <label className="erp-label block mb-1.5">Assuntos / pauta (um por linha)</label>
                <textarea value={form.assuntos} onChange={e => setForm({ ...form, assuntos: e.target.value })} rows={4}
                  placeholder={"Ex:\nNovos horários de limpeza da coifa\nPadrão de montagem dos pratos\nUso do banco de horas"}
                  className="erp-input !h-auto py-3 text-sm resize-none" />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="erp-label block mb-1.5">Data</label>
                  <input type="date" value={form.data_reuniao} onChange={e => setForm({ ...form, data_reuniao: e.target.value })} className="erp-input" />
                </div>
                <div>
                  <label className="erp-label block mb-1.5">Horário</label>
                  <input type="time" value={form.hora} onChange={e => setForm({ ...form, hora: e.target.value })} className="erp-input" />
                </div>
                <div>
                  <label className="erp-label block mb-1.5">Local</label>
                  <input type="text" value={form.local} onChange={e => setForm({ ...form, local: e.target.value })} placeholder={unidadeInfo?.nome || "Salão"} className="erp-input" />
                </div>
                <div>
                  <label className="erp-label block mb-1.5">Conduzida por</label>
                  <input type="text" value={form.condutor} onChange={e => setForm({ ...form, condutor: e.target.value })} placeholder="Ex: Lucas (Gestor)" className="erp-input" />
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <label className="erp-btn flex-1 flex items-center justify-center gap-2 cursor-pointer py-3 border border-dashed border-emerald-400 bg-emerald-50 text-emerald-800 font-bold text-xs rounded-xl hover:bg-emerald-100 transition-all">
                    <Sparkles size={16} className="text-emerald-600" />
                    <span>📸 Enviar Foto da Ata / Anotação (IA)</span>
                    <input type="file" accept="image/*" capture="environment" className="hidden" disabled={gerando} onChange={handleSelecionarFotoAta} />
                  </label>
                  <Btn variant="primary" className="flex-1 py-3" onClick={gerarComIA} disabled={gerando}>
                    {gerando ? <><Loader2 size={16} className="animate-spin" /> Processando...</> : <><Sparkles size={16} /> Gerar texto formal com IA</>}
                  </Btn>
                </div>
                {form.foto && (
                  <div className="flex items-center gap-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                    <img src={"data:image/jpeg;base64," + form.foto} alt="Foto da Ata" className="w-16 h-16 object-cover rounded-lg border border-emerald-300 shadow-sm" />
                    <div className="flex-1 min-w-0 text-xs">
                      <p className="font-bold text-emerald-900">Foto da Ata / Anotação anexada</p>
                      <p className="text-emerald-700 text-[11px]">Transcrevida pela IA mantendo sua estrutura original.</p>
                    </div>
                    <button type="button" onClick={() => setForm(f => ({ ...f, foto: null }))} className="px-2 py-1 text-xs font-bold text-rose-600 hover:bg-rose-100 rounded-lg">Remover</button>
                  </div>
                )}
              </div>
            </div>

            <div className="erp-card p-5">
              <p className="erp-label mb-2">Texto da ata (editável)</p>
              <textarea value={form.texto} onChange={e => setForm({ ...form, texto: e.target.value })} rows={14}
                placeholder="O texto gerado aparece aqui — você pode ajustar antes de salvar e imprimir."
                className="erp-input !h-auto py-3 text-sm leading-relaxed resize-none" />
              <div className="flex gap-3 mt-4">
                <Btn variant="ghost" className="flex-1" onClick={() => setForm(FORM_VAZIO())}>Nova ata</Btn>
                <Btn variant="ghost" className="flex-1" onClick={salvar} disabled={salvando}>
                  {salvando ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} {form.id ? "Atualizar" : "Salvar"}
                </Btn>
                <Btn variant="primary" className="flex-1" onClick={imprimir}><Printer size={16} /> Imprimir</Btn>
              </div>
            </div>
          </div>

          {/* Coluna lateral: presença + histórico */}
          <div className="space-y-4">
            <div className="erp-card p-5">
              <p className="erp-label mb-3">Lista de presença (assinam na folha)</p>
              <div className="flex items-center gap-3 p-3 rounded-xl mb-3" style={{ background: "var(--accent-soft)" }}>
                <label className="text-xs font-bold flex-1" style={{ color: "var(--accent-strong)" }}>Quantos funcionários vão participar?</label>
                <input type="number" min="1" max="60" value={qtdParticipantes} onChange={e => setQtdParticipantes(e.target.value)} placeholder="auto"
                  className="w-20 p-2.5 text-center rounded-lg border font-black outline-none"
                  style={{ background: "var(--card)", borderColor: "var(--line)", color: "var(--fg)" }} />
              </div>
              {(() => {
                const marcados = colaboradores.filter(c => participantes[c.id]).length;
                const q = Number(qtdParticipantes) || 0;
                if (q > 0 && q < marcados) return (
                  <p className="text-[10px] font-bold mb-3" style={{ color: "#B45309" }}>
                    Você marcou {marcados} nomes — a folha vai sair com {marcados} linhas para caber todos.
                  </p>
                );
                if (q > 0) return (
                  <p className="text-[10px] font-medium mb-3" style={{ color: "var(--dim)" }}>
                    A folha sai com {q} linha{q > 1 ? "s" : ""} de assinatura: {marcados} com nome impresso + {q - marcados} em branco.
                  </p>
                );
                return null;
              })()}
              {colaboradores.length === 0 ? (
                <p className="text-xs font-medium" style={{ color: "var(--dim)" }}>Sem colaboradores cadastrados — a folha sai com linhas em branco.</p>
              ) : (
                <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                  {colaboradores.map(c => (
                    <label key={c.id} className="flex items-center gap-2.5 p-2 rounded-lg cursor-pointer" style={{ background: participantes[c.id] ? "var(--accent-soft)" : "var(--elevated)" }}>
                      <input type="checkbox" checked={!!participantes[c.id]} onChange={e => setParticipantes(p => ({ ...p, [c.id]: e.target.checked }))} className="w-4 h-4 accent-emerald-600" />
                      <span className="text-sm font-bold truncate" style={{ color: "var(--fg-soft)" }}>{c.nome}</span>
                      {c.cargo && <span className="text-[10px] font-medium ml-auto shrink-0" style={{ color: "var(--dim)" }}>{c.cargo}</span>}
                    </label>
                  ))}
                </div>
              )}
              <p className="text-[10px] font-medium mt-3" style={{ color: "var(--dim)" }}>Sem número definido, a folha sai com os nomes marcados + 4 linhas em branco.</p>
            </div>

            <div className="erp-card p-5">
              <p className="erp-label mb-3 flex items-center gap-1.5"><History size={12} /> Histórico de atas</p>
              {loading ? (
                <SkeletonList rows={3} />
              ) : atas.length === 0 ? (
                <p className="text-xs font-medium" style={{ color: "var(--dim)" }}>Nenhuma ata salva ainda.</p>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                  {atas.map(a => (
                    <div key={a.id} className="p-3 rounded-xl flex items-center gap-2" style={{ background: a.id === form.id ? "var(--accent-soft)" : "var(--elevated)" }}>
                      <button onClick={() => abrirDoHistorico(a)} className="flex-1 min-w-0 text-left">
                        <p className="text-sm font-bold truncate" style={{ color: "var(--fg)" }}>{a.tema}</p>
                        <p className="text-[10px] font-medium" style={{ color: "var(--dim)" }}>
                          {a.data_reuniao ? a.data_reuniao.split("-").reverse().join("/") : "—"}{a.hora ? ` às ${a.hora}` : ""}
                          {Array.isArray(a.participantes) ? ` · ${a.participantes.length} presentes` : ""}
                        </p>
                      </button>
                      <button onClick={() => excluir(a)} className="p-1.5 rounded-lg shrink-0" style={{ color: "var(--dim)" }} title="Excluir"><Trash2 size={14} /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </PageBody>
    </div>
  );
}
