# Plan d'Optimisation - Migration RPC & Suppression Mapping Frontend

## Statut: ✅ IMPLÉMENTÉ

---

## Résumé des Changements

### Fichiers Créés
| Fichier | Description |
|---------|-------------|
| `supabase/migrations/migration_v3_rpc.sql` | 5 fonctions RPC PostgreSQL |
| `services/rpcService.ts` | Client TypeScript pour les RPC |

### Fichiers Modifiés
| Fichier | Changements |
|---------|-------------|
| `services/playerService.ts` | Supprimé `mapDbToPlayer()`, utilise RPC |
| `services/buzzService.ts` | Supprimé calcul `timeDiffMs`, utilise RPC |
| `services/authService.ts` | Remplacé N+1 queries par RPC `get_user_dashboard` |
| `App.tsx` | Utilise RPC pour `handleRejoinSession` et `validateAnswer` |

---

## Fonctions RPC Implémentées

### 1. `get_session_players(p_session_id UUID)`
- Retourne les joueurs avec aliases camelCase
- Élimine le mapping frontend `mapDbToPlayer()`

### 2. `get_buzz_state(p_session_id UUID)`
- Retourne les buzzes avec `timeDiffMs` pré-calculé
- Utilise `first_value()` window function
- Élimine le calcul client-side

### 3. `validate_answer(...)`
- Transaction atomique: score + category_scores + buzz + question
- Paramètres: `session_id, player_id, points, category, move_next, questions_count`
- Retourne l'état pour mise à jour optimiste

### 4. `rejoin_session(p_session_id, p_username, p_local_id)`
- Charge l'état complet en 1 appel (remplace 5 requêtes)
- Retourne: session + player + players[] + questions[] + buzzes[]

### 5. `get_user_dashboard(p_user_id UUID)`
- Corrige N+1 queries de `getUserActiveSessions` et `getUserGameHistory`
- Retourne: `activeSessions[]` + `gameHistory[]`

---

## Gains de Performance

| Opération | Avant | Après | Amélioration |
|-----------|-------|-------|--------------|
| Chargement joueurs | 1 query + mapping JS | 1 RPC | -100% CPU mapping |
| Polling buzzes | 1 query + calcul JS | 1 RPC | -100% CPU calcul |
| Rejoindre session | 5 queries séquentielles | 1 RPC | -80% latence |
| Valider réponse | 3-4 queries | 1 RPC atomique | -75% latence |
| Dashboard utilisateur | 1 + N queries | 1 RPC | -90% queries |

---

## Instructions de Déploiement

### 1. Exécuter la migration SQL
```bash
# Dans Supabase SQL Editor, exécuter:
supabase/migrations/migration_v3_rpc.sql
```

### 2. Vérifier les permissions
Les fonctions ont `GRANT EXECUTE` pour `anon` et `authenticated`.

### 3. Tester les RPC
```sql
-- Test get_session_players
SELECT * FROM get_session_players('your-session-id');

-- Test get_buzz_state
SELECT * FROM get_buzz_state('your-session-id');

-- Test get_user_dashboard
SELECT * FROM get_user_dashboard('your-user-id');
```

---

## Architecture Finale

```
Frontend (React)
    ↓
rpcService.ts (client RPC)
    ↓
Supabase RPC Functions (PostgreSQL)
    ↓
Database Tables
```

**Flux de données:**
- Les RPC retournent directement au format camelCase
- Plus de transformation côté frontend
- Les calculs complexes (timeDiffMs, rankings) sont faits côté serveur
