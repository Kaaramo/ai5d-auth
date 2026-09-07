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

/**
 * L adresse du portail, sans barre oblique finale.
 *
 * Elle LEVE quand la variable manque, et c est voulu : c est une erreur de deploiement, pas
 * un cas d execution. Rendre une valeur par defaut ferait pointer les liens vers nulle part,
 * et le produit fonctionnerait a moitie sans que personne ne comprenne pourquoi.
 */
export function baseCompte(): string {
  const url = process.env.AI5D_ACCOUNT_URL;
  if (url === undefined || url.length === 0) {
    throw new Error(
      "AI5D_ACCOUNT_URL n'est pas defini. Posez-le sur l'adresse du portail de comptes AI5D.",
    );
  }
  return url.replace(/\/$/, '');
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
