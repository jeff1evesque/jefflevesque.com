# Models

Each night the site's models predict how S&P 500 stocks and their options will do.
[/model](https://www.jefflevesque.com/model) shows how well they do it.

## The stock models

Each night, a stock model makes three predictions for each of the roughly 500 stocks in
the S&P 500, about the next trading day from 9:40 AM to 3:40 PM:

- **Up or down:** the chance its price is higher at 3:40 PM than at 9:40 AM.
- **Beats the average stock:** the chance it does better than the average of all S&P 500
  stocks over those same hours.
- **How far it moves:** how big the move is, up or down, compared with how much the
  stock's options expected it to move. The model gives a low, a middle and a high guess.

It also ranks its top 10: the 10 stocks it's surest will go up. Top 10 gain on /model is
what buying those 10 at 9:40 AM and selling them at 3:40 PM made, after the gap between
the buy and sell prices.

The stock models only look one day ahead. Each prediction is graded once that day's
3:40 PM prices are in.

**Its baseline:** the averages of its train split, given to every stock: the share of
stocks that went up (say 52%), 50% for beating the average stock, and the usual size of a
move. For the top 10, what 10 random stocks made.

## The options models

For each of those stocks' options, an options model predicts the chance it makes money if
bought at 9:40 AM the next trading day and held 1, 5 or 20 trading days, then sold at
3:40 PM, after the gap between the buy and sell prices. Its picks are on a page of their
own, for signed-in readers.

**Its baseline:** how often similar options made money in its train split: the same
hold, call or put, about as far in or out of the money, and a similar time to expiry.
For the top 10, what 10 random options made.

## What they read

Each night they read the day's [knowledge graph](https://www.jefflevesque.com/graph),
built from the [data this site collects](https://www.jefflevesque.com/stream).

## How they're graded, and the baseline

Each model is compared with a baseline. The baseline is made from the train split only,
the same days the model learns from. Both are then graded on the same test days, which
aren't in the train split.

**The model:**

1. Learns from the train split.
2. On a test day, gives each ticker its own number: Apple 60% up, Tesla 45% up, and so on.
3. Is graded against what really happened that day: a loss of 1.712.

**The baseline (it learns nothing):**

1. Takes one average from the train split: say 52% of tickers went up.
2. On the same test day, gives every ticker that same number: 52%.
3. Is graded against what really happened that day, the same way: a loss of 1.648.

**Why it's used:** a loss of 1.712 on its own tells you nothing. Is that good or bad?
Comparing it to "52% for every ticker" tells you. If a model can't beat the plain
average, it didn't learn anything useful from the data. Here it didn't: lower is better,
and 1.712 is worse than 1.648. These are tables-gnn's real numbers from Oct 21, 2026.

On /model, ▲ beside a score means the model beat the baseline, and ▼ means it didn't.

## When a model is taken down

Every night the trainer checks each model against its baseline, looking back three ways:
each day on its own, the average of the last 5 days, and the average of the last 20
days. If the model keeps doing worse than its baseline, its live version is taken down,
and it predicts nothing until a new version beats the baseline. /model then shows it as
Behind baseline.

- Each day: worse 5 days in a row.
- The 5-day average: worse 10 days in a row.
- The 20-day average: worse 5 days in a row.

These checks run for every model, stock or options. An options model is checked this way
for each of its holds.

## New models

A model is New until it has 20 graded days, and its pill counts them: "New · day 5 of
20". Until then its scores are averages of the days it has, so they can swing a lot.
