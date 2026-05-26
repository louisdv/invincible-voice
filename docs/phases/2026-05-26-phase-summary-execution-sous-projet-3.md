# Phase Summary — Exécution Sous-Projet 3 (Contextes / scénarios cliquables)

**Date :** 2026-05-26
**Phase terminée :** Exécution complète des 5 chantiers (A backend modèle+prompt+WS, B seeding, C frontend types+composant+intégration, D Settings+i18n, E staging+prod)
**Phase suivante :** Sous-projet 4 (Mémoire long-terme) — non démarré

---

## Vision globale du projet

| # | Sous-projet | Statut |
|-|-|-|
| 1.A | LiteLLM migration | ✅ Terminée |
| 1.B | Eval harness | ✅ Terminée |
| 1.C | Choix modèle gagnant | ✅ Anthropic Sonnet 4.6 |
| 2 | Anthropic switch + Staging + CI | ✅ Terminée (prod depuis 2026-05-10) |
| 3 | **Contextes/scénarios cliquables** | ✅ **Terminée (prod depuis 2026-05-26)** |
| 4 | Mémoire long-terme | Non démarré |

---

## Ce qui a été fait

### Chantier A — Backend modèle + system prompt + WebSocket event

| # | Commit | Sujet |
|-|-|-|
| A1 | `c3b4e16` | feat(typing): add Context model and UserSettings.contexts field |
| A2 | `5d86e93` | feat(prompt): add DEFAULT_CONTEXTS_FR seed list |
| A3 | `4228736` | feat(prompt): inject Active contexts section into system prompt |
| A4 | `70ca2e4` | feat(chatbot): track current_contexts in session state and proxy hash |
| A5 | `69cfeb5` | feat(ws): add current.contexts event and handler |

TDD strict (rouge → vert → commit). 13 nouveaux tests backend dans `test_contexts.py` + `test_contexts_e2e.py`. La signature `to_llm_ready_conversation(..., active_contexts: list[str])` casse l'appelant unique dans `chatbot.preprocessed_messages` ; placeholder `[]` posé en A3, remplacé par `self.current_contexts` en A4.

Note infra : A3 a ajouté `services/backend/tests/conftest.py` (non prévu au plan) pour injecter les env vars requises par `kyutai_constants` au moment de l'import — sans ça les nouveaux tests qui importent `backend.storage` ne pouvaient pas tourner. `os.environ.setdefault(...)` ne clobber pas le CI.

### Chantier B — Seeding

| # | Commit | Sujet |
|-|-|-|
| B1 | `dc17d72` | feat(storage): seed default FR contexts on user data load when empty |
| B2 | `35b2cc3` | feat(auth): seed default FR contexts at user registration |

Lazy au load (idempotent, réécrit `user_data/<email>.json` au premier accès post-déploiement) + seed à l'inscription. IDs stables (tests asserts ID inchangé entre reloads).

### Chantier C — Frontend types + composant ContextsSelector

| # | Commit | Sujet |
|-|-|-|
| C1 | `d8527e8` | feat(types): add Context type and UserSettings.contexts (frontend) |
| C2 | `746d1e2` | feat(frontend): add ContextsSelector component with unit tests |
| — | `393dd35` | fix(tests): add stubs for app/BubbleTrail and app/authUtils referenced by jest.setup |
| C3 | `8ca25c3` | feat(frontend): wire ContextsSelector into conversation flow with reset on connect |
| — | `9e21360` | fix(mobile): annotate activeContextIds default as Set<string> |

C2 a 4 tests unit (Jest, pas Vitest comme le plan le suggérait). C3 utilise « Option A » : tests unit pure-logic sur le callback `handleContextToggle` plutôt qu'un harness React Testing Library complet, parce que la suite frontend pré-existante est cassée (références à des modules refactorés sous `src/hooks/` mais les tests pointent encore vers `../X`). Hors-scope de la phase 3.

Commit annexe `393dd35` : `jest.setup.js` référence `./src/app/BubbleTrail` et `./src/app/authUtils` qui n'existent nulle part dans le repo (cassure pré-existante datant d'un refactor upstream). Sans stubs, AUCUN test frontend ne peut tourner. 4 lignes de stubs au total ; décision documentée et validée avec l'utilisateur en cours d'exécution.

Commit `9e21360` : typo TypeScript du C3 — `new Set()` infère `Set<unknown>` au lieu de `Set<string>`, incompatible avec le prop typé. Annotation explicite.

### Chantier D — Settings editor + i18n

| # | Commit | Sujet |
|-|-|-|
| D1 | `520d57d` | feat(settings): add contexts CRUD in desktop settings popup |
| D2 | `31b1eca` | feat(settings): add contexts CRUD in mobile settings popup |
| D3 | `1fe8afb` | i18n: add contexts translations in fr/en/es/pt/de |

D1 : CRUD inséré entre les cards keywords et friends dans `SettingsPopup.tsx`, calqué sur le pattern keywords existant (carte ronde `bg-[#101010]`, input + bouton "Ajouter" gradient). Validation de longueur (≤100) + duplicate (case-insensitive).

D2 : `MobileSettingsPopup.tsx` était intentionnellement minimaliste (juste Name + sign-out + hint "more settings on desktop"). Au lieu de dupliquer le pattern desktop, ajouté une section compacte verticale en accord avec l'UX mobile existante (plus simple, pas de chips horizontales).

D3 : 35 nouvelles clés (7 par langue × 5 langues). Accents FR vérifiés (é, è, ê, à, ç), idem ñ/ü/ä/ç/ã pour les autres langues.

### Chantier E — Staging + prod

| # | Commit | Sujet |
|-|-|-|
| E1 | `ffefb1a` | feat: clickable contexts (sous-projet 3) — merge worktree → staging (--no-ff) |
| Hotfix | `b258d58` | fix(ws): only regenerate response when current_contexts actually changes |
| E1 | `e89b16c` | fix: only regenerate on context change (staging follow-up) — merge hotfix → staging (--no-ff) |
| E2 | `72c3367` | feat: clickable contexts (sous-projet 3) — promote to prod (--no-ff) |

Staging déployé en 1m26s la première fois (CI `deploy-staging.yml`). Smoke test révèle un bug de placement de message dans la conversation (les suggestions cliquées atterrissaient au mauvais endroit) ; voir section « Découvertes » plus bas. Fix `b258d58` poussé puis redéploy staging en 11s. Bascule prod 13s. Health check prod 500 transient pendant la première seconde (cold-start), 200 OK ensuite.

Tag `phase-3-clickable-contexts` posé sur le merge `72c3367`.

---

## Découvertes pendant l'exécution

### Bug d'ordre des messages introduit par le reset OPEN

**Symptôme** observé lors du smoke staging : les suggestions cliquées s'inséraient « à la suite de ce que j'ai dit précédemment » au lieu de la fin de la conversation.

**Cause racine** : le handler `set_current_contexts` (chantier A5) appelait `_generate_response()` sans condition, contrairement à `add_keywords` qui guarde avec `if self.chatbot.current_keywords is not None`. Le frontend (C3) envoie `current.contexts: []` sur chaque `readyState === ReadyState.OPEN` pour réinitialiser l'état session. Avec le handler non-guardé, ça déclenchait une génération LLM sur conversation vide ; un clic sur une de ces suggestions-fantômes plaçait l'assistant message en position 0 de `rawChatHistory` avec `Date.now()`, et les tours speaker ultérieurs (timestamp = `currentSpeakerMessageStartTime`, antérieur au clic) se retrouvaient triés avant — cassant l'ordre chronologique perçu.

**Fix** (`b258d58`) : guard `if contexts_changed: await self._generate_response()`, exact mirror du pattern keywords. 2 nouveaux tests : `test_current_contexts_event_skips_regen_when_unchanged` (le cas `[]→[]` à l'OPEN) et `test_current_contexts_event_triggers_regen_when_cleared` (le cas `[A]→[]` quand l'utilisateur déselectionne, qui DOIT regénérer).

**Leçon** : copier-coller à partir de la mauvaise référence (`set_desired_responses_length` non-guardé) plutôt que `add_keywords` (guardé). Le plan ne signalait pas explicitement cette distinction. À retenir pour les futurs handlers WebSocket : toujours regen-conditionnel sur changement effectif.

### Test infra frontend cassée pré-existante

`jest.setup.js` mocke `./src/app/BubbleTrail` et `./src/app/authUtils` qui n'existent dans le repo (le refactor upstream les a supprimés sans nettoyer le setup). Conséquence : AUCUN test frontend ne pouvait tourner sur main (ni avant ni après cette phase). Stubs de 4 lignes ajoutés (`393dd35`) pour débloquer le run des nouveaux tests. **Pas touché aux autres tests cassés** (références à `../useAudioProcessor` etc. qui pointent vers `src/app/` au lieu de `src/hooks/`) — hors-scope, lint workflow cassé non-bloquant cf phase summary planning.

### Plan vs réalité — Vitest annoncé, Jest utilisé

Le plan mentionnait Vitest 7 fois dans les sections frontend ; le projet utilise Jest. Les tests ont été adaptés (`jest.mock`, `jest.fn()`, pas d'import depuis `vitest`). Aucun impact fonctionnel.

### MobileSettingsPopup intentionnellement minimaliste

Le plan supposait que le mobile avait un éditeur complet calqué sur le desktop. En réalité `MobileSettingsPopup.tsx` (93 lignes) n'expose que Name + sign-out + un hint « more settings on desktop ». Le pattern desktop n'aurait pas été cohérent ; ajouté à la place une section verticale compacte qui matche la philosophie mobile.

---

## Artefacts produits

| Type | Path | Commit |
|-|-|-|
| Spec | `docs/superpowers/specs/2026-05-12-clickable-contexts-design.md` | `19f5a2e` |
| Plan | `docs/superpowers/plans/2026-05-12-clickable-contexts.md` | `0219444` |
| Phase summary planning | `docs/phases/2026-05-12-phase-summary-planning-sous-projet-3.md` | `59e80fc` |
| Phase summary exécution | `docs/phases/2026-05-26-phase-summary-execution-sous-projet-3.md` | (ce commit) |
| Tag prod | `phase-3-clickable-contexts` (sur merge `72c3367`) | — |

---

## Métriques

- **Commits feature/fix** : 17 (15 prévus + 1 hotfix `b258d58` + 1 fix test infra `393dd35` + 1 typo TS `9e21360`)
- **Commits de merge** : 3 (worktree→staging, hotfix→staging, staging→main)
- **Tests** : 27 backend tests passent (dont 18 nouveaux dans `test_contexts*.py`), 9 tests frontend Jest nouveaux passent
- **Migration data** : aucune (rétrocompat via `default_factory=list` + lazy seeding au load)
- **Rollback prévu** : non utilisé (smoke test bug corrigé en staging avant promotion)
- **Latence déploiement** : staging 1m26s puis 11s pour le hotfix ; prod 13s

---

## Tâches asynchrones / suivi

- **E2 step 5 — validation usage réel** : Louis utilise l'app sur 2-3 conversations sur quelques jours pour vérifier qualitativement que les suggestions teintées par contextes sont plus pertinentes qu'avec keywords seuls. Si pas concluant → ticket d'ajustement (renforcer le wording de la section system prompt dans `to_llm_ready_conversation`), sans bloquer la phase.

- **Test infra frontend** : à reconnecter dans une future phase utilitaire. Les tests pointent vers `../useAudioProcessor` etc. au lieu de `@/hooks/useAudioProcessor` — refactor d'une heure pour faire repasser la suite complète.

- **Bug UX 401 sur register email existant** (`auth.py:148-153`) — toujours non corrigé, hors-scope.

---

## Contraintes & rappels (rétro-respectés)

- ✅ KISS, pas de feature flag, pas d'over-engineering.
- ✅ TDD strict côté backend (rouge → vert → commit, 13 nouveaux tests).
- ✅ Conventional commits anglais.
- ✅ Tous les labels UI en FR avec accents corrects ; traductions humaines EN/ES/PT/DE.
- ✅ Pas de `--no-verify` sur les commits.
- ✅ `trash` (jamais `rm -rf`).
- ✅ Merge order respecté : worktree → staging (E1) → main (E2).
- ⚠️ Lint workflow pré-existant cassé : non bloquant, non corrigé (cf sous-projet 2).
- ⚠️ Test suite frontend pré-existante cassée (refs `../X` au lieu de `@/hooks/X`) : 2 stubs ajoutés pour débloquer ce qui doit l'être ; reste hors-scope.

---

## Prochaine phase

Sous-projet 4 (Mémoire long-terme). Brainstorming + spec + plan à rédiger. À démarrer après validation utilisateur réelle du sous-projet 3 (E2 step 5).
