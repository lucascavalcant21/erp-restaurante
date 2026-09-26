"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { ArrowLeft, Bluetooth, CheckCircle2, ChefHat, FolderOpen, GlassWater, Maximize2, Mic, Minus, Plus, Printer, RefreshCw, Save, Search, Tag, Trash2, UserRound, X, XCircle } from "lucide-react";
import { useERP } from "../context/ERPContext";
import { fetchEstoque } from "../lib/estoque";
import { fetchProdutos } from "../lib/vendas";
import { fetchFichas } from "../lib/operacao";
import { fetchColaboradores } from "../lib/rh";
import { CONSERVACAO, criarEtiqueta, excluirListaEtiquetas, fetchListasEtiquetas, gerarCodigo, salvarListaEtiquetas } from "../lib/etiquetas";
import { fetchValidadesEtiqueta, fetchPerfisEtiquetas } from "../lib/parametros";
import { imprimirHtml } from "../lib/imprimir";
import { criarEscuta, vozDisponivel } from "../lib/hefisto-voz";
import { equipeDaArea } from "../lib/equipe-area.mjs";
import { registrarAuditoria } from "../lib/hefisto-acoes";
import { conectarImpressoraBluetooth, imprimirEtiquetasBluetooth } from "../lib/impressaoTermica";
import { WebUsbDisponivel, imprimirEtiquetaMdk022Usb, imprimirFilaMdk022Usb } from "../lib/impressaoMdk022";

const UNIDADES = ["UN", "UNIDADE", "GARRAFA", "LATA", "KG", "G", "L", "ML", "CX", "PCT", "BANDEJA"];
const TAMANHOS = {
  "60x40": { w: 60, h: 40, pad: 1.5, titulo: 3.8, texto: 2.2, pequeno: 1.7, qr: 32 },
  "80x40": { w: 80, h: 40, pad: 2, titulo: 4.1, texto: 2.75, pequeno: 2.15, qr: 41 },
  "60x60": { w: 60, h: 60, pad: 2.5, titulo: 4.3, texto: 2.8, pequeno: 2.25, qr: 55 },
};

const numero = valor => Number(valor) || 0;
const validadeDe = (momento, dias) => new Date(momento.getTime() + Math.max(0, numero(dias)) * 86400000);
const dataHora = data => data.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
const dataCurta = data => data.toLocaleDateString("pt-BR");
const chaveListasLocais = (unidadeId, setor) => `hefisto_listas_etiquetas_${unidadeId || "sem-unidade"}_${setor || "todos"}`;

function lerListasLocais(unidadeId, setor) {
  try { return JSON.parse(localStorage.getItem(chaveListasLocais(unidadeId, setor)) || "[]"); } catch { return []; }
}

function gravarListasLocais(unidadeId, setor, listas) {
  try { localStorage.setItem(chaveListasLocais(unidadeId, setor), JSON.stringify(listas)); } catch {}
}

const normalizarVoz = valor => String(valor || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
const UNIDADES_VOZ = { zero: 0, um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9 };
const NUMEROS_VOZ = { ...UNIDADES_VOZ, dez: 10, onze: 11, doze: 12, treze: 13, quatorze: 14, catorze: 14, quinze: 15, dezesseis: 16, dezassete: 17, dezessete: 17, dezoito: 18, dezenove: 19, vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50, sessenta: 60, setenta: 70, oitenta: 80, noventa: 90, cem: 100 };

function converterNumerosDaVoz(texto) {
  let convertido = normalizarVoz(texto);
  const dezenas = { vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50, sessenta: 60, setenta: 70, oitenta: 80, noventa: 90 };
  convertido = convertido.replace(/\b(vinte|trinta|quarenta|cinquenta|sessenta|setenta|oitenta|noventa) e (um|uma|dois|duas|tres|quatro|cinco|seis|sete|oito|nove)\b/g, (_, dezena, unidade) => String(dezenas[dezena] + UNIDADES_VOZ[unidade]));
  return convertido.replace(/\b(zero|um|uma|dois|duas|tres|quatro|cinco|seis|sete|oito|nove|dez|onze|doze|treze|quatorze|catorze|quinze|dezesseis|dezassete|dezessete|dezoito|dezenove|vinte|trinta|quarenta|cinquenta|sessenta|setenta|oitenta|noventa|cem)\b/g, palavra => String(NUMEROS_VOZ[palavra]));
}

function nomeBonitoVoz(nome) {
  return String(nome || "").trim().replace(/\b\w/g, letra => letra.toUpperCase());
}

function Aviso({ aviso, fechar }) {
  // fechar chega como função nova a cada render do pai. Com ela na lista de
  // dependências, o efeito reiniciava o cronômetro a CADA renderização — e a
  // tela de etiquetas renderiza o tempo todo (busca, seleção, fila). O aviso
  // só sumia quando a tela finalmente parava, muito depois dos 1,6s.
  //
  // A ref guarda sempre a última versão da função sem entrar nas dependências.
  const fecharRef = useRef(fechar);
  fecharRef.current = fechar;

  useEffect(() => {
    // Confirmação de rotina ("X adicionado à fila") o operador já sabe que deu
    // certo — banner tapando a tela só atrasa a próxima etiqueta. Erro fica
    // mais tempo: esse precisa ser lido antes de sumir.
    const timer = setTimeout(() => fecharRef.current(), aviso.tipo === "erro" ? 5200 : 1400);
    return () => clearTimeout(timer);
  }, [aviso]);
  return <div className={`etq-toast ${aviso.tipo}`}>
    {aviso.tipo === "ok" ? <CheckCircle2 size={20} /> : <XCircle size={20} />}
    <span>{aviso.texto}</span><button onClick={fechar}><X size={17} /></button>
  </div>;
}

// Prévia da etiqueta de nome no tamanho real, reduzida só para caber na tela.
function PreviaNome({ item, tamanho }) {
  const dim = TAMANHOS[tamanho] || TAMANHOS["60x40"];
  const larguraPx = dim.w * 3.7795;                 // mm -> px
  const escalaTela = Math.min(1, 268 / larguraPx);
  return (
    <div className="etq-previa" style={{ height: `${dim.h * 3.7795 * escalaTela + 2}px` }}>
      <div style={{ transform: `scale(${escalaTela})`, transformOrigin: "top center" }}>
        <EtiquetaPapel item={{ ...item, modeloEtiqueta: "nome" }} tamanho={tamanho} />
      </div>
    </div>
  );
}

function EtiquetaPapel({ item, responsavel, unidadeInfo, momento, tamanho = "60x40", tipoEtiqueta }) {
  const dim = TAMANHOS[tamanho] || TAMANHOS["60x40"];
  if (item.modeloEtiqueta === "nome") {
    const nomes = [item.nome, item.nome2].map(n => String(n || "").trim()).filter(Boolean);
    const maior = nomes.reduce((m, n) => Math.max(m, n.length), 0);
    const base = maior > 32 ? dim.titulo * 1.45 : maior > 20 ? dim.titulo * 1.7 : dim.titulo * 2.15;
    const escala = Math.min(2, Math.max(0.5, Number(item.escalaNome) || 1));
    const tamanhoNome = (nomes.length > 1 ? base * 0.62 : base) * escala;
    return <div className="etiqueta-rapida-papel etiqueta-somente-nome" style={{ width: `${dim.w}mm`, height: `${dim.h}mm`, padding: `${dim.pad + 1}mm`, background: "#fff", color: "#000", fontFamily: "Arial,Helvetica,sans-serif", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
      <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: nomes.length > 1 ? "1.2mm" : 0 }}>
        {nomes.map((nome, i) => (
          <div key={i} style={{ fontSize: `${tamanhoNome}mm`, lineHeight: 1.05, fontWeight: 950, textAlign: "center", textTransform: "uppercase", overflowWrap: "anywhere" }}>{nome}</div>
        ))}
      </div>
    </div>;
  }

  const validade = validadeDe(momento, item.dias);
  const origem = typeof window !== "undefined" ? window.location.origin : "";
  const labelTipo = tipoEtiqueta === "aberto" ? "MANIPULADO" : "FECHADO";
  const labelManip = tipoEtiqueta === "aberto" ? "MANIPULAÇÃO:" : "ETIQUETADO:";

  return (
    <div className="etiqueta-rapida-papel" style={{
      width: `${dim.w}mm`,
      height: `${dim.h}mm`,
      padding: "0.8mm 1.5mm 0.8mm 1.5mm",
      background: "#fff",
      color: "#000",
      fontFamily: "Arial, Helvetica, sans-serif",
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-between",
      overflow: "hidden",
      boxSizing: "border-box",
      position: "relative"
    }}>
      {/* 1. PRODUTO NO TOPO (Nível 1 — Maior e Bold Forte, Sem Vazio Superior) */}
      <div>
        <div style={{
          fontSize: `${item.nome?.length > 22 ? "3.2mm" : "4.2mm"}`,
          lineHeight: 1.05,
          fontWeight: 950,
          textTransform: "uppercase",
          letterSpacing: "-0.2px",
          color: "#000",
          wordBreak: "break-word"
        }}>
          {item.nome}
        </div>

        {/* 2. CONSERVAÇÃO / TIPO (Esquerda) + PESO / QTD (Direita) (Nível 2 — Bold) */}
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: `${dim.texto * 0.85}mm`,
          fontWeight: 900,
          marginTop: "0.6mm",
          marginBottom: "0.4mm",
          color: "#000"
        }}>
          <span>{item.conservacao?.toUpperCase()} / {labelTipo}</span>
          {numero(item.quantidade) > 0 && (
            <span style={{ fontWeight: 950 }}>{item.quantidade} {item.unidade}</span>
          )}
        </div>

        {/* 3. DIVISÓRIA 1 */}
        <div style={{ height: "0.3mm", background: "#000", margin: "0.3mm 0 0.5mm 0" }} />

        {/* 4. BLOCO DE DATAS & LOTE (Compactado Verticialmente, Validade em Destaque) */}
        <div style={{ fontSize: `${dim.texto * 0.85}mm`, lineHeight: 1.2, fontWeight: 700 }}>
          <div style={{ display: "flex", gap: "1.5mm" }}>
            <span style={{ width: "20mm", fontWeight: 900 }}>{labelManip}</span>
            <span>{dataHora(momento)}</span>
          </div>
          <div style={{ display: "flex", gap: "1.5mm", fontSize: `${dim.texto * 0.98}mm`, fontWeight: 950, margin: "0.1mm 0" }}>
            <span style={{ width: "20mm" }}>VALIDADE:</span>
            <span>{tipoEtiqueta === "aberto" ? dataHora(validade) : dataCurta(validade)}</span>
          </div>
          <div style={{ display: "flex", gap: "1.5mm" }}>
            <span style={{ width: "20mm", fontWeight: 900 }}>LOTE:</span>
            <span>{item.lote || "COZINHA"}</span>
          </div>
        </div>

        {/* 5. SEGUNDA DIVISÓRIA */}
        <div style={{ height: "0.3mm", background: "#000", margin: "0.5mm 0 0.4mm 0" }} />

        {/* 6. RESPONSÁVEL (RESP. em Negrito, Nome Completo) */}
        <div style={{ fontSize: `${dim.texto * 0.78}mm`, fontWeight: 700, lineHeight: 1.1, textTransform: "uppercase" }}>
          <span style={{ fontWeight: 900 }}>RESP.:</span> {String(responsavel?.nome || responsavel || "JOSEPH ANDREY GOMES DA SILVA").toUpperCase()}
        </div>
      </div>

      {/* 7. RODAPÉ (Empresa na esquerda + QR Code e Código no canto inferior direito, QR Mais Alto) */}
      <div style={{
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "space-between",
        borderTop: "0.3mm solid #000",
        paddingTop: "0.4mm",
        marginTop: "0.4mm"
      }}>
        <div style={{ textTransform: "uppercase", maxWidth: "34mm" }}>
          <div style={{ fontSize: `${dim.pequeno * 1.05}mm`, fontWeight: 950 }}>SELDEESTRELA</div>
          <div style={{ fontSize: `${dim.pequeno * 0.75}mm`, fontWeight: 700, opacity: 0.9 }}>COMIDAS NORTISTAS</div>
          <div style={{ fontSize: `${dim.pequeno * 0.75}mm`, fontWeight: 900, fontFamily: "monospace" }}>#{item.codigo}</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.1mm", marginBottom: "0.5mm" }}>
          <QRCodeSVG data-qr-codigo={item.codigo} value={`${origem}/rastreio/${item.codigo}`} size={dim.qr * 0.65} level="M" />
          <div style={{ fontSize: `${dim.pequeno * 0.75}mm`, fontWeight: 900, fontFamily: "monospace" }}>#{item.codigo}</div>
        </div>
      </div>
    </div>
  );
}

