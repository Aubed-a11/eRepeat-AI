# eRepeat AI : mise en ligne (Vercel + Render + Neon)

Ce dossier contient deux parties :

- `frontend/` : l'application (React + Vite), installable sur téléphone et sur PC (PWA). Hébergée sur **Vercel**.
- `backend/` : le serveur (comptes, codes par e-mail, matricules, cours, exercices, messages). Hébergé sur **Render**, avec la base de données **Neon** (PostgreSQL) et l'envoi des e-mails par **Brevo**.

Pourquoi trois services : Vercel héberge très bien l'application, mais pas un serveur qui garde des données. Le serveur va donc ailleurs, et la base de données à part, pour que rien ne se perde quand le serveur redémarre.

Tout est gratuit pour démarrer. Prévoyez 45 minutes la première fois.

---

## 1. Mettre le code sur GitHub

1. Créez un compte sur github.com, puis un dépôt **privé** nommé `erepeat-ai`.
2. Envoyez-y le contenu de ce dossier tel quel (`backend/`, `frontend/`, `render.yaml`, `.gitignore`).
3. Vérifiez que le fichier `backend/.env` n'apparaît **pas** sur GitHub. Il contient des secrets, le `.gitignore` fourni l'exclut. S'il apparaît, supprimez-le du dépôt tout de suite.

## 2. La base de données : Neon

1. Créez un compte sur neon.tech, puis un projet (région la plus proche, par exemple Europe).
2. Sur la page du projet, copiez la **Connection string** (elle commence par `postgresql://`). Gardez-la : c'est `DATABASE_URL`.

## 3. L'envoi des e-mails : Brevo

Render gratuit **bloque** l'envoi d'e-mails par Gmail (ports SMTP fermés). Le serveur sait donc envoyer par Brevo, par Internet (HTTPS), ce qui fonctionne partout.

1. Créez un compte gratuit sur brevo.com (300 e-mails par jour).
2. Menu **Expéditeurs, domaines et IP**, ajoutez l'expéditeur `horticeadognigbo@gmail.com` et validez le lien reçu par e-mail.
3. Menu **SMTP et API**, onglet **Clés API**, créez une clé. Gardez-la : c'est `BREVO_API_KEY`.

Les e-mails partent de l'adresse Gmail validée. Ils peuvent parfois arriver dans les courriers indésirables : demandez aux premiers utilisateurs de vérifier ce dossier. Quand le projet grandit, un nom de domaine à vous règle ce point.

Si vous préférez garder Gmail : prenez une offre payante de Render (environ 7 dollars par mois), renseignez `GMAIL_USER` et `GMAIL_APP_PASSWORD` à la place de `BREVO_API_KEY`.

## 4. Le serveur : Render

1. Créez un compte sur render.com, puis **New** > **Blueprint**, choisissez votre dépôt. Render lit `render.yaml`.
2. Renseignez les variables demandées :
   - `DATABASE_URL` : la chaîne Neon (étape 2)
   - `BREVO_API_KEY` : la clé Brevo (étape 3)
   - `MAIL_FROM` : `eRepeat AI <horticeadognigbo@gmail.com>`
   - `ALLOWED_ORIGIN` : laissez vide pour l'instant, vous la remplirez à l'étape 6
   - `APP_SECRET` est généré automatiquement.
3. Lancez le déploiement. Quand c'est fini, ouvrez `https://VOTRE-SERVEUR.onrender.com/api/health` : vous devez voir `{"ok":true,"mail":"brevo"}`. Notez l'adresse du serveur.

Offre gratuite : le serveur s'endort après 15 minutes sans visite et met environ une minute à se réveiller. La première connexion après une pause est donc lente. L'offre payante supprime ce défaut.

## 5. L'application : Vercel

1. Créez un compte sur vercel.com, puis **Add New** > **Project**, choisissez votre dépôt.
2. **Root Directory** : `frontend`. Vercel reconnaît Vite tout seul.
3. **Environment Variables** : `VITE_API_BASE` = l'adresse du serveur Render, sans barre finale (par exemple `https://erepeat-api.onrender.com`).
4. **Deploy**. Vous obtenez une adresse du type `https://erepeat-ai.vercel.app`.

## 6. Relier les deux

Retournez sur Render, ouvrez votre service, **Environment**, et mettez `ALLOWED_ORIGIN` = l'adresse Vercel (par exemple `https://erepeat-ai.vercel.app`, sans barre finale). Enregistrez : le serveur redémarre. Sans cette étape, l'application s'affiche mais ne peut pas parler au serveur.

## 7. Tester

Ouvrez l'adresse Vercel, créez un compte élève avec votre adresse e-mail, recevez le code, entrez-le. Créez ensuite un compte répétiteur dans un autre navigateur et liez l'élève avec son matricule.

## 8. Installer sur téléphone et sur PC

- **Android (Chrome)** : menu des trois points, **Installer l'application**. Le bouton **Installer** apparaît aussi dans l'onglet Profil.
- **iPhone (Safari)** : bouton Partager, **Sur l'écran d'accueil**.
- **PC (Chrome ou Edge)** : icône d'installation à droite de la barre d'adresse, ou bouton **Installer** dans l'onglet Profil.

---

## Utilisation en local (facultatif)

Serveur : dans `backend/`, `npm install`, puis `npm start` (le fichier `.env` fourni sert pour le local). Application : dans `frontend/`, `npm install`, puis `npm run dev`, avec `VITE_API_BASE=http://localhost:3000` dans un fichier `frontend/.env.local` et `ALLOWED_ORIGIN=http://localhost:5173` côté serveur.

Tests du serveur : `npm test` dans `backend/`.

## Sécurité : à faire maintenant

- Le mot de passe d'application Gmail a été écrit dans une conversation. **Révoquez-le** sur myaccount.google.com/apppasswords. Avec Brevo, vous n'en avez plus besoin ; supprimez aussi la ligne `GMAIL_APP_PASSWORD` du fichier `backend/.env`.
- Ne publiez jamais `backend/.env`.
- Notez l'adresse e-mail et le mot de passe de chaque service (GitHub, Vercel, Render, Neon, Brevo) dans un endroit sûr.

## Limites à connaître

- Un seul serveur Render à la fois : le serveur garde ses données en mémoire et les écrit en base juste après chaque changement. Ne le dupliquez pas.
- Sur ordinateur, l'application s'affiche en colonne centrée de la largeur d'un téléphone. Une vraie mise en page large viendra plus tard.
- L'envoi par Gmail n'a pas pu être essayé depuis l'environnement de développement ; l'envoi par Brevo a été testé contre un serveur simulé, pas contre le vrai Brevo. Le premier essai réel est l'étape 7.
- Le coach IA répond avec des réponses de base. Pour brancher une vraie IA, il faut une passerelle (`VITE_AI_ENDPOINT`) : à faire à part, pour ne jamais exposer de clé dans l'application.

## La suite : Spring Boot et application mobile

Le serveur actuel est en Node.js (testé de bout en bout). Pour passer à Spring Boot, il faudra réécrire les mêmes routes `/api/...` : l'application React n'aura pas à changer. L'application mobile (Android et iPhone) pourra ensuite réutiliser ce même serveur.
