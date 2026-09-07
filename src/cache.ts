import { cache } from 'react';
import { appelerPortail } from './transport';

/**
 * Le cache par requete, exige par le PRD 9.2.
 *
 * Sans lui, un gabarit qui lit la session, une page qui la relit et un composant qui lit les
 * droits font TROIS appels reseau pour rendre un ecran. C est le genre de cout qu on ne voit
 * pas en developpement, ou l on est seul et ou la latence est nulle.
 *
 * ── LA CLE CONTIENT LE COOKIE, ET C EST VITAL ───────────────────────────────
 * `cache()` de React indexe sur les ARGUMENTS. Comme le cookie est le premier, deux
 * visiteurs ne partagent jamais rien.
 *
 * Un cache indexe sur le seul slug de produit servirait la session d un visiteur a un autre
 * des que deux rendus se chevauchent. C est le defaut le plus grave qu un SDK
 * d authentification puisse contenir, et il est INDETECTABLE en developpement, ou l on est
 * seul devant sa machine : il n apparait qu en production, sous charge, et il se manifeste
 * par des gens qui voient le compte de quelqu un d autre.
 *
 * ── IL NE SURVIT PAS A LA REQUETE ───────────────────────────────────────────
 * `cache()` est borne au rendu. Une session revoquee est donc vue comme revoquee a la
 * requete SUIVANTE, jamais au milieu d un rendu. C est exactement la propriete que le
 * PRD 5.2 annonce — « tous les produits voient la session invalide a la requete suivante » —
 * et c est ce qui rend la deconnexion globale honnete.
 *
 * ── POURQUOI `react` ET NON UN STOCKAGE A NOUS ──────────────────────────────
 * Un `AsyncLocalStorage` demanderait que quelqu un l initialise par requete, donc une
 * enveloppe imposee a chaque produit. Une `Map` de module fuirait d une requete a l autre,
 * ce qui est precisement le defaut ci-dessus. `cache()` est la seule primitive qui borne une
 * memoire a la duree d un rendu sans rien imposer a l appelant.
 */
export const lireSession = cache(appelerPortail);
