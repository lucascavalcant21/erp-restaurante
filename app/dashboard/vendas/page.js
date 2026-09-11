"use client";
// tempo real: recarrega sozinho a cada 15s e quando o banco muda

import { useState, useEffect, useMemo, useCallback, Suspense, useRef } from "react";
import { useTempoReal } from "../../lib/realtime";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Minus, Trash2, Search as SearchIcon, ArrowLeft, Image as ImageIcon, X, CreditCard, Banknote, QrCode, Maximize, Printer } from "lucide-react";
import { useERP } from "../../context/ERPContext";
import { fetchMesasEComandas, abrirComanda, fecharComanda, atualizarItensComanda } from "../../lib/mesas";
import { fetchCaixaAberto } from "../../lib/caixas";
import { abrirMesaEPedido, cancelarUnidadeEnviada, fetchPedidoAberto, fetchProdutos, lancarItemComanda, registrarVenda } from "../../lib/vendas";
import { fetchPins } from "../../lib/seguranca";
import { registrarAuditoria } from "../../lib/hefisto-acoes";
import { calcularTotaisPDV } from "../../lib/vendas-pdv-utils.mjs";

function fmtBRL(v) { return Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }
const MENSAGENS_PRONTAS = ["Sem cebola", "Sem gelo", "Bem passado", "Ao ponto", "Pouco sal", "Sem açúcar", "Molho separado", "Atenção: alergia"];

function escaparHtml(valor) {
  return String(valor ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function abrirImpressao({ titulo, subtitulo, itens, subtotal, desconto = 0, acrescimo = 0, taxa = 0, total, observacao = "", rodape = "Documento não fiscal" }) {
  const janela = window.open("", "_blank", "width=440,height=720");
  if (!janela) return false;
  const linhas = (itens || []).map(item => `
    <tr><td>${Number(item.quantidade || 0)}x ${escaparHtml(item.nome)}${item.observacao ? `<div class="obs">OBS: ${escaparHtml(item.observacao)}</div>` : ""}</td><td class="direita">${fmtBRL(Number(item.preco || 0) * Number(item.quantidade || 0))}</td></tr>`).join("");
  janela.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escaparHtml(titulo)}</title>
    <style>@page{size:80mm auto;margin:4mm}*{box-sizing:border-box}body{font:12px Arial,sans-serif;color:#111;margin:0}.centro{text-align:center}.direita{text-align:right}h1{font-size:17px;margin:0 0 4px}p{margin:3px 0}.linha{border-top:1px dashed #333;margin:9px 0}table{width:100%;border-collapse:collapse}td{padding:4px 0;vertical-align:top}.total{font-size:16px;font-weight:700}.obs{white-space:pre-wrap}.rodape{font-size:10px;margin-top:14px}</style>
    </head><body><div class="centro"><h1>${escaparHtml(titulo)}</h1><p>${escaparHtml(subtitulo)}</p><p>${new Date().toLocaleString("pt-BR")}</p></div><div class="linha"></div>
    <table><tbody>${linhas}</tbody></table><div class="linha"></div><table><tbody><tr><td>Subtotal</td><td class="direita">${fmtBRL(subtotal)}</td></tr>
    ${Number(desconto) > 0 ? `<tr><td>Desconto</td><td class="direita">-${fmtBRL(desconto)}</td></tr>` : ""}
    ${Number(acrescimo) > 0 ? `<tr><td>Acréscimo</td><td class="direita">+${fmtBRL(acrescimo)}</td></tr>` : ""}
    ${Number(taxa) > 0 ? `<tr><td>Taxa de serviço</td><td class="direita">+${fmtBRL(taxa)}</td></tr>` : ""}
    <tr class="total"><td>TOTAL</td><td class="direita">${fmtBRL(total)}</td></tr></tbody></table>
    ${observacao ? `<div class="linha"></div><p><b>Observação:</b></p><p class="obs">${escaparHtml(observacao)}</p>` : ""}
    <p class="centro rodape">${escaparHtml(rodape)}</p></body></html>`);
  janela.document.close();
  janela.focus();
  setTimeout(() => janela.print(), 250);
  return true;
}

function ControleAjuste({ label, valor, onChange, percentual = false, disabled = false }) {
  const numero = Math.max(0, Number(valor) || 0);
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-2.5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</span>
        <button type="button" disabled={disabled} onClick={() => onChange(0)} className="text-[11px] font-black uppercase text-slate-500 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40">Tirar</button>
      </div>
      <div className="flex items-center gap-2">
        <button type="button" disabled={disabled} onClick={() => onChange(Math.max(0, numero - 1))} className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"><Minus size={16} /></button>
        <div className="relative min-w-0 flex-1">
          <input type="number" disabled={disabled} min="0" step="1" value={numero} onChange={e => onChange(Math.max(0, Number(e.target.value) || 0))} className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 px-2 pr-7 text-center text-sm font-black text-slate-800 outline-none focus:border-emerald-500 disabled:cursor-not-allowed disabled:opacity-50" />
          <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">{percentual ? "%" : "R$"}</span>
        </div>
        <button type="button" disabled={disabled} onClick={() => onChange(numero + 1)} className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"><Plus size={16} /></button>
      </div>
    </div>
  );
}

function VendasPDVContent() {
  const { unidadeAtiva, unidadeInfo, sessao } = useERP();
  const router = useRouter();
  const searchParams = useSearchParams();
  const comandaIdQuery = searchParams.get("comanda");
  const novaMesaIdQuery = searchParams.get("novaMesa");

  const [produtos, setProdutos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [categoriaSelecionada, setCategoriaSelecionada] = useState("Todas");
  
  // Se houver comandaId, estamos editando uma comanda de mesa. Senão, é venda balcão/delivery.
  const [comandaAberta, setComandaAberta] = useState(null);
  const [mesaDaComanda, setMesaDaComanda] = useState(null);
  const [carrinhoBalcao, setCarrinhoBalcao] = useState([]);

  // Modais e Estados UI
  const [caixaAtual, setCaixaAtual] = useState(null);
  const [toast, setToast] = useState("");
  const [modalNovaComanda, setModalNovaComanda] = useState(!!novaMesaIdQuery);
  const [nomeNovoCliente, setNomeNovoCliente] = useState("");
  
  // Checkout
  const [modalCheckout, setModalCheckout] = useState(false);
  const [formaPgto, setFormaPgto] = useState("dinheiro");
  const [salvando, setSalvando] = useState(false);
  const [desconto, setDesconto] = useState(0);
  const [acrescimo, setAcrescimo] = useState(0);
  const [taxaServicoPct, setTaxaServicoPct] = useState(comandaIdQuery ? 10 : 0);
  const [pagamentoConcluido, setPagamentoConcluido] = useState(null);
  const [pinGerente, setPinGerente] = useState("1234");
  const [ajustesAutorizados, setAjustesAutorizados] = useState(false);
  const [autorizacao, setAutorizacao] = useState(null);
  const [pinInformado, setPinInformado] = useState("");
  const [motivoAutorizacao, setMotivoAutorizacao] = useState("");
  const [erroAutorizacao, setErroAutorizacao] = useState("");
  const [autorizando, setAutorizando] = useState(false);
  const [enviandoCozinha, setEnviandoCozinha] = useState(false);
  const [produtoSelecionado, setProdutoSelecionado] = useState(null);
  const [observacaoProduto, setObservacaoProduto] = useState("");
  const [mensagensSelecionadas, setMensagensSelecionadas] = useState([]);
  const containerRef = useRef(null);

  const showToast = useCallback((msg, dur = 3000) => {
    setToast(msg); setTimeout(() => setToast(""), dur);
  }, []);

  function solicitarAutorizacao(configuracao) {
    setAutorizacao(configuracao);
    setPinInformado("");
    setMotivoAutorizacao("");
    setErroAutorizacao("");
  }

  async function confirmarAutorizacao() {
    if (!autorizacao) return;
    if (pinInformado !== pinGerente) {
      setErroAutorizacao("PIN do gerente incorreto.");
      return;
    }
    if (!motivoAutorizacao.trim()) {
      setErroAutorizacao("Informe o motivo desta autorização.");
      return;
    }
    setAutorizando(true);
    try {
      const resultado = await autorizacao.executar(motivoAutorizacao.trim());
      if (resultado?.error) throw new Error(resultado.error);
      const auditoria = await registrarAuditoria({
        unidadeId: unidadeAtiva,
        usuarioId: sessao?.id,
        usuarioNome: sessao?.nome || sessao?.email || "Usuário do PDV",
        comando: motivoAutorizacao.trim(),
        intencao: autorizacao.descricao,
        acao: autorizacao.acao,
        modulo: "sales",
        registroId: autorizacao.registroId || comandaAberta?.id || null,
        valorAnterior: autorizacao.valorAnterior ?? null,
        valorNovo: autorizacao.valorNovo ?? null,
        resultado: "sucesso",
        exigiuConfirmacao: true,
      });
      setAutorizacao(null);
      if (auditoria.error) showToast(`Ação concluída, mas a auditoria avisou: ${auditoria.error}`, 6000);
    } catch (error) {
      setErroAutorizacao(error?.message || "Não foi possível concluir a ação.");
    } finally {
      setAutorizando(false);
    }
  }

  const carregar = useCallback(async (silencioso = false) => {
    if (!silencioso) setLoading(true);
    const [pRes, cxRes, mRes] = await Promise.all([
      // Pratos e drinks são criados pela Ficha Técnica na tabela de produtos.
      // O PDV ainda lia a tabela antiga de cardápio e, por isso, abria vazio.
      fetchProdutos(unidadeAtiva),
      fetchCaixaAberto(unidadeAtiva),
      fetchMesasEComandas(unidadeAtiva)
    ]);
    
    setProdutos((pRes.data || []).filter(p => p.ativo !== false).map(p => ({
      ...p,
      nome: p.nome_produto || p.nome || "Produto",
      preco: Number(p.preco_venda ?? p.preco) || 0,
      categoria: p.categoria || (String(p.departamento).toLowerCase() === "bar" ? "Drinks" : "Pratos principais"),
    })));
    setCaixaAtual(cxRes.data || null);

    if (comandaIdQuery && mRes.data) {
      let achouComanda = null;
      let achouMesa = null;
      for (const m of mRes.data) {
        const c = m.comandas?.find(x => x.id === comandaIdQuery);
        if (c) { achouComanda = c; achouMesa = m; break; }
      }
      setComandaAberta(achouComanda);
      setMesaDaComanda(achouMesa);
    }
    setLoading(false);
  }, [unidadeAtiva, comandaIdQuery]);

  useEffect(() => { carregar(); }, [carregar]);
  useEffect(() => {
    if (!unidadeAtiva) return;
    fetchPins(unidadeAtiva).then(({ data }) => setPinGerente(String(data?.pin_gerente || "1234")));
  }, [unidadeAtiva]);
  useTempoReal(null, () => carregar(true)); // atualiza sozinho (15s / mudanca no banco)

  // CATEGORIAS (Top Carousel)
  const categorias = useMemo(() => {
    const set = [...new Set(produtos.map(p => p.categoria).filter(Boolean))];
    return ["Todas", ...set];
  }, [produtos]);

  const filtrados = useMemo(() => produtos.filter(p => {
    const mb = p.nome?.toLowerCase().includes(busca.toLowerCase());
    const mc = categoriaSelecionada === "Todas" || p.categoria === categoriaSelecionada;
    return mb && mc;
  }), [produtos, busca, categoriaSelecionada]);

  // AÇÕES
  async function handleAbrirComanda() {
    if (!nomeNovoCliente.trim() || !novaMesaIdQuery) return;
    setSalvando(true);
    try {
      const { data, error } = await abrirComanda(novaMesaIdQuery, nomeNovoCliente.trim(), unidadeAtiva);
      if (error || !data?.id) {
        showToast(error || "Não foi possível abrir a comanda.", 5000);
        return;
      }
      setModalNovaComanda(false);
      router.replace(`/dashboard/vendas?comanda=${data.id}`);
    } catch (error) {
      showToast(error?.message || "Não foi possível abrir a comanda.", 5000);
    } finally {
      setSalvando(false);
    }
  }

  function abrirObservacaoProduto(produto) {
    setProdutoSelecionado(produto);
    setObservacaoProduto("");
    setMensagensSelecionadas([]);
  }

  async function confirmarProduto() {
    if (!produtoSelecionado) return;
    const partes = [...mensagensSelecionadas, observacaoProduto.trim()].filter(Boolean);
    await handleAddItem(produtoSelecionado, partes.join(" · "));
    setProdutoSelecionado(null);
  }

  async function handleAddItem(p, observacaoForcada = p.observacao || "") {
    const observacao = String(observacaoForcada || "").trim();
    if (comandaAberta) {
       const itens = comandaAberta.itens || [];
       const idx = itens.findIndex(x => x.id === p.id && String(x.observacao || "").trim() === observacao);
       const novo = idx >= 0
         ? itens.map((item, i) => i === idx ? { ...item, quantidade: Number(item.quantidade) + 1 } : item)
         : [...itens, {
           id: p.id, chave_linha: `${p.id}:${Date.now()}`, nome: p.nome, preco: Number(p.preco) || 0,
           custo: Number(p.custo || p.custo_unitario || p.custo_total || 0), departamento: p.departamento, observacao, quantidade: 1,
         }];
       setComandaAberta(prev => ({ ...prev, itens: novo }));
       const salvo = await atualizarItensComanda(comandaAberta.id, novo);
       if (salvo.error) return showToast(salvo.error, 5000);
       showToast(`+1 ${p.nome} adicionado`);
    } else {
       setCarrinhoBalcao(prev => {
         const idx = prev.findIndex(x => x.id === p.id && String(x.observacao || "").trim() === observacao);
         if (idx >= 0) return prev.map((item, i) => i === idx ? { ...item, quantidade: Number(item.quantidade) + 1 } : item);
         return [...prev, {
           id: p.id, chave_linha: `${p.id}:${Date.now()}`, nome: p.nome, preco: Number(p.preco) || 0,
           custo: Number(p.custo || p.custo_unitario || p.custo_total || 0), departamento: p.departamento, observacao, quantidade: 1,
         }];
       });
    }
  }

  async function handleMinusItem(p) {
    if (comandaAberta) {
       const itens = comandaAberta.itens || [];
       const chaveLinha = p.chave_linha || p.id;
       const mesmaLinha = item => (item.chave_linha || item.id) === chaveLinha;
       const atual = itens.find(mesmaLinha);
       if (atual && Number(atual.quantidade) <= Number(atual.quantidade_enviada || 0)) {
         solicitarAutorizacao({
           titulo: "Cancelar item já enviado",
           descricao: `Retirar 1 unidade de ${atual.nome} da comanda e da produção.`,
           acao: "sales.cancel_sent_item",
           registroId: `${comandaAberta.id}:${atual.id}`,
           valorAnterior: Number(atual.quantidade),
           valorNovo: Math.max(0, Number(atual.quantidade) - 1),
           executar: async () => {
             const cancelado = await cancelarUnidadeEnviada(mesaDaComanda?.id, atual.id, atual.observacao);
             if (cancelado.error) return cancelado;
             const novosItens = itens.map(item => mesmaLinha(item) ? {
               ...item,
               quantidade: Math.max(0, Number(item.quantidade) - 1),
               quantidade_enviada: Math.max(0, Number(item.quantidade_enviada || 0) - 1),
             } : item).filter(item => Number(item.quantidade) > 0);
             const salvo = await atualizarItensComanda(comandaAberta.id, novosItens);
             if (!salvo.error) {
               setComandaAberta(prev => ({ ...prev, itens: novosItens }));
               showToast(`${atual.nome} cancelado com autorização do gerente.`);
             }
             return salvo;
           },
         });
         return;
       }
       const novo = itens.map(x => mesmaLinha(x) ? { ...x, quantidade: x.quantidade - 1 } : x).filter(x => x.quantidade > 0);
       setComandaAberta(prev => ({ ...prev, itens: novo }));
       await atualizarItensComanda(comandaAberta.id, novo);
    } else {
       const chaveLinha = p.chave_linha || p.id;
       setCarrinhoBalcao(prev => prev.map(x => (x.chave_linha || x.id) === chaveLinha ? { ...x, quantidade: x.quantidade - 1 } : x).filter(x => x.quantidade > 0));
    }
  }

  // CARRINHO VIEW
  const isMesa = !!comandaAberta;
  const itensCarrinho = isMesa ? (comandaAberta.itens || []) : carrinhoBalcao;
  const totaisPDV = calcularTotaisPDV(itensCarrinho, { desconto, acrescimo, taxaPercentual: taxaServicoPct });
  const subtotal = totaisPDV.subtotal;
  const totalItens = itensCarrinho.reduce((a, x) => a + x.quantidade, 0);
  const descontoAplicado = totaisPDV.desconto;
  const acrescimoAplicado = totaisPDV.acrescimo;
  const taxaServicoVal = totaisPDV.taxa;
  const totalFinal = totaisPDV.total;
  const itensPendentesCozinha = isMesa ? itensCarrinho.reduce(
    (total, item) => total + Math.max(0, Number(item.quantidade) - Number(item.quantidade_enviada || 0)), 0,
  ) : 0;

  async function handleEnviarCozinha() {
    if (!isMesa || !mesaDaComanda?.id || itensPendentesCozinha <= 0) {
      showToast("Não há itens novos para enviar à cozinha ou ao bar.");
      return;
    }
    setEnviandoCozinha(true);
    try {
      let { data: pedido, error: erroPedido } = await fetchPedidoAberto(mesaDaComanda.id);
      if (!pedido && !erroPedido) {
        const criado = await abrirMesaEPedido(unidadeAtiva, mesaDaComanda.id, null, comandaAberta.nome_cliente || "Comanda");
        pedido = criado.data;
        erroPedido = criado.error;
      }
      if (erroPedido || !pedido?.id) throw new Error(erroPedido || "Não foi possível abrir o pedido da cozinha.");

      for (const item of itensCarrinho) {
        const quantidadeNova = Math.max(0, Number(item.quantidade) - Number(item.quantidade_enviada || 0));
        if (!quantidadeNova) continue;
        const resultado = await lancarItemComanda(
          pedido.id, item.id, Number(item.preco) || 0, quantidadeNova, String(item.observacao || "").trim(),
        );
        if (resultado.error) throw new Error(`${item.nome}: ${resultado.error}`);
      }

      const enviados = itensCarrinho.map(item => ({
        ...item,
        quantidade_enviada: Number(item.quantidade),
      }));
      const salvo = await atualizarItensComanda(comandaAberta.id, enviados);
      if (salvo.error) throw new Error(salvo.error);
      setComandaAberta(atual => ({ ...atual, itens: enviados }));
      showToast(`${itensPendentesCozinha} item(ns) enviado(s). Cozinha e bar recebem comandas separadas por setor.`);
    } catch (error) {
      showToast(error?.message || "Não foi possível enviar para a cozinha ou o bar.", 5000);
    } finally {
      setEnviandoCozinha(false);
    }
  }

  function solicitarLiberacaoAjustes() {
    solicitarAutorizacao({
      titulo: "Liberar ajustes do pagamento",
      descricao: "Permitir alteração de desconto, acréscimo ou taxa de serviço.",
      acao: "sales.unlock_payment_adjustments",
      registroId: comandaAberta?.id || "venda-balcao",
      executar: async () => {
        setAjustesAutorizados(true);
        return { error: null };
      },
    });
  }

  async function handleConfirmarPagamento() {
    setSalvando(true);
    const resumoPagamento = {
      eraMesa: isMesa,
      mesa: mesaDaComanda?.numero,
      cliente: isMesa ? comandaAberta.nome_cliente : "Balcão",
      itens: itensCarrinho.map(item => ({ ...item })),
      subtotal,
      desconto: descontoAplicado,
      acrescimo: acrescimoAplicado,
      taxa: taxaServicoVal,
      total: totalFinal,
      forma: formaPgto,
      observacao: "",
    };
    const opts = {
      itens: itensCarrinho,
      desconto: descontoAplicado, acrescimo: acrescimoAplicado,
      taxa_servico: taxaServicoVal,
      forma_pagamento: formaPgto,
      cliente: isMesa ? comandaAberta.nome_cliente : "Balcão",
      caixa_id: caixaAtual?.id
    };

    if (isMesa) {
      const { error } = await fecharComanda(comandaAberta, opts, unidadeAtiva);
      if (!error) {
         showToast("Comanda fechada com sucesso!");
         setModalCheckout(false);
         setPagamentoConcluido(resumoPagamento);
         if (ajustesAutorizados) registrarAuditoria({
           unidadeId: unidadeAtiva, usuarioId: sessao?.id, usuarioNome: sessao?.nome || sessao?.email,
           comando: "Pagamento com ajustes autorizado pelo gerente", intencao: "Fechamento de comanda",
           acao: "sales.checkout_with_adjustments", modulo: "sales", registroId: comandaAberta.id,
           valorAnterior: { subtotal }, valorNovo: { desconto: descontoAplicado, acrescimo: acrescimoAplicado, taxaServicoPct, total: totalFinal },
           resultado: "sucesso", exigiuConfirmacao: true,
         });
      } else {
         showToast(error, 5000);
      }
    } else {
      const { error } = await registrarVenda(opts, unidadeAtiva);
      if (!error) {
         showToast("Venda balcão registrada!");
         setModalCheckout(false);
         setPagamentoConcluido(resumoPagamento);
         if (ajustesAutorizados) registrarAuditoria({
           unidadeId: unidadeAtiva, usuarioId: sessao?.id, usuarioNome: sessao?.nome || sessao?.email,
           comando: "Pagamento com ajustes autorizado pelo gerente", intencao: "Venda no balcão",
           acao: "sales.checkout_with_adjustments", modulo: "sales", registroId: null,
           valorAnterior: { subtotal }, valorNovo: { desconto: descontoAplicado, acrescimo: acrescimoAplicado, taxaServicoPct, total: totalFinal },
           resultado: "sucesso", exigiuConfirmacao: true,
         });
      } else {
         showToast(error, 5000);
      }
    }
    setSalvando(false);
  }

  function finalizarPosPagamento() {
    const eraMesa = pagamentoConcluido?.eraMesa;
    setPagamentoConcluido(null);
    setDesconto(0);
    setAcrescimo(0);
    setTaxaServicoPct(eraMesa ? 10 : 0);
    setAjustesAutorizados(false);
    setCarrinhoBalcao([]);
    if (eraMesa) router.push("/dashboard/mesas");
  }

  function imprimirComandaMesa() {
    const impresso = abrirImpressao({
      titulo: `Comanda do cliente · Mesa ${mesaDaComanda?.numero || ""}`,
      subtitulo: comandaAberta?.nome_cliente || "Cliente",
      itens: itensCarrinho,
      subtotal,
      taxa: taxaServicoVal,
      total: totalFinal,
      observacao: "",
      rodape: "Via do cliente · comanda de conferência",
    });
    if (!impresso) showToast("Permita a abertura da janela para imprimir.", 5000);
  }

  function imprimirCupomConcluido() {
    if (!pagamentoConcluido) return;
    const impresso = abrirImpressao({
      titulo: "Cupom da venda",
      subtitulo: pagamentoConcluido.eraMesa
        ? `Mesa ${pagamentoConcluido.mesa || ""} · ${pagamentoConcluido.cliente || "Cliente"}`
        : "Venda no balcão",
      itens: pagamentoConcluido.itens,
      subtotal: pagamentoConcluido.subtotal,
      desconto: pagamentoConcluido.desconto,
      acrescimo: pagamentoConcluido.acrescimo,
      taxa: pagamentoConcluido.taxa,
      total: pagamentoConcluido.total,
      observacao: pagamentoConcluido.observacao,
      rodape: "Documento não fiscal. Para emissão fiscal, conecte o módulo NFC-e/SAT.",
    });
    if (!impresso) {
      showToast("Permita a abertura da janela para imprimir.", 5000);
      return;
    }
    finalizarPosPagamento();
  }

  if (loading) return <div className="flex h-screen items-center justify-center font-black text-2xl text-slate-500 bg-slate-50">Iniciando PDV...</div>;

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
       containerRef.current?.requestFullscreen?.();
    } else {
       document.exitFullscreen?.();
    }
  };

  return (
    <div ref={containerRef} className="flex flex-col lg:flex-row min-h-screen lg:h-screen bg-slate-100 overflow-y-auto lg:overflow-hidden font-sans">
      {toast && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[999] bg-slate-900 text-white px-6 py-4 rounded-2xl shadow-2xl font-black text-sm transition-all animate-bounce">
          {toast}
        </div>
      )}

      {/* COLUNA ESQUERDA: PRODUTOS (CARDÁPIO) */}
      <div className="flex-1 flex flex-col min-w-0 min-h-[65vh] lg:min-h-0 bg-white shadow-xl z-10">
        <div className="sticky top-0 z-40 shrink-0 bg-white shadow-sm">
         {/* HEADER ESQUERDO */}
          <div className="px-3 sm:px-6 py-3 sm:py-4 border-b border-slate-100 flex flex-wrap items-center gap-2 sm:gap-4 bg-white">
            {isMesa && (
               <button onClick={() => router.push("/dashboard/mesas")} className="p-4 bg-slate-50 rounded-2xl hover:bg-slate-100 text-slate-500 transition-colors shadow-sm">
                 <ArrowLeft size={24} />
               </button>
            )}
            <div className="relative flex-1">
               <SearchIcon size={24} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
               <input 
                 type="text" 
                 placeholder="Buscar produto..." 
                 value={busca} 
                 onChange={e => setBusca(e.target.value)} 
                 className="w-full pl-12 sm:pl-14 pr-3 sm:pr-6 py-3 sm:py-4 bg-slate-50 rounded-2xl text-slate-800 font-bold text-base sm:text-lg outline-none focus:ring-2 focus:ring-emerald-500 transition-all placeholder:font-medium"
               />
            </div>
            {isMesa && (
               <div className="px-6 py-4 bg-slate-50 text-emerald-700 font-black text-lg rounded-2xl flex items-center gap-2 shadow-sm">
                 MESA {mesaDaComanda?.numero}
               </div>
            )}
            <button onClick={toggleFullscreen} className="p-4 bg-slate-50 rounded-2xl hover:bg-slate-100 text-slate-500 transition-colors shadow-sm" title="Tela Cheia">
               <Maximize size={24} />
            </button>
         </div>

         {/* CARROSSEL DE CATEGORIAS */}
          <div className="border-b border-slate-100 bg-white px-3 sm:px-6 py-3 sm:py-4 overflow-x-auto custom-scrollbar">
            <div className="flex min-w-max w-fit mx-auto gap-2 sm:gap-3">
            {categorias.map(c => (
               <button 
                 key={c} 
                 onClick={() => setCategoriaSelecionada(c)} 
                  className={`flex-shrink-0 px-4 sm:px-8 py-3 sm:py-4 rounded-2xl font-black text-xs sm:text-sm uppercase tracking-widest transition-all duration-200 ${
                   categoriaSelecionada === c 
                     ? 'bg-emerald-600 text-white shadow-lg shadow-blue-600/30 transform scale-105' 
                     : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                 }`}
               >
                 {c}
               </button>
            ))}
            </div>
         </div>
        </div>

         {/* GRID DE PRODUTOS */}
          <div className="flex-1 overflow-y-auto p-3 sm:p-6 bg-slate-50/50">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 pb-20">
               {filtrados.map(p => {
                 const qtdNoCarrinho = itensCarrinho.find(x => x.id === p.id)?.quantidade || 0;
                 return (
                   <button 
                     key={p.id} 
                     onClick={() => abrirObservacaoProduto(p)}
                     className="bg-white border border-slate-100 rounded-[28px] overflow-hidden shadow-sm hover:shadow-xl hover:border-slate-200 transition-all duration-200 flex flex-col relative group text-left active:scale-95"
                   >
                      {qtdNoCarrinho > 0 && (
                        <div className="absolute top-3 right-3 w-10 h-10 bg-emerald-600 text-white font-black text-lg flex items-center justify-center rounded-full shadow-lg z-10">
                          {qtdNoCarrinho}
                        </div>
                      )}
                      
                      <div className="h-28 sm:h-40 bg-slate-100 flex items-center justify-center text-slate-500 relative overflow-hidden group-hover:bg-slate-200 transition-colors">
                         <ImageIcon size={48} className="opacity-50" />
                      </div>
                      
                      <div className="p-3 sm:p-5 flex-1 flex flex-col justify-between">
                         <h3 className="font-bold text-slate-800 text-base leading-tight mb-2 line-clamp-2">{p.nome}</h3>
                         <span className="font-black text-emerald-600 text-xl">{fmtBRL(p.preco)}</span>
                      </div>
                   </button>
                 )
               })}
               {filtrados.length === 0 && <div className="col-span-full py-16 text-center font-bold text-slate-500">Nenhum prato ou drink encontrado nesta categoria.</div>}
            </div>
         </div>
      </div>

      {/* COLUNA DIREITA: CUPOM FISCAL / CARRINHO */}
      <div className="w-full lg:w-[420px] max-h-[70vh] lg:max-h-none bg-slate-50 flex flex-col flex-shrink-0 shadow-[0_-10px_30px_rgba(0,0,0,0.05)] lg:shadow-[-10px_0_30px_rgba(0,0,0,0.05)] z-20 border-t lg:border-t-0 lg:border-l border-slate-200">
         
         {/* Cabeçalho Cupom */}
          <div className="p-4 sm:p-6 bg-white border-b border-slate-200 shadow-sm">
            <h2 className="font-black text-2xl text-slate-800 tracking-tight">
              {isMesa ? `Comanda: ${comandaAberta.nome_cliente}` : "Venda Balcão"}
            </h2>
            <p className="text-sm font-bold text-slate-500 mt-1 uppercase tracking-widest">{totalItens} Itens</p>
         </div>

         {/* Lista de Itens do Cupom */}
         <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
            {itensCarrinho.length === 0 ? (
               <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
                 <div className="w-20 h-20 bg-slate-200 rounded-full flex items-center justify-center mb-4">
                   <Plus size={32} className="text-slate-500" />
                 </div>
                 <p className="font-black text-lg">Sem pedidos lançados</p>
                 <p className="text-sm font-medium text-slate-500 mt-1">Toque nos produtos para adicionar</p>
               </div>
            ) : (
               itensCarrinho.map(item => (
                 <div key={item.chave_linha || `${item.id}:${item.observacao || ""}`} className="bg-slate-200 p-4 rounded-2xl shadow-sm border border-slate-300 flex flex-col gap-3">
                    <div className="flex justify-between items-start">
                       <div className="min-w-0 flex-1 pr-2">
                         <p className="font-bold text-slate-800 text-[15px] leading-tight">{item.nome}</p>
                         {item.observacao && <p className="mt-1 rounded-lg bg-amber-100 px-2 py-1 text-xs font-black leading-snug text-amber-800">OBS: {item.observacao}</p>}
                       </div>
                       <p className="whitespace-nowrap font-black text-emerald-600 text-[15px]">{fmtBRL(item.preco * item.quantidade)}</p>
                    </div>
                    
                    <div className="flex items-center justify-between">
                       <span className="text-sm font-bold text-slate-500">{fmtBRL(item.preco)} un</span>
                       
                       <div className="flex items-center gap-1 bg-slate-300 p-1 rounded-xl">
                          <button onClick={() => handleMinusItem(item)} className="w-10 h-10 flex items-center justify-center bg-white shadow-sm text-slate-600 hover:text-slate-600 rounded-lg active:scale-95 transition-all">
                             {item.quantidade === 1 ? <Trash2 size={18} /> : <Minus size={18} />}
                          </button>
                          <span className="font-black text-lg w-10 text-center text-slate-800">{item.quantidade}</span>
                          <button onClick={() => handleAddItem(item)} className="w-10 h-10 flex items-center justify-center bg-white shadow-sm text-slate-600 hover:text-emerald-600 rounded-lg active:scale-95 transition-all">
                             <Plus size={18} />
                          </button>
                       </div>
                    </div>
                 </div>
               ))
            )}
         </div>

         {/* Rodapé Totais e Botão Cobrar */}
          <div className="bg-white border-t border-slate-200 p-4 sm:p-6 shadow-[0_-10px_20px_rgba(0,0,0,0.02)]">
            <div className="flex justify-between items-center mb-2">
               <span className="text-sm font-bold text-slate-500">Subtotal</span>
               <span className="text-base font-black text-slate-800">{fmtBRL(subtotal)}</span>
            </div>
            {Number(taxaServicoPct) > 0 && (
              <div className="flex justify-between items-center mb-4">
                 <span className="text-sm font-bold text-slate-500">Taxa de Serviço ({Number(taxaServicoPct)}%)</span>
                 <span className="text-base font-black text-slate-800">+{fmtBRL(taxaServicoVal)}</span>
              </div>
            )}
            
            <div className="flex justify-between items-center py-4 mt-2 border-t-2 border-dashed border-slate-200 mb-6">
               <span className="font-black text-2xl text-slate-800 uppercase tracking-tight">Total</span>
               <span className="min-w-0 whitespace-nowrap text-right font-black leading-none text-emerald-600 text-[clamp(1.65rem,7vw,2.5rem)]">{fmtBRL(totalFinal)}</span>
            </div>

            <div className={`grid gap-3 ${isMesa ? "grid-cols-2" : "grid-cols-1"}`}>
              {isMesa && <button
                disabled={itensPendentesCozinha === 0 || enviandoCozinha}
                onClick={handleEnviarCozinha}
                className="min-h-16 rounded-2xl bg-orange-500 px-3 text-sm font-black uppercase tracking-wide text-white shadow-lg transition-all hover:bg-orange-600 disabled:bg-slate-200 disabled:text-slate-500 active:scale-95"
              >{enviandoCozinha ? "Enviando..." : itensPendentesCozinha > 0 ? `Enviar cozinha/bar (${itensPendentesCozinha})` : "Enviado à produção"}</button>}
              <button
                disabled={totalItens === 0}
                onClick={() => { setAjustesAutorizados(false); setModalCheckout(true); }}
                className="min-h-16 rounded-2xl bg-emerald-600 px-3 text-sm font-black uppercase tracking-wide text-white shadow-lg transition-all hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-500 active:scale-95"
              >Pagar {totalItens > 0 ? fmtBRL(totalFinal) : ""}</button>
            </div>

            {isMesa && totalItens > 0 && (
              <button type="button" onClick={imprimirComandaMesa} className="mb-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border-2 border-slate-300 bg-slate-100 px-3 text-sm font-black uppercase text-slate-700 transition-colors hover:bg-slate-200">
                <Printer size={18} /> Reimprimir comanda da mesa
              </button>
            )}
         </div>
      </div>

      {/* MODAL NOVA COMANDA */}
      {modalNovaComanda && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl sm:rounded-[32px] shadow-2xl w-full max-w-md p-4 sm:p-8 animate-in zoom-in-95 duration-200 max-h-[94vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-8">
              <h2 className="font-black text-3xl text-slate-800 tracking-tight">Nova Mesa</h2>
              <button onClick={() => router.push("/dashboard/mesas")} className="text-slate-500 hover:text-slate-800 bg-slate-100 w-12 h-12 rounded-full flex items-center justify-center transition-colors"><X size={24}/></button>
            </div>
            
            <label className="block text-sm font-bold text-slate-500 uppercase tracking-widest mb-3">Nome do Cliente</label>
            <input 
              type="text" 
              autoFocus 
              value={nomeNovoCliente} 
              onChange={e => setNomeNovoCliente(e.target.value)} 
              placeholder="Ex: João da Silva" 
              className="w-full p-5 bg-slate-50 border-2 border-slate-200 rounded-2xl outline-none focus:border-emerald-500 focus:bg-white mb-8 font-black text-xl text-slate-800 transition-colors" 
            />
            
            <button 
              onClick={handleAbrirComanda} 
              disabled={!nomeNovoCliente.trim() || salvando} 
              className="w-full py-5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-black text-lg uppercase tracking-widest rounded-2xl transition-all active:scale-95 shadow-xl shadow-emerald-600/20"
            >
              {salvando ? "Abrindo..." : "Abrir Comanda"}
            </button>
          </div>
        </div>
      )}

      {produtoSelecionado && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/65 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 p-5">
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-emerald-600">Adicionar produto</p>
                <h2 className="mt-1 text-2xl font-black text-slate-800">{produtoSelecionado.nome}</h2>
              </div>
              <button type="button" onClick={() => setProdutoSelecionado(null)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500"><X size={20} /></button>
            </div>
            <div className="max-h-[70vh] overflow-y-auto p-5">
              <p className="text-xs font-black uppercase tracking-widest text-slate-500">Mensagens prontas</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {MENSAGENS_PRONTAS.map(mensagem => {
                  const ativa = mensagensSelecionadas.includes(mensagem);
                  return <button type="button" key={mensagem} onClick={() => setMensagensSelecionadas(atual => ativa ? atual.filter(x => x !== mensagem) : [...atual, mensagem])} className={`rounded-full border-2 px-3 py-2 text-sm font-black transition-colors ${ativa ? "border-amber-500 bg-amber-100 text-amber-800" : "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300"}`}>{mensagem}</button>;
                })}
              </div>
              <label className="mt-5 block">
                <span className="mb-2 block text-xs font-black uppercase tracking-widest text-slate-500">Outra observação</span>
                <textarea rows={3} value={observacaoProduto} onChange={e => setObservacaoProduto(e.target.value)} placeholder="Escreva somente o que vale para este produto" className="w-full resize-none rounded-xl border-2 border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-800 outline-none focus:border-emerald-500" />
              </label>
              <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <button type="button" onClick={() => { handleAddItem(produtoSelecionado, ""); setProdutoSelecionado(null); }} className="min-h-12 rounded-xl bg-slate-100 px-4 text-sm font-black text-slate-700 hover:bg-slate-200">Adicionar sem observação</button>
                <button type="button" onClick={confirmarProduto} className="min-h-12 rounded-xl bg-emerald-600 px-4 text-sm font-black text-white hover:bg-emerald-700">Adicionar produto</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {autorizacao && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-900/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-black text-slate-800">{autorizacao.titulo}</h2>
                <p className="mt-1 text-sm font-bold text-slate-500">{autorizacao.descricao}</p>
              </div>
              <button type="button" onClick={() => setAutorizacao(null)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500"><X size={20} /></button>
            </div>
            <label className="mt-5 block">
              <span className="mb-1.5 block text-xs font-black uppercase tracking-widest text-slate-500">PIN do gerente</span>
              <input type="password" inputMode="numeric" autoFocus value={pinInformado} onChange={e => { setPinInformado(e.target.value); setErroAutorizacao(""); }} className="h-12 w-full rounded-xl border-2 border-slate-200 bg-slate-50 px-4 text-center text-xl font-black tracking-[0.35em] text-slate-800 outline-none focus:border-emerald-500" />
            </label>
            <label className="mt-3 block">
              <span className="mb-1.5 block text-xs font-black uppercase tracking-widest text-slate-500">Motivo obrigatório</span>
              <textarea rows={3} value={motivoAutorizacao} onChange={e => { setMotivoAutorizacao(e.target.value); setErroAutorizacao(""); }} placeholder="Explique por que esta alteração é necessária" className="w-full resize-none rounded-xl border-2 border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-800 outline-none focus:border-emerald-500" />
            </label>
            {erroAutorizacao && <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm font-black text-rose-600">{erroAutorizacao}</p>}
            <button type="button" disabled={autorizando} onClick={confirmarAutorizacao} className="mt-4 min-h-12 w-full rounded-xl bg-slate-900 px-4 text-sm font-black uppercase tracking-wider text-white hover:bg-slate-800 disabled:opacity-50">
              {autorizando ? "Autorizando..." : "Autorizar alteração"}
            </button>
          </div>
        </div>
      )}

      {/* MODAL CHECKOUT / PAGAMENTO */}
      {modalCheckout && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="flex max-h-[94vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-white p-4">
              <div>
                <h2 className="text-2xl font-black tracking-tight text-slate-800">Pagamento</h2>
                <p className="mt-1 text-xs font-bold uppercase tracking-widest text-slate-500">{isMesa ? comandaAberta.nome_cliente : "Venda Balcão"}</p>
              </div>
              <button onClick={() => setModalCheckout(false)} className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-800"><X size={21}/></button>
            </div>

            <div className="flex-1 overflow-y-auto bg-slate-50 p-4">
               <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl bg-emerald-600 p-4 text-white shadow-lg shadow-emerald-600/20">
                 <div>
                   <p className="mb-1 text-xs font-bold uppercase tracking-widest text-emerald-100">Total a Pagar</p>
                   <p className="max-w-full whitespace-nowrap font-black leading-none tracking-tight text-[clamp(1.8rem,8vw,3rem)]">{fmtBRL(totalFinal)}</p>
                 </div>
                 <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-500 shadow-inner">
                   <CreditCard size={24} className="text-white" />
                 </div>
               </div>

               <div className="mb-2 flex items-center justify-between gap-3">
                 <span className="text-xs font-black uppercase tracking-widest text-slate-500">Ajustes protegidos</span>
                 <button type="button" onClick={solicitarLiberacaoAjustes} className={`rounded-lg px-3 py-2 text-xs font-black ${ajustesAutorizados ? "bg-emerald-100 text-emerald-700" : "bg-slate-800 text-white"}`}>
                   {ajustesAutorizados ? "Liberados" : "Liberar com PIN"}
                 </button>
               </div>
               <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
                 <ControleAjuste label="Desconto" valor={desconto} onChange={setDesconto} disabled={!ajustesAutorizados} />
                 <ControleAjuste label="Acréscimo" valor={acrescimo} onChange={setAcrescimo} disabled={!ajustesAutorizados} />
                 <ControleAjuste label="Taxa de serviço" valor={taxaServicoPct} onChange={setTaxaServicoPct} percentual disabled={!ajustesAutorizados} />
               </div>

               <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-slate-500">Escolha a forma</label>
               <div className="mb-4 grid grid-cols-2 gap-2">
                 {[
                   { id: 'dinheiro', icon: Banknote, label: 'Dinheiro' },
                   { id: 'credito', icon: CreditCard, label: 'Cartão Crédito' },
                   { id: 'debito', icon: CreditCard, label: 'Cartão Débito' },
                   { id: 'pix', icon: QrCode, label: 'PIX Instantâneo' }
                 ].map(m => (
                   <button 
                     key={m.id} 
                     onClick={() => setFormaPgto(m.id)} 
                     className={`flex items-center gap-2 rounded-xl border-2 p-3 transition-all duration-200 active:scale-95 ${
                       formaPgto === m.id 
                         ? 'border-emerald-600 bg-white text-emerald-600 font-black shadow-md'
                         : 'border-transparent bg-white text-slate-500 font-bold hover:border-slate-200'
                     }`}
                   >
                     <m.icon size={20} className={formaPgto === m.id ? 'text-emerald-600' : 'text-slate-500'} />
                     <span className="text-sm">{m.label}</span>
                   </button>
                 ))}
               </div>

               <button 
                 onClick={handleConfirmarPagamento} 
                 disabled={salvando || !caixaAtual} 
                 className="flex w-full items-center justify-center gap-3 rounded-xl bg-emerald-500 py-4 text-base font-black uppercase tracking-widest text-white shadow-lg shadow-emerald-500/20 transition-all hover:bg-emerald-600 active:scale-95 disabled:bg-slate-300 disabled:text-slate-500"
               >
                 {salvando ? "Processando..." : (caixaAtual ? `Confirmar ${fmtBRL(totalFinal)}` : "Caixa Fechado")}
               </button>
            </div>
          </div>
        </div>
      )}

      {pagamentoConcluido && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/65 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 text-center shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700"><Printer size={26} /></div>
            <h2 className="text-2xl font-black text-slate-800">Pagamento concluído</h2>
            <p className="mt-2 font-bold text-slate-500">Deseja imprimir o cupom da venda?</p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button type="button" onClick={finalizarPosPagamento} className="min-h-12 rounded-xl bg-slate-100 px-3 text-sm font-black text-slate-700 hover:bg-slate-200">Não imprimir</button>
              <button type="button" onClick={imprimirCupomConcluido} className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 text-sm font-black text-white hover:bg-emerald-700"><Printer size={17} /> Imprimir</button>
            </div>
            <p className="mt-4 text-[11px] font-medium leading-relaxed text-slate-500">A impressão atual é um comprovante da venda. A emissão fiscal oficial exige integração NFC-e/SAT.</p>
          </div>
        </div>
      )}
    </div>
  )
}

export default function VendasPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center font-black text-2xl text-slate-500 bg-slate-50">Iniciando PDV...</div>}>
      <VendasPDVContent />
    </Suspense>
  )
}
