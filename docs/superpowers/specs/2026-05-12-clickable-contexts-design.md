# Sous-projet 3 — Contextes / scénarios cliquables

**Date :** 2026-05-12
**Statut :** Design validé, prêt pour writing-plans
**Périmètre parent :** Suite du sous-projet 2 (Anthropic switch + Staging + CI). Premier sous-projet purement produit (UX + LLM-orientation), pas d'infra.

## Contexte

L'app InvincibleVoice assiste une personne atteinte de SLA dans ses conversations : un STT capte les paroles de l'interlocuteur, le LLM (Anthropic Sonnet 4.6) suggère 4 réponses + 10 mots-clés, l'utilisateur clique sur une suggestion qui est lue à voix haute via TTS (voix clonée).

Aujourd'hui, l'utilisateur n'a que deux leviers pour orienter le LLM :

| Levier | Sémantique | Portée |
|-|-|-|
| `user_settings.prompt` (settings) | Description générale de l'utilisateur, immuable pendant la session | Globale |
| `current_keywords` (chips cliquables en cours de conv) | Mots qui doivent apparaître dans la prochaine suggestion | UNE réponse |

Le **prompt général** est lourd à éditer (settings popup, sauvegarde). Les **keywords** orientent uniquement la réponse immédiate. Il manque un niveau intermédiaire : décrire **la situation/scène** dans laquelle l'utilisateur se trouve pour qu'elle teinte toutes les suggestions de la conversation.

## Objectif

Permettre à l'utilisateur de cliquer rapidement un **contexte** (ex: « Au travail », « Avec ma sœur Sophie », « Rendez-vous médical ») pour pré-orienter le LLM sur la situation globale, plutôt qu'à devoir l'exprimer mot par mot via les keywords. But : réduire la charge cognitive et rendre les premières réponses plus pertinentes.

## Scope

**Inclus**

- Nouveau champ `UserSettings.contexts: list[Context]` (backend + frontend types) avec persistance JSON par utilisateur.
- Seeding de 5 contextes FR par défaut à l'inscription **et** à la première lecture si liste vide (rétrocompat users existants).
- Section dédiée "Contextes" dans l'éditeur de Settings : ajouter / supprimer.
- Composant `ContextsSelector` en colonne droite de la conversation (au-dessus de la card Amis), chips toggle multi-select.
- Nouveau WebSocket event `current.contexts` (frontend → backend) et nouveau champ session `chatbot.current_contexts`.
- Nouvelle section `## Active contexts` dans le system prompt construit par `to_llm_ready_conversation`, **absente** si aucun contexte actif.
- Réinitialisation des contextes actifs au début de chaque conversation.
- i18n FR / EN / ES / PT / DE pour les labels d'UI.
- Tests : 3 backend unit + 1 backend integration + 2 frontend unit + extension d'un test E2E existant.

**Hors-scope (YAGNI)**

- Contextes hiérarchiques (parent/enfant).
- Contextes partagés entre utilisateurs.
- Suggestion automatique de contextes par le LLM (réservé au sous-projet 4 mémoire long-terme).
- Templates pré-faits avec emojis ou icônes.
- Persistance du contexte actif entre conversations.
- Traduction automatique des labels (texte libre user-defined).
- Drag & drop de réordonnancement (ordre = ordre d'ajout).

## Architecture

### Modèle de données

`services/backend/backend/typing.py` :

```python
class Context(pydantic.BaseModel):
    id: uuid.UUID
    label: str  # ex: "Au travail"


class UserSettings(pydantic.BaseModel):
    name: str
    prompt: str
    additional_keywords: list[str]
    friends: list[str]
    documents: list[Document] = pydantic.Field(default_factory=list)
    contexts: list[Context] = pydantic.Field(default_factory=list)  # NOUVEAU
    voice: str | None = None
    expected_transcription_language: str | None = None
    accepted_terms_of_services: bool = False
```

`default_factory=list` garantit la compatibilité descendante : les fichiers `user_data/*.json` existants se chargent avec `contexts: []` sans migration.

Miroir frontend dans `services/frontend/src/types/user.ts` et `services/frontend/src/utils/userData.tsx` :

```typescript
export interface Context {
  id: string;
  label: string;
}

export interface UserSettings {
  name: string;
  prompt: string;
  additional_keywords: string[];
  friends: string[];
  documents: Document[];
  contexts: Context[];  // NOUVEAU
  voice: string | null;
  expected_transcription_language: string | null;
  accepted_terms_of_services: boolean;
}
```

### Seeding par défaut

`services/backend/backend/llm/system_prompt.py` (ou nouveau module `defaults.py`) :

```python
DEFAULT_CONTEXTS_FR: list[str] = [
    "Conversation décontractée à la maison",
    "Au travail",
    "Déjeuner ou dîner en famille",
    "Rendez-vous médical",
    "Café entre amis",
]
```

Stratégie de seeding : **au load**. Dans `storage.get_user_data_from_storage`, après parsing :

```python
def get_user_data_from_storage(user_email: str) -> UserData:
    ...
    user_data = UserData.model_validate_json(user_data_path.read_text())
    if not user_data.user_settings.contexts:
        user_data.user_settings.contexts = [
            Context(id=uuid.uuid4(), label=label)
            for label in DEFAULT_CONTEXTS_FR
        ]
        user_data.save()  # persiste le seed
    return user_data
```

Side-effect explicite : le premier load post-déploiement réécrit le fichier user_data. Acceptable (idempotent, une seule fois par user).

À l'inscription d'un nouvel utilisateur (dans `routes/auth.py`), la création de `UserSettings` inclut directement les défauts pour éviter le seeding lazy.

### État session Chatbot

`services/backend/backend/llm/chatbot.py` :

```python
class Chatbot:
    def __init__(self, user_data: UserData, start_time: dt.datetime):
        ...
        self.current_keywords: str | None = None
        self.current_contexts: list[str] = []  # NOUVEAU, labels actifs
        ...

    def proxy_hash(self) -> int:
        ...
        return hash((
            self.current_keywords,
            tuple(self.current_contexts),  # NOUVEAU
            len(self.current_conversation),
            last_message_len,
            self.desired_responses_length,
        ))

    def preprocessed_messages(self):
        result = self.user_data.to_llm_ready_conversation(
            self.current_keywords,
            self.desired_responses_length,
            self.current_contexts,  # NOUVEAU
        )
        ...
```

### System prompt enrichi

`services/backend/backend/storage.py:to_llm_ready_conversation` voit sa signature étendue :

```python
def to_llm_ready_conversation(
    self,
    user_text_hint: str | None,
    desired_responses_length: ora.ResponsesLenght,
    active_contexts: list[str],  # NOUVEAU
) -> list[LLMMessage]:
```

Nouvelle section insérée **après** `## User's prompt` et **avant** `## User's friends`, conditionnelle :

```python
if active_contexts:
    prompt += "## Active contexts\n"
    prompt += (
        "The user has indicated they are currently in these situations or "
        "contexts. Use them to orient your suggestions (vocabulary, tone, "
        "topic relevance):\n"
    )
    for ctx in active_contexts:
        prompt += f"- {ctx}\n"
    prompt += "\n"
```

Si `active_contexts` est vide, la section est totalement omise (comportement actuel préservé).

Le `BASE_SYSTEM_PROMPT` (system_prompt.py) doit aussi être étendu dans la liste des sections attendues (point 5 actuellement « User name ») pour documenter la nouvelle section. Renumérotation des sections de la liste textuelle.

### WebSocket event

`services/backend/backend/openai_realtime_api_events.py` :

```python
class CurrentContexts(BaseEvent[Literal["current.contexts"]]):
    contexts: list[str]
```

`services/backend/backend/unmute_handler.py` :

```python
async def set_current_contexts(self, message: ora.CurrentContexts) -> None:
    self.chatbot.current_contexts = message.contexts
    logger.info("Active contexts set to %s", message.contexts)
    await self._generate_response()
```

Dispatch ajouté dans le handler WebSocket (`routes/websockets.py` ou équivalent — à confirmer en exécution) sur `data["type"] == "current.contexts"`.

### Composant Frontend `ContextsSelector`

Nouveau fichier `services/frontend/src/components/ContextsSelector.tsx`. Style aligné sur la card friends/keywords existante (`InvincibleVoice.tsx:1305-1333`) : carte arrondie, gradient orange/vert sur les chips actifs, neutre sur les chips inactifs.

```typescript
interface ContextsSelectorProps {
  contexts: Context[];
  activeContextIds: Set<string>;
  onToggle: (contextId: string) => void;
}
```

Comportement :

- Chaque chip est un `<button>`.
- État actif : visuel saillant (gradient + glow).
- État inactif : visuel discret (bordure simple).
- Clic toggle l'id dans/hors de `activeContextIds`.
- Si liste vide : message d'invite « Aucun contexte. Ajoutez-en dans les paramètres. » (i18n).

Position dans `InvincibleVoice.tsx` (desktop) : nouvelle carte dans la colonne droite, **au-dessus** de la card friends (insérée juste avant le bloc `friends` à la ligne 1305).

Position mobile : à intégrer dans `MobileConversationLayout` au-dessus de la zone keywords/réponses (détail à valider en exécution selon contraintes d'espace).

### État dans InvincibleVoice.tsx

```typescript
const [activeContextIds, setActiveContextIds] = useState<Set<string>>(new Set());
const [lastSentContexts, setLastSentContexts] = useState<string[] | null>(null);

const sendCurrentContexts = useCallback((labels: string[]) => {
  const sorted = [...labels].sort();
  if (
    !lastSentContexts ||
    JSON.stringify(sorted) !== JSON.stringify([...lastSentContexts].sort())
  ) {
    sendMessage(
      JSON.stringify({ type: 'current.contexts', contexts: labels })
    );
    setLastSentContexts(labels);
  }
}, [sendMessage, lastSentContexts]);

const handleContextToggle = useCallback((contextId: string) => {
  setActiveContextIds((prev) => {
    const next = new Set(prev);
    if (next.has(contextId)) {
      next.delete(contextId);
    } else {
      next.add(contextId);
    }
    const labels = (userData?.user_settings?.contexts ?? [])
      .filter((c) => next.has(c.id))
      .map((c) => c.label);
    sendCurrentContexts(labels);
    return next;
  });
}, [sendCurrentContexts, userData?.user_settings?.contexts]);
```

Reset au début de conversation : dans le `useEffect` qui déclenche `clearResponses()` lorsque `readyState === ReadyState.OPEN` (`InvincibleVoice.tsx:1024-1044`), ajouter `setActiveContextIds(new Set())` et `setLastSentContexts(null)`. Et envoyer `current.contexts: []` une fois pour signaler explicitement le reset au backend.

### Settings editor

`services/frontend/src/components/settings/SettingsPopup.tsx` : nouvelle section "Contextes" placée juste après "Mots-clés supplémentaires" (`SettingsPopup.tsx:118-131`). UX calquée :

- Input texte + bouton "Ajouter".
- Liste des contextes existants avec bouton suppression à droite.
- Validation : label non vide, max 100 caractères, pas de doublon (case-insensitive).

Ajout d'une entrée :

```typescript
const handleAddContext = useCallback(() => {
  const label = newContextInput.trim();
  if (
    label &&
    label.length <= 100 &&
    !formData.contexts.some(
      (c) => c.label.toLowerCase() === label.toLowerCase()
    )
  ) {
    handleInputChange('contexts', [
      ...formData.contexts,
      { id: crypto.randomUUID(), label },
    ]);
    setNewContextInput('');
  }
}, [formData.contexts, handleInputChange, newContextInput]);
```

Suppression : filtre sur `c.id`.

Idem pour `MobileSettingsPopup.tsx` (parallèle de la version desktop).

### i18n

Ajouts dans `services/frontend/src/messages/fr.json` :

```json
"conversation.contexts": "Contextes",
"conversation.noContextsAdded": "Aucun contexte. Ajoutez-en dans les paramètres.",
"settings.contexts": "Contextes",
"settings.addContextPlaceholder": "Ajoutez un contexte (ex: au travail)",
"settings.noContextsAdded": "Aucun contexte ajouté pour le moment.",
"settings.contextTooLong": "Le contexte doit faire moins de 100 caractères",
"settings.contextDuplicate": "Ce contexte existe déjà"
```

Équivalents EN / ES / PT / DE à traduire en parallèle (traductions humaines simples, pas d'auto-trad).

## Data flow récap

1. Frontend se connecte au WebSocket conversation.
2. Le `useEffect` initial reset `activeContextIds` et envoie `current.contexts: []`.
3. L'utilisateur clique sur une chip "Au travail" → frontend met à jour `activeContextIds`, dérive `["Au travail"]`, envoie `{type: "current.contexts", contexts: ["Au travail"]}`.
4. Backend `unmute_handler.set_current_contexts` met à jour `chatbot.current_contexts` et invoque `_generate_response()`.
5. `proxy_hash` change → nouvelle génération autorisée.
6. `chatbot.preprocessed_messages` → `to_llm_ready_conversation` avec `active_contexts=["Au travail"]` → section `## Active contexts` injectée dans le system prompt.
7. LLM renvoie 4 nouvelles réponses + 10 nouveaux mots-clés orientés.
8. L'utilisateur toggle un deuxième contexte → idem, regen avec `["Au travail", "Avec mon manager Paul"]`.
9. L'utilisateur termine la conversation → reset au prochain démarrage.

## Tests

### Backend

`services/backend/tests/llm/test_contexts.py` (nouveau) :

- `test_system_prompt_includes_active_contexts_section_when_non_empty` : vérifier la présence de `## Active contexts` et des labels listés.
- `test_system_prompt_omits_section_when_empty` : vérifier absence totale de la section.
- `test_proxy_hash_changes_when_contexts_change` : `chatbot.current_contexts = ["A"]` puis `["A", "B"]` → hashes différents.
- `test_proxy_hash_stable_when_contexts_unchanged` : idempotent.
- `test_context_model_parses_and_serializes` : `Context(id=uuid4(), label="...").model_dump_json()` round-trip.
- `test_seed_default_contexts_on_load_when_empty` : `get_user_data_from_storage` seede les défauts si liste vide et persiste.
- `test_seed_skipped_if_contexts_already_populated` : pas d'écrasement si non-vide.

`services/backend/tests/llm/test_contexts_e2e.py` (nouveau, intégration) :

- Test end-to-end (mock LiteLLM) : envoyer un message WebSocket `current.contexts` et vérifier que l'appel LiteLLM reçoit bien un system prompt contenant les labels.

### Frontend

`services/frontend/src/app/__tests__/contexts-selector.test.tsx` (nouveau) :

- Render avec 3 contextes : 3 chips affichées.
- Clic sur une chip : appel de `onToggle` avec l'id correct.
- Liste vide : message d'invite affiché.

`services/frontend/src/app/__tests__/current-contexts.test.tsx` (nouveau, calqué sur `current-keywords.test.tsx`) :

- Mock WebSocket. Clic sur chip → message `current.contexts` envoyé avec le label.
- Toggle même chip → message envoyé avec liste vide.
- Multi-select : deux chips actives → message avec deux labels.
- Reset à la déconnexion : `activeContextIds` redevient vide.

## Migration et rollout

### Migration data

Aucune migration manuelle. Le champ a `default_factory=list`. Les fichiers user_data existants restent valides. Le seeding au load opère lazy à la première lecture post-déploiement.

### Rollout

1. **Branche** : nouvelle branche `feat/clickable-contexts` (depuis `staging`).
2. **Implémentation** par chantiers indépendants (à détailler dans le plan) :
   - Backend models + system prompt + WebSocket event + tests.
   - Frontend types + composant + état + tests.
   - Settings editor + i18n.
3. **Tests CI** : lint + tests backend doivent passer (lint frontend pré-existant cassé, sera traité hors-scope).
4. **Push `staging`** : déploiement auto sur `staging.voice.amiral.tech`, smoke test humain.
5. **Validation utilisateur** : un cycle d'utilisation réel par Louis sur staging.
6. **Push `main`** : déploiement prod auto, smoke test.

### Rollback

- En cas de bug critique en prod : `git revert` du commit de merge sur `main`, push, CI redeploy. Le seeding `UserData` persisté reste compatible (champ ignoré par l'ancien code grâce à pydantic).
- Pas de migration data destructive, donc pas de plan de rollback data spécifique.

## Risques et décisions ouvertes

| Risque | Mitigation |
|-|-|
| Side-effect du seeding au load (réécriture user_data au premier load) | Acceptable (idempotent). Documenté ci-dessus. Une alternative serait un script one-shot ; rejeté pour KISS. |
| Le LLM ignore la section `## Active contexts` (Sonnet 4.6) | Phrasage explicite + ton directif. Validation pratique au smoke test staging. Si problème, renforcer le wording. |
| Conflit avec la section `User's keywords` (sémantiques proches du point de vue LLM) | Séparation claire dans le prompt (sections distinctes, titres différents) + wording explicite « situations » vs « keywords pour cette réponse ». À tester. |
| Mobile : pas d'espace pour une carte supplémentaire | Position à valider en exécution. Option fallback : icône d'expand ou liste compacte en accordéon. |
| Lint workflow pré-existant cassé | Hors-scope, déjà documenté en sous-projet 2. Ne bloque pas le déploiement (workflows indépendants). |

## Checklist d'implémentation

À détailler dans le plan (`docs/superpowers/plans/2026-05-12-clickable-contexts.md`). Chantiers prévus :

- **A** Backend : types, system prompt, chatbot session state, WebSocket event, tests.
- **B** Backend : seeding au load + à l'inscription, tests.
- **C** Frontend : types, `ContextsSelector`, intégration `InvincibleVoice.tsx`, tests.
- **D** Frontend : Settings editor desktop + mobile, i18n FR/EN/ES/PT/DE.
- **E** Smoke test staging, push prod, validation utilisateur.

## Métriques de succès

- Tous les tests passent (existants + nouveaux).
- Smoke test staging : sélectionner un contexte → générer une nouvelle suggestion → vérifier qualitativement que les suggestions reflètent le contexte.
- Validation utilisateur réelle : Louis utilise les contextes pendant 2-3 conversations et confirme que la pertinence est meilleure qu'avec keywords seuls.
- Aucun rollback prod déclenché.
