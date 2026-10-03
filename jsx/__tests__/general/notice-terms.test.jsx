/**
 * notice-terms.test.jsx: the "you need to log in" notice.
 *
 * Shared by five callers -- the stream alarm and the four trigger content pages -- so
 * every default here is what a signed-out visitor reads on all five. The component is
 * pure presentation, and all of its behavior is in the constructor's defaults and the
 * componentDidUpdate that keeps them current.
 *
 * That update method carried two copy-paste defects, both fixed and both pinned below:
 * the terms branch wrote the heading, and the icon_color branch compared the terms
 * against the old color.
 *
 * Note: renders a LoginLink, so everything is wrapped in a router.
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import NoticeTerms, { TERMS_VERSION } from '../../import/general/notice-terms.jsx';

const fs = require('fs');
const path = require('path');

function setup(props = {}) {
    const held = React.createRef();

    const utils = render(
        <MemoryRouter>
            <NoticeTerms ref={held} {...props} />
        </MemoryRouter>
    );

    return {
        ...utils,
        page: held.current,
        rerender: (next) => utils.rerender(
            <MemoryRouter>
                <NoticeTerms ref={held} {...next} />
            </MemoryRouter>
        ),
    };
}

const text = () => document.body.textContent.replace(/\s+/g, ' ');
const heading = () => document.querySelector('h4').textContent;
const terms = () => document.querySelector('.border-bottom').textContent.replace(/\s+/g, ' ').trim();

describe('the defaults', () => {
    it('names triggers as the subject', () => {
        setup();

        expect(text()).toContain('triggers');
    });

    it('builds the heading from the subject', () => {
        //
        // the desktop heading is a sentence, so a caller changing the subject changes the
        // heading too without having to restate it.
        //
        setup({ subject: 'alarms' });

        expect(heading()).toContain('alarms');
    });

    it('lower-cases the subject inside the terms', () => {
        //
        // the subject reads as a title in the heading and as prose in the terms, so it is
        // cased differently in each.
        //
        setup({ subject: 'Alarms' });

        expect(terms()).toContain('alarms');
        expect(heading()).toContain('Alarms');
    });

    it('offers the default terms text', () => {
        setup();

        expect(terms()).toContain('offered as is');
    });

    it('offers a default notice about accepting the terms', () => {
        setup();

        expect(text()).toContain('you must accept the terms and conditions');
    });

    it('colors the privacy icon green', () => {
        setup();

        expect(document.querySelector('h4 svg').getAttribute('style')).toContain('green');
    });

    it('offers both a login and a signup link', () => {
        setup();

        const links = [...document.querySelectorAll('.agreement-button a')];
        expect(links.length).toBeGreaterThanOrEqual(2);
    });

    it('falls back to its defaults for non-string props', () => {
        //
        // every string prop is validated, so a caller passing the wrong type gets the
        // default rather than a rendered 'undefined'.
        //
        const quiet = jest.spyOn(console, 'error').mockImplementation(() => {});

        setup({ subject: 42, header: 42, terms: 42, icon_color: 42 });

        expect(heading()).toContain('triggers');
        expect(terms()).toContain('offered as is');

        quiet.mockRestore();
    });
});

describe('a signed-in reader', () => {
    //
    // only the alarm page says a reader is signed in. There the notice takes their
    // acceptance of the terms in place of the way to sign in, and the page holds it,
    // since what it lets them turn on depends on it.
    //
    const SIGNED_IN = { subject: 'ingest alarms', signed_in: true, accepted: false };
    const box = () => screen.getByRole('checkbox', { name: 'I accept the terms and conditions' });

    it('is offered the terms to accept, rather than a way to sign in', () => {
        setup(SIGNED_IN);

        expect(box()).not.toBeChecked();
        expect(document.querySelectorAll('.agreement-button a')).toHaveLength(0);
    });

    it('is told what the notice is for, rather than asked to sign in', () => {
        setup(SIGNED_IN);

        expect(heading()).toBe('Subscribe to ingest alarms');
    });

    it('still reads the notice and the terms', () => {
        setup(SIGNED_IN);

        expect(text()).toContain('you must accept the terms and conditions');
        expect(terms()).toContain('offered as is');
    });

    it('reports ticking and unticking the box, which the page holds', () => {
        const onAccept = jest.fn();
        const { rerender } = setup({ ...SIGNED_IN, onAccept: onAccept });

        fireEvent.click(box());
        expect(onAccept).toHaveBeenLastCalledWith(true);

        rerender({ ...SIGNED_IN, accepted: true, onAccept: onAccept });
        expect(box()).toBeChecked();

        fireEvent.click(box());
        expect(onAccept).toHaveBeenLastCalledWith(false);
    });

    it('can be ticked with nothing listening', () => {
        setup(SIGNED_IN);

        expect(() => fireEvent.click(box())).not.toThrow();
    });

    it('is not assumed of any other caller, who gets the way to sign in', () => {
        //
        // the four trigger pages pass no 'signed_in', and subscribing to triggers is
        // not offered yet
        //
        setup({ subject: 'triggers' });

        expect(screen.queryByRole('checkbox')).toBeNull();
        expect(document.querySelectorAll('.agreement-button a').length).toBeGreaterThanOrEqual(2);
    });
});

describe('the version of the terms', () => {
    it('is one the account api accepts', () => {
        //
        // a short token, as the api checks it -- anything else, and every subscribe
        // is refused 400
        //
        expect(TERMS_VERSION).toMatch(/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/);
    });
});

describe('the overrides', () => {
    it('takes a custom heading verbatim', () => {
        setup({ header: 'Sign in first' });

        expect(heading()).toContain('Sign in first');
    });

    it('takes a custom notice element', () => {
        setup({ notice: <p>a custom notice</p> });

        expect(text()).toContain('a custom notice');
    });

    it('takes custom terms', () => {
        setup({ terms: 'these are the terms' });

        expect(terms()).toBe('these are the terms');
    });

    it('takes a custom footer suffix', () => {
        setup({ footer_suffix: ' to continue.' });

        expect(document.querySelector('.agreement-button').textContent)
            .toContain('to continue.');
    });

    it('takes a custom icon color', () => {
        setup({ icon_color: 'red' });

        expect(document.querySelector('h4 svg').getAttribute('style')).toContain('red');
    });

    it('accepts an empty footer suffix', () => {
        //
        // the mobile default is the empty string, so an explicit '' must be honored
        // rather than replaced by the desktop sentence.
        //
        setup({ footer_suffix: '' });

        expect(document.querySelector('.agreement-button').textContent.trim())
            .toMatch(/Sign up$/);
    });
});

describe('keeping up with changed props', () => {
    it('syncs a changed subject into state, which nothing renders', () => {
        //
        // DOCUMENTS DEAD STATE. componentDidUpdate keeps 'subject' current, but render()
        // never reads it -- the heading, terms and footer suffix are all DERIVED from the
        // subject in the CONSTRUCTOR and never recomputed. So changing the subject alone
        // updates state and changes nothing on screen.
        //
        // Not a live problem: the five callers pass a fixed subject and never change it.
        // It becomes one the moment a caller makes the subject dynamic and reasonably
        // expects the sentence to follow.
        //
        const { page, rerender } = setup({ subject: 'triggers' });
        const before = heading();

        rerender({ subject: 'alarms' });

        expect(page.state.subject).toBe('alarms');
        expect(heading()).toBe(before);
        expect(terms()).toContain('triggers');
    });

    it('renders the notice without nesting it in a paragraph', () => {
        //
        // FIXED, in notice-terms.jsx. render() wrapped the notice element in a <p>, and
        // the default notice IS a <p> -- so the markup was '<p><p>...</p></p>', which no
        // browser can nest: the outer paragraph closes as soon as the inner one opens.
        // React warned about it on every render, and the console trap was discarding the
        // warning because the component stack mentioned react-router.
        //
        setup();

        expect(document.querySelector('.agreement-content p p')).toBeNull();
        expect(text()).toContain('you must accept the terms and conditions');
    });

    it('syncs a changed heading', () => {
        const { rerender } = setup({ header: 'First' });

        rerender({ header: 'Second' });

        expect(heading()).toContain('Second');
    });

    it('syncs a changed notice', () => {
        const { rerender } = setup({ notice: <p>first notice</p> });

        rerender({ notice: <p>second notice</p> });

        expect(text()).toContain('second notice');
    });

    it('syncs a changed footer suffix', () => {
        const { rerender } = setup({ footer_suffix: ' first.' });

        rerender({ footer_suffix: ' second.' });

        expect(document.querySelector('.agreement-button').textContent).toContain('second.');
    });

    it('syncs changed terms, and leaves the heading alone', () => {
        //
        // FIXED, in notice-terms.jsx. The terms branch read:
        //
        //     if ('terms' in this.props && ... && this.props.terms !== prevProps.terms) {
        //         this.setState({ header: this.props.header });
        //     }
        //
        // so changing the terms left the terms untouched and overwrote the HEADING with
        // whatever the header prop happened to be -- undefined for every one of the five
        // callers, none of which pass one. The heading simply emptied.
        //
        const { rerender } = setup({ subject: 'alarms', terms: 'first terms' });
        const before = heading();

        rerender({ subject: 'alarms', terms: 'second terms' });

        expect(terms()).toBe('second terms');
        expect(heading()).toBe(before);
    });

    it('syncs a changed icon color', () => {
        //
        // FIXED, in notice-terms.jsx. The guard compared two unrelated fields:
        //
        //     && this.props.terms !== prevProps.icon_color
        //
        // A terms paragraph is never equal to a color name, so the branch fired on
        // essentially every update whether or not the color had changed -- and would
        // have failed to fire in the one case where they happened to match.
        //
        const { rerender } = setup({ icon_color: 'green' });

        rerender({ icon_color: 'red' });

        expect(document.querySelector('h4 svg').getAttribute('style')).toContain('red');
    });

    it('does not adopt an invalid changed color', () => {
        const quiet = jest.spyOn(console, 'error').mockImplementation(() => {});
        const { rerender } = setup({ icon_color: 'green' });

        rerender({ icon_color: 42 });

        expect(document.querySelector('h4 svg').getAttribute('style')).toContain('green');

        quiet.mockRestore();
    });

    it('keeps its state when an unrelated prop changes', () => {
        const { rerender } = setup({ subject: 'alarms', icon_color: 'green' });

        rerender({ subject: 'alarms', icon_color: 'green', className: 'x' });

        expect(heading()).toContain('alarms');
    });
});

//
// the terms as the documentation's Terms page holds them (#202), which every
// page's footer links. The alarm page shows the notice's own text, with the
// subject 'ingest alarms', and a subscribe sends TERMS_VERSION as the terms
// accepted -- so the page has to say the same words under the same version, and
// a change to either alone fails here
//
describe('the Terms page', () => {
    const page = fs.readFileSync(path.join(__dirname, '../../../documentation/terms.md'), 'utf8');
    const folded = page.replace(/^> ?/gm, '').replace(/\s+/g, ' ');

    it('holds the alarm page\'s terms word for word', () => {
        setup({ subject: 'ingest alarms' });

        expect(folded).toContain(terms());
    });

    it('names the version a subscribe sends', () => {
        expect(page).toContain(`**Version ${TERMS_VERSION}**`);
    });
});
