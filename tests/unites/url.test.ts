import { afterEach, describe, expect, it } from 'vitest';
import { baseCompte, retourSur, urlPortail } from '../../src/url';

/**
 * Les deux controles ajoutes en 1.0.2 : le protocole du portail, et l hote du retour.
 *
 * Les deux ferment une remarque de la revue du gardien des frontieres du sprint 16. Ni l un ni
 * l autre ne change une signature : ce sont des refus la ou le SDK acceptait sur parole.
 */

const ORIGINE = process.env.AI5D_ACCOUNT_URL;

afterEach(() => {
  if (ORIGINE === undefined) delete process.env.AI5D_ACCOUNT_URL;
  else process.env.AI5D_ACCOUNT_URL = ORIGINE;
});

describe('baseCompte : ce qui est accepte, et ce qui leve', () => {
  it.each([
    ['https://compte.ai5d.technology', 'https://compte.ai5d.technology'],
    ['https://compte.ai5d.technology/', 'https://compte.ai5d.technology'],
    // Le poste de travail reste permis, sinon personne ne peut developper.
    ['http://localhost:3000', 'http://localhost:3000'],
    ['http://127.0.0.1:3000', 'http://127.0.0.1:3000'],
  ])('accepte %s', (pose, attendu) => {
    process.env.AI5D_ACCOUNT_URL = pose;
    expect(baseCompte()).toBe(attendu);
  });

  it.each([
    ['une adresse en clair hors du poste', 'http://compte.ai5d.technology'],
    ['une valeur qui n est pas une URL', 'compte.ai5d.technology'],
    ['une adresse sans hote', 'https://'],
  ])('leve pour %s', (_libelle, pose) => {
    process.env.AI5D_ACCOUNT_URL = pose;
    expect(() => baseCompte()).toThrow(/AI5D_ACCOUNT_URL/);
  });

  it('ne recopie jamais la valeur recue dans son message', () => {
    // Une URL peut porter un identifiant : le message nomme la variable et la regle, rien d autre.
    process.env.AI5D_ACCOUNT_URL = 'http://jeton-secret@exemple.fr';
    let message = '';
    try {
      baseCompte();
    } catch (cause) {
      message = cause instanceof Error ? cause.message : String(cause);
    }
    expect(message).toContain('AI5D_ACCOUNT_URL');
    expect(message).not.toContain('jeton-secret');
  });

  it('leve quand la variable manque, avec le message d avant', () => {
    delete process.env.AI5D_ACCOUNT_URL;
    expect(() => baseCompte()).toThrow(/n'est pas defini/);
  });
});

describe('retourSur : le meme hote, et rien d autre', () => {
  it('accepte une adresse du meme hote', () => {
    expect(retourSur('https://lab.ai5d.technology/espace', 'lab.ai5d.technology')).toBe(
      'https://lab.ai5d.technology/espace',
    );
  });

  it.each([
    ['un autre hote', 'https://attaquant.fr/piege', 'lab.ai5d.technology'],
    ['un hote absent', 'https://lab.ai5d.technology/espace', null],
    ['un hote vide', 'https://lab.ai5d.technology/espace', ''],
    ['une adresse relative', '/espace', 'lab.ai5d.technology'],
    ['une valeur illisible', 'pas une url', 'lab.ai5d.technology'],
    ['une chaine vide', '', 'lab.ai5d.technology'],
    ['une valeur absente', null, 'lab.ai5d.technology'],
    ['une valeur indefinie', undefined, 'lab.ai5d.technology'],
  ])('ignore %s', (_libelle, brut, hote) => {
    expect(retourSur(brut, hote)).toBeUndefined();
  });

  it('compare le port aussi : un autre port est un autre hote', () => {
    expect(retourSur('https://lab.ai5d.technology:8443/x', 'lab.ai5d.technology')).toBeUndefined();
  });

  it('accepte le poste de travail, port compris', () => {
    expect(retourSur('http://localhost:3002/espace', 'localhost:3002')).toBe(
      'http://localhost:3002/espace',
    );
  });
});

describe('urlPortail ne change pas', () => {
  it('encode la destination de retour', () => {
    process.env.AI5D_ACCOUNT_URL = 'https://compte.ai5d.technology';
    expect(urlPortail('/connexion', 'https://lab.ai5d.technology/espace')).toBe(
      'https://compte.ai5d.technology/connexion?redirect=https%3A%2F%2Flab.ai5d.technology%2Fespace',
    );
  });

  it('rend une URL du portail sans retour quand on ne lui en donne pas', () => {
    process.env.AI5D_ACCOUNT_URL = 'https://compte.ai5d.technology';
    expect(urlPortail('/connexion')).toBe('https://compte.ai5d.technology/connexion');
  });
});
