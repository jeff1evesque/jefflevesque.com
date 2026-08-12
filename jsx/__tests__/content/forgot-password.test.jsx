/**
 * forgot-password.test.jsx: the password reset flow.
 *
 * One component holding TWO forms and switching between them on
 * 'validated_forgot_password_server': the request form until Auth.forgotPassword
 * succeeds, the reset form afterwards. Nothing in the markup says which is
 * showing, so the tests navigate by field name.
 *
 * The flow reaches Cognito four different ways -- forgotPassword,
 * forgotPasswordSubmit, confirmSignUp and resendSignUp -- and almost all of the
 * branching is in what it does with the errors those return. That error handling
 * is what is covered here, since it is where the behaviour actually lives.
 *
 * Note: '@aws-amplify/auth' is mocked. It is the network boundary.
 *
 * Note: the reset form renders react-router's Navigate on success, so everything
 *       is wrapped in a router with a real /login route -- that redirect is the
 *       only signal the flow finished.
 */

import React from 'react';
import { render, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

jest.mock('@aws-amplify/auth', () => ({
    __esModule: true,
    default: {
        forgotPassword: jest.fn(),
        forgotPasswordSubmit: jest.fn(),
        confirmSignUp: jest.fn(),
        resendSignUp: jest.fn(),
    },
}));

import Auth from '@aws-amplify/auth';
import ForgotPasswordForm from '../../import/content/forgot-password.jsx';

const EMAIL = 'jeff@example.com';
const PASSWORD = 'Abcdefghi1';
const CODE = '123456';

function setup() {
    const dispatchLayout = jest.fn();
    const dispatchSpinner = jest.fn();

    const utils = render(
        <MemoryRouter initialEntries={['/forgot-password']}>
            <Routes>
                <Route
                    path='/forgot-password'
                    element={
                        <ForgotPasswordForm
                            dispatchLayout={dispatchLayout}
                            dispatchSpinner={dispatchSpinner}
                        />
                    }
                />
                <Route path='/login' element={<div>LOGIN PAGE</div>} />
            </Routes>
        </MemoryRouter>
    );

    return { ...utils, dispatchLayout, dispatchSpinner };
}

const field = (name) => document.querySelector(`[name="${name}"]`);
const submit = () => document.querySelector('[type="submit"]');
const notes = () => [...document.querySelectorAll('.invalid-pop')].map(n => n.textContent);

//
// drive the request form to success, which is the only way to reach the reset
// form. Every reset-form test starts here.
//
async function reachResetForm(utils) {
    Auth.forgotPassword.mockResolvedValue({});

    await userEvent.type(field('user[email]'), EMAIL);
    await userEvent.click(submit());

    await waitFor(() => expect(field('password[value]')).toBeTruthy());

    return utils;
}

//
// reject with a shape the component recognises: it reads 'code' and 'message' off
// the error with the 'in' operator, so a plain Error will not do.
//
function cognitoError(code, message = '') {
    return Object.assign(new Error(message), { code, message });
}

beforeEach(() => {
    jest.clearAllMocks();
    sessionStorage.clear();
});

describe('the request form, shown first', () => {
    it('renders the email field and a submit control', () => {
        setup();

        expect(field('user[email]')).toBeTruthy();
        expect(submit()).toBeTruthy();
    });

    it('does not render the reset fields yet', () => {
        setup();

        expect(field('password[value]')).toBeNull();
        expect(field('password[valueConfirm]')).toBeNull();
    });

    it('tells redux to switch to the login layout on mount', () => {
        const { dispatchLayout } = setup();

        expect(dispatchLayout).toHaveBeenCalledTimes(1);
        expect(dispatchLayout.mock.calls[0][0]).toMatchObject({ layout: 'login' });
    });

    it('reaches no network before the form is submitted', async () => {
        setup();

        await userEvent.type(field('user[email]'), EMAIL);

        expect(Auth.forgotPassword).not.toHaveBeenCalled();
    });

    it('the email field is controlled and reflects what was typed', async () => {
        setup();

        await userEvent.type(field('user[email]'), EMAIL);

        expect(field('user[email]')).toHaveValue(EMAIL);
    });
});

describe('requesting a reset code', () => {
    it('asks Cognito for a code for exactly the address typed', async () => {
        Auth.forgotPassword.mockResolvedValue({});
        setup();

        await userEvent.type(field('user[email]'), EMAIL);
        await userEvent.click(submit());

        await waitFor(() => expect(Auth.forgotPassword).toHaveBeenCalledWith(EMAIL));
    });

    it('swaps to the reset form once the code is sent', async () => {
        Auth.forgotPassword.mockResolvedValue({});
        setup();

        await userEvent.type(field('user[email]'), EMAIL);
        await userEvent.click(submit());

        await waitFor(() => expect(field('password[verification]')).toBeTruthy());
        expect(field('user[email]')).toBeNull();
    });

    it('raises the spinner and lowers it again', async () => {
        //
        // both edges matter: the flow has several early-ish branches and a spinner
        // that is raised and never lowered leaves the page stuck.
        //
        Auth.forgotPassword.mockResolvedValue({});
        const { dispatchSpinner } = setup();

        await userEvent.type(field('user[email]'), EMAIL);
        await userEvent.click(submit());

        await waitFor(() => expect(dispatchSpinner).toHaveBeenCalledTimes(2));
        expect(dispatchSpinner.mock.calls[0][0]).toMatchObject({ spinner: true });
        expect(dispatchSpinner.mock.calls[1][0]).toMatchObject({ spinner: false });
    });

    it('lowers the spinner even when the request fails', async () => {
        Auth.forgotPassword.mockRejectedValue(cognitoError('UserNotFoundException'));
        const { dispatchSpinner } = setup();

        await userEvent.type(field('user[email]'), EMAIL);
        await userEvent.click(submit());

        await waitFor(() => expect(dispatchSpinner).toHaveBeenCalledTimes(2));
        expect(dispatchSpinner.mock.calls[1][0]).toMatchObject({ spinner: false });
    });
});

describe('the request form error paths', () => {
    it('complains about an empty email before anything else', async () => {
        //
        // the empty-email check is made in the CATCH, so the request is sent first
        // and the complaint depends on Cognito rejecting it. It reads like
        // client-side validation and is not.
        //
        Auth.forgotPassword.mockRejectedValue(cognitoError('InvalidParameterException'));
        setup();

        await userEvent.click(submit());

        await waitFor(() => expect(notes().join(' ')).toContain('Email cannot be empty!'));
        expect(Auth.forgotPassword).toHaveBeenCalledWith('');
    });

    it('offers an account verification code when the address is unverified', async () => {
        //
        // the one branch that changes the form rather than only adding a note: an
        // unverified account gets a second input, and a fresh signup code is sent.
        //
        Auth.forgotPassword.mockRejectedValue(
            cognitoError('InvalidParameterException', 'Cannot reset password for a user that is not VERIFIED')
        );
        Auth.resendSignUp.mockResolvedValue({});
        setup();

        await userEvent.type(field('user[email]'), EMAIL);
        await userEvent.click(submit());

        await waitFor(() => expect(field('user[verification]')).toBeTruthy());
        expect(Auth.resendSignUp).toHaveBeenCalledWith(EMAIL);
    });

    it('still shows the verification input when resending the code fails', async () => {
        //
        // resendSignUp's rejection is logged and swallowed, so the input appears
        // whether or not a code was actually sent -- the visitor is asked for a
        // code that may never arrive.
        //
        Auth.forgotPassword.mockRejectedValue(
            cognitoError('InvalidParameterException', 'user is not VERIFIED')
        );
        Auth.resendSignUp.mockRejectedValue(new Error('rate limited'));
        const quiet = jest.spyOn(console, 'log').mockImplementation(() => {});
        setup();

        await userEvent.type(field('user[email]'), EMAIL);
        await userEvent.click(submit());

        await waitFor(() => expect(field('user[verification]')).toBeTruthy());
        expect(quiet).toHaveBeenCalled();

        quiet.mockRestore();
    });

    it('reports an already-activated account', async () => {
        Auth.forgotPassword.mockRejectedValue(
            cognitoError('NotAuthorizedException', 'User is already CONFIRMED')
        );
        setup();

        await userEvent.type(field('user[email]'), EMAIL);
        await userEvent.click(submit());

        await waitFor(() => expect(notes().join(' ')).toContain('Account already activated.'));
    });

    it('reports an unknown account', async () => {
        Auth.forgotPassword.mockRejectedValue(cognitoError('UserNotFoundException'));
        setup();

        await userEvent.type(field('user[email]'), EMAIL);
        await userEvent.click(submit());

        await waitFor(() => expect(notes().join(' ')).toContain('Account not found!'));
    });

    it('passes an unrecognised Cognito message through verbatim', async () => {
        //
        // WORTH KNOWING: the fallback shows the raw provider message to the
        // visitor, so the wording of an AWS error becomes user-facing copy.
        //
        Auth.forgotPassword.mockRejectedValue(
            cognitoError('SomeOtherException', 'Password attempts exceeded')
        );
        setup();

        await userEvent.type(field('user[email]'), EMAIL);
        await userEvent.click(submit());

        await waitFor(() => expect(notes().join(' ')).toContain('Password attempts exceeded'));
    });

    it('falls back to a generic note when the error has no code', async () => {
        Auth.forgotPassword.mockRejectedValue({});
        setup();

        await userEvent.type(field('user[email]'), EMAIL);
        await userEvent.click(submit());

        await waitFor(() => expect(notes().join(' ')).toContain('Unable to request verification code.'));
    });
});

describe('confirming the account, once a verification code is asked for', () => {
    //
    // reaching this needs two submits: the first to be told the account is
    // unverified, the second to send the code that was then requested.
    //
    async function reachAccountConfirmation() {
        Auth.forgotPassword.mockRejectedValue(
            cognitoError('InvalidParameterException', 'user is not VERIFIED')
        );
        Auth.resendSignUp.mockResolvedValue({});
        const utils = setup();

        await userEvent.type(field('user[email]'), EMAIL);
        await userEvent.click(submit());
        await waitFor(() => expect(field('user[verification]')).toBeTruthy());

        return utils;
    }

    it('confirms the signup with the email and code', async () => {
        await reachAccountConfirmation();
        Auth.confirmSignUp.mockResolvedValue({});

        await userEvent.type(field('user[verification]'), CODE);
        await userEvent.click(submit());

        await waitFor(() => expect(Auth.confirmSignUp).toHaveBeenCalledWith(EMAIL, CODE));
    });

    it('reports an empty code', async () => {
        await reachAccountConfirmation();
        Auth.confirmSignUp.mockRejectedValue(new Error('no code'));

        await userEvent.click(submit());

        await waitFor(() =>
            expect(notes().join(' ')).toContain('Verification code cannot be empty!')
        );
    });

    it('reports a generic failure when both fields are filled', async () => {
        await reachAccountConfirmation();
        Auth.confirmSignUp.mockRejectedValue(new Error('mismatch'));

        await userEvent.type(field('user[verification]'), CODE);
        await userEvent.click(submit());

        await waitFor(() =>
            expect(notes().join(' ')).toContain('Unable to request verification code.')
        );
    });

    it('asks for a password reset code in the SAME submit that confirms the account', async () => {
        //
        // DOCUMENTS THE CONTROL FLOW, which is easy to misread. The confirmSignUp
        // block is not an early return: after it runs, execution falls straight into
        // the forgotPassword call below. So one click both confirms the account and
        // requests a reset code, and a failure of the first does not stop the second.
        //
        await reachAccountConfirmation();
        Auth.confirmSignUp.mockResolvedValue({});
        Auth.forgotPassword.mockClear();

        await userEvent.type(field('user[verification]'), CODE);
        await userEvent.click(submit());

        await waitFor(() => expect(Auth.confirmSignUp).toHaveBeenCalled());
        expect(Auth.forgotPassword).toHaveBeenCalledWith(EMAIL);
    });
});

describe('the reset form', () => {
    it('renders the code and both password fields', async () => {
        await reachResetForm(setup());

        expect(field('password[verification]')).toBeTruthy();
        expect(field('password[value]')).toBeTruthy();
        expect(field('password[valueConfirm]')).toBeTruthy();
    });

    it('masks both password fields', async () => {
        await reachResetForm(setup());

        expect(field('password[value]')).toHaveAttribute('type', 'password');
        expect(field('password[valueConfirm]')).toHaveAttribute('type', 'password');
    });

    it('all three fields are controlled', async () => {
        await reachResetForm(setup());

        await userEvent.type(field('password[verification]'), CODE);
        await userEvent.type(field('password[value]'), PASSWORD);
        await userEvent.type(field('password[valueConfirm]'), PASSWORD);

        expect(field('password[verification]')).toHaveValue(CODE);
        expect(field('password[value]')).toHaveValue(PASSWORD);
        expect(field('password[valueConfirm]')).toHaveValue(PASSWORD);
    });

    it('submits the email, code and new password together', async () => {
        await reachResetForm(setup());
        Auth.forgotPasswordSubmit.mockResolvedValue({});

        await userEvent.type(field('password[verification]'), CODE);
        await userEvent.type(field('password[value]'), PASSWORD);
        await userEvent.type(field('password[valueConfirm]'), PASSWORD);
        await userEvent.click(submit());

        await waitFor(() =>
            expect(Auth.forgotPasswordSubmit).toHaveBeenCalledWith(EMAIL, CODE, PASSWORD)
        );
    });

    it('redirects to the login page once the reset succeeds', async () => {
        //
        // the redirect is gated on SIX pieces of state at once, so it is the single
        // assertion that the whole flow -- code, both passwords, match, server
        // request and server submit -- actually lined up.
        //
        await reachResetForm(setup());
        Auth.forgotPasswordSubmit.mockResolvedValue({});

        await userEvent.type(field('password[verification]'), CODE);
        await userEvent.type(field('password[value]'), PASSWORD);
        await userEvent.type(field('password[valueConfirm]'), PASSWORD);
        await userEvent.click(submit());

        await waitFor(() => expect(document.body.textContent).toContain('LOGIN PAGE'));
    });

    it('does NOT redirect when the passwords differ', async () => {
        await reachResetForm(setup());
        Auth.forgotPasswordSubmit.mockResolvedValue({});

        await userEvent.type(field('password[verification]'), CODE);
        await userEvent.type(field('password[value]'), PASSWORD);
        await userEvent.type(field('password[valueConfirm]'), 'Different1');
        await userEvent.click(submit());

        await waitFor(() => expect(notes().join(' ')).toContain('Passwords do not match.'));
        expect(document.body.textContent).not.toContain('LOGIN PAGE');
    });

    it('reports empty passwords', async () => {
        await reachResetForm(setup());
        Auth.forgotPasswordSubmit.mockResolvedValue({});

        await userEvent.type(field('password[verification]'), CODE);
        await userEvent.click(submit());

        await waitFor(() => expect(notes().join(' ')).toContain('Passwords cannot be empty.'));
    });

    it.each([
        ['ExpiredCodeException', 'please request a'],
        ['CodeMismatchException', 'Invalid verification code provided.'],
        ['LimitExceededException', 'Attempt limit exceeded'],
    ])('reports %s', async (code, expected) => {
        await reachResetForm(setup());
        Auth.forgotPasswordSubmit.mockRejectedValue(cognitoError(code));

        await userEvent.type(field('password[verification]'), CODE);
        await userEvent.type(field('password[value]'), PASSWORD);
        await userEvent.type(field('password[valueConfirm]'), PASSWORD);
        await userEvent.click(submit());

        await waitFor(() => expect(notes().join(' ')).toContain(expected));
    });

    it('offers a fresh code from the expired-code note', async () => {
        //
        // the note carries a clickable '(new code)' wired to the REQUEST handler, so
        // a visitor can recover without going back a step.
        //
        await reachResetForm(setup());
        Auth.forgotPasswordSubmit.mockRejectedValue(cognitoError('ExpiredCodeException'));

        await userEvent.type(field('password[verification]'), CODE);
        await userEvent.type(field('password[value]'), PASSWORD);
        await userEvent.type(field('password[valueConfirm]'), PASSWORD);
        await userEvent.click(submit());

        await waitFor(() => expect(document.querySelector('.link')).toBeTruthy());
        Auth.forgotPassword.mockClear();

        await userEvent.click(document.querySelector('.link'));

        await waitFor(() => expect(Auth.forgotPassword).toHaveBeenCalledWith(EMAIL));
    });
});

describe('the fixed defects', () => {
    it('warns "Verification code empty." only while the code IS empty', async () => {
        //
        // FIXED, in forgot-password.jsx. The condition was inverted:
        //
        //     if (this.state.value_verification) {
        //         clientNote = <div className='invalid-pop'>Verification code empty.</div>
        //     }
        //
        // so filling the field correctly produced an error saying it was empty, and
        // leaving it blank produced no warning at all -- wrong in both directions.
        //
        await reachResetForm(setup());

        expect(notes().join(' ')).toContain('Verification code empty.');

        await userEvent.type(field('password[verification]'), CODE);

        expect(notes().join(' ')).not.toContain('Verification code empty.');
    });

    it('validates the passwords BEFORE reaching Cognito', async () => {
        //
        // FIXED, in forgot-password.jsx. handleResetSubmit awaited forgotPasswordSubmit
        // first and only then checked whether the passwords were present and matching,
        // so a mismatch was sent to the provider on every attempt: the visitor saw
        // 'Passwords do not match.' only after the round trip, and each failed attempt
        // counted against the reset code's retry limit -- enough of them and a
        // correctable typo became LimitExceededException.
        //
        await reachResetForm(setup());
        Auth.forgotPasswordSubmit.mockResolvedValue({});

        await userEvent.type(field('password[verification]'), CODE);
        await userEvent.type(field('password[value]'), PASSWORD);
        await userEvent.type(field('password[valueConfirm]'), 'Different1');
        await userEvent.click(submit());

        await waitFor(() => expect(notes().join(' ')).toContain('Passwords do not match.'));
        expect(Auth.forgotPasswordSubmit).not.toHaveBeenCalled();
    });

    it('does not reach Cognito with an empty password either', async () => {
        await reachResetForm(setup());
        Auth.forgotPasswordSubmit.mockResolvedValue({});

        await userEvent.type(field('password[verification]'), CODE);
        await userEvent.click(submit());

        await waitFor(() => expect(notes().join(' ')).toContain('Passwords cannot be empty.'));
        expect(Auth.forgotPasswordSubmit).not.toHaveBeenCalled();
    });

    it('clears a stale password complaint once the form is corrected', async () => {
        //
        // the early return sets the note, so the success path has to clear it or a
        // corrected form still shows the old error beside it.
        //
        await reachResetForm(setup());
        Auth.forgotPasswordSubmit.mockResolvedValue({});

        await userEvent.type(field('password[verification]'), CODE);
        await userEvent.click(submit());
        await waitFor(() => expect(notes().join(' ')).toContain('Passwords cannot be empty.'));

        await userEvent.type(field('password[value]'), PASSWORD);
        await userEvent.type(field('password[valueConfirm]'), PASSWORD);
        await userEvent.click(submit());

        await waitFor(() => expect(Auth.forgotPasswordSubmit).toHaveBeenCalled());
        expect(notes().join(' ')).not.toContain('Passwords cannot be empty.');
    });

    it('renders a placeholder rather than an unreachable spinner', async () => {
        //
        // FIXED, in forgot-password.jsx. getSpinner() returned the real Spinner only
        // when this.state.display_spinner was truthy, and that key was absent from the
        // constructor and never written by any handler -- so the branch was unreachable
        // and the imported Spinner could never appear. The dead branch and the import
        // are gone; dispatchSpinner still drives the layout's own spinner, which is the
        // one a visitor actually sees.
        //
        const held = React.createRef();
        render(
            <MemoryRouter>
                <ForgotPasswordForm
                    ref={held}
                    dispatchLayout={jest.fn()}
                    dispatchSpinner={jest.fn()}
                />
            </MemoryRouter>
        );

        expect(held.current.getSpinner()).toBe('span');
        expect(document.querySelector('.spinner')).toBeNull();
    });
});
