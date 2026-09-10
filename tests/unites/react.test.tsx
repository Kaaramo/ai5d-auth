// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { FournisseurAi5d } from '../../src/react/contexte';
import {
  useActiveOrganization,
  useProductAccess,
  useSession,
} from '../../src/react/hooks';
import { AccesRefuse } from '../../src/react/AccesRefuse';
import { UserButton } from '../../src/react/UserButton';
import { OrganizationSwitcher } from '../../src/react/OrganizationSwitcher';
import type { AccesProduit, Ai5dSession } from '../../src/types';

/**
 * Les trois crochets et les trois composants.
 *
 * Le test qui compte le plus est celui du reseau : AUCUN des six ne doit appeler `fetch`.
 * Un hook qui irait chercher la session lui-meme obligerait a ouvrir CORS sur la route de
 * session, donc a l ouvrir a tout script charge dans la page d un produit.
 */

const PORTAIL = 'https://compte.ai5d.technology';

function acces(surcharge: Partial<AccesProduit> = {}): AccesProduit {
  return {
    id: 'pac_1',
    produit: 'lab',
    sujet: { type: 'organization', id: 'org_1' },
    statut: 'ACTIVE',
    source: 'ORG_LICENSE',
    plan: 'equipe-25',
    sieges: 25,
    accordeLe: new Date('2026-09-02T10:12:00.000Z'),
    expireLe: null,
    ...surcharge,
  };
}

function session(surcharge: Partial<Ai5dSession> = {}): Ai5dSession {
  return {
    user: {
      id: 'usr_1',
      email: 'awa@exemple.fr',
      emailVerified: true,
      name: 'Awa Ndiaye',
      image: null,
      status: 'ACTIVE',
    },
    session: { id: 'ses_1', expiresAt: new Date('2026-10-08T09:12:00.000Z') },
    organisation: null,
    acces: [],
    echu: null,
    ...surcharge,
  };
}

function organisation(role: 'owner' | 'admin' | 'member' = 'admin') {
  return { id: 'org_1', nom: 'Clinique Saint-Louis', identifiant: 'clinique', role };
}

/**
 * Rend un composant sous le fournisseur, ou sans lui quand `valeur` est `undefined`.
 *
 * On pose `FournisseurAi5d`, le fournisseur CLIENT, et non `Ai5dProvider` qui s execute au
 * serveur : ce dernier lit `AI5D_ACCOUNT_URL` pour en deduire le portail, et c est
 * precisement ce qu on veut fournir ici a la main.
 */
function poser(noeud: React.ReactNode, valeur?: Ai5dSession | null) {
  if (valeur === undefined) return render(<>{noeud}</>);
  return render(
    <FournisseurAi5d valeur={{ session: valeur, portail: PORTAIL }}>{noeud}</FournisseurAi5d>,
  );
}

beforeEach(() => {
  vi.stubEnv('AI5D_ACCOUNT_URL', PORTAIL);
});

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('les crochets', () => {
  function Sonde() {
    const s = useSession();
    const o = useActiveOrganization();
    const a = useProductAccess();
    return (
      <div>
        <span data-testid="session">{s === null ? 'aucune' : s.user.email}</span>
        <span data-testid="organisation">{o === null ? 'aucune' : o.nom}</span>
        <span data-testid="acces">{a.length}</span>
      </div>
    );
  }

  it('rendent ce que le fournisseur a pose', () => {
    poser(<Sonde />, session({ organisation: organisation(), acces: [acces()] }));

    expect(screen.getByTestId('session')).toHaveTextContent('awa@exemple.fr');
    expect(screen.getByTestId('organisation')).toHaveTextContent('Clinique Saint-Louis');
    expect(screen.getByTestId('acces')).toHaveTextContent('1');
  });

  it('rendent vide quand la session est nulle', () => {
    poser(<Sonde />, null);

    expect(screen.getByTestId('session')).toHaveTextContent('aucune');
    expect(screen.getByTestId('organisation')).toHaveTextContent('aucune');
    expect(screen.getByTestId('acces')).toHaveTextContent('0');
  });

  it('rendent vide HORS fournisseur, sans lever', () => {
    /*
      Un composant partage entre une page protegee et une page publique existe dans les deux.
      Une levee transformerait l oubli du fournisseur sur la page publique en PAGE BLANCHE,
      alors que la bonne reponse est « pas de session », qui est vraie.
    */
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(() => poser(<Sonde />)).not.toThrow();
    expect(screen.getByTestId('session')).toHaveTextContent('aucune');
  });

  it('avertissent hors fournisseur, en developpement', () => {
    const avertir = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    poser(<Sonde />);
    expect(avertir).toHaveBeenCalled();
    expect(String(avertir.mock.calls[0]?.[0])).toContain('Ai5dProvider');
  });

  it("n'appellent JAMAIS le reseau", () => {
    const appel = vi.fn();
    vi.stubGlobal('fetch', appel);
    poser(<Sonde />, session({ organisation: organisation(), acces: [acces()] }));
    expect(appel).not.toHaveBeenCalled();
  });

  /*
    LA GARDE « AUCUN isLoading » N EST PAS ICI, ET C EST DELIBERE.

    Elle y a d abord ete ecrite, et elle a refuse le fichier des sa premiere execution :
    l en-tete de `hooks.ts` dit « IL N Y A PAS D `isLoading` », donc le commentaire qui
    explique la regle la declenchait.

    Elle vit desormais dans `tests/invariants/sdk.test.ts`, qui retire les commentaires avant
    de chercher et couvre tout le paquet plutot que deux fichiers. C est le bon endroit :
    c est une propriete de la SURFACE PUBLIQUE, pas un comportement de rendu.
  */
});

describe('AccesRefuse', () => {
  it('oriente vers le compte personnel quand il n y a pas d organisation', () => {
    poser(<AccesRefuse produit="Lab AI5D" />, session());
    expect(screen.getByText(/depuis votre compte/)).toBeInTheDocument();
  });

  it("nomme l'organisation quand il y en a une", () => {
    // « Contactez votre administrateur » laisserait la personne devant la question
    // « lequel ». Le socle sait de quelle organisation il s agit, donc il le dit.
    poser(<AccesRefuse produit="Lab AI5D" />, session({ organisation: organisation('member') }));
    expect(screen.getByText(/administrateur de Clinique Saint-Louis/)).toBeInTheDocument();
  });

  it('donne la date de fin sur un acces echu, MEME dans une organisation', () => {
    /*
      L ordre des cas compte. Si la condition de l organisation venait d abord, ce message
      ne s afficherait jamais pour un membre d organisation, c est-a-dire dans le cas le plus
      frequent : une licence d equipe qui vient de finir.
    */
    poser(
      <AccesRefuse produit="Lab AI5D" />,
      session({
        organisation: organisation('member'),
        echu: acces({ statut: 'EXPIRED', expireLe: new Date('2026-10-08T00:00:00.000Z') }),
      }),
    );
    expect(screen.getByText(/a pris fin le 8 octobre 2026/)).toBeInTheDocument();
  });

  it('accepte un acces echu en propriete, pour une frontiere d erreur', () => {
    poser(
      <AccesRefuse
        produit="Lab AI5D"
        echu={acces({ statut: 'EXPIRED', expireLe: new Date('2026-08-20T00:00:00.000Z') })}
      />,
      session(),
    );
    expect(screen.getByText(/a pris fin le 20 août 2026/)).toBeInTheDocument();
  });

  it('nomme le produit dans son titre', () => {
    poser(<AccesRefuse produit="Lab AI5D" />, session());
    expect(screen.getByRole('heading')).toHaveTextContent('Lab AI5D');
  });

  it('propose toujours un retour vers Mes acces', () => {
    poser(<AccesRefuse produit="Lab AI5D" />, session());
    expect(screen.getByRole('button', { name: /Voir mes accès/ })).toBeInTheDocument();
  });

  it("n'ecrit ni tiret cadratin, ni emoji, ni point d'exclamation", () => {
    // La regle de la voix porte sur ce que la personne LIT, pas sur la source.
    const { container } = poser(
      <AccesRefuse produit="Lab AI5D" />,
      session({ organisation: organisation('member') }),
    );
    const texte = container.textContent ?? '';
    expect(texte).not.toContain('—');
    expect(texte).not.toContain('!');
    expect(texte).not.toMatch(/\p{Extended_Pictographic}/u);
  });
});

describe('UserButton', () => {
  it('ne rend rien sans session', () => {
    const { container } = poser(<UserButton />, null);
    expect(container).toBeEmptyDOMElement();
  });

  it('affiche les initiales et le nom', () => {
    poser(<UserButton />, session());
    expect(screen.getByText('AN')).toBeInTheDocument();
    expect(screen.getByText('Awa Ndiaye')).toBeInTheDocument();
  });

  it("retombe sur l'adresse quand le nom manque", () => {
    poser(<UserButton />, session({ user: { ...session().user, name: null } }));
    expect(screen.getByText('awa@exemple.fr')).toBeInTheDocument();
  });

  it('porte exactement trois entrees, toutes vers le portail', () => {
    poser(<UserButton />, session());
    fireEvent.click(screen.getByRole('button'));

    const liens = screen.getAllByRole('menuitem');
    expect(liens).toHaveLength(3);
    for (const lien of liens) {
      expect(lien.getAttribute('href')).toContain(PORTAIL);
    }
  });

  it('encode le retour de la deconnexion', () => {
    // La deconnexion revoque la session EN BASE : un produit qui effacerait le cookie de son
    // cote ne ferait rien du tout, il est `HttpOnly`.
    poser(<UserButton />, session());
    fireEvent.click(screen.getByRole('button'));

    const deconnexion = screen.getByRole('menuitem', { name: /Se déconnecter/ });
    expect(deconnexion.getAttribute('href')).toContain(`${PORTAIL}/deconnexion`);
  });

  it("n'appelle jamais le reseau, meme a l'ouverture du menu", () => {
    const appel = vi.fn();
    vi.stubGlobal('fetch', appel);
    poser(<UserButton />, session());
    fireEvent.click(screen.getByRole('button'));
    expect(appel).not.toHaveBeenCalled();
  });
});

describe('OrganizationSwitcher', () => {
  it('ne rend rien sans organisation', () => {
    const { container } = poser(<OrganizationSwitcher />, session());
    expect(container).toBeEmptyDOMElement();
  });

  it('affiche le nom et le role en toutes lettres', () => {
    poser(<OrganizationSwitcher />, session({ organisation: organisation('admin') }));
    expect(screen.getByText(/Clinique Saint-Louis/)).toBeInTheDocument();
    expect(screen.getByText(/administrateur/)).toBeInTheDocument();
  });

  it('pointe le portail, jamais une action locale', () => {
    poser(<OrganizationSwitcher />, session({ organisation: organisation() }));
    const lien = screen.getByRole('link', { name: /Changer d'organisation/ });
    expect(lien.getAttribute('href')).toContain(`${PORTAIL}/organisations`);
  });

  it("n'appelle jamais le reseau", () => {
    const appel = vi.fn();
    vi.stubGlobal('fetch', appel);
    poser(<OrganizationSwitcher />, session({ organisation: organisation() }));
    expect(appel).not.toHaveBeenCalled();
  });
});
