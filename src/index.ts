/**
 * La surface publique du SDK AI5D.
 *
 * Elle est volontairement minuscule au Sprint 00. Sa raison d etre n est pas son contenu,
 * c est sa frontiere : le premier consommateur figera ce qu elle expose, et il sera alors
 * trop tard pour en decider.
 *
 * `requireSession()`, `getProductAccess()`, le middleware et les composants React arrivent
 * aux sprints 04 et 06.
 */
export { getSession } from './server';
export type { Ai5dSession, Ai5dUser, StatutUtilisateur } from './types';
