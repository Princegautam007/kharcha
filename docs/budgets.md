# Budgets

A budget is the most you want to spend in one category each month. Kharcha shows how much of each budget you have used, so you can slow down before you go over.

## Set a budget

1. Open Kharcha. At the top you will see the Budgets section.
2. Tap **Set**.
3. Type an amount in Rs. next to any category, for example Food or Fuel.
4. Tap **Save**.

The same limit is used for every month. Each month starts fresh, because only the spending of the month you are viewing is counted.

## Remove a budget

1. Tap **Set**.
2. Tap the **x** button next to the category, or delete the number in the box.
3. Tap **Save**.

Categories with an empty box have no limit and are not shown in the Budgets section.

## What the bars mean

- **Purple bar:** you have used less than 80 percent of the budget.
- **Yellow bar:** you have used 80 percent or more. You are close to the limit.
- **Red bar:** you have spent more than the budget.

Only money spent (debits) counts. Money received is ignored.

## Backup and restore

Your budgets are saved in the same backup file as your transactions. When you restore a backup:

- Budgets from the file are added for categories that have no budget yet.
- A budget you already set is never replaced.
- Anything in the file that is not a valid amount, or is for an unknown category, is ignored.

Backup files made before budgets existed still restore normally.

## Where budgets are stored

Budgets stay on your device in the browser storage, under the name `kharcha_budgets`. Nothing is sent anywhere.

## Category mapping examples

A budget only counts spending that lands in that category, so it helps to know
how transactions are grouped. Kharcha picks the category from the merchant name
in the SMS (or the category you choose when adding by hand):

| Category  | Typical merchants and keywords                                              |
|-----------|-----------------------------------------------------------------------------|
| Food      | Swiggy, Zomato, KFC, McDonald's, pizza, cafe, restaurant, Starbucks         |
| Groceries | Blinkit, Zepto, BigBasket, DMart, JioMart, kirana, grocery store            |
| Transport | Ola, Uber, Rapido, IRCTC, metro, redbus, train, flight, bus, FASTag, toll   |
| Shopping  | Amazon, Flipkart, Myntra, Ajio, Nykaa, Croma, Decathlon, IKEA               |
| Bills     | Jio, Airtel, electricity, water, gas, recharge, Netflix, broadband, insurance |
| Health    | Apollo Pharmacy, PharmEasy, Tata 1mg, hospital, clinic, doctor, medicine    |
| Fuel      | petrol, diesel, HP, Indian Oil, HPCL, BPCL, Shell                           |
| Other     | everything that does not match the keywords above                           |

Examples:

- `Rs. 640 paid to BLINKIT via UPI` counts towards your **Groceries** budget,
  not Food — grocery stores are matched before restaurants.
- `Rs. 249 paid to Swiggy` counts towards **Food**.
- A salary credit or a refund does not touch any budget; only debits count.

You can always fix a wrong category by editing the transaction, and the budget
follows the new category from then on.

## For developers

The tests for this feature are in `tests/budgets.test.js`. To run them you need Node.js 18 or newer. From the project folder, run:

    node tests/budgets.test.js

The tests load the script from `index.html` with simple stand-ins for the browser, so no browser is needed.
