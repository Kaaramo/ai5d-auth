'use client';

import { Bouton, Carte, Pastille } from '@ai5d/design-system/composants';
import { useActiveOrganization, useSession } from './hooks';
import { usePortail } from './contexte';
import { lienPortail } from './lien';
import type { AccesProduit } from '../types';

/**
 * L ecran que voit une personne CONNECTEE qui n a pas le droit demande.
 *
 * ── LA REGLE QUI LE GOUVERNE : ON NOMME QUI PEUT LEVER LE BLOCAGE ───────────
 * « Acces refuse » seul laisse la personne devant une porte sans savoir a qui frapper.
 * C est la formulation de reference du systeme de design, `noyau/formulations.md`, et elle
 * vaut ici plus qu ailleurs : la personne devant cet ecran n a rien fait de mal, elle a
 * simplement suivi un lien qu on lui a envoye.
 *
 * ── LE TROISIEME CAS EST CELUI QU ON OUBLIE ─────────────────────────────────
 * « Votre acces a pris fin le 20 aout » repond a la question qu on se pose vraiment en
 * arrivant : pourquoi je n ouvre plus. Sans lui, quelqu un dont l acces s est termine la
 * veille lit « vous n avez pas acces » et croit a une erreur.
 *
 * Il a failli n etre atteignable par aucun chemin, ecart 0.14 : les droits rendus sont les
 * VIVANTS, donc l echu doit voyager separement. Il vient du contexte, ou d une propriete.
 */

export interface ProprietesAccesRefuse {
  /** Le nom lisible du produit, tel qu on veut le lire a l ecran. */
  produit: string;
  /**
   * Le dernier acces echu, quand l appelant le connait deja.
   *
   * Par defaut il vient du contexte de session. La propriete existe pour le cas ou la page
   * attrape `AccesRefuseErreur` dans sa frontiere d erreur, ou le contexte n est pas
   * forcement celui de la page qui a leve.
   */
  echu?: AccesProduit | undefined;
  /** Le nom de l organisation, quand l appelant veut le forcer. Sinon, celui du contexte. */
  organisation?: string | undefined;
}

function dateLongue(date: Date): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

/**
 * Le corps du message, et l ORDRE DES CAS COMPTE.
 *
 * L echeance passe EN PREMIER. Si la condition de l organisation venait d abord, le message
 * d echeance ne s afficherait jamais pour un membre d organisation, c est-a-dire dans le cas
 * le plus frequent : celui d une licence d equipe qui vient de finir.
 */
function corps(produit: string, organisation: string | null, echu: AccesProduit | null): string {
  if (echu !== null && echu.expireLe !== null) {
    return `Votre accès à ${produit} a pris fin le ${dateLongue(echu.expireLe)}.`;
  }
  if (organisation !== null) {
    return `Cet espace demande un accès à ${produit}. Un administrateur de ${organisation} peut vous l'ouvrir.`;
  }
  return `Cet espace demande un accès à ${produit}. Vous pouvez en obtenir un depuis votre compte.`;
}

export function AccesRefuse({ produit, echu, organisation }: ProprietesAccesRefuse) {
  const session = useSession();
  const organisationActive = useActiveOrganization();
  /*
    L adresse du portail vient du CONTEXTE, jamais de `process.env`.

    Next ne remplace dans le paquet du navigateur que les variables prefixees
    `NEXT_PUBLIC_` : lire `AI5D_ACCOUNT_URL` ici levait a l hydratation. Le fournisseur, qui
    s execute au serveur, la transmet.
  */
  const portail = usePortail();

  const nomOrganisation = organisation ?? organisationActive?.nom ?? null;
  const dernierEchu = echu ?? session?.echu ?? null;

  return (
    <Carte>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--espace-4)' }}>
        {/*
          AUCUNE ICONE DANS CETTE PASTILLE, ET C EST UN ARBITRAGE.

          Le premier jet y posait un cadenas de Lucide. Le systeme de design installe cette
          bibliotheque pour lui-meme, mais l importer ICI en ferait une CINQUIEME dependance
          de pair du SDK, a declarer par chaque produit qui l adopte.

          Le principe du sprint est d exposer trop peu plutot que trop : la pastille dit
          « Acces requis » en toutes lettres, et le mot porte l information mieux qu un
          pictogramme. Aucune information n est portee par la seule couleur non plus, ce que
          le systeme de design exige.
        */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--espace-2)' }}>
          <Pastille ton="attention">Accès requis</Pastille>
        </div>

        <h1
          style={{
            margin: 0,
            fontFamily: 'var(--police-titre)',
            fontSize: 'var(--taille-xl)',
            color: 'var(--texte)',
          }}
        >
          Vous n&apos;avez pas accès à {produit}
        </h1>

        <p
          style={{
            margin: 0,
            fontFamily: 'var(--police-corps)',
            fontSize: 'var(--taille-md)',
            color: 'var(--texte-faible)',
            lineHeight: 1.6,
          }}
        >
          {corps(produit, nomOrganisation, dernierEchu)}
        </p>

        <div style={{ display: 'flex', gap: 'var(--espace-2)' }}>
          {/*
            Un lien d action se fait par `window.location.assign`, comme dans le portail :
            `Bouton` rend un `<button>` et n accepte pas de `href`. Voir `LienInvalide.tsx`.
          */}
          <Bouton
            type="button"
            onClick={() => window.location.assign(lienPortail(portail, '/acces'))}
          >
            Voir mes accès
          </Bouton>
        </div>
      </div>
    </Carte>
  );
}
