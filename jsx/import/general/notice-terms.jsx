/**
 *  notice-terms.jsx: agreement notice:
 *
 * Note: this script implements jsx (reactjs) syntax.
 *
 * Note: importing 'named export' (multiple export statements in a module),
 *       requires the object being imported, to be surrounded by { brackets }.
 *
 */

import React, { Component } from 'react';
import PrivacyTipIcon from '@mui/icons-material/PrivacyTip';
import LoginLink from '../navigation/menu-items/login.jsx';
import PropTypes from 'prop-types';
import { isMobile } from 'react-device-detect';
import checkValidString from '../validator/valid-string.js';

class NoticeTerms extends Component {
    // prob validation: static method, similar to class A {}; A.b = {};
    static propTypes = {
        subject: PropTypes.string,
        header: PropTypes.string,
        notice: PropTypes.element,
        terms: PropTypes.string,
        icon_color: PropTypes.string
    }

    constructor(props) {
        super(props);

        if ('subject' in this.props && checkValidString(this.props.subject)) {
            var subject = this.props.subject;
        } else {
            var subject = 'triggers';
        }

        if ('header' in this.props && checkValidString(this.props.header)) {
            var header = this.props.header;
        } else {
            var header = isMobile
                ? 'Login to subscribe'
                : `You need to login to subscribe to ${subject}`;
        }

        if ('notice' in this.props) {
            var notice = this.props.notice;
        } else {
            var notice = (
                <p>To subscribe to individual triggers,
                    <span className='bold'> you must accept the terms and conditions.</span>
                </p>
            );
        }

        if ('terms' in this.props && checkValidString(this.props.terms)) {
            var terms = this.props.terms;
        } else {
            const lowercase = subject.toLowerCase();
            var terms = `
                By accessing our system, you acknowledge that the provided ${lowercase}
                is offered as is. Though we strive for excellence, ${lowercase} are provided
                at best effort. Lastly, you agree to have fun and build something amazing.
            `;
        }

        if ('footer_suffix' in this.props) {
            var footer_suffix = this.props.footer_suffix;
        } else {
            var footer_suffix = isMobile
                ? ''
                : ` to review the conditions and subscribe to ${subject}.`;
        }

        if ('icon_color' in this.props && checkValidString(this.props.icon_color)) {
            var icon_color = this.props.icon_color;
        } else {
            var icon_color = 'green';
        }

        this.state = {
            subject: subject,
            header: header,
            notice: notice,
            terms: terms,
            footer_suffix: footer_suffix,
            icon_color: icon_color
        }
    }

    componentDidUpdate(prevProps, prevState) {
        if (
            'subject' in this.props
            && checkValidString(this.props.subject)
            && 'subject' in prevProps
            && this.props.subject !== prevProps.subject
        ) {
            this.setState({ subject: this.props.subject });
        }

        if (
            'header' in this.props
            && checkValidString(this.props.header)
            && 'header' in prevProps
            && this.props.header !== prevProps.header
        ) {
            this.setState({ header: this.props.header });
        }

        if (
            'notice' in this.props
            && this.props.notice
            && 'notice' in prevProps
            && this.props.notice !== prevProps.notice
        ) {
            this.setState({ notice: this.props.notice });
        }

        if (
            'terms' in this.props
            && checkValidString(this.props.terms)
            && 'terms' in prevProps
            && this.props.terms !== prevProps.terms
        ) {
            //
            // 'terms' -- this set { header: this.props.header }. A changed terms string
            // therefore left the terms alone and overwrote the HEADING instead, with
            // whatever the header prop happened to be: undefined for every caller that
            // does not pass one, which blanked the heading entirely.
            //
            this.setState({ terms: this.props.terms });
        }

        if (
            'footer_suffix' in this.props
            && checkValidString(this.props.footer_suffix)
            && 'footer_suffix' in prevProps
            && this.props.footer_suffix !== prevProps.footer_suffix
        ) {
            this.setState({ footer_suffix: this.props.footer_suffix });
        }

        if (
            'icon_color' in this.props
            && checkValidString(this.props.icon_color)
            && 'icon_color' in prevProps
            //
            // compares icon_color with icon_color. This read
            // 'this.props.terms !== prevProps.icon_color', comparing two unrelated
            // fields: a terms paragraph is never equal to a colour name, so the branch
            // fired on essentially every update regardless of whether the colour had
            // changed.
            //
            && this.props.icon_color !== prevProps.icon_color
        ) {
            this.setState({ icon_color: this.props.icon_color });
        }
    }

    render() {
        const class_name = isMobile ? 'agreement agreement-mobile' : 'agreement';
        return (
            <div className={class_name}>
                <div className='agreement-content'>
                    <h4><PrivacyTipIcon style={{ color: this.state.icon_color }} />{this.state.header}</h4>
                    {/*

                        rendered bare, not wrapped in a <p>.

                        'notice' is declared as PropTypes.element and the default IS a
                        <p>, so wrapping it produced '<p><p>...</p></p>'. A browser cannot
                        nest paragraphs: it closes the outer one as soon as the inner
                        starts, so what reached the page was two siblings plus an empty
                        paragraph, and any styling on the outer one applied to nothing.
                        React reported this as a validateDOMNesting warning on every
                        render, which the console trap was discarding.

                    */}
                    {this.state.notice}
                    <div className='border-bottom'>{this.state.terms}</div>
                </div>
                <div className='agreement-button'>
                    <LoginLink/> or <LoginLink path='/register' text='Sign up'/>{this.state.footer_suffix}
                </div>
            </div>
        )
    }
}

export default NoticeTerms;
