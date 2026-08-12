/**
 * login-mfa.test.jsx: the sign-in form's second factor and its error paths.
 *
 * login.test.jsx covers the happy path -- fields, typing, a successful sign-in. This
 * covers what the component does when Cognito says no, and the whole MFA form, which
 * is roughly half the file and unreachable until a sign-in returns a user carrying a
 * preferred MFA method.
 *
 * render() chooses between the two forms on that single condition:
 *
 *     value_auth_user && checkValidObject('preferredMFA', ...) && preferredMFA !== 'NOMFA'
 *
 * so the MFA form is reached the way a user reaches it -- by signing in against a
 * mocked Auth that answers with an MFA challenge -- rather than by setting state.
 *
 * Note: '@aws-amplify/auth' is mocked; it is the network boundary.
 */

import React from 'react';
import { render, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

jest.mock('@aws-amplify/auth', () => ({
    __esModule: true,
    default: {
        signIn: jest.fn(),
        confirmSignIn: jest.fn(),
        confirmSignUp: jest.fn(),
        resendSignUp: jest.fn(),
    },
}));

import Auth from '@aws-amplify/auth';
import LoginForm from '../../import/content/login.jsx';

const USERNAME = 'jeff';
const PASSWORD = 'Abcdefghi1';
const CODE = '123456';

//
// a signed-in user that still owes a second factor. 'preferredMFA' is what render()
// switches on; 'challengeName' is what handleMfaSubmit requires before it will call
// confirmSignIn.
//
const MFA_USER = { preferredMFA: 'SMS_MFA', challengeName: 'SMS_MFA' };

function setup() {
    const dispatchLayout = jest.fn();
    const dispatchLogin = jest.fn();
    const dispatchSpinner = jest.fn();

    const utils = render(
        <MemoryRouter initialEntries={['/login']}>
            <Routes>
                <Route
                    path='/login'
                    element={
                        <LoginForm
                            dispatchLayout={dispatchLayout}
                            dispatchLogin={dispatchLogin}
                            dispatchSpinner={dispatchSpinner}
                        />
                    }
                />
                <Route path='/jeff' element={<div>SIGNED IN</div>} />
            </Routes>
        </MemoryRouter>
    );

    return { ...utils, dispatchLayout, dispatchLogin, dispatchSpinner };
}

const field = (name) => document.querySelector(`[name="${name}"]`);
const submit = () => document.querySelector('[type="submit"]');
const notes = () => [...document.querySelectorAll('.invalid-pop')].map(n => n.textContent);

//
// sign in far enough to be asked for a second factor.
//
async function reachMfaForm() {
    Auth.signIn.mockResolvedValue(MFA_USER);
    const utils = setup();

    await userEvent.type(field('user[login]'), USERNAME);
    await userEvent.type(field('user[password]'), PASSWORD);
    await userEvent.click(submit());

    await waitFor(() => expect(field('user[mfa]')).toBeTruthy());

    return utils;
}

function cognitoError(code, message = 'refused') {
    return Object.assign(new Error(message), { code, message });
}

beforeEach(() => {
    jest.clearAllMocks();
    sessionStorage.clear();
});

describe('the sign-in error paths', () => {
    it.each([
        ['NotAuthorizedException'],
        ['InvalidParameterException'],
        ['UserNotFoundException'],
        ['UserNotConfirmedException'],
    ])('marks the form invalid for %s', async (code) => {
        //
        // four separate flags, one per code, each driving a different note. They are
        // independent 'if's rather than an else-chain, so all four are checked.
        //
        Auth.signIn.mockRejectedValue(cognitoError(code));
        setup();

        await userEvent.type(field('user[login]'), USERNAME);
        await userEvent.type(field('user[password]'), PASSWORD);
        await userEvent.click(submit());

        await waitFor(() => expect(notes().length).toBeGreaterThan(0));
    });

    it('records nothing in session storage when sign-in fails', async () => {
        //
        // the username is only stored on success, so a rejected attempt must not leave
        // the app believing someone is signed in.
        //
        Auth.signIn.mockRejectedValue(cognitoError('NotAuthorizedException'));
        setup();

        await userEvent.type(field('user[login]'), USERNAME);
        await userEvent.type(field('user[password]'), PASSWORD);
        await userEvent.click(submit());

        await waitFor(() => expect(notes().length).toBeGreaterThan(0));
        expect(sessionStorage.getItem('username')).toBeNull();
    });

    it('lowers the spinner even when sign-in fails', async () => {
        const { dispatchSpinner } = setup();
        Auth.signIn.mockRejectedValue(cognitoError('NotAuthorizedException'));

        await userEvent.type(field('user[login]'), USERNAME);
        await userEvent.type(field('user[password]'), PASSWORD);
        await userEvent.click(submit());

        await waitFor(() => expect(dispatchSpinner).toHaveBeenCalledTimes(2));
        expect(dispatchSpinner.mock.calls[1][0]).toMatchObject({ spinner: false });
    });
});

describe('confirming an unactivated account during sign-in', () => {
    it('confirms the signup when a verification code was typed', async () => {
        //
        // the verification field only appears after a UserNotConfirmedException, and the
        // next submit both confirms the account and retries the sign-in -- the
        // confirmSignUp block is not an early return.
        //
        Auth.signIn.mockRejectedValue(cognitoError('UserNotConfirmedException'));
        setup();

        await userEvent.type(field('user[login]'), USERNAME);
        await userEvent.type(field('user[password]'), PASSWORD);
        await userEvent.click(submit());

        await waitFor(() => expect(field('user[verification]')).toBeTruthy());
        Auth.confirmSignUp.mockResolvedValue({});

        await userEvent.type(field('user[verification]'), CODE);
        await userEvent.click(submit());

        await waitFor(() => expect(Auth.confirmSignUp).toHaveBeenCalledWith(USERNAME, CODE));
    });

    it('reports a mismatched verification code', async () => {
        Auth.signIn.mockRejectedValue(cognitoError('UserNotConfirmedException'));
        setup();

        await userEvent.type(field('user[login]'), USERNAME);
        await userEvent.type(field('user[password]'), PASSWORD);
        await userEvent.click(submit());
        await waitFor(() => expect(field('user[verification]')).toBeTruthy());

        Auth.confirmSignUp.mockRejectedValue(
            cognitoError('CodeMismatchException', 'Invalid verification code provided')
        );

        await userEvent.type(field('user[verification]'), CODE);
        await userEvent.click(submit());

        await waitFor(() =>
            expect(notes().join(' ')).toContain('Invalid verification code provided')
        );
    });

    it('offers to resend the activation code from the mfa form', async () => {
        //
        // the resend link is rendered by mfa(), not by signIn(): it appears when the
        // CHALLENGE comes back UserNotConfirmedException, which is how an account that
        // needs activating surfaces once a second factor is already in play.
        //
        await reachMfaForm();
        Auth.confirmSignIn.mockRejectedValue(cognitoError('UserNotConfirmedException'));
        Auth.resendSignUp.mockResolvedValue({});

        await userEvent.type(field('user[mfa]'), CODE);
        await userEvent.click(submit());
        await waitFor(() => expect(document.querySelector('.link')).toBeTruthy());

        await userEvent.click(document.querySelector('.link'));

        await waitFor(() => expect(Auth.resendSignUp).toHaveBeenCalledWith(USERNAME));
    });

    it('swallows a failed resend rather than breaking the form', async () => {
        await reachMfaForm();
        Auth.confirmSignIn.mockRejectedValue(cognitoError('UserNotConfirmedException'));
        Auth.resendSignUp.mockRejectedValue(new Error('rate limited'));
        const quiet = jest.spyOn(console, 'log').mockImplementation(() => {});

        await userEvent.type(field('user[mfa]'), CODE);
        await userEvent.click(submit());
        await waitFor(() => expect(document.querySelector('.link')).toBeTruthy());

        await userEvent.click(document.querySelector('.link'));

        await waitFor(() => expect(quiet).toHaveBeenCalled());
        expect(field('user[mfa]')).toBeTruthy();

        quiet.mockRestore();
    });

    it('asks for an activation code on the mfa form when the account is unconfirmed', async () => {
        await reachMfaForm();
        Auth.confirmSignIn.mockRejectedValue(cognitoError('UserNotConfirmedException'));

        await userEvent.type(field('user[mfa]'), CODE);
        await userEvent.click(submit());

        await waitFor(() => expect(field('user[verification]')).toBeTruthy());
        expect(notes().join(' ')).toContain('Account requires activation');
    });
});

describe('the mfa form', () => {
    it('replaces the sign-in form once a second factor is required', async () => {
        await reachMfaForm();

        expect(field('user[mfa]')).toBeTruthy();
        expect(field('user[password]')).toBeNull();
    });

    it('stays on the sign-in form for an account with no MFA', async () => {
        //
        // 'NOMFA' is a value rather than an absence, so it has to be excluded explicitly
        // or every signed-in user would be asked for a code.
        //
        Auth.signIn.mockResolvedValue({ preferredMFA: 'NOMFA' });
        setup();

        await userEvent.type(field('user[login]'), USERNAME);
        await userEvent.type(field('user[password]'), PASSWORD);
        await userEvent.click(submit());

        await waitFor(() => expect(sessionStorage.getItem('username')).toBe(USERNAME));
        expect(field('user[mfa]')).toBeNull();
    });

    it('the code field is controlled', async () => {
        await reachMfaForm();

        await userEvent.type(field('user[mfa]'), CODE);

        expect(field('user[mfa]')).toHaveValue(CODE);
    });

    it('confirms the challenge with the user, code and type', async () => {
        await reachMfaForm();
        Auth.confirmSignIn.mockResolvedValue({});

        await userEvent.type(field('user[mfa]'), CODE);
        await userEvent.click(submit());

        await waitFor(() => expect(Auth.confirmSignIn).toHaveBeenCalled());
        const [user, code] = Auth.confirmSignIn.mock.calls[0];
        expect(user).toEqual(MFA_USER);
        expect(code).toBe(CODE);
    });

    it('redirects to the user page once the challenge is met', async () => {
        await reachMfaForm();
        Auth.confirmSignIn.mockResolvedValue({});

        await userEvent.type(field('user[mfa]'), CODE);
        await userEvent.click(submit());

        await waitFor(() => expect(document.body.textContent).toContain('SIGNED IN'));
    });

    it('reports a mistyped code, which previously said nothing at all', async () => {
        //
        // FIXED, in login.jsx. mfa() had a branch for PasswordResetRequiredException,
        // NotAuthorizedException, UserNotFoundException and 'parameter' -- but not for
        // CodeMismatchException, which is the likeliest failure on this form. A wrong or
        // expired sms code therefore produced no note and no redirect: the form just sat
        // there, and the visitor had nothing to tell them the code was rejected.
        //
        await reachMfaForm();
        Auth.confirmSignIn.mockRejectedValue(cognitoError('CodeMismatchException'));

        await userEvent.type(field('user[mfa]'), CODE);
        await userEvent.click(submit());

        await waitFor(() => expect(notes().join(' ')).toContain('Invalid verification code.'));
        expect(document.body.textContent).not.toContain('SIGNED IN');
    });

    it.each([
        ['PasswordResetRequiredException', 'Password needs to be reset.'],
        ['NotAuthorizedException', 'Incorrect password.'],
        ['UserNotFoundException', 'User account does not exist.'],
    ])('reports %s', async (code, expected) => {
        await reachMfaForm();
        Auth.confirmSignIn.mockRejectedValue(cognitoError(code));

        await userEvent.type(field('user[mfa]'), CODE);
        await userEvent.click(submit());

        await waitFor(() => expect(notes().join(' ')).toContain(expected));
    });

    it('falls back to a parameter error when the failure carries no code', async () => {
        //
        // an error with no 'code' is the shape thrown when confirmSignIn is called with
        // something missing, rather than rejected by Cognito.
        //
        await reachMfaForm();
        Auth.confirmSignIn.mockRejectedValue(new Error('no code property'));

        await userEvent.type(field('user[mfa]'), CODE);
        await userEvent.click(submit());

        await waitFor(() =>
            expect(notes().join(' ')).toContain('User or password not correctly submitted.')
        );
    });

    it('does not confirm anything when the challenge is not SMS_MFA', async () => {
        //
        // handleMfaSubmit requires challengeName === 'SMS_MFA'. A user whose preferredMFA
        // puts them on the MFA form WITHOUT that challenge submits into a no-op: the
        // whole try block is skipped, so nothing is sent and nothing is reported.
        //
        Auth.signIn.mockResolvedValue({ preferredMFA: 'TOTP' });
        setup();

        await userEvent.type(field('user[login]'), USERNAME);
        await userEvent.type(field('user[password]'), PASSWORD);
        await userEvent.click(submit());
        await waitFor(() => expect(field('user[mfa]')).toBeTruthy());

        await userEvent.type(field('user[mfa]'), CODE);
        await userEvent.click(submit());

        await waitFor(() => expect(Auth.confirmSignIn).not.toHaveBeenCalled());
        expect(document.body.textContent).not.toContain('SIGNED IN');
    });

    it('lowers the spinner after a refused challenge', async () => {
        const utils = await reachMfaForm();
        Auth.confirmSignIn.mockRejectedValue(cognitoError('CodeMismatchException'));
        utils.dispatchSpinner.mockClear();

        await userEvent.type(field('user[mfa]'), CODE);
        await userEvent.click(submit());

        await waitFor(() => expect(utils.dispatchSpinner).toHaveBeenCalled());
        const last = utils.dispatchSpinner.mock.calls.slice(-1)[0][0];
        expect(last).toMatchObject({ spinner: false });
    });

    it('renders a placeholder rather than an unreachable spinner', () => {
        //
        // getSpinner() branched on 'display_spinner', a state key nothing ever sets, so
        // the real Spinner could never appear. The dead branch and its import are gone --
        // the same removal made in forgot-password.jsx, which this form was copied from.
        //
        setup();

        expect(document.querySelector('.spinner')).toBeNull();
    });
});
