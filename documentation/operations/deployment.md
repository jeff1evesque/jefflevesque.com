# Deployment

## From a clone

For a full local build and publish, copy the deploy script from its template and fill
in the values at the top:

```bash
cp deploy.replace deploy
chmod +x deploy
./deploy --all              # javascript, css and images
./deploy --js               # javascript only
./deploy --css              # css only
./deploy --env=prod         # build:prod rather than build:dev
```

The template is
[`deploy.replace`](https://github.com/jeff1evesque/jefflevesque.com/blob/master/deploy.replace);
the copy, `deploy`, is gitignored, because it holds the identifiers of the distribution
being deployed to.

## On merge

Merges to master are built and published automatically. That path compiles the
JavaScript and the stylesheet, copies the result and the image assets to object
storage, and invalidates the CDN so the new bundle is served immediately. It
substitutes the same `REPLACE-*` tokens the local script does, taking the values from
deployment configuration rather than from a file on disk -- which is why no real
identifier is committed here.

## These pages

The documentation site deploys separately, from
[`.github/workflows/docs.yml`](https://github.com/jeff1evesque/jefflevesque.com/blob/master/.github/workflows/docs.yml),
on every push to master. See [This documentation](documentation.md).
