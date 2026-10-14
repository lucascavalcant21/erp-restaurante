import { redirect } from "next/navigation";

// O Portal do colaborador virou a aba "Quadro de Funcionários" do RH. O
// endereço antigo continua existindo (favoritos, hub de módulos e a entrada
// rh.employee_portal do catálogo de permissões) e leva para a aba nova.
export default function PortalDoColaborador() {
  redirect("/dashboard/rh?aba=quadro");
}
