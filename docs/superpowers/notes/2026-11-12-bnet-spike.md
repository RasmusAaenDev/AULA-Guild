# Spike: Battle.net-login og `/profile/user/wow` (2026-11-12)

**Afgørelse: A.** Brugerens egne WoW Forever-karakterer kan hentes fra Battle.net-kontoen, så ejerskab kan verificeres automatisk. Officer-bekræftelse (gren B) er ikke nødvendig.

## Login
- Auth.js `next-auth/providers/battlenet`, `issuer: 'https://oauth.battle.net'`, scope `openid wow.profile`.
- Kræver `checks: ['pkce', 'state', 'nonce']`. Uden `nonce` fejler callback med `unexpected ID Token "nonce" claim value`.
- `https://oauth.battle.net/userinfo` giver `{ sub, id, battletag }` (`sub` = `id` = numerisk Battle.net-id, `battletag` fx `Navn#1234`).
- Klienten er den eksisterende Blizzard-klient (`BLIZZARD_CLIENT_ID/SECRET`); redirect-adresserne `…/api/auth/callback/battlenet` er registreret for localhost og dev.

## Karakterer
`GET https://eu.api.blizzard.com/profile/user/wow?namespace=profile-forever-eu&locale=en_GB` med brugerens `access_token` (Bearer) → 200.

Format (felter der bruges):
```
{ id, wow_accounts: [ { id, characters: [ {
    character: { href: ".../profile/wow/character/<slug>?namespace=profile-forever-eu" },
    name: "Magi",            // fornavn
    surname: "Far",          // efternavn (kun Forever)
    id: 3015008,             // = characters.blizzard_id
    playable_class: { name: "Mage", id: 8 },
    playable_race: { name, id },
    faction: { type, name },
    level: 20
} ] } ] }
```
- Slug skal tages fra `character.href` (`magi-far`); der er ingen `realm` på Forever-karakterer.
- Andre namespaces returnerer også brugerens karakterer (`profile-classic1x-eu`, `profile-eu`); `profile-classic-eu` giver 404. Kun `profile-forever-eu` bruges.
- Svaret kan indeholde karakterer med level 1 og karakterer, der ikke findes i guilden; filtrering mod roster sker i appen.
