# Quick start

--8<-- "README.md:quick-start"

`static/` is where the deployed site serves the bundle and stylesheet from, so the
commands above reproduce its layout locally.

With `is_local.js` set to `true`, `/stream` and `/data` are drawn from samples built
into their loaders rather than from the network. The knowledge graph is the exception:
`/graph` and the front page still call the knowledge graph API, which answers any
origin, `localhost` included — so the front page, which is the graph and nothing else,
shows the same real build locally that it shows deployed.

The configuration templates are described under
[Architecture](../application/architecture.md#configuration), and deploying the result
under [Deployment](../operations/deployment.md).
