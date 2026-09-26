/**
 * theme-mode.test.jsx: the theme the page is drawn in, and the switch that changes
 * it.
 *
 * Held here: that the page opens in the theme the reader's clock gives, or in
 * the one they asked for while that choice holds; that the switch in the header
 * changes the page and keeps the change until the clock's next switch; that a
 * page left open changes at the switch by itself, and again when a tab the
 * browser put to sleep is shown; and that mui's components are handed the theme
 * the stylesheet is drawing.
 *
 * Note: the clock is jest's, set to a moment on New York's -- the zone
 *       jest.config.js pins -- and moved forward the way a page left open would
 *       see it move.
 */

import React, { useContext } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { useTheme } from '@mui/material/styles';
import ThemeMode, { ThemeModeContext, MUI_THEMES, SWITCH_SLACK } from '../../import/general/theme-mode.jsx';
import ThemeToggle from '../../import/navigation/theme-toggle.jsx';
import { readTheme, writeTheme, KEY } from '../../import/general/theme-preference.js';
import { colors_dark } from '../../import/general/colors.js';

function Probe() {
    const { theme } = useContext(ThemeModeContext);
    const mui = useTheme();

    return <output data-testid='probe' data-theme={theme} data-mui={mui.palette.mode} />;
}

function page() {
    return render(
        <ThemeMode>
            <ThemeToggle />
            <Probe />
        </ThemeMode>
    );
}

//
// a moment on the reader's clock, on 2026-09-26 unless another day is named
//
const at = (time, day = '2026-09-26') => new Date(`${day}T${time}:00`);

//
// the page's clock set to `time`, as a page opened then would find it
//
function clock(time, day) {
    jest.useFakeTimers({ now: at(time, day) });
}

//
// the clock moved on by `ms`, with every timer due in that time run
//
function wait(ms) {
    act(() => { jest.advanceTimersByTime(ms); });
}

const HOUR = 60 * 60 * 1000;

const probe = () => screen.getByTestId('probe');
const toggle = () => screen.getByRole('button', { name: 'Dark theme' });
const root = () => document.documentElement.getAttribute('data-theme');

beforeEach(() => {
    window.localStorage.clear();
});

afterEach(() => {
    jest.useRealTimers();
    document.documentElement.removeAttribute('data-theme');
});

describe('the theme a page opens in', () => {
    it('is light by day, on the reader\'s clock', () => {
        clock('12:00');
        page();

        expect(probe().dataset.theme).toBe('light');
        expect(root()).toBe('light');
    });

    it('is dark in the evening', () => {
        clock('21:00');
        page();

        expect(probe().dataset.theme).toBe('dark');
        expect(root()).toBe('dark');
    });

    it('is the reader\'s choice while it holds, whatever the clock says', () => {
        clock('12:00');
        writeTheme('dark', at('11:00'));
        page();

        expect(probe().dataset.theme).toBe('dark');
        expect(root()).toBe('dark');
    });
});

describe('the switch', () => {
    it('shows a moon on a light page, which is where it would take it', () => {
        clock('12:00');
        page();

        expect(toggle()).toHaveAttribute('aria-pressed', 'false');
        expect(toggle().querySelector('[data-testid="DarkModeIcon"]')).not.toBeNull();
    });

    it('says a dark page asked for by day is for the rest of the day', () => {
        clock('12:00');
        page();

        expect(toggle()).toHaveAttribute('title', 'Switch to the dark theme for the rest of the day');
    });

    it('says a light page asked for in the evening is for the rest of the night', () => {
        clock('20:00');
        page();

        expect(toggle()).toHaveAttribute('title', 'Switch to the light theme for the rest of the night');
    });

    it('turns the page dark, and shows a sun that would bring it back to the schedule', () => {
        clock('12:00');
        page();

        fireEvent.click(toggle());

        expect(probe().dataset.theme).toBe('dark');
        expect(root()).toBe('dark');
        expect(toggle()).toHaveAttribute('aria-pressed', 'true');
        expect(toggle()).toHaveAttribute('title', 'Switch to the light theme');
        expect(toggle().querySelector('[data-testid="LightModeIcon"]')).not.toBeNull();
    });

    it('keeps the choice until the next switch, and the next visit opens in it', () => {
        clock('20:00');
        const first = page();

        fireEvent.click(toggle());
        expect(JSON.parse(window.localStorage.getItem(KEY)).theme).toBe('light');

        first.unmount();
        document.documentElement.removeAttribute('data-theme');
        page();

        expect(probe().dataset.theme).toBe('light');
        expect(root()).toBe('light');
    });

    it('puts the page back on its schedule when pressed again', () => {
        clock('12:00');
        page();

        fireEvent.click(toggle());
        fireEvent.click(toggle());

        expect(probe().dataset.theme).toBe('light');
        expect(readTheme(at('12:00'))).toBeNull();
    });

    it('still changes the page where storage refuses to keep it', () => {
        const storage = window.localStorage;

        clock('12:00');
        Object.defineProperty(window, 'localStorage', {
            configurable: true,
            value: {
                getItem() { throw new Error('denied'); },
                setItem() { throw new Error('denied'); },
                removeItem() { throw new Error('denied'); },
                clear() {},
            },
        });

        try {
            page();
            fireEvent.click(toggle());

            expect(probe().dataset.theme).toBe('dark');
        } finally {
            Object.defineProperty(window, 'localStorage', { configurable: true, value: storage });
        }
    });
});

describe('a page left open', () => {
    it('goes dark at 7 in the evening by itself', () => {
        clock('18:59');
        page();

        expect(probe().dataset.theme).toBe('light');

        wait(60 * 1000 + SWITCH_SLACK);

        expect(probe().dataset.theme).toBe('dark');
        expect(root()).toBe('dark');
        expect(toggle()).toHaveAttribute('title', 'Switch to the light theme for the rest of the night');
    });

    it('goes light at 7 in the morning by itself', () => {
        clock('06:30');
        page();

        wait(HOUR / 2 + SWITCH_SLACK);

        expect(probe().dataset.theme).toBe('light');
    });

    it('holds an evening\'s choice of light through midnight, and on into the day', () => {
        clock('20:00');
        page();

        fireEvent.click(toggle());
        wait(6 * HOUR);

        expect(probe().dataset.theme).toBe('light');

        wait(5 * HOUR + SWITCH_SLACK);

        expect(probe().dataset.theme).toBe('light');
        expect(readTheme(new Date())).toBeNull();
    });

    it('holds a day\'s choice of dark into the evening the schedule makes dark too', () => {
        clock('12:00');
        page();

        fireEvent.click(toggle());
        wait(7 * HOUR + SWITCH_SLACK);

        expect(probe().dataset.theme).toBe('dark');
        expect(readTheme(new Date())).toBeNull();

        wait(12 * HOUR);

        expect(probe().dataset.theme).toBe('light');
    });

    it('catches up when a tab the browser put to sleep is shown again', () => {
        //
        // a sleeping tab or a closed laptop hears its timer late, or not at all
        //
        clock('18:00');
        page();

        act(() => {
            jest.setSystemTime(at('20:00'));
            document.dispatchEvent(new Event('visibilitychange'));
        });

        expect(probe().dataset.theme).toBe('dark');
        expect(root()).toBe('dark');
    });

    it('stops keeping time when the page goes', () => {
        clock('18:59');
        const { unmount } = page();

        unmount();

        expect(() => wait(HOUR)).not.toThrow();
        act(() => { document.dispatchEvent(new Event('visibilitychange')); });
    });
});

describe('mui\'s components', () => {
    it('are handed the theme the page is drawn in', () => {
        clock('12:00');
        page();

        expect(probe().dataset.mui).toBe('light');

        fireEvent.click(toggle());

        expect(probe().dataset.mui).toBe('dark');
    });

    it('sit on the page\'s own dark surface, in its own text', () => {
        //
        // a menu or a table on a slightly different black from the page reads as
        // a hole in it
        //
        const { palette } = MUI_THEMES.dark;

        expect(palette.background.default).toBe(colors_dark['white-1']);
        expect(palette.background.paper).toBe(colors_dark['white-1']);
        expect(palette.text.primary).toBe(colors_dark['gray-8']);
    });

    it('draw the light page in mui\'s own default, as they always have', () => {
        expect(MUI_THEMES.light.palette.mode).toBe('light');
        expect(MUI_THEMES.light.palette.background.default).toBe('#fff');
    });
});

describe('what the page\'s components are told', () => {
    //
    // one object per theme and schedule: a component reading the context draws
    // again when either changes, and not on every render of the provider
    //
    function Recorder({ seen }) {
        seen.push(useContext(ThemeModeContext));

        return null;
    }

    it('is the same object until the theme changes', () => {
        clock('12:00');

        const seen = [];
        const { rerender } = render(<ThemeMode><Recorder seen={seen} /><ThemeToggle /></ThemeMode>);

        rerender(<ThemeMode><Recorder seen={seen} /><ThemeToggle /></ThemeMode>);

        expect(seen[seen.length - 1]).toBe(seen[0]);

        fireEvent.click(toggle());

        expect(seen[seen.length - 1]).not.toBe(seen[0]);
        expect(seen[seen.length - 1].theme).toBe('dark');
    });
});

describe('a component drawn on its own', () => {
    it('reads the light theme, with nothing to switch', () => {
        render(<Probe />);

        expect(probe().dataset.theme).toBe('light');
    });

    it('draws a switch that does nothing, rather than failing', () => {
        render(<ThemeToggle />);

        expect(() => fireEvent.click(toggle())).not.toThrow();
    });
});

describe('the switch\'s place', () => {
    it('takes a class that places it where it is drawn', () => {
        render(<ThemeToggle className='theme-toggle-bar' />);

        expect(toggle()).toHaveClass('theme-toggle', 'theme-toggle-bar');
    });
});
