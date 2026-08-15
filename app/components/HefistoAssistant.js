"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Bot, Send, X, Loader2, Check, ChevronRight, AlertTriangle, Undo2, Mic, MicOff, Volume2, VolumeX } from "lucide-react";
import { useERP } from "../context/ERPContext";
import { fetchColaboradores } from "../lib/rh";
import { vozDisponivel, audioDisponivel, criarEscuta, falar, calarVoz } from "../lib/hefisto-voz";
import { fmtBRL } from "./ui";
import {
  ACOES, camposFaltantes, resolverProduto, carregarContextoEstoque,
  executarMovimento, desfazerMovimento, registrarAuditoria, fmtQtd, mostrarUn,
} from "../lib/hefisto-acoes";

const SUGESTOES = [
  "Quanto tenho de camarão?",
  "Abra o estoque do bar",
  "Dê entrada em 10 kg de picanha",
  "Retire 2 kg de tomate",
];

// Rótulo amigável do módulo atual, a partir da rota.
function moduloDaRota(pathname, dept) {
  const p = pathname || "";
  const mapa = [
    ["/dashboard/operacao/estoque", "Estoque"],
    ["/dashboard/operacao/ingredientes", "Ingredientes"],
    ["/dashboard/operacao/fichas", "Fichas técnicas"],
    ["/dashboard/operacao/compras", "Compras"],
    ["/dashboard/operacao/etiquetas", "Etiquetas"],
    ["/dashboard/operacao/rotina", "Checklist"],
    ["/dashboard/financeiro", "Financeiro"],
    ["/dashboard/rh", "RH"],
    ["/dashboard/relatorios", "Relatórios"],
  ];
  const achado = mapa.find(([rota]) => p.startsWith(rota));
  const nome = achado ? achado[1] : "Painel";
  return dept ? `${nome} · ${dept}` : nome;
}

export default function HefistoAssistant() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { unidadeAtiva, unidadeInfo, sessao } = useERP();

  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [ouvindo, setOuvindo] = useState(false);
  const [parcial, setParcial] = useState("");        // o que está sendo falado agora
  const [erroVoz, setErroVoz] = useState("");
  const [comAudio, setComAudio] = useState(false);   // responder falando
  const escutaRef = useRef(null);
  const temVoz = typeof window !== "undefined" && vozDisponivel();
  const [msgs, setMsgs] = useState([]);
  const [pendente, setPendente] = useState(null); // {tipo, item, estoque, quantidade, intencao, comando}
  const [ultima, setUltima] = useState(null);     // última execução (para desfazer)
  const [colaboradores, setColaboradores] = useState([]);
  const [responsavelId, setResponsavelId] = useState(""); // quem está lançando/retirando
  const fimRef = useRef(null);

  const dept = params?.get("dept") || "";
  const contextoModulo = moduloDaRota(pathname, dept);

  useEffect(() => { fimRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, pendente, aberto]);

  // Fechar com ESC e com o botão "voltar" do celular/tablet: no mobile o painel
  // cobre a tela inteira e o usuário espera que "voltar" saia dele.
  useEffect(() => {
    if (!aberto) return;
    const porTecla = (e) => { if (e.key === "Escape") setAberto(false); };
    const porVoltar = () => setAberto(false);
    window.history.pushState({ hefisto: true }, "");
    window.addEventListener("keydown", porTecla);
    window.addEventListener("popstate", porVoltar);
    return () => {
      window.removeEventListener("keydown", porTecla);
      window.removeEventListener("popstate", porVoltar);
      // Se o painel foi fechado pelo X (e não pelo "voltar"), tira a entrada
      // que empilhamos, para o histórico do app não ficar sujo.
      if (window.history.state?.hefisto) window.history.back();
    };
  }, [aberto]);

  // Colaboradores ativos: usados para registrar QUEM está lançando/retirando.
  useEffect(() => {
    if (!aberto || !unidadeAtiva || colaboradores.length) return;
    fetchColaboradores(unidadeAtiva).then(r => {
      setColaboradores((r.data || []).filter(c => (c.status || "ativo") !== "inativo"));
    }).catch(() => {});
  }, [aberto, unidadeAtiva, colaboradores.length]);

  const diz = (autor, texto, extra = {}) => {
    setMsgs(m => [...m, { autor, texto, ...extra, id: Math.random() }]);
    // Leitura em voz alta da resposta, quando o usuário ativou o áudio.
    if (autor === "bot" && comAudio && audioDisponivel()) falar(texto);
  };

  // ── VOZ: falar o comando em vez de digitar ──────────────────────────────
  const pararEscuta = () => {
    escutaRef.current?.parar();
    escutaRef.current = null;
    setOuvindo(false);
    setParcial("");
  };

  const iniciarEscuta = () => {
    if (!temVoz) { setErroVoz("Este navegador não reconhece voz. Use o Chrome no Android ou o Safari no iPhone."); return; }
    if (ouvindo) { pararEscuta(); return; }
    setErroVoz("");
    calarVoz(); // não escuta a si mesmo falando
    const sessaoVoz = criarEscuta({
      // Pedidos longos ("dá entrada em 5 caixas de cerveja, cada uma com 24...")
      // precisam de fôlego: só encerra após 3,5s de silêncio ou no botão Parar.
      continuo: true,
      silencioMs: 3500,
      onParcial: (t) => setParcial(t),
      onFinal: (frase) => {
        setParcial("");
        setOuvindo(false);
        escutaRef.current = null;
        if (frase) enviar(frase);        // fala vira comando na hora
      },
      onErro: (msg) => { setErroVoz(msg); setOuvindo(false); setParcial(""); escutaRef.current = null; },
      onFim: () => { setOuvindo(false); setParcial(""); escutaRef.current = null; },
    });
    if (!sessaoVoz) { setErroVoz("Não consegui acessar o microfone."); return; }
    escutaRef.current = sessaoVoz;
    setOuvindo(true);
    sessaoVoz.iniciar();
  };

  // Ao fechar o painel, para de ouvir e de falar.
  useEffect(() => {
    if (!aberto) { pararEscuta(); calarVoz(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto]);

  // Envia o texto para o parser e trata a intenção resolvendo dados reais.
  const enviar = async (valor) => {
    const cmd = String(valor ?? texto).trim();
    if (!cmd || ocupado) return;
    setTexto("");
    diz("user", cmd);
    setOcupado(true);
    try {
      const resposta = await fetch("/api/hefisto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          texto: cmd,
          contexto: {
            modulo: contextoModulo, pagina: pathname, setor: dept || null,
            unidade: unidadeInfo?.nome || null, usuario: sessao?.nome || sessao?.email || null,
          },
        }),
      });
      const data = await resposta.json();
      if (!resposta.ok || data.error) { diz("bot", data.error || "Não consegui interpretar."); return; }
      await tratarIntencao(data.intencao, cmd);
    } catch {
      diz("bot", "A conexão falhou. Verifique a internet e tente de novo.");
    } finally {
      setOcupado(false);
    }
  };

  const tratarIntencao = async (intencao, comando) => {
    const { acao } = intencao || {};

    if (acao === "navegar" && intencao.rota) {
      diz("bot", intencao.resposta_curta || `Abrindo ${intencao.rota}.`);
      await registrarAuditoria({
        unidadeId: unidadeAtiva, usuarioId: sessao?.id, usuarioNome: sessao?.nome || sessao?.email,
        comando, intencao, acao: ACOES.navegar.id, modulo: "core", resultado: "sucesso",
      });
      router.push(intencao.rota);
      return;
    }

    // Etiquetas em lote: "5 de alho, 3 de tomate e 10 de cebola" numa frase só.
    if (acao === "etiquetas") {
      const lista = (intencao.etiquetas || []).filter(e => e.produto);
      if (!lista.length) { diz("bot", "Diga os produtos e as quantidades. Ex.: 5 etiquetas de alho e 3 de tomate."); return; }
      const total = lista.reduce((s, e) => s + e.copias, 0);
      const resumo = lista.map(e => `${e.copias}× ${e.produto}`).join(", ");
      diz("bot", `Preparando ${total} etiqueta${total !== 1 ? "s" : ""}: ${resumo}. Abrindo a tela de etiquetas com a fila pronta.`);
      try {
        // A tela de Etiquetas lê esta fila ao abrir e já monta tudo.
        localStorage.setItem("hefisto_etq_fila_voz", JSON.stringify(lista));
      } catch { /* sem armazenamento: a tela abre vazia */ }
      await registrarAuditoria({
        unidadeId: unidadeAtiva, usuarioId: sessao?.id, usuarioNome: sessao?.nome || sessao?.email,
        comando, intencao, acao: "etiquetas.lote", modulo: "operacao", resultado: "sucesso",
      }).catch(() => {});
      router.push(`/dashboard/operacao/etiquetas?dept=${intencao.setor || dept || "cozinha"}&fila=voz`);
      return;
    }

    if (acao === "responder" || acao === "desconhecido" || !acao) {
      diz("bot", intencao?.resposta_curta || "Não entendi. Pode dizer de outro jeito?");
      return;
    }

    // Ações de estoque: sempre resolver contra dados reais.
    const setor = intencao.setor || dept || null;
    const { estoque, itens } = await carregarContextoEstoque(unidadeAtiva, setor);
    if (!estoque) { diz("bot", "Não encontrei um estoque para esta unidade."); return; }

    const faltantes = camposFaltantes(acao, intencao);
    if (faltantes.includes("produto")) {
      diz("bot", intencao.resposta_curta || "Qual produto?");
      return;
    }

    const achado = resolverProduto(itens, intencao.produto);
    if (achado.status === "nao_encontrado") {
      diz("bot", `Não encontrei "${intencao.produto}" no estoque ${estoque.nome}.`);
      return;
    }
    if (achado.status === "ambiguo") {
      diz("bot", "Qual produto você quer?", {
        opcoes: achado.opcoes.map(o => ({ rotulo: `${o.nome}${o.marca ? ` · ${o.marca}` : ""}`, valor: o.nome })),
        intencaoPendente: { ...intencao, produto: null },
      });
      return;
    }

    const item = achado.item;

    if (acao === "consultar_estoque") {
      const saldo = Number(item.quantidade_atual) || 0;
      diz("bot", `${item.nome}: ${fmtQtd(saldo)} ${mostrarUn(item.unidade_medida)} no estoque ${estoque.nome}.`);
      await registrarAuditoria({
        unidadeId: unidadeAtiva, usuarioId: sessao?.id, usuarioNome: sessao?.nome || sessao?.email,
        comando, intencao, acao: ACOES.consultar_estoque.id, modulo: "inventory",
        registroId: item.insumo_id, valorNovo: saldo, resultado: "sucesso",
      });
      return;
    }

    // Entrada/retirada: falta quantidade? pergunta só o que falta.
    if (!(Number(intencao.quantidade) > 0)) {
      diz("bot", acao === "entrada_estoque"
        ? `Quanto de ${item.nome} entrou? (em ${mostrarUn(item.unidade_medida)})`
        : `Quanto de ${item.nome} vai sair? (em ${mostrarUn(item.unidade_medida)})`);
      return;
    }

    // Nível 3: mostra resumo e aguarda confirmação.
    setPendente({
      tipo: acao === "entrada_estoque" ? "entrada" : "saida",
      item, estoque, quantidade: Number(intencao.quantidade), intencao, comando,
    });
  };

  const confirmar = async () => {
    if (!pendente) return;
    // Quem está lançando/retirando é obrigatório — rastreabilidade do estoque.
    if (!responsavelId) { diz("bot", "Informe quem está lançando ou retirando o produto."); return; }
    const colab = colaboradores.find(c => String(c.id) === String(responsavelId));
    setOcupado(true);
    const { tipo, item, estoque, quantidade, intencao, comando } = pendente;
    const r = await executarMovimento({
      tipo, unidadeId: unidadeAtiva, estoque, item, quantidade,
      usuario: {
        id: colab?.id || sessao?.id,
        nome: colab ? `${colab.nome}${colab.cargo ? ` (${colab.cargo})` : ""}` : (sessao?.nome || sessao?.email),
        email: sessao?.email,
      },
      comando, intencao,
    });
    setOcupado(false);
    setPendente(null);
    if (r.error) { diz("bot", r.error); return; }
    diz("bot", `${tipo === "entrada" ? "Entrada" : "Retirada"} registrada por ${colab?.nome || "você"}. ${item.nome}: ${fmtQtd(r.saldoAntes)} → ${fmtQtd(r.saldoDepois)} ${mostrarUn(r.unidade)}.`);
    setUltima({ tipo, item, estoque, quantidade, colab });
  };

  const desfazer = async () => {
    if (!ultima) return;
    setOcupado(true);
    const r = await desfazerMovimento({
      ...ultima, unidadeId: unidadeAtiva,
      usuario: {
        id: ultima.colab?.id || sessao?.id,
        nome: ultima.colab?.nome || sessao?.nome || sessao?.email,
        email: sessao?.email,
      },
    });
    setOcupado(false);
    setUltima(null);
    diz("bot", r.error ? `Não consegui desfazer: ${r.error}` : `Lançamento desfeito. Saldo voltou para ${fmtQtd(r.saldoDepois)} ${mostrarUn(r.unidade)}.`);
  };

  return (
    <>
      {/* Os atalhos flutuantes de microfone e IA foram ocultados. O estoque usa
          seu botão próprio de Auditoria por voz, dentro do fluxo da operação. */}

      {/* Painel lateral */}
      {aberto && (
        <>
        {/* Fundo: tocar fora fecha (no celular o painel ocupa a tela toda) */}
        <div onClick={() => setAberto(false)} className="print:hidden fixed inset-0 z-[294] bg-slate-900/40 backdrop-blur-[2px]" />
        <div className="print:hidden fixed inset-y-0 right-0 z-[295] flex w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-2xl"
          style={{ paddingTop: "env(safe-area-inset-top, 0px)", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
          <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-600 text-white"><Bot size={20} /></div>
            <div className="min-w-0 flex-1">
              <p className="font-black text-slate-900 leading-tight">Assistente Hefisto</p>
              <p className="truncate text-[11px] font-bold text-slate-400">{contextoModulo} · {unidadeInfo?.nome || "unidade"}</p>
            </div>
            {audioDisponivel() && (
              <button onClick={() => { const n = !comAudio; setComAudio(n); if (!n) calarVoz(); }}
                title={comAudio ? "Desligar resposta falada" : "Ouvir as respostas"} aria-label="Resposta em áudio"
                className={`grid h-11 w-11 shrink-0 place-items-center rounded-full transition-colors ${
                  comAudio ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>
                {comAudio ? <Volume2 size={19} /> : <VolumeX size={19} />}
              </button>
            )}
            <button onClick={() => setAberto(false)} aria-label="Fechar assistente"
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 active:scale-95"><X size={20} /></button>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {msgs.length === 0 && (
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                <p className="text-sm font-bold text-emerald-800">Diga o que você precisa</p>
                <p className="mt-1 text-[12px] font-medium text-emerald-700">Posso consultar saldo, abrir telas e lançar entrada/retirada no estoque.</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {SUGESTOES.map(s => (
                    <button key={s} onClick={() => enviar(s)} className="rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-[11px] font-bold text-emerald-700 hover:bg-emerald-50">{s}</button>
                  ))}
                </div>
              </div>
            )}

            {msgs.map(m => (
              <div key={m.id} className={m.autor === "user" ? "flex justify-end" : "flex justify-start"}>
                <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm font-medium ${m.autor === "user" ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-700"}`}>
                  {m.texto}
                  {m.opcoes && (
                    <div className="mt-2 space-y-1.5">
                      {m.opcoes.map(o => (
                        <button key={o.valor} onClick={() => enviar(`${m.intencaoPendente?.acao === "retirada_estoque" ? "retirar" : ""} ${o.valor}`.trim())}
                          className="flex w-full items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-[12px] font-bold text-slate-700 hover:border-emerald-400">
                          {o.rotulo} <ChevronRight size={14} className="text-slate-400" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Resumo aguardando confirmação */}
            {pendente && (
              <div className="rounded-2xl border-2 border-emerald-300 bg-white p-4 shadow-sm">
                <p className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-emerald-700">
                  <AlertTriangle size={13} /> Confirme a {pendente.tipo === "entrada" ? "entrada" : "retirada"}
                </p>
                <div className="mt-2 space-y-1 text-sm">
                  <p className="font-black text-slate-800">{pendente.item.nome}</p>
                  <p className="font-bold text-slate-500">Estoque: {pendente.estoque.nome}</p>
                  <p className="font-bold text-slate-500">Quantidade: {fmtQtd(pendente.quantidade)} {mostrarUn(pendente.item.unidade_medida)}</p>
                  {pendente.intencao?.valor_unitario > 0 && <p className="font-bold text-slate-500">Valor: {fmtBRL(pendente.intencao.valor_unitario)} / {mostrarUn(pendente.item.unidade_medida)}</p>}
                  <p className="font-bold text-slate-500">
                    Saldo: {fmtQtd(pendente.item.quantidade_atual)} → {fmtQtd(pendente.tipo === "entrada"
                      ? (Number(pendente.item.quantidade_atual) || 0) + pendente.quantidade
                      : Math.max(0, (Number(pendente.item.quantidade_atual) || 0) - pendente.quantidade))} {mostrarUn(pendente.item.unidade_medida)}
                  </p>
                </div>
                {/* Obrigatório: quem está lançando/retirando */}
                <label className="mt-3 block">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                    Quem está {pendente.tipo === "entrada" ? "lançando" : "retirando"}? *
                  </span>
                  <select value={responsavelId} onChange={e => setResponsavelId(e.target.value)}
                    className={`mt-1 h-11 w-full rounded-xl border-2 px-3 text-sm font-bold outline-none ${responsavelId ? "border-slate-200 bg-slate-50 text-slate-800" : "border-red-300 bg-red-50 text-red-700"}`}>
                    <option value="">Selecione o responsável...</option>
                    {colaboradores.map(c => <option key={c.id} value={c.id}>{c.nome}{c.cargo ? ` (${c.cargo})` : ""}</option>)}
                  </select>
                </label>
                <div className="mt-3 flex gap-2">
                  <button onClick={confirmar} disabled={ocupado || !responsavelId} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 py-2.5 text-sm font-black text-white hover:bg-emerald-700 disabled:opacity-50">
                    {ocupado ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Confirmar
                  </button>
                  <button onClick={() => { setPendente(null); diz("bot", "Cancelado."); }} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50">Cancelar</button>
                </div>
              </div>
            )}

            {ultima && !pendente && (
              <button onClick={desfazer} disabled={ocupado} className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[12px] font-bold text-slate-600 hover:border-red-300 hover:text-red-600 disabled:opacity-50">
                <Undo2 size={14} /> Desfazer lançamento
              </button>
            )}

            {ocupado && !pendente && (
              <p className="flex items-center gap-2 text-[12px] font-bold text-slate-400"><Loader2 size={14} className="animate-spin" /> Interpretando...</p>
            )}
            <div ref={fimRef} />
          </div>

          <div className="border-t border-slate-100 p-3">
            {/* Estado de escuta: mostra o que está sendo ouvido em tempo real */}
            {ouvindo && (
              <div className="mb-2 flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5">
                <span className="relative flex h-3 w-3 shrink-0">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-70" />
                  <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-600" />
                </span>
                <p className="min-w-0 flex-1 truncate text-sm font-bold text-emerald-800">
                  {parcial || "Ouvindo... pode falar"}
                </p>
                <button onClick={pararEscuta} className="shrink-0 text-[11px] font-black uppercase tracking-wider text-emerald-700">Parar</button>
              </div>
            )}
            {erroVoz && (
              <p className="mb-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[12px] font-bold text-red-700">{erroVoz}</p>
            )}
            <div className="flex items-center gap-2">
              {temVoz && (
                <button onClick={iniciarEscuta} disabled={ocupado} title={ouvindo ? "Parar de ouvir" : "Falar um comando"}
                  className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl border-2 transition-all disabled:opacity-40 ${
                    ouvindo ? "border-emerald-600 bg-emerald-600 text-white" : "border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50"}`}>
                  {ouvindo ? <MicOff size={18} /> : <Mic size={18} />}
                </button>
              )}
              <input
                value={texto}
                onChange={e => setTexto(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") enviar(); }}
                placeholder={ouvindo ? "Falando..." : "Peça algo ao Hefisto..."}
                className="h-11 min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm font-medium outline-none focus:border-emerald-500"
              />
              <button onClick={() => enviar()} disabled={ocupado || !texto.trim()} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40">
                <Send size={17} />
              </button>
            </div>
            {/* Saída explícita — no celular o painel cobre a tela inteira */}
            <button onClick={() => setAberto(false)} className="mt-2 w-full rounded-xl border border-slate-200 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50 sm:hidden">
              Voltar ao sistema
            </button>
          </div>
        </div>
        </>
      )}
    </>
  );
}
