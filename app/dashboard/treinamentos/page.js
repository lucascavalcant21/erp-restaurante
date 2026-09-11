"use client";

import { useRouter } from "next/navigation";
import { Armchair, ArrowLeft, BookOpen, ChefHat, Maximize2, Wine } from "lucide-react";
import { useERP } from "../../context/ERPContext";

const AREAS = [
  { id: "cozinha", nome: "Cozinha", texto: "Técnicas, segurança, preparo e padrões da cozinha", Icon: ChefHat, classe: "cozinha" },
  { id: "bar", nome: "Bar", texto: "Drinks, bebidas, atendimento e organização do bar", Icon: Wine, classe: "bar" },
  { id: "salao", nome: "Salão", texto: "Atendimento, serviço, vendas e experiência do cliente", Icon: Armchair, classe: "salao" },
];

export default function TreinamentosSeletorPage() {
  const router = useRouter();
  const { unidadeInfo } = useERP();
  const telaCheia = () => document.documentElement.requestFullscreen?.().catch?.(() => {});

  return (
    <div className="seletor-setores">
      <style>{`
        .seletor-setores{position:fixed;inset:0;z-index:80;overflow:auto;background:linear-gradient(145deg,#07111f,#0f2841);color:#fff;padding:clamp(18px,4vw,44px);display:flex;flex-direction:column}
        .seletor-topo{display:flex;align-items:center;justify-content:space-between;gap:12px}
        .seletor-topo button{height:46px;border:1px solid rgba(255,255,255,.2);border-radius:14px;background:rgba(255,255,255,.08);color:#fff;padding:0 15px;display:flex;align-items:center;gap:8px;font-weight:800}
        .seletor-centro{width:min(1080px,100%);margin:auto;text-align:center;padding:28px 0}
        .seletor-centro h1{font-size:clamp(34px,5vw,62px);line-height:1;margin:18px 0 10px;font-weight:950;letter-spacing:-.04em}
        .seletor-centro>p{color:#cbd5e1;font-size:clamp(15px,2vw,20px);margin:0 auto 34px;max-width:760px}
        .seletor-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:clamp(14px,2.5vw,26px)}
        .seletor-card{min-height:clamp(215px,31vh,300px);border:2px solid rgba(255,255,255,.16);border-radius:30px;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:24px;font-size:28px;font-weight:950;box-shadow:0 22px 55px rgba(0,0,0,.25);transition:.15s}
        .seletor-card:hover{transform:translateY(-4px);filter:brightness(1.05)}.seletor-card:active{transform:scale(.98)}
        .seletor-card svg{width:62px;height:62px}.seletor-card span{font-size:14px;font-weight:700;line-height:1.35;opacity:.88;max-width:240px}
        .seletor-card.cozinha{background:linear-gradient(145deg,#047857,#10b981)}.seletor-card.bar{background:linear-gradient(145deg,#1d4ed8,#3b82f6)}.seletor-card.salao{background:linear-gradient(145deg,#7c3aed,#a855f7)}
        .seletor-unidade{font-size:12px;font-weight:800;color:#94a3b8;text-transform:uppercase;letter-spacing:.12em}
        @media(max-width:760px){.seletor-grid{grid-template-columns:1fr}.seletor-card{min-height:165px}.seletor-centro{margin:24px auto}.seletor-card svg{width:48px;height:48px}}
      `}</style>
      <div className="seletor-topo">
        <button onClick={() => router.push("/dashboard")}><ArrowLeft size={19}/> Voltar</button>
        <button onClick={telaCheia}><Maximize2 size={18}/> Tela cheia</button>
      </div>
      <main className="seletor-centro">
        <BookOpen size={52}/>
        <h1>Treinamentos</h1>
        <p>Escolha o setor para criar, organizar ou compartilhar as trilhas de aprendizagem da equipe.</p>
        <div className="seletor-grid">
          {AREAS.map(({ id, nome, texto, Icon, classe }) => (
            <button key={id} className={`seletor-card ${classe}`} onClick={() => router.push(`/dashboard/salao/treinamento?dept=${id}`)}>
              <Icon/> {nome}<span>{texto}</span>
            </button>
          ))}
        </div>
        {unidadeInfo?.nome && <p className="seletor-unidade">{unidadeInfo.nome}</p>}
      </main>
    </div>
  );
}
