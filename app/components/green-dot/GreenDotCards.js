"use client";

import React, { useState, useEffect } from "react";
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
  Maximize2,
  Lightbulb,
  Check,
  UtensilsCrossed,
  Flame,
  GlassWater,
} from "lucide-react";
import { TOPICOS_INICIAIS } from "../../lib/green-dot-data";

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
      {/* Ícone de avental de chef/barista inspirado nas telas */}
      <svg viewBox="0 0 24 24" className="w-5 h-5 fill-none stroke-current" strokeWidth="1.8">
        <path d="M9 4c0 1.5 1.3 2.5 3 2.5S15 5.5 15 4" />
        <path d="M7 8l2-3h6l2 3v11a2 2 0 01-2 2H9a2 2 0 01-2-2V8z" />
        <rect x="9.5" y="12" width="5" height="4" rx="0.8" />
      </svg>
    </div>
  );
}

// ── TELA 20: BANNER DE PROPÓSITO (STREAMLINE WORKFLOWS / CONSISTENCY) ────────
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

// ── TELA 2 & 14: CARD DE BOAS-VINDAS, GOVERNANÇA E PÍLULAS DE TÓPICOS ─────────
export function WelcomeGovernanceCard({ onSelectTopic, onOpenTips, fichasReais = [] }) {
  const [mostrarDicas, setMostrarDicas] = useState(false);

  return (
    <div className="bg-white rounded-2xl border border-[#E2E0D8] shadow-sm p-5 sm:p-7 text-[#2B332E] space-y-4">
      <div className="text-xs sm:text-sm text-[#4F5853] space-y-2.5 leading-relaxed">
        <p>
          Evite inserir dados pessoais sensíveis na aplicação. Caso identifique alguma inconsistência em uma ficha técnica ou manual operacional, reporte na{" "}
          <strong className="text-[#1E392A] font-bold">Central Operacional Héfisto</strong> ou acione o Líder de Cozinha/Salão.
        </p>
        <p>
          As perguntas e respostas são registradas pela gestão de qualidade do restaurante para aprimorar continuamente as fichas técnicas, manuais de equipamentos e escalas de turno.
        </p>
        <p className="italic text-xs text-[#646E68]">
          <strong>Instruções de Acesso às Fichas Oficiais:</strong> Para abrir a ficha de custo completa ou imprimir etiquetas térmicas, acesse o menu superior em{" "}
          <strong>Cardápio &rarr; Fichas Técnicas</strong> ou toque em qualquer receita abaixo.
        </p>
      </div>

      <hr className="border-[#E6E4DC]" />

      <div className="space-y-4">
        <h3 className="font-bold text-sm sm:text-base text-[#1C2826]">
          Até agora, fui treinado para ajudar com Produção Gastronômica, Bar, Gestão de Estoque, Manutenção de Equipamentos e Escala de Turno.
        </h3>

        {/* Produção de Pratos & Bebidas */}
        <div>
          <p className="text-xs sm:text-sm text-[#55605A] mb-2 font-medium">Produção de Pratos &amp; Coquetelaria</p>
          <div className="flex flex-wrap gap-2">
            {TOPICOS_INICIAIS.producao.map((t) => (
              <button
                key={t.id}
                onClick={() => onSelectTopic(t)}
                className="px-4 py-2 rounded-lg border border-[#76847D] bg-[#F9F9F7] hover:bg-[#EBF3EE] hover:border-[#1E4D3B] text-[#1E4D3B] font-bold text-xs sm:text-sm transition shadow-2xs active:scale-[0.98]"
              >
                {t.label}
              </button>
            ))}
            {fichasReais.slice(0, 3).map((f) => (
              <button
                key={f.id}
                onClick={() =>
                  onSelectTopic({
                    id: `ficha-real-${f.id}`,
                    label: f.nome,
                    prompt: `Quero ver a ficha técnica e preparo de ${f.nome}`,
                    fichaReal: f,
                  })
                }
                className="px-4 py-2 rounded-lg border border-[#2E6F4E]/50 bg-[#EFF7F2] hover:bg-[#E0F0E6] text-[#1E4D3B] font-bold text-xs sm:text-sm transition"
              >
                {f.nome}
              </button>
            ))}
          </div>
        </div>

        {/* Gestão de Estoque & Segurança Alimentar */}
        <div>
          <p className="text-xs sm:text-sm text-[#55605A] mb-2 font-medium">Gestão de Estoque &amp; Segurança Alimentar</p>
          <div className="flex flex-wrap gap-2">
            {TOPICOS_INICIAIS.estoque.map((t) => (
              <button
                key={t.id}
                onClick={() => onSelectTopic(t)}
                className="px-4 py-2 rounded-lg border border-[#76847D] bg-[#F9F9F7] hover:bg-[#EBF3EE] hover:border-[#1E4D3B] text-[#1E4D3B] font-bold text-xs sm:text-sm transition shadow-2xs active:scale-[0.98]"
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Manutenção de Equipamentos & Escala */}
        <div>
          <p className="text-xs sm:text-sm text-[#55605A] mb-2 font-medium">Equipamentos da Cozinha/Bar &amp; Posicionamento de Turno</p>
          <div className="flex flex-wrap gap-2">
            {[...TOPICOS_INICIAIS.manutencao, ...TOPICOS_INICIAIS.escala].map((t) => (
              <button
                key={t.id}
                onClick={() => onSelectTopic(t)}
                className="px-4 py-2 rounded-lg border border-[#76847D] bg-[#F9F9F7] hover:bg-[#EBF3EE] hover:border-[#1E4D3B] text-[#1E4D3B] font-bold text-xs sm:text-sm transition shadow-2xs active:scale-[0.98]"
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <hr className="border-[#E6E4DC]" />

      {/* Dicas de uso */}
      <div className="space-y-2.5">
        <p className="font-bold text-xs sm:text-sm text-[#1C2826]">Aqui estão algumas dicas para trabalhar comigo:</p>
        <div className="flex items-start gap-2.5 text-xs sm:text-sm font-semibold text-[#2B332E]">
          <Lightbulb size={16} className="text-amber-500 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p>1. Seja claro e específico sobre o prato, bebida ou equipamento</p>
            <p>
              2. Faça perguntas de acompanhamento, ou toque em <strong>Reiniciar</strong> quando mudar de assunto{mostrarDicas ? "." : "..."}
            </p>
            {mostrarDicas && (
              <>
                <p>3. Use o microfone na barra inferior se estiver com as mãos ocupadas na bancada.</p>
                <p>4. Para falhas em máquinas, você pode abrir um chamado técnico em 4 cliques direto por aqui.</p>
              </>
            )}
          </div>
        </div>
        <button
          onClick={() => {
            setMostrarDicas((v) => !v);
            onOpenTips?.();
          }}
          className="px-3.5 py-1.5 rounded-lg border border-[#76847D] bg-white hover:bg-[#F3F2EE] text-[#1E4D3B] font-bold text-xs transition"
        >
          {mostrarDicas ? "Ocultar dicas" : "Ver dicas"}
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

// ── TELA 3: CARD RICO DE FICHA TÉCNICA / RECEITA (COM MAJOR STEPS P/M/G/FAM) ──
export function RecipeDetailCard({ receita }) {
  if (!receita) return null;

  return (
    <div className="flex items-start gap-3">
      <GreenDotAvatar />
      <div className="flex-1 bg-white rounded-2xl border border-[#E2E0D8] shadow-md overflow-hidden text-[#2B332E]">
        {/* Hero Escuro com Título e Imagem */}
        <div className="bg-[#233329] p-5 sm:p-6 text-white">
          <div className="flex items-center justify-between gap-2 mb-3">
            <h3 className="text-lg sm:text-xl font-bold tracking-tight">{receita.nome}</h3>
            <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-white/15 text-emerald-200">
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

          {/* Base e Código da Ficha */}
          <div className="space-y-3 pt-1">
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-wider text-[#3A4A40]">
                BASE / INSUMO PRINCIPAL
              </p>
              <p className="text-sm font-semibold text-[#2B332E] mt-0.5">{receita.basePrincipal}</p>
            </div>

            <div className="flex items-end justify-between gap-2">
              <div>
                <p className="text-[11px] font-extrabold uppercase tracking-wider text-[#3A4A40]">
                  CÓDIGO FICHA (ID)
                </p>
                <p className="text-base font-black text-[#1C2826] mt-0.5">{receita.codigo}</p>
              </div>
              {receita.subtituloNota && (
                <p className="text-[11px] text-[#66706B] italic">{receita.subtituloNota}</p>
              )}
            </div>
          </div>

          {/* Tabela MAJOR STEPS (ETAPAS PRINCIPAIS) com cabeçalho verde-floresta */}
          <div className="pt-2">
            <div className="grid grid-cols-12 bg-[#3B624C] text-white px-3.5 py-2 rounded-t-lg text-xs font-extrabold uppercase tracking-wider items-center">
              <div className="col-span-6">ETAPAS PRINCIPAIS</div>
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

// ── TELA 4: CONVITE PARA VÍDEO PASSO A PASSO + PLAYER + SMART TWEAKS ─────────
export function RecipeInteractiveFollowUp({
  receita,
  mostrarVideo,
  onToggleVideo,
  onSelectCategoryTip,
  categoriaAtiva,
}) {
  const [stepAtivo, setStepAtivo] = useState(0);
  const steps = receita?.videoSteps || [];
  const stepAtual = steps[stepAtivo] || steps[0];

  return (
    <div className="space-y-4">
      {/* Pergunta: Quer ver como é feito? */}
      <div className="flex items-start gap-3">
        <GreenDotAvatar />
        <div className="flex-1 bg-white rounded-2xl border border-[#E2E0D8] shadow-sm p-4 sm:p-5 space-y-3">
          <p className="text-sm sm:text-base font-bold text-[#1C2826]">
            Quer ver como é feito na prática? Tenho um guia visual rápido do passo a passo para você assistir na bancada.
          </p>
          <div className="flex flex-wrap gap-2.5">
            <button
              onClick={() => onToggleVideo(true)}
              className={`px-4 py-2 rounded-lg font-bold text-xs sm:text-sm transition ${
                mostrarVideo
                  ? "bg-[#24593F] text-white shadow-xs"
                  : "bg-[#2E6F4E] hover:bg-[#24593F] text-white"
              }`}
            >
              Sim, mostrar agora!
            </button>
            <button
              onClick={() => onToggleVideo(false)}
              className="px-4 py-2 rounded-lg border border-[#76847D] bg-white hover:bg-[#F4F3EF] text-[#1E4D3B] font-bold text-xs sm:text-sm transition"
            >
              Talvez depois
            </button>
          </div>
        </div>
      </div>

      {/* Player Visual com Badge Verde Sobreposto (Tela 4) */}
      {mostrarVideo && stepAtual && (
        <div className="flex items-start gap-3">
          <GreenDotAvatar />
          <div className="flex-1 bg-white rounded-2xl border border-[#E2E0D8] shadow-sm overflow-hidden">
            <div className="relative aspect-16/10 max-h-72 bg-[#1A241E]">
              <img
                src={stepAtual.imagem}
                alt={stepAtual.titulo}
                className="w-full h-full object-cover opacity-90"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-transparent" />

              {/* Etiqueta verde igual ao "Queue espresso shots" da Tela 4 */}
              <div className="absolute bottom-5 left-5 right-5 flex flex-col gap-2">
                <span className="inline-block w-fit bg-[#2E6F4E]/95 text-white font-bold text-sm sm:text-base px-4 py-1.5 rounded-lg shadow-md">
                  {stepAtual.ordem}. {stepAtual.titulo}
                </span>
                <p className="text-xs sm:text-sm text-white/95 font-medium bg-black/45 backdrop-blur-xs p-2.5 rounded-lg">
                  {stepAtual.detalhe}
                </p>
              </div>
            </div>

            {/* Seletor de etapas do vídeo */}
            <div className="px-4 py-3 bg-[#F8F7F3] border-t border-[#E5E4DC] flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                {steps.map((s, idx) => (
                  <button
                    key={s.ordem}
                    onClick={() => setStepAtivo(idx)}
                    className={`px-3 py-1 rounded-full text-xs font-bold transition ${
                      stepAtivo === idx
                        ? "bg-[#2E6F4E] text-white"
                        : "bg-white border border-[#D0CEC4] text-[#3B4740] hover:bg-[#EBF3EE]"
                    }`}
                  >
                    Passo {s.ordem}
                  </button>
                ))}
              </div>
              <span className="text-xs font-bold text-[#5A655F]">
                Etapa {stepAtivo + 1} de {steps.length}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Card: Dicas para adaptações inteligentes (Tela 4 inferior) */}
      <div className="flex items-start gap-3">
        <GreenDotAvatar />
        <div className="flex-1 bg-white rounded-2xl border border-[#E2E0D8] shadow-sm p-4 sm:p-5 space-y-3">
          <p className="text-sm sm:text-base font-bold text-[#1C2826]">
            Também tenho dicas para adaptações inteligentes! Escolha uma categoria abaixo para consultar:
          </p>
          <p className="text-xs sm:text-sm font-semibold text-[#3C4741] flex items-center gap-2">
            <span>🍽️</span> Quer escolher uma para começar?
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            {[
              { id: "customizacao", label: "Dicas de customização" },
              { id: "sabor", label: "Realce de sabor" },
              { id: "substituicoes", label: "Troca de ingredientes" },
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
      {/* Checklist aninhado igual à Tela 6 ("Here are a few ways you can customize it:") */}
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

      {/* Card PAIRING RECOMMENDATION (Telas 5 & 6) */}
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

// ── TELA 7: CENTRAL DE MANUTENÇÃO DE EQUIPAMENTOS (EQUIPMENT MAINTENANCE TOOL) ─
export function EquipmentMaintenanceFlowCard({
  equipamentos,
  equipamentoInicialId,
  chamados,
  onNovoChamado,
  unidadeInfo,
  sessao,
}) {
  // Modos internos do fluxo das Telas 7 -> 8 -> 9/12 -> 10 -> 11 -> 12/13
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
      {/* TELA 7: HUB DE EQUIPAMENTOS */}
      {modo === "hub" && (
        <div className="flex items-start gap-3">
          <GreenDotAvatar />
          <div className="flex-1 bg-white rounded-2xl border border-[#E2E0D8] shadow-sm overflow-hidden">
            {/* Banner Mint-Green igual à Tela 7 */}
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

              {/* Barra de busca de erro */}
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

            {/* Carrossel "Seus equipamentos" (Your equipment) */}
            <div className="p-5 sm:p-6 space-y-5">
              <div>
                <h4 className="text-sm font-extrabold text-[#1C2826] mb-3">Seus equipamentos</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {equipamentos.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-xl bg-[#4A4C4E] text-white p-4 flex flex-col justify-between min-h-[210px] shadow-xs"
                    >
                      <p className="text-center font-bold text-sm leading-snug">{item.nomeCurto}</p>
                      <div className="my-3 h-24 rounded-lg overflow-hidden bg-black/30 flex items-center justify-center">
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

              {/* Top Equipment Issues for your Store */}
              <div>
                <h4 className="text-sm font-extrabold text-[#1C2826] mb-2.5">
                  Principais Ocorrências na sua Unidade
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {equipamentos.map((item, idx) => (
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
            {/* Diagrama escuro com etiquetas apontando */}
            <div className="relative rounded-xl overflow-hidden bg-[#484A4C] min-h-[260px] sm:min-h-[300px] flex items-center justify-center p-4">
              <img
                src={equip.imagem}
                alt={equip.nome}
                className="w-64 h-48 object-cover rounded-xl shadow-2xl opacity-85"
              />

              {/* Botão <- Voltar */}
              <button
                onClick={() => setModo("hub")}
                className="absolute top-3.5 left-3.5 px-3.5 py-1.5 rounded-full bg-[#2E6F4E] hover:bg-[#23563C] text-white text-xs font-bold flex items-center gap-1 shadow-md"
              >
                &larr; Voltar
              </button>

              {/* Callout pills igual à Tela 8 */}
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

            <h3 className="text-base sm:text-lg font-extrabold text-[#1C2826]">{equip.nome}</h3>

            {/* Card 1: Está enfrentando problemas? */}
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

            {/* Card 2: Precisa pedir uma peça de reposição? */}
            <div className="rounded-xl border border-[#E2E0D8] p-4 space-y-2.5">
              <h4 className="text-sm sm:text-base font-extrabold text-[#1C2826]">
                Precisa solicitar uma peça de reposição para este equipamento?
              </h4>
              <p className="text-xs sm:text-sm text-[#4F5853] font-medium">
                Se você procura o código SKU de vedação, sonda ou válvula, temos tudo catalogado!
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
              {/* Barra de progresso verde na base da imagem */}
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

            {/* Botões <- Anterior | Próximo -> (Tela 12) */}
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

            {/* Pergunta de Verificação (Tela 9: Check to see if your problem has been solved) */}
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
              {/* Coluna Esquerda: Lista de Chamados */}
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

              {/* Coluna Direita: Detalhe da Ordem de Serviço (Service Request) */}
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

                      {/* Timeline Item 1: Ticket Logged */}
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

                      {/* Timeline Item 2: Supplier Assigned */}
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

      {/* Caso resolvido */}
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

// ── TELA 15: ESCALA HORÁRIA GANTT COM FAIXA DE PICO E CONVOCAÇÃO DE EXTRA ────
export function ShiftScheduleGanttCard({ escala, onAddPartnerClick }) {
  const horas = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23];

  return (
    <div className="flex items-start gap-3">
      <GreenDotAvatar />
      <div className="flex-1 bg-white rounded-2xl border border-[#E2E0D8] shadow-md overflow-hidden text-[#1C2826]">
        {/* Header da Escala */}
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
              Segunda, 18 de Outubro
            </span>
          </div>

          <button
            onClick={onAddPartnerClick}
            className="px-3 py-1.5 rounded-lg border border-[#76847D] bg-white hover:bg-[#EBF3EE] text-[#1E4D3B] text-xs font-bold transition"
          >
            Previsão &amp; Opções de Turno
          </button>
        </div>

        {/* Corpo do Gantt */}
        <div className="relative overflow-x-auto">
          {/* Cabeçalho de Horas */}
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

          {/* Linhas dos Colaboradores */}
          <div className="divide-y divide-[#ECEAE2] min-w-[680px] relative">
            {escala.map((colab) => {
              const leftPct = Math.max(0, ((colab.inicio - 8) / 16) * 100);
              const widthPct = Math.min(100 - leftPct, ((colab.fim - colab.inicio) / 16) * 100);

              return (
                <div key={colab.id} className="grid grid-cols-12 items-center hover:bg-[#FAF9F5]">
                  {/* Coluna Nome */}
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

                  {/* Barra Horizontal de Turno */}
                  <div className="col-span-9 relative h-12 flex items-center">
                    {/* Faixa Amarela de Pico de Almoço (12h-15h) */}
                    <div
                      className="absolute top-0 bottom-0 bg-[#EFE6B8]/45 pointer-events-none"
                      style={{ left: `${((12 - 8) / 16) * 100}%`, width: `${(3 / 16) * 100}%` }}
                    />
                    {/* Linha Vertical Verde AGORA (11h30) */}
                    <div
                      className="absolute top-0 bottom-0 w-0.5 bg-[#2E6F4E] z-10 pointer-events-none"
                      style={{ left: `${((11.5 - 8) / 16) * 100}%` }}
                    />

                    {/* Barra Verde do Turno */}
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

          {/* Botão Flutuante "+ Adicionar colaborador" (Tela 15 inferior direita) */}
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
      {/* Tela 16: Grid 2x2 de Colaboradores/Extras Disponíveis */}
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

      {/* Telas 17 & 18: "Entrando em contato com Bruno S..." (40% -> 100% Confirmado) */}
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

              {/* Barra de Progresso (40% Notification Opened -> 100% Arriving in 6 mins) */}
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

  // Bonequinho de avental verde igual às Telas 1 e 19
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
        {/* Topo: Data + Previsão de Transações */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-[#1C2826]">
              <Calendar size={15} className="text-[#2E6F4E]" />
              Hoje, 18 de Out
            </span>
            <span className="text-[#2E6F4E] underline font-extrabold">Agora</span>
          </div>
          <span className="flex items-center gap-1 text-[#2E6F4E] font-extrabold">
            <BarChart3 size={15} />
            Previsão de comandas &amp; mesas <ChevronDown size={14} />
          </span>
        </div>

        {/* Barra de Horários com Destaque Verde e PICO */}
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

        {/* Subheader: Janela do Turno + Pílulas [5 Colaboradores] [Alocar] [Flex] */}
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

        {/* DIAGRAMA ESQUEMÁTICO DAS PRAÇAS DO RESTAURANTE (Inspirado 1:1 na Tela 1/19) */}
        <div className="rounded-2xl bg-[#FAF9F6] border border-[#E5E3DA] p-4 sm:p-6 relative">
          <div className="grid grid-cols-12 gap-3 items-center">
            {/* Linha Superior da Cozinha: Bar Frio/Chopeira | Cocção/Caldos | Fornos Combinados */}
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

            {/* Linha Inferior: Pass/Delivery (MO&P) | Fogão & Grelha | Caixa/PDV | Vitrine */}
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

        {/* Link "Why this play?" (Por que essa formação?) */}
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

        {/* Roster de Colaboradores e Funções na Base do Card */}
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
