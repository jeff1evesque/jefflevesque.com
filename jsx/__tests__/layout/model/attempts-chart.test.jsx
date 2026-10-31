/**
 * attempts-chart.test.jsx: did each night's new version beat the one in charge,
 * on a model's page (#243, #318).
 *
 * Note: recharts is drawn for real, in a container given a size -- see
 *       sizedRecharts in test-support/model-fixtures.js -- so the marks, the
 *       bars, the night picked and the flipped axis are read off the svg it draws.
 */

jest.mock('recharts', () => require('../../../test-support/model-fixtures.js').sizedRecharts());

import React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import AttemptsChart, {
    AttemptMark,
    NightTick,
    TITLE,
    attemptKind,
    attemptPoints,
    attemptsAbout,
    axisLabel,
    durationUnit,
    tookAbout,
} from '../../../import/layout/model/attempts-chart.jsx';
import { ThemeModeContext } from '../../../import/general/theme-mode.jsx';
import { writeLayout } from '../../../import/general/layout-preference.js';
import { chartColors } from '../../../import/layout/model/scores.js';
import {
    historyOf,
    phoneScreen,
    pointAt as pointAtChart,
    ptGnnHistory,
    ptOptionsHistory,
    tapAt,
    timedHistoryOf,
    wideScreen,
} from '../../../test-support/model-fixtures.js';

//
// the attempts' chart, the bars of better or worse under it, and how long each
// attempt took
//
const ATTEMPTS = '.model-chart:not(.model-chart-gap):not(.model-chart-took)';
const GAP = '.model-chart-gap';
const TOOK = '.model-chart-took';

//
// what the card says under its title for every model on loss, and what it adds
// for a stock model with holds (#300, #318)
//
const ABOUT = 'Every night a new version takes a test: the 3 newest days whose results are known, which it never studied. The version in charge takes the same test, so you can compare. Lower is better. The new version takes over if it beats the simple guess.';
const HELD = 'These are the 1-day hold’s scores, since the test days have no 5 or 20-day results yet, so the hold picker doesn’t move this card.';

//
// a model's first version, which had no version in charge
//
const NONE = { loss: null, auc_up: null, auc_beats: null, acc_up: null };

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
// each night's name under a chart, as the lines it is drawn in (#318)
//
function namesUnder(container, which) {
    return [...container.querySelectorAll(`${which} .model-night-tick`)]
        .map((tick) => [...tick.querySelectorAll('text')].map((line) => line.textContent));
}

//
// point at the attempts' chart, or one of the charts under it, at `x`. On the
// 600px a chart is drawn at here, its nights are bands of one width from its
// values' 56px gutter to its 12px right margin: of five nights, x 110 is in the
// first, 430 the fourth -- Oct 15 in timedHistoryOf, the first night with times
// -- and 540 the fifth. On a phone the charts span the whole 600px, their values
// inside them, so the first night is nearest x 40 there
//
function pointAt(container, x, which = ATTEMPTS) {
    pointAtChart(container.querySelector(`${which} .recharts-wrapper`), x);
}

//
// every popup over the charts (#300), and the one, or null where none shows
//
function popupsOf(container) {
    return [...container.querySelectorAll('.model-chart-tip')];
}

function popupOf(container) {
    return container.querySelector('.model-chart-tip');
}

//
// what a popup says: its title, each row as its name and value, and its foot
//
function readPopup(popup) {
    return {
        title: popup.querySelector('.model-tip-title').textContent,
        rows: [...popup.querySelectorAll('.model-tip-row')].map((row) => [
            row.querySelector('.model-tip-name').textContent,
            row.querySelector('.model-tip-value').textContent,
        ]),
        foot: popup.querySelector('.model-tip-foot') ? popup.querySelector('.model-tip-foot').textContent : null,
    };
}

//
// the title of the panel under the charts: the night picked (#318)
//
function pickedTitle(container) {
    return container.querySelector('.model-night-panel .model-night-title').textContent;
}

//
// the band a chart tints over the night picked, as its left edge and its width
// in px (#318)
//
function bandOf(container, which) {
    const area = container.querySelector(`${which} .recharts-reference-area path`);
    const [x, width] = area.getAttribute('d').match(/-?[\d.]+/g).map(Number).filter((each, at) => at === 0 || at === 2);

    return { x: x, width: width };
}

//
// the nights' buttons over their names under the attempts (#318)
//
function nightButtons() {
    return within(screen.getByRole('group', { name: 'Nights' })).getAllByRole('button');
}

//
// the next turn of the event loop, after which a popup's click-away listener
// takes clicks: MUI's starts listening a turn after it mounts
//
async function nextTurn() {
    await act(async () => {
        await new Promise((done) => setTimeout(done, 0));
    });
}

//
// how tall a chart is drawn, in px (#300), and whether nights' names are drawn
// under it
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

        expect(attemptPoints(rows, 'loss')[0]).toMatchObject({ attempt: null, gap: null, baselineGap: null, lossGaps: { guess: null, charge: null } });
    });

    it('signs each night against the simple guess too, on the score picked, and against both on loss whatever is picked (#318)', () => {
        const points = attemptPoints(ptOptionsHistory(), 'profit_auc');

        expect(points[3].baselineGap).toBeCloseTo(0.7329 - 0.6258);
        expect(points[3].lossGaps.guess).toBeCloseTo(0.046);
        expect(points[3].lossGaps.charge).toBeCloseTo(0.0013);
        expect(points[4].lossGaps.guess).toBeCloseTo(-0.0127);
    });

    it('carries the morning each night was tested, the morning the version it started from took over, its test days and how many earlier days it studied (#318)', () => {
        const points = attemptPoints(ptOptionsHistory(), 'loss');

        expect(points[3]).toMatchObject({
            day: '2026-10-26',
            tested: '2026-10-27',
            from: '2026-10-24',
            test: ['2026-10-20', '2026-10-21', '2026-10-22'],
            studied: 10,
            first: false,
        });
    });

    it('carries each kind of day a night\'s history lists, and none of any it lists none of (#318)', () => {
        const rows = ptOptionsHistory();

        rows[3] = { ...rows[3], studied_days: ['2026-10-06', '2026-10-08'], stopping_days: ['2026-10-05'], unpicked_days: ['2026-10-09'] };

        const points = attemptPoints(rows, 'loss');

        expect(points[3].days).toEqual({
            studied: ['2026-10-06', '2026-10-08'],
            stopping: ['2026-10-05'],
            skipped: [],
            pending: [],
            unpicked: ['2026-10-09'],
        });
        expect(points[4].days).toEqual({ studied: [], stopping: [], skipped: [], pending: [], unpicked: [] });
    });

    it('calls a night with no version in charge a first version, and none from a history without the day lists (#318)', () => {
        const [first] = attemptPoints(historyOf(1, { 0: { live: NONE, held_out_days: undefined, training_days: undefined } }), 'loss');

        expect(first).toMatchObject({ first: true, test: [], studied: null });
    });

    it('splits a night with times into its training and the scoring after it, in seconds (#247)', () => {
        const points = attemptPoints(timedHistoryOf(), 'loss');

        expect(points[3]).toMatchObject({ day: '2026-10-15', started: '2026-10-16T07:58:10+00:00', training: 437.2, again: null, note: '' });
        expect(points[3].scoring).toBeCloseTo(95.2);
        expect(points[3].took).toBeCloseTo(532.4);
        expect(points[4].training + points[4].scoring).toBeCloseTo(592.4);
    });

    it('counts the fine-tuning in the whole time, with the note saying what the time is made of (#318, #324)', () => {
        const point = attemptPoints(ptGnnHistory(), 'loss')[12];

        expect(point.again).toBe(657.7);
        expect(point.took).toBeCloseTo(3250.2);
        expect(point.note).toBe('43 min 13 s for the new version’s training and test, then 10 min 58 s fine-tuning it.');
    });

    it('has none of them for a night without times, one with only one of them, or a total under its training', () => {
        const points = attemptPoints(timedHistoryOf({ 3: { total_seconds: 400 }, 4: { training_seconds: null, trained_again_seconds: 600 } }), 'loss');

        points.forEach((point) => {
            expect(point).toMatchObject({ training: null, scoring: null, again: null, took: null, note: '' });
        });
        expect(points[0].started).toBeNull();
    });

    it('has none of them for a night from a history read before the times were kept', () => {
        const [{ started, training_seconds, total_seconds, ...older }] = historyOf(1);

        expect(attemptPoints([older], 'loss')[0]).toMatchObject({ started: null, training: null, scoring: null, took: null });
    });

    it('counts no second pass whose time is below zero or not a number (#318)', () => {
        const points = attemptPoints(timedHistoryOf({ 3: { trained_again_seconds: -5 }, 4: { trained_again_seconds: 'soon' } }), 'loss');

        expect(points.map((point) => point.again)).toEqual([null, null, null, null, null]);
        expect(points[3].took).toBeCloseTo(532.4);
        expect(points[4].note).toBe('');
    });
});

describe('durationUnit', () => {
    //
    // the nights of a history whose one night took `seconds`, and `again` more
    // where it trained again
    //
    function took(seconds, again = null) {
        return attemptPoints(historyOf(1, { 0: { training_seconds: seconds * 0.8, total_seconds: seconds, trained_again_seconds: again } }), 'loss');
    }

    it('is seconds up to two minutes, minutes up to two hours, and hours once the longest night passes them (#251)', () => {
        expect(durationUnit(took(2.6))).toEqual({ seconds: 1, label: 's' });
        expect(durationUnit(took(120))).toEqual({ seconds: 1, label: 's' });
        expect(durationUnit(took(120.1))).toEqual({ seconds: 60, label: 'min' });
        expect(durationUnit(took(7200))).toEqual({ seconds: 60, label: 'min' });
        expect(durationUnit(took(7200.1))).toEqual({ seconds: 3600, label: 'h' });
    });

    it('counts a second pass in the longest night (#318)', () => {
        expect(durationUnit(took(100, 30))).toEqual({ seconds: 60, label: 'min' });
    });

    it('is seconds for nights without times', () => {
        expect(durationUnit(attemptPoints(historyOf(), 'loss'))).toEqual({ seconds: 1, label: 's' });
    });
});

describe('attemptsAbout (#300, #318)', () => {
    it('says what each night\'s test is, that lower is better on loss, and what decides', () => {
        expect(attemptsAbout('loss')).toBe(ABOUT);
    });

    it('says higher is better on a score where it is', () => {
        expect(attemptsAbout('profit_auc')).toBe(ABOUT.replace('Lower is better.', 'Higher is better.'));
    });

    it('adds, for a stock model with holds, that these are the 1-day hold\'s scores, which the hold picker does not move', () => {
        expect(attemptsAbout('loss', true)).toBe(`${ABOUT} ${HELD}`);
    });
});

describe('axisLabel (#318)', () => {
    it('says over the chart what its axis is, which way is better, and where the best numbers sit', () => {
        expect(axisLabel('loss')).toBe('Loss on the 3 test days · lower is better, so the smallest numbers are at the top');
        expect(axisLabel('auc_up')).toBe('Up/down AUC on the 3 test days · higher is better');
    });
});

describe('tookAbout (#318)', () => {
    it('says which part of a bar is which, and why a weekly retrain stands taller, as it did', () => {
        expect(tookAbout(false)).toBe('Training, then scoring the test days in a lighter teal. A weekly retrain starts from scratch, so its bar stands taller.');
    });

    it('says what the part on top is where a night was fine-tuned, by that name (#324)', () => {
        expect(tookAbout(true)).toBe('Training, then scoring the test days in a lighter teal. On a night with fine-tuning, it sits on top in dark teal.');
    });

    it('names the teals as a dark page draws them', () => {
        expect(tookAbout(true, true)).toBe('Training, then scoring the test days in a darker teal. On a night with fine-tuning, it sits on top in light teal.');
        expect(tookAbout(false, true)).toMatch(/^Training, then scoring the test days in a darker teal\. A weekly retrain/);
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

describe('NightTick (#318)', () => {
    const colors = chartColors('light');
    const nights = { '2026-10-26': { day: '2026-10-26', tested: '2026-10-27' } };

    function tick(props) {
        const { container } = render(<svg><NightTick x={40} y={10} payload={{ value: '2026-10-26' }} nights={nights} colors={colors} {...props} /></svg>);

        return [...container.querySelectorAll('text')];
    }

    it('names a night by the morning its test ran, in the page\'s ink, over the market day it was tested after, muted', () => {
        const [morning, after] = tick();

        expect(morning).toHaveTextContent('Tue Oct 27');
        expect(morning).toHaveAttribute('fill', colors.ink);
        expect(after).toHaveTextContent('after Mon Oct 26');
        expect(after).toHaveAttribute('fill', colors.muted);
    });

    it('names it by the morning alone, `short`', () => {
        expect(tick({ short: true }).map((line) => line.textContent)).toEqual(['Tue Oct 27']);
    });

    it('draws nothing for a night it does not know, or no place to put it', () => {
        expect(tick({ payload: { value: '2026-10-27' } })).toEqual([]);
        expect(tick({ x: NaN })).toEqual([]);
    });
});

describe('the chart', () => {
    it('draws a mark for every night: filled where it took over, hollow where it was kept back, a diamond for a weekly retrain', () => {
        const { container } = draw({
            rows: historyOf(4, { 1: { went_live: true }, 2: { kind: 'weekly' }, 3: { kind: 'weekly', went_live: true } }),
        });

        expect(container.querySelectorAll('.model-attempt')).toHaveLength(4);
        expect(container.querySelectorAll('.model-attempt-nightly.model-attempt-kept')).toHaveLength(1);
        expect(container.querySelectorAll('.model-attempt-nightly.model-attempt-live')).toHaveLength(1);
        expect(container.querySelectorAll('.model-attempt-weekly.model-attempt-kept')).toHaveLength(1);
        expect(container.querySelectorAll('.model-attempt-weekly.model-attempt-live')).toHaveLength(1);
    });

    it('draws pt-options\' Oct 27 night, kept back behind the simple guess, as a ring (#318)', () => {
        const { container } = draw({ rows: ptOptionsHistory() });
        const marks = container.querySelectorAll('.model-attempt');

        expect(marks[4]).toHaveClass('model-attempt-nightly', 'model-attempt-kept');
        expect(marks[3]).toHaveClass('model-attempt-nightly', 'model-attempt-live');
    });

    it('asks under its title whether each night\'s new version beat the one in charge, says what the test is, and when the newest ran (#318)', () => {
        const { container } = draw({ rows: ptOptionsHistory() });

        expect(screen.getByRole('heading', { name: TITLE })).toBeInTheDocument();
        expect(TITLE).toBe('Did each night’s new version beat the one in charge?');
        expect(container.querySelector('.model-card-head .model-card-sub')).toHaveTextContent(ABOUT);
        expect(container.querySelector('.model-attempts-top .model-attempts-newest')).toHaveTextContent(/^Newest test: Wed Oct 28, 5:39 AM ET$/);
        expect(screen.queryByText(/the hold picker doesn’t move this card/)).toBeNull();
    });

    it('says nothing of the newest test where its night has no start', () => {
        const { container } = draw({ rows: historyOf() });

        expect(container.querySelector('.model-attempts-newest')).toBeNull();
    });

    it('says too, for a stock model with holds, that these are its 1-day hold\'s scores (#300)', () => {
        const { container } = draw({ held: true });

        expect(container.querySelector('.model-card-head .model-card-sub')).toHaveTextContent(`${ABOUT} ${HELD}`);
    });

    it('flips the loss axis, so the smallest numbers are at the top, and says so over the chart (#300, #318)', () => {
        const { container } = draw({ score: 'loss' });
        const ticks = yTicks(container);
        const top = ticks.reduce((a, b) => (a.y < b.y ? a : b));
        const bottom = ticks.reduce((a, b) => (a.y > b.y ? a : b));

        expect(top.value).toBeLessThan(bottom.value);
        expect(container.querySelector('.model-axis-label')).toHaveTextContent('Loss on the 3 test days · lower is better, so the smallest numbers are at the top');
        expect(container.querySelector('.model-legend-note')).toBeNull();
    });

    it('leaves every other score\'s axis the right way up, saying higher is better over it and under the title (#318)', () => {
        const { container } = draw({ score: 'profit_auc', rows: ptOptionsHistory() });
        const ticks = yTicks(container);
        const top = ticks.reduce((a, b) => (a.y < b.y ? a : b));
        const bottom = ticks.reduce((a, b) => (a.y > b.y ? a : b));

        expect(top.value).toBeGreaterThan(bottom.value);
        expect(container.querySelector('.model-axis-label')).toHaveTextContent(/^Profit AUC on the 3 test days · higher is better$/);
        expect(container.querySelector('.model-card-head .model-card-sub')).toHaveTextContent('Higher is better.');
        expect(screen.queryByText(/smallest numbers/)).toBeNull();
    });

    it('draws a bar up in the better color for a night that beat the simple guess, and down in the worse one for a miss (#318)', () => {
        const { container } = draw({
            rows: historyOf(2, { 0: { attempt: { loss: 1.7, auc_up: 0.5, auc_beats: 0.5, acc_up: 0.5 } } }),
        });
        const colors = chartColors('light');

        expect(container.querySelector('.model-gap-bar-worse')).toHaveAttribute('fill', colors.worse);
        expect(container.querySelector('.model-gap-bar-better')).toHaveAttribute('fill', colors.better);
    });

    it('draws a night that beat the simple guess as better, though it lost to the version in charge (#318)', () => {
        const { container } = draw({ rows: historyOf(1) });

        expect(container.querySelectorAll('.model-gap-bar-better')).toHaveLength(1);
        expect(container.querySelector('.model-gap-bar-worse')).toBeNull();
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

    it('titles the bars by how far each new version beat or missed the simple guess (#318)', () => {
        const { container } = draw();

        expect([...container.querySelectorAll('.model-card-minor')].map((title) => title.textContent))
            .toEqual(['How far each new version beat or missed the simple guess']);
    });

    it('says, on a score other than loss, that a new version kept back can still be better (#318)', () => {
        draw({ score: 'acc_up' });

        expect(screen.getByText('Taking over is decided by loss, so on this score a new version kept back can still show as better.')).toBeInTheDocument();
    });

    it('says nothing of it on loss, which is what decides', () => {
        draw({ score: 'loss' });

        expect(screen.queryByText(/Taking over is decided by loss/)).toBeNull();
    });

    it('draws in the dark theme\'s colors on a dark page', () => {
        const { container } = draw({ rows: historyOf(1, { 0: { went_live: true } }) }, 'dark');

        expect(container.querySelectorAll('.model-attempt circle')[1]).toHaveAttribute('fill', chartColors('dark').better);
    });

    it('draws the version in charge in green and the simple guess dashed in amber, each with a dot on each night (#251, #318)', () => {
        const { container } = draw();
        const colors = chartColors('light');
        const [baseline, live] = container.querySelectorAll(`${ATTEMPTS} .recharts-line-curve`);
        const [baselineDots, liveDots] = container.querySelectorAll(`${ATTEMPTS} .recharts-line-dots`);

        expect(baseline).toHaveAttribute('stroke', colors.baseline);
        expect(baseline).toHaveAttribute('stroke-dasharray', '7 5');
        expect(live).toHaveAttribute('stroke', colors.live);
        expect(live).toHaveAttribute('stroke-width', '2.5');
        expect(live).not.toHaveAttribute('stroke-dasharray');
        expect(baselineDots.querySelectorAll('circle')).toHaveLength(5);
        expect(baselineDots.querySelector('circle')).toHaveAttribute('fill', colors.page);
        expect(baselineDots.querySelector('circle')).toHaveAttribute('stroke', colors.baseline);
        expect(baselineDots.querySelector('circle')).toHaveAttribute('stroke-dasharray', 'none');
        expect(liveDots.querySelectorAll('circle')).toHaveLength(5);
        expect(liveDots.querySelector('circle')).toHaveAttribute('fill', colors.live);
    });

    it('names in its legend every mark it draws in words, the new version\'s in the better color, then the version in charge and the simple guess (#318)', () => {
        draw({ rows: historyOf(3, { 0: { went_live: true }, 2: { kind: 'weekly', went_live: true } }) });

        const legend = screen.getByRole('list', { name: 'Legend' });
        const items = within(legend).getAllByRole('listitem');
        const colors = chartColors('light');

        expect(items.map((item) => item.textContent)).toEqual([
            'New version, took over',
            'New version, kept back',
            'Weekly full retrain',
            'Version in charge',
            'Simple guess from averages (the baseline)',
        ]);
        expect(items[0].querySelector('circle')).toHaveAttribute('fill', colors.better);
        expect(items[1].querySelector('circle')).toHaveAttribute('fill', 'none');
        expect(items[1].querySelector('circle')).toHaveAttribute('stroke', colors.better);
        expect(items[2].querySelector('polygon')).toHaveAttribute('fill', colors.better);
        expect(items[3].querySelector('line')).toHaveAttribute('stroke', colors.live);
        expect(items[4].querySelector('line')).toHaveAttribute('stroke', colors.baseline);
        expect(items[4].querySelector('line')).toHaveAttribute('stroke-dasharray');
    });

    it('names a weekly retrain once, as a diamond, kept back or not, and leaves out the marks of nights it has none of', () => {
        draw({ rows: historyOf(2, { 0: { kind: 'weekly' }, 1: { kind: 'weekly' } }) });

        const items = within(screen.getByRole('list', { name: 'Legend' })).getAllByRole('listitem');

        expect(items.map((item) => item.textContent)).toEqual([
            'New version, kept back',
            'Weekly full retrain',
            'Version in charge',
            'Simple guess from averages (the baseline)',
        ]);
        expect(items[1].querySelector('polygon')).toHaveAttribute('fill', chartColors('light').better);
    });

    it('names a new version that took over where only a weekly retrain did', () => {
        draw({ rows: historyOf(1, { 0: { kind: 'weekly', went_live: true } }) });

        const items = within(screen.getByRole('list', { name: 'Legend' })).getAllByRole('listitem');

        expect(items.map((item) => item.textContent)).toEqual([
            'New version, took over',
            'Weekly full retrain',
            'Version in charge',
            'Simple guess from averages (the baseline)',
        ]);
    });

    it('leaves the version in charge out of the legend while no night has one', () => {
        draw({ rows: historyOf(1, { 0: { went_live: true, live: NONE } }) });

        expect(within(screen.getByRole('list', { name: 'Legend' })).queryByText('Version in charge')).toBeNull();
    });

    it('describes itself to a screen reader, with how many took over (#318)', () => {
        draw({ rows: historyOf(3, { 0: { went_live: true } }) });

        expect(screen.getByRole('img', {
            name: 'Loss of each night’s new version, the version in charge and the simple guess, on 3 nights. 1 took over. The numbers are in the table below.',
        })).toBeInTheDocument();
        expect(screen.getByRole('img', { name: /^How much better or worse each new version scored than the simple guess on Loss\. 3 of 3 were better\.$/ })).toBeInTheDocument();
    });

    it('counts a single night as one', () => {
        draw({ rows: historyOf(1) });

        expect(screen.getByRole('img', { name: /on 1 night\. 0 took over\./ })).toBeInTheDocument();
    });
});

describe('the values\' axis (#300)', () => {
    afterEach(() => wideScreen());

    const leftOf = (container) => Number(container.querySelector(`${ATTEMPTS} .recharts-cartesian-grid-horizontal line`).getAttribute('x1'));

    const valueOf = (container) => container.querySelector(`${ATTEMPTS} .recharts-yAxis .recharts-cartesian-axis-tick-value`);

    it('sets the charts 56px in on a wide screen, their values in the gutter at their left', () => {
        const { container } = draw({ rows: timedHistoryOf() });

        expect(leftOf(container)).toBe(56);
        expect(valueOf(container)).toHaveAttribute('text-anchor', 'end');
        expect(valueOf(container)).not.toHaveAttribute('paint-order');
    });

    it('draws a phone\'s charts the card\'s whole width, their values inside them on a halo of the page, where a gutter set them well in from the card\'s edge', () => {
        phoneScreen();

        const { container } = draw({ rows: timedHistoryOf() });

        expect(leftOf(container)).toBe(0);
        expect(valueOf(container)).toHaveAttribute('text-anchor', 'start');
        expect(valueOf(container)).toHaveAttribute('font-size', '11');
        expect(valueOf(container)).toHaveAttribute('stroke', chartColors('light').page);
        expect(valueOf(container)).toHaveAttribute('paint-order', 'stroke');
    });
});

describe('the nights\' names (#318)', () => {
    // a fold is kept, as a reader's is: none is left for the cases after these
    beforeEach(() => window.localStorage.clear());
    afterEach(() => window.localStorage.clear());

    it('names each night under the attempts by the morning its test ran, over the market day it was tested after', () => {
        const { container } = draw({ rows: ptOptionsHistory() });

        expect(namesUnder(container, ATTEMPTS)).toEqual([
            ['Thu Oct 22', 'after Wed Oct 21'],
            ['Fri Oct 23', 'after Thu Oct 22'],
            ['Sat Oct 24', 'after Fri Oct 23'],
            ['Tue Oct 27', 'after Mon Oct 26'],
            ['Wed Oct 28', 'after Tue Oct 27'],
        ]);
    });

    it('names each night under how long each attempt took by the morning alone, and none under the bars between them', () => {
        const { container } = draw({ rows: ptOptionsHistory() });

        expect(namesUnder(container, TOOK)).toEqual([['Thu Oct 22'], ['Fri Oct 23'], ['Sat Oct 24'], ['Tue Oct 27'], ['Wed Oct 28']]);
        expect([ATTEMPTS, GAP, TOOK].map((which) => hasAxis(container, which))).toEqual([true, false, true]);
    });

    it('makes the attempts 280px tall and how long each took 160px, each with room for its names under it, and the bars 90px', () => {
        const { container } = draw({ rows: timedHistoryOf() });

        expect([ATTEMPTS, GAP, TOOK].map((which) => heightOf(container, which))).toEqual([320, 90, 184]);
    });

    it('keeps the names under the attempts where no night has times', () => {
        const { container } = draw({ rows: historyOf() });

        expect([ATTEMPTS, GAP].map((which) => hasAxis(container, which))).toEqual([true, false]);
        expect([ATTEMPTS, GAP].map((which) => heightOf(container, which))).toEqual([320, 90]);
    });

    it('sets each night in a band of one width in every chart, so its mark sits over its bars and its name', () => {
        const { container } = draw({ rows: timedHistoryOf() });
        const middle = (bar) => Number(bar.getAttribute('x')) + Number(bar.getAttribute('width')) / 2;
        const marks = [...container.querySelectorAll('.model-attempt circle:last-child')].map((dot) => Number(dot.getAttribute('cx')));
        const bars = [...container.querySelectorAll('.model-gap-bar')].map(middle);
        const names = [...container.querySelectorAll(`${ATTEMPTS} .model-night-tick text:first-child`)].map((name) => Number(name.getAttribute('x')));

        expect(marks).toHaveLength(5);
        marks.forEach((mark, at) => {
            expect(Math.abs(mark - bars[at])).toBeLessThan(1);
            expect(Math.abs(names[at] - mark)).toBeLessThan(1);
        });
    });
});

describe('the night picked (#318)', () => {
    afterEach(wideScreen);

    it('picks the newest night first, tinting its band in all three charts and showing it in the panel under them', () => {
        const { container } = draw({ rows: timedHistoryOf() });

        expect(pickedTitle(container)).toBe('Sat Oct 17 · nightly update');
        [ATTEMPTS, GAP, TOOK].forEach((which) => {
            const band = bandOf(container, which);

            expect(band.x).toBeCloseTo(481.6);
            expect(band.width).toBeCloseTo(106.4);
        });
        expect(container.querySelector(`${ATTEMPTS} .recharts-reference-area path`)).toHaveAttribute('fill', chartColors('light').better);
        expect(container.querySelector(`${ATTEMPTS} .recharts-reference-area path`)).toHaveAttribute('fill-opacity', '0.1');
    });

    it.each([
        ['the attempts', ATTEMPTS],
        ['the bars', GAP],
        ['how long each took', TOOK],
    ])('picks the night pointed at over %s, in every chart', (name, which) => {
        const { container } = draw({ rows: timedHistoryOf() });

        pointAt(container, 110, which);

        expect(pickedTitle(container)).toBe('Tue Oct 13 · nightly update');
        expect(bandOf(container, ATTEMPTS).x).toBeCloseTo(56);
        expect(bandOf(container, TOOK).x).toBeCloseTo(56);
    });

    it('keeps the night picked as the pointer leaves, so the panel stays where it is', () => {
        const { container } = draw({ rows: timedHistoryOf() });

        pointAt(container, 430);
        fireEvent.mouseLeave(container.querySelector(`${ATTEMPTS} .recharts-wrapper`));

        expect(pickedTitle(container)).toBe('Fri Oct 16 · nightly update');
    });

    it('picks the night tapped on a phone', () => {
        phoneScreen();

        const { container } = draw({ rows: timedHistoryOf() });

        tapAt(container.querySelector(`${ATTEMPTS} .recharts-wrapper`), 40);

        expect(pickedTitle(container)).toBe('Tue Oct 13 · nightly update');
    });

    it('lays the nights over their names under the attempts as buttons, the one picked pressed and the one the keyboard reaches by Tab', () => {
        draw({ rows: timedHistoryOf() });

        const buttons = nightButtons();

        expect(buttons).toHaveLength(5);
        expect(buttons[0]).toHaveAccessibleName('Tue Oct 13, after Mon Oct 12: kept back');
        expect(buttons.map((button) => button.getAttribute('aria-pressed'))).toEqual(['false', 'false', 'false', 'false', 'true']);
        expect(buttons.map((button) => button.getAttribute('tabindex'))).toEqual(['-1', '-1', '-1', '-1', '0']);
        expect(screen.getByRole('group', { name: 'Nights' }).closest('.model-chart-frame').querySelector(ATTEMPTS)).not.toBeNull();
    });

    it('picks a night tabbed to', () => {
        const { container } = draw({ rows: timedHistoryOf() });

        act(() => nightButtons()[1].focus());

        expect(pickedTitle(container)).toBe('Wed Oct 14 · nightly update');
        expect(nightButtons()[1]).toHaveAttribute('aria-pressed', 'true');
        expect(nightButtons()[1]).toHaveAttribute('tabindex', '0');
        expect(nightButtons()[4]).toHaveAttribute('tabindex', '-1');
    });

    it('moves the night picked and the focus along the nights by the arrow keys, Home and End', () => {
        const { container } = draw({ rows: timedHistoryOf() });

        act(() => nightButtons()[4].focus());
        fireEvent.keyDown(nightButtons()[4], { key: 'ArrowLeft' });

        expect(pickedTitle(container)).toBe('Fri Oct 16 · nightly update');
        expect(document.activeElement).toBe(nightButtons()[3]);

        fireEvent.keyDown(nightButtons()[3], { key: 'Home' });

        expect(pickedTitle(container)).toBe('Tue Oct 13 · nightly update');
        expect(document.activeElement).toBe(nightButtons()[0]);

        fireEvent.keyDown(nightButtons()[0], { key: 'ArrowLeft' });

        expect(pickedTitle(container)).toBe('Tue Oct 13 · nightly update');

        fireEvent.keyDown(nightButtons()[0], { key: 'ArrowRight' });

        expect(pickedTitle(container)).toBe('Wed Oct 14 · nightly update');
        expect(document.activeElement).toBe(nightButtons()[1]);

        fireEvent.keyDown(nightButtons()[1], { key: 'End' });

        expect(pickedTitle(container)).toBe('Sat Oct 17 · nightly update');
        expect(document.activeElement).toBe(nightButtons()[4]);
    });

    it('lets any other key be', () => {
        const { container } = draw({ rows: timedHistoryOf() });

        act(() => nightButtons()[2].focus());
        fireEvent.keyDown(nightButtons()[2], { key: 'a' });

        expect(pickedTitle(container)).toBe('Thu Oct 15 · nightly update');
        expect(document.activeElement).toBe(nightButtons()[2]);
    });

    it('picks a night under the pointer, or clicked, on the nights\' names', () => {
        const { container } = draw({ rows: timedHistoryOf() });

        fireEvent.mouseEnter(nightButtons()[2]);

        expect(pickedTitle(container)).toBe('Thu Oct 15 · nightly update');

        fireEvent.click(nightButtons()[0]);

        expect(pickedTitle(container)).toBe('Tue Oct 13 · nightly update');
    });

    it('says how to pick a night, over the panel: by pointing or tabbing on a computer, and by tapping on a phone', () => {
        const wide = draw({ rows: timedHistoryOf() });

        expect(wide.container.querySelector('.model-attempts-hint'))
            .toHaveTextContent(/^Point at a night in any of the charts, or tab to it, to see which days it used and how long it took\.$/);
        expect(wide.container.querySelector('.model-attempts-hint').nextElementSibling).toHaveClass('model-night-panel');
        wide.unmount();

        phoneScreen();

        const phone = draw({ rows: timedHistoryOf() });

        expect(phone.container.querySelector('.model-attempts-hint'))
            .toHaveTextContent(/^Tap a night in any of the charts to see which days it used and how long it took\.$/);
    });
});

describe('the panel of the night picked (#318)', () => {
    //
    // the panel's three boxes, each its name and its value
    //
    const boxesOf = (container) => [...container.querySelectorAll('.model-night-box')].map((box) => [
        box.querySelector('.model-night-box-name').textContent,
        box.querySelector('.model-night-box-value').textContent,
    ]);

    it('shows pt-options\' Oct 26 night, tested early Tue Oct 27: its three scores, that it took over, by how much on loss, and its test days', () => {
        const { container } = draw({ rows: ptOptionsHistory() });

        pointAt(container, 430);

        const panel = container.querySelector('.model-night-panel');

        expect(pickedTitle(container)).toBe('Tue Oct 27 · nightly update');
        expect(panel.querySelector('.model-night-sub')).toHaveTextContent('Tested after the market closed on Mon Oct 26.');
        expect(boxesOf(container)).toEqual([['New version', '0.576'], ['Version in charge', '0.577'], ['Simple guess', '0.622']]);
        expect(panel.querySelector('.model-night-result')).toHaveTextContent('Took over. On loss it beat the simple guess by 0.046 and the version in charge by 0.001.');
        expect(panel).toHaveTextContent('Started from the version that took over Sat Oct 24.');
        expect(panel.querySelector('.model-day-lists')).toHaveTextContent('Studied or used to stop10 earlier daysTestOct 20, 21 and 22');
    });

    it('draws the full strip of the night picked where the history lists its days, as the trainer is to', () => {
        const rows = ptOptionsHistory();

        rows[4] = {
            ...rows[4],
            studied_days: ['2026-10-05', '2026-10-06', '2026-10-08', '2026-10-09', '2026-10-14', '2026-10-15', '2026-10-19', '2026-10-20'],
            stopping_days: ['2026-10-07', '2026-10-12', '2026-10-13'],
            skipped_days: ['2026-10-16'],
            pending_days: ['2026-10-26', '2026-10-27'],
        };

        const { container } = draw({ rows: rows });
        const panel = container.querySelector('.model-night-panel');

        expect(panel.querySelector('.model-day-rows')).not.toBeNull();
        expect(panel.querySelectorAll('.model-day-row .model-day-studied')).toHaveLength(8);
        expect([...panel.querySelectorAll('.model-day-lists dt')].map((name) => name.textContent))
            .toEqual(['Studied', 'Used to decide when to stop', 'Test', 'Skipped', 'Results not in yet']);
        expect(panel.querySelector('.model-day-lists')).toHaveTextContent('Used to decide when to stopOct 7, 12 and 13');
    });

    it('shows pt-options\' newest night first, kept back behind the simple guess though it beat the version in charge', () => {
        const { container } = draw({ rows: ptOptionsHistory() });
        const result = container.querySelector('.model-night-result');

        expect(pickedTitle(container)).toBe('Wed Oct 28 · nightly update');
        expect(boxesOf(container)).toEqual([['New version', '0.609'], ['Version in charge', '0.624'], ['Simple guess', '0.597']]);
        expect(result.querySelector('.model-night-pill-kept')).toHaveTextContent(/^Kept back$/);
        expect(result).toHaveTextContent('Kept back. On loss it lost to the simple guess by 0.013 and beat the version in charge by 0.014.');
    });

    it('shows a model\'s first version with no version in charge, and no gap to one', () => {
        const { container } = draw({ rows: ptOptionsHistory() });

        pointAt(container, 110);

        expect(pickedTitle(container)).toBe('Thu Oct 22 · first version');
        expect(boxesOf(container)[1]).toEqual(['Version in charge', 'none yet']);
        expect(container.querySelector('.model-night-result')).toHaveTextContent('Took over. On loss it lost to the simple guess by 0.062.');
        expect(container.querySelector('.model-night-result')).not.toHaveTextContent(/version in charge/);
        expect(container.querySelector('.model-night-panel')).toHaveTextContent('Built from scratch.');
    });

    it('shows the score picked in its boxes, and what came of the night on loss, which decides', () => {
        const { container } = draw({ rows: ptOptionsHistory(), score: 'profit_auc' });

        pointAt(container, 430);

        expect(boxesOf(container)).toEqual([['New version', '0.733'], ['Version in charge', '0.733'], ['Simple guess', '0.626']]);
        expect(container.querySelector('.model-night-result')).toHaveTextContent('On loss it beat the simple guess by 0.046 and the version in charge by 0.001.');
    });

    it('names each box after its mark, as the chart draws it', () => {
        const { container } = draw({ rows: ptOptionsHistory() });
        const colors = chartColors('light');
        const marks = [...container.querySelectorAll('.model-night-box-name svg.model-mark')];

        expect(marks).toHaveLength(3);
        expect(marks[0].querySelector('circle')).toHaveAttribute('stroke', colors.better);
        expect(marks[1].querySelector('line')).toHaveAttribute('stroke', colors.live);
        expect(marks[2].querySelector('line')).toHaveAttribute('stroke', colors.baseline);
    });

    it('shows a night without day lists by its test days and a count of the rest alone', () => {
        const { container } = draw({ rows: ptOptionsHistory() });

        pointAt(container, 430);

        const days = container.querySelector('.model-night-days');

        expect([...days.querySelectorAll('.model-day')].map((day) => day.textContent)).toEqual(['20', '21', '22']);
        expect(days.querySelectorAll('.model-day-test')).toHaveLength(4);
        expect(days.querySelector('.model-day-legend')).toHaveTextContent(/^Test, never studied$/);
        expect([...days.querySelectorAll('dt')].map((name) => name.textContent)).toEqual(['Studied or used to stop', 'Test']);
    });

    it('says how long pt-gnn\'s Oct 27 night took in all, its fine-tuning among its parts (#318, #324)', () => {
        const { container } = draw({ rows: ptGnnHistory() });

        expect(container.querySelector('.model-night-panel')).toHaveTextContent(
            'How long it took: 54 min 10 s in all: 41 min 36 s training, 1 min 37 s scoring the test days, then 10 min 58 s fine-tuning. Started Wed Oct 28, 4:43 AM ET.'
        );
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

    it('sits under the bars of better or worse, saying which part is which and why a weekly retrain stands taller, over a key of its parts (#318)', () => {
        const { container } = draw({ rows: timedHistoryOf() });
        const titles = [...container.querySelectorAll('.model-card-minor')].map((title) => title.textContent);
        const title = screen.getByRole('heading', { name: 'How long each attempt took' });
        const key = screen.getByRole('list', { name: 'Legend, how long each attempt took' });

        expect(titles).toEqual(['How far each new version beat or missed the simple guess', 'How long each attempt took']);
        expect(title.nextElementSibling).toHaveTextContent(
            'Training, then scoring the test days in a lighter teal. A weekly retrain starts from scratch, so its bar stands taller.'
        );
        expect(title.nextElementSibling.nextElementSibling).toBe(key);
        expect(key.nextElementSibling).toHaveClass('model-chart-took');
        expect(within(key).getAllByRole('listitem').map((item) => item.textContent)).toEqual(['Training', 'Scoring the test days']);
    });

    it('is left out while no night has times, as a history without them is drawn today', () => {
        const { container } = draw({ rows: historyOf() });

        expect(screen.queryByText('How long each attempt took')).toBeNull();
        expect(screen.queryByText(/lighter teal/)).toBeNull();
        expect(screen.queryByRole('list', { name: 'Legend, how long each attempt took' })).toBeNull();
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

        expect(screen.getByRole('img', {
            name: 'How long each attempt took, training and then scoring, on the 2 nights with times. The longest took 9 min 52 s.',
        })).toBeInTheDocument();
    });

    it('counts a single night with times as one', () => {
        draw({ rows: historyOf(11) });

        expect(screen.getByRole('img', { name: /on the 1 night with times\. The longest took 8 min 52 s\.$/ })).toBeInTheDocument();
    });
});

describe('the fine-tuning in how long each attempt took (#318, #324)', () => {
    //
    // pt-gnn's Oct 27 night, the newest and last, at the right of its 13 bands:
    // trained for 2495.8 s, scored by 2592.5 s, then trained again for 657.7 s
    //
    const LAST = 567;

    it('stacks the second pass on top of pt-gnn\'s Oct 27 bar, in a teal of its own', () => {
        const { container } = draw({ rows: ptGnnHistory() });
        const again = [...container.querySelectorAll('.model-took-again')];
        const scoring = [...container.querySelectorAll('.model-took-scoring')].pop();

        expect(again).toHaveLength(1);
        expect(again[0]).toHaveAttribute('fill', chartColors('light').tookAgain);
        expect(Number(again[0].getAttribute('y')) + Number(again[0].getAttribute('height'))).toBeCloseTo(Number(scoring.getAttribute('y')));
    });

    it('draws it in the dark theme\'s teal on a dark page', () => {
        const { container } = draw({ rows: ptGnnHistory() }, 'dark');

        expect(container.querySelector('.model-took-again')).toHaveAttribute('fill', chartColors('dark').tookAgain);
    });

    it('rounds the top of whichever part is on top: the second pass, where there is one, and the scoring elsewhere', () => {
        const { container } = draw({ rows: ptGnnHistory() });
        const scoring = [...container.querySelectorAll('.model-took-scoring')];
        const arced = (bar) => /A/.test(bar.getAttribute('d'));

        expect(arced(container.querySelector('.model-took-again'))).toBe(true);
        expect(arced(scoring[scoring.length - 1])).toBe(false);
        expect(arced(scoring[scoring.length - 2])).toBe(true);
    });

    it('says under its title what the part on top is, and keys it', () => {
        draw({ rows: ptGnnHistory() });

        const title = screen.getByRole('heading', { name: 'How long each attempt took' });
        const key = screen.getByRole('list', { name: 'Legend, how long each attempt took' });
        const items = within(key).getAllByRole('listitem');

        expect(title.nextElementSibling).toHaveTextContent(
            'Training, then scoring the test days in a lighter teal. On a night with fine-tuning, it sits on top in dark teal.'
        );
        expect(items.map((item) => item.textContent)).toEqual(['Training', 'Scoring the test days', 'Fine-tuning']);
        expect(items[2].querySelector('rect')).toHaveAttribute('fill', chartColors('light').tookAgain);
    });

    it('names its teals as a dark page draws them', () => {
        draw({ rows: ptGnnHistory() }, 'dark');

        expect(screen.getByRole('heading', { name: 'How long each attempt took' }).nextElementSibling).toHaveTextContent(
            'Training, then scoring the test days in a darker teal. On a night with fine-tuning, it sits on top in light teal.'
        );
    });

    it('describes the fine-tuning to a screen reader, and counts it in the longest night', () => {
        draw({ rows: timedHistoryOf({ 3: { went_live: true, trained_again: true, trained_again_seconds: 600 } }) });

        expect(screen.getByRole('img', {
            name: 'How long each attempt took, training and then scoring, and then fine-tuning where a night had it, on the 2 nights with times. The longest took 18 min 52 s.',
        })).toBeInTheDocument();
    });

    it('gives pt-gnn\'s Oct 27 night a row for its fine-tuning in its popup, and counts it in all', () => {
        const { container } = draw({ rows: ptGnnHistory() });

        pointAt(container, LAST, TOOK);

        expect(readPopup(popupOf(container))).toEqual({
            title: 'Wed Oct 28 · nightly update',
            rows: [['Training', '41 min 36 s'], ['Scoring', '1 min 37 s'], ['Fine-tuning', '10 min 58 s']],
            foot: '54 min 10 s in all, started Wed Oct 28, 4:43 AM ET',
        });
        expect(popupOf(container).querySelectorAll('.model-tip-row rect')[2]).toHaveAttribute('fill', chartColors('light').tookAgain);
    });

    it('names it fine-tuning everywhere, and never a second pass nor training again (#324)', () => {
        const { container } = draw({ rows: ptGnnHistory() });

        pointAt(container, LAST, TOOK);

        expect(readPopup(popupOf(container)).rows.map(([name]) => name)).toContain('Fine-tuning');
        expect(document.body.textContent).not.toMatch(/second pass|training again|training it again/i);
        expect(screen.getByRole('img', { name: /How long each attempt took/ }).getAttribute('aria-label')).not.toMatch(/second pass|again/i);
    });

    it('leaves a history with no fine-tuning as it was: no third part, no key for one, no row for one', () => {
        const { container } = draw({ rows: ptOptionsHistory() });

        pointAt(container, 430, TOOK);

        expect(container.querySelector('.model-took-again')).toBeNull();
        expect(screen.queryByText('Fine-tuning')).toBeNull();
        expect(readPopup(popupOf(container)).rows.map(([name]) => name)).toEqual(['Training', 'Scoring']);
        expect(screen.getByRole('img', { name: /^How long each attempt took, training and then scoring, on the 5 nights/ })).toBeInTheDocument();
    });
});

describe('the popups (#300)', () => {
    afterEach(wideScreen);

    it('draws none until a chart is pointed at', () => {
        const { container } = draw({ rows: timedHistoryOf() });

        expect(popupsOf(container)).toEqual([]);
        expect(container.querySelector('.model-readout')).toBeNull();
    });

    it('gives over the attempts the night pointed at and its three numbers alone, each after its mark (#318)', () => {
        const { container } = draw({ rows: timedHistoryOf() });

        pointAt(container, 110);

        const popup = popupOf(container);

        expect(popupsOf(container)).toHaveLength(1);
        expect(container.querySelector(ATTEMPTS).contains(popup)).toBe(true);
        expect(popup).toHaveClass('model-tip');
        expect(readPopup(popup)).toEqual({
            title: 'Tue Oct 13 · nightly update',
            rows: [['New version', '1.610'], ['Version in charge', '1.600'], ['Simple guess', '1.660']],
            foot: null,
        });
        expect(popup.querySelectorAll('.model-tip-row svg.model-mark')).toHaveLength(3);
        expect(popup.querySelector('.model-tip-row circle')).toHaveAttribute('stroke', chartColors('light').better);
    });

    it('draws one popup at a time: the charts that share the night pointed at show none', () => {
        const { container } = draw({ rows: timedHistoryOf() });

        pointAt(container, 430, GAP);

        expect(popupsOf(container)).toHaveLength(1);
        expect(container.querySelector(GAP).contains(popupOf(container))).toBe(true);
        expect(container.querySelector(ATTEMPTS).querySelector('.model-chart-tip')).toBeNull();
        expect(container.querySelector(TOOK).querySelector('.model-chart-tip')).toBeNull();
    });

    it('takes the popup away when the pointer leaves the chart', () => {
        const { container } = draw({ rows: timedHistoryOf() });

        pointAt(container, 430);

        expect(popupOf(container)).not.toBeNull();

        fireEvent.mouseLeave(container.querySelector(`${ATTEMPTS} .recharts-wrapper`));

        expect(popupOf(container)).toBeNull();
    });

    it.each([
        ['missed', { attempt: { loss: 1.7, auc_up: 0.6, auc_beats: 0.5, acc_up: 0.5 } }, chartColors('light').worse, '0.040 worse than the simple guess', '0.100 worse than the version in charge', 'Kept back'],
        ['beat', { went_live: true }, chartColors('light').better, '0.050 better than the simple guess', '0.010 worse than the version in charge', 'Took over'],
    ])('says over the bars how far a new version that %s the simple guess stood from it, after a bar in its color, and from the version in charge (#318)', (label, night, color, guess, charge, came) => {
        const { container } = draw({ rows: historyOf(1, { 0: night }) });

        pointAt(container, 300, GAP);

        const popup = popupOf(container);

        expect(readPopup(popup)).toEqual({ title: 'Fri Oct 2 · nightly update', rows: [[guess, ''], [charge, '']], foot: came });
        expect(popup.querySelector('.model-tip-row rect')).toHaveAttribute('fill', color);
        expect(popup.querySelectorAll('.model-tip-row svg')).toHaveLength(1);
    });

    it('calls a new version level with the simple guess so over the bars, with no mark', () => {
        const { container } = draw({ rows: historyOf(1, { 0: { attempt: { loss: 1.6601, auc_up: 0.56, auc_beats: 0.53, acc_up: 0.54 } } }) });

        pointAt(container, 300, GAP);

        expect(readPopup(popupOf(container)).rows[0]).toEqual(['Level with the simple guess', '']);
        expect(popupOf(container).querySelector('.model-tip-row svg')).toBeNull();
    });

    it('says over the bars that a first version had no version in charge to stand against', () => {
        const { container } = draw({ rows: historyOf(1, { 0: { went_live: true, live: NONE } }) });

        pointAt(container, 300, GAP);

        expect(readPopup(popupOf(container))).toEqual({
            title: 'Fri Oct 2 · first version',
            rows: [['0.050 better than the simple guess', ''], ['No version in charge to compare with', '']],
            foot: 'Took over',
        });
    });

    it('says how long the night pointed at took: its training and its scoring, each after its mark, and when it started, its day and time in Eastern time (#327)', () => {
        const { container } = draw({ rows: timedHistoryOf() });

        pointAt(container, 430, TOOK);

        const popup = popupOf(container);

        expect(container.querySelector(TOOK).contains(popup)).toBe(true);
        expect(readPopup(popup)).toEqual({
            title: 'Fri Oct 16 · nightly update',
            rows: [['Training', '7 min 17 s'], ['Scoring', '1 min 35 s']],
            foot: '8 min 52 s in all, started Fri Oct 16, 3:58 AM ET',
        });
        expect(popup.querySelector('.model-tip-foot .model-tip-when')).toHaveTextContent(/^started Fri Oct 16, 3:58 AM ET$/);
        expect(popup.querySelectorAll('.model-tip-row svg.model-mark')).toHaveLength(2);
    });

    //
    // Note: one point per case. recharts throttles a chart's mouse moves to one
    //       a frame, so a second in the same tick is held back past the
    //       assertion after it.
    //
    it('says a night from before the times were kept has none', () => {
        const { container } = draw({ rows: timedHistoryOf() });

        pointAt(container, 110, TOOK);

        expect(readPopup(popupOf(container))).toEqual({ title: 'Tue Oct 13 · nightly update', rows: [], foot: 'No times: they are kept from Oct 15, 2026 on' });
    });

    it('leaves out when a night started where the history does not say', () => {
        const { container } = draw({ rows: timedHistoryOf({ 4: { started: null } }) });

        pointAt(container, 540, TOOK);

        expect(readPopup(popupOf(container)).foot).toBe('9 min 52 s in all');
        expect(popupOf(container).querySelector('.model-tip-when')).toBeNull();
    });

    it('prints a night under ten seconds to a tenth', () => {
        const { container } = draw({ rows: timedHistoryOf({ 4: { training_seconds: 2.3, total_seconds: 2.6 } }) });

        pointAt(container, 540, TOOK);

        expect(readPopup(popupOf(container))).toEqual({
            title: 'Sat Oct 17 · nightly update',
            rows: [['Training', '2.3 s'], ['Scoring', '0.3 s']],
            foot: '2.6 s in all, started Sat Oct 17, 3:58 AM ET',
        });
    });

    it('names a weekly full retrain so (#318)', () => {
        const { container } = draw({ rows: historyOf(1, { 0: { kind: 'weekly', went_live: true } }) });

        pointAt(container, 300);

        expect(readPopup(popupOf(container)).title).toBe('Fri Oct 2 · weekly full retrain');
    });

    it('calls a first version so, with no version in charge among its numbers', () => {
        const { container } = draw({ rows: historyOf(1, { 0: { went_live: true, live: NONE } }) });

        pointAt(container, 300);

        expect(readPopup(popupOf(container))).toEqual({
            title: 'Fri Oct 2 · first version',
            rows: [['New version', '1.610'], ['Simple guess', '1.660']],
            foot: null,
        });
    });

    it('reads its numbers on the score on screen', () => {
        const { container } = draw({
            score: 'auc_up',
            rows: historyOf(1, { 0: { attempt: { loss: 1.61, auc_up: 0.6, auc_beats: 0.5, acc_up: 0.5 } } }),
        });

        pointAt(container, 300);

        expect(readPopup(popupOf(container)).rows).toEqual([['New version', '0.600'], ['Version in charge', '0.560'], ['Simple guess', '0.500']]);
        expect(screen.getByText(/Taking over is decided by loss/)).toBeInTheDocument();
    });

    it('draws none on a phone for a pointer: only a tap opens one', () => {
        phoneScreen();

        const { container } = draw({ rows: timedHistoryOf() });

        pointAt(container, 430);

        expect(popupsOf(container)).toEqual([]);
    });

    it('opens on a phone for the night tapped, over the chart tapped, and closes on a second tap on it', () => {
        phoneScreen();

        const { container } = draw({ rows: timedHistoryOf() });
        const took = container.querySelector(`${TOOK} .recharts-wrapper`);

        tapAt(took, 430);

        expect(popupsOf(container)).toHaveLength(1);
        expect(container.querySelector(TOOK).contains(popupOf(container))).toBe(true);
        expect(readPopup(popupOf(container)).title).toBe('Fri Oct 16 · nightly update');

        tapAt(took, 430);

        expect(popupsOf(container)).toEqual([]);
    });

    it('moves on a phone to another night tapped on the same chart', () => {
        phoneScreen();

        const { container } = draw({ rows: timedHistoryOf() });
        const attempts = container.querySelector(`${ATTEMPTS} .recharts-wrapper`);

        tapAt(attempts, 430);
        tapAt(attempts, 40);

        expect(popupsOf(container)).toHaveLength(1);
        expect(readPopup(popupOf(container)).title).toBe('Tue Oct 13 · nightly update');
    });

    it('moves on a phone to the chart tapped next, for the night tapped there', async () => {
        phoneScreen();

        const { container } = draw({ rows: timedHistoryOf() });

        await nextTurn();
        tapAt(container.querySelector(`${TOOK} .recharts-wrapper`), 430);
        tapAt(container.querySelector(`${ATTEMPTS} .recharts-wrapper`), 40);

        expect(popupsOf(container)).toHaveLength(1);
        expect(container.querySelector(ATTEMPTS).contains(popupOf(container))).toBe(true);
        expect(readPopup(popupOf(container)).title).toBe('Tue Oct 13 · nightly update');
    });

    it('closes on a phone for a tap anywhere off the chart, and stays open for one on it', async () => {
        phoneScreen();

        const { container } = draw({ rows: timedHistoryOf() });
        const took = container.querySelector(`${TOOK} .recharts-wrapper`);

        await nextTurn();
        tapAt(took, 430);
        fireEvent.click(container.querySelector(TOOK));

        expect(popupOf(container)).not.toBeNull();

        fireEvent.click(document.body);

        expect(popupsOf(container)).toEqual([]);
    });
});

describe('folding the card (#253, #300)', () => {
    // a fold is kept, as a reader's is: none is left for the cases after these
    beforeEach(() => window.localStorage.clear());
    afterEach(() => window.localStorage.clear());

    const GAP_TITLE = 'How far each new version beat or missed the simple guess';
    const TOOK_TITLE = 'How long each attempt took';

    const title = () => screen.getByRole('button', { name: TITLE });

    it('opens the card on a first visit, its title saying so', () => {
        const { container } = draw({ rows: timedHistoryOf() });

        expect(title()).toHaveAttribute('aria-expanded', 'true');
        expect(container.querySelectorAll('.model-chart')).toHaveLength(3);
    });

    it('gives the two charts under the first a heading each, and no fold of their own: a fold in a fold confused', () => {
        const { container } = draw({ rows: timedHistoryOf() });

        expect(screen.getAllByRole('button').filter((button) => button.classList.contains('model-fold'))).toEqual([title()]);
        expect(screen.getByRole('heading', { name: GAP_TITLE })).toHaveClass('model-card-minor');
        expect(screen.getByRole('heading', { name: TOOK_TITLE })).toHaveClass('model-card-minor');
        expect(container.querySelector('.model-card-minor button')).toBeNull();
    });

    it('folds the whole card down to its title -- its lines, its legends, all three charts, the panel and the numbers -- and opens it again', async () => {
        const { container } = draw({ rows: timedHistoryOf() });

        await userEvent.click(title());

        expect(title()).toHaveAttribute('aria-expanded', 'false');
        expect(container.querySelectorAll('.model-chart')).toHaveLength(0);
        expect(container.querySelector('.model-card-sub')).toBeNull();
        expect(container.querySelector('.model-attempts-newest')).toBeNull();
        expect(screen.queryByRole('list', { name: 'Legend' })).toBeNull();
        expect(screen.queryByRole('heading', { name: GAP_TITLE })).toBeNull();
        expect(screen.queryByRole('heading', { name: TOOK_TITLE })).toBeNull();
        expect(container.querySelector('.model-night-panel')).toBeNull();
        expect(screen.queryByRole('group', { name: 'Nights' })).toBeNull();
        expect(popupOf(container)).toBeNull();
        expect(screen.queryByRole('button', { name: 'Show the numbers' })).toBeNull();

        await userEvent.click(title());

        expect(title()).toHaveAttribute('aria-expanded', 'true');
        expect(container.querySelectorAll('.model-chart')).toHaveLength(3);
        expect(screen.getByRole('list', { name: 'Legend' })).toBeInTheDocument();
        expect(container.querySelector('.model-night-panel')).not.toBeNull();
        expect(screen.getByRole('button', { name: 'Show the numbers' })).toBeInTheDocument();
    });

    it('folds by the keyboard too', async () => {
        const { container } = draw({ rows: timedHistoryOf() });

        title().focus();
        await userEvent.keyboard('{Enter}');

        expect(container.querySelectorAll('.model-chart')).toHaveLength(0);
    });

    it('keeps the fold for the next visit', async () => {
        const { unmount } = draw({ rows: timedHistoryOf() });

        await userEvent.click(title());
        unmount();

        const { container } = draw({ rows: timedHistoryOf() });

        expect(title()).toHaveAttribute('aria-expanded', 'false');
        expect(container.querySelectorAll('.model-chart')).toHaveLength(0);
    });

    it('passes over a fold kept for one of the charts under the first, as the card kept them before (#253)', () => {
        writeLayout('model-page', 'wide', { fold: { gap: true, took: true }, size: {} });

        const { container } = draw({ rows: timedHistoryOf() });

        expect(title()).toHaveAttribute('aria-expanded', 'true');
        expect(container.querySelectorAll('.model-chart')).toHaveLength(3);
    });
});

describe('the numbers', () => {
    //
    // the table, opened, and its rows' cells' words
    //
    async function opened() {
        await userEvent.click(screen.getByRole('button', { name: 'Show the numbers' }));

        return screen.getByRole('table', { name: 'Loss, each night’s test' });
    }

    const cellsOf = (table) => within(table).getAllByRole('row').slice(1).map((row) => within(row).getAllByRole('cell'));

    it('lists every night, newest first, by the morning its test ran, with its numbers, how it stood against the simple guess and what came of it (#318)', async () => {
        draw({
            rows: historyOf(3, {
                0: { went_live: true, attempt: { loss: 1.55, auc_up: 0.6, auc_beats: 0.5, acc_up: 0.5 } },
                1: { kind: 'weekly', attempt: { loss: 1.6001, auc_up: 0.6, auc_beats: 0.5, acc_up: 0.5 } },
                2: { attempt: { loss: null, auc_up: null, auc_beats: null, acc_up: null } },
            }),
        });

        const table = await opened();

        expect(within(table).getAllByRole('columnheader').map((head) => head.textContent)).toEqual([
            'Night', 'Kind', 'New version', 'Version in charge', 'Simple guess', 'Against the simple guess', 'Result', 'Took',
        ]);
        expect(cellsOf(table).map((cells) => cells.map((cell) => cell.textContent))).toEqual([
            ['Tue Oct 6 after Mon Oct 5', 'Nightly update', '–', '1.600', '1.660', '', 'Kept back', ''],
            ['Sat Oct 3 after Fri Oct 2', 'Weekly full retrain', '1.600', '1.600', '1.660', 'better by 0.060', 'Kept back', ''],
            ['Fri Oct 2 after Thu Oct 1', 'Nightly update', '1.550', '1.600', '1.660', 'better by 0.110', 'Took over', ''],
        ]);
    });

    it('names each night in two lines, the market day under the morning its test ran', async () => {
        draw({ rows: ptOptionsHistory() });

        const [newest] = cellsOf(await opened());

        expect(newest[0].querySelector('.model-night-tested')).toHaveTextContent(/^Wed Oct 28$/);
        expect(newest[0].querySelector('.model-night-after')).toHaveTextContent(/^after Tue Oct 27$/);
    });

    it('names a first version so, and calls a level night level', async () => {
        draw({ rows: historyOf(2, { 0: { live: NONE, went_live: true }, 1: { attempt: { loss: 1.6601, auc_up: 0.6, auc_beats: 0.5, acc_up: 0.5 } } }) });

        const rows = cellsOf(await opened()).map((cells) => cells.map((cell) => cell.textContent));

        expect(rows[0][5]).toBe('level');
        expect(rows[1][1]).toBe('First version');
        expect(rows[1][3]).toBe('–');
    });

    it('says how long each night with times took, after what came of it, and leaves the rest empty', async () => {
        draw({ rows: timedHistoryOf() });

        const table = await opened();
        const heads = within(table).getAllByRole('columnheader').map((head) => head.textContent);
        const took = cellsOf(table).map((cells) => cells.pop().textContent);

        expect(heads.slice(-2)).toEqual(['Result', 'Took']);
        expect(took).toEqual(['9 min 52 s', '8 min 52 s', '', '', '']);
        expect(table.querySelector('.model-took-noted')).toBeNull();
    });

    it('gives pt-gnn\'s Oct 27 night its whole time, its fine-tuning counted in, with a note saying so (#318, #324)', async () => {
        draw({ rows: ptGnnHistory() });

        const [newest, older] = cellsOf(await opened());
        const noted = newest[7].querySelector('.model-took-noted');

        expect(newest[7]).toHaveTextContent(/^54 min 10 s$/);
        expect(noted).toHaveClass('model-noted');
        expect(noted).toHaveAccessibleDescription('43 min 13 s for the new version’s training and test, then 10 min 58 s fine-tuning it.');
        expect(older[7]).toHaveTextContent(/^54 min 30 s$/);
        expect(older[7].querySelector('.model-took-noted')).toBeNull();
    });

    it('counts a fine-tuning whose version did not go live, and says the tested version went live instead (#318, #324)', async () => {
        draw({ rows: timedHistoryOf({ 4: { went_live: true, trained_again: false, trained_again_seconds: 120 } }) });

        const [newest] = cellsOf(await opened());

        expect(newest[7]).toHaveTextContent(/^11 min 52 s$/);
        expect(newest[7].querySelector('.model-took-noted')).toHaveAccessibleDescription(
            '9 min 52 s for the new version’s training and test, then 2 min 0 s fine-tuning it. The tested version went live instead.'
        );
    });

    it('reads each score on the score on screen', async () => {
        draw({ rows: ptOptionsHistory(), score: 'profit_auc' });

        await userEvent.click(screen.getByRole('button', { name: 'Show the numbers' }));

        const table = screen.getByRole('table', { name: 'Profit AUC, each night’s test' });
        const [, picked] = cellsOf(table);

        expect(picked.slice(2, 6).map((cell) => cell.textContent)).toEqual(['0.733', '0.733', '0.626', 'better by 0.107']);
    });
});
