import { redirect } from "next/navigation";

// A antiga tela de drinks mantinha um cadastro separado das fichas técnicas.
// Todo o Bar agora vive no receituário integrado, evitando dados duplicados.
export default function DrinksPage() {
  redirect("/dashboard/operacao/fichas?dept=bar");
}
