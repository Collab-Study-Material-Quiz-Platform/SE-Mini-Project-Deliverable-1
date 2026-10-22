// Home.jsx — Hero section, feature cards, live status badge
import { useState, useEffect } from 'react';
import './Home.css';

const CARDS = [
  {
    icon: '📚',
    title: 'Study Material',
    features: [
      'Upload & share notes and PDFs',
      'Search by subject or keyword',
      'Download materials',
      'Rate & review resources',
    ],
  },
  {
    icon: '❓',
    title: 'Question Bank & Quizzes',
    features: [
      'Create custom question sets',
      'Attempt quizzes with a timer',
      'Auto-graded answers',
      'Multiple-choice questions (4 options)',
    ],
  },
  {
    icon: '📊',
    title: 'Performance Analysis',
    features: [
      'Personal score history',
      'Quiz statistics for teachers',
      'Topic-wise scores',
      'Identify weak topics',
    ],
  },
];

export default function Home() {
  const [statusOk, setStatusOk] = useState(null); // null=loading, true=up, false=down

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 5000);
        const res = await fetch('/health', { signal: controller.signal });
        clearTimeout(timer);
        if (!cancelled) setStatusOk(res.ok);
      } catch {
        if (!cancelled) setStatusOk(false);
      }
    };
    check();
    return () => {
      cancelled = true;
    };
  }, []);

  const dotClass =
    statusOk === false ? 'home-status-dot down' : 'home-status-dot';
  const statusText =
    statusOk === null
      ? 'Checking status…'
      : statusOk
      ? 'All systems operational'
      : 'Service unavailable';

  return (
    <section className="home">
      <div className="home-hero">
        <h1>Collaborative Study Material &amp; Quiz Platform</h1>
        <p>
          A shared space for students to upload study material, take timed
          quizzes, and track performance together.
        </p>
        <a
          href="#/status"
          className="home-status-badge"
          aria-label={`System status: ${statusText}`}
        >
          <span className={dotClass} aria-hidden="true"></span>
          {statusText}
        </a>
      </div>
      <div className="home-cards">
        {CARDS.map((card) => (
          <article className="home-card" key={card.title}>
            <div className="home-card-icon" aria-hidden="true">
              {card.icon}
            </div>
            <h3>{card.title}</h3>
            <ul>
              {card.features.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}
