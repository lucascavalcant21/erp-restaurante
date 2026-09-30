"use client";

// Fotos de RH em listas: pede ao servidor URLs assinadas curtas para os
// registros que têm foto gravada. Separado de rh-arquivos.js porque aquele
// módulo chega a rotas de servidor, onde hook de React não pode ser importado.

import { useEffect, useState } from "react";
import { urlsAssinadasRH } from "./rh-arquivos";

/**
 * Fotos de uma lista de registros: { [id]: url assinada }.
 * Só pede ao servidor os registros que têm foto gravada.
 */
export function useFotosRH(fonte, registros, campo = "foto_url") {
  const [fotos, setFotos] = useState({});
  const chave = (registros || []).filter((r) => r?.id != null && r?.[campo]).map((r) => `${r.id}:${r[campo]}`).join("|");

  useEffect(() => {
    let vivo = true;
    const itens = (registros || []).filter((r) => r?.id != null && r?.[campo]).map((r) => ({ fonte, id: r.id }));
    if (!itens.length) { setFotos({}); return undefined; }
    urlsAssinadasRH(itens).then((mapa) => {
      if (!vivo) return;
      const porId = {};
      for (const it of itens) {
        const url = mapa[`${fonte}:${it.id}`];
        if (url) porId[it.id] = url;
      }
      setFotos(porId);
    });
    return () => { vivo = false; };
    // `chave` resume ids e valores gravados: muda quando uma foto muda.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fonte, campo, chave]);

  return fotos;
}
