import { cookiesRequete, entetesRequete, rediriger } from './requete';
import { lireSession } from './cache';
import { retourSur, urlPortail } from './url';
import { AccesRefuseErreur, PortailIndisponibleErreur, RoleRefuseErreur } from './erreurs';
import type { AccesProduit, Ai5dSession, OrganisationActive, RoleOrganisation } from './types';

/**
 * Les sept fonctions serveur du SDK.
 *
 * Ce paquet ne connait pas le moteur d authentification du portail et ne le connaitra
 * jamais : il parle au portail par HTTP, sur une route dont le portail decide la forme.
 * C est ce qui permettra a la V2 de remplacer le cookie partage par un fournisseur OIDC
 * sans qu aucun produit ne s en apercoive.
 *
 * ── L ECART DU SPRINT 00 SE REFERME ICI ─────────────────────────────────────
 * `getSession` prenait un cookie en argument obligatoire, faute de pouvoir lire l en-tete de
 * la requete courante : un paquet sans dependance n a pas de contexte de requete. Le
 * parametre reste, en dernier, pour les usages hors requete ; il n est plus necessaire.
 */

const COOKIE = 'ai5d.session_token';

/**
 * Le cookie de la requete courante, sous ses deux noms possibles.
 *
 * `__Secure-` apparait en HTTPS et pas en local : verifier les deux est la meme precaution
 * que prend le middleware du portail depuis le sprint 02. N en verifier qu un ferait
 * fonctionner le SDK en developpement et pas en production, ou l inverse.
 */
async function cookieCourant(): Promise<string | null> {
  const magasin = await cookiesRequete();
  const valeur = magasin.get(COOKIE) ?? magasin.get(`__Secure-${COOKIE}`);
  if (valeur === undefined) return null;
  return `${valeur.name}=${valeur.value}`;
}

/**
 * La session du visiteur, sans ses droits.
 *
 * Rend `null` sans cookie, SANS appeler le reseau : la grande majorite des requetes d un
 * produit public sont anonymes, et les faire toutes payer un aller-retour serait absurde.
 */
export async function getSession(cookieExplicite?: string): Promise<Ai5dSession | null> {
  const cookie = cookieExplicite ?? (await cookieCourant());
  if (cookie === null || cookie.length === 0) return null;

  /*
    ELLE AVALE L INDISPONIBILITE, ET `requireSession` NON.

    `getSession()` est appelee par les gabarits et les pages publiques, qui doivent
    s afficher meme quand le portail tousse : une panne y degrade vers l anonyme, ce qui
    est le bon comportement pour un en-tete ou un menu de compte.

    `requireSession()`, elle, laisse monter l erreur : rediriger vers la connexion pendant
    une panne fabrique une BOUCLE, puisque le portail voit un cookie valide et renvoie
    aussitot. Voir `PortailIndisponibleErreur`.
  */
  try {
    return await lireSession(cookie, null);
  } catch (erreur) {
    if (erreur instanceof PortailIndisponibleErreur) return null;
    throw erreur;
  }
}

/**
 * L URL de la page courante, pour y revenir apres connexion.
 *
 * ── ELLE VIENT DU MIDDLEWARE, ET DE NULLE PART AILLEURS ─────────────────────
 * Le middleware pose `x-ai5d-url` a partir de `requete.nextUrl`, c est-a-dire de ce que
 * Next a resolu, et il ECRASE l en-tete a chaque requete.
 *
 * La premiere ecriture la fabriquait en concatenant `x-forwarded-host`,
 * `x-forwarded-proto` et `x-matched-path` : trois valeurs qu un client peut poser, dont
 * aucune n etait validee, et dont la derniere porte le chemin APPARIE — donc `/lecon/[id]`
 * au lieu de `/lecon/12`. La promesse « on vous ramene ou vous etiez » etait fausse dans le
 * cas courant, et ouvrait une redirection au client dans le cas hostile.
 *
 * ── SANS L EN-TETE, ON NE MET AUCUN RETOUR ──────────────────────────────────
 * Le cas se produit quand le matcher du middleware ne couvre pas la page. On envoie alors
 * vers la connexion SANS `?redirect=` : la personne arrive sur l accueil de son compte
 * plutot que sur la page demandee, ce qui est un inconfort. Deviner une URL serait pire :
 * ce serait affirmer une destination qu on ne connait pas.
 */
async function urlCourante(): Promise<string | undefined> {
  const e = await entetesRequete();
  /*
    L EN-TETE EST CONFRONTE A L HOTE DE LA REQUETE. Version 1.0.2.

    Sur une page hors du `matcher`, le middleware ne s execute pas : rien n ecrase
    `x-ai5d-url`, et un client peut le poser lui-meme. `host`, lui, vient du navigateur de la
    personne : un tiers ne peut pas le choisir a sa place. Voir `retourSur`.
  */
  return retourSur(e.get('x-ai5d-url'), e.get('host'));
}

/**
 * La session, ou la connexion.
 *
 * C EST LA GARDE. Le middleware, lui, n en est pas une : il constate la presence d un
 * cookie sans le valider, et une valeur inventee le traverse. Un produit qui protegerait une
 * route uniquement par son matcher serait ouvert a quiconque pose un cookie du bon nom.
 */
export async function requireSession(): Promise<Ai5dSession> {
  const cookie = await cookieCourant();
  if (cookie === null || cookie.length === 0) {
    rediriger(urlPortail('/connexion', await urlCourante()));
  }

  /*
    L INDISPONIBILITE MONTE, ELLE NE REDIRIGE PAS.

    Le cookie est present : la personne EST connectee, et c est le portail qui ne repond
    pas. L envoyer sur `/connexion` la ferait rebondir indefiniment, le portail voyant une
    session valide et renvoyant ici. Une page d erreur est desagreable ; une boucle est
    inutilisable, et elle ne dit meme pas ce qui se passe.
  */
  const session = await lireSession(cookie, null);
  if (session === null) rediriger(urlPortail('/connexion', await urlCourante()));
  return session;
}

/**
 * Les droits du visiteur sur un produit. TOUJOURS un tableau, jamais `null`.
 *
 * Une personne peut en avoir DEUX vivants : un achat personnel et une licence d equipe. Le
 * socle ne dit jamais lequel est le meilleur, regle E2 : il faudrait pour cela savoir ce que
 * valent les plans, et la plateforme l ignore par construction. C est le produit qui
 * choisit, parce que lui seul le sait.
 */
export async function getProductAccess(slug: string): Promise<AccesProduit[]> {
  const cookie = await cookieCourant();
  if (cookie === null) return [];

  /*
    ELLE LAISSE MONTER L INDISPONIBILITE, contrairement a `getSession`.

    Rendre `[]` pendant une panne du portail dirait « vous n avez pas acces » a des clients
    qui paient, et le produit refermerait sa porte sans que rien ne signale la cause. Un
    tableau vide doit vouloir dire « aucun droit », et rien d autre.
  */
  const session = await lireSession(cookie, slug);
  return session?.acces ?? [];
}

/**
 * Les droits, ou l erreur de refus.
 *
 * Elle LEVE, elle ne rend pas d ecran : une fonction appelee depuis un composant serveur ne
 * peut pas rendre quelque chose a la place de celui qui l appelle. La forme explicite reste
 * recommandee par la documentation :
 *
 *     const acces = await getProductAccess('lab');
 *     if (acces.length === 0) return <AccesRefuse produit="Lab AI5D" />;
 */
export async function requireProductAccess(slug: string): Promise<AccesProduit[]> {
  const cookie = await cookieCourant();
  if (cookie === null) rediriger(urlPortail('/connexion', await urlCourante()));

  /*
    UN SEUL APPEL, ET C EST LA RAISON D ETRE DE CETTE FONCTION.

    `requireSession()` puis `getProductAccess()` demanderaient DEUX lectures : la premiere
    sans produit, la seconde avec, donc deux cles de cache differentes. En demandant les
    droits des le premier appel, on obtient la session ET les droits pour un aller-retour.
    C est ce que le compteur de la demo doit montrer : `1`, jamais `2`.
  */
  const session = await lireSession(cookie, slug);
  if (session === null) rediriger(urlPortail('/connexion', await urlCourante()));

  if (session.acces.length === 0) {
    throw new AccesRefuseErreur(slug, session.organisation?.nom ?? null);
  }
  return session.acces;
}

export async function getActiveOrganization(): Promise<OrganisationActive | null> {
  return (await getSession())?.organisation ?? null;
}

/**
 * La hierarchie des roles, celle du portail. JAMAIS une seconde definie ici.
 *
 * `peutAdministrer()` de `apps/compte/lib/roles.ts` repond vrai pour `owner` comme pour
 * `admin` : un proprietaire passe donc partout ou un administrateur est demande. Deux
 * hierarchies de roles dans un meme produit sont une elevation de privilege qui attend son
 * jour.
 */
const RANG: Record<RoleOrganisation, number> = { member: 0, admin: 1, owner: 2 };

/**
 * L organisation active, si le role y suffit.
 *
 * Elle accepte les capitales parce que le PRD 9.2 ecrit `requireRole('ADMIN')`. Refuser
 * cette forme donnerait un refus incomprehensible a qui recopie l exemple officiel, et la
 * normalisation coute une ligne. Ecart 0.8.
 */
export async function requireRole(
  role: RoleOrganisation | 'OWNER' | 'ADMIN' | 'MEMBER',
): Promise<OrganisationActive> {
  const requis = role.toLowerCase() as RoleOrganisation;
  const session = await requireSession();

  const organisation = session.organisation;
  if (organisation === null) throw new RoleRefuseErreur(requis, null);
  if (RANG[organisation.role] < RANG[requis]) {
    throw new RoleRefuseErreur(requis, organisation.nom);
  }
  return organisation;
}
