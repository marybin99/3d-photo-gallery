import React, { lazy, Suspense, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import GalleryPage from './pages/GalleryPage';
import './shared/styles/global.css';

const AdminPage = lazy(() => import('./pages/AdminPage'));

function App() {
  const [admin, setAdmin] = useState(() =>
    window.location.hash.startsWith('#/admin'),
  );
  useEffect(() => {
    const navigate = () => setAdmin(window.location.hash.startsWith('#/admin'));
    window.addEventListener('hashchange', navigate);
    return () => window.removeEventListener('hashchange', navigate);
  }, []);
  return admin ? (
    <Suspense fallback={<p role="status">관리자 화면을 여는 중…</p>}>
      <AdminPage />
    </Suspense>
  ) : (
    <GalleryPage />
  );
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
