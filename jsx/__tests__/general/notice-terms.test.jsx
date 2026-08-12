/**
 * notice-terms.test.jsx: the "you need to log in" notice.
 *
 * Shared by five callers -- the stream alarm and the four trigger content pages -- so
 * every default here is what a signed-out visitor reads on all five. The component is
 * pure presentation, and all of its behaviour is in the constructor's defaults and the
 * componentDidUpdate that keeps them current.
 *
 * That update method carried two copy-paste defects, both fixed and both pinned below:
 * the terms branch wrote the heading, and the icon_color branch compared the terms
 * against the old colour.
 *
 * Note: renders a LoginLink, so everything is wrapped in a router.
 */

import React from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import NoticeTerms from '../../import/general/notice-terms.jsx';

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

    it('colours the privacy icon green', () => {
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

    it('takes a custom icon colour', () => {
        setup({ icon_color: 'red' });

        expect(document.querySelector('h4 svg').getAttribute('style')).toContain('red');
    });

    it('accepts an empty footer suffix', () => {
        //
        // the mobile default is the empty string, so an explicit '' must be honoured
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

    it('syncs a changed icon colour', () => {
        //
        // FIXED, in notice-terms.jsx. The guard compared two unrelated fields:
        //
        //     && this.props.terms !== prevProps.icon_color
        //
        // A terms paragraph is never equal to a colour name, so the branch fired on
        // essentially every update whether or not the colour had changed -- and would
        // have failed to fire in the one case where they happened to match.
        //
        const { rerender } = setup({ icon_color: 'green' });

        rerender({ icon_color: 'red' });

        expect(document.querySelector('h4 svg').getAttribute('style')).toContain('red');
    });

    it('does not adopt an invalid changed colour', () => {
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
