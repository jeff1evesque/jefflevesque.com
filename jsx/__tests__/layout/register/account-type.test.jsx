/**
 * account-type.test.jsx: the three plan tiers shown on the registration page.
 *
 * One method with two layouts. 'getContent(large)' returns the same three tiers either
 * as a bulleted feature list (desktop) or as a single sentence each (mobile), and every
 * class name on the page is chosen by the same flag. So the two calls render different
 * markup for identical content, and a tier renamed in one branch and not the other
 * would show two names depending on the window width.
 *
 * Note: 'rearm/lib/Breakpoint' is mocked the way page-layout.test.jsx mocks it -- the
 *       real one measures a viewport jsdom does not have, so the branch would otherwise
 *       be whatever the default happens to be rather than the one under test.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';

jest.mock('rearm/lib/Breakpoint', () => ({
    BreakpointRender: ({ children }) => children(global.__bp),
}));

import AccountType from '../../../import/layout/register/content/account-type.jsx';

const ORDER = ['small', 'medium', 'large'];

function breakpoint(size) {
    const at = ORDER.indexOf(size);

    return {
        isGt: (other) => at > ORDER.indexOf(other),
        isLte: (other) => at <= ORDER.indexOf(other),
    };
}

function setup(size) {
    global.__bp = breakpoint(size);
    return render(<AccountType />);
}

const TIERS = ['Humble Bee', 'Data Lizard', 'Sourcer Supreme'];

describe('the tiers themselves', () => {
    it.each([['large'], ['small']])('names all three at the %s breakpoint', (size) => {
        //
        // the content is duplicated across the two branches rather than shared, so
        // both are asserted: a tier added to one is not added to the other.
        //
        setup(size);

        TIERS.forEach(tier => expect(screen.getByText(tier)).toBeInTheDocument());
    });

    it.each([['large'], ['small']])('renders each tier exactly once at the %s breakpoint', (size) => {
        setup(size);

        TIERS.forEach(tier => expect(screen.getAllByText(tier)).toHaveLength(1));
    });
});

describe('the desktop layout', () => {
    it('lists the features as bullets', () => {
        //
        // four per tier, twelve in all. The mobile branch has no list at all, which is
        // what separates the two.
        //
        setup('large');

        expect(document.querySelectorAll('li')).toHaveLength(12);
    });

    it('lays the tiers out in thirds', () => {
        setup('large');

        expect(document.querySelectorAll('.col-4')).toHaveLength(3);
        expect(document.querySelectorAll('.col-12')).toHaveLength(0);
    });

    it('wraps itself in a container', () => {
        setup('large');

        expect(document.querySelector('.container.account-type')).toBeInTheDocument();
    });
});

describe('the mobile layout', () => {
    it('replaces the bullets with a sentence per tier', () => {
        setup('small');

        expect(document.querySelectorAll('li')).toHaveLength(0);
        expect(screen.getByText('Use workflows, monitor data stream')).toBeInTheDocument();
    });

    it('stacks the tiers full width', () => {
        setup('small');

        expect(document.querySelectorAll('.col-12')).toHaveLength(3);
        expect(document.querySelectorAll('.col-4')).toHaveLength(0);
    });

    it('drops the container and adds the mobile agreement class', () => {
        //
        // the container is what constrains the width on desktop; keeping it on a phone
        // would leave the three tiers indented inside a viewport already too narrow
        // for them.
        //
        setup('small');

        expect(document.querySelector('.container')).toBeNull();
        expect(document.querySelectorAll('.agreement-mobile')).toHaveLength(3);
    });
});

describe('the breakpoint boundary', () => {
    it('takes the desktop branch only above medium', () => {
        //
        // 'isGt("medium")' -- so medium itself is mobile. The tier count is identical
        // either way, so the bullet list is what tells the two apart.
        //
        setup('medium');

        expect(document.querySelectorAll('li')).toHaveLength(0);
        expect(document.querySelectorAll('.col-12')).toHaveLength(3);
    });
});
