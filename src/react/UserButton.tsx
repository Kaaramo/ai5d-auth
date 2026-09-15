'use client';

import { useState } from 'react';
import { Avatar } from '@ai5d/design-system/composants';
import { useSession } from './hooks';
import { usePortail } from './contexte';
import { lienPortail } from './lien';

/**
 * Le menu de compte, dans l en-tete d un produit.
 *
 * ── LA DECONNEXION EST UN LIEN VERS LE PORTAIL, JAMAIS UN GESTE DU PRODUIT ──
 * Elle revoque la session EN BASE, ce qui la ferme partout a la requete suivante,
 * PRD 5.2. Un produit qui effacerait le cookie de son cote ne ferait RIEN DU TOUT : le
 * cookie est `HttpOnly`, donc inaccessible au JavaScript, et la session resterait vivante en
 * base pour tous les autres produits.
 *
 * ── TROIS ENTREES, ET PAS UNE DE PLUS ───────────────────────────────────────
 * Un menu de compte qui grossit finit par contenir les reglages du produit, et personne ne
 * sait plus ce qui appartient a qui. Ces trois-la menent toutes au portail ; tout le reste
 * appartient au produit, qui a son propre endroit pour le mettre.
 *
 * ── LE DISQUE D INITIALES N EST PAS UN ORNEMENT ICI ─────────────────────────
 * L ecart du sprint 03 l a retire du rail du portail, ou il ne servait pas a naviguer. Dans
 * l en-tete d un produit tiers, il est le seul repere qui dit « vous etes connecte, et sous
 * quelle identite ». C est precisement l information du moment aha.
 *
 * ── LE DISQUE EST L AVATAR DU SYSTEME, DEPUIS LA VERSION 1.1.0 ──────────────
 * Le SDK portait son propre disque et sa propre fonction d initiales. Les trois fonctions de
 * l ecosysteme ont ete comparees avant de supprimer celle-ci, decision 004 du systeme : la
 * copie du SDK coupait sur `@` et `.`, et « contact@exemple.fr » donnait CE, une lettre du
 * domaine. L avatar du systeme affiche aussi la photo quand la session en porte une.
 */

export function UserButton() {
  const session = useSession();
  // Du contexte, jamais de `process.env` : Next ne l inline pas dans le navigateur.
  const portail = usePortail();
  const [ouvert, setOuvert] = useState(false);

  /*
    Sans session, il ne rend RIEN.

    Pas un bouton « Se connecter » : c est au produit de decider ou et comment il appelle a
    la connexion, et sous quelle forme. Un SDK qui poserait ce bouton imposerait un parcours
    d entree a des produits dont il ne connait pas la page d accueil.
  */
  if (session === null) return null;

  /*
    Un nom vide vaut un nom absent. `name` peut etre une chaine d espaces : sans ce repli, le
    bouton afficherait un libelle vide et un disque « ? » a cote d une adresse connue.
  */
  const nomSaisi = session.user.name?.trim() ?? '';
  const nom = nomSaisi.length > 0 ? nomSaisi : session.user.email;

  /*
    Le retour de la deconnexion est lu derriere une garde.

    Ce composant est client, mais il est rendu une premiere fois au SERVEUR, ou `window`
    n existe pas. Sans la garde, l hydratation echoue avec un message qui ne dit pas sa
    cause.
  */
  const retour = typeof window === 'undefined' ? undefined : window.location.href;

  const entrees: Array<{ libelle: string; url: string }> = [
    { libelle: 'Mon compte', url: lienPortail(portail, '/accueil') },
    { libelle: 'Mes accès', url: lienPortail(portail, '/acces') },
    { libelle: 'Se déconnecter', url: lienPortail(portail, '/deconnexion', retour) },
  ];

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        onClick={() => setOuvert((o) => !o)}
        aria-expanded={ouvert}
        aria-haspopup="menu"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 'var(--espace-2)',
          padding: 'var(--espace-1) var(--espace-2)',
          background: 'transparent',
          border: '1px solid var(--bordure)',
          borderRadius: 'var(--rayon-md)',
          color: 'var(--texte)',
          fontFamily: 'var(--police-corps)',
          fontSize: 'var(--taille-sm)',
          cursor: 'pointer',
        }}
      >
        {/* Decoratif : le nom est ecrit juste a cote, l annoncer le ferait entendre deux fois. */}
        <Avatar nom={nom} image={session.user.image} taille={28} />
        {/* Le nom disparait sous 1280 px : la classe vient du systeme, pas d une media query
            ecrite ici. En son absence, il reste affiche, ce qui est le defaut le plus sur. */}
        <span>{nom}</span>
      </button>

      {ouvert && (
        <div
          role="menu"
          style={{
            position: 'absolute',
            right: 0,
            marginTop: 'var(--espace-1)',
            minWidth: 200,
            padding: 'var(--espace-1)',
            background: 'var(--surface-2)',
            border: '1px solid var(--bordure)',
            borderRadius: 'var(--rayon-md)',
            boxShadow: 'var(--elevation-2)',
            zIndex: 20,
          }}
        >
          {entrees.map((e) => (
            <a
              key={e.libelle}
              href={e.url}
              role="menuitem"
              style={{
                display: 'block',
                padding: 'var(--espace-2)',
                color: 'var(--texte)',
                fontFamily: 'var(--police-corps)',
                fontSize: 'var(--taille-sm)',
                textDecoration: 'none',
                borderRadius: 'var(--rayon-sm)',
              }}
            >
              {e.libelle}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
