/**
 *
 * is_local.js stub, for tests only.
 *
 * The real jsx/is_local.js does not exist in a checkout. The `deploy` script
 * generates it from is_local.js.replace, and .gitignore excludes it, so it is
 * present only on a machine where a build has already been run.
 *
 * Four modules import it -- content/home-page.jsx, layout/data/data.jsx,
 * layout/stream/stream.jsx and layout/stream/alarm.jsx -- and all four sit inside
 * the route/main-route.jsx graph. Any test that imports the route table therefore
 * fails to load without it:
 *
 *     Cannot find module '../../../is_local.js' from 'import/layout/data/data.jsx'
 *
 * This is mapped in over the real path by 'moduleNameMapper' in jest.config.js,
 * so the suite is hermetic: it passes on a clean clone, in CI, and before any
 * build has been run.
 *
 * Note: false, not true. It stands for "this bundle was built for local
 *       development", and the tests are not exercising the local-development
 *       endpoints. A test that needs the other branch should mock this module
 *       itself rather than flipping the value here for everyone.
 *
 */

const is_local = false;

export default is_local;
