'use client';

/**
 * Un lien vers le portail, construit dans le NAVIGATEUR.
 *
 * ── POURQUOI IL NE REUTILISE PAS `urlPortail` DU SERVEUR ────────────────────
 * `urlPortail()` lit `process.env.AI5D_ACCOUNT_URL`, que Next ne remplace PAS dans le
 * paquet du navigateur : seules les variables prefixees `NEXT_PUBLIC_` y sont inlinees.
 * Les composants clients recoivent donc l adresse par le contexte, et la construisent ici.
 *
 * ── L ENCODAGE EST TOUTE SA RAISON D ETRE ───────────────────────────────────
 * Une concatenation manuelle perdrait tout ce qui suit un `?` deja present dans l URL de
 * retour, et la personne reviendrait sur la racine du produit au lieu de la page qu elle
 * avait ouverte. Le defaut ne se voit que sur les URL a parametres, donc jamais pendant les
 * essais.
 *
 * ── SANS FOURNISSEUR, IL REND LE CHEMIN NU ──────────────────────────────────
 * Le composant affiche alors un lien relatif qui ne mene nulle part d utile, plutot que de
 * lever. Une page publique qui a oublie le fournisseur doit s afficher.
 */
export function lienPortail(portail: string, chemin: string, retour?: string): string {
  if (portail.length === 0) return chemin;
  const url = new URL(chemin, `${portail}/`);
  if (retour !== undefined && retour.length > 0) url.searchParams.set('redirect', retour);
  return url.toString();
}
