import type { ReactNode } from 'react';
import { FournisseurAi5d } from './react/contexte';
import { baseCompte } from './url';
import type { Ai5dSession } from './types';

/**
 * Le fournisseur, a poser dans le gabarit racine du produit :
 *
 *     const session = await getSession();
 *     return <Ai5dProvider valeur={session}>{children}</Ai5dProvider>;
 *
 * ── IL S EXECUTE AU SERVEUR, ET C EST TOUTE SA RAISON D ETRE ────────────────
 * Il n a PAS de directive `'use client'` : il lit `AI5D_ACCOUNT_URL` la ou elle existe,
 * c est-a-dire au serveur, et la transmet au fournisseur client avec la session.
 *
 * Sans lui, les trois composants du SDK liraient `process.env.AI5D_ACCOUNT_URL` dans le
 * navigateur, ou Next ne remplace QUE les variables prefixees `NEXT_PUBLIC_`. Chaque page
 * portant `<UserButton />` levait donc a l hydratation. Constat de la revue du gardien des
 * frontieres, verifie a la source de Next.
 *
 * L integrateur, lui, n a rien change : il pose le meme composant, avec la meme propriete,
 * et il n a toujours qu UNE variable d environnement a declarer.
 */
export function Ai5dProvider({
  valeur,
  children,
}: {
  valeur: Ai5dSession | null;
  children: ReactNode;
}) {
  return (
    <FournisseurAi5d valeur={{ session: valeur, portail: baseCompte() }}>
      {children}
    </FournisseurAi5d>
  );
}
