/**
 * webform.test.jsx: the registration form.
 *
 * Replaces __tests__/content/register.test.jsx, which could not be repaired:
 * it imported '../../../../src/jsx/import/content/register.jsx', and there is no
 * 'content/register.jsx' in this codebase at all any more -- registration moved
 * to layout/register/, so the old file named a component that no longer exists
 * rather than merely a stale path.
 *
 * What is covered is the part with consequences: the form validates before it
 * signs anybody up. The three validators it calls (valid-string, valid-email,
 * valid-password) are unit tested separately; what matters here is that the form
 * actually consults them and refuses to call Auth when they say no.
 *
 * Note: that gate is new. These tests previously recorded its ABSENCE -- see the
 *       comment above 'submission is gated on client-side validation' for what
 *       changed and why the check reads the values rather than the flags.
 *
 * Note: '@aws-amplify/auth' is mocked -- it is the network boundary.
 *
 * Note: the component renders react-router's Navigate, so it needs a router.
 */

import React from 'react';
import { render, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

jest.mock('@aws-amplify/auth', () => ({
    __esModule: true,
    default: {
        signUp: jest.fn(),
        signIn: jest.fn(),
        currentAuthenticatedUser: jest.fn(),
        setPreferredMFA: jest.fn(),
    },
}));

import Auth from '@aws-amplify/auth';
import RegisterForm from '../../../import/layout/register/content/webform.jsx';

const NAME = 'jeff';
const EMAIL = 'jeff@example.com';
const PASSWORD = 'Abcdefghi1';

function setup() {
    const dispatchLayout = jest.fn();
    const dispatchSpinner = jest.fn();

    const utils = render(
        <MemoryRouter>
            <RegisterForm
                dispatchLayout={dispatchLayout}
                dispatchSpinner={dispatchSpinner}
            />
        </MemoryRouter>
    );

    return { ...utils, dispatchLayout, dispatchSpinner };
}

function fields() {
    return {
        name: document.querySelector('[name="user[name]"]'),
        email: document.querySelector('[name="user[email]"]'),
        password: document.querySelector('[name="user[password]"]'),
        submit: document.querySelector('[type="submit"]'),
    };
}

async function fill({ name = NAME, email = EMAIL, password = PASSWORD } = {}) {
    const f = fields();
    if (name) await userEvent.type(f.name, name);
    if (email) await userEvent.type(f.email, email);
    if (password) await userEvent.type(f.password, password);
}

beforeEach(() => {
    jest.clearAllMocks();
});

describe('rendering', () => {
    it('renders the name field', () => {
        setup();

        expect(fields().name).toBeInTheDocument();
    });

    it('renders the email field', () => {
        setup();

        expect(fields().email).toBeInTheDocument();
    });

    it('renders the password field, masked', () => {
        setup();

        expect(fields().password).toBeInTheDocument();
        expect(fields().password).toHaveAttribute('type', 'password');
    });

    it('renders a submit control', () => {
        setup();

        expect(fields().submit).toBeInTheDocument();
    });
});

describe('typing', () => {
    it('every field is controlled and reflects what was typed', async () => {
        setup();

        await fill();

        expect(fields().name).toHaveValue(NAME);
        expect(fields().email).toHaveValue(EMAIL);
        expect(fields().password).toHaveValue(PASSWORD);
    });
});

describe('validation', () => {
    it('a complete, valid form reaches Auth.signUp', async () => {
        Auth.signUp.mockResolvedValue({ user: { username: NAME } });
        setup();

        await fill();
        await userEvent.click(fields().submit);

        await waitFor(() => expect(Auth.signUp).toHaveBeenCalled());
    });

    it('passes the typed values through to signUp', async () => {
        Auth.signUp.mockResolvedValue({ user: { username: NAME } });
        setup();

        await fill();
        await userEvent.click(fields().submit);

        await waitFor(() => expect(Auth.signUp).toHaveBeenCalled());
        const payload = JSON.stringify(Auth.signUp.mock.calls[0][0]);
        expect(payload).toContain(NAME);
        expect(payload).toContain(EMAIL);
    });

    //
    // Note: the 'invalid' class lands on the field's LABEL rather than on the
    //       input, so these query '.form-label.invalid' rather than the control.
    //
    it('marks a malformed email invalid as it is typed', async () => {
        //
        // the validators DO run, on change, and drive the field styling. This is
        // the part that works, and it is what the tests below contrast against.
        //
        setup();

        expect(document.querySelectorAll('.form-label.invalid')).toHaveLength(0);

        await userEvent.type(fields().email, 'not-an-email');

        expect(document.querySelectorAll('.form-label.invalid').length).toBeGreaterThan(0);
    });

    it('marks a password below the policy invalid as it is typed', async () => {
        setup();

        await userEvent.type(fields().password, 'short1A');

        expect(document.querySelectorAll('.form-label.invalid').length).toBeGreaterThan(0);
    });

    it('a compliant password and valid email leave nothing marked invalid', async () => {
        setup();

        await fill();

        expect(document.querySelectorAll('.form-label.invalid')).toHaveLength(0);
    });

    //
    // These four cases used to document a defect: the three validators were
    // consulted only by the onInput handlers, purely to drive the 'invalid' css
    // class and the inline notes. handleSubmit read none of them and went
    // straight to Auth.signUp, so the field turned red and the form submitted
    // anyway -- the password policy was enforced by Cognito alone, and every
    // rejected attempt cost a network round trip.
    //
    // handleSubmit now calls validate() first and returns early when it fails,
    // so they assert the opposite. validate() re-checks the VALUES rather than
    // the 'validated_*' flags, because those flags start true and are only
    // written on input -- an untouched form would otherwise sail through.
    //
    describe('submission is gated on client-side validation', () => {
        it('an empty form never reaches Auth', async () => {
            setup();

            await userEvent.click(fields().submit);

            expect(Auth.signUp).not.toHaveBeenCalled();
        });

        it('an empty form is marked invalid rather than silently ignored', async () => {
            //
            // rejecting the submission is only half of it -- the visitor has to
            // be told which fields are the problem. An untouched form starts
            // with nothing marked, so this also proves validate() writes the
            // flags rather than only returning false.
            //
            setup();

            expect(document.querySelectorAll('.form-label.invalid')).toHaveLength(0);

            await userEvent.click(fields().submit);

            expect(document.querySelectorAll('.form-label.invalid').length).toBeGreaterThan(0);
        });

        it('a malformed email never reaches Auth', async () => {
            setup();

            await fill({ email: 'not-an-email' });
            await userEvent.click(fields().submit);

            expect(Auth.signUp).not.toHaveBeenCalled();
        });

        it('a password below the policy never reaches Auth', async () => {
            setup();

            await fill({ password: 'short1A' });
            await userEvent.click(fields().submit);

            expect(Auth.signUp).not.toHaveBeenCalled();
        });

        it('a missing name never reaches Auth', async () => {
            setup();

            await fill({ name: '' });
            await userEvent.click(fields().submit);

            expect(Auth.signUp).not.toHaveBeenCalled();
        });

        it('never raises the spinner for a submission it refuses', async () => {
            //
            // the gate sits ABOVE the dispatchSpinner call, so a rejected form
            // does not flash a loading state for a request that was never made.
            //
            const { dispatchSpinner } = setup();

            await userEvent.click(fields().submit);

            expect(dispatchSpinner).not.toHaveBeenCalled();
        });

        it('accepts a signup with no email at all, which stays optional', async () => {
            //
            // handleSubmit spreads the email attribute in only when it is
            // truthy, so a blank email is a supported signup rather than an
            // invalid one -- validate() has to agree, or the gate would forbid
            // what the request already handles.
            //
            Auth.signUp.mockResolvedValue({ user: { username: NAME } });
            setup();

            await fill({ email: '' });
            await userEvent.click(fields().submit);

            await waitFor(() => expect(Auth.signUp).toHaveBeenCalled());
            expect(Auth.signUp.mock.calls[0][0].attributes).toEqual({});
        });

        it('lets the form be corrected and submitted after a refusal', async () => {
            //
            // the gate must not latch: a rejected attempt leaves the form usable,
            // and fixing the offending field allows the next submission through.
            //
            Auth.signUp.mockResolvedValue({ user: { username: NAME } });
            setup();

            await fill({ password: 'short1A' });
            await userEvent.click(fields().submit);
            expect(Auth.signUp).not.toHaveBeenCalled();

            await userEvent.clear(fields().password);
            await userEvent.type(fields().password, PASSWORD);
            await userEvent.click(fields().submit);

            await waitFor(() => expect(Auth.signUp).toHaveBeenCalled());
            expect(Auth.signUp.mock.calls[0][0].password).toBe(PASSWORD);
        });
    });
});

describe('failure handling', () => {
    it('a rejected signUp does not take down the form', async () => {
        //
        // an existing username is an ordinary outcome, not a crash: the form has
        // to stay mounted and usable so the visitor can pick another.
        //
        Auth.signUp.mockRejectedValue(new Error('UsernameExistsException'));
        setup();

        await fill();
        await userEvent.click(fields().submit);

        await waitFor(() => expect(Auth.signUp).toHaveBeenCalled());
        expect(fields().name).toBeInTheDocument();
        expect(fields().submit).toBeInTheDocument();
    });
});
