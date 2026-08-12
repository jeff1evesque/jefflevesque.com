/**
 * account-type.jsx: types of account to register.
 *
 * @AccountType, must be capitalized in order for reactjs to render it as a
 *     component. Otherwise, the variable is rendered as a dom node.
 *
 * Note: this script implements jsx (reactjs) syntax.
 */

import React, { Component } from 'react';
import { BreakpointRender } from 'rearm/lib/Breakpoint';
import { breakpoints } from '../../../general/breakpoints.js';

class AccountType extends Component {
    // prob validation: static method, similar to class A {}; A.b = {};
    static propTypes = {
    }

    constructor() {
        super();
        this.state = {
        };

        this.getContent = this.getContent.bind(this);
    }

    getContent(large=true) {
        if (large) {
            var humble_bee_content = (
                <ul>
                    <li>Access ~3 months stream ingest metrics</li>
                    <li>Fast and optimized frontend rendering</li>
                    <li>Get notified for stream ingest alarms</li>
                    <li>Subscribe shared stream/trigger workflows</li>
                </ul>
            );

            var data_lizard_content = (
                <ul>
                    <li>Access 1-year stream ingest metrics</li>
                    <li>Fast and optimized frontend rendering</li>
                    <li>Create and share stream/trigger workflows</li>
                    <li>Integrate shared models into workflows</li>
                </ul>
            );

            var sourcer_supreme_content = (
                <ul>
                    <li>Anything in the realms of Bees / Lizards</li>
                    <li>Build datalake workflow conditions</li>
                    <li>Train models using multiverse of datalakes</li>
                    <li>Weave AI/ML into workflows and share</li>
                </ul>
            );
        } else {
            var humble_bee_content = 'Use workflows, monitor data stream';
            var data_lizard_content = 'Create and share workflows, monitor data streams';
            var sourcer_supreme_content = 'Integrate and share AI/ML workflows, monitor data streams';
        }

        const container_class = large ? 'container account-type' : 'account-type';
        const column_class = large ? 'col-4' : 'col-12';
        const agreement_class = large ? 'agreement' : 'agreement agreement-mobile';
        const header_class = large ? 'center-text h4-finesse' : 'center-text';
        const p_class = large ? 'general-list' : 'center-text';

        return(
            <div className={container_class}>
                <div className='row'>
                    <div className={column_class}>
                        <div className={agreement_class}>
                            <h4 className={header_class}>Humble Bee</h4>
                            <div className={p_class}>{humble_bee_content}</div>
                        </div>
                    </div>
                    <div className={column_class}>
                        <div className={agreement_class}>
                            <h4 className={header_class}>Data Lizard</h4>
                            <div className={p_class}>{data_lizard_content}</div>
                        </div>
                    </div>
                    <div className={column_class}>
                        <div className={agreement_class}>
                            <h4 className={header_class}>Sourcer Supreme</h4>
                            <div className={p_class}>{sourcer_supreme_content}</div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    render() {
        return (
            <BreakpointRender breakpoints={breakpoints} type='viewport'>{
                bp => bp.isGt('medium') ? this.getContent() : this.getContent(false)
            }</BreakpointRender>
        );
    }
}

// indicate which class can be exported, and instantiated via 'require'
export default AccountType;
