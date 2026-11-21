"use client";

// Base do consultório: acesso, tipos de consulta, convênios e a configuração
// de custos. Uma carga por entrada na área; recarregar() depois de salvar.

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { fetchBase, temAcesso } from "../../lib/consultorio/dados";
import { useERP } from "../../context/ERPContext";

const Ctx = createContext(null);

export function ConsultorioProvider({ children }) {
  const { sessao } = useERP();
  const [estado, setEstado] = useState({ carregando: true, acesso: null, tipos: [], convenios: [], config: null, erro: null });
  const carregar = useCallback(async () => {
    const a = await temAcesso();
    if (!a.data) { setEstado((s) => ({ ...s, carregando: false, acesso: false, erro: a.error })); return; }
    const b = await fetchBase();
    setEstado({ carregando: false, acesso: true, tipos: b.tipos, convenios: b.convenios, config: b.config, erro: b.error });
  }, []);
  useEffect(() => { if (sessao) carregar(); }, [sessao, carregar]);
  const valor = useMemo(() => ({
    ...estado,
    meuId: sessao?.id || null,
    tiposAtivos: estado.tipos.filter((t) => t.ativo),
    conveniosAtivos: estado.convenios.filter((c) => c.ativo),
    recarregar: carregar,
  }), [estado, sessao, carregar]);
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export const useConsultorio = () => useContext(Ctx) || {};
