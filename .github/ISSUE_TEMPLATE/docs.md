---
name: Documentation
about: A page contradicts the code, or states a figure nothing measures any more
title: ''
labels: documentation
assignees: ''
---

<!--
  The documentation is the pages under `documentation/`, published by
  `docs.yml`, and `README.md`. CI builds the pages strictly and checks their
  links, so a page, an anchor or a README section that no longer exists fails
  the build -- but nothing checks that what a page SAYS is still true. That
  drift is found by someone noticing, which is what this template is for.

  Same conventions as any other change: a `feature-<issue>` branch, and commits
  reading `#<issue>: <file>, <what changed>`.
-->

## Which page, and where

<!-- `documentation/api/datalake.md:40`, or `README.md:60`. A line number, not
     just a file -- a page's heading can repeat on another page. -->

## What it currently claims

<!-- Quote it. -->

## What is actually true

<!-- And the file and line that make it so. -->

## Where the true value came from

<!--
  The field this template exists for.

  A configured value read off the source (`jsx/jest.config.js:127`) is stable
  and stays true until someone changes it. A measurement is true of the run
  that produced it and nothing else, so say which run, when, and under what
  conditions. An estimate is neither -- say that too.

  Without this, the correction is indistinguishable from the claim it replaces
  and gets re-introduced the next time someone measures differently.
-->

## The fix

<!--
  Sometimes the fix is to DELETE the figure rather than update it.

  A number no mechanism keeps true will drift again -- #11 removed a whole
  coverage table for exactly this reason, after three consecutive runs of an
  unchanged tree reported three different figures while the table quoted one to
  two decimal places as "current". The qualitative claim underneath it survived
  because it stays true.

  Prefer, in order: state nothing and point at the source; state a configured
  value that CI enforces; state a measurement with its provenance. Only
  hand-maintain a figure when none of those work, and say who will update it.
-->

## Acceptance criteria

- [ ]
