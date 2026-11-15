# Onde — lecteur de musique pour vos groupes Telegram

Onde est une web app (PWA) personnelle : elle lit les fichiers audio partagés dans
**vos** groupes et canaux Telegram, directement depuis Safari sur iPhone.

- Aucun serveur : tout se passe entre votre téléphone et Telegram.
- Aucun identifiant dans le code : vous les saisissez au premier lancement,
  ils restent sur le téléphone.
- Hébergement gratuit sur GitHub Pages.

> **Avancement** — Étapes 1 et 2 terminées : connexion, choix des groupes, indexation,
> lecteur complet (file d'attente, aléatoire, répétition), préchargement du morceau
> suivant, commandes sur l'écran verrouillé et reprise de lecture. Restent la recherche,
> les favoris, les playlists, la sauvegarde (étape 3) et le hors ligne (étape 4).

---

## 1. Créer vos identifiants Telegram (une seule fois)

Telegram demande à chaque application d'avoir ses propres « clés ». C'est gratuit.

1. Sur l'iPhone, ouvrez Safari et allez sur **https://my.telegram.org**.
2. Saisissez votre numéro au format international (ex. `+33612345678`).
3. Telegram vous envoie un code **dans l'application Telegram** (pas par SMS) :
   recopiez-le sur la page.
4. Touchez **API development tools**.
5. Remplissez le formulaire :
   - *App title* : `Onde` (ou ce que vous voulez)
   - *Short name* : `onde` suivi de quelques chiffres (ex. `onde4821`)
   - *Platform* : `Web`
   - le reste peut rester vide.
6. Validez. La page affiche alors :
   - **api_id** : un nombre (ex. `12345678`)
   - **api_hash** : 32 caractères (chiffres et lettres)

Notez ces deux valeurs (dans l'app Notes ou un gestionnaire de mots de passe).
**Ne les partagez avec personne et ne les mettez jamais dans le dépôt GitHub.**

> Si le formulaire affiche seulement « ERROR », réessayez plus tard ou sans VPN /
> bloqueur de publicité : c'est un caprice connu du site de Telegram.

## 2. Mettre l'appli en ligne sur GitHub Pages

À faire une seule fois, depuis Safari sur github.com (version « ordinateur » du site
si un menu manque : bouton **aA** → « Version pour ordinateur »).

1. Ouvrez le dépôt, puis **Settings** → **Pages**.
2. Sous **Build and deployment → Source**, choisissez **GitHub Actions**.
3. C'est tout : à chaque modification de la branche `main`, GitHub reconstruit et
   publie l'appli automatiquement (onglet **Actions** pour suivre, ~1 minute ;
   une coche verte = en ligne).
4. L'adresse de l'appli est :
   **https://VOTRE-NOM.github.io/NOM-DU-DEPOT/**
   (pour ce dépôt : `https://djbrutality.github.io/Telegram-player/`).

Le dépôt doit être **public** pour que GitHub Pages soit gratuit. Ce n'est pas un
problème : le code ne contient aucun identifiant ni aucune donnée personnelle.

## 3. Installer sur l'iPhone

1. Ouvrez l'adresse de l'appli dans **Safari** (pas Chrome).
2. Touchez le bouton **Partager** (carré avec une flèche vers le haut).
3. Choisissez **Sur l'écran d'accueil**, puis **Ajouter**.
4. Lancez **Onde** depuis l'écran d'accueil : elle s'ouvre en plein écran.

> Important : l'appli installée et Safari n'ont pas la même mémoire. Connectez-vous
> **dans l'appli installée** (icône de l'écran d'accueil), pas dans l'onglet Safari.

## 4. Première connexion

1. Saisissez **api_id** et **api_hash** (étape 1).
2. Saisissez votre numéro, puis le code reçu dans Telegram.
3. Si vous avez activé la validation en deux étapes, saisissez votre mot de passe.
4. Cochez les groupes et canaux à utiliser comme bibliothèque, puis **Valider**.

Telegram vous signalera une « nouvelle connexion » : c'est normal, c'est Onde.
Vous la retrouverez dans Telegram → Réglages → Appareils.

## Sécurité, en clair

- Vos clés, votre session et l'index des morceaux sont stockés **uniquement dans
  la mémoire de l'appli sur votre iPhone**.
- L'appli ne parle qu'aux serveurs de Telegram. Il n'y a ni statistiques ni serveur
  intermédiaire.
- **Réglages → Se déconnecter et tout effacer** ferme la session côté Telegram et
  supprime tout ce qui est stocké sur le téléphone.
- En cas de perte du téléphone : Telegram → Réglages → Appareils → terminez la
  session « Onde ».

## En cas de souci

| Symptôme | Que faire |
|---|---|
| « api_id ou api_hash incorrect » | Vérifiez les deux valeurs sur my.telegram.org, puis « Recommencer avec d'autres identifiants ». |
| « Trop de tentatives… » | Telegram impose une attente ; patientez la durée indiquée. |
| Un morceau ne démarre pas | Réglages → Mode de lecture → **Complet** (télécharge le morceau entier avant de le lire). |
| « Format audio non pris en charge » | Safari ne sait pas lire ce format (certains fichiers anciens ou exotiques). |
| Bandeau « Telegram demande une pause » | Normal sur les gros groupes : l'indexation reprend toute seule. |
| La musique s'arrête écran verrouillé | Laissez l'appli ouverte au premier plan quelques secondes après le début d'un morceau (le temps du préchargement), puis verrouillez. Si cela persiste, essayez le mode **Complet**. |
| L'appli ne se met pas à jour | Fermez-la complètement (balayez-la vers le haut) puis rouvrez-la. |

## Pour les curieux : la technique

- Vite + React + TypeScript ; connexion Telegram par [GramJS](https://gram.js.org) (MTProto).
- Lecture en streaming : un *service worker* (`public/sw.js`) répond aux requêtes
  `Range` du lecteur audio ; la page télécharge les blocs de 512 Ko chez Telegram.
  Repli automatique sur le téléchargement complet si le streaming échoue.
- Index des morceaux en cache local (IndexedDB), construit progressivement, avec
  gestion des limites de débit Telegram (`FLOOD_WAIT`).

Développement local (facultatif, sur ordinateur) : `npm install` puis `npm run dev`.
Ajoutez `?demo` à l'adresse pour tester l'interface avec un faux Telegram.
