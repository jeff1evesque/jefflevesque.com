/**
 * article-listing-sort.test.jsx: how the shared listing sorts and renders detail.
 *
 * article-listing.test.jsx covers the filter and what a visitor sees. This covers the
 * three methods underneath it, which between them hold most of the file's branching:
 *
 *   - sorter, a comparator factory used by every sort
 *   - handleSelect, an eight-way branch on the chosen sort key
 *   - renderDetail and reformatDate, which build the per-row detail line
 *
 * All four layouts (model, stream, data, home-page) share this component, so each of
 * these behaviours is felt in four places at once.
 *
 * Note: driven through a ref. handleSelect is a change handler bound to a dropdown
 *       whose options differ per caller -- 'Ratio' only exists on the home page,
 *       'Health' only on the stream page -- so reaching every branch through the UI
 *       would mean rendering four different callers to test one method.
 */

import React from 'react';
import { render, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import ArticleListing from '../../import/general/article-listing.jsx';

function setup(props = {}) {
    const held = React.createRef();

    render(
        <MemoryRouter>
            <ArticleListing ref={held} title='Streams' {...props} />
        </MemoryRouter>
    );

    return held.current;
}

//
// choose a sort the way the dropdown does, and flush the resulting state.
//
function select(page, key, type = null) {
    act(() => {
        page.handleSelect(key, type);
    });

    return page.state.list_article.map(v => (v === null ? null : v.name));
}

describe('sorter', () => {
    const compare = (page, key, ascend, a, b) => page.sorter(key, ascend)(a, b);

    it('sorts strings ascending', () => {
        const page = setup();

        expect(compare(page, 'name', true, { name: 'A' }, { name: 'B' })).toBe(-1);
    });

    it('sorts strings descending', () => {
        const page = setup();

        expect(compare(page, 'name', false, { name: 'A' }, { name: 'B' })).toBe(1);
    });

    it('is case-insensitive, so casing does not decide the order', () => {
        //
        // both sides are upper-cased before comparing, which matters because the
        // listings mix 'BLS' with 'StockMarket'.
        //
        const page = setup();

        expect(compare(page, 'name', true, { name: 'apple' }, { name: 'Banana' })).toBe(-1);
    });

    it('reports equal items as equal', () => {
        const page = setup();

        expect(compare(page, 'name', true, { name: 'A' }, { name: 'a' })).toBe(0);
    });

    it('compares finite numbers numerically rather than as text', () => {
        //
        // as text '10' sorts before '9'. The Number.isFinite branch is what keeps the
        // ratio and health sorts honest.
        //
        const page = setup();

        expect(compare(page, 'temp', true, { temp: 9 }, { temp: 10 })).toBe(-1);
    });

    it('pushes a null entry to the end regardless of direction', () => {
        //
        // the sort keys map non-conforming rows to null rather than dropping them, so
        // the comparator has to place them. They go last.
        //
        const page = setup();

        expect(compare(page, 'name', true, null, { name: 'A' })).toBe(1);
        expect(compare(page, 'name', true, { name: 'A' }, null)).toBe(-1);
        expect(compare(page, 'name', false, null, { name: 'A' })).toBe(1);
    });

    it('treats two nulls as a-after-b rather than equal', () => {
        //
        // WORTH KNOWING: the null checks run in order, so null vs null answers 1
        // instead of 0. That is not a consistent comparator, and a different engine's
        // sort could order two nulls differently. Harmless only because nulls carry no
        // other distinguishing value.
        //
        const page = setup();

        expect(compare(page, 'name', true, null, null)).toBe(1);
    });

    it('throws on a key the entries do not carry', () => {
        //
        // DOCUMENTS FRAGILITY. A non-finite value goes straight to .toUpperCase(), so a
        // missing key is a TypeError rather than a no-op sort. handleSelect's final
        // else-branch passes the raw dropdown label through as a key, which means a
        // caller offering an option that does not match a field takes the listing down.
        //
        const page = setup();

        expect(() => compare(page, 'absent', true, { name: 'A' }, { name: 'B' }))
            .toThrow(TypeError);
    });
});

describe('handleSelect, by name', () => {
    //
    // Note: a FUNCTION, not a shared constant. handleSelect sorts the array in place
    //       through the prop (see 'the listing reorders its caller's array' below), so
    //       a module-level fixture is reordered by whichever test ran first and the
    //       next test's "original order" is whatever that left behind. This cost two
    //       confusing failures before the mutation was understood.
    //
    const LIST = () => [
        { name: 'SEC', link: '#', detail: { Health: '77%' } },
        { name: 'BLS', link: '#', detail: { Health: '91%' } },
        { name: 'StockMarket', link: '#', detail: { Health: '98%' } },
    ];

    it('sorts alphabetically for a-z', () => {
        const page = setup({ list_article: LIST() });

        expect(select(page, 'A-Z')).toEqual(['BLS', 'SEC', 'StockMarket']);
    });

    it('sorts alphabetically for a "Name" option too', () => {
        //
        // FIXED, in article-listing.jsx. The second spelling was tested with
        //
        //     e.toUpperCase() === 'name'
        //
        // which can never be true, so 'Name' fell past every branch to the final else.
        // That sorts on the raw label as a field name; no entry has a 'Name' key, and
        // the comparator then read .toUpperCase() of undefined and took the listing
        // down. Both sides now compare toLowerCase().
        //
        const page = setup({ list_article: LIST() });

        expect(select(page, 'Name')).toEqual(['BLS', 'SEC', 'StockMarket']);
    });

    it('accepts either spelling in any casing', () => {
        expect(select(setup({ list_article: LIST() }), 'NAME'))
            .toEqual(['BLS', 'SEC', 'StockMarket']);
        expect(select(setup({ list_article: LIST() }), 'a-z'))
            .toEqual(['BLS', 'SEC', 'StockMarket']);
    });

    it('records which sort is active', () => {
        const page = setup({ list_article: LIST() });

        select(page, 'A-Z');

        expect(page.state.selected_sort).toBe('A-Z');
    });

    it('reverses when the order control is used', () => {
        //
        // the order button passes type='order', which is the only thing that flips the
        // direction -- choosing the same key again from the dropdown does not.
        //
        const page = setup({ list_article: LIST() });

        select(page, 'A-Z');
        expect(select(page, 'A-Z', 'order')).toEqual(['StockMarket', 'SEC', 'BLS']);
    });

    it('flips the recorded direction', () => {
        const page = setup({ list_article: LIST() });
        const before = page.state.listing_ascend;

        select(page, 'A-Z', 'order');

        expect(page.state.listing_ascend).toBe(!before);
    });

    it('restores the order captured at mount for none', () => {
        const page = setup({ list_article: LIST() });

        select(page, 'A-Z');

        expect(select(page, 'None')).toEqual(['SEC', 'BLS', 'StockMarket']);
    });

    it('leaves its caller\'s array untouched when sorting', () => {
        //
        // FIXED, in article-listing.jsx. componentDidMount stored the prop by reference
        // and every sort called .sort() on it, which reorders IN PLACE -- so choosing a
        // sort silently rewrote the array the parent still held, outside setState where
        // nothing would notice. home-page.jsx hands in its own state.split_list.
        //
        // State is now copied on mount and on update, and each in-place sort runs on a
        // fresh copy, so either change alone would fix this.
        //
        const mine = LIST();
        const before = mine.map(v => v.name);
        const page = setup({ list_article: mine });

        select(page, 'A-Z');

        expect(mine.map(v => v.name)).toEqual(before);
        expect(page.state.list_article.map(v => v.name)).toEqual(['BLS', 'SEC', 'StockMarket']);
    });

    it('does not share its array with the caller at all', () => {
        const mine = LIST();
        const page = setup({ list_article: mine });

        expect(page.state.list_article).not.toBe(mine);
    });
});

describe('handleSelect, by ratio', () => {
    const SPLITS = [
        { name: 'AAPL', detail: { Ratio: '4:1' } },
        { name: 'MSFT', detail: { Ratio: '2:1' } },
        { name: 'TSLA', detail: { Ratio: '3:1' } },
    ];

    it('orders by the computed ratio, not the label', () => {
        //
        // '10:1' sorts after '4:1' numerically but before it as text, which is the
        // whole reason the division happens.
        //
        const page = setup({
            list_article: [...SPLITS, { name: 'NVDA', detail: { Ratio: '10:1' } }],
        });

        expect(select(page, 'Ratio')).toEqual(['MSFT', 'TSLA', 'AAPL', 'NVDA']);
    });

    it('accepts a ratio with no colon as a plain number', () => {
        const page = setup({
            list_article: [
                { name: 'AAPL', detail: { Ratio: '5' } },
                { name: 'MSFT', detail: { Ratio: '2:1' } },
            ],
        });

        expect(select(page, 'Ratio')).toEqual(['MSFT', 'AAPL']);
    });

    it('keeps the detail so the row still renders after sorting', () => {
        //
        // the sort rebuilds each entry rather than adding a key, so anything it forgets
        // to copy is lost from the row.
        //
        const page = setup({ list_article: SPLITS });

        select(page, 'Ratio');

        expect(page.state.list_article[0].detail).toEqual({ Ratio: '2:1' });
    });

    it('maps an entry with no detail to null rather than dropping it', () => {
        const page = setup({
            list_article: [{ name: 'AAPL', detail: { Ratio: '2:1' } }, { name: 'NODETAIL' }],
        });

        expect(select(page, 'Ratio')).toEqual(['AAPL', null]);
    });

    it('carries link, performance and type through the rebuild', () => {
        const page = setup({
            list_article: [{
                name: 'AAPL',
                link: '/data?x=1',
                type: 'split',
                performance: { runtime: 5 },
                detail: { Ratio: '2:1' },
            }],
        });

        select(page, 'Ratio');

        const [entry] = page.state.list_article;
        expect(entry.link).toBe('/data?x=1');
        expect(entry.type).toBe('split');
        expect(entry.performance).toEqual({ runtime: 5 });
    });

    it('nulls a link that is not a string', () => {
        const page = setup({
            list_article: [{ name: 'AAPL', link: 42, detail: { Ratio: '2:1' } }],
        });

        select(page, 'Ratio');

        expect(page.state.list_article[0].link).toBeNull();
    });
});

describe('handleSelect, by the keys that share the ratio rebuild', () => {
    //
    // 'date', 'runtime' and 'health'/'coverage' each rebuild every entry exactly the
    // way the ratio branch above does: four copied blocks differing only in which
    // detail field becomes 'temp'. Driven from one table, so a fix applied to one of
    // them and not the rest is visible rather than silent.
    //
    // Note: 'health' and 'coverage' are one branch in the source, not two -- both read
    //       as a percentage string and are stripped to a number the same way. They are
    //       listed separately here because the key each picks out is chosen inside that
    //       branch, and picking the wrong one would sort a row by its neighbour's
    //       figure.
    //
    const REBUILDS = [
        ['Date', 'Date', { AAPL: '2026-01-03', MSFT: '2026-01-01', TSLA: '2026-01-02' }],
        ['Runtime', 'Runtime', { AAPL: '3m', MSFT: '1m', TSLA: '2m' }],
        ['Health', 'Health', { AAPL: '92.50%', MSFT: '10.00%', TSLA: '88.00%' }],
        ['Coverage', 'Coverage', { AAPL: '92.50%', MSFT: '10.00%', TSLA: '88.00%' }],
    ];

    const listing = (key, values) => Object.entries(values).map(
        ([name, value]) => ({ name, detail: { [key]: value } })
    );

    it.each(REBUILDS)('%s orders on the figure it names', (label, key, values) => {
        const page = setup({ list_article: listing(key, values) });

        expect(select(page, label)).toEqual(['MSFT', 'TSLA', 'AAPL']);
    });

    it.each(REBUILDS)('%s accepts the key in any casing', (label, key, values) => {
        //
        // the branch compares 'e.toLowerCase()', so the dropdown's own capitalisation
        // is not load-bearing -- a caller listing 'HEALTH' gets the same sort.
        //
        const page = setup({ list_article: listing(key, values) });

        expect(select(page, label.toUpperCase())).toEqual(['MSFT', 'TSLA', 'AAPL']);
    });

    it.each(REBUILDS)('%s maps an entry with no detail to null rather than dropping it', (label, key, values) => {
        const page = setup({
            list_article: [...listing(key, values), { name: 'NODETAIL' }],
        });

        expect(select(page, label)).toEqual(['MSFT', 'TSLA', 'AAPL', null]);
    });

    it.each(REBUILDS)('%s carries link, performance and type through the rebuild', (label, key, values) => {
        //
        // the rebuild constructs a fresh entry rather than adding a key to the old
        // one, so anything it forgets to copy is gone from the row -- the link most
        // visibly, since the name stops being clickable.
        //
        const page = setup({
            list_article: [{
                name: 'AAPL',
                link: '/data?x=1',
                type: 'split',
                performance: { runtime: 5 },
                detail: { [key]: values.AAPL },
            }],
        });

        select(page, label);

        const [entry] = page.state.list_article;
        expect(entry.link).toBe('/data?x=1');
        expect(entry.type).toBe('split');
        expect(entry.performance).toEqual({ runtime: 5 });
        expect(entry.detail).toEqual({ [key]: values.AAPL });
    });

    it.each(REBUILDS)('%s nulls a link, performance and type it cannot use', (label, key, values) => {
        //
        // Note: 'performance' is null rather than a wrong-typed value on purpose.
        //       'checkValidObject(k, v)' tests the ENTRY, not v[k] -- it asks that the
        //       key be present, non-undefined and non-null, and nothing more. A string
        //       under 'performance' passes it and is carried through as a string, so
        //       null is the only shape the guard actually rejects.
        //
        const page = setup({
            list_article: [{
                name: 'AAPL',
                link: 42,
                type: 7,
                performance: null,
                detail: { [key]: values.AAPL },
            }],
        });

        select(page, label);

        const [entry] = page.state.list_article;
        expect(entry.link).toBeNull();
        expect(entry.type).toBeNull();
        expect(entry.performance).toBeNull();
    });

    it.each([['Health'], ['Coverage']])('%s sorts a stream that cannot state one to the bottom', (label) => {
        //
        // 'n/a' is what both figures sit at until a report resolves, and what a stream
        // whose rate cannot be graded shows permanently. Stripping it of everything
        // that is not a digit leaves the empty string, which Number() reads as 0 -- so
        // it sorts below every real percentage rather than throwing.
        //
        const page = setup({
            list_article: [
                { name: 'AAPL', detail: { [label]: '92.50%' } },
                { name: 'MSFT', detail: { [label]: 'n/a' } },
                { name: 'TSLA', detail: { [label]: '10.00%' } },
            ],
        });

        expect(select(page, label)).toEqual(['MSFT', 'TSLA', 'AAPL']);
    });
});

describe('the argument defaults', () => {
    it('sorts ascending when no direction is given', () => {
        //
        // 'sorter' is always called internally with both arguments, so its default is
        // only reachable from a caller reaching for the comparator itself.
        //
        const page = setup();
        const compare = page.sorter('name');

        expect(compare({ name: 'a' }, { name: 'b' })).toBe(-1);
    });

    it('treats a sort chosen with no type as a sort rather than an order flip', () => {
        //
        // 'type' distinguishes choosing a KEY from toggling the direction, and the
        // dropdown omits it entirely for the former.
        //
        const page = setup({
            list_article: [{ name: 'TSLA' }, { name: 'AAPL' }],
        });
        const before = page.state.listing_ascend;

        act(() => {
            page.handleSelect('A-Z');
        });

        expect(page.state.listing_ascend).toBe(before);
        expect(page.state.list_article.map(v => v.name)).toEqual(['AAPL', 'TSLA']);
    });
});

describe('handleSelect, by date and runtime', () => {
    it('orders by the detail date', () => {
        const page = setup({
            list_article: [
                { name: 'later', detail: { Date: '2026/08/09' } },
                { name: 'earlier', detail: { Date: '2026/08/01' } },
            ],
        });

        expect(select(page, 'Date')).toEqual(['earlier', 'later']);
    });

    it('orders by the detail runtime', () => {
        const page = setup({
            list_article: [
                { name: 'slow', detail: { Runtime: 90 } },
                { name: 'fast', detail: { Runtime: 5 } },
            ],
        });

        expect(select(page, 'Runtime')).toEqual(['fast', 'slow']);
    });
});

describe('handleSelect, by health and coverage', () => {
    const STREAMS = [
        { name: 'SEC', detail: { Health: '77%', Coverage: '50%' } },
        { name: 'BLS', detail: { Health: '91%', Coverage: '10%' } },
        { name: 'Stock', detail: { Health: '98%', Coverage: '90%' } },
    ];

    it('strips the percent sign and orders numerically', () => {
        const page = setup({ list_article: STREAMS });

        expect(select(page, 'Health')).toEqual(['SEC', 'BLS', 'Stock']);
    });

    it('reads coverage through the same branch', () => {
        //
        // one branch serves both, keyed off the label -- so a change to either is a
        // change to both.
        //
        const page = setup({ list_article: STREAMS });

        expect(select(page, 'Coverage')).toEqual(['BLS', 'SEC', 'Stock']);
    });

    it('sorts an unresolved n/a figure to the bottom rather than throwing', () => {
        //
        // 'n/a' strips to the empty string, and Number('') is 0. A stream that cannot
        // state a figure therefore sorts last instead of taking the listing down --
        // which is what the earlier string sort did.
        //
        const page = setup({
            list_article: [
                { name: 'unknown', detail: { Health: 'n/a' } },
                { name: 'known', detail: { Health: '50%' } },
            ],
        });

        expect(select(page, 'Health')).toEqual(['unknown', 'known']);
    });

    it('keeps a decimal figure intact', () => {
        //
        // the strip keeps '.' deliberately: health is reported to two places on
        // desktop.
        //
        const page = setup({
            list_article: [
                { name: 'high', detail: { Health: '98.75%' } },
                { name: 'low', detail: { Health: '98.25%' } },
            ],
        });

        expect(select(page, 'Health')).toEqual(['low', 'high']);
    });
});

describe('handleSelect, by an unrecognised key', () => {
    it('falls through to sorting on that key directly', () => {
        //
        // the final else treats the dropdown label as a field name, which works only
        // when a caller's option happens to match a top-level key.
        //
        const page = setup({
            list_article: [{ name: 'b', type: 'z' }, { name: 'a', type: 'y' }],
        });

        expect(select(page, 'type')).toEqual(['a', 'b']);
    });
});

describe('reformatDate', () => {
    it('shortens a four-digit year to two', () => {
        const page = setup();

        expect(page.reformatDate('08/09/2026')).toBe('08/09/26');
    });

    it('returns the input unchanged when it cannot be split', () => {
        //
        // the catch exists because detail values arrive from csv and are not
        // guaranteed to be dates at all. A bad value is logged and passed through, so
        // the row still renders.
        //
        const page = setup();
        const quiet = jest.spyOn(console, 'log').mockImplementation(() => {});

        expect(page.reformatDate(20260809)).toBe(20260809);
        expect(quiet).toHaveBeenCalled();

        quiet.mockRestore();
    });

    it('does not throw on null', () => {
        const page = setup();
        const quiet = jest.spyOn(console, 'log').mockImplementation(() => {});

        expect(page.reformatDate(null)).toBeNull();

        quiet.mockRestore();
    });
});

describe('renderDetail', () => {
    function detailText(page, obj) {
        const rendered = page.renderDetail(obj);

        if (rendered === null) {
            return null;
        }

        const { container } = render(<MemoryRouter>{rendered}</MemoryRouter>);
        return container.textContent;
    }

    it('renders nothing for an entry with no detail', () => {
        const page = setup();

        expect(page.renderDetail({ name: 'x' })).toBeNull();
    });

    it('renders nothing for an empty detail', () => {
        const page = setup();

        expect(page.renderDetail({ name: 'x', detail: {} })).toBeNull();
    });

    it('renders each key and value', () => {
        const page = setup();

        const text = detailText(page, { name: 'x', detail: { Sector: 'Tech', Ratio: '2:1' } });

        expect(text).toContain('Sector');
        expect(text).toContain('Tech');
        expect(text).toContain('Ratio');
    });

    it('drops a null or undefined value', () => {
        const page = setup();

        const text = detailText(page, {
            name: 'x',
            detail: { Sector: 'Tech', Industry: null, Ratio: undefined },
        });

        expect(text).toContain('Sector');
        expect(text).not.toContain('Industry');
        expect(text).not.toContain('Ratio');
    });

    it('drops a value that is only whitespace', () => {
        //
        // an empty column in the csv arrives as ' ', and a key with a blank value reads
        // as missing data rather than as information.
        //
        const page = setup();

        const text = detailText(page, { name: 'x', detail: { Sector: 'Tech', Industry: '   ' } });

        expect(text).not.toContain('Industry');
    });

    it('renders nothing when every value was dropped', () => {
        const page = setup();

        expect(page.renderDetail({ name: 'x', detail: { A: null, B: '  ' } })).toBeNull();
    });

    it('separates pairs with a bullet, but not before the first', () => {
        const page = setup();

        const text = detailText(page, { name: 'x', detail: { A: '1', B: '2', C: '3' } });

        expect((text.match(/•/g) || []).length).toBe(2);
    });

    it('reformats a Date value but leaves other values alone', () => {
        const page = setup();

        const text = detailText(page, {
            name: 'x',
            detail: { Date: '08/09/2026', Other: '08/09/2026' },
        });

        expect(text).toContain('08/09/26');
        expect(text).toContain('08/09/2026');
    });

    it('matches the Date key case-insensitively', () => {
        const page = setup();

        const text = detailText(page, { name: 'x', detail: { date: '08/09/2026' } });

        expect(text).toContain('08/09/26');
    });

    it('leaves the caller\'s object intact when pruning', () => {
        //
        // FIXED, in article-listing.jsx. renderDetail pruned with 'delete detail[k]' on
        // the object it was handed -- an element of the caller's list_article, not a
        // copy -- so rendering a row permanently stripped its blank fields from the
        // data the caller still held. It now prunes a spread copy.
        //
        const page = setup();
        const entry = { name: 'x', detail: { Sector: 'Tech', Industry: null } };

        page.renderDetail(entry);

        expect('Industry' in entry.detail).toBe(true);
        expect(entry.detail).toEqual({ Sector: 'Tech', Industry: null });
    });

    it('still omits the pruned keys from what it renders', () => {
        //
        // the copy must not weaken the pruning itself: the blank field is still absent
        // from the output, it is only the caller's data that survives.
        //
        const page = setup();

        const text = detailText(page, {
            name: 'x',
            detail: { Sector: 'Tech', Industry: null },
        });

        expect(text).toContain('Sector');
        expect(text).not.toContain('Industry');
    });
});
