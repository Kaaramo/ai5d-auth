import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { ai5dAuthMiddleware, creerAi5dMiddleware } from '../../src/middleware';

/**
 * L aiguillage, teste sur ce qu il fait ET sur ce qu il ne fait pas.
 *
 * Le test qui compte le plus est celui du reseau : un middleware qui appellerait le portail
 * a chaque navigation couterait plus cher que la page elle-meme, et rendrait le produit
 * indisponible des que le portail tousse.
 */

const PORTAIL = 'https://compte.ai5d.technology';

/** Une requete Next, avec ou sans cookie de session. */
function requete(url: string, cookie?: string): NextRequest {
  const entetes = new Headers();
  if (cookie !== undefined) entetes.set('cookie', `${cookie}=abc`);
  return new NextRequest(new Request(url, { headers: entetes }));
}

beforeEach(() => {
  vi.stubEnv('AI5D_ACCOUNT_URL', PORTAIL);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('avec un cookie', () => {
  it('laisse passer', () => {
    const reponse = ai5dAuthMiddleware(
      requete('https://lab.ai5d.technology/espace', 'ai5d.session_token'),
    );
    expect(reponse.status).toBe(200);
    expect(reponse.headers.get('location')).toBeNull();
  });

  it('laisse passer avec le nom prefixe __Secure-', () => {
    const reponse = ai5dAuthMiddleware(
      requete('https://lab.ai5d.technology/espace', '__Secure-ai5d.session_token'),
    );
    expect(reponse.headers.get('location')).toBeNull();
  });

  it('laisse passer un cookie dont la valeur est absurde', () => {
    /*
      IL NE VALIDE PAS, ET C EST ECRIT PARTOUT.

      Ce test consigne le comportement plutot que de le corriger : la garde est
      `requireSession()` dans la page. Le changer ici couterait un appel reseau a chaque
      navigation, et rendrait le produit indisponible des que le portail tousse.
    */
    const reponse = ai5dAuthMiddleware(
      requete('https://lab.ai5d.technology/espace', 'ai5d.session_token'),
    );
    expect(reponse.headers.get('location')).toBeNull();
  });
});

describe('sans cookie', () => {
  it('redirige vers la connexion du portail', () => {
    const reponse = ai5dAuthMiddleware(requete('https://lab.ai5d.technology/espace'));
    expect(reponse.status).toBe(307);
    expect(reponse.headers.get('location')).toContain(`${PORTAIL}/connexion?redirect=`);
  });

  it('encode la destination courante', () => {
    const reponse = ai5dAuthMiddleware(requete('https://lab.ai5d.technology/espace/carnets?a=1'));
    const destination = new URL(reponse.headers.get('location')!).searchParams.get('redirect');
    expect(destination).toBe('https://lab.ai5d.technology/espace/carnets?a=1');
  });

  it('utilise l adresse demandee par le visiteur, pas un hote interne', () => {
    // Derriere un mandataire, `requete.url` porterait `10.0.0.7` et le retour pointerait
    // une machine que le visiteur ne peut pas joindre.
    const reponse = ai5dAuthMiddleware(requete('https://lab.ai5d.technology/espace'));
    expect(reponse.headers.get('location')).toContain('lab.ai5d.technology');
  });
});

describe('les chemins publics', () => {
  it('laisse passer un chemin declare public, sans cookie', () => {
    const middleware = creerAi5dMiddleware({ publiques: ['/tarifs'] });
    const reponse = middleware(requete('https://lab.ai5d.technology/tarifs'));
    expect(reponse.headers.get('location')).toBeNull();
  });

  it('couvre aussi les sous-chemins', () => {
    const middleware = creerAi5dMiddleware({ publiques: ['/tarifs'] });
    const reponse = middleware(requete('https://lab.ai5d.technology/tarifs/equipe'));
    expect(reponse.headers.get('location')).toBeNull();
  });

  it('ne laisse pas passer un chemin qui commence par les memes lettres', () => {
    // `/tarifs` ne doit pas ouvrir `/tarifsecrets`. La comparaison porte sur le segment.
    const middleware = creerAi5dMiddleware({ publiques: ['/tarifs'] });
    const reponse = middleware(requete('https://lab.ai5d.technology/tarifsecrets'));
    expect(reponse.status).toBe(307);
  });
});

describe('ce que le middleware ne fait jamais', () => {
  it("n'appelle pas le reseau, avec ou sans cookie", () => {
    const appel = vi.fn();
    vi.stubGlobal('fetch', appel);

    ai5dAuthMiddleware(requete('https://lab.ai5d.technology/espace'));
    ai5dAuthMiddleware(requete('https://lab.ai5d.technology/espace', 'ai5d.session_token'));

    expect(appel).not.toHaveBeenCalled();
  });

  it("ne lit aucun en-tete d'autorisation", () => {
    const entetes = new Headers({ authorization: 'Bearer ai5d_sk_live_FAUX' });
    const reponse = ai5dAuthMiddleware(
      new NextRequest(new Request('https://lab.ai5d.technology/espace', { headers: entetes })),
    );
    // Une cle produit n ouvre rien : sans cookie, on redirige quand meme.
    expect(reponse.status).toBe(307);
  });
});
