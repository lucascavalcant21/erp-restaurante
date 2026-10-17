"use client";

// Entrada do menu "Eventos": abre direto no funil. Agenda e reservas de mesa
// ficam na barra de áreas (layout.js).

import EventosKanban from "./eventos/EventosKanban";

export default function ReservasEventosOverview() {
  return <EventosKanban />;
}
