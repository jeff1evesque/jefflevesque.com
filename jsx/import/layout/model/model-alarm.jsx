/**
 * model-alarm.jsx: /model/:model/alarm, a model's alarms (#255).
 *
 * A model has one alarm, 'live', until it retires. It emails a subscriber when a
 * new version goes live ahead of the baseline: on the days it was tested on, its
 * loss is lower than both the version it replaced and the know-nothing baseline's.
 * Most nights a model goes live, but far fewer go live ahead of the baseline, and a
 * first version never sets it off, since it has no live version to beat. The
 * account api judges the emails; nothing here does.
 *
 * The page is the stream alarm page's subscribing and no more -- see
 * layout/stream/alarm.jsx, whose archive, workflows and performance summary are a
 * stream's. Under the model's name, which leads back to its page, and a heading:
 * the terms, with the way to sign in when signed out and the box that accepts them
 * when signed in. Then the model's alarms, each with a switch held off until the
 * terms are accepted, and what sets the alarm off.
 *
 * Signed out, nothing is asked of the account api, the model's public list of
 * alarms included: there is nothing to switch.
 *
 * Note: who the model is comes from the model api's listing, as on its own page. A
 *       name the listing does not hold says so. A retired model says it is retired,
 *       with no terms and no switch, and a reader who still holds its alarm is
 *       offered an Unsubscribe in its place.
 */

import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { Link, useParams } from 'react-router-dom';
import { ErrorBoundary } from 'react-error-boundary';
import Button from '@mui/material/Button';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormGroup from '@mui/material/FormGroup';
import Switch from '@mui/material/Switch';
import ErrorFallback from '../../formatter/boundary-error.jsx';
import NoticeTerms, { TERMS, TERMS_VERSION } from '../../general/notice-terms.jsx';
import {
    signedIn,
    listSubscriptions,
    subscribeModel,
    unsubscribeModel,
    modelAlarms,
} from '../../general/account-api.js';
import { emailSettingsPath } from '../../general/settings-path.js';
import { loadListing } from './source.js';
import { shortDay, statusOf } from './scores.js';

class ModelAlarm extends Component {
    static propTypes = {
        //
        // the model's name, as the address holds it
        //
        name: PropTypes.string.isRequired,
    }

    constructor(props) {
        super(props);

        this.state = {
            // as the model pages': undefined while it is on its way, null where
            // it could not be had, and { tasks, models } once it is in
            listing: undefined,
            // whether a reader is signed in: null until the session has been
            // looked at
            signed_in: null,
            // the model's alarms, each { id, name }: null until they arrive,
            // then the list -- or 'failed'. Asked for only for a reader who
            // can switch them, see settle
            alarms: null,
            // the model's alarms the reader holds, by id: null until their
            // subscriptions arrive, and while they could not be had
            subscribed: null,
            // whether the reader has ticked the terms
            accepted: false,
            // the alarms with a subscribe or an unsubscribe on its way, by id
            busy: {},
            // what the account api said about the last request it refused
            problem: null,
            // whether that was a subscribe refused because the reader's email
            // address is not verified, which has a place to go
            unverified: false,
        };

        this.acceptTerms = this.acceptTerms.bind(this);
        this.toggleAlarm = this.toggleAlarm.bind(this);
    }

    componentDidMount() {
        this.alive = true;

        loadListing().then((listing) => this.settle({ listing: listing }));
        signedIn().then((signed_in) => this.settle({ signed_in: signed_in }));
    }

    componentWillUnmount() {
        this.alive = false;
    }

    model(listing = this.state.listing) {
        return listing ? listing.models.find((each) => each.name === this.props.name) || null : null;
    }

    //
    // the listing, or the session, has arrived. Once both have, a signed-in reader's
    // subscriptions are asked for, and a model's alarms with them while it can still
    // go live -- and nothing at all for a reader signed out, or a model there is not
    //
    settle(change) {
        if (!this.alive) {
            return;
        }

        this.setState(change, () => {
            const { listing, signed_in } = this.state;

            if (this.asked || listing === undefined || signed_in === null) {
                return;
            }

            this.asked = true;

            const model = this.model();

            if (!signed_in || !model) {
                return;
            }

            this.loadSubscriptions();

            if (statusOf(model) !== 'retired') {
                this.loadAlarms();
            }
        });
    }

    loadAlarms() {
        modelAlarms(this.props.name)
            .then((alarms) => {
                if (this.alive) {
                    this.setState({ alarms: alarms });
                }
            })
            .catch(() => {
                if (this.alive) {
                    this.setState({ alarms: 'failed' });
                }
            });
    }

    //
    // the reader's subscriptions to this model's alarms. Null from the api is a
    // session that has ended, which is the signed-out view rather than an error;
    // a list that could not be had leaves every switch unknown, and says why
    //
    loadSubscriptions() {
        listSubscriptions()
            .then((subscriptions) => {
                if (!this.alive) {
                    return;
                }

                if (subscriptions === null) {
                    this.setState({ signed_in: false });
                    return;
                }

                this.setState({
                    subscribed: Object.fromEntries(subscriptions
                        .filter((held) => held.model === this.props.name)
                        .map((held) => [held.alarm, true])),
                });
            })
            .catch((problem) => {
                if (this.alive) {
                    this.setState({ problem: problem.message });
                }
            });
    }

    acceptTerms(accepted) {
        this.setState({ accepted: accepted });
    }

    /**
     * subscribe to one of the model's alarms, or unsubscribe from it, as the stream
     * alarm page does a stream's: a subscribe sends the version of the terms the
     * reader accepted, and a switch moves only once the api has answered.
     *
     * Note: null from the api is a session that has ended, and puts the page in its
     *       signed-out view. Any other refusal leaves the switch where it was, and
     *       the api's own message says why.
     */
    toggleAlarm(alarm, on) {
        //
        // a switch is drawn disabled until the terms are accepted, and while its
        // request is on its way. The rule is held here too, whatever reaches it.
        //
        if ((on && !this.state.accepted) || this.state.busy[alarm]) {
            return;
        }

        const { name } = this.props;
        const settle = (change) => this.setState((state) => ({
            ...change(state),
            busy: { ...state.busy, [alarm]: false },
        }));

        this.setState((state) => ({ busy: { ...state.busy, [alarm]: true }, problem: null, unverified: false }));

        (on ? subscribeModel(name, alarm, TERMS_VERSION) : unsubscribeModel(name, alarm))
            .then((answered) => {
                if (answered === null) {
                    settle(() => ({ signed_in: false }));
                    return;
                }

                settle((state) => ({ subscribed: { ...state.subscribed, [alarm]: on } }));
            })
            //
            // a subscribe's 403 is an email address that is not verified, as a
            // stream's is. See the account api's page.
            //
            .catch((problem) => settle(() => ({
                problem: problem.message,
                unverified: on && problem.status === 403,
            })));
    }

    //
    // what the account api said when it refused, and for an address not verified,
    // where it is verified
    //
    problemLine() {
        const { problem, unverified } = this.state;

        if (!problem) {
            return null;
        }

        return (
            <p className='alarm-problem' role='alert'>
                {unverified
                    ? (
                        <>
                            Your email address isn&apos;t verified yet, and alarms go
                            to it. <Link to={emailSettingsPath()}>Verify it in Account
                            Settings</Link>, then turn the alarm on.
                        </>
                    ) : problem}
            </p>
        );
    }

    /**
     * the model's alarms, each with a switch, for a signed-in reader.
     *
     * A switch cannot be turned on until the terms are accepted, and can always be
     * turned off. While the reader's subscriptions are on their way, or could not be
     * had, every switch is held still: its position would be a guess.
     */
    alarmSwitches() {
        const { alarms, subscribed, accepted, busy } = this.state;

        if (alarms === 'failed') {
            return <p className='alarm-status'>The alarms could not be listed right now.</p>;
        }

        if (!Array.isArray(alarms)) {
            return this.problemLine();
        }

        return (
            <div className='alarm-subscriptions'>
                <FormGroup>
                    {alarms.map((alarm) => {
                        const held = Boolean(subscribed && subscribed[alarm.id]);

                        return (
                            <FormControlLabel
                                key={alarm.id}
                                control={(
                                    <Switch
                                        checked={held}
                                        disabled={!subscribed || Boolean(busy[alarm.id]) || (!held && !accepted)}
                                        onChange={(event) => this.toggleAlarm(alarm.id, event.target.checked)}
                                    />
                                )}
                                label={alarm.name}
                            />
                        );
                    })}
                </FormGroup>
                {accepted
                    ? null
                    : <p className='alarm-hint'>Accept the terms and conditions above to turn an alarm on.</p>}
                {this.problemLine()}
            </div>
        );
    }

    //
    // what sets the alarm off, in words, for a model that can still go live
    //
    explained(model) {
        return (
            <section className='model-alarm-about' aria-labelledby='model-alarm-about'>
                <h5 id='model-alarm-about'>What sets it off</h5>
                <p>
                    {`It emails you when a new version of ${model.name} goes live ahead of the baseline: on the days it was tested on, which it was not trained on, its loss is lower than both the version it replaced and the know-nothing baseline’s. Lower is better.`}
                </p>
                <p>
                    {'Not every new version that goes live beats both, so it goes off less often than a model goes live. A model’s first version never sets it off: it has no live version to beat.'}
                </p>
            </section>
        );
    }

    //
    // a retired model: no terms and no switch, since it can't go live again, and
    // an Unsubscribe for each of its alarms the reader still holds
    //
    retired(model) {
        const { subscribed, busy } = this.state;
        const held = subscribed ? Object.keys(subscribed).filter((alarm) => subscribed[alarm]) : [];

        return (
            <>
                <p className='model-status'>
                    {`${model.name} retired ${shortDay(model.retired)}. It is no longer trained, so it can’t go live again, and its alarm can’t be subscribed to.`}
                </p>
                {held.map((alarm) => (
                    <div key={alarm} className='model-alarm-held'>
                        <span>{`You still hold its ${alarm} alarm.`}</span>
                        <Button
                            variant='outlined'
                            color='inherit'
                            size='small'
                            disabled={Boolean(busy[alarm])}
                            onClick={() => this.toggleAlarm(alarm, false)}
                        >
                            Unsubscribe
                        </Button>
                    </div>
                ))}
                {this.problemLine()}
            </>
        );
    }

    body(model) {
        const { name } = this.props;
        const { listing, signed_in, accepted } = this.state;

        if (listing === undefined) {
            return <p className='model-status'>Loading the model&hellip;</p>;
        }

        if (listing === null) {
            return <p className='model-status model-status-empty'>No models to show yet.</p>;
        }

        if (!model) {
            return (
                <div className='model-missing' role='status'>
                    <h4>Model not found</h4>
                    <p className='model-status'>{`There is no model named “${name}”.`}</p>
                </div>
            );
        }

        const heading = (
            <div className='model-intro'>
                <div className='model-heading'>
                    <h4>Model Alarms</h4>
                </div>
            </div>
        );

        if (statusOf(model) === 'retired') {
            return (
                <>
                    {heading}
                    {this.retired(model)}
                </>
            );
        }

        const notice = (
            <>
                {`To subscribe to ${model.name} alarms, `}
                <span className='bold'>you must accept the terms and conditions.</span>
            </>
        );

        return (
            <>
                {heading}
                <NoticeTerms
                    notice={notice}
                    subject='model alarms'
                    terms={TERMS}
                    signed_in={signed_in === true}
                    accepted={accepted}
                    onAccept={this.acceptTerms}
                />
                {signed_in ? this.alarmSwitches() : null}
                {this.explained(model)}
            </>
        );
    }

    render() {
        const { name } = this.props;
        const { listing } = this.state;
        const model = this.model();

        //
        // back to the model's own page, or to every model where there is no model
        // by this name. While the listing is on its way, the name is taken to be a
        // model's, as a bell only leads to one
        //
        const back = model || listing === undefined
            ? { to: `/model/${encodeURIComponent(name)}`, label: name }
            : { to: '/model', label: 'All models' };

        return (
            <ErrorBoundary FallbackComponent={ErrorFallback}>
                <div className='container model-layout model-alarm'>
                    <Link className='model-back' to={back.to}>&lsaquo; {back.label}</Link>
                    {this.body(model)}
                </div>
            </ErrorBoundary>
        );
    }
}

//
// the name is read from the address here, since react-router's hooks cannot be
// called from a class, as model-page.jsx does it. Keyed by the name, so moving from
// one model's alarm page to another's starts the page over
//
export default function ModelAlarmRoute(props) {
    const { model } = useParams();

    return <ModelAlarm key={model} {...props} name={model} />;
}

export { ModelAlarm };
