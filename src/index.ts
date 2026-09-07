/**
 * La surface publique du SDK AI5D.
 *
 * ── CE QU ELLE EST, ET CE QU ELLE NE SERA JAMAIS ────────────────────────────
 * Elle donne a un produit de quoi savoir QUI est devant lui, dans QUELLE organisation il
 * travaille, et A QUOI il a droit. Rien d autre.
 *
 * Elle n expose ni `signIn`, ni `signUp`, ni `signOut`, et ce n est pas un oubli : le
 * portail les porte. Un SDK qui les exposerait inviterait chaque produit a dessiner son
 * propre formulaire de connexion, et le PRD 2.3 dit pourquoi c est grave — « une rupture
 * graphique au moment ou l on saisit un mot de passe evoque l hameconnage ».
 *
 * Elle n expose pas non plus de lecture d un TIERS : lire les droits de quelqu un d autre
 * que le visiteur demande une cle produit, et passe par `/api/v1`. Deux surfaces, deux
 * authentifications.
 *
 * ── ELLE SE FIGE AVEC SON PREMIER CONSOMMATEUR ──────────────────────────────
 * Chaque produit qui l adopte fige ses signatures. Il vaut mieux exposer trop peu et
 * ajouter, qu exposer trop et devoir retirer.
 *
 * ── LA FRONTIERE, ET OU ELLE VIT DESORMAIS ──────────────────────────────────
 * Le paquet ne connait qu une seule route, `GET /api/session`, dont le PORTAIL decide la
 * forme. Il ne reparse plus la charge de la bibliotheque qui authentifie : celle-la
 * appartient a un tiers, et une montee de version qui la changerait aurait deconnecte tous
 * les produits sans faire echouer un seul test. Sprint 06, ecart 0.2.
 */

export {
  getActiveOrganization,
  getProductAccess,
  getSession,
  requireProductAccess,
  requireRole,
  requireSession,
} from './server';

export { urlPortail } from './url';

export { AccesRefuseErreur, RoleRefuseErreur } from './erreurs';

/** Hors production uniquement, pour prouver le cache par requete. Ne decide de rien. */
export { appelsEffectues } from './transport';

export type {
  AccesProduit,
  Ai5dSession,
  Ai5dUser,
  OrganisationActive,
  RoleOrganisation,
  SourceAcces,
  StatutAcces,
  StatutUtilisateur,
} from './types';
