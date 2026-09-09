"use client";

import { useRouter } from "next/navigation";
import { Armchair, ArrowLeft, ChefHat, ClipboardList, Maximize2, Package, Sparkles, Store, Wine } from "lucide-react";
import { useERP } from "../../context/ERPContext";

const AREAS = [
  { id: "cozinha", nome: "Cozinha", texto: "Abertura, produção, higiene e fechamento", Icon: ChefHat, classe: "cozinha" },
  { id: "bar", nome: "Bar", texto: "Organização, bebidas, reposição e chopeira", Icon: Wine, classe: "bar" },
  { id: "salao", nome: "Salão", texto: "Montagem, atendimento e banheiros", Icon: Armchair, classe: "salao" },
  { id: "estoque", nome: "Estoque", texto: "Recebimento, organização FEFO e inventário", Icon: Package, classe: "estoque" },
  { id: "copa", nome: "Copa / Louça", texto: "Higienização, triagem e estocagem", Icon: Sparkles, classe: "copa" },
  { id: "caixa", nome: "Caixa / Delivery", texto: "Abertura, conferência e fechamento", Icon: Store, classe: "caixa" },
];

export default function ChecklistSeletorPage() {
  const router = useRouter();
  const { unidadeInfo } = useERP();
  const telaCheia = () => document.documentElement.requestFullscreen?.().catch?.(() => {});

  return (
    <div className="seletor-setores">
      <style>{`
        .seletor-setores{position:fixed;inset:0;z-index:80;overflow:auto;background:linear-gradient(145deg,#07111f,#0f2841);color:#fff;padding:clamp(18px,4vw,44px);display:flex;flex-direction:column}
        .seletor-topo{display:flex;align-items:center;justify-content:space-between;gap:12px}
        .seletor-topo button{height:46px;border:1px solid rgba(255,255,255,.2);border-radius:14px;background:rgba(255,255,255,.08);color:#fff;padding:0 15px;display:flex;align-items:center;gap:8px;font-weight:800}
        .seletor-centro{width:min(1180px,100%);margin:auto;text-align:center;padding:20px 0}
        .seletor-centro h1{font-size:clamp(32px,5vw,56px);line-height:1;margin:14px 0 8px;font-weight:950;letter-spacing:-.04em}
        .seletor-centro>p{color:#cbd5e1;font-size:clamp(14px,2vw,18px);margin:0 auto 28px;max-width:800px}
        .seletor-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:clamp(12px,2vw,22px)}
        .seletor-card{min-height:clamp(180px,25vh,240px);border:2px solid rgba(255,255,255,.16);border-radius:26px;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:20px;font-size:24px;font-weight:950;box-shadow:0 20px 45px rgba(0,0,0,.25);transition:.15s}
        .seletor-card:hover{transform:translateY(-4px);filter:brightness(1.05)}.seletor-card:active{transform:scale(.98)}
        .seletor-card svg{width:52px;height:52px}.seletor-card span{font-size:13px;font-weight:700;line-height:1.3;opacity:.88;max-width:240px}
        .seletor-card.cozinha{background:linear-gradient(145deg,#047857,#10b981)}
        .seletor-card.bar{background:linear-gradient(145deg,#1d4ed8,#3b82f6)}
        .seletor-card.salao{background:linear-gradient(145deg,#7c3aed,#a855f7)}
        .seletor-card.estoque{background:linear-gradient(145deg,#059669,#34d399)}
        .seletor-card.copa{background:linear-gradient(145deg,#0284c7,#38bdf8)}
        .seletor-card.caixa{background:linear-gradient(145deg,#ea580c,#fb923c)}
        .seletor-unidade{font-size:12px;font-weight:800;color:#94a3b8;text-transform:uppercase;letter-spacing:.12em;margin-top:24px}
        @media(max-width:760px){.seletor-grid{grid-template-columns:1fr}.seletor-card{min-height:150px}.seletor-centro{margin:16px auto}.seletor-card svg{width:44px;height:44px}}
      `}</style>
      <div className="seletor-topo">
        <button onClick={() => router.push("/dashboard")}><ArrowLeft size={19}/> Voltar</button>
        <button onClick={telaCheia}><Maximize2 size={18}/> Tela cheia</button>
      </div>
      <main className="seletor-centro">
        <ClipboardList size={48}/>
        <h1>Checklists Operacionais</h1>
        <p>Escolha a área ou cômodo. Cada setor possui rotinas, fotos de referência da área e gabaritos.</p>
        <div className="seletor-grid">
          {AREAS.map(({ id, nome, texto, Icon, classe }) => (
            <button key={id} className={`seletor-card ${classe}`} onClick={() => router.push(`/dashboard/operacao/rotina?dept=${id}`)}>
              <Icon/> {nome}<span>{texto}</span>
            </button>
          ))}
        </div>
        {unidadeInfo?.nome && <p className="seletor-unidade">{unidadeInfo.nome}</p>}
      </main>
    </div>
  );
}
