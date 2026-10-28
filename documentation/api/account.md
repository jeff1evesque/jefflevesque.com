# Account

`https://api.jefflevesque.com/v1/private/notifications`

A signed-in reader's own data, starting with the alarms they subscribe to: each stream's
ingest alarm, and each model's alarm.

- The alarm page for each stream, `/stream/:stream/alarm`, lists the stream's alarms with
  a switch for each.
- The bell beside each stream on `/stream` shows whether the reader holds any of that
  stream's alarms: on its row, and beside its title once it is open on its own -- which
  is where a phone shows it.
- The alarm page for each model, `/model/:model/alarm`, does the same for the model's
  alarms. Its bell is on its row of `/model`, and beside its name on `/model/:model`.
- Account Settings, `/:user/settings`, verifies the reader's email address, and lists
  every subscription, a stream's or a model's, with a way out.

It is unlike the four public APIs in the ways that matter here:

- It answers only a signed-in reader, and nothing in a request but the reader's sign-in
  token says who is asking.
- Its answers are never cached.
- It is tracked in its own codebase.

## Endpoints

| Method | Path | What it does |
|---|---|---|
| GET | `/v1/private/notifications` | the reader's subscriptions, a stream's and a model's |
| PUT | `/v1/private/notifications/stream/{stream}/{alarm}` | subscribe to a stream's alarm, with `{"terms": "<version>"}` |
| DELETE | `/v1/private/notifications/stream/{stream}/{alarm}` | unsubscribe from it |
| PUT | `/v1/private/notifications/model/{model}/{alarm}` | subscribe to a model's alarm, with `{"terms": "<version>"}` |
| DELETE | `/v1/private/notifications/model/{model}/{alarm}` | unsubscribe from it |
| GET | `/v1/public/alarms?stream={stream}` | a stream's alarms, for anyone |
| GET | `/v1/public/alarms?model={model}` | a model's alarms, for anyone: none for a retired model |

A subscription is a stream's or a model's, named by which it is:

```json
{"stream": "bls", "alarm": "ingest", "since": "2026-09-26T12:00:00Z", "terms": "2026-09"}
{"model": "pt-gnn", "alarm": "live", "since": "2026-10-18T12:00:00Z", "terms": "2026-10"}
```

and the alarms are a list of these, a stream's and a model's:

```json
{"id": "ingest", "name": "Bureau of Labor Statistics ingest"}
{"id": "live", "name": "pt-gnn goes live ahead of the baseline"}
```

- **One alarm per stream, for now: its ingest alarm.** A stream goes into alarm when it
  has had no new records for longer than its usual gap, and recovers when records arrive
  again. The usual gap is a couple of hours for the weather feed, about a business day
  for the market and filings feeds, about a day and a half for the SEC's company facts,
  every day counted, and longer for the feeds that publish weekly or monthly.
- **One alarm per model: `live`.** It goes off when a new version goes live and, on the
  days it was tested on, its loss is lower than both the version it replaced and the
  know-nothing baseline's. Not every go-live does: a new version that goes live doesn't
  always beat both, and a first version has no version to beat, so it never sets the
  alarm off. A model has the alarm only while the model API lists it and
  it has not retired.
- **The ids are the site's own.** A stream is named by the id the rest of the site uses,
  such as `stock-market`, and a model by its name on `/model`, such as `pt-gnn`.
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
| 400 | a subscribe with no accepted terms; the alarms asked for with neither a `stream` nor a `model`, or with both | `{"error": ...}` |
| 401 | a private request without a valid ID token: none, a malformed one, or one past its hour | none, for most: the request is refused before it reaches the API, and the body is `{"message": "Unauthorized", ...}`. One the API itself refuses carries `{"error": "sign in required"}` |
| 403 | a subscribe from a reader whose email address is not verified | `{"error": ...}` |
| 404 | an unknown stream or alarm; a model the model API's listing doesn't name, and a retired model's alarm | `{"error": ...}` |
| 503 | the service busy, or the models couldn't be checked, with `Retry-After` | `{"error": ...}` |

- **A model's subscription can always be removed,** whether the model has retired, is no
  longer listed, or can't be checked right now.

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

# your subscriptions, a stream's and a model's
requests.get(f'{API}/v1/private/notifications', headers=AS_ME).json()

# subscribe to a stream's alarm, accepting the terms by their version
requests.put(
    f'{API}/v1/private/notifications/stream/bls/ingest',
    headers=AS_ME,
    json={'terms': '2026-10'},
).json()

# unsubscribe
requests.delete(f'{API}/v1/private/notifications/stream/bls/ingest', headers=AS_ME).json()

# a model's alarms: public too
requests.get(f'{API}/v1/public/alarms', params={'model': 'pt-gnn'}).json()

# subscribe to a model's alarm, the same way
requests.put(
    f'{API}/v1/private/notifications/model/pt-gnn/live',
    headers=AS_ME,
    json={'terms': '2026-10'},
).json()

# unsubscribe from it
requests.delete(f'{API}/v1/private/notifications/model/pt-gnn/live', headers=AS_ME).json()
```

Each answers with a `report`: the alarms, your subscriptions, the subscription, and
`null`. When one is refused, the status says why:

- **401:** the token has expired. An ID token lasts an hour, so copy a fresh one from
  Account Settings.
- **403:** your email address isn't verified yet, and alarms go to it. Verify it in
  Account Settings, under Email address, then copy a fresh token.
- **404:** an unknown stream, model or alarm, or a model that has retired.
  `/v1/public/alarms?stream=` lists a stream's alarms, and `?model=` a model's.
- **429:** too many requests in a short time. Wait a moment, then repeat.
- **503:** busy, or the models couldn't be checked. Wait the `Retry-After` seconds, then
  repeat. Every request is safe to repeat.
- **`terms`:** the version of the terms you accept by subscribing, `2026-10` today
  (`TERMS_VERSION`). Each alarm page shows them, a stream's and a model's, and so does
  [Terms](../terms.md). A subscription made under an earlier version keeps it.

## In the application

- **URLs:** built by `alarmsUrl`, `subscriptionsUrl` and `subscriptionUrl` for a stream,
  and `modelAlarmsUrl` and `modelSubscriptionUrl` for a model, in
  [`jsx/import/general/api-url.js`](https://github.com/jeff1evesque/jefflevesque.com/blob/master/jsx/import/general/api-url.js).
- **Calls:** made through
  [`jsx/import/general/account-api.js`](https://github.com/jeff1evesque/jefflevesque.com/blob/master/jsx/import/general/account-api.js):
  `listSubscriptions`, `subscribe`, `unsubscribe` and `streamAlarms` for a stream, and
  `subscribeModel`, `unsubscribeModel` and `modelAlarms` for a model.
  - Signed out, it makes no request at all. A model's alarm page asks nothing of the API
    for a reader signed out, not even the model's public list of alarms.
  - A 401 is read as the session having ended, and a page then shows its signed-out view
    rather than an error.
  - A subscribe's 403 is an email address to verify. Both alarm pages say so, and link to
    the Email address section of Account Settings, through
    [`jsx/import/general/settings-path.js`](https://github.com/jeff1evesque/jefflevesque.com/blob/master/jsx/import/general/settings-path.js).
  - Any other refusal carries the API's own message, which the page shows as it is.
- **A model's alarm page:**
  [`jsx/import/layout/model/model-alarm.jsx`](https://github.com/jeff1evesque/jefflevesque.com/blob/master/jsx/import/layout/model/model-alarm.jsx).
  Who the model is, and whether it has retired, it reads from the model API's listing, as
  the model's own page does.
- **The bells:** `/stream` lights a stream's bell for that stream's subscriptions alone,
  and `/model` and `/model/:model` a model's for that model's. Each page asks for the
  reader's subscriptions once.
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
  which holds the terms text the version names, `TERMS`. Both alarm pages show it.

There is no Try it out on this page, as there is on the public APIs' pages. A private
request needs a signed-in reader's token, and the API answers a browser only from
`https://www.jefflevesque.com`, which this documentation site is not.
