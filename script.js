/* ==========================================================================
   JAVASCRIPT CORE LOGIC: LỊCH CÔNG VIỆC (PREMIUM PLANNER)
   SPA Client Routing, Calendar Render, Task CRUD, Telegram API Integration
   ========================================================================== */

// --- Global Application State ---
let tasks = [];
let deletedTasks = [];
let completedTasksHistory = [];
let settings = {
  darkMode: false,
  tgToken: '8360897240:AAGs-MjcWoG631uwEWuhW6a7ttYVHGhKrZQ',
  tgChatId: '6286372153',
  soundNotification: true,
  browserNotification: false,
  appPopupAlert: true
};

// Current Active Views
let activePage = 'dashboard';
let calendarSelectedDate = ''; // Format: YYYY-MM-DD
let calendarCurrentMonth = new Date().getMonth(); // 0-11
let calendarCurrentYear = new Date().getFullYear();
let activeCategoryFilter = ''; // for viewing category tasks

// In-memory cache to prevent race-condition double trigger in same second
const triggeredThisMinute = new Set();

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
  loadDataFromLocalStorage();
  initTheme();
  initClock();
  initRouting();
  initCalendar();
  initTaskForm();
  initSettingsPanel();
  initHistoryPanel();
  initSearchAndFilters();
  startScheduler();
  setupRippleEffects();
  setupMobileSidebar();
  
  // Request Notification permission if enabled
  if (settings.browserNotification) {
    requestNotificationPermission();
  }
  
  // Render initial dashboard/calendar views
  renderDashboard();
  renderCalendar();
  renderCategoriesGrid();
});

// --- LocalStorage Utilities ---
function saveDataToLocalStorage() {
  localStorage.setItem('lcv_tasks', JSON.stringify(tasks));
  localStorage.setItem('lcv_deleted_tasks', JSON.stringify(deletedTasks));
  localStorage.setItem('lcv_settings', JSON.stringify(settings));
}

function loadDataFromLocalStorage() {
  try {
    const savedTasks = localStorage.getItem('lcv_tasks');
    const savedDeleted = localStorage.getItem('lcv_deleted_tasks');
    const savedSettings = localStorage.getItem('lcv_settings');
    
    if (savedTasks) tasks = JSON.parse(savedTasks);
    else tasks = getMockTasks(); // Seed with mock data if fresh install
    
    if (savedDeleted) deletedTasks = JSON.parse(savedDeleted);
    if (savedSettings) {
      settings = { ...settings, ...JSON.parse(savedSettings) };
    }
    
    // Set default selected date to today
    const today = new Date();
    calendarSelectedDate = formatDateString(today);
  } catch (e) {
    console.error("Lỗi đọc LocalStorage. Khởi tạo dữ liệu mặc định.", e);
    tasks = getMockTasks();
  }
}

// --- Mock Data Seed ---
function getMockTasks() {
  const today = new Date();
  const todayStr = formatDateString(today);
  
  // Generate mock tasks on today and tomorrow
  const t1Time = new Date(today.getTime() + 10 * 60000); // 10 mins from now
  const t1HourStr = String(t1Time.getHours()).padStart(2, '0') + ':' + String(t1Time.getMinutes()).padStart(2, '0');
  
  return [
    {
      id: 'task-mock-1',
      name: 'Học lập trình Python cơ bản',
      desc: 'Học cú pháp cấu trúc điều kiện, vòng lặp và làm bài tập thực hành chương 2.',
      category: 'Học tập',
      priority: 'Cao',
      date: todayStr,
      time: t1HourStr,
      color: '#3b82f6',
      repeat: 'none',
      status: 'Chưa bắt đầu',
      tgReminderSent: false,
      tgMessageId: null,
      createdAt: new Date().toISOString()
    },
    {
      id: 'task-mock-2',
      name: 'Họp tiến độ dự án tuần',
      desc: 'Báo cáo phần giao diện quản lý lịch công việc cho khách hàng.',
      category: 'Công việc',
      priority: 'Trung bình',
      date: todayStr,
      time: '14:30',
      color: '#10b981',
      repeat: 'weekly',
      status: 'Đang thực hiện',
      tgReminderSent: false,
      tgMessageId: null,
      createdAt: new Date().toISOString()
    },
    {
      id: 'task-mock-3',
      name: 'Mua thực phẩm & rau xanh',
      desc: 'Mua cà chua, xà lách, thịt bò và trứng chuẩn bị cho bữa tối gia đình.',
      category: 'Gia đình',
      priority: 'Thấp',
      date: todayStr,
      time: '18:00',
      color: '#ec4899',
      repeat: 'none',
      status: 'Chưa bắt đầu',
      tgReminderSent: false,
      tgMessageId: null,
      createdAt: new Date().toISOString()
    }
  ];
}

// --- Live Clock & Greetings ---
function initClock() {
  const timeEl = document.getElementById('live-time');
  const dateEl = document.getElementById('live-date');
  const greetingEl = document.getElementById('dashboard-greeting');
  
  const weekdays = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
  
  function updateTime() {
    const now = new Date();
    
    // Time string HH:MM:SS
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    const s = String(now.getSeconds()).padStart(2, '0');
    timeEl.textContent = `${h}:${m}:${s}`;
    
    // Date string: Thứ X, DD/MM/YYYY
    const dayName = weekdays[now.getDay()];
    const dateStr = String(now.getDate()).padStart(2, '0');
    const monthStr = String(now.getMonth() + 1).padStart(2, '0');
    const yearStr = now.getFullYear();
    dateEl.textContent = `${dayName}, ${dateStr}/${monthStr}/${yearStr}`;
    
    // Welcome Greeting dynamic based on hour
    const hr = now.getHours();
    let greeting = 'Xin chào!';
    if (hr >= 5 && hr < 12) {
      greeting = 'Chào buổi sáng!';
    } else if (hr >= 12 && hr < 18) {
      greeting = 'Chào buổi chiều!';
    } else if (hr >= 18 && hr < 22) {
      greeting = 'Chào buổi tối!';
    } else {
      greeting = 'Đêm muộn rồi, nghỉ ngơi thôi!';
    }
    if (greetingEl) greetingEl.textContent = greeting;
  }
  
  updateTime();
  setInterval(updateTime, 1000);
}

// --- SPA Client Routing ---
function initRouting() {
  const navItems = document.querySelectorAll('.nav-item');
  const panels = document.querySelectorAll('.page-panel');
  const pageTitle = document.getElementById('page-title');
  
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const page = item.getAttribute('data-page');
      switchPage(page);
      
      // Close mobile sidebar on routing click
      document.getElementById('sidebar').classList.remove('active');
      document.getElementById('sidebar-overlay').classList.remove('active');
    });
  });
  
  // Dashboard stats card navigation hooks
  document.querySelectorAll('.stats-card').forEach(card => {
    card.addEventListener('click', () => {
      const filter = card.getAttribute('data-filter');
      switchPage('calendar');
      
      // Select status filter corresponding to card clicked
      const statusSelect = document.getElementById('filter-status');
      if (filter === 'completed') statusSelect.value = 'Hoàn thành';
      else if (filter === 'pending') statusSelect.value = 'Chưa bắt đầu'; // or đang thực hiện
      else if (filter === 'overdue') statusSelect.value = 'Quá hạn';
      else statusSelect.value = 'all';
      
      triggerFiltering();
    });
  });
}

function switchPage(pageId) {
  activePage = pageId;
  
  // Toggle nav links active states
  document.querySelectorAll('.nav-item').forEach(btn => {
    if (btn.getAttribute('data-page') === pageId) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
  
  // Toggle panel visibility
  document.querySelectorAll('.page-panel').forEach(panel => {
    if (panel.id === `page-${pageId}`) {
      panel.classList.add('active');
    } else {
      panel.classList.remove('active');
    }
  });
  
  // Update navbar page title text
  const titles = {
    'dashboard': 'Trang chủ',
    'calendar': 'Lịch hôm nay',
    'categories': 'Danh mục',
    'history': 'Lịch sử',
    'settings': 'Cài đặt',
    'about': 'Giới thiệu'
  };
  document.getElementById('page-title').textContent = titles[pageId] || 'Lịch Công Việc';
  
  // Trigger appropriate renders
  if (pageId === 'dashboard') {
    renderDashboard();
  } else if (pageId === 'calendar') {
    renderCalendar();
    renderTaskList();
  } else if (pageId === 'categories') {
    // Return to grid list automatically
    document.getElementById('categories-grid-container').style.display = 'grid';
    document.getElementById('selected-category-section').style.display = 'none';
    renderCategoriesGrid();
  } else if (pageId === 'history') {
    renderHistory();
  }
  
  // Scroll main view to top
  document.querySelector('.main-content').scrollTop = 0;
}

// --- Theme Switcher Logic ---
function initTheme() {
  const sidebarThemeToggle = document.getElementById('theme-toggle-sidebar');
  const settingsDarkModeCheckbox = document.getElementById('setting-dark-mode');
  
  // Apply initial theme
  applyTheme(settings.darkMode);
  
  // Hook sidebar toggle
  sidebarThemeToggle.addEventListener('click', () => {
    settings.darkMode = !settings.darkMode;
    applyTheme(settings.darkMode);
    saveDataToLocalStorage();
    if (settingsDarkModeCheckbox) settingsDarkModeCheckbox.checked = settings.darkMode;
  });
  
  // Hook settings page checkbox
  if (settingsDarkModeCheckbox) {
    settingsDarkModeCheckbox.checked = settings.darkMode;
    settingsDarkModeCheckbox.addEventListener('change', (e) => {
      settings.darkMode = e.target.checked;
      applyTheme(settings.darkMode);
      saveDataToLocalStorage();
    });
  }
}

function applyTheme(isDark) {
  if (isDark) {
    document.body.classList.remove('light-mode');
    document.body.classList.add('dark-mode');
  } else {
    document.body.classList.remove('dark-mode');
    document.body.classList.add('light-mode');
  }
}

// --- Mobile Sidebar Toggle ---
function setupMobileSidebar() {
  const menuBtn = document.getElementById('menu-toggle-btn');
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  
  menuBtn.addEventListener('click', () => {
    sidebar.classList.toggle('active');
    overlay.classList.toggle('active');
  });
  
  overlay.addEventListener('click', () => {
    sidebar.classList.remove('active');
    overlay.classList.remove('active');
  });
}

// --- Button Ripple Effects ---
function setupRippleEffects() {
  const buttons = document.querySelectorAll('.btn, .nav-item, .stats-card, .category-card');
  
  buttons.forEach(button => {
    button.addEventListener('click', function(e) {
      const rect = this.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      const ripple = document.createElement('span');
      ripple.classList.add('ripple');
      ripple.style.left = `${x}px`;
      ripple.style.top = `${y}px`;
      
      this.appendChild(ripple);
      
      setTimeout(() => {
        ripple.remove();
      }, 600);
    });
  });
}

// --- Dashboard Rendering ---
function renderDashboard() {
  const todayStr = formatDateString(new Date());
  
  // Filter active tasks today (excluding deleted)
  const todayTasks = tasks.filter(t => t.date === todayStr);
  const totalToday = todayTasks.length;
  
  // Computed stats
  const completedToday = todayTasks.filter(t => t.status === 'Hoàn thành').length;
  const pendingToday = todayTasks.filter(t => t.status === 'Chưa bắt đầu' || t.status === 'Đang thực hiện').length;
  const overdueToday = todayTasks.filter(t => t.status === 'Quá hạn' || (t.status !== 'Hoàn thành' && isTaskOverdue(t))).length;
  
  // Render counters
  document.getElementById('stat-today-val').textContent = totalToday;
  document.getElementById('stat-completed-val').textContent = completedToday;
  document.getElementById('stat-pending-val').textContent = pendingToday;
  document.getElementById('stat-overdue-val').textContent = overdueToday;
  
  // Completion percentage
  const pct = totalToday > 0 ? Math.round((completedToday / totalToday) * 100) : 0;
  document.getElementById('stat-completed-pct').textContent = `${pct}% tỷ lệ hoàn thành`;
  
  // Render Today Timeline List
  renderTodayTimeline(todayTasks);
  
  // Render Upcoming Reminders
  renderUpcomingReminders();
}

function isTaskOverdue(task) {
  if (task.status === 'Hoàn thành') return false;
  const taskDateTime = new Date(`${task.date}T${task.time}`);
  const now = new Date();
  return taskDateTime < now;
}

function renderTodayTimeline(todayTasks) {
  const container = document.getElementById('dashboard-timeline');
  if (todayTasks.length === 0) {
    container.innerHTML = `<div class="timeline-empty">Không có công việc nào trong ngày hôm nay. Hãy bắt đầu bằng cách thêm một công việc mới!</div>`;
    return;
  }
  
  // Sort tasks chronologically by time
  const sorted = [...todayTasks].sort((a, b) => a.time.localeCompare(b.time));
  
  container.innerHTML = sorted.map(task => {
    const isCompleted = task.status === 'Hoàn thành';
    const overdue = isTaskOverdue(task);
    
    let statusClass = 'badge-todo';
    if (isCompleted) statusClass = 'badge-done';
    else if (overdue) statusClass = 'badge-overdue';
    else if (task.status === 'Đang thực hiện') statusClass = 'badge-in-progress';
    
    // Category colors
    const catColors = {
      'Học tập': 'var(--cat-study)',
      'Công việc': 'var(--cat-work)',
      'Cá nhân': 'var(--cat-personal)',
      'Gia đình': 'var(--cat-family)',
      'Sức khỏe': 'var(--cat-health)',
      'Khác': 'var(--cat-other)'
    };
    const catColor = catColors[task.category] || 'var(--cat-other)';
    
    return `
      <div class="timeline-item">
        <div class="timeline-dot" style="border-color: ${catColor}; ${isCompleted ? `background-color: ${catColor};` : ''}"></div>
        <div class="timeline-card" onclick="openEditTaskModal('${task.id}')" style="border-left: 4px solid ${catColor}">
          <div class="timeline-time">${task.time}</div>
          <div class="timeline-info">
            <h4 class="timeline-title" style="${isCompleted ? 'text-decoration: line-through; opacity: 0.6;' : ''}">${escapeHTML(task.name)}</h4>
            <div class="timeline-meta">
              <span class="timeline-cat-badge" style="background-color: ${catColor}15; color: ${catColor}">${task.category}</span>
              <span class="badge ${statusClass} select-sm">${isCompleted ? 'Đã hoàn thành' : (overdue ? 'Quá hạn' : task.status)}</span>
            </div>
          </div>
          <div class="custom-checkbox-wrapper" onclick="event.stopPropagation(); toggleTaskCompletion('${task.id}')">
            <div class="task-checkbox-container ${isCompleted ? 'checked' : ''}">
              <div class="custom-checkbox"></div>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function renderUpcomingReminders() {
  const container = document.getElementById('dashboard-upcoming');
  const now = new Date();
  
  // Find all unfinished tasks with scheduled times in the future (today or later)
  const upcoming = tasks.filter(t => {
    if (t.status === 'Hoàn thành') return false;
    const taskDateTime = new Date(`${t.date}T${t.time}`);
    return taskDateTime > now;
  });
  
  if (upcoming.length === 0) {
    container.innerHTML = `<div class="upcoming-empty">Không có công việc sắp tới cần nhắc nhở.</div>`;
    return;
  }
  
  // Sort by task date & time closest first
  upcoming.sort((a, b) => {
    const dtA = new Date(`${a.date}T${a.time}`);
    const dtB = new Date(`${b.date}T${b.time}`);
    return dtA - dtB;
  });
  
  // Limit to top 5 upcoming
  const topUpcoming = upcoming.slice(0, 5);
  
  container.innerHTML = topUpcoming.map(task => {
    const taskDateTime = new Date(`${task.date}T${task.time}`);
    const diffMs = taskDateTime - now;
    const diffMins = Math.round(diffMs / 60000);
    
    let countdownStr = '';
    if (diffMins < 60) {
      countdownStr = `trong ${diffMins} phút`;
    } else {
      const diffHours = Math.floor(diffMins / 60);
      const remMins = diffMins % 60;
      countdownStr = `trong ${diffHours}g ${remMins > 0 ? remMins + 'p' : ''}`;
    }
    
    // Category colors
    const catColors = {
      'Học tập': 'var(--cat-study)',
      'Công việc': 'var(--cat-work)',
      'Cá nhân': 'var(--cat-personal)',
      'Gia đình': 'var(--cat-family)',
      'Sức khỏe': 'var(--cat-health)',
      'Khác': 'var(--cat-other)'
    };
    const catColor = catColors[task.category] || 'var(--cat-other)';
    
    return `
      <div class="upcoming-card" onclick="openEditTaskModal('${task.id}')" style="border-left-color: ${catColor}">
        <div class="upcoming-time-box">
          <div class="upcoming-hour" style="color: ${catColor}">${task.time}</div>
          <div class="upcoming-countdown">${countdownStr}</div>
        </div>
        <div class="upcoming-info">
          <h4 class="upcoming-title">${escapeHTML(task.name)}</h4>
          <span class="upcoming-date">${formatDateVN(task.date)}</span>
        </div>
      </div>
    `;
  }).join('');
}

// --- Calendar View Implementation ---
function initCalendar() {
  const prevBtn = document.getElementById('btn-cal-prev');
  const nextBtn = document.getElementById('btn-cal-next');
  
  prevBtn.addEventListener('click', () => {
    calendarCurrentMonth--;
    if (calendarCurrentMonth < 0) {
      calendarCurrentMonth = 11;
      calendarCurrentYear--;
    }
    renderCalendar();
  });
  
  nextBtn.addEventListener('click', () => {
    calendarCurrentMonth++;
    if (calendarCurrentMonth > 11) {
      calendarCurrentMonth = 0;
      calendarCurrentYear++;
    }
    renderCalendar();
  });
}

function renderCalendar() {
  const titleEl = document.getElementById('calendar-title');
  const daysContainer = document.getElementById('calendar-days');
  
  const monthNames = ['Tháng 01', 'Tháng 02', 'Tháng 03', 'Tháng 04', 'Tháng 05', 'Tháng 06', 'Tháng 07', 'Tháng 08', 'Tháng 09', 'Tháng 10', 'Tháng 11', 'Tháng 12'];
  titleEl.textContent = `${monthNames[calendarCurrentMonth]}, ${calendarCurrentYear}`;
  
  // Get first day of the month and total days
  const firstDayIndex = new Date(calendarCurrentYear, calendarCurrentMonth, 1).getDay(); // 0 is Sunday
  const totalDays = new Date(calendarCurrentYear, calendarCurrentMonth + 1, 0).getDate();
  const prevTotalDays = new Date(calendarCurrentYear, calendarCurrentMonth, 0).getDate();
  
  let daysHTML = '';
  
  // Render empty cells for previous month padding
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    const day = prevTotalDays - i;
    const padMonth = calendarCurrentMonth === 0 ? 11 : calendarCurrentMonth - 1;
    const padYear = calendarCurrentMonth === 0 ? calendarCurrentYear - 1 : calendarCurrentYear;
    const padDateStr = `${padYear}-${String(padMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    
    daysHTML += renderCalendarDayCell(day, padDateStr, true);
  }
  
  // Render active month days
  for (let d = 1; d <= totalDays; d++) {
    const dateStr = `${calendarCurrentYear}-${String(calendarCurrentMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    daysHTML += renderCalendarDayCell(d, dateStr, false);
  }
  
  // Render next month padding to make full grid grid cells (typically multiples of 7, let's complete to 42 cells)
  const totalRendered = firstDayIndex + totalDays;
  const nextMonthPadding = 42 - totalRendered;
  
  for (let n = 1; n <= nextMonthPadding; n++) {
    const padMonth = calendarCurrentMonth === 11 ? 0 : calendarCurrentMonth + 1;
    const padYear = calendarCurrentMonth === 11 ? calendarCurrentYear + 1 : calendarCurrentYear;
    const padDateStr = `${padYear}-${String(padMonth + 1).padStart(2, '0')}-${String(n).padStart(2, '0')}`;
    
    daysHTML += renderCalendarDayCell(n, padDateStr, true);
  }
  
  daysContainer.innerHTML = daysHTML;
  
  // Hook cell click listeners
  document.querySelectorAll('.calendar-day:not(.empty-day)').forEach(cell => {
    cell.addEventListener('click', () => {
      const selectedDate = cell.getAttribute('data-date');
      calendarSelectedDate = selectedDate;
      
      // Update selected class
      document.querySelectorAll('.calendar-day').forEach(c => c.classList.remove('selected-day'));
      cell.classList.add('selected-day');
      
      // Update label and tasks lists
      updateSelectedDayLabel();
      renderTaskList();
    });
  });
  
  updateSelectedDayLabel();
}

function renderCalendarDayCell(dayNum, dateStr, isOtherMonth) {
  const todayStr = formatDateString(new Date());
  const isToday = dateStr === todayStr;
  const isSelected = dateStr === calendarSelectedDate;
  
  let classes = 'calendar-day';
  if (isOtherMonth) classes += ' other-month';
  if (isToday) classes += ' current-day';
  if (isSelected) classes += ' selected-day';
  
  // Check tasks for indicators
  const dayTasks = tasks.filter(t => t.date === dateStr);
  let indicatorHTML = '';
  
  if (dayTasks.length > 0) {
    indicatorHTML += '<div class="day-indicators-row">';
    // Unique categories colors for the day
    const categoriesOnDay = [...new Set(dayTasks.map(t => t.category))].slice(0, 4); // Limit to max 4 dots
    
    const catColors = {
      'Học tập': 'var(--cat-study)',
      'Công việc': 'var(--cat-work)',
      'Cá nhân': 'var(--cat-personal)',
      'Gia đình': 'var(--cat-family)',
      'Sức khỏe': 'var(--cat-health)',
      'Khác': 'var(--cat-other)'
    };
    
    categoriesOnDay.forEach(cat => {
      const color = catColors[cat] || 'var(--cat-other)';
      indicatorHTML += `<span class="dot-indicator" style="background-color: ${color}"></span>`;
    });
    
    indicatorHTML += '</div>';
  }
  
  return `
    <div class="${classes}" data-date="${dateStr}">
      <span>${dayNum}</span>
      ${indicatorHTML}
    </div>
  `;
}

function updateSelectedDayLabel() {
  const labelEl = document.getElementById('cal-selected-day-label');
  const countEl = document.getElementById('cal-selected-day-count');
  
  const todayStr = formatDateString(new Date());
  const selectedDateParts = calendarSelectedDate.split('-');
  
  let displayTitle = '';
  if (calendarSelectedDate === todayStr) {
    displayTitle = 'Hôm nay';
  } else {
    displayTitle = formatDateVN(calendarSelectedDate);
  }
  
  labelEl.textContent = `${displayTitle} - ${formatDateVN(calendarSelectedDate)}`;
  
  // Count tasks
  const count = tasks.filter(t => t.date === calendarSelectedDate).length;
  countEl.textContent = `${count} công việc`;
}

// --- Task CRUD and List Display ---
function renderTaskList() {
  const container = document.getElementById('calendar-task-list');
  
  // Filter tasks based on selected day and filters
  let filtered = tasks.filter(t => t.date === calendarSelectedDate);
  
  // Apply search query
  const query = document.getElementById('task-search-input').value.toLowerCase().trim();
  if (query) {
    filtered = filtered.filter(t => 
      t.name.toLowerCase().includes(query) || 
      t.desc.toLowerCase().includes(query)
    );
  }
  
  // Apply select filters
  const categoryFilter = document.getElementById('filter-category').value;
  if (categoryFilter !== 'all') {
    filtered = filtered.filter(t => t.category === categoryFilter);
  }
  
  const priorityFilter = document.getElementById('filter-priority').value;
  if (priorityFilter !== 'all') {
    filtered = filtered.filter(t => t.priority === priorityFilter);
  }
  
  const statusFilter = document.getElementById('filter-status').value;
  if (statusFilter !== 'all') {
    if (statusFilter === 'Quá hạn') {
      filtered = filtered.filter(t => t.status === 'Quá hạn' || (t.status !== 'Hoàn thành' && isTaskOverdue(t)));
    } else {
      filtered = filtered.filter(t => t.status === statusFilter);
    }
  }
  
  // Apply Sort options
  const sortOption = document.getElementById('sort-tasks').value;
  sortTasksList(filtered, sortOption);
  
  // Render html
  if (filtered.length === 0) {
    container.innerHTML = `<div class="tasks-empty">Không tìm thấy công việc nào.</div>`;
    return;
  }
  
  container.innerHTML = filtered.map(task => renderSingleTaskCard(task)).join('');
}

function sortTasksList(taskList, sortBy) {
  if (sortBy === 'time') {
    // Chronological by time
    taskList.sort((a, b) => a.time.localeCompare(b.time));
  } else if (sortBy === 'newest') {
    // Reverse chronological creation
    taskList.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  } else if (sortBy === 'oldest') {
    // Chronological creation
    taskList.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  } else if (sortBy === 'priority') {
    // High -> Med -> Low
    const pWeight = { 'Cao': 3, 'Trung bình': 2, 'Thấp': 1 };
    taskList.sort((a, b) => (pWeight[b.priority] || 0) - (pWeight[a.priority] || 0));
  } else if (sortBy === 'completed') {
    // Completed tasks sorted to bottom
    taskList.sort((a, b) => {
      const aDone = a.status === 'Hoàn thành' ? 1 : 0;
      const bDone = b.status === 'Hoàn thành' ? 1 : 0;
      return aDone - bDone;
    });
  }
}

function renderSingleTaskCard(task) {
  const isCompleted = task.status === 'Hoàn thành';
  const overdue = isTaskOverdue(task);
  
  let statusBadge = '';
  let statusClass = 'badge-todo';
  if (isCompleted) {
    statusBadge = 'Đã hoàn thành';
    statusClass = 'badge-done';
  } else if (overdue) {
    statusBadge = 'Quá hạn';
    statusClass = 'badge-overdue';
  } else {
    statusBadge = task.status;
    if (task.status === 'Đang thực hiện') statusClass = 'badge-in-progress';
  }
  
  // Category colors
  const catColors = {
    'Học tập': 'var(--cat-study)',
    'Công việc': 'var(--cat-work)',
    'Cá nhân': 'var(--cat-personal)',
    'Gia đình': 'var(--cat-family)',
    'Sức khỏe': 'var(--cat-health)',
    'Khác': 'var(--cat-other)'
  };
  const catColor = catColors[task.category] || 'var(--cat-other)';
  
  return `
    <div class="task-item-card" style="border-left: 5px solid ${task.color || catColor}">
      <div class="task-item-top">
        <div class="task-checkbox-container ${isCompleted ? 'checked' : ''}" onclick="toggleTaskCompletion('${task.id}')">
          <div class="custom-checkbox-wrapper">
            <div class="custom-checkbox"></div>
          </div>
          <div class="task-title-area">
            <h4 class="task-card-title">${escapeHTML(task.name)}</h4>
            ${task.desc ? `<p class="task-card-desc">${escapeHTML(task.desc)}</p>` : ''}
          </div>
        </div>
        
        <span class="badge ${statusClass}">${statusBadge}</span>
      </div>
      
      <div class="task-item-bottom">
        <div class="task-meta-info">
          <span class="timeline-cat-badge" style="background-color: ${catColor}15; color: ${catColor}">${task.category}</span>
          <span class="priority-flag">
            <span class="priority-dot p-${task.priority.replace(/\s+/g, '')}"></span>
            Ưu tiên ${task.priority}
          </span>
          <span class="task-time-val">${task.time}</span>
          ${task.repeat !== 'none' ? `<span class="task-repeat-badge">↻ lặp lại</span>` : ''}
        </div>
        
        <div class="task-card-actions">
          <button class="btn-card-action" onclick="openEditTaskModal('${task.id}')" aria-label="Chỉnh sửa">
            <span class="css-icon icon-edit"></span>
          </button>
          <button class="btn-card-action action-delete" onclick="openDeleteConfirmModal('${task.id}')" aria-label="Xóa">
            <span class="css-icon icon-delete"></span>
          </button>
        </div>
      </div>
    </div>
  `;
}

// --- Task Form & Modal Logic ---
function initTaskForm() {
  const taskModal = document.getElementById('task-modal');
  const taskForm = document.getElementById('task-form');
  const btnQuickAdd = document.getElementById('btn-quick-add');
  const fabAdd = document.getElementById('fab-add-task');
  const btnCancelTask = document.getElementById('btn-cancel-task');
  const btnCloseModal = document.getElementById('btn-close-task-modal');
  const colorInput = document.getElementById('task-color');
  const colorValPreview = document.getElementById('color-preview-val');
  
  // Dynamic color preview update
  colorInput.addEventListener('input', (e) => {
    colorValPreview.textContent = e.target.value;
  });
  
  // Show modal for adding
  const triggerAddModal = () => {
    document.getElementById('task-id').value = '';
    taskForm.reset();
    
    // Set default dates & times
    const now = new Date();
    document.getElementById('task-date').value = formatDateString(now);
    
    // Set hour + 5 mins
    const future = new Date(now.getTime() + 5 * 60000);
    document.getElementById('task-time').value = String(future.getHours()).padStart(2, '0') + ':' + String(future.getMinutes()).padStart(2, '0');
    
    // Default color matching category
    document.getElementById('task-color').value = '#7c3aed';
    colorValPreview.textContent = '#7c3aed';
    
    document.getElementById('modal-title').textContent = 'Thêm công việc mới';
    document.getElementById('task-status-edit-group').style.display = 'none';
    
    taskModal.classList.add('active');
  };
  
  btnQuickAdd.addEventListener('click', triggerAddModal);
  fabAdd.addEventListener('click', triggerAddModal);
  
  // Dismiss modals
  const dismissModal = () => {
    taskModal.classList.remove('active');
  };
  btnCancelTask.addEventListener('click', dismissModal);
  btnCloseModal.addEventListener('click', dismissModal);
  
  // Form submission
  taskForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const id = document.getElementById('task-id').value;
    const name = document.getElementById('task-name').value.trim();
    const desc = document.getElementById('task-desc').value.trim();
    const category = document.getElementById('task-category').value;
    const priority = document.getElementById('task-priority').value;
    const date = document.getElementById('task-date').value;
    const time = document.getElementById('task-time').value;
    const color = document.getElementById('task-color').value;
    const repeat = document.getElementById('task-repeat').value;
    
    if (id) {
      // Edit mode
      const idx = tasks.findIndex(t => t.id === id);
      if (idx !== -1) {
        const oldStatus = tasks[idx].status;
        const newStatus = document.getElementById('task-status').value;
        
        // If status changed to completed, call toggle completion
        if (newStatus === 'Hoàn thành' && oldStatus !== 'Hoàn thành') {
          tasks[idx].status = 'Hoàn thành';
          handleTaskCompletedTrigger(tasks[idx]);
        } else {
          tasks[idx].status = newStatus;
        }
        
        tasks[idx].name = name;
        tasks[idx].desc = desc;
        tasks[idx].category = category;
        tasks[idx].priority = priority;
        tasks[idx].date = date;
        tasks[idx].time = time;
        tasks[idx].color = color;
        tasks[idx].repeat = repeat;
        
        showToast('Đã cập nhật công việc thành công!');
      }
    } else {
      // Add mode
      const newTask = {
        id: 'task-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
        name,
        desc,
        category,
        priority,
        date,
        time,
        color,
        repeat,
        status: 'Chưa bắt đầu',
        tgReminderSent: false,
        tgMessageId: null,
        createdAt: new Date().toISOString()
      };
      
      tasks.push(newTask);
      showToast('Đã tạo công việc mới thành công!');
    }
    
    saveDataToLocalStorage();
    dismissModal();
    
    // Refresh page states
    if (activePage === 'dashboard') renderDashboard();
    else if (activePage === 'calendar') {
      renderCalendar();
      renderTaskList();
    } else if (activePage === 'categories') {
      renderCategoriesGrid();
      if (activeCategoryFilter) renderCategoryTaskList(activeCategoryFilter);
    }
  });
}

function openEditTaskModal(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  
  document.getElementById('task-id').value = task.id;
  document.getElementById('task-name').value = task.name;
  document.getElementById('task-desc').value = task.desc || '';
  document.getElementById('task-category').value = task.category;
  document.getElementById('task-priority').value = task.priority;
  document.getElementById('task-date').value = task.date;
  document.getElementById('task-time').value = task.time;
  document.getElementById('task-color').value = task.color || '#7c3aed';
  document.getElementById('color-preview-val').textContent = task.color || '#7c3aed';
  document.getElementById('task-repeat').value = task.repeat;
  
  // Pop status select row
  const statusGroup = document.getElementById('task-status-edit-group');
  statusGroup.style.display = 'block';
  document.getElementById('task-status').value = task.status;
  
  document.getElementById('modal-title').textContent = 'Chỉnh sửa công việc';
  document.getElementById('task-modal').classList.add('active');
}

// --- Delete Modal Logic ---
let taskIdToDelete = '';

function initSearchAndFilters() {
  const deleteModal = document.getElementById('delete-modal');
  const btnCancelDelete = document.getElementById('btn-cancel-delete');
  const btnConfirmDelete = document.getElementById('btn-confirm-delete');
  const btnCloseDelete = document.getElementById('btn-close-delete-modal');
  
  const dismissDelete = () => {
    deleteModal.classList.remove('active');
    taskIdToDelete = '';
  };
  
  btnCancelDelete.addEventListener('click', dismissDelete);
  btnCloseDelete.addEventListener('click', dismissDelete);
  
  btnConfirmDelete.addEventListener('click', () => {
    if (taskIdToDelete) {
      const idx = tasks.findIndex(t => t.id === taskIdToDelete);
      if (idx !== -1) {
        const deleted = tasks.splice(idx, 1)[0];
        
        // Log in trash history
        deleted.deletedAt = new Date().toISOString();
        deletedTasks.push(deleted);
        
        saveDataToLocalStorage();
        showToast(`Đã xóa công việc "${deleted.name}" vào Thùng rác`);
        
        if (activePage === 'dashboard') renderDashboard();
        else if (activePage === 'calendar') {
          renderCalendar();
          renderTaskList();
        } else if (activePage === 'categories') {
          renderCategoriesGrid();
          if (activeCategoryFilter) renderCategoryTaskList(activeCategoryFilter);
        }
      }
    }
    dismissDelete();
  });
  
  // Real-time search and filter change hooks
  document.getElementById('task-search-input').addEventListener('input', (e) => {
    const clearBtn = document.getElementById('search-clear-btn');
    if (e.target.value) {
      clearBtn.style.display = 'block';
    } else {
      clearBtn.style.display = 'none';
    }
    renderTaskList();
  });
  
  document.getElementById('search-clear-btn').addEventListener('click', () => {
    const input = document.getElementById('task-search-input');
    input.value = '';
    document.getElementById('search-clear-btn').style.display = 'none';
    renderTaskList();
  });
  
  document.getElementById('filter-category').addEventListener('change', renderTaskList);
  document.getElementById('filter-priority').addEventListener('change', renderTaskList);
  document.getElementById('filter-status').addEventListener('change', renderTaskList);
  document.getElementById('sort-tasks').addEventListener('change', renderTaskList);
}

function openDeleteConfirmModal(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  
  taskIdToDelete = id;
  document.getElementById('delete-task-name').textContent = task.name;
  document.getElementById('delete-modal').classList.add('active');
}

// --- Toggle Checkbox Completion Logic ---
function toggleTaskCompletion(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  
  const originalStatus = task.status;
  
  if (task.status === 'Hoàn thành') {
    // If it was cloned from a repeating task, it won't have repeat.
    task.status = 'Chưa bắt đầu';
    task.completedAt = null;
    showToast('Đã đánh dấu công việc là chưa hoàn thành');
  } else {
    task.status = 'Hoàn thành';
    task.completedAt = new Date().toISOString();
    
    // Play sound and completed action trigger
    handleTaskCompletedTrigger(task);
    
    // Handle Repeating tasks: clone for history, move original to next date
    if (task.repeat && task.repeat !== 'none') {
      const nextDate = calculateNextRepeatDate(task.date, task.repeat);
      if (nextDate) {
        // 1. Create a static completed clone of the task for current date
        const completedClone = {
          ...task,
          id: 'task-completed-ref-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
          repeat: 'none', // clone is static
          tgMessageId: null, // do not link message to clone
          createdAt: new Date().toISOString()
        };
        
        // 2. Push clone to tasks list (it will remain as completed on this day)
        tasks.push(completedClone);
        
        // 3. Move the original repeating task to the next date and reset it
        task.date = nextDate;
        task.status = 'Chưa bắt đầu';
        task.completedAt = null;
        task.tgReminderSent = false;
        task.tgMessageId = null;
        
        showToast(`Lịch tiếp theo được lên vào ngày ${formatDateVN(nextDate)}`);
      }
    }
  }
  
  saveDataToLocalStorage();
  
  // Refresh views
  if (activePage === 'dashboard') renderDashboard();
  else if (activePage === 'calendar') {
    renderCalendar();
    renderTaskList();
  } else if (activePage === 'categories') {
    renderCategoriesGrid();
    if (activeCategoryFilter) renderCategoryTaskList(activeCategoryFilter);
  }
}

function calculateNextRepeatDate(dateStr, repeatType) {
  const parts = dateStr.split('-');
  if (parts.length !== 3) return null;
  
  const year = parseInt(parts[0]);
  const month = parseInt(parts[1]) - 1;
  const day = parseInt(parts[2]);
  
  const date = new Date(year, month, day);
  
  if (repeatType === 'daily') {
    date.setDate(date.getDate() + 1);
  } else if (repeatType === 'weekly') {
    date.setDate(date.getDate() + 7);
  } else if (repeatType === 'monthly') {
    date.setMonth(date.getMonth() + 1);
  }
  
  return formatDateString(date);
}

// Completed sound play + Send Completed notify (with delete reminder)
function handleTaskCompletedTrigger(task) {
  playNotificationSound();
  
  // Check if browser notifications are enabled
  showBrowserNotification('Hoàn thành công việc', `Nhiệm vụ "${task.name}" đã được hoàn thành lúc ${formatTimeVN(new Date())}!`);
  
  // Push Toast message
  showToast(`Chúc mừng! Bạn đã hoàn thành công việc: "${task.name}"`);
  
  // Send Telegram completion notification and handle deleting old reminder
  sendTelegramCompletedNotification(task);
}

// --- Telegram API Notification Handling ---
async function sendTelegramReminder(task) {
  if (!settings.tgToken || !settings.tgChatId) return;
  
  // Format details for Unicode box drawing
  const dateFormatted = formatDateVN(task.date);
  
  const fields = {
    'Công việc ': task.name,
    'Danh mục  ': task.category,
    'Giờ       ': task.time,
    'Ngày      ': dateFormatted,
    'Trạng thái': 'Chưa hoàn thành'
  };
  
  const textMessage = formatTelegramBox('NHẮC LỊCH', fields);
  
  try {
    const url = `https://api.telegram.org/bot${settings.tgToken}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: settings.tgChatId,
        text: textMessage
      })
    });
    
    const result = await response.json();
    if (result.ok) {
      // Save message ID to delete it later when task is marked complete
      task.tgMessageId = result.result.message_id;
      task.tgReminderSent = true;
      saveDataToLocalStorage();
      console.log(`Telegram Reminder Sent for task: ${task.name}. Message ID: ${task.tgMessageId}`);
    } else {
      console.error("Telegram API Error:", result);
    }
  } catch (e) {
    console.error("Failed to send Telegram request:", e);
  }
}

async function sendTelegramCompletedNotification(task) {
  if (!settings.tgToken || !settings.tgChatId) return;
  
  // 1. Delete previous reminder message if tgMessageId exists
  if (task.tgMessageId) {
    try {
      const deleteUrl = `https://api.telegram.org/bot${settings.tgToken}/deleteMessage`;
      const delResponse = await fetch(deleteUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: settings.tgChatId,
          message_id: task.tgMessageId
        })
      });
      const delResult = await delResponse.json();
      if (delResult.ok) {
        console.log(`Successfully deleted Telegram reminder message ID: ${task.tgMessageId}`);
      } else {
        console.warn(`Could not delete Telegram message ID: ${task.tgMessageId}. It might have been deleted already or is too old.`, delResult);
      }
    } catch (e) {
      console.error("Error calling Telegram deleteMessage:", e);
    }
    
    // Clear message ID flag in storage
    task.tgMessageId = null;
    saveDataToLocalStorage();
  }
  
  // 2. Send task completed message
  const now = new Date();
  const timeCompletedStr = formatTimeVN(now);
  
  const fields = {
    'Công việc ': task.name,
    'Hoàn thành lúc': timeCompletedStr,
    'Danh mục ': task.category,
    'Trạng thái ': 'Hoàn thành'
  };
  
  const textMessage = formatTelegramBox('HOÀN THÀNH', fields);
  
  try {
    const url = `https://api.telegram.org/bot${settings.tgToken}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: settings.tgChatId,
        text: textMessage
      })
    });
    const result = await response.json();
    if (result.ok) {
      console.log(`Telegram Completion Sent for task: ${task.name}`);
    } else {
      console.error("Telegram API Completion Send Error:", result);
    }
  } catch (e) {
    console.error("Failed to send Telegram completion request:", e);
  }
}

// Unicode Message formatter helper
function formatTelegramBox(title, fields) {
  const width = 36;
  let result = '┌' + '─'.repeat(width) + '┐\n';
  
  // Title centered
  const titlePad = width - title.length;
  const leftPad = Math.floor(titlePad / 2);
  const rightPad = titlePad - leftPad;
  result += '│' + ' '.repeat(leftPad) + title + ' '.repeat(rightPad) + '│\n';
  result += '├' + '─'.repeat(width) + '┤\n';
  
  // Lines
  for (const [key, value] of Object.entries(fields)) {
    const lineStr = `${key} : ${value}`;
    
    // Simple wrap or truncate for safety
    let finalStr = lineStr;
    if (lineStr.length > width - 2) {
      finalStr = lineStr.substring(0, width - 5) + '...';
    }
    
    const pad = width - 2 - finalStr.length;
    result += '│ ' + finalStr + ' '.repeat(pad) + ' │\n';
  }
  
  result += '└' + '─'.repeat(width) + '┘';
  return result;
}

// --- Realtime Scheduler Timer ---
function startScheduler() {
  // Check triggers every second
  setInterval(() => {
    const now = new Date();
    const currentDateStr = formatDateString(now);
    const currentTimeStr = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
    
    // Unique key to prevent executing multiple times inside the same minute
    const minuteKey = `${currentDateStr}_${currentTimeStr}`;
    
    // 1. Update overdue task statuses in state dynamically
    let stateChanged = false;
    tasks.forEach(task => {
      if (task.status !== 'Hoàn thành') {
        const taskTime = new Date(`${task.date}T${task.time}`);
        if (taskTime < now && task.status !== 'Quá hạn') {
          task.status = 'Quá hạn';
          stateChanged = true;
        }
      }
    });
    if (stateChanged) {
      saveDataToLocalStorage();
      if (activePage === 'dashboard') renderDashboard();
      else if (activePage === 'calendar') renderTaskList();
    }
    
    // 2. Check scheduled time reminders
    tasks.forEach(task => {
      // If task date and time match exactly, not completed, and reminder is not yet sent
      if (task.date === currentDateStr && task.time === currentTimeStr && task.status !== 'Hoàn thành') {
        const cacheKey = `${task.id}_${minuteKey}`;
        
        if (!task.tgReminderSent && !triggeredThisMinute.has(cacheKey)) {
          // Push to triggered cache
          triggeredThisMinute.add(cacheKey);
          
          // Trigger local system alarms (sound, notify, modal dialog)
          triggerAlarmAlerts(task);
          
          // Send Telegram notification
          sendTelegramReminder(task);
        }
      }
    });
    
    // Clean triggered caches periodically (older than 2 mins) to preserve memory
    if (now.getSeconds() === 0 && triggeredThisMinute.size > 20) {
      triggeredThisMinute.clear();
    }
  }, 1000);
}

// Trigger Alarm alerts (Audio synthesizer + Desktop popups + App overlay)
function triggerAlarmAlerts(task) {
  // Play short chime beep synthesizer
  playNotificationSound();
  
  // Show browser alert
  showBrowserNotification('Nhắc nhở công việc!', `Đã đến giờ làm công việc: "${task.name}"`);
  
  // Open full alarm modal blocker inside the application if settings allow
  if (settings.appPopupAlert) {
    const alarmModal = document.getElementById('alarm-modal');
    document.getElementById('alarm-task-name').textContent = task.name;
    document.getElementById('alarm-task-time-info').textContent = `Thời gian: ${task.time} - Danh mục: ${task.category}`;
    document.getElementById('alarm-task-desc').textContent = task.desc || 'Không có ghi chú thêm.';
    
    // Hook alarm controls
    const dismissBtn = document.getElementById('btn-alarm-dismiss');
    const snoozeBtn = document.getElementById('btn-alarm-snooze');
    const completeBtn = document.getElementById('btn-alarm-complete');
    
    const dismissHandler = () => {
      alarmModal.classList.remove('active');
      cleanupHandlers();
    };
    
    const snoozeHandler = () => {
      // Postpone task hour by 5 minutes
      const now = new Date();
      const snoozeTime = new Date(now.getTime() + 5 * 60000);
      task.time = String(snoozeTime.getHours()).padStart(2, '0') + ':' + String(snoozeTime.getMinutes()).padStart(2, '0');
      task.date = formatDateString(snoozeTime);
      task.tgReminderSent = false; // Reset to allow reminder again
      
      saveDataToLocalStorage();
      showToast('Đã báo lại công việc sau 5 phút.');
      alarmModal.classList.remove('active');
      cleanupHandlers();
      
      if (activePage === 'dashboard') renderDashboard();
      else if (activePage === 'calendar') {
        renderCalendar();
        renderTaskList();
      }
    };
    
    const completeHandler = () => {
      toggleTaskCompletion(task.id);
      alarmModal.classList.remove('active');
      cleanupHandlers();
    };
    
    function cleanupHandlers() {
      dismissBtn.removeEventListener('click', dismissHandler);
      snoozeBtn.removeEventListener('click', snoozeHandler);
      completeBtn.removeEventListener('click', completeHandler);
    }
    
    dismissBtn.addEventListener('click', dismissHandler);
    snoozeBtn.addEventListener('click', snoozeHandler);
    completeBtn.addEventListener('click', completeHandler);
    
    alarmModal.classList.add('active');
  }
}

// --- Synthesize Chime notification sound (Web Audio API) ---
function playNotificationSound() {
  if (!settings.soundNotification) return;
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    
    const playTone = (freq, startTime, duration) => {
      const osc = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      osc.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);
      
      gainNode.gain.setValueAtTime(0, startTime);
      gainNode.gain.linearRampToValueAtTime(0.15, startTime + 0.05);
      gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
      
      osc.start(startTime);
      osc.stop(startTime + duration);
    };
    
    const now = audioCtx.currentTime;
    // Pleasant dual chime: C5 (523.25 Hz) then E5 (659.25 Hz)
    playTone(523.25, now, 0.25);
    playTone(659.25, now + 0.15, 0.4);
  } catch (e) {
    console.error("Synthesizer failed to generate audio chime:", e);
  }
}

// Browser notifications request & display
function requestNotificationPermission() {
  if ("Notification" in window && Notification.permission !== "granted" && Notification.permission !== "denied") {
    Notification.requestPermission();
  }
}

function showBrowserNotification(title, body) {
  if (!settings.browserNotification) return;
  if ("Notification" in window && Notification.permission === "granted") {
    try {
      new Notification(title, { body });
    } catch (e) {
      console.warn("Desktop notifications failed:", e);
    }
  }
}

// --- Category Page Display ---
function renderCategoriesGrid() {
  const categories = ['Học tập', 'Công việc', 'Cá nhân', 'Gia đình', 'Sức khỏe', 'Khác'];
  
  categories.forEach(cat => {
    const catTasks = tasks.filter(t => t.category === cat);
    const count = catTasks.length;
    const completed = catTasks.filter(t => t.status === 'Hoàn thành').length;
    
    // Slugs
    const slugMap = {
      'Học tập': 'study',
      'Công việc': 'work',
      'Cá nhân': 'personal',
      'Gia đình': 'family',
      'Sức khỏe': 'health',
      'Khác': 'other'
    };
    const slug = slugMap[cat];
    
    // Update labels count
    document.getElementById(`cat-count-${slug}`).textContent = `${count} công việc`;
    
    // Progress fill & percentage
    const pct = count > 0 ? Math.round((completed / count) * 100) : 0;
    document.getElementById(`cat-progress-${slug}`).style.width = `${pct}%`;
    document.getElementById(`cat-pct-${slug}`).textContent = `${pct}% Hoàn thành`;
  });
  
  // Add listeners to cards to view specific categories
  document.querySelectorAll('.category-card').forEach(card => {
    card.replaceWith(card.cloneNode(true)); // remove old listeners
  });
  
  document.querySelectorAll('.category-card').forEach(card => {
    card.addEventListener('click', () => {
      const category = card.getAttribute('data-category');
      openCategoryTaskList(category);
    });
  });
}

function openCategoryTaskList(category) {
  activeCategoryFilter = category;
  document.getElementById('categories-grid-container').style.display = 'none';
  
  const section = document.getElementById('selected-category-section');
  document.getElementById('selected-category-title').textContent = `Danh mục: ${category}`;
  
  section.style.display = 'block';
  
  renderCategoryTaskList(category);
  
  // Hook back button
  document.getElementById('btn-back-categories').onclick = () => {
    section.style.display = 'none';
    document.getElementById('categories-grid-container').style.display = 'grid';
    activeCategoryFilter = '';
  };
}

function renderCategoryTaskList(category) {
  const container = document.getElementById('category-task-list');
  const catTasks = tasks.filter(t => t.category === category);
  
  if (catTasks.length === 0) {
    container.innerHTML = `<div class="tasks-empty">Không có công việc nào thuộc danh mục này.</div>`;
    return;
  }
  
  // Sort category tasks chronologically by date then time
  catTasks.sort((a, b) => {
    const dateComp = a.date.localeCompare(b.date);
    if (dateComp !== 0) return dateComp;
    return a.time.localeCompare(b.time);
  });
  
  container.innerHTML = catTasks.map(task => renderSingleTaskCard(task)).join('');
}

// --- History Page Display ---
function renderHistory() {
  // Stats
  const totalCreatedVal = tasks.length + deletedTasks.length;
  const totalCompletedVal = tasks.filter(t => t.status === 'Hoàn thành').length;
  const totalDeletedVal = deletedTasks.length;
  const pct = totalCreatedVal > 0 ? Math.round((totalCompletedVal / totalCreatedVal) * 100) : 0;
  
  document.getElementById('hist-total-created').textContent = totalCreatedVal;
  document.getElementById('hist-total-completed').textContent = totalCompletedVal;
  document.getElementById('hist-total-deleted').textContent = totalDeletedVal;
  document.getElementById('hist-performance-pct').textContent = `${pct}%`;
  
  // Completed List
  const completedListContainer = document.getElementById('history-completed-list');
  const completedTasks = tasks.filter(t => t.status === 'Hoàn thành');
  
  if (completedTasks.length === 0) {
    completedListContainer.innerHTML = `<div class="history-empty">Chưa có công việc nào hoàn thành.</div>`;
  } else {
    // Sort recently completed first
    const sortedCompleted = [...completedTasks].sort((a, b) => new Date(b.completedAt || 0) - new Date(a.completedAt || 0));
    
    completedListContainer.innerHTML = sortedCompleted.map(task => `
      <div class="history-item-card">
        <div class="history-item-top">
          <h4 class="history-item-title">${escapeHTML(task.name)}</h4>
          <span class="history-item-time">${formatDateVN(task.date)} ${task.time}</span>
        </div>
        ${task.desc ? `<p class="history-item-desc">${escapeHTML(task.desc)}</p>` : ''}
        <div class="history-item-footer">
          <span>Danh mục: ${task.category}</span>
          <div class="history-item-actions">
            <button class="btn-link-action" onclick="toggleTaskCompletion('${task.id}')">Hoàn tác</button>
          </div>
        </div>
      </div>
    `).join('');
  }
  
  // Trash Bin list
  const deletedListContainer = document.getElementById('history-deleted-list');
  if (deletedTasks.length === 0) {
    deletedListContainer.innerHTML = `<div class="history-empty">Thùng rác trống.</div>`;
  } else {
    // Sort recently deleted first
    const sortedDeleted = [...deletedTasks].sort((a, b) => new Date(b.deletedAt || 0) - new Date(a.deletedAt || 0));
    
    deletedListContainer.innerHTML = sortedDeleted.map(task => `
      <div class="history-item-card hist-deleted">
        <div class="history-item-top">
          <h4 class="history-item-title">${escapeHTML(task.name)}</h4>
          <span class="history-item-time">${formatDateVN(task.date)} ${task.time}</span>
        </div>
        ${task.desc ? `<p class="history-item-desc">${escapeHTML(task.desc)}</p>` : ''}
        <div class="history-item-footer">
          <span>Xóa lúc: ${formatDateVN(task.deletedAt.split('T')[0])} ${task.deletedAt.split('T')[1].substring(0,5)}</span>
          <div class="history-item-actions">
            <button class="btn-link-action" onclick="restoreDeletedTask('${task.id}')">Khôi phục</button>
            <button class="btn-link-action text-danger" onclick="permanentlyDeleteTask('${task.id}')">Xóa vĩnh viễn</button>
          </div>
        </div>
      </div>
    `).join('');
  }
}

function restoreDeletedTask(id) {
  const idx = deletedTasks.findIndex(t => t.id === id);
  if (idx !== -1) {
    const task = deletedTasks.splice(idx, 1)[0];
    delete task.deletedAt;
    
    // Put back into main array
    tasks.push(task);
    saveDataToLocalStorage();
    showToast(`Đã khôi phục công việc "${task.name}"`);
    renderHistory();
  }
}

function permanentlyDeleteTask(id) {
  const idx = deletedTasks.findIndex(t => t.id === id);
  if (idx !== -1) {
    const task = deletedTasks[idx];
    deletedTasks.splice(idx, 1);
    saveDataToLocalStorage();
    showToast(`Đã xóa vĩnh viễn công việc "${task.name}"`);
    renderHistory();
  }
}

function initHistoryPanel() {
  document.getElementById('btn-clear-completed-hist').addEventListener('click', () => {
    // We cannot just delete completed tasks since they are the active tasks, wait, 
    // clear completed history means we either change their status to delete, or delete them?
    // Actually, completed tasks are still visible in Calendar. Cleansing it means we move them to trash bin.
    const completed = tasks.filter(t => t.status === 'Hoàn thành');
    if (completed.length === 0) return;
    
    completed.forEach(task => {
      task.deletedAt = new Date().toISOString();
      deletedTasks.push(task);
    });
    
    tasks = tasks.filter(t => t.status !== 'Hoàn thành');
    saveDataToLocalStorage();
    showToast('Đã chuyển toàn bộ công việc hoàn thành vào Thùng rác.');
    renderHistory();
  });
  
  document.getElementById('btn-clear-deleted-hist').addEventListener('click', () => {
    if (deletedTasks.length === 0) return;
    deletedTasks = [];
    saveDataToLocalStorage();
    showToast('Đã dọn sạch thùng rác.');
    renderHistory();
  });
}

// --- Settings Page Configs ---
function initSettingsPanel() {
  // Load configurations
  document.getElementById('setting-telegram-token').value = settings.tgToken;
  document.getElementById('setting-telegram-chatid').value = settings.tgChatId;
  document.getElementById('setting-sound').checked = settings.soundNotification;
  document.getElementById('setting-browser-notify').checked = settings.browserNotification;
  document.getElementById('setting-app-popup').checked = settings.appPopupAlert;
  
  // Save configurations
  document.getElementById('btn-save-telegram').addEventListener('click', () => {
    const token = document.getElementById('setting-telegram-token').value.trim();
    const chatid = document.getElementById('setting-telegram-chatid').value.trim();
    
    if (!token || !chatid) {
      showToast('Vui lòng điền đầy đủ Token và Chat ID!', 'danger');
      return;
    }
    
    settings.tgToken = token;
    settings.tgChatId = chatid;
    saveDataToLocalStorage();
    showToast('Đã lưu cấu hình Telegram thành công!');
  });
  
  // Test Telegram connection
  document.getElementById('btn-test-telegram').addEventListener('click', async () => {
    const token = document.getElementById('setting-telegram-token').value.trim();
    const chatid = document.getElementById('setting-telegram-chatid').value.trim();
    
    if (!token || !chatid) {
      showToast('Thiếu Token hoặc Chat ID!', 'danger');
      return;
    }
    
    showToast('Đang gửi tin nhắn thử nghiệm...');
    
    const textMessage = formatTelegramBox('THỬ NGHIỆM KẾT NỐI', {
      'Thông báo ': 'Đã kết nối thành công',
      'Hệ thống  ': 'Lịch Công Việc',
      'Thời gian ': formatTimeVN(new Date())
    });
    
    try {
      const url = `https://api.telegram.org/bot${token}/sendMessage`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatid,
          text: textMessage
        })
      });
      const result = await response.json();
      if (result.ok) {
        showToast('Đã gửi tin nhắn thử nghiệm thành công! Hãy kiểm tra Telegram.');
      } else {
        showToast(`Lỗi: ${result.description}`, 'danger');
      }
    } catch (e) {
      showToast('Gửi tin nhắn thất bại. Vui lòng kiểm tra kết nối mạng hoặc Token.', 'danger');
    }
  });
  
  // Toggle sound alert
  document.getElementById('setting-sound').addEventListener('change', (e) => {
    settings.soundNotification = e.target.checked;
    saveDataToLocalStorage();
    if (settings.soundNotification) playNotificationSound();
  });
  
  // Toggle browser system notify
  document.getElementById('setting-browser-notify').addEventListener('change', (e) => {
    settings.browserNotification = e.target.checked;
    saveDataToLocalStorage();
    if (settings.browserNotification) {
      requestNotificationPermission();
    }
  });
  
  // Toggle app alarm alerts popup
  document.getElementById('setting-app-popup').addEventListener('change', (e) => {
    settings.appPopupAlert = e.target.checked;
    saveDataToLocalStorage();
  });
  
  // Reset all system data
  document.getElementById('btn-reset-data').addEventListener('click', () => {
    if (confirm("Cảnh báo! Bạn có chắc chắn muốn xóa sạch toàn bộ công việc, cấu hình Telegram và khôi phục cài đặt gốc không? Hành động này không thể hoàn tác.")) {
      localStorage.clear();
      tasks = [];
      deletedTasks = [];
      settings = {
        darkMode: false,
        tgToken: '',
        tgChatId: '',
        soundNotification: true,
        browserNotification: false,
        appPopupAlert: true
      };
      
      applyTheme(false);
      saveDataToLocalStorage();
      showToast('Đã xóa sạch toàn bộ dữ liệu hệ thống.');
      
      // Reload forms
      document.getElementById('setting-telegram-token').value = '';
      document.getElementById('setting-telegram-chatid').value = '';
      document.getElementById('setting-sound').checked = true;
      document.getElementById('setting-browser-notify').checked = false;
      document.getElementById('setting-app-popup').checked = true;
      document.getElementById('setting-dark-mode').checked = false;
      
      switchPage('dashboard');
    }
  });
  
  // Data Export JSON
  document.getElementById('btn-export-json').addEventListener('click', () => {
    const backup = {
      version: '1.0.0',
      tasks,
      deletedTasks,
      settings
    };
    
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lich_cong_viec_backup_${formatDateString(new Date())}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Đã xuất file cấu hình JSON thành công!');
  });
  
  // Data Import JSON triggers
  const importTriggerBtn = document.getElementById('btn-import-trigger');
  const importInput = document.getElementById('import-json-file');
  
  importTriggerBtn.addEventListener('click', () => {
    importInput.click();
  });
  
  importInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(evt) {
      try {
        const parsed = JSON.parse(evt.target.result);
        
        if (parsed.tasks && Array.isArray(parsed.tasks)) {
          tasks = parsed.tasks;
          if (parsed.deletedTasks && Array.isArray(parsed.deletedTasks)) {
            deletedTasks = parsed.deletedTasks;
          }
          if (parsed.settings) {
            settings = { ...settings, ...parsed.settings };
          }
          
          saveDataToLocalStorage();
          showToast('Nhập dữ liệu thành công!');
          
          // Refresh configuration page views
          initTheme();
          initSettingsPanel();
          switchPage('dashboard');
        } else {
          showToast('Cấu trúc file JSON không hợp lệ!', 'danger');
        }
      } catch (err) {
        showToast('Lỗi đọc file JSON. Vui lòng kiểm tra lại!', 'danger');
      }
      importInput.value = ''; // Reset input selection
    };
    reader.readAsText(file);
  });
}

// --- Toast Messages UI ---
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span class="toast-message">${escapeHTML(message)}</span>
    <button class="toast-close" onclick="this.parentElement.remove()">&times;</button>
  `;
  
  container.appendChild(toast);
  
  // Auto-remove after 4 seconds
  setTimeout(() => {
    toast.style.animation = 'toastSlideIn 0.3s reverse forwards';
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 4000);
}

// --- Helpers & Formatters ---
function escapeHTML(str) {
  if (!str) return '';
  return str.replace(/[&<>'"]/g, 
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag)
  );
}

function formatDateString(dateObj) {
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatDateVN(dateStr) {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}

function formatTimeVN(dateObj) {
  const h = String(dateObj.getHours()).padStart(2, '0');
  const m = String(dateObj.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}
