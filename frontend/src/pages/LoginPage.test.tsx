import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { mockFetch, renderWithProviders } from '../test/utils';
import { LoginPage } from './LoginPage';

const user = {
  id: 'u1',
  name: 'Mia Member',
  email: 'mia@example.com',
  role: 'MEMBER',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function renderLogin() {
  return renderWithProviders(
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<p>Dashboard home</p>} />
    </Routes>,
    { route: '/login' },
  );
}

describe('LoginPage', () => {
  it('signs in, stores the token and navigates to the dashboard', async () => {
    const fetchMock = mockFetch({
      'POST /api/v1/auth/login': [200, { user, accessToken: 'jwt-token' }],
    });
    renderLogin();

    await userEvent.type(screen.getByLabelText(/email/i), 'mia@example.com');
    await userEvent.type(screen.getByLabelText(/password/i), 'Password123');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByText('Dashboard home')).toBeInTheDocument();
    expect(localStorage.getItem('taskflow.token')).toBe('jwt-token');

    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(String(init?.body))).toEqual({
      email: 'mia@example.com',
      password: 'Password123',
    });
  });

  it('shows the API error message when credentials are wrong', async () => {
    mockFetch({
      'POST /api/v1/auth/login': [
        401,
        {
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Invalid email or password',
            requestId: 'req-1',
          },
        },
      ],
    });
    renderLogin();

    await userEvent.type(screen.getByLabelText(/email/i), 'mia@example.com');
    await userEvent.type(screen.getByLabelText(/password/i), 'wrong-password1');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password');
    expect(screen.getByRole('alert')).toHaveTextContent('req-1');
    expect(localStorage.getItem('taskflow.token')).toBeNull();
  });
});
