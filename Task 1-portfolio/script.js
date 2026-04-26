/* ===== PRELOADER ===== */
(function() {
  const bar = document.getElementById('preloader-bar');
  const preloader = document.getElementById('preloader');
  let progress = 0;
  const interval = setInterval(() => {
    progress += Math.random() * 15 + 5;
    if (progress >= 100) { progress = 100; clearInterval(interval); }
    bar.style.width = progress + '%';
    if (progress === 100) {
      setTimeout(() => {
        preloader.style.opacity = '0';
        preloader.style.transition = 'opacity 0.6s ease';
        setTimeout(() => { preloader.style.display = 'none'; initAnimations(); initLenis(); }, 600);
      }, 400);
    }
  }, 120);
})();

/* ===== LENIS SMOOTH SCROLL ===== */
let lenis;
function initLenis() {
  if (typeof Lenis === 'undefined') return;
  lenis = new Lenis({ duration: 1.4, easing: t => Math.min(1, 1.001 - Math.pow(2, -10 * t)), smoothWheel: true, touchMultiplier: 1.5 });
  function raf(time) { lenis.raf(time); requestAnimationFrame(raf); }
  requestAnimationFrame(raf);
  if (typeof ScrollTrigger !== 'undefined') {
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(time => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
  }
}

/* ===== CUSTOM CURSOR ===== */
const cursorDot = document.getElementById('cursor-dot');
const cursorRing = document.getElementById('cursor-ring');
let mouseX = 0, mouseY = 0, ringX = 0, ringY = 0;
document.addEventListener('mousemove', e => { mouseX = e.clientX; mouseY = e.clientY; });
function animateCursor() {
  ringX += (mouseX - ringX) * 0.12;
  ringY += (mouseY - ringY) * 0.12;
  cursorDot.style.left = mouseX + 'px';
  cursorDot.style.top = mouseY + 'px';
  cursorRing.style.left = ringX + 'px';
  cursorRing.style.top = ringY + 'px';
  requestAnimationFrame(animateCursor);
}
animateCursor();
document.querySelectorAll('a, button, .skill-card, .project-card, .cert-card').forEach(el => {
  el.addEventListener('mouseenter', () => { cursorDot.classList.add('hover'); cursorRing.classList.add('hover'); });
  el.addEventListener('mouseleave', () => { cursorDot.classList.remove('hover'); cursorRing.classList.remove('hover'); });
});

/* ===== MAGNETIC BUTTON EFFECT ===== */
document.querySelectorAll('.btn').forEach(btn => {
  btn.addEventListener('mousemove', e => {
    const rect = btn.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    btn.style.transform = `translate(${x * 0.15}px, ${y * 0.15}px)`;
  });
  btn.addEventListener('mouseleave', () => { btn.style.transform = ''; });
  // Ripple effect
  btn.addEventListener('click', function(e) {
    const ripple = document.createElement('span');
    ripple.classList.add('btn-ripple');
    const rect = this.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    ripple.style.width = ripple.style.height = size + 'px';
    ripple.style.left = (e.clientX - rect.left - size / 2) + 'px';
    ripple.style.top = (e.clientY - rect.top - size / 2) + 'px';
    this.appendChild(ripple);
    setTimeout(() => ripple.remove(), 600);
  });
});

/* ===== TILT EFFECT FOR PROJECT CARDS ===== */
document.querySelectorAll('.project-card').forEach(card => {
  card.addEventListener('mousemove', e => {
    const rect = card.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    card.style.transform = `perspective(1000px) rotateY(${x * 8}deg) rotateX(${-y * 8}deg) translateY(-8px)`;
  });
  card.addEventListener('mouseleave', () => {
    card.style.transform = '';
    card.style.transition = 'transform 0.5s cubic-bezier(0.25,0.46,0.45,0.94)';
    setTimeout(() => card.style.transition = '', 500);
  });
});

/* ===== PARTICLES CANVAS ===== */
const canvas = document.getElementById('particles-canvas');
const ctx = canvas.getContext('2d');
let particles = [];
function resizeCanvas() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
resizeCanvas();
window.addEventListener('resize', resizeCanvas);
class Particle {
  constructor() { this.reset(); }
  reset() {
    this.x = Math.random() * canvas.width;
    this.y = Math.random() * canvas.height;
    this.size = Math.random() * 2 + 0.5;
    this.speedX = (Math.random() - 0.5) * 0.4;
    this.speedY = (Math.random() - 0.5) * 0.4;
    this.opacity = Math.random() * 0.5 + 0.1;
  }
  update() {
    this.x += this.speedX; this.y += this.speedY;
    // Mouse repulsion
    const dx = this.x - mouseX; const dy = this.y - mouseY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 120) { this.x += dx * 0.02; this.y += dy * 0.02; }
    if (this.x < 0 || this.x > canvas.width || this.y < 0 || this.y > canvas.height) this.reset();
  }
  draw() {
    ctx.beginPath(); ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(0, 229, 160, ${this.opacity})`; ctx.fill();
  }
}
for (let i = 0; i < 80; i++) particles.push(new Particle());
function animateParticles() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  particles.forEach(p => { p.update(); p.draw(); });
  for (let i = 0; i < particles.length; i++) {
    for (let j = i + 1; j < particles.length; j++) {
      const dx = particles[i].x - particles[j].x;
      const dy = particles[i].y - particles[j].y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 120) {
        ctx.beginPath();
        ctx.strokeStyle = `rgba(0, 229, 160, ${0.06 * (1 - dist / 120)})`;
        ctx.lineWidth = 0.5;
        ctx.moveTo(particles[i].x, particles[i].y);
        ctx.lineTo(particles[j].x, particles[j].y);
        ctx.stroke();
      }
    }
  }
  requestAnimationFrame(animateParticles);
}
animateParticles();

/* ===== TYPING ANIMATION ===== */
const typedEl = document.getElementById('typed-text');
const phrases = ['Aspiring Data Scientist.', 'Machine Learning Enthusiast.', 'Full-Stack Developer.', 'Problem Solver.', 'Open Source Contributor.'];
let phraseIndex = 0, charIndex = 0, isDeleting = false;
function typeEffect() {
  const current = phrases[phraseIndex];
  typedEl.textContent = isDeleting ? current.substring(0, charIndex--) : current.substring(0, charIndex++);
  let delay = isDeleting ? 30 : 60;
  if (!isDeleting && charIndex === current.length + 1) { delay = 2000; isDeleting = true; }
  if (isDeleting && charIndex < 0) { isDeleting = false; phraseIndex = (phraseIndex + 1) % phrases.length; delay = 400; }
  setTimeout(typeEffect, delay);
}
typeEffect();

/* ===== NAVBAR ===== */
const navbar = document.getElementById('navbar');
const sections = document.querySelectorAll('section[id]');
const navLinks = document.querySelectorAll('.nav-links a');
window.addEventListener('scroll', () => {
  navbar.classList.toggle('scrolled', window.scrollY > 50);
  let current = '';
  sections.forEach(sec => { if (window.scrollY >= sec.offsetTop - 200) current = sec.getAttribute('id'); });
  navLinks.forEach(link => link.classList.toggle('active', link.getAttribute('href') === '#' + current));
  document.getElementById('scroll-progress').style.width = (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100 + '%';
});

/* ===== MOBILE NAV ===== */
const hamburger = document.getElementById('hamburger');
const mobileNav = document.getElementById('mobile-nav');
hamburger.addEventListener('click', () => { mobileNav.classList.toggle('open'); hamburger.classList.toggle('active'); });
mobileNav.querySelectorAll('a').forEach(link => {
  link.addEventListener('click', () => { mobileNav.classList.remove('open'); hamburger.classList.remove('active'); });
});

/* ===== SCROLL REVEAL ===== */
function setupScrollReveal() {
  const revealEls = document.querySelectorAll('.reveal, .reveal-left, .reveal-right');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry, i) => {
      if (entry.isIntersecting) { setTimeout(() => entry.target.classList.add('active'), i * 80); observer.unobserve(entry.target); }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
  revealEls.forEach(el => observer.observe(el));
}
setupScrollReveal();

/* ===== SKILL BARS ===== */
const skillBars = document.querySelectorAll('.skill-bar-fill');
const skillObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => { if (entry.isIntersecting) { entry.target.style.width = entry.target.dataset.width + '%'; skillObserver.unobserve(entry.target); } });
}, { threshold: 0.5 });
skillBars.forEach(bar => skillObserver.observe(bar));

/* ===== FLOATING SHAPES PARALLAX ===== */
document.querySelectorAll('.float-shape').forEach(shape => {
  const speed = parseFloat(shape.dataset.speed) || 0.03;
  let angle = Math.random() * Math.PI * 2;
  function floatAnim() {
    angle += 0.008;
    const yOff = Math.sin(angle) * 20;
    const xOff = Math.cos(angle * 0.7) * 15;
    shape.style.transform = `translate(${xOff}px, ${yOff}px)` + (shape.classList.contains('float-shape-sq') ? ' rotate(45deg)' : '');
    requestAnimationFrame(floatAnim);
  }
  floatAnim();
});

/* ===== GSAP ANIMATIONS ===== */
function initAnimations() {
  if (typeof gsap === 'undefined') return;
  gsap.registerPlugin(ScrollTrigger);

  // Hero intro
  gsap.set('.hero-badge', { opacity: 0, y: 20 });
  gsap.set('.line-inner', { y: '110%' });
  gsap.set('.hero-subtitle', { opacity: 0, y: 20 });
  gsap.set('.hero-cta', { opacity: 0, y: 20 });
  gsap.set('.scroll-indicator', { opacity: 0 });
  const tl = gsap.timeline({ delay: 0.3 });
  tl.to('.hero-badge', { opacity: 1, y: 0, duration: 0.6, ease: 'power3.out' })
    .to('.line-inner', { y: '0%', duration: 0.9, stagger: 0.18, ease: 'power4.out' }, '-=0.3')
    .to('.hero-subtitle', { opacity: 1, y: 0, duration: 0.6, ease: 'power3.out' }, '-=0.4')
    .to('.hero-cta', { opacity: 1, y: 0, duration: 0.6, ease: 'power3.out' }, '-=0.3')
    .to('.scroll-indicator', { opacity: 1, duration: 0.6, ease: 'power3.out' }, '-=0.2');

  // Parallax gradients
  gsap.to('.hero-gradient-1', { y: -150, x: 50, scrollTrigger: { trigger: '#hero', start: 'top top', end: 'bottom top', scrub: 1.5 }});
  gsap.to('.hero-gradient-2', { y: 150, x: -50, scrollTrigger: { trigger: '#hero', start: 'top top', end: 'bottom top', scrub: 1.5 }});

  // Section parallax headers
  document.querySelectorAll('.section-header').forEach(header => {
    gsap.from(header, { y: 40, scrollTrigger: { trigger: header, start: 'top 90%', end: 'top 60%', scrub: 1 }});
  });

  // About image parallax
  gsap.to('.about-image', { y: -30, scrollTrigger: { trigger: '#about', start: 'top bottom', end: 'bottom top', scrub: 1.5 }});

  // Stagger skill cards with GSAP
  gsap.set('.skill-card', { opacity: 0, y: 30, scale: 0.95 });
  ScrollTrigger.batch('.skill-card', {
    onEnter: batch => gsap.to(batch, { opacity: 1, y: 0, scale: 1, stagger: 0.04, duration: 0.5, ease: 'back.out(1.2)' }),
    start: 'top 88%'
  });

  // Project cards stagger
  gsap.set('.project-card', { opacity: 0, y: 50, rotateX: 5 });
  ScrollTrigger.batch('.project-card', {
    onEnter: batch => gsap.to(batch, { opacity: 1, y: 0, rotateX: 0, stagger: 0.15, duration: 0.7, ease: 'power3.out' }),
    start: 'top 88%'
  });

  // Timeline items slide in
  document.querySelectorAll('.timeline-item').forEach((item, i) => {
    const dir = i % 2 === 0 ? -60 : 60;
    gsap.from(item, { x: dir, opacity: 0, duration: 0.8, ease: 'power3.out',
      scrollTrigger: { trigger: item, start: 'top 85%' }});
  });

  // Cert cards
  gsap.set('.cert-card', { opacity: 0, y: 30 });
  ScrollTrigger.batch('.cert-card', {
    onEnter: batch => gsap.to(batch, { opacity: 1, y: 0, stagger: 0.08, duration: 0.5, ease: 'power3.out' }),
    start: 'top 88%'
  });

  // Contact section
  gsap.from('.contact-info', { x: -50, opacity: 0, duration: 0.8, ease: 'power3.out', scrollTrigger: { trigger: '#contact', start: 'top 80%' }});
  gsap.from('.contact-form', { x: 50, opacity: 0, duration: 0.8, ease: 'power3.out', scrollTrigger: { trigger: '#contact', start: 'top 80%' }});

  // Section floating shapes parallax with scroll
  document.querySelectorAll('.float-shape').forEach(shape => {
    const speed = parseFloat(shape.dataset.speed) || 0.03;
    gsap.to(shape, { y: () => -200 * speed * 10, scrollTrigger: { trigger: shape.closest('section'), start: 'top bottom', end: 'bottom top', scrub: 2 }});
  });
}

/* ===== SMOOTH SCROLL FOR ANCHORS ===== */
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function(e) {
    e.preventDefault();
    const target = document.querySelector(this.getAttribute('href'));
    if (target) {
      if (lenis) { lenis.scrollTo(target, { offset: -60, duration: 1.5 }); }
      else { target.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    }
  });
});

/* ===== CONTACT FORM SUBMIT ===== */
document.querySelector('.contact-form .btn')?.addEventListener('click', function(e) {
  e.preventDefault();
  const name = document.getElementById('name').value;
  const email = document.getElementById('email').value;
  const msg = document.getElementById('message').value;
  if (name && email && msg) {
    this.textContent = 'Sent! ✓';
    this.style.background = '#00b8d4';
    setTimeout(() => { this.textContent = 'Send Message →'; this.style.background = ''; }, 2500);
  }
});
