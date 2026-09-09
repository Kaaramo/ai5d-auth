import { baseCompte } from './url';
import { PortailIndisponibleErreur } from './erreurs';
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
 * Cinq secondes, et le chiffre est raisonne.
 *
 * Le portail repond a `/api/session` en dizaines de millisecondes : une lecture de session
 * et, au plus, une resolution d acces. Cinq secondes couvrent trois cas qui ne sont pas des
 * pannes — un demarrage a froid de fonction, une latence transatlantique, un pic de charge
 * — et refusent le quatrieme, qui en est une.
 *
 * Plus court punirait un demarrage a froid legitime. Plus long ne rend service a personne :
 * une page qui met plus de cinq secondes a s afficher est deja perdue pour son visiteur, et
 * l attente coute alors une fonction bloquee cote produit plutot qu une page rendue.
 */
const DELAI_MS = 5_000;

/**
 * Le nombre d appels effectues depuis le demarrage du processus.
 *
 * HORS PRODUCTION UNIQUEMENT, et jamais pour decider quoi que ce soit : il sert a la demo
 * a prouver que le cache par requete fonctionne. Un compteur par requete demanderait un
 * contexte de requete, c est-a-dire exactement ce que ce paquet evite d imposer.
 */
let appels = 0;

/**
 * Le compteur est INERTE en production, et pas seulement par convention.
 *
 * La premiere ecriture disait « hors production uniquement » en commentaire, et rien ne
 * l appliquait : le compteur et son export vivaient dans le paquet de production, dans le
 * fichier voisin de celui qui explique longuement qu une memoire de module ne doit jamais
 * survivre a la requete. Le prochain qui aurait ajoute « juste un dernier slug appele » a
 * cote n aurait enfreint aucune regle ecrite.
 *
 * Constat de la revue du gardien des frontieres, sprint 06.
 */
const COMPTE = process.env.NODE_ENV !== 'production';

export function appelsEffectues(): number {
  return appels;
}

export async function appelerPortail(
  cookie: string,
  produit: string | null,
): Promise<Ai5dSession | null> {
  const url = new URL(CHEMIN, `${baseCompte()}/`);
  if (produit !== null) url.searchParams.set('produit', produit);

  if (COMPTE) appels += 1;

  let reponse: Response;
  try {
    reponse = await fetch(url, {
      headers: { cookie },
      // Une session ne se met JAMAIS en cache : une reponse rejouee vaut une session volee.
      cache: 'no-store',
      /*
        LE DELAI MAXIMUM, ET IL MANQUAIT.

        Constat du sprint de consolidation, 9 septembre 2026.

        `PortailIndisponibleErreur` couvrait le REFUS de connexion, jamais le SILENCE. Un
        portail qui accepte la connexion et ne repond pas — pool Neon sature, fonction
        froide, incident reseau — suspendait donc le rendu jusqu au delai par defaut de la
        couche HTTP de Node, puis jusqu au plafond de duree de la fonction du produit.

        Cet appel est fait a CHAQUE requete de CHAQUE visiteur de CHAQUE produit AI5D. Sans
        borne, un portail lent ne degrade pas le portail : il fait tomber tout l ecosysteme,
        ce qui est exactement la promesse inverse de celle de ce paquet.

        La file de webhooks bornait deja ses appels sortants a dix secondes depuis le
        sprint 05. Le raisonnement etait juste ; il n avait pas ete applique ici.
      */
      signal: AbortSignal.timeout(DELAI_MS),
    });
  } catch {
    /*
      LE PORTAIL EST INJOIGNABLE.

      On LEVE, on ne rend pas `null`. La premiere ecriture rendait `null`, donc « pas
      connecte », et le raisonnement paraissait bon : degrader vers l anonyme plutot que de
      tomber en erreur.

      Il produisait une BOUCLE. `requireSession()` redirigeait vers `/connexion`, le
      middleware du portail voyait un cookie valide et renvoyait vers le produit, qui
      redemandait, qui reprenait la meme panne. La personne voyait
      `ERR_TOO_MANY_REDIRECTS`, jamais un ecran de connexion.

      Une indisponibilite n est pas une absence de session, et les confondre coute plus
      cher que de le dire. Constat de la revue du gardien, sprint 06.
    */
    throw new PortailIndisponibleErreur(null);
  }

  /*
    401 ET 403 SEULS VEULENT DIRE « PAS CONNECTE ».

    La route rend d ailleurs 200 avec `user: null` dans ce cas ; ces deux codes sont un
    filet pour un mandataire qui s interposerait. Tout le reste — 429, 5xx, un 404 qui
    dirait que la route a disparu — est une indisponibilite.
  */
  if (!reponse.ok) {
    if (reponse.status === 401 || reponse.status === 403) return null;
    throw new PortailIndisponibleErreur(reponse.status);
  }

  try {
    return versSession(await reponse.json());
  } catch {
    // Une charge illisible vient du portail, pas du visiteur : c est une panne.
    throw new PortailIndisponibleErreur(reponse.status);
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
    // Ni `externalRef`, ni `metadata` : la route de session ne les porte pas. Voir `types.ts`.
    accordeLe: new Date(String(a.grantedAt)),
    expireLe: expiresAt === null ? null : new Date(expiresAt),
  };
}
