/**
 * scores.test.js: what the model pages know about a score, a model's status and
 * its days (#243), which lists show loss's three parts (#283), and a model's
 * holds (#279), from format 5 a stock model's and Combined (#300), with what a
 * model's page says of them: when each comes in and was first scored, which a
 * model predicts, and the note under its checks (#300).
 *
 * The rule every chart and figure leans on is betterBy's: a difference is
 * positive where it is better, whichever way the score runs. Loss is lower-is-
 * better and the other three higher-is-better, so a sign written the wrong way
 * round for one of them reads as the opposite of what happened.
 */

import {
    BASELINE_DASH,
    COMBINED,
    COMBINED_HOLD,
    COMPARE_COLORS,
    COMPARE_MAX,
    DEFAULT_HOLD,
    DEFAULT_SCORE,
    HELD_OUT,
    HOLDS,
    HOLD_SCHEDULE,
    KNOWN_SCORES,
    LOSS_PARTS,
    PAGE_DASH,
    SCORES,
    SCORING_OPACITY,
    STATUSES,
    TRADE_SCORES,
    WINDOW,
    alignDays,
    averageDays,
    betterBy,
    chartColors,
    checkWords,
    checksNote,
    checksTable,
    chosenScore,
    columnOf,
    comesIn,
    comesInLine,
    compareBlocked,
    firstResult,
    formatDuration,
    formatGap,
    formatScore,
    formatSignedTick,
    formatStarted,
    formatTick,
    heldOut,
    holdKey,
    holdLabel,
    holdLine,
    holdName,
    holdsAmong,
    holdsOf,
    isHold,
    isScore,
    listLine,
    listedHolds,
    liveKind,
    longDay,
    lossParts,
    namedHold,
    noResultsYet,
    noteOf,
    onThe,
    predictsLine,
    recentDays,
    resultDays,
    resultLag,
    resultName,
    scoreIn,
    scoreOf,
    scoreOnHold,
    scoresFor,
    scoresAt,
    scoresOn,
    sharedScores,
    shortDay,
    showsParts,
    sortModels,
    standing,
    statusLabel,
    statusOf,
    takenDown,
    trackLine,
    tradesOptions,
    trainedOn,
    newYorkToday,
    weekDay,
    whenRows,
} from '../../../import/layout/model/scores.js';
import { colors_categorical, themeColors } from '../../../import/general/colors.js';
import {
    OPTIONS_TASK,
    STOCK_SCORES,
    TASKS,
    behindOf,
    downModelOf,
    heldListingOf,
    heldModelOf,
    heldTrackOf,
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

    it('names an options model\'s days with their weekdays, the same day in every zone (#290)', () => {
        expect(weekDay('2026-10-20')).toBe('Tue, Oct 20');
        expect(weekDay('2026-11-19')).toBe('Thu, Nov 19');
        expect(weekDay(null)).toBe('');
    });

    it('takes today as New York has it, in summer and in winter, wherever the reader is (#290)', () => {
        expect(newYorkToday(new Date('2026-10-23T03:30:00Z'))).toBe('2026-10-22');
        expect(newYorkToday(new Date('2026-10-23T04:30:00Z'))).toBe('2026-10-23');
        expect(newYorkToday(new Date('2026-12-01T04:30:00Z'))).toBe('2026-11-30');
        expect(newYorkToday(new Date('2026-12-01T05:30:00Z'))).toBe('2026-12-01');
        expect(newYorkToday()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
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

    it('says how far a new model is through the days it needs, and only New before its first (#293)', () => {
        expect(statusLabel(modelOf({ scored_days: 6 }))).toBe('New · day 6 of 20');
        expect(statusLabel(modelOf({ scored_days: 1 }))).toBe('New · day 1 of 20');
        expect(statusLabel(modelOf({ scored_days: 19 }))).toBe('New · day 19 of 20');
        expect(statusLabel(modelOf({ scored_days: 0 }))).toBe('New');
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

describe('the days a model\'s scores average (#293)', () => {
    it('are the listing\'s average_days, which the worker gives the listing and every model', () => {
        expect(averageDays(modelOf({ average_days: 30 }))).toBe(30);
        expect(averageDays({ ...listingOf(), average_days: 1 })).toBe(1);
    });

    it('are 20 for a model or a listing without them, as before format 4, and for one that is not a whole number of 1 or more', () => {
        expect(WINDOW).toBe(20);
        expect(averageDays(modelOf())).toBe(20);
        expect(averageDays(listingOf())).toBe(20);
        expect(averageDays(null)).toBe(20);
        expect(averageDays(undefined)).toBe(20);
        [0, -5, 2.5, '30', null, NaN, Infinity].forEach((days) => {
            expect(averageDays(modelOf({ average_days: days }))).toBe(20);
        });
    });

    it('decide when a model stops being New', () => {
        expect(statusOf(modelOf({ average_days: 30, scored_days: 25 }))).toBe('new');
        expect(statusOf(modelOf({ average_days: 30, scored_days: 29 }))).toBe('new');
        expect(statusOf(modelOf({ average_days: 30, scored_days: 30 }))).toBe('live');
        expect(statusOf(modelOf({ average_days: 5, scored_days: 6 }))).toBe('live');
    });

    it('are what a New model\'s pill counts to', () => {
        expect(statusLabel(modelOf({ average_days: 30, scored_days: 25 }))).toBe('New · day 25 of 30');
        expect(statusLabel(modelOf({ average_days: 30, scored_days: 0 }))).toBe('New');
        expect(statusLabel(modelOf({ average_days: 30, scored_days: 30 }))).toBe('Live');
    });

    it('do not say whether a model is down or retired: those come first, whatever its days', () => {
        expect(statusLabel(downModelOf({ average_days: 30, scored_days: 4 }))).toBe('Behind baseline');
        expect(statusLabel(modelOf({ average_days: 30, scored_days: 4, retired: '2026-10-01' }))).toBe('Retired');
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

    it('says why a take-down no check did was made, from format 4 (#295)', () => {
        expect(checkWords({ reason: 'not_ahead', days: null, in_a_row: null })).toBe('it went live without beating the baseline');
        expect(checkWords({ reason: 'track_record', days: null, in_a_row: null })).toBe('its track record showed nothing better than the baseline');
        expect(checkWords({ reason: 'track_record', days: null, in_a_row: null, hold: null })).toBe('its track record showed nothing better than the baseline');
    });

    it('words a take-down for doing worse as every one before format 4, and one whose check it cannot read without it (#295)', () => {
        expect(checkWords({ reason: 'worse', days: 1, in_a_row: 5 })).toBe('worse than the baseline 5 scored days in a row');
        expect(checkWords({ reason: 'worse', days: null, in_a_row: 5 })).toBe('worse than the baseline 5 days in a row');
        expect(checkWords({ reason: 'worse', days: null, in_a_row: null })).toBe('worse than the baseline');
        expect(checkWords({ reason: 'worse', days: null, in_a_row: null, hold: 5 })).toBe('its 5-day hold did worse than the baseline');
    });

    it('never says null, whatever a take-down leaves out (#295)', () => {
        ['worse', 'not_ahead', 'track_record'].forEach((reason) => {
            [{}, { days: null }, { in_a_row: null }, { days: null, in_a_row: null, hold: null }].forEach((counts) => {
                expect(checkWords({ reason: reason, ...counts })).not.toMatch(/null|undefined|NaN/);
            });
        });
    });

    it('gives how many days in a row each check has been worse as a table, of how many take a version down (#300)', () => {
        expect(checksTable(behindOf())).toEqual({
            checks: [{ days: 1, name: 'Each day' }, { days: 5, name: '5-day average' }, { days: 20, name: '20-day average' }],
            rows: [{ key: 'checks', hold: null, name: '', counts: ['4 of 5', '0 of 10', 'not yet'] }],
        });
        expect(checksTable(behindOf(0, 2, 1)).rows[0].counts).toEqual(['0 of 5', '2 of 10', '1 of 5']);
    });

    it('gives no table for a listing that gives no checks, as one before format 2', () => {
        expect(checksTable([])).toBeNull();
        expect(checksTable(undefined)).toBeNull();
        expect(checksTable(modelOf().behind)).toBeNull();
    });
});

describe('trainedOn, what a live version learned from (#295)', () => {
    const DAYS = { training: 7, stopping: 3, first: '2026-10-05', last: '2026-10-19' };

    it('says the days it trained on, and the first and last of every day it read', () => {
        expect(trainedOn({ since: '2026-10-23', kind: 'first', days: DAYS })).toBe('7 days, Oct 5 to Oct 19');
    });

    it('says one day as a day, and a first day that is its last once', () => {
        expect(trainedOn({ days: { ...DAYS, training: 1 } })).toBe('1 day, Oct 5 to Oct 19');
        expect(trainedOn({ days: { ...DAYS, training: 1, first: '2026-10-19' } })).toBe('1 day, Oct 19');
    });

    it('says nothing where the listing gives none, as before format 4', () => {
        expect(trainedOn({ since: '2026-10-23', kind: 'first', days: null })).toBe('');
        expect(trainedOn({ since: '2026-10-23', kind: 'first' })).toBe('');
        expect(trainedOn(null)).toBe('');
        expect(trainedOn(undefined)).toBe('');
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

    it('dashes the baseline, a longer dash on a model\'s page (#300), and lightens an attempt\'s scoring to half in both themes', () => {
        expect(BASELINE_DASH).toBe('5 4');
        expect(PAGE_DASH).toBe('7 5');
        expect(SCORING_OPACITY).toBe(0.5);
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

    it('say which hold took a live version down, as its own: \'its 5-day hold\' (#300)', () => {
        expect(checkWords({ days: 1, in_a_row: 5, hold: 5 })).toBe('its 5-day hold did worse than the baseline 5 scored days in a row');
        expect(checkWords({ days: 20, in_a_row: 5, hold: 1 })).toBe('its 1-day hold’s 20-day average was worse than the baseline’s 5 days in a row');
        expect(checkWords({ days: 1, in_a_row: 5, hold: null })).toBe('worse than the baseline 5 scored days in a row');
    });

    it('say how close each check is on each hold, a row of a table each (#300)', () => {
        expect(checksTable(holdsBehindOf())).toEqual({
            checks: [{ days: 1, name: 'Each day' }, { days: 5, name: '5-day average' }, { days: 20, name: '20-day average' }],
            rows: [
                { key: 'hold-1', hold: 1, name: '1 day', counts: ['2 of 5', '0 of 10', '0 of 5'] },
                { key: 'hold-5', hold: 5, name: '5 days', counts: ['0 of 5', '0 of 10', 'not yet'] },
                { key: 'hold-20', hold: 20, name: '20 days', counts: ['0 of 5', 'not yet', 'not yet'] },
            ],
        });
    });

    it('put a dash where a hold has no such check', () => {
        const behind = holdsBehindOf().filter((check) => !(check.hold === 20 && check.days === 20));

        expect(checksTable(behind).rows[2].counts).toEqual(['0 of 5', 'not yet', '–']);
    });
});

describe('a stock model\'s holds, from format 5 on (#300)', () => {
    it('add Combined, kept by its name where a hold is by its days, after the three', () => {
        expect(COMBINED).toBe('combined');
        expect(COMBINED_HOLD).toEqual({ days: 'combined', label: 'Combined' });
        expect([1, 5, 20, 'combined'].every(isHold)).toBe(true);
        expect([2, '5', 'Combined', null, undefined].some(isHold)).toBe(false);
    });

    it('key each hold as the listing\'s holds and a track record\'s hold_days do', () => {
        expect([1, 5, 20, COMBINED].map(holdKey)).toEqual(['1d', '5d', '20d', 'combined']);
    });

    it('put Combined\'s scores in columns ending _combined', () => {
        expect(columnOf('loss', COMBINED)).toBe('loss_combined');
        expect(columnOf('up_log_loss', COMBINED)).toBe('up_log_loss_combined');
        expect(columnOf('auc_up', 5)).toBe('auc_up_5d');
    });

    it('are the holds a stock model\'s track record has columns for, and Combined', () => {
        expect(holdsOf(heldTrackOf(3)).map((hold) => hold.days)).toEqual([1, 5, 20, COMBINED]);
        expect(holdsOf(heldTrackOf(3)).map((hold) => hold.label)).toEqual(['1 day', '5 days', '20 days', 'Combined']);
        expect(holdsOf(optionsTrackOf(3)).map((hold) => hold.days)).toEqual([1, 5, 20]);
    });

    it('are also the holds the listing gives a model\'s scores on, and none for one before format 5', () => {
        expect(listedHolds(heldModelOf()).map((hold) => hold.days)).toEqual([1, 5, 20, COMBINED]);
        expect(listedHolds(modelOf())).toEqual([]);
        expect(listedHolds(null)).toEqual([]);
        expect(listedHolds(modelOf({ holds: { '1d': { days: 3 }, '5d': { days: 0 } } })).map((hold) => hold.days)).toEqual([1, 5]);
    });

    it('offer a task\'s list the holds any of its models has, in the picker\'s order', () => {
        const models = heldListingOf().models;

        expect(holdsAmong(models.filter((model) => model.task === 'direction')).map((hold) => hold.days)).toEqual([1, 5, 20, COMBINED]);
        expect(holdsAmong(models.filter((model) => model.task === OPTIONS_TASK.id)).map((hold) => hold.days)).toEqual([1, 5, 20]);
        expect(holdsAmong(listingOf().models)).toEqual([]);
    });

    it('are named in a line of text, a label and its picker', () => {
        expect(holdName(COMBINED)).toBe('combined');
        expect(holdLabel(5)).toBe('5 days');
        expect(holdLabel(COMBINED)).toBe('Combined');
        expect(holdLabel(3)).toBe('3 days');
        expect(namedHold(5)).toBe(', 5-day hold');
        expect(namedHold(COMBINED)).toBe(', combined');
        expect(namedHold(1)).toBe(', 1-day hold');
        expect(namedHold(1, true)).toBe('');
        expect(namedHold(null)).toBe('');
        expect(onThe(5)).toBe(' on the 5-day hold');
        expect(onThe(COMBINED)).toBe(' on the combined score');
        expect(onThe(null)).toBe('');
        expect(resultName(20)).toBe('20-day result');
        expect(resultName(COMBINED)).toBe('combined score');
    });

    it('offer every score but the top 10\'s on Combined, and every one on another hold', () => {
        const stocks = { id: 'direction', scores: STOCK_SCORES };

        expect(heldOut(stocks, COMBINED)).toEqual(['top10_gain', 'top10_wins']);
        expect(heldOut(stocks, 5)).toEqual([]);
        expect(heldOut(stocks, null)).toEqual([]);
        expect(heldOut(OPTIONS_TASK, 20)).toEqual([]);
    });

    it('show loss on Combined in place of a top 10\'s score, and keep the score picked on another hold', () => {
        expect(scoreOnHold('top10_gain', COMBINED)).toBe('loss');
        expect(scoreOnHold('top10_wins', COMBINED)).toBe('loss');
        expect(scoreOnHold('auc_up', COMBINED)).toBe('auc_up');
        expect(scoreOnHold('top10_gain', 5)).toBe('top10_gain');
        expect(scoreOnHold('top10_gain', null)).toBe('top10_gain');
    });

    it('count a stock model\'s 1-day result in the next trading day, its 5-day in 6, its 20-day and Combined in 21', () => {
        const stocks = { id: 'direction', scores: STOCK_SCORES };

        expect([1, 5, 20, COMBINED].map((hold) => resultDays(stocks, hold))).toEqual([1, 6, 21, 21]);
        expect([1, 5, 20].map((hold) => resultDays(OPTIONS_TASK, hold))).toEqual([2, 6, 21]);
        expect(resultDays(undefined, 1)).toBe(1);
    });

    it('say when each result comes in, in a sentence and in a row', () => {
        const stocks = { id: 'direction', scores: STOCK_SCORES };

        expect(comesIn(stocks, 1)).toBe('the next trading day');
        expect(comesIn(stocks, 5)).toBe('6 trading days after its prediction');
        expect(comesIn(OPTIONS_TASK, 1)).toBe('2 trading days after its prediction');
        expect(resultLag(stocks, 1)).toBe('the next trading day');
        expect(resultLag(stocks, 20)).toBe('21 trading days later');
        expect(resultLag(stocks, COMBINED)).toBe('with the 20-day result');
    });

    it('say after whose prediction a result comes in, where a line names no one prediction', () => {
        const stocks = { id: 'direction', scores: STOCK_SCORES };

        expect(comesIn(stocks, 20, 'the')).toBe('21 trading days after the prediction');
        expect(comesIn(stocks, 1, 'the')).toBe('the next trading day');
    });

    it('say when a hold\'s results come in, as a line under its name on a model\'s page', () => {
        const stocks = { id: 'direction', scores: STOCK_SCORES };

        expect(comesInLine(stocks, 1)).toBe('Comes in the next trading day');
        expect(comesInLine(stocks, 5)).toBe('Comes in 6 trading days after the prediction');
        expect(comesInLine(stocks, 20)).toBe('Comes in 21 trading days after the prediction');
        expect(comesInLine(stocks, COMBINED)).toBe('Comes in with the day’s 20-day result');
        expect(comesInLine(OPTIONS_TASK, 1)).toBe('Comes in 2 trading days after the prediction');
    });

    it('say a hold has no results yet, and when each comes in', () => {
        const stocks = { id: 'direction', scores: STOCK_SCORES };

        expect(noResultsYet(stocks, 1)).toBe('No 1-day results yet: each one comes in the next trading day.');
        expect(noResultsYet(stocks, 20)).toBe('No 20-day results yet: each one comes in 21 trading days after its prediction.');
        expect(noResultsYet(stocks, COMBINED)).toBe('No combined scores yet: each one comes in with its day’s 20-day result, 21 trading days after its prediction.');
        expect(noResultsYet(OPTIONS_TASK, 5)).toBe('No 5-day results yet: each one comes in 6 trading days after its prediction.');
    });

    it('say what a stock model\'s hold is, and when its results come in, under the pickers', () => {
        const stocks = { id: 'direction', scores: STOCK_SCORES };

        expect(holdLine(stocks, 5)).toBe('5-day hold: bought at 9:40 AM on the next trading day and sold at 3:40 PM 5 trading days later, the days the options models’ 5-day hold uses. Each result comes in 6 trading days after its prediction.');
        expect(holdLine(stocks, 1)).toBe('1-day hold: from 9:40 AM to 3:40 PM on the next trading day, as the model predicts today. Each result comes in the next trading day.');
        expect(holdLine(stocks, 20)).toMatch(/sold at 3:40 PM 20 trading days later\. Each result comes in 21 trading days after its prediction, about a month\.$/);
        expect(holdLine(stocks, COMBINED)).toMatch(/^Combined: the average of the 1, 5 and 20-day scores/);
    });

    it('give a model\'s scores on a hold from the listing\'s holds, and its own where the listing gives none', () => {
        const model = heldModelOf();

        expect(scoresOn(model, 5)).toEqual({ score: model.holds['5d'].score, baseline: model.holds['5d'].baseline, days: 25, hold: 5 });
        expect(scoresOn(model, 20)).toEqual({ score: null, baseline: null, days: 0, hold: 20 });
        expect(scoresOn(model, null)).toEqual({ score: model.score, baseline: model.baseline, days: 30, hold: null });
        expect(scoresOn(model)).toEqual(scoresOn(model, null));
        expect(scoresOn(modelOf(), 5)).toEqual({ score: modelOf().score, baseline: modelOf().baseline, days: 30, hold: null });
        expect(scoresOn(modelOf({ holds: { '1d': model.holds['1d'] } }), 5).hold).toBeNull();
    });

    it('read an options model\'s scores on a longer hold from its track record where the listing gives none, before format 5', () => {
        const model = modelOf({ name: 'pt-options', task: 'option-picks' });
        const rows = optionsTrackOf(30);
        const scored = rows.filter((row) => row.score.loss_5d !== null);
        const newest = scored[scored.length - 1];
        const on = scoresAt(model, 5, rows);

        expect(on.hold).toBe(5);
        expect(on.days).toBe(scored.length);
        expect(on.score.loss).toBe(newest.average.loss_5d);
        expect(on.baseline.loss).toBe(newest.baseline_average.loss_5d);
        expect(on.score.profit_auc).toBe(newest.average.profit_auc_5d);
        expect(on.pending).toBeUndefined();
    });

    it('give the listing\'s scores where it has the hold, or the hold is the first, or none is picked', () => {
        const model = heldModelOf();

        expect(scoresAt(model, 5, optionsTrackOf(30))).toEqual(scoresOn(model, 5));
        expect(scoresAt(modelOf(), 1, undefined)).toEqual(scoresOn(modelOf(), 1));
        expect(scoresAt(modelOf(), null, undefined)).toEqual(scoresOn(modelOf(), null));
    });

    it('are on their way with the record, and none where it could not be had or has no columns for the hold', () => {
        expect(scoresAt(modelOf(), 5, undefined)).toEqual({ score: null, baseline: null, days: 0, hold: 5, pending: true });
        expect(scoresAt(modelOf(), 20, null)).toEqual({ score: null, baseline: null, days: 0, hold: 20 });
        expect(scoresAt(modelOf(), 5, trackOf(10))).toEqual({ score: null, baseline: null, days: 0, hold: 5 });
    });

    it('sort an options list by its rows\' track records on a longer hold, before format 5', () => {
        const worse = modelOf({ name: 'aaa', task: 'option-picks' });
        const better = modelOf({ name: 'zzz', task: 'option-picks' });
        const records = { aaa: optionsTrackOf(30, '2026-09-01', () => 0.9), zzz: optionsTrackOf(30, '2026-09-01', () => 0.8) };

        expect(sortModels([worse, better], 'score', 'loss', 5, records).map((each) => each.name)).toEqual(['zzz', 'aaa']);
        expect(sortModels([better, worse], 'score', 'loss', 5, { aaa: records.aaa }).map((each) => each.name)).toEqual(['aaa', 'zzz']);
    });

    it('sort models by their scores on the hold', () => {
        const models = heldListingOf().models.slice(0, 2).reverse();

        expect(sortModels(models, 'score', 'loss', 5).map((model) => model.name)).toEqual(['tables-gnn', 'pt-gnn']);
        expect(sortModels(models, 'score', 'loss', 20).map((model) => model.name)).toEqual(['pt-gnn', 'tables-gnn']);
    });

    it('take loss\'s parts on a hold from its own columns', () => {
        const newest = heldTrackOf(30).slice(-1)[0];

        expect(lossParts(newest, 5).map((part) => part.value)).toEqual([
            newest.average.up_log_loss_5d,
            newest.average.beats_log_loss_5d,
            newest.average.move_pinball_5d,
        ]);
        expect(lossParts(newest, 20)).toEqual([]);
        expect(lossParts(heldTrackOf(30, { twenty: 30 }).slice(-1)[0], COMBINED)).toHaveLength(3);
    });

    it('say on Combined that loss is the average of the day\'s three losses, and on a longer hold when the top 10 is sold', () => {
        const stocks = { id: 'direction', scores: STOCK_SCORES };

        expect(noteOf('loss', stocks, COMBINED)).toMatch(/^On Combined, loss is the average of the day’s 1, 5 and 20-day losses/);
        expect(noteOf('loss', stocks, 5)).toBe(noteOf('loss', stocks));
        expect(noteOf('top10_gain', stocks, 5)).toMatch(/bought at the 9:40 AM ask on the next trading day and sold at the 3:40 PM bid on the sell day/);
        expect(noteOf('top10_gain', stocks, 1)).toMatch(/sold at the 3:40 PM bid the same day/);
        expect(noteOf('loss', OPTIONS_TASK, COMBINED)).toBe(noteOf('loss', OPTIONS_TASK));
        expect(noteOf('auc_up', stocks, COMBINED)).toBe(noteOf('auc_up', stocks));
    });

    it('name the hold of a take-down for doing worse or for its track record, and none for not_ahead', () => {
        expect(checkWords({ reason: 'worse', days: 1, in_a_row: 5, hold: 5 })).toBe('its 5-day hold did worse than the baseline 5 scored days in a row');
        expect(checkWords({ reason: 'track_record', days: null, in_a_row: null, hold: 20 }))
            .toBe('its 20-day hold’s track record showed nothing better than the baseline, even on the days this version predicted itself');
        expect(checkWords({ reason: 'not_ahead', days: null, in_a_row: null, hold: 5 })).toBe('it went live without beating the baseline');
        expect(checkWords({ reason: 'track_record', days: null, in_a_row: null, hold: 20 })).not.toMatch(/null|undefined|NaN/);
    });
});

describe('listLine, what the hold a list of /model is on is (#300)', () => {
    const stocks = { id: 'direction', scores: STOCK_SCORES };

    it('says a list of stocks\' hold in its own words', () => {
        expect(listLine(stocks, 1)).toBe('1-day hold: from 9:40 AM to 3:40 PM on the next trading day, as the stock models predict today.');
        expect(listLine(stocks, 5)).toBe('5-day hold: bought at 9:40 AM on the next trading day and sold at 3:40 PM 5 trading days later. Each result comes in 6 trading days after its prediction.');
        expect(listLine(stocks, COMBINED)).toBe('Combined: the average of the 1, 5 and 20-day scores of the same prediction days, in with the 20-day result. The top 10 has none.');
    });

    it('says a list of options\' hold in its own words', () => {
        expect(listLine(OPTIONS_TASK, 1)).toBe('1-day hold: bought at the 9:40 AM ask on the next trading day and sold at the 3:40 PM bid the day after.');
        expect(listLine(OPTIONS_TASK, 20)).toBe('20-day hold: sold at the 3:40 PM bid 20 trading days after the buy day.');
    });
});

describe('trackLine, what a track record says of its days (#300)', () => {
    const stocks = { id: 'direction', scores: STOCK_SCORES };

    it('says a model with no holds is scored once each day\'s prices are in', () => {
        expect(trackLine(stocks, null)).toBe('Each day’s real predictions, scored once that day’s prices are in.');
        expect(trackLine(undefined)).toBe('Each day’s real predictions, scored once that day’s prices are in.');
    });

    it('says a stock model\'s 1-day hold is scored the next trading day', () => {
        expect(trackLine(stocks, 1)).toBe('Each day’s real predictions, scored the next trading day.');
    });

    it('says a longer hold is scored once its sell day is in, and that its newest days are not yet', () => {
        expect(trackLine(stocks, 5)).toBe('Each day’s real predictions, scored once the 5-day hold’s sell day is in, 6 trading days later. The newest days aren’t in yet.');
        expect(trackLine(stocks, 20)).toBe('Each day’s real predictions, scored once the 20-day hold’s sell day is in, 21 trading days later. The newest days aren’t in yet.');
    });

    it('says an options model\'s 1-day hold is scored a day after its sell day', () => {
        expect(trackLine(OPTIONS_TASK, 1)).toBe('Each day’s real predictions, scored once the 1-day hold’s sell day is in, 2 trading days later. The newest days aren’t in yet.');
    });

    it('says Combined is the average of each day\'s three, in with its 20-day result', () => {
        expect(trackLine(stocks, COMBINED)).toBe('The average of each day’s 1, 5 and 20-day scores, in once its 20-day result is.');
    });
});

describe('when a stock model\'s holds switch on and first come in (#300)', () => {
    it('are the api\'s docs\' days: the 5-day hold at the Oct 31 retrain, the 20-day at the Nov 21, Combined with it', () => {
        expect(HOLD_SCHEDULE).toEqual({
            5: { on: '2026-10-31', first: '2026-11-11' },
            20: { on: '2026-11-21', first: '2026-12-24' },
            combined: { on: null, first: '2026-12-24' },
        });
    });

    it('hold out the newest 3 days from each night\'s attempt', () => {
        expect(HELD_OUT).toBe(3);
    });
});

describe('predictsLine, the holds a stock model predicts (#300)', () => {
    it('lists every hold that has switched on', () => {
        expect(predictsLine(heldModelOf(), '2027-01-07')).toBe('1, 5 and 20 days');
        expect(predictsLine(heldModelOf(), '2026-11-21')).toBe('1, 5 and 20 days');
    });

    it('says when a hold yet to switch on does', () => {
        const unscored = modelOf({ holds: { '1d': { days: 30 }, '5d': { days: 0 }, '20d': { days: 0 } } });

        expect(predictsLine(heldModelOf(), '2026-11-13')).toBe('1 and 5 days; 20 days from the Nov 21 retrain');
        expect(predictsLine(unscored, '2026-10-24')).toBe('1 day; 5 days from the Oct 31 retrain; 20 days from the Nov 21 retrain');
    });

    it('reads a hold with scored days as switched on, whatever day it was due to', () => {
        const early = modelOf({ holds: { '1d': { days: 30 }, '5d': { days: 3 }, '20d': { days: 2 } } });

        expect(predictsLine(early, '2026-10-24')).toBe('1, 5 and 20 days');
        expect(predictsLine(heldModelOf(), '2026-10-24')).toBe('1 and 5 days; 20 days from the Nov 21 retrain');
    });

    it('names a single hold in the singular only for one day', () => {
        expect(predictsLine(modelOf({ holds: { '5d': { days: 3 } } }), '2027-01-07')).toBe('5 days');
        expect(predictsLine(modelOf({ holds: { '1d': { days: 3 } } }), '2027-01-07')).toBe('1 day');
    });

    it('says only when it switches on, where no hold it has is on yet', () => {
        expect(predictsLine(modelOf({ holds: { '20d': { days: 0 } } }), '2026-11-13')).toBe('20 days from the Nov 21 retrain');
    });

    it('says nothing of a model the listing gives no holds', () => {
        expect(predictsLine(modelOf(), '2027-01-07')).toBe('');
    });
});

describe('firstResult, the day a hold\'s first result came in (#300)', () => {
    const stocks = { id: 'direction', scores: STOCK_SCORES };

    it('is the row as many rows after the first day scored on the hold as its results take to come in', () => {
        const rows = heldTrackOf(30);

        expect(firstResult(rows, stocks, 1)).toEqual({ day: '2026-09-02', predicted: '2026-09-01' });
        expect(firstResult(rows, stocks, 5)).toEqual({ day: '2026-09-09', predicted: '2026-09-01' });
    });

    it('reads the 20-day hold and Combined, each in 21 trading days', () => {
        const rows = heldTrackOf(30, { twenty: 30 });

        expect(firstResult(rows, stocks, 20)).toEqual({ day: '2026-09-30', predicted: '2026-09-01' });
        expect(firstResult(rows, stocks, COMBINED)).toEqual({ day: '2026-09-30', predicted: '2026-09-01' });
    });

    it('starts from the first day that has the hold\'s result, not the record\'s first', () => {
        const rows = heldTrackOf(30).map((row, at) => (at < 3 ? { ...row, score: { ...row.score, loss_5d: null } } : row));

        expect(firstResult(rows, stocks, 5)).toEqual({ day: '2026-09-14', predicted: '2026-09-04' });
    });

    it('reads the 1-day hold from the record\'s own columns, a day after an options model\'s sell day', () => {
        expect(firstResult(optionsTrackOf(30), OPTIONS_TASK, 1)).toEqual({ day: '2026-09-03', predicted: '2026-09-01' });
        expect(firstResult(trackOf(5), stocks, 1)).toEqual({ day: '2026-09-02', predicted: '2026-09-01' });
    });

    it('is none for a hold with no day scored, a record without the row its result came in on, or one not in', () => {
        expect(firstResult(heldTrackOf(30), stocks, 20)).toBeNull();
        expect(firstResult(heldTrackOf(4, { notIn: 0 }), stocks, 5)).toBeNull();
        expect(firstResult(undefined, stocks, 1)).toBeNull();
        expect(firstResult(null, stocks, 1)).toBeNull();
        expect(firstResult([], stocks, 1)).toBeNull();
    });
});

describe('whenRows, when each of a stock model\'s holds\' results come in (#300)', () => {
    const stocks = { id: 'direction', scores: STOCK_SCORES };

    it('lists each hold the listing gives, with when its results come in', () => {
        const rows = whenRows(stocks, heldModelOf(), heldTrackOf(), '2026-11-13');

        expect(rows.map((row) => [row.key, row.name, row.when])).toEqual([
            ['1d', '1 day', 'Comes in the next trading day'],
            ['5d', '5 days', 'Comes in 6 trading days after the prediction'],
            ['20d', '20 days', 'Comes in 21 trading days after the prediction'],
            ['combined', 'Combined', 'Comes in with the day’s 20-day result'],
        ]);
    });

    it('says when a hold with results was first scored, from its track record', () => {
        const rows = whenRows(stocks, heldModelOf(), heldTrackOf(), '2026-11-13');

        expect(rows[0].first).toBe('First scored Sep 2');
        expect(rows[1].first).toBe('First scored Sep 9');
    });

    it('says when a hold scored before the day it was due to switch on was first scored, as of any hold with results', () => {
        const rows = heldTrackOf(30, { twenty: 30 });
        const when = whenRows(stocks, heldModelOf({}, rows), rows, '2026-10-24');

        expect(when[2].first).toBe('First scored Sep 30');
    });

    it('says while a hold has no results when it switches on and is first due, or only when it is due once it is on', () => {
        const rows = whenRows(stocks, heldModelOf(), heldTrackOf(), '2026-11-13');

        expect(rows[2].first).toBe('Switches on at the Nov 21 retrain; first scored Dec 24');
        expect(rows[3].first).toBe('First scored Dec 24');
        expect(whenRows(stocks, heldModelOf(), heldTrackOf(), '2026-12-01')[2].first).toBe('First scored Dec 24');
        expect(whenRows(stocks, heldModelOf(), heldTrackOf(), '2026-12-24')[2].first).toBe('First scored Dec 24');
    });

    it('names the retrain a hold switched on at, where its first day scored came in the week after it', () => {
        const rows = heldTrackOf(30, { from: '2026-11-02', twenty: 30 });
        const when = whenRows(stocks, heldModelOf({}, rows), rows, '2027-01-07');

        expect(when.map((row) => row.first)).toEqual([
            'First scored Nov 3',
            'First scored Nov 10, from the Oct 31 retrain',
            'First scored Dec 1',
            'First scored Dec 1',
        ]);
    });

    it('names the 20-day hold\'s retrain, and none for a hold first scored weeks after its own', () => {
        const rows = heldTrackOf(30, { from: '2026-11-23', twenty: 30 });
        const when = whenRows(stocks, heldModelOf({}, rows), rows, '2027-02-01');

        expect(when[1].first).toBe('First scored Dec 1');
        expect(when[2].first).toBe('First scored Dec 22, from the Nov 21 retrain');
    });

    it('says nothing of a day due that has gone by with no result, or of a record still on its way', () => {
        const passed = whenRows(stocks, heldModelOf(), heldTrackOf(), '2027-01-07');

        expect(passed[2].first).toBe('');
        expect(passed[3].first).toBe('');

        const waiting = whenRows(stocks, heldModelOf(), undefined, '2026-11-13');

        expect(waiting[0].first).toBe('');
        expect(waiting[1].first).toBe('');
        expect(waiting[2].first).toBe('Switches on at the Nov 21 retrain; first scored Dec 24');
    });

    it('says nothing of a 1-day hold with no day scored, which has no day due', () => {
        const model = modelOf({ holds: { '1d': { days: 0, score: null, baseline: null } } });

        expect(whenRows(stocks, model, [], '2026-11-13')).toEqual([
            { key: '1d', name: '1 day', when: 'Comes in the next trading day', first: '' },
        ]);
    });

    it('lists nothing for a model the listing gives no holds', () => {
        expect(whenRows(stocks, modelOf(), trackOf(5), '2026-11-13')).toEqual([]);
    });
});

describe('checksNote, the note under the take-down checks (#300)', () => {
    it('says what "not yet" means of a model with holds, and what a hold at its limit does', () => {
        expect(checksNote(heldModelOf({ behind: holdsBehindOf() }), '2027-01-07', true))
            .toBe('A check says “not yet” until its hold has the scored days it needs. A hold that reaches its limit takes the version down.');
    });

    it('says first when a stock model\'s hold yet to switch on does', () => {
        const unscored = modelOf({ holds: { '1d': { days: 30 }, '5d': { days: 0 }, '20d': { days: 0 } }, behind: holdsBehindOf() });

        expect(checksNote(heldModelOf({ behind: holdsBehindOf() }), '2026-11-13', true))
            .toBe('The 20-day hold switches on at the Nov 21 retrain. A check says “not yet” until its hold has the scored days it needs. A hold that reaches its limit takes the version down.');
        expect(checksNote(unscored, '2026-10-24', true))
            .toMatch(/^The 5-day hold switches on at the Oct 31 retrain\. The 20-day hold switches on at the Nov 21 retrain\. A check/);
    });

    it('says nothing of switching on for a hold already scored, whatever day it was due to', () => {
        const early = modelOf({ holds: { '1d': { days: 30 }, '5d': { days: 3 }, '20d': { days: 2 } }, behind: holdsBehindOf() });

        expect(checksNote(early, '2026-10-24', true)).toMatch(/^A check says/);
        expect(checksNote(heldModelOf({ behind: holdsBehindOf() }), '2026-10-24', true)).toMatch(/^The 20-day hold switches on at the Nov 21 retrain\. A check/);
    });

    it('says nothing of switching on for a model that is not a stock model', () => {
        expect(checksNote(heldModelOf({ behind: holdsBehindOf() }), '2026-11-13', false)).toMatch(/^A check says/);
        expect(checksNote(heldModelOf({ behind: holdsBehindOf() }), '2026-11-13')).toMatch(/^A check says/);
    });

    it('says it of its checks alone for a model with no holds', () => {
        const plain = 'A check says “not yet” until it has the scored days it needs. One that reaches its limit takes the version down.';

        expect(checksNote(modelOf({ behind: behindOf() }), '2026-11-13', false)).toBe(plain);
        expect(checksNote(modelOf(), '2026-11-13', false)).toBe(plain);
        expect(checksNote(modelOf({ behind: undefined }), '2026-11-13', false)).toBe(plain);
    });
});
