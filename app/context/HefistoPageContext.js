"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import { searchNavigationRegistry } from "../lib/navigation-registry.mjs";

const HefistoPageContext = createContext(null);

export function HefistoPageContextProvider({ children, activeUnitId = "matriz", userSession = null }) {
  const pathname = usePathname();

  const [pageContext, setPageContextState] = useState({
    route: pathname || "/dashboard",
    navigationId: null,
    module: "geral",
    domain: "geral",
    entityType: null,
    entityId: null,
    entityName: null,
    companyId: activeUnitId || "matriz",
    availableActions: [],
    selectedEntity: null,
    attentionInsight: null
  });

  // Atualização ou mesclagem de contexto pela página/componente ativo
  const setPageContext = useCallback((partialContext = {}) => {
    setPageContextState(prev => ({
      ...prev,
      ...partialContext,
      updatedAt: Date.now()
    }));
  }, []);

  // Seleção explícita de entidade (produto, funcionário, ficha, conta)
  const setSelectedEntity = useCallback((entityObj = null) => {
    setPageContextState(prev => ({
      ...prev,
      selectedEntity: entityObj,
      entityType: entityObj?.type || prev.entityType,
      entityId: entityObj?.id || prev.entityId,
      entityName: entityObj?.name || entityObj?.nome || prev.entityName,
      updatedAt: Date.now()
    }));
  }, []);

  // Limpa entidade selecionada (preservando o domínio da rota)
  const clearSelectedEntity = useCallback(() => {
    setPageContextState(prev => ({
      ...prev,
      selectedEntity: null,
      entityType: null,
      entityId: null,
      entityName: null,
      updatedAt: Date.now()
    }));
  }, []);

  // Limpeza e re-inferência de contexto ao mudar de rota ou empresa
  useEffect(() => {
    const currentRoute = pathname || "/dashboard";

    // Dedução automática de módulo e domínio pela rota
    let domain = "geral";
    let module = "geral";

    if (currentRoute.includes("/estoque") || currentRoute.includes("/compras") || currentRoute.includes("/embalagens")) {
      domain = "estoque";
      module = "estoque";
    } else if (currentRoute.includes("/cozinha") || currentRoute.includes("/fichas") || currentRoute.includes("/producao") || currentRoute.includes("/montagem")) {
      domain = "cozinha";
      module = "cozinha";
    } else if (currentRoute.includes("/rh") || currentRoute.includes("/ponto") || currentRoute.includes("/colaborador")) {
      domain = "rh";
      module = "rh";
    } else if (currentRoute.includes("/financeiro") || currentRoute.includes("/dre") || currentRoute.includes("/cmv")) {
      domain = "financeiro";
      module = "financeiro";
    }

    setPageContextState(prev => ({
      ...prev,
      route: currentRoute,
      domain,
      module,
      companyId: activeUnitId || "matriz",
      // Limpa entidade ao navegar para nova rota
      selectedEntity: prev.route !== currentRoute ? null : prev.selectedEntity,
      entityType: prev.route !== currentRoute ? null : prev.entityType,
      entityId: prev.route !== currentRoute ? null : prev.entityId,
      entityName: prev.route !== currentRoute ? null : prev.entityName,
      updatedAt: Date.now()
    }));
  }, [pathname, activeUnitId]);

  // Limpeza estrita de contexto ao trocar de empresa/tenant
  useEffect(() => {
    setPageContextState(prev => ({
      ...prev,
      companyId: activeUnitId || "matriz",
      selectedEntity: null,
      entityType: null,
      entityId: null,
      entityName: null,
      updatedAt: Date.now()
    }));
  }, [activeUnitId]);

  return (
    <HefistoPageContext.Provider
      value={{
        pageContext,
        setPageContext,
        setSelectedEntity,
        clearSelectedEntity
      }}
    >
      {children}
    </HefistoPageContext.Provider>
  );
}

export function useHefistoPageContext() {
  const context = useContext(HefistoPageContext);
  if (!context) {
    return {
      pageContext: {
        route: "/dashboard",
        domain: "geral",
        module: "geral",
        companyId: "matriz",
        selectedEntity: null,
        entityType: null,
        entityId: null,
        entityName: null
      },
      setPageContext: () => {},
      setSelectedEntity: () => {},
      clearSelectedEntity: () => {}
    };
  }
  return context;
}
