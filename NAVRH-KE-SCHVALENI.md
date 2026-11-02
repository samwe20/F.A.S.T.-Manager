# F.A.S.T Manager — Schváleno & implementováno

> **F**inally **A**wesome and **S**imple **T**ask Manager  
> Task manager s outlinerem a **supertagy** — inspirace [Tana](https://tana.inc), ale jednodušeji.

## Schválené požadavky ✓

| Požadavek | Stav |
|---|---|
| Název: F.A.S.T Manager | ✓ |
| Full implementace | ✓ |
| Sync hned | ✓ (REST + WebSocket server) |
| Čeština + angličtina | ✓ |
| Supertagy Task/Question/Inform + další | ✓ (10 typů) |
| Přepínatelný vzhled | ✓ (light/dark/system) |
| Open source (MIT) | ✓ |
| Web + Windows paralelně | ✓ (PWA + Tauri) |

Spusťte viz [README.md](./README.md).

---

## Název a positioning

| | |
|---|---|
| **Název** | F.A.S.T Manager |
| **Rozbalený** | Finally Awesome and Simple Task Manager |
| **Zkratka v UI** | FAST |
| **Filozofie** | Síla supertagů z Tany, bez složitosti — rychlé zachycení úkolů, přehledné seznamy, minimum klikání |

---

## Co jsou supertagy?

Supertag není jen štítek — je to **typ entity** s vlastními poli a chováním.

| Klasický tag | Supertag |
|---|---|
| `#úkol` — jen text | `#Task` — má Termín, Prioritu, Stav, Přiřazeno |
| Ruční formátování | Automatická pole v pravém panelu |
| Statický seznam | Live dotazy: „všechny #Task kde termín < dnes" |

**Příklad:** Napíšete „Volat Jana" a přidáte `#Task` + `#Person`. F.A.S.T Manager automaticky zobrazí pole Termín, Priorita, Stav — a u `#Person` jméno, email, firma.

---

## Mockupy obrazovek

### 1. Hlavní workspace

<img alt="Hlavní workspace" src="/opt/cursor/artifacts/assets/fast-mockup-main-workspace.png" />

- **Levý panel:** Dnes, Inbox, projekty, uložené dotazy
- **Střed:** outliner s hierarchií úkolů, supertagy jako barevné pilulky
- **Pravý panel:** pole vybraného supertagu (dynamicky podle definice)

### 2. Editor supertagu

<img alt="Editor supertagu" src="/opt/cursor/artifacts/assets/fast-mockup-supertag-editor.png" />

- Definice názvu, barvy, ikony
- Tabulka polí: název, typ (Text / Datum / Výběr / Číslo / Reference), povinnost, výchozí hodnota
- Náhled, jak uzel s tímto supertagem vypadá

### 3. Live dotazy

<img alt="Live dotazy" src="/opt/cursor/artifacts/assets/fast-mockup-live-query.png" />

- Vizuální query builder (WHERE / AND / SORT BY)
- Výsledky v tabulce nebo kartách
- Uložené dotazy v sidebaru — automaticky se aktualizují

### Interaktivní mockupy

Otevřete v prohlížeči: `fast-manager/mockups/index.html`  
(Přepínání mezi 5 obrazovkami pomocí záložek nahoře.)

---

## Funkcionality podle fází

### Fáze 1 — MVP (doporučeno na start)

| Funkce | Popis |
|---|---|
| Outliner | Hierarchické uzly, Tab/Shift+Tab odsazení, drag & drop |
| Supertagy | Vytváření, editace, přiřazování k uzlům |
| Typy polí | Text, Datum, Výběr (enum), Číslo, Checkbox |
| Panel polí | Pravý panel reaguje na vybraný uzel a jeho supertagy |
| Denní poznámky | Auto-vytvoření `#DailyNote` pro dnešní datum |
| Inbox + Dnes | Rychlé zachycení úkolů, denní přehled |
| Local-first | Data lokálně (IndexedDB web / SQLite Windows) |
| Web PWA | Instalovatelná, funguje offline |
| Windows app | Tauri wrapper, nativní .exe |
| Témata | Tmavý + světlý režim |

**Přednastavené supertagy:** `#Task`, `#Person`, `#Project`, `#DailyNote`, `#Note`

### Fáze 2 — Pokročilé supertagy

- Reference mezi uzly (`Přiřazeno → #Person`)
- Dědičnost (`#Entity` → `#Task` → `#Bug`)
- Šablony obsahu při vytvoření uzlu
- Live dotazy + vizuální builder
- Fulltextové vyhledávání
- Klávesové zkratky (`[[` pro reference, `#` pro supertag)

### Fáze 3 — Sync & kolaborace

- Sync mezi zařízeními (E2E šifrování)
- Sdílené pracovní prostory
- Historie změn, undo/redo tree
- Import/export (Markdown, JSON)

### Fáze 4 — Rozšíření

- Graf vztahů
- Kalendářní pohled
- AI asistent (auto-tagging, shrnutí)
- Plugin API
- Mobilní app

---

## Technická architektura

```
┌─────────────────────────────────────────────┐
│              React + TypeScript              │
│  (Outliner UI, Supertag editor, Queries)    │
├──────────────────┬──────────────────────────┤
│   Web (PWA)      │   Windows (Tauri 2)      │
│   IndexedDB      │   SQLite (native)        │
├──────────────────┴──────────────────────────┤
│         Shared business logic layer          │
│  (Node model, Supertag engine, Query eval)  │
└─────────────────────────────────────────────┘
                    ↕ (Fáze 3)
              Sync backend (E2E)
```

**Proč Tauri místo Electron:** ~5 MB vs. ~150 MB, nativní výkon, bez Chromium bundlingu.

**Proč local-first:** Okamžitá odezva, funguje offline, sync až ve Fázi 3.

---

## Srovnání s Tana

| Vlastnost | Tana | F.A.S.T Manager (návrh) |
|---|---|---|
| Outliner | ✓ | ✓ |
| Supertagy s poli | ✓ | ✓ |
| Live dotazy | ✓ | ✓ (Fáze 2) |
| Reference mezi uzly | ✓ | ✓ (Fáze 2) |
| Složitost | vysoká | **nízká — „simple" je v názvu** |
| Zaměření | univerzální PKM | **task manager first** |
| Offline | částečně | ✓ (local-first) |
| Windows desktop | ✗ (jen web) | ✓ (Tauri) |
| Self-hosted | ✗ | možné (Fáze 3) |
| Open source | ✗ | dle vašeho rozhodnutí |

---

## Otázky ke schválení

Název je **schválen**: F.A.S.T Manager ✓

Prosím potvrďte nebo upravte:

1. **Rozsah MVP** — stačí Fáze 1, nebo rovnou Fáze 1+2?
2. **Sync** — local-only na start, nebo sync hned?
3. **Jazyk UI** — čeština / angličtina / obojí?
4. **Přednastavené supertagy** — stačí `#Task`, `#Person`, `#Project`, `#DailyNote`, `#Note`?
5. **Vizuální styl** — tmavý (mockupy), světlý, nebo přepínatelný?
6. **Open source** — ano / ne / zatím ne?
7. **Priorita platforem** — nejdřív web, nebo web + Windows paralelně?

---

## Další krok po schválení

Po vašem schválení začnu implementovat MVP (Fáze 1):

1. Datový model + local storage
2. Outliner komponenta
3. Supertag engine (definice + pole)
4. Hlavní 3-panel layout
5. Web PWA
6. Windows Tauri build
