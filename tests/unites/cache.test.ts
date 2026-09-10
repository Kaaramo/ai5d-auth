import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { lireSession } from '../../src/cache';

/**
 * LE CACHE PAR REQUETE, ET CE QUE CE FICHIER PROUVE REELLEMENT.
 *
 * ── CE QU IL NE PEUT PAS PROUVER, ET IL FAUT LE DIRE ────────────────────────
 * `cache()` de React ne memorise QUE dans un contexte de rendu de composant serveur. Hors
 * de ce contexte, il laisse passer chaque appel : c est documente, et c est ce qui se
 * produit ici, dans Vitest, ou aucun rendu React n est en cours.
 *
 * Ce fichier ne peut donc PAS prouver que trois lectures ne font qu un appel. Cette
 * propriete se prouve dans la demo, par un compteur affiche a l ecran, tache 13 du plan.
 * Ecrire ici un test qui simulerait le contexte de React prouverait que notre simulation
 * fonctionne, ce qui n interesse personne.
 *
 * ── CE QU IL PROUVE ─────────────────────────────────────────────────────────
 * 1. Que le cookie est le PREMIER argument, donc qu il entre dans la cle de cache. C est la
 *    propriete de securite, et elle est structurelle : elle se lit dans la signature.
 * 2. Que la fonction cachee est bien celle du transport, et non une copie qui divergerait.
 * 3. Que deux cookies differents produisent bien deux appels distincts, avec deux resultats
 *    distincts. C est le comportement qu on veut, meme s il est ici obtenu sans cache.
 *
 * Un cache indexe sur le seul slug de produit servirait la session d un visiteur a un autre
 * des que deux rendus se chevauchent. C est le defaut le plus grave qu un SDK
 * d authentification puisse contenir, et il est indetectable en developpement.
 */

const PORTAIL = 'https://compte.ai5d.technology';

function charge(id: string) {
  return {
    user: {
      id,
      email: `${id}@exemple.fr`,
      emailVerified: true,
      name: null,
      image: null,
      status: 'ACTIVE',
    },
    session: { id: `ses_${id}`, expiresAt: '2026-10-08T09:12:00.000Z' },
    organisation: null,
    acces: [],
    echu: null,
  };
}

beforeEach(() => {
  vi.stubEnv('AI5D_ACCOUNT_URL', PORTAIL);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('la cle de cache', () => {
  it('porte le cookie en PREMIER argument', () => {
    /*
      `cache()` indexe sur les arguments, dans l ordre. Le cookie etant le premier, deux
      visiteurs ne peuvent pas se croiser. Cette garde est structurelle : elle tomberait si
      quelqu un inversait les parametres ou retirait le cookie de la signature.
    */
    const transport = readFileSync('src/transport.ts', 'utf8');
    expect(transport).toMatch(/appelerPortail\(\s*cookie: string,\s*produit: string \| null,/);
  });

  it('cache la fonction du transport, et non une copie', () => {
    const source = readFileSync('src/cache.ts', 'utf8');
    expect(source).toContain("import { appelerPortail } from './transport'");
    expect(source).toContain('cache(appelerPortail)');
  });

  it('ne garde aucune memoire de module, qui fuirait entre les requetes', () => {
    // Une `Map` au niveau du module survivrait a la requete, donc a la deconnexion.
    const source = readFileSync('src/cache.ts', 'utf8');
    expect(source).not.toContain('new Map');
    expect(source).not.toContain('globalThis');
  });
});

describe('deux visiteurs ne se croisent jamais', () => {
  it('rend deux sessions distinctes pour deux cookies distincts', async () => {
    const appel = vi.fn(async (_url: URL, options: RequestInit) => {
      const cookie = (options.headers as Record<string, string>).cookie;
      return { ok: true, json: async () => charge(cookie === 'c=awa' ? 'usr_awa' : 'usr_ousmane') };
    });
    vi.stubGlobal('fetch', appel);

    const [awa, ousmane] = await Promise.all([
      lireSession('c=awa', null),
      lireSession('c=ousmane', null),
    ]);

    expect(awa?.user.id).toBe('usr_awa');
    expect(ousmane?.user.id).toBe('usr_ousmane');
    expect(appel).toHaveBeenCalledTimes(2);
  });

  it('transmet chaque cookie tel quel, sans jamais en reutiliser un autre', async () => {
    const appel = vi.fn().mockResolvedValue({ ok: true, json: async () => charge('u') });
    vi.stubGlobal('fetch', appel);

    await lireSession('c=awa', null);
    await lireSession('c=ousmane', 'lab');

    const cookies = appel.mock.calls.map(
      (c) => ((c[1] as RequestInit).headers as Record<string, string>).cookie,
    );
    expect(cookies).toEqual(['c=awa', 'c=ousmane']);
  });
});
