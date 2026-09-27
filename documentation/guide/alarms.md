# Alarms

An alarm tells you when one of the site's streams has gone quiet: when the data it
collects has stopped arriving. You choose which streams to hear about, and each alarm
comes to you by email.

## What an alarm is

Each stream has one alarm, its ingest alarm.

- **Into alarm:** a stream goes into alarm when it has had no new records for longer
  than its usual gap.
- **Recovered:** it recovers when records arrive again.
- **The usual gap differs by stream:**
  - a couple of hours for the weather feed;
  - about a business day for the market and filings feeds;
  - longer for the feeds that publish weekly or monthly.

## Subscribing

1. **Sign in.** If you have no account, sign up from the header.
2. **Verify your email address,** with the code the site sends it when you sign up. The
   login page asks for the code, and can send another. Alarms go by email, so an
   address that isn't verified can't subscribe.
3. **Open a stream from [Stream](https://www.jefflevesque.com/stream),** and follow its
   bell to the stream's alarm page.
4. **Read the terms and conditions,** and tick "I accept the terms and conditions".
5. **Turn the alarm's switch on.**

Back on the Stream page, the bell of a stream you subscribe to rings, in green.

## Seeing and removing your subscriptions

- **Account Settings** lists every subscription: its stream, its alarm, and when it
  started, each with an Unsubscribe button. Once you are signed in, it is in the menu
  behind the person icon in the header.
- **The switch on a stream's alarm page** turns its alarm off too.

## What arrives

- One email when a stream goes into alarm, and one when it recovers.
- Each email carries a link that unsubscribes you from that alarm. Most mail apps also
  show an unsubscribe button beside the email, which works in one click.

Alarm emails are not being sent yet. A subscription made now is kept, and its emails
start when sending does.

## From a script

The same subscriptions can be read and changed from a script, through the
[account API](../api/account.md). Its page has
[examples in Python](../api/account.md#from-python), and what each refusal means.

A script needs your ID token. Account Settings shows it, under API access: hidden until
you ask for it, with a button to copy it and the time it expires. It lasts an hour. Treat
it like a password, since anyone holding it can act as you on the account API until it
expires.
