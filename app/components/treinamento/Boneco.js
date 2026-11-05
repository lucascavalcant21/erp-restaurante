"use client";

// Instrutores do Héfisto: personagens próprios, desenhados aqui em SVG. Ilustração
// não usa os tokens da interface: cada boneco tem as cores do próprio uniforme.
import { personagemDaArea } from "../../lib/treinamento-regras.mjs";

const VISUAL = {
  instrutor: { pele: "#C68A5E", cabelo: "#2B211C", roupa: "#C5A15A", detalhe: "#202124" },
  chef: { pele: "#E0AC82", cabelo: "#3B2A20", roupa: "#FFFFFF", detalhe: "#C5A15A" },
  bartender: { pele: "#8D5A3B", cabelo: "#1E1614", roupa: "#2B2F36", detalhe: "#C5A15A" },
  garcom: { pele: "#B97B50", cabelo: "#17120F", roupa: "#FFFFFF", detalhe: "#202124" },
  lider: { pele: "#D9A074", cabelo: "#5A3A28", roupa: "#37474F", detalhe: "#C5A15A" },
};

const CSS = `
.hf-bn-corpo{animation:hfBnRespira 3.4s ease-in-out infinite;transform-origin:100px 230px}
.hf-bn-olho{animation:hfBnPisca 4.6s infinite;transform-origin:center;transform-box:fill-box}
.hf-bn-falando .hf-bn-boca{animation:hfBnFala .32s ease-in-out infinite alternate;transform-origin:center;transform-box:fill-box}
.hf-bn-braco{transform-origin:138px 128px;transition:transform .45s ease}
.hf-bn-falando.hf-bn-apontar .hf-bn-braco{animation:hfBnAponta 1.4s ease-in-out infinite alternate}
.hf-bn-falando.hf-bn-explicar .hf-bn-braco{animation:hfBnExplica 1s ease-in-out infinite alternate}
.hf-bn-falando.hf-bn-mostrar .hf-bn-braco{animation:hfBnMostra 1.6s ease-in-out infinite alternate}
@keyframes hfBnRespira{50%{transform:translateY(-3px)}}
@keyframes hfBnPisca{0%,94%,100%{transform:scaleY(1)}97%{transform:scaleY(.1)}}
@keyframes hfBnFala{from{transform:scaleY(.35)}to{transform:scaleY(1.25)}}
@keyframes hfBnAponta{from{transform:rotate(-82deg)}to{transform:rotate(-96deg)}}
@keyframes hfBnExplica{from{transform:rotate(-30deg)}to{transform:rotate(-62deg)}}
@keyframes hfBnMostra{from{transform:rotate(-112deg)}to{transform:rotate(-132deg)}}
@media (prefers-reduced-motion:reduce){.hf-bn-corpo,.hf-bn-olho,.hf-bn-boca,.hf-bn-braco{animation:none!important}}
`;

export default function Boneco({ area = "geral", falando = false, gesto = "explicar", className = "" }) {
  const p = personagemDaArea(area);
  const v = VISUAL[p.roupa] || VISUAL.instrutor;
  const claro = v.roupa === "#FFFFFF";
  return (
    <svg viewBox="0 0 200 260" role="img" aria-label={`${p.nome}, ${p.funcao}`} className={`${falando ? "hf-bn-falando" : ""} hf-bn-${gesto} ${className}`}>
      <style>{CSS}</style>
      <ellipse cx="100" cy="248" rx="58" ry="8" fill="#000" opacity=".12" />
      <g className="hf-bn-corpo">
        <rect x="74" y="208" width="20" height="38" rx="8" fill="#202124" />
        <rect x="106" y="208" width="20" height="38" rx="8" fill="#202124" />
        <rect x="60" y="118" width="80" height="98" rx="26" fill={v.roupa} stroke={claro ? "#D1D5DB" : "none"} strokeWidth="2" />
        {p.roupa === "chef" && <><circle cx="90" cy="142" r="3.5" fill={v.detalhe} /><circle cx="110" cy="142" r="3.5" fill={v.detalhe} /><circle cx="90" cy="166" r="3.5" fill={v.detalhe} /><circle cx="110" cy="166" r="3.5" fill={v.detalhe} /></>}
        {p.roupa === "garcom" && <path d="M78 122 L100 172 L122 122 L132 128 L132 214 L68 214 L68 128 Z" fill={v.detalhe} />}
        {(p.roupa === "garcom" || p.roupa === "bartender") && <path d="M86 122 L100 130 L114 122 L114 136 L100 130 L86 136 Z" fill={p.roupa === "garcom" ? "#C5A15A" : v.detalhe} />}
        {p.roupa === "instrutor" && <rect x="78" y="150" width="44" height="62" rx="8" fill="#FFF7E6" />}
        {p.roupa === "lider" && <path d="M100 122 L84 122 L96 170 Z M100 122 L116 122 L104 170 Z" fill="#FFFFFF" />}

        <path d="M62 132 Q40 160 50 192" fill="none" stroke={claro ? "#D1D5DB" : v.roupa} strokeWidth="17" strokeLinecap="round" />
        <circle cx="50" cy="196" r="9" fill={v.pele} />
        <g className="hf-bn-braco">
          <path d="M138 128 Q160 156 150 192" fill="none" stroke={claro ? "#D1D5DB" : v.roupa} strokeWidth="17" strokeLinecap="round" />
          <circle cx="150" cy="196" r="9" fill={v.pele} />
        </g>

        <rect x="90" y="100" width="20" height="24" rx="8" fill={v.pele} />
        <circle cx="100" cy="72" r="42" fill={v.pele} />
        {p.roupa === "chef" ? (
          <path d="M60 58 C48 34 68 18 80 26 C86 6 116 6 122 26 C136 18 152 34 140 58 Z" fill="#FFFFFF" stroke="#D1D5DB" strokeWidth="2" />
        ) : p.roupa === "bartender" ? (
          <><path d="M58 70 C54 26 146 26 142 70 C128 52 76 52 58 70 Z" fill={v.cabelo} /><circle cx="100" cy="24" r="14" fill={v.cabelo} /></>
        ) : p.roupa === "lider" ? (
          <path d="M56 84 C46 22 154 22 144 84 C138 58 122 50 100 50 C78 50 62 58 56 84 Z" fill={v.cabelo} />
        ) : (
          <path d="M58 66 C58 24 142 24 142 66 C124 50 80 48 58 66 Z" fill={v.cabelo} />
        )}
        <g className="hf-bn-olho"><circle cx="84" cy="74" r="5" fill="#17120F" /></g>
        <g className="hf-bn-olho"><circle cx="116" cy="74" r="5" fill="#17120F" /></g>
        <ellipse className="hf-bn-boca" cx="100" cy="94" rx="10" ry={falando ? 6 : 2.5} fill="#7A2E2E" />
      </g>
    </svg>
  );
}
