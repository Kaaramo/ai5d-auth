# @ai5d/auth

Le SDK d'identité de l'écosystème AI5D. Il dit à votre produit **qui** est devant lui, **dans
quelle organisation** cette personne travaille, et **à quoi** elle a droit. Les trois réponses
sont décidées par AI5D Compte ; le SDK les lit, il n'en décide aucune.

## Ce que c'est

Un paquet sans dépendance installée, livré en TypeScript, qui parle à AI5D Compte par une seule
route, `GET /api/session`, avec le cookie de session de votre visiteur. Il vous donne des
fonctions serveur (`getSession`, `requireSession`, `getProductAccess`, `requireRole`), un
middleware, un fournisseur React, trois hooks et trois composants chartés (`UserButton`,
`OrganizationSwitcher`, `AccesRefuse`).

Il n'expose aucune fonction de connexion, et ne lit jamais les droits d'une autre personne que
votre visiteur. Ces deux choses passent par AI5D Compte et par son API à clé.

## Installer

**Installez toujours les deux paquets ensemble, par étiquette, dans une même commande.**

```bash
pnpm add github:Kaaramo/ai5d-auth#v1.0.1 github:Kaaramo/ai5d-digital-design-system#v0.7.0
```

Le SDK déclare le système de design comme dépendance de pair. Si votre produit ne l'installe
pas lui-même, pnpm va le chercher sur le registre npm, où ce nom ne vous garantit rien : un
paquet publié sous ce nom par un tiers serait installé dans votre produit, et exécuté avec les
cookies de vos visiteurs. Aucun jeton n'est nécessaire, les deux dépôts sont publics.

Les deux paquets sont livrés en TypeScript non transpilé. Déclarez-les à Next :

```ts
// next.config.ts
const config = { transpilePackages: ['@ai5d/design-system', '@ai5d/auth'] };
export default config;
```

Ils se compilent sous vos réglages. Next 16 et React 19 sont requis.

## Trois gestes

**La variable**, dans `.env.local`, et c'est la seule :

```
AI5D_ACCOUNT_URL=https://compte.ai5d.technology
```

Depuis la version 1.0.2, le SDK le vérifie lui-même : une valeur qui n'est pas une URL, ou une
adresse en clair hors de `localhost` et `127.0.0.1`, fait lever une erreur au premier appel.

Elle doit être en `https` hors de votre poste : le SDK envoie à cette adresse le cookie de
session de chaque visiteur. Une coquille ou un `http://` l'enverrait ailleurs, ou en clair, sans
la moindre erreur.

**Le fournisseur**, dans votre gabarit racine. Il s'exécute au serveur :

```tsx
// app/layout.tsx
import { Ai5dProvider, getSession } from '@ai5d/auth';

export default async function Layout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  return (
    <html lang="fr">
      <body>
        <Ai5dProvider valeur={session}>{children}</Ai5dProvider>
      </body>
    </html>
  );
}
```

**Une page protégée**, et le middleware qui évite de la charger pour rien. Donnez-lui toujours
un `matcher` : sans lui, il s'applique à toutes vos routes, pages publiques comprises.

Le retour après connexion n'est transmis que pour les pages que votre `matcher` couvre, et
seulement si son adresse désigne votre propre hôte. Ailleurs, la personne arrive sur l'accueil de
son compte : c'est un inconfort, jamais une destination choisie par quelqu'un d'autre.

```ts
// middleware.ts
export { ai5dAuthMiddleware as middleware } from '@ai5d/auth/middleware';
export const config = { matcher: ['/espace/:path*'] };
```

```tsx
// app/espace/page.tsx
import { requireSession } from '@ai5d/auth';

export default async function Espace() {
  const { user } = await requireSession();
  return <h1>Bonjour {user.name}</h1>;
}
```

## Ce qu'il ne faut pas croire

**Le middleware n'est pas une garde.** Il regarde seulement si un cookie est présent, pour ne
pas charger une page protégée devant un visiteur qui n'en a pas. Il ne le valide pas. La garde
est `requireSession()`, qui interroge AI5D Compte.

**Il n'y a pas de `isLoading`.** La session est lue au serveur, puis confiée à vos composants
clients par le fournisseur : ils ne l'attendent jamais.

**Aucune fonction de connexion n'existe, et c'est voulu.** Un formulaire de connexion dessiné
dans chaque produit apprendrait à vos visiteurs à saisir leur mot de passe sur des écrans qui
se ressemblent sans être les mêmes. C'est ainsi que se préparent les hameçonnages. La connexion
vit sur AI5D Compte, et seulement là.

**Une panne de Compte n'est pas une déconnexion.** Quand Compte ne répond pas, les fonctions
qui protègent lèvent `PortailIndisponibleErreur` : `requireSession`, `getProductAccess`,
`requireProductAccess` et `requireRole`. Une page protégée doit alors dire que le service est
momentanément indisponible, et surtout ne pas renvoyer vers la connexion : pendant une panne,
cela fabrique une boucle.

`getSession` et `getActiveOrganization`, elles, rendent `null` pendant une panne, pour qu'une
page publique se rende en anonyme. N'en faites donc jamais une garde : un
`if (!(await getSession())) redirect(...)` reconstruirait la boucle que l'erreur évite.

```ts
import { PortailIndisponibleErreur } from '@ai5d/auth';
```

## Versions

Le versionnement est sémantique, et un doute se tranche vers le niveau supérieur.

| Niveau    | Ce qui le déclenche                                                                                                                                                                                    |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Majeur    | Retirer ou renommer un export, changer une signature, restreindre un type rendu, ajouter un pair, changer la route consommée ou la forme de sa charge, relever la version minimale de Next ou de React |
| Mineur    | Ajouter un export, un champ facultatif à un type rendu, une option facultative                                                                                                                         |
| Correctif | Corriger un comportement sans toucher la surface, un commentaire, un test                                                                                                                              |

**Épinglez toujours une étiquette, jamais une branche.** Votre `pnpm-lock.yaml` n'enregistre pas
le nom de l'étiquette mais l'empreinte de l'objet étiquette annotée, qui désigne un seul commit
pour toujours : une réinstallation verrouillée installe toujours le code que vous avez testé, ou
échoue. Pour monter de version, changez l'étiquette, réinstallez, commitez le verrou.

## Sécurité : pourquoi ce dépôt peut être public

Vous lisez ici le nom du cookie de session, la route `/api/session` et la forme de sa réponse.
Rien de cela n'ouvre quoi que ce soit. Le cookie est `HttpOnly` et posé par AI5D Compte : le
connaître ne permet ni de le lire ni de le fabriquer. La route ne rend que les droits du
porteur du cookie, refuse tout identifiant en paramètre et ignore toute clé. Un cookie inventé
passe le middleware, qui ne valide rien, puis échoue à `requireSession()` : aucune page protégée
ne s'ouvre.

Ce que cela vous demande, en retour : le serveur de votre produit reçoit le cookie complet de
chaque visiteur, puisqu'il est posé sur le domaine parent. **Ne journalisez jamais l'en-tête
`Cookie`**, ni les en-têtes d'une requête en entier.

Ce dépôt ne contient aucune clé, aucune chaîne de connexion, aucun fichier d'environnement, et
une garde le vérifie à chaque exécution des tests.

## Glossaire

**« portail »**, dans le code (`urlPortail`, `PortailIndisponibleErreur`), désigne AI5D Compte,
le service de comptes. Le mot est antérieur au produit AI5D Portail, qui n'a rien à voir ; le
renommer serait un changement majeur.

**`apps/compte`**, dans les commentaires, est le code d'AI5D Compte, dans un dépôt privé. Les
commentaires qui le citent disent pourquoi une ligne existe ; ils ne sont pas nécessaires pour
l'utiliser.

## Aller plus loin

Le guide d'intégration complet (rôles, droits d'un produit, composants, erreurs fréquentes) est
dans le dépôt de la plateforme AI5D, `docs/integration-produit.md`, accessible aux équipes AI5D.

## Licence

Copyright 2026 AI5D. Tous droits réservés. Voir [`LICENSE`](LICENSE).
