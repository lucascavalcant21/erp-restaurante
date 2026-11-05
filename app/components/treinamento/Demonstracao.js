"use client";

// Pequenas demonstrações animadas que acompanham a fala do boneco.
const CSS = `
.hf-dm *{transform-box:fill-box}
.hf-dm-gota{animation:hfDmGota 1s linear infinite}.hf-dm-g2{animation-delay:.3s}.hf-dm-g3{animation-delay:.6s}
.hf-dm-esfrega{animation:hfDmEsfrega .55s ease-in-out infinite alternate}
.hf-dm-sobe{animation:hfDmSobe 2.4s ease-in-out infinite;transform-origin:center bottom}
.hf-dm-tampa{animation:hfDmTampa 2.4s ease-in-out infinite}
.hf-dm-chama{animation:hfDmChama 2.4s ease-in-out infinite;transform-origin:center bottom}
.hf-dm-cola{animation:hfDmCola 2.4s ease-in-out infinite}
.hf-dm-balanca{animation:hfDmBalanca 2.4s ease-in-out infinite;transform-origin:center}
.hf-dm-agita{animation:hfDmAgita .28s ease-in-out infinite alternate;transform-origin:center}
.hf-dm-inclina{animation:hfDmInclina 3s ease-in-out infinite;transform-origin:80% 20%}
.hf-dm-enche{animation:hfDmSobe 3s ease-in-out infinite;transform-origin:center bottom}
.hf-dm-entra{animation:hfDmEntra 2.8s ease-in-out infinite both}.hf-dm-e2{animation-delay:.25s}.hf-dm-e3{animation-delay:.5s}.hf-dm-e4{animation-delay:.75s}
.hf-dm-vapor{animation:hfDmVapor 1.8s ease-in-out infinite}
.hf-dm-pulsa{animation:hfDmPulsa 1s ease-in-out infinite alternate;transform-origin:center}
.hf-dm-corta{animation:hfDmCorta .7s ease-in-out infinite alternate;transform-origin:left bottom}
@keyframes hfDmGota{from{transform:translateY(-8px);opacity:0}30%{opacity:1}to{transform:translateY(34px);opacity:0}}
@keyframes hfDmEsfrega{from{transform:translateX(-6px)}to{transform:translateX(6px)}}
@keyframes hfDmSobe{0%{transform:scaleY(.15)}70%,100%{transform:scaleY(1)}}
@keyframes hfDmTampa{0%,20%{transform:translateY(-40px)}55%,100%{transform:translateY(0)}}
@keyframes hfDmChama{0%,30%{transform:scale(1)}60%,100%{transform:scale(0)}}
@keyframes hfDmCola{0%,20%{transform:translateY(-34px) rotate(-8deg);opacity:0}55%,100%{transform:none;opacity:1}}
@keyframes hfDmBalanca{0%,100%{transform:rotate(-5deg)}50%{transform:rotate(5deg)}}
@keyframes hfDmAgita{from{transform:rotate(-14deg) translateY(-4px)}to{transform:rotate(14deg) translateY(4px)}}
@keyframes hfDmInclina{0%,15%{transform:rotate(0)}45%,80%{transform:rotate(-52deg)}100%{transform:rotate(0)}}
@keyframes hfDmEntra{0%{transform:translateY(-22px);opacity:0}30%,100%{transform:none;opacity:1}}
@keyframes hfDmVapor{from{transform:translateY(6px);opacity:0}50%{opacity:.8}to{transform:translateY(-14px);opacity:0}}
@keyframes hfDmPulsa{from{transform:scale(.92)}to{transform:scale(1.08)}}
@keyframes hfDmCorta{from{transform:rotate(-16deg)}to{transform:rotate(6deg)}}
@media (prefers-reduced-motion:reduce){.hf-dm *{animation:none!important}}
`;
const OURO = "#C5A15A", GRAFITE = "#202124", AGUA = "#60A5FA", FOGO = "#F97316", PELE = "#D9A074", CINZA = "#D1D5DB", VINHO = "#7F1D1D", VERDE = "#047857", PERIGO = "#B91C1C";

const DEMOS = {
  maos: <><path d="M60 22h46v14H80v8H66z" fill={CINZA} /><circle className="hf-dm-gota" cx="74" cy="50" r="4" fill={AGUA} /><circle className="hf-dm-gota hf-dm-g2" cx="66" cy="50" r="3.5" fill={AGUA} /><circle className="hf-dm-gota hf-dm-g3" cx="80" cy="50" r="3" fill={AGUA} /><g className="hf-dm-esfrega"><rect x="46" y="86" width="42" height="24" rx="12" fill={PELE} /><rect x="74" y="96" width="42" height="24" rx="12" fill={PELE} stroke="#B97B50" /></g><circle className="hf-dm-pulsa" cx="60" cy="80" r="6" fill="#fff" stroke={AGUA} /><circle className="hf-dm-pulsa" cx="106" cy="84" r="5" fill="#fff" stroke={AGUA} /><path d="M30 130h100l-12 18H42z" fill={CINZA} /></>,
  termometro: <><rect x="68" y="16" width="24" height="108" rx="12" fill="#fff" stroke={CINZA} strokeWidth="3" /><circle cx="80" cy="130" r="20" fill={PERIGO} /><rect className="hf-dm-sobe" x="74" y="34" width="12" height="96" fill={PERIGO} rx="6" /><path d="M96 40h14M96 62h10M96 84h14M96 106h10" stroke={GRAFITE} strokeWidth="3" /></>,
  fogo: <><rect x="34" y="96" width="92" height="42" rx="8" fill={GRAFITE} /><path d="M24 96h112" stroke={GRAFITE} strokeWidth="6" /><path className="hf-dm-chama" d="M80 92c-22-14-14-34 0-50 4 14 22 20 16 38-2 6-8 12-16 12z" fill={FOGO} /><g className="hf-dm-tampa"><path d="M30 92a50 26 0 0 1 100 0z" fill={CINZA} stroke={GRAFITE} /><circle cx="80" cy="60" r="6" fill={GRAFITE} /></g></>,
  faca: <><rect x="22" y="118" width="116" height="16" rx="6" fill="#B08968" /><g className="hf-dm-corta"><path d="M42 106 L128 88 L128 106 Z" fill={CINZA} stroke={GRAFITE} /><rect x="14" y="100" width="32" height="12" rx="5" fill={GRAFITE} /></g><path d="M112 118a14 10 0 0 1 28 0z" fill={VERDE} /></>,
  etiqueta: <><rect x="34" y="52" width="92" height="88" rx="10" fill="#F7F7F8" stroke={CINZA} strokeWidth="3" /><rect x="28" y="38" width="104" height="18" rx="6" fill={CINZA} /><g className="hf-dm-cola"><rect x="46" y="74" width="68" height="46" rx="4" fill="#fff" stroke={OURO} strokeWidth="3" /><path d="M54 88h52M54 100h36M54 110h44" stroke={GRAFITE} strokeWidth="3" /></g></>,
  balanca: <><path d="M80 34v92" stroke={GRAFITE} strokeWidth="6" /><rect x="46" y="124" width="68" height="10" rx="4" fill={GRAFITE} /><g className="hf-dm-balanca"><path d="M26 44h108" stroke={GRAFITE} strokeWidth="6" strokeLinecap="round" /><path d="M26 44l-14 36h28zM134 44l-14 36h28z" fill={OURO} stroke={GRAFITE} /></g></>,
  coqueteleira: <><g className="hf-dm-agita"><path d="M60 20h40l6 26H54z" fill={CINZA} stroke={GRAFITE} strokeWidth="2" /><path d="M50 46h60l-8 90H58z" fill="#E5E7EB" stroke={GRAFITE} strokeWidth="2" /><rect x="70" y="10" width="20" height="12" rx="3" fill={OURO} /></g></>,
  vinho: <><g className="hf-dm-inclina"><rect x="100" y="8" width="16" height="30" rx="3" fill={VINHO} /><path d="M92 40c0-6 32-6 32 0v84H92z" fill={VINHO} /><rect x="96" y="70" width="24" height="30" fill="#FFF7E6" /></g><path d="M26 64h50c0 32-10 46-25 46S26 96 26 64z" fill="#fff" stroke={CINZA} strokeWidth="3" /><path className="hf-dm-enche" d="M31 86h40c-3 14-10 21-20 21s-17-7-20-21z" fill={VINHO} /><path d="M51 110v28M34 140h34" stroke={CINZA} strokeWidth="4" /></>,
  mesa: <><circle cx="80" cy="88" r="40" fill="#fff" stroke={CINZA} strokeWidth="3" /><circle cx="80" cy="88" r="26" fill="none" stroke={CINZA} /><path className="hf-dm-entra" d="M28 54v68M22 54v18c0 6 12 6 12 0V54" fill="none" stroke={GRAFITE} strokeWidth="4" /><path className="hf-dm-entra hf-dm-e2" d="M132 54v68M132 54c8 8 8 24 0 32" fill="none" stroke={GRAFITE} strokeWidth="4" /><circle className="hf-dm-entra hf-dm-e3" cx="130" cy="30" r="12" fill="#DBEAFE" stroke={CINZA} strokeWidth="2" /><circle className="hf-dm-entra hf-dm-e4" cx="102" cy="26" r="12" fill="#fff" stroke={OURO} strokeWidth="3" /></>,
  empratar: <><ellipse cx="80" cy="110" rx="62" ry="24" fill="#fff" stroke={CINZA} strokeWidth="3" /><ellipse cx="80" cy="106" rx="40" ry="13" fill="#F7F7F8" /><circle className="hf-dm-entra" cx="64" cy="102" r="12" fill="#EAB308" /><rect className="hf-dm-entra hf-dm-e2" x="74" y="92" width="30" height="16" rx="7" fill="#92400E" /><circle className="hf-dm-entra hf-dm-e3" cx="98" cy="88" r="5" fill={VERDE} /><circle className="hf-dm-entra hf-dm-e4" cx="88" cy="86" r="4" fill={VERDE} /></>,
  bandeja: <><g className="hf-dm-balanca"><ellipse cx="80" cy="82" rx="58" ry="10" fill={GRAFITE} /><path d="M52 76v-34h20v34zM92 76h24l4-30H88z" fill="#fff" stroke={CINZA} strokeWidth="2" /></g><path d="M80 94v36" stroke={PELE} strokeWidth="14" strokeLinecap="round" /></>,
  panela: <><path className="hf-dm-vapor" d="M60 44c-8-10 8-14 0-24M84 44c-8-10 8-14 0-24M106 44c-8-10 8-14 0-24" stroke={CINZA} strokeWidth="4" fill="none" /><rect x="36" y="60" width="90" height="60" rx="10" fill={GRAFITE} /><path d="M26 60h108" stroke={GRAFITE} strokeWidth="8" strokeLinecap="round" /><path className="hf-dm-pulsa" d="M58 134c8-12 16-12 22 0 6-12 14-12 22 0z" fill={FOGO} /></>,
  alerta: <><path className="hf-dm-pulsa" d="M80 22 146 136H14z" fill={OURO} stroke={GRAFITE} strokeWidth="3" /><rect x="74" y="62" width="12" height="42" rx="5" fill={GRAFITE} /><circle cx="80" cy="118" r="7" fill={GRAFITE} /></>,
  conversa: <><rect className="hf-dm-entra" x="22" y="30" width="86" height="54" rx="14" fill={OURO} /><rect className="hf-dm-entra hf-dm-e3" x="58" y="82" width="82" height="48" rx="14" fill={CINZA} /><path d="M36 50h58M36 64h40" stroke={GRAFITE} strokeWidth="4" /></>,
};

export default function Demonstracao({ tipo = "conversa", className = "" }) {
  return (
    <svg viewBox="0 0 160 160" aria-hidden="true" className={`hf-dm ${className}`}>
      <style>{CSS}</style>
      {DEMOS[tipo] || DEMOS.conversa}
    </svg>
  );
}
