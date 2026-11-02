# F.A.S.T Manager — Mockupy

Aktuální UI mockupy odpovídají implementované aplikaci (PR #8 + #9).

## Interaktivní mockupy (HTML)

Otevřete v prohlížeči:

```
fast-manager/mockups/index.html
```

6 obrazovek s přepínáním záložek:

1. **Hlavní workspace** — sidebar, TopBar, outliner, panel polí
2. **Quick capture** — Ctrl+Shift+Space
3. **Command palette** — Ctrl+K
4. **Panel + reference** — picker, backlinks
5. **Onboarding** — uvítací průvodce
6. **Klávesové zkratky** — přehled

## Vizuální mockupy (PNG)

### Hlavní workspace

![Workspace](/opt/cursor/artifacts/assets/fast-mockup-workspace-v2.png)

### Quick capture

![Quick Capture](/opt/cursor/artifacts/assets/fast-mockup-quick-capture.png)

### Command palette

![Command Palette](/opt/cursor/artifacts/assets/fast-mockup-command-palette.png)

### Onboarding

![Onboarding](/opt/cursor/artifacts/assets/fast-mockup-onboarding.png)

## Spuštění mockupů lokálně

```bash
cd fast-manager
python3 -m http.server 8080
# → http://localhost:8080/mockups/index.html
```

## Spuštění živé aplikace

```bash
cd fast-manager && npm run dev
# → http://localhost:5173
```
