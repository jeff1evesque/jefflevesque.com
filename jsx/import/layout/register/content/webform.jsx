/**
 * webform.jsx: registration form.
 *
 * @RegisterForm, must be capitalized in order for reactjs to render it as a
 *     component. Otherwise, the variable is rendered as a dom node.
 *
 * Note: this script implements jsx (reactjs) syntax.
 */

import React, { Component } from 'react';
import { Navigate } from 'react-router-dom';
import Auth from '@aws-amplify/auth';
import { setLayout, setSpinner } from '../../../redux/action/page.jsx';
import checkValidString from '../../../validator/valid-string.js';
import checkValidPassword from '../../../validator/valid-password.js';
import checkValidEmail from '../../../validator/valid-email.js';
import FormGroup from '@mui/material/FormGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import QRCode from 'react-qr-code';
import PropTypes from 'prop-types';

class RegisterForm extends Component {
    // prob validation: static method, similar to class A {}; A.b = {};
    static propTypes = {
        dispatchLayout: PropTypes.func,
        dispatchSpinner: PropTypes.func,
        user: PropTypes.shape({ name: PropTypes.string.isRequired, }),
    }

    constructor() {
        super();


        this.state = {
            redirect_path: '/login',
            ajax_done_result: null,
            validated_username: true,
            validated_password: true,
            validated_email: true,
            validated_password_server: true,
            validated_email_server: true,
            validated_username_server: true,
            value_username: '',
            value_email: '',
            value_password: '',
            check_mfa: false,
            cognito_path: null
        };
        this.handleSubmit = this.handleSubmit.bind(this);
        this.validate = this.validate.bind(this);
        this.handleUsername = this.handleUsername.bind(this);
        this.handlePassword = this.handlePassword.bind(this);
        this.handleEmail = this.handleEmail.bind(this);
        this.checkMfa = this.checkMfa.bind(this);
        this.SetMfaType = this.SetMfaType.bind(this);
    }

    componentDidMount() {
        // update redux store
        const action = setLayout({ layout: 'register' });
        this.props.dispatchLayout(action);
    }

    async SetMfaType(mfa_type) {
      try {
          const user = await Auth.currentAuthenticatedUser();
          const data = await Auth.setPreferredMFA(user, mfa_type);
          console.log(data);
      } catch (error) {
          console.log(`Error: setting MFA type, ${error}`);
      }
    }

    //
    // re-run the field validators against the values actually held in state, and
    // record the outcome so the labels and inline notes reflect it.
    //
    // This cannot read the 'validated_*' flags instead: they start out true and
    // are only ever written by the onInput handlers, so a field the visitor never
    // touched still reads as valid. An untouched form is exactly the case that
    // has to be rejected, so the values are what get checked.
    //
    // The email is optional -- handleSubmit omits the attribute entirely when it
    // is blank -- so an absent email passes and only a malformed one fails.
    //
    validate() {
        const validated_username = !!checkValidString(this.state.value_username);
        const validated_password = !!checkValidPassword(this.state.value_password);
        const validated_email = !this.state.value_email
            || !!checkValidEmail(this.state.value_email);

        this.setState({
            validated_username: validated_username,
            validated_password: validated_password,
            validated_email: validated_email
        });

        return validated_username && validated_password && validated_email;
    }

    // send form data to serverside on form submission
    async handleSubmit(event) {
        // prevent page reload
        event.preventDefault();

        //
        // refuse locally before spending a network round trip on something
        // Cognito is certain to reject. The three validators were previously
        // consulted only by the onInput handlers, which drive the 'invalid'
        // styling -- so the form turned the field red and submitted anyway.
        //
        if (!this.validate()) {
            return;
        }

        // display spinner
        this.props.dispatchSpinner(setSpinner({ spinner: true }));

        try {
            await Auth.signUp({
                username: this.state.value_username,
                password: this.state.value_password,
                attributes: {
                    ...(this.state.value_email) && {email: this.state.value_email}
                }
            });

            const user = await Auth.signIn(
                this.state.value_username,
                this.state.value_password
            );

            this.SetMfaType('TOTP');

            this.setState({
                ajax_done_result: user,
                redirect_path: this.state.value_username
            });
        } catch (error) {
            const code = error.code;
            const message = error.message;

            if (code === 'UsernameExistsException') {
                this.setState({ validated_username_server: false });
                this.setState({ validated_username_server_error: 'exists' });
            }

            if (code === 'InvalidParameterException') {
                if (message.toLowerCase().includes('email')) {
                    this.setState({ validated_email_server: false });
                    this.setState({ validated_email_server_error: 'format' });
                }
                if (message.toLowerCase().includes('password')) {
                    this.setState({ validated_password_server: false });
                }
            }

            if (code === 'InvalidPasswordException') {
                this.setState({ validated_password_server: false });
            }
        }

        this.props.dispatchSpinner(setSpinner({ spinner: false }));
    }

    handleUsername(event) {
        const username = event.target.value;
        const check = !!checkValidString(username);

        this.setState({ validated_username: check });
        this.setState({ value_username: username });
    }

    handleEmail(event) {
        const email = event.target.value;
        const check = !!checkValidEmail(email);

        this.setState({ validated_email: check });
        this.setState({ value_email: email });
    }

    handlePassword(event) {
        const password = event.target.value;
        const check = !!checkValidPassword(password);

        this.setState({ validated_password: check });
        this.setState({ value_password: password });
    }

    checkMfa() {
        this.setState({ check_mfa: !this.state.check_mfa });
    }

    // triggered when 'state properties' change
    render() {
        // frontend validation
        const usernameClass = (this.state.validated_username) ? '' : 'invalid';
        const passwordClass = (this.state.validated_password) ? '' : 'invalid';
        const emailClass = (this.state.validated_email) ? '' : 'invalid';

        if (!this.state.validated_username) {
            var usernameNote = <div className='invalid-pop'>Username cannot be empty.</div>;
        } else if (
            !this.state.validated_username_server &&
            this.state.validated_username_server_error === 'exists'
        ) {
            var usernameNote = <div className='invalid-pop'>Username already registered.</div>;
        }

        //
        // A third branch was removed here. It combined both messages for the
        // "empty AND already registered" case:
        //
        //     !validated_username && !validated_username_server &&
        //     validated_username_server_error === 'exists'
        //
        // but it could never run: the first branch above already matches on
        // !validated_username alone, so control never reached it. Removing it
        // therefore changes nothing at runtime.
        //
        // If that combined message IS wanted, the branch has to be moved ABOVE
        // the !validated_username check rather than restored where it was --
        // note that it also requires the server to report 'exists' for an
        // empty username, which is worth confirming is reachable at all.
        //

        // backend validation
        const passwordNote = (!this.state.validated_password_server)
            ? <div className='invalid-pop'>Password requirement not met.</div>
            : null;

        if (!this.state.validated_email_server) {
            if (this.state.validated_email_server_error === 'format') {
                var emailNote = (
                    <div className='invalid-pop'>Invalid email format.</div>
                );
            }
        }

        const redirect = this.state.ajax_done_result
            ? <Navigate to={this.state.redirect_path} />
            : null;

        const mfa_content = this.state.check_mfa && this.state.cognito_path
            ? <QRCode value={this.state.cognito_path}/>
            : null;

        return (
            <form onSubmit={this.handleSubmit}>
                {redirect}{usernameNote}{emailNote}{passwordNote}
                <div className='form-group'>
                    <label className={`form-label ${usernameClass}`}>
                        Username
                    </label>
                    <input
                        className='input-block'
                        name='user[name]'
                        onInput={this.handleUsername}
                        type='text'
                        value={this.state.value_username}
                    />
                </div>

                <div className='form-group'>
                    <label className={`form-label ${emailClass}`}>
                        Email Address
                    </label>
                    <input
                        className='input-block'
                        name='user[email]'
                        onInput={this.handleEmail}
                        type='text'
                        value={this.state.value_email}
                    />
                    <p className='note'>
                        You will get updates regarding account changes,
                        or trigger notifications you've chosen.
                    </p>
                </div>

                <div className='form-body form-highlight'>
                    <label className={`form-label ${passwordClass}`}>
                        Password
                    </label>
                    <input
                        className='input-block'
                        name='user[password]'
                        onInput={this.handlePassword}
                        type='password'
                        value={this.state.value_password}
                    />
                    <p className='note border-bottom'>
                        At least one lower and upper case, one number, and at least
                        ten characters.
                    </p>

                    <FormGroup className='form-group-mui'>
                        <FormControlLabel
                            control={<Checkbox checked={this.state.check_mfa} />}
                            onChange={this.checkMfa}
                            label='Enable MFA'
                        />
                    </FormGroup>

                    {mfa_content}
                </div>

                <input
                    className='btn btn-primary'
                    type='submit'
                    value='Create an account'
                />
            </form>
        );
    }
}

// indicate which class can be exported, and instantiated via 'require'
export default RegisterForm;
