/**
 * settings.jsx: a signed-in reader's account settings, starting with the ingest
 *               alarms they subscribe to.
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
import { listSubscriptions, unsubscribe } from '../../general/account-api.js';
import streamName from '../../general/stream-name.js';

//
// a subscription's key among the reader's: one stream's one alarm
//
function keyOf(subscription) {
    return `${subscription.stream}/${subscription.alarm}`;
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
        };

        this.load = this.load.bind(this);
        this.remove = this.remove.bind(this);
        this.subscriptions = this.subscriptions.bind(this);
    }

    componentDidMount() {
        this.load();
    }

    load() {
        listSubscriptions()
            .then((subscriptions) => this.setState({ subscriptions: subscriptions }))
            .catch((problem) => this.setState({ subscriptions: 'failed', problem: problem.message }));
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
                </ErrorBoundary>
            </div>
        );
    }
}

// indicate which class can be exported, and instantiated via 'require'
export default SettingsLayout;
