# Boda Kilgoris

PWA mobile (installable) qui met en relation **clients** et **conducteurs de moto-taxi (Bodas)** à Kilgoris, Kenya.
Interface **entièrement bilingue English / Kiswahili**.

**Phase 1 (3 mois) : gratuit, paiement en cash hors application.** Le but est de **compter les courses de façon
fiable** pour décider ensuite du modèle de rémunération. Le dashboard admin répond à la question :
*« combien de courses réelles passent par l'app chaque jour ? »*

- **Stack** : Next.js 16 (App Router) · TypeScript · Tailwind 4 · Supabase (Postgres, Auth, Realtime, Storage) · Leaflet + OpenStreetMap · next-intl · Vercel
- **Pensé pour** : connexions lentes et Android bas de gamme (polices système, photo réduite à 800 px / < 200 Ko avant tout affichage, aucun SDK de carte propriétaire, polling de secours en plus du temps réel)

---

## 1. Ce qui est construit

| Interface | Écrans |
|---|---|
| **Premier lancement** | Choix de langue (2 gros boutons) avant toute inscription |
| **Boda** (`/boda`) | Inscription en 2 étapes (1. nom, téléphone, plaque, PIN 4 chiffres → compte créé ; 2. photo, *optionnelle*, ajoutable plus tard depuis l'accueil ou les réglages) · statut *pending* tant que l'admin n'a pas validé · gros bouton disponible / indisponible · GPS toutes les ~12 s uniquement si disponible · demandes entrantes en temps réel avec mini-carte (destination affichée seulement si elle existe, sinon « Destination à préciser avec le client »), accepter/refuser, expiration à 2 min · « Je suis arrivé » → « Course terminée » (+ prix optionnel) · indisponible automatiquement pendant une course |
| **Client** (`/client`) | Nom + téléphone, session persistante · carte avec tous les Bodas disponibles **avec leur nom** · liste triée par distance avec note moyenne · le client **choisit** son Boda · point de prise en charge **obligatoire** : GPS d'abord, épingle manuelle si le GPS est refusé/imprécis (> 100 m), + « repère de prise en charge » facultatif · destination **entièrement facultative** : texte libre (repère, quartier), lieux fréquents en puces, bouton « Placer sur la carte » facultatif · attente, suivi du Boda sur la carte, confirmation + note 1–5 (optionnelle) |
| **Client – Shopping list** | Écran d'accueil à deux gros boutons (« Ride » / « Shopping list ») · catalogue d'articles cochables par catégorie avec recherche et quantité +/- · « Autre article » en texte libre · budget maximum et note facultatifs · récapitulatif éditable · lieu de livraison (GPS, sinon épingle, + repère facultatif) · choix du Boda (même carte et même liste que les rides) · liste **conservée** (localStorage) en cas de rechargement, refus, expiration · suivi en direct : statuts, articles achetés / introuvables / remplacés, **total des articles dès que le Boda le saisit** · confirmation de livraison avec les factures en évidence, « Signaler un problème » (4 motifs + texte libre), note facultative |
| **Boda – Shopping** | Demande entrante avec badge « Shopping », nombre d'articles, liste complète, budget, lieu de livraison · après acceptation : téléphone du client, boutons Appeler / WhatsApp (uniquement pendant la commande) · bandeau chaud « Gardez TOUTES les factures… » de l'acceptation à « Livré » · articles « acheté / introuvable (+ remplacement) / sans reçu » · 5 étapes à boutons, avec cases **bloquantes** « J'ai gardé tous les reçus » (Courses faites) et « J'ai présenté les reçus » (Livré), total des articles et frais de livraison obligatoires · aucune photo de reçu |
| **Admin** (`/admin`) | Validation / suspension des Bodas · compteurs jour / semaine / mois · stats par Boda · taux et temps moyen d'acceptation · Bodas actifs par jour · courses suspectes · carte en direct · **lieux fréquents** (`/admin/places` : ajout, édition, masquage) · **catalogue d'articles** (`/admin/catalog` : ajout, édition, masquage, ordre, noms EN/SW, unité) · **Shopping** (`/admin/shopping` : compteurs séparés des rides, valeur moyenne, frais moyens, taux et motifs de problèmes, articles les plus demandés, articles libres les plus fréquents, indicateurs reçus par Boda, liste des problèmes avec détail) · export CSV · réinitialisation du PIN d'un Boda |
| **Réglages** (`/settings`) | Langue, consentement GPS (retirable), déconnexion, installation PWA |

Hors périmètre (volontairement absent) : M-Pesa, commissions, abonnements, calcul de prix, chat, **aucun paiement dans l'app** (le Boda avance l'argent des courses, le client le rembourse à la livraison, hors app), pas de prix de catalogue, pas de photo de reçus.
Seul le **schéma** d'un pass journalier/hebdomadaire est prévu (table `boda_passes`, non utilisée).

---

## 2. Comment une course est comptée

```
requested ──accept──▶ accepted ──arrive──▶ arrived ──complete──▶ completed
   │  │  │               │                    │
   │  │  └─cancel────────┴────cancel──────────┘──▶ cancelled
   │  └─decline──▶ declined
   └─2 min sans réponse──▶ expired
```

La machine d'états est **imposée en base** (trigger `rides_guard`), pas seulement dans l'interface.

Une course est **comptabilisée** (`counted = true`) uniquement si **le Boda ET le client ont confirmé** :

- le Boda confirme en appuyant sur « Course terminée » ;
- le client confirme avec « Confirmer la course » (+ note) ;
- sans réponse du client sous **30 min**, confirmation automatique avec le drapeau `auto_confirmed`.

Drapeau **`suspect`** (la course reste comptée, mais est isolée dans le dashboard) si :

- `completed_at − accepted_at < 2 min` → raison `too_fast` ;
- le même couple client/Boda dépasse **10 courses par jour** → raison `pair_frequency` (toutes les courses du couple ce jour-là sont marquées).

Le dashboard distingue donc *comptées* et *comptées non suspectes* : c'est ce second chiffre qui est le plus proche de la réalité.

Taux d'acceptation = courses acceptées ÷ (acceptées + refusées + expirées) sur 30 jours (une annulation du client avant réponse est exclue).
Un Boda est « actif » un jour donné s'il a envoyé au moins une position ce jour-là.

Tous les seuils (2 min, 30 min, 10/jour, fraîcheur de position…) sont dans la table `app_settings` : modifiables en SQL sans redéployer.
Les jours sont calculés en fuseau **Africa/Nairobi**.

---

## 3. Installation

### 3.1 Supabase

1. Créez un projet sur [supabase.com](https://supabase.com) (région la plus proche du Kenya).
2. **SQL Editor** → collez et exécutez, **dans l'ordre**, les fichiers de `supabase/migrations/` :
   1. **`20261016000000_init.sql`** (tables, RLS, fonctions, realtime, bucket photos) ;
   2. **`20261020000000_optional_destination_places.sql`** (destination facultative + coordonnées facultatives, repère de prise en charge, table `places` **vide**, `request_ride` mise à jour). Idempotent, sans effet sur les courses existantes ;
   3. **`20261021000000_shopping_status_values.sql`**, **puis, dans une exécution séparée**, **`20261021000100_shopping.sql`** (« Shopping list » : statuts, `catalog_items` + catalogue de départ, `ride_items`, `request_shopping`, étapes du Boda, signalement, fonctions admin). Les deux fichiers doivent être lancés l'un après l'autre, pas ensemble (une nouvelle valeur d'enum ne peut pas être utilisée dans la transaction qui l'ajoute). Idempotents, sans effet sur les courses existantes (elles deviennent `type = 'ride'`).
   4. **`20261022000000_catalog_seed_and_public_read.sql`** : (re)garnit le catalogue avec les 26 articles de départ (idempotent : ne duplique rien, ne réactive pas un article que vous avez masqué ou renommé) et autorise la **lecture** des articles actifs aux visiteurs connectés **ou non** (l'écriture reste réservée à l'admin).
   Sur un projet déjà en service, exécutez seulement les fichiers qui manquent. **`npm run check:db`** (lecture seule, clé publique) dit lesquelles manquent : sans elles l'écran « Shopping list » affiche « Impossible de charger les articles » (code `PGRST205` = table absente) et la demande de course échoue.
3. **Authentication → Providers → Email** : laissez le fournisseur Email **activé**, mais :
   - désactivez **« Allow new users to sign up »** (les comptes sont créés uniquement par le serveur) ;
   - la confirmation d'email n'est pas nécessaire (les comptes sont créés déjà confirmés).
4. *(Optionnel mais recommandé)* `supabase/optional_cron.sql` : active pg_cron pour que l'expiration / auto-confirmation tournent même quand personne n'a l'app ouverte.

### 3.2 Variables d'environnement

Copiez `.env.example` vers `.env.local` :

| Variable | Où la trouver | Remarque |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project settings → API | publique |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Project settings → API (anon / publishable) | publique, protégée par RLS |
| `SUPABASE_SERVICE_ROLE_KEY` | Project settings → API (service_role) | **secrète, serveur uniquement** (Vercel : ne pas cocher « exposer ») |
| `AUTH_PEPPER` | `openssl rand -hex 32` | **secrète. Ne jamais la changer** une fois des comptes créés |

### 3.3 Lancer en local

```bash
npm install
cp .env.example .env.local        # puis remplir
npm run create-admin -- vous@exemple.com 'un-mot-de-passe-solide' "Votre nom"
npm run seed                      # données de démo (optionnel)
npm run dev                       # http://localhost:3000
```

> La géolocalisation du navigateur exige HTTPS, sauf sur `localhost`. Pour tester sur un téléphone, utilisez le déploiement Vercel (HTTPS).

### 3.4 Déployer sur Vercel

1. Poussez le dépôt sur GitHub puis **Add New → Project** sur Vercel (framework détecté : Next.js).
2. Ajoutez les 4 variables d'environnement ci-dessus (Production + Preview).
3. Déployez. Ouvrez l'URL sur un téléphone Android avec Chrome : « Installer l'application » apparaît (manifest + service worker inclus).
4. Créez le compte admin (`npm run create-admin` en local pointant sur le même projet Supabase) et connectez-vous sur `/admin/login`.

---

## 4. Données de démo

`npm run seed` crée **5 Bodas** et **3 clients** (mélange EN / SW), 3 Bodas en ligne autour du centre-ville, 1 Boda hors ligne, 1 Boda *pending* (pour démontrer la validation), et **14 jours d'historique** (≈110 demandes, dont un couple « suspect » qui enchaîne 12 courses) pour que le dashboard ne soit pas vide.

| Boda (PIN **1234**) | Téléphone | Langue | État |
|---|---|---|---|
| Otieno Odhiambo | 0711 000 001 | en | approuvé, en ligne |
| Nyaboke Moraa | 0711 000 002 | sw | approuvé, en ligne |
| Saitoti Ole Sanguya | 0711 000 003 | sw | approuvé, en ligne |
| Barasa Wekesa | 0711 000 004 | en | approuvé, hors ligne |
| Naserian Lemayian | 0711 000 005 | sw | **pending** |

| Client (sans mot de passe) | Téléphone | Langue |
|---|---|---|
| Amina Hassan | 0722 000 001 | sw |
| Grace Achieng | 0722 000 002 | en |
| Peter Kiprono | 0722 000 003 | sw |

- Une position de plus de 3 min est masquée aux clients : avant une démo, lancez `npm run seed -- --refresh`, ou laissez tourner **`npm run simulate`** qui fait bouger les Bodas toutes les 10 s.
- `npm run seed` est rejouable : les utilisateurs existants sont réutilisés, l'historique n'est créé que s'il n'y a aucune course.

---

## 5. Sécurité et confidentialité

- **RLS sur toutes les tables.** Le rôle `authenticated` n'a que `SELECT` ; **toute écriture passe par des fonctions SQL `SECURITY DEFINER`** (`request_ride`, `accept_ride`, `complete_ride`, `update_location`…) qui vérifient le rôle et l'état. `anon` n'a accès à rien. Les fonctions internes (`run_sweep`, `touch_boda_activity`) ne sont exécutables par personne côté API.
- **Position d'un Boda** : table séparée `boda_locations`, lisible seulement par lui-même, l'admin, **tant qu'il est approuvé + disponible + récent**, et par le client dont la course est acceptée. Dès qu'il passe indisponible ou termine sa course, la ligne est supprimée.
- **Position du client** : seul le point de prise en charge est enregistré (jamais de suivi continu). Il n'est visible que du Boda **choisi** par le client, puis du Boda qui a accepté. Les numéros de téléphone ne sont échangés **qu'à l'acceptation**.
- **Aucun accès croisé aux profils** : le nom, la plaque, la photo et le téléphone de l'autre partie sont copiés sur la ligne `rides` (snapshot) ; les profils ne sont lisibles que par leur propriétaire et l'admin.
- **PIN du Boda** : jamais utilisé tel quel. Le mot de passe Supabase = `HMAC-SHA256(AUTH_PEPPER, "boda:<tel>:<pin>")` calculé **côté serveur** ; 5 essais ratés → verrouillage 15 min ; réponse identique pour « numéro inconnu » et « mauvais PIN ». PIN oublié : l'admin en fixe un nouveau (`/admin/bodas` → *Reset PIN*).
- **Consentement GPS** explicite (EN/SW) à la première utilisation, enregistré sur le profil, retirable dans les réglages.
- **Aucune donnée de paiement.**
- `/admin` est protégé par `proxy.ts` (session + rôle) **et** par RLS (`is_admin()`) sur chaque requête.

### Limites connues (à connaître avant de décider)

1. **Client sans mot de passe (choix du brief)** : connaître le téléphone d'un client suffit pour ouvrir son compte sur un autre appareil. Impact limité (il ne voit les données de personne d'autre), mais c'est de l'usurpation possible. À renforcer (OTP SMS) quand le budget le permet.
2. **Le GPS web ne tourne pas en arrière-plan.** Quand l'écran s'éteint ou que l'app est fermée, le navigateur suspend le JavaScript. L'app demande un *Wake Lock* (écran maintenu allumé) tant que le Boda est disponible, et un Boda silencieux > 15 min est automatiquement repassé indisponible (> 3 min : masqué des clients). Pour un suivi 100 % fiable il faudra une app native.
3. **Notifications** : son + vibration + notification système tant que la page est encore vivante. Sans Web Push (non inclus), un téléphone totalement endormi ne sera pas réveillé.
4. **Tuiles OpenStreetMap** : serveur communautaire gratuit, adapté à ce volume. Si le trafic augmente, passez à un fournisseur de tuiles (MapTiler, Stadia…) en changeant l'URL dans `LeafletMap.tsx`.
5. **Distances** : à vol d'oiseau (indicatif), pas d'itinéraire routier.
6. Pas de limitation de débit sur l'inscription des Bodas / clients (à ajouter si abus : Vercel Firewall, Turnstile).

---

## 6. Langues (EN / SW)

- Aucun texte en dur : tout vient de `messages/en.json` et `messages/sw.json`, avec des clés **typées** (une faute de clé fait échouer `tsc`).
- Les deux fichiers sont embarqués dans l'app : le changement de langue est **instantané, sans rechargement ni reconnexion**.
- Choix stocké dans un cookie + `localStorage` pour les visiteurs, et dans `profiles.language` une fois connecté (la langue du compte l'emporte sur un nouvel appareil).
- Les messages d'erreur de la base (`boda_unavailable`, `ride_expired`…) sont des codes traduits sous `errors.*`.
- Les textes libres (noms, destinations) ne sont pas traduits.
- `npm run i18n:check` (lancé avant chaque `build`) vérifie que les fichiers ont exactement les mêmes clés et les mêmes `{variables}`.

**Ajouter une 3e langue** (ex. français) : (1) ajouter `fr` dans `src/i18n/config.ts` (+ nom natif, + tag Intl), (2) créer `messages/fr.json`, (3) l'importer dans `src/i18n/messages.ts`, (4) `insert into supported_languages (code, label) values ('fr', 'Français');`. Aucune autre modification.

### ⚠ Traductions swahili « à relire »

**Toutes les traductions swahili sont un premier jet non relu par un locuteur natif** (swahili simple, parlé). La liste complète, clé par clé avec l'anglais en regard, est dans **[`docs/SWAHILI_REVIEW.md`](docs/SWAHILI_REVIEW.md)** (549 textes). Priorités de relecture :

| Priorité | Clés | Pourquoi |
|---|---|---|
| 1 | `geo.consentBodyBoda`, `geo.consentBodyClient` | Texte de consentement : doit être parfaitement compris |
| 1 | `boda.available` / `boda.unavailable` (« Niko tayari » / « Siko tayari »), `boda.accept`, `boda.decline`, `boda.arrived`, `boda.complete` | Gros boutons utilisés toute la journée par les Bodas |
| 2 | `ride.status.*`, `client.onTheWay`, `client.hasArrived`, `client.confirm`, `boda.waitingConfirm` | Statuts de course et confirmation (c'est ce qui déclenche le comptage) |
| 2 | `errors.*` | Messages d'erreur : courts, non accusateurs |
| 1 | **Nouveaux (destination facultative)** : `client.destinationLabel`, `client.destinationPlaceholder`, `client.destinationHint`, `client.placesLabel`, `client.placeOnMap`, `client.placingHint`, `client.destinationPinned`, `client.removePin`, `client.pickupNoteLabel`, `client.pickupNoteHint`, `client.pickupNotePlaceholder`, `client.gpsFallback`, `client.gpsImprecise`, `boda.destinationToClarify`, `boda.destinationOnMap`, `boda.pickupNote` | Vocabulaire de lieux/repères : un Boda de Kilgoris dirait-il ainsi ? Les exemples (« soko », « duka la buluu ») sont à adapter |
| 1 | **Nouveaux (Shopping list)** : tout `shopping.*` (écran de choix « Safari » / « Orodha ya manunuzi », catégories, unités, statuts, **avertissement de paiement `shopping.payNotice`**, **message sur les factures `shopping.receiptsNotice`**, motifs de problème `shopping.problems.*`) et `shoppingBoda.*` (dont le **bandeau factures `shoppingBoda.receiptsBanner`**, les cases à cocher et les 5 boutons d'étape) | Textes qui engagent le comportement de l'argent et des reçus : doivent être parfaitement compris |
| 2 | Noms d'articles du catalogue (`name_sw` dans la table `catalog_items`, graine de la migration) | « sukari, unga, mchele… » : à confirmer / corriger dans `/admin/catalog` |
| 2 | `notify.shopping*`, `notify.delivering`, `notify.deliveredConfirm`, `ride.status.shopping/purchased/delivering`, `errors.empty_list` … `errors.already_reported` | Notifications et erreurs de la commande |
| 3 | `admin.*` (dont `admin.places.*`, `admin.catalog.*`, `admin.shopping.*`, `errors.invalid_place`) | Uniquement vu par l'admin |

Pour corriger : éditez `messages/sw.json` (en gardant les `{variables}`), puis `npm run i18n:check && npm run i18n:review`.

---

## 7. Tests

| Commande | Ce qu'elle vérifie |
|---|---|
| `npm run test:db` | Exécute **toutes les migrations** dans un Postgres embarqué (PGlite) : RLS (anon / client / Boda / admin), machine d'états, comptage, drapeaux suspects, auto-confirmation, expiration, Bodas silencieux, fonctions admin, **destination facultative (aucune / texte / texte + épingle / lieu fréquent / épingle seule : cycle complet de chacune), lieux fréquents (droits, RLS), migration sur une base contenant déjà des courses** (261 assertions, dont tout le cycle Shopping : RLS des articles et du téléphone, étapes, reçus bloquants côté base, signalements, comptage et auto-confirmation, statistiques admin) |
| `npm run typecheck` / `npm run lint` | Types (dont clés de traduction) et ESLint |
| `npm run i18n:check` | Cohérence EN / SW |

Le parcours complet (inscription Boda → validation admin → disponibilité GPS → demande client → acceptation → arrivée → fin → confirmation + note → dashboard → export CSV → verrouillage de PIN) a été joué dans Chromium (mobile 390 px) contre un faux backend Supabase exécutant cette même migration. **Non testé sur un vrai projet Supabase** : le temps réel (websocket Realtime) et l'envoi réel d'emails/sessions GoTrue. Le code prévoit un polling de secours (10 s) si le temps réel est indisponible. À vérifier lors de votre premier déploiement : deux téléphones, un Boda et un client, une course complète.

---

## 7bis. Photo, caméra et téléphones Android à faible RAM

Sur un téléphone bas de gamme, Android peut **tuer la page** pendant que l'application caméra est ouverte : au retour, l'app « redémarre ». Ce qui est en place pour que cela ne coûte plus rien au Boda :

| Mesure | Où |
|---|---|
| Caméra **native** via `<input type="file" accept="image/*" capture="user">` + bouton « Choisir dans la galerie ». Aucun `getUserMedia`, aucun flux vidéo dans la page. | `src/components/photo-picker.tsx` |
| Compression **avant** affichage/envoi : 800 px max, JPEG ~0,7 (qualité abaissée puis taille réduite si > 200 Ko), bitmap/canvas libérés, un seul `createObjectURL` (de la petite image) révoqué au remplacement/démontage. | `src/lib/image-compress.ts` |
| Inscription **sans photo** (compte créé d'abord), photo = étape 2 optionnelle (« Ajouter une photo plus tard »). Un plantage ne fait jamais perdre le compte. | `src/app/boda/register/page.tsx`, `api/auth/boda/register` |
| Brouillon (nom, téléphone, plaque, langue, étape) en `localStorage`, écrit à chaque frappe et **avant** l'ouverture de la caméra. **Le PIN n'est jamais stocké.** Restauré automatiquement ; la session (cookies) survit au rechargement donc on reprend à l'étape 2. | `src/lib/draft.ts` |
| Envoi vers **Supabase Storage** (bucket `boda-photos`, jamais de base64 en base) par `POST /api/boda/photo` ; 3 essais automatiques (1 s, 2 s) + bouton « Réessayer » qui garde la photo en mémoire ; l'ancienne photo est supprimée. | `src/lib/photo-upload.ts`, `src/app/api/boda/photo/route.ts` |
| Journal d'erreurs : console (visible via `chrome://inspect`) **et** serveur (`POST /api/log` → logs Vercel, chercher `client_event`). Événements : `photo.compressed`, `photo.compress_failed`, `photo.upload_rejected`, `photo.upload_failed`, `photo.upload_gave_up`, `photo.page_restarted_during_capture`, `app.restarted` (page rechargée/écartée par Chrome), `auth.profile_load_failed`. Jamais de nom/téléphone/PIN. | `src/lib/clientlog.ts`, `src/components/diagnostics.tsx` |

**Rechargements forcés (audit)** : aucun `location.reload`, `router.refresh` ni `window.location` dans l'app (seul `offline.html` a un bouton « Réessayer » manuel). Corrigés : `sw.js` n'appelle plus `skipWaiting()`/`clients.claim()` (une mise à jour ne prend plus le contrôle d'une page ouverte) ; `AuthProvider` ne traite plus une erreur réseau comme « déconnecté » (avant : retour sur un réseau faible → `profile = null` → redirection vers la page de connexion) et ignore les `SIGNED_IN` répétés pour l'utilisateur déjà chargé ; l'abonnement Realtime de `/boda` dépend de l'id (string) et non de l'objet `user` (avant : se recréait à chaque retour au premier plan).

**Tester sur un vrai téléphone** : Android en USB, débogage USB activé, ouvrir `chrome://inspect/#devices` sur le PC, « inspect » sur l'onglet de l'app, onglets *Console* (messages `[boda] …`) et *Application → Local Storage* (`boda.registerDraft.v1`). Pour simuler la mémoire faible : DevTools → Performance → CPU « 6× slowdown », et `chrome://discards` → *Urgent Discard* sur l'onglet pour provoquer le rechargement.

---

## 8. Structure

```
supabase/
  migrations/…_init.sql    schéma, machine d'états, RLS, RPC, realtime, bucket
  optional_cron.sql        pg_cron (facultatif)
  tests/                   test:db (PGlite)
messages/                  en.json, sw.json
scripts/                   seed, simulate, create-admin, check-i18n, export-sw-review
src/
  proxy.ts                 session + garde /admin, /boda, /client
  app/                     pages (/, /boda, /client, /admin, /settings) + app/api (auth, export CSV, reset PIN)
  components/              UI, carte Leaflet, consentement GPS, sélecteur de langue…
  hooks/                   temps réel (courses, Bodas, position), tracking GPS, wake lock…
  lib/ i18n/               Supabase (navigateur / serveur / service), helpers
public/                    manifest, service worker, icônes, page hors-ligne
docs/SWAHILI_REVIEW.md     traductions à relire
```

## 9. Pour la phase 2 (rémunération)

Les données nécessaires sont déjà collectées : courses comptées/suspectes par Boda et par jour, prix convenus (`agreed_price_kes`, saisis par le Boda), notes, Bodas actifs. La table `boda_passes` (daily/weekly, montant, référence de paiement) est prête pour un pass journalier/hebdomadaire ; il restera à ajouter la vérification du pass dans `set_availability` / `accept_ride` et l'intégration M-Pesa.
