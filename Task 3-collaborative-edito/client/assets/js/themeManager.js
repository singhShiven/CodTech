/**
 * Theme Manager
 * Handles dark/light theme switching
 */

class ThemeManager {
    constructor() {
      this.currentTheme = 'light';
      this.storageKey = 'syncspace-theme';
    }
  
    /**
     * Initialize theme manager
     */
    init() {
      // Load saved theme
      const savedTheme = localStorage.getItem(this.storageKey);
      if (savedTheme) {
        this.setTheme(savedTheme);
      } else {
        // Check system preference
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        this.setTheme(prefersDark ? 'dark' : 'light');
      }
  
      // Listen for system theme changes
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        if (!localStorage.getItem(this.storageKey)) {
          this.setTheme(e.matches ? 'dark' : 'light');
        }
      });
    }
  
    /**
     * Set theme
     */
    setTheme(theme) {
      this.currentTheme = theme;
      document.documentElement.setAttribute('data-theme', theme);
      localStorage.setItem(this.storageKey, theme);
      
      // Update toggle button icon
      this.updateToggleIcon();
    }
  
    /**
     * Toggle theme
     */
    toggle() {
      const newTheme = this.currentTheme === 'light' ? 'dark' : 'light';
      this.setTheme(newTheme);
    }
  
    /**
     * Get current theme
     */
    getTheme() {
      return this.currentTheme;
    }
  
    /**
     * Update toggle button icon
     */
    updateToggleIcon() {
      const toggleBtn = document.getElementById('theme-toggle');
      if (toggleBtn) {
        toggleBtn.innerHTML = this.currentTheme === 'light' 
          ? '🌙' 
          : '☀️';
        toggleBtn.setAttribute('aria-label', 
          `Switch to ${this.currentTheme === 'light' ? 'dark' : 'light'} mode`
        );
      }
    }
  }
  
  // Export singleton
  const themeManager = new ThemeManager();