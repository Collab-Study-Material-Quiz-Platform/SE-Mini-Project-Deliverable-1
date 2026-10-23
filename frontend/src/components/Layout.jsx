// Layout.jsx — App shell: sticky header, main content area, footer
import './Layout.css';

const NAV_LINKS = [
  { href: '#/', label: 'Home' },
  { href: '#/status', label: 'System Status' },
];

export default function Layout({ children, currentHash }) {
  // Normalize: treat "", "#", "#/" all as "#/"
  const activeHash =
    !currentHash || currentHash === '#' || currentHash === '#/'
      ? '#/'
      : currentHash;

  return (
    <div className="layout">
      <header className="layout-header">
        <a href="#/" className="layout-logo" aria-label="Go to home page">
          {/* Inline SVG: open book icon */}
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
          </svg>
          <span className="layout-logo-name">
            <span className="logo-name-short">Study &amp; Quiz Platform</span>
            <span className="logo-name-full">Collaborative Study Material &amp; Quiz Platform</span>
          </span>
        </a>
        <nav className="layout-nav" aria-label="Main navigation">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className={activeHash === link.href ? 'active' : ''}
              aria-current={activeHash === link.href ? 'page' : undefined}
            >
              {link.label}
            </a>
          ))}
        </nav>
      </header>
      <main className="layout-main">{children}</main>
      <footer className="layout-footer">SE Mini-Project, Sprint 1</footer>
    </div>
  );
}
