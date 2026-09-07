/**
 * Les deux erreurs publiques du SDK.
 *
 * Elles portent de quoi rendre l ecran de refus SANS relire quoi que ce soit : un produit
 * les attrape dans sa frontiere d erreur et passe leurs champs a `<AccesRefuse />`.
 *
 * ── POURQUOI CE SONT DES ERREURS, ET NON UN COMPOSANT RENDU ─────────────────
 * `requireProductAccess()` ne peut pas « afficher l ecran de refus » : une fonction appelee
 * DEPUIS un composant serveur ne peut pas rendre quelque chose a la place de celui qui
 * l appelle. La documentation d integration donne donc les deux formes, et recommande la
 * forme explicite :
 *
 *     const acces = await getProductAccess('lab');
 *     if (acces.length === 0) return <AccesRefuse produit="Lab AI5D" />;
 *
 * Pretendre le contraire enverrait chaque integrateur decouvrir la limite tout seul, au pire
 * moment : en ecrivant sa page de refus.
 */

export class AccesRefuseErreur extends Error {
  readonly produit: string;
  /** Le nom de l organisation active, pour dire QUI peut lever le blocage. */
  readonly organisation: string | null;

  constructor(produit: string, organisation: string | null) {
    super(`Aucun acces au produit ${produit}.`);
    this.name = 'AccesRefuseErreur';
    this.produit = produit;
    this.organisation = organisation;
  }
}

export class RoleRefuseErreur extends Error {
  readonly requis: string;
  readonly organisation: string | null;

  constructor(requis: string, organisation: string | null) {
    super(
      organisation === null
        ? 'Aucune organisation active.'
        : `Role ${requis} requis dans ${organisation}.`,
    );
    this.name = 'RoleRefuseErreur';
    this.requis = requis;
    this.organisation = organisation;
  }
}

/**
 * Le portail n a pas repondu, ou a repondu qu il ne pouvait pas.
 *
 * ── POURQUOI CE N EST PAS « PAS CONNECTE » ──────────────────────────────────
 * Le transport rendait `null` sur TOUTE reponse non 2xx, y compris un 429 de limitation et
 * un 500. `requireSession()` redirigeait alors vers `/connexion`, ou le middleware du
 * portail voyait un cookie VALIDE et renvoyait aussitot vers le produit, qui redemandait,
 * qui reprenait 429.
 *
 * La personne ne voyait ni ecran de connexion ni message : elle voyait
 * `ERR_TOO_MANY_REDIRECTS` apres une vingtaine d aller-retours. Et sur une lecture de
 * droits, la meme panne disait « vous n avez pas acces » a des clients qui paient.
 *
 * Constat de la revue du gardien des frontieres, sprint 06.
 *
 * ── CE QU UN PRODUIT DOIT EN FAIRE ──────────────────────────────────────────
 * La traiter comme une INDISPONIBILITE, jamais comme une deconnexion. Une page publique
 * peut l ignorer et se rendre en anonyme ; une page protegee doit dire que le service est
 * momentanement indisponible, et surtout ne pas renvoyer vers la connexion.
 */
export class PortailIndisponibleErreur extends Error {
  /** Le code HTTP rendu par le portail, ou `null` quand il n a pas repondu du tout. */
  readonly statut: number | null;

  constructor(statut: number | null) {
    super(
      statut === null
        ? 'Le portail de comptes est injoignable.'
        : `Le portail de comptes a repondu ${statut}.`,
    );
    this.name = 'PortailIndisponibleErreur';
    this.statut = statut;
  }
}
