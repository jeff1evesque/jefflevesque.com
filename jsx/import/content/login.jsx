/**
 * login.jsx: login form.
 *
 * @LoginForm, must be capitalized in order for reactjs to render it as a
 *     component. Otherwise, the variable is rendered as a dom node.
 *
 * Note: this script implements jsx (reactjs) syntax.
 *
 * Note: importing 'named export' (multiple export statements in a module),
 *       requires the object being imported, to be surrounded by { brackets }.
 *
 */

import React, { Component } from 'react';
import { Link, Navigate } from 'react-router-dom';
import Auth from '@aws-amplify/auth';
import { setLayout, setSpinner } from '../redux/action/page.jsx';
import { setLoginState }  from '../redux/action/login.jsx';
import checkValidObject from '../validator/valid-object.js';
import PropTypes from 'prop-types';

class LoginForm extends Component {
    // prob validation: static method, similar to class A {}; A.b = {};
    static propTypes = {
        dispatchLayout: PropTypes.func,
        dispatchLogin: PropTypes.func,
        dispatchSpinner: PropTypes.func,
        user: PropTypes.shape({ name: PropTypes.string.isRequired, }),
    }

    //
    // @SMS_MFA, input the code received from SMS message
    //
    constructor() {
        super();
        this.state = {
            redirect_path: '',
            display_spinner: false,
            validated_login_server: true,
            validated_password_server: true,
            validated_user_server: true,
            validated_user_verification_server: true,
            validated_user_verification_server_error: '',
            validated_mfa_server_error: '',
            validated_mfa_confirmed: false,
            value_mfa_type: 'SMS_MFA',
            value_auth_user: '',
            value_username: '',
            value_password: '',
            value_verification: '',
            value_mfa_code: ''
        }
        this.getSpinner = this.getSpinner.bind(this);
        this.handleSignInSubmit = this.handleSignInSubmit.bind(this);
        this.handleMfa = this.handleMfa.bind(this);
        this.handleMfaSubmit = this.handleMfaSubmit.bind(this);
        this.handleUsername = this.handleUsername.bind(this);
        this.handlePassword = this.handlePassword.bind(this);
        this.handleVerification = this.handleVerification.bind(this);
        this.handleResend = this.handleResend.bind(this);
        this.signIn = this.signIn.bind(this);
        this.mfa = this.mfa.bind(this);
    }

    componentDidMount() {
        // update redux store
        const action = setLayout({ layout: 'login' });
        this.props.dispatchLayout(action);

        if ('username' in sessionStorage) {
            this.setState({ redirect_path: `/${sessionStorage.getItem('username')}` });
        }
    }

    handleUsername(event) {
        this.setState({ value_username: event.target.value });
    }

    handlePassword(event) {
        this.setState({ value_password: event.target.value });
    }

    handleVerification(event) {
        this.setState({ value_verification: event.target.value });
    }

    handleMfa(event) {
        this.setState({ value_mfa_code: event.target.value });
    }

    // send form data to serverside on form submission
    async handleSignInSubmit(event) {
        // prevent page reload
        event.preventDefault();

        // display spinner
        this.props.dispatchSpinner(setSpinner({ spinner: true }));

        //
        // confirm account: use requested verification code from earlier
        //     callback, or registration (found in received email)
        //
        if (this.state.value_username && this.state.value_verification) {
            try {
                // Return value intentionally discarded -- awaited for the side
                // effect, and for the throw that the catch below handles.
                await Auth.confirmSignUp(
                    this.state.value_username,
                    this.state.value_verification
                )
            } catch (error) {
                const code = error.code;
                const message = error.message;

                if (code == 'CodeMismatchException') {
                    this.setState({ validated_user_verification_server_error: message });
                }
            }
        } else {
            this.setState({
                validated_user_verification_server_error: 'User or verification code not valid.'
            });
        }

        try {
            const user = await Auth.signIn(
                this.state.value_username,
                this.state.value_password
            );

            if (!!user) {
                this.setState({ value_auth_user: user, redirect_path: `/${this.state.value_username}` });
                this.props.dispatchLogin(setLoginState(this.state.value_username));
                sessionStorage.setItem('username', this.state.value_username);
            }

        } catch (error) {
            const code = error.code;

            if (code == 'NotAuthorizedException') {
                this.setState({ validated_login_server: false });
            }

            if (code == 'InvalidParameterException') {
                this.setState({ validated_password_server: false});
            }

            if (code == 'UserNotFoundException') {
                this.setState({ validated_user_server: false});
            }

            if (code == 'UserNotConfirmedException') {
                this.setState({ validated_user_verification_server: false });
            }
        }
        this.props.dispatchSpinner(setSpinner({ spinner: false }));
    }

    async handleMfaSubmit(event) {
        // prevent page reload
        event.preventDefault();

        // display spinner
        this.props.dispatchSpinner(setSpinner({ spinner: true }));

        //
        // Note: three console.log lines were removed from here -- two '====' rules and
        //       the CognitoUser itself. Debug residue rather than diagnostics: it wrote
        //       the signed-in user object, session tokens included, to the browser
        //       console of anyone completing an MFA challenge.
        //
        try {
            if (
                !!this.state.value_auth_user &&
                'challengeName' in this.state.value_auth_user &&
                this.state.value_auth_user.challengeName === 'SMS_MFA'
            ) {
                // Return value intentionally discarded -- awaited for the side
                // effect of completing the MFA challenge.
                await Auth.confirmSignIn(
                    this.state.value_auth_user,
                    this.state.value_mfa_code,
                    this.state.value_mfa_type
                );

                this.props.dispatchSpinner(setSpinner({ spinner: false }));
                this.setState({ validated_mfa_confirmed: true });
            }
        } catch (error) {
            if ('code' in error) {
                this.setState({ validated_mfa_server_error: error.code });
            } else {
                this.setState({ validated_mfa_server_error: 'parameter' });
            }
        }

        this.props.dispatchSpinner(setSpinner({ spinner: false }));
    }

    //
    // verification code: send account verification code via email
    //
    async handleResend(event) {
        // prevent page reload
        event.preventDefault();

        this.props.dispatchSpinner(setSpinner({ spinner: true }));
        try {
            await Auth.resendSignUp(this.state.value_username);
        } catch (error) {
            console.log('error resending code: ', error);
        }
        this.props.dispatchSpinner(setSpinner({ spinner: false }));
    }

    //
    // the placeholder rendered where a local spinner used to be.
    //
    // this branched on 'this.state.display_spinner', which is absent from the
    // constructor's state and never written by any handler -- so the branch returning
    // the real Spinner was unreachable and it always returned 'span'. Identical to the
    // one removed from forgot-password.jsx; both forms were copied from one another.
    //
    // dispatchSpinner still drives the layout's own spinner around every request, which
    // is the one a visitor actually sees.
    //
    getSpinner() {
        return 'span';
    }

    signIn() {
        // local variables
        var verificationNote = null;
        var loginNote = null;
        var verificationInput = null;

        const AjaxSpinner = this.getSpinner();
        const codeLink = (
            <span className='link' onClick={this.handleResend}>new verification</span>
        );

        // backend validation
        if (!this.state.validated_user_verification_server) {
            if (this.state.validated_user_verification_server_error) {
                var verificationNote = (
                    <div className='invalid-pop'>
                        {this.state.validated_user_verification_server_error}
                    </div>
                );
            } else {
                var verificationNote = (
                    <div className='invalid-pop'>
                        Account requires activation (check email), or request {codeLink} code.
                    </div>
                );
            }

            var verificationInput = (
                <>
                    <label className='form-label invalid'>Verification Code</label>
                    <input
                        className='input-block'
                        name='user[verification]'
                        onInput={this.handleVerification}
                        type='text'
                        value={this.state.value_verification}
                    />
                </>
            );
        }

        if (!this.state.validated_login_server) {
            var loginNote = (
                <div className='invalid-pop'>Invalid email, or password.</div>
            );
        } else if (!this.state.validated_password_server) {
            var loginNote = (
                <div className='invalid-pop'>Password cannot be empty.</div>
            );
        } else if (!this.state.validated_user_server) {
            var loginNote = (
                <div className='invalid-pop'>User account does not exist.</div>
            );
        }

        if (
            'validated_user_server' in this.state
            && this.state.validated_user_server
            && 'redirect_path' in this.state
            && !!this.state.redirect_path
        ) {
            var redirect = <Navigate to={this.state.redirect_path} />;
        } else {
            var redirect = null;
        }

        return (
            <>
                <form onSubmit={this.handleSignInSubmit}>
                    {redirect}
                    <div className='form-header'>
                        <h1>Sign in Web-Interface</h1>
                    </div>
                    {loginNote}{verificationNote}
                    <div className='form-body form-highlight'>
                        <label>Username or email address</label>
                        <input
                            autoFocus
                            className='input-block'
                            name='user[login]'
                            onInput={this.handleUsername}
                            type='text'
                            value={this.state.value_username}
                        />
                        <label className='left'>Password</label>
                        <Link className='right no-hover' to='/login/reset'>
                            Forgot password?
                        </Link>
                        <input
                            className='input-block'
                            name='user[password]'
                            onInput={this.handlePassword}
                            type='password'
                            value={this.state.value_password}
                        />
                        {verificationInput}
                        <input
                            className='input-submit btn btn-primary'
                            type='submit'
                            value='Login'
                        />
                        <AjaxSpinner />
                    </div>
                </form>

                <div className='form-body center-text vertical-margin'>
                    Heard of jefflevesque? <Link to='/register'>Create an account</Link>.
                </div>
            </>
        );
    }

    mfa() {
        // local variables
        var verificationNote = null;
        var loginNote = null;
        var verificationInput = null;

        const AjaxSpinner = this.getSpinner();
        const codeLink = (
            <span className='link' onClick={this.handleResend}>new verification</span>
        );

        const redirect = this.state.validated_mfa_confirmed
            ? <Navigate to={this.state.redirect_path} />
            : null;

        if (this.state.validated_mfa_server_error === 'UserNotConfirmedException') {
            var verificationNote = (
                <div className='invalid-pop'>
                    Account requires activation (check email), or request {codeLink} code.
                </div>
            );

            var verificationInput = (
                <>
                    <label className='form-label invalid'>{'Verification Code'}</label>
                    <input
                        className='input-block'
                        name='user[verification]'
                        onInput={this.handleVerification}
                        type='text'
                        value={this.state.value_verification}
                    />
                </>
            );
        }

        if (this.state.validated_mfa_server_error === 'PasswordResetRequiredException') {
            var loginNote = (
                <div className='invalid-pop'>Password needs to be reset.</div>
            );
        } else if (this.state.validated_mfa_server_error === 'NotAuthorizedException') {
            var loginNote = (
                <div className='invalid-pop'>Incorrect password.</div>
            );
        } else if (this.state.validated_mfa_server_error === 'UserNotFoundException') {
             var loginNote = (
                 <div className='invalid-pop'>User account does not exist.</div>
             );
        } else if (this.state.validated_mfa_server_error === 'parameter') {
            var loginNote = (
                <div className='invalid-pop'>
                    User or password not correctly submitted.
                </div>
            );
        } else if (this.state.validated_mfa_server_error === 'CodeMismatchException') {
            //
            // the most likely failure on this form -- a mistyped or expired sms code --
            // and it had no branch at all. handleMfaSubmit stored the code, every other
            // Cognito code got a note, and this one fell through the chain: the form
            // simply sat there after a wrong code, with nothing said and no redirect.
            //
            var loginNote = (
                <div className='invalid-pop'>Invalid verification code.</div>
            );
        }

        return(
            <form onSubmit={this.handleMfaSubmit}>
                {redirect}
                <div className='form-header'>
                    <h1>Sign in Web-Interface</h1>
                </div>
                {verificationNote}{verificationInput}{redirect}{loginNote}
                <div className='form-body form-highlight'>
                    <label>Authentication code</label>
                    <input
                        autoFocus
                        className='input-block'
                        name='user[mfa]'
                        onInput={this.handleMfa}
                        type='text'
                        value={this.state.value_mfa_code}
                    />
                    <input
                        className='input-submit btn btn-primary'
                        type='submit'
                        value='Login'
                    />
                    <AjaxSpinner />
                </div>
            </form>
        );
    }

    render() {
        if (
            this.state.value_auth_user
            && checkValidObject('preferredMFA', this.state.value_auth_user)
            && this.state.value_auth_user.preferredMFA !== 'NOMFA'
        ) {
            return this.mfa();
        } else {
            return this.signIn();
        }
    }
}

// indicate which class can be exported, and instantiated via 'require'
export default LoginForm;
