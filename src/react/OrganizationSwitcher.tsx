'use client';

import { useActiveOrganization } from './hooks';
import { urlPortail } from '../url';

/**
 * Le contexte actif : l organisation dans laquelle on travaille.
 *
 * ── IL NE CHANGE RIEN LUI-MEME, ET C EST UNE DECISION ───────────────────────
 * Changer l organisation active est une ECRITURE. Elle vit dans le portail, derriere une
 * verification d appartenance : sans elle, un identifiant devine suffirait a se poser dans
 * l organisation de quelqu un d autre.
 *
 * La faire depuis un produit aurait demande soit une route d ecriture cross-origin avec sa
 * protection CSRF propre, soit une seconde implementation du geste. La premiere ajoute la
 * surface d ecriture la plus delicate du socle sur un chemin cross-origin, pour un confort.
 * La seconde met deux implementations d un meme geste a deux endroits, et le jour ou l une
 * oublie de verifier l appartenance, personne ne le voit.
 *
 * Le detour par le portail coute deux clics. Il evite qu un jour un produit se trompe et
 * fasse travailler quelqu un pour le mauvais client. Ecart 0.6.
 *
 * ── TROIS ETATS, ET LE PREMIER EST DE NE RIEN AFFICHER ──────────────────────
 * Aucune organisation : rien. Un selecteur vide occuperait la place et poserait une question
 * sans reponse. C est la meme regle que le selecteur du portail, ecrite au sprint 03.
 */

const LIBELLE_ROLE: Record<string, string> = {
  owner: 'propriétaire',
  admin: 'administrateur',
  member: 'membre',
};

export function OrganizationSwitcher() {
  const organisation = useActiveOrganization();

  if (organisation === null) return null;

  /*
    Le retour est lu derriere une garde : ce composant est client, mais il est rendu une
    premiere fois au serveur, ou `window` n existe pas.
  */
  const retour = typeof window === 'undefined' ? undefined : window.location.href;

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--espace-2)',
        fontFamily: 'var(--police-corps)',
        fontSize: 'var(--taille-sm)',
        color: 'var(--texte)',
      }}
    >
      <span>
        {organisation.nom}
        <span style={{ color: 'var(--texte-faible)' }}>
          {', '}
          {LIBELLE_ROLE[organisation.role] ?? organisation.role}
        </span>
      </span>

      {/*
        Le lien est TOUJOURS affiche des qu il y a une organisation, et non seulement quand
        il y en a plusieurs.

        Le SDK ne sait pas combien la personne en a : le contexte ne porte que l ACTIVE, et
        aller chercher la liste demanderait un second appel a chaque page. Le portail, lui,
        le sait, et affichera une liste a une entree si c est le cas. Mieux vaut un lien de
        trop qu un appel reseau par page.
      */}
      <a
        href={urlPortail('/organisations', retour)}
        style={{
          color: 'var(--action)',
          fontSize: 'var(--taille-xs)',
          textDecoration: 'none',
        }}
      >
        Changer d&apos;organisation
      </a>
    </div>
  );
}
