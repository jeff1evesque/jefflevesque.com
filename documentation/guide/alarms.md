# Alarms

An alarm tells you, by email, about something on the site you asked to hear about:

- **A stream's alarm:** when one of the site's streams has gone quiet, because the data
  it collects has stopped arriving.
- **A model's alarm:** when one of the models has a new version that goes live ahead of
  its previous version.

You choose which streams and models to hear about.

## What a stream's alarm is

Each stream has one alarm, its ingest alarm. The S&P 500 Tickers, the newest stream,
has none yet.

- **Into alarm:** a stream goes into alarm when it has had no new records for longer
  than its usual gap.
- **Recovered:** it recovers when records arrive again.
- **The usual gap differs by stream:**
  - a couple of hours for the weather feed;
  - about a business day for the market and filings feeds;
  - about a day and a half for the SEC's company facts, every day counted, since
    they run Monday to Saturday;
  - longer for the feeds that publish weekly or monthly.

## What a model's alarm is

Each model on [Model](https://www.jefflevesque.com/model) has one alarm, its live alarm,
until it retires.

- **What sets it off:** a new version goes live, and on the days it was tested on, which
  it was not trained on, its loss is lower than both the version it replaced and the
  know-nothing baseline's. Lower is better.
- **How often:** less often than a model goes live. Every new version that goes live is
  ahead of the baseline, but few are ahead of the version they replaced. From 2026-10-27
  to 2026-10-29, the four models went live 6 times between them, and 2 of those were
  ahead of their previous version.
- **Never for a first version:** it has no live version to beat, and a model is only
  listed, and so can only be subscribed to, once its first version is live.
- **A retired model** is no longer trained, so it can't go live again, and has no alarm
  to subscribe to.

A model's alarm says how one version scored on the days it was tested on. It is not
investment advice, and nothing on this site is a recommendation to buy or sell anything.

## Subscribing

1. **Sign in.** If you have no account, sign up from the header.
2. **Verify your email address,** under Email address in Account Settings, which is in
   the menu behind the person icon in the header. It shows your address, and whether it
   is verified. If it isn't, choose "Send a code", then enter the code from the email
   and choose "Verify". Alarms go by email, so an address that isn't verified can't
   subscribe, and an account made without one can't add it afterwards.
3. **Follow a bell to an alarm page:**
   - a stream's, from its row on [Stream](https://www.jefflevesque.com/stream);
   - a model's, from its row on [Model](https://www.jefflevesque.com/model), or from
     beside its name on the model's own page.
4. **Read the terms and conditions** (also on [Terms](../terms.md)), and tick "I accept the terms and conditions".
5. **Turn the alarm's switch on.**

A bell of an alarm you subscribe to rings, in green: a stream's on the Stream page, and a
model's on the Model page and on the model's own page.

## Seeing and removing your subscriptions

- **Account Settings** lists every subscription: its stream or model, its alarm, and when
  it started, each with an Unsubscribe button. Once you are signed in, it is in the menu
  behind the person icon in the header.
- **The switch on an alarm page** turns its alarm off too. A retired model's alarm page
  has no switch, and offers an Unsubscribe instead, while you still hold its alarm.

## What arrives

- **A stream's alarm:** one email when the stream goes into alarm, and one when it
  recovers.
- **A model's alarm:** one email each time a new version goes live ahead of the
  baseline. It says what kind of version it was, a nightly update or a weekly retrain,
  and the night it went live, with its loss on the days it was tested on beside the
  loss of the version it replaced and the baseline's. It links the model's page and its
  alarm page, and says it is not investment advice.
- **Either way,** each email carries a link that unsubscribes you from that alarm. Most
  mail apps also show an unsubscribe button beside the email, which works in one click.

## From a script

The same subscriptions can be read and changed from a script, through the
[account API](../api/account.md). Its page has
[examples in Python](../api/account.md#from-python), and what each refusal means.

A script needs your ID token. Account Settings shows it, under API access: hidden until
you ask for it, with a button to copy it and the time it expires. It lasts an hour. Treat
it like a password, since anyone holding it can act as you on the account API until it
expires.
