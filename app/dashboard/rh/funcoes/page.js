"use client";

// GUIA DE FUNÇÕES — a rotina de cada função, hora a hora.
//
// A escala responde "quem trabalha hoje"; esta tela responde "o que a pessoa
// faz às 15h40". A segunda pergunta vivia na cabeça de quem está na casa há
// tempo, e cobrava caro em todo treino e toda falta.
//
// É por FUNÇÃO, sem nomes: quem cobre o turno do outro lê a mesma folha.

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Clock, Coffee, Database, Loader2, Plus, Printer, RotateCcw, Save, Table, Trash2,
} from "lucide-react";
import { useERP } from "../../../context/ERPContext";
import { fetchGuias, removerGuia, salvarGuia, semearGuias, TIPOS_GUIA } from "../../../lib/guias";
import {
  GUIA_FUNCOES_PADRAO, ordenarBlocos, periodoDoBloco,
} from "../../../lib/guia-funcoes.mjs";
import { logoSeldeestrelaSVG } from "../../../lib/marca";

const esc = (v) => String(v == null ? "" : v).replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));

export default function GuiaDeFuncoes() {
  const router = useRouter();
  const { unidadeAtiva, unidadeInfo } = useERP();
  const [funcoes, setFuncoes] = useState(GUIA_FUNCOES_PADRAO);
  const [carregando, setCarregando] = useState(true);
  const [editando, setEditando] = useState(false);
  const [salvo, setSalvo] = useState("");
  const [semTabela, setSemTabela] = useState(false);

  const avisar = (texto) => { setSalvo(texto); setTimeout(() => setSalvo(""), 2500); };

  // O guia vive no banco: o tablet da cozinha e o computador da gerência leem a
  // mesma versão. Guardado em cada aparelho, cada um teria a sua — e a versão
  // errada é pior que nenhuma, porque ninguém desconfia dela.
  const daLinha = (linha) => ({
    id: linha.id, funcao: linha.titulo, setor: linha.setor || "",
    cor: linha.cor || "#475569", blocos: Array.isArray(linha.conteudo) ? linha.conteudo : [],
  });

  const carregar = useCallback(async () => {
    if (!unidadeAtiva) return;
    setCarregando(true);
    let { data, error } = await fetchGuias(unidadeAtiva, TIPOS_GUIA.FUNCAO);
    if (error === "sem_tabela") { setSemTabela(true); setFuncoes([]); setCarregando(false); return; }
    setSemTabela(false);

    // Loja nova estreia com o modelo: uma tela vazia não ensina o que ela
    // deveria conter, e ninguém escreve a primeira rotina do zero.
    if (!data.length) {
      const semeado = await semearGuias(unidadeAtiva, GUIA_FUNCOES_PADRAO.map(f => ({
        titulo: f.funcao, setor: f.setor, cor: f.cor, conteudo: f.blocos,
      })), TIPOS_GUIA.FUNCAO);
      if (semeado.error === "sem_tabela") { setSemTabela(true); setCarregando(false); return; }
      data = semeado.data || [];
    }
    setFuncoes(data.map(daLinha));
    setCarregando(false);
  }, [unidadeAtiva]);

  useEffect(() => { carregar(); }, [carregar]);

  // Edita local e grava a função afetada. Esperar o banco a cada tecla deixaria
  // o campo travado; gravar o guia inteiro reescreveria seis linhas por letra.
  const persistir = async (funcaoLocal) => {
    const { error } = await salvarGuia({
      id: funcaoLocal.id, unidade_id: unidadeAtiva, tipo: TIPOS_GUIA.FUNCAO,
      titulo: funcaoLocal.funcao, setor: funcaoLocal.setor, cor: funcaoLocal.cor,
      conteudo: funcaoLocal.blocos,
    });
    if (error === "sem_tabela") return setSemTabela(true);
    avisar(error ? `Não consegui salvar: ${error}` : "Guia salvo");
  };

  // Gravar fora do atualizador de estado: o React pode reexecutar o atualizador,
  // e cada reexecução mandaria a mesma função ao banco de novo.
  const mexer = (idFuncao, transformacao, gravar = true) => {
    const alvo = funcoes.find(f => f.id === idFuncao);
    if (!alvo) return;
    const proximo = transformacao(alvo);
    setFuncoes(atual => atual.map(f => (f.id === idFuncao ? proximo : f)));
    if (gravar) persistir(proximo);
  };

  const alterarBloco = (idFuncao, indice, campo, valor, gravar = true) =>
    mexer(idFuncao, f => ({ ...f, blocos: f.blocos.map((b, i) => i === indice ? { ...b, [campo]: valor } : b) }), gravar);

  const adicionarBloco = (idFuncao) =>
    mexer(idFuncao, f => ({ ...f, blocos: [...f.blocos, { hora: "", fim: "", atividade: "" }] }));

  const removerBloco = (idFuncao, indice) =>
    mexer(idFuncao, f => ({ ...f, blocos: f.blocos.filter((_, i) => i !== indice) }));

  const alterarFuncao = (idFuncao, campo, valor, gravar = true) =>
    mexer(idFuncao, f => ({ ...f, [campo]: valor }), gravar);

  const gravarFuncao = (idFuncao) => {
    const alvo = funcoes.find(f => f.id === idFuncao);
    if (alvo) persistir(alvo);
  };

  const adicionarFuncao = async () => {
    const { error } = await salvarGuia({
      unidade_id: unidadeAtiva, tipo: TIPOS_GUIA.FUNCAO, titulo: "Nova função",
      setor: "", cor: "#475569", conteudo: [{ hora: "", fim: "", atividade: "" }],
      ordem: funcoes.length,
    });
    if (error === "sem_tabela") return setSemTabela(true);
    if (error) return avisar(`Não consegui criar: ${error}`);
    setEditando(true);
    await carregar();
  };

  const removerFuncao = async (idFuncao) => {
    const alvo = funcoes.find(f => f.id === idFuncao);
    if (!confirm(`Remover a função "${alvo?.funcao || ""}" do guia? Some com todas as etapas dela.`)) return;
    const { error } = await removerGuia(idFuncao);
    if (error) return avisar(`Não consegui remover: ${error}`);
    setFuncoes(atual => atual.filter(f => f.id !== idFuncao));
    avisar("Função removida");
  };

  const restaurarPadrao = async () => {
    if (!confirm("Voltar o guia ao modelo padrão? O que foi editado nesta loja será perdido, para todos os aparelhos.")) return;
    setCarregando(true);
    await Promise.all(funcoes.map(f => removerGuia(f.id)));
    setFuncoes([]);
    await carregar();
    avisar("Guia restaurado");
  };

  const funcoesOrdenadas = useMemo(
    () => funcoes.map(f => ({ ...f, blocos: ordenarBlocos(f.blocos) })),
    [funcoes],
  );

  // Uma função por página: a folha vai para a parede do setor, não para uma
  // pasta. Juntar duas funções na mesma folha obriga a ler a do vizinho.
  const imprimir = () => {
    const win = window.open("", "_blank");
    if (!win) return alert("Habilite pop-ups para imprimir.");
    const paginas = funcoesOrdenadas.map((f, indice) => `
      <section class="pagina${indice < funcoesOrdenadas.length - 1 ? " quebra" : ""}">
        <div class="marca">${logoSeldeestrelaSVG(38)}</div>
        <div class="faixa" style="background:${esc(f.cor)}"></div>
        <h1>${esc(f.funcao)}</h1>
        <p class="sub">${esc(f.setor || "")} · ${esc(unidadeInfo?.nome || "")}</p>
        <table>
          <thead><tr><th class="h">Horário</th><th>Atividade</th></tr></thead>
          <tbody>
            ${f.blocos.map(b => `
              <tr class="${b.intervalo ? "pausa" : ""}">
                <td class="h">${esc(periodoDoBloco(b))}</td>
                <td>${b.intervalo ? "<b>INTERVALO</b> — " : ""}${esc(b.atividade || "")}</td>
              </tr>`).join("")}
          </tbody>
        </table>
        <p class="rodape">Guia de funções · impresso em ${new Date().toLocaleDateString("pt-BR")}</p>
      </section>`).join("");

    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Guia de Funções</title><style>
      *{margin:0;padding:0;box-sizing:border-box}
      body{font-family:Arial,Helvetica,sans-serif;color:#0f172a;-webkit-print-color-adjust:exact;print-color-adjust:exact}
      .pagina{padding:14mm}
      .quebra{page-break-after:always}
      .marca{display:flex;justify-content:center;margin-bottom:10px}
      .faixa{height:6px;border-radius:99px;margin-bottom:10px}
      h1{font-size:30px;text-transform:uppercase;letter-spacing:1px;line-height:1.05}
      .sub{font-size:12px;font-weight:bold;color:#64748b;margin:4px 0 14px}
      table{width:100%;border-collapse:collapse;font-size:14px}
      th,td{padding:9px 10px;border-bottom:1px solid #e2e8f0;text-align:left;vertical-align:top}
      th{font-size:9px;text-transform:uppercase;letter-spacing:1.5px;color:#475569;border-bottom:2px solid #cbd5e1}
      .h{white-space:nowrap;font-weight:bold;width:34%}
      tr.pausa td{background:#f1f5f9;font-weight:bold}
      .rodape{margin-top:14px;font-size:10px;color:#94a3b8;font-weight:bold}
      @media print{@page{margin:0}}
    </style></head><body>${paginas}</body></html>`);
    win.document.close();
    setTimeout(() => win.print(), 400);
  };

  // Planilha: as seis funções na mesma folha, uma tabela só. O cartaz serve
  // para a parede do setor; a planilha serve para a mesa da gerência, para
  // conferir a casa inteira de uma vez e ver se dois postos foram escalados
  // para o mesmo intervalo.
  const imprimirPlanilha = () => {
    const win = window.open("", "_blank");
    if (!win) return alert("Habilite pop-ups para imprimir.");
    const linhas = funcoesOrdenadas.map(f => `
      <tr class="grupo"><td colspan="3" style="border-left:6px solid ${esc(f.cor)}">
        ${esc(f.funcao)}<small>${esc(f.setor || "")}</small>
      </td></tr>
      ${f.blocos.map(b => `
        <tr class="${b.intervalo ? "pausa" : ""}">
          <td></td>
          <td class="h">${esc(periodoDoBloco(b))}</td>
          <td>${b.intervalo ? "<b>INTERVALO</b> — " : ""}${esc(b.atividade || "")}</td>
        </tr>`).join("")}`).join("");

    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Guia de Funções — planilha</title><style>
      *{margin:0;padding:0;box-sizing:border-box}
      body{font-family:Arial,Helvetica,sans-serif;color:#0f172a;padding:12mm;-webkit-print-color-adjust:exact;print-color-adjust:exact}
      .marca{display:flex;justify-content:center;margin-bottom:10px}
      h1{font-size:20px;text-transform:uppercase;letter-spacing:2px;border-bottom:3px solid #0f172a;padding-bottom:6px;margin-bottom:4px}
      .sub{font-size:11px;color:#64748b;font-weight:bold;margin-bottom:12px}
      table{width:100%;border-collapse:collapse;font-size:12px}
      th,td{padding:6px 8px;border-bottom:1px solid #e2e8f0;text-align:left;vertical-align:top}
      th{font-size:9px;text-transform:uppercase;letter-spacing:1px;color:#475569;border-bottom:2px solid #cbd5e1}
      td.h{white-space:nowrap;font-weight:bold;width:22%}
      td:first-child{width:8px;padding:0}
      tr.grupo td{background:#0f172a;color:#fff;font-size:13px;font-weight:900;text-transform:uppercase;letter-spacing:1px;padding:7px 10px}
      tr.grupo small{display:block;font-size:9px;font-weight:bold;letter-spacing:1px;color:#cbd5e1;text-transform:none}
      tr.pausa td{background:#f1f5f9;font-weight:bold}
      tr{page-break-inside:avoid}
      .nota{margin-top:12px;border-top:1px solid #e2e8f0;padding-top:8px;font-size:10px;color:#64748b;line-height:1.5}
      @media print{@page{margin:10mm}}
    </style></head><body>
      <div class="marca">${logoSeldeestrelaSVG(38)}</div>
      <h1>Guia de Funções</h1>
      <div class="sub">${esc(unidadeInfo?.nome || "")} · ${new Date().toLocaleDateString("pt-BR")} · ${funcoesOrdenadas.length} função(ões)</div>
      <table>
        <thead><tr><th></th><th>Horário</th><th>Atividade</th></tr></thead>
        <tbody>${linhas}</tbody>
      </table>
      <p class="nota">Guia por função, sem nomes: quem cobre o turno de alguém segue a mesma linha. As faixas cinzas são os intervalos.</p>
    </body></html>`);
    win.document.close();
    setTimeout(() => win.print(), 400);
  };

  return (
    <div className="min-h-screen bg-[var(--surface)] pb-16">
      <div className="sticky top-0 z-20 border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3">
          <button onClick={() => router.push("/dashboard/rh")} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200"><ArrowLeft size={19} /></button>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-black text-slate-900 sm:text-xl">Guia de funções</h1>
            <p className="text-xs font-bold text-slate-500">A rotina de cada função, hora a hora — sem nomes, por posição</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => setEditando(v => !v)}
              className={`flex h-10 items-center gap-2 rounded-xl px-4 text-xs font-black transition-colors ${editando ? "bg-emerald-600 text-white hover:bg-emerald-700" : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}>
              <Save size={15} /> {editando ? "Concluir edição" : "Editar horários"}
            </button>
            {editando && (
              <button onClick={restaurarPadrao} className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-black text-slate-600 hover:bg-slate-50">
                <RotateCcw size={15} /> Voltar ao padrão
              </button>
            )}
            <button onClick={imprimirPlanilha} title="Todas as funções numa tabela só, para a mesa da gerência"
              className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-black text-slate-700 hover:bg-slate-50">
              <Table size={15} /> Planilha
            </button>
            <button onClick={imprimir} title="Uma função por página, para a parede do setor"
              className="flex h-10 items-center gap-2 rounded-xl bg-slate-900 px-4 text-xs font-black text-white hover:bg-slate-800">
              <Printer size={15} /> Cartaz por função
            </button>
          </div>
        </div>
      </div>

      {salvo && (
        <div className="mx-auto mt-3 max-w-5xl px-4 sm:px-6">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-800">{salvo}</div>
        </div>
      )}

      <main className="mx-auto max-w-5xl px-4 py-5 sm:px-6">
        {carregando ? (
          <div className="flex items-center gap-2 text-sm font-bold text-slate-500"><Loader2 size={16} className="animate-spin" /> Carregando o guia...</div>
        ) : (
          <div className="space-y-4">
            {funcoesOrdenadas.map(funcao => (
              <section key={funcao.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <header className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-4 py-3 sm:px-5">
                  {editando ? (
                    <>
                      <input type="color" value={funcao.cor || "#475569"} onChange={e => alterarFuncao(funcao.id, "cor", e.target.value)}
                        title="Cor da função" className="h-9 w-9 shrink-0 cursor-pointer rounded-lg border border-slate-200 bg-white p-1" />
                      <input value={funcao.funcao} onChange={e => alterarFuncao(funcao.id, "funcao", e.target.value)}
                        placeholder="Nome da função"
                        className="h-10 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-base font-black text-slate-900 outline-none focus:border-emerald-500" />
                      <input value={funcao.setor || ""} onChange={e => alterarFuncao(funcao.id, "setor", e.target.value)}
                        placeholder="Setor"
                        className="h-10 w-32 shrink-0 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-600 outline-none focus:border-emerald-500" />
                      <button onClick={() => removerFuncao(funcao.id)} title="Remover função"
                        className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-slate-200 bg-white text-slate-400 hover:border-red-300 hover:text-red-600">
                        <Trash2 size={16} />
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="h-9 w-1.5 shrink-0 rounded-full" style={{ background: funcao.cor }} />
                      <div className="min-w-0 flex-1">
                        <h2 className="text-base font-black uppercase tracking-tight text-slate-900 sm:text-lg">{funcao.funcao}</h2>
                        <p className="text-[11px] font-bold text-slate-400">{funcao.setor}</p>
                      </div>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black text-slate-500">
                        {funcao.blocos.length} etapa{funcao.blocos.length === 1 ? "" : "s"}
                      </span>
                    </>
                  )}
                </header>

                <div className="divide-y divide-slate-100">
                  {funcao.blocos.map((bloco, indice) => (
                    <div key={indice} className={`flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start sm:gap-4 sm:px-5 ${bloco.intervalo ? "bg-slate-50" : ""}`}>
                      {editando ? (
                        <>
                          <div className="flex shrink-0 items-center gap-1.5">
                            <input type="time" value={bloco.hora || ""} onChange={e => alterarBloco(funcao.id, indice, "hora", e.target.value)}
                              className="h-10 w-[104px] rounded-lg border border-slate-200 bg-white px-2 text-sm font-bold outline-none focus:border-emerald-500" />
                            <span className="text-xs font-bold text-slate-400">às</span>
                            <input type="time" value={bloco.fim || ""} onChange={e => alterarBloco(funcao.id, indice, "fim", e.target.value)}
                              className="h-10 w-[104px] rounded-lg border border-slate-200 bg-white px-2 text-sm font-bold outline-none focus:border-emerald-500" />
                          </div>
                          <input value={bloco.atividade || ""} onChange={e => alterarBloco(funcao.id, indice, "atividade", e.target.value)}
                            placeholder="O que fazer neste horário"
                            className="h-10 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium outline-none focus:border-emerald-500" />
                          <button onClick={() => alterarBloco(funcao.id, indice, "intervalo", !bloco.intervalo)}
                            title="Marcar como intervalo"
                            className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg border ${bloco.intervalo ? "border-amber-300 bg-amber-100 text-amber-700" : "border-slate-200 bg-white text-slate-400"}`}>
                            <Coffee size={16} />
                          </button>
                          <button onClick={() => removerBloco(funcao.id, indice)} title="Remover etapa"
                            className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-slate-200 bg-white text-slate-400 hover:text-red-600">
                            <Trash2 size={16} />
                          </button>
                        </>
                      ) : (
                        <>
                          <span className="flex w-[168px] shrink-0 items-center gap-2 text-sm font-black text-slate-700">
                            {bloco.intervalo ? <Coffee size={15} className="text-amber-600" /> : <Clock size={15} className="text-slate-300" />}
                            {periodoDoBloco(bloco)}
                          </span>
                          <p className="min-w-0 flex-1 text-sm font-medium text-slate-600">
                            {bloco.intervalo && <b className="mr-1 font-black uppercase tracking-wide text-amber-700">Intervalo</b>}
                            {bloco.atividade}
                          </p>
                        </>
                      )}
                    </div>
                  ))}
                </div>

                {editando && (
                  <div className="border-t border-slate-100 px-4 py-3 sm:px-5">
                    <button onClick={() => adicionarBloco(funcao.id)} className="flex h-9 items-center gap-2 rounded-lg border border-dashed border-slate-300 px-3 text-xs font-black text-slate-500 hover:border-emerald-400 hover:text-emerald-700">
                      <Plus size={15} /> Adicionar etapa
                    </button>
                  </div>
                )}
              </section>
            ))}
            {editando && (
              <button onClick={adicionarFuncao} className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-white text-sm font-black text-slate-500 hover:border-emerald-400 hover:text-emerald-700">
                <Plus size={17} /> Adicionar função
              </button>
            )}
          </div>
        )}

        <p className="mt-5 text-[11px] font-medium leading-relaxed text-slate-400">
          O guia é por função, sem nomes: quem cobre o turno de alguém lê a mesma folha. Tudo é editável — nome da
          função, setor, cor, horários e etapas —, e o que você mudar fica no banco, igual em todos os aparelhos
          da loja: o tablet da cozinha e o computador da gerência leem a mesma versão. São duas saídas:
          <b> Cartaz por função</b> imprime uma função por página, para a parede do setor;
          <b> Planilha</b> põe a casa inteira numa tabela só, para conferir de uma vez.
        </p>
      </main>
    </div>
  );
}
