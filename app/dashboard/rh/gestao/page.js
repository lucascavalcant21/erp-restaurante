"use client";

// "Gestão de Equipe" antiga: a lista vinha de fetchFuncionarios(), que sempre
// devolve vazio, e o formulário paralelo gravava em `colaboradores` com outra
// tabela de contratos e outros nomes de campo. Um formulário só (HDEV-RH-001,
// Fase 1): o quadro de colaboradores do RH, onde Editar e Novo usam a mesma
// edição.

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function GestaoEquipeAntiga() {
  const router = useRouter();
  useEffect(() => { router.replace("/dashboard/rh?aba=quadro"); }, [router]);
  return null;
}
