/**
 * model-alarm.test.jsx: a model's alarm page, '/model/:model/alarm' (#255).
 *
 * The page is the stream alarm page's subscribing, for a model: the terms, then the
 * model's alarms, each with a switch held off until the terms are accepted, and what
 * sets the alarm off. Who the model is comes from the model api's listing, as on its
 * own page: a name the listing does not hold says so, and a retired model has no
 * switch, only a way out for a reader who still holds its alarm.
 *
 * Note: 'general/account-api.js' is mocked, as alarm.test.jsx mocks it, and each call
 *       is pending by default -- so a case that does not care sees the page as it
 *       first draws, and a case that does answers the calls it is about. The model
 *       api is replaced at source.js, as the other model pages' suites replace it.
 */

jest.mock('../../../import/general/account-api.js', () => ({
    __esModule: true,
    signedIn: jest.fn(),
    listSubscriptions: jest.fn(),
    subscribeModel: jest.fn(),
    unsubscribeModel: jest.fn(),
    modelAlarms: jest.fn(),
}));

jest.mock('../../../import/layout/model/source.js', () => ({
    loadListing: jest.fn(),
    loadReport: jest.fn(),
}));

import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import {
    signedIn,
    listSubscriptions,
    subscribeModel,
    unsubscribeModel,
    modelAlarms,
} from '../../../import/general/account-api.js';
import { loadListing } from '../../../import/layout/model/source.js';
import { TERMS, TERMS_VERSION } from '../../../import/general/notice-terms.jsx';
import ModelAlarmRoute, { ModelAlarm } from '../../../import/layout/model/model-alarm.jsx';
import { listingOf, modelOf } from '../../../test-support/model-fixtures.js';

//
// a call that never answers: the default, so the page stays as it first draws
//
const pending = () => new Promise(() => {});

function deferred() {
    let resolve;
    const promise = new Promise((done) => { resolve = done; });

    return { promise, resolve };
}

const ALARMS = [{ id: 'live', name: 'pt-gnn goes live ahead of its previous version' }];
const HELD = { model: 'pt-gnn', alarm: 'live', since: '2026-10-18T12:00:00Z', terms: TERMS_VERSION };

beforeEach(() => {
    jest.clearAllMocks();
    signedIn.mockImplementation(pending);
    listSubscriptions.mockImplementation(pending);
    subscribeModel.mockImplementation(pending);
    unsubscribeModel.mockImplementation(pending);
    modelAlarms.mockImplementation(pending);
    loadListing.mockResolvedValue(listingOf());
});

afterEach(() => {
    sessionStorage.removeItem('username');
});

//
// the page at the model's address, as main-route.jsx serves it
//
async function openAlarm(name = 'pt-gnn') {
    let view;

    await act(async () => {
        view = render(
            <MemoryRouter initialEntries={[`/model/${encodeURIComponent(name)}/alarm`]}>
                <Routes>
                    <Route path='/model/:model/alarm' element={<ModelAlarmRoute />} />
                </Routes>
            </MemoryRouter>
        );
    });

    return view;
}

//
// the page for a signed-in reader, once their subscriptions and the model's alarms
// have both arrived
//
async function openSignedIn({ name = 'pt-gnn', held = [], alarms = ALARMS } = {}) {
    signedIn.mockResolvedValue(true);
    listSubscriptions.mockResolvedValue(held);
    modelAlarms.mockResolvedValue(alarms);

    const view = await openAlarm(name);

    await waitFor(() => expect(listSubscriptions).toHaveBeenCalled());

    return view;
}

const alarmSwitch = () => screen.getByLabelText('pt-gnn goes live ahead of its previous version');
const acceptBox = () => screen.getByRole('checkbox', { name: 'I accept the terms and conditions' });

describe('the page', () => {
    it('is headed Model Alarms, under the model\'s name leading back to its page', async () => {
        await openAlarm();

        expect(screen.getByRole('heading', { level: 4, name: 'Model Alarms' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: '‹ pt-gnn' })).toHaveAttribute('href', '/model/pt-gnn');
    });

    it('reads its model from the address', async () => {
        await openSignedIn({ name: 'tables', alarms: [{ id: 'live', name: 'tables goes live ahead of its previous version' }] });

        expect(screen.getByRole('link', { name: '‹ tables' })).toHaveAttribute('href', '/model/tables');
        expect(modelAlarms).toHaveBeenCalledWith('tables');
        expect(await screen.findByLabelText('tables goes live ahead of its previous version')).toBeInTheDocument();
    });

    it('escapes a name the address would read otherwise', async () => {
        loadListing.mockResolvedValue(listingOf([modelOf({ name: 'a b/c' })]));

        await openAlarm('a b/c');

        expect(screen.getByRole('link', { name: '‹ a b/c' })).toHaveAttribute('href', '/model/a%20b%2Fc');
    });

    it('says it is loading the model until the listing arrives', async () => {
        loadListing.mockImplementation(pending);

        await openAlarm();

        expect(screen.getByText('Loading the model…')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: '‹ pt-gnn' })).toBeInTheDocument();
    });

    it('says there are no models to show when the listing could not be had', async () => {
        loadListing.mockResolvedValue(null);
        signedIn.mockResolvedValue(true);

        await openAlarm();

        expect(screen.getByText('No models to show yet.')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: '‹ All models' })).toHaveAttribute('href', '/model');
        expect(listSubscriptions).not.toHaveBeenCalled();
        expect(modelAlarms).not.toHaveBeenCalled();
    });

    it('shows the terms both alarm pages show', async () => {
        await openAlarm();

        expect(document.querySelector('.agreement .border-bottom').textContent).toBe(TERMS);
    });

    it('says what sets the alarm off: a version ahead of both its predecessor and the baseline', async () => {
        await openAlarm();

        const about = screen.getByRole('region', { name: 'What sets it off' });

        expect(about).toHaveTextContent('It emails you when a new version of pt-gnn goes live ahead of its previous version');
        expect(about).toHaveTextContent('lower than both the version it replaced and the know-nothing baseline’s');
        expect(about).toHaveTextContent('Not every new version that goes live beats both, so it goes off less often than a model goes live.');
        expect(about).toHaveTextContent('first version never sets it off');
    });

    it('says nothing of how a version goes live, which the trainer changes (#315)', async () => {
        await openAlarm();

        const about = screen.getByRole('region', { name: 'What sets it off' });

        expect(about).not.toHaveTextContent('no higher than the live version');
        expect(about).not.toHaveTextContent('most nights');
    });

    it('can be drawn by the name alone', async () => {
        await act(async () => {
            render(
                <MemoryRouter>
                    <ModelAlarm name='fresh' />
                </MemoryRouter>
            );
        });

        expect(screen.getByRole('link', { name: '‹ fresh' })).toHaveAttribute('href', '/model/fresh');
        expect(screen.getByRole('region', { name: 'What sets it off' })).toHaveTextContent('a new version of fresh');
    });
});

describe('signed out', () => {
    it('is asked to sign in or sign up, with no switch', async () => {
        signedIn.mockResolvedValue(false);

        await openAlarm();

        expect(screen.getByText(/You need to login to subscribe to model alarms/)).toBeInTheDocument();
        expect(within(document.querySelector('.agreement-button')).getAllByRole('link').map((link) => link.textContent))
            .toEqual(expect.arrayContaining(['Sign up']));
        expect(screen.queryByLabelText('pt-gnn goes live ahead of its previous version')).toBeNull();
        expect(screen.queryByRole('checkbox')).toBeNull();
    });

    it('sends nothing to the account api, not even for the model\'s alarms', async () => {
        const fetcher = jest.spyOn(global, 'fetch');

        signedIn.mockResolvedValue(false);

        await openAlarm();

        expect(signedIn).toHaveBeenCalled();
        expect(listSubscriptions).not.toHaveBeenCalled();
        expect(modelAlarms).not.toHaveBeenCalled();
        expect(subscribeModel).not.toHaveBeenCalled();
        expect(unsubscribeModel).not.toHaveBeenCalled();
        expect(fetcher).not.toHaveBeenCalled();

        fetcher.mockRestore();
    });
});

describe('signed in', () => {
    it('is offered the terms to accept, in place of the way to sign in', async () => {
        await openSignedIn();

        expect(acceptBox()).not.toBeChecked();
        expect(screen.getByRole('heading', { name: 'Subscribe to model alarms' })).toBeInTheDocument();
        expect(screen.queryByText(/You need to login/)).toBeNull();
    });

    it('lists the model\'s alarms, from the model\'s own list, each with a switch', async () => {
        await openSignedIn();

        expect(modelAlarms).toHaveBeenCalledWith('pt-gnn');
        expect(await screen.findByLabelText('pt-gnn goes live ahead of its previous version')).not.toBeChecked();
    });

    it('shows an alarm the reader holds switched on', async () => {
        await openSignedIn({ held: [HELD] });

        await waitFor(() => expect(alarmSwitch()).toBeChecked());
    });

    it('does not take another model\'s subscription, or a stream\'s of its name, for this one\'s', async () => {
        await openSignedIn({
            held: [
                { ...HELD, model: 'tables' },
                { stream: 'pt-gnn', alarm: 'live', since: '2026-09-26T12:00:00Z', terms: '2026-09' },
            ],
        });

        await waitFor(() => expect(alarmSwitch()).toBeDisabled());
        expect(alarmSwitch()).not.toBeChecked();
    });

    it('lets no switch be turned on before the terms are accepted', async () => {
        await openSignedIn();

        await screen.findByLabelText('pt-gnn goes live ahead of its previous version');

        expect(alarmSwitch()).toBeDisabled();
        expect(screen.getByText(/Accept the terms and conditions above/)).toBeInTheDocument();

        fireEvent.click(alarmSwitch());

        expect(subscribeModel).not.toHaveBeenCalled();
    });

    it('subscribes once the terms are accepted, sending their version', async () => {
        subscribeModel.mockResolvedValue(HELD);

        await openSignedIn();
        await screen.findByLabelText('pt-gnn goes live ahead of its previous version');

        fireEvent.click(acceptBox());
        await waitFor(() => expect(alarmSwitch()).toBeEnabled());

        fireEvent.click(alarmSwitch());

        await waitFor(() => expect(alarmSwitch()).toBeChecked());
        expect(subscribeModel).toHaveBeenCalledWith('pt-gnn', 'live', TERMS_VERSION);
        expect(screen.queryByText(/Accept the terms and conditions above/)).toBeNull();
    });

    it('unsubscribes when a held one is turned off, before the terms are accepted too', async () => {
        unsubscribeModel.mockResolvedValue(true);

        await openSignedIn({ held: [HELD] });
        await waitFor(() => expect(alarmSwitch()).toBeEnabled());

        fireEvent.click(alarmSwitch());

        await waitFor(() => expect(alarmSwitch()).not.toBeChecked());
        expect(unsubscribeModel).toHaveBeenCalledWith('pt-gnn', 'live');
    });

    it('moves a switch only once the api has answered', async () => {
        await openSignedIn();
        await screen.findByLabelText('pt-gnn goes live ahead of its previous version');

        fireEvent.click(acceptBox());
        await waitFor(() => expect(alarmSwitch()).toBeEnabled());

        fireEvent.click(alarmSwitch());

        await waitFor(() => expect(alarmSwitch()).toBeDisabled());
        expect(alarmSwitch()).not.toBeChecked();
    });

    describe('refused', () => {
        const refusal = (status, message = 'verify your email address to subscribe') => Object.assign(new Error(message), { status: status });
        const settingsLink = () => screen.queryByRole('link', { name: 'Verify it in Account Settings' });

        async function turnOn() {
            await screen.findByLabelText('pt-gnn goes live ahead of its previous version');

            fireEvent.click(acceptBox());
            await waitFor(() => expect(alarmSwitch()).toBeEnabled());

            fireEvent.click(alarmSwitch());
        }

        it('for an address not verified, links to the email section of Account Settings', async () => {
            sessionStorage.setItem('username', 'reader');
            subscribeModel.mockRejectedValue(refusal(403));

            await openSignedIn();
            await turnOn();

            expect(await screen.findByRole('alert')).toHaveTextContent('Your email address isn\'t verified yet');
            expect(settingsLink()).toHaveAttribute('href', '/reader/settings#email');
            expect(alarmSwitch()).not.toBeChecked();
        });

        it('says what the api said for any other refusal, with no link, and leaves the switch where it was', async () => {
            subscribeModel.mockRejectedValue(refusal(503, 'the models could not be checked, try again'));

            await openSignedIn();
            await turnOn();

            expect(await screen.findByRole('alert')).toHaveTextContent('the models could not be checked, try again');
            expect(settingsLink()).toBeNull();
            expect(alarmSwitch()).not.toBeChecked();
            expect(alarmSwitch()).toBeEnabled();
        });

        it('does not take a refused unsubscribe for an address to verify', async () => {
            unsubscribeModel.mockRejectedValue(refusal(403, 'refused'));

            await openSignedIn({ held: [HELD] });
            await waitFor(() => expect(alarmSwitch()).toBeEnabled());

            fireEvent.click(alarmSwitch());

            expect(await screen.findByRole('alert')).toHaveTextContent('refused');
            expect(settingsLink()).toBeNull();
            expect(alarmSwitch()).toBeChecked();
        });
    });

    it('is shown the signed-out view once the session has ended', async () => {
        subscribeModel.mockResolvedValue(null);

        await openSignedIn();
        await screen.findByLabelText('pt-gnn goes live ahead of its previous version');

        fireEvent.click(acceptBox());
        await waitFor(() => expect(alarmSwitch()).toBeEnabled());

        fireEvent.click(alarmSwitch());

        expect(await screen.findByText(/You need to login to subscribe to model alarms/)).toBeInTheDocument();
        expect(screen.queryByLabelText('pt-gnn goes live ahead of its previous version')).toBeNull();
    });

    it('is shown the signed-out view when the subscriptions come back signed out', async () => {
        signedIn.mockResolvedValue(true);
        listSubscriptions.mockResolvedValue(null);
        modelAlarms.mockResolvedValue(ALARMS);

        await openAlarm();

        expect(await screen.findByText(/You need to login to subscribe to model alarms/)).toBeInTheDocument();
    });

    it('holds the switch still, and says why, when the subscriptions could not be had', async () => {
        signedIn.mockResolvedValue(true);
        listSubscriptions.mockRejectedValue(new Error('busy, try again'));
        modelAlarms.mockResolvedValue(ALARMS);

        await openAlarm();

        expect(await screen.findByRole('alert')).toHaveTextContent('busy, try again');
        expect(alarmSwitch()).toBeDisabled();
    });

    it('says why before the alarms have arrived, too', async () => {
        signedIn.mockResolvedValue(true);
        listSubscriptions.mockRejectedValue(new Error('busy, try again'));

        await openAlarm();

        expect(await screen.findByRole('alert')).toHaveTextContent('busy, try again');
    });

    it('says the alarms could not be listed when the list fails', async () => {
        signedIn.mockResolvedValue(true);
        listSubscriptions.mockResolvedValue([]);
        modelAlarms.mockRejectedValue(new Error('the models could not be read, try again'));

        await openAlarm();

        expect(await screen.findByText('The alarms could not be listed right now.')).toBeInTheDocument();
    });
});

describe('a name that is no model\'s', () => {
    it('says so, as the model\'s own page does, and leads back to every model', async () => {
        signedIn.mockResolvedValue(true);

        await openAlarm('nope');

        expect(screen.getByRole('heading', { name: 'Model not found' })).toBeInTheDocument();
        expect(screen.getByText('There is no model named “nope”.')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: '‹ All models' })).toHaveAttribute('href', '/model');
    });

    it('asks the account api nothing, and offers no terms', async () => {
        signedIn.mockResolvedValue(true);

        await openAlarm('nope');

        expect(listSubscriptions).not.toHaveBeenCalled();
        expect(modelAlarms).not.toHaveBeenCalled();
        expect(document.querySelector('.agreement')).toBeNull();
    });
});

describe('a retired model', () => {
    //
    // 'beater' retired 2026-10-02 -- see test-support/model-fixtures.js
    //
    it('says it is retired, with no terms and no switch', async () => {
        signedIn.mockResolvedValue(false);

        await openAlarm('beater');

        expect(screen.getByText(/beater retired Oct 2\. It is no longer trained, so it can’t go live again/)).toBeInTheDocument();
        expect(document.querySelector('.agreement')).toBeNull();
        expect(screen.queryByRole('checkbox')).toBeNull();
        expect(screen.queryByRole('region', { name: 'What sets it off' })).toBeNull();
    });

    it('asks for no alarms, since it has none to switch', async () => {
        await openSignedIn({ name: 'beater' });

        expect(modelAlarms).not.toHaveBeenCalled();
    });

    it('offers an Unsubscribe to a reader who still holds its alarm, in place of the switch', async () => {
        unsubscribeModel.mockResolvedValue(true);

        await openSignedIn({ name: 'beater', held: [{ ...HELD, model: 'beater' }] });

        expect(await screen.findByText('You still hold its live alarm.')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Unsubscribe' }));

        await waitFor(() => expect(screen.queryByRole('button', { name: 'Unsubscribe' })).toBeNull());
        expect(unsubscribeModel).toHaveBeenCalledWith('beater', 'live');
    });

    it('holds the Unsubscribe still while it is on its way', async () => {
        await openSignedIn({ name: 'beater', held: [{ ...HELD, model: 'beater' }] });

        fireEvent.click(await screen.findByRole('button', { name: 'Unsubscribe' }));

        await waitFor(() => expect(screen.getByRole('button', { name: 'Unsubscribe' })).toBeDisabled());
    });

    it('says what the api said when the unsubscribe is refused, and keeps the way out', async () => {
        unsubscribeModel.mockRejectedValue(new Error('busy, try again'));

        await openSignedIn({ name: 'beater', held: [{ ...HELD, model: 'beater' }] });

        fireEvent.click(await screen.findByRole('button', { name: 'Unsubscribe' }));

        expect(await screen.findByRole('alert')).toHaveTextContent('busy, try again');
        expect(screen.getByRole('button', { name: 'Unsubscribe' })).toBeEnabled();
    });

    it('offers nothing to a reader who holds none of its alarms', async () => {
        await openSignedIn({ name: 'beater', held: [HELD] });

        expect(screen.queryByRole('button', { name: 'Unsubscribe' })).toBeNull();
    });
});

describe('answers that land after the page has gone', () => {
    it('are let go', async () => {
        const listing = deferred();
        const session = deferred();

        loadListing.mockReturnValue(listing.promise);
        signedIn.mockReturnValue(session.promise);

        const { unmount } = await openAlarm();

        unmount();

        await act(async () => {
            listing.resolve(listingOf());
            session.resolve(true);
        });

        expect(listSubscriptions).not.toHaveBeenCalled();
        expect(modelAlarms).not.toHaveBeenCalled();
    });

    it('are let go for the subscriptions and the alarms too', async () => {
        const held = deferred();
        const alarms = deferred();

        signedIn.mockResolvedValue(true);
        listSubscriptions.mockReturnValue(held.promise);
        modelAlarms.mockReturnValue(alarms.promise);

        const { unmount } = await openAlarm();

        await waitFor(() => expect(modelAlarms).toHaveBeenCalled());

        unmount();

        await act(async () => {
            held.resolve([HELD]);
            alarms.resolve(ALARMS);
        });

        expect(screen.queryByLabelText('pt-gnn goes live ahead of its previous version')).toBeNull();
    });

    it('are let go when they fail', async () => {
        let failHeld;
        let failAlarms;

        signedIn.mockResolvedValue(true);
        listSubscriptions.mockReturnValue(new Promise((_, reject) => { failHeld = reject; }));
        modelAlarms.mockReturnValue(new Promise((_, reject) => { failAlarms = reject; }));

        const { unmount } = await openAlarm();

        await waitFor(() => expect(modelAlarms).toHaveBeenCalled());

        unmount();

        await act(async () => {
            failHeld(new Error('busy'));
            failAlarms(new Error('busy'));
        });

        expect(screen.queryByRole('alert')).toBeNull();
    });
});
