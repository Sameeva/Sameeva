# FaturaDZ

Invoice (facture) and receipt (reçu) maker for Algerian businesses. It prints the legal details (NIF, NIS, RC, Article d'imposition), computes TVA and the droit de timbre, and produces a PDF in the browser.

Everything runs locally in the browser: data is stored in IndexedDB on the user's device, nothing is sent to a server. Users should export a backup regularly (Paramètres → Sauvegarde).

## Run locally

```bash
cd faturadz
npm install
npm run dev        # http://localhost:3000
```

## Checks

```bash
npm run check      # lint + typecheck + unit/property tests
npm run build
npm audit --omit=dev
```

## Where things are

| Path | What |
| --- | --- |
| `src/lib/fiscal-config.ts` | **All tax rules** (TVA rates, timbre brackets, ID formats) with their sources. Points marked `TO VERIFY` need an accountant's confirmation. |
| `src/lib/tax.ts`, `timbre.ts` | Totals in integer centimes, one rounding rule (half up) |
| `src/lib/amountInWords.ts` | Amount in French words |
| `src/db/` | Dexie schema, zod validation, numbering/finalization, backup |
| `src/pdf/` | PDF model (pure, tested) and react-pdf layout |
| `src/proxy.ts` | Per-request nonce Content-Security-Policy |

## Rules enforced

- Money is integer centimes; TVA is computed per rate on the summed base.
- Timbre fiscal only for cash payments (art. 100 Code du timbre, LF 2025 brackets).
- Numbers (`FA-2026-0001`, `RE-2026-0001`) are assigned at finalization, per type and year, in date order.
- Finalized documents cannot be edited or deleted; duplicate them to correct.
- Backup imports are validated strictly; logos must be PNG/JPEG and are re-encoded.
