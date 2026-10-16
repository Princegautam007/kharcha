# SMS Parser

The parser lives in `index.html` inside the `parseSms()` function.

It takes a raw SMS string and returns an expense object or `null` if the SMS is not a financial transaction.

## What it extracts

- Amount in rupees
- Transaction type (debit or credit)
- Merchant name
- Bank name
- Category (auto-detected from merchant name)

## Amount detection

Tries multiple patterns in order:

1. `Rs.249`, `Rs 249`, `INR 249`, `Rupees 249`
2. `249 Rs`, `249 INR`
3. `debited / credited / paid ... 249`

Strips commas from amounts like `1,249.50`. Returns null if no valid amount found.

## Type detection

Looks for keywords:

- Debit keywords: `debited`, `spent`, `paid`, `purchase`, `payment`, `debit`, `DR`
- Credit keywords: `credited`, `received`, `credit`, `cashback`, `refund`, `CR`
- Defaults to debit if neither found

## Merchant extraction

Three patterns tried in order:

1. Text after `to`, `at`, `for`, `towards` - covers most UPI messages like "Rs.249 paid to Swiggy"
2. VPA/UPI ID - covers messages that show the UPI ID like "VPA swiggy@icici"
3. Text after `merchant:` or `store:` - covers card transaction alerts

## Bank detection

Checks sender address for bank keywords: hdfc, sbi, icici, axis, kotak, pnb, bob, paytm, phonepe, gpay, yesbank, idfc, federal, union

## Auto-category rules

Merchant name is matched against keyword lists:

| Category  | Keywords                                                            |
|-----------|---------------------------------------------------------------------|
| food      | swiggy, zomato, mcdonald, kfc, domino, pizza, cafe, restaurant, eat, biryani, dhaba, blinkit |
| transport | ola, uber, rapido, metro, irctc, makemytrip, redbus, train, flight, bus, cab |
| shopping  | amazon, flipkart, myntra, ajio, meesho, nykaa, shop, mall, store, fashion |
| bills     | jio, airtel, bsnl, vodafone, electricity, water, gas, bill, recharge, netflix, hotstar, prime |
| health    | apollo, medplus, pharma, hospital, clinic, doctor, medicine, health |
| fuel      | petrol, diesel, fuel, hp, iocl, bharat petroleum, shell            |
| groceries | bigbasket, grofers, dmart, reliance fresh, grocery, kirana         |
| other     | anything not matched above                                          |

## What gets skipped

SMS containing `otp`, `password`, or `verif` are immediately discarded. These are OTP messages, not transactions.

## Merchant canonicalization (Phase 2)

Raw names are cleaned before display and categorization:

- **Alias map** — variant spellings merge (`AMZN`, `AMAZON PAY` -> `Amazon`;
  `DOMINO'S` -> `Dominos`; `OLA CABS` -> `Ola`; `APOLLO PHARMACY` -> `Apollo`).
  About 45 merchants are covered; the full list lives in `MERCHANT_ALIASES`.
- **UPI handles** — `rahul.sharma42@okhdfc` becomes `Rahul Sharma`.
- **Typo tolerance** — one small typo still merges (`SWIGY` -> `Swiggy`),
  but unrelated names never merge (`SWIGGY Residency Hotel` stays).
- **Unknown merchants** — tidied into readable names instead of raw fragments.
- **Your renames win** — editing an SMS expense's description stores the
  mapping in `localStorage` under `kharcha_merchant_aliases`, and future SMS
  with the same raw merchant use your name. A corrupted store is ignored,
  never crashes.

## Eval scoreboard (Phase 0)

`node tests/parser-eval.js` runs all of `tests/parser-golden.json` (51 anonymized
real-format SMS) through the real parser and reports per-field accuracy:

| Field | Phase 0 | Phase 1 | Phase 2 |
|---|---|---|---|
| amount | 100% (44/44) | 100% (44/44) | 100% (53/53) |
| type | 100% (44/44) | 100% (44/44) | 100% (53/53) |
| merchant | 84.1% (37/44) | 100% (44/44) | 100% (53/53) |
| category | 90.9% (40/44) | 100% (44/44) | 100% (53/53) |
| bank | 97.7% (43/44) | 100% (44/44) | 100% (53/53) |
| noise rejected | 71.4% (5/7) | 100% (7/7) | 100% (7/7) |
| overall | 94.5% | 100% | 100% (60 SMS) |
| false positives | 2 | 0 | 0 |

Phase 1 fixed all 14 misses: balance-only and UPI collect-request SMS are
rejected; merchant extraction uses tempered captures with candidate vetting;
`iob` no longer misfires on JIO; Dunzo maps to groceries.
Phase 2 added merchant canonicalization (aliases, VPA parsing, typo merging,
user-learned renames) with 9 new golden cases. The harness fails CI only on
a regression versus `tests/parser-baseline.json`. After a real fix,
re-record with `node tests/parser-eval.js --update` and commit the new
baseline.

## Example inputs and outputs

Input:
```
Rs.249.00 debited from your HDFC Bank account via UPI to Swiggy on 29-Sep-26. Avl Bal: Rs.12,450.
```

Output:
```json
{
  "amount": 249,
  "type": "debit",
  "merchant": "Swiggy",
  "category": "food",
  "bank": "HDFC",
  "source": "sms"
}
```

---

Input:
```
Your A/c XX1234 is credited with INR 5,000.00 by NEFT from Rahul Kumar. Ref 123456789.
```

Output:
```json
{
  "amount": 5000,
  "type": "credit",
  "merchant": "NEFT Transaction",
  "category": "other",
  "bank": null,
  "source": "sms"
}
```
