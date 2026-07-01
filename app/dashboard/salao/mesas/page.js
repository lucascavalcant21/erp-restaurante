"use client";

import React, { useState, useEffect, useMemo, useRef, Suspense } from "react";
import { useRouter } from "next/navigation";
import { useERP } from "../../../context/ERPContext";
import { fetchCaixaAberto, abrirCaixa, registrarMovimentacao, fetchResumoCaixa, fecharCaixa } from "../../../lib/caixas";
import { fetchProdutos, lancarVendaBalcao, fetchMesas, criarMesa, fetchPedidoAberto, abrirMesaEPedido, lancarItemComanda, fecharContaDaMesa, fetchGarcons, criarGarcom, fetchProximoNumeroComanda, fetchTodosPedidosAbertos, transferirComanda, validarCupom, fetchObservacoesPadrao, fetchPedidosOnlinePendentes, aceitarPedidoOnline, recusarPedidoOnline, atualizarStatusPedido } from "../../../lib/vendas";
import { Lock, Unlock, LogOut, DollarSign, ArrowDownCircle, ArrowUpCircle, ShoppingBag, ShoppingCart, Maximize, Plus, Minus, Trash2, Printer, Users, Barcode, CreditCard, Receipt, SplitSquareHorizontal, Utensils, Send, X, Settings, Search, CheckCircle, ArrowRightLeft, Share2, Tag, Bell, Clock, MapPin } from "lucide-react";
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from "../../../lib/supabase";
import { fmtBRL, CupomTermico } from "../../../components/ui";

export default function SaloesMesasPage() {
  const { unidadeAtiva, usuarioLogado } = useERP();
  const router = useRouter();
  
  const [loading, setLoading] = useState(true);

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.log(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };
  
  // --- CAIXA STATE ---
  const [caixa, setCaixa] = useState(null);
  const [abaAtiva, setAbaAtiva] = useState('salao'); // 'salao' ou 'balcao'

  const [modalAbrir, setModalAbrir] = useState(false);
  const [fundoCaixa, setFundoCaixa] = useState("");
  const [modalMov, setModalMov] = useState(false);
  const [tipoMov, setTipoMov] = useState("");
  const [valorMov, setValorMov] = useState("");
  const [descMov, setDescMov] = useState("");
  const [modalFechamento, setModalFechamento] = useState(false);
  const [resumoZ, setResumoZ] = useState(null);

  // --- PRODUTOS ---
  const [produtos, setProdutos] = useState([]);
  const [filtroCategoria, setFiltroCategoria] = useState("Todas");
  const [buscaProd, setBuscaProd] = useState("");
  const buscaRef = useRef(null);

  // --- BALCÃO STATE ---
  const [carrinho, setCarrinho] = useState([]);
  const [modoViagem, setModoViagem] = useState(false);
  const [modalMod, setModalMod] = useState(false);
  const [prodModAtual, setProdModAtual] = useState(null);
  const [modsSelecionados, setModsSelecionados] = useState([]);
  
  // --- SALÃO STATE ---
  const [mesas, setMesas] = useState([]);
  const [mesaAtiva, setMesaAtiva] = useState(null);
  const [pedidoAtivo, setPedidoAtivo] = useState(null);
  
  // --- IMPRESSÃO TÉRMICA ---
  const [cupomParaImprimir, setCupomParaImprimir] = useState(null); // { pedido, tipo: 'parcial' | 'final' }

  useEffect(() => {
    if (cupomParaImprimir) {
      setTimeout(() => {
        window.print();
        // Opcional: limpar após imprimir para não ficar na tela (comentado para o dev ver a tira se quiser)
        // setCupomParaImprimir(null);
      }, 500);
    }
  }, [cupomParaImprimir]);
  const [pedidosDaMesa, setPedidosDaMesa] = useState([]);
  const [modalListaComandas, setModalListaComandas] = useState(false);
  const [modalTransferir, setModalTransferir] = useState(false);
  const [modalGestaoMesas, setModalGestaoMesas] = useState(false);
  const [novaMesaNum, setNovaMesaNum] = useState("");
  const [qrMesa, setQrMesa] = useState(null); // Mesa para imprimir QR Code

  const [garcons, setGarcons] = useState([]);
  const [modalGarcom, setModalGarcom] = useState(false);
  const [garcomAtivo, setGarcomAtivo] = useState(null);
  const [modalComanda, setModalComanda] = useState(false);
  const [identAtiva, setIdentAtiva] = useState("");
  const [modalGestaoGarcons, setModalGestaoGarcons] = useState(false);
  const [novoGarcomNome, setNovoGarcomNome] = useState("");

  const [modalLancar, setModalLancar] = useState(false);
  const [produtoSel, setProdutoSel] = useState("");
  const [qtdLancamento, setQtdLancamento] = useState(1);
  const [obsLancamento, setObsLancamento] = useState("");
  const [modsLancarMesa, setModsLancarMesa] = useState([]);
  const [observacoesPadrao, setObservacoesPadrao] = useState([]);

  // --- PAGAMENTO STATE ---
  const [modalPagamento, setModalPagamento] = useState(false);
  const [processando, setProcessando] = useState(false);
  const [emitirNFCe, setEmitirNFCe] = useState(false);
  
  const [pagamentos, setPagamentos] = useState([{ id: 1, forma: 'dinheiro', valor: 0 }]);
  const [descontoPerc, setDescontoPerc] = useState("");
  const [descontoRs, setDescontoRs] = useState("");
  const [taxaExtra, setTaxaExtra] = useState("");
  const [clienteCpf, setClienteCpf] = useState("");
  const [clienteNome, setClienteNome] = useState("");
  const [cupomDigitado, setCupomDigitado] = useState("");
  const [cupomAplicado, setCupomAplicado] = useState(null);

  // --- RECIBO ---
  const [modalRecibo, setModalRecibo] = useState(false);
  const [dadosRecibo, setDadosRecibo] = useState(null);

  // --- FUNÇÃO GLOBAL DE IMPRESSÃO TÉRMICA (POP-UP) ---
  const abrirCupomTermico = (dados) => {
     const win = window.open('', '_blank', 'width=320,height=600');
     if (!win) return alert("Habilite os popups para imprimir o cupom.");
     
     const pagamentosHtml = dados.recebidos && dados.recebidos.length > 0 ? `
        <div class="sep"></div>
        <div class="center bold" style="margin-top:4px;">PAGAMENTOS</div>
        ${dados.recebidos.map(p => `<div class="row"><span>${p.forma.toUpperCase()}</span><span>R$${p.valor.toFixed(2)}</span></div>`).join('')}
        ${dados.troco > 0 ? `<div class="row"><span>TROCO</span><span>R$${dados.troco.toFixed(2)}</span></div>` : ''}
     ` : '';

     const itensHtml = dados.itens.map(it => `
        <div class="row">
           <span class="name">${it.nome}</span>
           <span class="qtd">${it.qtd}</span>
           <span class="val">R$${it.tot.toFixed(2)}</span>
        </div>
     `).join('');

     const taxaHtml = dados.taxa > 0 ? `<div class="row"><span>TAXA SERVIÇO</span><span>R$${dados.taxa.toFixed(2)}</span></div>` : '';
     const descontoHtml = dados.desconto > 0 ? `<div class="row"><span>DESCONTO</span><span>-R$${dados.desconto.toFixed(2)}</span></div>` : '';

     const mesaOuBalcao = dados.tipo === 'salao' ? `MESA ${dados.mesa}` : 'VENDA BALCÃO';
     
     let tituloRecibo = dados.isPreConta ? 'CONFERÊNCIA DE CONTA' : 'RECIBO NÃO FISCAL';
     let nfceHtml = '';
     
     if (dados.nfce) {
        tituloRecibo = 'DOCUMENTO AUXILIAR DA NOTA FISCAL DE CONSUMIDOR ELETRÔNICA';
        nfceHtml = `
           <div class="sep"></div>
           <div class="center" style="font-size:9px; margin-top:8px;">
              <p class="bold mb-1">EMISSÃO DE NFC-e</p>
              <p>Chave de Acesso:</p>
              <p style="word-break: break-all;">${dados.nfce.chave_acesso}</p>
              <p class="mt-2"><a href="${dados.nfce.url_pdf}" target="_blank">Consultar pela Chave de Acesso</a></p>
           </div>
        `;
     }

     win.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
           <meta charset="utf-8"/>
           <title>Cupom Térmico</title>
           <style>
              * { margin:0; padding:0; box-sizing:border-box; }
              body { font-family: 'Courier New', monospace; font-size: 11px; width: 80mm; padding: 4mm; color: #000; }
              .center { text-align: center; }
              .bold { font-weight: bold; }
              .big { font-size: 14px; }
              .sep { border-top: 1px dashed #000; margin: 6px 0; }
              .row { display: flex; justify-content: space-between; }
              .row .name { flex: 1; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
              .row .qtd { width: 25px; text-align: center; }
              .row .val { width: 55px; text-align: right; }
              .total-row { font-size: 14px; font-weight: bold; }
              @media print {
                 @page { margin: 0; size: 80mm auto; }
                 body { width: 80mm; }
              }
           </style>
        </head>
        <body>
           <div class="center bold big">HEFISTO ERP</div>
           <div class="center">${tituloRecibo}</div>
           <div class="center">${mesaOuBalcao}</div>
           <div class="center" style="font-size:10px">${dados.data.toLocaleString()}</div>
           <div class="sep"></div>
           <div class="row bold">
              <span class="name">DESCRIÇÃO</span>
              <span class="qtd">QTD</span>
              <span class="val">TOTAL</span>
           </div>
           <div class="sep"></div>
           ${itensHtml}
           <div class="sep"></div>
           <div class="row"><span>SUBTOTAL</span><span>R$${dados.subtotal.toFixed(2)}</span></div>
           ${taxaHtml}
           ${descontoHtml}
           <div class="sep"></div>
           <div class="row total-row"><span>TOTAL GERAL</span><span>R$${dados.total.toFixed(2)}</span></div>
           ${pagamentosHtml}
           ${nfceHtml}
           <div class="sep"></div>
           <div class="center" style="margin-top:10px; font-size:10px;">
              Obrigado pela preferência!<br>
              Sistema Hefisto ERP
           </div>
           <script>
              window.onload = function() { window.print(); window.close(); }
           </script>
        </body>
        </html>
     `);
     win.document.close();
  };

  // --- FECHAMENTO AVANÇADO ---
  const [aplicarDezPorcento, setAplicarDezPorcento] = useState(true);
  const [quantidadePessoas, setQuantidadePessoas] = useState(1);

  // --- PEDIDOS ONLINE (QR CODE) ---
  const [pedidosOnline, setPedidosOnline] = useState([]);
  const [showAlertaOnline, setShowAlertaOnline] = useState(false);
  const audioRef = useRef(null);
  const [painelOnline, setPainelOnline] = useState(false);
  const [pedidosOnlineDetalhes, setPedidosOnlineDetalhes] = useState([]);
  const [carregandoPainel, setCarregandoPainel] = useState(false);

  // ==========================================
  // INITIAL LOAD
  // ==========================================
  const carregarTudo = async () => {
    setLoading(true);
    if (!unidadeAtiva) return;

    const { data: cx } = await fetchCaixaAberto(unidadeAtiva);
    setCaixa(cx);
    
    if (cx) {
      const { data: prods } = await fetchProdutos(unidadeAtiva);
      setProdutos(prods || []);
      const { data: grc } = await fetchGarcons(unidadeAtiva);
      setGarcons(grc || []);
      await carregarMesas();
    }
    setLoading(false);
  };

  const carregarMesas = async () => {
    const { data: m } = await fetchMesas(unidadeAtiva);
    const { data: obsData } = await fetchObservacoesPadrao(unidadeAtiva);
    setObservacoesPadrao(obsData || []);
    const mesasSanitizadas = (m || []).map((mesa, index) => {
       if (mesa.numero_mesa === 'Mesa Antiga' || !mesa.numero_mesa) {
          return { ...mesa, numero_mesa: String(index + 1).padStart(2, '0') };
       }
       return mesa;
    });
    setMesas(mesasSanitizadas);
  };

  useEffect(() => {
    carregarTudo();
  }, [unidadeAtiva]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
       const urlParams = new URLSearchParams(window.location.search);
       if (urlParams.get('acao') === 'garcom') {
          setModalGarcom(true);
          router.replace('/dashboard/salao/mesas');
       }
    }
  }, [router]);

  // --- REALTIME: escuta novos pedidos QR Code ---
  useEffect(() => {
    if (!unidadeAtiva) return;

    const channel = supabase
      .channel(`pedidos_online_${unidadeAtiva}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'pedidos',
          filter: `unidade_id=eq.${unidadeAtiva}`
        },
        (payload) => {
          const novo = payload.new;
          if (novo.status === 'novo_online') {
            setPedidosOnline(prev => [novo, ...prev]);
            setShowAlertaOnline(true);
            // Som de alerta
            try {
              const ctx = new (window.AudioContext || window.webkitAudioContext)();
              const osc = ctx.createOscillator();
              const gain = ctx.createGain();
              osc.connect(gain);
              gain.connect(ctx.destination);
              osc.frequency.setValueAtTime(880, ctx.currentTime);
              osc.frequency.setValueAtTime(660, ctx.currentTime + 0.15);
              osc.frequency.setValueAtTime(880, ctx.currentTime + 0.3);
              gain.gain.setValueAtTime(0.3, ctx.currentTime);
              gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
              osc.start(ctx.currentTime);
              osc.stop(ctx.currentTime + 0.6);
            } catch(e) {}
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [unidadeAtiva]);

  const abrirPainelOnline = async () => {
    setPainelOnline(true);
    setCarregandoPainel(true);
    const { data } = await fetchPedidosOnlinePendentes(unidadeAtiva);
    setPedidosOnlineDetalhes(data || []);
    setCarregandoPainel(false);
    setShowAlertaOnline(false);
    setPedidosOnline([]);
  };

  const handleAceitarPedido = async (pedidoId) => {
    await aceitarPedidoOnline(pedidoId);
    setPedidosOnlineDetalhes(prev => prev.map(p =>
      p.id === pedidoId ? { ...p, status: 'preparando_delivery' } : p
    ));
  };

  const handleRecusarPedido = async (pedidoId) => {
    if(!confirm('Recusar este pedido?')) return;
    await recusarPedidoOnline(pedidoId);
    setPedidosOnlineDetalhes(prev => prev.filter(p => p.id !== pedidoId));
  };

  const handleChamarTV = async (pedidoId) => {
    await atualizarStatusPedido(pedidoId, 'pronto');
    setPedidosOnlineDetalhes(prev => prev.map(p =>
      p.id === pedidoId ? { ...p, status: 'pronto' } : p
    ));
  };

  const handleEntregue = async (pedidoId) => {
    await atualizarStatusPedido(pedidoId, 'entregue');
    setPedidosOnlineDetalhes(prev => prev.filter(p => p.id !== pedidoId));
  };

  useEffect(() => {
    if(caixa && abaAtiva === 'balcao' && buscaRef.current) {
       buscaRef.current.focus();
    }
  }, [caixa, abaAtiva]);

  // ==========================================
  // CAIXA ACTIONS
  // ==========================================
  const handleAbrirCaixa = async (e) => {
    e.preventDefault();
    setProcessando(true);
    const { error } = await abrirCaixa(unidadeAtiva, usuarioLogado?.id, fundoCaixa);
    setProcessando(false);
    if (error) return alert(error);
    setModalAbrir(false);
    carregarTudo();
  };

  const handleMovimentacao = async (e) => {
    e.preventDefault();
    if(!valorMov || !descMov) return alert("Preencha o valor e o motivo.");
    setProcessando(true);
    const { error } = await registrarMovimentacao(caixa.id, unidadeAtiva, tipoMov, valorMov, descMov);
    setProcessando(false);
    if (error) return alert(error);
    setModalMov(false);
    alert(`${tipoMov.toUpperCase()} registrada com sucesso!`);
    setValorMov(""); setDescMov("");
  };

  const abrirFechamento = async () => {
    setProcessando(true);
    const { data, error } = await fetchResumoCaixa(caixa.id);
    setProcessando(false);
    if (error) return alert(error);
    setResumoZ(data);
    setModalFechamento(true);
  };

  const confirmarFechamento = async () => {
    if(!confirm("Encerrar o turno atual? Novas vendas não serão permitidas.")) return;
    setProcessando(true);
    const { error } = await fecharCaixa(caixa.id);
    setProcessando(false);
    if (error) return alert("Erro ao fechar: " + error);
    alert("Turno Encerrado!");
    setModalFechamento(false);
    setCaixa(null);
  };

  // ==========================================
  // SALÃO ACTIONS
  // ==========================================
  const handleCriarMesa = async () => {
    const num = prompt("Número da nova mesa:");
    if(!num) return;
    await criarMesa(unidadeAtiva, Number(num));
    carregarMesas();
  };

  const clicarMesa = async (mesa) => {
    setMesaAtiva(mesa);
    if(mesa.status === 'livre') {
       if (garcomAtivo) {
          const proxId = await fetchProximoNumeroComanda(mesa.id, mesa.numero_mesa);
          setIdentAtiva(proxId);
          setModalComanda(true);
       } else {
          setModalGarcom(true);
       }
    } else {
       setProcessando(true);
       const { data, error } = await fetchTodosPedidosAbertos(mesa.id);
       setProcessando(false);
       if (error) {
          alert("Erro ao buscar comandas: " + error);
          return;
       }
       setPedidosDaMesa(data);
       setModalListaComandas(true);
    }
  };

  const prepararLancamentoMesa = () => {
    setProdutoSel("");
    setQtdLancamento(1);
    setObsLancamento("");
    setModsLancarMesa([]);
    setModalLancar(true);
  };

  const confirmarLancamentoMesa = async () => {
    if(!produtoSel) return alert("Selecione um produto");
    const prodObj = produtos.find(p => p.id === produtoSel);
    
    let basePrice = Number(prodObj.preco_venda || prodObj.preco || 0);
    const modsPrice = modsLancarMesa.reduce((acc, m) => acc + Number(m.preco || 0), 0);
    
    let obsFinal = obsLancamento || '';
    if(modsLancarMesa.length > 0) {
       const modsTxt = modsLancarMesa.map(m => `+${m.nome}`).join(', ');
       obsFinal = obsFinal ? `${obsFinal} (${modsTxt})` : modsTxt;
    }

    setProcessando(true);
    await lancarItemComanda(pedidoAtivo.id, prodObj.id, basePrice + modsPrice, qtdLancamento, obsFinal);
    setProcessando(false);
    setModalLancar(false);
    const { data } = await fetchPedidoAberto(mesaAtiva.id);
    setPedidoAtivo(data);
  };

  const toggleModLancarMesa = (mod) => {
     setModsLancarMesa(prev => {
        const existe = prev.find(m => m.nome === mod.nome);
        if(existe) return prev.filter(m => m.nome !== mod.nome);
        return [...prev, mod];
     });
  };

  // ==========================================
  // BALCÃO ACTIONS
  // ==========================================
  const produtosFiltrados = useMemo(() => {
    let p = produtos;
    if (filtroCategoria !== "Todas") p = p.filter(x => (x.categoria || "Sem Categoria") === filtroCategoria);
    if (buscaProd) p = p.filter(x => x.nome_produto.toLowerCase().includes(buscaProd.toLowerCase()) || x.codigo_barras === buscaProd);
    return p;
  }, [produtos, filtroCategoria, buscaProd]);

  const addAoCarrinho = (prod, mods = []) => {
    setCarrinho(prev => {
      const modsKey = mods.map(m => m.nome).sort().join('|');
      const uniqueId = `${prod.id}-${modsKey}`;
      const existente = prev.find(i => i.uniqueId === uniqueId);
      if (existente) return prev.map(i => i.uniqueId === uniqueId ? { ...i, quantidade: i.quantidade + 1 } : i);
      return [...prev, { ...prod, uniqueId, quantidade: 1, modsSelecionados: mods }];
    });
  };

  const handleSelecionarProdutoBalcao = (prod) => {
     if(prod.modificadores && prod.modificadores.length > 0) {
        setProdModAtual(prod);
        setModsSelecionados([]);
        setModalMod(true);
     } else {
        addAoCarrinho(prod, []);
     }
  };

  const confirmarMods = () => {
     addAoCarrinho(prodModAtual, modsSelecionados);
     setModalMod(false);
     setProdModAtual(null);
     setModsSelecionados([]);
  };

  const toggleMod = (mod) => {
     setModsSelecionados(prev => {
        const existe = prev.find(m => m.nome === mod.nome);
        if(existe) return prev.filter(m => m.nome !== mod.nome);
        return [...prev, mod];
     });
  };

  const alterarQtd = (uniqueId, delta) => {
    setCarrinho(prev => prev.map(i => i.uniqueId === uniqueId ? { ...i, quantidade: Math.max(1, i.quantidade + delta) } : i));
  };

  const removerItem = (uniqueId) => {
    setCarrinho(prev => prev.filter(i => i.uniqueId !== uniqueId));
  };

  const checkBipeBusca = (e) => {
     if(e.key === 'Enter' && buscaProd) {
        const prodMatch = produtosFiltrados.find(p => p.codigo_barras === buscaProd || p.nome_produto.toLowerCase() === buscaProd.toLowerCase());
        if(prodMatch) {
           handleSelecionarProdutoBalcao(prodMatch);
           setBuscaProd(""); 
        }
     }
  };

  const totalCarrinho = useMemo(() => carrinho.reduce((a, i) => {
     const base = Number(i.preco_venda || i.preco || 0);
     const modsPrice = (i.modsSelecionados || []).reduce((acc, m) => acc + Number(m.preco || 0), 0);
     return a + ((base + modsPrice) * i.quantidade);
  }, 0), [carrinho]);

  // ==========================================
  // PAGAMENTO (MEGAZORD)
  // ==========================================
  const abrirModalPagamento = () => {
     let sub = 0;
     if(abaAtiva !== 'salao') sub = totalCarrinho;
     else if(abaAtiva === 'salao' && pedidoAtivo) {
        sub = pedidoAtivo.pedidos_itens?.reduce((acc, it) => acc + (it.valor_unitario * it.quantidade), 0) || 0;
     }

     if(sub <= 0) return alert("Valor zerado!");

     setDescontoPerc(""); setDescontoRs(""); setTaxaExtra(""); setClienteCpf(""); setClienteNome(""); setQuantidadePessoas(1);
     setCupomDigitado(""); setCupomAplicado(null);
     
     let taxa10 = aplicarDezPorcento && abaAtiva === 'salao' ? sub * 0.10 : 0;
     let totalAberto = sub + taxa10;

     setPagamentos([{ id: Date.now(), forma: 'dinheiro', valor: totalAberto }]);
     setModalPagamento(true);
  };

  const handleAplicarCupom = async () => {
     if(!cupomDigitado) return;
     setProcessando(true);
     const { cupom, error } = await validarCupom(unidadeAtiva, cupomDigitado);
     setProcessando(false);
     
     if (error) {
        alert(error);
        setCupomDigitado("");
        return;
     }

     setCupomAplicado(cupom);
     if (cupom.tipo === 'percentual') {
        setDescontoPerc(cupom.valor);
        setDescontoRs("");
     } else {
        setDescontoRs(cupom.valor);
        setDescontoPerc("");
     }
  };

  const checkBipeCupom = (e) => {
     if (e.key === 'Enter') handleAplicarCupom();
  };

  const subtotalPagamento = useMemo(() => {
     let sub = 0;
     if(abaAtiva !== 'salao') sub = totalCarrinho;
     else if(abaAtiva === 'salao' && pedidoAtivo) {
        sub = pedidoAtivo.pedidos_itens?.reduce((acc, it) => acc + (it.valor_unitario * it.quantidade), 0) || 0;
     }
     return sub;
  }, [abaAtiva, totalCarrinho, pedidoAtivo]);

  const valorTotalFinal = useMemo(() => {
     let v = subtotalPagamento;
     const desc = Number(descontoRs) || (v * (Number(descontoPerc)/100)) || 0;
     const taxaFixa = Number(taxaExtra) || 0;
     const taxaDezPorcento = aplicarDezPorcento && abaAtiva === 'salao' ? (v - desc) * 0.10 : 0;
     return v - desc + taxaFixa + taxaDezPorcento;
  }, [subtotalPagamento, descontoRs, descontoPerc, taxaExtra, aplicarDezPorcento, abaAtiva]);

  const somaPagamentos = useMemo(() => pagamentos.reduce((acc, p) => acc + Number(p.valor || 0), 0), [pagamentos]);
  const troco = Math.max(0, somaPagamentos - valorTotalFinal);
  const restante = Math.max(0, valorTotalFinal - somaPagamentos);

  const finalizarVenda = async (e) => {
     e.preventDefault();
     if(somaPagamentos < valorTotalFinal) return alert(`Falta receber ${fmtBRL(restante)}`);

     setProcessando(true);

     let recebimentosReais = [];
     let valorProcessado = 0;
     for(let i = 0; i < pagamentos.length; i++) {
        let p = pagamentos[i];
        let valPago = Number(p.valor);
        if(valPago <= 0) continue;
        if(p.forma === 'dinheiro' && troco > 0 && valorProcessado + valPago > valorTotalFinal) {
           valPago = valPago - troco; 
        }
        recebimentosReais.push({ forma: p.forma, valor: valPago });
        valorProcessado += valPago;
     }

     const pagamentoData = {
        principal: recebimentosReais[0]?.forma || 'misto',
        split: recebimentosReais,
        desconto: Number(descontoRs) || (subtotalPagamento * (Number(descontoPerc)/100)) || 0,
        taxa: Number(taxaExtra) || 0,
        cpf: clienteCpf,
        nome: clienteNome
     };

     let sucesso = false;
     let pedidoIdParaRecibo = null;

     if(abaAtiva !== 'salao') {
        const itensMapeados = carrinho.map(i => ({ ...i, preco_venda: i.preco_venda || i.preco || 0 }));
        const { error, data } = await lancarVendaBalcao(unidadeAtiva, caixa.id, itensMapeados, pagamentoData, abaAtiva);
        if(error) alert(error);
        else { sucesso = true; pedidoIdParaRecibo = data.id; }
     } else {
        const { error } = await fecharContaDaMesa(mesaAtiva.id, pedidoAtivo.id, unidadeAtiva, caixa.id, pagamentoData);
        if(error) alert(error);
        else { sucesso = true; pedidoIdParaRecibo = pedidoAtivo.id; }
     }

     setProcessando(false);

     if(sucesso) {
        let nfcePayload = null;
        if (emitirNFCe) {
           try {
              const resNF = await fetch('/api/fiscal/emitir', {
                 method: 'POST',
                 headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify({
                    pedido_id: pedidoIdParaRecibo,
                    unidade_id: unidadeAtiva,
                    cpf_cliente: clienteCpf
                 })
              });
              const dataNF = await resNF.json();
              if (dataNF.success) {
                 nfcePayload = dataNF.nota;
              } else {
                 alert("Atenção: Venda fechada, mas erro ao emitir NFC-e: " + dataNF.error);
              }
           } catch (err) {
              console.error(err);
              alert("Erro ao tentar emitir NFC-e. A venda foi registrada.");
           }
        }

        const itensRecibo = abaAtiva !== 'salao' 
          ? carrinho.map(i => ({ nome: i.nome_produto, qtd: i.quantidade, tot: i.quantidade * (i.preco_venda||0) }))
          : pedidoAtivo.pedidos_itens.map(i => ({ nome: i.produtos?.nome_produto || 'Item', qtd: i.quantidade, tot: i.quantidade * i.valor_unitario }));

        const objRecibo = {
           id: pedidoIdParaRecibo,
           tipo: abaAtiva,
           isPreConta: false,
           mesa: mesaAtiva?.numero_mesa,
           itens: itensRecibo,
           subtotal: subtotalPagamento,
           desconto: pagamentoData.desconto,
           taxa: pagamentoData.taxa,
           total: valorTotalFinal,
           recebidos: recebimentosReais,
           troco: troco,
           cliente: clienteNome,
           cpf: clienteCpf,
           data: new Date(),
           nfce: nfcePayload
        };

        setDadosRecibo(objRecibo);

        setModalPagamento(false);
        if(abaAtiva !== 'salao') setCarrinho([]);
        if(abaAtiva === 'salao') { setMesaAtiva(null); setPedidoAtivo(null); carregarMesas(); }
        setModalRecibo(true);

        // IMPRESSÃO TÉRMICA AUTOMÁTICA AO FINALIZAR!
        abrirCupomTermico(objRecibo);
     }
  };

  const imprimirPreConta = () => {
    if (!pedidoAtivo) return;
    const desc = Number(descontoRs) || (subtotalPagamento * (Number(descontoPerc)/100)) || 0;
    const taxaFixa = Number(taxaExtra) || 0;
    const taxaDezPorcento = aplicarDezPorcento && abaAtiva === 'salao' ? (subtotalPagamento - desc) * 0.10 : 0;
    
    const itensRecibo = pedidoAtivo.pedidos_itens.map(i => ({ nome: i.produtos?.nome_produto || 'Item', qtd: i.quantidade, tot: i.quantidade * i.valor_unitario }));

    const dadosPrev = {
       id: pedidoAtivo.id,
       tipo: 'salao',
       isPreConta: true,
       mesa: mesaAtiva?.numero_mesa,
       itens: itensRecibo,
       subtotal: subtotalPagamento,
       desconto: desc,
       taxa: taxaFixa + taxaDezPorcento,
       total: valorTotalFinal,
       recebidos: [],
       troco: 0,
       cliente: clienteNome,
       cpf: clienteCpf,
       data: new Date()
    };
    
    setDadosRecibo(dadosPrev);
    setModalRecibo(true);

    // Imprime automaticamente o Popup Térmico
    abrirCupomTermico(dadosPrev);
 };

  // Envia o pedido para a cozinha: imprime a via de produção (sem precos) e
  // confirma no KDS. Os itens ja entram no KDS ao serem lancados (status
  // 'pendente'), entao aqui a acao principal e imprimir a via da cozinha.
  const enviarParaCozinha = () => {
    if (!pedidoAtivo || !(pedidoAtivo.pedidos_itens?.length > 0)) {
       return alert("Nenhum item para enviar para a cozinha.");
    }
    const itens = pedidoAtivo.pedidos_itens.map(i => ({
       nome: i.produtos?.nome_produto || 'Item',
       qtd: i.quantidade,
       obs: i.observacao || ''
    }));
    const win = window.open('', '_blank', 'width=320,height=600');
    if (!win) return alert("Habilite os popups para imprimir a via da cozinha.");

    const agora = new Date().toLocaleString('pt-BR');
    const itensHtml = itens.map(it => `
       <div class="item">
          <span class="q">${it.qtd}x</span> <span class="n">${it.nome}</span>
          ${it.obs ? `<div class="obs">OBS: ${it.obs}</div>` : ''}
       </div>`).join('');

    win.document.write(`
       <!DOCTYPE html><html><head><meta charset="utf-8"/><title>Via da Cozinha</title>
       <style>
          *{margin:0;padding:0;box-sizing:border-box}
          body{font-family:'Courier New',monospace;width:80mm;padding:4mm;color:#000}
          .center{text-align:center}.big{font-size:20px;font-weight:bold}
          .sep{border-top:1px dashed #000;margin:8px 0}
          .item{font-size:16px;font-weight:bold;margin:8px 0}
          .item .q{font-size:19px}
          .obs{font-size:12px;font-weight:normal;margin:2px 0 0 6px}
          @media print{@page{margin:0;size:80mm auto}}
       </style></head><body>
          <div class="center big">COZINHA</div>
          <div class="center">${mesaAtiva?.numero_mesa ? 'MESA ' + mesaAtiva.numero_mesa : 'PEDIDO'}</div>
          <div class="center" style="font-size:10px">${agora}</div>
          <div class="sep"></div>
          ${itensHtml}
          <div class="sep"></div>
       </body></html>`);
    win.document.close();
    setTimeout(() => { win.print(); }, 300);
 };

  // ==========================================
  // RENDERS
  // ==========================================
  if (loading) return <div className="p-6 flex justify-center text-slate-500 font-bold">Carregando Frente de Loja...</div>;

  // --- BLOQUEADO SE CAIXA FECHADO ---
  if (!caixa) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-100 min-h-[calc(100vh-72px)] p-6">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 shadow-2xl text-center border border-slate-100">
           <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-6">
             <Lock size={32} className="text-emerald-500" />
           </div>
           <h2 className="text-2xl font-black text-slate-800 mb-2">Caixa Principal Fechado</h2>
           <p className="text-slate-500 font-medium mb-8">Para atender mesas ou vender no balcão, você precisa abrir o turno declarando o fundo de gaveta.</p>
           
           {!modalAbrir ? (
             <button onClick={() => setModalAbrir(true)} className="w-full bg-slate-800 hover:bg-slate-900 text-white font-black py-4 rounded-xl flex items-center justify-center gap-2 transition-transform shadow-lg">
               <Unlock size={20} /> ABRIR CAIXA
             </button>
           ) : (
             <form onSubmit={handleAbrirCaixa} className="text-left animate-in fade-in">
                <div className="mb-4">
                   <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Fundo Inicial (Em Gaveta)</label>
                   <input type="number" step="0.01" required min="0" value={fundoCaixa} onChange={e => setFundoCaixa(e.target.value)}
                     className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-black text-2xl text-emerald-600 outline-none focus:ring-2 focus:ring-emerald-500" placeholder="0.00" autoFocus />
                </div>
                <div className="flex gap-3 mt-6">
                   <button type="button" onClick={() => setModalAbrir(false)} className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-100 rounded-xl">Voltar</button>
                   <button type="submit" disabled={processando} className="flex-1 bg-emerald-500 text-white font-black py-3 rounded-xl shadow-md">Confirmar</button>
                </div>
             </form>
           )}
        </div>
      </div>
    );
  }

  // --- CAIXA ABERTO ---
  return (
    <div className="flex flex-col h-[calc(100vh-72px)] bg-slate-100 overflow-hidden font-sans">
      
      {/* BANNER DE ALERTA — PEDIDO NOVO VIA QR CODE */}
      {showAlertaOnline && pedidosOnline.length > 0 && (
        <div className="bg-gradient-to-r from-orange-500 to-rose-500 text-white px-4 py-3 flex items-center justify-between z-50 shadow-lg animate-pulse shrink-0">
          <div className="flex items-center gap-3 font-bold">
            <Bell size={22} />
            <div>
              <p className="font-black text-sm uppercase tracking-widest">
                Novo Pedido pelo QR Code!
              </p>
              <p className="text-orange-100 text-xs font-medium">
                {pedidosOnline[0]?.cliente_nome || 'Cliente'} — 
                Mesa/Tipo: {pedidosOnline[0]?.tipo_pedido?.toUpperCase()}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={abrirPainelOnline}
              className="bg-white text-orange-600 font-black text-xs px-4 py-2 rounded-xl hover:bg-orange-50 transition-colors shadow-sm"
            >
              Ver Pedidos ({pedidosOnline.length})
            </button>
            <button
              onClick={() => { setShowAlertaOnline(false); setPedidosOnline([]); }}
              className="p-1.5 hover:bg-white/20 rounded-full transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )}

      {/* HEADER DE COMANDO */}
      <header className="bg-slate-800 text-white px-4 py-3 flex items-center justify-between shrink-0 shadow-lg z-20">
         <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-emerald-400">
               <DollarSign size={20} />
            </div>
            <div>
               <h1 className="text-sm font-black tracking-widest uppercase">Frente de Loja</h1>
               <div className="flex items-center gap-2 mt-0.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span className="text-[10px] font-bold text-slate-300 uppercase">Turno Aberto</span>
               </div>
            </div>
            
            <div className="ml-8 bg-black/20 p-1 rounded-xl flex gap-1 items-center">
               <button onClick={() => setAbaAtiva('salao')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${abaAtiva === 'salao' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-300 hover:text-white'}`}>
                  <Users size={14} /> Salão (Mesas)
               </button>
               <button onClick={() => setAbaAtiva('balcao')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${abaAtiva === 'balcao' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-300 hover:text-white'}`}>
                  <ShoppingBag size={14} /> Balcão Rápido
               </button>
               <button onClick={() => setAbaAtiva('ifood')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${abaAtiva === 'ifood' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-300 hover:text-white'}`}>
                  <Utensils size={14} /> iFood
               </button>
               <button onClick={() => setAbaAtiva('cardapio')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${abaAtiva === 'cardapio' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-300 hover:text-white'}`}>
                  <ShoppingBag size={14} /> Cardápio Digital
               </button>
            </div>
         </div>

         <div className="flex gap-2">
            <button onClick={abrirPainelOnline} className="relative flex items-center gap-1.5 px-3 py-2 bg-white/10 hover:bg-white/20 font-bold text-xs rounded-lg transition-colors text-white">
               <Bell size={16} /> Pedidos Online
               {pedidosOnline.length > 0 && (
                 <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] font-black w-5 h-5 flex items-center justify-center rounded-full animate-bounce">
                   {pedidosOnline.length}
                 </span>
               )}
            </button>
            <button onClick={() => {
               const url = `${window.location.origin}/delivery/${unidadeAtiva}`;
               navigator.clipboard.writeText(url);
               alert("Link do cardápio copiado para enviar aos clientes!");
            }} className="flex items-center gap-1.5 px-3 py-2 bg-white/10 hover:bg-white/20 font-bold text-xs rounded-lg transition-colors text-white">
               <Share2 size={16} /> Copiar Link
            </button>
            <button onClick={toggleFullScreen} className="flex items-center gap-1.5 px-3 py-2 bg-white/10 hover:bg-white/20 font-bold text-xs rounded-lg transition-colors text-white">
               <Maximize size={16} /> Tela Cheia
            </button>
            <button onClick={() => { setTipoMov('suprimento'); setModalMov(true); }} className="flex items-center gap-1.5 px-3 py-2 bg-white/10 hover:bg-white/20 font-bold text-xs rounded-lg transition-colors text-blue-300">
               <ArrowUpCircle size={16} /> Suprimento
            </button>
            <button onClick={() => { setTipoMov('sangria'); setModalMov(true); }} className="flex items-center gap-1.5 px-3 py-2 bg-white/10 hover:bg-white/20 font-bold text-xs rounded-lg transition-colors text-orange-300">
               <ArrowDownCircle size={16} /> Sangria
            </button>
            <button onClick={abrirFechamento} className="flex items-center gap-1.5 px-4 py-2 bg-red-500 hover:bg-red-600 font-black text-xs rounded-lg shadow transition-colors ml-4">
               <LogOut size={16} /> Fechar Caixa
            </button>
         </div>
      </header>

      {/* BODY PRINCIPAL */}
      <div className="flex flex-1 overflow-hidden">
         
         {/* SE ESTIVER NO SALÃO E UMA MESA ESTIVER ABERTA (MODO PDV/POS) */}
         {abaAtiva === 'salao' && mesaAtiva && pedidoAtivo ? (
            <>
               {/* SIDEBAR ESQUERDA: DETALHES DA CONTA */}
               <div className="w-[320px] bg-white border-r border-slate-200 shadow-xl flex flex-col shrink-0 z-20">
                  <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex flex-col gap-1">
                     <div className="flex justify-between items-start">
                        <span className="font-bold text-slate-700 text-lg">Ident: <span className="font-normal">{pedidoAtivo.identificacao || 'Sem Ident'}</span></span>
                        <span className="font-black text-slate-800 text-xl">{fmtBRL(pedidoAtivo.pedidos_itens?.reduce((a,i)=>a+(i.quantidade*i.valor_unitario),0)||0)}</span>
                     </div>
                     <span className="font-bold text-slate-600 text-sm">Comanda: {pedidoAtivo.id.substring(0,6).toUpperCase()}</span>
                     <div className="flex gap-4 mt-2">
                        <span className="font-bold text-slate-600 text-sm flex items-center gap-1"><Utensils size={14}/> Mesa: {mesaAtiva.numero_mesa}</span>
                     </div>
                     <span className="text-xs text-slate-500 font-bold mt-1">Garçom: {garcons.find(g => g.id === pedidoAtivo.garcom_id)?.nome || 'Sem garçom'}</span>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-3 bg-slate-50/50 custom-scrollbar space-y-1">
                     <h3 className="font-bold text-slate-500 text-xs uppercase tracking-widest mb-3 px-2 mt-2">Itens não enviados</h3>
                     {pedidoAtivo.pedidos_itens?.length === 0 && <p className="text-center text-slate-400 text-sm font-bold pt-4">Nenhum item novo adicionado</p>}
                     {pedidoAtivo.pedidos_itens?.map(it => (
                        <div key={it.id} className="flex flex-col bg-white p-2 rounded border border-slate-200 shadow-sm mb-1">
                           <div className="flex justify-between items-start">
                              <span className="font-bold text-slate-700 text-sm">{it.quantidade}x {it.produtos?.nome_produto}</span>
                              <span className="font-black text-slate-800 text-sm">{fmtBRL(it.quantidade * it.valor_unitario)}</span>
                           </div>
                           {it.observacao && <span className="text-[10px] text-slate-500 mt-1 uppercase font-bold">Obs: {it.observacao}</span>}
                        </div>
                     ))}
                  </div>

                  <div className="p-4 bg-white border-t border-slate-200 shrink-0 z-10">
                     <button onClick={enviarParaCozinha} className="w-full py-3 mb-2 bg-amber-500 hover:bg-amber-600 text-white font-black text-sm rounded-xl shadow-md shadow-amber-500/25 active:scale-[0.98] transition-all flex items-center justify-center gap-2">
                        <Send size={16}/> Enviar para a Cozinha
                     </button>
                     <div className="grid grid-cols-2 gap-2">
                        <button onClick={() => { setMesaAtiva(null); setPedidoAtivo(null); }} className="py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm rounded-xl transition-colors">VOLTAR</button>
                        <button onClick={() => setModalTransferir(true)} className="py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm rounded-xl transition-colors flex items-center justify-center gap-1"><ArrowRightLeft size={16}/> TRANSF.</button>
                        <button onClick={imprimirPreConta} className="py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm rounded-xl transition-colors flex items-center justify-center gap-1"><Printer size={16}/> PRÉ-CONTA</button>
                        <button onClick={abrirModalPagamento} className="py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-black text-sm rounded-xl shadow-md shadow-emerald-500/25 active:scale-[0.98] transition-all">RECEBER</button>
                     </div>
                  </div>
               </div>

               {/* ÁREA PRINCIPAL DIREITA: GRID DE PRODUTOS */}
               <div className="flex-1 flex flex-col bg-[#F1F5F9] overflow-hidden">
                  {/* Busca */}
                  <div className="p-3 bg-white border-b border-slate-200 flex gap-2">
                     <div className="flex-1 relative">
                        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input type="text" ref={buscaRef} value={buscaProd} onChange={e => setBuscaProd(e.target.value)} placeholder="Pesquise produtos pelo código, descrição ou detalhes" className="w-full pl-12 pr-4 py-2 bg-slate-50 border border-slate-200 rounded font-normal outline-none text-slate-700" />
                     </div>
                     <button onClick={() => setModoViagem(!modoViagem)} className={`px-4 py-2 rounded font-black text-[11px] uppercase tracking-widest transition-colors flex items-center gap-2 ${modoViagem ? 'bg-purple-600 text-white shadow-md' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                        <ShoppingBag size={14}/> {modoViagem ? 'Viagem: ON' : 'Viagem: OFF'}
                     </button>
                  </div>
                  {/* Categorias (Topo Horizontal) */}
                  <div className="px-3 py-2 bg-white flex gap-2 overflow-x-auto custom-scrollbar shrink-0 shadow-sm z-10 border-b border-slate-200">
                     {["Todas", ...new Set(produtos.map(p => p.categoria || "Geral"))].map(cat => (
                        <button key={cat} onClick={() => setFiltroCategoria(cat)}
                           className={`px-4 py-2.5 rounded-lg text-[11px] font-black uppercase whitespace-nowrap transition-all ${filtroCategoria === cat ? 'bg-emerald-500 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                           {cat}
                        </button>
                     ))}
                  </div>
                  {/* Grid de Produtos */}
                  <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                     <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-3">
                        {produtosFiltrados.map(prod => (
                           <button key={prod.id} onClick={() => {
                               // Ao invés de lançar no carrinho, vamos lançar direto na mesa!
                               // Para ser rápido igual o saipos, usamos quantidade 1 sem observação (se precisar de obs, clicaria longo ou teria botão)
                               // Para simplificar, lança 1 direto.
                               lancarItemComanda(pedidoAtivo.id, prod.id, prod.preco_venda || prod.preco || 0, 1, modoViagem ? "#PARA LEVAR" : "");
                               // O Supabase Realtime cuidaria disso, mas vamos recarregar a mesa
                               fetchPedidoAberto(mesaAtiva.id).then(({data}) => setPedidoAtivo(data));
                           }} className="bg-white rounded-xl p-0 border border-slate-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all text-center flex flex-col group h-full overflow-hidden">
                              <div className="p-3 flex-1 flex flex-col items-center justify-center">
                                 <h3 className="font-black text-slate-800 text-[11px] leading-tight mb-2 uppercase">{prod.nome_produto}</h3>
                                 <p className="font-bold text-emerald-600 text-xs">{fmtBRL(prod.preco_venda || prod.preco || 0)}</p>
                              </div>
                              <div className="bg-emerald-500 group-hover:bg-emerald-600 text-white py-2 flex items-center justify-center transition-colors">
                                 <ShoppingCart size={16}/>
                              </div>
                           </button>
                        ))}
                     </div>
                  </div>
               </div>
            </>
         ) : (
            // ==========================================
            // MODO NORMAL (MAPA DE MESAS OU BALCÃO)
            // ==========================================
            <>
               {/* LADO ESQUERDO (AÇÃO: MESAS ou GRID PRODUTOS BALCÃO) */}
               <div className="flex-1 flex flex-col overflow-hidden bg-slate-50 relative">
                  
                  {abaAtiva === 'salao' && (
                     <div className="flex w-full h-full">
                        {garcomAtivo && (
                           <div className="w-10 bg-[#4A72B2] text-white flex flex-col items-center py-4 z-20 shrink-0 shadow-md">
                              <div className="text-white font-black text-xs flex flex-col items-center tracking-widest whitespace-nowrap" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
                                 {garcomAtivo.nome} - {garcomAtivo.cargo}
                              </div>
                           </div>
                        )}
                        <div className="flex-1 flex flex-col h-full overflow-hidden">
                           <div className="bg-white border-b border-slate-200 shrink-0 z-10 flex flex-col sm:flex-row items-center p-2 gap-4">
                           <div className="flex gap-2 w-full sm:w-auto">
                              <input type="text" placeholder="Mesa" className="w-24 px-3 py-1.5 bg-slate-50 border border-slate-200 text-slate-700 outline-none focus:border-blue-500 rounded" />
                              <input type="text" placeholder="Comanda" className="w-32 px-3 py-1.5 bg-slate-50 border border-slate-200 text-slate-700 outline-none focus:border-blue-500 rounded" />
                           </div>
                           
                           <div className="flex items-center gap-4 text-xs font-bold text-slate-400">
                              <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-[#4CAF50]"></div> Disponível</div>
                              <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-blue-500"></div> Em consumo</div>
                              <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-amber-500"></div> Pediu a conta</div>
                           </div>

                           <div className="flex-1"></div>
                           <button onClick={() => setModalGestaoMesas(true)} className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs transition-colors rounded"><Settings size={14} className="inline mr-1"/> Config. Mesas</button>
                           <button onClick={() => setModalGestaoGarcons(true)} className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs transition-colors rounded"><Users size={14} className="inline mr-1"/> Garçons</button>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-2 bg-[#F1F5F9] custom-scrollbar">
                           {mesas.length === 0 ? (
                              <div className="text-center py-10">
                                 <p className="text-slate-500 font-bold mb-4">Nenhuma mesa cadastrada no salão.</p>
                                 <button onClick={() => setModalGestaoMesas(true)} className="px-6 py-3 bg-blue-500 text-white font-black rounded-xl">Gerenciar Mesas</button>
                              </div>
                           ) : (
                              <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-7 lg:grid-cols-9 xl:grid-cols-10 gap-2.5">
                                 {mesas.map(m => {
                                    const st = m.status === 'ocupada'
                                       ? { bg: 'bg-blue-500', label: 'Em consumo' }
                                       : m.status === 'fechando'
                                          ? { bg: 'bg-amber-500', label: 'Pediu a conta' }
                                          : { bg: 'bg-emerald-500', label: 'Livre' };
                                    return (
                                       <button key={m.id} onClick={() => clicarMesa(m)}
                                         className={`aspect-square w-full flex flex-col items-center justify-center gap-1 rounded-2xl text-white shadow-sm hover:shadow-lg hover:-translate-y-0.5 active:scale-95 transition-all duration-200 ${st.bg}`}>
                                          <span className="font-black text-xl leading-none text-center px-1">{m.numero_mesa}</span>
                                          <span className="text-[9px] font-bold uppercase tracking-widest text-white/80">{st.label}</span>
                                       </button>
                                    );
                                 })}
                              </div>
                           )}
                        </div>
                     </div>
                  </div>
                  )}

                  {abaAtiva !== 'salao' && (
                     <div className="flex flex-col h-full overflow-hidden">
                        <div className="p-4 bg-white border-b border-slate-200 shrink-0 z-10 flex gap-3">
                           <div className="flex-1 relative">
                              <Barcode size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                              <input type="text" ref={buscaRef} value={buscaProd} onChange={e => setBuscaProd(e.target.value)} onKeyDown={checkBipeBusca} placeholder="Bipar código de barras ou buscar nome..." className="w-full pl-12 pr-4 py-3 bg-slate-100 border-none rounded-xl font-bold outline-none" />
                           </div>
                        </div>

                        <div className="px-4 py-2 bg-white border-b border-slate-200 flex gap-2 overflow-x-auto custom-scrollbar shrink-0 shadow-sm z-10">
                           {["Todas", ...new Set(produtos.map(p => p.categoria || "Geral"))].map(cat => (
                              <button key={cat} onClick={() => setFiltroCategoria(cat)}
                                 className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all shadow-sm border ${filtroCategoria === cat ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-300'}`}>
                                 {cat}
                              </button>
                           ))}
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                           <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                              {produtosFiltrados.map(prod => (
                                 <button key={prod.id} onClick={() => handleSelecionarProdutoBalcao(prod)} className="bg-white rounded-xl p-3 border border-slate-200 shadow-sm hover:shadow-md hover:border-emerald-500 transition-all text-left flex flex-col group h-full">
                                    <h3 className="font-bold text-slate-700 text-xs leading-tight mb-2 flex-1">{prod.nome_produto}</h3>
                                    <div className="flex justify-between items-end w-full">
                                       <p className="text-[10px] text-slate-400">Estoque: {prod.codigo_barras ? 'Sim' : 'N/A'}</p>
                                       <p className="font-black text-emerald-600 text-sm">{fmtBRL(prod.preco_venda || prod.preco || 0)}</p>
                                    </div>
                                 </button>
                              ))}
                           </div>
                        </div>
                     </div>
                  )}
               </div>

               {/* LADO DIREITO: CARRINHO BALCÃO */}
               {abaAtiva !== 'salao' && (
                  <div className="w-[400px] bg-white border-l border-slate-200 shadow-2xl flex flex-col shrink-0 z-20">
                     <div className="px-5 py-4 bg-emerald-50 border-b border-emerald-100 flex items-center justify-between">
                        <h2 className="font-black text-emerald-800 flex items-center gap-2 uppercase"><ShoppingCart size={18}/> Cupom {abaAtiva}</h2>
                     </div>
                     <div className="flex-1 overflow-y-auto p-3 bg-slate-50/30 custom-scrollbar space-y-2">
                        {carrinho.length === 0 ? (
                           <p className="text-center text-slate-400 text-sm font-bold py-10">Carrinho Vazio</p>
                        ) : carrinho.map(item => {
                           const basePrice = Number(item.preco_venda || item.preco || 0);
                           const modsPrice = (item.modsSelecionados || []).reduce((acc, m) => acc + Number(m.preco || 0), 0);
                           const itemTotal = (basePrice + modsPrice) * item.quantidade;
                           
                           return (
                           <div key={item.uniqueId} className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-2 relative group">
                              <button onClick={() => removerItem(item.uniqueId)} className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"><X size={12}/></button>
                              <div className="flex justify-between items-start">
                                 <div>
                                    <span className="font-bold text-slate-700 text-xs">{item.nome_produto}</span>
                                    {item.modsSelecionados && item.modsSelecionados.length > 0 && (
                                       <div className="flex flex-wrap gap-1 mt-1">
                                          {item.modsSelecionados.map((m, idx) => (
                                             <span key={idx} className="text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-bold">
                                                + {m.nome}
                                             </span>
                                          ))}
                                       </div>
                                    )}
                                 </div>
                                 <span className="font-black text-emerald-600 text-sm">{fmtBRL(itemTotal)}</span>
                              </div>
                              <div className="flex justify-between items-center mt-1">
                                 <div className="flex items-center gap-2 bg-slate-100 rounded-lg p-1">
                                    <button onClick={() => alterarQtd(item.uniqueId, -1)} className="w-6 h-6 flex items-center justify-center bg-white rounded-md shadow-sm text-slate-600 hover:text-red-500"><Minus size={12}/></button>
                                    <span className="font-black text-slate-700 text-xs w-4 text-center">{item.quantidade}</span>
                                    <button onClick={() => alterarQtd(item.uniqueId, 1)} className="w-6 h-6 flex items-center justify-center bg-white rounded-md shadow-sm text-slate-600 hover:text-emerald-500"><Plus size={12}/></button>
                                 </div>
                              </div>
                           </div>
                        )})}
                     </div>
                     <div className="p-5 bg-white border-t border-slate-200 shadow-[0_-10px_20px_rgba(0,0,0,0.03)] z-10">
                        <div className="flex justify-between items-end mb-4">
                           <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Total a Receber</span>
                           <span className="text-3xl font-black text-emerald-500 tracking-tight">{fmtBRL(totalCarrinho)}</span>
                        </div>
                        <button disabled={carrinho.length === 0} onClick={abrirModalPagamento} className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none text-white font-black py-4 rounded-2xl shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 active:scale-[0.98] transition-all flex items-center justify-center gap-2">
                           <CheckCircle size={18} /> RECEBER AGORA
                        </button>
                     </div>
                  </div>
               )}
            </>
         )}
      </div>

      {/* =======================================================
          MODAIS E SOBREPOSIÇÕES
      ======================================================== */}
      
      {/* MODAL: MODIFICADORES BALCÃO */}
      {modalMod && prodModAtual && (
         <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-[32px] p-8 w-full max-w-md shadow-2xl animate-in zoom-in-95">
               <div className="flex justify-between items-center mb-6">
                  <div>
                     <h2 className="text-2xl font-black text-slate-800">{prodModAtual.nome_produto}</h2>
                     <p className="text-sm font-bold text-slate-500 uppercase tracking-widest mt-1">Selecione os adicionais</p>
                  </div>
                  <button onClick={() => setModalMod(false)} className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-200"><X size={20}/></button>
               </div>
               
               <div className="space-y-3 my-8 max-h-[40vh] overflow-y-auto custom-scrollbar pr-2">
                  {prodModAtual.modificadores.map((mod, i) => {
                     const selecionado = modsSelecionados.find(m => m.nome === mod.nome);
                     return (
                        <button key={i} onClick={() => toggleMod(mod)} className={`w-full flex justify-between items-center p-4 rounded-2xl border-2 transition-all ${selecionado ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                           <div className="flex items-center gap-3">
                              <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${selecionado ? 'border-emerald-500 bg-emerald-500' : 'border-slate-300'}`}>
                                 {selecionado && <CheckCircle size={14} className="text-white"/>}
                              </div>
                              <span className={`font-bold ${selecionado ? 'text-emerald-900' : 'text-slate-700'}`}>{mod.nome}</span>
                           </div>
                           <span className={`font-black ${selecionado ? 'text-emerald-700' : 'text-slate-500'}`}>
                              {mod.preco > 0 ? `+ ${fmtBRL(mod.preco)}` : 'Grátis'}
                           </span>
                        </button>
                     );
                  })}
               </div>

               <button onClick={confirmarMods} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-5 text-lg rounded-2xl shadow-xl shadow-emerald-600/20 active:scale-95 transition-all">
                  Confirmar e Adicionar
               </button>
            </div>
         </div>
      )}
      
      {/* MODAL: LANÇAR ITEM NA MESA */}
      {modalLancar && (
         <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl">
               <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-black text-slate-800">Lançar Pedido</h2>
                  <button onClick={() => setModalLancar(false)} className="text-slate-400 hover:text-red-500"><X size={20}/></button>
               </div>
               
               <div className="space-y-4">
                  <div>
                     <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Produto do Cardápio</label>
                     <select value={produtoSel} onChange={e => { setProdutoSel(e.target.value); setModsLancarMesa([]); }} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="">-- Selecione --</option>
                        {produtos.map(p => (
                           <option key={p.id} value={p.id}>{p.nome_produto} - {fmtBRL(p.preco_venda||p.preco||0)}</option>
                        ))}
                     </select>
                  </div>

                  {/* Mostra Modificadores se o Produto Selecionado tiver */}
                  {produtoSel && produtos.find(p => p.id === produtoSel)?.modificadores?.length > 0 && (
                     <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Adicionais</label>
                        <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar pr-2">
                           {produtos.find(p => p.id === produtoSel).modificadores.map((mod, i) => {
                              const selecionado = modsLancarMesa.find(m => m.nome === mod.nome);
                              return (
                                 <button key={i} onClick={() => toggleModLancarMesa(mod)} className={`w-full flex justify-between items-center p-3 rounded-xl border-2 transition-all ${selecionado ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 bg-slate-50'}`}>
                                    <span className={`font-bold text-sm ${selecionado ? 'text-emerald-900' : 'text-slate-700'}`}>{mod.nome}</span>
                                    <span className={`font-black text-sm ${selecionado ? 'text-emerald-700' : 'text-slate-500'}`}>{mod.preco > 0 ? `+ ${fmtBRL(mod.preco)}` : 'Grátis'}</span>
                                 </button>
                              );
                           })}
                        </div>
                     </div>
                  )}

                  <div>
                     <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Quantidade</label>
                     <input type="number" min="1" value={qtdLancamento} onChange={e => setQtdLancamento(Number(e.target.value))} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                     <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Observação (Ex: Sem cebola)</label>
                     <input type="text" value={obsLancamento} onChange={e => setObsLancamento(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-medium text-slate-700 outline-none focus:ring-2 focus:ring-blue-500" placeholder="Opcional..." />
                     {observacoesPadrao.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-3">
                           {observacoesPadrao.map(o => (
                              <button key={o.id} type="button" onClick={() => setObsLancamento(prev => prev ? prev + ', ' + o.texto : o.texto)} className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase transition-colors shadow-sm">
                                 + {o.texto}
                              </button>
                           ))}
                        </div>
                     )}
                  </div>
               </div>

               <div className="mt-8 flex gap-3">
                  <button type="button" onClick={() => setModalLancar(false)} className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-100 rounded-xl">Cancelar</button>
                  <button type="button" onClick={confirmarLancamentoMesa} disabled={processando} className="flex-1 bg-slate-800 hover:bg-slate-900 text-white font-black py-3 rounded-xl shadow-md flex justify-center items-center gap-2">
                     <Send size={16}/> Enviar para Produção
                  </button>
               </div>
            </div>
         </div>
      )}

      {/* MODAL DE PAGAMENTO (MEGAZORD) */}
      {modalPagamento && (
         <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="bg-white rounded-[32px] w-full max-w-4xl shadow-2xl flex overflow-hidden max-h-[95vh]">
               
               {/* Lado Esquerdo: Identificação e Descontos */}
               <div className="w-1/3 bg-slate-50 border-r border-slate-200 p-6 overflow-y-auto custom-scrollbar">
                  <h3 className="font-black text-slate-800 mb-6 flex items-center gap-2"><Users size={18}/> Cliente na Nota</h3>
                  <div className="space-y-4 mb-8">
                     <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">CPF / CNPJ</label>
                        <input type="text" value={clienteCpf} onChange={e=>setClienteCpf(e.target.value)} placeholder="000.000.000-00" className="w-full px-4 py-2.5 rounded-xl border border-slate-300 outline-none font-bold text-slate-700"/>
                     </div>
                     <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Nome Cliente</label>
                        <input type="text" value={clienteNome} onChange={e=>setClienteNome(e.target.value)} placeholder="Consumidor Final" className="w-full px-4 py-2.5 rounded-xl border border-slate-300 outline-none font-bold text-slate-700"/>
                     </div>
                  </div>

                  <h3 className="font-black text-slate-800 mb-4 flex items-center gap-2">Descontos e Taxas</h3>
                  <div className="space-y-4">
                     {abaAtiva === 'salao' && (
                     <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                        <label className="text-xs font-bold text-slate-700">Taxa de Serviço (10%)</label>
                        <button type="button" onClick={() => setAplicarDezPorcento(!aplicarDezPorcento)} className={`w-12 h-6 rounded-full transition-colors relative ${aplicarDezPorcento ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                           <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-transform ${aplicarDezPorcento ? 'translate-x-7' : 'translate-x-1'}`}></div>
                        </button>
                     </div>
                     )}
                     <div className="grid grid-cols-2 gap-2">
                        <div>
                           <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Desc %</label>
                           <input type="number" value={descontoPerc} onChange={e=>setDescontoPerc(e.target.value)} placeholder="0%" className="w-full px-3 py-2 rounded-lg border border-slate-300 font-bold disabled:bg-slate-100" disabled={cupomAplicado} />
                        </div>
                        <div>
                           <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Desc R$</label>
                           <input type="number" step="0.01" value={descontoRs} onChange={e=>setDescontoRs(e.target.value)} placeholder="0.00" className="w-full px-3 py-2 rounded-lg border border-slate-300 font-bold disabled:bg-slate-100" disabled={cupomAplicado} />
                        </div>
                     </div>
                     <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Taxas Extras (Serviço, Entrega)</label>
                        <input type="number" step="0.01" value={taxaExtra} onChange={e=>setTaxaExtra(e.target.value)} placeholder="R$ 0.00" className="w-full px-4 py-2.5 rounded-xl border border-slate-300 outline-none font-bold text-slate-700"/>
                     </div>

                     <div className="pt-2 border-t border-slate-200">
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5"><Tag size={12} className="inline mr-1"/> Cupom de Desconto</label>
                        {cupomAplicado ? (
                           <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 p-3 rounded-xl">
                              <span className="font-bold text-emerald-800 text-sm">{cupomAplicado.codigo} aplicado! (-{cupomAplicado.tipo === 'percentual' ? cupomAplicado.valor+'%' : fmtBRL(cupomAplicado.valor)})</span>
                              <button type="button" onClick={() => { setCupomAplicado(null); setDescontoPerc(""); setDescontoRs(""); }} className="text-red-500 hover:text-red-700 font-bold text-xs bg-white px-2 py-1 rounded shadow-sm">Remover</button>
                           </div>
                        ) : (
                           <div className="flex gap-2">
                              <input type="text" value={cupomDigitado} onChange={e=>setCupomDigitado(e.target.value.toUpperCase())} onKeyDown={checkBipeCupom} placeholder="CÓDIGO" className="flex-1 px-4 py-2.5 rounded-xl border border-slate-300 outline-none font-black text-slate-700 uppercase" />
                              <button type="button" onClick={handleAplicarCupom} disabled={processando || !cupomDigitado} className="bg-slate-800 hover:bg-slate-900 text-white font-bold px-4 rounded-xl disabled:opacity-50">Aplicar</button>
                           </div>
                        )}
                     </div>
                  </div>
               </div>

               {/* Lado Direito: Recebimento Split */}
               <div className="flex-1 p-8 flex flex-col bg-white">
                  
                  <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-100">
                     <h2 className="text-2xl font-black text-slate-800 flex items-center gap-2"><CreditCard className="text-blue-500"/> Fechar Pagamento</h2>
                     <button onClick={() => setModalPagamento(false)} className="text-slate-400 hover:text-slate-600 font-bold uppercase text-sm">Cancelar</button>
                  </div>

                  <div className="flex justify-between items-center bg-slate-800 text-white rounded-2xl p-5 mb-6 shadow-md">
                     <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total Líquido</p>
                        <div className="flex items-end gap-2">
                           <span className="text-4xl font-black text-emerald-400">{fmtBRL(valorTotalFinal)}</span>
                           {(Number(descontoPerc)>0 || Number(descontoRs)>0) && <span className="text-sm font-bold text-red-400 line-through pb-1">{fmtBRL(subtotalPagamento)}</span>}
                        </div>
                     </div>
                     <div className="text-right">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Restante</p>
                        <span className={`text-2xl font-black ${restante === 0 ? 'text-emerald-400' : 'text-orange-400'}`}>{fmtBRL(restante)}</span>
                     </div>
                  </div>

                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-6 flex items-center justify-between shadow-inner">
                     <div className="flex items-center gap-3">
                        <div className="bg-white p-2 rounded-lg shadow-sm">
                           <Users className="text-blue-500" size={20} />
                        </div>
                        <div>
                           <label className="block text-[10px] font-bold text-slate-500 uppercase">Dividir Conta Por:</label>
                           <div className="flex items-center gap-2 mt-1">
                              <button onClick={() => setQuantidadePessoas(Math.max(1, quantidadePessoas - 1))} className="w-7 h-7 bg-white border border-slate-300 rounded-md text-slate-600 font-bold flex items-center justify-center hover:bg-slate-100 transition-colors">-</button>
                              <span className="font-black text-slate-700 w-6 text-center text-lg">{quantidadePessoas}</span>
                              <button onClick={() => setQuantidadePessoas(quantidadePessoas + 1)} className="w-7 h-7 bg-white border border-slate-300 rounded-md text-slate-600 font-bold flex items-center justify-center hover:bg-slate-100 transition-colors">+</button>
                           </div>
                        </div>
                     </div>
                     <div className="text-right">
                        <p className="text-[10px] font-bold text-slate-500 uppercase">Total por Pessoa</p>
                        <span className="text-2xl font-black text-blue-600 tracking-tight">{fmtBRL(valorTotalFinal / Math.max(1, quantidadePessoas))}</span>
                     </div>
                  </div>

                  <div className="flex-1 overflow-y-auto pr-2">
                     <div className="flex items-center justify-between mb-4">
                        <h3 className="font-bold text-slate-600 text-sm uppercase tracking-widest flex items-center gap-2"><SplitSquareHorizontal size={16}/> Formas de Pagamento</h3>
                        <button onClick={() => setPagamentos([...pagamentos, { id: Date.now(), forma: 'pix', valor: 0 }])} className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100">+ Forma Adicional</button>
                     </div>

                     <div className="space-y-3">
                        {pagamentos.map((p) => (
                           <div key={p.id} className="flex gap-3 items-center bg-slate-50 p-3 rounded-xl border border-slate-200">
                              <select value={p.forma} onChange={e => {
                                  const n = [...pagamentos];
                                  n.find(x=>x.id===p.id).forma = e.target.value;
                                  setPagamentos(n);
                              }} className="w-1/2 px-3 py-2 bg-white border border-slate-300 rounded-lg font-bold text-slate-700 outline-none">
                                 <option value="dinheiro">Dinheiro</option>
                                 <option value="pix">PIX</option>
                                 <option value="credito">Cartão Crédito</option>
                                 <option value="debito">Cartão Débito</option>
                                 <option value="vr">Vale Refeição</option>
                              </select>
                              <div className="relative w-1/2 flex items-center">
                                 <span className="absolute left-3 text-slate-400 font-bold">R$</span>
                                 <input type="number" step="0.01" value={p.valor || ''} onChange={e => {
                                      const n = [...pagamentos];
                                      n.find(x=>x.id===p.id).valor = e.target.value;
                                      setPagamentos(n);
                                 }} onFocus={() => { if(p.valor===0) { const n = [...pagamentos]; n.find(x=>x.id===p.id).valor = restante; setPagamentos(n); } }} 
                                 className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-lg font-black text-slate-800 outline-none" placeholder="0.00"/>
                                 {pagamentos.length > 1 && (
                                    <button onClick={() => setPagamentos(pagamentos.filter(x=>x.id!==p.id))} className="absolute -right-8 text-red-400 hover:text-red-600"><Trash2 size={18}/></button>
                                 )}
                              </div>
                           </div>
                        ))}
                     </div>

                     {troco > 0 && (
                        <div className="mt-6 bg-orange-50 border border-orange-200 rounded-xl p-4 flex justify-between items-center animate-in fade-in">
                           <span className="font-bold text-orange-800 uppercase text-sm">Troco a devolver:</span>
                           <span className="text-2xl font-black text-orange-600">{fmtBRL(troco)}</span>
                        </div>
                     )}
                  </div>

                  <div className="pt-6 shrink-0 mt-4 border-t border-slate-100 space-y-4">
                     <label className="flex items-center gap-2 cursor-pointer bg-slate-50 p-3 rounded-xl border border-slate-200 hover:bg-slate-100 transition-colors">
                        <input type="checkbox" checked={emitirNFCe} onChange={e => setEmitirNFCe(e.target.checked)} className="w-5 h-5 accent-emerald-600 cursor-pointer"/>
                        <span className="font-bold text-slate-700">Emitir Cupom Fiscal (NFC-e / SAT)</span>
                     </label>

                     <button onClick={finalizarVenda} disabled={processando || restante > 0} className="w-full bg-slate-800 hover:bg-black disabled:bg-slate-300 text-white font-black py-4 rounded-xl shadow-lg transition-transform text-lg flex items-center justify-center">
                        {processando ? "PROCESSANDO..." : "CONCLUIR RECEBIMENTO"}
                     </button>
                  </div>

               </div>
            </div>
         </div>
      )}

      {/* RECIBO FINAL */}
      {modalRecibo && dadosRecibo && (
         <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl p-6 w-[320px] shadow-2xl flex flex-col font-mono relative">
               
               {/* Cabeçalho */}
               <div className="text-center mb-4 border-b border-dashed border-slate-400 pb-4">
                  <h2 className="font-black text-xl mb-1">HEFISTO ERP</h2>
                  <p className="text-xs font-bold">CUPOM NÃO FISCAL</p>
                  <p className="text-xs">{dadosRecibo.tipo === 'salao' ? `MESA ${dadosRecibo.mesa}` : 'VENDA BALCÃO'}</p>
                  <p className="text-[10px] mt-1">{dadosRecibo.data.toLocaleString()}</p>
               </div>

               {/* Itens */}
               <div className="text-xs mb-2">
                  <div className="flex justify-between font-bold border-b border-slate-200 pb-1 mb-1">
                     <span>DESC</span><span>QTD</span><span>TOT</span>
                  </div>
                  {dadosRecibo.itens.map((it, idx) => (
                     <div key={idx} className="flex justify-between py-0.5">
                        <span className="truncate w-3/5">{it.nome}</span>
                        <span className="w-1/5 text-center">{it.qtd}</span>
                        <span className="w-1/5 text-right">{it.tot.toFixed(2)}</span>
                     </div>
                  ))}
               </div>

               {/* Totais */}
               <div className="border-t border-dashed border-slate-400 pt-2 mt-2 text-xs space-y-1">
                  <div className="flex justify-between"><span>Subtotal:</span><span>{fmtBRL(dadosRecibo.subtotal)}</span></div>
                  {dadosRecibo.desconto > 0 && <div className="flex justify-between text-slate-500"><span>Desconto:</span><span>- {fmtBRL(dadosRecibo.desconto)}</span></div>}
                  {dadosRecibo.taxa > 0 && <div className="flex justify-between"><span>Taxas:</span><span>+ {fmtBRL(dadosRecibo.taxa)}</span></div>}
                  <div className="flex justify-between font-black text-sm pt-1 border-t border-slate-200 mt-1"><span>TOTAL:</span><span>{fmtBRL(dadosRecibo.total)}</span></div>
               </div>

               {/* Pagamentos */}
               {!dadosRecibo.isPreConta && (
                  <div className="border-t border-dashed border-slate-400 pt-2 mt-2 text-[10px] space-y-1">
                     <p className="font-bold text-center mb-1">Pagamentos:</p>
                     {dadosRecibo.recebidos.map((pg, i) => (
                        <div key={i} className="flex justify-between uppercase"><span>{pg.forma}:</span><span>{fmtBRL(pg.valor)}</span></div>
                     ))}
                     {dadosRecibo.troco > 0 && <div className="flex justify-between font-bold mt-1"><span>Troco:</span><span>{fmtBRL(dadosRecibo.troco)}</span></div>}
                  </div>
               )}

               {dadosRecibo.cpf && (
                  <div className="border-t border-dashed border-slate-400 pt-2 mt-2 text-[10px] text-center">
                     <p>CPF na Nota: {dadosRecibo.cpf}</p>
                     {dadosRecibo.cliente && <p>Consumidor: {dadosRecibo.cliente}</p>}
                  </div>
               )}

               <div className="text-center text-[10px] mt-4 pt-3 border-t border-slate-800">
                  <p>Obrigado pela preferência!</p>
                  <p className="text-slate-400 mt-1">Volte sempre</p>
               </div>

               {/* Botões */}
               <div className="flex gap-2 mt-6">
                  <button
                     onClick={() => setModalRecibo(false)}
                     className="flex-1 bg-slate-100 text-slate-700 font-bold py-3 rounded-xl"
                  >
                     Fechar
                  </button>
                  <button
                     onClick={() => abrirCupomTermico(dadosRecibo)}
                     className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2"
                  >
                     <Printer size={18}/> Re-Imprimir Cupom
                  </button>
               </div>
            </div>
         </div>
      )}


      {/* MODAL: SANGRIAS E SUPRIMENTOS */}
      {modalMov && (
         <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl">
               <h2 className={`text-xl font-black mb-6 ${tipoMov === 'sangria' ? 'text-orange-600' : 'text-blue-600'}`}>
                  {tipoMov === 'sangria' ? 'Sangria (Saída)' : 'Suprimento (Entrada)'}
               </h2>
               <form onSubmit={handleMovimentacao}>
                  <div className="mb-4">
                     <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Valor (R$)</label>
                     <input type="number" step="0.01" required value={valorMov} onChange={e => setValorMov(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold" autoFocus />
                  </div>
                  <div className="mb-6">
                     <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Motivo / Descrição</label>
                     <input type="text" required value={descMov} onChange={e => setDescMov(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-medium" />
                  </div>
                  <div className="flex gap-3">
                     <button type="button" onClick={() => setModalMov(false)} className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-100 rounded-xl">Cancelar</button>
                     <button type="submit" disabled={processando} className={`flex-1 text-white font-black py-3 rounded-xl ${tipoMov === 'sangria' ? 'bg-orange-500' : 'bg-blue-500'}`}>Confirmar</button>
                  </div>
               </form>
            </div>
         </div>
      )}

      {/* FECHAMENTO DE CAIXA (LEITURA Z) */}
      {modalFechamento && resumoZ && (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
            <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl">
               <h2 className="text-xl font-black text-slate-800 mb-6 border-b pb-4">Leitura Z (Fim de Turno)</h2>
               <div className="space-y-4 mb-6">
                  <div className="bg-slate-50 rounded-xl p-4">
                     <p className="text-xs font-bold text-slate-500 uppercase mb-2">Gaveta Física</p>
                     <div className="flex justify-between text-sm"><span>Fundo</span><span>{fmtBRL(resumoZ.fundo_inicial)}</span></div>
                     <div className="flex justify-between text-sm text-blue-600"><span>Suprimento</span><span>{fmtBRL(resumoZ.suprimentos)}</span></div>
                     <div className="flex justify-between text-sm text-orange-600"><span>Sangria</span><span>- {fmtBRL(resumoZ.sangrias)}</span></div>
                     <div className="flex justify-between text-sm text-emerald-600"><span>Vendas em Dinheiro</span><span>{fmtBRL(resumoZ.vendas_dinheiro)}</span></div>
                     <div className="flex justify-between font-black mt-2 pt-2 border-t"><span>Total Esperado:</span><span>{fmtBRL(resumoZ.esperado_gaveta)}</span></div>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-4">
                     <p className="text-xs font-bold text-slate-500 uppercase mb-2">Cartões e Outros</p>
                     <div className="flex justify-between text-sm"><span>PIX</span><span>{fmtBRL(resumoZ.vendas_pix)}</span></div>
                     <div className="flex justify-between text-sm"><span>Cartões</span><span>{fmtBRL(resumoZ.vendas_cartao)}</span></div>
                  </div>
               </div>
               <div className="flex gap-2">
                  <button onClick={() => setModalFechamento(false)} className="px-4 py-3 bg-slate-100 font-bold rounded-xl text-slate-500">Voltar</button>
                  <button onClick={confirmarFechamento} className="flex-1 bg-red-500 text-white font-black py-3 rounded-xl flex items-center justify-center gap-2">
                     <Lock size={18}/> TRAVAR CAIXA
                  </button>
               </div>
            </div>
         </div>
      )}
      {/* MODAL GESTÃO DE GARÇONS */}
      {modalGestaoGarcons && (
         <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
               <div className="p-6 border-b border-slate-100 bg-slate-800 text-white flex justify-between items-center">
                  <div><h2 className="text-xl font-black">Gerenciar Garçons</h2><p className="text-sm text-slate-400">Cadastre a equipe</p></div>
                  <button onClick={() => setModalGestaoGarcons(false)} className="text-slate-400 hover:text-white"><X size={24} /></button>
               </div>
               <div className="p-6 flex-1 overflow-y-auto">
                  <form onSubmit={async (e) => {
                     e.preventDefault();
                     if(!novoGarcomNome.trim()) return;
                     setProcessando(true);
                     const res = await criarGarcom(unidadeAtiva, novoGarcomNome.trim());
                     if(res?.error) alert("Erro: " + res.error);
                     else { setNovoGarcomNome(""); const { data } = await fetchGarcons(unidadeAtiva); setGarcons(data); }
                     setProcessando(false);
                  }} className="flex flex-col gap-3 mb-8">
                     <label className="text-xs font-bold text-slate-500 uppercase">Nome do Garçom</label>
                     <div className="flex gap-2">
                        <input type="text" value={novoGarcomNome} onChange={e => setNovoGarcomNome(e.target.value)} required className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold" placeholder="Ex: João, Maria" />
                        <button type="submit" disabled={processando} className="px-6 py-3 bg-blue-600 hover:bg-blue-700 transition-colors text-white font-black rounded-xl shadow-lg"><Plus size={18} className="inline"/></button>
                     </div>
                  </form>
                  <h3 className="text-sm font-black text-slate-700 mb-4 flex items-center gap-2"><Users size={16}/> Equipe <span className="bg-slate-100 px-2 py-0.5 rounded text-xs text-slate-500">{garcons.length}</span></h3>
                  <div className="flex flex-col gap-2">
                     {garcons.map(g => (
                        <div key={g.id} className="p-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-700 shadow-sm">{g.nome}</div>
                     ))}
                  </div>
               </div>
            </div>
         </div>
      )}

      {/* MODAL SELECIONAR GARÇOM */}
      {modalGarcom && (
         <div className="fixed inset-0 bg-white z-[60] flex flex-col">
            <div className="bg-[#4A6487] p-4 text-white flex justify-between items-center shadow-md">
               <span className="font-bold">Mesa: {mesaAtiva?.numero_mesa}</span>
               <button onClick={() => setModalGarcom(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X size={20}/></button>
            </div>
            <div className="flex-1 overflow-y-auto p-10 bg-[#F1F5F9] flex flex-col items-center">
               <h2 className="text-2xl font-black text-[#1E293B] mb-12 tracking-tight">SELECIONE O GARÇOM</h2>
               <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-x-12 gap-y-10 max-w-5xl w-full">
                  {garcons.length === 0 ? <p className="col-span-full text-center text-slate-500 font-bold">Nenhum garçom cadastrado. Vá em 'Garçons' no topo do mapa de mesas para cadastrar.</p> : garcons.map(g => (
                     <button key={g.id} onClick={async () => { 
                        setGarcomAtivo(g); 
                        setModalGarcom(false); 
                        if (mesaAtiva) {
                           const proxId = await fetchProximoNumeroComanda(mesaAtiva.id, mesaAtiva.numero_mesa);
                           setIdentAtiva(proxId); 
                           setModalComanda(true); 
                        }
                     }} className="flex flex-col items-center gap-4 group">
                        <div className="w-24 h-24 rounded-full bg-[#4A72B2] text-white flex items-center justify-center text-4xl font-black shadow-lg group-hover:scale-105 transition-transform">
                           {g.nome.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-black text-[#334155] text-xs tracking-wide uppercase text-center leading-snug">{g.nome} - {g.cargo}</span>
                     </button>
                  ))}
               </div>
            </div>
         </div>
      )}

      {/* MODAL DE TRANSFERÊNCIA DE MESA */}
      {modalTransferir && pedidoAtivo && mesaAtiva && (
         <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl">
               <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-black text-slate-800 flex items-center gap-2"><ArrowRightLeft size={20} className="text-purple-500"/> Transferir Comanda</h2>
                  <button onClick={() => setModalTransferir(false)} className="text-slate-400 hover:text-red-500"><X size={20}/></button>
               </div>
               <p className="text-sm font-bold text-slate-600 mb-4">Transferindo a comanda <span className="text-blue-500">{pedidoAtivo.identificacao}</span> da Mesa {mesaAtiva.numero_mesa} para onde?</p>
               
               <div className="mb-6">
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Mesa Destino</label>
                  <select value={mesaDestinoId} onChange={e => setMesaDestinoId(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold text-slate-700 outline-none">
                     <option value="">-- Selecione a Mesa --</option>
                     {mesas.filter(m => m.id !== mesaAtiva.id).map(m => (
                        <option key={m.id} value={m.id}>Mesa {m.numero_mesa} {m.status !== 'livre' ? '(Ocupada)' : '(Livre)'}</option>
                     ))}
                  </select>
               </div>
               
               <div className="flex gap-3">
                  <button onClick={() => setModalTransferir(false)} className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 font-bold text-slate-600 rounded-xl transition-colors">Cancelar</button>
                  <button disabled={!mesaDestinoId || processando} onClick={async () => {
                     setProcessando(true);
                     const { error } = await transferirComanda(pedidoAtivo.id, mesaAtiva.id, mesaDestinoId);
                     setProcessando(false);
                     if(error) alert("Erro ao transferir: " + error);
                     else {
                        setModalTransferir(false);
                        setPedidoAtivo(null);
                        setMesaAtiva(null);
                        carregarMesas();
                        alert("Comanda transferida com sucesso!");
                     }
                  }} className="flex-1 py-3 bg-purple-500 hover:bg-purple-600 disabled:bg-slate-300 text-white font-black rounded-xl shadow-md transition-colors">Transferir</button>
               </div>
            </div>
         </div>
      )}

      {/* MODAL LISTA DE COMANDAS DA MESA */}
      {modalListaComandas && (
         <div className="fixed inset-0 bg-white z-[60] flex flex-col">
            <div className="bg-[#4A6487] p-4 text-white flex justify-between items-center shadow-md">
               <span className="font-bold">Comandas - Mesa: {mesaAtiva?.numero_mesa}</span>
               <button onClick={() => setModalListaComandas(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X size={20}/></button>
            </div>
            <div className="flex-1 overflow-y-auto p-10 bg-[#F1F5F9] flex flex-col items-center">
               <h2 className="text-2xl font-black text-[#1E293B] mb-8 tracking-tight">SELECIONE UMA COMANDA</h2>
               
               <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 w-full max-w-5xl">
                  {/* Botão de NOVA COMANDA */}
                  <button onClick={async () => {
                     setModalListaComandas(false);
                     if (garcomAtivo) {
                        const proxId = await fetchProximoNumeroComanda(mesaAtiva.id, mesaAtiva.numero_mesa);
                        setIdentAtiva(proxId);
                        setModalComanda(true);
                     } else {
                        setModalGarcom(true);
                     }
                  }} className="bg-white border-2 border-dashed border-emerald-400 hover:bg-emerald-50 rounded-2xl p-6 flex flex-col items-center justify-center min-h-[160px] transition-colors group">
                     <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-500 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                        <Plus size={24} className="font-black" />
                     </div>
                     <span className="font-black text-emerald-600 uppercase">NOVA COMANDA</span>
                     <span className="text-xs text-slate-400 font-bold mt-1">Adicionar à Mesa {mesaAtiva?.numero_mesa}</span>
                  </button>

                  {/* Lista de Comandas Atuais */}
                  {pedidosDaMesa.map(pedido => (
                     <button key={pedido.id} onClick={() => {
                        setPedidoAtivo(pedido);
                        setFiltroCategoria("Todas");
                        setModalListaComandas(false);
                     }} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-lg hover:border-blue-400 transition-all flex flex-col items-center text-center">
                        <div className="w-16 h-16 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xl font-black mb-4">
                           {pedido.identificacao ? pedido.identificacao.substring(0,4) : '#'}
                        </div>
                        <span className="font-black text-slate-700 text-lg">{pedido.identificacao || 'Sem Ident'}</span>
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">R$ {(pedido.pedidos_itens?.reduce((acc, it) => acc + (it.quantidade * it.valor_unitario), 0) || 0).toFixed(2).replace('.',',')}</span>
                     </button>
                  ))}
               </div>
            </div>
         </div>
      )}

      {/* MODAL ABERTURA DE COMANDA (IDENTIFICAÇÃO) */}
      {modalComanda && (
         <div className="fixed inset-0 bg-white z-[60] flex flex-col">
            <div className="bg-[#fff] border-b border-slate-200 p-4 text-slate-600 flex justify-between items-center shadow-sm">
               <span className="font-bold">Abertura de comanda</span>
               <span className="font-bold">Mesa: {mesaAtiva?.numero_mesa}</span>
            </div>
            <div className="flex-1 flex flex-col items-center p-10 bg-[#fafafa]">
               <div className="w-full max-w-2xl mt-10">
                  <p className="text-slate-500 font-normal mb-2 text-sm">Digite uma identificação a ser adicionada à venda:</p>
                  <form onSubmit={async (e) => {
                     e.preventDefault();
                     setProcessando(true);
                     await abrirMesaEPedido(unidadeAtiva, mesaAtiva.id, garcomAtivo?.id, identAtiva);
                     await carregarMesas();
                     const { data } = await fetchPedidoAberto(mesaAtiva.id);
                     setPedidoAtivo(data);
                     setProcessando(false);
                     setModalComanda(false);
                  }} className="w-full">
                     <input type="text" autoFocus value={identAtiva} onChange={e => setIdentAtiva(e.target.value)} required 
                        className="w-full bg-[#E5E7EB] border-none text-center text-5xl p-6 font-normal text-slate-700 outline-none mb-10 tracking-wider" />
                     
                     <div className="flex gap-4 border-t border-slate-200 pt-8">
                        <button type="button" onClick={() => { setModalComanda(false); setModalGarcom(true); }} className="px-6 py-3 bg-[#F44336] hover:bg-red-600 text-white font-bold text-sm rounded shadow transition-colors">VOLTAR</button>
                        <button type="submit" disabled={processando} className="px-6 py-3 bg-[#2196F3] hover:bg-blue-600 text-white font-bold text-sm rounded shadow transition-colors">ABRIR COMANDA</button>
                     </div>
                  </form>
               </div>
            </div>
         </div>
      )}

      {/* MODAL GESTÃO DE MESAS */}
      {modalGestaoMesas && (
         <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
               <div className="bg-slate-800 text-white p-5 flex justify-between items-center shrink-0">
                  <div className="flex items-center gap-3">
                     <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center"><Settings size={20} className="text-blue-300" /></div>
                     <div>
                        <h2 className="font-black text-lg">Gerenciar Mesas</h2>
                        <p className="text-xs text-slate-300 font-medium">Adicione ou remova mesas físicas do seu salão</p>
                     </div>
                  </div>
                  <button onClick={() => setModalGestaoMesas(false)} className="text-slate-400 hover:text-white"><X size={24} /></button>
               </div>
               
               <div className="p-6 flex-1 overflow-y-auto">
                  <form onSubmit={async (e) => {
                     e.preventDefault();
                     if(!novaMesaNum.trim()) return;
                     setProcessando(true);
                     const res = await criarMesa(unidadeAtiva, novaMesaNum.trim());
                     if (res?.error) {
                        alert("Erro do Banco de Dados: " + res.error);
                     } else {
                        setNovaMesaNum("");
                        await carregarMesas();
                     }
                     setProcessando(false);
                  }} className="flex flex-col gap-3 mb-8">
                     <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Nome ou Número da Mesa</label>
                     <div className="flex gap-2">
                        <input type="text" value={novaMesaNum} onChange={e => setNovaMesaNum(e.target.value)} placeholder="Ex: 12, VIP, Varanda..." required className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-blue-500 focus:bg-white transition-colors" />
                        <button type="submit" disabled={processando} className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl shadow-lg shadow-blue-500/30 transition-all disabled:opacity-50 flex items-center gap-2 whitespace-nowrap">
                           {processando ? 'Salvando...' : <><Plus size={18}/> Adicionar</>}
                        </button>
                     </div>
                  </form>

                     <h3 className="text-sm font-black text-slate-700 mb-4 flex items-center gap-2">
                        <Utensils size={16}/> Lista de Mesas <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded-md text-xs">{mesas.length}</span>
                     </h3>
                     
                     {mesas.length === 0 ? (
                        <div className="text-center py-8 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                           <p className="text-slate-400 font-bold text-sm">Nenhuma mesa foi criada ainda.</p>
                        </div>
                     ) : (
                        <div className="flex flex-col gap-2">
                           {mesas.map(m => (
                              <div key={m.id} className="flex justify-between items-center p-3 bg-white border border-slate-200 rounded-xl shadow-sm hover:border-slate-300 transition-colors">
                                 <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-black text-slate-600">
                                       {m.numero_mesa}
                                    </div>
                                    <span className={`text-xs font-bold px-2 py-1 rounded-md uppercase ${m.status==='ocupada' ? 'bg-blue-100 text-blue-600' : 'bg-emerald-100 text-emerald-600'}`}>{m.status}</span>
                                 </div>
                                 <div className="flex gap-2">
                                    <button onClick={() => setQrMesa(m)} className="p-2 bg-slate-100 text-slate-500 rounded-lg hover:bg-slate-200 transition" title="Gerar QR Code">
                                       <Barcode size={18} />
                                    </button>
                                    <button onClick={async () => {
                                       if(m.status === 'ocupada') {
                                          alert("Você não pode excluir uma mesa ocupada!"); return;
                                       }
                                       if(confirm(`Deseja mesmo excluir a mesa ${m.numero_mesa}?`)) {
                                          // Excluir usando supabase
                                          const { error } = await supabase.from('mesas').delete().eq('id', m.id);
                                          if(!error) await carregarMesas();
                                       }
                                    }} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                                       <Trash2 size={18}/>
                                    </button>
                                 </div>
                              </div>
                           ))}
                        </div>
                     )}
                  </div>
            </div>
         </div>
      )}

      {/* PAINEL LATERAL: PEDIDOS ONLINE (QR CODE / DELIVERY) */}
      {painelOnline && (
        <div className="fixed inset-0 z-[100] flex justify-end bg-black/60 backdrop-blur-sm">
          <div className="w-[400px] bg-white h-full shadow-2xl flex flex-col animate-slide-in-right">
            
            {/* Header do Painel */}
            <div className="bg-orange-500 text-white p-4 flex justify-between items-center shrink-0 shadow-md z-10 relative">
               <div className="flex items-center gap-2">
                 <Bell size={20} className="animate-pulse" />
                 <h2 className="font-black text-lg">Pedidos Online</h2>
               </div>
               <button onClick={() => setPainelOnline(false)} className="p-2 hover:bg-white/20 rounded-full transition-colors">
                 <X size={20} />
               </button>
            </div>

            {/* Conteúdo (Lista) */}
            <div className="flex-1 overflow-y-auto p-4 bg-slate-50 flex flex-col gap-4 relative">
               {carregandoPainel ? (
                  <div className="flex items-center justify-center h-full text-slate-400">
                     <p className="font-bold animate-pulse">Carregando pedidos...</p>
                  </div>
               ) : pedidosOnlineDetalhes.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2 opacity-60">
                     <ShoppingBag size={48} strokeWidth={1} />
                     <p className="font-bold">Nenhum pedido online pendente.</p>
                  </div>
               ) : (
                  pedidosOnlineDetalhes.map(pedido => (
                     <div key={pedido.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                        
                        {/* Cabeçalho do Card */}
                        <div className="p-3 border-b border-slate-100 flex justify-between items-start bg-slate-50/50">
                           <div>
                              <div className="flex gap-2 items-center mb-1">
                                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${pedido.tipo_pedido === 'qrcode' ? 'bg-purple-100 text-purple-700' : 'bg-red-100 text-red-700'}`}>
                                   {pedido.tipo_pedido}
                                </span>
                                <span className="text-xs font-bold text-slate-500">#{pedido.numero_pedido}</span>
                              </div>
                              <h3 className="font-black text-slate-800 uppercase">{pedido.cliente_nome || 'Cliente não informado'}</h3>
                              {pedido.cliente_telefone && <p className="text-xs text-slate-500 mt-0.5 font-mono">{pedido.cliente_telefone}</p>}
                           </div>
                           <div className="text-right">
                              <span className="text-xs font-bold text-orange-600 bg-orange-100 px-2 py-1 rounded-md uppercase">
                                {pedido.status.replace('_', ' ')}
                              </span>
                              <p className="text-[10px] text-slate-400 mt-2">{new Date(pedido.created_at).toLocaleTimeString().slice(0,5)}</p>
                           </div>
                        </div>

                        {/* Itens */}
                        <div className="p-3 bg-white text-xs space-y-2">
                           {pedido.pedidos_itens?.map((it, idx) => (
                              <div key={idx} className="flex justify-between border-b border-slate-50 pb-2 last:border-0 last:pb-0">
                                 <div>
                                    <span className="font-bold">{it.quantidade}x</span> {it.produtos?.nome_produto}
                                    {it.observacao && <p className="text-[10px] text-slate-400 mt-0.5 italic">Obs: {it.observacao}</p>}
                                 </div>
                                 <span className="font-medium">{fmtBRL(it.valor_unitario * it.quantidade)}</span>
                              </div>
                           ))}
                        </div>

                        {/* Totais e Pagamento */}
                        <div className="px-3 py-2 bg-slate-50 border-t border-slate-100 text-xs flex justify-between items-center font-bold">
                           <span className="text-slate-500 font-normal uppercase flex items-center gap-1">
                             <CreditCard size={12}/> Pagamento: {pedido.forma_pagamento || 'N/A'}
                             {pedido.troco_para && <span className="text-[10px] bg-yellow-100 text-yellow-800 px-1 rounded ml-1">Troco p/ {fmtBRL(parseFloat(pedido.troco_para))}</span>}
                           </span>
                           <span className="text-sm">{fmtBRL(pedido.valor_total)}</span>
                        </div>

                        {/* Ações (Apenas para novos) */}
                        {pedido.status === 'novo_online' && (
                           <div className="p-3 flex gap-2 border-t border-slate-200 bg-white">
                              <button onClick={() => handleRecusarPedido(pedido.id)} className="flex-1 py-2 text-xs font-bold text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-red-100">
                                Recusar
                              </button>
                              <button onClick={() => handleAceitarPedido(pedido.id)} className="flex-1 py-2 text-xs font-bold text-white bg-orange-500 hover:bg-orange-600 rounded-lg transition-colors shadow-sm flex items-center justify-center gap-1">
                                <CheckCircle size={14}/> Aceitar Pedido
                              </button>
                           </div>
                        )}

                        {/* Ações para Chamada de TV */}
                        {(pedido.status === 'preparando_delivery' || pedido.status === 'preparando' || pedido.status === 'aberto' || pedido.status === 'pronto') && (
                           <div className="p-3 flex gap-2 border-t border-slate-200 bg-slate-50">
                              <button onClick={() => handleChamarTV(pedido.id)} disabled={pedido.status === 'pronto'} className="flex-1 py-2 text-xs font-bold text-blue-700 bg-blue-100 hover:bg-blue-200 disabled:opacity-50 rounded-lg transition-colors flex items-center justify-center gap-1">
                                <Bell size={14}/> {pedido.status === 'pronto' ? 'Chamado' : 'Chamar na TV'}
                              </button>
                              <button onClick={() => handleEntregue(pedido.id)} className="flex-1 py-2 text-xs font-bold text-emerald-700 bg-emerald-100 hover:bg-emerald-200 rounded-lg transition-colors flex items-center justify-center gap-1">
                                <CheckCircle size={14}/> Entregue
                              </button>
                           </div>
                        )}
                     </div>
                  ))
               )}
            </div>

            <style dangerouslySetInnerHTML={{__html: `
               @keyframes slideInRight {
                 from { transform: translateX(100%); }
                 to { transform: translateX(0); }
               }
               .animate-slide-in-right {
                 animation: slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
               }
            `}} />
          </div>
        </div>
      )}

    </div>
  );
}
