/**
 * account-api.test.js: the account api, as the pages call it.
 *
 * What is held here is what the pages rely on without looking:
 *
 *   - every private call carries the reader's ID token as a bearer token, and
 *     nothing else in it says who they are -- no username, no email address
 *   - signed out, a call makes no request at all, and resolves to null
 *   - a 401 is a session that has ended, and resolves to null rather than failing
 *   - a subscribe sends the version of the terms the reader accepted
 *   - any other refusal rejects with the api's own message, which a page shows
 *   - a model's alarms are asked for and subscribed to as a stream's are, on paths
 *     of their own (#255)
 *   - another api's private GET is asked as the reader the same way: the model
 *     api's picks (#290)
 *
 * Note: the session is mocked rather than Amplify, since what the module does with a
 *       token is the question here -- currentUser.js has its own suite -- and fetch
 *       is replaced per test and put back after.
 */

jest.mock('../../import/general/currentUser.js', () => ({
    __esModule: true,
    default: jest.fn(),
}));

import amplifyCurrentUser from '../../import/general/currentUser.js';
import {
    AccountError,
    UNREACHABLE,
    signedIn,
    readerToken,
    readAsReader,
    listSubscriptions,
    subscribe,
    unsubscribe,
    subscribeModel,
    unsubscribeModel,
    streamAlarms,
    modelAlarms,
} from '../../import/general/account-api.js';

const TOKEN = 'header.payload.signature';

const SUBSCRIPTION = { stream: 'bls', alarm: 'ingest', since: '2026-09-26T12:00:00Z', terms: '2026-09' };

//
// a model's subscription, as the api answers one (#255): its 'model' where a
// stream's has its 'stream'
//
const MODEL_SUBSCRIPTION = { model: 'pt-gnn', alarm: 'live', since: '2026-10-18T12:00:00Z', terms: '2026-10' };

let original;

beforeEach(() => {
    jest.clearAllMocks();
    original = global.fetch;
    amplifyCurrentUser.mockResolvedValue(TOKEN);
});

afterEach(() => {
    global.fetch = original;
});

//
// fetch answering every request with one status and report, as the api does
//
function answering(status, report) {
    global.fetch = jest.fn(() => Promise.resolve({
        ok: status >= 200 && status < 300,
        status: status,
        json: () => Promise.resolve({ report: report }),
    }));

    return global.fetch;
}

//
// the one request made: its url, as a string, and the options it was made with
//
function sent(fetcher) {
    expect(fetcher).toHaveBeenCalledTimes(1);

    const [url, options] = fetcher.mock.calls[0];

    return { url: String(url), options: options };
}

describe('signedIn', () => {
    it('is true with a session, and asks the api nothing', async () => {
        const fetcher = answering(200, []);

        await expect(signedIn()).resolves.toBe(true);
        expect(fetcher).not.toHaveBeenCalled();
    });

    it('is false without one', async () => {
        amplifyCurrentUser.mockResolvedValue(null);

        await expect(signedIn()).resolves.toBe(false);
    });
});

describe('readerToken', () => {
    //
    // the reader's own token, for Account Settings to show them and copy -- read
    // through the session as every call here reads it
    //
    it('is the session\'s ID token, and asks the api nothing', async () => {
        const fetcher = answering(200, []);

        await expect(readerToken()).resolves.toBe(TOKEN);
        expect(fetcher).not.toHaveBeenCalled();
    });

    it('is null without a session', async () => {
        amplifyCurrentUser.mockResolvedValue(null);

        await expect(readerToken()).resolves.toBeNull();
    });
});

describe('readAsReader (#290)', () => {
    //
    // another of the site's apis asked as the signed-in reader, as the calls here
    // are: the model api's picks, on its private path
    //
    const URL_ASKED = 'https://api.jefflevesque.com/v1/private/model?Model=pt-options&Report=picks';

    it('asks with a GET that carries the ID token as a bearer token, and nothing else of the reader', async () => {
        const fetcher = answering(200, 'day,hold,rank\n');

        await expect(readAsReader(URL_ASKED)).resolves.toEqual({ report: 'day,hold,rank\n' });

        const { url, options } = sent(fetcher);

        expect(url).toBe(URL_ASKED);
        expect(options).toEqual({ method: 'GET', headers: { Authorization: `Bearer ${TOKEN}` } });
    });

    it('makes no request at all when signed out, and resolves to null', async () => {
        amplifyCurrentUser.mockResolvedValue(null);
        const fetcher = answering(200, 'day\n');

        await expect(readAsReader(URL_ASKED)).resolves.toBeNull();
        expect(fetcher).not.toHaveBeenCalled();
    });

    it('reads a 401 as a session that has ended, and resolves to null', async () => {
        answering(401, null);

        await expect(readAsReader(URL_ASKED)).resolves.toBeNull();
    });

    it('rejects any other refusal with its status and the api\'s own words', async () => {
        answering(404, { error: 'This model has no picks.' });

        await expect(readAsReader(URL_ASKED)).rejects.toMatchObject({
            name: 'AccountError',
            status: 404,
            message: 'This model has no picks.',
        });
    });
});

describe('every private call', () => {
    const CALLS = [
        ['listSubscriptions', () => listSubscriptions()],
        ['subscribe', () => subscribe('bls', 'ingest', '2026-09')],
        ['unsubscribe', () => unsubscribe('bls', 'ingest')],
        ['subscribeModel', () => subscribeModel('pt-gnn', 'live', '2026-10')],
        ['unsubscribeModel', () => unsubscribeModel('pt-gnn', 'live')],
    ];

    it.each(CALLS)('%s carries the ID token as a bearer token', async (name, call) => {
        const fetcher = answering(200, name === 'listSubscriptions' ? [] : SUBSCRIPTION);

        await call();

        expect(sent(fetcher).options.headers.Authorization).toBe(`Bearer ${TOKEN}`);
    });

    it.each(CALLS)('%s makes no request at all when signed out, and resolves to null', async (name, call) => {
        amplifyCurrentUser.mockResolvedValue(null);
        const fetcher = answering(200, []);

        await expect(call()).resolves.toBeNull();
        expect(fetcher).not.toHaveBeenCalled();
    });

    it.each(CALLS)('%s reads a 401 as a session that has ended, and resolves to null', async (name, call) => {
        answering(401, { error: 'sign in required' });

        await expect(call()).resolves.toBeNull();
    });

    it.each(CALLS)('%s says who is asking by the token alone', async (name, call) => {
        //
        // the headers are the token and, with a body, its type -- no username or
        // email address travels in any of them, or in the url
        //
        const fetcher = answering(200, name === 'listSubscriptions' ? [] : SUBSCRIPTION);

        await call();

        const { url, options } = sent(fetcher);

        expect(Object.keys(options.headers).sort())
            .toEqual(name.startsWith('subscribe') ? ['Authorization', 'Content-Type'] : ['Authorization']);
        expect(url).not.toMatch(/user|email/i);
    });

    it.each(CALLS)('%s rejects with the api\'s own message for any other refusal', async (name, call) => {
        answering(503, { error: 'busy, try again' });

        const refused = await call().catch((error) => error);

        expect(refused).toBeInstanceOf(AccountError);
        expect(refused.status).toBe(503);
        expect(refused.message).toBe('busy, try again');
    });

    it.each(CALLS)('%s says the service could not be reached when the network fails', async (name, call) => {
        global.fetch = jest.fn(() => Promise.reject(new TypeError('Failed to fetch')));

        const refused = await call().catch((error) => error);

        expect(refused).toBeInstanceOf(AccountError);
        expect(refused.status).toBe(0);
        expect(refused.message).toBe(UNREACHABLE);
    });

    it('says the same for an answer that is not the api\'s json', async () => {
        global.fetch = jest.fn(() => Promise.resolve({
            ok: false,
            status: 502,
            json: () => Promise.reject(new SyntaxError('Unexpected token <')),
        }));

        await expect(listSubscriptions()).rejects.toMatchObject({ status: 502, message: UNREACHABLE });
    });
});

describe('listSubscriptions', () => {
    it('asks for the reader\'s subscriptions with a GET', async () => {
        const fetcher = answering(200, [SUBSCRIPTION]);

        await expect(listSubscriptions()).resolves.toEqual([SUBSCRIPTION]);

        const { url, options } = sent(fetcher);

        expect(url).toBe('https://api.jefflevesque.com/v1/private/notifications');
        expect(options.method).toBe('GET');
        expect(options.body).toBeUndefined();
    });

    it('resolves to an empty list for an answer that holds no list', async () => {
        answering(200, null);

        await expect(listSubscriptions()).resolves.toEqual([]);
    });

    it('hands back a model\'s subscription beside a stream\'s, each as the api answered it (#255)', async () => {
        answering(200, [SUBSCRIPTION, MODEL_SUBSCRIPTION]);

        await expect(listSubscriptions()).resolves.toEqual([SUBSCRIPTION, MODEL_SUBSCRIPTION]);
    });
});

describe('subscribe', () => {
    it('puts the subscription, sending the version of the terms accepted', async () => {
        const fetcher = answering(201, SUBSCRIPTION);

        await expect(subscribe('bls', 'ingest', '2026-09')).resolves.toEqual(SUBSCRIPTION);

        const { url, options } = sent(fetcher);

        expect(url).toBe('https://api.jefflevesque.com/v1/private/notifications/stream/bls/ingest');
        expect(options.method).toBe('PUT');
        expect(options.headers['Content-Type']).toBe('application/json');
        expect(JSON.parse(options.body)).toEqual({ terms: '2026-09' });
    });

    it('resolves to a subscription already held, as the api treats it alike', async () => {
        answering(200, SUBSCRIPTION);

        await expect(subscribe('bls', 'ingest', '2026-09')).resolves.toEqual(SUBSCRIPTION);
    });

    it('rejects with the api\'s message for an email address not yet verified', async () => {
        answering(403, { error: 'verify your email address to subscribe' });

        await expect(subscribe('bls', 'ingest', '2026-09'))
            .rejects.toMatchObject({ status: 403, message: 'verify your email address to subscribe' });
    });
});

describe('unsubscribe', () => {
    it('deletes the subscription, with no body, and resolves to true', async () => {
        const fetcher = answering(200, null);

        await expect(unsubscribe('bls', 'ingest')).resolves.toBe(true);

        const { url, options } = sent(fetcher);

        expect(url).toBe('https://api.jefflevesque.com/v1/private/notifications/stream/bls/ingest');
        expect(options.method).toBe('DELETE');
        expect(options.body).toBeUndefined();
    });
});

describe('subscribeModel (#255)', () => {
    it('puts the model\'s subscription, sending the version of the terms accepted', async () => {
        const fetcher = answering(201, MODEL_SUBSCRIPTION);

        await expect(subscribeModel('pt-gnn', 'live', '2026-10')).resolves.toEqual(MODEL_SUBSCRIPTION);

        const { url, options } = sent(fetcher);

        expect(url).toBe('https://api.jefflevesque.com/v1/private/notifications/model/pt-gnn/live');
        expect(options.method).toBe('PUT');
        expect(options.headers['Content-Type']).toBe('application/json');
        expect(JSON.parse(options.body)).toEqual({ terms: '2026-10' });
    });

    it('asks the model\'s path, never the stream\'s of the same name', async () => {
        const fetcher = answering(201, MODEL_SUBSCRIPTION);

        await subscribeModel('bls', 'live', '2026-10');

        expect(sent(fetcher).url).toBe('https://api.jefflevesque.com/v1/private/notifications/model/bls/live');
    });

    it('rejects with the api\'s message for an email address not yet verified', async () => {
        answering(403, { error: 'verify your email address to subscribe' });

        await expect(subscribeModel('pt-gnn', 'live', '2026-10'))
            .rejects.toMatchObject({ status: 403, message: 'verify your email address to subscribe' });
    });

    it('rejects with the api\'s message for a model the listing does not name', async () => {
        answering(404, { error: 'no such model' });

        await expect(subscribeModel('nope', 'live', '2026-10'))
            .rejects.toMatchObject({ status: 404, message: 'no such model' });
    });
});

describe('unsubscribeModel (#255)', () => {
    it('deletes the model\'s subscription, with no body, and resolves to true', async () => {
        const fetcher = answering(200, null);

        await expect(unsubscribeModel('pt-gnn', 'live')).resolves.toBe(true);

        const { url, options } = sent(fetcher);

        expect(url).toBe('https://api.jefflevesque.com/v1/private/notifications/model/pt-gnn/live');
        expect(options.method).toBe('DELETE');
        expect(options.body).toBeUndefined();
    });
});

describe('modelAlarms (#255)', () => {
    it('asks the public list for the model, with no token at all', async () => {
        const alarms = [{ id: 'live', name: 'pt-gnn goes live ahead of the baseline' }];
        const fetcher = answering(200, alarms);

        await expect(modelAlarms('pt-gnn')).resolves.toEqual(alarms);

        const { url, options } = sent(fetcher);

        expect(url).toBe('https://api.jefflevesque.com/v1/public/alarms?model=pt-gnn');
        expect(options).toBeUndefined();
        expect(amplifyCurrentUser).not.toHaveBeenCalled();
    });

    it('resolves to no alarms for a retired model, as the api answers one', async () => {
        answering(200, []);

        await expect(modelAlarms('retired-gnn')).resolves.toEqual([]);
    });

    it('rejects with the api\'s message for a name that is no model\'s', async () => {
        answering(404, { error: 'no such model' });

        await expect(modelAlarms('nope')).rejects.toMatchObject({ status: 404, message: 'no such model' });
    });

    it('resolves to an empty list for an answer that holds no list', async () => {
        answering(200, { unexpected: true });

        await expect(modelAlarms('pt-gnn')).resolves.toEqual([]);
    });
});

describe('streamAlarms', () => {
    it('asks the public list for the stream, with no token at all', async () => {
        //
        // the alarms are the same for every reader, so the call carries nothing that
        // says who is reading -- and asks for no token to carry
        //
        const alarms = [{ id: 'ingest', name: 'Bureau of Labor Statistics ingest' }];
        const fetcher = answering(200, alarms);

        await expect(streamAlarms('bls')).resolves.toEqual(alarms);

        const { url, options } = sent(fetcher);

        expect(url).toBe('https://api.jefflevesque.com/v1/public/alarms?stream=bls');
        expect(options).toBeUndefined();
        expect(amplifyCurrentUser).not.toHaveBeenCalled();
    });

    it('asks the same signed out', async () => {
        amplifyCurrentUser.mockResolvedValue(null);
        answering(200, [{ id: 'ingest', name: 'SEC Filings ingest' }]);

        await expect(streamAlarms('sec')).resolves.toHaveLength(1);
    });

    it('rejects with the api\'s message for a stream it does not know', async () => {
        answering(404, { error: 'no such stream' });

        await expect(streamAlarms('no-such-stream'))
            .rejects.toMatchObject({ status: 404, message: 'no such stream' });
    });

    it('resolves to an empty list for an answer that holds no list', async () => {
        answering(200, { unexpected: true });

        await expect(streamAlarms('bls')).resolves.toEqual([]);
    });
});
