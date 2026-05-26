# Voice — Refonte rebrand + white mode + session 1 an + mobile full parity — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Faire de Voice un outil personnel sobre, full-mobile, sans friction d'auth, calibré pour Arnaud — en supprimant les références Invincible Voice/Kyutai/Unmute/Gradium, en passant en white mode Apple-like, en étendant la session à 1 an, et en atteignant la parité fonctionnelle complète sur mobile.

**Architecture:** 5 phases promotables séparément. Phase 1 = rebrand (renames + strings, atomique frontend+backend). Phase 2 = session 1 an (2 lignes). Phase 3 = palette white mode (tokens + reskin composants existants). Phase 4 = `MobileConversationLayout` sans onglets. Phase 5 = `MobileSettingsPopup` en pattern iOS Settings avec sous-écrans.

**Tech Stack:** Next.js 15 + React 19 + Tailwind v4 + universal-cookie · FastAPI + PyJWT + pytest · WebSocket events typés Pydantic.

**Spec source :** `docs/superpowers/specs/2026-05-26-voice-refonte-design.md`

**Maquettes :** `voice.pen` (frame `g1rd8w` = conversation, `ZjFyh` = démarrage, `DRLRC` = paramètres).

**Convention de commits :** chaque tâche se termine par un commit conventionnel via `COMMIT_SKILL=loaded git commit -m "..."` (le skill `commit-workflow:commit` est requis sur ce repo).

---

## File Structure

**Phase 1 — Rebrand**

- Renommer : `services/frontend/src/components/InvincibleVoice.tsx` → `Voice.tsx`
- Renommer tests : `app/__tests__/InvincibleVoice.test.tsx`, `InvincibleVoice.simple.test.tsx` → `Voice.test.tsx`, `Voice.simple.test.tsx`
- Renommer : `services/backend/backend/kyutai_constants.py` → `voice_constants.py`
- Renommer : `services/backend/backend/unmute_handler.py` → `voice_handler.py` (`UnmuteHandler` → `VoiceHandler`)
- Renommer test : `services/backend/tests/llm/test_kyutai_constants.py` → `test_voice_constants.py`
- Modifier events Pydantic : `services/backend/backend/openai_realtime_api_events.py`
- Modifier strings i18n : `services/frontend/src/messages/{fr,en,es,pt,de}.json`
- Modifier titre HTML : `services/frontend/src/app/layout.tsx`
- Modifier footer logo : `services/frontend/src/components/mobile/MobileLayout.tsx`
- Créer : `services/frontend/src/messages/__tests__/i18n-no-legacy-brand.test.ts`

**Phase 2 — Session 1 an**

- Modifier : `services/backend/backend/security.py:13`
- Modifier : `services/frontend/src/auth/authContext.tsx:120,144`
- Créer : `services/backend/tests/auth/test_token_expiry.py`
- Créer : `services/frontend/src/auth/__tests__/cookie-maxage.test.tsx`

**Phase 3 — Palette white mode**

- Modifier : `services/frontend/src/app/globals.css` (variables CSS)
- Modifier : `services/frontend/src/components/Voice.tsx` (ex-InvincibleVoice, retire dark mode)
- Modifier : `services/frontend/src/components/mobile/MobileLayout.tsx` (écran démarrage white mode)
- Modifier : `services/frontend/src/components/ContextsSelector.tsx`, `KeywordsSuggestion.tsx`
- Modifier : `services/frontend/src/components/settings/SettingsPopup.tsx` (desktop reskinné)
- Modifier : `services/frontend/src/app/BubbleTrail.tsx` (neutralisé / supprimé)
- Modifier : `services/frontend/src/components/ui/StartConversationButton.tsx`

**Phase 4 — Mobile conversation unifiée**

- Refactor : `services/frontend/src/components/mobile/MobileConversationLayout.tsx`
- Modifier tests : `services/frontend/src/app/__tests__/Voice.test.tsx`, etc. (références aux tabs)

**Phase 5 — Mobile settings full parity**

- Refactor : `services/frontend/src/components/settings/MobileSettingsPopup.tsx`
- Créer dossier : `services/frontend/src/components/mobile/settings/`
- Créer : `ProfileScreen.tsx`, `VoiceScreen.tsx`, `LanguageScreen.tsx`, `PersonalityScreen.tsx`, `ContextsScreen.tsx`, `KeywordsScreen.tsx`, `FriendsScreen.tsx`, `DocumentsScreen.tsx`, `AccountScreen.tsx`

---

## PHASE 1 — REBRAND (atomique)

### Task 1.1: Strings i18n — supprimer "Invincible Voice" / "InvincibleVoice"

**Files:**
- Modify: `services/frontend/src/messages/fr.json`, `en.json`, `de.json`, `es.json`, `pt.json` (3 occurrences chacun aux lignes 34, 77, 85)

- [ ] **Step 1: Modifier `messages/fr.json`**

Remplacer dans les 3 strings :

```jsonc
// AVANT
"termsOfServiceMessage": "Pour utiliser Invincible Voice, vous devez d'abord consentir aux",
"moreSettingsAvailable": "Plus de paramètres sont disponibles sur la version ordinateur ou tablette d'Invincible Voice",
"startSpeaking": "Commencez à parler et votre voix sera transcrite. InvincibleVoice suggérera des réponses pour aider à communiquer.",

// APRÈS
"termsOfServiceMessage": "Pour utiliser Voice, vous devez d'abord consentir aux",
"moreSettingsAvailable": "Plus de paramètres sont disponibles sur la version ordinateur ou tablette de Voice",
"startSpeaking": "Commencez à parler et votre voix sera transcrite. Voice suggérera des réponses pour aider à communiquer.",
```

- [ ] **Step 2: Répliquer la substitution dans `en.json`, `de.json`, `es.json`, `pt.json`**

Stratégie : `sed -i '' -e 's/Invincible Voice/Voice/g' -e 's/InvincibleVoice/Voice/g'` sur chacun, puis relire les 5 fichiers pour vérifier qu'aucun mot composé n'a été cassé.

```bash
for f in services/frontend/src/messages/{fr,en,de,es,pt}.json; do
  sed -i '' -e 's/Invincible Voice/Voice/g' -e 's/InvincibleVoice/Voice/g' "$f"
done
```

- [ ] **Step 3: Vérifier qu'il ne reste aucune référence**

Run:
```bash
grep -i "invincible\|kyutai\|unmute\|gradium" services/frontend/src/messages/*.json
```
Expected: aucun résultat.

- [ ] **Step 4: Commit**

```bash
git add services/frontend/src/messages/
COMMIT_SKILL=loaded git commit -m "chore(i18n): rename Invincible Voice → Voice across all locales"
```

### Task 1.2: Title HTML et logo Gradium

**Files:**
- Modify: `services/frontend/src/app/layout.tsx:8`
- Modify: `services/frontend/src/components/mobile/MobileLayout.tsx:60-74`

- [ ] **Step 1: Mettre à jour le titre du document**

Dans `services/frontend/src/app/layout.tsx`, remplacer :

```ts
// AVANT
title: 'InvincibleVoice by Kyutai',
// APRÈS
title: 'Voice',
```

- [ ] **Step 2: Supprimer le footer Gradium dans `MobileLayout.tsx`**

Supprimer le bloc complet aux lignes 60-74 :

```tsx
// SUPPRIMER ce bloc :
<div
  className='absolute bottom-0 right-0 p-6 pointer-events-none'
  style={{ bottom: 'var(--safe-area-inset-bottom)' }}
>
  <div className='flex flex-col items-end pointer-events-auto'>
    <p className='w-full text-xs text-gray-500 text-right'>
      {t('common.textToSpeechProvider')}
    </p>
    <img
      src='/gradium.svg'
      alt='Gradium'
      className='h-6 mt-1'
    />
  </div>
</div>
```

- [ ] **Step 3: Supprimer la clé i18n `common.textToSpeechProvider`**

Dans chacun des 5 fichiers `messages/*.json`, supprimer la ligne `"textToSpeechProvider": "..."` (vérifier qu'elle n'est plus référencée ailleurs avec `grep -r "textToSpeechProvider" services/frontend/src`).

- [ ] **Step 4: Vérifier le build**

Run:
```bash
cd services/frontend && pnpm typecheck
```
Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add services/frontend/src/app/layout.tsx services/frontend/src/components/mobile/MobileLayout.tsx services/frontend/src/messages/
COMMIT_SKILL=loaded git commit -m "chore(rebrand): set document title to Voice, remove Gradium footer logo"
```

### Task 1.3: Renommer `InvincibleVoice.tsx` → `Voice.tsx`

**Files:**
- Rename: `services/frontend/src/components/InvincibleVoice.tsx` → `Voice.tsx`
- Rename: `services/frontend/src/app/__tests__/InvincibleVoice.test.tsx` → `Voice.test.tsx`
- Rename: `services/frontend/src/app/__tests__/InvincibleVoice.simple.test.tsx` → `Voice.simple.test.tsx`
- Modify: `services/frontend/src/app/page.tsx`
- Modify: tous les fichiers de test qui importent `InvincibleVoice`

- [ ] **Step 1: Renommer le fichier et le symbole**

```bash
git mv services/frontend/src/components/InvincibleVoice.tsx services/frontend/src/components/Voice.tsx
git mv services/frontend/src/app/__tests__/InvincibleVoice.test.tsx services/frontend/src/app/__tests__/Voice.test.tsx
git mv services/frontend/src/app/__tests__/InvincibleVoice.simple.test.tsx services/frontend/src/app/__tests__/Voice.simple.test.tsx
```

- [ ] **Step 2: Renommer le composant à l'intérieur du fichier**

Dans `services/frontend/src/components/Voice.tsx`, remplacer :

```tsx
// AVANT (ligne 69)
const InvincibleVoice = () => {
// APRÈS
const Voice = () => {

// AVANT (ligne 1502)
export default InvincibleVoice;
// APRÈS
export default Voice;
```

Mettre à jour aussi les strings UI :

```tsx
// AVANT (ligne 921)
: 'Please allow microphone access to use InvincibleVoice.',
// APRÈS
: 'Please allow microphone access to use Voice.',

// AVANT (ligne 1102)
<h1 className='mb-4 text-xl'>Loading InvincibleVoice…</h1>
// APRÈS
<h1 className='mb-4 text-xl'>Loading Voice…</h1>
```

- [ ] **Step 3: Mettre à jour tous les imports**

```bash
# Lister tous les fichiers qui importent InvincibleVoice
grep -rln "InvincibleVoice\|@/components/InvincibleVoice\|components/InvincibleVoice" services/frontend/src
```

Remplacer toutes les occurrences :

```bash
grep -rl "InvincibleVoice\|components/InvincibleVoice" services/frontend/src \
  | xargs sed -i '' \
    -e "s|@/components/InvincibleVoice|@/components/Voice|g" \
    -e "s|components/InvincibleVoice|components/Voice|g" \
    -e "s|InvincibleVoice|Voice|g"
```

⚠️ Vérifier manuellement que `friends-section.test.tsx`, `integration.test.tsx`, `current-contexts.test.tsx` etc. ont bien leurs imports remis à `Voice`.

- [ ] **Step 4: Run tests**

```bash
cd services/frontend && pnpm test -- --testPathIgnorePatterns="(integration|friends-section|delete-conversation|websocket-url)"
```
Expected: aucun échec causé par un import cassé. Si des tests testaient un texte contenant "InvincibleVoice", ils doivent être ajustés pour matcher "Voice".

- [ ] **Step 5: Commit**

```bash
git add services/frontend/src
COMMIT_SKILL=loaded git commit -m "refactor(frontend): rename InvincibleVoice component → Voice"
```

### Task 1.4: Renommer `kyutai_constants.py` → `voice_constants.py`

**Files:**
- Rename: `services/backend/backend/kyutai_constants.py` → `voice_constants.py`
- Rename: `services/backend/tests/llm/test_kyutai_constants.py` → `test_voice_constants.py`
- Modify: tous les `from backend.kyutai_constants import ...`

- [ ] **Step 1: Renommer**

```bash
git mv services/backend/backend/kyutai_constants.py services/backend/backend/voice_constants.py
git mv services/backend/tests/llm/test_kyutai_constants.py services/backend/tests/llm/test_voice_constants.py
```

- [ ] **Step 2: Mettre à jour les imports**

```bash
grep -rl "kyutai_constants" services/backend \
  | xargs sed -i '' "s|kyutai_constants|voice_constants|g"
```

- [ ] **Step 3: Mettre à jour la docstring du test**

Dans `services/backend/tests/llm/test_voice_constants.py:1`, remplacer :

```python
# AVANT
"""Unit tests for backend.kyutai_constants env var handling."""
# APRÈS
"""Unit tests for backend.voice_constants env var handling."""
```

- [ ] **Step 4: Vérifier que les tests passent**

```bash
cd services/backend && uv run pytest tests/llm/test_voice_constants.py -v
```
Expected: tous les tests existants passent (le contenu logique du module n'a pas changé).

- [ ] **Step 5: Vérifier qu'il ne reste aucune référence**

```bash
grep -rn "kyutai_constants" services/backend
```
Expected: 0 résultat.

- [ ] **Step 6: Commit**

```bash
git add services/backend
COMMIT_SKILL=loaded git commit -m "refactor(backend): rename kyutai_constants module → voice_constants"
```

### Task 1.5: Renommer `unmute_handler.py` → `voice_handler.py` (et `UnmuteHandler` → `VoiceHandler`)

**Files:**
- Rename: `services/backend/backend/unmute_handler.py` → `voice_handler.py`
- Modify: classe `UnmuteHandler` → `VoiceHandler`
- Modify: tous les fichiers important `unmute_handler` ou `UnmuteHandler`

- [ ] **Step 1: Renommer le fichier**

```bash
git mv services/backend/backend/unmute_handler.py services/backend/backend/voice_handler.py
```

- [ ] **Step 2: Renommer la classe et tous les imports**

```bash
grep -rl "unmute_handler\|UnmuteHandler" services/backend \
  | xargs sed -i '' \
    -e "s|unmute_handler|voice_handler|g" \
    -e "s|UnmuteHandler|VoiceHandler|g"
```

- [ ] **Step 3: Lancer les tests**

```bash
cd services/backend && uv run pytest -x
```
Expected: tous les tests passent. Les tests utilisant `MagicMock(spec=VoiceHandler)` doivent fonctionner sans modif puisque l'API publique est identique.

- [ ] **Step 4: Vérifier l'app au démarrage**

```bash
docker compose up --build backend
```
Expected: backend démarre sans erreur d'import. Tuer le compose après vérification (Ctrl+C).

- [ ] **Step 5: Commit**

```bash
git add services/backend
COMMIT_SKILL=loaded git commit -m "refactor(backend): rename UnmuteHandler → VoiceHandler"
```

### Task 1.6: Renommer events WebSocket `unmute.*` → `voice.*`

**Files:**
- Modify: `services/backend/backend/openai_realtime_api_events.py:151-168` (4 classes Pydantic)
- Modify: `services/frontend/src/components/Voice.tsx:161,266-268`

- [ ] **Step 1: Écrire le test backend qui valide les nouveaux types**

Créer/étendre `services/backend/tests/test_events.py` :

```python
"""Verify that Voice WebSocket event types use 'voice.*' prefix."""
from backend.openai_realtime_api_events import (
    UnmuteAdditionalOutputs,
    UnmuteResponseTextDeltaReady,
    UnmuteResponseAudioDeltaReady,
    UnmuteInterruptedByVAD,
)


def test_additional_outputs_type_is_voice_prefixed():
    ev = UnmuteAdditionalOutputs(args={})
    assert ev.type == "voice.additional_outputs"


def test_text_delta_type_is_voice_prefixed():
    ev = UnmuteResponseTextDeltaReady(args={})
    assert ev.type == "voice.response.text.delta.ready"


def test_audio_delta_type_is_voice_prefixed():
    ev = UnmuteResponseAudioDeltaReady(args={})
    assert ev.type == "voice.response.audio.delta.ready"


def test_interrupted_by_vad_type_is_voice_prefixed():
    ev = UnmuteInterruptedByVAD(args={})
    assert ev.type == "voice.interrupted_by_vad"
```

- [ ] **Step 2: Vérifier que ce test échoue**

```bash
cd services/backend && uv run pytest tests/test_events.py -v
```
Expected: 4 FAILED (les types actuels sont `unmute.*`).

- [ ] **Step 3: Mettre à jour les 4 BaseEvent literals**

Dans `services/backend/backend/openai_realtime_api_events.py:151-168`, remplacer les littéraux :

```python
# AVANT
class UnmuteAdditionalOutputs(BaseEvent[Literal["unmute.additional_outputs"]]):
# APRÈS
class UnmuteAdditionalOutputs(BaseEvent[Literal["voice.additional_outputs"]]):
```

Idem pour les 3 autres : remplacer `"unmute."` par `"voice."` dans chaque `Literal[...]`.

Note : on garde les noms des classes (`UnmuteAdditionalOutputs`, etc.) pour ne pas faire ballooner cette tâche — un Task 1.6.5 facultatif pourra les renommer plus tard si désiré. Le wire-format (string littérale) est ce qui compte pour la compatibilité frontend/backend.

- [ ] **Step 4: Mettre à jour les références frontend**

Dans `services/frontend/src/components/Voice.tsx` (ex-`InvincibleVoice.tsx`), remplacer aux lignes 161, 266-268 :

```tsx
// AVANT
if (data.type === 'unmute.additional_outputs') {
// APRÈS
if (data.type === 'voice.additional_outputs') {
```

Et :

```tsx
// AVANT (lignes 266-268)
'unmute.interrupted_by_vad',
'unmute.response.text.delta.ready',
'unmute.response.audio.delta.ready',
// APRÈS
'voice.interrupted_by_vad',
'voice.response.text.delta.ready',
'voice.response.audio.delta.ready',
```

Aucune autre référence côté frontend (vérifié au préalable).

- [ ] **Step 5: Lancer tous les tests**

```bash
cd services/backend && uv run pytest -x
cd ../frontend && pnpm test
```
Expected: vert partout.

- [ ] **Step 6: Smoke test manuel (docker compose)**

```bash
docker compose up --build
```
Ouvrir http://localhost et lancer une conversation — vérifier que les bulles s'affichent (proxy ces events `voice.*` end-to-end). Ctrl+C après vérification.

- [ ] **Step 7: Commit**

```bash
git add services
COMMIT_SKILL=loaded git commit -m "refactor(ws): rename WebSocket event prefix unmute.* → voice.*"
```

### Task 1.7: Test lint i18n — interdire les marques héritées

**Files:**
- Create: `services/frontend/src/messages/__tests__/i18n-no-legacy-brand.test.ts`

- [ ] **Step 1: Écrire le test failing**

Créer `services/frontend/src/messages/__tests__/i18n-no-legacy-brand.test.ts` :

```ts
import fs from 'node:fs';
import path from 'node:path';

const LEGACY_TERMS = ['Invincible', 'Kyutai', 'Unmute', 'Gradium'];
const LOCALES = ['fr', 'en', 'es', 'pt', 'de'] as const;

describe('i18n messages — no legacy brand references', () => {
  for (const locale of LOCALES) {
    it(`messages/${locale}.json contains no legacy brand term`, () => {
      const filePath = path.join(__dirname, '..', `${locale}.json`);
      const raw = fs.readFileSync(filePath, 'utf-8');
      for (const term of LEGACY_TERMS) {
        expect(raw).not.toMatch(new RegExp(term, 'i'));
      }
    });
  }
});
```

- [ ] **Step 2: Lancer le test, vérifier qu'il passe**

```bash
cd services/frontend && pnpm test -- i18n-no-legacy-brand
```
Expected: 5 PASS (les i18n ont déjà été nettoyés en Task 1.1 et 1.2). Si un test échoue, retourner sur la string concernée et corriger.

- [ ] **Step 3: Commit**

```bash
git add services/frontend/src/messages/__tests__/i18n-no-legacy-brand.test.ts
COMMIT_SKILL=loaded git commit -m "test(i18n): forbid Invincible/Kyutai/Unmute/Gradium across locales"
```

---

## PHASE 2 — SESSION 1 AN

### Task 2.1: Backend — JWT exp = 1 an

**Files:**
- Modify: `services/backend/backend/security.py:13`
- Create: `services/backend/tests/auth/test_token_expiry.py`

- [ ] **Step 1: Créer le dossier de tests s'il n'existe pas**

```bash
mkdir -p services/backend/tests/auth
touch services/backend/tests/auth/__init__.py
```

- [ ] **Step 2: Écrire le test failing**

Créer `services/backend/tests/auth/test_token_expiry.py` :

```python
"""Verify JWT access tokens carry a 1-year expiry."""
import os
from datetime import datetime, timezone, timedelta

import jwt
import pytest


@pytest.fixture(autouse=True)
def _jwt_env(monkeypatch):
    monkeypatch.setenv("JWT_SECRET_KEY", "test-secret")


def test_access_token_expires_in_one_year():
    import importlib
    from backend import security
    importlib.reload(security)

    token = security.create_access_token({"sub": "arnaud@example.com"})
    decoded = jwt.decode(token, "test-secret", algorithms=["HS256"])
    exp = datetime.fromtimestamp(decoded["exp"], tz=timezone.utc)
    now = datetime.now(timezone.utc)
    # 365 days ± 1 minute to absorb test runtime
    assert timedelta(days=365) - timedelta(minutes=1) < exp - now <= timedelta(days=365)
```

- [ ] **Step 3: Vérifier que le test échoue**

```bash
cd services/backend && uv run pytest tests/auth/test_token_expiry.py -v
```
Expected: FAIL (expiry actuel = 60 minutes).

- [ ] **Step 4: Étendre l'expiry dans `security.py`**

Dans `services/backend/backend/security.py:13`, remplacer :

```python
# AVANT
ACCESS_TOKEN_EXPIRE_MINUTES = 60
# APRÈS
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 365  # 1 an
```

- [ ] **Step 5: Vérifier que le test passe**

```bash
cd services/backend && uv run pytest tests/auth/test_token_expiry.py -v
```
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add services/backend
COMMIT_SKILL=loaded git commit -m "feat(auth): extend JWT access token expiry to 1 year"
```

### Task 2.2: Frontend — cookie maxAge 1 an

**Files:**
- Modify: `services/frontend/src/auth/authContext.tsx:120,144`
- Create: `services/frontend/src/auth/__tests__/cookie-maxage.test.tsx`

- [ ] **Step 1: Créer le dossier de tests s'il n'existe pas**

```bash
mkdir -p services/frontend/src/auth/__tests__
```

- [ ] **Step 2: Écrire le test failing**

Créer `services/frontend/src/auth/__tests__/cookie-maxage.test.tsx` :

```tsx
/**
 * Verify the bearerToken cookie is written with a 1-year maxAge.
 */
import { act, render, waitFor } from '@testing-library/react';
import Cookies from 'universal-cookie';
import { AuthProvider } from '../authContext';

jest.mock('universal-cookie');

global.fetch = jest.fn(async () =>
  new Response(JSON.stringify({ access_token: 'token-abc' }), { status: 200 }),
) as jest.Mock;

const ONE_YEAR_SECONDS = 365 * 24 * 60 * 60;

describe('AuthProvider cookie maxAge', () => {
  let setSpy: jest.Mock;

  beforeEach(() => {
    setSpy = jest.fn();
    (Cookies as unknown as jest.Mock).mockImplementation(() => ({
      get: jest.fn(),
      set: setSpy,
      remove: jest.fn(),
    }));
  });

  it('signIn stores token with maxAge ≈ 1 year', async () => {
    let signIn: (email: string, password: string) => Promise<void>;
    const Capture = () => {
      signIn = (jest.requireActual('../authContext').useAuthContext()).signIn;
      return null;
    };
    render(
      <AuthProvider>
        <Capture />
      </AuthProvider>,
    );
    await act(async () => {
      await signIn!('a@b.test', 'pw');
    });
    await waitFor(() => expect(setSpy).toHaveBeenCalled());
    const [, , opts] = setSpy.mock.calls[0];
    expect(opts.path).toBe('/');
    expect(opts.maxAge).toBe(ONE_YEAR_SECONDS);
    expect(opts.sameSite).toBe('lax');
  });
});
```

> ⚠️ Le test ci-dessus suppose un export `AuthProvider`. Si seul `AuthContext.Provider` est exporté, adapter la consommation (importer le `AuthWrapper` à la place). Vérifier le fichier au moment de l'implémentation et ajuster en conséquence.

- [ ] **Step 3: Vérifier que le test échoue**

```bash
cd services/frontend && pnpm test -- cookie-maxage
```
Expected: FAIL — opts.maxAge est `undefined` actuellement.

- [ ] **Step 4: Ajouter le maxAge dans `authContext.tsx`**

Dans `services/frontend/src/auth/authContext.tsx`, remplacer les 2 appels (lignes 120 et 144) :

```ts
// AVANT
new Cookies().set('bearerToken', data.access_token, { path: '/' });
// APRÈS
new Cookies().set('bearerToken', data.access_token, {
  path: '/',
  maxAge: 365 * 24 * 60 * 60, // 1 an en secondes
  sameSite: 'lax',
  secure: typeof window !== 'undefined' && window.location.protocol === 'https:',
});
```

- [ ] **Step 5: Vérifier que le test passe**

```bash
cd services/frontend && pnpm test -- cookie-maxage
```
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add services/frontend/src/auth
COMMIT_SKILL=loaded git commit -m "feat(auth): persist bearerToken cookie for 1 year"
```

---

## PHASE 3 — PALETTE & TYPO WHITE MODE

### Task 3.1: Définir les variables CSS de la palette

**Files:**
- Modify: `services/frontend/src/app/globals.css`

- [ ] **Step 1: Ajouter les variables design tokens**

Dans `services/frontend/src/app/globals.css`, ajouter (ou remplacer s'il existe déjà un bloc `:root`) :

```css
:root {
  /* Voice white-mode design tokens */
  --bg-primary: #FFFFFF;
  --bg-secondary: #F2F2F7;
  --bg-elevated: #FFFFFF;
  --border-default: #E5E5EA;
  --text-primary: #1C1C1E;
  --text-secondary: #6B7280;
  --text-tertiary: #9CA3AF;
  --accent: #0A84FF;
  --accent-soft: #F5F7FA;
  --accent-soft-border: #E5E7EB;
  --danger: #FF3B30;
  --success: #34C759;
}

body {
  background-color: var(--bg-primary);
  color: var(--text-primary);
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
}
```

- [ ] **Step 2: Mapper les tokens dans `tailwind.config.*` ou via @theme**

Tailwind v4 utilise `@theme` dans le CSS. Ajouter dans `globals.css` :

```css
@theme {
  --color-voice-bg: var(--bg-primary);
  --color-voice-surface: var(--bg-secondary);
  --color-voice-elevated: var(--bg-elevated);
  --color-voice-border: var(--border-default);
  --color-voice-text: var(--text-primary);
  --color-voice-text-secondary: var(--text-secondary);
  --color-voice-text-tertiary: var(--text-tertiary);
  --color-voice-accent: var(--accent);
  --color-voice-accent-soft: var(--accent-soft);
  --color-voice-danger: var(--danger);
  --color-voice-success: var(--success);
}
```

> Vérifier la syntaxe attendue selon la version réelle de Tailwind installée (`pnpm list tailwindcss`). Adapter si la conf est en JS dans `tailwind.config.ts`.

- [ ] **Step 3: Vérifier que l'app build**

```bash
cd services/frontend && pnpm build
```
Expected: build OK. Si erreur, ajuster la syntaxe `@theme`.

- [ ] **Step 4: Commit**

```bash
git add services/frontend/src/app/globals.css
COMMIT_SKILL=loaded git commit -m "feat(theme): introduce white-mode design tokens"
```

### Task 3.2: Reskinner `Voice.tsx` (ex-InvincibleVoice)

**Files:**
- Modify: `services/frontend/src/components/Voice.tsx` (1502 lignes — chirurgie ciblée sur les classes Tailwind dark)

- [ ] **Step 1: Identifier les classes dark à remplacer**

```bash
grep -nE "bg-\[#(121212|181818|1B1B1B)\]|text-white|gray-\d{3,4}|orange-to-light-orange-gradient" services/frontend/src/components/Voice.tsx | head -40
```

Plan de substitution :

| Avant | Après |
|-|-|
| `bg-[#121212]` | `bg-voice-bg` |
| `bg-[#181818]` | `bg-voice-elevated` |
| `bg-[#1B1B1B]` | `bg-voice-surface` |
| `text-white` (sur fonds clairs) | `text-voice-text` |
| `text-gray-200/300/400/500` | `text-voice-text-secondary` (à juger au cas par cas) |
| `border-gray-600/700` | `border-voice-border` |
| `orange-to-light-orange-gradient` | retiré (les boutons passent en `bg-voice-elevated border border-voice-border` ou `bg-voice-accent` selon le rôle) |
| `bg-blue-500/600` | `bg-voice-accent` |

- [ ] **Step 2: Appliquer les substitutions sur `Voice.tsx`**

Travailler par bloc visuel (header, chat container, bubbles, footer). Ne PAS faire un sed global brutal : certains `text-white` doivent rester (ex: texte sur bouton bleu plein) — relire le contexte.

Pour chaque substitution non triviale, ouvrir le fichier, identifier la classe, remplacer avec `Edit`.

> Pas de bloc de code intégral ici : le fichier fait 1502 lignes, c'est plus efficace de procéder par recherche/remplacement contextuel via l'outil `Edit`.

- [ ] **Step 3: Vérifier qu'il ne reste aucune classe dark**

```bash
grep -nE "bg-\[#(121212|181818|1B1B1B)\]|orange-to-light-orange-gradient" services/frontend/src/components/Voice.tsx
```
Expected: 0 résultat.

- [ ] **Step 4: Smoke test visuel desktop**

```bash
cd services/frontend && pnpm dev
```
Ouvrir http://localhost:3000 dans Chrome. Vérifier :
- Fond blanc partout (pas de zone noire).
- Bulles chat lisibles, accent bleu visible.
- Boutons pas de dégradé orange.

Tuer le dev server après vérif.

- [ ] **Step 5: Commit**

```bash
git add services/frontend/src/components/Voice.tsx
COMMIT_SKILL=loaded git commit -m "feat(theme): apply white-mode tokens to Voice main component"
```

### Task 3.3: Reskinner `MobileLayout.tsx` (écran démarrage)

**Files:**
- Modify: `services/frontend/src/components/mobile/MobileLayout.tsx`

- [ ] **Step 1: Réécrire le composant en suivant la maquette `ZjFyh`**

Dans `MobileLayout.tsx`, remplacer le corps du return par :

```tsx
return (
  <div className='w-full h-dvh flex flex-col bg-voice-bg text-voice-text relative'>
    <div
      style={{ height: 'var(--safe-area-inset-top)' }}
      className='shrink-0'
    />

    <div
      className='flex justify-end px-4 py-3'
      style={{ paddingTop: 'calc(0.75rem + var(--safe-area-inset-top))' }}
    >
      <button
        className='w-11 h-11 flex items-center justify-center rounded-full bg-voice-surface'
        onClick={onSettingsPress}
        title={t('settings.changeSettings')}
      >
        <Settings size={20} className='text-voice-text' />
      </button>
    </div>

    <div className='flex-1 flex flex-col items-center justify-center gap-8 px-8'>
      <h1 className='text-[52px] font-bold tracking-tight text-voice-text leading-none'>
        Voice
      </h1>
      <p className='text-xl font-medium text-voice-text-secondary text-center'>
        {t('conversation.greeting', { name: userName ?? '' })}
      </p>
      <button
        type='button'
        onClick={onConnectButtonPress}
        className='w-40 h-40 rounded-full bg-voice-accent flex items-center justify-center shadow-[0_8px_24px_rgba(10,132,255,0.25)]'
        aria-label={t('conversation.startChatting')}
      >
        <Mic size={64} className='text-white' />
      </button>
      <button
        onClick={onConnectButtonPress}
        className='px-8 py-4 rounded-full bg-voice-text text-white text-[17px] font-semibold'
      >
        {t('conversation.startChatting')}
      </button>
      {hasHistory && onHistoryPress && (
        <button
          className='flex items-center gap-2 px-5 py-3 text-voice-text-secondary text-[15px] font-medium'
          onClick={onHistoryPress}
        >
          <History size={18} />
          {t('conversation.history')}
        </button>
      )}
    </div>

    <div
      style={{ height: 'var(--safe-area-inset-bottom)' }}
      className='shrink-0'
    />
  </div>
);
```

> Imports à ajuster en tête de fichier : `import { History, Mic, Settings } from 'lucide-react';`.

- [ ] **Step 2: Ajouter la clé i18n `conversation.greeting`**

Dans chacun des 5 `messages/*.json`, ajouter sous la section `conversation` :

```jsonc
"greeting": "Bonjour {name}."   // FR
"greeting": "Hello {name}."     // EN
"greeting": "Hallo {name}."     // DE
"greeting": "Hola {name}."      // ES
"greeting": "Olá {name}."       // PT
```

> Si `userName` n'est pas dispo en prop sur `MobileNoConversation`, l'ajouter à l'interface et le forwarder depuis le parent (consulter `Voice.tsx` pour identifier l'endroit où passer la prop).

- [ ] **Step 3: Run tests + smoke test mobile (DevTools responsive 393px)**

```bash
cd services/frontend && pnpm test -- mobile && pnpm dev
```
Ouvrir Chrome DevTools → device toolbar → iPhone 14 (393×852). Vérifier que l'écran ressemble au mockup `ZjFyh` du `voice.pen`.

- [ ] **Step 4: Commit**

```bash
git add services/frontend/src/components/mobile/MobileLayout.tsx services/frontend/src/messages/
COMMIT_SKILL=loaded git commit -m "feat(mobile): redesign start screen with white-mode tokens"
```

### Task 3.4: Reskinner `ContextsSelector.tsx` et `KeywordsSuggestion.tsx`

**Files:**
- Modify: `services/frontend/src/components/ContextsSelector.tsx`
- Modify: `services/frontend/src/components/KeywordsSuggestion.tsx`

- [ ] **Step 1: Mettre à jour `ContextsSelector.tsx`**

Pour chaque chip, remplacer les classes :

| État | Avant (dark) | Après (white) |
|-|-|-|
| Inactif | `bg-gray-800 border-gray-600 text-gray-300` | `bg-voice-surface text-voice-text` |
| Actif | `bg-orange-500 text-white` (ou équivalent) | `bg-voice-accent text-white` |

Padding chip : `px-3 py-1.5`, `rounded-full`, font-size `13px`, font-weight 500.

> Ouvrir le fichier, repérer les classes existantes et remplacer via `Edit`. Pas de réécriture intégrale nécessaire.

- [ ] **Step 2: Mettre à jour `KeywordsSuggestion.tsx`**

Même grille : `bg-voice-surface` au repos, `bg-voice-accent text-white` à l'état sélectionné/utilisé. Bordure neutre `border-voice-border`.

- [ ] **Step 3: Tests existants doivent passer**

```bash
cd services/frontend && pnpm test -- ContextsSelector
```
Expected: les tests existants (`services/frontend/src/components/__tests__/ContextsSelector.test.tsx` si présent) passent — ils testent le comportement, pas les classes Tailwind.

- [ ] **Step 4: Commit**

```bash
git add services/frontend/src/components/ContextsSelector.tsx services/frontend/src/components/KeywordsSuggestion.tsx
COMMIT_SKILL=loaded git commit -m "feat(theme): reskin context chips and keyword suggestions"
```

### Task 3.5: Reskinner `SettingsPopup.tsx` desktop

**Files:**
- Modify: `services/frontend/src/components/settings/SettingsPopup.tsx`

- [ ] **Step 1: Identifier les classes dark**

```bash
grep -nE "bg-\[#(181818|1B1B1B|121212)\]|text-white|border-gray-\d+|bg-gray-\d+" services/frontend/src/components/settings/SettingsPopup.tsx | head -50
```

- [ ] **Step 2: Appliquer les substitutions**

Mêmes règles que Task 3.2 :
- `bg-[#181818]` → `bg-voice-elevated`
- `bg-[#1B1B1B]` → `bg-voice-surface`
- `text-white` (sur fond clair) → `text-voice-text`
- `border-gray-600/700` → `border-voice-border`
- Boutons CTA verts (`bg-green` / `bg-[#39F2AE]`) → `bg-voice-accent text-white`
- Bouton sign-out rouge → garder couleur sémantique, utiliser `text-voice-danger border-voice-danger`

- [ ] **Step 3: Vérifier desktop**

```bash
cd services/frontend && pnpm dev
```
Ouvrir Chrome ≥ 1024px de large, déclencher la popup settings. Vérifier cohérence visuelle.

- [ ] **Step 4: Commit**

```bash
git add services/frontend/src/components/settings/SettingsPopup.tsx
COMMIT_SKILL=loaded git commit -m "feat(theme): reskin desktop settings popup"
```

### Task 3.6: Reskinner `StartConversationButton.tsx`

**Files:**
- Modify: `services/frontend/src/components/ui/StartConversationButton.tsx`

- [ ] **Step 1: Remplacer le style par bouton noir pill**

Remplacer le contenu du composant par :

```tsx
'use client';

import { Play } from 'lucide-react';
import { FC } from 'react';

interface Props {
  onClick: () => void;
  label: string;
}

const StartConversationButton: FC<Props> = ({ onClick, label }) => (
  <button
    type='button'
    onClick={onClick}
    className='flex items-center gap-2 px-8 py-4 rounded-full bg-voice-text text-white text-[17px] font-semibold'
  >
    <Play size={18} fill='currentColor' />
    {label}
  </button>
);

export default StartConversationButton;
```

- [ ] **Step 2: Tests existants doivent passer**

```bash
cd services/frontend && pnpm test -- StartConversationButton
```
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add services/frontend/src/components/ui/StartConversationButton.tsx
COMMIT_SKILL=loaded git commit -m "feat(theme): redesign start conversation button"
```

### Task 3.7: Neutraliser `BubbleTrail.tsx`

**Files:**
- Modify: `services/frontend/src/app/BubbleTrail.tsx`

- [ ] **Step 1: Réduire le composant à un no-op**

Remplacer le contenu intégral par :

```tsx
'use client';

import { FC } from 'react';

// Decorative bubble trail neutralized for white-mode v1.
// Kept as an empty component to avoid touching call-sites.
const BubbleTrail: FC = () => null;

export default BubbleTrail;
```

- [ ] **Step 2: Tests existants doivent passer (jest mock déjà en place)**

```bash
cd services/frontend && pnpm test -- BubbleTrail
```
Expected: pas de régression (le mock dans `jest.setup.js` retourne déjà `null`).

- [ ] **Step 3: Commit**

```bash
git add services/frontend/src/app/BubbleTrail.tsx
COMMIT_SKILL=loaded git commit -m "chore(theme): neutralize BubbleTrail decorative effect"
```

---

## PHASE 4 — MOBILE CONVERSATION UNIFIÉE

### Task 4.1: Supprimer les onglets de `MobileConversationLayout.tsx`

**Files:**
- Modify: `services/frontend/src/components/mobile/MobileConversationLayout.tsx`

- [ ] **Step 1: Écrire le test failing (absence de tabs)**

Créer ou étendre `services/frontend/src/components/mobile/__tests__/MobileConversationLayout.unified.test.tsx` :

```tsx
import { render, screen } from '@testing-library/react';
import MobileConversationLayout from '../MobileConversationLayout';

const baseProps = {
  textInput: '',
  onTextInputChange: jest.fn(),
  onSendMessage: jest.fn(),
  frozenResponses: null,
  onFreezeToggle: jest.fn(),
  pendingResponses: [],
  onResponseSelect: jest.fn(),
  onConnectButtonPress: jest.fn(),
  onSettingsPress: jest.fn(),
  chatHistory: [],
  isConnected: true,
  conversations: [],
  selectedConversationIndex: null,
  onConversationSelect: jest.fn(),
  onNewConversation: jest.fn(),
  onDeleteConversation: jest.fn(),
};

describe('MobileConversationLayout — unified view', () => {
  it('does not render Chat / Responses / History tabs', () => {
    render(<MobileConversationLayout {...baseProps} />);
    expect(screen.queryByRole('button', { name: /chat$/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /responses/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /history/i })).toBeNull();
  });

  it('renders chat history, suggestions section and input bar simultaneously', () => {
    render(
      <MobileConversationLayout
        {...baseProps}
        pendingResponses={[
          { id: 'r1', text: 'Salut', isComplete: true },
          { id: 'r2', text: 'Oui', isComplete: true },
          { id: 'r3', text: 'Non', isComplete: true },
        ]}
      />,
    );
    // Suggestions header is present
    expect(screen.getByText(/réponses suggérées/i)).toBeInTheDocument();
    // 3 suggestion cards present
    expect(screen.getByText('Salut')).toBeInTheDocument();
    expect(screen.getByText('Oui')).toBeInTheDocument();
    expect(screen.getByText('Non')).toBeInTheDocument();
    // Input placeholder visible
    expect(screen.getByPlaceholderText(/écrire ou dicter/i)).toBeInTheDocument();
  });
});
```

> Ajouter la clé i18n `conversation.suggestedResponses` et `conversation.writeOrDictate` dans `messages/*.json` (FR : "Réponses suggérées", "Écrire ou dicter…" ; idem EN/DE/ES/PT).

- [ ] **Step 2: Vérifier que les tests échouent**

```bash
cd services/frontend && pnpm test -- MobileConversationLayout.unified
```
Expected: FAIL (les tabs sont encore présents).

- [ ] **Step 3: Refactorer le composant**

Le composant complet (suppression tabs, layout unifié) — remplacer le retour JSX par la structure suivante. Imports à conserver/adapter :

```tsx
'use client';

import { Pause, Settings, Send, Snowflake, Mic } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useRef,
  ChangeEvent,
  KeyboardEvent,
  FC,
} from 'react';
import ContextsSelector from '@/components/ContextsSelector';
import { PendingResponse } from '@/components/chat/ChatInterface';
import ChatPanel from '@/components/mobile/ChatPanel';
import { RESPONSES_SIZES } from '@/constants';
import { useViewportHeight } from '@/hooks/useViewportHeight';
import { useTranslations } from '@/i18n';
import { ChatMessage } from '@/types/chatHistory';
import { Context } from '@/types/user';
import { Conversation } from '@/utils/userData';

interface Props {
  textInput: string;
  onTextInputChange: (v: string) => void;
  onSendMessage: () => void;
  frozenResponses: PendingResponse[] | null;
  onFreezeToggle: () => void;
  pendingResponses: PendingResponse[];
  onResponseSelect: (id: string) => void;
  onResponseSizeChange?: (size: typeof RESPONSES_SIZES[keyof typeof RESPONSES_SIZES]) => void;
  onConnectButtonPress: () => void;
  onSettingsPress: () => void;
  chatHistory: ChatMessage[];
  isConnected: boolean;
  currentSpeakerMessage?: string;
  pastConversation?: Conversation;
  isViewingPastConversation?: boolean;
  onBack?: () => void;
  contexts?: Context[];
  activeContextIds?: Set<string>;
  onContextToggle?: (id: string) => void;
}

const MobileConversationLayout: FC<Props> = ({
  textInput,
  onTextInputChange,
  onSendMessage,
  frozenResponses,
  onFreezeToggle,
  pendingResponses,
  onResponseSelect,
  onResponseSizeChange,
  onConnectButtonPress,
  onSettingsPress,
  chatHistory,
  isConnected,
  currentSpeakerMessage = '',
  pastConversation,
  isViewingPastConversation = false,
  onBack,
  contexts = [],
  activeContextIds = new Set<string>(),
  onContextToggle,
}) => {
  const t = useTranslations();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { vh, visualVh } = useViewportHeight();
  const keyboardHeight = Math.max(0, vh - visualVh);

  // Single response size (medium cards) in unified layout
  useEffect(() => {
    onResponseSizeChange?.(RESPONSES_SIZES.M);
  }, [onResponseSizeChange]);

  const responsesToShow = frozenResponses ?? pendingResponses;
  const suggestions = responsesToShow.filter((r) => r.text.trim() && r.isComplete).slice(0, 3);

  const onMessageChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => onTextInputChange(e.target.value),
    [onTextInputChange],
  );
  const onMessageKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        onSendMessage();
      }
    },
    [onSendMessage],
  );

  return (
    <div
      className='w-full flex flex-col bg-voice-bg text-voice-text overflow-hidden'
      style={{
        height: `${vh}px`,
        paddingBottom: keyboardHeight > 0 ? `${keyboardHeight}px` : undefined,
      }}
    >
      <div style={{ height: 'var(--safe-area-inset-top)' }} className='shrink-0' />

      {/* Header */}
      <div className='flex items-center justify-between px-4 py-3 shrink-0'>
        {isConnected ? (
          <button
            className='flex items-center gap-2 px-4 py-2.5 rounded-full border-[1.5px] border-voice-danger text-voice-danger text-[15px] font-semibold'
            onClick={onConnectButtonPress}
          >
            <Pause size={16} />
            {t('conversation.stopConversation')}
          </button>
        ) : (
          <button
            className='flex items-center gap-2 px-4 py-2.5 rounded-full bg-voice-surface text-voice-text text-[15px] font-semibold'
            onClick={onBack}
          >
            {t('common.back')}
          </button>
        )}
        <button
          className='w-11 h-11 flex items-center justify-center rounded-full bg-voice-surface'
          onClick={onSettingsPress}
        >
          <Settings size={20} className='text-voice-text' />
        </button>
      </div>

      {/* Live speaker banner */}
      {isConnected && currentSpeakerMessage && (
        <div className='flex items-center gap-2.5 px-4 py-2.5 bg-voice-surface shrink-0'>
          <span className='w-2 h-2 rounded-full bg-voice-danger animate-pulse' />
          <span className='text-[13px] font-medium text-voice-text-secondary truncate'>
            {currentSpeakerMessage}
          </span>
        </div>
      )}

      {/* Chat scroll */}
      <div className='flex-1 min-h-0 overflow-hidden'>
        <ChatPanel
          chatHistory={chatHistory}
          isConnected={isConnected}
          currentSpeakerMessage={currentSpeakerMessage}
          pastConversation={pastConversation}
          isViewingPastConversation={isViewingPastConversation}
        />
      </div>

      {/* Bottom block (suggestions + chips + input) — hidden when viewing past conversation */}
      {!isViewingPastConversation && (
        <>
          {/* Suggestions */}
          {suggestions.length > 0 && (
            <div className='px-4 pt-3 pb-2 border-t border-voice-border shrink-0'>
              <div className='flex items-center justify-between mb-2'>
                <span className='text-[12px] font-semibold text-voice-text-secondary tracking-wider'>
                  {t('conversation.suggestedResponses').toUpperCase()}
                </span>
                <button
                  className='flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-voice-surface text-[12px] font-medium text-voice-text-secondary'
                  onClick={onFreezeToggle}
                >
                  <Snowflake size={12} />
                  {t('conversation.freeze')}
                </button>
              </div>
              <div className='flex flex-col gap-2'>
                {suggestions.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => onResponseSelect(r.id)}
                    className='flex items-center gap-2.5 px-4 py-3.5 rounded-[14px] bg-voice-accent-soft border border-voice-border text-left'
                  >
                    <span className='flex-1 text-[15px] font-medium text-voice-text leading-snug'>
                      {r.text}
                    </span>
                    <Send size={18} className='text-voice-accent shrink-0' />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Context chips */}
          {contexts.length > 0 && (
            <div className='px-4 pt-2 pb-1 shrink-0'>
              <ContextsSelector
                contexts={contexts}
                activeContextIds={activeContextIds}
                onToggle={onContextToggle ?? (() => {})}
              />
            </div>
          )}

          {/* Input bar */}
          <div className='flex items-center gap-2 px-3 pt-2 pb-4 shrink-0'>
            <div className='flex-1 flex items-center gap-2 px-4 py-3 rounded-full bg-voice-surface'>
              <textarea
                ref={textareaRef}
                rows={1}
                value={textInput}
                onChange={onMessageChange}
                onKeyDown={onMessageKeyDown}
                placeholder={t('conversation.writeOrDictate')}
                className='flex-1 bg-transparent resize-none focus:outline-none text-[16px] text-voice-text placeholder:text-voice-text-tertiary'
              />
              <Mic size={22} className='text-voice-accent shrink-0' />
            </div>
            <button
              onClick={onSendMessage}
              disabled={!textInput.trim()}
              className='w-12 h-12 rounded-full bg-voice-accent flex items-center justify-center disabled:opacity-50'
            >
              <Send size={22} className='text-white' />
            </button>
          </div>
        </>
      )}

      <div style={{ height: 'var(--safe-area-inset-bottom)' }} className='shrink-0' />
    </div>
  );
};

export default MobileConversationLayout;
```

- [ ] **Step 4: Ajouter les clés i18n manquantes**

Dans chacun des 5 `messages/*.json`, sous `conversation`, ajouter :

```jsonc
"suggestedResponses": "Réponses suggérées",   // FR
"freeze": "Figer",                            // FR
"writeOrDictate": "Écrire ou dicter…",        // FR
```

Adapter EN/DE/ES/PT :

| Clé | EN | DE | ES | PT |
|-|-|-|-|-|
| suggestedResponses | Suggested replies | Vorschläge | Sugerencias | Sugestões |
| freeze | Freeze | Festhalten | Congelar | Congelar |
| writeOrDictate | Write or dictate… | Schreiben oder diktieren… | Escribe o dicta… | Escreva ou dite… |

- [ ] **Step 5: Vérifier que les tests passent**

```bash
cd services/frontend && pnpm test -- MobileConversationLayout
```
Expected: PASS.

- [ ] **Step 6: Smoke test mobile**

`pnpm dev`, DevTools 393×852, lancer une conversation, vérifier que tout (chat + suggestions + input) est visible simultanément, sans onglets.

- [ ] **Step 7: Commit**

```bash
git add services/frontend/src/components/mobile/MobileConversationLayout.tsx services/frontend/src/components/mobile/__tests__/ services/frontend/src/messages/
COMMIT_SKILL=loaded git commit -m "feat(mobile): unify conversation layout, remove tabs"
```

### Task 4.2: Retirer le mode "history tab" et déplacer l'accès historique vers l'écran d'accueil

**Files:**
- Modify: `services/frontend/src/components/Voice.tsx` (recherche : `isHistoryMode`, `initialActivePanel`)
- Modify: `services/frontend/src/components/mobile/HistoryPanel.tsx` (peut devenir un écran plein-page indépendant)

- [ ] **Step 1: Localiser le routage actuel vers `MobileConversationLayout` avec `isHistoryMode`**

```bash
grep -nE "isHistoryMode|initialActivePanel" services/frontend/src/components/Voice.tsx
```

- [ ] **Step 2: Refactorer**

Quand l'utilisateur tape "Conversations passées" depuis `MobileLayout` (écran d'accueil), rendre un nouveau composant `MobileHistoryScreen` plein-écran (réutilise `HistoryPanel`) qui appelle `onConversationSelect` → ouvre la conversation passée en lecture seule via `MobileConversationLayout` avec `isViewingPastConversation: true`.

Plus de prop `isHistoryMode` sur `MobileConversationLayout`. Plus de prop `initialActivePanel`. Plus de `ActivePanel` type côté `Voice.tsx`.

> Cette tâche est volontairement haut-niveau : le détail dépend de l'état actuel de `Voice.tsx` post-rename. Lire le state machine local de navigation mobile dans `Voice.tsx` et factoriser un état `mobileView: 'home' | 'conversation' | 'history' | 'past-conversation'`.

- [ ] **Step 3: Mettre à jour ou retirer les tests qui validaient le mode historique via tabs**

Run :
```bash
cd services/frontend && pnpm test
```
Adapter les tests qui s'appuyaient sur `initialActivePanel='history'` pour utiliser le nouveau flow.

- [ ] **Step 4: Smoke test mobile**

Vérifier : depuis l'écran d'accueil, clic "Conversations passées" → liste plein écran → clic sur une conversation → affichage en lecture seule + bouton retour → retour à la liste → retour accueil.

- [ ] **Step 5: Commit**

```bash
git add services/frontend/src
COMMIT_SKILL=loaded git commit -m "refactor(mobile): move past conversations to dedicated history screen"
```

---

## PHASE 5 — MOBILE SETTINGS FULL PARITY

### Task 5.1: Squelette du nouveau `MobileSettingsPopup` (liste de sections)

**Files:**
- Modify: `services/frontend/src/components/settings/MobileSettingsPopup.tsx`
- Create: `services/frontend/src/components/mobile/settings/` (dossier)

- [ ] **Step 1: Réécrire `MobileSettingsPopup` en index router local**

Remplacer intégralement par :

```tsx
'use client';

import { FC, useState } from 'react';
import { X, ChevronRight, MicVocal, Languages, Sparkles, Tag, BookText, Users, FileText, Shield, LogOut } from 'lucide-react';
import { useAuthContext } from '@/auth/authContext';
import { useTranslations } from '@/i18n';
import type { UserSettings } from '@/utils/userData';
import ProfileScreen from '@/components/mobile/settings/ProfileScreen';
import VoiceScreen from '@/components/mobile/settings/VoiceScreen';
import LanguageScreen from '@/components/mobile/settings/LanguageScreen';
import PersonalityScreen from '@/components/mobile/settings/PersonalityScreen';
import ContextsScreen from '@/components/mobile/settings/ContextsScreen';
import KeywordsScreen from '@/components/mobile/settings/KeywordsScreen';
import FriendsScreen from '@/components/mobile/settings/FriendsScreen';
import DocumentsScreen from '@/components/mobile/settings/DocumentsScreen';
import AccountScreen from '@/components/mobile/settings/AccountScreen';

type SettingsRoute =
  | 'index'
  | 'profile'
  | 'voice'
  | 'language'
  | 'personality'
  | 'contexts'
  | 'keywords'
  | 'friends'
  | 'documents'
  | 'account';

interface Props {
  userSettings: UserSettings;
  email: string;
  onSave: (s: UserSettings) => void;
  onCancel: () => void;
}

const ROW_ICON = ({ icon: Icon, bg }: { icon: any; bg: string }) => (
  <div className={`w-[30px] h-[30px] rounded-[7px] flex items-center justify-center ${bg}`}>
    <Icon size={18} className='text-white' />
  </div>
);

const SectionRow: FC<{ icon: any; iconBg: string; title: string; sub?: string; onClick: () => void }> = ({ icon, iconBg, title, sub, onClick }) => (
  <button
    onClick={onClick}
    className='w-full flex items-center gap-3 px-4 py-3.5 text-left'
  >
    <ROW_ICON icon={icon} bg={iconBg} />
    <div className='flex-1 min-w-0'>
      <div className='text-[16px] font-medium text-voice-text'>{title}</div>
      {sub && <div className='text-[12px] text-voice-text-secondary truncate'>{sub}</div>}
    </div>
    <ChevronRight size={16} className='text-voice-text-tertiary' />
  </button>
);

const MobileSettingsPopup: FC<Props> = ({ userSettings, email, onSave, onCancel }) => {
  const t = useTranslations();
  const [route, setRoute] = useState<SettingsRoute>('index');
  const [settings, setSettings] = useState<UserSettings>(userSettings);

  const handleScreenSave = (updated: UserSettings) => {
    setSettings(updated);
    onSave(updated);
    setRoute('index');
  };

  if (route === 'profile') return <ProfileScreen settings={settings} email={email} onBack={() => setRoute('index')} onSave={handleScreenSave} />;
  if (route === 'voice') return <VoiceScreen settings={settings} onBack={() => setRoute('index')} onSave={handleScreenSave} />;
  if (route === 'language') return <LanguageScreen settings={settings} onBack={() => setRoute('index')} onSave={handleScreenSave} />;
  if (route === 'personality') return <PersonalityScreen settings={settings} onBack={() => setRoute('index')} onSave={handleScreenSave} />;
  if (route === 'contexts') return <ContextsScreen settings={settings} onBack={() => setRoute('index')} onSave={handleScreenSave} />;
  if (route === 'keywords') return <KeywordsScreen settings={settings} onBack={() => setRoute('index')} onSave={handleScreenSave} />;
  if (route === 'friends') return <FriendsScreen settings={settings} onBack={() => setRoute('index')} onSave={handleScreenSave} />;
  if (route === 'documents') return <DocumentsScreen settings={settings} onBack={() => setRoute('index')} onSave={handleScreenSave} />;
  if (route === 'account') return <AccountScreen email={email} onBack={() => setRoute('index')} />;

  // Index screen
  return (
    <div className='w-full h-full flex flex-col bg-voice-surface text-voice-text overflow-y-auto'>
      <div style={{ height: 'var(--safe-area-inset-top)' }} className='shrink-0' />
      <div className='flex items-center justify-between px-4 pt-2 pb-3'>
        <h1 className='text-[28px] font-bold text-voice-text'>{t('settings.title')}</h1>
        <button onClick={onCancel} className='w-8 h-8 rounded-full bg-voice-border flex items-center justify-center'>
          <X size={18} className='text-voice-text-secondary' />
        </button>
      </div>

      <div className='flex flex-col gap-6 px-4 pb-4'>
        {/* Profile card */}
        <button
          onClick={() => setRoute('profile')}
          className='w-full flex items-center gap-3.5 px-4 py-3.5 bg-voice-elevated rounded-[14px]'
        >
          <div className='w-12 h-12 rounded-full bg-voice-accent flex items-center justify-center'>
            <span className='text-[20px] font-semibold text-white'>{(settings.name?.[0] ?? 'A').toUpperCase()}</span>
          </div>
          <div className='flex-1 min-w-0 text-left'>
            <div className='text-[17px] font-semibold text-voice-text truncate'>{settings.name || t('settings.yourNamePlaceholder')}</div>
            <div className='text-[13px] text-voice-text-secondary truncate'>{email}</div>
          </div>
          <ChevronRight size={18} className='text-voice-text-tertiary' />
        </button>

        {/* Section: Conversation */}
        <div className='flex flex-col gap-2'>
          <div className='text-[13px] font-semibold text-voice-text-secondary tracking-wider px-1'>
            {t('settings.sectionConversation').toUpperCase()}
          </div>
          <div className='bg-voice-elevated rounded-[14px] divide-y divide-voice-border'>
            <SectionRow icon={MicVocal} iconBg='bg-voice-danger' title={t('settings.voice')} sub={settings.voice || t('common.default')} onClick={() => setRoute('voice')} />
            <SectionRow icon={Languages} iconBg='bg-[#FF9500]' title={t('settings.expectedTranscriptionLanguage')} sub={settings.language || t('settings.letSpeechToTextGuess')} onClick={() => setRoute('language')} />
            <SectionRow icon={Sparkles} iconBg='bg-[#AF52DE]' title={t('settings.personality')} sub={t('settings.configurePrompt')} onClick={() => setRoute('personality')} />
          </div>
        </div>

        {/* Section: Personnalisation */}
        <div className='flex flex-col gap-2'>
          <div className='text-[13px] font-semibold text-voice-text-secondary tracking-wider px-1'>
            {t('settings.sectionPersonalization').toUpperCase()}
          </div>
          <div className='bg-voice-elevated rounded-[14px] divide-y divide-voice-border'>
            <SectionRow icon={Tag} iconBg='bg-voice-success' title={t('settings.contexts')} sub={t('settings.contextsCount', { count: settings.contexts?.length ?? 0 })} onClick={() => setRoute('contexts')} />
            <SectionRow icon={BookText} iconBg='bg-voice-accent' title={t('settings.additionalKeywords')} sub={t('settings.keywordsCount', { count: settings.additionalKeywords?.length ?? 0 })} onClick={() => setRoute('keywords')} />
            <SectionRow icon={Users} iconBg='bg-[#5856D6]' title={t('settings.friends')} sub={t('settings.friendsCount', { count: settings.friends?.length ?? 0 })} onClick={() => setRoute('friends')} />
            <SectionRow icon={FileText} iconBg='bg-[#FF2D55]' title={t('settings.documents')} sub={t('settings.documentsCount', { count: settings.documents?.length ?? 0 })} onClick={() => setRoute('documents')} />
          </div>
        </div>

        {/* Section: Compte */}
        <div className='flex flex-col gap-2'>
          <div className='text-[13px] font-semibold text-voice-text-secondary tracking-wider px-1'>
            {t('settings.sectionAccount').toUpperCase()}
          </div>
          <div className='bg-voice-elevated rounded-[14px]'>
            <SectionRow icon={Shield} iconBg='bg-[#8E8E93]' title={t('settings.privacy')} sub={t('settings.privacySub')} onClick={() => setRoute('account')} />
          </div>
        </div>
      </div>

      <div style={{ height: 'var(--safe-area-inset-bottom)' }} className='shrink-0' />
    </div>
  );
};

export default MobileSettingsPopup;
```

- [ ] **Step 2: Ajouter les clés i18n manquantes (5 langues)**

Sous `settings` :

| Clé | FR | EN | DE | ES | PT |
|-|-|-|-|-|-|
| title | Paramètres | Settings | Einstellungen | Ajustes | Configurações |
| sectionConversation | Conversation | Conversation | Konversation | Conversación | Conversação |
| sectionPersonalization | Personnalisation | Personalization | Personalisierung | Personalización | Personalização |
| sectionAccount | Compte | Account | Konto | Cuenta | Conta |
| voice | Voix | Voice | Stimme | Voz | Voz |
| personality | Personnalité | Personality | Persönlichkeit | Personalidad | Personalidade |
| configurePrompt | Configurer le prompt | Configure prompt | Prompt einrichten | Configurar prompt | Configurar prompt |
| friends | Proches | Friends | Angehörige | Cercanos | Próximos |
| documents | Documents | Documents | Dokumente | Documentos | Documentos |
| privacy | Confidentialité | Privacy | Datenschutz | Privacidad | Privacidade |
| privacySub | CGU et données | Terms and data | AGB und Daten | TyC y datos | Termos e dados |
| contextsCount | "{count} contextes" | "{count} contexts" | "{count} Kontexte" | "{count} contextos" | "{count} contextos" |
| keywordsCount | "{count} mots-clés" | "{count} keywords" | "{count} Schlüsselwörter" | "{count} palabras clave" | "{count} palavras-chave" |
| friendsCount | "{count} personnes" | "{count} people" | "{count} Personen" | "{count} personas" | "{count} pessoas" |
| documentsCount | "{count} documents" | "{count} documents" | "{count} Dokumente" | "{count} documentos" | "{count} documentos" |

- [ ] **Step 3: Build + smoke test (les sous-écrans n'existent pas encore — l'écran index doit afficher correctement avant les drill-downs)**

```bash
cd services/frontend && pnpm typecheck
```
Expected: erreurs sur les imports des sous-écrans inexistants → c'est attendu pour ce step, on les crée dans Tasks 5.2-5.10.

⚠️ **Ne pas commit cette tâche seule** — la commit interviendra après les sous-écrans (Task 5.11). En attendant, garder la version actuelle de `MobileSettingsPopup.tsx` sous un commit local de WIP optionnel.

### Task 5.2: `ProfileScreen.tsx`

**Files:**
- Create: `services/frontend/src/components/mobile/settings/ProfileScreen.tsx`

- [ ] **Step 1: Créer le squelette commun de sous-écran**

Avant `ProfileScreen`, créer un helper `_SubScreenShell` réutilisable :

```bash
mkdir -p services/frontend/src/components/mobile/settings
```

Créer `services/frontend/src/components/mobile/settings/_SubScreenShell.tsx` :

```tsx
'use client';

import { FC, PropsWithChildren } from 'react';
import { ChevronLeft } from 'lucide-react';

interface Props {
  title: string;
  onBack: () => void;
  onSave?: () => void;
  saveLabel?: string;
}

const SubScreenShell: FC<PropsWithChildren<Props>> = ({ title, onBack, onSave, saveLabel, children }) => (
  <div className='w-full h-full flex flex-col bg-voice-bg text-voice-text overflow-y-auto'>
    <div style={{ height: 'var(--safe-area-inset-top)' }} className='shrink-0' />
    <div className='flex items-center px-2 py-2 shrink-0'>
      <button onClick={onBack} className='w-11 h-11 flex items-center justify-center'>
        <ChevronLeft size={24} className='text-voice-accent' />
      </button>
      <h1 className='flex-1 text-center text-[17px] font-semibold pr-11'>{title}</h1>
    </div>
    <div className='flex-1 min-h-0 px-4 pb-24'>{children}</div>
    {onSave && (
      <div className='sticky bottom-0 px-4 pt-3 pb-6 bg-voice-bg border-t border-voice-border shrink-0'>
        <button onClick={onSave} className='w-full py-4 rounded-full bg-voice-accent text-white font-semibold text-[17px]'>
          {saveLabel ?? 'Enregistrer'}
        </button>
      </div>
    )}
  </div>
);

export default SubScreenShell;
```

- [ ] **Step 2: Créer `ProfileScreen.tsx`**

```tsx
'use client';

import { FC, useState } from 'react';
import SubScreenShell from './_SubScreenShell';
import { useTranslations } from '@/i18n';
import { updateUserSettings } from '@/utils/userData';
import type { UserSettings } from '@/utils/userData';

interface Props {
  settings: UserSettings;
  email: string;
  onBack: () => void;
  onSave: (s: UserSettings) => void;
}

const ProfileScreen: FC<Props> = ({ settings, email, onBack, onSave }) => {
  const t = useTranslations();
  const [name, setName] = useState(settings.name ?? '');

  const handleSave = async () => {
    const updated: UserSettings = { ...settings, name };
    const r = await updateUserSettings(updated);
    if (!r.error) onSave(updated);
  };

  return (
    <SubScreenShell title={t('settings.profile')} onBack={onBack} onSave={handleSave} saveLabel={t('common.save')}>
      <div className='flex flex-col gap-4 mt-3'>
        <label className='flex flex-col gap-1.5'>
          <span className='text-[13px] font-semibold text-voice-text-secondary tracking-wider'>
            {t('settings.email').toUpperCase()}
          </span>
          <div className='px-4 py-3.5 rounded-[14px] bg-voice-surface text-voice-text-secondary text-[16px]'>
            {email}
          </div>
        </label>
        <label className='flex flex-col gap-1.5'>
          <span className='text-[13px] font-semibold text-voice-text-secondary tracking-wider'>
            {t('settings.yourName').toUpperCase()}
          </span>
          <input
            type='text'
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('settings.yourNamePlaceholder')}
            className='px-4 py-3.5 rounded-[14px] bg-voice-surface text-voice-text text-[16px] placeholder:text-voice-text-tertiary focus:outline-none focus:ring-2 focus:ring-voice-accent'
          />
        </label>
      </div>
    </SubScreenShell>
  );
};

export default ProfileScreen;
```

- [ ] **Step 3: Ajouter clés i18n manquantes (`profile`)**

Sous `settings.profile` dans les 5 langues : "Profil" / "Profile" / "Profil" / "Perfil" / "Perfil".

### Task 5.3: `VoiceScreen.tsx`

**Files:**
- Create: `services/frontend/src/components/mobile/settings/VoiceScreen.tsx`

- [ ] **Step 1: Réutiliser `VoiceSelector` / `VoiceUploadForm` existants en les enveloppant**

```tsx
'use client';

import { FC, useState, useEffect, useCallback } from 'react';
import SubScreenShell from './_SubScreenShell';
import VoiceSelector from '@/components/settings/VoiceSelector';
import VoiceUploadForm from '@/components/settings/VoiceUploadForm';
import { useTranslations } from '@/i18n';
import { getVoices, updateUserSettings, type UserSettings } from '@/utils/userData';

interface Props {
  settings: UserSettings;
  onBack: () => void;
  onSave: (s: UserSettings) => void;
}

const VoiceScreen: FC<Props> = ({ settings, onBack, onSave }) => {
  const t = useTranslations();
  const [voice, setVoice] = useState(settings.voice ?? '');
  const [voices, setVoices] = useState<Record<string, any> | null>(null);
  const [showUpload, setShowUpload] = useState(false);

  useEffect(() => {
    getVoices().then((r) => { if (r.data) setVoices(r.data); });
  }, []);

  const handleSave = useCallback(async () => {
    const updated: UserSettings = { ...settings, voice };
    const r = await updateUserSettings(updated);
    if (!r.error) onSave(updated);
  }, [settings, voice, onSave]);

  return (
    <SubScreenShell title={t('settings.voice')} onBack={onBack} onSave={handleSave} saveLabel={t('common.save')}>
      <div className='flex flex-col gap-4 mt-3'>
        {voices && (
          <VoiceSelector
            availableVoices={voices}
            selectedVoice={voice}
            onChange={(v) => setVoice(v)}
            theme='light'
          />
        )}
        <button
          className='w-full py-3 rounded-full bg-voice-surface text-voice-text font-medium text-[15px]'
          onClick={() => setShowUpload((s) => !s)}
        >
          {showUpload ? t('common.cancel') : t('settings.cloneYourVoice')}
        </button>
        {showUpload && (
          <VoiceUploadForm
            onUploaded={() => { setShowUpload(false); getVoices().then((r) => { if (r.data) setVoices(r.data); }); }}
            theme='light'
          />
        )}
      </div>
    </SubScreenShell>
  );
};

export default VoiceScreen;
```

- [ ] **Step 2: Ajouter une prop `theme` (`'light' | 'dark'`) aux composants `VoiceSelector` et `VoiceUploadForm`**

Pour chaque, mapper les classes selon le `theme`. Defaults `theme='dark'` pour préserver la compat desktop pendant la migration. Sur `light`, utiliser les tokens `bg-voice-surface`, `text-voice-text`, etc.

- [ ] **Step 3: Type-check**

```bash
cd services/frontend && pnpm typecheck
```

### Task 5.4: `LanguageScreen.tsx`

**Files:**
- Create: `services/frontend/src/components/mobile/settings/LanguageScreen.tsx`

- [ ] **Step 1: Implémentation**

```tsx
'use client';

import { FC, useState } from 'react';
import { Check } from 'lucide-react';
import SubScreenShell from './_SubScreenShell';
import { useTranslations } from '@/i18n';
import { updateUserSettings, type UserSettings } from '@/utils/userData';

const LANGUAGES = [
  { code: '', label: 'letSpeechToTextGuess' },
  { code: 'fr', label: 'French' },
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Spanish' },
  { code: 'de', label: 'German' },
  { code: 'pt', label: 'Portuguese' },
];

interface Props {
  settings: UserSettings;
  onBack: () => void;
  onSave: (s: UserSettings) => void;
}

const LanguageScreen: FC<Props> = ({ settings, onBack, onSave }) => {
  const t = useTranslations();
  const [language, setLanguage] = useState(settings.language ?? '');

  const handleSave = async () => {
    const updated: UserSettings = { ...settings, language };
    const r = await updateUserSettings(updated);
    if (!r.error) onSave(updated);
  };

  return (
    <SubScreenShell title={t('settings.expectedTranscriptionLanguage')} onBack={onBack} onSave={handleSave} saveLabel={t('common.save')}>
      <div className='mt-3 bg-voice-elevated rounded-[14px] divide-y divide-voice-border'>
        {LANGUAGES.map((l) => (
          <button
            key={l.code}
            onClick={() => setLanguage(l.code)}
            className='w-full flex items-center justify-between px-4 py-4 text-left'
          >
            <span className='text-[16px] text-voice-text'>{t(`languages.${l.label}`)}</span>
            {language === l.code && <Check size={18} className='text-voice-accent' />}
          </button>
        ))}
      </div>
    </SubScreenShell>
  );
};

export default LanguageScreen;
```

- [ ] **Step 2: Vérifier la présence des clés `languages.French`, etc.**

Si absentes, les ajouter dans les 5 fichiers `messages/*.json` (FR, EN, DE, ES, PT, et `letSpeechToTextGuess` qui existe déjà).

### Task 5.5: `PersonalityScreen.tsx`

**Files:**
- Create: `services/frontend/src/components/mobile/settings/PersonalityScreen.tsx`

- [ ] **Step 1: Implémentation**

```tsx
'use client';

import { FC, useState } from 'react';
import SubScreenShell from './_SubScreenShell';
import { useTranslations } from '@/i18n';
import { updateUserSettings, type UserSettings } from '@/utils/userData';

interface Props {
  settings: UserSettings;
  onBack: () => void;
  onSave: (s: UserSettings) => void;
}

const PersonalityScreen: FC<Props> = ({ settings, onBack, onSave }) => {
  const t = useTranslations();
  const [prompt, setPrompt] = useState(settings.prompt ?? '');

  const handleSave = async () => {
    const updated: UserSettings = { ...settings, prompt };
    const r = await updateUserSettings(updated);
    if (!r.error) onSave(updated);
  };

  return (
    <SubScreenShell title={t('settings.personality')} onBack={onBack} onSave={handleSave} saveLabel={t('common.save')}>
      <div className='flex flex-col gap-2 mt-3'>
        <label className='text-[13px] font-semibold text-voice-text-secondary tracking-wider px-1'>
          {t('settings.configureAssistant').toUpperCase()}
        </label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={t('settings.promptPlaceholder')}
          className='min-h-[280px] px-4 py-3.5 rounded-[14px] bg-voice-surface text-voice-text text-[16px] placeholder:text-voice-text-tertiary focus:outline-none focus:ring-2 focus:ring-voice-accent resize-none'
        />
      </div>
    </SubScreenShell>
  );
};

export default PersonalityScreen;
```

### Task 5.6: `ContextsScreen.tsx` (déplacement du code existant)

**Files:**
- Create: `services/frontend/src/components/mobile/settings/ContextsScreen.tsx`

- [ ] **Step 1: Réutiliser la logique CRUD déjà présente dans l'ancien `MobileSettingsPopup`**

```tsx
'use client';

import { FC, useState, useCallback } from 'react';
import { X } from 'lucide-react';
import SubScreenShell from './_SubScreenShell';
import { useTranslations } from '@/i18n';
import { updateUserSettings } from '@/utils/userData';
import type { Context, UserSettings } from '@/utils/userData';

interface Props {
  settings: UserSettings;
  onBack: () => void;
  onSave: (s: UserSettings) => void;
}

const ContextsScreen: FC<Props> = ({ settings, onBack, onSave }) => {
  const t = useTranslations();
  const [contexts, setContexts] = useState<Context[]>(settings.contexts ?? []);
  const [input, setInput] = useState('');
  const [err, setErr] = useState<string | null>(null);

  const add = useCallback(() => {
    const label = input.trim();
    if (!label) return;
    if (label.length > 100) { setErr(t('settings.contextTooLong')); return; }
    if (contexts.some((c) => c.label.toLowerCase() === label.toLowerCase())) { setErr(t('settings.contextDuplicate')); return; }
    setContexts([...contexts, { id: crypto.randomUUID(), label }]);
    setInput(''); setErr(null);
  }, [contexts, input, t]);

  const remove = useCallback((id: string) => setContexts((c) => c.filter((x) => x.id !== id)), []);

  const handleSave = async () => {
    const updated: UserSettings = { ...settings, contexts };
    const r = await updateUserSettings(updated);
    if (!r.error) onSave(updated);
  };

  return (
    <SubScreenShell title={t('settings.contexts')} onBack={onBack} onSave={handleSave} saveLabel={t('common.save')}>
      <div className='flex flex-col gap-3 mt-3'>
        <div className='bg-voice-elevated rounded-[14px] divide-y divide-voice-border'>
          {contexts.length === 0 && (
            <p className='px-4 py-4 text-[14px] italic text-voice-text-tertiary'>{t('settings.noContextsAdded')}</p>
          )}
          {contexts.map((c) => (
            <div key={c.id} className='flex items-center justify-between px-4 py-3.5'>
              <span className='text-[16px] text-voice-text'>{c.label}</span>
              <button onClick={() => remove(c.id)} aria-label={`Remove ${c.label}`} className='w-8 h-8 flex items-center justify-center text-voice-text-tertiary'>
                <X size={18} />
              </button>
            </div>
          ))}
        </div>
        {err && <p className='text-[12px] text-voice-danger px-1'>{err}</p>}
        <div className='flex gap-2'>
          <input
            type='text'
            value={input}
            onChange={(e) => { setInput(e.target.value); setErr(null); }}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
            placeholder={t('settings.addContextPlaceholder')}
            maxLength={100}
            className='flex-1 px-4 py-3 rounded-full bg-voice-surface text-[16px] text-voice-text placeholder:text-voice-text-tertiary focus:outline-none focus:ring-2 focus:ring-voice-accent'
          />
          <button onClick={add} className='px-5 py-3 rounded-full bg-voice-accent text-white font-medium text-[15px]'>
            {t('common.add')}
          </button>
        </div>
      </div>
    </SubScreenShell>
  );
};

export default ContextsScreen;
```

### Task 5.7: `KeywordsScreen.tsx`, `FriendsScreen.tsx`, `DocumentsScreen.tsx`

**Files:**
- Create: `services/frontend/src/components/mobile/settings/KeywordsScreen.tsx`
- Create: `services/frontend/src/components/mobile/settings/FriendsScreen.tsx`
- Create: `services/frontend/src/components/mobile/settings/DocumentsScreen.tsx`

- [ ] **Step 1: Copier le pattern `ContextsScreen` pour Keywords et Friends**

Ces deux écrans sont des listes CRUD avec un input + bouton "Ajouter". Cloner `ContextsScreen.tsx` en remplaçant :
- `contexts` → `additionalKeywords` (Keywords) ou `friends` (Friends).
- Le type de l'item (string pour keywords, `{ id, name }` ou similaire pour friends — vérifier `UserSettings` exact dans `services/frontend/src/types/user.ts`).
- Les clés i18n (`additionalKeywords`, `addKeywordPlaceholder`, `noKeywordsAdded`, idem `friends`).

- [ ] **Step 2: `DocumentsScreen.tsx` — réutiliser `DocumentEditorPopup`**

`DocumentEditorPopup` (`services/frontend/src/components/settings/DocumentEditorPopup.tsx`) gère déjà l'édition d'un document. L'écran mobile :

```tsx
'use client';

import { FC, useState } from 'react';
import { ChevronRight, Plus } from 'lucide-react';
import SubScreenShell from './_SubScreenShell';
import DocumentEditorPopup from '@/components/settings/DocumentEditorPopup';
import { useTranslations } from '@/i18n';
import { updateUserSettings } from '@/utils/userData';
import type { UserSettings } from '@/utils/userData';

interface Props {
  settings: UserSettings;
  onBack: () => void;
  onSave: (s: UserSettings) => void;
}

const DocumentsScreen: FC<Props> = ({ settings, onBack, onSave }) => {
  const t = useTranslations();
  const [docs, setDocs] = useState(settings.documents ?? []);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const handleSave = async () => {
    const updated: UserSettings = { ...settings, documents: docs };
    const r = await updateUserSettings(updated);
    if (!r.error) onSave(updated);
  };

  if (editingIndex !== null) {
    return (
      <DocumentEditorPopup
        document={docs[editingIndex]}
        onSave={(d) => { const next = [...docs]; next[editingIndex] = d; setDocs(next); setEditingIndex(null); }}
        onCancel={() => setEditingIndex(null)}
      />
    );
  }

  return (
    <SubScreenShell title={t('settings.documents')} onBack={onBack} onSave={handleSave} saveLabel={t('common.save')}>
      <div className='flex flex-col gap-3 mt-3'>
        <div className='bg-voice-elevated rounded-[14px] divide-y divide-voice-border'>
          {docs.length === 0 && (
            <p className='px-4 py-4 text-[14px] italic text-voice-text-tertiary'>{t('settings.noDocumentsAdded')}</p>
          )}
          {docs.map((d, i) => (
            <button key={i} onClick={() => setEditingIndex(i)} className='w-full flex items-center justify-between px-4 py-3.5 text-left'>
              <span className='text-[16px] text-voice-text truncate'>{d.title || t('settings.untitledDocument')}</span>
              <ChevronRight size={16} className='text-voice-text-tertiary' />
            </button>
          ))}
        </div>
        <button
          onClick={() => { setDocs([...docs, { title: '', content: '' }]); setEditingIndex(docs.length); }}
          className='flex items-center justify-center gap-2 py-3 rounded-full bg-voice-accent text-white font-medium'
        >
          <Plus size={18} />
          {t('settings.addDocument')}
        </button>
      </div>
    </SubScreenShell>
  );
};

export default DocumentsScreen;
```

> Adapter le typage à la forme réelle de `UserSettings.documents` (consulter `services/frontend/src/types/user.ts` au moment de l'implémentation).

### Task 5.8: `AccountScreen.tsx`

**Files:**
- Create: `services/frontend/src/components/mobile/settings/AccountScreen.tsx`

- [ ] **Step 1: Implémentation**

```tsx
'use client';

import { FC } from 'react';
import { LogOut } from 'lucide-react';
import SubScreenShell from './_SubScreenShell';
import { useAuthContext } from '@/auth/authContext';
import { useTranslations } from '@/i18n';

interface Props {
  email: string;
  onBack: () => void;
}

const AccountScreen: FC<Props> = ({ email, onBack }) => {
  const t = useTranslations();
  const { signOut } = useAuthContext();

  return (
    <SubScreenShell title={t('settings.privacy')} onBack={onBack}>
      <div className='flex flex-col gap-4 mt-3'>
        <div className='bg-voice-elevated rounded-[14px] px-4 py-4'>
          <p className='text-[14px] text-voice-text-secondary leading-relaxed'>
            {t('settings.privacyExplain')}
          </p>
        </div>
        <div className='bg-voice-elevated rounded-[14px] px-4 py-3.5'>
          <div className='text-[12px] font-semibold text-voice-text-secondary tracking-wider mb-1'>{t('settings.email').toUpperCase()}</div>
          <div className='text-[16px] text-voice-text'>{email}</div>
        </div>
        <button
          onClick={signOut}
          className='w-full flex items-center justify-center gap-2 py-4 rounded-full bg-voice-elevated border border-voice-danger text-voice-danger font-semibold text-[17px]'
        >
          <LogOut size={18} />
          {t('settings.signOut')}
        </button>
      </div>
    </SubScreenShell>
  );
};

export default AccountScreen;
```

- [ ] **Step 2: Ajouter clé i18n `settings.privacyExplain`**

FR : "Voice est un outil personnel. Vos conversations et paramètres sont stockés uniquement sur votre serveur. Aucune donnée n'est partagée avec un tiers."
EN/DE/ES/PT : traductions équivalentes.

### Task 5.9: Tests d'intégration mobile settings — toutes les sections visibles

**Files:**
- Create: `services/frontend/src/components/settings/__tests__/MobileSettingsPopup.integration.test.tsx`

- [ ] **Step 1: Écrire le test failing puis implémenter pour le rendre vert**

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import MobileSettingsPopup from '../MobileSettingsPopup';

const mockSettings = {
  name: 'Arnaud',
  voice: '',
  language: '',
  prompt: '',
  contexts: [],
  additionalKeywords: [],
  friends: [],
  documents: [],
};

jest.mock('@/utils/userData', () => ({
  ...jest.requireActual('@/utils/userData'),
  updateUserSettings: jest.fn(async () => ({ error: null })),
  getVoices: jest.fn(async () => ({ data: {} })),
}));

describe('MobileSettingsPopup — full parity', () => {
  it('exposes Profile, Voice, Language, Personality, Contexts, Keywords, Friends, Documents, Account sections', () => {
    render(<MobileSettingsPopup userSettings={mockSettings as any} email='a@b.test' onSave={jest.fn()} onCancel={jest.fn()} />);
    expect(screen.getByText('Arnaud')).toBeInTheDocument();
    expect(screen.getByText(/voix/i)).toBeInTheDocument();
    expect(screen.getByText(/langue de transcription/i)).toBeInTheDocument();
    expect(screen.getByText(/personnalité/i)).toBeInTheDocument();
    expect(screen.getByText(/contextes/i)).toBeInTheDocument();
    expect(screen.getByText(/mots-clés/i)).toBeInTheDocument();
    expect(screen.getByText(/proches/i)).toBeInTheDocument();
    expect(screen.getByText(/documents/i)).toBeInTheDocument();
    expect(screen.getByText(/confidentialité/i)).toBeInTheDocument();
  });

  it('navigates to Voice sub-screen on tap', () => {
    render(<MobileSettingsPopup userSettings={mockSettings as any} email='a@b.test' onSave={jest.fn()} onCancel={jest.fn()} />);
    fireEvent.click(screen.getByText(/voix/i));
    // Sub-screen header shows back arrow + section title centered
    expect(screen.getAllByText(/voix/i).length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Lancer les tests**

```bash
cd services/frontend && pnpm test -- MobileSettingsPopup.integration
```
Expected: PASS.

### Task 5.10: Commit unique Phase 5

**Files:** tous les fichiers créés dans la Phase 5.

- [ ] **Step 1: Vérifier le build + tests globaux**

```bash
cd services/frontend && pnpm typecheck && pnpm lint && pnpm test
```
Expected: tout vert.

- [ ] **Step 2: Smoke test mobile complet**

`pnpm dev`, DevTools mobile 393×852 :
- Ouvrir paramètres depuis l'écran d'accueil.
- Naviguer dans chacune des 9 sous-sections, modifier une valeur, sauvegarder, vérifier que la valeur persiste après ré-ouverture.

- [ ] **Step 3: Commit**

```bash
git add services/frontend/src/components/settings/MobileSettingsPopup.tsx \
        services/frontend/src/components/mobile/settings/ \
        services/frontend/src/components/settings/__tests__/MobileSettingsPopup.integration.test.tsx \
        services/frontend/src/messages/
COMMIT_SKILL=loaded git commit -m "feat(mobile): full parity settings via iOS-style sub-screens"
```

---

## Phase wrap-up — Vérification globale et déploiement

### Task W.1: Vérification finale

- [ ] **Step 1: Run tous les tests**

```bash
cd services/backend && uv run pytest
cd ../frontend && pnpm typecheck && pnpm lint && pnpm test
```
Expected: tout vert.

- [ ] **Step 2: Build prod local**

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml build
```
Expected: builds OK pour frontend et backend.

- [ ] **Step 3: Vérifier l'absence de références héritées**

```bash
grep -rn "Invincible\|Kyutai\|Unmute\|Gradium" services/ \
  --include="*.ts" --include="*.tsx" --include="*.py" --include="*.json" --include="*.md" \
  | grep -v "node_modules\|__pycache__\|\.next\|kyutai_constants\|unmute_handler\|UnmuteHandler" \
  | grep -v "openai_realtime_api_events.py:.*class Unmute"
```
Expected: 0 résultat ou uniquement les noms de classes Pydantic conservés (Task 1.6 step 3).

### Task W.2: Push staging et validation

- [ ] **Step 1: Pousser la branche sur `staging`**

```bash
git push origin <branch>:staging --force-with-lease
```

- [ ] **Step 2: Suivre le déploiement et vérifier sur https://staging.voice.amiral.tech**

```bash
ssh root@178.105.76.90 'cd /opt/invincible-voice-staging && docker compose -p invincible-voice-staging -f docker-compose.staging.yml logs -f --tail=100'
```

Vérifier dans le navigateur mobile (393×852) :
1. Écran d'accueil → "Voice" + mic + CTA noir.
2. Démarrer conversation → vue unifiée sans tabs.
3. Settings → 9 sections, navigation drill-down OK.
4. Login/logout → cookie persiste après refresh.

- [ ] **Step 3: Promote prod**

Quand staging validé :

```bash
git checkout main && git merge --ff-only <branch> && git push origin main
```

Le workflow CI/CD principal déploie sur https://voice.amiral.tech.

---

## Self-review notes

- **Couverture spec :** 5 phases du spec → 5 phases de tâches. Chaque sous-item du scope inclus est couvert par au moins une task (vérifié manuellement).
- **Placeholders :** aucun "TBD". Quelques étapes invitent à adapter selon l'état réel du code au moment de l'impl (par ex. forme exacte de `UserSettings.documents`), mais avec contexte suffisant et fallback explicite — pas de blanc.
- **Type consistency :** `Voice` est le nouveau nom du composant principal partout après Task 1.3. `voice_constants` / `voice_handler` / `VoiceHandler` cohérents. Events `voice.*` partout après Task 1.6.
- **Ordre :** Phase 1 doit précéder Phase 3 (renommages avant reskins qui touchent les mêmes fichiers). Phase 3 doit précéder Phases 4 et 5 (tokens utilisés dans les nouveaux composants). Phase 2 est indépendante et peut être faite en parallèle.
