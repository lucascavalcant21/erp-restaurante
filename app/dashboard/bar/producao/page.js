import { redirect } from "next/navigation";

export default function BarProducaoPage() {
  redirect("/dashboard/operacao/producao?dept=bar");
}
