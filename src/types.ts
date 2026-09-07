/**
 * Les types publics du SDK.
 *
 * Ils sont ecrits a la main, et non derives de la bibliotheque qui authentifie aujourd hui.
 * C est delibere : le jour ou la V2 remplace le cookie partage par un fournisseur OIDC, ces
 * types ne bougent pas, et les produits qui les consomment non plus. L invariant I02
 * verifie qu aucun symbole du moteur ne fuit ici.
 *
 * ── CE QUE LE SPRINT 06 AJOUTE, ET POURQUOI CE N EST PAS UNE RUPTURE ────────
 * `Ai5dSession` portait deux champs au sprint 00 ; elle en porte quatre. Ajouter un champ a
 * une interface n est une rupture que pour qui la CONSTRUIT, et il n existe aucun
 * constructeur hors de ce paquet.
 *
 * ── LES DATES SONT DES `Date`, JAMAIS DES CHAINES ───────────────────────────
 * Le portail les rend en ISO 8601. La conversion se fait UNE FOIS, dans `transport.ts`.
 * La laisser a chaque produit garantirait que l un d eux compare des chaines un jour, et
 * qu il le fasse sur une echeance.
 */

export type StatutUtilisateur = 'ACTIVE' | 'SUSPENDED' | 'DELETION_REQUESTED';

/**
 * Les trois roles, en MINUSCULES.
 *
 * Ce ne sont pas des valeurs choisies : c est la forme que la base compare. Les ecrire en
 * capitales ferait echouer chaque verification de droit SANS qu aucun parcours normal ne
 * bouge. Lecon du sprint 03, `apps/compte/lib/roles.ts`.
 *
 * `requireRole` accepte neanmoins les capitales, parce que le PRD 9.2 ecrit
 * `requireRole('ADMIN')` et qu un integrateur qui recopie l exemple officiel doit tomber
 * juste. Ecart 0.8 de la SPEC du sprint 06.
 */
export type RoleOrganisation = 'owner' | 'admin' | 'member';

export type StatutAcces = 'ACTIVE' | 'EXPIRED' | 'REVOKED';

export type SourceAcces = 'PURCHASE' | 'ORG_LICENSE' | 'TRIAL' | 'MANUAL' | 'MIGRATION';

export interface Ai5dUser {
  id: string;
  email: string;
  emailVerified: boolean;
  name: string | null;
  image: string | null;
  status: StatutUtilisateur;
}

export interface OrganisationActive {
  id: string;
  nom: string;
  identifiant: string;
  role: RoleOrganisation;
}

/**
 * Un droit, tel qu un produit le lit.
 *
 * ── LE SUJET EST CELUI DE L ACCES, PAS CELUI DE LA QUESTION ─────────────────
 * Une personne qui herite d une licence d equipe recoit une ligne dont le sujet est
 * l ORGANISATION. Le produit sait donc d ou vient le droit sans rien recalculer, et sans
 * avoir a deviner que l absence d un champ signifie l heritage.
 *
 * ── DEUX CHAMPS QUE LA PLATEFORME NE LIT JAMAIS ─────────────────────────────
 * `plan` est opaque, regle E1 : le socle ne sait pas ce que vaut « pro-annuel », et il ne
 * le saura jamais. `sieges` est declaratif, regle R20 : il est stocke et rendu, jamais
 * applique. Un produit qui veut appliquer ses sieges compte les membres lui-meme, par
 * `GET /api/v1/organizations/:id/members`.
 */
export interface AccesProduit {
  id: string;
  produit: string;
  sujet: { type: 'user' | 'organization'; id: string };
  statut: StatutAcces;
  source: SourceAcces;
  /** Opaque. La plateforme ne le lit jamais, et ne le comparera jamais. Regle E1. */
  plan: string | null;
  /** Declaratif. Stocke et rendu, jamais applique. Regle R20. */
  sieges: number | null;
  referenceExterne: string | null;
  metadonnees: unknown;
  accordeLe: Date;
  expireLe: Date | null;
}

export interface Ai5dSession {
  user: Ai5dUser;
  session: { id: string; expiresAt: Date };
  /** L organisation dans laquelle la personne travaille. `null` quand il n y en a pas. */
  organisation: OrganisationActive | null;
  /**
   * Les droits sur le produit demande. TOUJOURS un tableau, jamais `null`.
   *
   * Vide quand aucun produit n a ete demande, et vide quand la personne n a aucun droit :
   * les deux cas se traitent pareil, et un appelant qui les distinguerait finirait par
   * traiter l un des deux de travers.
   */
  acces: AccesProduit[];
  /**
   * Le dernier acces ECHU sur le produit demande, quand il n en reste aucun de vivant.
   *
   * Il existe pour une seule raison, et elle vaut d etre dite : sans lui, le troisieme cas
   * de `<AccesRefuse />` — « votre acces a pris fin le 20 aout » — ne serait ATTEIGNABLE PAR
   * AUCUN CHEMIN, puisque les droits rendus sont les vivants. Le composant existerait, il
   * serait teste, et rien ne l appellerait jamais.
   *
   * C est mot pour mot le defaut du sprint 04, trouve a la revue au navigateur et non par un
   * test. On ne le refait pas.
   *
   * `null` des qu un acces vivant existe : deux etats a la fois ne veulent rien dire.
   */
  echu: AccesProduit | null;
}
