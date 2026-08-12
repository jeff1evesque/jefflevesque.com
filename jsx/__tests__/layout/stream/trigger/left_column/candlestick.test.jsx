/**
 * candlestick.test.jsx: the trigger page's filter column.
 *
 * The only interactive piece in layout/stream/trigger/, and the one place where the
 * page's two halves are wired together: the switch and the two selectors here decide
 * what the chart draws (through the toggleChartScale callback) and what the rest of
 * the page hides (through the redux hide action). Both are call-outs, so both are
 * asserted on the calls rather than on the pixels.
 *
 * The component has three faces and swaps between them by internal state:
 *
 *   - the filter panel (desktop, and the expanded mobile sheet),
 *   - a bare 'Filter' button (mobile, before the sheet is opened),
 *   - the panel plus 'Edit Content Filter' and 'Apply Filter' (mobile, sheet open).
 *
 * Note: the redux container wraps this component in production; here dispatchHide is
 *       a spy, which is what makes the hide protocol legible.
 *
 * Note: 'react-device-detect' is mocked behind a getter -- the mobile filter header
 *       is unreachable otherwise.
 */

import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

let mockMobile = false;

jest.mock('react-device-detect', () => ({
    get isMobile() { return mockMobile; },
}));

import CandlestickLeftColumn from
    '../../../../../import/layout/stream/trigger/left_column/candlestick.jsx';
import getData from '../../../../../import/general/get-data.js';
import { dstDate } from '../../../../../import/general/dst.js';

const RATES = ['monthly', 'daily', 'hourly', 'minutes'];
const KEYS = ['inverted_hammer', 'shooting_star', 'hammer'];

beforeEach(() => {
    mockMobile = false;
});

function setup(props = {}) {
    const dispatchHide = jest.fn();
    const toggleChartScale = jest.fn();

    const utils = render(
        <CandlestickLeftColumn
            dispatchHide={dispatchHide}
            toggleChartScale={toggleChartScale}
            candlestick_rates={RATES}
            chart_data_keys={KEYS}
            {...props}
        />
    );

    return { ...utils, dispatchHide, toggleChartScale };
}

//
// the two selectors carry no accessible label of their own -- MUI's InputLabel is
// only associated by id -- so they are reached through the form control that holds
// the visible label.
//
function selector(label) {
    const control = screen.getByText(label).closest('.MuiFormControl-root');
    return within(control).getByRole('combobox');
}

async function choose(label, option) {
    await userEvent.click(selector(label));
    await userEvent.click(screen.getByRole('option', { name: option }));
    await userEvent.keyboard('{Escape}');
}

describe('the filter panel', () => {
    it('offers a candlestick switch, off until the chart is drawn', () => {
        setup();

        expect(screen.getByRole('checkbox', { name: 'Candlestick' })).not.toBeChecked();
    });

    it('shows the switch on when the chart is drawn', () => {
        setup({ display_candlestick: true });

        expect(screen.getByRole('checkbox', { name: 'Candlestick' })).toBeChecked();
    });

    it('hides the rate and pattern selectors while the chart is off', () => {
        //
        // there is nothing to scale or to filter until a chart exists, so the two
        // selectors follow the switch rather than sitting there inert.
        //
        setup();

        expect(screen.queryByText('Rate')).not.toBeInTheDocument();
        expect(screen.queryByText('Pattern')).not.toBeInTheDocument();
    });

    it('shows both selectors once it is on', () => {
        setup({ display_candlestick: true });

        expect(screen.getByText('Rate')).toBeInTheDocument();
        expect(screen.getByText('Pattern')).toBeInTheDocument();
    });

    it('takes the full width when expanded, and a column when not', () => {
        //
        // 'expanded' is the mobile sheet; the default is the desktop column, which
        // bootstrap hides below the md breakpoint.
        //
        const { unmount } = setup({ expanded: true });
        expect(document.querySelector('.checkbox-vertical-expanded')).not.toBeNull();
        unmount();

        setup();
        expect(document.querySelector('.checkbox-vertical-default')).not.toBeNull();
        expect(document.querySelector('.d-none.d-md-block')).not.toBeNull();
    });
});

describe('toggling the chart', () => {
    it('asks redux to hide the graph, then flips the switch', async () => {
        //
        // the dispatched value is the state BEFORE the flip, which is what makes it
        // read correctly: the chart is currently shown, so hide_graph becomes true.
        //
        const { dispatchHide } = setup({ display_candlestick: true });

        await userEvent.click(screen.getByRole('checkbox', { name: 'Candlestick' }));

        expect(dispatchHide).toHaveBeenCalledWith({
            type: 'SET-HIDE-GRAPH',
            hide_graph: true,
        });
        expect(screen.getByRole('checkbox', { name: 'Candlestick' })).not.toBeChecked();
    });

    it('asks redux to restore it when switched back on', async () => {
        const { dispatchHide } = setup({ display_candlestick: false });

        await userEvent.click(screen.getByRole('checkbox', { name: 'Candlestick' }));

        expect(dispatchHide).toHaveBeenCalledWith({
            type: 'SET-HIDE-GRAPH',
            hide_graph: false,
        });
    });

    it('brings the selectors with it', async () => {
        setup({ display_candlestick: false });

        await userEvent.click(screen.getByRole('checkbox', { name: 'Candlestick' }));

        expect(screen.getByText('Rate')).toBeInTheDocument();
        expect(screen.getByText('Pattern')).toBeInTheDocument();
    });
});

describe('the rate selector', () => {
    it('offers the rates it was given', async () => {
        setup({ display_candlestick: true });

        await userEvent.click(selector('Rate'));

        expect(screen.getByRole('option', { name: 'Monthly' })).toBeInTheDocument();
        expect(screen.getByRole('option', { name: 'Daily' })).toBeInTheDocument();
        expect(screen.getByRole('option', { name: 'Hourly' })).toBeInTheDocument();
        expect(screen.getByRole('option', { name: 'Minutes' })).toBeInTheDocument();
    });

    it('starts on daily', () => {
        //
        // the default selection is derived from trigger_rate, and daily is the rate
        // every stream supports.
        //
        setup({ display_candlestick: true });

        expect(selector('Rate')).toHaveTextContent('Daily');
    });

    it('rescales the chart, carrying the current pattern selection', async () => {
        const { toggleChartScale } = setup({
            display_candlestick: true,
            selected_candlestick: ['hammer'],
        });

        await choose('Rate', 'Hourly');

        expect(toggleChartScale).toHaveBeenCalledWith('hourly', ['hammer']);
    });

    it('keeps one rate rather than accumulating them', async () => {
        //
        // the underlying select is a multi-select; 'multi={false}' is what reduces a
        // rate choice to the last one clicked. Two rates at once would make the
        // aggregation ambiguous.
        //
        const { toggleChartScale } = setup({ display_candlestick: true });

        await choose('Rate', 'Hourly');
        await choose('Rate', 'Monthly');

        expect(toggleChartScale).toHaveBeenLastCalledWith('monthly', []);
        expect(selector('Rate')).toHaveTextContent('Monthly');
    });

    it('keeps the last scale when the rate is cleared', async () => {
        //
        // clicking the selected rate again deselects it, which sends an empty
        // selection through. The chart keeps whatever scale it was on -- redrawing it
        // at no scale would blank it.
        //
        const { toggleChartScale } = setup({ display_candlestick: true });

        await choose('Rate', 'Hourly');
        await choose('Rate', 'Hourly');

        expect(toggleChartScale).toHaveBeenLastCalledWith('hourly', []);
    });
});

describe('the pattern selector', () => {
    it('offers the chart keys, spelled out', async () => {
        //
        // the keys arrive as api column names ('inverted_hammer'); the selector is
        // the only place they are made readable, and they come from the response
        // rather than from a list held here -- so a pattern the api stops sending
        // stops being offered.
        //
        setup({ display_candlestick: true });

        await userEvent.click(selector('Pattern'));

        expect(screen.getByRole('option', { name: 'Inverted Hammer' })).toBeInTheDocument();
        expect(screen.getByRole('option', { name: 'Shooting Star' })).toBeInTheDocument();
        expect(screen.getByRole('option', { name: 'Hammer' })).toBeInTheDocument();
        expect(screen.queryByRole('option', { name: 'Evening Star' })).not.toBeInTheDocument();
    });

    it('filters the chart down to the chosen pattern', async () => {
        const { toggleChartScale } = setup({ display_candlestick: true });

        await choose('Pattern', 'Inverted Hammer');

        expect(toggleChartScale).toHaveBeenCalledWith('Daily', ['inverted_hammer']);
    });

    it('accumulates patterns, unlike the rate', async () => {
        //
        // this selector IS multi: a subscriber compares patterns against each other,
        // which is the whole point of the chart carrying fourteen series.
        //
        const { toggleChartScale } = setup({ display_candlestick: true });

        await choose('Pattern', 'Inverted Hammer');
        await choose('Pattern', 'Hammer');

        expect(toggleChartScale).toHaveBeenLastCalledWith(
            'Daily',
            ['inverted_hammer', 'hammer']
        );
    });

    it('redraws at the rate already chosen', async () => {
        //
        // picking a pattern must not reset the scale, so the two selectors have to
        // agree on one scale_current between them.
        //
        const { toggleChartScale } = setup({ display_candlestick: true });

        await choose('Rate', 'Minutes');
        await choose('Pattern', 'Hammer');

        expect(toggleChartScale).toHaveBeenLastCalledWith('minutes', ['hammer']);
    });

    it('starts from the selection it was handed', async () => {
        const { toggleChartScale } = setup({
            display_candlestick: true,
            selected_candlestick: ['hammer'],
        });

        await choose('Pattern', 'Shooting Star');

        expect(toggleChartScale).toHaveBeenLastCalledWith(
            'Daily',
            ['hammer', 'shooting_star']
        );
    });
});

describe('when the page updates it', () => {
    //
    // the chart's data arrives from the api AFTER this column has mounted, so every
    // one of these paths is the ordinary case rather than an edge.
    //
    function mount(props = {}) {
        const dispatchHide = jest.fn();
        const toggleChartScale = jest.fn();

        const view = (extra = {}) => (
            <CandlestickLeftColumn
                dispatchHide={dispatchHide}
                toggleChartScale={toggleChartScale}
                candlestick_rates={RATES}
                {...props}
                {...extra}
            />
        );

        const utils = render(view());
        return { ...utils, view, dispatchHide, toggleChartScale };
    }

    it('picks up the pattern keys once the response lands', async () => {
        const { rerender, view } = mount({ display_candlestick: true, chart_data_keys: [] });

        rerender(view({ chart_data_keys: KEYS }));
        await userEvent.click(selector('Pattern'));

        expect(screen.getByRole('option', { name: 'Inverted Hammer' })).toBeInTheDocument();
    });

    it('follows the rate the page switches to', () => {
        //
        // as with selected_candlestick, the prop has to be there from the first
        // render: every clause compares against prevProps, and a prop appearing for
        // the first time is not a change.
        //
        const { rerender, view } = mount({
            display_candlestick: true,
            chart_data_keys: KEYS,
            selected_rate: ['daily'],
        });

        rerender(view({ selected_rate: ['hourly'] }));

        expect(selector('Rate')).toHaveTextContent('Hourly');
    });

    it('follows the page hiding and showing the chart', () => {
        const { rerender, view } = mount({ display_candlestick: false, chart_data_keys: KEYS });

        rerender(view({ display_candlestick: true }));

        expect(screen.getByRole('checkbox', { name: 'Candlestick' })).toBeChecked();
    });

    it('follows the pattern selection the page holds', () => {
        //
        // the page starts with nothing selected and fills it from the query string,
        // so the prop has to be present from the first render -- this clause is the
        // one that compares against prevProps, and a prop appearing for the first
        // time is not a change.
        //
        const { rerender, view } = mount({
            display_candlestick: true,
            chart_data_keys: KEYS,
            selected_candlestick: [],
        });

        rerender(view({ selected_candlestick: ['hammer'] }));

        expect(selector('Pattern')).toHaveTextContent('Hammer');
    });

    it('leaves a local toggle alone', async () => {
        //
        // FIXED. Four of the five clauses in componentDidUpdate used to compare a
        // PROP against prevSTATE:
        //
        //     this.props.display_candlestick !== prevState.display_candlestick
        //
        // which fires whenever state disagrees with props for ANY reason, including
        // the user having just changed it here. It took two clauses to bite: an empty
        // chart_data_keys prop is rejected by checkValidArray, so the constructor
        // stored a DIFFERENT empty array, the keys clause saw props !== state and
        // wrote the prop across, and THAT extra update found display_candlestick
        // disagreeing and reverted the switch the user had just moved -- after the
        // redux dispatch had already hidden the graph.
        //
        const { dispatchHide } = mount({ display_candlestick: true, chart_data_keys: [] });

        await userEvent.click(screen.getByRole('checkbox', { name: 'Candlestick' }));

        expect(dispatchHide).toHaveBeenCalledWith({
            type: 'SET-HIDE-GRAPH',
            hide_graph: true,
        });
        expect(screen.getByRole('checkbox', { name: 'Candlestick' })).not.toBeChecked();
    });

    it('keeps it where the user put it when data arrives afterwards', async () => {
        //
        // the response landing is exactly the update that used to revert the switch,
        // and it arrives seconds after the page opens -- so this is the regression
        // test that matters.
        //
        const { rerender, view } = mount({ display_candlestick: true, chart_data_keys: [] });

        await userEvent.click(screen.getByRole('checkbox', { name: 'Candlestick' }));
        rerender(view({ chart_data_keys: KEYS }));

        expect(screen.getByRole('checkbox', { name: 'Candlestick' })).not.toBeChecked();
    });

    it('still yields to the page setting it explicitly', async () => {
        //
        // the flip side: a prop the PAGE changes must still win, or the redux
        // container could no longer drive the column at all.
        //
        const { rerender, view } = mount({ display_candlestick: true, chart_data_keys: KEYS });

        await userEvent.click(screen.getByRole('checkbox', { name: 'Candlestick' }));
        rerender(view({ display_candlestick: false }));
        rerender(view({ display_candlestick: true }));

        expect(screen.getByRole('checkbox', { name: 'Candlestick' })).toBeChecked();
    });
});

describe('the mobile filter button', () => {
    it('replaces the panel with a single Filter button', () => {
        setup({ display_filter_button: true });

        expect(screen.getByRole('button', { name: 'Filter' })).toBeInTheDocument();
        expect(screen.queryByRole('checkbox', { name: 'Candlestick' })).not.toBeInTheDocument();
    });

    it('hides the rest of the page when opened', async () => {
        //
        // the filter is a full-screen sheet on a phone, so opening it asks the page
        // to stand down -- that is what SET-HIDE-ALL does.
        //
        const { dispatchHide } = setup({ display_filter_button: true });

        await userEvent.click(screen.getByRole('button', { name: 'Filter' }));

        expect(dispatchHide).toHaveBeenCalledWith({
            type: 'SET-HIDE-ALL',
            hide_all: true,
        });
        expect(screen.getByText('Edit Content Filter')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Apply Filter' })).toBeInTheDocument();
    });

    it('restores the page when the filter is applied', async () => {
        const { dispatchHide } = setup({ display_filter_button: true });

        await userEvent.click(screen.getByRole('button', { name: 'Filter' }));
        await userEvent.click(screen.getByRole('button', { name: 'Apply Filter' }));

        expect(dispatchHide).toHaveBeenLastCalledWith({
            type: 'SET-HIDE-ALL',
            hide_all: false,
        });
        expect(screen.getByRole('button', { name: 'Filter' })).toBeInTheDocument();
    });

    it('restores the page when the sheet is dismissed', async () => {
        //
        // the exit cross has to undo exactly what opening did, or the page stays
        // hidden with no way back.
        //
        const { dispatchHide } = setup({ display_filter_button: true });

        await userEvent.click(screen.getByRole('button', { name: 'Filter' }));
        await userEvent.click(document.querySelector('.exit'));

        expect(dispatchHide).toHaveBeenLastCalledWith({
            type: 'SET-HIDE-ALL',
            hide_all: false,
        });
        expect(screen.getByRole('button', { name: 'Filter' })).toBeInTheDocument();
    });
});

describe('the mobile filter header', () => {
    it('is absent on desktop, where the page already has a heading', () => {
        setup({ display_filter_button: true, listing_graphic_title: 'Candlestick' });

        expect(screen.queryByText('Candlestick')).not.toBeInTheDocument();
    });

    it('names the trigger and the span being shown', () => {
        //
        // on a phone the chart is off-screen while the filter button is up, so this
        // header is the only thing saying what the numbers cover.
        //
        mockMobile = true;
        setup({
            display_filter_button: true,
            listing_graphic_title: 'Candlestick',
            mm: '03',
        });

        expect(screen.getByText('Candlestick')).toBeInTheDocument();
        expect(screen.getByText('(March)')).toBeInTheDocument();
    });

    it('defaults the month to the current one, in eastern time', () => {
        mockMobile = true;
        setup({ display_filter_button: true, listing_graphic_title: 'Candlestick' });

        const month = getData('list-months')[dstDate().getMonth()];
        expect(screen.getByText(`(${month})`)).toBeInTheDocument();
    });

    it('says Now on the minute rate', () => {
        //
        // FIXED. The constructor used to guard this assignment with the wrong prop:
        //
        //     'trigger_rate' in this.props && checkValidString(this.props.trigger)
        //
        // -- 'this.props.trigger' does not exist, so the guard never passed and the
        // rate fell back to 'Daily' however the chart was actually scaled. A minute
        // chart carried a month name in its header on first paint, which on this page
        // is the paint that matters.
        //
        mockMobile = true;
        setup({
            display_filter_button: true,
            listing_graphic_title: 'Candlestick',
            trigger_rate: 'Minutes',
        });

        expect(screen.getByText('(Now)')).toBeInTheDocument();
        expect(screen.queryByText(`(${getData('list-months')[dstDate().getMonth()]})`))
            .not.toBeInTheDocument();
    });

    it('says Today on the hourly rate', () => {
        mockMobile = true;
        setup({
            display_filter_button: true,
            listing_graphic_title: 'Candlestick',
            trigger_rate: 'Hourly',
        });

        expect(screen.getByText('(Today)')).toBeInTheDocument();
    });

    it('says the year on the monthly rate', () => {
        mockMobile = true;
        setup({
            display_filter_button: true,
            listing_graphic_title: 'Candlestick',
            trigger_rate: 'Monthly',
            yyyy: 2021,
        });

        expect(screen.getByText('(2021)')).toBeInTheDocument();
    });

    it('still says the month on the daily rate it defaults to', () => {
        mockMobile = true;
        setup({
            display_filter_button: true,
            listing_graphic_title: 'Candlestick',
            trigger_rate: 'Daily',
            mm: '03',
        });

        expect(screen.getByText('(March)')).toBeInTheDocument();
    });
});
