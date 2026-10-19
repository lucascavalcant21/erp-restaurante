"use client";

import React from "react";
import { RefreshCw, AlertCircle } from "lucide-react";

/**
 * Header unificado dos Hubs Operacionais Héfisto
 */
export function HubHeader({
  icon: Icon,
  domainTag = "Ambiente Operacional",
  unitName = "Unidade Principal",
  title = "",
  subtitle = "",
  onRefresh,
  isRefreshing = false,
  viewModeButton = null,
  primaryActionButton = null,
  className = "",
}) {
  return (
    <div
      className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-200/80 ${className}`}
    >
      <div className="flex items-center gap-3.5">
        {Icon && (
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0 border border-emerald-200 shadow-xs">
            <Icon size={26} />
          </div>
        )}
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] uppercase tracking-widest font-extrabold text-emerald-800">
              {domainTag}
            </span>
            <span className="text-zinc-300">•</span>
            <span className="text-[11px] text-hf-text-2 font-semibold">{unitName}</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-hf-text tracking-tight">
            {title}
          </h1>
          {subtitle && <p className="text-xs font-medium text-hf-text-2 mt-0.5">{subtitle}</p>}
        </div>
      </div>

      <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-hf-surface border border-zinc-200/80 text-xs font-bold text-hf-text hover:bg-zinc-50 active:scale-[0.98] transition-all min-h-[44px] cursor-pointer shadow-xs"
            title="Atualizar dados"
          >
            <RefreshCw size={14} className={isRefreshing ? "animate-spin text-emerald-700" : "text-hf-text-2"} />
            <span className="hidden xs:inline">Atualizar</span>
          </button>
        )}
        {viewModeButton}
        {primaryActionButton}
      </div>
    </div>
  );
}

/**
 * Card de Atenção / Banners de Alertas com Cores Semânticas Padronizadas (Fundo Claro)
 * Red = Crítico / Atrasado / Falta
 * Amber = Alerta / Atenção / Vence Hoje
 * Green = Normal / Concluído / Em dia
 * Slate / Indigo = Informativo
 */
export function HubAttentionCard({
  variant = "slate",
  icon: Icon,
  title,
  subtitle,
  description,
  badge,
  actionButton,
  className = "",
}) {
  const variantStyles = {
    red: "bg-rose-50 border-rose-200 text-rose-900 shadow-xs",
    amber: "bg-amber-50 border-amber-200 text-amber-900 shadow-xs",
    green: "bg-emerald-50 border-emerald-200 text-emerald-900 shadow-xs",
    indigo: "bg-blue-50 border-blue-200 text-blue-900 shadow-xs",
    slate: "bg-hf-surface border-zinc-200/80 text-hf-text shadow-card",
  };

  const iconColors = {
    red: "bg-rose-100 text-rose-700",
    amber: "bg-amber-100 text-amber-700",
    green: "bg-emerald-100 text-emerald-700",
    indigo: "bg-blue-100 text-blue-700",
    slate: "bg-zinc-100 text-zinc-700",
  };

  return (
    <div
      className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all ${
        variantStyles[variant] || variantStyles.slate
      } ${className}`}
    >
      <div className="flex items-start sm:items-center gap-3.5">
        {Icon && (
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${iconColors[variant] || iconColors.slate}`}>
            <Icon size={20} />
          </div>
        )}
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-bold text-hf-text">{title}</p>
            {badge && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-white border border-zinc-200 text-zinc-800 shadow-2xs">
                {badge}
              </span>
            )}
          </div>
          {subtitle && <p className="text-xs font-medium text-hf-text-2 mt-0.5">{subtitle}</p>}
          {description && <div className="text-xs font-normal text-hf-text-2 mt-1 leading-relaxed">{description}</div>}
        </div>
      </div>

      {actionButton && <div className="shrink-0 self-end sm:self-center">{actionButton}</div>}
    </div>
  );
}

/**
 * Título de Seção Operacional com Ícone e Contador
 */
export function HubSectionHeader({
  icon: Icon,
  title,
  badgeText,
  badgeVariant = "slate",
  action,
  className = "",
}) {
  const badgeColors = {
    red: "bg-rose-50 text-rose-800 border-rose-200",
    amber: "bg-amber-50 text-amber-800 border-amber-200",
    green: "bg-emerald-50 text-emerald-800 border-emerald-200",
    slate: "bg-zinc-100 text-zinc-800 border-zinc-200",
  };

  return (
    <div className={`flex items-center justify-between gap-2 pb-1 ${className}`}>
      <div className="flex items-center gap-2">
        {Icon && <Icon size={16} className="text-hf-text-2 shrink-0" />}
        <h2 className="text-xs font-bold uppercase tracking-wider text-hf-text-2">
          {title}
        </h2>
        {badgeText && (
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${
              badgeColors[badgeVariant] || badgeColors.slate
            }`}
          >
            {badgeText}
          </span>
        )}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

/**
 * Container Padronizado de Card / Painel no Héfisto
 */
export function HubCardContainer({ children, className = "" }) {
  return (
    <div className={`p-4 sm:p-5 rounded-2xl bg-hf-surface border border-zinc-200/80 shadow-card text-hf-text ${className}`}>
      {children}
    </div>
  );
}

/**
 * Botão Operacional Padronizado (Garante Touch Target >= 44px)
 */
export function HubActionButton({
  children,
  onClick,
  variant = "secondary",
  icon: Icon,
  disabled = false,
  fullWidth = false,
  className = "",
  type = "button",
  ...props
}) {
  const variantStyles = {
    primary: "bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold shadow-sm active:scale-[0.98]",
    secondary: "bg-zinc-50 hover:bg-zinc-100 text-hf-text font-bold border border-zinc-200/80 active:scale-[0.98] shadow-2xs",
    outline: "bg-transparent hover:bg-emerald-50 text-emerald-800 font-bold border border-emerald-600/40 active:scale-[0.98]",
    danger: "bg-rose-600 hover:bg-rose-700 text-white font-extrabold shadow-sm active:scale-[0.98]",
    ghost: "bg-transparent hover:bg-zinc-100 text-hf-text-2 hover:text-hf-text",
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`min-h-[44px] px-4 py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
        fullWidth ? "w-full" : ""
      } ${disabled ? "opacity-50 cursor-not-allowed active:scale-100" : ""} ${
        variantStyles[variant] || variantStyles.secondary
      } ${className}`}
      {...props}
    >
      {Icon && <Icon size={16} className="shrink-0" />}
      <span>{children}</span>
    </button>
  );
}

/**
 * Skeleton Loader Padronizado para Skeletons Sem Quebras Visual
 */
export function HubSkeleton({ height = "h-20", lines = 1, className = "" }) {
  return (
    <div className={`space-y-3 ${className}`}>
      {Array.from({ length: lines }).map((_, idx) => (
        <div
          key={idx}
          className={`w-full rounded-2xl bg-zinc-100/70 border border-zinc-200/60 animate-pulse p-4 ${height}`}
        >
          <div className="h-4 bg-zinc-200/60 rounded w-1/3 mb-2" />
          <div className="h-3 bg-zinc-200/40 rounded w-2/3" />
        </div>
      ))}
    </div>
  );
}

/**
 * Componente de Erro de Seção Operacional Padronizado com Botão de Tentar Novamente
 */
export function HubErrorState({
  message = "Não foi possível carregar os dados desta seção.",
  onRetry,
  className = "",
}) {
  return (
    <div className={`p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between gap-3 shadow-xs ${className}`}>
      <div className="flex items-center gap-2">
        <AlertCircle size={18} className="text-rose-600 shrink-0" />
        <span className="font-semibold">{message}</span>
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-colors shrink-0 cursor-pointer shadow-xs"
        >
          Tentar novamente
        </button>
      )}
    </div>
  );
}

/**
 * Container de Lista Padronizado sem "Carditis" (Linhas limpas com divisores)
 */
export function HubListContainer({ children, className = "" }) {
  return (
    <div className={`divide-y divide-zinc-100 overflow-hidden ${className}`}>
      {children}
    </div>
  );
}

/**
 * Item de Lista Padronizado com Toque Amigável
 */
export function HubListItem({ children, onClick, className = "" }) {
  return (
    <div
      onClick={onClick}
      className={`py-3 px-2 flex items-center justify-between gap-3 transition-colors ${
        onClick ? "hover:bg-zinc-50 cursor-pointer rounded-xl" : ""
      } ${className}`}
    >
      {children}
    </div>
  );
}
