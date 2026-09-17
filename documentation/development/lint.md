# Lint and hooks

[`lint.yml`](https://github.com/jeff1evesque/jefflevesque.com/blob/master/.github/workflows/lint.yml)
runs on every pull request and every push to master, and
[`.githooks/pre-commit`](https://github.com/jeff1evesque/jefflevesque.com/blob/master/.githooks/pre-commit)
runs the same checks locally, so the two cannot disagree.

| Check | What it lints | Rules |
|---|---|---|
| `ruff check .` | the Python files | [`.ruff.toml`](https://github.com/jeff1evesque/jefflevesque.com/blob/master/.ruff.toml) |
| `eslint` | the `.js` and `.jsx` files under [`jsx/`](https://github.com/jeff1evesque/jefflevesque.com/tree/master/jsx) | [`jsx/eslint.config.mjs`](https://github.com/jeff1evesque/jefflevesque.com/blob/master/jsx/eslint.config.mjs) |

## Correctness only

The ruff rule set is deliberately **correctness-only** (`E4`, `E7`, `E9`, `F`, `W6`):
syntax errors, undefined names, unused imports and variables, bare `except`, invalid
escape sequences. No formatting, import-ordering or type-annotation rules are enabled,
so a red build always means a real defect rather than a style preference. Notebooks are
excluded; several carry pasted tabular output inside code cells and are not parseable
Python.

The ESLint config follows the same philosophy: `no-undef`, `no-unused-vars`,
`no-dupe-keys`, `no-unreachable`, `no-cond-assign` and similar. No semicolon, quote,
indentation or spacing rules. Two settings are worth knowing about:

- **`eslint-plugin-react` is required, not cosmetic.** The application uses the classic
  JSX transform, so `<Foo />` compiles to `React.createElement(Foo)`. Core ESLint does
  not treat JSX as a *use* of an identifier, so without the plugin's `jsx-uses-react`
  and `jsx-uses-vars` rules, `no-unused-vars` reports every imported component --
  `React` included -- as unused.
- **`no-redeclare` is deliberately off.** It fires on a legacy pattern used throughout
  the codebase: a function-scoped `var` "redeclared" inside `if` and `else` branches.
  That behaves exactly as written, so it is a style complaint rather than a defect.

The `ruff` version is pinned in the workflow, so a new upstream release cannot redden
an untouched branch; bump it deliberately. ESLint 9 needs Node
`^18.18 || ^20.9 || >=21.1`, and the workflow pins Node 20.

## Running it by hand

```bash
pip install ruff==0.16.1
ruff check .
cd jsx && npm install && npx eslint .
```

## The hooks

Enable both hooks once per clone:

```bash
git config core.hooksPath .githooks
```

**pre-commit** checks the **staged** files. It rejects invisible and confusable Unicode
and anything shaped like a committed secret -- both checks are standard-library Python,
so a fresh clone is protected with nothing installed -- and lints staged Python with
ruff and staged JavaScript with ESLint.

A missing linter is a **hard failure**, not a skip. A lint that silently opts out on
the machines lacking the tool passes locally and then fails in CI on a commit already
pushed; see [#24](https://github.com/jeff1evesque/jefflevesque.com/issues/24). ruff is
looked for in the project's `.venv` before `PATH`, and ESLint needs Node 18.18 or newer.
To bypass the hook entirely, commit with `--no-verify`.

**pre-push**, in
[`.githooks/pre-push`](https://github.com/jeff1evesque/jefflevesque.com/blob/master/.githooks/pre-push),
refuses a push to master. Every merge comes through a pull request; work goes on a
`feature-<issue>` branch.
