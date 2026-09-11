import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Les sept fonctions serveur.
 *
 * Ce qui est REELLEMENT execute : la lecture du cookie sous ses deux noms, la construction
 * de l URL de retour, la hierarchie des roles, et le cache par requete.
 *
 * Ce qui est double : `requete.ts`, qui nous appartient, et `fetch`. Jamais `next/headers`
 * directement — c est la lecon resservie du sprint 01.
 */

const cookiesGet = vi.fn();
const entetesGet = vi.fn();
const rediriger = vi.fn((_url: string): never => {
  // `redirect()` de Next leve pour interrompre le rendu. Le double doit faire pareil, sans
  // quoi le code apres l appel continuerait de s executer dans le test et pas en production.
  throw new Error('REDIRECTION');
});

vi.mock('../../src/requete', () => ({
  cookiesRequete: async () => ({ get: cookiesGet }),
  entetesRequete: async () => ({ get: entetesGet }),
  rediriger,
}));

const {
  getActiveOrganization,
  getProductAccess,
  getSession,
  requireProductAccess,
  requireRole,
  requireSession,
} = await import('../../src/server');
const { AccesRefuseErreur, RoleRefuseErreur } = await import('../../src/erreurs');

const PORTAIL = 'https://compte.ai5d.technology';

function charge(surcharge: Record<string, unknown> = {}) {
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

function acces(id = 'pac_1', surcharge: Record<string, unknown> = {}) {
  return {
    id,
    product: 'lab',
    subject: { type: 'organization', id: 'org_1' },
    status: 'ACTIVE',
    source: 'ORG_LICENSE',
    plan: 'equipe-25',
    seats: 25,
    externalRef: null,
    metadata: null,
    grantedAt: '2026-09-02T10:12:00.000Z',
    expiresAt: null,
    ...surcharge,
  };
}

function organisation(role: string) {
  return { id: 'org_1', nom: 'Clinique Saint-Louis', identifiant: 'clinique', role };
}

/** Pose un cookie present. `undefined` pour aucun. */
function avecCookie(nom: string | undefined = 'ai5d.session_token') {
  cookiesGet.mockImplementation((demande: string) =>
    demande === nom ? { name: nom, value: 'abc' } : undefined,
  );
}

function repondre(corps: unknown) {
  return vi.fn().mockResolvedValue({ ok: true, json: async () => corps });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('AI5D_ACCOUNT_URL', PORTAIL);
  cookiesGet.mockReturnValue(undefined);
  entetesGet.mockReturnValue(null);
});

describe('getSession — elle avale la panne, contrairement aux autres', () => {
  it('rend null sur une indisponibilite, pour que les pages publiques s affichent', async () => {
    /*
      `getSession()` est appelee par les gabarits et les pages publiques, qui doivent
      s afficher meme quand le portail tousse : une panne y degrade vers l anonyme, ce qui
      est le bon comportement pour un en-tete ou un menu de compte.

      `requireSession()`, elle, laisse monter. Les deux ne servent pas le meme usage.
    */
    avecCookie();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    expect(await getSession()).toBeNull();
  });
});

describe('getSession', () => {
  it('rend null sans cookie, SANS appeler le reseau', async () => {
    const appel = vi.fn();
    vi.stubGlobal('fetch', appel);

    expect(await getSession()).toBeNull();
    expect(appel).not.toHaveBeenCalled();
  });

  it('lit le cookie de la requete courante sans qu on le lui passe', async () => {
    avecCookie();
    const appel = repondre(charge());
    vi.stubGlobal('fetch', appel);

    const session = await getSession();

    expect(session?.user.id).toBe('usr_1');
    const [, options] = appel.mock.calls[0] as [URL, RequestInit];
    expect((options.headers as Record<string, string>).cookie).toBe('ai5d.session_token=abc');
  });

  it('reconnait __Secure-ai5d.session_token', async () => {
    // Le prefixe apparait en HTTPS. N en reconnaitre qu un ferait fonctionner le SDK en
    // local et pas en production.
    avecCookie('__Secure-ai5d.session_token');
    const appel = repondre(charge());
    vi.stubGlobal('fetch', appel);

    await getSession();

    const [, options] = appel.mock.calls[0] as [URL, RequestInit];
    expect((options.headers as Record<string, string>).cookie).toBe(
      '__Secure-ai5d.session_token=abc',
    );
  });

  it('accepte un cookie explicite, pour les usages hors requete', async () => {
    const appel = repondre(charge());
    vi.stubGlobal('fetch', appel);

    await getSession('ai5d.session_token=zzz');

    expect(cookiesGet).not.toHaveBeenCalled();
  });

  it('ne demande aucun droit : elle ne nomme aucun produit', async () => {
    avecCookie();
    const appel = repondre(charge());
    vi.stubGlobal('fetch', appel);

    await getSession();

    const [url] = appel.mock.calls[0] as [URL];
    expect(url.searchParams.has('produit')).toBe(false);
  });
});

describe('requireSession', () => {
  /*
    LA DESTINATION DE RETOUR VIENT DE `x-ai5d-url`, POSE PAR LE MIDDLEWARE.

    Ces tests attendaient une URL construite en concatenant `x-forwarded-host`,
    `x-forwarded-proto` et `x-matched-path`. Constat de la revue du gardien des frontieres :
    ce sont trois valeurs qu un client peut poser, dont aucune n etait validee, et dont la
    derniere porte le chemin APPARIE — donc `/lecon/[id]` au lieu de `/lecon/12`. La
    promesse « on vous ramene ou vous etiez » etait fausse dans le cas courant, et ouvrait
    une redirection au client dans le cas hostile.

    Le SDK ne devine plus son propre hote.
  */
  it('redirige vers le portail avec la page courante encodee', async () => {
    entetesGet.mockImplementation((n: string) =>
      n === 'x-ai5d-url'
        ? 'https://lab.ai5d.technology/espace'
        : n === 'host'
          ? 'lab.ai5d.technology'
          : null,
    );
    vi.stubGlobal('fetch', vi.fn());

    await expect(requireSession()).rejects.toThrow('REDIRECTION');
    expect(rediriger).toHaveBeenCalledWith(
      `${PORTAIL}/connexion?redirect=https%3A%2F%2Flab.ai5d.technology%2Fespace`,
    );
  });

  it('ne fabrique AUCUNE destination quand le middleware n en a pose aucune', async () => {
    /*
      Le cas se produit quand le matcher du middleware ne couvre pas la page. On envoie alors
      vers la connexion SANS `?redirect=` : la personne arrive sur l accueil de son compte
      plutot que sur la page demandee, ce qui est un inconfort.

      Deviner une URL serait pire : ce serait affirmer une destination qu on ne connait pas,
      a partir d en-tetes que le client controle.
    */
    entetesGet.mockReturnValue(null);
    vi.stubGlobal('fetch', vi.fn());

    await expect(requireSession()).rejects.toThrow('REDIRECTION');
    expect(rediriger).toHaveBeenCalledWith(`${PORTAIL}/connexion`);
  });

  it('ignore une adresse de retour d un autre hote, et renvoie sans destination', async () => {
    /*
      VERSION 1.0.2, remarque de la revue du gardien des frontieres du sprint 16.

      Sur une page hors du `matcher`, le middleware ne s execute pas : rien n ecrase
      `x-ai5d-url`, et un client peut le poser lui-meme. Le SDK confronte donc l en-tete a
      `host`, que le navigateur de la personne visee envoie toujours, et ignore ce qui ne
      correspond pas. AI5D Compte refusait deja cette destination ; le SDK ne la propose plus.
    */
    entetesGet.mockImplementation((n: string) =>
      n === 'x-ai5d-url'
        ? 'https://attaquant.fr/piege'
        : n === 'host'
          ? 'lab.ai5d.technology'
          : null,
    );
    vi.stubGlobal('fetch', vi.fn());

    await expect(requireSession()).rejects.toThrow('REDIRECTION');
    expect(rediriger).toHaveBeenCalledWith(`${PORTAIL}/connexion`);
  });

  it('ignore le retour quand l en-tete host manque', async () => {
    // Sans hote, la comparaison est impossible : on ne propose aucune destination.
    entetesGet.mockImplementation((n: string) =>
      n === 'x-ai5d-url' ? 'https://lab.ai5d.technology/espace' : null,
    );
    vi.stubGlobal('fetch', vi.fn());

    await expect(requireSession()).rejects.toThrow('REDIRECTION');
    expect(rediriger).toHaveBeenCalledWith(`${PORTAIL}/connexion`);
  });

  it('ignore x-forwarded-host, que le client peut poser', async () => {
    entetesGet.mockImplementation((n: string) =>
      n === 'x-forwarded-host' ? 'attaquant.fr' : null,
    );
    vi.stubGlobal('fetch', vi.fn());

    await expect(requireSession()).rejects.toThrow('REDIRECTION');
    expect(rediriger.mock.calls[0]![0]).not.toContain('attaquant.fr');
  });

  it('LAISSE MONTER une indisponibilite au lieu de rediriger', async () => {
    /*
      Le cookie est present : la personne EST connectee, et c est le portail qui ne repond
      pas. L envoyer sur `/connexion` la ferait rebondir indefiniment, le portail voyant une
      session valide et renvoyant ici. Une page d erreur est desagreable ; une boucle est
      inutilisable, et elle ne dit meme pas ce qui se passe.
    */
    avecCookie();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));

    await expect(requireSession()).rejects.toMatchObject({ name: 'PortailIndisponibleErreur' });
    expect(rediriger).not.toHaveBeenCalled();
  });

  it('rend la session sans rediriger quand elle existe', async () => {
    avecCookie();
    vi.stubGlobal('fetch', repondre(charge()));

    const session = await requireSession();

    expect(session.user.id).toBe('usr_1');
    expect(rediriger).not.toHaveBeenCalled();
  });
});

describe('getProductAccess', () => {
  it('rend un tableau vide sans cookie, sans appeler le reseau', async () => {
    const appel = vi.fn();
    vi.stubGlobal('fetch', appel);

    expect(await getProductAccess('lab')).toEqual([]);
    expect(appel).not.toHaveBeenCalled();
  });

  it('nomme le produit dans sa demande', async () => {
    avecCookie();
    const appel = repondre(charge({ acces: [acces()] }));
    vi.stubGlobal('fetch', appel);

    await getProductAccess('lab');

    const [url] = appel.mock.calls[0] as [URL];
    expect(url.searchParams.get('produit')).toBe('lab');
  });

  it('rend les DEUX acces quand un personnel et un d equipe coexistent', async () => {
    /*
      Le socle ne dit jamais lequel est le meilleur, regle E2 : il faudrait savoir ce que
      valent les plans, et la plateforme l ignore par construction. Rendre les deux est ce
      qui laisse le produit choisir, parce que lui seul le sait.
    */
    avecCookie();
    vi.stubGlobal(
      'fetch',
      repondre(
        charge({
          acces: [acces('pac_1', { subject: { type: 'user', id: 'usr_1' } }), acces('pac_2')],
        }),
      ),
    );

    const droits = await getProductAccess('lab');
    expect(droits.map((a) => a.id)).toEqual(['pac_1', 'pac_2']);
  });

  it('rend un tableau vide quand le portail dit « pas connecte »', async () => {
    avecCookie();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401 }));
    expect(await getProductAccess('lab')).toEqual([]);
  });

  it('LEVE sur une panne, plutot que de dire « vous n avez pas acces »', async () => {
    /*
      Rendre `[]` pendant une panne du portail refermerait la porte d un produit a des
      clients qui paient, sans que rien ne signale la cause. Un tableau vide doit vouloir
      dire « aucun droit », et rien d autre.
    */
    avecCookie();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }));
    await expect(getProductAccess('lab')).rejects.toMatchObject({
      name: 'PortailIndisponibleErreur',
    });
  });
});

describe('requireProductAccess', () => {
  it('leve AccesRefuseErreur sur un tableau vide', async () => {
    avecCookie();
    vi.stubGlobal('fetch', repondre(charge({ organisation: organisation('member') })));

    await expect(requireProductAccess('lab')).rejects.toBeInstanceOf(AccesRefuseErreur);
  });

  it('porte le produit et le nom de l organisation dans l erreur', async () => {
    // C est ce qui permet a l ecran de refus de dire QUI peut lever le blocage.
    avecCookie();
    vi.stubGlobal('fetch', repondre(charge({ organisation: organisation('member') })));

    await expect(requireProductAccess('lab')).rejects.toMatchObject({
      produit: 'lab',
      organisation: 'Clinique Saint-Louis',
    });
  });

  it('porte une organisation nulle quand il n y en a pas', async () => {
    avecCookie();
    vi.stubGlobal('fetch', repondre(charge()));

    await expect(requireProductAccess('lab')).rejects.toMatchObject({ organisation: null });
  });

  it('ne fait QU UN SEUL appel reseau, session et droits compris', async () => {
    /*
      C est la raison d etre de cette fonction. `requireSession()` puis `getProductAccess()`
      demanderaient deux lectures, avec deux cles de cache differentes : une sans produit,
      une avec. C est ce que le compteur de la demo doit montrer.
    */
    avecCookie();
    const appel = repondre(charge({ acces: [acces()] }));
    vi.stubGlobal('fetch', appel);

    await requireProductAccess('lab');

    expect(appel).toHaveBeenCalledTimes(1);
  });

  it('redirige quand il n y a pas de cookie', async () => {
    vi.stubGlobal('fetch', vi.fn());
    await expect(requireProductAccess('lab')).rejects.toThrow('REDIRECTION');
  });
});

describe('requireRole — la hierarchie du portail', () => {
  async function avecRole(role: string) {
    avecCookie();
    vi.stubGlobal('fetch', repondre(charge({ organisation: organisation(role) })));
  }

  it('laisse passer un owner quand admin est demande', async () => {
    // `peutAdministrer()` du portail repond vrai pour owner. Le SDK ne definit pas sa
    // propre hierarchie : deux hierarchies dans un meme produit sont une elevation.
    await avecRole('owner');
    await expect(requireRole('admin')).resolves.toMatchObject({ role: 'owner' });
  });

  it('laisse passer un admin quand admin est demande', async () => {
    await avecRole('admin');
    await expect(requireRole('admin')).resolves.toMatchObject({ role: 'admin' });
  });

  it('refuse un admin quand owner est demande', async () => {
    await avecRole('admin');
    await expect(requireRole('owner')).rejects.toBeInstanceOf(RoleRefuseErreur);
  });

  it('refuse un member quand admin est demande', async () => {
    await avecRole('member');
    await expect(requireRole('admin')).rejects.toBeInstanceOf(RoleRefuseErreur);
  });

  it('laisse passer tout le monde quand member est demande', async () => {
    await avecRole('member');
    await expect(requireRole('member')).resolves.toMatchObject({ role: 'member' });
  });

  it('traite ADMIN en capitales comme admin', async () => {
    // Le PRD 9.2 ecrit `requireRole('ADMIN')`. Qui recopie l exemple officiel doit tomber
    // juste, meme si la base ecrit en minuscules. Ecart 0.8.
    await avecRole('admin');
    await expect(requireRole('ADMIN')).resolves.toMatchObject({ role: 'admin' });
  });

  it('leve sans organisation active, avec une erreur qui le dit', async () => {
    avecCookie();
    vi.stubGlobal('fetch', repondre(charge()));

    await expect(requireRole('member')).rejects.toMatchObject({
      name: 'RoleRefuseErreur',
      organisation: null,
    });
  });

  it("nomme l'organisation dans le refus, pour dire qui peut lever", async () => {
    await avecRole('member');
    await expect(requireRole('admin')).rejects.toMatchObject({
      organisation: 'Clinique Saint-Louis',
      requis: 'admin',
    });
  });
});

describe('getActiveOrganization', () => {
  it('rend null sans session', async () => {
    vi.stubGlobal('fetch', vi.fn());
    expect(await getActiveOrganization()).toBeNull();
  });

  it("rend l'organisation quand il y en a une", async () => {
    avecCookie();
    vi.stubGlobal('fetch', repondre(charge({ organisation: organisation('admin') })));
    expect((await getActiveOrganization())?.nom).toBe('Clinique Saint-Louis');
  });
});
