import type { Ai5dSession, Ai5dUser, StatutUtilisateur } from './types';

/**
 * Lit la session courante.
 *
 * Ce paquet ne connait pas better-auth et ne le connaitra jamais : il parle au portail par
 * HTTP. C est ce qui permettra a un produit tiers, sur son propre domaine, d utiliser
 * exactement le meme code.
 *
 * ECART ASSUME par rapport a la spec 5.6, consigne au 8 de la spec technique :
 *
 *   1. La signature prend un parametre optionnel `cookie`. Sans framework, un paquet sans
 *      dependance ne peut pas lire l en-tete de la requete courante. Appele sans argument
 *      il rend null. Le type `() => Promise<Ai5dSession | null>` reste satisfait.
 *   2. La mise en cache pour la duree de la requete n est pas implementee : elle demande
 *      un contexte de requete, qui arrive avec le middleware du Sprint 06.
 */

const CHEMIN = '/api/auth/get-session';

function baseUrl(): string {
  const url = process.env.AI5D_ACCOUNT_URL ?? process.env.NEXT_PUBLIC_APP_URL;
  if (url === undefined || url.length === 0) {
    throw new Error("AI5D_ACCOUNT_URL n'est pas defini");
  }
  return url.replace(/\/$/, '');
}

/** Rend la forme AI5D a partir de la reponse du portail, sans rien lui emprunter d autre. */
function versSession(charge: unknown): Ai5dSession | null {
  if (charge === null || typeof charge !== 'object') return null;
  const brut = charge as Record<string, unknown>;
  const utilisateur = brut.user as Record<string, unknown> | undefined;
  const session = brut.session as Record<string, unknown> | undefined;
  if (utilisateur === undefined || session === undefined) return null;

  const user: Ai5dUser = {
    id: String(utilisateur.id),
    email: String(utilisateur.email),
    emailVerified: utilisateur.emailVerified === true,
    name: typeof utilisateur.name === 'string' ? utilisateur.name : null,
    image: typeof utilisateur.image === 'string' ? utilisateur.image : null,
    status: (utilisateur.status as StatutUtilisateur | undefined) ?? 'ACTIVE',
  };

  return {
    user,
    session: { id: String(session.id), expiresAt: new Date(String(session.expiresAt)) },
  };
}

export async function getSession(cookie?: string): Promise<Ai5dSession | null> {
  if (cookie === undefined || cookie.length === 0) return null;

  const reponse = await fetch(`${baseUrl()}${CHEMIN}`, {
    headers: { cookie },
    // Une session ne se met jamais en cache : une reponse rejouee vaut une session volee.
    cache: 'no-store',
  });

  if (!reponse.ok) return null;
  return versSession(await reponse.json());
}
