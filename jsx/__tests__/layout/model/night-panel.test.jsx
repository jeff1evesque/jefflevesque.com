/**
 * night-panel.test.jsx: the night picked on a model's attempts' charts, in a
 * panel under them (#318).
 *
 * Note: each night is attempts-chart.jsx's attemptPoints' of a history, as the
 *       chart hands it to the panel, so the real nights of pt-options and pt-gnn
 *       read as the page reads them.
 */

import React from 'react';
import { render, screen, within } from '@testing-library/react';

import NightPanel, {
    REASONS,
    SCRATCH_NOTE,
    TUNED,
    chargeWords,
    dayList,
    daysDrawn,
    kindWords,
    reasonWords,
    resultWords,
    startedFrom,
    startedNote,
    tookWords,
    tunedDays,
} from '../../../import/layout/model/night-panel.jsx';
import { attemptPoints } from '../../../import/layout/model/attempts-chart.jsx';
import { historyOf, ptGnnHistory, ptOptionsHistory, timedHistoryOf } from '../../../test-support/model-fixtures.js';

//
// pt-options' nights on `score`: its first version, Oct 21, its Oct 26 night,
// which went live, and its Oct 27 night, kept back behind the simple guess
//
function optionsNight(at, score = 'loss') {
    return attemptPoints(ptOptionsHistory(), score)[at];
}

//
// pt-gnn's Oct 27 night, which trained again after its test, and went live
//
function gnnNewest() {
    const points = attemptPoints(ptGnnHistory(), 'loss');

    return points[points.length - 1];
}

//
// a night of pt-gnn's history as format 11 gives it (#339), each with what
// decided it, `reason`, as the trainer works it out for every past night too:
// its first version, Oct 9, and its Oct 23 weekly retrain, which went live
// under the rule used until Oct 26, as the fixture has them
//
function gnnNight(at, reason) {
    const rows = ptGnnHistory();

    rows[at] = { ...rows[at], reason: reason };

    return attemptPoints(rows, 'loss')[at];
}

//
// pt-gnn's and tables-gnn's nights as the live histories had them on Nov 7, 2026
// (#339), each on loss, which decides, to six places, as four moved a gap's third
// place, and with what decided it: pt-gnn's Nov 3 and 4 nights went live by
// beating the simple guess, beside a version in charge that did better, and its
// Nov 6 weekly retrain was kept back behind it; tables-gnn's Oct 20 night was
// kept back by the rule used until Oct 26, though it beat the simple guess
//
const LIVE_NIGHTS = {
    gnnNov3: { day: '2026-11-03', tested: '2026-11-04', kind: 'nightly', went_live: true, attempt: 1.674208, live: 1.66075, baseline: 1.678618 },
    gnnNov4: { day: '2026-11-04', tested: '2026-11-05', kind: 'nightly', went_live: true, attempt: 1.656524, live: 1.6534, baseline: 1.659488 },
    gnnNov6: { day: '2026-11-06', tested: '2026-11-07', kind: 'weekly', went_live: false, attempt: 1.723774, live: 1.692991, baseline: 1.718282 },
    tablesOct20: { day: '2026-10-20', tested: '2026-10-21', kind: 'nightly', went_live: false, attempt: 1.622965, live: 1.621556, baseline: 1.639529 },
};

function liveNight(name, reason) {
    const { attempt, live, baseline, ...night } = LIVE_NIGHTS[name];
    const [row] = ptGnnHistory().slice(-1);

    return attemptPoints([{
        ...row,
        ...night,
        reason: reason,
        attempt: { loss: attempt },
        live: { loss: live },
        baseline: { loss: baseline },
    }], 'loss')[0];
}

//
// the marks the chart names each box after, as plain stand-ins
//
const MARKS = {
    attempt: <svg className='model-mark' data-mark='attempt' />,
    live: <svg className='model-mark' data-mark='live' />,
    baseline: <svg className='model-mark' data-mark='baseline' />,
};

function draw(point, score = 'loss') {
    return render(<NightPanel point={point} score={score} marks={MARKS} />);
}

//
// a night whose history lists its days by kind (#318), as the trainer is to
// list them: pt-options' Oct 26 night, its days as the trainer drew them, and a
// night of late November, whose draw left eight earlier days out
//
const OCT_26 = {
    studied_days: ['2026-10-06', '2026-10-08', '2026-10-09', '2026-10-12', '2026-10-13', '2026-10-14', '2026-10-19'],
    stopping_days: ['2026-10-05', '2026-10-07', '2026-10-15'],
    skipped_days: ['2026-10-16'],
    pending_days: ['2026-10-23', '2026-10-26'],
    unpicked_days: [],
    trained_again_days: [],
};

const NOV_23 = {
    day: '2026-11-23',
    tested: '2026-11-24',
    held_out_days: ['2026-11-17', '2026-11-18', '2026-11-19'],
    studied_days: [
        '2026-10-05', '2026-10-08', '2026-10-12', '2026-10-13', '2026-10-15', '2026-10-19', '2026-10-21', '2026-10-23', '2026-10-26', '2026-10-28',
        '2026-10-30', '2026-11-02', '2026-11-05', '2026-11-06', '2026-11-09', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-16',
    ],
    stopping_days: ['2026-10-07', '2026-10-22', '2026-11-04'],
    skipped_days: ['2026-10-16'],
    pending_days: ['2026-11-20', '2026-11-23'],
    unpicked_days: ['2026-10-06', '2026-10-09', '2026-10-14', '2026-10-20', '2026-10-27', '2026-10-29', '2026-11-03', '2026-11-10'],
    trained_again_days: [],
};

function listedNight(lists, at = 3) {
    const rows = ptOptionsHistory();

    rows[at] = { ...rows[at], ...lists };

    return attemptPoints(rows, 'loss')[at];
}

//
// a night with the days fine-tuning trained on (#334), as its history lists
// them: on pt-options' Oct 26 night, its 3 test days and 3 days it trained on,
// out of order, as a list need not be in order
//
const TUNED_DAYS = ['2026-10-22', '2026-10-06', '2026-10-20', '2026-10-13', '2026-10-21', '2026-10-09'];

function withTuned(point, tuned = TUNED_DAYS) {
    return { ...point, days: { ...point.days, tuned } };
}

//
// the note on the days fine-tuning trained on, as the key gives it (#334)
//
const TUNED_NOTE = 'Once a new version beats the simple guess on its 3 test days, it’s trained a little more on those days, plus 3 older days it '
    + 'already trained on, picked at random. Then it’s scored on the validation days again. If it does more than 0.005 worse there than before, '
    + 'the version from before the fine-tune goes live instead.';

//
// what the full strip draws: each month's row, its name and then its days, each
// the date in it and its kind's class
//
function stripOf(container) {
    return [...container.querySelectorAll('.model-day-row')].map((row) => ({
        month: row.querySelector('.model-day-month').textContent,
        days: [...row.querySelectorAll('.model-day')].map((day) => [day.textContent, day.className.replace('model-day ', '')]),
    }));
}

//
// the panel's three boxes, each its name and its value
//
function boxesOf(container) {
    return [...container.querySelectorAll('.model-night-box')].map((box) => [
        box.querySelector('.model-night-box-name').textContent,
        box.querySelector('.model-night-box-value').textContent,
    ]);
}

describe('kindWords', () => {
    it('calls a model\'s first version so, before what kind of attempt made it', () => {
        expect(kindWords(optionsNight(0))).toBe('first version');
    });

    it('calls a weekly retrain a weekly full retrain, and a nightly update so', () => {
        expect(kindWords(optionsNight(2))).toBe('weekly full retrain');
        expect(kindWords(optionsNight(3))).toBe('nightly update');
    });
});

describe('resultWords', () => {
    it('says by how much pt-options\' Oct 26 night beat the simple guess and the version in charge, on loss', () => {
        expect(resultWords(optionsNight(3))).toBe('On loss it beat the simple guess by 0.046 and the version in charge by 0.001.');
    });

    it('says by how much its Oct 27 night lost to the simple guess, and beat the version in charge', () => {
        expect(resultWords(optionsNight(4))).toBe('On loss it lost to the simple guess by 0.013 and beat the version in charge by 0.014.');
    });

    it('gives a first version no gap to a version in charge it never had', () => {
        expect(resultWords(optionsNight(0))).toBe('On loss it lost to the simple guess by 0.062.');
    });

    it('says a new version tied one it printed level with', () => {
        expect(resultWords(gnnNewest())).toBe('On loss it beat the simple guess by 0.017 and tied the version in charge.');
        expect(resultWords({ first: false, lossGaps: { guess: 0.0001, charge: -0.0002 } })).toBe('On loss it tied the simple guess and the version in charge.');
    });

    it('stays on loss, which decides, whichever score is picked', () => {
        expect(resultWords(optionsNight(3, 'profit_auc'))).toBe(resultWords(optionsNight(3)));
    });

    it('says the gap it has where the night has only one, and nothing where it has neither', () => {
        expect(resultWords({ first: false, lossGaps: { guess: null, charge: 0.01 } })).toBe('On loss it beat the version in charge by 0.010.');
        expect(resultWords({ first: false, lossGaps: { guess: null, charge: null } })).toBe('');
    });

    describe('on a night the simple guess decided, from format 11 (#339)', () => {
        it('says the version in charge apart, shown for comparison only, by how much better it did: pt-gnn\'s Nov 3 and 4 nights', () => {
            expect(resultWords(liveNight('gnnNov4', 'ahead_of_baseline')))
                .toBe('On loss it beat the simple guess by 0.003. The version in charge, shown for comparison only, did 0.003 better.');
            expect(resultWords(liveNight('gnnNov3', 'ahead_of_baseline')))
                .toBe('On loss it beat the simple guess by 0.004. The version in charge, shown for comparison only, did 0.013 better.');
        });

        it('says so on a night kept back behind the simple guess, as pt-gnn\'s Nov 6 retrain was', () => {
            expect(resultWords(liveNight('gnnNov6', 'behind_baseline')))
                .toBe('On loss it lost to the simple guess by 0.005. The version in charge, shown for comparison only, did 0.031 better.');
        });

        it('says how much worse the version in charge did, or that it scored the same, from its own side', () => {
            const night = (charge) => ({ first: false, reason: 'same_for_every_stock', lossGaps: { guess: 0.004, charge: charge } });

            expect(resultWords(night(0.002))).toBe('On loss it beat the simple guess by 0.004. The version in charge, shown for comparison only, did 0.002 worse.');
            expect(resultWords(night(0.0001))).toBe('On loss it beat the simple guess by 0.004. The version in charge, shown for comparison only, scored the same.');
        });

        it('says it tied the simple guess, where it printed level with it', () => {
            expect(resultWords({ first: false, reason: 'behind_baseline', lossGaps: { guess: -0.0001, charge: -0.01 } }))
                .toBe('On loss it tied the simple guess. The version in charge, shown for comparison only, did 0.010 better.');
        });

        it('says nothing of a version in charge a first version never had, nor of one it has no gap to', () => {
            expect(resultWords({ ...optionsNight(0), reason: 'ahead_of_baseline' })).toBe('On loss it lost to the simple guess by 0.062.');
            expect(resultWords({ first: false, reason: 'ahead_of_baseline', lossGaps: { guess: 0.004, charge: null } }))
                .toBe('On loss it beat the simple guess by 0.004.');
            expect(resultWords({ first: false, reason: 'ahead_of_baseline', lossGaps: { guess: null, charge: null } })).toBe('');
        });
    });

    describe('on a night the version in charge decided, or that doesn\'t say, as before (#339)', () => {
        it('says both as one, as the version in charge decided: tables-gnn\'s Oct 20 night, kept back though it beat the simple guess', () => {
            expect(resultWords(liveNight('tablesOct20', 'behind_live')))
                .toBe('On loss it beat the simple guess by 0.017 and lost to the version in charge by 0.001.');
        });

        it('says pt-gnn\'s Oct 23 retrain tied the simple guess, and beat the version in charge, which decided', () => {
            expect(resultWords(gnnNight(10, 'ahead_of_live'))).toBe('On loss it tied the simple guess and beat the version in charge by 0.007.');
        });

        it('reads a night with no reason, as a history from before format 11 gives it, as it always did', () => {
            expect(resultWords(liveNight('gnnNov4', null)))
                .toBe('On loss it beat the simple guess by 0.003 and lost to the version in charge by 0.003.');
        });
    });
});

describe('REASONS and reasonWords (#339)', () => {
    it('says what decided each kind of night, in the issue\'s words', () => {
        expect(REASONS).toEqual({
            ahead_of_baseline: 'Beat the simple guess on its 3 test days, which is all a new version needs. '
                + 'The version in charge is shown for comparison: it has usually trained on some of those days already.',
            behind_baseline: 'Didn’t beat the simple guess on its 3 test days.',
            same_for_every_stock: 'Gave every stock the same answer, so it wasn’t really predicting, even though it beat the simple guess.',
            ahead_of_live: 'Decided by the rule used until Oct 26: a new version had to beat the version in charge, not the simple guess.',
            behind_live: 'Decided by the rule used until Oct 26: it beat the simple guess but not the version in charge.',
            first: 'The model’s first version, which went live under an older rule without having to beat the simple guess.',
        });
    });

    it('gives a night\'s line by its reason', () => {
        Object.keys(REASONS).forEach((reason) => expect(reasonWords({ reason: reason })).toBe(REASONS[reason]));
    });

    it('gives none for a night that doesn\'t say, as a history from before format 11 doesn\'t, nor for a reason it doesn\'t know', () => {
        expect(reasonWords(optionsNight(3))).toBe('');
        expect(reasonWords({ reason: null })).toBe('');
        expect(reasonWords({})).toBe('');
        expect(reasonWords({ reason: 'toString' })).toBe('');
    });
});

describe('startedFrom', () => {
    it('says a nightly update started from the version that went live before it, named by the morning it did (#339)', () => {
        expect(startedFrom(optionsNight(3))).toBe('Started from the Sat Oct 24 version.');
        expect(startedFrom(optionsNight(4))).toBe('Started from the Tue Oct 27 version.');
    });

    it('says a weekly retrain and a first version were built from scratch', () => {
        expect(startedFrom(optionsNight(2))).toBe('Built from scratch.');
        expect(startedFrom(optionsNight(0))).toBe('Built from scratch.');
    });

    it('says nothing for a nightly update with no version before it', () => {
        expect(startedFrom({ ...optionsNight(3), from: null })).toBe('');
    });
});

describe('startedNote (#336)', () => {
    const SCRATCH = 'Instead of building on an earlier version, it started with new weights.';

    it('names the version a nightly update began with by the morning it went live, as the line the note opens over does (#339)', () => {
        expect(startedNote(optionsNight(3))).toBe('It began with the weights of the Sat Oct 24 version, and kept training them.');
        expect(startedNote(optionsNight(4))).toBe('It began with the weights of the Tue Oct 27 version, and kept training them.');
    });

    it('says the update began from before that version\'s fine-tune where that version went live fine-tuned, and only there', () => {
        expect(startedNote({ ...optionsNight(4), fromTuned: true }))
            .toBe('It began with the weights of the Tue Oct 27 version, from before its fine-tune, and kept training them.');
        expect(startedNote(optionsNight(4))).not.toMatch(/fine-tun|\bif\b/i);
    });

    it('notes that a weekly retrain and a first version started with new weights', () => {
        expect(SCRATCH_NOTE).toBe(SCRATCH);
        expect(startedNote(optionsNight(2))).toBe(SCRATCH);
        expect(startedNote(optionsNight(0))).toBe(SCRATCH);
    });

    it('notes nothing for a nightly update with no version before it, as there is no line', () => {
        expect(startedNote({ ...optionsNight(3), from: null })).toBe('');
        expect(startedNote({ ...optionsNight(3), from: null, fromTuned: true })).toBe('');
    });

    it('gives no count of days, which the strip shows, and which would go stale', () => {
        [optionsNight(3), { ...optionsNight(4), fromTuned: true }, optionsNight(2)]
            .forEach((point) => expect(startedNote(point)).not.toMatch(/\d+ (older |earlier )?days?\b/));
    });
});

describe('chargeWords (#334)', () => {
    it('says since which morning the version in charge was, a weekly retrain\'s night as a nightly update\'s (#339)', () => {
        expect(chargeWords({ ...optionsNight(3), charge: '2026-10-24' })).toBe('since Sat Oct 24');
        expect(chargeWords({ ...optionsNight(2), charge: '2026-10-23' })).toBe('since Fri Oct 23');
    });

    it('says nothing on a model\'s first night, which had no version in charge, nor where the night doesn\'t say', () => {
        expect(chargeWords({ ...optionsNight(0), charge: '2026-10-21' })).toBe('');
        expect(chargeWords({ ...optionsNight(3), charge: null })).toBe('');
        expect(chargeWords({ ...optionsNight(3), charge: undefined })).toBe('');
    });
});

describe('tunedDays (#334)', () => {
    it('gives the days fine-tuning trained on, oldest first, and leaves the history\'s own as they were', () => {
        const days = { tuned: ['2026-10-22', '2026-10-06'] };

        expect(tunedDays(days)).toEqual(['2026-10-06', '2026-10-22']);
        expect(days.tuned).toEqual(['2026-10-22', '2026-10-06']);
    });

    it('gives none for a night that wasn\'t fine-tuned, or whose history doesn\'t say', () => {
        expect(tunedDays({ tuned: [] })).toEqual([]);
        expect(tunedDays({ studied: ['2026-10-06'] })).toEqual([]);
        expect(tunedDays({ tuned: '2026-10-06' })).toEqual([]);
        expect(tunedDays(null)).toEqual([]);
        expect(tunedDays(undefined)).toEqual([]);
    });
});

describe('TUNED (#334)', () => {
    it('names the days fine-tuning trained on, and says in plain words what fine-tuning is, by the trainer\'s numbers', () => {
        expect(TUNED.name).toBe('Fine-tuned on after the test');
        expect(TUNED.list).toBe('Fine-tuned on after the test');
        expect(TUNED.title).toBe('fine-tuned on after the test');
        expect(TUNED.note).toBe(TUNED_NOTE);
    });
});

describe('tookWords', () => {
    it('gives a night\'s whole time, its training and the scoring of its test days, and when it started, its day too (#327)', () => {
        expect(tookWords(optionsNight(3))).toBe('41 min 0 s in all: 39 min 13 s training, then 1 min 47 s scoring the test days. Started Tue Oct 27, 5:32 AM ET.');
    });

    it('counts the fine-tuning in all, and gives it among the parts by that name (#318, #324)', () => {
        expect(tookWords(gnnNewest())).toBe(
            '54 min 10 s in all: 41 min 36 s training, 1 min 37 s scoring the test days, then 10 min 58 s fine-tuning. Started Wed Oct 28, 4:43 AM ET.'
        );
    });

    it('leaves out when it started where the history does not say', () => {
        expect(tookWords({ ...optionsNight(3), started: null })).toBe('41 min 0 s in all: 39 min 13 s training, then 1 min 47 s scoring the test days.');
    });

    it('says a night from before the times were kept has none', () => {
        expect(tookWords(attemptPoints(timedHistoryOf(), 'loss')[0])).toBe('No times: they are kept from Oct 15, 2026 on.');
    });
});

describe('dayList', () => {
    it('names days of one month by the month once', () => {
        expect(dayList(['2026-10-20', '2026-10-21', '2026-10-22'])).toBe('Oct 20, 21 and 22');
        expect(dayList(['2026-10-20', '2026-10-21'])).toBe('Oct 20 and 21');
        expect(dayList(['2026-10-20'])).toBe('Oct 20');
    });

    it('names the month once for each month they fall in, where they cross one (#318)', () => {
        expect(dayList(['2026-09-30', '2026-10-01', '2026-10-02'])).toBe('Sep 30, and Oct 1 and 2');
        expect(dayList(['2026-10-07', '2026-10-22', '2026-11-04'])).toBe('Oct 7 and 22, and Nov 4');
    });

    it('names none for no days', () => {
        expect(dayList([])).toBe('');
    });
});

describe('NightPanel', () => {
    it('names the night by the morning its test ran and its kind, over the market day it was tested after', () => {
        const { container } = draw(optionsNight(3));

        expect(screen.getByRole('heading', { name: 'Tue Oct 27 · nightly update' })).toHaveClass('model-night-title');
        expect(container.querySelector('.model-night-sub')).toHaveTextContent(/^Tested after the market closed on Mon Oct 26\.$/);
        expect(screen.getByRole('region', { name: 'Tue Oct 27 · nightly update' })).toHaveClass('model-night-panel');
    });

    it('gives the new version\'s score, the version in charge\'s and the simple guess\'s, a box each, each named after its mark', () => {
        const { container } = draw(optionsNight(3));

        expect(boxesOf(container)).toEqual([['New version', '0.576'], ['Version in charge', '0.577'], ['Simple guess', '0.622']]);
        expect([...container.querySelectorAll('.model-night-box-name svg')].map((mark) => mark.getAttribute('data-mark')))
            .toEqual(['attempt', 'live', 'baseline']);
    });

    it('gives the scores on the score picked', () => {
        const { container } = draw(optionsNight(3, 'profit_auc'), 'profit_auc');

        expect(boxesOf(container)).toEqual([['New version', '0.733'], ['Version in charge', '0.733'], ['Simple guess', '0.626']]);
        expect(container.querySelector('.model-night-result')).toHaveTextContent('On loss it beat the simple guess by 0.046');
    });

    it('says a first version had no version in charge yet', () => {
        const { container } = draw(optionsNight(0));

        expect(boxesOf(container)[1]).toEqual(['Version in charge', 'none yet']);
        expect(screen.getByRole('heading', { name: 'Thu Oct 22 · first version' })).toBeInTheDocument();
    });

    it('says under the version in charge\'s score since which morning it was, in that box alone (#334, #339)', () => {
        const { container } = draw({ ...optionsNight(3), charge: '2026-10-24' });
        const since = container.querySelectorAll('.model-night-box-since');

        expect(since).toHaveLength(1);
        expect(since[0]).toHaveTextContent(/^since Sat Oct 24$/);
        expect(since[0].parentElement).toHaveClass('model-night-box-live');
        expect(since[0].previousElementSibling).toHaveClass('model-night-box-value');
        expect(boxesOf(container)[1]).toEqual(['Version in charge', '0.577']);
    });

    it('says no morning under the version in charge on a first night, nor where the night doesn\'t say (#334)', () => {
        const first = draw({ ...optionsNight(0), charge: '2026-10-21' });

        expect(first.container.querySelector('.model-night-box-since')).toBeNull();
        first.unmount();

        const unsaid = draw({ ...optionsNight(3), charge: null });

        expect(unsaid.container.querySelector('.model-night-box-since')).toBeNull();
    });

    it('says the night went live, in a pill, and then by how much it stood from each on loss, as one sentence to a screen reader (#339)', () => {
        const { container } = draw(optionsNight(3));
        const result = container.querySelector('.model-night-result');

        expect(result.querySelector('.model-night-pill-went')).toHaveTextContent(/^Went live$/);
        expect(result.querySelector('.visually-hidden')).toHaveTextContent(/^\.$/);
        expect(result).toHaveTextContent(/^Went live\. On loss it beat the simple guess by 0\.046 and the version in charge by 0\.001\.$/);
    });

    it('says a night was kept back in a pill of its own', () => {
        const { container } = draw(optionsNight(4));

        expect(container.querySelector('.model-night-pill-kept')).toHaveTextContent(/^Kept back$/);
        expect(container.querySelector('.model-night-pill-went')).toBeNull();
    });

    it('says nothing after the pill where the night has no gap to say', () => {
        const { container } = draw({ ...optionsNight(3), lossGaps: { guess: null, charge: null } });

        expect(container.querySelector('.model-night-result')).toHaveTextContent(/^Went live$/);
        expect(container.querySelector('.model-night-result .visually-hidden')).toBeNull();
    });

    it('draws a night from before format 11, which doesn\'t say what decided it, as before: no line under the pill (#339)', () => {
        const { container } = draw(liveNight('gnnNov4', null));

        expect(container.querySelector('.model-night-reason')).toBeNull();
        expect(container.querySelector('.model-night-result'))
            .toHaveTextContent(/^Went live\. On loss it beat the simple guess by 0\.003 and lost to the version in charge by 0\.003\.$/);
    });

    it('says under the pill what decided pt-gnn\'s Nov 4 night, and then its loss, the version in charge for comparison only (#339)', () => {
        const { container } = draw(liveNight('gnnNov4', 'ahead_of_baseline'));
        const result = container.querySelector('.model-night-result');
        const [pill, stop, reason] = result.children;

        expect(pill).toHaveClass('model-night-pill-went');
        expect(stop).toHaveClass('visually-hidden');
        expect(reason).toHaveClass('model-night-reason');
        expect(reason.textContent).toBe(REASONS.ahead_of_baseline);
        expect(result).toHaveTextContent(
            'Went live. Beat the simple guess on its 3 test days, which is all a new version needs. '
            + 'The version in charge is shown for comparison: it has usually trained on some of those days already. '
            + 'On loss it beat the simple guess by 0.003. The version in charge, shown for comparison only, did 0.003 better.',
        );
        expect(result.lastChild.textContent).toBe(' On loss it beat the simple guess by 0.003. The version in charge, shown for comparison only, did 0.003 better.');
    });

    it.each([
        ['pt-gnn\'s Nov 3 night, which went live by beating the simple guess', () => liveNight('gnnNov3', 'ahead_of_baseline'), 'went', 'Went live', 'ahead_of_baseline'],
        ['pt-gnn\'s Nov 6 retrain, kept back behind the simple guess', () => liveNight('gnnNov6', 'behind_baseline'), 'kept', 'Kept back', 'behind_baseline'],
        ['tables-gnn\'s Oct 20 night, kept back by the rule used until Oct 26', () => liveNight('tablesOct20', 'behind_live'), 'kept', 'Kept back', 'behind_live'],
        ['pt-gnn\'s Oct 23 retrain, which went live by the rule used until Oct 26', () => gnnNight(10, 'ahead_of_live'), 'went', 'Went live', 'ahead_of_live'],
        ['pt-gnn\'s first version, Oct 9, which went live under an older rule', () => gnnNight(0, 'first'), 'went', 'Went live', 'first'],
    ])('says what decided %s, under its pill (#339)', (name, night, look, pill, reason) => {
        const { container } = draw(night());

        expect(container.querySelector(`.model-night-pill-${look}`)).toHaveTextContent(new RegExp(`^${pill}$`));
        expect(container.querySelector('.model-night-reason').textContent).toBe(REASONS[reason]);
    });

    it('says beside pt-gnn\'s Oct 23 retrain, which the version in charge decided, that it tied the simple guess (#339)', () => {
        const { container } = draw(gnnNight(10, 'ahead_of_live'));

        expect(container.querySelector('.model-night-result')).toHaveTextContent(
            'Went live. Decided by the rule used until Oct 26: a new version had to beat the version in charge, not the simple guess. '
            + 'On loss it tied the simple guess and beat the version in charge by 0.007.',
        );
    });

    it('says a night that gave every stock the same answer was kept back, though it beat the simple guess (#339)', () => {
        const { container } = draw({ ...liveNight('gnnNov4', 'same_for_every_stock'), went_live: false });

        expect(container.querySelector('.model-night-pill-kept')).toHaveTextContent(/^Kept back$/);
        expect(container.querySelector('.model-night-result')).toHaveTextContent(
            'Kept back. Gave every stock the same answer, so it wasn’t really predicting, even though it beat the simple guess. '
            + 'On loss it beat the simple guess by 0.003. The version in charge, shown for comparison only, did 0.003 better.',
        );
    });

    it('says what decided a night under its pill even where it has no gap to say (#339)', () => {
        const { container } = draw({ ...liveNight('gnnNov4', 'ahead_of_baseline'), lossGaps: { guess: null, charge: null } });

        expect(container.querySelector('.model-night-result')).toHaveTextContent(`Went live. ${REASONS.ahead_of_baseline}`);
        expect(container.querySelector('.model-night-result').lastChild).toHaveClass('model-night-reason');
    });

    it('says no "took over" anywhere in the panel (#339)', () => {
        [optionsNight(3), optionsNight(4), gnnNewest(), { ...optionsNight(3), charge: '2026-10-24', fromTuned: true }, gnnNight(10, 'ahead_of_live')]
            .forEach((point) => {
                const { container, unmount } = draw(point);

                expect(container.textContent).not.toMatch(/took over|take over|taking over/i);
                container.querySelectorAll('[aria-label]').forEach((each) => expect(each.getAttribute('aria-label')).not.toMatch(/took over/i));
                unmount();
            });
    });

    it('says where the new version started, and how long it took', () => {
        const { container } = draw(optionsNight(3));
        const lines = [...container.querySelectorAll('.model-night-line')].map((line) => line.textContent);

        expect(lines).toEqual([
            'Started from the Sat Oct 24 version.',
            'How long it took: 41 min 0 s in all: 39 min 13 s training, then 1 min 47 s scoring the test days. Started Tue Oct 27, 5:32 AM ET.',
        ]);
        expect(container.querySelector('.model-night-line-name')).toHaveTextContent(/^How long it took:$/);
    });

    it('leaves out where it started for a nightly update with no version before it', () => {
        const { container } = draw({ ...optionsNight(3), from: null });

        expect([...container.querySelectorAll('.model-night-line')]).toHaveLength(1);
        expect(container.querySelector('.model-night-from')).toBeNull();
        expect(container.querySelector('.model-night-line .model-noted')).toBeNull();
    });

    it('puts an info icon after where a nightly update started, its note saying it kept training that version (#336)', () => {
        const { container } = draw(optionsNight(3));
        const line = container.querySelector('.model-night-from');
        const noted = line.querySelector('.model-noted');

        expect(line).toHaveClass('model-night-line');
        expect(line.children).toHaveLength(1);
        expect(noted).toHaveTextContent(/^Started from the Sat Oct 24 version\.$/);
        expect(noted).toHaveAccessibleDescription('It began with the weights of the Sat Oct 24 version, and kept training them.');
        expect(noted).toHaveAttribute('tabindex', '0');
        expect(noted.querySelector('svg')).toHaveAttribute('data-testid', 'InfoOutlinedIcon');
    });

    it('puts an info icon after "Built from scratch." on a weekly retrain and a first version, its note saying it started with new weights (#336)', () => {
        [optionsNight(2), optionsNight(0)].forEach((point) => {
            const { container, unmount } = draw(point);
            const noted = container.querySelector('.model-night-from .model-noted');

            expect(noted).toHaveTextContent(/^Built from scratch\.$/);
            expect(noted).toHaveAccessibleDescription(SCRATCH_NOTE);
            expect(noted.querySelector('svg')).toHaveAttribute('data-testid', 'InfoOutlinedIcon');
            unmount();
        });
    });

    it('says in the note of an update that began from a fine-tuned version that it began from before the fine-tune (#336)', () => {
        const { container } = draw({ ...optionsNight(4), fromTuned: true });

        expect(container.querySelector('.model-night-from .model-noted')).toHaveAccessibleDescription(
            'It began with the weights of the Tue Oct 27 version, from before its fine-tune, and kept training them.',
        );
    });

    it('gives pt-gnn\'s Oct 27 night\'s whole time, its fine-tuning among its parts (#318, #324)', () => {
        const { container } = draw(gnnNewest());

        expect(container.querySelectorAll('.model-night-line')[1]).toHaveTextContent(
            'How long it took: 54 min 10 s in all: 41 min 36 s training, 1 min 37 s scoring the test days, then 10 min 58 s fine-tuning. Started Wed Oct 28, 4:43 AM ET.'
        );
    });

    it('shows its test days as a strip under their month, keyed, and beside it how many earlier days it trained or validated on (#334)', () => {
        const { container } = draw(optionsNight(3));
        const days = container.querySelector('.model-night-days');
        const strip = days.querySelector('.model-day-strip');
        const key = days.querySelector('.model-day-legend');
        const lists = days.querySelector('.model-day-lists');

        expect(within(days).getByRole('heading', { name: 'Which days it used' })).toBeInTheDocument();
        expect(strip).toHaveAttribute('aria-hidden', 'true');
        expect([...strip.children].map((each) => each.textContent)).toEqual(['Oct', '20', '21', '22']);
        expect([...strip.querySelectorAll('.model-day')].map((day) => day.getAttribute('title')))
            .toEqual(['Oct 20: test, never trained on', 'Oct 21: test, never trained on', 'Oct 22: test, never trained on']);
        strip.querySelectorAll('.model-day')
            .forEach((day) => expect(day.className).toBe('model-day model-day-test'));
        expect(key).toHaveTextContent(/^Test, never trained on$/);
        expect(key).not.toHaveAttribute('aria-hidden');
        expect(key.querySelector('.model-day-swatch')).toHaveAttribute('aria-hidden', 'true');
        expect([...lists.querySelectorAll('dt')].map((name) => name.textContent)).toEqual(['Training and validation', 'Test']);
        expect([...lists.querySelectorAll('dd')].map((value) => value.textContent)).toEqual(['10 earlier days', 'Oct 20, 21 and 22']);
    });

    it('keeps the count of earlier days on the screen, which no strip shows, and gives the test days in words to a screen reader alone (#334)', () => {
        const { container } = draw(optionsNight(3));
        const lists = container.querySelector('.model-day-lists');
        const [count, test] = lists.children;

        expect(lists).not.toHaveClass('visually-hidden');
        expect(count).not.toHaveClass('visually-hidden');
        expect(test).toHaveClass('visually-hidden');
        expect(test).toHaveTextContent(/^TestOct 20, 21 and 22$/);
    });

    it('names a month again where the test days cross into the next', () => {
        const { container } = draw({ ...optionsNight(3), test: ['2026-09-30', '2026-10-01', '2026-10-02'] });

        expect([...container.querySelector('.model-day-strip').children].map((each) => each.textContent)).toEqual(['Sep', '30', 'Oct', '1', '2']);
        expect(container.querySelectorAll('.model-day-lists dd')[1]).toHaveTextContent(/^Sep 30, and Oct 1 and 2$/);
    });

    it('counts one earlier day as a day', () => {
        const { container } = draw({ ...optionsNight(3), studied: 1 });

        expect(container.querySelector('.model-day-lists dd')).toHaveTextContent(/^1 earlier day$/);
    });

    it('gives the count alone where the history lists no test days, and the test days alone where it gives no count', () => {
        const counted = draw({ ...optionsNight(3), test: [] });

        expect(counted.container.querySelector('.model-day-strip')).toBeNull();
        expect(counted.container.querySelector('.model-day-legend')).toBeNull();
        expect([...counted.container.querySelectorAll('.model-day-lists dt')].map((name) => name.textContent)).toEqual(['Training and validation']);
        expect(counted.container.querySelector('.model-day-lists')).not.toHaveClass('visually-hidden');
        counted.unmount();

        const listed = draw({ ...optionsNight(3), studied: null });

        expect([...listed.container.querySelectorAll('.model-day-lists dt')].map((name) => name.textContent)).toEqual(['Test']);
        expect(listed.container.querySelector('.model-day-lists')).toHaveClass('visually-hidden');
    });

    it('leaves out which days it used where the history says neither', () => {
        const [older] = attemptPoints(historyOf(1, { 0: { held_out_days: undefined, training_days: undefined } }), 'loss');
        const { container } = draw(older);

        expect(container.querySelector('.model-night-days')).toBeNull();
        expect(screen.queryByText('Which days it used')).toBeNull();
    });
});

describe('daysDrawn (#318)', () => {
    it('gives each kind of day a night\'s history lists, its test days among them, in the key\'s order, and only those it has', () => {
        const drawn = daysDrawn(['2026-10-20', '2026-10-21', '2026-10-22'], listedNight(OCT_26).days);

        expect(drawn.map((kind) => [kind.key, kind.days.length])).toEqual([['studied', 7], ['stopping', 3], ['test', 3], ['skipped', 1], ['pending', 2]]);
    });

    it('sorts each kind\'s days, oldest first, and leaves the history\'s own as they were', () => {
        const days = { studied: ['2026-10-09', '2026-10-06'], stopping: [], skipped: [], pending: [], unpicked: [] };

        expect(daysDrawn([], days)[0].days).toEqual(['2026-10-06', '2026-10-09']);
        expect(days.studied).toEqual(['2026-10-09', '2026-10-06']);
    });

    it('gives none until the history lists the days a night trained on, as one from before format 8 doesn\'t', () => {
        expect(daysDrawn(['2026-10-20'], { studied: [], stopping: ['2026-10-05'], skipped: [], pending: [], unpicked: [] })).toBeNull();
        expect(daysDrawn(['2026-10-20'], null)).toBeNull();
        expect(daysDrawn(['2026-10-20'], {})).toBeNull();
    });

    it('takes a kind the history has no list of as none', () => {
        expect(daysDrawn([], { studied: ['2026-10-06'] }).map((kind) => kind.key)).toEqual(['studied']);
    });
});

describe('NightPanel\'s full strip, once the history lists the days (#318)', () => {
    it('draws every day in the look of its kind, oldest first, after its month\'s name, each titled with what it was', () => {
        const { container } = draw(listedNight(OCT_26));
        const strip = container.querySelector('.model-day-strip');

        expect(strip).toHaveClass('model-day-rows');
        expect(strip).toHaveAttribute('aria-hidden', 'true');
        expect(stripOf(container)).toEqual([{
            month: 'Oct',
            days: [
                ['5', 'model-day-stopping'], ['6', 'model-day-studied'], ['7', 'model-day-stopping'], ['8', 'model-day-studied'],
                ['9', 'model-day-studied'], ['12', 'model-day-studied'], ['13', 'model-day-studied'], ['14', 'model-day-studied'],
                ['15', 'model-day-stopping'], ['16', 'model-day-skipped'], ['19', 'model-day-studied'], ['20', 'model-day-test'],
                ['21', 'model-day-test'], ['22', 'model-day-test'], ['23', 'model-day-pending'], ['26', 'model-day-pending'],
            ],
        }]);
        expect([...strip.querySelectorAll('.model-day')].slice(0, 2).map((day) => day.getAttribute('title')))
            .toEqual(['Oct 5: validation, never trained on', 'Oct 6: trained on']);
        expect(strip.querySelector('.model-day-test')).toHaveAttribute('title', 'Oct 20: test, never trained on');
        expect(strip.querySelector('.model-day-skipped')).toHaveAttribute('title', 'Oct 16: skipped, incomplete data');
        expect(strip.querySelector('.model-day-pending')).toHaveAttribute('title', 'Oct 23: results not in yet');
        expect(strip.querySelector('.model-day-tuned')).toBeNull();
    });

    it('keys only the kinds it draws, by training, validation and test, each after a swatch of its look the key hides from a screen reader (#334)', () => {
        const { container } = draw(listedNight(OCT_26));
        const legend = container.querySelector('.model-day-legend');
        const key = [...legend.querySelectorAll('li')];

        expect(key.map((item) => item.textContent)).toEqual([
            'Trained on', 'Validation, never trained on', 'Test, never trained on', 'Skipped, incomplete data', 'Results not in yet',
        ]);
        expect(key.map((item) => item.querySelector('.model-day-swatch').className.replace('model-day-swatch ', ''))).toEqual([
            'model-day-studied', 'model-day-stopping', 'model-day-test', 'model-day-skipped', 'model-day-pending',
        ]);
        expect(legend).not.toHaveAttribute('aria-hidden');
        key.forEach((item) => expect(item.querySelector('.model-day-swatch')).toHaveAttribute('aria-hidden', 'true'));
        expect(screen.queryByText('Training and validation')).toBeNull();
        expect(screen.queryByText('Not picked this night')).toBeNull();
    });

    it('says each kind\'s days in words to a screen reader alone, as the strip and its key say them on the screen (#334)', () => {
        const { container } = draw(listedNight(OCT_26));
        const lists = container.querySelector('.model-day-lists');

        expect(lists).toHaveClass('visually-hidden');
        expect([...lists.querySelectorAll('dt')].map((name) => name.textContent))
            .toEqual(['Trained on', 'Validation', 'Test', 'Skipped', 'Results not in yet']);
        expect([...lists.querySelectorAll('dd')].map((value) => value.textContent))
            .toEqual(['Oct 6, 8, 9, 12, 13, 14 and 19', 'Oct 5, 7 and 15', 'Oct 20, 21 and 22', 'Oct 16', 'Oct 23 and 26']);
        expect(lists.querySelector('.model-noted')).toBeNull();
    });

    it('notes in the key, after the validation days\' name, how they decide when training stops, and on no other kind (#324, #334)', () => {
        const { container } = draw(listedNight(OCT_26));
        const noted = [...container.querySelectorAll('.model-day-legend .model-noted')];

        expect(noted).toHaveLength(1);
        expect(noted[0]).toHaveTextContent(/^Validation, never trained on$/);
        expect(noted[0].parentElement.querySelector('.model-day-stopping')).toBeInTheDocument();
        expect(noted[0]).toHaveAccessibleDescription(
            'The model never trains on these days. After each epoch it’s scored on them, and training stops once that score stops getting better. '
            + 'It keeps the epoch that scored best.',
        );
        expect(noted[0].querySelector('svg')).toHaveAttribute('data-testid', 'InfoOutlinedIcon');
    });

    it('marks each day fine-tuning trained on by its box\'s corner, each keeping its kind\'s look, and says so in its title (#334)', () => {
        const { container } = draw(withTuned(listedNight(OCT_26)));
        const tuned = [...container.querySelectorAll('.model-day-row .model-day-tuned')];

        expect(tuned.map((day) => [day.textContent, day.className])).toEqual([
            ['6', 'model-day model-day-studied model-day-tuned'],
            ['9', 'model-day model-day-studied model-day-tuned'],
            ['13', 'model-day model-day-studied model-day-tuned'],
            ['20', 'model-day model-day-test model-day-tuned'],
            ['21', 'model-day model-day-test model-day-tuned'],
            ['22', 'model-day model-day-test model-day-tuned'],
        ]);
        expect(tuned[0]).toHaveAttribute('title', 'Oct 6: trained on; fine-tuned on after the test');
        expect(tuned[3]).toHaveAttribute('title', 'Oct 20: test, never trained on; fine-tuned on after the test');
        expect(container.querySelector('.model-day[title^="Oct 8"]')).toHaveAttribute('title', 'Oct 8: trained on');
        expect(container.querySelectorAll('.model-day-row .model-day')).toHaveLength(16);
    });

    it('keys the days fine-tuning trained on last, after a swatch with the corner, and notes what fine-tuning is (#334)', () => {
        const { container } = draw(withTuned(listedNight(OCT_26)));
        const last = container.querySelector('.model-day-legend li:last-child');
        const noted = last.querySelector('.model-noted');

        expect(last).toHaveTextContent(/^Fine-tuned on after the test$/);
        expect(last.querySelector('.model-day-swatch')).toHaveClass('model-day-swatch-tuned');
        expect(last.querySelector('.model-day-swatch')).toHaveAttribute('aria-hidden', 'true');
        expect(noted).toHaveAccessibleDescription(TUNED_NOTE);
        expect(container.querySelectorAll('.model-day-legend .model-noted')).toHaveLength(2);
    });

    it('says the days fine-tuning trained on in words to a screen reader, last, oldest first (#334)', () => {
        const { container } = draw(withTuned(listedNight(OCT_26)));
        const line = container.querySelector('.model-day-lists').lastChild;

        expect(line.querySelector('dt')).toHaveTextContent(/^Fine-tuned on after the test$/);
        expect(line.querySelector('dd')).toHaveTextContent(/^Oct 6, 9, 13, 20, 21 and 22$/);
    });

    it('neither marks nor keys fine-tuning on a night that wasn\'t fine-tuned (#334)', () => {
        const { container } = draw(withTuned(listedNight(OCT_26), []));

        expect(container.querySelector('.model-day-tuned')).toBeNull();
        expect(container.querySelector('.model-day-swatch-tuned')).toBeNull();
        expect(screen.queryByText('Fine-tuned on after the test')).toBeNull();
    });

    it('draws a row for each month, and the days the night didn\'t pick, outlined, keyed and in words', () => {
        const { container } = draw(listedNight(NOV_23, 4));
        const strip = stripOf(container);
        const unpicked = container.querySelectorAll('.model-day-unpicked:not(.model-day-swatch)');
        const lists = [...container.querySelectorAll('.model-day-lists > div')].map((line) => [line.firstChild.textContent, line.lastChild.textContent]);

        expect(strip.map((row) => row.month)).toEqual(['Oct', 'Nov']);
        expect(strip.map((row) => row.days.length)).toEqual([20, 16]);
        expect([...unpicked].map((day) => day.textContent)).toEqual(['6', '9', '14', '20', '27', '29', '3', '10']);
        expect(unpicked[0]).toHaveAttribute('title', 'Oct 6: not picked this night');
        expect(container.querySelector('.model-day-legend li:last-child')).toHaveTextContent(/^Not picked this night$/);
        expect(lists).toEqual([
            ['Trained on', 'Oct 5, 8, 12, 13, 15, 19, 21, 23, 26, 28 and 30, and Nov 2, 5, 6, 9, 11, 12, 13 and 16'],
            ['Validation', 'Oct 7 and 22, and Nov 4'],
            ['Test', 'Nov 17, 18 and 19'],
            ['Skipped', 'Oct 16'],
            ['Results not in yet', 'Nov 20 and 23'],
            ['Not picked this night', 'Oct 6, 9, 14, 20, 27 and 29, and Nov 3 and 10'],
        ]);
    });

    it('draws a day the history lists twice once, as the first of its kinds', () => {
        const { container } = draw(listedNight({ ...OCT_26, unpicked_days: ['2026-10-06'] }));

        expect(container.querySelectorAll('.model-day-row .model-day')).toHaveLength(16);
        expect(container.querySelector('.model-day[title^="Oct 6"]')).toHaveClass('model-day-studied');
        expect(container.querySelector('.model-day-lists').lastChild).toHaveTextContent(/^Not picked this nightOct 6$/);
    });

    it('keeps the test days and the count for a night handed in with no lists at all', () => {
        const { days, ...bare } = optionsNight(3);
        const { container } = draw(bare);

        expect(days.studied).toEqual([]);
        expect([...container.querySelectorAll('.model-day-lists dt')].map((name) => name.textContent)).toEqual(['Training and validation', 'Test']);
    });

    it('keeps the test days and the count until the history lists the days the night trained on, and marks none fine-tuned there', () => {
        const { container } = draw(withTuned(listedNight({ ...OCT_26, studied_days: [] })));

        expect(container.querySelector('.model-day-rows')).toBeNull();
        expect([...container.querySelector('.model-day-strip').children].map((each) => each.textContent)).toEqual(['Oct', '20', '21', '22']);
        expect([...container.querySelectorAll('.model-day-lists dt')].map((name) => name.textContent)).toEqual(['Training and validation', 'Test']);
        expect(container.querySelector('.model-day-tuned')).toBeNull();
        expect(screen.queryByText('Fine-tuned on after the test')).toBeNull();
    });
});
