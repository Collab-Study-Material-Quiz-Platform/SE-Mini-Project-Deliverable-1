import { useEffect, useState } from 'react'
import './App.css'
import Layout from './components/Layout'
import Home from './components/Home'
import StatusPage from './components/StatusPage'
import RegistrationPage from './RegistrationPage'

function getHash() {
  const h = window.location.hash
  return !h || h === '#' || h === '#/' ? '#/' : h
}

export default function App() {
  const [hash, setHash] = useState(getHash)

  useEffect(() => {
    const onHash = () => setHash(getHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  let page
  if (hash === '#/status') page = <StatusPage />
  else if (hash === '#/register') page = <RegistrationPage />
  else page = <Home />

  return <Layout currentHash={hash}>{page}</Layout>
}
