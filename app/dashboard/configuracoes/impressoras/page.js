"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Printer, Usb, RefreshCw, CheckCircle, AlertTriangle, XCircle,
  Cpu, Layers, Send, HelpCircle, Info, ArrowLeft, Loader2,
  Terminal, ShieldCheck, Activity, Zap
} from "lucide-react";

// Converte ArrayBuffer / Uint8Array para string hex para inspeção no diagnóstico
function bufferToHex(buffer) {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, "0").toUpperCase())
    .join(" ");
}

export default function DiagnosticoImpressorasUsbPage() {
  const [suportaWebUsb, setSuportaWebUsb] = useState(false);
  const [userAgent, setUserAgent] = useState("");
  const [dispositivosAutorizados, setDispositivosAutorizados] = useState([]);
  const [carregandoDispositivos, setCarregandoDispositivos] = useState(true);

  // Dispositivo selecionado e estado da conexão
  const [dispositivoAtivo, setDispositivoAtivo] = useState(null);
  const [statusConexao, setStatusConexao] = useState("desconectado"); // desconectado | conectando | conectado | erro
  const [mensagemErro, setMensagemErro] = useState("");
  const [interfaceSelecionada, setInterfaceSelecionada] = useState(null);
  const [endpointOut, setEndpointOut] = useState(null);
  const [endpointIn, setEndpointIn] = useState(null);

  // Histórico de logs de diagnóstico
  const [logs, setLogs] = useState([]);
  const [imprimindoTeste, setImprimindoTeste] = useState(false);
  const [ultimoResultadoImpressao, setUltimoResultadoImpressao] = useState(null);

  const adicionarLog = useCallback((tipo, mensagem, detalhe = null) => {
    const hora = new Date().toLocaleTimeString("pt-BR");
    setLogs(prev => [
      { id: Date.now() + Math.random(), hora, tipo, mensagem, detalhe },
      ...prev.slice(0, 49) // Mantém últimos 50 logs
    ]);
  }, []);

  // 1. Verifica suporte a WebUSB e lista dispositivos autorizados no carregamento
  const atualizarListaDispositivos = useCallback(async () => {
    setCarregandoDispositivos(true);
    if (typeof navigator !== "undefined") {
      setUserAgent(navigator.userAgent || "");
      const temUsb = !!(navigator.usb && typeof navigator.usb.getDevices === "function");
      setSuportaWebUsb(temUsb);

      if (temUsb) {
        try {
          const devs = await navigator.usb.getDevices();
          setDispositivosAutorizados(devs);
          adicionarLog("info", `${devs.length} dispositivo(s) USB previamente autorizado(s) encontrado(s).`);
        } catch (err) {
          adicionarLog("erro", "Erro ao listar dispositivos USB autorizados:", err.message);
        }
      } else {
        adicionarLog("aviso", "WebUSB (navigator.usb) não está disponível neste navegador/ambiente.");
      }
    }
    setCarregandoDispositivos(false);
  }, [adicionarLog]);

  useEffect(() => {
    atualizarListaDispositivos();

    // Listeners para conectar e desconectar dispositivos USB em tempo real
    if (typeof navigator !== "undefined" && navigator.usb) {
      const handleConnect = (event) => {
        adicionarLog("sucesso", "Novo dispositivo USB conectado ao aparelho:", event.device.productName || "Dispositivo Desconhecido");
        atualizarListaDispositivos();
      };
      const handleDisconnect = (event) => {
        adicionarLog("aviso", "Dispositivo USB desconectado do aparelho:", event.device.productName || "Dispositivo Desconhecido");
        if (dispositivoAtivo && dispositivoAtivo === event.device) {
          desconectarImpressora("Dispositivo desconectado fisicamente.");
        }
        atualizarListaDispositivos();
      };

      navigator.usb.addEventListener("connect", handleConnect);
      navigator.usb.addEventListener("disconnect", handleDisconnect);

      return () => {
        navigator.usb.removeEventListener("connect", handleConnect);
        navigator.usb.removeEventListener("disconnect", handleDisconnect);
      };
    }
  }, [atualizarListaDispositivos, dispositivoAtivo, adicionarLog]);

  // 2. Solicitar autorização de novo dispositivo USB (DEVE acontecer em clique de botão)
  const procurarImpressoraUsb = async () => {
    setMensagemErro("");
    if (!suportaWebUsb) {
      setMensagemErro("WebUSB não é suportado neste navegador. Use o Google Chrome no Android ou aplicativo Hefisto TWA.");
      return;
    }

    try {
      adicionarLog("info", "Solicitando seleção de dispositivo USB ao usuário...");
      // Filtros vazios permitem que o usuário escolha qualquer impressora/dispositivo USB conectado
      const device = await navigator.usb.requestDevice({ filters: [] });
      adicionarLog("sucesso", `Dispositivo selecionado pelo usuário: ${device.productName || "Sem Nome"} (Vendor: 0x${device.vendorId.toString(16)}, Product: 0x${device.productId.toString(16)})`);
      await conectarImpressora(device);
      await atualizarListaDispositivos();
    } catch (err) {
      if (err.name === "NotFoundError" || err.message?.includes("No device selected")) {
        setMensagemErro("Seleção cancelada pelo usuário.");
        adicionarLog("aviso", "Seleção de dispositivo USB foi cancelada pelo usuário.");
      } else {
        setMensagemErro(`Erro ao solicitar dispositivo: ${err.message}`);
        adicionarLog("erro", "Erro ao solicitar dispositivo USB:", err.message);
      }
    }
  };

  // 3. Conectar e inspecionar a impressora selecionada
  const conectarImpressora = async (device) => {
    setStatusConexao("conectando");
    setMensagemErro("");
    setInterfaceSelecionada(null);
    setEndpointOut(null);
    setEndpointIn(null);

    try {
      adicionarLog("info", `Abrindo comunicação com o dispositivo (0x${device.vendorId.toString(16)}:0x${device.productId.toString(16)})...`);
      await device.open();

      // Seleciona a configuração 1 se nenhuma estiver ativa
      if (device.configuration === null) {
        adicionarLog("info", "Selecionando configuração 1 do dispositivo...");
        await device.selectConfiguration(1);
      }

      // Procura por uma interface compatível (Preferência: Classe 7 - Printer ou primeira interface com endpoint Bulk OUT)
      let targetInterface = null;
      let targetOutEndpoint = null;
      let targetInEndpoint = null;

      const interfaces = device.configuration?.interfaces || [];
      adicionarLog("info", `Analisando ${interfaces.length} interface(s) USB disponíveis...`);

      for (const iface of interfaces) {
        for (const alt of iface.alternates) {
          // Procura endpoints do tipo 'bulk'
          const outEp = alt.endpoints.find(e => e.direction === "out" && e.type === "bulk");
          const inEp = alt.endpoints.find(e => e.direction === "in" && e.type === "bulk");

          if (outEp) {
            targetInterface = iface;
            targetOutEndpoint = outEp;
            targetInEndpoint = inEp || null;

            // Se for classe 7 (Printer), é prioridade máxima
            if (alt.interfaceClass === 7) {
              break;
            }
          }
        }
        if (targetInterface && targetInterface.alternates[0]?.interfaceClass === 7) break;
      }

      if (!targetInterface || !targetOutEndpoint) {
        throw new Error("Nenhum endpoint do tipo Bulk OUT (escrita de dados) foi encontrado nas interfaces desta impressora.");
      }

      adicionarLog("info", `Reivindicando (claimInterface) a interface número ${targetInterface.interfaceNumber}...`);
      await device.claimInterface(targetInterface.interfaceNumber);

      setDispositivoAtivo(device);
      setInterfaceSelecionada(targetInterface.interfaceNumber);
      setEndpointOut(targetOutEndpoint);
      setEndpointIn(targetInEndpoint);
      setStatusConexao("conectado");

      adicionarLog("sucesso", `Impressora conectada com sucesso! Endpoint OUT Bulk: #${targetOutEndpoint.endpointNumber} (Packet size: ${targetOutEndpoint.packetSize}B).`);
    } catch (err) {
      console.error("Erro na conexão WebUSB:", err);
      let msg = err.message || "Falha desconhecida na conexão com o dispositivo.";

      if (err.name === "SecurityError" || msg.includes("protected interface") || msg.includes("claim")) {
        msg = "Acesso negado à interface USB. O dispositivo pode estar em uso pelo sistema operacional ou por outro app.";
      } else if (err.name === "InvalidStateError") {
        msg = "O dispositivo já está aberto ou em estado inválido.";
      }

      setMensagemErro(msg);
      setStatusConexao("erro");
      adicionarLog("erro", "Falha na conexão com a impressora:", msg);
    }
  };

  // 4. Desconectar impressora
  const desconectarImpressora = async (motivo = "Desconectado pelo usuário.") => {
    if (dispositivoAtivo) {
      try {
        if (interfaceSelecionada !== null && dispositivoAtivo.opened) {
          await dispositivoAtivo.releaseInterface(interfaceSelecionada);
        }
        if (dispositivoAtivo.opened) {
          await dispositivoAtivo.close();
        }
      } catch (err) {
        console.warn("Erro ao fechar conexão:", err);
      }
    }
    setDispositivoAtivo(null);
    setInterfaceSelecionada(null);
    setEndpointOut(null);
    setEndpointIn(null);
    setStatusConexao("desconectado");
    adicionarLog("info", motivo);
  };

  // 5. Teste de impressão ESC/POS
  const executarTesteImpressaoEscPos = async () => {
    if (!dispositivoAtivo || !dispositivoAtivo.opened || !endpointOut) {
      alert("Nenhuma impressora conectada ou pronta para escrita.");
      return;
    }

    setImprimindoTeste(true);
    setUltimoResultadoImpressao(null);

    try {
      adicionarLog("info", "Montando pacote de teste ESC/POS...");

      // Constrói os dados do teste ESC/POS
      const encoder = new TextEncoder();
      const dataHora = new Date().toLocaleString("pt-BR");

      // Comandos ESC/POS padrão:
      // \x1B\x40 : ESC @ (Inicializa a impressora)
      // \x1B\x61\x01 : ESC a 1 (Alinhamento centralizado)
      // \x1B\x45\x01 : ESC E 1 (Negrito ligado)
      // \x1B\x61\x00 : ESC a 0 (Alinhamento à esquerda)
      // \x1B\x45\x00 : ESC E 0 (Negrito desligado)
      // \x1D\x56\x41\x03 : GS V A 3 (Corte de papel parcial/total)
      const partes = [
        new Uint8Array([0x1B, 0x40]), // Inicializar
        new Uint8Array([0x1B, 0x61, 0x01]), // Centralizado
        new Uint8Array([0x1B, 0x45, 0x01]), // Negrito ON
        encoder.encode("HEFISTO\n"),
        new Uint8Array([0x1B, 0x45, 0x00]), // Negrito OFF
        encoder.encode("SISTEMA DE GESTAO\n\n"),
        new Uint8Array([0x1B, 0x61, 0x00]), // Esquerda
        encoder.encode("--------------------------------\n"),
        encoder.encode(" TESTE DE IMPRESSAO USB (WebUSB)\n"),
        encoder.encode("--------------------------------\n"),
        encoder.encode(`Data: ${dataHora}\n`),
        encoder.encode(`Vendor ID: 0x${dispositivoAtivo.vendorId.toString(16).padStart(4, "0").toUpperCase()}\n`),
        encoder.encode(`Product ID: 0x${dispositivoAtivo.productId.toString(16).padStart(4, "0").toUpperCase()}\n`),
        encoder.encode(`Fabricante: ${dispositivoAtivo.manufacturerName || "N/D"}\n`),
        encoder.encode(`Modelo: ${dispositivoAtivo.productName || "N/D"}\n`),
        encoder.encode(`Endpoint OUT: #${endpointOut.endpointNumber}\n`),
        encoder.encode("--------------------------------\n"),
        encoder.encode("Impressora conectada com sucesso!\n\n\n\n"),
        new Uint8Array([0x1D, 0x56, 0x41, 0x03]) // Comando de corte de papel (GS V A 3)
      ];

      // Junta todos os pedaços em um único ArrayBuffer
      const tamanhoTotal = partes.reduce((acc, p) => acc + p.length, 0);
      const bufferFinal = new Uint8Array(tamanhoTotal);
      let offset = 0;
      for (const p of partes) {
        bufferFinal.set(p, offset);
        offset += p.length;
      }

      adicionarLog("info", `Enviando ${bufferFinal.length} bytes para o Endpoint #${endpointOut.endpointNumber}...`);

      const resultado = await dispositivoAtivo.transferOut(endpointOut.endpointNumber, bufferFinal);

      if (resultado.status === "ok") {
        setUltimoResultadoImpressao({
          sucesso: true,
          bytesEnviados: resultado.bytesWritten,
          hexDump: bufferToHex(bufferFinal.slice(0, 32)) + (bufferFinal.length > 32 ? " ..." : ""),
          status: resultado.status,
          protocolo: "ESC/POS"
        });
        adicionarLog("sucesso", `Teste enviado com sucesso! ${resultado.bytesWritten} bytes gravados no endpoint OUT.`);
      } else {
        throw new Error(`A transferência retornou o status: ${resultado.status}`);
      }
    } catch (err) {
      console.error("Erro ao transmitir impressao:", err);
      setUltimoResultadoImpressao({
        sucesso: false,
        erro: err.message,
        protocolo: "ESC/POS"
      });
      adicionarLog("erro", "Falha no envio do teste de impressão:", err.message);
    } finally {
      setImprimindoTeste(false);
    }
  };

  // 6. Teste de impressão TSPL (MDK-022 / Etiquetas)
  const executarTesteImpressaoTspl = async () => {
    if (!dispositivoAtivo || !dispositivoAtivo.opened || !endpointOut) {
      alert("Nenhuma impressora conectada ou pronta para escrita.");
      return;
    }

    setImprimindoTeste(true);
    setUltimoResultadoImpressao(null);

    try {
      adicionarLog("info", "Montando pacote de teste TSPL...");

      const tsplPayload =
        "SIZE 60 mm,40 mm\r\n" +
        "GAP 2 mm,0 mm\r\n" +
        "DIRECTION 1\r\n" +
        "CLS\r\n" +
        'TEXT 40,40,"3",0,1,1,"HEFISTO"\r\n' +
        'TEXT 40,100,"3",0,1,1,"TESTE USB TSPL"\r\n' +
        'TEXT 40,160,"2",0,1,1,"MDK-022"\r\n' +
        "PRINT 1,1\r\n";

      const encoder = new TextEncoder();
      const bufferFinal = encoder.encode(tsplPayload);

      adicionarLog(
        "info",
        `[TSPL] Enviando ${bufferFinal.length} bytes para o Endpoint #${endpointOut.endpointNumber} (Vendor: 0x${dispositivoAtivo.vendorId.toString(16).padStart(4, "0").toUpperCase()}, Product: 0x${dispositivoAtivo.productId.toString(16).padStart(4, "0").toUpperCase()})...`
      );

      const resultado = await dispositivoAtivo.transferOut(endpointOut.endpointNumber, bufferFinal);

      if (resultado.status === "ok") {
        setUltimoResultadoImpressao({
          sucesso: true,
          bytesEnviados: resultado.bytesWritten,
          hexDump: bufferToHex(bufferFinal.slice(0, 32)) + (bufferFinal.length > 32 ? " ..." : ""),
          status: resultado.status,
          protocolo: "TSPL"
        });
        adicionarLog(
          "sucesso",
          `[TSPL] Teste TSPL enviado com sucesso! ${resultado.bytesWritten} bytes gravados no endpoint #${endpointOut.endpointNumber} (Status: ${resultado.status}).`
        );
      } else {
        throw new Error(`A transferência TSPL retornou o status: ${resultado.status}`);
      }
    } catch (err) {
      console.error("Erro ao transmitir impressao TSPL:", err);
      setUltimoResultadoImpressao({
        sucesso: false,
        erro: err.message,
        protocolo: "TSPL"
      });
      adicionarLog("erro", "[TSPL] Falha no envio do teste de impressão TSPL:", err.message);
    } finally {
      setImprimindoTeste(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-5xl mx-auto w-full font-sans space-y-6">

      {/* CABEÇALHO DA PÁGINA */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-line pb-6">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/configuracoes"
            className="w-10 h-10 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl flex items-center justify-center transition-colors"
            title="Voltar às Configurações"
          >
            <ArrowLeft size={20} />
          </Link>
          <div className="w-12 h-12 bg-slate-800 text-white rounded-xl flex items-center justify-center shadow-lg">
            <Printer size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
              Diagnóstico de Impressoras USB
            </h1>
            <p className="text-sm text-muted font-medium">
              Detecção de hardware via WebUSB no Android / Tablet TWA
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={atualizarListaDispositivos}
          disabled={carregandoDispositivos}
          className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 text-sm transition-colors disabled:opacity-50"
        >
          <RefreshCw size={16} className={carregandoDispositivos ? "animate-spin" : ""} />
          Atualizar dispositivos
        </button>
      </div>

      {/* STATUS DO AMBIENTE E WEBUSB */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card Status WebUSB */}
        <div className={`p-5 rounded-2xl border ${suportaWebUsb ? "bg-emerald-50/60 border-emerald-200" : "bg-rose-50/60 border-rose-200"} flex items-start gap-3`}>
          {suportaWebUsb ? (
            <CheckCircle size={24} className="text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <XCircle size={24} className="text-rose-600 shrink-0 mt-0.5" />
          )}
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-subtle">Suporte WebUSB</p>
            <p className={`text-base font-black ${suportaWebUsb ? "text-emerald-900" : "text-rose-900"}`}>
              {suportaWebUsb ? "Disponível (SIM)" : "Indisponível (NÃO)"}
            </p>
            <p className="text-2xs text-muted mt-1 font-medium">
              {suportaWebUsb
                ? "O navegador aceita chamadas diretas a dispositivos USB via WebUSB."
                : "Este navegador ou ambiente não suporta navigator.usb. Use Chrome no Android ou Hefisto TWA."}
            </p>
          </div>
        </div>

        {/* Card Dispositivos Autorizados */}
        <div className="p-5 rounded-2xl border border-line bg-card flex items-start gap-3 shadow-sm">
          <Usb size={24} className="text-accent shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-subtle">Impressoras Autorizadas</p>
            <p className="text-base font-black text-slate-800">
              {dispositivosAutorizados.length} dispositivo(s)
            </p>
            <p className="text-2xs text-muted mt-1 font-medium">
              Dispositivos USB aos quais você já concedeu permissão neste aparelho.
            </p>
          </div>
        </div>

        {/* Card Estado da Conexão Ativa */}
        <div className="p-5 rounded-2xl border border-line bg-card flex items-start gap-3 shadow-sm">
          <Activity size={24} className="text-violet-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-subtle">Status da Conexão</p>
            <p className="text-base font-black text-slate-800 capitalize flex items-center gap-1.5">
              {statusConexao === "conectado" && <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />}
              {statusConexao === "conectando" && <Loader2 size={16} className="animate-spin text-amber-500" />}
              {statusConexao === "desconectado" && <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />}
              {statusConexao === "erro" && <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />}
              {statusConexao}
            </p>
            <p className="text-2xs text-muted mt-1 font-medium">
              {dispositivoAtivo
                ? `${dispositivoAtivo.productName || "Impressora USB"} conectada`
                : "Nenhuma impressora ativa no momento"}
            </p>
          </div>
        </div>
      </div>

      {/* MENSAGEM DE ERRO (SE HOUVER) */}
      {mensagemErro && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-2xl flex items-start gap-3 text-sm">
          <AlertTriangle size={20} className="text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-bold">Atenção no Diagnóstico</p>
            <p className="text-xs mt-0.5">{mensagemErro}</p>
          </div>
        </div>
      )}

      {/* SEÇÃO PRINCIPAL: IMPRESSORAS NO DISPOSITIVO */}
      <div className="bg-card rounded-2xl shadow-sm border border-line overflow-hidden">
        <div className="bg-slate-50 border-b border-line-soft p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Usb size={18} className="text-accent" />
            <h2 className="font-bold text-slate-800">Impressoras no dispositivo</h2>
          </div>
          <button
            type="button"
            onClick={procurarImpressoraUsb}
            disabled={!suportaWebUsb || statusConexao === "conectando"}
            className="bg-accent hover:bg-accent disabled:opacity-50 text-accent-fg font-bold py-2.5 px-5 rounded-xl shadow-md flex items-center justify-center gap-2 text-sm transition-all"
          >
            <Usb size={16} />
            Procurar impressora USB
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* LISTA DE DISPOSITIVOS JA AUTORIZADOS */}
          {dispositivosAutorizados.length > 0 ? (
            <div className="space-y-3">
              <p className="text-xs font-bold uppercase tracking-widest text-subtle">
                Dispositivos Conectados / Autorizados
              </p>
              <div className="grid grid-cols-1 gap-3">
                {dispositivosAutorizados.map((dev, idx) => {
                  const estaAtivo = dispositivoAtivo === dev && statusConexao === "conectado";
                  const vendorHex = `0x${dev.vendorId.toString(16).padStart(4, "0").toUpperCase()}`;
                  const productHex = `0x${dev.productId.toString(16).padStart(4, "0").toUpperCase()}`;

                  return (
                    <div
                      key={idx}
                      className={`p-4 rounded-xl border transition-all ${
                        estaAtivo
                          ? "border-emerald-500 bg-emerald-50/30 ring-2 ring-emerald-500/20"
                          : "border-line bg-slate-50/50 hover:bg-slate-50"
                      } flex flex-col md:flex-row md:items-center justify-between gap-4`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-slate-800 text-base">
                            {dev.productName || "Impressora / Dispositivo USB"}
                          </span>
                          {estaAtivo && (
                            <span className="bg-emerald-100 text-emerald-800 text-3xs font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                              Conectado
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted font-medium flex flex-wrap items-center gap-x-3 gap-y-1">
                          <span>Fabricante: <b>{dev.manufacturerName || "Não Informado"}</b></span>
                          <span>•</span>
                          <span>Vendor ID: <code className="bg-slate-200/70 px-1 py-0.5 rounded text-fg-soft font-mono">{vendorHex}</code></span>
                          <span>•</span>
                          <span>Product ID: <code className="bg-slate-200/70 px-1 py-0.5 rounded text-fg-soft font-mono">{productHex}</code></span>
                          {dev.serialNumber && (
                            <>
                              <span>•</span>
                              <span>Série: <b>{dev.serialNumber}</b></span>
                            </>
                          )}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {estaAtivo ? (
                          <button
                            type="button"
                            onClick={() => desconectarImpressora("Desconectado a pedido do usuário.")}
                            className="bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold py-2 px-4 rounded-xl text-xs transition-colors"
                          >
                            Desconectar
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => conectarImpressora(dev)}
                            disabled={statusConexao === "conectando"}
                            className="bg-slate-800 hover:bg-slate-900 text-white font-bold py-2 px-4 rounded-xl text-xs transition-colors flex items-center gap-1.5"
                          >
                            {statusConexao === "conectando" ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
                            Conectar & Inspecionar
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="bg-slate-50 border border-dashed border-line rounded-xl p-8 text-center space-y-3">
              <div className="w-12 h-12 bg-slate-200 text-muted rounded-full flex items-center justify-center mx-auto">
                <Usb size={24} />
              </div>
              <div>
                <p className="font-bold text-slate-800 text-sm">Nenhuma impressora USB selecionada ainda</p>
                <p className="text-xs text-muted max-w-md mx-auto mt-1 font-medium">
                  Conecte a impressora térmica/etiquetas ao tablet Android usando o adaptador USB-C e clique no botão acima para permitir o acesso do navegador.
                </p>
              </div>
            </div>
          )}

          {/* DETALHES DE DIAGNÓSTICO DO DISPOSITIVO ATIVO */}
          {dispositivoAtivo && (
            <div className="border-t border-line-soft pt-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h3 className="text-sm font-bold uppercase tracking-widest text-subtle flex items-center gap-2">
                  <Cpu size={16} className="text-accent" />
                  Inspeção Técnica de Interfaces & Endpoints
                </h3>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={executarTesteImpressaoEscPos}
                    disabled={imprimindoTeste || !endpointOut}
                    className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-black py-2.5 px-5 rounded-xl shadow-lg shadow-emerald-600/20 flex items-center gap-2 text-sm transition-all"
                  >
                    {imprimindoTeste ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                    Imprimir teste (ESC/POS)
                  </button>

                  <button
                    type="button"
                    onClick={executarTesteImpressaoTspl}
                    disabled={imprimindoTeste || !endpointOut}
                    className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-black py-2.5 px-5 rounded-xl shadow-lg shadow-indigo-600/20 flex items-center gap-2 text-sm transition-all"
                  >
                    {imprimindoTeste ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                    Imprimir teste TSPL
                  </button>
                </div>
              </div>

              {/* GRID DE INFORMAÇÕES TÉCNICAS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div className="bg-slate-50 border border-line p-3 rounded-xl">
                  <p className="text-subtle font-bold uppercase tracking-wider text-3xs">Vendor ID</p>
                  <p className="font-mono font-bold text-slate-800 mt-0.5">
                    0x{dispositivoAtivo.vendorId.toString(16).padStart(4, "0").toUpperCase()} ({dispositivoAtivo.vendorId})
                  </p>
                </div>
                <div className="bg-slate-50 border border-line p-3 rounded-xl">
                  <p className="text-subtle font-bold uppercase tracking-wider text-3xs">Product ID</p>
                  <p className="font-mono font-bold text-slate-800 mt-0.5">
                    0x{dispositivoAtivo.productId.toString(16).padStart(4, "0").toUpperCase()} ({dispositivoAtivo.productId})
                  </p>
                </div>
                <div className="bg-slate-50 border border-line p-3 rounded-xl">
                  <p className="text-subtle font-bold uppercase tracking-wider text-3xs">Interface Ativa</p>
                  <p className="font-mono font-bold text-slate-800 mt-0.5">
                    {interfaceSelecionada !== null ? `Interface #${interfaceSelecionada}` : "Nenhuma"}
                  </p>
                </div>
                <div className="bg-slate-50 border border-line p-3 rounded-xl">
                  <p className="text-subtle font-bold uppercase tracking-wider text-3xs">Endpoint OUT (Bulk)</p>
                  <p className="font-mono font-bold text-emerald-700 mt-0.5">
                    {endpointOut ? `#${endpointOut.endpointNumber} (${endpointOut.packetSize}B)` : "Não Encontrado"}
                  </p>
                </div>
              </div>

              {/* ESTRUTURA COMPLETA DE INTERFACES DO DISPOSITIVO */}
              <div className="bg-slate-900 text-slate-200 p-4 rounded-xl font-mono text-2xs overflow-x-auto space-y-2">
                <p className="text-emerald-400 font-bold border-b border-slate-800 pb-1">
                  // Mapeamento completo de Interfaces & Endpoints USB
                </p>
                {dispositivoAtivo.configuration?.interfaces.map((iface, iIndex) => (
                  <div key={iIndex} className="pl-2 space-y-1">
                    <p className="text-amber-300">
                      Interface #{iface.interfaceNumber} (claimed: {iface.claimed ? "SIM" : "NÃO"}):
                    </p>
                    {iface.alternates.map((alt, aIndex) => (
                      <div key={aIndex} className="pl-4 space-y-1 text-slate-400">
                        <p>
                          Alternate #{alt.alternateSetting} (Class: {alt.interfaceClass}, Subclass: {alt.interfaceSubClass}, Protocol: {alt.interfaceProtocol})
                        </p>
                        <div className="pl-4 space-y-0.5 text-slate-300">
                          {alt.endpoints.map((ep, eIndex) => (
                            <p key={eIndex} className={ep.direction === "out" && ep.type === "bulk" ? "text-emerald-300 font-bold" : ""}>
                              → Endpoint #{ep.endpointNumber}: direction={ep.direction.toUpperCase()}, type={ep.type.toUpperCase()}, packetSize={ep.packetSize}B
                            </p>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>

              {/* RESULTADO DO ÚLTIMO TESTE DE IMPRESSÃO */}
              {ultimoResultadoImpressao && (
                <div className={`p-4 rounded-xl border ${ultimoResultadoImpressao.sucesso ? "bg-emerald-50 border-emerald-200 text-emerald-900" : "bg-rose-50 border-rose-200 text-rose-900"} space-y-2`}>
                  <p className="font-bold text-sm flex items-center gap-1.5">
                    {ultimoResultadoImpressao.sucesso ? <CheckCircle size={18} className="text-emerald-600" /> : <XCircle size={18} className="text-rose-600" />}
                    {ultimoResultadoImpressao.sucesso ? "Teste de Impressão Transmitido com Sucesso!" : "Falha na Transmissão de Teste"}
                  </p>
                  {ultimoResultadoImpressao.sucesso ? (
                    <div className="text-xs space-y-1 font-mono">
                      <p>Protocolo: <b>{ultimoResultadoImpressao.protocolo || "ESC/POS"}</b></p>
                      <p>Bytes gravados no Endpoint OUT: <b>{ultimoResultadoImpressao.bytesEnviados} bytes</b></p>
                      <p className="text-2xs text-muted">Hex Dump (Primeiros 32 bytes): <code className="bg-emerald-100 px-1 py-0.5 rounded">{ultimoResultadoImpressao.hexDump}</code></p>
                    </div>
                  ) : (
                    <p className="text-xs">{ultimoResultadoImpressao.erro}</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* PAINEL DE LOGS DE DIAGNÓSTICO EM TEMPO REAL */}
      <div className="bg-card rounded-2xl shadow-sm border border-line overflow-hidden">
        <div className="bg-slate-50 border-b border-line-soft p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Terminal size={18} className="text-muted" />
            <h2 className="font-bold text-slate-800">Log de Diagnóstico do Sistema</h2>
          </div>
          <button
            type="button"
            onClick={() => setLogs([])}
            className="text-2xs font-bold text-subtle hover:text-fg-soft"
          >
            Limpar log
          </button>
        </div>
        <div className="p-4 bg-slate-950 text-slate-300 font-mono text-xs max-h-60 overflow-y-auto space-y-1.5">
          {logs.length > 0 ? (
            logs.map(log => (
              <div key={log.id} className="flex items-start gap-2">
                <span className="text-slate-500 shrink-0">[{log.hora}]</span>
                <span
                  className={
                    log.tipo === "sucesso"
                      ? "text-emerald-400 font-bold"
                      : log.tipo === "erro"
                      ? "text-rose-400 font-bold"
                      : log.tipo === "aviso"
                      ? "text-amber-400 font-bold"
                      : "text-slate-300"
                  }
                >
                  {log.mensagem} {log.detalhe && <span className="text-slate-400 font-normal">{log.detalhe}</span>}
                </span>
              </div>
            ))
          ) : (
            <p className="text-slate-600 italic">Nenhum evento registrado ainda.</p>
          )}
        </div>
      </div>

      {/* INFORMAÇÕES DE COMPATIBILIDADE E AJUDA */}
      <div className="bg-slate-50 border border-line rounded-2xl p-5 space-y-3">
        <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
          <Info size={18} className="text-accent" />
          Como funciona a impressão USB no Hefisto Android?
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-slate-600 font-medium">
          <div>
            <p className="font-bold text-fg-soft mb-1">1. Conexão Física (OTG)</p>
            <p>Conecte a impressora térmica USB à porta USB-C do tablet Android usando um adaptador OTG simples. Ligue a impressora na tomada.</p>
          </div>
          <div>
            <p className="font-bold text-fg-soft mb-1">2. Permissão Única</p>
            <p>Clique no botão <b>"Procurar impressora USB"</b>. O Android exibirá uma janela nativa pedindo confirmação para compartilhar o dispositivo com o app Hefisto.</p>
          </div>
          <div>
            <p className="font-bold text-fg-soft mb-1">3. Protocolo ESC/POS</p>
            <p>A maioria das impressoras térmicas (Epson, Bematech, Elgin, Daruma) fala ESC/POS nativamente via endpoints Bulk OUT.</p>
          </div>
          <div>
            <p className="font-bold text-fg-soft mb-1">4. Compatibilidade Desktop</p>
            <p>No ambiente Windows/Mac, a impressão continua funcionando normalmente via navegador padrão ou QZ Tray sem nenhuma interferência.</p>
          </div>
        </div>
      </div>

    </div>
  );
}
