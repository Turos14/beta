# Déploiement

## Application — GitHub Pages

Workflow : `.github/workflows/pages.yml`.

| Déclencheur | Jobs exécutés |
|---|---|
| push sur `main` | `verif` puis `deploy` |
| pull request | `verif` seulement |
| lancement manuel (*Actions → Run workflow*) | `verif` puis `deploy` |

1. **verif** : `node --check` sur chaque fichier `js/*.js` et sur `sw.js`, puis validation JSON de `manifest.webmanifest`.
2. **deploy** : copie `index.html`, `manifest.webmanifest`, `sw.js`, `css/`, `js/` et `icons/` dans `_site/` (avec un `.nojekyll`), puis
   publication via `actions/upload-pages-artifact` et `actions/deploy-pages`.

Prérequis, une seule fois : *Settings → Pages → Build and deployment → Source : GitHub Actions*.

URL : https://turos14.github.io/beta/

## Wiki — synchronisation automatique

Workflow : `.github/workflows/wiki.yml`. Le wiki est rédigé dans le dossier `wiki/` du
dépôt (versionné et relu comme le code), puis recopié dans le wiki GitHub à chaque push
sur `main` qui modifie `wiki/**`.

Prérequis, une seule fois :
1. *Settings → General → Features* : cocher **Wikis**.
2. Onglet **Wiki** → *Create the first page* → enregistrer (le contenu sera écrasé).
   GitHub ne crée le dépôt git du wiki qu'à ce moment-là.
3. Relancer le workflow : *Actions → Synchronisation du wiki → Run workflow*.

Ne pas modifier le wiki depuis l'interface GitHub : les changements seraient écrasés à la
synchronisation suivante. Modifier les fichiers de `wiki/` et pousser.

### Conventions des pages

- Un fichier = une page ; le nom de fichier (sans `.md`) est l'adresse de la page.
- Liens internes sans extension : `[Simulateur](Simulateur)`.
- `_Sidebar.md` et `_Footer.md` : barre latérale et pied de page communs.

## Régénérer les icônes

Les PNG de `icons/` sont des rendus de `icons/logo.svg`. Après une modification du logo, les
régénérer aux mêmes tailles (32, 180, 192, 512, et 512 « maskable » avec le logo à 78 % sur
fond noir), par exemple avec Chromium/Playwright ou Inkscape :

```bash
inkscape icons/logo.svg -w 512 -h 512 -o icons/icon-512.png
```

## En local

Aucun build :

```bash
python3 -m http.server 8000     # puis http://localhost:8000
```

Ouvrir `index.html` directement (`file://`) fonctionne aussi, mais sans service worker :
ni installation, ni mode hors ligne, et la vue 3D a besoin d'internet pour charger Three.js.
L'installation demande HTTPS ou `localhost`.
