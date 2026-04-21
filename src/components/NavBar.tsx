'use client';

import { useState, useEffect } from 'react';

const NAV_LINKS = [
  { label: 'Caso', href: '#caso' },
  { label: 'Problema', href: '#problema' },
  { label: 'Solución', href: '#solucion' },
  { label: 'Equipo', href: '#equipo' },
  { label: 'FAQ', href: '#faq' },
];

export default function NavBar() {
  const [visible, setVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentY = window.scrollY;
      setVisible(currentY < lastScrollY || currentY < 80);
      setLastScrollY(currentY);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollY]);

  const handleAnchorClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();
    const id = href.replace('#', '');
    const el = document.getElementById(id);
    if (el) {
      const offset = 100; // banner + navbar height
      const y = el.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  };

  return (
    <nav
      className={`fixed top-0 z-50 w-full bg-white/80 backdrop-blur-md border-b border-gray-100 transition-transform duration-300 ${
        visible ? 'translate-y-0' : '-translate-y-full'
      }`}
    >
      <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-center">
        <div className="hidden md:flex items-center gap-8">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={(e) => handleAnchorClick(e, link.href)}
              className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
            >
              {link.label}
            </a>
          ))}
        </div>

        <a href="#" className="md:hidden text-lg font-bold text-gray-900">
          Programa PHA
        </a>
      </div>
    </nav>
  );
}
