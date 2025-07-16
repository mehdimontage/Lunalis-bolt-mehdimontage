class MyRPGLifeApp {
  constructor() {
    this.data = this.loadData();
    this.currentSection = 'dashboard';
    this.timer = {
      isRunning: false,
      isPaused: false,
      duration: 25 * 60, // 25 minutes en secondes
      remaining: 25 * 60,
      interval: null,
      startTime: null,
      pausedTime: 0
    };
    this.weeklyTimer = {
      interval: null,
      nextReviewDate: null
    };
    this.init();
  }

  init() {
    this.setupEventListeners();
    this.updateUI();
    this.startWeeklyCountdown();
    this.updateFocusStats();
    this.updateDurationDisplay();
    this.updateTimerDisplay();
  }

  loadData() {
    const defaultData = {
      xp: 0,
      dailyXP: 0,
      lastXPDate: new Date().toDateString(),
      rank: 'E',
      projects: [],
      achievements: [],
      focusSessions: [],
      weeklyReviews: [],
      lastWeeklyReview: null,
      nextWeeklyReview: null,
      settings: {
        autoBreaks: true,
        spotifyMode: false
      },
      stats: {
        totalFocusTime: 0,
        dailyFocusTime: 0,
        seasonFocusTime: 0,
        dailySessions: 0,
        mandatoryBlocks: 0,
        dailyFocusXP: 0,
        focusStreak: 0,
        lastFocusDate: null
      }
    };

    const saved = localStorage.getItem('myRPGLifeData');
    if (saved) {
      const data = { ...defaultData, ...JSON.parse(saved) };
      // Réinitialiser les stats quotidiennes si c'est un nouveau jour
      if (data.lastXPDate !== new Date().toDateString()) {
        data.dailyXP = 0;
        data.lastXPDate = new Date().toDateString();
        data.stats.dailyFocusTime = 0;
        data.stats.dailySessions = 0;
        data.stats.mandatoryBlocks = 0;
        data.stats.dailyFocusXP = 0;
      }
      return data;
    }
    return defaultData;
  }

  saveData() {
    localStorage.setItem('myRPGLifeData', JSON.stringify(this.data));
  }

  setupEventListeners() {
    // Navigation
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        if (this.timer.isRunning && e.target.dataset.section !== 'focus') {
          this.showNotification('Terminez votre session de focus avant de changer de section', 'warning');
          return;
        }
        this.showSection(e.target.dataset.section);
      });
    });

    // Timer controls
    document.getElementById('startPauseBtn').addEventListener('click', () => this.toggleTimer());
    document.getElementById('resetBtn').addEventListener('click', () => this.resetTimer());
    
    // Duration controls
    document.getElementById('decreaseDurationBtn').addEventListener('click', () => this.adjustDuration(-5));
    document.getElementById('increaseDurationBtn').addEventListener('click', () => this.adjustDuration(5));

    // Focus start button
    document.getElementById('focusStartBtn').addEventListener('click', () => {
      this.showSection('focus');
    });

    // Project creation
    document.getElementById('createProjectBtn').addEventListener('click', () => {
      if (!this.timer.isRunning) {
        this.showProjectForm();
      }
    });

    // Modal close
    document.getElementById('modalOverlay').addEventListener('click', (e) => {
      if (e.target === document.getElementById('modalOverlay')) {
        this.closeModal();
      }
    });
  }

  showSection(sectionName) {
    // Masquer toutes les sections
    document.querySelectorAll('.content-section').forEach(section => {
      section.classList.remove('active');
    });

    // Désactiver tous les boutons de navigation
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.classList.remove('active');
    });

    // Afficher la section demandée
    document.getElementById(sectionName).classList.add('active');
    document.querySelector(`[data-section="${sectionName}"]`).classList.add('active');

    this.currentSection = sectionName;

    // Charger le contenu spécifique à la section
    switch (sectionName) {
      case 'projects':
        this.renderProjects();
        break;
      case 'achievements':
        this.renderAchievements();
        break;
      case 'progression':
        this.renderProgression();
        break;
      case 'weekly':
        this.renderWeeklyReview();
        break;
      case 'settings':
        this.renderSettings();
        break;
    }
  }

  toggleTimer() {
    if (!this.timer.isRunning && !this.timer.isPaused) {
      this.startTimer();
    } else if (this.timer.isRunning) {
      this.pauseTimer();
    } else if (this.timer.isPaused) {
      this.resumeTimer();
    }
  }

  startTimer() {
    const projectSelect = document.getElementById('projectSelect');
    if (!projectSelect.value) {
      this.showNotification('Veuillez sélectionner un projet avant de commencer', 'warning');
      return;
    }

    this.timer.isRunning = true;
    this.timer.isPaused = false;
    this.timer.startTime = Date.now();
    this.timer.remaining = this.timer.duration;

    // Désactiver l'interface
    this.setAppDisabled(true);

    this.timer.interval = setInterval(() => {
      this.timer.remaining--;
      this.updateTimerDisplay();
      this.updateFocusStatsRealTime();

      if (this.timer.remaining <= 0) {
        this.completeTimer();
      }
    }, 1000);

    this.updateTimerControls();
    this.showNotification('Session de focus démarrée !', 'success');
  }

  pauseTimer() {
    this.timer.isRunning = false;
    this.timer.isPaused = true;
    this.timer.pausedTime = Date.now();
    clearInterval(this.timer.interval);
    this.updateTimerControls();
  }

  resumeTimer() {
    this.timer.isRunning = true;
    this.timer.isPaused = false;
    this.timer.interval = setInterval(() => {
      this.timer.remaining--;
      this.updateTimerDisplay();
      this.updateFocusStatsRealTime();

      if (this.timer.remaining <= 0) {
        this.completeTimer();
      }
    }, 1000);
    this.updateTimerControls();
  }

  resetTimer() {
    clearInterval(this.timer.interval);
    this.timer.isRunning = false;
    this.timer.isPaused = false;
    this.timer.remaining = this.timer.duration;
    this.timer.startTime = null;
    this.timer.pausedTime = 0;

    // Réactiver l'interface
    this.setAppDisabled(false);

    this.updateTimerDisplay();
    this.updateTimerControls();
  }

  completeTimer() {
    const focusMinutes = Math.round(this.timer.duration / 60);
    const projectId = document.getElementById('projectSelect').value;
    
    // Calculer l'XP
    const xpGained = this.calculateFocusXP(focusMinutes);
    
    // Enregistrer la session
    this.recordFocusSession(focusMinutes, projectId, xpGained);
    
    // Ajouter l'XP
    this.addXP(xpGained);
    
    // Réinitialiser le timer
    this.resetTimer();
    
    this.showNotification(`Session terminée ! +${xpGained} XP`, 'success');
    this.updateFocusStats();
  }

  calculateFocusXP(minutes) {
    const baseXP = Math.round(minutes / 18);
    const isBonus = this.data.stats.mandatoryBlocks >= 2;
    return baseXP * (isBonus ? 2 : 1);
  }

  recordFocusSession(minutes, projectId, xpGained) {
    const session = {
      date: new Date().toISOString(),
      minutes: minutes,
      projectId: projectId,
      xpGained: xpGained
    };

    this.data.focusSessions.push(session);
    
    // Mettre à jour les statistiques
    this.data.stats.dailyFocusTime += minutes;
    this.data.stats.totalFocusTime += minutes;
    this.data.stats.seasonFocusTime += minutes / 60;
    this.data.stats.dailySessions++;
    this.data.stats.dailyFocusXP += xpGained;
    
    // Vérifier les blocs obligatoires (90 minutes = 1 bloc)
    if (minutes >= 90) {
      this.data.stats.mandatoryBlocks = Math.min(2, this.data.stats.mandatoryBlocks + 1);
    }

    this.saveData();
  }

  updateFocusStatsRealTime() {
    if (this.timer.isRunning) {
      const currentMinutes = Math.round((this.timer.duration - this.timer.remaining) / 60);
      if (currentMinutes > 0) {
        // Mettre à jour les stats en temps réel sans sauvegarder
        document.getElementById('dailySessions').textContent = this.data.stats.dailySessions + (currentMinutes >= 1 ? 1 : 0);
        document.getElementById('dailyFocusTime').textContent = `${this.data.stats.dailyFocusTime + currentMinutes}min`;
        
        const currentXP = this.calculateFocusXP(currentMinutes);
        document.getElementById('dailyFocusXP').textContent = this.data.stats.dailyFocusXP + currentXP;
      }
    }
  }

  updateFocusStats() {
    document.getElementById('dailySessions').textContent = this.data.stats.dailySessions;
    document.getElementById('dailyFocusTime').textContent = `${this.data.stats.dailyFocusTime}min`;
    document.getElementById('seasonFocusTime').textContent = `${Math.round(this.data.stats.seasonFocusTime)}h`;
    document.getElementById('mandatoryBlocks').textContent = `${this.data.stats.mandatoryBlocks}/2`;
    document.getElementById('dailyFocusXP').textContent = this.data.stats.dailyFocusXP;
    document.getElementById('focusStreak').textContent = this.data.stats.focusStreak;

    // Mettre à jour les blocs visuels
    this.updateBlocksStatus();
  }

  updateBlocksStatus() {
    const block1 = document.getElementById('block1');
    const block2 = document.getElementById('block2');
    const block3 = document.getElementById('block3');

    // Bloc 1
    if (this.data.stats.mandatoryBlocks >= 1) {
      block1.classList.add('completed');
    } else {
      block1.classList.remove('completed');
    }

    // Bloc 2
    if (this.data.stats.mandatoryBlocks >= 2) {
      block2.classList.add('completed');
      block3.classList.remove('locked');
    } else {
      block2.classList.remove('completed');
      block3.classList.add('locked');
    }
  }

  setAppDisabled(disabled) {
    const navBtns = document.querySelectorAll('.nav-btn:not([data-section="focus"])');
    const autoBreaks = document.getElementById('autoBreaks');
    const spotifyMode = document.getElementById('spotifyMode');
    const createProjectBtn = document.getElementById('createProjectBtn');

    if (disabled) {
      navBtns.forEach(btn => btn.disabled = true);
      autoBreaks.disabled = true;
      spotifyMode.disabled = true;
      createProjectBtn.disabled = true;
      document.body.classList.add('focus-mode');
    } else {
      navBtns.forEach(btn => btn.disabled = false);
      autoBreaks.disabled = false;
      spotifyMode.disabled = false;
      createProjectBtn.disabled = false;
      document.body.classList.remove('focus-mode');
    }
  }

  adjustDuration(minutes) {
    if (this.timer.isRunning || this.timer.isPaused) return;

    const newDuration = Math.max(15, Math.min(120, (this.timer.duration / 60) + minutes)) * 60;
    this.timer.duration = newDuration;
    this.timer.remaining = newDuration;
    this.updateTimerDisplay();
    this.updateDurationDisplay();
  }

  updateTimerDisplay() {
    const minutes = Math.floor(this.timer.remaining / 60);
    const seconds = this.timer.remaining % 60;
    const timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    
    document.getElementById('timerTime').textContent = timeString;
    
    // Mettre à jour l'aperçu XP
    const currentMinutes = Math.round((this.timer.duration - this.timer.remaining) / 60);
    const xpPreview = this.calculateFocusXP(Math.max(1, currentMinutes));
    document.getElementById('timerXPPreview').textContent = `+${xpPreview} XP`;

    // Mettre à jour le cercle de progression
    const progress = ((this.timer.duration - this.timer.remaining) / this.timer.duration) * 100;
    const circle = document.getElementById('timerProgress');
    const circumference = 2 * Math.PI * 90;
    const offset = circumference - (progress / 100) * circumference;
    circle.style.strokeDasharray = circumference;
    circle.style.strokeDashoffset = offset;
  }

  updateDurationDisplay() {
    const minutes = this.timer.duration / 60;
    document.getElementById('durationDisplay').textContent = `${minutes} min`;
  }

  updateTimerControls() {
    const startPauseBtn = document.getElementById('startPauseBtn');
    const startPauseText = document.getElementById('startPauseText');

    if (this.timer.isRunning) {
      startPauseText.textContent = 'Pause';
      startPauseBtn.classList.add('pause');
    } else if (this.timer.isPaused) {
      startPauseText.textContent = 'Reprendre';
      startPauseBtn.classList.remove('pause');
    } else {
      startPauseText.textContent = 'Commencer Focus';
      startPauseBtn.classList.remove('pause');
    }
  }

  addXP(amount) {
    this.data.xp += amount;
    this.data.dailyXP += amount;
    this.updateRank();
    this.updateUI();
    this.saveData();
  }

  updateRank() {
    const ranks = [
      { name: 'E', title: 'Paumé hésitant', min: 0, max: 199 },
      { name: 'D', title: 'Le Spectateur de Sa Vie', min: 200, max: 299 },
      { name: 'C', title: 'Apprenti Motivé', min: 300, max: 399 },
      { name: 'B', title: 'Aventurier Régulier', min: 400, max: 499 },
      { name: 'A', title: 'Le Vétéran', min: 500, max: 599 },
      { name: 'S', title: 'Sentinelle de l\'Ascension', min: 600, max: 699 },
      { name: 'SS', title: 'Maître du Flow', min: 700, max: 749 },
      { name: 'SSS', title: 'Élu du Destin', min: 750, max: Infinity }
    ];

    const currentRank = ranks.find(rank => this.data.xp >= rank.min && this.data.xp <= rank.max);
    if (currentRank && currentRank.name !== this.data.rank) {
      this.data.rank = currentRank.name;
      this.showNotification(`Nouveau rang atteint : ${currentRank.title} !`, 'success');
    }
  }

  startWeeklyCountdown() {
    // Si pas de prochaine review définie, la définir à dans 7 jours
    if (!this.data.nextWeeklyReview) {
      const nextReview = new Date();
      nextReview.setDate(nextReview.getDate() + 7);
      this.data.nextWeeklyReview = nextReview.toISOString();
      this.saveData();
    }

    this.updateWeeklyCountdown();
    this.weeklyTimer.interval = setInterval(() => {
      this.updateWeeklyCountdown();
    }, 1000);
  }

  updateWeeklyCountdown() {
    const now = new Date();
    const nextReview = new Date(this.data.nextWeeklyReview);
    const diff = nextReview - now;

    if (diff <= 0) {
      document.getElementById('weeklyCountdown').textContent = 'Bilan disponible !';
      return;
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    document.getElementById('weeklyCountdown').textContent = `${days}j ${hours}h ${minutes}m`;
  }

  renderWeeklyReview() {
    const container = document.getElementById('weeklyContent');
    const now = new Date();
    const nextReview = new Date(this.data.nextWeeklyReview);
    const canReview = now >= nextReview;

    if (canReview) {
      container.innerHTML = `
        <div class="weekly-form">
          <h3>📝 Évaluez votre semaine</h3>
          <p class="weekly-intro">Répondez honnêtement à ces 5 questions pour calculer votre taux d'intensité.</p>
          
          <div class="questions-container">
            <div class="question-item">
              <label>1. Ai-je été fidèle à mes engagements quotidiens, même quand c'était dur (bloc de focus) ?</label>
              <div class="rating-scale">
                ${this.generateRatingScale('q1')}
              </div>
            </div>
            
            <div class="question-item">
              <label>2. Ai-je eu une bonne hygiène de vie, énergique et mentale (sommeil, sport, Looksmaxxing) ?</label>
              <div class="rating-scale">
                ${this.generateRatingScale('q2')}
              </div>
            </div>
            
            <div class="question-item">
              <label>3. Ai-je géré consciemment mon exposition aux distractions ? (Musique et réseaux)</label>
              <div class="rating-scale">
                ${this.generateRatingScale('q3')}
              </div>
            </div>
            
            <div class="question-item">
              <label>4. Ai-je avancé concrètement vers mes 3 objectifs principaux de l'été ?</label>
              <div class="rating-scale">
                ${this.generateRatingScale('q4')}
              </div>
            </div>
            
            <div class="question-item">
              <label>5. Est-ce que je me sens fière de ma semaine et de mon état mental ?</label>
              <div class="rating-scale">
                ${this.generateRatingScale('q5')}
              </div>
            </div>
          </div>
          
          <button class="submit-review-btn" onclick="app.submitWeeklyReview()">
            ✨ Valider le Bilan (+5 XP)
          </button>
        </div>
      `;
    } else {
      container.innerHTML = `
        <div class="weekly-waiting">
          <h3>⏳ Prochain bilan dans</h3>
          <p>Votre prochain bilan hebdomadaire sera disponible dans quelques jours.</p>
          <div class="last-review-info">
            ${this.data.weeklyReviews.length > 0 ? `
              <h4>Dernier bilan :</h4>
              <p>Score : ${this.data.weeklyReviews[this.data.weeklyReviews.length - 1].totalScore}/50</p>
              <p>Pourcentage : ${this.data.weeklyReviews[this.data.weeklyReviews.length - 1].percentage}%</p>
            ` : '<p>Aucun bilan effectué pour le moment.</p>'}
          </div>
        </div>
      `;
    }
  }

  generateRatingScale(questionId) {
    let html = '';
    for (let i = 1; i <= 10; i++) {
      html += `
        <label class="rating-option">
          <input type="radio" name="${questionId}" value="${i}">
          <span class="rating-number">${i}</span>
        </label>
      `;
    }
    return html;
  }

  submitWeeklyReview() {
    const questions = ['q1', 'q2', 'q3', 'q4', 'q5'];
    const scores = {};
    let totalScore = 0;

    // Récupérer les réponses
    for (const q of questions) {
      const selected = document.querySelector(`input[name="${q}"]:checked`);
      if (!selected) {
        this.showNotification('Veuillez répondre à toutes les questions', 'warning');
        return;
      }
      scores[q] = parseInt(selected.value);
      totalScore += scores[q];
    }

    // Calculer le pourcentage
    const percentage = Math.round((totalScore / 50) * 100);

    // Enregistrer le bilan
    const review = {
      date: new Date().toISOString(),
      scores: scores,
      totalScore: totalScore,
      percentage: percentage
    };

    this.data.weeklyReviews.push(review);
    
    // Programmer le prochain bilan dans 7 jours
    const nextReview = new Date();
    nextReview.setDate(nextReview.getDate() + 7);
    this.data.nextWeeklyReview = nextReview.toISOString();

    // Ajouter 5 XP
    this.addXP(5);

    // Mettre à jour le taux d'intensité
    this.updateIntensityRate();

    this.saveData();
    this.showNotification('Bilan hebdomadaire enregistré ! +5 XP', 'success');
    
    // Animation de succès
    this.playReviewAnimation();
    
    // Recharger la vue
    this.renderWeeklyReview();
  }

  updateIntensityRate() {
    if (this.data.weeklyReviews.length === 0) return;

    // Prendre les 4 dernières semaines maximum
    const recentReviews = this.data.weeklyReviews.slice(-4);
    const average = recentReviews.reduce((sum, review) => sum + review.percentage, 0) / recentReviews.length;
    
    const intensityRate = Math.round(average);
    
    // Déterminer le label
    const intensityLevels = [
      { min: 0, max: 20, label: 'Errant du Néant' },
      { min: 21, max: 40, label: 'Apprenti Perdu' },
      { min: 41, max: 60, label: 'Disciple Motivé' },
      { min: 61, max: 75, label: 'Adepte Déterminé' },
      { min: 76, max: 85, label: 'Expert Focalisé' },
      { min: 86, max: 95, label: 'Maître Discipliné' },
      { min: 96, max: 99, label: 'Légende Vivante' },
      { min: 100, max: 100, label: 'Transcendant' }
    ];

    const level = intensityLevels.find(l => intensityRate >= l.min && intensityRate <= l.max);
    
    // Mettre à jour l'affichage
    document.getElementById('intensityValue').textContent = `${intensityRate}%`;
    document.getElementById('intensityLabel').textContent = level ? level.label : 'Errant du Néant';
    
    // Mettre à jour la barre de progression
    const intensityFill = document.getElementById('intensityFill');
    intensityFill.style.width = `${intensityRate}%`;
  }

  playReviewAnimation() {
    // Animation simple pour le moment
    const notification = document.createElement('div');
    notification.className = 'review-animation';
    notification.innerHTML = '✨ Bilan complété ! +5 XP ✨';
    notification.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: linear-gradient(45deg, #667eea, #764ba2);
      color: white;
      padding: 2rem;
      border-radius: 15px;
      font-size: 1.5rem;
      font-weight: bold;
      z-index: 10000;
      animation: reviewPulse 3s ease-in-out;
    `;
    
    const style = document.createElement('style');
    style.textContent = `
      @keyframes reviewPulse {
        0% { opacity: 0; transform: translate(-50%, -50%) scale(0.5); }
        50% { opacity: 1; transform: translate(-50%, -50%) scale(1.1); }
        100% { opacity: 0; transform: translate(-50%, -50%) scale(1); }
      }
    `;
    document.head.appendChild(style);
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.remove();
      style.remove();
    }, 3000);
  }

  showRanksModal() {
    const ranks = [
      { name: 'SSS', title: 'Élu du Destin', min: 750, class: 'rank-sss', badge: '👑' },
      { name: 'SS', title: 'Maître du Flow', min: 700, class: 'rank-ss', badge: '💎' },
      { name: 'S', title: 'Sentinelle de l\'Ascension', min: 600, class: 'rank-s', badge: '⭐' },
      { name: 'A', title: 'Le Vétéran', min: 500, class: 'rank-a', badge: '🔥' },
      { name: 'B', title: 'Aventurier Régulier', min: 400, class: 'rank-b', badge: '🌟' },
      { name: 'C', title: 'Apprenti Motivé', min: 300, class: 'rank-c', badge: '⚡' },
      { name: 'D', title: 'Le Spectateur de Sa Vie', min: 200, class: 'rank-d', badge: '🎯' },
      { name: 'E', title: 'Paumé hésitant', min: 0, class: 'rank-e', badge: '🌱' }
    ];

    const ranksHtml = ranks.map(rank => {
      const isCurrentRank = this.data.rank === rank.name;
      const nextRankMin = ranks.find(r => r.name === rank.name)?.min || 0;
      const maxXP = rank.name === 'SSS' ? '∞' : (ranks[ranks.indexOf(rank) - 1]?.min - 1 || 749);
      
      return `
        <div class="rank-item ${rank.class} ${isCurrentRank ? 'current' : ''}">
          <div class="rank-badge">${rank.badge}</div>
          <div class="rank-title">Rang ${rank.name}</div>
          <div class="rank-subtitle">${rank.title}</div>
          <div class="rank-xp">${rank.min} - ${maxXP} XP</div>
          ${isCurrentRank ? '<div class="current-indicator">RANG ACTUEL</div>' : ''}
        </div>
      `;
    }).join('');

    this.showModal(`
      <div class="ranks-modal">
        <h2>🏆 Système de Rangs</h2>
        <p>Votre rang actuel : <strong>${this.data.rank}</strong> (${this.data.xp} XP)</p>
        <div class="ranks-grid">
          ${ranksHtml}
        </div>
      </div>
    `);
  }

  renderProjects() {
    const container = document.getElementById('projectsGrid');
    if (this.data.projects.length === 0) {
      container.innerHTML = `
        <div class="no-projects">
          <h3>Aucun projet créé</h3>
          <p>Créez votre premier projet pour commencer à tracker votre progression !</p>
        </div>
      `;
      return;
    }

    container.innerHTML = this.data.projects.map(project => `
      <div class="project-card">
        <h3>${project.name}</h3>
        <p>${project.description || 'Aucune description'}</p>
        <div class="project-stats">
          <div class="stat">
            <span class="stat-label">Temps passé</span>
            <span class="stat-value">${project.timeSpent || 0}h</span>
          </div>
          <div class="stat">
            <span class="stat-label">Objectif</span>
            <span class="stat-value">${project.timeGoal || 0}h</span>
          </div>
        </div>
        <div class="project-progress">
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${Math.min(100, ((project.timeSpent || 0) / (project.timeGoal || 1)) * 100)}%"></div>
          </div>
        </div>
      </div>
    `).join('');

    // Mettre à jour le sélecteur de projets
    this.updateProjectSelector();
  }

  updateProjectSelector() {
    const select = document.getElementById('projectSelect');
    select.innerHTML = '<option value="">Sélectionner un projet</option>';
    
    this.data.projects.forEach(project => {
      const option = document.createElement('option');
      option.value = project.id;
      option.textContent = project.name;
      select.appendChild(option);
    });
  }

  showProjectForm() {
    document.getElementById('projectForm').style.display = 'block';
  }

  cancelProject() {
    document.getElementById('projectForm').style.display = 'none';
    document.getElementById('projectName').value = '';
    document.getElementById('projectDescription').value = '';
    document.getElementById('projectTimeGoal').value = '';
  }

  saveProject() {
    const name = document.getElementById('projectName').value.trim();
    const description = document.getElementById('projectDescription').value.trim();
    const timeGoal = parseInt(document.getElementById('projectTimeGoal').value) || 0;

    if (!name) {
      this.showNotification('Le nom du projet est requis', 'warning');
      return;
    }

    const project = {
      id: Date.now().toString(),
      name: name,
      description: description,
      timeGoal: timeGoal,
      timeSpent: 0,
      createdAt: new Date().toISOString()
    };

    this.data.projects.push(project);
    this.saveData();
    this.cancelProject();
    this.renderProjects();
    this.showNotification('Projet créé avec succès !', 'success');
  }

  renderAchievements() {
    document.getElementById('achievementsContent').innerHTML = `
      <div class="achievements-placeholder">
        <h3>🏆 Système d'Achievements</h3>
        <p>Les achievements seront bientôt disponibles !</p>
      </div>
    `;
  }

  renderProgression() {
    document.getElementById('progressionContent').innerHTML = `
      <div class="progression-content">
        <div class="progression-header">
          <button class="btn-ranks" onclick="app.showRanksModal()">
            🏆 Les Rangs
          </button>
        </div>
        <div class="progression-placeholder">
          <h3>📈 Statistiques Détaillées</h3>
          <p>Les statistiques détaillées seront bientôt disponibles !</p>
        </div>
      </div>
    `;
  }

  renderSettings() {
    document.getElementById('settingsContent').innerHTML = `
      <div class="settings-placeholder">
        <h3>⚙️ Paramètres</h3>
        <p>Les paramètres seront bientôt disponibles !</p>
      </div>
    `;
  }

  updateUI() {
    // Mettre à jour l'XP et le rang
    document.getElementById('currentXP').textContent = this.data.xp;
    document.getElementById('dailyXP').textContent = this.data.dailyXP;
    
    // Mettre à jour le rang
    const ranks = [
      { name: 'E', title: 'Paumé hésitant', nextXP: 200 },
      { name: 'D', title: 'Le Spectateur de Sa Vie', nextXP: 300 },
      { name: 'C', title: 'Apprenti Motivé', nextXP: 400 },
      { name: 'B', title: 'Aventurier Régulier', nextXP: 500 },
      { name: 'A', title: 'Le Vétéran', nextXP: 600 },
      { name: 'S', title: 'Sentinelle de l\'Ascension', nextXP: 700 },
      { name: 'SS', title: 'Maître du Flow', nextXP: 750 },
      { name: 'SSS', title: 'Élu du Destin', nextXP: Infinity }
    ];

    const currentRankData = ranks.find(r => r.name === this.data.rank);
    if (currentRankData) {
      document.getElementById('rankName').textContent = currentRankData.title;
      document.getElementById('rankBadge').textContent = this.data.rank;
      document.getElementById('nextRankXP').textContent = currentRankData.nextXP === Infinity ? '∞' : currentRankData.nextXP;
    }

    // Mettre à jour la barre d'XP
    const currentRankIndex = ranks.findIndex(r => r.name === this.data.rank);
    const currentRankMin = currentRankIndex > 0 ? ranks[currentRankIndex - 1].nextXP : 0;
    const nextRankXP = currentRankData.nextXP;
    
    if (nextRankXP !== Infinity) {
      const progress = ((this.data.xp - currentRankMin) / (nextRankXP - currentRankMin)) * 100;
      document.getElementById('xpFill').style.width = `${Math.min(100, progress)}%`;
    } else {
      document.getElementById('xpFill').style.width = '100%';
    }

    // Mettre à jour le défi journalier
    const challengeProgress = Math.min(100, (this.data.dailyXP / 15) * 100);
    document.getElementById('challengeFill').style.width = `${challengeProgress}%`;
    document.getElementById('challengeStatus').textContent = `${this.data.dailyXP}/15 XP`;

    // Mettre à jour le taux d'intensité
    this.updateIntensityRate();
  }

  showModal(content) {
    document.getElementById('modal').innerHTML = content;
    document.getElementById('modalOverlay').style.display = 'flex';
  }

  closeModal() {
    document.getElementById('modalOverlay').style.display = 'none';
  }

  showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    document.getElementById('notifications').appendChild(notification);
    
    setTimeout(() => {
      notification.remove();
    }, 3000);
  }

  // Méthodes pour les actions quotidiennes
  logSport() {
    this.addXP(3);
    this.showNotification('Sport enregistré ! +3 XP', 'success');
  }

  showSleepModal() {
    this.showModal(`
      <div class="sleep-modal">
        <h3>😴 Enregistrer le Sommeil</h3>
        <div class="sleep-options">
          <button class="sleep-btn" onclick="app.logSleep(2)">
            Couché avant 22h (>7h de sommeil)<br>
            <span class="xp-reward">+2 XP</span>
          </button>
          <button class="sleep-btn" onclick="app.logSleep(1)">
            Couché avant minuit (>7h de sommeil)<br>
            <span class="xp-reward">+1 XP</span>
          </button>
        </div>
      </div>
    `);
  }

  logSleep(xp) {
    this.addXP(xp);
    this.closeModal();
    this.showNotification(`Sommeil enregistré ! +${xp} XP`, 'success');
  }

  showDistractionModal() {
    this.showModal(`
      <div class="distraction-modal">
        <h3>📱 Déclarer les Distractions</h3>
        <div class="distraction-options">
          <button class="distraction-btn" onclick="app.logDistraction(3)">
            Instagram +1h<br>
            <span class="xp-penalty">-3 XP</span>
          </button>
          <button class="distraction-btn" onclick="app.logDistraction(5)">
            Musique +1h30<br>
            <span class="xp-penalty">-5 XP</span>
          </button>
        </div>
      </div>
    `);
  }

  logDistraction(xp) {
    this.data.xp = Math.max(0, this.data.xp - xp);
    this.data.dailyXP = Math.max(0, this.data.dailyXP - xp);
    this.updateUI();
    this.saveData();
    this.closeModal();
    this.showNotification(`Distraction enregistrée ! -${xp} XP`, 'warning');
  }

  goToWeeklyReview() {
    this.showSection('weekly');
  }
}

// Initialiser l'application
const app = new MyRPGLifeApp();