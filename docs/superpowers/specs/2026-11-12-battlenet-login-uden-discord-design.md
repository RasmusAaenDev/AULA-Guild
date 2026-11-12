# Battle.net-login i stedet for Discord

Status: udkast til godkendelse (2026-11-12). Intet er bygget.

## Mål

Brugere logger ind med Battle.net. Discord droppes helt: login, medlemskabstjek, bot, og alle Discord-kanaler i Beskeder. Kun «egne kanaler» er tilbage.

## Beslutninger (fra brugeren)

1. Alle med en Battle.net-konto må logge ind.
2. Officer afgøres efter guild-rang.
3. Alle starter forfra: ingen kobling mellem gamle (Discord-)brugere og nye.
4. Alt Discord-indhold og al Discord-forbindelse fjernes. Egne kanaler og deres beskeder bevares.
5. Karakterejerskab verificeres via brugerens egne karakterer på Battle.net-kontoen (`/profile/user/wow`).
6. Alle indloggede må se og tilmelde sig events, opslag, kalender og kontakter.
7. SimC (Skolehjem), Galleri og Filer kræver, at brugeren er i guilden.

## Begreber

- **Verificeret karakter:** står på brugerens egen Battle.net-konto (svar fra `/profile/user/wow` med brugerens OAuth-token).
- **I guilden (medlem):** brugeren har mindst én verificeret karakter med `inGuild = true`.
- **Officer:** brugeren har en verificeret karakter i guilden med `guildRank <= OFFICER_MAX_RANK`. Standard er 1 (guildmester og rang 1), sat via miljøvariablen `OFFICER_MAX_RANK`. Rangen kommer fra roster-synkroniseringen, der allerede gemmer `guildRank`.
- **Gæst:** indlogget bruger uden verificeret karakter i guilden.

## Login og session

- Auth.js-provider `battlenet` (region EU), scopes `openid wow.profile`.
- Brugertabellen: `discord_id` erstattes af `battlenet_id` (unik) og `battletag`. Migration nulstiller brugerrelaterede rækker (alle starter forfra). Opslag, kommentarer og chatbeskeder bevarer forfatternavnet som tekst (de har allerede `authorName`), men mister ejer-koblingen. RSVP'er, bogmærker, læsninger og aktive karakter slettes.
- Medlemskab og officer afgøres i `jwt`-callbacken ved login og genberegnes ved hver revalidering (hvert 10. minut, som i dag) ud fra databasen (ikke fra et eksternt kald), så sessionen kan være 30 dage uden bot-token.
- Brugerens Battle.net-token bruges kun ved login (og ved «opdater mine karakterer»); det gemmes ikke.

## Karakterer

- Efter login synkroniseres brugerens karakterer fra `/profile/user/wow`, filtreret til WoW Forever (EU), og knyttes til brugeren som verificerede.
- Den eksisterende «tilføj karakter» (fri tekst) beholdes til karakterer, der ikke kan verificeres; de er uverificerede, tæller ikke til medlemskab eller officer-rang, og markeres tydeligt.
- **Åbent spørgsmål, der testes først (spike):** om `/profile/user/wow` leverer WoW Forever-karakterer. Hvis ikke, falder verificeringen tilbage til: en officer bekræfter koblingen bruger→karakter med ét klik (siden for afventende bekræftelser). Spiken afgør, hvilken vej planen tager, før resten bygges.

## Adgang pr. område

| Område | Gæst | I guilden | Officer |
|---|---|---|---|
| Overblik, kalender, opslag, kontakter | læse | læse + skrive | + moderere |
| Tilmelde sig events (RSVP) | ja | ja | ja |
| Skolehjem (SimC) | nej (venteside) | ja | ja |
| Galleri | nej | ja | ja |
| Filer | nej | ja | ja |
| Egne kanaler (Beskeder) | ja | ja | + slette kanaler |
| Officer-sider (roster, godkendelser) | nej | nej | ja |

Gæster, der åbner et lukket område, får en forklaring og en vej videre: «Tilføj/bekræft din karakter i guilden».

## Beskeder

Discord-kanalerne rio, wow-news og wow, chat-klienten, bot-posting, `[Aula]`-præfikset og oversættelsen af Discord-navne fjernes. Egne kanaler og deres beskeder beholdes. Overblikkets chatkort viser kun egne kanaler. `lib/chat.ts` (Discord-klient, ~470 linjer), `chat-send`, `chat-config`, `discord-access`, `access-revalidate` (Discord-delen) og `tests/discord-fake.ts` udgår.

## Konfiguration

- Fjernes: `AUTH_DISCORD_ID`, `AUTH_DISCORD_SECRET`, `DISCORD_*`.
- Tilføjes: `AUTH_BATTLENET_ID`, `AUTH_BATTLENET_SECRET` (kan være de eksisterende `BLIZZARD_CLIENT_*`), `OFFICER_MAX_RANK`.
- Brugeren registrerer redirect-adresserne `https://aula-forever.dk/api/auth/callback/battlenet` og dev-adressen hos Blizzard.
- Prod-stacken i `/srv/stacks` og README opdateres.

## Test

- Enhedstests for: afledning af medlem/officer fra verificerede karakterer og rang, adgangstabellen, migrationen, karakter-synkronisering fra Battle.net (med fake Blizzard-klient).
- Eksisterende Discord-tests fjernes eller omskrives.
- Playwright-tjek af gæst, medlem og officer med mintede sessioner, desktop og mobil.

## Udrulning

1. Spike: test `/profile/user/wow` mod WoW Forever med et rigtigt login.
2. Byg på en gren, test på dev (`dev.aaensoftware.com`).
3. Før prod-skiftet: Blizzard-redirects registreret, env sat, migration kørt. Alle skal logge ind igen og starte forfra; jeg meddeler det til brugeren før udrulning.

## Risici

- Spiken kan vise, at Forever-karakterer ikke er tilgængelige via kontoen; så bruges officer-bekræftelse (se ovenfor).
- Åben adgang betyder, at alle med Battle.net kan se oversigten og tilmelde sig events. Det er valgt.
- Sletning af brugerrækker er uigenkaldelig; der tages et databasedump forud.
