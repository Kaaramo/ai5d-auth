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

## Démarrer un nouveau produit AI5D

Cette section est la page à donner à une équipe qui commence un produit. Tout ce qu'il faut pour
brancher le produit sur les comptes AI5D y est, ou dans les sections qu'elle cite.

### Ce qu'on transmet à l'équipe, et ce qu'on ne transmet pas

| À transmettre                                                                                                               | Pourquoi                                                                        |
| --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Ce dépôt, [`Kaaramo/ai5d-auth`](https://github.com/Kaaramo/ai5d-auth), public                                               | Il dit au produit qui est connecté, dans quelle organisation, avec quels droits |
| Le système de design, [`Kaaramo/ai5d-digital-design-system`](https://github.com/Kaaramo/ai5d-digital-design-system), public | Il donne l'apparence AI5D : coquille, composants, thème                         |
| L'adresse d'AI5D Compte pour chaque environnement (tableau plus bas)                                                        | C'est la valeur de la seule variable à poser                                    |
| Le **slug** du produit, attribué par AI5D                                                                                   | L'identifiant qui porte les droits d'accès, par exemple `lab`                   |
| Le **sous-domaine** du produit, sous `ai5d.technology`                                                                      | Sans lui, la connexion ne suit pas (voir « Mettre en ligne »)                   |
| Une **clé produit**, seulement si le produit doit écrire des droits                                                         | Lire la session n'en demande aucune                                             |

| À ne pas transmettre                                            | Pourquoi                                                                                                        |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Le dépôt d'AI5D Compte, `Kaaramo/ai5d-platform`                 | Il est privé. Le produit ne lit jamais la base des comptes, il interroge Compte par ce SDK, comme un navigateur |
| Une chaîne de connexion à la base, un secret d'authentification | Le produit n'en a pas besoin, et c'est ce qui garde les comptes à l'abri d'un produit compromis                 |

### La variable `AI5D_ACCOUNT_URL`, expliquée

AI5D Compte est le **site des comptes** : c'est lui qui affiche l'écran de connexion, garde les
sessions et décide des droits. Votre produit est un **autre site**. Quand une personne arrive sur
votre produit, le SDK doit demander à Compte « qui est cette personne ? ». Pour poser la question,
il doit savoir **à quelle adresse** se trouve Compte. `AI5D_ACCOUNT_URL` est cette adresse, et rien
d'autre : ce n'est ni une clé ni un secret.

| Où tourne votre produit | Valeur de `AI5D_ACCOUNT_URL`                                                                                                   |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| En production           | `https://compte.ai5d.technology`                                                                                               |
| En préproduction        | `https://compte.staging.ai5d.technology`                                                                                       |
| Sur votre poste         | L'adresse du Compte que vous faites tourner en local, par exemple `http://localhost:3000`, et celle qu'il affiche au démarrage |

On la pose dans `.env.local` sur le poste, et dans les variables d'environnement de l'hébergeur
(Vercel) pour la préproduction et la production. Une valeur fausse ne produit pas toujours
d'erreur : les visiteurs apparaissent simplement tous déconnectés.

### De zéro à une page protégée

1. **Créer l'application** Next 16 et React 19, avec pnpm.
2. **Installer les deux paquets** par étiquette, section [Installer](#installer), et déclarer les
   deux dans `transpilePackages`.
3. **Poser `AI5D_ACCOUNT_URL`**, tableau ci-dessus.
4. **Poser le fournisseur, le middleware et une page protégée**, section [Trois gestes](#trois-gestes).
5. **Poser la coquille et le thème**, section [Coquille et thème](#coquille-et-thème).
6. **Lire les droits** avec le slug reçu : `const acces = await getProductAccess('votre-slug')`,
   puis `<AccesRefuse produit="Nom du produit" />` quand `acces` est vide. Un slug mal écrit ne lève
   aucune erreur : il rend un accès vide, comme pour une personne sans droit.
7. **Mettre en ligne** sous `ai5d.technology`, section [Mettre en ligne](#mettre-en-ligne).

## Installer

**Installez toujours les deux paquets ensemble, par étiquette, dans une même commande.**

```bash
pnpm add github:Kaaramo/ai5d-auth#v1.1.0 github:Kaaramo/ai5d-digital-design-system#v1.0.1 lucide-react@^1.0.0
```

`lucide-react` est demandé par le système de design depuis sa version `1.0.0`, pas par le SDK. Il
figure dans la commande parce que les composants du SDK s'appuient sur ceux du système.

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

## Coquille et thème

Un produit AI5D a la même allure que Compte : un rail de rubriques sur ordinateur, une barre basse
sur téléphone, le thème que la personne a choisi. Tout vient du système de design ; le produit
fournit ses rubriques et le lien de son routeur.

**Le thème**, lu au serveur dans le gabarit racine, pour que la page ne clignote pas du clair au
sombre. Compte écrit le choix de la personne dans un cookie commun à tous les produits :

```tsx
// app/layout.tsx
import { cookies } from 'next/headers';
import { Ai5dProvider, getSession } from '@ai5d/auth';
import { COOKIE_THEME, attributTheme, themeOuSysteme } from '@ai5d/design-system/theme';

export default async function Layout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  const theme = themeOuSysteme((await cookies()).get(COOKIE_THEME)?.value);

  return (
    <html lang="fr" data-densite="equilibre" data-theme={attributTheme(theme)}>
      <body style={{ margin: 0, background: 'var(--surface-1)', color: 'var(--texte)' }}>
        <Ai5dProvider valeur={session}>{children}</Ai5dProvider>
      </body>
    </html>
  );
}
```

**Les rubriques**, dans un module **client** : la rubrique active dépend de l'adresse, et un
gabarit serveur partagé n'est pas recalculé d'une page à l'autre. Calculée au serveur, elle
resterait figée sur la première page ouverte.

```tsx
// app/(espace)/navigation.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { House, Users } from 'lucide-react';
import { BarreOnglets, LiensRail, type Rubrique } from '@ai5d/design-system/composants';

const RUBRIQUES: Rubrique[] = [
  { id: 'accueil', libelle: 'Accueil', icone: House, href: '/accueil' },
  { id: 'equipe', libelle: 'Équipe', icone: Users, href: '/equipe' },
];

const active = (chemin: string) => chemin.split('/').filter(Boolean)[0] ?? '';

export function NavigationRail() {
  return (
    <LiensRail
      rubriques={RUBRIQUES}
      actif={active(usePathname())}
      Lien={Link}
      etiquette="Rubriques"
    />
  );
}

export function NavigationBarre() {
  return (
    <BarreOnglets
      onglets={RUBRIQUES}
      actif={active(usePathname())}
      Lien={Link}
      etiquette="Rubriques"
    />
  );
}
```

**La coquille**, dans le gabarit des pages connectées. Le sélecteur de thème reçoit le domaine du
cookie : c'est ce qui fait qu'un thème choisi dans un produit se retrouve dans les autres.

```tsx
// app/(espace)/layout.tsx
import { requireSession } from '@ai5d/auth';
import { UserButton } from '@ai5d/auth/react';
import { CoquilleRail, SelecteurTheme } from '@ai5d/design-system/composants';
import { themeOuSysteme, COOKIE_THEME } from '@ai5d/design-system/theme';
import { cookies } from 'next/headers';
import { NavigationBarre, NavigationRail } from './navigation';

/** `.ai5d.technology` en production, `.staging.ai5d.technology` en préproduction, rien en local. */
function domaineDuCookie(): string | undefined {
  const hote = new URL(process.env.AI5D_ACCOUNT_URL ?? 'http://localhost').hostname;
  return hote.startsWith('compte.') ? hote.slice('compte'.length) : undefined;
}

export default async function Espace({ children }: { children: React.ReactNode }) {
  await requireSession();
  const theme = themeOuSysteme((await cookies()).get(COOKIE_THEME)?.value);

  return (
    <CoquilleRail
      produit="Nom du produit"
      navigationRail={<NavigationRail />}
      navigationBarre={<NavigationBarre />}
      pied={<SelecteurTheme theme={theme} domaine={domaineDuCookie()} />}
      actionsBarre={<UserButton />}
      largeurContenu={960}
    >
      {children}
    </CoquilleRail>
  );
}
```

`largeurContenu` est fixe ici. Si elle doit varier selon la page, calculez-la dans un composant
client qui lit l'adresse, pour la même raison que la rubrique active. Le reste du catalogue
(en-têtes de rubrique, cartes, dialogues, états vides) est décrit dans le README du système de
design.

## Mettre en ligne

**Le produit doit vivre sous `ai5d.technology`.** La session est un cookie posé par Compte sur
`.ai5d.technology` : le navigateur ne l'envoie qu'aux sites de ce domaine. Un produit sur un autre
domaine verrait tous ses visiteurs déconnectés, sans aucun message d'erreur.

| Environnement | Adresse du produit                | `AI5D_ACCOUNT_URL`                       |
| ------------- | --------------------------------- | ---------------------------------------- |
| Préproduction | `produit.staging.ai5d.technology` | `https://compte.staging.ai5d.technology` |
| Production    | `produit.ai5d.technology`         | `https://compte.ai5d.technology`         |

Faites la préproduction d'abord. Ses comptes sont séparés de ceux de la production : une erreur
n'y touche personne.

**Vérifier que la connexion suit.** Le cookie de session est `HttpOnly` : il n'apparaît ni dans
`document.cookie` ni dans la console, et c'est normal. La preuve est ailleurs :

1. Se connecter sur Compte.
2. Ouvrir la page protégée du produit : elle s'ouvre, sans écran de connexion.
3. Se déconnecter depuis Compte, puis recharger la page du produit : elle renvoie vers la connexion.

La troisième étape est celle qui prouve le plus : la session vit dans Compte, et aucun produit ne
peut prolonger un accès que la personne a fermé.

| Ce qu'on voit                                         | La cause, presque toujours                                                                                |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Tous les visiteurs apparaissent déconnectés           | Le produit n'est pas sous `ai5d.technology`, ou la variable pointe le mauvais Compte                      |
| Boucle entre le produit et l'écran de connexion       | Le produit et `AI5D_ACCOUNT_URL` ne sont pas dans le même environnement (préproduction contre production) |
| `AI5D_ACCOUNT_URL n'est pas defini` au premier appel  | La variable manque sur cet environnement de l'hébergeur                                                   |
| Erreur de syntaxe au chargement d'un module `@ai5d/…` | `transpilePackages` manque dans `next.config.ts`                                                          |
| L'accès est toujours refusé                           | Le slug est mal écrit, ou aucun droit n'a été accordé à la personne dans Compte                           |

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

Ce README suffit pour brancher un produit et le mettre en ligne. Le guide détaillé (rôles, écriture
de droits avec une clé produit, webhooks, API à clé) est dans le dépôt privé de la plateforme,
`docs/integration-produit.md` : demandez à AI5D la partie qui vous concerne, avec votre slug et, si
besoin, votre clé produit.

## Licence

Copyright 2026 AI5D. Tous droits réservés. Voir [`LICENSE`](LICENSE).
