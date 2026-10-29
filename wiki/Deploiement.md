# Déploiement

## Application — GitHub Pages

Workflow : `.github/workflows/pages.yml`.

| Déclencheur | Jobs exécutés |
|---|---|
| push sur `main` | `verif` puis `deploy` |
| pull request | `verif` seulement |
| lancement manuel (*Actions → Run workflow*) | `verif` puis `deploy` |

1. **verif** : `node --check` sur chaque fichier `js/*.js` (erreurs de syntaxe).
2. **deploy** : copie `index.html`, `css/` et `js/` dans `_site/` (avec un `.nojekyll`), puis
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

## En local

Aucun build :

```bash
python3 -m http.server 8000     # puis http://localhost:8000
```

Ouvrir `index.html` directement (`file://`) fonctionne aussi, mais la vue 3D a besoin
d'internet pour charger Three.js depuis les CDN.
