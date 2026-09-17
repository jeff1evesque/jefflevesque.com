---
name: Change
about: A behaviour or feature change, with the tests and docs it drags along
title: ''
labels: ''
assignees: ''
---

<!--
  A skeleton, not a form. Overwrite it, reorder it, delete what does not apply
  -- including these comments. The sections below are the ones that have
  actually carried the right information in this repository's issues.

  Conventions, stated here because this is where they get read:

    * branch    feature-<issue>
    * commit    #<issue>: <file>, <what changed>

  One line per commit, no body, one commit per file. Merges are squashes, so
  what lands on master is the PULL REQUEST title with ` (#N)` appended -- give
  the pull request the subject you want in the history. `.githooks/pre-push`
  and the branch ruleset both refuse a direct push to master.
-->

## Problem

<!-- What is wrong or missing today, and what it costs. -->

## What already exists

<!--
  The section that saves the most review time.

  This repository holds several near-misses that look like the thing being
  proposed and are not, so say what is already there and why it does not cover
  this. An issue that skips this gets re-litigated in review instead of read.
-->

## Proposal

<!-- What changes, and why this shape rather than the alternatives. -->

## What this change has to land with

<!--
  Three things, and only the first is obvious. All three ride in the same pull
  request -- a follow-up commit for the tests or the docs is the failure mode
  this list exists to prevent.
-->

- [ ] **The code.**
- [ ] **Unit tests**, under `jsx/__tests__/`, mirroring the path the change has
      in `jsx/import/`. `jsx/jest.config.js` holds a **floor on statements,
      branches, functions and lines** and fails the run below it -- read the
      figure there rather than from here, because it is raised periodically and
      every prose copy of it has gone stale between raises. Branches and
      functions bind first -- they carry the least room above the floor, so a
      build reddens on a new untested *branch* long before anything else.
      Coverage is collected from the whole `import/` tree rather than from
      whatever a test imported, so a new file with no test reads 0% instead of
      being absent from the report.

      `cd jsx && npx jest --config jest.config.js`
- [ ] **The documentation.** The pages under `documentation/`, `README.md`, and
      these templates are the prose. `docs.yml` builds the pages strictly, so a
      link to a page, an anchor or a README section that no longer exists fails
      the pull request -- but **nothing checks that what a page says is still
      true**, so a claim that stops being true ships silently and stays. This is
      the item most easily skipped and the one with the least machinery behind
      it: #9 and #11 were both README corrections that should have ridden along
      with the changes that invalidated them.

## Code changes

<!-- The files, and what moves in each. -->

## Unit tests

<!--
  Which suites, and what each one pins.

  Measure coverage against the COMMITTED tree, not the working copy -- an
  uncommitted test file is still collected, so a local run can report a figure
  CI cannot reach. `jsx/jest.config.js` documents the throwaway-worktree check.

  If the change deliberately preserves behaviour that is wrong, label the test
  `DOCUMENTS A DEFECT` and say what it should do instead. That is what makes a
  later fix break the test loudly rather than change behaviour quietly.
-->

## Documentation

<!--
  Which pages this makes stale, and what they should say instead.

  "None" is a legitimate answer. State it rather than leaving the section
  empty, so a reviewer can tell the question was asked.
-->

## Acceptance criteria

<!-- Checkable, and specific to this change rather than to changes generally. -->

- [ ]

## Out of scope

<!-- What this issue deliberately does not do, and where that goes instead. -->

<!--
  What gates the pull request, so nobody has to open the workflows to find out:

    lint.yml      ruff (.ruff.toml) and eslint (jsx/eslint.config.mjs), both
                  correctness rules only -- a red build is a defect, not a
                  style preference
    unicode.yml   scripts/check_unicode.py -- invisible and confusable
                  characters in tracked files
    tests.yml     jest, and the coverage floor above
    gitleaks.yml  committed secrets, over full history (fetch-depth: 0)
    trivy.yml     HIGH/CRITICAL dependency advisories. Also runs weekly on a
                  schedule, so this one can go red with no push behind it
    docs.yml      a strict mkdocs build of documentation/, deployed to GitHub
                  Pages on master
    links.yml     that the URLs in documentation/ and README.md resolve --
                  weekly and by hand, never on a pull request

  `.githooks/pre-commit` runs the unicode, secret, ruff and eslint checks
  against staged files, so those four fail before the push rather than after:

      git config core.hooksPath .githooks
-->
