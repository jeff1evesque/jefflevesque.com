/**
 * scores.test.js: what the model pages know about a score, a model's status and
 * its days (#243), and which lists show loss's three parts (#283).
 *
 * The rule every chart and figure leans on is betterBy's: a difference is
 * positive where it is better, whichever way the score runs. Loss is lower-is-
 * better and the other three higher-is-better, so a sign written the wrong way
 * round for one of them reads as the opposite of what happened.
 */

import {
    BASELINE_DASH,
    COMPARE_COLORS,
    COMPARE_MAX,
    DEFAULT_HOLD,
    DEFAULT_SCORE,
    HOLDS,
    KNOWN_SCORES,
    LOSS_PARTS,
    SCORES,
    SCORING_OPACITY,
    STATUSES,
    TRADE_SCORES,
    alignDays,
    behindLine,
    behindRows,
    betterBy,
    chartColors,
    checkWords,
    chosenScore,
    columnOf,
    compareBlocked,
    formatDuration,
    formatGap,
    formatScore,
    formatSignedTick,
    formatStarted,
    formatTick,
    holdName,
    holdsOf,
    isScore,
    liveKind,
    longDay,
    lossParts,
    noteOf,
    recentDays,
    scoreIn,
    scoreOf,
    scoresFor,
    sharedScores,
    shortDay,
    showsParts,
    sortModels,
    standing,
    statusLabel,
    statusOf,
    takenDown,
    tradesOptions,
} from '../../../import/layout/model/scores.js';
import { colors_categorical, themeColors } from '../../../import/general/colors.js';
import {
    OPTIONS_TASK,
    STOCK_SCORES,
    TASKS,
    behindOf,
    downModelOf,
    holdsBehindOf,
    listingOf,
    modelOf,
    olderTrackOf,
    optionsListingOf,
    optionsTrackOf,
    trackOf,
} from '../../../test-support/model-fixtures.js';

describe('the scores', () => {
    it('are the four the api keeps, loss alone lower-is-better', () => {
        expect(SCORES.map((score) => score.key)).toEqual(['loss', 'auc_up', 'auc_beats', 'acc_up']);
        expect(SCORES.filter((score) => score.lower).map((score) => score.key)).toEqual(['loss']);
    });

    it('each carry a note saying what they measure, and which way is better (#265)', () => {
        SCORES.forEach((score) => {
            expect(score.note).toMatch(/\.$/);
            expect(score.note).toMatch(score.lower ? /Lower is better/ : /higher is better/);
        });
    });

    it('say in loss\'s note that it is three scores added, and what knowing nothing scores (#265)', () => {
        const { note } = SCORES.find((score) => score.key === 'loss');

        expect(note).toBe(
            'Loss adds three scores: up or down, beating the average stock, and the size of the move. Lower is better. '
            + 'A coin flip scores 0.693 on each of the first two. The baseline is what knowing nothing scored on the same days.',
        );
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

describe('loss\'s three parts (#265)', () => {
    //
    // a track record's day whose 20-day averages are `average` and the
    // baseline's `baseline`
    //
    const dayOf = (average, baseline) => ({ day: '2026-10-16', average: average, baseline_average: baseline });
    const BASE = { up_log_loss: 0.71347, beats_log_loss: 0.69315, move_pinball: 0.26065 };

    it('are the three columns a history and a track record add up to loss, by the names the pages give them', () => {
        expect(LOSS_PARTS).toEqual([
            { key: 'up_log_loss', label: 'Up or down' },
            { key: 'beats_log_loss', label: 'Beats the average stock' },
            { key: 'move_pinball', label: 'Size of the move' },
        ]);
    });

    it('are named in loss\'s note, each as the pages name it', () => {
        const { note } = SCORES.find((score) => score.key === 'loss');

        LOSS_PARTS.forEach((part) => expect(note.toLowerCase()).toContain(part.label.toLowerCase().replace('beats', 'beating')));
    });

    it('are no score the picker offers', () => {
        LOSS_PARTS.forEach((part) => expect(SCORES.map((score) => score.key)).not.toContain(part.key));
    });

    it('read a day\'s 20-day averages of each, beside the baseline\'s, each lower-is-better as loss is', () => {
        //
        // tables-gnn's first five days, to 2026-10-16
        //
        const parts = lossParts(dayOf({ up_log_loss: 0.72254, beats_log_loss: 0.72046, move_pinball: 0.26018 }, BASE));

        expect(parts.map((part) => [part.label, part.value, part.baseline, part.stands])).toEqual([
            ['Up or down', 0.72254, 0.71347, 'worse'],
            ['Beats the average stock', 0.72046, 0.69315, 'worse'],
            ['Size of the move', 0.26018, 0.26065, 'better'],
        ]);
    });

    it('stand as the two are printed: 0.260 against 0.261 is better, and two printed alike are level', () => {
        //
        // 0.00047 apart, which standing alone would call level
        //
        expect(standing(betterBy(0.26018, 0.26065, 'loss'), 'loss')).toBe('level');
        expect(lossParts(dayOf({ up_log_loss: 0.7, beats_log_loss: 0.7, move_pinball: 0.26018 }, BASE))[2].stands).toBe('better');
        expect(lossParts(dayOf({ up_log_loss: 0.7134, beats_log_loss: 0.69, move_pinball: 0.26 }, BASE))[0].stands).toBe('level');
    });

    it('stand against nothing where the baseline has none of a part', () => {
        const parts = lossParts(dayOf({ up_log_loss: 0.72, beats_log_loss: 0.7, move_pinball: 0.26 }, { ...BASE, move_pinball: null }));

        expect(parts[2]).toMatchObject({ value: 0.26, baseline: null, stands: null });
        expect(parts[0].stands).toBe('worse');
    });

    it('are none for a day without all three, as a track record written before them has', () => {
        expect(lossParts(olderTrackOf(3)[2])).toEqual([]);
        expect(lossParts(dayOf({ up_log_loss: 0.72, beats_log_loss: null, move_pinball: 0.26 }, BASE))).toEqual([]);
        expect(lossParts(dayOf(null, BASE))).toEqual([]);
        expect(lossParts(undefined)).toEqual([]);
    });

    it('add up to the day\'s 20-day loss, as the track record\'s fixtures do', () => {
        const last = trackOf(25).slice(-1)[0];
        const parts = lossParts(last);

        expect(parts.reduce((sum, part) => sum + part.value, 0)).toBeCloseTo(last.average.loss, 10);
        expect(parts.reduce((sum, part) => sum + part.baseline, 0)).toBeCloseTo(last.baseline_average.loss, 10);
    });
});

describe('showsParts: the lists that show loss\'s three parts in place of its sum (#283)', () => {
    it('is true on Loss, for a task of stocks, before format 3 and from it on', () => {
        expect(showsParts('loss', TASKS[0])).toBe(true);
        expect(showsParts('loss', { id: 'next-day-move', scores: STOCK_SCORES })).toBe(true);
        expect(showsParts('loss', undefined)).toBe(true);
    });

    it('is false on any other score', () => {
        SCORES.concat(TRADE_SCORES).filter((score) => score.key !== 'loss').forEach((score) => {
            expect({ key: score.key, shows: showsParts(score.key, TASKS[0]) }).toEqual({ key: score.key, shows: false });
        });
    });

    it('is false for a task that trades options, whose loss adds up other scores', () => {
        expect(showsParts('loss', OPTIONS_TASK)).toBe(false);
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
        expect([52, 532, 600.4, 3605].map(formatDuration)).toEqual(['52 s', '8 min 52 s', '10 min 0 s', '1 h 0 min 5 s']);
    });

    it('prints a duration under ten seconds to a tenth, as the history keeps it (#251)', () => {
        expect([0.2, 1.3, 9.9, 9.94, 9.95, 10].map(formatDuration)).toEqual(['0.2 s', '1.3 s', '9.9 s', '9.9 s', '10 s', '10 s']);
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

describe('a live version taken down for doing worse than the baseline (#263)', () => {
    it('is Behind baseline, whatever its days, and Retired wins over it', () => {
        expect(statusOf(downModelOf())).toBe('down');
        expect(statusOf(downModelOf({ scored_days: 7 }))).toBe('down');
        expect(statusOf(downModelOf({ retired: '2026-10-20' }))).toBe('retired');
        expect(statusLabel(downModelOf())).toBe('Behind baseline');
    });

    it('is a status of its own, offered between New and Retired', () => {
        expect(STATUSES.map((status) => status.key)).toEqual(['live', 'new', 'down', 'retired']);
    });

    it('says when, with the day held on one line where a narrow cell wraps it', () => {
        expect(takenDown('2026-10-19')).toBe('Taken down Oct 19');
    });

    it('words the check of each day on its own, and of an average', () => {
        expect(checkWords({ days: 1, in_a_row: 5 })).toBe('worse than the baseline 5 scored days in a row');
        expect(checkWords({ days: 5, in_a_row: 10 })).toBe('its 5-day average was worse than the baseline’s 10 days in a row');
        expect(checkWords({ days: 20, in_a_row: 5 })).toBe('its 20-day average was worse than the baseline’s 5 days in a row');
    });

    it('says a single day as a day, and leaves out a count it does not have', () => {
        expect(checkWords({ days: 1, in_a_row: 1 })).toBe('worse than the baseline 1 scored day in a row');
        expect(checkWords({ days: 5, in_a_row: 1 })).toBe('its 5-day average was worse than the baseline’s 1 day in a row');
        expect(checkWords({ days: 1, in_a_row: null })).toBe('worse than the baseline');
        expect(checkWords({ days: 5, in_a_row: null })).toBe('its 5-day average was worse than the baseline’s');
    });

    it('says how many days in a row each check has been worse, of how many take a version down', () => {
        expect(behindLine(behindOf()))
            .toBe('Days in a row worse than the baseline: each day 4 of 5, 5-day average 0 of 10, 20-day average not yet.');
        expect(behindLine(behindOf(0, 2, 1)))
            .toBe('Days in a row worse than the baseline: each day 0 of 5, 5-day average 2 of 10, 20-day average 1 of 5.');
    });

    it('says nothing for a listing that gives no checks, as one before format 2', () => {
        expect(behindLine([])).toBe('');
        expect(behindLine(undefined)).toBe('');
        expect(behindLine(modelOf().behind)).toBe('');
    });

    it('gives the same checks as rows, a name and a count each, for a wide screen\'s card (#267)', () => {
        expect(behindRows(behindOf())).toEqual([
            { key: 'check-1', name: 'Each day', value: '4 of 5' },
            { key: 'check-5', name: '5-day average', value: '0 of 10' },
            { key: 'check-20', name: '20-day average', value: 'not yet' },
        ]);
        expect(behindRows([])).toEqual([]);
        expect(behindRows(undefined)).toEqual([]);
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

    it('draws the live version green, the baseline amber and how long an attempt took teal, in either theme (#251)', () => {
        expect(chartColors('light')).toMatchObject({ live: '#237616', baseline: '#c98500', took: '#1baf7a' });
        expect(chartColors('dark')).toMatchObject({ live: '#4a993e', baseline: '#eda100', took: '#199e70' });
    });

    it('dashes the baseline, and lightens an attempt\'s scoring to the same share in both themes', () => {
        expect(BASELINE_DASH).toBe('5 4');
        expect(SCORING_OPACITY).toBe(0.4);
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

    describe('across tasks, on what each one\'s picks would have made (#279)', () => {
        const listing = optionsListingOf();
        const named = (name) => listing.models.find((model) => model.name === name);

        it('lets a stock model be ticked next to pt-options on Top 10 gain or Top 10 wins, either first', () => {
            ['top10_gain', 'top10_wins'].forEach((score) => {
                expect(compareBlocked(named('pt-options'), [named('pt-gnn')], score, listing.tasks)).toBeNull();
                expect(compareBlocked(named('tables'), [named('pt-options')], score, listing.tasks)).toBeNull();
                expect(compareBlocked(named('tables'), [named('pt-gnn'), named('pt-options')], score, listing.tasks)).toBeNull();
            });
        });

        it('turns it down on loss, and on a score the other task does not name, as before', () => {
            ['loss', 'auc_up', 'profit_auc'].forEach((score) => {
                expect(compareBlocked(named('pt-options'), [named('pt-gnn')], score, listing.tasks)).toMatch(/Predicts something else/);
            });
        });

        it('turns it down on a top 10\'s score where either task names none, as a listing before format 3', () => {
            const [stocks] = listing.tasks;

            expect(compareBlocked(named('pt-options'), [named('pt-gnn')], 'top10_gain', [{ ...stocks, scores: undefined }, OPTIONS_TASK]))
                .toMatch(/Predicts something else/);
            expect(compareBlocked(named('pt-options'), [named('pt-gnn')], 'top10_gain')).toMatch(/Predicts something else/);
        });

        it('still turns down a fourth', () => {
            expect(compareBlocked(named('fresh'), [named('pt-gnn'), named('tables'), named('pt-options')], 'top10_gain', listing.tasks))
                .toMatch(/Up to three/);
        });
    });
});

describe('each task\'s scores, from format 3 on (#279)', () => {
    const [stocks, , options] = optionsListingOf().tasks;

    it('are the stock models\' four, and the top 10\'s two after them, and an options model\'s loss and its three', () => {
        expect(scoresFor(stocks)).toEqual(STOCK_SCORES);
        expect(scoresFor(options)).toEqual(['loss', 'profit_auc', 'top10_gain', 'top10_wins']);
    });

    it('are the four stock scores for a task that names none, as before format 3', () => {
        expect(scoresFor(TASKS[0])).toEqual(['loss', 'auc_up', 'auc_beats', 'acc_up']);
        expect(scoresFor(undefined)).toEqual(['loss', 'auc_up', 'auc_beats', 'acc_up']);
    });

    it('leave out a score the pages do not know, and keep loss for a task that names none they know', () => {
        expect(scoresFor({ id: 'x', scores: ['sharpe', 'top10_wins', 'loss'] })).toEqual(['top10_wins', 'loss']);
        expect(scoresFor({ id: 'x', scores: ['sharpe'] })).toEqual(['loss']);
    });

    it('know every score by its key, and fall back to loss for one they do not', () => {
        expect(KNOWN_SCORES.map((score) => score.key)).toEqual([...SCORES.map((score) => score.key), 'profit_auc', 'top10_gain', 'top10_wins']);
        expect(TRADE_SCORES.map((score) => score.label)).toEqual(['Profit AUC', 'Top 10 gain', 'Top 10 wins']);
        expect(isScore('top10_gain')).toBe(true);
        expect(isScore('loss_5d')).toBe(false);
        expect(scoreOf('top10_wins').label).toBe('Top 10 wins');
    });

    it('run higher-is-better, and say so in their notes', () => {
        TRADE_SCORES.forEach((score) => {
            expect(score.lower).toBe(false);
            [score.note, score.optionsNote].filter(Boolean).forEach((note) => expect(note).toMatch(/[Hh]igher is better/));
        });
    });

    it('tell a task that trades options by a score only an options model has', () => {
        expect(tradesOptions(options)).toBe(true);
        expect(tradesOptions(stocks)).toBe(false);
        expect(tradesOptions(TASKS[0])).toBe(false);
    });

    it('say what Profit AUC measures, and that 0.5 is a coin flip', () => {
        expect(noteOf('profit_auc', options))
            .toBe('How well the chance ranks the options that made money above the ones that didn’t: 0.5 is a coin flip, and higher is better.');
    });

    it('say for each task what its top 10 is, and that the baseline is a random pick', () => {
        expect(noteOf('top10_gain', stocks)).toBe(
            'The average gain of each night’s top 10: the 10 stocks the model is surest will go up, bought at the 9:40 AM ask and sold at the '
            + '3:40 PM bid the same day. Higher is better, and the baseline is the average of everything it could have picked: what a random pick got.',
        );
        expect(noteOf('top10_gain', options)).toMatch(/^The average gain of each night’s top 10: the model’s 10 best options for the hold, bought at the 9:40 AM ask and sold at the 3:40 PM bid on the sell day\./);
        expect(noteOf('top10_wins', stocks)).toMatch(/^How many of each night’s top 10 made money: the 10 stocks/);
        expect(noteOf('top10_wins', options)).toMatch(/^How many of each night’s top 10 made money: the model’s 10 best options/);
    });

    it('say what an options model\'s loss adds up, and the stock models\' loss as before', () => {
        expect(noteOf('loss', options)).toBe(
            'Loss adds up, for each hold that is on, the log loss of the chance each option makes money and the pinball loss of its gain. '
            + 'Lower is better, and the baseline beside it is a know-nothing model’s.',
        );
        expect(noteOf('loss', stocks)).toBe(scoreOf('loss').note);
        expect(noteOf('auc_up', stocks)).toBe(scoreOf('auc_up').note);
    });

    it('show the score the reader picked for a task, where it has it, and loss otherwise', () => {
        expect(chosenScore({ 'option-picks': 'profit_auc' }, options)).toBe('profit_auc');
        expect(chosenScore({ 'option-picks': 'auc_up' }, options)).toBe('loss');
        expect(chosenScore({ direction: 'top10_wins' }, TASKS[0])).toBe('loss');
        expect(chosenScore({}, options)).toBe('loss');
        expect(chosenScore(undefined, options)).toBe('loss');
        expect(chosenScore({ x: 'top10_wins' }, { id: 'x', scores: ['top10_gain', 'top10_wins'] })).toBe('top10_wins');
        expect(chosenScore({}, { id: 'x', scores: ['top10_gain', 'top10_wins'] })).toBe('top10_gain');
    });

    it('share between tasks only the top 10\'s that each names', () => {
        expect(sharedScores([stocks, options])).toEqual(['top10_gain', 'top10_wins']);
        expect(sharedScores([options, stocks])).toEqual(['top10_gain', 'top10_wins']);
        expect(sharedScores([stocks, { ...options, scores: ['loss', 'top10_wins'] }])).toEqual(['top10_wins']);
        expect(sharedScores([TASKS[0], TASKS[1]])).toEqual([]);
    });

    it('read a score off a set that carries it, and none off one that does not', () => {
        expect(scoreIn({ loss: 1.6, top10_gain: null }, 'loss')).toBe(1.6);
        expect(scoreIn({ loss: 1.6, top10_gain: null }, 'top10_gain')).toBeNull();
        expect(scoreIn({ loss: 1.6 }, 'top10_wins')).toBeNull();
        expect(scoreIn(null, 'loss')).toBeNull();
    });
});

describe('printing the top 10\'s scores (#279)', () => {
    it('prints the gain as a percentage to two places, below zero with a minus sign', () => {
        expect(formatScore(0.0123, 'top10_gain')).toBe('1.23%');
        expect(formatScore(-0.0421, 'top10_gain')).toBe('−4.21%');
        expect(formatScore(-0.00001, 'top10_gain')).toBe('0.00%');
        expect(formatGap(-0.0009, 'top10_gain')).toBe('0.09 pts');
        expect(formatTick(-0.015, 'top10_gain')).toBe('−1.5%');
        expect(formatSignedTick(0.0004, 'top10_gain')).toBe('+0.04 pts');
    });

    it('prints how many won as a count to one place', () => {
        expect(formatScore(6.25, 'top10_wins')).toBe('6.3');
        expect(formatGap(-2.1, 'top10_wins')).toBe('2.1');
        expect(formatTick(6, 'top10_wins')).toBe('6');
        expect(formatSignedTick(-0.5, 'top10_wins')).toBe('−0.5');
    });

    it('prints Profit AUC as an AUC, to three places', () => {
        expect(formatScore(0.5512, 'profit_auc')).toBe('0.551');
    });

    it('calls two gains level where they print alike', () => {
        expect(standing(betterBy(0.01204, 0.01201, 'top10_gain'), 'top10_gain')).toBe('level');
        expect(standing(betterBy(0.0012, 0.0003, 'top10_gain'), 'top10_gain')).toBe('better');
        expect(standing(betterBy(5.1, 5.6, 'top10_wins'), 'top10_wins')).toBe('worse');
    });
});

describe('an options model\'s holds (#279)', () => {
    it('are held 1, 5 and 20 trading days, and the pages open on the 1-day hold\'s', () => {
        expect(HOLDS).toEqual([{ days: 1, label: '1 day' }, { days: 5, label: '5 days' }, { days: 20, label: '20 days' }]);
        expect(DEFAULT_HOLD).toBe(1);
    });

    it('put each score of a hold in a column of its own, and a score of none in its own', () => {
        expect(columnOf('top10_gain', 5)).toBe('top10_gain_5d');
        expect(columnOf('loss', 20)).toBe('loss_20d');
        expect(columnOf('loss', null)).toBe('loss');
        expect(columnOf('loss')).toBe('loss');
    });

    it('are the holds a track record has columns for: an options model\'s three, and none for a stock model\'s', () => {
        expect(holdsOf(optionsTrackOf(3)).map((hold) => hold.days)).toEqual([1, 5, 20]);
        expect(holdsOf(trackOf(3))).toEqual([]);
        expect(holdsOf([])).toEqual([]);
        expect(holdsOf(null)).toEqual([]);
    });

    it('are named as the pages name them', () => {
        expect(holdName(5)).toBe('5-day hold');
    });

    it('say which hold took a live version down', () => {
        expect(checkWords({ days: 1, in_a_row: 5, hold: 5 })).toBe('the 5-day hold did worse than the baseline 5 scored days in a row');
        expect(checkWords({ days: 20, in_a_row: 5, hold: 1 })).toBe('the 1-day hold’s 20-day average was worse than the baseline’s 5 days in a row');
        expect(checkWords({ days: 1, in_a_row: 5, hold: null })).toBe('worse than the baseline 5 scored days in a row');
    });

    it('say how close each check is on each hold, in a line and in a card\'s rows', () => {
        expect(behindLine(holdsBehindOf())).toBe(
            'Days in a row worse than the baseline: 1-day hold, each day 2 of 5, 5-day average 0 of 10, 20-day average 0 of 5; '
            + '5-day hold, each day 0 of 5, 5-day average 0 of 10, 20-day average not yet; '
            + '20-day hold, each day 0 of 5, 5-day average not yet, 20-day average not yet.',
        );
        expect(behindRows(holdsBehindOf()).slice(0, 5)).toEqual([
            { key: 'hold-1', name: '1-day hold', head: true },
            { key: 'check-1-1', name: 'Each day', value: '2 of 5' },
            { key: 'check-1-5', name: '5-day average', value: '0 of 10' },
            { key: 'check-1-20', name: '20-day average', value: '0 of 5' },
            { key: 'hold-5', name: '5-day hold', head: true },
        ]);
        expect(behindRows(holdsBehindOf())).toHaveLength(12);
    });
});
