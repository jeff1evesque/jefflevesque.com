# Account

`https://api.jefflevesque.com/v1/private/account`

A signed-in reader's own data, starting with the ingest alarms they subscribe to:

- The alarm page for each stream, `/stream/:stream/alarm`, lists the stream's alarms with
  a switch for each.
- The bell on each `/stream` row shows whether the reader holds any of that stream's
  alarms.
- Account Settings, `/:user/settings`, lists every subscription with a way out.

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

- **One alarm per stream, for now.** Every stream has one, an ingest alarm, which fires
  when the number of records in a window falls below a threshold.
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

Subscribing also needs the reader's email address to be verified, since that address is
where the alarms will go.

## Answers

Every answer is a JSON object with one key, `report`, as the public APIs answer.

| Status | When | `report` |
|---|---|---|
| 200 | a list, an unsubscribe, a subscription already held | the list, `null`, the subscription |
| 201 | a new subscription | the subscription |
| 400 | a subscribe with no accepted terms; the alarms asked for with no `stream` | `{"error": ...}` |
| 401 | a private request without a valid ID token | `{"error": "sign in required"}` |
| 403 | a subscribe from a reader whose email address is not verified | `{"error": ...}` |
| 404 | an unknown stream or alarm | `{"error": ...}` |
| 503 | the service busy, with `Retry-After` | `{"error": ...}` |

- **Caching:** every private answer carries `Cache-Control: no-store`. The alarm list is
  the same for everyone, and may be kept for an hour.
- **From a browser:** the private paths answer a CORS preflight from
  `https://www.jefflevesque.com` alone, allowing `GET`, `PUT` and `DELETE` with the
  `Authorization` and `Content-Type` headers. The alarm list answers any origin, as the
  public APIs do.

## In the application

- **URLs:** built by `alarmsUrl`, `subscriptionsUrl` and `subscriptionUrl`, in
  [`jsx/import/general/api-url.js`](https://github.com/jeff1evesque/jefflevesque.com/blob/master/jsx/import/general/api-url.js).
- **Calls:** made through
  [`jsx/import/general/account-api.js`](https://github.com/jeff1evesque/jefflevesque.com/blob/master/jsx/import/general/account-api.js).
  - Signed out, it makes no request at all.
  - A 401 is read as the session having ended, and a page then shows its signed-out view
    rather than an error.
  - Any other refusal carries the API's own message, which the page shows as it is.
- **The token:** read from the sign-in session by
  [`jsx/import/general/currentUser.js`](https://github.com/jeff1evesque/jefflevesque.com/blob/master/jsx/import/general/currentUser.js).
- **The terms version:** a subscribe sends `TERMS_VERSION`, from
  [`jsx/import/general/notice-terms.jsx`](https://github.com/jeff1evesque/jefflevesque.com/blob/master/jsx/import/general/notice-terms.jsx),
  which holds the terms text the version names.

There is no Try it out on this page, as there is on the public APIs' pages. A private
request needs a signed-in reader's token.
