"use client";

import { useMemo, useRef, useState } from "react";
import { QRCodeCanvas, QRCodeSVG } from "qrcode.react";
import { Check, Copy, Download, ExternalLink, Printer } from "lucide-react";
import { caminhoDoCardapio, limparMesa } from "../../../lib/cardapio-link.mjs";
import { normalizarWifi, textoQrWifi } from "../../../lib/cardapio-digital.mjs";
import { Botao, Campo, Secao, inputCls } from "./ui";

/** "1-12, 15, Varanda" → ["1", …, "12", "15", "Varanda"] (até 200). */
export function lerMesas(texto) {
  const r = [];
  for (const parte of String(texto || "").split(/[,;\n]+/)) {
    const t = parte.trim();
    const faixa = /^(\d{1,4})\s*[-a]\s*(\d{1,4})$/i.exec(t);
    if (faixa) {
      const [a, b] = [Number(faixa[1]), Number(faixa[2])].sort((x, y) => x - y);
      for (let i = a; i <= b && r.length < 200; i++) r.push(String(i));
    } else if (limparMesa(t)) r.push(limparMesa(t));
  }
  return [...new Set(r)].slice(0, 200);
}

function Copiar({ texto }) {
  const [ok, setOk] = useState(false);
  return (
    <Botao variante="secundario" onClick={async () => { try { await navigator.clipboard.writeText(texto); setOk(true); setTimeout(() => setOk(false), 1800); } catch { /* sem permissão */ } }}>
      {ok ? <Check size={16} /> : <Copy size={16} />} {ok ? "Copiado" : "Copiar link"}
    </Botao>
  );
}

/** Rede e senha do Wi-Fi dos clientes (9J): o tablet mostra um QR para conectar. */
function WifiClientes({ config, mudar }) {
  const wifi = normalizarWifi(config?.wifi);
  const mudarWifi = (campos) => mudar((c) => ({ ...c, wifi: { ...normalizarWifi(c.wifi), ...campos } }));
  const texto = textoQrWifi(wifi);
  return (
    <Secao titulo="Wi-Fi dos clientes" subtitulo="Aparece no tablet da mesa, no botão Wi-Fi: um QR Code para o cliente conectar o celular, com a rede e a senha por extenso. Use a rede dos clientes, separada da rede do caixa.">
      <div className="flex flex-wrap items-start gap-4">
        <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-2">
          <Campo rotulo="Nome da rede">
            <input className={inputCls} value={wifi.rede} maxLength={32} onChange={(e) => mudarWifi({ rede: e.target.value })} placeholder="Ex.: CasaBrasa-Clientes" autoComplete="off" />
          </Campo>
          <Campo rotulo="Senha" dica="Em branco = rede aberta.">
            <input className={inputCls} value={wifi.senha} maxLength={63} disabled={!wifi.rede} onChange={(e) => mudarWifi({ senha: e.target.value })} autoComplete="off" />
          </Campo>
        </div>
        {texto ? (
          <div className="rounded-xl border border-hf-border bg-white p-2" aria-label="QR do Wi-Fi">
            <QRCodeSVG value={texto} size={96} marginSize={1} />
          </div>
        ) : null}
      </div>
      {!wifi.rede ? <p className="mt-2 text-xs text-hf-muted">Sem rede cadastrada, o botão Wi-Fi não aparece no tablet.</p> : null}
    </Secao>
  );
}

export default function QrCodes({ unidadeId, nomeLoja, mesasDoBanco, config, mudar }) {
  const origem = typeof window !== "undefined" ? window.location.origin : "";
  const linkGeral = `${origem}${caminhoDoCardapio(unidadeId)}`;
  const [textoMesas, setTextoMesas] = useState(() => mesasDoBanco.map(limparMesa).filter(Boolean).join(", "));
  const mesas = useMemo(() => lerMesas(textoMesas), [textoMesas]);
  const canvas = useRef(null);
  const grade = useRef(null);

  const baixar = () => {
    const c = canvas.current?.querySelector("canvas");
    if (!c) return;
    const a = document.createElement("a");
    a.href = c.toDataURL("image/png");
    a.download = `qr-cardapio-${unidadeId}.png`;
    a.click();
  };

  const imprimirMesas = () => {
    const itens = [...(grade.current?.querySelectorAll("[data-qr-mesa]") || [])].map((el) => el.outerHTML).join("");
    const w = window.open("", "_blank");
    if (!w) return;
    const titulo = String(nomeLoja || "Cardápio").replace(/[<>&"]/g, "");
    w.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>QR das mesas — ${titulo}</title>
      <style>body{font-family:system-ui,sans-serif;margin:16px;color:#111}.g{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
      [data-qr-mesa]{border:1px dashed #999;border-radius:12px;padding:14px;text-align:center;break-inside:avoid}
      [data-qr-mesa] svg{width:150px;height:150px}.m{font-size:22px;font-weight:800;margin:8px 0 2px}.l{font-size:12px;color:#444}
      @media print{body{margin:0}}</style></head><body><div class="g">${itens}</div><script>window.onload=()=>{window.print()}<\/script></body></html>`);
    w.document.close();
  };

  return (
    <div className="space-y-4">
      <Secao titulo="Link do cardápio (delivery e redes sociais)" subtitulo="Para o Instagram, o WhatsApp e o Google. Quem abre por aqui faz pedido de entrega.">
        <div className="flex flex-wrap items-center gap-3">
          <div ref={canvas} className="rounded-xl border border-hf-border bg-white p-2">
            <QRCodeCanvas value={linkGeral} size={148} marginSize={1} />
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <p className="break-all rounded-lg bg-hf-elevated/60 px-3 py-2 font-mono text-xs text-hf-text">{linkGeral}</p>
            <div className="flex flex-wrap gap-2">
              <Copiar texto={linkGeral} />
              <Botao variante="secundario" onClick={baixar}><Download size={16} /> Baixar QR</Botao>
              <a href={caminhoDoCardapio(unidadeId)} target="_blank" rel="noreferrer" className="inline-flex min-h-[44px] items-center gap-2 rounded-xl px-4 text-sm font-bold text-hf-accent hover:bg-hf-accent/5"><ExternalLink size={16} /> Abrir</a>
            </div>
          </div>
        </div>
      </Secao>

      <Secao titulo="QR Code das mesas" subtitulo="Cada mesa tem o seu: o pedido já chega com o número da mesa e o WhatsApp é opcional. Os QR antigos do Experience também abrem este cardápio."
        direita={mesas.length ? <Botao onClick={imprimirMesas}><Printer size={16} /> Imprimir {mesas.length}</Botao> : null}>
        <Campo rotulo="Mesas" dica="Separe por vírgula. Faixa: 1-20. Começa com as mesas cadastradas no Salão.">
          <input className={inputCls} value={textoMesas} onChange={(e) => setTextoMesas(e.target.value)} placeholder="1-20, Varanda1, Varanda2" />
        </Campo>
        <div ref={grade} className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {mesas.map((m) => {
            const url = `${origem}${caminhoDoCardapio(unidadeId, { mesa: m })}`;
            return (
              <div key={m} data-qr-mesa className="rounded-xl border border-hf-border bg-white p-3 text-center">
                <QRCodeSVG value={url} size={120} marginSize={1} className="mx-auto" />
                <div className="m mt-2 text-base font-black text-hf-text">Mesa {m}</div>
                <div className="l text-[11px] text-hf-muted">Aponte a câmera para ver o cardápio e pedir</div>
              </div>
            );
          })}
        </div>
      </Secao>

      {mudar ? <WifiClientes config={config} mudar={mudar} /> : null}
    </div>
  );
}
