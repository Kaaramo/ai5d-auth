import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  decrire,
  verifierAucuneCouleurEnDur,
  verifierAucunJetonDeMarqueRedefini,
} from '@ai5d/design-system/gardes';

/**
 * Le SDK consomme le systeme de design, il ne le recopie pas.
 *
 * Trois gardes que la plateforme appliquait au SDK jusqu au sprint 16, appliquees ici a `src`
 * SANS AUCUNE EXCEPTION. Les trois composants du SDK n ont aucune raison technique d ecrire une
 * couleur : ils en ont une de ne pas le faire, puisque chaque produit qui les rend doit les voir
 * suivre son theme.
 */

function fichiersCss(dossier: string): string[] {
  const sortie: string[] = [];
  for (const entree of readdirSync(dossier)) {
    const chemin = join(dossier, entree);
    if (statSync(chemin).isDirectory()) sortie.push(...fichiersCss(chemin));
    else if (chemin.endsWith('.css')) sortie.push(chemin);
  }
  return sortie;
}

describe('I03 : aucune couleur en dur', () => {
  it("le SDK n'ecrit aucune couleur en dur", () => {
    const infractions = verifierAucuneCouleurEnDur('src');
    expect(infractions.length, `\n${decrire(infractions)}`).toBe(0);
  });
});

describe('I13 : aucun jeton de marque redefini', () => {
  it('le SDK ne derive pas la marque', () => {
    const infractions = verifierAucunJetonDeMarqueRedefini('src');
    expect(infractions.length, `\n${decrire(infractions)}`).toBe(0);
  });
});

describe('I15 : le SDK ne definit aucun jeton', () => {
  it('aucun fichier CSS ne declare de variable', () => {
    // Aucune feuille aujourd hui. La garde attend la premiere : le design se decide dans le
    // systeme, et il arrive epingle a une etiquette.
    for (const chemin of fichiersCss('src')) {
      const contenu = readFileSync(chemin, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
      expect(contenu, `${chemin} declare une variable`).not.toMatch(/^\s*--[\w-]+\s*:/m);
    }
  });
});
