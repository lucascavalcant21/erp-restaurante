"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  User,
  FileText,
  Calendar,
  Bell,
  ChevronDown,
  ChevronUp,
  Download,
  Clock,
  CheckCircle,
  Info,
  AlertCircle,
  Briefcase,
} from "lucide-react";

// ─── Helpers ───────────────────────────────────────────────────────────────────
function fmtBRL(val) {
  return Number(val).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// ─── Dados do colaborador logado (mock — substituir por sessão/Supabase) ───────
const COLABORADOR = {
  nome:       "Ana Clara Souza",
  cargo:      "Cozinheira",
  unidade:    "Seldeestrela",
  matricula:  "001",
  admissao:   "2022-03-10",
  turno:      "06:00 – 14:00",
  salario:    2400.00,
  avatar:     "AC",
};

// ─── Holerites ────────────────────────────────────────────────────────────────
const HOLERITES = [
  { id: "h1", mes: "Maio 2026",   liquido: 2185.40, status: "disponivel" },
  { id: "h2", mes: "Abril 2026",  liquido: 2185.40, status: "disponivel" },
  { id: "h3", mes: "Março 2026",  liquido: 2185.40, status: "disponivel" },
  { id: "h4", mes: "Fevereiro 2026", liquido: 2050.20, status: "disponivel" },
];

const HOLERITE_DETALHE = {
  h1: {
    proventos: [
      { label: "Salário Base",         valor: 2400.00 },
      { label: "Horas Extras (4h)",    valor: 120.00  },
    ],
    descontos: [
      { label: "INSS (7,5%)",          valor: 192.00 },
      { label: "VT Desconto",          valor: 86.00  },
      { label: "VR Desconto",          valor: 56.60  },
    ],
  },
};

// ─── Escala ───────────────────────────────────────────────────────────────────
const ESCALA = [
  { data: "2026-06-02", dia: "Seg", turno: "06:00–14:00", status: "trabalhado" },
  { data: "2026-06-03", dia: "Ter", turno: "06:00–14:00", status: "trabalhado" },
  { data: "2026-06-04", dia: "Qua", turno: "06:00–14:00", status: "trabalhado" },
  { data: "2026-06-05", dia: "Qui", turno: "06:00–14:00", status: "hoje"       },
  { data: "2026-06-06", dia: "Sex", turno: "06:00–14:00", status: "futuro"     },
  { data: "2026-06-07", dia: "Sáb", turno: "FOLGA",       status: "folga"      },
  { data: "2026-06-08", dia: "Dom", turno: "FOLGA",       status: "folga"      },
  { data: "2026-06-09", dia: "Seg", turno: "06:00–14:00", status: "futuro"     },
  { data: "2026-06-10", dia: "Ter", turno: "06:00–14:00", status: "futuro"     },
];

const ESCALA_STYLE = {
  trabalhado: { bg: "bg-emerald-50",  borda: "border-emerald-200", cor: "text-emerald-700", label: "✓" },
  hoje:       { bg: "bg-[#059669]", borda: "border-neutral-900", cor: "text-white",        label: "Hoje" },
  futuro:     { bg: "bg-[#1E293B]",       borda: "border-white/8", cor: "text-[#CBD5E1]",  label: "" },
  folga:      { bg: "",  borda: "border-white/5", cor: "text-[#475569]",  label: "🌙" },
};

// ─── Avisos ───────────────────────────────────────────────────────────────────
const AVISOS = [
  { id: "a1", tipo: "info",    titulo: "Reunião de equipe",        corpo: "Reunião geral na próxima segunda-feira às 08:00 na Seldeestrela.", data: "2026-06-03" },
  { id: "a2", tipo: "alerta",  titulo: "Atualização de uniforme",  corpo: "A partir de 01/07, o uso do jaleco completo é obrigatório em todas as unidades.", data: "2026-06-01" },
  { id: "a3", tipo: "sucesso", titulo: "Férias aprovadas",         corpo: "Suas férias de 14/07 a 02/08 foram aprovadas. Bom descanso!", data: "2026-05-28" },
];

const AVISO_STYLE = {
  info:    { Icon: Info,          bg: "bg-blue-50",    borda: "border-blue-200",    cor: "text-blue-600"    },
  alerta:  { Icon: AlertCircle,   bg: "bg-amber-50",   borda: "border-amber-200",   cor: "text-amber-600"   },
  sucesso: { Icon: CheckCircle,   bg: "bg-emerald-50", borda: "border-emerald-200", cor: "text-emerald-600" },
};

// ─── Documentos da empresa ────────────────────────────────────────────────────
const DOCUMENTOS = [
  { id: "d1", nome: "Regulamento Interno",     tipo: "PDF", tamanho: "248 KB" },
  { id: "d2", nome: "Política de Benefícios",  tipo: "PDF", tamanho: "180 KB" },
  { id: "d3", nome: "Manual do Colaborador",   tipo: "PDF", tamanho: "1.2 MB" },
  { id: "d4", nome: "Contrato de Trabalho",    tipo: "PDF", tamanho: "95 KB"  },
];

// ─── Seção expansível ─────────────────────────────────────────────────────────
function Secao({ icon: Icon, titulo, badge, children, defaultOpen = false }) {
  const [aberto, setAberto] = useState(defaultOpen);
  return (
    <div className="bg-[#1E293B] rounded-2xl border border-white/5  overflow-hidden">
      <button className="w-full flex items-center justify-between px-4 py-3.5" onClick={() => setAberto(v => !v)}>
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-[#334155] flex items-center justify-center">
            <Icon size={14} className="text-[#94A3B8]" />
          </div>
          <span className="text-sm font-black text-[#F1F5F9]">{titulo}</span>
          {badge != null && (
            <span className="text-[10px] font-black bg-[#059669] text-white px-1.5 py-0.5 rounded-full">{badge}</span>
          )}
        </div>
        {aberto ? <ChevronUp size={16} className="text-[#475569]" /> : <ChevronDown size={16} className="text-[#475569]" />}
      </button>
      {aberto && <div className="border-t border-white/5 px-4 pb-4 pt-3">{children}</div>}
    </div>
  );
}

// ─── Página Principal ──────────────────────────────────────────────────────────
export default function ColaboradorPage() {
  const router = useRouter();
  const [holAberto, setHolAberto] = useState(null);

  // Anos de empresa
  const anos = (() => {
    const adm = new Date(COLABORADOR.admissao);
    const hoje = new Date("2026-06-05");
    return Math.floor((hoje - adm) / (365.25 * 24 * 3600 * 1000));
  })();

  return (
    <div className="min-h-screen ">
      {/* Header */}
      <div className="sticky top-0 z-20  border-b border-white/8 px-4 pt-12 pb-3" style={{ background: '#0F172A' }}>
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()}
            className="w-9 h-9 rounded-xl bg-[#1E293B] border border-white/8 flex items-center justify-center  active:scale-95 transition-transform">
            <ArrowLeft size={18} className="text-[#94A3B8]" />
          </button>
          <div>
            <h1 className="text-lg font-black leading-tight" style={{ color:"#F1F5F9" }}>Portal do Colaborador</h1>
            <p className="text-[11px] text-[#475569] font-medium">Seus dados, holerites e escala</p>
          </div>
        </div>
      </div>

      <div className="px-4 pt-4 pb-28 space-y-4">

        {/* Perfil */}
        <div className="bg-[#1E293B] rounded-2xl border border-white/5  p-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-[#059669] flex items-center justify-center font-black text-lg text-white flex-shrink-0">
              {COLABORADOR.avatar}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-base font-black text-[#F1F5F9] truncate">{COLABORADOR.nome}</p>
              <p className="text-[12px] font-medium text-[#64748B]">{COLABORADOR.cargo} · {COLABORADOR.unidade}</p>
              <div className="flex items-center gap-3 mt-1.5">
                <span className="text-[10px] font-black text-[#475569]">Mat. #{COLABORADOR.matricula}</span>
                <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-full">{anos} ano{anos !== 1 ? "s" : ""} de empresa</span>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-4">
            <div className=" rounded-xl px-3 py-2">
              <p className="text-[9px] font-black text-[#475569] uppercase">Turno</p>
              <p className="text-xs font-black text-[#F1F5F9]">{COLABORADOR.turno}</p>
            </div>
            <div className=" rounded-xl px-3 py-2">
              <p className="text-[9px] font-black text-[#475569] uppercase">Salário Base</p>
              <p className="text-xs font-black text-[#F1F5F9]">{fmtBRL(COLABORADOR.salario)}</p>
            </div>
          </div>
        </div>

        {/* Holerites */}
        <Secao icon={FileText} titulo="Holerites" badge={HOLERITES.length} defaultOpen={true}>
          <div className="space-y-2">
            {HOLERITES.map(h => (
              <div key={h.id}>
                <button
                  className="w-full flex items-center justify-between py-2.5 border-b border-white/5 last:border-0"
                  onClick={() => setHolAberto(holAberto === h.id ? null : h.id)}>
                  <div className="text-left">
                    <p className="text-sm font-black text-[#F1F5F9]">{h.mes}</p>
                    <p className="text-[11px] font-medium text-emerald-700">Líquido: {fmtBRL(h.liquido)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-black bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full uppercase">Disponível</span>
                    {holAberto === h.id
                      ? <ChevronUp size={14} className="text-[#475569]" />
                      : <ChevronDown size={14} className="text-[#475569]" />}
                  </div>
                </button>

                {holAberto === h.id && HOLERITE_DETALHE[h.id] && (
                  <div className="mt-2 mb-3  rounded-xl p-3 space-y-3">
                    <div>
                      <p className="text-[10px] font-black text-[#475569] uppercase tracking-wider mb-2">Proventos</p>
                      {HOLERITE_DETALHE[h.id].proventos.map((p, i) => (
                        <div key={i} className="flex justify-between text-[12px] py-1 border-b border-white/5 last:border-0">
                          <span className="font-medium text-[#CBD5E1]">{p.label}</span>
                          <span className="font-black text-emerald-700">{fmtBRL(p.valor)}</span>
                        </div>
                      ))}
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-[#475569] uppercase tracking-wider mb-2">Descontos</p>
                      {HOLERITE_DETALHE[h.id].descontos.map((d, i) => (
                        <div key={i} className="flex justify-between text-[12px] py-1 border-b border-white/5 last:border-0">
                          <span className="font-medium text-[#CBD5E1]">{d.label}</span>
                          <span className="font-black text-[#059669]">- {fmtBRL(d.valor)}</span>
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-between pt-1 border-t border-white/8">
                      <span className="text-sm font-black text-[#F1F5F9]">Total Líquido</span>
                      <span className="text-sm font-black text-emerald-700">{fmtBRL(h.liquido)}</span>
                    </div>
                    <button className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#059669] text-white text-xs font-black active:scale-95 transition-transform">
                      <Download size={13} />
                      Baixar PDF
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Secao>

        {/* Escala */}
        <Secao icon={Calendar} titulo="Minha Escala" defaultOpen={true}>
          <div className="grid grid-cols-3 gap-2">
            {ESCALA.map(e => {
              const st = ESCALA_STYLE[e.status];
              return (
                <div key={e.data} className={`rounded-xl border px-2 py-2.5 text-center ${st.bg} ${st.borda}`}>
                  <p className={`text-[9px] font-black uppercase ${e.status === "hoje" ? "text-[#334155]" : "text-[#475569]"}`}>{e.dia}</p>
                  <p className={`text-[13px] font-black ${e.status === "hoje" ? "text-white" : "text-[#CBD5E1]"} mb-0.5`}>
                    {e.data.split("-")[2]}
                  </p>
                  <p className={`text-[8px] font-black leading-tight ${st.cor}`}>
                    {e.turno === "FOLGA" ? "🌙 Folga" : e.turno}
                  </p>
                  {e.status === "hoje" && (
                    <span className="text-[8px] font-black bg-[#1E293B]/20 text-white px-1 py-0.5 rounded-full mt-1 inline-block">HOJE</span>
                  )}
                </div>
              );
            })}
          </div>
        </Secao>

        {/* Avisos */}
        <Secao icon={Bell} titulo="Avisos" badge={AVISOS.length}>
          <div className="space-y-2">
            {AVISOS.map(a => {
              const st = AVISO_STYLE[a.tipo];
              const Icon = st.Icon;
              return (
                <div key={a.id} className={`rounded-xl border p-3 ${st.bg} ${st.borda}`}>
                  <div className="flex items-start gap-2">
                    <Icon size={14} className={`${st.cor} flex-shrink-0 mt-0.5`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-black text-[#F1F5F9]">{a.titulo}</p>
                      <p className="text-[11px] font-medium text-[#94A3B8] mt-0.5 leading-snug">{a.corpo}</p>
                      <p className="text-[10px] font-bold text-[#475569] mt-1.5">
                        {new Date(a.data + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "long" })}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Secao>

        {/* Documentos */}
        <Secao icon={Briefcase} titulo="Documentos da Empresa">
          <div className="space-y-2">
            {DOCUMENTOS.map(d => (
              <div key={d.id} className="flex items-center justify-between py-2.5 border-b border-white/5 last:border-0">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[rgba(5,150,105,0.1)] border border-[rgba(5,150,105,0.2)] flex items-center justify-center flex-shrink-0">
                    <FileText size={14} className="text-[#10b981]" />
                  </div>
                  <div>
                    <p className="text-[12px] font-black text-[#F1F5F9]">{d.nome}</p>
                    <p className="text-[10px] font-medium text-[#475569]">{d.tipo} · {d.tamanho}</p>
                  </div>
                </div>
                <button className="w-8 h-8 rounded-xl bg-[#334155] flex items-center justify-center active:scale-95 transition-transform">
                  <Download size={14} className="text-[#94A3B8]" />
                </button>
              </div>
            ))}
          </div>
        </Secao>

      </div>
    </div>
  );
}
