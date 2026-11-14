"use client";

// Assinatura da empresa de quem está logado (db/SAAS_PLANOS_1_ASSINATURA.sql).
// A empresa sai do banco (hefisto_minha_assinatura usa auth.uid()), nunca do
// navegador. Sem a migração aplicada ou sem linha, devolve null: aí nada é
// trancado e a conta mostra "Não registrado" (app/lib/planos.mjs).

import { useEffect, useState } from "react";
import { supabase, isSupabaseReady } from "./supabase";

let cache = { chave: null, promessa: null };

export function lerMinhaAssinatura(usuarioId) {
  if (!isSupabaseReady() || !usuarioId) return Promise.resolve(null);
  if (cache.chave === usuarioId && cache.promessa) return cache.promessa;
  cache = {
    chave: usuarioId,
    promessa: supabase
      .rpc("hefisto_minha_assinatura")
      .then(({ data, error }) => (error || !data ? null : data))
      .catch(() => null),
  };
  return cache.promessa;
}

/** undefined enquanto carrega; null sem assinatura registrada; objeto quando há. */
export function useMinhaAssinatura(sessao) {
  const id = sessao?.erp_user_id || sessao?.id || null;
  const [assinatura, setAssinatura] = useState(undefined);
  useEffect(() => {
    let vivo = true;
    if (!id) { setAssinatura(null); return undefined; }
    lerMinhaAssinatura(id).then((a) => { if (vivo) setAssinatura(a); });
    return () => { vivo = false; };
  }, [id]);
  return assinatura;
}
