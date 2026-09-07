import { NextResponse, type NextRequest } from 'next/server';
import { urlPortail } from './url';

/**
 * L aiguillage vers la connexion. CE N EST PAS UNE GARDE.
 *
 * ── LA PHRASE QUI DOIT ETRE LUE AVANT TOUTE AUTRE ───────────────────────────
 * Ce middleware constate la PRESENCE d un cookie. Il ne le valide pas. Une valeur inventee
 * de toutes pieces le traverse.
 *
 * Un produit qui protegerait une route uniquement par le matcher de ce middleware serait
 * ouvert a quiconque pose un cookie nomme `ai5d.session_token` avec n importe quel contenu.
 * C est la faute la plus probable d une integration rapide, et c est pourquoi elle est
 * ecrite trois fois : ici, dans la SPEC, et dans la documentation d integration.
 *
 * LA GARDE EST `requireSession()` DANS LA PAGE, et elle seule.
 *
 * ── POURQUOI IL NE VALIDE PAS ───────────────────────────────────────────────
 * Valider demanderait un appel reseau au portail A CHAQUE NAVIGATION, y compris sur ce que
 * le matcher laisse passer par erreur. Le middleware du portail a tranche la meme question
 * au sprint 02, avec le meme motif : « il lit le cookie, et rien d autre ».
 *
 * S y ajoute ici une dependance de disponibilite : le produit deviendrait indisponible des
 * que le portail tousse, alors qu il pourrait servir ses pages publiques.
 *
 * Consequence assumee : un cookie perime traverse, et la page le rejette. C est le bon
 * endroit, parce que la page a la session complete et peut afficher quelque chose.
 */

const COOKIE = 'ai5d.session_token';

/** `__Secure-` apparait en HTTPS. Les deux noms existent selon l environnement. */
function aUnCookie(requete: NextRequest): boolean {
  return requete.cookies.has(COOKIE) || requete.cookies.has(`__Secure-${COOKIE}`);
}

/**
 * Le middleware, avec ses chemins publics.
 *
 * `publiques` n ajoute aucune capacite : elle laisse seulement declarer des chemins que le
 * matcher couvre mais qui doivent rester ouverts. Un produit dont le matcher est large et
 * qui a deux pages publiques dedans n a pas a ecrire son propre middleware pour cela.
 */
export function creerAi5dMiddleware(options: { publiques?: string[] } = {}) {
  const publiques = options.publiques ?? [];

  return function middleware(requete: NextRequest): NextResponse {
    const chemin = requete.nextUrl.pathname;

    if (publiques.some((p) => chemin === p || chemin.startsWith(`${p}/`))) {
      return NextResponse.next();
    }

    if (aUnCookie(requete)) return NextResponse.next();

    /*
      La destination de retour vient de `nextUrl`, JAMAIS de `requete.url`.

      Derriere un mandataire, `requete.url` porte l hote INTERNE : le retour pointerait une
      machine que le visiteur ne peut pas joindre, et il verrait une erreur de connexion
      apres s etre authentifie. `nextUrl` porte l adresse que le visiteur a demandee.
    */
    return NextResponse.redirect(urlPortail('/connexion', requete.nextUrl.toString()));
  };
}

/**
 * Le middleware pret a l emploi, celui du PRD 9.2 :
 *
 *     export { ai5dAuthMiddleware as middleware } from '@ai5d/auth/middleware';
 *     export const config = { matcher: ['/espace/:path*'] };
 *
 * Il est cree au chargement du module, mais `urlPortail()` n est appelee qu a la premiere
 * REPONSE : lever a l import ferait echouer la construction d un produit qui n a pas encore
 * pose sa variable, avec un message que Next noierait dans sa propre pile.
 */
export const ai5dAuthMiddleware = creerAi5dMiddleware();
