"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Bell,
  AlertTriangle,
  Calendar,
  Package,
  Info,
  CheckCheck,
  Trash2,
  ChevronRight,
  Megaphone,
} from "lucide-react";

// ─── Helpers ───────────────────────────────────────────────────────────────────
function tempoRelativo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const min  = Math.floor(diff / 60000);
  if (min < 60)   return `${min}min atrás`;
  const h = Math.floor(min / 60);
  if (h < 24)     return `${h}h atrás`;
  const d = Math.floor(h / 24);
  if (d < 7)      return `${d}d atrás`;
  return new Date(iso).toLocaleDateString("pt-BR");
}

// ─── Tipos de notificação ─────────────────────────────────────────────────────
const TIPO_CONFIG = {
  estoque_critico: {
    Icon:  AlertTriangle,
    bg:    "bg-rose-50",
    borda: "border-rose-200",
    icone: "bg-rose-100 text-rose-500",
    badge: "bg-rose-100 text-rose-600",
    label: "Estoque",
    href:  "/dashboard/operacao/estoque",
  },
  evento_proximo: {
    Icon:  Calendar,
    bg:    "bg-amber-50",
    borda: "border-amber-200",
    icone: "bg-amber-100 text-amber-500",
    badge: "bg-amber-100 text-amber-600",
    label: "Evento",
    href:  "/dashboard/operacao/eventos",
  },
  sistema: {
    Icon:  Info,
    bg:    "bg-blue-50",
    borda: "border-blue-100",
    icone: "bg-blue-100 text-blue-500",
    badge: "bg-blue-100 text-blue-600",
    label: "Sistema",
    href:  null,
  },
  aviso: {
    Icon:  Megaphone,
    bg:    "bg-neutral-50",
    borda: "border-neutral-200",
    icone: "bg-neutral-100 text-neutral-500",
    badge: "bg-neutral-100 text-neutral-500",
    label: "Aviso",
    href:  null,
  },
};

// ─── Seed de notificações ─────────────────────────────────────────────────────
// Supabase: supabase.from('notificacoes').select('*').order('created_at', { ascending: false })
const NOTIFICACOES_SEED = [
  {
    id:    "n1",
    tipo:  "estoque_critico",
    titulo: "Feijão Carioca abaixo do mínimo",
    corpo: "Estoque atual: 3 KG — mínimo configurado: 5 KG. Realize a reposição.",
    lida:  false,
    criada_em: new Date(Date.now() - 25 * 60000).toISOString(), // 25min atrás
  },
  {
    id:    "n2",
    tipo:  "estoque_critico",
    titulo: "Alface Crespa crítica",
    corpo: "Estoque atual: 2 MAÇOS — mínimo configurado: 5 MAÇOS.",
    lida:  false,
    criada_em: new Date(Date.now() - 2 * 3600000).toISOString(), // 2h atrás
  },
  {
    id:    "n3",
    tipo:  "evento_proximo",
    titulo: "Evento em 15 dias",
    corpo: "Aniversário 50 anos João — 20/06/2026 às 20h. Confirme cardápio e equipe.",
    lida:  false,
    criada_em: new Date(Date.now() - 5 * 3600000).toISOString(), // 5h atrás
  },
  {
    id:    "n4",
    tipo:  "sistema",
    titulo: "Bem-vindo ao Cerebro ERP",
    corpo: "Todos os módulos foram carregados com sucesso. Explore o painel e configure sua operação.",
    lida:  true,
    criada_em: new Date(Date.now() - 2 * 86400000).toISOString(), // 2 dias atrás
  },
  {
    id:    "n5",
    tipo:  "aviso",
    titulo: "Integração com PDV pendente",
    corpo: "Conecte seu sistema de vendas (iFood, Saipos) para ativar os dados financeiros em tempo real.",
    lida:  true,
    criada_em: new Date(Date.now() - 3 * 86400000).toISOString(), // 3 dias atrás
  },
  {
    id:    "n6",
    tipo:  "evento_proximo",
    titulo: "Casamento Silva & Costa — 38 dias",
    corpo: "Confirme lista de ingredientes e ficha técnica do cardápio contratado.",
    lida:  true,
    criada_em: new Date(Date.now() - 4 * 86400000).toISOString(), // 4 dias atrás
  },
];

// ─── Componente: Card de notificação ─────────────────────────────────────────
function CardNotificacao({ notif, onLer, onDeletar }) {
  const cfg = TIPO_CONFIG[notif.tipo] ?? TIPO_CONFIG.sistema;
  const IcoComp = cfg.Icon;

  return (
    <div className={`rounded-2xl border shadow-sm overflow-hidden transition-all ${notif.lida ? "bg-white border-neutral-100 opacity-70" : `${cfg.bg} ${cfg.borda}`}`}>
      <div className="px-4 py-3.5">
        <div className="flex items-start gap-3">
          {/* Ícone */}
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${notif.lida ? "bg-neutral-100 text-neutral-400" : cfg.icone}`}>
            <IcoComp size={16} />
          </div>

          {/* Conteúdo */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-0.5">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className={`text-[9px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded-full ${notif.lida ? "bg-neutral-100 text-neutral-400" : cfg.badge}`}>
                  {cfg.label}
                </span>
                {!notif.lida && (
                  <span className="w-1.5 h-1.5 rounded-full bg-[#10b981] flex-shrink-0" />
                )}
              </div>
              <span className="text-[10px] text-neutral-400 font-medium flex-shrink-0">{tempoRelativo(notif.criada_em)}</span>
            </div>
            <p className={`text-sm font-black leading-tight mb-1 ${notif.lida ? "text-neutral-600" : "text-neutral-900"}`}>
              {notif.titulo}
            </p>
            <p className="text-[11px] text-neutral-500 font-medium leading-relaxed">{notif.corpo}</p>
          </div>
        </div>
      </div>

      {/* Ações */}
      <div className="flex items-center border-t border-neutral-100 divide-x divide-neutral-100">
        {cfg.href && (
          <a href={cfg.href}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[11px] font-black text-neutral-600 active:bg-neutral-50 transition-colors">
            Ver módulo <ChevronRight size={12} />
          </a>
        )}
        {!notif.lida && (
          <button onClick={() => onLer(notif.id)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[11px] font-black text-emerald-600 active:bg-emerald-50 transition-colors">
            <CheckCheck size={13} /> Marcar lida
          </button>
        )}
        <button onClick={() => onDeletar(notif.id)}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[11px] font-black text-rose-400 active:bg-rose-50 transition-colors">
          <Trash2 size={13} /> Remover
        </button>
      </div>
    </div>
  );
}

// ─── Filtros ─────────────────────────────────────────────────────────────────
const FILTROS = [
  { id: "todas",   label: "Todas" },
  { id: "nao_lidas", label: "Não lidas" },
  { id: "estoque_critico", label: "Estoque" },
  { id: "evento_proximo",  label: "Eventos" },
  { id: "sistema", label: "Sistema" },
];

// ─── Página Principal ──────────────────────────────────────────────────────────
export default function NotificacoesPage() {
  const router = useRouter();

  const [notificacoes, setNotificacoes] = useState(NOTIFICACOES_SEED);
  const [filtro,       setFiltro]       = useState("todas");

  // ── Métricas ──────────────────────────────────────────────────────────────
  const naoLidas = useMemo(() => notificacoes.filter(n => !n.lida).length, [notificacoes]);

  // ── Filtragem ─────────────────────────────────────────────────────────────
  const filtradas = useMemo(() => {
    return notificacoes.filter(n => {
      if (filtro === "todas")    return true;
      if (filtro === "nao_lidas") return !n.lida;
      return n.tipo === filtro;
    });
  }, [notificacoes, filtro]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  function handleLer(id) {
    setNotificacoes(prev => prev.map(n => n.id === id ? { ...n, lida: true } : n));
    // TODO: supabase.from('notificacoes').update({ lida: true }).eq('id', id)
  }

  function handleDeletar(id) {
    setNotificacoes(prev => prev.filter(n => n.id !== id));
    // TODO: supabase.from('notificacoes').delete().eq('id', id)
  }

  function handleLerTodas() {
    setNotificacoes(prev => prev.map(n => ({ ...n, lida: true })));
    // TODO: supabase.from('notificacoes').update({ lida: true }).eq('user_id', userId)
  }

  function handleLimparLidas() {
    setNotificacoes(prev => prev.filter(n => !n.lida));
  }

  return (
    <div className="min-h-screen bg-[#fbf9f5]">

      {/* Header */}
      <div className="sticky top-0 z-20 bg-[#fbf9f5] border-b border-neutral-200 px-4 pt-12 pb-3">
        <div className="flex items-center gap-3 mb-3">
          <button onClick={() => router.back()}
            className="w-9 h-9 rounded-xl bg-white border border-neutral-200 flex items-center justify-center shadow-sm active:scale-95 transition-transform">
            <ArrowLeft size={18} className="text-neutral-600" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-black text-neutral-900 leading-tight">Notificações</h1>
            <p className="text-[11px] text-neutral-400 font-medium">
              {naoLidas > 0 ? `${naoLidas} não lida${naoLidas > 1 ? "s" : ""}` : "Tudo em dia"}
            </p>
          </div>
          {naoLidas > 0 && (
            <button onClick={handleLerTodas}
              className="flex items-center gap-1 text-[11px] font-black text-[#10b981] active:opacity-70 transition-opacity">
              <CheckCheck size={14} /> Ler todas
            </button>
          )}
        </div>

        {/* Chips de filtro */}
        <div className="flex gap-2 overflow-x-auto scrollbar-none pb-0.5">
          {FILTROS.map(f => (
            <button key={f.id} onClick={() => setFiltro(f.id)}
              className={`flex-shrink-0 text-[11px] font-black px-3 py-1.5 rounded-full transition-all active:scale-95 ${filtro === f.id ? "bg-neutral-900 text-white" : "bg-white text-neutral-600 border border-neutral-200"}`}>
              {f.label}
              {f.id === "nao_lidas" && naoLidas > 0 && (
                <span className="ml-1 bg-[#10b981] text-white text-[9px] font-black rounded-full px-1">{naoLidas}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pt-4 pb-28 space-y-3">

        {/* Banner de estoque crítico no topo (se houver) */}
        {notificacoes.some(n => n.tipo === "estoque_critico" && !n.lida) && filtro === "todas" && (
          <button onClick={() => router.push("/dashboard/operacao/estoque")}
            className="w-full bg-rose-500 text-white rounded-2xl px-4 py-3.5 flex items-center gap-3 active:scale-95 transition-all shadow-md">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
              <Package size={18} />
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-black">Estoque crítico detectado</p>
              <p className="text-[11px] font-medium opacity-90">
                {notificacoes.filter(n => n.tipo === "estoque_critico" && !n.lida).length} iten(s) abaixo do mínimo — reposição necessária
              </p>
            </div>
            <ChevronRight size={18} className="opacity-80 flex-shrink-0" />
          </button>
        )}

        {/* Lista */}
        {filtradas.length === 0 ? (
          <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm p-10 flex flex-col items-center text-center gap-2 mt-4">
            <div className="w-14 h-14 rounded-2xl bg-neutral-100 flex items-center justify-center mb-2">
              <Bell size={24} className="text-neutral-300" />
            </div>
            <p className="text-sm font-bold text-neutral-500">
              {filtro === "nao_lidas" ? "Nenhuma notificação não lida" : "Nenhuma notificação"}
            </p>
            <p className="text-xs text-neutral-400 font-medium">
              {filtro === "nao_lidas" ? "Você está em dia com tudo!" : "As notificações aparecerão aqui."}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtradas.map(n => (
              <CardNotificacao key={n.id} notif={n} onLer={handleLer} onDeletar={handleDeletar} />
            ))}
          </div>
        )}

        {/* Limpar lidas */}
        {notificacoes.some(n => n.lida) && (
          <button onClick={handleLimparLidas}
            className="w-full py-3 rounded-2xl border border-neutral-200 text-[11px] font-black text-neutral-400 active:bg-neutral-50 transition-colors mt-2">
            Limpar notificações lidas
          </button>
        )}

      </div>
    </div>
  );
}
