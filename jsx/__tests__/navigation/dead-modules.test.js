/**
 * dead-modules.test.js: every module in navigation/ loads.
 *
 * This file used to document two modules that could not be loaded at all:
 *
 *     nav-bar.jsx         -> ../redux/container/review-results-link.jsx
 *     menu-items/menu.jsx -> ../../svg/svg-navicon.jsx
 *
 * Neither import target exists anywhere in the repository, and neither module was
 * referenced by anything -- which is the only reason the bundle still built. Nothing
 * resolved them, so webpack never discovered the missing files.
 *
 * Both modules have since been REMOVED rather than guarded. Its earlier note said the
 * broken-import cases 'should simply be deleted' once resolved; deleting the modules
 * resolves it more completely than a tripwire does, since a module that cannot compile
 * has no path to becoming useful. nav-bar.jsx also linked to four '/session/*' routes
 * that the route table does not define, so it was written for an app this one is not.
 *
 * What remains is the part worth keeping: a sweep that loads every module in the
 * directory, driven off the filesystem, so a NEW navigation module with an
 * unresolvable import fails here even though no test renders it yet. That is the check
 * that would have caught both of these when they were first written.
 *
 * Note: '@aws-amplify/auth' is mocked for the sweep. user-menu.jsx imports it, and the
 *       real package ships untranspiled syntax that jest will not parse.
 */

jest.mock('@aws-amplify/auth', () => ({ __esModule: true, default: {} }));

const fs = require('fs');
const path = require('path');

const SOURCE_ROOT = path.join(__dirname, '..', '..', 'import');
const NAVIGATION = path.join(SOURCE_ROOT, 'navigation');

//
// deliberately empty: every module in navigation/ is now expected to load. It held
// the two unloadable modules that have since been deleted, and it stays as the
// documented place to record such a file rather than weakening the sweep below.
//
const KNOWN_DEAD = [];

function sourceFiles(dir) {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
        const full = path.join(dir, entry.name);

        if (entry.isDirectory()) {
            return sourceFiles(full);
        }
        return /\.jsx?$/.test(entry.name) ? [full] : [];
    });
}

describe('the modules that were removed', () => {
    it.each([
        ['nav-bar.jsx', path.join(NAVIGATION, 'nav-bar.jsx')],
        ['menu-items/menu.jsx', path.join(NAVIGATION, 'menu-items', 'menu.jsx')],
    ])('%s is gone, not merely unreferenced', (name, file) => {
        //
        // asserted rather than assumed: restoring either file would restore a module
        // that cannot be imported, and the sweep below would then fail with a missing
        // dependency rather than anything that names the real problem.
        //
        expect(fs.existsSync(file)).toBe(false);
    });

    it.each([
        ['review-results-link.jsx', path.join(SOURCE_ROOT, 'redux', 'container')],
        ['svg-navicon.jsx', path.join(SOURCE_ROOT, 'svg')],
    ])('%s, the dependency it wanted, still does not exist', (missing, dir) => {
        expect(fs.readdirSync(dir)).not.toContain(missing);
    });
});

describe('the rest of navigation/', () => {
    it('loads every module in the directory that is not known to be dead', () => {
        //
        // driven off the filesystem rather than a hard-coded list, so a NEW
        // navigation module with an unresolvable import is caught here even
        // though no test renders it yet.
        //
        const modules = sourceFiles(NAVIGATION)
            .map(file => path.relative(NAVIGATION, file).split(path.sep).join('/'))
            .filter(relative => !KNOWN_DEAD.includes(relative));

        expect(modules.length).toBeGreaterThan(0);

        modules.forEach(relative => {
            expect(require(path.join(NAVIGATION, relative)).default)
                .toEqual(expect.any(Function));
        });
    });
});
