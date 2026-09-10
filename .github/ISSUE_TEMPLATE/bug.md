---
name: Bug
about: Something is wrong at runtime
title: ''
labels: bug
assignees: ''
---

<!--
  Overwrite freely, and delete these comments as you go.

  Fixes follow the same conventions as any other change: a `feature-<issue>`
  branch, and commits reading `#<issue>: <file>, <what changed>`. A fix needs
  the test that would have caught it, in the same pull request.
-->

## What happens

<!-- Quote what the page actually renders, verbatim. A screenshot loses the
     numbers, and the numbers are usually the bug. -->

## What was expected

<!-- And what says so -- the schedule, the API response, the arithmetic. -->

## Reproduction

<!--
  How this project parameterises a view. Fill in what applies and delete the
  rest; a bug that only appears on one combination is the common case here.
-->

- **Route** — <!-- `/stream`, `/stream/:stream/trigger`, `/stream/:stream/alarm`, `/data`, `/model`, `/:user`, ... -->
- **Stream** — <!-- bls / sec / stockmarket / stockmarketstocksplit / usnationalweather -->
- **Rate** — <!-- Minute / Hour / Day / Month on `/stream`; Minutes / Hourly / Daily / Monthly on a trigger chart -->
- **Window** — <!-- the rolling window in view, and the wall-clock time it was taken -->
- **Signed in** — <!-- yes / no. Cognito; a signed-out view reaches a different route table -->
- **Viewer timezone** — <!--
      Worth stating even when it looks irrelevant. This codebase reasons in
      eastern throughout -- dst.js, the ingest schedule and the chart
      aggregators all bucket by an eastern wall clock -- and the suite pins
      TZ=America/New_York for exactly that reason. A bug that reproduces only
      west of eastern, or only across a DST boundary, is a real class here.
  -->
- **Build** — <!-- deployed, or local with `is_local.js` true -->

## Evidence

<!--
  The application draws what the reporting API returned, so the response is the
  evidence and the chart is a rendering of it. Name the request and quote the
  figures rather than pasting a screenshot -- #34 is the worked example: the
  rendered row, then the per-hour counts underneath it that showed the row was
  wrong.

  Include anything the browser console said. Unexpected console output fails a
  test in this repository, so a warning in the browser is a signal rather than
  noise -- React reports most of its problems that way.
-->

## Why

<!-- If it is already understood: the file, the line, and the reasoning that
     was wrong. If not, delete this section rather than guessing in it. -->
