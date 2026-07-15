import { redirect } from "next/navigation";

export default function CozinhaProducaoPage() {
  redirect("/dashboard/operacao/producao?dept=cozinha");
}
