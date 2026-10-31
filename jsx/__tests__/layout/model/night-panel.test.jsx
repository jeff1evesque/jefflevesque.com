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

import NightPanel, { dayList, daysDrawn, kindWords, resultWords, startedFrom, tookWords } from '../../../import/layout/model/night-panel.jsx';
import { attemptPoints } from '../../../import/layout/model/attempts-chart.jsx';
import { historyOf, ptGnnHistory, ptOptionsHistory, timedHistoryOf } from '../../../test-support/model-fixtures.js';

//
// pt-options' nights on `score`: its first version, Oct 21, its Oct 26 night,
// which took over, and its Oct 27 night, kept back behind the simple guess
//
function optionsNight(at, score = 'loss') {
    return attemptPoints(ptOptionsHistory(), score)[at];
}

//
// pt-gnn's Oct 27 night, which trained again after its test, and took over
//
function gnnNewest() {
    const points = attemptPoints(ptGnnHistory(), 'loss');

    return points[points.length - 1];
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
};

function listedNight(lists, at = 3) {
    const rows = ptOptionsHistory();

    rows[at] = { ...rows[at], ...lists };

    return attemptPoints(rows, 'loss')[at];
}

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
});

describe('startedFrom', () => {
    it('says a nightly update started from the version that took over before it, by the morning it did', () => {
        expect(startedFrom(optionsNight(3))).toBe('Started from the version that took over Sat Oct 24.');
        expect(startedFrom(optionsNight(4))).toBe('Started from the version that took over Tue Oct 27.');
    });

    it('says a weekly retrain and a first version were built from scratch', () => {
        expect(startedFrom(optionsNight(2))).toBe('Built from scratch.');
        expect(startedFrom(optionsNight(0))).toBe('Built from scratch.');
    });

    it('says nothing for a nightly update with no version before it', () => {
        expect(startedFrom({ ...optionsNight(3), from: null })).toBe('');
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

    it('says the night took over, in a pill, and then by how much it stood from each on loss, as one sentence to a screen reader', () => {
        const { container } = draw(optionsNight(3));
        const result = container.querySelector('.model-night-result');

        expect(result.querySelector('.model-night-pill-took')).toHaveTextContent(/^Took over$/);
        expect(result.querySelector('.visually-hidden')).toHaveTextContent(/^\.$/);
        expect(result).toHaveTextContent(/^Took over\. On loss it beat the simple guess by 0\.046 and the version in charge by 0\.001\.$/);
    });

    it('says a night was kept back in a pill of its own', () => {
        const { container } = draw(optionsNight(4));

        expect(container.querySelector('.model-night-pill-kept')).toHaveTextContent(/^Kept back$/);
        expect(container.querySelector('.model-night-pill-took')).toBeNull();
    });

    it('says nothing after the pill where the night has no gap to say', () => {
        const { container } = draw({ ...optionsNight(3), lossGaps: { guess: null, charge: null } });

        expect(container.querySelector('.model-night-result')).toHaveTextContent(/^Took over$/);
    });

    it('says where the new version started, and how long it took', () => {
        const { container } = draw(optionsNight(3));
        const lines = [...container.querySelectorAll('.model-night-line')].map((line) => line.textContent);

        expect(lines).toEqual([
            'Started from the version that took over Sat Oct 24.',
            'How long it took: 41 min 0 s in all: 39 min 13 s training, then 1 min 47 s scoring the test days. Started Tue Oct 27, 5:32 AM ET.',
        ]);
        expect(container.querySelector('.model-night-line-name')).toHaveTextContent(/^How long it took:$/);
    });

    it('leaves out where it started for a nightly update with no version before it', () => {
        const { container } = draw({ ...optionsNight(3), from: null });

        expect([...container.querySelectorAll('.model-night-line')]).toHaveLength(1);
    });

    it('gives pt-gnn\'s Oct 27 night\'s whole time, its fine-tuning among its parts (#318, #324)', () => {
        const { container } = draw(gnnNewest());

        expect(container.querySelectorAll('.model-night-line')[1]).toHaveTextContent(
            'How long it took: 54 min 10 s in all: 41 min 36 s training, 1 min 37 s scoring the test days, then 10 min 58 s fine-tuning. Started Wed Oct 28, 4:43 AM ET.'
        );
    });

    it('shows its test days as a strip under their month, keyed, and in words beside how many earlier days it studied or used to stop', () => {
        const { container } = draw(optionsNight(3));
        const days = container.querySelector('.model-night-days');
        const strip = days.querySelector('.model-day-strip');
        const lists = days.querySelector('.model-day-lists');

        expect(within(days).getByRole('heading', { name: 'Which days it used' })).toBeInTheDocument();
        expect(strip).toHaveAttribute('aria-hidden', 'true');
        expect([...strip.children].map((each) => each.textContent)).toEqual(['Oct', '20', '21', '22']);
        expect([...strip.querySelectorAll('.model-day')].map((day) => day.getAttribute('title')))
            .toEqual(['Oct 20: test, never studied', 'Oct 21: test, never studied', 'Oct 22: test, never studied']);
        strip.querySelectorAll('.model-day').forEach((day) => expect(day).toHaveClass('model-day-test'));
        expect(days.querySelector('.model-day-legend')).toHaveTextContent(/^Test, never studied$/);
        expect([...lists.querySelectorAll('dt')].map((name) => name.textContent)).toEqual(['Studied or used to stop', 'Test']);
        expect([...lists.querySelectorAll('dd')].map((value) => value.textContent)).toEqual(['10 earlier days', 'Oct 20, 21 and 22']);
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
        expect([...counted.container.querySelectorAll('.model-day-lists dt')].map((name) => name.textContent)).toEqual(['Studied or used to stop']);
        counted.unmount();

        const listed = draw({ ...optionsNight(3), studied: null });

        expect([...listed.container.querySelectorAll('.model-day-lists dt')].map((name) => name.textContent)).toEqual(['Test']);
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

    it('gives none until the history lists the days a night studied, as the trainer doesn\'t yet', () => {
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
            .toEqual(['Oct 5: used to decide when to stop', 'Oct 6: studied']);
        expect(strip.querySelector('.model-day-skipped')).toHaveAttribute('title', 'Oct 16: skipped, incomplete data');
        expect(strip.querySelector('.model-day-pending')).toHaveAttribute('title', 'Oct 23: results not in yet');
    });

    it('keys only the kinds it draws, each after a swatch of its look, and says each in words in place of the count', () => {
        const { container } = draw(listedNight(OCT_26));
        const key = [...container.querySelectorAll('.model-day-legend li')];
        const lists = container.querySelector('.model-day-lists');

        expect(key.map((item) => item.textContent)).toEqual([
            'Studied', 'Used to decide when to stop', 'Test, never studied', 'Skipped, incomplete data', 'Results not in yet',
        ]);
        expect(key.map((item) => item.querySelector('.model-day-swatch').className.replace('model-day-swatch ', ''))).toEqual([
            'model-day-studied', 'model-day-stopping', 'model-day-test', 'model-day-skipped', 'model-day-pending',
        ]);
        expect([...lists.querySelectorAll('dt')].map((name) => name.textContent))
            .toEqual(['Studied', 'Used to decide when to stop', 'Test', 'Skipped', 'Results not in yet']);
        expect([...lists.querySelectorAll('dd')].map((value) => value.textContent))
            .toEqual(['Oct 6, 8, 9, 12, 13, 14 and 19', 'Oct 5, 7 and 15', 'Oct 20, 21 and 22', 'Oct 16', 'Oct 23 and 26']);
        expect(screen.queryByText('Studied or used to stop')).toBeNull();
        expect(screen.queryByText('Not picked this night')).toBeNull();
    });

    it('notes on the line of the days used to decide when to stop how they decide it, and on no other line nor in the key (#324)', () => {
        const { container } = draw(listedNight(OCT_26));
        const names = [...container.querySelectorAll('.model-day-lists dt')];
        const noted = names[1].querySelector('.model-noted');

        expect(noted).toHaveTextContent(/^Used to decide when to stop$/);
        expect(noted).toHaveAccessibleDescription(
            'The model never trains on these days. After each epoch it’s scored on them, and training stops once that score stops getting better. '
            + 'It keeps the epoch that scored best.',
        );
        expect(noted.querySelector('svg')).toHaveAttribute('data-testid', 'InfoOutlinedIcon');
        expect(container.querySelectorAll('.model-day-lists .model-noted')).toHaveLength(1);
        expect(container.querySelector('.model-day-legend .model-noted')).toBeNull();
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
            ['Studied', 'Oct 5, 8, 12, 13, 15, 19, 21, 23, 26, 28 and 30, and Nov 2, 5, 6, 9, 11, 12, 13 and 16'],
            ['Used to decide when to stop', 'Oct 7 and 22, and Nov 4'],
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
        expect([...container.querySelectorAll('.model-day-lists dt')].map((name) => name.textContent)).toEqual(['Studied or used to stop', 'Test']);
    });

    it('keeps the test days and the count until the history lists the days the night studied', () => {
        const { container } = draw(listedNight({ ...OCT_26, studied_days: [] }));

        expect(container.querySelector('.model-day-rows')).toBeNull();
        expect([...container.querySelector('.model-day-strip').children].map((each) => each.textContent)).toEqual(['Oct', '20', '21', '22']);
        expect([...container.querySelectorAll('.model-day-lists dt')].map((name) => name.textContent)).toEqual(['Studied or used to stop', 'Test']);
    });
});
