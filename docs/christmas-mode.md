# Christmas mode (campaign `christmas-2026`)

A marketing campaign: **“SafeCard is the gift of protection this Christmas.”** It adds a gift band to the home page, two gift pages, a card maker, and light decoration. **It is always on.** It has no date window and no switch. The rest of the app is unchanged.

## What it adds (and nothing else)

| Where | What appears |
|---|---|
| Every public page | A green strip with the apply-by date, string lights and a garland under the header, a **Gift** link in the menu, a small footer greeting, light snowfall |
| Home page | A **gift band** under the main banner (the original banner is untouched) |
| `/gift` | How gifting works in three steps, the apply-by notice, five questions and answers |
| `/gift/card` | The card maker: type two names, see the card, **Share**, **Download image**, or **Copy message** |
| `/apply?gift=1` | A friendly welcome panel on the first step only |
| Member card | A short seasonal greeting under the card |
| Application | A quiet garland on every step **except payment**, which is never decorated |

![The home page with the gift band](handover/images/41-christmas-band.png)

![The card maker](handover/images/42-christmas-card-maker.png)

## What it never does

- It does **not** change the application, consent, payment or review steps.
- It does **not** send or store the names typed into the card maker. The card is drawn in the visitor’s own browser. The shared link is `/apply?gift=1` and contains **no names**.
- It does **not** use cookies, local storage, or any new server route or database table.
- It does **not** pay for anyone, or apply for anyone.
- It does **not** use a QR code.
- It respects **reduced motion** (no snowfall, no twinkling) and works in light and dark mode, in English and Filipino.

## It is always on

There is no calendar, no setting and no web-address trick that turns it on or off. Every visitor sees it, on every deploy. The apply-by date, the campaign id and the entry link live in one file: [`src/lib/seasonal/christmas.ts`](../src/lib/seasonal/christmas.ts). The words (English and Filipino) live in [`src/lib/seasonal/copy.ts`](../src/lib/seasonal/copy.ts).

Anyone who opens `/apply?gift=1` gets the normal application with a friendly welcome on the first step.

Going back to the original look is a **separate request**. The steps below describe what that change would involve, so it can be done safely when it is asked for.

## Taking it down (only on a separate request)

Open a normal pull request that:

1. **Deletes these folders and files**
   - `src/lib/seasonal/` (constants, wording, gift-card text, unit tests)
   - `src/components/seasonal/` (components and `christmas.css`)
   - `src/app/gift/` (the two gift pages)
   - `public/seasonal/` (the four decoration images)
   - `tests/e2e/christmas.spec.ts`
2. **Removes the few mount points.** Find them all with:
   ```bash
   grep -rn "SEASONAL:christmas-2026" src
   ```
   Each hit is one import or one line to delete: the CSS import in `src/app/layout.tsx`, `SiteHeader.tsx`, `PublicFooter.tsx`, `LandingExperience.tsx`, `ApplicationWizard.tsx`, and `src/app/member/card/page.tsx`.
3. **Passes the normal checks** (lint, typecheck, unit tests, build, browser tests), then ships like any other change.

Nothing in the database or storage needs cleaning up, because the campaign never created anything there.

## How it was tested

- **Unit tests** (`src/lib/seasonal/*.test.ts`): gift-card text, name cleaning and message wording.
- **Browser tests** (`tests/e2e/christmas.spec.ts`), on Chrome, Firefox, Safari and two phone sizes:
  - the page: band, strip, links and the original banner all present; the gift welcome only with `?gift=1`; the payment step never decorated; reduced motion honoured;
  - card maker: the card changes with the names; angle brackets and control characters never reach the card or message; names are capped; download gives a PNG; copy puts the right message on the clipboard; Share appears only where the browser supports it, shares an image plus text, and a closed share sheet is not an error; **no request is made to a server and nothing is stored**;
  - accessibility (axe) in English and Filipino, light and dark; no sideways scrolling at 320, 375 and 768 pixels; keyboard use.
- **Regression proof:** the entire pre-existing browser suite was run with the campaign on, to prove existing features behave the same.

## Decisions to know about

- **No QR code.** The earlier design showed one; the project removed its QR dependency, and a link is simpler and just as shareable.
- **No giver name in the link or the member card.** Carrying a name would mean storing or transmitting personal data. The member greeting is generic.
- **The gift band is added under the hero, not instead of it,** so the real hero, its tests and its wording are untouched.
