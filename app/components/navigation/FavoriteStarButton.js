"use client";

import React, { useState, useEffect } from "react";
import { Star } from "lucide-react";
import { isFavorite, toggleFavoriteItem } from "../../lib/user-preferences.js";

export default function FavoriteStarButton({ itemId, sessao, className = "" }) {
  const [fav, setFav] = useState(false);

  useEffect(() => {
    if (itemId && sessao) {
      setFav(isFavorite(sessao, itemId));
    }
  }, [itemId, sessao]);

  useEffect(() => {
    const handleFavChange = (e) => {
      if (e.detail?.itemId === itemId) {
        setFav(!!e.detail.isFavorite);
      }
    };
    window.addEventListener("hefisto:favorites-changed", handleFavChange);
    return () => window.removeEventListener("hefisto:favorites-changed", handleFavChange);
  }, [itemId]);

  const handleToggle = (e) => {
    e.stopPropagation();
    e.preventDefault();
    if (!itemId || !sessao) return;

    const newState = toggleFavoriteItem(sessao, itemId);
    setFav(newState);

    // Toast de feedback instantâneo
    if (typeof window !== "undefined" && window.dispatchEvent) {
      const text = newState ? "Adicionado aos favoritos" : "Removido dos favoritos";
      window.dispatchEvent(
        new CustomEvent("erp:feedback", {
          detail: { texto: text, tipo: newState ? "ok" : "salvando", duracao: 1500 }
        })
      );
    }
  };

  const label = fav ? "Remover dos favoritos" : "Adicionar aos favoritos";

  return (
    <button
      type="button"
      onClick={handleToggle}
      aria-label={label}
      title={label}
      className={`
        w-9 h-9 flex items-center justify-center rounded-xl transition-all
        min-h-[44px] min-w-[44px] cursor-pointer
        ${fav
          ? "bg-amber-500/20 text-amber-400 border border-amber-500/40 hover:bg-amber-500/30"
          : "bg-slate-800/40 text-slate-400 border border-slate-700/40 hover:text-white hover:bg-slate-800"
        }
        ${className}
      `}
    >
      <Star
        size={18}
        className={`transition-transform duration-200 ${fav ? "fill-amber-400 text-amber-400 scale-110" : "fill-transparent text-slate-400"}`}
      />
    </button>
  );
}
