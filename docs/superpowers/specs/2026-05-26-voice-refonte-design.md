# Sous-projet 4 — Voice : rebrand, refonte visuelle white mode, session longue, mobile full parity

**Date :** 2026-05-26
**Statut :** Design validé, prêt pour writing-plans
**Périmètre parent :** Suite du sous-projet 3 (contextes cliquables). Premier chantier transverse mêlant rebrand, UX, et infra session.

## Contexte

L'app sert exclusivement à Arnaud, un proche qui ne peut plus parler. Voice est son outil quotidien de communication via mobile. La codebase a beaucoup divergé du fork `kyutai-labs/invincible-voice` ; les références "Invincible Voice", "Kyutai" et "Unmute" sont devenues incohérentes et l'expérience reste construite pour un usage générique :

- Marque Kyutai/Invincible omniprésente dans l'UI, les events backend (`unmute.*`), les noms de fichiers (`kyutai_constants.py`, `unmute_handler.py`, `InvincibleVoice.tsx`).
- UI en dark mode, accents orange dégradés, ton "techno démo".
- Session JWT 60 min + cookie sans `maxAge` → Arnaud doit se reconnecter à chaque ouverture, ce qui est inacceptable pour un outil d'assistance personnel.
- Mobile : `MobileSettingsPopup` n'expose que `name` et `contexts` (le reste — voix, langue, prompt, keywords, friends, documents — n'est accessible que sur desktop). `MobileConversationLayout` impose des onglets Chat / Réponses / Historique qui forcent à switcher pendant une conversation en temps réel.

## Objectif

Faire de Voice un outil personnel sobre, lisible, full-mobile et sans friction d'authentification, calibré pour l'usage d'Arnaud.

## Scope

**Inclus**

1. **Rebrand "Voice"** complet : suppression de toute référence Invincible Voice / Kyutai / Unmute / Gradium-as-brand. Renommage des strings i18n (5 langues), du titre HTML, du composant principal `InvincibleVoice.tsx` → `Voice.tsx`, des fichiers backend `kyutai_constants.py` → `voice_constants.py` et `unmute_handler.py` → `voice_handler.py`, et des events WebSocket `unmute.*` → `voice.*`. Suppression du logo Gradium en footer.
2. **Refonte visuelle white mode** Apple-like : nouvelle palette, nouvelle typographie, redesign des composants. Migration depuis le dark mode actuel.
3. **Session persistante 1 an** : JWT `exp = 365j`, cookie `maxAge = 365j`. Pas de refresh token (KISS : Arnaud n'a qu'un device de référence ; en cas de perte, déconnexion manuelle ou rotation du secret JWT).
4. **Mobile : conversation unifiée sans onglets** : refonte de `MobileConversationLayout` pour empiler chat (scrollable) + suggestions (cartes pleine largeur) + chips contextes + input bar, le tout visible simultanément. Le panneau d'historique des conversations passées est déplacé hors du flow principal (déclenché depuis l'écran d'accueil).
5. **Mobile : settings full parity** : refonte de `MobileSettingsPopup` pour exposer **toutes** les sections présentes sur desktop : profil, voix (sélection + test + clone), langue de transcription, personnalité (prompt), vocabulaire (keywords), contextes, proches, documents, compte (sign out). Pattern iOS Settings : sections groupées en cartes, icônes catégorielles colorées, chevrons, navigation par drill-down ou inline.

**Hors-scope (YAGNI)**

- Mode sombre optionnel (toggle thème). Voice est en white mode uniquement.
- Refresh token / rotation automatique. Le JWT 1 an est suffisant pour le cas d'Arnaud.
- PWA / installation home screen / notifications push. Pas demandé par l'utilisateur.
- Tablette landscape spécifique. Le mobile-first absorbe la tablette portrait via responsive width.
- Désinstallation des sondes Prometheus/Grafana, ni renommage des dashboards (interne, pas exposé à Arnaud).
- Migration du nom du repo `invincible-voice` sur disque (`/Users/louis/claude-local/invincible-voice`) — coût élevé, gain nul.

## Architecture des changements

### 1. Rebrand "Voice"

**User-facing**

| Fichier | Avant | Après |
|-|-|-|
| `services/frontend/src/app/layout.tsx` (`metadata.title`) | `InvincibleVoice by Kyutai` | `Voice` |
| `services/frontend/src/messages/{fr,en,es,pt,de}.json` (clés `termsOfServiceMessage`, `moreSettingsAvailable`, `startSpeaking`) | "Invincible Voice", "InvincibleVoice" | "Voice" |
| `services/frontend/src/components/InvincibleVoice.tsx` (lignes 921, 1102) | "InvincibleVoice" dans messages erreur/loading | "Voice" |
| `services/frontend/src/components/mobile/MobileLayout.tsx` (footer) | `<img src="/gradium.svg">` + texte "textToSpeechProvider" | Supprimé |
| Lien `kyutai.org/privacy-policy` dans `MobileSettingsPopup` et desktop settings | Externe Kyutai | Lien supprimé. Une page interne `/privacy` pourra être ajoutée plus tard si besoin (hors-scope). |
| `README.md`, `CLAUDE.md` (mentions historiques) | "Invincible Voice (ex-Unmute)" | "Voice" + mention discrète "fork InvincibleVoice" en pied de README |

**Composants & fichiers**

| Avant | Après |
|-|-|
| `services/frontend/src/components/InvincibleVoice.tsx` | `services/frontend/src/components/Voice.tsx` (export default `Voice`) |
| `services/frontend/src/app/__tests__/InvincibleVoice.test.tsx` | `Voice.test.tsx` |
| `services/frontend/src/app/__tests__/InvincibleVoice.simple.test.tsx` | `Voice.simple.test.tsx` |
| `services/backend/backend/kyutai_constants.py` | `services/backend/backend/voice_constants.py` |
| `services/backend/backend/unmute_handler.py` | `services/backend/backend/voice_handler.py` |
| `services/backend/tests/llm/test_kyutai_constants.py` | `services/backend/tests/llm/test_voice_constants.py` |

Tous les imports `from backend.kyutai_constants` et `from backend.unmute_handler` sont mis à jour. Idem côté Python `class UnmuteHandler` → `VoiceHandler`.

**Événements WebSocket**

| Avant | Après |
|-|-|
| `unmute.interrupted_by_vad` | `voice.interrupted_by_vad` |
| `unmute.response.text.delta.ready` | `voice.response.text.delta.ready` |
| `unmute.response.audio.delta.ready` | `voice.response.audio.delta.ready` |
| `unmute.additional_outputs` | `voice.additional_outputs` |

Pas de période de transition / dual-write : frontend et backend sont déployés ensemble (Docker Compose). Le rebrand backend et frontend sera mergé dans la même PR pour éviter une fenêtre d'incompatibilité.

### 2. Refonte visuelle white mode

**Palette** (Tailwind config + CSS variables)

| Token | Valeur | Usage |
|-|-|-|
| `--bg-primary` | `#FFFFFF` | Fond principal app |
| `--bg-secondary` | `#F2F2F7` | Fond surfaces secondaires (settings, status bar, banner) |
| `--bg-elevated` | `#FFFFFF` | Cartes posées sur fond gris |
| `--border-default` | `#E5E5EA` | Séparateurs, contours de cartes |
| `--text-primary` | `#1C1C1E` | Texte principal |
| `--text-secondary` | `#6B7280` | Texte secondaire, labels |
| `--text-tertiary` | `#9CA3AF` | Placeholder, chevrons |
| `--accent` | `#0A84FF` | Actions primaires, sélection, bulles Voice |
| `--accent-soft` | `#F5F7FA` | Fond cartes suggestions |
| `--danger` | `#FF3B30` | Bouton "Arrêter", déconnexion |
| `--success` | `#34C759` | Confirmation, indicateurs OK |

**Typographie** : `Inter` (déjà chargée), tailles `13 / 15 / 16 / 17 / 20 / 28 / 52`, weights `400 / 500 / 600 / 700`. Letter-spacing négatif sur les titres ≥ 28px. Line-height 1.4 sur les bulles, 1.3 sur les CTA.

**Composants impactés** (à reskinner)

- `InvincibleVoice.tsx` (→ `Voice.tsx`) : suppression du dégradé orange (`orange-to-light-orange-gradient`), des fonds `bg-[#181818]/#121212/#1B1B1B`. Bulles chat repensées avec coins `[20,20,20,4]` à gauche, `[20,20,4,20]` à droite.
- `MobileLayout.tsx` (écran d'accueil mobile) : suppression du dégradé et du logo Gradium ; nouveau layout vertical centré avec titre "Voice" 52pt, bouton mic 160×160, CTA noir "Démarrer la conversation".
- `StartConversationButton.tsx` : nouveau style noir + chevron.
- Tous les `bg-gray-700/800/900` Tailwind → palette tokens.
- `ContextsSelector.tsx`, `KeywordsSuggestion.tsx` : chips white-mode (fond `#F2F2F7`, accent `#0A84FF` pour actifs).
- `SettingsPopup.tsx` (desktop) : reskinnée white mode + même palette, sans toucher à la structure interne (gain marginal mais cohérence).
- `BubbleTrail.tsx` : neutralisée (effet décoratif dark mode) ou supprimée si non essentielle (à confirmer pendant impl, défaut = suppression).

**Maquettes de référence** : `voice.pen` (3 écrans : démarrage, conversation, paramètres).

### 3. Session persistante 1 an

**Backend** (`services/backend/backend/security.py`)

```python
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 365  # 1 an
```

**Frontend** (`services/frontend/src/auth/authContext.tsx`, lignes 120 et 144)

```ts
new Cookies().set('bearerToken', data.access_token, {
  path: '/',
  maxAge: 365 * 24 * 60 * 60, // 1 an, en secondes
  sameSite: 'lax',
  secure: window.location.protocol === 'https:',
});
```

Pas de modification du flow de login lui-même ni du endpoint `/auth/login`. Aucune migration nécessaire pour les tokens existants : un user déjà loggué garde son token court jusqu'à son prochain login, où il obtient un token 1 an.

### 4. Mobile conversation : vue unifiée

**Composant cible** : `services/frontend/src/components/mobile/MobileConversationLayout.tsx` (370 lignes aujourd'hui, refactor en place — pas de nouveau composant).

**Suppression**

- Tabs `Chat / Responses / History`. `ActivePanel` state retiré.
- Logique de visibilité conditionnelle des panels selon `activePanel`.
- `SIZE_BY_PANEL` (la taille de réponse devient unique : `RESPONSES_SIZES.M`, taille moyenne adaptée aux cartes).
- Routing implicite vers `history` : on accède désormais à l'historique uniquement depuis l'écran d'accueil (`MobileLayout`).

**Nouvelle structure** (de haut en bas, layout vertical sticky)

1. Status bar safe-area + header `Arrêter` (rouge contour) + roue crantée settings (44×44 round, fond gris).
2. Bandeau "L'interlocuteur parle…" (sticky, ne s'affiche que si STT actif), point rouge + texte live.
3. Chat scroll `flex-1`, padding 16, gap 10. Bulles : largeur `fit_content(280)`, padding 12×16, radius asymétriques. Gris `#F2F2F7` à gauche (interlocuteur), bleu `#0A84FF` à droite (Voice/Arnaud).
4. Suggestions (sticky bas, fit_content) : header "Réponses suggérées" + bouton "Figer", puis 3 cartes pleine largeur `fill_container`, fond `#F5F7FA`, border `#E5E7EB`, padding 14, icône envoi bleue à droite. Click → envoi immédiat + TTS.
5. Chips contextes scroll horizontal (sticky bas, fit_content) : actifs en bleu plein, inactifs en gris.
6. Input bar (sticky bas) : champ pill gris `#F2F2F7` avec placeholder "Écrire ou dicter…" et icône micro bleue intégrée à droite + bouton send round 48×48 fond bleu à côté.
7. Home-indicator safe-area.

**Comportement clavier** : le `useViewportHeight` hook existant est conservé pour gérer l'apparition du clavier mobile. Tout le bloc bas (suggestions + chips + input) remonte avec le clavier.

**Mode "viewing past conversation"** : conservé. Quand `isViewingPastConversation`, le bloc suggestions/chips/input est caché, on n'affiche que le chat scroll + un bouton "Retour" en haut.

### 5. Mobile settings : full parity

**Composant cible** : `services/frontend/src/components/settings/MobileSettingsPopup.tsx` (175 lignes aujourd'hui, refactor en profondeur).

**Nouvelle structure** (scroll vertical, layout iOS Settings)

```
Header large "Paramètres" 28pt + close X (cercle gris 32×32)

[Carte profil — fond blanc cornerRadius 14]
  Avatar initiale (48×48 fond bleu) | Nom (17pt) / Email (13pt gris) | chevron

[Section "Conversation"]  label uppercase 13pt gris
  [Carte fond blanc, séparateurs internes]
    Icône colorée 30×30 | Voix (Sophie · Français) | chevron
    Icône colorée 30×30 | Langue de transcription | chevron
    Icône colorée 30×30 | Personnalité (prompt) | chevron

[Section "Personnalisation"]
  Contextes (4 actifs) | chevron
  Vocabulaire (12 mots-clés) | chevron
  Proches (3 personnes) | chevron
  Documents (Aucun document) | chevron

[Section "Compte"]
  Confidentialité (CGU et données) | chevron
  Se déconnecter (rouge)
```

Chaque ligne de section ouvre un **sous-écran plein écran** (slide-in depuis la droite, ou modal full-screen sur mobile) avec :

- Header back + titre.
- Contenu spécifique au paramètre (réutiliser les sous-composants existants : `VoiceSettings`, `VoiceSelector`, `VoiceUploadForm`, etc., adaptés white mode).
- Bouton "Enregistrer" sticky en bas.

**Sous-composants à créer** (nouvelle structure plate `mobile/settings/`)

- `mobile/settings/ProfileScreen.tsx` (nom + email)
- `mobile/settings/VoiceScreen.tsx` (réutilise `VoiceSelector` + `VoiceUploadForm` adaptés)
- `mobile/settings/LanguageScreen.tsx`
- `mobile/settings/PersonalityScreen.tsx` (prompt LLM, textarea grande)
- `mobile/settings/ContextsScreen.tsx` (CRUD contextes — code déjà présent dans `MobileSettingsPopup` actuel, à déplacer)
- `mobile/settings/KeywordsScreen.tsx`
- `mobile/settings/FriendsScreen.tsx`
- `mobile/settings/DocumentsScreen.tsx` (réutilise `DocumentEditorPopup`)
- `mobile/settings/AccountScreen.tsx` (privacy lien + sign out)

**Navigation** : state local `activeScreen: 'index' | 'profile' | 'voice' | ...` dans `MobileSettingsPopup`. Pas de routeur React (KISS). Animation de transition CSS `translateX`.

## Tests

| Couverture | Type | Fichier |
|-|-|-|
| Token 1 an retourné par `/auth/login` | Backend unit | `services/backend/tests/auth/test_token_expiry.py` (nouveau) |
| Cookie posé avec `maxAge` 1 an | Frontend unit | `services/frontend/src/auth/__tests__/authContext.test.ts` (nouveau ou extension) |
| Pas de tabs dans `MobileConversationLayout` | Frontend unit | Mise à jour des tests existants `mobile.test.tsx` |
| Toutes les sections settings visibles sur mobile | Frontend unit | `MobileSettingsPopup.test.tsx` (extension) |
| Renommage event `voice.*` côté backend | Backend integration | Extension de `tests/llm/test_voice_constants.py` ou existant `test_websocket_*` |
| Strings i18n ne contiennent plus "Invincible" / "Kyutai" / "Unmute" / "Gradium" | Frontend lint test | `messages.test.ts` (nouveau, simple grep across `messages/*.json`) |

## Migrations / risques

- **Renommage `unmute.*` events** : risque d'incompatibilité si un client mobile garde une version frontend cachée. Mitigation : déploiement atomique frontend + backend dans la même PR, et `Cache-Control: no-cache` déjà en place sur le frontend Next.js. Arnaud étant l'unique utilisateur, le risque est nul après un reload.
- **Sign-out global** : les utilisateurs existants ne sont pas invalidés (l'ancien token reste valide jusqu'à sa propre expiration 60min ; au prochain login il obtiendra un token 1 an).
- **Refonte visuelle** : risque cosmétique sur composants peu testés (BubbleTrail, KeywordsSuggestion). Mitigation : screenshot manuel avant/après sur staging avant promote prod.
- **Tests visuels** : pas de Storybook/Chromatic, donc régressions cosmétiques détectées uniquement par l'œil. Vérification manuelle sur staging.

## Ordre d'exécution recommandé

1. **Phase 1 — Rebrand backend + frontend (atomique)** : renommage fichiers, events, strings, titles. Pas de logique modifiée. Mergé en une PR.
2. **Phase 2 — Session 1 an** : 2 changements, 2 lignes chacun. PR séparée pour audit clair.
3. **Phase 3 — Palette + typo white mode** : Tailwind config, CSS variables, theme switch global. Reskin des composants existants sans changer leur structure. PR séparée.
4. **Phase 4 — Refonte `MobileConversationLayout`** : suppression tabs, layout unifié. PR séparée.
5. **Phase 5 — Refonte `MobileSettingsPopup` full parity** : sous-écrans + routing local. PR séparée.

Chaque phase est promotable à prod indépendamment (test sur staging puis promote). Total estimé : 5 PRs.
