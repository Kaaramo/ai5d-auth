/**
 * Les types publics du SDK.
 *
 * Ils sont ecrits a la main, et non derives de better-auth. C est delibere : le jour ou la
 * V2 remplace le cookie partage par un fournisseur OIDC, ces types ne bougent pas, et les
 * produits qui les consomment non plus. L invariant I02 verifie qu aucun symbole de
 * better-auth ne fuit ici.
 */

export type StatutUtilisateur = 'ACTIVE' | 'SUSPENDED' | 'DELETION_REQUESTED';

export interface Ai5dUser {
  id: string;
  email: string;
  emailVerified: boolean;
  name: string | null;
  image: string | null;
  status: StatutUtilisateur;
}

export interface Ai5dSession {
  user: Ai5dUser;
  session: {
    id: string;
    expiresAt: Date;
  };
}
