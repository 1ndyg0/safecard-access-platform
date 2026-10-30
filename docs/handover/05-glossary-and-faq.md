# Glossary and FAQ

*Plain-language meanings for every technical word in this pack, and answers to questions a newcomer usually asks.*

## Glossary

### The product

| Word | Plain meaning |
|---|---|
| **Safe Card** | The one-year Philippine Red Cross membership (₱1,200, ages 3 to 85). |
| **PRC** | Philippine Red Cross. Runs the program. **Not** the insurer. |
| **PGAI** | Prudential Guarantee and Assurance Inc., the insurance company that pays approved claims. |
| **MAAB** | The name the program documents give to the accident insurance part of the benefit that PGAI underwrites. |
| **Application** | A person’s request to join, with their details and proof of payment. |
| **Application reference** | The code like `SC-2026-XXXXXXXX` that identifies one application. |
| **Complete application** | One with details submitted **and** a proof of payment uploaded. Only these reach the administrators. |
| **Proof of payment / receipt** | The photo or PDF that shows the person paid ₱1,200. |
| **Approve / Reject** | The two decisions an administrator can make. Approving also verifies the payment. |
| **Member** | Someone whose application was approved (or who signs in to check theirs). |
| **Campaign** | A named group of applications with its own limit and rules, such as “Safe Card Pilot 2026”. |
| **Pilot** | A small, careful first run before opening to many people. |
| **Hypercare** | The extra-close watching right after launch. |
| **Consent** | The person’s clear “yes, you may use my information for this”. |
| **Gift card** | A friendly picture and message made in Christmas mode. It carries no payment and no private data. |

### The people and roles

| Word | Plain meaning |
|---|---|
| **Owner** | The person who decides, and the only one who deploys to the live website. |
| **Administrator** | Staff who review applications. |
| **Role** | A set of permissions given to a staff account, such as `school_admin`. |
| **Reviewer** | An administrator doing application reviews. |

### The technology

| Word | Plain meaning |
|---|---|
| **Website / web app** | A program you use in a browser. |
| **Frontend** | The part you see and touch (screens, buttons). |
| **Backend / server** | The hidden part that checks rules and talks to the database. |
| **API** | A set of addresses (such as `/api/admin/cases`) where the frontend asks the backend to do things. Like a restaurant’s order window. |
| **Route** | One address in the app, for example `/apply`. |
| **Framework** | A ready-made toolbox for building apps. We use **Next.js**. |
| **Next.js** | The framework that builds our pages and server programs. This version has breaking changes from older ones. |
| **React** | The library that draws screens from small reusable pieces called **components**. |
| **TypeScript** | JavaScript with labels (“types”) that catch mistakes early. |
| **Node.js** | The program that runs JavaScript on your computer or a server. |
| **npm** | The tool that installs ingredients (called packages) and runs the project’s commands. |
| **Terminal** | A text window where you type commands. |
| **Repository (“repo”)** | The project folder plus its full history, stored on GitHub. |
| **Git** | The tool that records every change to the code. |
| **GitHub** | The website where the repository lives and changes are reviewed. |
| **Branch** | A separate copy of the code to work on safely. `main` is the official one. |
| **Commit** | A saved, labelled set of changes. |
| **Pull request (PR)** | A request to merge a branch into `main`, with review and automatic checks. |
| **Merge** | Combining a branch into `main`. |
| **CI (continuous integration)** | Automatic checks that run on every pull request. |
| **Deploy** | Publishing a version of the site so the public can use it. |
| **Vercel** | The company that hosts (runs) our website. |
| **Production (“prod”)** | The real, live website. |
| **Preview** | A temporary copy of the site made for testing a change. |
| **Rollback** | Going back to the previous good version of the code. |
| **Supabase** | Our database, sign-in system and private file storage. |
| **Database** | A very organised collection of tables, like linked spreadsheets. |
| **Table / row** | A table is one spreadsheet; a row is one entry in it. |
| **SQL** | The language used to ask a database questions or change it. |
| **Migration** | A numbered file that changes the database’s structure. They run in order and never go backwards. |
| **Seed data** | Fake sample rows used only for practice. **Never** put it in production. |
| **Bucket** | A folder-like container for stored files (our private receipt vault). |
| **Signed link** | A web address that works only for a short time and only for the person it was made for. |
| **Environment variable** | A named setting the app reads when it starts. |
| **Secret / key** | A setting that must stay private, like a password. |
| **`NEXT_PUBLIC_…`** | A prefix meaning “sent to every visitor’s browser”. Never put a secret here. |
| **Synthetic mode** | Practice mode with fake data. The safe default. |
| **Live mode** | The mode that accepts real people’s data. Needs every safety switch on. |
| **Fail closed** | If unsure, refuse. The app never falls back to practice data when live settings are wrong. |
| **Audit log** | A permanent record of who did what and when. It cannot be edited. |
| **Append-only** | Data you can add to but never change or delete. |
| **Rate limiting** | Slowing down someone who sends too many requests. |
| **Session** | The time you stay signed in (30 minutes for members). |
| **Cookie** | A tiny note your browser keeps to remember you are signed in. |
| **Content Security Policy (CSP)** | A rule telling the browser which places a page may load things from. It blocks many attacks. |
| **Accessibility (a11y)** | Making the site usable by everyone, including people using screen readers or only a keyboard. |
| **axe** | A tool that finds accessibility problems automatically. |
| **Test** | A small program that checks another program behaves correctly. |
| **Unit test (Vitest)** | A fast test of one small piece of logic. |
| **End-to-end test (Playwright)** | A robot browser that clicks through the site like a person. |
| **Lint** | An automatic spell-checker for code style and common mistakes. |
| **Build** | Turning the code into the finished website files. |
| **Dev server** | A copy of the site running on your own computer for development. |
| **Dark mode** | A dark colour theme the site follows automatically if your device uses it. |

---

## FAQ

### About the product

**Is SafeCard the insurance?**
No. The Philippine Red Cross runs Safe Card, and Prudential Guarantee and Assurance Inc. is the insurer. SafeCard (this website) explains, takes applications and shows status.

**Does the website take the money?**
No. People pay with their own bank or e-wallet using the official details shown, then upload their receipt. An administrator checks the receipt.

**Does approval happen automatically?**
No. A human administrator approves or rejects every application.

**What if someone does not want to apply?**
That is a normal, welcome choice. The flow lets them stop at the decision step, and nothing is kept.

**Why can’t I just skip the quiz or the consent?**
They are deliberate safety steps so nobody pays for something they misunderstood, and nobody’s details are collected without permission.

**Why is the site in Filipino first?**
Most visitors are Filipino speakers. English is one tap away (EN), and the site remembers the choice.

### About running it

**I broke something. Is it permanent?**
Almost certainly not. Code changes live on branches and can be undone. The live site only changes when the owner deploys. Stopping the site is reversible. Only deleting data is not, which is why we never delete.

**Can I try things safely?**
Yes: run the site on your own computer in practice mode (`NEXT_PUBLIC_DATA_MODE=synthetic`). Nothing you do there touches real people.

**What is the difference between `main` and a branch?**
`main` is the official version of the code. A branch is your own working copy. Only after checks pass and a person approves does your branch become part of `main`.

**Why can’t I deploy even if I merged my change?**
Merging puts the change in `main`. Publishing to the live website is a separate step that only the owner does, from their own Vercel account, after saying a clear “yes”.

**Where do I find a piece of text I see on the site?**
Search the project for a few words of it. Public wording is mostly in `src/lib/education/content.ts`, `src/lib/public-content.ts` and `src/lib/seasonal/copy.ts`.

**Why does the project warn me about “a different Next.js”?**
Because this version of Next.js changed several rules. Guessing from older knowledge can break things. Read the guides in `node_modules/next/dist/docs/` first.

**Which Supabase project is the live one?**
Not settled in the documents (two IDs appear). The owner confirms; see [the technical handover](03-technical-handover.md#6-the-database-supabase).

### About Christmas mode

**When does it appear?**
Automatically from 15 November 2026 to the end of 31 December 2026 (Philippine time). Preview any time with `?season=christmas`.

**How do I stop it right now?**
Set `NEXT_PUBLIC_SEASONAL_CAMPAIGN` to `off` in Vercel and redeploy. See [the Christmas guide](../christmas-mode.md).

**Does it change the real application?**
No. It adds a gift band, a few pages, a card maker and light decoration. The application, consent, payment and review steps are unchanged, and the payment step is never decorated.

**Does it store the names people type on a gift card?**
No. The card is drawn in the visitor’s own browser. Nothing is sent to our server or saved.

### If you are worried

**I think I did something wrong.**
Tell the owner now, with the application reference if there is one. Mistakes caught early are cheap. Hidden mistakes are expensive.

**I think I saw something I should not have.**
Close it, do not copy or share it, and tell the owner. See the runbooks in [document 4](04-hypercare-and-runbooks.md#7-runbooks).

**I do not understand a step.**
Ask. Asking is a sign of care, not weakness.
