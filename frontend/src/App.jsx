import { useEffect, useState } from 'react'
import './App.css'
import Layout from './components/Layout'
import Home from './components/Home'
import StatusPage from './components/StatusPage'
import RegistrationPage from './RegistrationPage'
import LoginPage from './LoginPage'
import UploadMaterialPage from './components/UploadMaterialPage'
import MaterialsPage from './components/MaterialsPage'
import QuestionBankPage from './components/QuestionBankPage'
import QuizzesPage from './components/QuizzesPage'

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
  const protectedRoute = ['#/materials', '#/questions', '#/quizzes', '#/performance', '#/admin'].some((route) => hash.startsWith(route))
  if (protectedRoute && !localStorage.getItem('authToken')) page = <LoginPage />
  else if (hash === '#/login') page = <LoginPage />
  else if (hash === '#/status') page = <StatusPage />
  else if (hash === '#/register') page = <RegistrationPage />
  else if (hash === '#/materials/upload') page = <UploadMaterialPage />
  else if (hash === '#/materials') page = <MaterialsPage />
  else if (hash === '#/questions') page = <QuestionBankPage />
  else if (hash === '#/quizzes' || hash.startsWith('#/quizzes/')) page = <QuizzesPage currentHash={hash} />
  else page = <Home />

  return <Layout currentHash={hash}>{page}</Layout>
}
