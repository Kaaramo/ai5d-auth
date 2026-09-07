import { baseCompte } from './url';
import type {
  AccesProduit,
  Ai5dSession,
  Ai5dUser,
  OrganisationActive,
  RoleOrganisation,
  SourceAcces,
  StatutAcces,
  StatutUtilisateur,
} from './types';

/**
 * LE SEUL POINT DE SORTIE RESEAU DU PAQUET.
 *
 * Tout le reste du SDK est pur. C est ce qui le rend testable sans double de `fetch`
 * ailleurs qu ici, et surtout ce qui rend VISIBLE, en une lecture, qu il n existe qu un
 * chemin vers le portail. Un second `fetch` ajoute un jour dans un composant passerait
 * inapercu ; ici, il se voit.
 *
 * ── DEUX VOCABULAIRES SE CROISENT DANS CE FICHIER, ET C EST ASSUME ──────────
 * La charge HTTP porte les noms anglais de l API v1 — `product`, `subject`, `seats`,
 * `expiresAt` — parce qu elle est produite par `serialiserEffectif()` du sprint 05, qui est
 * aussi ce que `docs/api/v1.md` documente. Le type public, lui, porte les noms francais du
 * depot.
 *
 * Les deux alternatives ont ete ecartees. Dupliquer la serialisation pour produire une
 * charge en francais violerait la regle « une seule resolution », qui tient depuis le
 * sprint 04. Ecrire les types publics en anglais isolerait ce paquet du reste du depot.
 *
 * `versAcces` est donc LE SEUL endroit ou la traduction se fait, et l ecart est ecrit dans
 * la documentation d integration : un integrateur qui regarde l onglet reseau verra
 * `expiresAt` et lira `expireLe` dans son editeur.
 */

const CHEMIN = '/api/session';

/**
 * Le nombre d appels effectues depuis le demarrage du processus.
 *
 * HORS PRODUCTION UNIQUEMENT, et jamais pour decider quoi que ce soit : il sert a la demo
 * a prouver que le cache par requete fonctionne. Un compteur par requete demanderait un
 * contexte de requete, c est-a-dire exactement ce que ce paquet evite d imposer.
 */
let appels = 0;

export function appelsEffectues(): number {
  return appels;
}

export async function appelerPortail(
  cookie: string,
  produit: string | null,
): Promise<Ai5dSession | null> {
  const url = new URL(CHEMIN, `${baseCompte()}/`);
  if (produit !== null) url.searchParams.set('produit', produit);

  appels += 1;

  let reponse: Response;
  try {
    reponse = await fetch(url, {
      headers: { cookie },
      // Une session ne se met JAMAIS en cache : une reponse rejouee vaut une session volee.
      cache: 'no-store',
    });
  } catch {
    /*
      LE PORTAIL EST INJOIGNABLE.

      On rend `null`, donc « pas connecte », et non une levee. Le motif : une panne du
      portail doit degrader les produits vers l anonyme, pas les faire tomber en erreur 500.
      Le visiteur voit alors un ecran de connexion, ce qui est FAUX mais recuperable ; une
      page d erreur ne l est pas, et il n a rien a y faire.
    */
    return null;
  }

  if (!reponse.ok) return null;

  try {
    return versSession(await reponse.json());
  } catch {
    // Une charge illisible se traite comme une absence de session, pour la meme raison.
    return null;
  }
}

/** Vrai objet, non nul. Le repli de toutes les lectures defensives ci-dessous. */
function objet(valeur: unknown): Record<string, unknown> | null {
  return valeur !== null && typeof valeur === 'object' ? (valeur as Record<string, unknown>) : null;
}

function texteOuNull(valeur: unknown): string | null {
  return typeof valeur === 'string' ? valeur : null;
}

function versSession(charge: unknown): Ai5dSession | null {
  const brut = objet(charge);
  if (brut === null) return null;

  const u = objet(brut.user);
  const s = objet(brut.session);
  if (u === null || s === null) return null;

  const user: Ai5dUser = {
    id: String(u.id),
    email: String(u.email),
    emailVerified: u.emailVerified === true,
    name: texteOuNull(u.name),
    image: texteOuNull(u.image),
    status: (u.status as StatutUtilisateur | undefined) ?? 'ACTIVE',
  };

  /*
    AUCUN `{ ...brut }`, NULLE PART DANS CE FICHIER.

    Un champ que le portail ajouterait un jour traverserait jusqu aux produits sans qu une
    seule decision ait ete prise, et il figurerait alors dans une surface publique que
    personne n a relue. Chaque champ est recopie a la main, et c est le prix de la
    frontiere.
  */
  return {
    user,
    session: { id: String(s.id), expiresAt: new Date(String(s.expiresAt)) },
    organisation: versOrganisation(brut.organisation),
    acces: Array.isArray(brut.acces)
      ? brut.acces.map(versAcces).filter((a): a is AccesProduit => a !== null)
      : [],
    echu: versAcces(brut.echu),
  };
}

function versOrganisation(valeur: unknown): OrganisationActive | null {
  const o = objet(valeur);
  if (o === null) return null;
  return {
    id: String(o.id),
    nom: String(o.nom),
    identifiant: String(o.identifiant),
    // Le portail normalise deja ; le repli existe pour que le type soit total, et il choisit
    // le role le MOINS puissant : un role inconnu qui ouvrirait un droit serait une
    // elevation silencieuse. Meme raisonnement que `roleDepuisBase` du portail.
    role: (o.role as RoleOrganisation | undefined) ?? 'member',
  };
}

function versAcces(valeur: unknown): AccesProduit | null {
  const a = objet(valeur);
  if (a === null) return null;

  const sujet = objet(a.subject);
  if (sujet === null) return null;

  const expiresAt = texteOuNull(a.expiresAt);

  return {
    id: String(a.id),
    produit: String(a.product),
    sujet: {
      type: sujet.type === 'user' ? 'user' : 'organization',
      id: String(sujet.id),
    },
    statut: (a.status as StatutAcces | undefined) ?? 'ACTIVE',
    source: (a.source as SourceAcces | undefined) ?? 'MANUAL',
    plan: texteOuNull(a.plan),
    sieges: typeof a.seats === 'number' ? a.seats : null,
    referenceExterne: texteOuNull(a.externalRef),
    metadonnees: a.metadata ?? null,
    accordeLe: new Date(String(a.grantedAt)),
    expireLe: expiresAt === null ? null : new Date(expiresAt),
  };
}
