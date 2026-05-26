# Phase Summary — Planning Sous-Projet 4 (Refonte Voice : rebrand + white mode + session 1 an + mobile full parity)

**Date :** 2026-05-26
**Phase terminée :** Brainstorming + spec + plan d'implémentation pour le Sous-projet 4
**Phase suivante :** Exécution du plan en 5 phases (1 rebrand → 2 session 1 an → 3 palette white mode → 4 mobile conversation unifiée → 5 mobile settings full parity → W wrap-up staging+prod)

---

## Vision globale du projet

| # | Sous-projet | Statut |
|-|-|-|
| 1.A | LiteLLM migration | ✅ Terminée |
| 1.B | Eval harness | ✅ Terminée |
| 1.C | Choix modèle gagnant | ✅ Anthropic Sonnet 4.6 |
| 2 | Anthropic switch + Staging + CI | ✅ Terminée (prod depuis 2026-05-10) |
| 3 | Contextes/scénarios cliquables | ✅ Terminée (prod depuis 2026-05-26) |
| **4** | **Refonte Voice (rebrand + UX mobile + auth longue + white mode)** | 🟡 **Plan rédigé, exécution à démarrer** |
| 5 | Mémoire long-terme | Non démarré |

Le sous-projet 4 est le premier chantier transverse mêlant rebrand technique, refonte visuelle complète, parité mobile et infra session. Il transforme l'app d'un dérivé `kyutai-labs/invincible-voice` générique en un outil personnel sobre nommé sobrement « Voice », calibré pour l'usage quotidien d'Arnaud (incapacité à parler, mobile-first absolu).

---

## Ce qui a été fait dans cette phase

### Découverte cadrante au brainstorm

L'app n'est PAS un produit générique ni une vitrine techno. Elle sert **uniquement** à Arnaud, un proche qui ne peut plus parler. Conséquences immédiates qui pilotent tout le design :

- **Mobile-first absolu** : smartphone = device principal, pas un fallback du desktop.
- **Zéro reconnexion** : un outil d'assistance personnelle n'a pas le droit d'imposer un re-login (question de dignité, pas de confort).
- **Lisibilité > esthétique** : white mode Apple-like, typo généreuse, gros targets tactiles, palette sobre.
- **Flow mixte** : Voice gère à la fois « interlocuteur parle → Voice suggère des réponses » ET « Arnaud initie → Voice compose et prononce ». Les deux doivent rester visibles sans switch d'onglet.

### Décisions prises au brainstorm

| Question | Choix |
|-|-|
| Personnalité visuelle | **Apple-like, neutre & calme** (blanc cassé, Inter, accent bleu système `#0A84FF`, ombres très douces, sobre/intemporel/lisible) |
| Layout conversation mobile | **Vue unifiée sans onglets** (chat scroll + suggestions cartes + chips contextes + input bar tout visible simultanément, l'historique part dans un écran dédié hors flow conversation) |
| Durée session | **1 an** (`ACCESS_TOKEN_EXPIRE_MINUTES = 525600` + cookie `maxAge: 365j`). Pas de refresh token (KISS, Arnaud a un device unique) |
| Portée du renommage | **Total** : user-facing + composants TS (`InvincibleVoice.tsx` → `Voice.tsx`) + fichiers backend (`kyutai_constants.py`, `unmute_handler.py`) + events WS (`unmute.*` → `voice.*`) |
| Parité settings mobile | **Pattern iOS Settings** : index + 9 sous-écrans drill-down (Profile / Voice / Language / Personality / Contexts / Keywords / Friends / Documents / Account) |

### Architecture cible (résumé)

**Phase 1 — Rebrand (atomique frontend + backend)**
- Strings i18n nettoyées dans 5 langues (FR/EN/DE/ES/PT) : plus de « Invincible » / « Kyutai » / « Unmute » / « Gradium ».
- Title HTML `<head>` → `Voice`. Footer logo Gradium supprimé.
- `services/frontend/src/components/InvincibleVoice.tsx` → `Voice.tsx` (composant + export + tests + tous les imports).
- `services/backend/backend/kyutai_constants.py` → `voice_constants.py`, `unmute_handler.py` → `voice_handler.py`, classe `UnmuteHandler` → `VoiceHandler`.
- Events WebSocket : `unmute.additional_outputs` → `voice.additional_outputs`, `unmute.response.text.delta.ready` → `voice.response.text.delta.ready`, `unmute.response.audio.delta.ready` → `voice.response.audio.delta.ready`, `unmute.interrupted_by_vad` → `voice.interrupted_by_vad`. Wire-format change, déploiement atomique frontend + backend dans la même PR.
- Nouveau test lint i18n (`messages/__tests__/i18n-no-legacy-brand.test.ts`) qui interdit les 4 termes hérités.

**Phase 2 — Session 1 an**
- `services/backend/backend/security.py:13` : `ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 365`.
- `services/frontend/src/auth/authContext.tsx:120,144` : cookie posé avec `maxAge: 365 * 24 * 60 * 60`, `sameSite: 'lax'`, `secure` conditionnel HTTPS.
- 2 tests TDD : backend `test_token_expiry.py` (décode JWT, vérifie `exp - now` ≈ 365j), frontend `cookie-maxage.test.tsx` (spy sur `Cookies.set`).

**Phase 3 — Palette & typo white mode**
- Tokens CSS dans `globals.css` : `--bg-primary #FFFFFF`, `--bg-secondary #F2F2F7`, `--text-primary #1C1C1E`, `--text-secondary #6B7280`, `--accent #0A84FF`, `--accent-soft #F5F7FA`, `--danger #FF3B30`, `--success #34C759`.
- Mapping Tailwind v4 via `@theme { --color-voice-* }`.
- Reskin de `Voice.tsx` (1502 lignes — chirurgie ciblée sur les classes `bg-[#121212/181818/1B1B1B]`, `orange-to-light-orange-gradient`, `text-white/gray-X`).
- Reskin `MobileLayout.tsx` (écran démarrage : titre « Voice » 52pt, mic central 160×160 bleu, CTA noir pill).
- Reskin `ContextsSelector.tsx`, `KeywordsSuggestion.tsx` (chips white-mode).
- Reskin `SettingsPopup.tsx` desktop (cohérence inter-devices).
- Reskin `StartConversationButton.tsx` (noir pill + icône Play).
- Neutralisation `BubbleTrail.tsx` (no-op composant, mock déjà en place dans `jest.setup.js`).
- Typographie : Inter, tailles `13/15/16/17/20/28/52`, weights `400/500/600/700`, letter-spacing négatif sur titres ≥ 28pt.

**Phase 4 — Mobile conversation unifiée**
- Refactor de `MobileConversationLayout.tsx` (370 lignes → ~150 lignes plus claires).
- Suppression du state `activePanel` + dispatcher `SIZE_BY_PANEL` + props `isHistoryMode` / `initialActivePanel`.
- Nouvelle structure verticale sticky : status bar / header (Arrêter rouge contour + roue crantée) / bandeau « L'interlocuteur parle… » (sticky live) / chat scroll `flex-1` / suggestions header + 3 cartes pleine largeur `bg-voice-accent-soft` / chips contextes / input pill + bouton send round 48×48.
- Bulles : `fit_content(280)`, padding `12×16`, corners asymétriques `[20,20,20,4]` à gauche (gris `#F2F2F7`), `[20,20,4,20]` à droite (bleu `#0A84FF`).
- Mode `isViewingPastConversation` conservé (cache le bloc bas).
- Accès historique déplacé dans un nouveau `MobileHistoryScreen` plein-page accessible depuis l'écran d'accueil.

**Phase 5 — Mobile settings full parity**
- `MobileSettingsPopup.tsx` devient un index router local (state `route: 'index' | 'profile' | 'voice' | ...`).
- 9 nouveaux sous-écrans dans `services/frontend/src/components/mobile/settings/` : `ProfileScreen`, `VoiceScreen`, `LanguageScreen`, `PersonalityScreen`, `ContextsScreen` (code migré depuis l'ancien popup), `KeywordsScreen`, `FriendsScreen`, `DocumentsScreen`, `AccountScreen`.
- Helper commun `_SubScreenShell.tsx` : header back chevron + titre centré + sticky footer save.
- Réutilisation des composants desktop existants (`VoiceSelector`, `VoiceUploadForm`, `DocumentEditorPopup`) en ajoutant une prop `theme: 'light' | 'dark'` (default `dark` pour compat desktop pendant la transition).
- Test d'intégration (`MobileSettingsPopup.integration.test.tsx`) qui vérifie la présence des 9 sections + navigation drill-down.

### Découvertes pendant l'exploration

- **Mobile actuel** : `MobileSettingsPopup` n'expose QUE `name` et `contexts` — soit ~20 % des paramètres desktop. Voix (sélection + clone), langue STT, prompt, keywords, friends, documents ne sont pas accessibles depuis mobile. Bloquant pour Arnaud (mobile-only).
- **MobileConversationLayout** : tabs `Chat / Responses / History` (370 lignes) qui forcent à choisir entre voir l'interlocuteur ou les suggestions. UX cassée pour une conversation en temps réel.
- **Auth** : token JWT 60min + cookie SANS `maxAge` (cookie session pur) → l'utilisateur perd sa session à chaque fermeture du navigateur. Aucune sécurité gagnée vu le profil d'usage.
- **Marque** : 166 occurrences brutes d'`Invincible`/`Kyutai`/`Unmute` dans le code (composant principal, classes, i18n strings, events WS, noms de fichiers Python).
- **Maquettes** : 3 écrans complets générés dans `voice.pen` via le MCP pencil (frame `ZjFyh` = démarrage, `g1rd8w` = conversation, `DRLRC` = paramètres). Ce sont les références visuelles authoritatives de la phase d'exécution.

### Artefacts produits

| Type | Path | Commit |
|-|-|-|
| Spec | `docs/superpowers/specs/2026-05-26-voice-refonte-design.md` | `fc77a14` |
| Plan | `docs/superpowers/plans/2026-05-26-voice-refonte.md` | `6d0219d` |
| Maquettes Pencil | `voice.pen` (3 écrans mobiles iPhone 393×852) | `fc77a14` |
| Phase summary | `docs/phases/2026-05-26-phase-summary-planning-sous-projet-4.md` | (ce commit) |

Pas de worktree créé (travail direct sur `main` puis branche dédiée à la phase d'exécution si besoin — à décider au démarrage).

---

## Plan d'exécution — 33 tâches en 5 phases + wrap-up

| Phase | Tâches | Étapes humaines |
|-|-|-|
| **1 — Rebrand (atomique)** | 1.1 (i18n strings 5 langues), 1.2 (title HTML + logo Gradium), 1.3 (`InvincibleVoice.tsx` → `Voice.tsx`), 1.4 (`kyutai_constants.py` → `voice_constants.py`), 1.5 (`unmute_handler.py` → `voice_handler.py` + `UnmuteHandler` → `VoiceHandler`), 1.6 (events WS `unmute.*` → `voice.*`), 1.7 (test lint i18n) | aucune (atomique, déployé en bloc) |
| **2 — Session 1 an** | 2.1 (backend JWT exp + test TDD), 2.2 (frontend cookie maxAge + test TDD) | aucune |
| **3 — Palette white mode** | 3.1 (tokens CSS + `@theme`), 3.2 (reskin `Voice.tsx`), 3.3 (reskin `MobileLayout`), 3.4 (reskin chips), 3.5 (reskin `SettingsPopup` desktop), 3.6 (reskin `StartConversationButton`), 3.7 (neutraliser `BubbleTrail`) | smoke test visuel mobile + desktop (dev local) |
| **4 — Mobile conversation unifiée** | 4.1 (refactor `MobileConversationLayout` sans tabs), 4.2 (déplacer historique vers écran dédié) | smoke test mobile (dev local) |
| **5 — Mobile settings full parity** | 5.1 (squelette index), 5.2 (`ProfileScreen` + `_SubScreenShell`), 5.3 (`VoiceScreen` + prop `theme` sur composants desktop), 5.4 (`LanguageScreen`), 5.5 (`PersonalityScreen`), 5.6 (`ContextsScreen` migré), 5.7 (`KeywordsScreen` + `FriendsScreen` + `DocumentsScreen`), 5.8 (`AccountScreen`), 5.9 (test intégration full parity), 5.10 (commit unique de la phase) | smoke test mobile complet (navigation 9 sous-écrans) |
| **Wrap-up** | W.1 (vérif globale tests + build prod), W.2 (push staging + validation + promote prod) | smoke staging (W.2 step 2), validation utilisateur prod (W.2 step 3) |

TDD strict sur les changements logiques (Phase 2 backend + frontend, Phase 4 absence de tabs, Phase 5 intégration full parity). Reskin (Phase 3) : pas de TDD pertinent, vérification via smoke visuel. Renames (Phase 1) : tests existants doivent rester verts, plus 1 nouveau test lint.

---

## Contraintes & rappels importants pour l'exécution

- **CLAUDE.md global** : ne JAMAIS écraser `.env` / `.env.prod` / `.env.staging` (pas concerné — aucune nouvelle env var nécessaire).
- **CLAUDE.md projet** : KISS, `trash` au lieu de `rm -rf`, pas d'over-engineering.
- **Lang user-facing en FR avec accents corrects** (é/è/ê/à/ç). Traductions humaines simples EN/DE/ES/PT — pas de Lokalise/i18n auto.
- **Conventional commits anglais** via `commit-workflow:commit` skill (toujours préfixer `COMMIT_SKILL=loaded` sur le `git commit`). Un commit par task, sauf Phase 5 qui se fait en plusieurs sous-tâches mais commit final unique (Task 5.10) — option assumée vu la cohérence du refactor.
- **TDD strict** sur Phase 2, Phase 4 (test absence tabs), Phase 5 (test intégration full parity). Rouge → vert → commit. Pas de `--no-verify`.
- **Pas de feature flag** ni de bascule progressive : Voice = un seul utilisateur (Arnaud), pas besoin d'orchestration.
- **Déploiement atomique frontend + backend** sur la Phase 1 obligatoirement (le wire-format des events WS change). Frontend et backend mergés ensemble.
- **Lint workflow cassé** depuis sous-projet 2 (`pnpm 11.0.9` vs Node 20 dans `lint.yml`) : non bloquant, ne pas chercher à le corriger.
- **Maquettes Pencil** : référence visuelle pour les Phases 3-5. Ouvrir `voice.pen` dans Pencil pour comparer les implémentations aux mockups (frames `ZjFyh`, `g1rd8w`, `DRLRC`).
- **Stubs jest `BubbleTrail` et `authUtils`** (commit `393dd35`, sous-projet 3) : toujours nécessaires pour faire tourner les tests frontend. Ne pas les retirer.

---

## Étapes humaines déléguées explicitement

1. **Phase 3 — smoke test visuel desktop** après reskin de `Voice.tsx` et `SettingsPopup.tsx` (Tasks 3.2 et 3.5). `pnpm dev`, vérifier qu'aucune zone n'est restée en dark mode.
2. **Phase 4 — smoke test mobile** après refactor de `MobileConversationLayout` (Task 4.1). Chrome DevTools mode iPhone 393×852, lancer une conversation, vérifier que chat + suggestions + input sont visibles simultanément sans tabs.
3. **Phase 5 — smoke test navigation settings complète** (Task 5.10 step 2). Naviguer dans chacun des 9 sous-écrans depuis mobile (393×852), modifier une valeur dans chaque, sauvegarder, vérifier persistance après ré-ouverture.
4. **W.2 step 2 — smoke staging** sur `https://staging.voice.amiral.tech` :
   - Écran d'accueil : « Voice » + mic + CTA noir, plus de logo Kyutai/Gradium.
   - Démarrer conversation : vue unifiée sans onglets, événements WS `voice.*` fonctionnels.
   - Settings : 9 sections visibles, drill-down OK pour chacune.
   - Login/logout : cookie persiste 1 an (`document.cookie` dans DevTools doit montrer `bearerToken; expires=<2027-05-26>`).
5. **W.2 step 3 — promote prod** sur `https://voice.amiral.tech`. Validation par Arnaud en usage réel sur 2-3 jours (ressenti qualitatif : « est-ce que tout est utilisable depuis mon téléphone maintenant ? »).

---

## Prompt prêt à coller pour la phase suivante (exécution sous-projet 4)

Pour reprendre dans une nouvelle session :

> Je veux exécuter le plan `docs/superpowers/plans/2026-05-26-voice-refonte.md` (33 tâches en 5 phases + wrap-up : 1 rebrand atomique → 2 session 1 an → 3 palette white mode → 4 mobile conversation unifiée → 5 mobile settings full parity → W staging+prod).
>
> Approche : **subagent-driven** (skill `superpowers:subagent-driven-development`). Dispatche un subagent par task en lui donnant la task complète extraite du plan ; auto mode actif, enchaîne sans valider entre tasks **sauf** pour les étapes humaines explicites :
> - Phase 3 — smoke test visuel desktop après Tasks 3.2 et 3.5.
> - Phase 4 — smoke test mobile après Task 4.1.
> - Phase 5 — smoke test navigation settings après Task 5.10.
> - W.2 step 2 — smoke staging sur https://staging.voice.amiral.tech.
> - W.2 step 3 — promote prod + validation utilisateur.
>
> Contraintes structurantes :
> - **Phase 1 est atomique** (wire-format WS events change) — frontend + backend mergés ensemble, pas de PR séparées.
> - **Phase 3 doit précéder les Phases 4 et 5** (les tokens CSS sont utilisés dans les nouveaux composants).
> - **Phase 2 est indépendante** et peut être faite en parallèle des autres si tu veux paralléliser.
>
> État au démarrage :
> - Sous-projet 3 (contextes cliquables) terminé en prod depuis 2026-05-26.
> - Spec sous-projet 4 committé : `docs/superpowers/specs/2026-05-26-voice-refonte-design.md` (commit `fc77a14`).
> - Plan sous-projet 4 committé : `docs/superpowers/plans/2026-05-26-voice-refonte.md` (commit `6d0219d`).
> - Maquettes Pencil : `voice.pen` (frames `ZjFyh` démarrage, `g1rd8w` conversation, `DRLRC` paramètres). Référence visuelle authoritative.
> - Phase summary : `docs/phases/2026-05-26-phase-summary-planning-sous-projet-4.md`.
>
> Contraintes à respecter (rappel) :
> - **KISS** — pas d'over-engineering, pas de feature flag.
> - **TDD strict** sur Phase 2 + tests intégration Phase 4/5 : rouge → vert → commit.
> - **Conventional commits anglais** via `commit-workflow:commit` skill (préfixe `COMMIT_SKILL=loaded`).
> - **Tous les labels UI en FR avec accents corrects** ; traductions humaines simples pour EN/DE/ES/PT.
> - **Pas de `--no-verify`** sur les commits.
> - **Lint workflow cassé** : non bloquant.
> - **`trash`** au lieu de `rm -rf`.
> - **Stubs `BubbleTrail` / `authUtils`** dans `jest.setup.js` à conserver (héritage sous-projet 3).
>
> Ressources clés :
> - Spec : `docs/superpowers/specs/2026-05-26-voice-refonte-design.md`
> - Plan : `docs/superpowers/plans/2026-05-26-voice-refonte.md`
> - Maquettes : `voice.pen`
> - Phase summary planning : `docs/phases/2026-05-26-phase-summary-planning-sous-projet-4.md`
> - Phase summary sous-projet 3 (état prod actuel) : `docs/phases/2026-05-26-phase-summary-execution-sous-projet-3.md`
>
> Démarre par la **Phase 1 — Task 1.1** (strings i18n — supprimer Invincible Voice / InvincibleVoice).

---

## À surveiller pendant l'exécution

- **Phase 1 atomicité** : les events WS `voice.*` doivent être déployés simultanément frontend + backend. Si la PR se découpe en plusieurs commits, ne PAS pousser un commit qui ne contient que la partie backend (ou que la partie frontend) sur staging — l'app serait cassée pendant la fenêtre intermédiaire. Vérifier le smoke staging immédiatement après Task 1.6.
- **Phase 3 régressions cosmétiques** : pas de Storybook, pas de tests visuels. Risque sur les composants peu testés (KeywordsSuggestion, BubbleTrail, CouldNotConnect). Vérification manuelle obligatoire en smoke staging avant promote prod.
- **Phase 4 `useViewportHeight`** : le hook existant gère l'apparition du clavier mobile (calcul `keyboardHeight = vh - visualVh`). Conserver tel quel ; le nouveau layout en dépend pour le sticky bottom.
- **Phase 5 prop `theme`** : ajouter `theme: 'light' | 'dark'` aux composants desktop réutilisés (`VoiceSelector`, `VoiceUploadForm`, `DocumentEditorPopup`) avec default `'dark'` pour ne pas casser desktop pendant la migration. À la fin de la phase, basculer les call-sites desktop sur `'light'` aussi (cohérent avec Phase 3 reskin de `SettingsPopup`).
- **Documents — typage `UserSettings.documents`** : vérifier au moment de l'impl la forme exacte dans `services/frontend/src/types/user.ts` et adapter `DocumentsScreen.tsx` si nécessaire. Le plan note explicitement ce point.
- **Token migration** : les utilisateurs déjà loggués gardent leur token court (60min) jusqu'à expiration ou prochain login. Aucune migration data nécessaire. Pour Arnaud : un logout/login manuel garantit le nouveau token 1 an.
- **Pas de Cache-Control particulier à ajouter** : Next.js sert déjà les bundles avec un hash dans le nom de fichier, le reload après déploiement charge automatiquement le nouveau JS sans cache stale.
- **Bug UX 401 sur register email existant** (rappel) : `services/backend/backend/routes/auth.py:148-153` retourne 401 trompeur. **Toujours non corrigé**. Hors-scope.

---

## Métriques attendues

- ~25 commits de feature + 1 commit de merge staging + 1 commit de merge prod + 1 tag `phase-4-voice-refonte`.
- ~6 nouveaux tests :
  - Backend : `test_token_expiry.py` (1 test), `test_events.py` (4 tests sur les types `voice.*`).
  - Frontend : `cookie-maxage.test.tsx` (1 test), `i18n-no-legacy-brand.test.ts` (5 tests, un par locale), `MobileConversationLayout.unified.test.tsx` (2 tests), `MobileSettingsPopup.integration.test.tsx` (2 tests).
- ~14 nouveaux fichiers (9 sous-écrans settings + `_SubScreenShell` + 4 fichiers de tests).
- ~5 fichiers renommés (composant principal + 2 fichiers Python + 2 fichiers de tests Python).
- Aucune migration data, aucun rollback prévu (refactor pur, déploiement atomique).
- Validation utilisateur asynchrone : ressenti d'Arnaud en usage réel mobile sur 2-3 jours après bascule prod.
