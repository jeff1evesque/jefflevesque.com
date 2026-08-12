/**
 * page-layout.test.jsx: the outermost page chrome.
 *
 * PageLayout decides three things and nothing else: which menu to show (signed in
 * or not), which viewport class the shell carries, and whether the spinner is on.
 * Everything else it merely nests.
 *
 * Note: named 'page-layout' rather than 'page' because __tests__/layout/page.test.jsx
 *       already exists and does NOT test this file -- it drives MainRoute through the
 *       real reducers. layout/page.jsx sat at 0% behind that name.
 *
 * Note: MainRoute and both menu containers are mocked as probes. MainRoute pulls in
 *       the entire route table, and therefore most of the app, so rendering it here
 *       would test everything and pin nothing.
 *
 * Note: 'rearm/lib/Breakpoint' is mocked so the viewport branch can be chosen
 *       directly. It measures a real window, which under jsdom is always the same
 *       size, so the medium and small branches are otherwise unreachable.
 */

import React from 'react';
import { render } from '@testing-library/react';

jest.mock('../../import/route/main-route.jsx', () => ({
    __esModule: true,
    default: () => <div data-testid='main-route' />,
}));

jest.mock('../../import/redux/container/user-menu.jsx', () => ({
    __esModule: true,
    default: () => <div data-testid='user-menu' />,
}));

jest.mock('../../import/redux/container/header-menu.jsx', () => ({
    __esModule: true,
    default: () => <div data-testid='header-menu' />,
}));

jest.mock('../../import/general/spinner.jsx', () => ({
    __esModule: true,
    default: () => <div data-testid='spinner' />,
}));

jest.mock('rearm/lib/Breakpoint', () => ({
    BreakpointRender: ({ children }) => children(global.__bp),
}));

jest.mock('react-device-detect', () => ({
    get isMobile() {
        return global.__isMobile;
    },
}));

import PageLayout from '../../import/layout/page.jsx';

//
// the three sizes the render tree distinguishes, smallest first, so isGt and isLte
// can be answered by comparing positions.
//
const ORDER = ['small', 'medium', 'large'];

function breakpoint(size) {
    const at = ORDER.indexOf(size);

    return {
        isGt: (other) => at > ORDER.indexOf(other),
        isLte: (other) => at <= ORDER.indexOf(other),
    };
}

function setup(props = {}, { size = 'large', mobile = false } = {}) {
    global.__bp = breakpoint(size);
    global.__isMobile = mobile;

    return render(<PageLayout {...props} />);
}

const shell = () => document.querySelector('[class*="-viewport"]');

beforeEach(() => {
    global.__bp = breakpoint('large');
    global.__isMobile = false;
});

describe('the shell', () => {
    it('always renders the route table', () => {
        const { getByTestId } = setup();

        expect(getByTestId('main-route')).toBeTruthy();
    });

    it('puts the routes inside the content column', () => {
        setup();

        expect(document.querySelector('.content [data-testid="main-route"]')).toBeTruthy();
    });

    it('renders the menu in its own container', () => {
        setup();

        expect(document.querySelector('.menu-container')).toBeTruthy();
    });

    it('carries the fluid container class', () => {
        setup();

        expect(shell().className).toContain('container-fluid');
    });
});

describe('the viewport class', () => {
    it.each([
        ['large', 'large-viewport'],
        ['medium', 'medium-viewport'],
        ['small', 'small-viewport'],
    ])('%s renders %s', (size, expected) => {
        //
        // the nested ternary in render() maps three breakpoint answers onto three
        // class names. Getting one wrong styles the whole page for the wrong device,
        // and nothing else in the tree would notice.
        //
        setup({}, { size });

        expect(shell().className).toContain(expected);
    });
});

describe('the device class', () => {
    it('marks a desktop as not-mobile', () => {
        setup({}, { mobile: false });

        expect(shell().className).toContain('not-mobile');
    });

    it('marks a phone as mobile', () => {
        setup({}, { mobile: true });

        expect(shell().className).toContain('mobile');
        expect(shell().className).not.toContain('not-mobile');
    });
});

describe('which menu is shown', () => {
    it('shows the user menu to a signed-in visitor', () => {
        const { getByTestId } = setup({ user: { name: 'jeff' } });

        expect(getByTestId('user-menu')).toBeTruthy();
        expect(document.querySelector('[data-testid="header-menu"]')).toBeNull();
    });

    it('marks the tree authenticated for a signed-in visitor', () => {
        setup({ user: { name: 'jeff' } });

        expect(document.querySelector('.authenticated')).toBeTruthy();
        expect(document.querySelector('.anonymous')).toBeNull();
    });

    it('shows the header menu to a signed-out visitor', () => {
        const { getByTestId } = setup({ user: { name: 'anonymous' } });

        expect(getByTestId('header-menu')).toBeTruthy();
        expect(document.querySelector('[data-testid="user-menu"]')).toBeNull();
    });

    it('treats the literal name "anonymous" as signed out', () => {
        //
        // the signed-in test is a name that is present AND not the string
        // 'anonymous' -- the reducer's default. So a real user actually named
        // anonymous would be shown the signed-out chrome.
        //
        setup({ user: { name: 'anonymous' } });

        expect(document.querySelector('.anonymous')).toBeTruthy();
    });

    it('treats a missing user prop as signed out', () => {
        setup();

        expect(document.querySelector('.anonymous')).toBeTruthy();
    });

    it('treats an empty name as signed out', () => {
        setup({ user: { name: '' } });

        expect(document.querySelector('.anonymous')).toBeTruthy();
    });

    it('wraps the signed-out menu in a bootstrap container on desktop', () => {
        setup({ user: { name: 'anonymous' } }, { mobile: false });

        expect(document.querySelector('.menu-container .container [data-testid="header-menu"]'))
            .toBeTruthy();
    });

    it('drops that container on a phone, where it would add dead margin', () => {
        setup({ user: { name: 'anonymous' } }, { mobile: true });

        expect(document.querySelector('.menu-container .container')).toBeNull();
        expect(document.querySelector('[data-testid="header-menu"]')).toBeTruthy();
    });

    it('does not wrap the signed-in menu at all', () => {
        //
        // asymmetry worth recording: only the anonymous branch gets the wrapping
        // div, so the two menus sit at different depths.
        //
        setup({ user: { name: 'jeff' } });

        expect(document.querySelector('.menu-container > [data-testid="user-menu"]')).toBeTruthy();
    });
});

describe('the spinner', () => {
    it('appears while an effect is pending', () => {
        const { getByTestId } = setup({ effects: { spinner: true } });

        expect(getByTestId('spinner')).toBeTruthy();
    });

    it('stays away when no effect is pending', () => {
        setup({ effects: { spinner: false } });

        expect(document.querySelector('[data-testid="spinner"]')).toBeNull();
    });

    it('stays away when there are no effects at all', () => {
        setup();

        expect(document.querySelector('[data-testid="spinner"]')).toBeNull();
    });

    it('sits alongside the content rather than replacing it', () => {
        //
        // it overlays; the page underneath must still be mounted, or a pending
        // request would blank the view.
        //
        const { getByTestId } = setup({ effects: { spinner: true } });

        expect(getByTestId('main-route')).toBeTruthy();
    });
});

describe('the error boundary', () => {
    it('shows the fallback instead of a blank page when the tree throws', () => {
        //
        // the whole layout is wrapped, so this is the app's last line of defence: a
        // render error anywhere below becomes the fallback rather than an empty
        // document. React reports the caught error through console.error, which
        // setup.js would otherwise treat as a failure, so it is silenced here.
        //
        const quiet = jest.spyOn(console, 'error').mockImplementation(() => {});
        global.__bp = {
            isGt: () => {
                throw new Error('breakpoint exploded');
            },
            isLte: () => false,
        };
        global.__isMobile = false;

        const { container } = render(<PageLayout />);

        expect(container.textContent).not.toBe('');
        expect(document.querySelector('[data-testid="main-route"]')).toBeNull();

        quiet.mockRestore();
    });
});
