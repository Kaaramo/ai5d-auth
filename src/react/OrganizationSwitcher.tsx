'use client';

import { useEffect, useState } from 'react';
import { Pastille } from '@ai5d/design-system/composants';
import { useActiveOrganization } from './hooks';
import { usePortail } from './contexte';
import { lienPortail } from './lien';

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
 *
 * ── LE ROLE EST UNE PASTILLE, COMME DANS LE PORTAIL ─────────────────────────
 * Depuis la version 1.1.0. Le portail montre le role de la personne dans une pastille
 * d information ; le SDK l ecrivait en texte pale apres une virgule. Le meme fait se lit
 * desormais de la meme facon dans le portail et dans un produit.
 */

const LIBELLE_ROLE: Record<string, string> = {
  owner: 'propriétaire',
  admin: 'administrateur',
  member: 'membre',
};

export function OrganizationSwitcher() {
  const organisation = useActiveOrganization();
  // Du contexte, jamais de `process.env` : Next ne l inline pas dans le navigateur.
  const portail = usePortail();

  /*
    LE RETOUR N EST LU QU APRES L HYDRATATION. Version 1.0.1.

    Le lire pendant le rendu, derriere une garde sur `window`, donnait deux liens differents :
    sans `redirect` au serveur, ou `window` n existe pas, et avec au premier rendu du
    navigateur. React signalait une erreur d hydratation sur chaque page qui affiche ce
    composant. La recette du sprint 16 l a vue au navigateur ; celle du sprint 06 n en avait
    ouvert aucun, et jsdom a toujours un `window`, donc aucun test ne pouvait la voir.

    Le premier rendu du navigateur ecrit donc le meme lien que le serveur, et l effet ajoute le
    retour juste apres. Les crochets precedent le retour anticipe : leur ordre ne doit jamais
    dependre d une condition.
  */
  const [retour, setRetour] = useState<string | undefined>(undefined);
  useEffect(() => {
    setRetour(window.location.href);
  }, []);

  if (organisation === null) return null;

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
      <span>{organisation.nom}</span>
      <Pastille ton="information">{LIBELLE_ROLE[organisation.role] ?? organisation.role}</Pastille>

      {/*
        Le lien est TOUJOURS affiche des qu il y a une organisation, et non seulement quand
        il y en a plusieurs.

        Le SDK ne sait pas combien la personne en a : le contexte ne porte que l ACTIVE, et
        aller chercher la liste demanderait un second appel a chaque page. Le portail, lui,
        le sait, et affichera une liste a une entree si c est le cas. Mieux vaut un lien de
        trop qu un appel reseau par page.
      */}
      <a
        href={lienPortail(portail, '/organisations', retour)}
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
