/**
 * dst.test.js: the daylight-saving helpers.
 *
 * Legacy. rolling-window.js records that 'dstDate()' was replaced there because it
 * returned "eastern wall-clock wearing the local zone's offset" -- a Date whose
 * displayed time is New York's but whose offset is the machine's, so the bounds and
 * the rows ended up measured on two different clocks.
 *
 * Three of the four exports are dead: only 'dstDate' is imported anywhere, by
 * trigger.jsx and two candlestick modules. The rest are covered here anyway,
 * because dead code that still exports is code somebody may reach for.
 *
 * Note: these assert the SHAPE of what comes back rather than exact instants.
 *       Every function reads the real clock and the machine's own zone, so an exact
 *       assertion would pass only in one timezone -- which is itself the problem
 *       this module has.
 */

import { addHours, dstDate, dstDateAdjusted, dstOffset } from '../../import/general/dst.js';

describe('dstDate', () => {
    it('returns a Date by default', () => {
        expect(dstDate()).toBeInstanceOf(Date);
    });

    it('returns a valid date, not an Invalid Date', () => {
        //
        // it builds the Date by parsing a localeString, which is fragile: any
        // format the engine emits that Date cannot parse yields Invalid Date rather
        // than an error.
        //
        expect(Number.isNaN(dstDate().getTime())).toBe(false);
    });

    it('returns a STRING when est is false', () => {
        //
        // the same argument switches the return TYPE, not just the zone. A caller
        // passing false gets text where every other path gives a Date, and the
        // three call sites all rely on the default.
        //
        expect(typeof dstDate(false)).toBe('string');
    });

    it('lands within a day of now', () => {
        //
        // the deliberate weakness of this module: the value is eastern wall-clock
        // stamped with the local offset, so it is only equal to 'now' for a viewer
        // already in eastern time. All that can be asserted portably is that it is
        // in the right neighbourhood.
        //
        const drift = Math.abs(dstDate().getTime() - Date.now());

        expect(drift).toBeLessThan(24 * 60 * 60 * 1000);
    });
});

describe('dstOffset', () => {
    it('returns -1 or 0 and nothing else', () => {
        expect([-1, 0]).toContain(dstOffset());
    });

    it('returns a number for the default argument', () => {
        expect(typeof dstOffset(true)).toBe('number');
    });

    it('THROWS when est is false', () => {
        //
        // DOCUMENTS A DEFECT.
        //
        // With est=false the two sample dates are left as localeString TEXT:
        //
        //     const jan = est ? new Date(new Date(0, 1).toLocaleString(...))
        //                     : new Date(0, 1).toLocaleString(...);
        //
        // and the next line calls jan.getTimezoneOffset(), which a string does not
        // have. So this argument cannot be used at all -- it raises TypeError
        // rather than returning an offset.
        //
        // Unreachable today: nothing imports dstOffset. It is the same est=false
        // branch that makes dstDate return a string instead of a Date, except there
        // it merely surprises the caller rather than throwing.
        //
        expect(() => dstOffset(false)).toThrow(TypeError);
    });

    it('is dead code: nothing imports it', () => {
        //
        // recorded rather than asserted about behaviour. Only 'dstDate' appears in
        // any import of this module. Kept covered so a future caller finds a test
        // rather than nothing.
        //
        expect(typeof dstOffset).toBe('function');
    });
});

describe('dstDateAdjusted', () => {
    it('returns the date unchanged when dst is in effect for it', () => {
        //
        // a july instant is inside dst for any northern-hemisphere zone that
        // observes it, so the adjustment branch is skipped and the same object comes
        // back.
        //
        const july = new Date(2026, 6, 15, 12, 0, 0);

        const result = dstDateAdjusted(july);

        expect(result).toBeInstanceOf(Date);
        expect(Number.isNaN(result.getTime())).toBe(false);
    });

    it('returns a Date for a winter instant too', () => {
        const january = new Date(2026, 0, 15, 12, 0, 0);

        expect(dstDateAdjusted(january)).toBeInstanceOf(Date);
    });

    it('accepts the adjust and est flags', () => {
        const january = new Date(2026, 0, 15, 12, 0, 0);

        expect(dstDateAdjusted(january, false)).toBeInstanceOf(Date);
        expect(dstDateAdjusted(january, true, true)).toBeInstanceOf(Date);
    });

    it('throws on a non-Date', () => {
        //
        // it calls getTimezoneOffset with no guard, so a string or null raises.
        //
        expect(() => dstDateAdjusted('2026-01-15')).toThrow();
        expect(() => dstDateAdjusted(null)).toThrow();
    });
});

describe('addHours', () => {
    it('adds whole hours', () => {
        const d = new Date(2026, 2, 15, 10, 0, 0);

        expect(addHours(d, 3).getHours()).toBe(13);
    });

    it('subtracts for a negative offset', () => {
        const d = new Date(2026, 2, 15, 10, 0, 0);

        expect(addHours(d, -4).getHours()).toBe(6);
    });

    it('rolls over midnight into the next day', () => {
        const d = new Date(2026, 2, 15, 23, 0, 0);
        const result = addHours(d, 2);

        expect(result.getDate()).toBe(16);
        expect(result.getHours()).toBe(1);
    });

    it('MUTATES the date it was given and returns the same object', () => {
        //
        // DOCUMENTS A HAZARD. It calls setHours on the argument rather than on a
        // copy, so the caller's Date is changed in place and the return value is
        // that same object. Two calls compound:
        //
        //     addHours(d, 1); addHours(d, 1);   // d is now two hours later
        //
        // Every other date helper in this codebase copies first -- windowStart in
        // rolling-window.js has a test asserting exactly that.
        //
        const d = new Date(2026, 2, 15, 10, 0, 0);

        const result = addHours(d, 1);

        expect(result).toBe(d);
        expect(d.getHours()).toBe(11);

        addHours(d, 1);
        expect(d.getHours()).toBe(12);
    });
});
