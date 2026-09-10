import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { appelerPortail } from '../../src/transport';
import { baseCompte, urlPortail } from '../../src/url';

/**
 * Le seul point de sortie reseau du paquet, et la construction des URL du portail.
 *
 * Ce qui est REELLEMENT execute : la traduction de la charge, la conversion des dates, et
 * la lecture defensive. Ce qui est double : `fetch`, et lui seul.
 */

const PORTAIL = 'https://compte.ai5d.technology';

function chargeConnectee(surcharge: Record<string, unknown> = {}) {
  return {
    user: {
      id: 'usr_1',
      email: 'awa@exemple.fr',
      emailVerified: true,
      name: 'Awa Ndiaye',
      image: null,
      status: 'ACTIVE',
    },
    session: { id: 'ses_1', expiresAt: '2026-10-08T09:12:00.000Z' },
    organisation: null,
    acces: [],
    echu: null,
    ...surcharge,
  };
}

function accesPublic(surcharge: Record<string, unknown> = {}) {
  return {
    id: 'pac_1',
    product: 'lab',
    subject: { type: 'organization', id: 'org_1' },
    status: 'ACTIVE',
    source: 'ORG_LICENSE',
    plan: 'equipe-25',
    seats: 25,
    externalRef: 'sub_1',
    metadata: { parcours: ['ia-generative'] },
    grantedAt: '2026-09-02T10:12:00.000Z',
    expiresAt: '2027-09-02T00:00:00.000Z',
    ...surcharge,
  };
}

function repondre(charge: unknown, ok = true) {
  return vi.fn().mockResolvedValue({ ok, json: async () => charge });
}

beforeEach(() => {
  vi.stubEnv('AI5D_ACCOUNT_URL', PORTAIL);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('urlPortail', () => {
  it('encode le retour, meme quand il porte lui-meme un point d interrogation', () => {
    /*
      C est la seule raison d etre de cette fonction. Une concatenation manuelle produirait
      `?redirect=https://lab.ai5d.technology/a?b=c`, et tout ce qui suit le second `?` serait
      lu comme un parametre du PORTAIL. La personne reviendrait sur la racine du produit.
    */
    const url = urlPortail('/connexion', 'https://lab.ai5d.technology/a?b=c');
    expect(url).toContain('redirect=https%3A%2F%2Flab.ai5d.technology%2Fa%3Fb%3Dc');
  });

  it('ne pose aucun parametre sans retour', () => {
    expect(urlPortail('/connexion')).toBe(`${PORTAIL}/connexion`);
  });

  it('ne pose aucun parametre sur un retour vide', () => {
    expect(urlPortail('/connexion', '')).toBe(`${PORTAIL}/connexion`);
  });

  it('ne double jamais la barre oblique', () => {
    vi.stubEnv('AI5D_ACCOUNT_URL', `${PORTAIL}/`);
    expect(urlPortail('/acces')).toBe(`${PORTAIL}/acces`);
  });

  it('rend la racine par defaut', () => {
    expect(urlPortail()).toBe(`${PORTAIL}/`);
  });

  it('leve clairement quand la variable manque', () => {
    vi.stubEnv('AI5D_ACCOUNT_URL', '');
    expect(() => baseCompte()).toThrow('AI5D_ACCOUNT_URL');
  });
});

describe('appelerPortail — la requete', () => {
  it('transmet le cookie et refuse la mise en cache', async () => {
    const appel = repondre(chargeConnectee());
    vi.stubGlobal('fetch', appel);

    await appelerPortail('ai5d.session_token=abc', null);

    const [url, options] = appel.mock.calls[0] as [URL, RequestInit];
    expect(url.toString()).toBe(`${PORTAIL}/api/session`);
    expect((options.headers as Record<string, string>).cookie).toBe('ai5d.session_token=abc');
    expect(options.cache).toBe('no-store');
  });

  it('nomme le produit quand il est demande', async () => {
    const appel = repondre(chargeConnectee());
    vi.stubGlobal('fetch', appel);

    await appelerPortail('ai5d.session_token=abc', 'lab');

    const [url] = appel.mock.calls[0] as [URL];
    expect(url.searchParams.get('produit')).toBe('lab');
  });

  it("n'envoie aucun en-tete en dehors du cookie", () => {
    // La route ne lirait pas une cle produit ; le SDK ne doit pas donner l idee d en envoyer.
    const appel = repondre(chargeConnectee());
    vi.stubGlobal('fetch', appel);

    return appelerPortail('ai5d.session_token=abc', null).then(() => {
      const [, options] = appel.mock.calls[0] as [URL, RequestInit];
      expect(Object.keys(options.headers as Record<string, string>)).toEqual(['cookie']);
    });
  });
});

describe('appelerPortail — deux refus, et ils ne disent pas la meme chose', () => {
  /*
    CES TROIS TESTS ONT CHANGE DE SENS APRES LA REVUE DU GARDIEN.

    Ils attendaient `null` sur TOUTE reponse non 2xx. Le raisonnement paraissait bon :
    degrader vers l anonyme plutot que de tomber en erreur.

    Il produisait une BOUCLE. Sur un 429 de limitation ou un 500, `requireSession()`
    redirigeait vers `/connexion` ; le middleware du portail voyait un cookie VALIDE et
    renvoyait vers le produit, qui redemandait, qui reprenait la meme panne. La personne
    voyait `ERR_TOO_MANY_REDIRECTS`, jamais un ecran de connexion.

    Une indisponibilite n est pas une absence de session. C est le code qui a gagne, et ces
    tests disent desormais ce qu il fait.
  */

  it('rend null sur 401, qui veut dire « pas connecte »', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401 }));
    expect(await appelerPortail('c=1', null)).toBeNull();
  });

  it('rend null sur 403, pour la meme raison', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 403 }));
    expect(await appelerPortail('c=1', null)).toBeNull();
  });

  it('LEVE sur 429, parce qu une limite n est pas une deconnexion', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 429 }));
    await expect(appelerPortail('c=1', null)).rejects.toMatchObject({
      name: 'PortailIndisponibleErreur',
      statut: 429,
    });
  });

  it('LEVE sur 500', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    await expect(appelerPortail('c=1', null)).rejects.toMatchObject({
      name: 'PortailIndisponibleErreur',
      statut: 500,
    });
  });

  it('LEVE quand le portail est injoignable, avec un statut nul', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')));
    await expect(appelerPortail('c=1', null)).rejects.toMatchObject({
      name: 'PortailIndisponibleErreur',
      statut: null,
    });
  });

  it('LEVE sur une charge illisible, qui vient du portail et non du visiteur', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => {
          throw new SyntaxError('pas du JSON');
        },
      }),
    );
    await expect(appelerPortail('c=1', null)).rejects.toBeInstanceOf(Error);
  });

  it('rend null sur une charge sans user', async () => {
    vi.stubGlobal('fetch', repondre({ user: null, session: null, organisation: null, acces: [] }));
    expect(await appelerPortail('c=1', null)).toBeNull();
  });

  it('rend null sur une charge sans session', async () => {
    vi.stubGlobal('fetch', repondre({ user: { id: 'u' }, session: null }));
    expect(await appelerPortail('c=1', null)).toBeNull();
  });
});

describe('appelerPortail — la traduction', () => {
  it('convertit les dates en objets Date', async () => {
    vi.stubGlobal('fetch', repondre(chargeConnectee({ acces: [accesPublic()] })));
    const session = await appelerPortail('c=1', 'lab');

    expect(session?.session.expiresAt).toBeInstanceOf(Date);
    expect(session?.acces[0]?.accordeLe).toBeInstanceOf(Date);
    expect(session?.acces[0]?.expireLe).toBeInstanceOf(Date);
    expect(session?.session.expiresAt.toISOString()).toBe('2026-10-08T09:12:00.000Z');
  });

  it('traduit les noms anglais de la charge vers les noms francais du type', async () => {
    vi.stubGlobal('fetch', repondre(chargeConnectee({ acces: [accesPublic()] })));
    const acces = (await appelerPortail('c=1', 'lab'))?.acces[0];

    expect(acces?.produit).toBe('lab');
    expect(acces?.sujet).toEqual({ type: 'organization', id: 'org_1' });
    expect(acces?.statut).toBe('ACTIVE');
    expect(acces?.sieges).toBe(25);
  });

  it('ne laisse PAS passer externalRef ni metadata, meme si la charge les porte', async () => {
    /*
      La route de session ne les envoie pas, et le transport ne les lirait pas davantage.
      Deux barrieres pour la meme chose : un jour quelqu un elargira la charge du portail
      sans relire le SDK, et ce test dira que la surface publique ne bouge pas pour autant.

      Le motif complet est dans `types.ts` : ces deux champs portent des references
      d abonnement et des metadonnees commerciales qu aucun ecran du portail n affiche, et
      la route de session n identifie pas son appelant.
    */
    vi.stubGlobal('fetch', repondre(chargeConnectee({ acces: [accesPublic()] })));
    const acces = (await appelerPortail('c=1', 'lab'))?.acces[0];

    expect(acces).not.toHaveProperty('referenceExterne');
    expect(acces).not.toHaveProperty('metadonnees');
    expect(acces).not.toHaveProperty('externalRef');
    expect(acces).not.toHaveProperty('metadata');
  });

  it('rend expireLe a null pour un acces perpetuel', async () => {
    vi.stubGlobal(
      'fetch',
      repondre(chargeConnectee({ acces: [accesPublic({ expiresAt: null })] })),
    );
    expect((await appelerPortail('c=1', 'lab'))?.acces[0]?.expireLe).toBeNull();
  });

  it('traduit l organisation et son role', async () => {
    vi.stubGlobal(
      'fetch',
      repondre(
        chargeConnectee({
          organisation: { id: 'org_1', nom: 'Clinique', identifiant: 'clinique', role: 'admin' },
        }),
      ),
    );
    expect((await appelerPortail('c=1', null))?.organisation).toEqual({
      id: 'org_1',
      nom: 'Clinique',
      identifiant: 'clinique',
      role: 'admin',
    });
  });

  it('retombe sur le role le MOINS puissant quand il est inconnu', async () => {
    // Un role inconnu qui ouvrirait un droit serait une elevation silencieuse.
    vi.stubGlobal(
      'fetch',
      repondre(
        chargeConnectee({ organisation: { id: 'o', nom: 'C', identifiant: 'c', role: undefined } }),
      ),
    );
    expect((await appelerPortail('c=1', null))?.organisation?.role).toBe('member');
  });

  it('ne laisse passer aucun champ inconnu de la charge', async () => {
    /*
      Aucun `{ ...brut }` dans `transport.ts` : un champ que le portail ajouterait un jour
      traverserait jusqu aux produits sans qu une seule decision ait ete prise.
    */
    vi.stubGlobal(
      'fetch',
      repondre({
        ...chargeConnectee(),
        secret: 'jamais',
        user: { id: 'u', email: 'e', jeton: 'x' },
      }),
    );
    const session = await appelerPortail('c=1', null);

    expect(session).not.toHaveProperty('secret');
    expect(session?.user).not.toHaveProperty('jeton');
    expect(Object.keys(session!).sort()).toEqual([
      'acces',
      'echu',
      'organisation',
      'session',
      'user',
    ]);
  });

  it('ecarte un acces illisible sans jeter les autres', async () => {
    vi.stubGlobal('fetch', repondre(chargeConnectee({ acces: [null, accesPublic()] })));
    expect((await appelerPortail('c=1', 'lab'))?.acces).toHaveLength(1);
  });

  it('rend un tableau vide quand acces n est pas un tableau', async () => {
    vi.stubGlobal('fetch', repondre(chargeConnectee({ acces: 'oui' })));
    expect((await appelerPortail('c=1', 'lab'))?.acces).toEqual([]);
  });
});
