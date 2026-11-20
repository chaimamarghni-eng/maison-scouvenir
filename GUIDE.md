# Maison SCouvenir : guide d'utilisation

Application de gestion des commandes, en français, montants en dinars tunisiens (DT).
Elle fonctionne sur iPhone et sur ordinateur, même sans connexion, avec un accès protégé par identifiant et mot de passe.

## 1. Mettre l'application en ligne gratuitement (une seule fois, environ 15 minutes)

L'application est hébergée chez **Cloudflare**, gratuitement et sans carte bancaire.
Vous obtiendrez une adresse du type `https://maison-scouvenir.pages.dev`, utilisable par vous et votre collègue.

### Étape 1 : GitHub (là où est rangé le code)
1. Créez un compte gratuit sur https://github.com (si vous n'en avez pas).
2. En haut à droite, **+ → New repository**.
3. Nom : `maison-scouvenir`, cochez **Private**, ne cochez rien d'autre, puis **Create repository**.
4. Prévenez Claude : le code y sera envoyé pour vous.
   (Autre solution : sur la page du dépôt, **uploading an existing file**, puis glissez tout le contenu du dossier `maison-scouvenir`.)

### Étape 2 : Cloudflare (là où l'application tourne)
1. Créez un compte gratuit sur https://dash.cloudflare.com/sign-up et validez votre e-mail.
2. **Créer la base de données** : menu **Storage & Databases → D1 SQL Database → Create**.
   Nom : `scouvenir`, puis **Create**.
3. **Créer le site** : menu **Workers & Pages → Create → onglet Pages → Connect to Git**.
   Autorisez GitHub, choisissez le dépôt `maison-scouvenir`, puis **Begin setup**.
4. Réglages de construction :
   - Project name : `maison-scouvenir`
   - Framework preset : **None**
   - Build command : *laisser vide*
   - Build output directory : `public`
   Puis **Save and Deploy**.
5. **Relier la base** : dans le projet, **Settings → Bindings → Add → D1 database**.
   Variable name : `DB` (en majuscules), D1 database : `scouvenir`, puis **Save**.
6. **Redéployer** pour activer la base : onglet **Deployments**, sur la dernière ligne **⋯ → Retry deployment**.
7. Ouvrez `https://maison-scouvenir.pages.dev` et **créez votre accès tout de suite** (le premier compte créé est le vôtre).

### Étape 3 : l'icône sur l'iPhone
Dans **Safari**, ouvrez l'adresse, touchez **Partager**, puis **Sur l'écran d'accueil**.
Ouvrez l'application depuis cette icône **et connectez-vous une fois avec internet** :
l'icône a sa propre mémoire, séparée de Safari. Faites de même sur le téléphone de votre collègue.

### Ce qui est gratuit chez Cloudflare
L'offre gratuite permet 100 000 visites par jour et 5 Go de données : largement assez pour des milliers de commandes.
Aucune carte bancaire n'est demandée, donc aucun risque de facture.

## 2. Première connexion et accès de votre collègue
À la toute première ouverture, l'application vous demande de **créer votre accès** (prénom, identifiant,
mot de passe de 8 caractères minimum). Six **commandes d'exemple** sont ajoutées pour découvrir l'application.
Supprimez-les d'un clic avec **Supprimer les exemples** (Accueil ou Paramètres).

**Paramètres → Accès à l'application → Ajouter un accès** : prénom, identifiant et mot de passe de votre collègue.
Vous voyez tous les deux les mêmes commandes, chacun avec son propre mot de passe.
Le bouton poubelle à côté de son nom lui retire l'accès immédiatement (les commandes restent).

## 3. Utilisation sans connexion (hors ligne)
Une fois connectée une première fois sur un appareil, l'application s'ouvre aussi **sans internet** :
- vous consultez toutes vos commandes, le tableau de bord et les finances ;
- vous pouvez ajouter une commande, enregistrer un paiement, changer un statut, modifier ou supprimer ;
- un petit bandeau indique « Hors ligne » et le nombre de modifications en attente ;
- dès que la connexion revient, tout est envoyé automatiquement (« Modifications synchronisées »).

Les commandes créées hors ligne affichent « En attente d'envoi » à la place de leur numéro, attribué à la synchronisation.
Demandent internet : la première connexion, le changement de mot de passe, la gestion des accès, la suppression des exemples,
la restauration d'une sauvegarde et la déconnexion (pour ne rien perdre). L'export Excel fonctionne même hors ligne.
Si vous travaillez à deux hors ligne sur la même commande, la dernière modification envoyée l'emporte.

## 4. Les cinq rubriques
- **Accueil** : nombre de commandes, en cours, livrées ; montant total, déjà encaissé, reste à encaisser ; prochaines livraisons (les retards sont signalés en rouge).
- **Commandes** : toutes les commandes en cartes. Recherche par nom, téléphone ou numéro (SC-0001), filtre par statut, par période de livraison ou par mois, et tri. Le statut se change directement sur la carte. Touchez une carte pour ouvrir la fiche complète.
- **Nouvelle commande** (bouton rose « + ») : seul le nom est obligatoire. Le prix total et le reste à payer se calculent pendant la saisie.
- **Finances** : total des commandes, avances reçues, total des paiements reçus, reste à encaisser, liste des clientes qui doivent encore payer et derniers paiements.
- **Paramètres** : profil et mot de passe, accès de votre collègue, export Excel, sauvegarde et restauration, déconnexion.

Dans la **fiche d'une commande** : changer le statut (Nouvelle commande, En préparation, Prête, Livrée, Annulée),
**Modifier**, **Supprimer** (avec confirmation), et **enregistrer autant de paiements que nécessaire**.
Le bouton « Payer le reste » remplit automatiquement le montant du solde.

### Calculs
- Prix total = Quantité × Prix unitaire
- Reste à payer = Prix total − total des paiements reçus
- Les commandes **annulées** ne sont pas comptées dans les montants.
- Les montants sont exacts au millime près (ex. 12,500 DT).

## 5. Vos données et leur sécurité
- Les commandes sont enregistrées dans la base de données Cloudflare `scouvenir`. Rien n'est perdu quand vous fermez l'application.
- Cloudflare garde l'historique de la base pendant 7 jours (« Time Travel ») : en cas de fausse manipulation, on peut revenir en arrière.
- **Paramètres → Télécharger une sauvegarde complète** : un fichier `.json` à garder en lieu sûr (Google Drive, e-mail).
  **Faites-le une fois par semaine** : c'est votre assurance personnelle.
- **Paramètres → Restaurer une sauvegarde** : remet les commandes d'un fichier `.json`.
- **Paramètres → Exporter vers Excel** : un fichier `.xlsx` avec deux feuilles, « Commandes » et « Paiements ».
- Mots de passe chiffrés (jamais stockés en clair), connexion `https://` sécurisée, session de 90 jours par appareil,
  blocage de 10 minutes après 5 essais ratés. Changer son mot de passe déconnecte ses autres appareils.
- Pour le mode hors ligne, une copie des commandes est gardée sur le téléphone ; elle est effacée à la déconnexion.
  Protégez donc votre iPhone par un code.
- Gardez précieusement les accès de vos comptes GitHub et Cloudflare.

En cas d'oubli du mot de passe : votre collègue peut retirer votre accès et vous en recréer un, ou demandez de l'aide.
Les commandes ne sont jamais perdues.

## 6. Autre possibilité : sur votre ordinateur seulement
1. Installez **Node.js** (version 22 ou plus récente) depuis https://nodejs.org.
2. Double-cliquez sur `demarrer.bat` (Windows) ou `demarrer.command` (Mac). L'application s'ouvre sur http://localhost:3000.
3. Les données sont dans le dossier `donnees`, avec une copie de sécurité automatique chaque jour dans `donnees/sauvegardes`.
L'ordinateur doit rester allumé, et les téléphones n'y accèdent que sur le même Wi-Fi.

## 7. Pour la personne technique
- Cloudflare Pages : dossier publié `public/`, fonctions dans `functions/api/[[path]].js`, liaison D1 nommée `DB`
  (les tables se créent seules). Test local : `npx wrangler pages dev public --d1=DB`.
- Version autonome : `node --no-warnings server.js` (Node.js ≥ 22.13, aucune dépendance). Variables `PORT`, `DATA_DIR`. `Dockerfile` fourni.
