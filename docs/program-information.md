# Program information: landing page and member library

What visitors and members can read and download about the Safe Card program, where it lives in the code, and what still needs PRC's confirmation.

## What is on screen

| Where | Who | What |
|---|---|---|
| Landing page `/` | Everyone | What you get, what is covered, what to do after an accident, the existing "how it works" steps, questions (search), downloads |
| `/api/documents/program-overview` | Everyone | Program Overview PDF (download, or `?view=1` to open in the browser) |
| `/api/documents/faqs` | Everyone | FAQ brochure PDF |
| `/member/library` | Signed-in members | Library home |
| `/member/library/guide` | Signed-in members | Member Guide 2026 as a reading page, section by section |
| `/member/library/faq` | Signed-in members | The same questions as the landing page |
| `/api/documents/member-guide` | Signed-in members | Member Guide PDF. Without a member session the answer is 401 |

The landing page sections are the on-screen version of the Program Overview. The Member Guide is not offered on the public page.

## Where things live

- `src/lib/education/content.ts`: bilingual landing and library text, the 13 FAQ entries.
- `src/lib/education/guide.ts`: the Member Guide as reading text, sections 01 to 11.
- `src/lib/documents/registry.ts`: the three PDFs, each pinned by size, page count and SHA-256.
- `content/documents/*.pdf`: the files. Not under `public/`, so they are only served through the route.
- `src/app/api/documents/[slug]/route.ts`: serves them; checks the member session for the guide.
- `public/images/education/*.webp`: card, ambulance, blood-bag and document thumbnails, taken from the PRC PDFs.
- `src/components/education/*` and `src/components/member/*`: the components. Styles are in `education.css`.

### Replacing a document

1. Put the new PDF in `content/documents/`.
2. Update that document's entry in `registry.ts` (file, size, page count, SHA-256). `shasum -a 256 file.pdf` and `ls -l` give the values.
3. If the text changed, update `content.ts` or `guide.ts` and the page references in `guide.ts`.
4. Run `npm test`. `documents.test.ts` fails if a file and its entry disagree.

Keep each PDF under 4.5 MB: a Vercel function cannot return a larger body. The FAQ brochure was 7.4 MB and was recompressed to 2.7 MB with no change to its text (images downsampled to about 110 dpi).

## Conflicts in the source documents

These were found while transcribing. The site follows the choice in the last column. PRC should confirm each one.

| # | Where | Conflict | What the site does |
|---|---|---|---|
| 1 | Guide footers vs. FAQ and guide trunkline | Safe Card telephone printed as `(+63 2) 790-2300 loc. 184` and as `(+632) 8790-2300 local 184` | Uses `8790-2300` |
| 2 | Guide vs. FAQ | Claims email: `maabclaims@` (FAQ, guide contacts), `membershipclaims@` (guide step 1), `membershipbclaims@` (last page) | Landing and FAQ use `maabclaims@`. The guide reader keeps `membershipclaims@` in step 1 as printed and drops the last-page variant, which is not an address |
| 3 | Guide matrix vs. guide checklist and Overview | The matrix shows no Hospital Daily Allowance for sickness, but the checklist has a claim type for natural illness and the Overview lists "Sickness (Daily Hospital Allowance)" | Landing makes no claim about sickness allowance. The reader reproduces the matrix as printed |
| 4 | Overview vs. guide | Ambulance and blood "available to 80 locations" vs. 102 chapters and 138 ambulances | Landing says availability depends on location; it names no number |
| 5 | Overview vs. brochure | "Free" ambulance and blood | The site never says "free". It says "included for accidents, depends on availability" |
| 6 | Guide | Notification "within 30 days of the accident" in step 1, "from the date of discharge, as applicable" in the member undertakings | Landing says 30 days from the accident; the reader shows both texts |

## Needs approval before wide use

- **Filipino text** is a translation draft. English is the reference. It must be reviewed and approved by PRC.
- **Images**: the card front and back, ambulance, blood bag, the protected-member graphic and the document thumbnails come from PRC's PDFs. Confirm PRC allows their use here.
- **Publishing the PDFs**: confirm PRC allows redistribution of the three documents from this site.
- **Staff contacts**: guide pages 50 to 59 list named chapter contacts and mobile numbers. They are in the PDF a member can download, not on any page of this site. Confirm that is acceptable.

## Not built yet

- **Chapter finder.** The directory in the guide (pages 25 to 59) has three differently shaped tables with wrapped email addresses and broken coordinates. Turning it into searchable data needs a PRC-verified list. The reader links to the PDF page instead.
- **Document registry in the database** with approval and version history, as the benefit content has. The registry is in code for now.
- **Present mode** for ambassadors.

## Notes for operators

- `proxy.ts` sets `Cache-Control: no-store` on every response, so the PDFs are not cached by the CDN. Each download runs the function once. The first request after a deploy reads and hashes the file; later ones reuse the bytes in memory.
- A file that no longer matches its registry entry is never served: the route answers 503.
- The landing page no longer loads the governed benefit content. `/benefits` still does, and the landing links to it ("See how each benefit works in real situations").

## Tests

```bash
npm test                                          # unit: content, translations, amounts, documents, route
npm run test:e2e -- tests/e2e/education.spec.ts   # Chromium, Firefox, Safari, Pixel 5, iPhone 13
E2E_ALL_DEVICES=1 npm run test:e2e -- tests/e2e/education.spec.ts   # adds 8 more screens (see below)
```

The member tests need `MEMBER_SESSION_SECRET` set for the test server and the test runner (CI sets it).

The education spec checks for sideways scrolling, touch-target size, image loading and serious accessibility violations, in English and Filipino, light and dark. By default it sweeps widths 320, 390, 768, 1024 and 1440px so the CI job stays short. With `E2E_ALL_DEVICES=1` it sweeps 12 widths from 320 to 1920px and also runs on iPad, iPad Pro, an Android tablet, iPhone SE and 14 Pro Max, Galaxy S9+, Pixel 7 and a 1920px desktop. Run that before a release; it takes several minutes more.
