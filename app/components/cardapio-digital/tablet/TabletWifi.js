"use client";

import { QRCodeSVG } from "qrcode.react";
import { textoQrWifi } from "../../../lib/cardapio-digital.mjs";
import { textoDelivery } from "../../../lib/cardapio-textos-delivery.mjs";
import { BotaoRedondo, Icone } from "../ui";
import s from "./janela.module.css";

// Wi-Fi dos clientes no tablet (protótipo TabletWifi, 9J): QR grande no
// padrão WIFI: e a rede e a senha por extenso, como o dono cadastrou em
// "Link e QR Code". Sem rede cadastrada o botão nem aparece.
export default function TabletWifi({ wifi, idioma = "pt", onFechar }) {
  const T = (k) => textoDelivery(idioma, k);
  const texto = textoQrWifi(wifi);
  if (!texto) return null;
  return (
    <div className={s.fundo} onClick={(e) => { if (e.target === e.currentTarget) onFechar?.(); }}>
      <div className={`${s.janela} ${s.janelaWifi}`} role="dialog" aria-modal="true" aria-labelledby="t-wifi" lang={idioma}>
        <BotaoRedondo rotulo={T("fechar")} onClick={onFechar} className={s.fecharCanto} />
        <div className={s.qr}>
          <QRCodeSVG value={texto} size={304} marginSize={0} bgColor="#FFFFFF" fgColor="#1A1A1A" role="img" aria-label="QR Code Wi-Fi" />
        </div>
        <div className={s.wifiTextos}>
          <span className={s.wifiIcone}><Icone nome="wifi" tamanho={28} traco={2.2} /></span>
          <h1 id="t-wifi" className={s.wifiTitulo}>{T("wifi_titulo")}</h1>
          <p className={s.wifiComo}>{T("wifi_como")}</p>
          <div className={s.credenciais}>
            <span><span className={s.credRotulo}>{T("wifi_rede")}</span> <strong>{wifi.rede}</strong></span>
            <span><span className={s.credRotulo}>{T("wifi_senha")}</span> {wifi.senha ? <strong>{wifi.senha}</strong> : <span className={s.credRotulo}>{T("wifi_aberta")}</span>}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
