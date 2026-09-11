# Journal des versions

Chaque version porte une étiquette annotée `vX.Y.Z`. Épinglez toujours une étiquette, jamais une
branche. La règle de ce qui est majeur, mineur ou correctif est dans le README.

## 1.0.2 : 11 septembre 2026

Correctif de sûreté. Aucune signature ne change.

- L'adresse de retour après connexion n'est acceptée que si elle désigne le même hôte que la page
  demandée. Sur une route hors du `matcher` du middleware, rien n'écrasait l'en-tête
  `x-ai5d-url` : une requête pouvait proposer sa propre destination. AI5D Compte la refusait
  déjà ; le SDK ne la produit plus. Sans adresse de retour utilisable, la personne arrive sur
  l'accueil de son compte, comportement déjà en place.
- `AI5D_ACCOUNT_URL` doit être une URL, et être en `https` hors de `localhost` et
  `127.0.0.1`. Une adresse en clair enverrait le cookie de session de chaque visiteur sans
  chiffrement. L'erreur nomme la variable et la règle, jamais la valeur reçue.

## 1.0.1 : 10 septembre 2026

Correctif. Aucune signature ne change.

- `OrganizationSwitcher` ne provoque plus d'erreur d'hydratation. Il lisait l'adresse de la page
  pendant son rendu : le serveur écrivait un lien « Changer d'organisation » sans adresse de
  retour, le navigateur un lien avec, et React le signalait sur chaque page qui affiche le
  composant. L'adresse de retour est désormais ajoutée juste après l'hydratation. Le lien et son
  retour sont inchangés pour la personne qui clique.

## 1.0.0 : 10 septembre 2026

Première version autonome.

- Le SDK quitte le dépôt privé de la plateforme AI5D pour ce dépôt public, avec son historique :
  seize commits, extraits par `git subtree split` au commit `0d8092b` de la plateforme.
- La surface est identique à celle livrée au sprint 06. Aucune signature ne change.
- Un ajout : `PortailIndisponibleErreur` est exportée par `@ai5d/auth`. Elle montait déjà jusqu'à
  votre produit quand AI5D Compte ne répondait pas ; vous pouvez désormais la reconnaître par sa
  classe, et afficher une indisponibilité au lieu de renvoyer vers la connexion.
- L'installation se fait par étiquette, `github:Kaaramo/ai5d-auth#v1.0.0`, toujours avec le
  système de design (voir le README, section Installer).
