import { redirect } from "next/navigation";

export default function CardapioDigitalDesativadoPage() {
  redirect("/dashboard/operacao/fichas?dept=cozinha");
}
