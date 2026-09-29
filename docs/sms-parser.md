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
