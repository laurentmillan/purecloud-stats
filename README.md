# purecloud-stats
Interface web qui permet de réaliser des requêtes Analytics PureCloud en se basant sur des groupes d'utilisateurs plutôt que sur une liste de files d'attente.
Remarque : Seules les staististiques des conversations voix sont comptabilisées (par simple contrainte d'affichage).   
Seules les files d'attentes sur lesquelles les utilisateurs sont activés au moment de la requête sont pris en compte (voir config pour changer ce comportement).

# Installation
Il suffit de copier ce fichier sur un serveur web statique.

# Configuration
Il faut créer un tocket Implicit 'OAuth' : https://developer.mypurecloud.com/api/rest/authorization/use-implicit-grant.html et indiquer le `clientId` dans le fichier
`public/stats_by_group/js/script.js` à l'emplacement suivant :

### Authentification

Il faut créer un tocket Implicit 'OAuth' : https://developer.mypurecloud.com/api/rest/authorization/use-implicit-grant.html et indiquer le `clientId` dans le fichier
`public/js/script.js` à l'emplacement suivant :
```
var pureCloudSession = purecloud.platform.PureCloudSession({
  strategy: 'implicit',
  clientId: 'VOTRE CLIENTID ICI',
  redirectUrl: window.location.href,
  environment: 'mypurecloud.ie'
});
```

Le jeton OAuth doit autoriser l'URL à partir de laquelle vous appelez cette interface web. (Ex : vous devez ajouter l'URL http://localhost:8080/index.html si le serveur web tourne en local).


### Inclusion / Exclusion des groupes

Pour prendre en compte toute les files associées à un utilisateur, retirer l'argument `true` à la fin de l'appel de fonction suivant :
```
usersapi.getUserIdQueues(user.id, 100, 1, true)
```
En laissant l'argument `true`, seules les files pour lesquelles l'agent est activé au moment de la requête seront prises en comptes pour la requête Analytics.
