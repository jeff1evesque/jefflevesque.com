/**
 * pinned-clock.js: a test file's clock, held on a weekday in the middle of a
 * month, for the tests of the month /data opens on (#336).
 *
 * /data opens on the last weekday in New York, so on a weekend that starts a
 * month it opens on the month before -- see the constructor in data.jsx, and
 * data-internals.test.jsx, which pins that rule on days of its own. A test that
 * read the real clock expected this month, and failed whenever a month began on
 * a weekend, as Sunday, Nov 1, 2026 did, on master as on every branch.
 *
 * Note: only Date is held. Every timer runs as it does in any other test, so a
 *       file that waits on one waits as it always has.
 *
 * Note: noon, so New York is on the same day as the machine running the tests,
 *       wherever it is: a runner on UTC is still on that day at 8 AM in New
 *       York.
 */

//
// Wednesday, Oct 14, 2026, at noon
//
export const WEEKDAY = new Date(2026, 9, 14, 12);

//
// every timer jest can fake, which this leaves real
//
const TIMERS = [
    'hrtime',
    'nextTick',
    'performance',
    'queueMicrotask',
    'requestAnimationFrame',
    'cancelAnimationFrame',
    'requestIdleCallback',
    'cancelIdleCallback',
    'setImmediate',
    'clearImmediate',
    'setInterval',
    'clearInterval',
    'setTimeout',
    'clearTimeout',
];

/**
 * hold the clock on `at` for each test of the file or describe this is called
 * in, and give it back after each.
 */
export function holdClockOn(at = WEEKDAY) {
    beforeEach(() => {
        jest.useFakeTimers({ now: at, doNotFake: TIMERS });
    });

    afterEach(() => {
        jest.useRealTimers();
    });
}
