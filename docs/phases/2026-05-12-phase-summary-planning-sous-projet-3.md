# Phase Summary — Planning Sous-Projet 3 (Contextes / scénarios cliquables)

**Date :** 2026-05-12
**Phase terminée :** Brainstorming + spec + plan d'implémentation pour le Sous-projet 3
**Phase suivante :** Exécution du plan en 5 chantiers (A backend modèle+prompt+WS → B seeding → C frontend types+composant → D Settings+i18n → E staging+prod)

---

## Vision globale du projet

| # | Sous-projet | Statut |
|-|-|-|
| 1.A | LiteLLM migration | ✅ Terminée |
| 1.B | Eval harness | ✅ Terminée |
| 1.C | Choix modèle gagnant | ✅ Anthropic Sonnet 4.6 |
| 2 | Anthropic switch + Staging + CI | ✅ Terminée (en prod depuis 2026-05-10) |
| **3** | **Contextes/scénarios cliquables** | 🟡 **Plan rédigé, exécution à démarrer** |
| 4 | Mémoire long-terme | Non démarré |

Le sous-projet 3 est le premier sous-projet purement produit (UX + orientation LLM, pas d'infra). Il complète les deux leviers existants pour orienter le LLM (`user_settings.prompt` globale, `current_keywords` par-réponse) avec un troisième niveau intermédiaire : la **situation/scène** (contextes cliquables multi-select : « Au travail », « Avec ma sœur Sophie », « Rendez-vous médical », etc.).

---

## Ce qui a été fait dans cette phase

### Décisions prises au brainstorm

| Question | Choix |
|-|-|
| Architecture des contextes | **Approche B** — Nouveau champ `UserSettings.contexts: list[Context]` + nouveau WebSocket event `current.contexts` + section dédiée `## Active contexts` dans le system prompt. Sémantique propre, extensible, alignée sur le pattern existant `current_keywords`. |
| UX du sélecteur | **Chips multi-select en haut de conversation** (carte parallèle à Amis/Keywords dans la colonne droite). Toggle libre, visible toute la session. |
| Édition par l'utilisateur | **CRUD dans Settings** (desktop + mobile) calqué sur l'éditeur additional_keywords existant. 5 contextes FR par défaut seedés. |
| Sélection multi | **Multi-select** (plus expressif, ex: « Au boulot » + « Avec Paul ») |
| Backfill users existants | **Seeding lazy au load** dans `get_user_data_from_storage` si liste vide ; persistance side-effect au premier load. |
| Comportement section vide | **Section absente du system prompt** quand aucun contexte actif (comportement actuel préservé). |
| Persistance entre conversations | **Reset à chaque nouvelle conversation** (chaque conv = nouvelle situation). |
| Stockage labels | **Texte libre user-defined**, pas de traduction auto. Défauts seedés en FR (langue principale) quel que soit le `language` choisi à l'inscription. |

### Architecture cible (résumé)

**Backend**

- Nouveau modèle pydantic `Context(id: uuid.UUID, label: str)` dans `services/backend/backend/typing.py`.
- Nouveau champ `UserSettings.contexts: list[Context] = Field(default_factory=list)` (rétrocompat zéro migration).
- Nouvel état session `Chatbot.current_contexts: list[str]` inclus dans `proxy_hash` pour invalidation correcte.
- Signature étendue `to_llm_ready_conversation(..., active_contexts: list[str])` qui insère une section conditionnelle `## Active contexts` après la section User's prompt.
- Nouveau message WebSocket `CurrentContexts(BaseEvent[Literal["current.contexts"]])` + handler `set_current_contexts` + dispatch dans `libs/websockets.py`.
- Seeding `DEFAULT_CONTEXTS_FR` (5 labels) à l'inscription (`get_new_user` dans `routes/auth.py`) **et** au load lazy si liste vide (`get_user_data_from_storage`).

**Frontend**

- Type `Context { id: string; label: string }` côté TS, miroir backend.
- Nouveau composant `ContextsSelector.tsx` (chips multi-select, accessible via `aria-pressed`).
- État `activeContextIds: Set<string>` + `sendCurrentContexts` dans `InvincibleVoice.tsx` (paire au `sendCurrentKeywords`).
- Reset au `readyState === OPEN` (nouvelle conversation) avec envoi initial `current.contexts: []`.
- Section CRUD dans `SettingsPopup.tsx` (desktop) et `MobileSettingsPopup.tsx` (mobile).
- 5 langues i18n : FR/EN/ES/PT/DE (labels UI uniquement ; les contextes user-stored restent en clair).

### Découvertes pendant l'exploration

- L'app a déjà 2 leviers d'orientation du LLM : `user_settings.prompt` (globale, settings) et `current_keywords` (par-réponse, chips runtime). Les contextes occupent le **niveau intermédiaire** manquant : situation persistante pour toute la conversation.
- Le système prompt est construit dynamiquement dans `services/backend/backend/storage.py:to_llm_ready_conversation` (lignes 41-99). Pattern à étendre proprement avec une nouvelle section conditionnelle.
- Le dispatcher WebSocket existant (`services/backend/backend/libs/websockets.py:162-186`) utilise un pattern `isinstance(message, ora.X)` ; ajout linéaire d'un cas.
- Les `additional_keywords` settings sont déjà multilingues par défaut à l'inscription (`auth.py:56-122`). Choix délibéré différent pour les contextes : seed FR uniquement (langue principale du projet, simplicité, l'utilisateur peut éditer).
- Le `Chatbot.proxy_hash` (chatbot.py:30-45) est la pièce critique pour l'invalidation de génération : `current_contexts` doit y être inclus sous forme `tuple(...)` pour rester hashable.

### Artefacts produits

| Type | Path | Commit |
|-|-|-|
| Spec | `docs/superpowers/specs/2026-05-12-clickable-contexts-design.md` | `19f5a2e` |
| Plan | `docs/superpowers/plans/2026-05-12-clickable-contexts.md` | `0219444` |
| Phase summary | `docs/phases/2026-05-12-phase-summary-planning-sous-projet-3.md` | (ce commit) |

Tous committés sur la branche worktree `worktree-subproject-3-clickable-contexts` dans `.claude/worktrees/subproject-3-clickable-contexts`. À merger sur `staging` au début de l'exécution.

---

## Plan d'exécution — 17 tâches en 5 chantiers

| Chantier | Tâches | Étapes humaines |
|-|-|-|
| **A — Backend modèle + prompt + WebSocket** | A1 (Context model + UserSettings, TDD), A2 (DEFAULT_CONTEXTS_FR), A3 (section ## Active contexts), A4 (Chatbot.current_contexts + proxy_hash), A5 (CurrentContexts event + handler + dispatch) | aucune (tout testé en isolation) |
| **B — Seeding** | B1 (seed lazy au load), B2 (seed à l'inscription) | aucune |
| **C — Frontend types + composant** | C1 (types Context), C2 (composant ContextsSelector + tests), C3 (intégration InvincibleVoice.tsx + reset par conv + intégration mobile + tests) | aucune |
| **D — Settings + i18n** | D1 (Settings desktop CRUD), D2 (Settings mobile CRUD), D3 (i18n fr/en/es/pt/de) | aucune |
| **E — Staging + prod** | E1 (push staging + smoke test E2E), E2 (bascule prod + validation utilisateur 2-3 conversations + tag phase-3) | E1 step 6 (smoke staging), E2 step 3 (smoke prod), E2 step 5 (usage réel) |

TDD strict appliqué sur tous les nouveaux modèles, états, et events backend (rouge → vert → commit). Tests frontend unit pour le composant + tests intégration WebSocket calqués sur `current-keywords.test.tsx`. Pas de migration data (rétrocompat via `default_factory=list`), pas de plan de rollback data spécifique — `git revert` du commit de merge suffit.

---

## Contraintes & rappels importants pour l'exécution

- **CLAUDE.md global** : ne JAMAIS écraser `.env` / `.env.prod` / `.env.staging`. (Pas concerné par ce sous-projet — pas de nouvelles env vars.)
- **CLAUDE.md projet** : KISS, `trash` au lieu de `rm -rf`, pas d'over-engineering.
- **Lang user-facing** : tous les nouveaux labels UI en FR avec accents corrects (é/è/ê/à/ç). Mêmes accents dans les traductions PT/ES/DE.
- **Conventional commits anglais**, un commit par task. Sujet précis (`feat(typing): ...`, `feat(prompt): ...`, `feat(ws): ...`, `feat(frontend): ...`, `feat(settings): ...`, `i18n: ...`).
- **TDD strict** : rouge → vert → commit. Pas de skip, pas de `--no-verify`.
- **Lint frontend pré-existant cassé** (cf sous-projet 2, `pnpm 11.0.9` vs Node 20 dans `lint.yml`) : **non bloquant**, ne pas chercher à le corriger dans cette phase.
- **Pas de feature flag** ni de bascule progressive : le sous-projet 3 est petit, on déploie tout d'un coup sur staging puis prod.
- **Mémoire VPS** : confortable (~2.5 GB libres après sous-projet 2). Pas de risque OOM avec un changement purement applicatif sans nouveau container.

---

## Étapes humaines déléguées explicitement

1. **E1 step 6** — Smoke test conversationnel sur `https://staging.voice.amiral.tech` après chantiers A-D :
   - Vérifier que les 5 contextes par défaut sont visibles.
   - Ajouter un contexte custom dans Settings.
   - Démarrer une conversation, cliquer 1-2 contextes, parler, valider qualitativement les suggestions.
   - Vérifier le reset à la conversation suivante.
2. **E2 step 3** — Smoke test prod sur `https://voice.amiral.tech` après bascule.
3. **E2 step 5** — Validation utilisateur en usage réel sur 2-3 conversations (Louis ; verdict qualitatif : « les suggestions sont-elles plus pertinentes ? »). Si pas concluant → ticket d'ajustement (renforcer wording du prompt), sans bloquer la phase.

---

## Prompt prêt à coller pour la phase suivante (exécution sous-projet 3)

Pour reprendre dans une nouvelle session :

> Je veux exécuter le plan `docs/superpowers/plans/2026-05-12-clickable-contexts.md` (17 tâches en 5 chantiers : A backend modèle+prompt+WS → B seeding → C frontend types+composant → D Settings+i18n → E staging+prod).
>
> Approche : **subagent-driven** (skill `superpowers:subagent-driven-development`). Dispatche un subagent par task en lui donnant la task complète extraite du plan ; auto mode actif, enchaîne sans valider entre tasks **sauf** pour les étapes humaines explicites :
> - E1 step 6 (smoke test staging après chantiers A-D)
> - E2 step 3 (smoke test prod après bascule)
> - E2 step 5 (validation utilisateur en usage réel — peut être asynchrone)
>
> État au démarrage :
> - Sous-projet 2 (Anthropic Sonnet 4.6 + staging + CI) terminé en prod depuis 2026-05-10.
> - Spec sous-projet 3 committé : `docs/superpowers/specs/2026-05-12-clickable-contexts-design.md` (commit `19f5a2e`).
> - Plan sous-projet 3 committé : `docs/superpowers/plans/2026-05-12-clickable-contexts.md` (commit `0219444`).
> - Branche worktree : `worktree-subproject-3-clickable-contexts` dans `.claude/worktrees/subproject-3-clickable-contexts`. Travailler directement dans ce worktree.
> - Voir `docs/phases/2026-05-12-phase-summary-planning-sous-projet-3.md` pour le contexte complet.
>
> Contraintes à respecter (rappel) :
> - **KISS** — pas d'over-engineering, pas de feature flag.
> - **TDD strict** : rouge → vert → commit. Un commit par task.
> - **Conventional commits anglais**.
> - **Tous les labels UI en FR avec accents corrects** ; traductions humaines simples pour EN/ES/PT/DE.
> - **Pas de `--no-verify`** sur les commits.
> - **Lint workflow cassé** : non bloquant, ne pas chercher à le corriger.
> - **`trash`** au lieu de `rm -rf`.
> - **Merge order** : `worktree-subproject-3-clickable-contexts` → `staging` (E1) → `main` (E2).
>
> Ressources clés :
> - Spec : `docs/superpowers/specs/2026-05-12-clickable-contexts-design.md`
> - Plan : `docs/superpowers/plans/2026-05-12-clickable-contexts.md`
> - Phase summary planning (contexte étendu) : `docs/phases/2026-05-12-phase-summary-planning-sous-projet-3.md`
> - Phase summary sous-projet 2 (état prod actuel) : `docs/phases/2026-05-10-phase-summary-execution-sous-projet-2.md`
>
> Démarre par la **Task A1** (Context pydantic model + UserSettings.contexts, TDD).

---

## À surveiller pendant l'exécution

- **Compatibilité descendante UserData** : le seeding lazy au load **réécrit** le fichier `user_data/<email>.json` au premier load post-déploiement. Acceptable (idempotent, une seule fois par user). Pas d'autre side-effect.
- **Comportement LLM avec la nouvelle section** : Sonnet 4.6 doit utiliser activement les contextes (vocabulaire, ton, pertinence). Si le ressenti utilisateur (E2 step 5) montre que le LLM ignore les contextes, renforcer le wording dans `to_llm_ready_conversation` (ton plus directif, exemples in-context) — ticket d'ajustement, pas un blocker.
- **Conflit sémantique avec `current_keywords`** : deux sections proches dans le prompt (`## Active contexts` situationnel, `## User's keywords sent to you to guide your answers` par-réponse). Séparation par titres et wording explicite. À valider qualitativement en smoke test.
- **Espace mobile** : carte `ContextsSelector` dans `MobileConversationLayout` peut être à l'étroit. Plan prévoit fallback collapsible/accordion via `<details>` natif si la chip-row pousse les autres composants hors écran.
- **Bug UX 401 sur register email existant** (rappel sous-projets 1 & 2) : `services/backend/backend/routes/auth.py:148-153` retourne 401 trompeur quand l'email à enregistrer existe déjà. **Toujours non corrigé**. Hors-scope de ce sous-projet.

---

## Métriques attendues

- ~13 commits de feature + 1 commit de merge staging + 1 commit de merge prod + 1 tag `phase-3-clickable-contexts`.
- ~10 nouveaux tests (3-4 backend unit dans `test_contexts.py`, 1 backend integration dans `test_contexts_e2e.py`, 3-4 frontend unit dans `contexts-selector.test.tsx` et `current-contexts.test.tsx`).
- Aucune migration data, aucun rollback prévu.
- Validation utilisateur asynchrone : 2-3 conversations en usage réel sur quelques jours après bascule prod.
