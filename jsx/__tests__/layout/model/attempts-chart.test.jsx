/**
 * attempts-chart.test.jsx: each nightly attempt against the live version, on a
 * model's page (#243).
 *
 * Note: recharts is drawn for real, in a container given a size -- see
 *       sizedRecharts in test-support/model-fixtures.js -- so the marks, the
 *       bars and the flipped axis are read off the svg it draws.
 */

jest.mock('recharts', () => require('../../../test-support/model-fixtures.js').sizedRecharts());

import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import AttemptsChart, { AttemptMark, attemptKind, attemptPoints, durationUnit, outcome } from '../../../import/layout/model/attempts-chart.jsx';
import { ThemeModeContext } from '../../../import/general/theme-mode.jsx';
import { chartColors } from '../../../import/layout/model/scores.js';
import { historyOf, phoneScreen, pointAt as pointAtChart, tapAt, timedHistoryOf, wideScreen } from '../../../test-support/model-fixtures.js';

//
// the attempts' chart, the bars of better or worse under it, and how long each
// attempt took
//
const ATTEMPTS = '.model-chart:not(.model-chart-gap):not(.model-chart-took)';
const GAP = '.model-chart-gap';
const TOOK = '.model-chart-took';

function draw(props, theme = 'light') {
    return render(
        <ThemeModeContext.Provider value={{ theme: theme }}>
            <AttemptsChart rows={historyOf()} score='loss' {...props} />
        </ThemeModeContext.Provider>
    );
}

//
// the y of each tick on the attempts' axis, top to bottom, with its value
//
function yTicks(container) {
    return [...container.querySelectorAll(`.model-attempts ${ATTEMPTS} .recharts-yAxis .recharts-cartesian-axis-tick`)]
        .map((tick) => ({
            y: Number(tick.querySelector('line, text').getAttribute('y')),
            value: Number(tick.textContent),
        }));
}

//
// the labels on the axis of how long each attempt took, but its 0
//
function tookTicks(container) {
    return [...container.querySelectorAll(`${TOOK} .recharts-yAxis .recharts-cartesian-axis-tick`)]
        .map((tick) => tick.textContent)
        .filter((text) => text !== '0');
}

//
// point at the attempts' chart, or one of the charts under it, at `x`. On the
// 600px a chart is drawn at here, x 110 is the first of five nights and 430 the
// fourth -- Oct 15 in timedHistoryOf, the first night with times
//
function pointAt(container, x, which = ATTEMPTS) {
    pointAtChart(container.querySelector(`${which} .recharts-wrapper`), x);
}

describe('attemptPoints', () => {
    it('signs each night\'s difference so that better is positive, whichever way the score runs', () => {
        const rows = historyOf(2, {
            0: { attempt: { loss: 1.5, auc_up: 0.6, auc_beats: 0.5, acc_up: 0.5 }, live: { loss: 1.6, auc_up: 0.5, auc_beats: 0.5, acc_up: 0.5 } },
        });

        expect(attemptPoints(rows, 'loss')[0].gap).toBeCloseTo(0.1);
        expect(attemptPoints(rows, 'auc_up')[0].gap).toBeCloseTo(0.1);
        expect(attemptPoints(rows, 'loss')[1].gap).toBeLessThan(0);
    });

    it('has no difference for a night with no score', () => {
        const rows = historyOf(1, { 0: { attempt: { loss: null, auc_up: null, auc_beats: null, acc_up: null } } });

        expect(attemptPoints(rows, 'loss')[0]).toMatchObject({ attempt: null, gap: null });
    });

    it('splits a night with times into its training and the scoring after it, in seconds (#247)', () => {
        const points = attemptPoints(timedHistoryOf(), 'loss');

        expect(points[3]).toMatchObject({ day: '2026-10-15', started: '2026-10-16T07:58:10+00:00', training: 437.2 });
        expect(points[3].scoring).toBeCloseTo(95.2);
        expect(points[4].training + points[4].scoring).toBeCloseTo(592.4);
    });

    it('has neither for a night without times, one with only one of them, or a total under its training', () => {
        const points = attemptPoints(timedHistoryOf({ 3: { total_seconds: 400 }, 4: { training_seconds: null } }), 'loss');

        points.forEach((point) => {
            expect(point).toMatchObject({ training: null, scoring: null });
        });
        expect(points[0].started).toBeNull();
    });

    it('has neither for a night from a history read before the times were kept', () => {
        const [{ started, training_seconds, total_seconds, ...older }] = historyOf(1);

        expect(attemptPoints([older], 'loss')[0]).toMatchObject({ started: null, training: null, scoring: null });
    });
});

describe('durationUnit', () => {
    //
    // the nights of a history whose one night took `seconds`
    //
    function took(seconds) {
        return attemptPoints(historyOf(1, { 0: { training_seconds: seconds * 0.8, total_seconds: seconds } }), 'loss');
    }

    it('is seconds up to two minutes, minutes up to two hours, and hours once the longest night passes them (#251)', () => {
        expect(durationUnit(took(2.6))).toEqual({ seconds: 1, label: 's' });
        expect(durationUnit(took(120))).toEqual({ seconds: 1, label: 's' });
        expect(durationUnit(took(120.1))).toEqual({ seconds: 60, label: 'min' });
        expect(durationUnit(took(7200))).toEqual({ seconds: 60, label: 'min' });
        expect(durationUnit(took(7200.1))).toEqual({ seconds: 3600, label: 'h' });
    });

    it('is seconds for nights without times', () => {
        expect(durationUnit(attemptPoints(historyOf(), 'loss'))).toEqual({ seconds: 1, label: 's' });
    });
});

describe('outcome (#251)', () => {
    it('says what came of an attempt, and why, by loss', () => {
        expect(outcome({ went_live: true, live: 1.6 })).toBe('Went live: its loss was no higher than the live version’s');
        expect(outcome({ went_live: false, live: 1.6 })).toBe('Kept back: its loss was higher than the live version’s');
        expect(outcome({ went_live: true, live: null })).toBe('Went live: the model’s first version');
    });
});

describe('attemptKind (#251)', () => {
    it.each([
        ['nightly', true, 'dot'],
        ['nightly', false, 'ring'],
        ['weekly', true, 'diamond'],
        ['weekly', false, 'hollow'],
    ])('draws a %s attempt that went live: %s, as a %s', (kind, went, mark) => {
        expect(attemptKind({ kind: kind, went_live: went })).toBe(mark);
    });
});

describe('AttemptMark', () => {
    const colors = chartColors('light');

    function mark(payload) {
        const { container } = render(<svg><AttemptMark cx={10} cy={20} payload={payload} colors={colors} /></svg>);

        return container;
    }

    it('fills a dot in the better color for an attempt that went live', () => {
        const dot = mark({ kind: 'nightly', went_live: true, attempt: 1.6 }).querySelectorAll('circle')[1];

        expect(dot).toHaveAttribute('fill', colors.better);
        expect(dot).not.toHaveAttribute('stroke');
    });

    it('draws a hollow dot ringed in the worse color for one kept back', () => {
        const dot = mark({ kind: 'nightly', went_live: false, attempt: 1.6 }).querySelectorAll('circle')[1];

        expect(dot).toHaveAttribute('fill', colors.page);
        expect(dot).toHaveAttribute('stroke', colors.worse);
    });

    it('draws a weekly retrain as a diamond, filled or hollow the same way', () => {
        const went = mark({ kind: 'weekly', went_live: true, attempt: 1.6 });
        const kept = mark({ kind: 'weekly', went_live: false, attempt: 1.6 });

        expect(went.querySelector('circle')).toBeNull();
        expect(went.querySelectorAll('polygon')[1]).toHaveAttribute('fill', colors.better);
        expect(kept.querySelectorAll('polygon')[1]).toHaveAttribute('stroke', colors.worse);
    });

    it('draws nothing for a night with no score, or no place to put it', () => {
        expect(mark({ kind: 'nightly', went_live: true, attempt: null }).querySelector('g')).toBeNull();
        expect(mark(null).querySelector('g')).toBeNull();

        const { container } = render(<svg><AttemptMark cx={NaN} cy={20} payload={{ attempt: 1 }} colors={colors} /></svg>);

        expect(container.querySelector('g')).toBeNull();
    });
});

describe('the chart', () => {
    it('draws a mark for every night: filled where it went live, hollow where it was kept back, a diamond for a weekly retrain', () => {
        const { container } = draw({
            rows: historyOf(4, { 1: { went_live: true }, 2: { kind: 'weekly' }, 3: { kind: 'weekly', went_live: true } }),
        });

        expect(container.querySelectorAll('.model-attempt')).toHaveLength(4);
        expect(container.querySelectorAll('.model-attempt-nightly.model-attempt-kept')).toHaveLength(1);
        expect(container.querySelectorAll('.model-attempt-nightly.model-attempt-live')).toHaveLength(1);
        expect(container.querySelectorAll('.model-attempt-weekly.model-attempt-kept')).toHaveLength(1);
        expect(container.querySelectorAll('.model-attempt-weekly.model-attempt-live')).toHaveLength(1);
    });

    it('flips the loss axis, so lower loss is drawn higher and up is better', () => {
        const { container } = draw({ score: 'loss' });
        const ticks = yTicks(container);
        const top = ticks.reduce((a, b) => (a.y < b.y ? a : b));
        const bottom = ticks.reduce((a, b) => (a.y > b.y ? a : b));

        expect(top.value).toBeLessThan(bottom.value);
        expect(screen.getByText(/the loss axis is flipped: lower is better/)).toBeInTheDocument();
    });

    it('leaves every other score\'s axis the right way up, and says nothing of flipping it', () => {
        const { container } = draw({ score: 'auc_up' });
        const ticks = yTicks(container);
        const top = ticks.reduce((a, b) => (a.y < b.y ? a : b));
        const bottom = ticks.reduce((a, b) => (a.y > b.y ? a : b));

        expect(top.value).toBeGreaterThan(bottom.value);
        expect(screen.queryByText(/flipped/)).toBeNull();
    });

    it('draws a bar up in the better color for a night that beat the live version, and down in the worse one for a miss', () => {
        const { container } = draw({
            rows: historyOf(2, { 0: { attempt: { loss: 1.55, auc_up: 0.6, auc_beats: 0.5, acc_up: 0.5 } } }),
        });
        const colors = chartColors('light');

        expect(container.querySelector('.model-gap-bar-better')).toHaveAttribute('fill', colors.better);
        expect(container.querySelector('.model-gap-bar-worse')).toHaveAttribute('fill', colors.worse);
    });

    it('says, on a score other than loss, that a kept-back attempt can still be better', () => {
        draw({ score: 'acc_up' });

        expect(screen.getByText(/Going live is decided by loss/)).toBeInTheDocument();
    });

    it('says nothing of it on loss, which is what decides', () => {
        draw({ score: 'loss' });

        expect(screen.queryByText(/Going live is decided by loss/)).toBeNull();
    });

    it('draws in the dark theme\'s colors on a dark page', () => {
        const { container } = draw({ rows: historyOf(1, { 0: { went_live: true } }) }, 'dark');

        expect(container.querySelectorAll('.model-attempt circle')[1]).toHaveAttribute('fill', chartColors('dark').better);
    });

    it('draws the live version in green, and the know-nothing baseline dashed in amber (#251)', () => {
        const { container } = draw();
        const colors = chartColors('light');
        const [baseline, live] = container.querySelectorAll(`${ATTEMPTS} .recharts-line-curve`);

        expect(baseline).toHaveAttribute('stroke', colors.baseline);
        expect(baseline).toHaveAttribute('stroke-dasharray', '5 4');
        expect(live).toHaveAttribute('stroke', colors.live);
        expect(live).not.toHaveAttribute('stroke-dasharray');
    });

    it('names in its legend only the marks it draws, each drawn as the chart draws it (#251)', () => {
        draw({ rows: historyOf(3, { 0: { went_live: true }, 2: { kind: 'weekly', went_live: true } }) });

        const legend = screen.getByRole('list', { name: 'Legend' });
        const items = within(legend).getAllByRole('listitem');

        expect(items.map((item) => item.textContent)).toEqual([
            'Live version',
            'Know-nothing baseline',
            'Attempt went live',
            'Attempt kept back',
            'Weekly retrain, went live',
        ]);
        expect(items[4].querySelector('polygon')).toHaveAttribute('fill', chartColors('light').better);
        expect(items[1].querySelector('line')).toHaveAttribute('stroke-dasharray', '5 4');
    });

    it('names a weekly retrain kept back as a hollow diamond, and leaves out the marks of nights it has none of', () => {
        draw({ rows: historyOf(2, { 0: { kind: 'weekly' }, 1: { kind: 'weekly' } }) });

        const items = within(screen.getByRole('list', { name: 'Legend' })).getAllByRole('listitem');

        expect(items.map((item) => item.textContent)).toEqual(['Live version', 'Know-nothing baseline', 'Weekly retrain, kept back']);
        expect(items[2].querySelector('polygon')).toHaveAttribute('fill', 'none');
        expect(items[2].querySelector('polygon')).toHaveAttribute('stroke', chartColors('light').worse);
    });

    it('leaves the live version out of the legend while no night has one', () => {
        const none = { loss: null, auc_up: null, auc_beats: null, acc_up: null };

        draw({ rows: historyOf(1, { 0: { went_live: true, live: none } }) });

        expect(within(screen.getByRole('list', { name: 'Legend' })).queryByText('Live version')).toBeNull();
    });

    it('describes itself to a screen reader, with how many went live', () => {
        draw({ rows: historyOf(3, { 0: { went_live: true } }) });

        expect(screen.getByRole('img', { name: /Loss of 3 nightly attempts and the live version\. 1 went live/ })).toBeInTheDocument();
    });
});

describe('how long each attempt took (#247)', () => {
    it('draws a bar for each night with times, its training under the scoring after it, and none for the rest', () => {
        const { container } = draw({ rows: timedHistoryOf() });
        const training = [...container.querySelectorAll('.model-took-training')];
        const scoring = [...container.querySelectorAll('.model-took-scoring')];
        const top = (bar) => Number(bar.getAttribute('y'));
        const bottom = (bar) => top(bar) + Number(bar.getAttribute('height'));

        expect(training).toHaveLength(2);
        expect(scoring).toHaveLength(2);
        training.forEach((bar, at) => {
            expect(bottom(scoring[at])).toBeCloseTo(top(bar));
            expect(Number(scoring[at].getAttribute('height'))).toBeLessThan(Number(bar.getAttribute('height')));
        });
        expect(top(training[1])).toBeLessThan(top(training[0]));
    });

    it('draws every bar in teal, a weekly retrain\'s too, the scoring a lighter top (#251)', () => {
        const { container } = draw({ rows: timedHistoryOf({ 4: { kind: 'weekly' } }) });
        const bars = [...container.querySelectorAll('.model-took-bar')];

        expect(bars).toHaveLength(4);
        bars.forEach((bar) => expect(bar).toHaveAttribute('fill', chartColors('light').took));
        expect(container.querySelector('.model-took-training.model-took-weekly')).not.toHaveAttribute('fill-opacity');
        expect(container.querySelector('.model-took-scoring.model-took-weekly')).toHaveAttribute('fill-opacity', '0.4');
    });

    it('draws in the dark theme\'s teal on a dark page', () => {
        const { container } = draw({ rows: timedHistoryOf() }, 'dark');

        expect(container.querySelector('.model-took-training')).toHaveAttribute('fill', chartColors('dark').took);
    });

    it('sits under the bars of better or worse, saying why a weekly retrain stands taller, over a key (#251)', () => {
        const { container } = draw({ rows: timedHistoryOf() });
        const titles = [...container.querySelectorAll('h6')].map((title) => title.textContent);
        const title = screen.getByRole('heading', { name: 'How long each attempt took' });
        const key = screen.getByRole('list', { name: 'Legend, how long each attempt took' });

        expect(titles).toEqual(['Better or worse than the live version', 'How long each attempt took']);
        expect(title.nextElementSibling).toHaveTextContent(
            'A weekly retrain starts from scratch, so it takes longer than a nightly update. Times are kept from 2026-10-15 on.'
        );
        expect(title.nextElementSibling.nextElementSibling).toBe(key);
        expect(within(key).getAllByRole('listitem').map((item) => item.textContent)).toEqual(['Training', 'Scoring, the lighter top']);
        expect(key.nextElementSibling).toHaveClass('model-chart-took');
    });

    it('is left out while no night has times, as a history without them is drawn today', () => {
        const { container } = draw({ rows: historyOf() });

        expect(screen.queryByText('How long each attempt took')).toBeNull();
        expect(screen.queryByText(/Times are kept/)).toBeNull();
        expect(container.querySelector(TOOK)).toBeNull();
        expect(container.querySelectorAll('.model-chart')).toHaveLength(2);
    });

    it('reads its axis in seconds, minutes or hours, by its longest night (#251)', () => {
        const seconds = draw({ rows: timedHistoryOf({ 3: { training_seconds: 1.0, total_seconds: 1.3 }, 4: { training_seconds: 2.3, total_seconds: 2.6 } }) });
        const inSeconds = tookTicks(seconds.container);

        seconds.unmount();

        const minutes = draw({ rows: timedHistoryOf() });
        const inMinutes = tookTicks(minutes.container);

        minutes.unmount();

        const hours = draw({ rows: timedHistoryOf({ 4: { kind: 'weekly', training_seconds: 6 * 3600, total_seconds: 6.5 * 3600 } }) });
        const inHours = tookTicks(hours.container);

        expect(inSeconds.length).toBeGreaterThan(0);
        inSeconds.forEach((tick) => expect(tick).toMatch(/^\d+ s$/));
        expect(inMinutes.length).toBeGreaterThan(0);
        inMinutes.forEach((tick) => expect(tick).toMatch(/^\d+ min$/));
        expect(inHours.length).toBeGreaterThan(0);
        inHours.forEach((tick) => expect(tick).toMatch(/^\d+ h$/));
    });

    it('describes itself to a screen reader, with the longest night', () => {
        draw({ rows: timedHistoryOf() });

        expect(screen.getByRole('img', { name: /on the 2 nights with times\. The longest took 9 min 52 s\.$/ })).toBeInTheDocument();
    });

    it('counts a single night with times as one', () => {
        draw({ rows: historyOf(11) });

        expect(screen.getByRole('img', { name: /on the 1 night with times\. The longest took 8 min 52 s\.$/ })).toBeInTheDocument();
    });
});

describe('the panels (#251)', () => {
    afterEach(wideScreen);

    //
    // the panel under a chart -- the attempts', the bars of better or worse, or
    // how long each took -- or null where it has none
    //
    function panelUnder(container, which) {
        const next = container.querySelector(which).nextElementSibling;

        return next && next.classList.contains('model-readout') ? next : null;
    }

    it('are not drawn for a history with no nights', () => {
        const { container } = draw({ rows: [] });

        expect(container.querySelector('.model-readout')).toBeNull();
    });

    it('keep one slim line under each chart on a wide screen, on the latest night', () => {
        const { container } = draw({ rows: timedHistoryOf() });

        [ATTEMPTS, GAP, TOOK].forEach((which) => {
            const panel = panelUnder(container, which);

            expect(panel).toHaveClass('model-readout-line');
            expect(panel).toHaveTextContent('Fri, Oct 16, 2026 · nightly update');
        });
    });

    it.each([
        ['the attempts', ATTEMPTS],
        ['the bars of better or worse', GAP],
        ['how long each took', TOOK],
    ])('all move to the night pointed at on %s, and stay on it when the pointer leaves', (name, which) => {
        const { container } = draw({ rows: timedHistoryOf() });

        pointAt(container, 430, which);

        [ATTEMPTS, GAP, TOOK].forEach((each) => expect(panelUnder(container, each)).toHaveTextContent('Thu, Oct 15, 2026'));

        fireEvent.mouseLeave(container.querySelector(`${which} .recharts-wrapper`));

        expect(panelUnder(container, ATTEMPTS)).toHaveTextContent('Thu, Oct 15, 2026');
    });

    it('draw no box over a chart: the panels hold the numbers', () => {
        const { container } = draw({ rows: timedHistoryOf() });

        pointAt(container, 430);

        const tips = [...container.querySelectorAll('.model-tip')];

        expect(tips).toHaveLength(3);
        tips.forEach((tip) => expect(tip.closest('.model-readout')).not.toBeNull());
        expect(container.querySelector('.recharts-tooltip-wrapper .model-tip')).toBeNull();
    });

    it('name under the attempts every score drawn on the night, each beside its mark as the chart draws it, and what came of it', () => {
        const { container } = draw({ rows: historyOf(1, { 0: { kind: 'weekly', went_live: true } }) });
        const panel = panelUnder(container, ATTEMPTS);
        const rows = [...panel.querySelectorAll('.model-tip-row')];
        const colors = chartColors('light');

        expect(panel).toHaveTextContent('Thu, Oct 1, 2026 · weekly retrain');
        expect(rows.map((row) => row.querySelector('.model-tip-name').textContent)).toEqual(['This attempt', 'Live version', 'Know-nothing baseline']);
        expect(rows.map((row) => row.querySelector('.model-tip-value').textContent)).toEqual(['1.610', '1.600', '1.660']);
        expect(rows[0].querySelector('polygon')).toHaveAttribute('fill', colors.better);
        expect(rows[1].querySelector('line')).toHaveAttribute('stroke', colors.live);
        expect(rows[2].querySelector('line')).toHaveAttribute('stroke', colors.baseline);
        expect(rows[2].querySelector('line')).toHaveAttribute('stroke-dasharray', '5 4');
        expect(panel.querySelector('.model-tip-foot')).toHaveTextContent('Went live: its loss was no higher than the live version’s');
    });

    it('say what came of an attempt by loss, whichever score is on screen', () => {
        const { container } = draw({ score: 'auc_up', rows: historyOf(1) });

        expect(panelUnder(container, ATTEMPTS).querySelector('.model-tip-foot'))
            .toHaveTextContent('Kept back: its loss was higher than the live version’s');
    });

    it('call a first version so, with no live version to compare it with', () => {
        const none = { loss: null, auc_up: null, auc_beats: null, acc_up: null };
        const { container } = draw({ rows: historyOf(1, { 0: { went_live: true, live: none } }) });

        expect(panelUnder(container, ATTEMPTS)).toHaveTextContent('Went live: the model’s first version');
        expect(panelUnder(container, ATTEMPTS)).not.toHaveTextContent('Live version');
        expect(panelUnder(container, GAP)).toHaveTextContent('No live version to compare with');
    });

    it.each([
        ['beat', { loss: 1.55, auc_up: 0.6, auc_beats: 0.5, acc_up: 0.5 }, '0.050 better than the live version'],
        ['missed', { loss: 1.61, auc_up: 0.5, auc_beats: 0.5, acc_up: 0.5 }, '0.010 worse than the live version'],
        ['matched', { loss: 1.6001, auc_up: 0.5, auc_beats: 0.5, acc_up: 0.5 }, 'Level with the live version'],
    ])('say under the bars how far an attempt that %s the live version stood from it', (label, attempt, said) => {
        const { container } = draw({ rows: historyOf(1, { 0: { attempt: attempt } }) });

        expect(panelUnder(container, GAP)).toHaveTextContent(said);
    });

    it('say under the time chart how long the night took: its training, its scoring, and when it started in Eastern time', () => {
        const { container } = draw({ rows: timedHistoryOf() });

        pointAt(container, 430, TOOK);

        const panel = panelUnder(container, TOOK);

        expect(panel).toHaveTextContent('Thu, Oct 15, 2026 · nightly update');
        expect([...panel.querySelectorAll('.model-tip-row')].map((row) => row.textContent)).toEqual(['Training7 min 17 s', 'Scoring1 min 35 s']);
        expect(panel.querySelector('.model-tip-foot')).toHaveTextContent('8 min 52 s in all, started 3:58 AM ET');
        panel.querySelectorAll('.model-mark rect').forEach((rect) => expect(rect).toHaveAttribute('fill', chartColors('light').took));
    });

    it('leave out when a night started where the history does not say', () => {
        const { container } = draw({ rows: timedHistoryOf({ 3: { started: null } }) });

        pointAt(container, 430, TOOK);

        expect(panelUnder(container, TOOK).querySelector('.model-tip-foot')).toHaveTextContent(/^8 min 52 s in all$/);
    });

    //
    // Note: one point per case. recharts throttles a chart's mouse moves to one
    //       a frame, so a second in the same tick is held back past the
    //       assertion after it.
    //
    it('say a night from before the times were kept has none', () => {
        const { container } = draw({ rows: timedHistoryOf() });

        pointAt(container, 110, TOOK);

        expect(panelUnder(container, TOOK).querySelector('.model-tip-row')).toBeNull();
        expect(panelUnder(container, TOOK).querySelector('.model-tip-foot')).toHaveTextContent('No times: they are kept from Oct 15, 2026 on');
    });

    it('print a night under ten seconds to a tenth', () => {
        const { container } = draw({ rows: timedHistoryOf({ 4: { training_seconds: 2.3, total_seconds: 2.6 } }) });

        expect([...panelUnder(container, TOOK).querySelectorAll('.model-tip-row')].map((row) => row.textContent))
            .toEqual(['Training2.3 s', 'Scoring0.3 s']);
        expect(panelUnder(container, TOOK).querySelector('.model-tip-foot')).toHaveTextContent('2.6 s in all');
    });

    it('open on a phone only under the chart tapped, for the night tapped, as rows, and close on a second tap', () => {
        phoneScreen();

        const { container } = draw({ rows: timedHistoryOf() });
        const took = container.querySelector(`${TOOK} .recharts-wrapper`);

        expect(container.querySelector('.model-readout')).toBeNull();

        tapAt(took, 430);

        expect(panelUnder(container, TOOK)).not.toHaveClass('model-readout-line');
        expect(panelUnder(container, TOOK)).toHaveTextContent('Thu, Oct 15, 2026');
        expect(panelUnder(container, ATTEMPTS)).toBeNull();
        expect(panelUnder(container, GAP)).toBeNull();

        tapAt(took, 430);

        expect(container.querySelector('.model-readout')).toBeNull();
    });

    it('move on a phone to the chart tapped next', () => {
        phoneScreen();

        const { container } = draw({ rows: timedHistoryOf() });

        tapAt(container.querySelector(`${TOOK} .recharts-wrapper`), 430);
        tapAt(container.querySelector(`${ATTEMPTS} .recharts-wrapper`), 110);

        expect(panelUnder(container, TOOK)).toBeNull();
        expect(panelUnder(container, ATTEMPTS)).toHaveTextContent('Mon, Oct 12, 2026');
    });
});

describe('folding each chart (#253)', () => {
    // a fold is kept, as a reader's is: none is left for the cases after these
    beforeEach(() => window.localStorage.clear());
    afterEach(() => window.localStorage.clear());

    const ATTEMPTS_TITLE = 'Each attempt against the live version';
    const GAP_TITLE = 'Better or worse than the live version';
    const TOOK_TITLE = 'How long each attempt took';

    const title = (name) => screen.getByRole('button', { name: name });

    it('opens every chart on a first visit, each title saying so', () => {
        const { container } = draw({ rows: timedHistoryOf() });

        [ATTEMPTS_TITLE, GAP_TITLE, TOOK_TITLE].forEach((name) => expect(title(name)).toHaveAttribute('aria-expanded', 'true'));
        expect(container.querySelectorAll('.model-chart')).toHaveLength(3);
        expect(container.querySelectorAll('.model-readout')).toHaveLength(3);
    });

    it('folds the attempts down to their title, and opens them again', async () => {
        const { container } = draw({ rows: timedHistoryOf() });

        await userEvent.click(title(ATTEMPTS_TITLE));

        expect(title(ATTEMPTS_TITLE)).toHaveAttribute('aria-expanded', 'false');
        expect(container.querySelector(ATTEMPTS)).toBeNull();
        expect(container.querySelector('.model-card-head .model-card-sub')).toBeNull();
        expect(screen.queryByRole('list', { name: 'Legend' })).toBeNull();
        expect(screen.queryByText('Know-nothing baseline')).toBeNull();
        expect(container.querySelector(GAP)).not.toBeNull();
        expect(container.querySelector(TOOK)).not.toBeNull();
        expect(container.querySelectorAll('.model-readout')).toHaveLength(2);

        await userEvent.click(title(ATTEMPTS_TITLE));

        expect(title(ATTEMPTS_TITLE)).toHaveAttribute('aria-expanded', 'true');
        expect(container.querySelector(ATTEMPTS)).not.toBeNull();
        expect(screen.getByRole('list', { name: 'Legend' })).toBeInTheDocument();
        expect(container.querySelectorAll('.model-readout')).toHaveLength(3);
    });

    it('folds the bars of better or worse on their own: their legend, the line under it, the bars and their panel', async () => {
        const { container } = draw({ rows: timedHistoryOf(), score: 'auc_up' });

        await userEvent.click(title(GAP_TITLE));

        expect(container.querySelector(GAP)).toBeNull();
        expect(screen.queryByRole('list', { name: 'Legend, better or worse' })).toBeNull();
        expect(screen.queryByText(/an attempt kept back can still show as better/)).toBeNull();
        expect(container.querySelector(ATTEMPTS)).not.toBeNull();
        expect(container.querySelector(TOOK)).not.toBeNull();
        expect(container.querySelectorAll('.model-readout')).toHaveLength(2);
    });

    it('folds the time chart on its own: the line under it, its key, its bars and its panel', async () => {
        const { container } = draw({ rows: timedHistoryOf() });

        await userEvent.click(title(TOOK_TITLE));

        expect(container.querySelector(TOOK)).toBeNull();
        expect(screen.queryByRole('list', { name: 'Legend, how long each attempt took' })).toBeNull();
        expect(screen.queryByText(/A weekly retrain starts from scratch/)).toBeNull();
        expect(container.querySelector(GAP)).not.toBeNull();
        expect(title(TOOK_TITLE)).toHaveAttribute('aria-expanded', 'false');
    });

    it('folds by the keyboard too', async () => {
        const { container } = draw({ rows: timedHistoryOf() });

        title(GAP_TITLE).focus();
        await userEvent.keyboard('{Enter}');

        expect(container.querySelector(GAP)).toBeNull();
    });

    it('keeps a fold for the next visit', async () => {
        const { unmount } = draw({ rows: timedHistoryOf() });

        await userEvent.click(title(TOOK_TITLE));
        unmount();

        const { container } = draw({ rows: timedHistoryOf() });

        expect(title(TOOK_TITLE)).toHaveAttribute('aria-expanded', 'false');
        expect(container.querySelector(TOOK)).toBeNull();
        expect(container.querySelector(ATTEMPTS)).not.toBeNull();
    });

    it('keeps "Show the numbers" with all three folded, since it covers all three', async () => {
        draw({ rows: timedHistoryOf() });

        for (const name of [ATTEMPTS_TITLE, GAP_TITLE, TOOK_TITLE]) {
            await userEvent.click(title(name));
        }

        await userEvent.click(screen.getByRole('button', { name: 'Show the numbers' }));

        expect(screen.getByRole('table', { name: 'Loss, each attempt against the live version' })).toBeInTheDocument();
    });
});

describe('the numbers', () => {
    it('lists every night, newest first, with how it stood and what came of it', async () => {
        draw({
            rows: historyOf(3, {
                0: { went_live: true, attempt: { loss: 1.55, auc_up: 0.6, auc_beats: 0.5, acc_up: 0.5 } },
                1: { kind: 'weekly', attempt: { loss: 1.6001, auc_up: 0.6, auc_beats: 0.5, acc_up: 0.5 } },
                2: { attempt: { loss: null, auc_up: null, auc_beats: null, acc_up: null } },
            }),
        });

        await userEvent.click(screen.getByRole('button', { name: 'Show the numbers' }));

        const table = screen.getByRole('table', { name: 'Loss, each attempt against the live version' });
        const rows = within(table).getAllByRole('row').slice(1).map((row) => within(row).getAllByRole('cell').map((cell) => cell.textContent));

        expect(rows).toEqual([
            ['Oct 5', 'Nightly update', '–', '1.600', '1.660', '', 'Kept back', ''],
            ['Oct 2', 'Weekly retrain', '1.600', '1.600', '1.660', 'level', 'Kept back', ''],
            ['Oct 1', 'Nightly update', '1.550', '1.600', '1.660', 'better by 0.050', 'Went live', ''],
        ]);
    });

    it('says how long each night with times took, after what came of it, and leaves the rest empty', async () => {
        draw({ rows: timedHistoryOf() });

        await userEvent.click(screen.getByRole('button', { name: 'Show the numbers' }));

        const table = screen.getByRole('table', { name: 'Loss, each attempt against the live version' });
        const heads = within(table).getAllByRole('columnheader').map((head) => head.textContent);
        const took = within(table).getAllByRole('row').slice(1).map((row) => within(row).getAllByRole('cell').pop().textContent);

        expect(heads.slice(-2)).toEqual(['Result', 'Took']);
        expect(took).toEqual(['9 min 52 s', '8 min 52 s', '', '', '']);
    });
});
