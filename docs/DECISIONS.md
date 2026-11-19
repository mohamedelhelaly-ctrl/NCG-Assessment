# Decisions Log: Medical E-Commerce, Multi-Tier Pricing

Each entry records what was decided and why. Where the build later changed a decision, the entry says **[REVISED]** and describes what the app does now. `DESIGN.md` is the detailed design.

---

## 0. What the assessment requires (reference)

Four connected pages, backed by a real database:

1. **Home / listing**: product images, names and pricing options; brand and category lists with filtering; open details or add an offer to the cart.
2. **Product details**: info, images, brand, category, all offers; pick an offer and a bundle count; live price; add to cart.
3. **Cart**: product, offer, bundle quantity, line price; update quantity, remove, auto totals; **different offers of the same product are separate lines**.
4. **Admin**: CRUD for products, brands, categories and pricing tiers (units per bundle, bundle price); persisted to a real database and reflected on the storefront.

**Core business rule:** a tier is a bundle with its own unit count and **total** price (not a per-pack price). Example: 2 x "4-pack @ 19.500" = **39.000 KWD**, **8 packs** internally. The number of tiers per product is dynamic. KWD is shown with **3 decimals**.

**Required test data:** at least three products with exactly 1, 2 and 3 tiers (for the 3-tier product, illustrative prices 5.500 / 19.500 / 55.000 KWD with bundle sizes 1 / 4 / 12), at least 2 brands and 2 categories.

**Also required:** a real backend and persistent database (mock data or localStorage alone is insufficient for the catalog), validation of positive quantities and prices, responsive layout, loading/error/empty states, a live link that includes the admin page, a GitHub repo, a short README (setup and structure), a list of AI tools used, and known limitations. Evaluation covers functionality, UI/UX, backend integration, technical quality with testing, and documentation. Deadline is 4 calendar days. Submit by email to the address in the brief, with the subject line it specifies.

**Out of scope in the brief:** authentication, checkout, payment, delivery, orders, inventory. Checkout, payment, delivery, orders and inventory were not built. Accounts (sign up, sign in, roles) were built anyway, because they let the cart follow a customer and replace the shared admin password (sections 6 and 7).

---

## 1. Application type

**[DECIDED] A responsive web app** (storefront + admin), not a native mobile app.

**Why:** the brief asks for a deployed app reachable through a live link and for responsive desktop and mobile layouts. Nothing asks for iOS or Android builds.

---

## 2. AI development tool

**[DECIDED] Claude Code. The recruiter confirmed it is acceptable.**

| Option | Notes |
|---|---|
| Lovable / Bolt / Google AI Studio | Named in the brief. Fast UI scaffolding, weaker code structure. |
| **Claude Code** | Counts as an "equivalent" AI development tool. Works in a real codebase, which supports the brief's stated priorities: sound engineering, structure, maintainability, tests. |
| Hybrid (scaffold in Lovable, refine in Claude Code) | Considered, not chosen. |

**Why:** you prefer it, you already used it for The Baker, and the evaluation favours well-structured code. The recruiter's confirmation removes the main risk (a reviewer expecting a Lovable-style workflow).

**Follow-through:** list Claude Code clearly in the README's "AI tools used" section, and briefly describe how it was used (design doc, `CLAUDE.md`, vertical slices).

---

## 3. Technology stack

**[DECIDED] Frontend:** React + TypeScript + Tailwind CSS (the brief's preferred stack), hosted on **Vercel**.
**[DECIDED] Backend:** FastAPI + PostgreSQL, hosted on **Railway**.

### Backend comparison

| | **FastAPI** | Node (Express/NestJS) + Prisma | Django + DRF | Next.js full-stack | Supabase (BaaS) |
|---|---|---|---|---|---|
| Your comfort | High, existing pattern from The Baker | Lower | Lower | Lower | Low |
| Validation | Pydantic: declarative, automatic 422s | Zod: equally good | Serializers: verbose | Zod | Mostly DB constraints |
| Testing | pytest + httpx (known) | Vitest/Jest | Django tests | Awkward for backend logic | Hard to test business rules |
| API docs | Free OpenAPI at `/docs` | Needs setup | Needs setup | None | Auto |
| Admin panel | Build it (matches the brief) | Build it | Built-in, but looks like a shortcut and UI/UX is graded | Build it | Table editor only |
| Fits layered architecture | Natural | Natural | Imposes MVT | Muddles layers | None |

**Why FastAPI:** it fits the brief with no compromise, and your comfort with it matters more than the small edge TypeScript end-to-end would give within 4 days. Pydantic gives strong validation, pytest covers the pricing service, and `/docs` helps reviewers.

**Why not the others:**
- **Node/TypeScript:** the only serious contender (shared types), but it means learning patterns under the deadline.
- **Django:** the free admin would be an obvious shortcut, and the brief grades the admin UI you build.
- **Next.js full-stack:** merges layers you want to show separated and moves the backend off Railway.
- **Supabase:** it was suggested first only because of an assumed Lovable route. It is the weakest fit here: the bundle rules and quote endpoint need a testable service layer, and "where's the backend?" is a real risk.

**Railway does not conflict with the brief.** The brief requires only a real backend, a persistent database and a live link.

**Backend libraries [DECIDED 2026-11-18]:** SQLAlchemy 2 (async), Alembic, Pydantic v2, pytest, same conventions as The Baker (self-migrating entrypoint, idempotent seeding, one error envelope). Supporting libraries are listed in `DESIGN.md` section 2.

---

## 4. Architecture

**[DECIDED] Layered monolith in a 3-tier deployment:** React SPA -> FastAPI API -> Postgres, with the backend structured as **router -> service -> crud -> model**.

| | MVC | **Layered** | Clean / Hexagonal | Vertical slices | BaaS direct |
|---|---|---|---|---|---|
| Fit for SPA + API | Collapses into layered without a service layer | Natural | Works, heavy | Works, combined with layering | Works |
| Where pricing rules live | Controllers / fat models | **Service layer, unit-testable** | Isolated domain core | Feature service | Frontend or DB functions |
| Boilerplate in 4 days | Low | Low-medium | High | Medium | Lowest |
| Risk | Logic leaks into controllers | Pass-through services if overdone | Ceremony eats time | Drift | Fails the "real backend" spirit |

**Why:** the domain is mostly CRUD plus one real business rule (bundle pricing). Layering keeps CRUD thin and gives that rule a testable home. Clean/Hexagonal protects against integrations that do not exist here. MVC is mostly a label in a React + API app. It is the same pattern you built for The Baker.

**Layer rules:**
- **routers:** HTTP only, no logic.
- **schemas:** Pydantic validation.
- **services:** business rules (pricing, quote, tier rules), no HTTP knowledge.
- **crud:** queries and filtering.
- **models:** tables and constraints.

**Validation happens at three levels:** UI forms (UX), Pydantic (authority), DB constraints (last safety net).

---

## 5. Catalog and sample data

**[DECIDED] Four fictional brands, three categories and 12 demo products.** All brand names are fictional and created for the demo.

Brands: **Nuvexa Medical, Orvanta Health, Velmora Care, Medquora.** Categories: **Medical Consumables, Medical Devices, First Aid & Wound Care.** The 12 products carry 1, 2 or 3 tiers each (for example Nitrile Examination Gloves: 1 / 4 / 12 packs at 5.500 / 19.500 / 55.000 KWD). Products an admin adds on the live site come on top of these.

**Why:**
- Medical goods (medical consumables, wound care, devices), so the demo feels relevant to the reviewer.
- **Fictional brands** avoid real trademarks, and the brief says to use your own sample data.
- Drugs were rejected: they imply prescriptions and regulation. Mobility aids (e.g. wheelchairs) were rejected as bundle products because nobody buys a 12-pack of wheelchairs.

**Follow-through:**
- Seed images are generated placeholders (plain SVG pictures, one tone per category), never copied from a real store. The admin replaces them with real uploads.

---

## 6. Cart

**[REVISED] A hybrid cart: browser storage for guests, the database for signed-in customers. Prices always come from a server quote (`POST /cart/quote`).**

**History:** the first decision was a localStorage-only cart, because cross-device carts depended on accounts, which were out of scope. Accounts were then built (section 7), and the hybrid route that this section originally named as the usual next step became the implementation.

**Guests.** The cart lives in localStorage (key `cart:v1`) as a minimal list:

```json
[{ "productId": 3, "tierId": 7, "bundles": 2 }, { "productId": 4, "tierId": 9, "bundles": 1 }]
```

**Signed-in customers.** The cart is saved on the server (tables `carts` and `cart_items`, one cart per user) through `GET` and `PUT /me/cart`. Signing in merges the guest cart into the account cart with `POST /me/cart/merge`. The merge is idempotent: the browser sends a merge id, so a retry after a lost response does not add the bundles twice. A line for the same offer adds its bundles (capped at 99); another offer becomes a new line. After signing in, the account cart is the source of truth, and signing out clears the cart in that browser so the next person starts empty.

**Prices are never stored.** In both cases the frontend sends the lines to `POST /cart/quote` (open to everyone). The server reads current prices, validates quantities and returns each line (names, offer label, bundle price, bundles, packs, line total) with a status of `ok`, `unavailable` or `invalid`, plus the grand total over the `ok` lines. A cart line keeps `product_id` and `tier_id` as plain numbers, not foreign keys, so a tier an admin deleted still shows up as an unavailable line instead of vanishing.

| | DB cart only | localStorage + quote only | **Hybrid (built)** |
|---|---|---|---|
| Works without an account | Needs an anonymous cart id | Yes | Yes (guest) |
| Follows the customer to another device | Yes | No | Yes, once signed in |
| Prices always current | Yes | Yes (quote) | Yes (quote) |
| Backend work | Tables and endpoints | 1 endpoint | Both, plus the merge |

**Why this changed:** accounts existed anyway, and a customer who signs in on a second device expects the same cart. The guest path keeps the shop usable with no sign-up.

**Why this does not break the "real database" rule:** the catalog (products, brands, categories, tiers) is in Postgres and the cart stores only the customer's selection, never prices.

**Checkout compatibility:** if checkout were added, `POST /orders` would revalidate everything server-side and snapshot name, offer, units, bundle price and packs. The cart only holds intentions.

**Cart behaviour rules:**
- A line is one offer (`tierId`), so different offers of one product are separate lines automatically. Adding the same offer again increases its bundles.
- Totals always use `bundles x bundle_price`. Never treat the bundle price as a per-pack price.
- Pack count is derived: `bundles x units_per_bundle` (2 x 4-pack = 8 packs; line total 39.000 KWD).
- A per-pack price and a "Best value" marker are display hints only (cross-multiplied, so no rounding), and never feed into totals. The home page picks its three top bundles by the saving per pack.
- Limits: 1 to 99 bundles per line and at most 100 lines per cart.

**Known limitations:** a guest cart is per browser. An admin account has a cart too, since it is a signed-in user.

---

## 7. Accounts and admin protection

**[REVISED] Real accounts with two roles (customer and admin), using email and password and a signed token. There is no shared admin password.**

**History:** the first decision was a single static `ADMIN_PASSWORD` with `POST /admin/login`. It was replaced by accounts, which are small to build on top of the same JWT idea, give the cart a home (section 6) and make the admin a normal user with the `admin` role.

| Option | Verdict |
|---|---|
| No protection | Anyone can wipe the demo before it is reviewed; looks careless |
| Static password + token | Was the first choice; superseded |
| **Accounts with roles + token** | Built: separate customers and admins, one login flow |

**Implementation:**
- `POST /auth/register` (customers only; role `customer`), `POST /auth/login` and `GET /auth/me`. Passwords are hashed with bcrypt (10 to 72 bytes). Login is rate-limited to 10 per minute and registration to 5 per minute per client address, in memory per process (a Redis-backed limiter is needed before running several workers). Responses carry no-store headers.
- A login returns a signed JWT valid for 60 minutes, sent as `Authorization: Bearer ...`. The signing secret is `JWT_SECRET`. An expired or invalid token (401) ends the session in the UI.
- Permissions are declared in one place (`core/permissions.py`): `catalog_admin` is read and write for `admin`; `cart` is read and write for `customer` and `admin`. **Every admin endpoint, read and write, requires the admin role.** Public catalog and `/cart/quote` stay open.
- There is no endpoint to make someone an admin. The first admin is created from `FIRST_ADMIN_EMAIL` and `FIRST_ADMIN_PASSWORD` by `scripts/seed_admin.py` at startup. It is idempotent and never changes an existing account, so changing the variable later does not change the password.
- Frontend: sign-in and create-account pages (email format is checked, and each password field has a show/hide toggle), route guards on `/admin/*` (a guest is sent to sign in, a customer cannot open it), and a **Manage Store** link in the header for admins only. A demo customer is seeded from `DEMO_PASSWORD`.
- `.env` stays out of git; only `.env.example` is committed.

**Delivery risk:** the brief requires that the live link includes access to the product management page. A reviewer who lands on a sign-in page without credentials sees a broken deliverable. So:
- **[DECIDED 2026-11-18]** The owner writes and sends the submission email; Claude Code takes no part in the submission.
- **[REVISED]** The sign-in page carries a "Reviewing this store?" box that shows the admin email and password, so a reviewer can open Manage Store without looking elsewhere. The earlier decision was no hint and credentials in the email only. Because of this, the credentials are in the public repository and the site bundle: treat that account as a demo account, keep nothing real behind it, and change the password after review.
- **[REVISED]** Restoring the demo data: there is no `reset_demo.py` script and no admin reset button. `scripts/seed_demo.py --reset` (or `SEED_DEMO_RESET=true` for the startup seed) removes all products, brands and categories and seeds the demo catalog again. It acts only while the demo catalog is missing, so it is safe to leave on for one start and then remove.

**README wording:** "Accounts use email and password with two roles, customer and admin. The admin area is open only to admins, and the server checks the role on every admin request. Known limitations: no password reset or change screen, no email verification, no audit trail."

---

## 8. Pricing tier rules

A **tier** (also called pricing option, offer or bundle) is one row in `pricing_tiers` belonging to a product: `units_per_bundle` packs sold together at one `bundle_price`. Customers pick one tier and a number of bundles.

**[REVISED] A product cannot be active without tiers.**
- A product is created with at least one tier. Deleting a product's last tier is **allowed**, but the product is then switched to inactive (draft) automatically and the admin is told, so it never shows in the shop with nothing to buy. It cannot be activated again until it has a tier.
- A product has an `is_active` flag (default off) that controls whether the storefront shows it. This is a publish switch, not a stock flag.
- Enforced in the service layer inside a transaction. A simple DB `CHECK` cannot express "at least one child row".

**[DECIDED] A product cannot have two tiers with the same unit count.**
- DB constraint `UNIQUE (product_id, units)` (the column is named `units`), plus an API error with code `duplicate_units` that the UI translates (the English text reads "This product already has a tier of 4 units").
- **Why:** duplicate "4 packs" offers at different prices would confuse customers and break the idea that each tier is a distinct offer.

**[DECIDED] Behaviour when a tier changes while it is in someone's cart** (all handled by the quote endpoint, all tested):
- **Price edited:** the quote returns the current price, so the customer sees the updated total.
- **Units edited:** pack count is recalculated from the new value.
- **Tier deleted:** the quote returns that line as `unavailable`; the UI shows "This offer is no longer available" with a remove button, and the line is left out of the total. No crash and no silently dropped item.

**[DECIDED] Maximum bundle quantity per line is 99**, enforced in the UI and the API.
- **Where it is enforced:** the quantity control in the UI; Pydantic validation (1 to 99) on the cart endpoints; the quote, which marks an out-of-range line `invalid`; and, for saved carts, the database constraint `bundles BETWEEN 1 AND 99` on `cart_items`. The tier table guards what it stores: `units >= 1`, `price_fils > 0` and a maximum price, plus the uniqueness above. Reject zero, negatives, decimals and anything above 99 consistently.
- **Money:** prices are stored and calculated as integer fils (1 KWD = 1000 fils), never floats. Admin price fields accept up to 3 decimals.

**[DECIDED] No sold-out flag and no inventory handling.**
- **Why:** the brief says no inventory deduction is required and lists inventory management as out of scope. A sold-out flag is not rewarded by any evaluation criterion, and it would touch the admin, cards, details page, quote endpoint, cart states, translations and tests.
- The deleted-tier case (BR-8) already covers "an offer that can no longer be bought".
- Possible day-4 stretch only if everything else is solid; it is not planned.

---

## 9. Images

**[DECIDED] The admin uploads a file; it is stored in Cloudflare R2 in production and on local disk in development.** Entering an image URL is rejected as a poor admin experience.

| Option | Notes |
|---|---|
| Image URL entered by admin | Simplest, but poor UX and links break |
| Railway volume | Works for a demo, but ties files to the deployment |
| Cloudinary | Free tier, but another service to learn |
| **R2 file upload** | Durable object storage; chosen through `STORAGE_BACKEND` |

**Implementation notes:**
- A product can have **up to 10 images**. The admin can upload, reorder, edit the alt text (English and optional Arabic) and delete. The first image is the main one; the product page shows arrows and thumbnails when there is more than one.
- The API validates the upload (5 MB cap, a pixel cap, a real image), then re-encodes it to **WebP** with the longest side at most 1600 px.
- The object key is stored on the image row; the API returns the public URL (`R2_PUBLIC_URL` in production, `PUBLIC_API_URL` locally).
- The seed script writes its SVG placeholder pictures through the same storage backend, so a fresh deploy has pictures.
- Credentials come from environment variables, never committed.

---

## 10. Languages: English and Arabic

**[DECIDED] The web app is available in English and Arabic, with English as the default language.**

**[DECIDED] Admin-managed content is never machine-translated.** Product, category and brand names are entered by the admin in both languages:
- The English name (`name`) is required; the Arabic name (`name_ar`) is optional. Brands, categories, products and offer labels all work this way.
- In the Arabic view, if `name_ar` is empty, the English name is shown instead.

**History:** the earlier recommendation was English-only (to avoid the RTL and i18n cost). This decision overrides it; the added work is accepted. It should now be planned from day 1.

**Implications [DECIDED 2026-11-18]:**
- Two kinds of text: **UI strings** (buttons, labels, messages) come from translation files (e.g. `react-i18next`); **admin content** comes from the database fields above.
- One helper (`pick(lang, en, ar)` in `core/i18n.py`) implements the fallback in one place, per field, and is unit tested. **The API decides:** public endpoints read the `Accept-Language` header (the frontend sends the current language, and responses are marked `Vary: Accept-Language`) and return one resolved value, so the frontend does not pick. The `/cart/quote` response works the same way. Admin endpoints return both languages so the forms can edit both.
- Trim admin input and store an empty Arabic name as `null`, so the fallback actually triggers.
- Switching to Arabic sets `dir="rtl"` and `lang="ar"` on the document. Use Tailwind logical properties (`ms-`, `me-`, `ps-`, `pe-`, `text-start`) so layouts flip cleanly. Persist the language choice in localStorage.
- **[REVISED]** Each tier stores its own label (`label`, optional `label_ar`), for example "4 packs". The seed script fills the English label from the unit count. The UI shows the label as stored, with the Arabic one when present.
- Currency stays **KWD with 3 decimals** in both languages: `KWD 19.500` in English and `19.500 د.ك.` in Arabic.

**[DECIDED] Follow-up answers**
- **Descriptions** are admin-managed content too: `description` (English) and `description_ar`, never machine-translated, same English fallback as names.
- **[REVISED] The Arabic view keeps Latin digits (0 to 9)** for prices, quantities and pack counts, with the Arabic currency sign (`د.ك.`). The earlier decision was Arabic-Indic digits. The reason is not recorded in the original notes; the effect is that what the admin types and what the shopper reads use the same digits, and a test checks that no Arabic-Indic digit appears. `formatKwd` is language-aware for the currency sign only, and the API, URLs and localStorage always use ASCII digits.
- **The admin UI is translated and RTL-ready**, not only the storefront. In Arabic, "bundle" is عرض and "bundles" is عروض, and the Arabic view is called الواجهة العربية.
- Server error messages are English and for debugging; the UI translates by error `code`. Every error has the same shape (`code`, `message`, optional per-field messages).

---

## 11. Storefront design

**[DECIDED] A separate home page at `/`, the catalogue at `/shop`, and a teal and white theme.**

- **Pages:** home (hero, three top bundles, one-line footer), shop, product, cart, sign in and create account, and the admin area.
- **Header:** Shop with an icon on the left, the MedicStore wordmark in the centre, and on the right Cart with its count, Sign in (or the user's name and Sign out), Manage Store for admins and the language switch. Below 1024 px the right-hand actions fold into a menu panel (closes on Escape, on an outside click and when you navigate), so nothing is out of reach on a phone.
- **Look:** white with teal `#069494` for accents and a darker `#057a7a` / `#045f5f` for filled buttons and small text so contrast passes AA. IBM Plex Sans (and Plex Sans Arabic) for text; the wordmark is Fraunces bold.
- **Shop filters:** a search bar and two dropdowns, Category and Brand. The dropdowns are a custom styled listbox (keyboard accessible), not the browser's system menu, and list names without product counts. The shopper's choices live in the address, so a filtered view can be shared.
- **Cart summary:** a teal receipt with one row per product (`bundles x bundle price`) and the total last. Clear cart asks for confirmation first.
- **Stack:** Tailwind v4 theme tokens, React Router 7, react-i18next.
