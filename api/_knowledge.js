/* nourhan-portfolio · api/_knowledge.js
 * ============================================================
 * The single source of truth the AI Recruiter is allowed to answer from.
 *
 * RULES FOR EDITING THIS FILE
 *   · Everything here must be verifiable against Nourhan's CV
 *     (assets/docs/Nourhan_Ashraf_CV.pdf) or the Supabase content
 *     rows that drive the public site. If a fact is not in one of
 *     those places, it does not belong here.
 *   · No invented metrics, employers, dates, clients or links.
 *     The README content rules apply to this file too.
 *   · When a fact changes, change it here AND in the CV — a
 *     recruiter-facing bot that contradicts the CV is worse than
 *     no bot at all.
 *
 * The knowledge string is assembled once at module scope and reused
 * as the model's grounding context (see api/_prompt.js).
 * ============================================================ */

'use strict';

const PROFILE = {
  name: 'Nourhan Ashraf',
  title: 'Front-End Developer',
  location: 'Egypt',
  email: 'nourhanagag392003@gmail.com',
  phone: '+20 101 140 5879',
  links: {
    linkedin: 'https://linkedin.com/in/nourhan-ashraf',
    github: 'https://github.com/Nourhan392003',
  },
  summary:
    'Front-End Developer with practical experience designing and delivering ' +
    'responsive, accessible and scalable e-commerce platforms, SaaS web ' +
    'applications and interactive digital portfolios. Strong in Next.js App ' +
    'Router, TypeScript, React.js, Tailwind CSS, the Convex backend and ' +
    'Supabase CMS integrations.',
};

const SKILLS = {
  frontend: [
    'React.js', 'Next.js (App Router)', 'TypeScript', 'JavaScript (ES6+)',
    'HTML5', 'CSS3', 'Tailwind CSS', 'Shadcn UI', 'Sass / SCSS',
    'GSAP', 'Framer Motion', 'Responsive Design',
  ],
  backend: [
    'Convex', 'Supabase (PostgreSQL, Auth, RLS Policies, Storage)',
    'Node.js', 'REST APIs', 'Clerk Auth',
  ],
  ecommerce: [
    'Paymob Intention API', 'Webhook HMAC Verification',
    'Cart & Checkout Systems', 'Real-time Stock Filtering', 'i18n Localization',
  ],
  security: [
    'Content Security Policy (CSP)', 'Honeypot & Time-Trap Anti-Spam',
    'Gzip / Brotli Compression', 'ETag Caching', 'OWASP Standards',
  ],
  ai: [
    'Cursor', 'Claude', 'ChatGPT', 'Codex', 'AI-Assisted Coding',
    'Prompt Engineering', 'Automated Auditing', 'Debugging & Refactoring',
  ],
  tools: [
    'Git / GitHub', 'Vercel', 'Postman', 'Figma', 'Agile / Scrum (Jira, Trello)',
  ],
  soft: [
    'Problem Solving', 'Analytical Debugging', 'Clear Technical Communication',
    'Attention to Detail', 'Time Management',
  ],
};

const PROJECTS = [
  {
    name: 'Hatar TCG (TCG Vault)',
    kind: 'Full-Stack E-Commerce Platform',
    stack: [
      'Next.js (App Router)', 'TypeScript', 'Tailwind CSS', 'Convex',
      'Clerk', 'Paymob Intention API', 'Vercel',
    ],
    highlights: [
      'Bilingual (Arabic / English) storefront',
      'Real-time card search and inventory filters',
      'Clerk user authentication',
      'Convex order state management',
      'Paymob secure checkout',
    ],
    overview:
      'Engineered an enterprise-grade trading-card e-commerce platform with ' +
      'dynamic stock-validation filtering across major card franchises, a ' +
      'bilingual UX, and a payment pipeline handling the Paymob Intention API ' +
      'with server-side HMAC-SHA512 webhook authentication and automatic order ' +
      'status transitions.',
  },
  {
    name: 'Social Culture',
    kind: 'Digital Agency Portfolio & Headless CMS',
    stack: [
      'JavaScript (ES6+)', 'Supabase (PostgreSQL, Storage)', 'HTML5', 'CSS3',
      'Vercel', 'REST APIs',
    ],
    highlights: [
      'Dynamic package management',
      'Case-study showcase grid',
      'Real-time headless CMS',
      'Cross-browser entrance animations',
    ],
    overview:
      'Built a modern agency showcase web application integrated with ' +
      'Supabase, letting non-technical marketing managers change service ' +
      'tiers, client case studies and visual assets in real time without code ' +
      'redeployments.',
  },
  {
    name: 'Personal Dynamic Portfolio & Headless CMS Dashboard',
    kind: 'Portfolio + CMS',
    stack: [
      'Vanilla JavaScript', 'Supabase (Auth, RLS Policies, PostgreSQL)',
      'CSS3 Tokens', 'Node.js',
    ],
    highlights: [
      'Dark / light theme switching',
      'Scroll-driven card stacking',
      'Strict Content Security Policy',
      'Anti-spam honeypot and time-trap',
      '9.2 / 10 code-quality and security audit score',
    ],
    overview:
      'Architected a high-performance portfolio featuring a custom Supabase ' +
      'CMS dashboard, bidirectional scroll-driven animations, Gzip compression ' +
      '(-77% transfer size) and enterprise-grade security protections.',
  },
];

const EXPERIENCE = [
  {
    role: 'Freelance Frontend Developer',
    company: 'Self-Employed / Independent',
    period: 'May 2025 – Present',
    points: [
      'Delivered responsive e-commerce web applications, brand portfolios and ' +
        'digital agency platforms covering high-conversion UI, modern ' +
        'animations and multi-language support (Arabic / English).',
      'Implemented secure end-to-end e-commerce payment workflows with the ' +
        'Paymob Intention API, including server-side webhook HMAC ' +
        'verification, Convex order synchronization and error-handling state ' +
        'machines.',
      'Integrated headless Supabase and Convex backends with user ' +
        'authentication (Clerk / Supabase Auth), Row Level Security (RLS) and ' +
        'custom client CMS editors.',
      'Used AI-assisted development tools (Cursor, Claude, ChatGPT) for rapid ' +
        'UI scaffolding, automated security auditing, code refactoring and ' +
        'complex API troubleshooting.',
    ],
  },
  {
    role: 'Frontend Developer [Independent Projects]',
    company: 'E-Commerce & SaaS Solutions',
    period: 'Jan 2025 – May 2025',
    points: [
      'Architected component-driven interfaces using Next.js App Router, ' +
        'React.js, TypeScript and Tailwind CSS with strict attention to ' +
        'performance and clean code architecture.',
      'Achieved a 9.2 / 10 Code Quality and Security Audit rating across ' +
        'production deployments with Content Security Policy (CSP), native ' +
        'Gzip compression, ETag caching and honeypot anti-spam defense.',
      'Built smooth bidirectional scroll-driven animations, sticky card ' +
        'stacking and dark / light theme switching with zero layout shift.',
    ],
  },
];

const EDUCATION = [
  "Bachelor's Degree — Computer & Information Sciences / Related Discipline (Graduated)",
];

const LANGUAGES = ['Arabic — Native', 'English — Professional / working proficiency'];

/* ------------------------------------------------------------
 * Assemble the grounding context. Kept as plain readable text so
 * a human reviewing a wrong answer can see exactly what the model
 * was given.
 * ------------------------------------------------------------ */
function joinMap(map) {
  const out = [];
  Object.keys(map).forEach(function (key) {
    out.push('- ' + key + ': ' + map[key].join(', '));
  });
  return out.join('\n');
}

function buildKnowledgeText() {
  const parts = [];

  parts.push('=== PROFILE ===');
  parts.push('Name: ' + PROFILE.name);
  parts.push('Title: ' + PROFILE.title);
  parts.push('Location: ' + PROFILE.location);
  parts.push('Email: ' + PROFILE.email);
  parts.push('Phone: ' + PROFILE.phone);
  parts.push('LinkedIn: ' + PROFILE.links.linkedin);
  parts.push('GitHub: ' + PROFILE.links.github);
  parts.push('Summary: ' + PROFILE.summary);

  parts.push('');
  parts.push('=== SKILLS ===');
  parts.push(joinMap(SKILLS));

  parts.push('');
  parts.push('=== PROJECTS ===');
  PROJECTS.forEach(function (p) {
    parts.push('· ' + p.name + ' — ' + p.kind);
    parts.push('  Stack: ' + p.stack.join(', '));
    parts.push('  Highlights: ' + p.highlights.join('; '));
    parts.push('  Overview: ' + p.overview);
  });

  parts.push('');
  parts.push('=== EXPERIENCE ===');
  EXPERIENCE.forEach(function (e) {
    parts.push('· ' + e.role + ' — ' + e.company + ' (' + e.period + ')');
    e.points.forEach(function (pt) {
      parts.push('  - ' + pt);
    });
  });

  parts.push('');
  parts.push('=== EDUCATION ===');
  EDUCATION.forEach(function (line) {
    parts.push('- ' + line);
  });

  parts.push('');
  parts.push('=== LANGUAGES ===');
  parts.push('- ' + LANGUAGES.join('\n- '));

  return parts.join('\n');
}

const KNOWLEDGE_TEXT = buildKnowledgeText();

/* Suggested questions surfaced in the UI. Phrased the way a
   recruiter would actually ask them. */
const SUGGESTED_QUESTIONS = [
  'What are her strongest technical skills?',
  'Tell me about a featured project and the problem it solves.',
  'Which technologies were used in the TCG Vault platform?',
  'What is her experience with payment integrations?',
  'How can I contact her?',
];

module.exports = {
  PROFILE: PROFILE,
  SKILLS: SKILLS,
  PROJECTS: PROJECTS,
  EXPERIENCE: EXPERIENCE,
  EDUCATION: EDUCATION,
  LANGUAGES: LANGUAGES,
  EDUCATION_AND_LANGUAGES: EDUCATION.concat(LANGUAGES),
  KNOWLEDGE_TEXT: KNOWLEDGE_TEXT,
  SUGGESTED_QUESTIONS: SUGGESTED_QUESTIONS,
};
