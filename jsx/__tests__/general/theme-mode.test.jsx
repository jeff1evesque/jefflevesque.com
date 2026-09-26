/**
 * theme-mode.test.jsx: the theme the page is drawn in, and the switch that changes
 * it.
 *
 * Held here: that the page opens in the reader's choice, or the system's where they
 * have made none; that the switch in the header changes the page and keeps the
 * change for the next visit; that the page follows the system while the reader has
 * not chosen, and stops following it once they have; and that mui's components are
 * handed the theme the stylesheet is drawing.
 *
 * Note: the provider is rendered with a probe beside the switch that records what
 *       it is told, the way the page's own components read it.
 */

import React, { useContext } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { useTheme } from '@mui/material/styles';
import ThemeMode, { ThemeModeContext, MUI_THEMES } from '../../import/general/theme-mode.jsx';
import ThemeToggle from '../../import/navigation/theme-toggle.jsx';
import { readTheme, writeTheme, KEY } from '../../import/general/theme-preference.js';
import { colors_dark } from '../../import/general/colors.js';

function Probe() {
    const { theme } = useContext(ThemeModeContext);
    const mui = useTheme();

    return <output data-testid='probe' data-theme={theme} data-mui={mui.palette.mode} />;
}

//
// a system that asks for `theme`, and can change its mind: `flip` tells every
// listener the system now asks for the other one
//
function system(theme) {
    const listeners = new Set();
    const query = {
        matches: theme === 'dark',
        addEventListener: (type, listener) => listeners.add(listener),
        removeEventListener: (type, listener) => listeners.delete(listener),
    };

    window.matchMedia = jest.fn().mockReturnValue(query);

    return {
        listeners: listeners,
        flip(next) {
            query.matches = next === 'dark';
            listeners.forEach((listener) => listener({ matches: query.matches }));
        },
    };
}

function page() {
    return render(
        <ThemeMode>
            <ThemeToggle />
            <Probe />
        </ThemeMode>
    );
}

const probe = () => screen.getByTestId('probe');
const toggle = () => screen.getByRole('button', { name: 'Dark theme' });
const root = () => document.documentElement.getAttribute('data-theme');

beforeEach(() => {
    window.localStorage.clear();
});

afterEach(() => {
    delete window.matchMedia;
    document.documentElement.removeAttribute('data-theme');
});

describe('the theme a page opens in', () => {
    it('is light for a reader who has not chosen, on a system that does not ask', () => {
        page();

        expect(probe().dataset.theme).toBe('light');
        expect(root()).toBe('light');
    });

    it('is the system\'s for a reader who has not chosen', () => {
        system('dark');
        page();

        expect(probe().dataset.theme).toBe('dark');
        expect(root()).toBe('dark');
    });

    it('is exactly the reader\'s choice once they have made one, whatever the system says', () => {
        system('dark');
        writeTheme('light');
        page();

        expect(probe().dataset.theme).toBe('light');
        expect(root()).toBe('light');
    });
});

describe('the switch', () => {
    it('shows a moon on a light page, which is where it would take it', () => {
        page();

        expect(toggle()).toHaveAttribute('aria-pressed', 'false');
        expect(toggle()).toHaveAttribute('title', 'Switch to the dark theme');
        expect(toggle().querySelector('[data-testid="DarkModeOutlinedIcon"]')).not.toBeNull();
    });

    it('turns the page dark, and shows a sun that would bring it back', () => {
        page();

        fireEvent.click(toggle());

        expect(probe().dataset.theme).toBe('dark');
        expect(root()).toBe('dark');
        expect(toggle()).toHaveAttribute('aria-pressed', 'true');
        expect(toggle()).toHaveAttribute('title', 'Switch to the light theme');
        expect(toggle().querySelector('[data-testid="LightModeOutlinedIcon"]')).not.toBeNull();
    });

    it('turns it light again', () => {
        page();

        fireEvent.click(toggle());
        fireEvent.click(toggle());

        expect(probe().dataset.theme).toBe('light');
        expect(root()).toBe('light');
    });

    it('keeps the choice, and the next visit opens in it', () => {
        const first = page();

        fireEvent.click(toggle());
        expect(window.localStorage.getItem(KEY)).toBe('dark');

        first.unmount();
        document.documentElement.removeAttribute('data-theme');
        page();

        expect(probe().dataset.theme).toBe('dark');
        expect(root()).toBe('dark');
    });

    it('keeps a choice of light over a dark system, for the next visit too', () => {
        system('dark');
        const first = page();

        fireEvent.click(toggle());
        expect(readTheme()).toBe('light');

        first.unmount();
        page();

        expect(probe().dataset.theme).toBe('light');
    });

    it('still changes the page where storage refuses to keep it', () => {
        const storage = window.localStorage;

        Object.defineProperty(window, 'localStorage', {
            configurable: true,
            value: {
                getItem() { throw new Error('denied'); },
                setItem() { throw new Error('denied'); },
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

describe('following the system', () => {
    it('follows it while the reader has not chosen', () => {
        const settings = system('light');
        page();

        act(() => { settings.flip('dark'); });

        expect(probe().dataset.theme).toBe('dark');
        expect(root()).toBe('dark');
    });

    it('stops following it once the reader has chosen', () => {
        const settings = system('light');
        page();

        fireEvent.click(toggle());
        act(() => { settings.flip('light'); });

        expect(probe().dataset.theme).toBe('dark');
    });

    it('stops listening when the page goes', () => {
        const settings = system('light');
        const { unmount } = page();

        expect(settings.listeners.size).toBe(1);

        unmount();

        expect(settings.listeners.size).toBe(0);
    });

    it('follows it back to light as well', () => {
        const settings = system('dark');
        page();

        act(() => { settings.flip('light'); });

        expect(probe().dataset.theme).toBe('light');
        expect(root()).toBe('light');
    });

    it('opens in the system\'s theme on a browser that cannot tell it of a change', () => {
        //
        // a MediaQueryList with neither way to listen: the page reads the setting
        // once, and mounts and unmounts without asking for more
        //
        window.matchMedia = jest.fn().mockReturnValue({ matches: true });

        const { unmount } = page();

        expect(probe().dataset.theme).toBe('dark');
        expect(() => unmount()).not.toThrow();
    });

    it('listens the old way on a browser that only knows it', () => {
        //
        // Safari before 14 has addListener on a MediaQueryList, and no
        // addEventListener
        //
        const listeners = new Set();

        window.matchMedia = jest.fn().mockReturnValue({
            matches: false,
            addListener: (listener) => listeners.add(listener),
            removeListener: (listener) => listeners.delete(listener),
        });

        const { unmount } = page();

        act(() => { [...listeners].forEach((listener) => listener({ matches: true })); });
        expect(probe().dataset.theme).toBe('dark');

        unmount();
        expect(listeners.size).toBe(0);
    });
});

describe('mui\'s components', () => {
    it('are handed the theme the page is drawn in', () => {
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
    // one object per theme: a component reading the context draws again when the
    // theme changes, and not on every render of the provider
    //
    function Recorder({ seen }) {
        seen.push(useContext(ThemeModeContext));

        return null;
    }

    it('is the same object until the theme changes', () => {
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
