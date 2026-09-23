# Routes

--8<-- "README.md:routes"

The API column names what a route reads; see [APIs](../api/index.md). A route without
one reads static files, or nothing at all.

The routes are declared in
[`jsx/import/route/main-route.jsx`](https://github.com/jeff1evesque/jefflevesque.com/blob/master/jsx/import/route/main-route.jsx).

!!! note "A stream is named by its id"

    `:stream`, and the `?item=` the `/stream` and `/data` listings link to, take a
    stream's id: `stock-market`, `stock-split`, `bls`, `sec` or `us-national-weather`,
    from
    [`jsx/import/general/stream-id.js`](https://github.com/jeff1evesque/jefflevesque.com/blob/master/jsx/import/general/stream-id.js).
    The same id is what the site sends the performance api.

    An address naming a stream by a name it used to go by, such as
    `/stream/StockMarket/alarm` or `/data?item=usnationalweather`, still loads, and is
    replaced with the address naming it by its id. The router does that in the browser,
    before the page loads anything; it is not an HTTP redirect.

!!! note "A single unknown segment is not a 404"

    The route table carries `/:user`, so an address one segment deep that matches no
    other route, such as `/no-such-page`, renders the account layout rather than the
    error page. Only deeper unmatched paths reach the 404. A test pins this as a known
    defect; see [Testing](../development/testing.md#tests-that-document-defects).
