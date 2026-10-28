import { screen } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { mockFetch, renderWithProviders } from '../test/utils';
import { ProtectedRoute } from './ProtectedRoute';

function renderApp() {
  return renderWithProviders(
    <Routes>
      <Route path="/login" element={<p>Login screen</p>} />
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<p>Secret dashboard</p>} />
      </Route>
    </Routes>,
  );
}

describe('ProtectedRoute', () => {
  it('redirects to /login when there is no session', () => {
    renderApp();
    expect(screen.getByText('Login screen')).toBeInTheDocument();
  });

  it('restores the session from a stored token', async () => {
    localStorage.setItem('taskflow.token', 'stored-token');
    mockFetch({
      'GET /api/v1/users/me': [
        200,
        { user: { id: 'u1', name: 'Ada', email: 'a@example.com', role: 'ADMIN' } },
      ],
    });
    renderApp();
    expect(await screen.findByText('Secret dashboard')).toBeInTheDocument();
  });

  it('clears an expired token and redirects to /login', async () => {
    localStorage.setItem('taskflow.token', 'expired-token');
    mockFetch({
      'GET /api/v1/users/me': [
        401,
        { error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' } },
      ],
    });
    renderApp();
    expect(await screen.findByText('Login screen')).toBeInTheDocument();
    expect(localStorage.getItem('taskflow.token')).toBeNull();
  });
});
