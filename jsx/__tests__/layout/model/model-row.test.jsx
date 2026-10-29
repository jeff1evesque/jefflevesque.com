/**
 * model-row.test.jsx: one model in /model's list (#243), and its trend line, as
 * #300 lays a row out.
 *
 * Note: the trend line is as wide as the room its row gives it, measured in the
 *       browser; under jsdom nothing measures, so it is drawn at its 132px, and
 *       recharts draws it for real without a size given to it.
 */

//
// whether the page is on a phone, as react-device-detect reads it from the user
// agent: a computer's unless a case says otherwise (#296)
//
let mockMobile = false;

jest.mock('react-device-detect', () => ({
    ...jest.requireActual('react-device-detect'),
    get isMobile() {
        return mockMobile;
    },
}));

import React from 'react';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

import ModelRow, { PartCells, TrendLine, trendSpan } from '../../../import/layout/model/model-row.jsx';
import { ThemeModeContext } from '../../../import/general/theme-mode.jsx';
import { COMPARE_COLORS, SCORES, chartColors, formatScore, noteOf, recentDays, shortDay } from '../../../import/layout/model/scores.js';
import { STOCK_SCORES, heldModelOf, heldTrackOf, tapAt } from '../../../test-support/model-fixtures.js';
import { OPTIONS_TASK, downModelOf, modelOf, olderTrackOf, optionsModelOf, pointAt, trackOf } from '../../../test-support/model-fixtures.js';

function draw(props = {}) {
    const onPick = props.onPick || jest.fn();
    const rows = 'rows' in props ? props.rows : trackOf(10);

    const view = render(
        <ThemeModeContext.Provider value={{ theme: 'light' }}>
            <MemoryRouter>
                <ModelRow
                    model={modelOf()}
                    score='loss'
                    rows={rows}
                    axis={recentDays({ a: trackOf(10) })}
                    picked={null}
                    blocked={null}
                    {...props}
                    onPick={onPick}
                />
            </MemoryRouter>
        </ThemeModeContext.Provider>
    );

    return { ...view, onPick };
}

//
// a row's score by its parts: its name, read out to a screen reader alone, as
// the picker over the list names it to the eye; the days it takes in, which
// carry the score's note; and the lines at the row's foot, of when its live
// version went live and how many attempts did, their spaces read as a reader
// sees them, as 'Taken down Oct 19' keeps its day on one line with a no-break
// space
//
const nameOf = (container) => container.querySelector('.model-cell-score .visually-hidden');
const daysOf = (container) => container.querySelector('.model-cell-score .model-score-days');
const sinceOf = (container) => [...container.querySelectorAll('.model-cell-since > span')].map((line) => line.textContent.replace(/\s/g, ' '));
const cellsOf = (container) => [...container.querySelectorAll('.model-row > .model-cell')].map((cell) => cell.classList[1]);

describe('a row', () => {
    it('links the model\'s name to its page, and prints its description with no address over it (#300)', () => {
        draw();

        expect(screen.getByRole('link', { name: 'pt-gnn' })).toHaveAttribute('href', '/model/pt-gnn');
        expect(screen.queryByText('/model/pt-gnn')).toBeNull();
        expect(document.querySelector('.model-address')).toBeNull();
        expect(screen.getByText('A graph model of the market')).toBeInTheDocument();
    });

    it('escapes a name the address would read otherwise', () => {
        draw({ model: modelOf({ name: 'a b/c' }) });

        expect(screen.getByRole('link', { name: 'a b/c' })).toHaveAttribute('href', '/model/a%20b%2Fc');
    });

    it('leaves the description out where there is none', () => {
        const { container } = draw({ model: modelOf({ description: '' }) });

        expect(container.querySelector('.model-description')).toBeNull();
    });

    it('prints the 20-day score, and how it stands against the baseline\'s, beside the baseline\'s own', () => {
        const { container } = draw();

        expect(container.querySelector('.model-score-value')).toHaveTextContent('1.600');
        expect(container.querySelector('.model-gap')).toHaveTextContent(/^▲ 0\.060 better than baseline, 1\.660$/);
        expect(container.querySelector('.model-gap')).toHaveClass('model-gap-better');
    });

    it('says when it is worse than the baseline, or level with it', () => {
        const worse = draw({ model: modelOf({ score: { loss: 1.7 } }) }).container;

        expect(worse.querySelector('.model-gap')).toHaveTextContent(/^▼ 0\.040 worse than baseline, 1\.660$/);

        const level = draw({ model: modelOf({ score: { loss: 1.66 } }) }).container;

        expect(level.querySelector('.model-gap')).toHaveTextContent(/^level with baseline, 1\.660$/);
    });

    it('puts the arrow in a span of its own, so it alone takes the color of better or worse (#274)', () => {
        const better = draw().container.querySelector('.model-gap');
        const worse = draw({ model: modelOf({ score: { loss: 1.7 } }) }).container.querySelector('.model-gap');
        const level = draw({ model: modelOf({ score: { loss: 1.66 } }) }).container.querySelector('.model-gap');

        expect(better.querySelector('.model-gap-arrow')).toHaveTextContent(/^▲$/);
        expect(worse.querySelector('.model-gap-arrow')).toHaveTextContent(/^▼$/);
        expect(worse).toHaveClass('model-gap-worse');
        expect(level.querySelector('.model-gap-arrow')).toBeNull();
    });

    it('prints a dash and no comparison for a model with no score yet', () => {
        const { container } = draw({ model: modelOf({ score: null, baseline: null }) });

        expect(container.querySelector('.model-score-value')).toHaveTextContent('–');
        expect(container.querySelector('.model-gap')).toHaveTextContent(/^$/);
    });

    it('names the score for a screen reader alone, as the picker over the list names it to the eye (#300)', () => {
        expect(nameOf(draw().container)).toHaveTextContent(/^Loss:$/);
        expect(nameOf(draw({ score: 'auc_up' }).container)).toHaveTextContent(/^Up\/down AUC:$/);
        expect(nameOf(draw().container)).toHaveClass('visually-hidden');
    });

    it('says under the figure how many days it takes in, as its status reads it', () => {
        expect(daysOf(draw().container)).toHaveTextContent(/^last 20 days$/);
        expect(daysOf(draw({ model: modelOf({ scored_days: 3 }) }).container)).toHaveTextContent(/^3 days so far$/);
        expect(daysOf(draw({ model: modelOf({ scored_days: 1 }) }).container)).toHaveTextContent(/^1 day so far$/);
        expect(daysOf(draw({ model: modelOf({ retired: '2026-10-01' }) }).container)).toHaveTextContent(/^last 20 days before retiring$/);
    });

    it('says the days by those the listing says its scores average, from format 4 (#293)', () => {
        const days = (model) => daysOf(draw({ model: model }).container);

        expect(days(modelOf({ average_days: 30 }))).toHaveTextContent(/^last 30 days$/);
        expect(days(modelOf({ average_days: 30, scored_days: 25 }))).toHaveTextContent(/^25 days so far$/);
        expect(days(modelOf({ average_days: 30, retired: '2026-10-01' }))).toHaveTextContent(/^last 30 days before retiring$/);
        expect(days(modelOf({ average_days: 10, scored_days: 12 }))).toHaveTextContent(/^last 10 days$/);
    });

    it('names its trend line by those days (#293)', () => {
        draw({ model: modelOf({ average_days: 30 }) });

        expect(screen.getByRole('img', { name: /^pt-gnn's Loss, 30-day average, \w{3} \d+ – \w{3} \d+$/ })).toBeInTheDocument();
    });

    it.each(SCORES.map((score) => [score.key, score.note]))('gives the days under the figure %s\'s note (#265)', (key, note) => {
        const days = daysOf(draw({ score: key }).container);

        expect(days).toHaveAccessibleDescription(note);
        expect(days).toHaveAttribute('tabindex', '0');
        expect(days.querySelector('svg')).toHaveAttribute('data-testid', 'InfoOutlinedIcon');
    });

    it('gives an options model\'s score its task\'s note, and prints its top 10\'s gain as a percent (#279)', () => {
        const loss = draw({ model: optionsModelOf(), task: OPTIONS_TASK }).container;

        expect(daysOf(loss)).toHaveAccessibleDescription(noteOf('loss', OPTIONS_TASK));
        expect(loss.querySelector('.model-score-value')).toHaveTextContent('0.840');

        const gain = draw({ model: optionsModelOf(), task: OPTIONS_TASK, score: 'top10_gain' }).container;

        expect(gain.querySelector('.model-score-value')).toHaveTextContent('3.10%');
        expect(gain.querySelector('.model-gap')).toHaveTextContent(/^▲ 7\.30 pts better than baseline, −4\.20%$/);
        expect(daysOf(gain)).toHaveAccessibleDescription(noteOf('top10_gain', OPTIONS_TASK));
    });

    it('prints a dash for a score the listing gives a model none of, as one before format 3 (#279)', () => {
        const { container } = draw({ score: 'top10_wins' });

        expect(container.querySelector('.model-score-value')).toHaveTextContent('–');
        expect(container.querySelector('.model-gap')).toHaveTextContent(/^$/);
        expect(container.querySelector('.model-trend-none')).toHaveAttribute('title', 'Not scored in the last 60 days');
    });

    it('shows the score\'s note under the pointer, over the days under the figure (#265)', async () => {
        const { container } = draw();

        await userEvent.hover(daysOf(container));

        expect(await screen.findByRole('tooltip')).toHaveTextContent(SCORES[0].note);
    });

    it('lays out its cells as #300 lays it out: the compare box, the model, its score, its trend line, and when it went live', () => {
        expect(cellsOf(draw().container)).toEqual([
            'model-cell-compare',
            'model-cell-model',
            'model-cell-score',
            'model-cell-trend',
            'model-cell-since',
        ]);
    });

    it('says at its foot when the live version went live and how, and how many attempts did, a line each (#300)', () => {
        expect(sinceOf(draw().container)).toEqual(['Live since Sat Oct 10, nightly update', '4 of 30 attempts went live']);
        expect(sinceOf(draw({ model: modelOf({ live: { since: '2026-10-05', kind: 'first' } }) }).container))
            .toEqual(['Live since Tue Oct 6, first version', '4 of 30 attempts went live']);
    });

    it('names the morning after the day its live version went live, with its weekday, as the attempts name each night (#320)', () => {
        expect(sinceOf(draw({ model: modelOf({ live: { since: '2026-10-27', kind: 'nightly' } }) }).container)[0])
            .toBe('Live since Wed Oct 28, nightly update');
    });

    it('says when a retired model retired, and dims it', () => {
        const { container } = draw({ model: modelOf({ retired: '2026-10-02' }) });

        expect(container.querySelector('.model-row')).toHaveClass('model-row-retired');
        expect(sinceOf(container)).toEqual(['Retired Oct 2', '4 of 30 attempts went live']);
    });

    it('says there is no live version yet where there is no day, and leaves out how it went live where the listing does not say', () => {
        expect(sinceOf(draw({ model: modelOf({ live: { since: null, kind: null } }) }).container))
            .toEqual(['No live version yet', '4 of 30 attempts went live']);
        expect(sinceOf(draw({ model: modelOf({ live: { since: '2026-10-09', kind: null } }) }).container)[0]).toBe('Live since Sat Oct 10');
    });
});

describe('the link to an options model\'s picks (#290)', () => {
    it('is under an options model\'s description, to its picks page, whoever reads the list', () => {
        const { container } = draw({ model: optionsModelOf(), task: OPTIONS_TASK, rows: [] });

        const link = screen.getByRole('link', { name: 'See its picks ›' });

        expect(link).toHaveAttribute('href', '/model/pt-options/picks');
        expect(link).toHaveClass('model-picks-link');
        expect(container.querySelector('.model-cell-model').lastElementChild).toBe(link);
    });

    it('is on no stock model\'s row, nor a retired options model\'s', () => {
        draw();
        expect(screen.queryByRole('link', { name: 'See its picks ›' })).toBeNull();

        document.body.innerHTML = '';
        draw({ model: optionsModelOf({ retired: '2026-10-19' }), task: OPTIONS_TASK, rows: [] });
        expect(screen.queryByRole('link', { name: 'See its picks ›' })).toBeNull();
    });

    it('is not on the row of an options model taken down, whose last picks are not this night\'s (#295)', () => {
        draw({ model: optionsModelOf({ down: { since: '2026-10-23', reason: 'track_record', days: null, in_a_row: null } }), task: OPTIONS_TASK, rows: [] });

        expect(screen.getByText('Behind baseline')).toHaveClass('model-pill-down');
        expect(screen.queryByRole('link', { name: 'See its picks ›' })).toBeNull();
    });
});

describe('a model whose live version was taken down (#263)', () => {
    it('says Behind baseline on its pill', () => {
        draw({ model: downModelOf() });

        expect(screen.getByText('Behind baseline')).toHaveClass('model-pill', 'model-pill-down');
    });

    it('says at its foot when, and the check that did it, in place of when it went live', () => {
        expect(sinceOf(draw({ model: downModelOf() }).container))
            .toEqual(['Taken down Oct 19', '4 of 30 attempts went live', 'Worse than the baseline 5 scored days in a row.']);
    });

    it('words an average\'s check as an average\'s', () => {
        const { container } = draw({ model: downModelOf({ down: { since: '2026-10-19', days: 5, in_a_row: 10 } }) });

        expect(sinceOf(container)[2]).toBe('Its 5-day average was worse than the baseline’s 10 days in a row.');
    });

    it.each([
        ['not_ahead', 'It went live without beating the baseline.'],
        ['track_record', 'Its track record showed nothing better than the baseline.'],
    ])('says why where no check did it, from format 4 (%s, #295)', (reason, why) => {
        const { container } = draw({ model: downModelOf({ down: { since: '2026-10-23', reason: reason, days: null, in_a_row: null } }) });

        expect(sinceOf(container)).toEqual(['Taken down Oct 23', '4 of 30 attempts went live', why]);
    });

    it('says the days its score takes in so far where it was taken down before its 20th scored day', () => {
        expect(daysOf(draw({ model: downModelOf({ scored_days: 7 }) }).container)).toHaveTextContent(/^7 days so far$/);
    });

    it('keeps its bell, as it can go live again, and is not dimmed', () => {
        const { container } = draw({ model: downModelOf() });

        expect(screen.getByRole('link', { name: 'Alarm for lagging' })).toHaveAttribute('href', '/model/lagging/alarm');
        expect(container.querySelector('.model-row')).not.toHaveClass('model-row-retired');
    });
});

describe('the compare box', () => {
    it('ticks the model for the comparison', async () => {
        const { onPick } = draw();

        await userEvent.click(screen.getByRole('checkbox', { name: 'Compare pt-gnn' }));

        expect(onPick).toHaveBeenCalledWith(modelOf());
    });

    it('shows a swatch of its color while it is ticked', () => {
        const { container } = draw({ picked: 2 });

        expect(screen.getByRole('checkbox', { name: 'Compare pt-gnn' })).toBeChecked();
        expect(container.querySelector('.model-swatch')).toHaveStyle({ backgroundColor: COMPARE_COLORS[2] });
    });

    it('shows no swatch while it is not', () => {
        const { container } = draw();

        expect(container.querySelector('.model-swatch')).toBeNull();
    });

    it('is disabled where it cannot be ticked, and says why', async () => {
        draw({ blocked: 'Up to three at once' });

        const box = screen.getByRole('checkbox', { name: 'Compare pt-gnn' });

        expect(box).toBeDisabled();
        await userEvent.hover(box.parentElement);
        expect(await screen.findByRole('tooltip')).toHaveTextContent('Up to three at once');
    });
});

describe('the bell (#255)', () => {
    //
    // the bell's icon, on the model's name's line after its status (#300)
    //
    const bellIn = (container) => container.querySelector('.model-name-line .model-bell svg');

    it('is plain for a reader who holds nothing, and leads to the model\'s alarm page', () => {
        const { container } = draw();

        expect(screen.getByRole('link', { name: 'Alarm for pt-gnn' })).toHaveAttribute('href', '/model/pt-gnn/alarm');
        expect(bellIn(container)).toHaveAttribute('data-testid', 'NotificationsIcon');
    });

    it('rings in green for a reader who holds the model\'s alarm', () => {
        const { container } = draw({ held: true });

        expect(screen.getByRole('link', { name: 'Alarm for pt-gnn: subscribed' })).toHaveAttribute('href', '/model/pt-gnn/alarm');
        expect(bellIn(container)).toHaveAttribute('data-testid', 'NotificationsActiveIcon');
        expect(bellIn(container)).toHaveClass('subscribed');
    });

    it('is left off a retired model', () => {
        const { container } = draw({ model: modelOf({ retired: '2026-10-02' }), held: true });

        expect(container.querySelector('.model-bell')).toBeNull();
        expect(screen.queryByRole('link', { name: /^Alarm for/ })).toBeNull();
    });

    it('comes after the model\'s name and status, on their line, as a stream\'s does on /stream (#259, #300)', () => {
        const line = draw().container.querySelector('.model-name-line');

        expect([...line.children].map((each) => each.classList[0])).toEqual(['model-name', 'model-pill', 'control-tray']);
        expect(line.lastElementChild).toHaveClass('model-bell');
    });
});

describe('loss\'s three parts, in place of its sum (#283)', () => {
    //
    // the newest day of trackOf(10): up or down 0.720 against the baseline's
    // 0.700, beating the average stock 0.620 against 0.693, and the size of the
    // move 0.269 against 0.267
    //
    const textsOf = (container, selector) => [...container.querySelectorAll(selector)].map((each) => each.textContent);

    //
    // a track record of one day, its parts' averages `parts` and the baseline's
    // `baseline`
    //
    function dayOf(parts, baseline) {
        return [{ day: '2026-09-01', days: 1, score: {}, baseline: {}, average: parts, baseline_average: baseline }];
    }

    it('stand in the score\'s place, each with its 20-day figure and how it stands against the baseline\'s', () => {
        const { container } = draw({ parts: true });

        expect(container.querySelector('.model-cell-score')).toBeNull();
        expect(textsOf(container, '.model-part-cell-value')).toEqual(['0.720', '0.620', '0.269']);
        expect(textsOf(container, '.model-part-cell .model-gap')).toEqual(['▼ 0.020 worse', '▲ 0.073 better', '▼ 0.002 worse']);
        expect([...container.querySelectorAll('.model-part-cell .model-gap')].map((gap) => gap.classList[1]))
            .toEqual(['model-gap-worse', 'model-gap-better', 'model-gap-worse']);
        expect(textsOf(container, '.model-part-cell .model-gap-arrow')).toEqual(['▼', '▲', '▼']);
    });

    it('name each part over its figure, in a list named for them (#300)', () => {
        const { container } = draw({ parts: true });

        expect(screen.getByRole('list', { name: 'Loss, part by part' })).toHaveClass('model-part-cells');
        expect(textsOf(container, '.model-part-cell-name')).toEqual(['Up or down', 'Beats the average stock', 'Size of the move']);
    });

    it('say over them what they add up to, and over how many days, with loss\'s note (#300)', () => {
        const live = draw({ parts: true }).container.querySelector('.model-cell-parts .model-parts-note');
        const fresh = draw({ parts: true, model: modelOf({ scored_days: 3 }) }).container.querySelector('.model-cell-parts .model-parts-note');

        expect(live).toHaveTextContent(/^Loss 1\.600, part by part, last 20 days$/);
        expect(live).toHaveAccessibleDescription(noteOf('loss'));
        expect(live).toHaveAttribute('tabindex', '0');
        expect(fresh).toHaveTextContent(/^Loss 1\.600, part by part, 3 days so far$/);
    });

    it('say the days over them by those the listing says its scores average (#293)', () => {
        const over = draw({ parts: true, model: modelOf({ average_days: 30 }) }).container.querySelector('.model-cell-parts .model-parts-note');

        expect(over).toHaveTextContent(/^Loss 1\.600, part by part, last 30 days$/);
    });

    it('say a dash over them for a model with no score yet', () => {
        const over = draw({ parts: true, model: modelOf({ score: null, baseline: null }) }).container.querySelector('.model-parts-note');

        expect(over).toHaveTextContent(/^Loss –, part by part, last 20 days$/);
    });

    it('say level, with no arrow, for a part printed as the baseline\'s is', () => {
        const rows = dayOf(
            { up_log_loss: 0.7001, beats_log_loss: 0.693, move_pinball: 0.267 },
            { up_log_loss: 0.7, beats_log_loss: 0.6932, move_pinball: 0.2671 },
        );
        const { container } = draw({ parts: true, rows: rows });

        expect(textsOf(container, '.model-part-cell .model-gap')).toEqual(['level', 'level', 'level']);
        expect(container.querySelector('.model-part-cell .model-gap-arrow')).toBeNull();
    });

    it('leave how a part stands unsaid where the baseline has none of it', () => {
        const rows = dayOf({ up_log_loss: 0.72, beats_log_loss: 0.62, move_pinball: 0.27 }, {});
        const { container } = draw({ parts: true, rows: rows });

        expect(textsOf(container, '.model-part-cell-value')).toEqual(['0.720', '0.620', '0.270']);
        expect(textsOf(container, '.model-part-cell .model-gap')).toEqual(['', '', '']);
    });

    it('hold a bar for each figure while the track record is on its way', () => {
        const { container } = draw({ parts: true, rows: undefined });

        expect(container.querySelectorAll('.model-part-cell-value > .graph-pending-bar')).toHaveLength(3);
    });

    it.each([
        ['could not be had', null],
        ['has no day yet', []],
        ['has no columns for them', olderTrackOf(10)],
    ])('print a dash for each where the track record %s', (_, rows) => {
        const { container } = draw({ parts: true, rows: rows });

        expect(textsOf(container, '.model-part-cell-value')).toEqual(['–', '–', '–']);
        expect(textsOf(container, '.model-part-cell .model-gap')).toEqual(['', '', '']);
    });

    it('stand where the score does, between the model and its trend line', () => {
        expect(cellsOf(draw({ parts: true }).container)).toEqual([
            'model-cell-compare',
            'model-cell-model',
            'model-cell-parts',
            'model-cell-trend',
            'model-cell-since',
        ]);
    });
});

describe('trendSpan (#300)', () => {
    it('says the average each point is, and the first and last days of the axis', () => {
        expect(trendSpan(['2026-10-12', '2026-10-13', '2026-10-23'], 20)).toBe('20-day average, Oct 12 – Oct 23');
        expect(trendSpan(['2026-10-12', '2026-10-23'], 30)).toBe('30-day average, Oct 12 – Oct 23');
    });

    it('names one day once, where the axis has no other', () => {
        expect(trendSpan(['2026-10-12'], 20)).toBe('20-day average, Oct 12');
    });

    it('averages 20 days where it is handed no number, and says nothing of an axis with no day', () => {
        expect(trendSpan(['2026-10-12', '2026-10-23'])).toBe('20-day average, Oct 12 – Oct 23');
        expect(trendSpan([], 20)).toBe('');
    });
});

describe('a row\'s trend line, under what it spans (#300)', () => {
    const axis = recentDays({ a: trackOf(10) });
    const spanOf = (container) => container.querySelector('.model-cell-trend > .model-trend-span');

    it('says over the line the average each point is, and the days the axis runs over', () => {
        const { container } = draw();

        expect(spanOf(container)).toHaveTextContent(`20-day average, ${shortDay(axis[0])} – ${shortDay(axis[axis.length - 1])}`);
        expect(spanOf(container).nextElementSibling).toHaveClass('model-trend');
    });

    it('names the average by the listing\'s average_days (#293)', () => {
        const { container } = draw({ model: modelOf({ average_days: 30 }) });

        expect(spanOf(container)).toHaveTextContent(/^30-day average, /);
    });

    it('says the span while the record is on its way, since every row shares the axis', () => {
        const { container } = draw({ rows: undefined });

        expect(spanOf(container)).toHaveTextContent(/^20-day average, /);
        expect(container.querySelector('.model-cell-trend .model-trend-pending')).toBeInTheDocument();
    });

    it('says nothing over the line while no record has a day on the axis', () => {
        const { container } = draw({ axis: [] });

        expect(spanOf(container)).toBeNull();
    });
});

describe('TrendLine', () => {
    function trend(props) {
        return render(
            <ThemeModeContext.Provider value={{ theme: 'dark' }}>
                <TrendLine name='pt-gnn' score='loss' axis={recentDays({ a: trackOf(10) })} rows={trackOf(10)} {...props} />
            </ThemeModeContext.Provider>
        );
    }

    it('draws the 20-day score and the baseline\'s on the shared axis', () => {
        const { container } = trend();

        expect(screen.getByRole('img', { name: /^pt-gnn's Loss, 20-day average, \w{3} \d+ – \w{3} \d+$/ })).toBeInTheDocument();
        expect(container.querySelectorAll('.recharts-line')).toHaveLength(2);
    });

    it('draws the score in the charts\' better blue and the baseline dashed in their amber, 44px tall, as #300 lays it out', () => {
        const { container } = trend();
        const colors = chartColors('dark');
        const [baseline, value] = container.querySelectorAll('.recharts-line-curve');

        expect(value).toHaveAttribute('stroke', colors.better);
        expect(value).toHaveAttribute('stroke-width', '2');
        expect(baseline).toHaveAttribute('stroke', colors.baseline);
        expect(baseline).toHaveAttribute('stroke-dasharray', '5 4');
        expect(container.querySelector('.model-trend svg')).toHaveAttribute('height', '44');
    });

    it('joins its lines across the days it was not scored between its first and its last, and still starts on its first (#315)', () => {
        const every = trackOf(10);
        const taken = every.filter((row, at) => at >= 3 && (at < 5 || at > 7));
        const firstX = (line) => Number(/^M\s*(-?[\d.]+)/.exec(line.getAttribute('d'))[1]);
        const whole = trend({ axis: recentDays({ a: every }), rows: every }).container.querySelectorAll('.recharts-line-curve')[1];
        const { container } = trend({ axis: recentDays({ a: every }), rows: taken });
        const [baseline, value] = container.querySelectorAll('.recharts-line-curve');

        expect(baseline.getAttribute('d').match(/M/g)).toHaveLength(1);
        expect(value.getAttribute('d').match(/M/g)).toHaveLength(1);
        expect(firstX(value)).toBeGreaterThan(firstX(whole));
    });

    it('is named by the days it is handed, the listing\'s average_days (#293)', () => {
        trend({ days: 30 });

        expect(screen.getByRole('img', { name: /^pt-gnn's Loss, 30-day average, \w{3} \d+ – \w{3} \d+$/ })).toBeInTheDocument();
    });

    it('holds a place while the record is on its way', () => {
        trend({ rows: undefined });

        expect(screen.getByLabelText('Loading the trend')).toHaveClass('model-trend-pending');
    });

    it('prints a dash, and says why, for a record with nothing on the axis', () => {
        const { container } = trend({ rows: trackOf(2, '2025-01-01') });

        expect(container.querySelector('.model-trend-none')).toHaveAttribute('title', 'Not scored in the last 60 days');
    });

    it('prints a dash, and says why, for a record that could not be had', () => {
        const { container } = trend({ rows: null });

        expect(container.querySelector('.model-trend-none')).toHaveAttribute('title', 'Could not be loaded');
    });

    describe('the day under the pointer, on a computer (#296)', () => {
        afterEach(() => {
            mockMobile = false;
        });

        //
        // the line's last day is at its right end: 132px wide, less its 4px margin
        //
        const pointAtLastDay = (container) => pointAt(container.querySelector('.recharts-wrapper'), 128, 18);

        it('shows a box of the day, the score and the baseline\'s, each after its line\'s mark', () => {
            const rows = trackOf(10);
            const last = rows[rows.length - 1];
            const { container } = trend({ rows: rows });

            pointAtLastDay(container);

            const tip = container.querySelector('.model-trend-tip');
            const named = [...tip.querySelectorAll('.model-tip-row')].map((row) => [
                row.querySelector('.model-tip-name').textContent,
                row.querySelector('.model-tip-value').textContent,
            ]);

            expect(tip).toHaveClass('model-tip');
            expect(tip.querySelector('.model-tip-title')).toHaveTextContent(shortDay(last.day));
            expect(named).toEqual([
                ['Loss', formatScore(last.average.loss, 'loss')],
                ['Baseline', formatScore(last.baseline_average.loss, 'loss')],
            ]);
            expect(tip.querySelectorAll('.model-mark')).toHaveLength(2);
        });

        it('marks the score in the line\'s blue and the baseline dashed in its amber', () => {
            const { container } = trend({ rows: trackOf(10) });
            const colors = chartColors('dark');

            pointAtLastDay(container);

            const [value, baseline] = container.querySelectorAll('.model-trend-tip .model-mark line');

            expect(value).toHaveAttribute('stroke', colors.better);
            expect(baseline).toHaveAttribute('stroke', colors.baseline);
            expect(baseline).toHaveAttribute('stroke-dasharray', '5 4');
        });

        it('names the score picked', () => {
            const rows = trackOf(10);
            const { container } = trend({ rows: rows, score: 'auc_up' });

            pointAtLastDay(container);

            expect(container.querySelector('.model-trend-tip .model-tip-name')).toHaveTextContent('Up/down AUC');
        });

        it('puts a dot on each line at the day', () => {
            const { container } = trend({ rows: trackOf(10) });

            pointAtLastDay(container);

            expect(container.querySelectorAll('.recharts-active-dot')).toHaveLength(2);
        });

        it('shows no box on a day the model has no score', () => {
            //
            // the axis runs ten days, and this record only its first five
            //
            const { container } = trend({ rows: trackOf(5) });

            pointAtLastDay(container);

            expect(container.querySelector('.model-trend-tip')).toBeNull();
        });

        it('leaves out the baseline\'s row on a day it has none', () => {
            const rows = trackOf(10);

            rows[rows.length - 1].baseline_average = {};

            const { container } = trend({ rows: rows });

            pointAtLastDay(container);

            expect([...container.querySelectorAll('.model-trend-tip .model-tip-name')].map((name) => name.textContent)).toEqual(['Loss']);
        });

        it('shows no box and no dot on a phone, which has no pointer', () => {
            mockMobile = true;

            const { container } = trend({ rows: trackOf(10) });

            pointAtLastDay(container);

            expect(container.querySelector('.model-trend-tip')).toBeNull();
            expect(container.querySelectorAll('.recharts-active-dot')).toHaveLength(0);
        });
    });
});

describe('a row on a hold, from format 5 on (#300)', () => {
    //
    // tables-gnn's record of thirty days, the newest five without their 5-day
    // results and every one without its 20-day result
    //
    const rows = heldTrackOf(30);
    const model = heldModelOf({}, rows);
    const task = { id: 'direction', name: 'Next-day direction', scores: STOCK_SCORES };
    const axis = recentDays({ a: rows });
    const on = (hold, props = {}) => draw({ model: model, task: task, rows: rows, axis: axis, hold: hold, ...props });
    const textOf = (container, selector) => container.querySelector(selector).textContent;

    it('prints the hold\'s score as the listing gives it, named with the hold for a screen reader, and how it stands', () => {
        const { container } = on(5);
        const held = model.holds['5d'];

        expect(textOf(container, '.model-score-value')).toBe(formatScore(held.score.loss, 'loss'));
        expect(nameOf(container)).toHaveTextContent(/^Loss, 5-day hold:$/);
        expect(daysOf(container)).toHaveTextContent(/^last 20 days$/);
        expect(container.querySelector('.model-cell-score .model-gap')).toHaveClass('model-gap-better');
        expect(container.querySelector('.model-cell-score .model-gap .model-gap-arrow')).toHaveTextContent('▲');
    });

    it('reads as a list before format 5 did on the 1-day hold: its scores, the hold unnamed', () => {
        const { container } = on(1);

        expect(textOf(container, '.model-score-value')).toBe(formatScore(model.score.loss, 'loss'));
        expect(nameOf(container)).toHaveTextContent(/^Loss:$/);
        expect(daysOf(container)).toHaveTextContent(/^last 20 days$/);
    });

    it('names Combined, and says a hold with no scored day yet has none', () => {
        const { container } = on(20);

        expect(textOf(container, '.model-score-value')).toBe('–');
        expect(daysOf(container)).toHaveTextContent(/^no scored days yet$/);

        const combined = draw({ model: model, task: task, rows: rows, axis: axis, hold: 'combined', score: 'auc_up' });

        expect(nameOf(combined.container)).toHaveTextContent(/^Up\/down AUC, combined:$/);
        expect(daysOf(combined.container)).toHaveTextContent(/^no scored days yet$/);
    });

    it('counts a hold\'s days so far by its own days', () => {
        const fewer = heldTrackOf(30, { notIn: 20 });
        const { container } = draw({ model: heldModelOf({}, fewer), task: task, rows: fewer, axis: axis, hold: 5 });

        expect(daysOf(container)).toHaveTextContent(/^10 days so far$/);
    });

    it('carries the note of the score on the hold', () => {
        const { container } = draw({ model: model, task: task, rows: rows, axis: axis, hold: 5, score: 'top10_gain' });

        expect(daysOf(container)).toHaveAccessibleDescription(noteOf('top10_gain', task, 5));
    });

    it('shows loss\'s three parts on the hold, from its own columns, under what they add up to on it', () => {
        const { container } = on(5, { parts: true });
        const newest = rows[rows.length - 1];

        expect([...container.querySelectorAll('.model-part-cell-value')].map((cell) => cell.textContent)).toEqual([
            formatScore(newest.average.up_log_loss_5d, 'loss'),
            formatScore(newest.average.beats_log_loss_5d, 'loss'),
            formatScore(newest.average.move_pinball_5d, 'loss'),
        ]);
        expect(textOf(container, '.model-cell-parts .model-parts-note'))
            .toBe(`Loss ${formatScore(model.holds['5d'].score.loss, 'loss')}, part by part, last 20 days`);
        expect(container.querySelector('.model-parts-note')).toHaveAccessibleDescription(noteOf('loss', task, 5));
    });

    it('draws its trend line on the hold, named with it', () => {
        on(5);

        expect(screen.getByRole('img', { name: /^tables-gnn's Loss, 5-day hold, 20-day average, \w{3} \d+ – \w{3} \d+$/ })).toBeInTheDocument();
    });

    it('says when a live version was taken down on its hold, and why', () => {
        const { container } = draw({ model: downModelOf({ down: { since: '2026-10-19', days: 1, in_a_row: 5, hold: 5 } }) });

        expect(sinceOf(container))
            .toEqual(['Taken down Oct 19', '4 of 30 attempts went live', 'Its 5-day hold did worse than the baseline 5 scored days in a row.']);
    });
});

describe('TrendLine on a hold (#300)', () => {
    const rows = heldTrackOf(30);
    const axis = recentDays({ a: rows });
    const trend = (props) => render(
        <ThemeModeContext.Provider value={{ theme: 'light' }}>
            <button type='button'>elsewhere</button>
            <TrendLine name='tables-gnn' score='loss' axis={axis} rows={rows} hold={5} {...props} />
        </ThemeModeContext.Provider>
    );

    //
    // the line's last day is at its right end, and the last whose 5-day result
    // is in five days before it: 132px wide, less its 4px margins, over 29 steps
    //
    const at = (container, x) => pointAt(container.querySelector('.recharts-wrapper'), x, 18);
    const lastIn = 4 + (124 / 29) * 24;

    afterEach(() => {
        mockMobile = false;
    });

    it('shows the hold\'s average and the baseline\'s on it in its box, the score named with the hold', () => {
        const { container } = trend();

        at(container, lastIn);

        const tip = container.querySelector('.model-trend-tip');

        expect(tip.querySelector('.model-tip-title')).toHaveTextContent(shortDay(rows[24].day));
        expect([...tip.querySelectorAll('.model-tip-row')].map((row) => row.textContent)).toEqual([
            `Loss, 5-day hold${formatScore(rows[24].average.loss_5d, 'loss')}`,
            `Baseline${formatScore(rows[24].baseline_average.loss_5d, 'loss')}`,
        ]);
    });

    it('shows no box, and no dot, on a day whose result on the hold is not in yet', () => {
        const { container } = trend();

        at(container, 128);

        expect(container.querySelector('.model-trend-tip')).toBeNull();
    });

    it('names Combined in its box', () => {
        const all = heldTrackOf(30, { notIn: 0, twenty: 30 });
        const { container } = trend({ rows: all, hold: 'combined' });

        at(container, 128);

        expect(container.querySelector('.model-trend-tip .model-tip-name')).toHaveTextContent('Loss, combined');
        expect(screen.getByRole('img', { name: /^tables-gnn's Loss, combined, 20-day average, \w{3} \d+ – \w{3} \d+$/ })).toBeInTheDocument();
    });

    it('draws a record without the hold\'s columns on its plain scores, as one before format 5', () => {
        const { container } = trend({ rows: trackOf(10), axis: recentDays({ a: trackOf(10) }) });

        at(container, 128);

        expect(container.querySelector('.model-trend-tip .model-tip-name')).toHaveTextContent(/^Loss$/);
    });

    it('names the 1-day hold no more than a list before format 5 does', () => {
        trend({ hold: 1 });

        expect(screen.getByRole('img', { name: /^tables-gnn's Loss, 20-day average, \w{3} \d+ – \w{3} \d+$/ })).toBeInTheDocument();
    });

    describe('on a phone, the day tapped', () => {
        beforeEach(() => {
            mockMobile = true;
        });

        const tap = (container, x) => act(() => tapAt(container.querySelector('.recharts-wrapper'), x, 18));

        it('opens the same box a computer shows under the pointer, with a dot on each line', () => {
            const { container } = trend();

            expect(container.querySelector('.model-trend-tip')).toBeNull();

            tap(container, lastIn);

            expect(container.querySelector('.model-trend-tip .model-tip-title')).toHaveTextContent(shortDay(rows[24].day));
            expect(container.querySelectorAll('.recharts-active-dot')).toHaveLength(2);
        });

        it('moves to another day tapped', () => {
            const { container } = trend();

            tap(container, lastIn);
            tap(container, 4 + (124 / 29) * 10);

            expect(container.querySelector('.model-trend-tip .model-tip-title')).toHaveTextContent(shortDay(rows[10].day));
        });

        it('closes on a second tap of the same day, and opens again on a third', () => {
            const { container } = trend();

            tap(container, lastIn);
            tap(container, lastIn);

            expect(container.querySelector('.model-trend-tip')).toBeNull();
            expect(container.querySelectorAll('.recharts-active-dot')).toHaveLength(0);

            tap(container, lastIn);

            expect(container.querySelector('.model-trend-tip')).not.toBeNull();
        });

        it('closes on a tap anywhere else', async () => {
            const { container } = trend();

            tap(container, lastIn);
            await userEvent.click(screen.getByRole('button', { name: 'elsewhere' }));

            expect(container.querySelector('.model-trend-tip')).toBeNull();
        });

        it('opens nothing for a day with no result on the hold', () => {
            const { container } = trend();

            tap(container, 128);

            expect(container.querySelector('.model-trend-tip')).toBeNull();
        });
    });
});

describe('TrendLine\'s width (#300)', () => {
    const trend = () => render(
        <ThemeModeContext.Provider value={{ theme: 'light' }}>
            <TrendLine name='pt-gnn' score='loss' axis={recentDays({ a: trackOf(10) })} rows={trackOf(10)} />
        </ThemeModeContext.Provider>
    );

    const widthOf = (container) => Number(container.querySelector('.model-trend svg').getAttribute('width'));

    afterEach(() => {
        delete window.ResizeObserver;
    });

    it('is 132px where the room its row gives it cannot be measured', () => {
        expect(widthOf(trend().container)).toBe(132);
    });

    it('is as wide as the room its row gives it, on any screen, followed as the row is resized, and no narrower than 132px', () => {
        let resized;
        const disconnect = jest.fn();

        window.ResizeObserver = jest.fn((callback) => {
            resized = callback;

            return { observe: jest.fn(), disconnect: disconnect };
        });

        const { container, unmount } = trend();

        act(() => resized([{ contentRect: { width: 311.6 } }]));
        expect(widthOf(container)).toBe(311);

        act(() => resized([{ contentRect: { width: 80 } }]));
        expect(widthOf(container)).toBe(132);

        unmount();
        expect(disconnect).toHaveBeenCalled();
    });

    it('measures its room once the record is in, after the line\'s placeholder', () => {
        let resized;

        window.ResizeObserver = jest.fn((callback) => {
            resized = callback;

            return { observe: jest.fn(), disconnect: jest.fn() };
        });

        const axis = recentDays({ a: trackOf(10) });
        const line = (rows) => (
            <ThemeModeContext.Provider value={{ theme: 'light' }}>
                <TrendLine name='pt-gnn' score='loss' axis={axis} rows={rows} />
            </ThemeModeContext.Provider>
        );
        const { container, rerender } = render(line(undefined));

        expect(window.ResizeObserver).not.toHaveBeenCalled();

        rerender(line(trackOf(10)));
        act(() => resized([{ contentRect: { width: 340 } }]));

        expect(widthOf(container)).toBe(340);
    });
});

describe('PartCells on its own (#283, #300)', () => {
    it('reads the plain columns where it is handed no hold and no task, as a list before format 5', () => {
        const rows = trackOf(10);
        const { container } = render(<PartCells model={modelOf()} rows={rows} />);

        expect(container.querySelector('.model-part-cell-value')).toHaveTextContent(formatScore(rows[9].average.up_log_loss, 'loss'));
        expect(container.querySelector('.model-parts-note')).toHaveTextContent(/^Loss 1\.600, part by part, last 20 days$/);
        expect(container.querySelector('.model-parts-note')).toHaveAccessibleDescription(noteOf('loss'));
    });
});

describe('the box over a trend line near its right end (#318)', () => {
    const trend = () => render(
        <ThemeModeContext.Provider value={{ theme: 'light' }}>
            <TrendLine name='tables-gnn' score='loss' axis={recentDays({ a: trackOf(10) })} rows={trackOf(10)} />
        </ThemeModeContext.Provider>
    );

    //
    // the box's left edge, as recharts places it, from the line's left. jsdom
    // measures every box as nothing, and recharts places a box only once it has
    // a size: here the box is 150px wide, wider than the 132px line, as a real
    // one is
    //
    const leftOf = (container) => Number(container.querySelector('.recharts-tooltip-wrapper').style.transform.match(/translate\((-?[\d.]+)px/)[1]);

    beforeEach(() => {
        const measured = Element.prototype.getBoundingClientRect;

        jest.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function measure() {
            return this.classList.contains('recharts-tooltip-wrapper')
                ? { width: 150, height: 40, top: 0, left: 0, right: 150, bottom: 40, x: 0, y: 0 }
                : measured.call(this);
        });
    });

    afterEach(() => {
        jest.restoreAllMocks();
        mockMobile = false;
    });

    it('stands beside the pointer on a computer, past the narrow line\'s right end', () => {
        const { container } = trend();

        pointAt(container.querySelector('.recharts-wrapper'), 128, 18);

        expect(container.querySelector('.model-trend-tip')).not.toBeNull();
        expect(leftOf(container)).toBeGreaterThan(128);
    });

    it('opens to the left of a tap near its right end on a phone, inside the line, where it had opened past the screen\'s edge', () => {
        mockMobile = true;

        const { container } = trend();

        act(() => tapAt(container.querySelector('.recharts-wrapper'), 128, 18));

        expect(container.querySelector('.model-trend-tip')).not.toBeNull();
        expect(leftOf(container)).toBeLessThan(128);
    });
});
