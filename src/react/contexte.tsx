'use client';

import { createContext, type ReactNode } from 'react';
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
 * ── `undefined` ET `null` NE DISENT PAS LA MEME CHOSE ───────────────────────
 * `undefined` veut dire « aucun fournisseur au-dessus », `null` veut dire « pas de
 * session ». Les distinguer permet aux hooks d avertir d un oubli sans lever, et sans
 * confondre un oubli avec un visiteur anonyme.
 */
export const ContexteAi5d = createContext<Ai5dSession | null | undefined>(undefined);

/**
 * Le fournisseur, a poser dans le gabarit racine du produit :
 *
 *     const session = await getSession();
 *     return <Ai5dProvider valeur={session}>{children}</Ai5dProvider>;
 */
export function Ai5dProvider({
  valeur,
  children,
}: {
  valeur: Ai5dSession | null;
  children: ReactNode;
}) {
  return <ContexteAi5d.Provider value={valeur}>{children}</ContexteAi5d.Provider>;
}
