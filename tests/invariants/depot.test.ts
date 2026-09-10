import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * CE QU UN DEPOT PUBLIC ET AUTONOME DOIT GARDER, ET QUE LE MONOREPO GARDAIT POUR LUI.
 *
 * Tant que le SDK vivait dans `ai5d-platform`, sa version n existait pas, ses reglages de
 * compilation arrivaient par heritage, et personne d exterieur ne lisait ses fichiers. Depuis
 * le sprint 16 il a un numero, il compile chez des consommateurs qui ne sont pas lui, et tout
 * le monde peut le lire. Chaque garde ci-dessous ferme l un de ces trois changements.
 */

const PAQUET = JSON.parse(readFileSync('package.json', 'utf8')) as {
  version?: string;
  files?: string[];
};

/** Tous les fichiers du depot, hors dependances et hors historique git. */
function tousLesFichiers(dossier = '.'): string[] {
  const sortie: string[] = [];
  for (const entree of readdirSync(dossier)) {
    if (entree === 'node_modules' || entree === '.git') continue;
    const chemin = join(dossier, entree);
    if (statSync(chemin).isDirectory()) sortie.push(...tousLesFichiers(chemin));
    else sortie.push(chemin.replace(/\\/g, '/'));
  }
  return sortie;
}

/** Les commentaires ont le droit de citer ce qu ils expliquent ; pas les declarations. */
function declarations(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

/**
 * Les formes de secret de l ecosysteme, les memes que le balayage de l historique fait avant
 * la premiere poussee (SPEC 5.2) : cle produit AI5D, cle Resend, cle privee, chaine de
 * connexion portant un mot de passe.
 */
const SECRETS = [
  /ai5d_sk_(live|test)_[A-Za-z0-9]{20,}/,
  /re_[A-Za-z0-9]{16,}/,
  /BEGIN [A-Z ]*PRIVATE KEY/,
  /postgres(ql)?:\/\/[^ ]*:[^ ]*@/,
];

describe('une version est un fait verifiable', () => {
  it('package.json porte une version semantique', () => {
    expect(PAQUET.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('le journal a une entree pour cette version', () => {
    // Une etiquette sans raison ecrite est une intention, pas une version.
    const lignes = readFileSync('CHANGELOG.md', 'utf8').split('\n');
    expect(
      lignes.some((l) => l.startsWith(`## ${PAQUET.version} `)),
      `aucune entree « ## ${PAQUET.version} » dans CHANGELOG.md`,
    ).toBe(true);
  });

  it('livre ses sources, jamais ses tests', () => {
    // pnpm respecte `files` pour une dependance GitHub : des tests livres finiraient dans
    // chaque produit, et avec eux leurs fixtures.
    expect(PAQUET.files).toContain('src');
    expect((PAQUET.files ?? []).some((f) => f.startsWith('tests'))).toBe(false);
  });
});

describe('le SDK compile chez des consommateurs qui ne sont pas lui', () => {
  it('garde les reglages les plus stricts de l ecosysteme', () => {
    // Seuls les commentaires en ligne entiere sont retires : aucune chaine n y est touchee.
    const brut = readFileSync('tsconfig.json', 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');
    const options = (JSON.parse(brut) as { compilerOptions: Record<string, unknown> })
      .compilerOptions;
    for (const reglage of [
      'strict',
      'exactOptionalPropertyTypes',
      'noUncheckedIndexedAccess',
      'noImplicitOverride',
    ]) {
      expect(options[reglage], `${reglage} doit valoir true`).toBe(true);
    }
  });
});

describe('la surface publique reconnait une panne de Compte', () => {
  it('exporte PortailIndisponibleErreur (SPEC ecart 0.15)', () => {
    const code = declarations(readFileSync('src/index.ts', 'utf8'));
    expect(code).toMatch(/export \{[^}]*\bPortailIndisponibleErreur\b[^}]*\} from '\.\/erreurs'/);
  });
});

describe('un depot public ne contient rien a prendre', () => {
  const fichiers = tousLesFichiers();

  it('aucune forme de secret dans les fichiers', () => {
    for (const fichier of fichiers) {
      const texte = readFileSync(fichier, 'utf8');
      for (const motif of SECRETS) {
        expect(motif.test(texte), `${fichier} porte une forme de secret : ${motif}`).toBe(false);
      }
    }
  });

  it('aucun fichier .env hors .env.example', () => {
    const env = fichiers.filter(
      (f) => /(^|\/)\.env(\..+)?$/.test(f) && !f.endsWith('.env.example'),
    );
    expect(env).toEqual([]);
  });
});
