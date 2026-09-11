/**
 * Les URL du portail, construites a un seul endroit.
 *
 * Sans cette fonction, chaque produit concatenerait `AI5D_ACCOUNT_URL` avec un chemin a la
 * main, et l un d eux oublierait d encoder son `?redirect=`. Une URL de retour mal encodee
 * qui contient elle-meme un `?` perd tout ce qui suit : la personne revient sur la racine du
 * produit au lieu de la page qu elle demandait, et le defaut ne se voit que sur les URL a
 * parametres, donc jamais pendant les essais.
 *
 * Elle est PUBLIQUE, et ce n est pas un detail : les trois composants du SDK s en servent,
 * et un produit qui veut poser son propre lien vers le portail ne doit pas la reecrire.
 */

/** Les seuls hotes ou `http://` est tolere : le poste de travail. */
const HOTES_LOCAUX = new Set(['localhost', '127.0.0.1', '[::1]']);

/**
 * L adresse du portail, sans barre oblique finale.
 *
 * Elle LEVE quand la variable manque, et c est voulu : c est une erreur de deploiement, pas
 * un cas d execution. Rendre une valeur par defaut ferait pointer les liens vers nulle part,
 * et le produit fonctionnerait a moitie sans que personne ne comprenne pourquoi.
 */
export function baseCompte(): string {
  const brut = process.env.AI5D_ACCOUNT_URL;
  if (brut === undefined || brut.length === 0) {
    throw new Error(
      "AI5D_ACCOUNT_URL n'est pas defini. Posez-le sur l'adresse du portail de comptes AI5D.",
    );
  }

  /*
    LE PROTOCOLE SE CONTROLE ICI, ET NULLE PART AILLEURS. Version 1.0.2.

    C est le seul endroit du paquet qui lit la variable. Une adresse en clair enverrait le
    cookie de session de CHAQUE visiteur sans chiffrement, et rien ne le signalerait : le
    produit fonctionnerait. Le README l interdisait deja ; il n est plus le seul a le savoir.

    Remarque de la revue du gardien des frontieres, sprint 16.
  */
  let url: URL;
  try {
    url = new URL(brut);
  } catch {
    // Le message ne recopie JAMAIS la valeur recue : une URL peut porter un identifiant.
    throw new Error("AI5D_ACCOUNT_URL n'est pas une adresse valide. Attendu : https://…");
  }

  if (url.protocol !== 'https:' && !HOTES_LOCAUX.has(url.hostname)) {
    throw new Error(
      'AI5D_ACCOUNT_URL doit etre en https hors de localhost : le SDK envoie a cette adresse ' +
        'le cookie de session de chaque visiteur.',
    );
  }

  return brut.replace(/\/$/, '');
}

/**
 * L URL de retour, acceptee SEULEMENT si elle designe le meme hote que la requete en cours.
 *
 * ── LE TROU QU ELLE FERME ───────────────────────────────────────────────────
 * Le middleware pose `x-ai5d-url` et l ECRASE, mais seulement sur les chemins de son
 * `matcher`. Ailleurs, rien ne l ecrase : une requete portant
 * `x-ai5d-url: https://attaquant.fr/piege` faisait produire au SDK un `?redirect=` vers cet
 * hote. AI5D Compte le refuse, mais un SDK ne doit pas produire une valeur dont la surete
 * depend de la validation d autrui : c est le principe deja ecrit dans `middleware.ts`.
 *
 * Remarque de la revue du gardien des frontieres, sprint 16, fermee en 1.0.2.
 *
 * ── POURQUOI COMPARER AU `Host` SUFFIT ──────────────────────────────────────
 * Un tiers ne peut pas poser d en-tete dans une navigation qu il ne controle pas : le
 * navigateur de la personne visee envoie toujours le vrai `Host`. Sans secret partage entre
 * le portail et chaque produit, c est la seule comparaison qui tienne, et elle tient.
 *
 * Sans hote, ou sur un hote different, on rend `undefined` : le renvoi part alors sans
 * `?redirect=`, cas deja prevu et deja documente dans `server.ts`.
 */
export function retourSur(
  brut: string | null | undefined,
  hote: string | null,
): string | undefined {
  if (brut === null || brut === undefined || brut.length === 0) return undefined;
  if (hote === null || hote.length === 0) return undefined;
  try {
    // `host` porte le port quand il y en a un : deux ports sont deux hotes.
    return new URL(brut).host === hote ? brut : undefined;
  } catch {
    // Une adresse relative ou illisible : `new URL` leve, et c est le bon comportement.
    return undefined;
  }
}

/**
 * Une URL du portail, avec une destination de retour optionnelle.
 *
 * Le retour passe par `searchParams.set`, qui encode. Une concatenation manuelle, non : et
 * c est la seule raison d etre de cette fonction.
 */
export function urlPortail(chemin = '/', retour?: string): string {
  const url = new URL(chemin, `${baseCompte()}/`);
  if (retour !== undefined && retour.length > 0) {
    url.searchParams.set('redirect', retour);
  }
  return url.toString();
}
