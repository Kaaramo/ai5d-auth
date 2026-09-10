// @vitest-environment jsdom
import { act } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FournisseurAi5d } from '../../src/react/contexte';
import { OrganizationSwitcher } from '../../src/react/OrganizationSwitcher';
import type { Ai5dSession } from '../../src/types';

/**
 * LE SERVEUR ET LE PREMIER RENDU DU NAVIGATEUR ECRIVENT LA MEME CHOSE.
 *
 * `OrganizationSwitcher` lisait `window.location.href` PENDANT son rendu : le serveur, ou
 * `window` n existe pas, ecrivait un lien sans `redirect`, le navigateur un lien avec. React
 * signalait une erreur d hydratation sur chaque page qui affiche le composant. Aucun test ne
 * le voyait, parce que jsdom a toujours un `window` ; la recette du sprint 16 l a vu au
 * navigateur.
 *
 * Ce fichier rejoue les deux temps : le rendu serveur SANS `window`, puis l hydratation dans
 * le navigateur simule, en recueillant toute erreur que React signale.
 */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const PORTAIL = 'https://compte.ai5d.technology';

const SESSION: Ai5dSession = {
  user: {
    id: 'usr_1',
    email: 'awa@exemple.fr',
    emailVerified: true,
    name: 'Awa Ndiaye',
    image: null,
    status: 'ACTIVE',
  },
  session: { id: 'ses_1', expiresAt: new Date('2026-10-08T09:12:00.000Z') },
  organisation: {
    id: 'org_1',
    nom: 'Clinique Saint-Louis',
    identifiant: 'clinique',
    role: 'admin',
  },
  acces: [],
  echu: null,
};

const arbre = (
  <FournisseurAi5d valeur={{ session: SESSION, portail: PORTAIL }}>
    <OrganizationSwitcher />
  </FournisseurAi5d>
);

/** Le rendu du serveur, ou `window` n existe pas. */
function rendreAuServeur(): string {
  vi.stubGlobal('window', undefined);
  try {
    return renderToString(arbre);
  } finally {
    vi.unstubAllGlobals();
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

describe('OrganizationSwitcher s hydrate sans ecart', () => {
  it('le serveur, sans window, ecrit le lien sans retour', () => {
    const html = rendreAuServeur();
    expect(html).toContain('/organisations');
    expect(html).not.toContain('redirect=');
  });

  it('le premier rendu du navigateur ecrit le meme lien, puis ajoute le retour', async () => {
    const conteneur = document.createElement('div');
    conteneur.innerHTML = rendreAuServeur();
    document.body.appendChild(conteneur);

    const erreurs: string[] = [];
    vi.spyOn(console, 'error').mockImplementation((...morceaux: unknown[]) => {
      erreurs.push(morceaux.map(String).join(' '));
    });

    await act(async () => {
      hydrateRoot(conteneur, arbre, {
        onRecoverableError: (erreur) => erreurs.push(String(erreur)),
      });
    });

    expect(erreurs.filter((e) => /hydrat|did not match|didn't match/i.test(e))).toEqual([]);
    expect(conteneur.querySelector('a')?.getAttribute('href')).toContain('redirect=');
  });
});
