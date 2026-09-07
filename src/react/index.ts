/**
 * La surface CLIENT du SDK.
 *
 * Elle est separee de la surface serveur pour une raison mecanique : `server.ts` importe
 * `next/headers`, qui n existe pas dans un navigateur. Les melanger dans un seul point
 * d entree ferait entrer du code serveur dans le paquet client au premier import.
 *
 * Rien ici n appelle le reseau. Les trois crochets lisent ce que le serveur a pose dans
 * `<Ai5dProvider>`, et les trois composants lisent les crochets.
 */

export { Ai5dProvider, ContexteAi5d } from './contexte';
export { useActiveOrganization, useProductAccess, useSession } from './hooks';

export { AccesRefuse } from './AccesRefuse';
export type { ProprietesAccesRefuse } from './AccesRefuse';

export { OrganizationSwitcher } from './OrganizationSwitcher';
export { UserButton } from './UserButton';

export type {
  AccesProduit,
  Ai5dSession,
  Ai5dUser,
  OrganisationActive,
  RoleOrganisation,
  SourceAcces,
  StatutAcces,
  StatutUtilisateur,
} from '../types';
