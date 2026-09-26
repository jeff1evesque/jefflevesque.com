# Architecture

| | |
|---|---|
| UI | React 18, `react-router-dom` 6, Redux, MUI and react-bootstrap |
| Charts | recharts for area, bar and line charts, D3 for the force-directed graphs |
| Auth | AWS Amplify `Auth` against Cognito |
| Data | three public APIs, read in web workers; see [APIs](../api/index.md) |
| Bundler | webpack, with `build:prod` and `build:dev` |
| Styles | scss, compiled separately with `sass` |

## A static bundle

The application is a static bundle. It is compiled into `static/`, published to object
storage and served through a CDN; there is no server-side rendering and no application
server. Everything it displays comes from the three public APIs, called from the
reader's browser at runtime.

The JavaScript is compiled from JSX by Babel, with the presets in
[`jsx/.babelrc`](https://github.com/jeff1evesque/jefflevesque.com/blob/master/jsx/.babelrc),
and bundled by webpack into a single `content.js`, per
[`jsx/webpack.config.js`](https://github.com/jeff1evesque/jefflevesque.com/blob/master/jsx/webpack.config.js).
The JSX transform is the classic one, so `<Foo />` compiles to
`React.createElement(Foo)` -- which is why every component file imports `React`, and
why the lint needs `eslint-plugin-react` to see those imports as used; see
[Lint and hooks](../development/lint.md).

The stylesheet is compiled separately from
[`scss/style.scss`](https://github.com/jeff1evesque/jefflevesque.com/blob/master/scss/style.scss),
which imports one partial per area of the site.

## Light and dark

Every page is drawn in either theme, by the reader's own clock: light from 7 in the
morning until 7 in the evening, local time, and dark the rest of the day. The switch in
the header asks for the other theme until the clock's next switch, and the choice is
kept in the browser's storage until then -- through reloads and in other tabs -- by
[`jsx/import/general/theme-preference.js`](https://github.com/jeff1evesque/jefflevesque.com/blob/master/jsx/import/general/theme-preference.js).

A script in the head of
[`index.html`](https://github.com/jeff1evesque/jefflevesque.com/blob/master/index.html)
puts that theme on the root element as `data-theme` before anything is painted, and
[`jsx/import/general/theme-mode.jsx`](https://github.com/jeff1evesque/jefflevesque.com/blob/master/jsx/import/general/theme-mode.jsx)
keeps it there: it changes it when the switch is pressed, and at 7 o'clock while the
page is left open.

The stylesheet follows the attribute through custom properties that
[`scss/_theme.scss`](https://github.com/jeff1evesque/jefflevesque.com/blob/master/scss/_theme.scss)
sets for each theme. Every partial after it reads the neutral ramp -- `$gray-6`,
`$white-1` -- as those properties, and the ramp keeps its order in both themes: a higher
numeral is further from the page. So a rule written against the light theme's colors
draws the dark one too. The ink on the header's black bars is held fixed.

Whatever computes a color in script -- the two graphs, the charts, a tooltip -- reads
the theme from `ThemeModeContext` and its colors from `themeColors` in
[`jsx/import/general/colors.js`](https://github.com/jeff1evesque/jefflevesque.com/blob/master/jsx/import/general/colors.js),
and draws again when it changes. mui's components are handed a dark theme of their own.

## Web workers

API responses are parsed off the main thread. Each page hands the response to a worker
under
[`jsx/import/worker/`](https://github.com/jeff1evesque/jefflevesque.com/tree/master/jsx/import/worker),
one per stream or dataset, so a large month of records does not stall scrolling or the
charts while it is reduced to what they draw.

## Configuration

Three files follow the same `.replace` pattern: a committed template holding
`REPLACE-*` tokens, and a real file that is gitignored.

| Template | Becomes | Holds |
|---|---|---|
| [`jsx/aws-exports.js.replace`](https://github.com/jeff1evesque/jefflevesque.com/blob/master/jsx/aws-exports.js.replace) | `jsx/aws-exports.js` | Cognito pool, client and region |
| [`jsx/is_local.js.replace`](https://github.com/jeff1evesque/jefflevesque.com/blob/master/jsx/is_local.js.replace) | `jsx/is_local.js` | whether this build is local |
| [`deploy.replace`](https://github.com/jeff1evesque/jefflevesque.com/blob/master/deploy.replace) | `deploy` | the identifiers the deploy script substitutes |

That is why a fresh clone has the templates but not the files. The templates are
exempted by name in
[`.gitignore`](https://github.com/jeff1evesque/jefflevesque.com/blob/master/.gitignore),
because the globs that hide the generated files would otherwise hide the templates too
-- and a clone with no templates has nothing to build from.

The three API endpoints are not configuration. They are the same for every deployment,
and live in
[`jsx/import/general/api-url.js`](https://github.com/jeff1evesque/jefflevesque.com/blob/master/jsx/import/general/api-url.js).
