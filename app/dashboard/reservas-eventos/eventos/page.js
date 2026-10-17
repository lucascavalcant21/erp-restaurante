"use client";

// Funil de eventos. Menus, catálogo de permissões e o "Voltar" do evento
// apontam para esta rota; o cabeçalho e a barra de áreas vêm do layout.js.

import EventosKanban from "./EventosKanban";

export default function FunilDeEventosPage() {
  return <EventosKanban />;
}
