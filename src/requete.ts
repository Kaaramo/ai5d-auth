import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';

/**
 * Les trois passe-plats vers Next, et ils ont une seule raison d etre.
 *
 * ── LA LECON, RESSERVIE POUR LA QUATRIEME FOIS ──────────────────────────────
 * Sous l isolation stricte de pnpm, un `vi.mock` sur un module de Next ecrit depuis la
 * racine du depot ne s applique pas de facon fiable aux modules qui resolvent leur propre
 * copie. Le portail a rencontre le probleme au sprint 01 sur Upstash, puis deux fois au
 * sprint 05, et sa reponse est `apps/compte/lib/contexte.ts` : on double un fichier QUI
 * NOUS APPARTIENT, jamais un paquet.
 *
 * Ce fichier est la meme reponse, pour le meme motif, du cote du SDK. Sans lui,
 * `server.ts` ne serait pas testable, et un SDK d authentification non teste est un SDK
 * dont personne ne connait le comportement aux limites.
 *
 * ── ILS NE FONT RIEN D AUTRE QUE PASSER ─────────────────────────────────────
 * Aucune logique ici. Toute ligne ajoutee dans ce fichier serait une ligne non testee.
 */

export async function cookiesRequete(): Promise<Awaited<ReturnType<typeof cookies>>> {
  return cookies();
}

export async function entetesRequete(): Promise<Awaited<ReturnType<typeof headers>>> {
  return headers();
}

export function rediriger(url: string): never {
  return redirect(url);
}
