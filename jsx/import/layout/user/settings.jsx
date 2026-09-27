/**
 * settings.jsx: a signed-in reader's account settings: their email address, which
 *               alarms go to and which they verify here; the ingest alarms they
 *               subscribe to; and their ID token, for calling the account api from
 *               a script.
 *
 * Who the reader is comes from their session's token, through the account api --
 * never from the '/:user' in the url, which is only the name the page was reached by.
 * See account-api.js.
 *
 * Note: this script implements jsx (reactjs) syntax.
 *
 * Note: the heading sits outside the ErrorBoundary, so a failure inside a section
 *       replaces that section alone.
 */

import React, { Component } from 'react';
import { Link } from 'react-router-dom';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import { ErrorBoundary } from 'react-error-boundary';
import ErrorFallback from '../../formatter/boundary-error.jsx';
import {
    signedIn,
    readerToken,
    listSubscriptions,
    unsubscribe,
} from '../../general/account-api.js';
import { emailAddress, sendEmailCode, verifyEmail } from '../../general/email-address.js';
import { API_DOCS } from '../../general/api-url.js';
import streamName from '../../general/stream-name.js';

//
// a subscription's key among the reader's: one stream's one alarm
//
function keyOf(subscription) {
    return `${subscription.stream}/${subscription.alarm}`;
}

//
// what went wrong with sending a code or checking one, by the sign-in's own code
// for it -- see email-address.js -- and what the reader is told
//
const EMAIL_PROBLEMS = {
    wrong: 'That code isn\'t right, or it has expired. Send another code, and use the newest one.',
    limit: 'Too many codes have been asked for. Wait a while, then try again.',
    send: 'A code could not be sent right now. Try again.',
    verify: 'The code could not be checked right now. Try again.',
};

function emailProblem(error, doing) {
    const code = error && (error.code || error.name);

    if (code === 'CodeMismatchException' || code === 'ExpiredCodeException') {
        return 'wrong';
    }

    return code === 'LimitExceededException' ? 'limit' : doing;
}

//
// whether the email address and API access show: for a reader the session says is
// signed in and the api has not answered as signed out. The two are asked at once
// and can answer in either order, and the api's answer is the one that decides.
//
function isReader(state) {
    return Boolean(state.signed_in) && state.subscriptions !== null;
}

/**
 * when an ID token expires, read from the token itself, or null when it says nothing
 * this can read.
 *
 * A token is three base64url parts, and the middle one is its claims, as json. 'exp'
 * among them is the second it expires, counted from the epoch -- an hour after it was
 * issued, for the site's sign-in.
 */
export function expiryOf(token) {
    try {
        const part = String(token).split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
        const claims = JSON.parse(atob(part + '='.repeat((4 - (part.length % 4)) % 4)));

        return Number.isFinite(claims.exp) ? new Date(claims.exp * 1000) : null;
    } catch (error) {
        return null;
    }
}

class SettingsLayout extends Component {
    constructor(props) {
        super(props);

        this.state = {
            //
            // the reader's subscriptions: 'pending' until they arrive, null signed
            // out, then the list -- or 'failed'
            //
            subscriptions: 'pending',
            // the subscriptions with an unsubscribe on its way, by keyOf
            busy: {},
            // what the account api said about the last request it refused
            problem: null,
            //
            // whether a reader is signed in, from the session alone: null until
            // it has been looked at. The API access section shows only for one.
            //
            signed_in: null,
            //
            // the reader's ID token, while they have asked to see it, and not
            // otherwise -- see showToken
            //
            token: null,
            // whether the last copy worked: null, 'copied' or 'failed'
            copied: null,
            //
            // the reader's email address as the sign-in keeps it: 'pending' until
            // it arrives, then { email, verified } -- or 'failed'. See loadEmail.
            //
            email: 'pending',
            // whether a code has been sent, which is when the field for it shows
            code_sent: false,
            // the code as the reader types it
            code: '',
            // what is on its way: null, 'sending' or 'verifying'
            email_busy: null,
            // what went wrong last, as a key of EMAIL_PROBLEMS, or null
            email_problem: null,
            //
            // verified, but the session could not be refreshed, so the token in
            // hand still says otherwise -- see verifyEmail in email-address.js
            //
            email_stale: false,
        };

        this.load = this.load.bind(this);
        this.remove = this.remove.bind(this);
        this.subscriptions = this.subscriptions.bind(this);
        this.showToken = this.showToken.bind(this);
        this.hideToken = this.hideToken.bind(this);
        this.copyToken = this.copyToken.bind(this);
        this.apiAccess = this.apiAccess.bind(this);
        this.loadEmail = this.loadEmail.bind(this);
        this.sendCode = this.sendCode.bind(this);
        this.submitCode = this.submitCode.bind(this);
        this.emailSection = this.emailSection.bind(this);
    }

    componentDidMount() {
        this.load();
        signedIn().then((signed_in) => {
            this.setState({ signed_in: signed_in });

            if (signed_in) {
                this.loadEmail();
            }
        });
    }

    //
    // a link to '#email' -- the alarm page's, when a subscribe is refused for an
    // address that is not verified -- lands on the section once it has drawn. The
    // browser looks for it only as a page loads, before the section is there, and
    // not at all when the site moves to this page itself.
    //
    componentDidUpdate(previous_props, previous_state) {
        if (isReader(previous_state) || !isReader(this.state) || window.location.hash !== '#email') {
            return;
        }

        const section = document.getElementById('email');

        if (section) {
            section.scrollIntoView();
        }
    }

    loadEmail() {
        emailAddress()
            .then((email) => this.setState({ email: email }))
            .catch(() => this.setState({ email: 'failed' }));
    }

    sendCode() {
        this.setState({ email_busy: 'sending', email_problem: null });

        sendEmailCode()
            .then(() => this.setState({ code_sent: true, email_busy: null }))
            .catch((error) => this.setState({ email_busy: null, email_problem: emailProblem(error, 'send') }));
    }

    //
    // verify the address with the code the reader typed. Once it is verified the
    // section says so, and the session has been refreshed, so the reader can
    // subscribe at once -- see verifyEmail in email-address.js.
    //
    submitCode(event) {
        event.preventDefault();

        if (!this.state.code.trim() || this.state.email_busy) {
            return;
        }

        this.setState({ email_busy: 'verifying', email_problem: null });

        verifyEmail(this.state.code)
            .then(({ refreshed }) => this.setState((state) => ({
                email: { ...state.email, verified: true },
                code_sent: false,
                code: '',
                email_busy: null,
                email_stale: !refreshed,
            })))
            .catch((error) => this.setState({ email_busy: null, email_problem: emailProblem(error, 'verify') }));
    }

    /**
     * the reader's email address, which alarms go to, and whether it is verified --
     * with a way to verify it where it is not.
     *
     * Unverified, a code is sent to the address, and taken back here. A code that is
     * wrong or has expired says so, beside a way to send another. Verified, the
     * section says so and asks nothing. An account with no address -- one is optional
     * at sign-up -- is told why it cannot subscribe, since an address cannot be added
     * afterwards.
     *
     * Note: the section is '#email', which the alarm page links to when a subscribe is
     *       refused for an address that is not verified.
     */
    emailSection() {
        const { email, code_sent, code, email_busy, email_problem, email_stale } = this.state;
        let body;

        if (email === 'pending') {
            body = <p className='account-status'>Checking your email address&hellip;</p>;
        } else if (email === 'failed') {
            body = <p className='account-problem' role='alert'>Your email address could not be read right now.</p>;
        } else if (!email.email) {
            body = (
                <p className='account-status'>
                    Your account has no email address. Alarms go by email, so subscribing
                    needs an address given at sign-up, which can&apos;t be added or changed
                    afterwards.
                </p>
            );
        } else if (email.verified) {
            body = (
                <>
                    <p className='account-email-address'>
                        {email.email}
                        <span className='account-email-state account-email-verified'>Verified</span>
                    </p>
                    {email_stale
                        ? (
                            <p className='account-status'>
                                Sign out and in again before you subscribe, so your sign-in
                                says so too.
                            </p>
                        ) : null}
                </>
            );
        } else {
            body = (
                <>
                    <p className='account-email-address'>
                        {email.email}
                        <span className='account-email-state'>Not verified</span>
                    </p>
                    <p className='account-status'>
                        Alarms go to this address, so it has to be verified before you can
                        subscribe.
                    </p>
                    {code_sent ? (
                        <form className='account-email-verify' onSubmit={this.submitCode}>
                            <p className='account-status'>{`A code is on its way to ${email.email}.`}</p>
                            <div className='account-email-actions'>
                                <TextField
                                    label='Code'
                                    size='small'
                                    value={code}
                                    onChange={(event) => this.setState({ code: event.target.value })}
                                    inputProps={{ inputMode: 'numeric', autoComplete: 'one-time-code' }}
                                />
                                <Button
                                    type='submit'
                                    variant='outlined'
                                    color='inherit'
                                    size='small'
                                    disabled={Boolean(email_busy) || !code.trim()}
                                >
                                    Verify
                                </Button>
                                <Button
                                    variant='text'
                                    color='inherit'
                                    size='small'
                                    disabled={Boolean(email_busy)}
                                    onClick={this.sendCode}
                                >
                                    Send another code
                                </Button>
                            </div>
                        </form>
                    ) : (
                        <Button
                            variant='outlined'
                            color='inherit'
                            size='small'
                            disabled={Boolean(email_busy)}
                            onClick={this.sendCode}
                        >
                            Send a code
                        </Button>
                    )}
                    {email_problem
                        ? <p className='account-problem' role='alert'>{EMAIL_PROBLEMS[email_problem]}</p>
                        : null}
                </>
            );
        }

        return (
            <section className='account-section account-email' id='email'>
                <h4>Email address</h4>
                {body}
            </section>
        );
    }

    //
    // Note: null is a session that has ended, which takes the API access section
    //       away with it -- see render -- and any token it was showing
    //
    load() {
        listSubscriptions()
            .then((subscriptions) => this.setState(subscriptions === null
                ? { subscriptions: null, token: null }
                : { subscriptions: subscriptions }))
            .catch((problem) => this.setState({ subscriptions: 'failed', problem: problem.message }));
    }

    //
    // the reader's token, read when they ask to see it: always a current one, since
    // the session refreshes an expired one as it is read. It is held in this page's
    // state for as long as it shows, and nowhere else -- no storage, no store.
    //
    showToken() {
        readerToken().then((token) => this.setState(token
            ? { token: token, copied: null }
            : { signed_in: false, token: null }));
    }

    hideToken() {
        this.setState({ token: null, copied: null });
    }

    copyToken() {
        const clipboard = typeof navigator !== 'undefined' ? navigator.clipboard : undefined;

        if (!clipboard || typeof clipboard.writeText !== 'function') {
            this.setState({ copied: 'failed' });
            return;
        }

        clipboard.writeText(this.state.token)
            .then(() => this.setState({ copied: 'copied' }))
            .catch(() => this.setState({ copied: 'failed' }));
    }

    /**
     * the reader's ID token, for calling the account api from a script: hidden
     * until they ask for it, then shown with a way to copy it and when it expires,
     * in their own time. Shown only to a signed-in reader.
     *
     * Note: one line of warning, because it is the whole of what the api asks for.
     *       Anyone holding it is the reader, to the account api, until it expires.
     */
    apiAccess() {
        const { token, copied } = this.state;
        const expires = token ? expiryOf(token) : null;

        return (
            <section className='account-section account-api-access'>
                <h4>API access</h4>
                <p className='account-status'>
                    A script can call the <a href={API_DOCS.account}>account API</a> as you,
                    with your ID token. Treat it like a password: anyone holding it can act as
                    you on the account API until it expires.
                </p>
                {token ? (
                    <>
                        <code className='account-token'>{token}</code>
                        <div className='account-token-actions'>
                            <Button variant='outlined' color='inherit' size='small' onClick={this.copyToken}>
                                Copy
                            </Button>
                            <Button variant='text' color='inherit' size='small' onClick={this.hideToken}>
                                Hide
                            </Button>
                            <span className='account-token-expiry'>
                                {expires
                                    ? `Expires ${expires.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}`
                                    : 'When it expires could not be read from it.'}
                            </span>
                        </div>
                        {copied === 'copied'
                            ? <p className='account-status' role='status'>Copied.</p>
                            : null}
                        {copied === 'failed'
                            ? (
                                <p className='account-problem' role='alert'>
                                    It could not be copied. Select it, and copy it yourself.
                                </p>
                            ) : null}
                    </>
                ) : (
                    <Button variant='outlined' color='inherit' size='small' onClick={this.showToken}>
                        Show token
                    </Button>
                )}
            </section>
        );
    }

    //
    // unsubscribe from one, and take it off the list once the api has answered.
    // Null is a session that has ended, and puts the section in its signed-out
    // view; any other refusal leaves the row where it was, and says why.
    //
    remove(subscription) {
        const key = keyOf(subscription);

        this.setState((state) => ({ busy: { ...state.busy, [key]: true }, problem: null }));

        unsubscribe(subscription.stream, subscription.alarm)
            .then((done) => {
                if (done === null) {
                    this.setState({ subscriptions: null, busy: {} });
                    return;
                }

                this.setState((state) => ({
                    subscriptions: Array.isArray(state.subscriptions)
                        ? state.subscriptions.filter((held) => keyOf(held) !== key)
                        : state.subscriptions,
                    busy: { ...state.busy, [key]: false },
                }));
            })
            .catch((problem) => {
                this.setState((state) => ({
                    problem: problem.message,
                    busy: { ...state.busy, [key]: false },
                }));
            });
    }

    subscriptions() {
        const { subscriptions, busy, problem } = this.state;

        if (subscriptions === 'pending') {
            return <p className='account-status'>Checking your subscriptions&hellip;</p>;
        }

        if (subscriptions === null) {
            return (
                <p className='account-status'>
                    <Link to='/login'>Sign in</Link> to see the alarms you are subscribed to.
                </p>
            );
        }

        if (subscriptions === 'failed') {
            return <p className='account-status account-problem' role='alert'>{problem}</p>;
        }

        if (!subscriptions.length) {
            return (
                <p className='account-status'>
                    You are not subscribed to any alarms. Each stream on
                    the <Link to='/stream'>Stream</Link> page has a bell that leads to its own.
                </p>
            );
        }

        return (
            <>
                <ul className='account-subscriptions'>
                    {subscriptions.map((held) => {
                        const key = keyOf(held);

                        return (
                            <li key={key} className='account-subscription'>
                                <span className='account-subscription-what'>
                                    <Link to={`/stream/${held.stream}/alarm`}>{streamName(held.stream)}</Link>
                                    {` ${held.alarm} alarm`}
                                </span>
                                <span className='account-subscription-since'>
                                    {`since ${String(held.since).slice(0, 10)}`}
                                </span>
                                <Button
                                    variant='outlined'
                                    color='inherit'
                                    size='small'
                                    disabled={Boolean(busy[key])}
                                    onClick={() => this.remove(held)}
                                >
                                    Unsubscribe
                                </Button>
                            </li>
                        );
                    })}
                </ul>
                {problem ? <p className='account-problem' role='alert'>{problem}</p> : null}
            </>
        );
    }

    render() {
        //
        // Note: the email address comes first. It is what subscribing needs, and
        //       where the alarm page sends a reader whose address is not verified.
        //
        const reader = isReader(this.state);

        return(
            <div className='account'>
                <h1>My Settings</h1>
                <ErrorBoundary FallbackComponent={ErrorFallback}>
                    {reader ? this.emailSection() : null}
                    <section className='account-section'>
                        <h4>Alarm subscriptions</h4>
                        {this.subscriptions()}
                    </section>
                    {reader ? this.apiAccess() : null}
                </ErrorBoundary>
            </div>
        );
    }
}

// indicate which class can be exported, and instantiated via 'require'
export default SettingsLayout;
