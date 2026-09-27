/**
 * settings.jsx: a signed-in reader's account settings: the ingest alarms they
 *               subscribe to, and their ID token, for calling the account api from
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
import { ErrorBoundary } from 'react-error-boundary';
import ErrorFallback from '../../formatter/boundary-error.jsx';
import {
    signedIn,
    readerToken,
    listSubscriptions,
    unsubscribe,
} from '../../general/account-api.js';
import { API_DOCS } from '../../general/api-url.js';
import streamName from '../../general/stream-name.js';

//
// a subscription's key among the reader's: one stream's one alarm
//
function keyOf(subscription) {
    return `${subscription.stream}/${subscription.alarm}`;
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
        };

        this.load = this.load.bind(this);
        this.remove = this.remove.bind(this);
        this.subscriptions = this.subscriptions.bind(this);
        this.showToken = this.showToken.bind(this);
        this.hideToken = this.hideToken.bind(this);
        this.copyToken = this.copyToken.bind(this);
        this.apiAccess = this.apiAccess.bind(this);
    }

    componentDidMount() {
        this.load();
        signedIn().then((signed_in) => this.setState({ signed_in: signed_in }));
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
        return(
            <div className='account'>
                <h1>My Settings</h1>
                <ErrorBoundary FallbackComponent={ErrorFallback}>
                    <section className='account-section'>
                        <h4>Alarm subscriptions</h4>
                        {this.subscriptions()}
                    </section>
                    {/*

                        API access, for a reader the session says is signed in and
                        the api has not answered as signed out. The two are asked at
                        once and can answer in either order, and the api's answer is
                        the one that decides.

                    */}
                    {this.state.signed_in && this.state.subscriptions !== null ? this.apiAccess() : null}
                </ErrorBoundary>
            </div>
        );
    }
}

// indicate which class can be exported, and instantiated via 'require'
export default SettingsLayout;
