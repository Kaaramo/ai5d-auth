'use client';

import { useContext } from 'react';
import { ContexteAi5d } from './contexte';
import type { AccesProduit, Ai5dSession, OrganisationActive } from '../types';

/**
 * Les trois crochets client. AUCUN n appelle le reseau.
 *
 * ── IL N Y A PAS D `isLoading`, ET C EST VOULU ──────────────────────────────
 * La session est la au premier rendu, ou elle est `null`. Le serveur l a deja lue. Un
 * integrateur ecrira `if (isLoading)` par reflexe, parce que c est l habitude prise chez les
 * concurrents : la documentation le dit avant qu il ne le cherche.
 *
 * ── HORS FOURNISSEUR, ILS RENDENT VIDE PLUTOT QUE DE LEVER ──────────────────
 * Un composant partage entre une page protegee et une page publique existe dans les deux.
 * Une levee transformerait l oubli du fournisseur sur la page publique en PAGE BLANCHE,
 * alors que la bonne reponse est « pas de session », qui est vraie.
 *
 * L avertissement en developpement dit ou est l oubli sans rien casser.
 */

function contexte(nom: string): Ai5dSession | null {
  const valeur = useContext(ContexteAi5d);
  if (valeur === undefined) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(
        `[ai5d] ${nom} est appele hors de <Ai5dProvider>. Il rend une valeur vide. ` +
          'Posez le fournisseur dans le gabarit racine du produit.',
      );
    }
    return null;
  }
  return valeur;
}

export function useSession(): Ai5dSession | null {
  return contexte('useSession');
}

export function useActiveOrganization(): OrganisationActive | null {
  return contexte('useActiveOrganization')?.organisation ?? null;
}

/**
 * Les droits sur le produit COURANT, ceux que le serveur a lus.
 *
 * Elle ne prend pas de slug, et c est delibere : accepter un slug laisserait croire qu un
 * composant client peut demander les droits d un autre produit, ce que rien dans le contexte
 * ne lui permet. Il rendrait alors un tableau vide, ce qui se lit comme « aucun droit »
 * plutot que comme « mauvaise question ».
 */
export function useProductAccess(): AccesProduit[] {
  return contexte('useProductAccess')?.acces ?? [];
}
