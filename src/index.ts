/**
 * La surface publique du SDK AI5D.
 *
 * Elle est volontairement minuscule au Sprint 00. Sa raison d etre n est pas son contenu,
 * c est sa frontiere : le premier consommateur figera ce qu elle expose, et il sera alors
 * trop tard pour en decider.
 *
 * `requireSession()`, le middleware et les composants React arrivent au sprint 06.
 *
 * `getProductAccess()` arrive au sprint 05, et NON au sprint 04 comme cette ligne
 * l annoncait. Toutes les routes de lecture d acces du PRD 9.1 sont authentifiees PAR CLE
 * PRODUIT, et les cles arrivent la-bas : exposer une lecture d acces sur la seule foi du
 * cookie de session aurait ouvert une surface que le sprint suivant devrait refermer.
 *
 * Le sprint 04 livre la resolution, testee, consommee par ses deux ecrans. Elle vit dans
 * `apps/compte/lib/acces.ts`, du cote du portail, ou une session la borne.
 */
export { getSession } from './server';
export type { Ai5dSession, Ai5dUser, StatutUtilisateur } from './types';
