# MedicStore: User Acceptance Tests

A checklist to walk through every flow of the live application before submission. Each test says what to do and what you should see; mark it **Pass**, **Fail** or **Skip** and note anything odd.

## How to use this document

**Priorities**

| Priority | Meaning | When to run |
|---|---|---|
| **P1** | What the brief asks for and what a reviewer will try first: the three pricing products, bundle maths, cart, admin changes reaching the storefront, the live link, mobile. A failure here is a blocker. | Always, all of them |
| **P2** | Important quality: filters and search in depth, validation, error and empty states, accounts and cart saving, Arabic. | Before submission if time allows |
| **P3** | Polish and edge cases: keyboard, rare errors, small visual details. | Optional |

**Views.** Every test names where to run it:

- **D**: desktop, a browser window at least 1280 px wide.
- **M**: mobile, a real phone or the browser's device mode at 360 to 390 px wide.
- **D+M**: run it on both. On mobile, check the layout fits the screen with no sideways scrolling and every button is reachable.

**Before you start**

| Item | Value |
|---|---|
| Live site | https://ncg-assessment-liard.vercel.app |
| Live API (health check) | https://ncg-assessment-production.up.railway.app/healthz |
| Admin account | The admin email and password you set on Railway (`FIRST_ADMIN_EMAIL`, `FIRST_ADMIN_PASSWORD`) |
| Customer account | A demo customer (password = `DEMO_PASSWORD` on Railway), or create one in test K-01 |
| Browser state | Start in a private window so no old cart or sign-in is carried over |

**Live test data.** These are the products the brief's examples map to. Prices are in KWD.

| Brief role | Product | Brand · Category | Offers (bundles) |
|---|---|---|---|
| **Product A**: one option | Elastic Crepe Bandages | Velmora Care · First Aid & Wound Care | 1 pack = 2.250 |
| **Product B**: two options | Medical Adhesive Tape | Velmora Care · First Aid & Wound Care | 1 pack = 1.250 · 6 packs = 6.500 (KWD 1.083 per pack) |
| **Product C**: three options | Adhesive Bandages | Medquora · First Aid & Wound Care | 1 pack = 1.500 · 5 packs = 6.500 (KWD 1.300 per pack) · 20 packs = 22.000 (KWD 1.100 per pack) |

The brief's own example (two purchases of a 4-pack offer at 19.500 = 39.000) is reproduced below with Product C's 5-pack offer: two bundles at 6.500 = **13.000**. The logic is identical: bundles × bundle price, never packs × bundle price.

The catalog has 12 products, 4 brands (Medquora, Nuvexa Medical, Orvanta Health, Velmora Care) and 3 categories (First Aid & Wound Care, Medical Consumables, Medical Devices).

> **Admin tests change the live database.** Use names starting with `UAT` for anything you create, and finish with the clean-up test **F-12** so a reviewer never sees test data.

**Suggested order:** section N (delivery) first, then A to G at P1 on desktop, then the P1 tests marked M on a phone, then P2 and P3.

---

## A. Pricing logic (the core of the brief)

| ID | Pri | View | Steps | Expected | Result |
|---|---|---|---|---|---|
| A-01 | P1 | D+M | Open `/shop`. Find Product A, B and C. | A shows 1 offer chip (1 pack), B shows 2 (1 pack, 6 packs), C shows 3 (1 pack, 5 packs, 20 packs). | Pass |
| A-02 | P1 | D+M | On Product C's card, select each chip in turn. | The large price changes to KWD 1.500, 6.500 and 22.000. The 5-pack and 20-pack also show the price per pack (KWD 1.300, KWD 1.100); 20 packs shows "Best value". On Product B's card, 6 packs shows KWD 6.500, KWD 1.083 per pack and "Best value". | Pass |
| A-03 | P1 | D | **The brief's example.** Open Product C's page, select 5 packs, set the number of bundles to 2, click Add to cart, open the cart. | The cart line shows "2 × 5 packs", "Total packs: 10" and **KWD 13.000**. The receipt shows "5 packs · 2 × KWD 6.500 … KWD 13.000". Never 10 × 6.500 (KWD 65.000). | Pass |
| A-04 | P1 | D | Add Product C's 1-pack once and its 20-pack once (on top of A-03). Open the cart. | Three separate lines for the same product: 2 × 5 packs (KWD 13.000), 1 × 1 pack (KWD 1.500), 1 × 20 packs (KWD 22.000). Total = 13.000 + 1.500 + 22.000 = **KWD 36.500**. | Pass |
| A-05 | P1 | D | Add the same offer (Product C, 5 packs) again from the shop's + button. | It joins the existing line (now 3 × 5 packs, KWD 19.500); no new line appears, and the Total becomes KWD 43.000. | Pass |
| A-06 | P1 | D+M | Look at every price on the home page, shop, product page and cart. | Every price is "KWD x.xxx" with exactly three decimals (for example KWD 6.500, never 6.5). | Pass |
| A-07 | P1 | D | Product page of Product B (Medical Adhesive Tape): select 6 packs, set bundles to 3. | The total shows **KWD 19.500** (3 × 6.500) and total packs 18 before you add anything. | Pass |
| A-08 | P2 | D | Product page of Product A. | One offer only, already selected; no "Best value" or "per pack" line; adding works. | Pass |

## B. Home page

| ID | Pri | View | Steps | Expected | Result |
|---|---|---|---|---|---|
| B-01 | P1 | D+M | Open `/`. | Header (Shop · MedicStore · Cart and sign-in), a teal hero with "MedicStore", "Everything you need, delivered with care." and **Shop now**, then **Top bundles** with three cards, then the footer "MedicStore · 2026 · Demo store, no real orders." | Pass |
| B-02 | P1 | D+M | Click **Shop now**. | Opens the shop (`/shop`) with all products. | Pass |
| B-03 | P1 | D+M | Look at the three Top bundles cards. | Each shows a photo, brand, name, its best bundle and price, price per pack and "Save N%". They are the three biggest savings (Adhesive Bandages 27% first). | Pass |
| B-04 | P1 | D+M | Click a Top bundles card. | Opens that product's page. | Pass |
| B-05 | P2 | D | Hover a card and the Shop now button. | Card lifts slightly with a teal border; button text underlines. | Pass |
| B-06 | P3 | D | Click "See all products" beside Top bundles. | Opens `/shop`. | Pass |

## C. Shop: listing, search and filters

| ID | Pri | View | Steps | Expected | Result |
|---|---|---|---|---|---|
| C-01 | P1 | D+M | Open `/shop`. | The quote "Stock up today and pay less for every pack.", a wide search bar with a search icon, Category and Brand dropdowns, "Products: 12" and the product grid (3 per row on desktop, 1 on a phone). | Pass |
| C-02 | P1 | D | Look along each row of cards. | Cards line up: chips, prices and + buttons sit at the same height whether a product has 1, 2 or 3 offers. Each card shows photo, brand · category and name. | Pass |
| C-03 | P1 | D+M | Category dropdown: choose **Medical Devices**. | Only its 4 products show; "Products: 4"; the address bar contains `category=`. | Pass |
| C-04 | P1 | D+M | Brand dropdown: choose **Velmora Care** (with the category reset to All categories). | Only Velmora Care's 4 products show. | Pass |
| C-05 | P1 | D | Choose category **Medical Consumables** and brand **Nuvexa Medical** together. | Only Nitrile Examination Gloves and Disposable Syringes show. | Pass |
| C-06 | P1 | D+M | Choose a bundle chip on any card, then press the round **+** button. | The + turns into a check mark briefly; the header cart count goes up by 1. | Pass |
| C-07 | P1 | D+M | Click a product's name or photo. | Opens its product page. | Pass |
| C-08 | P2 | D+M | Type `glove` in the search bar (do not press anything). | After a short pause only Nitrile Examination Gloves shows; a "“glove”" chip and "Clear filters" appear. | Pass |
| C-09 | P2 | D | Search for a brand (`Orvanta`) and then a category word (`First Aid`). | Brand and category names also match. | Pass |
| C-10 | P2 | D | Search for `zzz`. | "No products match…" with a **Clear filters** button that brings everything back. | Pass |
| C-11 | P2 | D | Apply a filter, copy the address, open it in a new tab. | The same filter and results load from the link. | Pass |
| C-12 | P2 | D | Remove the search chip (×). | The search box empties and all products return. | Pass |
| C-13 | P3 | D | Press Enter in the search bar. | Searches immediately. | Pass |
| C-14 | P3 | D | Hover a card. | Teal border and a slight photo zoom. | Pass |
| C-15 | P2 | D+M | Open the Category dropdown, then the Brand dropdown. | Each opens a styled list matching the site (not the browser's system menu): rounded panel, teal highlight on the hovered row, a check mark on the chosen one. Names show with no product counts, for example "First Aid & Wound Care", never "First Aid & Wound Care (4)". Arrow keys and Enter choose; Escape or a click outside closes it. | |

## D. Product details page

| ID | Pri | View | Steps | Expected | Result |
|---|---|---|---|---|---|
| D-01 | P1 | D+M | Open Product C's page. | Photo, brand and category (both links), name, description, all three offers with price and price per pack, number of bundles, total, Add to cart. | Pass |
| D-02 | P1 | D+M | Select each offer and change the number of bundles with − and +. | Total and total packs update instantly and correctly (on Product C, 3 × 20 packs = KWD 66.000, 60 packs). | Pass |
| D-03 | P1 | D+M | Click **Add to cart**. | A confirmation "Added to your cart: …" with a link to the cart; header count increases by the number of bundles. | Pass |
| D-04 | P1 | D | Type `0`, then `-2`, then `abc`, then `100` in the bundles box. | Each is refused with "Enter a whole number from 1 to 99"; Add to cart cannot add an invalid amount. | Pass |
| D-05 | P2 | D | Click the brand link, then go back and click the category link. | Opens the shop filtered by that brand / category. | Pass |
| D-06 | P2 | D+M | Click "All products" at the top. | Returns to `/shop`. | Pass |
| D-07 | P2 | D | (Needs a product with two or more pictures; add one in F-07 first.) Hover the main picture. | Faint arrows appear on both sides; they move to the next and previous picture and wrap around; the thumbnail strip highlights the current one. | Pass |
| D-08 | P2 | M | Same product on a phone. | The arrows are visible faintly without hover and work by tapping; thumbnails are tappable. | Pass |
| D-09 | P2 | D | Open `/products/999999`. | "This product isn't available" (no crash). | Pass |

## E. Cart

| ID | Pri | View | Steps | Expected | Result |
|---|---|---|---|---|---|
| E-01 | P1 | D+M | With the cart from A-04, open `/cart`. | Each line: square photo, name, offer, "N × offer", total packs, − / number / +, Remove, line total and price per bundle. Summary (teal receipt): one row per line with "offer · N × bundle price" and its line total, then **Total** in large bold. | Pass |
| E-02 | P1 | D+M | Press + and − on a line. | The line total, its receipt row and the Total update; − stops at 1. | Pass |
| E-03 | P1 | D | Type `5` in a line's number box. | Line and Total recalculate for 5 bundles. | Pass |
| E-04 | P1 | D | Type `0`, `100` and `abc` in a line's number box; also press + at 99. | Invalid entries show an error and are not saved; + stops at 99; the totals never change to a wrong value. | Pass |
| E-05 | P1 | D+M | Click **Remove** on one line. | That line disappears from the list and the receipt; Total recalculates. | Pass |
| E-06 | P1 | D+M | Click **Clear cart**, then **Cancel**. Click it again and confirm. | Cancel keeps everything. Confirm empties the cart and shows the centred "Your cart is empty" with **Browse products**. | Pass |
| E-07 | P1 | D | Add items, then refresh the page. | The cart is still there after the refresh (a guest cart is kept in this browser). | Pass |
| E-08 | P1 | M | On a phone, open a cart with 2 or 3 lines. | Lines stack, the receipt sits below them, nothing is cut off or scrolls sideways; − / + are easy to tap. | Pass |
| E-09 | P2 | D | Cart with one line on desktop. | The item box is only as tall as its single line (no big empty area). | Pass |
| E-10 | P2 | D | Click a cart line's product name. | Opens the product page. | Pass |
| E-11 | P2 | D | As a guest, read the bottom of the summary. | "Your cart is kept in this browser" with a link to sign in; "Checkout isn't part of this demo"; **Continue shopping** goes to `/shop`. No checkout button. | Pass |
| E-12 | P3 | D | (After F-06) Delete an offer in admin that is in your cart, then reload the cart. | That line says the offer is no longer available and is left out of the Total, with a Remove button. | Pass |

## F. Admin: product management (Manage Store)

Sign in with the admin account first.

| ID | Pri | View | Steps | Expected | Result |
|---|---|---|---|---|---|
| F-01 | P1 | D | Sign in as admin, click **Manage Store** in the header. | Admin area opens on Products: search, brand, category and status filters, and a row per product with thumbnail, brand, category, status, tier count, Edit and Delete. | Pass |
| F-02 | P1 | D | Click **New product**. Fill name `UAT Product`, a description, a brand and a category; add two pricing tiers: `1 pack` / 1 / 2.000 and `5 packs` / 5 / 9.000. Turn **Active** on and click **Create product**. | Saved, and the page becomes the product's edit page. | Pass |
| F-03 | P1 | D | Refresh the page. | Everything you entered is still there (stored in the database). | Pass |
| F-04 | P1 | D | Open the storefront `/shop` in another tab and search `UAT`. | UAT Product appears with chips 1 pack / 5 packs and the right prices; its page and cart work like any product. | Pass |
| F-05 | P1 | D | In admin, edit UAT Product: change the name and the 5-pack price to 8.500; save. Refresh the storefront. | The new name and price show on the shop, the product page and in a cart line. | Pass |
| F-06 | P1 | D | Add a third tier `10 packs` / 10 / 16.000, then delete it. | The storefront shows three chips, then two again. | Pass |
| F-07 | P1 | D | Upload a JPEG or PNG picture to UAT Product (and a second one). Set the second as main or move it earlier. | Pictures appear in admin and on the storefront (the first one is the card photo; the product page shows both with arrows). | Pass |
| F-08 | P1 | D | Turn **Active** off and save. Check the storefront. | UAT Product disappears from the shop; its page says it isn't available. Turn it back on: it returns. | Pass |
| F-09 | P1 | D | Delete every tier of UAT Product. | The product becomes inactive automatically and leaves the storefront (a product needs at least one offer). | Pass |
| F-10 | P1 | M | On a phone, open the menu (☰), tap **Manage Store**, open UAT Product. | The form fits the screen; fields are stacked; the status / brand / category / **Save changes** panel is the last block on the page. | Pass |
| F-11 | P1 | D | Products list filters: search `UAT`, filter by status "Inactive", tick "Only products without an Arabic name". | The list narrows correctly each time. | Pass |
| F-12 | P1 | D | **Clean-up.** Delete UAT Product (confirm the dialog). Check the storefront. | Gone from admin and the shop. No `UAT` data is left anywhere. | Pass |
| F-13 | P2 | D | On the product form, click **Back to products** (teal, underlined). | Returns to the list. | Pass |
| F-14 | P2 | D | Fill the Arabic name and description of a product, save, switch the site to Arabic. | The Arabic text shows in the Arabic storefront; the "No Arabic name" badge disappears in admin. | Pass |
| F-15 | P2 | D | On an existing product, change a field without saving, then save. | The side panel says "Unsaved changes" after the edit and "All changes saved" after saving. | Pass |

## G. Admin: brands and categories

| ID | Pri | View | Steps | Expected | Result |
|---|---|---|---|---|---|
| G-01 | P1 | D | Brands → **New brand** `UAT Brand` → save. | It appears in the list, in the product form's brand dropdown and (once a product uses it) in the shop's brand dropdown. | Pass |
| G-02 | P1 | D | Edit UAT Brand's name and save. | The new name shows everywhere. | Pass |
| G-03 | P1 | D | Try to delete a brand that has products (for example Medquora). | Refused: "This brand cannot be deleted. Products using it: 2"; nothing is deleted. | Pass |
| G-04 | P1 | D | Delete UAT Brand (no products). | Deleted after confirming. | Pass |
| G-05 | P1 | D | Repeat G-01 to G-04 for Categories with `UAT Category`. | Same behaviour. | Pass |
| G-06 | P2 | D | Create a brand with an existing name (`Medquora`). | Refused: the name already exists. | Pass |
| G-07 | P2 | M | On a phone, Brands → **Edit** on a brand. | The form opens after the list and the page scrolls to it; saving works. | Pass |

## H. Validation and error handling

| ID | Pri | View | Steps | Expected | Result |
|---|---|---|---|---|---|
| H-01 | P1 | D | New product: leave the English name, description, brand and category empty; click Create. | Each field shows a clear error; nothing is saved. | Pass |
| H-02 | P1 | D | Tier form: packs `0`, `-1`, `1.5`; price `0`, `-3`, `abc`. | Each is refused with a message; no tier is saved. | Pass |
| H-03 | P1 | D | Add a second tier with the same number of packs as an existing one. | Refused: the number of packs must differ. | Pass |
| H-04 | P2 | D | Price with more than three decimals (`1.2345`). | Refused (KWD has three decimals). | Pass |
| H-05 | P2 | D | Try to set Active on a product with no tiers. | The switch is blocked, with "Add at least one pricing tier to activate this product." | Pass |
| H-06 | P2 | D | Upload a file that is not JPEG, PNG or WebP (for example a PDF), or larger than 5 MB. | Refused with a clear message. | Pass |
| H-07 | P2 | D | Sign in with a wrong password. | "Incorrect email or password"; you stay signed out. | Pass |
| H-08 | P3 | D | Register with a password shorter than 10 characters, and with an email that is already used. | Clear messages next to the fields. | Pass |
| H-09 | P3 | D | Open an unknown address, for example `/nowhere`. | A "Page not found" page with a way back. | Pass |

## I. Responsive and mobile

| ID | Pri | View | Steps | Expected | Result |
|---|---|---|---|---|---|
| I-01 | P1 | M | Visit home, shop, a product, cart, sign in and the admin products list on a phone. | Nothing overflows sideways; text is readable; buttons are easy to tap. | Pass |
| I-02 | P1 | M | Header on a phone: tap ☰. | The menu shows Manage Store (admins), Sign in / Sign out and the language switch; the Cart icon with its count stays visible in the bar. The menu closes when you choose an item or tap outside. | Pass |
| I-03 | P1 | M | Complete A-03 (2 × 5 packs = KWD 13.000) entirely on a phone. | Same result as on desktop. | Pass |
| I-04 | P2 | D | Narrow a desktop browser window slowly from 1440 to 360 px on home, shop and cart. | The layout adapts smoothly (grid 3 → 2 → 1 columns; the header switches to the menu below 1024 px). | Pass |
| I-05 | P3 | M | Rotate the phone to landscape on the shop and cart. | Still usable, nothing overlaps. | Pass |

## J. Loading, empty and error states

| ID | Pri | View | Steps | Expected | Result |
|---|---|---|---|---|---|
| J-01 | P2 | D+M | Open `/cart` in a fresh private window. | The centred empty cart with an icon and **Browse products**. | Pass |
| J-02 | P2 | D | Browser DevTools → Network → Slow 3G, then open `/shop`. | Grey placeholder cards while loading, then the products (no jumping or blank page). | Pass |
| J-03 | P3 | D | DevTools → Network → Offline, then change a filter. | A clear error with **Try again**; it recovers when you go back online. | Pass |

## K. Accounts and saved carts (extra to the brief)

| ID | Pri | View | Steps | Expected | Result |
|---|---|---|---|---|---|
| K-01 | P2 | D | Create an account (`uat+<date>@example.com`). | Signed in; your name shows in the header (desktop). | Pass |
| K-02 | P2 | D | As a guest, add 2 items. Then sign in as a customer. | The guest items are merged into the account's cart (no duplicates, no loss). | Pass |
| K-03 | P2 | D | Signed in, add an item; sign out; sign in again (or in another browser). | The account cart comes back exactly. | Pass |
| K-04 | P2 | D | Sign out. | Returns to the sign-in page; the cart in this browser is empty for the next person. | Pass |
| K-05 | P2 | D | As a customer (not admin), open `/admin`. | No access: no Manage Store link, and the admin area does not open. | Pass |
| K-06 | P2 | D+M | Sign-in page: click **Continue as guest**. | Goes to the home page. | Pass |
| K-07 | P3 | D | As a guest, open `/admin`. | Sent to the sign-in page. | Pass |
| K-08 | P2 | D+M | Create account: enter `sara@shop` (no dot after the @), a name and a long password, then press **Create account**. | The form does not submit; the Email field shows "Enter a valid email address, for example name@example.com". A correct address such as `sara@shop.example` goes through. | |
| K-09 | P2 | D+M | On the sign-in page and on the create-account page, type a password and press the eye icon at the right end of the field. | The password becomes readable and the icon changes to a crossed eye; pressing it again hides the password. | |

## L. Arabic (right-to-left)

| ID | Pri | View | Steps | Expected | Result |
|---|---|---|---|---|---|
| L-01 | P2 | D+M | Click **العربية** (on a phone, inside ☰). | The whole site switches to Arabic and mirrors right-to-left; the choice is remembered after a refresh. | Pass |
| L-02 | P2 | D | In Arabic, visit home, shop, product, cart. | Bundles read **عرض / عروض** (for example "أفضل العروض", "عدد العروض"); prices keep Latin digits with "د.ك", for example "13.000 د.ك.". | Pass |
| L-03 | P2 | D | In Arabic, repeat A-03. | Same total, 13.000 د.ك., with the layout mirrored. | Pass |
| L-04 | P3 | D | In Arabic, open the admin product form and the cart's Clear cart dialog. | Fully translated and mirrored. | Pass |
| L-05 | P3 | D | Product with no Arabic name, in Arabic. | The English name is shown instead (no blank). | Pass |

## M. Accessibility and keyboard

| ID | Pri | View | Steps | Expected | Result |
|---|---|---|---|---|---|
| M-01 | P3 | D | Press Tab once on any page. | A "Skip to content" link appears first. | Pass |
| M-02 | P3 | D | Use only the keyboard to choose an offer on a card, add it, open the cart and change a quantity. | Everything works; a visible focus outline shows where you are. | Pass |
| M-03 | P3 | D | Open the header menu (below 1024 px) and press Escape. | The menu closes. | Pass |
| M-04 | P3 | D | Zoom the browser to 200% on the shop and cart. | Still usable; nothing overlaps. | Pass |

## N. Delivery (what the reviewer receives)

| ID | Pri | View | Steps | Expected | Result |
|---|---|---|---|---|---|
| N-01 | P1 | D+M | Open the live link in a private window on a laptop and on a phone. | The home page loads quickly with photos; no errors. | Pass |
| N-02 | P1 | D | Open the API health check link. | `{"status":"ok","database":"ok"}`. | Pass |
| N-03 | P1 | D | Sign in to the live admin with the credentials you will put in the submission message. | Manage Store opens. (Credentials go in the message, never in the repository.) | Pass |
| N-04 | P1 | D | Open the GitHub repository in a private window. | It is public (or shared with the reviewer); the README shows. | Pass |
| N-05 | P1 | D | Read the README. | It covers setup, project structure, the AI tools and technologies used, and known limitations, and its live links work. | Pass |
| N-06 | P1 | D | Check the repository and the live site for anything that should not be there. | No secrets, no real company names, no `UAT` test data, no stray folders. | Pass |
| N-07 | P2 | D | Refresh any deep link directly (for example `/shop?category=…` or `/products/7`). | It loads, not a 404. | Pass |

---

## Sign-off

| Priority | Total | Passed | Failed | Skipped |
|---|---|---|---|---|
| P1 | 59 | 59 | 0 | 0 |
| P2 | 40 | 37 | 0 | 0 |
| P3 | 15 | 15 | 0 | 0 |

All original tests (111) were run and passed. The three tests added afterwards (C-15, K-08, K-09) are not yet run on the live site; they pass in the automated suite and in a local browser check.

Tested by: ____________  Date: ____________  Devices / browsers: ____________

## Defects found

| # | Test ID | View | What happened | Expected | Severity | Fixed? |
|---|---|---|---|---|---|---|
| 1 | | | | | | |
