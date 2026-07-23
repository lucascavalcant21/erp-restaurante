"use client";

import { useState, useEffect } from "react";
import { Briefcase, Plus, RefreshCw, FileText, Award } from "lucide-react";
import { PageHeader, PageBody, Toast } from "../../../components/ui";
import { useERP } from "../../../context/ERPContext";
import { fetchCargos, fetchColaboradores } from "../../../lib/rh";
import PlanoCargos from "../components/PlanoCargos";

export default function RhCargosPage() {
  const { unidadeAtiva, unidadeInfo } = useERP();
  const [cargos, setCargos] = useState([]);
  const [funcionarios, setFuncionarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toastMsg, setToastMsg] = useState("");

  async function carregar() {
    setLoading(true);
    const [c, f] = await Promise.all([
      fetchCargos(unidadeAtiva),
      fetchColaboradores(unidadeAtiva)
    ]);
    setCargos(c.data || []);
    setFuncionarios(f.data || []);
    setLoading(false);
  }

  useEffect(() => {
    carregar();
  }, [unidadeAtiva]);

  return (
    <div className="min-h-screen">
      <PageHeader
        title="Cargos & Funções"
        subtitle={`Plano de Carreiras, Atribuições e Salários · ${unidadeInfo?.nome || "Unidade"}`}
        icon={Briefcase}
      />
      <PageBody>
        <Toast show={!!toastMsg}>{toastMsg}</Toast>
        <PlanoCargos
          cargos={cargos}
          funcionarios={funcionarios}
          unidadeAtiva={unidadeAtiva}
          unidadeInfo={unidadeInfo}
          onRecarregar={carregar}
        />
      </PageBody>
    </div>
  );
}
