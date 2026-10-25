"use client"

import * as React from "react"

import { todayLocalISO } from "@/lib/format-utils"

/**
 * Jour civil local du navigateur (AAAA-MM-JJ), ou `null` au rendu serveur.
 *
 * Une page sans API dynamique est prérendue AU BUILD : un `new Date()` au
 * rendu y fige le jour du build, servi tel quel ensuite, et l'hydratation
 * échoue dès le lendemain (React #418, « Vendredi 23 octobre » servi le 25 sur
 * `/aujourdhui`, 2026-10-25). Ici, le snapshot serveur (`null`) sert au
 * prérendu ET à l'hydratation, puis React re-rend aussitôt avec le vrai jour ;
 * lors d'un montage purement client (navigation douce), le vrai jour est là
 * dès le premier rendu, sans image vide. Relu à chaque rendu (chaîne comparée
 * par valeur, donc stable dans la journée).
 */
const sansAbonnement = () => () => {}
const aucunJourAuServeur = () => null

export function useJourNavigateur(): string | null {
  return React.useSyncExternalStore(sansAbonnement, todayLocalISO, aucunJourAuServeur)
}
