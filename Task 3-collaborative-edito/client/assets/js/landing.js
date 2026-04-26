/**
 * SyncSpace AI - Landing Page JavaScript
 * Handles navigation, demo functionality, and UI interactions
 */

// ===== DOM Elements =====
const elements = {
    // Navigation
    mobileMenuBtn: document.getElementById('mobileMenuBtn'),
    mobileMenu: document.getElementById('mobileMenu'),
    
    // Auth Buttons
    loginBtn: document.getElementById('loginBtn'),
    signupBtn: document.getElementById('signupBtn'),
    mobileLoginBtn: document.getElementById('mobileLoginBtn'),
    mobileSignupBtn: document.getElementById('mobileSignupBtn'),
    heroLoginBtn: document.getElementById('heroLoginBtn'),
    heroSignupBtn: document.getElementById('heroSignupBtn'),
    
    // Demo Buttons
    heroDemoBtn: document.getElementById('heroDemoBtn'),
    launchDemoBtn: document.getElementById('launchDemoBtn'),
    
    // Links
    navLinks: document.querySelectorAll('.nav-link'),
    mobileLinks: document.querySelectorAll('.mobile-link'),
    footerLinks: document.querySelectorAll('.footer-link[href^="#"]')
  };
  
  // ===== Navigation Functions =====
  
  /**
   * Redirects to the login page
   */
  function goToLogin() {
    window.location.href = '/auth/login.html';
  }
  
  /**
   * Redirects to the signup page
   */
  function goToSignup() {
    window.location.href = '/auth/signup.html';
  }
  
  /**
   * Starts the demo by redirecting to demo room
   */
  function startDemo() {
    window.location.href = '/workspace.html?room=demo-room';
  }
  
  /**
   * Toggles the mobile menu
   */
  function toggleMobileMenu() {
    elements.mobileMenu.classList.toggle('active');
    
    const icon = elements.mobileMenuBtn.querySelector('i');
    if (elements.mobileMenu.classList.contains('active')) {
      icon.classList.remove('fa-bars');
      icon.classList.add('fa-xmark');
    } else {
      icon.classList.remove('fa-xmark');
      icon.classList.add('fa-bars');
    }
  }
  
  /**
   * Closes the mobile menu
   */
  function closeMobileMenu() {
    elements.mobileMenu.classList.remove('active');
    const icon = elements.mobileMenuBtn.querySelector('i');
    icon.classList.remove('fa-xmark');
    icon.classList.add('fa-bars');
  }
  
  /**
   * Smooth scrolls to a target element
   * @param {string} targetId - The ID of the target element
   */
  function smoothScrollTo(targetId) {
    const target = document.querySelector(targetId);
    if (target) {
      const navbarHeight = 72;
      const targetPosition = target.getBoundingClientRect().top + window.pageYOffset - navbarHeight;
      
      window.scrollTo({
        top: targetPosition,
        behavior: 'smooth'
      });
    }
  }
  
  // ===== Event Listeners =====
  
  // Mobile Menu Toggle
  if (elements.mobileMenuBtn) {
    elements.mobileMenuBtn.addEventListener('click', toggleMobileMenu);
  }
  
  // Auth Buttons - Login
  const loginButtons = [elements.loginBtn, elements.mobileLoginBtn, elements.heroLoginBtn];
  loginButtons.forEach(btn => {
    if (btn) {
      btn.addEventListener('click', goToLogin);
    }
  });
  
  // Auth Buttons - Signup
  const signupButtons = [elements.signupBtn, elements.mobileSignupBtn, elements.heroSignupBtn];
  signupButtons.forEach(btn => {
    if (btn) {
      btn.addEventListener('click', goToSignup);
    }
  });
  
  // Demo Buttons
  const demoButtons = [elements.heroDemoBtn, elements.launchDemoBtn];
  demoButtons.forEach(btn => {
    if (btn) {
      btn.addEventListener('click', startDemo);
    }
  });
  
  // Navigation Links - Smooth Scroll
  elements.navLinks.forEach(link => {
    link.addEventListener('click', function(e) {
      const href = this.getAttribute('href');
      if (href.startsWith('#')) {
        e.preventDefault();
        smoothScrollTo(href);
      }
    });
  });
  
  // Mobile Navigation Links - Smooth Scroll + Close Menu
  elements.mobileLinks.forEach(link => {
    link.addEventListener('click', function(e) {
      const href = this.getAttribute('href');
      if (href.startsWith('#')) {
        e.preventDefault();
        closeMobileMenu();
        setTimeout(() => {
          smoothScrollTo(href);
        }, 300);
      }
    });
  });
  
  // Footer Links - Smooth Scroll
  elements.footerLinks.forEach(link => {
    link.addEventListener('click', function(e) {
      const href = this.getAttribute('href');
      if (href.startsWith('#')) {
        e.preventDefault();
        smoothScrollTo(href);
      }
    });
  });
  
  // ===== Scroll Effects =====
  
  /**
   * Updates navbar style based on scroll position
   */
  function updateNavbarOnScroll() {
    const navbar = document.querySelector('.navbar');
    if (window.scrollY > 50) {
      navbar.style.boxShadow = 'var(--shadow-md)';
    } else {
      navbar.style.boxShadow = 'none';
    }
  }
  
  // Throttle scroll event
  let ticking = false;
  window.addEventListener('scroll', function() {
    if (!ticking) {
      window.requestAnimationFrame(function() {
        updateNavbarOnScroll();
        ticking = false;
      });
      ticking = true;
    }
  });
  
  // ===== Intersection Observer for Animations =====
  
  /**
   * Sets up intersection observer for scroll animations
   */
  function setupScrollAnimations() {
    const observerOptions = {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px'
    };
  
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('animate-in');
          observer.unobserve(entry.target);
        }
      });
    }, observerOptions);
  
    // Observe feature cards
    document.querySelectorAll('.feature-card').forEach((card, index) => {
      card.style.opacity = '0';
      card.style.transform = 'translateY(30px)';
      card.style.transition = `opacity 0.6s ease ${index * 0.1}s, transform 0.6s ease ${index * 0.1}s`;
      observer.observe(card);
    });
  
    // Observe steps
    document.querySelectorAll('.step').forEach((step, index) => {
      step.style.opacity = '0';
      step.style.transform = 'translateY(30px)';
      step.style.transition = `opacity 0.6s ease ${index * 0.15}s, transform 0.6s ease ${index * 0.15}s`;
      observer.observe(step);
    });
  
    // Observe demo card
    const demoCard = document.querySelector('.demo-card');
    if (demoCard) {
      demoCard.style.opacity = '0';
      demoCard.style.transform = 'translateY(30px)';
      demoCard.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
      observer.observe(demoCard);
    }
  }
  
  // Add animate-in class styles dynamically
  const style = document.createElement('style');
  style.textContent = `
    .animate-in {
      opacity: 1 !important;
      transform: translateY(0) !important;
    }
  `;
  document.head.appendChild(style);
  
  // ===== Typing Animation =====
  
  /**
   * Creates a typing effect for the editor preview
   */
  function setupTypingAnimation() {
    const editorText = document.querySelector('.editor-text');
    if (!editorText) return;
  
    const texts = [
      'Welcome to SyncSpace AI...',
      'Start collaborating in real-time...',
      'Let AI enhance your writing...',
      'Work together seamlessly...'
    ];
  
    let textIndex = 0;
    let charIndex = 0;
    let isDeleting = false;
    let typingSpeed = 100;
  
    function type() {
      const currentText = texts[textIndex];
      
      if (isDeleting) {
        editorText.textContent = currentText.substring(0, charIndex - 1);
        charIndex--;
        typingSpeed = 50;
      } else {
        editorText.textContent = currentText.substring(0, charIndex + 1);
        charIndex++;
        typingSpeed = 100;
      }
  
      if (!isDeleting && charIndex === currentText.length) {
        typingSpeed = 2000;
        isDeleting = true;
      } else if (isDeleting && charIndex === 0) {
        isDeleting = false;
        textIndex = (textIndex + 1) % texts.length;
        typingSpeed = 500;
      }
  
      setTimeout(type, typingSpeed);
    }
  
    // Start typing after initial animation
    setTimeout(type, 2000);
  }
  
  // ===== Button Hover Effects =====
  
  /**
   * Adds ripple effect to buttons
   */
  function setupButtonEffects() {
    const buttons = document.querySelectorAll('.btn-primary, .btn-secondary');
    
    buttons.forEach(button => {
      button.addEventListener('mouseenter', function(e) {
        const rect = this.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        this.style.setProperty('--mouse-x', `${x}px`);
        this.style.setProperty('--mouse-y', `${y}px`);
      });
    });
  }
  
  // ===== Close Mobile Menu on Outside Click =====
  
  document.addEventListener('click', function(e) {
    if (elements.mobileMenu && elements.mobileMenu.classList.contains('active')) {
      if (!elements.mobileMenu.contains(e.target) && !elements.mobileMenuBtn.contains(e.target)) {
        closeMobileMenu();
      }
    }
  });
  
  // ===== Close Mobile Menu on Escape Key =====
  
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && elements.mobileMenu && elements.mobileMenu.classList.contains('active')) {
      closeMobileMenu();
    }
  });
  
  // ===== Initialize =====
  
  document.addEventListener('DOMContentLoaded', function() {
    setupScrollAnimations();
    setupTypingAnimation();
    setupButtonEffects();
    
    // Initial navbar check
    updateNavbarOnScroll();
    const homeBtn = document.getElementById('home-btn');
    if (homeBtn) {
      homeBtn.addEventListener('click', () => {
        const confirmLeave = confirm('Leave workspace? Unsaved changes may be lost.');
        if (!confirmLeave) return;
  
        location.href = '/dashboard/dashboard.html';
      });
    }
  
  
  });
  
  // Export startDemo for global access (optional)
  window.startDemo = startDemo;
  // 🌙 Dark Mode Toggle
const themeToggle = document.getElementById('themeToggle');

// Load saved theme
const savedTheme = localStorage.getItem('theme');
if (savedTheme) {
  document.documentElement.setAttribute('data-theme', savedTheme);
}

// Toggle theme
themeToggle.addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme');

  if (current === 'dark') {
    document.documentElement.removeAttribute('data-theme');
    localStorage.setItem('theme', 'light');
    themeToggle.innerHTML = '<i class="fas fa-moon"></i>';
  } else {
    document.documentElement.setAttribute('data-theme', 'dark');
    localStorage.setItem('theme', 'dark');
    themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
  }
});
if (savedTheme === 'dark') {
    themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
  }