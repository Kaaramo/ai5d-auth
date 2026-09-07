'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { Ai5dSession } from '../types';

/**
 * Le contexte de session, POSE PAR LE SERVEUR.
 *
 * ── AUCUN HOOK N APPELLE LE RESEAU, ET C EST UNE DECISION DE SECURITE ───────
 * Un hook qui irait chercher la session lui-meme ferait un appel CROSS-ORIGIN AVEC COOKIES
 * depuis le navigateur. Il faudrait ouvrir CORS sur `/api/session`, donc l ouvrir a tout
 * script charge dans la page d un produit : une regie publicitaire, une balise d analyse,
 * une extension de navigateur. Aucun n a ete choisi par le produit, et chacun pourrait alors
 * lire l identite complete du visiteur.
 *
 * Pour un gain NUL : le serveur du produit a deja la session, il vient de la lire pour
 * rendre la page. Ecart 0.7 de la SPEC du sprint 06.
 *
 * ── LE CONTEXTE PORTE AUSSI L ADRESSE DU PORTAIL, ET C EST UN CORRECTIF ─────
 * Premiere ecriture : les trois composants appelaient `urlPortail()`, qui lit
 * `process.env.AI5D_ACCOUNT_URL`. Constat de la revue du gardien des frontieres, verifie a
 * la source de Next (`dist/lib/static-env.js`) : SEULES les variables prefixees
 * `NEXT_PUBLIC_` sont remplacees dans le paquet du navigateur.
 *
 * Consequence exacte : le rendu serveur passait, l hydratation levait, et la frontiere
 * d erreur remplacait la page par « une erreur est survenue » — sur CHAQUE page portant
 * `<UserButton />`, c est-a-dire toutes. Aucun test ne le voyait : sous Node, `process.env`
 * repond toujours.
 *
 * Renommer la variable en `NEXT_PUBLIC_…` aurait ete l autre correction, et elle est pire :
 * elle change le nom chez tous les integrateurs, et elle rend l adresse du portail publique
 * dans le paquet de chaque produit pour un besoin que le serveur couvre deja.
 *
 * ── `undefined` ET `null` NE DISENT PAS LA MEME CHOSE ───────────────────────
 * `undefined` veut dire « aucun fournisseur au-dessus », `null` veut dire « pas de
 * session ». Les distinguer permet aux hooks d avertir d un oubli sans lever, et sans
 * confondre un oubli avec un visiteur anonyme.
 */

export interface ValeurAi5d {
  session: Ai5dSession | null;
  /** L adresse du portail, lue au SERVEUR et transmise. Jamais lue dans le navigateur. */
  portail: string;
}

export const ContexteAi5d = createContext<ValeurAi5d | undefined>(undefined);

/**
 * Le fournisseur client, pose par `<Ai5dProvider>` qui, lui, s execute au serveur.
 *
 * Il n est pas exporte par `@ai5d/auth/react` : un produit ne doit jamais avoir a fournir
 * l adresse du portail a la main, sans quoi la promesse d une seule variable tombe.
 */
export function FournisseurAi5d({ valeur, children }: { valeur: ValeurAi5d; children: ReactNode }) {
  return <ContexteAi5d.Provider value={valeur}>{children}</ContexteAi5d.Provider>;
}

/**
 * L adresse du portail, pour les trois composants.
 *
 * Hors fournisseur, elle rend une chaine vide : les composants concernes ne rendent alors
 * aucun lien plutot que de lever. Une page publique qui a oublie le fournisseur doit
 * s afficher, pas tomber.
 */
export function usePortail(): string {
  return useContext(ContexteAi5d)?.portail ?? '';
}
