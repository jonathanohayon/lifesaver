# Travailler à plusieurs sur ce dépôt

⚠️ **Plusieurs agents travaillent sur LIFE.SAVER en même temps, dans des terminaux séparés.**

Nous ne partageons **aucun contexte** : ni mémoire, ni fil de conversation, ni connaissance de ce que l'autre vient de faire. Le dépôt est notre seul canal de communication. Ce fichier est le protocole ; il est lu automatiquement par chaque session ouverte ici.

---

## 1. Réserver son périmètre AVANT d'écrire

Le tableau ci-dessous est la source de vérité. **Mets-le à jour dans ton premier commit**, pas à la fin.

| Espace / fichiers | Agent | Depuis | Sujet |
|---|---|---|---|
| _(libre)_ | — | — | — |

Écris ta ligne avec les **chemins réels** que tu vas modifier, pas un thème :

```
| apps/api/src/policy/**, apps/api/src/executor/** | terminal-A | 20/08 14:00 | garde-fous d'exécution |
```

Un périmètre réservé n'est **pas** une propriété morale : c'est un avertissement. Si tu dois absolument toucher un fichier réservé par un autre, **ne le fais pas en silence** — écris-le dans le tableau et signale-le dans ton message de commit.

### Le découpage naturel de ce dépôt

Trois espaces indépendants, c'est la ligne de fracture la moins coûteuse :

- `apps/web` — interface
- `apps/api` — back
- `apps/worker` — tâches planifiées

⚠️ **Les zones réellement dangereuses sont les fichiers partagés**, pas les espaces : `package.json`, `tsconfig.base.json`, `database/**` (migrations), et tout contrat d'API consommé des deux côtés. Deux agents qui y écrivent en même temps produisent un conflit à coup sûr. **Un seul agent à la fois sur une migration.**

---

## 2. Les règles qui évitent les dégâts

Elles ne sont pas théoriques : chacune vient d'un incident réel sur un projet voisin, le même jour.

**Commite et pousse souvent.** Le travail non commité est invisible pour l'autre — et c'est exactement ce qu'un `git rebase` lancé en face détruit. Un commit imparfait mais poussé vaut mieux qu'une heure de travail dans l'arbre.

**Ne rebase jamais sur un arbre sale.** Si `git status` n'est pas vide, tu casseras soit ton travail, soit celui d'en face. Commite d'abord.

**Avant toute opération d'historique** (`rebase`, `reset`, `stash`), vérifie qu'aucune n'est déjà en cours :

```bash
git status -s          # doit être vide
ls .git | grep -iE "rebase|MERGE_HEAD|CHERRY_PICK"   # doit ne rien rendre
```

Si une opération est en cours et qu'elle n'est pas la tienne : **arrête-toi**. La terminer à la place de l'autre détruit son travail.

**Ne lance pas deux suites de tests d'intégration en parallèle.** Elles partagent la même base et se tronquent mutuellement — tu obtiendras de faux échecs et tu chercheras un bug qui n'existe pas. Si un test échoue seul alors que tout le reste passe, **relance-le isolément avant de conclure**.

**Un fichier modifié sous tes pieds n'est pas forcément une erreur** — c'est peut-être l'autre agent. Regarde `git status` et le tableau ci-dessus avant de « nettoyer » quoi que ce soit. Ne supprime jamais un fichier non suivi que tu n'as pas créé.

---

## 3. Les messages de commit sont le vrai canal

C'est ce qui a le mieux fonctionné en pratique : quand un agent reprend après une interruption, il comprend l'état du projet en lisant `git log`, pas en devinant.

Écris donc **pourquoi**, pas seulement quoi :

- le problème observé, avec sa mesure quand il y en a une ;
- la décision prise **et les options écartées**, avec la raison ;
- les limites connues que tu n'as pas résolues — une limite documentée vaut mieux qu'un correctif qui déplace le problème.

Un message qui dit « corrige le bug » oblige l'autre agent à relire tout le diff. Un message qui dit ce qui a été mesuré lui fait gagner une heure.

---

## 4. Avant de te déclarer prêt

```bash
npm run lint
npm run build
```

Ce dépôt a **des centaines de scripts de test par phase** (`policy:*:test`, `executor:*:test`, `phase9:*` … `phase15:*`, `phase-mobile:*`, `phase-functional:*`). Lance **ceux de ton périmètre**, pas tout — et dis dans ton rapport lesquels tu as lancés.

⚠️ Si une commande échoue dans un fichier **hors de ton périmètre**, c'est probablement l'autre agent en pleine écriture : **signale-le, ne le corrige pas.** Vérifie que tes propres fichiers sont propres, et dis-le.

---

## 5. Quand tu as fini

Libère ta ligne dans le tableau, et laisse l'arbre propre. Si tu laisses du travail en cours, dis-le explicitement — dans le tableau et dans un commit — plutôt que de laisser des fichiers modifiés sans explication.
