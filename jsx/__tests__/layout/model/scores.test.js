/**
 * scores.test.js: what the model pages know about a score, a model's status and
 * its days (#243).
 *
 * The rule every chart and figure leans on is betterBy's: a difference is
 * positive where it is better, whichever way the score runs. Loss is lower-is-
 * better and the other three higher-is-better, so a sign written the wrong way
 * round for one of them reads as the opposite of what happened.
 */

import {
    COMPARE_COLORS,
    COMPARE_MAX,
    DEFAULT_SCORE,
    SCORES,
    alignDays,
    baselineAverages,
    betterBy,
    chartColors,
    compareBlocked,
    formatDuration,
    formatGap,
    formatScore,
    formatSignedTick,
    formatStarted,
    formatTick,
    liveKind,
    longDay,
    recentDays,
    scoreOf,
    shortDay,
    sortModels,
    standing,
    statusLabel,
    statusOf,
} from '../../../import/layout/model/scores.js';
import { colors_categorical, themeColors } from '../../../import/general/colors.js';
import { listingOf, modelOf, trackOf } from '../../../test-support/model-fixtures.js';

describe('the scores', () => {
    it('are the four the api keeps, loss alone lower-is-better', () => {
        expect(SCORES.map((score) => score.key)).toEqual(['loss', 'auc_up', 'auc_beats', 'acc_up']);
        expect(SCORES.filter((score) => score.lower).map((score) => score.key)).toEqual(['loss']);
    });

    it('open on loss, which decides what goes live', () => {
        expect(DEFAULT_SCORE).toBe('loss');
    });

    it('fall back to loss for a key that is none', () => {
        expect(scoreOf('auc_up').label).toBe('Up/down AUC');
        expect(scoreOf('f1').key).toBe('loss');
        expect(scoreOf(undefined).key).toBe('loss');
    });
});

describe('formatting', () => {
    it('prints a score to three places, a share as a percentage to one, and a dash for none', () => {
        expect(formatScore(1.23456, 'loss')).toBe('1.235');
        expect(formatScore(0.5432, 'acc_up')).toBe('54.3%');
        expect(formatScore(null, 'loss')).toBe('–');
        expect(formatScore(NaN, 'loss')).toBe('–');
    });

    it('prints a gap unsigned, a share\'s in points', () => {
        expect(formatGap(-0.0345, 'loss')).toBe('0.035');
        expect(formatGap(-0.012, 'acc_up')).toBe('1.2 pts');
        expect(formatGap(undefined, 'loss')).toBe('–');
    });

    it('prints an axis\'s tick in as few places as it needs', () => {
        expect(formatTick(1.6, 'loss')).toBe('1.6');
        expect(formatTick(1.6254, 'loss')).toBe('1.625');
        expect(formatTick(0.5, 'acc_up')).toBe('50%');
        expect(formatTick(0.5134, 'acc_up')).toBe('51.3%');
        expect(formatTick(null, 'loss')).toBe('');
    });

    it('signs a difference\'s tick, and calls nothing 0', () => {
        expect(formatSignedTick(0.01, 'loss')).toBe('+0.01');
        expect(formatSignedTick(-0.01, 'auc_up')).toBe('−0.01');
        expect(formatSignedTick(0.012, 'acc_up')).toBe('+1.2 pts');
        expect(formatSignedTick(0.00001, 'loss')).toBe('0');
        expect(formatSignedTick(0, 'acc_up')).toBe('0');
        expect(formatSignedTick(null, 'loss')).toBe('');
    });
});

describe('how long an attempt took, and when it started (#247)', () => {
    it('prints a duration to the whole second, in hours and minutes as it needs them', () => {
        expect([0.2, 52, 532, 600.4, 3605].map(formatDuration)).toEqual(['0 s', '52 s', '8 min 52 s', '10 min 0 s', '1 h 0 min 5 s']);
    });

    it('carries a second rounded up into the minute or hour, rather than printing 60 of it', () => {
        expect(formatDuration(59.6)).toBe('1 min 0 s');
        expect(formatDuration(3599.5)).toBe('1 h 0 min 0 s');
        expect(formatDuration(20 * 3600 + 61)).toBe('20 h 1 min 1 s');
    });

    it('prints nothing for a duration that is none', () => {
        [null, undefined, NaN, -1, '532'].forEach((value) => expect(formatDuration(value)).toBe(''));
    });

    it('prints when an attempt started in Eastern time, in summer and in winter', () => {
        expect(formatStarted('2026-10-16T07:58:10+00:00')).toBe('3:58 AM ET');
        expect(formatStarted('2026-12-16T08:58:10+00:00')).toBe('3:58 AM ET');
        expect(formatStarted('2026-07-01T16:05:00Z')).toBe('12:05 PM ET');
        expect(formatStarted('2026-10-16T03:58:10-04:00')).toBe('3:58 AM ET');
    });

    it('prints nothing for anything but an instant with its offset, which would be read in the reader\'s zone', () => {
        [null, '', 'soon', '2026-10-16', '2026-10-16T07:58:10', '2026-13-45T07:58:10Z', 1792137490].forEach((value) => {
            expect(formatStarted(value)).toBe('');
        });
    });
});

describe('betterBy and standing', () => {
    it('is positive for a lower loss, and for a higher score of the rest', () => {
        expect(betterBy(1.5, 1.6, 'loss')).toBeCloseTo(0.1);
        expect(betterBy(1.7, 1.6, 'loss')).toBeCloseTo(-0.1);
        expect(betterBy(0.6, 0.5, 'auc_up')).toBeCloseTo(0.1);
        expect(betterBy(0.4, 0.5, 'acc_up')).toBeCloseTo(-0.1);
    });

    it('is nothing where either side is missing', () => {
        expect(betterBy(null, 1.6, 'loss')).toBeNull();
        expect(betterBy(1.6, undefined, 'loss')).toBeNull();
    });

    it('stands better, worse, or level where the two print alike', () => {
        expect(standing(0.01, 'loss')).toBe('better');
        expect(standing(-0.01, 'loss')).toBe('worse');
        expect(standing(0.0001, 'loss')).toBe('level');
        expect(standing(0.0004, 'acc_up')).toBe('level');
        expect(standing(null, 'loss')).toBe('level');
    });
});

describe('a model\'s status', () => {
    it('is Retired once retired, New under 20 scored days, and Live otherwise', () => {
        expect(statusOf(modelOf({ retired: '2026-10-01', scored_days: 3 }))).toBe('retired');
        expect(statusOf(modelOf({ scored_days: 19 }))).toBe('new');
        expect(statusOf(modelOf({ scored_days: 20 }))).toBe('live');
    });

    it('says how many days a new model has', () => {
        expect(statusLabel(modelOf({ scored_days: 6 }))).toBe('New · 6 days');
        expect(statusLabel(modelOf({ scored_days: 1 }))).toBe('New · 1 day');
        expect(statusLabel(modelOf())).toBe('Live');
        expect(statusLabel(modelOf({ retired: '2026-10-01' }))).toBe('Retired');
    });

    it('says how a live version came to be live, and nothing for a kind it does not know', () => {
        expect(liveKind('first')).toBe('first version');
        expect(liveKind('nightly')).toBe('nightly update');
        expect(liveKind('weekly')).toBe('weekly retrain');
        expect(liveKind(null)).toBe('');
    });
});

describe('chartColors', () => {
    it('draws in the theme\'s grays, and the site\'s blue and red for better and worse', () => {
        const light = chartColors('light');
        const dark = chartColors('dark');

        expect(light.ink).toBe(themeColors('light')['gray-8']);
        expect(dark.page).toBe(themeColors('dark')['white-1']);
        expect(light.better).toBe('#1c5cab');
        expect(dark.better).toBe('#86b6ef');
        expect(light.worse).toBe('#d03b3b');
        expect(dark.worse).toBe('#e66767');
    });

    it('compares in three fixed colors, the same in either theme', () => {
        expect(COMPARE_MAX).toBe(3);
        expect(COMPARE_COLORS).toEqual(colors_categorical.slice(0, 3));
    });
});

describe('days', () => {
    it('names a day the same in every zone', () => {
        expect(shortDay('2026-10-14')).toBe('Oct 14');
        expect(longDay('2026-10-14')).toBe('Wed, Oct 14, 2026');
        expect(shortDay(null)).toBe('');
        expect(longDay('')).toBe('');
    });

    it('lines several records up on every day any of them holds, a gap where one has none', () => {
        const a = trackOf(2, '2026-09-01');
        const b = trackOf(2, '2026-09-02');
        const aligned = alignDays({ a: a, b: b, gone: null });

        expect(aligned.map((entry) => entry.day)).toEqual(['2026-09-01', '2026-09-02', '2026-09-03']);
        expect(aligned[0].a).toBe(a[0]);
        expect(aligned[0].b).toBeUndefined();
        expect(aligned[2].b).toBe(b[1]);
    });

    it('takes the last days of them all as the trend lines\' axis', () => {
        expect(recentDays({ a: trackOf(70) })).toHaveLength(60);
        expect(recentDays({ a: trackOf(3) }, 2)).toEqual(['2026-09-02', '2026-09-03']);
    });

    it('averages the baseline over the axis\'s last 20 days, so it is one line whichever models are compared', () => {
        const a = trackOf(25).map((row, at) => ({ ...row, baseline: { ...row.baseline, loss: at + 1 } }));
        const aligned = alignDays({ a: a });
        const line = baselineAverages(aligned, ['a'], 'loss');

        expect(line[0]).toBe(1);
        expect(line[1]).toBeCloseTo(1.5);
        expect(line[24]).toBeCloseTo(15.5);
    });

    it('leaves the baseline out on a day no record has it', () => {
        const a = trackOf(2).map((row, at) => ({ ...row, baseline: { ...row.baseline, loss: at ? 2 : null } }));
        const line = baselineAverages(alignDays({ a: a }), ['a'], 'loss');

        expect(line).toEqual([null, 2]);
    });
});

describe('sortModels', () => {
    const { models } = listingOf();
    const names = (sorted) => sorted.map((model) => model.name);

    it('puts the lowest loss first, and the highest of any other score', () => {
        expect(names(sortModels(models, 'score', 'loss'))).toEqual(['pt-gnn', 'tables', 'fresh', 'beater']);
        expect(names(sortModels(models, 'score', 'auc_beats'))).toEqual(['beater', 'pt-gnn', 'tables', 'fresh']);
    });

    it('puts a model with no score last', () => {
        const unscored = modelOf({ name: 'aaa', score: null });
        const blank = modelOf({ name: 'bbb', score: { loss: null } });

        expect(names(sortModels([unscored, blank, ...models], 'score', 'loss')).slice(-2)).toEqual(['aaa', 'bbb']);
    });

    it('sorts by name, by attempts gone live, and by the newest live version, a retired model after the rest', () => {
        expect(names(sortModels(models, 'name', 'loss'))).toEqual(['beater', 'fresh', 'pt-gnn', 'tables']);
        expect(names(sortModels(models, 'went', 'loss'))).toEqual(['tables', 'pt-gnn', 'beater', 'fresh']);
        expect(names(sortModels(models, 'since', 'loss'))).toEqual(['tables', 'pt-gnn', 'fresh', 'beater']);
    });

    it('puts a live version with no day after the rest, and breaks every tie by name', () => {
        const undated = modelOf({ name: 'a', live: { since: null, kind: null } });

        expect(names(sortModels([undated, ...models], 'since', 'loss')).slice(-2)).toEqual(['a', 'beater']);
        expect(names(sortModels([modelOf({ name: 'b' }), modelOf({ name: 'a' })], 'went', 'loss'))).toEqual(['a', 'b']);
    });

    it('sorts by name for a sort it does not know, and leaves the list it was handed alone', () => {
        const handed = models.slice();

        expect(names(sortModels(handed, 'mystery', 'loss'))).toEqual(['beater', 'fresh', 'pt-gnn', 'tables']);
        expect(handed).toEqual(models);
    });
});

describe('compareBlocked', () => {
    const { models } = listingOf();
    const [ptGnn, tables, fresh, beater] = models;

    it('lets the first model be ticked, and one of its task beside it', () => {
        expect(compareBlocked(ptGnn, [])).toBeNull();
        expect(compareBlocked(tables, [ptGnn])).toBeNull();
    });

    it('turns down a model of another task', () => {
        expect(compareBlocked(beater, [ptGnn])).toMatch(/Predicts something else/);
    });

    it('turns down a fourth', () => {
        const fourth = modelOf({ name: 'fourth' });

        expect(compareBlocked(fourth, [ptGnn, tables, fresh])).toMatch(/Up to three/);
    });

    it('always lets a ticked model be unticked', () => {
        expect(compareBlocked(fresh, [ptGnn, tables, fresh])).toBeNull();
    });
});
