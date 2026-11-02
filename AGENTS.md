# Předávací prompt: F.A.S.T Manager

Jsi vývojář aplikace F.A.S.T Manager. Piš s uživatelem česky. UI aplikace je česky, druhý jazyk je angličtina. Neměň chování, které je níže popsané jako hotové, dokud o to uživatel výslovně nepožádá.

## Co to je

F.A.S.T Manager je lokální poznámková a úkolová aplikace. Mentální model je Capacities, ne Tana a ne složkový outliner.

Všechno je objekt právě jednoho typu. Typ určuje vlastnosti. Tělo objektu jsou bloky. Souvislosti vznikají odkazy `[[id]]` a `@`, ne stromem složek. Štítek (`#`) je samostatný objekt a lepí se napříč typy. Supertag v dnešním kódu znamená typ objektu, ne mřížku `#`.

Domov je dnešní denní poznámka. Po startu se otevře sama. Kalendář je týden. Klik na den otevře denní poznámku toho dne.

## První krok: nahraj kód do tohoto repozitáře

Repozitář https://github.com/samwe20/F.A.S.T.-Manager, větev main, je v tuto chvíli jen úvodní README (commit d973b743a248fb3a6e4ac423037c3a121132ccb9, 2. listopadu 2026, 22:24 času v Praze). Kód tu ještě není. Push z předchozího agenta GitHub odmítl, protože aplikace Cursor tehdy viděla jen samwe20/Personal.

Hotová verze je veřejně ve samwe20/Personal, větev cursor/daily-note-home-0f8e, commit 7c9c3c22bcec03f7271263d44d100659b8326fec. Ber jen tuhle větev. Výchozí větev Personal má starší fast-manager a nepoužívej ji. Pull request #28 v Personal není sloučený. Zveřejněný Windows instalátor latest tuto práci neobsahuje. Instalátor nevydávej a v Personal nic neslučuj ani nemaž.

Ve svém checkoutu tohoto repozitáře spusť:

```bash
git clone --depth 1 --branch cursor/daily-note-home-0f8e https://github.com/samwe20/Personal.git /tmp/personal-src
tar -C /tmp/personal-src/fast-manager \
  --exclude node_modules --exclude dist --exclude target --exclude .git \
  --exclude mockups/kontrast-3d.html \
  -cf - . | tar -xf -
```

Kořen tohoto repozitáře je bývalá složka fast-manager/. Aplikace je v app/, sync server v sync-server/. Hra Galactic Empire do migrace nepatří a nesaháš na ni. mockups/kontrast-3d.html je necommitnutá studie, nechej ji venku.

README z Personal popisuje starý Tana outliner. Nahraď README.md krátkým textem: nadpis F.A.S.T Manager, věta „Lokální poznámky a úkoly: jeden typ na objekt, bloky, odkazy a denní stránka.“, odkaz na AGENTS.md, příkazy cd app, npm install, npm run dev, a věta že aplikace běží na http://127.0.0.1:5173 a sync server je ve složce sync-server.

Tento předávací prompt ulož jako AGENTS.md. NAVRH-KE-SCHVALENI.md je starý návrh ve stylu Tana. Zdroj pravdy je kód a AGENTS.md.

Zkontroluj, že app/package.json existuje, commitni na main a pushni. V odpovědi uživateli uveď hash commitu. Teprve potom čti kód a navrhuj změny. Z Personal složku fast-manager neodstraňuj. To udělá agent v Personal, až uživatel potvrdí, že main tady obsahuje app/.

## Jak to spustit a ověřit

Aplikace je v app/. React 19, TypeScript, Vite, Zustand, Dexie, Tailwind 4, i18next. Obal pro Windows je Tauri 2, identifikátor com.fast.manager.

```bash
cd app
npm install
npm run dev
```

Otevři http://127.0.0.1:5173. Data jsou v IndexedDB fast-manager.

Kontroly:

```bash
npx tsc -b --pretty false
npx vitest run
```

Testy jsou v app/tests, mimo src, takže je tsc -b nekontroluje. Žádný jiný lint ani build krok pro běžnou práci není. npm run build je jen pro Tauri.

Volitelný sync server je sync-server na portu 3847. Výchozí režim je bez něj. Zapíná se v nastavení.

Linuxové prostředí neumí sestavit Windows exe. Cargo na tomto stroji neumí edition 2024. Instalátor staví Windows CI. Nevydávej release, dokud o něj uživatel výslovně nepožádá.

## Model dat

Databáze Dexie fast-manager, schéma verze 3. Tabulky: nodes, workspaces, queries, syncQueue, settings, objectTypes, collections, templates, media.

NodeRecord má jeden typeId. supertagIds je zrcadlo s jednou položkou kvůli starému kódu. legacySupertagIds drží původní seznam a nemaž ho. tagIds jsou id objektů typu štítek. fieldValues[typeId][key] jsou vlastnosti. blocks je tělo. content je zrcadlo nadpisu a bloků pro staré čtení.

Při startu ensureObjectModel zaseje vestavěné typy a staré uzly s víc supertagy převede: první supertag se stane typem, další se stanou štítky se stejným jménem.

Vestavěné typy ze src/data/supertags.ts a src/services/objectModel.ts: úkol, otázka, informace, osoba, projekt, denní poznámka, schůzka, rozhodnutí, nápad, poznámka, složka, štítek, obrázek, soubor, odkaz. Vlastní typ se zakládá ve studiu. Sync entita typu je supertag, kolekce collection, šablona template. applyRemoteChange je umí.

Vlastnost umí text, číslo, zaškrtnutí, datum, datum a čas, výběr (i víc hodnot), odkaz na objekt (i víc hodnot a obousměrně přes bidirectionalKey), obsah z bloků a obálku. Obsah se ukládá jako JSON bloků v řetězci. Obálka je blob:<id> v tabulce media. Binární přílohy se nesynchronizují.

createNode neslučuje výchozí vlastnosti, když dostane částečný fieldValues. Při založení objektu z řádku se nejdřív sloučí výchozí hodnoty a teprve potom se úkolu nastaví dueDate. Dělá to fieldsForLineObject. Výchozí stav úkolu je new.

## Jak se píše

Editor bloků umí odstavec, nadpis, odrážku, zaškrtnutí a citát. Kód, matematika, tabulka, sloupce a přepínač tam nejsou a nepřidávej je, dokud o ně není požádáno.

Lomítko může být na začátku bloku i uprostřed věty. Enter vezme celý řádek.

/úkol koupit mléko založí úkol s názvem „koupit mléko“ a text bloku se změní na [[id]].
/úkol bez zbytku založí úkol bez názvu.
/úkol pro /Frantu je v tom, že v projektu /Malostop je mnoho nejasností založí úkol, osobu a projekt. Název a text úkolu je ta věta bez úvodního typu, se jmény tak, jak jsou napsaná. Na denní poznámce se z řádku stane karta [[id]] úkolu. Osoba se zapíše do vlastnosti assignee, projekt do project. Jméno se hledá i ve skloňování, takže /Frantu najde už existující objekt Franta. Nové jméno bez vodítka je osoba a uloží se tak, jak je napsané. Slovo mezi lomítky, které je název typu, určí typ: „v projektu /Malostop“ založí projekt.
Shoda jde přes český název z i18n, anglický název a id typu. Diakritika se skládá.
Když předpona sedí na víc typů, Enter nezaloží nic.
Shoda na typ vyhraje nad shodou na druh bloku. Zaškrtávací blok se jmenuje „Zaškrtnutí“ / „Checkbox“, takže /úkol znamená typ úkol.
Štítek, složka a denní poznámka se lomítkem nezaloží.
Vznikne-li úkol z denní poznámky, dueDate je datum té poznámky.

# není supertag. Pod blokem je tlačítko štítku. #vesmír založí nebo znovu použije objekt typu štítek a přidá jeho id do tagIds bloku. Klik na štítek otevře stránku se všemi použitími.

@ a [[ na konci textu hledají existující objekt podle názvu a aliasu a vloží [[id]]. Když je odkaz celý blok, kreslí se jako karta. Když je uprostřed věty, zůstane text a pod ním je náhled. Na kartě po najetí jsou pohledy Znak, Karta a Široká. Volba je linkView na bloku. Znak je řádek s ikonou typu a názvem. Široká je orámovaná karta.

Samostatná URL vložená do prázdného bloku se stane objektem odkaz.

## Obrazovky, které uživatel chce tak, jak jsou

Postranní panel: Kalendář, Dnes, potom typy kromě štítku, složky a denní poznámky. U typu je jeho ikona, barva a počet. Dnes je zvýrazněné jen když je otevřená dnešní denní poznámka. Není tam plus u typů, sekce štítků, dotazy, kolekce, složky ani tlačítko rychlého zápisu. Stav synchronizace je vidět jen když je sync zapnutý. Dole je Nastavení a přepínač cs/en.

Horní lišta má hledání s textem t('actions.search'), zpět, vpřed, paletu a tlačítko široké stránky. Není tam blesk ani tlačítko nového objektu. Široká stránka je settings.wideLayout a stejná volba je i v nastavení. Výchozí čtecí sloupec má 720 px, široký 72 rem.

Denní poznámka: když se název rovná datu, nadpis je dlouhé datum a nad ním rok v barvě typu. Pod ním jsou otevřené úkoly s dueDate toho dne a stavem jiným než done. Pod nimi jsou otevřené zaškrtávací bloky z jiných objektů, které k tomu dni patří (vznikly ten den, nebo nějaká vlastnost datem začíná). Klik vede na zdroj. Datum denní poznámky je ve vlastnostech skryté, protože je to nadpis. „Projito“ je textový přepínač v řádku pod nadpisem. Aliasy, kolekce, export, smazání, zpětné odkazy a zmínky jsou ve skládačce „Další“ / „More“.

Pod úkoly jsou náhledy, nejvýš 12. Berou se objekty s názvem, obrázkem, odkazem nebo úryvkem. Denní poznámka, štítek, složka, smazané, aktuální poznámka a úkoly už vypsané nahoře se vynechají. Stejný den je první, pak updatedAt. Úryvek má nejvýš 4 řádky, holé [[id]] a řádek shodný s názvem se zahodí. Obrázek zabere dva sloupce.

Kalendář je po otevření týden. Klik na den volá openDaily. Denní poznámky se v seznamu dat neopakují. ISO názvy se formátují jako dlouhé datum. Dnešek je černý čtverec s bílým textem.

Ctrl+Shift+Space, Ctrl+N a příkazy palety pro dnešek, inbox a plánované otevřou dnešní poznámku. Paleta nemá novou složku, nový dokument ani uložené úkolové dotazy. Rychlý zápis je namontovaný, ale nemá viditelný vstup.

Nastavení: vzhled, jazyk, široká stránka, sync, vault. „Typy a šablony“ otevře studio. Složky, kolekce a dotazy jsou ve skládačce „Uspořádání“.

Zpět z objektu otevřeného z denní poznámky je jen o jednu úroveň (returnNodeId), potom na kalendář. Inbox, dnešek a plánované při návratu otevřou dnešek. Vyprázdnění hledání na pohledu hledání otevře dnešek.

Pohledy typu, kolekce a dotazu: seznam, tabulka, karty, kanban. Kanban potřebuje vlastnost typu výběr. Semínkové dotazy jsou Moje úkoly, Otevřené otázky a Po termínu.

## Vzhled

Světlý režim je bílý jako Capacities a Tana. Podklad stránky #fafafa, list #ffffff bez rámečku, lišta #f4f4f4, text #171717, tlumená #5f646c, linka #e7e7e7. Akcent pro fokus, odkazy a dnešek je černá #171717, ne modrá. V postranním panelu je barva typu jen na ikoně, název typu je černý. Na stránce objektu zůstává barva na názvu typu a malém štítku. Jasné barvy typu se pro text ztmaví nebo zesvětlí, dokud nemají kontrast aspoň 4,5:1 (labelInk). Malá tečka úkolu si nechává původní hex. Výchozí vzhled je světlý. Kdo měl nastavené „podle systému“ a ještě si vzhled sám nezvolil, po startu dostane světlý. Tmavý režim zůstává v nastavení.

Tmavý režim je neutrální šedá, ne fialový Obsidian. List #242426, podklad #1b1b1d.

Akční tlačítka s třídou bg-[var(--accent)] jsou černá #111111, text bílý, roh 2 px. V tmavém režimu jsou skoro černá s tenkým okrajem. Rohy tlačítek jsou 2 px i když Tailwind říká rounded-full. List má roh 4 px. Stín není.

Písmo nadpisů je Fraunces, UI je Source Sans 3. Importuj latin i latin-ext, čeština potřebuje obojí. Importy fontů jsou v index.css před Tailwindem.

Nepřidávej přepínač dalších témat. Nevracej zlaté pilulky, pásku, razítko, otočené lístečky ani teplý papír, dokud o to není požádáno.

## Vault

Složka na disku je trvalá kopie. IndexedDB je úložiště sezení. Když při startu existuje vault.json, naimportuje se. První propojení složky, která už vault.json má, se zeptá a pak nahradí místní poznámky. Prázdná složka vyexportuje současné poznámky. Každé obnovení zapisuje ven. Odpojení přestane zapisovat a soubory nemaže.

Ruční úprava markdownu pod frontmatterem se přepíše. Zdroj pravdy je JSON hlavička. Media bytes se do vaultu ukládají jako soubory vedle poznámky, ne jako sync binárka.

V prohlížeči bez File System Access API může nastavení ukázat handle.queryPermission is not a function. To je limit prohlížeče, ne chyba palety.

## Co záměrně není

AI, whiteboard, čtečka PDF, OCR, graf znalostí, kódový blok, matematika, tabulka, sloupce, WhatsApp a e-mail, sdílené prostory, verzování v cloudu. Graf byl v plánu později a pořád není. Nepřidávej ho sám od sebe.

Nepřepisuj editor na contenteditable. Nepouštěj víc typů na jeden objekt. Neslučuj # štítek s typem.

## Mapa souborů

- app/src/store/appStore.ts — stav, start, navigace, příkazy
- app/src/services/objectModel.ts — typy, migrace, odkazy vlastností, export
- app/src/services/dataService.ts — Dexie, seed, sync apply
- app/src/data/supertags.ts — vestavěné typy a fieldsForLineObject
- app/src/utils/blocks.ts — lomítko, bloky, [[id]]
- app/src/utils/nodeUtils.ts — náhledy, zpětné odkazy, úkoly dne
- app/src/components/ObjectPage.tsx — stránka objektu a denní poznámka
- app/src/components/BlockEditor.tsx — psaní, lomítko, #, @
- app/src/components/Sidebar.tsx, CalendarView.tsx, SettingsPanel.tsx, TypeStudio.tsx
- app/src/services/vault*.ts — vault
- app/src/index.css — barvy a tvary

## Ověření po importu

Přečti app/src/components/ObjectPage.tsx, BlockEditor.tsx, app/src/store/appStore.ts a app/src/services/objectModel.ts. Ověř, že start otevře dnešní denní poznámku a že /úkol na jejím řádku založí úkol s termínem toho dne. Když starý návrh nesedí s tímto souborem, věř tomuto souboru a kódu.
