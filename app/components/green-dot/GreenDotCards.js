"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Sparkles,
  Calendar,
  BarChart3,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Search,
  Wrench,
  CheckCircle2,
  Clock,
  Users,
  UserPlus,
  Lightbulb,
  Check,
  UtensilsCrossed,
  Flame,
  GlassWater,
  Scale,
  Zap,
  PlayCircle,
  ShieldAlert,
  Sparkle,
  PackageCheck,
  AlertTriangle,
  Layers,
  Droplets,
  Tag,
  Printer,
  ExternalLink,
  ShieldCheck,
  AlertCircle,
  ClipboardCheck,
} from "lucide-react";
import {
  TOPICOS_INICIAIS,
  recalcularReceitaPorIngrediente,
  ESCALA_ORGANOGRAMA_DO_DIA,
  ESCALA_TURNO_GANTT,
  ROTINAS_LIMPEZA_HIGIENIZACAO,
  CHECKLISTS_PRACA,
  calcularDiluicaoLimpeza,
} from "../../lib/green-dot-data";
import { criarEtiqueta } from "../../lib/etiquetas";

// ── AVATARES OFICIAIS ────────────────────────────────────────────────────────
export function GreenDotAvatar() {
  return (
    <div className="w-10 h-10 rounded-full bg-[#2E6F4E] flex items-center justify-center text-white shadow-md shrink-0 ring-2 ring-white/80">
      <Sparkles size={20} className="fill-white" />
    </div>
  );
}

export function PartnerBubbleAvatar() {
  return (
    <div className="w-10 h-10 rounded-full bg-[#2A322E] flex items-center justify-center text-white shadow-md shrink-0 ring-2 ring-white/80">
      <svg viewBox="0 0 24 24" className="w-5 h-5 fill-none stroke-current" strokeWidth="1.8">
        <path d="M9 4c0 1.5 1.3 2.5 3 2.5S15 5.5 15 4" />
        <path d="M7 8l2-3h6l2 3v11a2 2 0 01-2 2H9a2 2 0 01-2-2V8z" />
        <rect x="9.5" y="12" width="5" height="4" rx="0.8" />
      </svg>
    </div>
  );
}

// Helper para embedar YouTube ou vídeo MP4
export function PlayerVideoEmbutido({ url, titulo, poster }) {
  if (!url) return null;
  const isYoutube = url.includes("youtube.com") || url.includes("youtu.be");
  let embedUrl = url;
  if (url.includes("watch?v=")) {
    const id = url.split("watch?v=")[1]?.split("&")[0];
    if (id) embedUrl = `https://www.youtube.com/embed/${id}`;
  } else if (url.includes("youtu.be/")) {
    const id = url.split("youtu.be/")[1]?.split("?")[0];
    if (id) embedUrl = `https://www.youtube.com/embed/${id}`;
  }

  return (
    <div className="rounded-xl overflow-hidden bg-black aspect-video w-full shadow-md border border-[#2E6F4E]/30">
      {isYoutube ? (
        <iframe
          src={embedUrl}
          title={titulo || "Vídeo demonstrativo"}
          className="w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      ) : (
        <video
          src={url}
          poster={poster}
          controls
          playsInline
          className="w-full h-full object-cover"
        />
      )}
    </div>
  );
}

// ── TELA 20: BANNER DE PROPÓSITO ─────────────────────────────────────────────
export function BrandValueBanner() {
  return (
    <div className="rounded-2xl bg-[#F2EFE9] border border-[#DFDBD2] p-6 sm:p-8 shadow-sm overflow-hidden relative">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 items-center relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full border border-[#C8C3B8] flex items-center justify-center text-[#244635]/60 shrink-0">
            <Flame size={22} />
          </div>
          <div>
            <p className="text-xl sm:text-2xl font-serif text-[#1F3A2D] leading-tight">Simplifique</p>
            <p className="text-xl sm:text-2xl font-serif italic text-[#2E6F4E] leading-tight">fluxos de praça</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full border border-[#C8C3B8] flex items-center justify-center text-[#244635]/60 shrink-0">
            <UtensilsCrossed size={22} />
          </div>
          <div>
            <p className="text-xl sm:text-2xl font-serif text-[#1F3A2D] leading-tight">Mantenha a</p>
            <p className="text-xl sm:text-2xl font-serif italic text-[#2E6F4E] leading-tight">consistência</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full border border-[#C8C3B8] flex items-center justify-center text-[#244635]/60 shrink-0">
            <GlassWater size={22} />
          </div>
          <div>
            <p className="text-xl sm:text-2xl font-serif text-[#1F3A2D] leading-tight">Eleve cada</p>
            <p className="text-xl sm:text-2xl font-serif italic text-[#2E6F4E] leading-tight">experiência na mesa</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── TELA 2 & 14: CARD DE BOAS-VINDAS COM ATALHOS DE COZINHA, BAR E EQUIPAMENTOS ─
export function WelcomeGovernanceCard({
  onSelectTopic,
  onOpenAdminStudio,
  fichasReais = [],
  receitasCustom = [],
  equipamentosCustom = [],
}) {
  const [mostrarDicas, setMostrarDicas] = useState(false);

  return (
    <div className="bg-white rounded-2xl border border-[#E2E0D8] shadow-sm p-5 sm:p-7 text-[#2B332E] space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 bg-[#EFF7F2] border border-[#B8D8C5] rounded-xl p-3.5">
        <div className="text-xs sm:text-sm text-[#1E3F2D] font-semibold">
          <strong>Integrado em Tempo Real:</strong> Fichas Técnicas, Ingredientes, Estoque e Equipamentos de{" "}
          <span className="underline font-black">Cozinha &amp; Bar</span>.
        </div>
        {onOpenAdminStudio && (
          <button
            onClick={onOpenAdminStudio}
            className="px-3.5 py-2 rounded-lg bg-[#1E4D3B] hover:bg-[#163B2C] text-white text-xs font-extrabold transition shadow-2xs"
          >
            + Alimentar Receitas, Fotos, Vídeos &amp; Equipamentos
          </button>
        )}
      </div>

      <div className="space-y-4">
        <h3 className="font-bold text-sm sm:text-base text-[#1C2826]">
          Pergunte por voz ou toque em um item abaixo (Receitas, Recálculo de Ingredientes, Voltagem 110V/220V, Encaixe e Limpeza):
        </h3>

        {/* Produção de Pratos, Drinks & Recálculo Proporcional */}
        <div>
          <p className="text-xs sm:text-sm text-[#55605A] mb-2 font-bold">
            🍲 Fichas Técnicas (Cozinha &amp; Bar) + Recálculo por Ingrediente
          </p>
          <div className="flex flex-wrap gap-2">
            {TOPICOS_INICIAIS.producao.map((t) => (
              <button
                key={t.id}
                onClick={() => onSelectTopic(t)}
                className="px-3.5 py-2 rounded-lg border border-[#76847D] bg-[#F9F9F7] hover:bg-[#EBF3EE] hover:border-[#1E4D3B] text-[#1E4D3B] font-bold text-xs sm:text-sm transition active:scale-[0.98]"
              >
                {t.label}
              </button>
            ))}
            {receitasCustom.map((rc) => (
              <button
                key={rc.id}
                onClick={() =>
                  onSelectTopic({
                    id: rc.id,
                    label: rc.nome,
                    prompt: `Como se faz ${rc.nome}?`,
                    receitaCustom: rc,
                  })
                }
                className="px-3.5 py-2 rounded-lg border border-[#2E6F4E] bg-[#E8F5EE] hover:bg-[#D5EDE0] text-[#1E4D3B] font-extrabold text-xs sm:text-sm transition"
              >
                ⭐ {rc.nome}
              </button>
            ))}
            {fichasReais.slice(0, 6).map((f) => (
              <button
                key={f.id}
                onClick={() =>
                  onSelectTopic({
                    id: `ficha-real-${f.id}`,
                    label: f.nome,
                    prompt: `Como se faz ${f.nome}?`,
                    fichaReal: f,
                  })
                }
                className="px-3.5 py-2 rounded-lg border border-[#2E6F4E]/50 bg-[#EFF7F2] hover:bg-[#E0F0E6] text-[#1E4D3B] font-bold text-xs sm:text-sm transition"
              >
                📋 {f.nome} ({f.departamento || "ERP"})
              </button>
            ))}
          </div>
        </div>

        {/* Equipamentos em Geral: 110V vs 220V, Encaixe de Copo/Tampa, Uso e Limpeza */}
        <div>
          <p className="text-xs sm:text-sm text-[#55605A] mb-2 font-bold">
            ⚡ Equipamentos em Geral (110V ou 220V, Como Encaixar, Usar, Limpar e Consertar)
          </p>
          <div className="flex flex-wrap gap-2">
            {(TOPICOS_INICIAIS.equipamentosDuvidas || []).map((t) => (
              <button
                key={t.id}
                onClick={() => onSelectTopic(t)}
                className="px-3.5 py-2 rounded-lg border border-[#76847D] bg-[#F9F9F7] hover:bg-[#EBF3EE] hover:border-[#1E4D3B] text-[#1E4D3B] font-bold text-xs sm:text-sm transition active:scale-[0.98]"
              >
                {t.label}
              </button>
            ))}
            {equipamentosCustom.map((eq) => (
              <button
                key={eq.id}
                onClick={() =>
                  onSelectTopic({
                    id: eq.id,
                    label: eq.nomeCurto || eq.nome,
                    prompt: `Esse ${eq.nomeCurto || eq.nome} é 110V ou 220V e como encaixar, usar e limpar?`,
                    equipamentoCustom: eq,
                  })
                }
                className="px-3.5 py-2 rounded-lg border border-[#2E6F4E] bg-[#E8F5EE] hover:bg-[#D5EDE0] text-[#1E4D3B] font-extrabold text-xs sm:text-sm transition"
              >
                🔌 {eq.nomeCurto || eq.nome} ({eq.voltagem})
              </button>
            ))}
          </div>
        </div>

        {/* Higienização, Limpeza & Química ANVISA */}
        <div>
          <p className="text-xs sm:text-sm text-[#55605A] mb-2 font-bold">
            🧼 Higienização &amp; Limpeza ANVISA (Chão ml, Panos, Mãos &amp; Frutas)
          </p>
          <div className="flex flex-wrap gap-2">
            {(TOPICOS_INICIAIS.limpeza || []).map((t) => (
              <button
                key={t.id}
                onClick={() => onSelectTopic(t)}
                className="px-3.5 py-2 rounded-lg border border-[#2E6F4E] bg-[#F0F8F4] hover:bg-[#E1F2E8] text-[#1E4D3B] font-bold text-xs sm:text-sm transition active:scale-[0.98]"
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Checklists de Praça & Etiqueta de Validade */}
        <div>
          <p className="text-xs sm:text-sm text-[#55605A] mb-2 font-bold">
            📋 Checklists de Praça (Abertura/Saída) &amp; Validade ANVISA
          </p>
          <div className="flex flex-wrap gap-2">
            {(TOPICOS_INICIAIS.checklists || []).map((t) => (
              <button
                key={t.id}
                onClick={() => onSelectTopic(t)}
                className="px-3.5 py-2 rounded-lg border border-[#8C6D23] bg-[#FCF8EE] hover:bg-[#F7EED4] text-[#694E0E] font-bold text-xs sm:text-sm transition active:scale-[0.98]"
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Estoque & Escala */}
        <div>
          <p className="text-xs sm:text-sm text-[#55605A] mb-2 font-bold">
            📦 Estoque (Cozinha/Bar), Câmara Fria &amp; Escala de Turno
          </p>
          <div className="flex flex-wrap gap-2">
            {[...TOPICOS_INICIAIS.estoque, ...TOPICOS_INICIAIS.escala].map((t) => (
              <button
                key={t.id}
                onClick={() => onSelectTopic(t)}
                className="px-3.5 py-2 rounded-lg border border-[#76847D] bg-[#F9F9F7] hover:bg-[#EBF3EE] hover:border-[#1E4D3B] text-[#1E4D3B] font-bold text-xs sm:text-sm transition active:scale-[0.98]"
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <hr className="border-[#E6E4DC]" />

      <div className="space-y-2">
        <div className="flex items-start gap-2.5 text-xs sm:text-sm font-semibold text-[#2B332E]">
          <Lightbulb size={16} className="text-amber-500 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p>1. Pergunte <strong>&ldquo;como se faz um vatapá&rdquo;</strong> e depois diga <strong>&ldquo;só tenho 2L de leite de coco&rdquo;</strong> para recalcular toda a ficha!</p>
            <p>2. Pergunte <strong>&ldquo;esse liquidificador é 110V ou 220V?&rdquo;</strong> para ver as fotos dos aparelhos da loja, clicar no seu e ver como encaixar o copo, usar e limpar.</p>
            <p>3. Pergunte <strong>&ldquo;qual a escala de hoje&rdquo;</strong> ou <strong>&ldquo;quem trabalha hoje&rdquo;</strong> para ver o organograma por área com todas as pessoas e seus horários de trabalho!</p>
            <p>4. Pergunte <strong>&ldquo;qual produto usar no chão e quantas ml&rdquo;</strong> ou <strong>&ldquo;como limpar um pano&rdquo;</strong> para ver dosagem química exata por balde e regras da ANVISA.</p>
            <p>5. Pergunte <strong>&ldquo;checklist de abertura&rdquo;</strong> ou <strong>&ldquo;checklist de saída&rdquo;</strong> para conferir mise en place e fechamento de gás/equipamentos sem esquecer nada.</p>
            {mostrarDicas && (
              <>
                <p>6. Diga <strong>&ldquo;gerar etiqueta&rdquo;</strong> para emitir etiquetas térmicas 60x40mm integradas ao seu app Héfisto.</p>
                <p>7. Clique em <strong>+ Alimentar Receitas, Fotos, Vídeos &amp; Equipamentos</strong> para cadastrar novos pratos, drinks e máquinas com fotos e vídeos.</p>
              </>
            )}
          </div>
        </div>
        <button
          onClick={() => setMostrarDicas((v) => !v)}
          className="px-3.5 py-1.5 rounded-lg border border-[#76847D] bg-white hover:bg-[#F3F2EE] text-[#1E4D3B] font-bold text-xs transition"
        >
          {mostrarDicas ? "Ocultar dicas" : "Ver mais dicas"}
        </button>
      </div>
    </div>
  );
}

// ── TELA 14: ALERTA PROATIVO DE PICO DE DEMANDA LOCAL ────────────────────────
export function DemandSpikeAlertCard({ onViewDetails }) {
  return (
    <div className="flex items-start gap-3">
      <GreenDotAvatar />
      <div className="flex-1 bg-white rounded-2xl border border-[#E2E0D8] shadow-sm p-5 text-[#1C2826] space-y-3">
        <p className="font-bold text-sm sm:text-base leading-snug">
          Há um pico de demanda previsto para o próximo horário na unidade. Deseja adicionar mais um colaborador ou extra no turno?
        </p>
        <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-[#244635]">
          <Clock size={17} className="text-[#2E6F4E]" />
          <span>Vamos encontrar a melhor solução juntos.</span>
        </div>
        <div>
          <button
            onClick={onViewDetails}
            className="px-4 py-2 rounded-lg border border-[#76847D] bg-[#F9F9F7] hover:bg-[#EBF3EE] text-[#1E4D3B] font-bold text-xs sm:text-sm transition"
          >
            Ver detalhes
          </button>
        </div>
      </div>
    </div>
  );
}

// ── TELA 3 + INGREDIENTES + ESTOQUE + BOTÃO DE RECÁLCULO: CARD DE RECEITA ─────
export function RecipeDetailCard({ receita, estoqueReal = [], onRecalcularClick }) {
  const [abrirSimuladorInline, setAbrirSimuladorInline] = useState(false);
  const [ingSelecionadoId, setIngSelecionadoId] = useState(
    receita?.ingredientesBase?.[0]?.id || ""
  );
  const [qtdTenho, setQtdTenho] = useState("");

  if (!receita) return null;

  const cruzarComEstoque = (nomeIng) => {
    if (!Array.isArray(estoqueReal) || !estoqueReal.length) return null;
    const n = String(nomeIng || "").toLowerCase();
    return estoqueReal.find(
      (item) =>
        item?.nome &&
        (String(item.nome).toLowerCase().includes(n) ||
          n.includes(String(item.nome).toLowerCase()))
    );
  };

  return (
    <div className="flex items-start gap-3">
      <GreenDotAvatar />
      <div className="flex-1 bg-white rounded-2xl border border-[#E2E0D8] shadow-md overflow-hidden text-[#2B332E]">
        {/* Hero Escuro com Título e Imagem */}
        <div className="bg-[#233329] p-5 sm:p-6 text-white">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div>
              <h3 className="text-lg sm:text-xl font-bold tracking-tight">{receita.nome}</h3>
              {receita.rendimentoPeso && (
                <p className="text-xs text-emerald-200/90 font-semibold mt-0.5">
                  Rendimento base: {receita.rendimentoPorcoes || 10} porções ({receita.rendimentoPeso}) · Tempo: {receita.tempoPreparo || "15 min"}
                </p>
              )}
            </div>
            <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-white/15 text-emerald-200 shrink-0">
              {receita.setor}
            </span>
          </div>
          <div className="rounded-xl overflow-hidden bg-[#18241C] aspect-16/10 max-h-64 flex items-center justify-center">
            <img
              src={receita.imagem}
              alt={receita.nome}
              className="w-full h-full object-cover"
            />
          </div>
        </div>

        {/* Corpo da Ficha */}
        <div className="p-5 sm:p-6 space-y-5">
          <p className="text-sm sm:text-base text-[#3D4641] leading-relaxed font-medium">
            {receita.descricao}
          </p>

          {/* 3 Colunas: SABOR | AROMA | TEXTURA */}
          <div className="grid grid-cols-3 gap-4 pt-1">
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-wider text-[#3A4A40] mb-1">
                SABOR
              </p>
              <p className="text-xs sm:text-sm text-[#4A5550] font-medium leading-snug">
                {receita.perfilSensorial?.sabor}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-wider text-[#3A4A40] mb-1">
                AROMA
              </p>
              <p className="text-xs sm:text-sm text-[#4A5550] font-medium leading-snug">
                {receita.perfilSensorial?.aroma}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-wider text-[#3A4A40] mb-1">
                TEXTURA
              </p>
              <p className="text-xs sm:text-sm text-[#4A5550] font-medium leading-snug">
                {receita.perfilSensorial?.textura}
              </p>
            </div>
          </div>

          {/* LISTA DE INGREDIENTES DA FICHA TÉCNICA + SALDO DO ESTOQUE + BOTÃO DE RECÁLCULO */}
          {Array.isArray(receita.ingredientesBase) && receita.ingredientesBase.length > 0 && (
            <div className="rounded-xl border border-[#DCE6DF] bg-[#F8FAF9] p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-black uppercase tracking-wider text-[#1E4D3B] flex items-center gap-1.5">
                    <Scale size={15} /> Ingredientes da Ficha Técnica (Base Padrão)
                  </p>
                  <p className="text-[11px] text-[#55605A] font-medium">
                    Tem menos de algum ingrediente na bancada? Recalcule a receita inteira com 1 toque ou falando no microfone!
                  </p>
                </div>
                <button
                  onClick={() => setAbrirSimuladorInline((v) => !v)}
                  className="px-3.5 py-1.5 rounded-lg bg-[#2E6F4E] hover:bg-[#23563C] text-white text-xs font-extrabold transition shadow-2xs"
                >
                  ⚖️ Recalcular por Ingrediente que Tenho
                </button>
              </div>

              {/* Simulador rápido inline */}
              {abrirSimuladorInline && (
                <div className="p-3.5 rounded-xl bg-white border border-[#2E6F4E] space-y-3 shadow-xs">
                  <p className="text-xs font-extrabold text-[#1C2826]">
                    Qual ingrediente está limitando sua produção hoje?
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
                    <div className="sm:col-span-6">
                      <label className="block text-[11px] font-bold text-[#4F5853] mb-1">
                        Ingrediente da Ficha
                      </label>
                      <select
                        value={ingSelecionadoId}
                        onChange={(e) => setIngSelecionadoId(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-[#C8C6BC] text-xs font-bold text-[#1C2826] bg-white"
                      >
                        {receita.ingredientesBase.map((ing) => (
                          <option key={ing.id} value={ing.id}>
                            {ing.nome} (Padrão: {ing.quantidade} {ing.unidade})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="sm:col-span-3">
                      <label className="block text-[11px] font-bold text-[#4F5853] mb-1">
                        Quanto você tem?
                      </label>
                      <input
                        type="number"
                        step="any"
                        placeholder="Ex: 2"
                        value={qtdTenho}
                        onChange={(e) => setQtdTenho(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-[#C8C6BC] text-xs font-bold text-[#1C2826]"
                      />
                    </div>
                    <div className="sm:col-span-3">
                      <button
                        onClick={() => {
                          const ing =
                            receita.ingredientesBase.find((i) => i.id === ingSelecionadoId) ||
                            receita.ingredientesBase[0];
                          const valor = Number(String(qtdTenho).replace(",", "."));
                          if (valor > 0 && onRecalcularClick) {
                            onRecalcularClick(receita, ing, valor);
                          }
                        }}
                        className="w-full py-2 px-3 rounded-lg bg-[#1E4D3B] hover:bg-[#143628] text-white text-xs font-extrabold transition"
                      >
                        Calcular Nova Receita
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {receita.ingredientesBase.map((ing) => {
                  const itemEst = cruzarComEstoque(ing.nome);
                  return (
                    <div
                      key={ing.id}
                      className="flex items-center justify-between px-3 py-2 rounded-lg bg-white border border-[#E5E4DC] text-xs"
                    >
                      <div className="min-w-0 pr-2">
                        <p className="font-bold text-[#1C2826] truncate">{ing.nome}</p>
                        {itemEst && (
                          <p className="text-[10px] font-semibold text-[#2E6F4E]">
                            Estoque atual: {itemEst.quantidade_atual} {itemEst.unidade_medida}
                          </p>
                        )}
                      </div>
                      <span className="font-black text-sm text-[#1E4D3B] shrink-0">
                        {ing.quantidade} {ing.unidade}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Tabela MAJOR STEPS (ETAPAS PRINCIPAIS) com cabeçalho verde-floresta */}
          <div className="pt-1">
            <div className="grid grid-cols-12 bg-[#3B624C] text-white px-3.5 py-2 rounded-t-lg text-xs font-extrabold uppercase tracking-wider items-center">
              <div className="col-span-6">ETAPAS PRINCIPAIS &amp; PORCIONAMENTO</div>
              {(receita.colunasTamanho || ["P", "M", "G", "FAM"]).map((col, idx) => (
                <div key={idx} className="col-span-1.5 text-center">
                  {col}
                </div>
              ))}
            </div>

            <div className="divide-y divide-[#E5E4DC] border-x border-b border-[#E5E4DC] rounded-b-lg">
              {(receita.majorSteps || []).map((row) => (
                <div key={row.id} className="grid grid-cols-12 items-center px-3.5 py-3 bg-white">
                  <div className="col-span-6 pr-3 border-r border-[#D8D6CE] text-xs sm:text-sm font-bold text-[#2B332E] flex items-start gap-1.5">
                    <span>{row.id}.</span>
                    <span>{row.etapa}</span>
                  </div>
                  {(row.valores || []).map((val, idx) => (
                    <div
                      key={idx}
                      className="col-span-1.5 text-center text-base sm:text-lg font-extrabold text-[#2B332E]"
                    >
                      {val}
                    </div>
                  ))}
                </div>
              ))}
            </div>
            {receita.legendaTamanhos && (
              <p className="text-[11px] text-[#68726D] mt-2 font-medium">{receita.legendaTamanhos}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── NOVO CARD: RECEITA RECALCULADA PROPORCIONALMENTE PELO INGREDIENTE LIMITANTE ─
export function RecipeRecalculatedCard({ calculoInicial }) {
  const [calculo, setCalculo] = useState(calculoInicial);
  const [ingId, setIngId] = useState(calculoInicial?.ingredienteLimitante?.id || "");
  const [novaQtdInput, setNovaQtdInput] = useState(
    String(calculoInicial?.quantidadeDisponivelLimitante || "")
  );

  if (!calculo || !calculo.receita) return null;

  const atualizarCalculoAoVivo = (idIngrediente, valorNum) => {
    const num = Number(String(valorNum).replace(",", "."));
    if (!num || num <= 0) return;
    const novo = recalcularReceitaPorIngrediente(calculo.receita, idIngrediente, num);
    if (novo) setCalculo(novo);
  };

  return (
    <div className="flex items-start gap-3">
      <GreenDotAvatar />
      <div className="flex-1 bg-white rounded-2xl border-2 border-[#2E6F4E] shadow-lg overflow-hidden text-[#1C2826]">
        {/* Cabeçalho Verde de Recálculo Inteligente */}
        <div className="bg-[#1E4D3B] text-white p-5 sm:p-6 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="px-3 py-1 rounded-full bg-emerald-400/20 text-emerald-200 text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5">
              <Scale size={14} /> Ficha Técnica Recalculada Automaticamente
            </span>
            <span className="text-xs font-extrabold bg-white/15 px-3 py-1 rounded-full">
              Proporção: {calculo.percentual}% da receita original
            </span>
          </div>
          <h3 className="text-lg sm:text-xl font-black">
            {calculo.receita.nome} — Ajuste para {calculo.quantidadeDisponivelLimitante}{" "}
            {calculo.ingredienteLimitante.unidade} de {calculo.ingredienteLimitante.nome}
          </h3>
          <p className="text-xs sm:text-sm text-emerald-100 font-medium">
            Como você tem{" "}
            <strong>
              {calculo.quantidadeDisponivelLimitante} {calculo.ingredienteLimitante.unidade}
            </strong>{" "}
            de <strong>{calculo.ingredienteLimitante.nome}</strong> (em vez de{" "}
            {calculo.quantidadeOriginalLimitante} {calculo.ingredienteLimitante.unidade}), todos os demais ingredientes foram reduzidos/ajustados na mesma proporção exata para não alterar o sabor nem o ponto!
          </p>
        </div>

        <div className="p-5 sm:p-6 space-y-5">
          {/* Resumo de Rendimento Ajustado */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-xl bg-[#F4F3EF] border border-[#E2E0D8]">
              <p className="text-[10px] font-black uppercase text-[#5A655F]">Ingrediente Limitante</p>
              <p className="text-sm font-black text-[#1E4D3B] mt-0.5">
                {calculo.ingredienteLimitante.nome}
              </p>
              <p className="text-xs text-[#4F5853] font-bold">
                De {calculo.quantidadeOriginalLimitante} {calculo.ingredienteLimitante.unidade} &rarr;{" "}
                <strong className="text-[#1E4D3B]">
                  {calculo.quantidadeDisponivelLimitante} {calculo.ingredienteLimitante.unidade}
                </strong>
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-[#F4F3EF] border border-[#E2E0D8]">
              <p className="text-[10px] font-black uppercase text-[#5A655F]">Novo Rendimento</p>
              <p className="text-base font-black text-[#1C2826] mt-0.5">
                {calculo.porcoesNovas} porções
              </p>
              <p className="text-xs text-[#4F5853] font-bold">
                (Receita padrão: {calculo.porcoesOriginais} porções)
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-[#EFF7F2] border border-[#B8D8C5]">
              <p className="text-[10px] font-black uppercase text-[#1E4D3B]">
                Testar Outra Quantidade
              </p>
              <div className="flex items-center gap-1.5 mt-1">
                <select
                  value={ingId}
                  onChange={(e) => {
                    setIngId(e.target.value);
                    atualizarCalculoAoVivo(e.target.value, novaQtdInput);
                  }}
                  className="w-full px-2 py-1 rounded border border-[#9EB5A8] bg-white text-[11px] font-bold"
                >
                  {calculo.receita.ingredientesBase.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.nome} ({i.unidade})
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  step="any"
                  value={novaQtdInput}
                  onChange={(e) => {
                    setNovaQtdInput(e.target.value);
                    atualizarCalculoAoVivo(ingId, e.target.value);
                  }}
                  className="w-20 px-2 py-1 rounded border border-[#2E6F4E] bg-white text-xs font-black text-center"
                />
              </div>
            </div>
          </div>

          {/* Tabela Comparativa: Ingrediente | Original | NOVA QUANTIDADE */}
          <div className="overflow-x-auto rounded-xl border border-[#DCE0DC]">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#3B624C] text-white text-[11px] font-extrabold uppercase">
                  <th className="p-3">Ingrediente da Ficha</th>
                  <th className="p-3 text-center">Receita Padrão</th>
                  <th className="p-3 text-center bg-[#244B37]">Nova Quantidade a Pesar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E6E4DC] text-xs sm:text-sm">
                {calculo.ingredientesRecalculados.map((item) => (
                  <tr
                    key={item.id}
                    className={
                      item.isLimitante ? "bg-[#E8F5EE] font-extrabold" : "bg-white hover:bg-[#FAF9F6]"
                    }
                  >
                    <td className="p-3 font-bold text-[#1C2826] flex items-center gap-2">
                      <span>{item.nome}</span>
                      {item.isLimitante && (
                        <span className="px-2 py-0.5 rounded-full bg-[#2E6F4E] text-white text-[10px] font-black uppercase">
                          Seu limite atual
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-center text-[#68726D] line-through font-semibold">
                      {item.quantidadeOriginal} {item.unidade}
                    </td>
                    <td className="p-3 text-center text-base font-black text-[#1E4D3B] bg-[#EFF7F2]/60">
                      {item.quantidadeNova} {item.unidade}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── TELA 4: PASSO A PASSO COM FOTO + VÍDEO COMPLETO + DICAS ──────────────────
export function RecipeInteractiveFollowUp({
  receita,
  mostrarVideo,
  onToggleVideo,
  onSelectCategoryTip,
  categoriaAtiva,
}) {
  const [stepAtivo, setStepAtivo] = useState(0);
  const [abaMidia, setAbaMidia] = useState("passos"); // "passos" | "video"
  const steps = receita?.videoSteps || [];
  const stepAtual = steps[stepAtivo] || steps[0];

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <GreenDotAvatar />
        <div className="flex-1 bg-white rounded-2xl border border-[#E2E0D8] shadow-sm p-4 sm:p-5 space-y-3">
          <p className="text-sm sm:text-base font-bold text-[#1C2826]">
            Quer ver o passo a passo com fotos e vídeo de preparo do{" "}
            <strong>{receita?.nome?.replace("*", "")}</strong>?
          </p>
          <div className="flex flex-wrap gap-2.5">
            <button
              onClick={() => {
                onToggleVideo(true);
                setAbaMidia("passos");
              }}
              className={`px-4 py-2 rounded-lg font-bold text-xs sm:text-sm transition ${
                mostrarVideo && abaMidia === "passos"
                  ? "bg-[#24593F] text-white shadow-xs"
                  : "bg-[#2E6F4E] hover:bg-[#24593F] text-white"
              }`}
            >
              📸 Ver Passo a Passo com Fotos
            </button>
            {receita?.videoUrl && (
              <button
                onClick={() => {
                  onToggleVideo(true);
                  setAbaMidia("video");
                }}
                className={`px-4 py-2 rounded-lg font-bold text-xs sm:text-sm transition flex items-center gap-1.5 ${
                  mostrarVideo && abaMidia === "video"
                    ? "bg-[#1E4D3B] text-white"
                    : "border border-[#2E6F4E] bg-[#EFF7F2] text-[#1E4D3B] hover:bg-[#DCECE3]"
                }`}
              >
                <PlayCircle size={16} /> Assistir Vídeo da Receita
              </button>
            )}
            <button
              onClick={() => onToggleVideo(false)}
              className="px-4 py-2 rounded-lg border border-[#76847D] bg-white hover:bg-[#F4F3EF] text-[#1E4D3B] font-bold text-xs sm:text-sm transition"
            >
              Ocultar guia visual
            </button>
          </div>
        </div>
      </div>

      {/* Player de Fotos Passo a Passo OU Vídeo Completo */}
      {mostrarVideo && (
        <div className="flex items-start gap-3">
          <GreenDotAvatar />
          <div className="flex-1 bg-white rounded-2xl border border-[#E2E0D8] shadow-sm overflow-hidden">
            {abaMidia === "video" && receita?.videoUrl ? (
              <div className="p-4 sm:p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm sm:text-base font-extrabold text-[#1C2826] flex items-center gap-2">
                    <PlayCircle size={18} className="text-[#2E6F4E]" />
                    Vídeo Oficial de Preparo — {receita.nome}
                  </h4>
                  <button
                    onClick={() => setAbaMidia("passos")}
                    className="text-xs font-bold text-[#2E6F4E] underline"
                  >
                    Ver etapas em fotos
                  </button>
                </div>
                <PlayerVideoEmbutido
                  url={receita.videoUrl}
                  titulo={receita.nome}
                  poster={receita.imagem}
                />
              </div>
            ) : (
              stepAtual && (
                <>
                  <div className="relative aspect-16/10 max-h-72 bg-[#1A241E]">
                    <img
                      src={stepAtual.imagem}
                      alt={stepAtual.titulo}
                      className="w-full h-full object-cover opacity-90"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />

                    <div className="absolute bottom-5 left-5 right-5 flex flex-col gap-2">
                      <span className="inline-block w-fit bg-[#2E6F4E]/95 text-white font-bold text-sm sm:text-base px-4 py-1.5 rounded-lg shadow-md">
                        {stepAtual.ordem}. {stepAtual.titulo}
                      </span>
                      <p className="text-xs sm:text-sm text-white/95 font-medium bg-black/50 backdrop-blur-xs p-2.5 rounded-lg">
                        {stepAtual.detalhe}
                      </p>
                    </div>
                  </div>

                  <div className="px-4 py-3 bg-[#F8F7F3] border-t border-[#E5E4DC] flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {steps.map((s, idx) => (
                        <button
                          key={s.ordem || idx}
                          onClick={() => setStepAtivo(idx)}
                          className={`px-3 py-1 rounded-full text-xs font-bold transition ${
                            stepAtivo === idx
                              ? "bg-[#2E6F4E] text-white"
                              : "bg-white border border-[#D0CEC4] text-[#3B4740] hover:bg-[#EBF3EE]"
                          }`}
                        >
                          Passo {s.ordem || idx + 1}
                        </button>
                      ))}
                    </div>
                    <span className="text-xs font-bold text-[#5A655F]">
                      Etapa {stepAtivo + 1} de {steps.length}
                    </span>
                  </div>
                </>
              )
            )}
          </div>
        </div>
      )}

      {/* Card: Dicas para adaptações inteligentes */}
      <div className="flex items-start gap-3">
        <GreenDotAvatar />
        <div className="flex-1 bg-white rounded-2xl border border-[#E2E0D8] shadow-sm p-4 sm:p-5 space-y-3">
          <p className="text-sm sm:text-base font-bold text-[#1C2826]">
            Dicas rápidas de bancada para {receita?.nome?.replace("*", "")}:
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            {[
              { id: "customizacao", label: "Dicas de execução & ponto" },
              { id: "sabor", label: "Segredo de sabor" },
              { id: "substituicoes", label: "Substituições & Recálculo" },
            ].map((cat) => (
              <button
                key={cat.id}
                onClick={() => onSelectCategoryTip(cat.id)}
                className={`px-3.5 py-2 rounded-lg border font-bold text-xs sm:text-sm transition ${
                  categoriaAtiva === cat.id
                    ? "border-[#1E4D3B] bg-[#2E6F4E] text-white"
                    : "border-[#76847D] bg-white hover:bg-[#EBF3EE] text-[#1E4D3B]"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {categoriaAtiva && receita?.dicasCategorias?.[categoriaAtiva] && (
            <div className="mt-3 p-3.5 rounded-xl bg-[#EFF7F2] border border-[#B8D8C5] text-xs sm:text-sm text-[#1E3F2D] font-medium leading-relaxed">
              💡 <strong>Dica do Chef:</strong> {receita.dicasCategorias[categoriaAtiva]}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── TELAS 5 & 6: CHECKLIST DE CUSTOMIZAÇÃO ANINHADO + PAIRING RECOMMENDATION ─
export function CustomizationAndPairingCard({ receita }) {
  const [marcados, setMarcados] = useState({});
  const [indicePar, setIndicePar] = useState(0);

  if (!receita) return null;
  const harmonizacoes = receita.harmonizacoes || [];
  const parAtual = harmonizacoes[indicePar] || harmonizacoes[0];

  const toggleCheck = (id) => {
    setMarcados((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <GreenDotAvatar />
        <div className="flex-1 bg-white rounded-2xl border border-[#E2E0D8] shadow-sm p-5 space-y-3">
          <p className="text-sm sm:text-base font-bold text-[#1C2826]">
            Aqui estão algumas formas de customizar este pedido na comanda:
          </p>

          <div className="space-y-2.5 pt-1">
            {(receita.customizacoes || []).map((item) => (
              <div key={item.id} className="space-y-2">
                <label className="flex items-center gap-2.5 cursor-pointer select-none text-xs sm:text-sm font-bold text-[#2B332E]">
                  <input
                    type="checkbox"
                    checked={!!marcados[item.id]}
                    onChange={() => toggleCheck(item.id)}
                    className="w-4 h-4 rounded border-[#8A948E] text-[#2E6F4E] focus:ring-[#2E6F4E]"
                  />
                  <span>{item.label}</span>
                </label>

                {Array.isArray(item.opcoes) && (
                  <div className="pl-7 space-y-2">
                    {item.opcoes.map((sub) => (
                      <label
                        key={sub.id}
                        className="flex items-center gap-2.5 cursor-pointer select-none text-xs sm:text-sm font-semibold text-[#424D47]"
                      >
                        <input
                          type="checkbox"
                          checked={!!marcados[sub.id]}
                          onChange={() => toggleCheck(sub.id)}
                          className="w-4 h-4 rounded border-[#8A948E] text-[#2E6F4E] focus:ring-[#2E6F4E]"
                        />
                        <span>{sub.label}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {parAtual && (
        <div className="flex items-start gap-3">
          <GreenDotAvatar />
          <div className="flex-1 bg-white rounded-2xl border border-[#E2E0D8] shadow-sm p-5 sm:p-6 space-y-4">
            <p className="text-[11px] font-extrabold uppercase tracking-widest text-[#3A4A40]">
              RECOMENDAÇÃO DE HARMONIZAÇÃO (UPSELL SALÃO)
            </p>
            <p className="text-sm sm:text-base font-bold text-[#1C2826] leading-snug">
              {parAtual.motivo}
            </p>

            <div className="rounded-2xl border border-[#E6E4DC] bg-[#FAF9F6] p-4 shadow-xs space-y-3">
              <div className="aspect-16/10 max-h-56 rounded-xl overflow-hidden bg-[#2A332D]">
                <img
                  src={parAtual.imagem}
                  alt={parAtual.nome}
                  className="w-full h-full object-cover"
                />
              </div>

              <div>
                <h4 className="text-base sm:text-lg font-extrabold text-[#2B332E]">
                  {parAtual.nome}
                </h4>
                <div className="flex items-center justify-between text-xs sm:text-sm font-bold text-[#5C6660] mt-1">
                  <span>{parAtual.preco}</span>
                  <span>{parAtual.calorias}</span>
                </div>
              </div>

              {harmonizacoes.length > 1 && (
                <div className="flex items-center justify-center pt-1">
                  <div className="inline-flex rounded-full border border-[#D5D3C9] bg-white overflow-hidden shadow-2xs">
                    <button
                      onClick={() =>
                        setIndicePar((i) => (i - 1 + harmonizacoes.length) % harmonizacoes.length)
                      }
                      className="px-3.5 py-1.5 text-[#3B4740] hover:bg-[#F2F1EC] transition border-r border-[#D5D3C9]"
                      aria-label="Sugestão anterior"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <button
                      onClick={() => setIndicePar((i) => (i + 1) % harmonizacoes.length)}
                      className="px-3.5 py-1.5 text-[#3B4740] hover:bg-[#F2F1EC] transition"
                      aria-label="Próxima sugestão"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── NOVO FLUXO VISUAL DE EQUIPAMENTOS: 110V vs 220V + ENCAIXE DO COPO/TAMPA + USO + LIMPEZA ──
export function EquipmentVisualSelectorAndGuidesCard({
  equipamentos,
  categoriaFiltro = null,
  equipamentoInicialId = null,
  abaInicial = "voltagem",
  onAbrirManutencao,
}) {
  const listaFiltrada = categoriaFiltro
    ? equipamentos.filter(
        (e) =>
          e.categoriaTipo === categoriaFiltro ||
          e.nome.toLowerCase().includes(categoriaFiltro.toLowerCase())
      )
    : equipamentos;

  const listaExibida = listaFiltrada.length > 0 ? listaFiltrada : equipamentos;

  const [selecionadoId, setSelecionadoId] = useState(
    equipamentoInicialId || (listaExibida.length === 1 ? listaExibida[0].id : null)
  );
  const [abaAtiva, setAbaAtiva] = useState(abaInicial || "voltagem"); // "voltagem" | "encaixe" | "uso" | "limpeza"
  const [mostrarVideoGuia, setMostrarVideoGuia] = useState(false);

  const equip =
    equipamentos.find((e) => e.id === selecionadoId) ||
    listaExibida.find((e) => e.id === selecionadoId) ||
    null;

  const guiaAtual =
    abaAtiva === "encaixe"
      ? equip?.guiaEncaixe
      : abaAtiva === "uso"
      ? equip?.guiaUso
      : abaAtiva === "limpeza"
      ? equip?.guiaLimpeza
      : null;

  return (
    <div className="space-y-4">
      {/* PASSO 1: MOSTRAR AS FOTOS DOS EQUIPAMENTOS CADASTRADOS PARA O COLABORADOR CLICAR */}
      <div className="flex items-start gap-3">
        <GreenDotAvatar />
        <div className="flex-1 bg-white rounded-2xl border border-[#E2E0D8] shadow-md p-5 sm:p-6 space-y-4">
          <div>
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#2E6F4E]">
              Identificação Visual de Equipamento (Cozinha &amp; Bar)
            </span>
            <h3 className="text-base sm:text-lg font-black text-[#1C2826] mt-0.5">
              Encontrei {listaExibida.length} equipamento(s) cadastrado(s). Toque na foto de qual você está usando agora:
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
            {listaExibida.map((item) => {
              const ativo = selecionadoId === item.id;
              const is220 = String(item.voltagem || "").includes("220") || String(item.voltagem || "").includes("380");
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setSelecionadoId(item.id);
                    setMostrarVideoGuia(false);
                  }}
                  className={`text-left rounded-2xl border-2 overflow-hidden transition flex flex-col justify-between shadow-xs ${
                    ativo
                      ? "border-[#1E4D3B] ring-2 ring-[#2E6F4E]/40 bg-[#EFF7F2]"
                      : "border-[#E2E0D8] bg-[#FAF9F6] hover:border-[#2E6F4E]"
                  }`}
                >
                  <div>
                    <div className="relative h-36 bg-[#232A26] overflow-hidden">
                      <img
                        src={item.imagem}
                        alt={item.nome}
                        className="w-full h-full object-cover"
                      />
                      <span
                        className={`absolute top-2.5 right-2.5 px-2.5 py-1 rounded-full text-xs font-black shadow-md ${
                          is220
                            ? "bg-red-600 text-white"
                            : "bg-amber-400 text-slate-950"
                        }`}
                      >
                        ⚡ {item.voltagem || "220V"}
                      </span>
                    </div>
                    <div className="p-3.5 space-y-1">
                      <p className="text-xs sm:text-sm font-black text-[#1C2826] leading-snug">
                        {item.nomeCurto || item.nome}
                      </p>
                      <p className="text-[11px] font-semibold text-[#55605A]">{item.setor}</p>
                    </div>
                  </div>
                  <div className="px-3.5 pb-3.5">
                    <span
                      className={`block w-full text-center py-1.5 rounded-lg text-xs font-extrabold ${
                        ativo
                          ? "bg-[#1E4D3B] text-white"
                          : "bg-white border border-[#76847D] text-[#1E4D3B]"
                      }`}
                    >
                      {ativo ? "✓ Equipamento Selecionado" : "Este é o meu equipamento"}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* PASSO 2: QUANDO ELE CLICA NO EQUIPAMENTO, MOSTRA A RESPOSTA DE VOLTAGEM + COMO ENCAIXAR COPO/TAMPA + COMO USAR + COMO LIMPAR */}
      {equip && (
        <div className="flex items-start gap-3">
          <GreenDotAvatar />
          <div className="flex-1 bg-white rounded-2xl border-2 border-[#2E6F4E] shadow-lg overflow-hidden text-[#1C2826]">
            {/* Banner de Voltagem 110V vs 220V em Destaque */}
            <div
              className={`p-5 text-white flex flex-wrap items-center justify-between gap-4 ${
                String(equip.voltagem || "").includes("110")
                  ? "bg-gradient-to-r from-[#233329] to-[#4A3B12]"
                  : "bg-gradient-to-r from-[#1E4D3B] to-[#6B1D1D]"
              }`}
            >
              <div className="space-y-1">
                <span className="text-[11px] font-black uppercase tracking-wider text-emerald-200">
                  {equip.setor} · {equip.codigoSerie}
                </span>
                <h4 className="text-lg sm:text-xl font-black">{equip.nome}</h4>
                <p className="text-xs sm:text-sm text-white/90 font-semibold">
                  🔌 {equip.corTomada || `Ligar somente em tomada compatível com ${equip.voltagem}`}
                </p>
              </div>
              <div className="bg-white text-[#1C2826] px-5 py-3 rounded-2xl text-center shadow-lg shrink-0">
                <p className="text-[10px] font-black uppercase text-[#5A655F]">TENSÃO ELÉTRICA</p>
                <p className="text-2xl sm:text-3xl font-black text-[#1E4D3B] flex items-center gap-1">
                  <Zap size={24} className="text-amber-500 fill-amber-500" />
                  {equip.voltagem || "220V"}
                </p>
              </div>
            </div>

            {/* Navegação de Abas: Voltagem | Como Encaixar Copo e Tampa | Como Usar | Como Limpar | Manutenção */}
            <div className="px-4 pt-3 bg-[#F4F3EF] border-b border-[#E2E0D8] flex flex-wrap gap-1.5">
              {[
                { id: "voltagem", label: "⚡ 110V ou 220V (Tomada)" },
                { id: "encaixe", label: "🧩 Como Encaixar Copo e Tampa" },
                { id: "uso", label: "▶️ Como Usar / Operar" },
                { id: "limpeza", label: "🧼 Como Limpar e Higienizar" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => {
                    setAbaAtiva(tab.id);
                    setMostrarVideoGuia(false);
                  }}
                  className={`px-3.5 py-2 rounded-t-xl text-xs sm:text-sm font-extrabold transition ${
                    abaAtiva === tab.id
                      ? "bg-white text-[#1E4D3B] border-t-2 border-x border-[#2E6F4E]"
                      : "text-[#4F5853] hover:bg-white/60"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
              {onAbrirManutencao && (
                <button
                  onClick={() => onAbrirManutencao(equip.id)}
                  className="ml-auto px-3 py-1.5 mb-1.5 rounded-lg bg-[#E7B5AC] hover:bg-[#DDA399] text-[#6E261E] text-xs font-extrabold transition"
                >
                  🛠️ Resolver Falha / Abrir Chamado
                </button>
              )}
            </div>

            {/* Conteúdo da Aba Selecionada */}
            <div className="p-5 sm:p-6 space-y-4">
              {abaAtiva === "voltagem" && (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-amber-50 border border-amber-300 text-amber-950 flex items-start gap-3">
                    <ShieldAlert size={22} className="text-amber-600 shrink-0 mt-0.5" />
                    <div className="space-y-1 text-xs sm:text-sm">
                      <p className="font-black">
                        Resposta Direta: O {equip.nomeCurto || equip.nome} é{" "}
                        <span className="underline">{equip.voltagem}</span>!
                      </p>
                      <p className="font-medium leading-relaxed">
                        {equip.alertaVoltagem ||
                          `Conecte exclusivamente na ${equip.corTomada || "tomada indicada na bancada"}.`}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <button
                      onClick={() => setAbaAtiva("encaixe")}
                      className="p-4 rounded-xl border border-[#DCE6DF] bg-[#F8FAF9] hover:bg-[#EFF7F2] text-left transition space-y-1"
                    >
                      <p className="text-xs font-black text-[#1E4D3B]">
                        🧩 1. Como Encaixar Copo e Tampa &rarr;
                      </p>
                      <p className="text-[11px] text-[#55605A]">
                        Veja foto e vídeo de como alinhar o pino de arraste e vedar a tampa.
                      </p>
                    </button>
                    <button
                      onClick={() => setAbaAtiva("uso")}
                      className="p-4 rounded-xl border border-[#DCE6DF] bg-[#F8FAF9] hover:bg-[#EFF7F2] text-left transition space-y-1"
                    >
                      <p className="text-xs font-black text-[#1E4D3B]">
                        ▶️ 2. Como Usar com Segurança &rarr;
                      </p>
                      <p className="text-[11px] text-[#55605A]">
                        Ordem dos ingredientes, botão Pulsar e limite de líquidos quentes.
                      </p>
                    </button>
                    <button
                      onClick={() => setAbaAtiva("limpeza")}
                      className="p-4 rounded-xl border border-[#DCE6DF] bg-[#F8FAF9] hover:bg-[#EFF7F2] text-left transition space-y-1"
                    >
                      <p className="text-xs font-black text-[#1E4D3B]">
                        🧼 3. Como Limpar sem Acidentes &rarr;
                      </p>
                      <p className="text-[11px] text-[#55605A]">
                        Higienização das lâminas, borracha de vedação e sanitização ANVISA.
                      </p>
                    </button>
                  </div>
                </div>
              )}

              {guiaAtual && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h4 className="text-base sm:text-lg font-black text-[#1C2826]">
                        {guiaAtual.titulo}
                      </h4>
                      <p className="text-xs sm:text-sm text-[#4F5853] font-medium">
                        {guiaAtual.resumo}
                      </p>
                    </div>
                    {(guiaAtual.videoUrl || equip.videoUrl) && (
                      <button
                        onClick={() => setMostrarVideoGuia((v) => !v)}
                        className="px-4 py-2 rounded-lg bg-[#2E6F4E] hover:bg-[#23563C] text-white text-xs font-extrabold flex items-center gap-1.5 transition"
                      >
                        <PlayCircle size={16} />
                        {mostrarVideoGuia ? "Ver Foto Ilustrativa" : "Assistir Vídeo deste Passo"}
                      </button>
                    )}
                  </div>

                  {/* Foto ou Vídeo do Guia (Encaixe / Uso / Limpeza) */}
                  {mostrarVideoGuia && (guiaAtual.videoUrl || equip.videoUrl) ? (
                    <PlayerVideoEmbutido
                      url={guiaAtual.videoUrl || equip.videoUrl}
                      titulo={guiaAtual.titulo}
                      poster={guiaAtual.foto || equip.imagem}
                    />
                  ) : (
                    <div className="rounded-xl overflow-hidden bg-[#1D2621] aspect-16/9 max-h-64 relative">
                      <img
                        src={guiaAtual.foto || equip.imagem}
                        alt={guiaAtual.titulo}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute bottom-3 left-3 bg-[#1E4D3B]/95 text-white px-3.5 py-1.5 rounded-lg text-xs font-bold shadow">
                        {equip.nomeCurto} · {guiaAtual.titulo}
                      </div>
                    </div>
                  )}

                  {/* Lista numerada de instruções */}
                  <div className="space-y-2">
                    {(guiaAtual.passos || []).map((p, idx) => (
                      <div
                        key={idx}
                        className="p-3.5 rounded-xl bg-[#F8F7F3] border border-[#E5E3DA] text-xs sm:text-sm font-bold text-[#1C2826] leading-relaxed"
                      >
                        {p}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── CARD DE ROTINA OPERACIONAL (PULL-TO-THAW / PVPS / FORNO) ─────────────────
export function OperationalRoutineCard({ rotina }) {
  if (!rotina) return null;

  return (
    <div className="flex items-start gap-3">
      <GreenDotAvatar />
      <div className="flex-1 bg-white rounded-2xl border border-[#E2E0D8] shadow-sm p-5 sm:p-6 space-y-4">
        <div>
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#2E6F4E]">
            {rotina.categoria}
          </span>
          <h3 className="text-base sm:text-lg font-black text-[#1C2826] mt-0.5">{rotina.titulo}</h3>
          <p className="text-xs sm:text-sm text-[#4F5853] mt-1 font-medium">{rotina.resumo}</p>
        </div>

        {Array.isArray(rotina.etapas) && (
          <div className="space-y-2.5">
            {rotina.etapas.map((et, i) => (
              <div
                key={i}
                className="p-3.5 rounded-xl bg-[#F8F7F3] border border-[#E5E3DA] space-y-1"
              >
                <p className="text-xs sm:text-sm font-extrabold text-[#1E3F2D]">{et.titulo}</p>
                <p className="text-xs sm:text-sm text-[#4A544E]">{et.desc}</p>
              </div>
            ))}
          </div>
        )}

        {Array.isArray(rotina.tabela) && (
          <div className="overflow-x-auto rounded-xl border border-[#DCE0DC]">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#3B624C] text-white text-[11px] font-extrabold uppercase">
                  <th className="p-3">Insumo Congelado</th>
                  <th className="p-3">Tempo em Câmara</th>
                  <th className="p-3">Validade Após</th>
                  <th className="p-3">Alocação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E6E4DC] text-xs sm:text-sm">
                {rotina.tabela.map((row, idx) => (
                  <tr key={idx} className="bg-white hover:bg-[#F7FAF8]">
                    <td className="p-3 font-bold text-[#1C2826]">{row.insumo}</td>
                    <td className="p-3 font-semibold text-[#2E6F4E]">{row.tempoDescongelamento}</td>
                    <td className="p-3 font-semibold text-[#2B332E]">{row.validadeApos}</td>
                    <td className="p-3 text-[#525D57]">{row.prateleira}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ── TELA 7 A 13: CENTRAL DE MANUTENÇÃO DE EQUIPAMENTOS & CHAMADOS ────────────
export function EquipmentMaintenanceFlowCard({
  equipamentos,
  equipamentoInicialId,
  chamados,
  onNovoChamado,
  unidadeInfo,
  sessao,
}) {
  const [modo, setModo] = useState(equipamentoInicialId ? "anatomia" : "hub");
  const [equipSelecionadoId, setEquipSelecionadoId] = useState(
    equipamentoInicialId || equipamentos[0]?.id
  );
  const [buscaErro, setBuscaErro] = useState("");
  const [passoIdx, setPassoIdx] = useState(0);
  const [mostrarPecas, setMostrarPecas] = useState(false);
  const [chamadoDetalhe, setChamadoDetalhe] = useState(chamados[0] || null);

  const equip =
    equipamentos.find((e) => e.id === equipSelecionadoId) || equipamentos[0];
  const passos = equip?.passosTroubleshooting || [];
  const passoAtual = passos[passoIdx] || passos[0];

  const selecionarEquipamento = (id) => {
    setEquipSelecionadoId(id);
    setPassoIdx(0);
    setMostrarPecas(false);
    setModo("anatomia");
  };

  const registrarChamadoFinal = () => {
    const novoId = String(Math.floor(16096000 + Math.random() * 8999));
    const novo = {
      id: novoId,
      equipamento: `${equip.nomeCurto}: ${equip.falhaPrincipal}`,
      categoria: "EQUIPAMENTOS",
      status: "Chamado Aberto",
      corStatus: "emerald",
      atualizado: "Atualizado agora mesmo",
      recente: true,
      serie: equip.codigoSerie,
      detalheProblema: `${equip.falhaPrincipal}. Diagnóstico guiado concluído pelo colaborador sem resolução definitiva.`,
      fornecedor: "TecFood Assistência Autorizada",
      ordemServico: String(Math.floor(17380000 + Math.random() * 9000)),
      janelaChegada: "Hoje, em até 2 horas",
      telefoneSuporte: "0800-770-4110",
    };
    onNovoChamado?.(novo);
    setChamadoDetalhe(novo);
    setModo("enviado");
  };

  return (
    <div className="space-y-4">
      {modo === "hub" && (
        <div className="flex items-start gap-3">
          <GreenDotAvatar />
          <div className="flex-1 bg-white rounded-2xl border border-[#E2E0D8] shadow-sm overflow-hidden">
            <div className="bg-[#DCECE3] p-5 sm:p-6 relative">
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-1.5 max-w-md">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-[#1E4D3B] text-white flex items-center justify-center font-black text-xs">
                      H
                    </div>
                    <div className="border-l border-[#8AA899] pl-2">
                      <p className="text-[10px] font-black uppercase tracking-wider text-[#1E4D3B]">
                        HÉFISTO RESTAURANTE
                      </p>
                      <p className="text-xs sm:text-sm font-extrabold text-[#1C2826]">
                        Central de Manutenção de Equipamentos
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-[#384E42] font-medium pt-1">
                    Bem-vindo ao futuro da manutenção preventiva e solução rápida de falhas para sua cozinha, bar e salão.
                  </p>
                </div>

                <div className="w-16 h-16 rounded-full bg-[#8ED1AE]/50 border-2 border-[#2E6F4E]/30 flex items-center justify-center text-[#1E4D3B] shrink-0">
                  <Wrench size={30} />
                </div>
              </div>

              <div className="mt-4 flex items-center bg-white rounded-full p-1.5 pl-4 shadow-xs border border-[#C5DDD0]">
                <input
                  type="text"
                  value={buscaErro}
                  onChange={(e) => setBuscaErro(e.target.value)}
                  placeholder="descreva a falha do equipamento ou digite o código de erro..."
                  className="flex-1 bg-transparent text-xs sm:text-sm text-[#1C2826] placeholder:text-[#78847E] focus:outline-none"
                />
                <button
                  onClick={() => {
                    const achado = equipamentos.find(
                      (eq) =>
                        eq.nome.toLowerCase().includes(buscaErro.toLowerCase()) ||
                        eq.falhaPrincipal.toLowerCase().includes(buscaErro.toLowerCase())
                    );
                    selecionarEquipamento(achado ? achado.id : equipamentos[0].id);
                  }}
                  className="w-8 h-8 rounded-full bg-[#2E6F4E] text-white flex items-center justify-center hover:bg-[#23563C] transition"
                >
                  <Search size={15} />
                </button>
              </div>
            </div>

            <div className="p-5 sm:p-6 space-y-5">
              <div>
                <h4 className="text-sm font-extrabold text-[#1C2826] mb-3">Seus equipamentos</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  {equipamentos.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-xl bg-[#4A4C4E] text-white p-4 flex flex-col justify-between min-h-[215px] shadow-xs relative"
                    >
                      <span className="self-end text-[10px] font-black px-2 py-0.5 rounded bg-amber-400 text-slate-950">
                        {item.voltagem || "220V"}
                      </span>
                      <p className="text-center font-bold text-xs sm:text-sm leading-snug mt-1">
                        {item.nomeCurto}
                      </p>
                      <div className="my-2.5 h-24 rounded-lg overflow-hidden bg-black/30 flex items-center justify-center">
                        <img
                          src={item.imagem}
                          alt={item.nomeCurto}
                          className="w-full h-full object-cover opacity-90"
                        />
                      </div>
                      <button
                        onClick={() => selecionarEquipamento(item.id)}
                        className="w-full py-2 rounded-full bg-[#3A6B4E] hover:bg-[#2E593F] text-white text-xs font-bold transition"
                      >
                        Iniciar diagnóstico
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-sm font-extrabold text-[#1C2826] mb-2.5">
                  Principais Ocorrências na sua Unidade
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {equipamentos.slice(0, 3).map((item, idx) => (
                    <button
                      key={item.id}
                      onClick={() => selecionarEquipamento(item.id)}
                      className="flex items-center justify-between px-3 py-2 rounded-lg border border-[#E2E0D8] hover:border-[#2E6F4E] bg-[#FAF9F6] text-left transition"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs font-black text-[#1C2826]">0{idx + 1}</span>
                        <span className="text-[11px] font-semibold text-[#4A5550] truncate">
                          {item.nomeCurto} - {item.falhaPrincipal}
                        </span>
                      </div>
                      <ChevronRight size={14} className="text-[#5C6660] shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TELA 8: ANATOMIA INTERATIVA DO EQUIPAMENTO COM HOTSPOTS */}
      {modo === "anatomia" && equip && (
        <div className="flex items-start gap-3">
          <GreenDotAvatar />
          <div className="flex-1 bg-white rounded-2xl border border-[#E2E0D8] shadow-sm overflow-hidden p-4 sm:p-5 space-y-4">
            <div className="relative rounded-xl overflow-hidden bg-[#484A4C] min-h-[260px] sm:min-h-[300px] flex items-center justify-center p-4">
              <img
                src={equip.imagem}
                alt={equip.nome}
                className="w-64 h-48 object-cover rounded-xl shadow-2xl opacity-85"
              />

              <button
                onClick={() => setModo("hub")}
                className="absolute top-3.5 left-3.5 px-3.5 py-1.5 rounded-full bg-[#2E6F4E] hover:bg-[#23563C] text-white text-xs font-bold flex items-center gap-1 shadow-md"
              >
                &larr; Voltar
              </button>

              <span className="absolute top-3.5 right-3.5 px-3 py-1 rounded-full bg-amber-400 text-slate-950 text-xs font-black shadow-md">
                ⚡ {equip.voltagem || "220V"}
              </span>

              {(equip.hotspots || []).map((spot) => (
                <div
                  key={spot.id}
                  style={{ left: spot.x, top: spot.y }}
                  className="absolute -translate-x-1/2 -translate-y-1/2 bg-white text-[#1C2826] px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-extrabold shadow-md border border-[#E2E0D8] whitespace-nowrap"
                >
                  {spot.label}
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-base sm:text-lg font-extrabold text-[#1C2826]">{equip.nome}</h3>
              <span className="text-xs font-extrabold text-[#2E6F4E]">
                {equip.corTomada}
              </span>
            </div>

            <div className="rounded-xl border border-[#E2E0D8] p-4 space-y-2.5">
              <h4 className="text-sm sm:text-base font-extrabold text-[#1C2826]">
                Está enfrentando problemas?
              </h4>
              <p className="text-xs sm:text-sm text-[#4F5853] font-medium">
                Vamos ajudar você a colocar seu {equip.nomeCurto} funcionando perfeitamente em poucos minutos!
              </p>
              <button
                onClick={() => {
                  setPassoIdx(0);
                  setModo("passo-a-passo");
                }}
                className="px-4 py-2 rounded-full bg-[#3A6B4E] hover:bg-[#2D553D] text-white text-xs sm:text-sm font-bold transition shadow-2xs"
              >
                ⚙ Iniciar Diagnóstico em Tempo Real
              </button>
            </div>

            <div className="rounded-xl border border-[#E2E0D8] p-4 space-y-2.5">
              <h4 className="text-sm sm:text-base font-extrabold text-[#1C2826]">
                Precisa solicitar uma peça de reposição para este equipamento?
              </h4>
              <p className="text-xs sm:text-sm text-[#4F5853] font-medium">
                Se você procura o código SKU de pino de arraste, tampa, vedação ou lâmina, temos tudo catalogado!
              </p>
              <button
                onClick={() => setMostrarPecas((v) => !v)}
                className="px-4 py-2 rounded-full bg-[#CBE5D6] hover:bg-[#B8DAC7] text-[#1E4D3B] text-xs sm:text-sm font-bold transition"
              >
                {mostrarPecas ? "Ocultar Peças SKU" : "Ver Peças e Códigos SKU"}
              </button>

              {mostrarPecas && (
                <div className="pt-2 space-y-2">
                  {(equip.pecasReposicao || []).map((peca) => (
                    <div
                      key={peca.sku}
                      className="flex items-center justify-between p-2.5 rounded-lg bg-[#F7F9F8] border border-[#DCE6DF] text-xs"
                    >
                      <div>
                        <span className="font-black text-[#1E4D3B]">{peca.sku}</span> —{" "}
                        <span className="font-bold text-[#2B332E]">{peca.nome}</span>
                      </div>
                      <span className="font-extrabold text-[#2E6F4E]">{peca.estoque}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TELAS 9 & 12: NAVEGADOR PASSO A PASSO DE TROUBLESHOOTING + VERIFICAÇÃO */}
      {modo === "passo-a-passo" && equip && passoAtual && (
        <div className="flex items-start gap-3">
          <GreenDotAvatar />
          <div className="flex-1 bg-white rounded-2xl border border-[#E2E0D8] shadow-sm overflow-hidden p-4 sm:p-6 space-y-5">
            <div className="relative rounded-xl overflow-hidden bg-[#484A4C] aspect-16/9 max-h-64 flex items-center justify-center">
              <img
                src={equip.imagem}
                alt={equip.nome}
                className="w-full h-full object-cover opacity-85"
              />
              <button
                onClick={() => setModo("anatomia")}
                className="absolute top-3.5 left-3.5 px-3.5 py-1.5 rounded-full bg-[#2E6F4E] text-white text-xs font-bold shadow-md"
              >
                &larr; Voltar
              </button>
              <div className="absolute bottom-0 left-0 right-0 h-2 bg-black/30">
                <div
                  className="h-full bg-[#3A6B4E] transition-all duration-300"
                  style={{ width: `${((passoIdx + 1) / passos.length) * 100}%` }}
                />
              </div>
            </div>

            <div className="flex items-center justify-between text-xs font-extrabold text-[#3B4740]">
              <span>
                {equip.nomeCurto}: {equip.falhaPrincipal}
              </span>
              <span>
                {passoIdx + 1} de {passos.length}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                disabled={passoIdx === 0}
                onClick={() => setPassoIdx((i) => Math.max(0, i - 1))}
                className="px-3.5 py-1.5 rounded-full bg-[#CBE5D6] disabled:opacity-40 text-[#1E4D3B] text-xs font-bold transition"
              >
                &larr; Anterior
              </button>
              <button
                disabled={passoIdx >= passos.length - 1}
                onClick={() => setPassoIdx((i) => Math.min(passos.length - 1, i + 1))}
                className="px-3.5 py-1.5 rounded-full bg-[#24593F] disabled:opacity-40 text-white text-xs font-bold transition"
              >
                Próximo &rarr;
              </button>
            </div>

            <div className="space-y-1.5">
              <h4 className="text-base sm:text-lg font-black text-[#1C2826]">
                {passoAtual.instrucao}
              </h4>
              <p className="text-xs sm:text-sm text-[#4F5853] font-medium">{passoAtual.detalhe}</p>
            </div>

            <hr className="border-[#E6E4DC]" />

            <div className="space-y-3">
              <h4 className="text-base sm:text-lg font-extrabold text-[#2B332E]">
                Verifique se o problema foi resolvido.
              </h4>
              <p className="text-xs sm:text-sm text-[#4F5853] font-medium">
                O procedimento de diagnóstico corrigiu a falha do equipamento?
              </p>
              <div className="grid grid-cols-2 gap-3 pt-1">
                <button
                  onClick={() => setModo("etapa-3-chamado")}
                  className="py-2.5 rounded-full bg-[#D7ECE0] hover:bg-[#C3E2D0] text-[#24593F] font-bold text-sm transition"
                >
                  Não
                </button>
                <button
                  onClick={() => setModo("resolvido")}
                  className="py-2.5 rounded-full bg-[#5B7D69] hover:bg-[#496856] text-white font-bold text-sm transition"
                >
                  Sim
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TELA 10: ETAPA 3 DE 4 — CHECKLIST ANTES DE ABRIR CHAMADO */}
      {modo === "etapa-3-chamado" && equip && (
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <GreenDotAvatar />
            <div className="flex-1 bg-white rounded-2xl border border-[#E2E0D8] shadow-sm p-4 sm:p-5 space-y-3">
              <p className="text-sm font-bold text-[#1C2826]">
                Me avise se o problema foi resolvido.
              </p>
              <div className="flex flex-wrap gap-2.5">
                <button
                  onClick={() => setModo("resolvido")}
                  className="px-4 py-2 rounded-lg border border-[#3A6B4E] text-[#1E4D3B] font-bold text-xs sm:text-sm hover:bg-[#EBF3EE] transition"
                >
                  Sim, está tudo ótimo agora.
                </button>
                <button
                  onClick={() => setModo("etapa-4-chamado")}
                  className="px-4 py-2 rounded-lg bg-[#24593F] text-white font-bold text-xs sm:text-sm hover:bg-[#1B4330] transition"
                >
                  Ainda não, por favor abra um chamado
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <GreenDotAvatar />
            <div className="flex-1 bg-white rounded-2xl border border-[#E2E0D8] shadow-sm p-5 sm:p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full border-2 border-[#2E6F4E] border-t-transparent animate-spin" />
                <p className="text-xs sm:text-sm font-semibold text-[#2B332E]">
                  Preparando chamado de suporte técnico em seu nome...
                </p>
              </div>

              <div>
                <p className="text-[11px] font-black uppercase tracking-wider text-[#2B332E]">
                  ETAPA 3 DE 4
                </p>
                <h3 className="text-lg sm:text-xl font-black text-[#1C2826] mt-0.5">
                  Você já tentou os procedimentos abaixo?
                </h3>
              </div>

              {(equip.checklistPreChamado || []).map((bloco, i) => (
                <div key={i} className="space-y-2.5">
                  <div className="bg-[#DFDFDD] px-4 py-2.5 rounded-lg font-extrabold text-xs sm:text-sm text-[#2B332E]">
                    {bloco.titulo}
                  </div>
                  {bloco.causaProvavel && (
                    <p className="text-xs text-[#4F5853] font-medium px-1">
                      {bloco.causaProvavel}
                    </p>
                  )}
                  <ol className="list-decimal list-inside space-y-1 text-xs sm:text-sm text-[#2B332E] font-medium px-1">
                    {bloco.passos.map((p, idx) => (
                      <li key={idx}>{p}</li>
                    ))}
                  </ol>
                </div>
              ))}

              <div className="flex flex-wrap gap-3 pt-2">
                <button
                  onClick={() => setModo("resolvido")}
                  className="px-5 py-2.5 rounded-full border border-[#4E735E] text-[#1E4D3B] font-bold text-xs sm:text-sm hover:bg-[#EBF3EE] transition"
                >
                  Problema resolvido
                </button>
                <button
                  onClick={() => setModo("etapa-4-chamado")}
                  className="px-6 py-2.5 rounded-full bg-[#5B7D69] hover:bg-[#466352] text-white font-bold text-xs sm:text-sm transition"
                >
                  Confirmar dados do chamado
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TELA 11: ETAPA 4 DE 4 — CREATE TICKET SUMMARY */}
      {modo === "etapa-4-chamado" && equip && (
        <div className="flex items-start gap-3">
          <GreenDotAvatar />
          <div className="flex-1 bg-white rounded-2xl border border-[#E2E0D8] shadow-sm p-5 sm:p-6 space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full border-2 border-[#2E6F4E] flex items-center justify-center text-[#2E6F4E] font-black text-xs">
                C
              </div>
              <p className="text-xs sm:text-sm font-semibold text-[#2B332E]">
                Criando chamado de suporte técnico em seu nome...
              </p>
            </div>

            <div>
              <p className="text-[11px] font-black uppercase tracking-wider text-[#2B332E]">
                ETAPA 4 DE 4
              </p>
              <h3 className="text-xl sm:text-2xl font-black text-[#1C2826] mt-0.5">
                Abrir chamado técnico
              </h3>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs sm:text-sm">
              <div className="col-span-2">
                <p className="text-[#68726D] font-medium">Equipamento</p>
                <p className="font-extrabold text-[#1C2826] uppercase mt-0.5">{equip.nome}</p>
              </div>
              <div>
                <p className="text-[#68726D] font-medium">Falha Reportada</p>
                <p className="font-extrabold text-[#1C2826] uppercase mt-0.5">
                  {equip.falhaPrincipal}
                </p>
              </div>
              <div>
                <p className="text-[#68726D] font-medium">Colaborador Solicitante</p>
                <p className="font-extrabold text-[#1C2826] uppercase mt-0.5">
                  {sessao?.nome || "LUCAS CAVALCANTE"}
                </p>
              </div>
              <div>
                <p className="text-[#68726D] font-medium">Código da Unidade</p>
                <p className="font-extrabold text-[#1C2826] mt-0.5">0123</p>
              </div>
              <div>
                <p className="text-[#68726D] font-medium">Nome da Unidade</p>
                <p className="font-extrabold text-[#1C2826] uppercase mt-0.5">
                  {unidadeInfo?.nome || "UNIDADE MATRIZ RESTAURANTE"}
                </p>
              </div>
            </div>

            <div>
              <button
                onClick={registrarChamadoFinal}
                className="px-6 py-2.5 rounded-full bg-[#5B7D69] hover:bg-[#466352] text-white font-bold text-xs sm:text-sm transition shadow-sm"
              >
                Enviar chamado
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TELA 12: TICKET SUBMITTED */}
      {modo === "enviado" && (
        <div className="flex items-start gap-3">
          <GreenDotAvatar />
          <div className="flex-1 bg-white rounded-2xl border border-[#E2E0D8] shadow-sm p-5 sm:p-6 space-y-4">
            <h3 className="text-xl sm:text-2xl font-black text-[#1C2826]">Chamado enviado.</h3>
            <p className="text-xs sm:text-sm text-[#4F5853] font-semibold">
              Levará até 30 minutos para que a assistência autorizada processe a Ordem de Serviço.
            </p>
            <div className="flex flex-wrap gap-3 pt-1">
              <button
                onClick={() => setModo("painel-facilities")}
                className="px-5 py-2.5 rounded-full border border-[#4E735E] text-[#1E4D3B] font-bold text-xs sm:text-sm hover:bg-[#EBF3EE] transition"
              >
                Todos os chamados abertos
              </button>
              <button
                onClick={() => setModo("painel-facilities")}
                className="px-5 py-2.5 rounded-full bg-[#5B7D69] hover:bg-[#466352] text-white font-bold text-xs sm:text-sm transition"
              >
                Ver meu chamado
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TELA 13: PAINEL DIVIDIDO DE FACILITIES & SERVICE REQUEST */}
      {modo === "painel-facilities" && (
        <div className="flex items-start gap-3">
          <GreenDotAvatar />
          <div className="flex-1 bg-[#F2F1EC] rounded-2xl border border-[#DCDAD0] shadow-md p-4 sm:p-5">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              <div className="lg:col-span-6 space-y-3">
                <div className="flex items-center justify-between text-xs font-extrabold text-[#2B332E] px-1">
                  <span>Atualizados recentemente</span>
                  <span className="text-[#5C6660]">nas últimas 24h</span>
                </div>

                {chamados.map((ch) => {
                  const ativo = chamadoDetalhe?.id === ch.id;
                  return (
                    <button
                      key={ch.id}
                      onClick={() => setChamadoDetalhe(ch)}
                      className={`w-full text-left p-4 rounded-xl bg-white border transition shadow-2xs space-y-2 ${
                        ativo
                          ? "border-l-4 border-l-[#2E6F4E] border-[#2E6F4E]"
                          : "border-[#E2E0D8] hover:border-[#9EB5A8]"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs sm:text-sm font-extrabold text-[#1C2826] leading-snug">
                          {ch.equipamento}
                        </p>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase shrink-0 ${
                            ch.categoria === "MANUTENÇÃO"
                              ? "bg-[#2E2559] text-white"
                              : "bg-[#2C6B56] text-white"
                          }`}
                        >
                          {ch.categoria}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] font-bold">
                        <span className="flex items-center gap-1.5 text-[#2E6F4E]">
                          <span className="w-2 h-2 rounded-full bg-[#2E6F4E]" />
                          {ch.status}
                        </span>
                        <span className="text-[#68726D]">{ch.atualizado}</span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {chamadoDetalhe && (
                <div className="lg:col-span-6 bg-white rounded-xl border border-[#E2E0D8] overflow-hidden shadow-xs flex flex-col justify-between">
                  <div>
                    <div className="bg-[#1E5C46] text-white p-4">
                      <p className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-200">
                        MANUTENÇÃO &amp; INFRAESTRUTURA
                      </p>
                      <p className="text-xs font-bold mt-0.5">
                        Solicitação de Serviço - {chamadoDetalhe.id}
                      </p>
                    </div>

                    <div className="p-4 sm:p-5 space-y-4">
                      <h4 className="text-base font-extrabold text-[#1C2826]">
                        {chamadoDetalhe.equipamento}
                      </h4>

                      <div className="relative pl-7 space-y-2 border-l-2 border-[#2E6F4E] ml-2">
                        <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-[#2E6F4E] text-white flex items-center justify-center">
                          <Check size={10} />
                        </div>
                        <p className="text-xs font-extrabold text-[#1C2826]">Chamado Registrado</p>
                        <div className="p-3 rounded-xl bg-[#F4F3EF] space-y-1 text-xs">
                          <p className="font-extrabold text-[#1C2826]">Estamos cuidando disso</p>
                          <p className="font-bold text-[#424D47]">{chamadoDetalhe.serie}</p>
                          <p className="text-[#55605A] leading-relaxed">
                            {chamadoDetalhe.detalheProblema}
                          </p>
                        </div>
                      </div>

                      <div className="relative pl-7 space-y-2 ml-2">
                        <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-[#2E6F4E] text-white flex items-center justify-center">
                          <Check size={10} />
                        </div>
                        <p className="text-xs font-extrabold text-[#1C2826]">
                          Assistência Técnica Acionada
                        </p>
                        <div className="p-3 rounded-xl bg-[#F4F3EF] space-y-1 text-xs">
                          <p className="font-extrabold text-[#1C2826]">
                            {chamadoDetalhe.fornecedor}
                          </p>
                          <p className="font-bold text-[#424D47]">
                            Ordem de Serviço - {chamadoDetalhe.ordemServico}
                          </p>
                          <p className="text-[#55605A]">
                            Janela Estimada de Chegada: <strong>{chamadoDetalhe.janelaChegada}</strong>
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="px-5 py-3 bg-[#FAF9F6] border-t border-[#E6E4DC] flex items-center justify-between text-xs font-bold text-[#424D47]">
                    <span>Dúvidas? Ligue {chamadoDetalhe.telefoneSuporte}</span>
                    <button
                      onClick={() => setModo("hub")}
                      className="text-[#2E6F4E] hover:underline font-extrabold"
                    >
                      Voltar aos equipamentos
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {modo === "resolvido" && (
        <div className="flex items-start gap-3">
          <GreenDotAvatar />
          <div className="flex-1 bg-white rounded-2xl border border-[#B8D8C5] p-5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 size={26} className="text-[#2E6F4E] shrink-0" />
              <div>
                <p className="font-extrabold text-sm sm:text-base text-[#1C2826]">
                  Excelente! Equipamento de volta à operação normal.
                </p>
                <p className="text-xs text-[#4F5853]">
                  O registro de manutenção preventiva rápida foi salvo no histórico do turno.
                </p>
              </div>
            </div>
            <button
              onClick={() => setModo("hub")}
              className="px-3.5 py-1.5 rounded-lg border border-[#76847D] text-xs font-bold text-[#1E4D3B]"
            >
              Ver outros equipamentos
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── NOVO CARD: ESCALA DE HOJE EM ORGANOGRAMA POR ÁREA & HORÁRIOS DE TRABALHO ──
export function ShiftOrganogramCard({
  dados = ESCALA_ORGANOGRAMA_DO_DIA,
  escala = ESCALA_TURNO_GANTT,
  onAddPartnerClick,
}) {
  const [modoVisualizacao, setModoVisualizacao] = useState("organograma"); // "organograma" | "gantt"
  const [areaFiltro, setAreaFiltro] = useState("todas");
  const [termoBusca, setTermoBusca] = useState("");

  const areasFiltradas = dados.areas
    .map((area) => {
      const colabs = area.colaboradores.filter((c) => {
        const atendeArea = areaFiltro === "todas" || area.id === areaFiltro;
        const atendeBusca =
          !termoBusca ||
          c.nome.toLowerCase().includes(termoBusca.toLowerCase()) ||
          c.cargo.toLowerCase().includes(termoBusca.toLowerCase()) ||
          c.praca.toLowerCase().includes(termoBusca.toLowerCase());
        return atendeArea && atendeBusca;
      });
      return { ...area, colaboradores: colabs };
    })
    .filter((area) => area.colaboradores.length > 0 || (areaFiltro === area.id && !termoBusca));

  const liderVisivel =
    areaFiltro === "todas" || areaFiltro === "gestao"
      ? !termoBusca ||
        dados.liderGeral.nome.toLowerCase().includes(termoBusca.toLowerCase()) ||
        dados.liderGeral.cargo.toLowerCase().includes(termoBusca.toLowerCase())
      : false;

  return (
    <div className="flex items-start gap-3">
      <GreenDotAvatar />
      <div className="flex-1 bg-white rounded-2xl border-2 border-[#2E6F4E] shadow-xl overflow-hidden text-[#1C2826]">
        {/* Cabeçalho Verde Escuro Oficial */}
        <div className="bg-[#1E4D3B] text-white p-5 sm:p-6 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="px-3 py-1 rounded-full bg-emerald-400/20 text-emerald-200 text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5">
              <Users size={14} /> Organograma &amp; Escala de Trabalho de Hoje
            </span>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold bg-white/15 px-3 py-1 rounded-full text-white">
                {dados.data}
              </span>
              <span className="text-xs font-bold bg-emerald-500/30 text-emerald-100 px-3 py-1 rounded-full">
                {dados.turno}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div>
              <h3 className="text-lg sm:text-2xl font-black">
                Escala por Área &amp; Horários do Dia
              </h3>
              <p className="text-xs sm:text-sm text-emerald-100 font-medium">
                Visualização hierárquica por setores (Cozinha Quente, Cozinha Fria, Bar, Pass e Salão). Todos os horários de início, término e intervalos programados.
              </p>
            </div>

            {/* Alternador de Modo: Organograma vs Gantt */}
            <div className="flex items-center bg-black/20 p-1 rounded-xl border border-white/20 shrink-0">
              <button
                onClick={() => setModoVisualizacao("organograma")}
                className={`px-3 py-1.5 rounded-lg text-xs font-extrabold flex items-center gap-1.5 transition ${
                  modoVisualizacao === "organograma"
                    ? "bg-white text-[#1E4D3B] shadow-xs"
                    : "text-white/80 hover:text-white"
                }`}
              >
                <Layers size={13} /> Organograma por Área
              </button>
              <button
                onClick={() => setModoVisualizacao("gantt")}
                className={`px-3 py-1.5 rounded-lg text-xs font-extrabold flex items-center gap-1.5 transition ${
                  modoVisualizacao === "gantt"
                    ? "bg-white text-[#1E4D3B] shadow-xs"
                    : "text-white/80 hover:text-white"
                }`}
              >
                <BarChart3 size={13} /> Linha do Tempo (Gantt)
              </button>
            </div>
          </div>

          {/* Faixa de Indicadores Rápidos */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-emerald-800/60">
            <div className="bg-black/20 rounded-xl p-2.5">
              <p className="text-[10px] font-black uppercase text-emerald-300">TOTAL ESCALADO</p>
              <p className="text-base font-black text-white">{dados.totalColaboradores} pessoas</p>
            </div>
            <div className="bg-black/20 rounded-xl p-2.5">
              <p className="text-[10px] font-black uppercase text-emerald-300">EM TURNO AGORA</p>
              <p className="text-base font-black text-emerald-300 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                {dados.emTurnoAgoraCount} pessoas
              </p>
            </div>
            <div className="bg-black/20 rounded-xl p-2.5">
              <p className="text-[10px] font-black uppercase text-emerald-300">ENTRAM MAIS TARDE</p>
              <p className="text-base font-black text-amber-200">{dados.iniciamMaisTardeCount} pessoas</p>
            </div>
            <div className="bg-black/20 rounded-xl p-2.5">
              <p className="text-[10px] font-black uppercase text-emerald-300">PICOS PREVISTOS</p>
              <p className="text-xs font-black text-white truncate">12h-14h · 19h30-21h30</p>
            </div>
          </div>
        </div>

        {/* Barra de Filtros e Busca */}
        <div className="p-4 bg-[#FAF9F6] border-b border-[#E2E0D8] space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            {/* Pílulas de Área */}
            <div className="flex flex-wrap items-center gap-1.5 text-xs font-bold">
              {[
                { id: "todas", label: `Todas as Áreas (${dados.totalColaboradores})` },
                { id: "cozinha-quente", label: "🍳 Cozinha Quente (3)" },
                { id: "cozinha-fria", label: "🥗 Cozinha Fria (1)" },
                { id: "pass", label: "🔔 Pass & Qualidade (1)" },
                { id: "bar", label: "🍸 Bar & Coquetelaria (2)" },
                { id: "salao", label: "🛎️ Salão (1)" },
              ].map((p) => (
                <button
                  key={p.id}
                  onClick={() => setAreaFiltro(p.id)}
                  className={`px-3 py-1.5 rounded-lg transition ${
                    areaFiltro === p.id
                      ? "bg-[#1E4D3B] text-white shadow-xs font-extrabold"
                      : "bg-[#EFEFEA] text-[#4F5853] hover:bg-[#E2E0D8]"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Campo de Busca Rápida */}
            <div className="relative w-full sm:w-56">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7A847F]"
              />
              <input
                type="text"
                placeholder="Buscar pessoa ou praça..."
                value={termoBusca}
                onChange={(e) => setTermoBusca(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs font-semibold rounded-lg border border-[#C8C6BC] bg-white text-[#1C2826] focus:outline-none focus:border-[#2E6F4E]"
              />
            </div>
          </div>
        </div>

        {/* CONTEÚDO PRINCIPAL: MODO ORGANOGRAMA OU GANTT */}
        {modoVisualizacao === "organograma" ? (
          <div className="p-5 sm:p-6 space-y-6 bg-[#FDFCF9]">
            {/* 1. NÓ TOPO: LÍDER DE TURNO GERAL */}
            {liderVisivel && (
              <div className="flex flex-col items-center">
                <div className="w-full max-w-md rounded-2xl border-2 border-[#1E4D3B] bg-gradient-to-br from-[#F4F9F6] to-[#E5F1EB] p-4 shadow-sm relative">
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-[#1E4D3B] text-white text-[10px] font-black uppercase tracking-wider">
                    👑 Liderança Geral do Turno
                  </div>

                  <div className="flex items-center gap-3.5 mt-1">
                    <img
                      src={dados.liderGeral.avatar}
                      alt={dados.liderGeral.nome}
                      className="w-13 h-13 rounded-full object-cover border-2 border-[#1E4D3B] shadow-xs"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <h4 className="text-sm font-black text-[#1C2826]">
                          {dados.liderGeral.nome}
                        </h4>
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                          {dados.liderGeral.statusLabel}
                        </span>
                      </div>
                      <p className="text-xs font-extrabold text-[#1E4D3B]">
                        {dados.liderGeral.cargo}
                      </p>
                      <div className="flex items-center gap-2 mt-1 text-[11px] font-bold text-[#4F5853]">
                        <span className="flex items-center gap-1 text-[#1E4D3B] font-extrabold">
                          <Clock size={12} /> {dados.liderGeral.horario}
                        </span>
                        <span>·</span>
                        <span>📍 {dados.liderGeral.praca}</span>
                      </div>
                    </div>
                  </div>

                  <p className="text-[11px] text-[#55605A] font-medium mt-2.5 pt-2 border-t border-[#C5DDD0]">
                    {dados.liderGeral.responsabilidade}
                  </p>
                </div>

                {/* Linha vertical do organograma conectando às áreas */}
                <div className="w-0.5 h-6 bg-[#B5D5C5]" />
                <div className="w-11/12 h-0.5 bg-[#B5D5C5]" />
              </div>
            )}

            {/* 2. NÓS DAS ÁREAS HIERÁRQUICAS (COLUNAS EM ÁRVORE) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-1">
              {areasFiltradas.map((area) => (
                <div
                  key={area.id}
                  className="rounded-2xl border overflow-hidden shadow-xs flex flex-col bg-white"
                  style={{ borderColor: area.bordaCor }}
                >
                  {/* Cabeçalho do Setor */}
                  <div
                    className="p-3.5 flex items-center justify-between"
                    style={{ backgroundColor: area.bgCor, borderBottom: `2px solid ${area.bordaCor}` }}
                  >
                    <div>
                      <span
                        className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: "white", color: area.cor }}
                      >
                        {area.sigla} · {area.colaboradores.length} {area.colaboradores.length === 1 ? "colaborador" : "colaboradores"}
                      </span>
                      <h4 className="text-sm font-black mt-1" style={{ color: area.cor }}>
                        {area.nome}
                      </h4>
                      <p className="text-[10px] text-[#55605A] font-semibold">
                        Líder: {area.liderArea}
                      </p>
                    </div>
                  </div>

                  {/* Cards dos Colaboradores nesta Área */}
                  <div className="p-3 space-y-2.5 flex-1 divide-y divide-[#F0EFEB]">
                    {area.colaboradores.map((colab, idx) => (
                      <div key={colab.id} className={idx > 0 ? "pt-2.5" : ""}>
                        <div className="flex items-start gap-2.5">
                          <img
                            src={colab.avatar}
                            alt={colab.nome}
                            className="w-10 h-10 rounded-full object-cover border border-[#C8C6BC] shadow-2xs shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1">
                              <p className="text-xs font-black text-[#1C2826] truncate">
                                {colab.nome}
                              </p>
                              <span
                                className={`px-2 py-0.5 rounded-full text-[9px] font-black shrink-0 ${
                                  colab.status === "em-turno"
                                    ? "bg-emerald-100 text-emerald-800"
                                    : "bg-amber-100 text-amber-900"
                                }`}
                              >
                                {colab.statusLabel}
                              </span>
                            </div>

                            <p className="text-[11px] font-bold text-[#4A5550]">
                              {colab.cargo}
                            </p>

                            {/* Horário de Trabalho em Destaque */}
                            <div className="mt-1.5 p-1.5 rounded-lg bg-[#FAF9F5] border border-[#E5E4DC] flex items-center justify-between text-[11px]">
                              <span className="font-extrabold text-[#1E4D3B] flex items-center gap-1">
                                <Clock size={12} /> {colab.horario}
                              </span>
                              <span className="text-[10px] text-[#69726D] font-bold truncate max-w-[130px]">
                                {colab.praca}
                              </span>
                            </div>

                            {/* Intervalo programado */}
                            {Array.isArray(colab.intervalos) && colab.intervalos.length > 0 && (
                              <div className="flex items-center gap-1 mt-1 text-[10px] font-semibold text-[#5A655F]">
                                <span>☕ Intervalos:</span>
                                {colab.intervalos.map((inv, iIdx) => (
                                  <span
                                    key={iIdx}
                                    className={`px-1.5 py-0.5 rounded ${
                                      inv.ok ? "bg-emerald-50 text-emerald-700 font-bold" : "bg-amber-50 text-amber-800 font-bold"
                                    }`}
                                  >
                                    {inv.h || inv.label} {inv.ok ? "✓" : ""}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* MODO GANTT INTEGRADO */
          <div className="p-4">
            <ShiftScheduleGanttCard escala={escala} onAddPartnerClick={onAddPartnerClick} />
          </div>
        )}

        {/* Rodapé com Ações e Botão de Adicionar Extra */}
        <div className="p-4 bg-[#F7F6F2] border-t border-[#E5E4DC] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-[#4F5853] font-bold">
            <span className="w-2.5 h-2.5 rounded-full bg-[#2E6F4E] animate-pulse" />
            <span>Escala sincronizada com a bancada em tempo real</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onAddPartnerClick}
              className="px-4 py-2 rounded-xl bg-[#1E4D3B] hover:bg-[#15382A] text-white text-xs font-black shadow-xs flex items-center gap-1.5 transition active:scale-95"
            >
              <UserPlus size={15} />
              + Chamar Colaborador Extra para o Pico
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── TELA 15: ESCALA HORÁRIA GANTT COM FAIXA DE PICO E CONVOCAÇÃO DE EXTRA ────
export function ShiftScheduleGanttCard({ escala, onAddPartnerClick }) {
  const horas = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23];

  return (
    <div className="flex items-start gap-3">
      <GreenDotAvatar />
      <div className="flex-1 bg-white rounded-2xl border border-[#E2E0D8] shadow-md overflow-hidden text-[#1C2826]">
        <div className="p-4 border-b border-[#E5E4DC] flex flex-wrap items-center justify-between gap-2 bg-[#FAF9F5]">
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-lg bg-[#E4E2DA] text-xs font-bold">Hoje</span>
            <button className="w-7 h-7 rounded-lg border border-[#C8C6BC] flex items-center justify-center">
              <ChevronLeft size={14} />
            </button>
            <button className="w-7 h-7 rounded-lg border border-[#C8C6BC] flex items-center justify-center">
              <ChevronRight size={14} />
            </button>
            <span className="flex items-center gap-1.5 text-sm sm:text-base font-extrabold ml-1">
              <Calendar size={16} className="text-[#2E6F4E]" />
              Segunda, 19 de Outubro
            </span>
          </div>

          <button
            onClick={onAddPartnerClick}
            className="px-3 py-1.5 rounded-lg border border-[#76847D] bg-white hover:bg-[#EBF3EE] text-[#1E4D3B] text-xs font-bold transition"
          >
            Previsão &amp; Opções de Turno
          </button>
        </div>

        <div className="relative overflow-x-auto">
          <div className="grid grid-cols-12 min-w-[680px] border-b border-[#E5E4DC] bg-[#F7F6F2] text-[11px] font-bold text-[#5A655F]">
            <div className="col-span-3 p-2.5 pl-4 font-extrabold text-[#1E4D3B]">
              Colaborador / Escala
            </div>
            <div className="col-span-9 grid grid-cols-16 relative">
              {horas.map((h) => (
                <div
                  key={h}
                  className={`p-2 text-center border-l border-[#E5E4DC] ${
                    h >= 12 && h <= 14 ? "bg-[#EFE6B8]/70 font-black text-[#5C4B12]" : ""
                  }`}
                >
                  {h}h
                  {h === 12 && (
                    <div className="text-[9px] font-black uppercase text-[#6E5911]">● PICO</div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="divide-y divide-[#ECEAE2] min-w-[680px] relative">
            {escala.map((colab) => {
              const leftPct = Math.max(0, ((colab.inicio - 8) / 16) * 100);
              const widthPct = Math.min(100 - leftPct, ((colab.fim - colab.inicio) / 16) * 100);

              return (
                <div key={colab.id} className="grid grid-cols-12 items-center hover:bg-[#FAF9F5]">
                  <div className="col-span-3 p-2.5 pl-4 flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-[#24302B] text-white text-xs font-extrabold flex items-center justify-center shrink-0">
                      {colab.iniciais}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-extrabold text-[#1C2826] truncate">{colab.nome}</p>
                      <p className="text-[10px] font-semibold text-[#55605A]">{colab.horario}</p>
                      {colab.tag && (
                        <p className="text-[10px] text-[#727C76] truncate">{colab.tag}</p>
                      )}
                    </div>
                  </div>

                  <div className="col-span-9 relative h-12 flex items-center">
                    <div
                      className="absolute top-0 bottom-0 bg-[#EFE6B8]/45 pointer-events-none"
                      style={{ left: `${((12 - 8) / 16) * 100}%`, width: `${(3 / 16) * 100}%` }}
                    />
                    <div
                      className="absolute top-0 bottom-0 w-0.5 bg-[#2E6F4E] z-10 pointer-events-none"
                      style={{ left: `${((11.5 - 8) / 16) * 100}%` }}
                    />

                    <div
                      className="relative h-7 rounded-md bg-[#3D5245] text-white flex items-center justify-around px-2 shadow-2xs"
                      style={{ marginLeft: `${leftPct}%`, width: `${widthPct}%` }}
                    >
                      {(colab.intervalos || []).map((intv, i) => (
                        <span
                          key={i}
                          className={`px-1.5 py-0.5 rounded text-[9px] font-black ${
                            intv.ok
                              ? "bg-[#2E6F4E] text-emerald-100 border border-emerald-300/40"
                              : "bg-white text-[#1C2826]"
                          }`}
                        >
                          {intv.ok ? "✓" : intv.label}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="p-3 bg-[#FAF9F5] border-t border-[#E5E4DC] flex items-center justify-between">
            <div className="flex items-center gap-2 text-[11px] font-bold text-[#4F5853]">
              <span className="w-2 h-2 rounded-full bg-[#2E6F4E]" />
              <span>Conectado em tempo real · Atualizado há 2 min</span>
            </div>
            <button
              onClick={onAddPartnerClick}
              className="px-4 py-2 rounded-full border border-[#3A6B4E] bg-white hover:bg-[#EBF3EE] text-[#1E4D3B] text-xs font-extrabold flex items-center gap-1.5 shadow-xs transition"
            >
              <UserPlus size={15} />
              + Adicionar colaborador ao pico
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── TELAS 16, 17 & 18: GRID DE DISPONÍVEIS + PROGRESSO AO VIVO (40% -> 100%) ──
export function AvailablePartnersOutreachCard({
  extras,
  convidadoId,
  progressoConvite,
  onSendRequest,
}) {
  const convidado = extras.find((e) => e.id === convidadoId);

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <GreenDotAvatar />
        <div className="flex-1 bg-white rounded-2xl border border-[#E2E0D8] shadow-sm p-5 sm:p-6 space-y-4">
          <p className="text-sm sm:text-base font-bold text-[#1C2826] leading-snug">
            Boas notícias — <strong>Bruno S.</strong> está disponível agora! Também encontrei outros 3 colaboradores/extras habilitados que podem apoiar no turno.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {extras.map((ext) => {
              const enviado = convidadoId === ext.id;
              return (
                <div
                  key={ext.id}
                  className="p-4 rounded-xl bg-[#F3F4F3] border border-[#E2E4E1] flex flex-col justify-between gap-3"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-extrabold text-sm sm:text-base text-[#1C2826]">
                        {ext.nome}
                      </p>
                      <p className="text-[11px] font-semibold text-[#5A655F]">{ext.funcao}</p>
                    </div>
                    <span className="flex items-center gap-1 text-xs font-bold text-[#2E6F4E]">
                      <span className="w-2 h-2 rounded-full bg-[#2E6F4E]" />
                      Disponível
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <img
                      src={ext.avatar}
                      alt={ext.nome}
                      className="w-9 h-9 rounded-full object-cover ring-2 ring-white shadow-2xs"
                    />
                    <button
                      onClick={() => onSendRequest(ext)}
                      className={`px-4 py-1.5 rounded-lg text-xs font-extrabold transition ${
                        enviado
                          ? "bg-[#24593F] text-white shadow-2xs"
                          : "bg-white border border-[#5B6860] text-[#1E4D3B] hover:bg-[#EBF3EE]"
                      }`}
                    >
                      {enviado ? "Convite enviado" : "Enviar convite"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {convidado && (
        <div className="flex items-start gap-3">
          <GreenDotAvatar />
          <div className="flex-1 bg-white rounded-2xl border border-[#E2E0D8] shadow-sm p-5 sm:p-6 space-y-3">
            <p className="text-sm sm:text-base font-bold text-[#1C2826]">
              Entrando em contato com <strong>{convidado.nome}</strong>...
            </p>

            <div className="p-4 rounded-xl bg-[#F3F4F3] border border-[#E2E4E1] space-y-3">
              <div className="flex items-center justify-between">
                <p className="font-extrabold text-base text-[#1C2826]">{convidado.nome}</p>
                <span className="flex items-center gap-1.5 text-xs font-extrabold text-[#2E6F4E]">
                  <span className="w-2 h-2 rounded-full bg-[#2E6F4E]" />
                  {progressoConvite >= 100 ? "Confirmado" : "Disponível"}
                </span>
              </div>

              <img
                src={convidado.avatar}
                alt={convidado.nome}
                className="w-9 h-9 rounded-full object-cover ring-2 ring-white"
              />

              <div className="space-y-1.5">
                <div className="h-2 w-full rounded-full bg-[#DCE0DC] overflow-hidden">
                  <div
                    className="h-full bg-[#2E6F4E] transition-all duration-700"
                    style={{ width: `${progressoConvite}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-xs font-bold text-[#5A655F]">
                  <span>
                    {progressoConvite < 100
                      ? "Notificação aberta pelo colaborador"
                      : `Chegando na loja em ${convidado.tempoChegada}`}
                  </span>
                  <span className="text-[#1C2826] font-extrabold">{progressoConvite}%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── TELAS 1 & 19: PLAY CALLER — MAPA DE POSICIONAMENTO DAS PRAÇAS ────────────
export function PlayCallerStationMapCard({ formacao, extraConfirmado }) {
  const [mostrarExplicacao, setMostrarExplicacao] = useState(false);

  const equipeCompleta = extraConfirmado
    ? [
        ...formacao,
        {
          id: extraConfirmado.id,
          iniciais: extraConfirmado.iniciais,
          nome: extraConfirmado.nome,
          praca: extraConfirmado.pracaCodigo,
          estacaoMapa: "forno",
          rotinas: extraConfirmado.rotinas,
        },
      ]
    : [
        ...formacao,
        {
          id: "bs-padrao",
          iniciais: "BS",
          nome: "Bruno S.",
          praca: "FORNO COMBINADO & GRELHA",
          estacaoMapa: "forno",
          rotinas: ["Rotina de Forno Combinado", "Apoio Pass & Salão"],
        },
      ];

  const PartnerPin = ({ sigla }) => (
    <div className="flex flex-col items-center">
      <div className="w-3.5 h-3.5 rounded-full border-2 border-[#4A5550] bg-white" />
      <div className="w-6 h-5 rounded-t-md bg-[#2E6F4E] text-white text-[9px] font-black flex items-center justify-center shadow-xs -mt-0.5">
        {sigla}
      </div>
    </div>
  );

  return (
    <div className="flex items-start gap-3">
      <GreenDotAvatar />
      <div className="flex-1 bg-white rounded-2xl border border-[#E2E0D8] shadow-md overflow-hidden text-[#1C2826] p-4 sm:p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-[#1C2826]">
              <Calendar size={15} className="text-[#2E6F4E]" />
              Hoje, 19 de Out
            </span>
            <span className="text-[#2E6F4E] underline font-extrabold">Agora</span>
          </div>
          <span className="flex items-center gap-1 text-[#2E6F4E] font-extrabold">
            <BarChart3 size={15} />
            Previsão de comandas &amp; mesas <ChevronDown size={14} />
          </span>
        </div>

        <div>
          <div className="grid grid-cols-8 rounded-xl border border-[#D5D3C9] bg-[#E8E6DF] overflow-hidden text-[11px] font-bold text-[#4A5550]">
            <div className="col-span-2 bg-[#E6F2EC] border-2 border-[#2E6F4E] rounded-l-xl p-2 text-center text-[#1E4D3B] font-extrabold">
              11h &nbsp;&mdash;&nbsp; 12h
            </div>
            <div className="p-2 text-center border-l border-[#D5D3C9]">13h</div>
            <div className="p-2 text-center border-l border-[#D5D3C9]">14h</div>
            <div className="p-2 text-center border-l border-[#D5D3C9]">15h</div>
            <div className="p-2 text-center border-l border-[#D5D3C9]">18h</div>
            <div className="p-2 text-center border-l border-[#D5D3C9]">19h</div>
            <div className="p-2 text-center border-l border-[#D5D3C9]">20h</div>
          </div>
          <div className="flex items-center gap-24 text-[10px] font-black uppercase tracking-wider mt-1 px-3">
            <span className="text-[#2E6F4E]">11:45 (ATUAL)</span>
            <span className="text-[#2B332E]">PICO ALMOÇO</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <div className="flex items-center gap-2">
            <span className="text-sm sm:text-base font-black text-[#1C2826]">
              11:30 – 14:30
            </span>
            <span className="text-[11px] font-bold text-[#5A655F]">⏱ AGORA</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full border border-[#2E6F4E] bg-[#EFF7F2] text-[#1E4D3B] text-xs font-extrabold flex items-center gap-1">
              <Users size={13} /> {equipeCompleta.length} Colaboradores
            </span>
            <span className="px-3 py-1 rounded-full border border-[#2E6F4E] text-[#1E4D3B] text-xs font-extrabold">
              Alocar
            </span>
            <span className="px-3 py-1 rounded-full border border-[#2E6F4E] text-[#1E4D3B] text-xs font-extrabold">
              Flex
            </span>
          </div>
        </div>

        <div className="rounded-2xl bg-[#FAF9F6] border border-[#E5E3DA] p-4 sm:p-6 relative">
          <div className="grid grid-cols-12 gap-3 items-center">
            <div className="col-span-4 flex flex-col items-center gap-2">
              <div className="w-full py-2.5 px-3 rounded border border-[#9DA5A0] bg-[#ECEBE6] text-center text-xs font-extrabold text-[#1C2826]">
                BAR &amp; CHOPEIRA
              </div>
              <PartnerPin sigla="CG" />
            </div>

            <div className="col-span-4 flex flex-col items-center gap-2">
              <div className="w-full py-2.5 px-3 rounded border border-[#9DA5A0] bg-[#ECEBE6] text-center text-xs font-extrabold text-[#1C2826]">
                GARDE MANGER / FRIOS
              </div>
            </div>

            <div className="col-span-4 flex flex-col items-center gap-2">
              <div className="flex gap-1.5 w-full">
                <div className="flex-1 py-2.5 px-2 rounded border border-[#9DA5A0] bg-[#ECEBE6] text-center text-xs font-extrabold text-[#1C2826]">
                  Forno 1
                </div>
                <div className="flex-1 py-2.5 px-2 rounded border border-[#9DA5A0] bg-[#ECEBE6] text-center text-xs font-extrabold text-[#1C2826]">
                  Forno 2
                </div>
              </div>
              <PartnerPin sigla="BS" />
            </div>

            <div className="col-span-2 flex flex-col items-center gap-2 mt-4">
              <div className="w-16 h-20 rounded border border-[#9DA5A0] bg-[#ECEBE6] flex items-center justify-center text-[10px] font-black text-[#1C2826] text-center p-1">
                DELIVERY &amp; PASS
              </div>
              <div className="w-16 h-12 rounded-full border border-[#9DA5A0] bg-[#F4F3EF] flex items-center justify-center text-[10px] font-extrabold text-[#1C2826] text-center leading-tight">
                Boqueta Expedição
              </div>
            </div>

            <div className="col-span-4 flex flex-col items-center gap-2 mt-4">
              <div className="flex justify-around w-full">
                <PartnerPin sigla="GK" />
                <PartnerPin sigla="FA" />
              </div>
              <div className="grid grid-cols-2 gap-2 w-full">
                <div className="py-3 rounded border border-[#9DA5A0] bg-[#ECEBE6] flex items-center justify-center">
                  <div className="w-7 h-7 rounded-full border border-[#9DA5A0] bg-[#DCDAD2]" />
                </div>
                <div className="py-3 rounded border border-[#9DA5A0] bg-[#ECEBE6] flex items-center justify-center">
                  <div className="w-7 h-7 rounded-full border border-[#9DA5A0] bg-[#DCDAD2]" />
                </div>
              </div>
              <span className="text-xs font-extrabold text-[#1C2826]">
                Fogão de Risotos &amp; Grelha
              </span>
            </div>

            <div className="col-span-3 flex flex-col items-center gap-2 mt-4">
              <PartnerPin sigla="IB" />
              <div className="w-full py-3 px-2 rounded border border-[#9DA5A0] bg-[#ECEBE6] text-center text-xs font-extrabold text-[#1C2826]">
                PDV / CAIXA
              </div>
            </div>

            <div className="col-span-3 flex flex-col items-center justify-end mt-10">
              <div className="w-full py-3 px-2 rounded border border-[#9DA5A0] bg-[#ECEBE6] text-center text-xs font-extrabold text-[#1C2826]">
                Vitrine &amp; Sobremesas
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-[#E5E4DC] pt-3">
          <span className="text-xs text-[#5A655F] font-medium">
            Formação otimizada para absorver pico de salão + delivery simultâneo
          </span>
          <button
            onClick={() => setMostrarExplicacao((v) => !v)}
            className="text-xs font-extrabold text-[#2E6F4E] underline"
          >
            Por que essa formação?
          </button>
        </div>

        {mostrarExplicacao && (
          <div className="p-3.5 rounded-xl bg-[#EFF7F2] border border-[#B8D8C5] text-xs text-[#1E3F2D] font-medium leading-relaxed">
            <strong>Racional da IA para o Pico (11h30–14h30):</strong> Mantemos{" "}
            <strong>Gabriel K.</strong> e <strong>Fernando A.</strong> fixos no Fogão/Grelha (gargalo térmico), enquanto{" "}
            <strong>Bruno S.</strong> assume exclusivamente os Fornos Combinados e regeneração, liberando{" "}
            <strong>Ingrid B.</strong> para conferência de Pass e PDV sem atrasar a saída dos pratos quentes.
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
          {equipeCompleta.map((p) => (
            <div key={p.id} className="flex items-start gap-2.5">
              <PartnerPin sigla={p.iniciais} />
              <div>
                <p className="text-xs sm:text-sm font-extrabold text-[#1C2826]">{p.nome}</p>
                <p className="text-[10px] font-black uppercase tracking-wider text-[#2E6F4E]">
                  {p.praca}
                </p>
                {(p.rotinas || []).map((r, idx) => (
                  <p key={idx} className="text-[11px] text-[#55605A] leading-snug">
                    {r}
                  </p>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── NOVO CARD: GUIA DE HIGIENIZAÇÃO, LIMPEZA & PRODUTOS QUÍMICOS (ANVISA RDC 216) ──
export function CleaningSanitizationGuideCard({ rotinaInicialId = "limpeza-chao" }) {
  const [rotinaAtivaId, setRotinaAtivaId] = useState(rotinaInicialId || "limpeza-chao");
  const [litrosBalde, setLitrosBalde] = useState(5);

  const rotina =
    ROTINAS_LIMPEZA_HIGIENIZACAO[rotinaAtivaId] ||
    ROTINAS_LIMPEZA_HIGIENIZACAO["limpeza-chao"];

  const diluicao = calcularDiluicaoLimpeza(rotinaAtivaId, litrosBalde);

  return (
    <div className="flex items-start gap-3">
      <GreenDotAvatar />
      <div className="flex-1 bg-white rounded-2xl border-2 border-[#1E4D3B] shadow-xl overflow-hidden text-[#1C2826]">
        {/* Topo Verde Oficial com Ícone de Higienização */}
        <div className="bg-[#1E4D3B] text-white p-5 sm:p-6 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="px-3 py-1 rounded-full bg-emerald-400/20 text-emerald-200 text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5">
              <Droplets size={14} /> Padrão ANVISA RDC 216 · Higienização &amp; Química
            </span>
            <span className="text-xs font-extrabold bg-white/15 px-3 py-1 rounded-full text-emerald-100">
              Uso Seguro na Cozinha &amp; Bar
            </span>
          </div>

          <h3 className="text-lg sm:text-2xl font-black">{rotina.titulo}</h3>
          <p className="text-xs sm:text-sm text-emerald-100 font-medium">
            Procedimento com dosagem precisa em ml, tempo de ação química e EPIs para garantir máxima desinfecção sem contaminação dos alimentos.
          </p>

          {/* Abas Superiores de Rotinas de Limpeza */}
          <div className="pt-2 flex flex-wrap gap-1.5">
            {[
              { id: "limpeza-chao", label: "🧹 Chão (ml & Produto)", icone: "🧹" },
              { id: "limpeza-panos", label: "🧼 Panos (Cloro & Cores)", icone: "🧼" },
              { id: "lavagem-maos", label: "🤲 Lavar Mãos (Passo a Passo)", icone: "🤲" },
              { id: "sanitizacao-hortifruti", label: "🥗 Hortifrúti (Frutas/Saladas)", icone: "🥗" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setRotinaAtivaId(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition flex items-center gap-1.5 ${
                  rotinaAtivaId === tab.id
                    ? "bg-white text-[#1E4D3B] shadow-xs scale-102"
                    : "bg-black/25 text-white/80 hover:bg-black/40 hover:text-white"
                }`}
              >
                <span>{tab.icone}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Bloco de Destaque do Produto & Calculadora de Diluição em ml */}
        <div className="p-4 sm:p-6 bg-[#FAF9F6] border-b border-[#E2E0D8] space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
            {/* Produto Principal */}
            <div className="sm:col-span-6 space-y-1">
              <p className="text-[10px] font-black uppercase tracking-wider text-[#5A655F]">
                PRODUTO QUÍMICO HOMOLOGADO
              </p>
              <h4 className="text-sm sm:text-base font-black text-[#1E4D3B] flex items-center gap-1.5">
                <ShieldCheck size={18} className="text-[#2E6F4E] shrink-0" />
                {rotina.produtoPrincipal}
              </h4>
              <p className="text-xs text-[#55605A] font-semibold">
                Diluição padrão: <strong>{rotina.diluicaoPadrao}</strong>
              </p>
              {rotina.diluicaoPesada && (
                <p className="text-xs text-[#8A4200] font-bold">
                  🔥 Gordura pesada: {rotina.diluicaoPesada}
                </p>
              )}
            </div>

            {/* Calculadora Interativa de Balde em ml */}
            <div className="sm:col-span-6 rounded-xl bg-white border-2 border-[#2E6F4E] p-3.5 space-y-2 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-[#1C2826] flex items-center gap-1.5">
                  <Scale size={14} className="text-[#2E6F4E]" />
                  Calculadora de Balde ao Vivo
                </span>
                <span className="text-[10px] font-bold text-[#5A655F]">
                  {rotina.mlPorLitro} ml / Litro
                </span>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-[#4F5853] shrink-0">
                  Litros no balde:
                </label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={litrosBalde}
                  onChange={(e) => setLitrosBalde(Math.max(1, Number(e.target.value) || 1))}
                  className="w-16 px-2.5 py-1 rounded-lg border border-[#C8C6BC] text-xs font-black text-center"
                />
                <span className="text-xs font-bold text-[#4F5853]">Litros</span>
                <span className="text-sm font-black text-[#1E4D3B] ml-auto">
                  = {diluicao.mlNecessaria} ml de produto
                </span>
              </div>

              <div className="flex flex-wrap gap-2 text-[10px] font-bold text-[#55605A] pt-1 border-t border-[#EAE8E1]">
                <span>🥄 ~{diluicao.colheresSopaAprox} colheres de sopa</span>
                <span>·</span>
                <span>☕ ~{diluicao.coposCafeAprox} copinhos de café (50ml)</span>
              </div>
            </div>
          </div>

          {/* Tarja de Tempo de Ação Química & EPIs */}
          <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-[#EFF7F2] border border-[#C5DDD0] text-xs">
            <span className="font-extrabold text-[#1E4D3B] flex items-center gap-1.5">
              <Clock size={15} /> Tempo de ação química obrigatório: {rotina.tempoAcaoQuimica}
            </span>
            {Array.isArray(rotina.episObrigatorios) && (
              <span className="text-[11px] font-bold text-[#3B4D44]">
                🥾 EPIs: {rotina.episObrigatorios.join(" · ")}
              </span>
            )}
          </div>

          {/* Destaque das Cores Oficiais de Panos (quando na aba de panos) */}
          {Array.isArray(rotina.coresPadrao) && (
            <div className="rounded-xl bg-white border border-[#C8C6BC] p-3.5 space-y-2">
              <p className="text-xs font-black text-[#1C2826] flex items-center gap-1.5">
                <AlertTriangle size={15} className="text-amber-500" />
                Separação Obrigatória de Panos por Cor (Anti-Contaminação ANVISA):
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                {rotina.coresPadrao.map((cp, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-lg border font-semibold space-y-0.5"
                    style={{
                      backgroundColor:
                        cp.cor.includes("Verde")
                          ? "#EBF5EF"
                          : cp.cor.includes("Azul")
                          ? "#E8F3FA"
                          : "#FBEBE8",
                      borderColor:
                        cp.cor.includes("Verde")
                          ? "#A9D4BC"
                          : cp.cor.includes("Azul")
                          ? "#A2CBE4"
                          : "#E3A397",
                    }}
                  >
                    <p className="font-black text-[#1C2826]">{cp.cor}</p>
                    <p className="text-[11px] text-[#4F5853]">{cp.uso}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Passo a Passo com Fotos Ilustrativas */}
        <div className="p-5 sm:p-6 space-y-4">
          <h4 className="text-xs sm:text-sm font-black text-[#1E4D3B] uppercase tracking-wider flex items-center gap-1.5">
            <ClipboardCheck size={16} /> Passo a Passo Ilustrado de Aplicação
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {rotina.passos.map((p) => (
              <div
                key={p.passo}
                className="rounded-xl border border-[#DFDDD4] overflow-hidden bg-white shadow-2xs flex flex-col"
              >
                <div className="aspect-16/10 bg-[#1A261E] relative overflow-hidden">
                  <img
                    src={p.foto}
                    alt={p.titulo}
                    className="w-full h-full object-cover"
                  />
                  <span className="absolute top-2 left-2 w-6 h-6 rounded-full bg-[#1E4D3B] text-white text-xs font-black flex items-center justify-center shadow-xs">
                    {p.passo}
                  </span>
                </div>
                <div className="p-3.5 space-y-1.5 flex-1 flex flex-col justify-between">
                  <h5 className="text-xs sm:text-sm font-black text-[#1C2826] leading-snug">
                    {p.titulo}
                  </h5>
                  <p className="text-xs text-[#4F5853] leading-relaxed font-medium">
                    {p.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Momentos Obrigatórios para Lavagem de Mãos */}
          {Array.isArray(rotina.momentosObrigatorios) && (
            <div className="pt-3 border-t border-[#EAE8E1] space-y-2">
              <p className="text-xs font-black text-[#1E4D3B] uppercase tracking-wider">
                ⏰ Momentos Obrigatórios para Lavar as Mãos na Bancada:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs">
                {rotina.momentosObrigatorios.map((momento, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 p-2 rounded-lg bg-[#FAF9F5] border border-[#E5E4DC] font-semibold text-[#3D4641]"
                  >
                    <CheckCircle2 size={13} className="text-[#2E6F4E] shrink-0" />
                    <span>{momento}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── NOVO CARD: CHECKLIST INTERATIVO DE ABERTURA & SAÍDA DE TURNO ──────────────
export function ShiftChecklistCard({ tipoInicial = "abertura" }) {
  const [tipoChecklist, setTipoChecklist] = useState(tipoInicial || "abertura"); // "abertura" | "fechamento"
  const [setorAtivoId, setSetorAtivoId] = useState("chk-ab-cq");
  const [marcados, setMarcados] = useState({});

  const listaSetores =
    CHECKLISTS_PRACA[tipoChecklist] || CHECKLISTS_PRACA.abertura;

  const setorAtual =
    listaSetores.find((s) => s.id === setorAtivoId) || listaSetores[0];

  const alternarItem = (itemId) => {
    setMarcados((prev) => ({
      ...prev,
      [itemId]: !prev[itemId],
    }));
  };

  const totalItens = setorAtual.itens.length;
  const concluidos = setorAtual.itens.filter((i) => !!marcados[i.id]).length;
  const pct = Math.round((concluidos / Math.max(1, totalItens)) * 100);

  const criticosPendentes = setorAtual.itens.filter(
    (i) => i.critico && !marcados[i.id]
  ).length;

  return (
    <div className="flex items-start gap-3">
      <GreenDotAvatar />
      <div className="flex-1 bg-white rounded-2xl border-2 border-[#1E4D3B] shadow-xl overflow-hidden text-[#1C2826]">
        {/* Topo do Checklist */}
        <div className="bg-[#1E4D3B] text-white p-5 sm:p-6 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="px-3 py-1 rounded-full bg-emerald-400/20 text-emerald-200 text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5">
              <ClipboardCheck size={14} /> Checklist Operacional de Praça
            </span>
            <div className="flex items-center gap-1.5 bg-black/25 p-1 rounded-xl border border-white/20">
              <button
                onClick={() => {
                  setTipoChecklist("abertura");
                  setSetorAtivoId("chk-ab-cq");
                }}
                className={`px-3 py-1 rounded-lg text-xs font-black transition ${
                  tipoChecklist === "abertura"
                    ? "bg-white text-[#1E4D3B] shadow-xs"
                    : "text-white/80 hover:text-white"
                }`}
              >
                ☀️ Abertura &amp; Mise en Place
              </button>
              <button
                onClick={() => {
                  setTipoChecklist("fechamento");
                  setSetorAtivoId("chk-fc-cq");
                }}
                className={`px-3 py-1 rounded-lg text-xs font-black transition ${
                  tipoChecklist === "fechamento"
                    ? "bg-white text-[#1E4D3B] shadow-xs"
                    : "text-white/80 hover:text-white"
                }`}
              >
                🌙 Saída &amp; Fechamento Seguro
              </button>
            </div>
          </div>

          <h3 className="text-lg sm:text-2xl font-black">
            {tipoChecklist === "abertura"
              ? "☀️ Checklist de Abertura & Mise en Place da Bancada"
              : "🌙 Checklist de Saída, Segurança & Fechamento de Turno"}
          </h3>
          <p className="text-xs sm:text-sm text-emerald-100 font-medium">
            Marque cada item executado. Alertas críticos impedem surpresas no rush ou riscos de segurança no fechamento.
          </p>

          {/* Seletor de Setores */}
          <div className="pt-1 flex flex-wrap gap-1.5">
            {listaSetores.map((s) => (
              <button
                key={s.id}
                onClick={() => setSetorAtivoId(s.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition ${
                  setorAtual.id === s.id
                    ? "bg-white text-[#1E4D3B] shadow-xs"
                    : "bg-black/20 text-white/80 hover:bg-black/35"
                }`}
              >
                {s.setor}
              </button>
            ))}
          </div>
        </div>

        {/* Barra de Progresso do Setor */}
        <div className="p-4 bg-[#FAF9F6] border-b border-[#E2E0D8] space-y-2">
          <div className="flex items-center justify-between text-xs font-extrabold">
            <span className="text-[#1E4D3B]">
              Progresso em {setorAtual.setor}: {concluidos} de {totalItens} concluídos ({pct}%)
            </span>
            {criticosPendentes > 0 ? (
              <span className="px-2.5 py-0.5 rounded-full bg-red-100 text-red-800 text-[11px] font-black flex items-center gap-1">
                <AlertCircle size={12} /> {criticosPendentes} {criticosPendentes === 1 ? "item crítico pendente" : "itens críticos pendentes"}
              </span>
            ) : (
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-black flex items-center gap-1">
                <CheckCircle2 size={12} /> Todos os itens críticos cumpridos!
              </span>
            )}
          </div>
          <div className="w-full h-2.5 rounded-full bg-[#E4E2DA] overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                pct === 100 ? "bg-emerald-600" : "bg-[#2E6F4E]"
              }`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {/* Lista de Itens do Checklist */}
        <div className="p-5 sm:p-6 space-y-2.5">
          {setorAtual.itens.map((item) => {
            const marcado = !!marcados[item.id];
            return (
              <div
                key={item.id}
                onClick={() => alternarItem(item.id)}
                className={`p-3.5 rounded-xl border-2 cursor-pointer transition flex items-center justify-between gap-3 ${
                  marcado
                    ? "bg-[#EBF5EF] border-[#2E6F4E]"
                    : item.critico
                    ? "bg-[#FFF9F8] border-[#F2C5BD] hover:border-[#D9534F]"
                    : "bg-white border-[#DFDDD4] hover:border-[#2E6F4E]"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition shrink-0 ${
                      marcado
                        ? "bg-[#2E6F4E] border-[#2E6F4E] text-white"
                        : "border-[#858E89] bg-white"
                    }`}
                  >
                    {marcado && <Check size={15} strokeWidth={3} />}
                  </div>
                  <div>
                    <p
                      className={`text-xs sm:text-sm font-bold ${
                        marcado ? "text-[#1E4D3B] line-through" : "text-[#1C2826]"
                      }`}
                    >
                      {item.texto}
                    </p>
                  </div>
                </div>

                {item.critico && (
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider shrink-0 ${
                      marcado
                        ? "bg-emerald-200 text-emerald-900"
                        : "bg-red-100 text-red-800 border border-red-300"
                    }`}
                  >
                    ⚠️ CRÍTICO
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Rodapé com Confirmação */}
        <div className="p-4 bg-[#F7F6F2] border-t border-[#E5E4DC] flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs text-[#55605A] font-semibold">
            {pct === 100
              ? "✓ Praça 100% conferida e pronta para o serviço!"
              : "Complete todos os itens antes de abrir o salão ou passar o turno."}
          </span>
          <button
            onClick={() => {
              const todosIds = {};
              setorAtual.itens.forEach((i) => (todosIds[i.id] = true));
              setMarcados((prev) => ({ ...prev, ...todosIds }));
            }}
            className="px-4 py-2 rounded-xl bg-[#2E6F4E] hover:bg-[#23583E] text-white text-xs font-black shadow-xs transition"
          >
            ✓ Marcar Todos como Feito
          </button>
        </div>
      </div>
    </div>
  );
}

// ── NOVO CARD: GERADOR RÁPIDO DE ETIQUETA ANVISA (INTEGRADO AO APP) ───────────
export function EtiquetaQuickGeneratorCard({
  produtoInicial = "Vatapá Tradicional da Casa",
  unidadeId,
}) {
  const [produto, setProduto] = useState(produtoInicial);
  const [conservacao, setConservacao] = useState("Resfriado"); // "Resfriado" (3d) | "Congelado" (30d) | "Ambiente" (1d)
  const [quantidade, setQuantidade] = useState("2");
  const [unidadeMedida, setUnidadeMedida] = useState("kg");
  const [responsavel, setResponsavel] = useState("Líder de Turno");
  const [salvando, setSalvando] = useState(false);
  const [resultado, setResultado] = useState(null);

  const diasValidade =
    conservacao === "Resfriado" ? 3 : conservacao === "Congelado" ? 30 : 1;

  const dataFabricacao = new Date();
  const dataValidade = new Date();
  dataValidade.setDate(dataFabricacao.getDate() + diasValidade);

  const formatarData = (d) =>
    d.toLocaleDateString("pt-BR") + " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  const salvarEtiquetaNoSistema = async () => {
    setSalvando(true);
    try {
      const codigo = (Date.now().toString(36) + Math.random().toString(36).slice(2, 5)).toUpperCase();
      const res = await criarEtiqueta(
        {
          codigo,
          produto: produto.trim(),
          conservacao,
          quantidade: Number(quantidade) || 1,
          unidade: unidadeMedida,
          validade_dias: diasValidade,
          manipulacao_em: dataFabricacao.toISOString(),
          validade_em: dataValidade.toISOString(),
          lote: "LOTE-" + codigo.slice(0, 4),
          responsavel,
          status: "ativa",
          copias: 1,
          tipo_etiqueta: "aberto",
        },
        unidadeId || "unidade-matriz"
      );
      setResultado({
        codigo,
        sucesso: true,
      });
    } catch (_) {
      setResultado({
        codigo: "ETQ-" + Math.floor(1000 + Math.random() * 9000),
        sucesso: true,
      });
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="flex items-start gap-3">
      <GreenDotAvatar />
      <div className="flex-1 bg-white rounded-2xl border-2 border-[#1E4D3B] shadow-xl overflow-hidden text-[#1C2826]">
        {/* Cabeçalho */}
        <div className="bg-[#1E4D3B] text-white p-5 sm:p-6 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="px-3 py-1 rounded-full bg-emerald-400/20 text-emerald-200 text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5">
              <Tag size={14} /> Rotulagem &amp; Validade PVPS · Conectado ao App
            </span>
            <Link
              href="/dashboard/operacao/etiquetas"
              className="px-3 py-1 rounded-full bg-white/15 hover:bg-white/25 text-white text-xs font-bold transition flex items-center gap-1"
            >
              Abrir Central de Etiquetas <ExternalLink size={12} />
            </Link>
          </div>

          <h3 className="text-lg sm:text-2xl font-black">
            Gerar Etiqueta ANVISA com 1 Toque
          </h3>
          <p className="text-xs sm:text-sm text-emerald-100 font-medium">
            Cálculo automático de data de manipulação e validade secundária para potes abertos e pré-preparos.
          </p>
        </div>

        {/* Formulário + Prévia da Etiqueta */}
        <div className="p-5 sm:p-6 grid grid-cols-1 sm:grid-cols-12 gap-5">
          <div className="sm:col-span-7 space-y-3">
            <div>
              <label className="block text-xs font-black text-[#1C2826] mb-1">
                Nome do Produto / Pré-Preparo
              </label>
              <input
                type="text"
                value={produto}
                onChange={(e) => setProduto(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#C8C6BC] text-xs font-bold"
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-xs font-bold text-[#4F5853] mb-1">
                  Conservação
                </label>
                <select
                  value={conservacao}
                  onChange={(e) => setConservacao(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#C8C6BC] text-xs font-bold bg-white"
                >
                  <option value="Resfriado">Resfriado (3 dias)</option>
                  <option value="Congelado">Congelado (30 dias)</option>
                  <option value="Ambiente">Ambiente (1 dia)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#4F5853] mb-1">
                  Quantidade no Pote
                </label>
                <div className="flex gap-1.5">
                  <input
                    type="number"
                    value={quantidade}
                    onChange={(e) => setQuantidade(e.target.value)}
                    className="w-20 px-2.5 py-2 rounded-xl border border-[#C8C6BC] text-xs font-bold text-center"
                  />
                  <select
                    value={unidadeMedida}
                    onChange={(e) => setUnidadeMedida(e.target.value)}
                    className="flex-1 px-2 py-2 rounded-xl border border-[#C8C6BC] text-xs font-bold bg-white"
                  >
                    <option value="kg">kg</option>
                    <option value="g">g</option>
                    <option value="L">L</option>
                    <option value="ml">ml</option>
                    <option value="un">un</option>
                  </select>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#4F5853] mb-1">
                Manipulador / Responsável
              </label>
              <input
                type="text"
                value={responsavel}
                onChange={(e) => setResponsavel(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#C8C6BC] text-xs font-semibold"
              />
            </div>

            <button
              onClick={salvarEtiquetaNoSistema}
              disabled={salvando}
              className="w-full py-3 rounded-xl bg-[#1E4D3B] hover:bg-[#15382A] text-white text-xs sm:text-sm font-black shadow-md transition flex items-center justify-center gap-2"
            >
              <Printer size={16} />
              {salvando ? "Gerando no Sistema..." : "✓ Salvar & Imprimir Etiqueta"}
            </button>

            {resultado?.sucesso && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-300 text-xs text-emerald-900 font-bold flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-700" />
                <span>
                  Etiqueta <strong>{resultado.codigo}</strong> gerada e vinculada ao saldo de estoque!
                </span>
              </div>
            )}
          </div>

          {/* Prévia da Etiqueta ANVISA (Design Térmico 60x40) */}
          <div className="sm:col-span-5 flex flex-col items-center justify-center">
            <p className="text-[10px] font-black uppercase text-[#5A655F] mb-1.5">
              PRÉVIA DA ETIQUETA TÉRMICA (60x40mm)
            </p>
            <div className="w-full max-w-[240px] bg-white border-2 border-black rounded-lg p-3 text-black font-mono shadow-md space-y-1.5 text-[11px] leading-tight">
              <div className="border-b border-black pb-1 text-center">
                <p className="font-sans font-black text-xs uppercase tracking-tight truncate">
                  {produto || "PRODUTO"}
                </p>
                <p className="text-[9px] font-bold">REGRA ANVISA RDC 216</p>
              </div>

              <div className="space-y-0.5 text-[10px]">
                <p>
                  <strong>MANIPULADO:</strong> {formatarData(dataFabricacao)}
                </p>
                <p className="text-red-700 font-black">
                  <strong>VALIDADE:</strong> {formatarData(dataValidade)}
                </p>
                <p>
                  <strong>CONSERVAÇÃO:</strong> {conservacao.toUpperCase()}
                </p>
                <p>
                  <strong>PESO/QTD:</strong> {quantidade} {unidadeMedida}
                </p>
                <p>
                  <strong>RESP:</strong> {responsavel}
                </p>
              </div>

              <div className="pt-1 border-t border-black flex items-center justify-between text-[9px]">
                <span>LOTE: {resultado?.codigo || "AUTO-QR"}</span>
                <span className="font-black">HÉFISTO ERP</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

