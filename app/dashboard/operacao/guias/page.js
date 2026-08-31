"use client";

// GUIA DE USO — como usar e como higienizar cada produto e equipamento.
//
// O que evita acidente e retrabalho não é saber que o produto existe: é saber a
// diluição, a ordem dos passos e o que nunca se faz. Isso costuma morar com
// quem está na casa há mais tempo, e some junto com a pessoa.

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle, ArrowLeft, Beaker, Database, Loader2, Plus, Printer, Save,
  Table, Trash2, Wrench,
} from "lucide-react";
import { useERP } from "../../../context/ERPContext";
import { fetchGuias, removerGuia, salvarGuia, semearGuias, TIPOS_GUIA } from "../../../lib/guias";
import { MODELOS_GUIA_USO, TIPOS_USO, totalPassos } from "../../../lib/guia-uso.mjs";
import { logoSeldeestrelaSVG } from "../../../lib/marca";

const esc = (v) => String(v == null ? "" : v).replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
const iconeDoTipo = (tipo) => (tipo === "equipamento" ? Wrench : Beaker);

export default function GuiaDeUso() {
  const router = useRouter();
  const { unidadeAtiva, unidadeInfo } = useERP();
  const [guias, setGuias] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [semTabela, setSemTabela] = useState(false);
  const [editando, setEditando] = useState(false);
  const [filtro, setFiltro] = useState("todos");
  const [aviso, setAviso] = useState("");

  const mostrar = (texto) => { setAviso(texto); setTimeout(() => setAviso(""), 2800); };

  const carregar = useCallback(async () => {
    if (!unidadeAtiva) return;
    setCarregando(true);
    const produtos = await fetchGuias(unidadeAtiva, TIPOS_GUIA.PRODUTO);
    const equipamentos = await fetchGuias(unidadeAtiva, TIPOS_GUIA.EQUIPAMENTO);
    if (produtos.error === "sem_tabela" || equipamentos.error === "sem_tabela") {
      setSemTabela(true); setGuias([]); setCarregando(false); return;
    }
    setSemTabela(false);
    let lista = [...(produtos.data || []), ...(equipamentos.data || [])];

    // Loja nova estreia com o modelo: uma tela vazia não ensina o que ela
    // deveria conter, e ninguém escreve o primeiro guia do zero.
    if (!lista.length) {
      const semeado = await semearGuias(unidadeAtiva, MODELOS_GUIA_USO.map(m => ({ ...m })), TIPOS_GUIA.PRODUTO);
      if (semeado.error !== "sem_tabela" && semeado.data?.length) {
        // O tipo de cada modelo é respeitado depois da inserção em lote.
        await Promise.all(semeado.data.map((linha, i) =>
          salvarGuia({ ...linha, tipo: MODELOS_GUIA_USO[i]?.tipo || TIPOS_GUIA.PRODUTO })));
        const recarrega = await Promise.all([
          fetchGuias(unidadeAtiva, TIPOS_GUIA.PRODUTO),
          fetchGuias(unidadeAtiva, TIPOS_GUIA.EQUIPAMENTO),
        ]);
        lista = [...(recarrega[0].data || []), ...(recarrega[1].data || [])];
      }
    }
    setGuias(lista);
    setCarregando(false);
  }, [unidadeAtiva]);

  useEffect(() => { carregar(); }, [carregar]);

  const gravar = async (guia) => {
    const { error } = await salvarGuia({ ...guia, unidade_id: unidadeAtiva });
    if (error === "sem_tabela") { setSemTabela(true); return; }
    if (error) return mostrar(`Não consegui salvar: ${error}`);
    mostrar("Guia salvo");
  };

  // Mexe no guia e grava. Texto grava ao sair do campo (esperar o banco a cada
  // tecla travaria a digitação); tudo que é estrutura — passo, seção, cor,
  // "nunca faça" — grava na hora, porque não existe momento de "sair do campo"
  // e o que se perdia era justamente o clique, sem aviso nenhum.
  const mexer = (id, transformar, gravarAgora = true) => {
    const alvo = guias.find(g => g.id === id);
    if (!alvo) return;
    const proximo = transformar(alvo);
    setGuias(atual => atual.map(g => (g.id === id ? proximo : g)));
    if (gravarAgora) gravar(proximo);
  };

  const alterarGuia = (id, campo, valor, gravarAgora = false) =>
    mexer(id, g => ({ ...g, [campo]: valor }), gravarAgora);

  const alterarSecao = (id, indice, campo, valor, gravarAgora = false) =>
    mexer(id, g => ({
      ...g,
      conteudo: (g.conteudo || []).map((s, i) => (i === indice ? { ...s, [campo]: valor } : s)),
    }), gravarAgora);

  const alterarPasso = (id, indiceSecao, indicePasso, valor) =>
    mexer(id, g => ({
      ...g,
      conteudo: (g.conteudo || []).map((s, i) => i !== indiceSecao ? s : {
        ...s,
        passos: (s.passos || []).map((p, j) => (j === indicePasso ? valor : p)),
      }),
    }), false);

  const adicionarPasso = (id, indiceSecao) =>
    mexer(id, g => ({
      ...g,
      conteudo: (g.conteudo || []).map((s, i) => i !== indiceSecao ? s : { ...s, passos: [...(s.passos || []), ""] }),
    }));

  const removerPasso = (id, indiceSecao, indicePasso) =>
    mexer(id, g => ({
      ...g,
      conteudo: (g.conteudo || []).map((s, i) => i !== indiceSecao ? s : {
        ...s, passos: (s.passos || []).filter((_, j) => j !== indicePasso),
      }),
    }));

  const adicionarSecao = (id) =>
    mexer(id, g => ({ ...g, conteudo: [...(g.conteudo || []), { titulo: "Nova seção", passos: [""] }] }));

  const removerSecao = (id, indice) =>
    mexer(id, g => ({ ...g, conteudo: (g.conteudo || []).filter((_, i) => i !== indice) }));

  // Gravar pelo id, e não pelo objeto que a tela tinha quando o campo abriu:
  // entre digitar e sair do campo o guia já é outro.
  const gravarPorId = (id) => {
    const alvo = guias.find(g => g.id === id);
    if (alvo) gravar(alvo);
  };

  const novoGuia = async (tipo) => {
    const { id, error } = await salvarGuia({
      unidade_id: unidadeAtiva, tipo,
      titulo: tipo === "equipamento" ? "Novo equipamento" : "Novo produto",
      setor: "", cor: tipo === "equipamento" ? "#7c3aed" : "#0284c7",
      conteudo: tipo === "equipamento"
        ? [{ titulo: "Antes de ligar", passos: [""] }, { titulo: "Higienização", passos: [""] }, { titulo: "Nunca faça", alerta: true, passos: [""] }]
        : [{ titulo: "Diluição", passos: [""] }, { titulo: "Passo a passo", passos: [""] }, { titulo: "Nunca faça", alerta: true, passos: [""] }],
      ordem: guias.length,
    });
    if (error === "sem_tabela") { setSemTabela(true); return; }
    if (error) return mostrar(`Não consegui criar: ${error}`);
    setEditando(true);
    await carregar();
    if (id) mostrar("Guia criado — preencha os passos");
  };

  const excluirGuia = async (guia) => {
    if (!confirm(`Excluir o guia "${guia.titulo}"? Não tem volta.`)) return;
    const { error } = await removerGuia(guia.id);
    if (error) return mostrar(`Não consegui excluir: ${error}`);
    setGuias(atual => atual.filter(g => g.id !== guia.id));
    mostrar("Guia excluído");
  };

  const visiveis = useMemo(
    () => guias.filter(g => filtro === "todos" || g.tipo === filtro),
    [guias, filtro],
  );

  const corpoImpresso = (g) => `
    <div class="faixa" style="background:${esc(g.cor || "#0f172a")}"></div>
    <h1>${esc(g.titulo)}</h1>
    <p class="sub">${esc(g.tipo === "equipamento" ? "Equipamento" : "Produto")}${g.setor ? ` · ${esc(g.setor)}` : ""} · ${esc(unidadeInfo?.nome || "")}</p>
    ${(g.conteudo || []).map(secao => `
      <section class="bloco ${secao.alerta ? "alerta" : ""}">
        <h2>${esc(secao.titulo || "")}</h2>
        <ol>${(secao.passos || []).filter(p => String(p || "").trim()).map(p => `<li>${esc(p)}</li>`).join("")}</ol>
      </section>`).join("")}`;

  // Cartaz: um guia por página, para ficar ao lado do equipamento ou na porta
  // do armário de químicos — onde a dúvida acontece.
  const imprimirCartazes = (lista) => {
    const alvos = lista?.length ? lista : visiveis;
    if (!alvos.length) return alert("Nenhum guia para imprimir.");
    const win = window.open("", "_blank");
    if (!win) return alert("Habilite pop-ups para imprimir.");
    const paginas = alvos.map((g, i) => `
      <div class="pagina${i < alvos.length - 1 ? " quebra" : ""}">
        <div class="marca">${logoSeldeestrelaSVG(36)}</div>
        ${corpoImpresso(g)}
        <p class="rodape">Guia de uso · impresso em ${new Date().toLocaleDateString("pt-BR")}</p>
      </div>`).join("");
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Guia de Uso</title><style>
      *{margin:0;padding:0;box-sizing:border-box}
      body{font-family:Arial,Helvetica,sans-serif;color:#0f172a;-webkit-print-color-adjust:exact;print-color-adjust:exact}
      .pagina{padding:14mm}.quebra{page-break-after:always}
      .marca{display:flex;justify-content:center;margin-bottom:10px}
      .faixa{height:6px;border-radius:99px;margin-bottom:10px}
      h1{font-size:28px;text-transform:uppercase;letter-spacing:1px;line-height:1.05}
      .sub{font-size:12px;font-weight:bold;color:#64748b;margin:4px 0 14px}
      .bloco{margin-bottom:12px;border:1px solid #e2e8f0;border-radius:8px;padding:10px 12px}
      .bloco h2{font-size:10px;text-transform:uppercase;letter-spacing:2px;color:#475569;margin-bottom:6px}
      .bloco ol{padding-left:18px}
      .bloco li{font-size:14px;line-height:1.5;margin-bottom:3px}
      .alerta{border-color:#fca5a5;background:#fef2f2}
      .alerta h2{color:#b91c1c}
      .rodape{margin-top:10px;font-size:10px;color:#94a3b8;font-weight:bold}
      @media print{@page{margin:0}}
    </style></head><body>${paginas}</body></html>`);
    win.document.close();
    setTimeout(() => win.print(), 400);
  };

  // Planilha: tudo numa tabela só, para conferência e para arquivo.
  const imprimirPlanilha = () => {
    const win = window.open("", "_blank");
    if (!win) return alert("Habilite pop-ups para imprimir.");
    const linhas = visiveis.map(g => `
      <tr class="grupo"><td colspan="3" style="border-left:6px solid ${esc(g.cor || "#0f172a")}">
        ${esc(g.titulo)}<small>${esc(g.tipo === "equipamento" ? "Equipamento" : "Produto")}${g.setor ? ` · ${esc(g.setor)}` : ""}</small>
      </td></tr>
      ${(g.conteudo || []).map(secao => (secao.passos || []).filter(p => String(p || "").trim()).map((passo, i) => `
        <tr class="${secao.alerta ? "alerta" : ""}">
          <td class="sec">${i === 0 ? esc(secao.titulo || "") : ""}</td>
          <td class="num">${i + 1}</td>
          <td>${esc(passo)}</td>
        </tr>`).join("")).join("")}`).join("");

    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Guia de Uso — planilha</title><style>
      *{margin:0;padding:0;box-sizing:border-box}
      body{font-family:Arial,Helvetica,sans-serif;color:#0f172a;padding:12mm;-webkit-print-color-adjust:exact;print-color-adjust:exact}
      .marca{display:flex;justify-content:center;margin-bottom:10px}
      h1{font-size:20px;text-transform:uppercase;letter-spacing:2px;border-bottom:3px solid #0f172a;padding-bottom:6px;margin-bottom:4px}
      .sub{font-size:11px;color:#64748b;font-weight:bold;margin-bottom:12px}
      table{width:100%;border-collapse:collapse;font-size:12px}
      th,td{padding:6px 8px;border-bottom:1px solid #e2e8f0;text-align:left;vertical-align:top}
      th{font-size:9px;text-transform:uppercase;letter-spacing:1px;color:#475569;border-bottom:2px solid #cbd5e1}
      td.sec{width:22%;font-weight:bold;color:#475569}
      td.num{width:26px;color:#94a3b8;font-weight:bold}
      tr.grupo td{background:#0f172a;color:#fff;font-size:13px;font-weight:900;text-transform:uppercase;letter-spacing:1px;padding:7px 10px}
      tr.grupo small{display:block;font-size:9px;font-weight:bold;letter-spacing:1px;color:#cbd5e1;text-transform:none}
      tr.alerta td{background:#fef2f2;color:#b91c1c;font-weight:bold}
      tr{page-break-inside:avoid}
      .nota{margin-top:12px;border-top:1px solid #e2e8f0;padding-top:8px;font-size:10px;color:#64748b;line-height:1.5}
      @media print{@page{margin:10mm}}
    </style></head><body>
      <div class="marca">${logoSeldeestrelaSVG(36)}</div>
      <h1>Guia de Uso</h1>
      <div class="sub">${esc(unidadeInfo?.nome || "")} · ${new Date().toLocaleDateString("pt-BR")} · ${visiveis.length} guia(s)</div>
      <table><thead><tr><th>Etapa</th><th></th><th>O que fazer</th></tr></thead><tbody>${linhas}</tbody></table>
      <p class="nota">As linhas em vermelho são o "nunca faça": é onde mora o acidente.</p>
    </body></html>`);
    win.document.close();
    setTimeout(() => win.print(), 400);
  };

  return (
    <div className="min-h-screen bg-[var(--surface)] pb-16">
      <div className="sticky top-0 z-20 border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3">
          <button onClick={() => router.push("/dashboard/operacao/controles")} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200"><ArrowLeft size={19} /></button>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-black text-slate-900 sm:text-xl">Guia de uso</h1>
            <p className="text-xs font-bold text-slate-500">Como usar e como higienizar cada produto e equipamento</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => setEditando(v => !v)}
              className={`flex h-10 items-center gap-2 rounded-xl px-4 text-xs font-black transition-colors ${editando ? "bg-emerald-600 text-white hover:bg-emerald-700" : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}>
              <Save size={15} /> {editando ? "Concluir edição" : "Editar"}
            </button>
            <button onClick={imprimirPlanilha} title="Tudo numa tabela só" className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-black text-slate-700 hover:bg-slate-50">
              <Table size={15} /> Planilha
            </button>
            <button onClick={() => imprimirCartazes()} title="Um guia por página, para o lado do equipamento" className="flex h-10 items-center gap-2 rounded-xl bg-slate-900 px-4 text-xs font-black text-white hover:bg-slate-800">
              <Printer size={15} /> Cartaz
            </button>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-5xl px-4 py-5 sm:px-6">
        {aviso && <div className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-800">{aviso}</div>}

        {semTabela ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <p className="flex items-center gap-2 text-sm font-black text-amber-900"><Database size={17} /> A tabela dos guias ainda não existe</p>
            <p className="mt-2 text-xs font-medium leading-relaxed text-amber-800">
              Rode <b>db/migracao_guias_operacionais.sql</b> no SQL Editor do Supabase e recarregue esta página.
              Enquanto isso não acontece, nada é salvo — e é melhor dizer isso do que deixar você escrever um guia
              inteiro que se perde ao fechar a aba.
            </p>
          </div>
        ) : carregando ? (
          <div className="flex items-center gap-2 text-sm font-bold text-slate-500"><Loader2 size={16} className="animate-spin" /> Carregando os guias...</div>
        ) : (
          <>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              {[{ id: "todos", rotulo: "Todos" }, ...TIPOS_USO].map(opcao => (
                <button key={opcao.id} onClick={() => setFiltro(opcao.id)}
                  className={`h-9 rounded-xl px-3.5 text-xs font-black transition-colors ${filtro === opcao.id ? "bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>
                  {opcao.rotulo}
                </button>
              ))}
              <span className="flex-1" />
              {editando && TIPOS_USO.map(opcao => (
                <button key={opcao.id} onClick={() => novoGuia(opcao.id)}
                  className="flex h-9 items-center gap-1.5 rounded-xl border border-dashed border-slate-300 bg-white px-3 text-xs font-black text-slate-600 hover:border-emerald-400 hover:text-emerald-700">
                  <Plus size={14} /> {opcao.rotulo}
                </button>
              ))}
            </div>

            {!visiveis.length ? (
              <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm font-bold text-slate-400">
                Nenhum guia neste filtro.
              </p>
            ) : (
              <div className="space-y-4">
                {visiveis.map(guia => {
                  const Icone = iconeDoTipo(guia.tipo);
                  return (
                    <section key={guia.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                      <header className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-4 py-3 sm:px-5">
                        {editando ? (
                          <>
                            <input type="color" value={guia.cor || "#0f172a"} onChange={e => alterarGuia(guia.id, "cor", e.target.value)}
                              onBlur={() => gravarPorId(guia.id)} title="Cor" className="h-9 w-9 shrink-0 cursor-pointer rounded-lg border border-slate-200 bg-white p-1" />
                            <input value={guia.titulo} onChange={e => alterarGuia(guia.id, "titulo", e.target.value)}
                              onBlur={() => gravarPorId(guia.id)} placeholder="Nome do produto ou equipamento"
                              className="h-10 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-base font-black text-slate-900 outline-none focus:border-emerald-500" />
                            <input value={guia.setor || ""} onChange={e => alterarGuia(guia.id, "setor", e.target.value)}
                              onBlur={() => gravarPorId(guia.id)} placeholder="Setor"
                              className="h-10 w-32 shrink-0 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-600 outline-none focus:border-emerald-500" />
                            <button onClick={() => excluirGuia(guia)} title="Excluir guia"
                              className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-slate-200 bg-white text-slate-400 hover:border-red-300 hover:text-red-600">
                              <Trash2 size={16} />
                            </button>
                          </>
                        ) : (
                          <>
                            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-white" style={{ background: guia.cor || "#0f172a" }}>
                              <Icone size={17} />
                            </span>
                            <div className="min-w-0 flex-1">
                              <h2 className="text-base font-black text-slate-900 sm:text-lg">{guia.titulo}</h2>
                              <p className="text-[11px] font-bold text-slate-400">
                                {guia.tipo === "equipamento" ? "Equipamento" : "Produto"}{guia.setor ? ` · ${guia.setor}` : ""}
                              </p>
                            </div>
                            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black text-slate-500">
                              {totalPassos(guia.conteudo)} passo{totalPassos(guia.conteudo) === 1 ? "" : "s"}
                            </span>
                            <button onClick={() => imprimirCartazes([guia])} title={`Imprimir só "${guia.titulo}"`}
                              className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-slate-200 bg-white text-slate-400 hover:border-slate-300 hover:text-slate-700">
                              <Printer size={15} />
                            </button>
                          </>
                        )}
                      </header>

                      <div className="space-y-3 p-4 sm:p-5">
                        {(guia.conteudo || []).map((secao, indiceSecao) => (
                          <div key={indiceSecao} className={`rounded-xl border p-3 ${secao.alerta ? "border-red-200 bg-red-50" : "border-slate-200 bg-slate-50"}`}>
                            <div className="mb-2 flex items-center gap-2">
                              {secao.alerta && <AlertTriangle size={14} className="shrink-0 text-red-600" />}
                              {editando ? (
                                <>
                                  <input value={secao.titulo || ""} onChange={e => alterarSecao(guia.id, indiceSecao, "titulo", e.target.value)}
                                    onBlur={() => gravarPorId(guia.id)} placeholder="Título da seção"
                                    className="h-9 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-black uppercase tracking-wider text-slate-700 outline-none focus:border-emerald-500" />
                                  <button onClick={() => alterarSecao(guia.id, indiceSecao, "alerta", !secao.alerta, true)}
                                    title="Marcar como 'nunca faça'"
                                    className={`h-9 shrink-0 rounded-lg border px-2.5 text-[10px] font-black ${secao.alerta ? "border-red-300 bg-red-100 text-red-700" : "border-slate-200 bg-white text-slate-400"}`}>
                                    Nunca faça
                                  </button>
                                  <button onClick={() => removerSecao(guia.id, indiceSecao)} title="Remover seção"
                                    className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-slate-200 bg-white text-slate-400 hover:text-red-600">
                                    <Trash2 size={14} />
                                  </button>
                                </>
                              ) : (
                                <h3 className={`text-[10px] font-black uppercase tracking-widest ${secao.alerta ? "text-red-700" : "text-slate-500"}`}>
                                  {secao.titulo}
                                </h3>
                              )}
                            </div>
                            <ol className="space-y-1.5">
                              {(secao.passos || []).map((passo, indicePasso) => (
                                <li key={indicePasso} className="flex items-start gap-2">
                                  <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-black ${secao.alerta ? "bg-red-200 text-red-800" : "bg-white text-slate-500"}`}>
                                    {indicePasso + 1}
                                  </span>
                                  {editando ? (
                                    <>
                                      <input value={passo} onChange={e => alterarPasso(guia.id, indiceSecao, indicePasso, e.target.value)}
                                        onBlur={() => gravarPorId(guia.id)} placeholder="O que fazer neste passo"
                                        className="h-9 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2.5 text-sm font-medium outline-none focus:border-emerald-500" />
                                      <button onClick={() => removerPasso(guia.id, indiceSecao, indicePasso)} title="Remover passo"
                                        className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-300 hover:text-red-600">
                                        <Trash2 size={14} />
                                      </button>
                                    </>
                                  ) : (
                                    <span className={`text-sm font-medium leading-relaxed ${secao.alerta ? "text-red-900" : "text-slate-600"}`}>{passo}</span>
                                  )}
                                </li>
                              ))}
                            </ol>
                            {editando && (
                              <button onClick={() => adicionarPasso(guia.id, indiceSecao)} className="mt-2 flex h-8 items-center gap-1.5 rounded-lg border border-dashed border-slate-300 bg-white px-2.5 text-[11px] font-black text-slate-500 hover:border-emerald-400 hover:text-emerald-700">
                                <Plus size={13} /> Passo
                              </button>
                            )}
                          </div>
                        ))}
                        {editando && (
                          <div className="flex flex-wrap gap-2">
                            <button onClick={() => adicionarSecao(guia.id)} className="flex h-9 items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-3 text-xs font-black text-slate-500 hover:border-emerald-400 hover:text-emerald-700">
                              <Plus size={14} /> Seção
                            </button>
                            <button onClick={() => gravarPorId(guia.id)} className="flex h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-black text-white hover:bg-emerald-700">
                              <Save size={14} /> Salvar este guia
                            </button>
                          </div>
                        )}
                      </div>
                    </section>
                  );
                })}
              </div>
            )}
          </>
        )}

        <p className="mt-5 text-[11px] font-medium leading-relaxed text-slate-400">
          Os guias ficam no banco, iguais em todos os aparelhos da loja: o tablet da cozinha e o computador da
          gerência leem a mesma versão. As seções marcadas como <b>nunca faça</b> saem destacadas em vermelho na
          tela e na impressão — é onde mora o acidente.
        </p>
      </main>
    </div>
  );
}
