import { useState, useEffect } from 'react';
import './App.css';
import Layout from './components/Layout';
import Home from './components/Home';
import StatusPage from './components/StatusPage';

function getHash() {
  const h = window.location.hash;
  return !h || h === '#' || h === '#/' ? '#/' : h;
}

export default function App() {
  const [hash, setHash] = useState(getHash);

  useEffect(() => {
    const onHash = () => setHash(getHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  return (
    <Layout currentHash={hash}>
      {hash === '#/status' ? <StatusPage /> : <Home />}
    </Layout>
  );
}
