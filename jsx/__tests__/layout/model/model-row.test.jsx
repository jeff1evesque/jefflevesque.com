/**
 * model-row.test.jsx: one model in /model's list (#243), and its trend line.
 *
 * Note: the trend line is a fixed-size recharts chart, not a responsive one,
 *       so recharts draws it for real under jsdom without a size given to it.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

import ModelRow, { TrendLine } from '../../../import/layout/model/model-row.jsx';
import { ThemeModeContext } from '../../../import/general/theme-mode.jsx';
import { COMPARE_COLORS, SCORES, noteOf, recentDays } from '../../../import/layout/model/scores.js';
import { OPTIONS_TASK, downModelOf, modelOf, optionsModelOf, trackOf } from '../../../test-support/model-fixtures.js';

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

describe('a row', () => {
    it('links the model\'s name to its page, and prints its address and description', () => {
        draw();

        expect(screen.getByRole('link', { name: 'pt-gnn' })).toHaveAttribute('href', '/model/pt-gnn');
        expect(screen.getByText('/model/pt-gnn')).toHaveClass('model-address');
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

    it('prints the 20-day score, and how it stands against the baseline', () => {
        const { container } = draw();

        expect(container.querySelector('.model-score-value')).toHaveTextContent('1.600');
        expect(container.querySelector('.model-gap')).toHaveTextContent('▲ 0.060 better than the baseline');
        expect(container.querySelector('.model-gap')).toHaveClass('model-gap-better');
    });

    it('says when it is worse than the baseline, or level with it', () => {
        const worse = draw({ model: modelOf({ score: { loss: 1.7 } }) }).container;

        expect(worse.querySelector('.model-gap')).toHaveTextContent('▼ 0.040 worse than the baseline');

        const level = draw({ model: modelOf({ score: { loss: 1.66 } }) }).container;

        expect(level.querySelector('.model-gap')).toHaveTextContent('level with the baseline');
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

    it('names the score\'s figure for a phone\'s card, as its status reads it', () => {
        const live = draw().container;
        const fresh = draw({ model: modelOf({ scored_days: 3 }) }).container;
        const one = draw({ model: modelOf({ scored_days: 1 }) }).container;
        const retired = draw({ model: modelOf({ retired: '2026-10-01' }) }).container;

        expect(live.querySelector('.model-cell-score .model-cell-label')).toHaveTextContent('Loss, last 20 days');
        expect(fresh.querySelector('.model-cell-score .model-cell-label')).toHaveTextContent('Loss, 3 days so far');
        expect(one.querySelector('.model-cell-score .model-cell-label')).toHaveTextContent('Loss, 1 day so far');
        expect(retired.querySelector('.model-cell-score .model-cell-label')).toHaveTextContent('Loss, last 20 days before retiring');
    });

    it.each(SCORES.map((score) => [score.key, score.note]))('names the score\'s figure on a phone\'s card with %s\'s note (#265)', (key, note) => {
        const { container } = draw({ score: key });
        const label = container.querySelector('.model-cell-score .model-cell-label');

        expect(label).toHaveAccessibleDescription(note);
        expect(label).toHaveAttribute('tabindex', '0');
        expect(label.querySelector('svg')).toHaveAttribute('data-testid', 'InfoOutlinedIcon');
    });

    it('names an options model\'s score with its task\'s note, and prints its top 10\'s gain as a percent (#279)', () => {
        const loss = draw({ model: optionsModelOf(), task: OPTIONS_TASK }).container;

        expect(loss.querySelector('.model-cell-score .model-cell-label')).toHaveAccessibleDescription(noteOf('loss', OPTIONS_TASK));
        expect(loss.querySelector('.model-score-value')).toHaveTextContent('0.840');

        const gain = draw({ model: optionsModelOf(), task: OPTIONS_TASK, score: 'top10_gain' }).container;

        expect(gain.querySelector('.model-score-value')).toHaveTextContent('3.10%');
        expect(gain.querySelector('.model-gap')).toHaveTextContent('▲ 7.30 pts better than the baseline');
        expect(gain.querySelector('.model-cell-score .model-cell-label')).toHaveAccessibleDescription(noteOf('top10_gain', OPTIONS_TASK));
    });

    it('prints a dash for a score the listing gives a model none of, as one before format 3 (#279)', () => {
        const { container } = draw({ score: 'top10_wins' });

        expect(container.querySelector('.model-score-value')).toHaveTextContent('–');
        expect(container.querySelector('.model-gap')).toHaveTextContent(/^$/);
        expect(container.querySelector('.model-trend-none')).toHaveAttribute('title', 'Not scored in the last 60 days');
    });

    it('shows the score\'s note under the pointer, on a phone\'s card (#265)', async () => {
        const { container } = draw();

        await userEvent.hover(container.querySelector('.model-cell-score .model-cell-label'));

        expect(await screen.findByRole('tooltip')).toHaveTextContent(SCORES[0].note);
    });

    it('says when the live version went live and how, and how many attempts did', () => {
        const { container } = draw();

        expect(container.querySelector('.model-cell-live')).toHaveTextContent('Oct 9nightly update');
        expect(container.querySelector('.model-cell-went')).toHaveTextContent('4 of 30attempts');
    });

    it('says a retired model is no longer trained, and dims it', () => {
        const { container } = draw({ model: modelOf({ retired: '2026-10-02' }) });

        expect(container.querySelector('.model-row')).toHaveClass('model-row-retired');
        expect(container.querySelector('.model-cell-live')).toHaveTextContent('Retired Oct 2no longer trained');
    });

    it('prints a dash for a live version with no day', () => {
        const { container } = draw({ model: modelOf({ live: { since: null, kind: null } }) });

        expect(container.querySelector('.model-cell-live .model-figure')).toHaveTextContent('–');
    });
});

describe('a model whose live version was taken down (#263)', () => {
    it('says Behind baseline on its pill', () => {
        draw({ model: downModelOf() });

        expect(screen.getByText('Behind baseline')).toHaveClass('model-pill', 'model-pill-down');
    });

    it('says when, and the check that did it, in place of when it went live', () => {
        const { container } = draw({ model: downModelOf() });

        expect(container.querySelector('.model-cell-live .model-figure')).toHaveTextContent(/^Taken down Oct 19$/);
        expect(container.querySelector('.model-cell-live .model-figure-detail'))
            .toHaveTextContent(/^worse than the baseline 5 scored days in a row$/);
    });

    it('words an average\'s check as an average\'s', () => {
        const { container } = draw({ model: downModelOf({ down: { since: '2026-10-19', days: 5, in_a_row: 10 } }) });

        expect(container.querySelector('.model-cell-live .model-figure-detail'))
            .toHaveTextContent('its 5-day average was worse than the baseline’s 10 days in a row');
    });

    it('names its score so far where it was taken down before its 20th scored day', () => {
        const { container } = draw({ model: downModelOf({ scored_days: 7 }) });

        expect(container.querySelector('.model-cell-score .model-cell-label')).toHaveTextContent('Loss, 7 days so far');
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
    // at the end of the row, and at the top of a phone's card -- see '_model.scss'
    // -- leading to the model's alarm page
    //
    const bellIn = (container) => container.querySelector('.model-cell-alarm svg');

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

    it('is left off a retired model, whose cell stays, so the columns still line up', () => {
        const { container } = draw({ model: modelOf({ retired: '2026-10-02' }), held: true });

        expect(container.querySelector('.model-cell-alarm')).toBeEmptyDOMElement();
        expect(screen.queryByRole('link', { name: /^Alarm for/ })).toBeNull();
    });

    it('comes after the model\'s name and before its score, as a stream\'s does on /stream (#259)', () => {
        //
        // a wide screen places a row's cells by their order, into the columns
        // '_model.scss' gives them -- see stylesheet.test.js beside this one. It
        // came last, at the far right, where /stream has a row's figures
        //
        const { container } = draw();
        const cells = [...container.querySelectorAll('.model-row > .model-cell')];

        expect(cells.map((cell) => cell.classList[1])).toEqual([
            'model-cell-compare',
            'model-cell-model',
            'model-cell-alarm',
            'model-cell-score',
            'model-cell-trend',
            'model-cell-live',
            'model-cell-went',
        ]);
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

        expect(screen.getByRole('img', { name: 'pt-gnn\'s 20-day Loss, over the last 60 days' })).toBeInTheDocument();
        expect(container.querySelectorAll('.recharts-line')).toHaveLength(2);
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
});
