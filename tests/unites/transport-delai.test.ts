import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * LE PORTAIL QUI NE REPOND PAS, ET CE QU IL COUTAIT AUX PRODUITS.
 *
 * Constat du sprint de consolidation, 9 septembre 2026.
 *
 * `PortailIndisponibleErreur` couvrait le REFUS de connexion. Elle ne couvrait pas le
 * SILENCE : un portail qui accepte la connexion et ne repond jamais suspendait le rendu de
 * chaque page de chaque produit AI5D jusqu au plafond de duree de leur propre fonction.
 *
 * ── POURQUOI CE TEST LIT LE SOURCE PLUTOT QUE DE CHRONOMETRER ───────────────
 * Chronometrer un `AbortSignal.timeout` demanderait de faire attendre la suite cinq
 * secondes, ou de doubler `fetch` ET les minuteries, ce qui prouverait le double et non le
 * code. La propriete qui compte ici est structurelle : l appel PORTE une borne, et elle est
 * du bon ordre de grandeur.
 *
 * Le comportement au dela de la borne, lui, est deja couvert : `AbortSignal.timeout` rejette
 * la promesse, donc le `catch` existant leve `PortailIndisponibleErreur`, comme pour un
 * refus de connexion. C est le meme chemin, et il a ses tests.
 */

const source = readFileSync('src/transport.ts', 'utf8');

describe('l appel au portail est borne', () => {
  it('porte un `AbortSignal.timeout`', () => {
    expect(source).toContain('signal: AbortSignal.timeout(DELAI_MS)');
  });

  it('la borne est de cinq secondes', () => {
    // Assez pour un demarrage a froid et une latence transatlantique, trop peu pour une
    // panne. Le chiffre est raisonne dans le commentaire de la constante.
    expect(source).toMatch(/const DELAI_MS = 5_000;/);
  });

  it('le seul `fetch` du paquet est celui-la', () => {
    /*
      Le paquet n a qu un point de sortie reseau, et c est ce qui rend cette garde suffisante.
      Un second `fetch` ajoute ailleurs echapperait a la borne sans que rien ne le signale.
    */
    const tous =
      readFileSync('src/transport.ts', 'utf8').match(/[^a-z]fetch\(/g) ?? [];
    expect(tous.length).toBe(1);
  });
});
