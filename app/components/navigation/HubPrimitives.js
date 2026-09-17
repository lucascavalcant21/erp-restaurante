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
    <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800/80 ${className}`}>
      <div className="flex items-center gap-3.5">
        {Icon && (
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/20 shadow-inner">
            <Icon size={28} />
          </div>
        )}
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] uppercase tracking-widest font-extrabold text-emerald-400">
              {domainTag}
            </span>
            <span className="text-slate-600">•</span>
            <span className="text-[11px] text-slate-400 font-medium">{unitName}</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            {title}
          </h1>
          {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
        </div>
      </div>

      <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs font-bold text-slate-300 hover:text-white hover:border-slate-700 active:scale-[0.98] transition-all min-h-[44px] cursor-pointer"
            title="Atualizar dados"
          >
            <RefreshCw size={15} className={isRefreshing ? "animate-spin text-emerald-400" : ""} />
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
 * Card de Atenção / Banners de Alertas com Cores Semânticas Padronizadas
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
    red: "bg-rose-950/30 border-rose-900/60 text-rose-200",
    amber: "bg-amber-950/30 border-amber-900/60 text-amber-200",
    green: "bg-emerald-950/20 border-emerald-900/40 text-emerald-200",
    indigo: "bg-indigo-950/30 border-indigo-900/60 text-indigo-200",
    slate: "bg-slate-900/80 border-slate-800 text-slate-300",
  };

  const iconColors = {
    red: "bg-rose-500/20 text-rose-400",
    amber: "bg-amber-500/20 text-amber-400",
    green: "bg-emerald-500/20 text-emerald-400",
    indigo: "bg-indigo-500/20 text-indigo-400",
    slate: "bg-slate-800 text-slate-300",
  };

  return (
    <div
      className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all shadow-sm ${
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
            <p className="text-sm font-bold text-white">{title}</p>
            {badge && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-white/10 text-white border border-white/20">
                {badge}
              </span>
            )}
          </div>
          {subtitle && <p className="text-xs opacity-80 mt-0.5">{subtitle}</p>}
          {description && <div className="text-xs opacity-90 mt-1">{description}</div>}
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
    red: "bg-rose-500/20 text-rose-300 border-rose-500/30",
    amber: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    green: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    slate: "bg-slate-800 text-slate-300 border-slate-700",
  };

  return (
    <div className={`flex items-center justify-between gap-2 pb-1 ${className}`}>
      <div className="flex items-center gap-2">
        {Icon && <Icon size={16} className="text-slate-400 shrink-0" />}
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300">
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
    <div className={`p-4 sm:p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 shadow-sm text-slate-100 ${className}`}>
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
    primary: "bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold shadow-md",
    secondary: "bg-slate-800 hover:bg-slate-700 text-slate-100 font-bold border border-slate-700/80",
    outline: "bg-transparent hover:bg-slate-800/60 text-slate-300 hover:text-white border border-slate-700",
    danger: "bg-rose-600 hover:bg-rose-500 text-white font-extrabold shadow-md",
    ghost: "bg-transparent hover:bg-slate-800/40 text-slate-400 hover:text-white",
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`min-h-[44px] px-4 py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer ${
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
          className={`w-full rounded-2xl bg-slate-900/60 border border-slate-800/80 animate-pulse p-4 ${height}`}
        >
          <div className="h-4 bg-slate-800 rounded w-1/3 mb-2" />
          <div className="h-3 bg-slate-800/60 rounded w-2/3" />
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
    <div className={`p-4 rounded-2xl bg-rose-950/30 border border-rose-900/60 text-rose-300 text-xs flex items-center justify-between gap-3 ${className}`}>
      <div className="flex items-center gap-2">
        <AlertCircle size={18} className="text-rose-400 shrink-0" />
        <span>{message}</span>
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="min-h-[44px] px-3 py-1.5 rounded-xl bg-rose-900/40 hover:bg-rose-900/60 text-rose-100 text-xs font-bold underline transition-colors shrink-0 cursor-pointer"
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
    <div className={`divide-y divide-slate-800/60 overflow-hidden ${className}`}>
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
        onClick ? "hover:bg-slate-800/30 cursor-pointer rounded-xl" : ""
      } ${className}`}
    >
      {children}
    </div>
  );
}
