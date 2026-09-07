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
