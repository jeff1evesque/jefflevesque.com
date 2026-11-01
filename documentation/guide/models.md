# Models

Each night the site's models predict how S&P 500 stocks and their options will do.
[/model](https://www.jefflevesque.com/model) shows how well they do it.

## The stock models

Each night, a stock model makes three predictions for each of the roughly 500 stocks in
the S&P 500, for each of its holds:

- **Up or down:** the chance its price is higher at the end of the hold than at 9:40 AM.
- **Beats the average stock:** the chance it does better than the average of all S&P 500
  stocks over the same hold.
- **How far it moves:** how big the move is, up or down, compared with how much the
  stock's options expected it to move. The model gives a low, a middle and a high guess.

It also ranks its top 10 for each hold: the 10 stocks it's surest will go up. Top 10 gain
on /model is what buying those 10 at 9:40 AM and selling them at the end of the hold
made, after the gap between the buy and sell prices.

**Its holds:** each starts at 9:40 AM on the next trading day, and is graded on its own,
against its own baseline.

<div class="full-width" markdown>

| Hold | Ends | Graded |
|---|---|---|
| 1 day | 3:40 PM the same day | the next trading day |
| 5 days | 3:40 PM 5 trading days later | 6 trading days after the prediction |
| 20 days | 3:40 PM 20 trading days later | 21 trading days after the prediction |

</div>

The 1-day hold is the prediction the stock models have always made. The 5 and 20-day
holds run over the same days as the options models' holds.

**Combined** is the average of a day's three holds. It can only be worked out once the
20-day hold is graded, so it runs about a month behind. The top 10 has no Combined: a
20-day gain and a 1-day gain aren't the same kind of number.

The longer holds are new. If every trading day is built, the 5-day hold switches on with
the retrain on Saturday, Oct 31, 2026, and its first grades come in on Nov 11. The 20-day
hold switches on with the retrain on Saturday, Nov 21, and its first grades, with the
first Combined, come in on Dec 24. Until then, they have no grades to show.

**Why a new version is judged on the 1-day hold:** each night the trainer tries a new
version of every model, and it replaces the live one only if it beats the baseline on
recent test days. Those days' 5 and 20-day holds haven't ended yet, so only their 1-day grades
are known. The longer holds are judged later, on the days the model really predicted, by
the checks below.

**Its baseline:** the numbers the model is compared against. Every stock gets the same
ones:

- **Up or down:** the share of stocks that went up in the train split. If that's 52%,
  every stock gets a 52% chance of going up.
- **Beats the average stock:** every stock gets 50%, always.
- **How far it moves:** from the train split's moves. The low guess is a small move: only
  1 in 10 moves were smaller. The middle guess is the middle move. The high guess is a big
  move: only 1 in 10 were bigger.

For the top 10: 10 stocks picked at random. The 5-day and 20-day holds each get their own
numbers, from how stocks did over 5 or 20 days.

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

## How a new version is trained

Each night the trainer makes a new version of every model, and tests it on the newest 3
days with results, which it never trains on. If it beats the baseline on them, it goes
live and makes the next night's predictions. On a model's page, the panel under its
attempts says how each night's version started.

**Nightly update** ("Started from the version that took over Thu Oct 29."): most nights.
It starts with the live version's weights, the numbers that version learned, and keeps
training them, for up to 50 epochs (passes over its days). It trains on the newest day
before the test days, plus 15 to 20 older days picked at random from the latest 100 with
results. Its validation days are 3 more older days picked at random. It's scored on them
after each epoch, and stops once that score stops getting better.

**Weekly full retrain** ("Built from scratch."): Saturdays. It starts over with new
weights, for up to 500 epochs. It uses the latest 100 days with results, less the 3 test
days. Its validation days are the newest 3 of those, and it trains on the rest. A model's
first version is built this way too.

While a model is young, it has fewer older days than a nightly update picks, so the
update trains on all of them, and its days look like a weekly retrain's. Days with
incomplete data are skipped either way.

**Fine-tuning:** once a new version beats the baseline, it trains for 5 more epochs on its
3 test days, plus 3 older days it already trained on, picked at random. That way the
version that goes live has learned the newest days. Then it's scored on its validation
days again. If it does more than 0.005 worse there, the version from before the
fine-tune goes live instead.

The next night's update starts from the live version as it was before its fine-tune. The
fine-tune learned days the next night tests on, and a version is never tested on days it
learned.

## When a model is taken down

Every night the trainer checks each model against its baseline, looking back three ways:
each day on its own, the average of the last 5 days, and the average of the last 20
days. If the model keeps doing worse than its baseline, its live version is taken down,
and it predicts nothing until a new version beats the baseline. /model then shows it as
Behind baseline.

- Each day: worse 5 days in a row.
- The 5-day average: worse 10 days in a row.
- The 20-day average: worse 5 days in a row.

These checks run for every model, stock or options, on each of its holds. If any hold
keeps doing worse than its baseline, the live version is taken down.

A live version is also taken down if it went live without beating its baseline, or if its
track record shows nothing better than the baseline. A model's page says which of these
took it down.

## New models

A model is New until it has 20 graded days, and its pill counts them: "New · day 5 of
20". Until then its scores are averages of the days it has, so they can swing a lot.
