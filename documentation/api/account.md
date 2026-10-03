# Account

`https://api.jefflevesque.com/v1/private/account`

A signed-in reader's own data, starting with the ingest alarms they subscribe to:

- The alarm page for each stream, `/stream/:stream/alarm`, lists the stream's alarms with
  a switch for each.
- The bell beside each stream on `/stream` shows whether the reader holds any of that
  stream's alarms: on its row, and beside its title once it is open on its own -- which
  is where a phone shows it.
- Account Settings, `/:user/settings`, verifies the reader's email address, and lists
  every subscription with a way out.

It is unlike the three public APIs in the ways that matter here:

- It answers only a signed-in reader, and nothing in a request but the reader's sign-in
  token says who is asking.
- Its answers are never cached.
- It is tracked in its own codebase.

## Endpoints

| Method | Path | What it does |
|---|---|---|
| GET | `/v1/private/account/subscriptions` | the reader's subscriptions |
| PUT | `/v1/private/account/subscriptions/{stream}/{alarm}` | subscribe, with `{"terms": "<version>"}` |
| DELETE | `/v1/private/account/subscriptions/{stream}/{alarm}` | unsubscribe |
| GET | `/v1/public/alarms?stream={stream}` | a stream's alarms, for anyone |

A subscription is:

```json
{"stream": "bls", "alarm": "ingest", "since": "2026-09-26T12:00:00Z", "terms": "2026-09"}
```

and a stream's alarms are a list of these:

```json
{"id": "ingest", "name": "Bureau of Labor Statistics ingest"}
```

- **One alarm per stream, for now: its ingest alarm.** A stream goes into alarm when it
  has had no new records for longer than its usual gap, and recovers when records arrive
  again. The usual gap is a couple of hours for the weather feed, about a business day
  for the market and filings feeds, and longer for the feeds that publish weekly or
  monthly.
- **The ids are the site's own.** A stream is named by the id the rest of the site uses,
  such as `stock-market`.
- **Repeating a request changes nothing.** Subscribing to an alarm already held, or
  unsubscribing from one not held, succeeds and leaves things as they were.
- **`terms` is the version of the terms the reader accepted.** The alarm page shows the
  terms and sends their version, and the subscription keeps it.

## Signing a request

Each private request carries the reader's **ID token**:

```
Authorization: Bearer <ID token>
```

No username, user id or email address is ever sent. One in a path, a query or a body is
not read.

A signed-in reader can copy their own token from Account Settings, under API access. It
lasts an hour.

Subscribing also needs the reader's email address to be verified, since that address is
where the alarms will go. The reader verifies it in Account Settings, under Email address,
with a code sent to it. The token carries whether it is verified, so one copied before
that still says it isn't: copy a fresh one.

## Answers

Every answer the API gives is a JSON object with one key, `report`, as the public APIs
answer. Most requests without a valid token never reach it: see 401.

| Status | When | `report` |
|---|---|---|
| 200 | a list, an unsubscribe, a subscription already held | the list, `null`, the subscription |
| 201 | a new subscription | the subscription |
| 400 | a subscribe with no accepted terms; the alarms asked for with no `stream` | `{"error": ...}` |
| 401 | a private request without a valid ID token: none, a malformed one, or one past its hour | none, for most: the request is refused before it reaches the API, and the body is `{"message": "Unauthorized", ...}`. One the API itself refuses carries `{"error": "sign in required"}` |
| 403 | a subscribe from a reader whose email address is not verified | `{"error": ...}` |
| 404 | an unknown stream or alarm | `{"error": ...}` |
| 503 | the service busy, with `Retry-After` | `{"error": ...}` |

- **Caching:** every private answer carries `Cache-Control: no-store`. The alarm list is
  the same for everyone, and may be kept for an hour.
- **From a browser:** the private paths answer a CORS preflight from
  `https://www.jefflevesque.com` alone, allowing `GET`, `PUT` and `DELETE` with the
  `Authorization` and `Content-Type` headers. The alarm list answers any origin, as the
  public APIs do.

## From Python

A script calls the API as the site's pages do, with your ID token. Copy it from Account
Settings, under API access. These use `requests`:

```python
import requests

API = 'https://api.jefflevesque.com'
TOKEN = '<your ID token, copied from Account Settings>'
AS_ME = {'Authorization': f'Bearer {TOKEN}'}

# a stream's alarms: public, no token needed
requests.get(f'{API}/v1/public/alarms', params={'stream': 'bls'}).json()

# your subscriptions
requests.get(f'{API}/v1/private/account/subscriptions', headers=AS_ME).json()

# subscribe to an alarm, accepting the terms by their version
requests.put(
    f'{API}/v1/private/account/subscriptions/bls/ingest',
    headers=AS_ME,
    json={'terms': '2026-09'},
).json()

# unsubscribe
requests.delete(f'{API}/v1/private/account/subscriptions/bls/ingest', headers=AS_ME).json()
```

Each answers with a `report`: the stream's alarms, your subscriptions, the subscription,
and `null`. When one is refused, the status says why:

- **401:** the token has expired. An ID token lasts an hour, so copy a fresh one from
  Account Settings.
- **403:** your email address isn't verified yet, and alarms go to it. Verify it in
  Account Settings, under Email address, then copy a fresh token.
- **404:** an unknown stream or alarm. `/v1/public/alarms?stream=` lists a stream's
  alarms.
- **429:** too many requests in a short time. Wait a moment, then repeat.
- **503:** busy. Wait the `Retry-After` seconds, then repeat. Every request is safe to
  repeat.
- **`terms`:** the version of the terms you accept by subscribing, `2026-09` today
  (`TERMS_VERSION`). Each stream's alarm page shows them, and so does
  [Terms](../terms.md).

## In the application

- **URLs:** built by `alarmsUrl`, `subscriptionsUrl` and `subscriptionUrl`, in
  [`jsx/import/general/api-url.js`](https://github.com/jeff1evesque/jefflevesque.com/blob/master/jsx/import/general/api-url.js).
- **Calls:** made through
  [`jsx/import/general/account-api.js`](https://github.com/jeff1evesque/jefflevesque.com/blob/master/jsx/import/general/account-api.js).
  - Signed out, it makes no request at all.
  - A 401 is read as the session having ended, and a page then shows its signed-out view
    rather than an error.
  - A subscribe's 403 is an email address to verify. The alarm page says so, and links to
    the Email address section of Account Settings.
  - Any other refusal carries the API's own message, which the page shows as it is.
- **The token:** read from the sign-in session by
  [`jsx/import/general/currentUser.js`](https://github.com/jeff1evesque/jefflevesque.com/blob/master/jsx/import/general/currentUser.js).
- **The token, to copy:** Account Settings shows the reader their own, under API access,
  in
  [`jsx/import/layout/user/settings.jsx`](https://github.com/jeff1evesque/jefflevesque.com/blob/master/jsx/import/layout/user/settings.jsx).
  It is hidden until they ask for it, read fresh when they do, and says when it expires.
- **The email address:** Account Settings shows the reader's address and whether it is
  verified, and verifies one that isn't with a code sent to it, through
  [`jsx/import/general/email-address.js`](https://github.com/jeff1evesque/jefflevesque.com/blob/master/jsx/import/general/email-address.js).
  A verify refreshes the session, so the reader can subscribe at once, without signing out
  and in again.
- **The terms version:** a subscribe sends `TERMS_VERSION`, from
  [`jsx/import/general/notice-terms.jsx`](https://github.com/jeff1evesque/jefflevesque.com/blob/master/jsx/import/general/notice-terms.jsx),
  which holds the terms text the version names.

There is no Try it out on this page, as there is on the public APIs' pages. A private
request needs a signed-in reader's token, and the API answers a browser only from
`https://www.jefflevesque.com`, which this documentation site is not.
