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

import AttemptsChart, {
    AttemptMark,
    attemptKind,
    attemptPoints,
    attemptsAbout,
    durationUnit,
    verdictOf,
} from '../../../import/layout/model/attempts-chart.jsx';
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

//
// what the card says under its title for every model, and what it adds for a
// stock model with holds (#300)
//
const ABOUT = 'Every night’s attempt and the live version, scored on the same 3 held-out days.';
const HELD = 'These are the 1-day hold’s scores, since the held-out days have no 5 or 20-day results yet, so the hold picker doesn’t move this card.';

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

//
// the one panel under the three charts (#300), or null where there is none
//
function panelOf(container) {
    return container.querySelector('.model-attempt-panel');
}

//
// how tall a chart is drawn, in px, and whether the nights' axis is drawn under
// it (#300)
//
function heightOf(container, which) {
    return Number(container.querySelector(`${which} .recharts-surface`).getAttribute('height'));
}

function hasAxis(container, which) {
    return container.querySelector(`${which} .recharts-xAxis`) !== null;
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

describe('verdictOf (#300)', () => {
    it('says what came of an attempt, and how far it beat or missed the live version', () => {
        expect(verdictOf({ went_live: true, live: 1.6, gap: 0.05 }, 'loss')).toBe('Went live: 0.050 better than the live version');
        expect(verdictOf({ went_live: false, live: 1.6, gap: -0.01 }, 'loss')).toBe('Kept back: 0.010 worse than the live version');
    });

    it('calls an attempt that printed alike level with the live version', () => {
        expect(verdictOf({ went_live: false, live: 1.6, gap: 0.0001 }, 'loss')).toBe('Kept back: level with the live version');
    });

    it('calls a first version so, with no live version to compare it with', () => {
        expect(verdictOf({ went_live: true, live: null, gap: null }, 'loss')).toBe('Went live: the model’s first version');
    });

    it('says how far it stood on the score on screen, a share in points', () => {
        expect(verdictOf({ went_live: false, live: 0.5, gap: 0.012 }, 'acc_up')).toBe('Kept back: 1.2 pts better than the live version');
    });
});

describe('attemptsAbout (#300)', () => {
    it('says every attempt and the live version are scored on the same held-out days', () => {
        expect(attemptsAbout(false)).toBe(ABOUT);
    });

    it('adds, for a stock model with holds, that these are the 1-day hold\'s scores, which the hold picker does not move', () => {
        expect(attemptsAbout(true)).toBe(`${ABOUT} ${HELD}`);
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

    it('draws a hollow dot ringed in the same better color for one kept back (#300)', () => {
        const dot = mark({ kind: 'nightly', went_live: false, attempt: 1.6 }).querySelectorAll('circle')[1];

        expect(dot).toHaveAttribute('fill', colors.page);
        expect(dot).toHaveAttribute('stroke', colors.better);
    });

    it('draws a weekly retrain as a diamond, filled or hollow the same way', () => {
        const went = mark({ kind: 'weekly', went_live: true, attempt: 1.6 });
        const kept = mark({ kind: 'weekly', went_live: false, attempt: 1.6 });

        expect(went.querySelector('circle')).toBeNull();
        expect(went.querySelectorAll('polygon')[1]).toHaveAttribute('fill', colors.better);
        expect(kept.querySelectorAll('polygon')[1]).toHaveAttribute('fill', colors.page);
        expect(kept.querySelectorAll('polygon')[1]).toHaveAttribute('stroke', colors.better);
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

    it('says under its title that each night\'s attempt and the live version are scored on the same held-out days', () => {
        const { container } = draw();

        expect(container.querySelector('.model-card-head .model-card-sub')).toHaveTextContent(ABOUT);
        expect(screen.queryByText(/the hold picker doesn’t move this card/)).toBeNull();
    });

    it('says too, for a stock model with holds, that these are its 1-day hold\'s scores (#300)', () => {
        const { container } = draw({ held: true });

        expect(container.querySelector('.model-card-head .model-card-sub')).toHaveTextContent(`${ABOUT} ${HELD}`);
    });

    it('flips the loss axis, so lower loss is drawn higher and up is better, and says so after its legend (#300)', () => {
        const { container } = draw({ score: 'loss' });
        const ticks = yTicks(container);
        const top = ticks.reduce((a, b) => (a.y < b.y ? a : b));
        const bottom = ticks.reduce((a, b) => (a.y > b.y ? a : b));
        const note = container.querySelector('.model-legend-note');

        expect(top.value).toBeLessThan(bottom.value);
        expect(note).toHaveTextContent('Lower is better, so the axis is flipped: better is up.');
        expect(note.closest('ul')).toHaveAccessibleName('Legend');
    });

    it('leaves every other score\'s axis the right way up, and says nothing of flipping it', () => {
        const { container } = draw({ score: 'auc_up' });
        const ticks = yTicks(container);
        const top = ticks.reduce((a, b) => (a.y < b.y ? a : b));
        const bottom = ticks.reduce((a, b) => (a.y > b.y ? a : b));

        expect(top.value).toBeGreaterThan(bottom.value);
        expect(screen.queryByText(/flipped/)).toBeNull();
        expect(container.querySelector('.model-legend-note')).toHaveTextContent(/^Higher is better\.$/);
    });

    it('draws a bar up in the better color for a night that beat the live version, and down in the worse one for a miss', () => {
        const { container } = draw({
            rows: historyOf(2, { 0: { attempt: { loss: 1.55, auc_up: 0.6, auc_beats: 0.5, acc_up: 0.5 } } }),
        });
        const colors = chartColors('light');

        expect(container.querySelector('.model-gap-bar-better')).toHaveAttribute('fill', colors.better);
        expect(container.querySelector('.model-gap-bar-worse')).toHaveAttribute('fill', colors.worse);
    });

    it('reads the bars\' axis in words, better at its top and worse at its foot, with no key (#300)', () => {
        const { container } = draw();
        const ticks = [...container.querySelectorAll(`${GAP} .recharts-yAxis .recharts-cartesian-axis-tick`)]
            .map((tick) => ({ y: Number(tick.querySelector('line, text').getAttribute('y')), text: tick.textContent }));
        const better = ticks.find((tick) => tick.text === 'better');
        const worse = ticks.find((tick) => tick.text === 'worse');

        expect(ticks.map((tick) => tick.text).sort()).toEqual(['', 'better', 'worse']);
        expect(better.y).toBeLessThan(worse.y);
        expect(screen.getAllByRole('list', { name: /^Legend/ })).toHaveLength(1);
    });

    it('titles the bars by how far each attempt beat or missed the live version (#300)', () => {
        const { container } = draw();

        expect([...container.querySelectorAll('h6')].map((title) => title.textContent)).toEqual(['How far each attempt beat or missed the live version']);
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

    it('draws the live version in green, and the know-nothing baseline dashed in amber (#251, #300)', () => {
        const { container } = draw();
        const colors = chartColors('light');
        const [baseline, live] = container.querySelectorAll(`${ATTEMPTS} .recharts-line-curve`);

        expect(baseline).toHaveAttribute('stroke', colors.baseline);
        expect(baseline).toHaveAttribute('stroke-dasharray', '7 5');
        expect(live).toHaveAttribute('stroke', colors.live);
        expect(live).toHaveAttribute('stroke-width', '2.5');
        expect(live).not.toHaveAttribute('stroke-dasharray');
    });

    it('names in its legend the marks it draws, each in the better color, then which way its axis runs (#300)', () => {
        draw({ rows: historyOf(3, { 0: { went_live: true }, 2: { kind: 'weekly', went_live: true } }) });

        const legend = screen.getByRole('list', { name: 'Legend' });
        const items = within(legend).getAllByRole('listitem');
        const colors = chartColors('light');

        expect(items.map((item) => item.textContent)).toEqual([
            'Live version',
            'Baseline',
            'Went live',
            'Kept back',
            'Weekly retrain',
            'Lower is better, so the axis is flipped: better is up.',
        ]);
        expect(items[0].querySelector('line')).toHaveAttribute('stroke', colors.live);
        expect(items[1].querySelector('line')).toHaveAttribute('stroke', colors.baseline);
        expect(items[1].querySelector('line')).toHaveAttribute('stroke-dasharray');
        expect(items[2].querySelector('circle')).toHaveAttribute('fill', colors.better);
        expect(items[3].querySelector('circle')).toHaveAttribute('fill', 'none');
        expect(items[3].querySelector('circle')).toHaveAttribute('stroke', colors.better);
        expect(items[4].querySelector('polygon')).toHaveAttribute('fill', colors.better);
        expect(items[5]).toHaveClass('model-legend-note');
        expect(items[5].querySelector('svg')).toBeNull();
    });

    it('names a weekly retrain once, as a diamond, kept back or not, and leaves out the marks of nights it has none of', () => {
        draw({ rows: historyOf(2, { 0: { kind: 'weekly' }, 1: { kind: 'weekly' } }) });

        const items = within(screen.getByRole('list', { name: 'Legend' })).getAllByRole('listitem');

        expect(items.map((item) => item.textContent)).toEqual([
            'Live version',
            'Baseline',
            'Kept back',
            'Weekly retrain',
            'Lower is better, so the axis is flipped: better is up.',
        ]);
        expect(items[3].querySelector('polygon')).toHaveAttribute('fill', chartColors('light').better);
    });

    it('names a night that went live where only a weekly retrain did', () => {
        draw({ rows: historyOf(1, { 0: { kind: 'weekly', went_live: true } }) });

        const items = within(screen.getByRole('list', { name: 'Legend' })).getAllByRole('listitem');

        expect(items.map((item) => item.textContent)).toEqual([
            'Live version',
            'Baseline',
            'Went live',
            'Weekly retrain',
            'Lower is better, so the axis is flipped: better is up.',
        ]);
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

describe('the nights\' axis (#300)', () => {
    // a fold is kept, as a reader's is: none is left for the cases after these
    beforeEach(() => window.localStorage.clear());
    afterEach(() => window.localStorage.clear());

    it('is drawn once, under how long each attempt took, the last chart, which is the taller for it', () => {
        const { container } = draw({ rows: timedHistoryOf() });

        expect([ATTEMPTS, GAP, TOOK].map((which) => hasAxis(container, which))).toEqual([false, false, true]);
        expect([ATTEMPTS, GAP, TOOK].map((which) => heightOf(container, which))).toEqual([200, 90, 150]);
    });

    it('is under the bars of better or worse while no night has times', () => {
        const { container } = draw({ rows: historyOf() });

        expect([ATTEMPTS, GAP].map((which) => hasAxis(container, which))).toEqual([false, true]);
        expect([ATTEMPTS, GAP].map((which) => heightOf(container, which))).toEqual([200, 120]);
    });

    it('moves up to the last chart left open as the ones under it fold', async () => {
        const { container } = draw({ rows: timedHistoryOf() });

        await userEvent.click(screen.getByRole('button', { name: 'How long each attempt took' }));

        expect(hasAxis(container, GAP)).toBe(true);
        expect(heightOf(container, GAP)).toBe(120);

        await userEvent.click(screen.getByRole('button', { name: 'How far each attempt beat or missed the live version' }));

        expect(hasAxis(container, ATTEMPTS)).toBe(true);
        expect(heightOf(container, ATTEMPTS)).toBe(230);
    });

    it('names the nights by their short day', () => {
        const { container } = draw({ rows: timedHistoryOf() });
        const names = [...container.querySelectorAll(`${TOOK} .recharts-xAxis .recharts-cartesian-axis-tick`)].map((tick) => tick.textContent);

        expect(names.length).toBeGreaterThan(0);
        names.forEach((name) => expect(name).toMatch(/^Oct \d+$/));
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

    it('draws every bar in teal, a weekly retrain\'s too, the scoring a lighter top, half the teal (#251, #300)', () => {
        const { container } = draw({ rows: timedHistoryOf({ 4: { kind: 'weekly' } }) });
        const bars = [...container.querySelectorAll('.model-took-bar')];

        expect(bars).toHaveLength(4);
        bars.forEach((bar) => expect(bar).toHaveAttribute('fill', chartColors('light').took));
        expect(container.querySelector('.model-took-training.model-took-weekly')).not.toHaveAttribute('fill-opacity');
        expect(container.querySelector('.model-took-scoring.model-took-weekly')).toHaveAttribute('fill-opacity', '0.5');
    });

    it('draws in the dark theme\'s teal on a dark page', () => {
        const { container } = draw({ rows: timedHistoryOf() }, 'dark');

        expect(container.querySelector('.model-took-training')).toHaveAttribute('fill', chartColors('dark').took);
    });

    it('sits under the bars of better or worse, saying which part is which and why a weekly retrain stands taller, with no key (#300)', () => {
        const { container } = draw({ rows: timedHistoryOf() });
        const titles = [...container.querySelectorAll('h6')].map((title) => title.textContent);
        const title = screen.getByRole('heading', { name: 'How long each attempt took' });

        expect(titles).toEqual(['How far each attempt beat or missed the live version', 'How long each attempt took']);
        expect(title.nextElementSibling).toHaveTextContent(
            'Training, then scoring the held-out days in a lighter teal. A weekly retrain starts from scratch, so its bar stands taller.'
        );
        expect(title.nextElementSibling.nextElementSibling).toHaveClass('model-chart-took');
        expect(screen.queryByRole('list', { name: 'Legend, how long each attempt took' })).toBeNull();
    });

    it('is left out while no night has times, as a history without them is drawn today', () => {
        const { container } = draw({ rows: historyOf() });

        expect(screen.queryByText('How long each attempt took')).toBeNull();
        expect(screen.queryByText(/lighter teal/)).toBeNull();
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

describe('the panel (#300)', () => {
    afterEach(wideScreen);

    //
    // the panel's lines: its night, the scores, what came of the attempt, and
    // how long it took
    //
    function linesOf(container) {
        return [...panelOf(container).children].map((line) => line.textContent);
    }

    it('is not drawn for a history with no nights', () => {
        const { container } = draw({ rows: [] });

        expect(panelOf(container)).toBeNull();
    });

    it('is one panel, under the last of the three charts, on the latest night on a wide screen', () => {
        const { container } = draw({ rows: timedHistoryOf() });

        expect(container.querySelectorAll('.model-attempt-panel')).toHaveLength(1);
        expect(container.querySelector(TOOK).nextElementSibling).toBe(panelOf(container));
        expect(linesOf(container)).toEqual([
            'Oct 16 · nightly update',
            'Attempt 1.614 · live version 1.600 · baseline 1.660',
            '▼ Kept back: 0.014 worse than the live version',
            '9 min 52 s in all: training 8 min 17 s, scoring 1 min 35 s, started 3:58 AM ET',
        ]);
    });

    it('stands under the bars of better or worse while no night has times', () => {
        const { container } = draw({ rows: historyOf() });

        expect(container.querySelector(GAP).nextElementSibling).toBe(panelOf(container));
    });

    it.each([
        ['the attempts', ATTEMPTS],
        ['the bars of better or worse', GAP],
        ['how long each took', TOOK],
    ])('moves to the night pointed at on %s, and stays on it when the pointer leaves', (name, which) => {
        const { container } = draw({ rows: timedHistoryOf() });

        pointAt(container, 430, which);

        expect(panelOf(container).firstChild).toHaveTextContent('Oct 15 · nightly update');

        fireEvent.mouseLeave(container.querySelector(`${which} .recharts-wrapper`));

        expect(panelOf(container).firstChild).toHaveTextContent('Oct 15 · nightly update');
    });

    it('draws no box over a chart: the panel holds the numbers', () => {
        const { container } = draw({ rows: timedHistoryOf() });

        pointAt(container, 430);

        expect(container.querySelector('.model-tip')).toBeNull();
        expect(container.querySelector('.model-readout')).toBeNull();
        expect(container.querySelector('.recharts-tooltip-wrapper .model-attempt-panel')).toBeNull();
    });

    it('names a weekly retrain so', () => {
        const { container } = draw({ rows: historyOf(1, { 0: { kind: 'weekly', went_live: true } }) });

        expect(panelOf(container).firstChild).toHaveTextContent('Oct 1 · weekly retrain');
    });

    it.each([
        ['beat', { went_live: true, attempt: { loss: 1.55, auc_up: 0.6, auc_beats: 0.5, acc_up: 0.5 } }, 'better', '▲ ', 'Went live: 0.050 better than the live version'],
        ['missed', {}, 'worse', '▼ ', 'Kept back: 0.010 worse than the live version'],
    ])('says how far an attempt that %s the live version stood from it, after the list\'s arrow', (label, night, stands, arrow, said) => {
        const { container } = draw({ rows: historyOf(1, { 0: night }) });
        const verdict = panelOf(container).querySelector('.model-attempt-panel-verdict');

        expect(verdict).toHaveClass(`model-gap-${stands}`);
        expect(verdict.querySelector('.model-gap-arrow')).toHaveTextContent(arrow.trim());
        expect(verdict).toHaveTextContent(`${arrow.trim()} ${said}`);
    });

    it('calls an attempt that matched the live version level, with no arrow', () => {
        const { container } = draw({ rows: historyOf(1, { 0: { attempt: { loss: 1.6001, auc_up: 0.56, auc_beats: 0.53, acc_up: 0.54 } } }) });
        const verdict = panelOf(container).querySelector('.model-attempt-panel-verdict');

        expect(verdict).toHaveClass('model-gap-level');
        expect(verdict.querySelector('.model-gap-arrow')).toBeNull();
        expect(verdict).toHaveTextContent(/^Kept back: level with the live version$/);
    });

    it('calls a first version so, with no live version among its scores or arrow before it', () => {
        const none = { loss: null, auc_up: null, auc_beats: null, acc_up: null };
        const { container } = draw({ rows: historyOf(1, { 0: { went_live: true, live: none } }) });
        const verdict = panelOf(container).querySelector('.model-attempt-panel-verdict');

        expect(linesOf(container)[1]).toBe('Attempt 1.610 · baseline 1.660');
        expect(verdict).toHaveClass('model-gap-level');
        expect(verdict.querySelector('.model-gap-arrow')).toBeNull();
        expect(verdict).toHaveTextContent(/^Went live: the model’s first version$/);
    });

    it('reads its scores on the score on screen, beside how far a kept-back attempt stood on it', () => {
        const { container } = draw({
            score: 'auc_up',
            rows: historyOf(1, { 0: { attempt: { loss: 1.61, auc_up: 0.6, auc_beats: 0.5, acc_up: 0.5 } } }),
        });

        expect(linesOf(container).slice(1, 3)).toEqual([
            'Attempt 0.600 · live version 0.560 · baseline 0.500',
            '▲ Kept back: 0.040 better than the live version',
        ]);
        expect(screen.getByText(/Going live is decided by loss/)).toBeInTheDocument();
    });

    it('says how long the night pointed at took: its training, its scoring, and when it started in Eastern time', () => {
        const { container } = draw({ rows: timedHistoryOf() });

        pointAt(container, 430, TOOK);

        expect(linesOf(container)[3]).toBe('8 min 52 s in all: training 7 min 17 s, scoring 1 min 35 s, started 3:58 AM ET');
    });

    it('leaves out when a night started where the history does not say', () => {
        const { container } = draw({ rows: timedHistoryOf({ 4: { started: null } }) });

        expect(linesOf(container)[3]).toBe('9 min 52 s in all: training 8 min 17 s, scoring 1 min 35 s');
    });

    //
    // Note: one point per case. recharts throttles a chart's mouse moves to one
    //       a frame, so a second in the same tick is held back past the
    //       assertion after it.
    //
    it('says a night from before the times were kept has none', () => {
        const { container } = draw({ rows: timedHistoryOf() });

        pointAt(container, 110, TOOK);

        expect(linesOf(container)[0]).toBe('Oct 12 · nightly update');
        expect(linesOf(container)[3]).toBe('No times: they are kept from Oct 15, 2026 on');
    });

    it('prints a night under ten seconds to a tenth', () => {
        const { container } = draw({ rows: timedHistoryOf({ 4: { training_seconds: 2.3, total_seconds: 2.6 } }) });

        expect(linesOf(container)[3]).toBe('2.6 s in all: training 2.3 s, scoring 0.3 s, started 3:58 AM ET');
    });

    it('shows the latest night on a phone too, moves to the night tapped, and back to the latest on a second tap', () => {
        phoneScreen();

        const { container } = draw({ rows: timedHistoryOf() });
        const took = container.querySelector(`${TOOK} .recharts-wrapper`);

        expect(container.querySelectorAll('.model-attempt-panel')).toHaveLength(1);
        expect(panelOf(container).firstChild).toHaveTextContent('Oct 16 · nightly update');

        tapAt(took, 430);

        expect(panelOf(container).firstChild).toHaveTextContent('Oct 15 · nightly update');

        tapAt(took, 430);

        expect(panelOf(container).firstChild).toHaveTextContent('Oct 16 · nightly update');
    });

    it('moves on a phone to the night tapped on whichever chart was tapped last', () => {
        phoneScreen();

        const { container } = draw({ rows: timedHistoryOf() });

        tapAt(container.querySelector(`${TOOK} .recharts-wrapper`), 430);
        tapAt(container.querySelector(`${ATTEMPTS} .recharts-wrapper`), 110);

        expect(container.querySelectorAll('.model-attempt-panel')).toHaveLength(1);
        expect(panelOf(container).firstChild).toHaveTextContent('Oct 12 · nightly update');
    });
});

describe('folding each chart (#253)', () => {
    // a fold is kept, as a reader's is: none is left for the cases after these
    beforeEach(() => window.localStorage.clear());
    afterEach(() => window.localStorage.clear());

    const ATTEMPTS_TITLE = 'Each attempt against the live version';
    const GAP_TITLE = 'How far each attempt beat or missed the live version';
    const TOOK_TITLE = 'How long each attempt took';

    const title = (name) => screen.getByRole('button', { name: name });

    it('opens every chart on a first visit, each title saying so', () => {
        const { container } = draw({ rows: timedHistoryOf() });

        [ATTEMPTS_TITLE, GAP_TITLE, TOOK_TITLE].forEach((name) => expect(title(name)).toHaveAttribute('aria-expanded', 'true'));
        expect(container.querySelectorAll('.model-chart')).toHaveLength(3);
        expect(container.querySelectorAll('.model-attempt-panel')).toHaveLength(1);
    });

    it('folds the attempts down to their title, and opens them again', async () => {
        const { container } = draw({ rows: timedHistoryOf() });

        await userEvent.click(title(ATTEMPTS_TITLE));

        expect(title(ATTEMPTS_TITLE)).toHaveAttribute('aria-expanded', 'false');
        expect(container.querySelector(ATTEMPTS)).toBeNull();
        expect(container.querySelector('.model-card-head .model-card-sub')).toBeNull();
        expect(screen.queryByRole('list', { name: 'Legend' })).toBeNull();
        expect(screen.queryByText('Baseline')).toBeNull();
        expect(container.querySelector(GAP)).not.toBeNull();
        expect(container.querySelector(TOOK)).not.toBeNull();
        expect(panelOf(container)).not.toBeNull();

        await userEvent.click(title(ATTEMPTS_TITLE));

        expect(title(ATTEMPTS_TITLE)).toHaveAttribute('aria-expanded', 'true');
        expect(container.querySelector(ATTEMPTS)).not.toBeNull();
        expect(screen.getByRole('list', { name: 'Legend' })).toBeInTheDocument();
    });

    it('folds the bars of better or worse on their own: the line under their title and the bars', async () => {
        const { container } = draw({ rows: timedHistoryOf(), score: 'auc_up' });

        await userEvent.click(title(GAP_TITLE));

        expect(container.querySelector(GAP)).toBeNull();
        expect(screen.queryByText(/an attempt kept back can still show as better/)).toBeNull();
        expect(container.querySelector(ATTEMPTS)).not.toBeNull();
        expect(container.querySelector(TOOK)).not.toBeNull();
        expect(panelOf(container)).not.toBeNull();
    });

    it('folds the time chart on its own: the line under its title and its bars, the panel moving up under the bars before it', async () => {
        const { container } = draw({ rows: timedHistoryOf() });

        await userEvent.click(title(TOOK_TITLE));

        expect(container.querySelector(TOOK)).toBeNull();
        expect(screen.queryByText(/lighter teal/)).toBeNull();
        expect(container.querySelector(GAP)).not.toBeNull();
        expect(title(TOOK_TITLE)).toHaveAttribute('aria-expanded', 'false');
        expect(title(TOOK_TITLE).closest('h6').nextElementSibling).toBe(panelOf(container));
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

    it('leaves out the panel with all three folded, and keeps "Show the numbers", since it covers all three', async () => {
        const { container } = draw({ rows: timedHistoryOf() });

        for (const name of [ATTEMPTS_TITLE, GAP_TITLE, TOOK_TITLE]) {
            await userEvent.click(title(name));
        }

        expect(panelOf(container)).toBeNull();

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
