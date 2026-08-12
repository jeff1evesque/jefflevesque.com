/**
 * forget-password.jsx: forget password form.
 *
 * @ForgotPasswordForm, must be capitalized in order for reactjs to render it
 *     as a component. Otherwise, the variable is rendered as a dom node.
 *
 * Note: this script implements jsx (reactjs) syntax.
 *
 * Note: importing 'named export' (multiple export statements in a module),
 *       requires the object being imported, to be surrounded by { brackets }.
 *
 */

import React, { Component } from 'react';
import { Navigate } from 'react-router-dom';
import Auth from '@aws-amplify/auth';
import { setLayout, setSpinner } from '../redux/action/page.jsx';
import checkValidPassword from '../validator/valid-password.js';
import PropTypes from 'prop-types';

class ForgotPasswordForm extends Component {
    // prob validation: static method, similar to class A {}; A.b = {};
    static propTypes = {
        dispatchLayout: PropTypes.func,
        dispatchSpinner: PropTypes.func
    }

    constructor() {
        super();
        this.state = {
            redirect_path: '/login',
            validated_password_verification_sent: true,
            validated_account_verification_sent: false,
            validated_forgot_password_submit: false,
            validated_forgot_password_server: false,
            validated_forgot_password_submit_server: '',
            validated_forgot_password_server_error: '',
            validated_password_reset_server_error: '',
            validated_confirm_signup_server_error: '',
            validated_password_error: '',
            validated_password: false,
            validated_confirm_password: false,
            value_verification: '',
            value_email: '',
            value_password: '',
            value_confirm_password: '',
            matching_password: false
        }
        this.getSpinner = this.getSpinner.bind(this);
        this.handleVerificationSubmit = this.handleVerificationSubmit.bind(this);
        this.handleResetSubmit = this.handleResetSubmit.bind(this);
        this.handleEmail = this.handleEmail.bind(this);
        this.handlePassword = this.handlePassword.bind(this);
        this.handlePasswordConfirm = this.handlePasswordConfirm.bind(this);
        this.handleVerification = this.handleVerification.bind(this);
        this.requestVerificationCode = this.requestVerificationCode.bind(this);
        this.resetPassword = this.resetPassword.bind(this);
    }

    componentDidMount() {
        // update redux store
        const action = setLayout({ layout: 'login' });
        this.props.dispatchLayout(action);
    }

    handleEmail(event) {
        this.setState({ value_email: event.target.value });
    }

    handleVerification(event) {
        this.setState({ value_verification: event.target.value });
    }

    //
    // request: password verification code used on successive password reset
    //
    async handleVerificationSubmit(event) {
        // prevent page reload
        event.preventDefault();

        // display spinner
        this.props.dispatchSpinner(setSpinner({ spinner: true }));

        //
        // confirm account: use requested account verification code (previous
        //     callback) to confirm account
        //
        if (this.state.validated_account_verification_sent) {
            try {
                await Auth.confirmSignUp(
                    this.state.value_email,
                    this.state.value_verification
                )
                this.setState({ value_verification: '' });
            } catch (error) {
                if (!this.state.value_email) {
                    this.setState({ validated_confirm_signup_server_error: 'Email cannot be empty!' });
                } else if (!this.state.value_verification) {
                    this.setState({
                        validated_confirm_signup_server_error: 'Verification code cannot be empty!'
                    });
                } else {
                    this.setState({
                        validated_confirm_signup_server_error: 'Unable to request verification code.'
                    });
                }
            }
        }

        //
        // forgot password: send forgot password verification code via email
        //
        try {
            // Return value intentionally discarded -- awaited for the side
            // effect of sending the reset code, and for the throw on failure.
            await Auth.forgotPassword(this.state.value_email);
            this.setState({ validated_forgot_password_server: true });
        } catch (error) {
            this.setState({ validated_password_verification_sent: false });

            if (!this.state.value_email) {
                this.setState({ validated_forgot_password_server_error: 'Email cannot be empty!' });
            }
            else if ('code' in error && 'message' in error) {
                const { code, message } = error;

                if (code === 'InvalidParameterException' && message.toLowerCase().includes('verified')) {
                    //
                    // verification: send account verification code via email
                    //
                    this.setState({ validated_forgot_password_server_error: 'verification' });
                    try {
                        await Auth.resendSignUp(this.state.value_email);
                        this.setState({ validated_account_verification_sent: true });
                    } catch (error) {
                        console.log('error resending code: ', error);
                    }
                } else if (code === 'NotAuthorizedException' && message.toLowerCase().includes('confirmed')) {
                    this.setState({ validated_forgot_password_server_error: 'exist' });
                } else if (code === 'UserNotFoundException') {
                    this.setState({ validated_forgot_password_server_error: 'Account not found!' });
                } else {
                    this.setState({ validated_forgot_password_server_error: message });
                }
            } else {
                this.setState({
                    validated_forgot_password_server_error: 'Unable to request verification code.'
                });
            }
        }

        this.setState({ ajax_done_result: null });
        this.props.dispatchSpinner(setSpinner({ spinner: false }));
    }

    //
    // request verification: account verification (if not previously verified)
    //     code, and password verification code is emailed to user.
    //
    requestVerificationCode() {
        // local variables
        var requestNote = null;
        var verificationInput = null;
        const AjaxSpinner = this.getSpinner();

        // backend validation
        if (!this.state.validated_forgot_password_server) {
            if (this.state.validated_forgot_password_server_error === 'verification') {
                var verificationInput = (
                    <>
                        <label className='form-label invalid'>
                            Account Verification Code (check email)
                        </label>
                        <input
                            className='input-block'
                            name='user[verification]'
                            onInput={this.handleVerification}
                            type='text'
                            value={this.state.value_verification}
                        />
                    </>
                );
            } else if (this.state.validated_forgot_password_server_error === 'exist') {
                var requestNote = (
                    <div className='invalid-pop'>Account already activated.</div>
                );
            } else if (this.state.validated_forgot_password_server_error) {
                var requestNote = (
                    <div className='invalid-pop'>
                        {this.state.validated_forgot_password_server_error}
                    </div>
                );
            }
        }

        if (this.state.validated_confirm_signup_server_error) {
            var verificationNote = (
                <div className='invalid-pop'>
                    {this.state.validated_confirm_signup_server_error}
                </div>
            );
        }

        return (
            <form onSubmit={this.handleVerificationSubmit}>
                <div className='form-header'>
                    <h1>Reset Password</h1>
                </div>
                {requestNote}{verificationNote}
                <div className='form-body'>
                    <label>Email</label>
                    <input
                        autoFocus
                        className='input-block'
                        name='user[email]'
                        onInput={this.handleEmail}
                        type='text'
                        value={this.state.value_email}
                    />

                    {verificationInput}

                    <input
                        className='input-submit btn btn-primary'
                        type='submit'
                        value='Submit'
                    />
                    <AjaxSpinner />
                </div>
            </form>
        )
    }

    //
    // check password: validates password, and check that password matches
    //     provided confirm password.
    //
    handlePassword(event) {
        // prevent page reload
        event.preventDefault();

        const password = event.target.value;
        const { value_confirm_password } = this.state;

        this.setState({ value_password: password });
        this.setState({ matching_password: password === value_confirm_password ? true : false });
        this.setState({ validated_password: !!checkValidPassword(password) ? true : false });
    }

    handlePasswordConfirm(event) {
        // prevent page reload
        event.preventDefault();

        const confirm_password = event.target.value;
        const { value_password } = this.state;

        this.setState({ value_confirm_password: confirm_password });
        this.setState({ matching_password: value_password === confirm_password ? true : false });
        this.setState({
            validated_confirm_password: !!checkValidPassword(confirm_password) ? true : false
        });
    }

    //
    // reset password: using previous client-side validated new password
    //
    async handleResetSubmit(event) {
        // prevent page reload
        event.preventDefault();

        {/*

            validated BEFORE the request, not after it.

            the two checks below used to run after 'await Auth.forgotPasswordSubmit',
            so an empty or mismatched password was sent to Cognito on every attempt:
            the visitor was told 'Passwords do not match.' only once the round trip had
            failed, and each attempt counted against the reset code's retry limit --
            enough of them and a correctable typo turned into LimitExceededException.

            returning early also keeps 'validated_forgot_password_submit' false, so the
            redirect cannot fire on a form that was never valid.

        */}
        if (!this.state.value_password || !this.state.value_confirm_password) {
            this.setState({ validated_password_error: 'Passwords cannot be empty.' });
            return;
        }

        if (!this.state.matching_password) {
            this.setState({ validated_password_error: 'Passwords do not match.' });
            return;
        }

        this.setState({ validated_password_error: '' });

        try {
            await Auth.forgotPasswordSubmit(
                this.state.value_email,
                this.state.value_verification,
                this.state.value_password
            );
            this.setState({ validated_forgot_password_submit: true });
        } catch (error) {
            const { code } = error;
            this.setState({ validated_forgot_password_submit_server: code });
        }
    }

    //
    // reset password: using received password verification code
    //
    resetPassword() {
        // local variables
        var clientNote = null;
        var serverNote = null;
        var passwordNote = null;

        const AjaxSpinner = this.getSpinner();
        const redirect = (
            this.state.value_verification &&
            this.state.validated_password &&
            this.state.validated_confirm_password &&
            this.state.matching_password &&
            this.state.validated_forgot_password_server &&
            this.state.validated_forgot_password_submit
        ) ? <Navigate to='/login' /> : null;

        if (this.state.validated_forgot_password_submit_server === 'ExpiredCodeException') {
            const newCode = (
                <span className='link' onClick={this.handleVerificationSubmit}>(new code)</span>
            );

            var serverNote = (
                <div className='invalid-pop'>
                    <div>Invalid code provided, please request a {newCode} again.</div>
                </div>
            );
        } else if (this.state.validated_forgot_password_submit_server === 'CodeMismatchException') {
            var serverNote = (
                <div className='invalid-pop'>
                    Invalid verification code provided.
                </div>
            );
        } else if (this.state.validated_forgot_password_submit_server === 'LimitExceededException') {
            var serverNote = (
                <div className='invalid-pop'>
                    Attempt limit exceeded, please try after some time.
                </div>
            );
        }

        if (this.state.validated_password_error) {
            var passwordNote = (
                <div className='invalid-pop'>{this.state.validated_password_error}</div>
            );
        }

        {/*

            the note is for a MISSING code, so the test is negated. It read

                if (this.state.value_verification)

            which showed 'Verification code empty.' precisely when one HAD been typed,
            and showed nothing when the field was actually blank -- wrong in both
            directions at once.

        */}
        if (!this.state.value_verification) {
            var clientNote = <div className='invalid-pop'>Verification code empty.</div>
        }

        return (
            <form onSubmit={this.handleResetSubmit}>
                {redirect}
                <div className='form-header'>
                    <h1>Reset Password</h1>
                </div>
                {clientNote}{serverNote}{passwordNote}
                <div className='form-body'>
                    <label>Password Verification Code (check email)</label>
                    <input
                        autoFocus
                        className='input-block'
                        name='password[verification]'
                        onInput={this.handleVerification}
                        type='text'
                        value={this.state.value_verification}
                    />
                    <label>New Password</label>
                    <input
                        className='input-block'
                        name='password[value]'
                        onInput={this.handlePassword}
                        type='password'
                        value={this.state.value_password}
                    />
                    <label>Confirm Password</label>
                    <input
                        className='input-block'
                        name='password[valueConfirm]'
                        onInput={this.handlePasswordConfirm}
                        type='password'
                        value={this.state.value_confirm_password}
                    />
                    <input
                        className='input-submit btn btn-primary'
                        type='submit'
                        value='Submit'
                    />
                    <AjaxSpinner />
                </div>
            </form>
        )
    }

    //
    // the placeholder rendered where a local spinner used to be.
    //
    // getSpinner() branched on 'this.state.display_spinner', which is absent from the
    // constructor's state and never written by any handler -- so the branch returning
    // the real Spinner was unreachable and this always rendered a bare 'span'. The page
    // is not left without feedback: dispatchSpinner drives the layout's own spinner
    // around both requests, which is the one a visitor actually sees.
    //
    // Kept as a method returning 'span' rather than deleted outright, so the two forms
    // below keep their <AjaxSpinner /> slot for whenever a local indicator is wanted --
    // and the unreachable branch and the unused import are gone.
    //
    // Note: '//' rather than a '{/* */}' block. That form is a JSX comment and parses
    //       only where a statement or JSX child is allowed; in a class body it is a
    //       syntax error, which is what it produced here first time round.
    //
    getSpinner() {
        return 'span';
    }

    render() {
        if (!this.state.validated_forgot_password_server) {
            var content = this.requestVerificationCode();
        } else {
            var content = this.resetPassword();
        }

        return (<div className='reset-password-form'>{content}</div>);
    }
}

// indicate which class can be exported, and instantiated via 'require'
export default ForgotPasswordForm;
