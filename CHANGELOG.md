# Journal des versions

Chaque version porte une étiquette annotée `vX.Y.Z`. Épinglez toujours une étiquette, jamais une
branche. La règle de ce qui est majeur, mineur ou correctif est dans le README.

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
