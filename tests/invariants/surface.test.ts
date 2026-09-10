import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/*
  Deplace depuis `ai5d-platform/tests/invariants/sdk.test.ts` au sprint 16, seuls les chemins
  ont change. La garde « les chemins du portail cites par le SDK existent vraiment » est
  restee dans la plateforme : elle compare ce SDK au code de Compte, qui n est pas ici. Elle
  seule employait `existsSync`, retire de l import pour cette raison.
*/

/**
 * I02 — LA SURFACE PUBLIQUE DU SDK.
 *
 * C est, avec I01, l invariant qui garantit que la bascule OIDC de la V2 sera un ajout et
 * non une refonte. S il cede, la promesse architecturale du PRD 5.1 cede avec lui, et
 * personne ne s en apercevra avant le jour ou il faudra migrer.
 *
 * ── L INVARIANT S EST RESSERRE AU SPRINT 06, IL N A PAS CEDE ────────────────
 * Il verifiait une chose : `dependencies` vide. Trois exports du PRD 9.2 rendaient cette
 * forme intenable — `requireSession()` sans argument demande le contexte de requete, le
 * cache par requete demande React, les composants chartes demandent le systeme de design.
 *
 * La distinction qui compte n est pas « zero dependance » : c est « aucune dependance
 * INSTALLEE par le paquet ». React, Next et le systeme de design sont deja dans
 * l application qui consomme le SDK ; les declarer en pairs ne fait entrer aucun code
 * nouveau. La bibliotheque d authentification, elle, reste interdite sous TOUTES les formes.
 *
 * Troisieme invariant de ce depot a se resserrer plutot qu a disparaitre, apres la liste
 * blanche des greffons du sprint 03 et la garde des routes `/api/v1` du sprint 05.
 */

const PAQUET = JSON.parse(readFileSync('package.json', 'utf8')) as {
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  exports: Record<string, string>;
};

/** Toutes les sources du paquet, sous-dossiers compris. */
function sources(): string[] {
  const sortie: string[] = [];
  const parcourir = (dossier: string): void => {
    for (const entree of readdirSync(dossier)) {
      const chemin = join(dossier, entree);
      if (statSync(chemin).isDirectory()) parcourir(chemin);
      else if (/\.(ts|tsx)$/.test(chemin)) sortie.push(chemin.replace(/\\/g, '/'));
    }
  };
  parcourir('src');
  return sortie;
}

const TOUT = sources()
  .map((f) => readFileSync(f, 'utf8'))
  .join('\n');

/** Les commentaires ont le droit de citer ce qu ils expliquent ; pas les declarations. */
function declarations(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

describe('I02 — le paquet n installe rien, et ne connait pas le moteur', () => {
  it("n'installe aucune dependance", () => {
    expect(PAQUET.dependencies ?? {}).toEqual({});
  });

  it('ne declare QUE les quatre pairs autorises', () => {
    /*
      Une liste blanche, pas un plafond.

      Une bibliotheque anodine ajoutee ici ouvrirait la porte a la suivante, et le paquet
      finirait par installer ce qu il promet de ne pas installer. Les quatre presents sont
      deja dans toute application qui consomme le SDK : les declarer ne fait entrer aucun
      code nouveau.
    */
    expect(Object.keys(PAQUET.peerDependencies ?? {}).sort()).toEqual([
      '@ai5d/design-system',
      'next',
      'react',
      'react-dom',
    ]);
  });

  it('ne nomme better-auth dans AUCUN champ de dependance', () => {
    const tous = JSON.stringify([
      PAQUET.dependencies,
      PAQUET.peerDependencies,
      PAQUET.devDependencies,
    ]);
    expect(tous).not.toContain('better-auth');
  });

  it("n'importe better-auth dans aucune source", () => {
    expect(TOUT).not.toMatch(/from ['"]better-auth/);
    expect(TOUT).not.toMatch(/require\(['"]better-auth/);
  });

  it('ne reexporte aucun type du moteur', () => {
    expect(TOUT).not.toMatch(/export .*(Session|User).* from ['"]better-auth/);
  });

  it('ecrit ses types a la main, pour qu ils survivent au changement de moteur', () => {
    const types = readFileSync('src/types.ts', 'utf8');
    expect(types).toContain('export interface Ai5dUser');
    expect(types).toContain('export interface Ai5dSession');
    expect(types).toContain("export type StatutUtilisateur = 'ACTIVE'");
    expect(types).toContain("export type RoleOrganisation = 'owner'");
  });

  it('declare les quatre points d entree', () => {
    expect(Object.keys(PAQUET.exports).sort()).toEqual([
      '.',
      './middleware',
      './react',
      './server',
    ]);
  });
});

describe('la surface publique ne promet que ce qu elle doit', () => {
  it("n'expose aucune fonction de connexion", () => {
    /*
      LA LIGNE LA PLUS IMPORTANTE DE CE FICHIER.

      Un SDK qui exposerait `signIn` inviterait chaque produit a dessiner son propre
      formulaire de connexion. Le PRD 2.3 dit pourquoi c est grave : « une rupture graphique
      au moment ou l on saisit un mot de passe evoque l hameconnage ». Le portail les porte,
      et lui seul.
    */
    const code = declarations(TOUT);
    for (const interdit of ['signIn', 'signUp', 'signOut', 'setActiveOrganization']) {
      expect(code, `${interdit} dans la surface publique`).not.toMatch(
        new RegExp(`export .*${interdit}`),
      );
    }
  });

  it("n'expose aucune lecture d'un tiers", () => {
    // Lire les droits de quelqu un d autre que le visiteur demande une cle produit, et
    // passe par `/api/v1`. Deux surfaces, deux authentifications.
    const code = declarations(TOUT);
    expect(code).not.toMatch(/export .*getUser\b/);
    expect(code).not.toMatch(/export .*grantAccess/);
  });

  it("n'expose aucun isLoading", () => {
    expect(declarations(TOUT)).not.toContain('isLoading');
  });
});

describe('un seul point de sortie reseau', () => {
  it('un seul fichier du paquet appelle fetch', () => {
    const coupables = sources().filter((f) => {
      if (f.endsWith('transport.ts')) return false;
      return /\bfetch\(/.test(declarations(readFileSync(f, 'utf8')));
    });
    expect(coupables, 'fetch hors de transport.ts').toEqual([]);
  });

  it("n'envoie jamais d'en-tete d'autorisation", () => {
    // La route de session ne le lirait pas ; le SDK ne doit pas donner l idee de l envoyer.
    expect(declarations(TOUT)).not.toMatch(/authorization/i);
  });

  it('ne connait du portail que la route de session', () => {
    const code = declarations(TOUT);
    expect(code).toContain("'/api/session'");
    // Il ne parle jamais aux routes du moteur, ni a l API a cle.
    expect(code).not.toContain('/api/auth/');
    expect(code).not.toContain('/api/v1/');
  });
});

describe('le paquet ne touche jamais la base', () => {
  it("n'importe ni @ai5d/db, ni prisma", () => {
    const code = declarations(TOUT);
    expect(code).not.toContain('@ai5d/db');
    expect(code).not.toContain('prisma');
  });
});

describe('la lecture des droits ne vise que le visiteur', () => {
  /*
    Deplace depuis `ai5d-platform/tests/invariants/acces.test.ts` au sprint 16.

    Au sprint 04, cette garde exigeait que le SDK N EXPORTE PAS `getProductAccess` : les cles
    produit n arrivaient qu au sprint 05. Le sprint 06 l expose, et la borne existe desormais :
    `/api/session` ne rend QUE les droits du porteur du cookie, refuse tout `userId` en
    parametre, et ne lit aucune cle.

    Ce que la garde verifie maintenant est la moitie qui compte encore : que le SDK ne permette
    jamais de lire les droits d UN TIERS.
  */
  it('le SDK expose la lecture des droits, mais jamais ceux d un tiers', () => {
    const code = declarations(readFileSync('src/index.ts', 'utf8'));
    expect(code).toContain('getProductAccess');

    // Aucune signature ne prend d identifiant de sujet : le sujet est celui du cookie.
    const serveur = declarations(readFileSync('src/server.ts', 'utf8'));
    expect(serveur).not.toMatch(/userId\s*[:,)]/);
    expect(serveur).not.toContain('organizationId');
  });
});
