/**
 * login.test.jsx: the sign-in form.
 *
 * Rewritten from an enzyme suite that could not run. It imported from
 * '../../../../src/jsx/import/content/login.jsx' -- a 'src/' tree that no longer
 * exists -- and configured '@wojtekmaj/enzyme-adapter-react-17' against React 18,
 * for which enzyme has no adapter at all.
 *
 * Its assertions were also vacuous rather than merely misdirected:
 *
 *     expect(wrapper.find('[name="user[login]"]').length).toHaveLength(1)
 *
 * calls toHaveLength on a NUMBER, which cannot pass, and
 *
 *     expect(wrapper.contains(<form ref='loginForm' />)).toBeTruthy()
 *
 * matched a string ref that the component does not use. So the intent is
 * preserved here -- the fields and the submit control exist -- but the
 * assertions are made real, and behaviour is covered rather than only shape.
 *
 * Note: '@aws-amplify/auth' is mocked. It is the network boundary; the point of
 *       these tests is what the component does with what Auth returns.
 *
 * Note: the component renders react-router's Link, so it has to be wrapped in a
 *       router or rendering throws.
 */

import React from 'react';
import { render, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

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

function setup(props = {}) {
    const dispatchLayout = jest.fn();
    const dispatchLogin = jest.fn();
    const dispatchSpinner = jest.fn();

    const utils = render(
        <MemoryRouter>
            <LoginForm
                dispatchLayout={dispatchLayout}
                dispatchLogin={dispatchLogin}
                dispatchSpinner={dispatchSpinner}
                {...props}
            />
        </MemoryRouter>
    );

    return { ...utils, dispatchLayout, dispatchLogin, dispatchSpinner };
}

function fields() {
    return {
        login: document.querySelector('[name="user[login]"]'),
        password: document.querySelector('[name="user[password]"]'),
        submit: document.querySelector('[type="submit"]'),
    };
}

beforeEach(() => {
    jest.clearAllMocks();
    sessionStorage.clear();
});

describe('rendering', () => {
    it('renders the login field', () => {
        setup();

        expect(fields().login).toBeInTheDocument();
    });

    it('renders the password field, masked', () => {
        setup();

        const password = fields().password;
        expect(password).toBeInTheDocument();
        expect(password).toHaveAttribute('type', 'password');
    });

    it('renders a submit control', () => {
        setup();

        expect(fields().submit).toBeInTheDocument();
    });

    it('renders links to the password reset and registration flows', () => {
        //
        // queried by href rather than by role alone: the form carries more than
        // one link, so getByRole('link') is ambiguous and throws.
        //
        setup();

        expect(document.querySelector('a[href="/login/reset"]')).toBeInTheDocument();
        expect(document.querySelector('a[href="/register"]')).toBeInTheDocument();
    });
});

describe('typing', () => {
    it('the login field is controlled and reflects what was typed', async () => {
        setup();

        await userEvent.type(fields().login, USERNAME);

        expect(fields().login).toHaveValue(USERNAME);
    });

    it('the password field is controlled and reflects what was typed', async () => {
        setup();

        await userEvent.type(fields().password, PASSWORD);

        expect(fields().password).toHaveValue(PASSWORD);
    });
});

describe('submitting', () => {
    it('signs in with exactly what was typed', async () => {
        Auth.signIn.mockResolvedValue({ username: USERNAME });
        setup();

        await userEvent.type(fields().login, USERNAME);
        await userEvent.type(fields().password, PASSWORD);
        await userEvent.click(fields().submit);

        await waitFor(() => expect(Auth.signIn).toHaveBeenCalledWith(USERNAME, PASSWORD));
    });

    it('does not reach the network before the form is submitted', async () => {
        setup();

        await userEvent.type(fields().login, USERNAME);
        await userEvent.type(fields().password, PASSWORD);

        expect(Auth.signIn).not.toHaveBeenCalled();
    });

    it('records the signed-in username in session storage', async () => {
        Auth.signIn.mockResolvedValue({ username: USERNAME });
        setup();

        await userEvent.type(fields().login, USERNAME);
        await userEvent.type(fields().password, PASSWORD);
        await userEvent.click(fields().submit);

        await waitFor(() => expect(sessionStorage.getItem('username')).toBe(USERNAME));
    });

    it('tells redux who logged in', async () => {
        Auth.signIn.mockResolvedValue({ username: USERNAME });
        const { dispatchLogin } = setup();

        await userEvent.type(fields().login, USERNAME);
        await userEvent.type(fields().password, PASSWORD);
        await userEvent.click(fields().submit);

        await waitFor(() => expect(dispatchLogin).toHaveBeenCalled());
    });

    it('a rejected sign-in leaves session storage untouched', async () => {
        //
        // the failure path matters more than the success one: a component that
        // recorded the username regardless would leave the app believing a
        // failed login had succeeded.
        //
        Auth.signIn.mockRejectedValue(new Error('NotAuthorizedException'));
        setup();

        await userEvent.type(fields().login, USERNAME);
        await userEvent.type(fields().password, 'wrong-password');
        await userEvent.click(fields().submit);

        await waitFor(() => expect(Auth.signIn).toHaveBeenCalled());
        expect(sessionStorage.getItem('username')).toBeNull();
    });

    it('a rejected sign-in does not tell redux anyone logged in', async () => {
        Auth.signIn.mockRejectedValue(new Error('NotAuthorizedException'));
        const { dispatchLogin } = setup();

        await userEvent.type(fields().login, USERNAME);
        await userEvent.type(fields().password, 'wrong-password');
        await userEvent.click(fields().submit);

        await waitFor(() => expect(Auth.signIn).toHaveBeenCalled());
        expect(dispatchLogin).not.toHaveBeenCalled();
    });
});
